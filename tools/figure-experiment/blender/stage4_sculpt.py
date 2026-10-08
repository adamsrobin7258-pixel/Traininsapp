"""Stage 4: subdivide and sculpt the anatomy (volumes, transitions, grooves, fibres)."""
import bpy, sys, os, numpy as np, math, time
sys.path.insert(0,os.path.dirname(os.path.abspath(__file__)))
from kx_common import *
from kx_sculpt import Body, Sculptor
from scipy.spatial import cKDTree
src,out=sys.argv[-2],sys.argv[-1]
LEVEL=int(os.environ.get('KX_LEVEL','2'))
bpy.ops.wm.open_mainfile(filepath=src)
o=bpy.data.objects['kalethra_body']; me=o.data
Plow=positions(me); Flow=[tuple(p.vertices) for p in me.polygons]
partlow=np.array([a.value for a in me.attributes['part'].data])
# fix the weight-based labels under the armpit: a vertex medial of the (measured) upper-arm axis
# whose normal faces the arm is the torso side wall; auto weights give part of it to the arm
Nlow=normals(me)
for side,pid in ((1,1),(-1,2)):
    S0=np.array([0.187*side,0.045,1.40]); E0=np.array([0.264*side,0.052,1.13])
    a=(E0-S0)/np.linalg.norm(E0-S0); tt=np.clip((Plow-S0)@a,0,np.linalg.norm(E0-S0))
    ax=S0+np.outer(tt,a)
    low=(Plow[:,2]<1.33)&(Plow[:,2]>1.10)&(Plow[:,0]*side>0)
    medial=(Plow[:,0]-ax[:,0])*side<-0.02
    to_torso=low&(partlow==pid)&medial&(Nlow[:,0]*side>0.35)
    to_arm=low&(partlow==0)&((Plow[:,0]-ax[:,0])*side>-0.035)&(Nlow[:,0]*side<0)
    partlow[to_torso]=0; partlow[to_arm]=pid
    print('relabelled',side,to_torso.sum(),to_arm.sum())
m=o.modifiers.new('sub','SUBSURF'); m.levels=LEVEL; m.render_levels=LEVEL; m.quality=3
bpy.context.view_layer.objects.active=o; o.select_set(True)
bpy.ops.object.modifier_apply(modifier='sub')
me=o.data; P=positions(me); N=normals(me)
F=[tuple(p.vertices) for p in me.polygons]
part=partlow[cKDTree(Plow).query(P)[1]]
print('high verts',len(P))
J={'arm':[(0.187,0.045,1.40),(0.264,0.052,1.13),(0.312,-0.02,0.935),(0.314,-0.065,0.80)],
   'leg':[(0.093,0.01,0.90),(0.106,0.0,0.49),(0.118,0.035,0.09)]}
body=Body(P,N,F,part,J); body.build_bvh(Plow,Flow,partlow)
E=edges(me)
oh=np.zeros((len(P),6)); oh[np.arange(len(P)),part]=1
body.soft_part=laplacian_smooth_field(oh,E,len(P),12,0.5)
S=Sculptor(body)
t0=time.time()
import json
HAND=json.load(open(src.replace('s3b.blend','s3_hand.json'))) if os.path.exists(src.replace('s3b.blend','s3_hand.json')) else None
exec(open(os.path.join(os.path.dirname(os.path.abspath(__file__)),'anatomy.py')).read())
for side in (1,-1):
    body.side=side
    build_anatomy(body,S)
print('sculpt time',round(time.time()-t0,1))
# volumes must not grow into the opposite surface where limbs lie close to the body (armpit,
# inner thighs): limit the outward offset to a share of the free gap along the normal
Hraw=S.H.copy()
for A_,B_ in (([1,2],[0,5,3,4]),([0,5,3,4],[1,2]),([3],[4]),([4],[3])):
    ia=np.where(np.isin(part,A_))[0]; ib=np.where(np.isin(part,B_))[0]
    tr=cKDTree(P[ib]); d,j=tr.query(P[ia],distance_upper_bound=0.05)
    ok=np.isfinite(d)
    facing=np.zeros(len(ia),bool); facing[ok]=((P[ib[j[ok]]]-P[ia[ok]])*N[ia[ok]]).sum(1)>0
    lim=np.full(len(ia),1.0); lim[ok&facing]=np.maximum(0.3*d[ok&facing]-0.001,0)
    Hraw[ia]=np.minimum(Hraw[ia],lim)
H=laplacian_smooth_field(Hraw,E,len(P),6,0.5)
Fb=laplacian_smooth_field(S.Fib,E,len(P),1,0.3)
print('H range',H.min(),H.max(),'fib',Fb.min(),Fb.max())
P2=P+N*(H+Fb)[:,None]
set_positions(me,P2)
for k,v in S.labels.items():
    a=me.attributes.new('m_'+k,'FLOAT','POINT'); a.data.foreach_set('value',v.astype(np.float32))
pa=me.attributes.get('part') or me.attributes.new('part','INT','POINT'); pa.data.foreach_set('value',part.astype(np.int32))
bc=me.attributes.new('base_co','FLOAT_VECTOR','POINT'); bc.data.foreach_set('vector',P.astype(np.float32).ravel())
bn=me.attributes.new('base_no','FLOAT_VECTOR','POINT'); bn.data.foreach_set('vector',N.astype(np.float32).ravel())
hh=me.attributes.new('sculpt_form','FLOAT','POINT'); hh.data.foreach_set('value',H.astype(np.float32))
hv=me.attributes.new('sculpt_h','FLOAT','POINT'); hv.data.foreach_set('value',(H+Fb).astype(np.float32))
bpy.ops.wm.save_as_mainfile(filepath=out)
