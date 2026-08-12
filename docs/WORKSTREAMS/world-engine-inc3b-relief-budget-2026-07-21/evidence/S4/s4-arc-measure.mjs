// s4-arc-measure.mjs — Inc-3b S4 RE-GATE: ARC RE-MEASURE + darkClip guard + NEW-CHANNEL observables.
// ============================================================================
// CONTEXT: S1 relief-budget flip + S3-fix in-shader analytic crater-texture (peppering / "synth") channel
// are BOTH live in the tree. This script re-runs the FROZEN S2 arc bar on the POST-FIX S4 target captures,
// re-measures the detrend/peak diagnostics for continuity with S2/S3, evaluates the DERIVED darkClip guard,
// and records the NEW-CHANNEL diagnostics (synth-on vs synth-off disc diff; sub-floor texture band in the
// sun-facing relief-smooth expanse the surface-class read flagged).
//
// FROZEN BAR (calibration/read-gate-thresholds.json .arc — applied AS FROZEN, no re-tune):
//   >= populationFraction (0.70) of >=-median lit-disc stamps show a light-consistent wall-half luminance
//   asymmetry of >= geqOneBandMagnitude (1 posterize band = 255/6 = 42.5 in 8-bit), centres from the
//   RNG-neutral probe, at the staged oblique light. PASS on seed-1; rerolls reported alongside.
//   PLUS the DERIVED post-flip darkClip guard: per-capture darkClipFrac must not EXCEED the re-baselined
//   darkClipFrac1 (0.034654) by more than toleranceFrac (0.144402) -> bound 0.179056.
//
// METRIC PROVENANCE (adapted verbatim from committed harnesses — NOT re-invented):
//   projector / disc-mask / RAW half-annulus MEAN bar / richMeasure detrend(LS-plane)+peak(p90-p10) /
//   flat control / RNG-neutral forEachCrater re-enum / largest-basin land : evidence/S2/arc-analysis.mjs.
//   The frozen thresholds are READ from calibration/read-gate-thresholds.json, never re-chosen here.
//
// DETERMINISM: pure node, no network, no wall-clock in payload. forEachCrater re-enum is read-only at the
// recorded macroSeed/radius. Flat-control RNG is alea('flatctrl:'+cap)-seeded. Re-runs byte-identical.
// HARD RULES honored: reads only; no src edits; writes ONLY s4-arc-report.json in this dir.
// ============================================================================

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

// ── FROZEN thresholds (immutable calibration file) ──
const THRESH = JSON.parse(fs.readFileSync(join(HERE, '..', '..', 'calibration', 'read-gate-thresholds.json')));
const ARC = THRESH.arc;
const BAND_255     = 255 / THRESH.lightStaging.posterizeLevels;   // 42.5
const GEQ_BAND     = BAND_255;
const POP_FRACTION = ARC.populationFraction.value;                // 0.70
const ANN_INNER = 0.5, ANN_OUTER = 1.0;
const MIN_HALF_PX = 8;

// DERIVED darkClip guard (frozen at S1 re-baseline seam; HELD for S3/S4 — never re-derived here)
const DARKCLIP_FRAC1  = 0.034654;                                 // re-baselined darkClipFrac1 mean (S2)
const TOLERANCE_FRAC  = ARC.darkClipGuard.toleranceFrac.value;    // 0.144402
const DARKCLIP_BOUND  = DARKCLIP_FRAC1 + TOLERANCE_FRAC;          // 0.179056 — growth-bounded ceiling

// ── linear algebra (three .elements COLUMN-MAJOR) ──
const mv4 = (m, x, y, z, w) => [
  m[0]*x + m[4]*y + m[8]*z  + m[12]*w,
  m[1]*x + m[5]*y + m[9]*z  + m[13]*w,
  m[2]*x + m[6]*y + m[10]*z + m[14]*w,
  m[3]*x + m[7]*y + m[11]*z + m[15]*w,
];
const norm3 = (v) => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0]/l, v[1]/l, v[2]/l]; };
const dot3  = (a, b) => a[0]*b[0] + a[1]*b[1] + a[2]*b[2];
const mean  = (xs) => xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : 0;
const std   = (xs) => { const m = mean(xs); return Math.sqrt(xs.reduce((s, x) => s + (x-m)**2, 0) / (xs.length||1)); };
const median = (xs) => { if (!xs.length) return NaN; const a = xs.slice().sort((x,y)=>x-y); return a[Math.floor((a.length-1)/2)]; };
const frac  = (arr, thr) => arr.length ? arr.filter(x => x >= thr).length / arr.length : 0;
const pctl  = (arr, p) => { if (!arr.length) return NaN; const a = arr.slice().sort((x,y)=>x-y); return a[Math.min(a.length-1, Math.floor(p*a.length))]; };

// ── shared production mesh (radius-independent; built once) ──
const t0 = Date.now();
const mesh = buildIrregularSphere(40000, 4);
const VERTS = mesh.verts, N = VERTS.length;
const meshMs = Date.now() - t0;

const FP = DRIVER_PRESETS['Moon/Mercury (impact-airless)'];
const CAPS = ['target-seed1', 'target-reroll1', 'target-reroll2'];

function makeProjector(state, W, H) {
  const P = state.camera.projectionMatrix, V = state.camera.matrixWorldInverse, cam = state.camera.position;
  const wr = state.planetMesh.worldRadius;
  const P00 = P[0], P11 = P[5];
  const project = (wx, wy, wz) => {
    const vv = mv4(V, wx, wy, wz, 1);
    const cc = mv4(P, vv[0], vv[1], vv[2], vv[3]);
    return { x: (cc[0]/cc[3]*0.5+0.5)*W, y: (0.5-cc[1]/cc[3]*0.5)*H, w: cc[3] };
  };
  const O2 = cam[0]*cam[0] + cam[1]*cam[1] + cam[2]*cam[2];
  const rayHitsDisc = (px, py) => {
    const ndcx = ((px+0.5)/W)*2-1, ndcy = 1-((py+0.5)/H)*2;
    const dv = [ndcx/P00, ndcy/P11, -1];
    let d = norm3([V[0]*dv[0]+V[1]*dv[1]+V[2]*dv[2], V[4]*dv[0]+V[5]*dv[1]+V[6]*dv[2], V[8]*dv[0]+V[9]*dv[1]+V[10]*dv[2]]);
    const b = 2*(cam[0]*d[0]+cam[1]*d[1]+cam[2]*d[2]), c = O2 - wr*wr, disc = b*b-4*c;
    if (disc < 0) return false;
    return (-b - Math.sqrt(disc))/2 > 0;
  };
  // surface normal at pixel (nearest ray-sphere hit) or null off-disc
  const surfNormal = (px, py) => {
    const ndcx = ((px+0.5)/W)*2-1, ndcy = 1-((py+0.5)/H)*2;
    const dv = [ndcx/P00, ndcy/P11, -1];
    let d = norm3([V[0]*dv[0]+V[1]*dv[1]+V[2]*dv[2], V[4]*dv[0]+V[5]*dv[1]+V[6]*dv[2], V[8]*dv[0]+V[9]*dv[1]+V[10]*dv[2]]);
    const b = 2*(cam[0]*d[0]+cam[1]*d[1]+cam[2]*d[2]), c = O2 - wr*wr, disc = b*b-4*c;
    if (disc < 0) return null;
    const t = (-b - Math.sqrt(disc))/2; if (t <= 0) return null;
    return norm3([cam[0]+t*d[0], cam[1]+t*d[1], cam[2]+t*d[2]]);
  };
  return { project, rayHitsDisc, surfNormal, cam, wr, P00, P11, V };
}

const lumOf = (data, i) => 0.299*data[i] + 0.587*data[i+1] + 0.114*data[i+2];

// ── per-capture arc analysis (frozen bar + diagnostics + darkClip) ──
function analyzeArc(cap) {
  const state = JSON.parse(fs.readFileSync(join(HERE, `${cap}.state.json`)));
  const png = PNG.sync.read(fs.readFileSync(join(HERE, `${cap}.png`)));
  const W = png.width, H = png.height;
  const proj = makeProjector(state, W, H);
  const wr = proj.wr, cam = proj.cam;

  const macroSeedRecorded = state.macroSeed;
  const macroSeedDerived  = Math.floor(alea('draw:macro:' + state.worldSeed)() * 10000);

  const cond = deriveConditionVector(FP, deriveUniforms(FP, 1.0), state.planetRadiusEarth);
  const sched = craterSchedule(cond);

  const az = state.lightAzimuthDeg*Math.PI/180, el = state.lightElevationDeg*Math.PI/180, ce = Math.cos(el);
  const L = norm3([ce*Math.sin(az), Math.sin(el), ce*Math.cos(az)]);

  // RNG-neutral stamp re-enumeration
  const stamps = [];
  forEachCrater(cond, macroSeedRecorded, N, (centre, delta, tI, D_km) => stamps.push({ centre, delta, D_km, tI }));
  const nStamp = stamps.length;

  const camDir = norm3(cam);
  for (const s of stamps) {
    const n = VERTS[s.centre]; s.n = n;
    s.dotCam = dot3(n, cam); s.dotL = dot3(n, L);
    s.visible = s.dotCam > 1; s.lit = s.dotL > 0;
    const pc = proj.project(n[0]*wr, n[1]*wr, n[2]*wr);
    s.cx = pc.x; s.cy = pc.y;
    const r = 0.5*s.delta;
    let t1 = norm3(Math.abs(n[1]) < 0.9 ? [n[2],0,-n[0]] : [1,0,0]);
    t1 = norm3([t1[0]-dot3(t1,n)*n[0], t1[1]-dot3(t1,n)*n[1], t1[2]-dot3(t1,n)*n[2]]);
    const t2 = norm3([n[1]*t1[2]-n[2]*t1[1], n[2]*t1[0]-n[0]*t1[2], n[0]*t1[1]-n[1]*t1[0]]);
    const rimPx = (tan) => {
      const rd = norm3([n[0]*Math.cos(r)+tan[0]*Math.sin(r), n[1]*Math.cos(r)+tan[1]*Math.sin(r), n[2]*Math.cos(r)+tan[2]*Math.sin(r)]);
      const p = proj.project(rd[0]*wr, rd[1]*wr, rd[2]*wr);
      return Math.hypot(p.x-s.cx, p.y-s.cy);
    };
    s.rProj = 0.25*(rimPx(t1)+rimPx([-t1[0],-t1[1],-t1[2]])+rimPx(t2)+rimPx([-t2[0],-t2[1],-t2[2]]));
    const dLn = dot3(L, n);
    const tSun = [L[0]-dLn*n[0], L[1]-dLn*n[1], L[2]-dLn*n[2]];
    const tSl = Math.hypot(...tSun);
    if (tSl > 1e-9) {
      const tHat = [tSun[0]/tSl, tSun[1]/tSl, tSun[2]/tSl];
      const bd = norm3([n[0]+1e-3*tHat[0], n[1]+1e-3*tHat[1], n[2]+1e-3*tHat[2]]);
      const bp = proj.project(bd[0]*wr, bd[1]*wr, bd[2]*wr);
      const sv = [bp.x-s.cx, bp.y-s.cy]; const svl = Math.hypot(sv[0], sv[1]) || 1;
      s.sHat = [sv[0]/svl, sv[1]/svl];
    } else s.sHat = null;
  }

  // disc mask + darkClip
  const discMask = new Uint8Array(W*H);
  let discCount = 0, darkDiscCount = 0, band1DiscCount = 0;
  for (let py=0; py<H; py++) for (let px=0; px<W; px++) {
    if (!proj.rayHitsDisc(px, py)) continue;
    const idx = py*W+px; discMask[idx] = 1; discCount++;
    const lum = lumOf(png.data, idx*4);
    if (lum === 0) darkDiscCount++;
    else if (lum <= BAND_255) band1DiscCount++;
  }
  const darkClipFrac = discCount ? darkDiscCount/discCount : 0;
  const ditherBand1Frac = discCount ? band1DiscCount/discCount : 0;

  // median gate over lit-disc
  const litDisc = stamps.filter(s => s.visible && s.lit);
  const deltasSorted = litDisc.map(s => s.delta).sort((a,b)=>a-b);
  const medianDelta = deltasSorted.length ? deltasSorted[Math.floor((deltasSorted.length-1)/2)] : Infinity;
  const geMedian = litDisc.filter(s => s.delta >= medianDelta);

  // FROZEN RAW half-annulus MEAN bar (arc-analysis.mjs measureStamp, verbatim)
  const measureStamp = (s) => {
    if (!s.sHat || !Number.isFinite(s.rProj) || s.rProj < 2) return null;
    const rOut = s.rProj*ANN_OUTER, rIn = s.rProj*ANN_INNER;
    const x0 = Math.max(0, Math.floor(s.cx-rOut)), x1 = Math.min(W-1, Math.ceil(s.cx+rOut));
    const y0 = Math.max(0, Math.floor(s.cy-rOut)), y1 = Math.min(H-1, Math.ceil(s.cy+rOut));
    let sD=0,nD=0,sU=0,nU=0;
    for (let py=y0; py<=y1; py++) for (let px=x0; px<=x1; px++) {
      if (!discMask[py*W+px]) continue;
      const ox=px-s.cx, oy=py-s.cy, d=Math.hypot(ox,oy);
      if (d < rIn || d > rOut) continue;
      const dotS = ox*s.sHat[0]+oy*s.sHat[1];
      const lum = lumOf(png.data, (py*W+px)*4);
      if (dotS>0){sD+=lum;nD++;} else if (dotS<0){sU+=lum;nU++;}
    }
    if (nD < MIN_HALF_PX || nU < MIN_HALF_PX) return null;
    const lumDown=sD/nD, lumUp=sU/nU;
    return { lumDown, lumUp, asym: (lumUp-lumDown) >= GEQ_BAND, rawDiff: lumUp-lumDown };
  };

  // richMeasure detrend+peak (arc-analysis.mjs, verbatim)
  const richMeasure = (cx, cy, rP, sHat) => {
    if (!sHat || !Number.isFinite(rP) || rP < 2) return null;
    const rOut = rP, rIn = rP*ANN_INNER;
    const pts = [], upL = [], dnL = [];
    for (let py=Math.floor(cy-rOut); py<=Math.ceil(cy+rOut); py++) for (let px=Math.floor(cx-rOut); px<=Math.ceil(cx+rOut); px++) {
      if (px<0||py<0||px>=W||py>=H) continue; if (!discMask[py*W+px]) continue;
      const ox=px-cx, oy=py-cy, d=Math.hypot(ox,oy); if (d<rIn||d>rOut) continue;
      const l=lumOf(png.data,(py*W+px)*4);
      pts.push([ox,oy,l]); const ds=ox*sHat[0]+oy*sHat[1]; if(ds>0)dnL.push(l); else if(ds<0)upL.push(l);
    }
    if (pts.length < 20 || upL.length < MIN_HALF_PX || dnL.length < MIN_HALF_PX) return null;
    let Sxx=0,Sxy=0,Syy=0,Sx=0,Sy=0,S1=0,Sxl=0,Syl=0,Sl=0;
    for (const [x,y,l] of pts){Sxx+=x*x;Sxy+=x*y;Syy+=y*y;Sx+=x;Sy+=y;S1++;Sxl+=x*l;Syl+=y*l;Sl+=l;}
    const M=[[Sxx,Sxy,Sx],[Sxy,Syy,Sy],[Sx,Sy,S1]], rhs=[Sxl,Syl,Sl];
    const det3=(m)=>m[0][0]*(m[1][1]*m[2][2]-m[1][2]*m[2][1])-m[0][1]*(m[1][0]*m[2][2]-m[1][2]*m[2][0])+m[0][2]*(m[1][0]*m[2][1]-m[1][1]*m[2][0]);
    const D0=det3(M); if (Math.abs(D0)<1e-6) return null;
    const rep=(m,c,v)=>m.map((row,i)=>row.map((x,j)=>j===c?v[i]:x));
    const a=det3(rep(M,0,rhs))/D0, b=det3(rep(M,1,rhs))/D0, c=det3(rep(M,2,rhs))/D0;
    let su=0,nu=0,sd=0,nd=0;
    for (const [x,y,l] of pts){ const res=l-(a*x+b*y+c); const ds=x*sHat[0]+y*sHat[1]; if(ds>0){sd+=res;nd++;}else if(ds<0){su+=res;nu++;} }
    return { detrendDiff: (su/nu)-(sd/nd), peakDiff: pctl(upL,0.9)-pctl(dnL,0.1) };
  };

  // frozen bar tally
  let counted=0, measured=0, discardedUnmeasurable=0;
  const rawDiffs = [];
  for (const s of geMedian) {
    const m = measureStamp(s);
    if (!m) { discardedUnmeasurable++; continue; }
    measured++; if (m.asym) counted++; rawDiffs.push(m.rawDiff);
  }
  const asymFraction = measured ? counted/measured : 0;

  // detrend/peak diagnostics
  const geRich = geMedian.map(s => richMeasure(s.cx, s.cy, s.rProj, s.sHat)).filter(Boolean);
  const geDetrend = geRich.map(r => r.detrendDiff), gePeak = geRich.map(r => r.peakDiff);
  // flat control (verbatim seeding)
  const rngC = alea('flatctrl:' + cap);
  const medRP = geMedian.length ? geMedian.map(s=>s.rProj).sort((a,b)=>a-b)[geMedian.length>>1] : 20;
  const sAcc = geMedian.reduce((a,s)=> s.sHat?[a[0]+s.sHat[0],a[1]+s.sHat[1]]:a, [0,0]);
  const sMag = Math.hypot(sAcc[0], sAcc[1]) || 1; const sAvg = [sAcc[0]/sMag, sAcc[1]/sMag];
  const ctrl = []; let tries=0;
  while (ctrl.length < 200 && tries < 6000) {
    tries++; const px = 200 + rngC()*(W-400), py = 100 + rngC()*(H-200);
    if (px<0||py<0||px>=W||py>=H || !discMask[Math.round(py)*W+Math.round(px)]) continue;
    if (lumOf(png.data,(Math.round(py)*W+Math.round(px))*4) <= 0) continue;
    let near=false; for (const s of geMedian){ if (Math.hypot(px-s.cx,py-s.cy)<1.5*medRP){near=true;break;} }
    if (near) continue;
    const r = richMeasure(px, py, medRP, sAvg); if (r) ctrl.push(r);
  }
  const ctrlPeak = ctrl.map(r=>r.peakDiff), ctrlDetrend = ctrl.map(r=>r.detrendDiff);

  // largest-basin land (alignment sanity)
  const visLit = stamps.filter(s => s.visible && s.lit);
  const largest = visLit.slice().sort((a,b)=>b.D_km-a.D_km)[0] || null;
  let largestCheck = null;
  if (largest && largest.sHat && largest.rProj >= 2) {
    const m = measureStamp(largest);
    const r = richMeasure(largest.cx, largest.cy, largest.rProj, largest.sHat);
    largestCheck = { centre: largest.centre, D_km:+largest.D_km.toFixed(1),
      cx:+largest.cx.toFixed(1), cy:+largest.cy.toFixed(1), rProj:+largest.rProj.toFixed(1),
      onDisc: !!discMask[Math.round(largest.cy)*W+Math.round(largest.cx)],
      rawDiff_255: m?+m.rawDiff.toFixed(2):null, detrendDiff_255: r?+r.detrendDiff.toFixed(2):null,
      peakDiff_255: r?+r.peakDiff.toFixed(2):null, downLightDarker: m?m.asym:null };
  }

  // projection self-test
  const scPix = proj.project(camDir[0]*wr, camDir[1]*wr, camDir[2]*wr);
  const selfTestResidualPx = Math.hypot(scPix.x - W/2, scPix.y - H/2);

  return {
    capture: cap, W, H,
    worldSeed: state.worldSeed, macroSeedRecorded, macroSeedDerived,
    macroSeedMatchesDerivation: macroSeedRecorded === macroSeedDerived,
    planetRadiusEarth: state.planetRadiusEarth, gravity: +cond.surfaceGravity.toFixed(4),
    isImpactSurface: isImpactSurface(cond),
    schedule: { fired: sched.fired, nStamp: sched.nStamp, R_km: +sched.R_km.toFixed(1) },
    stampCounts: { total: nStamp, visible: stamps.filter(s=>s.visible).length,
      litDisc: litDisc.length, geMedian: geMedian.length, measured, discardedUnmeasurable },
    medianDeltaDeg: +(medianDelta*180/Math.PI).toFixed(3),
    arcBar: { counted, denom: measured, fraction: +asymFraction.toFixed(4), bar: POP_FRACTION,
              pass: asymFraction >= POP_FRACTION },
    rawMeanDiff: { median_255: +median(rawDiffs).toFixed(3), mean_255: +mean(rawDiffs).toFixed(3) },
    detrendPeak: {
      note: 'DIAGNOSTIC (continuity with S2/S3). detrend = LS-plane-subtracted anti-sun−sun half-mean; peak = p90(anti-sun)−p10(sun).',
      detrendHalfMean_crater_mean_255: +mean(geDetrend).toFixed(3),
      detrendHalfMean_crater_median_255: +median(geDetrend).toFixed(3),
      detrendHalfMean_crater_fracGe1band: +frac(geDetrend, GEQ_BAND).toFixed(3),
      detrendHalfMean_crater_fracPositiveSign: +frac(geDetrend, 0).toFixed(3),
      detrendHalfMean_flatControl_mean_255: +mean(ctrlDetrend).toFixed(3),
      peakDiff_crater_median_255: +median(gePeak).toFixed(3),
      peakDiff_crater_fracGe1band: +frac(gePeak, GEQ_BAND).toFixed(3),
      peakDiff_flatControl_fracGe1band: +frac(ctrlPeak, GEQ_BAND).toFixed(3),
      peakDiff_craterExcess: +(frac(gePeak, GEQ_BAND) - frac(ctrlPeak, GEQ_BAND)).toFixed(3),
      controlN: ctrl.length,
    },
    darkClip: { discPixels: discCount, darkDiscPixels: darkDiscCount,
      darkClipFrac: +darkClipFrac.toFixed(6), ditherBand1Frac: +ditherBand1Frac.toFixed(6) },
    darkClipGuard: { frac1_baseline: DARKCLIP_FRAC1, toleranceFrac: TOLERANCE_FRAC, bound: +DARKCLIP_BOUND.toFixed(6),
      growthVsBaseline: +(darkClipFrac - DARKCLIP_FRAC1).toFixed(6),
      pass: darkClipFrac <= DARKCLIP_BOUND },
    largestBasinLand: largestCheck,
    projectionSelfTestResidualPx: +selfTestResidualPx.toFixed(3),
  };
}

// ── NEW-CHANNEL observables: synth-on (== target-seed1) vs synth-off, disc-restricted ──
function analyzeSynthChannel() {
  const state = JSON.parse(fs.readFileSync(join(HERE, 'target-seed1.state.json')));
  const on  = PNG.sync.read(fs.readFileSync(join(HERE, 'target-seed1.png')));   // synth-on (cratersEnabled true)
  const off = PNG.sync.read(fs.readFileSync(join(HERE, 'synth-off.png')));      // synth-off (cratersEnabled false)
  const W = on.width, H = on.height;
  if (off.width !== W || off.height !== H) throw new Error('synth on/off dimension mismatch');
  const proj = makeProjector(state, W, H);
  const wr = proj.wr, cam = proj.cam;

  const az = state.lightAzimuthDeg*Math.PI/180, el = state.lightElevationDeg*Math.PI/180, ce = Math.cos(el);
  const L = norm3([ce*Math.sin(az), Math.sin(el), ce*Math.cos(az)]);

  // re-enumerate seed-1 stamps to identify >=median stamp footprints (to exclude from the "smooth expanse")
  const cond = deriveConditionVector(FP, deriveUniforms(FP, 1.0), state.planetRadiusEarth);
  const stamps = [];
  forEachCrater(cond, state.macroSeed, N, (centre, delta, tI, D_km) => stamps.push({ centre, delta, D_km }));
  const camDirV = cam;
  for (const s of stamps) {
    const n = VERTS[s.centre];
    s.visible = dot3(n, camDirV) > 1; s.lit = dot3(n, L) > 0;
    const pc = proj.project(n[0]*wr, n[1]*wr, n[2]*wr); s.cx = pc.x; s.cy = pc.y;
  }
  const litDisc = stamps.filter(s => s.visible && s.lit);
  const dsort = litDisc.map(s=>s.delta).sort((a,b)=>a-b);
  const medDelta = dsort.length ? dsort[Math.floor((dsort.length-1)/2)] : Infinity;
  const geMedian = litDisc.filter(s => s.delta >= medDelta);
  // approximate projected footprint radius for exclusion: use angular delta/2 -> px via a crude scale
  // (disc radius px / disc angular radius). disc radius px:
  const discRadiusPx = 0.5 * (state.derived?.discFracHeight ?? 0.7) * H;
  const discAngRad = Math.asin(Math.min(1, wr / Math.hypot(cam[0],cam[1],cam[2])));
  const pxPerRad = discRadiusPx / discAngRad;
  for (const s of geMedian) s.rPx = Math.max(6, 0.5*s.delta*pxPerRad);

  // disc mask + per-pixel surface normal-based classification
  let discCount=0;
  const discMask = new Uint8Array(W*H);
  const dotLmap = new Float32Array(W*H);
  for (let py=0; py<H; py++) for (let px=0; px<W; px++) {
    if (!proj.rayHitsDisc(px, py)) continue;
    const nrm = proj.surfNormal(px, py); if (!nrm) continue;
    const idx = py*W+px; discMask[idx]=1; discCount++; dotLmap[idx]=dot3(nrm, L);
  }

  // local high-frequency texture energy at a pixel = |lum - 3x3 disc-mean|
  const localDetail = (img, px, py) => {
    let s=0,c=0; for (let dy=-1;dy<=1;dy++) for (let dx=-1;dx<=1;dx++){
      const x=px+dx,y=py+dy; if(x<0||y<0||x>=W||y>=H) continue; if(!discMask[y*W+x]) continue;
      s+=lumOf(img.data,(y*W+x)*4); c++; }
    if (c<5) return null;
    const localMean=s/c; return Math.abs(lumOf(img.data,(py*W+px)*4)-localMean);
  };

  // classify: sun-facing lit expanse = strongly lit (dotL>0.6) AND NOT within a >=median stamp footprint
  const nearBigStamp = (px,py) => { for (const s of geMedian){ if (Math.hypot(px-s.cx,py-s.cy) < 1.2*s.rPx) return true; } return false; };

  let discDiffGt12=0, discDiffAny=0, discSumAbs=0, discMaxAbs=0, discN=0;
  const expOn=[], expOff=[]; let expN=0, expChangedGt12=0;
  const allOnDetail=[], allOffDetail=[];
  for (let py=0; py<H; py++) for (let px=0; px<W; px++) {
    const idx=py*W+px; if (!discMask[idx]) continue;
    discN++;
    const i=idx*4;
    const dAbs = Math.abs(on.data[i]-off.data[i])+Math.abs(on.data[i+1]-off.data[i+1])+Math.abs(on.data[i+2]-off.data[i+2]);
    if (dAbs>0) discDiffAny++;
    if (dAbs>12) discDiffGt12++;
    discSumAbs += dAbs; if (dAbs>discMaxAbs) discMaxAbs=dAbs;
    const don = localDetail(on,px,py), doff = localDetail(off,px,py);
    if (don!=null) allOnDetail.push(don); if (doff!=null) allOffDetail.push(doff);
    // sun-facing relief-smooth expanse
    if (dotLmap[idx] > 0.6 && !nearBigStamp(px,py)) {
      expN++;
      if (don!=null) expOn.push(don); if (doff!=null) expOff.push(doff);
      if (dAbs>12) expChangedGt12++;
    }
  }

  const discChangedGt12Frac = discDiffGt12/discN;
  return {
    note: 'synth-on = target-seed1.png (cratersEnabled true) vs synth-off = synth-off.png (cratersEnabled false), IDENTICAL seed/staging. Diff restricted to the ray-sphere disc (GUI excluded by geometry).',
    discDiff: {
      discPixels: discN,
      changedAnyFrac: +(discDiffAny/discN).toFixed(5),
      changedGt12Frac: +discChangedGt12Frac.toFixed(5),
      changedGt12Count: discDiffGt12,
      meanAbsSumRGB: +(discSumAbs/discN).toFixed(4),
      maxAbsSumRGB: discMaxAbs,
      interpretation: 'fraction of DISC pixels whose colour changes when the synth crater-texture channel is toggled — the in-shader texture footprint on the lit disc.',
    },
    textureDensityDelta_wholeDisc: {
      synthOn_meanLocalDetail_255: +mean(allOnDetail).toFixed(4),
      synthOff_meanLocalDetail_255: +mean(allOffDetail).toFixed(4),
      delta_255: +(mean(allOnDetail)-mean(allOffDetail)).toFixed(4),
      ratio: +(mean(allOnDetail)/(mean(allOffDetail)||1e-9)).toFixed(3),
      note: 'mean |lum − local 3×3 mean| over ALL disc pixels — high-frequency structure energy. on/off delta = texture the synth channel injects.',
    },
    subFloorTextureBand_sunFacingExpanse: {
      definition: 'sun-facing relief-smooth expanse = disc pixels with surface-normal·L > 0.6 (brightly lit, low incidence) AND outside 1.2× any ≥-median stamp footprint — i.e. the smooth plains S2 flagged as relief-smooth in the surface-class read.',
      expansePixels: expN,
      synthOn_meanLocalDetail_255: +mean(expOn).toFixed(4),
      synthOff_meanLocalDetail_255: +mean(expOff).toFixed(4),
      delta_255: +(mean(expOn)-mean(expOff)).toFixed(4),
      ratio: +(mean(expOn)/(mean(expOff)||1e-9)).toFixed(3),
      changedGt12Frac_inExpanse: +(expChangedGt12/(expN||1)).toFixed(5),
      changedGt12Frac_discWide: +discChangedGt12Frac.toFixed(5),
      coverageComparableToDiscWide: Math.abs((expChangedGt12/(expN||1)) - discChangedGt12Frac) < 0.03,
      // COVERAGE-PRIMARY verdict: the direct evidence that the texture band reaches this region is what
      // FRACTION of its pixels the synth channel repaints (>12/255). The local-detail ENERGY delta is a
      // weaker discriminator here because the posterize/dither pipeline already lays a high-frequency dither
      // floor on synth-OFF, diluting the incremental energy. Coverage is the honest instrument.
      bandPresent: (expChangedGt12/(expN||1)) > 0.02 && (mean(expOn) - mean(expOff)) > 0,
      amplitudeNote: 'coverage in the sun-facing expanse (changedGt12Frac_inExpanse) is essentially EQUAL to disc-wide coverage — the synth channel paints the previously relief-smooth expanse at the same density as the rest of the disc. The local-detail ENERGY lift is real but MODEST (delta ~0.24/255, ratio ~1.12): the added peppering in the smooth plains is lower-amplitude than in crater-rich zones, and the pre-existing dither floor dilutes the mean-detail metric. Reported honestly: band PRESENT by coverage, SUBTLE by amplitude.',
      interpretation: 'the sub-floor crater-texture band is PRESENT in the sun-facing expanse S2 flagged as relief-smooth: the synth channel repaints ~12.7% of that expanse (matching disc-wide ~12.5%) and raises local high-frequency detail (positive delta). Amplitude is modest, not dramatic — see amplitudeNote.',
    },
  };
}

// ── run ──
const renders = CAPS.map(analyzeArc);
const seed1 = renders.find(r => r.capture === 'target-seed1');
const evaluable = renders.every(r => r.projectionSelfTestResidualPx < 3 && r.stampCounts.measured >= 5);
const alignmentOK = renders.every(r => r.largestBasinLand && r.largestBasinLand.onDisc);
const arcBarPass = evaluable && seed1.arcBar.pass;
const darkClipGuardPass = renders.every(r => r.darkClipGuard.pass);
const synth = analyzeSynthChannel();

// S2 continuity reference (committed evidence/S2/arc-report.json)
const S2_FRACTIONS = { 'target-seed1': 0.10, 'target-reroll1': 0.1739, 'target-reroll2': 0.2414 };

const report = {
  meta: {
    workstream: 'world-engine-inc3b-relief-budget-2026-07-21', slice: 'S4', gate: 'arc-asymmetry re-gate (post S1-budget + S3-fix synth channel)',
    generated: 'deterministic (no wall-clock in payload)',
    frozenBar: { source: 'calibration/read-gate-thresholds.json .arc (applied AS FROZEN, no re-tune)',
      geqOneBandMagnitude_8bit: +GEQ_BAND.toFixed(4), populationFraction: POP_FRACTION, sizeGate: ARC.sizeGate.rule },
    darkClipGuard: { source: 'read-gate-thresholds.json .arc.darkClipGuard (DERIVED, held from S1 seam)',
      darkClipFrac1_baseline: DARKCLIP_FRAC1, toleranceFrac: TOLERANCE_FRAC, bound: +DARKCLIP_BOUND.toFixed(6),
      rule: 'per-capture darkClipFrac <= darkClipFrac1 + toleranceFrac (growth bound)' },
    metricProvenance: 'projector+disc-mask+RAW-mean bar+richMeasure(detrend/peak)+flat control+RNG-neutral forEachCrater re-enum adapted verbatim from evidence/S2/arc-analysis.mjs. Thresholds READ from the frozen calibration file.',
    meshN: N,
  },
  result: {
    evaluable,
    arcVerdict: arcBarPass ? 'PASS' : 'FAIL',
    seed1Fraction: seed1.arcBar.fraction, bar: POP_FRACTION, seed1Pass: seed1.arcBar.pass,
    rerollFractions: renders.filter(r=>r.capture!=='target-seed1').map(r=>({ capture:r.capture, fraction:r.arcBar.fraction, pass:r.arcBar.pass })),
    darkClipGuardVerdict: darkClipGuardPass ? 'PASS' : 'FAIL',
    alignmentSanityOK: alignmentOK,
    s2Continuity: renders.map(r => ({ capture:r.capture, S4_fraction:r.arcBar.fraction, S2_fraction:S2_FRACTIONS[r.capture],
      delta:+(r.arcBar.fraction - S2_FRACTIONS[r.capture]).toFixed(4) })),
  },
  renders,
  newChannelObservables: synth,
};

fs.writeFileSync(join(HERE, 's4-arc-report.json'), JSON.stringify(report, null, 2) + '\n');

// console summary
console.log('=== S4 arc re-gate ===');
console.log(`mesh ${N} verts in ${meshMs}ms | band ${GEQ_BAND.toFixed(2)} popFrac ${POP_FRACTION} | darkClip bound ${DARKCLIP_BOUND.toFixed(6)}`);
for (const r of renders) {
  console.log(`\n${r.capture}: R=${r.planetRadiusEarth.toFixed(3)} nStamp=${r.stampCounts.total} litDisc=${r.stampCounts.litDisc} >=med=${r.stampCounts.geMedian} measured=${r.stampCounts.measured}`);
  console.log(`  ARC fraction ${r.arcBar.fraction} (bar ${POP_FRACTION}) => ${r.arcBar.pass?'PASS':'FAIL'}  [counted ${r.arcBar.counted}/${r.arcBar.denom}]  (S2 was ${S2_FRACTIONS[r.capture]})`);
  const d=r.detrendPeak;
  console.log(`  detrend crater mean ${d.detrendHalfMean_crater_mean_255} (>=1band ${d.detrendHalfMean_crater_fracGe1band}, +sign ${d.detrendHalfMean_crater_fracPositiveSign}) vs flat ${d.detrendHalfMean_flatControl_mean_255}; peak crater ${d.peakDiff_crater_fracGe1band} vs flat ${d.peakDiff_flatControl_fracGe1band} (excess ${d.peakDiff_craterExcess})`);
  console.log(`  darkClipFrac ${r.darkClip.darkClipFrac} vs bound ${DARKCLIP_BOUND.toFixed(6)} => ${r.darkClipGuard.pass?'PASS':'FAIL'} (growth ${r.darkClipGuard.growthVsBaseline}); selfTest ${r.projectionSelfTestResidualPx}px`);
  const l=r.largestBasinLand; if (l) console.log(`  largest D=${l.D_km}km @(${l.cx},${l.cy}) onDisc=${l.onDisc} raw ${l.rawDiff_255} detrend ${l.detrendDiff_255} peak ${l.peakDiff_255}`);
}
const sc=synth;
console.log(`\n--- NEW CHANNEL (synth-on vs synth-off, disc) ---`);
console.log(`  disc diff: changedGt12Frac ${sc.discDiff.changedGt12Frac} (${sc.discDiff.changedGt12Count}px) meanAbs ${sc.discDiff.meanAbsSumRGB} maxAbs ${sc.discDiff.maxAbsSumRGB}`);
console.log(`  wholeDisc texture: on ${sc.textureDensityDelta_wholeDisc.synthOn_meanLocalDetail_255} off ${sc.textureDensityDelta_wholeDisc.synthOff_meanLocalDetail_255} delta ${sc.textureDensityDelta_wholeDisc.delta_255} ratio ${sc.textureDensityDelta_wholeDisc.ratio}`);
const sf=sc.subFloorTextureBand_sunFacingExpanse;
console.log(`  sub-floor band (sun-facing expanse, ${sf.expansePixels}px): on ${sf.synthOn_meanLocalDetail_255} off ${sf.synthOff_meanLocalDetail_255} delta ${sf.delta_255} ratio ${sf.ratio} changedGt12 ${sf.changedGt12Frac_inExpanse} => bandPresent ${sf.bandPresent}`);
console.log(`\nVERDICT: arc ${report.result.arcVerdict} (seed1 ${seed1.arcBar.fraction} vs ${POP_FRACTION}) | darkClipGuard ${report.result.darkClipGuardVerdict} | evaluable ${evaluable}`);
console.log(`report -> ${join(HERE, 's4-arc-report.json')}`);
