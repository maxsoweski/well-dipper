# Workstream: OOI capture-and-exposure system (2026-04-20)

## Status

Scoped — awaiting working-Claude execution on Deliverables 1 and 2.
Deliverables 3 and 4 are spec-only (no implementation in this
workstream — see Principle-2 guard below).

## Parent feature

**`docs/FEATURES/autopilot.md`** — authored by Director at commit
`bdeb0ff` (2026-04-20) from a heart's-desire → V1 interview with Max.
The OOI system is not a feature in its own right — it is **shared
infrastructure whose first consumer is autopilot's camera-axis V-later
modes**. Three load-bearing sections of the feature doc anchor this
workstream:

- **§Camera axis — `SHOWCASE` and `ROVING` modes.** The feature doc
  defines these as the V-later camera modes that *"cannot be
  hard-coded — they need to discover nearby interesting things at
  runtime and frame them."* `SHOWCASE` = *"framed compositional beats
  — crescent, eclipse, ring-shadow, transit"*; `ROVING` = *"player-eye
  freedom, 360° turn-head-toward-OOI."* Both query `docs/OBJECTS_OF_INTEREST.md`
  at runtime. This workstream ships the substrate they consume.
  **Dependency is explicit:** autopilot V-later cannot ship without
  this workstream's runtime-registry spec being implemented by a
  first-consumer workstream (see §Followups §3).
- **§V-later triage — *"OOI runtime registry (the query substrate
  `SHOWCASE` and `ROVING` consume at runtime — workstream at
  `docs/WORKSTREAMS/ooi-capture-and-exposure-system-2026-04-20.md`)."***
  The feature doc names this workstream by path as the V-later
  architectural-affordance owner. That inbound reference is this
  workstream's authoritative parenting anchor.
- **§V1 architectural affordances for V-later items — OOI runtime
  registry.** The feature doc mandates *"the camera update loop
  queries *through* a lookup interface (stub in V1), not directly
  from scene globals. V1 interface returns `null` / empty for
  `getNearbyOOIs()` and `getActiveEvents()`; V-later implementation
  lights those up without changing the caller."* This constrains the
  runtime-registry spec (Deliverable 3) — the API surface must be
  stub-able from autopilot V1 before this workstream's registry is
  implemented, which means the interface shape must be nailed down
  now, even though no code lands.

Autopilot V1 ships the stub-able interface per `docs/SYSTEM_CONTRACTS.md`
§10.9 OOI query interface. This workstream ships the schema and spec
that interface conforms to; a **separate** future workstream
(§Followups §3) implements the registry as the first consumer —
autopilot V-later — comes online.

**Future consumers named in Deliverable 4 (ROVING, SHOWCASE, HUD,
scanner, narrative, screenshot, BPM-hooks)** are explicit V-later
dependents of this workstream. Autopilot ROVING + SHOWCASE are the
*load-bearing* V-later consumers — the ones whose design constraints
shape the spec now — because they are the named V-later items in the
feature doc's §V-later triage. Other future consumers are shape-
constraints only; they do not have feature docs today.

**Bible anchors** (ontology breadth — unchanged from prior scoping):
§1 Vision / Core Experience / **Discover** (L41), §4 Star Systems, §4B
Rings, §4C Asteroid Belts, §5 Natural Planet Types, §6 Overlay Systems,
§12 Galaxy-Scale Generation.

**Prior scoping note (superseded):** this brief was originally scoped
parenting against the autopilot feature doc by name before it landed,
with an explicit invitation to tighten once the doc was on disk. That
tightening is now applied above.

## Implementation plan

N/A (feature is workstream-sized — but in a *non-standard* way). This
workstream ships **documentation + a registry spec**, not a runtime
system. The runtime registry (Deliverable 3) is deferred to whoever
first needs it (autopilot V1). A PLAN doc would be premature.

If Deliverable 3's spec survives contact with autopilot V1, the spec
itself is the plan. If autopilot V1 reveals the spec is wrong, that
workstream authors its own corrections — this brief is then a
historical snapshot, not a living contract.

## Scope statement

Build the substrate that lets camera and future systems query *"what
is nearby that is worth looking at?"* at runtime, and build the
process discipline that keeps the substrate honest as new rendering
systems land. Ship two concrete artifacts and one spec:

1. `docs/OBJECTS_OF_INTEREST.md` — the canonical catalog of OOI types,
   their producing rendering systems, the data each exposes today, and
   the consumers that read them. Schema designed so a new rendering
   system's author can add entries in <10 minutes without reinventing
   the column set.
2. A **process trigger** in the Dev Collab OS lifecycle that forces
   OOI-doc updates when a new rendering system is introduced or an
   existing one gains a visually-significant feature. Captured in
   whatever workflow artifact is load-bearing today
   (`docs/MAX_RECORDING_PROTOCOL.md` sibling, feature-doc template,
   PM brief boilerplate, or a new `docs/process/OOI_UPDATE_TRIGGER.md`
   — Deliverable 2 picks the right home).
3. A **runtime-registry spec** (API shape, register/query contract,
   lifecycle, file-tree placement) embedded in the OOI doc itself.
   No implementation. The spec is a contract for whoever lights it up,
   not a standalone module landing in `src/`.

This is one unit of work because all three artifacts answer the same
question — *"how does the renderer side tell the camera-composition
side what exists and what's worth framing?"* — at three altitudes
(catalog, process, API). Splitting would fragment a single design
decision across three briefs and invite schema drift between them.

## How it fits the bigger picture

The autopilot feature-doc interview (this session) identified two
orthogonal axes for autopilot: ship motion (ENTRY / CRUISE / APPROACH
/ STATION) and camera behavior (ESTABLISHING / SHOWCASE / ROVING).
The SHOWCASE and ROVING modes are the ones that cannot be hard-coded
— they need to *discover* nearby interesting things at runtime and
frame them.

**What advances:**

- `docs/GAME_BIBLE.md` §1 Vision / Core Experience / **Discover** (L41).
  "Every system is different. Finding a terrestrial world or an alien
  megastructure is rare and meaningful." The felt meaning of
  "meaningful" is carried by the camera's willingness to frame
  specific things. A camera that can query *"the ring-shadow on the
  second planet's north pole is active right now"* is a camera that
  can make finding a ringed world meaningful on arrival. A camera
  that can only `lookAt(dominantBody)` cannot.
- §1 Vision / **Drift** (L40). "You watch planets orbit, stars glow,
  nebulae swirl." The drift experience is the screensaver's whole
  shape; the OOI registry is what lets the screensaver's camera
  populate drift with variety instead of cycling a hardcoded list.
- §11 Development Philosophy **Principle 5 — Model Produces →
  Pipeline Carries → Renderer Consumes** (L1628). The OOI registry
  is the *pipeline layer* for a class of data that currently lives
  only inside the renderer. Today `Planet.js` knows it has rings;
  the camera has no structured way to find out. The registry is the
  missing pipeline surface that carries "ring existence" from model/
  renderer to consumer.
- §11 Development Philosophy **Principle 2 — No Tack-On Systems**
  (L1611). The existing code already has `stop.type` in autopilot,
  `gravityField` in `CinematicDirector`, `systemData.star.type` in
  generation, `RealFeatureCatalog` for loaded real-data features.
  A new registry that parallels these rather than aggregating them
  is a tack-on. The spec (Deliverable 3) must name which existing
  surfaces it *extends* and which it *aggregates*, and justify the
  aggregation with real consumer needs from autopilot V1.

**Does NOT advance:**

- `docs/FEATURES/warp.md`. Warp does not consume OOIs. Warp enters
  and exits a system; OOI queries happen *inside* system camera
  modes. If warp ever gains a "look at the prettiest thing in the
  departing system" moment, that would be a future consumer — but
  it's not on the table and is not this workstream's justification.
- Any scanner / radar / HUD-target-lock / narrative-event work.
  Those are named in Deliverable 4 as future consumers *only so the
  spec doesn't paint itself into a corner*. No implementation or
  design for any of them ships here.

## Meta-rescope note

Applying Max's 2026-04-20 PM feedback: *"PM is thinking economically
which I appreciate but the PM's underlying concern needs to be the
'feature' we're building toward — how to make that happen."*

Two places this rescopes the default PM instinct:

1. **The doc is not enough.** A purely-documentary first pass (just
   ship `docs/OBJECTS_OF_INTEREST.md` and leave the runtime registry
   as "we'll design it when we need it") would be the economical
   move but would leave autopilot V1 without a contract to target.
   The autopilot workstream will block on *"where do I query
   nearby OOIs from?"*, and answering that mid-autopilot-work is
   exactly the tack-on path. So the spec (Deliverable 3) is in
   scope for this workstream — even though no runtime code ships.
2. **The process trigger is not optional.** A purely-economical
   scope would skip Deliverable 2 ("we'll update the doc when we
   remember to"). That loses the repeatable-process half of Max's
   ask, which is the more load-bearing half. The doc goes stale in
   one new-rendering-system cycle without a trigger; a stale doc
   is worse than no doc because consumers trust it.

What's **still** held back from scope (economic discipline preserved):

- No runtime registry implementation.
- No autopilot integration.
- No porting of existing renderer-side data into the registry
  until a real consumer asks for it.

## Acceptance criteria

**Deliverable 1 — Doc schema (SHIPS IN THIS WORKSTREAM).**

1. `docs/OBJECTS_OF_INTEREST.md` exists at repo root of docs tree.
   File contains (in order):
   a. **Purpose paragraph** — one paragraph, citing this brief and
      the autopilot feature doc as its origin.
   b. **Ontology section** — the six OOI categories from the
      interview (intra-system bodies, extra-system features,
      dynamic events, surface detail, light/composition,
      meta/cinematic) with one-sentence definition each.
   c. **Catalog table(s)** — one entry per OOI type, with columns
      defined in AC #2.
   d. **Runtime-registry spec** (Deliverable 3) embedded as a
      dedicated section with a clear "NOT YET IMPLEMENTED" banner.
   e. **Update process** (Deliverable 2) — a short section pointing
      to the process artifact and naming the triggering events.
   f. **Consumers today / future consumers** (Deliverable 4) —
      two short lists.

2. **Schema columns** for catalog entries, from the working-Claude
   v0 starting point of *"type, producing render system, available
   data, consumer systems"* — rescoped by PM to add queryability,
   lifecycle, and grounding fields. Minimum required columns:
   - `type` — stable snake_case identifier (e.g., `ring_shadow_on_planet_surface`,
     `binary_star_eclipse`).
   - `category` — one of the six from AC #1b.
   - `producing_system` — file path(s) in `src/` that instantiate
     or render this OOI. Multiple entries allowed (e.g., rings
     live in `Planet.js` + `Moon.js`).
   - `data_available` — the shape of data the producing system
     currently has about this OOI (position, radius, orientation,
     time window, orbital elements, seed, etc.). Expressed as a
     terse type-ish sketch, not a formal schema. If the producing
     system has NOTHING structured about it today (e.g.,
     atmospheric crescents are rendered but no object represents
     "the crescent" as a queryable entity), the cell says
     `IMPLICIT — not exposed` and that becomes a known gap.
   - `lifecycle` — when does this OOI come into and out of
     existence? `static_per_system` (rings exist for the session),
     `time_windowed` (eclipses at BPM-quantized moments),
     `per_frame_derived` (crescent terminator is geometric and
     always valid for any lit body), `generator_stamp` (baked
     at generation time, e.g., volcanic activity), etc.
   - `bible_section` — the §X.Y citation that grounds this OOI in
     the authored vision. No orphan OOI types.
   - `consumers_today` — which `src/` systems read it now (for
     existing data) or `NONE` for gaps.
   - `consumers_planned` — which future systems (autopilot, HUD,
     scanner, etc.) are expected to read it.
   - `notes` — free text for quirks, known issues, or cross-refs.

3. **Example rows.** At least six rows populated end-to-end, one per
   category, drawn from the ontology list in the interview:
   - Category "intra-system bodies": a ring system entry.
   - Category "extra-system features": a nearby-nebula entry.
   - Category "dynamic events": a moon-transit entry.
   - Category "surface detail": an aurora entry.
   - Category "light/composition": a ring-shadow-on-surface entry.
   - Category "meta/cinematic": a foreground/background-parallax
     entry.
   Each example row is a real codepath trace or an explicit
   `IMPLICIT — not exposed` gap. No fabricated rows.

4. **Schema fits in a new row in <10 min.** This AC is evaluative
   rather than measurable — the Director audit is the gate. The
   test: a hypothetical new rendering system (pick one —
   `ProceduralFlareLayer` or `AsteroidBelt` feature additions) can
   be added by copying an existing row, changing the `type` and
   `producing_system` cells, and filling the remaining cells from
   fields already present in the producing file's constructor. If
   the audit finds a column that requires running the code or
   deep-reading multiple files to fill, that column needs
   simplification or removal.

5. **Cross-links.** The doc is linked from:
   - `docs/FEATURES/autopilot.md` (when it lands — this workstream
     does not block on it). The OOI doc notes in its Purpose
     paragraph that Autopilot is its first consumer.
   - `docs/GAME_BIBLE.md` §10 Technical Foundation or §11
     Development Philosophy — a one-line pointer added by the
     Director (flagged separately, NOT edited in this workstream
     per Dev Collab OS editing rules).
   - This brief, from its `## Deliverables shipped` section at
     close.

**Deliverable 2 — Repeatable process (SHIPS IN THIS WORKSTREAM).**

6. **Trigger definition.** The update triggers are named explicitly,
   in one place, in the OOI doc's "Update process" section:
   - New file under `src/objects/`, `src/rendering/`, or
     `src/effects/` → add OOI rows before the file's PR / commit
     closes.
   - New visually-significant feature on an existing renderer
     (e.g., `Planet.js` gains storm rendering) → add or update
     the relevant OOI row in the same commit.
   - New overlay type under `src/generation/ExoticOverlay.js` or
     equivalent → add the OOI row in the same commit.
   - New real-data catalog entry in `src/generation/RealFeatureCatalog.js`
     or `RealStarCatalog.js` → the OOI category already exists;
     confirm the row's `data_available` cell still applies.

7. **Owner assignment.** Each trigger names an owner:
   - Author of the PR/commit is first-responsible.
   - PM audits OOI-doc delta as part of any workstream brief that
     touches a producing file. If the brief doesn't touch OOI-doc
     but the work does, PM flags the gap at brief-scoping time,
     not after commit.
   - Director audit (per Dev Collab OS REVIEW phase) includes an
     OOI-doc-coverage check line on any feature that touches a
     producing system.

8. **Integration with Dev Collab OS lifecycle.** The OOI-doc
   trigger is named explicitly in the SCOPE and REVIEW phases per
   `~/.claude/CLAUDE.md` Dev Collab OS:
   - SCOPE: PM brief template (the PM persona's own working notes,
     not shipped as a formal template file — this workstream does
     NOT restructure `docs/PERSONAS/pm.md`) includes an "OOI-doc
     delta expected?" question for any workstream that touches
     `src/objects/`, `src/rendering/`, `src/effects/`, or
     `src/generation/`.
   - REVIEW: Director's checklist (same applies — working notes,
     not a formal edit of `docs/PERSONAS/director.md` in this
     workstream) includes an "OOI-doc coverage for producing
     systems touched" check.
   The edits to the PM and Director persona files are a **followup
   workstream** (flagged in §Followups below) because those are
   Director-owned artifacts and the OOI workstream should not be
   the vehicle for persona-doc edits. This workstream ships the
   **rule**; a later Director-owned workstream ships the **persona-
   doc text change**.

9. **No new workflow artifact unless justified.** The process lives
   in `docs/OBJECTS_OF_INTEREST.md` itself — no separate
   `docs/process/OOI_UPDATE_TRIGGER.md` is created. Adding another
   process doc that consumers must find is friction, not
   discipline. If the Director audit determines a separate file is
   necessary, that's a Director call and this AC flips.

**Deliverable 3 — Runtime registry shape, spec only (SHIPS IN THIS
WORKSTREAM AS TEXT; NOT IMPLEMENTED).**

10. **API surface documented.** Embedded in the OOI doc. Minimum
    surface:
    - `register(entry)` — rendering systems call on instantiation
      or on per-frame basis (the spec must pick one and justify).
      `entry` shape is derived from the catalog columns in AC #2,
      narrowed to the runtime-relevant subset (`type`, `position`
      or `positionFn`, `body` ref, `visibleFrom` optional,
      `window` optional, `sourceSystem` for debug, `ttl` or
      `unregisterFn`).
    - `unregister(handle)` or equivalent lifecycle close.
    - `getNearby(cameraPos, radius, filter?)` — primary consumer
      read path.
    - `getActiveEvents(now)` — for time-windowed OOIs (eclipses,
      transits).
    - `getByCategory(category)` — for ROVING-style broad queries.

11. **Lifecycle decided.** The spec picks one lifecycle model and
    writes the reasoning:
    - *Option A — register on renderer init, unregister on
      teardown.* Cheap at runtime, requires per-frame OOIs (events)
      to register with a time window rather than per-frame.
    - *Option B — per-frame re-register.* Simpler model, more
      runtime cost, no lifecycle bugs.
    - *Option C — hybrid: static OOIs registered once; dynamic OOIs
      computed by a `queryFn` the registry calls at read time.*
    PM recommendation is Option C because it matches the two
    lifecycle categories we actually have (static per-system
    bodies + time-windowed or per-frame derived phenomena) and
    avoids the per-frame cost for the common case. But the spec
    writer (this workstream's working-Claude) must explicitly
    defend whichever choice ships, against the other two.

12. **File-tree placement decided.** Proposed: `src/core/OOIRegistry.js`
    with no other siblings in `src/core/` gaining anything. Rationale:
    cross-cutting infra, not renderer, not generator, not camera.
    Alternative considered and rejected: extending
    `CinematicDirector` to host the registry (rejected because the
    registry has non-camera consumers named in Deliverable 4 and
    would outgrow the director's scope).
    The spec names this path as the expected home. The file is
    **not created** in this workstream.

13. **Integration contract with existing systems.** The spec names
    which existing surfaces the registry **extends** (not
    replaces):
    - `CinematicDirector` currently consumes `gravityField` for SOI
      queries. The registry is a peer, not a replacement —
      `gravityField` continues to own SOI physics; the registry
      owns "worth looking at." A body can be in both.
    - Autopilot's `AutoNavigator` builds its queue from system
      data; it is NOT refactored to read from the registry in
      this workstream. If autopilot V1 chooses to, that's its
      call.
    - `RealFeatureCatalog` continues to own real-catalog data;
      the registry is not a replacement. If a feature catalog
      entry becomes camera-queryable, the renderer that
      instantiates it registers an OOI — the catalog stays
      upstream.
    - Generation-time stamped data (`star.type`, `systemData`,
      `PlanetGenerator` outputs) continues to live in generation;
      the renderer that reads those is responsible for
      registering any camera-queryable OOIs derived from them.

14. **Explicit non-ship marker.** The spec section opens with a
    banner (plain markdown, not a styled admonition — stays
    renderable anywhere):
    `> NOT IMPLEMENTED. This is a contract for the first consumer
    > to land in src/. Do not import OOIRegistry from anywhere —
    > the file does not exist. See §Followups below for the
    > workstream that lights this up.`

**Deliverable 4 — Future consumers named (SHIPS IN THIS WORKSTREAM).**

15. **Named future consumers.** A short list in the OOI doc, each
    with a one-line rationale for why the registry's shape must
    not preclude it:
    - **Autopilot V1** — SHOWCASE + ROVING camera modes. First
      consumer. Shape constraint: `getNearby(cameraPos, radius)`
      must return things the camera can frame without needing
      physics state.
    - **HUD / target-lock** — in-game targeting reticle. Shape
      constraint: registry entries must expose a stable `handle`
      or `id` that HUD can track across frames for lock-on.
    - **Scanner / radar** — information-overlay mode. Shape
      constraint: `getByCategory` must work across the full OOI
      breadth, not just bodies.
    - **Narrative-event hooks** — late-game "warp is a place"
      encounters (Bible §1 The Warp as Sacred Experience, L44).
      Shape constraint: event OOIs (`lifecycle: time_windowed`)
      must carry enough context for narrative systems to fire
      on them.
    - **Screenshot mode / loading-screen tips** — "the system
      you just left had a triple conjunction." Shape constraint:
      OOI entries must persist (or be reconstructible) after
      the session leaves a system, OR the registry explicitly
      declares it does not — a decision either way, but not
      silence.
    - **BPM-synced animation hooks** (Bible §11 Principle 4,
      L1623). Some OOIs (transits, eclipses) are BPM-quantized.
      Shape constraint: `window` field should be expressible
      in beat units, not just wall-clock seconds.

16. **Explicit non-goals.** The list names what this workstream
    **does not** try to anticipate — unknown future features. The
    named consumers are the ones that have surfaced in session
    history. Anything not named is accepted as "the registry may
    need changes then." This prevents Deliverable 4 from becoming
    a speculative-architecture section.

**Cross-cutting ACs.**

17. **One commit.** Commit message shape:
    `docs(ooi): introduce Objects Of Interest catalog + registry spec`.
    Commit body cites this brief path, names that the registry is
    spec-only, and names the expected first consumer (autopilot V1).
    Files in the commit: `docs/OBJECTS_OF_INTEREST.md` (new) and
    this brief (Status line update + `Deliverables shipped`
    section). Nothing in `src/`. Nothing in `docs/PERSONAS/`.
    Nothing in `docs/GAME_BIBLE.md`. Nothing in `docs/FEATURES/`.

18. **No motion evidence required.** This is a docs-only workstream;
    the Shipped-gate (`docs/MAX_RECORDING_PROTOCOL.md`) does not
    apply. Director audits the doc against this brief; PM confirms
    schema fit. Max reviews the doc when convenient and accepts or
    flips a followup.

19. **Status flow.** Scoped → VERIFIED_PENDING_MAX on commit →
    Shipped on Max's verdict (no recording step; Max just reads).
    If Max calls for schema revisions, same-workstream amendment
    per the sibling brief's pattern.

## Principles that apply

Four of the six Bible §11 principles are load-bearing. Two
(BPM-Synced Animation, Per-Object Retro Aesthetic) are indirectly
relevant but not load-bearing for this workstream — they are
category-defining for *what* counts as an OOI (BPM-quantized events
are an OOI subclass; per-object retro is why the renderer-side data
exists in the first place), but they don't constrain *how* we build
the catalog or registry.

- **Principle 2 — No Tack-On Systems** (§11, L1611). The headline
  principle. This workstream's dominant failure mode is building a
  cross-cutting registry before any consumer exists — exactly the
  pattern the principle warns against in rendering (*"features were
  built by hacking visual output"*). The translation to infra: a
  registry built speculatively is a layer added to the architecture
  without a real consumer pulling it into shape, and the shape it
  gets without a consumer's pressure is almost guaranteed wrong.
  *Violation in this workstream would look like:* shipping
  `src/core/OOIRegistry.js` as actual code; porting existing
  renderer-side data (ring positions from `Planet.js`, body refs
  from `CinematicDirector`) into the registry before autopilot V1
  asks for it; writing unit tests for the registry. The clean
  answer is: the spec is text, the first consumer implements.

- **Principle 6 — First Principles Over Patches** (§11, L1638).
  *"If a system needs more than 2-3 patches to achieve a goal, the
  architecture is wrong."* The first-principle question for this
  workstream is *"what does autopilot's SHOWCASE camera need to
  query?"* The first-principle answer is *"a lookup from (camera
  position, radius, optional filter) to a list of frameable things
  with their positions and a stable handle."* Everything in the
  spec that doesn't serve that answer is a patch waiting for a
  first-principles challenge. *Violation in this workstream would
  look like:* adding fields to catalog columns because "it feels
  complete" without a named consumer demanding them; designing for
  every category of future consumer simultaneously rather than
  ensuring autopilot V1 can consume and deferring the rest.

- **Principle 5 — Model Produces → Pipeline Carries → Renderer
  Consumes** (§11, L1628). The OOI registry is explicitly a
  *pipeline* layer — it carries data from renderer/generator
  (model) to camera/HUD (renderer-consumer). This principle
  constrains the registry's direction: the camera must not write
  OOIs that the renderer reads. *Violation in this workstream
  would look like:* allowing consumers (camera, autopilot) to
  register OOIs back into the registry ("the camera thinks this
  is interesting"); allowing the registry to mutate entries that
  producers wrote. The spec must be read-after-write from the
  consumer side and write-only from the producer side.

- **Principle 1 — Hash Grid Authority** (§11, L1606) —
  *diagnostic, not prescriptive*. The hash grid is the galaxy; the
  OOI registry is NOT a parallel star list. A future reader might
  mistake the registry for "a new source of truth for stars." It
  is not — for galaxy-scale entities, the hash grid stays
  authoritative and any OOI entry for a star is a *reference
  into* the hash grid, not a copy. *Violation in this workstream
  would look like:* a catalog row for "the current star" whose
  `data_available` cell duplicates hash-grid data rather than
  citing the hash grid as the source; a registry `register` call
  that copies star data into the registry's own storage.

## Drift risks

- **Risk: Registry implementation sneaks in.** This workstream's
  title mentions "exposure," which reads like implementation. A
  session under execution pressure will want to ship a 50-line
  `OOIRegistry.js` stub "because it's so small."
  **Why it happens:** the spec feels incomplete without code; the
  code feels small; Principle 2 feels abstract while the empty
  file feels concrete.
  **Guard:** AC #14 (non-ship marker in the spec), AC #17 (commit
  contents locked to docs only). Any file under `src/` in the diff
  is an escalation trigger — stop, do not commit, surface to
  Director.

- **Risk: Schema over-engineering.** The column list at AC #2 is
  already longer than working-Claude's v0 starting point. A
  session trying to future-proof will add columns for units,
  coordinate frames, time units, serialization, versioning.
  **Why it happens:** a good schema feels defensible; an
  adequate schema feels ad-hoc. Defensibility is the wrong goal
  — *fillable in <10 minutes by the next author* is the goal
  (AC #4).
  **Guard:** AC #4 is evaluative — Director audit must actively
  test the schema against a hypothetical new row. If any column
  requires reading code beyond the producing file's constructor
  to fill, that column is cut.

- **Risk: Writing the autopilot feature doc inside this
  workstream.** The parent feature doc doesn't exist yet. A
  session will notice the dangling reference and want to fix it.
  **Why it happens:** the dependency feels load-bearing (AC #5
  cross-links, Deliverable 4's "first consumer" framing); the
  Director's session is parallel and uncertain.
  **Guard:** The feature doc is Director-owned (Dev Collab OS
  trigger: *"Editing docs/FEATURES/** → Invoke Director"*). Any
  edit to `docs/FEATURES/` in this workstream's diff is a hard
  stop. Cross-links get added when the feature doc lands as a
  separate commit by the Director.

- **Risk: Bible edits to add the OOI system to §10 or §11.** The
  Director may want to add a pointer line to the Bible. This is
  Director-owned editing and is NOT part of this workstream's
  commit.
  **Why it happens:** the Bible is the source of truth; a
  cross-cutting system not mentioned there feels unanchored.
  **Guard:** AC #17 (no `docs/GAME_BIBLE.md` in the commit) +
  followup entry for Director to do this in a separate session.

- **Risk: Ontology fights.** The six categories from the
  interview are not orthogonal — "ring-shadow on planet surface"
  is both a surface-detail and a light/composition OOI; "binary
  star eclipse" is both a dynamic-event and a light/composition
  OOI. A session will want to redesign the categories.
  **Why it happens:** taxonomic elegance is seductive; the
  interview's categories are working notes, not a formal
  ontology.
  **Guard:** The categories are descriptive, not exclusive.
  Catalog rows can belong to one category for the `category`
  column but reference other categories in `notes`. The spec
  does NOT enforce exclusivity. If an OOI genuinely fits two,
  pick the one that matches its *primary consumer intent*
  (ring-shadow on surface is primarily light/composition — it's
  what the camera frames — even though it's physically surface
  detail). Document this rule in the doc's Ontology section.

- **Risk: Trying to enumerate every OOI that exists today.** The
  renderer surface is wide (17 files under `src/objects/`, 9
  under `src/rendering/`, 3 under `src/effects/`). A session
  will try to populate a row for each.
  **Why it happens:** completeness feels like quality; the
  example rows (AC #3) are six, and the gap to "complete" feels
  like an unfinished job.
  **Guard:** AC #3 is explicit — six rows, one per category.
  "Complete" is the backlog working-Claude generates as followups
  (a followup per producing-system file that needs an entry).
  The six seed rows prove the schema; they are not a claim of
  completeness. The doc's header says so explicitly.

- **Risk: Building a PR template / CI check for the process
  trigger.** A session hears "repeatable process" and reaches for
  automation.
  **Why it happens:** automation feels more durable than a
  written rule; writing a rule feels like abdication.
  **Guard:** AC #9 (no new workflow artifacts). This project's
  workflow is agent-mediated (PM brief, Director audit), not
  CI-mediated. The trigger lives in the PM and Director personas'
  working notes and in the OOI doc itself. If Max later wants
  CI enforcement, that's a followup workstream.

## In scope

- **`docs/OBJECTS_OF_INTEREST.md` (new file).** Sections per AC
  #1: Purpose, Ontology, Catalog table(s), Runtime-registry spec
  (with non-ship banner per AC #14), Update process, Consumers
  today / Future consumers.
- **Six seed catalog rows** per AC #3, one per ontology category.
- **Runtime-registry spec** embedded in the OOI doc per
  Deliverables 3 + AC #10–14.
- **Update process section** per AC #6–9.
- **Future-consumer list** per AC #15–16.
- **This brief's Status line + Deliverables shipped section**
  after commit.

## Out of scope

- **Any file under `src/`.** No `OOIRegistry.js`, no integration
  into `CinematicDirector.js` or `AutoNavigator.js`, no registration
  calls added to any renderer. AC #17 locks this.
- **Editing `docs/GAME_BIBLE.md`** to add an OOI pointer. Director-
  owned, separate session.
- **Editing `docs/FEATURES/autopilot.md`** (doesn't exist yet) or
  `docs/FEATURES/warp.md` (exists). Director-owned.
- **Editing `docs/PERSONAS/pm.md` or `docs/PERSONAS/director.md`**
  to encode the OOI-update trigger in the persona instructions.
  Director-owned. This workstream ships the rule text in the OOI
  doc; the persona-doc update is a followup (see §Followups).
- **Editing `docs/FEATURE_AUDIT.md`.** Co-owned; the OOI system
  is infra, not a feature, so the audit entry is not this
  workstream's concern.
- **Porting existing renderer-side data** (ring positions, body
  refs, flare parameters) into a registry. No producer in `src/`
  is modified to call a registry. Principle 2.
- **Ontology revisions to the Bible.** If the OOI categories
  suggest the Bible's §6 Overlays or §12 Galaxy-Scale sections
  need restructuring, that's a Director session, not this one.
- **Populating every OOI that exists today.** Six seed rows ship;
  the rest is backlog per the Drift Risk guard.
- **CI / PR-template / hook-based enforcement** of the process
  trigger. AC #9.
- **Any autopilot code or design.** The sibling brief
  `autopilot-star-orbit-distance-2026-04-20.md` and the
  forthcoming autopilot feature doc own autopilot concerns. This
  brief names autopilot only as the registry's first consumer.
- **Any warp, scanner, HUD, narrative, screenshot, BPM work.**
  Named in Deliverable 4 as future consumers; no scoping or
  design here.

## Followups (spawned by this workstream; do not close here)

These are the named workstreams this brief generates. Working-Claude
does NOT start any of them; they surface to the Director at close
for routing.

1. **Persona-doc update: encode OOI-update trigger** in
   `docs/PERSONAS/pm.md` SCOPE-phase checklist and
   `docs/PERSONAS/director.md` REVIEW-phase checklist. Director-
   owned edit. Separate commit.
2. **Bible pointer: §10 Technical Foundation or §11 Development
   Philosophy** gains a one-line pointer to `docs/OBJECTS_OF_INTEREST.md`.
   Director-owned edit.
3. **Autopilot V1 — light up the registry.** When autopilot V1 is
   scoped (after the feature doc lands), that workstream
   implements `src/core/OOIRegistry.js` per this brief's spec,
   and makes the first `register` / `getNearby` calls from the
   real consumer site. It may amend the spec in the OOI doc if
   the spec is wrong in practice.
4. **OOI catalog backfill** — rows for every producing system
   under `src/objects/`, `src/rendering/`, `src/effects/`. Can be
   done incrementally (one renderer's rows per commit, co-located
   with any other work touching that renderer). Not a single
   workstream; a standing process from Deliverable 2.
5. **BPM-unit time-window representation.** Deliverable 4
   identified that time-windowed OOIs should express their
   windows in beat units (Bible §11 Principle 4). The spec
   names this shape constraint; the actual encoding (is it
   `{ beatStart, beatEnd }`? `{ barStart, length }`?) is
   defined when the first BPM-quantized OOI consumer asks. May
   be the same as #3 (autopilot BPM-synced camera cuts).

## Handoff to working-Claude

Read this brief first. Then, in order:

1. `docs/WORKSTREAMS/autopilot-star-orbit-distance-2026-04-20.md`
   — the sibling brief. Read for the autopilot context (approach
   phase, stop types, navigator/queue relationship) and for the
   brief style precedent. This workstream reuses that brief's
   Status/Drift/AC discipline.
2. `docs/GAME_BIBLE.md` §1 (L9–58), §11 Development Philosophy
   (L1602–1641). Principle 2, 5, 6, and diagnostically Principle
   1. The citations in this brief's ACs rely on these sections.
3. `src/auto/AutoNavigator.js` — read for `stop.type`
   discriminator (the existing OOI-adjacent surface), the
   queue-building pattern, what the autopilot already "knows"
   about bodies.
4. `src/camera/CinematicDirector.js` L1–80 — read for the
   `gravityField` injection pattern and the composition-state
   machine. Principle 5 guard: the registry is a PEER to
   `gravityField`, not a replacement.
5. `src/generation/RealFeatureCatalog.js` — read for the
   existing catalog pattern. The OOI registry is *different*
   (runtime, cross-system) but the Catalog's shape is useful
   precedent for `data_available` cells.
6. `docs/GAME_BIBLE.md` §4 Star Systems (L370–720), §6 Overlay
   Systems (L906–990), §12 Galaxy-Scale Generation (L1737+) —
   the OOI ontology's Bible anchors. Skim for category coverage,
   not deep read.

If `docs/OBJECTS_OF_INTEREST.md` has already landed on disk by
the time working-Claude picks up (working-Claude said the v0
would land "before you're done scoping"), reconcile with the
v0 by **restructuring the v0 to match this brief's schema**
rather than accepting the v0 shape as-is. The brief is the
schema authority per Deliverable 1 AC #1–2. Note the
reconciliation explicitly in the commit body (`reconciled v0
draft against workstream schema`). If the v0 has content the
schema doesn't capture, surface that as a schema-revision
question to Max — don't silently drop it.

Then, in order:

1. **Author the OOI doc.** Start from the schema in AC #2. Write
   the six seed rows (AC #3) by tracing each from its
   producing file. Rows with `IMPLICIT — not exposed`
   `data_available` cells are acceptable and valuable — they
   mark the gaps autopilot V1 will need to fill.
2. **Write the runtime-registry spec section.** Open with the
   non-ship banner (AC #14). Follow AC #10–13. For Deliverable 3
   AC #11 (lifecycle choice), write the three-option table and
   defend the chosen option explicitly. PM recommendation is
   Option C (hybrid). Do not accept the recommendation without
   engaging the alternatives — if Option C is wrong, say so and
   pick another.
3. **Write the Update process section.** AC #6–9. Name the
   triggers; assign owners; name the Dev Collab OS integration
   points; explicitly defer persona-doc edits to followup #1.
4. **Write the Future consumers section.** AC #15–16. Short,
   with one-line rationales. Explicit non-goal: this is not an
   architecture doc for those consumers.
5. **Self-audit against AC #4.** Pick `ProceduralGlowLayer` or
   `AsteroidBelt` as a hypothetical next addition. Try to write
   its row in under ten minutes using only the producing file's
   constructor as a reference. If a column resists, that column
   is cut or simplified. Re-run the audit.
6. **Commit per AC #17.** Stage ONLY
   `docs/OBJECTS_OF_INTEREST.md` and this brief — never
   `git add -A`. The brief edit is: Status line flip to
   `VERIFIED_PENDING_MAX <sha>` and a new `## Deliverables
   shipped` section enumerating what's in the doc.
7. **Demo handoff to Max** per `feedback_director-producer-
   demo-cycle.md`. No recording. Surface the doc path, call out
   the three deliverables, point at the non-ship banner in the
   registry section, and ask Max to confirm the schema fits his
   ask. Explicitly raise the PM recommendation on lifecycle
   (Option C) so Max can weigh in.
8. **On Max's verdict:**
   - **Accept** — flip Status to `Shipped <sha> — verified
     against <doc-path>`. Surface followups §1–5 to Director
     for routing.
   - **Revise schema** — amend with a new commit, return to
     step 7.

Artifacts expected at close: one commit (`docs/OBJECTS_OF_INTEREST.md`
new + this brief's Status line + Deliverables shipped section);
this brief at Shipped with the doc path cited; followups named
for Director routing.

**If the diff includes any file under `src/` or any file under
`docs/GAME_BIBLE.md` / `docs/FEATURES/` / `docs/PERSONAS/`,
stop and escalate to Director.** Principle 2's failure mode
(registry implementation sneaks in) and the Dev Collab OS
editing rules (Director-owned artifacts) are the dominant risks
— a diff wider than `docs/OBJECTS_OF_INTEREST.md` + this brief
is the early warning.

Drafted by PM 2026-04-20 from Max's OOI workstream ask during
the autopilot feature-doc interview session.
