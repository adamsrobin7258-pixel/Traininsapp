import bpy, math, sys
from mathutils import Vector
def setup_scene(target_h=1.75, res=(900,1200), samples=48):
    sc=bpy.context.scene
    sc.render.engine='CYCLES'; sc.cycles.device='CPU'; sc.cycles.samples=samples
    try: sc.cycles.use_denoising=True
    except: pass
    sc.render.resolution_x, sc.render.resolution_y = res
    sc.render.film_transparent=False
    sc.view_settings.view_transform='AgX'; sc.view_settings.look='AgX - Medium High Contrast'; sc.view_settings.exposure=-0.25
    w=bpy.data.worlds.new('W'); sc.world=w; w.use_nodes=True
    bg=w.node_tree.nodes['Background']; bg.inputs[0].default_value=(0.62,0.62,0.64,1); bg.inputs[1].default_value=0.12
    # lights: key, fill, rim
    def area(name,loc,energy,size,color=(1,1,1)):
        d=bpy.data.lights.new(name,'AREA'); d.energy=energy; d.size=size; d.color=color
        o=bpy.data.objects.new(name,d); sc.collection.objects.link(o); o.location=loc
        dirv=Vector((0,0,target_h*0.55))-Vector(loc); o.rotation_euler=dirv.to_track_quat('-Z','Y').to_euler()
        return o
    rig=bpy.data.objects.new('LightRig',None); sc.collection.objects.link(rig)
    for l in [area('Key',(3.0,-1.9,3.1),520,1.6,(1,0.97,0.93)), area('Fill',(-3.0,-2.4,1.4),22,3.0,(0.92,0.95,1)), area('Rim',(-1.2,3.0,2.8),260,1.5)]:
        l.parent=rig
    # floor
    bpy.ops.mesh.primitive_plane_add(size=20); fl=bpy.context.object; fl.name='Floor'
    m=bpy.data.materials.new('FloorMat'); m.use_nodes=True; m.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value=(0.5,0.5,0.52,1)
    m.node_tree.nodes['Principled BSDF'].inputs['Roughness'].default_value=0.9; fl.data.materials.append(m)
    cam=bpy.data.cameras.new('Cam'); cam.lens=85
    co=bpy.data.objects.new('Cam',cam); sc.collection.objects.link(co); sc.camera=co
    return co,rig
VIEWS={'front':0,'front_3quarter':35,'side':90,'back':180,'back_3quarter':215}
def shoot(co,rig,view_deg,path,target_h=1.75,dist=6.2,center_z=None,lens=85):
    a=math.radians(view_deg)
    cz = target_h*0.52 if center_z is None else center_z
    co.data.lens=lens
    co.location=(dist*math.sin(a),-dist*math.cos(a),cz+0.15)
    co.rotation_euler=(Vector((0,0,cz))-co.location).to_track_quat('-Z','Y').to_euler()
    rig.rotation_euler=(0,0,a)
    bpy.context.scene.render.filepath=path
    bpy.ops.render.render(write_still=True)
