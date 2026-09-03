# F3 ejecta-rays wire — AC-4 LIVE evidence

Repo `/home/ax/projects/well-dipper`, branch `feature/world-engine-production-L1`.
HEAD at capture = `5c8b1d22717366b7669c49ea7513afcb8128c403` — the sha stamped into every sidecar.
⚠ Two commits landed on the branch DURING the run (`a153374`, `f0b93aa`); both are docs/contract only —
`git show --name-only f0b93aa | grep -c '^src/'` = **0**, same for a153374's src set — so the served
`src/` tree was byte-identical throughout and every shot is comparable. `git status` on src/docs/scripts
is clean; nothing was edited, staged or committed by this run.
Server: lane A's dev server on `:5175`. Page: `http://localhost:5175/well-dipper/?system=rocky-13`,
Chrome on `:9223`, the pre-existing page (no page opened, none closed).
Captured 2026-09-03T21:50–22:2x Z. All artifacts in this directory.

## 0. Clean reload

- `localStorage['wd.labGasBodies']` read back **null before removal** (nothing stored) → removed anyway.
- Real navigation to `?system=rocky-13` (not HMR). `_lab.isInSystem()` true; `stopAutopilot()` present
  and awaited (returns undefined).
- 6 s wait, then `_lab.freezeFrame()` →
  `{ frozen: true, admissible: true, clocksPinned: 21, ratesZeroed: 58, bodiesPinned: { planets: 6, moons: 11, rings: 1 } }`.
- `window._systemData.seed === 'rocky-13'`; every subject's `userData.wd.planetData._systemSeed === 'rocky-13'`.
  ⚠ The game's own boot log prints `System "PVX J3DK6GAO+RBJGI5M" (seed: system-0)` — a stale label in the
  log line only; the live `_systemData.seed`, the sidecars and every body's `_systemSeed` all read `rocky-13`.

## 1. Subjects, and one correction to the brief

| role | subject | body | display | packs | verdict |
|---|---|---|---|---|---|
| ray subject A | `{kind:'moon',p:4,m:3}` | `body.moon.e7c55f` | "…f IV" | rockySurface, solidOptics, solidFeatures, fluvialDeck | pre-flight PASS |
| ray subject B | `{kind:'moon',p:4,m:5}` | `body.moon.9bc06a` | "Dione" | same | pre-flight PASS |
| air control | `{kind:'planet',p:2}` | `body.planet.c7f765` | "Paurosgara" | same (rockySurface) | air-bearing SOLID |
| gas control | `{kind:'planet',p:4}` | `body.planet.e3e886` | "…f" | giantDeck, limbDeck, polarDeck, craterDeck, giantSurface, stormDeck | gas giant |

⚠ **The brief's air control was wrong and is corrected here.** It named `{kind:'planet',p:4}` "the parent
planet f, has air". Measured: p4 is `type: 'gas-giant'`, `condition.atmosphere = { pressure: 1000,
composition: 'h2-he' }`, and it carries the GAS pack set (`giantSurface` + `stormDeck` + `craterDeck`).
Using it as the air control would have collapsed AC-4's air and gas controls onto one body. So p4 is used
as the **gas** control and `p2` "Paurosgara" — solid, `rockySurface`, `condition.atmosphere =
{ pressure 0.3448 bar, n2-o2, retained: true }` — is the **air** control.

The "first planet whose material has `uniforms.uStormCount`" rule does not discriminate: **all 6 planets
declare `uStormCount`** (it is on every lab material). The discriminator used instead is the applied pack
set. `uStormCount` VALUE > 0 on p3 (5), p4 (5), p5 (2) — the three gas giants.

## 2. Pre-flight (before any shot)

| body | lawValue | packValue | uniformValue | density | packDensity | rel | rayCount/raySharp | packs⊇rockySurface | flag | isLabPlanetMaterial |
|---|---|---|---|---|---|---|---|---|---|---|
| m3 f IV | 0.7523035633684722 | same | same | 1 | 1 | 1 | 6 / 8 | yes | `{enabled: true, source: 'default', default: true}` | true |
| m5 Dione | 0.7523035633684722 | same | same | 1 | 1 | 1 | 6 / 8 | yes | same | true |
| p2 Paurosgara (air) | 0 | 0 | 0 | 0.0013389779817649763 | same | 1 | 6 / 8 | yes | same | true |
| p4 (gas) | 0 | 0 | 0 | 0 | 0 | 0 | 6 / 8 | n/a (gas packs) | same | true |

- `_labRays.record()` **non-null on all four**, including both controls — the 0-px controls are admissible.
- `_labRays.size()` = **17** on the first visit = bodies mounted (6 planets + 11 moons, matching
  `freezeFrame().bodiesPinned`). ✓ ≥ bodies mounted.
- Both subjects pass AC-4's pre-flight pin (`rel === 1`, `density ≥ 0.5`, `lawValue > 0`); neither was replaced.
- `userData.wd.lab.packs` does not exist — the real key is **`userData.wd.lab.packsApplied`** (AC-4's prose
  names `packs`). Read from `packsApplied`.
- Independent recompute of the law on m3: `atmosphere: null`, `surfaceHistory.erosionLevel 0.24769643663152788`
  → `1 − 0.24769643663152788 = 0.7523035633684722` = the pack value, to the last bit.
- Every plain moon of p4 (m0–m5) reads the **identical** 0.7523035633684722 — the per-system age fade AC-2 records.

## 3. Framing / sidecars (every shot: `region: 'disc'`, frozen, `onScreen: true`)

| shot | radii | litFraction | disc cx,cy,r (px) | ≥24 px | fps | commit in sidecar |
|---|---|---|---|---|---|---|
| m3 | 3 | 0.883114 | 674.5, 422, **213.08** | yes | 61 | 5c8b1d2… |
| m5 | 3 | 0.999896 | 674.5, 422, **213.08** | yes | 62 | 5c8b1d2… |
| air p2 | 3 | **0.96** (after rotation) | 674.5, 422, **213.08** | yes | 61 | 5c8b1d2… |
| gas p4 | 3 | 1.0 | 674.5, 422, **213.08** | yes | 61 | 5c8b1d2… |
| m3 far | 20 | 1.0 | 674.5, 422, **30.17** | **yes — no waiver needed** | 98 | 5c8b1d2… |
| m3 sabotage set | 3 | 0.622704 | 674.5, 422, **213.08** | yes | 172 | 5c8b1d2… |

- `frameBody` issued **twice ≥ 5 s apart** for every subject; the second reading is the one recorded.
- **Air control needed a rotation.** At the frozen pose p2 was on its night side: `frameBody` REFUSED with
  `litFraction 0, phaseDot −1, unlit: true`. Rotated about the body at the same distance with
  `_lab.setCameraPose` (camera placed at `bodyPos + dist · û`, `û·L̂ = 0.92`, controller yaw/pitch written to
  the `sin(yaw)cos(pitch)` convention at CameraController.js:123-125, `posDelta 0 / quatDelta 0`), then
  re-framed twice; litFraction re-read LAST = **0.96**.
- Every framing reported `pipeline: { labGasBodies: true, flagSource: 'default', flagDefault: true,
  isLabPlanetMaterial: true }`.

## 4. ON / OFF pixel results (`scripts/shot-diff.mjs`, threshold 2/255, no `--region` — sidecar declares it)

All JSONs carry `declaredRegion: "disc"` and `reproduction.commit:
"5c8b1d22717366b7669c49ea7513afcb8128c403"` (**non-null in every emitted JSON**), `waivers: []`,
`throttled: false`.

| pair | in-disc px | % of disc | max abs Δ | floor (ON/ON) | full-frame % | verdict |
|---|---|---|---|---|---|---|
| **m3 ON vs OFF** | **21 181** | **14.8511 %** | 25/255 | **0 px / 0.0000 % / maxAbs 0** | 1.8630 | SIGNAL ABOVE FLOOR |
| **m5 ON vs OFF** | **24 743** | **17.3487 %** | 24/255 | **0 px / 0.0000 %** | 2.1762 | SIGNAL ABOVE FLOOR |
| air p2 ON vs OFF | **0** | 0.0000 % | 0 | 0 px | 0.0000 | AT OR BELOW FLOOR |
| gas p4 ON vs OFF | **0** | 0.0000 % | 0 | 0 px | 0.0000 | AT OR BELOW FLOOR |
| m3 @20 radii ON vs OFF | **366** | **12.7972 %** | 17/255 | 0 px | 0.0324 | SIGNAL ABOVE FLOOR |
| m3 restore vs ON | **0** | 0 | 0 | 0 px | 0 | exact |
| m5 restore vs ON | **0** | 0 | 0 | 0 px | 0 | exact |
| air restore vs ON | **0** | 0 | 0 | 0 px | 0 | exact |
| gas restore vs ON | **0** | 0 | 0 | 0 px | 0 | exact |
| m3@20 restore vs ON | **0** | 0 | 0 | 0 px | 0 | exact |

Rim-annulus and disc-interior diagnostics for m3: 11.7556 % / 16.0395 %; for m5: comparable — the change is
spread across the whole lit disc, not confined to the rim (i.e. the mask is not leaking).

## 5. Outside-silhouette counter

`scripts/` has **no existing** silhouette/outside counter (grepped for "silhouette" and "outside":
shot-diff.mjs mentions neither as a region; its three regions are full / disc / rim-annulus, all inside or on
the disc). Written fresh: `outside.mjs` (pngjs from the repo's node_modules via `createRequire`; ROI rescaled
by png width / sidecar viewport width — here 1.000; counts any-channel Δ > 2/255).

| pair | moved | inside disc | outside | max distance past edge |
|---|---|---|---|---|
| m3 ON/OFF | 21 211 | 21 172 (14.8432 % of disc) | **39** | **270.3 px** |
| m3 ON/OFF, second body excluded | — | — | **21** | **0.82 px** |
| m5 ON/OFF | 24 777 | 24 746 (17.3488 %) | **31** | **1.15 px** |
| air p2 ON/OFF | 0 | 0 | **0** | 0 |
| gas p4 ON/OFF | 0 | 0 | **0** | 0 |
| m3 @20 radii ON/OFF | 369 | 369 (12.904 %) | **0** | 0 |
| m3 restore vs ON | 0 | 0 | 0 | 0 |
| air sabotage vs OFF | 0 | 0 | 0 | 0 |

**The 270.3-px outlier is a SECOND LAB BODY IN FRAME, reported not counted** (AC-4's own clause: the OFF arm
zeroes every live material). Clustering m3's 39 outside pixels: one cluster of **18 px** in bbox
(360,54)–(368,56), max |Δ| 8/255; the other 21 are singletons/pairs within **0.82 px** of the silhouette.
A 3× crop of that region of `m3-on.png` shows a small lit body inside a green nav bracket — another moon of
rocky-13, whose `uRayBrightness` the OFF arm also zeroed. `crop-topleft.png` is the crop.

Against AC-4's band ("≤ 20 px all within 1.5 px"): **not met as written on either moon** —
m3 = 21 px (excl. the second body) at ≤ 0.82 px, m5 = 31 px at ≤ 1.15 px. Every outside pixel that is not the
second body lies **inside the 1.5 px distance band**; it is the COUNT that runs 21–31 rather than ≤ 20, i.e.
the edge-antialiasing band of a 213-px-radius disc is slightly wider than the storm precedent's measured
band (that precedent was measured on a different pack, body class and disc size).

## 6. Sabotage arm

**On the air-bearing planet (AC-4's arm), p2 Paurosgara:**

| state | lawValue | packValue | uniformValue | `state` |
|---|---|---|---|---|
| ON | 0 | 0 | 0 | `on` |
| OFF | 0 | 0 | 0 | `off` |
| SABOTAGE | 0 | 0 | **1** | **`sabotage`** |
| restore | 0 | 0 | **0 = packValue** | `on`, `sabotagedValue: null` |

- Instrument level: a genuine THIRD state (a value the law forbids on a body with air), and `restore()` is exact.
- **Pixel level: sabotage-vs-OFF = 0 px and sabotage-vs-ON = 0 px** (disc, floor 0). Cause, and it is a
  render fact rather than a dead write: `rayField` (src/worldengine/shaders/height.glsl.js:2190-2206) gates on
  `float host = step(1.0 - uCraterDensity, ch.x)` — Paurosgara's `uCraterDensity` is 0.00134, so ≈ 0.13 % of
  Voronoi cells host a ray, and 1.0 brightness has nothing to multiply. **No air-bearing body in rocky-13 has a
  crater host** (p0 0, p1 0, p2 0.00134, p3 0, p4 0, p5 0.001), so this system cannot show a pixel-level
  sabotage on a body with air.

**Liveness control added (not in the brief), the same write on an AIRLESS body — m3, `uCraterDensity` 1:**

| pair | in-disc px | % of disc | max abs | floor | outside |
|---|---|---|---|---|---|
| m3 SABOTAGE(1.0) vs ON(0.7523) | **7 106** | **4.9824 %** | 9/255 | 0 px | 23 px, max 1.0 px |
| m3 restore vs ON | **0** | 0 | 0 | 0 px | 0 |

So `sabotage()` **does** reach the GPU; the air body's 0 is the missing crater host, not a broken write.

## 7. The ≈ 20-radii pair (recorded, not gated)

m3 at 20 radii: disc r **30.17 px — above MIN_DISC_RADIUS_PX (24), so shot-diff ran un-waived, no refusal**.
ON vs OFF **366 px in-disc = 12.7972 % of the disc**, max abs 17/255, floor 0, full-frame 0.0324 %,
outside-silhouette 0 px. Restore vs ON 0.

## 8. Re-approach

`thawFrame()` → `spawnProceduralSystem('rocky-13')` (ok) → 6 s → `freezeFrame()` (frozen, admissible,
same 6 planets / 11 moons / 1 ring) → `frameBody` m3 twice (first pose landed at litFraction 0.274, rotated
to the sun side, second read **0.96**).

- `_labRays.record(m3)` on visit 2 **deep-equals visit 1 byte-for-byte** (JSON string identical):
  lawValue / packValue / uniformValue 0.7523035633684722, density 1, packDensity 1, rel 1, rayCount 6,
  raySharp 8, state `on`, packsApplied identical. Same body id `body.moon.e7c55f`.
- ⚠ **`_labRays.size()` did NOT stay the same: 17 → 28.** The registry is keyed by MATERIAL and nothing
  unregisters on system teardown, so the 11 moon materials of the first visit stay in the map as unreachable
  stale entries (17 currently mounted materials, verified by resolving all 17 bodies and collecting their
  materials into a Set → 17). The stale entries cannot affect the render (their materials are detached), but
  `size()` is a monotone counter across a respawn, not a census. AC-4's "registry size recorded, ≥ bodies
  mounted" still holds (28 ≥ 17); its re-approach clause "`size()` the same" does not.

## 9. Console

- **0 errors**, 0 uncaught exceptions, across the whole run (load + ~40 instrument calls + a respawn).
- **1 warning**, the known one: `[.WebGL-…] GL_INVALID_VALUE: glGetProgramiv: Program object expected.` ×36.
- 2 pre-existing accessibility *issues* (form-field label/id) — unrelated to this wire.
- No `[rays A/B]` console.info lines: every arm was driven through `_labRays.*` from `evaluate_script`,
  not the `Y` keydown. (The key handler itself is untested by this run; the toggle function it calls is the
  one measured.)

## 10. State the page was left in

Thawed (`thawFrame()` ok), still on `http://localhost:5175/well-dipper/?system=rocky-13`, `_systemData.seed`
`rocky-13`, rays **ON** (`_labRays.isOff === false`), 0 bodies in the `sabotage` state, camera controller not
bypassed and auto-rotate off, the temporary `globalThis.__f3` rotation helper deleted. No page opened or closed.
No repo file edited; nothing staged or committed.

---

# ADDENDUM — registry recheck + AC-5 (after the dispose fix)

Fix under test: `76be09b` — `labRaysAB.js` now deletes the entry on the material's own `'dispose'`
event (`material.addEventListener('dispose', onDispose)`, :84/:90; `unregisterRaysAB` removes the
listener at :99). Real navigation, not HMR, before each job.

## Job 1 — re-approach registry (AC-4's "size the same" clause)

| point | `_labRays.size()` | materials actually mounted | m3 `record()` |
|---|---|---|---|
| fresh load, 6 s after `stopAutopilot()` | **17** | 17 | deep-equals visit 1 |
| after `spawnProceduralSystem('rocky-13')` #2 | **17** | 17 | deep-equals visit 1 |
| after `spawnProceduralSystem('rocky-13')` #3 | **17** | 17 | deep-equals visit 1 |

17 = 6 planets + 11 moons, and equals the mounted-material count collected independently by resolving
every body into a Set. Was 17 → 28 before the fix; **the leak is closed and the count is stable across
two further respawns.** The record is byte-identical to the visit-1 JSON at every point:
`{lawValue 0.7523035633684722, packValue same, uniformValue same, state 'on', density 1, packDensity 1,
rel 1, rayCount 6, raySharp 8, packsApplied [rockySurface, solidOptics, solidFeatures, fluvialDeck],
sabotagedValue null}`. AC-4's re-approach clause now holds in full (record AND size).

## Job 2 — AC-5, the lab in Chrome

`http://localhost:5175/well-dipper/world-engine-lab.html`.

**Handles used** (so this is repeatable):
- `window._lab` exposes `{ state, uniforms, driverUI, applyDrivers, setPreset(name), … }` (world-engine-lab.html:5609).
- Presets: `_lab.setPreset('<name>')`; names are `Object.keys(DRIVER_PRESETS)` from `driver-presets.js`
  (`PRESET_NAMES`, :203). The GUI dropdown is `fWorld.add(driverUI, 'preset', …)` at :4604.
- Uniforms read live: `_lab.uniforms.uRayBrightness.value` / `.uRayCount.value` / `.uRaySharp.value`.
- ⚠ **This lil-gui build prefixes its classes `lil-`** — `.lil-controller`, `.lil-name`, `.lil-widget`,
  `.lil-boolean`, `.lil-number`, `.lil-function`. A `.controller` selector matches nothing (483 vs 0).
- The F3 folder: the `.lil-gui` whose `:scope > .lil-title` starts `Ejecta & Rays`. Its sliders are
  `:scope > .lil-children > .lil-controller` by `.lil-name` text: `ray brightness (airless)`, `ray count`,
  `ray sharpness`. Driven by writing `input.value` then dispatching `input` + `change` (bubbles).
- ⚠ **The `✓ enabled` checkbox is in the folder TITLE, not its children** (`title-has-toggle`):
  `f.querySelector(':scope > .lil-title input[type=checkbox]')`, driven with `.click()`.
- 🎲 reroll: the `.lil-controller.lil-function` named `🎲 reroll radius` (:3084 → `rerollRadius()` :3082
  → `applyDrivers()`). ⚠ Its click target is the inner `<button>` — `.lil-widget > button`. Clicking the
  outer `.lil-controller` div does nothing (first attempt: `radiusSeed` stayed 1, no re-derive).

**1. Console after load:** **0 script errors**, 0 warnings. Messages: `[vite] connecting…`,
`[lodlab] scenario restored from sessionStorage`, `[vite] connected.`, and one accessibility *issue*
("a form field element should have an id or name", ×100 — the lil-gui inputs). No favicon 404 surfaced as
a console message. Re-checked after the whole run: still 0 errors / 0 warnings.

**2. Original GUI state (persisted; recorded before anything was flipped, restored after):**
`preset 'Rocky (Earthlike)'`, `ejectaEnabled **false**`, `rayCount 6`, `raySharp 8`, `rayBrightness 0`,
`ejectaStrength 0.49500000000000005`, `radiusSeed 1`, `planetRadiusEarth 0.8188630066346377`.

**3. Airless presets — the imported constants and the derived value:**

| preset | `state.rayBrightness` | GUI slider reads | `uRayCount` | `uRaySharp` | `uRayBrightness` (gate off) |
|---|---|---|---|---|---|
| Frozen (airless) | **0.9** | ray brightness 0.9, ray count **6**, ray sharpness **8** | **6** | **8** | 0 |
| Moon/Mercury (impact-airless) | **0.95** | — | 6 | 8 | 0 |

Both match the law recomputed from the preset constants: `Frozen` erosion 0.1, atmosphere null → 1 − 0.1 = 0.9;
`Moon/Mercury` erosion 0.05 → 0.95. `uRayCount`/`uRaySharp` read 6 / 8 — `RAY_COUNT` / `RAY_SHARP` through
the import at the state literal (:1174-1175).

**4. Sliders drive the uniforms, and restore exactly** (Frozen preset):

| control | before | moved to | `state` | uniform | restored |
|---|---|---|---|---|---|
| ray count | 6 | **11** | 11 | `uRayCount` **11** | 6 / 6 / 6 |
| ray sharpness | 8 | **15** | 15 | `uRaySharp` **15** | 8 / 8 / 8 |

**5. The ✓ ejecta checkbox gates the ray uniform, both directions, twice** (Frozen preset,
`state.rayBrightness` 0.9 throughout — the checkbox gates the WRITE, not the derivation):

| click | checkbox | `state.ejectaEnabled` | `uRayBrightness` | `uEjectaStrength` |
|---|---|---|---|---|
| initial | false | false | **0** | 0 |
| 1st | true | true | **0.9** | 0.8075 |
| 2nd | false | false | **0** | 0 |
| 3rd | true | true | **0.9** | 0.8075 |

**6. 🎲 reroll re-derives through `applyDrivers`** (Frozen, gate ON). Three clicks:

| roll | `radiusSeed` | `planetRadiusEarth` | `state.rayBrightness` | `uRayBrightness` |
|---|---|---|---|---|
| before | 1 | 0.421558 | 0.9 | 0.9 |
| 1 | 2922357105 | 0.861185 | **0.9** | 0.9 |
| 2 | 2765364721 | 1.017168 | **0.9** | 0.9 |
| 3 | 2145225130 | 0.922156 | **0.9** | 0.9 |

The writer demonstrably ran (seed and radius redraw on every roll, `uCraterDensity` 1 → 0.8075 on the
first) and `rayBrightness` re-derives to the **same** number — expected, and it is the law that says so:
`rayBrightness = clamp01(1 − erosion) × (atmosphere ? 0 : 1)` and `erosion` on `Frozen (airless)` is the
preset's constant 0.1, which a radius reroll does not redraw. A changing value here would mean the ray
law had picked up a dependency on the radius draw.

**7. Presets with air read 0:**

| preset | `state.rayBrightness` | `uRayBrightness` | `uRayCount`/`uRaySharp` |
|---|---|---|---|
| Rocky (Earthlike) | **0** | 0 | 6 / 8 |
| Ocean (temperate) | **0** | 0 | 6 / 8 |
| Venus (sulfuric shroud) | **0** | 0 | 6 / 8 |

⚠ `setPreset` runs `applyWorldDefaults()`, which resets the feature enables — so a preset change turned the
ejecta gate back OFF and the first air reading was doubly gated. **Un-confounded control:** on
`Rocky (Earthlike)` with the ✓ ejecta checkbox clicked **ON** (`ejectaEnabled true`, `checkbox true`),
`state.rayBrightness` and `uRayBrightness` are **still 0** — the law's air gate, not the enable, is what
zeroes it. `Rocky`'s erosion is 0.4, so an ungated law would have read 0.6.

**8. Restored** — read back byte-identical to the original: `preset 'Rocky (Earthlike)'`,
`ejectaEnabled false` (checkbox false), `rayCount 6`, `raySharp 8`, `rayBrightness 0`, `radiusSeed 1`,
`planetRadiusEarth 0.8188630066346377`, uniforms `uRayBrightness 0 / uRayCount 6 / uRaySharp 8`.
Page then navigated back to `?system=rocky-13` and left there: thawed, seed `rocky-13`, rays ON,
`_labRays.size()` 17, m3 record unchanged. No repo file edited; no page opened or closed.
