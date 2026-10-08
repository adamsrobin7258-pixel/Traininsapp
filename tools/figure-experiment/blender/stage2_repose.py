"""Stage 2: temporary armature on the base mesh, lower the arms from the A-pose (~37 deg) to ~12 deg."""
import bpy, sys, math
from mathutils import Vector, Matrix
src,deg,out=sys.argv[-3],sys.argv[-2],sys.argv[-1]
bpy.ops.wm.open_mainfile(filepath=src)
body=bpy.data.objects['kalethra_body']
J={ # A-pose joints, left side (+X); mirrored for the right
 'root':((0,0.0,0.0),(0,0,0.12)),
 'pelvis':((0,0.0,0.92),(0,0,1.05)),
 'spine':((0,0,1.05),(0,0.0,1.22)),
 'chest':((0,0,1.22),(0,0.02,1.46)),
 'neck':((0,0.02,1.46),(0,0.0,1.58)),
 'head':((0,0.0,1.58),(0,0.0,1.76)),
 'shoulder_L':((0.025,0.0,1.465),(0.175,0.025,1.445)),
 'upperArm_L':((0.19,0.025,1.43),(0.365,0.03,1.20)),
 'forearm_L':((0.365,0.03,1.20),(0.52,-0.02,1.045)),
 'hand_L':((0.52,-0.02,1.045),(0.60,-0.05,0.93)),
 'thigh_L':((0.095,0.0,0.93),(0.10,0.0,0.50)),
 'shin_L':((0.10,0.0,0.50),(0.11,0.03,0.085)),
 'foot_L':((0.11,0.03,0.085),(0.12,-0.12,0.02)),
}
parent={'pelvis':'root','spine':'pelvis','chest':'spine','neck':'chest','head':'neck','shoulder':'chest','upperArm':'shoulder','forearm':'upperArm','hand':'forearm','thigh':'pelvis','shin':'thigh','foot':'shin'}
arm=bpy.data.armatures.new('rig'); ao=bpy.data.objects.new('rig',arm); bpy.context.scene.collection.objects.link(ao)
bpy.context.view_layer.objects.active=ao; bpy.ops.object.mode_set(mode='EDIT')
names=[]
for n,(h,t) in J.items():
    sides=[('',1)] if not n.endswith('_L') else [('_L',1),('_R',-1)]
    base=n[:-2] if n.endswith('_L') else n
    for suf,sg in sides:
        b=arm.edit_bones.new(base+suf); b.head=(h[0]*sg,h[1],h[2]); b.tail=(t[0]*sg,t[1],t[2]); names.append(b.name)
for b in arm.edit_bones:
    base=b.name.split('_')[0]; suf=b.name[len(base):]
    if base in parent:
        p=parent[base]; pn=p+suf if p+suf in arm.edit_bones else p
        b.parent=arm.edit_bones[pn]; 
        if (b.head-arm.edit_bones[pn].tail).length<1e-4: b.use_connect=True
bpy.ops.object.mode_set(mode='OBJECT')
arm.edit_bones if False else None
ao.data.bones['root'].use_deform=False
bpy.ops.object.select_all(action='DESELECT'); body.select_set(True); ao.select_set(True); bpy.context.view_layer.objects.active=ao
bpy.ops.object.parent_set(type='ARMATURE_AUTO')
print('VGROUPS',len(body.vertex_groups))
# pose: lower arms
bpy.ops.object.mode_set(mode='POSE')
DOWN=math.radians(float(deg))
for side,sg in (('L',1),('R',-1)):
    pb=ao.pose.bones['upperArm_'+side]
    # rotate about world Y through the joint; sign chosen so the hand moves towards the body
    Rw=Matrix.Rotation(sg*DOWN,4,'Y')
    M=pb.bone.matrix_local.to_3x3().to_4x4()
    pb.matrix_basis=(M.inverted()@Rw@M)
    fb=ao.pose.bones['forearm_'+side]
    # a little extra adduction of the forearm (carrying angle ~ 10 deg remains) and slight elbow flex
    M2=fb.bone.matrix_local.to_3x3().to_4x4()
    fb.matrix_basis=M2.inverted()@Matrix.Rotation(sg*math.radians(6),4,'Y')@M2
bpy.ops.object.mode_set(mode='OBJECT')
bpy.context.view_layer.update()
for side in 'LR':
    pb=ao.pose.bones['upperArm_'+side]; print(side,'elbow',tuple(round(x,3) for x in (ao.matrix_world@pb.tail)), 'wrist', tuple(round(x,3) for x in ao.pose.bones['forearm_'+side].tail))
cs=body.modifiers.new('cs','CORRECTIVE_SMOOTH'); cs.rest_source='ORCO'; cs.iterations=12; cs.smooth_type='LENGTH_WEIGHTED'; cs.factor=0.5
bpy.context.view_layer.objects.active=body; body.select_set(True)
for m in list(body.modifiers): bpy.ops.object.modifier_apply(modifier=m.name)
bpy.context.view_layer.objects.active=ao; bpy.ops.object.mode_set(mode='POSE'); bpy.ops.pose.armature_apply(selected=False); bpy.ops.object.mode_set(mode='OBJECT')
body.parent=None
bpy.data.objects.remove(ao)
# body part per vertex from the dominant bone (used by the sculpt stage to keep limbs and torso apart)
PART={'head':5,'neck':5,'chest':0,'spine':0,'pelvis':0,'shoulder':0,'upperArm':1,'forearm':1,'hand':1,'thigh':3,'shin':3,'foot':3}
gi={vg.index:vg.name for vg in body.vertex_groups}
att=body.data.attributes.new('part','INT','POINT')
for v in body.data.vertices:
    best=max(v.groups,key=lambda g:g.weight,default=None)
    n=gi[best.group] if best else 'chest'
    base=n.split('_')[0]; p=PART.get(base,0)
    if p in (1,3) and n.endswith('_R'): p+=1
    att.data[v.index].value=p
for vg in list(body.vertex_groups): body.vertex_groups.remove(vg)
bpy.ops.wm.save_as_mainfile(filepath=out)
