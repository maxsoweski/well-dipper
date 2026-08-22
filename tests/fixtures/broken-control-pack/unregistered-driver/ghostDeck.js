// tests/fixtures/broken-control-pack/unregistered-driver/ghostDeck.js
//
// ⛔⛔ BROKEN ON PURPOSE. DO NOT REGISTER IT. DO NOT MOVE IT UNDER src/.
//
// The executed control for one-pipeline-fence registration 4 — "every module under
// `src/worldengine/drivers/` appears in the runtime `PACKS` array". This module is shaped exactly
// like a real pack entry and is absent from `PACKS`, which is the failure registration 4 exists to
// catch: a driver that is written, reviewed, imported and then never APPLIED.
//
// ⭐ WHY THAT FAILURE IS SILENT WITHOUT THIS FENCE, and it is the whole registration's argument:
// nothing throws. The pack's own suite passes, because a pack's suite calls the pack directly. The
// game renders, because `applyDriverPacks` iterates `PACKS` and simply never reaches this entry. The
// only symptom is a feature that does not appear, on a body nobody is looking at.
export const GHOST_DECK_ENTRY = Object.freeze({
  name: 'ghostDeck',
  applies: () => false,
  gates: Object.freeze([]),
  pack: () => ({ drivers: {}, attributes: {} }),
});
