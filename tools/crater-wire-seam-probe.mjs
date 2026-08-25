#!/usr/bin/env node
// tools/crater-wire-seam-probe.mjs — the instrument for THE CRATER WIRE (rockySurface + craterDeck
// mirrors into planet-lod-lab.html's `ensureNetworkRouted`).
//
//   node tools/crater-wire-seam-probe.mjs
//
// ⭐ WHAT IT ANSWERS. The wiring commit claims to move ZERO PIXELS: every field the two mirrors
// hand back is asserted to be the value the lab already computes inline, from the same producer.
// That claim is what licenses neutralising ten inline lines in the same commit. It is MEASURED here
// rather than argued, because a supersede table is a list of assertions and this file is the only
// thing that can make them readings.
//
// ⛔ THE TWO POPULATIONS ARE EXACT COMPLEMENTS AND ARE MEASURED SEPARATELY. `rockySurface` claims
// `compositionClass !== 'gas'`, `craterDeck` claims `=== 'gas'`. A body compared against the pack
// that does not claim it is a number that is entirely true and entirely misleading.
//
// ⛔⛔ TWO LAYERS ARE REPORTED, NOT ONE, AND THE DIFFERENCE IS THE WHOLE POINT ON `craterDensity`.
// The mirror folds the relevance factor into the driver VALUE (`cu.density * rel`) where the lab's
// :2854 stores it RAW; the lab's per-frame writer then multiplies by `state.craterRelevance` on
// both routes (:5354). So STATE can differ while the UNIFORM cannot — provided `craterRelevanceOf`
// is binary. Both layers, and the range of that factor, are measured below. A single-layer answer
// here would either invent a defect or hide one.
//
// ⛔⛔ EVERY ARM HAS A POSITIVE CONTROL. This probe's honest answer is ZERO on the uniform layer,
// and a zero from a dead comparator prints identically to a zero from an agreeing pair. The control
// drives the SAME comparator off a perturbed condition and the run FAILS if it does not fire.
import { DRIVER_PRESETS, drawPresetConditions } from '../driver-presets.js';
import { deriveUniforms, visScaleOf } from '../src/worldengine/base/labCore.js';
import { deriveConditionVector } from '../src/worldengine/base/conditionVector.js';
import { compositionClass } from '../src/worldengine/base/e1Regime.js';
import { rockySurfacePack, rockySurfaceLabState } from '../src/worldengine/drivers/rockySurface.js';
import { craterDeckPack, craterDeckLabState } from '../src/worldengine/drivers/craterDeck.js';
import { craterUniformsFrom } from '../src/worldengine/port/craterUniforms.js';
import { craterRelevanceOf } from '../src/worldengine/base/bombardment.js';
import { surfacePaletteOf, icenessOf, biosphereOf, BIO_PIGMENT } from '../src/worldengine/base/surfaceMaterial.js';
import { applyAlbedoTransfer } from '../src/worldengine/display/albedoTransfer.js';

const SEEDS = [1, 7, 42, 1337, 90210, 424242, 8675309, 271828];
// ⛔ BOTH GATES ARE OPEN. The lab re-applies its own ✓ checkboxes at the per-frame writer
// (planet-lod-lab.html:5354 craters, :5361 ejecta), so a mirror resolving them too would apply one
// decision twice. This matches `LAB_MIRROR_CTX` inside both packs.
const GATES = { craters: true, ejecta: true };
const OFFSETS = { macroOffset: [1, 2, 3], detailOffset: [4, 5, 6], craterOffset: [7, 8, 9] };

const num = (v) => (Array.isArray(v) ? v : [v?.value ?? v]);
const differs = (a, b) => {
  if (a === undefined && b === undefined) return false;
  const A = num(a), B = num(b);
  return A.length !== B.length || A.some((x, i) => !(Math.abs(x - B[i]) <= 1e-12));
};
const tally = (o, k) => { o[k] = (o[k] || 0) + 1; };
const show = (o) => Object.entries(o).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}:${v}`).join('  ') || '(none)';

// ── THE LAB'S TEN SUPERSEDED LINES, transcribed from planet-lod-lab.html with their line numbers.
// `cond` is `_bodyDrivers.condition`, the PER-SEED draw (:2776 -> :2783). `u` is `state._derived`,
// i.e. `deriveUniforms` — the two applyDrivers lines read that, not the condition.
function labInline(cond, u, prevSizeKm) {
  const cu = craterUniformsFrom(cond);                                              // :2831
  const sp = applyAlbedoTransfer(surfacePaletteOf(cond), { extra: { pigment: BIO_PIGMENT } });  // :2820
  return {
    iceness: icenessOf(cond),                                                       // :2785
    biosphere: biosphereOf(cond),                                                   // :2788
    surfacePalette: sp,                                                             // :2820
    craterSizeKm: cu.Dchar > 0 ? cu.Dchar : prevSizeKm,                             // :2845
    craterDensity: cu.density,                                                      // :2854
    craterAmp: cu.amp,                                                              // :2866
    craterComplexD: cu.complexD,                                                    // :2871
    craterRelaxation: cu.relaxation,                                                // :2879
    terraceCount: u.terraceCount,                                                   // :2027 (applyDrivers)
    ejectaRampart: u.ejectaRampart,                                                 // :2041 (applyDrivers)
    craterOffset: OFFSETS.craterOffset,                                             // round-trip, see above
  };
}
// ⭐ `craterOffset` IS A ROUND-TRIP, NOT A LAW, and the first version of this probe reported it as a
// 104/104 divergence purely because the lab side had no entry for it. The lab OWNS the value
// (planet-lod-lab.html:5500 writes from `state.craterOffset`), hands it to the pack on `ctx`, and
// the mirror hands the identical array back. MEASURED verbatim: ctx `[7,8,9]` in, `[7,8,9]` out. So
// the lab side's expectation for it is the ctx itself, and comparing against `undefined` measured
// this probe rather than the wire.
// The five palette colours reach `state` as ONE object; compare them component-wise under the names
// the lab's frame writer destructures at :5455-5464 rather than as an opaque object.
const paletteRows = (sp) => (sp ? {
  'palette.weathered': sp.weathered, 'palette.fresh': sp.fresh, 'palette.sediment': sp.sediment,
  'palette.craton': sp.craton, 'palette.pigment': sp.pigment,
} : {});
function flatten(o) {
  const out = {};
  for (const [k, v] of Object.entries(o)) {
    if (k === 'surfacePalette') Object.assign(out, paletteRows(v));
    else out[k] = v;
  }
  return out;
}

// ── THE UNIFORM LAYER. The lab's per-frame writer re-applies the relevance factor to the two gated
// names (planet-lod-lab.html:5354 `uCraterDensity`, :5361 `uEjectaStrength`), so this is what the
// SHADER sees on either route. `craterAmp` rides bare (:5359) and is deliberately NOT multiplied.
const atUniform = (row, rel) => ({ ...row, craterDensity: (row.craterDensity ?? 0) * rel });

// ── Q5's ledger: for every STATE-layer disagreement, what the SHADER does with it.
const pixelRows = [];
const solid = [], gas = [];
const relValues = new Set();
let solidRows = 0, gasRows = 0;
const dState = {}, dUniform = {}, ctlState = {};          // rockySurface
const gState = {}, gUniform = {}, gCtl = {};              // craterDeck
const mirrorKeysSolid = new Set(), mirrorKeysGas = new Set();

for (const name of Object.keys(DRIVER_PRESETS)) {
  const fp = DRIVER_PRESETS[name];
  const R = fp.radiusEarth ?? 1;
  for (const seed of SEEDS) {
    const dp = drawPresetConditions(name, seed);
    const u = deriveUniforms(dp, 'high');
    const cond = deriveConditionVector(dp, u, R);
    const isGas = compositionClass(cond) === 'gas';
    const ctx = { displayRadiusEarth: visScaleOf(R), gates: GATES, ...OFFSETS };
    const rel = craterRelevanceOf(cond);
    relValues.add(rel);
    // The perturbed CONTROL condition: temperature, age and pressure all move, and every one of the
    // ten reads at least one of them. It drives the lab side only, so the comparator is the subject.
    const condX = JSON.parse(JSON.stringify(cond));
    condX.T_eq = (condX.T_eq ?? 200) * 3;
    condX.age = 0.05;
    condX.atmosphere = { ...(condX.atmosphere || {}), pressure: (condX.atmosphere?.pressure ?? 1) * 0.01 };
    const uX = deriveUniforms({ ...dp, age: 0.05 }, 'high');

    if (!isGas) {
      if (!solid.includes(name)) solid.push(name);
      solidRows++;
      const M = flatten(rockySurfaceLabState(rockySurfacePack(cond, ctx)));
      Object.keys(M).forEach((k) => mirrorKeysSolid.add(k));
      const L = flatten(labInline(cond, u, M.craterSizeKm));
      const Lx = flatten(labInline(condX, uX, M.craterSizeKm));
      for (const k of Object.keys(M)) {
        if (differs(M[k], L[k])) tally(dState, k);
        if (differs(M[k], Lx[k])) tally(ctlState, k);
      }
      const MU = atUniform(M, rel), LU = atUniform(L, rel);
      for (const k of Object.keys(M)) if (differs(MU[k], LU[k])) tally(dUniform, k);
      // Q5: a uniform-layer disagreement is only a PIXEL disagreement if the shader reaches it.
      for (const k of Object.keys(M)) {
        if (!differs(MU[k], LU[k])) continue;
        pixelRows.push({ preset: name, seed, field: k, mirror: MU[k], lab: LU[k],
                         uCraterDensity: (M.craterDensity ?? 0) * rel, uEjectaStrength: (u.ejectaStrength ?? 0) * rel });
      }
    } else {
      if (!gas.includes(name)) gas.push(name);
      gasRows++;
      const M = craterDeckLabState(craterDeckPack(cond, { displayRadiusEarth: visScaleOf(R), gates: GATES }));
      Object.keys(M).forEach((k) => mirrorKeysGas.add(k));
      const L = labInline(cond, u, M.craterSizeKm);
      // ⛔⛔ THE GAS CONTROL CANNOT BE A PERTURBED CONDITION, AND THE FIRST VERSION OF THIS PROBE
      // USED ONE AND REPORTED A VACUOUS ZERO. MEASURED MECHANISM, not inference:
      // src/worldengine/port/craterUniforms.js:129 `  if (!sch.fired) return CRATERS_OFF;` returns a FROZEN CONSTANT, and
      // every gas body takes it — so all six of craterDeck's names are the SAME constant across the
      // whole gas domain and NO condition can move either side. A control built on the law is
      // therefore structurally dead there. This one perturbs the LAB ROW instead: it tests that the
      // comparator reports a difference it is handed, which is the only thing a liveness control on
      // a constant domain can honestly test.
      const Lx = { ...L };
      for (const k of Object.keys(Lx)) if (typeof Lx[k] === 'number') Lx[k] = Lx[k] + 1;
      for (const k of Object.keys(M)) {
        if (differs(M[k], L[k])) tally(gState, k);
        if (differs(M[k], Lx[k])) tally(gCtl, k);
      }
      const MU = atUniform(M, rel), LU = atUniform(L, rel);
      for (const k of Object.keys(M)) if (differs(MU[k], LU[k])) tally(gUniform, k);
    }
  }
}

const rels = [...relValues].sort((a, b) => a - b);
console.log(`\nSOLID PRESETS (${solid.length}): ${solid.join(', ')}`);
console.log(`GAS  PRESETS (${gas.length}): ${gas.join(', ')}`);
console.log(`${solidRows} solid body-seeds x ${mirrorKeysSolid.size} mirrored names, ${gasRows} gas x ${mirrorKeysGas.size}\n`);

console.log('R0 — THE RELEVANCE FACTOR\'S OBSERVED RANGE (the mirror is safe ONLY if this is binary)');
console.log('   distinct craterRelevanceOf values :', rels.join(', '));
const binary = rels.every((r) => r === 0 || r === 1);
console.log(`   binary? ${binary ? 'YES' : '⛔ NO — the mirror SQUARES the factor; stop.'}\n`);

console.log('Q1 — rockySurface MIRROR vs THE LAB\'S INLINE LINES, at the STATE layer');
console.log('   disagreeing :', show(dState));
console.log('   CONTROL (same comparator, lab side on a perturbed condition) :', show(ctlState));
console.log('\nQ2 — SAME, at the UNIFORM layer (relevance re-applied as the frame writer does)');
console.log('   disagreeing :', show(dUniform));

console.log('\nQ3 — craterDeck MIRROR vs THE LAB\'S INLINE LINES (gas half), STATE layer');
console.log('   disagreeing :', show(gState));
console.log('   CONTROL :', show(gCtl));
console.log('\nQ4 — SAME, at the UNIFORM layer');
console.log('   disagreeing :', show(gUniform));

// ⛔ NO SILENT CAPS. The control moves most names but not all, and a name it cannot move has a
// zero above that is structurally true rather than demonstrated. They are named rather than left
// inside the green.
const unmoved = [...mirrorKeysSolid].filter((k) => !(k in ctlState) && !(k in dState));
console.log('\nQ5 — DOES THE SHADER REACH THE ONE DISAGREEMENT?');
if (!pixelRows.length) console.log('   no uniform-layer disagreement to reach.');
else {
  const reached = pixelRows.filter((r) => !(r.uCraterDensity <= 0));
  console.log(`   ${pixelRows.length} uniform-layer disagreements, all on: ${[...new Set(pixelRows.map((r) => r.field))].join(', ')}`);
  console.log(`   ⭐ MECHANISM: src/worldengine/shaders/craterRelief.glsl.js:164 \`  if (uCraterDensity <= 0.0) return;\` early-outs the WHOLE pass`);
  console.log(`      BEFORE the apron block that reads uEjectaRampart (:196).`);
  console.log(`   rows where uCraterDensity > 0 and the disagreement therefore RENDERS : ${reached.length}`);
  console.log(`   ⚠ AND THE OBVIOUS GUARD IS THE WRONG ONE: uEjectaStrength is NOT zero on these rows`);
  console.log(`      (observed ${[...new Set(pixelRows.map((r) => +r.uEjectaStrength.toFixed(3)))].join(', ')}), so :188's \`if (uEjectaStrength <= 0.0) return;\``);
  console.log(`      is never what saves them. A supersede note citing that guard would be right by luck.`);
}
console.log('\nCOVERAGE — mirrored names the control could NOT move, so their zeros above are');
console.log('   structurally true rather than demonstrated :', unmoved.join(', ') || '(none)');

const ctlLive = Object.keys(ctlState).length > 0 && Object.keys(gCtl).length > 0;
console.log(`\nCONTROL VERDICT: ${ctlLive ? 'LIVE — both comparators moved off a perturbed condition, so the zeros above are readings.'
  : '⛔ VACUOUS — a comparator did not move. Every zero above is silence, not evidence.'}`);
if (!ctlLive || !binary) process.exit(2);
