// S4 disc-only cropper — reuses the S2 blind2 discipline: crop EVERY blind-relevant
// capture to the disc alone (NO GUI in frame) BEFORE any blind agent sees it (S2
// contamination lesson). Method: the disc silhouette is geometry-fixed and identical
// across all captures (same camera, worldRadius=1, canvas), centered at the image
// center. Radius from the true tangent-silhouette projection (proj[5]*tan(asin(R/d)))
// measured empirically at ~393px on the 2463x1060 dpr-1.25 frame; +4% margin. A fixed
// geometric box is used (not a per-image luminance bbox) because a global luminance
// bbox grabs the lil-gui panels at the frame edges (the exact S2 failure) and the disc
// night side is background-dark. GUI panels live at the far L/R edges; the ~818px
// centered box clears them. Corner-darkness asserted per image as a GUI-free guard.
import { PNG } from 'pngjs';
import fs from 'fs';
import path from 'path';

const DIR = path.dirname(new URL(import.meta.url).pathname);
const OUT = path.join(DIR, 'crops');
const NAMES = ['target-seed1','target-reroll1','target-reroll2','distractor-rocky','distractor-ocean','distractor-europa'];

const R_DISC = 393;          // measured true silhouette radius (px)
const MARGIN = 0.04;         // 4% margin
const HALF = Math.round(R_DISC * (1 + MARGIN));   // 409

function lum(d,i){ return 0.299*d[i]+0.587*d[i+1]+0.114*d[i+2]; }

const report = [];
for (const name of NAMES) {
  const src = PNG.sync.read(fs.readFileSync(path.join(DIR, name + '.png')));
  const { width:W, height:H, data } = src;
  const cx = Math.round(W/2), cy = Math.round(H/2);
  const x0 = cx - HALF, y0 = cy - HALF, size = HALF*2;
  if (x0 < 0 || y0 < 0 || x0+size > W || y0+size > H) throw new Error('crop box out of bounds for '+name);
  const out = new PNG({ width: size, height: size });
  for (let y=0; y<size; y++) for (let x=0; x<size; x++) {
    const si = ((y0+y)*W + (x0+x))*4;
    const di = (y*size + x)*4;
    out.data[di]=data[si]; out.data[di+1]=data[si+1]; out.data[di+2]=data[si+2]; out.data[di+3]=data[si+3];
  }
  // GUI-free guard: the 4 corners sit OUTSIDE the disc circle -> must be background-dark.
  const corners = [[0,0],[size-1,0],[0,size-1],[size-1,size-1]].map(([x,y])=>Math.round(lum(out.data,(y*size+x)*4)));
  const maxCorner = Math.max(...corners);
  fs.writeFileSync(path.join(OUT, name + '.crop.png'), PNG.sync.write(out));
  report.push({ name, cropBox:[x0,y0,size,size], corners, maxCorner, guiFree: maxCorner < 20 });
}
console.log(JSON.stringify({ R_DISC, marginPct: MARGIN*100, half: HALF, cropSize: HALF*2, images: report }, null, 2));
