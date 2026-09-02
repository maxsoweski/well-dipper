// tests/river-bake-host.test.js — docs/WORKSTREAMS/wire-river-router-lab-into-game/ (AC-0 … AC-3, AC-7).
import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  routeAndOrder as routeViaLab, buildRibbonGeometry as ribbonViaLab, buildValleyGeometry as valleyViaLab,
  compositeMargins as compositeViaLab, computeAdjGradient as gradViaLab, computeOcean as oceanViaLab,
  paramsForRadius as paramsViaLab, widthSeedFactor as widthSeedViaLab, DEFAULT_PARAMS as PARAMS_VIA_LAB,
} from '../planet-lod-rivers.js';
import { solveSeaLevel as seaViaLab } from '../planet-lod-sealevel.js';
import {
  routeAndOrder, compositeMargins, computeAdjGradient, computeOcean, paramsForRadius, widthSeedFactor, DEFAULT_PARAMS,
} from '../src/worldengine/rivers/router.js';
import { buildRibbonGeometry, buildValleyGeometry } from '../src/worldengine/rivers/ribbon.js';
import { solveSeaLevel } from '../src/worldengine/rivers/seaLevel.js';
// ⭐ TASK 2 (2026-09-02) — the two GPU bakers followed the router core out, to src/rendering/bake/
// (GPU-coupled ⇒ that directory, per carried C25 and the provinceCube.js precedent). Same import-back
// shape as above: the root modules keep their old import paths by re-exporting the SAME objects.
import { createCarveCubeMap as carveViaLab } from '../planet-lod-rivers.js';
import { createHeightCube as heightCubeViaLab, bakeHeightCube as bakeHeightViaLab, buildHeightCubeGeometry as heightGeoViaLab, RELIEF_CUBE_SIZE as RELIEF_VIA_LAB } from '../planet-lod-tectonic.js';
import { createCarveCubeMap } from '../src/rendering/bake/carveCube.js';
import { createHeightCube, bakeHeightCube, buildHeightCubeGeometry, RELIEF_CUBE_SIZE } from '../src/rendering/bake/heightCube.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => readFileSync(join(ROOT, rel), 'utf8');

describe('AC-0 — one pipeline: the router core is defined once, under src/, and re-exported by the root modules', () => {
  const FILES = ['src/worldengine/rivers/router.js', 'src/worldengine/rivers/ribbon.js', 'src/worldengine/rivers/seaLevel.js',
    'planet-lod-rivers.js', 'planet-lod-sealevel.js', 'planet-lod-tectonic.js'];
  it('each moved router symbol is DEFINED exactly once, in its src/ module', () => {
    const all = FILES.map((p) => [p, read(p)]);
    const defs = (re) => all.filter(([, t]) => re.test(t)).map(([p]) => p);
    expect(defs(/^export const DEFAULT_PARAMS\b/m)).toEqual(['src/worldengine/rivers/router.js']);
    expect(defs(/^export function computeAdjGradient\(/m)).toEqual(['src/worldengine/rivers/router.js']);
    expect(defs(/^export function compositeMargins\(/m)).toEqual(['src/worldengine/rivers/router.js']);
    expect(defs(/^export function paramsForRadius\(/m)).toEqual(['src/worldengine/rivers/router.js']);
    expect(defs(/^export function computeOcean\(/m)).toEqual(['src/worldengine/rivers/router.js']);
    expect(defs(/^export function routeAndOrder\(/m)).toEqual(['src/worldengine/rivers/router.js']);
    expect(defs(/^export function buildRibbonGeometry\(/m)).toEqual(['src/worldengine/rivers/ribbon.js']);
    expect(defs(/^export function buildValleyGeometry\(/m)).toEqual(['src/worldengine/rivers/ribbon.js']);
    expect(defs(/^export function solveSeaLevel\(/m)).toEqual(['src/worldengine/rivers/seaLevel.js']);
  });
  it('the root modules import the moved code BACK and re-export the SAME function objects', () => {
    expect(routeViaLab).toBe(routeAndOrder);
    expect(ribbonViaLab).toBe(buildRibbonGeometry);
    expect(valleyViaLab).toBe(buildValleyGeometry);
    expect(compositeViaLab).toBe(compositeMargins);
    expect(gradViaLab).toBe(computeAdjGradient);
    expect(oceanViaLab).toBe(computeOcean);
    expect(paramsViaLab).toBe(paramsForRadius);
    expect(widthSeedViaLab).toBe(widthSeedFactor);
    expect(PARAMS_VIA_LAB).toBe(DEFAULT_PARAMS);
    expect(seaViaLab).toBe(solveSeaLevel);
    expect(DEFAULT_PARAMS.TARGET_N).toBe(40000);
    expect(DEFAULT_PARAMS.CARVE_CUBE_SIZE).toBe(1024);
    expect(DEFAULT_PARAMS.TARGET_OCEAN_FRACTION).toBe(0.35);
  });

  it('the two GPU bakers are DEFINED exactly once under src/rendering/bake/ and re-exported by the root modules', () => {
    const files = ['src/rendering/bake/carveCube.js', 'src/rendering/bake/heightCube.js', 'planet-lod-rivers.js', 'planet-lod-tectonic.js'].map((p) => [p, read(p)]);
    const defs = (re) => files.filter(([, t]) => re.test(t)).map(([p]) => p);
    expect(defs(/^export function createCarveCubeMap\(/m)).toEqual(['src/rendering/bake/carveCube.js']);
    expect(defs(/^export function createHeightCube\(/m)).toEqual(['src/rendering/bake/heightCube.js']);
    expect(defs(/^export function bakeHeightCube\(/m)).toEqual(['src/rendering/bake/heightCube.js']);
    expect(defs(/^export function buildHeightCubeGeometry\(/m)).toEqual(['src/rendering/bake/heightCube.js']);
    expect(defs(/^export const RELIEF_CUBE_SIZE\b/m)).toEqual(['src/rendering/bake/heightCube.js']);
    expect(carveViaLab).toBe(createCarveCubeMap);
    expect(heightCubeViaLab).toBe(createHeightCube);
    expect(bakeHeightViaLab).toBe(bakeHeightCube);
    expect(heightGeoViaLab).toBe(buildHeightCubeGeometry);
    expect(RELIEF_VIA_LAB).toBe(RELIEF_CUBE_SIZE);
    expect(RELIEF_CUBE_SIZE).toBe(256);
  });
});

describe('AC-0 (determinism) — the moved router core + GPU bakers introduce NO Math.random / Date.now', () => {
  // ⚠ THIS IS RE-POINTED COVERAGE, NOT NEW POLICY, and the gap it closes was made by the move itself.
  // tests/relief-router-repoint.test.js:101-105 asserts exactly this over planet-lod-rivers.js. Before
  // 2026-09-02 that file was 1478 lines and its subject INCLUDED routeAndOrder, compositeMargins,
  // computeOcean, widthSeedFactor, buildRibbonGeometry and buildValleyGeometry. The move left it at 827,
  // so ~44% of that guard's subject walked out from under it, and nothing picked the remainder up: every
  // no-RNG suite over src/worldengine/** names ONE module by path, and the only new-module coverage was
  // tests/relief-height-cube.test.js, which slices computeAdjGradient alone. The three headers declare
  // "no RNG / no Date.now" as a DELIBERATE NON-GOAL (router.js, ribbon.js, seaLevel.js) with nothing
  // enforcing it. This is the SAME assertion as :101-105, following the code to where the code went.
  //
  // ⛔ stripComments IS REQUIRED, NOT OPTIONAL. It is character-for-character the helper at
  // relief-router-repoint.test.js:48, kept identical on purpose so the two halves of one guard cannot
  // drift. The reason is measured, not assumed: each new module's header states the non-goal in PROSE,
  // so all three raw files DO contain the literal string `Date.now` — a naive whole-file
  // `not.toMatch(/Date\.now/)` reds on the very sentence promising the property. The
  // `the raw text really does carry the token` control below pins that, so nobody later "simplifies"
  // the strip away and reds the suite for the wrong reason.
  const stripComments = (src) => src
    .replace(/\/\*[\s\S]*?\*\//g, ' ')       // block comments
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1');   // line comments (avoid eating http:// — keep the char before //)

  // [path, a declaration that must survive the strip, the measured stripped-length floor]. The anchor is
  // the NON-VACUITY probe: it is the same discipline as the swappable-uplift liveness probe — a strip
  // that returned '' (or a path typo) would sail through both not.toMatch assertions while reading
  // nothing at all.
  //
  // ⭐ TASK 2 (2026-09-02) added the two GPU bakers, which followed the router core out of the root
  // modules in the same workstream and arrived with the SAME unenforced non-goal in their headers.
  // Their floors are MEASURED, not inherited: stripped 1970 (carveCube) and 3067 (heightCube) chars,
  // against 14138 / 9610 / 1132 for the router trio — so each carries its own bound rather than reusing
  // the trio's 800, which for a 3067-char module would be a floor it could lose 74% of and still clear.
  // The 0.3 ratio bound below is shared because it is measured to hold for all five (lowest is 0.352,
  // heightCube — its header is long relative to a 122-line move).
  const MODULES = [
    ['src/worldengine/rivers/router.js', 'export function routeAndOrder(', 800],
    ['src/worldengine/rivers/ribbon.js', 'export function buildValleyGeometry(', 800],
    ['src/worldengine/rivers/seaLevel.js', 'export function solveSeaLevel(', 800],
    ['src/rendering/bake/carveCube.js', 'export function createCarveCubeMap(', 1000],
    ['src/rendering/bake/heightCube.js', 'export function bakeHeightCube(', 1500],
  ];

  for (const [rel, anchor, minChars] of MODULES) {
    it(`${rel} calls neither Math.random nor Date.now`, () => {
      const raw = read(rel);
      const code = stripComments(raw);
      // NON-VACUITY, both halves. Length class: the strip must leave a substantial module standing —
      // measured 2026-09-02 at 14138 / 9610 / 1132 / 1970 / 3067 stripped chars, i.e. 35-65% of raw, so
      // each bound survives losing a third of its file. Anchor: the code it is supposed to be reading is
      // in there.
      expect(code.length, `${rel}: the comment strip returned almost nothing — it is broken, not the module`)
        .toBeGreaterThan(minChars);
      expect(code.length / raw.length, `${rel}: the strip ate the code, not just the comments`)
        .toBeGreaterThan(0.3);
      expect(code, `${rel}: the scan is not reading the module it names`).toContain(anchor);
      expect(code, `${rel} must not call Math.random`).not.toMatch(/Math\.random/);
      expect(code, `${rel} must not call Date.now`).not.toMatch(/Date\.now/);
    });
  }

  it('CONTROL: the raw text really does carry the token — which is WHY the strip is mandatory', () => {
    // Pins the reason for stripComments so it is not read as ceremony and deleted. Each header states
    // the non-goal in prose; that prose is a literal `Date.now` occurrence in the file.
    for (const [rel] of MODULES) {
      expect(read(rel), `${rel}'s header should still state the no-Date.now non-goal in prose`)
        .toMatch(/Date\.now/);
      expect(stripComments(read(rel)), `${rel}: the strip must remove that prose occurrence`)
        .not.toMatch(/Date\.now/);
    }
  });

  it('CONTROL: the scan CAN fail — a planted call in each module is caught', () => {
    // A gate that has never failed is not a gate. Planted IN MEMORY, never written to disk, so the
    // working tree stays clean on every run including a failing one (the src-boundary-fence idiom).
    for (const [rel] of MODULES) {
      const planted = stripComments(read(rel) + '\nconst _t = Date.now(), _r = Math.random();\n');
      expect(planted, `${rel}: a planted Date.now must be seen`).toMatch(/Date\.now/);
      expect(planted, `${rel}: a planted Math.random must be seen`).toMatch(/Math\.random/);
    }
  });
});
