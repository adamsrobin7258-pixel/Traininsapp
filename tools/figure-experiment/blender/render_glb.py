"""Render any GLB (re-import check, production body, base mesh) with the experiment's light and camera."""
import bpy,sys,os,math; sys.path.insert(0,os.path.dirname(os.path.abspath(__file__)))
import kx_render as R
glb,outdir,prefix,views=sys.argv[-4],sys.argv[-3],sys.argv[-2],sys.argv[-1].split(',')
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=glb)
meshes=[o for o in bpy.data.objects if o.type=='MESH']
for o in bpy.data.objects:
    if o.name.startswith('prop_') or o.name.startswith('Icosphere'): o.hide_render=True
for a in bpy.data.objects:
    if a.type=='ARMATURE':
        act=bpy.data.actions.get('rest')
        if act:
            a.animation_data_create(); a.animation_data.action=act
if os.environ.get('KX_SCALE'):   # Sketchfab base mesh: centimetres, re-parented
    for o in meshes:
        mw=o.matrix_world.copy(); o.parent=None; o.matrix_world=mw
        o.scale=[x*float(os.environ['KX_SCALE']) for x in o.scale]
    bpy.context.view_layer.update()
    for o in meshes:
        bpy.context.view_layer.objects.active=o; o.select_set(True)
        bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
        for p in o.data.polygons: p.use_smooth=True
        m=o.data.materials[0]; b=m.node_tree.nodes.get('Principled BSDF')
        if b: b.inputs['Base Color'].default_value=(0.42,0.42,0.42,1); b.inputs['Roughness'].default_value=0.6
co,rig=R.setup_scene(samples=int(os.environ.get('KX_SAMPLES','48')),res=(1000,1400))
for v in views:
    R.shoot(co,rig,R.VIEWS[v],os.path.join(outdir,f'{prefix}{v}.png'),dist=5.0,center_z=0.89)
