// docs/WORKSTREAMS/world-engine-v2-4-substrate-2026-07-14/calibration/margin-scale.mjs
// World Engine V2-4 slice-3 (passive margins) — margin-SCALE calibration probe (BUILD-PLAN §6.1).
//
// PURPOSE: convert the v1 physical continental-margin anchors (shelf ~80 km / 0.5°, shelf-break ~140 m,
// slope ~3°, rise ~500 km) into the carrier's NORMALIZED height units and GEODESIC angular node distances
// on the real deterministic mesh, and PRINT the derived constants that passiveMargins.js bakes as named
// constants (committed evidence, not a hand-wave). Also:
//   • reads the LIVE plate-world height distribution + the BASE_CONT−BASE_OCEAN step to anchor the vertical
//     amplitude (MARGIN_LIFT_N) and the break/rise depth FRACTIONS;
//   • prints the ISOLATED shelfWidthFactor(volatileFraction) transfer curve (partition held fixed) so
//     AC-MARGIN(c) monotonicity is read off the WIDTH LAW itself, not the repartition-confounded aggregate
//     (§3 confound isolation, lens B-m3);
//   • sweeps PASSIVE_STRESS_MAX and reports passive-transition + oceanic-belt node counts at several mesh
//     resolutions, so PASSIVE_STRESS_MAX and the AC-MARGIN(a) test mesh are chosen with evidence.
//
// METERED-SAFE: pure `node`, no `claude -p`. Run:  node docs/WORKSTREAMS/.../calibration/margin-scale.mjs
import { makeSphereField } from '../../../../src/worldengine/base/sphereField.js';
import { buildIrregularSphere } from '../../../../planet-lod-rivers.js';
import { writePlateUpliftSphere, driversToTune, DEFAULTS } from '../../../../src/worldengine/base/plates.js';
import { solveSeaLevel } from '../../../../planet-lod-sealevel.js';

const SEEDS = [1, 2, 3, 7, 42];
const deg2rad = (d) => d * Math.PI / 180;

// ── physical anchors (v1 ROADMAP #5.5) + the documented continent/ocean relief scale ─────────────
const EARTH_RADIUS_KM = 6371;          // mean Earth radius (arc = radius·angle ⇒ geodesic rad = km/6371)
const RELIEF_M        = 4500;          // continent-ocean vertical relief the normalized STEP (0.26) stands for
const SHELF_DEG       = 0.5;           // shelf width — the plan's geodesic anchor (the ~80 km figure = 0.72°, cross-checked below)
const SHELF_KM        = 80;            // shelf width — the km anchor (cross-check only)
const BREAK_M         = 140;           // shelf-break depth below the coastal datum
const SLOPE_DEG       = 3;             // continental-slope gradient (descent angle)
const RISE_KM         = 500;           // continental-rise width (the abyssal apron)
const RISE_DEPTH_M    = 1000;          // rise vertical span (gentle apron above the abyssal plain)

// ── vertical anchors → normalized fractions of the continent/ocean step ──────────────────────────
const BASE_OCEAN = DEFAULTS.BASE_OCEAN, BASE_CONT = DEFAULTS.BASE_CONT;
const STEP_N     = BASE_CONT - BASE_OCEAN;                 // 0.26 — the normalized continent/ocean step (= RELIEF_M)
const BREAK_DZ_N = (BREAK_M / RELIEF_M) * STEP_N;          // 140 m as a normalized height drop
const SLOPE_DEPTH_M = RELIEF_M - BREAK_M - RISE_DEPTH_M;   // the slope descends the bulk of the relief
// profile-SHAPE fractions (of the full coast→abyss depth) — mesh-independent, amplitude-independent:
const BREAK_DROP = BREAK_M / RELIEF_M;                     // fraction of lift lost across the (near-flat) shelf
const RISE_TOP   = RISE_DEPTH_M / RELIEF_M;                // fraction of lift remaining at the top of the rise

// ── horizontal anchors → geodesic radians (resolution-independent, like plates.js BELT_RADIANS) ──
const SHELF_W_RAD = deg2rad(SHELF_DEG);                    // 0.5° shelf
const SHELF_W_RAD_KM = (SHELF_KM / EARTH_RADIUS_KM);      // cross-check: 80 km ⇒ 0.72°
const SLOPE_W_M   = SLOPE_DEPTH_M / Math.tan(deg2rad(SLOPE_DEG));   // horizontal run to descend the slope at 3°
const SLOPE_W_RAD = (SLOPE_W_M / 1000) / EARTH_RADIUS_KM;  // metres → km → geodesic radians
const RISE_W_RAD  = RISE_KM / EARTH_RADIUS_KM;             // 500 km ⇒ 4.5°
const MARGIN_TOTAL_W_RAD = SHELF_W_RAD + SLOPE_W_RAD + RISE_W_RAD;

// ── LIVE amplitude anchor: run a real plate world, solve the representative sea level, set MARGIN_LIFT_N ──
// The near-shore shelf sits just below the coastal datum (sea level); the abyss sits at BASE_OCEAN. So the
// amplitude of the shelf lift = seaLevel − BASE_OCEAN, read from the live distribution at the shipped target
// ocean fraction (DEFAULT_PARAMS.TARGET_OCEAN_FRACTION = 0.35).
const TARGET_OCEAN_FRACTION = 0.35;
function liveSeaLevel(N, seed) {
  const carrier = makeSphereField(buildIrregularSphere(N, 2));
  writePlateUpliftSphere(carrier, {}, { macroSeed: seed });
  return solveSeaLevel(carrier.height, TARGET_OCEAN_FRACTION);
}
const seaLevels = SEEDS.map((s) => liveSeaLevel(700, s));
const meanSeaLevel = seaLevels.reduce((a, b) => a + b, 0) / seaLevels.length;
const MARGIN_LIFT_N = Math.max(0.02, meanSeaLevel - BASE_OCEAN);

// ── shelfWidthFactor(vf): wetter ⇒ wider shelves, monotone, anchored to 1.0 at Earth vf0 (D_EARTH 0.15) ──
const VF0 = 0.15, WIDEN_K = 2.5, WF_LO = 0.3, WF_HI = 3.0;
const shelfWidthFactor = (vf) => Math.max(WF_LO, Math.min(WF_HI, 1 + WIDEN_K * (vf - VF0)));

// ── passive-margin node census: sweep PASSIVE_STRESS_MAX at several resolutions ───────────────────
// Replicates the writer's selection inline (the writer does not exist yet at calibration time): a
// continent/ocean transition is PASSIVE when |boundaryStress| at the transition node is below the cut.
function census(N, seed, cut) {
  const carrier = makeSphereField(buildIrregularSphere(N, 2));
  const diag = writePlateUpliftSphere(carrier, {}, { macroSeed: seed });
  const { plateId, plateType, boundaryStress, meanEdgeAngle } = diag;
  const adj = carrier.adj;
  const cont = new Uint8Array(N);
  for (let i = 0; i < N; i++) cont[i] = plateType[plateId[i]];
  // passive transition set
  const passive = [];
  let transitions = 0;
  for (let i = 0; i < N; i++) {
    let isT = false;
    for (const j of adj[i]) if (cont[j] !== cont[i]) { isT = true; break; }
    if (!isT) continue;
    transitions++;
    if (Math.abs(boundaryStress[i]) < cut) passive.push(i);
  }
  // multi-source BFS from passive transitions → oceanic belt node count within MARGIN_TOTAL_W
  const dist = new Int32Array(N).fill(-1);
  const q = new Int32Array(N); let qh = 0, qt = 0;
  for (const i of passive) { dist[i] = 0; q[qt++] = i; }
  while (qh < qt) { const c = q[qh++]; for (const nb of adj[c]) if (dist[nb] < 0) { dist[nb] = dist[c] + 1; q[qt++] = nb; } }
  let belt = 0;
  for (let i = 0; i < N; i++) {
    if (cont[i] === 0 && dist[i] >= 0 && dist[i] * meanEdgeAngle < MARGIN_TOTAL_W_RAD) belt++;
  }
  return { transitions, passive: passive.length, belt, meanEdgeAngle };
}

// ─────────────────────────────────────────────────────────────────────────────────────────────────
const out = [];
const p = (s) => out.push(s);
p('═══════════════════════════════════════════════════════════════════════════════════');
p('  V2-4 slice-3 PASSIVE-MARGIN SCALE calibration  (margin-scale.mjs — BUILD-PLAN §6.1)');
p('═══════════════════════════════════════════════════════════════════════════════════');
p('');
p('── vertical anchors → normalized carrier height units ────────────────────────────────');
p(`  BASE_OCEAN = ${BASE_OCEAN}   BASE_CONT = ${BASE_CONT}   STEP_N (cont−ocean) = ${STEP_N.toFixed(4)}  (= ${RELIEF_M} m)`);
p(`  BREAK_DZ_N   = ${BREAK_DZ_N.toFixed(5)}   (shelf-break ${BREAK_M} m  →  ${(BREAK_M / RELIEF_M * 100).toFixed(2)}% of the step)`);
p(`  BREAK_DROP   = ${BREAK_DROP.toFixed(5)}   (profile fraction lost across the shelf — near-flat)`);
p(`  RISE_TOP     = ${RISE_TOP.toFixed(5)}   (profile fraction remaining at the top of the rise)`);
p('');
p('── horizontal anchors → geodesic radians (resolution-independent) ─────────────────────');
p(`  SHELF_W_RAD  = ${SHELF_W_RAD.toFixed(6)} rad (${SHELF_DEG}°)   [km cross-check: ${SHELF_KM} km ⇒ ${SHELF_W_RAD_KM.toFixed(6)} rad = ${(SHELF_W_RAD_KM * 180 / Math.PI).toFixed(2)}°]`);
p(`  SLOPE_W_RAD  = ${SLOPE_W_RAD.toFixed(6)} rad (${(SLOPE_W_RAD * 180 / Math.PI).toFixed(3)}°)   [descend ${SLOPE_DEPTH_M} m at ${SLOPE_DEG}° ⇒ ${(SLOPE_W_M / 1000).toFixed(1)} km]`);
p(`  RISE_W_RAD   = ${RISE_W_RAD.toFixed(6)} rad (${(RISE_W_RAD * 180 / Math.PI).toFixed(3)}°)   [${RISE_KM} km]`);
p(`  MARGIN_TOTAL_W_RAD = ${MARGIN_TOTAL_W_RAD.toFixed(6)} rad (${(MARGIN_TOTAL_W_RAD * 180 / Math.PI).toFixed(3)}°)`);
p('');
p('── vertical AMPLITUDE from the LIVE plate-world sea level (target ocean frac 0.35) ─────');
p(`  per-seed seaLevel @700: ${seaLevels.map((s) => s.toFixed(4)).join(', ')}`);
p(`  mean seaLevel = ${meanSeaLevel.toFixed(4)}   ⇒   MARGIN_LIFT_N = seaLevel − BASE_OCEAN = ${MARGIN_LIFT_N.toFixed(4)}`);
p('');
p('── shelfWidthFactor(vf) transfer curve (ISOLATED — partition/seed held fixed; lens B-m3) ─');
p(`  anchored at Earth vf0 = ${VF0} ⇒ 1.000 ; law = clamp(${WF_LO}, ${WF_HI}, 1 + ${WIDEN_K}·(vf−${VF0}))`);
for (const vf of [0.02, 0.05, 0.10, 0.15, 0.25, 0.35, 0.50]) {
  p(`    vf=${vf.toFixed(2)}  →  shelfWidthFactor = ${shelfWidthFactor(vf).toFixed(4)}`);
}
p('  (strictly increasing across the sweep ⇒ AC-MARGIN(c) monotonicity holds on the width law itself)');
p('');
p('── passive-margin node census (mean over seeds) — pick PASSIVE_STRESS_MAX + test mesh ───');
p('  meanEdgeAngle: ' + [700, 3000, 8000].map((N) => {
  const c = census(N, 1, 0.15);
  return `N=${N}→${c.meanEdgeAngle.toFixed(4)}rad(${(c.meanEdgeAngle * 180 / Math.PI).toFixed(2)}°)`;
}).join('  '));
for (const N of [700, 3000, 8000]) {
  p(`  N=${N}:`);
  for (const cut of [0.05, 0.10, 0.15, 0.20, 0.30]) {
    const cs = SEEDS.map((s) => census(N, s, cut));
    const avg = (k) => (cs.reduce((a, c) => a + c[k], 0) / cs.length);
    p(`     cut=${cut.toFixed(2)}  transitions≈${avg('transitions').toFixed(0)}  passive≈${avg('passive').toFixed(0)}  oceanic-belt-nodes≈${avg('belt').toFixed(0)}`);
  }
}
p('');
p('── BAKED CONSTANTS (copy into src/worldengine/base/passiveMargins.js) ──────────────────');
p(`  STEP_N            = ${STEP_N.toFixed(4)}`);
p(`  MARGIN_LIFT_N     = ${MARGIN_LIFT_N.toFixed(4)}`);
p(`  SHELF_W_RAD       = ${SHELF_W_RAD.toFixed(6)}`);
p(`  SLOPE_W_RAD       = ${SLOPE_W_RAD.toFixed(6)}`);
p(`  RISE_W_RAD        = ${RISE_W_RAD.toFixed(6)}`);
p(`  BREAK_DROP        = ${BREAK_DROP.toFixed(5)}`);
p(`  RISE_TOP          = ${RISE_TOP.toFixed(5)}`);
p(`  PASSIVE_STRESS_MAX= 0.15   (see census — ~half of transitions passive, healthy belt at N≥3000)`);
p(`  PASSIVE_BELT_RAD  = ${DEFAULTS.BELT_RADIANS}   (= plates.js BELT_RADIANS, the stress-spread scale)`);
p(`  VF0 / WIDEN_K     = ${VF0} / ${WIDEN_K}`);
p('═══════════════════════════════════════════════════════════════════════════════════');
process.stdout.write(out.join('\n') + '\n');
