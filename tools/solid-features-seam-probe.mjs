#!/usr/bin/env node
// tools/solid-features-seam-probe.mjs — AC5's measurement, reproducible by command.
//
// THE QUESTION: if world-engine-lab.html imports `solidFeaturesPack` back instead of deriving its
// fourteen F7/F9/F17/F22/F23 masters inline, do the numbers change?
//
// ⛔ THE ANSWER DEPENDS ENTIRELY ON WHICH CONDITION VECTOR THE PACK IS HANDED, and that is the
// finding — no prior document in this workstream names it:
//   · ROUTE B feeds the pack a condition built from `_dp` = drawPresetConditions(preset, macroSeed),
//     the PER-SEED draw the lab's own comment (world-engine-lab.html:1941) says is the whole point of
//     `_dp`: "a macro seed produces a genuinely different WORLD".
//   · ROUTE C feeds it `_gcond`, built from the FROZEN preset `_fp` — which is what the giantDeck
//     call site at world-engine-lab.html:1726 uses, so it is the obvious thing to copy AND IT IS WRONG
//     HERE. It is measured deliberately as the known-bad arm, because an instrument that has not
//     been shown to fail on a known case is not evidence (this workstream broke four instruments
//     before the things they measured; see AC2-refutation.md).
//
// RUN: node tools/solid-features-seam-probe.mjs
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const { DRIVER_PRESETS, drawPresetConditions } = await import(join(ROOT, 'driver-presets.js'));
const { deriveUniforms } = await import(join(ROOT, 'src/worldengine/base/labCore.js'));
const { deriveConditionVector } = await import(join(ROOT, 'src/worldengine/base/conditionVector.js'));
const { solidFeaturesPack, SOLID_FEATURES_UNIFORMS } = await import(join(ROOT, 'src/worldengine/drivers/solidFeatures.js'));
const { compositionClass } = await import(join(ROOT, 'src/worldengine/base/e1Regime.js'));

/** uniform name -> the lab `state` field the per-frame writer reads. All fourteen mirror; none is direct. */
const U2S = {
  uVolcanismStrength: 'volcanismStrength', uEdificeMaxHeight: 'edificeMaxHeight', uShieldStratoMix: 'shieldStratoMix',
  uCryoActivity: 'cryoActivity', uChaosRaftJitter: 'chaosRaftJitter',
  uFrostMaxCoverage: 'frostMaxCoverage', uFrostCondensationT: 'frostCondensationT',
  uFrostLatitudeBias: 'frostLatitudeBias', uFrostAlbedo: 'frostAlbedo',
  uPlanetTempEq: 'tempEq', uFrostLocked: 'frostLocked',
  uPldStrength: 'pldStrength', uGlacialStrength: 'glacialStrength', uGlacialFlowVigor: 'glacialFlowVigor',
};
// ⚠ ALL GATES OPEN ON PURPOSE. The lab gates these at its per-frame writer with its own ✓ checkboxes,
// so the mirror must carry the UNGATED value into `state` or the decision is applied twice — the
// double-gating hazard giantDeck's call site names at world-engine-lab.html:1749.
const CTX = { displayRadiusEarth: 1, gates: { edifices: true, chaos: true, frost: true, glacial: true } };
const SEEDS = [1, 2, 3, 7, 42, 1234];

const val = (d) => (d && typeof d === 'object' && 'value' in d) ? d.value : d;
const same = (a, b) => Array.isArray(a)
  ? (Array.isArray(b) && a.length === b.length && a.every((x, i) => Object.is(x, b[i])))
  : Object.is(a, b);

const B = new Map(), C = new Map();
let solid = 0, rows = 0;
for (const preset of Object.keys(DRIVER_PRESETS)) {
  for (const seed of SEEDS) {
    const dp = drawPresetConditions(preset, seed);
    const fp = DRIVER_PRESETS[preset];
    const u = deriveUniforms(dp, 1.0);
    const condB = deriveConditionVector(dp, u, 1.0);
    const condC = deriveConditionVector(fp, deriveUniforms(fp, 1.0), 1.0);
    if (compositionClass(condB) === 'gas') continue;      // this pack does not claim gas bodies
    solid++;
    const packB = solidFeaturesPack(condB, CTX).drivers;
    const packC = solidFeaturesPack(condC, CTX).drivers;
    for (const uName of SOLID_FEATURES_UNIFORMS) {
      rows++;
      const lab = u[U2S[uName]];
      if (!same(val(packB[uName]), lab)) B.set(uName, (B.get(uName) || 0) + 1);
      if (!same(val(packC[uName]), lab)) C.set(uName, (C.get(uName) || 0) + 1);
    }
  }
}
const sum = (m) => [...m.values()].reduce((a, b) => a + b, 0);
const show = (m) => [...m.entries()].sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}:${v}`).join('  ') || '(none)';
console.log(`solid body-seeds: ${solid}  ·  comparisons: ${rows}  ·  uniforms: ${SOLID_FEATURES_UNIFORMS.length}`);
console.log(`ROUTE B  per-seed _dp   — disagreeing ${sum(B)}\n  ${show(B)}`);
console.log(`ROUTE C  frozen   _fp   — disagreeing ${sum(C)}   ⛔ the known-bad arm\n  ${show(C)}`);
console.log(
  sum(C) > sum(B)
    ? `\nOK — the instrument separates the arms (C ${sum(C)} > B ${sum(B)}), so a zero on B would mean something.`
    : `\n⛔ THE INSTRUMENT IS NOT DISCRIMINATING. It cannot tell the known-bad seam from the candidate; fix it before believing any number above.`,
);
