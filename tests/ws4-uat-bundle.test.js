// tests/ws4-uat-bundle.test.js — WS4 T18: the UAT bundle surfaces Max's walkthrough binds to.
//
// AC: landscape-with-history (UAT — deferred-to-max, NO agent closes it).
//
// T18 is a LIVE walkthrough whose PASS is Max's eye alone (the verify-workstream workflow marks it
// `deferred-to-max`, never PASS). What IS headless-assertable — and what this gate pins — is that the
// `window._lab` surface exposes a COHERENT, deterministic UAT bundle so the :9223 walkthrough is
// reproducible rather than ad-hoc:
//   - the STRENGTH DIAL          → _lab.grainStrength(s)   (grain OFF=0 ↔ ON=1, the A/B the eye judges)
//   - the EPOCH TOGGLE           → _lab.setCarveEpoch(on)  (uncut relief ↔ drainage carved into it)
//   - a DETERMINISTIC seed control → _lab.setSeed(macro[,detail])  (so "a couple of seeds" reproduce
//     the SAME worlds every run — the GUI "New planet" button uses Math.random and cannot, plan T18
//     asks for specific seeds)
//   - the read-out PROBES        → _lab.grainProbe / _lab.sampleRoutedHeight (so the coherence + carve
//     reads are numeric, not "does the screenshot LOOK aligned/cut?" — they back the same judgement)
//
// WHY a SOURCE-SCAN, not a runtime call: these are page-scoped JS inside planet-lod-lab.html — no DOM,
// no WebGL renderer, no live overlay headless. So vitest asserts the bundle EXISTS on _lab with the
// documented wiring; the "ON reads as a coherent tectonic system + drainage cut into it" judgement is
// the LIVE-only smoke on :9223 (verify phase), listed under liveDeferred, NEVER faked here.
//
// HARD RULE: no Date.now / Math.random in derivation. setSeed takes an INTEGER seed and threads it
// through the seeded updateSeedUniforms()/route() path — it must NOT introduce Math.random/Date.now
// (that would make the "same seed → same world" reproducibility the UAT bundle promises a lie).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const labSrc = readFileSync(path.resolve(__dirname, '../planet-lod-lab.html'), 'utf8');

// Pull a single JS function/method body out of the lab source by walking matched braces from the
// first `{` after `marker`, so per-control assertions don't bleed into neighbouring methods.
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

describe('WS4 T18 — UAT bundle for Max (landscape-with-history, deferred-to-max)', () => {
  it('exposes the STRENGTH DIAL (grainStrength) — the grain OFF↔ON A/B the eye judges', () => {
    // grain ON/OFF is the core of the UAT read ("ranges/scarps/canyons share a grain… not random
    // scatter"). The dial is the branch-guarded gate the combiners read (0 = byte-identical fallback).
    expect(labSrc).toMatch(/grainStrength\s*\(\s*s\s*\)\s*\{/);
    const body = bodyAfter(labSrc, 'grainStrength(s)');
    expect(body).toMatch(/uTectonicGrainStrength/);
  });

  it('exposes the EPOCH TOGGLE (setCarveEpoch) — uncut relief ↔ drainage carved into THAT relief', () => {
    // The second half of the UAT read ("AND drainage has cut into that relief"). The toggle gates the
    // carve epoch so Max sees the SAME built world with/without the drainage incision.
    expect(labSrc).toMatch(/setCarveEpoch\s*\(\s*on\s*\)\s*\{/);
    const body = bodyAfter(labSrc, 'setCarveEpoch(on)');
    expect(body).toMatch(/_carveEpochOn/);
  });

  it('exposes a DETERMINISTIC seed control (setSeed) so "a couple of seeds" reproduce the SAME worlds', () => {
    // Plan T18 asks for "a couple of seeds". The GUI "New planet" button uses Math.random and cannot
    // reproduce a specific world; setSeed takes an INTEGER macroSeed (+ optional detailSeed) and threads
    // it through the seeded updateSeedUniforms()/route() path, so the walkthrough lands on the SAME
    // worlds every run — and the grain co-orients with gProvince (D9: state.macroSeed feeds both).
    expect(labSrc).toMatch(/setSeed\s*\(\s*macro\s*(?:,\s*detail\s*)?\)\s*\{/);
    const body = bodyAfter(labSrc, 'setSeed(macro');
    // writes the integer macroSeed into state (the seed that feeds uMacroOffset + the grain bake).
    expect(body).toMatch(/state\.macroSeed\s*=/);
    // re-propagates through the existing seeded path (updateSeedUniforms → debounced route → re-bake),
    // NOT a bespoke re-implementation, so the seed change re-routes + re-bakes exactly like a GUI reroll.
    expect(body).toMatch(/updateSeedUniforms\s*\(/);
  });

  it('the seed control is DETERMINISTIC — no Math.random / Date.now (same seed → same world)', () => {
    // The reproducibility the UAT bundle promises is a lie if setSeed injects entropy. The integer seed
    // is the ONLY source of variation; setSeed must thread it without sprinkling rng / wall-clock.
    const body = bodyAfter(labSrc, 'setSeed(macro');
    expect(body, 'setSeed must not call Math.random').not.toMatch(/Math\.random/);
    expect(body, 'setSeed must not call Date.now').not.toMatch(/Date\.now/);
  });

  it('bundles the read-out PROBES so the coherence + carve reads are NUMERIC, not just visual', () => {
    // The UAT eye is the gate, but the probes back the judgement: grainProbe shows all six features
    // share one strike (one-shared-grain), sampleRoutedHeight shows valley floors genuinely lower
    // (epoch-carve-visible) — so "looks coherent/cut" is corroborated by the numbers, not faked by a
    // zonal field that merely looks aligned or by cosmetic floor-darkening.
    expect(labSrc).toMatch(/grainProbe\s*\(/);
    expect(labSrc).toMatch(/sampleRoutedHeight\s*\(\s*dirs\s*\)/);
  });
});
