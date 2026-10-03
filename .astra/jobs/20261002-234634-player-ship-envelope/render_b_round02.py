import bpy, os, math, json, sys
from mathutils import Vector
OUT=r'C:\Users\Max\Documents\Blender\astra\well-dipper-trunk\player-ship\envelope'
V='B'; PASS=os.environ.get('ENVELOPE_PASS','1'); FINAL=os.environ.get('ENVELOPE_FINAL','0')=='1'
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=os.path.join(OUT,'envelope-'+V+'.glb'))
scene=bpy.context.scene;scene.name='Reimport_'+V
objects=list(scene.objects)
bounds=[o.matrix_world@Vector(c) for o in objects if o.type=='MESH' for c in o.bound_box]
lo=[min(v[i] for v in bounds) for i in range(3)]; hi=[max(v[i] for v in bounds) for i in range(3)]
stats={'variant':V,'objects':[],'bbox_blender_min':lo,'bbox_blender_max':hi,'bbox_blender_dimensions':[hi[i]-lo[i] for i in range(3)],'reimport':'Blender glTF importer; rendered objects are this import'}
for o in objects:
 if o.type=='MESH':
  o.data.calc_loop_triangles();stats['objects'].append({'name':o.name,'triangles':len(o.data.loop_triangles),'materials':[m.name for m in o.data.materials],'flat':all(not p.use_smooth for p in o.data.polygons)})
stats['triangles']=sum(o['triangles'] for o in stats['objects']);stats['materials']=sorted(set(m for o in stats['objects'] for m in o['materials']))
json.dump(stats,open(os.path.join(OUT,'reimport-'+V+'.json'),'w'),indent=2)
camd=bpy.data.cameras.new('Camera');cam=bpy.data.objects.new('Camera',camd);scene.collection.objects.link(cam);scene.camera=cam
for n,loc,power,size in [('Key_R',(8,10,18),1200,10),('Key_L',(-8,10,18),1200,10),('Rear',(0,-12,12),1500,9),('Front',(0,20,2),900,10)]:
 d=bpy.data.lights.new(n,'AREA');d.energy=power;d.shape='DISK';d.size=size;o=bpy.data.objects.new(n,d);scene.collection.objects.link(o);o.location=loc;o.rotation_euler=(Vector((0,0,0))-o.location).to_track_quat('-Z','Y').to_euler()
scene.world=bpy.data.worlds.new('World');scene.world.use_nodes=True;scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.04,.04,.07,1);scene.world.node_tree.nodes['Background'].inputs[1].default_value=.7
scene.render.engine='CYCLES';scene.cycles.samples=64 if FINAL else 12;scene.cycles.use_denoising=True
# Use GPU when available, otherwise the low sample CPU render is sufficient for an envelope.
try:
 prefs=bpy.context.preferences.addons['cycles'].preferences;prefs.compute_device_type='OPTIX';prefs.get_devices()
 for d in prefs.devices:d.use=(d.type=='OPTIX')
 if any(d.type=='OPTIX' for d in prefs.devices):scene.cycles.device='GPU'
except Exception:pass
scene.render.image_settings.file_format='PNG';scene.render.image_settings.color_mode='RGBA';scene.render.film_transparent=True
scene.view_settings.view_transform='Standard';scene.view_settings.look='None'
SHIFT=Vector(json.load(open(os.path.join(OUT,'registration.json')))['shift'])
def setup(view,registered):
 camd.type='ORTHO'
 if registered:
  if view=='side':
   w,h,ppm=595,340,29.4;target=Vector((0,SHIFT.y-(w/2-10)/ppm,(336-h/2)/ppm-SHIFT.z));direction=Vector((-1,0,0));up='Y';width=w/ppm
  elif view=='front':
   w,h,ppm=315,315,27;target=Vector(((145-w/2)/ppm,0,(307-h/2)/ppm-SHIFT.z));direction=Vector((0,1,0));up='Y';width=w/ppm
  else:
   w,h,ppm=500,290,26.3;target=Vector(((145-h/2)/ppm,SHIFT.y-(w/2-10)/ppm,0));direction=Vector((0,0,1));up='Y';width=w/ppm
  scene.render.resolution_x=1600;scene.render.resolution_y=round(1600*h/w);camd.ortho_scale=width
 else:
  scene.render.resolution_x=960;scene.render.resolution_y=540;target=Vector((0,.9,.35));up='Y'
  if view=='side':direction=Vector((-1,0,0));camd.ortho_scale=22.2
  elif view=='front':direction=Vector((0,1,0));camd.ortho_scale=21.7
  elif view=='top':direction=Vector((0,0,1));camd.ortho_scale=21.4
  elif view=='rear':direction=Vector((0,-1,0));camd.ortho_scale=21.7
  elif view=='underside':direction=Vector((0,0,-1));camd.ortho_scale=21.4
  else:
   camd.type='PERSP';camd.lens=55;el=math.radians(20);az=math.radians(125);direction=Vector((math.cos(el)*math.cos(az),math.cos(el)*math.sin(az),math.sin(el)));target=Vector((0,0,-.6))
 cam.location=target+direction*(53 if view=='34' else 40);cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler()
 if view=='top':
  # Screen horizontal is -Y (front left), screen up is +X.
  from mathutils import Matrix
  cam.rotation_euler=Matrix(((0,1,0),(-1,0,0),(0,0,1))).to_euler()
 if view=='underside':
  from mathutils import Matrix
  cam.rotation_euler=Matrix(((0,1,0),(1,0,0),(0,0,-1))).to_euler()
 scene.render.resolution_percentage=100
if FINAL:
 for view in ['side','front','top','34','rear','underside']:
  setup(view,False);scene.render.filepath=os.path.join(OUT,'envelope-'+V+'-'+view+'.png');bpy.ops.render.render(write_still=True)
else:
 for view in ['side','front','top']:
  setup(view,True);scene.render.filepath=os.path.join(OUT,'round02-pass'+PASS+'-'+V+'-'+view+'-raw.png');bpy.ops.render.render(write_still=True)
print('RENDER_DONE',V,PASS,FINAL)
