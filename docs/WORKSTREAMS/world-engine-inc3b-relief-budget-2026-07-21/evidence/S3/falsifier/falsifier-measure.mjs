// falsifier-measure.mjs — Inc-3b S3.b BINDING-LAYER FALSIFIER (GPU-in-loop A/B measurement).
// ============================================================================
// PURPOSE: S3.a adjudicated MIXED (content-dominant, ~12% instrument residual, headlessly
// inseparable). S3.b convicts the BINDING layer EMPIRICALLY by live A/Bs at IDENTICAL staging,
// then re-measures each capture with the COMMITTED S3/S2 metric machinery. This script is the
// pure-node measurement half: it re-enumerates the stamp population (RNG-neutral probe, same as
// s3-diagnosis.mjs / arc-analysis.mjs), projects through each capture's RECORDED matrices, and
// reports — per condition — the same detrended half-annulus metric + peak diagnostic + the frozen
// RAW-mean bar (the S2 ~0.10 number the control must reproduce).
//
// METRIC PROVENANCE (adapted verbatim from the committed harnesses — NOT re-invented):
//   - projector (recorded matrices), disc mask, RAW half-annulus MEAN bar (lumUp-lumDown>=42.5),
//     richMeasure detrend (LS-plane) + peak (p90-p10), flat control: from evidence/S2/arc-analysis.mjs.
//   - theta_wall partition (delta/4), SAMPLING_FLOOR (mesh/bake Nyquist 2.22 deg), effective screen
//     wall tilt (asin(dL/2sin i)): from evidence/S3/s3-diagnosis.mjs.
//   - BAND_255 = 255/6 = 42.5 (one levels-6 posterize band); levels-16 band = 255/16 = 15.9375.
//
// FALSIFIER READING: the S3.a conviction says most walls are sub-sampling (content). The binding
// question is which knob raises WALL CONTRAST at identical staging: bake resolution (256->512->1024),
// quantization (levels 6->16), or shading scale (perturb 0.55->1.10). We report the CONTINUOUS
// contrast (median detrend / median raw lumDiff / peak) as the load-bearing signal, plus the binary
// >=1-band fractions (the S2 bars) for continuity. Deltas vs cond0 are the verdict; adjectives are not.
//
// DETERMINISM: pure node, no network, no wall-clock in payload. forEachCrater re-enum is read-only
// at the recorded macroSeed. Flat control RNG is alea('flatctrl:'+cap)-seeded. Re-runs byte-identical.
// HARD RULES honored: reads only; no src edits; writes ONLY falsifier-report.json in this dir.
// ============================================================================

import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { PNG } from 'pngjs';
import alea from 'alea';

import { craterSchedule, isImpactSurface, forEachCrater, MESH_FLOOR_RAD }
  from '../../../../../../src/worldengine/base/bombardment.js';
import { buildIrregularSphere } from '../../../../../../planet-lod-rivers.js';
import { DRIVER_PRESETS } from '../../../../../../driver-presets.js';
import { deriveConditionVector } from '../../../../../../src/worldengine/base/conditionVector.js';
import { deriveUniforms, reliefEnvelope, lodRampOf } from '../../../../../../src/worldengine/base/labCore.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const DEG = 180 / Math.PI;

// ── FROZEN metric constants (identical to the committed harnesses) ──
const LEVELS6 = 6;
const BAND_255 = 255 / LEVELS6;                 // 42.5 — one levels-6 posterize band (the S2/S3 bar unit)
const BAND16_255 = 255 / 16;                    // 15.9375 — one levels-16 band (cond2 secondary bar)
const ANN_INNER = 0.5, ANN_OUTER = 1.0;         // craterProfile interior wall [0.5,1.0]*r
const FLOOR_FRAC = 0.5;
const MIN_HALF_PX = 8;
// SAMPLING floor (mesh/bake Nyquist) — s3-diagnosis.mjs SAMPLING_FLOOR_DEG derivation:
//   2 * max(meshSpacing~1.0155, bakePitch 1.11) = 2.22 deg. theta_wall = (1-FLOOR_FRAC)*0.5*delta = delta/4.
const SAMPLING_FLOOR_DEG = 2.22;
const PERTURB_MUL_LO = 0.6;                     // perturbAnalytic strength multiplier (shader)

const PRESET = 'Moon/Mercury (impact-airless)';
const FP = DRIVER_PRESETS[PRESET];

const CONDS = [
  { key: 'cond0-baseline',    png: 'cap-cond0-baseline.png',    state: 'cond0-baseline.state.json' },
  { key: 'cond1-bake512',     png: 'cap-cond1-bake512.png',     state: 'cond1-bake512.state.json' },
  { key: 'cond1b-bake1024',   png: 'cap-cond1b-bake1024.png',   state: 'cond1b-bake1024.state.json' },
  { key: 'cond2-posterize16', png: 'cap-cond2-posterize16.png', state: 'cond2-posterize16.state.json' },
  { key: 'cond3-perturb2x',   png: 'cap-cond3-perturb2x.png',   state: 'cond3-perturb2x.state.json' },
];

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
const median = (xs) => { if (!xs.length) return NaN; const a = xs.slice().sort((x,y)=>x-y); return a[Math.floor((a.length-1)/2)]; };
const frac  = (xs, thr) => xs.length ? xs.filter(x => x >= thr).length / xs.length : 0;
const pctl  = (arr, p) => { if (!arr.length) return NaN; const a = arr.slice().sort((x,y)=>x-y); return a[Math.min(a.length-1, Math.floor(p*a.length))]; };

// ── projector (arc-analysis.mjs makeProjector, verbatim) ──
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
  return { project, rayHitsDisc, cam, wr, P00, P11, V };
}

// ── shared production mesh (radius-independent, built once) ──
const meshT0 = Date.now();
const mesh = buildIrregularSphere(40000, 4);
const VERTS = mesh.verts, N = VERTS.length;
const meshMs = Date.now() - meshT0;

// effective screen wall tilt from measured reflectance asymmetry (s3-diagnosis screenTiltDeg)
function screenTiltDeg(reflAsym, incRad) {
  const denom = 2 * Math.sin(incRad);
  if (!(denom > 1e-6)) return NaN;
  return Math.asin(Math.max(-1, Math.min(1, reflAsym / denom))) * DEG;
}

function analyze(cond) {
  const state = JSON.parse(fs.readFileSync(join(HERE, cond.state)));
  const png = PNG.sync.read(fs.readFileSync(join(HERE, cond.png)));
  const W = png.width, H = png.height;
  const proj = makeProjector(state, W, H);
  const wr = proj.wr, cam = proj.cam;
  const macroSeed = state.macroSeed;
  const R = state.planetRadiusEarth;

  const cond_ = deriveConditionVector(FP, deriveUniforms(FP, 1.0), R);
  const sched = craterSchedule(cond_);

  // staged light dir
  const az = state.lightAzimuthDeg*Math.PI/180, el = state.lightElevationDeg*Math.PI/180, ce = Math.cos(el);
  const L = norm3([ce*Math.sin(az), Math.sin(el), ce*Math.cos(az)]);

  // reliefAmp (informational — perturb * reliefEnvelope(R,g) * lodMix), reproduced as in s3-diagnosis
  const g = cond_.surfaceGravity;
  const relEnv = reliefEnvelope(R, g);
  const lodMix = 0.7 + (1.0-0.7)*lodRampOf(state.distance);
  const reliefAmp = state.perturb * relEnv * lodMix;

  // ── RNG-neutral stamp re-enumeration ──
  const stamps = [];
  forEachCrater(cond_, macroSeed, N, (centre, delta, tI, D_km) => { stamps.push({ centre, delta, D_km, tI }); });
  const nStamp = stamps.length;

  // project + classify + theta_wall + sunward screen dir + rProj
  for (const s of stamps) {
    const n = VERTS[s.centre]; s.n = n;
    s.dotCam = dot3(n, cam); s.dotL = dot3(n, L);
    s.visible = s.dotCam > 1; s.lit = s.dotL > 0;
    const pc = proj.project(n[0]*wr, n[1]*wr, n[2]*wr);
    s.cx = pc.x; s.cy = pc.y;
    s.thetaWallDeg = (1-FLOOR_FRAC)*0.5*s.delta*DEG;         // delta/4
    s.resolvable = s.thetaWallDeg >= SAMPLING_FLOOR_DEG;
    s.incidenceDeg = Math.acos(Math.max(-1, Math.min(1, s.dotL)))*DEG;
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
  }

  // disc mask (ray-sphere)
  const discMask = new Uint8Array(W*H);
  let discCount = 0;
  for (let py=0; py<H; py++) for (let px=0; px<W; px++) {
    if (!proj.rayHitsDisc(px, py)) continue;
    discMask[py*W+px] = 1; discCount++;
  }

  const litDisc = stamps.filter(s => s.visible && s.lit);
  const deltasSorted = litDisc.map(s => s.delta).sort((a,b)=>a-b);
  const medianDelta = deltasSorted.length ? deltasSorted[Math.floor((deltasSorted.length-1)/2)] : Infinity;
  const geMedian = litDisc.filter(s => s.delta >= medianDelta);

  // ── RAW half-annulus MEAN measure (arc-analysis.mjs measureStamp, verbatim) ──
  const measureStampRaw = (s) => {
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
      const i = (py*W+px)*4;
      const lum = 0.299*png.data[i]+0.587*png.data[i+1]+0.114*png.data[i+2];
      if (dotS>0){sD+=lum;nD++;} else if (dotS<0){sU+=lum;nU++;}
    }
    if (nD < MIN_HALF_PX || nU < MIN_HALF_PX) return null;
    const lumDown = sD/nD, lumUp = sU/nU;
    return { lumDown, lumUp, rawDiff: lumUp-lumDown };
  };

  // ── detrend + peak (arc-analysis.mjs richMeasure, verbatim) ──
  const richMeasure = (cx, cy, rP, sHat) => {
    if (!sHat || !Number.isFinite(rP) || rP < 2) return null;
    const rOut = rP, rIn = rP*ANN_INNER;
    const pts = [], upL = [], dnL = [];
    for (let py=Math.floor(cy-rOut); py<=Math.ceil(cy+rOut); py++) for (let px=Math.floor(cx-rOut); px<=Math.ceil(cx+rOut); px++) {
      if (px<0||py<0||px>=W||py>=H) continue; if (!discMask[py*W+px]) continue;
      const ox=px-cx, oy=py-cy, d=Math.hypot(ox,oy); if (d<rIn || d>rOut) continue;
      const i=(py*W+px)*4; const l=0.299*png.data[i]+0.587*png.data[i+1]+0.114*png.data[i+2];
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
    const detrendDiff = (su/nu)-(sd/nd);
    const peakDiff = pctl(upL,0.9) - pctl(dnL,0.1);
    return { detrendDiff, peakDiff };
  };

  // per ≥median stamp: raw + detrend + eff tilt
  const perGe = [];
  for (const s of geMedian) {
    const raw = measureStampRaw(s);
    const rich = richMeasure(s.cx, s.cy, s.rProj, s.sHat);
    if (!raw && !rich) continue;
    const detrend = rich ? rich.detrendDiff : null;
    const incRad = s.incidenceDeg/DEG;
    const effTilt = (detrend != null) ? screenTiltDeg(Math.abs(detrend)/255, incRad) : null;
    perGe.push({ centre: s.centre, D_km:+s.D_km.toFixed(2), deltaDeg:+(s.delta*DEG).toFixed(3),
      thetaWallDeg:+s.thetaWallDeg.toFixed(4), resolvable: s.resolvable, incidenceDeg:+s.incidenceDeg.toFixed(2),
      rProj:+s.rProj.toFixed(1),
      rawDiff: raw ? +raw.rawDiff.toFixed(2) : null,
      detrendDiff: detrend != null ? +detrend.toFixed(2) : null,
      peakDiff: rich ? +rich.peakDiff.toFixed(2) : null,
      effTiltDeg: effTilt != null ? +effTilt.toFixed(3) : null });
  }

  // ── flat control (arc-analysis.mjs, verbatim seed) ──
  const rngC = alea('flatctrl:' + cond.key);
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
  const ctrlPeak = ctrl.map(r=>r.peakDiff), ctrlDetrend = ctrl.map(r=>r.detrendDiff);

  // ── largest basin anchor (control cross-check) ──
  const litVis = litDisc.slice().sort((a,b)=>b.D_km-a.D_km);
  const lbStamp = litVis[0] || null;
  let largestBasin = null;
  if (lbStamp) {
    const raw = measureStampRaw(lbStamp);
    const rich = richMeasure(lbStamp.cx, lbStamp.cy, lbStamp.rProj, lbStamp.sHat);
    largestBasin = { centre: lbStamp.centre, D_km:+lbStamp.D_km.toFixed(2), thetaWallDeg:+lbStamp.thetaWallDeg.toFixed(3),
      resolvable: lbStamp.resolvable,
      rawDiff_255: raw ? +raw.rawDiff.toFixed(2) : null,
      detrendDiff_255: rich ? +rich.detrendDiff.toFixed(2) : null,
      peakDiff_255: rich ? +rich.peakDiff.toFixed(2) : null };
  }

  // ── aggregate metrics ──
  const geRaw = perGe.filter(p => p.rawDiff != null).map(p => p.rawDiff);
  const geDetrend = perGe.filter(p => p.detrendDiff != null).map(p => p.detrendDiff);
  const geAbsDetrend = geDetrend.map(Math.abs);
  const gePeak = perGe.filter(p => p.peakDiff != null).map(p => p.peakDiff);
  const geEffTilt = perGe.filter(p => p.effTiltDeg != null).map(p => p.effTiltDeg);
  const resGe = perGe.filter(p => p.resolvable);
  const resRaw = resGe.filter(p => p.rawDiff != null).map(p => p.rawDiff);
  const resDetrend = resGe.filter(p => p.detrendDiff != null).map(p => p.detrendDiff);

  const measure = {
    key: cond.key,
    stampCounts: { total: nStamp, litDisc: litDisc.length, geMedian: geMedian.length,
      measurableRaw: geRaw.length, measurableDetrend: geDetrend.length,
      resolvable_geMedian: resGe.length, controlN: ctrl.length },
    staging: { macroSeed, planetRadiusEarth: R, reliefBakeSize: state.reliefBakeSize,
      posterizeLevels: state.posterizeLevels, perturb: state.perturb, reliefAmp: +reliefAmp.toFixed(4),
      lightAz: state.lightAzimuthDeg, lightEl: state.lightElevationDeg,
      schedule: { fired: sched.fired, nStamp: sched.nStamp } },
    // ── PRIMARY: >=median gate (THE S2 CONTROL METRIC — cond0 must reproduce ~0.10 on rawMeanFrac) ──
    geMedian: {
      // frozen S2 RAW-mean bar: fraction with (lumUp-lumDown) >= 42.5. cond0 CONTROL target ~0.10.
      rawMeanFrac_ge1band: +frac(geRaw, BAND_255).toFixed(4),
      rawMeanCount: geRaw.filter(x => x >= BAND_255).length,
      // detrended bar: fraction with |detrend| >= 42.5
      detrendFrac_ge1band: +frac(geAbsDetrend, BAND_255).toFixed(4),
      detrendCount: geAbsDetrend.filter(x => x >= BAND_255).length,
      // CONTINUOUS contrast (the load-bearing falsifier signal)
      medianRawDiff_255: +median(geRaw).toFixed(3),
      medianDetrendDiff_255: +median(geDetrend).toFixed(3),
      medianAbsDetrendDiff_255: +median(geAbsDetrend).toFixed(3),
      medianPeakDiff_255: +median(gePeak).toFixed(3),
      medianEffTiltDeg: +median(geEffTilt).toFixed(3),
      detrendFracPositiveSign: +frac(geDetrend, 0).toFixed(3),
    },
    // ── sampling-floor partition (theta_wall >= 2.22 deg — the resolved / instrument-side walls) ──
    resolvablePartition: {
      n: resGe.length,
      rawMeanFrac_ge1band: +frac(resRaw, BAND_255).toFixed(4),
      detrendFrac_ge1band: +frac(resDetrend.map(Math.abs), BAND_255).toFixed(4),
      medianRawDiff_255: +median(resRaw).toFixed(3),
      medianDetrendDiff_255: +median(resDetrend).toFixed(3),
      medianAbsDetrendDiff_255: +median(resDetrend.map(Math.abs)).toFixed(3),
    },
    // ── peak diagnostic with flat-control false-positive rate ──
    peak: {
      crater_fracGe1band: +frac(gePeak, BAND_255).toFixed(3),
      flatControl_fracGe1band: +frac(ctrlPeak, BAND_255).toFixed(3),
      craterExcess: +(frac(gePeak, BAND_255) - frac(ctrlPeak, BAND_255)).toFixed(3),
      crater_medianPeak_255: +median(gePeak).toFixed(2),
      flatControl_medianPeak_255: +median(ctrlPeak).toFixed(2),
      flatControl_medianDetrend_255: +median(ctrlDetrend).toFixed(2),
    },
    largestBasin,
  };

  // ── cond2 levels-16 SECONDARY bars (does contrast clear the RELAXED quantization bar / rise continuously?) ──
  if (state.posterizeLevels === 16) {
    measure.levels16 = {
      band16_255: +BAND16_255.toFixed(4),
      rawMeanFrac_ge1band16: +frac(geRaw, BAND16_255).toFixed(4),
      detrendFrac_ge1band16: +frac(geAbsDetrend, BAND16_255).toFixed(4),
      peak_crater_fracGe1band16: +frac(gePeak, BAND16_255).toFixed(3),
      peak_flatControl_fracGe1band16: +frac(ctrlPeak, BAND16_255).toFixed(3),
      note: 'levels-16 band = 255/16 = 15.94. Falsifier question is whether CONTINUOUS wall contrast rises when quantization relaxes (medianRawDiff/medianDetrend above), not whether it clears the levels-6 (42.5) bar.',
    };
  }

  measure._perGe = perGe;
  return measure;
}

// ── run all conditions ──
const measures = CONDS.map(analyze);
const byKey = Object.fromEntries(measures.map(m => [m.key, m]));
const base = byKey['cond0-baseline'];

// ── deltas vs baseline ──
function deltaBlock(m) {
  const d = (a, b) => +(a - b).toFixed(3);
  return {
    key: m.key,
    d_rawMeanFrac_geMedian: d(m.geMedian.rawMeanFrac_ge1band, base.geMedian.rawMeanFrac_ge1band),
    d_detrendFrac_geMedian: d(m.geMedian.detrendFrac_ge1band, base.geMedian.detrendFrac_ge1band),
    d_medianRawDiff_255: d(m.geMedian.medianRawDiff_255, base.geMedian.medianRawDiff_255),
    d_medianDetrendDiff_255: d(m.geMedian.medianDetrendDiff_255, base.geMedian.medianDetrendDiff_255),
    d_medianAbsDetrendDiff_255: d(m.geMedian.medianAbsDetrendDiff_255, base.geMedian.medianAbsDetrendDiff_255),
    d_medianPeakDiff_255: d(m.geMedian.medianPeakDiff_255, base.geMedian.medianPeakDiff_255),
    d_medianEffTiltDeg: d(m.geMedian.medianEffTiltDeg, base.geMedian.medianEffTiltDeg),
    d_resolvable_rawMeanFrac: d(m.resolvablePartition.rawMeanFrac_ge1band, base.resolvablePartition.rawMeanFrac_ge1band),
    d_resolvable_medianAbsDetrend_255: d(m.resolvablePartition.medianAbsDetrendDiff_255, base.resolvablePartition.medianAbsDetrendDiff_255),
    d_peak_craterExcess: d(m.peak.craterExcess, base.peak.craterExcess),
    d_largestBasin_detrend_255: (m.largestBasin && base.largestBasin) ? d(m.largestBasin.detrendDiff_255, base.largestBasin.detrendDiff_255) : null,
    d_largestBasin_rawDiff_255: (m.largestBasin && base.largestBasin) ? d(m.largestBasin.rawDiff_255, base.largestBasin.rawDiff_255) : null,
    d_largestBasin_peak_255: (m.largestBasin && base.largestBasin) ? d(m.largestBasin.peakDiff_255, base.largestBasin.peakDiff_255) : null,
  };
}
const deltas = measures.filter(m => m.key !== 'cond0-baseline').map(deltaBlock);

// ── control reproduction check vs S2 seed-1 ──
const S2_FRAC = 0.10, LB_LO = 11, LB_HI = 13;
const c0 = base;
const controlReproducesS2 = {
  s2_rawMeanFrac_geMedian: S2_FRAC,
  cond0_rawMeanFrac_geMedian: c0.geMedian.rawMeanFrac_ge1band,
  cond0_rawMeanCount: c0.geMedian.rawMeanCount,
  cond0_geMedianN: c0.stampCounts.geMedian,
  fracWithinReason: Math.abs(c0.geMedian.rawMeanFrac_ge1band - S2_FRAC) <= 0.06,
  s2_largestBasin_detrend_255_range: [LB_LO, LB_HI],
  cond0_largestBasin_detrend_255: c0.largestBasin ? c0.largestBasin.detrendDiff_255 : null,
  cond0_largestBasin_rawDiff_255: c0.largestBasin ? c0.largestBasin.rawDiff_255 : null,
  largestBasinWithinReason: c0.largestBasin ? (Math.abs(c0.largestBasin.detrendDiff_255) >= 8 && Math.abs(c0.largestBasin.detrendDiff_255) <= 16) : false,
};

const report = {
  meta: {
    workstream: 'world-engine-inc3b-relief-budget-2026-07-21', slice: 'S3.b',
    gate: 'binding-layer falsifier (GPU-in-loop A/B, live captures re-measured with committed S3/S2 metric)',
    generated: 'deterministic (no wall-clock in payload)',
    meshN: N, meshBuildMs: meshMs,
    metricProvenance: 'projector+rawMeanBar+richMeasure(detrend/peak)+flatControl adapted verbatim from evidence/S2/arc-analysis.mjs; theta_wall/SAMPLING_FLOOR/effTilt from evidence/S3/s3-diagnosis.mjs',
    band_levels6_255: BAND_255, band_levels16_255: +BAND16_255.toFixed(4), samplingFloorDeg: SAMPLING_FLOOR_DEG,
    captureMethod: 'chrome-devtools compositor screenshot (canvas toDataURL blank: renderer preserveDrawingBuffer=false). Native canvas 2463x1060 @ dpr1.25 == S2. Staging (projectionMatrix/matrixWorldInverse/camera.position/canvas/planetRadiusEarth) byte-identical to evidence/S2/target-seed1.state.json across ALL conditions; only ONE knob varies per condition.',
    conditions: {
      'cond0-baseline': 'bake 256 (override unset), levels 6, perturb 0.55 — the S2 seed-1 control',
      'cond1-bake512': '__reliefBakeSize=512, force re-route+re-bake; else identical to cond0',
      'cond1b-bake1024': '__reliefBakeSize=1024, force re-route+re-bake; else identical to cond0',
      'cond2-posterize16': 'levels=16 (GUI max; true off unreachable), bake 256, perturb 0.55',
      'cond3-perturb2x': 'perturb=1.10 (2x default), levels 6, bake 256',
    },
    pixelDiffVsCond0_sanity: { 'cond1-bake512':'0.30% px >12/255 (maxAbs 212)', 'cond1b-bake1024':'0.33% (maxAbs 212)', 'cond2-posterize16':'17.81% (maxAbs 78)', 'cond3-perturb2x':'6.01% (maxAbs 169)' },
  },
  controlReproducesS2,
  measures: measures.map(({ _perGe, ...m }) => m),
  deltasVsBaseline: deltas,
  perGe_cond0: base._perGe,
};

fs.writeFileSync(join(HERE, 'falsifier-report.json'), JSON.stringify(report, null, 2) + '\n');

// ── console summary ──
console.log('=== S3.b binding-layer falsifier ===');
console.log(`mesh ${N} verts in ${meshMs}ms | band6 ${BAND_255} band16 ${BAND16_255.toFixed(2)} | samplingFloor ${SAMPLING_FLOOR_DEG}deg`);
console.log(`\nCONTROL: cond0 rawMeanFrac(>=median) ${c0.geMedian.rawMeanFrac_ge1band} (S2=${S2_FRAC}) count ${c0.geMedian.rawMeanCount}/${c0.stampCounts.geMedian} | largestBasin detrend ${c0.largestBasin?.detrendDiff_255}/255 raw ${c0.largestBasin?.rawDiff_255}/255 => reproduces=${controlReproducesS2.fracWithinReason && controlReproducesS2.largestBasinWithinReason}`);
for (const m of measures) {
  console.log(`\n${m.key}: bake ${m.staging.reliefBakeSize} levels ${m.staging.posterizeLevels} perturb ${m.staging.perturb} | geMedianN ${m.stampCounts.geMedian} resN ${m.stampCounts.resolvable_geMedian}`);
  console.log(`  geMedian: rawFrac ${m.geMedian.rawMeanFrac_ge1band} detrFrac ${m.geMedian.detrendFrac_ge1band} | medRaw ${m.geMedian.medianRawDiff_255} medDetr ${m.geMedian.medianDetrendDiff_255} medAbsDetr ${m.geMedian.medianAbsDetrendDiff_255} medPeak ${m.geMedian.medianPeakDiff_255} medEffTilt ${m.geMedian.medianEffTiltDeg}deg`);
  console.log(`  resolvable(>=2.22): rawFrac ${m.resolvablePartition.rawMeanFrac_ge1band} medAbsDetr ${m.resolvablePartition.medianAbsDetrendDiff_255}`);
  console.log(`  peak: crater ${m.peak.crater_fracGe1band} vs flat ${m.peak.flatControl_fracGe1band} (excess ${m.peak.craterExcess}) | largestBasin detr ${m.largestBasin?.detrendDiff_255} raw ${m.largestBasin?.rawDiff_255} peak ${m.largestBasin?.peakDiff_255}`);
  if (m.levels16) console.log(`  levels16: rawFrac>=15.9 ${m.levels16.rawMeanFrac_ge1band16} detrFrac>=15.9 ${m.levels16.detrendFrac_ge1band16} peakCrater>=15.9 ${m.levels16.peak_crater_fracGe1band16} vs flat ${m.levels16.peak_flatControl_fracGe1band16}`);
}
console.log('\n=== DELTAS vs cond0 ===');
for (const d of deltas) {
  console.log(`${d.key}: d_medRaw ${d.d_medianRawDiff_255} d_medAbsDetr ${d.d_medianAbsDetrendDiff_255} d_medPeak ${d.d_medianPeakDiff_255} d_rawFrac ${d.d_rawMeanFrac_geMedian} d_effTilt ${d.d_medianEffTiltDeg} | d_LB_detr ${d.d_largestBasin_detrend_255} d_LB_raw ${d.d_largestBasin_rawDiff_255} d_LB_peak ${d.d_largestBasin_peak_255}`);
}
console.log(`\nreport -> ${join(HERE, 'falsifier-report.json')}`);
