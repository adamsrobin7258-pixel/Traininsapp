"""Stage 3b: proportions towards the classical-athletic target - slightly broader shoulder girdle
(arms move out with it), a slightly narrower waist. Smooth global warp on the cage mesh."""
import bpy, sys, os, numpy as np
sys.path.insert(0,os.path.dirname(os.path.abspath(__file__)))
from kx_common import *
src,out=sys.argv[-2],sys.argv[-1]
SHOULDER=0.012; WAIST=0.006
bpy.ops.wm.open_mainfile(filepath=src)
me=bpy.data.objects['kalethra_body'].data
P=positions(me); part=np.array([a.value for a in me.attributes['part'].data])
ax=np.abs(P[:,0]); s=np.sign(P[:,0])
w=smoothstep((ax-0.05)/0.14)*smoothstep((P[:,2]-1.20)/0.14)*(1-smoothstep((P[:,2]-1.50)/0.04))
w[(part==1)|(part==2)]=1.0
w[part==5]=0.0
D=np.zeros_like(P); D[:,0]=SHOULDER*w*s
ww=smoothstep((ax-0.07)/0.07)*np.exp(-((P[:,2]-1.075)/0.065)**2)
ww[(part!=0)]=0
D[:,0]-=WAIST*ww*s
E=edges(me); D=laplacian_smooth_field(D,E,len(P),8,0.5)
set_positions(me,P+D)
print('max shoulder shift',D[:,0].max(),'waist',D[:,0].min())
bpy.ops.wm.save_as_mainfile(filepath=out)
