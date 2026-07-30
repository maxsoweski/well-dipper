// src/worldengine/display/albedoTransfer.js — the ALBEDO DISPLAY TRANSFER.
//
// This is a DISPLAY curve, not physics. It is deliberately NOT folded into surfaceMaterial.js's
// endmember constants: that module stays physically honest (it also feeds the non-visual bombardment
// gate), and the fudge stays visible here instead of hiding inside a colour table.
//
// ⚠ WHY THIS MODULE EXISTS AT ALL — read before deleting or inlining it.
// The transfer used to live inline in the lab's applyDrivers. docs/FEATURES/surface-variation-beyond-mvp.md
// named it "the single most likely thing to be lost in the port": a port that carries surfaceMaterial.js
// but not this curve renders every planet roughly 2.5x too dark. Extracting it to one shared module is
// what makes that failure structurally impossible rather than merely warned about. The lab and the game
// both import from here. There must never be a second copy.
//
// THE CURVE. A Reinhard soft-clip on LUMINANCE, with the RGB triple scaled by that same ratio so HUE is
// preserved exactly — only exposure moves. It must NOT be a linear gain: Earthlike land is one of the
// darkest surfaces in the set, so a linear gain anchored there blows out every brighter world. Measured:
// at a flat 2.47x, Mars's fresh-bedrock endmember clipped to #fffdf1, destroying exactly the
// fresh-vs-weathered distinction the feature exists to produce. Reinhard asymptotes to 1 and never clips.
//
// ⚠ ONE SCALE FOR THE WHOLE PALETTE, solved from the WEATHERED endmember alone.
// Applying the curve to each endmember by its OWN luminance is wrong, and was visibly wrong. The curve is
// non-linear, so per-endmember scaling compresses bright endmembers less than dark ones and silently
// rewrites the RELATIVE relationships the physics just derived. Live, that turned Earthlike's craton from
// a lateritic #c28d6c into a garish #fdb78c orange while its orogen barely moved — the province read as a
// paint job rather than as geology. Exposure is a property of the WORLD, not of each material on it.

// Solved so Rocky (Earthlike) lands on the legacy 0.408: k = 0.408 / (0.165 * (1 - 0.408)).
export const ALBEDO_TONE_K = 4.176;

// Rec. 709 relative luminance.
export const lumOf = (c) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];

// albedoToneScale(referenceColor) — the single scale factor for a whole palette, solved from the
// area-dominant reference endmember (the weathered background).
export function albedoToneScale(referenceColor) {
  const refLum = lumOf(referenceColor);
  return refLum > 1e-6 ? (ALBEDO_TONE_K / (1 + ALBEDO_TONE_K * refLum)) : 1;
}

// applyAlbedoTransfer(palette, opts) — map every endmember of a surfacePaletteOf() result through ONE
// scale solved from `palette.weathered`. Extra colours (e.g. the biosphere pigment) can be carried
// through the SAME scale via opts.extra, which is the only correct way to add one: a pigment scaled by
// its own luminance would drift out of relation with the ground it sits on.
export function applyAlbedoTransfer(palette, opts) {
  const scale = albedoToneScale(palette.weathered);
  const gain = (a) => a.map((x) => Math.min(1, x * scale));
  const out = {};
  for (const k of Object.keys(palette)) out[k] = gain(palette[k]);
  const extra = opts?.extra;
  if (extra) for (const k of Object.keys(extra)) out[k] = gain(extra[k]);
  return out;
}
