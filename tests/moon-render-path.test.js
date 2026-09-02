// tests/moon-render-path.test.js — PLAN §4 Step 10's NAMED GATE on the plain-moon render path.
//
// ═════════════════════════════════════════════════════════════════════════════════════════════════
// WHAT THIS FILE IS, AND HOW IT DIVIDES FROM `tests/moon-lab-mount.test.js`
// ═════════════════════════════════════════════════════════════════════════════════════════════════
// Step 10 landed in three parts and each part needed a different kind of evidence:
//   · 10a/10b — the MOUNT MECHANICS. Does `Moon._createMesh` reach the shared sequence, does the
//     per-frame seam advance the clock, does `.surface` stay unset. `tests/moon-lab-mount.test.js`
//     is that file and it stays that file.
//   · 10c — the RENDER PATH AS A WHOLE. Can an instrument still FIND a moon after the scene walk's
//     owner prefix widened; does the whole generated POPULATION admit; is the back-link the same
//     shape a planet's is; is the driven value a real distribution or one constant; is Sol still
//     structurally refused; do the two no-fallback shadow writers stay no-ops when CALLED.
// The per-class quad appears in BOTH files on purpose. It is the assertion that fails if this step
// ships a degenerate shared pipeline, so it gates the mount and it gates the render path, and a
// gate that only one of two files carries is a gate that a file deletion silently removes.
//
// ⛔ TWO THINGS THIS FILE REFUSES TO ASSERT, EACH FOR A MEASURED REASON:
//   · NOT ">= 95% of plain moons resolve a non-zero uCraterDensity". MEASURED over the corpus
//     below: 473/632 = 74.8%. The 151-body shortfall is `CRATER_MIN_DENSITY` in craterUniforms.js  ⭐ RE-MEASURED 2026-08-20 AFTER B2 LEG 1: 547/632 = 86.6%; that constant was retired into `CRATER_MIN_VISIBLE`, which refuses 77 of the remaining 85 (the other 8 are schedule-refused). The refusal to assert the bar is unchanged and so is its reason.
//     declining to seed craters on small/young bodies — a CRATER-LAW question that no edit in this
//     step could move. Writing it would red this file for a reason Step 10 does not own. The
//     DISTINCTNESS half is kept instead, and it is the half that discriminates: a dead wire pinning
//     every moon to one value passes "non-zero" and fails distinctness by two orders of magnitude.
//   · NOT INSTRUMENT D. D is >= 120 live frames with `window.onerror` + `unhandledrejection`
//     installed and rAF observed to advance. That needs a browser. jsdom cannot produce it, an
//     approximation of it would be quoted later as if it were the real thing, and this file does
//     not contain one. D IS OWED. (`tests/instrument-d-frame-survival.test.js` gates D's VERDICT
//     function, which is the decision half; the collection half is what is owed.)

import { describe, it, expect, afterEach } from 'vitest';
import * as THREE from 'three';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative, sep } from 'node:path'; import { stripCommentsPreservingOffsets } from './helpers/source-scan.mjs';
import { StarSystemGenerator } from '../src/generation/StarSystemGenerator.js';
import { generateSolarSystem } from '../src/generation/SolarSystemData.js';
import { BodyRenderer } from '../src/rendering/objects/BodyRenderer.js';
import {
  Planet, setLabGasBodiesOverride, labPipelineAdmits, worldEngineProvenance, SOL_SYSTEM_SEED,
} from '../src/objects/Planet.js';
import { conditionFromBody } from '../src/worldengine/port/conditionFromBody.js';
import { isLabPlanetMaterial } from '../src/rendering/LabPlanetMaterial.js';
import { compositionClass } from '../src/worldengine/base/e1Regime.js';
import { assignBodyName } from '../src/util/scene-naming.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const MAIN_SRC = readFileSync(join(ROOT, 'src/main.js'), 'utf8');

// ── The corpus, named once so no number in this file is ever quoted bare ─────────────────────────
// `lab-procedural-0 … lab-procedural-199` — 200 generated systems, the same list Step 10's recon and
// `tests/moon-lab-mount.test.js` measure against, so every count below is reproducible by re-running
// rather than by trusting a comment. `lab-procedural-6` is the FIRST seed in that list that carries
// all four body classes at once, which is what the per-class quad needs and why it is named here.
const CORPUS = Array.from({ length: 200 }, (_, i) => `lab-procedural-${i}`);
const CORPUS_LABEL = 'lab-procedural-0…199';
const QUAD_SEED = 'lab-procedural-6';

const LIGHT = () => new THREE.Vector3(0.6, 0.3, 0.7).normalize();
const REFS = () => ({ lightDir: LIGHT(), lightDir2: null });
const buildable = (d) => ({ sunDirection: [1, 0, 0], ...d });

/** Every plain (non-planet-class) moon in one generated system. */
function plainMoonsOf(seed) {
  const out = [];
  for (const e of StarSystemGenerator.generate(seed, null).planets) {
    for (const m of (e.moons || [])) if (!m.isPlanetMoon) out.push(m);
  }
  return out;
}
const aRealPlainMoon = () => plainMoonsOf('lab-procedural-0')[0];

/**
 * The u-prefixed uniform set of a material, as BOTH a flattened string (for whole-bag snapshots)
 * and a keyed map (for per-name comparison). The map is what the per-class quad needs: a whole-bag
 * comparison cannot say WHICH names differ, and §6 below turns on exactly that distinction.
 */
const resolvedUniforms = (material) => {
  const u = material.uniforms;
  const keys = Object.keys(u).filter((k) => /^u[A-Z]/.test(k)).sort();
  const map = Object.fromEntries(keys.map(
    (k) => [k, u[k].value?.toArray ? u[k].value.toArray() : u[k].value],
  ));
  return { keys, map, json: JSON.stringify(map) };
};

afterEach(() => setLabGasBodiesOverride(null));

// ═════════════════════════════════════════════════════════════════════════════════════════════════
// 0. THE WALK — Step 10c's own edit, and the only gate on it
// ═════════════════════════════════════════════════════════════════════════════════════════════════
// `_lab.bodySurfaces()` is the list every Instrument E hook discovers bodies through, and
// `tryLabShader` calls it with NO options, so its DEFAULT `ownerPrefix` is the filter. Until 10c
// that default was `body.planet.`, which admitted planets and planet-class moons (they are `Planet`
// instances and get named `body.planet.*`) and excluded PLAIN moons — the one class Step 10 ships.
//
// The walk lives inside a 15 000-line module with import-time side effects, so it cannot be
// imported. It is SLICED OUT OF THE SHIPPED FILE and executed, the same discipline
// `tests/moon-shadow-write-guard.test.js` and `tests/instrument-d-frame-survival.test.js` use: a
// transcription here would be a second expression of the law and would go green while the shipped
// one rotted. Brace-matching runs on comment-stripped text so a quoted copy inside a comment cannot
// stand in for live code; the text that is COMPILED is cut from raw source.

const WALK_SIG = 'bodySurfaces(opts = {}) {';

function extractWalk(source = MAIN_SRC) {
  const stripped = stripCommentsPreservingOffsets(source);
  const sig = stripped.indexOf(WALK_SIG);
  if (sig < 0) throw new Error('bodySurfaces signature not found in src/main.js');
  // `WALK_SIG` ends on the BODY's opening brace — not the `{}` of the default parameter.
  const open = sig + WALK_SIG.length - 1;
  let depth = 0; let i = open;
  for (; i < stripped.length; i++) {
    if (stripped[i] === '{') depth++;
    else if (stripped[i] === '}') { depth--; if (depth === 0) break; }
  }
  return source.slice(open + 1, i);
}

// The body closes over exactly three free names: the module-scope `scene`, the imported
// `isLabPlanetMaterial`, and its own `opts` parameter. Injecting the REAL `isLabPlanetMaterial`
// rather than a stub keeps "is this body swapped" answered by the shipped signature test.
const compileWalk = (src) => new Function('scene', 'isLabPlanetMaterial', 'opts', src);

/**
 * A scene in the two shapes the walk has to tell apart, built from REAL objects.
 *
 * ⚠ WHAT IS REAL AND WHAT IS A STAND-IN, said plainly. The planet is a real `Planet` (a named
 * `body.planet.*` GROUP whose drawn surface is an UNNAMED child, so the walk has to reach through
 * `o.parent?.name`) and the moons are real `BodyRenderer.createMoon` products (a named
 * `body.moon.*` MESH that IS its own surface). The star and the belt are real NAMES from the
 * shipped `assignBodyName` carrying stand-in materials — constructing a `StarRenderer` needs
 * textures this environment has no business building. What ties those two stand-ins to the real
 * thing is the raw-text fence below, which asserts that of the four `assignBodyName` kinds only
 * planet and moon declare the `noiseScale` uniform the walk keys on.
 */
function buildScene() {
  const scene = new THREE.Group();
  const d = aRealPlainMoon();

  setLabGasBodiesOverride(false);
  const planet = new Planet(buildable(StarSystemGenerator.generate('lab-procedural-0', null).planets[0].planetData), null);
  const legacyMoon = BodyRenderer.createMoon(d, null, null, REFS());
  setLabGasBodiesOverride(true);
  const swappedMoon = BodyRenderer.createMoon(plainMoonsOf('lab-procedural-0')[1], null, null, REFS());
  setLabGasBodiesOverride(null);

  const star = new THREE.Mesh(new THREE.SphereGeometry(1, 4, 2), new THREE.ShaderMaterial({ uniforms: { time: { value: 0 } } }));
  assignBodyName(star, 'star', { _systemSeed: 'lab-procedural-0' }, 0);
  const belt = new THREE.Points(new THREE.BufferGeometry(), new THREE.PointsMaterial());
  assignBodyName(belt, 'asteroid-belt', { _systemSeed: 'lab-procedural-0' }, 0);

  scene.add(planet.mesh, legacyMoon.mesh, swappedMoon.mesh, star, belt);
  return { scene, planet, legacyMoon, swappedMoon, star, belt };
}

describe('0. the scene walk, widened at Step 10c', () => {
  it('the SHAPES the walk must tell apart are the shapes the game really builds', () => {
    // If this rots, every assertion below is testing a scene the game does not produce. A planet's
    // drawn mesh is an unnamed CHILD; a plain moon's drawn mesh IS the named object.
    const { planet, legacyMoon } = buildScene();
    expect(planet.mesh.name).toMatch(/^body\.planet\./);
    expect(planet.surface.name).toBe('');
    expect(planet.mesh.children).toContain(planet.surface);
    expect(planet.surface.material.uniforms.noiseScale).toBeDefined();
    expect(legacyMoon.mesh.name).toMatch(/^body\.moon\./);
    expect(legacyMoon.mesh.geometry).toBeTruthy();
    expect(legacyMoon.mesh.material.uniforms.noiseScale).toBeDefined();
  });

  it('⭐ THE SHIPPED DEFAULT ADMITS PLAIN MOONS — and still admits planets', () => {
    const { scene, planet, legacyMoon, swappedMoon } = buildScene();
    const out = compileWalk(extractWalk())(scene, isLabPlanetMaterial, {});
    expect(out.ownerPrefix).toBe('body.');
    const names = out.surfaces.map((s) => s.name);
    expect(names).toContain(planet.mesh.name);
    expect(names).toContain(legacyMoon.mesh.name);
    expect(names).toContain(swappedMoon.mesh.name);
    // A SWAPPED moon has to stay in its own list. The lab material declares `uNoiseScale`, not
    // `noiseScale`, so without the `isLabPlanetMaterial` half of the test a moon would vanish from
    // the walk the instant an instrument swapped it — the silent renumbering Step 4 fixed.
    const swappedRow = out.surfaces.find((s) => s.name === swappedMoon.mesh.name);
    expect(swappedRow.swapped).toBe(true);
    expect(swappedRow.hasBackLink).toBe(true);
    expect(out.surfaces.find((s) => s.name === legacyMoon.mesh.name).swapped).toBe(false);
  });

  it('⭐ STARS AND BELTS DO NOT JOIN — `body.` is a wider prefix, not a wider material test', () => {
    // The prefix is only half the filter. Widening it to `body.` puts stars and asteroid belts in
    // range of the NAME test for the first time, and the only thing keeping them out is that their
    // materials declare neither `noiseScale` nor the lab signature.
    const { scene, star, belt } = buildScene();
    const out = compileWalk(extractWalk())(scene, isLabPlanetMaterial, {});
    const names = out.surfaces.map((s) => s.name);
    expect(star.name).toMatch(/^body\.star\./);
    expect(belt.name).toMatch(/^body\.asteroid-belt\./);
    expect(names).not.toContain(star.name);
    expect(names).not.toContain(belt.name);
  });

  it('⭐ COMMITTED MUTANT — restore the pre-10c prefix in the SHIPPED text and moons vanish', () => {
    // Without this control the three tests above also pass on a walk that never changed: a mesh
    // named `body.moon.*` is admitted by `body.planet.`… no it is not, and that is exactly the
    // point — this mutant is what proves the widening is the thing doing the work, rather than
    // some other property of the scene these fixtures happen to have.
    const shipped = extractWalk();
    expect(shipped.split("?? 'body.'").length - 1, 'the default must appear exactly once').toBe(1);
    const mutant = shipped.replace("?? 'body.'", "?? 'body.planet.'");
    expect(mutant).not.toBe(shipped);

    const { scene, planet, legacyMoon, swappedMoon } = buildScene();
    const before = compileWalk(mutant)(scene, isLabPlanetMaterial, {});
    const after = compileWalk(shipped)(scene, isLabPlanetMaterial, {});
    expect(before.ownerPrefix).toBe('body.planet.');
    expect(before.surfaces.map((s) => s.name)).toContain(planet.mesh.name);
    expect(before.surfaces.map((s) => s.name)).not.toContain(legacyMoon.mesh.name);
    expect(before.surfaces.map((s) => s.name)).not.toContain(swappedMoon.mesh.name);
    expect(after.count).toBeGreaterThan(before.count);
  });

  it('⛔ THE INDEX SPACE MOVED — a recorded integer now addresses a different body', () => {
    // Not a style point. `tryLabShader(index)` takes an integer into this list, and shot recipes
    // in the docs say `await window._lab.tryLabShader(0)`. After the widening, index i is a
    // different mesh, so a replay by integer photographs a body nobody touched and reports success.
    // Recorded here as an executable fact so the next person reads it as a hazard, not as advice.
    const { scene } = buildScene();
    const wide = compileWalk(extractWalk())(scene, isLabPlanetMaterial, {});
    const narrow = compileWalk(extractWalk().replace("?? 'body.'", "?? 'body.planet.'"))(scene, isLabPlanetMaterial, {});
    const shifted = wide.surfaces.some((s, i) => narrow.surfaces[i] && narrow.surfaces[i].name !== s.name)
      || wide.count !== narrow.count;
    expect(shifted, 'the widening must move the index space — otherwise it admitted nothing').toBe(true);
    // The escape hatch is the same one it always was: the list is keyed by NAME.
    expect(wide.surfaces.every((s) => typeof s.name === 'string' && s.name.length > 0)).toBe(true);
  });

  it('⭐ ONLY PLANET AND MOON MATERIALS DECLARE `noiseScale` — the fence under the stand-ins', () => {
    // The star and belt entries above carry stand-in materials, so on their own they prove only
    // that the walk's material test works. THIS is what ties them to the shipped renderers: of the
    // four kinds `assignBodyName` produces, exactly two declare the uniform the walk keys on.
    // MEASURED at this commit: `noiseScale: {` appears in src/objects/Moon.js, src/objects/Planet.js
    // and src/rendering/TextureBaker.js — and TextureBaker's meshes are never named `body.*`,
    // because it is not one of the `assignBodyName` call sites this test enumerates. If a star or a
    // belt material ever gains the uniform, the widened prefix admits a whole new body class in
    // silence, and this reds instead.
    const files = [];
    (function collect(dir) {
      for (const e of readdirSync(dir)) {
        const p = join(dir, e);
        if (statSync(p).isDirectory()) collect(p);
        else if (e.endsWith('.js')) files.push(p);
      }
    }(join(ROOT, 'src')));
    const namers = []; const declarers = [];
    for (const p of files) {
      const rel = relative(ROOT, p).split(sep).join('/');
      const src = stripCommentsPreservingOffsets(readFileSync(p, 'utf8'));
      if (rel !== 'src/util/scene-naming.js' && /assignBodyName\(/.test(src)) namers.push(rel);
      if (/^\s*noiseScale: \{/m.test(src)) declarers.push(rel);
    }
    expect(namers.sort()).toEqual([
      'src/objects/AsteroidBelt.js', 'src/objects/Moon.js', 'src/objects/Planet.js',
      'src/rendering/objects/StarRenderer.js',
    ]);
    expect(namers.filter((f) => declarers.includes(f)).sort())
      .toEqual(['src/objects/Moon.js', 'src/objects/Planet.js']);
  });
});

// ═════════════════════════════════════════════════════════════════════════════════════════════════
// 1. ADMISSION — the whole generated population, named with its corpus
// ═════════════════════════════════════════════════════════════════════════════════════════════════

describe('1. admission over the corpus', () => {
  it(`⭐ every plain moon over ${CORPUS_LABEL} mounts the lab material with the flag ON`, () => {
    // ⛔ THE COUNT IS REPORTED, NOT PINNED. A hardcoded population integer is exactly what is red
    // elsewhere in this suite right now: an unrelated moon-formation change moved the census and
    // pinned counts went with it. What Step 10 owns is the RATIO — `rockySurface`'s predicate is
    // `compositionClass(condition) !== 'gas'` and MEASURED across the corpus plain moons are
    // {rocky, icy} with zero gas, so entry admission is saturated. If that ever stops being true,
    // some moons render through the lab pipeline and some do not, with nothing complaining.
    setLabGasBodiesOverride(true);
    let plain = 0; let admitted = 0; const classes = {};
    for (const seed of CORPUS) {
      for (const m of plainMoonsOf(seed)) {
        plain++;
        const condition = conditionFromBody(m);
        classes[compositionClass(condition)] = (classes[compositionClass(condition)] || 0) + 1;
        if (labPipelineAdmits(m, condition).admitted) admitted++;
      }
    }
    expect(plain, `${CORPUS_LABEL} must actually carry a moon population`).toBeGreaterThan(500);
    expect(admitted, `${admitted} of ${plain} plain moons over ${CORPUS_LABEL} mount the lab `
      + `material; composition classes seen: ${JSON.stringify(classes)}`).toBe(plain);
    expect(classes.gas, 'a gas-class plain moon would be refused by rockySurface').toBeUndefined();
  });

  it('⭐ THE OFF TWIN AT POPULATION SCALE — the flag forced OFF admits NONE of them', () => {
    // ⭐ FORCED, NOT DEFAULTED, SINCE B7 2026-08-21: this test used to make its point by setting
    // nothing — LAB_GAS_BODIES_DEFAULT was OFF, so the un-set flag WAS the OFF twin at population
    // scale. B7 flips that constant to true, which is Step 12 itself (846/852 planets, 632 moons
    // now admit by default); the un-set flag can no longer stand in for OFF. The population-scale
    // proof this test exists for — one flag value, checked across hundreds of real generated moons,
    // still fully gates admission — is unaffected, so the fix is to name the value explicitly rather
    // than retire the control. One admitted body here would still mean the flag stopped gating.
    setLabGasBodiesOverride(false);
    let admitted = 0; let seen = 0;
    for (const seed of CORPUS.slice(0, 20)) {
      for (const m of plainMoonsOf(seed)) {
        seen++;
        if (labPipelineAdmits(m, conditionFromBody(m)).admitted) admitted++;
      }
    }
    expect(seen).toBeGreaterThan(30);
    expect(admitted, 'the 6e flag forced OFF — no plain moon may admit without it').toBe(0);
  });
});

// ═════════════════════════════════════════════════════════════════════════════════════════════════
// 2. THE BACK-LINK — the same shape a planet writes, or instruments go half-blind
// ═════════════════════════════════════════════════════════════════════════════════════════════════

describe('2. the back-link', () => {
  it('⭐ a mounted plain moon carries `userData.wd` in the SAME SHAPE a mounted planet does', () => {
    // The walk yields a bare mesh and `d` is unreachable from it, so `_lab.resolveBody` and every
    // E caption read exactly these fields. A moon that mounted the material but wrote a different
    // shape would be a body an instrument can find and cannot describe — worse than one it cannot
    // find, because the caption would silently lose fields rather than fail.
    setLabGasBodiesOverride(true);
    const d = aRealPlainMoon();
    const moonWd = BodyRenderer.createMoon(d, null, null, REFS()).mesh.userData.wd;
    const gasGiant = StarSystemGenerator.generate(QUAD_SEED, null).planets
      .map((e) => e.planetData)
      .find((pd) => labPipelineAdmits(pd, conditionFromBody(pd)).admitted);
    expect(gasGiant, `${QUAD_SEED} must carry an admitted planet to compare against`).toBeTruthy();
    const planetWd = new Planet(buildable(gasGiant), null).surface.userData.wd;

    expect(Object.keys(moonWd).sort()).toEqual(Object.keys(planetWd).sort());
    expect(Object.keys(moonWd.lab).sort()).toEqual(Object.keys(planetWd.lab).sort());

    // …and the fields an E caption prints are populated, not merely present.
    expect(moonWd.planetData).toBe(d);
    // ⛔ NOT `toBeTruthy()`. A condition FROZEN at the first moon, or a moon handed its parent
    // planet's, is truthy — MEASURED, that mutation at the shipped mount left the full suite's
    // failing set byte-identical to HEAD. The caption must describe THIS body.
    expect(moonWd.condition).toEqual(conditionFromBody(d));
    expect(moonWd.lab.isLabPipeline).toBe(true);
    expect(moonWd.lab.flag.enabled).toBe(true);
    expect(moonWd.lab.flag.source).toBe('override');       // the flag AND where it came from
    // ⭐ `default` -> true AT B7, 2026-08-21: it always echoes LAB_GAS_BODIES_DEFAULT, not the
    // override this moon was actually built under — an E caption reading `default` off this body
    // must see the real constant, or it would misreport what an un-set flag would have done here.
    expect(moonWd.lab.flag.default).toBe(true);
    // ⭐ `solidOptics` JOINS ON A PLAIN MOON AT B3 LEG 1 — its predicate is `!== 'gas'`, the same
    // one that put `rockySurface` here, so a moon is claimed by both or by neither. ⚠ Its two
    // MAGNITUDES land on zero for a plain moon (no atmosphere ⇒ columnFraction 0 and
    // labCore's `hasAtmo` 0), so what actually reaches the moon is the limb width/hue, the
    // terminator hue/width and four aurora values behind a zero intensity. Recorded because a
    // pack in the list is not the same as a feature on the pixel.
    expect(moonWd.lab.packsApplied).toEqual(['rockySurface', 'solidOptics', 'solidFeatures', 'fluvialDeck']);   // ⭐ `fluvialDeck` joins the plain-moon list 2026-09-02 (the same `!== 'gas'` predicate again). Its sea and channel magnitudes are 0 on an airless moon — a pack in the list is not a feature on the pixel.
    expect(moonWd.lab.packsSkipped.length).toBeGreaterThan(0);
    // `uniformsWritten` is the NAME LIST, not a count — a caption that printed a bare integer
    // could not tell 'the pack wrote 21 uniforms' from 'the pack wrote uCraterDensity 21 times'.
    expect(Array.isArray(moonWd.lab.uniformsWritten)).toBe(true);
    expect(moonWd.lab.uniformsWritten).toContain('uCraterDensity');
    expect(moonWd.lab.uniformsWritten.length).toBeGreaterThan(10);
    expect(moonWd.lab.bodyRadius).toBe(d.radius);
    // ⚠ THE ATTRIBUTE LISTS ARE A DECISION, NOT A LEFTOVER. `rockySurface` bakes nothing, so all
    // four vertex attributes are zero-filled — and that is what makes "which of these is a real
    // bake" readable off the caption instead of guessable.
    expect(moonWd.lab.bakedAttributes).toEqual([]);
    expect(moonWd.lab.zeroFilledAttributes.sort()).toEqual(['aBand', 'aMush', 'aShear', 'aStorm']);
  });
});

// ═════════════════════════════════════════════════════════════════════════════════════════════════
// 3. NOT A DEAD WIRE
// ═════════════════════════════════════════════════════════════════════════════════════════════════

describe('3. the driven value is a distribution', () => {
  it(`⭐ uCraterDensity takes >= 20 distinct values across ${CORPUS_LABEL}`, () => {
    // ⛔ DISTINCTNESS, NOT NON-ZERO, AND THE DIFFERENCE IS THE WHOLE GATE. A wire that came loose
    // and pinned every moon to one constant passes every "non-zero" assertion ever written and
    // renders 632 identical balls. MEASURED at this commit over the corpus: 237 distinct values,
    // 473 of 632 non-zero (74.8%). The bar is 20 — an order of magnitude below the measurement, so
    // ordinary crater-law tuning cannot red it, while a collapsed wire fails it by two orders.
    // The 74.8% is NOT asserted: the 159-body shortfall is `CRATER_MIN_DENSITY` declining to seed  ⭐ RE-MEASURED 2026-08-20 AFTER B2 LEG 1 over `lab-procedural-0…199`: 547 of 632 non-zero (86.6%) with 308 distinct — the bar of 20 is now more than an order of magnitude below the measurement on both halves.
    // craters, a crater-law question this step does not own and could not fix.
    // ⛔ AND THE MATERIAL COMES FROM `BodyRenderer.createMoon`, NOT FROM `Planet._createLabSurface`.
    // The static takes the condition the TEST computes, so measuring it measured a PURE FUNCTION
    // the shipped mount never appears in. MEASURED: freezing the condition inside `Moon._createMesh`
    // — every plain moon in the game rendering ONE identical driver set, verbatim the dead wire
    // this section names — collapsed 632 moons to a single value and left the full suite's failing
    // set byte-identical to HEAD. Through the mount: 237 distinct clean, 1 under that mutant.
    setLabGasBodiesOverride(true);
    const densities = new Set();
    for (const seed of CORPUS) {
      for (const m of plainMoonsOf(seed)) {
        const condition = conditionFromBody(m);
        if (!labPipelineAdmits(m, condition).admitted) continue;
        const mat = BodyRenderer.createMoon(m, null, null, REFS()).mesh.material;
        // Non-vacuity: a mount that silently fell back to the legacy material would add `undefined`
        // once and still clear the bar below.
        expect(isLabPlanetMaterial(mat), `${seed} mounted a non-lab material`).toBe(true);
        densities.add(mat.uniforms.uCraterDensity.value);
      }
    }
    expect(densities.size, `${densities.size} distinct uCraterDensity values over ${CORPUS_LABEL}`)
      .toBeGreaterThanOrEqual(20);
  });
});

// ═════════════════════════════════════════════════════════════════════════════════════════════════
// 4. SOL — a regression fence on the MECHANISM, not a new exclusion
// ═════════════════════════════════════════════════════════════════════════════════════════════════

describe('4. Sol', () => {
  it('⭐ NO SOL BRANCH IS NEEDED — `SolarSystemData` stamps the seed and provenance refuses it', () => {
    // Step 10 shipped with no Sol branch and no Sol test in `Planet.js`, and that is correct: Sol is
    // excluded STRUCTURALLY. `SolarSystemData` stamps `_systemSeed: 'sol'` on every body it emits,
    // and `worldEngineProvenance` blocks on exactly that string. This test fences THAT MECHANISM —
    // if the stamp is ever dropped, or the blocker renamed, Sol's moons enter the pipeline the same
    // day and nothing else in the tree would notice. MEASURED at this commit with the flag forced
    // ON: 0 of Sol's 25 plain moons admit.
    setLabGasBodiesOverride(true);
    const sol = generateSolarSystem();
    const solPlainMoons = [];
    for (const e of (sol.planets || [])) for (const m of (e.moons || [])) if (!m.isPlanetMoon) solPlainMoons.push(m);

    expect(solPlainMoons.length, 'Sol must actually carry plain moons for this fence to mean anything')
      .toBeGreaterThan(10);
    const stamped = solPlainMoons.filter((m) => m._systemSeed === SOL_SYSTEM_SEED).length;
    expect(stamped, `${stamped} of ${solPlainMoons.length} Sol plain moons carry the 'sol' stamp`)
      .toBe(solPlainMoons.length);

    const admitted = solPlainMoons.filter((m) => labPipelineAdmits(m, conditionFromBody(m)).admitted);
    expect(admitted.length, `${admitted.length} of ${solPlainMoons.length} Sol plain moons admitted `
      + 'with the flag forced ON — the answer must be 0, and by provenance, not by a branch').toBe(0);
    expect(worldEngineProvenance(solPlainMoons[0]).blockers).toContain(`_systemSeed=${SOL_SYSTEM_SEED}`);

    // The other half of the mechanism: a GENERATED plain moon is stamped too, by
    // `StarSystemGenerator` rather than by `MoonGenerator`, which is what makes the same test admit
    // it. Both halves asserted together, because either alone reads as luck.
    const gen = aRealPlainMoon();
    expect(gen._systemSeed).toBe('lab-procedural-0');
    expect(worldEngineProvenance(gen).isWorldEngine).toBe(true);
  });
});

// ═════════════════════════════════════════════════════════════════════════════════════════════════
// 5. THE `.surface` PLACEMENT, ASSERTED BY CALLING RATHER THAN BY REASONING
// ═════════════════════════════════════════════════════════════════════════════════════════════════

describe('5. the two no-fallback shadow writers', () => {
  it('⭐ setShadowMoons / setShadowPlanets stay no-ops on a swapped moon when CALLED', () => {
    // Nine readers consult `_delegate.surface`. Seven fall back to `_delegate.mesh`; these two do
    // not — they read `_delegate.surface?.material` bare. Step 10b's decision was to set `.surface`
    // on NEITHER object, which leaves these two early-returning exactly as they always did. That
    // was a decision about behaviour, so it is asserted as behaviour: the calls are MADE, and the
    // uniform bag is compared before and after. Reasoning that "the `?.` guard holds" is the kind
    // of claim that is true right up until someone adds an assignment above the guard.
    setLabGasBodiesOverride(true);
    const br = BodyRenderer.createMoon(aRealPlainMoon(), null, null, REFS());
    expect(isLabPlanetMaterial(br.mesh.material)).toBe(true);
    expect(br.surface).toBeUndefined();
    expect(br._delegate.surface).toBeUndefined();
    expect(br._delegate.surface || br._delegate.mesh).toBe(br.mesh);

    const snapshot = () => resolvedUniforms(br.mesh.material).json;
    const before = snapshot();
    expect(() => br.setShadowMoons([], new THREE.Vector3(1, 0, 0))).not.toThrow();
    expect(() => br.setShadowPlanets([], new THREE.Vector3(1, 0, 0))).not.toThrow();
    expect(snapshot()).toBe(before);
    // …and they were no-ops because the uniforms are absent, not because the calls were skipped.
    expect(br.mesh.material.uniforms.shadowMoonCount).toBeUndefined();
    expect(br.mesh.material.uniforms.shadowPlanetCount).toBeUndefined();
  });
});

// ═════════════════════════════════════════════════════════════════════════════════════════════════
// 6. THE PER-CLASS QUAD — the degenerate shared pipeline this step must not ship
// ═════════════════════════════════════════════════════════════════════════════════════════════════

describe('6. per-class distinctness', () => {
  it(`⭐ THE QUAD on ${QUAD_SEED} — four classes, six pairs, all distinct, addressed BY NAME`, () => {
    // ⛔ BY NAME AND NEVER BY WALK INDEX, and Step 10c is the reason: the walk's prefix widened in
    // this very commit, so every integer into `bodySurfaces()` moved. Each class is picked out of
    // the SIM tree by what it is, then resolved through the SHIPPED shared sequence
    // (`Planet._createLabSurface`) — the same static both frontends call, so this measures the
    // pipeline rather than a re-implementation of it.
    setLabGasBodiesOverride(true);
    const sys = StarSystemGenerator.generate(QUAD_SEED, null);
    const picked = {};
    for (const e of sys.planets) {
      const pd = e.planetData;
      picked[compositionClass(conditionFromBody(pd)) === 'gas' ? 'gasGiant' : 'rockyPlanet'] ??= pd;
      for (const m of (e.moons || [])) {
        if (!m.isPlanetMoon) { picked.plainMoon ??= m; continue; }
        // ⚠ A PLANET-CLASS MOON IS STAMPED AT SCENE-BUILD TIME, NOT BY THE GENERATOR: `src/main.js`
        // adds `_systemSeed`/`_ordinal` when it builds the record for `new Planet`, and WITHOUT
        // them provenance refuses this record outright — so the stamps are what make it resolvable.
        // ⛔ ONLY THE STAMPS ARE MIRRORED; THIS IS NOT "THE BODY THE GAME RENDERS". The scene record
        // also overrides `radius` with `radiusScene` (MEASURED on this seed: 0.3989 → 0.0603,
        // 6.61x), scales `noiseScale` by that ratio, and rescales `clouds`. Those three are
        // deliberately not mirrored, because this leg gates DISTINCTNESS BETWEEN CLASSES rather
        // than any body's value: resolved both ways, exactly 4 uniforms differ (`uBodyRadius` plus
        // the three seed offsets) and the verdict below is unchanged.
        // ⛔ DO NOT PIN A VALUE OFF THIS LEG — `uBodyRadius` here is 0.3989 where the shipped body
        // is 0.0603, and such a pin would go green forever while describing a body no frame holds.
        picked.planetClassMoon ??= { ...m.planetData, _systemSeed: sys.seed, _ordinal: `pm-${m._ordinal}` };
      }
    }
    const CLASSES = ['rockyPlanet', 'gasGiant', 'plainMoon', 'planetClassMoon'];
    for (const n of CLASSES) expect(picked[n], `${QUAD_SEED} must carry a ${n}`).toBeTruthy();

    const resolved = {}; const packs = {}; const written = {};
    for (const n of CLASSES) {
      const d = picked[n];
      const condition = conditionFromBody(d);
      expect(labPipelineAdmits(d, condition).admitted, `${n} must admit`).toBe(true);
      const surface = Planet._createLabSurface(new THREE.SphereGeometry(d.radius, 8, 4), d, condition, LIGHT());
      const r = resolvedUniforms(surface.material);
      // NON-VACUITY. Four EMPTY sets are also "all pairs equal" and would red below for the right
      // reason; four sets of the WRONG thing would not. Pin that real driver output is compared.
      expect(r.keys.length, `${n} resolved almost no uniforms — the comparison below would be vacuous`)
        .toBeGreaterThan(100);
      resolved[n] = r.map;
      packs[n] = surface.userData.wd.lab.packsApplied.join('+');
      written[n] = surface.userData.wd.lab.uniformsWritten;
      expect(written[n].length, `${n} wrote no uniforms — the bar below would be vacuous`)
        .toBeGreaterThan(10);
    }
    // ⭐ `solidOptics` joins the plain-moon list at B3 leg 1 (same `!== 'gas'` predicate as
    // rockySurface). Its magnitudes are 0 on an airless moon; see the note in moon-lab-mount.
    expect(packs.plainMoon).toBe('rockySurface+solidOptics+solidFeatures+fluvialDeck');   // ⭐ `fluvialDeck` joins the plain-moon list 2026-09-02 (the same `!== 'gas'` predicate again). Its sea and channel magnitudes are 0 on an airless moon — a pack in the list is not a feature on the pixel.
    expect(packs.gasGiant).not.toBe(packs.rockyPlanet);

    // ⛔ THE COMPARISON IS SCOPED TO PACK-WRITTEN UNIFORMS, AND THAT SCOPING IS THE GATE. Four
    // names differ for ANY two distinct bodies whatever the pipeline does: `uBodyRadius` is set by
    // `buildLabPlanetMaterial` rather than by a driver, and `uMacroOffset`/`uDetailOffset`/
    // `uCraterOffset` are seed vectors `rockySurface` forwards rather than computes ("NOT ONE of
    // the three is computed in this file", its own header). So a whole-set `not.toBe` cannot red
    // for a condition-blind pipeline — MEASURED, substituting the plain moon's condition with its
    // PARENT PLANET's leaves 352 of 356 uniforms byte-identical and all six pairs green. Only the
    // pack-written names discriminate, and a bar over them implies the whole-set inequality.
    const NOT_DRIVEN = new Set(['uBodyRadius', 'uMacroOffset', 'uDetailOffset', 'uCraterOffset']);
    const same = (a, b, k) => JSON.stringify(a[k]) === JSON.stringify(b[k]);
    for (let i = 0; i < CLASSES.length; i++) {
      for (let j = i + 1; j < CLASSES.length; j++) {
        const [a, b] = [CLASSES[i], CLASSES[j]];
        const scope = new Set([...written[a], ...written[b]]);
        const differing = Object.keys(resolved[a]).filter(
          (k) => scope.has(k) && !NOT_DRIVEN.has(k) && !same(resolved[a], resolved[b], k),
        );
        // Clean-tree margin, MEASURED across the six pairs in this order: 34 / 12 / 6 / 36 / 34 /
        // 12. The bar is 4 — under the tightest pair (rockyPlanet vs planetClassMoon at 6) so
        // ordinary law tuning cannot red it, and over 0, which is where the condition-blind mutant
        // puts rockyPlanet vs plainMoon.
        expect(differing.length, `${a} and ${b} agree on every DRIVEN uniform — that is the `
          + `degenerate shared pipeline Step 10 must not ship. Differing: [${differing.join(',')}]`)
          .toBeGreaterThanOrEqual(4);
      }
    }
  });
});
