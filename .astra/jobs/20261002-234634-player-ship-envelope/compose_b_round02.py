from pathlib import Path
from PIL import Image,ImageOps,ImageDraw
import sys
O=Path('/mnt/c/Users/Max/Documents/Blender/astra/well-dipper-trunk/player-ship/envelope');p=sys.argv[1]
ims=[]
for v in ['side','front','top']:
 model=Image.open(O/f'round02-pass{p}-B-{v}-raw.png').convert('RGBA');ref=Image.open(O/'blueprints'/f'r10-{v}.png').convert('RGBA').resize(model.size,Image.Resampling.LANCZOS);bg=Image.blend(Image.new('RGBA',model.size,'white'),ref,.5);model.putalpha(model.getchannel('A').point(lambda x:round(x*.6)));im=Image.alpha_composite(bg,model).convert('RGB');im.save(O/f'round02-pass{p}-overlay-{v}.png');im.thumbnail((790,470));ims.append((v,im))
sheet=Image.new('RGB',(1600,1000),'white');d=ImageDraw.Draw(sheet)
for (v,im),(x,y) in zip(ims,[(0,25),(810,25),(0,520)]):sheet.paste(im,(x,y));d.text((x,y-20),f'Round 02 / pass {p} / {v}',fill='black')
sheet.save(O/f'round02-pass{p}-review.png')
for view in ['34','side','front','top','rear']:
 src=O/f'envelope-B-{view}.png'
 if not src.exists():continue
 im=Image.open(src).convert('RGBA');bg=Image.new('RGBA',im.size,(10,10,18,255));bg.alpha_composite(im);bg.convert('RGB').save(O/f'round02-check-{view}.png')
