// tests/river-bake-host.test.js — docs/WORKSTREAMS/wire-river-router-lab-into-game/ (AC-0 … AC-3, AC-7).
import { describe, it, expect, beforeAll, afterEach, vi } from 'vitest';
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
// ⭐ TASK 4 (2026-09-02) — AC-2/AC-3's imports. `buildLabBundleForBody` is the CPU half of the whole
// route() bundle (province + relief + crater + carve + ribbon), and the worker below carries it in one
// message. The LAB side of every comparison comes through `../planet-lod-rivers.js` (aliased `…ViaLab`
// above), so AC-2 compares the game's bundle against route()'s own sequence re-read through the lab's
// import path rather than against a second copy of it living in this file.
import { buildLabBundleForBody, sharedCarrierMesh, bodyDriversFromCondition, provinceFractions } from '../src/rendering/bake/provinceDispatch.js';
import { makeSphereField } from '../src/worldengine/base/sphereField.js';
import { buildIrregularSphere } from '../src/worldengine/mesh/sphereMesh.js';
import { writeBodyRelief as writeBodyReliefViaLab, DEFAULT_GRAIN_DRIVERS as GRAIN_VIA_LAB } from '../planet-lod-rivers.js';
import { bakeReliefCrossover, visScaleOf } from '../src/worldengine/base/labCore.js';
// ⭐ TASK 5 (2026-09-02) — AC-7's imports. The host grew from the province cube's to the whole lab
// bake: four cubes, the ribbon child, the sea override and two more A/B keys. `attachProvinceBake` /
// `disposeProvinceBake` stay exported as ALIASES of the two new names, so tests/province-bake-host.test.js
// keeps passing byte-unchanged — the province path is a strict subset of this one, not a second one.
import * as THREE from 'three';
import {
  attachLabBake, disposeLabBake, provinceRecordOf, toggleRiversAB, toggleReliefAB,
  attachProvinceBake, disposeProvinceBake,
} from '../src/rendering/bake/labBakeHost.js';
import { PROVINCE_CUBE_SIZE, buildProvinceCubeGeometry } from '../src/rendering/bake/provinceCube.js';
import { bodyRadiusOf } from '../src/rendering/LabPlanetMaterial.js';

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
// reader now and carries the fix, so the corpus splits 2 wet / 66 relict / 56 airless where the raw
// read gave 2 / 0 / 122 and this arm could only be driven on a hand-built condition.
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
      for (const m of (e.moons || [])) out.push({ seed, kind: m.isPlanetMoon ? 'planet-moon' : 'moon', d: m.isPlanetMoon ? { ...m.planetData, _systemSeed: m._systemSeed, _ordinal: `pm-${m._ordinal}` } : m });   // ⛔ a PLANET-CLASS moon is an ENTRY wrapping planetData too (trap 3; found by the 2026-09-02 live check): read through the wrapper its T_eq defaults to 288 K and it classes wet. The game mounts the INNER record with the provenance stamps copied on (src/main.js:7757 `_systemSeed: systemData.seed, _ordinal: `pm-${moonData._ordinal}``) — mirrored here, minus the render-only fields
    }
  }
  for (const b of out) b.cond = conditionFromBody(b.d);
  return out;
}
let RIVER_BODIES = null;
// ⭐ TASK 4 added `radiusEarth` — the bundle's fourth input. It feeds TWO different laws and neither
// is optional: `bakeReliefCrossover(visScaleOf(radiusEarth))` (the display crossover, intent.md
// decision 2) and `paramsForRadius` (the ribbon/valley width law, AC6). The `?? b.d.radiusEarth ?? 1`
// tail mirrors labPackCtx (Planet.js:2256) and is DEAD over this corpus — measured 2026-09-02, all 124
// solid bodies carry a finite `cond.radiusEarth` (0 missing, 0 non-finite) — but it is the same read
// the game's own pack context makes, and writing a shorter one here would be a second policy.
const bodyOf = (b) => ({ condition: b.cond, macroSeed: labMacroSeed(b.d), T_eq: b.cond.T_eq,
  radiusEarth: b.cond.radiusEarth ?? b.d.radiusEarth ?? 1 });
beforeAll(() => { setLabGasBodiesOverride(true); RIVER_BODIES = corpus(); });

// ── the AC-7 record ──────────────────────────────────────────────────────────────────────────────
// vitest hides `console.info` on a passing test, so every measured number in this file goes to ONE
// file instead. ⚠ MERGE, NEVER OVERWRITE: AC-1's block already writes `river-corpus.json` (the class
// split), and a second plain `writeFileSync` would silently delete it — which is exactly the failure
// mode of two tests recording to one path. Missing / unparseable file ⇒ start from {}.
const CORPUS_RECORD = join(process.env.TMPDIR || tmpdir(), 'river-corpus.json');
function recordCorpus(patch) {
  let prior = {};
  try { prior = JSON.parse(readFileSync(CORPUS_RECORD, 'utf8')); } catch (_) { prior = {}; }
  writeFileSync(CORPUS_RECORD, JSON.stringify({ ...prior, ...patch }, null, 2));
}

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
    expect(counts).toEqual({ wet: 2, relict: 66, airless: 56 });
    // ⛔ THE RELICT CLASS MUST BE NON-EMPTY, stated on its own line rather than left inside the triple:
    // it was 0 before the erosion key was fixed, and a regression there would put it back to 0 while
    // every other arm in this file stayed green.
    expect(counts.relict, 'the relict class is empty — the erosion reader regressed (see §F)').toBeGreaterThan(0);
    // vitest hides console.info on a passing test, so the AC-1 record goes to a FILE.
    writeFileSync(join(process.env.TMPDIR || tmpdir(), 'river-corpus.json'), JSON.stringify({
      seeds: SEEDS.length, bodies: RIVER_BODIES.length, solid, gas, classes: counts,
      note: 'measured WITH ROOT-0 fix 1 two-spelling erosion read; the raw single-spelling lab line gave 2 / 0 / 122 — see driver-pack-fluvialdeck.test.js §F',
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
    expect(n, 'the corpus must contain wet bodies or this arm is vacuous').toBe(2);
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
    // ⭐ DRIVEN ON THE 66 GENERATED BODIES, not on a fixture. Each body's own erosion is read back off
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
    expect(n, 'the relict class must be populated — see the block header').toBe(66);
    // NON-VACUITY, with the honest number rather than the hoped-for one. All 64 clear the ramp's 0.30
    // foot — MEASURED erosion range on this class is 0.325 … 1.0 — so `ramped` is 64, not a subset.
    // ⚠ AND THE RAMP SATURATES: 60 of the 64 sit at exactly 1.0 because their erosion is at or above
    // 0.45, so this population carries TWO distinct outflow values rather than a spread. The lab's
    // stated intent for F13 is that megafloods are "SINGULAR catastrophic events … RARER"
    // (world-engine-lab.html:2158-2162); on the game's erosion distribution the 0.30→0.45 window is
    // too low to deliver that. Recorded here rather than silently re-tuned — the window is the lab's
    // number and re-choosing it is a rendering decision, not a wiring one.
    expect(ramped).toBe(66);
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

// ══════════════════════════════════════════════════════════════════════════════════════════════
// AC-2 — the game's river bundle IS the lab's `route()`, run over the same carrier.
//
// ⭐ WHAT MAKES THIS NON-CIRCULAR. `buildLabBundleForBody` and the block below both end up calling
// the same nine functions, so comparing them would be worthless if the SEQUENCE were also shared.
// It is not: `labRoute()` here is an INDEPENDENT transcription of `createRiverOverlay.route()`
// (planet-lod-rivers.js:602-700, at 885f4fc) — its own carrier, its own mesh instance, its own
// ordering — reached through `../planet-lod-rivers.js`, the lab's import path. What is under test is
// that the game re-runs the lab's STEPS (composite → gradient → sea → ocean → route → ribbon →
// valley), in the lab's order, with the lab's argument asymmetry, and gets the same bytes. A wiring
// commit's characteristic failure is re-deriving one of those steps on the way through.
//
// ⛔ THE ARGUMENT ASYMMETRY IS THE LAB'S AND IS ASSERTED, NOT ASSUMED: `routeAndOrder` takes the BASE
// params while `buildRibbonGeometry` / `buildValleyGeometry` take `pEff` (radius- and seed-scaled
// widths). route() does exactly that at :690-696 — routing/topology is radius-invariant, only the
// width law scales — and a bundle that passed `pEff` to the router would still look plausible.
//
// ⚠ TWO BODIES, BECAUSE `compositeMargins` HAS TWO ARMS AND ONE OF THEM IS NEARLY EMPTY. Measured
// 2026-09-02 over the 24-seed corpus at 2500 nodes: of the 68 ROUTED bodies exactly ONE (rocky-3's
// planet, relict, R=0.304) has a non-null composite; the other 67 — including all four wet bodies —
// return null and route on `carrier.height` untouched. Testing only a wet body would leave the
// `composited ? …` arm, the crater overlay and the whole `marginHeight !== carrier.height` path
// unexercised, and an all-zero crater buffer would make AC-3's crater comparison vacuous too.
// ══════════════════════════════════════════════════════════════════════════════════════════════

/** Byte view of a typed array — `byteOffset`-correct, because an attribute array can be a view. */
const bytes = (a) => Buffer.from(a.buffer, a.byteOffset, a.byteLength);

/** The lab's `ensureMesh()` (planet-lod-rivers.js:582-585), transcribed. The router's two geometry
 *  builders read `mesh.pos` / `mesh.N`, which `buildIrregularSphere` does not set. */
const labEnsureMesh = (mesh) => {
  const N = mesh.verts.length;
  const pos = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) { pos[i * 3] = mesh.verts[i][0]; pos[i * 3 + 1] = mesh.verts[i][1]; pos[i * 3 + 2] = mesh.verts[i][2]; }
  mesh.pos = pos; mesh.N = N;
  return mesh;
};

// ── driving provinceWorker.js headless ───────────────────────────────────────────────────────────
// The worker module is written for a Worker global scope: it assigns `self.onmessage` at import and
// calls `self.postMessage` inside the handler. So the stub must be `globalThis.self` BOTH when the
// module evaluates AND when the handler runs, and it must be the SAME object — ESM caches the module,
// so the handler is bound to whichever `self` existed at the first import and a fresh stub per test
// would leave the second one with no handler at all. Installed around each drive and removed after,
// so a stray global `self` never leaks into the rest of the suite (three checks `typeof self`).
const WORKER_STUB = { postMessage(m, t) { WORKER_POSTS.push({ m, t }); } };
const WORKER_POSTS = [];
let _workerHandler = null;
async function driveWorker(data) {
  WORKER_POSTS.length = 0;
  const prev = Object.getOwnPropertyDescriptor(globalThis, 'self');
  Object.defineProperty(globalThis, 'self', { value: WORKER_STUB, configurable: true, writable: true });
  try {
    if (!_workerHandler) { await import('../src/rendering/bake/provinceWorker.js'); _workerHandler = WORKER_STUB.onmessage; }
    expect(typeof _workerHandler, 'provinceWorker.js did not install an onmessage handler').toBe('function');
    _workerHandler({ data });
  } finally {
    if (prev) Object.defineProperty(globalThis, 'self', prev); else delete globalThis.self;
  }
  return WORKER_POSTS.slice();
}

/** The corpus-loop carrier. Small on purpose: the class fractions and the routing invariants this
 *  file gates are mesh-independent, and 40000/4 × 124 bodies is minutes, not seconds. The three
 *  TIMED bodies below run on the real `sharedCarrierMesh()`. */
const small = () => buildIrregularSphere(2500, 2);

/**
 * `createRiverOverlay.route()` (planet-lod-rivers.js:602-700 at 885f4fc), transcribed — the
 * production arm only: `seaMode 'histogram'`, `labLidOverride` null, `bakedOn` true (the game routes
 * on the carrier; there is no in-shader sampler off the main thread). Every symbol comes from the
 * lab's own module.
 */
function labRoute(b, mesh) {
  const macroSeed = labMacroSeed(b.d) | 0;
  const carrier = makeSphereField(mesh);
  const relief = writeBodyReliefViaLab(carrier, {
    archetype: null, locked: false, grainDrivers: GRAIN_VIA_LAB, bodyDrivers: bodyDriversFromCondition(b.cond),
    macroSeed, heightSeed: 'e6:' + macroSeed, T_eq: b.cond.T_eq,
  });
  const reliefGrad = gradViaLab(carrier);                                   // :670
  const craterOverlay = new Float32Array(carrier.height.length);            // :679
  const composited = compositeViaLab(carrier, relief.reliefBudget, craterOverlay);  // :680
  const marginHeight = composited || carrier.height;                        // :681
  const marginGrad = composited ? gradViaLab(carrier, composited) : reliefGrad;     // :682
  const height = marginHeight, grad = marginGrad;                           // :691 (bakedOn arm)
  const seaLevel = seaViaLab(height, PARAMS_VIA_LAB.TARGET_OCEAN_FRACTION); // :697
  const { isOcean, oceanCount } = oceanViaLab(height, seaLevel, carrier.N); // :698
  const pEff = paramsViaLab(PARAMS_VIA_LAB, b.cond.radiusEarth, widthSeedViaLab(macroSeed, PARAMS_VIA_LAB));  // :702-703
  const routed = routeViaLab({ mesh, height, grad, isOcean, params: PARAMS_VIA_LAB });   // :704 — BASE params
  const ribGeo = ribbonViaLab({ mesh, routed, params: pEff });              // :706 — pEff
  const valleyGeo = valleyViaLab({ mesh, routed, isOcean, params: pEff });  // :709 — pEff
  const craterGrad = gradViaLab(carrier, craterOverlay);                    // :735
  return { carrier, relief, composited, marginHeight, marginGrad, craterOverlay, craterGrad,
    seaLevel, isOcean, oceanCount, routed, ribGeo, valleyGeo, pEff };
}

describe('AC-2 — the game\'s bundle IS the lab\'s route on the same carrier', () => {
  const pick = (fn) => { const b = RIVER_BODIES.find(fn); expect(b, 'the corpus lost the body this case is about').toBeTruthy(); return b; };
  const CASES = [
    ['a WET body — compositeMargins returns null, so the router reads carrier.height (67 of 68 routed bodies)',
      () => pick((x) => compositionClass(x.cond) !== 'gas' && fluvialClassOf(x.cond) === 'wet'), false],
    ['the ONE routed body whose margins DO composite (rocky-3\'s planet, relict) — the other arm',
      () => pick((x) => x.seed === 'rocky-3' && x.kind === 'planet'), true],
  ];

  for (const [label, get, wantComposite] of CASES) {
    it(`byte-identical to route()'s own sequence, called through the root import path — ${label}`, () => {
      const b = get();
      const mGame = small(), mLab = labEnsureMesh(small());   // two INSTANCES; buildIrregularSphere is deterministic
      const got = buildLabBundleForBody(bodyOf(b), mGame);
      const want = labRoute(b, mLab);

      // the bundle must have done ensureMesh's job itself — the shared carrier mesh has no pos/N
      expect(mGame.N).toBe(mGame.verts.length);
      expect(bytes(mGame.pos)).toEqual(bytes(mLab.pos));

      // NON-VACUITY: this case is about the arm it says it is about
      expect(!!want.composited, `${b.seed}/${b.kind}: the composite arm this case exists to cover moved`).toBe(wantComposite);
      expect(got.routed).toBe(true);

      // the composite + gradient half (the DISPLAY surface — AC-3's subject too)
      expect(bytes(got.marginHeight)).toEqual(bytes(want.marginHeight));
      expect(bytes(got.marginGrad)).toEqual(bytes(want.marginGrad));
      expect(bytes(got.craterOverlay)).toEqual(bytes(want.craterOverlay));
      expect(bytes(got.craterGrad)).toEqual(bytes(want.craterGrad));
      // ⭐ and the gradient the game computes on the null-composite arm really is route()'s
      // `reliefGrad` — the bundle spells it `computeAdjGradient(carrier)` where route() reuses the
      // variable it already had, which is only equivalent because the function is pure.
      expect(bytes(got.marginGrad)).toEqual(bytes(want.composited ? want.marginGrad : gradViaLab(want.carrier)));

      // the sea + ocean half
      expect(got.seaLevel).toBe(want.seaLevel);
      expect(got.oceanCount).toBe(want.oceanCount);
      expect(bytes(got.isOcean)).toEqual(bytes(want.isOcean));

      // the routed graph
      expect(bytes(got.routedGraph.receiver)).toEqual(bytes(want.routed.receiver));
      expect(bytes(got.routedGraph.strahler)).toEqual(bytes(want.routed.strahler));
      expect(bytes(got.routedGraph.accum)).toEqual(bytes(want.routed.accum));
      expect(bytes(got.routedGraph.isChannel)).toEqual(bytes(want.routed.isChannel));
      expect(got.routedGraph.maxOrder).toBe(want.routed.maxOrder);
      expect(got.routedGraph.channelCount).toBe(want.routed.channelCount);

      // the two geometries. ⛔ THE RIBBON IS THE WET HALF ONLY as of the final review (2026-09-02,
      // ruling #11): the bundle builds it for `wet` alone, because `bindRiverHalf` parents it on
      // `wet` alone. On the relict case the assertion is therefore its ABSENCE — and the LAB's own
      // route() still builds one on the same body, which is the DECLARED difference between the two
      // front-ends rather than a drift: the lab routes one body behind a global toggle, the game
      // classes every body. The valley footprint is unaffected and stays byte-compared on both arms.
      const isWet = fluvialClassOf(b.cond) === 'wet';
      if (isWet) {
        for (const attr of ['position', 'color']) {
          expect(bytes(got.ribbonGeo.getAttribute(attr).array), `ribbon.${attr}`).toEqual(bytes(want.ribGeo.getAttribute(attr).array));
        }
        expect(bytes(got.ribbonGeo.getIndex().array)).toEqual(bytes(want.ribGeo.getIndex().array));
      } else {
        expect(got.ribbonGeo, 'a relict body builds no ribbon — nothing parents, binds or draws it').toBeUndefined();
        expect(want.ribGeo, 'the LAB still builds one here; that difference is declared, not drifted').toBeTruthy();
      }
      for (const attr of ['position', 'aDepth', 'aMouth', 'aOrder']) {
        expect(bytes(got.valleyGeo.getAttribute(attr).array), `valley.${attr}`).toEqual(bytes(want.valleyGeo.getAttribute(attr).array));
      }
      expect(bytes(got.valleyGeo.getIndex().array)).toEqual(bytes(want.valleyGeo.getIndex().array));

      // ⛔ THE ASYMMETRY, AND ONLY HALF OF IT IS DETECTABLE — SAID PLAINLY SO THE CONTROL BELOW IS
      // NOT READ AS COVERING BOTH. `pEff` really does differ from the base params on this body (the
      // radius factor and the seeded draw scale WIDTH_SCALE), but routing is radius- and
      // seed-INVARIANT BY DESIGN (AC6 + UAT item1, route()'s own comment at :700-701), so a router
      // handed pEff returns the identical graph — recorded here, not gated. The half that IS
      // detectable is the other one: a ribbon built on the BASE params has different widths, so a
      // bundle that forgot pEff would red.
      expect(want.pEff).not.toBe(PARAMS_VIA_LAB);
      expect(want.pEff.WIDTH_SCALE).not.toBe(PARAMS_VIA_LAB.WIDTH_SCALE);
      const pEffRouted = routeViaLab({ mesh: mLab, height: want.marginHeight, grad: want.marginGrad, isOcean: want.isOcean, params: want.pEff });
      expect(bytes(pEffRouted.isChannel), 'AC6 says routing is width-invariant — RECORDED').toEqual(bytes(got.routedGraph.isChannel));
      if (isWet) {
        const baseRib = ribbonViaLab({ mesh: mLab, routed: want.routed, params: PARAMS_VIA_LAB });
        expect(bytes(baseRib.getAttribute('position').array),
          'the ribbon must be built with pEff — base params give a different width').not.toEqual(bytes(got.ribbonGeo.getAttribute('position').array));
      }
    }, 120000);
  }

  it('over the corpus: 68 bodies route with 0 orphans / 0 uphill receivers and every channel drains to the sea; 56 airless bodies are not routed', () => {
    const mesh = small();
    let routed = 0, notRouted = 0, composited = 0, orphan = 0, uphill = 0, selfLoopLand = 0, badDrain = 0, mouths = 0;
    let oceanFracMin = 1, oceanFracMax = 0;
    // ⭐ E1 (verify-workstream verdict, 2026-09-02) — AC-2's observable ends "max Strahler order and
    // R_b recorded" and NEITHER was written anywhere. Both come off the routed graph itself: `maxOrder`
    // and `bifurcationRatio`, which is where planet-lod-rivers.js `buildStats` (:504) reads them from
    // too — buildStats does not COMPUTE R_b, `routeAndOrder` does (src/worldengine/rivers/router.js
    // :416-431: the log-linear fit exp(−slope) over `streamCount` by order, falling back to the
    // trimmed mean of consecutive ratios when fewer than two orders are populated). So this records
    // the same two fields the lab's own stats bundle names, under the same names.
    // ⛔ A RECORDING WITH A SANITY FLOOR, NOT A TOLERANCE: R_b's real-world band (Horton 3–5) is a
    // property of the DRAINAGE LAW, not of this wire, and gating on it here would put a landform
    // judgement inside a wiring suite. Finite and > 1 is the floor that says "the network branches at
    // all" — R_b ≤ 1 would mean a body whose streams do not merge.
    const wetNetworks = [];
    const routedPerSystem = {}, solidPerSystem = {};
    for (const b of RIVER_BODIES) {
      if (compositionClass(b.cond) === 'gas') continue;
      const got = buildLabBundleForBody(bodyOf(b), mesh);
      expect(got.fluvialClass, `${b.seed}/${b.kind}`).toBe(fluvialClassOf(b.cond));
      solidPerSystem[b.seed] = (solidPerSystem[b.seed] || 0) + 1;
      // the relief + crater arrays ride on EVERY solid body, routed or not (intent.md decision 2)
      expect(got.marginHeight.length).toBe(mesh.verts.length);
      expect(got.marginGrad.length).toBe(mesh.verts.length * 3);
      expect(got.craterOverlay.length).toBe(mesh.verts.length);
      expect(got.craterGrad.length).toBe(mesh.verts.length * 3);
      if (got.fluvialClass === 'airless') {
        notRouted++;
        // ⛔ airless bodies get NO route: every consumer of it is zero by the pack, so the cube
        // would be read ×0 (intent.md decision 4). Asserted as ABSENCE, not as an empty graph.
        expect(got.routed, `${b.seed}/${b.kind}`).toBe(false);
        expect(got.routedGraph, `${b.seed}/${b.kind}`).toBeUndefined();
        expect(got.ribbonGeo, `${b.seed}/${b.kind}`).toBeUndefined();
        expect(got.valleyGeo, `${b.seed}/${b.kind}`).toBeUndefined();
        expect(got.seaLevel, `${b.seed}/${b.kind}`).toBeUndefined();
        continue;
      }
      routed++;
      routedPerSystem[b.seed] = (routedPerSystem[b.seed] || 0) + 1;
      if (got.marginHeight !== got.carrier.height) composited++;
      const r = got.routedGraph;
      // ⛔ THE RIBBON IS NARROWER THAN THE ROUTE (final review #11): `wet` only. A relict body carries
      // the graph and the valley footprint — F13 outflow and F12 mouths read the carve cube's B and G
      // channels — and no ribbon at all, because nothing would parent it.
      if (got.fluvialClass === 'relict') expect(got.ribbonGeo, `${b.seed}/${b.kind}: a relict body must build no ribbon`).toBeUndefined();
      else expect(got.ribbonGeo, `${b.seed}/${b.kind}: a wet body must build one`).toBeTruthy();
      if (got.fluvialClass === 'wet') {
        const R_b = r.bifurcationRatio;
        expect(Number.isFinite(R_b), `${b.seed}/${b.kind}: R_b is not finite`).toBe(true);
        expect(R_b, `${b.seed}/${b.kind}: R_b ≤ 1 means the streams never merge — this is not a drainage network`).toBeGreaterThan(1);
        expect(r.maxOrder, `${b.seed}/${b.kind}: a wet body with no Strahler order at all`).toBeGreaterThan(0);
        wetNetworks.push({ seed: b.seed, kind: b.kind, radiusEarth: +b.cond.radiusEarth.toFixed(4),
          maxStrahler: r.maxOrder, bifurcationRatio: R_b, bifurcationRatioTrimmed: r.bifurcationRatioTrimmed,
          channelCount: r.channelCount, orderHist: r.orderHist, streamCount: r.streamCount });
      }
      orphan += r.orphan; uphill += r.uphill; selfLoopLand += r.selfLoopLand;
      const frac = got.oceanCount / mesh.verts.length;
      oceanFracMin = Math.min(oceanFracMin, frac); oceanFracMax = Math.max(oceanFracMax, frac);
      // every land channel node reaches the ocean set by following receivers — the property the
      // "mouths drain into the ocean" clause is really about (a mouth is ocean-adjacent BY
      // CONSTRUCTION in buildValleyGeometry, so asserting that alone would be tautological).
      for (let i = 0; i < mesh.verts.length; i++) {
        if (!r.isChannel[i] || got.isOcean[i]) continue;
        if (got.isOcean[r.receiver[i]]) mouths++;
        let c = i, steps = 0, reached = false;
        while (steps++ <= mesh.verts.length) { if (got.isOcean[c]) { reached = true; break; } const nx = r.receiver[c]; if (nx === c) break; c = nx; }
        if (!reached) badDrain++;
      }
    }
    expect(routed).toBe(68);          // wet 2 + relict 66 (AC-1's split)
    expect(notRouted).toBe(56);
    expect(orphan).toBe(0);
    expect(uphill).toBe(0);
    expect(selfLoopLand).toBe(0);
    expect(badDrain).toBe(0);
    expect(mouths, 'no mouths at all would make the drainage assertion vacuous').toBeGreaterThan(0);
    // the histogram solve really did hit TARGET_OCEAN_FRACTION on every routed body. Bound derived
    // from the solve, not chosen: solveSeaLevel lands within one histogram bin of 0.35, and the
    // MEASURED spread over the 68 is 0.3468 … 0.3540.
    expect(oceanFracMin).toBeGreaterThan(0.34);
    expect(oceanFracMax).toBeLessThan(0.36);
    // MEASURED and recorded rather than asserted as a law: exactly one routed body composites.
    expect(composited).toBe(1);
    expect(wetNetworks.length, 'the R_b / maxStrahler record is empty — AC-2 asks for it on every wet body').toBe(2);
    // ⭐ THE PER-SYSTEM ROUTED COUNT, for the VRAM arithmetic the contract and the PLAN quote. The
    // per-BODY figure (57.3 MB routed / 7.0 MB solid) is what a body costs; what a phone allocates is
    // a whole SYSTEM's worth at once, so the distribution over systems is the number that matters and
    // it is recorded here rather than assumed uniform.
    const routedCounts = SEEDS.map((s) => routedPerSystem[s] || 0);
    const withRouted = routedCounts.filter((n) => n > 0);
    recordCorpus({ routing: { routed, notRouted, composited, orphan, uphill, selfLoopLand, badDrain, mouths,
      oceanFraction: { min: +oceanFracMin.toFixed(4), max: +oceanFracMax.toFixed(4), target: DEFAULT_PARAMS.TARGET_OCEAN_FRACTION },
      mesh: { targetN: 2500, lloyd: 2 } },
      wetNetworks,
      wetNetworksNote: 'AC-2: "max Strahler order and R_b recorded". R_b = routedGraph.bifurcationRatio, the field planet-lod-rivers.js buildStats:504 publishes; computed in routeAndOrder (router.js:416-431). Measured at 2500/2, the corpus mesh — the structural metrics are mesh-independent, the ABSOLUTE order count is not.',
      perSystem: {
        systems: SEEDS.length,
        systemsWithRoutedBodies: withRouted.length,
        routedPerSystem, solidPerSystem,
        routedMeanAllSystems: +(routed / SEEDS.length).toFixed(2),
        routedMeanWhereRouted: withRouted.length ? +(routed / withRouted.length).toFixed(2) : 0,
        routedMax: Math.max(0, ...routedCounts),
        solidMeanAllSystems: +((routed + notRouted) / SEEDS.length).toFixed(2),
        note: 'VRAM per SYSTEM = 57.3 MB x routed + 7.0 MB x (solid - routed); the two means differ because some seeds have no routed body at all',
      } });
  }, 600000);

  it('AC-7 RECORDED — the three timed bodies (one wet, one relict, one airless) on the REAL 40000/4 carrier', () => {
    // ⛔ BEST-OF-3 WITH THE SPREAD, NOT ONE SHOT — and the reason is a defect this test already
    // caused once. A single timing was recorded here, quoted in a report, and then OVERWRITTEN by
    // the next run of the same file under full-suite load: the artifact said 210.3 / 191.6 ms where
    // the prose said 115.1 / 93.1, and the conclusion drawn from the prose ("under intent.md's
    // ~100-170 ms route band") was reversed by the file. A one-shot timing on a machine running 195
    // test files in parallel measures the contention, not the bake. So each body is built THREE
    // times and BOTH the best (the least-contended sample, the honest floor for a frame budget) and
    // the full min/max spread are written — a reader can see how noisy the measurement was instead
    // of having to trust one number.
    //
    // ⚠ EVEN SO, THESE ARE FLOOR NUMBERS FROM A HEADLESS NODE RUN, not a frame budget. What the
    // browser pays is this plus the six cube-face renders on the main thread, and a full-suite run
    // of this same file measures ~1.5-2x these values purely from parallel-worker contention. The
    // recorded `run` field says which kind of run produced them.
    const mesh = sharedCarrierMesh();
    const RUNS = 3;
    const timings = [];
    for (const cls of ['wet', 'relict', 'airless']) {
      const b = RIVER_BODIES.find((x) => compositionClass(x.cond) !== 'gas' && fluvialClassOf(x.cond) === cls);
      expect(b, `the corpus has no ${cls} body`).toBeTruthy();
      const dispatch = [], route = [], total = [];
      let last = null;
      for (let k = 0; k < RUNS; k++) {
        const got = buildLabBundleForBody(bodyOf(b), mesh);
        expect(got.fluvialClass).toBe(cls);
        expect(got.marginHeight.length).toBe(40000);
        // the three runs must be the SAME BAKE — if they were not, "best of 3" would be picking a
        // cheapest among different pieces of work rather than a least-contended sample of one.
        if (last) {
          expect(bytes(got.marginHeight), `${cls}: run ${k} is not the same bake as run 0`).toEqual(bytes(last.marginHeight));
          expect(got.routed ? got.routedGraph.channelCount : null).toBe(last.routed ? last.routedGraph.channelCount : null);
        }
        last = got;
        dispatch.push(got.ms); route.push(got.routeMs); total.push(got.ms + got.routeMs);
      }
      const one = (a) => ({ best: +Math.min(...a).toFixed(1), worst: +Math.max(...a).toFixed(1),
        samples: a.map((x) => +x.toFixed(1)) });
      timings.push({ cls, seed: b.seed, kind: b.kind, radiusEarth: +b.cond.radiusEarth.toFixed(4), runs: RUNS,
        dispatchMs: one(dispatch), routeMs: one(route), totalMs: one(total),
        strength: last.strength, routed: last.routed,
        channelCount: last.routedGraph ? last.routedGraph.channelCount : null,
        ribbonVerts: last.ribbonGeo ? last.ribbonGeo.getAttribute('position').count : 0,
        valleyVerts: last.valleyGeo ? last.valleyGeo.getAttribute('position').count : 0 });
    }
    recordCorpus({ timedBodies: timings,
      timingNote: 'best-of-3 per body per phase, with the full spread; `best` is the least-contended sample. ' +
        'A one-shot number here was overwritten by the next run once — hence 3 runs and the spread. ' +
        'These are headless-node FLOOR numbers: the browser adds six cube-face renders on the main thread, ' +
        'and this same file under full-suite parallelism measures ~1.5-2x from worker contention.',
      run: 'single-file (`npx vitest run --dir tests tests/river-bake-host.test.js`)',
      meshBuildMsNote: 'the 40000/4 carrier is built once per session (measured ~640 ms) and is NOT in these numbers' });
    for (const t of timings) { expect(t.dispatchMs.best).toBeGreaterThan(0); expect(t.routeMs.best).toBeGreaterThan(0); }
  }, 600000);

  it('the WORKER carries the whole bundle in ONE message, with every transferred buffer listed exactly once', async () => {
    // This is the only place the PROTOCOL — the key set and the transfer list — is under test, and a
    // duplicated buffer in that list is a runtime DataCloneError in the browser, never a red test.
    const b = RIVER_BODIES.find((x) => compositionClass(x.cond) !== 'gas' && fluvialClassOf(x.cond) === 'wet');
    const posted = await driveWorker({ id: 7, ...bodyOf(b) });
    {
      expect(posted.length).toBe(1);
      const { m, t } = posted[0];
      expect(m.ok).toBe(true); expect(m.id).toBe(7);

      // ⛔ THE PROVINCE SEAM'S CONTRACT IS UNCHANGED — the shipped host reads exactly these seven
      // top-level keys (labBakeHost.js `bakeFromResult`), so they stay at the top level and keep
      // their names. tests/province-bake-host.test.js `payloadOf` is the same shape.
      for (const k of ['pos', 'wgt', 'idx', 'nodes', 'path', 'ms', 'fractions']) expect(m, `province key ${k}`).toHaveProperty(k);
      // ⛔ AND THE WHOLE TOP-LEVEL KEY SET, PINNED — the seven above are asserted by PRESENCE, which
      // cannot see a key ADDED or SILENTLY RENAMED. The host reads every one of these by name in
      // `bakeFromResult` / `partFromPayload`, and a name that drifts on one side of the transport is a
      // quiet `undefined` in a uniform, never a red test. Transcribed from provinceWorker.js's `msg`
      // literal (final review #12, 2026-09-02).
      expect(Object.keys(m).sort()).toEqual([
        'id', 'ok',
        'pos', 'wgt', 'idx', 'nodes', 'path', 'ms', 'fractions',
        'fluvialClass', 'routed', 'strength', 'restore', 'routeMs',
        'relief', 'crater', 'sea', 'valley', 'ribbon',
      ].sort());
      expect(m.nodes).toBe(40000);
      expect(m.fractions.labelled).toBe(1);

      // …and the river bundle rides beside it
      expect(m.fluvialClass).toBe('wet');
      expect(m.routed).toBe(true);
      expect(m.strength).toBe(bakeReliefCrossover(visScaleOf(b.cond.radiusEarth)));
      expect(m.restore).toBe(1 - m.strength);
      expect(Object.keys(m.relief).sort()).toEqual(['grd', 'hgt', 'idx', 'pos']);
      expect(Object.keys(m.crater).sort()).toEqual(['grd', 'hgt']);   // shares relief's pos/idx
      expect(m.relief.hgt.length).toBe(40000);
      expect(m.crater.hgt.length).toBe(40000);
      expect(m.sea.oceanCount).toBeGreaterThan(0);
      expect(typeof m.sea.seaLevel).toBe('number');
      expect(Object.keys(m.valley).sort()).toEqual(['aDepth', 'aMouth', 'aOrder', 'idx', 'pos']);
      expect(Object.keys(m.ribbon).sort()).toEqual(['col', 'idx', 'pos']);

      // ⭐ THE TRANSFER LIST: every posted array's buffer appears, and appears ONCE. A buffer listed
      // twice throws DataCloneError in a real worker; a buffer left OUT is a silent structured-clone
      // copy (correct, but the zero-copy the worker exists for is gone).
      const arrays = [m.pos, m.wgt, m.idx, m.relief.pos, m.relief.hgt, m.relief.grd, m.relief.idx,
        m.crater.hgt, m.crater.grd, m.valley.pos, m.valley.aDepth, m.valley.aMouth, m.valley.aOrder, m.valley.idx,
        m.ribbon.pos, m.ribbon.col, m.ribbon.idx];
      expect(t.length).toBe(arrays.length);
      expect(new Set(t).size).toBe(t.length);                       // no duplicates
      for (const a of arrays) expect(t).toContain(a.buffer);
      // crater must NOT re-post relief's position/index under its own name
      expect(m.crater.pos).toBeUndefined();
      expect(m.crater.idx).toBeUndefined();
    }
  }, 600000);

  it('a RELICT body posts ribbon: null — the whole route, the carve footprint, no water', async () => {
    // ⛔ THE NARROWER HALF, DRIVEN THROUGH THE REAL WORKER (final review #11). The bundle builds a
    // ribbon for `wet` alone, so the handler's ribbon block rides `b.ribbonGeo` rather than `b.routed`
    // — reading `b.ribbonGeo` under `if (b.routed)` would THROW on 64 of the 68 routed bodies, in the
    // browser only, where this suite would never see it.
    const b = RIVER_BODIES.find((x) => compositionClass(x.cond) !== 'gas' && fluvialClassOf(x.cond) === 'relict');
    expect(b, 'the corpus carries no relict body').toBeTruthy();
    const posted = await driveWorker({ id: 11, ...bodyOf(b) });
    expect(posted.length).toBe(1);
    const { m, t } = posted[0];
    expect(m.ok).toBe(true); expect(m.id).toBe(11);
    expect(m.fluvialClass).toBe('relict');
    expect(m.routed, 'a relict body IS routed — only the ribbon is withheld').toBe(true);
    expect(m.sea, 'the sea is still solved: computeOcean is the router\'s outlet condition').toBeTruthy();
    expect(m.valley, 'the carve footprint still posts — F13 outflow reads its B channel').toBeTruthy();
    expect(m.ribbon, 'a relict body builds no ribbon, so none is posted').toBe(null);
    // the transfer list is exactly the wet one MINUS the ribbon's three buffers: 3 province + 4 relief
    // + 2 crater + 5 valley = 14, each listed once.
    expect(t.length).toBe(14);
    expect(new Set(t).size).toBe(t.length);
  }, 600000);

  it('the worker answers a failure the way it always did — { ok: false, error }', async () => {
    const posted = await driveWorker({ id: 9, condition: null, macroSeed: 0, T_eq: null, radiusEarth: 1 });
    expect(posted.length).toBe(1);
    expect(posted[0].m).toMatchObject({ id: 9, ok: false });
    expect(typeof posted[0].m.error).toBe('string');
    expect(posted[0].t).toBeUndefined();
  }, 120000);
});

// ══════════════════════════════════════════════════════════════════════════════════════════════
// AC-3 — the routing surface IS the display surface.
//
// The lab's rule (route() at planet-lod-rivers.js:686-693, fenced by tests/relief-router-repoint.test.js):
// ONE field → ONE cube → both consumers, gated by ONE strength. In the game that strength is the
// lab's frame write with the lab's display-scale input — `bakeReliefCrossover(visScaleOf(radiusEarth))`
// (world-engine-lab.html:4976) — and the crater cube's restore weight is `1 −` that (:4988). So the
// bundle carries BOTH numbers, from the lab's own two functions, composed in the lab's order.
// ══════════════════════════════════════════════════════════════════════════════════════════════
describe('AC-3 — the routing surface is the display surface', () => {
  it('strength and restore are the lab\'s two laws composed, to the last bit, on all 124 solid bodies', () => {
    const mesh = small();
    let n = 0;
    for (const b of RIVER_BODIES) {
      if (compositionClass(b.cond) === 'gas') continue;
      const s = bakeReliefCrossover(visScaleOf(b.cond.radiusEarth));
      const got = buildLabBundleForBody(bodyOf(b), mesh);
      expect(got.strength, `${b.seed}/${b.kind}`).toBe(s);
      expect(got.restore, `${b.seed}/${b.kind}`).toBe(1 - s);
      n++;
    }
    expect(n).toBe(124);
    // NON-VACUITY: the crossover is not a constant over this corpus — it would pass trivially if it were.
    const spread = new Set(RIVER_BODIES.filter((b) => compositionClass(b.cond) !== 'gas')
      .map((b) => bakeReliefCrossover(visScaleOf(b.cond.radiusEarth))));
    expect(spread.size).toBeGreaterThan(50);
  }, 600000);

  it('the relief and crater cube geometries carry the bundle\'s OWN arrays, and share one position/index pair', () => {
    // Driven on the one routed body that composites, so the crater overlay is genuinely non-zero and
    // the relief surface is genuinely the composited one — on any other routed body both halves of
    // this comparison would be all-zero / untouched and the test would prove nothing.
    const b = RIVER_BODIES.find((x) => x.seed === 'rocky-3' && x.kind === 'planet');
    const mesh = small();
    const got = buildLabBundleForBody(bodyOf(b), mesh);
    expect(got.marginHeight, 'this body must take the COMPOSITE arm').not.toBe(got.carrier.height);
    expect(Array.from(got.craterOverlay).some((x) => x !== 0), 'the crater overlay must be non-zero here').toBe(true);

    const relief = buildHeightCubeGeometry({ mesh, height: got.marginHeight, grad: got.marginGrad });
    const crater = buildHeightCubeGeometry({ mesh, height: got.craterOverlay, grad: got.craterGrad });
    expect(bytes(relief.getAttribute('aHeight').array)).toEqual(bytes(got.marginHeight));
    expect(bytes(relief.getAttribute('aGrad').array)).toEqual(bytes(got.marginGrad));
    expect(bytes(crater.getAttribute('aHeight').array)).toEqual(bytes(got.craterOverlay));
    expect(bytes(crater.getAttribute('aGrad').array)).toEqual(bytes(got.craterGrad));
    // ⭐ the sharing the worker's payload depends on: the two cubes differ ONLY in their height and
    // gradient channels, so posting crater's pos/idx again would be a duplicate buffer for no data.
    expect(bytes(relief.getAttribute('position').array)).toEqual(bytes(crater.getAttribute('position').array));
    expect(bytes(relief.getIndex().array)).toEqual(bytes(crater.getIndex().array));
    // and the routed graph really was built on the SAME array the relief cube carries
    expect(got.routed).toBe(true);
    expect(bytes(relief.getAttribute('aHeight').array)).toEqual(bytes(got.marginHeight));
  }, 120000);

  it('RECORDED: wet bodies whose strength is exactly 0 — never silently routed on an undisplayed field', () => {
    // ⛔ COUNTED, NEVER GATED (contract AC-3, intent.md "Risks named up front"). A wet body below
    // 0.25 R⊕ or above 4 R⊕ has a crossover of exactly 0, so it would route rivers on a surface it
    // does not display. Wetness needs a retained atmosphere, so the count SHOULD be empty; a non-zero
    // count is a decision for Max, not a red test, and the bundle flags each such body itself.
    // ⭐ WIDENED FROM WET TO ROUTED (final review #10, 2026-09-02). The hazard is not about the
    // RIBBON, it is about the CARVE: a relict body at strength 0 also gouges valleys into a surface
    // the shader is not displaying, because `uRiverCarveMap` is bound on every routed body while
    // `uReliefBakeStrength` is 0. Counting only the wet ones left 64 of the 68 routed bodies outside
    // the instrument.
    const isSolid = (b) => compositionClass(b.cond) !== 'gas';
    const strengthOf = (b) => bakeReliefCrossover(visScaleOf(b.cond.radiusEarth));
    const zero = RIVER_BODIES.filter((b) => isSolid(b) && fluvialClassOf(b.cond) === 'wet' && strengthOf(b) === 0);
    const zeroRouted = RIVER_BODIES.filter((b) => isSolid(b) && fluvialClassOf(b.cond) !== 'airless' && strengthOf(b) === 0);
    const zeroSolid = RIVER_BODIES.filter((b) => isSolid(b) && strengthOf(b) === 0);
    writeFileSync(join(process.env.TMPDIR || tmpdir(), 'river-strength-zero.json'), JSON.stringify({
      wetWithZeroStrength: zero.length,
      routedWithZeroStrength: zeroRouted.length,
      bodies: zero.map((b) => ({ seed: b.seed, kind: b.kind, radiusEarth: b.cond.radiusEarth })),
      routedBodies: zeroRouted.map((b) => ({ seed: b.seed, kind: b.kind, cls: fluvialClassOf(b.cond), radiusEarth: b.cond.radiusEarth })),
      solidWithZeroStrength: zeroSolid.length,
      solidZeroClasses: zeroSolid.reduce((a, b) => { const k = fluvialClassOf(b.cond); a[k] = (a[k] || 0) + 1; return a; }, {}),
      note: 'counted, not gated — a non-zero wetWithZeroStrength is surfaced to Max (contract AC-3); the bundle marks such a body routedOnUndisplayedField. The ROUTED count is PINNED at 0 below, so a change reaches him as a red rather than as a line in a file nobody opens.',
    }, null, 2));
    // ⛔ PINNED AT THE MEASURED VALUE, AND THE RED IS THE SURFACING MECHANISM — not a quality bar. The
    // corpus's strength-0 population is entirely AIRLESS (measured 41 of 41), which are not routed at
    // all, so no body in this corpus routes on a field it does not display. If that ever stops being
    // true it is a decision for Max (the lab's sampler fallback vs a floor), and a red here is how he
    // finds out; a JSON field would not have told anyone.
    expect(zeroRouted.length, 'a ROUTED body now sits at crossover 0 — it carves a surface it does not display; this is Max\'s call, see contract AC-3').toBe(0);
    expect(zero.length, 'implied by the routed count, stated so a future reader does not have to derive it').toBe(0);
    expect(zeroSolid.length, 'NON-VACUITY: strength 0 must actually OCCUR in this corpus, or the count above proves nothing').toBeGreaterThan(0);
    // the FLAG is gated (the bundle must be honest about what it did), the COUNT is not
    const mesh = small();
    for (const b of RIVER_BODIES) {
      if (compositionClass(b.cond) === 'gas' || fluvialClassOf(b.cond) !== 'wet') continue;
      const got = buildLabBundleForBody(bodyOf(b), mesh);
      expect(got.routedOnUndisplayedField, `${b.seed}/${b.kind}`).toBe(got.routed && got.strength === 0);
    }
  }, 600000);
});

// ══════════════════════════════════════════════════════════════════════════════════════════════
// AC-7 — ONE REQUEST, ONE BAKE FRAME, FOUR CUBES + THE RIBBON, DISPOSED EXACTLY ONCE.
//
// The host (src/rendering/bake/labBakeHost.js) is where the bundle above becomes pixels: it owns the
// renderer (three hands it to `surface.onBeforeRender`), the cube lifetimes, the ribbon child, the
// sea override and the A/B keys. Everything it decides is the lab's own decision read from ONE place
// — `fluvialClassOf` for WHICH bodies (intent.md decision 4), `riverOverlayState` (world-engine-lab.html
// :392) for the carve amounts and the ribbon lift, `riverReroute` (:2990-2992) for the sea.
//
// ⛔ WHY THE SEA IS TAKEN TO −1 AT ATTACH AND WRITTEN AT BAKE. Two writers reach `uSeaLevel`: driver
// pack #9 at mount (the derived level) and the router's histogram solve at bake (intent.md decision 3
// — on a wet body the router wins). Left alone between the two, the body would draw the pack's
// shoreline for however many frames the dispatch takes and then JUMP to the solved one. −1 at attach
// makes it one fill-in: the sea arrives WITH the rivers it drains. Dispose puts the pack's value back,
// because the pack's write is the state this host found and did not author.
//
// ⛔ ASSERTED BY SLOT IDENTITY, NOT BY CREATION ORDER. Every cube below is checked by WHICH uniform
// slot holds its texture and WHICH array it was fed — `cubes[3]` would pass just as well if the host
// bound the crater cube to the carve slot.
// ══════════════════════════════════════════════════════════════════════════════════════════════
describe('AC-7 — one request, one bake frame, four cubes + the ribbon, disposed exactly once', () => {
  const cubeBytes = (n) => n * n * 6 * 8;                       // 6 faces × HalfFloat RGBA
  const CARVE_SIZE = DEFAULT_PARAMS.CARVE_CUBE_SIZE;

  /** A stub cube in the province suite's shape (province-bake-host.test.js:168-172), plus a tag so a
   *  failure names the seam that made it rather than an index into a shared array. */
  const mk = (list, tag) => ({ renderer, size }) => {
    const c = { tag, size, renderer, texture: { isStub: true, tag }, updates: 0, disposes: 0, lastGeo: null,
      update(g) { c.updates++; c.lastGeo = g; }, dispose() { c.disposes++; } };
    list.push(c);
    return c;
  };
  const seams = () => {
    const prov = [], hgt = [], carve = [];
    return { prov, hgt, carve, all: () => prov.concat(hgt, carve),
      deps: { createProvinceCube: mk(prov, 'province'), createHeightCube: mk(hgt, 'height'), createCarveCube: mk(carve, 'carve') } };
  };

  const PH = () => ({ isPlaceholder: true });
  /**
   * A body surface in the shape `Planet._createLabSurface` hands the host: a real geometry (so
   * `bodyRadiusOf` has a bounding sphere), the four sampler slots `ensureLabSamplers` creates, and
   * `uSeaLevel` / `uCoastStrength` ALREADY CARRYING THE PACK'S WRITE — the fluvial deck runs inside
   * `applyDriverPacks`, which is upstream of the attach call (Planet.js:2076). A wet body therefore
   * arrives with a driven sea, which is the value dispose has to give back.
   */
  const fakeSurface = ({ packSea = -1, packCoast = 0 } = {}) => {
    const uniforms = {
      uProvinceCube: { value: PH() }, uProvinceColorMix: { value: 0.65 },
      uReliefBakeCube: { value: PH() }, uCraterBakeCube: { value: PH() }, uRiverCarveMap: { value: PH() },
      uSeaLevel: { value: packSea }, uCoastStrength: { value: packCoast },
    };
    const s = new THREE.Mesh(new THREE.SphereGeometry(2, 8, 4), { uniforms });
    s.userData = {};
    return s;
  };
  const placeholdersOf = (s) => ({ prov: s.material.uniforms.uProvinceCube.value, relief: s.material.uniforms.uReliefBakeCube.value,
    crater: s.material.uniforms.uCraterBakeCube.value, carve: s.material.uniforms.uRiverCarveMap.value });

  const pick = (k) => {
    const b = RIVER_BODIES.find((x) => compositionClass(x.cond) !== 'gas' && fluvialClassOf(x.cond) === k);
    expect(b, `the corpus carries no ${k} body`).toBeTruthy();
    return b;
  };
  const eqBytes = (a, b) => Buffer.from(a.buffer, a.byteOffset, a.byteLength).equals(Buffer.from(b.buffer, b.byteOffset, b.byteLength));

  /**
   * A bundle, as `provinceWorker.js` posts it. ⛔ TRANSCRIBED FROM THAT HANDLER, not invented: same
   * keys, same order, same attribute extraction, `crater` carrying ONLY hgt/grd because the two
   * height cubes are the same sphere and posting the crater's own position/index would be a duplicate
   * buffer (and listing one buffer twice in a transfer list throws DataCloneError in the browser).
   *
   * WHY THIS EXISTS. The worker is the transport the BROWSER takes; headless there is no Worker, so
   * without a payload of this exact shape the four `*GeometryFromArrays` rebuilders in the host —
   * every attribute name they spell, the crater's sharing of the relief's position/index, and the
   * `p.sea.seaLevel` unwrap — are executed by nothing at all. `driveWorker` above proves the worker
   * PRODUCES this shape; this proves the host CONSUMES it.
   */
  const attrOf = (g, n) => g.getAttribute(n).array;
  const workerPayloadOf = (b, id = 1) => {
    const provGeo = buildProvinceCubeGeometry({ mesh: b.mesh, province: b.province });
    const reliefGeo = buildHeightCubeGeometry({ mesh: b.mesh, height: b.marginHeight, grad: b.marginGrad });
    const craterGeo = buildHeightCubeGeometry({ mesh: b.mesh, height: b.craterOverlay, grad: b.craterGrad });
    const msg = {
      id, ok: true,
      pos: attrOf(provGeo, 'position'), wgt: attrOf(provGeo, 'aProv'), idx: provGeo.getIndex().array,
      nodes: b.province.length, path: b.relief && b.relief.path, ms: b.ms,
      fractions: provinceFractions(b.province),
      fluvialClass: b.fluvialClass, routed: b.routed, strength: b.strength, restore: b.restore,
      routeMs: b.routeMs,
      relief: { pos: attrOf(reliefGeo, 'position'), hgt: attrOf(reliefGeo, 'aHeight'), grd: attrOf(reliefGeo, 'aGrad'), idx: reliefGeo.getIndex().array },
      crater: { hgt: attrOf(craterGeo, 'aHeight'), grd: attrOf(craterGeo, 'aGrad') },
      sea: null, valley: null, ribbon: null,
    };
    if (b.routed) {
      msg.sea = { seaLevel: b.seaLevel, oceanCount: b.oceanCount };
      msg.valley = { pos: attrOf(b.valleyGeo, 'position'), aDepth: attrOf(b.valleyGeo, 'aDepth'),
        aMouth: attrOf(b.valleyGeo, 'aMouth'), aOrder: attrOf(b.valleyGeo, 'aOrder'), idx: b.valleyGeo.getIndex().array };
    }
    // ⛔ THE RIBBON RIDES ITS OWN PRESENCE TEST, MIRRORING THE HANDLER (final review #11): the bundle
    // builds one for `wet` alone, so `b.routed` is the wrong guard here exactly as it is there.
    if (b.ribbonGeo) {
      // the ribbon's `normal` is NOT posted — the host rebuilds it with computeVertexNormals()
      msg.ribbon = { pos: attrOf(b.ribbonGeo, 'position'), col: attrOf(b.ribbonGeo, 'color'), idx: b.ribbonGeo.getIndex().array };
    }
    return msg;
  };
  const tick = () => new Promise((r) => setTimeout(r, 0));

  afterEach(() => { toggleRiversAB(false); toggleReliefAB(false); });

  it('the two new names ARE the two old ones — the province suite imports the aliases and must stay green', () => {
    expect(attachProvinceBake).toBe(attachLabBake);
    expect(disposeProvinceBake).toBe(disposeLabBake);
  });

  it('⭐ SYNC on a WET body: one bake frame binds four cubes, parents the ribbon and writes the solved sea', () => {
    const b = pick('wet'); const s = fakeSurface({ packSea: 0.31, packCoast: 1 }); const ph = placeholdersOf(s);
    const sm = seams(); const m = small(); let bundle = null;
    const rec = attachLabBake(s, bodyOf(b), { ...sm.deps, compute: (body) => (bundle = buildLabBundleForBody(body, m)) });

    // the sea is taken to −1 at ATTACH — one fill-in when the rivers land, not a shoreline jump
    expect(rec.rivers.packSeaLevel).toBe(0.31); expect(rec.rivers.packCoastStrength).toBe(1);
    expect(s.material.uniforms.uSeaLevel.value).toBe(-1);
    expect(rec.baked).toBe(false); expect(sm.all().length).toBe(0);

    s.onBeforeRender({}); s.onBeforeRender({});                 // second frame must not re-bake
    const u = s.material.uniforms;
    expect(rec.baked).toBe(true); expect(rec.bakes).toBe(1);
    expect(sm.prov.length).toBe(1); expect(sm.hgt.length).toBe(2); expect(sm.carve.length).toBe(1);
    expect(sm.all().every((c) => c.updates === 1)).toBe(true);

    // ── which texture is in which slot, and which ARRAY each cube was fed ──
    expect(u.uProvinceCube.value).toBe(sm.prov[0].texture);
    expect(u.uRiverCarveMap.value).toBe(sm.carve[0].texture);
    const reliefCube = sm.hgt.find((c) => eqBytes(c.lastGeo.getAttribute('aHeight').array, bundle.marginHeight));
    const craterCube = sm.hgt.find((c) => eqBytes(c.lastGeo.getAttribute('aHeight').array, bundle.craterOverlay));
    expect(reliefCube, 'no height cube was fed the composited relief').toBeTruthy();
    expect(craterCube, 'no height cube was fed the crater overlay').toBeTruthy();
    expect(reliefCube).not.toBe(craterCube);
    expect(u.uReliefBakeCube.value).toBe(reliefCube.texture);
    expect(u.uCraterBakeCube.value).toBe(craterCube.texture);
    expect(eqBytes(reliefCube.lastGeo.getAttribute('aGrad').array, bundle.marginGrad)).toBe(true);
    expect(eqBytes(craterCube.lastGeo.getAttribute('aGrad').array, bundle.craterGrad)).toBe(true);
    expect(sm.carve[0].lastGeo).toBe(bundle.valleyGeo);
    // the sizes are the lab's, and they are what `bytes` is derived from
    expect(sm.prov[0].size).toBe(PROVINCE_CUBE_SIZE); expect(reliefCube.size).toBe(RELIEF_CUBE_SIZE);
    expect(craterCube.size).toBe(RELIEF_CUBE_SIZE); expect(sm.carve[0].size).toBe(CARVE_SIZE);

    // ── the two display weights (intent.md decision 2) ──
    expect(rec.relief.strength).toBe(bundle.strength);
    expect(u.uReliefBakeStrength.value).toBe(bundle.strength);
    expect(u.uCraterBakeRestore.value).toBe(1 - bundle.strength);

    // ── the ribbon child ──
    expect(s.children.length).toBe(1);
    const ribbon = s.children[0];
    expect(ribbon).toBe(rec.rivers.ribbon);
    expect(ribbon.isMesh).toBe(true);
    expect(ribbon.geometry).toBe(bundle.ribbonGeo);
    expect(ribbon.geometry.getAttribute('normal'), 'the ribbon geometry must carry normals').toBeTruthy();
    expect(ribbon.material.vertexColors).toBe(true);
    expect(ribbon.material.side).toBe(THREE.DoubleSide);
    expect(ribbon.material.transparent).toBe(true);
    expect(ribbon.material.depthWrite).toBe(false);
    expect(ribbon.frustumCulled).toBe(false);
    expect(ribbon.renderOrder).toBe(10);
    expect(ribbon.scale.x).toBeCloseTo(bodyRadiusOf(s.geometry) * 1.0014, 10);   // riverOverlayState.ribbonLift

    // ── the sea the rivers drain into, and the lab's carve amounts (world-engine-lab.html:392) ──
    expect(bundle.seaLevel).not.toBe(-1);
    expect(rec.rivers.seaLevel).toBe(bundle.seaLevel);
    expect(u.uSeaLevel.value).toBe(bundle.seaLevel);
    expect(u.uCoastStrength.value).toBe(1);
    expect(u.uRiverCarveStrength.value).toBe(0.01);
    expect(u.uRiverCarveFloor.value).toBe(1.3);
    expect(u.uRiverCarveDepth.value).toBe(0.08);
    expect(u.uRiverCarveRough.value).toBe(0.5);
    expect(u.uRiverCarveGateHi.value).toBe(0.18);

    expect(rec.rivers.class).toBe('wet'); expect(rec.rivers.routed).toBe(true); expect(rec.rivers.admitted).toBe(true);
    expect(typeof rec.routeMs).toBe('number'); expect(typeof rec.ms).toBe('number');
    expect(provinceRecordOf(s)).toBe(rec);
    expect(s.userData.wdBake || (s.userData.wd && s.userData.wd.lab && s.userData.wd.lab.bake) || null).toBe(rec);
    expect(ph.prov).not.toBe(u.uProvinceCube.value);            // the placeholders really were replaced
    disposeLabBake(s);
  }, 120000);

  it('an AIRLESS body: province + relief + crater bake, NO carve cube, NO ribbon, uSeaLevel untouched', () => {
    // ⛔ THE SENTINEL IS 0.31, NOT −1 (final review #9, 2026-09-02). Mounting this case with the
    // pack's own −1 made "untouched" and "taken to −1 and never given back" the SAME assertion: the
    // host's deferral writes exactly −1, so a bug that admitted an airless body to the sea half would
    // have passed here unseen. A value the host could not have produced makes the claim real.
    // ⚠ 0.31 IS NOT A REAL AIRLESS SEA — the pack writes −1 on this class (AC-1) — it is a TRACER,
    // and it is the same one the wet cases use so the two read as one instrument.
    const b = pick('airless'); const s = fakeSurface({ packSea: 0.31, packCoast: 0 });
    const sm = seams(); const m = small();
    const rec = attachLabBake(s, bodyOf(b), { ...sm.deps, compute: (body) => buildLabBundleForBody(body, m) });
    s.onBeforeRender({});
    expect(rec.baked).toBe(true);
    expect(sm.prov.length).toBe(1); expect(sm.hgt.length).toBe(2); expect(sm.carve.length).toBe(0);
    expect(sm.all().length).toBe(3);
    expect(s.children.length).toBe(0); expect(rec.rivers.ribbon).toBe(null);
    expect(s.material.uniforms.uRiverCarveMap.value).toBe(placeholdersOf(s).carve);
    expect(s.material.uniforms.uSeaLevel.value).toBe(0.31);          // ⭐ UNTOUCHED — not the host's own −1
    expect(rec.rivers.packSeaLevel, 'an unadmitted body must not even RECORD a pack sea').toBe(null);
    expect(s.material.uniforms.uCoastStrength.value).toBe(0);
    expect(s.material.uniforms.uRiverCarveStrength.value).toBe(0);   // created, never amounted
    expect(rec.rivers.class).toBe('airless'); expect(rec.rivers.routed).toBe(false); expect(rec.rivers.admitted).toBe(false);
    expect(rec.bytes).toEqual({ province: cubeBytes(PROVINCE_CUBE_SIZE), relief: cubeBytes(RELIEF_CUBE_SIZE), crater: cubeBytes(RELIEF_CUBE_SIZE), carve: 0 });
    disposeLabBake(s);
  }, 120000);

  it('a RELICT body: routed — the carve cube binds — but no ribbon geometry at all, no sea, no gouging amounts', () => {
    // ⛔ SAME 0.31 TRACER AS THE AIRLESS CASE (final review #9): with a −1 here, "the relict body's sea
    // is untouched" and "the host deferred it and never restored it" were the same number.
    const b = pick('relict'); const s = fakeSurface({ packSea: 0.31, packCoast: 0 });
    const sm = seams(); const m = small(); let bundle = null;
    const rec = attachLabBake(s, bodyOf(b), { ...sm.deps, compute: (body) => (bundle = buildLabBundleForBody(body, m)) });
    s.onBeforeRender({});
    expect(sm.all().length).toBe(4); expect(sm.carve.length).toBe(1);
    expect(s.material.uniforms.uRiverCarveMap.value).toBe(sm.carve[0].texture);
    expect(s.children.length).toBe(0); expect(rec.rivers.ribbon).toBe(null);
    // ⭐ AND THE BUNDLE NEVER BUILT ONE (final review #11) — the host is not hiding a ribbon it was
    // handed, there is none to hide. The route and the valley footprint ARE there.
    expect(bundle.ribbonGeo, 'a relict bundle must carry no ribbon geometry').toBeUndefined();
    expect(bundle.valleyGeo, 'the carve footprint still rides — F13 outflow reads its B channel').toBeTruthy();
    expect(bundle.routedGraph).toBeTruthy();
    expect(s.material.uniforms.uSeaLevel.value).toBe(0.31);          // ⭐ UNTOUCHED — not the host's own −1
    expect(rec.rivers.packSeaLevel).toBe(null);
    expect(s.material.uniforms.uCoastStrength.value).toBe(0);
    expect(s.material.uniforms.uRiverCarveStrength.value).toBe(0);   // the F13 outflow reads the B channel; nothing gouges
    expect(rec.rivers.class).toBe('relict'); expect(rec.rivers.routed).toBe(true); expect(rec.rivers.admitted).toBe(false);
    expect(rec.rivers.seaLevel).toBe(null);
    disposeLabBake(s);
    expect(s.material.uniforms.uSeaLevel.value).toBe(0.31);          // and dispose leaves it where it found it
  }, 120000);

  it('RECORDED bytes: carve 1024²·6·8, relief + crater 256²·6·8, province 128²·6·8', () => {
    const b = pick('wet'); const s = fakeSurface({ packSea: 0.31, packCoast: 1 });
    const sm = seams(); const m = small();
    const rec = attachLabBake(s, bodyOf(b), { ...sm.deps, compute: (body) => buildLabBundleForBody(body, m) });
    s.onBeforeRender({});
    expect(rec.bytes).toEqual({ carve: 1024 * 1024 * 6 * 8, relief: 256 * 256 * 6 * 8, crater: 256 * 256 * 6 * 8, province: 128 * 128 * 6 * 8 });
    expect(rec.bytes).toEqual({ carve: cubeBytes(CARVE_SIZE), relief: cubeBytes(RELIEF_CUBE_SIZE), crater: cubeBytes(RELIEF_CUBE_SIZE), province: cubeBytes(PROVINCE_CUBE_SIZE) });
    disposeLabBake(s);
  }, 120000);

  it('⭐ dispose releases every cube ONCE, removes the ribbon, restores every placeholder and the pack\'s sea; a second dispose is a no-op', () => {
    const b = pick('wet'); const s = fakeSurface({ packSea: 0.31, packCoast: 1 }); const ph = placeholdersOf(s);
    const sm = seams(); const m = small();
    const rec = attachLabBake(s, bodyOf(b), { ...sm.deps, compute: (body) => buildLabBundleForBody(body, m) });
    s.onBeforeRender({});
    const ribbon = rec.rivers.ribbon; let geoDisposed = 0, matDisposed = 0;
    ribbon.geometry.addEventListener('dispose', () => { geoDisposed++; });
    ribbon.material.addEventListener('dispose', () => { matDisposed++; });

    disposeLabBake(s); disposeLabBake(s);

    expect(sm.all().length).toBe(4);
    expect(sm.all().map((c) => c.disposes)).toEqual([1, 1, 1, 1]);
    expect(geoDisposed).toBe(1); expect(matDisposed).toBe(1);
    expect(s.children.length).toBe(0);
    const u = s.material.uniforms;
    expect(u.uProvinceCube.value).toBe(ph.prov);
    expect(u.uReliefBakeCube.value).toBe(ph.relief);
    expect(u.uCraterBakeCube.value).toBe(ph.crater);
    expect(u.uRiverCarveMap.value).toBe(ph.carve);
    expect(u.uSeaLevel.value).toBe(0.31);                        // the pack's write, given back
    expect(u.uCoastStrength.value).toBe(1);
    expect(u.uReliefBakeStrength.value).toBe(0);
    expect(u.uCraterBakeRestore.value).toBe(0);
    expect(u.uRiverCarveStrength.value).toBe(0);
    expect(rec.disposed).toBe(true); expect(rec.disposes).toBe(1);
    expect(rec.rivers.ribbon).toBe(null); expect(rec.rivers.carveCube).toBe(null);
    expect(rec.relief.cube).toBe(null); expect(rec.relief.craterCube).toBe(null); expect(rec.cube).toBe(null);
  }, 120000);

  it('ASYNC: a reply that lands AFTER dispose is dropped — no cube, no ribbon, the pack\'s sea back', async () => {
    const b = pick('wet'); const s = fakeSurface({ packSea: 0.31, packCoast: 1 }); const ph = placeholdersOf(s);
    const sm = seams(); const m = small(); let resolve;
    const rec = attachLabBake(s, bodyOf(b), { ...sm.deps, compute: () => new Promise((r) => { resolve = r; }) });
    s.onBeforeRender({});
    expect(rec.pending).toBe(true);
    disposeLabBake(s);
    resolve(buildLabBundleForBody(bodyOf(b), m));
    await tick(); await tick();
    s.onBeforeRender({});
    expect(rec.disposed).toBe(true); expect(rec.baked).toBe(false);
    expect(sm.all().length).toBe(0);
    expect(s.children.length).toBe(0);
    expect(s.material.uniforms.uProvinceCube.value).toBe(ph.prov);
    expect(s.material.uniforms.uSeaLevel.value).toBe(0.31);
  }, 120000);

  it('⭐ the two A/B toggles: J hides the ribbon and zeroes the four carve amounts, U zeroes strength and restores the crater; both restore', () => {
    const b = pick('wet'); const s = fakeSurface({ packSea: 0.31, packCoast: 1 });
    const sm = seams(); const m = small(); let bundle = null;
    const rec = attachLabBake(s, bodyOf(b), { ...sm.deps, compute: (body) => (bundle = buildLabBundleForBody(body, m)) });
    s.onBeforeRender({});
    const u = s.material.uniforms;

    expect(toggleRiversAB().off).toBe(true);
    expect(rec.rivers.ribbon.visible).toBe(false);
    expect(u.uRiverCarveStrength.value).toBe(0); expect(u.uRiverCarveFloor.value).toBe(0);
    expect(u.uRiverCarveDepth.value).toBe(0); expect(u.uRiverCarveRough.value).toBe(0);
    expect(u.uRiverCarveGateHi.value).toBe(0.18);                 // NOT part of the flip (applyCarveAmounts:3020)
    expect(u.uSeaLevel.value).toBe(bundle.seaLevel);              // NOR is the sea (setRiverOverlay leaves it)
    expect(u.uCoastStrength.value).toBe(1);
    expect(toggleRiversAB().off).toBe(false);
    expect(rec.rivers.ribbon.visible).toBe(true);
    expect(u.uRiverCarveStrength.value).toBe(0.01); expect(u.uRiverCarveFloor.value).toBe(1.3);
    expect(u.uRiverCarveDepth.value).toBe(0.08); expect(u.uRiverCarveRough.value).toBe(0.5);

    expect(toggleReliefAB().off).toBe(true);
    expect(u.uReliefBakeStrength.value).toBe(0);
    expect(u.uCraterBakeRestore.value).toBe(1);                   // at strength 0 the crossover hands everything back
    expect(toggleReliefAB().off).toBe(false);
    expect(u.uReliefBakeStrength.value).toBe(bundle.strength);
    expect(u.uCraterBakeRestore.value).toBe(1 - bundle.strength);

    // the globals a chrome-devtools drive uses
    expect(globalThis._labRivers.count()).toBe(1);
    expect(globalThis._labRivers.class(s)).toBe('wet');
    expect(globalThis._labRelief.strength(s)).toBe(bundle.strength);
    disposeLabBake(s);
    expect(globalThis._labRivers.count()).toBe(0);
  }, 120000);

  it('a body that bakes MID-A/B matches the bodies already flipped', () => {
    const b = pick('wet'); const s = fakeSurface({ packSea: 0.31, packCoast: 1 });
    const sm = seams(); const m = small();
    toggleRiversAB(true); toggleReliefAB(true);
    const rec = attachLabBake(s, bodyOf(b), { ...sm.deps, compute: (body) => buildLabBundleForBody(body, m) });
    s.onBeforeRender({});
    const u = s.material.uniforms;
    expect(rec.rivers.ribbon.visible).toBe(false);
    expect(u.uRiverCarveStrength.value).toBe(0);
    expect(u.uReliefBakeStrength.value).toBe(0);
    expect(u.uCraterBakeRestore.value).toBe(1);
    toggleRiversAB(false); toggleReliefAB(false);
    expect(rec.rivers.ribbon.visible).toBe(true);
    expect(u.uRiverCarveStrength.value).toBe(0.01);
    expect(u.uReliefBakeStrength.value).toBe(rec.relief.strength);
    expect(u.uCraterBakeRestore.value).toBe(rec.relief.restore);
    disposeLabBake(s);
  }, 120000);

  it('⭐ ASYNC on the WORKER SHAPE: the four geometry rebuilders run, and the crater cube rides the relief\'s position + index', async () => {
    const b = pick('wet'); const s = fakeSurface({ packSea: 0.31, packCoast: 1 });
    const sm = seams(); const m = small();
    const bundle = buildLabBundleForBody(bodyOf(b), m);
    const payload = workerPayloadOf(bundle);
    const rec = attachLabBake(s, bodyOf(b), { ...sm.deps, compute: () => tick().then(() => payload) });
    s.onBeforeRender({});
    expect(rec.pending).toBe(true);
    await tick(); await tick();
    s.onBeforeRender({});
    const u = s.material.uniforms;
    expect(rec.baked).toBe(true); expect(rec.routeMs).toBe(payload.routeMs);
    expect(sm.prov.length).toBe(1); expect(sm.hgt.length).toBe(2); expect(sm.carve.length).toBe(1);

    // ── which texture is in which slot, and which arrays each cube was rebuilt from ──
    expect(u.uProvinceCube.value).toBe(sm.prov[0].texture);
    expect(u.uRiverCarveMap.value).toBe(sm.carve[0].texture);
    const reliefCube = sm.hgt.find((c) => eqBytes(c.lastGeo.getAttribute('aHeight').array, bundle.marginHeight));
    const craterCube = sm.hgt.find((c) => eqBytes(c.lastGeo.getAttribute('aHeight').array, bundle.craterOverlay));
    expect(reliefCube, 'no height cube was fed the composited relief').toBeTruthy();
    expect(craterCube, 'no height cube was fed the crater overlay').toBeTruthy();
    expect(reliefCube).not.toBe(craterCube);
    expect(u.uReliefBakeCube.value).toBe(reliefCube.texture);
    expect(u.uCraterBakeCube.value).toBe(craterCube.texture);
    expect(eqBytes(reliefCube.lastGeo.getAttribute('aGrad').array, bundle.marginGrad)).toBe(true);
    expect(eqBytes(craterCube.lastGeo.getAttribute('aGrad').array, bundle.craterGrad)).toBe(true);
    // ⭐ ZERO-COPY: the posted array IS the attribute's array, not a copy of it
    expect(reliefCube.lastGeo.getAttribute('position').array).toBe(payload.relief.pos);
    expect(reliefCube.lastGeo.getAttribute('aHeight').array).toBe(payload.relief.hgt);
    expect(craterCube.lastGeo.getAttribute('aHeight').array).toBe(payload.crater.hgt);
    // ⭐ AND THE SHARING THE PAYLOAD DEPENDS ON: the crater cube reuses the relief's OWN attribute
    // objects, because the worker posts one copy of a sphere both cubes are drawn on.
    expect(craterCube.lastGeo.getAttribute('position')).toBe(reliefCube.lastGeo.getAttribute('position'));
    expect(craterCube.lastGeo.getIndex()).toBe(reliefCube.lastGeo.getIndex());

    // ── the carve footprint's three channels, spelled the way createCarveCubeMap reads them ──
    const carveGeo = sm.carve[0].lastGeo;
    for (const n of ['aDepth', 'aMouth', 'aOrder']) expect(carveGeo.getAttribute(n), n).toBeTruthy();
    expect(carveGeo.getAttribute('aDepth').array).toBe(payload.valley.aDepth);
    expect(carveGeo.getIndex().array).toBe(payload.valley.idx);

    // ── the ribbon, rebuilt from three arrays with its normals recomputed here ──
    const ribbon = rec.rivers.ribbon;
    expect(s.children[0]).toBe(ribbon);
    expect(ribbon.geometry.getAttribute('position').array).toBe(payload.ribbon.pos);
    expect(ribbon.geometry.getAttribute('color').array).toBe(payload.ribbon.col);
    expect(ribbon.geometry.getIndex().array).toBe(payload.ribbon.idx);
    expect(ribbon.geometry.getAttribute('normal'), 'the worker does not post normals; the host must recompute them').toBeTruthy();
    expect(ribbon.geometry.getAttribute('normal').count).toBe(ribbon.geometry.getAttribute('position').count);

    // ── the sea, unwrapped from `payload.sea` and not from a top-level key ──
    expect(u.uSeaLevel.value).toBe(payload.sea.seaLevel);
    expect(rec.rivers.seaLevel).toBe(payload.sea.seaLevel);
    expect(u.uCoastStrength.value).toBe(1);
    expect(u.uRiverCarveStrength.value).toBe(0.01);
    expect(u.uReliefBakeStrength.value).toBe(payload.strength);
    expect(u.uCraterBakeRestore.value).toBe(payload.restore);
    disposeLabBake(s);
    expect(sm.all().map((c) => c.disposes)).toEqual([1, 1, 1, 1]);
  }, 120000);

  it('⭐ a bake that THROWS still HOLDS every target it allocated, so dispose can release them', () => {
    // ⛔ THE LEAK THIS GATES: a cube is a WebGLCubeRenderTarget the moment it is created (50.3 MB on
    // the carve one). `dispose()` releases what the record HOLDS and nothing else, and the catch in
    // `onBeforeRender` records `failed` without releasing anything — so a cube created and then lost
    // to a throw inside `update()` would be unreachable for the life of the page.
    const b = pick('wet'); const s = fakeSurface({ packSea: 0.31, packCoast: 1 }); const ph = placeholdersOf(s);
    const sm = seams(); const m = small();
    const boom = (args) => { const c = sm.deps.createHeightCube(args); c.update = () => { throw new Error('relief bake exploded'); }; return c; };
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    let rec;
    try {
      rec = attachLabBake(s, bodyOf(b), { ...sm.deps, createHeightCube: boom, compute: (body) => buildLabBundleForBody(body, m) });
      s.onBeforeRender({});
    } finally { warn.mockRestore(); }
    expect(rec.failed).toMatch(/relief bake exploded/);
    expect(rec.baked).toBe(false);
    // the province cube bound before the throw, and the relief target was allocated at it
    expect(rec.cube).toBe(sm.prov[0]);
    expect(rec.relief.cube).toBe(sm.hgt[0]);
    expect(sm.hgt.length).toBe(1);                       // the crater cube was never reached
    expect(rec.relief.craterCube).toBe(null); expect(rec.rivers.carveCube).toBe(null);
    expect(rec.bytes.relief).toBe(cubeBytes(RELIEF_CUBE_SIZE));   // allocated ⇒ its VRAM is real
    expect(rec.bytes.crater).toBe(0);

    disposeLabBake(s);
    expect(sm.prov[0].disposes).toBe(1);
    expect(sm.hgt[0].disposes).toBe(1);                  // ⭐ the half-baked target IS released
    expect(s.material.uniforms.uProvinceCube.value).toBe(ph.prov);
    expect(s.material.uniforms.uReliefBakeCube.value).toBe(ph.relief);
  }, 120000);

  it('⭐ a bake that THROWS on a WET body gives the pack\'s sea back — the shoreline must not vanish', () => {
    // ⛔ `record.failed` makes the hook return early on every later frame, so the −1 attach wrote
    // would stand for the life of the body. That is the defect the deferral exists to prevent.
    const b = pick('wet'); const s = fakeSurface({ packSea: 0.31, packCoast: 1 });
    const sm = seams(); const m = small();
    const boom = (args) => { const c = sm.deps.createHeightCube(args); c.update = () => { throw new Error('relief bake exploded'); }; return c; };
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    let rec;
    try {
      rec = attachLabBake(s, bodyOf(b), { ...sm.deps, createHeightCube: boom, compute: (body) => buildLabBundleForBody(body, m) });
      expect(s.material.uniforms.uSeaLevel.value).toBe(-1);        // attach deferred it
      s.onBeforeRender({}); s.onBeforeRender({});                  // and the hook is now dead
    } finally { warn.mockRestore(); }
    const u = s.material.uniforms;
    expect(rec.failed).toBeTruthy(); expect(rec.rivers.seaLevel).toBe(null);
    expect(u.uSeaLevel.value).toBe(0.31);
    expect(u.uCoastStrength.value).toBe(1);
    // …and nothing gouges: no valley was ever rasterized
    expect(u.uRiverCarveStrength.value).toBe(0); expect(u.uRiverCarveFloor.value).toBe(0);
    expect(u.uRiverCarveDepth.value).toBe(0); expect(u.uRiverCarveRough.value).toBe(0);
    expect(s.children.length).toBe(0);
    disposeLabBake(s);
    expect(u.uSeaLevel.value).toBe(0.31);                          // and dispose leaves it there
  }, 120000);

  it('⭐ a SUCCESSFUL bake that solves no sea on a wet body gives the pack\'s value back — the silent −1, closed', async () => {
    // ⛔ THE DEFECT THIS GATES, and it is the one the whole-branch review found. `record.failed` had a
    // guard; `record.baked` did not. Attach takes a wet body's `uSeaLevel` to −1 so the sea arrives
    // WITH the rivers, and `record.baked` makes the hook return early on every later frame — so a bake
    // that SUCCEEDS without writing a level leaves −1 standing for the life of the body. The shader
    // reads −1 as "no liquid": the ocean simply never appears, on a body the pack said was wet, with
    // nothing red anywhere and no exception to catch.
    //
    // THE PATH THAT PRODUCES IT: the host classes the body from `condition` and the WORKER classes it
    // again inside its own `buildLabBundleForBody`. Those are two `fluvialClassOf` calls across a
    // structured clone. Disagree — a mangled condition, a stale worker chunk carrying an older pack —
    // and the host admits a body whose payload has `sea: null` and no ribbon. Driven here by handing
    // the host exactly that payload, which is cheaper and more honest than simulating a stale chunk.
    const b = pick('wet'); const s = fakeSurface({ packSea: 0.31, packCoast: 1 });
    const sm = seams(); const m = small();
    const bundle = buildLabBundleForBody(bodyOf(b), m);
    // the payload the worker WOULD post for a relict body, handed to a host that says `wet`
    const payload = { ...workerPayloadOf(bundle), fluvialClass: 'relict', ribbon: null, sea: null };
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    let rec, said = [];
    try {
      rec = attachLabBake(s, bodyOf(b), { ...sm.deps, compute: () => tick().then(() => payload) });
      expect(rec.rivers.admitted, 'the HOST still says wet — that is what makes the disagreement dangerous').toBe(true);
      s.onBeforeRender({});
      expect(s.material.uniforms.uSeaLevel.value).toBe(-1);          // attach deferred it, as on any wet body
      await tick(); await tick();
      s.onBeforeRender({});
      // ⚠ READ THE CALLS BEFORE THE RESTORE. `mockRestore()` in vitest also RESETS the spy, so
      // `warn.mock.calls` is empty afterwards — the first draft of this test asserted on an empty
      // array and reported "no warning" for a host that had warned twice.
      said = warn.mock.calls.map((c) => String(c[0]));
    } finally { warn.mockRestore(); }
    const u = s.material.uniforms;

    // the bake SUCCEEDED — which is exactly why the failure-path guard could not see this
    expect(rec.baked).toBe(true); expect(rec.failed).toBe(null);
    expect(rec.rivers.class).toBe('wet');                            // the host's own class, from fluvialClassOf
    expect(rec.rivers.seaLevel).toBe(null);
    // ⭐ THE PACK'S SEA IS BACK, and the coast with it
    expect(u.uSeaLevel.value).toBe(0.31);
    expect(u.uCoastStrength.value).toBe(1);
    // …and the admitted half was withheld: no ribbon child, no gouging
    expect(s.children.length).toBe(0); expect(rec.rivers.ribbon).toBe(null);
    expect(u.uRiverCarveStrength.value).toBe(0); expect(u.uRiverCarveRough.value).toBe(0);
    // the province + relief + crater + carve cubes still bound — this is a withholding, not a failure
    expect(sm.prov.length).toBe(1); expect(sm.hgt.length).toBe(2); expect(sm.carve.length).toBe(1);
    expect(u.uRiverCarveMap.value).toBe(sm.carve[0].texture);

    // BOTH warnings fired, and they are named: the disagreement, and the restore
    expect(said.some((t) => t.includes('class disagreement') && t.includes('wet') && t.includes('relict')),
      `the disagreement must name BOTH classes — got ${JSON.stringify(said)}`).toBe(true);
    expect(said.some((t) => t.includes('without a solved sea')),
      `the restore must say so — got ${JSON.stringify(said)}`).toBe(true);
    disposeLabBake(s);
    expect(u.uSeaLevel.value).toBe(0.31);
  }, 120000);

  it('⭐ the WORKER post carries radiusEarth — without it the worker defaults R = 1 and every body binds at strength 1.0', () => {
    // ⛔ RUNS LAST IN THIS BLOCK ON PURPOSE. `workerOrNull()` caches the worker it builds for the
    // lifetime of the module, so installing a fake `Worker` global flips `provinceTransport()` to
    // 'worker' for every later attach in this file. Every other case above pins its own `compute`
    // seam, but ordering it last means none of them can be reached by this one even so.
    const posted = [];
    class FakeWorker { constructor(url, opts) { this.url = url; this.opts = opts; } postMessage(m) { posted.push(m); } terminate() {} }
    const prev = Object.getOwnPropertyDescriptor(globalThis, 'Worker');
    Object.defineProperty(globalThis, 'Worker', { value: FakeWorker, configurable: true, writable: true });
    try {
      const b = RIVER_BODIES.find((x) => compositionClass(x.cond) !== 'gas' && x.cond.radiusEarth !== 1);
      expect(b, 'the corpus carries no solid body away from 1 R⊕').toBeTruthy();
      const s = fakeSurface(); const sm = seams();
      const rec = attachLabBake(s, bodyOf(b), sm.deps);
      s.onBeforeRender({});
      expect(rec.transport).toBe('worker');
      expect(posted.length).toBe(1);
      expect(Object.keys(posted[0]).sort()).toEqual(['T_eq', 'condition', 'id', 'macroSeed', 'radiusEarth']);
      expect(posted[0].radiusEarth).toBe(b.cond.radiusEarth);
      expect(posted[0].radiusEarth).not.toBe(1);                  // non-vacuous: the default would be 1
      disposeLabBake(s);
    } finally {
      if (prev) Object.defineProperty(globalThis, 'Worker', prev); else delete globalThis.Worker;
    }
  });
});
