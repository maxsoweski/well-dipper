# V2-2b-1 — Stagnant-side driver→expression MULTIPLY — BUILD-PLAN

**Written 2026-07-04** (PLAN phase; revised after two adversarial lenses — buildability/byte-safety + fidelity-to-contract). **Verdict: BUILD-READY.** Direct analog of the SHIPPED **#4-MULTIPLY** (`world-engine-magmatism-multiply`, `magmaDriversToTune`, magmatism.js:113-129) on the **STAGNANT / Venus** corner. Builds the from-scratch pure fn `stagnantDriversToTune(drivers)` in `src/worldengine/base/stagnantLid.js`, anchored so `stagnantDriversToTune(VENUS_REF) === null` → Venus byte-identical, non-null elsewhere → within-world variety. Threaded at the SHIPPED dispatch seam (planet-lod-rivers.js:489-491), NOT the V2-2a router. Source of truth: `contract.json` (12 ACs). This plan pins the calibration, shows the full builder, lists the concrete SLICE-A/B edits, maps every AC to a check, proves the reference path is untouched, folds the adversary findings, and flags the two real calibration risks I verified against live code.

---

## Calibration RESOLVED (the load-bearing constants pinned)

### VENUS_REF — the null point (analog of `MAGMA_REF`, magmatism.js:93, but **ON** the shipped preset)

`VENUS_REF` is Venus's REAL preset read-slots (driver-presets.js:47), **read-surface-matched** (gotcha 1): `V` and `g` FLAT, `T_surf` and `age` NESTED under `.condition`. Exactness of `g` is load-bearing (gotcha 2): I verified in node that `0.815/0.95**2 === 0.815/(0.95*0.95) === massEarth/(radiusEarth*radiusEarth)` (the live `deriveUniforms` surfaceGravity, planet-lod-lab-core.js:514) `= 0.9030470914127423` to full float precision, and that the rounded `0.903 !== 0.9030470914127423`. So:

```js
export const VENUS_REF = Object.freeze({
  volatileFraction: 0.02,          // FLAT V/dryness D-slot (Venus composition.volatileFraction, driver-presets.js:47)
  massGravity: 0.815 / (0.95 * 0.95), // FLAT g D-slot — EXACT live-derive (NOT rounded 0.903); byte-exact vs deriveUniforms:514
  condition: { T_eq: 737, age: 4.5 },  // NESTED read surface (deriveConditionVector.T_eq=fp.T_eq??288=737; age=fp.age??4.5=4.5)
});
```

Authored as a **frozen literal** (base/ writers take no cross-imports; `MAGMA_REF` is likewise a literal). `AC-TUNE-NULL` asserts each read slot === the live-constructed Venus bundle slot to full precision.

### The thermal helper + `THERMAL_REF` — ⚠ CONTRACT-ALIGNED OVERRIDE of a verbatim `magmaThermal` mirror (do NOT copy magmaThermal)

**This is a deliberate, contract-aligned deviation from a literal "mirror magmaThermal" reading — NOT an oversight** (byte-safety lens finding 1 / the R1 discipline, body-condition-vector.js:12). The contract's designDecision #6 requires "Venus thermalState ~0.275 either way" and the golden requires Venus byte-identical; a verbatim `magmaThermal` mirror satisfies neither. Here is why, verified empirically.

**Verified byte-identity break.** `magmaThermal` (magmatism.js:97-103) auto-derives `H` from raw tidal when `thermalState` is absent. Mirroring it is UNSAFE here. Node check on the live Venus bundle (the exact one the 75-golden harness builds, `tests/fixtures/v2-0-carrier-golden.mjs:73-76`):

```
venus raw tidalHeat = 0.001179463813811032   (deriveUniforms:527, ecc 0.007 / orbit 16888)
magmaThermal-style H(liveVenus) = 0.27558973…   ≠   H(VENUS_REF, no tidal → ??0) = 0.275
thermalDev at live Venus = +0.00058973…  (NON-ZERO)
```

Because the activeFrac/coronaCount overrides key off `thermDev`, a non-zero `thermDev` at live Venus makes every override deviate from its DEFAULT → the exact-only identity guard returns a **non-null** tune at Venus → the 75-golden **moves** (AC-ZERO-CLOBBER + AC-TUNE-NULL(b) fail). Unlike `MAGMA_REF` (off the real presets, so live Lava/Magma were *meant* to respond), `VENUS_REF` sits ON the shipped Venus row in the golden captured `7441c92` — it must yield **exactly** null.

**Resolution (first-cut, byte-safe):** `stagnantThermal` consumes ONLY an **explicit** `thermalState` (pass-through, `clamp01`) and falls back to the constant Venus-neutral `THERMAL_REF` when it is absent — it does **not** re-derive from raw `tidalHeating`. This is exact at BOTH `VENUS_REF` and the live Venus bundle (both carry `thermalState: undefined` — `buildNeutralBodyDrivers`, body-drivers.js:24 — so both collapse to `THERMAL_REF`, `thermDev = 0`). The corona-activity lever's live/headless response is carried by the explicit `thermalState` (the lab thermal slider / headless synthetic vectors) **plus** `T_surf` (nested `condition.T_eq`, byte-exact 737 at Venus). This is the same "don't let a raw-tidal path leak Venus's live value" discipline the codebase already codifies (body-condition-vector.js:12, R1). **Consequence to hold in view:** because `stagnantThermal` never reads raw physics, the corona-activity lever is reachable ONLY via an explicit `thermalState` (lab thermal slider / headless vectors), never derived from a stagnant body's raw tidal — which is fine, since Venus is the sole live stagnant body and the lab thermal slider supplies it.

```js
export const THERMAL_REF = 0.275;   // Venus-neutral endogenic drive (== magma's H_REF; tidal-quiet, age 4.5)
// Explicit-only: byte-exact at Venus (thermalState undefined → THERMAL_REF at BOTH VENUS_REF and live Venus).
// NO raw-tidal auto-derivation (that leaks Venus's live tidalHeat 0.00118 → thermDev 0.00059 → golden moves).
function stagnantThermal(drivers) {
  return (drivers && drivers.thermalState != null) ? clamp01(drivers.thermalState) : THERMAL_REF;
}
```

### First-cut transfer gains + the deferred gravity opt-in

Mirror magma's `K_COUNT/K_HEIGHT/K_LO/K_ELONG` (magmatism.js:107). First-cut, UAT-tunable; the AC asserts correct SIGN + measurable magnitude, not a fixed gain.

```js
const K_TESS = 0.12,   // V(dryness) → TESSERA_FRAC   (drier ↑ ; slope tuned so a full 0.02→0.6 wet sweep drains tessera toward the 0.02 floor)
      K_AGE  = 0.015,  // condition.age → TESSERA_FRAC (older ↑ ; headless-only limb — no age slider, planet-lod-lab.html:2684)
      K_ACT  = 0.35,   // thermalState → CORONA_ACTIVE_FRAC (hotter/younger ↑)
      K_ACT_T= 0.25,   // T_surf → CORONA_ACTIVE_FRAC (hot-dry-limb ↑, via tNorm)
      K_POOL = 0.9,    // vigor(+wetness) → CORONA_POOL  (proportional multiply)
      K_PLUME= 5,      // vigor → PLUME_MIN
      K_G    = 0;      // GRAVITY relief-scaling DEFERRED (zeroable; while 0, g feeds NO override → anti-mush trivially true)
const TSURF_SPAN = 500; // T_surf normalization span (Kelvin) — 737 → ~237 spans one unit
```

`K_G = 0` keeps the anti-mush invariant trivially true (BASE_* floors + amplitudes untouched). While `K_G = 0` the `g` slot feeds no override, so `VENUS_REF.massGravity`'s exact value is *inert today* — but AC-TUNE-NULL(c) still asserts it, and it becomes load-bearing the instant the K_G opt-in fires (gotcha 2).

---

## `stagnantDriversToTune` (mirror `magmaDriversToTune`, magmatism.js:113-129 — shape-for-shape)

Population knobs ONLY (TESSERA_FRAC :49, CORONA_ACTIVE_FRAC :53, CORONA_POOL :51, PLUME_MIN :46). BASE_* floors (:62) + all amplitudes UNTOUCHED → ordering `mean(tessera)>mean(plains)>mean(rift)` preserved STRUCTURALLY. Deviation-from-VENUS_REF signals (mirror magma's `Hd = H − H_REF`) so every override collapses to its DEFAULT at VENUS_REF. Null-guard FIRST, exact-only identity guard LAST.

```js
// Map the body's D-vector → a population-knob `tune` override, anchored so stagnantDriversToTune(VENUS_REF) === null
// → the writer's `tune ? {...DEFAULTS,...tune} : DEFAULTS` ternary (stagnantLid.js:175) takes the untouched branch
// → byte-identical Venus. Mixed read surface BY DESIGN (gotcha 1): V,g FLAT; T_surf,age NESTED under .condition.
// ZERO alea draws — a pure DEFAULTS-override fn. Population knobs only (no BASE_* / amplitude key ever returned).
export function stagnantDriversToTune(drivers) {
  if (drivers == null) return null;                          // (i) NULL-GUARD FIRST (mirror magmatism.js:114) — dispatch
                                                             //     calls with bodyDrivers defaulting null (rivers:452);
                                                             //     the shipped structure tests (:340,:368) reach it null.
  const D = DEFAULTS;
  // read surface: V,g FLAT with VENUS_REF fallback; T_surf,age NESTED via optional-chaining + fallback (never-throw)
  const V   = drivers.volatileFraction ?? VENUS_REF.volatileFraction;   // 0.02 at Venus
  const g   = drivers.massGravity      ?? VENUS_REF.massGravity;        // exact live g at Venus (deferred: K_G=0)
  const age = drivers.condition?.age   ?? VENUS_REF.condition.age;      // 4.5 at Venus — NESTED (never re-drives stagnantThermal)
  const Ts  = drivers.condition?.T_eq  ?? VENUS_REF.condition.T_eq;     // 737 at Venus — NESTED
  const H   = stagnantThermal(drivers);                                 // explicit thermalState only → THERMAL_REF at Venus

  // deviation signals — EVERY ONE is exactly 0 at VENUS_REF and at the live Venus bundle (byte anchor)
  const dryDev   = VENUS_REF.volatileFraction - V;             // drier > 0, wetter < 0   (0 at Venus)
  const ageDev   = age - VENUS_REF.condition.age;              // older > 0               (0 at Venus)
  const tNorm    = (Ts - VENUS_REF.condition.T_eq) / TSURF_SPAN; // cooler < 0            (0 at Venus)
  const thermDev = H - THERMAL_REF;                            // hotter/younger > 0       (0 at Venus)
  const vigor    = thermDev + tNorm;                           // hot-dry-limb endogenic vigor (0 at Venus)
  const gFactor  = clamp(0.5, 2.0, Math.pow(g / VENUS_REF.massGravity, -K_G)); // K_G=0 ⇒ gFactor≡1 (byte-safe)

  // population-knob overrides — drier/older ↑ tessera; hotter/younger ↑ activeFrac + coronaCount; more vigor ↑ plumes
  const TESSERA_FRAC       = clamp(0.02, 0.20, D.TESSERA_FRAC + K_TESS * dryDev + K_AGE * ageDev);
  const CORONA_ACTIVE_FRAC = clamp(0.30, 0.95, D.CORONA_ACTIVE_FRAC + K_ACT * thermDev + K_ACT_T * tNorm);
  const CORONA_POOL        = clamp(20, 400, Math.round(D.CORONA_POOL * gFactor * (1 + K_POOL * (vigor - dryDev))));
  const PLUME_MIN          = clamp(3, 12, Math.round(D.PLUME_MIN + K_PLUME * vigor));

  // (ii) EXACT-ONLY IDENTITY GUARD (mirror magmatism.js:124-127): at VENUS_REF every override === its DEFAULT
  //      → return null → the writer takes the untouched DEFAULTS branch → byte-identical Venus.
  if (TESSERA_FRAC === D.TESSERA_FRAC && CORONA_ACTIVE_FRAC === D.CORONA_ACTIVE_FRAC &&
      CORONA_POOL === D.CORONA_POOL && PLUME_MIN === D.PLUME_MIN) return null;
  return { TESSERA_FRAC, CORONA_ACTIVE_FRAC, CORONA_POOL, PLUME_MIN };
}
```

*(designDecision #6: `age` is read NESTED via `condition?.age` and feeds ONLY `ageDev → TESSERA_FRAC`; it never reaches `stagnantThermal` — `stagnantThermal` reads the FLAT `thermalState` channel, which `buildNeutralBodyDrivers` omits, so activeFrac responds to `thermalState`/`T_surf`, not age. The single-`??` age read above is the shipped form — the byte-safety lens NIT to drop the illustrative no-op ternary is folded in.)*

**Proof `stagnantDriversToTune(VENUS_REF) === null` — every override walked to its DEFAULT:**

| signal | value at VENUS_REF | why |
|---|---|---|
| `dryDev` | `0.02 − 0.02 = 0` | V read FLAT = 0.02 |
| `ageDev` | `4.5 − 4.5 = 0` | age read NESTED `condition.age` = 4.5 |
| `tNorm` | `(737 − 737)/500 = 0` | T_surf read NESTED `condition.T_eq` = 737 |
| `thermDev` | `0.275 − 0.275 = 0` | `thermalState` undefined → `stagnantThermal` → `THERMAL_REF` |
| `vigor` | `0 + 0 = 0` | |
| `gFactor` | `pow(g/g, 0) = 1` | `K_G = 0` |

→ `TESSERA_FRAC = 0.075 + 0 + 0 = D.TESSERA_FRAC`; `CORONA_ACTIVE_FRAC = 0.65 + 0 + 0 = D`; `CORONA_POOL = round(120·1·(1+0)) = 120 = D`; `PLUME_MIN = round(6 + 0) = 6 = D`. All four `===` DEFAULT → identity guard → **`null`**. The IEEE754 exactness is the deviation-form guarantee (`D + K·0 = D`), identical to magma's `Hd = 0`.

**`stagnantDriversToTune({}) === null`:** `{}` is not `null`, so the null-guard passes; every `??`/`?.` fallback degrades `{}` to the VENUS_REF slots (`{}.condition?.age` → undefined → 4.5, etc.), so all deviations are 0 → identity guard → null (never throws — the "degrade to Venus, don't crash" discipline). **`stagnantDriversToTune(null) === null`** via the explicit null-guard (required — without it `null.volatileFraction` throws and crashes the two shipped structure tests that dispatch with `bodyDrivers === null`).

---

## SLICE A — the pure builder + all headless unit ACs (math-complete, golden trivially unchanged)

The writer's `tune` seam ALREADY EXISTS (stagnantLid.js:175), so the builder is self-contained and fully testable headless before ANY dispatch wiring. Nothing calls the builder yet → the 75-golden and the shipped structure suite are trivially untouched.

**Edits:**

1. **`src/worldengine/base/stagnantLid.js`** — after `STAGNANT_BOUND` (:73), before `stagnantLidRegimeOf` (:78): add the `// ── V2-2b-1 (stagnant driver-response) ──` block: `export const VENUS_REF` (the frozen literal above), `export const THERMAL_REF = 0.275`, the `stagnantThermal` helper, the `K_*`/`TSURF_SPAN` consts, and `export function stagnantDriversToTune` (above). Pure — no `alea`, no `Math.random`, no `Date.now`. `clamp`/`clamp01` already imported (:41). The writer body (:170-412) is UNCHANGED.

2. **`tests/worldengine-base-stagnantlid-multiply.test.js`** — NEW file (mirror `tests/worldengine-base-magmatism-multiply.test.js`; the shipped `…-structure.test.js` stays byte-untouched and green). Imports `{ writeStagnantLidReliefSphere, stagnantDriversToTune, VENUS_REF, THERMAL_REF, DEFAULTS, STAGNANT_BOUND }` + the carrier harness `makeSphereField(buildIrregularSphere(1500, 2))` + `SEEDS=[1,2,3,7,42]`. Reuses the shipped arm's-length `plumePredictor` (SQUARED Gaussian, `sd.PLUME_BELT`), `structureMask`, `latY`, `riftTrenchMask`, `meanTessera/meanPlains/meanOverMask` verbatim (…-structure.test.js:42-104). Also imports `buildNeutralBodyDrivers`, `deriveConditionVector`, `deriveUniforms` + the Venus preset for the live-bundle assertion, and reads the builder source once via `const STAGNANT_SRC = readFileSync(fileURLToPath(new URL('../src/worldengine/base/stagnantLid.js', import.meta.url)), 'utf8')` for the static-grep ACs. Contains the 9 unit-AC describe blocks below.

**SLICE A discharges (unit): AC-0, AC1, AC-TUNE-NULL, AC-BYTE-VENUS, AC-TUNE-RESPONSE, AC2, AC3, AC-ORDER-PRESERVED, AC-VARIETY.** Ends GREEN on `tests/v2-0-byte-identity.test.js` (75/75, nothing calls the builder yet) + the shipped structure suite.

---

## SLICE B — dispatch wiring + lab + integration ACs (Venus MUST stay byte-identical)

**Edits:**

3. **`planet-lod-rivers.js:33`** — extend the import: `import { writeStagnantLidReliefSphere, stagnantLidRegimeOf, stagnantDriversToTune } from './src/worldengine/base/stagnantLid.js';`

4. **`planet-lod-rivers.js:489-491`** — the dispatch edit, mirroring the volcanic branch (:481-483) EXACTLY, passing `bodyDrivers` DIRECTLY (gotcha 3 — NO `stagnantDriversRefOf` helper; `bodyDrivers` is in scope at `writeBodyRelief`:452, defaults null, carries its nested `.condition` per the sanctioned read surface at :449-451):
   ```js
   const slRegime = stagnantLidRegimeOf(archetype, locked);
   if (slRegime) {
     const stagnantTune = stagnantDriversToTune(bodyDrivers);
     const stagnantDiag = writeStagnantLidReliefSphere(carrier, bodyDrivers, { macroSeed, regime: slRegime, tune: stagnantTune });
     stagnantDiag.appliedTune = stagnantTune;
     return { path: 'stagnant-lid', plateDiag: null, shellDiag: null, magmaDiag: null, stagnantDiag };
   }
   ```
   `grainDrivers` is no longer the drivers arg on the stagnant path — byte-safe (the writer `void drivers`, stagnantLid.js:174, exactly as #4-M dropped it on the volcanic path). At Venus with untouched sliders `bodyDrivers` carries Venus's real drivers → `stagnantDriversToTune` → null → byte-identical. Off the stagnant path `bodyDrivers` stays null → the plate/shell/volcanic/despun branches are untouched.

5. **`planet-lod-lab.html:2724` (`buildBodyDrivers`)** — overlay the NEW T_surf control onto the NESTED `condition.T_eq` (the read surface, designDecision #6 — NOT a flat key). Add `driverOv.tsurf` to the override object (:2684, e.g. `tsurf: 737`) and, in `buildBodyDrivers`, after `condition: deriveConditionVector(fp, u, state.planetRadiusEarth)`, apply: `..., condition: (function(){ const cnd = deriveConditionVector(fp, u, state.planetRadiusEarth); if (useOv('tsurf')) cnd.T_eq = driverOv.tsurf; return cnd; })()`. Seed `driverOv.tsurf` from `fp.T_eq` in `resetDriverOverrides` (:2702). No `*Enabled` key → drift guards green (AC-0(3)). Byte-safety note (byte-safety lens): `useOv` is gated on `_driverAbMode==='override' && _driverTouched.has('tsurf')`, so an untouched slider leaves `cnd.T_eq` at the preset value → default Venus renders identically; and the lab is not imported by the golden harness, so lab edits are byte-irrelevant to the 75-golden regardless.

6. **`planet-lod-lab.html:3833` region** — add a `'Body drivers → stagnant relief (V2-2b-1)'` folder mirroring the #4-M `fMagmaDrivers` folder, reusing the `driverOv`/`_driverAbMode`/`_onDriverDrag` plumbing (:3811): a `tsurf` slider (`~230…760`, `.name('surface temp (T_surf K)')`, `.onChange(() => _onDriverDrag('tsurf'))`) + a shared A/B button. The EXISTING `volatiles` slider (:3814) already drives V; the EXISTING `thermal` slider (:3834) already sets `thermalState`. ⚠ **NO age slider** (age descoped Inc.2, :2684) → the age→tessera limb is HEADLESS-ONLY; live tessera variety rides on V (dryness, wetter direction only) + T_surf.

7. **`planet-lod-lab.html:6142-6151` (`stagnantLidProbe` main return)** — add `appliedTune: (riverOverlay.stagnantDiag && riverOverlay.stagnantDiag.appliedTune) ?? null` to the returned object (arm's-length, like `magmaProbe.appliedTune`). Non-null off VENUS_REF, null at Venus. **Also (byte-safety lens NIT, folded):** add `appliedTune: null` to the non-stagnant **early return** (:6114-6116) for shape symmetry — AC-LAB always selects Venus so the early branch never fires, but the field should exist on both returns.

**SLICE B discharges (integration): AC-ZERO-CLOBBER, AC-LAB.** AC-UAT is deferred-to-max. Golden MUST STAY 75/75 (Venus → null tune → byte-identical).

---

## Per-AC discharge map (concrete checks)

### Unit (SLICE A) — `tests/worldengine-base-stagnantlid-multiply.test.js`

- **AC-0 (spine conformance).** ⚠ **The grep must slice the `stagnantDriversToTune` function body, NOT scan the whole file** (byte-safety lens SHOULD-FIX, folded — verified: `stagnantLidRegimeOf(` appears at stagnantLid.js:78 as the function *definition*, so a whole-file `not.toMatch(/stagnantLidRegimeOf\(/)` would FAIL at build time). Extract the body first — `const BODY = STAGNANT_SRC.slice(STAGNANT_SRC.indexOf('export function stagnantDriversToTune'), …matching brace…)` (the same body-slice the magma sibling uses) — then assert against `BODY`: NO `stagnantLidRegimeOf(`, and the positive read-surface check that `BODY` reads only `volatileFraction`/`massGravity` (flat) + `condition?.T_eq`/`condition?.age` (nested) + `thermalState`. The `e1.label` / `PRESET_ARCHETYPE` denylist tokens may stay whole-file (`STAGNANT_SRC`) — neither appears anywhere in stagnantLid.js, so a whole-file grep is safe and stronger for those two. Named-consumer table: `TESSERA_FRAC→tesseraFrac`, `CORONA_ACTIVE_FRAC→activeFrac`, `CORONA_POOL→coronaCount`, `PLUME_MIN→plumeCount`, `appliedTune→stagnantLidProbe`. `npx vitest run tests/planet-archetypes.test.js` (drift guards green — driver overrides add no `*Enabled`; verified `tests/planet-archetypes.test.js:20-22` only scans `.add(state,'\w+Enabled')`, which `driverOv.tsurf` does not match). Declared debt: the *dispatch* still resolves the strong regime via `stagnantLidRegimeOf(archetype)` — retired at V2-3; the *builder* is archetype-free.
- **AC1 (determinism + zero RNG + 'lid:' reserved + bound).** `expect(String(stagnantDriversToTune)).not.toMatch(/Math\.random|Date\.now/)`; grep `STAGNANT_SRC` (whole file is correct here — `Math.random`/`Date.now`/`alea(` appear nowhere) for zero new `alea(` draws and **zero `'lid:'`** literals (namespace reserved — mirror worldengine-lid-router-audit.test.js:37); `stagnantDriversToTune(vec)` twice → `toEqual`; assert it never mutates its arg (JSON before/after). Build twice on fresh carriers for a non-Venus vector at all 5 seeds → `Float32Array` equality of `carrier.height` + `isTessera`/`coronaActive`/`resurfAge`/`foldAngle`; `|U| < STAGNANT_BOUND`; `carrier.regime ∈ {0,1,2}`.
- **AC-TUNE-NULL (byte anchor).** `(a0)` `stagnantDriversToTune(null) === null` AND `({}) === null`; `(a)` `stagnantDriversToTune(VENUS_REF) === null`; `(b)` build the LIVE bundle `{ ...buildNeutralBodyDrivers(deriveUniforms(fp_venus,1.0), fp_venus), condition: deriveConditionVector(fp_venus, u, fp_venus.radiusEarth) }` and assert `stagnantDriversToTune(liveVenus) === null` (the **non-circular** check that catches thermal/g drift); `(c)` `Object.isFrozen(VENUS_REF)` and each read slot === the live slot to full precision — `VENUS_REF.massGravity === deriveUniforms(fp_venus).surfaceGravity` (both `0.815/(0.95*0.95)`), `condition.T_eq === 737`, `condition.age === 4.5`, `volatileFraction === 0.02`; `(d)` a perturbed vector (`volatileFraction:0.10` or `condition.T_eq:500`) → non-null `{TESSERA_FRAC,…}` subset.
- **AC-BYTE-VENUS (null-tune === omitted-tune).** Two fresh carriers on `makeSphereField(buildIrregularSphere(1500,2))`, seeds {1,2,3,7,42}: baseline `writeStagnantLidReliefSphere(cBase, {}, { macroSeed, regime })` (the #4b call form) vs new path `writeStagnantLidReliefSphere(cRef, liveVenusBundle, { macroSeed, regime, tune: stagnantDriversToTune(VENUS_REF) /* null */ })`; assert typed-array equality of `carrier.height` + `isTessera`/`coronaActive`/`resurfAge`/`foldAngle` + equal `plumeCount`/`coronaCount`. (Mirrors magma-multiply test :42-62.)
- **AC-TUNE-RESPONSE (the MULTIPLY core).** Fixed `macroSeed`; monotone sweep ALONG THE HOT-DRY LIMB — synthetic vectors `{ volatileFraction, condition:{T_eq, age} }` stepping V drier↔wetter, age older↔younger (headless-only limb), and **T_surf stepped DOWNWARD from 737** (within the limb, never across the §2.3 turning point), plus explicit `thermalState` for the corona-activity axis. At each point read `tesseraFrac`, `activeFrac`, `coronaCount`, `plumeCount` from the diag; every predictor rebuilt arm's-length from `diag.plumeCenters`. Assert: `tesseraFrac` non-decreasing in dryness/age; `activeFrac` + `coronaCount` non-decreasing in `thermalState`/T_surf within the limb; `plumeCount` non-decreasing in vigor; NO sign inversion; at VENUS_REF collapses to Venus; each step exceeds a set noise-floor margin (measurable, not a rounding wobble). (Mirrors magma-multiply AC2 :81-107.)
- **AC2 (structure preserved under tune).** Across the sweep, `structureCorr(c, diag) = |corr(structureMask, plumePredictor)| >= 0.40` at every non-Venus point (placement still keys off `plumeProx`, stagnantLid.js:287) AND `>` the latitude signal; run the shipped structure suite unchanged.
- **AC3 (latitude falsifier — must FAIL to explain).** Across the sweep (incl. driver-varied extremes), `varExplained(latY(c), Array.from(diag.U)) < 0.15` AND `< structureCorr²` at every point + all 5 seeds — the tuned world stays plume-scattered, never sin²(lat)-banded. (Mirrors structure test AC3 :239-247 + magma-multiply AC3 :202-211.)
- **AC-ORDER-PRESERVED (anti-mush).** Across the sweep + 5 seeds, `meanTessera(diag) > meanPlains(diag) > meanOverMask(diag.U, riftTrenchMask(c,diag))` (the shipped scoped trench-annulus low mask); AND assert `Object.keys(stagnantDriversToTune(vec))` ⊆ `{TESSERA_FRAC,CORONA_ACTIVE_FRAC,CORONA_POOL,PLUME_MIN}` for every sweep vector — never a BASE_* / amplitude key (ordering structurally preserved by construction).
- **AC-VARIETY (within-world, Shannon entropy).** Reconstruct the **5 province classes** arm's-length per node: `tessera` = `diag.isTessera[i]`; `active-corona`/`inactive-corona` = rebuilt from `diag.coronaCenters` + `diag.coronaRadius` + `diag.coronaActive` using the writer's support cutoffs `DEFAULTS.CORONA_SUPPORT_ACTIVE (1.6)`/`_INACTIVE (1.3)` (`rho = geoDist/Rc <= support`; the same arm's-length rebuild the shipped `riftTrenchMask` uses, structure test :92-100) — a covered node is active-corona if any covering corona is active, else inactive-corona; `rift` = `diag.inRift[i]` (not tessera/corona); `plains` = the remainder. Precedence tessera > corona-classes > rift > plains. Area-fractions `p_k = count_k/N`; `H = −Σ p_k ln p_k`. Procedure: (1) measure the **noise floor** = spread of `H` across the 5 seeds at fixed VENUS_REF-neighborhood drivers → set `delta-H-min`; (2) at a fixed seed assert `abs(H(vec1) − H(vec2)) > delta-H-min` for two differently-driven vectors, while the seed-only void-drivers baseline (`tune` omitted) holds `H` within the noise floor; (3) `H` rises toward the high-heterogeneity corner; reproducible per seed. (One level up from structure-test AC5 :267-290 — distinct-per-DRIVER-VECTOR, not just per-seed.)

### Integration (SLICE B)

- **AC-ZERO-CLOBBER.** `npx vitest run tests/v2-0-byte-identity.test.js` → 75/75 (Venus routes stagnant + `stagnantDriversToTune(VENUS_REF)===null` → Venus byte-identical; no other preset routes stagnant, driver-presets.js:187). The shipped structure suite's AC6 references (`plateReference`/`shellReference`/`volcanicReference`/`despunReference`, :300-303) + AC7 (:340,:368, which now flow through `stagnantDriversToTune(null)` → null-guard → null tune) stay green WITHOUT editing that file. `git show --stat` touches ONLY: `src/worldengine/base/stagnantLid.js`, `planet-lod-rivers.js`, `planet-lod-lab.html`, the new stagnant test, workstream docs — NOT `plates.js`/`shellRelief.js`/`tectonic.js`/`sphereField.js`/`e1Regime.js`/`lidResponse.js`/`magmatism.js`/`verify.js`/`body-drivers.js`/`body-condition-vector.js`/`driver-presets.js` (the NESTED read means no data-surfacing edit; `deriveConditionVector` already emits both `T_eq` and `age`, so the builder reads already-materialized data). `magmatism.js` + `lidResponse.js` byte-identical; V2-2a's AC-BYTE-STRONG-REF green; `'lid:'` reserved; the 4 known failures (KnownObjects ×3, GalacticFeatures ×1) don't grow.
- **AC-LAB (agent-driven, live).** Fresh Chrome tab `localhost:5173/well-dipper/planet-lod-lab.html`; select Venus (routes stagnant), `setSeed(1234)`, `reliefBakeStrength(1)`, `rebuildTarget()`; drive the NEW `tsurf` control (overlays `condition.T_eq`) + the EXISTING `volatiles` (V, wetter) / `thermal` sliders off VENUS_REF (or A/B), forcing a route each time; `stagnantLidProbe()` → `heightSource=='carrier'`, `regime=='venus-stagnant-lid'`, `appliedTune` non-null off VENUS_REF, moving `tesseraFrac`/`coronaCount`/`activeFrac`; screenshot both sweep ends (visibly different within-world province mix); check liveness via `list_pages`; close pages when done. **Also confirms the V-alone/T_surf tessera response is visibly strong enough without an age slider** (see Risk 2).
- **AC-UAT (Max-only, deferred-to-max).** Terminal gate: integration green → `VERIFIED_PENDING_MAX <sha>` → Max UAT → Shipped. The workflow marks it `deferred-to-max`, never PASS.

---

## Byte-identity notes (the reference path is provably untouched)

1. **`null` tune === omitted tune.** At Venus (and every existing caller passing `bodyDrivers=null`), `stagnantDriversToTune` returns `null` → the writer's `tune ? {...DEFAULTS,...tune} : DEFAULTS` ternary (stagnantLid.js:175) takes the untouched `DEFAULTS` branch → byte-identical Venus. The writer body (:176-412) and its `'stagnant:'` alea draw order are unchanged → `carrier.height` + all diag arrays are bit-identical to the shipped #4b call. (AC-BYTE-VENUS proves this over seeds {1,2,3,7,42}.)
2. **The identity guard is exact by deviation-form.** Because every signal is `X − X_REF`, at the reference every override is `D + K·0 = D` in exact IEEE754 (same as magma's `Hd = 0`). No epsilon, no rounding — `===` DEFAULT holds bit-for-bit → `null`.
3. **The thermalState fix is the load-bearing byte-safety edit.** `stagnantThermal` reads ONLY explicit `thermalState` (undefined at both `VENUS_REF` and the live Venus bundle → `THERMAL_REF`), so `thermDev = 0` at both. Verified: the naive `magmaThermal`-mirror would inject Venus's live raw tidal `0.001179` → `thermDev = +0.00059` → non-null tune at Venus → golden moves. This fix is why AC-TUNE-NULL(b) (live-bundle → null) holds.
4. **Dispatch confinement.** The edit is inside the `if (slRegime)` stagnant branch only; `bodyDrivers` stays `null` off that branch (default, rivers:452), so plate/shell/volcanic/despun are untouched and `stagnantDiag` is `null` off the stagnant path. `grainDrivers` dropped as the stagnant drivers arg is byte-safe (`void drivers`, :174).
5. **No new RNG / reserved namespace.** The builder computes DEFAULTS overrides only — zero `alea`, zero `'lid:'` draws, `carrier.regime` untouched (`sub.regime ∈ {0,1,2}`, verify.js:39 — no 4th regime constant).
6. **`VENUS_REF.massGravity` exactness** is `0.815/(0.95*0.95)` = the live `deriveUniforms` surfaceGravity to full precision (verified `=== 0.9030470914127423`). Inert while `K_G=0`, but asserted by AC-TUNE-NULL(c) and load-bearing the instant the K_G opt-in fires.

---

## Adversary findings folded / rebutted

**Buildability / byte-safety lens — verdict BUILD-READY (0 BLOCKER, 0 MUST-FIX). It executed the plan's builder against the real golden-harness Venus bundle and confirmed `stagnantDriversToTune(liveVenusBundle) === null` (golden stays 75/75), the exact-g equality, and that RISK 1 (the thermalState break) is genuine and correctly fixed.** Non-blocking items:

1. **[SHOULD-FIX → FOLDED]** *AC-0's `stagnantLidRegimeOf(` denylist must be scoped to the builder body, not the whole file* — a whole-file grep self-defeats because the token appears at the function definition (stagnantLid.js:78). **Verified true** (`grep -n stagnantLidRegimeOf src/worldengine/base/stagnantLid.js` → single hit at :78, the `export function` line). AC-0 above now extracts the `stagnantDriversToTune` body via `STAGNANT_SRC.slice(indexOf('export function stagnantDriversToTune'), …)` before the `stagnantLidRegimeOf(` denylist + the positive read-surface check; `e1.label`/`PRESET_ARCHETYPE` stay whole-file (they appear nowhere).
2. **[NIT → FOLDED]** *The illustrative `age` read was a no-op ternary (two identical branches)* — replaced in the code block with the plain shipped form `const age = drivers.condition?.age ?? VENUS_REF.condition.age`, with a one-line note on why age is nested (moves tessera only, never re-drives `stagnantThermal`).
3. **[NIT → FOLDED]** *`stagnantLidProbe`'s non-stagnant early-return (:6114-6116) won't carry `appliedTune`* — SLICE-B edit 7 now adds `appliedTune: null` to the early return for shape symmetry (AC-LAB always selects Venus, so it never bites, but both returns now carry the field).
4. **[OBSERVATION → FOLDED]** *`stagnantThermal` deliberately deviates from a verbatim `magmaThermal` mirror (explicit `thermalState` only, no raw-tidal derivation)* — the Calibration section now states explicitly that this is a contract-aligned override (byte-safety lens finding 1 / R1), not a deviation, so a reviewer holding the plan to a literal "mirror magmaThermal" reading does not flag it; it also spells out the consequence (corona-activity lever is reachable only via explicit `thermalState`, which Venus's lab thermal slider supplies).

**Fidelity-to-contract lens — returned NO actionable findings** (its emitted output was auto-generated/truncated and contained no findings section — it began reading the source-of-truth docs but never produced a verdict). I ran an independent fidelity pass against the contract's 4 gotchas + 12 ACs and confirmed the plan matches: (1) T_surf+age NESTED, V+g FLAT — mixed read by design; (2) `VENUS_REF` nested-shaped with EXACT g `0.815/0.95²`; (3) dispatch passes `stagnantDriversToTune(bodyDrivers)` DIRECTLY, no `stagnantDriversRefOf` helper; (4) null-guard FIRST then exact-only identity guard. All 12 ACs are mapped to a concrete check in the discharge map; population-knobs-only (returned object ⊆ the 4 keys); anti-mush structural (BASE_*/amplitudes untouched); AC-TUNE-RESPONSE sweep stays on the hot-dry limb (never across the §2.3 turning point); AC-VARIETY reconstructs the 5 province classes arm's-length; K_G-deferred gravity behind the exact-g assertion. No fidelity BLOCKER/MUST-FIX found.

---

## Open calibration risks (flagged with first-cut resolutions)

- **RISK 1 — thermalState byte-identity (VERIFIED by BOTH the plan author and the byte-safety lens, RESOLVED in this plan; HIGH if missed).** Mirroring `magmaThermal`'s raw-tidal auto-derivation breaks the 75-golden at live Venus (`thermDev = +0.00059`). **Resolution:** `stagnantThermal` consumes explicit `thermalState` only, constant `THERMAL_REF` fallback (§Calibration). The corona-activity lever's response rides on explicit `thermalState` (lab thermal slider / headless vectors) + `T_surf` (byte-exact 737 at Venus). This is baked into the code block, not left open — but it is the single finding the byte-safety lens hunted for and confirmed, so it is called out here explicitly.
- **RISK 2 — AC-LAB reachability without an age slider (MEDIUM, calibration-tunable).** Venus sits at the dry extreme (V=0.02, near the 0.02 clamp floor), and there is NO age slider (planet-lod-lab.html:2684). So the ONLY live tessera lever is the `volatiles` slider in the **wetter** direction (V↑ → tessera↓ toward the floor) plus T_surf-down thinning active coronae; the "drier/older → MORE tessera" limb is headless-only (AC-TUNE-RESPONSE synthetic vectors). **First-cut resolution:** set `K_TESS ≈ 0.12` so a full `volatiles` sweep (0.02→0.6) visibly drains `tesseraFrac` from ~0.075 toward the 0.02 floor, and a T_surf down-sweep visibly thins the active-corona population — then VERIFY visibility in AC-LAB. If V-alone + T_surf don't read as "a genuinely different world" at UAT, add a stagnant `age` slider (a small, still-allowlisted planet-lod-lab.html edit) as a UAT follow-up — NOT first-cut, since the headless age limb is already proven and the golden is unaffected. AC-LAB's stated job includes confirming this response is strong enough without age.
- **RISK 3 — first-cut gains are directional, not tuned (LOW, expected).** `K_TESS/K_AGE/K_ACT/K_ACT_T/K_POOL/K_PLUME` + `TSURF_SPAN` are first-cut (mirror magma's `K_*`, UAT-tunable). The ACs assert correct SIGN + measurable magnitude, not a fixed gain; the exact magnitudes are calibrated in SLICE A against the AC-TUNE-RESPONSE noise floor and re-tunable at UAT before the province mix reads over-busy (Max's taste call). The clamp ranges (`TESSERA_FRAC∈[0.02,0.20]`, `CORONA_ACTIVE_FRAC∈[0.30,0.95]`, `CORONA_POOL∈[20,400]`, `PLUME_MIN∈[3,12]`) bound the population without touching floors/amplitudes, so anti-mush stays structural regardless of gain.
