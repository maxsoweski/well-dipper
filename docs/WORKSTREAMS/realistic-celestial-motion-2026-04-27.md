# Workstream: realistic-celestial-motion-2026-04-27

**Status:** **`Shipped a89e454 (Tester §T2 PASS — 2026-04-27)`** — Max
felt-experience evaluation 2026-04-28: *"looks good."* Implementation
landed across two commits (`326e8a4` initial + `a89e454` Earth-anchor
fix per Tester §T1 catch). All 9 ACs PASS. Parking-lot followup
captured at `docs/PARKING_LOT.md` §P1 (per-moon authored
`rotationSpeed` for `MoonGenerator` + Sol hand-authored moons).
Workstream closed.

---

**Status (historical):** Active — scoped 2026-04-27, awaiting working-Claude greenlight after sister §A8 amendment commits.
**Authored:** 2026-04-27 by PM at HEAD `01caf00`.
**Active-pointer note:** This brief is authored in parallel with the §A8 amendment to `autopilot-camera-ship-decoupling-2026-04-25`. Per Director's standing direction, the active-workstream pointer at `~/.claude/state/dev-collab/active-workstream.json` stays on `autopilot-camera-ship-decoupling-2026-04-25` until §A8 implementation + Tester verdict complete. Working-Claude flips the active pointer to this slug when it picks up implementation.

## Parent feature

`docs/FEATURES/autopilot.md` — adjacent (not direct parent). Autopilot is the feature surface where current celestial speeds are felt most acutely (every CRUISE leg watches a body in motion; every APPROACH targets a body in motion; every STATION-A holds on a body in motion). The cascading benefit on §A7 lhokon body-lock drift (AC #5 below) is the load-bearing autopilot connection. However, this workstream's scope spans **all celestial motion** in the project (screensaver mode, nav-computer transit, every system), not just autopilot — the orbit/rotation pipeline is shared infrastructure, owned by `src/generation/` + `src/objects/Planet.js` + `src/objects/Moon.js` + `src/objects/AsteroidBelt.js`. The settings slider it ships is a system-wide control, not autopilot-only.

A dedicated `docs/FEATURES/celestial-motion.md` feature doc does not yet exist. PM flags this as a doc-gap to surface to working-Claude after Shipped: the realistic-by-default rule + slider control is feature-altitude (it shapes what every system feels like), and a feature doc rooted in the heart's-desire register (`Game Bible §2 — Vast rather than frantic. Open rather than cluttered.`) would be the right home for future scope expansion (e.g., per-system speed overrides, time-rewind/scrub, eclipse-precise orbital phasing).

## Implementation plan

N/A (workstream-sized). The §"Implementation plan" section below sketches an ordering working-Claude can follow.

## Scope statement

Replace the project's current accelerated celestial motion (orbits ~6280× realistic, rotations ~24× realistic) with **true realistic motion** as the system default. Add a user-accessible logarithmic slider that scales celestial time uniformly from 1× (realistic) to 10000× (game-fast), so Max can dial in the visual register he wants per session. Centralize the realism factors in a new `src/core/CelestialTime.js` module and propagate one consistent `celestialTimeMultiplier` setting through every site that advances celestial state — orbits (planet, moon, asteroid, binary star) and rotations (planet, moon). The current code's split — `orbitDt` scales only planet/moon orbital position updates while planet rotation, moon rotation, and asteroid orbit run on raw `deltaTime` — collapses into one consistent `celestialDt` everywhere.

This is a single unit of work because the realism rule and the slider are inseparable: shipping realistic-by-default without a slider gives Max a "frozen" screensaver; shipping a slider without realistic-by-default leaves the multiplier-1× anchor at an arbitrary accelerated speed and forces a separate cycle to define what "1×" means.

## How it fits the bigger picture

Advances **Game Bible §2 Aesthetic — Era & Vibe** (*"Vast rather than frantic. Open rather than cluttered."*) and **§4A Physics-Driven Generation — Design Principle** (*"every planet, ring, belt, and moon exists for a reason traceable to formation physics"*).

The current accelerated celestial speeds were authored before either of these principles was canonized. They produce a "frantic" register — Mercury whips around the sun in tens of seconds, Earth spins like a top — that contradicts the vastness register the Bible articulates. Realistic-by-default puts the visual on the side of the principle; the slider preserves Max's ability to access frantic-register speeds for cinematic / debug / iteration purposes when they're explicitly wanted.

Cascading-benefit altitude: at realistic speeds, the §A7 lhokon body-lock translation drift (autopilot WS §A6/§A7 telemetry) shrinks below the FP noise floor. APPROACH overshoot caused by mid-flight body drift is structurally suppressed. The "moving target" problem that drove autopilot V1's predicted-intercept aim, lhokon convergence, and live body-position reads becomes a quieter problem — solving it is still correct (the slider goes to 10000×), but the load on those mechanisms eases at the default register.

## Acceptance criteria

These are contract-shaped ACs (telemetry-assertion + UI-observable). This workstream is mixed-class: most surfaces are zero-behavioral-change at the multiplier-1× boundary (just slower), but the slider itself is new UI behavior. Tester verifies via direct telemetry reads + chrome-devtools UI interaction.

1. **AC #1 — Earth-equivalent realism by default.** With `celestialTimeMultiplier = 1×` set explicitly (whether or not it is the saved-fresh-install default — see Drift Risk #1), the canonical Earth body in Sol completes one orbital revolution in (1 year ± 1%) wall-clock time, and one axial rotation in (24 hours ± 1%) wall-clock time.

   **Tester verifies** by reading the Earth entry's `orbitSpeed` (rad/s) and `data.rotationSpeed` (deg/sec) from the live Sol system, asserting:
   - `orbitSpeed × 365.25 × 86400 ≈ 2π` (within 1% → `1.972e-7 ≤ orbitSpeed ≤ 2.012e-7` rad/s)
   - `rotationSpeed × 24 × 3600 ≈ 360` (within 1% → `4.125e-3 ≤ rotationSpeed ≤ 4.208e-3` deg/sec)

2. **AC #2 — All celestial motion respects the multiplier uniformly.** With the multiplier set to N×, planet orbital angular velocity, planet axial rotation, moon orbital angular velocity, moon axial rotation, asteroid orbital angular velocity, and binary-star orbital angular velocity all advance at exactly N× their realistic rate. No surface runs on raw `deltaTime`.

   **Tester verifies** by sampling at three multiplier values (1×, 100×, 10000×) and asserting linear scaling (within 5% tolerance) on Earth orbit angular rate, Earth axial rotation rate, Moon orbit angular rate around Earth, Moon axial rotation rate, and a sampled inner-belt asteroid orbital rate. Sampling method: capture `entry.orbitAngle` / `mesh.rotation.y` / `moon.orbitAngle` / `moon.mesh.rotation.y` / `asteroid.angle` at t=0, advance simulation by Δt seconds via the fixed-step harness or a chrome-devtools-driven RAF window, capture again, divide. Compare the three sample-point ratios.

3. **AC #3 — Slider range and logarithmic scale.** Slider exposes a continuous range from 1× (realistic) to 10000× (game-fast). Linear slider position `t ∈ [0, 1]` maps to multiplier `10^(4t)` so that position 0 → 1×, position 0.25 → ~10×, position 0.5 → 100×, position 0.75 → ~1000×, position 1 → 10000×. The mapping is monotonic and continuous; no discrete steps that prevent dialling between named anchors.

   **Tester verifies** at the five named positions by setting the slider DOM element's value, reading back `settings.get('celestialTimeMultiplier')`, asserting the values match expected (within 1% — log-scale anchors don't need tight tolerance).

4. **AC #4 — Kepler invariance preserved.** The realism factor is a uniform time-scale, not a per-body adjustment. At any multiplier value, the ratio `orbitSpeed_planet_A / orbitSpeed_planet_B` equals `(orbitRadius_B / orbitRadius_A)^1.5` for canonical Sol planets (within 1% — Kepler's 3rd law).

   **Tester verifies** by reading orbitSpeed + orbitRadius for any two non-Earth Sol planets (e.g., Jupiter + Mars), computing the speed ratio and the radius-power-3/2 ratio, asserting equality within tolerance. Holds at multiplier 1× and at one additional sampled value (e.g., 1000×) to confirm the multiplier doesn't break the relation.

5. **AC #5 — Cascading benefit on autopilot lhokon body-lock drift.** At `celestialTimeMultiplier = 1×`, the per-leg `lhokonBodyLockDrift` measurement defined in autopilot §A7 brief AC #13 falls below `0.001 u` (one millionth of a scene unit per second of lhokon timeout) for any Sol body. This is a side-effect verification, not the workstream's primary aim — but it confirms the realism rule structurally suppresses the moving-target translation that drove §A7's body-lock fix.

   **Tester verifies** by running an autopilot Sol tour at multiplier 1×, capturing the §A7 telemetry surface, asserting `maxLhokonBodyLockDrift < 0.001 u` across ≥3 leg transitions. The §A7 audit reference (`~/.claude/state/dev-collab/tester-audits/autopilot-camera-ship-decoupling-2026-04-25.md`) is the comparison baseline; the same telemetry path reports an observable that AC #13 already validates structurally.

6. **AC #6 — APPROACH overshoot reduction (regression-class catch).** Max reported visible moon overshoot during APPROACH at HEAD `01caf00` (live Sol-tour evaluation). At `celestialTimeMultiplier = 1×`, moons translate ≤ 0.001 u during a full 1.8s `APPROACH_DURATION_SEC` window because realistic moon orbital angular speed × moon orbit radius × 1.8s sits at ~10⁻⁶ scene units. Any APPROACH overshoot caused by mid-flight body drift is structurally suppressed. At `celestialTimeMultiplier = 1000×` the overshoot reproduces (proving the multiplier is the cause, not a separate bug).

   **Tester verifies** by capturing moon-leg APPROACH→STATION-A trajectories at multipliers 1× and 1000× via the autopilot live trace + the §A7 telemetry. At 1×: no overshoot (hit-the-target tolerance bound holds). At 1000×: overshoot reproduces visibly. Two-sample comparison at the same Sol moon target, same warp seed.

7. **AC #7 — Settings persistence + migration.** The renamed `celestialTimeMultiplier` setting persists across page reload via the existing localStorage path. If a user has the old `orbitSpeedMultiplier` key in localStorage from a prior session, the settings load logic reads the old value, applies it to `celestialTimeMultiplier`, and removes the old key — a one-time migration.

   **Tester verifies** by:
   - Setting old key in localStorage with value `2.0` (the old narrow-range default-not), reload, asserting new key holds `2.0` and old key is absent.
   - Setting new key directly to `100`, reload, asserting new key holds `100`.
   - No old key, no new key (fresh install) → `celestialTimeMultiplier` defaults per `src/ui/Settings.js` DEFAULTS (see Drift Risk #1 for the value).

8. **AC #8 — UI feedback.** Slider DOM element displays its current multiplier value as a readable label, updating live as the user moves the slider. Format: integer multiplier values (1×, 10×, 100×, 1000×, 10000×) at the five named anchors; intermediate values display rounded to the nearest sensible digit (e.g., 32×, 316×). Min/max anchored visually at `1×` (left) and `10000×` (right). Slider label reads "Celestial Time" (replaces "Orbit Speed").

   **Tester verifies** by chrome-devtools-driving the slider DOM element through five anchor positions + two intermediates, asserting the displayed label updates within 1 frame and matches the expected formatted value.

9. **AC #9 — Tidal-locking geometric invariant preserved.** Bodies authored as tidally locked in `src/generation/KnownObjectProfiles.js` (see `tidalState.locked` flag) maintain the geometric invariant: rotation period equals orbital period at any multiplier value. Because both are scaled by `celestialTimeMultiplier`, the ratio is invariant across the slider range.

   **Tester verifies** by sampling a known tidally-locked Sol moon (e.g., Earth's Moon if so authored, or any moon with `tidalState.locked = true`) at multiplier 1× and 1000×, asserting `rotationAngularRate / orbitAngularRate ≈ 1.0` (within 1%) at both samples.

## Principles that apply

From Game Bible §11 Development Philosophy:

- **Principle 2 — No Tack-On Systems.** Load-bearing here. The current code's split — `orbitDt` for orbit positions, raw `deltaTime` for rotations and asteroids — is exactly the symptom Principle 2 names: a feature (the speed multiplier) was added downstream of generation as a partial post-process rather than threaded through the pipeline. The fix lands the multiplier as a first-class pipeline input (`celestialDt = deltaTime × multiplier`) consumed at every site that advances celestial state, AND lifts the realism constants into a generation-time module (`src/core/CelestialTime.js`) so the data-flow direction stays Model → Pipeline → Renderer per Principle 5.

  Violation in this workstream would look like: leaving moon rotation hardcoded at `0.167 deg/sec` and adding a separate "moon rotation multiplier" alongside `celestialTimeMultiplier`, or scaling rotations only at consumer sites without lifting the constants into generation. Both are tack-ons; both fail Principle 2.

- **Principle 5 — Model Produces → Pipeline Carries → Renderer Consumes.** Load-bearing. The realism factors belong in **generation** (the model produces realistic angular rates as authored data on each body), not at consumer sites (the renderer should never multiply by realism factors before drawing). The `celestialTimeMultiplier` is correct at the consumer site — it's a per-frame time-scale, not a data-shape adjustment — but the realism baseline itself is a generation-time fact.

  Violation would look like: setting all `orbitSpeed` values to current accelerated values in generation, then dividing by `6280` at consumer sites in `main.js`. That's the renderer rewriting what the model produced. Correct shape: generation produces realistic `orbitSpeed`; consumer scales by user-controlled multiplier per frame.

- **Principle 6 — First Principles Over Patches.** Load-bearing. The current `orbitSpeedMultiplier` setting was authored as a partial patch — it covers only orbits, not rotations, and uses a narrow linear `0.25–4.0` range that can't reach realistic-slow or game-fast registers. Three years of sessions have papered over the gap (autopilot tuning, lhokon body-lock, APPROACH overshoot) without naming the underlying issue: the speed pipeline is incomplete and miscalibrated. Principle 6 says: stop patching the consequences, redesign the speed pipeline. This workstream is that redesign.

  Violation would look like: widening the slider range from `0.25–4.0` to `0.001–1000` without renaming, without unifying the consumer sites, without lifting the realism factors. That's another patch on the same broken substrate.

## Drift risks

- **Risk #1 — Realistic-by-default reads as "broken/dead" to a casual screensaver visitor.**
  **Why it happens:** At multiplier 1×, Mercury orbits in 88 days of wall-clock — visually static over any session shorter than weeks. A user who didn't author this design and drops in cold sees a frozen scene. The screensaver register ("Vast rather than frantic") wants slowness, but **wholly-frozen is a different signal than slow**.
  **Guard:** PM defers to Max on the **saved-fresh-install default value** for `celestialTimeMultiplier`. The slider's range is 1×–10000×; the question is what the slider lands on for a user who has never moved it. Three options for Max:
  - **(a) 1× (true realistic).** Honest to the heart's-desire articulation. Risks "broken" read.
  - **(b) ~100× (compressed-realistic).** Mercury orbits in ~21 hours, Earth in ~3.6 days, Earth rotates in ~14 minutes. Visible motion at session timescales; still vastly slower than current ~6280×. Compromise register.
  - **(c) ~1000× (cinematic).** Mercury orbits in ~2 hours, Earth in ~9 hours, Earth rotates in ~86 seconds. Comfortably visible motion in a screensaver session. Maps to one of the named slider anchors.

  Working-Claude should explicitly ask Max which default to ship before Tester verdict. AC #1 verifies behavior **at multiplier 1× set explicitly**, regardless of the saved default — so the AC is well-defined while the default question stays open. Max's answer goes into the brief's `## Implementation plan` step 4 + the commit message.

- **Risk #2 — Existing telemetry baselines invalidated.**
  **Why it happens:** All §A6/§A7 autopilot telemetry was captured at the current accelerated speeds. Future Tester invocations comparing to past audits (`~/.claude/state/dev-collab/tester-audits/autopilot-camera-ship-decoupling-2026-04-25.md`) will see different absolute numbers. If Tester reads "max body-lock drift = 0.0001 u" against a prior baseline of "0.04 u" without context, the comparison is misleading.
  **Guard:** Working-Claude must include `celestialTimeMultiplier` value in any telemetry export this workstream's ACs reference (AC #5, #6). The §A7 telemetry `runAllReckoning` helper at `src/auto/telemetryReckoning.js` should accept or auto-capture the multiplier and emit it in the audit JSON. Future Tester audit notes the multiplier explicitly when comparing to baselines.

- **Risk #3 — Ship cruise tuning calibrated against fast bodies.**
  **Why it happens:** Autopilot `_cruiseSpeed`, `_cruiseDistance`, `APPROACH_DURATION_SEC` (autopilot WS §A4–§A7) were sized empirically against the current accelerated motion. The numbers themselves are scene-units / scene-units-per-second / seconds — they don't change algebraically when celestial speeds slow down. But the **felt experience** of an autopilot leg may shift: at realistic speeds, a body sits visually still for the duration of CRUISE. Whether this reads as "elegant slow approach" or "the system is broken" is a feel judgment.
  **Guard:** PM flags this for Max's evaluation pass at workstream close. After Tester PASS at the chosen default multiplier, Max watches a Sol tour and judges the felt experience. If a leg feels wrong, follow-up workstream tunes — not this workstream's scope.

- **Risk #4 — The slider range itself drifts.**
  **Why it happens:** Once Max plays with the slider, he may want it to extend lower (true-time-rewind?) or higher (cinematic-blur speeds?). Scope creep flag.
  **Guard:** Range is 1×–10000× in this workstream. Out-of-scope: negative values (time reverse), values < 1× (sub-realistic, doesn't have a heart's-desire anchor), values > 10000× (the screensaver math hits FP precision issues at extreme angular rates per frame). If Max wants extension after Shipped, that's a follow-up workstream, not amendment.

- **Risk #5 — Asteroid belt collision-family math invalidated.**
  **Why it happens:** `src/generation/SolarSystemData.js:75` sets asteroid `orbitSpeed = baseSpeed × (0.85 + Math.random() × 0.3)` with a per-asteroid jitter coefficient. If "realistic" is applied uniformly, the relative jitter shape is preserved. But Kirkwood-gap math (`Game Bible §4C`) and resonance-trapping (`§4A.4`) depend on absolute orbital periods. PM's read: at multiplier 1×, those resonances become visible at correct timescales for the first time — so this is a **benefit**, not a regression. But any code that assumed accelerated periods (e.g., a debug visualizer that times resonances) breaks.
  **Guard:** Tester checks the asteroid belt visually renders + advances at multiplier 1× and at 1000×. No telemetry assertion needed beyond AC #2's belt sample. If a debug visualizer breaks, that's a separate workstream's followup.

## In scope

- New `src/core/CelestialTime.js` module exporting `ORBIT_REALISM_FACTOR`, `ROTATION_REALISM_FACTOR`, and a helper to scale a base value.
- Generation-site updates that multiply base orbit/rotation values by realism factors at generation time:
  - `src/generation/SolarSystemData.js` — `keplerSpeed()` coefficient (line 46), `moonSpeed()` (lines 51–54), `generateBelt()` baseSpeed (line 75), all hand-authored Sol planet `rotationSpeed` values.
  - `src/generation/StarSystemGenerator.js` — procedural planet `orbitSpeed` (line 358).
  - `src/generation/MoonGenerator.js` — procedural moon `orbitSpeed` (lines 144, 263).
  - `src/generation/AsteroidBeltGenerator.js` — procedural asteroid `baseSpeed` (line 122).
  - `src/generation/PlanetGenerator.js` — procedural planet `rotationSpeed` (line 394).
- Hardcoded-rotation rewrite at `src/objects/Moon.js:591` (`0.167` deg/sec → realistic value, sourced from `data.rotationSpeed` if present, falling back to `CelestialTime.MOON_ROTATION_DEFAULT`).
- Setting key rename in `src/ui/Settings.js`: `orbitSpeedMultiplier` → `celestialTimeMultiplier`. Default value is **deferred to Max** per Drift Risk #1.
- One-time localStorage migration logic so existing users with the old key don't lose their preference.
- `main.js` consumer-site updates:
  - Replace `const orbitDt = deltaTime * settings.get('orbitSpeedMultiplier')` (line 5789) with `const celestialDt = deltaTime * settings.get('celestialTimeMultiplier')`.
  - Pass `celestialDt` (not `deltaTime`) to:
    - `entry.planet.update(celestialDt)` at line 5810 area (currently raw `deltaTime`)
    - `moon.mesh.rotation.y += 0.167 * (Math.PI / 180) * celestialDt` at `Moon.js:591` (currently raw `deltaTime`)
    - `a.angle += a.orbitSpeed * celestialDt` at `AsteroidBelt.js:214` (currently raw `deltaTime`)
  - Existing planet orbit position update (line 5810) and moon orbit position updates (line 5839+) already use `orbitDt`; they get renamed to `celestialDt` (no behavioral change at those sites beyond the rename).
- Slider HTML rewrite at `index.html:164`:
  - `<input type="range" data-setting="celestialTimeMultiplier" min="0" max="40" step="1">` mapped via JS to `multiplier = Math.pow(10, value/10)` — gives log-uniform slider position across 1×–10000×.
  - Display label updates live (existing `<span class="setting-value">` already wired to settings change events; verify the formatter handles the log mapping).
- Slider value formatter update in `main.js` (around line 2017 area where existing settings labels are formatted) to format the new range with the `N×` convention.
- Telemetry export (autopilot `runAllReckoning` helper at `src/auto/telemetryReckoning.js`) auto-captures `celestialTimeMultiplier` value when emitting an audit JSON, so future Tester comparisons have the multiplier in their evidence.

## Out of scope

- **Per-system speed overrides.** A future feature might want different multipliers for different systems (e.g., Sol at realistic, procedural systems at compressed). Out of scope here; this workstream ships one global multiplier.
- **Time-rewind / scrub UI.** Scrolling backward through orbital state, stepping forward by named intervals (e.g., "show me eclipse phase"), pause-and-resume — all out of scope.
- **Eclipse-precise orbital phasing.** Bringing two bodies into perfect alignment for a cinematic eclipse moment requires sub-frame phase control, not just speed scaling. Future feature.
- **Realistic axial tilts / obliquity precession.** Some Sol planets carry authored axial tilts in `KnownObjectProfiles.js`. This workstream does not touch tilt or precession — only rotation rate.
- **Realistic distances / scale-system overhaul.** `MAP_BASE = 12` (line 19 of `SolarSystemData.js`) compresses interplanetary distances. The Bible's §10 Scale System explicitly compresses scales for visual drama. This workstream **does not** uncompress distances — it makes time realistic relative to the compressed-scale orbit radii. AC #1's "1 year for Earth orbit" means: at the current Earth orbit radius (compressed), at the realistic angular speed for that compressed-radius Kepler relation. Uncompressing distances is a different feature surface (see `docs/PLAN_world-origin-rebasing.md` parking-lot).
- **Autopilot tuning re-pass.** §A4–§A7 cruise/approach/lhokon parameters were calibrated against accelerated motion. If the felt experience shifts at realistic speeds (Risk #3), that's a follow-up workstream after Max evaluates.
- **Per-body axial-rotation realism authoring.** `KnownObjectProfiles.js` may carry authored rotation periods for known Sol bodies. PM defers the question of "do those override the procedural rotation realism, or do they get scaled too?" to working-Claude during implementation — both shapes are valid; pick the one that lets the existing data flow through cleanly. Document the choice in commit message.
- **Saved-fresh-install default value for `celestialTimeMultiplier`.** Working-Claude asks Max during implementation per Drift Risk #1.

## Implementation plan

PM-suggested ordering (working-Claude revises as needed):

1. **Author `src/core/CelestialTime.js`** with constants:
   - `ORBIT_REALISM_FACTOR = 1 / 6280` (current ÷ realistic for Earth orbit at MAP_BASE)
   - `ROTATION_REALISM_FACTOR = 1 / 24` (current ÷ realistic for Earth rotation at 0.1 deg/sec)
   - `MOON_ROTATION_REALISM_FACTOR` (compute from current `0.167` deg/sec → realistic moon rotation; the math: real Moon rotation period = 27.3 days = 2.36e6 s → `360 / 2.36e6 ≈ 1.52e-4` deg/sec → factor `0.167 / 1.52e-4 ≈ 1100`. Working-Claude: verify with Max whether to use the canonical-Earth-Moon period or generalize across moons.)
   - Helper `realisticOrbitSpeed(currentValue) = currentValue × ORBIT_REALISM_FACTOR`
   - Helper `realisticRotationSpeed(currentValue) = currentValue × ROTATION_REALISM_FACTOR`

2. **Update generation-site values** to apply realism factors at authoring time. This is a multiplication at the value-emission site, not a structural change. Keep the relative shape (Kepler scaling, jitter coefficients) identical; only the absolute baseline shifts. Affected files listed under `## In scope`.

3. **Rewrite `Moon.js:591` hardcoded `0.167`** to read from `data.rotationSpeed` (if `MoonGenerator` carries it) or from `CelestialTime.MOON_ROTATION_DEFAULT`. The site goes from `0.167 * (Math.PI / 180) * deltaTime` to `(this.data.rotationSpeed ?? MOON_ROTATION_DEFAULT) * (Math.PI / 180) * celestialDt`.

4. **Rename setting + add migration.** In `src/ui/Settings.js`, change DEFAULTS key to `celestialTimeMultiplier`. **Ask Max for the default value** (Drift Risk #1). Add migration logic: on Settings load, check localStorage for old `orbitSpeedMultiplier` key; if present and new key absent, copy old value into new key + remove old key.

5. **Update `main.js:5789` consumer site.** Rename `orbitDt` → `celestialDt`. Pass `celestialDt` to all celestial-update sites: planet rotation (was raw `deltaTime` at the `entry.planet.update()` call), moon rotation (was raw `deltaTime` inside `Moon.update()`), asteroid orbit (was raw `deltaTime` inside `AsteroidBelt.update()`). For the latter two, this requires either threading `celestialDt` through the call signature or having those `update()` methods read the multiplier from settings directly. Working-Claude picks the cleaner shape — Principle 5 favors threading (data flows down through the pipeline, not pulled up from a global), but if the call-site change is heavy, a settings-read at the top of each `update()` is acceptable as long as it's documented.

6. **Update slider HTML at `index.html:164`** to log-scale shape: `min="0" max="40" step="1"` with JS-side mapping to `Math.pow(10, value/10)` for the multiplier value. Slider label changes from "Orbit Speed" to "Celestial Time".

7. **Update slider value formatter** in `main.js` (around line 2017 area) to format the multiplier as `N×` with appropriate rounding.

8. **Update telemetry export.** `src/auto/telemetryReckoning.js` `runAllReckoning` should include `celestialTimeMultiplier` in its emitted JSON (so future Tester audit comparisons have the multiplier in their evidence).

9. **Run autopilot Sol tour at multiplier 1× + 1000×.** Capture telemetry for AC #5 + AC #6 verification. Capture screenshots / video if Max wants felt-experience evidence.

10. **Invoke Tester.** Tester verifies all 9 ACs.

## Handoff to working-Claude

Read the parent feature doc `docs/FEATURES/autopilot.md` §"Per-phase criteria — ship axis" to understand how cruise/approach/station phases consume celestial body motion. Read `docs/GAME_BIBLE.md` §2 Aesthetic + §4A Physics-Driven Generation to ground the realism rule in the Bible's articulated principles. Read the §A7 audit at `~/.claude/state/dev-collab/tester-audits/autopilot-camera-ship-decoupling-2026-04-25.md` to understand what telemetry surface AC #5 reads against.

Verify code-survey claims at HEAD before authoring constants. The realism factors (`1/6280`, `1/24`, `~1/1100` for moon rotation) are PM's derivations — sanity-check the math against actual Earth/Moon physical periods before committing.

Before implementing step 4, ask Max for the saved-fresh-install default value for `celestialTimeMultiplier`. Three named candidates: 1× (true realistic), 100× (compressed-realistic), 1000× (cinematic — Mercury orbits in ~2h, Earth in ~9h). Don't ship without his answer. Record the answer in the brief footer and the commit message.

Set the active-workstream pointer to this slug at implementation greenlight:
```
~/.claude/state/dev-collab/set-active.sh well-dipper realistic-celestial-motion-2026-04-27
```

Do NOT set it now — the §A8 amendment to `autopilot-camera-ship-decoupling-2026-04-25` is in flight; that pointer holds until §A8 Tester verdict completes.

Initialize the gate-state entry in `~/.claude/state/dev-collab/state.json`:
```json
"realistic-celestial-motion-2026-04-27": { "edits": 0, "last_audit_sha": "" }
```

After implementation:
- Invoke `Agent(subagent_type="tester")` with this brief path + the implementation diff.
- On Tester PASS → working-Claude commits and surfaces the demo to Max (autopilot Sol tour at multiplier 1×, 100×, 1000×, 10000× — let Max evaluate the felt experience at each register).
- After Max evaluates: flip status to `Shipped <commit-sha>` if no felt-experience callbacks; otherwise capture parking-lot items for follow-up workstream.
- On Shipped: clear active-workstream pointer for well-dipper.

"Done" looks like: realistic by default at the chosen anchor, slider scales celestial time across 4 orders of magnitude, every celestial site obeys one consistent multiplier, telemetry exports the multiplier value alongside its observations, autopilot lhokon body-lock drift collapses below FP noise at the realistic anchor, APPROACH overshoot suppressed at realistic, reproducible at 1000× (proving cause).

## Cross-references

- Sister workstream (parallel-authored): `docs/WORKSTREAMS/autopilot-camera-ship-decoupling-2026-04-25.md` §A8 amendment.
- §A7 audit (telemetry baseline for AC #5): `~/.claude/state/dev-collab/tester-audits/autopilot-camera-ship-decoupling-2026-04-25.md`.
- Game Bible refs: §2 Aesthetic — Era & Vibe; §4A Physics-Driven Generation — Design Principle; §11 Development Philosophy — Principles 2, 5, 6.
- Memory: `feedback_refactor-telemetry-over-video.md` (telemetry-class verification shape applies to ACs 1–5, 9).
