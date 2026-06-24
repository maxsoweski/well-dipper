# World-Engine L0 Plumbing (WS1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make L0 (the galaxy/body generator) surface the real, physics-computed drivers + system context the world-engine needs — tidal heating, eccentricity, magnetic field, age, metallicity, and a system-context summary — as purely additive outputs, with zero change to anything that renders today.

**Architecture:** Strictly additive. Compute/expose values on the `planetData` object returned by `PlanetGenerator.generate()` (and the moon equivalent), reusing the existing-but-dead physics functions (`PhysicsEngine.tidalHeating`, `PhysicsEngine.circularize`). Do NOT wire any new value into `computeSurfaceHistory` or any renderer — consumption is WS2's job. The whole gate is "the diff adds keys and changes nothing else."

**Tech Stack:** Vanilla JS, ES modules, Vitest. Code in `src/generation/`. Tests in `src/generation/__tests__/`.

## Global Constraints

- **STRICTLY ADDITIVE — zero behavioral change.** No edits to `computeSurfaceHistory`, orbit placement (`StarSystemGenerator.js:362-363`), or any renderer. The only behavior change allowed is "new keys appear on the returned object." AC6 (Task 7) is the hard gate.
- **Branch:** `feature/world-engine-production-L1` (already checked out). Stay on it.
- **Stage EXPLICIT paths only — NEVER `git add -A`.** The working tree has unrelated warp WIP (`src/auto/CameraChoreographer.js`, `src/debug/LabMode.js`) + hundreds of loose `.png/.webm/.html` files. Each commit stages only the files it touched.
- **A file literally named `HEAD` exists in repo root** → never `git show HEAD`; use `git log --oneline -1` or explicit shas.
- **Run tests scoped, not bare:** `npx vitest run src/generation/__tests__/<file>.test.js`. There are pre-existing unrelated failures in other suites (galaxy/star-catalog/deep-sky) — `npm test` is noisy; scope to the generation suite.
- **Verify file:line before editing.** The cites below are from a code-grounded planning pass but the tree drifts; confirm the exact line in the current file before changing it.
- **A pre-existing commit hook** may print `grep: subpattern name expected` — harmless.

## File Structure

| File | Responsibility | Change |
|---|---|---|
| `src/generation/PhysicsEngine.js` | Stateless physics. Already exports `tidalHeating` (:295), `circularize` (:321). | Add a planet-tidal-heating helper if needed (Task 5); otherwise read-only reference. |
| `src/generation/PlanetGenerator.js` | Game L0 body generator; assembles `planetData` (return at :660-688). | Add the additive keys: `eccentricity`, `tidalHeating`, `magneticField`, `age`, `metallicity`, `systemContext`. Surface magneticField from one source (:421 aurora computes it inline). |
| `src/generation/MoonGenerator.js` | Moon generator (`generate`, `_pickType` :312). | Wire real `tidalHeating()` for moons; surface it on moon data. |
| `src/generation/StarSystemGenerator.js` | System assembly; has the system graph (moons :390/393, resonance :596, companion :567, age/metallicity :585-586) + circular orbits (:362-363). | Seed initial eccentricity; build the back-link so each body can resolve `systemContext`. (Read-only for orbit placement.) |
| `src/generation/__tests__/world-engine-l0-plumbing.test.js` | NEW — all WS1 unit/integration tests. | Create. |
| `src/generation/__tests__/__fixtures__/l0-baseline.json` | NEW — frozen golden snapshot of existing `generate()` output (Task 1). | Create. |

---

### Task 1: Regression golden-snapshot harness (AC6 foundation)

Establish a deterministic generation harness + a frozen baseline of the CURRENT `generate()` output, so every later task can prove it changed nothing but its own new key.

**Files:**
- Create: `src/generation/__tests__/world-engine-l0-plumbing.test.js`
- Create: `src/generation/__tests__/__fixtures__/l0-baseline.json`

**Interfaces:**
- Produces: a `generateGrid()` test helper that deterministically produces an array of `planetData` objects for a fixed set of `(seed, orbit/type)` inputs, and a `BASELINE_KEYS` list = the keys present on `generate()` output TODAY (from `PlanetGenerator.js:660-688`: `type, radiusEarth, radiusScene, radius, baseColor, accentColor, rings, clouds, atmosphere, aurora, storms, moonCount, noiseScale, noiseDetail, rotationSpeed, axialTilt, sunDirection, massEarth, composition, T_eq, tidalState, habitability, surfaceHistory`). Later tasks deep-compare these keys against the fixture.

- [ ] **Step 1: Find the deterministic generation entry.** Read `PlanetGenerator.js` (constructor + `generate` signature) and any existing `src/generation/__tests__/` or `tests/` test that generates bodies, to learn how to produce a `planetData` deterministically from a seed (likely via the seeded `rng` the generator takes, or via `StarSystemGenerator`). Match that pattern — do not invent a new entry point.

- [ ] **Step 2: Write `generateGrid()` + the baseline-capture test.** In the new test file, build `generateGrid()` to produce ~8–12 bodies spanning types/zones at fixed seeds (deterministic — same seeds every run). Add a test that asserts determinism: `generateGrid()` called twice deep-equals itself.

```js
import { describe, it, expect } from 'vitest';
// import the generator the same way existing generation tests do

// fixed, deterministic inputs spanning hot/temperate/outer + a giant + an icy body
const SEEDS = [/* fill with concrete deterministic inputs found in Step 1 */];
export function generateGrid() { /* return SEEDS.map(s => generateBody(s)) */ }

describe('WS1 L0 plumbing — determinism', () => {
  it('generateGrid is deterministic for fixed seeds', () => {
    expect(generateGrid()).toEqual(generateGrid());
  });
});
```

- [ ] **Step 3: Run it to confirm determinism passes.** `npx vitest run src/generation/__tests__/world-engine-l0-plumbing.test.js` → the determinism test PASSES (if it fails, generation isn't seed-deterministic via your entry — fix the harness before continuing; do NOT proceed on a non-deterministic baseline).

- [ ] **Step 4: Capture the frozen baseline.** Write `generateGrid()`'s current output to `__fixtures__/l0-baseline.json` (a one-off: generate, `JSON.stringify`, write; then commit the fixture as frozen). Add a regression test:

```js
import baseline from './__fixtures__/l0-baseline.json';
const BASELINE_KEYS = Object.keys(baseline[0]); // the 23 existing keys

describe('WS1 L0 plumbing — additive gate (AC6)', () => {
  it('existing generate() keys are byte-identical to the frozen baseline', () => {
    const grid = generateGrid();
    grid.forEach((body, i) => {
      for (const k of BASELINE_KEYS) {
        expect(body[k]).toEqual(baseline[i][k]); // existing keys unchanged; new keys ignored
      }
    });
  });
});
```

- [ ] **Step 5: Run to confirm the gate passes against current code.** `npx vitest run src/generation/__tests__/world-engine-l0-plumbing.test.js` → PASS (baseline == current, trivially). This test must stay green through every later task.

- [ ] **Step 6: Commit.**
```bash
git add src/generation/__tests__/world-engine-l0-plumbing.test.js src/generation/__tests__/__fixtures__/l0-baseline.json
git commit -m "test(world-engine WS1): deterministic generate() grid + frozen additive-gate baseline (AC6)"
```

---

### Task 2: Surface age + metallicity (AC4)

Simplest additive surfacing — proves the pattern and exercises the gate.

**Files:**
- Modify: `src/generation/PlanetGenerator.js` (the return at ~:660-688; `ageGyr` enters generate at ~:367, `metallicity` via `zones`/`deriveComposition`/`_pickType` at ~:358/:725)
- Test: `src/generation/__tests__/world-engine-l0-plumbing.test.js`

**Interfaces:**
- Produces: `planetData.age` (Gyr, === the system `ageGyr` used in generation) and `planetData.metallicity` (=== the system metallicity used in generation).

- [ ] **Step 1: Write the failing test.**
```js
describe('WS1 AC4 — age + metallicity surfaced', () => {
  it('age and metallicity appear on planetData equal to the system values', () => {
    const body = generateBody(/* a fixed seed whose system age+metallicity you can assert */);
    expect(body.age).toBeCloseTo(/* the known ageGyr for that seed */);
    expect(body.metallicity).toBeCloseTo(/* the known metallicity for that seed */);
  });
});
```
(Determine the expected values by reading what `generate()` receives for that seed — `ageGyr`/`metallicity` are already in scope inside `generate`.)

- [ ] **Step 2: Run to verify it fails.** `npx vitest run ...l0-plumbing.test.js` → FAIL (`age`/`metallicity` undefined).

- [ ] **Step 3: Add the two keys to the return object.** In `PlanetGenerator.js` return (~:660-688), add `age: ageGyr,` and `metallicity,` using the in-scope variables (confirm their exact names at the top of `generate`).

- [ ] **Step 4: Run to verify it passes + the gate holds.** `npx vitest run ...l0-plumbing.test.js` → AC4 PASS and the AC6 additive-gate test still PASS.

- [ ] **Step 5: Commit.**
```bash
git add src/generation/PlanetGenerator.js src/generation/__tests__/world-engine-l0-plumbing.test.js
git commit -m "feat(world-engine WS1): surface age + metallicity on planetData (AC4, additive)"
```

---

### Task 3: Surface magneticField from a single source (AC3)

**Files:**
- Modify: `src/generation/PlanetGenerator.js` (aurora block computes `fieldStrength` inline at ~:421; return at ~:660-688)
- Test: `src/generation/__tests__/world-engine-l0-plumbing.test.js`

**Interfaces:**
- Produces: `planetData.magneticField` === the `fieldStrength` value the aurora block already uses (single source of truth; the aurora block reads the surfaced value rather than recomputing).

- [ ] **Step 1: Write the failing test.**
```js
describe('WS1 AC3 — magneticField surfaced, single source', () => {
  it('magneticField is present and equals ironFraction*(isLocked?0.2:1.0)', () => {
    const body = generateBody(/* a locked body */);
    const expected = body.composition.ironFraction * (body.tidalState.locked ? 0.2 : 1.0);
    expect(body.magneticField).toBeCloseTo(expected);
  });
});
```

- [ ] **Step 2: Run to verify it fails.** → FAIL (`magneticField` undefined).

- [ ] **Step 3: Compute once, reuse, surface.** In `generate()`, compute `fieldStrength` once into a `const magneticField = ...` BEFORE the aurora block; change the aurora block (~:421) to reference that variable instead of recomputing; add `magneticField,` to the return. Confirm the aurora math is byte-identical (same `ironFraction*(isLocked?0.2:1.0)` expression) so behavior is preserved.

- [ ] **Step 4: Run to verify it passes + gate holds.** AC3 PASS; AC6 additive-gate test still PASS (aurora value unchanged ⇒ `aurora` key in the baseline is identical).

- [ ] **Step 5: Commit.**
```bash
git add src/generation/PlanetGenerator.js src/generation/__tests__/world-engine-l0-plumbing.test.js
git commit -m "feat(world-engine WS1): surface magneticField from single source (AC3, behavior-preserving)"
```

---

### Task 4: Compute + surface eccentricity (AC2)

Orbits are circular by construction and `circularize()` is dead — so this is "compute," not "un-comment." Seed a deterministic initial eccentricity, damp it, surface it. DATA-ONLY (do not feed orbit placement).

**Files:**
- Modify: `src/generation/StarSystemGenerator.js` (seed initial eccentricity per body near where orbits are assigned, ~:362; pass into the body / `PlanetGenerator`) and/or `src/generation/PlanetGenerator.js` (surface on return). Read both to choose the cleanest seam — eccentricity needs `orbitAU`, `ageGyr`, `massParent` (solar) for `circularize(initialEccentricity, ageGyr, orbitAU, massParent)`.
- Test: `src/generation/__tests__/world-engine-l0-plumbing.test.js`

**Interfaces:**
- Produces: `planetData.eccentricity` ∈ [0,1), deterministic per seed. Consumed by Task 5 (planet tidal heating). NOT consumed by orbit placement.

- [ ] **Step 1: Write the failing test.**
```js
describe('WS1 AC2 — eccentricity computed', () => {
  it('eccentricity is present, in [0,1), and deterministic', () => {
    const a = generateBody(SEED_X), b = generateBody(SEED_X);
    expect(a.eccentricity).toBeGreaterThanOrEqual(0);
    expect(a.eccentricity).toBeLessThan(1);
    expect(a.eccentricity).toBe(b.eccentricity); // deterministic
  });
  it('close-in bodies circularize lower than distant ones (same seed family)', () => {
    expect(generateBody(SEED_CLOSE).eccentricity)
      .toBeLessThan(generateBody(SEED_DISTANT).eccentricity);
  });
});
```

- [ ] **Step 2: Run to verify it fails.** → FAIL (`eccentricity` undefined).

- [ ] **Step 3: Seed + damp + surface.** Where bodies are created in `StarSystemGenerator` (near :362), draw a deterministic initial eccentricity from the existing seeded `rng` (modest range, e.g. `const e0 = rng.range(0, 0.4)` — match the existing rng API), then `const eccentricity = circularize(e0, ageGyr, orbitAU, massParentSolar);`. Thread it onto the body so `PlanetGenerator.generate()` can surface `eccentricity` in its return. Do NOT change `px/pz` orbit placement.

- [ ] **Step 4: Run to verify it passes + gate holds.** AC2 PASS; AC6 additive-gate still PASS (orbit placement + all baseline keys unchanged; only the new `eccentricity` key appears — and note any `rng` draw you add must NOT shift the downstream rng stream that produces baseline keys; if it does, draw eccentricity from a separate derived sub-seed so the baseline stays byte-identical). **This is the subtle risk in this task: a new `rng` call can perturb every subsequent random draw. If the AC6 gate breaks, isolate the eccentricity draw onto its own seeded stream.**

- [ ] **Step 5: Commit.**
```bash
git add src/generation/StarSystemGenerator.js src/generation/PlanetGenerator.js src/generation/__tests__/world-engine-l0-plumbing.test.js
git commit -m "feat(world-engine WS1): compute + surface orbital eccentricity, data-only (AC2)"
```

---

### Task 5: Tidal heating is real — moons + planets (AC1) — depends on Task 4

Wire the dead `tidalHeating()` for moons (where it physically belongs) and compute stellar tidal heating for planets (nonzero only for close + eccentric). Surface `tidalHeating` on both. Do NOT wire into `computeSurfaceHistory`.

**Files:**
- Modify: `src/generation/MoonGenerator.js` (call `tidalHeating(moonEcc, parentPlanetMassEarth, moonRadiusEarth, moonOrbitRadiusEarth)`; surface on moon data)
- Modify: `src/generation/PlanetGenerator.js` (compute planet stellar tidal heating from `eccentricity` + star mass + orbit; surface `tidalHeating` on return)
- Possibly Modify: `src/generation/PhysicsEngine.js` (add a `tidalHeatingPlanet(...)` helper if the moon-shaped `tidalHeating` can't be cleanly unit-mapped for the star case)
- Test: `src/generation/__tests__/world-engine-l0-plumbing.test.js`

**Interfaces:**
- Consumes: `planetData.eccentricity` (Task 4).
- Produces: `planetData.tidalHeating` (real, Io-moon ≈ 1 scale): >0 for a tidally-heated Io-like moon and for a close+eccentric planet; ≈0 for a temperate planet (e.g. Earth-like). Surfaced ONLY.

- [ ] **Step 1: Write the failing tests.**
```js
describe('WS1 AC1 — tidal heating is real', () => {
  it('an Io-like moon reports significant tidal heating', () => {
    const moon = generateMoonLike(/* giant parent, close eccentric moon seed */);
    expect(moon.tidalHeating).toBeGreaterThan(0.1);
  });
  it('a temperate planet reports ~0 tidal heating', () => {
    expect(generateBody(SEED_EARTHLIKE).tidalHeating).toBeLessThan(0.01);
  });
  it('a close, eccentric planet reports nonzero tidal heating', () => {
    expect(generateBody(SEED_HOT_ECCENTRIC).tidalHeating).toBeGreaterThan(0);
  });
  it('computeSurfaceHistory output is unchanged (not wired in)', () => {
    // the AC6 baseline already guards surfaceHistory; this asserts intent explicitly
    expect(generateBody(SEED_X).surfaceHistory).toEqual(/* baseline surfaceHistory for SEED_X */);
  });
});
```

- [ ] **Step 2: Run to verify it fails.** → FAIL (`tidalHeating` undefined on bodies).

- [ ] **Step 3a: Moons.** In `MoonGenerator`, find the moon's eccentricity (or seed one like Task 4), parent planet mass (Earth masses), moon radius (Earth radii), and moon orbit radius (Earth radii), then `const tidalHeating = tidalHeatingFn(ecc, parentMassEarth, moonRadiusEarth, moonOrbitRadiusEarth);` and surface it on the moon object. The Io test (`tidalHeating(0.0041, 317.8, 0.286, 66) ≈ 1`) is the unit anchor — pick moon params that produce a clearly nonzero result.

- [ ] **Step 3b: Planets.** Decide the unit-correct mapping for a planet heated by its STAR. The moon formula is `∝ e²·M_parent²·R_body⁵ / a⁵`, Io-normalized. For a planet: parent = star (mass in Earth masses ≈ starSolar·333000), body = the planet (radiusEarth), a = orbit in the same length unit basis as the Io normalization. Either reuse `tidalHeating` with consistent unit conversion or add `tidalHeatingPlanet(eccentricity, starMassSolar, planetRadiusEarth, orbitAU)` to `PhysicsEngine.js` normalized so Earth (e≈0.017, 1 AU) ⇒ ≈0 and a hot eccentric planet ⇒ >0. Surface `tidalHeating` on the planet return. Read the generator for the available star mass + orbit values; verify against the test targets.

- [ ] **Step 4: Run to verify it passes + gate holds.** AC1 PASS; AC6 additive-gate still PASS (`surfaceHistory` and all baseline keys unchanged — tidalHeating is surfaced, not consumed).

- [ ] **Step 5: Commit.**
```bash
git add src/generation/MoonGenerator.js src/generation/PlanetGenerator.js src/generation/PhysicsEngine.js src/generation/__tests__/world-engine-l0-plumbing.test.js
git commit -m "feat(world-engine WS1): real tidal heating for moons + planets, surfaced only (AC1)"
```

---

### Task 6: Expose systemContext flat summary + serialization safety (AC5)

Give each body a flat, serialization-safe summary of its place in the system. Build it in a second pass (the body is finalized before the system graph exists). MUST be a flat summary, NOT a live `systemData` back-reference (which is circular and breaks saves).

**Files:**
- Modify: `src/generation/StarSystemGenerator.js` (after planets/moons/resonance/companion are computed — ~:387–:596 — attach a derived `systemContext` summary to each body's `planetData`)
- Test: `src/generation/__tests__/world-engine-l0-plumbing.test.js`

**Interfaces:**
- Produces: `planetData.systemContext = { siblings: [{type, orbitAU}], moons: [{...summary}], resonancePartners: [...], companionClass: string|null }` — all plain data, no object cycles.

- [ ] **Step 1: Write the failing tests.**
```js
describe('WS1 AC5 — systemContext reachable + serialization-safe', () => {
  it('a body can resolve siblings, its moons, resonance partners, companion', () => {
    const sys = generateSystem(SEED_RESONANT); // >=3 compact planets
    const body = sys.planets[1].planetData;
    expect(body.systemContext.siblings.length).toBeGreaterThan(0);
    expect(Array.isArray(body.systemContext.moons)).toBe(true);
    expect(body.systemContext.resonancePartners).toEqual(/* matches sys.resonanceChain */);
  });
  it('the whole system still JSON-serializes (no circular ref)', () => {
    const sys = generateSystem(SEED_RESONANT);
    expect(() => JSON.stringify(sys)).not.toThrow();
  });
});
```

- [ ] **Step 2: Run to verify it fails.** → FAIL (`systemContext` undefined).

- [ ] **Step 3: Build the flat summary in a post-pass.** After the system graph is assembled in `StarSystemGenerator` (moons at :390/393, `resonanceChain` at :596, companion `star2` at :567), loop the planets and set `planetData.systemContext` to a FLAT summary derived from siblings/moons/resonance/companion. Copy primitives only — never assign `systemData` or a parent object reference (no cycles).

- [ ] **Step 4: Run to verify it passes + gate holds.** AC5 PASS; AC6 additive-gate still PASS; `JSON.stringify(system)` does not throw.

- [ ] **Step 5: Commit.**
```bash
git add src/generation/StarSystemGenerator.js src/generation/__tests__/world-engine-l0-plumbing.test.js
git commit -m "feat(world-engine WS1): expose flat serialization-safe systemContext per body (AC5)"
```

---

### Task 7: Final regression sweep + AC6 closeout

**Files:**
- Test: `src/generation/__tests__/world-engine-l0-plumbing.test.js` (no new code; confirmation run)

- [ ] **Step 1: Run the full generation suite.** `npx vitest run src/generation/__tests__/` → all generation tests green, including the AC6 additive-gate test and every AC1–AC5 test.

- [ ] **Step 2: Confirm the six new keys are present and the baseline keys are byte-identical.** Add a final assertion that every body from `generateGrid()` now carries `eccentricity, tidalHeating, magneticField, age, metallicity, systemContext` AND that `BASELINE_KEYS` still deep-equal the fixture (the additive gate, end-to-end).

```js
describe('WS1 — closeout', () => {
  it('all six new keys present, all baseline keys unchanged', () => {
    const NEW = ['eccentricity','tidalHeating','magneticField','age','metallicity','systemContext'];
    generateGrid().forEach((body, i) => {
      NEW.forEach(k => expect(body[k]).toBeDefined());
      Object.keys(baseline[i]).forEach(k => expect(body[k]).toEqual(baseline[i][k]));
    });
  });
});
```

- [ ] **Step 3: Run it.** → PASS.

- [ ] **Step 4: Commit.**
```bash
git add src/generation/__tests__/world-engine-l0-plumbing.test.js
git commit -m "test(world-engine WS1): closeout — six additive keys present, baseline unchanged (AC6)"
```

---

## Self-Review

**Spec coverage:** AC1→Task 5, AC2→Task 4, AC3→Task 3, AC4→Task 2, AC5→Task 6, AC6→Tasks 1+7 (and guarded continuously). All six contract ACs map to tasks.

**Dependency:** Task 4 (eccentricity) precedes Task 5 (planet tidal heating consumes it). Task 1 precedes all (the gate). Order: 1 → 2 → 3 → 4 → 5 → 6 → 7. Tasks 2/3/6 are independent of each other; 2 and 3 are the safe warm-ups.

**Known implementer-resolved details (not placeholders — design points the implementer settles against the code, each with a concrete correctness target):** (a) the deterministic generation entry (Task 1 Step 1); (b) the eccentricity rng-stream isolation if the additive gate breaks (Task 4 Step 4); (c) the planet stellar-tidal-heating unit mapping, anchored by Earth≈0 / Io-moon≈1 / close-eccentric-planet>0 (Task 5 Step 3b).

**The recurring guard:** after EVERY task, the AC6 additive-gate test must stay green. If a task turns it red, the change stopped being additive — stop and isolate (almost always an rng-stream perturbation), don't proceed.
