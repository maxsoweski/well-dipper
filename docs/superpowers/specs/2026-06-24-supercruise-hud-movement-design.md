# Supercruise — HUD placement, celestial-time realism, perceptible movement + flight test harness

**Date:** 2026-06-24 · **Branch:** `feature/supercruise-freelook` (worktree `/home/ax/projects/well-dipper-supercruise`)
**Arc:** continuation of the supercruise+freelook workstream (`docs/WORKSTREAMS/supercruise-freelook-2026-06-10/`).
**Origin:** Max rode Tasks 8–11 and hit two bugs synthetic verification missed (A, B), plus a realism note (C). This
spec covers a fix for all three plus the flight-controls test harness that would have caught A+B.

## Why we care
Manual supercruise is the first time the player drives the new flight model directly. Today it fails the felt
experience three ways at once: the HUD isn't centered, planets visibly spin/orbit while you fly (immersion-breaking
at human flight timescales), and pressing W produces no perceptible motion. The harness exists so flight feel is
*observable and assertable* without a human ride — the gap that let A+B ship "all-green."

## The B↔C connection (framing)
In manual flight today the **planets move too fast** (C) and the **ship moves too slow** (B) — two halves of one
"realistic-flight feel is wrong" problem. Fixing both yields the target experience: **still, real-scale worlds you
visibly fly past.**

---

## Item 1 — Bug A: HUD/reticle not centered *(mechanical)*
**Root cause (confirmed):** `src/ui/SupercruiseHud.js` `_resize()` sets the canvas **backing store**
(`canvas.width = innerWidth*dpr`, `ctx.setTransform(dpr,…)`) but never pins the **CSS display size**. With
`inset:0` and the global `box-sizing:border-box` reset, on a DPR≠1 display the canvas element renders DPR×
oversized / top-left-anchored, so the center-cross drawn at `(innerWidth/2, innerHeight/2)` lands off-center and
the bottom-left speed/throttle readout (`x=24, y=innerHeight-48`) clips off-screen.

**Reference pattern:** `src/ui/TargetingReticle.js:104-110,145-155` pins `canvas.style.width/height = w+'px'`
every resize. The HUD was meant to copy this and didn't.

**Fix:** in `SupercruiseHud._resize()` add `this.canvas.style.width = innerWidth+'px';
this.canvas.style.height = innerHeight+'px';` and set `display:'block'` in the constructor style block. Keep the
existing DPR clamp + `ctx.setTransform` (that approach is fine once the CSS box is pinned). No other change.

**Acceptance:** center-cross centered and bottom-left readout fully on-screen at Max's real DPR (verify live).

---

## Item 2 — Flight-controls test harness *(two parts)*
The lesson: synthetic key-events + model-state probes passed while the felt experience was broken because nothing
asserted the **emergent** chain "press W from rest → speed builds → screen visibly translates." Both parts below
must assert a **perceptual** signal (projected screen-space change), not just `position` deltas.

### 2a — Standalone `flight-controls-lab.html` (project root)
Per the isolated-harness pattern (`feedback_isolated-test-harnesses`). Build:
- Import the **real** `src/flight/SupercruiseModel.js` + `src/flight/HeadMount.js` (pure logic — import, don't copy;
  we are driving them, not mutating production renderers).
- Minimal Three.js scene: a **real-scale reference planet** (`earthRadiiToScene(1)=0.0426u`, from
  `src/core/ScaleConstants.js`) placed at origin + a starfield for parallax, camera driven by `HeadMount.applyTo`.
- Camera starts at the natural manual-entry distance `radius×6` from the planet (matches `main.js:4250`).
- Real input: W/S throttle (`setThrottle(throttle ± THROTTLE_RATE*dt)`) + mouse virtual-joystick (`setTurnInput`),
  mirroring the main.js manual handlers.
- Tuning sliders wired live to the model's `tuning`: `ETA_K`, `ACCEL_TAU`, `CAP_MIN_FRAC`, `THROTTLE_RATE`.
- `window._lab` API: `flyFromRest({seconds})` holds W from rest and **records over time**: `speed`, camera world
  position, and the **planet's projected screen-space radius** (project planet center + a surface point to NDC).
  Returns `{ visiblyTranslated: bool, screenRadiusGrowthPct, peakSpeed, samples }`. Assertion: planet screen-radius
  grows by ≥ a threshold (e.g. 25%) within N seconds → motion is perceptible.
- Save screenshots to `screenshots/` per project convention.

### 2b — In-game probe on `window._sc`
Add `window._sc.flyFromRest({seconds})` in `src/main.js` (extend the documented `_sc` surface — not an ad-hoc
shortcut). It runs the same scripted fly-from-rest in the **real game**: enters manual at the current focus body,
holds W, samples `scModel.speed` + camera world-pos + the focus body's projected screen radius over time, restores
prior state, and returns the same `{ visiblyTranslated, … }` verdict. This guards the real emergent wiring — the
exact thing that was untested. Document it alongside the existing `_sc` fields.

**Acceptance:** both expose a fly-from-rest run with a perceptual pass/fail; the in-game probe returns a verdict
that a future change can regression-check headlessly-ish (driven via chrome-devtools).

---

## Item 3 — Bug C: celestial-time realism + signed slider
**Lever (single point):** `src/main.js:6459` — `const celestialDt = deltaTime * settings.get('celestialTimeMultiplier')`.
Every spin + orbit (planets, moons, rings, asteroids, binary stars, flavor ships) reads `celestialDt`. Default
multiplier is already `1.0` = realistic = imperceptible (`src/ui/Settings.js:31`); the slider currently maps DOM pos
0–40 → `10^(pos/10)` → 1×–10000× (`src/main.js:2570-2571`, positive-only). **Visible motion today means the saved
value is raised** (no code auto-raises it — confirm the live value first).

**Design (Max's decision):** default = realistic in **every** mode (flight, autopilot, idle) — NOT mode-gated.
Keep a menu slider, reframed as **signed**:
- Displayed **0 = realistic (1×)** — the default that ships.
- Drag right → speed up: `10^(n)` (10×, 100×, … up to ~10000×).
- Drag left → **reverse**: `−10^(|n|)` (−10×, −100×, … retrograde / rewind).

**Implementation:**
- Reframe the slider mapping (`main.js:2570-2571`) to signed: DOM pos `−40..0..+40` → multiplier
  `sign(pos) * 10^(|pos|/10)` with pos 0 → `1.0`. Update the label/readout (`Settings.js:26-30`) to show the signed
  value (and "REALTIME" / "REVERSE" affordance).
- Change default to realistic and make it the shipped default (`Settings.js:31`).
- **localStorage migration:** `celestialTimeMultiplier` is persisted; old stored values carry the old positive-only
  meaning. On load, migrate (clamp/reset to realistic default `1.0` so no one inherits a raised value) — Max should
  open to no visible planet motion.
- **Reverse correctness:** negative `celestialDt` flows through `orbitAngle += orbitSpeed*celestialDt`
  (`main.js:6491,6536`; `Moon.js:583`; `AsteroidBelt.js:229`), rotation (`Planet.js:1284`, `Moon.js:603`), and the
  asteroid `_elapsedTime += celestialDt` accumulator (`AsteroidBelt.js:216`). All reverse by sign — **verify** no
  clamp assumes non-negative time.

**Acceptance:** fresh load → no perceptible planet spin/orbit in any mode. Slider right → motion speeds up; slider
left → motion runs backward. Verify in the lab and/or game.

---

## Item 4 — Bug B: perceptible manual movement *(feel; needs Max's ride to finalize)*
**Root cause (diagnosed, not a broken wire):** the camera *does* track the model. Near a small planet/moon the
gravity-well cap pins speed to ~0.013–0.036 u/s (cap `= max(CAP_MIN_ABS, radius*CAP_MIN_FRAC, surfaceDist/ETA_K)`),
and `ACCEL_TAU=1.4s` means ~5s to even ramp to that crawl → motion is real but sub-perceptual with no near
reference. (`src/flight/SupercruiseModel.js:9-18,53-62,82-87`.)

**Levers (tune in the lab, A/B, then Max's ride) — scale-safe only:**
- Lower **`ACCEL_TAU`** (1.4 → ~0.5–0.8s): faster throttle response. Purely temporal → scale-independent.
- Lower **`ETA_K`** (6 → ~3–4): raises the near-body cap proportionally to surfaceDist.
- **DO NOT** touch `CAP_MIN_FRAC` (0.5) / `CAP_MIN_ABS` (1e-5) — these are the scale-bug floors behind the two prior
  live regressions (`259f855`, `d5e4e2f`). The drop-window math (`10R` / `(10R)/2.5`) stays intact.

**Acceptance:** harness fly-from-rest asserts visible on-screen translation within ~1–2s at a small-body entry,
**and** the drop window still captures correctly, **and** Max's felt sign-off. Bug B tuning is NOT part of the
autonomous build workflow — it is the live loop on the harness + Max's ride.

---

## Build order & verification
1. **Build (parallel, disjoint files):** Item 1 (`SupercruiseHud.js`) · Item 2a (new `flight-controls-lab.html`) ·
   Item 2b + Item 3 (both touch `main.js` → **one agent owns `main.js` + `Settings.js`** to avoid a race).
2. **Headless verify:** `vite build` clean + flight test suite green + full suite known-failures-only.
3. **Live verify (Max's Chrome `:9223`, `:5174` tab):** read live `celestialTimeMultiplier`; confirm Bug A centered
   at real DPR; drive the lab + `_sc.flyFromRest()`.
4. **Bug B tuning loop:** interactive on the harness → Max ride → feel sign-off.
5. Then Tasks 12–13 (retire legacy movers) → `verify-workstream` → VERIFIED_PENDING_MAX → Max UAT → Shipped.

## Guards
- **Scale-bug guard:** never re-tune `CAP_MIN_FRAC`/`CAP_MIN_ABS` floors (scale-free for real radii ~1e-4..5u).
- **Parallel-session:** `:5173` tab = World Engine session — never touch. Assert `location.href` contains `:5174`
  before any chrome-devtools action. Do NOT edit `NOW.md` in the worktree. Do not edit worktree `main.js` while Max
  is actively riding (HMR reloads his page).
