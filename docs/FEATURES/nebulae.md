# Nebulae

**Systems touched:** rendering-sky, generation-galaxy, galactic-bodies, warp

## One-sentence feature

Nebulae as background galactic features — placed by the galaxy
generator, rendered as procedural billboards in the sky from a
distance, and (target state) immersively dominating the view when the
player is inside or just outside one.

## Tier + status

F&F-MVP. One in-flight row (visual quality) + three proposed rows
(immersive presence, warp-as-target, reflection nebulae as a new
class). Visual evaluation is Max's; Claude works algorithmically and
reference-anchored, within the project's low-fi / dithered / retro
envelope.

## Code surface

- **Generation:** `src/generation/NebulaGenerator.js` (248 lines —
  procedural nebula placement within the galactic disk) and
  `src/generation/NavigableNebulaGenerator.js` (287 lines — variant
  generator for nebulae that can be warp-targets / navigated to).
- **Display:** `src/rendering/sky/SkyFeatureLayer.js` (1307 lines —
  sky-side procedural billboard layer for nebulae and other sky
  features). 6 procedural SHAPE_MODE entries at lines 39-46:
  `irregular`, `ring`, `bipolar/bilobed`, `filamentary`, `shell`,
  `diffuse`.
- **Object class:** `src/objects/GalaxyNebula.js` (221 lines).
- **In-game presence today:** when the player's position is
  `insideFeature`, `SkyFeatureLayer.js:96` skips the billboard
  entirely and applies a 0.15-strength ambient color tint
  (`SkyFeatureLayer.js:97-102`). TODO at line 95:
  *"Future: immersive mode wraps the feature around you instead."*
  Unbuilt.

## Player Beats — F&F-MVP

### Visual quality

- **As a viewer, I want each nebula to feel like its own object —
  organic, varied, with no obvious cookie-cutter repetition — so I
  can feel the galaxy is full of singular places worth noticing.**
- **AC:** Across a single galaxy traversal session, no two visible
  nebulae read as obvious copies; cloud/filament edges feel soft and
  organic; the 6-mode shape pool isn't visually exposed as a finite
  set. Within retro envelope. Max-verbatim failure language:
  *"kind of messy, and there's lots of repeated shapes and
  unfinished stuff there."*
- **Code anchor:** `SkyFeatureLayer.js:39-46` SHAPE_MODE pool — six
  modes is the structural ceiling unless either (a) the pool
  expands, or (b) per-mode procedural variation (noise seeds, color
  variations, asymmetry parameters at line 170) increases enough
  that two same-mode instances rarely read as siblings.

### In-game presence — immersive geometry wrap

- **As a viewer, I want being inside or right outside a nebula to
  visibly dominate the sky — to change what it feels like to be in
  the starfield — so I can feel that I'm somewhere different, not
  just in space with a faint tint.**
- **AC:** When the player is inside a nebula (or within an
  "approach" range outside one), the nebula renders as an immersive
  volume / sky-wrap around the camera, not as a distant billboard or
  flat ambient tint. The starfield is visibly affected. Approach +
  exit transitions feel continuous, not popped. Direction confirmed
  2026-05-25: **full immersive geometry wrap** (not lighter
  alternatives like stronger-tint + parallax-billboard).
- **Code anchor:** unbuilt. Today's branch
  (`SkyFeatureLayer.js:92-102`) skips the billboard when inside and
  applies a 0.15-strength ambient tint. The 0.15 is the entire
  current "you're inside" indication.

### Nebula-as-warp-target

- **As a player, I want to select a nebula from the starfield, warp
  to a point just outside it, and have it dominate the view on
  arrival — so I can feel the game's destinations include named
  places that aren't stars, and so the immersive nebula presence
  has somewhere it's the headline event.**
- **AC:** Visible nebulae from the current vantage are selectable by
  the same input flow that selects stars for warp targeting; warp
  resolves to a positioned arrival point just outside the nebula
  boundary; on arrival, the nebula is the dominant visual element
  in the sky. Doubles as the functional test for immersive presence
  (above).
- **Dependency:** Immersive in-game presence (above) must ship
  first; without it the "dominates view on arrival" criterion
  collapses to today's 0.15 tint.

### Reflection nebulae as a new object class

- **As a viewer, I want some nebulae to read visually distinct from
  the emission/dust nebulae that dominate today — soft scattered
  starlight color, not glowing gas — so I can feel that the galaxy
  has more than one kind of cloud in it.**
- **AC:** A new `FEATURE_TYPES` dict entry exists for reflection
  nebulae with its own color/shader register (cool, diffuse,
  scattered-starlight palette — distinct from emission-nebula
  pinks/reds and supernova-remnant ring greens). Procedural
  placement integrated with NebulaGenerator. At least one shape
  mode or per-mode tuning that reads as "reflection nebula" not
  "another emission nebula." Within retro envelope.
- **Code anchor:** Per FEATURE_AUDIT §2.10 + §3.1 (now archived);
  also referenced from FEATURES.md Nebulae section. Implementation
  is one entry into the type dispatch + paired shader/palette work
  in `SkyFeatureLayer.js`.

## Player Beats — ENRICHED / GAME

None additional at this tier.

## Open questions

- **Immersive-wrap technique** — sphere-with-volumetric-shader,
  raymarched volume, particle-cloud system, or layered parallax
  shells? Each has different perf + visual + integration profiles;
  PM-scoping the immersive-presence workstream should pick one with
  an explicit rationale. Max-named target is "full immersive,"
  technique-agnostic.
- **Approach-to-immersive transition** — at what range does the
  billboard fade out and the immersive layer fade in? Should there
  be an overlap region, a hard swap, or a continuous LOD? Affects
  whether "approach" reads as continuous or popped.
- **Nebula-as-warp-target arrival framing** — "just outside" needs
  a definition (some multiple of nebula radius? a "good view" angle
  selection?). Defer to PM-scoping; not blocking.
- **Reflection nebulae color/shader register** — needs a reference
  pass (real reflection-nebula photos like the Pleiades cluster's
  blue haze) before authoring the shader register, so the visual
  target is anchored.

## Workstreams

None scoped yet. Three workstream candidates fall out of this deep dive:

1. **Nebula visual-quality pass** — expand shape pool variance OR add
   per-mode procedural variation so the 6-mode ceiling stops reading
   as repetition.
2. **Immersive nebula presence** — replace `SkyFeatureLayer.js:96-102`
   inside-feature branch with an immersive geometry/volume render.
   Prerequisite for (3).
3. **Nebula-as-warp-target** — wire nebula selection into the
   star-selection / warp pipeline. Depends on (2).

Reflection nebulae as a new class is a fourth workstream candidate
but lower priority — additive object class, doesn't unblock other
work.

## See also

- `docs/FEATURES.md` — parent inventory section: *Nebulae* (4 rows).
- `docs/FEATURES/galactic-rendering.md` — sibling sky-side deep dive
  (same `SkyFeatureLayer` host but different code path —
  `ProceduralGlowLayer` for galactic glow vs. `SkyFeatureLayer` for
  named features).
- `docs/SYSTEMS/rendering-sky/README.md` — not yet authored.
- `docs/_intake-2026-05-18-max-feature-status.md` §"Nebulas (TWO
  distinct issues)" — verbatim source for issues 1 + 2 + the
  warp-as-target ask.
