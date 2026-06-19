# rivers-fluvial-coupling-2026-06-19 — intent

**Orientation:** Well Dipper → SCREENSAVER heart → planet-LOD lab renderer (lab ≠ game,
by design) → Phase 2 per-feature quality pass → **Theme A (wrong generation primitive)**.
This is the first concrete step of the broader **fluvial co-dependence** arc.

## Why we care

Max, 2026-06-19 (north star): *"landscape generate in such a way as all of the features
are informed by each other and we get distinct illusions of three-dimensional shapes as
opposed to a semi-homogeneous slop or mush of intersecting features that don't feed off
each other."*

Max, this session: *"a system that produces distinct terrain features rather than a kind
of homogenous slop because the features work together / inform each other meaningfully."*

The shipped dendritic rivers already route on the **real composed terrain**. But the
*downstream* fluvial features — deltas, outflow channels, coastlines — still form from
**abstract global climate scalars and a decorrelated noise field**, not from where the
rivers actually are. So they're the "slop": features that intersect the landscape without
feeding off each other. This workstream makes the fluvial family **causally depend on the
real river network** — deltas at real mouths, the megaflood outflow on the real trunk,
coasts biting in where rivers breach — so the landscape reads as one coupled system.

**Scope boundary (Max set):** the *fluvial family only* (deltas, outflow, coastlines).
Broader relief-coupling (mountains ↔ canyons ↔ scarps composing into coherent massifs) is
SEPARATE later work — keep this shippable.

## Decisions taken in scoping (Max delegated to the north star, working-Claude resolved)

1. **Climate vs rivers** → the dendritic field decides *presence + placement*; the
   `state.fluvial*` climate scalars are demoted to a neutral-by-default global *intensity*
   trim. The slop was abstract *location-gating* (`fluvialWet`), which is removed; a wetness
   multiplier that only scales correctly-placed features is not slop.
2. **Always-on** → the router runs unconditionally per planet (preset/seed change) so
   coupling exists by default; the visible river *ribbons* stay an independent display toggle.
3. **F13 outflow** → keep the existing megaflood scour *profile* but locate/gate it by the
   baked Strahler-order channel so it follows the real high-order trunk — causal AND still a
   distinct landform.

## Success criteria (Max's language — confirm/adjust at greenlight)

- On any default wet planet (without me toggling rivers on), the **deltas sit at the actual
  river mouths** and the bigger rivers make the bigger deltas — not deltas scattered wherever
  a noise field happened to cross the shore.
- The big **megaflood outflow channel runs down the real main river** (the trunk), and if I
  reseed the rivers, the outflow moves with them.
- The **coast bites in / behaves differently right where a river reaches the sea**, on top of
  the shoreline already flooding the carved valleys.
- Reseeding or changing the planet keeps it coherent — the fluvial features always track the
  real rivers, never drift back to "mush."
- It reads as **one coupled system** — distinct, mutually-informing landforms — clearly
  better than the pre-coupling abstract-scalar version.
