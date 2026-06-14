// lab-render-audit.js
// Pure render-audit (Tier-2 Phase 2.5 Task 7). Compares the manifest's declared
// render matrix (rendersOn) against the live A/B-delta matrix the GPU sweep
// measures, and returns the violations. No GPU, no DOM — the sweep produces the
// numbers; this judges them, so the judgment is unit-tested headless.

// expectedMatrix: feature -> preset -> bool (should this feature render here?)
export function expectedMatrix(manifest, presets) {
  const m = {};
  for (const [feature, a] of Object.entries(manifest)) {
    m[feature] = {};
    for (const p of presets) m[feature][p] = (a.rendersOn || []).includes(p);
  }
  return m;
}

// auditRenderMatrix(expected, actualDeltas, {eps}) -> { falseRenders, deadRenders }
//   expected:     feature -> preset -> bool   (from expectedMatrix)
//   actualDeltas: feature -> preset -> number (measured ON/OFF summed-abs pixel delta)
//   falseRender:  preset ∉ rendersOn but delta > eps  → paints pixels it shouldn't ⚠️
//   deadRender:   preset ∈ rendersOn but delta ≤ eps  → claims to render, inert ⚠️
export function auditRenderMatrix(expected, actualDeltas, { eps = 0.01 } = {}) {
  const falseRenders = [], deadRenders = [];
  for (const feature of Object.keys(expected)) {
    for (const preset of Object.keys(expected[feature])) {
      const should = expected[feature][preset];
      const delta = (actualDeltas[feature] || {})[preset] ?? 0;
      if (!should && delta > eps) falseRenders.push({ feature, preset, delta });
      if (should && delta <= eps) deadRenders.push({ feature, preset, delta });
    }
  }
  return { falseRenders, deadRenders };
}
