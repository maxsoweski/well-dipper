// src/flight/freeLookApply.js
// Per-frame bridge between the pure latched free-look state (freeLook.js) and the
// HeadMount camera (HeadMount.js). Kept pure + tiny so the latch↔head wiring is
// unit-testable without three.js camera setup.
//
// Why this exists: HeadMount.addLook() only accepts input while `held` is true,
// and HeadMount.update() only eases the view back to center while `held` is false.
// The middle-mouse PEEK already drives `held` via beginLook()/endLook() on press/
// release. Latched free-look (F) needs the SAME `held=true` gate, but for as long
// as the latch is on — so we re-assert it every frame here rather than only on a
// key edge. That also makes a middle-mouse peek RELEASE while still latched a
// no-op (this re-asserts held next frame), so releasing a peek doesn't recenter
// while you're still in latched free-look.
//
// On latch-OFF the freeLook one-shot `consumeRecenter()` fires once; we drop the
// hold so HeadMount.update() eases yaw/pitch → 0 (RECENTER_TAU). §supercruise-
// arrival-modes-design-2026-06-27, Feature 2.

/**
 * Reconcile the HeadMount hold flag with the free-look latch, once per frame.
 * Call BEFORE head.update(dt) so the recenter release takes effect this frame.
 *
 * @param {{latched:boolean, consumeRecenter:()=>boolean}} freeLook
 * @param {{held:boolean, beginLook:()=>void, endLook:()=>void}} head
 */
export function syncHeadToFreeLook(freeLook, head) {
  // One-shot recenter on toggle-off: release the hold so update() eases back.
  // Consume FIRST so a latch→unlatch→latch within a frame can't strand the flag.
  if (freeLook.consumeRecenter()) {
    head.endLook();
  }
  // While latched, keep the head held so addLook() is accepted and update()
  // does NOT auto-recenter. Idempotent (beginLook just sets the flag), so a
  // peek that already set held stays held, and a peek release re-asserts here.
  if (freeLook.latched && !head.held) {
    head.beginLook();
  }
}
