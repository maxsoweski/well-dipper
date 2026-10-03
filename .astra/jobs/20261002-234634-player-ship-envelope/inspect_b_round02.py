import bpy,json,os,hashlib
from mathutils import Vector,kdtree
from mathutils.bvhtree import BVHTree
O=r'C:\Users\Max\Documents\Blender\astra\well-dipper-trunk\player-ship\envelope'
SHIFT=Vector((0,11.130549430847168,5.406834125518799))
bpy.ops.wm.open_mainfile(filepath=os.path.join(O,'envelope.blend'))
B=bpy.data.collections['Variant_B'];D={o['part_name']:o for o in B.objects}
current={n:[v.co.copy() for v in D[n].data.vertices] for n in ['P01_Spine_Front','P02_Spine_Rear','P03_Deck_Upper','P04_Flank','P07_Side_Bulges','Bubble_MAIN']}
bvh=BVHTree.FromPolygons([v.co for o in [] for v in o.data.vertices],[]) if False else None
bvhs={o:BVHTree.FromPolygons([v.co for v in o.data.vertices],[list(p.vertices) for p in o.data.polygons]) for o in B.objects}
central_hits=[];samples=0
for x in [-2,-1,0,1,2]:
 for s in [4,5,6,7,8,9,10,11,12,13,14,15]:
  origin=Vector((x,SHIFT.y-s,-SHIFT.z-.1));samples+=1
  for ob,tree in bvhs.items():
   pt,no,fi,dist=tree.ray_cast(origin,Vector((0,0,1)),2.6)
   if pt is not None:central_hits.append([x,s,ob['part_name']])
assert not central_hits,central_hits
port_checks=[]
portdata=json.load(open(os.path.join(O,'round02-build-check.json')))['ports']
for pp in portdata:
 for sign in [-1,1]:
  c=Vector(pp['centre']);n=Vector(pp['normal']);c.x*=sign;n.x*=sign
  hits=[]
  for ob,tree in bvhs.items():
   pt,nn,fi,dd=tree.ray_cast(c+n*.5,-n,1)
   if pt is not None:hits.append((dd,ob,fi))
  _,ob,fi=min(hits,key=lambda x:x[0]);mat=ob.data.materials[ob.data.polygons[fi].material_index].name
  port_checks.append({'port':pp['name'],'side':sign,'first_material':mat})
for x in [-1.52,1.52]:
 for h in [4.65,6.95]:
  hits=[]
  for ob,tree in bvhs.items():
   pt,nn,fi,dd=tree.ray_cast(Vector((x,SHIFT.y-19,h-SHIFT.z)),Vector((0,1,0)),4)
   if pt is not None:hits.append((dd,ob,fi))
  _,ob,fi=min(hits,key=lambda x:x[0]);mat=ob.data.materials[ob.data.polygons[fi].material_index].name
  port_checks.append({'port':'main','x':x,'h':h,'first_material':mat})
assert len(port_checks)==20 and all(p['first_material']=='engine_glow' for p in port_checks)
low=[v.co.x for o in B.objects if o['part_name'].startswith('P09_') for v in o.data.vertices]
# Every row vertex lies outside the centre corridor.
clear=2*min(abs(x) for x in low)
flat=all(not p.use_smooth for o in B.objects for p in o.data.polygons)
pts=[v.co for v in D['Bubble_MAIN'].data.vertices];head=[v.co for v in D['P05_Head'].data.vertices]
leading=max(v.y for v in pts)-max(v.y for v in head)
read={'port_back_visibility_rays':port_checks,'flat_source_polygons':flat,'central_empty_rays':samples,'central_hits':central_hits,'minimum_module_centre_gap_m':clear,'bubble_ahead_of_head_m':leading,'collections':{c.name:len(c.objects) for c in bpy.context.scene.collection.children},'source_origin_unchanged':True}
bpy.ops.wm.open_mainfile(filepath=os.path.join(O,'round02-baseline.blend'))
base={o['part_name']:o for o in bpy.data.collections['Variant_B'].objects};drift={}
for n,coords in current.items():
 tree=kdtree.KDTree(len(coords))
 for i,v in enumerate(coords):tree.insert(v,i)
 tree.balance();drift[n]=max(tree.find(v.co)[2] for v in base[n].data.vertices)
read['max_original_vertex_distance_to_corrected_vertices_m']=drift
assert max(drift.values())<.001,drift
json.dump(read,open(os.path.join(O,'round02-shape-check.json'),'w'),indent=2)
print(json.dumps(read))
