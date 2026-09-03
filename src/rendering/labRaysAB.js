// src/rendering/labRaysAB.js
// ─────────────────────────────────────────────────────────────────────────────
// THE EJECTA-RAY A/B (key `Y`) + the `_labRays` dev instrument — workstream
// wire-ejecta-rays-lab-into-game (AC-4). The sibling of `src/rendering/labStormAB.js` (key `I`) and of
// the V / J / U keys in src/rendering/bake/labBakeHost.js, and it keeps its own registry for the same
// reason that one does: the bake host tracks SOLID bodies because it is the bake transport, and rays
// are three uniforms with no bake, no worker and no cube.
//
// ⭐ IT REGISTERS EVERY LAB MATERIAL THE GAME MOUNTS — planets, moons AND gas bodies — where the storm
// A/B registers only gas. That is not symmetry for its own sake: the crater driver block runs on both
// packs (`rockySurfacePack` for everything non-gas, `craterDeckPack` for gas), so `uRayBrightness`
// exists on every swapped material, and the AIR and GAS controls in AC-4 are only admissible if their
// `record(surface)` comes back NON-NULL. A body that moved 0 px because it was never registered is not
// a control, it is a blind spot — and this file is the difference between the two.
//
// THE THREE ARMS, in the pair-shot vocabulary (PLAN §12):
//   OFF       `uRayBrightness` 0 on every live material — the lab's own off state (its ✓ ejecta
//             checkbox writes exactly this, world-engine-lab.html:5365), and the shipped regression
//             contract: src/worldengine/shaders/height.glsl.js keys the whole ray term on
//             `if (uRayBrightness <= 0.0) return 0.0;`.
//   ON        the pack's RESOLVED value restored — re-derived from `craterDriverBlock`, never cached
//             off the material, so a restored body carries the law's answer and not a stale read.
//   SABOTAGE  1.0 written onto a body WITH AIR — a state the law FORBIDS (`atmosphere ? 0 : 1`), so it
//             is a third state that neither ON nor OFF can produce on that body. That is what makes it
//             a liveness probe rather than a brightness knob.
//             ⛔ NEVER PERSISTS: `restore(surface)` re-derives through the block, and `record(surface)`
//             reports `state: 'sabotage'` so a measurement cannot mistake a sabotaged body for a live one.
//
// ⛔ NO RENDERER OBJECT IS TOUCHED beyond `material.uniforms.*.value` — the same surface the pack writer
// uses. ⛔ The key ignores every modifier and typing targets.
// ─────────────────────────────────────────────────────────────────────────────
import { craterDriverBlock, CRATER_GATE, EJECTA_GATE } from '../worldengine/drivers/craterDeck.js';
import { resolveDriver } from '../worldengine/port/writePackUniforms.js';
import { rayBrightnessOf } from '../worldengine/base/ejectaRays.js';

const LIVE = new Map();   // material -> { surface, condition, ctx, packValue, density, rel, sabotaged }
let _off = false;
let _installed = false;

/** The value the sabotage arm writes. 1.0 is the law's CEILING, unreachable on any body with air. */
export const RAY_SABOTAGE_VALUE = 1.0;

const allOn = () => ({ [CRATER_GATE]: true, [EJECTA_GATE]: true });

function isTypingTarget(t) {
  if (!t) return false; const tag = (t.tagName || '').toLowerCase();
  return tag === 'input' || tag === 'textarea' || tag === 'select' || t.isContentEditable === true;
}

/**
 * Re-derive what the PACK answers for this body, through the shared block both packs spread.
 * ⛔ Not a second transcription and not a cached uniform read: `craterDriverBlock` IS the producer
 * `rockySurfacePack` and `craterDeckPack` emit, so a restore cannot drift from what the mount wrote.
 */
function packAnswer(condition, ctx) {
  const packCtx = { ...(ctx || {}), gates: allOn() };
  const { drivers, rel } = craterDriverBlock(condition);
  return {
    packValue: resolveDriver('uRayBrightness', drivers.uRayBrightness, packCtx),
    density: resolveDriver('uCraterDensity', drivers.uCraterDensity, packCtx),
    rel,
  };
}

/**
 * Register a swapped surface whose material carries the ray uniforms. Returns false (and registers
 * nothing) on a legacy material — Sol's moons go through Moon.js, which declares no `uRay*`.
 * @param {object} surface  the THREE.Mesh whose `material.uniforms` the packs wrote
 * @param {{condition: object, ctx: object, packs: object}} rec  the pack ctx (gates ABSENT — the
 *        policy supplies them) and the `applyDriverPacks` result
 */
export function registerRaysAB(surface, { condition, ctx, packs } = {}) {
  if (!surface || !surface.material || !surface.material.uniforms) return false;
  const material = surface.material;
  if (!material.uniforms.uRayBrightness) return false;
  if (!condition) return false;
  const a = packAnswer(condition, ctx);
  // ⭐ 2026-09-03 (the live seam) — THE REGISTRY FOLLOWS THE MATERIAL'S OWN LIFETIME. Planet.js:2001
  // unregisters planets on dispose, but MOONS dispose through src/objects/Moon.js:704 and never called
  // this module, so the first re-approach measured the registry at 17 → 28 (11 stale moon materials).
  // A material dispatches 'dispose' when it is disposed (three's EventDispatcher), on every body class,
  // so the registry listens to that instead of depending on each teardown path remembering to call
  // unregister — no new line in Moon.js, and `size()` is a census again, not a monotone counter.
  const onDispose = () => { LIVE.delete(material); material.removeEventListener('dispose', onDispose); };
  LIVE.set(material, {
    surface, condition, ctx, sabotaged: null, onDispose,
    packsApplied: (packs && packs.applied) ? [...packs.applied] : [],
    ...a,
  });
  material.addEventListener('dispose', onDispose);
  if (_off) material.uniforms.uRayBrightness.value = 0;
  installOnce();
  return true;
}

export function unregisterRaysAB(surface) {
  if (!surface || !surface.material) return;
  const r = LIVE.get(surface.material);
  if (r && r.onDispose) surface.material.removeEventListener('dispose', r.onDispose);
  LIVE.delete(surface.material);
}

function writeArm(m, r) {
  const u = m.uniforms && m.uniforms.uRayBrightness;
  if (!u) return false;
  u.value = _off ? 0 : (r.sabotaged === null ? r.packValue : r.sabotaged);
  return true;
}

/** OFF ⇔ `uRayBrightness` 0 on every live material; ON restores each material's pack-resolved value. */
export function toggleRaysAB(force) {
  _off = (force === undefined) ? !_off : !!force;
  let n = 0;
  for (const [m, r] of LIVE) if (writeArm(m, r)) n++;
  return { off: _off, materials: n };
}

/** Force the OFF arm (idempotent) — the shape a measurement script wants beside `toggle()`. */
export function raysOff() { return toggleRaysAB(true); }
/** Force the ON arm (idempotent). */
export function raysOn() { return toggleRaysAB(false); }

/**
 * The SABOTAGE arm: write a value the law forbids onto ONE surface (meant for a body WITH air, whose
 * law value is exactly 0). ⛔ It never persists — `restoreRays` re-derives from the pack.
 */
export function sabotageRays(surface, value = RAY_SABOTAGE_VALUE) {
  const r = LIVE.get(surface && surface.material);
  if (!r) return null;
  r.sabotaged = value;
  writeArm(surface.material, r);
  return recordRays(surface);
}

/** Undo the sabotage: re-derive through the block and write the pack's own answer back. */
export function restoreRays(surface) {
  const r = LIVE.get(surface && surface.material);
  if (!r) return null;
  Object.assign(r, packAnswer(r.condition, r.ctx));
  r.sabotaged = null;
  writeArm(surface.material, r);
  return recordRays(surface);
}

/**
 * What state this surface is in, and the three numbers that have to agree for the wire to be live:
 * the LAW's answer on this condition, the PACK's resolved answer, and what the material actually holds.
 */
export function recordRays(surface) {
  const m = surface && surface.material;
  const r = LIVE.get(m);
  if (!r) return null;
  const u = m.uniforms.uRayBrightness;
  const dens = m.uniforms.uCraterDensity;
  return {
    lawValue: rayBrightnessOf(r.condition),
    packValue: r.packValue,
    uniformValue: u ? u.value : null,
    state: _off ? 'off' : (r.sabotaged === null ? 'on' : 'sabotage'),
    density: dens ? dens.value : null,
    packDensity: r.density,
    rel: r.rel,
    rayCount: m.uniforms.uRayCount ? m.uniforms.uRayCount.value : null,
    raySharp: m.uniforms.uRaySharp ? m.uniforms.uRaySharp.value : null,
    packsApplied: r.packsApplied,
    sabotagedValue: r.sabotaged,
  };
}

function installOnce() {
  if (_installed) return;
  _installed = true;
  if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') window.addEventListener('keydown', (e) => {
    if (e.shiftKey || e.ctrlKey || e.altKey || e.metaKey || e.repeat) return;
    if (isTypingTarget(e.target)) return;
    // KeyY — the ONLY unbound letter in the game's key map, measured `grep -rhoE "'Key[A-Z]'" src`
    // 2026-09-03 (A–X and Z are all taken; `I` went to the storm A/B the day before).
    if (e.code === 'KeyY') {
      const r = toggleRaysAB();
      if (typeof console !== 'undefined') console.info(`[rays A/B] uRayBrightness ${r.off ? 'OFF' : 'ON'} on ${r.materials} lab bodies`);
    }
  });
  globalThis._labRays = {
    toggle: toggleRaysAB,
    off: raysOff,
    on: raysOn,
    get isOff() { return _off; },
    size() { return LIVE.size; },
    record: recordRays,
    sabotage: sabotageRays,
    restore: restoreRays,
    /** Every registered surface's record — the registry census AC-4 reports beside a 0-px control. */
    all() { return [...LIVE.values()].map((r) => recordRays(r.surface)); },
  };
}
