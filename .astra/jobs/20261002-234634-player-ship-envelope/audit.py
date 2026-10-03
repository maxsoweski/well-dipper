import json,struct,numpy as np
from pathlib import Path
O=Path('/mnt/c/Users/Max/Documents/Blender/astra/well-dipper-trunk/player-ship/envelope')
EXPECTED={'glass':(.55,.75,.90,.15),'cockpit_frame':(.88,.855,.78,1),'spine':(1,.5,.1,1),'decks':(1,.78,.05,1),'underslung':(0,.42,.45,1),'engine_block':(.35,.35,.36,1),'nozzles':(.02,.02,.025,1)}
def read(p):
 b=p.read_bytes();l=struct.unpack_from('<I',b,12)[0];j=json.loads(b[20:20+l]);off=20+l;bin=b[off+8:];return j,bin
def acc(j,b,i):
 a=j['accessors'][i];v=j['bufferViews'][a['bufferView']];n={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4}[a['type']];dt={5126:'<f4',5125:'<u4',5123:'<u2',5121:'u1'}[a['componentType']]
 return np.frombuffer(b,dtype=dt,count=a['count']*n,offset=v.get('byteOffset',0)+a.get('byteOffset',0)).reshape(-1,n)
allstats={};geo={}
for V in ['A','B']:
 p=O/f'envelope-{V}.glb';j,b=read(p);tris=0;points=[];obj=[];geo[V]={};varying_normals=0
 for n in j['nodes']:
  if 'mesh' not in n:continue
  ps=j['meshes'][n['mesh']]['primitives'];nt=0;vv=[]
  for pp in ps:
   idx=acc(j,b,pp['indices']).ravel().reshape(-1,3);norm=acc(j,b,pp['attributes']['NORMAL'])[idx];varying_normals+=int(np.any(np.abs(norm-norm[:,0:1,:])>1e-5,axis=(1,2)).sum());cnt=j['accessors'][pp['indices']]['count']//3;nt+=cnt;tris+=cnt;positions=acc(j,b,pp['attributes']['POSITION']);vv.append(positions);points.append(positions)
  geo[V][n['name']]=np.concatenate(vv);obj.append({'name':n['name'],'triangles':nt})
 pts=np.concatenate(points);bu=geo[V]['Bubble_MAIN'];mats={m['name']:m for m in j['materials']}
 assert set(mats)==set(EXPECTED)
 for name,c in EXPECTED.items():
  pp=mats[name]['pbrMetallicRoughness'];assert np.allclose(pp['baseColorFactor'],c,atol=1e-6);assert pp.get('metallicFactor',1)==0;assert pp.get('roughnessFactor',1)==1
 assert mats['glass']['alphaMode']=='BLEND';assert tris<=1500;assert not j.get('cameras');assert not j.get('textures');assert not j.get('images');assert not any('KHR_lights_punctual' in n.get('extensions',{}) for n in j['nodes']);assert bu[:,2].max()<0
 if V=='B':assert np.ptp(bu[:,0])<=3
 assert varying_normals==0
 allstats[V]={'varying_triangle_corner_normals':varying_normals,'objects':obj,'triangles':tris,'material_count':len(mats),'material_names':list(mats),'bbox_gltf_min':pts.min(0).tolist(),'bbox_gltf_max':pts.max(0).tolist(),'bbox_gltf_dimensions':np.ptp(pts,axis=0).tolist(),'bubble_z_range':[float(bu[:,2].min()),float(bu[:,2].max())],'bubble_dimensions_gltf':np.ptp(bu,axis=0).tolist(),'no_cameras_lights_textures':True,'materials_match':True}
same=[]
for n,a in geo['A'].items():
 if n in ['Bubble_MAIN','P05_Head']:continue
 assert np.array_equal(a,geo['B'][n]),n;same.append(n)
allstats['identical_common_parts']=same;allstats['common_part_count']=len(same)
json.dump(allstats,open(O/'acceptance.json','w'),indent=2);print(json.dumps(allstats,indent=2))
