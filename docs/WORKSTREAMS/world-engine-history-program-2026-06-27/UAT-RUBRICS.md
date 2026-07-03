# World-Engine History Program — per-increment BASIS-LEVEL UAT rubrics

**Sibling of:** [`ROADMAP.md`](ROADMAP.md) (the increment list + coverage map this is built against)
and [`../../FEATURES/world-engine-architecture-spine.md`](../../FEATURES/world-engine-architecture-spine.md)
(the basis-vs-expression principle §0/§1). **Worked exemplar:** increment 1 = the shell-relief contract
[`../world-engine-shell-relief-2026-06-27/contract.json`](../world-engine-shell-relief-2026-06-27/contract.json)
(AC1–AC11 — this rubric's "pass criteria" are the prose distillation of that AC pattern).

**Status:** 2026-06-27. Authored as the standing UAT artifact for the program. Lab-only (no `Planet.js`).

---

## Why this exists (line of sight)

The program's north star is **the COUNT of genuinely distinct, history-coherent worlds visible per minute** —
not toggled shader effects on a historyless substrate. Each increment moves an archetype from latitude-band
fallback to real history. **But a history increment is only as good as the UAT that confirms it landed** — and
the naive UAT question ("does this look like a believable Europa?") is *unanswerable* mid-program, because the
believable end-state needs expression increments that haven't been built yet.

The fix (Max's reframe, from increment 1's shell-relief UAT): pose every increment's UAT as **"did it lay down
the right BASIS?"** — given *only the generation built so far* — not "is it believable?". This maps directly onto
the engine's core principle:

> **procgen writes STRUCTURE as DATA; render only EXPRESSES it** (spine §0/§1: "render expresses, procgen decides").

So a basis-level UAT asks of the *data*: is it **organized by the right cause** (stress / drivers / plumes /
craters), **not the wrong one** (latitude bands, noise, random sprinkle), and **distinct per world**? Believability
is the *later* gate (the expression increments + Max's holistic UAT), not the per-increment gate.

**This document delivers one rubric card per planned increment**, answering Max's three driving questions for each:
*What will it be shipping? Will it be visually testable? What criteria tell us it's working vs not?*

---

## The rubric-card format (5 fields)

1. **Ships (as data)** — what history/structure the writer adds to `carrier.*` (the procgen layer).
2. **Expression path** — how that data becomes visible in the lab (direct displacement? albedo/color? bands? a diagnostic/probe overlay only?).
3. **Visually testable?** — **yes / partial / no → needs a proxy or probe.** ⭐ The highest-value field: some increments ship *internal* data with **no direct visual** until a later expression increment — caught here so we don't plan a UAT we can't run.
4. **Basis-level pass criteria** — control-framed "right substrate" tests (**not-X** / **organized-by-Y** / **distinct-per-world**), NOT end-state believability. These mirror the shell-relief AC pattern: AC2 STRUCTURE BAR (organized-by-stress), AC3 LATITUDE-CONTROL-must-FAIL (not-bands), AC6 VARIETY (distinct-per-world).
5. **Red flags** — what says it's NOT working.

Each card is prefixed with **Test in lab via** — the *preset the user actually sees* (see the standing caveat next).

---

## ⚠ STANDING CAVEAT — test the PRESET the user sees, not the canonical archetype

The rubric must test the **lab preset**, because the lab's `PRESET_ARCHETYPE` short-key routing diverges from the
canonical 11-archetype taxonomy in ways that change *which increment a preset actually exercises*. Verified live
against `planet-lod-lab.html:1901` + `src/worldengine/base/shellRelief.js`:

| Lab preset (what Max picks) | short key | Routes to increment | Gotcha |
|---|---|---|---|
| `Rocky (Earthlike)` | `terrestrial` | plate (#1 built) + #2 driver-response | — |
| `Ocean (temperate)` | `ocean` | plate (#1 built) + #2 | — |
| `Europa (icy moon)` | `ice` → `icy-active` | **#1 shell-relief** | NAMED_BODY; mapped so it isn't null+locked |
| `Frozen (airless)` | `ice` → `icy-active` | **#1 shell-relief** | ⚠ canonically carries 4 archetypes (impact-airless/volatile-cold/exotic-shattered/exotic-geometric) but the *preset* only gets #1's icy-shell history |
| `Titan (methane seas)` | `volatile` → `volatile-cold` | **#1 shell-relief** | single-covered (locked:false, no fallback net — drop the map line and it silently regresses to bands) |
| `Eyeball (locked temperate)` | `eyeball` → `eyeball-despun` | **#1 shell-relief** | — |
| `Lava (hot airless)` / `Magma (K2-141b)` | `lava` | #4 endogenic | in SHELL_EXCLUDE (won't wrongly route to #1) |
| `Venus (sulfuric shroud)` | NAMED_BODY | #4b stagnant-lid | needs the 3-way dispatch fork or falls to `sin²(lat)` |
| `Gas giant (Jovian)` / `Gas giant (Saturnian)` | `gas-giant` | #3 E5 bands | no relief writer ever — bands ARE the world |
| `Ice giant (Neptunian)` | **`sub-neptune`** | #3 E5 bands only | ⚠ shares the `sub-neptune` key — relief/identity as thin as sub-Neptune; reroll risks Jupiter-sized radius (range key collision) |
| `Sub-Neptune (hazy)` | `sub-neptune` | #3 haze branch | no increment home until #3's haze sub-branch |
| `Hot Jupiter (locked giant)` | NAMED_BODY / `hot-jupiter` | #3 E5 bands | whole identity in one E5 sub-field |
| `Carbon (high C/O)` | `carbon` | #8 | SHELL_EXCLUDE |
| `Crystal (faceted)` | `crystal` | #8 | SHELL_EXCLUDE |
| *(exotic-shattered)* | rides `Frozen`/F45 | #4.5 | ⚠ no own preset — rides Frozen, which routes to #1 today |
| *(Moon / Mercury, `impact-airless`)* | **no lab preset** | #5 bombardment | ⚠ the only `impact-airless` preset is `Frozen`→#1; #5 has no preset to UAT against |
| *(technogenic)* | rides Rocky/Ocean/Eyeball / F47–49 | #8 | overlay, no own preset |

**Consequence already surfaced in the summary table:** three increments (**#5, #5.5, #6**) cannot be UAT'd as-is —
#5 has no preset routing to it, #5.5 ships invisible fields, #6 ships an evaluation model with no direct look.
Catch these *now* (build a proxy/probe/preset before contracting), not at UAT time.

---

## ⭐ At-a-glance — "will it be visually testable?" (the highest-value column)

| # | Increment | Visually testable? | How to test it |
|---|-----------|--------------------|----------------|
| 1 | Shell-relief | **YES** — direct displacement | Step Europa/Frozen/Eyeball/Titan; bump pixelScale→1, drop posterize |
| 2 | Plate driver-response | **PARTIAL → A/B proxy** | Side-by-side low-g vs high-g Earth-like at the *same* seed |
| 3 | E5 climate field | **SPLIT** — gas-giant YES (albedo); terrestrial precip **PARTIAL → E9 proxy/probe** | Gas/Ice giants + Hot Jupiter direct; Rocky/Titan precip via drainage or a precip probe |
| 4 | Volcanic + Venus (4b) | **YES** — direct displacement | Lava / Magma / Venus |
| 4.5 | Exotic-shattered | **YES** — direct ⚠ **blocked on Max geometry decision** | Frozen preset + its own dispatch hook; carrier-vs-shader parity |
| 5 | Bombardment | **YES once a preset routes to it** ⚠ **no preset today** | Add a Moon/Mercury preset OR forced-route probe |
| 5.5 | Shared-field pass | **NO → PROBE + downstream proxy** | Field probes (margin/province/figure); full visual waits for #7/#8 |
| 6 | Epoch / host-editor | **NO → composed-history proxy** | `epochs=1` byte-identical vs `epochs=N` event-sequence (floor-fractured crater) |
| 7 | Per-regime sculpting | **YES** — direct | Titan / icy / Mars / Rocky sculpting |
| 8 | Exotics + technogenic + Tier-5 | **MIXED** — relief YES; rings/aurora **PARTIAL** (need system-graph) | Carbon/Crystal direct; rings need `moons:[]` filled |
| 9 | Game `Planet.js` port | **YES** — parity A/B | Lab-vs-game side-by-side (this is *expression*-fidelity, not basis) |

---

## The rubric cards

### Increment 1 — Shell-relief / despun ice-shell writer (L) — *the worked exemplar*

**Serves:** BROADEN. Takes icy-active (Europa/Frozen), volatile-cold (Titan), eyeball-despun from historyless →
has-history: ~2-of-11 → ~5-6-of-11. Sibling writer — never touches the validated plate path.
**Test in lab via:** Europa, Frozen, Eyeball, Titan (all route to a shell regime; see caveat table).

1. **Ships (as data):** despun + diurnal tidal **stress field** → **lineaments** (double-ridge cross-section, placed ⊥ to most-tensile stress, tension-gated) + **chaos** overlay + `grainAngle` direction field, into `carrier.height`; seeded per world (regimes icy-active / frozen / volatile-cold / eyeball-despun).
2. **Expression path:** lab displaces the sphere from `carrier.height` (`reliefBakeStrength`=1); visible as relief directly. (Legacy synth now default-OFF → carrier-only view.)
3. **Visually testable?** **YES** (direct displacement). Caveat: retro `pixelScale÷3`/posterize/dither hides fine ridges — bump pixelScale→1, drop posterize to judge the basis; remember the dithered look is the *shipped* aesthetic.
4. **Basis-level pass criteria:** (a) **NOT latitude bands** [AC3, the load-bearing fix]; (b) **stress-organized** — directional ridge networks (E-W polar cracks, smoothly-curving tidal arcs) + chaos patches, not noise and not bands [AC2/AC4/AC5]; (c) **distinct per world** — the four don't look like one shape recolored [AC6].
5. **Red flags:** uniform undirected bumps (no directional grain); the four looking the same; any horizontal banding leaking through.

> **STATUS:** **SHIPPED `54ea74d`** — Max AC11 basis-level UAT PASS 2026-07-03 ("first steps toward the kinds of planets they're supposed to be; very crude; samey within a world — may be fine for this stage"). Look-level feedback routed to V2-7/V2-8/V2-7d per ROADMAP-v2.

---

### Increment 2 — Plate driver-response (S)

**Serves:** MULTIPLY. Threads the real per-body D-vector through `route()`→`writeBodyRelief`→`writePlateUpliftSphere`
so PLATE_COUNT / UPLIFT_GAIN / CONTINENTAL_FRACTION respond to D14/D12/D2/D16. Turns the 2 history archetypes into a
*continuum*. **No new structure ships.**
**Test in lab via:** Rocky (Earthlike) and Ocean (temperate), swept across driver extremes (low-g vs high-g, young vs
old) at a fixed seed. (Mars also rides the plate path.)

1. **Ships (as data):** nothing *new* — the same `U=REPLACE` on `carrier.height`, but now PLATE_COUNT / UPLIFT_GAIN / CONTINENTAL_FRACTION are a pure function of `(D-vector, macroSeed)` instead of fixed DEFAULTS.
2. **Expression path:** existing plate displacement path — visible as *different* relief for different drivers, not as a new look.
3. **Visually testable?** **PARTIAL → needs an A/B proxy.** A single world shows nothing; the feature IS the *difference* between two driver draws of the same archetype at the same seed. Build a side-by-side (low-g vs high-g Earth-like).
4. **Basis-level pass criteria:** (a) **BYTE-IDENTICAL at the Earth reference point** — `f(D_earth)=DEFAULTS` exactly (the #1 must-fix; define `D_earth` as a named constant, calibrate every transfer fn to it, return a literal empty override so the `tune ? {...} : DEFAULTS` ternary takes the untouched branch); (b) **monotone, correct-sign response** — sweeping D14 (gravity) shifts relief in the calibrated direction, D2 (volatile) shifts continental fraction, etc.; (c) **distinct across the driver range** at fixed seed — low-g and high-g Earth-likes are visibly different worlds, not the same world recolored.
5. **Red flags:** the two driver extremes look identical (drivers not actually threaded — neutral `DEFAULT_GRAIN_DRIVERS` still in play); the Earth point drifts from baseline (calibration broken — note Earth maps to `tidalHeatNorm≈0.19`, `ageNorm≈0.45`, NOT 0/0); response in the wrong sign (high-g → *more* relief).

---

### Increment 3 — E5 atmosphere / climate field (L) + 3b vortex placement + sub-Neptune haze

**Serves:** gives gas-giant + hot-jupiter their FIRST real history field (the *entire* visual identity of 4
archetypes); gives Earth-like + Titan orographic / rain-shadow drainage; anchors CYCLE-1.
**Test in lab via:** Gas giant (Jovian), Gas giant (Saturnian), Ice giant (Neptunian) [→`sub-neptune`, bands only],
Hot Jupiter, Sub-Neptune (hazy) [→haze branch]; Rocky + Titan for orographic precip.

1. **Ships (as data):** (3a) zonal band/jet field `u(lat)` — **must be lifted from GLSL into a `base/` writer** or AC1–AC3 can't run headless; (3b) deterministic vortex placement (latitude = argmax anticyclonic shear; RNG only sets longitude/aspect/size); sub-Neptune haze mute `bandField *= (1 - hazeMute·hazeOpacity)`. Plus a precip + temp + wind field feeding E9.
2. **Expression path:** gas giants — bands/jets/vortices as **albedo/color directly** (terminal surface, no relief). Terrestrials — precip is **internal data** consumed by E9 hydrology; no direct visual until drainage exists.
3. **Visually testable?** **SPLIT:** gas-giant bands/storms = **YES** (direct albedo). Terrestrial precip = **PARTIAL/NO → needs the E9 drainage downstream as proxy, OR a precip-field probe overlay.**
4. **Basis-level pass criteria** (gas-giant): (a) **NOT a random latitude sprinkle** — vortex latitudes deterministically selected by shear (kill the `phi=acos(rng.range(-0.7,0.7))` pattern); (b) **organized by rotation (D8) + temp (D1)** — band count/jet speed scale with rotation; equatorial-jet **sign regime-correct** (prograde gas-giant/Saturnian, **RETROGRADE** Neptunian/ice); vortices stretch E-W, aspect ~1.5–2.5; hot-Jupiter eastward hotspot offset gated on `T_eq`; (c) **distinct per world** — Jovian ≠ Saturnian ≠ Neptunian band structure.
5. **Red flags:** random storm latitudes; equatorial jet wrong sign for ice giants; bands identical across rotation rates; hot-Jupiter hotspot not offset; sub-Neptune over-hazed at the 400 K / 900 K wings (`hazeTempBell` too wide); Neptunian reroll comes out Jupiter-sized (the `sub-neptune` radius-range collision).

> ⚠ 3b (storm placement) is its own sub-increment with its own `intent.md`+`contract.json`. The `uStorm[8]`
> "reserved carriage" claim is **UNVERIFIED** (zero `uStorm` in `src/`) — confirm or budget for new uniforms.

---

### Increment 4 — Volcanic / endogenic-heat writer (L) + Venus stagnant-lid branch (4b)

**Serves:** a 4th–5th distinct relief type (Io shields, lava plains, magma seas) + Venus (the single most-recognizable
non-Earth rocky world).
**Test in lab via:** Lava (hot airless), Magma (K2-141b), Venus (sulfuric shroud) [→4b branch].

1. **Ships (as data):** (4a) hotspot/edifice placement + effusive lava-plain flooding + substellar magma-ocean basin; (4b) Venus tessera-fabric + coronae + global resurfacing-age field, all keyed off ONE seeded mantle-plume field. Dispatch predicate `isStagnantLidPath` in `planet-lod-rivers.js` (next to `isEarthlikePlatePath`), copying the **`plates.js`** template (not the unbuilt `shellRelief.js`); makes dispatch 3-way (plate → stagnant-lid → despun-fallback).
2. **Expression path:** direct displacement — shields, lava plains, coronae are relief; resurfacing-age as an age/albedo field.
3. **Visually testable?** **YES** (direct displacement) for 4a edifices + 4b tessera/coronae. The resurfacing-age field alone is **PARTIAL** (needs a palette/age expression to fully read).
4. **Basis-level pass criteria:** (a) **NOT random stickers** — hotspots/coronae placed by the plume field, not sprinkled; Venus does **NOT** fall to `sin²(lat)` (the 3-way dispatch fires); (b) **organized** — elevation ordering `mean(tessera) > mean(plains) > mean(active-plume/rift)`; coronae carry the active(domed+outer-rise+trench) / inactive(raised-rim+interior-depression) **morphology selector**; (c) **distinct** — Io shields ≠ lava plains ≠ Venus tessera; per-seed variety.
5. **Red flags:** volcanoes randomly placed not plume-driven; Venus reads as latitude bands (branch didn't fire); coronae as flat decals; `CORONA_ACTIVE_FRAC ~0.35` (resolved-corona literature ~0.70 — look-tuning flag); tessera lower than plains (ordering inverted).

---

### Increment 4.5 — Exotic-shattered block-jumble writer (L) — ⚠ BLOCKED on a Max geometry decision

**Serves:** first-order jump for one of the most visually distinct worlds (Miranda-class); de-risks #8.
**Test in lab via:** Frozen (airless) preset (exotic-shattered rides Frozen / F45) — ⚠ **but Frozen→`ice`→#1's
icy-active today**, so #4.5 needs its OWN dispatch hook; the preset gotcha is acute here.

1. **Ships (as data):** shatter relief — EITHER **block-jumble** (random-tilt reassembled blocks; disfavored science since 2011, instantly readable) OR **diapir-grooved concentric coronae** (favored science, a *geometrically different* primitive). ⚠ **MAX MUST CHOOSE before this can be contracted** — they are different end-states, not a shared one.
2. **Expression path:** direct displacement. **NOTE:** the F45 shader `shatterCombiner` is **ALREADY SHIPPED** (`VERIFIED_PENDING_MAX e94323e`) — so the basis test is "does carrier-data shatter REPLACE / match the shader's procedural shatter" (worldengine = single source of truth; a *retrofit*, and the two-fields-can-disagree risk is present-tense).
3. **Visually testable?** **YES** (direct, distinctive) — but must test **carrier-driven vs shader-driven** parity to confirm single-source-of-truth.
4. **Basis-level pass criteria:** (a) **NOT noise, NOT the ice-shell writer's output** (its own archetype exists precisely so tooling won't group it with ordered terrains); (b) **organized** by the chosen primitive (block boundaries OR concentric grooves); (c) **distinct per seed.** Constraint: do **NOT** write a 4th `carrier.regime` constant (`verify.js:39` asserts regime ∈ {0,1,2}).
5. **Red flags:** looks like noise; looks like icy-active cracks; carrier shatter disagrees with the F45 shader; a 4th regime constant breaks `verify.js`.

---

### Increment 5 — Bombardment / cratered-surface writer (M) — ⚠ no lab preset routes to it today

**Serves:** impact-airless (Moon/Mercury) becomes a real cratered world-type; the cleanest editor-on-host exemplar
(de-risks the #6 epoch refactor).
**Test in lab via:** ⚠ **NO Moon/Mercury preset exists.** The only `impact-airless` preset is `Frozen (airless)`,
which routes to #1. So #5 has **no directly-testable preset** — it serves canonical `impact-airless` *bodies* that
have no preset. **MUST add a Moon/Mercury preset OR wire bombardment to also fire on `ice`-keyed unlocked bodies**,
or the increment is UAT-untestable in the lab.

1. **Ships (as data):** a crater-population field (size-frequency by gravity D14 + age D11/D16) → basins/rims/ejecta, written as a **persistent HOST that later epochs EDIT** (not a final overlay).
2. **Expression path:** direct displacement (craters) + ejecta as albedo.
3. **Visually testable?** **YES (direct) — once a preset routes to it.** Until then **PARTIAL** (needs a preset added, or a forced-route probe).
4. **Basis-level pass criteria:** (a) **NOT uniform density** — crater size-frequency VARIES by gravity + age (older / lower-gravity → more & larger craters); (b) **organized** — power-law size-frequency; basins are a HOST a later writer can edit (the floor-fractured-crater test in #6); (c) **distinct per (gravity, age)** draw.
5. **Red flags:** uniform crater density regardless of D14/D16; craters as a final overlay not an editable host (fails the #6 editor-on-host exemplar); no power-law in the size-frequency.

---

### Increment 5.5 — Shared-field pass (M) — ⚠ INTERNAL FIELDS, the flagship proxy case

**Serves:** writes the cross-cutting substrate #6/#7/#8 all read so worlds stay layered-history not overlays.
**No new world-type ships.**
**Test in lab via:** any built relief preset (needs ≥2 relief regimes to derive from — e.g., Rocky + a #1 icy
preset). There is **nothing new to SEE** on any single preset.

1. **Ships (as data):** five fields — (d) shared stress/orientation (lineament) field; (a) passive continental margins (shelf 80 km/0.5°, break 140 m, slope 3°; passive=wide / active=narrow); (b) sediment/deposition host; (c) history-tied E12-province (seeds **DERIVED from structure**); (e) E2-figure (oblate/triaxial/Roche/despun-fossil-bulge; `f=(5/4)ω²a³/GM`). ⚠ **Add NEW channels** (`carrier.accommodation`, `carrier.sediment`) — `maturity`/`baseLevel`/`standing` are NOT free (E9 hydrology already writes them at `relief-e9-hydrology.js:147-149`).
2. **Expression path:** **NONE direct** — these are fields OTHER writers consume. This is the program's flagship "ship internal data with no direct visual" case.
3. **Visually testable?** **NO → needs a PROBE + a downstream PROXY.** Each field gets a probe (margin-geometry readout, province-association test, figure-flattening readout). Full visual confirmation waits for the downstream consumer (#7 sculpting on the sediment host; #8 palette on the province).
4. **Basis-level pass criteria (probe-based):** (a) margins **NOT a binary step** — passive=wide / active=narrow with a measurable shelf-break; (b) **province seeds DERIVED from structure** — low-faultDensity→craton, high-grainMag→orogenic belt, high-accommodation→basin, **AND an AC that RANDOM seeds must FAIL the association test** (straight from the ROADMAP); figure **ORIGINATES `w0` from drivers** (no shipped writer produces a paleo-spin axis to "reuse" — it's a *derive* path on `plates.js`, which writes only `height`+`faultDensity`); (c) accommodation provides **SINK-RANKING only** — do NOT claim mass-conservation (a `[0,1]` potential can't represent a volume budget; the real budget belongs to #6).
5. **Red flags:** province partition is abstract noise divorced from history (re-introduces the "bag of overlays" the program exists to kill); channels collide with E9's `maturity`/`baseLevel`/`standing` (three meanings for one channel); claims CYCLE-1 mass-conservation; figure "reused" from a writer that doesn't produce it.

---

### Increment 6 — Epoch / host-editor model + the two cross-tier cycles (XL) — ⚠ STRUCTURAL + partly UNDESIGNED

**Serves:** every world gains temporal depth (layered history, not single-pass overlays). **No new archetype ships.**
**Test in lab via:** any built multi-writer world that composes two epochs (e.g., a cratered world later intruded by
magma — needs #5 + #4 built first).

1. **Ships (as data):** wrap the relief stack in 2–4 named **EPOCHS** where later writers **EDIT a persistent host**; resolve the two cross-tier cycles (atmo↔surface CYCLE-1, figure↔grain CYCLE-2) as bounded fixed points. `epochs=1` reproduces single-pass byte-identically.
2. **Expression path:** **NO direct new look** — the structure IS the evaluation model. What becomes visible is **composed-history features that only epochs can produce** (floor-fractured crater, exhumed inverted-ridge channel, frost-locked dune, space-weathered ray).
3. **Visually testable?** **NO direct → proxy via a specific composed-history feature.** Test is comparative: `epochs=1` byte-identical vs `epochs=N` shows the event-sequence.
4. **Basis-level pass criteria:** (a) **`epochs=1` BYTE-IDENTICAL** to single-pass (the identity guard — same role as #2's Earth point); (b) a known **event-sequence APPEARS at `epochs>1`** that cannot exist at `epochs=1` (crater-then-magma); (c) the fixed-point solver **converges + is order-independent** (Jacobi all-previous-iterate block iteration, **NOT** Gauss-Seidel immediate-update) **+ byte-deterministic**; pass-count truncation must NOT change the converged answer.
5. **Red flags:** `epochs>1` changes the `epochs=1` output (identity broken); pass-count truncation changes the answer (it's a smoothing operator, not a true fixed point — the ROADMAP's central warning); a cycle "resolved" over producer writers (E10/E11) that aren't built until #7; Gauss-Seidel domain-ordering dependence.

> ⚠⚠ **DESIGN GAP:** the cross-tier-cycles research came back **DEGENERATE** (a literal stub — `"test gap"`,
> `"test approach"`). The fixed-point solver is **UNMECHANIZED**. Criterion (c) cannot be fully specified until a
> real design pass runs. **Do not contract #6 until the solver is designed.** (ROADMAP NOW-item 4 / thin spot 8.)

---

### Increment 7 — Per-regime sculpting (L) — aeolian + cryosphere + per-regime hydrology

**Serves:** methane fluvial on Titan, glacial/sublimation on icy/volatile, dunes/yardangs — multiplies every solid
archetype again.
**Test in lab via:** Titan (methane seas), an icy preset (Europa/Frozen), Mars (arid → dunes is its identity), Rocky.

1. **Ships (as data):** E10 aeolian (sediment-flux → dunes/yardangs/streaks) + E11 cryosphere (glacial / sublimation / frost cycle) + E9 hydrology generalized to per-regime fluids, all as **epoch EDITORS on the relief host** (depends on #6).
2. **Expression path:** direct — dunes / channels / glacial features as relief + albedo.
3. **Visually testable?** **YES** (direct) — but depends on #6 epoch host + #3 wind/temp + #5.5 sediment host existing first.
4. **Basis-level pass criteria:** (a) **NOT random orientation** — dunes oriented by the wind-rose (D8); rivers flow **DOWNHILL** along the relief gradient (not uphill, not ignoring relief); (b) **organized** — correct **fluid PER REGIME** (methane on Titan, water on Earth, N₂/sublimation on Triton); deposition lands on the #5.5 sediment host; (c) **distinct per regime** — Titan's methane drainage ≠ Mars's aeolian yardangs ≠ Europa's glacial.
5. **Red flags:** dunes random orientation; rivers flow uphill / ignore relief; wrong fluid (water on Titan); nothing to deposit onto (#5.5 sediment host missing); sculpting OVERWRITES the host instead of editing it.

---

### Increment 8 — Remaining exotics + technogenic + Tier-5 overlays (XL) — ⚠ a BUNDLE, most-cuttable

**Serves:** closes BROADEN to **11-of-11**. ⚠ This is the most-cuttable slot AND where the headline goal
concentrates — if it slips, the program silently ships at 8-of-11.
**Test in lab via:** Carbon (high C/O), Crystal (faceted), technogenic (rides Rocky/Ocean/Eyeball / F47–49); rings
need the `moons:[]` system-graph stub filled.

1. **Ships (as data):** archetype writers (exotic-carbon graphite/diamond crust, exotic-geometric crystal-facet, technogenic) + Tier-5 modality overlays (E15 rings, E8b space-weathering/regolith-maturity, E12 palette, E4 magnetosphere/aurora, E13 transient, E14 inhabitation).
2. **Expression path:** MIXED — carbon/crystal = relief (direct); technogenic = overlay structures; rings/palette/aurora/weathering = body-wide readout fields.
3. **Visually testable?** **MIXED** — carbon/crystal/technogenic **YES** (direct); palette/weathering **YES** once expressed; rings/aurora **PARTIAL** (need `moons:[]` / D13 topology data filled — no proxy until then).
4. **Basis-level pass criteria** (per sub-writer): (a) **NOT abstract noise** — palette DERIVED from composition (the #5.5 E12-province, not fresh noise); space-weathering keyed off D16 age + E4 flux; (b) **organized** — rings read the `moons:[]` system graph; carbon crust by C/O ratio (D10); (c) **distinct per archetype.**
5. **Red flags:** rings rendered with no system-graph data (`moons:[]` stub still empty); palette divorced from composition (the "bag of overlays" again); the "11-of-11" headline shipping while carbon/crystal/technogenic are silently cut.

> ⚠ **RECOMMEND SPLIT** (open decision c): separate the archetype-completing writers (carbon/crystal/technogenic —
> load-bearing for the 11-of-11 claim) from the optional Tier-5 overlays, so they don't share a slip-risk. **Each
> sub-writer should get its OWN rubric card when #8 is scoped** — this single card is a placeholder for a bundle.

---

### Increment 9 — Game `Planet.js` production-renderer port (XL) — ⚠ EXPRESSION-FIDELITY, not basis

> **Reframe:** this increment ships **NO new basis.** The basis was laid in #1–8 (lab). The question is **not**
> "right basis?" but **"does the game express the lab-validated basis FAITHFULLY?"** — a *parity/fidelity* card,
> not a basis card. It is the one place where the north star's "distinct worlds visible per minute" finally counts
> for the actual screensaver.

**Serves:** ports the lab-validated history stack onto the game sphere (`Planet.js` + `MaterialBodyShader.js`, today
zero relief code) — where the variety becomes visible in the real screensaver.
**Test in lab via:** the SAME presets validated in the lab, viewed in the game sphere — **A/B lab-vs-game parity.**

1. **Ships (as data):** nothing new — ports the finished `carrier.*` stack and its expression onto the game sphere.
2. **Expression path:** the game sphere now displaces/colors from the same carrier fields the lab validated.
3. **Visually testable?** **YES** (direct, side-by-side lab vs game).
4. **Pass criteria:** (a) **PARITY** — a given seed+preset produces the SAME world in game as in lab (no port-introduced divergence); (b) **world-origin rebasing** handles float32 at ship scale (no precision artifacts — the flagged dep); (c) all #1–8 lab-validated worlds survive the port.
5. **Red flags:** game looks different from lab (port introduced divergence); float32 artifacts at ship scale (rebasing not done); a world that passed lab UAT fails in game.

---

## Build intent of THIS document (record-build-intent)

**Function:** a standing per-increment UAT rubric so each increment of the world-engine history program is UAT'd as
*"did it lay down the right basis?"* (control-framed: not-X / organized-by-Y / distinct-per-world), not the
unanswerable *"is it believable?"*. **Intent:** make the basis-vs-expression framing a *reusable artifact*, and —
via the ⭐ visually-testable column — catch the increments that ship invisible data (#5.5, #6) or have no routable
preset (#5) *before* they're contracted, so we never plan a UAT we can't run. **Deliberate non-goals:** this is NOT
a contract (no ACs with verifiers — those live in each increment's `contract.json`); it does NOT decide the open Max
calls (4.5 geometry, #8 split, the #6 solver design); it does NOT cover believability/holistic UAT (that's Max's
terminal gate per increment, unchanged). Cards for #2–#9 are *forward-looking* (only #1 is built) and should be
re-grounded against live code when each increment is actually scoped.
