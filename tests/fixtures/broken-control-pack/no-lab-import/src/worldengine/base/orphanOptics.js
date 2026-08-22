// ⛔⛔ BROKEN ON PURPOSE. The engine-side half of registration 2's control.
//
// A pipeline module the game reaches and the lab never imports. Named after `atmosphereOptics.js` —
// the failure that HAS ALREADY OCCURRED and the reason registration 2 is not scoped to `drivers/`.
// A packs-only import-back check would not have seen it, because it is not a pack.
export function orphanOpticsOf(condition) {
  return { haze: condition.hazeOpacity ?? 0 };
}
