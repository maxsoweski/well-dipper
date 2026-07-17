// docs/WORKSTREAMS/world-engine-v2-5-bombardment-2026-07-17/calibration/crater-scale.mjs
// World Engine V2-5 (bombardment) — crater SCALE calibration probe (BUILD-PLAN §7.1, §2a, §4).
//
// PURPOSE: pin every HORIZONTAL (geodesic-radian) and VERTICAL (normalized-height) crater constant the
// writer (src/worldengine/base/bombardment.js) bakes, against REAL measured numbers rather than guesses —
// the passiveMargins MARGIN_LIFT_N = 0.1127 precedent (calibration is committed evidence, not a hand-wave).
// It:
//   • measures meanEdgeAngle on the real deterministic mesh at the lab render resolution (N≈40000) and
//     asserts the giant-basin size band is node-RESOLVABLE (D_MAX_RAD / meanEdgeAngle ≥ 10 — BUILD-PLAN §4);
//   • prints the node-span of each size bin at the lab N (so the "few dominant basins over a peppered
//     small-crater texture" read is grounded, not assumed);
//   • reads the LIVE despun height amplitude (the crater channel lives in the SAME normalized-height units
//     as carrier.height) and anchors the vertical amplitude constant CRATER_DEPTH_N + the legibility floor
//     MIN_BASIN_DEPTH_N to it (M-m3 — amplitude is normalized-height, NOT a bare fraction×radians);
//   • asserts A(D_MAX) ≥ MIN_BASIN_DEPTH_N (the giant basins render as visible bowls, not dimples);
//   • prints the candidate radial profile (floor / wall / rim / ejecta) sampled at both size extremes and
//     confirms it is TWO-SIGNED (bowl floor < 0 AND raised rim > 0) — the cratered-silhouette requirement.
//
// The `craterProfile` / A(D) here are TEXTUALLY the writer's — the printed BAKED CONSTANTS are copied into
// bombardment.js verbatim, and the vitest suite (AC-CHANNEL/AC-POWERLAW/AC-MULTIPLY) binds the writer's
// actual output back to these numbers, so calibration and writer cannot drift.
//
// METERED-SAFE: pure `node`, no `claude -p`.  Run:  node docs/WORKSTREAMS/.../calibration/crater-scale.mjs
import { makeSphereField } from '../../../../src/worldengine/base/sphereField.js';
import { buildIrregularSphere, writeBodyRelief } from '../../../../planet-lod-rivers.js';
import { DRIVER_PRESETS } from '../../../../driver-presets.js';
import { buildNeutralBodyDrivers } from '../../../../body-drivers.js';
import { deriveConditionVector } from '../../../../body-condition-vector.js';
import { deriveUniforms } from '../../../../planet-lod-lab-core.js';

const QUALITY_TIER = 1.0;
const LAB_N = 40000;             // the lab render mesh (BUILD-PLAN §4 resolution check)
const AMP_N = 8000;             // amplitude-measurement mesh (despun amplitude is ~resolution-independent)

// ── CANDIDATE CONSTANTS (the values baked into bombardment.js) ────────────────────────────────────
// Horizontal size band (geodesic radians, resolution-independent — the passiveMargins trick).
const D_MIN_RAD = 0.05;         // ~2.9° — small end, ~3 nodes at the lab N (peppered texture)
const D_MAX_RAD = 0.50;         // ~28.6° — giant basins, ~26 nodes at the lab N (carry the read)
// Vertical amplitude (normalized-height units, same scale as carrier.height). A(D) = CRATER_DEPTH_N·(D/D_REF)^DEPTH_POW.
const CRATER_DEPTH_N = 0.18;    // bowl amplitude of a D_REF-diameter crater (≈0.81× the despun p95-p5 span — a dominant basin)
const D_REF_RAD = 0.50;         // reference angular diameter (= D_MAX ⇒ A(D_MAX) = CRATER_DEPTH_N)
const DEPTH_POW = 0.5;          // sub-linear depth↑ with size (real d/D flattening; ∈[0,1])
const MIN_BASIN_DEPTH_N = 0.08; // legibility floor: the biggest basin must be ≥ this deep (M-m3)
// Dimensionless profile-SHAPE constants (horizontal fractions of D + vertical fractions of A).
const FLOOR_FRAC = 0.5;         // flat floor out to FLOOR_FRAC·(D/2) from centre
const RIM_HEIGHT_FRAC = 0.20;   // rim crest at +RIM_HEIGHT_FRAC·A (raised rim; physical rim/depth ≈ 0.2 — see NOTE)
const EJECTA_FRAC = 0.05;       // ejecta-apron lift at +EJECTA_FRAC·A, decaying to 0
const RIM_W = 0.1;              // rim zone width = RIM_W·D beyond the crest
const RIM_FRAC = 1.0;           // ejecta-apron outer edge = RIM_FRAC·D beyond the crest ⇒ stamp radius = D/2 + RIM_FRAC·D
// NOTE (deviation from the plan's literal "RIM_HEIGHT_FRAC ≈ 0.04"): a rim at 4% of the bowl depth is
// visually inert (the bowl is −A, a +0.04·A rim barely reads). Real fresh craters have rim height ≈ 0.04·D
// over depth ≈ 0.2·D ⇒ rim/depth ≈ 0.2. Since A is the (normalized-height) BOWL depth, the physically
// faithful + legible fraction is 0.20, not 0.04. Recorded in BUILD-PLAN §10 (adjudicable — calibration is
// the source of truth for the profile-shape constants).

// A(D): vertical bowl amplitude (normalized-height) of a crater of angular diameter D (radians).
function craterAmplitude(D) { return CRATER_DEPTH_N * Math.pow(D / D_REF_RAD, DEPTH_POW); }

// craterProfile(s, D): radial displacement (normalized-height) at geodesic angle s from the crater centre.
// Continuous + TWO-SIGNED: flat floor (−A) → inner wall ramping −A up through 0 to the crest (+rimH) →
// outer rim decaying crest→ejecta → ejecta apron decaying →0. (The zero-crossing sits inside the wall, so
// every single crater is individually two-signed — a bowl AND a raised rim.)
function craterProfile(s, D) {
  const A = craterAmplitude(D);
  const r = 0.5 * D;                       // crater rim-crest radius (angular)
  const floorEdge = FLOOR_FRAC * r;        // end of the flat floor
  const rimH = RIM_HEIGHT_FRAC * A;        // rim crest height above datum
  const ejH = EJECTA_FRAC * A;             // ejecta-apron height above datum
  const rimEnd = r + RIM_W * D;            // outer edge of the rim zone
  const ejEnd = r + RIM_FRAC * D;          // outer edge of the ejecta apron (= stamp radius)
  if (s < floorEdge) return -A;                                             // flat floor
  if (s < r) { const t = (s - floorEdge) / (r - floorEdge); return -A + t * (A + rimH); }  // inner wall −A → +rimH
  if (s < rimEnd) { const t = (s - r) / (rimEnd - r); return rimH + t * (ejH - rimH); }     // outer rim crest → ejecta
  if (s < ejEnd) { const t = (s - rimEnd) / (ejEnd - rimEnd); return ejH * (1 - t); }        // ejecta apron → 0
  return 0;
}
const stampRadius = (D) => 0.5 * D + RIM_FRAC * D;

// ── helpers ──────────────────────────────────────────────────────────────────────────────────────
function meanEdgeAngle(mesh) {
  const { verts, adj } = mesh; let sum = 0, cnt = 0;
  for (let i = 0; i < verts.length; i++) for (const j of adj[i]) if (j > i) {
    const a = verts[i], b = verts[j]; let d = a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
    d = Math.max(-1, Math.min(1, d)); sum += Math.acos(d); cnt++;
  }
  return sum / cnt;
}
function pct(arr, p) { const s = Float64Array.from(arr).sort(); return s[Math.min(s.length-1, Math.max(0, Math.round(p*(s.length-1))))]; }
function despunBundle(name, seed) {
  const fp = DRIVER_PRESETS[name];
  const u = deriveUniforms(fp, QUALITY_TIER);
  return {
    archetype: null, locked: !!(fp && fp.tidalState && fp.tidalState.locked),
    bodyDrivers: { ...buildNeutralBodyDrivers(u, fp), condition: deriveConditionVector(fp, u, fp.radiusEarth) },
    macroSeed: seed, heightSeed: 'e6:' + seed, T_eq: fp.T_eq ?? 288,
  };
}

const out = [];
const p = (s) => out.push(s);
p('══════════════════════════════════════════════════════════════════════════════════════════════════');
p('  V2-5 BOMBARDMENT — crater SCALE calibration  (crater-scale.mjs — BUILD-PLAN §7.1)');
p('══════════════════════════════════════════════════════════════════════════════════════════════════');

// (1) resolution — meanEdgeAngle at the lab N + node-span of the size band
const mesh = buildIrregularSphere(LAB_N, 2);
const mea = meanEdgeAngle(mesh);
const formula = Math.sqrt(4 * Math.PI / mesh.verts.length);
p('');
p('── RESOLUTION (lab render mesh) ───────────────────────────────────────────────────────────────────');
p(`  N = ${mesh.verts.length}   meanEdgeAngle = ${mea.toFixed(5)} rad (${(mea*180/Math.PI).toFixed(3)}°)   [sqrt(4π/N) = ${formula.toFixed(5)}]`);
p(`  D_MIN_RAD = ${D_MIN_RAD} rad (${(D_MIN_RAD*180/Math.PI).toFixed(2)}°)  → ${(D_MIN_RAD/mea).toFixed(1)} nodes across`);
p(`  D_MAX_RAD = ${D_MAX_RAD} rad (${(D_MAX_RAD*180/Math.PI).toFixed(2)}°)  → ${(D_MAX_RAD/mea).toFixed(1)} nodes across`);
const resolvable = (D_MAX_RAD / mea) >= 10;
p(`  ASSERT  D_MAX_RAD / meanEdgeAngle ≥ 10 :  ${(D_MAX_RAD/mea).toFixed(1)}  →  ${resolvable ? 'PASS' : 'FAIL'}`);
p('  node-span per size bin (geometric bins across the band):');
{
  const NB = 6;
  for (let b = 0; b < NB; b++) {
    const D = D_MIN_RAD * Math.pow(D_MAX_RAD / D_MIN_RAD, (b + 0.5) / NB);
    p(`     D=${D.toFixed(4)} rad (${(D*180/Math.PI).toFixed(2)}°)  → ${(D/mea).toFixed(1)} nodes   A(D)=${craterAmplitude(D).toFixed(4)}`);
  }
}

// (2) vertical amplitude — live despun height amplitude
p('');
p('── VERTICAL AMPLITUDE anchor (LIVE despun height, normalized-height units) ─────────────────────────');
const ampMesh = buildIrregularSphere(AMP_N, 2);
const ampCarrier = makeSphereField(ampMesh);
const ampRelief = writeBodyRelief(ampCarrier, despunBundle('Frozen (airless)', 1));
const h = ampCarrier.height;
const despunAmp = pct(h, 0.95) - pct(h, 0.05);
let mn = Infinity, mx = -Infinity; for (let i = 0; i < h.length; i++) { if (h[i] < mn) mn = h[i]; if (h[i] > mx) mx = h[i]; }
p(`  despun Frozen @N=${AMP_N} (path=${ampRelief.path}):  p95−p5 = ${despunAmp.toFixed(4)}   max−min = ${(mx-mn).toFixed(4)}`);
p(`  CRATER_DEPTH_N   = ${CRATER_DEPTH_N}   (A(D_REF); ≈ ${(CRATER_DEPTH_N/despunAmp).toFixed(2)}× the despun p95−p5 span — a dominant basin)`);
p(`  MIN_BASIN_DEPTH_N= ${MIN_BASIN_DEPTH_N}   (≈ ${(MIN_BASIN_DEPTH_N/despunAmp).toFixed(2)}× the despun span — the visible-bowl floor)`);
const aMax = craterAmplitude(D_MAX_RAD), aMin = craterAmplitude(D_MIN_RAD);
p(`  A(D_MAX) = ${aMax.toFixed(4)}   A(D_MIN) = ${aMin.toFixed(4)}   (sub-linear ratio A_max/A_min = ${(aMax/aMin).toFixed(2)}× over a 10× diameter range)`);
const legible = aMax >= MIN_BASIN_DEPTH_N;
p(`  ASSERT  A(D_MAX) ≥ MIN_BASIN_DEPTH_N :  ${aMax.toFixed(4)} ≥ ${MIN_BASIN_DEPTH_N}  →  ${legible ? 'PASS' : 'FAIL'}`);

// (3) two-signed profile sanity at both extremes
p('');
p('── RADIAL PROFILE two-signed check (bowl < 0 AND raised rim > 0) ───────────────────────────────────');
let allTwoSigned = true;
for (const D of [D_MIN_RAD, D_MAX_RAD]) {
  const R = stampRadius(D);
  let pmin = Infinity, pmax = -Infinity;
  for (let k = 0; k <= 40; k++) { const s = (k / 40) * R; const v = craterProfile(s, D); if (v < pmin) pmin = v; if (v > pmax) pmax = v; }
  const twoSigned = pmin < 0 && pmax > 0;
  allTwoSigned = allTwoSigned && twoSigned;
  p(`  D=${D.toFixed(3)} rad:  profile min=${pmin.toFixed(4)} (floor)  max=${pmax.toFixed(4)} (rim)  stampR=${R.toFixed(3)} rad → ${(R/mea).toFixed(1)} nodes  two-signed:${twoSigned ? 'YES' : 'NO'}`);
}

p('');
p('── BAKED CONSTANTS (copy into src/worldengine/base/bombardment.js) ─────────────────────────────────');
p(`  D_MIN_RAD        = ${D_MIN_RAD}`);
p(`  D_MAX_RAD        = ${D_MAX_RAD}`);
p(`  CRATER_DEPTH_N   = ${CRATER_DEPTH_N}`);
p(`  D_REF_RAD        = ${D_REF_RAD}`);
p(`  DEPTH_POW        = ${DEPTH_POW}`);
p(`  MIN_BASIN_DEPTH_N= ${MIN_BASIN_DEPTH_N}`);
p(`  FLOOR_FRAC       = ${FLOOR_FRAC}`);
p(`  RIM_HEIGHT_FRAC  = ${RIM_HEIGHT_FRAC}`);
p(`  EJECTA_FRAC      = ${EJECTA_FRAC}`);
p(`  RIM_W            = ${RIM_W}`);
p(`  RIM_FRAC         = ${RIM_FRAC}`);
p('');
p(`  OVERALL: ${resolvable && legible && allTwoSigned ? 'ALL PASS' : 'FAIL — retune candidates above'}`);
p('══════════════════════════════════════════════════════════════════════════════════════════════════');
process.stdout.write(out.join('\n') + '\n');
