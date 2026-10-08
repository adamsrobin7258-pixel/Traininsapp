import numpy as np, bmesh, math
from scipy.spatial import cKDTree
def positions(me):
    a=np.empty(len(me.vertices)*3); me.vertices.foreach_get('co',a); return a.reshape(-1,3)
def set_positions(me,P):
    me.vertices.foreach_set('co',np.ascontiguousarray(P,dtype=np.float32).ravel()); me.update()
def normals(me):
    a=np.empty(len(me.vertices)*3); me.vertices.foreach_get('normal',a); return a.reshape(-1,3)
def mirror_map(P,tol=2e-3):
    """index of the mirror partner (x -> -x) for every vertex"""
    tr=cKDTree(P); d,i=tr.query(P*np.array([-1,1,1]))
    return i,d
def symmetrize(P,mm,keep_side=1):
    """copy the keep_side half (x*keep_side>0) mirrored to the other half; centre line x=0"""
    Q=P.copy(); other=P[:,0]*keep_side<0
    Q[other]=P[mm[other]]*np.array([-1,1,1])
    centre=np.abs(P[:,0])<1e-6
    return Q
def adjacency(me):
    bm=bmesh.new(); bm.from_mesh(me); bm.verts.ensure_lookup_table()
    adj=[[e.other_vert(v).index for e in v.link_edges] for v in bm.verts]; bm.free(); return adj
def edges(me):
    a=np.empty(len(me.edges)*2,dtype=np.int64); me.edges.foreach_get('vertices',a); return a.reshape(-1,2)
def laplacian_smooth_field(F,E,n,iters,lam=0.5,mask=None):
    """smooth a per-vertex field (N,) or (N,k) over the mesh graph"""
    F=F.copy(); deg=np.bincount(E.ravel(),minlength=n).astype(float); deg[deg==0]=1
    for _ in range(iters):
        S=np.zeros_like(F)
        np.add.at(S,E[:,0],F[E[:,1]]); np.add.at(S,E[:,1],F[E[:,0]])
        avg=(S.T/deg).T
        upd=F+lam*(avg-F)
        if mask is not None: F=np.where(mask if F.ndim==1 else mask[:,None],upd,F)
        else: F=upd
    return F
def rot(axis,ang):
    a=axis/np.linalg.norm(axis); K=np.array([[0,-a[2],a[1]],[a[2],0,-a[0]],[-a[1],a[0],0]])
    return np.eye(3)+math.sin(ang)*K+(1-math.cos(ang))*K@K
def rotate_weighted(Q,pivot,axis,ang,w):
    """rotate rows of Q about pivot/axis by ang*w (per row)"""
    a=axis/np.linalg.norm(axis); v=Q-pivot
    th=(ang*w)[:,None]; c=np.cos(th); s=np.sin(th)
    cr=np.cross(a,v); dt=(v@a)[:,None]
    return pivot+v*c+cr*s+a*dt*(1-c)
def smoothstep(x): x=np.clip(x,0,1); return x*x*(3-2*x)

def mirror_displacement(D,P,mm,keep_side=1):
    """copy a displacement field from the keep_side half to the other half (x mirrored)"""
    Q=D.copy(); other=P[:,0]*keep_side<0
    Q[other]=D[mm[other]]*np.array([-1,1,1])
    return Q
