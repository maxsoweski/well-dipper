"""Label r10's own rear crops (r10-rear-crops.png) with how the rear is built — no redraw, so no drift."""
from PIL import Image, ImageDraw, ImageFont
im = Image.open('r10-rear-crops.png').convert('RGB'); W, H = im.size
c = Image.new('RGB', (W, H + 430), (250, 249, 245)); c.paste(im, (0, 0)); d = ImageDraw.Draw(c)
f = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 26); g = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 24)
R = (200, 20, 60); k = 1.245; P = lambda x, y: (int(x * k), int(y * k))
def tag(txt, at, to):
    d.line([at, to], fill=R, width=4); d.ellipse((to[0] - 7, to[1] - 7, to[0] + 7, to[1] + 7), fill=R)
    w = d.textlength(txt, font=f); d.rectangle((at[0] - 6, at[1] - 18, at[0] + w + 6, at[1] + 18), fill=(255, 255, 255), outline=R, width=2); d.text((at[0], at[1] - 15), txt, fill=R, font=f)
tag('A  ENGINE SURROUND (frame)', P(150, 10), P(180, 420))
tag('B  LIP = top of the surround, rounded, overhangs C', P(250, 175), P(300, 195))
tag('C  ENGINE CARRIER, recessed', P(560, 600), P(420, 520))
tag('D  AFT SHOULDER rolls (wrap round A)', P(30, 330), P(95, 330))
tag('E  SPINE end (steps down onto D)', P(470, 60), P(400, 90))
tag('D  AFT SHOULDER (big rounded rear mass)', P(1090, 60), P(1210, 200))
tag('F  UPPER SHELL edge tucks UNDER D', P(800, 250), P(1000, 280))
tag('G  FLANK line ends against D', P(800, 470), P(1180, 500))
tag('A+C at the tail = SHARED REAR PLANE', P(1440, 745), P(1870, 400))
tag('E  SPINE ends before D', P(1440, 805), P(1700, 380))
y = H + 20
for line in ["HOW THE REAR IS BUILT (read off r10; CC, 2026-10-03):",
 "1. The tail face is ONE plane: the engine carrier C sits recessed inside the thick rounded frame A; nothing sticks out behind A.",
 "2. B, the LIP, is simply A's top edge: a soft rounded brim that overhangs C. Not a separate plate, no sharp corner.",
 "3. D, the AFT SHOULDER, is one big rounded mass that wraps over the top and both sides of A (seen from behind as the stacked rolls).",
 "4. The deck shells (F, upper shell; G, flank) run back and tuck UNDER D — their edges end where they meet D. They do not pass through it.",
 "5. The spine E ends on top of D, stepping down; it does not reach the tail plane.",
 "6. Underslung modules stay under the belly, clear of A; the red hatch shown here is a module hatch, not part of the tail."]:
    d.text((30, y), line, fill=(20, 20, 20), font=f if line.startswith('HOW') else g); y += 52
c.save('r10-rear-annotated.png')
