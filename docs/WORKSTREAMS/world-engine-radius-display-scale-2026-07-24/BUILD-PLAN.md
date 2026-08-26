# BUILD-PLAN — Radius display-scale (`sVis`) for the lab planet

**Workstream:** `world-engine-radius-display-scale-2026-07-24`
**Author:** build-planner subagent · **Date:** 2026-07-24
**Grounded in:** `world-engine-lab.html` @ HEAD (`feature/world-engine-production-L1`),
`planet-lod-lab-core.js`, the pin/golden test suite. All line numbers below were
read from the working tree, not the contract's KNOWN SOURCE FACTS block (those were
verified — see notes where a stated line differed).

> **Verified vs. contract's KNOWN SOURCE FACTS:** all confirmed as stated —
> `:196 const R=1.0` ✓; `:5643 const dist = state.distance * R` ✓;
> `:5652 lodRampOf` / `:5653 autoOctaves` / `:5655 lodHysteresis` ✓;
> `:3902 radius slider (applyDrivers)` ✓; `:2987 drawPresetRadius labUnlock` ✓;
> `:1507 provinceOverlayMesh.scale.setScalar(1.0015)` ✓;
> `:1549-1550 river/tributary ribbon scale` ✓; `:5636 frame loop` ✓.
> **New facts the plan turns on** (not in the brief): the wheel clamp lives at
> `:5588` (`Math.max(1.1, Math.min(30, …))`); `uLodRamp` (the `lodRampOf` output)
> feeds **relief amplitude** at shader `:538` and cloud-speck LOD at `:1280`;
> `SWEEP_DISTANCE=2.6` (`:5210`, pinned `:5216`) assumes radius 1; the haze shell
> (`:1615/1617`) and rings (`:1856/1858`, cloud `:1876`) are **scene** children (not
> `planet` children) so they do NOT inherit `planet.scale`; **there is no Raycaster
> and no in-file disc-crop/screenshot helper** in the lab.

---

## 1. Where the pure `visScaleOf` export lives

**Home: `planet-lod-lab-core.js`** — the existing pure CPU module (no three.js/DOM),
imported by the lab HTML at `world-engine-lab.html:151` and by ~40 tests / calibration
scripts (e.g. `tests/planet-scale.test.js:6-12` imports `featureFrequencyFromKm`,
`animationRateFactor`, etc. from `../planet-lod-lab-core.js`). This is the DRY pattern
the feature must follow: the lab consumes the same export the unit tests pin.

`lodRampOf` / `autoOctaves` / `lodHysteresis` already live there (`:19-35`), so the
display-scale math sits beside its own LOD consumers. **Add four exports** near them
(after `lodHysteresis`, `:35`):

```js
// Radius → visual display scale (DISPLAY-ONLY — never a procgen/height/schedule input).
// sqrt keeps the 0.3–16 RE span (53×) inside the fixed camera: 1 RE → 1 exactly,
// 0.3 → 0.5477, 16 → 4.0. Reference is 1 RE, so normalization is the identity.
export const VIS_SCALE_EXP = 0.5;
export function visScaleOf(radiusEarth) {
  return Math.pow(radiusEarth, VIS_SCALE_EXP);   // pow(1,·)===1 exactly
}
// Camera min-distance guard: the camera must never enter the scaled sphere.
// At sVis=1 this is 1.1 — bit-identical to today's wheel floor (lab :5588).
export const CAMERA_CLEARANCE = 1.1;
export function minCameraDistance(sVis) {
  return sVis * CAMERA_CLEARANCE;
}
```

**Why `Math.pow`, not `Math.sqrt`:** keeps the impl bound to `VIS_SCALE_EXP` (one
UAT-tunable knob per the intent) instead of hard-coding 0.5. `Math.pow(16,0.5)`
lands within 1e-9 of 4.0 (AC-VIS-MONO's tolerance for that point); `Math.pow(1,0.5)`
is exactly 1 (AC-VIS-MONO's exact requirement).

**Why `CAMERA_CLEARANCE=1.1` (not 1.05):** at sVis=1 it reproduces today's constant
`1.1` wheel floor exactly (zero-change property), and `1.1 > 1.05` satisfies
AC-CLAMP's observable `minDistance > sVis*1.05` for every radius.

The lab imports these by appending to the `:151` import list:
`visScaleOf, VIS_SCALE_EXP, minCameraDistance`.

---

## 2. Every consumer of `planet.scale` / implicit scale-1 assumption

Exhaustive enumeration from a full read of `world-engine-lab.html`. Grouped by whether
they need a code change. **The big structural finding:** the three overlay meshes are
**children of `planet`** (parented at `:1475`, `:1509`, `:1524`), so `planet.scale`
propagates to them for free — **AC-OVERLAY is satisfied by the existing scene graph,
no overlay code changes.** Only the two **scene-space** shells (haze, rings) and the
sweep diagnostic carry a scale-1 assumption that must be fixed.

> **Correction (lens-01, 2026-07-24): a `setScalar` alone is NOT sufficient for the ring
> particle cloud.** Item #14 below (`ringCloud.scale.setScalar(sVis)`) moves the cloud
> geometry, but the cloud carries its **own internal distance-LOD** in
> `ring-particle-cloud.js:164-165` — `camDist = length(mvPos.xyz)` (scaled camera-space
> distance) ramped against **absolute** thresholds `uDResolve`/`uDCull`
> (defaults `4.0`/`14.0`, lab `:2448-2449`, live-tunable `:5521-5524`). Scaling the
> geometry by `sVis` scales `camDist`, so on any non-1 `sVis` the cloud resolves/culls at
> the **wrong apparent size** — the exact "detail must track apparent size" problem the
> plan solves for the planet via `logicalDist = state.distance / sVis`. So the "exhaustive
> enumeration" claim is only true once item #14's fix includes the LOD-threshold scaling;
> see the expanded item #14 + its note below and the frame-loop sketch in §4.

### A. The primary write

| # | Site | What | Fix |
|---|------|------|-----|
| 1 | `:1451` `SphereGeometry(R,256,256)` → `:1462-1463` `planet` mesh | The body we scale | `planet.scale.setScalar(sVis)` each frame (see §4) |

### B. Camera + LOD (frame loop `:5636-5662`)

| # | Site | What | Fix |
|---|------|------|-----|
| 2 | `:5643` `const dist = state.distance * R` | Camera distance — **ABSOLUTE** | **NO CHANGE (deliberate).** Scaling distance in planet-radii would exactly cancel the disc growth; this is the design linchpin (contract designDecision #2). |
| 3 | `:5588` wheel clamp `Math.max(1.1, Math.min(30, …))` | Zoom floor assumes radius 1 | `Math.max(minCameraDistance(sVis), Math.min(30, …))` (§3) |
| 4 | `:5652` `lodRampOf(state.distance)` | LOD detail ramp | key on `logicalDist = state.distance / sVis` |
| 5 | `:5655` `lodHysteresis(state.distance, …)` | LOD2 active flag | key on `logicalDist` |
| 6 | `:5653` `autoOctaves(lod)` | Octave budget | **NO direct change** — `lod` is `lodRampOf(logicalDist)`, so octaves re-key transitively (AC-LOD-KEY: "autoOctaves via lodRamp") |

### C. Downstream of `uLodRamp` (the `lod` value pushed at `:5662`)

Keying `lodRampOf` on logical distance changes `uLodRamp` at non-1 sVis, which reaches
two **live-shader** sites. Both are display-only (the shipped carrier / goldens /
headless never run the frame loop) and both are the intended "detail tracks apparent
size" behavior (intent §3):

| # | Site | What | Disposition |
|---|------|------|-------------|
| 7 | shader `:538` `float reliefAmp = uPerturb * mix(0.7, 1.0, uLodRamp)` | Live relief-amplitude modulation | **Consequence, not a fence breach** — see Risk R1. `sVis` never appears in the GLSL; only `uLodRamp` (a float) does. |
| 8 | shader `:1280` `spec *= mix(1.0, specks, smoothstep(0.5,1.0,uLodRamp))` | Cloud-speck LOD gate | Same — apparent-size-tracking, display-only |

### D. Attached display geometry — children of `planet` (inherit `sVis` for free)

| # | Site | What | Fix |
|---|------|------|-----|
| 9 | `:1507` `provinceOverlayMesh.scale.setScalar(1.0015)`, parented `:1509` | Province false-colour shell | **NO CHANGE.** Child of `planet`; world scale becomes `sVis × 1.0015`, still hugs the surface. AC-OVERLAY passes free. |
| 10 | `:1549` `riverOverlay.ribbon.scale.setScalar(s)`, parented `:1475` | River trunk ribbon | **NO CHANGE.** Child; lift `1.0014` composes with `sVis`. |
| 11 | `:1550` `tributaryPatch.fineRibbon.scale.setScalar(s)`, parented `:1524` | Fine tributary ribbon | **NO CHANGE.** Child; composes. |

### E. Detached shells — children of `scene` (do NOT inherit `sVis`)

| # | Site | What | Fix |
|---|------|------|-----|
| 12 | `:1615` `SphereGeometry(R*1.15)` haze shell, added to **scene** `:1617` | World-space halo (rotation-independent by design, `:1564-1566`) | `hazeShell.scale.setScalar(sVis)` in the frame loop. Cannot parent to `planet` (would co-rotate + break world-space sun weighting). Only visible on Titan/Venus/Sub-Neptune. |
| 13 | `:1856` ring impostor, added to **scene** `:1858` | Ring plane sized to `R` | `ring.scale.setScalar(sVis)` (per frame, beside the existing per-frame tilt write) |
| 14 | `:1876` `bakeRingCloud(…, {R: R, …})` cloud, **scene** child | Particle ring cloud + its **internal** camera-space distance-LOD (`ring-particle-cloud.js:164-165`) | `ringCloud.scale.setScalar(sVis)` per frame **AND** scale the two LOD thresholds `uDResolve`/`uDCull` by `sVis` (see the LOD note below). The `setScalar` alone would cull the cloud at the wrong apparent size — the same principle as `logicalDist`. |

> Rings (13/14) only render when `state.ringsEnabled`. Low-visibility during radius
> exploration, but leaving them makes rings float detached from a large planet, so the
> one-line scale is included in slice B. Haze (12) likewise only fires on thick-haze
> presets. Both are **identity at sVis=1** → bit-identical for every non-ringed /
> non-hazy preset and for radius 1.

> **Ring-cloud LOD note (lens-01).** The cloud's near-tier shader (`ring-particle-cloud.js`)
> is a *display* mechanism that mirrors the plan's own §3 "detail tracks apparent size"
> rule, so it gets the same treatment as the planet LOD rather than being left absolute:
> - **Mechanism:** `:164` `float camDist = length(mvPos.xyz)` is in **scaled** camera
>   space (`mvPos = modelViewMatrix · position`, and `ringCloud.scale = sVis` enters the
>   model matrix). `:165` ramps it `1 - smoothstep(uDResolve, uDCull, camDist)`. The
>   impostor ring's banding (`:1802` `length(vPos.xz)` vs object-space `innerRadius`/
>   `outerRadius`) is **scale-invariant** by contrast, so the two would disagree under scale.
> - **Concrete failure (verified geometry):** ring outer edge ≈ 8.2 R (`makeRingPhysics`
>   comment `:1652`); at `sVis = 4` (16 RE) the particles span world radius ≈ 6–33 while
>   the camera stays at its **absolute** default `state.distance = 20` (`:1989`). Most
>   particles then sit at `camDist > uDCull = 14` → the near-tier cloud fades toward zero
>   exactly when the disc is **largest**, while the flat impostor still renders fully. At
>   `sVis < 1` the cloud over-resolves. (Note this is a *taste/consistency* defect, not a
>   correctness gate — the cloud is a near-tier detail already largely culled at the
>   overview even at `sVis = 1`, and only renders when `state.ringsEnabled`. See R8.)
> - **Fix (default, chosen for consistency with §3):** feed `uDResolve · sVis` and
>   `uDCull · sVis` per frame (frame-loop sketch §4). This preserves the `camDist / threshold`
>   ratio, so the LOD behaves identically in apparent-size terms; **identity at sVis=1**
>   (`state.ringDResolve · 1` = the current value), so byte-identity / non-ringed presets
>   are unaffected. `state.ringDResolve` / `state.ringDCull` remain the source of truth (the
>   live sliders `:5521-5524` still tune them); `sVis` is a display multiplier layered on
>   top in the frame loop, which is authoritative over the sliders' direct
>   `onChange` uniform writes (the next frame re-derives from the current state value — a
>   benign redundancy, no slider change needed).
> - **Fence note for the AC-ZERO-CLOBBER author:** these uniform writes live in the lab's
>   **JS frame loop**, not in any GLSL / procgen surface on the denylist (`ring-particle-cloud.js`
>   is not on the AC-ZERO-CLOBBER file list, and the write is JS, not the "inline shader
>   region of the lab"). `sVis` appearing here is expected display wiring, not a breach.
> - **Documented-deferral fallback (if a reviewer/Max prefers minimal change):** leave the
>   thresholds absolute and record in BUILD-NOTES that the particle tier culls early on
>   large ringed worlds — consistent with R6's "rings are a UAT taste call, not a
>   correctness gate." Either the fix or this explicit deferral closes the gap; the actual
>   defect the lens caught was the **silent omission** from the §2 enumeration.

### F. Diagnostic / probe surfaces

| # | Site | What | Fix |
|---|------|------|-----|
| 15 | `:5210` `SWEEP_DISTANCE=2.6`, pinned `:5216` `state.distance = SWEEP_DISTANCE` | `renderDeltaSweep` pins an **absolute** distance calibrated for radius 1 (`.sweep-raw.json` baseline). At sVis>2.36 the camera enters the scaled sphere and coverage drifts. | Pin **logical** distance: `state.distance = SWEEP_DISTANCE * sVis`. Restores the angular-coverage calibration at any radius and stays outside the sphere (`2.6·sVis > 1.1·sVis`). Restore path `:5242` already saves/restores `baseDist`. |
| 16 | `:6246` `window._lab = { …, planet, camera, lodRampOf, autoOctaves, … }` | Console probe surface used by the live drives | Expose `visScaleOf` + a `get sVis()` getter so the main session can read/measure the live scale for AC-SCALE-LIVE / AC-CLAMP live checks. Additive only. |

### G. Confirmed **inert** (no change; documented so a reviewer doesn't re-litigate)

| Site | Why uniform scale is inert |
|------|----------------------------|
| `:5658` `invQuat.copy(planet.quaternion).invert()` (object-space light) | A quaternion carries **rotation only**; `planet.scale` never touches `planet.quaternion`. Light-into-object-space is scale-invariant. |
| Height noise domain (shader `vPos`, object space) | `planet.scale` lives in the `modelMatrix`; the noise reads the raw geometry position attribute, which is unchanged. Height/relief is evaluated pre-scale → scale-invariant. **This is why the fence holds structurally.** |
| River/tributary height RTT reads (`createRiverOverlay({renderer, uniforms})`, `planet-lod-rivers.js:1249`) | The constructor receives `renderer` + `uniforms` — **not `planet` or its scale.** Height is sampled in object space via its own mesh/RTT. `sVis` cannot reach it. |
| `featureFrequencyFromKm(state.planetRadiusEarth, …)` — `:5767, :5776, :5786, :5937, :5946, :5954, :5984-5985, :6022, :6065`, … | All pass the **real** `state.planetRadiusEarth`, never `sVis`. Denylist-grep target (AC-ZERO-CLOBBER). NO CHANGE. |
| Raycasting / picking | **None exists** — `grep Raycaster|intersectObject|setFromCamera` → 0 hits. N/A. |
| Disc-crop / screenshot helper | **None in-file** — disc measurement is external (chrome-devtools `readPixels`). AC-STAGE-DOC documents the external-harness consequence instead. |

---

## 3. The zoom clamp

**Input site:** `world-engine-lab.html:5588`
```js
state.distance = Math.max(1.1, Math.min(30, state.distance * factor));
```
`1.1` is the surface-skim floor for a radius-1 planet. **Spec:**
```js
state.distance = Math.max(minCameraDistance(sVis), Math.min(30, state.distance * factor));
```
plus a **frame-loop guard** (authoritative, catches non-wheel setters — `applySettings`
loads, the sweep, restores) inserted just before `:5643`:
```js
const _minDist = minCameraDistance(sVis);
if (state.distance < _minDist) state.distance = _minDist;
```

- `minCameraDistance(sVis) = sVis · 1.1`. Worked points: `sVis=1 → 1.1` (= today's
  floor, no-op for every existing path — the wheel already clamps ≥1.1, sweep pins
  2.6·sVis, default is 20; the frame guard fires only at sVis>1); `sVis=4 (16 RE) → 4.4`
  (`> 4·1.05 = 4.2` ✓); `sVis=0.5477 (0.3 RE) → 0.6025` (`> 0.575` ✓).
- The guard only ever **raises** distance and is idempotent, so it cannot fight the
  wheel (which shares `minCameraDistance`). Side effect: after zooming in at a large
  radius then shrinking the radius, the camera stays where the clamp left it (no
  auto-zoom-back-in) — accepted (Risk R3).
- Near/far sanity at 16 RE: camera near `0.01`/far `5000` (`:194`); at min-zoom 4.4 the
  nearest surface point is `0.4` from camera (≫ near), at overview 30 the far surface is
  `34` (≪ far). No clipping — AC-CLAMP live confirms.

---

## 4. Where `sVis` is applied — **frame loop**, not change-points

**Decision: compute `sVis` once per frame in `frame()` (`:5636`) and apply it there.**

**Justification (over hooking `applyDrivers`/`newPlanet`/`setPreset`):**
1. `state.planetRadiusEarth` has **multiple independent producers** — the slider mutates
   it directly via dat.GUI (`:3902`, bypassing `drawPresetRadius`); `applyDrivers` draws
   it on preset-change/reroll (`:2987`); `rerollRadius` (`:3907`), `newPlanet`
   (`:3917`), and the worldSeed reroll all funnel through `applyDrivers`. A change-point
   approach must hook every path and still races the slider's direct mutation. **One
   frame-loop write covers all of them** — the display can never desync from the live
   radius.
2. The frame loop **already reads `state.planetRadiusEarth`** at `:5667`
   (`const _RE = state.planetRadiusEarth`) for `animationRateFactor`/`reliefEnvelope`,
   and **both `sVis` consumers live in the same loop** — `planet.scale` + the
   `logicalDist` that keys `lodRampOf`/`lodHysteresis` (`:5652/:5655`). Defining `sVis`
   here keeps it adjacent to everything that reads it.
3. Cost is one `Math.pow` + a handful of `setScalar` calls per frame — negligible.

**Frame-loop edit sketch** (module-scope `let sVis = 1.0;` added near `let t = 0;`
`:5630` so the wheel handler `:5588` and sweep `:5216` can read it):
```js
// after :5640 (spin), before :5643 (camera dist):
sVis = visScaleOf(state.planetRadiusEarth);   // DISPLAY-ONLY visual scale
planet.scale.setScalar(sVis);
hazeShell.scale.setScalar(sVis);              // scene-space shell tracks the disc
ring.scale.setScalar(sVis);                   // (ring/ringCloud may be gated on ringsEnabled)
if (ringCloud) {
  ringCloud.scale.setScalar(sVis);
  // Ring-cloud near-tier LOD keys on SCALED camera-space distance (length(mvPos)),
  // so its absolute uDResolve/uDCull thresholds must track sVis too — same
  // apparent-size principle as logicalDist (lens-01). Identity at sVis=1.
  ringCloud.material.uniforms.uDResolve.value = state.ringDResolve * sVis;
  ringCloud.material.uniforms.uDCull.value    = state.ringDCull    * sVis;
}
const _minDist = minCameraDistance(sVis);     // camera-never-enters guard
if (state.distance < _minDist) state.distance = _minDist;
const dist = state.distance * R;              // :5643 unchanged (absolute)
…
const logicalDist = state.distance / sVis;    // logical distance in planet-radii
const lod = lodRampOf(logicalDist);           // :5652 re-keyed
const oct = state.octAuto ? autoOctaves(lod) : state.octaves;   // :5653 unchanged
state._lod2Active = lodHysteresis(logicalDist, state._lod2Active ?? false);  // :5655 re-keyed
```
At `sVis=1`: `state.distance / 1 === state.distance` (exact in IEEE754),
`scale.setScalar(1)` is identity, `minCameraDistance(1)=1.1` — **the whole increment is
bit-identical to today at radius 1.**

---

## 5. Test plan per AC

| AC | Layer | Where | Assertions |
|----|-------|-------|-----------|
| **AC-VIS-MONO** | unit | NEW `tests/planet-vis-scale.test.js`, imports `{ visScaleOf, VIS_SCALE_EXP }` from `../planet-lod-lab-core.js` | `visScaleOf(1) === 1` (toBe, exact); `visScaleOf(0.3)` `toBeCloseTo(0.5477, 3)`; `visScaleOf(16)` `toBeCloseTo(4.0, 9)`; **200-point** sweep over [0.3,16] asserts strict monotonicity (`visScaleOf(r_{i}) > visScaleOf(r_{i-1})`); all finite. |
| **AC-LOD-KEY** | unit + source pins | same NEW file | (a) **keying identity:** a helper assertion `logicalDist(d, sVis) = d/sVis` → at `sVis=1` returns `d` exactly (toBe); at `sVis=visScaleOf(16)=4` returns `d/4`. (b) **source pins** via `readFileSync('world-engine-lab.html')` + `toMatch`: `/const\s+logicalDist\s*=\s*state\.distance\s*\/\s*sVis/`, `/lodRampOf\(\s*logicalDist\s*\)/`, `/lodHysteresis\(\s*logicalDist\s*,/`, `/autoOctaves\(\s*lod\s*\)/`. |
| **AC-ZERO-CLOBBER** | unit | NEW `tests/vis-scale-fence.test.js` (denylist grep) + suite/golden gates | `readFileSync` each of `planet-lod-height.glsl.js`, `planet-lod-river-amplifier.glsl.js`, every `src/worldengine/base/*.js`, `tests/golden-trajectories/run-golden.mjs`, and the inline shader region of the lab → assert **none** matches `/visScaleOf|\bsVis\b|VIS_SCALE_EXP/`. Assert `featureFrequencyFromKm(` call sites still take `state.planetRadiusEarth` (never `sVis`): `!lab.match(/featureFrequencyFromKm\([^)]*sVis/)`. **Gate steps (run, not asserted-in-file):** `npm test` → exactly **2289 passed / 4 failed** (baseline unchanged; the new tests add passes); `npm run verify-golden` → **83/83 byte-identical, NO `--record`**. |
| **AC-CLAMP** | unit (+ live later) | same NEW `planet-vis-scale.test.js`, imports `{ minCameraDistance, CAMERA_CLEARANCE }` | For `r ∈ {0.3, 1, 4, 16}`: `minCameraDistance(visScaleOf(r)) > visScaleOf(r) * 1.05`. Worked points: `minCameraDistance(1) === 1.1`, `minCameraDistance(4) === 4.4`. Live half (main session, chrome-devtools): 16 RE, wheel to min, screenshot shows unclipped disc. |
| **AC-0** | unit | fence test + BUILD-NOTES | `sVis` derivation reads only `state.planetRadiusEarth` (grep the frame-loop region: `visScaleOf(state.planetRadiusEarth)` — no `.label`/`archetype`/`regime`/`rendersOn`); existing guard suites (`worldengine-*`, taxonomy/drift) pass unchanged; consumer chain documented in BUILD-NOTES. |
| **AC-STAGE-DOC** | unit (doc gate) | `BUILD-NOTES.md` | The staging paragraph exists and names the affected harness pattern (disc-crop capture) — see §6 slice C. |
| **AC-SCALE-LIVE**, **AC-OVERLAY** | integration/live | main session | Not in this plan's slices (no browser opened here). Driven later via `window._lab.state.planetRadiusEarth` set + screenshot disc-diameter measurement. |
| **AC-UAT** | uat | Max | Deferred-to-Max; recipe carries the crater non-goal verbatim. |

**Pins consciously reviewed:** `worldengine-inc3b-synth-law.test.js` (`:137-154`) and
`worldengine-inc3b-crater-relevance.test.js` pin **crater** patterns by content-regex
(`craterSchedule`, `D_D_SIMPLE/CRATER_DEPTH`, `uCraterDensity…`, bombardment.js body) —
**none touch the LOD/scale/camera/R region**, and being content-regex (not line-number)
they are immune to the line insertions this feature makes. **No pin updates required.**
(Stated explicitly per the HARD RULES.)

---

## 6. Slice order

**Slice A — pure helper + unit tests (no lab HTML edit; goldens cannot move).**
- Add `VIS_SCALE_EXP`, `visScaleOf`, `CAMERA_CLEARANCE`, `minCameraDistance` to
  `planet-lod-lab-core.js` (existing functions untouched → goldens/headless unaffected).
- Write `tests/planet-vis-scale.test.js`: AC-VIS-MONO, AC-CLAMP-unit, AC-LOD-KEY keying
  identity.
- Gate: `npm test` still **2289/4** (+ new passes); goldens untouched.

**Slice B — lab wiring + clamps + LOD keying + shells + sweep + source/fence tests.**
- `world-engine-lab.html`: extend import `:151`; module-scope `let sVis=1.0;` (~`:5630`);
  frame-loop block (§4) — `planet.scale`, haze/ring/ringCloud scale, **ringCloud
  `uDResolve`/`uDCull` threshold scaling by `sVis`** (lens-01, item #14), min-distance
  guard, `logicalDist` keying of `:5652/:5655`; wheel clamp `:5588`; sweep pin `:5216`
  (`SWEEP_DISTANCE * sVis`); `_lab` probe additions `:6246`.
- Add source-pin assertions (AC-LOD-KEY b) + `tests/vis-scale-fence.test.js`
  (AC-ZERO-CLOBBER denylist).
- Gate: `npm test` **exactly 2289/4**; `npm run verify-golden` **83/83 byte-identical,
  no `--record`**; denylist grep zero hits.
- **Untouched:** `src/auto/CameraChoreographer.js`, `src/debug/LabMode.js` (PRE-EXISTING
  NOT-OURS working-tree mods — never edit, never stage). This slice touches only
  `planet-lod-lab-core.js`, `world-engine-lab.html`, and new `tests/*.js`.

**Slice C — `BUILD-NOTES.md` (AC-STAGE-DOC + AC-0 chain + `record-build-intent`).**
- **AC-0 consumer chain:** `state.planetRadiusEarth → visScaleOf() → sVis →
  { planet.scale.setScalar(sVis); logicalDist = state.distance/sVis → lodRampOf /
  lodHysteresis; minCameraDistance(sVis) → wheel + frame-guard; haze/ring/ringCloud
  .scale }`. Single input; no label/archetype/regime read; no new `*Enabled` key.
- **AC-STAGE-DOC paragraph (required text):** disc size is now **radius-dependent**;
  any future read-gate / UAT recipe that captures the planet at a fixed **disc-crop**
  fraction (the inc3b S4 "~70% disc" convention) must now pin **either the radius or the
  disc fraction explicitly**, because the same wheel position yields a different disc
  diameter at different radii.
- **HUD-label note (lens-01 secondary, one line):** the top-left HUD `dist/radius`
  (`:6167` `state.distance.toFixed(1)`) and its help text (`:6234` "Current approach
  distance in radii") now show **absolute** `state.distance` while the disc spans `sVis`
  radii — the true logical distance-in-planet-radii is `state.distance / sVis`. Note this
  beside the disc-crop staging consequence so the "in radii" label isn't misread as
  logical distance at non-1 radius. (Not wired to change here — display-copy note only.)
- **`record-build-intent`:** plain-language function + intent + deliberate non-goals
  (mesh floor unchanged; craters scale WITH the disc; no `Planet.js` port; no procgen
  coupling; rings/haze scale for concentricity only).

---

## 7. Risks + mitigations

**R1 — `uLodRamp` → relief-amplitude coupling (shader `:538`).** Re-keying `lodRampOf`
on logical distance shifts the **live** rendered relief amplitude at non-1 sVis.
*Mitigation:* it is display-only — the baked carrier / 83 goldens / headless harness
never execute the frame loop, so byte-identity holds; `sVis` never appears in the GLSL
(only the float `uLodRamp` does), so the denylist grep passes; it is **bit-identical at
sVis=1**; and it is the intended "detail tracks apparent size" semantics (intent §3).
*If Max rejects relief tracking apparent size at UAT:* the fallback is to key **only**
`autoOctaves` on logical distance and leave `uLodRamp` on raw `state.distance` — but
that contradicts AC-LOD-KEY's "all three call sites," so it is a UAT redirect, not a
default. **Flag to the main session before UAT.**

**R2 — `renderDeltaSweep` coverage-baseline drift (`:5216`).** The committed
`.sweep-raw.json` was calibrated at absolute distance 2.6 assuming radius 1.
*Mitigation:* pin **logical** distance (`SWEEP_DISTANCE * sVis`) → the angular coverage
(and thus the delta calibration) is preserved at any radius, and the camera stays
outside the scaled sphere. The sweep output is a **live diagnostic**, not a test golden
(confirm: no test `readFileSync`s `.sweep-raw.json` as an oracle), so no re-bless is
owed. Verify during slice B.

**R3 — frame-loop guard mutates `state.distance` as a side effect.** At high sVis the
guard raises `state.distance`; `.listen()` reflects it and it persists after the radius
shrinks (no auto-zoom-back). *Mitigation:* accepted UX (the guard only raises, never
lowers, is idempotent, and shares `minCameraDistance` with the wheel so they never
fight). Documented in BUILD-NOTES.

**R4 — accidental fence breach (goldens/baseline move).** *Mitigation:* structural — 
`sVis` is computed in the frame loop only, and object-space noise + rotation-only
`invQuat` are provably scale-invariant (§2.G). Enforced by the AC-ZERO-CLOBBER denylist
grep + `verify-golden` byte-identity as slice-B gates. If either moves, stop and diff.

**R5 — pinned-line movement.** *Mitigation:* the synth-law/crater-relevance pins are
content-regex on crater code far from the edit region; line insertions do not alter the
pinned text. Verified **no pin update needed**. BUILD-NOTES records the new line
locations so a future reader isn't misled by stale line numbers.

**R6 — scene-space shell regressions (haze/rings).** `scale.setScalar(1)` is identity,
so every non-hazy / non-ringed preset and all of radius 1 is bit-identical; only non-1
radii with those features enabled change (correctly — they now track the disc). Live
AC-OVERLAY (province/rivers) is separately covered for free by parenting. Low risk;
rings' live look is a UAT taste call, not a correctness gate.

**R7 — NOT-OURS working-tree files.** `CameraChoreographer.js` + `LabMode.js` are
modified in the tree and must never be touched or staged. *Mitigation:* the edit surface
is exactly `planet-lod-lab-core.js` + `world-engine-lab.html` + new `tests/*.js` +
`BUILD-NOTES.md`. No overlap. (working-Claude commits at the seam; this plan commits
nothing.)

**R8 — ring-cloud near-tier LOD keyed on scaled camera-space distance (lens-01).**
`ring-particle-cloud.js:164-165` culls/resolves particles on `camDist = length(mvPos.xyz)`
against absolute `uDResolve`/`uDCull` (`4.0`/`14.0`); scaling the cloud by `sVis` scales
`camDist` but not the thresholds, so the near tier fades at the wrong apparent size on
non-1 radii (over-culls large ringed worlds, over-resolves small ones). *Mitigation
(default):* scale the thresholds by `sVis` in the frame loop (`uDResolve·sVis`,
`uDCull·sVis`, §4 / item #14) — mirrors the `logicalDist` apparent-size principle,
identity at `sVis=1`, and lives in JS (no fence surface, `ring-particle-cloud.js` not on
the AC-ZERO-CLOBBER denylist). *Scope note:* rings render only when `state.ringsEnabled`
and the cloud is a near-tier detail mostly culled at the overview even at `sVis=1`, so
this is a consistency/taste defect, not a correctness gate (cf. R6). *Fallback:* leave
thresholds absolute and document the early-cull deferral in BUILD-NOTES. Either closes it;
the defect the lens caught was the **silent omission** from §2's "exhaustive enumeration."

---

## 8. Lens-log (adversarial must-fixes folded)

Each entry records an adversarial must-fix, whether it was **FOLDED** or **REJECTED**,
the independent source verification (lenses can be wrong), and how it was resolved.

### lens-01 — FOLDED — Ring particle-cloud distance-LOD (`uDResolve`/`uDCull`) is a missed consumer

**Claim:** §2's "exhaustive enumeration" silently omits the ring cloud's own internal
camera-space distance-LOD; scaling `ringCloud.scale.setScalar(sVis)` (item #14) without
scaling `uDResolve`/`uDCull` makes the cloud cull/resolve at the wrong apparent size on
any non-1 `sVis` — the same "detail must track apparent size" problem the plan solves for
the planet via `logicalDist`. Plus a secondary HUD-label point.

**Independent verification (all confirmed against HEAD source):**
- `ring-particle-cloud.js:164-165` — `float camDist = length(mvPos.xyz); float lod = 1.0 - smoothstep(uDResolve, uDCull, camDist);` ✓ (camera-space, and `mvPos = modelViewMatrix·position` so `ringCloud.scale=sVis` does scale `camDist`).
- Defaults `uDResolve=4.0` / `uDCull=14.0` — lab `:2448-2449` ✓; live sliders write these uniforms at `:5521-5524` ✓.
- Cloud is a **`scene`** child (`:1886 scene.add(ringCloud)`), so it does not inherit `planet.scale` — item #14's per-frame `setScalar(sVis)` is what moves it ✓.
- Impostor ring banding is **object-space / scale-invariant** (`:1802 length(vPos.xz)` vs object-space `innerRadius`/`outerRadius` uniforms) ✓ — so cloud and impostor diverge under scale, as claimed.
- Numeric example: ring outer edge ≈ 8.2 R (`makeRingPhysics` comment `:1652`); boot default `distance: 20.0` (`:1989`) is **absolute**. At `sVis=4` particles span world radius ≈ 6–33 (must-fix said ~8–32; verified inner is nearer ~6, outer ≈33 — directionally exact), so most exceed `uDCull=14` at the overview → early cull when the disc is largest ✓.
- Per-particle planet-shadow (`ring-particle-cloud.js:172-177`) uses **raw object-space** `position` vs `uPlanetRadius=R=1`; it is scale-invariant and correctly NOT flagged.
- Secondary: HUD `dist/radius` (`:6167 state.distance.toFixed(1)`) + help text (`:6234` "Current approach distance in radii") show **absolute** distance while the disc spans `sVis` radii ✓.

**One over-statement noted (does not change the verdict):** the must-fix frames the early
cull as a headline correctness failure, but the cloud is a near-tier detail already largely
culled at the `distance=20` overview even at `sVis=1` (by design — it hands off to the flat
impostor beyond `uDCull`), and it only renders when `state.ringsEnabled`. So the true
severity is a consistency/taste defect (R6 class), not a correctness gate — folded as such.

**Resolution (FOLDED):**
1. §2 intro — added a correction block: the `setScalar` is necessary but not sufficient; the internal LOD is a scale-dependent consumer, so the "exhaustive enumeration" holds only with the threshold fix.
2. §2.E item #14 — expanded to name the internal LOD + prescribe the threshold scaling; added a dedicated "Ring-cloud LOD note" (mechanism, verified failure, default fix, fence note, documented-deferral fallback).
3. §4 frame-loop sketch — added `uDResolve = state.ringDResolve·sVis` / `uDCull = state.ringDCull·sVis` (identity at `sVis=1`; state stays source-of-truth, sVis is a per-frame display multiplier authoritative over the sliders' `onChange` writes).
4. §6 slice B — added the threshold-scaling to the wiring list; slice C — added the one-line HUD-label BUILD-NOTES note (secondary point).
5. §7 — added **R8** capturing the risk, default mitigation, scope note, and fallback.

**Chosen fix vs. deferral:** default = scale the thresholds (option a), because it is exactly
consistent with the plan's own §3 "detail tracks apparent size" rule (as applied to the
planet), is **identity at `sVis=1`** (zero golden/baseline/headless impact — the cloud never
runs in those paths), and costs two per-frame uniform writes. The documented-deferral
(option b) is retained as the minimal-change fallback if Max/reviewer prefers it at build
time. The lens's core point — that the silent omission was the real defect — is resolved
either way.
