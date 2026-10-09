"""Stage 6: the sculpt (stage 4) as source data for the production build (tools/figures).

Writes one gzip file with, per sculpt vertex (618k), in glTF axes (metres, +Y up, +Z front):
  - the large form (sculpt volumes, smoothed; no grooves or fibres)  -> int16, 0.1 mm
  - the normal of the large form                                       -> int8
  - the normal of the full sculpt (grooves, fibres)                    -> int8
  - body part (0 torso, 1/2 arm L/R, 3/4 leg L/R, 5 head)              -> uint8
  - modelled muscle region (index into header.labels, +1; 0 = none)   -> uint8
The production build fits the MakeHuman topology to the form and bakes the difference between
the two normals into the detail normal map.
Usage: stage6_export_sculpt.py s4.blend out.bin.gz"""
import bpy, sys, os, json, gzip, struct, numpy as np
sys.path.insert(0,os.path.dirname(os.path.abspath(__file__)))
from kx_common import *
src,out=sys.argv[-2],sys.argv[-1]
bpy.ops.wm.open_mainfile(filepath=src)
o=bpy.data.objects['kalethra_body']; me=o.data
n=len(me.vertices)
def vec(name):
    a=np.empty(n*3); me.attributes[name].data.foreach_get('vector',a); return a.reshape(-1,3)
def val(name,dt=float):
    a=np.empty(n,dtype=dt); me.attributes[name].data.foreach_get('value',a); return a
base=vec('base_co'); bno=vec('base_no'); form=val('sculpt_form')
E=edges(me)
form=laplacian_smooth_field(form,E,n,10,0.5)
full_n=normals(me)
P=base+bno*form[:,None]
set_positions(me,P); me.update()
form_n=normals(me)
part=val('part',np.int32).astype(np.uint8)
# muscle region per vertex (where a modelled muscle covers it clearly; 0 = none)
labels=sorted(a.name[2:] for a in me.attributes if a.name.startswith('m_'))
cov=np.stack([val('m_'+k) for k in labels],1)
label=np.where(cov.max(1)>0.3,cov.argmax(1)+1,0).astype(np.uint8)
gl=lambda a: np.stack([a[:,0],a[:,2],-a[:,1]],1)    # Blender (Z up, -Y front) -> glTF (Y up, +Z front)
P,form_n,full_n=gl(P),gl(form_n),gl(full_n)
q=lambda a: np.clip(np.round(a*127),-127,127).astype(np.int8)
head=json.dumps({'count':n,'positionUnit':0.0001,'axes':'glTF (+Y up, +Z front), metres',
                 'layout':['position int16x3','formNormal int8x3','sculptNormal int8x3','part uint8','label uint8'],
                 'labels':labels,
                 'parts':['torso','arm_L','arm_R','leg_L','leg_R','head']}).encode()
body=np.round(P/0.0001).astype(np.int16).tobytes()+q(form_n).tobytes()+q(full_n).tobytes()+part.tobytes()+label.tobytes()
# no file name or time in the gzip header: the same sculpt gives the same bytes
with open(out,'wb') as raw, gzip.GzipFile(filename='',mode='wb',fileobj=raw,mtime=0) as f:
    f.write(struct.pack('<I',len(head))+head+body)
print('sculpt export',n,'vertices',os.path.getsize(out),'bytes', 'height',P[:,1].max())
