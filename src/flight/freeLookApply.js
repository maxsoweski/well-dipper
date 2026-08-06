// src/flight/freeLookApply.js
// Per-frame bridge between the pure latched free-look state (freeLook.js) and the
// HeadMount camera (HeadMount.js). Kept pure + tiny so the latch↔head wiring is
// unit-testable without three.js camera setup.
//
// §free-look-interaction-redesign-2026-06-27, Part 2 — REDESIGNED. Previously this
// re-asserted HeadMount.held=true EVERY frame while the latch was on, so the head
// looked on ALL mouse motion and the virtual joystick froze. That is GONE: `held`
// is now DECOUPLED from the latch and follows the LEFT mouse button (the live
// mousedown/up handlers call beginLook()/endLook()), so in free-look you look ONLY
// while dragging with LMB, and a bare cursor is a free pointer.
//
// The bridge's ONLY remaining job is the one-shot recenter on free-look EXIT (F
// off): consumeRecenter() → head.beginRecenter() so HeadMount.update() eases the
// view back to nose-forward (EXIT_RECENTER_TAU). While latched + LMB released the
// head HOLDS its current yaw/pitch — that is HeadMount's new default (!held &&
// !recentering → no ease), so the bridge does nothing in that case.

/**
 * Reconcile the HeadMount with the free-look latch, once per frame.
 * Call BEFORE head.update(dt) so the recenter request takes effect this frame.
 *
 * @param {{latched:boolean, consumeRecenter:()=>boolean}} freeLook
 * @param {{held:boolean, beginRecenter:()=>void}} head
 */
export function syncHeadToFreeLook(freeLook, head) {
  // One-shot recenter on toggle-off: request the eased return to nose-forward.
  // (held is driven by the LMB, not here, so we no longer touch it on the latch.)
  if (freeLook.consumeRecenter()) {
    head.beginRecenter();
  }
}
