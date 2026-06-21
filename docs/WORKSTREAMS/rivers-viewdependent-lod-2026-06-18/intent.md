# rivers-viewdependent-lod — intent

> **Phase-5 role (2026-06-20):** this workstream IS "WS5 — view-dependent rich tier" in
> [`../../FEATURES/planet-lod-phase5-integration-plan.md`](../../FEATURES/planet-lod-phase5-integration-plan.md).
> The audit's resolution-capped couplings (glacial U-valley carving, dune orientation/echo dunes,
> gorge depth) land here — cross-linked, NOT duplicated into the Phase-5 plan.

**Spin-off from** `rivers-dendritic-drainage-2026-06-17` (see its AC6 scope clarification, 2026-06-18).
Serves the SCREENSAVER-MVP heart (planets are the hero objects). Lab-renderer R&D; game-port deferred per
`docs/FEATURES/planet-lod-CHARTER.md`. **This is a SPIKE-FIRST workstream** — its job is to prove a
close-approach river mechanism in an isolated harness before any production build is scoped.

This builds **on top of** the existing global dendritic overlay, which becomes the LOD-independent
**"authority"** (the coarse global drainage the view-dependent layer amplifies from).

## Why we care (Max's words)

> "Realistic at terrestrial scale really means here: realistic from the POV of a spacecraft."
>
> "As close as a spacecraft can get without falling into the planet's gravity … I'm thinking of Elite
> Dangerous — you can get close enough before entering the atmosphere that the planet fills up the viewport."

The existing rivers are baked into ONE global 40k-vertex mesh. From a spacecraft on close approach (planet
fills the viewport, just above the atmosphere) that floors channels at ~140 km spacing and ~14 km minimum
width — so rivers render as continental-width gashes that **make a big planet look small**, the opposite of
realistic. We want rivers that read as real rivers from a spacecraft across the whole approach: thread-thin
and numerous up close, faint-to-invisible from far orbit (like Earth from space), with no popping in between.

## Success criteria (Max's language)

- Rivers **look realistic from a spacecraft at the closest approach** — when the planet fills the viewport —
  not fat continental gashes.
- They **don't make a big planet look small** — they read as correctly sized for the body.
- They **sit and drain correctly on the real terrain** at that scale — following the actual valleys into the
  seas, pooling where they should — same as the world we already approved up close.
- Consistent as you move: the rivers **don't pop, swim, or shift** as you fly in and out.

## Scope decisions (Max, 2026-06-18; mechanism details derived from the 2026-06-18 prior-art scan in `research/`)

- **Spike-first.** Prove the mechanism in a standalone harness (`rivers-viewdependent-lab.html` or similar)
  BEFORE touching production. Per the isolated-test-harness rule: if it doesn't work in isolation, no
  production integration can save it. 3-cycle cap on any uncertain technique — if Dendry+SDF fails 3
  research→build→test rounds, stop and try the next candidate, don't death-spiral.
- **Architecture is forced, not chosen (research-confirmed):** routing is inherently GLOBAL (drainage area
  needs the whole upstream network — the code map confirms our priority-flood/Strahler route can't be
  decomposed per-chunk), so **keep the existing global route as the coarse authority** and **deterministically
  amplify fine local detail** for the visible patch, conditioned on it. Do NOT regenerate rivers per-chunk
  (that is what causes popping/shifting).
- **First mechanism to spike: Dendry** (Gaillard et al., I3D 2019) — a locally-computable, position-seeded
  dendritic function driven by a coarse control function; demonstrated producing consistent river networks;
  open-source ref impl (`github.com/mgaillard/Noise`). Closest end-to-end precedent: Derzapf et al. 2011,
  "River Networks for Instant Procedural Planets." Consistency falls out of three scale-relative laws —
  Hack's law (h≈0.57), width ∝ drainage-area^~0.35, drainage density — all driven by pixels-per-km at the camera.
- **Rendering pivot to evaluate (reverses the global overlay's "ribbon, NOT SDF" decision):** at close
  approach a river is 1–3 px wide, and a sub-pixel ribbon mesh cannot be rasterized at correct width — it
  shimmers (MSAA doesn't fix it). The recommended first attempt is an **SDF field sampled in the surface
  shader** with analytic AA + a half-pixel width floor that fades alpha by true width; appearance-LOD = two
  continuous altitude-driven fades (projected-width visibility + atmospheric **contrast** loss — Earth's
  rivers vanish from orbit by contrast, not resolution). The spike validates SDF vs. ribbon empirically.
- **Integration = rivers sit/drain correctly in the composed terrain.** The router already reads the full
  combiner-chain `h` (read-coupling), so rivers already drain mountains/craters/etc.; extend that to the
  amplified scale.

## Deferred (named, out of scope here)

- **Physical back-coupling** — crater interiors hosting lakes, river mouths widening coastlines, lava/dunes
  burying or capturing valleys. The current one-pass bake reads terrain → river only (one-way snapshot); a
  terrain↔river loop needs a bake-order re-architecture. Named, deferred.
- **Production integration / the follow-on build** — scoped only AFTER this spike returns a go verdict.
- **Small-body / large-channel application** — outflow channels, chasmata, tectonic valleys on moons/icy
  bodies (genuinely hundreds of km wide and orbit-visible). Max's parked future hunch for reusing the global
  tech; not built now.
- **Game-port** — separate, no-parity, deferred per the CHARTER.
