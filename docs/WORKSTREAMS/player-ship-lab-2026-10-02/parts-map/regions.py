"""Split each r10 view into the flat-colour regions enclosed by its black linework, number them, and save a
region-ID picture plus regions.json (id, view, colour class, bbox, centroid, area, neighbours)."""
import json
import numpy as np
from PIL import Image, ImageDraw, ImageFont
from scipy import ndimage
SHEET = '/home/ax/projects/well-dipper-trunk/.astra/jobs/20261002-151739-player-ship-ext-v3/out/player-ship-ext-sheet.png'
VIEWS = {'side': (105, 60, 700, 400), 'front': (745, 85, 1060, 400), 'rear': (1065, 85, 1365, 400), 'top': (1390, 110, 1890, 400)}
CLASSES = {'yellow': (250, 215, 40), 'orange': (245, 130, 40), 'teal': (20, 175, 195), 'blue': (200, 225, 245),
           'cream': (250, 248, 235), 'grey': (140, 140, 140), 'dark': (50, 50, 55), 'red': (225, 45, 30), 'pink': (215, 30, 140)}
a = np.asarray(Image.open(SHEET).convert('RGB')).astype(int)
ink = a.max(2) < 90                                    # black outlines
regions, rid = [], 0
pic = Image.open(SHEET).convert('RGB'); d = ImageDraw.Draw(pic)
f = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 11)
for view, (x0, y0, x1, y1) in VIEWS.items():
    sub = a[y0:y1, x0:x1]; inks = ink[y0:y1, x0:x1]
    bg = sub.min(2) > 238
    lab, n = ndimage.label(~inks & ~bg)
    for i in range(1, n + 1):
        m = lab == i; area = int(m.sum())
        if area < 120: continue                       # skip specks, port rims and label letters
        ys, xs = np.where(m); col = sub[m].mean(0)
        cls = min(CLASSES, key=lambda k: np.abs(np.array(CLASSES[k]) - col).sum())
        rid += 1
        # neighbours: regions reachable across a thin ink line
        ring = ndimage.binary_dilation(m, iterations=4) & ~m
        nb = sorted(set(int(v) for v in np.unique(lab[ring]) if v and v != i))
        cy, cx = int(ys.mean()) + y0, int(xs.mean()) + x0
        if not m[cy - y0, cx - x0]:                    # centroid outside a curved region: use its deepest pixel
            dist = ndimage.distance_transform_edt(m); py, px = np.unravel_index(dist.argmax(), m.shape); cy, cx = int(py) + y0, int(px) + x0
        regions.append({'id': rid, 'view': view, 'class': cls, 'area': area, 'label_xy': [cx, cy], '_lab': i,
                        'bbox': [int(xs.min()) + x0, int(ys.min()) + y0, int(xs.max()) + x0, int(ys.max()) + y0], '_nb': nb})
    ids = {r['_lab']: r['id'] for r in regions if r['view'] == view}
    for r in regions:
        if r['view'] == view and '_nb' in r:
            r['neighbours'] = [ids[v] for v in r.pop('_nb') if v in ids]
for r in regions:
    r.pop('_lab', None); x, y = r['label_xy']; t = str(r['id']); w = d.textlength(t, font=f)
    d.rectangle((x - w/2 - 2, y - 7, x + w/2 + 2, y + 7), fill=(255, 255, 255), outline=(0, 0, 0))
    d.text((x - w/2, y - 6), t, fill=(0, 0, 0), font=f)
pic.crop((90, 50, 1900, 410)).resize((3620, 720)).save('regions-r10.png')
json.dump(regions, open('regions.json', 'w'), indent=1)
from collections import Counter
print(len(regions), Counter((r['view'], r['class']) for r in regions))
