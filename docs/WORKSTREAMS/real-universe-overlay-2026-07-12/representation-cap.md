# Stellar-structure representation cap (AC10)

> Increment 2 of `real-universe-overlay-2026-07-12`. Written by working-Claude
> (Builder 2) alongside the AC10 engine support. This is the explicit, cited
> statement AC10 requires ("Representation cap is explicit and documented"). The
> overlay tests reference this file by path:
> `StarSystemGenerator.overlay.test.js`, `KnownSystemAuthoring.test.js`.

The engine can now represent more of a real system's observed stellar structure
than "one star, optionally one close companion" — but not arbitrarily much. What
the engine can and cannot show is bounded, on purpose, so that the data model
stays inside what the renderer, nav, gravity, and camera consumers already
understand. The bounds:

## 1. At most 2 CLOSE stars per system (`star` + `star2`)

A system's scene-rendered, gravitationally-modelled stellar content is capped at
the primary (`star`) plus a single close companion (`star2`). This is the
existing close-binary slot — consumed by spawnSystem/StarFlare, NavComputer,
SystemMap, GravityField, ShipCamera, all gated on `isBinary && star2` with the
`binarySeparation*` / `binaryMassRatio` / `binaryOrbitSpeed` / `binaryOrbitAngle`
sibling fields. The overlay does not add a third close-star slot.

- The close companion's spectral class comes from the curated companion table
  (`stellarCompanions.js`), normalized to a single `STAR_PROPERTIES` letter — now
  including the degenerate white-dwarf class **D** (e.g. Sirius B `DA2` → `D`).
- The full class string is retained on `star.spectFull` / `star2.spectFull` for
  display honesty, while the physical/visual parameters come from the normalized
  `STAR_PROPERTIES` row.

## 2. Wider members are FAR COMPANIONS (data-level), not close stars

A bound companion too far out for the close-binary slot (e.g. Proxima Centauri
at ~13,000 AU from the Alpha Cen A+B pair) is represented as an entry in
`systemData.farCompanions`, each carrying `{ name, class, type, separationAU,
planets? }`:

- **Data-level v1: no scene body.** A far companion is not spawned as a rendered
  star in the arriving system. Its own presence in the sky becomes its own real
  catalog star once Increment 3 loads the dim-host supplement (Proxima is in that
  supplement). The far companion here is the *structural* record that the wide
  member belongs to this family, plus its known planets as archive data.
- **Its planets are archive-shaped data**, not scene bodies (the far companion has
  no rendered system of its own in v1).
- `farCompanions` is **OMITTED entirely** from `systemData` when the overlay
  supplies none — it is never an always-present `null` (unlike the baselined
  `star2: null`). This keeps purely-procgen `systemData` byte-identical to the
  pre-Increment-1 AC8 snapshot.

Arrival still resolves to the ONE authored/merged system: a far companion's name
is a derived **alias** of the system (Proxima Centauri → Alpha Centauri), so
targeting the far member lands on the same authored system, never a procgen
impostor.

## 3. Higher-order multiples collapse to the brightest close pair

A real system with more than two close stars is represented by its brightest /
most significant close pair in `star` + `star2`; the remaining members are either
far companions (§2) or, where they are separately catalogued, adjacent real
systems in their own right. This is a deliberate fidelity caveat: the engine does
not model 3+ close stars in one system.

## 4. Real eccentricity is carried as DATA; orbits render circular

Injected known planets carry their real `eccen` value (when the archive has one)
on the planet wrapper as data — but the rendered orbit stays circular at the
planet's semi-major axis. Eccentric-orbit rendering is out of scope; the number
is preserved for future use and for honesty in any data readout. When the archive
has no eccentricity, the `eccen` key is omitted (never emitted as `null`).

## Why these bounds

Every consumer downstream (rendering, nav, gravity, camera, system map) already
speaks "primary + optional close companion + planets/moons/belts". The overlay
extends *what those slots can contain* (a white-dwarf close companion; planets
with real designations and parameters) without inventing new scene-graph shapes.
Wider structure is represented at the data level (far companions) or deferred to
each member being its own real catalog star. Elite-style honesty comes from the
data filling these slots, not from expanding the slot count.
