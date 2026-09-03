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

What the 3/4 hides, **measured today:** the game draws the twilight band on every body with air —
live on `rocky-2`, `uTermStrength` 0.15 on six of six planets and a frozen ON/OFF pair on the second
planet reads rim-annulus signal above a zero floor (one seed, near-full phase, faint: 0.096 % of the
annulus, max 9/255); headlessly, the parent's pack fixture holds 67 of 68 air-bearing solid bodies at
0.15, one at 0.13 (rocky-3's first planet, 0.11 bar — the value is `columnFraction × 0.15`, a
CEILING, not a constant), all 32 gas bodies at 0.15, all 56 airless at 0. Meanwhile the lab has
shipped the band OFF on all 13 dressing presets since Max's ruling of 2026-07-16 — verbatim, from
the lab-ux contract: *"We need to disable terminator gradient totally; it doesn't work but also this
is ultimately something that will need to be rendered in the lighting engine of the main game
anyway."* That ruling was APPLIED as a reversible defaults amendment — *"removed from
DEFAULT_DRESSING on all 13 presets … Manual toggle stays"* — so the lab's OFF lives in its preset
dressing table, not in a constant. The game's gate policy — his 2026-08-06 ruling #4, `gates =
ALL_ON`, a blanket answer for ~40 checkboxes — turned it back on without anyone deciding F35. His 2026-08-22 ruling on the pack
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
| 1 | `uTermStrength` | `terminatorOptics.js:95` → lab writer `:5044` (gated on `terminatorEnabled`, OFF on every preset via `DEFAULT_DRESSING`) | `solidOptics.js:100`, `giantSurface.js:296` (gated `TERMINATOR_GATE`, forced ON by ALL_ON); plain moons through solidOptics at 0 (no air); ⚠ a second, UNGATED producer on the legacy material at `Planet.js:1653` (Sol + gallery bodies) | ✅ wired — ON in the game, OFF in the lab |
| 2 | `uTermWidth` | `terminatorOptics.js:47-50`; ⚠ the lab RETYPES `termWidthFor` at `:2505`, superseded at `:2630` / `:2821` (dead-but-live text) | `solidOptics.js:101`, `giantSurface.js:297` | ✅ wired |
| 3 | `uTermColor` | `atmosphereOptics.js:155` | `solidOptics.js:102`, `giantSurface.js:300` | ✅ wired |
| 4 | `uTermBypass` | lab `:5352` from `state.termBypass` (default `false`, `:1144`) | NOTHING | ❌ — a display knob, no law |

## Success criteria (Max's language where he gave it; the wiring rules otherwise)

- **The game and the lab show the same terminator** (*"end up working the same"*): with the lab's
  ✓ enabled off on every preset, the game's band is off on every body the world-engine pipeline
  admits — planets, gas bodies, moons — through ONE declared value both front-ends read at their
  real producers (the game's gate policy; the lab's preset dressing table AND its state literal),
  not two files that happen to agree today. Recorded honestly: the lab keeps its reversible ✓ toggle
  and the game has no runtime equivalent, so they agree at the lab's DEFAULT and diverge whenever
  that box is turned on; and the legacy material's own producer (`Planet.js:1653`, Sol) is declared,
  not converged.
- `uTermBypass` and `uLimbBypass` each have one producer: display policy beside `uLevels`, at the
  lab's defaults; byte-inert today (0 → 0).
- The lab's retyped width law is gone; `terminatorOpticsOf` is the one definition.
- ⭐ **Nothing else moves.** The aurora gate stays on; the width and colour stay derived and written
  (only the strength's gate flips); every other driver every pack emits is unchanged; the lab is
  byte-identical to itself.
- The lab in Chrome still authors: ✓ enabled, the bypass checkbox, the driven sliders.
- ⭐ **Max's gate:** on a planet with air, at the day/night line, the `.` key — the warm twilight band
  appears (the pack's resolved law value for that body, at most 0.15) and vanishes (what ships, per
  his 2026-07-16 ruling). Does the
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
   the line. A NEW declared policy `GATE_POLICY_RULED` becomes `gatesFor`'s default — every declared
   gate true except the ruled ones, resolved per declared name (`rulings[g] ?? true`), never by
   assigning a map over the result; `GATE_POLICY_ALL_ON` is kept and still means all-on, so ruling
   #4 stays truthful and `main.js:4069-4071`'s provenance string names the policy that ran. The
   absent-gate throw stays alive. The LAB reads the constant at BOTH of its producers: the preset
   dressing table `DEFAULT_DRESSING` (`planet-feature-associations.js:493`), built by a function of
   the rulings so its 13 entries include or omit `terminator` under the constant, and the state
   literal (:1053). Every constant gets a parameter seam (`gatesFor(entry, policy, rulings)`, the
   dressing builder's rulings argument, `buildLabPlanetMaterial(opts)`) so the controls flip a
   PARAMETER, not a `const` export — the storm workstream's amendment already paid for that lesson.
   The writer then resolves the gated `uTermStrength` to +0 on every admitted body (the standing
   rule that gated pack drivers resolve to 0 when OFF, `writePackUniforms.js:186`).
3. **The bypass pair as display policy:** `uTermBypass` and `uLimbBypass` written in
   `buildLabPlanetMaterial` on the `uLevels = POSTERIZE_LEVELS` line (`LabPlanetMaterial.js:211`,
   rides in place) through `opts.termBypass ?? TERM_BYPASS`, the constants (= the lab's defaults,
   false) declared in that file beside the line; the lab's state literal (:1143-1144) imports them
   and its per-frame writer stays a relay from state. Not a pack driver: a knob with no per-body
   producer is not a law. Recorded plainly: the bypass's only consumer sits inside the shader's
   `uTermStrength > 0` block, so once the band is OFF it cannot move a game pixel — the 4/4 records a
   PRODUCER, and it becomes reachable the day Max rules the band back on.
4. **The width retype at `:2505` is deleted, byte-identically** — on non-gas it is superseded
   in-function at `:2630`; on GAS it is NOT superseded (it runs LAST: `:2821` lives in
   `ensureNetworkRouted`, and the lab's own note there records `applyDrivers` re-writing the triple
   afterwards), so the deletion is admissible only because the two values are EQUAL — which the
   pre-change fixture proves on every gas preset in BOTH call orders.
5. **A/B key `.` (`Period`)** — unbound (measured: every letter A–Z but Y is bound, and Y goes to the
   ray wire; bound non-letters are Backquote, Digit1, Enter, Escape, Space, Tab). Instrument
   `globalThis._labTerm` over every live lab material: `toggle()` writes the pack's RESOLVED law
   value for that body (read from the pack — `columnFraction × 0.15`, at most 0.15 on air-bearing
   and gas bodies, 0 on airless; never a literal) / restores the shipped 0; `record()` returns both
   values and proves the body is in the registry; never persists.
6. **The live pair is taken at a CRESCENT** (lit fraction 0.3–0.7, reached by rotating the camera
   about the body with `setCameraPose` and re-pinning the distance, the achieved fraction recorded in
   the shot-diff JSON), where the band is widest on screen, with a DERIVED bar: ≥ 0.5 % of disc
   pixels and max delta ≥ 8/255. Today's scoping pair on `rocky-2`'s second planet was at near-full
   phase (0.98) and moved 0.0266 % of the disc, max 9 — real (floor 0) but faint; a crescent must
   read at least an order of magnitude more, and if it does not the number is recorded and the work
   stops rather than the bar moving.
7. **The legacy programs stay, declared:** `Planet.js:552` (×3) adds the band raw and posterises
   after, and `Planet.js:1653` writes `uTermStrength` ungated on the legacy material; `Moon.js:515`
   shapes the terminator by type; `MaterialBodyShader.js:333`; `AsteroidBelt.js:143`. They are Sol's
   and the legacy paths, the plan's "R = to be replaced" rows for the lighting engine — a deny-scan
   fails on any NEW `uTermStrength` producer beyond these and the packs.
8. **F52 / the lighting engine is not this workstream** — development, parked by the ruling.

## Deliberately NOT in this workstream — logged, not built

- **The lighting engine (F52, terminator for all objects)** — Max's 2026-08-06 ruling puts it in
  scope for the program; the 2026-09-02 ruling parks it behind the wiring pass.
- **Any change to `terminatorOpticsOf`'s law or values** (0.15, the width ramp, the colour).
- **The legacy terminator programs** (decision 7).
- **Sol** (excluded by provenance).

## Risks named up front

- **This wire removes pixels the game ships today** — a faint warm band on every body with air (100
  of 156 corpus bodies, 11 of 18 presets). Max has seen game renders with it on (Step 6's gas-giant
  UAT, 2026-08-11) without naming it; the key exists so the removal is a thing he looks at, not a
  thing he discovers.
- **Six test lines and one fixture pin the band ON** (`driver-pack-solidoptics.test.js:159/:496`,
  `gas-body-lab-material.test.js:287/:344/:724/:751`, `tests/fixtures/pack-drivers-baseline.json`)
  — they are re-pointed with the ruling on each line and the fixture is re-captured with a diff that
  must be EXACTLY the terminator entries; they are in scope, not collateral.
- **Line-cited files:** `drivers/index.js` (fifteen refs by line — `gatesFor` is edited by riding
  its lines), `solidOptics.js`, `LabPlanetMaterial.js:211`, the lab's :1053/:1143-1144/:2505 (pad
  with `//` where a deletion would shift a cited line). PLAN line-neutral below :24.
- **The lab's shrink-only ratchet** pins field names; three values change SOURCE, no field is added.
