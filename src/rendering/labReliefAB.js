// src/rendering/labReliefAB.js
// ─────────────────────────────────────────────────────────────────────────────────────────────────
// THE SOLID-RELIEF A/B (key `[`) + the `_labRelief` dev instrument — workstream solid-relief-deck
// (AC-5/AC-6). The sibling of src/rendering/labRaysAB.js (key `Y`), src/rendering/labStormAB.js
// (key `I`) and src/rendering/labTermAB.js.
//
// ⭐ THE KEY IS `[` BECAUSE THERE IS NO LETTER LEFT. src/rendering/labRaysAB.js took `Y` on
// 2026-09-03 calling it "the ONLY unbound letter in the game's key map"; re-measured 2026-09-04 with
// `grep -rqE "'Key$L'" src` over A–Z, ZERO letters are free. Free today: Digit0, Digit2–9 and most
// punctuation. `BracketLeft` is the one a person can be TOLD over a chat message without ambiguity
// — "the square-bracket key, just right of P" — which is the only property that matters for a key
// whose whole job is to put Max in front of the change (feedback_showcase-by-parking-the-live-game).
//
// ⭐ IT TOGGLES THE ELEVEN MASTERS AND NOTHING ELSE, and that is the safety net stated as code.
// Every combiner these feed early-outs at master ≤ 0 (`if (uMountainAmp <= 0.0) return;` and its ten
// siblings in src/worldengine/shaders/height.glsl.js), so zeroing the eleven deletes the whole deck's
// contribution byte-identically — which is exactly the promise the contract's `mustStayWorking`
// makes: with the deck off the render is what it was before pack #11 existed. The twelve MORPHOLOGY
// names (the axes, the styles, the maturity, the repose) are deliberately NOT zeroed: they steer a
// pass that is already deleted, and zeroing them would leave a gated-off body carrying a different
// STATE than an un-wired one — the distinction `solidFeatures.js` draws when it gates the master and
// only the master.
//
// THE THREE ARMS, in the pair-shot vocabulary:
//   OFF       the eleven masters 0 on every live material — the pre-pack render.
//   ON        each material's pack-RESOLVED values restored, re-derived through `solidReliefPack`
//             rather than cached off the material, so a restored body carries the law's answer and
//             not a stale read.
//   SABOTAGE  a value the law FORBIDS on that body — `uMountainAmp` 1.0 on a body whose law returns
//             0 (an icy crust: `mountainAmp` carries `× rockyCrust`, labCore.js). A third state
//             neither ON nor OFF can produce there, which is what makes it a liveness probe rather
//             than a brightness knob. ⛔ NEVER PERSISTS: `restore()` re-derives through the pack and
//             `record()` reports `state: 'sabotage'`.
//
// ⛔ NO RENDERER OBJECT IS TOUCHED beyond `material.uniforms.*.value`. ⛔ The key ignores every
// modifier and every typing target.
// ─────────────────────────────────────────────────────────────────────────────────────────────────
import { solidReliefPack, SOLID_RELIEF_GATES } from '../worldengine/drivers/solidRelief.js';
import { resolveDriver } from '../worldengine/port/writePackUniforms.js';

/** The eleven MASTERS — the only names this A/B writes. Each one's combiner early-outs at ≤ 0. */
export const RELIEF_MASTERS = Object.freeze([
  'uMountainAmp', 'uChasmaDepth', 'uScarpStrength', 'uPlateauStrength', 'uTesseraStrength',
  'uLavaCoverage', 'uSubStrength', 'uKarstDensity', 'uDuneDensity', 'uDustDepth', 'uMassWastDensity',
]);

const LIVE = new Map();   // material -> { surface, condition, ctx, packValues, sabotaged, onDispose }
let _off = false;
let _installed = false;

const allOn = () => Object.fromEntries(SOLID_RELIEF_GATES.map((g) => [g, true]));

function isTypingTarget(t) {
  if (!t) return false; const tag = (t.tagName || '').toLowerCase();
  return tag === 'input' || tag === 'textarea' || tag === 'select' || t.isContentEditable === true;
}

/**
 * Re-derive what the PACK answers for this body. ⛔ Not a second transcription and not a cached
 * uniform read: this calls `solidReliefPack` itself, so a restore cannot drift from the mount.
 */
function packAnswer(condition, ctx) {
  const packCtx = { ...(ctx || {}), gates: allOn() };
  const { drivers, meta } = solidReliefPack(condition, packCtx);
  const packValues = {};
  for (const n of RELIEF_MASTERS) packValues[n] = resolveDriver(n, drivers[n], packCtx);
  return { packValues, meta };
}

/**
 * Register a swapped surface whose material carries the relief masters. Returns false on a legacy
 * material (Sol's bodies, which declare none of these).
 */
export function registerReliefAB(surface, { condition, ctx, packs } = {}) {
  if (!surface || !surface.material || !surface.material.uniforms) return false;
  const material = surface.material;
  if (!material.uniforms.uMountainAmp) return false;
  if (!condition) return false;
  let a;
  try { a = packAnswer(condition, ctx); } catch { return false; }   // a body the pack refuses is not an A/B subject
  // ⭐ THE REGISTRY FOLLOWS THE MATERIAL'S OWN LIFETIME — labRaysAB.js's 2026-09-03 lesson, where
  // moons disposed through Moon.js and never called unregister, so the census read 17 → 28 with 11
  // stale materials. A material dispatches 'dispose' on every body class, so listen to that.
  const onDispose = () => { LIVE.delete(material); material.removeEventListener('dispose', onDispose); };
  LIVE.set(material, {
    surface, condition, ctx, sabotaged: null, onDispose,
    packsApplied: (packs && packs.applied) ? [...packs.applied] : [],
    ...a,
  });
  material.addEventListener('dispose', onDispose);
  if (_off) for (const n of RELIEF_MASTERS) if (material.uniforms[n]) material.uniforms[n].value = 0;
  installOnce();
  return true;
}

export function unregisterReliefAB(surface) {
  if (!surface || !surface.material) return;
  const r = LIVE.get(surface.material);
  if (r && r.onDispose) surface.material.removeEventListener('dispose', r.onDispose);
  LIVE.delete(surface.material);
}

function writeArm(m, r) {
  let n = 0;
  for (const name of RELIEF_MASTERS) {
    const u = m.uniforms && m.uniforms[name];
    if (!u) continue;
    const sab = r.sabotaged && r.sabotaged.name === name ? r.sabotaged.value : null;
    u.value = _off ? 0 : (sab === null ? r.packValues[name] : sab);
    n++;
  }
  return n > 0;
}

/** OFF ⇔ the eleven masters 0 on every live material; ON restores each material's pack values. */
export function toggleReliefAB(force) {
  _off = (force === undefined) ? !_off : !!force;
  let n = 0;
  for (const [m, r] of LIVE) if (writeArm(m, r)) n++;
  return { off: _off, materials: n };
}
export function reliefOff() { return toggleReliefAB(true); }
export function reliefOn() { return toggleReliefAB(false); }

/**
 * The SABOTAGE arm: write a value the law forbids onto ONE surface. Default target `uMountainAmp` at
 * 1.0, which the law cannot produce on an icy-crust body (`× rockyCrust`) and cannot reach anywhere
 * (its ceiling is 0.6).
 */
export function sabotageRelief(surface, name = 'uMountainAmp', value = 1.0) {
  const r = LIVE.get(surface && surface.material);
  if (!r) return null;
  r.sabotaged = { name, value };
  writeArm(surface.material, r);
  return recordRelief(surface);
}

/** Undo the sabotage: re-derive through the pack and write its own answer back. */
export function restoreRelief(surface) {
  const r = LIVE.get(surface && surface.material);
  if (!r) return null;
  Object.assign(r, packAnswer(r.condition, r.ctx));
  r.sabotaged = null;
  writeArm(surface.material, r);
  return recordRelief(surface);
}

/**
 * What state this surface is in, and the numbers that have to agree for the wire to be live: the
 * PACK's resolved answer per master, and what the material actually holds.
 */
export function recordRelief(surface) {
  const m = surface && surface.material;
  const r = LIVE.get(m);
  if (!r) return null;
  const uniformValues = {}, packValues = {};
  for (const n of RELIEF_MASTERS) {
    uniformValues[n] = m.uniforms[n] ? m.uniforms[n].value : null;
    packValues[n] = r.packValues[n];
  }
  // The six seeded axes, reported because "distinct and variable" is the workstream's whole criterion
  // and a constant axis across bodies is the failure it exists to prevent.
  const axes = {};
  for (const n of ['uOrogenyAxis', 'uScarpAxis', 'uLavaAxis']) {
    const u = m.uniforms[n];
    axes[n] = u && u.value ? [u.value.x, u.value.y, u.value.z ?? null] : null;
  }
  for (const n of ['uChasmaAxis', 'uTesseraAxis']) {
    const u = m.uniforms[n];
    axes[n] = u && Array.isArray(u.value) ? u.value.map((v) => [v.x, v.y, v.z]) : null;
  }
  return {
    state: _off ? 'off' : (r.sabotaged === null ? 'on' : 'sabotage'),
    packValues, uniformValues, axes,
    nonZeroMasters: RELIEF_MASTERS.filter((n) => r.packValues[n] > 0),
    packsApplied: r.packsApplied,
    sabotaged: r.sabotaged,
    radiusEarth: r.condition.radiusEarth ?? null,
    compositionClass: r.meta ? r.meta.compositionClass : null,
    surfaceMeta: r.meta ? r.meta.surface : null,
  };
}

function installOnce() {
  if (_installed) return;
  _installed = true;
  if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') window.addEventListener('keydown', (e) => {
    if (e.shiftKey || e.ctrlKey || e.altKey || e.metaKey || e.repeat) return;
    if (isTypingTarget(e.target)) return;
    if (e.code === 'BracketLeft') {
      const r = toggleReliefAB();
      if (typeof console !== 'undefined') console.info(`[relief A/B] the eleven masters ${r.off ? 'OFF' : 'ON'} on ${r.materials} lab bodies`);
    }
  });
  globalThis._labRelief = {
    toggle: toggleReliefAB,
    off: reliefOff,
    on: reliefOn,
    get isOff() { return _off; },
    size() { return LIVE.size; },
    record: recordRelief,
    sabotage: sabotageRelief,
    restore: restoreRelief,
    masters: RELIEF_MASTERS,
    /** Every registered surface's record — the registry census a 0-px control is reported beside. */
    all() { return [...LIVE.values()].map((r) => recordRelief(r.surface)); },
  };
}
