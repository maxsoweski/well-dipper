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

## 5. Bulk-merge fidelity caveats (Increment 3, AC3/AC4)

The bulk overlay merge (every arrival at a real catalog star gets its real
contents, procgen filling the remainder — design D1–D9,
`increment-3-design.md`) honours the bounds above and adds these deliberate,
documented fidelity caveats:

- **Known planets keep their ARCHIVE orbits.** Injected real planets
  (`p.known === true`) are exempt from the post-injection reshaping passes:
  migration never destroys, retypes, or reorbits them; the resonance snap skips
  any pair that involves a known (its real semi-major axis wins); and the
  binary-stability cull keeps every known regardless of the critical radius
  (`p.known || orbit > a_crit`). Their real `radiusEarth` / `massEarth` also
  survive the exotic/civilized overlay, which never selects a known planet as a
  candidate. Consequence: a tight real system (e.g. TRAPPIST-1, planets at
  0.012–0.062 AU) survives intact even when the primary rolls or is pinned to a
  companion — the planets are NOT physically re-solved against that companion.

- **A non-table host may roll a procgen companion around real planets.**
  Structure honesty is TABLE-scoped (design D4): only the curated companion
  table (`stellarCompanions.js`) pins multiplicity. A real host that is NOT in
  that table leaves the procgen binary roll live (~35%), so its known planets
  can end up orbiting inside a *rolled* (not observed) close binary. The planets
  are real; the companion is procgen. This is the accepted price of not
  ingesting a noisy bulk double-star catalog — famous real binaries (Sirius,
  Procyon, Alpha Centauri) are table-covered and correct.

  > **ADOPTED 2026-07-13 (Max — contract deviation to post-review ruling 6):**
  > archive `snum == 1` becomes an implicit single-pin — a real host whose
  > archive record says the system has exactly one star suppresses the procgen
  > companion roll. One-directional tightening: it can only suppress
  > fabrication, never add structure; the curated table still wins wherever
  > both apply. Implementation scheduled for Increment 5; the contract
  > amendment is recorded there (validate after edit).

- **`starTypeOverride` is catalog-sourced, never contents-sourced** (design D6).
  The primary's type always comes from the catalog `spect`, routed through
  `normalizeSpectralClass`. When a contents host joins, the host's full class
  string is recorded on `star.spectFull` for display honesty (merged systems
  only; the key is OMITTED, never null, otherwise).

- **D primaries carry main-sequence evolution labels** (cosmetic). A degenerate
  white-dwarf primary reached via override still runs the ordinary
  `stellarEvolution` path, which reports a main-sequence-style label; the
  visual/physical parameters are correct (STAR_PROPERTIES.D), only the evolution
  descriptor is nominal.

- **Far-companion planets remain data-level** (unchanged from §2): a wide
  member's known planets are archive-shaped data on `systemData.farCompanions`,
  never scene bodies. On the bulk path far companions only appear for a
  table-covered host that has them (Alpha Centauri → Proxima), which arrives via
  the AC5 authoring/alias path rather than a bare entry-name arrival.

## Why these bounds

Every consumer downstream (rendering, nav, gravity, camera, system map) already
speaks "primary + optional close companion + planets/moons/belts". The overlay
extends *what those slots can contain* (a white-dwarf close companion; planets
with real designations and parameters) without inventing new scene-graph shapes.
Wider structure is represented at the data level (far companions) or deferred to
each member being its own real catalog star. Elite-style honesty comes from the
data filling these slots, not from expanding the slot count.
