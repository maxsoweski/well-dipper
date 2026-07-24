// Radius display-scale — DISPLAY-ONLY fence (AC-ZERO-CLOBBER) + AC-LOD-KEY source pins.
// Workstream: world-engine-radius-display-scale-2026-07-24.
//
// The feature's hard invariant: sVis / visScaleOf / VIS_SCALE_EXP is a DISPLAY term
// only. It must NEVER appear in any procgen / height-GLSL / schedule / worldengine /
// featureFrequencyFromKm / headless-golden surface. This suite codifies the denylist
// grep the task runs by hand, and pins the four LOD-keying call sites in the lab source.
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => readFileSync(join(ROOT, rel), 'utf8');

// The three tokens that carry the display scale. \bsVis\b so it can't match e.g. a
// substring; the pure-fn names are distinctive enough to match plainly.
const DENY = /visScaleOf|\bsVis\b|VIS_SCALE_EXP/;

// Recursively collect every .js under a dir (worldengine is deeper than base/).
function jsFilesUnder(rel) {
  const out = [];
  const walk = (d) => {
    for (const ent of readdirSync(join(ROOT, d), { withFileTypes: true })) {
      const child = `${d}/${ent.name}`;
      if (ent.isDirectory()) walk(child);
      else if (ent.name.endsWith('.js')) out.push(child);
    }
  };
  walk(rel);
  return out;
}

describe('AC-ZERO-CLOBBER — display-only fence (procgen surfaces are sVis-free)', () => {
  // NB: planet-lod-lab-core.js is DELIBERATELY excluded — it DEFINES the exports, so
  // it legitimately contains the tokens. The fence is that no PROCGEN surface consumes them.
  const procgenSurfaces = [
    'planet-lod-height.glsl.js',
    'planet-lod-river-amplifier.glsl.js',
    'tests/golden-trajectories/run-golden.mjs',
    'tests/golden-trajectories/canonical-scenario.js',
  ];

  for (const rel of procgenSurfaces) {
    it(`${rel} contains no display-scale token`, () => {
      expect(read(rel)).not.toMatch(DENY);
    });
  }

  it('every src/worldengine/**/*.js is free of the display-scale token', () => {
    const files = jsFilesUnder('src/worldengine');
    expect(files.length).toBeGreaterThan(20);   // sanity: we actually walked the tree
    const offenders = files.filter((f) => DENY.test(read(f)));
    expect(offenders).toEqual([]);
  });
});

describe('AC-ZERO-CLOBBER — the lab GLSL regions are sVis-free (breach only allowed in JS wiring)', () => {
  // Extract every /* glsl */ `…` template-literal body from the lab. sVis IS present in
  // the lab's JS frame loop (that's the display wiring); the fence is that it never
  // reaches a shader string. Interpolations (${…}) are captured too, so injecting sVis
  // INTO a shader via interpolation would also fail this.
  function extractGlslRegions(src) {
    const regions = [];
    const marker = '/* glsl */';
    let i = 0;
    while ((i = src.indexOf(marker, i)) !== -1) {
      let j = src.indexOf('`', i + marker.length);
      if (j === -1) break;
      // scan to the matching closing backtick (these GLSL templates have no nested
      // backticks, so the next unescaped backtick closes the literal).
      let k = j + 1;
      while (k < src.length) {
        if (src[k] === '\\') { k += 2; continue; }
        if (src[k] === '`') break;
        k++;
      }
      regions.push(src.slice(j + 1, k));
      i = k + 1;
    }
    return regions;
  }

  it('finds the lab shader blocks and none contains a display-scale token', () => {
    const lab = read('planet-lod-lab.html');
    const regions = extractGlslRegions(lab);
    expect(regions.length).toBeGreaterThanOrEqual(8);   // the 8 /* glsl */ blocks
    const offending = regions.filter((r) => DENY.test(r));
    expect(offending).toEqual([]);
  });

  it('never passes sVis to featureFrequencyFromKm (procgen frequency stays on real radius)', () => {
    const lab = read('planet-lod-lab.html');
    // no featureFrequencyFromKm(...) call whose argument list mentions sVis
    expect(lab).not.toMatch(/featureFrequencyFromKm\([^)]*sVis/);
  });

  it('never feeds sVis into the planet height uniform bundle (only the ring-cloud display material)', () => {
    const lab = read('planet-lod-lab.html');
    // The ONLY uniform writes touching sVis are the ring cloud's own material (a
    // separate display shader). Assert the planet `uniforms.` bundle never takes sVis.
    const planetUniformWithSvis = /(?<!ringCloud\.material\.)uniforms\.\w+\.value\s*=\s*[^;]*\bsVis\b/;
    expect(lab).not.toMatch(planetUniformWithSvis);
  });
});

describe('AC-LOD-KEY — the four lab call sites key on logical distance (source pins)', () => {
  const lab = read('planet-lod-lab.html');
  it('defines logicalDist = state.distance / sVis', () => {
    expect(lab).toMatch(/const\s+logicalDist\s*=\s*state\.distance\s*\/\s*sVis/);
  });
  it('lodRampOf keys on logicalDist', () => {
    expect(lab).toMatch(/lodRampOf\(\s*logicalDist\s*\)/);
  });
  it('lodHysteresis keys on logicalDist', () => {
    expect(lab).toMatch(/lodHysteresis\(\s*logicalDist\s*,/);
  });
  it('autoOctaves re-keys transitively via lod (lodRampOf output)', () => {
    expect(lab).toMatch(/autoOctaves\(\s*lod\s*\)/);
  });
});

describe('AC-0 — sVis derivation reads ONLY state.planetRadiusEarth (spine conformance)', () => {
  const lab = read('planet-lod-lab.html');
  it('the sVis assignment takes exactly planetRadiusEarth (no label/archetype/regime read)', () => {
    expect(lab).toMatch(/sVis\s*=\s*visScaleOf\(\s*state\.planetRadiusEarth\s*\)/);
  });
  it('visScaleOf is never called on a label / archetype / regime field', () => {
    expect(lab).not.toMatch(/visScaleOf\([^)]*\.(label|archetype|regime|rendersOn)/);
  });
});
