# world-engine-blackbody-emission — intent

ATMOSPHERE track increment **#2** (per `ATMOSPHERE-PLAN.md` row 2). Lab-only, in worktree
`~/projects/well-dipper-we-atmo` on branch `feature/world-engine-atmosphere`. Builds on #3a
(E5 bands/jets, `climate-e5.js`), which was MAX UAT-PASSED `9c80d40`.

## Why we care

Right now a genuinely hot world (a hot-Jupiter) renders **cold** — banded reflectance only,
no glow — which is just *wrong*. #2 stands up a thermal **emission register**: `E = Planck(T) → RGB`
added over the #3a reflectance, so hot bodies actually radiate visible light and cold bodies
correctly stay dark. It's the cheapest register entry (an **S** increment) and a *correctness fix*,
not a cosmetic feature. Its real leverage is downstream: the same emission compositor is reused by
aurora/lightning/airglow (#4), the brown-dwarf self-luminous path (#5), and lava-glow (#6) — one
S-sized producer, four consumers. It **completes hot-Jupiter** (the archetype whose whole identity
is thermal emission + an eastward-offset substellar hotspot).

Scope confirmed by Max 2026-07-01: all four elements in v1 (Planck→RGB additive · ~1100 K nightside
floor · substellar hotspot · eastward jet offset). The hotspot+offset is the hot-Jupiter identity
tell (UAT-RUBRICS line 142) — without it #2 doesn't really complete the archetype.

**Explicitly deferred (not this increment):** seed-varying the interior drivers
(`shellDepthFrac`/`internalHeat`/`dissipation`) — that's the recorded §(e) gap, deferred to the #9
game-port; v1 uses the archetype-constant `internalHeat` (same as #3a). The game wiring of real
D1 `tempEq` is also #9; the lab sources `tempEq` from a preset + a slider.

## Success criteria (Max's language, confirmed)

- Pick the **Hot-Jupiter** preset → it visibly **glows** (dull red/orange) over the bands, where
  before it was a cold striped ball.
- Pick a **cold giant** (Jovian/Neptunian) → **no glow** — stays reflectance-only (emission is
  correctly ~zero in the visible). The register does not wrongly light cold worlds.
- **Sweep T_eq up** (lab slider) → glow **appears and shifts red → orange → white** with temperature
  (the Planck locus).
- On a **locked** hot-Jupiter → a **substellar hotspot**, **offset eastward** by the equatorial jet,
  with the **nightside still faintly glowing** (~1100 K floor), not pure black.
- Emission is **additive over #3a reflectance** (bands still read underneath) and **deterministic**
  (byte-identical per seed; no `Math.random`/`Date.now`).
- **(UAT — Max's gate alone):** the hot-Jupiter reads as a *hot, self-luminous world* — glowing,
  hotspot-offset, cohesive with the bands — not a cold ball with a color filter.
