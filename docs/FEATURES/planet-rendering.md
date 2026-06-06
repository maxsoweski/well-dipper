# Planet + moon generation + rendering

**Systems touched:** generation-planet, rendering-objects, celestial-bodies, generation-system

## One-sentence feature

Every planet and moon a player encounters — how it's generated (type
roll, parameters, surface history), how it's rendered (shader
dispatch, palette, LOD), and how it feels to discover (variety,
memorability, the impulse to save the system and come back).

## Tier + status

F&F-MVP. 10 rows in `FEATURES.md` Planet section — 4 in-flight
(pipeline, broken LOD2, exotic visuals, civilized visuals), 1 proposed
broad polish pass, 3 proposed wiring gaps (storms, surface history,
rings), 2 already shipped (Moon partial LOD2, asteroid belts). The
in-flight bucket is the largest single visual-polish surface in the
project.

Visual evaluation is Max's; Claude works algorithmically + reference-
anchored, within the project's low-fi / dithered / retro envelope.

## Register / references

Two named reference points for what "well-rendered planet variety"
looks like as a felt experience:

- **Elite Dangerous** — realistic palette range, biome variation per
  planet, surface texture continuity, atmospheric variety. The
  variable to study: what visual dimensions vary planet-to-planet
  that make each feel distinct without the player needing to read
  text.
- **No Man's Sky** — stylized but high-variety palettes, named
  biomes, atmospheric color combinations that produce visually
  memorable arrivals. The variable to study: how stylization can
  *amplify* variety rather than dampen it (relevant for the retro
  envelope, where realism is off the table but striking variety is
  still the target).

The retro envelope makes 1:1 imitation off-limits, but the *variable
space* (palette range, biome legibility, atmospheric distinctness,
surface signature) is what those references contribute.

## Code surface

- **Planet object:** `src/objects/Planet.js` (1335 lines) — generates
  procedurally + dispatches to shader by `planetType` integer (18
  types). Declares `uniform int lodLevel` at line 44, defaulted to
  1 at line 1077. TODO at line 857 for exotic perturbation:
  *"type-specific perturbation (hex grid relief, crystal facets,
  etc.)"* — only `shattered`, `fungal`, `city-lights` currently
  perturbed.
- **Moon object:** `src/objects/Moon.js` (642 lines) — separate
  generation/rendering surface; reads `lodLevel >= 2` at lines 355,
  441, 454, 459. **LOD2 implemented only for rocky/captured
  (`moonType == 0 || moonType == 1`)** at line 459 — ice/volcanic/
  terrestrial moons get the uniform but no LOD2 branch.
- **Body renderer:** `src/rendering/objects/BodyRenderer.js` —
  manages instancing + sets `lodLevel.value` on the procedural
  shader (line 175). Wiring is correct; consumption is the gap.
- **Rings:** `src/rendering/RingRenderer.js` exists (~312 lines per
  prior code sweep — 16 ringlets + 8 gaps support) but is **dead
  code** — `grep "new RingRenderer" src/` returns zero hits.
  Current ring rendering uses a simpler inline path.
- **Generator data unreaching shader:**
  `src/generation/PlanetGenerator.js` populates
  `planetData.storms.spots` + `polarStorm` for gas giants per
  FEATURE_AUDIT §2.1 archival, but no shader uniform reads
  these — the storm data is generated, never displayed.

## Player Beats — F&F-MVP

### Variety + memorability + the discovery-collection feel

- **As a player, I want to feel surprised and intrigued by new
  planets on a regular basis — distinct enough that I want to save
  the system and come back to it, as if I were collecting unique
  worlds — so I can feel the galaxy is full of singular places that
  reward the journey of finding them.**
- **AC:** Across a single ~30-minute session of warping between
  systems, the player encounters planets that read as visually
  distinct from one another (not "another red rocky"); the player
  has at least one moment of "save this system to revisit" per
  session. Operationalized via the visited-systems log
  (F&F-MVP, separate row) which captures what's worth saving.
- **Why this beat is the umbrella:** the other Beats below (all 18
  types renderable + first-class, polish, LOD2, wiring gaps) only
  matter to the extent they serve this felt experience. If every
  planet rendered perfectly but felt interchangeable, this Beat
  would still fail.

### All 18 planet types as first-class visual citizens

- **As a viewer, I want every planet type that the generator can roll
  to be recognizably *its own thing* visually — exotic types
  (hex/crystal/machine) and civilized types (city-lights / ecumenopolis
  / machine grid) as visually arresting as the rocky/gas-giant baseline
  — so the discovery-collection feel above can actually land.**
- **AC:** No planet type renders as a "lesser citizen" relative to
  rocky/gas-giant. Exotic geometric types have type-specific
  perturbation (closing the TODO at `Planet.js:857`). Civilized
  types have night-side emissive (city glow / machine grid) so
  they're visually distinct from inert rocks at terminator.
  Palette pools expanded — hot-jupiter from 4 entries to ~15;
  exotic types from 4 to ~20 (matches FEATURES.md row text;
  current pools per FEATURE_AUDIT archival).
- **Code anchors:** `Planet.js:857` exotic perturbation TODO;
  hot-jupiter + exotic-type palette tables in `Planet.js` (line
  numbers unverified — sweep when implementing).

### Visual polish across all types

- **As a viewer, I want every planet I see to feel like a finished
  artifact, not a placeholder — so my eye stays in the game and
  doesn't fall through to noticing "shader."**
- **AC:** Max-verbatim cross-cutting note from intake:
  *"these should be considered placeholders and still are not quite
  what I would want to be there for friends and family testing… I
  would want these to be more visually striking and interesting."*
  Success = no planet type currently in the placeholder bucket
  remains there at F&F ship time. Per-type pass — assess each of
  the 18 types against the same retro-envelope-but-striking bar.
- **Note:** This Beat overlaps with "All 18 types first-class" but
  is broader — it includes the rocky/gas-giant baseline types that
  are nominally working but still placeholder-flagged.

### Higher LOD for up-close situations

- **As a player, I want planets to hold up visually when I'm close —
  surface detail, terrain relief, palette behavior — so close
  approaches don't break the visual contract that holds at distance.**
- **AC:** `Planet.js` shader **reads** the `lodLevel` uniform it
  already declares (it currently doesn't — declared at line 44,
  defaulted at line 1077, never consumed in shader code).
  Procedural planets get a meaningfully-different LOD2 branch
  (terrain perturbation, finer-scale noise, palette behavior).
  Moon LOD2 expanded beyond rocky/captured (lines 355-459) to
  include ice / volcanic / terrestrial moon types. Switchover
  range tuned so the transition isn't visible.
- **Code anchors:** `Planet.js:44` + `:1077` (uniform declaration);
  `Moon.js:355,441,454,459` (existing partial LOD2 branches as
  shape reference); `BodyRenderer.js:175` (wiring already correct).

### Wiring gaps — close generator → shader pipeline

- **As a viewer, I want planet features that the generator decides
  exist to actually be visible — so the data model and the rendering
  model agree, and the work of generation isn't wasted.**
- **AC:** Three named wiring gaps closed:
  1. **Gas giant storms** — `planetData.storms.spots` and
     `polarStorm` reach shader uniforms; storms render visibly
     where the generator placed them.
  2. **Surface history → rocky/moon shaders** — crater density
     from bombardment history (per FEATURE_AUDIT §2.2 + §2.3)
     reaches the surface shader so geological history shows.
  3. **Multi-band rings per physics** — `RingRenderer.js` (the
     dead 312-line file with 16-ringlet + 8-gap support) gets
     instantiated and replaces the inline ring path, so ring
     systems render the multi-band physics already in the
     generation model.

## Player Beats — ENRICHED / GAME

- **Visited-systems log** (separate F&F-MVP row, not part of this
  feature) is the mechanism that captures the discovery-collection
  Beat above. Without the log, "save this system to revisit" has no
  storage. The two ship together to land the Beat fully — flagged as
  a cross-feature dependency in `See also`.
- **Time-debt mechanic** (GAME tier) eventually puts a meaningful
  cost on traveling back to saved systems, which strengthens the
  "save this for later" feel. Not in scope for F&F.

## Open questions

- **Workstream split** — these 10 rows split naturally along code
  surface (visual polish per type; LOD2 wiring; generator→shader
  wiring; rings instantiation). Should PM-scope as 3-4 sibling
  workstreams over a single mega-workstream — last one would
  collapse review cadence and make the discovery-collection Beat
  hard to evaluate incrementally.
- **Palette pool sizing** — FEATURES.md row text suggests hot-jupiter
  4 → 15 entries, exotic types 4 → 20. Numbers are from FEATURE_AUDIT
  archival, not from PM-scoping. Confirm before implementing.
- **Reference-anchored variety** — Elite Dangerous and NMS are the
  named references. Concrete deliverable: a per-type "what varies"
  spec (palette range, biome legibility, atmospheric distinctness,
  surface signature) anchored against those references, within retro
  envelope. Not yet authored.
- **LOD switchover criterion** — distance threshold? Angular size?
  Continuous tier blend vs hard swap? PM-scoping the LOD workstream
  needs to pick one.
- **Civilized planet night-side emissive** — city-lights, ecumenopolis,
  machine grid all want a different kind of emissive. Same shader
  branch or per-type emissive treatment?

## Workstreams

None scoped yet. Workstream candidates (provisional split):

1. **Planet-LOD2 wiring** — make `Planet.js` shader read the uniform
   it already declares; extend Moon LOD2 beyond rocky/captured.
   Bounded, mechanical.
2. **Exotic + civilized type pass** — close `Planet.js:857`
   perturbation TODO for exotic geometric types; add night-side
   emissive for civilized types. Higher creative load.
3. **Generator → shader wiring gaps** — gas giant storms, surface
   history, RingRenderer instantiation. Bounded; mostly plumbing.
4. **Per-type visual polish pass** — placeholder → striking for each
   of the 18 types. Largest creative load; reference-anchored
   against ED + NMS variable space.

(1) and (3) are bounded plumbing; (2) and (4) are the visual-polish
work that the discovery-collection Beat depends on.

## See also

- [`planet-visual-features.md`](planet-visual-features.md) — **WHAT-side
  companion** to this doc: the L0→L1→L2 causal inventory (drivers →
  physical processes → observable features) of every terrain/climate
  feature a planet can exhibit, type-agnostic. Use it to source
  per-feature background HOW-research and to gap-spot via its coverage
  matrix. This doc (player-experience + workstreams) is the HOW/WHY side.
- `docs/FEATURES.md` — parent Planet section (10 rows).
- `docs/FEATURES/galactic-rendering.md`, `docs/FEATURES/nebulae.md` —
  sibling sky-side deep dives sharing the "retro envelope but
  visually striking" frame.
- **Visited-systems log row** (F&F-MVP, in `FEATURES.md` GAME-tier
  → F&F additions section) — the storage mechanism for the
  discovery-collection Beat above; ships paired with this feature
  to land that Beat fully.
- `docs/SYSTEMS/generation-planet/README.md`,
  `docs/SYSTEMS/rendering-objects/README.md` — not yet authored.
- `docs/_intake-2026-05-18-max-feature-status.md` §"Planet
  generation" + §"Exotic and civilized planet types" + §"All
  rendering generally" — verbatim source.
- `docs/ARCHIVE/FEATURE_AUDIT.md` §2.1 (storms), §2.2 + §2.3
  (surface history), §2.4 (rings) — archived but cited from
  FEATURES.md row text.
