// tools/port-atmosphere-measure.mjs — WHY every generated planet keeps an atmosphere.
//
// Run: node tools/port-atmosphere-measure.mjs
//
// Context: the lab-pipeline-into-game port kept finding condition-derived features that came out
// DEGENERATE (constant) across the whole generated population — craters, terminator strength,
// space weathering, crater rays, crystal facets. Every one of them traced back to the same place:
// no generated planet is ever airless, and none is ever thin. This script measures that directly
// instead of inferring it, and separates the two independent causes:
//
//   (1) BRANCH REACHABILITY — an algebra bug in computeAtmosphere. The Jeans parameter
//       lambda = G*M*m / (k_B*T_exo*R) is LINEAR in molecular mass, and
//       M_CO2 (7.31e-26) > M_N2 (4.65e-26) > M_H2O (2.99e-26). All three species test against the
//       SAME threshold (6 + uvStripFactor), so retainsH2O => retainsN2 => retainsCO2 for every
//       body in the universe. Therefore `if (retainsCO2)` at PhysicsEngine.js:229 is always true
//       once control gets past the airless return at :195, and the "thin remnant" branch at
//       :240-247 (pressure 0.01 + massEarth*0.1) is UNREACHABLE. That branch is the only path to a
//       sub-0.1 bar atmosphere, i.e. the only path to a Mars.
//
//   (2) PRESSURE FLOORS — even on the reachable branches, pressure is a hardcoded constant plus a
//       mass term, not a physical column. The temperate branch is `0.3 + massEarth*0.8`, so its
//       floor is 0.3 bar for a zero-mass planet. That constant is the population minimum.
//
// The two are separable and this script reports them separately, because fixing (1) alone does not
// give you thin atmospheres if the population never reaches the branch, and fixing (2) alone does
// not give you a Mars if the branch stays dead.
import { PlanetGenerator } from '../src/generation/PlanetGenerator.js';
import { SeededRandom } from '../src/generation/SeededRandom.js';

const TYPES = ['rocky', 'terrestrial', 'ocean', 'ice', 'lava', 'carbon', 'eyeball'];
const ORBITS = [0.15, 0.25, 0.4, 0.6, 0.9, 1.3, 2.0, 3.0, 5.0, 8.0, 13.0, 20.0, 30.0];
const SEEDS = [12345, 777, 90210, 31337, 8675309];

const rows = [];
for (const seed of SEEDS) {
  const rng = new SeededRandom(seed);
  for (const t of TYPES) {
    for (const au of ORBITS) {
      let p;
      try { p = PlanetGenerator.generate(rng, au, null, null, t); } catch { continue; }
      const phys = p?.atmosphere?.physics;
      if (!phys) { rows.push({ t, au, m: p?.massEarth ?? 0, noPhysics: true }); continue; }
      rows.push({
        t, au,
        m: p.massEarth ?? 0,
        r: p.radiusEarth ?? 0,
        T_eq: p.T_eq ?? 0,
        retained: phys.retained,
        comp: phys.composition,
        P: phys.pressure ?? 0,
        jN2: phys.jeansN2, jCO2: phys.jeansCO2, jH2: phys.jeansH2,
      });
    }
  }
}

// Which pressure FORMULA produced each value — this is how we detect a dead branch empirically
// rather than trusting the algebra above.
function branchOf(r) {
  if (!r.retained) return 'airless';
  const m = r.m, P = r.P, eq = (a) => Math.abs(P - a) < 1e-9;
  if (eq(10 + m * 5)) return 'primordial(H2)';
  if (eq(0.3 + m * 0.8)) return 'temperate(N2-O2)';
  if (eq(0.5 + m * 1.5)) return 'co2+N2';
  if (eq(0.1 + m * 0.5)) return 'co2 only';
  if (eq(0.01 + m * 0.1)) return 'THIN REMNANT';
  if (P === 90 || P === 1000 || P === 50) return 'giant short-circuit';
  return `unmatched(P=${P.toFixed(3)})`;
}

const live = rows.filter((r) => !r.noPhysics);
const counts = {};
for (const r of live) { const b = branchOf(r); counts[b] = (counts[b] || 0) + 1; }

console.log(`=== ${live.length} generated bodies (${TYPES.length} types x ${ORBITS.length} orbits x ${SEEDS.length} seeds) ===\n`);

console.log('--- BRANCH REACHABILITY (cause 1) ---');
for (const [b, n] of Object.entries(counts).sort((a, b2) => b2[1] - a[1])) {
  console.log(`  ${String(n).padStart(5)}  ${(100 * n / live.length).toFixed(1).padStart(5)}%  ${b}`);
}
console.log(`\n  THIN REMNANT branch hit ${counts['THIN REMNANT'] || 0} times.`);
console.log('  Predicted by algebra: 0 (unreachable — retainsH2O => retainsN2 => retainsCO2).');

console.log('\n--- THE MONOTONICITY THAT KILLS THE BRANCH ---');
const viol = live.filter((r) => r.jCO2 != null && r.jN2 != null && r.jCO2 <= r.jN2);
console.log(`  bodies where jeansCO2 <= jeansN2: ${viol.length} of ${live.filter(r => r.jCO2 != null).length}`);
console.log('  (any nonzero count would mean the algebra above is wrong)');

console.log('\n--- PRESSURE DISTRIBUTION (cause 2) ---');
const P = live.map((r) => r.P).sort((a, b) => a - b);
const pct = (q) => P[Math.min(P.length - 1, Math.floor(q * P.length))];
console.log(`  min ${P[0].toFixed(4)}  p05 ${pct(0.05).toFixed(3)}  p25 ${pct(0.25).toFixed(3)}  median ${pct(0.5).toFixed(3)}  p75 ${pct(0.75).toFixed(3)}  max ${P[P.length - 1].toFixed(1)}`);
console.log(`  below 0.01 bar (Mars=0.006): ${P.filter((x) => x < 0.01).length}`);
console.log(`  below 0.10 bar             : ${P.filter((x) => x < 0.10).length}`);
console.log(`  retained === false         : ${live.filter((r) => !r.retained).length}`);

console.log('\n--- HOW CLOSE IS THE POPULATION TO AIRLESS? ---');
const jc = live.filter((r) => r.jCO2 != null).map((r) => r.jCO2).sort((a, b) => a - b);
if (jc.length) {
  console.log(`  jeansCO2 (retained if > 6):  min ${jc[0].toFixed(1)}  p05 ${jc[Math.floor(0.05 * jc.length)].toFixed(1)}  median ${jc[Math.floor(0.5 * jc.length)].toFixed(1)}  max ${jc[jc.length - 1].toFixed(0)}`);
  console.log(`  bodies with jeansCO2 < 20 (anywhere near the escape threshold): ${jc.filter((x) => x < 20).length} of ${jc.length}`);
}

console.log('\n--- SMALLEST / HOTTEST BODIES: the ones that SHOULD be airless ---');
console.log('type'.padEnd(12), 'AU'.padStart(6), 'M⊕'.padStart(7), 'R⊕'.padStart(6), 'T_eq'.padStart(6), 'jCO2'.padStart(9), 'P(bar)'.padStart(8), '  branch');
const worst = live.filter((r) => r.jCO2 != null).sort((a, b) => a.jCO2 - b.jCO2).slice(0, 14);
for (const r of worst) {
  console.log(r.t.padEnd(12), r.au.toFixed(2).padStart(6), r.m.toFixed(3).padStart(7), r.r.toFixed(2).padStart(6),
    r.T_eq.toFixed(0).padStart(6), r.jCO2.toFixed(1).padStart(9), r.P.toFixed(3).padStart(8), '  ' + branchOf(r));
}

// ─────────────────────────────────────────────────────────────────────────────
// SOLAR-SYSTEM CALIBRATION — the only way to tell a wrong THRESHOLD from a wrong
// PRESSURE LAW. lambda = G*M*m/(k_B*T_exo*R) is exactly (v_esc / v_thermal)^2, where
// v_thermal is the most-probable Maxwellian speed. The textbook rule of thumb for holding a
// species over ~Gyr is v_esc >~ 6*v_thermal, i.e. lambda >~ 36. The code tests lambda > 6,
// which is v_esc >~ 2.4*v_thermal — the "6" from the rule of thumb applied to lambda instead
// of to the velocity RATIO it belongs to. This block prints the model's verdict on six bodies
// whose real answer is known, so the diagnosis is checked rather than asserted.
import { jeansParameter, exosphericTemperature } from '../src/generation/PhysicsEngine.js';
const M_CO2_ = 7.31e-26;
const KNOWN = [
  { n: 'Earth',   M: 1.0,    R: 1.0,   T_eq: 255, real: '1.0 bar N2-O2' },
  { n: 'Venus',   M: 0.815,  R: 0.949, T_eq: 232, real: '92 bar CO2' },
  { n: 'Mars',    M: 0.107,  R: 0.532, T_eq: 210, real: '0.006 bar CO2  <-- THIN, but RETAINS CO2' },
  { n: 'Titan',   M: 0.0225, R: 0.404, T_eq:  94, real: '1.5 bar N2' },
  { n: 'Mercury', M: 0.055,  R: 0.383, T_eq: 440, real: '~1e-14 bar  (AIRLESS)' },
  { n: 'Moon',    M: 0.0123, R: 0.273, T_eq: 270, real: '~3e-15 bar  (AIRLESS)' },
];
console.log('\n--- SOLAR-SYSTEM CALIBRATION: what does the CURRENT model say? ---');
console.log('body'.padEnd(9), 'lambda_CO2'.padStart(11), '  >6 (shipped)'.padEnd(15), '>36 (v_esc>6v_th)'.padEnd(19), 'reality');
for (const b of KNOWN) {
  const lam = jeansParameter(b.M, b.R, exosphericTemperature(b.T_eq), M_CO2_);
  const shipped = lam > 6 ? 'RETAINS' : 'airless';
  const fixed = lam > 36 ? 'RETAINS' : 'airless';
  console.log(b.n.padEnd(9), lam.toFixed(1).padStart(11), ('  ' + shipped).padEnd(15), fixed.padEnd(19), b.real);
}
console.log('\n  Read the Mercury and Moon rows: the shipped threshold calls both of them atmosphere-bearing.');
console.log('  Read the Mars row: BOTH thresholds correctly retain CO2 — so the threshold alone cannot');
console.log('  produce a thin atmosphere. Mars is thin because of outgassing budget and non-thermal loss,');
console.log('  neither of which this function models. That is a SEPARATE defect from the threshold.');
