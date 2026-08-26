<!-- Provenance: produced by adversarial-plan workflow wf_738c32b2-977 (2026-07-03).
     Ground(opus) -> 3 attack lenses (byte-identity BUILD-READY / contract-coverage NEEDS-FIX /
     test-drift NEEDS-FIX, 10 findings, 4 MAJOR) -> revision with all fixes folded. BUILD-READY.
     Open questions resolved by working-Claude 2026-07-03:
     (1) AC1 "same test count" = no pre-existing test dropped/skipped; new AC tests additive
         (contract AC1 amended to match).
     (2) Condition vector threads NESTED as bodyDrivers.condition — collision-proof vs
         magmaThermal's flat d.age read (R1). Sibling-key alternative rejected.
     (3) Contract AC2 wording amended: existing suites pin determinism/relations/bounds, NOT
         exact scalars; value preservation is witnessed by the new ad156cc golden fixture. -->
# BUILD PLAN — V2-0 "L0 plumbing + baseStep scalar extraction" (rev. 2, adversarial-findings folded)

Branch `feature/world-engine-production-L1`, base commit `ad156cc` (pre-change). Contract AC-0..AC5. **Zero visual/behavioral change is the gate (AC1).** All paths below are repo-relative to `/home/ax/projects/well-dipper`.

Grounding done: read `baseStep.js` (scalars at :14/:23-27/:34/:39-40/:42/:60/:85; returns `drivers` with **calibrated** `tidalHeat` at :95 + `crust{shellThickness,thicknessBlob,crustalThickness,loveK2,thermalState}` at :98), `planet-lod-rivers.js` `writeBodyRelief` (:448-494) + `route` (:1177-1199) + path predicates (:410/:422/:435/:444), `plates.js` `D_EARTH`/`driversToTune` (:105-163), `magmatism.js` `MAGMA_REF`/`magmaThermal`/`magmaDriversToTune` (:93-129; `magmaThermal` reads flat `d.age` at :101), the lab `DRIVER_PRESETS` (:2641-2795, 17 entries), `PRESET_ARCHETYPE` (:1923-1939, 15 mapped — Mars + Hot Jupiter unmapped, **inline in HTML**), `presetDriverDefaults`/`buildBodyDrivers` (:2858-2890 — the neutral construction, imports `magmaThermal`), the `route()` call site (:3799-3816), `tests/planet-archetypes.test.js` (reads `labSrc` at :12; scrapes DRIVER_PRESETS at :24-30; enable-key scrape :20-22; ARCHETYPES.presets⊂keys check :55-61), `worldengine-fieldviz.html` (:25/:33), `relief-presets.js` (exports `PRESETS` — the 5 bodies rocky/lava/magma/europa/terrestrial — NOT the 17), the baseStep suites (`worldengine-base-interior.test.js` determinism :45-50 + relations :31/:43, `-verify.test.js` :44-59, `-adaptl0.test.js` pins D-slot *inputs* only), and `planet-lod-lab-core.js` `deriveUniforms` (:527 → `u.tidalHeat` is RAW, un-calibrated).

**Contract-accuracy note (surfaced, do not let verify/Max over-trust):** AC2's parenthetical "the existing baseStep test suite (which pins the exact scalar values) passes unchanged" is **factually inaccurate** — I read the suites; they pin cross-run determinism, monotone relations, and [0,1] bounds, **not** any magic-number scalar. So the existing suites CANNOT witness a value-preserving-refactor that isn't actually value-preserving. This rev. adds the missing exact-value anchor (§2 Slice B golden) rather than relying on the contract's inaccurate claim. See openQuestion #3.

---

## 1. Slice ordering (3 slices; AC-0 + AC1 are gates run after EACH, not slices)

Slices are ordered so the AC1 byte-identity harness has a **complete headless bundle source** before it must run. Each slice is independently testable and committable.

**Slice A — DRIVER_PRESETS + PRESET_ARCHETYPE + neutral-driver extraction (AC3). FIRST.**
Why first: AC1's byte-identity harness must build carriers for all 15 archetype-mapped presets *headlessly*; today **three** artifacts it needs are trapped in the HTML — `DRIVER_PRESETS` (string-scrape only), `PRESET_ARCHETYPE` (the preset→archetype-tag map), and the neutral `buildBodyDrivers` construction. Extracting all three to importable modules is a prerequisite for the AC1 gate itself. **[FIXED: AC1 headless harness depends on two lab-trapped artifacts the plan never extracts (PRESET_ARCHETYPE + neutral buildBodyDrivers)]** — the original plan extracted only DRIVER_PRESETS; PRESET_ARCHETYPE and the neutral builder are now first-class Slice-A deliverables (§2), so the harness reconstructs the lab bundle from a single shared source with zero hardcoding/duplication.
- **Byte-safety of Slice A** (widened surface — discharged WITHOUT carrier hashing, since goldens are captured post-A):
  1. Extracted `DRIVER_PRESETS` deep-equals a one-time snapshot of the pre-change literal (scraped from `ad156cc`'s HTML).
  2. Extracted `PRESET_ARCHETYPE` deep-equals a one-time snapshot of the `ad156cc` inline map (same trivial mechanism as (1)).
  3. The neutral-driver functions (`presetDriverDefaults`, `buildNeutralBodyDrivers`) are relocated **verbatim** — the reviewable git diff shows the 8-line function body byte-for-byte unchanged, only cut from the HTML + `export` added + import wired. Plus a forward-drift guard: snapshot `buildNeutralBodyDrivers(deriveUniforms(fp,tier), fp)` outputs for all 15 presets on the post-A tree so any *future* edit to the neutral path trips.
  4. Full vitest green at unchanged pre-existing count; lab loads clean (AC5 spot-check).
  Given (1)-(4), post-A carrier behavior == pre-change ⇒ goldens captured post-A validly encode pre-change (this extends the plan's original transitive argument — "deep-equal presets + untouched writers ⇒ byte-identical carriers" — to cover the archetype map + neutral-builder relocation).
- Commit gate: `npx vitest run tests/planet-archetypes.test.js` green (rewired + new lab-coupling assertions) + full suite green + lab loads clean (AC5 spot-check).

**Between A and B — capture AC1 goldens.** With `DRIVER_PRESETS`, `PRESET_ARCHETYPE`, and the neutral builder now importable, run the golden-capture harness (§3) once on the post-A tree (== pre-change behavior) and commit the fixture. **Goldens are captured WITHOUT a `condition` sub-object** (deriveConditionVector doesn't exist until Slice C) — this is intentional (see §3 / R1). These goldens gate Slices B and C.

**Slice B — baseStep scalar extraction (AC2). SECOND.**
Independent of A. `baseStep.js` is **dormant on the carrier/sphere path** (verified: `planet-lod-rivers.js`/`tectonic.js` do NOT import it; its only non-test caller is `worldengine-fieldviz.html`; the sphere path uses the separate root `relief-base-step.js`). So Slice B *cannot* move any carrier golden — but because AC1 goldens can't witness baseStep values AND the existing baseStep suites pin only determinism/relations/bounds AND AC5 is console-errors-only, Slice B has **no existing exact-value gate**. This rev. adds one:
- **NEW makeBaseStep-output golden (the real Slice-B value-preservation gate). [FIXED: AC2 has no pre/post value-preservation anchor for the baseStep refactor] [FIXED: Slice B (AC2 baseStep extraction) has NO exact-value gate — the new helper test is a tautology, and fieldviz drift is silent] [FIXED: AC2's baseStep gate does not actually guarantee value-preservation (suite pins relations/bounds, not exact scalars)]:** capture `makeBaseStep(bundle, grid)` outputs on the **pre-change `ad156cc` tree** — every `drivers` scalar (`tidalHeat, surfaceGravity, rockyCrust, surfaceHistory, age, radialStrainSign, radialStrainMag, despinAmp, discriminator, useDiscriminator, liquidStability, liquidSpecies, rainFactor`) + `crust.{shellThickness, thermalState, loveK2}` (scalars: deep-equal) + `crust.crustalThickness` (Float32Array: SHA-256 over LE bytes) — over `relief-presets.js`'s 5 `PRESETS` **plus `worldengine-base-verify.test.js`'s frozen adapter bundle** (fixed small `n` + fixed `seed` for determinism). Commit `tests/fixtures/v2-0-basestep-goldens.json`. Assert post-Slice-B equality. This is the only artifact that verifies AC2's "same values the grid op produced," and it makes the scalar-helpers test (below) non-tautological by pinning to a **frozen ad156cc reference** rather than to `makeBaseStep`'s own post-refactor internals.
- **`bodyRawTidal` explicit oracle** (the one AC2 helper with no returned-field on `makeBaseStep`, since `makeBaseStep` returns *calibrated* `tidalHeat`): assert `calibrateTidal(bodyRawTidal(b)) === makeBaseStep(b, grid).drivers.tidalHeat` for every golden bundle, and additionally pin `bodyRawTidal(b)` to its frozen raw value in the golden fixture. **[FIXED: AC2 has no pre/post value-preservation anchor — bodyRawTidal has NO returned-field oracle]**
- Commit gate: `npx vitest run tests/worldengine-base-*.test.js` green (determinism `a===b` + relations + bounds) **+ the new makeBaseStep-output golden unchanged vs `ad156cc`** + AC1 goldens unchanged (belt-and-suspenders; baseStep is dormant on the carrier path so this must hold trivially) + fieldviz loads clean.

**Slice C — condition-vector threading (AC4/AC5). LAST.**
Depends on Slice A (imports `DRIVER_PRESETS` + `buildNeutralBodyDrivers` for the headless AC4 oracle) and Slice B (`bodyShellThickness` + `bodyRawTidal` helpers for the derivation).
- **Slice C updates the shared bundle-builder path so BOTH the lab and the AC1 harness attach the nested `condition`.** The AC1 goldens were captured (post-A) *without* condition; the Slice-C gate re-runs the harness *with* condition against those condition-less goldens — **byte-equality IS the inertness proof** for the widened bundle. **[FIXED: AC1 golden harness reconstructs the bundle rather than driving the real lab route(); §3 is ambiguous about whether the gate-time bundle carries the nested condition]** — §3 now states unambiguously that the gate-time bundle carries `condition` while the golden does not.
- Commit gate: AC1 goldens unchanged with condition-bearing gate-time bundles (proves tune builders ignore the widened bundle) + **the AC4 "driversToTune/magmaDriversToTune outputs unchanged vs a null-condition bundle" assertion is REQUIRED/load-bearing, not optional** **[FIXED: §3 ambiguous whether gate-time bundle carries nested condition — lean on AC4 null-condition assertion and mark it required]** + `driversToTune(D_EARTH)===null` and `magmaDriversToTune(MAGMA_REF)===null` still hold + AC4 headless vector test + AC5 live (lab + fieldviz zero console errors) + full suite green.

Reorder freedom: A and B are independent; A must precede the golden capture; C must be last. Chosen order A→B→C.

---

## 2. Exact new/changed files + helper signatures

### Slice A
**NEW `driver-presets.js`** (repo root, sibling of `relief-presets.js`/`planet-archetypes.js`/`planet-drivers.js`):
```js
export const DRIVER_PRESETS = { /* the 17 entries, moved verbatim from lab :2645-2794 */ };
export const PRESET_NAMES = Object.keys(DRIVER_PRESETS);
export const PRESET_ARCHETYPE = { /* the 15 entries, moved verbatim from lab :1923-1939 */ };
```
Shape = exactly the current lab objects (deep-equal). `DRIVER_PRESETS` keeps all 17 keys incl. `'Mars (arid rocky)'` and `'Hot Jupiter (locked giant)'` (data, no archetype mapping). `PRESET_ARCHETYPE` keeps the 15 mapped keys verbatim (preset-name → RADIUS_RANGES_EARTH archetype tag). **[FIXED: AC1 headless harness depends on two lab-trapped artifacts (PRESET_ARCHETYPE …)]**

**NEW `body-drivers.js`** (repo root) — the neutral (no-slider-override) driver construction, extracted verbatim from lab :2858-2890 so the lab AND the AC1 harness share one source (no duplication, no drift):
```js
import { magmaThermal } from './src/worldengine/history/magmatism.js'; // exact import path per lab
// verbatim relocation of lab presetDriverDefaults(u, fp) :2858-2866
export function presetDriverDefaults(u, fp) { /* { gravity, volatiles, tidal, thermal } — byte-identical body */ }
// the no-override buildBodyDrivers path (lab :2878-2890 with useOv() forced false):
export function buildNeutralBodyDrivers(u, fp) {
  const d = presetDriverDefaults(u, fp);
  return { massGravity: d.gravity, volatileFraction: d.volatiles, tidalHeating: d.tidal, thermalState: undefined };
}
```
**[FIXED: AC1 headless harness depends on two lab-trapped artifacts (… neutral buildBodyDrivers)]**

**CHANGED `world-engine-lab.html`**:
- Add `import { DRIVER_PRESETS, PRESET_ARCHETYPE } from './driver-presets.js';` and `import { presetDriverDefaults, buildNeutralBodyDrivers } from './body-drivers.js';` to the module-import block (`:145`/`:160` already show ES imports).
- Delete the inline `DRIVER_PRESETS` literal `:2641-2795`, the inline `PRESET_ARCHETYPE` `:1923-1939`, and the inline `presetDriverDefaults` `:2858-2866`.
- `buildBodyDrivers` (`:2878-2890`) now calls the shared neutral builder as its base, then overlays slider overrides (lab-only state `_driverAbMode`/`_driverTouched`/`driverOv`) — keeping the exact same output for untouched fields:
```js
function buildBodyDrivers(u, fp){
  const base = buildNeutralBodyDrivers(u, fp);            // shared source (SAME values the harness sees)
  const useOv = (key) => (_driverAbMode === 'override' && _driverTouched.has(key));
  return {
    massGravity:      useOv('gravity')   ? driverOv.gravity   : base.massGravity,
    volatileFraction: useOv('volatiles') ? driverOv.volatiles : base.volatileFraction,
    tidalHeating:     useOv('tidal')     ? driverOv.tidal     : base.tidalHeating,
    thermalState:     useOv('thermal')   ? driverOv.thermal   : base.thermalState,
    // Slice C attaches `condition:` here (see below).
  };
}
```
- Everything else (`E5_PRESET_REGIME`, `NAMED_BODY`, `TERM_COLOR_BY_PRESET`, GUI dropdown `Object.keys(DRIVER_PRESETS)` at `:5164`, `setPreset` at `:5993`, `resetDriverOverrides` which calls the retained `presetDriverDefaults`) references preset *keys* as strings or the imported functions and works unchanged. `NAMED_BODY` (lab :1920-1921) stays in the HTML — the headless harness only needs archetype + `fp.tidalState?.locked` + `fp.T_eq` (all available from `PRESET_ARCHETYPE` + the preset entry), not `NAMED_BODY`/radius resolution.

**CHANGED `tests/planet-archetypes.test.js`**:
- Replace the HTML scrape (`:24-30`, `labSrc.indexOf('const DRIVER_PRESETS = {')`) with `import { DRIVER_PRESETS } from '../driver-presets.js';` and `const panelPresetKeys = new Set(Object.keys(DRIVER_PRESETS));`. The `.add(state, '…Enabled')` scrape (`:20-22`) and the `labSrc` read (`:12`) stay.
- **Re-establish the lab↔module coupling in CI** (the migration removes the scrape that formerly tied the check to what the lab *literally renders*; without this, the "single source of truth" claim is asserted-not-proven and lab-side re-inlining drift goes unguarded). The test already holds `labSrc`, so this is nearly free — add:
```js
// Lab MUST import the shared presets and MUST NOT re-inline a stale copy.
expect(labSrc).toMatch(/import\s*\{[^}]*\bDRIVER_PRESETS\b[^}]*\}\s*from\s*['"]\.\/driver-presets(\.js)?['"]/);
expect(labSrc).not.toMatch(/const\s+DRIVER_PRESETS\s*=\s*\{/);
// Same for the archetype map (also extracted, also lab-rendered):
expect(labSrc).toMatch(/import\s*\{[^}]*\bPRESET_ARCHETYPE\b[^}]*\}\s*from\s*['"]\.\/driver-presets(\.js)?['"]/);
expect(labSrc).not.toMatch(/const\s+PRESET_ARCHETYPE\s*=\s*\{/);
```
**[FIXED: Preset drift guard loses its lab coupling; the plan's 'strictly stronger' claim is false and the lab-imports-the-module link is proven only once, not in CI]** — the `ARCHETYPES.presets ⊂ panelPresetKeys` check now cross-checks the module, AND the two regex assertions guarantee `module-keys == what-the-lab-renders`, so the check is genuinely `⊂ what the lab renders` (the file's original purpose) rather than resting on an unverified `lab-keys == module-keys` assumption.

**DROPPED — `tests/feature-associations.test.js` rewire (NOT part of this workstream).** The original plan's "optional, recommended" rewire of the hard-pinned 17-key array (`:13`) to `Object.keys(DRIVER_PRESETS)` is **not done**. It maps to no AC (AC3 scopes the test rewire to `planet-archetypes.test.js` only), and — verified — that array is a *deliberate independent tripwire* (comment :10-12: "If a preset is added/renamed in the lab, update this list"; consumed :87-96). Rewiring it would collapse the last independent preset copy into the shared module, deleting a real cross-source redundancy rather than "killing a drift copy." Leave it as-is. **[FIXED: feature-associations.test.js rewire serves no AC (self-flagged optional)] [FIXED: Optional feature-associations rewire removes the last INDEPENDENT preset copy]** — kept out of the workstream/gate set entirely; if a future workstream ever does rewire it, that workstream must add a one-time `expect(Object.keys(DRIVER_PRESETS)).toEqual(<frozen 17-key list>)` so a silent change to the module's preset SET still trips human review.

### Slice B
**CHANGED `src/worldengine/base/baseStep.js`** — extract the per-body scalar block (currently inline `:12-98`) into pure, grid-free named exports; `makeBaseStep` calls them and keeps its `{ drivers, crust, substrate }` return byte-identical. Single-source (each formula lives in exactly one place — kills the R-basestep drift risk, delegable #11):
```js
// One aggregator = the actual computation (grid-free; no Float32Array alloc, no substrate):
export function deriveBodyScalars(bundle) // → {
//   surfaceGravity, rawTidalIoRatio, tidalHeat(calibrated), ageNorm, density, rockyCrust,
//   surfaceHistory, shellThickness, despinAmp, radialStrainSign, radialStrainMag, thermalState,
//   loveK2, liquidStability, liquidSpecies, rainFactor, discriminator, useDiscriminator }
// Thin named helpers (each returns its field from deriveBodyScalars — zero formula duplication):
export function bodyRawTidal(bundle)        // D12 raw Io-ratio  (was baseStep.js:23-27, PRE-calibrateTidal)
export function bodyShellThickness(bundle)  // was :42
export function bodyThermalState(bundle)    // was :85
export function bodyRadialStrain(bundle)    // → { sign, mag }   (was :39-40)
export function bodyLiquidStability(bundle) // was :45-60
export function bodySurfaceGravity(bundle)  // was :14  (size/vigor ingredient for Φ)
export function bodyAgeNorm(bundle)         // was :34  (radiogenic ingredient for Φ)
```
`makeBaseStep` becomes: `const s = deriveBodyScalars(d);` then the **unchanged** grid loop for `crustalThickness` (`:88-92`) + `makeSubstrate` (`:94`) + reassemble the SAME `drivers`/`crust` objects (`:95-98`) from `s`'s fields. No change to signature or return. "radiogenic/size-vigor terms" in AC2 map to `bodySurfaceGravity` + `bodyAgeNorm` — we do NOT invent a composite Φ here (Φ is redefined in V2-1; inventing it now would violate AC2's "same values the grid op produced").

**NEW `tests/worldengine-base-scalar-helpers.test.js`** (AC2, wiring check): imports the helpers + `makeBaseStep`, asserts `bodyShellThickness(b) === makeBaseStep(b, grid).crust.shellThickness`, `bodyThermalState(b) === …crust.thermalState`, etc. over `relief-presets.js`'s 5 `PRESETS`. **This proves WIRING (makeBaseStep uses the helpers) — it is tautological for value-preservation by design** (both sides are `deriveBodyScalars(b).field`). The value-preservation proof is the separate golden below, NOT this file. **[FIXED: AC2's baseStep gate does not actually guarantee value-preservation — the helper self-consistency test only proves helper===makeBaseStep-internal]**

**NEW `tests/fixtures/v2-0-basestep-goldens.json`** (captured on `ad156cc`) + **NEW `tests/worldengine-base-output-golden.test.js`** (AC2 value gate) — the makeBaseStep-output golden described in §1 Slice B: pre/post equality on all `drivers` scalars + `crust.{shellThickness,thermalState,loveK2}` (deep-equal) + `crust.crustalThickness` (SHA-256) + `bodyRawTidal` raw value, over `relief-presets.js`'s 5 `PRESETS` + `worldengine-base-verify.test.js`'s frozen adapter bundle, plus the `calibrateTidal(bodyRawTidal(b)) === makeBaseStep(b).drivers.tidalHeat` oracle. **[FIXED: AC2 has no pre/post value-preservation anchor for the baseStep refactor] [FIXED: Slice B (AC2 baseStep extraction) has NO exact-value gate — fieldviz drift is silent]** — this also closes the silent-fieldviz-drift hole (AC5 only checks console errors; the golden pins the numeric output `worldengine-fieldviz.html`'s sole non-test caller consumes).

### Slice C
**NEW `body-condition-vector.js`** (repo root) — the pure `_fp → condition vector` derivation, importable by the lab, the AC4 test, and (later) V2-1 E1:
```js
import { bodyShellThickness, bodyRawTidal } from './src/worldengine/base/baseStep.js'; // BOTH helpers imported
// fp = raw DRIVER_PRESETS entry; derived = deriveUniforms(fp,tier) uniforms (has surfaceGravity, tidalHeat[RAW]).
export function deriveConditionVector(fp, derived, radiusEarth) { return {
  density:         fp.composition?.density ?? 5.5,     // composition/density
  composition:     fp.composition ?? null,             // D2 volatile / D9 iron / D10 C:O passthrough
  age:             fp.age ?? 4.5,                       // D16
  radiusEarth:     radiusEarth ?? fp.radiusEarth ?? 1.0,// radius (drawn value; fp fallback headless)
  eccentricity:    fp.eccentricity ?? 0,               // D12 input
  rawTidalIoRatio: derived?.tidalHeat ?? bodyRawTidal(fp), // D12 RAW, explicitly named + un-calibrated
  shellThickness:  bodyShellThickness(fp),             // baseStep helper (Slice B)
  magneticField:   fp.magneticField,                   // D13 data-only (undefined for lab presets)
  metallicity:     fp.metallicity,                     // metallicity data-only (undefined for lab presets)
};}
```
**[FIXED: deriveConditionVector sketch calls bodyRawTidal without importing it]** — `bodyRawTidal` is now in the import list alongside `bodyShellThickness` (the object body's `rawTidalIoRatio` fallback references it; the original sketch imported only `bodyShellThickness` → ReferenceError as written).

**CHANGED `world-engine-lab.html`** — in `buildBodyDrivers` (now shared-neutral-based, above), attach the vector as a **nested `condition` sub-object** (NOT flat keys):
```js
return { massGravity:…, volatileFraction:…, tidalHeating:…, thermalState:…,   // 4 fields via shared builder + overrides
         condition: deriveConditionVector(fp, u, state.planetRadiusEarth) };  // NEW, nested
```
Nesting is load-bearing for byte-safety (§5 R1): `magmaThermal` reads a flat `d.age` (`magmatism.js:101`) — a flat `age` key would silently re-drive the Lava/Magma tune and break AC1. Nested `condition.age` is invisible to both tune builders (they read flat `massGravity`/`volatileFraction`/`tidalHeating`/`thermalState`/`age` and ignore unknown keys). Import `deriveConditionVector` in the module block.

**CHANGED `tests/fixtures/v2-0-carrier-golden.mjs` (harness)** — Slice C updates the shared bundle-builder so the harness attaches `condition: deriveConditionVector(fp, u, fp.radiusEarth)` exactly as the lab does (single-source via the same `deriveConditionVector`). The committed goldens (captured post-A, condition-less) are UNCHANGED; only the gate-time bundle now carries `condition`. Byte-equality = inertness proof. **[FIXED: §3 ambiguous whether gate-time bundle carries nested condition]**

**CHANGED `planet-lod-rivers.js`** — thread `condition` through so it's readable at the seam for V2-1. In `writeBodyRelief`'s destructure (`:448-449`) and `route`'s destructure/`writeBodyRelief` call (`:1177-1178`, `:1199`), it already flows *inside* `bodyDrivers` (the tune builders receive the widened bundle and ignore `.condition` — exactly AC4's wording), so **no signature change is strictly required**; add a one-line comment at `:448` documenting `bodyDrivers.condition` as the V2-1 E1 read surface. (No writer consumes it — shadow-mode, per intent's "surfaced-but-not-consumed".)

**NEW `tests/worldengine-base-condition-vector.test.js`** (AC4): imports `deriveConditionVector` + `DRIVER_PRESETS`, asserts each named field present with `_fp`-derived (non-default) values for presets that define them (e.g. Magma `eccentricity` 0.01, `density` 8; Europa `shellThickness` low-g band) and `rawTidalIoRatio` un-calibrated (equals `deriveUniforms(fp).tidalHeat`, the raw Io-ratio, NOT `calibrateTidal(...)`); plus an instrumented `writeBodyRelief` spy confirming `bodyDrivers.condition` arrives at the seam AND — **this assertion is REQUIRED, not optional; it is the load-bearing widened-bundle inertness check paired with the AC1 gate** — `driversToTune`/`magmaDriversToTune` outputs are unchanged vs a null-condition bundle. **[FIXED: §3 ambiguous whether gate-time bundle carries nested condition — mark AC4 null-condition assertion required]**

---

## 3. AC1 byte-identity test strategy

**Mechanism: golden hashes captured pre-change, re-run post-change.** (Not a live two-worktree diff at gate time — goldens are committed so the gate is reproducible in CI and after each slice.) **Byte-identity strategy is unchanged and un-weakened** — this rev. only (a) gives the harness a complete shared bundle source and (b) makes the condition-inertness proof explicit.

1. **Harness** `tests/fixtures/v2-0-carrier-golden.mjs` (capture) + `tests/v2-0-byte-identity.test.js` (gate). For each of the **15 archetype-mapped presets** (the `PRESET_ARCHETYPE` keys, now imported from `driver-presets.js`; excludes Mars + Hot Jupiter) × seeds **{1,2,3,7,42}**:
   - Build a carrier: `makeSphereField(buildIrregularSphere(TARGET_N, LLOYD))` (the established headless pattern, `tests/planet-lod-rivers-swappable-uplift.test.js:15-20`).
   - Reconstruct the lab's `writeBodyRelief` bundle for that preset **from the shared single source** (no hardcoding/duplication): `archetype = PRESET_ARCHETYPE[name]` (imported), `locked = !!fp.tidalState?.locked`, `T_eq = fp.T_eq`, `macroSeed = seed`, `bodyDrivers = buildNeutralBodyDrivers(deriveUniforms(fp, tier), fp)` (imported from `body-drivers.js`, passing **the same `tier` the lab passes at its `route()` call site**). **[FIXED: AC1 headless harness depends on two lab-trapped artifacts (PRESET_ARCHETYPE + neutral buildBodyDrivers)]** — every bundle input now resolves to an importable module the lab also consumes, so the harness exercises the *same* neutral construction the lab's runtime `buildBodyDrivers` uses (the finding's core concern: the post-Slice-C lab neutral path is no longer exercised by "no automated test").
   - **Capture-time (post-A, pre-C):** the bundle has **NO `condition`** (deriveConditionVector doesn't exist yet). **Gate-time (post-C):** the harness attaches `condition: deriveConditionVector(fp, u, fp.radiusEarth)` — same call the lab makes. The golden (condition-less) vs the gate-time carrier (condition-bearing) → **byte-equality is the intended proof that the widened bundle is inert.** **[FIXED: AC1 golden harness … §3 is ambiguous about whether the gate-time bundle carries the nested condition]**
   - Call `writeBodyRelief(carrier, bundle)`.
   - **Hash every persistent carrier typed-array** the writers can mutate: `carrier.height`, `carrier.grainAngle`, `carrier.grainMag`, `carrier.regime`, `carrier.faultDensity` (SHA-256 over the concatenated little-endian bytes) → one hash per `(preset, seed)`. This covers "height and all carrier fields."
2. **Capture** these 75 hashes into a committed fixture `tests/fixtures/v2-0-carrier-goldens.json` right after Slice A lands (post-A == pre-change behavior per §1 Slice-A byte-safety (1)-(4); the harness needs Slice A's importable presets/archetype/neutral-builder to run at all).
3. **Gate** `tests/v2-0-byte-identity.test.js` recomputes the 75 hashes and asserts equality vs the committed goldens — run after Slice B and (with condition attached) after Slice C. This exercises all 5 shipped writer paths: plate (Rocky/Ocean), volcanic (Lava/Magma+T_ss basin), stagnant-lid (Venus), shell (Frozen/Europa/Titan/Eyeball), despun (Jovian/Saturnian/Neptunian/Sub-Neptune/Carbon/Crystal).
4. **Anchor invariants** (separate assertions in the same file): `driversToTune(D_EARTH) === null` and `magmaDriversToTune(MAGMA_REF) === null` — the two `tune=null` guards that hold the plate/volcanic byte-identity.

Full-suite invariant: `npx vitest run` green with **no pre-existing test dropped or skipped** (the 80 pre-change `tests/*.test.js` files stay green; V2-0's new AC test files are additive — now ~6 files: v2-0-byte-identity, worldengine-base-scalar-helpers, worldengine-base-output-golden, worldengine-base-condition-vector, plus the two fixture `.mjs`/`.json`).

---

## 4. AC-0 conformance table (field → D-slot/derivation → named consumer)

| Surfaced field | D-slot / named derivation | Named consumer (ROADMAP-v2 DAG) |
|---|---|---|
| `rawTidalIoRatio` | **D12 raw** Io-ratio, pre-`calibrateTidal` (`baseStep.js:23-27` = `bodyRawTidal`; `deriveUniforms:527`) | V2-1 E1: `m_hp = rawTidal − HEATPIPE_IO_THRESHOLD` (§2.3, §2.4 heat-pipe gate) + Φ tidal term (§7b #4/#6) |
| `tidalHeating` (existing, calibrated) | D12 calibrated (`calibrateTidal`) | existing readers: `magmaDriversToTune` H, `driversToTune` PLATE_COUNT_MIN |
| `eccentricity` | orbital ecc — D12 *input* (not its own slot) | V2-1 E1: raw-tidal derivation when upstream D12 absent (production path) |
| `composition.density` | composition/density → `rockyCrust` silicate/ice gate (`baseStep.js:30-31`) | V2-1 E1 `compositionClass` (rocky/gas terminal, §1 Stage-A); §7b #10 dispatch 2-tuple |
| `composition` (D2 volatileFraction / D9 ironFraction / D10 carbonToOxygen) | composition passthrough | V2-1 E1 `compositionClass` + V axis (D2); V2-9a carbon terminal (D10) |
| `age` | **D16** | V2-1 E1 Φ radiogenic term (§2.3 "radiogenic budget scaled by mass") |
| `radiusEarth` | radius → surfaceGravity (D14) + mantle mass/depth | V2-1 E1 Φ size-aware proxy (radiogenic-scaled-by-mass + d³) (§2.3, §7b #4) |
| `shellThickness` | named derivation `clamp01(0.3+0.5·smoothstep(0.5,9,g)+0.2·(1−ageNorm))` (`baseStep.js:42` = `bodyShellThickness`) | V2-1 E1 Φ d³ mantle-depth term (§7b #4) + `L` z-term (§2.3) — ⚠ triple-duty (z/D/d) flagged §7b #4 SH-F2; the semantic split is V2-1's, NOT V2-0's (V2-0 surfaces the raw scalar only) |
| `thermalState` (existing crust field, now a helper) | named derivation `clamp01(0.5·tidalHeat+0.5·(1−ageNorm))` (`baseStep.js:85`) | baseStep helper for V2-1 Stage-A / diagnostic (§2.3: explicitly NOT Φ) |
| `radialStrain` {sign,mag} | named derivation (`baseStep.js:39-40`) | V2-1 Stage-A figure/strain (E2) reuse |
| `liquidStability` | named gate chain (`baseStep.js:45-60`) | V2-1 Stage-A / V axis reuse |
| `magneticField` (D13, data-only) | D13 = ironFraction×rotation | **declared data-only**; consumer = V2-6 atmosphere/aurora; no V2-0/V2-1 reader (shadow) |
| `metallicity` (data-only) | metallicity passthrough (`adaptL0.js:39`) | **declared data-only**; no lab preset defines it → `undefined` (surfaced-not-consumed) |

**Check 1 (driver connectivity):** every surfaced scalar is D-slot-backed or a named baseStep derivation (table above). The archetype-string routing in `isEarthlikePlatePath`/`isVolcanicPath`/`isStagnantLidPath`/`isShellReliefPath` (`planet-lod-rivers.js:410/435/444/422`) is **accepted debt, already declared** (SPINE check 1; ROADMAP §5.2/§5.3), to be replaced by E1's derived `{compositionClass, geodynamicRegime}` at V2-1 (shadow) / V2-3 (flip). V2-0 adds **no new** archetype-string routing — it only surfaces data + relocates code (incl. moving `PRESET_ARCHETYPE` HTML→module, which is a relocation, not new routing) — so the debt is not widened.

**Check 2 (named consumer):** presets module → lab + tests + V2-1 conformance oracle (headless preset source); baseStep helpers → V2-1 E1 (Φ/L/Stage-A) + fieldviz; condition vector → V2-1 E1 at the `writeBodyRelief` seam. Every emitted field points at V2-1 — no dead fields (the two `data-only` rows are explicitly declared as such per the intent's "surfacing D12/D13/D16/metallicity data-only").

**Check 3 (taxonomy registration):** V2-0 adds **no** new lab control/preset/feature/province (it moves the existing 17 presets + the 15-entry archetype map + the neutral driver builder, adds no toggle). `planet-archetypes.test.js` drift guards stay green (rewired to import the module; `*Enabled` scrape untouched; **new lab-coupling assertions** guarantee the lab imports the module and holds no inline copy). Gate: `npx vitest run tests/planet-archetypes.test.js`.

---

## 5. Risks + mitigations

- **R1 — flat-`age` byte-safety trap (HIGH).** `magmaThermal` reads flat `d.age` (`magmatism.js:101`); adding a flat `age` to `bodyDrivers` would re-drive the Lava/Magma tune → carrier drift → AC1 fail. *Mitigation:* nest all new fields under `bodyDrivers.condition` (collision-proof; tune builders read only flat keys). AC1 goldens (condition-less golden vs condition-bearing gate bundle) + the `tune-null` anchors + the REQUIRED AC4 null-condition assertion are the mechanical proof.
- **R2 — baseStep return drift (MED → now GATED).** Extraction must keep `makeBaseStep`'s `{drivers,crust,substrate}` byte-identical or fieldviz + baseStep suites break. *Mitigation (strengthened):* the new **makeBaseStep-output golden** (`tests/fixtures/v2-0-basestep-goldens.json`, captured on `ad156cc`) pins every `drivers` scalar + `crust.{shellThickness,thermalState,loveK2}` + `crust.crustalThickness` hash + the raw-tidal value; the value-preserving refactor must reproduce them exactly. The old mitigation ("the baseStep suites are the gate") was insufficient — those suites pin only determinism/relations/bounds and provably cannot witness a mistranscribed formula that preserves monotonicity + [0,1]. baseStep is dormant on the carrier path (verified), so R2 cannot reach AC1, and AC5's console-only check cannot see numeric fieldviz drift — hence the golden is the sole real gate. **[FIXED: AC2 has no pre/post value-preservation anchor] [FIXED: Slice B has NO exact-value gate — fieldviz drift is silent]**
- **R3 — preset/archetype/neutral-builder extraction breaks the lab / scrapers (MED).** Removing the literals breaks the `indexOf`-scrape in `planet-archetypes.test.js`. *Mitigation:* AC3 rewires that test to import the module + adds lab-coupling regex assertions; AC5 live-loads the lab (zero console errors); the neutral-builder functions are relocated verbatim (reviewable diff) + covered by the post-A forward-drift snapshot. Verified no other live scraper: `feature-associations.test.js` hardcodes its own list (independent, left as-is), the rest reference the literal only in comments.
- **R4 — shellThickness triple-duty (MED, deferred).** §7b #4 SH-F2: `shellThickness` conflates lithosphere-z / icy-shell-D / rocky-mantle-d. *Mitigation:* V2-0 surfaces the raw scalar **as-is, unconsumed**; it must NOT bake a d³ transform. The semantic split is V2-1's job — flagged in the AC-0 table, not resolved here.
- **R5 — radius source ambiguity (LOW).** The render-meaningful radius is `state.planetRadiusEarth` (drawn: canonical for NAMED_BODY, seeded for archetypes), not always `fp.radiusEarth`. *Mitigation:* `deriveConditionVector` takes the drawn radius as an arg (lab passes `state.planetRadiusEarth`), `fp.radiusEarth` as headless fallback. NOTE: the AC1 harness passes `fp.radiusEarth` (headless fallback) at gate time — this is inert for AC1 because `condition.radiusEarth` is never read by the writers; it only needs to be *consistent* capture-vs-gate, which it is (condition is absent at capture, so no radius mismatch can move a golden).
- **R6 — golden capture point (LOW → tightened).** Goldens must encode pre-change behavior. *Mitigation:* capture after Slice A, whose byte-safety is now proven by §1 Slice-A (1)-(4): DRIVER_PRESETS **and** PRESET_ARCHETYPE deep-equal to `ad156cc` snapshots, the neutral-builder functions relocated verbatim (reviewable diff) + a post-A forward-drift snapshot, full suite green, AC5 lab load. This makes the widened Slice-A surface byte-equivalent to pre-change, so post-A goldens validly encode pre-change. **[FIXED: AC1 headless harness depends on two lab-trapped artifacts — extending Slice-A byte-safety to the newly-extracted artifacts]**
- **R7 — "same test count" wording (LOW → needs Max sign-off).** V2-0 adds ~6 new AC test/fixture files, raising the total; the literal AC1 clause "full vitest suite passes at the same test count as pre-change" therefore fails on a wording technicality. *Mitigation:* interpret it as "no pre-existing test dropped/skipped" (the 80 pre-change files stay green; new tests additive). This is a **contract-conformance bookkeeping** deviation, not a byte-identity/regression risk — but it needs Max's explicit sign-off before the verify-workstream run so the count clause doesn't auto-fail the gate. **[FIXED: AC1 literal 'same test count' conflicts with adding ~4 new AC test files]** → openQuestion #1.
- **R8 — neutral-builder relocation byte-safety (LOW, new).** Moving `presetDriverDefaults`/`buildNeutralBodyDrivers` HTML→`body-drivers.js` in Slice A widens Slice A's surface beyond the original "presets only." *Mitigation:* verbatim relocation (git diff shows the 8-line body unchanged, only `export` + import wired) + post-A forward-drift snapshot of `buildNeutralBodyDrivers` outputs over all 15 presets + full suite + AC5. The relocated `magmaThermal` import path must match the lab's exact source (`./src/worldengine/history/magmatism.js`); a wrong path throws at lab load (caught by AC5) rather than silently drifting.

---

## OpenQuestions → see structured `openQuestions` field.
