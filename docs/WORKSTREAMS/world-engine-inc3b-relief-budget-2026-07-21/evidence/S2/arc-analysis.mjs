// arc-analysis.mjs — S2 read-gate #1, ARC-ASYMMETRY HARNESS (Inc-3b relief-variance budget).
//
// FROZEN BAR (calibration/read-gate-thresholds.json .arc, immutable — feedback_perceptual-read-gate-before-uat):
//   ≥ populationFraction (0.70) of the ≥-median lit-disc stamps show a light-consistent wall-half luminance
//   asymmetry of ≥ geqOneBandMagnitude (1 posterize band = 255/6 ≈ 42.5 in 8-bit) — centres from the
//   RNG-neutral probe — at the staged oblique light; PASS on the seed-1 render, re-rolls reported alongside.
//   PLUS the post-flip dark-clip guard (re-baseline darkClipFrac1 + spread → derive toleranceFrac).
//
// METHOD (pure node, deterministic, no network; pngjs from the repo node_modules):
//   1. STAMP GEOMETRY — RNG-NEUTRAL PROBE (read-only re-enumeration, byte-fence-safe): rebuild the EXACT
//      production carrier mesh buildIrregularSphere(40000, 4) [radius-independent → built once], derive the
//      condition vector at the RECORDED DRAWN radius (R3 live), and RE-RUN forEachCrater(cond, macroSeed, N, cb)
//      — the writer's own single entropy source — to read back every stamp's centre vertex index, angular
//      diameter δ, D_km, tI. macroSeed is taken from the per-capture state JSON (seed-1 used the boot default
//      macroSeed=1, NOT alea('draw:macro:'+worldSeed) — verified; the re-rolls' recorded macroSeeds DO match
//      that derivation). This adds ZERO RNG to any writer path.
//   2. PROJECT each stamp centre (unit vertex dir verts[centre]) through the recorded mesh matrixWorld (identity)
//      + camera matrixWorldInverse + projectionMatrix to a pixel; keep stamps on the visible (dot(n,camPos)>1)
//      AND lit (dot(n,L)>0) hemisphere. L = staged light dir = normalize(cosEl·sinAz, sinEl, cosEl·cosAz).
//   3. MEDIAN GATE (frozen GUESSED size gate, applied AS FROZEN): among lit-disc stamps, take the ≥-median-δ
//      subset. For each, measure the light-consistent wall-half asymmetry over the INTERIOR-WALL annulus
//      [FLOOR_FRAC·r, r] = [0.5, 1.0]·r_proj (r = δ/2; craterProfile: flat floor ends at 0.5r, rim crest at r):
//      luminance (Rec.601) mean of the DOWN-LIGHT half (the shadowed near wall — the disc half on the SUN-facing
//      side, offset·ŝ>0 where ŝ is the per-crater sunward screen dir) vs the UP-LIGHT half (the lit far wall,
//      anti-sun side). Asymmetry COUNTS when down-light half is DARKER by ≥ geqOneBandMagnitude (42.5).
//      [Wall-half naming resolved from crater physics: for a concave bowl at oblique light the interior wall on
//       the SUN-facing side is shadowed (its normal points away from the sun) and the anti-sun interior wall is
//       lit — so the DOWN-LIGHT (shadowed) half sits on the sun-facing side of the disc. See methodsNotes.]
//   4. BAR: fraction = counted / (#≥-median lit-disc); PASS iff seed-1 ≥ 0.70.
//   5. DARK-CLIP RE-BASELINE: darkClipFrac = (disc pixels at luminance 0)/(disc pixels) via ray-sphere disc mask,
//      per render; darkClipFrac1 = mean over the 3 targets, σ = spread; toleranceFrac = max(2σ, ditherFloor).
//   6. arc-report.json written deterministically.
//
// HONESTY: if projection cannot be aligned, result.evaluable=false with the specific evidence — never substitute
// detected-blob centres, never fudge. Alignment is sanity-checked first (sub-cam self-test + largest-basin land).

import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { PNG } from 'pngjs';
import alea from 'alea';
import { craterSchedule, isImpactSurface, forEachCrater } from '../../../../../src/worldengine/base/bombardment.js';
import { DRIVER_PRESETS } from '../../../../../driver-presets.js';
import { deriveConditionVector } from '../../../../../src/worldengine/base/conditionVector.js';
import { deriveUniforms } from '../../../../../src/worldengine/base/labCore.js';
import { buildIrregularSphere } from '../../../../../planet-lod-rivers.js';

const HERE = dirname(fileURLToPath(import.meta.url));

// ── FROZEN thresholds (read from the immutable calibration file — never re-chosen here) ──────────────────
const THRESH = JSON.parse(fs.readFileSync(join(HERE, '..', '..', 'calibration', 'read-gate-thresholds.json')));
const ARC = THRESH.arc;
const BAND_255      = 255 / THRESH.lightStaging.posterizeLevels;   // 1 posterize band in 8-bit = 42.5
const GEQ_BAND      = BAND_255;                                    // geqOneBandMagnitude (0.1666… normalized ⇒ 42.5/255)
const POP_FRACTION  = ARC.populationFraction.value;               // 0.70 (frozen JUSTIFIED)
// crater-profile constants (bombardment.js: FLOOR_FRAC=0.5 ⇒ interior wall = [0.5,1.0]·r)
const ANN_INNER = 0.5, ANN_OUTER = 1.0;
const MIN_HALF_PX = 8;   // measurement floor: a half-annulus needs ≥8 disc pixels to yield a mean

// ── linear algebra (three.js .elements are COLUMN-MAJOR: element(row,col)=m[col*4+row]) ──────────────────
const mv4 = (m, x, y, z, w) => [
  m[0]*x + m[4]*y + m[8]*z  + m[12]*w,
  m[1]*x + m[5]*y + m[9]*z  + m[13]*w,
  m[2]*x + m[6]*y + m[10]*z + m[14]*w,
  m[3]*x + m[7]*y + m[11]*z + m[15]*w,
];
const norm3 = (v) => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0]/l, v[1]/l, v[2]/l]; };
const dot3  = (a, b) => a[0]*b[0] + a[1]*b[1] + a[2]*b[2];
const mean  = (xs) => xs.reduce((s, x) => s + x, 0) / xs.length;
const std   = (xs) => { const m = mean(xs); return Math.sqrt(xs.reduce((s, x) => s + (x-m)**2, 0) / xs.length); };

// ── SHARED production carrier mesh (radius-independent; built once) ───────────────────────────────────────
const t0 = Date.now();
const mesh = buildIrregularSphere(40000, 4);   // == createRiverOverlay ensureMesh (TARGET_N=40000, LLOYD_ITERS=4)
const VERTS = mesh.verts, N = VERTS.length;
const meshMs = Date.now() - t0;

const FP = DRIVER_PRESETS['Moon/Mercury (impact-airless)'];
const CAPS = ['target-seed1', 'target-reroll1', 'target-reroll2'];

// ── per-capture projector built from the recorded matrices ───────────────────────────────────────────────
function makeProjector(state, W, H) {
  const P = state.camera.projectionMatrix;
  const V = state.camera.matrixWorldInverse;       // = view matrix
  const cam = state.camera.position;
  const wr = state.planetMesh.worldRadius;
  const P00 = P[0], P11 = P[5];
  // project a WORLD point → { x, y (pixels, y-down), w (clip w; >0 in front) }
  const project = (wx, wy, wz) => {
    const vv = mv4(V, wx, wy, wz, 1);
    const cc = mv4(P, vv[0], vv[1], vv[2], vv[3]);
    const ndcx = cc[0] / cc[3], ndcy = cc[1] / cc[3];
    return { x: (ndcx * 0.5 + 0.5) * W, y: (0.5 - ndcy * 0.5) * H, w: cc[3] };
  };
  // world ray for a pixel centre (rotation of view ray by cameraWorld = (V3x3)^T ⇒ rows of V) → ray-sphere disc test
  const O2 = cam[0]*cam[0] + cam[1]*cam[1] + cam[2]*cam[2];
  const rayHitsDisc = (px, py) => {
    const ndcx = ((px + 0.5) / W) * 2 - 1;
    const ndcy = 1 - ((py + 0.5) / H) * 2;
    const dv = [ndcx / P00, ndcy / P11, -1];
    let d = [ V[0]*dv[0] + V[1]*dv[1] + V[2]*dv[2],
              V[4]*dv[0] + V[5]*dv[1] + V[6]*dv[2],
              V[8]*dv[0] + V[9]*dv[1] + V[10]*dv[2] ];
    d = norm3(d);
    const b = 2 * (cam[0]*d[0] + cam[1]*d[1] + cam[2]*d[2]);
    const c = O2 - wr * wr;
    const disc = b*b - 4*c;                 // a = 1
    if (disc < 0) return false;
    const t = (-b - Math.sqrt(disc)) / 2;   // nearest intersection
    return t > 0;
  };
  return { project, rayHitsDisc, cam, wr };
}

function lumAt(png, px, py) {
  const x = Math.round(px), y = Math.round(py);
  if (x < 0 || y < 0 || x >= png.width || y >= png.height) return -1;
  const i = (y * png.width + x) * 4;
  return 0.299 * png.data[i] + 0.587 * png.data[i+1] + 0.114 * png.data[i+2];
}

// ── main per-capture analysis ────────────────────────────────────────────────────────────────────────────
const renders = [];
for (const cap of CAPS) {
  const state = JSON.parse(fs.readFileSync(join(HERE, `${cap}.state.json`)));
  const png = PNG.sync.read(fs.readFileSync(join(HERE, `${cap}.png`)));
  const W = png.width, H = png.height;
  const proj = makeProjector(state, W, H);
  const wr = proj.wr, cam = proj.cam;

  // macroSeed check (recorded vs derived) — report, use RECORDED
  const macroSeedRecorded = state.macroSeed;
  const macroSeedDerived  = Math.floor(alea('draw:macro:' + state.worldSeed)() * 10000);

  // condition at the RECORDED DRAWN radius (R3 live — NOT canonical)
  const cond = deriveConditionVector(FP, deriveUniforms(FP, 1.0), state.planetRadiusEarth);
  const sched = craterSchedule(cond);

  // staged light dir (world; matrixWorld identity ⇒ same frame as vertex dirs)
  const az = state.lightAzimuthDeg * Math.PI / 180, el = state.lightElevationDeg * Math.PI / 180, ce = Math.cos(el);
  const L = norm3([ce * Math.sin(az), Math.sin(el), ce * Math.cos(az)]);

  // ── RNG-NEUTRAL re-enumeration of the stamp population ──
  const stamps = [];
  forEachCrater(cond, macroSeedRecorded, N, (centre, delta, tI, D_km) => {
    stamps.push({ centre, delta, D_km, tI });
  });
  const nStamp = stamps.length;

  // ── project + classify visibility/lit ──
  const camDir = norm3(cam);
  for (const s of stamps) {
    const n = VERTS[s.centre];                       // unit vertex direction (crater centre)
    s.n = n;
    s.dotCam = dot3(n, cam);                          // > 1 ⇒ in front of the horizon
    s.dotL   = dot3(n, L);                            // > 0 ⇒ lit
    s.visible = s.dotCam > 1;
    s.lit = s.dotL > 0;
    const pc = proj.project(n[0]*wr, n[1]*wr, n[2]*wr);
    s.cx = pc.x; s.cy = pc.y; s.wclip = pc.w;
    // projected rim radius r_proj: project a point at angular offset r = δ/2 along a tangent (avg of 2 tangents)
    const r = 0.5 * s.delta;
    // build two orthonormal tangents at n
    let t1 = norm3(Math.abs(n[1]) < 0.9 ? [n[2], 0, -n[0]] : [1, 0, 0]);   // perp to n
    t1 = norm3([t1[0] - dot3(t1, n)*n[0], t1[1] - dot3(t1, n)*n[1], t1[2] - dot3(t1, n)*n[2]]);
    const t2 = norm3([ n[1]*t1[2]-n[2]*t1[1], n[2]*t1[0]-n[0]*t1[2], n[0]*t1[1]-n[1]*t1[0] ]);
    const rimPx = (tan) => {
      const rd = norm3([n[0]*Math.cos(r)+tan[0]*Math.sin(r), n[1]*Math.cos(r)+tan[1]*Math.sin(r), n[2]*Math.cos(r)+tan[2]*Math.sin(r)]);
      const p = proj.project(rd[0]*wr, rd[1]*wr, rd[2]*wr);
      return Math.hypot(p.x - s.cx, p.y - s.cy);
    };
    s.rProj = 0.25 * (rimPx(t1) + rimPx([-t1[0],-t1[1],-t1[2]]) + rimPx(t2) + rimPx([-t2[0],-t2[1],-t2[2]]));
    // per-crater sunward screen direction ŝ (points TOWARD the sun in pixel space)
    const dLn = dot3(L, n);
    const tSun = [L[0]-dLn*n[0], L[1]-dLn*n[1], L[2]-dLn*n[2]];
    const tSl = Math.hypot(...tSun);
    if (tSl > 1e-9) {
      const tHat = [tSun[0]/tSl, tSun[1]/tSl, tSun[2]/tSl];
      const bd = norm3([n[0]+1e-3*tHat[0], n[1]+1e-3*tHat[1], n[2]+1e-3*tHat[2]]);
      const bp = proj.project(bd[0]*wr, bd[1]*wr, bd[2]*wr);
      const sv = [bp.x - s.cx, bp.y - s.cy]; const svl = Math.hypot(sv[0], sv[1]) || 1;
      s.sHat = [sv[0]/svl, sv[1]/svl];
    } else { s.sHat = null; }
  }

  // ── disc mask (ray-sphere) for darkClip + annulus disc-restriction ──
  let discCount = 0, darkDiscCount = 0, band1DiscCount = 0, litDiscCount = 0, litDarkCount = 0;
  const discMask = new Uint8Array(W * H);
  for (let py = 0; py < H; py++) {
    for (let px = 0; px < W; px++) {
      if (!proj.rayHitsDisc(px, py)) continue;
      const idx = py * W + px;
      discMask[idx] = 1; discCount++;
      const i = idx * 4;
      const lum = 0.299 * png.data[i] + 0.587 * png.data[i+1] + 0.114 * png.data[i+2];
      if (lum === 0) darkDiscCount++;
      else if (lum <= BAND_255) band1DiscCount++;   // one dither-band from clipping
      // lit-only variant: is this disc pixel on the lit hemisphere? (recover surface normal via ray-sphere hit)
      // cheap proxy: sample is "lit" if lum>0 OR within band — but for the lit-only darkClip we recompute the
      // surface point normal below only if needed; here we approximate lit via geometry:
    }
  }
  // lit-only darkClip: recompute per disc pixel whether the surface point normal faces the light
  for (let py = 0; py < H; py++) {
    for (let px = 0; px < W; px++) {
      const idx = py * W + px; if (!discMask[idx]) continue;
      // surface point = nearest ray-sphere hit
      const ndcx = ((px + 0.5) / W) * 2 - 1, ndcy = 1 - ((py + 0.5) / H) * 2;
      const P00 = state.camera.projectionMatrix[0], P11 = state.camera.projectionMatrix[5], V = state.camera.matrixWorldInverse;
      const dv = [ndcx / P00, ndcy / P11, -1];
      let d = norm3([ V[0]*dv[0]+V[1]*dv[1]+V[2]*dv[2], V[4]*dv[0]+V[5]*dv[1]+V[6]*dv[2], V[8]*dv[0]+V[9]*dv[1]+V[10]*dv[2] ]);
      const b = 2*(cam[0]*d[0]+cam[1]*d[1]+cam[2]*d[2]); const c = (cam[0]**2+cam[1]**2+cam[2]**2) - wr*wr;
      const disc = b*b - 4*c; if (disc < 0) continue; const t = (-b - Math.sqrt(disc))/2; if (t <= 0) continue;
      const hp = norm3([cam[0]+t*d[0], cam[1]+t*d[1], cam[2]+t*d[2]]);
      if (dot3(hp, L) > 0) { litDiscCount++; const i = idx*4; const lum = 0.299*png.data[i]+0.587*png.data[i+1]+0.114*png.data[i+2]; if (lum === 0) litDarkCount++; }
    }
  }
  const darkClipFrac = discCount ? darkDiscCount / discCount : 0;
  const ditherBand1Frac = discCount ? band1DiscCount / discCount : 0;
  const litDarkClipFrac = litDiscCount ? litDarkCount / litDiscCount : 0;

  // ── median gate over lit-disc stamps ──
  const litDisc = stamps.filter(s => s.visible && s.lit);
  const deltasSorted = litDisc.map(s => s.delta).sort((a, b) => a - b);
  const medianDelta = deltasSorted.length ? deltasSorted[Math.floor((deltasSorted.length - 1) / 2)] : Infinity;
  const geMedian = litDisc.filter(s => s.delta >= medianDelta);

  // disc radius in pixels (for the discrete-crater DIAGNOSTIC partition — NOT part of the frozen bar)
  const discRadiusPx = 0.5 * (state.derived?.discFracHeight ?? 0.7) * H;
  const DISCRETE_RPROJ = 0.35 * discRadiusPx;   // a crater is a "discrete near-side feature" if its rim fits within 35% of the disc radius

  // ── measure wall-half asymmetry over the ≥-median lit-disc subset (THE FROZEN BAR) ──
  //    + parallel DIAGNOSTIC counters (discrete-crater subset; all-lit-disc) — clearly labelled, NOT the verdict.
  const measureStamp = (s) => {
    if (!s.sHat || !Number.isFinite(s.rProj) || s.rProj < 2) return null;
    const rOut = s.rProj * ANN_OUTER, rIn = s.rProj * ANN_INNER;
    const x0 = Math.max(0, Math.floor(s.cx - rOut)), x1 = Math.min(W - 1, Math.ceil(s.cx + rOut));
    const y0 = Math.max(0, Math.floor(s.cy - rOut)), y1 = Math.min(H - 1, Math.ceil(s.cy + rOut));
    let sumDown = 0, nDown = 0, sumUp = 0, nUp = 0;
    for (let py = y0; py <= y1; py++) for (let px = x0; px <= x1; px++) {
      if (!discMask[py * W + px]) continue;                       // restrict to the disc (no background bleed)
      const ox = px - s.cx, oy = py - s.cy;
      const dist = Math.hypot(ox, oy);
      if (dist < rIn || dist > rOut) continue;
      const dotS = ox * s.sHat[0] + oy * s.sHat[1];               // >0 ⇒ sun-facing half = DOWN-LIGHT (shadowed near wall)
      const i = (py * W + px) * 4;
      const lum = 0.299 * png.data[i] + 0.587 * png.data[i+1] + 0.114 * png.data[i+2];
      if (dotS > 0) { sumDown += lum; nDown++; }
      else if (dotS < 0) { sumUp += lum; nUp++; }
    }
    if (nDown < MIN_HALF_PX || nUp < MIN_HALF_PX) return null;
    const lumDown = sumDown / nDown, lumUp = sumUp / nUp;
    return { lumDown, lumUp, asym: (lumUp - lumDown) >= GEQ_BAND, nDown, nUp };
  };

  // FROZEN BAR: ≥-median lit-disc subset
  let counted = 0, measured = 0, discardedUnmeasurable = 0;
  // DIAGNOSTICS (non-bar): discrete-crater subset of ≥-median; and all lit-disc
  let diagDiscreteCounted = 0, diagDiscreteMeasured = 0, oversizedInGeMedian = 0;
  let diagAllCounted = 0, diagAllMeasured = 0;
  const perStamp = [];
  for (const s of geMedian) {
    const m = measureStamp(s);
    if (!m) { discardedUnmeasurable++; continue; }
    measured++; if (m.asym) counted++;
    const discrete = s.rProj <= DISCRETE_RPROJ;
    if (discrete) { diagDiscreteMeasured++; if (m.asym) diagDiscreteCounted++; } else { oversizedInGeMedian++; }
    perStamp.push({ centre: s.centre, D_km: +s.D_km.toFixed(2), deltaDeg: +(s.delta*180/Math.PI).toFixed(3),
                    cx: +s.cx.toFixed(1), cy: +s.cy.toFixed(1), rProj: +s.rProj.toFixed(1), discrete,
                    lumDown: +m.lumDown.toFixed(1), lumUp: +m.lumUp.toFixed(1), diff: +(m.lumUp-m.lumDown).toFixed(1),
                    nDown: m.nDown, nUp: m.nUp, asym: m.asym });
  }
  for (const s of litDisc) { const m = measureStamp(s); if (m) { diagAllMeasured++; if (m.asym) diagAllCounted++; } }
  const denom = measured;   // measurable ≥-median lit-disc stamps
  const asymFraction = denom ? counted / denom : 0;
  const diagDiscreteFraction = diagDiscreteMeasured ? diagDiscreteCounted / diagDiscreteMeasured : 0;
  const diagAllFraction = diagAllMeasured ? diagAllCounted / diagAllMeasured : 0;

  // ── GRADIENT-CONTROLLED / NOISE-AWARE diagnostics (NOT the bar) — answers "do craters carry ≥1-band
  //    light-consistent wall contrast?" robustly. detrend: least-squares plane subtracted from the annulus
  //    (removes the global disc-illumination gradient) then residual half-mean diff (noise-averaged). peak:
  //    90th-pct anti-sun minus 10th-pct sun (gradient-robust but dither-sensitive). A FLAT-terrain control
  //    (lit non-crater points) calibrates the noise floor of both. ──
  const pctl = (arr, p) => { if (!arr.length) return NaN; const a = arr.slice().sort((x, y) => x - y); return a[Math.min(a.length-1, Math.floor(p*a.length))]; };
  const richMeasure = (cx, cy, rP, sHat) => {
    if (!sHat || !Number.isFinite(rP) || rP < 2) return null;
    const rOut = rP, rIn = rP * ANN_INNER;
    const pts = []; const upL = [], dnL = [];
    for (let py = Math.floor(cy-rOut); py <= Math.ceil(cy+rOut); py++) for (let px = Math.floor(cx-rOut); px <= Math.ceil(cx+rOut); px++) {
      if (px<0||py<0||px>=W||py>=H) continue; if (!discMask[py*W+px]) continue;
      const ox = px-cx, oy = py-cy, d = Math.hypot(ox, oy); if (d < rIn || d > rOut) continue;
      const i=(py*W+px)*4; const l = 0.299*png.data[i]+0.587*png.data[i+1]+0.114*png.data[i+2];
      pts.push([ox, oy, l]); const ds = ox*sHat[0]+oy*sHat[1]; if (ds>0) dnL.push(l); else if (ds<0) upL.push(l);
    }
    if (pts.length < 20 || upL.length < MIN_HALF_PX || dnL.length < MIN_HALF_PX) return null;
    // LS plane l = a*ox+b*oy+c
    let Sxx=0,Sxy=0,Syy=0,Sx=0,Sy=0,S1=0,Sxl=0,Syl=0,Sl=0;
    for (const [x,y,l] of pts){Sxx+=x*x;Sxy+=x*y;Syy+=y*y;Sx+=x;Sy+=y;S1++;Sxl+=x*l;Syl+=y*l;Sl+=l;}
    const M=[[Sxx,Sxy,Sx],[Sxy,Syy,Sy],[Sx,Sy,S1]], rhs=[Sxl,Syl,Sl];
    const det3=(m)=>m[0][0]*(m[1][1]*m[2][2]-m[1][2]*m[2][1])-m[0][1]*(m[1][0]*m[2][2]-m[1][2]*m[2][0])+m[0][2]*(m[1][0]*m[2][1]-m[1][1]*m[2][0]);
    const D0=det3(M); if (Math.abs(D0)<1e-6) return null;
    const rep=(m,c,v)=>m.map((row,i)=>row.map((x,j)=>j===c?v[i]:x));
    const a=det3(rep(M,0,rhs))/D0, b=det3(rep(M,1,rhs))/D0, c=det3(rep(M,2,rhs))/D0;
    let su=0,nu=0,sd=0,nd=0;
    for (const [x,y,l] of pts){ const res=l-(a*x+b*y+c); const ds=x*sHat[0]+y*sHat[1]; if(ds>0){sd+=res;nd++;}else if(ds<0){su+=res;nu++;} }
    const detrendDiff = (su/nu) - (sd/nd);   // up(anti-sun) − down(sun); >0 ⇒ sun-side shadowed (crater sign)
    const peakDiff = pctl(upL, 0.9) - pctl(dnL, 0.1);
    return { detrendDiff, peakDiff };
  };
  const geRich = geMedian.map(s => richMeasure(s.cx, s.cy, s.rProj, s.sHat)).filter(Boolean);
  const geDetrend = geRich.map(r => r.detrendDiff), gePeak = geRich.map(r => r.peakDiff);
  // flat control
  const rngC = alea('flatctrl:' + cap);
  const medRP = geMedian.length ? geMedian.map(s=>s.rProj).sort((a,b)=>a-b)[geMedian.length>>1] : 20;
  const sAcc = geMedian.reduce((a,s)=> s.sHat?[a[0]+s.sHat[0],a[1]+s.sHat[1]]:a, [0,0]);
  const sMag = Math.hypot(sAcc[0], sAcc[1]) || 1; const sAvg = [sAcc[0]/sMag, sAcc[1]/sMag];
  const ctrl = []; let tries = 0;
  while (ctrl.length < 200 && tries < 6000) {
    tries++; const px = 200 + rngC()*(W-400), py = 100 + rngC()*(H-200);
    if (px<0||py<0||px>=W||py>=H || !discMask[Math.round(py)*W+Math.round(px)]) continue;
    const i=(Math.round(py)*W+Math.round(px))*4; if ((0.299*png.data[i]+0.587*png.data[i+1]+0.114*png.data[i+2]) <= 0) continue;
    let near = false; for (const s of geMedian) { if (Math.hypot(px-s.cx, py-s.cy) < 1.5*medRP) { near = true; break; } }
    if (near) continue;
    const r = richMeasure(px, py, medRP, sAvg); if (r) ctrl.push(r);
  }
  const ctrlDetrend = ctrl.map(r=>r.detrendDiff), ctrlPeak = ctrl.map(r=>r.peakDiff);
  const frac = (arr, thr) => arr.length ? arr.filter(x => x >= thr).length / arr.length : 0;

  // ── alignment sanity: largest-basin land ──
  const visLit = stamps.filter(s => s.visible && s.lit);
  const largest = visLit.slice().sort((a, b) => b.D_km - a.D_km)[0] || null;
  let largestCheck = null;
  if (largest && largest.sHat && largest.rProj >= 2) {
    // measure its half-annulus (same method) to confirm it lands on a concave, down-light-darker feature
    const rOut = largest.rProj * ANN_OUTER, rIn = largest.rProj * ANN_INNER;
    const x0 = Math.max(0, Math.floor(largest.cx-rOut)), x1 = Math.min(W-1, Math.ceil(largest.cx+rOut));
    const y0 = Math.max(0, Math.floor(largest.cy-rOut)), y1 = Math.min(H-1, Math.ceil(largest.cy+rOut));
    let sD=0,nD=0,sU=0,nU=0;
    for (let py=y0;py<=y1;py++) for (let px=x0;px<=x1;px++){ if(!discMask[py*W+px])continue; const ox=px-largest.cx,oy=py-largest.cy,dst=Math.hypot(ox,oy); if(dst<rIn||dst>rOut)continue; const dS=ox*largest.sHat[0]+oy*largest.sHat[1]; const i=(py*W+px)*4; const lum=0.299*png.data[i]+0.587*png.data[i+1]+0.114*png.data[i+2]; if(dS>0){sD+=lum;nD++;}else if(dS<0){sU+=lum;nU++;} }
    largestCheck = { centre: largest.centre, D_km:+largest.D_km.toFixed(1), deltaDeg:+(largest.delta*180/Math.PI).toFixed(2),
                     cx:+largest.cx.toFixed(1), cy:+largest.cy.toFixed(1), rProj:+largest.rProj.toFixed(1),
                     onDisc: !!discMask[Math.round(largest.cy)*W + Math.round(largest.cx)],
                     lumDown: nD?+(sD/nD).toFixed(1):null, lumUp: nU?+(sU/nU).toFixed(1):null,
                     downLightDarker: (nD&&nU) ? ((sU/nU)-(sD/nD))>=GEQ_BAND : null,
                     lumDiff: (nD&&nU)?+((sU/nU)-(sD/nD)).toFixed(1):null };
  }

  // ── projection self-test: sub-camera point should land at image centre ──
  const scPix = proj.project(camDir[0]*wr, camDir[1]*wr, camDir[2]*wr);
  const selfTestResidualPx = Math.hypot(scPix.x - W/2, scPix.y - H/2);

  renders.push({
    capture: cap, W, H,
    worldSeed: state.worldSeed, macroSeedRecorded, macroSeedDerived,
    macroSeedMatchesDerivation: macroSeedRecorded === macroSeedDerived,
    planetRadiusEarth: state.planetRadiusEarth, gravity: +cond.surfaceGravity.toFixed(4),
    isImpactSurface: isImpactSurface(cond),
    schedule: { fired: sched.fired, nStamp: sched.nStamp, R_km: +sched.R_km.toFixed(1),
                D_FLOOR_KM: +sched.D_FLOOR_KM.toFixed(1), D_HI_KM: +sched.D_HI_KM.toFixed(1),
                L_trunc: +sched.L_trunc.toFixed(3), tExp: +sched.tExp.toFixed(3), coverage: +sched.coverage.toFixed(4) },
    stampCounts: { total: nStamp, visible: stamps.filter(s=>s.visible).length,
                   litDisc: litDisc.length, geMedian: geMedian.length,
                   measured, discardedUnmeasurable },
    medianDeltaDeg: +(medianDelta*180/Math.PI).toFixed(3),
    discRadiusPx: +discRadiusPx.toFixed(1),
    asymmetry: { counted, denom, fraction: +asymFraction.toFixed(4), bar: POP_FRACTION, pass: asymFraction >= POP_FRACTION },
    diagnostics_NOT_the_bar: {
      note: 'DIAGNOSTIC ONLY — NOT the frozen verdict. Illuminates the S3 content-vs-instrument question.',
      geMedian_discreteCraterSubset: { counted: diagDiscreteCounted, measured: diagDiscreteMeasured, fraction: +diagDiscreteFraction.toFixed(4),
        definition: `≥-median stamps whose projected rim rProj ≤ 0.35·discRadiusPx (${DISCRETE_RPROJ.toFixed(0)}px) — i.e. craters that fit as discrete near-side features, excluding hemisphere-scale degraded basins.` },
      oversizedInGeMedian: { count: oversizedInGeMedian, note: 'count of ≥-median stamps with rProj > 0.35·discRadiusPx (hemisphere-scale). EMPIRICALLY ~0 here — the fail is NOT giant-basin pollution; the discrete-crater subset fraction equals the frozen fraction.' },
      allLitDisc: { counted: diagAllCounted, measured: diagAllMeasured, fraction: +diagAllFraction.toFixed(4),
        note: 'asymmetry fraction over ALL lit-disc stamps (no size gate) — the whole population.' },
      gradientControlled: {
        note: 'Answers "do ≥-median craters carry ≥1-band light-consistent wall contrast once the global disc-illumination gradient is removed and dither noise is averaged?" detrendHalfMeanDiff = residual (plane-subtracted) anti-sun−sun half-annulus mean (>0 ⇒ sun-side shadowed, the crater sign). Compare craters vs a FLAT lit-terrain control.',
        detrendHalfMean_crater_mean: +(geDetrend.reduce((a,b)=>a+b,0)/(geDetrend.length||1)).toFixed(2),
        detrendHalfMean_crater_fracPositive: +frac(geDetrend, 0).toFixed(3),
        detrendHalfMean_crater_fracGe1band: +frac(geDetrend, GEQ_BAND).toFixed(3),
        detrendHalfMean_crater_fracGeHalfBand: +frac(geDetrend, GEQ_BAND/2).toFixed(3),
        detrendHalfMean_flatControl_mean: +(ctrlDetrend.reduce((a,b)=>a+b,0)/(ctrlDetrend.length||1)).toFixed(2),
        detrendHalfMean_flatControl_fracGe1band: +frac(ctrlDetrend, GEQ_BAND).toFixed(3),
        peakDiff_crater_fracGe1band: +frac(gePeak, GEQ_BAND).toFixed(3),
        peakDiff_flatControl_fracGe1band: +frac(ctrlPeak, GEQ_BAND).toFixed(3),
        controlN: ctrl.length,
        interpretation: 'detrended half-mean crater contrast is barely above the flat control and sub-1-band ⇒ the ≥-median stamps do NOT carry a coherent ≥1-band asymmetry on a half-annulus MEAN basis (correct SIGN present but weak). The peak metric reaches ≥1 band for many craters BUT the flat control reaches it too ⇒ peak contrast at this magnitude is indistinguishable from posterize/dither noise. Neither rescues the frozen mean-bar.',
      },
    },
    darkClip: { discPixels: discCount, darkDiscPixels: darkDiscCount, darkClipFrac: +darkClipFrac.toFixed(6),
                ditherBand1Frac: +ditherBand1Frac.toFixed(6),
                litDiscPixels: litDiscCount, litDarkPixels: litDarkCount, litDarkClipFrac: +litDarkClipFrac.toFixed(6) },
    largestBasinLand: largestCheck,
    projectionSelfTestResidualPx: +selfTestResidualPx.toFixed(3),
    _perStamp: perStamp,
  });
}

// ── DARK-CLIP RE-BASELINE derivation (frozen resolutionPath) ─────────────────────────────────────────────
const dcVals   = renders.map(r => r.darkClip.darkClipFrac);
const band1Vals = renders.map(r => r.darkClip.ditherBand1Frac);
const darkClipFrac1 = mean(dcVals);
const sigma = std(dcVals);
const ditherFloor = mean(band1Vals);   // max fraction of disc pixels Bayer dither (±1 band) could push to/from lum 0
const toleranceFrac = Math.max(2 * sigma, ditherFloor);

// ── VERDICT ──────────────────────────────────────────────────────────────────────────────────────────────
const seed1 = renders.find(r => r.capture === 'target-seed1');
const evaluable = renders.every(r => r.projectionSelfTestResidualPx < 3 && r.stampCounts.measured >= 5);
const alignmentOK = renders.every(r => r.largestBasinLand && r.largestBasinLand.onDisc);
const barPass = evaluable && seed1.asymmetry.pass;

const report = {
  meta: {
    workstream: 'world-engine-inc3b-relief-budget-2026-07-21', slice: 'S2', gate: 'arc-asymmetry',
    generated: 'deterministic (no wall-clock in payload)',
    frozenBar: { source: 'calibration/read-gate-thresholds.json .arc',
                 geqOneBandMagnitude_normalized: ARC.geqOneBandMagnitude.value, geqOneBandMagnitude_8bit: +GEQ_BAND.toFixed(4),
                 populationFraction: POP_FRACTION, sizeGate: ARC.sizeGate.rule },
    meshBuildMs: meshMs, meshN: N,
  },
  result: {
    evaluable,
    verdict: barPass ? 'PASS' : 'FAIL',
    seed1Fraction: seed1.asymmetry.fraction, bar: POP_FRACTION, seed1Pass: seed1.asymmetry.pass,
    rerollFractions: renders.filter(r => r.capture !== 'target-seed1').map(r => ({ capture: r.capture, fraction: r.asymmetry.fraction, pass: r.asymmetry.pass })),
    alignmentSanityOK: alignmentOK,
    interpretation: 'ARC BAR FAILS on all three renders (seed1 0.10, rerolls 0.17/0.24 vs 0.70). Applied AS FROZEN — no post-hoc tuning; verdict recorded whichever way it fell. Alignment is VALIDATED (0px self-test + overlay correlation), so this is EVALUABLE, not an artifact. The render IS legibly cratered (visual + gradient-controlled diagnostics), but the ≥-median stamps carry only a WEAK, correct-signed, sub-1-band half-annulus MEAN asymmetry (detrended ~0.9 lum vs flat-control ~0; peak contrast indistinguishable from dither noise). Per BUILD-PLAN §1.S2 a texture-FAIL fires S3 (diagnose-first). The diagnostics here directly seed S3.a content-vs-instrument: candidate leads = (i) the frozen half-annulus MEAN metric is gradient-confounded/dilution-prone for smaller craters; (ii) the ≥-median size gate (GUESSED) may select older/overprinted craters over the crisp younger sub-median ones — its own resolutionPath. NOT for the read-gate to re-tune; flagged for S3 diagnosis.',
  },
  darkClipRebaseline: {
    perRender: renders.map(r => ({ capture: r.capture, darkClipFrac: r.darkClip.darkClipFrac, ditherBand1Frac: r.darkClip.ditherBand1Frac, litDarkClipFrac: r.darkClip.litDarkClipFrac })),
    darkClipFrac1_mean: +darkClipFrac1.toFixed(6),
    sigma: +sigma.toFixed(6),
    ditherNoiseFloor: +ditherFloor.toFixed(6),
    toleranceFrac: +toleranceFrac.toFixed(6),
    toleranceFracFormula: 'max(2*sigma, ditherNoiseFloor)',
    ditherNoiseFloorJustification: 'ditherNoiseFloor = fraction of disc pixels with 0 < lum <= 1 band (42.5/255). Bayer dither (ditherMode=0) perturbs the pre-posterize value by up to ~1 band, so ONLY pixels currently within one band of black can be newly pushed to (or away from) luminance-0 clipping between captures; that fraction is the largest defensible per-capture wiggle attributable to dithering rather than a real regression.',
    resolutionPathExecuted: 'read-gate-thresholds.json .arc.darkClipGuard.toleranceFrac.resolutionPath — measured darkClipFrac1 + per-reroll sigma at the staged light across seed 1 + 2 re-rolls; the main session replaces the GUESSED 0.01 with toleranceFrac above, then FREEZES and holds (no per-capture re-baseline).',
    note: 'darkClipFrac here is the LITERAL frozen formula (disc pixels at lum 0 / disc pixels) and therefore INCLUDES the night-side of the disc (a large, geometry-fixed contribution at el=20.79 → high absolute value, near-constant across re-rolls ⇒ small sigma). litDarkClipFrac (lit-hemisphere-only) is reported alongside as the crater-interior-relevant variant; the frozen guard uses the literal number.',
  },
  renders: renders.map(({ _perStamp, ...r }) => r),
  methodsNotes: {
    projection: `RNG-neutral probe: forEachCrater re-enumerated on the production mesh buildIrregularSphere(40000,4) (radius-independent, built once, ${N} verts). Crater centre = verts[Math.floor(uCentre*N)] (the writer's own index). Projected through recorded matrixWorld (identity) + matrixWorldInverse + projectionMatrix. Sub-camera-point self-test residual (should hit image centre): ${renders.map(r=>r.capture+'='+r.projectionSelfTestResidualPx+'px').join(', ')} — all sub-pixel ⇒ projection aligned.`,
    radiusR3: 'Condition derived at the RECORDED DRAWN radius (R3 live): seed1 R=0.273, reroll1 R=0.341, reroll2 R=0.367 (NOT canonical 0.38). Consequently nStamp = 165/153/149, NOT the frozen-file assumption of 147 (which was computed at canonical R). The frozen bar VALUES (0.70, ≥1 band, ≥median) are unchanged; only the population N differs, as mandated ("reproduce at the recorded drawn radius, not canonical").',
    macroSeed: `macroSeed taken from each state JSON (the render's actual seed). seed1 recorded macroSeed=${seed1.macroSeedRecorded} is the BOOT DEFAULT and does NOT equal alea('draw:macro:'+worldSeed)=${seed1.macroSeedDerived}; the two re-rolls' recorded macroSeeds DO match that derivation (${renders.filter(r=>r.capture!=='target-seed1').map(r=>r.capture+': rec '+r.macroSeedRecorded+' vs derived '+r.macroSeedDerived+' ('+(r.macroSeedMatchesDerivation?'match':'MISMATCH')+')').join('; ')}).`,
    wallHalfConvention: 'DOWN-LIGHT half-annulus = the disc half on the SUN-FACING side (offset·ŝ>0, ŝ = per-crater sunward screen dir). Physics: for a concave bowl at oblique light the interior wall on the sun-facing side is SHADOWED (its outward normal points away from the sun) while the anti-sun interior wall is lit; so the shadowed (down-light) wall sits on the sun-facing disc half. Asymmetry counts when that down-light half is DARKER than the up-light (anti-sun) half by ≥1 posterize band (42.5/255). This is the light-consistent crater signature.',
    annulus: `Interior-wall annulus = [FLOOR_FRAC·r, r] = [${ANN_INNER}, ${ANN_OUTER}]·r_proj, r_proj = projected radius of the crater rim (angular offset δ/2). From craterProfile (bombardment.js): flat floor ends at FLOOR_FRAC·r=0.5r, rim crest at r — so [0.5,1.0]·r is the interior wall band where the light-consistent shadow lives. Annulus pixels restricted to the ray-sphere disc mask (no background bleed).`,
    conservativeBias: 'The GLOBAL disc illumination rises toward the sun (verified: sunward disc is brighter). The down-light (sun-facing) half therefore sits on a globally BRIGHTER background, which works AGAINST detecting "down-light darker." The raw-mean bar (implemented AS FROZEN, no detrend) is thus conservative: a passing fraction is a floor, not inflated by the global gradient.',
    visualValidation: 'Two full-image overlays are committed as forensic evidence (evidence/S2/_overlay_seed1.png = all visible+lit stamp centres coloured by size; _diag_annuli_seed1.png = the ≥-median annuli + sunward ticks). Findings: (1) projected centres CORRELATE with rendered craters and many ≥-median annuli sit ON real craters ⇒ projection/mesh/index are sound (self-test residual 0px) and the harness is EVALUABLE. (2) The render is strongly, legibly cratered — but the crisp, high-contrast arc-shadowed craters are predominantly the SMALLER, younger ones. (3) A meaningful share of ≥-median (larger-angular) annuli sit on overprinted small-crater fields or smoothed plains rather than clean single bowls — consistent with obliteration stamping (old large craters overwritten oldest-first by younger craters). Craters are NOT absent; the frozen ≥-median MEAN bar simply does not register their contrast.',
    whyItFails_evidenced: 'The FAIL is NOT giant-basin pollution (oversizedInGeMedian≈0; the discrete-crater subset gives the SAME fraction as the frozen bar — my initial giant-hemisphere hypothesis was DISPROVEN by the data and discarded). Two evidenced contributors: (a) the frozen metric is a MEAN over the whole half-annulus, which the GLOBAL disc-illumination gradient (sunward globally brighter — verified) drives NEGATIVE for many craters (raw meanD distribution spans −38…+61); (b) even after removing that gradient (least-squares plane detrend) and averaging out dither, the ≥-median half-mean shadow is only ~0.9 luminance — sub-1-band and barely above the flat-terrain control (~0), with correct sign only 55–78% of the time. A peak/percentile metric DOES reach ≥1 band for ~80% of ≥-median craters, but the flat control reaches it too, so that contrast is indistinguishable from posterize/dither noise. Net: at the ≥-median size gate, the render carries a WEAK, correct-signed, but sub-1-band-MEAN wall asymmetry — a genuine texture shortfall by the frozen bar, plausibly compounded by the sizeGate GUESS selecting older/overprinted craters (its own resolutionPath concern) rather than the crisp younger sub-median ones. Reported as observed; not over-attributed to a single cause.',
    discardPolicy: `Stamps discarded from the ≥-median denominator only when UNMEASURABLE: r_proj<2px, or a half-annulus has <${MIN_HALF_PX} disc pixels (too small / clipped by the limb to yield a mean). Per render: ${renders.map(r=>r.capture+'='+r.stampCounts.discardedUnmeasurable).join(', ')}. No stamp discarded for its luminance value.`,
    alignment: `Largest-basin land check (proxy for "largest basin lands on a visibly concave feature"): ${renders.map(r=>{const l=r.largestBasinLand; return l? `${r.capture} D=${l.D_km}km @(${l.cx},${l.cy}) onDisc=${l.onDisc} down-light-darker=${l.downLightDarker} (lumDiff ${l.lumDiff})`:`${r.capture}: none`;}).join(' | ')}.`,
    limitations: 'Projection ignores the sub-pixel radial relief displacement (~0.003·envelope) and near-limb foreshortening distorts the annulus circle into an ellipse (the circular-annulus split slightly mismeasures near-limb craters); both are reported, neither is corrected (correcting would perturb the frozen population).',
  },
};

fs.writeFileSync(join(HERE, 'arc-report.json'), JSON.stringify(report, null, 2));

// human console summary
console.log('=== S2 arc-asymmetry read-gate ===');
console.log(`mesh: ${N} verts in ${meshMs}ms`);
for (const r of renders) {
  console.log(`\n${r.capture}: R=${r.planetRadiusEarth.toFixed(3)} g=${r.gravity} nStamp=${r.stampCounts.total} litDisc=${r.stampCounts.litDisc} ≥med=${r.stampCounts.geMedian} measured=${r.stampCounts.measured}`);
  console.log(`  asym fraction = ${r.asymmetry.fraction} (bar ${POP_FRACTION}) ⇒ ${r.asymmetry.pass ? 'PASS' : 'fail'}   [counted ${r.asymmetry.counted}/${r.asymmetry.denom}]`);
  const dg = r.diagnostics_NOT_the_bar, gc = dg.gradientControlled;
  console.log(`  DIAG(non-bar): discrete-subset ${dg.geMedian_discreteCraterSubset.fraction}, oversized-in-≥med ${dg.oversizedInGeMedian.count}, all-lit-disc ${dg.allLitDisc.fraction}`);
  console.log(`  DIAG detrended half-mean: crater mean=${gc.detrendHalfMean_crater_mean} (≥1band ${gc.detrendHalfMean_crater_fracGe1band}, +sign ${gc.detrendHalfMean_crater_fracPositive}) vs flat-control mean=${gc.detrendHalfMean_flatControl_mean} (≥1band ${gc.detrendHalfMean_flatControl_fracGe1band}); peak≥1band crater ${gc.peakDiff_crater_fracGe1band} vs flat ${gc.peakDiff_flatControl_fracGe1band}`);
  console.log(`  darkClipFrac=${r.darkClip.darkClipFrac} (litOnly=${r.darkClip.litDarkClipFrac})  selfTestResidual=${r.projectionSelfTestResidualPx}px`);
  const l = r.largestBasinLand; if (l) console.log(`  largest D=${l.D_km}km @(${l.cx},${l.cy}) onDisc=${l.onDisc} down-light-darker=${l.downLightDarker} (Δlum ${l.lumDiff})`);
}
console.log(`\ndarkClipFrac1(mean)=${darkClipFrac1.toFixed(6)} sigma=${sigma.toFixed(6)} ditherFloor=${ditherFloor.toFixed(6)} toleranceFrac=${toleranceFrac.toFixed(6)}`);
console.log(`\nVERDICT: ${report.result.verdict}  (evaluable=${evaluable}, seed1 fraction ${seed1.asymmetry.fraction} vs bar ${POP_FRACTION})`);
console.log(`report → ${join(HERE, 'arc-report.json')}`);
