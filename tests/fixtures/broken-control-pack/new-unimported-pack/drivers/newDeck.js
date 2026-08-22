// ⛔⛔ BROKEN ON PURPOSE. The engine-side half of registration 2b's control (AC4).
//
// A pack authored AFTER the grandfathered roster closed. It is a well-formed pack — registered,
// applied, tested by its own suite, green everywhere — and the lab never imports it. That is
// precisely the state seven of the eight shipped packs arrived in, and the state registration 2's
// debt ledger can absorb the moment a cleared row leaves a free slot under the ceiling.
export function newDeckPack(condition) {
  return { uNewDeckStrength: condition.deckStrength ?? 0 };
}
