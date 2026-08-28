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

---

## P6 — Cockpit shadows: nothing casts, inside or in

**Originating workstream:** cockpit-into-helm-2026-07-30 / the HELM cockpit program
(Max, 2026-08-01, raised while ruling on the post-UAT items).

**Max's words:** *"the lighting in the cockpit works from the pov from the sun but shadows
aren't casting properly — the cockpit isn't casting shadows internally and i don't think
other system objects are casting shadows onto the cockpit."*

**Two distinct halves, and they may have different causes:**
1. **Internal self-shadowing.** The cabin does not shadow itself — a monitor arm, a rib or the
   console should darken what is behind it relative to the star. The geometry is there (the
   cabin mask work counts 782 faces / 45 meshes), so this is a shadow-map/material question,
   not a missing-geometry one.
2. **External casters.** System bodies (planets, moons, the star's occluders) do not cast onto
   the cabin interior. Whether they *should* is partly a design call — a planet shadowing the
   cockpit interior is a strong effect and may not be wanted at every scale.

**Known-relevant context, not yet investigated:**
- Direction is already right: Max confirms the lighting reads correctly from the sun's POV, so
  the light's placement/orientation is not the bug — only the shadow pass.
- `_cockpitKeyLight` is exposed on `window` (see the cockpit globals) — the likely entry point.
- The cockpit renders through a SEPARATE pass from the world (the cabin-mask work relies on
  exactly that: two passes sharing only the screen). ⚠ **A shadow crossing from world objects
  onto cabin geometry therefore crosses a pass boundary** — that is probably the whole
  difficulty of half (2), and it should be scoped before anyone starts.
- Scene-level DirectionalLight + AmbientLight exist per FEATURES.md's ship-scale notes.

**What a follow-up would do:** establish which lights have `castShadow`/`receiveShadow` set and
whether a shadow map is being rendered for the cockpit pass at all; fix (1) first since it is
self-contained within one pass; treat (2) as its own scoped decision.

**Scope:** rendering/lighting, cockpit pass. Multi-system if (2) is taken on (world pass ↔
cockpit pass). Not started; nothing built.

---

## Star↔planet barycentres — the star's own wobble (filed 2026-08-19, Max's ruling)

**Status: FILED, not started. ⭐ Max wants it CONSIDERED BEFORE the rotor-fuel / gravity-well
minigame** (`FEATURES.md` GAME tier), because *"realistic barycenters would be a cool enrichment to
that system."* The link is real, not decorative: the minigame's whole premise is dipping into a
gravity well for net-positive energy yield, so where the well's centre actually sits — and whether
it moves — is a gameplay quantity, not a cosmetic one.

**What is already modelled** (established by reading every line at `baa4935`):

| pair | modelled? | where |
|---|---|---|
| planet ↔ its moons | ✅ **universally, no gate at all** | `main.js:11267` + `:7733` |
| binary stars ↔ each other | ✅ closed-form split, not `barycentreOffset` | `main.js:7543`, `:11244` |
| **star ↔ its planets** | ⛔ **not modelled anywhere** | — |

⭐ The planet↔moons offset has **no `if` on it** — not dominance, not mass ratio, not a flag. Every
planet, every frame. `DOMINANCE_THRESHOLD = 0.99` gates only whether the pair gets RINGS about the
empty point, and `Barycentre.js:31-37` says why in its own words: *"NOT a physics cutoff … a
statement about what a CIRCLE can describe."*

**Why it is filed rather than built.** The physics is nearly free — `barycentreOffset` is already
generic over "a body plus things orbiting it" and would take planets in place of moons unchanged.
The cost is everything that READS the star position: lighting, `starKeepOutInfo`, warp targeting and
the autopilot. Moving the star is a real blast radius for a visual payoff of ~1 stellar radius on a
body drawn a few pixels across at system view. **It is a correctness/plausibility increment, not a
visual one — and it becomes a GAMEPLAY one the moment the rotor-fuel minigame exists.** That is the
moment to build it.

⚠ For scale, general astronomy and NOT measured from this codebase: the Sun–Jupiter barycentre sits
*outside the Sun's surface*, around 1.07 solar radii out.

**⛔ Scope it before coding.** 2+ systems (physics ↔ lighting ↔ nav/autopilot ↔ keep-out), so it wants
`dev-collab-scope`. A live decision to settle first: whether the system ORIGIN stays the star or
becomes the star-plus-planets barycentre — the rings are already drawn about the latter.

---

## Sol's missing masses — ship as-is, fix the DATA as its own increment (ruled 2026-08-19)

**Max ruled: agreed — ship as-is, fix Sol's mass data as its own increment.** *(Raised as an open
question across three sessions; closed here.)*

**The defect is the DATA, not the barycentre code.** `SolarSystemData.js` carries **zero**
`massEarth` fields, so `BodyMass.planetMassEarth`'s `?? estimateMassEarth(…)` fallback arm is what
keeps every Sol planet from going NaN — that arm is load-bearing and must not be "cleaned up".
With masses estimated rather than authored, **19 of Sol's 26 moons imply impossible bulk densities,
up to 15.8× Earth**, and the barycentre term consequently makes:

| body | wobble, in its own radii |
|---|---:|
| Pluto | **7.447** |
| Eris | **4.644** |
| Earth | **1.271** |
| Saturn | **0.530** |

Earth wobbling 1.27 of its own radii is wrong by a factor of ~1.3 (the real Earth–Moon barycentre is
*inside* the Earth, ~0.74 R⊕ from centre). Pluto's is genuinely outside its own body in reality, so
that row is qualitatively right and quantitatively unchecked.

**⛔ Why it is NOT fixed inside the moon window.** Editing Sol's records mid-window risks reddening
`port-condition-contract.test.js`, **which has no re-bless mechanism** — so a data edit there is a
hand-repair with no safety net, taken while every other instrument is already red by design and
could not distinguish the new breakage from the expected one.

**What the increment does:** author real `massEarth` on Sol's planets and moons from published
values, then re-derive the wobble table and check it against the four rows above. Cheap, isolated,
and it needs the window CLOSED (post-B7) so the instruments can actually witness it.

---

## P7 — ExoticOverlay strips world-engine provenance from 5 of 800 planets

**Origin:** the 2026-08-28 queue-(a) reconnaissance workflow. Found by an adversarial
refuter looking for something else; not on anyone's list before that.

**Symptom, measured.** `src/generation/ExoticOverlay.js:401` does
`planetEntry.planetData = newData;`, replacing the record built at
`StarSystemGenerator.js:563` and never re-applying the `_systemSeed` / `_ordinal`
provenance stamped onto it at `:566-567`. Over seeds 1–200 / 800 planets: **5 planets
have `_systemSeed === undefined`, all of them `crystal`** (seeds 70, 93, 109, 181, 192).
Those bodies are refused by `worldEngineProvenance` and never reach the shared pipeline.
`labMacroSeed` (`Planet.js:2248`) also degrades for them — it hashes the literal string
`"undefined:undefined"`, so all five would share one macro seed if they were admitted.

**⛔ THE COST IS NOT ONE LINE, AND THAT IS WHY THIS IS PARKED.** The fix itself is a
line-neutral two-assignment append at `:401`. Its blast radius is not:

- **Instrument B reds, on TWO arms.** MEASURED: the tree currently holds exactly **two**
  `planetData` key-sets — 795 records at 36 keys and **5 at 34**, differing by exactly
  `_systemSeed` and `_ordinal`. Re-stamping collapses two shapes into one, so `planetShapes`
  moves (RECORD SHAPE) and those 5 planet hashes move (BODY IDENTITY). Needs a named re-bless.
- **Instrument C reds structurally.** Those 5 bodies flip from the 74-uniform legacy material
  to the lab material, so the watched-value set changes on their rows. Needs a re-record.
- ⚠ The 2026-08-18 B5.0 record (`moon-formation-b4-prediction-2026-08-17.md` §8.7 trap 1)
  relies on the strip: it states `selectsBinaryCompanion` **cannot** be re-evaluated against
  `generate()`'s output, and that re-evaluating it is "short by exactly one row on FENCE-221"
  *because* ExoticOverlay strips these keys. Fixing the strip makes that predicate
  re-evaluatable and quietly invalidates a written invariant. **Read §8.7 before touching it.**

**Owner's ruling, 2026-08-28:** *"Crystal types are not yet developed enough to worry about."*
Said in answer to a visual-regression caution, before the instrument cost above was measured.
Deferred on the cost, not on the ruling — the ruling removed the only reason to hesitate about
how the five bodies would LOOK.

**When to pull it:** bundle with the next Instrument B/C re-bless that is happening anyway,
so the population move is one reviewed event instead of two. Do NOT take it as a standalone
commit — re-opening both instruments for five undeveloped bodies is the wrong trade, and a
re-bless whose only content is five crystal planets is a re-bless nobody can attribute later.
