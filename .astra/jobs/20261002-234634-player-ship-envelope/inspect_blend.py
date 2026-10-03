import bpy,json,os
O=r'C:\Users\Max\Documents\Blender\astra\well-dipper-trunk\player-ship\envelope'
bpy.ops.wm.open_mainfile(filepath=os.path.join(O,'envelope.blend'))
s=bpy.context.scene
r={'scene':s.name,'units':s.unit_settings.system,'unit_scale':s.unit_settings.scale_length,'collections':{c.name:len(c.objects) for c in s.collection.children},'packed_blueprints':sum(bool(im.packed_file) for im in bpy.data.images),'materials':[m.name for m in bpy.data.materials],'flat_polygons':all(not p.use_smooth for o in s.objects if o.type=='MESH' for p in o.data.polygons),'camera_lens':s.camera.data.lens}
assert r['collections']['Variant_A']==14 and r['collections']['Variant_B']==14
assert r['packed_blueprints']==4 and r['flat_polygons']
json.dump(r,open(os.path.join(O,'blend-check.json'),'w'),indent=2)
