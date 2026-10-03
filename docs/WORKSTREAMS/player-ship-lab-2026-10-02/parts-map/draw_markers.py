"""Draw numbered part markers on concept sheet r10 (sheet pixel coords). Draft parts map for the player ship."""
from PIL import Image, ImageDraw, ImageFont
import sys
SHEET = '/home/ax/projects/well-dipper-trunk/.astra/jobs/20261002-151739-player-ship-ext-v3/out/player-ship-ext-sheet.png'
M = {  # part number -> list of (x, y) on the sheet
 1: [(225, 205), (887, 165), (1525, 260)],          # spine, front segment
 2: [(430, 118), (887, 112), (1665, 260)],          # spine, rear segment
 3: [(480, 165), (842, 205), (1590, 222)],                      # upper deck shell
 4: [(320, 248), (785, 178)],                       # lower deck shell
 5: [(185, 302), (885, 252), (1460, 220)],          # head / snout
 6: [(612, 215), (1880, 200)],                      # rear lobe
 7: [(1680, 128), (1680, 395)],                     # mid-ship side bulges (top view only?)
 8: [(165, 352), (888, 345), (1430, 265)],          # bubble + frame
 9: [(305, 315), (775, 300), (1105, 300), (1610, 148)], # underslung modules
 10: [(355, 383)],                                  # belly pod
 11: [(475, 330), (1215, 342)],                     # hatch
 12: [(1215, 230), (1848, 265)],                    # engine block + nozzles
 13: [(122, 297), (595, 152), (955, 250)],          # manoeuvring thrusters (examples)
}
im = Image.open(SHEET).convert('RGB'); d = ImageDraw.Draw(im)
try: f = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 15)
except OSError: f = ImageFont.load_default()
for n, pts in M.items():
    for x, y in pts:
        d.ellipse((x-12, y-12, x+12, y+12), fill=(20, 20, 20), outline=(255, 255, 255), width=2)
        t = str(n); w = d.textlength(t, font=f); d.text((x-w/2, y-9), t, fill=(255, 255, 255), font=f)
im.crop((0, 40, 1942, 470)).save(sys.argv[1] if len(sys.argv) > 1 else 'parts-map-r10.png')
