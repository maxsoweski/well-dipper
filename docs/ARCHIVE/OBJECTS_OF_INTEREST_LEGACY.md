# Objects of Interest (OOIs)

**Status:** v0, 2026-04-20. Living document. Schema may change after PM's
repeatable-process workstream lands
(`docs/WORKSTREAMS/ooi-capture-and-exposure-system-2026-04-20.md`, in flight).

## What is an OOI

An **Object of Interest** is anything in the rendered scene that a
cinematographic or player-facing system might want to *point at*, *frame*,
*hold on*, or *describe*. OOIs include static bodies (a moon), dynamic
events (an eclipse alignment), and compositional features (a crescent, a
backlit atmosphere).

This document is the canonical inventory. Any rendering pipeline that
produces an OOI adds it here so downstream systems — autopilot, HUD,
scanner, narrative hooks — can discover and query it without hard-coding.

## Why this exists

The autopilot feature-doc interview (2026-04-20) identified that
`ROVING` camera mode and `SHOWCASE` camera mode both need to query
*"what's nearby worth looking at"* at runtime. Hard-coding target
selection inside each consumer would force every new consumer to
re-enumerate the ontology. This doc decouples production from
consumption: rendering systems declare what they produce; consumers
query what exists.

Expected near-term consumer: autopilot (`ROVING`, `SHOWCASE`).
Expected later consumers: in-ship HUD / scanner, narrative triggers,
loading-screen tips, screenshot mode. See the PM workstream for the
runtime-registry shape that will let consumers query this.

## Schema (v0 — PM may restructure)

Each OOI entry records:

- **Type** — short identifier (e.g. `planet`, `ring-shadow`, `eclipse`).
- **Category** — which group below it belongs to.
- **Producing system** — the render pipeline / class that places the OOI.
  `TBD` where not yet verified in code.
- **Available data** — what the consumer can query (position, body ref,
  timing window, visibility arc, etc.).
- **Notes** — constraints, edge cases, principle flags.

## Category 1 — Intra-system bodies

| Type | Producing system | Available data | Notes |
|---|---|---|---|
| `star` (primary) | TBD (`src/rendering/StarFlare*` + `SolarSystemData`) | position, radius, spectral class, luminosity | Always present; binary systems add `star-2`. |
| `star` (secondary, binary) | TBD | position, radius, spectral class, relative orbit to primary | Only present when `system.isBinary`. |
| `planet` | TBD (`src/rendering/planets/*`) | position, radius, type (rocky / gas / ice), moons list, ring-system ref | Queue built in `AutoNavigator.buildQueue`. |
| `moon` | TBD (`src/rendering/planets/*` — same pipeline as planets) | position, radius, parent-planet ref, orbital phase | Can be OOI *relative to* parent planet (transit, shadow). |
| `ring-system` | TBD | inner radius, outer radius, normal vector, ring-plane orientation | Subject for ring-plane-crossing events. |

## Category 2 — Extra-system features

| Type | Producing system | Available data | Notes |
|---|---|---|---|
| `galactic-disk` | TBD (`src/rendering/sky/*Galaxy*`) | direction of plane normal, visual extent, band position | Always visible; foregrounded differently per system position. |
| `nebula` | TBD (`src/rendering/sky/*Nebula*` or similar) | direction, angular extent, dominant color, distance class | Visibility depends on system's position in galaxy. |
| `star-cluster` | TBD | direction, angular extent, member count | Similar to nebulas; sparser ontology. |
| `starfield` | TBD | — (treated as textured backdrop, not a single OOI) | Listed for completeness; not a pointable OOI. |

## Category 3 — Dynamic events

Events are time-windowed OOIs — the beat exists only during a specific
interval. Consumer queries `getActiveEvents(now, horizon)` rather than
`getNearby(camera, radius)`.

| Type | Producing system | Available data | Notes |
|---|---|---|---|
| `eclipse` | TBD (geometric detection from star / planet / moon positions) | subject body, occluder body, t-start, t-peak, t-end, magnitude | Requires computing occluder geometry each frame or on-demand. |
| `transit` | TBD (same detection class) | transiting body (moon), parent body (planet), t-window, crossing geometry | "Moon across planet disk" from observer's POV. |
| `conjunction` | TBD | body A, body B, angular separation minimum, t-peak | Multi-body near-alignment. |
| `ring-plane-crossing` | TBD | ring subject, crossing direction, t-window | Only for planets with rings. |
| `binary-star-occultation` | TBD | star A (occluded), star B (occluding), t-window | Only in binary systems. |

## Category 4 — Surface detail

Surface-detail OOIs are sub-features *of* a body, not standalone
pointable objects. SHOWCASE camera mode uses these to frame a body
interestingly; autopilot ROVING might zoom in on them briefly.

| Type | Producing system | Available data | Notes |
|---|---|---|---|
| `terrain-feature` | TBD (planet surface shader) | body ref, UV coords, type (crater, mountain, canyon, etc.) | Limited by render LOD — visible only at close range. |
| `cloud-pattern` | TBD (planet atmosphere shader) | body ref, dominant pattern (storm / band / swirl) | Gas giants most relevant. |
| `storm` | TBD | body ref, center UV, angular extent, intensity | Long-lived storm (e.g. Jupiter's Great Red Spot analog). |
| `ice-cap` | TBD (planet surface shader) | body ref, pole (N/S), extent | Atmospheric/thermal proxy. |
| `volcanism` | TBD | body ref, UV locations, intensity | Only on applicable body types. |
| `aurora` | TBD | body ref, pole, intensity | Only on bodies with magnetosphere + atmosphere. |

## Category 5 — Light & composition

Light OOIs are compositional opportunities — they exist because of
geometry (body + star + observer) rather than as independent entities.
SHOWCASE camera mode is the primary consumer.

| Type | Producing system | Available data | Notes |
|---|---|---|---|
| `crescent` | Computed (body + star geometry from camera POV) | body ref, crescent angle, observation arc | Strongest when ~90° terminator. |
| `terminator-line` | Computed | body ref, line parameters | The day/night boundary — photographic. |
| `specular-highlight` | Computed (atmosphere / ocean shaders) | body ref, highlight position, specular power | Atmosphere backscatter, ocean sun-glint. |
| `ring-shadow-on-planet` | Computed (ring geometry + star position) | planet ref, shadow band geometry | Only on ringed planets. |
| `planet-shadow-on-moon` | Computed | moon ref, shadow geometry, t-window | Lunar-eclipse analog. |
| `backlit-atmosphere` | Computed (atmosphere shader) | body ref, back-scatter direction | Body silhouette + glowing rim. |

## Category 6 — Meta / cinematic

Meta OOIs are scene-level compositional subjects — they emerge from the
relationship between camera, ship, and other bodies. Useful for
cinematographic framing.

| Type | Producing system | Available data | Notes |
|---|---|---|---|
| `ship-silhouette` | Ship renderer + background body | ship ref, backdrop body, framing | Blue-Danube hallmark shot. |
| `parallax-pair` | Computed (foreground body + background feature) | fg body, bg feature, separation | Used to convey depth. |

## Adding a new OOI — minimal process (v0)

When a new rendering pipeline introduces a new type of OOI:

1. Add a row to the relevant category table above (or a new category
   section if none fit).
2. Fill `Type`, `Producing system`, `Available data`. Leave `Notes`
   open-ended.
3. If the OOI is *dynamic* (time-windowed), note the window semantics
   in `Notes`.
4. Reference this doc from the rendering system's own file header
   comment so future maintainers know the contract exists.

**This process will be formalized** by the PM workstream
`ooi-capture-and-exposure-system-2026-04-20` (in flight). Treat the
current process as interim.

## Known gaps (unresolved TBD rows)

Most `Producing system` cells are marked TBD because working-Claude
authored this doc during the autopilot feature-doc interview without
performing a full `src/rendering/**` audit. A follow-up pass should
trace each OOI to its actual producing class and fill the TBD rows.
Ownership: PM to schedule via the above workstream.

## See also

- `docs/WORKSTREAMS/ooi-capture-and-exposure-system-2026-04-20.md` —
  PM workstream formalizing the schema, the capture process, and the
  runtime-registry spec.
- `docs/FEATURES/autopilot.md` (in flight, 2026-04-20) — first
  consumer; drives the runtime-registry shape.
