# The orrery draws a different system than the one you are in

**Status:** open, unscoped. **Max ruled 2026-09-04 it gets its own session** ("2. yes").
Found while verifying `derived-world-class`; **it is not a defect of that change** — it reproduces
with the label split reverted, and it is about WHICH system the orrery renders, not how it colours it.

## The measurement

Driven live at `localhost:5175/well-dipper/`, hard-reloaded, dev-server cwd checked to be this lane.

| | the scene (`_lab.systemInfo()` + `_systemData`) | the orrery, per instrumented frame |
|---|---|---|
| deep link `?system=rocky-126` | `rocky-126` — 6 planets, star A | **Sol** — Earth, Mars, Jupiter, Saturn, Pluto, Eris… |
| after the Habitable Planet search warped | `VLC J3DG0MO8+HZDHN9R` — carbon, terrestrial, rocky, sub-neptune | 4 discs: **rocky, rocky, venus, ice** |

The second row is the sharper one: the game agrees with itself (`isInSystem() === true`, the debug
panel and `_systemData` both name `VLC J3DG0MO8+HZDHN9R` with those four planets) and the orrery still
draws a different set.

**How the orrery's draw was measured, rather than inferred from pixels:** `ctx.arc` and `ctx.fill` on
`#nav-computer-canvas` were wrapped for ~300 frames and every planet-sized disc recorded with its
`fillStyle`. Per frame: `#a09080` ×2, `#c0a050`, `#b0c8e0` — i.e. rocky, rocky, venus, ice. Those are
`NavComputer`'s own `planetColors` values, so the colour lookup is working; the PLANET LIST is wrong.

⚠ A pixel scan alone would have been misleading here — the habitable-zone ring is drawn in green at
0.15 alpha, so "is there green on the canvas" is not the same question as "is a planet drawn green".

## Why it matters

It is the other half of what the label split was for. Max's criterion was *"I can spot a habitable
world on the system map before I fly to it"* — and that cannot be trusted while the map may be
describing a different system than the one you are in. The label split closed the naming half
(the info panel, the seed search and the cockpit row all tell the truth now); this is the map half.

## What is NOT established

A plausible mechanism is that the orrery regenerates from the galactic star rather than reading the
spawned scene, and that a regeneration without the same galaxy context yields different planet types.
**That was not tested.** Do not repeat it as fact — it is the first hypothesis to falsify, not a
finding.

Two other things worth checking before assuming a single cause:
- whether the debug spawn path (`_lab.spawnProceduralSystem`, `?system=`) moves galactic position at
  all — if it does not, this may be a debug-path artifact and normal warp play may be unaffected;
- whether the same divergence reproduces after a genuine in-game warp, which is the case that matters.
