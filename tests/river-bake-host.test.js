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
// ⭐ TASK 4 (2026-09-02) — AC-2/AC-3's imports. `buildLabBundleForBody` is the CPU half of the whole
// route() bundle (province + relief + crater + carve + ribbon), and the worker below carries it in one
// message. The LAB side of every comparison comes through `../planet-lod-rivers.js` (aliased `…ViaLab`
// above), so AC-2 compares the game's bundle against route()'s own sequence re-read through the lab's
// import path rather than against a second copy of it living in this file.
import { buildLabBundleForBody, sharedCarrierMesh, bodyDriversFromCondition } from '../src/rendering/bake/provinceDispatch.js';
import { makeSphereField } from '../src/worldengine/base/sphereField.js';
import { buildIrregularSphere } from '../src/worldengine/mesh/sphereMesh.js';
import { writeBodyRelief as writeBodyReliefViaLab, DEFAULT_GRAIN_DRIVERS as GRAIN_VIA_LAB } from '../planet-lod-rivers.js';
import { bakeReliefCrossover, visScaleOf } from '../src/worldengine/base/labCore.js';

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

      // the two geometries
      for (const attr of ['position', 'color']) {
        expect(bytes(got.ribbonGeo.getAttribute(attr).array), `ribbon.${attr}`).toEqual(bytes(want.ribGeo.getAttribute(attr).array));
      }
      expect(bytes(got.ribbonGeo.getIndex().array)).toEqual(bytes(want.ribGeo.getIndex().array));
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
      const baseRib = ribbonViaLab({ mesh: mLab, routed: want.routed, params: PARAMS_VIA_LAB });
      expect(bytes(baseRib.getAttribute('position').array),
        'the ribbon must be built with pEff — base params give a different width').not.toEqual(bytes(got.ribbonGeo.getAttribute('position').array));
    }, 120000);
  }

  it('over the corpus: 68 bodies route with 0 orphans / 0 uphill receivers and every channel drains to the sea; 56 airless bodies are not routed', () => {
    const mesh = small();
    let routed = 0, notRouted = 0, composited = 0, orphan = 0, uphill = 0, selfLoopLand = 0, badDrain = 0, mouths = 0;
    let oceanFracMin = 1, oceanFracMax = 0;
    for (const b of RIVER_BODIES) {
      if (compositionClass(b.cond) === 'gas') continue;
      const got = buildLabBundleForBody(bodyOf(b), mesh);
      expect(got.fluvialClass, `${b.seed}/${b.kind}`).toBe(fluvialClassOf(b.cond));
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
      if (got.marginHeight !== got.carrier.height) composited++;
      const r = got.routedGraph;
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
    expect(routed).toBe(68);          // wet 4 + relict 64 (AC-1's split)
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
    recordCorpus({ routing: { routed, notRouted, composited, orphan, uphill, selfLoopLand, badDrain, mouths,
      oceanFraction: { min: +oceanFracMin.toFixed(4), max: +oceanFracMax.toFixed(4), target: DEFAULT_PARAMS.TARGET_OCEAN_FRACTION },
      mesh: { targetN: 2500, lloyd: 2 } } });
  }, 600000);

  it('AC-7 RECORDED — the three timed bodies (one wet, one relict, one airless) on the REAL 40000/4 carrier', () => {
    const mesh = sharedCarrierMesh();
    const timings = [];
    for (const cls of ['wet', 'relict', 'airless']) {
      const b = RIVER_BODIES.find((x) => compositionClass(x.cond) !== 'gas' && fluvialClassOf(x.cond) === cls);
      expect(b, `the corpus has no ${cls} body`).toBeTruthy();
      const got = buildLabBundleForBody(bodyOf(b), mesh);
      expect(got.fluvialClass).toBe(cls);
      expect(got.marginHeight.length).toBe(40000);
      timings.push({ cls, seed: b.seed, kind: b.kind, radiusEarth: +b.cond.radiusEarth.toFixed(4),
        dispatchMs: +got.ms.toFixed(1), routeMs: +got.routeMs.toFixed(1), totalMs: +(got.ms + got.routeMs).toFixed(1),
        strength: got.strength, routed: got.routed,
        channelCount: got.routedGraph ? got.routedGraph.channelCount : null,
        ribbonVerts: got.ribbonGeo ? got.ribbonGeo.getAttribute('position').count : 0,
        valleyVerts: got.valleyGeo ? got.valleyGeo.getAttribute('position').count : 0 });
    }
    recordCorpus({ timedBodies: timings, meshBuildMsNote: 'the 40000/4 carrier is built once per session (measured ~640 ms) and is NOT in these numbers' });
    for (const t of timings) { expect(t.dispatchMs).toBeGreaterThan(0); expect(t.routeMs).toBeGreaterThan(0); }
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
    const zero = RIVER_BODIES.filter((b) => compositionClass(b.cond) !== 'gas' && fluvialClassOf(b.cond) === 'wet'
      && bakeReliefCrossover(visScaleOf(b.cond.radiusEarth)) === 0);
    writeFileSync(join(process.env.TMPDIR || tmpdir(), 'river-strength-zero.json'), JSON.stringify({
      wetWithZeroStrength: zero.length,
      bodies: zero.map((b) => ({ seed: b.seed, kind: b.kind, radiusEarth: b.cond.radiusEarth })),
      solidWithZeroStrength: RIVER_BODIES.filter((b) => compositionClass(b.cond) !== 'gas'
        && bakeReliefCrossover(visScaleOf(b.cond.radiusEarth)) === 0).length,
      note: 'counted, not gated — a non-zero wetWithZeroStrength is surfaced to Max (contract AC-3); the bundle marks such a body routedOnUndisplayedField',
    }, null, 2));
    // the FLAG is gated (the bundle must be honest about what it did), the COUNT is not
    const mesh = small();
    for (const b of RIVER_BODIES) {
      if (compositionClass(b.cond) === 'gas' || fluvialClassOf(b.cond) !== 'wet') continue;
      const got = buildLabBundleForBody(bodyOf(b), mesh);
      expect(got.routedOnUndisplayedField, `${b.seed}/${b.kind}`).toBe(got.routed && got.strength === 0);
    }
    expect(typeof zero.length).toBe('number');
  }, 600000);
});
