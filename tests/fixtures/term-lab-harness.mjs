// tests/fixtures/term-lab-harness.mjs — the ONE slicer + runner shared by
// `scripts/capture-term-lab-baseline.mjs` (which runs it against the PARENT's pinned blob) and
// `tests/driver-pack-terminator.test.js` (which runs it against the working tree's lab).
//
// ⭐ WHY IT IS SHARED RATHER THAN WRITTEN TWICE — the reason `tests/fixtures/ray-pack-corpus.mjs`
// gives for the same shape: AC-0 compares the lab's terminator state across a commit boundary, and
// that comparison is only meaningful if both sides execute the identical harness. A second
// transcription of the slicing or of the run order would put a HARNESS difference inside a number
// the contract reads as a CODE difference.
//
// ⛔ IT SLICES, IT DOES NOT RE-TYPE. Every region comes out of the lab's own text by marker, and a
// marker that stops matching THROWS rather than quietly measuring something else.
//
// ⛔⛔ THE ONE THING IT IS ALLOWED TO FIND MISSING is the retyped width law, and it detects that by
// STRUCTURE rather than by text search. After the deletion the line's text survives inside the
// padding comment ("WAS: state.termWidth = …"), so `indexOf` would find the corpse and report the
// law live. The harness instead reads the line AFTER the still-live `_tp` line and asks whether it
// begins a statement or a comment. That distinction is the whole measurement.
import { deriveUniforms, visScaleOf } from '../../src/worldengine/base/labCore.js';
import { deriveConditionVector } from '../../src/worldengine/base/conditionVector.js';
import { compositionClass } from '../../src/worldengine/base/e1Regime.js';
import { atmosphereOpticsOf } from '../../src/worldengine/base/atmosphereOptics.js';
import { terminatorOpticsOf } from '../../src/worldengine/base/terminatorOptics.js';
import { selectPacks } from '../../src/worldengine/drivers/index.js';
import { solidOpticsPack, solidOpticsLabState } from '../../src/worldengine/drivers/solidOptics.js';
import { giantSurfacePack, giantSurfaceLabState } from '../../src/worldengine/drivers/giantSurface.js';
import { limbDeckPack } from '../../src/worldengine/drivers/limbDeck.js';
import { DRIVER_PRESETS, drawPresetConditions } from '../../driver-presets.js';

export const TERM_FIELDS = ['termStrength', 'termWidth', 'termColor'];
export const MACRO_SEEDS = [0, 12345];
const UNWRITTEN = '∅';

const TP_MARKER = 'const _tp = Math.max(_fp.atmosphere?.pressure ?? 0, 1e-3);';
const RETYPE_MARKER = 'state.termWidth = Math.min(0.30, Math.max(0.06, 0.12 + 0.09 * Math.log10(_tp)));';

/** Slice the nine regions out of one lab source. Throws on any marker that no longer matches. */
export function sliceLab(labSrc) {
  const lines = labSrc.split('\n');
  const labLine = (n, marker) => {
    const t = lines[n - 1];
    if (t === undefined || !t.includes(marker)) {
      throw new Error(`world-engine-lab.html:${n} no longer contains ${JSON.stringify(marker)} — re-anchor before trusting this run`);
    }
    return t;
  };
  const labFragment = (start, end) => {
    const s = labSrc.indexOf(start); if (s < 0) throw new Error('start marker missing: ' + start);
    const e = labSrc.indexOf(end, s); if (e < 0) throw new Error('end marker missing: ' + end);
    return labSrc.slice(s, e + end.length);
  };

  const tpIndex = lines.findIndex((t) => t.includes(TP_MARKER));
  if (tpIndex < 0) throw new Error('the `_tp` line is missing — the width block has moved');
  const after = (lines[tpIndex + 1] || '').trimStart();
  // Live iff the NEXT line OPENS WITH the statement. After the deletion it opens with `/*` and the
  // same text sits inside it — which is exactly the reading a text search would get wrong.
  const retypeLive = after.startsWith('state.termWidth =');
  if (retypeLive && !after.includes(RETYPE_MARKER)) throw new Error('the width line is live but is not the retype this harness measures');
  if (!retypeLive && !after.startsWith('/*')) throw new Error('the line after `_tp` is neither the retype nor a padding comment');

  return {
    retypeLive,
    tpLine: lines[tpIndex],
    retypeLine: retypeLive ? lines[tpIndex + 1] : null,
    atmoCond: labLine(2464, 'const _atmoCond = deriveConditionVector('),
    atmoOptics: labLine(2465, 'const _atmoOptics = atmosphereOpticsOf(_atmoCond);'),
    optCtx: labLine(2477, 'const _so = _gasBody ? null : solidOpticsPack(_atmoCond, _optCtx);'),
    termStrength: labLine(2497, 'state.termStrength = terminatorOpticsOf(_atmoCond).termStrength;'),
    termColor: labLine(2511, 'state.termColor = _atmoOptics.termColor.slice();'),
    solidMirror: labFragment('if (_so) Object.assign(state, solidOpticsLabState(_so));', 'solidOpticsLabState(_so));'),
    gasMirror: labFragment('const _gs = (selectPacks(', 'if (_gs) Object.assign(state, giantSurfaceLabState(_gs));'),
  };
}

/**
 * The three state literals this workstream moves, read as SOURCE TOKENS rather than as values.
 *
 * ⛔ A BOOLEAN READ WOULD BE THE WRONG MEASUREMENT. At the parent these rows say `false`; at HEAD they
 * say `TERMINATOR_ENABLED` / `LIMB_BYPASS` / `TERM_BYPASS`. The interesting property is not "is it
 * false" — both commits are — it is "does the lab still restate the value or does it now READ the
 * one declared constant". Only the token can tell those apart, and a regex that tested for `false`
 * would report the wire as done at the parent and undone at HEAD, in that order.
 */
export function readStateLiteralTokens(labSrc) {
  const grab = (field) => {
    const m = labSrc.match(new RegExp(`^\\s*${field}:\\s*([A-Za-z_$][\\w$]*)\\s*,`, 'm'));
    if (!m) throw new Error(`the lab's ${field} state literal no longer matches`);
    return m[1];
  };
  return { terminatorEnabled: grab('terminatorEnabled'), limbBypass: grab('limbBypass'), termBypass: grab('termBypass') };
}

/** Compile the two runnable regions out of a slice. */
export function compileLab(sl) {
  // ⚠ `_fp` inside applyDrivers is the FROZEN preset (world-engine-lab.html:2127), NOT the drawn one,
  // so the retype read a different pressure from the one `_atmoCond` carries. That asymmetry is
  // exactly what a value-equality proof has to survive, so it is preserved rather than tidied away.
  const applySrc = [sl.atmoCond, sl.atmoOptics, sl.optCtx, sl.termStrength, sl.tpLine,
    ...(sl.retypeLive ? [sl.retypeLine] : []), sl.termColor, sl.solidMirror].join('\n');
  return {
    applyDrivers: new Function(
      'state', 'driverUI', '_fp', 'u', 'deriveConditionVector', 'drawPresetConditions', 'atmosphereOpticsOf',
      'terminatorOpticsOf', 'visScaleOf', 'selectPacks', 'limbDeckPack', 'solidOpticsPack', 'solidOpticsLabState',
      `${applySrc}\nreturn { gasBody: _gasBody, soApplied: !!_so };`,
    ),
    ensureNetworkRouted: new Function(
      'state', '_bodyDrivers', 'visScaleOf', 'selectPacks', 'giantSurfacePack', 'giantSurfaceLabState',
      `${sl.gasMirror}\nreturn { gsApplied: !!_gs };`,
    ),
    // The deleted line, run ALONE — so the value-equality that admits its deletion is a number in
    // the fixture rather than an argument in a comment. Null once the line is gone.
    retypedWidthOnly: sl.retypeLive
      ? new Function('state', '_fp', `${sl.tpLine}\n${sl.retypeLine}\nreturn state.termWidth;`)
      : null,
  };
}

/** The lab's state at the moment applyDrivers / ensureNetworkRouted start. */
function freshState(R, macroSeed, literals) {
  const st = {
    planetRadiusEarth: R, macroSeed,
    macroOffset: [11, 22, 33], detailOffset: [44, 55, 66], craterOffset: [77, 88, 99],
    ...literals,
  };
  for (const f of TERM_FIELDS) st[f] = UNWRITTEN;
  return st;
}
const readTerm = (st) => {
  const out = {};
  for (const f of TERM_FIELDS) out[f] = st[f] === UNWRITTEN ? null : (Array.isArray(st[f]) ? st[f].slice() : st[f]);
  out.terminatorEnabled = st.terminatorEnabled;
  return out;
};

/**
 * Run every preset × macro seed; GAS presets in BOTH call orders.
 *
 * @param {object} sl              a `sliceLab` result
 * @param {object} [opts]
 * @param {object} [opts.literals] the lab's state literals under test (`terminatorEnabled` etc.)
 * @param {function} [opts.perturb] `(fp) => fp` applied to the FROZEN preset before the derive — the
 *        seam AC-0's pressure control uses. Identity by default.
 * @param {function} [opts.dressing] `(preset) => boolean` — whether the boot dressing turns the band on
 */
export function runLabRows(sl, { literals = { terminatorEnabled: false, limbBypass: false, termBypass: false }, perturb = (fp) => fp, dressing = () => false } = {}) {
  const { applyDrivers, ensureNetworkRouted, retypedWidthOnly } = compileLab(sl);
  const rows = [];
  for (const preset of Object.keys(DRIVER_PRESETS)) {
    const fp = perturb(DRIVER_PRESETS[preset]);
    const R = fp.radiusEarth ?? 1;
    const driverUI = { preset, qualityTier: 1.0 };
    for (const macroSeed of MACRO_SEEDS) {
      const dp = perturb(drawPresetConditions(preset, macroSeed));
      const u = deriveUniforms(dp, driverUI.qualityTier);
      const cond = deriveConditionVector(dp, u, R);
      const gas = compositionClass(cond) === 'gas';
      const bodyDrivers = { condition: cond };
      // ⛔ THE DRAW IS WRAPPED, NOT PRE-COMPUTED. The sliced :2464 calls `drawPresetConditions` ITSELF
      // to build `_atmoCond`, so a perturbation applied only to the harness's own copy would never
      // reach the law — measured: scaling the frozen preset's pressure 4x moved `drawnPressure` and
      // left `termWidth` untouched on 18/18 presets, i.e. it would have been a control that could
      // not fail. Wrapping the injected function is what puts the break INSIDE the lab's own derive.
      const drawWrapped = (preset, seed) => perturb(drawPresetConditions(preset, seed));
      const run = (st) => applyDrivers(st, driverUI, fp, u, deriveConditionVector, drawWrapped,
        atmosphereOpticsOf, terminatorOpticsOf, visScaleOf, selectPacks, limbDeckPack, solidOpticsPack, solidOpticsLabState);
      const routeGas = (st) => ensureNetworkRouted(st, bodyDrivers, visScaleOf, selectPacks, giantSurfacePack, giantSurfaceLabState);

      // ORDER A — the lab's REAL gas order: ensureNetworkRouted's mirror first, applyDrivers after it.
      const stA = freshState(R, macroSeed, literals);
      const gsA = gas ? routeGas(stA) : { gsApplied: false };
      const flagsA = run(stA);
      // ORDER B — the inverted one: applyDrivers first, the gas mirror last.
      const stB = freshState(R, macroSeed, literals);
      const flagsB = run(stB);
      const gsB = gas ? routeGas(stB) : { gsApplied: false };

      rows.push({
        preset, macroSeed, radiusEarth: R, gas,
        presetPressure: fp.atmosphere?.pressure ?? null,
        drawnPressure: cond.atmosphere?.pressure ?? null,
        gasBody: flagsA.gasBody, soApplied: flagsA.soApplied, gsApplied: gsA.gsApplied || gsB.gsApplied,
        orderA: readTerm(stA),
        orderB: readTerm(stB),
        retypedWidth: retypedWidthOnly ? retypedWidthOnly(freshState(R, macroSeed, literals), fp) : null,
        dressingIncludesTerminator: dressing(preset),
        rendersTerminator: null,   // filled by the caller, which owns ASSOCIATIONS
      });
      void flagsB;
    }
  }
  return rows;
}
