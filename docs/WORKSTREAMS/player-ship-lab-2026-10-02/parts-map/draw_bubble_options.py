"""C1 picture: r10 front view with the two bubble-size options outlined."""
from PIL import Image, ImageDraw, ImageFont
SHEET = '/home/ax/projects/well-dipper-trunk/.astra/jobs/20261002-151739-player-ship-ext-v3/out/player-ship-ext-sheet.png'
s = Image.open(SHEET).convert('RGB').crop((740, 80, 1060, 405))
f = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 14)
pxm = 29.39 / 1.09                     # front-view pixels per metre after registration
cx, top = 891 - 740, 270 - 80          # bubble centre x, bubble top y (crop coords)
def panel(w_m, h_m, label, col):
    im = s.copy(); d = ImageDraw.Draw(im)
    w, h = w_m * pxm, h_m * pxm
    d.rounded_rectangle((cx - w/2, top, cx + w/2, top + h), radius=10, outline=col, width=4)
    im = im.resize((im.width * 2, im.height * 2))
    out = Image.new('RGB', (im.width, im.height + 40), 'white'); out.paste(im, (0, 40))
    ImageDraw.Draw(out).text((10, 10), label, fill=col, font=f); return out
a = panel(5.1, 4.2, 'A: as drawn in the front view (~5.1 x 4.2 m)', (200, 30, 30))
b = panel(3.0, 2.6, 'B: side view + label (~3.0 x 2.6 m)', (30, 80, 200))
c = Image.new('RGB', (a.width * 2 + 30, a.height), 'white'); c.paste(a, (0, 0)); c.paste(b, (a.width + 30, 0))
c.save('bubble-options-c1.png')
