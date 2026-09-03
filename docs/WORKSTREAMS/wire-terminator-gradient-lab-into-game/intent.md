# wire-terminator-gradient-lab-into-game — intent

## Why we care

Max, 2026-09-02: *"I want to continue wiring up all the features from the world engine before we
try to further develop any of them."* F35 "Terminator gradient" is the other partial row in the
F-spine (◑ 3/4) and its note column is empty — nobody had recorded which piece is missing.

**The missing piece is small, and the row hides the real finding.** The plan's fractions count the
uniforms in each feature's block of `uniforms.js`; F35's block (:47-51) holds four: `uTermStrength`,
`uTermWidth`, `uTermColor` — all three derived by `terminatorOpticsOf` and written by the
`solidOptics` and `giantSurface` packs on planets, gas bodies and plain moons — and `uTermBypass`,
a lab GUI checkbox (*"term bypass quantizer"*, `world-engine-lab.html:4011`) with no per-body law
behind it and no writer anywhere under `src/`. Its sibling `uLimbBypass` is in the same state and
F34 reads ✅ 2/2 only because that name sits outside F34's block. So "the fourth piece" is one
display-policy line that moves no pixel at either default.

What the 3/4 hides, **measured live today on `rocky-2`:** every planet with air carries the
twilight band at strength 0.15 in the game (six of six; a frozen ON/OFF pair on the second planet
reads rim-annulus signal above a zero floor with the disc interior at 0), while the lab has shipped
the band OFF on all 13 dressing presets since Max's ruling of 2026-07-16 — verbatim, from the
lab-ux contract: *"We need to disable terminator gradient totally; it doesn't work but also this is
ultimately something that will need to be rendered in the lighting engine of the main game
anyway."* The game's gate policy — his 2026-08-06 ruling #4, `gates = ALL_ON`, a blanket answer for
~40 checkboxes — turned it back on without anyone deciding F35. His 2026-08-22 ruling on the pack
laws: *"the important thing here is the game and lab end up working the same."* And on the lighting
engine, 2026-08-06: *"yes, the lighting engine needs to work for all objects in game."*

So this wire converges the two front-ends on the terminator: the band's enable state gets ONE
declared value that both read — OFF, his specific ruling — until the lighting engine carries the
terminator for every object, which is F52 work parked by the 2026-09-02 ruling; the bypass knob gets
its one producer; the lab's one retyped copy of the width law goes; and a key lets him see, on the
day/night line of a real planet, exactly what the ruling removes.

## The four pieces — producer → consumer

| # | uniform | lab producer | game consumer | state |
|---|---|---|---|---|
| 1 | `uTermStrength` | `terminatorOptics.js:95` → lab writer `:5044` (gated on `terminatorEnabled`, OFF everywhere) | `solidOptics.js:100`, `giantSurface.js:296` (gated `TERMINATOR_GATE`, forced ON by ALL_ON); plain moons through solidOptics at 0 (no air) | ✅ wired — ON in the game, OFF in the lab |
| 2 | `uTermWidth` | `terminatorOptics.js:47-50`; ⚠ the lab RETYPES `termWidthFor` at `:2505`, superseded at `:2630` / `:2821` (dead-but-live text) | `solidOptics.js:101`, `giantSurface.js:297` | ✅ wired |
| 3 | `uTermColor` | `atmosphereOptics.js:155` | `solidOptics.js:102`, `giantSurface.js:300` | ✅ wired |
| 4 | `uTermBypass` | lab `:5352` from `state.termBypass` (default `false`, `:1144`) | NOTHING | ❌ — a display knob, no law |

## Success criteria (Max's language where he gave it; the wiring rules otherwise)

- **The game and the lab show the same terminator** (*"end up working the same"*): with the lab's
  ✓ enabled off on every preset, the game's band is off on every body — planets, gas bodies, moons
  — through ONE declared value both front-ends import, not two files that happen to agree today.
- `uTermBypass` and `uLimbBypass` each have one producer: display policy beside `uLevels`, at the
  lab's defaults; byte-inert today (0 → 0).
- The lab's retyped width law is gone; `terminatorOpticsOf` is the one definition.
- ⭐ **Nothing else moves.** The aurora gate stays on; the width and colour stay derived and written
  (only the strength's gate flips); every other driver every pack emits is unchanged; the lab is
  byte-identical to itself.
- The lab in Chrome still authors: ✓ enabled, the bypass checkbox, the driven sliders.
- ⭐ **Max's gate:** on a planet with air, at the day/night line, the `.` key — the warm twilight band
  appears (the lab's law value, 0.15) and vanishes (what ships, per his 2026-07-16 ruling). Does the
  razor terminator read right in the game while the lighting engine waits, or does he want the band
  back in the game in the meantime? His call with the key in hand; either way the value is one
  constant in one file, and the lab follows it.

## Decisions taken in scoping (stated so Max can overrule at greenlight)

1. **Direction of convergence = the lab's, OFF.** The specific ruling (*"disable … totally"*,
   2026-07-16) over the blanket policy (ALL_ON, 2026-08-06). If he rules ON at greenlight, the same
   constant flips to `true` in both front-ends and the lab's 13 presets get the band back — that is
   the cost of the other direction, stated so the choice is between two converged states, never a
   declared divergence.
2. **Mechanism:** `TERMINATOR_ENABLED = false` declared once in `solidOptics.js` with the ruling on
   the line; `gatesFor` applies a declared per-gate ruling map (`GATE_RULINGS`) over ALL_ON — every
   declared gate true except the ruled ones; the absent-gate throw stays alive (an undeclared name
   still throws); the lab's state literal `terminatorEnabled: false` (:1053) imports the same
   constant. The writer then resolves the gated `uTermStrength` to 0 on every body class — the
   standing rule that gated pack drivers resolve to 0 when OFF.
3. **The bypass pair as display policy:** `uTermBypass` and `uLimbBypass` written in
   `buildLabPlanetMaterial` on the `uLevels = POSTERIZE_LEVELS` line (rides in place), from
   `TERM_BYPASS` / `LIMB_BYPASS` constants (= the lab's defaults, false) declared beside
   `POSTERIZE_LEVELS`; the lab's state literal (:1143-1144) imports them. Not a pack driver: a knob
   with no per-body producer is not a law, and a pack that carried it would invent one.
4. **The width retype at `:2505` is deleted, byte-identically** — superseded on every path (non-gas
   at `:2630`, gas at `:2821`), measured against a pre-change fixture of the lab's own state.
5. **A/B key `.` (`Period`)** — unbound (measured: every letter A–Z but Y is bound, and Y goes to the
   ray wire; bound non-letters are Backquote, Digit1, Enter, Escape, Space, Tab). Instrument
   `globalThis._labTerm` over every live lab material: `toggle()` writes the pack's resolved law
   value (0.15 on air-bearing and gas bodies, 0 on airless) / restores the shipped 0; `record()`;
   never persists.
6. **The live pair is taken at a CRESCENT**, where the band is widest on screen. Today's scoping pair
   on `rocky-2`'s second planet was at near-full phase (lit fraction 0.98) and read only 0.096 % of
   the rim annulus moved, max delta 9 — real (floor 0) but faint; the build pair frames a crescent.
7. **The legacy programs stay:** `Planet.js:552` (×3) adds the band raw and posterises after;
   `Moon.js:515` shapes the terminator by type; `MaterialBodyShader.js:333`; `AsteroidBelt.js:143`.
   They are Sol's and the legacy paths, the plan's "R = to be replaced" rows for the lighting engine.
8. **F52 / the lighting engine is not this workstream** — development, parked by the ruling.

## Deliberately NOT in this workstream — logged, not built

- **The lighting engine (F52, terminator for all objects)** — Max's 2026-08-06 ruling puts it in
  scope for the program; the 2026-09-02 ruling parks it behind the wiring pass.
- **Any change to `terminatorOpticsOf`'s law or values** (0.15, the width ramp, the colour).
- **The legacy terminator programs** (decision 7).
- **Sol** (excluded by provenance).

## Risks named up front

- **This wire removes pixels the game ships today** — a faint warm band on every planet with air.
  Max has seen game renders with it on (Step 6's gas-giant UAT, 2026-08-11) without naming it; the key
  exists so the removal is a thing he looks at, not a thing he discovers.
- **Line-cited files:** `drivers/index.js` (fifteen refs by line — `gatesFor` is edited by riding
  its lines), `solidOptics.js`, `LabPlanetMaterial.js:211`, the lab's :1053/:1143-1144/:2505 (pad
  with `//` where a deletion would shift a cited line). PLAN line-neutral below :24.
- **The lab's shrink-only ratchet** pins field names; three values change SOURCE, no field is added.
