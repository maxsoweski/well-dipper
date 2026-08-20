# R-05 / R-06 / R-07 — decision packet

**Written 2026-08-20 at `aa8bd1a`** (branch `feature/world-engine-production-L1`, tracked tree clean,
citation fence green at 525 / exit 0 / `[inputs 9e9c60e80978]`). Nothing in this packet changed any
code or any ruling. It exists so one sitting is enough.

---

## ⭐ THE ONE THING YOU DECIDE

**Whether the next block of work is aimed at PARITY — closing the declared losses so the new
pipeline draws what the old one drew — or at DIFFERENTIATION — making bodies read as different
kinds of body — because the measurements say those are two different jobs, and closing R-05, R-06
and R-07 completely would not change the thing you reported at UAT.**

Everything else in this document is in service of that one call. The scheduling of the three rows
individually is also yours and has been since 2026-08-09; this packet does not close any of them.

---

## HOW TO READ THIS

**Two things are both true and the packet says both.** The headless gate proves the bodies are
**not literally identical** — `tests/moon-render-path.test.js:539-545` requires ≥4 differing driven
uniforms per class pair and measures a clean-tree margin of 34/12/6/36/34/12. Your eyes say they
**do not read as different kinds of body**. Both hold. The gate is weaker than the thing you are
looking at: it measures "are any uniforms different", which is not "does this read as a different
kind of world". Nobody here is defending the gate.

**Every number carries its corpus.** The same population reads 632 or 770 depending on which corpus
and which walk produced it, and that exact confusion is already on record in this program. Where two
independent sweeps disagree, §6 says so rather than picking one.

**The shots are yours to read.** No agent closed a UAT on any of them, and none will. Where an agent
was tempted to say "the banding looks right", the temptation is parked as a question in §6 instead.

**Where the frames live.**
- WSL: `/home/ax/projects/well-dipper/screenshots/r-rows-2026-08-20/`
- Windows: `\\wsl.localhost\Ubuntu\home\ax\projects\well-dipper\screenshots\r-rows-2026-08-20`

27 files: 16 PNGs, 10 JSON sidecars, 1 pose record. Copied out of a session scratchpad, which is
ephemeral; this location is not.

⛔ **All frames were taken with `localStorage['wd.labGasBodies']` set explicitly — `'1'` for the lab
frames, `'0'` for the legacy frames. Neither is the shipped default (the flag is absent by default,
which resolves OFF).** A flag-ON frame is the lab material wearing the game's scene graph. It is the
right thing to shoot for a parity question and the wrong thing to call "the game".

---

## 1. R-05 — the lava world's crust, melt and crack glow

| | |
|---|---|
| **Ruling in the ledger** | `accepted-loss` (`docs/FEATURES/step6-parity-ledger.md:178`). Unchanged. Scheduling reserved to you. |
| **Symbols lost** | `crackGlow` `crust` `h` `melt` |
| **Population** | **52 lava-typed planets over `lab-procedural-0…199`, walking `sys.planets` only** — the ledger's own corpus and walk. |
| **Population the ledger does not count** | **a further 67 `volcanic`-typed plain moons over the same 200 seeds**, running `Moon.js`'s own lava branch — the same three-mechanism construction including the night-side glow (`src/objects/Moon.js:411`, `:469`, `:520`, `:549`). Two independent sweeps agree on 67. There is no per-symbol row for them anywhere; they are folded into `M-04`'s single `moonType` row, and §9 states plainly there is no Channel 2 for moons. **So the honest count of bodies losing incandescent cracks on this corpus is 52 + 67, not 52.** |

### What it looks like, in plain terms

A dark rock ball threaded with a glowing orange web that stays lit on the night side. Three separate
mechanisms make it and all three stop:

1. **The pattern is inverted and squared** — `n = 1.0 - abs(n); n = pow(n, 2.0);`
   (`src/objects/Planet.js:612-615`). That turns blobby noise into a network of thin lines. Those
   lines are the cracks.
2. **The surface colour mixes dark crust into an incandescent melt ramp along those lines**
   (`src/objects/Planet.js:785-787`) — deep red-orange at the chilled crack margin, bright orange at
   the molten core. Measured on `lab-procedural-170` p=0: `uLavaGlow` (1.000, 0.423, 0.102),
   `uLavaCrust` (1.000, 0.215, 0.057).
3. **The crack colour is added again as an emissive term outside the lighting**
   (`src/objects/Planet.js:844-848`) so the cracks glow through the terminator and across the whole
   unlit limb. This is the one a person notices from a distance.

After the swap: an ordinary grey rock, no cracks, no glow, day side or night. Relief also drops from
the branch's `perturbStrength 0.20` to whatever `uPerturb` gives.

### ⛔ The ledger's phrase is right as a mapping claim and misleading as a visual claim

R-05's evidence says the lab has a lava mechanism but "a different parameterisation, not a renamed
one" — which is exactly why it is `accepted-loss` and not `blocking`. Correct. What it does not say
is that **nothing draws in its place.** Measured live on the mounted lab material on
`lab-procedural-51` p=0 and `lab-procedural-170` p=0: `uLavaCoverage` 0, `uLavaActivity` 0. Those
are not neutral defaults — they are the shader's own early-out values
(`src/worldengine/shaders/height.glsl.js:2604` `if (uLavaCoverage <= 0.0) return;` and `:2638`
`if (uLavaActivity <= 0.0 || uLavaCoverage <= 0.0) return vec3(0.0);`). No `uLava*` name appears in
`rockySurface`'s 21-name write set.

### The shots

| file | what it is |
|---|---|
| `r05_lava_frame1_legacy.png` | The legacy material. Seed `lab-procedural-5`, `{kind:'planet',p:0}`, `body.planet.fe4e96`, type lava, R⊕ 0.870. Flag `'0'`. |
| `r05_lava_frame2_lab.png` | Same body, same pose, flag `'1'`. **This is the loss.** |
| `r05_lava_frame3_forced.png` | ⛔ **Control — not evidence the pack works. Read §1's warning below before reading this frame.** |
| `r05_lava_floor_a.png` / `_floor_b.png` | Two grabs of the identical state back to back. Floor 0.0000% in every region — which is itself the proof the freeze was absolute. |

Frame 2 vs frame 3, declared region disc: signal **75.9978%** against a **0.0000%** floor.
Frame 1 vs frame 2 (context only, whole-material change): disc **90.7%**–**96.7%** class — see §6 on
why that number carries a caveat.

### ⛔⛔ HOW TO READ FRAME 3 — this changes what the picture means

Frame 3 forces `uLavaCoverage 0.6` and `uLavaActivity 0.8`. A verification pass caught something the
shot run did not: **grep over `src/worldengine/drivers/*.js` returns ZERO writers for
`uLavaCoverage` and `uLavaActivity`.** No pack writes either uniform on any body. So frame 3 is not
"the named gate forced on" in the §12.2 sense — it is an operator hand-authoring a mechanism no code
path drives, with values (0.6, 0.8) that have no derivation recorded.

**The consequence for your decision:** if frame 3 looks like the thing that was lost, and R-05 gets
scheduled as a cheap two-uniform mapping fix, the work delivered would write
`uLavaCoverage`/`uLavaActivity` and would **not** restore `crackGlow`/`crust`/`h`/`melt` — which is
the same lava the ledger already ruled a *different parameterisation*, and whose uniform half `P-09`
already rules an accepted loss. Frame 3 shows what the lab's lava can draw. It does not show the
lost feature returning.

### If you did schedule R-05 as wiring, here is what it would actually buy

Measured over the 52 lava planets on `lab-procedural-0…199`, using `labCore`'s own laws:

- **Plains come back on 52 of 52.** `lavaCoverage = resurfacingRate × rockyCrust`, and
  `resurfacingRate` is 0.1 or 0.3 on every one.
- **The glow comes back on 6 of 52.** `lavaActivity` is driven by tidal heating, and only 6 of 52
  carry a `rawTidalIoRatio` above 0.01.

So ~88% of lava worlds would get smooth basalt plains with dark cracks and no incandescence — the
boring half.

⚠ **And a trap for whoever wires it.** `labCore` recomputes tidal heat from `massEarth`,
`orbitRadiusEarth` and `starMassEarth` (`src/worldengine/base/labCore.js:620-624`), none of which is
in the game's 18-key condition vector, so it silently falls back to 1 AU around 1 M☉ and **invents a
glow**. Measured: that fallback reports `lavaActivity` 0.631 on a venus body whose own
`rawTidalIoRatio` is 0.0045, and 0.000 on the largest lava body. The condition already carries a real
per-body `rawTidalIoRatio`; the derivation does not read it. Also worth saying: `resurfacingRate` is
0.1 or 0.3 on lava and venus alike — **the condition does not know a lava world is molten.**

---

## 2. R-06 — the ocean world's coastline, depth and flat water

| | |
|---|---|
| **Ruling in the ledger** | `accepted-loss` (`docs/FEATURES/step6-parity-ledger.md:179`). Unchanged. Scheduling reserved to you. |
| **Symbols lost** | `deepOcean` `height` `land` `landElev` `ocean` `oceanDepth` `seaLevel` |
| **Population** | **6 ocean-typed planets over `lab-procedural-0…199`, walking `sys.planets` only.** |
| **Population the ledger does not count** | **a further 3 ocean-typed planet-class moons over the same 200 seeds.** Planet-class moons are built as `new Planet(...)` (`src/main.js:7681`) and reach the same mount, but the ledger's census walks `sys.planets` only (`tests/material-parity-list.test.js:216-222`) and Channel M's 632 is plain moons. **Corpus-correct, R-06 is 9 bodies, not 6 — a 50% increase on the smallest row in the ledger.** One of the three (seed 62, p=4, m=2) is composition-class *gas* despite its ocean type label, so it is claimed by the gas packs rather than `rockySurface` — it still loses the legacy pt4 branch, but by a different route. |

### What it looks like, in plain terms

Water that reads as water. Four cues, all from `src/objects/Planet.js:727-742` and `:798-802`:

1. **A hard, tight coastline.** The land mask is a smoothstep across only 0.54→0.58 of the height
   range, so shores are crisp, not gradual.
2. **A depth gradient** running from dark deep basins up to a brighter shelf ring around every
   island — what makes the sea read as a fluid volume rather than blue paint.
3. **Sparse islands** whose interiors darken with elevation.
4. **The strongest cue: the water is glass-flat while the islands are bumpy**, because
   `perturbStrength *= terrainLandMask` (`:802`).

Measured palette on the subject body: sea (0.05, 0.25, 0.35) dark teal, land (0.10, 0.40, 0.35)
green-teal. After the swap all four cues go at once and the body is uniformly relieved rock in a
grey-brown palette — `uWeatheredColor` (0.433, 0.405, 0.369) **identical to** `uFreshColor`
(0.433, 0.405, 0.369), so the shader's own rock ramp is a no-op on the replacement body too.

### ⭐ The ledger's evidence for this row is wrong where it matters most

R-06's evidence says "the lab has its own continent/sea system, so this is replacement rather than
deletion" — inherited verbatim from R-03. **Measured on the actual bodies there is no replacement.**
Live on the mounted lab material, `lab-procedural-4` p=2: `uSeaLevel` **-1.0**, `uCoastStrength` 0,
`uLiquidMask` 0, `uStrandStrength` 0. -1.0 is the shader's own "this world has no liquid" state
(`src/worldengine/shaders/planetShaders.glsl.js:374`, `:391`; the shader's own comment at `:1241`
names it). The sea cut never runs, `liquidMask` stays 0 for every fragment, and the sunglint at
`:1236` multiplies by that same mask so the specular goes with it.

**An ocean world does not swap to a different ocean. It swaps to a dry rock.**

That correction belongs in the row's evidence column. It does not change the `accepted-loss` ruling
and it is not a fourth ruling.

### ⭐⭐ R-06 CANNOT BE CLOSED BY WIRING — and this is the single most schedule-relevant fact in the packet

If someone wired the lab's sea driver into `rockySurface` tomorrow, **all six ocean worlds would
still come out dry**, because the shared law would compute `uSeaLevel = -1` for them.

Measured, recomputing `labCore`'s own gate chain over all 6 ocean planets on `lab-procedural-0…199`:
`liquidStability` = 0, 0.0081, 0, 0, 0, 0 — above 0.01 on **0 of 6**. Their volatile fractions:
0.0410, 0.0579, 0.0436, 0.0385, 0.0276, 0.0282. The liquid gate's dry floor is
`smoothstep(0.05, 0.2, volatileFraction)` (`src/worldengine/base/labCore.js:643-644`, `:658`), so the
volatile term zeroes the product regardless of temperature or atmosphere. **Five of the six sit
inside the water temperature window (T_eq 261–318 K) with a retained atmosphere at 1.3–2.4 bar.
Temperature and pressure are not the problem. The volatile budget is.**

R-06 is a world-generation item wearing a port-mapping costume. Scheduling it as wiring would
deliver nothing.

### The shots

| file | what it is |
|---|---|
| `r06_ocean_frame1_legacy.png` | Legacy material. Seed `lab-procedural-4`, `{kind:'planet',p:2}`, `body.planet.4ef556`, display 'Paurosgara', type ocean, R⊕ 1.341 — the largest ocean body in the corpus. Flag `'0'`. |
| `r06_ocean_frame2_lab.png` | Same body, same pose, flag `'1'`. **This is the loss, and it is the largest identity change in the ledger.** |
| `r06_ocean_frame3_forced.png` | ⛔ Control. Forces `uSeaLevel 0.0` and `uCoastStrength 1.0`. |
| `r06_ocean_floor_a.png` / `_floor_b.png` | Floor pair, 0.0000% in every region. |

Frame 2 vs frame 3, declared region disc: signal **57.8072%** against a **0.0000%** floor.

⛔ **The same frame-3 warning as R-05 applies, and harder.** No pack writes `uSeaLevel` or
`uCoastStrength` either. The forced values are operator judgement: `uSeaLevel` is in accumulated-height
units, not 0..1, and the lab's driven law is `-0.2 + 0.5 × seaCoverage` over a range of -1…0.5, so
0.0 is about 40% coverage and must be paired with `uCoastStrength 1.0` or the shoreline pass stays
off. **Frame 3 shows what the carrier can draw when forced. It does not show anything the current
world generation would ever produce** — see the volatile-budget measurement above.

⚠ `r06_ocean_frame3_forced.json` is the one sidecar of ten with no `poseAssert` field. Reconstructing
it by hand shows position byte-identical and the quaternion differing in the last ULP
(-0.5000000000000001 vs -0.5000000000000002) — about 1e-16 rad, orders of magnitude below one pixel,
with ROI and geometry byte-identical between the two frames. **The 57.8% figure is not contaminated.
What is wrong is the record, not the number.**

---

## 3. R-07 — venus zonal banding. **Is it now closed? No. It was not built.**

| | |
|---|---|
| **Ruling in the ledger** | ⛔ `blocking` (`docs/FEATURES/step6-parity-ledger.md:180`). **Unchanged, and unchanged is the conservative direction** — `blocking` claims no closure. Re-ruling is yours. |
| **Symbols lost** | `bands` `lat` `swirl` `val` |
| **Population** | **130 venus-typed planets over `lab-procedural-0…199`, walking `sys.planets` only.** Re-measured independently and reproduces the ledger figure exactly. |
| **Population the ledger does not count** | **a further 4 venus-typed planet-class moons over the same 200 seeds** (seeds 43, 102, 105, 130). **Corpus-correct, R-07 is 134, not 130.** |
| **Wider corpus check** | Over `lab-procedural-0…1999` (8256 provenance-clean planets): 1230 venus-typed bodies. |

### What it looks like, in plain terms

Subtle sub-cloud stripes on a cream disc. The legacy branch is
`float bands = sin(lat*2.0)*0.15 + sin(lat*4.0)*0.08; float swirl = snoise(...)*0.12;`
(`src/objects/Planet.js:640-645`) painted into `mix(baseColor, accentColor, val)` at `:745`, on a body
the same branch deliberately flattens (`if (planetType == 8) perturbStrength = 0.0;` at `:800`,
commented "venus: hidden by thick clouds"). The amplitudes — 0.15, 0.08, 0.12 — are a deliberately
low-contrast effect. Of the three rows this is the smallest visual change on the disc, and the
largest population.

⚠ **The colour half is already ruled away.** `baseColor`/`accentColor` — the cream and yellow the
stripes are drawn *in* — are ledger row `P-08`, re-ruled `accepted-loss` on 2026-08-19. **A perfect
band closure restores stripe geometry into a palette that is already gone.** That caps the payoff and
is not something R-07's own row says.

### Why it is not closed: THREE pieces are needed and only ONE exists

**1. The carrier exists.** True, and the ledger is right about it. The lab material declares the whole
`uBand*` family (14 uniforms, `src/worldengine/shaders/uniforms.js:380-392`) and `giantDeck`
demonstrably writes it on gas bodies.

**2. ⛔ There is no condition-derived SELECTOR.** The only field that picks out the 130 is
`atmosphere.composition === 'co2'` — and `src/generation/PhysicsEngine.js:149` assigns that field as
`composition: type === 'venus' ? 'co2' : 'h2-he'`. It is the type label laundered through the
generator. Measured: over `lab-procedural-0…199`, `composition==='co2'` gives TP 130 / FP 0 / FN 0
against `type==='venus'`, with pressure 90.000 on 130/130 (one distinct value). Over
`lab-procedural-0…1999`: 1230/1230 exact, FP 0, FN 0. The genuinely condition-derived producer of
'co2' — `src/generation/PhysicsEngine.js:234` `composition: T_eq > 500 ? 'co2' : 'co2-n2'` — fires on
**zero** bodies across all 8256. So the field carries no information the label did not already carry,
and a predicate reading it satisfies the letter of `src/worldengine/drivers/index.js:19`'s type-label
prohibition while inheriting the label's semantics whole. It would also break silently the day the
generator's venus branch is made physical.

**3. ⛔ There is no STRENGTH LAW.** `uBandStrength` is not a boolean.
`src/worldengine/shaders/planetShaders.glsl.js:652` mixes the deck **over the entire rocky albedo**
at that weight — the in-source comment states the intent: a gas world has no surface to read, so mask
1 means pure deck — and `:444` relaxes the perturbed shading normal toward the geometric sphere by the
same weight. At 1.0 a venus body loses the palette, craters, iceness and relief `rockySurface` just
gave it. The legacy branch is the opposite shape: a ±0.35 modulation. Choosing a partial weight for a
rocky greenhouse world is authoring a law the lab has never modelled.

### ⛔⛔ The row's evidence names ONE gate. The code has TWO. The repair it points at cannot work.

R-07's evidence says `uBandStrength` is unwritten "**only** because `giantDeck`'s predicate is
`=== 'gas'`". The word *only* is load-bearing — it names the repair — and it is wrong.

- **Gate 1** is the registration predicate: `src/worldengine/drivers/index.js:100`
  `applies: (condition) => compositionClass(condition) === 'gas'`.
- **Gate 2** is inside the pack: `src/worldengine/drivers/giantDeck.js:163` recomputes
  `const gas = compositionClass(condition) === 'gas';` and `:178` writes
  `uBandStrength: scalar(gas ? 1.0 : 0.0, { gate: 'bands' })`.

`giantDeck.js:178` is the sole writer of `uBandStrength` anywhere in `src/worldengine/`. The comment
at `giantDeck.js:170-174` confirms the second gate is deliberate design — the master gates, not the
predicate, do the switching. **So widening the predicate is a no-op:** all 130 bodies would get
`uBandStrength = 0.0` and render exactly what they render today, and `giantDeck.js:200-206` returns
before the E5 bake chain anyway. Confirmed by calling `giantDeckPack` directly on a real venus
condition: 7 drivers, `attributes` empty, `meta.baked` false, `uBandStrength.value` 0.

This text landed at `db1cf51`, one commit before HEAD — it is pre-existing, not from this run. **The
`blocking` ruling is unaffected and arguably strengthened.** Only the repair-pointing evidence is
defective.

### ⛔⛔⛔ The strongest finding of the whole run: the gate exists, the FIELD does not

Frame 3 of the venus triptych was taken and is shipped **under a filename that says INADMISSIBLE**.
Here is why, measured live on the mounted material of `body.planet.245110`:

- `forceGate('uBandStrength', 1.0)` returned ok, `readsBack` 1, held 1.
- At the same moment, the `aBand` vertex attribute on that body's geometry has **4753 entries and is
  identically zero** — min 0, max 0, nonZero 0 — both before and after the force.
- `uStormCount` is 0, which kills the analytic proxy-deflection fallback too.

The band *value* is the per-vertex bake (`float bandVal = wBand + uBandWarp*0.16*r`,
`src/worldengine/shaders/height.glsl.js:2076`). `rockySurfacePack` returns `attributes: {}`, so
`ensureLabAttributes` zero-fills `aBand`; and `giantDeckPack` early-returns on a solid body before its
bake. So neither `forceGate` (uniforms only) nor `previewPack` can supply the field. **The master gate
was opened onto a band field that does not exist.** What that frame draws is the residual warp-noise
term mixed toward the default `uBandTint` — a tan wash, not zonal banding.

**And here is the part worth your attention.** `shot-diff` on frame 2 vs frame 3, declared region
disc, reports signal **73.6074%** against a **0.0000%** floor and prints **SIGNAL ABOVE FLOOR**. The
instrument cannot distinguish "the feature came back" from "a gate opened onto noise". Had that
triptych shipped without the `aBand` measurement beside it, 73.6% would have read as evidence that
R-07 closes by flipping a gate. **It does not.**

### And closing R-07 would not answer your UAT note anyway

Measured over the 130 venus planets on `lab-procedural-0…199`: `T_eq` runs 703.2 / 1013.9 / 1465.0 K
(min / median / max) against `giantDeck.js:69`'s vigor ramp `{LO: 55, HI: 130}` — so
`convectiveVigor` is exactly **1.000 on 130 of 130**, saturated 5.4× to 11× past its high edge. That
pins `uBandContrast` 1.0, `uBandWarp` 0.55, `uJetShearTurb` 0.30, `uJetFestoon` 0.45 as **one tuple,
1 distinct value across 130 bodies**. `uBandTint` is one colour on 130/130. `uBandM` is 1 distinct
value on 130. The bodies would gain stripes and stay indistinguishable from each other on every
headline dial.

### ⚠ A definitional gap that is §2's, not R-07's

§2's `blocking` test passes here (the carrier is declared). §2's stated *reason* for that test —
"so the loss is an omission in the port's uniform mapping" — is false here: there is nothing to map,
because neither the selector nor the strength law exists. Meanwhile §2's `accepted-loss` test also
fires, on its second clause ("a producer the plan has already fenced out of pack #1"), because PLAN §7
fences the physics-authoring job by name. **Two of the three definitions fire at once and §2 does not
arbitrate.** That gap is §2's. Inventing an arbitration silently is the same class of move as the
invented fourth ruling that `tests/material-parity-list.test.js:772` caught in one run, so nobody
invented one.

### ⚠ The existing closure fence is blind to this row

`'uBandStrength'` is **already** a member of the pinned `LEDGER.written` set
(`tests/material-parity-list.test.js:459-461`), because it is written on every gas body. So a
`P-04`-style containment assertion is green **today, with R-07 fully open**. Any future closure claim
needs a new per-branch assertion on the *field* — not the gate — or it will be a green test asserting
nothing.

### The shots

| file | what it is |
|---|---|
| `r07_venus_frame1_legacy.png` | Legacy material. Seed `lab-procedural-5`, `{kind:'planet',p:1}`, `body.planet.245110`, type venus, R⊕ 0.920. Flag `'0'`. |
| `r07_venus_frame2_lab.png` | Same body, same pose, flag `'1'`. **Frames 1–2 are a valid loss pair.** disc signal 98.9778% vs a 0.0000% floor. |
| `r07_venus_frame3_INADMISSIBLE_gate_forced_onto_empty_field.png` | ⛔⛔ **Not evidence of the lost banding. The filename carries the warning on purpose.** |

---

## 4. ⭐ "THESE ARE ALL IDENTICAL" — the answer

Your UAT note, verbatim: *"Pass, with the note that these are all identical and I assume working in
additional features/characteristics is in a future plan."*

Measured, you are right, and the measurement understates your point.

### The flattering framing and the honest one

The per-class quad's own numbers are 16 differing uniforms (rocky planet vs plain moon), 11 (rocky
planet vs planet-class moon), 17 (plain moon vs planet-class moon) — out of 356. That is the
flattering framing. The population figure over the same 200 seeds:

**336 of 356 uniforms are byte-identical on every one of the 1156 non-gas bodies in
`lab-procedural-0…199`** (505 rocky planets + 632 plain moons + 19 planet-class moons). Only 20 vary
at all, and 19 of those come from the single pack `rockySurface`. You are looking at a 94.4%-constant
material.

Live on the four quad bodies at `lab-procedural-6`: **318 of 356 identical across all four; 339 of 356
identical across the three non-gas bodies.** Of the 17 that differ across the non-gas three, six are
pose/LOD-dependent rather than body identity (`uCameraPosObj`, `uLightDir`, `uThermalDir`, `uOctaves`,
`uLodRamp`, `uBodyRadius`) and three are noise offsets that move *where* the lumps are, not what kind
of body it is — **leaving 8 names of 356 carrying "what kind of body is this."**

### The partition

Three causes, defined so the assignment is mechanical rather than a judgement:

- **(a) WORLD GENERATION** — the condition the generator emits is degenerate. No renderer change
  helps.
- **(b) PORT MAPPING** — the lab has a working producer and the shared expression does not write it
  on this body class.
- **(c) THE LAW ITSELF** — the shared law runs, writes a value, and the value is the same for nearly
  every body.

The partition is mechanical because the producer set is known: of the 356 uniforms, **21 are written
by `rockySurface` on a non-gas body, 26 by the gas packs only, and 309 are written by no `src/` pack
for any body class.**

### (c) — the biggest single reason the discs look alike

**The ground palette is one 25-degree slice of orange-brown on every rocky body in the galaxy, and the
shader's own posterisation swallows most of what variation is left.**

Measured over the 1156 non-gas bodies on `lab-procedural-0…199`, hue of `uWeatheredColor` (HSV, so
0–60° is red→yellow): min 13.3°, max 39.5°, 5–95 percentile 20.9°–38.0°, saturation median 0.20.
**There are no greys, blues, greens or whites.**

The mechanism: the only stage of `surfaceAlbedoOf` with wide dynamic range is
`mafic = smoothstep(0.08, 0.40, iron)`, which interpolates FELSIC_ROCK ↔ MAFIC_ROCK — hue 40° and 30°,
i.e. **a pure brightness axis**. Every stage that could move hue is suppressed. Then the shader
quantises: `posterize(litSurf, uLevels, ...)` with `uLevels` 6 (never written by any pack) is a 0.1667
step, and **82.9% of bodies sit within one step of the population-mean ground tone**. And the
endmembers collapse onto each other: `uCratonColor === uWeatheredColor` byte-for-byte on **73.6% of
1156**, and on **100% of the 632 plain moons**; `uFreshColor === uWeatheredColor` on 23.5%. On a
60-seed sweep (`lab-procedural-0…59`, 266 solid-pack bodies) weathered equals fresh within 0.01 on
**220 of 266 — 82.7%**. Where that holds, the shader's rock ramp `mix(uWeatheredColor, uFreshColor, ·)`
is a no-op and the body has one flat tone. It held on **all four quad bodies**.

**Craters — the only morphology `rockySurface` ships — are a moon-only feature by accident of where a
cost threshold sits.** Per class over the 1156: `cratersFired` on **2.4% of 505 rocky planets, 74.8% of
632 plain moons, 0.0% of 19 planet-class moons**. Cause: of the crater-relevant planets whose schedule
fires, **96.2% fall under `CRATER_MIN_DENSITY = 1e-3`** — median uncut coverage 3.97e-4, a factor of
2.5 below the cut. The constant's own comment calls it "a COST floor, not a physics one". And where
craters do fire, **465 of 1156 bodies get the identical crater size and slope** — `uCraterScale`
exactly 7.0710678 = 1/√0.02 — because the visible-resolution floor is body-*relative* and cancels the
body radius out of the answer, while the underlying physical diameter spans 11.1–1792.8 km across 485
distinct values. A 160× physical range emitted as one number.

### (b) — the port-mapping items

**The largest is `uNoiseScale`**, already ruled `blocking` twice (`P-10` at
`docs/FEATURES/step6-parity-ledger.md:130`, `M-09` at `:375`) and already scheduled by you on
2026-08-19 for *after moons ship*. It is pinned at 4.0 on all 1156 bodies while the legacy material
writes a per-body value spanning **4.831913 … 510.632404** (1156 distinct values). It is worse than
"less varied": the lab vertex shader does `vPos = position / uBodyRadius`, so `uNoiseScale` is in
**cycles per body radius**, and 4.0 is literally the same terrain frequency on a 0.007 R⊕ moonlet and a
2.5 R⊕ super-Earth. Measured live on the three loss subjects, the legacy values on the same bodies were
70.82 (lava), 21.51 (venus) and 27.85 (ocean) against 4.0 after the swap.

**R-07's `uBand*`** is the other named one — 130 bodies (134 corpus-correct), and §3 says why it is not
one line of wiring.

**And a correction to §7's own reasoning, worth having because it changes the owner.** §7 blames
`uRayBrightness ≡ 0` on world generation ("hasAtmo is true on 100% of bodies"). Measured today the
input is live — **54.7% of the 1156 are airless** — and `uRayBrightness` is 0 for the prior reason
that no pack writes it. **It is (b), not (a).** Same shape for `uFacetStrength`.

### (a) — the world-generation collapses

§7 confirmed at HEAD: `retained === false` never happens (0 of 524 planet records), so the adapter's
null-out branch is unreachable; `habGate ⇒ uBioCoverage ≡ 0` holds, and the wired sibling is just as
dead — `biosphereOf` is exactly 0 on **97.9% of 1156**, max 0.011535.

§7 **has moved and the correction is worse, not better.** `hasAtmo` is no longer 100% (45.3%),
`airlessnessOf` is no longer ≡0, `erosionOf` does return 0. But all three now take exactly **two**
values, and the split is not physical: **`hasAtmo` is exactly the predicate "is this a planet record"**
— 524/524 planets and planet-class moons carry an atmosphere object, 0/632 plain moons do, and the two
sets coincide perfectly. So three of the palette law's five stage weights are constants *within* each
class and differ only *between* classes. They are body-class labels wearing physics clothing — which
`src/worldengine/port/conditionFromBody.js`'s own header names as the signal that the law is
underspecified.

**Three degeneracies §7 does not name:**
1. `composition.carbonToOxygen` never reaches 1.0 (max 0.785, 1156 distinct values, well spread) while
   the palette gates carbon on `smoothstep(1.0, 1.3, co)` — so **CARBON_CRUST, the one near-black
   endmember that would make a world look radically unlike its neighbours, is unreachable on 100% of
   1156 bodies.**
2. `condition.rotationHours` is **24 on all 1156** — one distinct value.
3. `axialTiltDeg`, `habitability`, `magneticField` and `metallicity` are **absent on all 632 plain
   moons.**

### ⭐ How much does closing (b) actually buy? And does (a) dominate?

Under a declared binning metric — channels at the posterise step; `uPerturb`, `uCraterDensity`,
`uCraterScale`, `uIcenessMix`, `uEjectaRampart` in bins; noise offsets excluded because they move where
the lumps are, not what kind of body it is — over `lab-procedural-0…199`:

| | distinct signatures | largest bucket |
|---|---|---|
| 505 rocky planets, today | **48** | 20.0% |
| all 1156 non-gas bodies, today | **254** | top 5 buckets = 34.2% |
| all 1156, with `uNoiseScale` unpinned | **371** | 9.8% → **5.3%** |

That is real. It is also a constructed instrument, weaker than your eyes, and it is not the same thing
as reading as a different kind of body.

**⛔ THE SENTENCE YOU ASKED FOR, AND IT IS THE HONEST ANSWER: FIXING EVERYTHING CURRENTLY IN SCOPE IN
(b) — UNPINNING `uNoiseScale`, CLOSING R-07's BAND DECK, WIRING THE HANDFUL OF UNWRITTEN-BUT-PRODUCED
NAMES — STILL LEAVES THE BODIES LOOKING ALIKE.**

Relief frequency would become per-body across all 1156, and 130 bodies would gain stripes. The disc
would still be one posterised brown tone, because the disc-dominant signal is the palette law (c),
confined to a 25° hue slice, fed by inputs that never cross their own thresholds (a).

**Does (a) dominate?** Not exactly — the accurate statement is: **(c) is where the code is, (a) is
where the ceiling is, and (b) is the smallest of the three.** The palette law (c) covers 100% of the
disc on 100% of bodies and could be widened inside existing modules — but widening it without
hue-moving inputs buys brightness only, because the headroom lever (oxidation reaches at most 0.216 of
its own 0.60 cap) needs (a) work on volatiles and palaeo-temperature. The two crater floors, by
contrast, are pure (c) — two numbers inside `src/worldengine/port/craterUniforms.js`, no world-gen
required.

**Plainly: a rocky planet's entire visual identity in the shipped pipeline today is one of ~10
posterised brown tones × one of 5 relief-amplitude bins × one of 5 iceness bins × a noise offset, with
craters absent on 97.6% of planets. Closing R-05, R-06 and R-07 completely would not change that.**

### The quad

`quad_1_rocky_planet.png` · `quad_2_gas_giant.png` · `quad_3_plain_moon.png` ·
`quad_4_planetclass_moon.png` — all seed `lab-procedural-6`, identical framing (radii 3.0000), declared
phase 30°, disc-ROI, flag `'1'`.

The gas giant is the control: it is the only one driven by a *different* pack (`giantDeck`, 26
uniforms written vs `rockySurface`'s 21), and the predicates are exact complements. Measured live:
rocky-vs-gas 33 differing uniforms, gas-vs-plainMoon 35, gas-vs-planetClassMoon 36 — against
rocky-vs-plainMoon 14, rocky-vs-planetClassMoon 11, plainMoon-vs-planetClassMoon 17. **The three
non-gas bodies are much closer to each other than any of them is to the gas giant, which is the
structure of what you saw.**

⚠ **The quad shipped with no pre-declared claim** — no uniform, no population, no predicted visible
consequence, only setup metadata. §12.5 fact 1 requires all four. It also shipped as four singles with
no floor pair and no cross-frame diff number, so there is no measured quantity to weigh your reading
against. That is a genuine defect in how the quad was taken, and the consequence is exactly what fact 1
exists to prevent: there was no prediction your report could contradict.

---

## 5. THE OPTIONS

Each states what it will and will not achieve **in the game**. None of them closes a row's scheduling —
that is yours.

### Option A — Correct the ledger's evidence. No code.

**Does in the game:** nothing visible.

**Buys:** three corrections that each prevent a wasted pass.
1. R-07's evidence names one gate; the code has two, so the repair the row points at is a measurable
   no-op. Without this correction the next session widens `index.js:100`, re-measures, finds
   `uBandStrength` still 0.0 and `aBand` still empty, and the repair "fails with no stated cause".
2. R-06's inherited "replacement rather than deletion" is false as measured — `uSeaLevel` -1 is
   deletion — and the row's closure is blocked by the volatile budget, not by wiring.
3. The three populations should be labelled **planets only**, since planet-class moons swap through the
   same mount and sit in neither census: R-05 → +67 volcanic plain moons with no per-symbol row at all,
   R-06 → 9 not 6, R-07 → 134 not 130.

**Won't:** change a single pixel, or close any row.

**Cost:** hours. **Risk:** none — no ruling moves, no fourth ruling is invented.

### Option B — Parity push: schedule R-05 as wiring, and R-07's real closure

**Does in the game:** basalt plains on 52 of 52 lava planets over `lab-procedural-0…199`; the
incandescent glow on **6 of 52**. Nothing on venus without also authoring a physics selector and a
partial-strength law and a band field for solid bodies.

**Won't:** make bodies read as different kinds of body; restore `crackGlow`/`crust`/`h`/`melt` (which is
what R-05 actually rules — the lab's lava is a different parameterisation, so wiring it delivers a
different effect wearing the lost feature's name); touch the 67 volcanic plain moons unless they are
brought into a channel first; do anything for R-06 (see below).

**Risk:** the tidal-heat fallback invents glow on the wrong bodies unless `rawTidalIoRatio` is read
from the condition. And any R-07 closure claim will pass the existing fence while being false, because
`uBandStrength` is already in the pinned written set.

### Option C — Differentiation push: two crater floors, a hue-moving palette input, unpin `uNoiseScale`

**Does in the game:** restores morphology to roughly 490 rocky planets over `lab-procedural-0…199` that
currently have none, and de-pins 465 of 1156 bodies from a single crater size that has the body radius
cancelled out of it. Unpins terrain frequency across all 1156 — on the constructed binning metric,
254 → 371 distinct signatures and the largest bucket 9.8% → 5.3%.

**Won't:** close any ledger row. Won't restore lava glow, venus bands or ocean coastlines. Won't take
the palette out of its 25° hue slice — that needs (a).

**Note:** `uNoiseScale` is `P-10`/`M-09`, ruled `blocking` and already scheduled by you for after moons
ship, so part of this option is a sequencing question about work you have already ordered rather than a
new commitment. `CRATER_VIS_FLOOR_RAD`'s re-derivation is already filed-not-fixed in PLAN §7.

### Option D — World-generation work: the (a) layer

**Does in the game:** nothing on its own. It raises the ceiling on everything else — makes R-06
closeable *at all*, makes an R-07 selector honest rather than a laundered label, unlocks the palette's
suppressed hue stages (oxidation currently reaches 0.216 of its 0.60 cap), makes `rotationHours`
something other than 24 on every body in the galaxy, and gives `carbonToOxygen` a chance to reach its
own gate.

**Won't:** produce a visible change until (b) or (c) also move. Longest lead time of the four.

⛔ **This is PLAN §7's named follow-on and §7 is a scope fence.** It was diagnosed and reported here,
not started. §7 also names migrating `featureRelevant` off preset names as "a physics-authoring job
across ~12 features, not a mechanical port" — per family the shape is a condition-derived predicate,
a driver pack, and a ledger row. The one family that has all three (craters) is the warning: its
predicate is condition-derived and still takes only two values, and two numeric floors downstream
turned it into a moon-only feature anyway. **Porting a family correctly and having it render on a
useful population are two different jobs.**

### ⭐ RECOMMENDATION, with the criterion named

**Criterion:** what a player sees, per unit of work, on the largest named population — and whether the
change exceeds the renderer's own resolution (the `uLevels` 6 posterise quantum for colour, a frequency
change for normals). Not "narrow and reviewable". Not effort.

**Under that criterion: A now, then C, with D as the thing C's ceiling depends on, and B last.**

- **A now**, because it is hours and it stops two specific wasted passes — the one-gate repair that
  cannot work, and R-06 scheduled as wiring when the shared law computes "no liquid" for all six
  bodies regardless of who calls it.
- **C next**, because the two crater floors and the palette law are inside existing modules, need no
  world-generation work, and are the only in-scope items that touch morphology and the whole disc on
  the whole population.
- **D as the ceiling**, because C's palette half saturates without it. If the answer to the one
  decision at the top is "differentiation", D is the multi-month item and should be scoped as such
  rather than discovered halfway through C.
- **B last on this criterion**, and this is a recommendation about *ordering under one criterion*, not
  a ruling on the rows. If the goal is a defensible parity claim rather than visible differentiation,
  B moves up — that is precisely the decision at the top of this packet.

---

## 6. ⭐ WHAT IS STILL OWED AND WHAT IS UNKNOWN

**No agent closed a UAT on anything here, and none will.** The Instrument E frames are yours to read.
Every aesthetic reading an agent was tempted to make is parked as a question at the end of this section.

### Measurements NOT taken

1. **No frame-1 sidecars exist.** All three legacy shots
   (`r05_lava_frame1_legacy.png`, `r06_ocean_frame1_legacy.png`, `r07_venus_frame1_legacy.png`) ship
   with **no JSON sidecar at all** — no `isLabPlanetMaterial: false` assertion, no freeze read-back, no
   flag resolution for the flag-OFF loads. §12.5 fact 2 names the OFF-frame assertion explicitly, and
   `src/objects/Planet.js:2163-2169` makes `_labGasBodiesOverride` and `window.__wdLabGasBodies` both
   **outrank** localStorage. **Nothing in the shipped set can rule out that a flag-OFF load mounted the
   lab material anyway.** If it did, frame 1 is a lab frame and the frame1-vs-frame2 numbers
   (96.7172% lava / 90.8627% ocean / 98.9778% venus) are lab-vs-lab — the exact 2026-08-10 failure mode
   where a comparison ran the lab shader against itself and produced a confident, printable, wrong
   conclusion. **Damage is bounded because those three numbers are labelled context, not the claim** —
   the headline figures (75.9978% lava, 57.8072% ocean) are within-load frame2-vs-frame3 pairs. Owed:
   re-take the three frame-1 loads with sidecars.
2. **No pixel measurement of the palette claim.** "82.9% of bodies sit within one posterise quantum of
   the population mean" is computed on **unlit albedo**, while `posterize` runs on albedo × lighting
   with a ±0.033 dither. It establishes that the between-body spread is at or below the renderer's own
   colour resolution. **It is not a count of visibly distinct pixels and no pixels were counted.**
3. **The distinct-signature numbers are a constructed metric,** not a measurement of appearance. The
   binning is declared in §4. It is a comparative instrument for ranking options and it is weaker than
   your eyes.
4. **Nobody has ever seen a venus body with a working band deck.** The two shader-consequence findings
   for R-07 (albedo replacement at `planetShaders.glsl.js:652`, normal flattening at `:444`) are **read
   from source, not rendered**. If the strength question ever goes live it needs a real triptych and
   your eyes.
5. **`uNoiseScale` has never been shown as a picture.** The single loss whose magnitude nobody has
   seen. A triptych exists in principle — frame 1 legacy, frame 2 lab at 4.0, frame 3 lab with
   `uNoiseScale` forced to the body's own value at the same pose — and was not taken.
6. **The quad has no floor pair and no cross-frame diff number.** `shot-diff` refuses without both `--a`
   and `--b`, so no quad percentage was ever computed.
7. **Shadow counts are structurally null on all 10 sidecars.** §12.5 fact 6 requires them; the lab
   material declares no `shadowMoonCount` uniform, so the field is null on every lab-material shot
   while the game path does write them. A subject with a transit shadow on its disc would produce a
   large disc-ROI delta for a reason unrelated to any gate, and nothing in these sidecars would say so.
8. **No perf measurement** of any option in §5.

### Corrections to the record, so they are not read as findings

9. ⚠ **The star is not the same across subjects.** R-06 (`lab-procedural-4`) is lit by a **G** primary,
   colour [1, 0.96, 0.92]. **R-05 and R-07 (both `lab-procedural-5`) are lit by a K primary, colour
   [1, 0.82, 0.63]** — visibly warmer and redder. `isBinary` false throughout. The per-body sidecars
   carry the right values; a prose summary generalised one to all. **Within a triptych this does not
   matter — frames 1/2/3 share a star. Across artifacts it does**, and the two colour-bearing features
   (lava crack glow, venus band tint) are on the K-star subjects. If a lava or venus disc looks warm,
   part of that is the star.
10. ⚠ **`r06_ocean_frame3_forced.json` has no `poseAssert` field** — the one sidecar of ten. Hand
    reconstruction shows position byte-identical and the quaternion differing by one ULP (~1e-16 rad),
    with ROI and geometry byte-identical. The 57.8072% figure stands. The record is what is wrong.
11. ⚠ **Sidecars archive the raw localStorage string, not the resolved flag.** `labGasBodiesFlag()`
    ranks four sources and localStorage is third, so `labGasBodiesFlag: "1"` records an *input* to the
    decision, not the decision. A one-field fix (`flag.source`) closes it. The prose reports
    `frameBody`'s resolved `flagSource: 'localStorage:wd.labGasBodies'` on every framing, which does
    close it — but prose does not survive the session and the ambiguous string is what got archived.
12. ⚠ **R-05 and R-07 frame 3 carry no `forcedValuesProvenance`** where R-06's does. R-05's 0.6 and 0.8
    arrive with no recorded derivation, and the magnitude of a forced value sets how large the apparent
    loss reads.
13. ⚠ **A silent false pass caught mid-run, recorded because it would have produced a well-formed wrong
    triptych.** On the first ocean frame-2 attempt, `setCameraPose` returned `posDelta 0` and
    `quatDelta 0` — a clean success — while the body was entirely off screen: `distanceRadii` 24603
    instead of 3, `roi.onScreen` false, disc radius 0.45 px. Cause: framing inside the same evaluate
    call as the spawn, so `matrixWorld` was stale. **The pose assertion alone did not catch it.**
    `roi.onScreen`, achieved `distanceRadii` and a `lightDir` cross-check did.
14. ⚠ **Absolute camera pose is not load-invariant.** The renderer rebases coordinates; the same body
    measured 1117 and 1356 scene units away across two loads. §12's written "byte-identical between
    grabs" therefore had to be asserted in different quantities: camera **quaternion** (exact string
    match across loads on all three subjects), camera→body **offset vector** (to 1e-12/1e-13), plus
    radii, phaseDot and disc cx/cy/r. This is a real gap in §12's recipe for any two-page-load pair, and
    every frame-1 in this program must come from a separate load.

### Two population disagreements, unresolved

15. ⚠ **Planet-class moons over `lab-procedural-0…199`: one sweep counts 33 (all admitted, by type
    {ice 11, rocky 11, sub-neptune 4, venus 4, ocean 3}); another resolves 19 as non-gas within the
    1156-body set.** The difference is presumably composition-class gas bodies among the 33, but 33−19
    = 14 does not reconcile against 4 sub-neptunes. **Not resolved here.** The venus 4 and ocean 3
    figures come from the type census and are used as such above; the 19 is used only inside the
    1156-body non-gas totals. Whoever next quotes a planet-class-moon population should re-derive it.
16. ⚠ **Plain-moon type census disagrees between two sweeps** over the same 200 seeds. Ledger §9.1:
    captured 139 · ice 219 · volcanic 67 · rocky 207 = 632. An independent sweep: captured 139 ·
    ice 230 · volcanic 67 · rocky 218 = 654. **They agree exactly on `captured` 139 and `volcanic` 67
    (which is R-05's moon figure, so that number is safe) and disagree on ice and rocky, with different
    totals.** Not resolved here.

### The tool limit worth carrying forward

17. ⛔⛔ **`shot-diff` measures "did pixels move". It cannot distinguish "the feature came back" from "a
    gate opened onto noise."** It returned **SIGNAL ABOVE FLOOR** at 73.6074% on the R-07 frame that is
    provably drawing nothing but warp noise over an empty `aBand`. This is the most important thing the
    run found, and it applies to every future closure claim in this program.

### The questions that are yours, not an agent's

1. **The quad.** Put the four side by side. Do a rocky planet, a gas giant, a plain moon and a
   planet-class moon read as four different *kinds* of body, or as one material with a dial moved?
2. **R-05.** Is what frame 2 loses relative to frame 1 something you want back — and does frame 3 look
   like the thing that was lost, or like a different effect wearing its name? (§1 says measurement
   favours the second reading; the call is yours.)
3. **R-06.** Frame 1 vs frame 2 is the largest identity change in the ledger. Is it the one you would
   schedule first, knowing it **cannot** be closed by wiring?
4. **R-07.** Given the gate exists and the field does not, do you want the row's **evidence** corrected
   to say so while the `blocking` ruling stays? Re-ruling is yours alone.
5. **⭐ The one your eyes are most needed on.** Your UAT note said the bodies are all identical. The
   measurements say the cause is not these three rows — it is that on the great majority of solid
   bodies the two rock endmembers resolve to the same colour and craters do not fire, so a swapped body
   is one flat tone plus a relief scalar. **Is differentiation the thing you want the next block of work
   aimed at, rather than parity?**

---

**Provenance.** Every population, driver-value and distinctness figure in this packet was produced by
running the real generator and the real packs — headless over `lab-procedural-0…59`, `0…199` and
`0…1999`, and live in the browser at `http://localhost:5173/well-dipper/` after a hard reload. Shader
consequences are read from source and are labelled as such where they appear. Nothing was measured on
Sol, which has real NASA textures, a different renderer and no condition fields, and is structurally
refused by this program.
