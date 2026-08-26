// lab-render-status.js
// Pure, DOM-free status-mapping for the render-audit surface (Ask 4 of the lab
// menu/info overhaul). The SINGLE source of the tier thresholds + the glyph map,
// imported by BOTH the in-GUI badge (world-engine-lab.html) and the offline report
// generator (scripts/gen-render-audit.mjs) so the live surface and the report can
// never drift apart. No GPU, no DOM — unit-tested headless.

// Tier thresholds, locked to the offline report:
//   eps    = render/inert boundary (frame-fraction; ≈14px of ≈141k, floor is 0)
//   STRONG = false-render above this is "solid", below is "faint trace"
// NOTE: these are applied to the sweep's returned `delta` FRACTION, never to the
// per-pixel `perPixelThresh = 12/255` gate (a different layer).
export const EPS = 1e-4;
export const STRONG = 5e-4;

// statusOf(should, delta, degenerate) -> the offline report's exact glyph string.
//   should:     boolean — does this feature's rendersOn include the current preset?
//   delta:      number  — the sweep's frame-fraction for this feature on this preset
//   degenerate: null | 'black' | 'blown' — the sweep's degenerate flag for the ON frame
//
// ⬛-degenerate-WINS precedence (spec lock #3): a degenerate ON frame makes the delta
// classification meaningless, so the single in-GUI badge shows ⬛ regardless of tier.
// Mirrors gen-render-audit.mjs glyph() for the non-degenerate cases (it uses strict
// `> eps` / `> STRONG`); degenerates are this module's extra slot the report lacks.
export function statusOf(should, delta, degenerate) {
  if (degenerate != null) return '⬛';        // mechanical failure on the ON frame — wins
  const renders = delta > EPS;
  if (should && renders)  return '✅';
  if (should && !renders) return '⚠️D';       // dead-render: declared, inert
  if (!should && renders) return (delta > STRONG ? '🔴F' : '⚠️F');   // strong / faint false-render
  return '·';                                  // correctly inert
}
