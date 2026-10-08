"""Anatomical sculpt engine: muscles as fibre sheets on the body surface.

A muscle is a sheet spanned between an origin line O(u) and an insertion line I(u) (optionally
through a middle line M(u)), u = across the fibres, s = along them. The sheet is sampled and
snapped to the surface; every surface vertex near it gets (u, s, distance). From that:
  volume  h = T * across(u) * along(s) * falloff(distance)    (real geometry, along the normal)
  fibres  f = A * ridges(u) * noise                            (fine relief, fades at tendons)
Grooves are surface curves pressed in with a soft profile; bumps are local positive offsets.
All landmarks are given for the figure's left side and mirrored for the right."""
import numpy as np, math
from mathutils import Vector
from mathutils.bvhtree import BVHTree
from scipy.spatial import cKDTree

import os
# overall depth of grooves (definition / body-fat look): 1.0 = very dry, 0.75 = athletic
GROOVE_SCALE=float(os.environ.get('KX_GROOVES','0.75'))

class Body:
    def __init__(self, P, N, F, part, joints):
        self.P=P; self.N=N; self.part=part; self.J=joints
        self.faces=F  # list of faces (vertex index tuples) of the evaluation mesh
        self.bvh={}
        self.side=1
        fpart=None
    def build_bvh(self, Plow, Flow, partlow):
        """per-part BVHs (low mesh) for landmark rays; and full high BVH for snapping"""
        fl=np.array([np.bincount(partlow[list(f)]).argmax() for f in Flow])
        groups={'torso':[0,5],'head':[5],'armL':[1],'armR':[2],'legL':[3],'legR':[4],'all':[0,1,2,3,4,5],'trunk':[0,3,4,5]}
        verts=[Vector(p) for p in Plow]
        for k,g in groups.items():
            fs=[Flow[i] for i in range(len(Flow)) if fl[i] in g]
            self.bvh[k]=BVHTree.FromPolygons(verts,fs)
        self.full=BVHTree.FromPolygons([Vector(p) for p in self.P],self.faces)
    # ---- landmark helpers (left side coordinates; mirrored by self.side)
    def _ray(self,part,o,d):
        hit=self.bvh[part].ray_cast(Vector(o),Vector(d),3.0)
        if hit[0] is None:
            fb='trunk' if part in ('torso','legL','legR','head') else 'all'
            hit=self.bvh[fb].ray_cast(Vector(o),Vector(d),3.0)
            if hit[0] is None: hit=self.bvh['all'].ray_cast(Vector(o),Vector(d),3.0)
        if hit[0] is None: raise ValueError(f'no hit {part} {o} {d}')
        return np.array(hit[0])
    def _pp(self,part):
        if part in ('arm','leg'): return part+('L' if self.side>0 else 'R')
        return part
    def F(self,x,z,part='torso'): s=self.side; return self._ray(self._pp(part),(s*x,-1.5,z),(0,1,0))
    def B(self,x,z,part='torso'): s=self.side; return self._ray(self._pp(part),(s*x,1.5,z),(0,-1,0))
    def L(self,y,z,part='torso'):
        s=self.side
        for k in range(12):
            try: return self._ray(self._pp(part),(s*1.5,y*(0.93**k),z),(-s,0,0))
            except ValueError: pass
        raise ValueError(f'L miss {y} {z}')
    def M(self,y,z,part='leg'):  # medial: from the midline outwards
        s=self.side; return self._ray(self._pp(part),(0.0,y,z),(s,0,0))
    def T(self,x,y,part='torso'): s=self.side; return self._ray(self._pp(part),(s*x,y,2.5),(0,0,-1))
    def _limb(self,chain,t,theta,part):
        s=self.side; pts=[np.array(p)*np.array([s,1,1]) for p in self.J[chain]]
        k=min(int(math.floor(t)),len(pts)-2); k=max(k,0); f=t-k
        c=pts[k]+f*(pts[k+1]-pts[k])
        dirs=[(pts[i+1]-pts[i])/np.linalg.norm(pts[i+1]-pts[i]) for i in range(len(pts)-1)]
        # direction blends smoothly across joints (no seam where a sheet crosses the elbow/knee)
        a=dirs[k].copy(); bw=0.2
        if f<bw and k>0: w=0.5*(1-f/bw); a=(1-w)*dirs[k]+w*dirs[k-1]
        if f>1-bw and k<len(dirs)-1: w=0.5*(1-(1-f)/bw); a=(1-w)*dirs[k]+w*dirs[k+1]
        a=a/np.linalg.norm(a)
        fr=np.array([0,-1.0,0]); fr=fr-(fr@a)*a; fr/=np.linalg.norm(fr)
        lat=np.cross(a,fr)
        if lat[0]*s<0: lat=-lat
        th=math.radians(theta); dvec=math.cos(th)*fr+math.sin(th)*lat
        return self._ray(self._pp(part),c+0.25*dvec,-dvec)
    def A(self,t,theta): return self._limb('arm',t,theta,'arm')
    def G(self,t,theta): return self._limb('leg',t,theta,'leg')

def polyline_interp(pts,u):
    pts=np.asarray(pts); seg=np.linalg.norm(np.diff(pts,axis=0),axis=1); L=np.concatenate([[0],np.cumsum(seg)])
    L/=L[-1] if L[-1]>0 else 1
    out=np.empty((len(u),3))
    for i in range(3): out[:,i]=np.interp(u,L,pts[:,i])
    return out

def value_noise3(P,scale,seed):
    rng=np.random.default_rng(seed); acc=np.zeros(len(P))
    for k in range(6):
        d=rng.normal(size=3); d/=np.linalg.norm(d)
        acc+=np.sin(P@d/scale*2*math.pi+rng.uniform(0,2*math.pi))
    return acc/math.sqrt(3)

class Sculptor:
    def __init__(self,body):
        self.b=body; n=len(body.P)
        self.H=np.zeros(n)       # volume displacement
        self.Fib=np.zeros(n)     # fibre relief
        self.labels={}           # muscle name -> coverage (for segmentation)
    def _resolve(self,spec):
        if isinstance(spec,tuple) and len(spec)==3 and isinstance(spec[0],str):
            return self.b.A(spec[1],spec[2]) if spec[0]=='A' else self.b.G(spec[1],spec[2])
        return np.asarray(spec)
    def _grid(self,O,I,M,nu,ns):
        u=np.linspace(0,1,nu); s=np.linspace(0,1,ns)
        limb=all(isinstance(p,tuple) and isinstance(p[0],str) for p in list(O)+list(I)+(list(M) if M else []))
        if limb:
            kind=O[0][0]
            def pi(pts,u):
                a=np.array([[p[1],p[2]] for p in pts],float)
                if len(a)==1: return np.repeat(a,len(u),0)
                L=np.linspace(0,1,len(a)); return np.stack([np.interp(u,L,a[:,0]),np.interp(u,L,a[:,1])],1)
            Ou=pi(O,u); Iu=pi(I,u); Mu=pi(M,u) if M else 0.5*(Ou+Iu)
            S=((1-s)[None,:,None]**2*Ou[:,None,:]+2*((1-s)*s)[None,:,None]*Mu[:,None,:]+(s**2)[None,:,None]*Iu[:,None,:]).reshape(-1,2)
            f=self.b.A if kind=='A' else self.b.G
            return np.array([f(t,th) for t,th in S]),u,s
        O=[self._resolve(p) for p in O]; I=[self._resolve(p) for p in I]; M=[self._resolve(p) for p in M] if M else None
        Ou=polyline_interp(O,u); Iu=polyline_interp(I,u)
        Mu=polyline_interp(M,u) if M is not None else 0.5*(Ou+Iu)
        S=((1-s)[None,:,None]**2*Ou[:,None,:]+2*((1-s)*s)[None,:,None]*Mu[:,None,:]+(s**2)[None,:,None]*Iu[:,None,:]).reshape(-1,3)
        return S,u,s
    def sheet(self,name,O,I,M=None,T=0.006,pu=0.7,ps=(1.2,1.2),floor=(0.0,0.0),soft=0.006,
              fib=0.0003,spacing=0.006,parts=('all',),nu=48,ns=64,label=None,ndot=0.25,reach=0.05):
        b=self.b
        import os
        if name in os.environ.get('KX_SKIP','').split(','): return
        S,u,s=self._grid(O,I,M,nu,ns)
        # snap to the surface
        Sn=np.empty_like(S); Nn=np.empty_like(S)
        for i,p in enumerate(S):
            loc,nor,idx,dist=b.full.find_nearest(Vector(p))
            Sn[i]=loc; Nn[i]=nor
        UU=np.repeat(u,ns); SS=np.tile(s,nu)
        tree=cKDTree(Sn)
        lo=Sn.min(0)-reach; hi=Sn.max(0)+reach
        cand=np.where(np.all((b.P>lo)&(b.P<hi),axis=1))[0]
        if len(cand)==0: return
        d,ix=tree.query(b.P[cand],k=6)
        w=1.0/(d+1e-4)**2; w/=w.sum(1,keepdims=True)
        uu=(UU[ix]*w).sum(1); ss=(SS[ix]*w).sum(1)
        nd=(b.N[cand]*Nn[ix[:,0]]).sum(1)
        dist=d[:,0]
        # sample spacing -> inside-sheet distance tolerance
        step=np.median(np.linalg.norm(np.diff(Sn.reshape(nu,ns,3),axis=1),axis=2))
        step=max(step,np.median(np.linalg.norm(np.diff(Sn.reshape(nu,ns,3),axis=0),axis=2)))
        out=np.clip(dist-0.7*step,0,None)
        fall=np.exp(-(out/soft)**2)*np.clip((nd-ndot)/0.5,0,1)**2
        if parts!=('all',):
            ids=[{'torso':0,'armL':1,'armR':2,'legL':3,'legR':4,'head':5}[p] if p not in('arm','leg') else {'arm':1,'leg':3}[p]+(0 if b.side>0 else 1) for p in parts]
            if 0 in ids: ids.append(5)
            ok=b.soft_part[cand][:,ids].sum(1)
            fall*=np.clip(ok,0,1)
        f0,f1=floor
        base=np.sin(np.pi*np.clip(uu,0,1))**pu
        edge=np.where(uu<0.5,f0,f1)
        across=edge+(1-edge)*base
        p,q=ps; along=(np.clip(ss,1e-4,1)**p)*(np.clip(1-ss,1e-4,1)**q)
        smax=p/(p+q); along/=(smax**p)*((1-smax)**q)
        sm=lambda x: (lambda y: y*y*(3-2*y))(np.clip(x,0,1))
        along*=sm(ss/0.18)*sm((1-ss)/0.18)   # C1 ends: no crest where a sheet starts
        h=T*across*along*fall
        self.H[cand]+=h
        if fib>0:
            # ridges across u (count from the sheet's width at its belly), irregular phase and amplitude
            width=np.mean(np.linalg.norm(np.diff(Sn.reshape(nu,ns,3)[:,ns//2],axis=0),axis=1))*(nu-1)
            nf=max(width/spacing,3)
            import zlib; seed=zlib.crc32(name.encode())
            ph=value_noise3(b.P[cand],0.05,seed%1000)*0.12
            amp=0.55+0.45*value_noise3(b.P[cand],0.035,seed%997+1)
            r=np.cos(2*np.pi*(uu*nf+ph))+0.35*np.cos(4*np.pi*(uu*nf*1.03+ph*1.7))
            self.Fib[cand]+=fib*r*np.clip(amp,0,1)*np.sqrt(np.clip(across,0,1))*np.clip(along,0,1)**0.8*fall
        if label:
            cov=across*np.clip(along*3,0,1)*fall
            arr=self.labels.setdefault(label,np.zeros(len(b.P)))
            arr[cand]=np.maximum(arr[cand],cov)
    def groove(self,pts,depth=0.002,width=0.004,profile=None,n=200,parts=('all',)):
        b=self.b
        depth*=GROOVE_SCALE if depth>0 else 1.0
        if all(isinstance(p,tuple) and isinstance(p[0],str) for p in pts):
            a=np.array([[p[1],p[2]] for p in pts],float); L=np.linspace(0,1,len(a)); uu=np.linspace(0,1,n)
            f=b.A if pts[0][0]=='A' else b.G
            C=np.array([f(np.interp(x,L,a[:,0]),np.interp(x,L,a[:,1])) for x in uu])
        else:
            C=polyline_interp([self._resolve(p) for p in pts],np.linspace(0,1,n))
        Cn=np.array([b.full.find_nearest(Vector(p))[0] for p in C])
        if profile is None: profile=np.ones(n)
        else: profile=np.interp(np.linspace(0,1,n),np.linspace(0,1,len(profile)),profile)
        tree=cKDTree(Cn); lo=Cn.min(0)-4*width; hi=Cn.max(0)+4*width
        cand=np.where(np.all((b.P>lo)&(b.P<hi),axis=1))[0]
        d,ix=tree.query(b.P[cand])
        self.H[cand]-=depth*profile[ix]*np.exp(-(d/width)**2)
    def bump(self,c,radius,height,aniso=None):
        b=self.b; c=np.array(b.full.find_nearest(Vector(self._resolve(c)))[0])
        d=b.P-c
        if aniso is not None:
            ax=np.array(aniso[0],dtype=float)*np.array([b.side,1,1]); ax/=np.linalg.norm(ax); k=aniso[1]
            along=d@ax; d=d-np.outer(along,ax)+np.outer(along/k,ax)
        r=np.linalg.norm(d,axis=1)
        m=r<3*radius
        self.H[m]+=height*np.exp(-(r[m]/radius)**2)
