# F51 Rings v2 — 3D LOD particle ring (design spec)

**Date:** 2026-06-13
**Status:** approved (Max, brainstorm pass) → implementation plan next
**Supersedes the substrate of:** F51 v1 (flat-annulus shader, commit `093523c`),
which Max rejected at UAT 2026-06-13 ("still looks pretty much like the old ones").
**Campaign:** Phase 4c rework, `docs/FEATURES/planet-lod-campaign-tracker.md`.
**Card:** `docs/FEATURES/cards/F51-rings.md` (§7 holds v1 verdict + rejection; this
spec drives the rewritten §6.5 build plan).

---

## Why (heart-of-desire / player-experience framing)

A ringed planet is one of the signature "wonder" silhouettes in Well Dipper. v1 made
the ring read as a flat decal — fine at a glance, but it collapsed the moment you
looked for depth. Max wants rings that read as **genuine 3D objects that interact with
the scene dynamically and have their own LOD**: fly close enough and the ring should
**resolve into a dense field of individual glinting particles** with real depth and
parallax, not a painted band. This serves the "approach and be dwarfed by real things"
strand of the player experience.

## Scope decisions (locked with Max during the brainstorm)

1. **Purpose = "approach-but-not-through."** The player can fly close enough to clearly
   resolve individual particles (a flyby that fills the screen with a glinting cloud),
   but the rings are NOT a traversable gameplay space. **No collision, no fly-through
   traversal physics, no gameplay spatial-query systems.** This is the *rendering*
   problem only — middle budget: real particles near, impostor far.
2. **Particle look = point-sprite glints.** Dense glinting *cloud* with real depth and
   parallax — NOT individual hero boulders / faceted meshes. Each particle is a
   camera-facing posterized sprite. What makes it read as 3D is the *context* (real 3D
   positions in a disk with thickness, motion parallax, perspective size, per-particle
   shadow), not the sprite shape. Confirmed acceptable with Max after flagging that a
   sprite is a billboard.
3. **No hero chunks.** No third tier of real instanced meshes for the nearest particles
   (was offered, declined). If a flyby ever needs a boulder-past-the-cockpit moment,
   that's a future addition, not this build.
4. **Stay strictly inside the retro envelope** — 6-level posterize + Bayer dither, same
   as every other planet feature.
5. **LOD transition = Approach B (emergence, not swap).** See below.

## Architecture — two coexisting representations, one toggle

The ring is two objects sharing the existing `state.ringsEnabled` toggle (NO
FEATURES/PROVINCES registration — same as v1, so `tests/planet-archetypes.test.js`
stays untouched):

- **Impostor** — the v1 flat `RingGeometry` + fragment-shader annulus, **reused as-is**.
  Renders **always** when rings are on. It is the permanent "body" of the ring and the
  sole representation at distance. (v1 is not throwaway — the impostor is exactly what
  v1 already is; only its *role* changes from "the whole ring" to "the far tier.")
- **Cloud** — a new `THREE.Points` object layered on top, carrying per-particle detail
  that *emerges* near the camera.

Both tilt with the planet (`quaternion.copy(planet.quaternion)`) and read the same
object-space light direction.

### Component: cloud data (baked once)
A static `BufferGeometry`:
- **N points** (start ~80k, tune in the harness) distributed across the annulus by
  sampling the **same `generateRingPhysics()` density profile** the impostor uses —
  dense ringlets get many points, gaps get none. The cloud inherits the banded
  structure for free, and the seam where cloud fades into impostor stays invisible
  because both read the same profile.
- Points **jittered into a thin disk volume** (vertical thickness a few % of inner
  radius). This thickness is the parallax/depth cue that sells "3D" over "flat plane."
- Per-point attributes: random size seed, composition tint index, twinkle phase.

### Component: cloud shader (reuses the existing point idiom)
The codebase already renders dense posterized point clouds in `Galaxy.js`,
`Nebula.js`, `VolumetricNebula.js`, `StarfieldLayer.js`, `MilkyWay.js`,
`StarFlare.js` — reuse that idiom, raw `ShaderMaterial` (NOT TSL — the lab's
WebGLRenderer + ~45 raw ShaderMaterials are the house style; consistency wins).
- **Vertex:** perspective `gl_PointSize` attenuation (`size * scale / -mvPosition.z`);
  the **camera-distance LOD ramp** (each point's size+alpha scales full→zero between
  `dResolve` and `dCull`); per-point planet-shadow test (reuse v1's analytic cylinder
  occlusion) darkening/culling shadowed points.
- **Fragment:** posterized composition color (6-level), Bayer-dithered alpha, round-ish
  glint falloff with a subtle twinkle. Fully inside the retro envelope.

## LOD transition — Approach B: emergence, not swap (the crux)

Two distances parameterize the ramp:
- `dResolve` — camera this close → points full-size, individuals clearly readable.
- `dCull` — beyond this → points size→0, impostor alone carries the look.

Between them points fade in smoothly. **Because the impostor is always underneath,
there is no pop and no dissolve** — wherever points haven't faded in, the impostor
already shows the ring; points just add resolvable grain where the camera is close.
This is the design's whole reason for beating v1's rejection: detail *emerges in place*
rather than a representation being swapped.

First pass keeps the impostor at full alpha. If the near field looks doubled/too bright
where dense points sit over the impostor, fade the impostor slightly inside `dResolve`
(a one-line uniform ramp) — deferred until the harness shows whether it's needed.

### Budget strategy + escalation path
Start with a **single static point buffer covering the whole annulus**, sized by the
per-vertex camera-distance ramp (points far from the camera shrink to zero — cheap GPU
cull, no CPU work). If ~80k static points can't reach resolvable density at the closest
approach, **escalate to a recycled proximity patch**: reposition a fixed point budget
near the camera's region of the ring each frame (the classic "spend detail only where
the camera is" technique). Decide which from the harness — do NOT build the recycling
patch speculatively.

## Retro-pipeline gotcha

The lab renders to a low-res render target then nearest-blits up. `gl_PointSize` is in
RT-pixel space, so points come out chunky — which *suits* the retro look, but the
point-size budget is the real tuning knob. Verify point sizes against
`innerWidth`/dpr/RT-scale (per `memory/chrome-devtools-screenshot-scaling.md` — oversized
emulated viewports scale silently) so tuning isn't fooled by a scaling trap. May need a
per-point `gl_PointSize` clamp so the closest particles don't blow up into full-screen
squares.

## Build location — isolated harness FIRST

Per `feedback_isolated-test-harnesses` + the handoff: build a standalone
**`rings-lod-lab.html`** (planet + ring [impostor + cloud] + camera distance/pitch
sliders, nothing else) and prove the mechanism in isolation before touching
`world-engine-lab.html`. If the LOD-emergence mechanism doesn't work isolated, the
production/lab integration can't save it. Only after the harness proves out (resolves up
close, no pop on approach, clean shadow sweep, stable edge-on) does the cloud + ramp get
ported into `world-engine-lab.html` alongside the v1 impostor already there.

## Verification

- **Harness:** visual sweep far→near (impostor-only at distance → approach → resolves to
  a glinting particle field); planet-shadow bite sweeping the cloud; edge-on stability
  (no moiré/shimmer); ON/OFF delta total.
- **Lab (after integration):** same checks via the `:9223` GPU Chrome
  (`memory/well-dipper-testing-reference.md` — chrome-devtools, NOT Playwright; verify via
  `window.__wd.*`/`window._lab.*`, not image recognition).
- `npm test` (`npx vitest run tests/planet-archetypes.test.js`) must pass **unchanged**
  (no FEATURES/PROVINCES edits — the ring stays a standalone toggle).
- v2 verdict appended to card §7, superseding the rejected v1 entry; tracker F51 row +
  phase row updated.

## Risks

- **Density vs budget** — 80k static points may be too sparse to "resolve as particles"
  at closest approach → escalate to the recycled proximity patch. Resolved by the harness.
- **Seam** — cloud-fades-into-impostor edge must not show a ring-of-detail boundary →
  mitigated by both reading the same physics density profile + the emergence ramp.
- **Chunky points** from the RT downscale at the closest distances → per-point size clamp.
- **Grazing angle** — points seen edge-on through the disk thickness must stay stable;
  watch for overdraw/shimmer; the disk thickness helps (depth spread) but verify.

## Out of scope (YAGNI)

- Collision / fly-through traversal / gameplay queries.
- Hero instanced-mesh particles (third LOD tier).
- A dedicated ringed gas-giant DRIVER_PRESET (first light hangs the ring off the existing
  host preset, same as v1's `Frozen (airless)`); a real ringed preset is later polish.
- TSL / WebGPU migration (house style is raw ShaderMaterial on WebGLRenderer).
- Production `src/` integration — this is a lab/campaign feature; production wiring is a
  separate later workstream, and the shared-tree warp WIP in `src/` must stay untouched.
