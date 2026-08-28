// src/util/fullscreen.js
// Fullscreen capability, as PURE predicates over a document-like object (2026-08-28).
//
// WHY THIS EXISTS. The Fullscreen API is not available on iPhone Safari — iOS offers it for <video>
// only, never for an arbitrary element. This game called it three times with no guard, and one of those
// calls sits behind a blinking button the stylesheet shows ONLY on touch devices
// (src/style.css `@media (pointer: coarse)`), i.e. a control shown exclusively to the platform least
// able to honour it.
//
// ⛔ AND `.catch(() => {})` DOES NOT COVER IT, which is the trap worth naming. The written form was
//       document.documentElement.requestFullscreen().catch(() => {});
// If `requestFullscreen` is undefined that is a TypeError thrown SYNCHRONOUSLY, while evaluating the
// call — before any promise exists and therefore before `.catch` can ever run. A reader sees a handled
// rejection; the device gets an uncaught exception. Guarding the METHOD, not the promise, is the fix.
// The correct shape already existed in this codebase at src/main.js:10768 — this module makes it the
// single place it is expressed, and makes it testable, which a call site inside a 15,000-line module is not.
//
// ⚠ THESE ARE PREDICATES, NOT ACTIONS. They take a document-like object and return facts; the call
// sites keep the side effects. That is what lets a unit test hand in a fake iOS document and get a real
// answer without a browser, which is the only kind of iOS evidence available here — nobody in this loop
// has an iPhone (see docs/FEATURES/mobile-pass-plan-2026-08-28.md and its [PLATFORM]/[NEEDS-MAX] labels).

/**
 * Can this document actually put an element into fullscreen?
 *
 * ⭐ `fullscreenEnabled` IS THE RIGHT QUESTION AND IT IS NOT THE SAME AS "the method exists". A method
 * can be present while the capability is denied — an iframe without `allow="fullscreen"` is the common
 * case — and calling it there fails at runtime having passed a method-existence check. So: prefer the
 * capability flag when the browser publishes one, and fall back to method presence only when it does not.
 */
export function fullscreenAvailable(doc) {
  if (!doc) return false;
  if (typeof doc.fullscreenEnabled === 'boolean') return doc.fullscreenEnabled;
  if (typeof doc.webkitFullscreenEnabled === 'boolean') return doc.webkitFullscreenEnabled;
  const el = doc.documentElement;
  return !!(el && (typeof el.requestFullscreen === 'function'
                || typeof el.webkitRequestFullscreen === 'function'));
}

/**
 * The element currently fullscreen, or null — reading BOTH spellings.
 * The settings checkbox read only the unprefixed one, so on a WebKit browser that exposes only the
 * prefixed property the checkbox would report "not fullscreen" while the page was fullscreen, and the
 * next toggle would try to ENTER again instead of exiting.
 */
export function fullscreenElementOf(doc) {
  if (!doc) return null;
  return doc.fullscreenElement || doc.webkitFullscreenElement || null;
}

/** Is this document currently in fullscreen? */
export function isFullscreen(doc) {
  return !!fullscreenElementOf(doc);
}

/**
 * Enter fullscreen if it is genuinely available. Returns whether the attempt was MADE — never whether
 * it succeeded, which only the promise knows. A false return is the signal a caller needs to hide or
 * disable its control rather than offer a tap that does nothing.
 */
export function requestFullscreen(doc) {
  if (!fullscreenAvailable(doc)) return false;
  const el = doc.documentElement;
  const fn = el.requestFullscreen || el.webkitRequestFullscreen;
  if (typeof fn !== 'function') return false;
  try {
    const r = fn.call(el);
    if (r && typeof r.catch === 'function') r.catch(() => {});
  } catch {
    return false;
  }
  return true;
}

/** Leave fullscreen if we are in it. Returns whether the attempt was made. */
export function exitFullscreen(doc) {
  if (!doc || !isFullscreen(doc)) return false;
  const fn = doc.exitFullscreen || doc.webkitExitFullscreen;
  if (typeof fn !== 'function') return false;
  try {
    const r = fn.call(doc);
    if (r && typeof r.catch === 'function') r.catch(() => {});
  } catch {
    return false;
  }
  return true;
}
