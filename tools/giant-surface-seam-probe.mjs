#!/usr/bin/env node
// tools/giant-surface-seam-probe.mjs — the AC5 instrument, one pack over (workstream AC2/AC5).
//
//   node tools/giant-surface-seam-probe.mjs
//
// ⭐ WHAT IT ANSWERS, in the order solidFeatures needed them answered:
//   Q1. WHICH CONDITION does planet-lod-lab.html hand `giantSurfacePack`? The lab holds TWO on any
//       body — the FROZEN-preset one (`buildBodyDrivers`:1674 and `rebakeE5Bands`:1726) and the
//       PER-SEED one (`applyDrivers`:2464 `_atmoCond`). For `solidFeatures` that choice decided
//       everything and the wrong arm failed silently, so it is MEASURED here rather than assumed.
//   Q2. WHICH of the thirteen uniforms MOVE if the lab adopts the pack.
//
// ⛔ THE POPULATION IS GAS ONLY — `GIANT_SURFACE_ENTRY.applies` is `compositionClass === 'gas'`.
// A solid preset is outside the pack's domain; comparing over bodies it never claims is a number
// that is entirely true and entirely misleading.
//
// ⛔⛔ EVERY ARM HAS A POSITIVE CONTROL, AND THAT IS NOT CEREMONY. This probe's honest answer is
// ZERO on both questions, and four instruments in this workstream were broken rather than the thing
// they measured. A zero from a dead comparator and a zero from an agreeing pair are the same
// character on a terminal. The controls below drive the SAME comparator to a non-zero and the run
// FAILS if they do not, so the zeros above them are readings rather than silence.
import { DRIVER_PRESETS, drawPresetConditions } from '../driver-presets.js';
import { deriveUniforms } from '../src/worldengine/base/labCore.js';
import { deriveConditionVector } from '../src/worldengine/base/conditionVector.js';
import { compositionClass } from '../src/worldengine/base/e1Regime.js';
import { giantSurfacePack } from '../src/worldengine/drivers/giantSurface.js';
import { terminatorOpticsOf } from '../src/worldengine/base/terminatorOptics.js';
import { atmosphereOpticsOf } from '../src/worldengine/base/atmosphereOptics.js';
import { surfacePaletteOf, icenessOf, biosphereOf, BIO_PIGMENT } from '../src/worldengine/base/surfaceMaterial.js';
import { applyAlbedoTransfer } from '../src/worldengine/display/albedoTransfer.js';

const SEEDS = [1, 7, 42, 1337, 90210, 424242];
// ⛔ THE TERMINATOR GATE IS OPEN. The lab re-applies its own ✓ checkbox at the per-frame writer
// (planet-lod-lab.html:5044), so a mirror resolving the gate too would apply the decision twice.
const CTX = {
  displayRadiusEarth: 1, gates: { terminator: true },
  macroOffset: [1, 2, 3], detailOffset: [4, 5, 6], craterOffset: [7, 8, 9],
};

const num = (v) => (Array.isArray(v) ? v : [v?.value ?? v]);
const differs = (a, b) => {
  const A = num(a), B = num(b);
  return A.length !== B.length || A.some((x, i) => Math.abs(x - B[i]) > 1e-12);
};
const tally = (o, k) => { o[k] = (o[k] || 0) + 1; };
const show = (o) => Object.entries(o).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}:${v}`).join('  ') || '(none)';

// ── THE LAB'S TEN, transcribed from its own lines with the condition each one actually reads ─────
// ⚠ THE LAB USES TWO DIFFERENT CONDITIONS FOR THESE TEN and that is a fact about the lab, not a
// simplification here: the terminator triple reads the PER-SEED `_atmoCond` (:2464), the palette,
// iceness and biosphere read `_bodyDrivers.condition`, which `buildBodyDrivers`:1674 builds from the
// FROZEN preset. Both are passed in so the comparison is against what the file DOES.
function labTen(fp, perSeedCond, frozenCond) {
  const sp = applyAlbedoTransfer(surfacePaletteOf(frozenCond), { extra: { pigment: BIO_PIGMENT } });  // :2820
  return {
    uTermStrength: terminatorOpticsOf(perSeedCond).termStrength,                                     // :2497
    uTermWidth: Math.min(0.30, Math.max(0.06, 0.12 + 0.09 * Math.log10(Math.max(fp.atmosphere?.pressure ?? 0, 1e-3)))),  // :2505
    uTermColor: atmosphereOpticsOf(perSeedCond).termColor.slice(),                                   // :2511
    uWeatheredColor: sp.weathered.slice(), uFreshColor: sp.fresh.slice(), uSedColor: sp.sediment.slice(),
    uCratonColor: sp.craton.slice(), uBioGroundColor: sp.pigment.slice(),
    uIcenessMix: icenessOf(frozenCond),                                                              // :2785
    uBioGroundCover: biosphereOf(frozenCond),                                                        // :2788
  };
}
// ⛔ A CONTROL THAT WAS TRIED AND REJECTED, RECORDED SO IT IS NOT TRIED AGAIN. The first version of
// this control used the lab's real PRE-2026-08-21 text at :2497 — `_fp.atmosphere?.retained ? 0.15 :
// 0.0` — expecting the binary to separate from the shared law. IT REPORTED ZERO, and the zero is
// correct: `columnFractionOf` saturates to 1.0 above 0.3 bar, so the shared law returns 1.0 * 0.15 =
// 0.15 on every gas body and every gas preset has a retained atmosphere. The two expressions are
// bit-identical ON THIS DOMAIN — which is exactly what AC2-refutation.md measured over 157/157 gas
// bodies, now reproduced here. ⚠ It is a vacuous control BECAUSE of the same fact that makes Q2's
// answer zero, so it can never have proved the comparator alive. It is reported below as a FINDING.
const labTenPreExtraction = (fp, p, f) => ({ ...labTen(fp, p, f), uTermStrength: fp.atmosphere?.retained ? 0.15 : 0.0 });

const gas = [], armC = {}, seedMove = {}, labDelta = {}, ctlArm = {}, ctlLab = {}, preExt = {};
let rows = 0, drawIsIdentity = 0;
for (const name of Object.keys(DRIVER_PRESETS)) {
  const fp = DRIVER_PRESETS[name];
  const R = fp.radiusEarth ?? 1;
  for (const seed of SEEDS) {
    const dp = drawPresetConditions(name, seed);
    const u = deriveUniforms(dp, 'high');
    const condB = deriveConditionVector(dp, u, R);   // route B — the PER-SEED draw
    const condC = deriveConditionVector(fp, u, R);   // route C — the FROZEN preset
    if (compositionClass(condB) !== 'gas') continue;
    if (!gas.includes(name)) gas.push(name);
    rows++;
    if (dp === fp || JSON.stringify(dp) === JSON.stringify(fp)) drawIsIdentity++;

    const B = giantSurfacePack(condB, CTX).drivers;
    const C = giantSurfacePack(condC, CTX).drivers;
    const L = labTen(fp, condB, condC);
    const Lpre = labTenPreExtraction(fp, condB, condC);
    // CONTROL ARM: a condition whose pressure and temperature are perturbed off route B. Both the
    // terminator ramp and the palette read those, so a live comparator MUST report movement.
    const condX = JSON.parse(JSON.stringify(condB));
    condX.atmosphere = { ...(condX.atmosphere || {}), pressure: (condX.atmosphere?.pressure ?? 1) * 0.01 };
    condX.T_eq = (condX.T_eq ?? 200) * 3;
    const X = giantSurfacePack(condX, CTX).drivers;
    const Lx = labTen(fp, condX, condX);

    for (const k of Object.keys(B)) {
      if (differs(B[k], C[k])) tally(armC, k);
      if (differs(B[k], X[k])) tally(ctlArm, k);
      if (k in L && differs(B[k], L[k])) tally(labDelta, k);
      if (k in Lpre && differs(B[k], Lpre[k])) tally(preExt, k);
      // CONTROL: the SAME pack-vs-lab loop, with the lab's ten driven off the perturbed condition.
      // It tests the COMPARATOR, not a law — which is what a liveness control has to do.
      if (k in Lx && differs(B[k], Lx[k])) tally(ctlLab, k);
    }
    if (seed !== SEEDS[0]) {
      const dp0 = drawPresetConditions(name, SEEDS[0]), u0 = deriveUniforms(dp0, 'high');
      const B0 = giantSurfacePack(deriveConditionVector(dp0, u0, R), CTX).drivers;
      for (const k of Object.keys(B)) if (differs(B[k], B0[k])) tally(seedMove, k);
    }
  }
}

console.log(`\nGAS PRESETS (${gas.length}): ${gas.join(', ')}`);
console.log(`${rows} body-seeds x 13 uniforms = ${rows * 13} comparisons\n`);

console.log('Q1 — DOES THE CONDITION ARM MATTER?  route C (frozen _fp) vs route B (per-seed _dp)');
console.log('   disagreeing :', show(armC));
console.log('   route B across seeds :', show(seedMove));
console.log('   ⭐ MECHANISM, not inference: drawPresetConditions returned the preset UNCHANGED on');
console.log(`      ${drawIsIdentity}/${rows} gas body-seeds — the giants are gated OUT of the per-seed draw inside it,`);
console.log('      so the lab\'s two conditions cannot differ on this pack\'s whole domain.');
console.log('   CONTROL (perturbed condition, same comparator) :', show(ctlArm));

console.log('\nQ2 — WHAT MOVES IF THE LAB ADOPTS THE PACK (the ten law-bearing names; the 3 offsets are forwarded verbatim)');
console.log('   disagreeing with the lab today :', show(labDelta));
console.log('   CONTROL (the lab\'s ten driven off the perturbed condition, same loop) :', show(ctlLab));
console.log('   FINDING — the lab\'s PRE-2026-08-21 binary `retained ? 0.15 : 0` termStrength differs on :', show(preExt));
console.log('      i.e. AC2-refutation.md\'s columnFraction-saturates argument, reproduced: on THIS domain the');
console.log('      binary and the shared law are bit-identical, so P-11\'s gas half was never a real conflict.');

const dead = [];
if (!Object.keys(ctlArm).length) dead.push('Q1 control reported nothing — the arm comparator is DEAD');
if (!Object.keys(ctlLab).length) dead.push('Q2 control reported nothing — the lab comparator is DEAD');
if (dead.length) { console.error('\n⛔ INSTRUMENT BROKEN:\n  ' + dead.join('\n  ')); process.exit(2); }

console.log(`\nVERDICT: ${Object.keys(armC).length === 0 && Object.keys(labDelta).length === 0
  ? 'ZERO on both, and both controls bit. Unlike solidFeatures this pack adopts with NO ruling and NO\n         pixel movement: the lab already calls the same shared functions, and the condition choice is\n         inert on its gas-only domain. ⚠ Do not carry AC5\'s condition warning here — it does not apply.'
  : 'SOMETHING MOVES — read the rows above before wiring.'}`);
