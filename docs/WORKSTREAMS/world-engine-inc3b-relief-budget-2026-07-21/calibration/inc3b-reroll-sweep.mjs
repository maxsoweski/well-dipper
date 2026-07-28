// calibration/inc3b-reroll-sweep.mjs — World Engine Inc-3b SLICE-4 acceptance harness (AC-REROLL).
//
// LINEAGE: the predecessor population-sweep pattern (docs/WORKSTREAMS/world-engine-inc3-relief-spine-depthlaw-
// 2026-07-21/calibration/population-sweep.mjs) — pure `node`, deterministic, no-taste-constants, machine-readable
// JSON summary, nonzero exit on any assert failure. This harness does NOT re-prove the population physics; it
// proves the ONE thing AC-REROLL asserts: that a 🌍 "new planet (re-roll all)" produces the variety the physics
// permits, driven by the RIGHT control (macroSeed, NOT radiusSeed — lens-log m-4), reported HONESTLY (m-5 largest
// basin measured-not-promised; A4 stamped-count R-invariance disclosed as a mesh-floor instrument limit, not sold
// as variety).
//
// WHAT IS PROVEN (all headless, deterministic, cross-checked against the S4 lab captures as ground truth):
//   (G) GROUND-TRUTH DERIVATION — the 🌍 newPlanet() worldSeed → {macroSeed, radiusSeed, detailSeed, craterOffset}
//       derivation (planet-lod-lab.html:3917 newPlanet()) is reproduced EXACTLY and cross-checked bit-for-bit
//       against the two re-rolled S4 capture states (target-reroll1/2 were produced BY newPlanet). seed1 is the
//       BOOT default (worldSeed=1 pre-newPlanet, macroSeed=radiusSeed=1) — disclosed, not asserted against the
//       derivation.
//   (B) LAYOUT VARIETY (robust, PRIMARY) — forEachCrater(cond, macroSeed, N, cb) centre sets differ MATERIALLY
//       across the 3 macroSeeds. Quantified two ways: index-set Jaccard (near-disjoint) + mean nearest-centre
//       angular displacement vs the within-set nearest-neighbour spacing (the crater-placement scale). Isolated
//       from radius by an R-FIXED control (same cond, vary only macroSeed) AND reported as-captured (real R+seed).
//   (C) LARGEST-BASIN SPREAD (m-5) — QUANTIFIED, not promised: the EXPECTED max-basin spread is sampled from the
//       truncated bounded-Pareto SFD (many synthetic macroSeeds at fixed cond) and stated; the MEASURED 3-seed
//       spread is reported as measured. If below a just-noticeable threshold, AC-REROLL rests on layout (B).
//   (D) RADIUS DRAWS (R3) — drawPresetRadius(MM, seed, {labUnlock:true}) lands in [0.27,0.38] and VARIES; the
//       FLAGLESS path drawPresetRadius(MM, seed) stays CANONICAL 0.38 (zero variance). BOTH asserted — the
//       flagless/headless/goldens/probe path must stay canonical (the hard constraint).
//   (E) FROZEN g-MEDIATED DELTAS — 2 drawn-radius Frozen worlds have distinct g = g_c·(R/R_c), and their crater
//       SCHEDULE outputs (sizeMul=g^-K_GS, D_t(g), D_HI, coverage) differ. (labUnlock is a no-op for Frozen — it
//       is not in LAB_UNLOCKED_RANGES — so Frozen draws its own archetype 'ice' band; disclosed honestly.)
//   (F) STAMPED-COUNT R-INVARIANCE — STATED as a mesh-floor instrument limit, NOT variety (A4). The ANGULAR-SFD
//       truncation band [δ_floor, δ_max] = [MESH_FLOOR_RAD, C_BASIN] is EXACTLY R-invariant (δ=D_km·radPerKm(R)
//       cancels R at both edges); nStamp is reported as measured at each radius (weakly R-dependent, disclosed).
//   (G2) craterOffset RIDER (S3-fix, NEW) — the seeded craterOffset = seedOffset(worldSeed·φ+97) derivation is
//       DETERMINISTIC per worldSeed and VARIES across worldSeeds (was [0,0,0] = re-roll-invariant before the fix).
//       Cross-checked bit-for-bit against the reroll1/2 recorded craterOffsets.
//
// seedOffset() is reproduced verbatim from planet-lod-lab.html:2464 (it is defined inline in the lab, not exported)
// and its identity is PROVEN by the reroll1/2 cross-check, so the copy cannot silently drift from the shipped hash.
//
// Machine-readable summary → inc3b-reroll-sweep-summary.json (deterministic; NO timing fields). Nonzero exit on any
// assert failure. Pure `node`, no network.

// ⚠ SUPERSEDED IN PART (gravity-selfcompression-2026-07-28): references below to
//    g = g_c*(R/R_c) record the CONSTANT-DENSITY law live when this file was written.
//    Gravity is now g = g_c*f(R)/f(R_c), f piecewise in absolute Earth radii
//    (R^(4/3) below 1 R_E, R^1.70 above), ROCKY class only. Kept for audit trail.

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import alea from 'alea';

import { DRIVER_PRESETS, NAMED_BODY, LAB_UNLOCKED_RANGES, drawPresetRadius } from '../../../../driver-presets.js';
import { deriveConditionVector } from '../../../../body-condition-vector.js';
import { deriveUniforms } from '../../../../planet-lod-lab-core.js';
import { craterSchedule, isImpactSurface, forEachCrater, transitionDiameterKm,
         drawBoundedPareto, MESH_FLOOR_RAD, C_BASIN, B_SFD } from '../../../../src/worldengine/base/bombardment.js';
import { radPerKm } from '../../../../src/worldengine/base/baseStep.js';
import { buildIrregularSphere } from '../../../../planet-lod-rivers.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const S4 = join(HERE, '..', 'evidence', 'S4');

const MM = 'Moon/Mercury (impact-airless)';
const FROZEN = 'Frozen (airless)';
const FP_MM = DRIVER_PRESETS[MM];
const FP_FROZEN = DRIVER_PRESETS[FROZEN];
const MM_BAND = LAB_UNLOCKED_RANGES[MM];              // [0.27, 0.38]

// ── helpers (no taste constants; every derived quantity is a mechanism fact) ─────────────────────────────
const failures = [];
const assert = (cond, msg) => { if (!cond) failures.push(msg); return cond; };
const mean = (xs) => xs.reduce((s, x) => s + x, 0) / xs.length;
const variance = (xs) => { const m = mean(xs); return xs.reduce((s, x) => s + (x - m) ** 2, 0) / xs.length; };
const std = (xs) => Math.sqrt(variance(xs));
const condAt = (fp, R) => deriveConditionVector(fp, deriveUniforms(fp, 1.0), R);
const dot3 = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const angBetween = (a, b) => Math.acos(Math.max(-1, Math.min(1, dot3(a, b))));   // great-circle angle (unit vecs)

// EXACT reproduction of planet-lod-lab.html:2464 seedOffset() (inline in the lab, not exported). Identity proven
// by the reroll1/2 craterOffset cross-check below.
function seedOffset(seed) {
  const h = (n) => { const x = Math.sin(n) * 43758.5453; return (x - Math.floor(x)) * 256.0; };
  return [h(seed * 12.9898 + 78.233), h(seed * 39.346 + 11.135), h(seed * 53.711 + 94.673)];
}
// EXACT reproduction of newPlanet()'s worldSeed → sub-seed derivation (planet-lod-lab.html:3918-3932).
function deriveWorld(worldSeed) {
  const radiusSeed = Math.floor(alea('draw:radius:' + worldSeed)() * 4294967296) >>> 0;
  const macroSeed  = Math.floor(alea('draw:macro:'  + worldSeed)() * 10000);
  const detailSeed = Math.floor(alea('draw:detail:' + worldSeed)() * 10000);
  const craterOffset = seedOffset(worldSeed * 1.6180339887 + 97.0);
  return { radiusSeed, macroSeed, detailSeed, craterOffset };
}

// ── PRODUCTION carrier mesh (radius-independent → built once): buildIrregularSphere(40000,4) == the arc-probe /
//    createRiverOverlay ensureMesh. Crater centre index = Math.floor(uCentre·N) maps to this vertex direction. ──
const mesh = buildIrregularSphere(40000, 4);
const VERTS = mesh.verts, N = VERTS.length;

// Enumerate the crater centre population at (cond, macroSeed): returns {indices:Set, dirs:[unit vecs], Dkm:[...]}.
function enumerate(cond, macroSeed) {
  const indices = [], dirs = [], Dkm = [], deltas = [];
  const sched = forEachCrater(cond, macroSeed, N, (centre, delta, tI, D_km) => {
    indices.push(centre); dirs.push(VERTS[centre]); Dkm.push(D_km); deltas.push(delta);
  });
  return { indices, dirs, Dkm, deltas, sched };
}
// mean angular distance from each centre in A to its NEAREST centre in B (0 iff A⊆B exactly co-located)
function crossNearest(dirsA, dirsB) {
  let acc = 0;
  for (const a of dirsA) {
    let best = Infinity;
    for (const b of dirsB) { const d = angBetween(a, b); if (d < best) best = d; }
    acc += best;
  }
  return acc / dirsA.length;
}
// mean angular distance from each centre to its nearest OTHER centre in the SAME set (the placement scale)
function withinNearest(dirs) {
  let acc = 0;
  for (let i = 0; i < dirs.length; i++) {
    let best = Infinity;
    for (let j = 0; j < dirs.length; j++) { if (i === j) continue; const d = angBetween(dirs[i], dirs[j]); if (d < best) best = d; }
    acc += best;
  }
  return acc / dirs.length;
}
function jaccard(idxA, idxB) {
  const A = new Set(idxA), B = new Set(idxB);
  let inter = 0; for (const x of A) if (B.has(x)) inter++;
  return inter / (A.size + B.size - inter);
}

// ────────────────────────────────────────────────────────────────────────────────────────────────────────
// (G) GROUND-TRUTH DERIVATION cross-check against the S4 lab captures
// ────────────────────────────────────────────────────────────────────────────────────────────────────────
const CAPS = ['target-seed1', 'target-reroll1', 'target-reroll2'];
const captures = CAPS.map((c) => JSON.parse(readFileSync(join(S4, `${c}.state.json`))));
const groundTruth = [];
for (const st of captures) {
  const isBoot = st.capture === 'target-seed1';                 // boot default: worldSeed=1 but seeds are NOT derived
  const d = deriveWorld(st.worldSeed);
  const rDraw = drawPresetRadius(MM, st.radiusSeed, { labUnlock: true });   // R from the RECORDED radiusSeed
  const row = {
    capture: st.capture, isBootDefault: isBoot, worldSeed: st.worldSeed,
    recorded: { macroSeed: st.macroSeed, radiusSeed: st.radiusSeed, detailSeed: st.detailSeed,
                planetRadiusEarth: st.planetRadiusEarth, craterOffset: st.craterOffset },
    derivedFromWorldSeed: { macroSeed: d.macroSeed, radiusSeed: d.radiusSeed, detailSeed: d.detailSeed,
                            craterOffset: d.craterOffset },
    radiusFromRecordedRadiusSeed: rDraw,
    radiusMatchesRecorded: Math.abs(rDraw - st.planetRadiusEarth) < 1e-12,
    seedsMatchDerivation: d.macroSeed === st.macroSeed && d.radiusSeed === st.radiusSeed && d.detailSeed === st.detailSeed,
    craterOffsetMatchesDerivation: st.craterOffset.every((v, i) => Math.abs(v - d.craterOffset[i]) < 1e-9),
  };
  groundTruth.push(row);
  // R from the recorded radiusSeed must reproduce the recorded radius on EVERY capture (proves the labUnlock draw law)
  assert(row.radiusMatchesRecorded,
    `(G) ${st.capture}: labUnlock radius draw at recorded radiusSeed=${st.radiusSeed} = ${rDraw} !== recorded ${st.planetRadiusEarth}`);
  if (!isBoot) {
    // the two re-rolls were produced BY newPlanet → the whole derivation must reproduce them bit-for-bit
    assert(row.seedsMatchDerivation,
      `(G) ${st.capture}: newPlanet derivation macro/radius/detail ${JSON.stringify(row.derivedFromWorldSeed)} != recorded ${JSON.stringify(row.recorded)}`);
    assert(row.craterOffsetMatchesDerivation,
      `(G) ${st.capture}: craterOffset derivation ${JSON.stringify(row.derivedFromWorldSeed.craterOffset)} != recorded ${JSON.stringify(st.craterOffset)}`);
  }
}

// The 3 macroSeeds under test (the lab captures' own macroSeeds — ground truth) + their real radii.
const SEEDS = captures.map((st) => ({ capture: st.capture, worldSeed: st.worldSeed, macroSeed: st.macroSeed, R: st.planetRadiusEarth }));
const macroSeeds = SEEDS.map((s) => s.macroSeed);
assert(new Set(macroSeeds).size === 3, `(B) the 3 macroSeeds are not distinct: ${macroSeeds.join(', ')}`);

// ────────────────────────────────────────────────────────────────────────────────────────────────────────
// (B) LAYOUT VARIETY — R-FIXED control (isolate macroSeed) + as-captured
// ────────────────────────────────────────────────────────────────────────────────────────────────────────
// R-FIXED control: identical cond (canonical MM radius) ⇒ identical nStamp/L_trunc/D_HI ⇒ the ONLY variable is
// macroSeed. Any centre-set difference is attributable to macroSeed alone.
const CANON_R = FP_MM.radiusEarth;                 // 0.38 (canonical Moon/Mercury)
const condFixed = condAt(FP_MM, CANON_R);
const fixedSets = macroSeeds.map((ms) => enumerate(condFixed, ms));
const layoutFixed = [];
const pairs = [[0, 1], [0, 2], [1, 2]];
for (const [i, j] of pairs) {
  const A = fixedSets[i], B = fixedSets[j];
  const jac = jaccard(A.indices, B.indices);
  const cross = crossNearest(A.dirs, B.dirs);
  const withinA = withinNearest(A.dirs);
  const ratio = cross / withinA;                   // ~0 iff identical layout; ~1 iff independently placed
  layoutFixed.push({ pair: [macroSeeds[i], macroSeeds[j]], nA: A.dirs.length, nB: B.dirs.length,
                     jaccard: +jac.toFixed(5), crossNearestRad: +cross.toFixed(5),
                     withinNearestRad: +withinA.toFixed(5), displacementRatio: +ratio.toFixed(4) });
  // near-disjoint index sets: two independent uCentre streams over N=40000 verts ⇒ expected Jaccard ≈ n/N ≈ 0.004
  assert(jac < 0.02, `(B) R-fixed pair macroSeed ${macroSeeds[i]}/${macroSeeds[j]}: index-set Jaccard ${jac.toFixed(4)} ≥ 0.02 (layouts not disjoint)`);
  // materially separated: cross-set nearest-centre displacement is on the crater-placement scale, not ~0
  assert(ratio > 0.5, `(B) R-fixed pair macroSeed ${macroSeeds[i]}/${macroSeeds[j]}: displacement ratio ${ratio.toFixed(3)} ≤ 0.5 (layouts near-duplicate)`);
}
// as-captured (real R + real macroSeed per capture) — reported alongside
const capSets = SEEDS.map((s) => enumerate(condAt(FP_MM, s.R), s.macroSeed));
const layoutCaptured = [];
for (const [i, j] of pairs) {
  const A = capSets[i], B = capSets[j];
  layoutCaptured.push({ pair: [SEEDS[i].capture, SEEDS[j].capture], macroSeeds: [SEEDS[i].macroSeed, SEEDS[j].macroSeed],
                        jaccard: +jaccard(A.indices, B.indices).toFixed(5),
                        crossNearestRad: +crossNearest(A.dirs, B.dirs).toFixed(5),
                        displacementRatio: +(crossNearest(A.dirs, B.dirs) / withinNearest(A.dirs)).toFixed(4) });
}

// ────────────────────────────────────────────────────────────────────────────────────────────────────────
// (C) LARGEST-BASIN SPREAD — expected (sampled from the truncated SFD) vs measured (m-5, measured-not-promised)
// ────────────────────────────────────────────────────────────────────────────────────────────────────────
// EXPECTED: at FIXED cond (nStamp, L_trunc, D_HI all fixed), the largest basin = max of nStamp bounded-Pareto
// draws. Sample the max distribution over many synthetic macroSeeds → state the spread the SFD actually permits.
const schedFixed = condFixed && craterSchedule(condFixed);
const { nStamp: nStampFixed, L_trunc: Lf, D_HI_KM: Hf } = schedFixed;
const N_SFD_SAMPLES = 4000;                          // deterministic ensemble of synthetic macroSeeds
const maxDraws = [];
for (let e = 0; e < N_SFD_SAMPLES; e++) {
  const rng = alea('sfd-ensemble:' + e);            // deterministic per index (no wall-clock)
  let mx = 0;
  for (let c = 0; c < nStampFixed; c++) { const D = drawBoundedPareto(rng(), Lf, Hf, B_SFD); if (D > mx) mx = D; }
  maxDraws.push(mx);
}
const maxMean = mean(maxDraws), maxStd = std(maxDraws);
const sorted = maxDraws.slice().sort((a, b) => a - b);
const pct = (p) => sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))];
// expected spread of a 3-sample draw (what "3 re-rolls" actually sees): E[max3 - min3] over the ensemble
let sum3 = 0, T3 = 2000;
for (let t = 0; t < T3; t++) {
  const rr = alea('triple:' + t);
  const a = maxDraws[Math.floor(rr() * maxDraws.length)], b = maxDraws[Math.floor(rr() * maxDraws.length)], c = maxDraws[Math.floor(rr() * maxDraws.length)];
  sum3 += Math.max(a, b, c) - Math.min(a, b, c);
}
const expected3Spread = sum3 / T3;
// MEASURED: the 3 captures' actual largest basin (at their real R — note D_HI ∝ R, so R co-varies the cap)
const measuredMax = SEEDS.map((s, k) => ({ capture: s.capture, R: s.R, largestBasinKm: Math.max(...capSets[k].Dkm) }));
const measuredSpread = Math.max(...measuredMax.map((m) => m.largestBasinKm)) - Math.min(...measuredMax.map((m) => m.largestBasinKm));
// just-noticeable threshold = the SFD's own 1σ of the max (a mechanism scale, not a taste pick). Report the verdict,
// do NOT fail on it — AC-REROLL rests on layout (B). m-5: measured, not promised.
const largestBasinIsWeak = measuredSpread < maxStd;

// ────────────────────────────────────────────────────────────────────────────────────────────────────────
// (D) RADIUS DRAWS — labUnlock in [0.27,0.38] & vary; flagless canonical (assert BOTH)
// ────────────────────────────────────────────────────────────────────────────────────────────────────────
const radiusSeeds = captures.map((st) => st.radiusSeed).concat([1, 2, 3, 42, 12345]);   // recorded + extra spread
const unlockedDraws = radiusSeeds.map((seed) => ({ seed, R: drawPresetRadius(MM, seed, { labUnlock: true }) }));
const flaglessDraws = radiusSeeds.map((seed) => ({ seed, R: drawPresetRadius(MM, seed) }));    // canonical path
const unlockedInBand = unlockedDraws.every((d) => d.R >= MM_BAND[0] && d.R <= MM_BAND[1]);
const unlockedVar = variance(unlockedDraws.map((d) => d.R));
// canonical-lock proof = EVERY flagless draw is bit-identical to the canonical radius (strictly stronger than
// variance==0; variance() would inject ~1e-33 float noise via the mean subtraction even on identical inputs).
const flaglessAllCanonical = flaglessDraws.every((d) => d.R === FP_MM.radiusEarth);
assert(unlockedInBand, `(D) labUnlock draws outside [${MM_BAND[0]},${MM_BAND[1]}]: ${unlockedDraws.filter((d) => d.R < MM_BAND[0] || d.R > MM_BAND[1]).map((d) => d.R).join(', ')}`);
assert(unlockedVar > 0, `(D) labUnlock radius draws do not vary (variance ${unlockedVar})`);
assert(flaglessAllCanonical, `(D) flagless path NOT canonical: ${flaglessDraws.filter((d) => d.R !== FP_MM.radiusEarth).map((d) => `${d.seed}→${d.R}`).join(', ')} (must all be bit-identical to ${FP_MM.radiusEarth})`);

// ────────────────────────────────────────────────────────────────────────────────────────────────────────
// (E) FROZEN g-MEDIATED DELTAS — 2 drawn radii → distinct g → schedule outputs differ
// ────────────────────────────────────────────────────────────────────────────────────────────────────────
const frozenSeeds = [101, 202];                     // 2 Frozen radius draws (BUILD-PLAN §1.S4: count=2)
const frozenLabUnlockIsNoop = !LAB_UNLOCKED_RANGES[FROZEN];   // Frozen is NOT in the MM-only unlock table
const frozenDraws = frozenSeeds.map((seed) => {
  const R = drawPresetRadius(FROZEN, seed, { labUnlock: true });   // labUnlock is a no-op for Frozen → 'ice' band
  const cond = condAt(FP_FROZEN, R);
  const sched = craterSchedule(cond);
  return { seed, R, g: cond.surfaceGravity, fired: sched.fired, isImpact: isImpactSurface(cond),
           nStamp: sched.nStamp, sizeMul: sched.sizeMul, D_HI_KM: sched.D_HI_KM, coverage: sched.coverage,
           D_t_km: transitionDiameterKm(cond.surfaceGravity) };
});
const [fa, fb] = frozenDraws;
assert(fa.fired && fb.fired, `(E) Frozen schedule did not fire on both draws (a.fired=${fa.fired}, b.fired=${fb.fired})`);
assert(fa.R !== fb.R, `(E) Frozen radius draws did not differ (${fa.R} == ${fb.R})`);
assert(fa.g !== fb.g, `(E) Frozen g did not differ across radius draws (${fa.g} == ${fb.g}) — g-mediation absent`);
assert(fa.sizeMul !== fb.sizeMul, `(E) Frozen sizeMul (g-term) identical across draws (${fa.sizeMul})`);
assert(fa.D_t_km !== fb.D_t_km, `(E) Frozen transition diameter D_t(g) identical across draws (${fa.D_t_km})`);
assert(fa.D_HI_KM !== fb.D_HI_KM, `(E) Frozen D_HI (∝R) identical across draws (${fa.D_HI_KM})`);

// ────────────────────────────────────────────────────────────────────────────────────────────────────────
// (F) STAMPED-COUNT R-INVARIANCE — mesh-floor instrument limit, STATED not sold; angular-SFD band R-invariant
// ────────────────────────────────────────────────────────────────────────────────────────────────────────
const radiiForCount = SEEDS.map((s) => s.R).concat([CANON_R]);
const countRows = radiiForCount.map((R) => {
  const sched = craterSchedule(condAt(FP_MM, R));
  const rpk = radPerKm(R);
  return { R: +R.toFixed(6), nStamp: sched.nStamp,
           deltaFloorRad: sched.D_FLOOR_KM * rpk,      // = MESH_FLOOR_RAD, R-invariant by construction
           deltaMaxRad: sched.D_HI_KM * rpk };         // = C_BASIN,      R-invariant by construction
});
// The MECHANISM claim (mesh-floor instrument limit): the ANGULAR truncation band is bit-exactly R-invariant.
const angFloorInvariant = countRows.every((r) => Math.abs(r.deltaFloorRad - MESH_FLOOR_RAD) < 1e-12);
const angMaxInvariant = countRows.every((r) => Math.abs(r.deltaMaxRad - C_BASIN) < 1e-12);
assert(angFloorInvariant, `(F) angular floor δ_floor NOT R-invariant: ${countRows.map((r) => r.deltaFloorRad).join(', ')} (expected ${MESH_FLOOR_RAD})`);
assert(angMaxInvariant, `(F) angular max δ_max NOT R-invariant: ${countRows.map((r) => r.deltaMaxRad).join(', ')} (expected ${C_BASIN})`);
const nStampValues = countRows.map((r) => r.nStamp);
const nStampWeaklyRDependent = new Set(nStampValues).size > 1;   // disclosed: count drifts weakly with R (NOT variety)

// ────────────────────────────────────────────────────────────────────────────────────────────────────────
// (G2) craterOffset RIDER — deterministic per worldSeed, varies across worldSeeds
// ────────────────────────────────────────────────────────────────────────────────────────────────────────
const offsetWorldSeeds = captures.map((st) => st.worldSeed);
const offsets = offsetWorldSeeds.map((ws) => ({ worldSeed: ws, offset: seedOffset(ws * 1.6180339887 + 97.0) }));
const offsetDeterministic = offsets.every((o) => {
  const again = seedOffset(o.worldSeed * 1.6180339887 + 97.0);
  return again.every((v, i) => v === o.offset[i]);
});
let offsetsVaryAcross = true;
for (const [i, j] of pairs) {
  const a = offsets[i].offset, b = offsets[j].offset;
  const l2 = Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
  if (!(l2 > 1e-6)) offsetsVaryAcross = false;
}
assert(offsetDeterministic, `(G2) craterOffset derivation is not deterministic per worldSeed`);
assert(offsetsVaryAcross, `(G2) craterOffset does not vary across the 3 worldSeeds (S3-fix rider broken)`);

// ────────────────────────────────────────────────────────────────────────────────────────────────────────
// SUMMARY (deterministic — NO timing fields)
// ────────────────────────────────────────────────────────────────────────────────────────────────────────
const summary = {
  meta: {
    workstream: 'world-engine-inc3b-relief-budget-2026-07-21', slice: 'S4', ac: 'AC-REROLL',
    harness: 'calibration/inc3b-reroll-sweep.mjs',
    control: '🌍 newPlanet() (re-roll all) — worldSeed → macroSeed drives forEachCrater placement (m-4: NOT 🎲 reroll-radius)',
    meshN: N, note: 'deterministic; no wall-clock in payload',
  },
  gates: {
    groundTruthDerivation: !failures.some((f) => f.startsWith('(G)')),
    layoutVariety: !failures.some((f) => f.startsWith('(B)')),
    radiusDraws: !failures.some((f) => f.startsWith('(D)')),
    frozenGMediated: !failures.some((f) => f.startsWith('(E)')),
    angularSFDInvariance: !failures.some((f) => f.startsWith('(F)')),
    craterOffsetRider: !failures.some((f) => f.startsWith('(G2)')),
  },
  groundTruth,
  layoutVariety: {
    primary: 'macroSeed drives forEachCrater centre placement; the R-FIXED control isolates it from radius.',
    macroSeeds, canonicalRUsedForFixedControl: CANON_R, nStampAtFixedR: nStampFixed,
    rFixedControl: layoutFixed,
    asCaptured: layoutCaptured,
    interpretation: 'crossNearestRad ≈ withinNearestRad (displacementRatio ~O(1)) ⇒ each macroSeed places craters independently; near-zero Jaccard ⇒ centre-index sets are disjoint. Layout variety is the ROBUST signal AC-REROLL rests on.',
  },
  largestBasin: {
    reporting: 'MEASURED, not promised (m-5).',
    expectedFromTruncatedSFD: {
      method: `max of nStamp=${nStampFixed} bounded-Pareto draws over [L_trunc=${Lf.toFixed(2)}, D_HI=${Hf.toFixed(2)}] km (B=${B_SFD}), ${N_SFD_SAMPLES} synthetic macroSeeds at fixed canonical cond`,
      maxMeanKm: +maxMean.toFixed(3), maxStdKm: +maxStd.toFixed(3),
      maxP05Km: +pct(0.05).toFixed(3), maxP95Km: +pct(0.95).toFixed(3),
      expected3SeedSpreadKm: +expected3Spread.toFixed(3),
      truncationCapKm: +Hf.toFixed(3),
    },
    measured3Seed: { perCapture: measuredMax.map((m) => ({ capture: m.capture, R: +m.R.toFixed(4), largestBasinKm: +m.largestBasinKm.toFixed(3) })),
                     spreadKm: +measuredSpread.toFixed(3),
                     note: 'each capture has a DIFFERENT R, so D_HI (∝R) co-varies the cap — measured spread mixes R and macroSeed.' },
    justNoticeableThresholdKm: +maxStd.toFixed(3),
    verdict: largestBasinIsWeak
      ? 'largest-basin spread is BELOW the SFD 1σ just-noticeable threshold ⇒ a WEAK signal (truncation pins the max near D_HI). AC-REROLL rests on layout variety (robust); biggest-basin variety reported as measured, not sold.'
      : 'largest-basin spread EXCEEDS the SFD 1σ threshold ⇒ a visible contribution; still reported as measured, not promised.',
  },
  radiusDraws: {
    band: MM_BAND,
    labUnlock: { inBand: unlockedInBand, variance: unlockedVar, draws: unlockedDraws.map((d) => ({ seed: d.seed, R: +d.R.toFixed(6) })) },
    flagless: { allCanonical: flaglessAllCanonical, canonical: FP_MM.radiusEarth, allBitIdentical: flaglessAllCanonical },
    note: 'labUnlock:true is the LAB-only opt-in path; the flagless path (headless/goldens/probe) stays canonical 0.38 — the hard constraint, asserted here.',
  },
  frozenGMediated: {
    labUnlockIsNoopForFrozen: frozenLabUnlockIsNoop,
    archetypeBand: 'ice [0.4,1.2] R⊕ (Frozen draws its own archetype range; labUnlock only unlocks Moon/Mercury)',
    draws: frozenDraws.map((d) => ({ seed: d.seed, R: +d.R.toFixed(6), g: +d.g.toFixed(6), nStamp: d.nStamp,
                                     sizeMul: +d.sizeMul.toFixed(6), D_t_km: +d.D_t_km.toFixed(3), D_HI_km: +d.D_HI_KM.toFixed(3), coverage: +d.coverage.toFixed(6) })),
    deltas: { dR: +(fb.R - fa.R).toFixed(6), dG: +(fb.g - fa.g).toFixed(6), dSizeMul: +(fb.sizeMul - fa.sizeMul).toFixed(6),
              dD_t_km: +(fb.D_t_km - fa.D_t_km).toFixed(3), dNStamp: fb.nStamp - fa.nStamp },
    interpretation: 'distinct drawn radii → distinct g=g_c·(R/R_c) → distinct crater schedule (sizeMul=g^-K_GS, D_t=K_DT/g, D_HI∝R, coverage). g-mediation confirmed.',
  },
  stampedCountRInvariance: {
    statedAs: 'a mesh-floor INSTRUMENT LIMIT, NOT variety (A4) — disclosed to Max plainly.',
    angularSFDBand: { deltaFloorRad: MESH_FLOOR_RAD, deltaMaxRad: C_BASIN,
                      invariant: angFloorInvariant && angMaxInvariant,
                      mechanism: 'δ = D_km·radPerKm(R); D_FLOOR_KM·rpk = MESH_FLOOR_RAD and D_HI_KM·rpk = C_BASIN — R cancels at both truncation edges, so the ANGULAR crater-size band you SEE is pinned by the mesh, independent of R.' },
    nStampPerRadius: countRows.map((r) => ({ R: r.R, nStamp: r.nStamp })),
    nStampWeaklyRDependent,
    note: 'nStamp drifts weakly with R (via screen/chronN second-order terms) but is NOT a re-roll variety lever — the angular SFD it draws from is R-invariant. Count is NOT sold as variety.',
  },
  craterOffsetRider: {
    rider: 'S3-fix: newPlanet() seeds craterOffset = seedOffset(worldSeed·φ+97) so a 🌍 re-roll MOVES the synth crater/ejecta domain (was [0,0,0] = re-roll-invariant before the fix).',
    deterministic: offsetDeterministic, variesAcrossWorldSeeds: offsetsVaryAcross,
    perWorldSeed: offsets.map((o) => ({ worldSeed: o.worldSeed, craterOffset: o.offset.map((v) => +v.toFixed(6)) })),
    crossCheckedAgainstCaptures: 'reroll1/reroll2 recorded craterOffsets reproduced bit-for-bit (see groundTruth[].craterOffsetMatchesDerivation); seed1 recorded [0,0,0] is the BOOT default (pre-newPlanet), disclosed.',
  },
  failures,
};

writeFileSync(join(HERE, 'inc3b-reroll-sweep-summary.json'), JSON.stringify(summary, null, 2));

// ── human console summary ────────────────────────────────────────────────────────────────────────────────
console.log('=== Inc-3b AC-REROLL sweep (🌍 newPlanet macroSeed path — m-4) ===');
console.log(`mesh: ${N} verts\n`);
console.log('(G) ground-truth derivation vs S4 captures:');
for (const g of groundTruth) {
  console.log(`  ${g.capture.padEnd(15)} worldSeed=${g.worldSeed}  R match=${g.radiusMatchesRecorded}  ` +
    (g.isBootDefault ? '(BOOT default — macro/radiusSeed=1, not worldSeed-derived; disclosed)'
                     : `seeds match=${g.seedsMatchDerivation}  craterOffset match=${g.craterOffsetMatchesDerivation}`));
}
console.log(`\n(B) LAYOUT variety — R-fixed control (canonical R=${CANON_R}, nStamp=${nStampFixed}), macroSeeds ${macroSeeds.join('/')}:`);
for (const l of layoutFixed) console.log(`  macroSeed ${l.pair[0]}↔${l.pair[1]}: Jaccard ${l.jaccard}  crossNN ${l.crossNearestRad}rad  withinNN ${l.withinNearestRad}rad  ratio ${l.displacementRatio}`);
console.log(`\n(C) LARGEST basin — expected(SFD): mean ${maxMean.toFixed(1)}km σ ${maxStd.toFixed(1)}km, E[3-seed spread] ${expected3Spread.toFixed(1)}km, cap ${Hf.toFixed(1)}km`);
console.log(`    measured 3-seed: ${measuredMax.map((m) => m.largestBasinKm.toFixed(0)).join('/')}km  spread ${measuredSpread.toFixed(1)}km  ⇒ ${largestBasinIsWeak ? 'WEAK (rests on layout)' : 'visible'} (measured, not promised)`);
console.log(`\n(D) RADIUS draws — labUnlock in [${MM_BAND[0]},${MM_BAND[1]}]=${unlockedInBand} var=${unlockedVar.toExponential(2)} | flagless all bit-identical to canonical ${FP_MM.radiusEarth}=${flaglessAllCanonical}`);
console.log(`\n(E) FROZEN g-mediated (labUnlock no-op for Frozen=${frozenLabUnlockIsNoop}, draws ice band):`);
for (const d of frozenDraws) console.log(`  seed ${d.seed}: R=${d.R.toFixed(4)} g=${d.g.toFixed(4)} nStamp=${d.nStamp} sizeMul=${d.sizeMul.toFixed(4)} D_t=${d.D_t_km.toFixed(1)}km D_HI=${d.D_HI_KM.toFixed(1)}km`);
console.log(`\n(F) STAMPED-count R-invariance (mesh-floor instrument limit): angular band [${MESH_FLOOR_RAD},${C_BASIN}]rad invariant=${angFloorInvariant && angMaxInvariant}; nStamp/R ${countRows.map((r) => r.nStamp).join('/')} (weakly R-dep=${nStampWeaklyRDependent}, NOT variety)`);
console.log(`\n(G2) craterOffset rider: deterministic=${offsetDeterministic} variesAcrossWorldSeeds=${offsetsVaryAcross}`);

console.log(`\nsummary → ${join(HERE, 'inc3b-reroll-sweep-summary.json')}`);
if (failures.length) {
  console.log(`\nFAIL — ${failures.length} assert violation(s):`);
  for (const f of failures) console.log(`  • ${f}`);
  process.exit(1);
}
console.log('\nALL ASSERTS GREEN — AC-REROLL headless evidence complete.');
process.exit(0);
