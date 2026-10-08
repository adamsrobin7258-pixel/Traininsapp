"""Stage 3: relaxed hands. The base mesh has straight, flat 'paddle' fingers and a splayed thumb.
Fingers are found by connectivity beyond the finger webs and bent at MCP/PIP/DIP (relaxed curl,
increasing from index to little finger); the thumb is brought in towards the index finger.
Computed for the left hand, mirrored to the right (the base mesh is symmetric)."""
import bpy, sys, numpy as np, math
sys.path.insert(0,__import__('os').path.dirname(__file__))
from kx_common import *
src,out=sys.argv[-2],sys.argv[-1]
bpy.ops.wm.open_mainfile(filepath=src)
o=bpy.data.objects['kalethra_body']; me=o.data
P=positions(me); adj=adjacency(me); mm,md=mirror_map(P)
print('mirror max dist',md.max())
def comps(idx):
    S=set(idx.tolist()); seen=set(); out=[]
    for i in idx:
        if i in seen: continue
        st=[i]; seen.add(i); c=[]
        while st:
            x=st.pop(); c.append(x)
            for y in adj[x]:
                if y in S and y not in seen: seen.add(y); st.append(y)
        out.append(np.array(c))
    return sorted(out,key=len,reverse=True)
W=np.array([0.304,-0.02,0.935])
H=np.where((P[:,0]>0.2)&(P[:,2]<0.97))[0]
c=P[H].mean(0); _,_,Vt=np.linalg.svd(P[H]-c); d=Vt[0]*(1 if Vt[0][2]<0 else -1)
t=(P-W)@d
for th in np.arange(0.15,0.19,0.0025):
    fingers=[f for f in comps(H[t[H]>th]) if len(f)>30]
    if len(fingers)>=4: break
print('finger split at',th)
fingers=sorted(fingers[:4],key=lambda f:P[f,1].mean())
thumb=min([f for f in comps(H[t[H]>0.11]) if len(f)>40],key=lambda f:P[f,1].mean())
spread=P[fingers[-1]].mean(0)-P[fingers[0]].mean(0); spread-=(spread@d)*d; spread/=np.linalg.norm(spread)
pn=np.cross(d,spread); pn/=np.linalg.norm(pn)
if pn[0]>0: pn=-pn
lat=P@spread; centres=[np.median(lat[f]) for f in fingers]
thumbset=set(thumb.tolist())
NP=P.copy()
# ---- thumb: rotate about the CMC joint towards the index finger (smooth weight field, no tearing)
E=edges(me); n=len(P)
tip=thumb[np.argmax(np.linalg.norm(P[thumb]-W,axis=1))]
cmc=W+0.035*d+0.012*(-spread)+0.01*pn
td=P[tip]-cmc; td/=np.linalg.norm(td)
ax=np.cross(td,d); ang=math.acos(np.clip(td@d,-1,1))
w=np.zeros(n); w[thumb]=1.0
hm=np.zeros(n,bool); hm[H]=True
w=laplacian_smooth_field(w,E,n,25,0.5,hm)
w=smoothstep((w-0.05)/0.6)*smoothstep((np.linalg.norm(P-cmc,axis=1)-0.01)/0.03)
sel=np.where(w>1e-4)[0]
NP[sel]=rotate_weighted(NP[sel],cmc,ax,0.38*ang,w[sel])
print('thumb angle to fingers',math.degrees(ang))
# ---- fingers: soft membership per finger, displacement blended (webs stay intact)
flex=[(10,22,12),(14,27,14),(17,31,15),(21,35,17)]
axis=np.cross(d,pn)
region=H[(t[H]>0.095)]
memb=np.zeros((len(region),4))
for k in range(4): memb[:,k]=np.exp(-((lat[region]-centres[k])/0.0045)**2)
for k,f in enumerate(fingers):
    inf=np.isin(region,f); memb[inf]=0; memb[inf,k]=1
memb/=memb.sum(1,keepdims=True)+1e-12
tw=1-w[region]  # thumb-owned vertices keep the thumb motion
D=np.zeros((len(region),3))
for k,f in enumerate(fingers):
    ftip=t[f].max(); mcp=0.128; L=ftip-mcp
    joints=[mcp,mcp+0.47*L,mcp+0.76*L]
    q=NP[region].copy()
    for j in (2,1,0):
        tj=joints[j]; bb=0.014 if j==0 else 0.006
        ww=smoothstep((t[region]-(tj-bb))/(2*bb))
        near=f[np.argsort(np.abs(t[f]-tj))[:30]] if j>0 else f[np.argsort(t[f])[:30]]
        base=P[near].mean(0)+0.004*pn
        if j==0: base=base+(tj-(base-W)@d)*d
        q=rotate_weighted(q,base,axis,math.radians(flex[k][j]),ww)
    D+=memb[:,k:k+1]*(q-NP[region])
NP[region]+=D*tw[:,None]
tipi=fingers[1][np.argmax(t[fingers[1]])]
mv=(NP[tipi]-P[tipi])@pn
print('middle tip towards palm',round(mv,4))
assert mv>0, 'bend sign'
# smooth the hand transition a little (weight-region boundaries)
mask=np.zeros(len(P),bool); mask[H]=True
D=NP-P
D=laplacian_smooth_field(D,E,len(P),6,0.5,mask)
NP=P+D
print('mirror dist >0.5mm:',(md>5e-4).sum(),'of',len(md))
NP=P+mirror_displacement(NP-P,P,mm,1)
set_positions(me,NP)
import json
lm={'fingers':[],'palm_normal':pn.tolist(),'dir':d.tolist(),'wrist':W.tolist()}
for k,f in enumerate(fingers):
    ftip=t[f].max(); mcp=0.128; Lf=ftip-mcp
    pts=[]
    for tj in (mcp,mcp+0.47*Lf,mcp+0.76*Lf,ftip-0.006):
        near=f[np.argsort(np.abs(t[f]-tj))[:30]] if tj>mcp else H[np.argsort(np.abs(t[H]-tj)+np.abs(lat[H]-centres[k])*3)[:30]]
        c=NP[near].mean(0)
        pts.append(c.tolist())
    lm['fingers'].append(pts)
tt=thumb[np.argsort(-np.linalg.norm(P[thumb]-W,axis=1))[:20]]
lm['thumb_tip']=NP[tt].mean(0).tolist()
json.dump(lm,open(out.replace('.blend','_hand.json'),'w'),indent=1)
bpy.ops.wm.save_as_mainfile(filepath=out)
