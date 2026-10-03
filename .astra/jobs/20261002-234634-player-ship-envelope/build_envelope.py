import bpy, math, json, os, sys
from mathutils import Vector
OUT=r'C:\Users\Max\Documents\Blender\astra\well-dipper-trunk\player-ship\envelope'
PASS=int(os.environ.get('ENVELOPE_PASS','1'))
bpy.ops.wm.read_factory_settings(use_empty=True)
scene=bpy.context.scene; scene.name='Envelope'; scene.unit_settings.system='METRIC'
COLORS={'glass':(.55,.75,.90,.15),'cockpit_frame':(.88,.855,.78,1),'spine':(1,.5,.1,1),'decks':(1,.78,.05,1),'underslung':(0,.42,.45,1),'engine_block':(.35,.35,.36,1),'nozzles':(.02,.02,.025,1)}
M={}
for n,c in COLORS.items():
 m=bpy.data.materials.new(n); m.diffuse_color=c; m.use_nodes=True
 bs=m.node_tree.nodes.get('Principled BSDF'); bs.inputs['Base Color'].default_value=c; bs.inputs['Metallic'].default_value=0; bs.inputs['Roughness'].default_value=1; bs.inputs['Alpha'].default_value=c[3]
 if n=='glass': m.surface_render_method='BLENDED'; m.use_transparent_shadow=False
 M[n]=m
# s = metres aft of bubble nose; h = metres above lowest pod. Final shift is common to both variants.
SHIFT=Vector((0,10.1,5.05))
def xyz(x,s,h): return (x,SHIFT.y-s,h-SHIFT.z)
def mesh(n,vs,fs,mat,col,inds=None):
 me=bpy.data.meshes.new(n); me.from_pydata(vs,[],fs); me.materials.clear()
 for m in mat: me.materials.append(M[m])
 me.update(); ob=bpy.data.objects.new(n,me); col.objects.link(ob)
 if inds:
  for p,i in zip(me.polygons,inds): p.material_index=i
 # Ensure consistent outward normals.
 import bmesh
 bm=bmesh.new(); bm.from_mesh(me); bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces)); bm.to_mesh(me); bm.free()
 ob['part_name']=n; return ob

def loft(n,rings,mat,col,profile=None):
 # Full closed, longitudinally swept cross-section. No horizontal plates.
 profile=profile or [(0,1),(.72,.90),(1,.60),(.94,.16),(.60,0),(-.60,0),(-.94,.16),(-1,.60),(-.72,.90)]
 if n in ['P03_Deck_Upper','P06a_Aft_Shoulder']:
  profile=[(0,1),(.64,.97),(1,.60),(.94,.16),(.60,0),(-.60,0),(-.94,.16),(-1,.60),(-.64,.97)]
 vs=[xyz(w*x,s,lo+(hi-lo)*z) for s,w,lo,hi in rings for x,z in profile]; k=len(profile)
 fs=[tuple(reversed(range(k)))]
 for r in range(len(rings)-1):
  for j in range(k): fs.append((r*k+j,r*k+(j+1)%k,(r+1)*k+(j+1)%k,(r+1)*k+j))
 fs.append(tuple(range((len(rings)-1)*k,len(rings)*k)))
 return mesh(n,vs,fs,[mat],col)

def boxdata(cx,s,h,dx,ds,dh,b=.18):
 # Eight-sided perimeter and three longitudinal rings: 44 triangles, softened corners.
 pro=[(-1+b,-1),(1-b,-1),(1,-1+b),(1,1-b),(1-b,1),(-1+b,1),(-1,1-b),(-1,-1+b)]
 vs=[]
 for yy,sc in [(-1,.82),(-.70,1),(.70,1),(1,.82)]:
  for x,z in pro: vs.append(xyz(cx+x*dx*.5*sc,s+yy*ds*.5,h+z*dh*.5*sc))
 fs=[tuple(reversed(range(8)))]
 for r in range(3):
  for j in range(8):fs.append((r*8+j,r*8+(j+1)%8,(r+1)*8+(j+1)%8,(r+1)*8+j))
 fs.append(tuple(range(24,32)));return vs,fs

def boxes(n,specs,col,mat='underslung'):
 vs=[];fs=[]
 for spec in specs:
  vv,ff=boxdata(*spec);off=len(vs);vs+=vv;fs += [tuple(v+off for v in f) for f in ff]
 return mesh(n,vs,fs,[mat],col)

col=bpy.data.collections.new('Variant_A');scene.collection.children.link(col)
loft('P04_Flank',[(3.4,2.8,3.8,5.1),(4.5,3.55,2.9,5.65),(7.5,4.2,3.0,7.0),(11,4.45,3.0,8.35),(14.5,4.5,3.05,8.5),(16.45,4.0,3.7,7.6),(16.85,3.25,4.45,6.55)],'decks',col)
loft('P03_Deck_Upper',[(3.0,.8,3.8,4.6),(5.4,2.65,4.0,5.85),(8.5,3.7,4.0,7.65),(11.5,4.1,4.0,9.0),(14.2,4.05,4.0,9.55),(16.1,3.5,4.05,9.2),(16.85,2.9,4.3,7.9)],'decks',col)
loft('P01_Spine_Front',[(1.65,.25,4.3,4.6),(3.5,.95,4.25,5.55),(5.3,1.15,4.8,6.95),(7.6,1.45,5.7,7.5)],'spine',col,[(0,1),(.80,1),(1,.6),(1,0),(-1,0),(-1,.6),(-.80,1)])
loft('P02_Spine_Rear',[(5.5,.55,6.35,6.65),(8.3,1.5,6.3,8.65),(11.8,1.6,7.0,10.25),(12.8,.9,7.1,10.9),(14.3,.85,7.1,10.86),(14.65,1.4,7.0,10.3),(16,1.25,6.8,9.5)],'spine',col,[(0,1),(.8,1),(1,.5),(1,0),(-1,0),(-1,.5),(-.8,1)])
loft('P06a_Aft_Shoulder',[(14.8,2.5,4.3,9.6),(16.25,3.65,4.25,9.5),(17.35,3.4,8.1,8.9),(18.0,2.7,8.1,8.25)],'decks',col)
# Ring surround facing aft: square-oval opening, no protrusion beyond 18m.
pro=[(-.72,-1),(.72,-1),(1,-.72),(1,.72),(.72,1),(-.72,1),(-1,.72),(-1,-.72)]
vs=[]
for s,w,hh in [(16.85,3.55,2.5),(17.5,3.45,2.3),(17.52,2.97,2.05),(17.0,2.97,2.05)]:
 for x,z in pro:vs.append(xyz(x*w,s,5.8+z*hh))
fs=[]
for r in range(3):
 for j in range(8):fs.append((r*8+j,r*8+(j+1)%8,(r+1)*8+(j+1)%8,(r+1)*8+j))
mesh('P06b_Engine_Surround',vs,fs,['decks'],col)
# Buried side bulges, united into one part object.
bulges=[]
for sign in [-1,1]:
 o=loft('BulgeTemp',[(8.4,.12,3.5,4.8),(9.3,1.02,3.2,5.2),(10.55,1.4,3.15,5.35),(11.8,1.0,3.2,5.2),(12.7,.12,3.5,4.8)],'decks',col,[(0,1),(.707,.85),(1,.5),(.707,.15),(0,0),(-.707,.15),(-1,.5),(-.707,.85)])
 for v in o.data.vertices:v.co.x+=sign*3.8
 bulges.append(o)
bpy.ops.object.select_all(action='DESELECT')
for o in bulges:o.select_set(True)
bpy.context.view_layer.objects.active=bulges[0];bpy.ops.object.join();bulges[0].name='P07_Side_Bulges';bulges[0]['part_name']='P07_Side_Bulges'
# Grouped undercarriage: hidden roots penetrate body. No leg supports.
boxes('P09_Modules_Front',[(-2.25,5.0,2.55,2.1,2.8,2.0),(2.25,5.0,2.55,2.1,2.8,2.0)],col)
boxes('P09_Modules_Mid',[(-3.5,8.35,2.9,2.45,4.15,2.3),(3.5,8.35,2.9,2.45,4.15,2.3)],col)
boxes('P09_Modules_Aft',[(-3.5,13.7,2.9,2.3,4.45,2.1),(3.5,13.7,2.9,2.3,4.45,2.1)],col)
boxes('P10_Belly_Pod',[(0,8.2,1.85,4.4,4.1,2.9),(0,8.3,.65,2.8,2.4,1.3)],col)
# Engine carrier plus inward sockets, as one mesh with material assignments.
vs=[xyz(x*2.96,16.9,5.8+z*2.04) for x,z in pro];fs=[tuple(range(8))];inds=[0]
for cx in [-1.52,1.52]:
 for cz in [4.65,6.95]:
  off=len(vs)
  for ss,rr in [(17.42,1.00),(17.20,.85)]:
   for k in range(10):
    t=k*math.tau/10;vs.append(xyz(cx+rr*math.cos(t),ss,cz+rr*math.sin(t)))
  for k in range(10):fs.append((off+k,off+(k+1)%10,off+10+(k+1)%10,off+10+k));inds.append(0)
  fs.append(tuple(range(off+10,off+20)));inds.append(1)
mesh('P12_Engine_Carrier',vs,fs,['engine_block','nozzles'],col,inds)
# Bubble glazing plus two cream wraparound straps, all in Bubble_MAIN.
def bubble(col,w,h):
 rings=[(0,.63,.28,.85),(.32,.94,0,1),(2.3,1,0,1),(3.4,.77,.12,.90)]
 profile=[(-.65,0),(.65,0),(1,.20),(1,.8),(.65,1),(-.65,1),(-1,.8),(-1,.2)]
 vs=[];fs=[];ids=[]
 for s,ww,lo,hi in rings:
  for x,z in profile:vs.append(xyz(x*w*.5*ww,s,.5+h*(lo+(hi-lo)*z)))
 fs.append(tuple(reversed(range(8))));ids.append(0)
 for r in range(3):
  for j in range(8):fs.append((r*8+j,r*8+(j+1)%8,(r+1)*8+(j+1)%8,(r+1)*8+j));ids.append(0)
 fs.append(tuple(range(24,32)));ids.append(0)
 # Bands run around longitudinal profile at two lateral x positions, follow top/front/bottom.
 for sign in [-1,1]:
  off=len(vs);xx=sign*w*.27;bw=.17 if w<4 else .28
  path=[(0,.5+h*.25),(-.025,.5+h*.75),(.32,.5+h*1.015),(2.3,.5+h*1.015),(3.4,.5+h*.9),(3.43,.5+h*.15),(2.3,.485),(.32,.485)]
  for x in [xx-bw,xx+bw]:
   for s,z in path:vs.append(xyz(x,s,z))
  for j in range(8):fs.append((off+j,off+(j+1)%8,off+8+(j+1)%8,off+8+j));ids.append(1)
 off=len(vs)
 for sc in [1.0,.91]:
  for x,z in profile:vs.append(xyz(x*w*.5*sc,2.31,.5+h*(.5+(z-.5)*sc)))
 for j in range(8):fs.append((off+j,off+(j+1)%8,off+8+(j+1)%8,off+8+j));ids.append(1)
 return mesh('Bubble_MAIN',vs,fs,['glass','cockpit_frame'],col,ids)
# Common geometry copied without changes into B.
colB=bpy.data.collections.new('Variant_B');scene.collection.children.link(colB)
for ob in list(col.objects):
 cp=ob.copy();cp.data=ob.data.copy();colB.objects.link(cp);cp.name=ob.name+'_B'
bubble(col,5.1,3.95)
loft('P05_Head',[(.15,1.1,4.50,5.10),(.7,1.35,4.50,5.25),(2.2,2.55,4.50,5.55),(4.6,3.5,3.4,5.8),(5.7,3.55,3.8,6.1)],'decks',col)
bub=bubble(colB,2.95,2.1);bub.name='Bubble_MAIN_B'
head=loft('P05_Head',[(.15,1.1,2.9,3.65),(.7,1.15,2.55,4.2),(2.2,1.75,2.55,5.0),(4.6,3.5,3.4,5.8),(5.7,3.55,3.8,6.1)],'decks',colB);head.name='P05_Head_B'
# Shared structural volume centroid defines the origin for both cabin alternatives.
vol=0.;moment=Vector((0,0,0))
for ob in col.objects:
 if ob['part_name'] in ['Bubble_MAIN','P05_Head','P06b_Engine_Surround','P12_Engine_Carrier']:continue
 ob.data.calc_loop_triangles()
 for t in ob.data.loop_triangles:
  a,b,c=[ob.data.vertices[i].co for i in t.vertices];vv=a.dot(b.cross(c))/6;vol+=vv;moment+=(a+b+c)*(vv/4)
center=moment/vol
for ob in list(col.objects)+list(colB.objects):
 for v in ob.data.vertices:v.co-=center
SHIFT.y-=center.y;SHIFT.z+=center.z
json.dump({'shift':list(SHIFT),'volume_proxy':vol,'origin_method':'Common equal-density closed structural parts; overlapping component volumes counted; cabin and open rear surfaces excluded.'},open(os.path.join(OUT,'registration.json'),'w'),indent=2)
# Pass updates are applied later through this script.
if PASS>=2:
 pass
# Camera and studio illumination only in presentation collection.
pres=bpy.data.collections.new('Presentation');scene.collection.children.link(pres)
camd=bpy.data.cameras.new('ReviewCamera');cam=bpy.data.objects.new('ReviewCamera',camd);pres.objects.link(cam);scene.camera=cam
for n,loc,power,size in [('Key',(8,10,18),1400,10),('Fill',(-10,2,7),1300,12),('Rear',(0,-12,12),1500,9),('Front',(0,20,2),900,10)]:
 d=bpy.data.lights.new(n,'AREA');d.energy=power;d.shape='DISK';d.size=size;o=bpy.data.objects.new(n,d);pres.objects.link(o);o.location=loc;o.rotation_euler=(Vector((0,0,0))-o.location).to_track_quat('-Z','Y').to_euler()
scene.world=bpy.data.worlds.new('Envelope_World');scene.world.use_nodes=True;scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.04,.04,.07,1);scene.world.node_tree.nodes['Background'].inputs[1].default_value=.6
scene.render.engine='CYCLES';scene.cycles.samples=12;scene.cycles.use_denoising=True
scene.render.image_settings.file_format='PNG';scene.render.image_settings.color_mode='RGBA';scene.render.film_transparent=True
scene.view_settings.view_transform='Standard';scene.view_settings.look='None';scene.view_settings.exposure=0;scene.view_settings.gamma=1
# Blueprint image planes as viewport image empties, kept out of exports and renders.
bp=bpy.data.collections.new('Blueprints_registered');scene.collection.children.link(bp)
for view,ppm,cent in [('side',29.4,(10,336)),('front',27,(145,307)),('rear',27,(150,307)),('top',26.3,(10,145))]:
 im=bpy.data.images.load(os.path.join(OUT,'blueprints','r10-'+view+'.png'));im.pack()
 ob=bpy.data.objects.new('Blueprint_'+view,None);bp.objects.link(ob);ob.empty_display_type='IMAGE';ob.data=im;ob.empty_display_size=im.size[0]/ppm;ob.color[3]=.5;ob.empty_image_depth='BACK';ob.hide_render=True
 if view=='side':ob.location=(6,SHIFT.y-(im.size[0]/2-cent[0])/ppm,(cent[1]-im.size[1]/2)/ppm-SHIFT.z);ob.rotation_euler=(math.pi/2,0,math.pi/2)
 elif view in ('front','rear'):ob.location=((im.size[0]/2-cent[0])/ppm,-10,(cent[1]-im.size[1]/2)/ppm-SHIFT.z);ob.rotation_euler=(math.pi/2,0,0)
 else:ob.location=((im.size[1]/2-cent[1])/ppm,SHIFT.y-(im.size[0]/2-cent[0])/ppm,-6);ob.rotation_euler=(0,0,math.pi/2)
colB.hide_render=True;colB.hide_viewport=True
camd.type='PERSP';camd.lens=55
el=math.radians(20);az=math.radians(125);target=Vector((0,0,-.6));cam.location=target+53*Vector((math.cos(el)*math.cos(az),math.cos(el)*math.sin(az),math.sin(el)));cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler()
scene.render.resolution_x=960;scene.render.resolution_y=540;scene.render.resolution_percentage=100
scene.render.film_transparent=False
for screen in bpy.data.screens:
 for area in screen.areas:
  if area.type=='VIEW_3D':
   area.spaces.active.region_3d.view_distance=27;area.spaces.active.region_3d.view_location=(0,0,0);area.spaces.active.region_3d.view_rotation=cam.rotation_euler.to_quaternion();area.spaces.active.shading.color_type='MATERIAL'
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT,'envelope.blend'))
# Finalized names restored individually for glTF.
for v,c in [('A',col),('B',colB)]:
 c.hide_viewport=False;bpy.ops.object.select_all(action='DESELECT')
 previous={o:o.name for o in list(col.objects)+list(colB.objects)}
 for o in previous:o.name='TMP_'+previous[o]
 for o in c.objects:o.name=o['part_name'];o.select_set(True)
 bpy.context.view_layer.objects.active=list(c.objects)[0]
 bpy.ops.export_scene.gltf(filepath=os.path.join(OUT,'envelope-'+v+'.glb'),export_format='GLB',use_selection=True,export_yup=True,export_apply=True,export_materials='EXPORT',export_cameras=False,export_lights=False)
 for o,n in previous.items():o.name='RESTORE_'+n
 for o,n in previous.items():o.name=n
 c.hide_viewport=(v=='B')
print('BUILD_DONE',PASS)
