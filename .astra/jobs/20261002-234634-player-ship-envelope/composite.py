from PIL import Image,ImageDraw
from pathlib import Path
import sys
O=Path('/mnt/c/Users/Max/Documents/Blender/astra/well-dipper-trunk/player-ship/envelope')
p=sys.argv[1]
for v in ['A','B']:
 ims=[]
 for view in ['side','front','top']:
  raw=O/f'pass{p}-{v}-{view}-raw.png'
  if not raw.exists():continue
  model=Image.open(raw).convert('RGBA');bp=Image.open(O/'blueprints'/f'r10-{view}.png').convert('RGBA').resize(model.size,Image.Resampling.LANCZOS)
  bg=Image.new('RGBA',model.size,'white');bp=Image.blend(bg,bp,.5)
  alpha=model.getchannel('A').point(lambda x:round(x*.60));model.putalpha(alpha)
  comp=Image.alpha_composite(bp,model).convert('RGB');comp.save(O/f'pass{p}-{v}-overlay-{view}.png')
  thumb=comp.copy();thumb.thumbnail((760,440));ims.append((view,thumb))
 if ims:
  sheet=Image.new('RGB',(1520,900),'#eeeeee');d=ImageDraw.Draw(sheet)
  for (view,im),(x,y) in zip(ims,[(0,25),(800,25),(0,480)]):sheet.paste(im,(x,y));d.text((x,y-20),f'Pass {p} / {v} / {view}',fill='black')
  sheet.save(O/f'pass{p}-{v}-review.png')
