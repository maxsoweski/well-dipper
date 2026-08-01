# Parking Lot

**Transitional doc (2026-05-18).** Pre-v5 home for cross-workstream
deferred items. Under v5 these belong in `SYSTEMS/<sys>/README.md`
"Open Questions" sections. Each P-item below migrates to its target
system doc when that system gets authored:
- P1 (MoonGenerator rotationSpeed) → `SYSTEMS/generation-moon/README.md`
- P2 (APPROACH overshoot) → `SYSTEMS/autopilot/README.md`
- P3 (Galactic features disappear when near) → `SYSTEMS/galaxy-rendering/README.md`

Tracked in `JOURNEY.md` "Doc system completion" structural debt.
Delete this file once all three migrations complete.

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

---

## P3 — Galactic features (nebulae, etc.) disappear when very near

**Origin:** Max observation, 2026-05-01 (warp-features regression
investigation session). Recorded for future scoping.

**Symptom:** When the player gets very close to or inside a galactic
feature like a nebula, the feature disappears instead of being
visible huge on the horizon or surrounding the camera. Expectation
is that proximity should make the feature dominate the view, not
cull it out.

**Hypothesis surface (not investigated):**
- Distance-based LOD or culling threshold treats the camera-inside
  case the same as camera-far-away (both fall outside the "render
  band").
- Nebula geometry is a billboard or shell rendered only when viewed
  from outside; no near-field representation.
- Frustum / depth-write interaction — if the nebula is a shell with
  inverted normals or a single-sided billboard, entering it puts the
  camera on the wrong side of the geometry.
- Galactic-feature volumetric rendering may depend on a horizon
  distance assumption that breaks at zero distance.

**What a follow-up would do:**
1. Inventory how galactic features are currently rendered (probable
   files: `src/rendering/sky/*`, galactic-feature generation in
   `src/generation/`, any nebula-specific shader). Identify the
   distance-based render gate.
2. Decide design intent for near-field galactic feature rendering.
   Options: volumetric shader that holds at all distances; tiered
   representation (far billboard → mid shell → near volumetric);
   particle-cloud near representation; force-perspective scaling so
   the player never actually enters the feature even when nominally
   inside its bounds.
3. Implement and verify with an in-feature flythrough at multiple
   nebula sizes / types.

**Scope:** likely a feature-doc-class question first (what is the
intended near-field experience), then a sub-feature implementation.
Cross-feature scope — touches galactic-feature rendering AND any
other large galactic-scale phenomena that share the same gate.

---

## P4 — Reticles should LOOK projected onto the canopy, not just be cut by it

**Origin:** `reticles-on-the-glass-2026-08-01` (SHIPPED `d3dc4cb`,
Max UAT pass 2026-08-01). **This is the deliberate second half of that
ask** — Max split the work himself and took the geometry half first.
Explicitly named a non-goal of that workstream so it could not drift.

**What shipped:** the geometry. `src/cockpit/cabinMask.js` renders the
cabin's opaque meshes flat-white to an offscreen buffer each frame and
`TargetingReticle.update()` erases the overlay through it with
`globalCompositeOperation='destination-out'`. Every reticle is now CUT
at the real geometry's real edge — mid-glyph on a name label, at a
rib's own boundary. Canopy glass deliberately does not occlude.

**What is still missing.** Being cut correctly makes a reticle *sit
behind* the cabin. It does not make it look *painted on the canopy*.
The remaining tell is that the marks are still clean vector green
drawn at screen depth. Max's original words, which the geometry half
only partly answers:

> "what I want is for the moon/planet/star reticles to be occluded by
> the cockpit so that they look like a HUD on the glass on the cockpit
> rather than something drawn directly on the player's eye"

**Candidate surfaces** (none scoped, none costed):
- **Canopy tint** — the glass colours what is drawn on it, so the
  reticles pick up the pane they sit on rather than being colour-pure.
- **Glass-depth parallax** — the marks live on a physical surface a
  short distance from the eye, so they should shift slightly against
  the world as the head moves. Today they are locked to the world.
- **Phosphor rather than clean vector** — bloom, scanline interaction,
  slight persistence, so they read as *emitted by* the canopy layer
  instead of composited over it.

**Why it is not trivial.** All three want the reticles to participate
in the render rather than sit in a Canvas2D overlay above it. The
shipped workstream's `designDecisions` already records that moving
`TargetingReticle` into the WebGL pass is "the most correct answer and
the largest change" — deferred there, and this is the item that would
finally call it due. Expect the honest scoping answer to be a renderer
question, not an overlay one.

**Scope:** multi-system, premises genuinely open (is this a shader
pass? a second glass-layer render? a texture the canopy samples?) →
`dev-collab-scope` before any code, per the same reasoning that
governed the geometry half.
## P5 — Orbit ring cap: support procedurally complex systems

**Originating workstream:** `orbit-ring-conic-2026-07-21` (Max, 2026-08-01,
off the back of the AC7 inventory-swap drive).

**Want:** the proc engine free to spawn systems with many planets and moons
without the orbit renderer silently dropping rings.

**The limit.** `OrbitConicField` packs every ring into one RGBA32F DataTexture
sized `CONIC_MAX = 64` wide x `CONIC_TEX_ROWS` tall. `update()` clamps to
`Math.min(descriptors.length, CONIC_MAX)`, so a system with >64 orbiting bodies
loses rings — by design least-visible sub-pixel moons first (R9), but still a
hard ceiling on system complexity. Richest system observed to date: Sol at 39
rings; procedurals ran 2-11.

**⛔ NOT the problem — do not "fix" this.** Stale per-ring data from the previous
system persists in `_source` after a warp (measured: 38 non-zero entries past
`uCount`, indices 2-60). This costs NOTHING — the fragment shader's constant-
bound loop breaks at `i >= uCount` (`OrbitConicField.js:177-178`) so those slots
are never sampled, and the buffer is allocated once and reused for the whole
session. Clearing on swap would ADD a per-warp memory write for zero observable
benefit — a pessimization. Evidence:
`WORKSTREAMS/orbit-ring-conic-2026-07-21/evidence/live-ac7-inventory-swap-2026-08-01.md`.

**Why raising the cap is cheaper than it looks.** `uCount` is a uniform, so the
shader's early break is uniform control flow — per-pixel cost tracks the LIVE
ring count, not `CONIC_MAX`. Raising the constant costs texture memory only
(64 -> 512 rings is roughly 16 KB -> 128 KB) and nothing at runtime for ordinary
systems.

**The actual engineering problem.** All rings draw in ONE fullscreen pass, so
every pixel walks the entire ring list. At ~200 rings that is ~200 conic
evaluations per pixel, nearly all for rings nowhere near that pixel. This is what
would make a dense system chug — not the stale data.

**The answer is already specced and unbuilt:** the **R4 bounding-box pre-cull**
in this workstream's BUILD-PLAN, deliberately kept READY and not built ("not
needed on evidence"). Complex systems are the evidence.

**What a follow-up would do:**
1. Raise `CONIC_MAX` and size the DataTexture to match; confirm the packing
   offsets (`stride = CONIC_MAX * 4`) and `readConic` still address correctly.
2. Build R4 so cost tracks VISIBLE rings rather than total rings.
3. Decide whether the cap becomes dynamic (sized to the richest system seen) or
   simply a much higher constant.
4. Verify on a deliberately dense generated system — one must be constructed;
   none encountered in normal play exceeded 39 rings.

**Sequencing (Max, 2026-08-01):** deferred until the lane B UAT ships and the
merge arc lands. Do NOT touch `OrbitConicField.js` before then — it is the
renderer under UAT.

**Scope:** single-system (orbit rendering) but with a real perf-architecture
decision; warrants `dev-collab-scope` before code.
