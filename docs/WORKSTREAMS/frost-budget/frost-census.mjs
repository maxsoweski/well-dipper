// frost-census.mjs — the BEFORE/AFTER instrument for the snow budget (workstream frost-budget).
//
// It reads the ENGINE's own law through `deriveUniforms`, so it cannot drift from the code it
// audits, and it transcribes the SHADER's snowline test — the budget alone says nothing about what
// is drawn, because the temperature decision happens in `frostCoverage()`.
//
// ⭐ IT REPORTS TWO NUMBERS, NOT ONE, AND THAT DISTINCTION IS THE WHOLE DESIGN. `frostCover` is an
// OPACITY: planetShaders.glsl.js:610 `albedoCol = mix(albedoCol, frostShade, frostCover);`. So
//   EXTENT   = the fraction of the sphere inside the snowline  (set by TEMPERATURE + latitude)
//   WHITENESS= how white the cap is inside it, = frostMaxCoverage  (set by VOLATILES + permanence)
// Multiplying them into one "painted %" — which the first draft of this file did — hides which of
// the two is wrong. A pale wash over 60% of a world and a white cap over 10% score the same.
//
//   node docs/WORKSTREAMS/frost-budget/frost-census.mjs
//   NSEEDS=500 node docs/WORKSTREAMS/frost-budget/frost-census.mjs
import { StarSystemGenerator } from '../../../src/generation/StarSystemGenerator.js';
import { conditionFromBody } from '../../../src/worldengine/port/conditionFromBody.js';
import { compositionClass } from '../../../src/worldengine/base/e1Regime.js';
import { deriveUniforms } from '../../../src/worldengine/base/labCore.js';
import { DRIVER_PRESETS } from '../../../driver-presets.js';

// The shipped snowline, transcribed from height.glsl.js frostCoverage():
//   coldFactor = mix(sin^2 lat, 1, latBias*0.6)
//   localT     = T * (1 - chill * (coldFactor - 1/3))   [- altitude lapse, 0 at sea level]
//   frost where localT < condensationT.
// Inverted for the sea-level snowline, returned as the sphere-area fraction of the two caps.
const MEAN_COLDFACTOR = 1 / 3;   // area-average of sin^2(lat) over a sphere — EXACT, not a fit
function extentOf(T, condT, chill, latBias, meanC = MEAN_COLDFACTOR) {
  if (!(condT > 0) || !(T > 0) || !(chill > 0)) return 0;
  const cf = meanC + (1 - condT / T) / chill;
  const b = latBias * 0.6;
  if (cf <= b) return 1;            // even the equator is below freezing → frozen through
  if (cf >= 1) return 0;            // even the pole is above freezing → bare
  const s2 = (cf - b) / (1 - b);
  if (s2 <= 0) return 1;
  if (s2 >= 1) return 0;
  return 1 - Math.sqrt(s2);
}
const snowlineDeg = (e) => e <= 0 ? NaN : e >= 1 ? 0 : Math.asin(1 - e) * 180 / Math.PI;

// ⛔ THE PRE-CHANGE LAW, PINNED AS LITERALS ON PURPOSE — this is the control column, and a control
// that imports the code under test moves with it. 0.35 was shaders/uniforms.js:268's flat lab knob;
// meanC 0 was the missing (coldFactor - 1/3), which pinned the EQUATOR at the world's mean.
const beforeExtent = (r) => extentOf(r.T, r.condT, 0.35, r.lat, 0);
// The before-whiteness is the budget without its temperature term: smoothstep(0.05,0.4,V).
const smooth = (e0, e1, x) => { const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };
const beforeWhite = (r) => r.condT > 0 ? smooth(0.05, 0.4, r.V) : 0;

function sample(u, src) {
  return { T: src.T, V: src.V, b0: u.frostMaxCoverage, condT: u.frostCondensationT,
           lat: u.frostLatitudeBias ?? 0, chill: u.frostLatChill, perm: u.frostPermanence, P: src.P };
}
const N = Number(process.env.NSEEDS || 200);
const rows = [];
for (let i = 0; i < N; i++) for (const e of StarSystemGenerator.generate(`rocky-${i}`, null).planets) {
  const d = e.planetData || e; const c = conditionFromBody(d);
  if (compositionClass(c) === 'gas') continue;
  rows.push(sample(deriveUniforms(c), { T: c.T_eq ?? 288, V: c.composition?.volatileFraction ?? 0, P: c.atmosphere?.pressure ?? 0 }));
}
const pc = (x) => (100 * x).toFixed(1) + '%';
console.log(`\nFROST CENSUS — ${rows.length} solid bodies over ${N} seeds\n`);
console.log('                    ------ BEFORE ------   ------ AFTER -------');
console.log('T band        n      extent   whiteness      extent   whiteness   snowline');
for (const [lo, hi, l] of [[0,150,'  <150 K'],[150,220,'150–220 K'],[220,273,'220–273 K'],[273,320,'273–320 K'],[320,5000,'  >320 K']]) {
  const b = rows.filter(r => r.T >= lo && r.T < hi); if (!b.length) continue;
  const m = (f) => b.reduce((s, r) => s + f(r), 0) / b.length;
  const e1 = m(r => extentOf(r.T, r.condT, r.chill, r.lat));
  console.log(l.padEnd(11) + String(b.length).padStart(4) + '    ' + pc(m(beforeExtent)).padStart(7) + '     ' + m(beforeWhite).toFixed(3)
    + '      ' + pc(e1).padStart(7) + '     ' + m(r => r.b0).toFixed(3)
    + '     ' + (isNaN(snowlineDeg(e1)) ? '  --' : snowlineDeg(e1).toFixed(0) + '°').padStart(5));
}

// ── The named bodies. ⛔ Lab presets go STRAIGHT to deriveUniforms, never through
// conditionFromBody: a preset's T_eq is ALREADY the engine's surface temperature, so the port's
// greenhouse would apply a second time (Earthlike 288 K reads 325 K through it).
console.log('\n                                ------ BEFORE ------   ------ AFTER -------');
console.log('body                        T     extent  whiteness      extent  whiteness  snowline');
const named = [];
for (const n of ['Rocky (Earthlike)', 'Ocean (temperate)', 'Frozen (airless)', 'Titan (methane seas)', 'Europa (icy moon)', 'Lava (hot airless)']) {
  const p = DRIVER_PRESETS[n];
  named.push({ n, ...sample(deriveUniforms(p), { T: p.T_eq, V: p.composition.volatileFraction, P: p.atmosphere?.pressure ?? 0 }) });
}
const anchor = rows.reduce((best, r) => Math.abs(r.T - 292.9) < Math.abs(best.T - 292.9) ? r : best, rows[0]);
named.push({ n: 'rocky-126 p2 (Max walked it)', ...anchor });
for (const r of named) {
  const e1 = extentOf(r.T, r.condT, r.chill, r.lat);
  console.log(('  ' + r.n).padEnd(30) + r.T.toFixed(0).padStart(4) + '   ' + pc(beforeExtent(r)).padStart(7) + '     ' + beforeWhite(r).toFixed(3)
    + '      ' + pc(e1).padStart(7) + '     ' + r.b0.toFixed(3) + '    ' + (isNaN(snowlineDeg(e1)) ? '  --' : snowlineDeg(e1).toFixed(0) + '°').padStart(5));
}
console.log('\n  Earth, for scale: permanent ice line ~66°, ~10% of the surface, and the caps are WHITE.');

// ── AC-5: the cold-world regression, stated by DISTANCE BELOW THE FREEZE POINT rather than by
// temperature band. ⭐ The class Max named is "the frozen worlds", and a body 1 K under its own
// freeze point is not one — it is a marginal world, and a real pole-to-equator gradient is SUPPOSED
// to bare its equator. Averaging the two together hides which moved.
console.log('\nAC-5 — bodies at or below their own freeze point, by how far below:');
let marginal = [];
for (const [lo, hi, l] of [[0,10,'within 10 K of the line'],[10,40,'10–40 K below'],[40,1e9,'more than 40 K below']]) {
  const g = rows.filter(r => r.condT > 0 && (r.condT - r.T) >= lo && (r.condT - r.T) < hi);
  if (!g.length) { console.log('  ' + l.padEnd(26) + ' n=0'); continue; }
  const moved = g.filter(r => Math.abs(extentOf(r.T, r.condT, r.chill, r.lat) * r.b0 - beforeExtent(r) * beforeWhite(r)) > 0.01);
  if (lo === 0) marginal = moved;
  console.log('  ' + l.padEnd(26) + ' n=' + String(g.length).padStart(4) + '    move by >1 point: ' + moved.length);
}
if (marginal.length) {
  console.log('  the movers, each named with its margin (all are within 10 K of freezing):');
  for (const r of marginal.slice(0, 12))
    console.log(`     T ${r.T.toFixed(0).padStart(4)} K, freezes at ${String(r.condT).padStart(3)} K (${(r.condT - r.T).toFixed(1)} K below)  P ${r.P.toFixed(2)}  extent ${pc(beforeExtent(r))} → ${pc(extentOf(r.T, r.condT, r.chill, r.lat))}`);
}

// ⭐ THE DISCRIMINATING CONTROL (trap 18): "nothing moved" passes under exactly the bug this is meant
// to catch — a term wired to nothing. So the temperate band MUST move, and move DOWN.
const temperate = rows.filter(r => r.T >= 273 && r.T < 320);
const dBefore = temperate.reduce((s, r) => s + beforeExtent(r) * beforeWhite(r), 0) / temperate.length;
const dAfter  = temperate.reduce((s, r) => s + extentOf(r.T, r.condT, r.chill, r.lat) * r.b0, 0) / temperate.length;
const live = dAfter < dBefore - 0.01;
console.log(`\n⭐ LIVENESS (the control must DISCRIMINATE): temperate band ${pc(dBefore)} → ${pc(dAfter)} — ${live ? 'MOVED DOWN, the instrument is live' : '⛔ DID NOT MOVE — DEAD INSTRUMENT, not a pass'}`);
process.exit(live ? 0 : 1);
