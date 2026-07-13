# real-universe-overlay-2026-07-12 — intent

> **GREENLIT by Max 2026-07-12** (post-review contract, 10 ACs, after the 3-lens
> adversarial review + round-2 verification). Build proceeds per the contract's
> increment plan, via workflows, in a fresh session.

Lane C (system details), successor to `naming-census-uniqueness-2026-07-07` (closed at
`a1d2d4c`, Max UAT 2026-07-11; reached master + GitHub Pages via lane B's `847ab19`
pre-deploy merge). Scoped 2026-07-12 from Max's ask 3 and the D6–D9 decisions deferred by
`ac5-decision.md`. Serves the exploration-immersion outcome (ENRICHED layer): the
predecessor made real stars carry their real *names* everywhere; this workstream makes
real systems carry their real *insides* — and makes the known universe findable.

## Why we care

Max's words (2026-07-12 scoping interview):

> "I want to see the stars I would expect to see when in the neighborhood of Sol or
> another famous star in the Nav screen; I also want to be able to search and find a
> system I know about (ditto for any other player, players will skew towards those into
> astronomy); I also want the systems I know about to match the characteristics for them
> that are already observed (type of star, known planets, etc.); this also goes for other
> structures like nebulas and so on"

On authoring:

> "I do want the ability to author systems though, and place them over the proc gen ones
> where we determine it's needed to match reality or as a creative decision for the game
> (e.g., a story location)"

On merging real data with procgen:

> "when real data runs out the system should fill the rest with procgen (we can look to
> Elite as a guide)"

Original ask (2026-07-07, predecessor intent):

> "all known systems/stars/planets we can reasonably easily find from scientific
> databases to be present in the game; that means names overwrite the algo ones … but
> then also system characteristics may have to replace the ones we have as well for those
> observed/known ones."

## Success criteria (Max's language)

- In the neighborhood of Sol or another famous star, the Nav screen shows **the stars I
  would expect to see** — real neighbors, real names, true positions, including
  dim-but-famous hosts (Proxima Centauri, TRAPPIST-1) once ingested.
- Max — or any player; "players will skew towards those into astronomy" — can **search
  and find a system I know about** from a player-facing search (real systems, named
  settled/notable systems, deep-sky structures) and travel there.
- **The systems I know about match the characteristics for them that are already
  observed** (type of star, known planets, etc.): Sirius arrives as an A-star with its
  white-dwarf companion; TRAPPIST-1 arrives with its seven known planets.
- **This also goes for other structures like nebulas and so on** — famous structures sit
  at observed positions/sizes and are findable by search.
- **When real data runs out the system fills the rest with procgen** (Elite as the
  guide) — deterministically, revisit-stable.
- The **ability to author systems** and place them over procgen ones exists as a
  data-driven capability, proven end-to-end by Alpha Centauri.

## Interview rulings (2026-07-12)

1. **True positions, never nearest-procgen snapping.** A real system's location may not
   depend on procgen output (starfield tuning must never move Proxima). The existing
   machinery already resolves real stars at true positions; snapping would be the new
   mechanism, and it reintroduces the revisit-instability class the predecessor killed.
2. **Bulk ingest, not curation.** Confirmed exoplanets ingested wholesale at build time
   (candidate source: NASA Exoplanet Archive; source, license, field coverage, and counts
   verified in-increment — not asserted from memory). Dim famous hosts become new real
   catalog stars at true positions.
3. **Structures enter as search + audit only.** Findable in the new search; positions/
   sizes audited against observation. No new structure authoring/expansion here (that's
   lane-D-adjacent successor work).
4. **Fold-ins:** the settled-systems catalog UI ask (ac5 addendum ruling 2) folds into
   this workstream's search surface. `system-tags-save-search` (save/share seedtags)
   **stays parked** — the search surface built here is its natural future home, but
   scoping it now balloons the workstream.
5. **Handcrafted-flagship mass authoring is out; the authoring *capability* is in** —
   registry entries defined as structured data (replacing Sol's hand-written-only
   `generate()`), Alpha Centauri as the proof case. Story locations are a future *use*
   of the capability, no content scoped here.

## Post-review rulings (2026-07-12, from the 3-lens adversarial contract review)

These are working-Claude scoping rulings made after the review workflow surfaced gaps;
they implement what Max ratified rather than extend it, and he sees them at greenlight:

6. **Stellar structure gets a data source and engine support.** The review found the
   contract promised real companions (Sirius's white dwarf, Alpha Centauri's three
   stars — part of Max's ratified "(a) real structure" answer) with no scoped source
   (the exoplanet archive covers only planet-hosting systems; HYG has no binary linkage)
   and no engine representation (star types stop at O–M; two-star cap). Ruling: a small
   **curated companion table** joins the ingest (famous systems first; may pin famous
   singles) — deliberately NOT a bulk double-star-catalog ingest (WDS-class data is
   noisy with optical pairs; curation is the "reasonably easy" route here, unlike
   exoplanets where the archive is clean bulk). A new engine AC (AC10) scopes the
   degenerate star class, known-planet injection, and far-companion representation,
   with an explicit cap: 2 close stars per system, wide companions as far companions
   or adjacent systems, documented.
7. **Alpha Centauri models as the A+B binary claiming all three catalog stars, with
   Proxima as a far companion carrying its known planets.** Matches astronomy (Proxima
   sits ~0.06 pc from the pair) and the alias machinery (all three stars inside the
   entry's claim radius resolve to the one authored system — never a procgen impostor).
   Sirius stays on the overlay merge path, NOT a registry entry, so authoring stays
   scoped to Alpha Centauri and Sirius's `findAt` behavior is unchanged.
8. **D9 resolved: no schema unification.** The overlay adds its own contents adapter
   over the ingested data; the five existing mechanisms stay as they are (finalizes
   ac5-decision's interim "tolerate the adapters" ruling for this workstream).
9. **Named-systems catalog contingency.** If a newly ingested real proper name collides
   with a shipped settled/notable catalog name, deterministically regenerating
   `namedSystemsCatalog.js` under the enlarged blocklist is in-scope remediation —
   shape disjointness does not protect bare-word proper names (e.g. "Vega"-class names
   share the settled catalog's shape).

## Out of scope (deliberate)

- New deep-sky content or rendering changes (lane D owns those surfaces).
- Bulk double-star-catalog ingest (WDS-class) — structure comes from the curated
  companion table only (post-review ruling 6).
- A generic third-close-star engine slot — the 2-close-star cap + far-companion
  representation stands (post-review ruling 6/7).
- Story-location/creative system authoring content.
- `system-tags-save-search` revival (parked; re-evaluate once the search surface ships).
- Catalog hot-swap support in `KnownSystems.associate()` (additive-only stands until a
  real need appears — successor flag 2 of `a1d2d4c`).
