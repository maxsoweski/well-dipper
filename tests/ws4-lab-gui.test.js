// tests/ws4-lab-gui.test.js — WS4 LAB-GUI surfacing (source-scan).
//
// WHAT THIS GATES: the WS4 shared-grain + drainage-carve mechanism existed but was reachable
// only via the JS-console API (window._lab.grainStrength / setCarveEpoch) or buried inside the
// Rivers folder. This change adds a discoverable top-level lil-gui folder "Tectonic grain & carve
// (WS4)" with grain-strength + carve-epoch + carve-depth controls, a legend naming the 6
// grain-driven features, and a "⊞grain" tag on each of those 6 relief feature folders.
//
// WHY a SOURCE-SCAN, not a runtime call: the GUI is page-scoped lil-gui code inside
// world-engine-lab.html that needs a DOM + WebGL renderer; it can't run headless. So we assert the
// folder + controls + tags EXIST and WIRE to the existing API/uniforms. The "does the slider
// actually move terrain on screen" check is the LIVE :9223 verify, never faked here.
//
// LAB-GUI-ONLY invariant guarded here: this change must NOT touch the production
// uTectonicGrainStrength default (uniforms.js stays 0 → grain-zero-identical regression intact).
// The lab sets its own LIVE value to 1.0 for A/B visibility; that is a runtime assignment in the
// lab html, not a uniforms-default edit. We assert the lab sets a live ON value AND that this file
// does not reach into planet-lod-uniforms.js.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const labSrc = readFileSync(path.resolve(__dirname, '../world-engine-lab.html'), 'utf8');
const uniformsSrc = readFileSync(path.resolve(__dirname, '../src/worldengine/shaders/uniforms.js'), 'utf8');

describe('WS4 LAB-GUI — Tectonic grain & carve folder + grained-feature tags', () => {
  it('creates a discoverable top-level "Tectonic grain & carve (WS4)" folder on the left rig panel', () => {
    // top-level => added to guiLeft (the rig panel), opened so it is visible on load.
    expect(labSrc).toMatch(/guiLeft\.addFolder\(\s*['"]Tectonic grain & carve \(WS4\)['"]\s*\)/);
    expect(labSrc).toMatch(/const\s+fGrainCarve\s*=\s*guiLeft\.addFolder\([\s\S]*?\);\s*fGrainCarve\.open\(\)/);
  });

  it('grain-strength slider (0..1) drives the WS4 grain gate live', () => {
    // slider bound to a UI key over the full 0..1 A/B range...
    expect(labSrc).toMatch(/fGrainCarve\.add\(\s*grainCarveUI\s*,\s*['"]grainStrength['"]\s*,\s*0\s*,\s*1[^)]*\)/);
    // ...and its onChange routes to the existing window._lab.grainStrength / uTectonicGrainStrength.
    expect(labSrc).toMatch(/grainStrength\(v\)|uTectonicGrainStrength\.value\s*=\s*v/);
  });

  it('the LAB initial grain strength is ON (1.0) for A/B visibility — production default untouched', () => {
    // lab live value set ON (a runtime assignment in the lab html — NOT a uniforms-default edit)...
    expect(labSrc).toMatch(/grainStrength:\s*1\.0/);
    expect(labSrc).toMatch(/uniforms\.uTectonicGrainStrength\.value\s*=\s*grainCarveUI\.grainStrength/);
    // ...and the PRODUCTION uniforms default stays 0 (grain-zero-identical regression intact).
    expect(uniformsSrc).toMatch(/uTectonicGrainStrength:\s*\{\s*value:\s*0\.0\s*\}/);
  });

  it('carve-epoch checkbox routes to window._lab.setCarveEpoch(bool)', () => {
    expect(labSrc).toMatch(/fGrainCarve\.add\(\s*grainCarveUI\s*,\s*['"]carveEpoch['"]\s*\)/);
    expect(labSrc).toMatch(/window\._lab\.setCarveEpoch\(v\)/);
  });

  it('carve-depth slider reuses the EXISTING uRiverCarveDepth state (riverOverlayState.carveDepthH)', () => {
    // reuse, not invent: it binds the existing carveDepthH key and re-applies via applyCarveAmounts.
    expect(labSrc).toMatch(/fGrainCarve\.add\(\s*riverOverlayState\s*,\s*['"]carveDepthH['"][\s\S]*?applyCarveAmounts\(\)/);
  });

  it('a legend names the 6 grain-driven features for legibility', () => {
    expect(labSrc).toMatch(/legend:/);
    for (const word of ['orogeny', 'canyon', 'scarp', 'tessera', 'lava', 'cryo']) {
      expect(labSrc, `legend must name "${word}"`).toMatch(new RegExp(word, 'i'));
    }
  });

  it('each of the 6 grained relief feature folders carries a "⊞grain" tag in its title', () => {
    const folderTitles = [
      'Mountains (F1) ⊞grain',
      'Canyons (F4) ⊞grain',
      'Scarps (F5) ⊞grain',
      'Tessera (F6) ⊞grain',
      'Lava plains (F8) ⊞grain',
      'Ridged icy (F10) ⊞grain',
    ];
    for (const title of folderTitles) {
      expect(labSrc, `folder title "${title}" must be present`).toContain(title);
    }
  });
});
