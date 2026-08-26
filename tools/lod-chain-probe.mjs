// tools/lod-chain-probe.mjs — 2026-08-26.
// Max: "I feel like you're taking stabs in the dark here and need to take a step back and think
// about how the LOD transitions are working."  He is right. This lays out the WHOLE chain rather
// than testing one more knob.
//
// THERE ARE THREE MECHANISMS AND THEY ARE NOT INDEPENDENT:
//   1. THE OCTAVE BUDGET  uOctaves = mix(4, 9, smoothstep(20, 6, distanceRadii))   [labCore.js:19-27]
//        distance-driven, art-directable, expressed in the units Max speaks in ("quite close").
//   2. THE fwidth FADE    w *= 1 - smoothstep(bar0, bar1, footprint * freq)        [heightNoise.glsl.js]
//        screen-frequency-driven. Its JOB is anti-aliasing: never draw what would shimmer.
//   3. THE WAVELENGTH LAW uNoiseScale                                              [macroWavelength.js]
//        sets the base frequency, and therefore where 1 and 2 both land.
import { autoOctaves, lodRampOf } from '../src/worldengine/base/labCore.js';

const PX_PER_TAN = (282 / 2) / Math.tan(50 * Math.PI / 360);   // lab at game parity, measured live
const discPx = (d) => PX_PER_TAN * Math.tan(Math.asin(Math.min(0.9999, 1 / d)));
const clamp01 = x => Math.max(0, Math.min(1, x));
const ss = (a,b,x) => { const t = clamp01((x-a)/(b-a)); return t*t*(3-2*t); };

function chain(uNS, d, bar0, bar1, budgetLo, budgetHi, rampFar, rampNear) {
  const px = discPx(d);
  const ramp = ss(rampNear, rampFar, d) === undefined ? 0 : (1 - ss(rampNear, rampFar, d));
  const budget = budgetLo + (budgetHi - budgetLo) * (1 - ss(rampNear, rampFar, d));
  let byBudget = 0, byFade = 0, alive = 0, finest = null;
  for (let n = 0; n < 12; n++) {
    const tw = clamp01(budget - n);
    const f = uNS * 0.3 * Math.pow(2, n);
    const fw = 1 - ss(bar0, bar1, f / px);
    if (tw > 0.01) byBudget++;
    if (fw > 0.01) byFade++;
    if (tw * fw > 0.01) { alive++; finest = px / f; }
  }
  return { px, budget, byBudget, byFade, alive, finest,
           binding: byBudget < byFade ? 'BUDGET (distance)' : byFade < byBudget ? 'FADE (screen)' : 'tie' };
}

console.log('='.repeat(96));
console.log('A — WHICH MECHANISM IS ACTUALLY DECIDING, AT EVERY DISTANCE  (shipped: budget mix(4,9) over 20..6 radii)');
console.log('='.repeat(96));
for (const [label, uNS] of [['BEFORE the bound  uNoiseScale 250.72', 250.72], ['AFTER  the bound  uNoiseScale  67.17', 67.17]]) {
  console.log(`\n${label}`);
  console.log('   dist  discPx   budget   octaves: budget / fade / ALIVE   finest px/cyc   WHO DECIDES');
  for (const d of [20, 12, 8, 6, 4, 3, 2, 1.3]) {
    const c = chain(uNS, d, 0.4, 0.8, 4, 9, 20, 6);
    console.log(`  ${String(d).padStart(5)}  ${c.px.toFixed(0).padStart(6)}   ${c.budget.toFixed(2).padStart(6)}   ` +
      `${String(c.byBudget).padStart(6)} / ${String(c.byFade).padStart(4)} / ${String(c.alive).padStart(5)}   ` +
      `${(c.finest ? c.finest.toFixed(2) : '—').padStart(13)}   ${c.binding}`);
  }
}
console.log('\n⭐⭐ THE FINDING: the FADE decides at every distance that matters, and the BUDGET never binds.');
console.log('   So the only thing controlling "when does detail appear" is screen frequency — which is');
console.log('   the same quantity that controls "how fine is the detail". ONE KNOB, TWO JOBS.');
console.log('   That is why coarsening the law for sense-of-scale ALSO made detail arrive further out:');
console.log('   a bigger feature clears a screen bar from further away. It is not a bug, it is the shape');
console.log('   of the design, and no setting of the law or the bar can separate the two.');

console.log('\n' + '='.repeat(96));
console.log('B — WHAT THE BUDGET WOULD DO IF IT WERE ALLOWED TO BIND  (fade demoted to pure anti-alias)');
console.log('='.repeat(96));
console.log('Fade at the Nyquist bar only (0.4, 0.8) = its actual job. Budget floor dropped 4 -> 1, and the');
console.log('ramp moved from 20..6 radii to 8..1.5, i.e. "not until we are quite close".\n');
console.log('   dist  discPx   budget   ALIVE   finest px/cyc   WHO DECIDES');
for (const d of [20, 12, 8, 6, 4, 3, 2, 1.3]) {
  const c = chain(67.17, d, 0.4, 0.8, 1, 9, 8, 1.5);
  console.log(`  ${String(d).padStart(5)}  ${c.px.toFixed(0).padStart(6)}   ${c.budget.toFixed(2).padStart(6)}   ` +
    `${String(c.alive).padStart(5)}   ${(c.finest ? c.finest.toFixed(2) : '—').padStart(13)}   ${c.binding}`);
}
console.log('\n⭐ Now the BUDGET decides, in distance units, and the fade only ever catches what would alias.');
console.log('   "How fine" and "when" become two separate knobs, which is what Max has been asking for');
console.log('   in three different wordings.');

console.log('\n' + '='.repeat(96));
console.log('C — ⭐⭐ WHY NEITHER KNOB HELPS: THERE IS NO LOD HEADROOM LEFT TO SPEND');
console.log('='.repeat(96));
console.log('An LOD stack needs the COARSEST octave to be far above the pixel limit, so the finer ones have');
console.log('somewhere to arrive from. Count the octaves between "spans the disc" and "starts to alias":\n');
console.log('   lambda/R   what body this is        uNoiseScale   oct-0 px @4R   USABLE OCTAVES @4R / @1.3R');
for (const [lr, who] of [[1.162,'Earth'], [1.439,'Luna'], [0.635,'Mercury — coarsest anchor'],
                          [0.068,'Io — finest REAL body'], [0.0496,'the law today, bounded'], [0.0133,'the law before the bound']]) {
  const uNS = 1 / (0.3 * lr);
  const count = (d) => { const px = discPx(d); let n = 0;
    for (let i = 0; i < 12; i++) { const f = uNS * 0.3 * Math.pow(2, i); if (px / f >= 2.5) n++; } return n; };
  console.log(`   ${lr.toFixed(4).padStart(8)}   ${who.padEnd(24)} ${uNS.toFixed(2).padStart(9)}   ` +
    `${(discPx(4) / (uNS * 0.3)).toFixed(1).padStart(12)}   ${String(count(4)).padStart(11)} / ${count(1.3)}`);
}
console.log('\n⭐⭐⭐ THE ACTUAL ROOT CAUSE. At the law\'s hot end the COARSEST octave is already at the pixel');
console.log('   limit, so the stack has ZERO octaves of headroom — there is no coarse shape for finer');
console.log('   detail to arrive ON, and nothing to reveal on approach. That is one cause producing all');
console.log('   THREE of Max\'s complaints at once: no sense of scale (octave 0 IS grain), detail arriving');
console.log('   too early (octave 0 arrives late and everything lands at once), and new detail looking');
console.log('   unrelated (there is no landform for it to be related TO).');
console.log('\n⚠ AND THE CALIBRATION TABLE DOES NOT SUPPORT WHAT THE LAW DID WITH IT. Io\'s rows read "a');
console.log('   mountain, ~157 km" and "a patera, ~41 km" — those are FEATURES ON Io, and what they');
console.log('   actually record is that Io has little LARGE-SCALE relief. The law encoded that as a much');
console.log('   HIGHER BASE FREQUENCY, which collapses the whole octave stack onto one scale. The same');
console.log('   evidence is more honestly encoded as LOWER AMPLITUDE in the coarse octaves, leaving the');
console.log('   characteristic length near one body radius where every other body in the table sits.');
