# Parking Lot

Cross-workstream deferred items. Each entry names the originating
workstream and the specific surface that needs revisit. Future
workstreams pull from here when their scope intersects.

---

## P1 — MoonGenerator: per-moon authored `rotationSpeed`

**Origin:** `realistic-celestial-motion-2026-04-27` Tester §T2 open
question (audit log §"Open questions surfaced").

**Symptom:** `MoonGenerator` emits each moon with an `orbitSpeed` but
no `rotationSpeed`. `Moon.js` falls back to
`MOON_ROTATION_DEFAULT_DEG_PER_SEC` (the realistic Moon-equivalent
constant, ~27.4-day period). Result:
- All procedural moons across all systems rotate at Earth's-Moon's
  period (27.3 days).
- Sol's hand-authored moons in `SolarSystemData.js` similarly fall
  back to the default — Phobos (real period 7.7h) and Deimos (real
  30.3h) currently rotate as if tidally-locked at Moon's period.
- AC #9 (tidal-locking ratio invariance) passes by construction
  because both rotation and orbit scale with the multiplier — the
  AC's worded test holds; the deeper "rotation_period == orbit_period
  for tidally-locked moons" semantic is partial.

**What a follow-up would do:**
1. Extend `MoonGenerator` to author per-moon `rotationSpeed`. For
   tidally-locked moons (the default for non-captured moons), set
   `rotationSpeed = (orbitSpeed × 180/π)` so rotation period equals
   orbital period exactly. For captured / non-locked moons, draw
   from a realistic distribution (e.g., 4–60h period range).
2. Author per-moon `rotationSpeed` for hand-authored Sol moons in
   `SolarSystemData.js` matching real periods (Phobos 7.65h, Deimos
   30.3h, Io 1.77d, Europa 3.55d, Ganymede 7.15d, etc.).
3. Verify Tester `data.rotationSpeed` reads on every moon return a
   real-period value, not the default constant.

**Scope:** small refactor + lots of authored data. Single workstream.

---

## P2 — APPROACH overshoot reproduction at high celestialTimeMultiplier

**Origin:** `realistic-celestial-motion-2026-04-27` AC #6
(regression-class catch). Tester §T1 + §T2 audit logs.

**Symptom:** Max reported visible APPROACH overshoot on moon legs at
HEAD `01caf00` (pre-realistic-motion, accelerated celestial speeds).
The realistic-motion AC #6 expected: at multiplier `1×`, overshoot
suppressed; at `1000×`, overshoot reproduces (proving the celestial
speed is the cause, not a separate bug). Tester captured 3 moon legs
at 1000× and **did not reproduce overshoot**.

**Possible explanations (Tester's framing):**
- Autopilot §A4 (per-frame predicted-intercept re-aim) and §A7
  (cruise-prep recompute at lhokon exit using post-lhokon ship
  position) may already structurally suppress overshoot
  independently of celestial speed.
- Sample-coverage gap — Tester's tour warped out of Sol mid-capture;
  needs a Sol-locked tour with multiple inner-moon legs to surface.

**What a follow-up would do:**
1. Author a Sol-only stable autopilot loop (no warp out) so Max can
   observe many leg cycles at fixed multiplier.
2. Capture moon-leg APPROACH→STATION-A trajectories at multiplier
   `1×`, `100×`, `1000×`, `10000×` and compare distance-to-body
   curves. If overshoot is genuinely structurally suppressed by §A4
   + §A7, then AC #6 of `realistic-celestial-motion-2026-04-27`
   should be re-amended to reflect that — overshoot at 1000× is no
   longer expected.
3. If overshoot DOES reproduce at extreme multipliers (e.g., 10000×
   on inner moons), that becomes the §A4/§A7 followup workstream
   tuning the cruise-prep recompute or the APPROACH lerp endpoint to
   handle very-fast-orbiting moons.

**Scope:** investigation first. Resolution may be brief amendment,
not code change.

**Cross-reference:** §A8 amendment of
`autopilot-camera-ship-decoupling-2026-04-25` flagged the same
moon-overshoot report under its §"Deferred decisions" with the same
"may resolve via realistic-celestial side effect" note. This
parking-lot entry supersedes — telemetry didn't conclusively show
side-effect resolution.
