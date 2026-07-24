// s3-diagnosis.mjs — Inc-3b S3.a DIAGNOSIS GATE (content vs instrument, BY MEASUREMENT).
// ============================================================================
// IRON LAW (superpowers:systematic-debugging + Max R4): NO fix until the root cause
// is CONVICTED by measurement. This harness does not choose a fix; it instruments
// every boundary of the render chain and reports the measured deficit-split.
//
// THE DISCRIMINANT (BUILD-PLAN §1.S3.a / lens-log MF-3) is a GEOMETRIC INEQUALITY,
// not a step order:
//     θ_wall ≥ θ_floor   →  wall is SAMPLING-resolvable  →  weak render = INSTRUMENT
//     θ_wall <  θ_floor  →  wall below what the grid can carry at N →  CONTENT (sub-grid)
//   θ_wall  = the WALL ANNULUS subtense (NOT the diameter): craterProfile's inner
//   wall spans geodesic [FLOOR_FRAC·r, r] = [0.5r, r], r=δ/2 ⇒ width = δ/4.
//
// FIX-ROUND-2 CORRECTION (this file was rebuilt after 3 must-fixes convicted the S3-v1 diagnosis):
//   (issue 1) θ_floor is the SAMPLING floor (mesh vertex spacing / bake texel pitch, Nyquist ≈2.22°) —
//     NOT the sub-band DISPLAY floor 0.37° (=2·pitch/6). BUILD-PLAN's content = "wall below what any N
//     can resolve at THIS MESH"; 0.37° sits 3× below the bake pitch and below the mesh spacing, so
//     θ_wall≥0.37° was TRUE for every stampable wall by construction (a pre-ordained "100% resolvable").
//     We report the deficit split across the FULL floor ladder (0.37° display → mesh/bake Nyquist).
//   (issue 2) BAKE attenuates the un-saturated wall SLOPE BEFORE shading (bakedSlope = wallSlope·bestTexel),
//     then re-shades — NOT the post-shading, Lambert-SATURATED asymmetry. Bake is a structural sampling
//     co-owner of the residual, not excludable.
//   (issue 3) signalPresent gates on the un-saturated SLOPE vs a model-derived slope floor (a gate that
//     CAN fire false) — NOT the clamp-SATURATED carrierTilt (pinned ~30-40°, non-monotonic ⇒ constant-true).
//
// THE CONVICTION = the measured DEFICIT SPLIT (BUILD-PLAN §1.S3.a step 3): of the stamps that FAIL the
// ≥1-band screen bar, what fraction sits below the SAMPLING floor (content) vs above it and still weak
// (instrument). Read across the floor ladder so no single floor choice pre-ordains the answer; the chain
// trace (carrier→bake→shading→posterize) names the instrument-side layers (bake ⊕ display, non-separable
// headlessly + metric-dilution).
//
// CHAIN INSTRUMENTED (task steps 1-5):
//   1. θ_wall partition of every lit-disc stamp + the deficit split (the conviction).
//   2. CARRIER: boot the seed-1 carrier headlessly (SAME pattern as
//      inc3b-amplitude-budget.mjs — makeSphereField + writeBodyRelief +
//      compositeMargins(carrier, relief.reliefBudget)); measure the composited-relief
//      wall gradient + the Lambert asymmetry it predicts at the staged light, BEFORE
//      bake/quantization. Is the signal present in the DATA?
//   3. BAKE: model the 256²/face cube resample (box-filter, calibration/
//      bake-attenuation-model.json — the GPU CubeCamera bake is not runnable headless;
//      the committed box-filter attenuation model is the sanctioned stand-in, flagged).
//      Per-stamp attenuation = baked slope / carrier slope (isolates R2).
//   4. SHADING+QUANTIZE: apply reliefAmp (= perturb·reliefEnvelope(R,g)·lodMix) then
//      posterize-6; predicted on-screen band asymmetry per stamp vs S2 MEASURED screen
//      asymmetry (re-measured here from the committed S2 PNGs).
//   5. METRIC HONESTY: frozen half-annulus MEAN vs gradient-detrended vs peak+flat
//      control within the ≥floor partition. Does the frozen bar under-measure a present
//      signal? (Reported, never substituted for the deficit split.)
//
// DETERMINISM: pure node, no network, no RNG in outputs (forEachCrater's alea is the
// writer's own single entropy source at the RECORDED macroSeed — read-only re-enum,
// byte-fence-safe), no wall-clock in the payload. Re-runs reproduce byte-identical.
// HARD RULES honored: no src/** edits, no test edits, no git. Reads only.
// ============================================================================

import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { PNG } from 'pngjs';
import alea from 'alea';

import {
  craterSchedule, isImpactSurface, forEachCrater, craterAmplitude,
  MESH_FLOOR_RAD,
} from '../../../../../src/worldengine/base/bombardment.js';

// craterProfile zone constants are module-private in bombardment.js — cited, not imported:
//   const FLOOR_FRAC = 0.5;  (bombardment.js:103 — flat floor out to FLOOR_FRAC·r; inner wall = [0.5,1]·r)
const FLOOR_FRAC = 0.5;
import {
  buildIrregularSphere, writeBodyRelief, compositeMargins, computeAdjGradient,
  DEFAULT_GRAIN_DRIVERS,
} from '../../../../../planet-lod-rivers.js';
import { makeSphereField } from '../../../../../src/worldengine/base/sphereField.js';
import { DRIVER_PRESETS, PRESET_ARCHETYPE } from '../../../../../driver-presets.js';
import { buildNeutralBodyDrivers } from '../../../../../body-drivers.js';
import { deriveConditionVector } from '../../../../../body-condition-vector.js';
import { deriveUniforms, reliefEnvelope, lodRampOf } from '../../../../../planet-lod-lab-core.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const S2 = join(HERE, '..', 'S2');
const CAL = join(HERE, '..', '..', 'calibration');

// ── FROZEN geometry constants (read from committed S0 artifacts — never re-chosen) ──
const BAKE = JSON.parse(fs.readFileSync(join(CAL, 'bake-attenuation-model.json')));
const THETA_FLOOR_DEG = BAKE.thetaFloorDeg;                 // 0.37° (FROZEN S0.5)
const MEASURED_EDGE_DEG = BAKE.measuredEdgeDeg;             // 1.11° bake resolving pitch
const LEVELS = BAKE.displayChain.levels;                    // 6 posterize levels
const BAND_LUM = 1 / LEVELS;                                // 0.16667 normalized = 1 posterize band
const BAND_255 = 255 / LEVELS;                              // 42.5 in 8-bit (the S2 metric's units)
const INCIDENCE_DEG = BAKE.displayChain.incidenceDeg;      // 69.21° staged incidence (FROZEN S0.5)
const DEG = 180 / Math.PI;

// 1-band PEAK screen-tilt floor (MF-1/MF-3, model-derived — NOT a taste constant): the smallest
// realized wall tilt ψ whose PEAK Lambert asymmetry clears exactly one posterize band. From
// ΔL = 2·sin(i)·sin(ψ) with ΔL = BAND_LUM at the staged incidence ⇒ ψ_floor = asin(BAND_LUM/(2 sin i)).
// Both inputs (BAND_LUM, incidence) come straight from bake-attenuation-model.json. This floor is (a) the
// screen tilt a ≥1-band PEAK crater implies, and (b) the signalPresent gate: a carrier realizing a wall
// tilt BELOW this cannot produce a resolvable wall even at peak.
const TILT_FLOOR_DEG = Math.asin(BAND_LUM / (2 * Math.sin(INCIDENCE_DEG / DEG))) * DEG;   // ≈ 5.11°

// ── S2 arc-report PEAK diagnostic (MF-1): the frozen bar is a half-annulus MEAN; the arc-report's OWN
//    per-render peak diagnostic (renders[].diagnostics_NOT_the_bar.gradientControlled) already measured
//    whether the wall shadow reaches ≥1 band at PEAK on real S2 pixels. Ingested here (NOT re-derived —
//    task: build on existing S2 evidence) and reconciled statistically. ──
const ARC = JSON.parse(fs.readFileSync(join(S2, 'arc-report.json')));
const arcByCapture = Object.fromEntries((ARC.renders || []).map(r => [r.capture, r]));
// standard-normal upper-tail (Abramowitz-Stegun 7.1.26 erfc) for the two-proportion z p-value.
function erfc(x) {
  const z = Math.abs(x), t = 1 / (1 + 0.5 * z);
  const y = t * Math.exp(-z*z - 1.26551223 + t*(1.00002368 + t*(0.37409196 + t*(0.09678418 +
    t*(-0.18628806 + t*(0.27886807 + t*(-1.13520398 + t*(1.48851587 +
    t*(-0.82215223 + t*0.17087277)))))))));
  return x >= 0 ? y : 2 - y;
}
const normalUpperTail = (z) => 0.5 * erfc(z / Math.SQRT2);   // P(Z > z)

// craterProfile geometry (bombardment.js): inner wall = [FLOOR_FRAC·r, r], r=δ/2.
// θ_wall (wall annulus subtense) = r − FLOOR_FRAC·r = (1−FLOOR_FRAC)·r = (1−FLOOR_FRAC)·δ/2.
const WALL_FRAC = (1 - FLOOR_FRAC);                         // 0.5 of the radius is wall
const thetaWallRad = (deltaRad) => WALL_FRAC * 0.5 * deltaRad;   // = δ/4 at FLOOR_FRAC=0.5

// perturb strength: state JSON does not record `perturb`; the lab default is 0.55
// (planet-lod-lab.html:1997) and captures were shot at defaults. reliefAmp = perturb ·
// reliefEnvelope(R,g) · mix(0.7,1.0,lodRampOf(distance)). Computed per-capture below.
const PERTURB_DEFAULT = 0.55;                               // planet-lod-lab.html:1997 (cited; state omits it)
const PERTURB_MUL_LO = 0.6;                                 // perturbAnalytic: N − gTan·strength·0.6

// ── linear algebra (three .elements COLUMN-MAJOR: element(row,col)=m[col*4+row]) ──
const mv4 = (m, x, y, z, w) => [
  m[0]*x + m[4]*y + m[8]*z  + m[12]*w,
  m[1]*x + m[5]*y + m[9]*z  + m[13]*w,
  m[2]*x + m[6]*y + m[10]*z + m[14]*w,
  m[3]*x + m[7]*y + m[11]*z + m[15]*w,
];
const norm3 = (v) => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0]/l, v[1]/l, v[2]/l]; };
const dot3  = (a, b) => a[0]*b[0] + a[1]*b[1] + a[2]*b[2];
const sub3  = (a, b) => [a[0]-b[0], a[1]-b[1], a[2]-b[2]];
const mean  = (xs) => xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : 0;
const median = (xs) => { if (!xs.length) return NaN; const a = xs.slice().sort((x,y)=>x-y); return a[Math.floor((a.length-1)/2)]; };
const frac  = (xs, pred) => xs.length ? xs.filter(pred).length / xs.length : 0;

// perturbAnalytic — EXACT reproduction of planet-lod-height.glsl.js:1482.
function perturbAnalytic(N, grad, strength) {
  const gd = dot3(grad, N);
  const gTan = [grad[0] - gd*N[0], grad[1] - gd*N[1], grad[2] - gd*N[2]];
  let p = norm3([N[0] - gTan[0]*strength*PERTURB_MUL_LO, N[1] - gTan[1]*strength*PERTURB_MUL_LO, N[2] - gTan[2]*strength*PERTURB_MUL_LO]);
  const dev = dot3(p, N);
  if (dev < 0.5) p = norm3([0.5*(p[0]+N[0]), 0.5*(p[1]+N[1]), 0.5*(p[2]+N[2])]);   // mix(p,N,0.5)
  return p;
}
// SHADER-REALIZED wall tilt from a sunward wall slope (MF-2 fix). The bare atan(reliefAmp·0.6·slope)
// is the PRE-clamp tilt; perturbAnalytic applies a dev<0.5 mix-back clamp that the shader (and the
// harness's own perturbAnalytic above) actually realizes. Because mix(p,N,0.5) exactly bisects the
// N–p angle, once the pre-clamp tilt exceeds 60° (dev<0.5) the realized tilt is EXACTLY half — so the
// unclamped atan overstates the realized wall tilt (and therefore the carrier→screen loss ratio) by up
// to 2×. We build the shader's own synthetic frame (N=ẑ, gTan=slope·x̂) and read acos(p·ẑ) so the
// number is what the fragment shader produces, not the unclamped formula.
function realizedWallTiltDeg(wallSlope, reliefAmp) {
  const p = perturbAnalytic([0, 0, 1], [wallSlope, 0, 0], reliefAmp);
  return Math.acos(Math.max(-1, Math.min(1, p[2]))) * DEG;
}
// box-filter best-texel retained fraction of a wall of angular width w at pitch P,
// averaged over sub-texel phase (calibration/bake-attenuation.mjs bestTexelFrac model).
function bakeAtten(wDeg, pitchDeg, phases = 1000) {
  let s = 0, s2 = 0, mn = Infinity; const vals = [];
  for (let i = 0; i < phases; i++) {
    const phase = (i / phases) * pitchDeg;
    const start = phase, end = phase + wDeg;
    const t0 = Math.floor(start / pitchDeg), t1 = Math.floor((end - 1e-12) / pitchDeg);
    let best = 0;
    for (let t = t0; t <= t1; t++) {
      const lo = t*pitchDeg, hi = (t+1)*pitchDeg;
      best = Math.max(best, Math.max(0, Math.min(end, hi) - Math.max(start, lo)) / pitchDeg);
    }
    vals.push(best); s += best; s2 += best*best; mn = Math.min(mn, best);
  }
  vals.sort((a,b)=>a-b);
  const m = s/phases;
  return { mean: m, std: Math.sqrt(s2/phases - m*m), min: mn, p05: vals[Math.floor(0.05*phases)] };
}

// per-capture projector from the recorded matrices (adapted from S2 arc-analysis.mjs).
function makeProjector(state, W, H) {
  const P = state.camera.projectionMatrix, V = state.camera.matrixWorldInverse, cam = state.camera.position;
  const wr = state.planetMesh.worldRadius;
  const P00 = P[0], P11 = P[5];
  const project = (wx, wy, wz) => {
    const vv = mv4(V, wx, wy, wz, 1);
    const cc = mv4(P, vv[0], vv[1], vv[2], vv[3]);
    return { x: (cc[0]/cc[3] * 0.5 + 0.5) * W, y: (0.5 - cc[1]/cc[3] * 0.5) * H, w: cc[3] };
  };
  const O2 = cam[0]*cam[0] + cam[1]*cam[1] + cam[2]*cam[2];
  const rayHitsDisc = (px, py) => {
    const ndcx = ((px + 0.5)/W)*2 - 1, ndcy = 1 - ((py + 0.5)/H)*2;
    const dv = [ndcx/P00, ndcy/P11, -1];
    let d = norm3([V[0]*dv[0]+V[1]*dv[1]+V[2]*dv[2], V[4]*dv[0]+V[5]*dv[1]+V[6]*dv[2], V[8]*dv[0]+V[9]*dv[1]+V[10]*dv[2]]);
    const b = 2*(cam[0]*d[0]+cam[1]*d[1]+cam[2]*d[2]), c = O2 - wr*wr, disc = b*b - 4*c;
    if (disc < 0) return false;
    return (-b - Math.sqrt(disc))/2 > 0;
  };
  return { project, rayHitsDisc, cam, wr, P00, P11, V };
}
const lum255 = (png, px, py) => {
  const x = Math.round(px), y = Math.round(py);
  if (x < 0 || y < 0 || x >= png.width || y >= png.height) return -1;
  const i = (y*png.width + x)*4;
  return 0.299*png.data[i] + 0.587*png.data[i+1] + 0.114*png.data[i+2];
};

// ── shared render mesh: buildIrregularSphere(40000, 4) — EXACTLY the lab display mesh
//    (createRiverOverlay ensureMesh TARGET_N=40000 LLOYD_ITERS=4; arc-analysis validated
//    0px projection residual against it). Radius-independent ⇒ built once. ──
const LLOYD = 4, TARGET_N = 40000;
const t0 = Date.now();
const mesh = buildIrregularSphere(TARGET_N, LLOYD);
const meshMs = Date.now() - t0;
const N = mesh.verts.length;
const FP = DRIVER_PRESETS['Moon/Mercury (impact-airless)'];
const PRESET = 'Moon/Mercury (impact-airless)';
const CAPS = ['target-seed1', 'target-reroll1', 'target-reroll2'];

// ── SAMPLING FLOORS (FIX-R2 issue 1) ───────────────────────────────────────────────────
// The content/instrument discriminant, per BUILD-PLAN §1.S3.a, is "the wall falls below what any N
// can resolve at THIS MESH → the population is unresolvable-at-N; the mesh-floor case lands here" — a
// SAMPLING floor, NOT the sub-band DISPLAY floor θ_floor=0.37° (=2·pitch/6, the smallest FULL-contrast
// wall that carries ≥1 band through the best bake TEXEL). 0.37° sits 3× below the bake resolving pitch
// (1.11°) AND below the mesh vertex spacing (~1.02°), so θ_wall≥0.37° is TRUE for every stampable wall
// by construction (the geometric stamp floor δ/4 at MESH_FLOOR_RAD is already 0.79° > 0.37°). A floor
// beneath the sampling grid cannot separate "display eats a RESOLVED wall" from "wall below the
// mesh/bake SAMPLING limit" — the two things S3.a exists to distinguish. We derive the honest sampling
// floors from the grid itself (no taste constant) and convict on the measured split across them.
const MESH_SPACING_DEG = Math.sqrt(4 * Math.PI / N) * DEG;      // ≈1.02° adjacent-vertex spacing at N (2/√N great-circle)
const MESH_NYQUIST_DEG = 2 * MESH_SPACING_DEG;                  // ≈2.03° — a wall needs ≥2 samples across it to carry a slope
const BAKE_PITCH_DEG   = MEASURED_EDGE_DEG;                     // 1.11° effective cube-texel resolving pitch (S0.5)
const BAKE_NYQUIST_DEG = 2 * MEASURED_EDGE_DEG;                 // ≈2.22° — 2 texels (the bake's own Nyquist)
// The discriminant floor = the COARSER sampler's Nyquist: the wall must survive BOTH the mesh and the
// bake, so content = below 2 samples of whichever grid is coarser (bake pitch 1.11° > mesh 1.02°).
const SAMPLING_FLOOR_DEG = 2 * Math.max(MESH_SPACING_DEG, BAKE_PITCH_DEG);   // ≈2.22°

// boot one capture's carrier through the REAL pipeline at its RECORDED drawn radius +
// macroSeed, WITH the S1 budget (route()'s exact composite), and return the composited
// margin gradient the bake would consume.
function bootCarrier(state) {
  const u = deriveUniforms(FP, 1.0);
  const cond = deriveConditionVector(FP, u, state.planetRadiusEarth);
  const carrier = makeSphereField(mesh);
  const bundle = {
    archetype: PRESET_ARCHETYPE[PRESET] ?? null,
    locked: !!(FP && FP.tidalState && FP.tidalState.locked),
    grainDrivers: DEFAULT_GRAIN_DRIVERS,
    bodyDrivers: { ...buildNeutralBodyDrivers(u, FP), condition: cond },
    macroSeed: state.macroSeed, heightSeed: 'e6:' + state.worldSeed, T_eq: FP.T_eq ?? 288,
  };
  const relief = writeBodyRelief(carrier, bundle);
  const budget = relief.reliefBudget;                          // route()'s exact budget object (S1)
  const composited = compositeMargins(carrier, budget);        // w_e·h + sd + w_i·cf (in-domain) — the baked source
  const marginGrad = composited ? computeAdjGradient(carrier, composited) : computeAdjGradient(carrier);
  return { cond, carrier, budget, composited, marginGrad, sched: craterSchedule(cond) };
}

// ── per-capture analysis ─────────────────────────────────────────────────────────────
const captures = [];
for (const cap of CAPS) {
  const state = JSON.parse(fs.readFileSync(join(S2, `${cap}.state.json`)));
  const png = PNG.sync.read(fs.readFileSync(join(S2, `${cap}.png`)));
  const W = png.width, H = png.height;
  const proj = makeProjector(state, W, H);
  const { cam, wr } = proj;

  const { cond, carrier, budget, composited, marginGrad, sched } = bootCarrier(state);
  const g = cond.surfaceGravity;
  const R = state.planetRadiusEarth;
  const relEnv = reliefEnvelope(R, g);
  const lodMix = 0.7 + (1.0 - 0.7) * lodRampOf(state.distance);   // mix(0.7,1.0,lod)
  const reliefAmp = PERTURB_DEFAULT * relEnv * lodMix;
  const verts = carrier.verts;

  // staged light dir (world; matrixWorld identity ⇒ vertex-dir frame)
  const az = state.lightAzimuthDeg * Math.PI/180, el = state.lightElevationDeg * Math.PI/180, ce = Math.cos(el);
  const L = norm3([ce*Math.sin(az), Math.sin(el), ce*Math.cos(az)]);

  // ── RNG-neutral re-enumeration of the population (writer's own single entropy source) ──
  const stamps = [];
  forEachCrater(cond, state.macroSeed, N, (centre, delta, tI, D_km) => {
    stamps.push({ centre, delta, D_km, tI });
  });

  // project + classify visible/lit; compute θ_wall
  for (const s of stamps) {
    const n = verts[s.centre]; s.n = n;
    s.dotCam = dot3(n, cam); s.dotL = dot3(n, L);
    s.visible = s.dotCam > 1; s.lit = s.dotL > 0;
    const pc = proj.project(n[0]*wr, n[1]*wr, n[2]*wr);
    s.cx = pc.x; s.cy = pc.y;
    s.thetaWallDeg = thetaWallRad(s.delta) * DEG;
    s.resolvableDisplay = s.thetaWallDeg >= THETA_FLOOR_DEG;    // OLD sub-band display floor (0.37°) — reported, NOT the discriminant
    s.resolvable = s.thetaWallDeg >= SAMPLING_FLOOR_DEG;        // FIX-R2 issue 1: the honest mesh/bake SAMPLING (Nyquist) floor
    s.incidenceDeg = Math.acos(Math.max(-1, Math.min(1, s.dotL))) * DEG;
    // sunward screen dir ŝ (toward the sun in pixels) — for screen half-annulus split
    const dLn = dot3(L, n);
    const tSun = [L[0]-dLn*n[0], L[1]-dLn*n[1], L[2]-dLn*n[2]];
    const tSl = Math.hypot(...tSun);
    if (tSl > 1e-9) {
      const tHat = [tSun[0]/tSl, tSun[1]/tSl, tSun[2]/tSl];
      const bd = norm3([n[0]+1e-3*tHat[0], n[1]+1e-3*tHat[1], n[2]+1e-3*tHat[2]]);
      const bp = proj.project(bd[0]*wr, bd[1]*wr, bd[2]*wr);
      const sv = [bp.x - s.cx, bp.y - s.cy]; const svl = Math.hypot(sv[0], sv[1]) || 1;
      s.sHat = [sv[0]/svl, sv[1]/svl];
      s.tSunWorld = tHat;   // sunward world tangent at the crater centre
    } else { s.sHat = null; s.tSunWorld = null; }
    // projected rim radius r_proj (angular offset δ/2 along a tangent → pixels)
    const r = 0.5 * s.delta;
    let t1 = norm3(Math.abs(n[1]) < 0.9 ? [n[2], 0, -n[0]] : [1, 0, 0]);
    t1 = norm3([t1[0]-dot3(t1,n)*n[0], t1[1]-dot3(t1,n)*n[1], t1[2]-dot3(t1,n)*n[2]]);
    const rimPx = (tan) => {
      const rd = norm3([n[0]*Math.cos(r)+tan[0]*Math.sin(r), n[1]*Math.cos(r)+tan[1]*Math.sin(r), n[2]*Math.cos(r)+tan[2]*Math.sin(r)]);
      const p = proj.project(rd[0]*wr, rd[1]*wr, rd[2]*wr);
      return Math.hypot(p.x - s.cx, p.y - s.cy);
    };
    s.rProj = 0.5 * (rimPx(t1) + rimPx([-t1[0],-t1[1],-t1[2]]));
  }

  const litDisc = stamps.filter(s => s.visible && s.lit);

  // ── projection self-test ──
  const camDir = norm3(cam);
  const sc = proj.project(camDir[0]*wr, camDir[1]*wr, camDir[2]*wr);
  const selfTestPx = Math.hypot(sc.x - W/2, sc.y - H/2);

  // ── STEP 2/3/4: per-stamp CARRIER wall gradient → predicted Lambert asymmetry, then
  //    bake attenuation, then posterize — traced against the MEASURED screen asymmetry. ──
  // BFS the mesh from each crater centre out to the rim (s ≤ r), collect wall vertices
  // (geodesic angle in [FLOOR_FRAC·r, r]) and classify sun/anti-sun by the tangent offset.
  const adj = carrier.adj;
  const seen = new Int32Array(N); let epoch = 0;
  const queue = new Int32Array(N);

  function wallShade(s) {
    const c = s.centre, nC = verts[c];
    const r = 0.5 * s.delta, wallInner = FLOOR_FRAC * r;
    if (!s.tSunWorld) return null;
    epoch++; let qh = 0, qt = 0; queue[qt++] = c; seen[c] = epoch;
    const litSun = [], litAnti = [], gTanSunProj = [];
    let nWall = 0;
    while (qh < qt) {
      const j = queue[qh++]; const vj = verts[j];
      const sGeo = Math.acos(Math.max(-1, Math.min(1, nC[0]*vj[0] + nC[1]*vj[1] + nC[2]*vj[2])));
      if (sGeo > r * 1.05) continue;                    // outside the bowl — stop flood (small margin)
      if (sGeo >= wallInner && sGeo <= r) {
        // this vertex is on the interior wall
        const gr = [marginGrad[j*3], marginGrad[j*3+1], marginGrad[j*3+2]];
        const shadeN = perturbAnalytic(vj, gr, reliefAmp);
        const diff = Math.max(0, dot3(shadeN, L));
        // sun/anti-sun by the tangent offset from centre projected on the world sunward tangent
        const off = sub3(vj, nC);
        const offTanDot = dot3(off, s.tSunWorld);       // >0 ⇒ sun-facing wall (down-light)
        if (offTanDot > 0) litSun.push(diff); else if (offTanDot < 0) litAnti.push(diff);
        // record the composited-relief wall slope magnitude (tangent gradient) for the DATA-signal report
        const gd = dot3(gr, vj);
        const gTan = [gr[0]-gd*vj[0], gr[1]-gd*vj[1], gr[2]-gd*vj[2]];
        gTanSunProj.push(Math.abs(dot3(gTan, s.tSunWorld)));
        nWall++;
      }
      const nb = adj[j];
      for (let k = 0; k < nb.length; k++) { const m = nb[k]; if (seen[m] !== epoch) { seen[m] = epoch; queue[qt++] = m; } }
    }
    if (litSun.length < 2 || litAnti.length < 2) return null;
    // CARRIER-predicted asymmetry (anti-sun lit − sun-facing shadowed), reflectance [0,1].
    // NOTE (honesty): at reliefAmp·0.6·wallSlope the wall tilt ψ is large (tens of degrees) so
    // this Lambert asymmetry SATURATES near its ~0.5 ceiling for most stamps — it evidences that
    // the wall relief IS present in the data, but its MAGNITUDE is ceiling-bound, not linear.
    const asymCarrier = (mean(litAnti) - mean(litSun));
    // wall slope in the composited relief (the un-saturated DATA signal): |gTan| along sunward,
    // median over wall verts (relief-units per radian). This is the primary "signal-in-data" number.
    const wallSlope = median(gTanSunProj);
    // carrier wall tilt implied by that slope. MF-2: report the SHADER-REALIZED (clamped) tilt as the
    // load-bearing carrierTiltDeg used by the loss ratio; keep the unclamped atan for transparency.
    const carrierTiltUnclampedDeg = Math.atan(reliefAmp * PERTURB_MUL_LO * wallSlope) * DEG;   // pre-clamp
    const carrierTiltDeg = realizedWallTiltDeg(wallSlope, reliefAmp);                          // clamped (shader)
    const incRad = s.incidenceDeg / DEG;
    // BAKE (FIX-R2 issue 2): the 256²/face box filter resamples the wall HEIGHT/SLOPE, BEFORE shading —
    // it does NOT haircut the already-Lambert-SATURATED post-shading asymmetry (the old asymCarrier×atten,
    // which pinned asymCarrier at the ~0.5 ceiling irrespective of slope). bakeAtten.mean IS the best-texel
    // SLOPE-retention fraction (baked adjacent-texel gradient ÷ carrier gradient: for a wall of width w at
    // pitch P the steepest baked texel captures overlap/P·slope). Apply it to the un-saturated wallSlope,
    // THEN re-shade the ATTENUATED slope through the same clamp. For a sub-texel wall (θ_wall<pitch) this
    // smears the sharp arc and drops the effective slope — the mechanism the post-shading multiply could
    // not represent, and the reason bake (a STRUCTURAL sampling limit, not a tunable scale) cannot be
    // excluded from the residual.
    const at = bakeAtten(s.thetaWallDeg, MEASURED_EDGE_DEG);
    const attenMean = at.mean, attenP05 = at.p05;
    const bakedSlopeMean = wallSlope * attenMean;                              // pre-shading slope after the box bake
    const bakedTiltDeg    = realizedWallTiltDeg(bakedSlopeMean, reliefAmp);    // shader-clamped tilt of the BAKED slope
    const bakedTiltP05Deg = realizedWallTiltDeg(wallSlope * attenP05, reliefAmp);
    // model-predicted PEAK opposing-wall Lambert band (ΔL = 2·sin(i)·sin(ψ) ÷ BAND_LUM), pre- vs post-bake:
    const carrierPeakBand = 2 * Math.sin(incRad) * Math.sin(carrierTiltDeg / DEG) / BAND_LUM;
    const bakedPeakBand   = 2 * Math.sin(incRad) * Math.sin(bakedTiltDeg / DEG) / BAND_LUM;
    return {
      nWall, litSunMean: mean(litSun), litAntiMean: mean(litAnti),
      asymCarrier, wallSlope, carrierTiltDeg, carrierTiltUnclampedDeg, incRad,
      attenMean, attenP05, bakedSlopeMean, bakedTiltDeg, bakedTiltP05Deg, carrierPeakBand, bakedPeakBand,
    };
  }
  // back out the EFFECTIVE on-screen wall tilt from a MEASURED reflectance asymmetry:
  //   ΔL = 2·sin(i)·sin(ψ_eff)  ⇒  ψ_eff = asin( ΔL / (2 sin i) ).  This is the real render's
  //   realized wall tilt — measured from actual S2 pixels — the number the instrument loss is read off.
  function screenTiltDeg(reflAsym, incRad) {
    const denom = 2 * Math.sin(incRad);
    if (!(denom > 1e-6)) return NaN;
    return Math.asin(Math.max(-1, Math.min(1, reflAsym / denom))) * DEG;
  }

  // ── SCREEN measurement (S2 pixels): detrended half-mean + peak (the gradient-controlled
  //    metric arc-analysis.mjs used) + the FROZEN raw half-mean MEAN metric — per stamp. ──
  function screenMeasure(s) {
    if (!s.sHat || !Number.isFinite(s.rProj) || s.rProj < 2) return null;
    const rOut = s.rProj, rIn = s.rProj * FLOOR_FRAC;
    const pts = [], up = [], dn = [];
    for (let py = Math.floor(s.cy-rOut); py <= Math.ceil(s.cy+rOut); py++)
      for (let px = Math.floor(s.cx-rOut); px <= Math.ceil(s.cx+rOut); px++) {
        if (px<0||py<0||px>=W||py>=H) continue;
        if (!proj.rayHitsDisc(px, py)) continue;
        const ox = px-s.cx, oy = py-s.cy, d = Math.hypot(ox, oy);
        if (d < rIn || d > rOut) continue;
        const l = lum255(png, px, py);
        const ds = ox*s.sHat[0] + oy*s.sHat[1];         // >0 ⇒ sun-facing (down-light)
        pts.push([ox, oy, l]); if (ds>0) dn.push(l); else if (ds<0) up.push(l);
      }
    if (pts.length < 12 || up.length < 4 || dn.length < 4) return null;
    const rawMeanDiff = mean(up) - mean(dn);            // FROZEN metric (anti-sun − sun), 8-bit
    // detrend: LS plane l = a·ox + b·oy + c, then residual half-mean diff
    let Sxx=0,Sxy=0,Syy=0,Sx=0,Sy=0,S1=0,Sxl=0,Syl=0,Sl=0;
    for (const [x,y,l] of pts){Sxx+=x*x;Sxy+=x*y;Syy+=y*y;Sx+=x;Sy+=y;S1++;Sxl+=x*l;Syl+=y*l;Sl+=l;}
    const M=[[Sxx,Sxy,Sx],[Sxy,Syy,Sy],[Sx,Sy,S1]], rhs=[Sxl,Syl,Sl];
    const det3=(m)=>m[0][0]*(m[1][1]*m[2][2]-m[1][2]*m[2][1])-m[0][1]*(m[1][0]*m[2][2]-m[1][2]*m[2][0])+m[0][2]*(m[1][0]*m[2][1]-m[1][1]*m[2][0]);
    const D0=det3(M);
    let detrendDiff = rawMeanDiff;
    if (Math.abs(D0) >= 1e-6) {
      const rep=(m,c,v)=>m.map((row,i)=>row.map((x,j)=>j===c?v[i]:x));
      const a=det3(rep(M,0,rhs))/D0, b=det3(rep(M,1,rhs))/D0, cc=det3(rep(M,2,rhs))/D0;
      let su=0,nu=0,sd=0,nd=0;
      for (const [x,y,l] of pts){ const res=l-(a*x+b*y+cc); const ds=x*s.sHat[0]+y*s.sHat[1]; if(ds>0){sd+=res;nd++;}else if(ds<0){su+=res;nu++;} }
      detrendDiff = (su/nu) - (sd/nd);
    }
    return { rawMeanDiff, detrendDiff, nPix: pts.length };
  }

  // measure every lit-disc stamp
  const perStamp = [];
  for (const s of litDisc) {
    const shade = wallShade(s);
    const screen = screenMeasure(s);
    // effective on-screen wall tilt backed out from the MEASURED detrended reflectance asymmetry
    const screenTilt = (screen && shade) ? screenTiltDeg(Math.abs(screen.detrendDiff) / 255, s.incidenceDeg / DEG) : null;
    perStamp.push({
      centre: s.centre, D_km: +s.D_km.toFixed(2), deltaDeg: +(s.delta*DEG).toFixed(3),
      thetaWallDeg: +s.thetaWallDeg.toFixed(4), resolvable: s.resolvable, resolvableDisplay: s.resolvableDisplay,
      incidenceDeg: +s.incidenceDeg.toFixed(2), rProj: +s.rProj.toFixed(1),
      carrier: shade ? {
        nWall: shade.nWall,
        wallSlope_reliefPerRad: +shade.wallSlope.toFixed(5),
        carrierTiltDeg: +shade.carrierTiltDeg.toFixed(3),
        carrierTiltUnclampedDeg: +shade.carrierTiltUnclampedDeg.toFixed(3),
        asymCarrier_255_saturating: +(shade.asymCarrier*255).toFixed(2),
        attenMean: +shade.attenMean.toFixed(4), attenP05: +shade.attenP05.toFixed(4),
        bakedTiltDeg: +shade.bakedTiltDeg.toFixed(3),
        carrierPeakBand: +shade.carrierPeakBand.toFixed(3),
        bakedPeakBand: +shade.bakedPeakBand.toFixed(3),
      } : null,
      screen: screen ? {
        rawMeanDiff_255: +screen.rawMeanDiff.toFixed(2),
        detrendDiff_255: +screen.detrendDiff.toFixed(2),
        detrendDiff_bands: +(screen.detrendDiff/BAND_255).toFixed(3),
        screenEffTiltDeg: screenTilt != null ? +screenTilt.toFixed(3) : null,
        showsBand: screen.detrendDiff >= BAND_255,
      } : null,
      // instrument loss for this stamp: carrier wall tilt (data) → realized screen tilt (pixels)
      tiltLossRatio: (shade && screen && screenTilt != null && screenTilt > 1e-6)
        ? +(shade.carrierTiltDeg / screenTilt).toFixed(1) : null,
    });
  }

  // ── STEP 1: θ_wall partition + DEFICIT SPLIT (THE CONVICTION) ──
  // A stamp is measurable if the screen metric returned; it FAILS the bar if its
  // detrended screen asymmetry < 1 band. The deficit is the set of failing measurable
  // stamps; the split is the fraction of that deficit on each side of θ_floor.
  const measurable = perStamp.filter(p => p.screen);
  const resolvable = measurable.filter(p => p.resolvable);       // θ_wall ≥ SAMPLING_FLOOR_DEG (honest floor)
  const subFloor   = measurable.filter(p => !p.resolvable);
  const failing = measurable.filter(p => !p.screen.showsBand);
  const failResolvable = failing.filter(p => p.resolvable);
  const failSubFloor   = failing.filter(p => !p.resolvable);
  const deficitTotal = failing.length;
  // FIX-R2 issue 1: report the deficit split across the FULL floor ladder, so the reader can SEE that the
  // clean 100%-resolvable / 0%-content split was an artifact of the 3×-too-small display floor, not a
  // discovered fact. Content = θ_wall below a sampling floor; instrument = a RESOLVED wall that still fails.
  const floorLadder = [
    ['display_0.37_subBand', THETA_FLOOR_DEG],
    ['mesh_1sample', MESH_SPACING_DEG],
    ['bake_1pitch', BAKE_PITCH_DEG],
    ['mesh_Nyquist_2x', MESH_NYQUIST_DEG],
    ['bake_Nyquist_2texel', BAKE_NYQUIST_DEG],
  ].map(([name, f]) => {
    const sub = failing.filter(p => p.thetaWallDeg < f).length;
    return { floor: name, floorDeg: +f.toFixed(4),
             contentFrac: deficitTotal ? +(sub / deficitTotal).toFixed(4) : 0,
             contentCount: sub, instrumentCount: deficitTotal - sub };
  });
  const deficitSplit = {
    failingTotal: deficitTotal,
    discriminantFloor: 'sampling (mesh/bake Nyquist)',
    discriminantFloorDeg: +SAMPLING_FLOOR_DEG.toFixed(4),
    ownedByResolvable: deficitTotal ? +(failResolvable.length / deficitTotal).toFixed(4) : 0,   // instrument (θ_wall≥sampling floor)
    ownedBySubFloor:   deficitTotal ? +(failSubFloor.length / deficitTotal).toFixed(4) : 0,      // content (θ_wall<sampling floor)
    failResolvableCount: failResolvable.length,
    failSubFloorCount: failSubFloor.length,
    floorLadder,
  };

  // ── STEP 2 aggregate: is the wall signal PRESENT in the carrier DATA? ──
  // FIX-R2 issue 3: signal-in-DATA is floor-INDEPENDENT — measure it over EVERY stamp whose wall the mesh
  // could sample (has a carrier), not only the θ_wall≥sampling-floor subset. The old code gated on the
  // clamp-SATURATED carrierTilt (pinned ~30-40°, non-monotonic in wallSlope), so median(carrierTilt)>5.11°
  // was constant-TRUE by construction and the "allResolvable ∧ ¬signal" branch was structurally unreachable.
  const carrierAll = perStamp.filter(p => p.carrier);
  const carrierWallSlopes = carrierAll.map(p => p.carrier.wallSlope_reliefPerRad);
  const carrierTilts = carrierAll.map(p => p.carrier.carrierTiltDeg);                       // clamped (shader-realized) — SATURATES
  const carrierTiltsUnclamped = carrierAll.map(p => p.carrier.carrierTiltUnclampedDeg);     // pre-clamp (MF-2)
  const carrierAsyms255 = carrierAll.map(p => p.carrier.asymCarrier_255_saturating);
  // slope floor = the un-saturated wall slope whose (pre-clamp) realized tilt equals TILT_FLOOR_DEG:
  //   tan(TILT_FLOOR) = reliefAmp·0.6·slope  ⇒  slopeFloor = tan(TILT_FLOOR)/(reliefAmp·0.6).
  const SLOPE_FLOOR = Math.tan(TILT_FLOOR_DEG / DEG) / (reliefAmp * PERTURB_MUL_LO);
  const carrierSignal = {
    nStampsWithCarrier: carrierAll.length,
    medianWallSlope_reliefPerRad: +median(carrierWallSlopes).toFixed(5),
    medianCarrierTiltDeg: +median(carrierTilts).toFixed(3),
    medianCarrierTiltUnclampedDeg: +median(carrierTiltsUnclamped).toFixed(3),
    medianAsymCarrier_255_saturating: +median(carrierAsyms255).toFixed(2),
    medianAsymCarrier_bands_saturating: +(median(carrierAsyms255)/BAND_255).toFixed(3),
    fracCarrierGe1band_saturating: +frac(carrierAsyms255, x => x >= BAND_255).toFixed(3),
    // FIX-R2 issue 3: gate on the UN-SATURATED slope vs the model-derived SLOPE_FLOOR — a gate that CAN
    // return false. For this data it stays TRUE (the carrier genuinely carries wall slope), so the
    // instrument-side residual is a real display/bake loss, NOT carrier absence — but the gate is now
    // discriminating, not constant-true.
    signalPresentSlopeFloor_reliefPerRad: +SLOPE_FLOOR.toFixed(5),
    signalPresentTiltFloorDeg: +TILT_FLOOR_DEG.toFixed(3),
    fracSlopeAboveFloor: +frac(carrierWallSlopes, x => x > SLOPE_FLOOR).toFixed(3),
    signalPresent: median(carrierWallSlopes) > SLOPE_FLOOR,
    note: 'wallSlope = |composited-relief tangent gradient| along sunward at the wall (relief-units/rad) — the un-saturated DATA signal. signalPresent now gates on wallSlope>SLOPE_FLOOR (a gate that CAN fire false), NOT the clamp-saturated carrierTilt (pinned ~30-40°, non-monotonic in slope — see carrierTiltDeg vs carrierTiltUnclampedDeg). The relief IS in the data (slope well above floor); asymCarrier_255 SATURATES at the Lambert ceiling so its magnitude is a ceiling, not linear — used only to show sign/presence.',
  };

  // ── STEP 3 aggregate: bake attenuation — applied to the PRE-shading SLOPE (FIX-R2 issue 2) ──
  const attens = carrierAll.map(p => p.carrier.attenMean);
  const carrierPeakBands = carrierAll.map(p => p.carrier.carrierPeakBand);
  const bakedPeakBands = carrierAll.map(p => p.carrier.bakedPeakBand);
  const bakedTilts = carrierAll.map(p => p.carrier.bakedTiltDeg);
  const bakeLayer = {
    medianAttenAtWall_boxModel: +median(attens).toFixed(4),
    medianCarrierPeakBand_preBake: +median(carrierPeakBands).toFixed(3),
    medianBakedPeakBand_postBake: +median(bakedPeakBands).toFixed(3),
    medianBakedTiltDeg: +median(bakedTilts).toFixed(3),
    note: 'FIX-R2 issue 2: bake now attenuates the un-saturated wall SLOPE (bakedSlope = wallSlope·bestTexelFrac) BEFORE shading, then re-shades — not the post-shading saturated asymmetry. The best-texel box model still leaves both PEAK bands >>1 (the clamp/Lambert saturation absorbs a ~25% slope haircut), so this box model alone does not collapse the wall. But a full sub-texel bake SMEARS the arc over a texel (beyond the best-texel retained fraction), and the GPU CubeCamera bake is un-runnable headless — so bake is a STRUCTURAL, unexcluded co-owner of the model→measured residual (predicted median bakedPeakBand vs the arc-report measured peak of ~1-2 bands). Bake is NOT ruled out; the bake-vs-display sub-split is deferred to the live 256→512 falsifier.',
  };

  // ── STEP 4 aggregate: MEASURED screen tilt vs carrier tilt — THE INSTRUMENT-LOSS number ──
  const screenTilts = perStamp.filter(p => p.screen && p.screen.screenEffTiltDeg != null && p.resolvable).map(p => p.screen.screenEffTiltDeg);
  const tiltLosses = perStamp.filter(p => p.tiltLossRatio != null && p.resolvable).map(p => p.tiltLossRatio);
  const screenAsyms = measurable.map(p => p.screen.detrendDiff_bands);
  const medCarrierTilt = median(carrierTilts);                 // clamped (MF-2)
  const shadingQuant = {
    reliefAmp: +reliefAmp.toFixed(4), reliefEnvelope: +relEnv.toFixed(4), perturbAssumed: PERTURB_DEFAULT, lodMix: +lodMix.toFixed(4),
    medianScreenEffTiltDeg_meanMetric: +median(screenTilts).toFixed(3),
    medianCarrierTiltDeg: +medCarrierTilt.toFixed(3),
    medianCarrierTiltUnclampedDeg: +median(carrierTiltsUnclamped).toFixed(3),
    // MEAN-metric loss (the diluted number — see peakReconciliation for why this OVER-states the loss):
    medianTiltLossRatio_meanMetric: +median(tiltLosses).toFixed(1),
    measured_medianScreenAsym_bands: +median(screenAsyms).toFixed(3),
    measured_fracScreenGe1band: +frac(screenAsyms, x => x >= 1).toFixed(3),
    note: 'screenEffTilt_meanMetric = wall tilt backed out from the MEASURED detrended half-annulus MEAN reflectance asymmetry (real S2 pixels) via ΔL=2·sin(i)·sin(ψ). tiltLossRatio_meanMetric = clampedCarrierTilt/meanScreenTilt. MF-1: the MEAN dilutes a thin peak wall arc, so this loss is an UPPER bound; peakReconciliation supplies the honest peak-based loss (~7×). reliefAmp = perturb(0.55)·reliefEnvelope(R,g)·lodMix.',
  };

  // ── PEAK-vs-MEAN reconciliation (MF-1): does the wall arc-shadow reach ≥1 band at PEAK on real
  //    S2 pixels? Ingest the arc-report's OWN per-render peak diagnostic and test it statistically. ──
  const arc = arcByCapture[cap];
  const gc = arc && arc.diagnostics_NOT_the_bar && arc.diagnostics_NOT_the_bar.gradientControlled;
  let peakReconciliation = null;
  if (gc) {
    const pc = gc.peakDiff_crater_fracGe1band, pf = gc.peakDiff_flatControl_fracGe1band, nC = gc.controlN;
    // two-proportion z-test: is the crater peak ≥1-band fraction distinguishable from the flat control?
    const pool = (pc * nC + pf * nC) / (2 * nC);
    const se = Math.sqrt(pool * (1 - pool) * (2 / nC));
    const z = se > 0 ? (pc - pf) / se : Infinity;
    const pVal = normalUpperTail(z);
    // realized PEAK screen tilt: the peak CLEARS ≥1 band, so ψ_peak ≥ TILT_FLOOR_DEG (5.11°). We report
    // the floor it clears (a lower bound on realized peak tilt) and the honest loss against it.
    peakReconciliation = {
      source: 'evidence/S2/arc-report.json renders[].diagnostics_NOT_the_bar.gradientControlled',
      peakDiff_crater_fracGe1band: pc,
      peakDiff_flatControl_fracGe1band: pf,
      controlN: nC,
      craterExcessOverControl: +(pc - pf).toFixed(3),
      twoProportionZ: +z.toFixed(2),
      pValue: pVal < 1e-12 ? '<1e-12' : pVal.toExponential(2),
      // On-screen-at-peak = statistically significant (z>3.29 ⇒ p<0.0005 one-sided) AND materially
      // above the control (excess >0.2 = >1.2 posterize bands of extra crater hit-rate, a conservative
      // effect-size guard against a significant-but-tiny difference). NON-load-bearing here: the measured
      // excesses are 0.69/0.82/0.70 (z=13.9/16.5/14.1), ~3.5× the 0.2 guard and ~4× the z threshold.
      arcShadowOnScreenAtPeak: (z > 3.29 && pc - pf > 0.2),
      peakScreenTiltFloorDeg: +TILT_FLOOR_DEG.toFixed(3),
      medianCarrierTiltDeg_clamped: +medCarrierTilt.toFixed(3),
      peakBasedTiltLossRatio: +(medCarrierTilt / TILT_FLOOR_DEG).toFixed(2),
      detrendHalfMean_crater_mean_255: gc.detrendHalfMean_crater_mean,
      detrendHalfMean_flatControl_mean_255: gc.detrendHalfMean_flatControl_mean,
      note: 'MF-1: the arc-report hand-waved the peak as "indistinguishable from posterize/dither noise". That is FALSE — the flat control fixes the dither/posterize outlier rate (pf), and the crater peak fraction pc is z>>3.29 above it, so the wall arc-shadow IS on screen at PEAK. The S2 FAIL is therefore PART metric-dilution (the frozen half-annulus MEAN averages a thin peak arc away) + PART display-attenuation (~clampedCarrierTilt/5.11° ≈ 7× residual), NOT a ~217× pure display loss. Even the MEAN detrended crater signal is 17× the flat control with correct sign (0.84 vs 0.05).',
    };
  }

  // ── LARGEST-BASIN ANCHOR (cross-checks against arc-report.json largestBasinLand) ──
  const litVis = litDisc.slice().sort((a,b)=>b.D_km-a.D_km);
  const lb = litVis[0] ? perStamp.find(p => p.centre === litVis[0].centre) : null;
  const largestBasinAnchor = lb ? {
    centre: lb.centre, D_km: lb.D_km, thetaWallDeg: lb.thetaWallDeg, resolvable: lb.resolvable,
    carrierTiltDeg: lb.carrier?.carrierTiltDeg ?? null,                        // clamped (MF-2)
    carrierTiltUnclampedDeg: lb.carrier?.carrierTiltUnclampedDeg ?? null,      // pre-clamp
    carrierAsym_255_saturating: lb.carrier?.asymCarrier_255_saturating ?? null,
    measuredScreenDetrend_255: lb.screen?.detrendDiff_255 ?? null,
    screenEffTiltDeg: lb.screen?.screenEffTiltDeg ?? null,
    tiltLossRatio: lb.tiltLossRatio,
    note: 'The single largest basin (θ_wall well ABOVE the sampling floor — an unambiguous INSTRUMENT case): cross-check vs S2 arc-report.json largestBasinLand. Carrier tilt (clamped/shader-realized) is tens of degrees (data present) yet the realized MEAN-metric screen tilt is ~1–3° — an instrument residual (bake ⊕ display-scale, non-separable headlessly), but see peakReconciliation: at PEAK the arc-shadow does clear ≥1 band (metric-dilution is part of the MEAN gap).',
  } : null;

  // ── STEP 5: metric-limitation honesty within the ≥floor partition ──
  const rawMeans = resolvable.map(p => p.screen.rawMeanDiff_255);
  const detrends = resolvable.map(p => p.screen.detrendDiff_255);
  const metricHonesty = {
    partitionN: resolvable.length,
    frozenRawMean_mean_255: +mean(rawMeans).toFixed(2),
    frozenRawMean_fracGe1band: +frac(rawMeans, x => x >= BAND_255).toFixed(3),
    detrended_mean_255: +mean(detrends).toFixed(2),
    detrended_fracGe1band: +frac(detrends, x => x >= BAND_255).toFixed(3),
    detrended_fracPositiveSign: +frac(detrends, x => x > 0).toFixed(3),
    note: 'Frozen half-annulus MEAN vs gradient-detrended, both 8-bit. MF-1: the MEAN under-measures because a thin peak wall arc is averaged over the whole half-annulus — see peakReconciliation, where the arc-report PEAK diagnostic shows ≥1 band on ~80% of craters (vs 11% flat control, z>>3.29). So the MEAN metric is a real dilution contributor; it never substitutes for the deficit split (see deficitSplit — floor-bracketed, content-majority at the sampling floors; this note was corrected at the S3 adjudication seam, it previously carried a stale v1 literal).',
  };

  captures.push({
    capture: cap, W, H,
    worldSeed: state.worldSeed, macroSeed: state.macroSeed,
    planetRadiusEarth: R, gravity: +g.toFixed(4), isImpactSurface: isImpactSurface(cond),
    budget: budget ? { inDomain: budget.inDomain, f_I: +(budget.f_I ?? 0).toFixed(5) } : null,
    schedule: { fired: sched.fired, nStamp: sched.nStamp, D_FLOOR_KM: +sched.D_FLOOR_KM.toFixed(1), D_HI_KM: +sched.D_HI_KM.toFixed(1), tExp: +sched.tExp.toFixed(3) },
    projectionSelfTestPx: +selfTestPx.toFixed(3),
    reliefAmp: +reliefAmp.toFixed(4),
    stampCounts: {
      total: stamps.length, litDisc: litDisc.length, measurable: measurable.length,
      resolvable: resolvable.length, subFloor: subFloor.length,
    },
    thetaWallStats: {
      displayFloorDeg_rejected: THETA_FLOOR_DEG,                                 // 0.37° — the sub-band DISPLAY floor (FIX-R2: not the discriminant)
      samplingFloorDeg: +SAMPLING_FLOOR_DEG.toFixed(4),                          // the honest mesh/bake Nyquist floor used for the split
      meshSpacingDeg: +MESH_SPACING_DEG.toFixed(4), bakePitchDeg: +BAKE_PITCH_DEG.toFixed(4),
      minThetaWallDeg: +Math.min(...litDisc.map(s => s.thetaWallDeg)).toFixed(4),
      medianThetaWallDeg: +median(litDisc.map(s => s.thetaWallDeg)).toFixed(4),
      maxThetaWallDeg: +Math.max(...litDisc.map(s => s.thetaWallDeg)).toFixed(4),
      geometricFloorThetaWallDeg: +(thetaWallRad(MESH_FLOOR_RAD) * DEG).toFixed(4),
      allResolvableDisplayFloor: litDisc.every(s => s.resolvableDisplay),        // TRUE — the 0.37° artifact (100% "resolvable")
      allResolvable: litDisc.every(s => s.resolvable),                           // vs the SAMPLING floor — FALSE (walls fall below the grid)
    },
    deficitSplit,
    carrierSignal,
    bakeLayer,
    shadingQuant,
    peakReconciliation,
    largestBasinAnchor,
    metricHonesty,
    _perStamp: perStamp,
  });
}

// ── CONVICTION (measured, per BUILD-PLAN §1.S3.a) ──────────────────────────────────────
const seed1 = captures.find(c => c.capture === 'target-seed1');
// deficit split across all three captures (seed1 primary)
const allFailing = captures.reduce((a, c) => a + c.deficitSplit.failingTotal, 0);
const allFailResolvable = captures.reduce((a, c) => a + c.deficitSplit.failResolvableCount, 0);
const allFailSubFloor = captures.reduce((a, c) => a + c.deficitSplit.failSubFloorCount, 0);
const overallSplit = {
  failingTotal: allFailing,
  ownedByResolvable: allFailing ? +(allFailResolvable / allFailing).toFixed(4) : 0,
  ownedBySubFloor: allFailing ? +(allFailSubFloor / allFailing).toFixed(4) : 0,
};

// Decide verdict by the SAMPLING-floor inequality + the chain trace on seed1.
const allResolvable = captures.every(c => c.thetaWallStats.allResolvable);      // vs the SAMPLING floor (now FALSE)
const carrierHasSignal = seed1.carrierSignal.signalPresent;                     // now on the un-saturated slope
// MEAN-metric loss (diluted; MF-1 shows this OVER-states the display loss).
const medTiltLoss = median(captures.map(c => c.shadingQuant.medianTiltLossRatio_meanMetric));
// PEAK-based loss (instrument residual): clamped carrier tilt (MF-2) ÷ 1-band peak screen-tilt floor.
const peakCaps = captures.filter(c => c.peakReconciliation);
const medPeakLoss = peakCaps.length ? median(peakCaps.map(c => c.peakReconciliation.peakBasedTiltLossRatio)) : null;
const arcOnScreenAtPeak = peakCaps.length > 0 && peakCaps.every(c => c.peakReconciliation.arcShadowOnScreenAtPeak);

// FIX-R2 issue 1: the content share is FLOOR-SENSITIVE — that sensitivity IS the finding. Read the deficit
// split at the conservative 1-sample floor (only UNAMBIGUOUSLY-sub-texel walls = content) and at the strict
// 2-sample Nyquist floor, across all captures. Deciding on the ladder (not a single floor) is exactly the
// discipline the old 0.37° floor violated (a floor whose value pre-ordained "100% resolvable").
const ladderFrac = (name) => median(captures.map(c => c.deficitSplit.floorLadder.find(f => f.floor === name).contentFrac));
// contentUnambig = below the FINEST grid's 1-sample spacing (mesh ≈1.02°): walls fully inside a single
//   sample of even the finest sampler — unambiguously sub-grid. Clean CONTENT requires THIS to be the
//   majority, so a knife-edge coarser-sampler floor cannot pre-ordain a single-owner verdict.
// contentNyquist = below the coarser sampler's 2-sample Nyquist (bake ≈2.22°): the strict resolved floor.
const contentUnambig = ladderFrac('mesh_1sample');
const contentNyquist = ladderFrac('bake_Nyquist_2texel');
const contentLo = ladderFrac('bake_1pitch');            // reported range endpoints (1-sample coarser floor)
const contentHi = contentNyquist;
const contentMesh = ladderFrac('mesh_Nyquist_2x');
const instrumentResidual = 1 - contentNyquist;          // resolved-but-still-failing share (never < ~0.12 here)

let verdict, convictedLayer, evidence;
if (contentUnambig > 0.5) {
  // The MAJORITY of the deficit is below even the FINEST grid's 1-sample spacing — unambiguously sub-grid.
  verdict = 'CONTENT';
  convictedLayer = 'sub-mesh/bake-sampling population (θ_wall below the finest grid, unresolvable-at-N)';
  evidence = `${(contentUnambig*100).toFixed(0)}% of the read deficit is θ_wall below the finest grid's 1-sample spacing — unambiguously sub-grid. The wall population falls below what the mesh/bake grid can carry. Fix is population/mesh, not display.`;
} else if (contentNyquist > 0.5) {
  // The honest sampling floors STRADDLE 0.5: content is a large minority at the 1-sample floor and the
  // majority at Nyquist; the resolvable-but-failing remainder is a genuine instrument residual whose
  // bake-vs-display sub-split is not separable headlessly. Both layers are MATERIAL — neither excludable.
  verdict = 'MIXED';
  convictedLayer = `MIXED (floor-sensitive): CONTENT = walls below the mesh/bake SAMPLING floor (${(contentLo*100).toFixed(0)}% of the deficit at the 1-sample floor → ${(contentHi*100).toFixed(0)}% at the 2-texel Nyquist floor) + INSTRUMENT = a resolved-wall residual (bake sub-texel arc-smear ⊕ display-rendering-scale, NOT sub-splittable headlessly). Neither content nor instrument is excludable by measurement.`;
  evidence = `FIX-R2 overturns the S3-v1 clean INSTRUMENT verdict. (issue 1) The v1 discriminant floor θ_floor=0.37° is a sub-band DISPLAY floor (=2·pitch/6) sitting 3× below the bake pitch (${BAKE_PITCH_DEG}°) and below the mesh spacing (${seed1.thetaWallStats.meshSpacingDeg}°), so its "100% resolvable / 0% content" split was GUARANTEED by the floor choice (every stampable wall δ/4≥0.79°>0.37°), not discovered. At the HONEST mesh/bake sampling floor the deficit split flips: content is ${(contentLo*100).toFixed(0)}% at the 1-sample floor (${BAKE_PITCH_DEG}°), ${(contentMesh*100).toFixed(0)}% at the mesh Nyquist, and ${(contentHi*100).toFixed(0)}% at the 2-texel bake Nyquist (${BAKE_NYQUIST_DEG.toFixed(2)}°) — content is a material-to-majority owner, NOT excluded. (issue 3) On the un-saturated slope, carrier signalPresent=${carrierHasSignal} (median wallSlope ${seed1.carrierSignal.medianWallSlope_reliefPerRad} > slope floor ${seed1.carrierSignal.signalPresentSlopeFloor_reliefPerRad}) — the resolved-wall residual is a real display/bake loss, not carrier absence; the v1 gate median(clampedTilt)=${seed1.carrierSignal.medianCarrierTiltDeg}°>5.11° was constant-true by clamp saturation. (issue 2) With bake applied to the pre-shading SLOPE, the box model's ~25% slope haircut is absorbed by the clamp (median bakedPeakBand ${seed1.bakeLayer.medianBakedPeakBand_postBake} still ≫1), so the best-texel model alone does not collapse the wall — but full sub-texel arc-smear is un-modellable headlessly (GPU bake un-runnable), so BAKE remains an unexcluded co-owner of the instrument residual alongside display-scale (~${medPeakLoss}× clamped-carrier→peak-floor). Convicted: MIXED — content (sub-sampling walls) and instrument (non-sub-splittable bake⊕display residual) are both material; the v1 single-owner "display-rendering-scale" conviction was an artifact of three constant-true routing gates.`;
} else if (allResolvable && carrierHasSignal) {
  verdict = 'INSTRUMENT';
  convictedLayer = 'instrument (bake ⊕ display residual, not sub-splittable headlessly) — content excluded at the sampling floor';
  evidence = `θ_wall≥sampling floor for all stamps and the carrier carries slope above the signal floor, yet the wall renders weak — instrument. Content share only ${(contentHi*100).toFixed(0)}% at Nyquist. Bake and display co-own the residual (not headlessly separable).`;
} else if (allResolvable && !carrierHasSignal) {
  verdict = 'INSTRUMENT';
  convictedLayer = 'carrier-gradient-or-mesh-resolution';
  evidence = `All stamps are ≥ the sampling floor so this is NOT content, yet the composited-relief wall slope is below the signal floor (median wallSlope ${seed1.carrierSignal.medianWallSlope_reliefPerRad} ≤ ${seed1.carrierSignal.signalPresentSlopeFloor_reliefPerRad}) — attenuated at the carrier/mesh-gradient stage, upstream of the display.`;
} else {
  verdict = 'MIXED';
  convictedLayer = 'mixed';
  evidence = `Deficit split at the sampling floor: ${(overallSplit.ownedByResolvable*100).toFixed(0)}% resolvable / ${(overallSplit.ownedBySubFloor*100).toFixed(0)}% sub-floor; content ladder ${(contentLo*100).toFixed(0)}%→${(contentHi*100).toFixed(0)}%.`;
}

const report = {
  meta: {
    workstream: 'world-engine-inc3b-relief-budget-2026-07-21', slice: 'S3.a', gate: 'diagnosis (content-vs-instrument)', fixRound: 2,
    ironLaw: 'θ_wall ≷ the SAMPLING floor (mesh/bake Nyquist, ≈2.22°) discriminant — NOT the sub-band display floor 0.37° (FIX-R2 issue 1); conviction = measured deficit split across the floor ladder (BUILD-PLAN §1.S3.a / lens-log MF-3). No fix chosen here.',
    generated: 'deterministic (no wall-clock in payload)',
    meshN: N, lloyd: LLOYD,
    displayFloorDeg_rejected: THETA_FLOOR_DEG, samplingFloorDeg: +SAMPLING_FLOOR_DEG.toFixed(4),
    meshSpacingDeg: +MESH_SPACING_DEG.toFixed(4), bakePitchDeg: +BAKE_PITCH_DEG.toFixed(4), measuredEdgeDeg: MEASURED_EDGE_DEG, posterizeLevels: LEVELS,
    bakeModelSubstitution: 'The 256²/face GPU CubeCamera bake (createHeightCube/bakeHeightCube, planet-lod-tectonic.js) requires a WebGL renderer and is NOT runnable headless. Its attenuation is modeled with the committed box-filter model (calibration/bake-attenuation-model.json, S0.5) — flagged, not hidden.',
    perturbAssumption: `state JSON omits 'perturb'; the lab default 0.55 (planet-lod-lab.html:1997) is used with reliefEnvelope(R,g) and lodRampOf(distance) to reconstruct reliefAmp. Sensitivity: reliefAmp scales the carrier asymmetry ~linearly.`,
  },
  verdict: {
    verdict, convictedLayer, evidence,
    deficitSplit_overall_samplingFloor: overallSplit,
    contentShare_1sampleFloor: contentLo,
    contentShare_meshNyquist: contentMesh,
    contentShare_bakeNyquist: contentHi,
    allStampsResolvable_samplingFloor: allResolvable,
    allStampsResolvable_displayFloor: captures.every(c => c.thetaWallStats.allResolvableDisplayFloor),
    carrierSignalPresent_slopeGate: carrierHasSignal,
    arcShadowOnScreenAtPeak: arcOnScreenAtPeak,
    meanMetricTiltLoss_OVERstated: medTiltLoss,
    instrumentResidualPeakLoss: medPeakLoss,
    convictionRule: 'FIX-R2: discriminant = θ_wall ≷ the SAMPLING floor (mesh/bake Nyquist), read across the floor ladder — NOT the sub-band display floor 0.37° (which pre-ordained 100% resolvable). contentLo>0.5 ⇒ CONTENT; contentLo≤0.5<contentHi ⇒ MIXED (content + non-sub-splittable bake⊕display residual, both material); contentHi<~0.5 ∧ slope-signal-present ⇒ INSTRUMENT. Bake is applied to the pre-shading slope (not the saturated asymmetry) so it is a co-owner, not excluded; signalPresent gates on the un-saturated slope. Measured split reported; no side forced.',
  },
  captures: captures.map(({ _perStamp, ...c }) => c),
  perStamp_seed1: seed1._perStamp,
};

fs.writeFileSync(join(HERE, 's3-diagnosis-report.json'), JSON.stringify(report, null, 2) + '\n');

// ── console summary ──
console.log('=== S3.a diagnosis (content vs instrument, by measurement) ===');
console.log(`mesh ${N} verts (LLOYD ${LLOYD}) in ${meshMs}ms; θ_floor ${THETA_FLOOR_DEG}° measuredEdge ${MEASURED_EDGE_DEG}° levels ${LEVELS}`);
for (const c of captures) {
  console.log(`\n${c.capture}: R=${c.planetRadiusEarth.toFixed(3)} g=${c.gravity} nStamp=${c.schedule.nStamp} litDisc=${c.stampCounts.litDisc} measurable=${c.stampCounts.measurable} reliefAmp=${c.reliefAmp}`);
  console.log(`  θ_wall: min ${c.thetaWallStats.minThetaWallDeg}° median ${c.thetaWallStats.medianThetaWallDeg}° max ${c.thetaWallStats.maxThetaWallDeg}° | samplingFloor ${c.thetaWallStats.samplingFloorDeg}° (mesh ${c.thetaWallStats.meshSpacingDeg}° / bake ${c.thetaWallStats.bakePitchDeg}°) | ALL≥0.37 display floor: ${c.thetaWallStats.allResolvableDisplayFloor} | ALL≥sampling floor: ${c.thetaWallStats.allResolvable}`);
  console.log(`  DEFICIT SPLIT @ sampling floor: failing ${c.deficitSplit.failingTotal} → instrument(res) ${(c.deficitSplit.ownedByResolvable*100).toFixed(0)}% / content(sub) ${(c.deficitSplit.ownedBySubFloor*100).toFixed(0)}%`);
  console.log(`    ladder content%: ${c.deficitSplit.floorLadder.map(f => `${f.floor}=${(f.contentFrac*100).toFixed(0)}%`).join('  ')}`);
  console.log(`  CARRIER (data, un-saturated slope): wallSlope ${c.carrierSignal.medianWallSlope_reliefPerRad} > slopeFloor ${c.carrierSignal.signalPresentSlopeFloor_reliefPerRad}? signalPresent=${c.carrierSignal.signalPresent} (clampedTilt ${c.carrierSignal.medianCarrierTiltDeg}° SATURATES)`);
  console.log(`  BAKE (on pre-shading SLOPE): atten ${c.bakeLayer.medianAttenAtWall_boxModel} → bakedPeakBand ${c.bakeLayer.medianBakedPeakBand_postBake} (box haircut absorbed by clamp; sub-texel arc-smear un-modellable headlessly ⇒ bake NOT excluded)`);
  console.log(`  SCREEN (MEAN metric): eff tilt ${c.shadingQuant.medianScreenEffTiltDeg_meanMetric}° vs clamped carrier ${c.shadingQuant.medianCarrierTiltDeg}° (unclamped ${c.shadingQuant.medianCarrierTiltUnclampedDeg}°) ⇒ MEAN-metric tiltLoss ${c.shadingQuant.medianTiltLossRatio_meanMetric}× (OVER-stated) | screen asym ${c.shadingQuant.measured_medianScreenAsym_bands} bands`);
  if (c.peakReconciliation) console.log(`  PEAK (MF-1): crater ≥1band ${c.peakReconciliation.peakDiff_crater_fracGe1band} vs flat ${c.peakReconciliation.peakDiff_flatControl_fracGe1band} (z=${c.peakReconciliation.twoProportionZ}, p=${c.peakReconciliation.pValue}) onScreenAtPeak=${c.peakReconciliation.arcShadowOnScreenAtPeak} ⇒ HONEST loss ${c.peakReconciliation.peakBasedTiltLossRatio}× (clamped ${c.peakReconciliation.medianCarrierTiltDeg_clamped}°→peak floor ${c.peakReconciliation.peakScreenTiltFloorDeg}°)`);
  if (c.largestBasinAnchor) console.log(`  LARGEST BASIN D=${c.largestBasinAnchor.D_km}km: clamped carrier tilt ${c.largestBasinAnchor.carrierTiltDeg}° (unclamped ${c.largestBasinAnchor.carrierTiltUnclampedDeg}°) → MEAN screen tilt ${c.largestBasinAnchor.screenEffTiltDeg}° (screen detrend ${c.largestBasinAnchor.measuredScreenDetrend_255}/255)`);
  console.log(`  METRIC: frozen raw-mean ${c.metricHonesty.frozenRawMean_mean_255}/255 (≥1band ${c.metricHonesty.frozenRawMean_fracGe1band}) vs detrended ${c.metricHonesty.detrended_mean_255}/255 (≥1band ${c.metricHonesty.detrended_fracGe1band}, +sign ${c.metricHonesty.detrended_fracPositiveSign})`);
}
console.log(`\n=== VERDICT: ${verdict} — convicted layer: ${convictedLayer} ===`);
console.log(`overall deficit split: resolvable ${(overallSplit.ownedByResolvable*100).toFixed(1)}% / sub-floor ${(overallSplit.ownedBySubFloor*100).toFixed(1)}% (failing ${overallSplit.failingTotal})`);
console.log(evidence);
console.log(`report → ${join(HERE, 's3-diagnosis-report.json')}`);
