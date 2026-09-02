// tests/river-bake-host.test.js — docs/WORKSTREAMS/wire-river-router-lab-into-game/ (AC-0 … AC-3, AC-7).
import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import { readFileSync, writeFileSync } from 'node:fs';
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
// ⭐ TASK 3 (2026-09-02) — AC-1's imports. The fluvial derivation left world-engine-lab.html:2123-2167
// for a driver pack, so AC-1's subject is now a module both front-ends call rather than a block only
// the lab could run.
import { tmpdir } from 'node:os';
import { StarSystemGenerator } from '../src/generation/StarSystemGenerator.js';
import { conditionFromBody } from '../src/worldengine/port/conditionFromBody.js';
import { compositionClass } from '../src/worldengine/base/e1Regime.js';
import { labPackCtx, labMacroSeed, setLabGasBodiesOverride } from '../src/objects/Planet.js';
import { applyDriverPacks } from '../src/worldengine/drivers/index.js';
import { buildLabPlanetMaterial } from '../src/rendering/LabPlanetMaterial.js';
import { fluvialClassOf, fluvialDeckPack } from '../src/worldengine/drivers/fluvialDeck.js';

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

// ══════════════════════════════════════════════════════════════════════════════════════════════
// AC-1 — every solid body the world engine renders gets the fluvial family from its condition, by
// the lab's own derivation; gas bodies get none. Before this workstream all ten uniforms held their
// factory default on every game body (src/worldengine/shaders/uniforms.js:311 uFluvialDensity 0,
// :334 uSeaLevel -1, :338 uCoastStrength 0, :343 uOutflowDensity 0).
//
// ⚠ THIS BLOCK DRIVES THE REAL COMPOSITION POINT, not the pack in isolation: `applyDriverPacks` onto
// a material built by `buildLabPlanetMaterial`, with the ctx the GAME passes (`labPackCtx`). The
// pack's own laws are gated to the last bit in tests/driver-pack-fluvialdeck.test.js §C; what is
// asserted here is that the game's condition reaches the derivation unmangled and the values land on
// the material.
//
// ⭐⭐ THE RELICT ARM IS LIVE ON REAL BODIES, AND IT WAS NOT UNTIL THE EROSION KEY WAS FIXED. The lab's
// block reads a raw `.erosion` (world-engine-lab.html:2128) while the game writes `erosionLevel`
// (PhysicsEngine.js:832) — the third reader ROOT-0 fix 1 (B1, 2026-08-20) missed. The pack IS that
// reader now and carries the fix, so the corpus splits 4 wet / 64 relict / 56 airless where the raw
// read gave 4 / 0 / 120 and this arm could only be driven on a hand-built condition.
// tests/driver-pack-fluvialdeck.test.js §F pins the reader and reds on a single-spelling regression.
// ══════════════════════════════════════════════════════════════════════════════════════════════
const SEEDS = Array.from({ length: 24 }, (_, i) => `rocky-${i}`);
function corpus() {
  const out = [];
  for (const seed of SEEDS) {
    const sys = StarSystemGenerator.generate(seed, null);
    for (const e of sys.planets) {
      // ⚠ A planet in `sys.planets` is an ENTRY wrapping `planetData` — pass the entry and every
      // provenance-keyed read is wrong (handoff 2026-09-01b trap 1).
      out.push({ seed, kind: 'planet', d: e.planetData || e });
      for (const m of (e.moons || [])) out.push({ seed, kind: m.isPlanetMoon ? 'planet-moon' : 'moon', d: m });
    }
  }
  for (const b of out) b.cond = conditionFromBody(b.d);
  return out;
}
let RIVER_BODIES = null;
const bodyOf = (b) => ({ condition: b.cond, macroSeed: labMacroSeed(b.d), T_eq: b.cond.T_eq });
beforeAll(() => { setLabGasBodiesOverride(true); RIVER_BODIES = corpus(); });

describe('AC-1 — the fluvial family reaches every solid body from its condition, and no gas body', () => {
  const clamp01 = (x) => Math.max(0, Math.min(1, x));
  const ss = (e0, e1, x) => { const t = clamp01((x - e0) / (e1 - e0)); return t * t * (3 - 2 * t); };
  const composed = (b) => {
    const material = buildLabPlanetMaterial({ bodyRadius: b.d.radius ?? 1 }).material;
    const res = applyDriverPacks(material, b.cond, labPackCtx(b.d, b.cond, null));
    return { u: material.uniforms, res };
  };

  it('every solid body is classed wet / relict / airless and the counts are RECORDED', () => {
    const counts = { wet: 0, relict: 0, airless: 0 };
    let solid = 0, gas = 0;
    for (const b of RIVER_BODIES) {
      if (compositionClass(b.cond) === 'gas') { gas++; continue; }
      solid++; counts[fluvialClassOf(b.cond)]++;
    }
    expect(solid).toBe(124);
    expect(gas).toBe(32);
    expect(counts.wet + counts.relict + counts.airless).toBe(124);
    expect(counts).toEqual({ wet: 4, relict: 64, airless: 56 });
    // ⛔ THE RELICT CLASS MUST BE NON-EMPTY, stated on its own line rather than left inside the triple:
    // it was 0 before the erosion key was fixed, and a regression there would put it back to 0 while
    // every other arm in this file stayed green.
    expect(counts.relict, 'the relict class is empty — the erosion reader regressed (see §F)').toBeGreaterThan(0);
    // vitest hides console.info on a passing test, so the AC-1 record goes to a FILE.
    writeFileSync(join(process.env.TMPDIR || tmpdir(), 'river-corpus.json'), JSON.stringify({
      seeds: SEEDS.length, bodies: RIVER_BODIES.length, solid, gas, classes: counts,
      note: 'measured WITH ROOT-0 fix 1 two-spelling erosion read; the raw single-spelling lab line gave 4 / 0 / 120 — see driver-pack-fluvialdeck.test.js §F',
    }, null, 2));
  });

  it('WET bodies carry a live sea: uSeaLevel !== -1, uLiquidMask > 0, uCoastStrength 1', () => {
    let n = 0;
    for (const b of RIVER_BODIES) {
      if (compositionClass(b.cond) === 'gas' || fluvialClassOf(b.cond) !== 'wet') continue;
      const { u, res } = composed(b);
      expect(res.applied, `${b.seed}/${b.kind}`).toContain('fluvialDeck');
      expect(u.uSeaLevel.value, `${b.seed}/${b.kind}`).not.toBe(-1);
      expect(u.uLiquidMask.value, `${b.seed}/${b.kind}`).toBeGreaterThan(0);
      expect(u.uCoastStrength.value, `${b.seed}/${b.kind}`).toBe(1);
      expect(u.uDeltaDensity.value, `${b.seed}/${b.kind}`).toBeGreaterThan(0);
      expect(u.uFluvialActivity.value, `${b.seed}/${b.kind}`).toBe(1);
      // ⛔ AND THE DENSITY UNIFORM STAYS 0 — the lab pins it every frame (:5518, the retired
      // worm-trail). The density travels as meta; asserted so the pack cannot quietly start writing it.
      expect(u.uFluvialDensity.value, `${b.seed}/${b.kind}`).toBe(0);
      expect(fluvialDeckPack(b.cond, { displayRadiusEarth: 1, gates: { deltas: true, coast: true, outflow: true } }).meta.fluvialDensity)
        .toBeGreaterThan(0);
      n++;
    }
    expect(n, 'the corpus must contain wet bodies or this arm is vacuous').toBe(4);
  });

  it('AIRLESS bodies have every MASTER off — and the two ungated terms that are not zero are inert', () => {
    // ⛔ THE ASSERTION IS ON THE MASTERS, AND THAT IS THE LAB'S STRUCTURE RATHER THAN A LOOSENING.
    // Each family's shader pass early-outs on its own master — uCoastStrength, uOutflowDensity,
    // uDeltaDensity and uSeaLevel === -1 (src/worldengine/shaders/uniforms.js:334-343) — so those four
    // being off deletes F12, F13, F14 and F20 byte-identically on this class.
    // ⚠ MEASURED 2026-09-02, AND IT CORRECTED THE FIRST DRAFT OF THIS TEST: `uFluvialActivity` and
    // `uStrandStrength` are NON-ZERO on all 56 airless bodies. Both are `clamp01(erosion)` in the lab's
    // own block (world-engine-lab.html:2136 and :2157) with NO atmosphere gate on them, and since the
    // erosion key was fixed an airless body carries a real erosion. They are inert — F20's strandlines
    // sit behind uCoastStrength 0, and F11's activity does nothing with uFluvialDensity pinned to 0 and
    // uOutflowDensity 0 — but they are NOT zero, and asserting that they were would have been asserting
    // a law the lab does not have.
    let n = 0, morphologyLive = 0;
    for (const b of RIVER_BODIES) {
      if (compositionClass(b.cond) === 'gas' || fluvialClassOf(b.cond) !== 'airless') continue;
      const { u, res } = composed(b);
      expect(res.applied, `${b.seed}/${b.kind}`).toContain('fluvialDeck');
      expect(u.uSeaLevel.value, `${b.seed}/${b.kind}`).toBe(-1);
      expect(u.uLiquidMask.value, `${b.seed}/${b.kind}`).toBe(0);
      expect(u.uCoastStrength.value, `${b.seed}/${b.kind}`).toBe(0);
      expect(u.uDeltaDensity.value, `${b.seed}/${b.kind}`).toBe(0);
      expect(u.uOutflowDensity.value, `${b.seed}/${b.kind}`).toBe(0);
      // an airless body is airless BECAUSE it held no atmosphere — the class's own definition, driven
      expect(fluvialDeckPack(b.cond, { displayRadiusEarth: 1, gates: { deltas: true, coast: true, outflow: true } }).meta.hadLiquid,
        `${b.seed}/${b.kind}`).toBe(false);
      if (u.uStrandStrength.value > 0 && u.uFluvialActivity.value > 0) morphologyLive++;
      n++;
    }
    expect(n).toBe(56);
    expect(morphologyLive, 'the two ungated clamp01(erosion) terms — recorded, not asserted as right').toBe(56);
  });

  it('RELICT bodies take the lab’s 0.30→0.45 outflow ramp and no sea — over the REAL corpus', () => {
    // ⭐ DRIVEN ON THE 64 GENERATED BODIES, not on a fixture. Each body's own erosion is read back off
    // the pack's meta and the ramp recomputed here from the lab's constants, so the assertion is the
    // AC's — "relict bodies carry uOutflowDensity by the lab's 0.30→0.45 erosion ramp and
    // fluvialDensity = 0.4·erosion" — evaluated on the population it is about.
    const packCtx = { displayRadiusEarth: 1, gates: { deltas: true, coast: true, outflow: true } };
    let n = 0, ramped = 0;
    for (const b of RIVER_BODIES) {
      if (compositionClass(b.cond) === 'gas' || fluvialClassOf(b.cond) !== 'relict') continue;
      const { u, res } = composed(b);
      const meta = fluvialDeckPack(b.cond, packCtx).meta;
      expect(res.applied, `${b.seed}/${b.kind}`).toContain('fluvialDeck');
      expect(meta.erosion, `${b.seed}/${b.kind}`).toBeGreaterThan(0);
      expect(u.uOutflowDensity.value, `${b.seed}/${b.kind}`).toBe(ss(0.3, 0.45, meta.erosion));
      expect(u.uStrandStrength.value, `${b.seed}/${b.kind}`).toBe(clamp01(meta.erosion));
      expect(meta.fluvialDensity, `${b.seed}/${b.kind}`).toBe(0.4 * clamp01(meta.erosion));
      // …and a relict body holds NO standing sea: the lab's F14 gate is `_wet`, which it is not.
      expect(u.uSeaLevel.value, `${b.seed}/${b.kind}`).toBe(-1);
      expect(u.uCoastStrength.value, `${b.seed}/${b.kind}`).toBe(0);
      expect(u.uLiquidMask.value, `${b.seed}/${b.kind}`).toBe(0);
      if (u.uOutflowDensity.value > 0) ramped++;
      n++;
    }
    expect(n, 'the relict class must be populated — see the block header').toBe(64);
    // NON-VACUITY, with the honest number rather than the hoped-for one. All 64 clear the ramp's 0.30
    // foot — MEASURED erosion range on this class is 0.325 … 1.0 — so `ramped` is 64, not a subset.
    // ⚠ AND THE RAMP SATURATES: 60 of the 64 sit at exactly 1.0 because their erosion is at or above
    // 0.45, so this population carries TWO distinct outflow values rather than a spread. The lab's
    // stated intent for F13 is that megafloods are "SINGULAR catastrophic events … RARER"
    // (world-engine-lab.html:2158-2162); on the game's erosion distribution the 0.30→0.45 window is
    // too low to deliver that. Recorded here rather than silently re-tuned — the window is the lab's
    // number and re-choosing it is a rendering decision, not a wiring one.
    expect(ramped).toBe(64);
    const outflowValues = new Set();
    for (const b of RIVER_BODIES) {
      if (compositionClass(b.cond) === 'gas' || fluvialClassOf(b.cond) !== 'relict') continue;
      outflowValues.add(composed(b).u.uOutflowDensity.value);
    }
    expect(outflowValues.size, 'a single value would mean the ramp is a constant on this population').toBe(2);
    expect(outflowValues.has(1)).toBe(true);
    expect(ss(0.3, 0.45, 0.2)).toBe(0);
    expect(ss(0.3, 0.45, 0.35)).toBeGreaterThan(0);
    expect(ss(0.3, 0.45, 0.5)).toBe(1);
  });

  it('GAS bodies get NONE of it: fluvialDeck is skipped and the material keeps its −1', () => {
    let n = 0;
    for (const b of RIVER_BODIES) {
      if (compositionClass(b.cond) !== 'gas') continue;
      const { u, res } = composed(b);
      expect(res.skipped, `${b.seed}/${b.kind}`).toContain('fluvialDeck');
      expect(res.applied, `${b.seed}/${b.kind}`).not.toContain('fluvialDeck');
      expect(u.uSeaLevel.value, `${b.seed}/${b.kind}`).toBe(-1);
      expect(u.uLiquidMask.value, `${b.seed}/${b.kind}`).toBe(0);
      n++;
    }
    expect(n).toBe(32);
  });

  it('the derivation is the pack’s, reached through the composition point — the ctx is the GAME’s', () => {
    // The seam AC-1 names: "the game's condition reaches the derivation unmangled". Driven by
    // comparing the composed material against the pack called directly on the same condition, with
    // the gate map the registry supplies rather than one written here.
    const wet = RIVER_BODIES.find((b) => compositionClass(b.cond) !== 'gas' && fluvialClassOf(b.cond) === 'wet');
    const direct = fluvialDeckPack(wet.cond, { ...labPackCtx(wet.d, wet.cond, null), gates: { deltas: true, coast: true, outflow: true } });
    const { u } = composed(wet);
    expect(u.uSeaLevel.value).toBe(direct.drivers.uSeaLevel);
    expect(u.uLiquidMask.value).toBe(direct.drivers.uLiquidMask);
    expect(u.uFluvialDepth.value).toBe(direct.drivers.uFluvialDepth);
    expect(u.uFluvialMeander.value).toBe(direct.drivers.uFluvialMeander);
    expect(bodyOf(wet).condition).toBe(wet.cond);
  });
});
