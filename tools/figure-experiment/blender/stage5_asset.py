"""Stage 5: game asset from the sculpt - decimated mesh (contract budget), UVs, tangent-space normal
map baked from the sculpt, muscle/body nodes per the Kalethra contract, rig with the contract
bones (automatic weights), rest action, materials. Saves the .blend and exports the raw GLB
(post-processed by finalize_glb.py)."""
import bpy, sys, os, numpy as np, math, time
sys.path.insert(0,os.path.dirname(os.path.abspath(__file__)))
from kx_common import *
from scipy.spatial import cKDTree
src,outdir=sys.argv[-2],sys.argv[-1]
TRIS=int(os.environ.get('KX_TRIS','56000')); TEX=int(os.environ.get('KX_TEX','2048'))
os.makedirs(outdir,exist_ok=True)
bpy.ops.wm.open_mainfile(filepath=src)
sc=bpy.context.scene
high=bpy.data.objects['kalethra_body']; high.name='kalethra_sculpt'; high.data.name='kalethra_sculpt'
H=high.data; HP=positions(H)
labels=[a.name[2:] for a in H.attributes if a.name.startswith('m_')]
LV=np.zeros((len(HP),len(labels)))
for k,n in enumerate(labels):
    v=np.empty(len(HP)); H.attributes['m_'+n].data.foreach_get('value',v); LV[:,k]=v
hpart=np.empty(len(HP),dtype=np.int32); H.attributes['part'].data.foreach_get('value',hpart)
# ---- low mesh
low=high.copy(); low.data=high.data.copy(); low.name='kalethra_low'; low.data.name='kalethra_low'
sc.collection.objects.link(low)
# the decimation source carries only the large forms (smoothed); grooves and fibres go into the normal map.
# Decimating the full-detail sculpt folds triangles over fine relief.
bco=np.empty(len(HP)*3); low.data.attributes['base_co'].data.foreach_get('vector',bco); bco=bco.reshape(-1,3)
bno=np.empty(len(HP)*3); low.data.attributes['base_no'].data.foreach_get('vector',bno); bno=bno.reshape(-1,3)
hf=np.empty(len(HP)); low.data.attributes['sculpt_form'].data.foreach_get('value',hf)
hf=laplacian_smooth_field(hf,edges(low.data),len(HP),int(os.environ.get('KX_LOWSMOOTH','10')),0.5)
set_positions(low.data,bco+bno*hf[:,None])
for a in [a.name for a in low.data.attributes if a.name.startswith(('m_','dbg','sculpt','base_'))]: low.data.attributes.remove(low.data.attributes[a])
bpy.ops.object.select_all(action='DESELECT'); low.select_set(True); bpy.context.view_layer.objects.active=low
m=low.modifiers.new('d','DECIMATE'); m.ratio=TRIS/(2*len(low.data.polygons)); m.use_symmetry=os.environ.get('KX_SYM','0')=='1'; m.symmetry_axis='X'
bpy.ops.object.modifier_apply(modifier='d')
bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.select_all(action='SELECT'); bpy.ops.mesh.quads_convert_to_tris()
bpy.ops.mesh.dissolve_degenerate(threshold=1e-5)
bpy.ops.object.mode_set(mode='OBJECT')
for p in low.data.polygons: p.use_smooth=True
print('low tris',len(low.data.polygons))
from mathutils.bvhtree import BVHTree
from mathutils import Vector
import bmesh
hb=BVHTree.FromObject(high,bpy.context.evaluated_depsgraph_get())
def folded_faces(me):
    out=[]
    for p in me.polygons:
        loc,nor,_,_=hb.find_nearest(p.center)
        if nor is not None and Vector(p.normal).dot(nor)<0.2: out.append(p.index)
    return out
print('folded faces (low vs sculpt normal < 0.2)',len(folded_faces(low.data)))
# ---- UVs: seams along anatomical cuts would be ideal (retopo step); here: smart project, large islands
bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.select_all(action='SELECT')
bpy.ops.uv.smart_project(angle_limit=math.radians(float(os.environ.get('KX_UVANGLE','89'))),island_margin=0.006,area_weight=0.0,correct_aspect=True,scale_to_bounds=False)
bpy.ops.object.mode_set(mode='OBJECT')
# ---- material + bake target
img=bpy.data.images.new('kalethra_normal',TEX,TEX,alpha=False,float_buffer=False); img.colorspace_settings.name='Non-Color'
img.generated_color=(0.5,0.5,1,1)
mat=bpy.data.materials.new('skin'); mat.use_nodes=True; nt=mat.node_tree; bsdf=nt.nodes['Principled BSDF']
def srgb(c): c=c/255.0; return ((c+0.055)/1.055)**2.4 if c>0.04045 else c/12.92
SKIN=(0xcd,0xbd,0xae)
bsdf.inputs['Base Color'].default_value=(*[srgb(c) for c in SKIN],1); bsdf.inputs['Roughness'].default_value=0.72
bsdf.inputs['Metallic'].default_value=0.0
try: bsdf.inputs['Specular IOR Level'].default_value=0.4
except KeyError: pass
tex=nt.nodes.new('ShaderNodeTexImage'); tex.image=img; tex.interpolation='Linear'
nm=nt.nodes.new('ShaderNodeNormalMap'); nt.links.new(tex.outputs['Color'],nm.inputs['Color']); nt.links.new(nm.outputs['Normal'],bsdf.inputs['Normal'])
nt.nodes.active=tex
low.data.materials.clear(); low.data.materials.append(mat)
sc.render.engine='CYCLES'; sc.cycles.device='CPU'; sc.cycles.samples=1
bk=sc.render.bake; bk.use_selected_to_active=True; bk.cage_extrusion=float(os.environ.get('KX_CAGE','0.005')); bk.max_ray_distance=float(os.environ.get('KX_RAY','0.014')); bk.margin=8; bk.normal_space='TANGENT'
bpy.ops.object.select_all(action='DESELECT'); high.select_set(True); low.select_set(True); bpy.context.view_layer.objects.active=low
lk=nt.links.new(tex.outputs['Color'],nm.inputs['Color']); nt.links.remove(lk)
t=time.time(); bpy.ops.object.bake(type='NORMAL'); print('bake',round(time.time()-t,1))
nt.links.new(tex.outputs['Color'],nm.inputs['Color'])
# texels whose baked normal points away from the surface (ray hit a neighbouring limb or nothing
# usable) fall back to the smooth surface normal
px=np.array(img.pixels[:]).reshape(-1,4); n=px[:,:3]*2-1
bad=n[:,2]<0.35
px[bad,:3]=(0.5,0.5,1.0); img.pixels[:]=px.ravel(); img.update()
print('normal map texels reset',int(bad.sum()))
img.filepath_raw=os.path.join(outdir,'kalethra_normal.png'); img.file_format='PNG'; img.save()
img.pack()
# ---- labels per low face (nearest sculpt vertex to the face centre)
L=low.data; LP=positions(L)
fc=np.array([p.center for p in L.polygons])
d,ix=cKDTree(HP).query(fc)
cov=LV[ix]; part=hpart[ix]
best=cov.argmax(1); bestv=cov.max(1)
fl=np.array([labels[b] if v>0.22 else '' for b,v in zip(best,bestv)],dtype=object)
z=fc[:,2]
def neutral(i):
    p=part[i]
    if p==5: return 'body_head' if z[i]>1.53 else 'body_neck'
    if p in (1,2): return 'body_hands' if z[i]<0.95 else 'body_arms'
    if p in (3,4):
        if z[i]<0.10: return 'body_feet'
        if abs(z[i]-0.49)<0.06: return 'body_knees'
        if z[i]<0.49: return 'body_shins'
        return 'body_hips'
    return 'body_pelvis' if z[i]<0.97 else ('body_neck' if z[i]>1.45 else 'body_torso')
names=np.array([('muscle_'+fl[i]) if fl[i] else neutral(i) for i in range(len(fl))],dtype=object)
# hands/feet/head are never muscles
for i in range(len(names)):
    if part[i]==5 and z[i]>1.53: names[i]='body_head'
    elif part[i] in (1,2) and z[i]<0.95: names[i]='body_hands'
    elif part[i] in (3,4) and z[i]<0.10: names[i]='body_feet'
# clean speckles: majority of edge neighbours, a few passes
import collections
fadj=collections.defaultdict(list)
ek={}
for p in L.polygons:
    for e in p.edge_keys: ek.setdefault(e,[]).append(p.index)
for e,fs in ek.items():
    if len(fs)==2: fadj[fs[0]].append(fs[1]); fadj[fs[1]].append(fs[0])
for _ in range(4):
    new=names.copy()
    for i in range(len(names)):
        c=collections.Counter(names[j] for j in fadj[i])
        if c and c.most_common(1)[0][1]>=2 and names[i] not in c: new[i]=c.most_common(1)[0][0]
    names=new
uniq=sorted(set(names)); print('nodes',len(uniq),uniq)
# ---- rig (temporary anatomical bone tails for the weights; finalize_glb.py makes rest rotations identity)
J={'root':((0,0,0),(0,0,0.1)),'pelvis':((0,0.01,0.93),(0,0.02,1.05)),'spine':((0,0.02,1.05),(0,0.03,1.25)),
   'chest':((0,0.03,1.25),(0,0.03,1.47)),'neck':((0,0.03,1.47),(0,0.02,1.565)),'head':((0,0.02,1.565),(0,0.0,1.74)),
   'shoulder_L':((0.025,0.0,1.445),(0.17,0.035,1.43)),'upperArm_L':((0.187,0.045,1.40),(0.264,0.052,1.13)),
   'forearm_L':((0.264,0.052,1.13),(0.288,0.016,1.032)),'forearmTwist_L':((0.288,0.016,1.032),(0.312,-0.02,0.935)),
   'hand_L':((0.312,-0.02,0.935),(0.314,-0.065,0.80)),
   'thigh_L':((0.093,0.01,0.90),(0.106,0.0,0.49)),'shin_L':((0.106,0.0,0.49),(0.118,0.035,0.085)),'foot_L':((0.118,0.035,0.085),(0.125,-0.10,0.02))}
PAR={'pelvis':'root','spine':'pelvis','chest':'spine','neck':'chest','head':'neck','shoulder':'chest','upperArm':'shoulder',
     'forearm':'upperArm','forearmTwist':'forearm','hand':'forearmTwist','thigh':'pelvis','shin':'thigh','foot':'shin'}
arm=bpy.data.armatures.new('kalethra_rig'); rig=bpy.data.objects.new('kalethra_male_experimental',arm); sc.collection.objects.link(rig)
bpy.ops.object.select_all(action='DESELECT'); bpy.context.view_layer.objects.active=rig; rig.select_set(True)
bpy.ops.object.mode_set(mode='EDIT')
for n,(h,t) in J.items():
    for suf,sg in ([('',1)] if not n.endswith('_L') else [('_L',1),('_R',-1)]):
        nm_=n[:-2]+suf if n.endswith('_L') else n
        b=arm.edit_bones.new(nm_); b.head=(h[0]*sg,h[1],h[2]); b.tail=(t[0]*sg,t[1],t[2])
for b in arm.edit_bones:
    base=b.name.split('_')[0]; suf=b.name[len(base):]
    if base in PAR:
        p=PAR[base]; b.parent=arm.edit_bones[p+suf if p+suf in arm.edit_bones else p]
bpy.ops.object.mode_set(mode='OBJECT')
arm.bones['root'].use_deform=False
bpy.ops.object.select_all(action='DESELECT'); low.select_set(True); rig.select_set(True); bpy.context.view_layer.objects.active=rig
bpy.ops.object.parent_set(type='ARMATURE_AUTO')
empty=[vg.name for vg in low.vertex_groups if not any(g.group==vg.index for v in low.data.vertices[:1] for g in v.groups)]
print('vertex groups',len(low.vertex_groups))
# limit to 4 influences, normalise
bpy.ops.object.select_all(action='DESELECT'); low.select_set(True); bpy.context.view_layer.objects.active=low
bpy.ops.object.vertex_group_limit_total(group_select_mode='ALL',limit=4)
bpy.ops.object.vertex_group_normalize_all(group_select_mode='ALL',lock_active=False)
unw=sum(1 for v in L.vertices if len(v.groups)==0); print('unweighted verts',unw)
# ---- keep the shading continuous across node borders: custom normals from the joined mesh
L.normals_split_custom_set_from_vertices([tuple(n) for n in normals(L)])
# ---- split into nodes
idx_by={n:[i for i in range(len(names)) if names[i]==n] for n in uniq}
import bmesh
for n in uniq:
    pass
# store the node name per face, then separate node by node in face-select mode
bpy.context.tool_settings.mesh_select_mode=(False,False,True)
fa=L.attributes.new('kx_node','INT','FACE'); fa.data.foreach_set('value',np.array([uniq.index(n) for n in names],dtype=np.int32))
for k,n in enumerate(uniq[:-1]):
    bpy.ops.object.select_all(action='DESELECT'); low.select_set(True); bpy.context.view_layer.objects.active=low
    bpy.ops.object.mode_set(mode='EDIT')
    bm=bmesh.from_edit_mesh(low.data); lay=bm.faces.layers.int['kx_node']
    for v in bm.verts: v.select_set(False)
    for f in bm.faces: f.select_set(f[lay]==k)
    bm.select_flush_mode(); bmesh.update_edit_mesh(low.data)
    bpy.ops.mesh.separate(type='SELECTED'); bpy.ops.object.mode_set(mode='OBJECT')
    new=[o for o in bpy.context.selected_objects if o!=low][0]
    new.name=n; new.data.name=n
for o in bpy.data.objects:
    if o.type=='MESH' and 'kx_node' in o.data.attributes: o.data.attributes.remove(o.data.attributes['kx_node'])
low.name=uniq[-1]; low.data.name=uniq[-1]
for o in bpy.data.objects:
    if o.type=='MESH' and o!=high:
        o.parent=rig
        if not any(md.type=='ARMATURE' for md in o.modifiers):
            md=o.modifiers.new('Armature','ARMATURE'); md.object=rig
# ---- rest action
rig.animation_data_create(); act=bpy.data.actions.new('rest')
rig.animation_data.action=act
bpy.context.view_layer.objects.active=rig; bpy.ops.object.mode_set(mode='POSE')
for pb in rig.pose.bones:
    pb.rotation_mode='QUATERNION'; pb.location=(0,0,0); pb.rotation_quaternion=(1,0,0,0); pb.scale=(1,1,1)
    pb.keyframe_insert('location',frame=1); pb.keyframe_insert('rotation_quaternion',frame=1)
bpy.ops.object.mode_set(mode='OBJECT')
# sculpt object stays in the .blend (hidden from export/render by default)
high.hide_render=True; high.hide_set(True)
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(outdir,'stage5.blend'),compress=True)
# ---- export raw GLB (all visible meshes + rig)
for o in bpy.data.objects: o.select_set(False)
for o in bpy.data.objects:
    if o.type in('MESH','ARMATURE') and o!=high: o.select_set(True)
bpy.ops.export_scene.gltf(filepath=os.path.join(outdir,'raw.glb'),export_format='GLB',use_selection=True,export_yup=True,
    export_apply=False,export_skins=True,export_animations=True,export_normals=True,export_texcoords=True,export_tangents=False,
    export_materials='EXPORT',export_image_format=os.environ.get('KX_IMG','JPEG'),export_jpeg_quality=int(os.environ.get('KX_JPEG','88')),
    export_morph=False,export_all_influences=False,export_def_bones=False,export_animation_mode='ACTIONS')
print('exported')
