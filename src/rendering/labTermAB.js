// src/rendering/labTermAB.js
// ─────────────────────────────────────────────────────────────────────────────
// THE TERMINATOR A/B (key `.`) + the `_labTerm` dev instrument — workstream
// wire-terminator-gradient-lab-into-game (AC-3). The sibling of `src/rendering/labRaysAB.js` (key `Y`)
// and `src/rendering/labStormAB.js` (key `I`), and it keeps its own registry for the same reason
// those do.
//
// ⭐⭐ ITS ARMS ARE THE OTHER WAY ROUND FROM ITS TWO SIBLINGS, and that is the whole point of the key.
// The rays and the storms ship ON, so their instrument's interesting arm is OFF. The terminator ships
// OFF — Max's 2026-07-16 ruling, "disable terminator gradient totally" — so what nobody can see is
// what the ruling REMOVED. `toggle()` therefore turns the band ON, at the pack's own resolved value
// for that body, and `off()` puts back the zero that ships. He is looking at a subtraction.
//
//   SHIPPED  `uTermStrength` resolved under the RULED gate policy = +0 on every body the world engine
//            admits (src/worldengine/drivers/index.js `GATE_RULINGS`, writePackUniforms.js:186).
//   ON       the pack's RESOLVED value re-derived under an explicit `GATE_POLICY_ALL_ON` — the law's
//            own answer for THIS body (`columnFraction × TERM_STRENGTH`, terminatorOptics.js:58/:95).
//            ⛔ NEVER A LITERAL 0.15. 0.15 is the CEILING of that product, not the population's
//            constant: measured over the corpus, 99 bodies resolve exactly 0.15 and `rocky-3/planet/0`
//            resolves 0.130327 at 0.105 bar. An instrument that wrote 0.15 would show Max a band his
//            thin-column worlds never had, and the airless-moon control — which must read exactly 0 —
//            would be a claim about the instrument rather than about the law.
//
// ⛔ IT REGISTERS EVERY LAB MATERIAL THE GAME MOUNTS — planets, moons AND gas bodies — like the ray
// A/B beside it and unlike the storm A/B. AC-3's airless-moon control is "0 px moved AND
// `record(moonSurface)` non-null with lawValue 0": a body that moved nothing because it was never
// registered is not a control, it is a blind spot, and this registry is the difference.
//
// ⛔ NO RENDERER OBJECT IS TOUCHED beyond `material.uniforms.uTermStrength.value` — the same surface
// the pack writer uses. ⛔ Nothing persists: `off()` restores the resolved shipped value, not a
// remembered one, so a body left ON by a fumbled keypress is put back by the law and not by a cache.
// ⛔ The key ignores every modifier and every typing target.
// ─────────────────────────────────────────────────────────────────────────────
import { PACKS, gatesFor, GATE_POLICY_ALL_ON } from '../worldengine/drivers/index.js';
import { resolveDriver } from '../worldengine/port/writePackUniforms.js';

const LIVE = new Map();   // material -> { surface, condition, ctx, entryName, lawValue, shipped, onDispose }
let _on = false;
let _installed = false;

/** The two packs that emit `uTermStrength`; their predicates are exact complements over the corpus. */
const TERM_PACK_NAMES = Object.freeze(['solidOptics', 'giantSurface']);

function isTypingTarget(t) {
  if (!t) return false; const tag = (t.tagName || '').toLowerCase();
  return tag === 'input' || tag === 'textarea' || tag === 'select' || t.isContentEditable === true;
}

/**
 * Re-derive what the PACK answers for this body, both ways.
 *
 * ⛔ Not a second transcription of the law and not a cached uniform read: the entry's own `pack` is
 * called, so the ON arm cannot drift from what the mount would have written had the gate been open,
 * and `shipped` is what the RULED policy resolves TODAY rather than a hard-coded 0 — flip
 * `TERMINATOR_ENABLED` and this instrument keeps telling the truth instead of lying in the old
 * direction.
 */
function packAnswer(condition, ctx) {
  for (const entry of PACKS) {
    if (!TERM_PACK_NAMES.includes(entry.name)) continue;
    if (entry.applies(condition, ctx) !== true) continue;
    const onCtx = { ...(ctx || {}), gates: gatesFor(entry, GATE_POLICY_ALL_ON) };
    const shippedCtx = { ...(ctx || {}), gates: gatesFor(entry) };
    const r = entry.pack(condition, onCtx);
    if (!('uTermStrength' in r.drivers)) continue;
    return {
      entryName: entry.name,
      lawValue: resolveDriver('uTermStrength', r.drivers.uTermStrength, onCtx),
      shipped: resolveDriver('uTermStrength', r.drivers.uTermStrength, shippedCtx),
    };
  }
  return null;
}

/**
 * Register a swapped surface whose material carries `uTermStrength`. Returns false (and registers
 * nothing) on a legacy material — Sol's bodies go through the legacy program, whose own ungated
 * writer at src/objects/Planet.js:1653 this instrument deliberately does not reach.
 * @param {object} surface  the THREE.Mesh whose `material.uniforms` the packs wrote
 * @param {{condition: object, ctx: object, packs: object}} rec  the pack ctx (gates ABSENT — the
 *        policy supplies them) and the `applyDriverPacks` result
 */
export function registerTermAB(surface, { condition, ctx, packs } = {}) {
  if (!surface || !surface.material || !surface.material.uniforms) return false;
  const material = surface.material;
  if (!material.uniforms.uTermStrength) return false;
  if (!condition) return false;
  const a = packAnswer(condition, ctx);
  if (!a) return false;
  // ⛔⛔ THE REGISTRY IS RELEASED BY THE MATERIAL'S OWN `dispose` EVENT, not only by an explicit
  // `unregisterTermAB`. MEASURED on the F3 ray A/B the day this file was written: that instrument
  // registers every lab material but only `src/objects/Planet.js:2001` unregisters, while MOONS are
  // torn down through `src/objects/Moon.js:704` — so one re-approach grew its registry 17 → 28 with
  // 11 stale moon materials still in it. A leaked entry is worse here than a leak usually is: the
  // registry SIZE is AC-3's admission evidence for the airless-moon 0-px control ("the 0 is
  // admissible only once the moon is proven to be in the registry"), so a registry that counts dead
  // bodies makes that control unreadable in the direction that looks like success. Listening to the
  // material is class-agnostic: it needs no line in Moon.js, no line in BodyRenderer, and it cannot
  // be forgotten by a third mount site that does not exist yet.
  const onDispose = () => { LIVE.delete(material); };
  if (typeof material.addEventListener === 'function') material.addEventListener('dispose', onDispose);
  LIVE.set(material, {
    surface, condition, ctx, onDispose,
    packsApplied: (packs && packs.applied) ? [...packs.applied] : [],
    ...a,
  });
  if (_on) material.uniforms.uTermStrength.value = a.lawValue;
  installOnce();
  return true;
}

export function unregisterTermAB(surface) {
  const material = surface && surface.material;
  if (!material) return;
  const r = LIVE.get(material);
  if (r && r.onDispose && typeof material.removeEventListener === 'function') material.removeEventListener('dispose', r.onDispose);
  LIVE.delete(material);
}

function writeArm(m, r) {
  const u = m.uniforms && m.uniforms.uTermStrength;
  if (!u) return false;
  u.value = _on ? r.lawValue : r.shipped;
  return true;
}

/** ON ⇔ each material's own pack-resolved law value; OFF ⇔ the value that ships (0 under the ruling). */
export function toggleTermAB(force) {
  _on = (force === undefined) ? !_on : !!force;
  let n = 0;
  for (const [m, r] of LIVE) if (writeArm(m, r)) n++;
  return { on: _on, materials: n };
}

/** Force the shipped arm (idempotent) — the shape a measurement script wants beside `toggle()`. */
export function termOff() { return toggleTermAB(false); }
/** Force the law arm (idempotent). */
export function termOn() { return toggleTermAB(true); }

/**
 * What state this surface is in, and the numbers AC-3 reads off a 0-px result.
 *
 * ⭐ `hasAir` is here because the airless control's ZERO is only admissible once the body is proven
 * to be BOTH in the registry and airless: `record()` returning non-null answers the first and
 * `hasAir === false` with `lawValue === 0` answers the second. A null return is a blind spot, not a
 * measurement, and the two are indistinguishable from a screenshot.
 */
export function recordTerm(surface) {
  const m = surface && surface.material;
  const r = LIVE.get(m);
  if (!r) return null;
  const u = m.uniforms.uTermStrength;
  return {
    lawValue: r.lawValue,
    shipped: r.shipped,
    uniformValue: u ? u.value : null,
    state: _on ? 'on' : 'shipped',
    hasAir: !!(r.condition && r.condition.atmosphere),
    pack: r.entryName,
    termWidth: m.uniforms.uTermWidth ? m.uniforms.uTermWidth.value : null,
    termBypass: m.uniforms.uTermBypass ? m.uniforms.uTermBypass.value : null,
    packsApplied: r.packsApplied,
  };
}

function installOnce() {
  if (_installed) return;
  _installed = true;
  if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') window.addEventListener('keydown', (e) => {
    if (e.shiftKey || e.ctrlKey || e.altKey || e.metaKey || e.repeat) return;
    if (isTypingTarget(e.target)) return;
    // `Period` — unbound, MEASURED 2026-09-03: every letter A–Z is taken (Y went to the ray A/B the
    // same day) and the bound non-letters are Backquote, Digit1, Enter, Escape, Space and Tab.
    if (e.code === 'Period') {
      const r = toggleTermAB();
      if (typeof console !== 'undefined') console.info(`[terminator A/B] uTermStrength ${r.on ? 'ON (the pack\'s law value per body)' : 'OFF (what ships — Max 2026-07-16)'} on ${r.materials} lab bodies`);
    }
  });
  globalThis._labTerm = {
    toggle: toggleTermAB,
    on: termOn,
    off: termOff,
    get isOn() { return _on; },
    size() { return LIVE.size; },
    record: recordTerm,
    /** Every registered surface's record — the registry census AC-3 reports beside a 0-px control. */
    all() { return [...LIVE.values()].map((r) => recordTerm(r.surface)); },
  };
}
