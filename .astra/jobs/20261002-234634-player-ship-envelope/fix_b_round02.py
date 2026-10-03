import bpy,bmesh,math,json,os,hashlib
from mathutils import Vector
from mathutils.bvhtree import BVHTree
O=r'C:\Users\Max\Documents\Blender\astra\well-dipper-trunk\player-ship\envelope'
PASS=int(os.environ.get('FIX_PASS','1'))
bpy.ops.wm.open_mainfile(filepath=os.path.join(O,'round02-baseline.blend'))
scene=bpy.context.scene;A=bpy.data.collections['Variant_A'];B=bpy.data.collections['Variant_B'];B.hide_viewport=False
SHIFT=Vector((0,11.130549430847168,5.406834125518799))
def xyz(x,s,h):return Vector((x,SHIFT.y-s,h-SHIFT.z))
def sig(c):
 return hashlib.sha256(json.dumps([(o.name,[list(v.co) for v in o.data.vertices],[(list(p.vertices),p.material_index,p.use_smooth) for p in o.data.polygons],[m.name for m in o.data.materials]) for o in c.objects],sort_keys=True).encode()).hexdigest()
Asig=sig(A)
M={m.name:m for m in bpy.data.materials}
for n,c in {'engine_glow':(.03,.03,.035,1),'hatch':(.8,.05,.05,1),'thrusters':(.85,0,.6,1)}.items():
 m=bpy.data.materials.new(n);m.diffuse_color=c;m.use_nodes=True;bs=m.node_tree.nodes.get('Principled BSDF');bs.inputs['Base Color'].default_value=c;bs.inputs['Metallic'].default_value=0;bs.inputs['Roughness'].default_value=1;bs.inputs['Emission Strength'].default_value=0;M[n]=m
D={o['part_name']:o for o in B.objects}
# Recenter vertices only by the original sub-millimetre numerical x offset; origin stays fixed.
for o in B.objects:
 o.data=o.data.copy();xmin=min(v.co.x for v in o.data.vertices);xmax=max(v.co.x for v in o.data.vertices);dx=(xmin+xmax)/2
 for v in o.data.vertices:v.co.x-=dx

def replace(n,vs,fs,mats,inds=None):
 if n in D:
  ob=D[n];me=ob.data
  # Old data remains isolated; never mutate any A mesh.
  nm=bpy.data.meshes.new(n+'_r02');ob.data=nm
 else:
  nm=bpy.data.meshes.new(n+'_r02');ob=bpy.data.objects.new(n+'_B',nm);B.objects.link(ob);ob['part_name']=n;D[n]=ob
 nm.from_pydata(vs,[],fs)
 for m in mats:nm.materials.append(M[m])
 if inds:
  for p,i in zip(nm.polygons,inds):p.material_index=i
 nm.update();bm=bmesh.new();bm.from_mesh(nm);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(nm);bm.free();return ob

def loft(n,rings,profile=None):
 pro=profile or [(0,1),(.64,.97),(1,.60),(.94,.16),(.60,0),(-.60,0),(-.94,.16),(-1,.60),(-.64,.97)]
 if n=='P06a_Aft_Shoulder':
  pro=[(0,1),(.5,.96),(.85,.8),(1,.5),(.85,.2),(.5,.04),(0,0),(-.5,.04),(-.85,.2),(-1,.5),(-.85,.8),(-.5,.96)]
 vs=[xyz(w*x,s,lo+(hi-lo)*z) for s,w,lo,hi in rings for x,z in pro];k=len(pro);fs=[tuple(reversed(range(k)))]
 for r in range(len(rings)-1):
  for j in range(k):fs.append((r*k+j,r*k+(j+1)%k,(r+1)*k+(j+1)%k,(r+1)*k+j))
 fs.append(tuple(range((len(rings)-1)*k,len(rings)*k)));return replace(n,vs,fs,['decks'])
loft('P05_Head',[(1.6,.9,3.15,4.00),(2.3,1.7,2.60,4.75),(4.6,3.5,3.4,5.8),(5.7,3.55,3.8,6.1)])
loft('P06a_Aft_Shoulder',[(14.8,2.5,4.3,9.6),(16.25,3.65,4.25,9.5),(16.60,3.55,8.12,9.30),(17.20,3.35,8.20,9.08),(17.70,3.05,8.23,8.91),(17.95,2.83,8.34,8.71),(18.0,2.70,8.46,8.56)])
# Replace the old undercarriage with six blocks per side, no central body.
for n in ['P09_Modules_Front','P09_Modules_Mid','P09_Modules_Aft','P10_Belly_Pod']:
 bpy.data.objects.remove(D.pop(n),do_unlink=True)
# Bevelled boxes with 44 triangles each; build right side, mirror at final step.
def bevelbox(n,c,dim,b=.18):
 bpy.ops.mesh.primitive_cube_add(size=1,location=c);ob=bpy.context.object
 for cc in list(ob.users_collection):cc.objects.unlink(ob)
 B.objects.link(ob);ob.name=n+'_B';ob['part_name']=n;ob.scale=dim;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
 mod=ob.modifiers.new('Rounded_corners','BEVEL');mod.width=b;mod.segments=1;mod.affect='EDGES'
 bpy.context.view_layer.objects.active=ob;bpy.ops.object.modifier_apply(modifier=mod.name)
 # Bake world translation into vertices, so mirroring is about the fixed ship origin.
 for v in ob.data.vertices:v.co=ob.matrix_world@v.co
 ob.location=(0,0,0);ob.data.materials.append(M['underslung']);D[n]=ob;return ob
modules=[]
for i,(s,low) in enumerate([(4.5,1.3),(6.6,.55),(8.65,0),(10.7,.15),(12.8,.65),(14.95,1.2)],1):
 top=4.05;ob=bevelbox('P09_Keel_%02d'%i,xyz(3.45,s,(top+low)/2),(1.75,2.02,top-low),.16);modules.append(ob)
# Grey carrier has real openings: face annuli at the mouth plane, walls and recessed backs.
vs=[];fs=[];ids=[]
for cx in [-1.52,1.52]:
 for cz in [4.65,6.95]:
  left,right=(-2.96,0) if cx<0 else (0,2.96)
  bottom,top=(3.76,5.8) if cz<5.8 else (5.8,7.84)
  boundary=[(right,cz),(right,top),(cx,top),(left,top),(left,cz),(left,bottom),(cx,bottom),(right,bottom)]
  off=len(vs);vs += [xyz(x,17.42,z) for x,z in boundary]
  for station in [17.42,17.32]:
   for k in range(8):
    t=k*math.tau/8;vs.append(xyz(cx+.86*math.cos(t),station,cz+.86*math.sin(t)))
  for ring,mat in [(0,0),(1,1)]:
   for k in range(8):fs.append((off+ring*8+k,off+ring*8+(k+1)%8,off+(ring+1)*8+(k+1)%8,off+(ring+1)*8+k));ids.append(mat)
  fs.append(tuple(off+16+k for k in range(8)));ids.append(2)
replace('P12_Engine_Carrier',vs,fs,['engine_block','nozzles','engine_glow'],ids)

# Remove only three fully buried end caps; the exposed silhouette is unchanged.
for name,station in [('P01_Spine_Front',7.6),('P02_Spine_Rear',5.5),('P03_Deck_Upper',3.0)]:
 ob=D[name];bm=bmesh.new();bm.from_mesh(ob.data)
 caps=[f for f in bm.faces if all(abs(v.co.y-(SHIFT.y-station))<1e-4 for v in f.verts)]
 bmesh.ops.delete(bm,geom=caps,context='FACES');bm.to_mesh(ob.data);bm.free()
# Work only on +X half. Every final face is explicitly mirrored with reversed winding.
def half_tri(ob):
 bm=bmesh.new();bm.from_mesh(ob.data)
 bmesh.ops.bisect_plane(bm,geom=list(bm.verts)+list(bm.edges)+list(bm.faces),dist=1e-6,plane_co=(0,0,0),plane_no=(1,0,0),clear_inner=True,clear_outer=False)
 bmesh.ops.triangulate(bm,faces=list(bm.faces),quad_method='FIXED',ngon_method='EAR_CLIP')
 bm.to_mesh(ob.data);bm.free();ob.data.update()
for ob in list(B.objects):half_tri(ob)

ports=[]
def port_on_face(target,normal,radius,label,allowed):
 # Locate a visible outward triangle near the reference landmark and inset it, rather than mounting a puck.
 target=Vector(target);normal=Vector(normal).normalized();choices=[]
 for ob in allowed:
  ob.data.update()
  for p in ob.data.polygons:
   if len(p.vertices)!=3 or p.normal.dot(normal)<.22:continue
   vs=[ob.data.vertices[i].co.copy() for i in p.vertices];center=sum(vs,Vector())/3
   if center.x<.15:continue
   area=(vs[1]-vs[0]).cross(vs[2]-vs[0]).length/2
   perimeter=sum((vs[(i+1)%3]-vs[i]).length for i in range(3));inrad=2*area/perimeter
   if inrad<radius*.62:continue
   lens=[(vs[1]-vs[2]).length,(vs[2]-vs[0]).length,(vs[0]-vs[1]).length]
   inc=sum((v*l for v,l in zip(vs,lens)),Vector())/sum(lens)
   rad=min(radius,inrad*.80);proj=target-p.normal*(target-vs[0]).dot(p.normal);fraction=1.0
   for ii in range(3):
    edge=(vs[(ii+1)%3]-vs[ii]).normalized();inward=p.normal.cross(edge);dist=(proj-vs[ii]).dot(inward)
    if dist<rad:fraction=min(fraction,max(0,(inrad-rad)/(inrad-dist)))
   fit=inc+(proj-inc)*fraction
   score=(fit-target).length+1.3*(1-p.normal.dot(normal))
   if label=='head_forward':
    fit=inc;score=(center-target).length+1.3*(1-p.normal.dot(normal))
   choices.append((score,ob,p.index,vs,p.normal.copy(),inrad,fit))
 if not choices:raise RuntimeError('No fitting face for '+label)
 _,ob,fi,outer,n,ir,fit=min(choices,key=lambda x:x[0]);center=fit
 # Incentre permits a circular opening even in elongated triangles.
 lens=[(outer[1]-outer[2]).length,(outer[2]-outer[0]).length,(outer[0]-outer[1]).length]
 inc=sum((v*l for v,l in zip(outer,lens)),Vector())/sum(lens)
 center=fit;radius=min(radius,ir*.80);steps=3 if label=='head_forward' else 2;segments=steps*3
 # A recess must be visible through all overlapping hull layers, including at its rim.
 if label in ['head_forward','shoulder']:
  trees=[BVHTree.FromPolygons([v.co for v in oo.data.vertices],[list(p.vertices) for p in oo.data.polygons]) for oo in B.objects if oo!=ob]
  tangent=(outer[0]-inc).normalized();bitangent=n.cross(tangent).normalized()
  for fraction in [0,.25,.5,.75,1.0]:
   candidate=fit.lerp(inc,fraction);blocked=False
   samples=[candidate]+[candidate+radius*.8*(tangent*math.cos(k*math.tau/8)+bitangent*math.sin(k*math.tau/8)) for k in range(8)]
   for pp in samples:
    for tree in trees:
     hit,nn,ii,dd=tree.ray_cast(pp+n*.5,-n,.605)
     if hit is not None:blocked=True;break
    if blocked:break
   if not blocked:center=candidate;break
  else:center=inc

 e1=(outer[0]-center).normalized();e2=n.cross(e1).normalized()
 angles=[math.atan2((v-center).dot(e2),(v-center).dot(e1)) for v in outer]
 for i in range(1,3):
  while angles[i]<angles[i-1]:angles[i]+=math.tau
 dirs=[]
 for i in range(3):
  aa=angles[i];bb=angles[i+1] if i<2 else angles[0]+math.tau
  for k in range(steps):
   t=aa+(bb-aa)*k/steps;dirs.append(e1*math.cos(t)+e2*math.sin(t))
 oldvs=[v.co.copy() for v in ob.data.vertices];oldfs=[tuple(p.vertices) for p in ob.data.polygons if p.index!=fi];ids=[p.material_index for p in ob.data.polygons if p.index!=fi]
 mats=[m.name for m in ob.data.materials]
 for name in ['thrusters','nozzles','engine_glow']:
  if name not in mats:mats.append(name)
 hostmat=ob.data.polygons[fi].material_index;base=len(oldvs)
 depth=.10
 for rr,dd in [(radius,0),(radius*.73,-depth)]:
  oldvs += [center+d*rr+n*dd for d in dirs]
 verts=list(ob.data.polygons[fi].vertices)
 for i in range(3):
  inner=[base+(i*steps+k)%segments for k in range(steps,-1,-1)]
  oldfs.append(tuple([verts[i],verts[(i+1)%3]]+inner));ids.append(hostmat)
 for i in range(segments):oldfs.append((base+i,base+(i+1)%segments,base+segments+(i+1)%segments,base+segments+i));ids.append(mats.index('thrusters'))
 oldfs.append(tuple(base+segments+i for i in range(segments)));ids.append(mats.index('engine_glow'))
 replace(ob['part_name'],oldvs,oldfs,mats,ids)
 ports.append({'name':label,'host':ob['part_name'],'centre':list(center),'normal':list(n),'radius':radius,'depth':depth,'paired':True})
# Six visible categories, paired at every corresponding r10 face; two head and module orientations.
port_on_face(xyz(2.2,3.5,4.7),(.35,1,.05),.38,'head_forward',[D['P05_Head']])
port_on_face(xyz(2.4,3.6,3.6),(1,0,0),.20,'head_side',[D['P05_Head']])
port_on_face(xyz(3.5,16.0,5.0),(1,-.15,.1),.23,'flank_aft',[D['P04_Flank']])
port_on_face(xyz(3,16.1,8.5),(1,-.1,.2),.23,'shoulder',[D['P03_Deck_Upper'],D['P06a_Aft_Shoulder']])
port_on_face(xyz(3.45,3.5,2.7),(0,1,0),.18,'module_forward',[modules[0]])
port_on_face(xyz(4.32,4.5,2.5),(1,0,0),.18,'module_side',[modules[0]])
port_on_face(xyz(3.45,15.96,2.5),(0,-1,0),.18,'module_rear',[modules[-1]])
port_on_face(xyz(3.45,8.65,0),(0,0,-1),.24,'belly_down',[modules[2]])
# Red hatch mirrored on the aft module pair, inset visually inside the chamfered side face.
c=xyz(4.33,12.8,2.55);vs=[c+Vector((0,y,z)) for y,z in [(-.55,-.65),(.55,-.65),(.55,.65),(-.55,.65)]]
replace('P11_Side_Hatch',vs,[(0,1,2,3)],['hatch'])

# Explicit final triangulation then reflection; centreline vertices are shared.
def mirror_tri(ob):
 bm=bmesh.new();bm.from_mesh(ob.data);bmesh.ops.triangulate(bm,faces=list(bm.faces),quad_method='FIXED',ngon_method='EAR_CLIP');bm.to_mesh(ob.data);bm.free()
 vs=[v.co.copy() for v in ob.data.vertices];fs=[tuple(p.vertices) for p in ob.data.polygons];ids=[p.material_index for p in ob.data.polygons];maps={}
 for i,v in enumerate(list(vs)):
  if abs(v.x)<1e-6:vs[i].x=0;maps[i]=i
  else:maps[i]=len(vs);vs.append(Vector((-v.x,v.y,v.z)))
 for f,mi in list(zip(fs,ids)):
  if all(abs(vs[i].x)<1e-6 for i in f):continue
  fs.append(tuple(maps[i] for i in reversed(f)));ids.append(mi)
 replace(ob['part_name'],vs,fs,[m.name for m in ob.data.materials],ids)
for ob in list(B.objects):mirror_tri(ob)
# A mesh/material assignments must not change.
assert sig(A)==Asig
for ob in B.objects:
 for p in ob.data.polygons:p.use_smooth=False
# Symmetry is measured both by reflected vertices and by full material-tagged triangles.
def key(v):return tuple(round(float(t),6) for t in v)
miss=0;vmax=0.;triangles=0
for ob in B.objects:
 coords=[v.co for v in ob.data.vertices];keys={key(v) for v in coords};faces={(tuple(sorted(key(coords[i]) for i in p.vertices)),p.material_index) for p in ob.data.polygons}
 for v in coords:
  reflected=Vector((-v.x,v.y,v.z));vmax=max(vmax,min((reflected-w).length for w in coords))
 for p in ob.data.polygons:
  reflected=tuple(sorted(key((-coords[i].x,coords[i].y,coords[i].z)) for i in p.vertices))
  if (reflected,p.material_index) not in faces:miss+=1
 ob.data.calc_loop_triangles();triangles+=len(ob.data.loop_triangles)
assert vmax<1e-6 and miss==0,(vmax,miss)
# Probe the rear aperture from behind; every sample should meet carrier/wall/glow, never a deck.
bpy.context.view_layer.update();yellow=[];rays=0
bvhs={ob:BVHTree.FromPolygons([v.co for v in ob.data.vertices],[list(p.vertices) for p in ob.data.polygons]) for ob in B.objects}
for ix in range(21):
 for iz in range(17):
  x=-2.6+5.2*ix/20;h=4.0+3.6*iz/16
  if abs(x)/2.97+abs(h-5.8)/2.05>1.70:continue
  origin=xyz(x,20,h);hits=[]
  for ob,bvh in bvhs.items():
   pt,n,fi,dist=bvh.ray_cast(origin,Vector((0,1,0)),5)
   if pt is not None:hits.append((dist,ob,fi))
  rays+=1
  if hits:
   _,ob,fi=min(hits,key=lambda x:x[0]);mat=ob.data.materials[ob.data.polygons[fi].material_index].name
   if mat=='decks':yellow.append([x,h,ob['part_name']])
port_probe=[]
for pt in ports:
 center=Vector(pt['centre']);normal=Vector(pt['normal']);hits=[]
 for ob,bvh in bvhs.items():
  loc,n,fi,dist=bvh.ray_cast(center+normal*.45,-normal,1.0)
  if loc is not None:hits.append((dist,ob,fi))
 if hits:
  _,ob,fi=min(hits,key=lambda x:x[0]);mat=ob.data.materials[ob.data.polygons[fi].material_index].name
 else:mat='MISS'
 port_probe.append({'port':pt['name'],'first_material':mat})
# Record original origin and exact geometry evidence before saving.
report={'pass':PASS,'triangles':triangles,'symmetry_max_vertex_m':vmax,'unmatched_material_triangles':miss,'A_scene_geometry_sha256_before':Asig,'A_scene_geometry_sha256_after':sig(A),'rear_aperture_rays':rays,'rear_yellow_hits':yellow,'port_visibility':port_probe,'ports':ports,'manoeuvring_ports':len(ports)*2,'main_nozzles':4,'main_nozzle_depth':.10,'objects':[{'name':ob['part_name'],'triangles':len(ob.data.loop_triangles)} for ob in B.objects]}
json.dump(report,open(os.path.join(O,'round02-build-check.json'),'w'),indent=2)
print('FIX_CHECK',json.dumps(report))
assert triangles<=2200,triangles
assert not yellow,yellow
assert all(p['first_material']=='engine_glow' for p in port_probe),port_probe
# B is the active ship; A collection's mesh data and object settings remain intact.
B.hide_render=False;B.hide_viewport=False
# Hide A at the view-layer level without changing its objects.
scene.view_layers[0].layer_collection.children[A.name].exclude=True
scene.view_layers[0].layer_collection.children['Blueprints_registered'].exclude=True
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(O,'envelope.blend'))
bpy.ops.object.select_all(action='DESELECT')
# Give exported B nodes canonical names without renaming any A object.
# The exporter supports extras, but canonical names are restored in GLB after export if Blender suffixes collide.
for ob in B.objects:ob.select_set(True)
bpy.context.view_layer.objects.active=D['Bubble_MAIN']
bpy.ops.export_scene.gltf(filepath=os.path.join(O,'envelope-B.glb'),export_format='GLB',use_selection=True,export_yup=True,export_apply=True,export_materials='EXPORT',export_cameras=False,export_lights=False,export_extras=True)
json.dump({'shift':list(SHIFT)},open(os.path.join(O,'registration.json'),'w'))
print('FIX_DONE')
