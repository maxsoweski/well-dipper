#!/usr/bin/env node
// ⚠ SUPERSEDED IN PART (gravity-selfcompression-2026-07-28): references below to
//    g = g_c*(R/R_c) record the CONSTANT-DENSITY law live when this file was written.
//    Gravity is now g = g_c*f(R)/f(R_c), f piecewise in absolute Earth radii
//    (R^(4/3) below 1 R_E, R^1.70 above), ROCKY class only. Kept for audit trail.

// docs/WORKSTREAMS/world-engine-radius-live-feed-2026-07-25/calibration/craterboot-radius-sweep.mjs
//
// AC-CRATERBOOT measurement harness (WS world-engine-radius-live-feed-2026-07-25).
//
// THE CLAIM UNDER TEST (planet-lod-lab.html:5146 source comment):
//   "Canonical radius suffices: the relevance predicate is a domain class (impact surface + schedule
//    fired), R-stable within a preset."
// The boot-time feature-enable set calls
//   craterRelevanceOf(deriveConditionVector(_fp, deriveUniforms(_fp, tier), _fp.radiusEarth))
// i.e. it feeds the CANONICAL preset radius, never the drawn one. That is a testable claim about a
// pure function: sweep the third argument across the lab's real radius-slider range for every preset
// and see whether craterRelevanceOf's value ever changes.
//
// WHAT IS SWEPT AND WHAT IS HELD:
//   held  — fp (the preset literal) and `derived = deriveUniforms(fp, tier)`. This mirrors the site
//           EXACTLY: a live rewire would change ONLY deriveConditionVector's 3rd argument. (deriveUniforms
//           reads fp.massEarth/fp.radiusEarth for surfaceGravity and fp orbit/ecc for tidalHeat; the
//           qualityTier argument touches neither, so tier is irrelevant to every field the predicate reads.)
//   swept — radiusEarth, the 3rd argument. deriveConditionVector then derives
//           condition.surfaceGravity = g_c * (R / R_c), so GRAVITY MOVES WITH RADIUS. A gravity-sensitive
//           predicate is radius-sensitive even though it never names radius: craterSchedule's size
//           multiplier is (G_REF/g)^K_GS, so the swept g is inside the measurement.
//
// SAMPLING: the lab's slider is a log map, radiusFromT(t) = 0.3 * (16/0.3)^t over t in [0,1]
// (planet-lod-lab-core.js:68-71). Samples are taken at uniform t, so they are log-spaced in R exactly
// the way the slider's travel is — 401 samples => ~1.0% multiplicative steps.
//
// WHY 0/1 SAMPLING ALONE IS NOT ENOUGH, AND WHAT ELSE IS REPORTED: a 0/1 scan on a finite grid could in
// principle step over a flip narrower than the sample spacing. So the harness ALSO reports the four
// continuous MARGINS whose sign changes are the only way craterRelevanceOf can flip (derived by reading
// craterSchedule): H/L, H/L_trunc, D_FLOOR/L and tExp. relevance can only change where one of those
// crosses its boundary (ratio -> 1, or tExp -> 0). Reporting min-over-sweep of each margin turns
// "no flip on this grid" into "no flip is reachable anywhere on this interval".
//
// CONTROLS (mandatory; run every invocation, printed as their own section): an instrument that has never
// caught a known defect is unproven. Two in-harness controls prove the flip DETECTOR:
//   NEG  — a constant relevance stub must report FLIPS=false (the detector is not a yes-machine).
//   POS  — a step stub that flips at a KNOWN radius must report FLIPS=true AND localise the flip radius.
// A third, law-level planted defect (a temporary one-constant edit to bombardment.js) is run by hand and
// recorded in evidence/G2-craterboot-sweep.md — it proves the detector fires through the REAL presets.
//
// PURE / HEADLESS: no THREE, no DOM, no server, no file writes. Prints markdown to stdout.
// Usage:  node docs/WORKSTREAMS/world-engine-radius-live-feed-2026-07-25/calibration/craterboot-radius-sweep.mjs
//         [--samples=401] [--tier=1.0]

import { DRIVER_PRESETS } from '../../../../driver-presets.js';
import { deriveConditionVector } from '../../../../body-condition-vector.js';
import { deriveUniforms, radiusFromT, RADIUS_SLIDER_MIN, RADIUS_SLIDER_MAX } from '../../../../planet-lod-lab-core.js';
import { craterRelevanceOf, craterSchedule, isImpactSurface,
         C_BASIN, MESH_FLOOR_RAD, D_SFD_MIN_KM, C_ATMO_KM, P_ATMO_EXP,
         G_REF, K_GS, CRATER_T_MAX, P_SURF_MAX } from '../../../../src/worldengine/base/bombardment.js';
import { KM_PER_EARTH_RADIUS, radPerKm } from '../../../../src/worldengine/base/baseStep.js';
import { erosionOf } from '../../../../src/worldengine/base/surfaceMaterial.js';

// ── args ─────────────────────────────────────────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
const argOf = (k, d) => { const a = argv.find(s => s.startsWith(`--${k}=`)); return a ? a.split('=')[1] : d; };
const N_SAMPLES = Math.max(200, parseInt(argOf('samples', '401'), 10));   // contract floor: >= 200
const TIER      = parseFloat(argOf('tier', '1.0'));

// ── the sample grid: uniform in slider-t => log-spaced in R, exactly the slider's own travel ─────────
const SAMPLES = Array.from({ length: N_SAMPLES }, (_, i) => radiusFromT(i / (N_SAMPLES - 1)));
const R_MIN = SAMPLES[0], R_MAX = SAMPLES[SAMPLES.length - 1];

// ── the generic flip detector ────────────────────────────────────────────────────────────────────────
// relevanceAtR: (R) => 0|1 . Returns { values, flips[], everChanges, min, max }.
// Flip radius is localised by 64-step bisection on the SAME relevance function (not interpolated), so a
// reported flip radius is a real bracket, accurate to (R_hi - R_lo) <= range * 2^-64 in log space.
function sweepFlips(relevanceAtR, samples = SAMPLES) {
  const values = samples.map(R => relevanceAtR(R));
  const flips = [];
  for (let i = 1; i < values.length; i++) {
    if (values[i] !== values[i - 1]) {
      let lo = samples[i - 1], hi = samples[i];
      const vLo = values[i - 1];
      for (let k = 0; k < 64; k++) {
        const mid = Math.sqrt(lo * hi);                       // geometric midpoint (log bisection)
        if (relevanceAtR(mid) === vLo) lo = mid; else hi = mid;
      }
      flips.push({ from: values[i - 1], to: values[i], rLo: lo, rHi: hi, r: Math.sqrt(lo * hi) });
    }
  }
  return { values, flips, everChanges: flips.length > 0,
           min: Math.min(...values), max: Math.max(...values) };
}

// ── margin diagnostics: the ONLY four continuous quantities whose boundary crossing can flip the ─────
// predicate. Re-derived here from craterSchedule's own inputs (same constants, same formulas), so the
// margins describe the real code path rather than a parallel model.
//   relevance = isImpactSurface(c) && schedule.fired && (nStamp > 0 || regolithRoughness > 0)
//   fired      <= isImpactSurface: T_eq < CRATER_T_MAX && P < P_SURF_MAX  (reads NEITHER R NOR g)
//   degenerate <= !(L < H) || !(L_trunc < H) || tExp <= 0
//   regolith>0 <= !degenerate && D_FLOOR_KM > L   (then nAnalytic > 0 and ED2s > 0 follow algebraically)
function marginsAt(cond) {
  const R      = Math.max(1e-6, cond.radiusEarth ?? 1.0);
  const R_km   = KM_PER_EARTH_RADIUS * R;
  const g      = Math.max(1e-6, cond.surfaceGravity ?? G_REF);
  const P      = cond.atmosphere?.pressure ?? 0;
  const td     = cond.rawTidalIoRatio ?? 0;
  const age    = Math.min(4.6, Math.max(0, cond.age ?? 4.0));
  const D_ATMO = C_ATMO_KM * Math.pow(P, P_ATMO_EXP);
  const D_LO   = Math.max(D_SFD_MIN_KM, D_ATMO);
  const L      = D_LO * Math.pow(G_REF / g, K_GS);
  const H      = C_BASIN * R_km;
  const D_FLR  = MESH_FLOOR_RAD / radPerKm(R);
  const L_tr   = Math.max(L, D_FLR);
  const tExp   = Math.min(age, 0.7 / Math.max(td, 1e-6), 0.1 / Math.max(erosionOf(cond), 1e-6));
  const s      = craterSchedule(cond);
  return { R, g, L, H, D_FLR, L_tr, tExp,
           mHL: H / L, mHLtr: H / L_tr, mFLR: D_FLR / L,
           nAnalytic: s.nAnalytic, nStamp: s.nStamp, regolith: s.regolithRoughness, fired: s.fired };
}

// ── per-preset sweep ─────────────────────────────────────────────────────────────────────────────────
function sweepPreset(name) {
  const fp  = DRIVER_PRESETS[name];
  const u   = deriveUniforms(fp, TIER);                        // HELD at canonical, exactly like the site
  const R_c = fp.radiusEarth ?? 1.0;
  const condAt = (R) => deriveConditionVector(fp, u, R);
  let threw = null;
  const rel = (R) => { try { return craterRelevanceOf(condAt(R)); } catch (e) { threw = e; return NaN; } };

  const sw   = sweepFlips(rel);
  const relC = rel(R_c);

  // isImpactSurface R-invariance check (the first gate) — measured, not asserted.
  const impactVals = new Set(SAMPLES.map(R => isImpactSurface(condAt(R))));

  // margins over the whole sweep
  const m = SAMPLES.map(R => marginsAt(condAt(R)));
  const minOf = (f) => m.reduce((a, x) => Math.min(a, f(x)), Infinity);
  const maxOf = (f) => m.reduce((a, x) => Math.max(a, f(x)), -Infinity);

  return {
    name, R_c, relMin: rel(R_MIN), relC, relMax: rel(R_MAX),
    flips: sw.flips, everChanges: sw.everChanges, threw,
    impactInvariant: impactVals.size === 1, impactValue: [...impactVals][0],
    T_eq: fp.T_eq, P: fp.atmosphere?.pressure ?? 0,
    gAtRmin: m[0].g, gAtRmax: m[m.length - 1].g,
    minHL: minOf(x => x.mHL), minHLtr: minOf(x => x.mHLtr), minFLR: minOf(x => x.mFLR),
    minTexp: minOf(x => x.tExp),
    minRegolith: minOf(x => x.regolith), minNAnalytic: minOf(x => x.nAnalytic),
    maxRegolith: maxOf(x => x.regolith),
  };
}

// ── formatting ───────────────────────────────────────────────────────────────────────────────────────
const sig = (x, d = 3) => (!Number.isFinite(x) ? String(x) : (x === 0 ? '0' : Number(x).toPrecision(d)));
const fx  = (x, d = 3) => (!Number.isFinite(x) ? String(x) : Number(x).toFixed(d));

const rows = Object.keys(DRIVER_PRESETS).map(sweepPreset);

const out = [];
out.push('## AC-CRATERBOOT — craterRelevanceOf vs drawn radius, all presets\n');
out.push(`- slider law: \`radiusFromT(t) = ${RADIUS_SLIDER_MIN} * (${RADIUS_SLIDER_MAX}/${RADIUS_SLIDER_MIN})^t\`, t in [0,1] (planet-lod-lab-core.js:68-71)`);
out.push(`- swept range: R in [${fx(R_MIN, 4)}, ${fx(R_MAX, 4)}] Earth radii, **${N_SAMPLES} log-spaced samples** (~${fx((Math.pow(R_MAX / R_MIN, 1 / (N_SAMPLES - 1)) - 1) * 100, 2)}% multiplicative step)`);
out.push(`- held fixed per preset: \`fp\` and \`deriveUniforms(fp, ${TIER})\` — only deriveConditionVector's 3rd argument moves (the exact rewire target)`);
out.push(`- gravity DOES move: \`condition.surfaceGravity = g_c*(R/R_c)\` (body-condition-vector.js:37), so the swept range covers a ${fx(R_MAX / R_MIN, 1)}x gravity range per preset`);
out.push(`- predicate: \`craterRelevanceOf\` = isImpactSurface AND schedule.fired AND (nStamp>0 OR regolithRoughness>0) (bombardment.js:220-224)\n`);

out.push('| preset | canonical R_c | rel @ R_min | rel @ R_c | rel @ R_max | FLIPS? | flip radius |');
out.push('|---|---|---|---|---|---|---|');
for (const r of rows) {
  const flipTxt = r.everChanges ? r.flips.map(f => `${f.from}->${f.to} @ R=${sig(f.r, 6)}`).join('; ') : '—';
  out.push(`| ${r.name} | ${r.R_c} | ${r.relMin} | ${r.relC} | ${r.relMax} | ${r.everChanges ? '**YES**' : 'no'} | ${flipTxt} |`);
}

out.push('\n### Why no flip is reachable BETWEEN samples — continuous margins over the same sweep\n');
out.push('`craterRelevanceOf` can only change value where one of these crosses its boundary: H/L -> 1, H/L_trunc -> 1,');
out.push('D_FLOOR/L -> 1, or t_exp -> 0 (or the R-blind isImpactSurface gate flips). Min-over-sweep of each:\n');
out.push('| preset | impact surface (R-invariant?) | min H/L | min H/L_trunc | min D_FLOOR/L | min t_exp (Ga) | min regolithRoughness | min nAnalytic |');
out.push('|---|---|---|---|---|---|---|---|');
for (const r of rows) {
  out.push(`| ${r.name} | ${r.impactValue} (${r.impactInvariant ? 'yes' : '**NO**'}) | ${sig(r.minHL)} | ${sig(r.minHLtr)} | ${sig(r.minFLR)} | ${sig(r.minTexp)} | ${sig(r.minRegolith)} | ${sig(r.minNAnalytic)} |`);
}

out.push('\n### Gravity actually swept (proof the g-channel is inside the measurement)\n');
out.push('| preset | g @ R_min | g @ R_c | g @ R_max | g range |');
out.push('|---|---|---|---|---|');
for (const r of rows) {
  const fp = DRIVER_PRESETS[r.name];
  const gC = deriveConditionVector(fp, deriveUniforms(fp, TIER), r.R_c).surfaceGravity;
  out.push(`| ${r.name} | ${sig(r.gAtRmin)} | ${sig(gC)} | ${sig(r.gAtRmax)} | ${fx(r.gAtRmax / r.gAtRmin, 1)}x |`);
}

// ── CONTROLS ─────────────────────────────────────────────────────────────────────────────────────────
out.push('\n### In-harness controls (the detector is proven, not assumed)\n');

// NEG — vacuity guard: a detector that always prints "no" is worthless.
const negA = sweepFlips(() => 1);
const negB = sweepFlips(() => 0);
// POS — step stub at a KNOWN radius: the detector must fire AND localise.
const R_STEP = 4.0;
const pos = sweepFlips((R) => (R >= R_STEP ? 1 : 0));
// POS2 — a flip near the very top of the range, to show localisation is not hard-coded to mid-range.
const R_STEP2 = 12.5;
const pos2 = sweepFlips((R) => (R >= R_STEP2 ? 0 : 1));

out.push('| control | relevance fed to the detector | expected | FLIPS? | flip radius reported | verdict |');
out.push('|---|---|---|---|---|---|');
out.push(`| NEG-1 | constant 1 | FLIPS=false | ${negA.everChanges ? 'YES' : 'no'} | — | ${negA.everChanges === false ? 'PASS' : 'FAIL'} |`);
out.push(`| NEG-0 | constant 0 | FLIPS=false | ${negB.everChanges ? 'YES' : 'no'} | — | ${negB.everChanges === false ? 'PASS' : 'FAIL'} |`);
out.push(`| POS-A | step 0->1 at R=${R_STEP} | FLIPS=true @ ${R_STEP} | ${pos.everChanges ? 'YES' : 'no'} | ${pos.flips.map(f => sig(f.r, 8)).join(';') || '—'} | ${pos.everChanges && Math.abs(pos.flips[0].r - R_STEP) / R_STEP < 1e-9 ? 'PASS' : 'FAIL'} |`);
out.push(`| POS-B | step 1->0 at R=${R_STEP2} | FLIPS=true @ ${R_STEP2} | ${pos2.everChanges ? 'YES' : 'no'} | ${pos2.flips.map(f => sig(f.r, 8)).join(';') || '—'} | ${pos2.everChanges && Math.abs(pos2.flips[0].r - R_STEP2) / R_STEP2 < 1e-9 ? 'PASS' : 'FAIL'} |`);

// POS-C — the REAL craterRelevanceOf, fed the MOST FLIP-PRONE condition the predicate's own input domain
// admits, swept over an EXTENDED radius range. This is the control that matters: it fires the detector
// through the real function, and it simultaneously measures HOW FAR outside the slider the nearest
// reachable flip lives.
//
// Constructing the extremal condition (all three levers are pinned by constants the predicate itself uses):
//   - craterSchedule FLOORS gravity: `g = Math.max(1e-6, condition.surfaceGravity ?? G_REF)`. So the size
//     multiplier (G_REF/g)^K_GS has a CEILING - no condition, however absurd, can push it past
//     (G_REF/1e-6)^K_GS. (An earlier low-gravity attempt at this control produced NO flip precisely because
//     the clamp ate it. The clamp is a real property of the predicate, so the bound below is a real bound.)
//   - isImpactSurface caps pressure at P_SURF_MAX, so D_LO = max(D_SFD_MIN_KM, C_ATMO_KM*P^P_ATMO_EXP)
//     has a ceiling too. Together: L_max = D_LO_max * (G_REF/1e-6)^K_GS.
//   - a huge rawTidalIoRatio drives t_exp -> ~0, so nAnalytic -> ~0 and nStamp rounds to 0. That removes
//     the nStamp>0 branch and leaves regolithRoughness>0 (i.e. D_FLOOR_KM > L) as the sole survivor.
// Consequence: over the WHOLE admissible input domain the relevance boundary is D_FLOOR_KM(R) = L, i.e.
//   R_flip_max = L_max / (MESH_FLOOR_RAD * KM_PER_EARTH_RADIUS)   - computed below from the constants.
const P_MAX_IMPACT = P_SURF_MAX - 0.1;                                   // largest P an impact surface may have
const D_LO_MAX     = Math.max(D_SFD_MIN_KM, C_ATMO_KM * Math.pow(P_MAX_IMPACT, P_ATMO_EXP));
const SIZEMUL_MAX  = Math.pow(G_REF / 1e-6, K_GS);                       // the gravity clamp's ceiling
const L_MAX        = D_LO_MAX * SIZEMUL_MAX;                             // km
const R_FLIP_MAX   = L_MAX / (MESH_FLOOR_RAD * KM_PER_EARTH_RADIUS);     // Earth radii - domain-wide bound

const extremal = (R) => craterRelevanceOf({
  radiusEarth: R,
  surfaceGravity: 1e-12,                  // below the 1e-6 clamp => size multiplier pinned at its ceiling
  T_eq: 235,                              // < CRATER_T_MAX, so isImpactSurface still fires
  age: 4.5,
  atmosphere: { pressure: P_MAX_IMPACT }, // just under P_SURF_MAX => D_LO at its ceiling
  rawTidalIoRatio: 1e6,                   // t_exp -> ~0 => nAnalytic -> ~0 => nStamp rounds to 0
  composition: { density: 4.5, volatileFraction: 0.02 },
});
const EXT_N = 1601, EXT_LO = 1e-3, EXT_HI = RADIUS_SLIDER_MAX;
const EXT_SAMPLES = Array.from({ length: EXT_N }, (_, i) => EXT_LO * Math.pow(EXT_HI / EXT_LO, i / (EXT_N - 1)));
const posC = sweepFlips(extremal, EXT_SAMPLES);   // extended range: MUST flip
const posCsl = sweepFlips(extremal, SAMPLES);     // slider range, SAME condition: must NOT flip
const posCok = posC.everChanges && Math.abs(posC.flips[0].r - R_FLIP_MAX) / R_FLIP_MAX < 1e-6;
out.push(`| POS-C | **real craterRelevanceOf**, extremal admissible condition, swept R in [${EXT_LO}, ${EXT_HI}] | FLIPS=true @ predicted R=${sig(R_FLIP_MAX, 6)} | ${posC.everChanges ? 'YES' : 'no'} | ${posC.flips.map(f => `${f.from}->${f.to} @ ${sig(f.r, 6)}`).join(';') || '—'} | ${posCok ? 'PASS' : 'FAIL'} |`);
out.push(`| POS-C-slider | the SAME extremal condition, swept over the SLIDER range only | FLIPS=false | ${posCsl.everChanges ? 'YES' : 'no'} | — | ${posCsl.everChanges === false ? 'PASS' : 'FAIL'} |`);

out.push('\n**Domain-wide bound (not just the 18 presets).** The flip POS-C localises is not an accident of one hand-built body —');
out.push('it sits exactly at the analytic boundary that bounds EVERY condition the predicate accepts:\n');
out.push('```');
out.push(`D_LO_max    = max(D_SFD_MIN_KM=${D_SFD_MIN_KM}, C_ATMO_KM=${C_ATMO_KM} * P_SURF_MAX^P_ATMO_EXP=${P_ATMO_EXP})   = ${sig(D_LO_MAX, 6)} km`);
out.push(`sizeMul_max = (G_REF=${G_REF} / gravity clamp 1e-6)^K_GS=${K_GS}                = ${sig(SIZEMUL_MAX, 6)}`);
out.push(`L_max       = D_LO_max * sizeMul_max                              = ${sig(L_MAX, 6)} km`);
out.push(`R_flip_max  = L_max / (MESH_FLOOR_RAD=${MESH_FLOOR_RAD} * KM_PER_EARTH_RADIUS=${KM_PER_EARTH_RADIUS})  = ${sig(R_FLIP_MAX, 6)} R_E`);
out.push(`slider floor RADIUS_SLIDER_MIN                                    = ${RADIUS_SLIDER_MIN} R_E`);
out.push(`headroom                                                          = ${sig(RADIUS_SLIDER_MIN / R_FLIP_MAX, 4)}x below the slider floor`);
out.push('```');
out.push(`\nMeasured flip radius (POS-C, 64-step log bisection on the real predicate): **${sig(posC.flips[0]?.r ?? NaN, 8)}** vs predicted **${sig(R_FLIP_MAX, 8)}** (relative difference ${posC.flips[0] ? sig(Math.abs(posC.flips[0].r - R_FLIP_MAX) / R_FLIP_MAX, 2) : 'n/a'}).`);
out.push(`So no condition the predicate accepts can flip at R >= ${sig(R_FLIP_MAX, 4)} R_E, and the slider never goes below ${RADIUS_SLIDER_MIN} R_E.`);

const controlsPass = !negA.everChanges && !negB.everChanges
  && pos.everChanges && Math.abs(pos.flips[0].r - R_STEP) / R_STEP < 1e-9
  && pos2.everChanges && Math.abs(pos2.flips[0].r - R_STEP2) / R_STEP2 < 1e-9
  && posCok && !posCsl.everChanges;

// ── verdict ──────────────────────────────────────────────────────────────────────────────────────────
const flipped = rows.filter(r => r.everChanges);
const threwAny = rows.filter(r => r.threw);
out.push('\n### VERDICT\n');
out.push(`- controls: **${controlsPass ? 'ALL PASS' : 'FAILED'}** — the detector fires on known flips, localises them exactly, and stays silent on constants.`);
out.push(`- exceptions thrown by craterRelevanceOf across ${rows.length} presets x ${N_SAMPLES} radii: **${threwAny.length}**`);
if (flipped.length === 0) {
  out.push(`- **NO PRESET FLIPS.** craterRelevanceOf is constant in R over the entire slider range [${fx(R_MIN, 3)}, ${fx(R_MAX, 3)}] for all ${rows.length} presets.`);
  out.push(`- The :5146 site may keep reading the canonical preset radius. This table is the pinned reason.`);
} else {
  out.push(`- **FLIPS FOUND** in ${flipped.length} preset(s): ${flipped.map(r => `${r.name} @ R=${sig(r.flips[0].r, 6)}`).join(', ')}.`);
  out.push(`- The :5146 site is a defect and must be rewired to the drawn radius.`);
}

console.log(out.join('\n'));
process.exit((controlsPass && threwAny.length === 0) ? 0 : 1);
