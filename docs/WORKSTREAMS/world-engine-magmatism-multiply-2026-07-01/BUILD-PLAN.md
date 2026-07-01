# #4-MULTIPLY — build plan (adversarially verified, BUILD-READY)

**Written 2026-07-01** from the plan workflow `wf_e23fd8b0-19e` (planner → adversary). Verdict:
**BUILD-READY**. This captures the resolved calibration + the concrete SLICE-A/B edits + the 3
adversary fixes folded in.

## Calibration RESOLVED (mustFix #1 — the load-bearing risk is dead)

- The lab **already builds + passes `bodyDrivers`** to `route()` for every preset incl. Lava/Magma
  (`buildBodyDrivers` → `state._lastBodyDrivers` → `route({bodyDrivers})`); the **volcanic branch just
  drops it** (`planet-lod-rivers.js:465` passes `grainDrivers`, no `tune`). Threading the branch makes
  the shipped worlds respond immediately.
- ⚠ **Correction to GROUNDING §3:** the LAB passes **raw** Io-normalized `tidalHeat` (from
  `deriveUniforms`, `planet-lod-lab-core.js:527`), NOT the calibrated `[0,1)` value. So `magmaThermal`
  must normalize internally.
- Actual preset drivers (node-computed): Lava (ecc0.15/orbit938/R0.9) → `tidalHeating=7.82e5`; Magma
  (ecc0.01/orbit212/R1.5) → `7.58e7`; Rocky → `1.74e-3`. Neither volcanic preset carries `age:` → age→4.5.
- **`MAGMA_REF = Object.freeze({ tidalHeating: 0, age: 4.5, massGravity: 0.9 })` → `H_REF = 0.275`.**
- `magmaThermal(bd) = bd.thermalState != null ? clamp01(bd.thermalState)
   : clamp01(0.5*clamp01(bd.tidalHeating ?? 0) + 0.5*(1 - clamp01((bd.age ?? 4.5)/10)))`.
  Raw tidal >>1 → `clamp01` saturates → **H_Lava = H_Magma = 0.775, Hd = 0.5** for both.

## `magmaDriversToTune` (mirror `plates.js:128-163`) — gravity secondary ENABLED

```
K_COUNT=6, K_HEIGHT=0.6, K_LO=0.4, K_ELONG=1.2   // first-cut, tunable at UAT
export function magmaDriversToTune(drivers){
  if (drivers == null) return null;
  const D = MAGMA_DEFAULTS;
  const H  = magmaThermal(drivers);
  const Hd = H - H_REF;                                          // 0 at MAGMA_REF
  const g  = drivers.massGravity ?? MAGMA_REF.massGravity;
  const gFactor = clamp(0.4, 2.5, Math.pow(g / MAGMA_REF.massGravity, -0.5)); // 1 at g0 → byte-safe
  const PLUME_COUNT_MIN = clamp(3, 12, Math.round(D.PLUME_COUNT_MIN + K_COUNT*Hd));
  const EDIFICE_HEIGHT  = D.EDIFICE_HEIGHT * (1 + K_HEIGHT*Hd) * gFactor;      // heat↑ taller; low-g taller
  const STRENGTH_LO     = clamp(0.2, 0.8, D.STRENGTH_LO + K_LO*Hd);
  const ELONGATION_GAIN = clamp(0, 2, D.ELONGATION_GAIN + K_ELONG*Hd);
  if (PLUME_COUNT_MIN===D.PLUME_COUNT_MIN && EDIFICE_HEIGHT===D.EDIFICE_HEIGHT
      && STRENGTH_LO===D.STRENGTH_LO && ELONGATION_GAIN===D.ELONGATION_GAIN) return null; // AC1 guard
  return { PLUME_COUNT_MIN, EDIFICE_HEIGHT, STRENGTH_LO, ELONGATION_GAIN };
}
```
- At `MAGMA_REF`: Hd=0, gFactor=1 → all === defaults → **null → #4a byte-identical**.
- Lava (g0.80) → gFactor 1.06 → EDIFICE_HEIGHT 1.38 (taller); Magma (g2.22) → gFactor 0.64 → 0.83 (flatter).
  So the two shipped worlds now differentiate on the endogenic axis, not just the basin.
- `PLUME_COUNT_SPAN` unchanged (keeps AC6 variety; mirrors plates leaving SPAN alone).

## SLICE A — plumbing + byte-identity (math-light)

1. `magmatism.js` MAGMA_DEFAULTS: add `ELONGATION_GAIN: 0,` (default = isotropic = #4a; unused in SLICE A).
2. `magmatism.js` after MAGMA_DEFAULTS: add `MAGMA_REF`, the `magmaThermal` helper, `const H_REF = magmaThermal(MAGMA_REF);`,
   and `magmaDriversToTune` as a **stub `return null`** (filled SLICE B). Pure — no RNG/clock.
3. `planet-lod-rivers.js:32`: import `{ writeMagmatismSphere, magmaDriversToTune }`.
4. `planet-lod-rivers.js:465`: mirror the plate branch —
   `const magmaTune = magmaDriversToTune(bodyDrivers); const magmaDiag = writeMagmatismSphere(carrier, bodyDrivers, { macroSeed, locked, T_ss, tune: magmaTune }); magmaDiag.appliedTune = magmaTune;`
5. `planet-lod-lab.html` magmaProbe: add `appliedTune: state._lastBodyDrivers ? magmaDriversToTune(state._lastBodyDrivers) : null` (arm's-length, like plateProbe). Null in SLICE A.
6. **Byte-identity test** (new block in the magma structure suite): `magmaDriversToTune(MAGMA_REF)===null`;
   for s∈{1,2,3,7,42}×L∈{false,true} (T_ss threaded on locked), the reference call byte-equals the #4a
   baseline for U/plumeId/hotspotProximity/edificeMask/lavaPlainMask/magmaOceanMask/A_e/Psi_e; static-grep
   0 Math.random/Date.now, while-count still 1, alea keys = old ∪ {'magma:grain:'} (grain added SLICE B); |U|<MAGMA_BOUND.

**Covers AC1 (byte-identity + determinism) + AC5 (no-clobber).**

## SLICE B — mechanism + calibration

1. Fill `magmaDriversToTune` (above).
2. **Anisotropic edifice** (`magmatism.js` STEP 6): after STEP 3, `const rngGrain = alea('magma:grain:'+seed)`
   (FRESH instance — never a pull on an existing stream); per-plume seeded unit-tangent `grainAxis[p]` +
   `grainPerp[p]` at the plume top. Replace the scalar `r = psi/radius` with a **guarded** anisotropic radius:
   `if (T.ELONGATION_GAIN>0 && pStar>=0 && psi>1e-9 && radius>0){` decompose the unit tangent bearing top→node
   into `along = b·grainAxis`, `crossComp = b·grainPerp`; `E = 1 + T.ELONGATION_GAIN`;
   `r = hypot(psi*along/(radius*E), psi*crossComp/radius);` `} else { r = radius>0 ? psi/radius : Infinity; }`
   Orthonormal ⇒ `along²+crossComp²=1` ⇒ at E=1 reduces EXACTLY to `psi/radius` (and the guard means
   the reference never enters the formula). Semi-major = radius·E, semi-minor = radius ⇒ aspect = E. All
   STEP-6 consumers (shield, caldera, edificeMask, Walcott moat) elongate coherently; swell stays isotropic.
   Publish `grainAxis` + `appliedElongation E` in the diag.
3. **Lab slider** (mirror #2's Drivers folder): `driverOv.thermal` [0,1] + a `Body drivers → volcanic relief (Inc.4)`
   folder + A/B; `presetDriverDefaults` seeds it from `magmaThermal({tidalHeating:u.tidalHeat, age:fp.age??4.5})`;
   `buildBodyDrivers` injects `thermalState: useOv('thermal') ? driverOv.thermal : undefined` (undefined ⇒ raw
   tidal path for the real preset render). New field ⇒ inert on the plate path + off the volcanic path.
4. **magmaProbe**: add `appliedTune` (non-null off-reference), `meanAspect` (PCA of edifice tangent positions
   in the grainAxis frame → sqrt(λmax/λmin)), `meanAxisAlignment`. Feeds AC3 + AC6.

**Covers AC2, AC3, AC4, live AC6.**

## Adversary fixes folded in
1. **[MED → FOLD IN]** Multi-seed the AC3 latitude falsifier across SEEDS=[1,2,3,7,42], require
   `varByLatitudeY<0.15 AND <varByPlume` for **every** seed (5–11 random axes can incidentally cluster near N-S).
2. **[LOW/UAT → DECIDED: ENABLE]** The gravity→EDIFICE_HEIGHT secondary is enabled (above) so Lava(taller)/
   Magma(flatter) differentiate on the endogenic axis, not just the basin. Byte-safe. Removable at UAT.
3. **[LOW → KEEP]** `age` is inert for shipped presets (never surfaced) → thermal driver is tidal-dominated.
   Correct for these tidally-heated worlds; the age term stays as a hook (harmless, constant 0.275).

## Byte-identity notes (adversary-verified, none break AC1)
- Fresh `alea('magma:grain:'+seed)` does not perturb existing streams (node-verified).
- Grain-axis loop runs unconditionally, but read only inside the `ELONGATION_GAIN>0` guard ⇒ reference
  takes the exact old `r`. No strict diag-shape asserts exist, so additive diag fields are safe.
- AC5 asserts **`magmaDiag===null` off the volcanic path** (bodyDrivers is non-null in the lab; only the
  branch returns null), NOT `tune===null`.
