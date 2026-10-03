"""Extract the interior line strokes of each r10 view (ink inside the ship's outline), thin them, number them, and
write strokes.json (id, view, pixel polyline in sheet coords, length) plus strokes-r10.png for labelling."""
import json
import numpy as np
from PIL import Image, ImageDraw, ImageFont
from scipy import ndimage
SHEET = '/home/ax/projects/well-dipper-trunk/.astra/jobs/20261002-151739-player-ship-ext-v3/out/player-ship-ext-sheet.png'
VIEWS = {'side': (105, 60, 700, 400), 'front': (745, 85, 1060, 400), 'rear': (1065, 85, 1365, 400), 'top': (1390, 110, 1890, 400)}
a = np.asarray(Image.open(SHEET).convert('RGB')).astype(int)

def thin(m):  # Zhang-Suen thinning (no skimage here)
    m = m.copy().astype(np.uint8)
    while True:
        changed = False
        for step in (0, 1):
            P = np.pad(m, 1)
            n = [P[:-2, 1:-1], P[:-2, 2:], P[1:-1, 2:], P[2:, 2:], P[2:, 1:-1], P[2:, :-2], P[1:-1, :-2], P[:-2, :-2]]
            B = sum(n); A = sum(((n[i] == 0) & (n[(i + 1) % 8] == 1)) for i in range(8))
            c = (n[0] * n[2] * n[4] == 0) & (n[2] * n[4] * n[6] == 0) if step == 0 else (n[0] * n[2] * n[6] == 0) & (n[0] * n[4] * n[6] == 0)
            d = (m == 1) & (B >= 2) & (B <= 6) & (A == 1) & c
            if d.any(): m[d] = 0; changed = True
        if not changed: return m.astype(bool)

def order(ys, xs):  # greedy walk from one end so the polyline is ordered
    pts = list(zip(xs.tolist(), ys.tolist())); s = set(pts)
    deg = {p: sum((p[0] + dx, p[1] + dy) in s for dx in (-1, 0, 1) for dy in (-1, 0, 1) if dx or dy) for p in pts}
    cur = min(pts, key=lambda p: (deg[p], p)); seen = {cur}; path = [cur]
    while True:
        nb = [(cur[0] + dx, cur[1] + dy) for dx in (-1, 0, 1) for dy in (-1, 0, 1) if (dx or dy) and (cur[0] + dx, cur[1] + dy) in s and (cur[0] + dx, cur[1] + dy) not in seen]
        if not nb: break
        cur = nb[0]; seen.add(cur); path.append(cur)
    return path[::3] + [path[-1]]

out, sid = [], 0
pic = Image.open(SHEET).convert('RGB').point(lambda v: 200 + v // 5); d = ImageDraw.Draw(pic)
f = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 10)
rng = np.random.default_rng(3)
for view, (x0, y0, x1, y1) in VIEWS.items():
    s = a[y0:y1, x0:x1]; ink = s.max(2) < 165
    body = ndimage.binary_fill_holes(ndimage.binary_closing(s.sum(2) < 720, iterations=3))
    lab0, n0 = ndimage.label(body); body = lab0 == (np.argmax(ndimage.sum(body, lab0, range(1, n0 + 1))) + 1)
    inner = thin(ink & ndimage.binary_erosion(body, iterations=3))
    # break the skeleton at junctions (pixels with 3+ neighbours) so each branch becomes its own stroke
    nbc = ndimage.convolve(inner.astype(int), np.ones((3, 3), int), mode='constant') - inner
    inner = inner & ~ndimage.binary_dilation(inner & (nbc >= 3), iterations=1)
    lab, n = ndimage.label(inner, structure=np.ones((3, 3)))
    for i in range(1, n + 1):
        ys, xs = np.where(lab == i)
        if len(xs) < 25: continue
        sid += 1; poly = [[int(x) + x0, int(y) + y0] for x, y in order(ys, xs)]
        out.append({'id': sid, 'view': view, 'length_px': int(len(xs)), 'poly': poly})
        col = tuple(int(c) for c in rng.integers(0, 170, 3))
        d.line([tuple(p) for p in poly], fill=col, width=2)
        mx, my = poly[len(poly) // 2]; t = str(sid); w = d.textlength(t, font=f)
        d.rectangle((mx - w / 2 - 2, my - 6, mx + w / 2 + 2, my + 6), fill=(255, 255, 255), outline=col); d.text((mx - w / 2, my - 6), t, fill=col, font=f)
json.dump(out, open('strokes.json', 'w'))
pic.crop((90, 50, 1900, 410)).resize((3620, 720)).save('strokes-r10.png')
from collections import Counter; print(len(out), Counter(o['view'] for o in out))
