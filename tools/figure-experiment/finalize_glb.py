"""Post-process the Blender export into a Kalethra-contract GLB.

- joints get identity rest rotations (translation only), like the production rig; inverse bind
  matrices are recomputed, so the bind pose is unchanged
- Blender's actions are replaced by a 'rest' clip
- the production clips (and their equipment props) are grafted from the current Kalethra male GLB
  by node name: rotations as-is (both rigs rest at identity), pelvis translation rebased
- asset.extras.kalethra metadata (variant, units, orientation, experimental flag, attribution)
Usage: python3 finalize_glb.py raw.glb production.glb out.glb"""
import json, struct, sys, numpy as np
CT={5120:np.int8,5121:np.uint8,5122:np.int16,5123:np.uint16,5125:np.uint32,5126:np.float32}
NC={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4,'MAT4':16}
def load(p):
    b=open(p,'rb').read(); jl=struct.unpack('<I',b[12:16])[0]
    j=json.loads(b[20:20+jl]); bs=20+jl; bl=struct.unpack('<I',b[bs:bs+4])[0]
    return j,bytearray(b[bs+8:bs+8+bl])
def acc_read(j,bin_,i):
    a=j['accessors'][i]; bv=j['bufferViews'][a['bufferView']]
    dt=CT[a['componentType']]; n=NC[a['type']]; off=bv.get('byteOffset',0)+a.get('byteOffset',0)
    stride=bv.get('byteStride',0); size=np.dtype(dt).itemsize*n
    if stride and stride!=size:
        rows=[np.frombuffer(bin_,dt,n,off+k*stride) for k in range(a['count'])]; return np.array(rows)
    return np.frombuffer(bytes(bin_[off:off+size*a['count']]),dt).reshape(a['count'],n).copy()
def acc_add(j,bin_,arr,typ,ct=5126,minmax=False):
    arr=np.ascontiguousarray(arr.astype(CT[ct]))
    while len(bin_)%4: bin_.append(0)
    off=len(bin_); bin_.extend(arr.tobytes())
    j['bufferViews'].append({'buffer':0,'byteOffset':off,'byteLength':arr.nbytes})
    a={'bufferView':len(j['bufferViews'])-1,'componentType':ct,'count':int(arr.shape[0]),'type':typ}
    if minmax: a['min']=arr.min(0).tolist(); a['max']=arr.max(0).tolist()
    j['accessors'].append(a); return len(j['accessors'])-1
def quat_mat(q):
    x,y,z,w=q; return np.array([[1-2*(y*y+z*z),2*(x*y-z*w),2*(x*z+y*w)],[2*(x*y+z*w),1-2*(x*x+z*z),2*(y*z-x*w)],[2*(x*z-y*w),2*(y*z+x*w),1-2*(x*x+y*y)]])
def trs(n):
    if 'matrix' in n: return np.array(n['matrix']).reshape(4,4).T
    M=np.eye(4); M[:3,:3]=quat_mat(n.get('rotation',[0,0,0,1]))@np.diag(n.get('scale',[1,1,1])); M[:3,3]=n.get('translation',[0,0,0]); return M
raw,out_=sys.argv[1],sys.argv[3]; prod=sys.argv[2]
j,bin_=load(raw); pj,pbin=load(prod)
nodes=j['nodes']; names=[n.get('name','') for n in nodes]
parent={c:i for i,n in enumerate(nodes) for c in n.get('children',[])}
def world(i):
    M=trs(nodes[i]); p=parent.get(i)
    while p is not None: M=trs(nodes[p])@M; p=parent.get(p)
    return M
skin=j['skins'][0]; joints=skin['joints']
# the armature object node must be identity (Blender exports it at the origin)
for i in set(parent.get(k) for k in joints)-set(joints):
    if i is not None: assert np.allclose(world(i),np.eye(4),atol=1e-5), 'armature not at the origin'
pos={i:world(i)[:3,3].copy() for i in joints}
for i in joints:
    p=parent.get(i); pp=pos[p] if p in pos else np.zeros(3)
    n=nodes[i]
    for k in ('rotation','scale','matrix'): n.pop(k,None)
    n['translation']=[float(v) for v in (pos[i]-pp)]
ibm=np.zeros((len(joints),16),np.float32)
for k,i in enumerate(joints):
    M=np.eye(4); M[:3,3]=-pos[i]; ibm[k]=M.T.ravel()
a=j['accessors'][skin['inverseBindMatrices']]; bv=j['bufferViews'][a['bufferView']]
off=bv.get('byteOffset',0)+a.get('byteOffset',0); bin_[off:off+ibm.nbytes]=ibm.tobytes()
# quantise like the production asset: weights 8 bit (sum exactly 255), indices 16 bit
for m in j['meshes']:
    for pr in m['primitives']:
        w=pr['attributes'].get('WEIGHTS_0')
        if w is not None and j['accessors'][w]['componentType']==5126:
            W=acc_read(j,bin_,w).astype(np.float64); W/=np.maximum(W.sum(1,keepdims=True),1e-9)
            Q=np.floor(W*255).astype(np.int32); r=255-Q.sum(1); Q[np.arange(len(Q)),W.argmax(1)]+=r
            k=acc_add(j,bin_,Q.astype(np.uint8),'VEC4',5121); j['accessors'][k]['normalized']=True; pr['attributes']['WEIGHTS_0']=k
        ii=acc_read(j,bin_,pr['indices'])
        if ii.max()<65536 and j['accessors'][pr['indices']]['componentType']!=5123:
            pr['indices']=acc_add(j,bin_,ii.astype(np.uint16),'SCALAR',5123)
# animations: rest + grafted production clips
j['animations']=[]
rest_t={names[i]:np.array(nodes[i]['translation']) for i in joints}
times=acc_add(j,bin_,np.array([[0.0]]),'SCALAR',minmax=True)
ch=[];sm=[]
for i in joints:
    sm.append({'input':times,'output':acc_add(j,bin_,np.array([nodes[i]['translation']]),'VEC3'),'interpolation':'LINEAR'}); ch.append({'sampler':len(sm)-1,'target':{'node':i,'path':'translation'}})
    sm.append({'input':times,'output':acc_add(j,bin_,np.array([[0,0,0,1.0]]),'VEC4'),'interpolation':'LINEAR'}); ch.append({'sampler':len(sm)-1,'target':{'node':i,'path':'rotation'}})
j['animations'].append({'name':'rest','channels':ch,'samplers':sm})
pnames=[n.get('name','') for n in pj['nodes']]
p_rest_t={pnames[i]:np.array(pj['nodes'][i].get('translation',[0,0,0])) for i in pj['skins'][0]['joints']}
# props: copy meshes (+ materials) as children of the scene root next to the rig
root_scene=j['scenes'][j.get('scene',0)]['nodes']
mat_map={}
def copy_material(mi):
    if mi in mat_map: return mat_map[mi]
    m=json.loads(json.dumps(pj['materials'][mi])); m.pop('normalTexture',None)
    j['materials'].append(m); mat_map[mi]=len(j['materials'])-1; return mat_map[mi]
for pi,pn in enumerate(pnames):
    if not pn.startswith('prop_'): continue
    src=pj['nodes'][pi]; mesh=pj['meshes'][src['mesh']]; prims=[]
    for pr in mesh['primitives']:
        attrs={}
        for k,ai in pr['attributes'].items():
            if k not in ('POSITION','NORMAL'): continue
            arr=acc_read(pj,pbin,ai); attrs[k]=acc_add(j,bin_,arr,pj['accessors'][ai]['type'],pj['accessors'][ai]['componentType'],minmax=(k=='POSITION'))
        ind=acc_read(pj,pbin,pr['indices']).astype(np.uint32)
        prims.append({'attributes':attrs,'indices':acc_add(j,bin_,ind,'SCALAR',5125),'material':copy_material(pr['material'])})
    j['meshes'].append({'name':pn,'primitives':prims})
    nn={k:v for k,v in src.items() if k in ('name','translation','rotation','scale')}; nn['mesh']=len(j['meshes'])-1
    j['nodes'].append(nn); root_scene.append(len(j['nodes'])-1)
names=[n.get('name','') for n in j['nodes']]
for an in pj['animations']:
    if an['name']=='rest': continue
    ch=[];sm=[]
    for c in an['channels']:
        tn=pnames[c['target']['node']]
        if tn not in names: continue
        s=an['samplers'][c['sampler']]; inp=acc_read(pj,pbin,s['input']); outp=acc_read(pj,pbin,s['output']).astype(np.float64)
        if c['target']['path']=='translation' and tn in rest_t:
            # the joint sits elsewhere in the new body: shift by that difference, turned with
            # the joint's own rotation, so the body (not the joint) lands where the clip put it
            d=rest_t[tn]-p_rest_t[tn]
            rc=[cc for cc in an['channels'] if cc['target']['node']==c['target']['node'] and cc['target']['path']=='rotation']
            if rc:
                rs=an['samplers'][rc[0]['sampler']]; rt=acc_read(pj,pbin,rs['input'])[:,0]; rq=acc_read(pj,pbin,rs['output']).astype(np.float64)
                tt=inp[:,0]
                def qat(t):
                    k=int(np.clip(np.searchsorted(rt,t)-1,0,len(rt)-2)) if len(rt)>1 else 0
                    if len(rt)==1: return rq[0]
                    f=float(np.clip((t-rt[k])/(rt[k+1]-rt[k]),0,1)); a,b=rq[k],rq[k+1]
                    if a@b<0: b=-b
                    q=(1-f)*a+f*b; return q/np.linalg.norm(q)
                parent_d=d   # pelvis translation lives in the root's space; its offset turns with the pelvis
                outp=np.array([o+quat_mat(qat(t))@parent_d for o,t in zip(outp,tt)])
            else:
                outp=outp+d
        sm.append({'input':acc_add(j,bin_,inp,'SCALAR',minmax=True),'output':acc_add(j,bin_,outp,pj['accessors'][s['output']]['type']),'interpolation':s.get('interpolation','LINEAR')})
        ch.append({'sampler':len(sm)-1,'target':{'node':names.index(tn),'path':c['target']['path']}})
    j['animations'].append({'name':an['name'],'channels':ch,'samplers':sm})
# drop the now unused Blender animation data is implicit (orphan accessors are harmless but cost bytes) -> compact
used_acc=set()
def mark(x):
    if isinstance(x,dict):
        for k,v in x.items():
            if k in ('input','output','indices','inverseBindMatrices') and isinstance(v,int): used_acc.add(v)
            elif k=='attributes': used_acc.update(v.values())
            else: mark(v)
    elif isinstance(x,list):
        for v in x: mark(v)
mark(j['meshes']); mark(j['skins']); mark(j['animations'])
used_bv=set(j['accessors'][i]['bufferView'] for i in used_acc)|set(im['bufferView'] for im in j.get('images',[]))
newbin=bytearray(); bvmap={}; newbvs=[]
for i,bv in enumerate(j['bufferViews']):
    if i not in used_bv: continue
    while len(newbin)%4: newbin.append(0)
    o=bv.get('byteOffset',0); data=bin_[o:o+bv['byteLength']]
    nb=dict(bv); nb['byteOffset']=len(newbin); newbin.extend(data); bvmap[i]=len(newbvs); newbvs.append(nb)
accmap={}; newacc=[]
for i,a in enumerate(j['accessors']):
    if i not in used_acc: continue
    na=dict(a); na['bufferView']=bvmap[a['bufferView']]; accmap[i]=len(newacc); newacc.append(na)
def remap(x):
    if isinstance(x,dict):
        for k,v in list(x.items()):
            if k in ('input','output','indices','inverseBindMatrices') and isinstance(v,int): x[k]=accmap[v]
            elif k=='attributes': x[k]={kk:accmap[vv] for kk,vv in v.items()}
            else: remap(v)
    elif isinstance(x,list):
        for v in x: remap(v)
remap(j['meshes']); remap(j['skins']); remap(j['animations'])
for im in j.get('images',[]): im['bufferView']=bvmap[im['bufferView']]
j['bufferViews']=newbvs; j['accessors']=newacc; j['buffers']=[{'byteLength':len(newbin)}]; bin_=newbin
j['asset']['generator']='Kalethra figure experiment (tools/figure-experiment, Blender)'
j['asset']['extras']={'kalethra':{'contract':1,'variant':'male','units':'metre','up':'+Y','front':'+Z','origin':'floor, under the pelvis',
    'experimental':True,'candidate':'sketchfab-base',
    'source':'"Proxy Human base Mesh" by sphere_joe (https://sketchfab.com/mundane_x), CC BY 4.0, https://sketchfab.com/3d-models/proxy-human-base-mesh-9fea713a3eec47d7a7f9a3364d08f22e - modified (re-posed, re-sculpted, re-topologised by decimation, rigged)',
    'license':'CC-BY-4.0','clips':'grafted from public/figure/male/kalethra-male.glb (Kalethra, own work on MakeHuman CC0 assets)'}}
js=json.dumps(j,separators=(',',':')).encode()
while len(js)%4: js+=b' '
while len(bin_)%4: bin_.append(0)
total=12+8+len(js)+8+len(bin_)
with open(out_,'wb') as f:
    f.write(struct.pack('<III',0x46546C67,2,total)); f.write(struct.pack('<II',len(js),0x4E4F534A)); f.write(js)
    f.write(struct.pack('<II',len(bin_),0x004E4942)); f.write(bin_)
print('written',out_,total,'bytes; nodes',len(j['nodes']),'clips',[a['name'] for a in j['animations']])
