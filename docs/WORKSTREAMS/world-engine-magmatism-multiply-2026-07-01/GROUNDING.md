# #4-MULTIPLY grounding brief (volcanic driver-response + grain-aligned edifices)

**Written 2026-07-01** by working-Claude, grounded by direct code reads (the parallel-reader
workflow hit the session limit, so this was done in-thread). Increment #4-MULTIPLY is the
volcanic analog of the shipped #2 (plate driver-response). Goal: make plume **count/strength**
derive from thermal history + break the isotropic circular edifice — **byte-identical at the
neutral-driver reference point** (the #2 discipline).

## 1. The seam (`src/worldengine/base/magmatism.js`)

- **`writeMagmatismSphere(carrier, drivers = {}, { macroSeed=0, locked=false, T_ss=0, tune=null })`**
  — line 121. `void drivers;` at **line 122** is the driver-response seam.
- **The tune-merge is already present** — line 124: `const T = tune ? { ...MAGMA_DEFAULTS, ...tune } : MAGMA_DEFAULTS;`
  Identical to `plates.js:197`. So threading a `tune` needs **no new mechanism** in the writer body,
  only new knob reads (count/strength already read from `T.*`).
- **Plume COUNT** — line 148: `plumeCount = T.PLUME_COUNT_MIN(5) + floor(rngCount()*T.PLUME_COUNT_SPAN(6))` → [5,11).
- **Plume STRENGTH** (the ROADMAP's "[0.4,1.0] uniform seed draw") — line 162:
  `A_e[p] = T.EDIFICE_HEIGHT(1.0) * (T.STRENGTH_LO(0.4) + (1-T.STRENGTH_LO)*s_p)` where `s_p=strengthRng()∈[0,1]`.
- **Isotropic edifice profile** (what grain-alignment must break) — lines 259-268:
  `shield(r)=(1-r)^p`, `r = psi/radius`, `psi = hotspotDist[i]*meanEdgeAngle` (a **scalar** geodesic distance to
  the nearest plume top; **no direction component**). `radius = Psi_e[pStar]`. To elongate/orient we need the
  **displacement direction** from plume-top→node (a tangent-space bearing), not just `psi`.
- Determinism locked: alea **`'magma:'`** namespace only, no `Math.random`/`Date.now`, one bounded BFS
  (line 215, O(N) — not a convergence loop), RELAX_PASSES=4 Jacobi. `MAGMA_BOUND=4`.
- Grain today: line 329 **writes** `carrier.faultDensity` (parity bookkeeping); it does **not read**
  `carrier.grainAngle`.

## 2. The #2 template to mirror (`plates.js` + `planet-lod-rivers.js`)

- **`driversToTune(drivers)`** lives in `plates.js` (lines 128-160). Pattern:
  1. read each driver with a `D_EARTH.*` fallback;
  2. compute each override **anchored so `f(D_EARTH)==DEFAULT`** (multiplicative factors → 1 at ref, additive → 0 at ref);
  3. **identity guard**: `if (every override === DEFAULTS.*) return null;` → the writer's ternary takes the
     untouched `DEFAULTS` branch → **byte-identical** at the reference;
  4. return only the changed fields; the writer spreads them over DEFAULTS.
- **`D_EARTH`** (`plates.js:105`) is a named `Object.freeze` reference constant (Rocky's derived drivers —
  `massGravity`, `volatileFraction`, `tidalHeating`; **not** a 0-vector).
- **Threading** — `planet-lod-rivers.js:447` (plate branch):
  `writePlateUpliftSphere(carrier, bodyDrivers, { macroSeed, tune: driversToTune(bodyDrivers) })`.
  `bodyDrivers` is a **SEPARATE channel** from `grainDrivers`, defaults `null` (byte-identical off the driver path).
- **The volcanic branch is line 458-466**; today it calls
  `writeMagmatismSphere(carrier, grainDrivers, { macroSeed, locked, T_ss })` — **no `bodyDrivers`, no `tune`**.
  #4-MULTIPLY changes this ONE call to mirror line 447:
  `writeMagmatismSphere(carrier, bodyDrivers, { macroSeed, locked, T_ss, tune: magmaDriversToTune(bodyDrivers) })`.
- `route()` already destructures + carries `bodyDrivers` (line 1154) into `writeBodyRelief` (line 1175) and
  exposes `get magmaDiag()` (line 1239). So the plumbing to the volcanic branch is a **one-line** change +
  the new `magmaDriversToTune` in `magmatism.js`.

## 3. The D-vector (`baseStep.js` `drivers` bundle = what `writeMagmatismSphere` receives)

`makeBaseStep` returns `drivers = { tidalHeat, surfaceGravity, rockyCrust, surfaceHistory, age,
radialStrainSign, radialStrainMag, despinAmp, ... }` and `crust = { ..., thermalState }`:
- **`tidalHeat`** (D12) — `calibrateTidal(raw)= tanh(log10(1+h)/1.6)`, bounded **[0,1)**; Io-grade ≈ **0.19**, Earth ≈ 0.
- **`age`** = `ageNorm = clamp01(age/10)` (D16), **[0,1]**.
- **`rockyCrust`** = `smoothstep(2.5,3.9,density)` — composition proxy, [0,1].
- **`thermalState`** = `clamp01(0.5*tidalHeat + 0.5*(1-age))` (in `crust`) — a ready-made "young+heated" thermal
  index; the natural single driver for plume count/strength.
- ⚠ **Reference calibration (the #2 must-fix analog):** lab volcanic presets may not carry real
  `tidalHeating`/`eccentricity`/`age` → `tidalHeat≈0`, `age→0.5 default`. So the **neutral reference**
  (`MAGMA_REF`, analog of `D_EARTH`) must be a **named constant** the transfer fns are calibrated to, so
  `magmaDriversToTune(MAGMA_REF) == null` → **#4a byte-identical**. Pin `MAGMA_REF` to the values that
  reproduce the shipped Lava/Magma output.

## 4. ⚠⚠ GRAIN VERDICT — the ROADMAP/handoff assumption is WRONG

The ROADMAP #4-MULTIPLY note + handoff both say "read the carrier `grainAngle`/fault field (already an
available input)". **It is NOT available on the volcanic path:**
- `writeGrainSphere` is called **only in the despun branch** (`planet-lod-rivers.js:468`); the volcanic
  branch (458-466) returns **before** it. `sphereField.js:14` zero-inits `grainAngle`. → **`carrier.grainAngle`
  is all zeros for a volcanic body.**
- Even where grain IS written (`tectonic.js:31`), it's a **binary latitude-derived value** (`0` or `π/2` from
  `stressAtLat`). Aligning edifices to that would re-introduce the **latitude** structure **AC3 explicitly
  forbids** (plume must beat latitude).

**Correction:** grain-alignment must **derive** its anisotropy internally — a **seeded volcanic fissure/rift
fabric** in the `'magma:'` namespace (three-free, deterministic, **non-latitude** → AC3-safe). Recommended
approach **G1**: give each plume a seeded **major-axis direction** + an **elongation factor scaled by the
thermal driver** (more tidal-heat → more rifting → more elongation), and make the edifice `r` anisotropic
(decompose the plume-top→node displacement into along-axis/cross-axis components, stretch cross-axis). This
unifies both goals (driver-response + grain) and directly breaks `(1-r)^p`. Alternatives: G2 a low-freq
seeded stress-direction field; G3 align to plume-province geometry (rifts between plumes). **This is the
decision to put to Max in scope.**

## 5. Invariants that must NOT regress (bake into ACs)

- **Byte-identical at `MAGMA_REF`** (`magmaDriversToTune(MAGMA_REF)===null` → the `tune?…:DEFAULTS` untouched branch).
- **AC3** plume beats latitude (`varByLatitudeY < 0.15` AND `< varByPlume`) — grain-alignment must not add latitude signal.
- **Elevation ordering** `mean(edifice) > mean(plain) > mean(basin)` (magmatism.js §6 proof) holds under elongation + driver sweeps.
- Determinism: alea `'magma:'` only, no `Math.random`/`Date.now`, no new `while`, no 4th `carrier.regime`,
  `MAGMA_BOUND` clamp holds. Dispatch predicate stays in `planet-lod-rivers.js`.
- NO edits to `plates.js` / `shellRelief.js` / `tectonic.js` / `sphereField.js`. #4a seed-only output = the reference baseline.
- Monotone correct-sign: ↑tidal-heat / ↓age → ↑plume count/strength (+ ↑elongation).

## 6. Open scoping questions for Max
1. **Grain-alignment anisotropy source** — confirm derived seeded volcanic fabric (G1 recommended) since
   `carrier.grainAngle` is unavailable/latitude on the volcanic path. (The ROADMAP's "read E6 grain" can't work as written.)
2. **Driver → knob mapping** — thermal history (tidalHeat + radiogenic 1−age, i.e. `thermalState`) → PLUME_COUNT
   and STRENGTH (both? count-only?); composition (`rockyCrust`) → ? Elongation scaled by the same thermal driver.
3. **Reference point** — anchor `MAGMA_REF` to reproduce the shipped Lava/Magma exactly (byte-identical), vs a named neutral.
