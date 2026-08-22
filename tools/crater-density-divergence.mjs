// tools/crater-density-divergence.mjs — measures the lab-vs-game uCraterDensity divergence.
//
// ⭐ WHY IT EXISTS: the split was recorded in-tree at craterUniforms.js:10-18 as deliberate
// ("Same law, same closed forms, different floor") and was ALMOST ACCEPTED ON THAT SENTENCE ALONE.
// Max asked the right question — "if there's a problem with how planets are rendering we need to
// address it" — and the answer needed a number, not a comment. 88.0% of 466 non-gas bodies
// disagree; the lab shows a MEDIAN 0.47x the game's crater density.
//
// ⛔ THE LAB SIDE IS TRANSCRIBED (planet-lod-lab.html:2853-2854), which is a third copy of a law
// and is acceptable ONLY because this file measures rather than renders. Verified chain:
// lab:2854 writes state.craterDensity -> lab:5354 writes uCraterDensity, and BOTH front-ends
// multiply by craterRelevance, so the comparison below is apples-to-apples on the pre-relevance term.
// ⛔⛔ AS OF 2026-08-22 THIS TOOL MEASURES HISTORY, NOT CURRENT STATE. The lab was converted to call
// `craterUniformsFrom`, so the transcribed expression below is the law the lab USED TO run. Kept as the
// record of what the divergence WAS (88.0%, median 0.47x) — the number that justified the conversion.
// ⚠ Do NOT read a fresh run as 'the divergence is still there': it is measuring the retired expression.
// ⚠ 60 systems, not the canonical 200 — directional, and the sample size is stated rather than implied.
import { StarSystemGenerator } from '../src/generation/StarSystemGenerator.js';
import { conditionFromBody } from '../src/worldengine/port/conditionFromBody.js';
import { craterUniformsFrom, RENDERED_CELL_COVERAGE, CELL_CRATER_AREA } from '../src/worldengine/port/craterUniforms.js';
import { craterSchedule } from '../src/worldengine/base/bombardment.js';
import { compositionClass } from '../src/worldengine/base/e1Regime.js';

const clamp01 = (x) => Math.max(0, Math.min(1, x));
const LAB_CELL = Math.PI * (0.18*0.18 + 0.18*0.37 + 0.37*0.37/3);   // planet-lod-lab.html:2853, transcribed for MEASUREMENT only

let n = 0, both0 = 0, disagree = 0, labZeroPackNot = 0, packZeroLabNot = 0;
const ratios = [];
for (let i = 0; i < 60; i++) {
  let sys; try { sys = StarSystemGenerator.generate(`lab-procedural-${i}`, null); } catch { continue; }
  const bodies = [...(sys?.planets || [])];
  for (const p of bodies) {
    for (const m of (p.moons || [])) bodies.push(m);
  }
  for (const b of bodies) {
    let cond; try { cond = conditionFromBody(b); } catch { continue; }
    if (!cond || compositionClass(cond) === 'gas') continue;
    let pack, sch;
    try { pack = craterUniformsFrom(cond); sch = craterSchedule(cond); } catch { continue; }
    const packD = pack?.density ?? 0;
    const labD  = clamp01((sch?.regolithRoughness ?? 0) / LAB_CELL);
    n++;
    if (packD === 0 && labD === 0) { both0++; continue; }
    if (labD === 0 && packD > 0) labZeroPackNot++;
    if (packD === 0 && labD > 0) packZeroLabNot++;
    if (Math.abs(packD - labD) > 1e-12) {
      disagree++;
      if (packD > 0 && labD > 0) ratios.push(labD / packD);
    }
  }
}
ratios.sort((a,b)=>a-b);
const q = (p) => ratios.length ? ratios[Math.min(ratios.length-1, Math.floor(p*ratios.length))] : NaN;
console.log(`non-gas bodies measured : ${n}`);
console.log(`both zero (agree)       : ${both0}`);
console.log(`DISAGREE                : ${disagree}  (${(100*disagree/Math.max(n,1)).toFixed(1)}%)`);
console.log(`  lab 0, pack > 0       : ${labZeroPackNot}   <- game stamps craters, lab shows none`);
console.log(`  pack 0, lab > 0       : ${packZeroLabNot}   <- lab shows craters, game stamps none`);
console.log(`ratio lab/pack  n=${ratios.length}  p05=${q(0.05)?.toExponential(2)}  median=${q(0.5)?.toExponential(2)}  p95=${q(0.95)?.toExponential(2)}`);
