// docs/WORKSTREAMS/world-engine-v2-5-bombardment-2026-07-17/calibration/crater-gate.mjs
// World Engine V2-5 (bombardment) — GATE calibration probe (BUILD-PLAN §7.4, §3).
//
// PURPOSE: pin the label-free, E1-blind self-gate thresholds (CRATER_ATMO_MAX / CRATER_TIDAL_MAX /
// CRATER_T_MAX) and CONFIRM the predicate isImpactSurface(condition) fires on EXACTLY the four intended
// dead-lid targets — Frozen, Crystal, Mars, Moon/Mercury — and NO other preset, reading ONLY condition-vector
// scalars (atmosphere.pressure, rawTidalIoRatio, T_eq — NO regime, NO composition class, NO label; LANDMINE
// #4). Gate accuracy is a BEHAVIORAL check here (byte-inert either way: craterField is unhashed — BS-m3), so
// this probe, not the byte gate, is where the four-target selection is validated.
//
// NOTE (M-m5, surfaced to Max): the data-driven gate fires on Crystal (faceted) as well as Frozen — Crystal
// is airless + dead + cold (condition-scalar-INDISTINGUISHABLE from Frozen), so it cannot be excluded without
// a forbidden label/archetype read. Recommend accepting Crystal as an intended dead-lid-icy target; UAT call.
//
// The Moon/Mercury preset is not yet in DRIVER_PRESETS (SLICE 2 adds it) — its condition is constructed inline
// from the §5 spec so this probe reports all 18. isImpactSurface here is TEXTUALLY the writer's gate.
//
// METERED-SAFE: pure `node`, no `claude -p`.  Run:  node docs/WORKSTREAMS/.../calibration/crater-gate.mjs
import { DRIVER_PRESETS } from '../../../../driver-presets.js';
import { deriveConditionVector } from '../../../../body-condition-vector.js';
import { deriveUniforms } from '../../../../planet-lod-lab-core.js';

// ── pinned gate thresholds ────────────────────────────────────────────────────────────────────────
const CRATER_ATMO_MAX = 0.05;   // bar — airless-or-thin (below the liquid-retention gate)
const CRATER_TIDAL_MAX = 0.15;  // rawTidalIoRatio — dead (no tidal resurfacing); = e1's SHOULDER_LO
const CRATER_T_MAX = 450;       // K — cold enough to be a solid, cratered lithosphere (not molten)

// isImpactSurface(condition) — condition scalars ONLY (LANDMINE #4). TEXTUALLY the writer's gate.
function isImpactSurface(condition) {
  const atmo = condition.atmosphere;
  const airless = !atmo || (atmo.pressure ?? 0) < CRATER_ATMO_MAX;
  const dead = (condition.rawTidalIoRatio ?? 0) < CRATER_TIDAL_MAX;
  const cold = (condition.T_eq ?? 288) < CRATER_T_MAX;
  return airless && dead && cold;
}

// Moon/Mercury (impact-airless) — §5 inline fp (SLICE 2 adds it to DRIVER_PRESETS)
const MOON_FP = {
  radiusEarth: 0.38, massEarth: 0.04, eccentricity: 0.05, starMassEarth: 332946, orbitRadiusEarth: 117275,
  composition: { ironFraction: 0.4, density: 4.5, volatileFraction: 0.02 }, age: 4.5, T_eq: 235,
  tidalState: { locked: false }, atmosphere: null, habitability: 0,
  surfaceHistory: { erosion: 0.05, bombardmentIntensity: 0.9, resurfacingRate: 0.05 },
};

const EXPECTED = new Set(['Frozen (airless)', 'Crystal (faceted)', 'Mars (arid rocky)', 'Moon/Mercury (impact-airless)']);
const entries = [...Object.keys(DRIVER_PRESETS).map((name) => [name, DRIVER_PRESETS[name]]), ['Moon/Mercury (impact-airless)', MOON_FP]];

const out = [];
const p = (s) => out.push(s);
p('══════════════════════════════════════════════════════════════════════════════════════════════════');
p('  V2-5 BOMBARDMENT — GATE calibration  (crater-gate.mjs — BUILD-PLAN §7.4 / §3)');
p(`  CRATER_ATMO_MAX = ${CRATER_ATMO_MAX} bar   CRATER_TIDAL_MAX = ${CRATER_TIDAL_MAX}   CRATER_T_MAX = ${CRATER_T_MAX} K`);
p('  predicate = airless-or-thin AND dead(rawTidal) AND cold(T_eq) — condition scalars ONLY (no regime/label)');
p('══════════════════════════════════════════════════════════════════════════════════════════════════');
p('');
p('   preset                            atmoPress   rawTidal    T_eq   airless  dead   cold   FIRES?');
p('   ─────────────────────────────────────────────────────────────────────────────────────────────');
const fired = new Set();
for (const [name, fp] of entries) {
  const u = deriveUniforms(fp, 1.0);
  const cond = deriveConditionVector(fp, u, fp.radiusEarth);
  const atmoP = cond.atmosphere ? (cond.atmosphere.pressure ?? 0) : null;
  const airless = !cond.atmosphere || (cond.atmosphere.pressure ?? 0) < CRATER_ATMO_MAX;
  const dead = (cond.rawTidalIoRatio ?? 0) < CRATER_TIDAL_MAX;
  const cold = (cond.T_eq ?? 288) < CRATER_T_MAX;
  const fires = isImpactSurface(cond);
  if (fires) fired.add(name);
  const atmoStr = atmoP === null ? 'null' : atmoP.toFixed(3);
  p(`   ${name.padEnd(32)} ${atmoStr.padStart(8)}   ${(cond.rawTidalIoRatio ?? 0).toFixed(4).padStart(8)}   ${String(cond.T_eq).padStart(5)}   ${airless ? ' ✓' : ' ·'}     ${dead ? '✓' : '·'}     ${cold ? '✓' : '·'}    ${fires ? '★ YES' : 'no'}`);
}
p('');
const firedSorted = [...fired].sort();
const expectedSorted = [...EXPECTED].sort();
const exactlyFour = fired.size === EXPECTED.size && [...EXPECTED].every((n) => fired.has(n));
p(`  fired (${fired.size}): ${firedSorted.join(', ')}`);
p(`  expected (${EXPECTED.size}): ${expectedSorted.join(', ')}`);
p(`  ASSERT exactly the four intended targets fire : ${exactlyFour ? 'PASS' : 'FAIL'}`);
p('');
p('── BAKED CONSTANTS (copy into src/worldengine/base/bombardment.js) ─────────────────────────────────');
p(`  CRATER_ATMO_MAX  = ${CRATER_ATMO_MAX}`);
p(`  CRATER_TIDAL_MAX = ${CRATER_TIDAL_MAX}`);
p(`  CRATER_T_MAX     = ${CRATER_T_MAX}`);
p('');
p(`  OVERALL: ${exactlyFour ? 'ALL PASS' : 'FAIL — retune thresholds'}`);
p('══════════════════════════════════════════════════════════════════════════════════════════════════');
process.stdout.write(out.join('\n') + '\n');
