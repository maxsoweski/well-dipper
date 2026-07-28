// ⚠⚠ SUPERSEDED IN PART (gravity-selfcompression-2026-07-28) — THIS BANNER COVERS THE WHOLE FILE,
//    INCLUDING THE HEADER COMMENT BELOW. Any statement here that surfaceGravity = g_c*(R/R_c),
//    or that g is monotonic in R by that law, records the CONSTANT-DENSITY law live when this
//    file was written. Gravity is now g = g_c*f(R)/f(R_c), f piecewise in ABSOLUTE Earth radii
//    (R^(4/3) below 1 R_E, R^1.70 above), ROCKY class only; gas/icy/carbon are unchanged.
//    Byte-exactness at canonical is unchanged. Kept as written for audit trail.

// calibration/relief-envelope.mjs — World Engine Inc-3 SLICE-1 STEP 0 (closed-form pre-check, BEFORE writer code).
//
// PURPOSE (BUILD-PLAN §2 / AC-ENVELOPE / audit footnote 14): the lab's relief multiplier reliefNorm currently
// reads  reliefNorm(R,g) = (1/R)·reliefGravityFactor(g) = (1/R)·clamp(g^-0.5, 0.4, 2.5).  The (1/R) term is
// UNCAPPED and is the LARGER factor at small R; at the convicted worked point (R=0.27, g=0.28) the product is
// 7.0×, driving apparent relief/radius to ~0.70 — 1.75× beyond the MOST extreme real body (Phobos ~0.40).
// This harness (1) reproduces the 7.0× defect, (2) DERIVES the double-dip resolution (radius already flows
// through g post-v2-6 coherence, so the explicit 1/R is a second radius application — footnote 14), and
// (3) SOLVES a single strength-cap exponent Q_RELIEF for the replacement envelope reliefEnvelope(R,g) =
// clamp(g^-Q_RELIEF, RELIEF_FLOOR, RELIEF_CEIL) against the real-body relief/radius anchors, verifying every
// anchor + the worked case lands in band. Pure `node` (no dev server, no claude -p). Numbers reproduce.
//
// WHY g-ONLY (the footnote-14 derivation, in one line): post-v2-6 deriveConditionVector sets
// surfaceGravity = g_c·(R/R_c), so g is MONOTONIC in the drawn R at fixed composition. A factor of g^-Q ALREADY
// carries the radius signal. Multiplying it by an explicit (1/R) applies radius TWICE — that is the double-dip,
// and it is the entire cause of the uncapped blow-up. The fix reads g alone; radius stays visible THROUGH g.
// (Crater angular SIZE ∝ 1/R via radPerKm is a SEPARATE, correct mechanism in bombardment.js — untouched here.)
//
// FIRST-ORDER MODEL NOTE: apparent_relief/R is modelled here as REF_RELIEF·multiplier (linear in the envelope
// multiplier, REF_RELIEF = Earth's rendered relief/R at the reference multiplier 1.0). This is the SIZING model;
// the shader's normal-saturation adds a secondary non-linearity that only ever COMPRESSES the top end further
// (saturation cannot make relief bigger). So a linear-model value inside the band is a conservative pass; the
// live AC-LAB-READ metric confirms the render. The multiplier law itself is EXACT and is what the lab bakes.

// ── the CURRENT (defective) gravity cap, transcribed from planet-lod-lab-core.js reliefGravityFactor ──────────
const G_CAP_FLOOR = 0.4, G_CAP_CEIL = 2.5;
function reliefGravityFactor(g) {                       // KEPT untouched in core (tectonic/magmatism share the form)
  const f = Math.pow(Math.max(g, 1e-3), -0.5);
  return Math.min(G_CAP_CEIL, Math.max(G_CAP_FLOOR, f));
}
function reliefNormOld(R, g) { return (1 / Math.max(R, 1e-6)) * reliefGravityFactor(g); }  // the lab's live law

// ── real-body relief/radius anchors (math-check §1 "relief/radius as RENDERED" + planetary-science literature) ─
// R in Earth radii; g in Earth-g (Earth surface g = 9.81 m/s²); band = plausible apparent relief/radius range.
// density-derived g cross-checked: g ≈ (M/M⊕)/(R/R⊕)².
// TWO anchor ROLES (physically distinct, so they gate differently):
//   • fit:true  — DISTRIBUTED-relief bodies (relief spread over the surface): the smooth strength-cap law is
//                 fit to these and each must land IN its band.
//   • fit:false — BASIN-DOMINATED extremes: Phobos' relief IS the Stickney crater (~0.4 R) and Vesta's IS
//                 Rheasilvia (~1.9 R) — a SINGLE giant impact, a bombardment/basin effect, NOT a strength
//                 envelope. They set the CEILING the envelope must never EXCEED (assert apparent ≤ 0.40), and
//                 are REPORTED — the smooth law is NOT required to reproduce them (a giant basin is
//                 bombardment.js's job, not the envelope's). Documented, not silently dropped.
const CEIL_APPARENT = 0.40;                             // Phobos-extreme strength ceiling on apparent relief/R
const ANCHORS = [
  { name: 'Earth',   R: 1.0,     g: 1.0,      band: [0.002, 0.010], target: 0.003, fit: true  },
  { name: 'Mercury', R: 0.383,   g: 0.377,    band: [0.003, 0.010], target: 0.004, fit: true  },
  { name: 'Mars',    R: 0.532,   g: 0.379,    band: [0.003, 0.020], target: 0.006, fit: true  },
  { name: 'Moon',    R: 0.273,   g: 0.165,    band: [0.008, 0.050], target: 0.012, fit: true  },
  { name: 'Mimas',   R: 0.0311,  g: 0.00648,  band: [0.040, 0.150], target: 0.050, fit: true  },
  { name: 'Vesta',   R: 0.0412,  g: 0.0255,   band: [0.050, 0.400], target: 0.150, fit: false }, // basin extreme
  { name: 'Phobos',  R: 0.00174, g: 0.00058,  band: [0.150, 0.400], target: 0.400, fit: false }, // ceiling ref
];
const REF_RELIEF = 0.003;                               // Earth rendered relief/R at multiplier = 1.0
const WORKED = { name: 'WORKED (Moon/Mercury draw)', R: 0.27, g: 0.28, band: [0.003, 0.050] }; // math-check worked point

// ── STEP 1: reproduce the defect ─────────────────────────────────────────────────────────────────────────────
console.log('=== Inc-3 relief-envelope STEP-0 closed-form pre-check ===\n');
const oldWorked = reliefNormOld(WORKED.R, WORKED.g);
console.log(`DEFECT reproduced: reliefNormOld(R=${WORKED.R}, g=${WORKED.g}) = (1/${WORKED.R})·gCap(${WORKED.g})`);
console.log(`  = ${(1 / WORKED.R).toFixed(3)} · ${reliefGravityFactor(WORKED.g).toFixed(3)} = ${oldWorked.toFixed(3)}×  (matches math-check 7.0×)`);
console.log('  the (1/R) term is UNCAPPED — reliefNormOld → ∞ as R → 0:');
for (const R of [1.0, 0.5, 0.27, 0.1, 0.03]) console.log(`    R=${R.toString().padEnd(5)} reliefNormOld=${reliefNormOld(R, 0.28).toFixed(2)}`);

// ── STEP 2: SOLVE Q_RELIEF (single strength-cap exponent) against the fit anchors, forced through Earth=1 ──────
// model: multiplier(g) = g^-Q ; apparent = REF_RELIEF·multiplier ; anchor ratio r_i = target_i/REF_RELIEF.
// ln r_i = Q·ln(1/g_i)  ⇒  least-squares through the origin (Earth: g=1 ⇒ ln(1/g)=0, ln r=0):
//   Q = Σ(x_i·y_i)/Σ(x_i²),  x_i=ln(1/g_i), y_i=ln(target_i/REF_RELIEF).
const fitSet = ANCHORS.filter(a => a.fit);
let sxy = 0, sxx = 0;
for (const a of fitSet) { const x = Math.log(1 / a.g), y = Math.log(a.target / REF_RELIEF); sxy += x * y; sxx += x * x; }
const Q_solved = sxy / sxx;
const Q_RELIEF = Number(Q_solved.toPrecision(2));        // legible 2-sig-fig constant the writer bakes
console.log(`\nSOLVED Q_RELIEF = ${Q_solved.toFixed(4)}  → baked as ${Q_RELIEF}  (relief/R ∝ g^-Q; sign: lower g ⇒ higher relief ✓)`);

// ── STEP 3: derive the clamps from the anchor extremes ────────────────────────────────────────────────────────
// CEIL: the Phobos-extreme apparent ceiling (0.40) as a multiplier = CEIL_APPARENT/REF_RELIEF; binds only on a
//       DEGENERATE g→0 draw (no real body reaches it — Phobos multiplier sits under it), enforcing apparent ≤ 0.40.
// FLOOR: high-g bodies (g>1: Magma/Carbon) get subdued relief; floor kept at the current gCap FLOOR (0.40) so a
//        high-g world never fully flattens (a 2–3 g world reads 2^-Q≈0.65 … 3^-Q≈0.5 — subdued, not zero).
const RELIEF_CEIL = Number((CEIL_APPARENT / REF_RELIEF).toPrecision(3));   // 133 — apparent capped at 0.40
const RELIEF_FLOOR = 0.40;
function reliefEnvelope(R, g) {                          // THE DERIVED REPLACEMENT (R read only to prove it is unused)
  return Math.min(RELIEF_CEIL, Math.max(RELIEF_FLOOR, Math.pow(Math.max(g, 1e-3), -Q_RELIEF)));
}
console.log(`RELIEF_FLOOR = ${RELIEF_FLOOR}   RELIEF_CEIL = ${RELIEF_CEIL}   (envelope = clamp(g^-${Q_RELIEF}, FLOOR, CEIL))`);

// ── STEP 4: verify every anchor + the worked case lands in band ───────────────────────────────────────────────
console.log('\nbody       R       g        old×      new×     apparent   band            verdict');
let fail = false, maxApparent = 0;
for (const a of [...ANCHORS, WORKED]) {
  const mNew = reliefEnvelope(a.R, a.g);
  const apparent = REF_RELIEF * mNew;
  maxApparent = Math.max(maxApparent, apparent);
  const inBand = apparent >= a.band[0] && apparent <= a.band[1];
  const isCeilRef = a.fit === false;                     // Phobos/Vesta: gate on ≤ ceiling, not band membership
  const pass = isCeilRef ? apparent <= CEIL_APPARENT : inBand;   // WORKED + fit anchors gate on band
  if (!pass) fail = true;
  const tag = isCeilRef ? (apparent <= CEIL_APPARENT ? 'CEIL-REF ≤0.40 OK' : 'CEIL EXCEEDED') : (inBand ? 'OK' : 'FAIL');
  console.log(
    `${(a.name || '').slice(0, 9).padEnd(9)} ${a.R.toFixed(3).padStart(6)} ${a.g.toExponential(2).padStart(9)} ` +
    `${reliefNormOld(a.R, a.g).toFixed(2).padStart(7)} ${mNew.toFixed(2).padStart(7)} ${apparent.toFixed(4).padStart(9)}  ` +
    `[${a.band[0]},${a.band[1]}]`.padEnd(15) + ` ${tag}`);
}
console.log(`\nstrength ceiling: max apparent across all bodies = ${maxApparent.toFixed(4)} ≤ ${CEIL_APPARENT} ⇒ ${maxApparent <= CEIL_APPARENT ? 'OK' : 'FAIL (envelope exceeds the most extreme real body)'}`);
if (maxApparent > CEIL_APPARENT) fail = true;

// ── STEP 5: prove the worked-case collapse + sign preservation ────────────────────────────────────────────────
const collapse = oldWorked / reliefEnvelope(WORKED.R, WORKED.g);
console.log(`\nworked-case multiplier collapse: ${oldWorked.toFixed(2)}× → ${reliefEnvelope(WORKED.R, WORKED.g).toFixed(2)}×  (${collapse.toFixed(2)}× reduction)`);
console.log(`worked-case apparent: ${(REF_RELIEF * oldWorked).toFixed(3)} → ${(REF_RELIEF * reliefEnvelope(WORKED.R, WORKED.g)).toFixed(4)}  (from 0.70 molten → in Moon/Mercury band, ≪ 0.40 ceiling)`);
// sign check: strictly increasing as g falls (monotone), until the clamp
let mono = true, prev = -Infinity;
for (const g of [3, 1, 0.5, 0.28, 0.1, 0.01, 0.001]) { const m = reliefEnvelope(1, g); if (m < prev - 1e-12) mono = false; prev = m; }
console.log(`sign preserved (multiplier non-decreasing as g falls): ${mono ? 'OK' : 'FAIL'}`);
if (!mono) fail = true;

console.log(`\n${fail ? 'FAIL — envelope constants need adjustment' : 'ALL PASS — envelope pinned: reliefEnvelope(R,g)=clamp(g^-' + Q_RELIEF + ', ' + RELIEF_FLOOR + ', ' + RELIEF_CEIL + '); radius via g (footnote-14 double-dip resolved)'}`);
process.exit(fail ? 1 : 0);
