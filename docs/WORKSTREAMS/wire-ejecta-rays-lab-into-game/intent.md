# wire-ejecta-rays-lab-into-game — intent

## Why we care

Max, 2026-09-02, ruling on the order of work for the world engine: *"I want to continue wiring up
all the features from the world engine before we try to further develop any of them."* F3 "Ejecta &
rays" is one of the two partial rows left in the plan's F-spine (◑ 4/7): the apron's four uniforms
reach the game through the crater driver block, the ray system's three do not. Max's MVP statement
is the standing bar: *"all of the planned features in World Engine are implemented in the World
Engine Lab **and** have been wired up in the main well-dipper game."*

**The plan had the rays in the wrong queue, and this scope moves them.** §7 "Queue (c)" says
`uRayBrightness ≡ 0` because `hasAtmo` is true on 100 % of bodies, so the wire would render
nothing until world generation produced airless bodies. That count (0 of 800, PLAN :131) was taken
over PLANETS only. Measured today over the same 24 `rocky-*` seeds the other wires use
(`scoping-corpus-2026-09-03.json`, 156 bodies): **56 of the 124 solid bodies — every plain moon —
have no atmosphere in the condition the game hands the pipeline**, the raw generator record is
`null` on all 56 (no visual-only terrestrial moon in this corpus), and the lab's own law gives them
ray brightness **0.70 min / 0.84 median / 0.94 max**, zero of them at 0. `deriveUniforms` (the lab's
derivation) and the pressure law `airlessnessOf` agree on 124 of 124. All 68 planets and
planet-class moons carry air (minimum surface pressure 0.105 bar) and read exactly 0. Gas bodies:
32 of 32 at 0. The 2026-08-20 decision packet had already recorded this correction — *"the input is
live — 54.7 % of the 1156 are airless — and `uRayBrightness` is 0 for the prior reason that no pack
writes it. It is (b), not (a)"* (`r-rows-decision-packet-2026-08-20.md:441-444`) — and the PLAN's
two queue-(c) sentences (:133, :574) were never updated. So F3 is a queue-(b)-shaped wire: one
uniform with a live input, two constants, **live on 45 % of the game's solid bodies from day one** —
the moons, which is where the real Solar System paints its rays (Tycho and Copernicus on the Moon,
Kuiper on Mercury, the bright-ray craters of Callisto and Rhea).

Max's words on the rays themselves are thin. The lab's F3 UAT (2026-06-10, Frozen preset, solo)
rated the rays 🟡 with his feedback still *"pending — decide full-disk ray treatment"*; the card's
judging list (§6) is the nearest thing to his criteria and is quoted in the success criteria below.
Whether the lab's rays are GOOD is a development question his ruling parks; whether the game
carries them is this wire.

⭐ **What this wire IS, in pipeline terms.** Stage 1 (drivers: atmosphere retention, surface
age) → stage 2 (world generation: the generator's atmosphere record, `null` on plain moons; the
`erosionLevel` it writes from age) → stage 4 (render: `rayField` in `height.glsl.js:2190-2206`,
already spliced on the game's lab material at `planetShaders.glsl.js:516`, keyed
`if (uRayBrightness <= 0.0) return 0.0;`, its streaks following their craters through the crater
host and `provinceWeight(PROV_CRATERS)`). Stages 1, 2 and 4 exist in the game today. Missing: the
carriage — three names in the crater driver block — and ONE home for the law, which today lives
inline in `labCore.deriveUniforms` where the port's `craterUniformsFrom` cannot reach it without
re-typing it. Nothing bakes, no worker, no VRAM: three uniforms on a material.

## What the lab does that the game must — the DOES table

| DOES (output) | driver | player sees |
|---|---|---|
| `uRayBrightness` | the lab's law, `labCore.js:785`: `clamp01(1 − erosion) × (atmosphere ? 0 : 1)`, erosion read with BOTH spellings (`surfaceHistory.erosion ?? erosionLevel`, ROOT-0 fix 1) — airless-only, fading as the surface ages | bright radial spokes from the young craters on an airless body; nothing on any body with air; an old airless surface fainter than a young one |
| `uRayCount` = 6, `uRaySharp` = 8 | lab constants (`world-engine-lab.html:1175-1176`; the crater folder's only sliders with neither `.listen()` nor `.onChange`) — already the shared bag's defaults (`uniforms.js:178-179`) | how many spokes each crater throws and how crisp they are |
| the gate | `ejectaEnabled` — rays share the apron's toggle (`:5365`), so the pack's `EJECTA_GATE`; ⚠ NO `craterRelevance` multiply on the rays (`:5365`), unlike the apron (`:5361`) — measured, mirrored | on under the game's ALL_ON policy |

**Where they will render.** Biggest airless moons in the corpus: `rocky-13` (11 airless moons —
p3m0 volcanic 1.27 R⊕, p3m1 rocky 1.14 R⊕, p4m3 ice 1.06 R⊕), `rocky-14` p3m0 volcanic 0.65 R⊕,
`rocky-10` p4m1 ice 0.48 R⊕. `rocky-2`'s two moons are 0.027 and 0.019 R⊕ — too small for the walk.

**UNLOCKS.** F3 flips to ✅ 7/7; the last relief-domain partial closes; every ray-facing lab
increment (the full-disk ray treatment his 2026-06-10 feedback left pending, the cell-boundary
truncation carry-forward) reaches the game the day it lands in the lab.

## Success criteria (Max's language where he gave it; the card's judging list; the wiring rules)

- The game's rays are **the lab's ray law** — ONE definition under `src/` that `labCore` and the
  port both import; the inline law at `labCore.js:785` becomes a call; no second transcription.
- On an airless moon in a procedural system the *"bright rays read as discrete radial spokes from
  young craters"* (card §6), *"present only on airless"* bodies and *"absent under any atmosphere or
  high erosion"*, brightening *"only the SUNLIT hemisphere"* — on every planet with air, nothing.
- Each body its own: ray brightness is a function of the body's own record (its age, its air), the
  same on every return.
- ⭐ **Nothing else about the universe moves.** With the ejecta gate off the render is byte-identical
  to today (the lab's own off state); every other driver every pack emits is unchanged; the lab's
  own derivation is byte-identical to itself before and after the move.
- The lab in Chrome still authors: ✓ ejecta drops rays with the apron, the two sliders read the
  shared constants, 🎲 re-derives the brightness.
- Every cost is recorded: per-body resolve time; zero VRAM; no worker; no new attribute.
- ⭐ **Max's gate:** flying in on an airless moon in a procedural system with the A/B key — do the
  rays read as part of the cratered surface, spokes thrown from their own craters, and do they stay
  off on the worlds with air? He judges the WIRE. The card's carry-forward — *"cell-boundary ray
  truncations … an obvious clipped square"* at full-disk view — is a lab defect already logged and
  deferred by the 2026-09-02 ruling; it will be visible and is not this gate.

## Decisions taken in scoping (stated so Max can overrule at greenlight)

1. **The law's home is a new shared module** `src/worldengine/base/ejectaRays.js` exporting
   `rayBrightnessOf(condition)` (the lab's law verbatim, both erosion spellings), `RAY_COUNT = 6`
   and `RAY_SHARP = 8`. `labCore.js:785` rides in place as `const rayBrightness = rayBrightnessOf(d);`
   (the line is cited by symbol); `craterUniformsFrom` returns `rayBrightness` from the same import;
   the crater driver block (`craterDeck.js:116-197`, shared by `craterDeckPack` for gas and
   `rockySurfacePack` for everything else) emits the three names beside `uEjectaStrength`. No class
   guard: on gas the law itself returns 0.
2. **Gate = `EJECTA_GATE`, no `rel` multiply** — the lab's per-frame writer, measured (:5365 vs :5361).
3. **The two constants are WRITTEN by the pack, not asserted-equal** — the F2 precedent
   (`uTerraceCount: cu.terraceCount` is a constant the pack writes). The lab's state literal
   (`:1175-1176`) imports the same two names, so there is one `6` and one `8`.
4. **The airless read stays the lab's `!!atmosphere`** — not re-expressed as the pressure law
   `airlessnessOf`. Identical on all 124 corpus bodies today (measured); a body between 0 and 0.1 bar
   would differ (Mars-class rays through thin air), and that is a change to the law — development,
   parked by the ruling, logged.
5. **A/B key `Y`** — the only unbound letter (measured `grep -rhoE "'Key[A-Z]'" src`: A–X and Z are
   bound; the handler ignores modifiers, the V/J/U/I rule). Instrument `globalThis._labRays` over
   every live lab material (planets AND moons): `toggle()` writes 0 / restores the pack's value,
   `sabotage(surface)` writes 1.0 onto a body WITH air — a state the law forbids — the third state;
   `record()` says which state a surface is in; never persists.
6. **The live subjects are `rocky-13`'s big airless moons** — p3m1 (rocky, 1.14 R⊕) first because the
   ray term multiplies the crater host and a volcanic moon may be sparsely cratered; p4m3 (ice) second;
   the air control is any planet of the same system; the gas control its giant if it has one.
7. **The PLAN's stale claims are annotated in place, line-neutral:** the queue-(c) sentence at :574
   and the queue list at :133 (absorbing the 2026-08-20 correction), and the three references to
   `conditionFromPlanet.js` (:20, :133, :574 — the file is `conditionFromBody.js` now).
8. **Sol excluded by provenance** — its moons render through the legacy `Moon.js` shader, which
   declares no `uRay*`; permanent by the standing rulings.

## Deliberately NOT in this workstream — logged, not built

- **The ray law itself:** the full-disk ray treatment (his pending 2026-06-10 call), the
  cell-boundary truncation carry-forward, thin-air (Mars-class) rays via `airlessnessOf`.
- **A world-generation row:** a terrestrial plain moon's atmosphere record is `{ color, strength }`
  with no physics (`MoonGenerator.js:217`); the adapter refuses it (reads airless) while the
  generator's erosion law treats the same moon as air-bearing. Zero such moons in this corpus;
  logged for the generator, not touched.
- **F43 `uFacetStrength` / F46 `habGate`** — still queue (c); their inputs were re-measured on
  2026-08-20 and remain degenerate for a different reason (`retained === false` unreachable;
  `biosphereOf` 0 on 97.9 %).
- **Any change to `craterUniformsFrom`'s other outputs, the crater schedule, or the apron law.**

## Risks named up front

- **Rays follow craters.** The ray term is multiplied by the crater host; a body the crater
  schedule leaves bare shows no rays however bright the gate. The live pair names the body class it
  measured on; a null on a volcanic moon is attributed to the crater population, not the wire.
- **Line-cited files.** `labCore.js:785` and the crater block are cited by line+symbol; edits ride
  existing lines. The PLAN is line-count-neutral below :24 (1256 lines at scoping) and gains its
  addendum at EOF; `node tools/port-uniform-delta.mjs --check-citations` runs LAST before each commit.
- **The lab's shrink-only ratchet** pins the set of `state` fields; the constants import changes
  two values' SOURCE, not the field set.
- **The A/B instrument must touch only lab materials and never persist a sabotage arm.**
