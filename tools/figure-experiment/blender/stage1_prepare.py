"""Stage 1: import the Sketchfab base mesh, clean it, convert to metres, recover quads."""
import bpy, bmesh, sys, os
H=1.76
src,out=sys.argv[-2],sys.argv[-1]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=src)
o=[o for o in bpy.data.objects if o.type=='MESH'][0]
mw=o.matrix_world.copy(); o.parent=None; o.matrix_world=mw
for e in [x for x in bpy.data.objects if x.type=='EMPTY']: bpy.data.objects.remove(e)
bpy.context.view_layer.objects.active=o; o.select_set(True)
bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
me=o.data; bm=bmesh.new(); bm.from_mesh(me)
bmesh.ops.remove_doubles(bm,verts=bm.verts,dist=1e-4)
# drop stray islands (<100 verts)
bm.verts.ensure_lookup_table(); seen=set(); kill=[]
for v in bm.verts:
    if v in seen: continue
    st=[v]; seen.add(v); comp=[]
    while st:
        x=st.pop(); comp.append(x)
        for e in x.link_edges:
            y=e.other_vert(x)
            if y not in seen: seen.add(y); st.append(y)
    if len(comp)<100: kill+=comp
bmesh.ops.delete(bm,geom=kill,context='VERTS')
bnd=[e for e in bm.edges if e.is_boundary]
patch=set(v for e in bnd for v in e.verts)
if bnd: bmesh.ops.holes_fill(bm,edges=bnd,sides=0)
bmesh.ops.triangulate(bm,faces=[f for f in bm.faces if len(f.verts)>4])
# the filled hole (mid-back) and the base mesh's crease above the gluteal cleft leave dents:
# relax the neighbourhood of the patch and the lumbar/sacral midline (base mesh still in cm)
if patch:
    c=sum((v.co for v in patch),patch.pop().co.copy()*0)/max(len(patch),1)
else: c=None
near=[v for v in bm.verts if (c is not None and (v.co-c).length<4.0) or (abs(v.co.x)<3.0 and v.co.y>3.0 and 88<v.co.z<112)]
for _ in range(12):
    bmesh.ops.smooth_vert(bm,verts=near,factor=0.5,use_axis_x=True,use_axis_y=True,use_axis_z=True)
bmesh.ops.triangulate(bm,faces=[f for f in bm.faces if len(f.verts)>4])
bmesh.ops.join_triangles(bm,faces=bm.faces,angle_face_threshold=3.14,angle_shape_threshold=3.14,cmp_seam=False,cmp_sharp=False,cmp_uvs=False,cmp_vcols=False,cmp_materials=False)
bm.to_mesh(me); bm.free()
# metres, floor at 0, centred
zs=[v.co.z for v in me.vertices]; zmin,zmax=min(zs),max(zs)
s=H/(zmax-zmin)
xs=[v.co.x for v in me.vertices]; ys=[v.co.y for v in me.vertices]
cx=(min(xs)+max(xs))/2
# centre front/back on the feet/pelvis region rather than bbox
low=[v.co.y for v in me.vertices if v.co.z<zmin+0.55*(zmax-zmin) and v.co.z>zmin+0.45*(zmax-zmin)]
cy=(min(low)+max(low))/2
for v in me.vertices:
    v.co.x=(v.co.x-cx)*s; v.co.y=(v.co.y-cy)*s; v.co.z=(v.co.z-zmin)*s
o.name='kalethra_body'; me.name='kalethra_body'
for p in me.polygons: p.use_smooth=True
from collections import Counter
print('STATS verts',len(me.vertices),'faces',Counter(len(p.vertices) for p in me.polygons))
bpy.ops.wm.save_as_mainfile(filepath=out)
