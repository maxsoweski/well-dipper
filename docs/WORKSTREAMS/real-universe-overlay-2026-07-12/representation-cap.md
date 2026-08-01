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

## 1. At most 2 CLOSE stars per rendered scene (`star` + `star2`)

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
  **SUPERSEDED in part by `multistar-components-2026-07-19`:** a far companion
  now ALSO gains its **own component scene payload** — `systemData
  .componentSystems[idx]` carries a full generated sub-system (the component's
  star + known-planet pins + child-stream procgen fill), navigable via the nav
  component drill-in today and spawnable by Increment B's travel. It is a
  component scene of its own, NOT a slot in the pair's scene: no 3D scene body
  is spawned in the parent scene, so this section's heading ("(data-level), not
  close stars") and §5's "Far-companion planets remain data-level … never scene
  bodies" bullet — both of which this note explicitly governs by reference —
  remain literally true of the PARENT scene; only the "data-level" framing is
  superseded (the record is now also a full component payload). When Increment
  B lands a real far-companion scene transition, those passages need their own
  refresh.
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

  > **ADOPTED 2026-07-13 (Max — contract deviation to post-review ruling 6);
  > IMPLEMENTED Increment 5 (design D7).** Archive `snum == 1` is an implicit
  > single-pin — a real host whose archive record says the system has exactly
  > one star suppresses the procgen companion roll. `RealSystemOverlay.resolve()`
  > synthesizes `companionSpec = { kind: 'single', source: 'archive-snum' }` in
  > the no-table branch when the joined host has `snum === 1`; it rides the
  > existing `applyToContext → forceBinary=false` path (no `StarSystemGenerator`
  > edit). One-directional tightening: it can only suppress fabrication, never
  > add structure (snum>=2 hosts keep the live ~35% roll); the curated table
  > still wins wherever both apply, **by construction** — the pin only fires
  > when `tableEntry` is null. The contract AC4 amendment (case (e)) is recorded
  > and re-validated. **RNG-stream consequence (design fact 12):** suppressing
  > the roll SKIPS the `rng.chance(0.35 × binaryModifier)` draw rather than
  > overriding its outcome, so it shifts that host's downstream RNG stream — the
  > result is still deterministic and revisit-stable, but it IS a real change to
  > the `systemData` of those snum==1 hosts (all of which carry a contents
  > record, so AC8's procgen-only snapshot is untouched by construction).

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

## 6. Planet fill and the empty-system rate (Increment 5 — Alpha-Cen ruling)

Alpha Centauri A and B carry no confirmed planets in the archive, so the
authoring path leaves them to procgen fill (Proxima's known planets ride the
far-companion data, §2). The question raised was whether "fill-on" (letting
procgen populate a planet-free real star) is acceptable, or whether such stars
should render barren. Max's ruling settles it:

> **Max, 2026-07-14:** "I'm fine with fill-on so long as we occassionally [sic]
> get systems where there are no planets at a rate predicted by the relevant
> astronomy/physics."

Both halves of this resolve to **documentation, not code** (Increment 5 design
D8). The record:

- **Fill-on is the current behaviour — zero code.** `buildAuthoredContext` sets
  `starTypeOverride 'G'`, the A+B close-pair `companionSpec` (23.5 AU) and
  Proxima's `farCompanions` (planets b, d as archive data). It does NOT set
  `knownPlanets`, so `StarSystemGenerator` procgen-fills A and B normally, the
  same as any other planet-free star. Nothing needs to change to keep fill on.

- **The zero-planet condition is already satisfied by the existing empty roll.**
  Planet count is `rng.chance(0.08) ? 0 : round(gaussianClamped(mean, 1.5, 1,
  max))` — an **8% empty roll** shared by all generation paths, with a non-empty
  floor of 1. Contents hosts are floored at ≥1 by their injected knowns
  (astronomy-correct — a detected planet exists, so those systems are never
  rolled empty); purely-procgen systems and planet-free real hosts (Sirius,
  Alpha Cen A/B) get the 8% tail. `rng.chance(p)` consumes exactly one draw for
  any `p` (outcome-only sensitivity), so the empty roll is deterministic and
  revisit-stable. Empty systems are therefore a well-trodden path (~8% of all
  procgen today), and Alpha Cen A/B each independently roll planetless ~8% of
  the time — occasional planetless systems, exactly as the ruling asks.

- **Astronomy basis (researched 2026-07-14).** The truly-planetless fraction of
  stars is not tightly pinned by observation, but the engine's 8% sits inside
  the plausible envelope, on the planet-rich (few-empty) side:
  - ~30 ± 3% of FGK stars host Kepler-like systems averaging ~3 planets
    (He/Zhu et al., arXiv:1802.09526 — <https://arxiv.org/pdf/1802.09526>).
  - ≥50% of stars harbour planets as a Kepler lower bound
    (<https://www.universetoday.com/99309/nearly-all-sun-like-stars-have-planetary-systems/>).
  - The truly-planetless fraction is observationally unconstrained and strongly
    metallicity-dependent — metal-poor stars are overwhelmingly planet-free, so
    the real barren fraction is plausibly ~10–50% and star-population-dependent
    (<https://bigthink.com/starts-with-a-bang/stars-dont-have-planets/>).
  A flat 8% is a defensible constant for a solar-neighbourhood (metal-rich)
  population and honours the ruling; a metallicity- or population-aware rate is
  future refinement, not an Increment-5 requirement.

- **The calibration seam is NAMED, not built (AC8-safe).** Should a future
  workstream want to tune the empty rate, the safe seam is a context override:
  `galaxyContext.emptyChanceOverride ?? 0.08`, settable only on overlay/authored
  contexts. That leaves the shared constant — and therefore every purely-procgen
  system's `systemData` — byte-identical, so AC8's procgen-only snapshot holds.
  A **universe-wide** change to the empty rate (touching the shared constant)
  would regress that snapshot and is explicitly **successor-workstream
  territory**, out of scope here. This seam is documented, deliberately not
  implemented in Increment 5.

- **Recorded quirk (out of scope):** for the Alpha-Cen close pair, circumbinary
  fill starts at `2.5 × 23.5 ≈ 58.75` AU — beyond a G star's normal ~50 AU max
  orbit. Noted as an observation only; no fix in this increment.

## Why these bounds

Every consumer downstream (rendering, nav, gravity, camera, system map) already
speaks "primary + optional close companion + planets/moons/belts". The overlay
extends *what those slots can contain* (a white-dwarf close companion; planets
with real designations and parameters) without inventing new scene-graph shapes.
Wider structure is represented at the data level (far companions) or deferred to
each member being its own real catalog star. Elite-style honesty comes from the
data filling these slots, not from expanding the slot count.
