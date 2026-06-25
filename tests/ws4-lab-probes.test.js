// tests/ws4-lab-probes.test.js — WS4 T12-probe: the live read-out surfaces the live ACs bind to.
//
// AC: enables epoch-carve-visible (T12), one-shared-grain (T13), grain-zero-identical (T5/T13).
//
// THE PROBLEM (dossier risk #13 / critic test-validity HIGH ×2): `window._lab` exposes
// state/uniforms/riverStats/sceneTarget but NO per-direction height read-back and NO per-feature
// strike read-out. Without them the live ACs degrade to "does the screenshot LOOK aligned/cut?" —
// which passes on a zonal banded field that merely looks aligned, or on the cosmetic floor-darkening
// (lab Stage 6 carveFloorCol) with no real height drop. T12-probe budgets the two missing surfaces:
//   (1) _lab.sampleRoutedHeight(dirs) → the routed-substrate height (the ROUTER_MAIN field the carve
//       is computed over, planet-lod-rivers.js createHeightSampler) at the requested directions, so
//       epoch-carve-visible can assert a NUMERIC decrease at channel dirs (not a color screenshot).
//   (2) _lab.grainProbe() / _lab.probeStrike(featureKey, dir) → each grained combiner's EFFECTIVE
//       sampled strike, re-derived from the SAME shared field the cube holds (bakeTectonicGrain, the
//       pure no-rng deriver), blended per-feature exactly like the shader branch
//       (normalize(mix(uXxxAxis, sharedStrike, strength))). So one-shared-grain can set strength=1 and
//       confirm ALL SIX strikes move together (all read the shared field), and at strength=0 NONE move
//       (each runs its own pre-WS4 axis) — distinguishing "all read the cube" from "all happen to
//       point similar directions".
//
// WHY a SOURCE-SCAN, not a runtime call: the probes are page-scoped JS inside planet-lod-lab.html;
// they cannot be imported/executed headless (no DOM, no WebGL renderer, no live overlay). So this
// vitest gate asserts the probe functions EXIST on the _lab surface with the documented shape +
// wiring (re-derive via the pure bakeTectonicGrain, blend like the shader, nearest-node lookup). The
// "both probes return finite data on a built relief" check is the LIVE-only smoke on :9223 (verify
// phase) — listed under liveDeferred, never faked here.
//
// HARD RULE: no Date.now / Math.random in derivation. The grain probe re-derives via bakeTectonicGrain
// (pure, macroSeed-only entropy) — we assert it does NOT introduce Math.random/Date.now.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const labSrc = readFileSync(path.resolve(__dirname, '../planet-lod-lab.html'), 'utf8');

// Pull a single JS function/method body out of the lab source by walking matched braces from the
// first `{` after `marker`, so per-probe assertions don't bleed into neighbouring methods.
function bodyAfter(src, marker) {
  const start = src.indexOf(marker);
  expect(start, `"${marker}" must be present in planet-lod-lab.html`).toBeGreaterThanOrEqual(0);
  const open = src.indexOf('{', start);
  let depth = 0, i = open;
  for (; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') { depth--; if (depth === 0) { i++; break; } }
  }
  return src.slice(start, i);
}

describe('WS4 T12-probe — live read-out surfaces on window._lab', () => {
  it('imports the pure grain deriver (bakeTectonicGrain) so grainProbe matches the BAKED cube field', () => {
    // grainProbe must report the SAME strike field the cube holds. The faithful source is the pure
    // deriver the bake host itself runs (planet-lod-tectonic.js bakeTectonicGrain) — re-deriving it in
    // the lab with the same (mesh, drivers, macroSeed) is byte-identical to what was baked (no rng).
    expect(labSrc).toMatch(/import\s*\{[^}]*\bbakeTectonicGrain\b[^}]*\}\s*from\s*['"]\.\/planet-lod-tectonic\.js['"]/);
    // DEFAULT_GRAIN_DRIVERS is the neutral E6 bundle the overlay bakes with (rivers.js route default);
    // the probe must derive with the SAME drivers or it points at a different field than the cube.
    expect(labSrc).toMatch(/import\s*\{[^}]*\bDEFAULT_GRAIN_DRIVERS\b[^}]*\}\s*from\s*['"]\.\/planet-lod-rivers\.js['"]/);
  });

  it('_lab.sampleRoutedHeight(dirs) exists and reads the ROUTED-substrate height at given directions', () => {
    expect(labSrc).toMatch(/sampleRoutedHeight\s*\(\s*dirs\s*\)\s*\{/);
    const body = bodyAfter(labSrc, 'sampleRoutedHeight(dirs)');
    // It must read the overlay's per-node routed height (the ROUTER_MAIN field, NOT a rendered-chain
    // sample — honest per D5c). The overlay exposes `height` (last sampler.read()) + `mesh.verts`;
    // the body aliases `const ov = riverOverlay;` then reads ov.height / ov.mesh.verts.
    expect(body).toMatch(/=\s*riverOverlay\b/);
    expect(body).toMatch(/\bov\.height\b/);
    expect(body).toMatch(/\bov\.mesh\b/);
    // nearest-node lookup: each requested dir maps to the mesh node of MAX dot product (the vertex the
    // direction points at), and returns THAT node's routed height.
    expect(body).toMatch(/dot/i);
    // returns a per-direction numeric array (one height per requested direction).
    expect(body).toMatch(/return\b/);
  });

  it('_lab.grainProbe() exists and re-derives the SHARED strike field via bakeTectonicGrain', () => {
    // grainProbe takes an OPTIONAL probe direction (defaults to +X) so the live AC can probe any face.
    expect(labSrc).toMatch(/grainProbe\s*\(\s*\w*\s*\)\s*\{/);
    const body = bodyAfter(labSrc, 'grainProbe(');
    // grainProbe itself reports the live gate + macroSeed identity + delegates to probeStrike for each
    // grained feature. It re-derives the shared field through the _sharedStrikeAt helper (asserted next).
    expect(body).toMatch(/uTectonicGrainStrength/);
    expect(body).toMatch(/state\.macroSeed/);
    expect(body).toMatch(/probeStrike/);
  });

  it('the shared-strike re-derivation (_sharedStrikeAt) runs the SAME pure bake the cube did', () => {
    // The faithful source for the read-out is bakeTectonicGrain over the overlay mesh with the SAME
    // neutral DEFAULT_GRAIN_DRIVERS + state.macroSeed the bake used (D9: state.macroSeed feeds both
    // uMacroOffset and the grain bake), so the probe points at the EXACT field the cube holds (no rng).
    expect(labSrc).toMatch(/_sharedStrikeAt\s*\(\s*dir\s*\)\s*\{/);
    const body = bodyAfter(labSrc, '_sharedStrikeAt(dir){');
    expect(body).toMatch(/bakeTectonicGrain\s*\(/);
    expect(body).toMatch(/DEFAULT_GRAIN_DRIVERS/);
    expect(body).toMatch(/state\.macroSeed/);
    // the world-strike read uses the SAME nearest-mesh-node lookup as sampleRoutedHeight.
    expect(body).toMatch(/dot/i);
    expect(body).toMatch(/strikeWorldX/);
  });

  it('_lab.probeStrike(featureKey, dir) blends the feature axis toward the shared strike like the SHADER', () => {
    expect(labSrc).toMatch(/probeStrike\s*\(\s*featureKey\s*,\s*dir\s*\)\s*\{/);
    const body = bodyAfter(labSrc, 'probeStrike(featureKey, dir)');
    // the effective strike must mirror the branch-guarded combiner: strength>0 ? mix(axis, shared,
    // strength) : axis. So at strength 0 it returns the feature's OWN axis (decorrelated), at strength
    // 1 the shared strike (all six identical) — the exact distinction one-shared-grain needs.
    expect(body).toMatch(/uTectonicGrainStrength/);
    // a mix/lerp toward the shared strike weighted by strength (THREE Vector3.lerp or an explicit mix).
    expect(body).toMatch(/lerp|mix/);
    // it must reference the per-feature axis uniforms so each feature blends from its OWN endpoint.
    expect(body).toMatch(/uOrogenyAxis|uScarpAxis|uChasmaAxis|uTesseraAxis|uLavaAxis|uCryoRidgeAxis/);
  });

  it('grainProbe covers ALL SIX grained features (orogeny, chasma, scarp, tessera, lava, cryo)', () => {
    // one-shared-grain fails if even one grained feature keeps an independent axis. The probe must
    // enumerate every grained feature so a reroll/wiring leak on any one is observable.
    const body = bodyAfter(labSrc, 'grainProbe(');
    for (const key of ['orogeny', 'chasma', 'scarp', 'tessera', 'lava', 'cryo']) {
      expect(body, `grainProbe must report the "${key}" feature strike`).toMatch(new RegExp(key, 'i'));
    }
  });

  it('the probe derivation introduces NO Math.random / Date.now (entropy = macroSeed only)', () => {
    // Scan the two probe bodies — the grain read-out must stay deterministic (HARD RULE). The shared
    // field comes from bakeTectonicGrain (pure); the probes must not sprinkle rng of their own.
    const gp = bodyAfter(labSrc, 'grainProbe(');
    const ps = bodyAfter(labSrc, 'probeStrike(featureKey, dir)');
    const srh = bodyAfter(labSrc, 'sampleRoutedHeight(dirs)');
    const ssa = bodyAfter(labSrc, '_sharedStrikeAt(dir){');
    for (const [name, b] of [['grainProbe', gp], ['probeStrike', ps], ['sampleRoutedHeight', srh], ['_sharedStrikeAt', ssa]]) {
      expect(b, `${name} must not call Math.random`).not.toMatch(/Math\.random/);
      expect(b, `${name} must not call Date.now`).not.toMatch(/Date\.now/);
    }
  });
});
