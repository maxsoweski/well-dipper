# system-identity-grammar-2026-07-17 — intent

## Why we care

Max's AC9 re-run finding #3 (2026-07-15, verbatim): "Rigil Kentaurus A&B are right up next
to Proxima Centauri A&B... looks like 3 stars right next to each other in the prism view and
then each is a binary system in the system view. I feel like we keep running into the same
issue..."

The recurring class: each past fix made one layer honest (naming → seeds/data → per-marker
glyphs) while cross-view identity was never an acceptance criterion. The data layer is
coherent (verified at `f6b3eff`: same seed from every member marker, preview ≡ arrival);
the presentation still lets one real system read as several.

Line of sight: exploration-immersion — a real star is ONE system, the same system, on every
path and every screen a player reaches.

## Max's directive (2026-07-17, verbatim — the ruling that scoped this)

"I want binaries/trinaries to appear as multiple dots in the prism view. I want the system
view for those systems to be the SAME system (which they are, realistically). I don't want
to click on one of the binaries/trinaries and end up in a different system in the nav
computer, or via warp."

Max delegated plan/implement/test ("you figure out how to plan/implement/test") — this
directive is the greenlight; the fork options (a)/(b)/(c) from
`../real-universe-overlay-2026-07-12/ac9-uat-findings.md` finding #3 resolve to:
(a) system-identity view + (c) prism co-membership cue, both in service of the invariant
above. Option (b) (component-centric arrival) is NOT chosen — sentence 3 pins arrival to
the one shared system.

## Success criteria (Max's language)

- "Binaries/trinaries appear as multiple dots in the prism view" — and when a system's
  members render as separate markers (α Cen A+B marker + Proxima's own marker), the prism
  visibly says they're one system.
- "The system view for those systems is the SAME system (which they are, realistically)" —
  clicking any member dot opens a view that names the system, shows its full structure
  (including far companions and their planets), and never presents a component as a
  different system under its own name.
- "I don't want to click on one of the binaries/trinaries and end up in a different system
  in the nav computer, or via warp" — every member marker previews and arrives at the same
  one system.

## Durable rule (closes the class, not the instance)

The directive becomes a written design rule in `docs/NAMING_AND_REAL_OBJECTS.md`: any view
of any component of a known multi-star system must name the system, show its full
structure, mark which component you're viewing, and cue co-membership wherever components
render as separate markers. Future multi-star presentation work cites it as an AC template.

## Deliberate non-goals

- Component-centric arrival (option b): clicking Proxima keeps delivering the whole
  Alpha Centauri system — ratified AC8 semantics unchanged. If Max wants per-component
  arrivals later, that is its own scoping interview; nothing built here is throwaway.
- Far-chip drill-in (planet-detail-style sub-view for a far companion's planets): parked
  as a natural extension; the chip itself lists the planets.
- Positions never move: catalog-true marker positions (interview ruling 1) stay; the
  co-membership cue is draw-only.
- Procgen systems: no naming/title change (no `_knownSystemNames` → title falls back to
  marker name exactly as today). The grammar rule binds known multi-star systems.
