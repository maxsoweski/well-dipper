// src/worldengine/base/surfaceProcesses.js
// ─────────────────────────────────────────────────────────────────────────────────────────────────
// THE FOUR SURFACE-PROCESS LAWS — dissolution, aeolian transport, fallout and gravity transport —
// AND THIS IS THEIR ONE DEFINITION. Workstream solid-relief-deck, AC-0, 2026-09-04.
//
//     surfaceProcessesOf(condition) -> { karstDensity, karstMaturity, duneDensity, dustDepth,
//                                        massWastDensity, repose, ldaFat, meta }
//
//     F21 karst / dissolution      karstDensity · karstMaturity
//     F15 dunes & wind forms       duneDensity
//     F16 dust mantles             dustDepth
//     F19 mass-wasting deposits    massWastDensity · repose · ldaFat
//
// ⭐ PROVENANCE: THESE ARE THE LAB'S OWN LINES, MOVED, NOT A PORT OF THEM. Until this file existed
// all four lived ONLY inside `applyDrivers()` in world-engine-lab.html — :2175 (karst), :2187
// (dunes), :2203 (dust), :2218-:2221 (mass-wasting) — i.e. inside the authoring PAGE, reachable by
// no module in `src/` at all. That is why the coverage audit found six of the thirteen master gates
// unforwardable rather than merely unforwarded: there was nothing for a pack to import. The
// expressions moved here; the lab's four blocks are neutralised in place and call this instead.
//
// ⭐ ONE FUNCTION, NOT FOUR, and it is `fluvialDeck.js`'s reason verbatim: the four share `wet`,
// `stab`, `erosion`, `hadLiquid` and `press`, and a per-law helper taking a pre-computed bundle can
// be handed a bundle derived from a DIFFERENT condition than the one it reads — a silent wrong
// answer rather than a slow one.
//
// ⛔⛔ THE SEED-DEAF READ IS REPAIRED HERE, AND THAT IS A DECLARED BEHAVIOUR CHANGE IN THE LAB, NOT A
// REFACTOR. The lab's block mixes its sources: `_stab` comes from the PER-SEED draw
// (world-engine-lab.html:2129, off `_dp`), while `_erosion`, `_press` and `_hadLiquid` come from
// `_fp` — the FROZEN preset (:2127), which is seed-DEAF. So today every macro seed of one preset
// answers the same karst, dunes and dust. This is the identical seam `fluvialDeck` hit and repaired
// (its header: the `_fp`/`_dp` ruling, and the single-spelling erosion read that left
// `uOutflowDensity` at 0 of 124 game bodies until the pack became its reader). This function takes
// ONE condition and reads every input off it, so the lab's callsite passes `_dp` and its presets
// become seed-live. ⚠ MEASURED, so the change is not discovered later as a regression: the parent's
// 18-preset values are captured at docs/WORKSTREAMS/solid-relief-deck/lab-parent-capture.json and
// this file reproduces all 18 EXACTLY when handed `_fp` — the delta is entirely the seed, not the law.
//
// ⛔ THE DUAL EROSION SPELLING IS PART OF THE LAW. ROOT-0 fix 1 (B1, 2026-08-20): lab presets write
// `surfaceHistory.erosion`, the game writes `surfaceHistory.erosionLevel`
// (src/generation/PhysicsEngine.js `erosionLevel: erosion,`). A reader that knows only the lab
// spelling drives a hard 0 into every condition-shaped bundle. The lab spelling still WINS where
// both exist, so no preset moves. Same precedence as src/worldengine/base/labCore.js:646 and
// src/worldengine/base/ejectaRays.js.
//
// ⚠ THE PRESSURE RAMP IS SATURATED OR FLOORED ON EVERY WORLD WE HAVE, AND THAT IS RECORDED RATHER
// THAN REPAIRED. `smoothstep(0.05, 0.3, pressure)` was written to ease dune/dust in with thickening
// air. MEASURED 2026-09-04: 0 of the 18 driver presets and 1 of the 124 corpus solid bodies sit
// inside (0.05, 0.3) — every other world is either airless (floored to 0) or above 0.3 bar
// (saturated to 1). So in practice the term is a BINARY switch, which is why `duneDensity` reads a
// median of 1.0 across the 66 corpus planets. That is a law-shape observation about the lab, logged
// to the backlog; this workstream carries the law as the lab renders it (Max 2026-09-04: "much more
// development is needed but this lays the groundwork").
//
// ⛔ NO ENABLE GATES AND NO RELEVANCE MULTIPLY HERE. The lab's ✓ checkboxes (`karstEnabled`,
// `dunesEnabled`, `dustEnabled`, `massWastEnabled`) live at its per-frame writer
// (world-engine-lab.html:5103/:5113/:5121/:5127) and stay there; the pack resolves its own gates
// through the port. This file is the LAW, ungated, exactly as `rayBrightnessOf` is.
//
// ⛔ THREE-FREE and pure: `clamp01` / `smoothstep` off mathutil, no renderer, no rng, no `ctx`, no
// preset name, no `d.type`.
// ─────────────────────────────────────────────────────────────────────────────────────────────────
import { clamp01 } from './mathutil.js';

// ⚠ THE LAB'S OWN LOCAL SMOOTHSTEP, CARRIED BY VALUE. world-engine-lab.html:2164 defines
// `const _ss = (e0, e1, x) => { const tt = _clamp01((x - e0) / (e1 - e0)); return tt*tt*(3 - 2*tt); }`
// inside `applyDrivers`. It is the standard cubic and agrees with every other spelling in the tree on
// every finite input; it is written out here rather than imported so this file reads as the block it
// replaces, and the 18-preset fixture is the measurement that says the two agree.
const ss = (e0, e1, x) => { const t = clamp01((x - e0) / (e1 - e0)); return t * t * (3 - 2 * t); };

/**
 * The four surface-process laws for one body.
 *
 * @param {object} condition  a body condition vector, a driver preset, or any bundle carrying
 *                            `atmosphere`, `surfaceHistory`, `composition`, `T_eq`.
 * @param {object} derived    the `deriveUniforms(condition)` bundle — read for `liquidStability`
 *                            (the master liquid gate) and `surfaceGravity`. Passed in rather than
 *                            re-derived so one call serves a whole pack, exactly as the lab's own
 *                            block reads the `u` it already has (world-engine-lab.html:2129).
 * @returns {{karstDensity:number, karstMaturity:number, duneDensity:number, dustDepth:number,
 *            massWastDensity:number, repose:number, ldaFat:number, meta:object}}
 */
export function surfaceProcessesOf(condition, derived) {
  const c = condition || {};
  const erosion = c.surfaceHistory?.erosion ?? c.surfaceHistory?.erosionLevel ?? 0;
  const stab = derived?.liquidStability ?? 0;
  const g = derived?.surfaceGravity ?? 1;

  // world-engine-lab.html:2131 `const _wet = _stab > 0.15;` — F11's existence gate, shared.
  const wet = stab > 0.15;
  // world-engine-lab.html:2135 — relict only on worlds that COULD have held surface liquid. A
  // genuinely airless world floors to 0: its recorded erosion is bombardment/space-weathering, not
  // fluvial.
  const hadLiquid = !!(c.atmosphere && c.atmosphere.retained !== false);
  const press = hadLiquid ? (c.atmosphere.pressure ?? 1.0) : 0;
  const noSurface = c.atmosphere?.composition === 'h2-he';

  // ── F21 karst — F11's solvent-gate STRUCTURE (stable liquid ⇒ active; relict-wet retained-
  // atmosphere ⇒ faint; airless ⇒ 0) with EROSION replacing rain in the wet branch: dissolution is
  // rate × time and D11 erosion is the recorded time budget — rain rate drives channels, not slow
  // chemical eating. Unlike F13 (erosion-thresholded rare ⇒ Titan 0), Titan MUST stay non-zero — its
  // labyrinth terrain is the flagship reference. Maturity = dissection degree ∝ erosion.
  const karstDensity = wet ? clamp01(stab * (0.4 + 0.6 * erosion))
                           : (hadLiquid ? 0.4 * clamp01(erosion) : 0.0);
  const karstMaturity = clamp01(erosion);

  // ── F15 dunes — aeolian transport needs AIR: the D6 retention gate × the D5 pressure ramp (grains
  // cannot saltate in a near-vacuum) × a PARTIAL dryness term (1 − 0.65·stab), NOT (1 − stab):
  // global liquid stability does not preclude ergs — Titan's equatorial dune belts coexist with polar
  // methane seas (the latitude split is uDuneBelt's job). A full (1−stab) dryness would zero Titan.
  const duneDensity = clamp01(ss(0.05, 0.3, press) * (1.0 - 0.65 * stab));

  // ── F16 dust mantles — ONE depth continuum runs all three channels (relief smoothing / ochre lift
  // / butterscotch veil). Same aeolian air gate as F15, × an accumulation-history term
  // (0.3 + 0.7·erosion): mantles are fallout INTEGRATED OVER TIME, FLOORED at 0.3 so young-but-windy
  // worlds still wear a veneer. Gas/ice giants have no solid surface, so settled dust cannot
  // accumulate — their "dust" is suspended haze, a separate feature; zero it where there is no ground.
  const dustDepth = noSurface ? 0.0
    : clamp01(ss(0.05, 0.3, press) * (1.0 - 0.65 * stab) * (0.3 + 0.7 * erosion));

  // ── F19 mass-wasting — gravity + steep relief are UNIVERSAL: every solid world qualifies, airless
  // very much included (Iapetus sturzstroms, lunar crater-wall talus), so the master gate is a
  // constant 1.0 — existence is gated PER-FRAGMENT by the host-slope residual in the combiner (no
  // steeps ⇒ no deposits), not by climate here.
  // ⚠⚠ AND THE LAB HALF OF F19 IS MEASURED INERT — the rendered contribution reads .00006. This wire
  // is CARRIAGE for a law that puts nothing on screen until that is fixed; the F-spine row says so
  // and there is a backlog row. Wiring it anyway is deliberate: the carriage is the workstream's job
  // and a repaired lab half then arrives in the game for free.
  const massWastDensity = 1.0;
  // uRepose maps D14 surface gravity INVERSELY (0.9·g^-0.4, clamped 0.5..2.2): low-g walls stand
  // steeper before shedding. Physically dry repose is g-independent (friction); the stylized inverse
  // is the card's deliberate form-change read.
  const repose = Math.min(2.2, Math.max(0.5, 0.9 / Math.pow(Math.max(g, 0.05), 0.4)));
  // ldaFat = ground-ice proxy: D2 volatile budget (the F14 ×2 ramp) × a cold gate on T_eq — warm
  // worlds hold no ground ice.
  const coldGround = 1.0 - ss(150, 260, c.T_eq ?? 288);
  const ldaFat = clamp01((c.composition?.volatileFraction ?? 0) * 2.0) * coldGround;

  return {
    karstDensity, karstMaturity, duneDensity, dustDepth,
    massWastDensity, repose, ldaFat,
    // The shared intermediates, surfaced for the same reason `fluvialDeckPack` surfaces its `meta`:
    // a suite asking "why is this body 0?" must not answer with a second copy of the gate.
    meta: { wet, hadLiquid, erosion, stab, press, noSurface, surfaceGravity: g },
  };
}
