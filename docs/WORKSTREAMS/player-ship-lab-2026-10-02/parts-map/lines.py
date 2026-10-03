"""Sparse LABELLED feature lines of r10, built from strokes.json (strokes.py). Each named line lists its stroke ids per
view, its meaning and confidence; output lines.json (polylines in sheet px AND metres per view) + lines-r10.png."""
import json
from PIL import Image, ImageDraw, ImageFont
SHEET = '/home/ax/projects/well-dipper-trunk/.astra/jobs/20261002-151739-player-ship-ext-v3/out/player-ship-ext-sheet.png'
S = {s['id']: s for s in json.load(open('strokes.json'))}
# view registration (see PARTS-MAP.md). side/top: u = metres back from the bubble's front; front/rear: u = metres right
# of the centreline (viewer's right); v = metres above the lowest module.
REG = {'side': dict(ppm=29.4, x0=115, y0=396, flip=False), 'top': dict(ppm=26.3, x0=1402, y0=256.5, flip=False),
       'front': dict(ppm=27.0, x0=890, y0=392, flip=False), 'rear': dict(ppm=27.0, x0=1214, y0=392, flip=False)}
def to_m(view, p):
    r = REG[view]; u = (p[0] - r['x0']) / r['ppm']; v = (r['y0'] - p[1]) / r['ppm']
    return [round(u, 3), round(v, 3)]   # top view: v = metres toward the ship's LEFT side (image up)
LINES = [
 ('L1', 'Spine crown seam', 'S — seam along the top of the rear spine crown', {'side': [1], 'front': [36], 'rear': [69]}, 'high'),
 ('L2', 'Spine segment joint', 'O — rear spine segment overlaps the front one', {'side': [5], 'front': [38, 41], 'top': [106]}, 'medium'),
 ('L3', 'Spine edge', 'hard edge — raised spine meets the deck shells (C8: raised here)', {'side': [6, 4, 9], 'front': [42, 43, 47, 48], 'top': [99, 100, 114, 113, 112, 102, 103, 101, 111]}, 'medium'),
 ('L4', 'Aft shoulder front edge', '? — where the aft shoulder wraps forward over the upper shell; TO BE SETTLED BY THE REAR DETAIL DRAWING', {'side': [2, 3], 'top': [95, 117]}, 'low'),
 ('L5', 'Upper shell (wing case) edge', 'O — the wing case lies over the flank; fades out at the front (open stroke)', {'side': [7, 8], 'front': [37, 40, 44, 39, 45], 'top': [94, 115]}, 'medium'),
 ('L6', 'Flank line', '? — shallow overlap fading out (C4), not a third plate', {'side': [10], 'front': [53, 59, 54, 58]}, 'low'),
 ('L7', 'Head brow crease', 'hard edge — top of the head bar, running back into the flank', {'side': [12], 'front': [49, 46], 'top': [97, 116]}, 'medium'),
 ('L8', 'Head underside / collar', 'E — underside of the head and the lip above the glass', {'side': [24, 25], 'front': [52, 55, 56]}, 'medium'),
 ('L9', 'Mid-ship bulge edge', 'E — where the buried side bulge emerges from the flank', {'top': [92, 93, 121, 122]}, 'low'),
 ('L10', 'Engine surround opening', 'opening edge — the carrier sits inside it', {'rear': [71, 72, 74, 80, 81], 'top': [98, 109]}, 'high'),
]
out = []
pic = Image.open(SHEET).convert('RGB').point(lambda v: 170 + v // 3); d = ImageDraw.Draw(pic)
f = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 11)
COL = [(200, 30, 30), (30, 90, 200), (20, 140, 60), (150, 60, 170), (230, 110, 0), (0, 140, 150), (120, 80, 30), (210, 40, 140), (90, 90, 90), (20, 20, 20)]
for k, (lid, name, meaning, views, conf) in enumerate(LINES):
    rec = {'id': lid, 'name': name, 'meaning': meaning, 'confidence': conf, 'views': {}}
    for view, ids in views.items():
        rec['views'][view] = [{'stroke': i, 'px': S[i]['poly'], 'm': [to_m(view, p) for p in S[i]['poly']]} for i in ids]
        for i in ids:
            d.line([tuple(p) for p in S[i]['poly']], fill=COL[k], width=3)
        p = S[ids[0]]['poly'][len(S[ids[0]]['poly']) // 2]; w = d.textlength(lid, font=f)
        d.rectangle((p[0] - w / 2 - 2, p[1] - 7, p[0] + w / 2 + 2, p[1] + 7), fill=(255, 255, 255), outline=COL[k]); d.text((p[0] - w / 2, p[1] - 7), lid, fill=COL[k], font=f)
    out.append(rec)
json.dump({'registration': REG, 'lines': out}, open('lines.json', 'w'))
pic.crop((90, 50, 1900, 410)).resize((3620, 720)).save('lines-r10.png')
print(len(out), 'lines')
