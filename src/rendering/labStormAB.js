// src/rendering/labStormAB.js
// ─────────────────────────────────────────────────────────────────────────────
// THE STORM A/B (key `I`) + the `_labStorms` dev instrument — workstream wire-storm-slice-lab-into-game
// (AC-5 / AC-6). The sibling of the V / J / U keys in src/rendering/bake/labBakeHost.js, kept OUT of that
// host on purpose: the host tracks SOLID bodies (it is the bake transport), and storms are five uniforms
// on GAS materials with no bake, no worker and no cube. So this module keeps its own registry of live
// gas materials, fed from Planet.js at the point the packs ran.
//
// THE THREE ARMS, in the pair-shot vocabulary (PLAN §12):
//   OFF       `uStormCount` 0 on every live gas material — the lab's own off state, and the shipped
//             regression contract: every GLSL storm term sits behind `i < uStormCount`.
//   ON        the composed count restored (recorded at registration from the pack's meta).
//   SABOTAGE  the slots RECOMPOSED from another storm seed, count kept — a THIRD state ≠ ON ≠ OFF,
//             which is what proves the slots are read per body (identical-output-needs-a-liveness-probe).
//             ⛔ NEVER PERSISTS: `restore(surface)` re-derives at the declared GAME_STORM_SEED, and a
//             sabotaged surface is flagged so a measurement cannot mistake it for a live body.
//
// ⛔ NO RENDERER OBJECT IS TOUCHED beyond `material.uniforms.*.value` — the same surface the pack writer
// uses. ⛔ The key ignores every modifier (Shift+I is the scene inspector) and typing targets.
// ─────────────────────────────────────────────────────────────────────────────
import { stormDeckPack, GREAT_SPOT_GATE, STORM_TRAIN_GATE } from '../worldengine/drivers/stormDeck.js';
import { writePackUniforms } from '../worldengine/port/writePackUniforms.js';

const LIVE = new Map();   // material -> { surface, condition, ctx, count, sabotagedSeed }
let _off = false;
let _installed = false;

const allOn = () => ({ [GREAT_SPOT_GATE]: true, [STORM_TRAIN_GATE]: true });

function isTypingTarget(t) {
  if (!t) return false; const tag = (t.tagName || '').toLowerCase();
  return tag === 'input' || tag === 'textarea' || tag === 'select' || t.isContentEditable === true;
}

/**
 * Register a swapped gas surface whose packs included stormDeck. Returns false (and registers nothing)
 * on any body the storm pack did not run on, so a solid body can never enter the registry.
 * @param {object} surface  the THREE.Mesh whose `material.uniforms` the pack wrote
 * @param {{condition: object, ctx: object, packs: object}} rec  the pack ctx (gates ABSENT — the policy
 *        supplies them) and the `applyDriverPacks` result
 */
export function registerStormAB(surface, { condition, ctx, packs }) {
  const meta = packs && packs.meta && packs.meta.stormDeck;
  if (!meta || !surface || !surface.material || !surface.material.uniforms) return false;
  const material = surface.material;
  LIVE.set(material, { surface, condition, ctx, count: meta.count, sabotagedSeed: null });
  if (_off && material.uniforms.uStormCount) material.uniforms.uStormCount.value = 0;
  installOnce();
  return true;
}
export function unregisterStormAB(surface) {
  if (surface && surface.material) LIVE.delete(surface.material);
}

/** OFF ⇔ uStormCount 0 on every live gas material; ON restores each material's composed count. */
export function toggleStormsAB(force) {
  _off = (force === undefined) ? !_off : !!force;
  let n = 0;
  for (const [m, r] of LIVE) {
    const u = m.uniforms && m.uniforms.uStormCount;
    if (!u) continue;
    u.value = _off ? 0 : r.count;
    n++;
  }
  return { off: _off, materials: n };
}

function rewrite(r, stormSeed) {
  const packCtx = { ...r.ctx, gates: allOn(), ...(stormSeed === undefined ? {} : { stormSeed }) };
  const res = stormDeckPack(r.condition, packCtx);
  writePackUniforms(r.surface.material.uniforms, res.drivers, packCtx);
  r.count = res.meta.count;
  if (_off && r.surface.material.uniforms.uStormCount) r.surface.material.uniforms.uStormCount.value = 0;
  return res.meta;
}
/** The SABOTAGE arm: recompose this surface's slots from another storm seed (count kept). */
export function sabotageStorms(surface, stormSeed = 1) {
  const r = LIVE.get(surface && surface.material);
  if (!r) return null;
  const meta = rewrite(r, stormSeed);
  r.sabotagedSeed = stormSeed;
  return { count: meta.count, primaryCenter: meta.primary ? meta.primary.center.slice() : null, sabotagedSeed: stormSeed };
}
/** Undo the sabotage: re-derive at the declared game seed. */
export function restoreStorms(surface) {
  const r = LIVE.get(surface && surface.material);
  if (!r) return null;
  const meta = rewrite(r, undefined);
  r.sabotagedSeed = null;
  return { count: meta.count, primaryCenter: meta.primary ? meta.primary.center.slice() : null, sabotagedSeed: null };
}
/** Read the LIVE slots back off the material — what the shader reads now. */
export function stormSlotsOf(surface) {
  const u = surface && surface.material && surface.material.uniforms;
  if (!u || !u.uStormCount) return null;
  const n = u.uStormCount.value | 0;
  const arr = (name, dim) => u[name].value.slice(0, n).map((v) => (dim === 4 ? [v.x, v.y, v.z, v.w] : [v.x, v.y, v.z]));
  const r = LIVE.get(surface.material);
  return {
    count: n, posSize: arr('uStormPosSize', 4), params: arr('uStormParams', 4), color: arr('uStormColor', 3), aux: arr('uStormAux', 4),
    composedCount: r ? r.count : null, sabotagedSeed: r ? r.sabotagedSeed : null, off: _off,
  };
}

function installOnce() {
  if (_installed) return;
  _installed = true;
  if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') window.addEventListener('keydown', (e) => {
    if (e.shiftKey || e.ctrlKey || e.altKey || e.metaKey || e.repeat) return;
    if (isTypingTarget(e.target)) return;
    // KeyI — unbound in the game's key map, measured `grep -rhoE "'Key[A-Z]'" src` 2026-09-02; Shift+I is the inspector.
    if (e.code === 'KeyI') {
      const r = toggleStormsAB();
      if (typeof console !== 'undefined') console.info(`[storms A/B] uStorm* ${r.off ? 'OFF' : 'ON'} on ${r.materials} gas bodies`);
    }
  });
  globalThis._labStorms = {
    toggle: toggleStormsAB,
    get off() { return _off; },
    count() { return LIVE.size; },
    slots: stormSlotsOf,
    sabotage: sabotageStorms,
    restore: restoreStorms,
    /** The registered record's composed count + whether it is currently sabotaged. */
    record(surface) { const r = LIVE.get(surface && surface.material); return r ? { count: r.count, sabotagedSeed: r.sabotagedSeed } : null; },
  };
}
