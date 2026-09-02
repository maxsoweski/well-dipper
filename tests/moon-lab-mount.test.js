// tests/moon-lab-mount.test.js — PLAN Step 10b: a PLAIN MOON mounts the world-engine lab material.
//
// ════════════════════════════════════════════════════════════════════════════════════════════════
// WHAT THIS FILE GATES, AND WHY EACH GATE IS THE SHAPE IT IS
// ════════════════════════════════════════════════════════════════════════════════════════════════
// Step 10b routes plain moons through the SAME sequence a planet takes, by calling the now-static
// `Planet._createLabSurface` from `Moon._createMesh`. One expression, not a second transcription:
// two copies of admit -> build -> packs -> attributes -> back-link is precisely the drift this port
// exists to remove. This file is the evidence that the call actually lands and that the things a
// moon uniquely does — spin every sim tick, carry no `.surface`, get its LOD from a wrapper — do
// not quietly break on the new material.
//
// ⛔ THREE GATES ARE DELIBERATELY *NOT* WRITTEN HERE, and each absence is a decision:
//   · NO SOL-EXCLUSION TEST. Sol is excluded STRUCTURALLY, not by a branch — `SolarSystemData`
//     stamps `_systemSeed: 'sol'` and `worldEngineProvenance` refuses it. MEASURED at this commit:
//     0 of Sol's 25 plain moons admit with the flag forced ON. A test here would assert a branch
//     that does not exist and would go green for the wrong reason if someone added one.
//   · NO ">= 95% of plain moons resolve non-zero uCraterDensity". MEASURED: 473/632 = 74.8%. The
//     shortfall is `CRATER_MIN_DENSITY` in craterUniforms.js refusing 151 bodies — a CRATER-LAW  ⭐ RE-MEASURED 2026-08-20 AFTER B2 LEG 1: 547/632 = 86.6%, and `CRATER_MIN_DENSITY` no longer exists — of the remaining 85, 8 are schedule-refused and 77 are refused by its successor `CRATER_MIN_VISIBLE`. Still a crater-law
//     question, not a pipeline one. Gating a pipeline step on it would red this file for a reason
//     no edit in this step could fix. The DISTINCTNESS half is kept, because that is the half that
//     discriminates a dead wire: a constant value across 632 moons passes every "non-zero" gate
//     ever written and is exactly the failure a shared pipeline produces.
//   · NO INSTRUMENT D. It needs a browser (>= 120 frames, rAF advanced, zero uncaught exceptions).
//     jsdom cannot produce it and an approximation of it would be worse than its absence. OWED.
//
// ⛔ AND ONE GATE IS WRITTEN THE HARD WAY ON PURPOSE: the per-frame seam (`updateRender advances
// the clock`) carries a committed MUTANT that deletes the seam from the SHIPPED text and asserts
// the clock then stays at 0. A `not.toThrow` there would have passed against the no-op that existed
// before this step, which is how that defect survived the planet migration on the moon path.
//
// ⭐ AND §5 IS STEP 10's OTHER NAMED DELIVERABLE — the MOON PARITY LEDGER's machine half. Step 10
// swaps a body class Channel 1 has never contained, so every legacy `Moon.js` feature was leaving
// undeclared and silently, the four writers that would have thrown having been turned into guards.
// §5 parses `docs/FEATURES/step6-parity-ledger.md` §9 and re-derives the loss set BY RUNNING.

import { describe, it, expect, afterEach } from 'vitest';
import * as THREE from 'three';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path'; import { stripCommentsPreservingOffsets } from './helpers/source-scan.mjs';
import { StarSystemGenerator } from '../src/generation/StarSystemGenerator.js';
import { BodyRenderer } from '../src/rendering/objects/BodyRenderer.js';
import { Moon } from '../src/objects/Moon.js';
import { Planet, setLabGasBodiesOverride, labPipelineAdmits } from '../src/objects/Planet.js';
import { conditionFromBody } from '../src/worldengine/port/conditionFromBody.js';
import { isLabPlanetMaterial, updateLabPlanetMaterial, swapLedgerOf } from '../src/rendering/LabPlanetMaterial.js';
import { compositionClass } from '../src/worldengine/base/e1Regime.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const MOON_SRC = readFileSync(join(ROOT, 'src/objects/Moon.js'), 'utf8');

// ── The corpus ───────────────────────────────────────────────────────────────────────────────────
// `lab-procedural-0 … -199`, the list Step 10's recon measured against, so every number quoted in
// this file can be reproduced by re-running it rather than trusted. MEASURED at this commit:
// 632 plain moons, 632 admitted (rockySurface's `!== 'gas'` predicate claims 100% of them), 237
// distinct uCraterDensity values. `lab-procedural-6` is the FIRST seed in the list carrying all
// four body classes at once, which is what the per-class quad needs.
const SEEDS = Array.from({ length: 200 }, (_, i) => `lab-procedural-${i}`);
const QUAD_SEED = 'lab-procedural-6';

const LIGHT = () => new THREE.Vector3(0.6, 0.3, 0.7).normalize();
const REFS = () => ({ lightDir: LIGHT(), lightDir2: null });

/** Every plain (non-planet-class) moon in a generated system, parent-first. */
function plainMoonsOf(seed) {
  const out = [];
  for (const e of StarSystemGenerator.generate(seed, null).planets) {
    for (const m of (e.moons || [])) if (!m.isPlanetMoon) out.push(m);
  }
  return out;
}

/** The first plain moon of `lab-procedural-0` — one real generator record, stamps and all. */
const aRealPlainMoon = () => plainMoonsOf('lab-procedural-0')[0];

afterEach(() => setLabGasBodiesOverride(null));

// ═════════════════════════════════════════════════════════════════════════════════════════════════
// 1. THE MOUNT, AND ITS OFF TWIN
// ═════════════════════════════════════════════════════════════════════════════════════════════════

describe('the mount', () => {
  it('⭐ a plain moon built through BodyRenderer.createMoon carries the LAB material', () => {
    setLabGasBodiesOverride(true);
    const d = aRealPlainMoon();
    const br = BodyRenderer.createMoon(d, null, null, REFS());
    expect(isLabPlanetMaterial(br.mesh.material)).toBe(true);
    // The §12.3 E-3 back-link, in the SAME shape Planet writes — `_lab.resolveBody` and
    // Instrument E read exactly these fields to caption a body, and a moon that mounted the
    // material but carried no back-link would be an uncaptionable body in every shot.
    const wd = br.mesh.userData.wd;
    expect(wd.lab.isLabPipeline).toBe(true);
    // ⭐ `solidOptics` JOINS ON A PLAIN MOON AT B3 LEG 1 — its predicate is `!== 'gas'`, the same
    // one that put `rockySurface` here, so a moon is claimed by both or by neither. ⚠ Its two
    // MAGNITUDES land on zero for a plain moon (no atmosphere ⇒ columnFraction 0 and
    // labCore's `hasAtmo` 0), so what actually reaches the moon is the limb width/hue, the
    // terminator hue/width and four aurora values behind a zero intensity. Recorded because a
    // pack in the list is not the same as a feature on the pixel.
    expect(wd.lab.packsApplied).toEqual(['rockySurface', 'solidOptics', 'solidFeatures', 'fluvialDeck']);   // ⭐ `fluvialDeck` joins the plain-moon list 2026-09-02 (the same `!== 'gas'` predicate again). Its sea and channel magnitudes are 0 on an airless moon — a pack in the list is not a feature on the pixel.
    expect(wd.lab.flag.source).toBe('override');
    expect(wd.planetData).toBe(d);
    // ⛔ NOT `toBeTruthy()`, and the gap that phrasing left is a whole class of defect. A condition
    // FROZEN at the first moon, or a moon handed its PARENT PLANET's condition, is truthy — and
    // MEASURED, freezing it at the shipped mount left the full suite's failing set byte-identical
    // to HEAD: 5426 tests, nothing anywhere noticed. This is the only assertion in the tree that
    // reads the condition the SHIPPED mount passes, so it has to read it for THIS body.
    expect(wd.condition).toEqual(conditionFromBody(d));
  });

  it('⭐ `assignBodyName` runs AFTER the swap and does not clobber the back-link', () => {
    // The mount returns early from `_createMesh`, so naming happens on the LAB mesh. If
    // `assignName` assigned userData instead of spreading it, the back-link would be silently
    // erased and every instrument would go blind on exactly the bodies this step ships.
    setLabGasBodiesOverride(true);
    const br = BodyRenderer.createMoon(aRealPlainMoon(), null, null, REFS());
    expect(br.mesh.name).toMatch(/^body\.moon\./);
    expect(br.mesh.userData.category).toBe('body');
    expect(br.mesh.userData.wd?.lab?.isLabPipeline).toBe(true);
  });

  it('⭐ THE OFF TWIN — with the flag FORCED off the SAME record gets Moon.js\'s own material', () => {
    // This is the whole-branch mutant. If it ever goes green *and* test 1 goes green, the mount is
    // not reading the flag at all and 6e's OFF frame has stopped existing.
    // ⭐ FORCED, NOT DEFAULTED, SINCE B7 2026-08-21: LAB_GAS_BODIES_DEFAULT flipped false -> true at
    // B7 (Step 12), so the un-set flag no longer produces a legacy body — it produces the SAME lab
    // material test 1 asserts. The OFF frame this mutant-catcher exists to prove still exists (the
    // legacy path is Sol's renderer and is never deleted); it just has to be named explicitly now
    // instead of inherited from silence.
    setLabGasBodiesOverride(false);
    const d = aRealPlainMoon();
    const br = BodyRenderer.createMoon(d, null, null, REFS());
    expect(isLabPlanetMaterial(br.mesh.material)).toBe(false);
    expect(br.mesh.material.uniforms.moonType).toBeDefined();   // the legacy shader's own uniform
    expect(br.mesh.userData.wd).toBeUndefined();
  });

  it('⭐ THE GALLERY SHAPE IS RULED IN, NOT LEFT UNDECIDED — a bare `new Moon()` mounts too', () => {
    // src/main.js's body gallery constructs a `Moon` DIRECTLY, with no BodyRenderer and no
    // LODManager around it. Mounting in Moon.js rather than in BodyRenderer is what makes that
    // route behave like every other one instead of being a fourth mount site nobody ruled on —
    // "renders on some bodies and not others, with nothing complaining" is the failure mode.
    // ⚠ NAMED CONSEQUENCE, accepted rather than discovered: the gallery registers with no
    // LODManager, so nothing calls `setReliefDetail` there and `uOctaves` stays at its build
    // default of 4.0. That is a DETAIL difference at a fixed showcase camera, not a mount
    // inconsistency, and it is the same value the body would show beyond 20 radii in flight.
    setLabGasBodiesOverride(true);
    const d = aRealPlainMoon();
    const moon = new Moon({ ...d, orbitRadius: 0, orbitSpeed: 0 }, LIGHT(), null, null);
    expect(isLabPlanetMaterial(moon.mesh.material)).toBe(true);
    expect(moon.mesh.material.uniforms.uOctaves.value).toBe(4);
  });

  it('uBodyRadius is the radius the GEOMETRY was built at, not the 1.0 default', () => {
    // Getting this wrong is worse on a moon than on a planet. MEASURED over this file's 200-seed
    // corpus, 632 plain moons — TWO quantities, because they are two different numbers on the same
    // record and the earlier version of this comment quoted one of each as if they bracketed a
    // range: the raw generator `radius` asserted on here runs 4.90e-3 … 6.32e-1, and the
    // `radiusScene` the GAME builds every plain moon from (main.js's `sceneMoons` map sets
    // `radius: m.radiusScene`) runs 3.19e-4 … 1.07e-1. So the 1.0 default puts the noise domain
    // between ~0.2 and ~3.5 orders of magnitude off depending on the body, and at the small end
    // produces a flat wash indistinguishable from a shader with no drivers wired at all.
    setLabGasBodiesOverride(true);
    const d = aRealPlainMoon();
    const br = BodyRenderer.createMoon(d, null, null, REFS());
    expect(br.mesh.material.uniforms.uBodyRadius.value).toBe(d.radius);
    expect(br.mesh.geometry.parameters.radius).toBe(d.radius);
  });
});

// ═════════════════════════════════════════════════════════════════════════════════════════════════
// 2. THE PER-FRAME SEAM — the one real defect this step had to close
// ═════════════════════════════════════════════════════════════════════════════════════════════════

describe('the per-frame seam', () => {
  it('⭐ updateRender ADVANCES uTime and writes uLightDir on a swapped moon', () => {
    setLabGasBodiesOverride(true);
    const br = BodyRenderer.createMoon(aRealPlainMoon(), null, null, REFS());
    const u = br.mesh.material.uniforms;
    expect(u.uTime.value).toBe(0);
    const lightBefore = u.uLightDir.value.toArray();

    // The moon spins every sim tick; that is what makes an OBJECT-space uLightDir go stale.
    br.mesh.rotation.y = 1.234;
    br.updateRender(0.5);

    expect(u.uTime.value).toBeCloseTo(0.5, 10);
    expect(u.uLightDir.value.toArray()).not.toEqual(lightBefore);
  });

  it('⭐ the clock advances on a CLOUDLESS moon — the seam is not nested in the clouds guard', () => {
    // ⛔ ALL 632 PLAIN MOONS IN THE CORPUS ARE CLOUDLESS — 100%, not "almost all". Clouds are
    // terrestrial-only in `MoonGenerator` and the corpus's plain-moon types are {captured 139,
    // ice 219, volcanic 67, rocky 207}; the 6 cloud-carrying moons in it are ALL planet-class,
    // which are `Planet` instances and never execute `Moon.updateRender`. So nesting the seam
    // inside `if (this.data.clouds)` would have frozen the ENTIRE population this method sees.
    // ⛔ AND THE PROPERTY IS PINNED, NOT SAMPLED. `find((m) => !m.clouds)` returned element [0] and
    // read as sampling a 99% population; against a 100% one it asserted nothing.
    setLabGasBodiesOverride(true);
    const cloudy = SEEDS.flatMap(plainMoonsOf).filter((m) => m.clouds);
    expect(cloudy.length, 'plain moons are cloudless on this corpus — clouds are terrestrial-only')
      .toBe(0);
    const d = aRealPlainMoon();
    const br = BodyRenderer.createMoon(d, null, null, REFS());
    br.updateRender(0.25);
    expect(br.mesh.material.uniforms.uTime.value).toBeCloseTo(0.25, 10);
  });

  it('⭐ COMMITTED MUTANT — delete the seam from the SHIPPED text and the clock stops', () => {
    // Sliced from src/objects/Moon.js on COMMENT-STRIPPED text (so a quoted copy in a comment
    // cannot stand in for live code), then cut from RAW source. Without this control the two tests
    // above would also pass against the no-op that existed BEFORE this step, because a lab material
    // built fresh has uTime === 0 and any assertion phrased as `not.toThrow` is satisfied by
    // nothing happening at all.
    const stripped = stripCommentsPreservingOffsets(MOON_SRC);
    const sig = stripped.indexOf('updateRender(renderDt) {');
    expect(sig).toBeGreaterThan(0);
    const open = stripped.indexOf('{', sig);
    let depth = 0; let i = open;
    for (; i < stripped.length; i++) {
      if (stripped[i] === '{') depth++;
      else if (stripped[i] === '}') { depth--; if (depth === 0) break; }
    }
    const body = MOON_SRC.slice(open + 1, i);
    expect(body).toContain('updateLabPlanetMaterial(');

    const mutant = body.replace(/updateLabPlanetMaterial\([\s\S]*?\}\);/, '');
    expect(mutant, 'the mutant must differ from the shipped text').not.toBe(body);
    expect(mutant).not.toContain('updateLabPlanetMaterial(');

    setLabGasBodiesOverride(true);
    const br = BodyRenderer.createMoon(aRealPlainMoon(), null, null, REFS());
    const u = br.mesh.material.uniforms;
    // eslint-disable-next-line no-new-func
    new Function('renderDt', 'updateLabPlanetMaterial', mutant)
      .call({ data: br.data, mesh: br.mesh, _lightDir: LIGHT() }, 0.5, updateLabPlanetMaterial);
    expect(u.uTime.value).toBe(0);          // ← the defect, reproduced from the shipped text
  });
});

// ═════════════════════════════════════════════════════════════════════════════════════════════════
// 3. THE WRITE PATHS A MOON UNIQUELY TAKES
// ═════════════════════════════════════════════════════════════════════════════════════════════════

describe('the write paths', () => {
  it('⭐ PLACEMENT, PINNED RATHER THAN REASONED ABOUT — `.surface` is set on NEITHER object', () => {
    // A Moon's mesh IS its surface, so `_delegate.surface || _delegate.mesh` resolves to the same
    // object with or without the assignment, and every external reader already falls back the same
    // way. Setting it on the DELEGATE is the one variant that changes behaviour, and only for the
    // worse: `setShadowMoons`/`setShadowPlanets` read `_delegate.surface?.material` with NO mesh
    // fallback, so it would wake them on moons for the first time against a material that declares
    // neither uniform. Leaving both unset keeps all ten resolutions exactly as they were.
    setLabGasBodiesOverride(true);
    const br = BodyRenderer.createMoon(aRealPlainMoon(), null, null, REFS());
    expect(br.surface).toBeUndefined();
    expect(br._delegate.surface).toBeUndefined();
    expect(br._delegate.surface || br._delegate.mesh).toBe(br.mesh);
    expect(isLabPlanetMaterial(br.mesh.material)).toBe(true);
  });

  it('setShadowMoons / setShadowPlanets neither throw nor write on a swapped moon', () => {
    setLabGasBodiesOverride(true);
    const br = BodyRenderer.createMoon(aRealPlainMoon(), null, null, REFS());
    const before = JSON.stringify(Object.keys(br.mesh.material.uniforms).sort());
    expect(() => br.setShadowMoons?.([], new THREE.Vector3())).not.toThrow();
    expect(() => br.setShadowPlanets?.([], new THREE.Vector3())).not.toThrow();
    expect(JSON.stringify(Object.keys(br.mesh.material.uniforms).sort())).toBe(before);
    expect(br.mesh.material.uniforms.shadowMoonCount).toBeUndefined();
  });

  it('setLOD does not throw, and the skip is WITNESSED rather than silent', () => {
    // The lab material declares no `lodLevel`. The write is guarded, but a guard that merely
    // returns is indistinguishable from a feature that was never wired — `labSkips` is what makes
    // the loss countable, and Step 12's ledger reads it.
    setLabGasBodiesOverride(true);
    const br = BodyRenderer.createMoon(aRealPlainMoon(), null, null, REFS());
    expect(() => br.setLOD(2)).not.toThrow();
    expect(br.labSkips.lodLevel).toBeGreaterThanOrEqual(1);
  });

  it('⭐ A LOST FEATURE CLOSES ITSELF — setReliefDetail starts driving octaves on moons', () => {
    // Recorded because it is a WIN and would otherwise read as an accident: before this step
    // `applyReliefDetail` was a TOTAL no-op on a plain moon (the legacy material declares neither
    // `uOctaves` nor `uReliefOctaves`), so plain moons had no octave ramping at ANY distance. The
    // lab material makes the existing LODManager -> BodyRenderer path start working with no new
    // plumbing at all.
    setLabGasBodiesOverride(true);
    const br = BodyRenderer.createMoon(aRealPlainMoon(), null, null, REFS());
    const u = br.mesh.material.uniforms;
    expect(u.uOctaves.value).toBe(4);
    br.setReliefDetail(1, new THREE.Vector3(0, 0, br.data.radius * 2));
    expect(u.uOctaves.value).toBeGreaterThan(4);
    expect(u.uLodRamp.value).toBeGreaterThan(0);
  });
});

// ═════════════════════════════════════════════════════════════════════════════════════════════════
// 4. THE GATE THAT CATCHES A DEGENERATE SHARED PIPELINE
// ═════════════════════════════════════════════════════════════════════════════════════════════════

describe('per-class distinctness', () => {
  it('⭐ THE QUAD — four body classes from ONE seed, all six pairs distinct, addressed BY NAME', () => {
    // ⛔ BY NAME, NEVER BY WALK INDEX. Step 10c widens the scene walk's owner prefix from
    // `body.planet.` to `body.`, which makes plain moons join the walk and shifts EVERY index in
    // it. A gate keyed on `surfaces[i]` would keep passing while silently comparing different
    // bodies than it did yesterday.
    setLabGasBodiesOverride(true);
    const sys = StarSystemGenerator.generate(QUAD_SEED, null);
    const picked = {};
    for (const e of sys.planets) {
      const pd = e.planetData;
      const cls = compositionClass(conditionFromBody(pd)) === 'gas' ? 'gasGiant' : 'rockyPlanet';
      picked[cls] ??= pd;
      for (const m of (e.moons || [])) {
        if (!m.isPlanetMoon) { picked.plainMoon ??= m; continue; }
        // ⚠ A PLANET-CLASS MOON IS STAMPED AT SCENE-BUILD TIME, NOT BY THE GENERATOR. MEASURED:
        // the raw `m.planetData` carries neither `_systemSeed` nor `_ordinal`, so provenance
        // refuses it with exactly those two blockers; src/main.js adds both when it builds the
        // scene record for `new Planet`. Without them this record is not resolvable at all — which
        // is also why a plain moon needs no such help: `StarSystemGenerator` stamps it directly.
        // ⛔ ONLY THE STAMPS ARE MIRRORED, AND THIS IS THEREFORE NOT "THE BODY THE GAME RENDERS".
        // The scene record also overrides `radius` with `radiusScene` (MEASURED on lab-procedural-6:
        // 0.3989 → 0.0603, 6.61x), scales `noiseScale` by that ratio, and rescales `clouds`. Those
        // three are deliberately NOT mirrored, because this leg gates DISTINCTNESS BETWEEN CLASSES
        // rather than any one body's value: resolved both ways, exactly 4 uniforms differ
        // (`uBodyRadius` + the three seed offsets) and the verdict below is unchanged.
        // ⛔ DO NOT PIN A VALUE OFF THIS LEG — `uBodyRadius` here is 0.3989 where the shipped body
        // is 0.0603, and such a pin would go green forever while describing a body no frame holds.
        picked.planetClassMoon ??= {
          ...m.planetData, _systemSeed: sys.seed, _ordinal: `pm-${m._ordinal}`,
        };
      }
    }
    const names = ['rockyPlanet', 'gasGiant', 'plainMoon', 'planetClassMoon'];
    for (const n of names) expect(picked[n], `${QUAD_SEED} must carry a ${n}`).toBeTruthy();

    // Each resolved through the SHIPPED shared sequence — the same static function the moon mount
    // and the planet mount both call, so this measures the pipeline rather than a re-implementation.
    const resolved = {}; const packsOf = {}; const written = {};
    for (const n of names) {
      const d = picked[n];
      expect(labPipelineAdmits(d, conditionFromBody(d)).admitted, `${n} must admit`).toBe(true);
      const surface = Planet._createLabSurface(
        new THREE.SphereGeometry(d.radius, 8, 4), d, conditionFromBody(d), LIGHT(),
      );
      const u = surface.material.uniforms;
      const keys = Object.keys(u).filter((k) => /^u[A-Z]/.test(k)).sort();
      resolved[n] = Object.fromEntries(keys.map(
        (k) => [k, u[k].value?.toArray ? u[k].value.toArray() : u[k].value],
      ));
      // NON-VACUITY: four empty sets would also be "all pairs equal" and would red below, but
      // four sets of the WRONG thing would not. Pin that real driver output is being compared,
      // and that the packs each class selected actually differ.
      expect(keys.length).toBeGreaterThan(100);
      packsOf[n] = surface.userData.wd.lab.packsApplied.join('+');
      written[n] = surface.userData.wd.lab.uniformsWritten;
      expect(written[n].length, `${n} wrote no uniforms — the bar below would be vacuous`)
        .toBeGreaterThan(10);
    }
    expect(packsOf.gasGiant).not.toBe(packsOf.rockyPlanet);
    // ⭐ `solidOptics` joins the plain-moon list at B3 leg 1 (same `!== 'gas'` predicate as
    // rockySurface). Its magnitudes are 0 on an airless moon; see the note in moon-lab-mount.
    expect(packsOf.plainMoon).toBe('rockySurface+solidOptics+solidFeatures+fluvialDeck');   // ⭐ `fluvialDeck` joins the plain-moon list 2026-09-02 (the same `!== 'gas'` predicate again). Its sea and channel magnitudes are 0 on an airless moon — a pack in the list is not a feature on the pixel.
    // ⛔ THE COMPARISON IS OVER PACK-WRITTEN UNIFORMS, NOT OVER THE WHOLE RESOLVED SET, and the
    // difference is the whole gate. `uBodyRadius` comes from `buildLabPlanetMaterial`, not from a
    // driver, and `uMacroOffset`/`uDetailOffset`/`uCraterOffset` are seed vectors `rockySurface`
    // forwards rather than computes. All four differ for ANY two distinct bodies, so a whole-set
    // `not.toBe` passes on a moon that resolved its PARENT PLANET's entire driver set — MEASURED:
    // 352 of 356 uniforms byte-identical and all six pairs still green. A bar over the written
    // names is what survives that mutant, and it strictly implies the whole-set inequality.
    const NOT_DRIVEN = new Set(['uBodyRadius', 'uMacroOffset', 'uDetailOffset', 'uCraterOffset']);
    const same = (a, b, k) => JSON.stringify(a[k]) === JSON.stringify(b[k]);
    for (let i = 0; i < names.length; i++) {
      for (let j = i + 1; j < names.length; j++) {
        const [a, b] = [names[i], names[j]];
        const scope = new Set([...written[a], ...written[b]]);
        const differing = Object.keys(resolved[a]).filter(
          (k) => scope.has(k) && !NOT_DRIVEN.has(k) && !same(resolved[a], resolved[b], k),
        );
        // Clean-tree margin, MEASURED across the six pairs in this order: 34 / 12 / 6 / 36 / 34 /
        // 12. The bar sits at 4 — below the tightest pair (rockyPlanet vs planetClassMoon at 6) so
        // ordinary law tuning cannot red it, and above 0, which is where a condition-blind moon
        // lands: under that mutant rockyPlanet vs plainMoon collapses to exactly zero.
        expect(differing.length, `${a} and ${b} agree on every DRIVEN uniform — that is the
          degenerate shared pipeline this step must not ship. Differing: [${differing.join(',')}]`)
          .toBeGreaterThanOrEqual(4);
      }
    }
  });

  it('⭐ DISTINCTNESS, NOT NON-ZERO — uCraterDensity takes many values across the population', () => {
    // A CONSTANT across 632 moons is a dead wire, and "non-zero" passes on a dead wire. MEASURED
    // at this commit: 632/632 admitted, 237 distinct values. The bar is set at 20 — an order of
    // magnitude below the measurement, so ordinary law tuning cannot red it, while a wire that
    // came loose and pinned the population to one value would fail it by two orders.
    // ⛔ BUILT THROUGH `BodyRenderer.createMoon`, NOT THROUGH `Planet._createLabSurface` DIRECTLY.
    // The static takes the condition the TEST computes, so this gate used to measure a PURE
    // FUNCTION the shipped mount never appears in: freezing the condition inside `Moon._createMesh`
    // — every plain moon in the game rendering one identical driver set, verbatim the dead wire
    // this file exists to catch — collapsed the population to ONE value and left the full suite's
    // failing set byte-identical to HEAD. Sourcing the material from the mount is what makes the
    // measurement about shipped code; MEASURED both ways: 237 distinct clean, 1 under that mutant.
    setLabGasBodiesOverride(true);
    const densities = new Set();
    let plain = 0; let admitted = 0;
    for (const seed of SEEDS) {
      for (const m of plainMoonsOf(seed)) {
        plain++;
        const condition = conditionFromBody(m);
        if (!labPipelineAdmits(m, condition).admitted) continue;
        admitted++;
        const mat = BodyRenderer.createMoon(m, null, null, REFS()).mesh.material;
        // Without this the set stays non-vacuous by accident: a mount that silently fell back to
        // the legacy material would add `undefined` once and still clear the bar below.
        expect(isLabPlanetMaterial(mat), `${seed} mounted a non-lab material`).toBe(true);
        densities.add(mat.uniforms.uCraterDensity.value);
      }
    }
    expect(plain).toBeGreaterThan(500);          // the corpus is really there
    expect(admitted).toBe(plain);                // rockySurface's `!== 'gas'` claims every moon
    expect(densities.size).toBeGreaterThanOrEqual(20);
  });
});

// ═════════════════════════════════════════════════════════════════════════════════════════════════
// 5. THE MOON PARITY LEDGER — PLAN §4 Step 10's other named deliverable
// ═════════════════════════════════════════════════════════════════════════════════════════════════
// Step 10's **What** paragraph ends "Produce a moon parity list on the Step-6 pattern", its **Gate**
// bullet reads "Moon parity-list test green", and risk 4's mitigation names Steps 6b and 10 BY
// NUMBER. `docs/FEATURES/step6-parity-ledger.md` §9 is the human half; this is the machine half.
//
// ⛔ THE DOC IS AN INPUT, PARSED AND NOT TRUSTED — the same relationship
// `tests/material-parity-list.test.js` has with channels 1 and 2, and for the same reason: a ledger
// transcribed by hand into a test is a ledger with two versions, and the two drift.
// ⛔ AND THE SUBJECT SET IS RE-DERIVED BY RUNNING, NEVER BY READING. Both materials are built on the
// SAME moon record — the 6e flag false, then true, with identical light and star inputs — and the
// pair is fed to `swapLedgerOf`. A loss that appears because someone edited the shipped material
// therefore arrives here as an UNCLAIMED NAME and a red build, rather than as a silent widening.
// ⛔ `lostAtZero` IS INCLUDED IN THE UNION. `starPos1`/`starPos2`, `time` and `lightDir2` all read
// zero at material-creation time; a `lost`-only union would declare the parent-planet eclipse and
// the second-star lighting UNAFFECTED, which is exactly the trap §3 of the ledger records one class
// over. Both buckets are ruled in the doc, so both buckets are measured here.

const LEDGER_MD = readFileSync(join(ROOT, 'docs/FEATURES/step6-parity-ledger.md'), 'utf8');
const RULINGS = new Set(['carried', 'accepted-loss', 'blocking']);
// The expensive pass builds TWO materials per moon. 60 systems, 193 moons (measured) — and the union is a
// property of the two materials' NAME SETS, so it is already saturated well before 60: MEASURED,
// the union over the first 60 seeds and over all 200 is the same 30 names. ⭐ 29 UNTIL B2P, 2026-08-20, which added `uPosterizeLevels` to the legacy moon material and updated every planet-channel count (71→72, 43→44, 63→64) while leaving the moon channel behind. RE-MEASURED by an independent pass over three corpus sizes: 30 at 20 seeds / 65 swapped moons, 30 at 60 / 193, 30 at 200 / 632, with `carried` empty at all three. ⚠ THE NUMBER IS A RECORD, NOT A GATE — the assertion at the non-vacuity check below is `toBeGreaterThan(20)`, deliberately loose against generator drift, so nothing reddens when this count moves and this comment is the only place it is written down.
const LEDGER_SEEDS = SEEDS.slice(0, 60);

/** Rows between `<!-- LEDGER-MOON -->` and `<!-- /LEDGER-MOON -->`, split on the pipe. */
function moonLedgerRows() {
  const open = '<!-- LEDGER-MOON -->'; const close = '<!-- /LEDGER-MOON -->';
  const a = LEDGER_MD.indexOf(open); const b = LEDGER_MD.indexOf(close);
  if (a < 0 || b < 0 || b < a) throw new Error('ledger region MOON missing from step6-parity-ledger.md');
  return LEDGER_MD.slice(a + open.length, b).split('\n')
    .map((l) => l.trim())
    .filter((l) => l.startsWith('|'))
    .map((l) => l.split('|').map((c) => c.trim()))
    .filter((f) => /^M-\d\d$/.test(f[1] || ''))
    .map((f) => ({
      id: f[1],
      subjects: [...String(f[2]).matchAll(/`([A-Za-z_]\w*)`/g)].map((m) => m[1]),
      ruling: f[3],
    }));
}

/** Both materials on the SAME moon record, over `seeds`. Returns the measured loss union. */
function moonLedgerPass(seeds) {
  const lost = new Set(); const carried = new Set();
  let bodies = 0;
  for (const seed of seeds) {
    const sys = StarSystemGenerator.generate(seed, null);
    for (const e of (sys.planets || [])) {
      for (const m of (e.moons || [])) {
        if (m.isPlanetMoon) continue;
        setLabGasBodiesOverride(false);
        const prev = new Moon(m, LIGHT(), new THREE.Vector3(), sys.starInfo).mesh.material.uniforms;
        setLabGasBodiesOverride(true);
        const nextMat = new Moon(m, LIGHT(), new THREE.Vector3(), sys.starInfo).mesh.material;
        setLabGasBodiesOverride(null);
        // A moon the flag did not swap contributes nothing — and if that were EVERY moon the
        // union would be empty, which the non-vacuity assertion below refuses.
        if (!isLabPlanetMaterial(nextMat)) continue;
        bodies++;
        const led = swapLedgerOf({ prevUniforms: prev, nextUniforms: nextMat.uniforms });
        led.buckets.lost.forEach((x) => lost.add(x));
        led.buckets.lostAtZero.forEach((x) => lost.add(x));
        led.buckets.carried.forEach((x) => carried.add(x));
      }
    }
  }
  return { lost, carried, bodies };
}

let LEDGER = null;
const ledger = () => (LEDGER ??= moonLedgerPass(LEDGER_SEEDS));

describe('the moon parity ledger', () => {
  it('⭐ every MEASURED loss is claimed by exactly one row, and no row claims an unmeasured name', () => {
    const rows = moonLedgerRows();
    const { lost, bodies } = ledger();
    // NON-VACUITY FIRST. An empty measurement partitions against an empty table and passes; that is
    // the shape this whole gate exists against, so both halves are pinned before anything is
    // compared. MEASURED at this commit: 632 swapped moons over 200 seeds, 30 lost names (29 until B2P, 2026-08-20 — re-measured independently, and the loose `> 20` bar below is why the stale 29 sat here for a whole block without reddening anything).
    expect(bodies, 'no moon swapped — the ledger pass measured nothing').toBeGreaterThan(150);
    expect(lost.size, 'the measured loss set is empty').toBeGreaterThan(20);
    expect(rows.length, 'the MOON channel has no rows').toBeGreaterThan(5);

    const claims = new Map();
    for (const r of rows) {
      expect(r.subjects.length, `row ${r.id} claims no uniform`).toBeGreaterThan(0);
      for (const n of r.subjects) {
        expect(claims.has(n), `${n} is claimed by both ${claims.get(n)} and ${r.id}`).toBe(false);
        claims.set(n, r.id);
      }
    }
    const unclaimed = [...lost].filter((n) => !claims.has(n)).sort();
    expect(unclaimed, `MEASURED losses no MOON row rules — an UNDECLARED loss, which Max's `
      + `2026-08-09 ruling makes blocking: [${unclaimed.join(', ')}]`).toEqual([]);
    const phantom = [...claims.keys()].filter((n) => !lost.has(n)).sort();
    expect(phantom, `MOON rows claim names nothing measured — the doc is describing a material `
      + `that no longer exists: [${phantom.join(', ')}]`).toEqual([]);
  }, 120000);

  it('the rulings vocabulary is load-bearing — three verdicts, no fourth', () => {
    // §2 defines exactly three. P-10's history is the reason this is asserted rather than assumed:
    // a row was briefly re-ruled `deferred (Max, 2026-08-19)` to record a date, and inventing a
    // fourth verdict would widen the legal set for every future row that found three inconvenient.
    for (const r of moonLedgerRows()) {
      expect(RULINGS.has(r.ruling), `row ${r.id} has illegal ruling "${r.ruling}"`).toBe(true);
    }
  });

  it('⭐ the CARRIED bucket is EMPTY on a moon — so no row may be carried on a NAME', () => {
    // The structural difference from Channel 1, and the reason it matters: there, 28 names sat on
    // both materials and reading "CARRIED: 28" as 28 surviving features was the ledger's headline
    // failure. Here the two materials share NO name — every legacy moon uniform is lowercase, every
    // lab uniform is `u`-prefixed — so `lost ∪ lostAtZero` is the COMPLETE legacy set and each
    // `carried` row has to name a rename plus a live mechanism. If this ever goes non-empty, a
    // name-carried/value-diverged class has appeared on moons and §9's rows are reasoning from a
    // premise that stopped holding.
    const { carried } = ledger();
    expect([...carried].sort(), 'a legacy moon uniform name now survives the swap').toEqual([]);
  }, 120000);
});
