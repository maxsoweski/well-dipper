from pathlib import Path
import json,struct,hashlib,numpy as np
O=Path('/mnt/c/Users/Max/Documents/Blender/astra/well-dipper-trunk/player-ship/envelope')
p=O/'envelope-B.glb';data=p.read_bytes();length,typ=struct.unpack_from('<II',data,12);j=json.loads(data[20:20+length]);rest=data[20+length:]
for n in j['nodes']:
 if 'part_name' in n.get('extras',{}):n['name']=n['extras']['part_name']
out=json.dumps(j,separators=(',',':')).encode();out+=b' '*((-len(out))%4);p.write_bytes(struct.pack('<III',0x46546c67,2,20+len(out)+len(rest))+struct.pack('<II',len(out),0x4e4f534a)+out+rest)
# Read accessors directly; exported model nodes use baked identity transforms.
bin=rest[8:]
def acc(i):
 a=j['accessors'][i];v=j['bufferViews'][a['bufferView']];n={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4}[a['type']];dt={5126:'<f4',5125:'<u4',5123:'<u2',5121:'u1'}[a['componentType']]
 return np.frombuffer(bin,dtype=dt,count=a['count']*n,offset=v.get('byteOffset',0)+a.get('byteOffset',0)).reshape(-1,n)
from scipy.spatial import cKDTree
points=[];count=0;badnormal=0;badfacets=0;objects=[];backs=0
for n in j['nodes']:
 if 'mesh' not in n:continue
 ps=j['meshes'][n['mesh']]['primitives'];vs=[];fs=set();nt=0
 for pp in ps:
  vv=acc(pp['attributes']['POSITION']);ix=acc(pp['indices']).ravel().reshape(-1,3);ns=acc(pp['attributes']['NORMAL'])[ix];badnormal+=int(np.any(np.abs(ns-ns[:,0:1,:])>1e-5,axis=(1,2)).sum());count+=len(ix);nt+=len(ix);vs.append(vv)
  mat=j['materials'][pp['material']]['name']
  for tri in vv[ix]:fs.add((tuple(sorted(tuple(float(v) for v in pt) for pt in tri)),mat))
  if mat=='engine_glow':backs+=len(ix)
 for tri,mat in fs:
  mirrored=tuple(sorted((-pt[0],pt[1],pt[2]) for pt in tri))
  if (mirrored,mat) not in fs:badfacets+=1
 vv=np.concatenate(vs);points.append(vv);objects.append({'name':n['name'],'triangles':nt})
 if n['name']=='Bubble_MAIN':bubble=vv
pts=np.concatenate(points);ref=pts.copy();ref[:,0]*=-1;error=float(cKDTree(pts).query(ref)[0].max())
mats={m['name']:m for m in j['materials']};assert len(mats)==10
for name,m in mats.items():
 pp=m['pbrMetallicRoughness'];assert pp.get('metallicFactor',1)==0 and pp.get('roughnessFactor',1)==1
 assert m.get('emissiveFactor',[0,0,0])==[0,0,0]
assert np.allclose(mats['engine_glow']['pbrMetallicRoughness']['baseColorFactor'],[.03,.03,.035,1])
assert np.allclose(mats['hatch']['pbrMetallicRoughness']['baseColorFactor'],[.8,.05,.05,1])
assert np.allclose(mats['thrusters']['pbrMetallicRoughness']['baseColorFactor'],[.85,0,.6,1])
assert count<=2200 and error<1e-6 and badfacets==0 and badnormal==0
assert abs(np.ptp(bubble[:,0])-2.95)<1e-5
assert not j.get('cameras') and not j.get('textures')
old=json.load(open('out/round02/A-before.json'))
for path,h in old.items():assert hashlib.sha256(Path(path).read_bytes()).hexdigest()==h
r={'triangles':count,'objects':objects,'materials':list(mats),'symmetry_max_vertex_m':error,'unmatched_material_triangles':badfacets,'triangles_with_varying_corner_normals':badnormal,'bbox_gltf_min':pts.min(0).tolist(),'bbox_gltf_max':pts.max(0).tolist(),'bbox_gltf_size':np.ptp(pts,axis=0).tolist(),'bubble_width':float(np.ptp(bubble[:,0])),'bubble_z_range':[float(bubble[:,2].min()),float(bubble[:,2].max())],'engine_glow_triangles':backs,'A_files_unchanged':len(old),'sha256':hashlib.sha256(p.read_bytes()).hexdigest()}
(O/'round02-acceptance.json').write_text(json.dumps(r,indent=2));print(json.dumps(r,indent=2))
