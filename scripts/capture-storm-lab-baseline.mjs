// scripts/capture-storm-lab-baseline.mjs — captures the STORM SLICE AS THE LAB RAN IT before the
// stormDeck pack existed (workstream wire-storm-slice-lab-into-game, AC-2).
//
//   node scripts/capture-storm-lab-baseline.mjs <commit> > tests/fixtures/storm-lab-state-baseline.json
//
// It does NOT re-type the lab's law. It slices three live regions out of a PINNED git blob of
// world-engine-lab.html — `const _stormDeckZ = …`, the whole `function applyStormState(){ … }` and the
// per-frame slot compose (`let _stormN = 0;` … `uniforms.uStormCount.value = _stormN;`) — and runs
// them with `new Function` against the real modules, so the rows are the lab's own output.
import { execFileSync } from 'node:child_process';
import { DRIVER_PRESETS } from '../driver-presets.js';
import { deriveUniforms, visScaleOf } from '../src/worldengine/base/labCore.js';
import { deriveConditionVector } from '../src/worldengine/base/conditionVector.js';
import { compositionClass, giantRegimeOf } from '../src/worldengine/base/e1Regime.js';
import { E5_REGIME } from '../src/worldengine/base/climate-e5.js';
import { drawGiantConditions, deriveGiantDrivers, giantDriverScalars } from '../src/worldengine/base/giant-drivers.js';
import { resolveStormE, chromophoreColor, STORM_DECK } from '../src/worldengine/base/storm-e.js';
import { polarDeckPack, polarDeckLabState } from '../src/worldengine/drivers/polarDeck.js';
import { giantDeckPack, giantDeckLabState } from '../src/worldengine/drivers/giantDeck.js';

const commit = process.argv[2] || 'HEAD';
const sha = execFileSync('git', ['rev-parse', commit], { encoding: 'utf8' }).trim();
const lab = execFileSync('git', ['show', `${sha}:world-engine-lab.html`], { encoding: 'utf8', maxBuffer: 64e6 });
const slice = (startMarker, endMarker) => {
  const s = lab.indexOf(startMarker); if (s < 0) throw new Error('start marker missing: ' + startMarker);
  const e = lab.indexOf(endMarker, s); if (e < 0) throw new Error('end marker missing: ' + endMarker);
  return lab.slice(s, e + endMarker.length);
};
// ⚠ Markers are anchored to LINE STARTS: the file cites `function applyStormState(){` inside a comment at :175,
// and a bare indexOf lands there first.
const deckZText = slice('\n    const _stormDeckZ = (mode, age) =>', '(0.35 + 0.65 * (age ?? 0));');
const fnStart = lab.indexOf('\n    function applyStormState(){') + 1;
const fnEnd = lab.lastIndexOf('}', lab.indexOf('\n    function reseedGiant(){', fnStart));
const fnText = lab.slice(fnStart, fnEnd + 1);
const composeText = slice('\n      let _stormN = 0;', 'uniforms.uStormCount.value = _stormN;');
if (!fnText.includes('state._stormUranian = _storm.uranian;')) throw new Error('applyStormState slice is incomplete');

const makeApply = new Function(
  'DRIVER_PRESETS', 'driverUI', 'state', 'deriveUniforms', 'deriveConditionVector', 'compositionClass', 'giantRegimeOf',
  'E5_REGIME', 'deriveGiantDrivers', 'drawGiantConditions', 'giantDriverScalars', 'resolveStormE', 'chromophoreColor',
  'STORM_DECK', 'polarDeckPack', 'polarDeckLabState', 'visScaleOf',
  deckZText + '\n' + fnText + '\nreturn applyStormState;',
);
const compose = new Function('state', 'uniforms', 'STORM_DECK', deckZText + '\n' + composeText + '\nreturn _stormN;');

const STORM_FIELDS = ['spotStrength', 'spotCenter', 'spotRadius', 'spotRot', 'spotAspect', 'spotMode', 'spotColor', 'spotCompanion',
  'spotAge', 'spotEmboss', 'spotBillow', 'trainStrength', 'trainSpots', 'trainCount', '_stormUranian'];
const UNWRITTEN = '∅';
const MACRO_SEEDS = [1, 12345];
const STORM_SEEDS = [0, 1234];
const OBLIQUITIES = [0, 85];
const GATES = [[false, false], [true, false], [false, true], [true, true]];
const fakeUniforms = () => {
  const mk = () => ({ value: Array.from({ length: 8 }, () => ({ v: null, set(...a) { this.v = a; } })) });
  return { uStormPosSize: mk(), uStormParams: mk(), uStormColor: mk(), uStormAux: mk(), uStormCount: { value: 0 } };
};

const rows = [];
for (const preset of Object.keys(DRIVER_PRESETS)) {
  const fp = DRIVER_PRESETS[preset];
  const R = fp.radiusEarth ?? 1;
  const rotationHours = fp.rotationHours ?? 24;
  const cond = deriveConditionVector(fp, deriveUniforms(fp, 1.0), R);
  const gas = compositionClass(cond) === 'gas';
  for (const macroSeed of MACRO_SEEDS) for (const stormSeed of STORM_SEEDS) for (const obliquityDeg of (gas ? OBLIQUITIES : [0])) {
    // the lab's state.bandTint = pack #1's mirror on the same condition (the lab's own _dctx shape)
    const dctx = {
      displayRadiusEarth: visScaleOf(R), macroSeed, animRate: 1, gates: { bands: true, jets: true }, relevance: {},
      rotationHours, rotationScale: 1, obliquityDeg,
      e5DriverOverrides: { ...giantDriverScalars(R, rotationHours, 1), radius: (cond.radiusEarth ?? 1) / 11.2 },
    };
    const bandTint = giantDeckLabState(giantDeckPack(cond, dctx)).bandTint ?? [0.78, 0.62, 0.44];
    const state = {
      planetRadiusEarth: R, macroSeed, stormSeed, rotationHours, e5RotationScale: 1, e5Obliquity: obliquityDeg, bandTint,
      trainRadiusScale: 1.0,
    };
    for (const f of STORM_FIELDS) state[f] = UNWRITTEN;
    const apply = makeApply(DRIVER_PRESETS, { preset, qualityTier: 1.0 }, state, deriveUniforms, deriveConditionVector,
      compositionClass, giantRegimeOf, E5_REGIME, deriveGiantDrivers, drawGiantConditions, giantDriverScalars, resolveStormE,
      chromophoreColor, STORM_DECK, polarDeckPack, polarDeckLabState, visScaleOf);
    apply();
    const written = {};
    for (const f of STORM_FIELDS) if (state[f] !== UNWRITTEN) written[f] = state[f];
    const slots = {};
    for (const [g, t] of GATES) {
      // the frame loop reads the lab's state; unwritten spot fields never reach the writer because the
      // gate reads spotStrength first (UNWRITTEN is only possible on non-gas, where strength is 0)
      const st = { ...state };
      for (const f of STORM_FIELDS) if (st[f] === UNWRITTEN) st[f] = (f === 'trainSpots' ? [] : 0);
      st.greatSpotEnabled = g; st.stormTrainEnabled = t;
      const u = fakeUniforms();
      const n = compose(st, u, STORM_DECK);
      const take = (k) => u[k].value.slice(0, n).map((o) => o.v);
      slots[`${g ? 1 : 0}${t ? 1 : 0}`] = { count: n, posSize: take('uStormPosSize'), params: take('uStormParams'), color: take('uStormColor'), aux: take('uStormAux') };
    }
    rows.push({ preset, macroSeed, stormSeed, obliquityDeg, radiusEarth: R, rotationHours, gas, written, slots });
  }
}
process.stdout.write(JSON.stringify({
  capturedFrom: sha, file: 'world-engine-lab.html', method: 'sliced applyStormState + _stormDeckZ + frame compose from the pinned blob, run via new Function against the real modules',
  grid: { macroSeeds: MACRO_SEEDS, stormSeeds: STORM_SEEDS, obliquities: OBLIQUITIES, gates: GATES.map(([g, t]) => `${g ? 1 : 0}${t ? 1 : 0}`), presets: Object.keys(DRIVER_PRESETS) },
  stormFields: STORM_FIELDS, rows,
}));
