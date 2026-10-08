"""Render the asset (low mesh + baked normal map) like the GLB shows it; optional clay variant."""
import bpy,sys,math,os; sys.path.insert(0,os.path.dirname(os.path.abspath(__file__)))
import kx_render as R
from mathutils import Vector
blend,outdir,views=sys.argv[-3],sys.argv[-2],sys.argv[-1].split(',')
bpy.ops.wm.open_mainfile(filepath=blend)
clay=os.environ.get('KX_CLAY')=='1'
for o in list(bpy.data.objects):
    if o.name=='kalethra_sculpt': o.hide_render=True
if clay:
    for m in bpy.data.materials:
        if m.name=='skin':
            b=m.node_tree.nodes['Principled BSDF']; b.inputs['Base Color'].default_value=(0.42,0.42,0.42,1); b.inputs['Roughness'].default_value=0.6
co,rig=R.setup_scene(samples=int(os.environ.get('KX_SAMPLES','48')),res=(1000,1400))
# fit the figure: 1.76 m figure, 85 mm lens
CL={'cu_front':(0,0.12,1.3,2.0),'cu_back':(180,0.12,1.3,2.0),'cu_3q':(35,0.12,1.3,2.0),'cu_back3q':(215,0.12,1.3,2.0),
    'cu_hand':(20,0.3,0.85,0.9),'cu_head':(30,0,1.62,1.0),'cu_arm':(60,0.25,1.15,1.6),'cu_legs':(30,0,0.5,2.6)}
for v in views:
    name=os.path.join(outdir,f'{os.environ.get("KX_PREFIX","")}{v}.png')
    if v in R.VIEWS: R.shoot(co,rig,R.VIEWS[v],name,dist=float(os.environ.get('KX_DIST','5.0')),center_z=0.89)
    else:
        a,x,z,dist=CL[v]; r=math.radians(a); co.data.lens=85
        co.location=(x+dist*math.sin(r),-dist*math.cos(r),z+0.05)
        co.rotation_euler=(Vector((x,0,z))-co.location).to_track_quat('-Z','Y').to_euler(); rig.rotation_euler=(0,0,r)
        bpy.context.scene.render.filepath=name; bpy.ops.render.render(write_still=True)
