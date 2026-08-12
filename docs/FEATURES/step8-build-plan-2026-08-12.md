# Step 8 — BUILD PLAN, from the 2026-08-12 recon workflow

*Companion to [`one-pipeline-two-frontends-PLAN.md`](one-pipeline-two-frontends-PLAN.md) §4 Step 8.
Produced by a 9-agent workflow (5 read-only recon lanes + 3 adversarial refutation lanes + 1
synthesiser told to weigh rather than average), run at `f679046` on a clean tree.*

⛔ **THIS DOCUMENT SUPERSEDES STEP 8'S NUMBERS, NOT ITS INTENT.** Step 8's goal — moons carry a real,
derived condition record — is unchanged and correct. Most of the figures it is *sold* on do not
reproduce, two of its gates are inverted or vacuous, and its central safety claim about 8b is wrong
in the dangerous direction. §1 is the table. Commit **C0** exists to carry these corrections back
into the PLAN itself, because a number that reads as freshly verified and points at the wrong thing
is class N under §11.1 and blocks inside a region the step edits.

⚠ **Every figure below is HEADLESS.** No screenshots, no browser, no render check — see §8.11.

---

# BUILD PLAN — PLAN §4 Step 8 ("Moons get a real condition record, derived and never drawn")

Synthesised from 5 recon + 3 refutation lanes, with the load-bearing numbers re-measured by me at `f679046`, clean tree. My own probes: `/tmp/claude/syn1.mjs`, `syn2.mjs`, `syn3.mjs`. Before-numbers I ran just now: `npm run test:body-identity` → **8 passed, 889 ms**; `npm run port-uniform-delta:citations` → **400 CHECKED / 421 UNCHECKED / 0 UNRESOLVED / 0 PAST-EOF / 0 MALFORMED / 2 TICK-PARITY / 1 SPAN-OPEN / 6 ILLUSTRATIVE, exit 0**.

---

## 1. VERDICT ON THE PLAN'S OWN CLAIMS

Every number Step 8 (`PLAN.md:386-404`) is sold on. "Mine" = I re-ran it this session; otherwise the lane is named and I say why I believe it.

| # | Claim (PLAN.md line) | REPRODUCES? | Corrected value | Does the argument survive? |
|---|---|---|---|---|
| 1 | `:394` "Instrument B must hash the ENTIRE moon record… not four named fields" — presented as Step 8 work | **NO — already shipped** | `tests/body-identity-fence.test.js:196-204` `moonRecord` iterates `Object.keys(m)` with **no allowlist**; planets get `WORLDENGINE_BAKES` filtering at `:190-193`, moons get none. Byte-identical across all 3 commits touching the file (`b2ac455`, `0af246e`, `56d136a`). **Mine: read the function.** `:545` should read "(Step 0, `b2ac455`)" | Argument survives; the *task* does not exist. See §3 for why this accident is what rescues the gate |
| 2 | `:394` "Must be **byte-identical**. If it goes red, a draw leaked" | **NO — self-contradictory** | Hashing the whole record means a faithful additive append moves **every plain moon hash with zero draws moved**. The test file says so itself at `:518-524`. And the contrapositive is false — see break #1 | **Argument inverts.** As written the gate condemns a correct commit and blesses a broken one |
| 3 | `:390` "The plain path has **fifteen** draws" | **Partially — it is a call-site count, not an executed count** | 15 = `rng.` sites lexically inside `generate` with the `:151`/`:152` ternary collapsed and `:99` excluded. **No moon consumes 15.** Executed: rocky/ice/captured **11-13**, volcanic **12-13**, terrestrial **17-18**, planet-class **18-29** (lanes DRAWSTREAM + refuter 3 agree, both instrumenting the passed-in instance on the production path). Lane INSTRUMENTB reports each +1 (12/13/14, 19) from a synthetic forced-generation driver — **discounted: it measured a harness it built, the two production-path lanes agree** | Survives as prose, kills gate #2 (§5) |
| 4 | `:390` "seven of them come after `startAngle` (`:157`)" | **YES, exactly** | `:185, :189, :190, :195, :200, :201, :202` = 7. Verified by 4 independent lanes | Survives |
| 5 | `:390` "Splicing… re-rolls `noiseScale` on **every plain moon in the universe**" | **NO — off by 138×** | `MoonGenerator.js:185` is `Math.max(rng.range(3.0,6.0), 2.5/radius)`. **Mine (`syn1.mjs`, 4861 plain moons over `wd-0…1499`): the drawn value is clamped away on 98.77%; min floor 3.774 vs a `[3,6)` draw.** Mine (`syn2.mjs`, Instrument B's own 192 seeds): a one-draw splice at `:185` moves **5 of 691** plain record hashes (`wd-5`×2, `wd-34`, `wd-133`, `wd-183`) — independently reproducing refuter 1's five bodies | **Argument collapses.** The hazard is real but the wide hash buys 5 moons of coverage out of 691 on it |
| 6 | `:391` "`retained` true **323/323**, `:526` short-circuits **zero times** today — dormant-but-armed" | **NO** | Lane NUMBERS: planets **12,741/12,742**; **planet-class moons 241/250 → fires 3.6%**. Refuter 2: planets 8555/8557; planet-class moons 200/211. Two lanes, different populations, same verdict. `:526` is live, and live *on 8b's own subject* | Framing fails; `:526` is still not the mechanism (see #8) |
| 7 | `:388` "24.4% of plain moons are captured" (`:155` conditional) | **YES** | 1602/6696 = **23.93%** over `wd-0…1999` (lane DRAWSTREAM). 24.4% is 0.2σ from that at n=262. ⚠ denominator is *plain* moons; over **all** moons it is 23.2% | Survives |
| 8 | `:391` "8b is draw-stream **neutral**: 0/400 draw stream, 0/400 `radiusEarth`, because `retained` never flips. A **value** change, not a universe change" | **BROKEN on all three clauses** | **Draw stream:** 52/233 (lane NUMBERS), 49/223 (refuter 2), 17/75 (refuter 3) = **22.0–22.7%**, three independent harnesses. **Mechanism is `PlanetGenerator.js:697-698`** (`rng.range` + `rng.chance` — 2 draws unlocked, 0 locked, gated on `tidalState.locked`), present on **52/52, 49/49, 17/17** of draw-altered bodies; `retained` flips only 8-12. **`radiusEarth 0/400` measured the wrong object** — refuter 3's catch: it is the *generated pData's* radius, which `MoonGenerator.js:281-283` overwrites unconditionally two lines later. The **moon's** `radiusEarth` moves on **17/75, 47/211** | **Does not survive.** 8b moves radius, orbit, orbitSpeed, inclination, startAngle. This is the plan's own signature failure — a control that could not move, inside the sentence labelled "Correction to the recon, in the plan's favour" |
| 9 | `:391` "T_eq 254.588 at 1.0 AU vs **43.033 at 30 AU** (5.9×)" | **Half** | 254.588 at 1 AU ✅ exact. **43.033 is the value at 35.0004 AU**; 30 AU = **46.481**, ratio **5.477×**. Both refuter 2 and lane NUMBERS back-solved it independently. Also: the error is **two-tailed** — ratio today/correct spans 0.404–57.2, **44-48% wrong by >2×**, ~25% of moons are too *cold* today | Direction survives; the "40 AU icy moon carries an inner-system temperature" framing describes one tail |
| 10 | `:391` "~3.5% of moons already reach `Planet.js`" | **High, family-dependent** | **Mine: 157/5018 = 3.13%** on `wd-0…1499`. Refuter 2: 3.02% (2000 systems). Lane NUMBERS pooled across 5 seed families: **2.64%**, range 1.56% (numeric seeds) – 3.47% (`pcc-`). Use **~3.1% on `wd-*`**, and say the family dependence out loud | Survives — small minority either way |
| 11 | `:397` "today the same bodies fabricate **10.4 / 14.1 / 56.3 g**" | **NO — unattributable, and far too kind** | **Mine: median 34.6 g, p95 4315, max 25,556 g, 4127/4861 (84.9%) above 3 g** on generated plain moons. Lane NUMBERS incl. Sol: median 33.25, **max 1,000,000 g (Deimos, `SolarSystemData.js:241` `radiusEarth: 0.001`)**. Mechanism `conditionFromPlanet.js:730` `massEarth: d.massEarth ?? 1.0` × `baseStep.js:18-19` ⇒ **every plain moon's g is exactly 1/R²** | Direction survives, *understated by 3-4 orders of magnitude*. Replace the triple |
| 12 | `:397` "an 11 km Phobos-class body derives **346,021 g**" | **YES, exactly — but it is a hand-authored Sol body** | 346020.76124567474 = 1/0.0017², `SolarSystemData.js:230`. **No generated moon is that small** — smallest measured ≈40 km (`radiusEarth 0.006255`). And Deimos (`:241`) is worse at exactly 1e6 g. The plan names the second-worst body | Survives as an illustration; must be labelled hand-authored |
| 13 | `:397` "`surfaceGravity` over the whole moon population lies in **[0, 3] g**" as a gate | **Cannot fail, and already fails** | **Mine:** under 8a's own declared formula (`g = radiusEarth × ρ_parent`) **max 0.539 g, p95 0.229, 0/4861 outside [0,3]** — 5.6× headroom. Meanwhile **planet-class moons, which already carry real mass, max 3.13-3.26 g → 1 body over the line today**, and the shipped fence `tests/moon-mass-radius-consistency.test.js:76` asserts `< 5` | **Gate is both vacuous and self-contradicting a shipped assertion** |
| 14 | `:398` "Sol's Moon derives **0.165 ± 0.01 g**, not today's **13.42 g**" | **13.42 reproduces; the target is unreachable by 8a** | 13.41759583517825 = 1/0.273² ✅. But: **`grep -c massEarth src/generation/SolarSystemData.js` → 0** (mine), Sol's Moon is a hand-authored literal at `SolarSystemData.js:191-201`, and **`MoonGenerator` is never invoked for Sol** (its only mention there is a comment at `:55`, mine). 8a cannot move this body. And with Sol-Earth massless the declared formula gives 0.273 g (or NaN), not 0.165 — 0.165 needs the Moon's *actual* density 3344/5514 | **Gate is unsatisfiable inside Step 8's declared Files.** See open question Q1 |
| 15 | `:399` "Zero moons produce a truthy atmosphere with undefined pressure" | **Reproduces as 0 — and cannot ever be non-zero** | Lane PROVENANCE, 3 corpora, 3115 moons: truthy atmosphere 18/20/27, **pressure undefined 0 in all**. Structural: `MoonGenerator.js:193-197` emits `{color,strength}` which fails `hasEngineAtmosphereShape` (`conditionFromPlanet.js:371-373`), and when truthy, `:390` is `phys.pressure ?? 0`. Only the flat-passthrough branch at `:380` can violate it, and 8a does not write it. Plain terrestrial moons are **0.09-0.14%** — expected count in a 500-moon sample: **0.46** | **Gate measures 0→0 forever** |
| 16 | `:388` "Every value derived **purely** from what `generate` already holds in scope" | **NO for `T_eq`** | **Mine: `planetData.orbitRadiusAU` is undefined on 6279/6279 planets.** The AU lives on the wrapper (`StarSystemGenerator.js:605`); `:594-595` passes only `(moonRng, planetData, m, moonCount, parentZone, zones)`. `age`, mass/density, `tidalState` inputs **are** in scope | **8a needs a signature change the Files list does not budget** |
| 17 | `:388` "`type` appears in that file only in comments at `:9,:10,:11,:83`" | **Line list wrong, substance right** | `:83` is a bare `//` with no `type` on it — and was wrong on the day it was written (`dcad360`, where `:83` read `types`, plural). Misses `:350, :545, :546, :582, :584`. **All 8 occurrences are comments; 0 code reads** (only `typeof` at `:315,:317,:372`) | **Stays a rename, not a redesign.** Fix the citation to §10's symbol-only form |
| 18 | `:401` "Instrument B's only allowed diff is planet-class moons" (8b) | **NO** | Refuter 2, live substitution over the fence's 221 seeds: **31 record diffs = 24 planet-class moons + 7 PLANETS**, plus **DRAW STREAM red on 6-7/221 seeds**. The planets move on exactly one key — `systemContext` (`StarSystemGenerator.js:966-972`, which folds moon `radiusEarth`/`orbitRadiusEarth`/`tidalHeating` back onto the parent and is **not** in `WORLDENGINE_BAKES`) | **Does not survive.** Containment holds only for *plain* moons: 0/6764, 0/803, 0/1985 across three lanes |
| 19 | §11.7 `:716-717` "C2/C3 CARRIED, cleared by Step 8" | **NO mechanism in the step** | Step 8's Files (`:392`) does not list `tests/port-route-agreement.test.js`; none of its 7 gates mentions route agreement, channel 2, an M stratum, or a mutation-window control. And the naive repair reds **1834/1834** plain moons because `bakedOn` (`port-route-agreement.test.js:207-210`) reads `landPalette`/`iceness`/`lavaGlowColor`/`lavaCrustColor`, which plain moon records do not carry | **C2/C3 would ship un-cleared at the step named to clear them** — §11.6's promote-or-retire trigger |

---

## 2. CONFIRMED BREAKS

Constructions the refuters actually built and I verified where noted.

**B1 — The byte-identity gate is 99.28% blind to the plan's own named hazard.** *(refuter 1; I reproduced it independently in `syn2.mjs`)* One `rng.float()` spliced immediately before `MoonGenerator.js:185` leaks a draw into the shared stream and moves the whole-record hash on **5 of 691 plain moons**. `PLAN.md:394`'s contrapositive — green ⇒ no draw leaked — is false. Cause: `Math.max(…, 2.5/radius)` discards the drawn value on 98.77% of plain moons (mine, 4861 moons). Corollary: `MoonGenerator.js:333-334`'s comment "noiseScale is texture detail, not geometry" (`ExoticOverlay.js:335`) is false — 98.77% of `noiseScale` values *are* `2.5/radius`.

**B2 — Instrument B's DRAW channel carries zero discriminating information across the four constructions that matter.** *(refuter 1)* Its counter is a `SeededRandom.prototype` accessor (`tests/body-identity-fence.test.js:225-241`), so it counts **every instance**, including a fresh `new SeededRandom(eccSeed)`. Measured on `wd-0…191`: a dedicated-namespace draw (the pattern `PLAN.md:390` instructs authors to use, documented as safe at `MoonGenerator.js:244-251`), a tail draw, a splice at `:185`, and a splice in `_pickType` **all red the draw channel on 170/192 seeds**. The shipped comment at `MoonGenerator.js:248-250` ("draws ZERO numbers… so the additive gate stays green") is wrong about the gate it names; it only reads true today because those draws are already in `tests/baseline/body-identity.json`.

**B3 — The non-enumerable bypass. All eight Instrument B tests stay green while the six fields are fully readable.** *(lane INSTRUMENTB + refuter 3, independently)* `Object.defineProperty(moon,'massEarth',{value:m,enumerable:false})` ⇒ hash unchanged, RECORD SHAPE unchanged, DRAW STREAM unchanged, `moon.massEarth` = 0.004 downstream. **This is idiomatic, not adversarial**: it is exactly the pattern of the file being renamed, `conditionFromPlanet.js:890-895`, framed there at `:885-889` as *"it CANNOT enter any hash… The protection is structural."* Under §11.9 an idiomatic bypass **blocks**.

**B4 — `_provenance` is a presence test; four of Step 8's seven gates pass on a record with no physics in it.** *(refuter 3)* `conditionFromPlanet.js:682` is `v != null ? 'measured' : 'defaulted'`. Measured: `massEarth: false`, `age: -5`, `T_eq: 'x'` all report `'measured'`. Append `{massEarth:0, age:0, T_eq:0, surfaceHistory:{}}` ⇒ gate 3 reads 0 defaulted, gate 4 reads g=0 ∈ [0,3], gate 2 unchanged, DRAW STREAM green.

**B5 — The gravity gate passes a mass wrong by up to 13.3× (median 1.8×), and that error moves Step 9's own declared consumer on 100% of moons.** *(refuter 3)* Omitting the density factor (`massEarth = radiusEarth³`) gives max 2.616 g — still inside [0,3]. Fed through `craterSchedule`, which Step 9's declared first move (`PLAN.md:441`, replace `Planet.js:1596`'s `ROCKY_TYPES.has(d.type)` with `craterRelevanceOf(condition)`) puts on the moon path: `regolithRoughness` moved 2109/2109, `sizeMul` 2109/2109, `nStamp` 1765/2109, median |Δ| 13.7%, max 239%. This is the §11.3.1 D-clause satisfied literally.

**B6 — 8b is a universe change.** *(lane NUMBERS + refuters 2 & 3, three harnesses)* 22.0–22.7% of planet-class moon generations change draw count; **17/75 and 47/211 moon records move `radiusEarth`, `orbitRadiusEarth`, `orbitSpeed`, `inclination`, `startAngle`** — none of which is a column in the declared delta table. Plus 7/8557 planets move via `systemContext`, and Instrument B's DRAW STREAM reds on 6-7/221 seeds — a channel `PLAN.md:394` has already trained the author to read as fatal.

**B7 — `ExoticOverlay` mutates the derivations' own inputs after `generate` returns.** *(refuter 1; I reproduced it in `syn3.mjs`)* `ExoticOverlay.js:325-337`, reached from `StarSystemGenerator.js:920` after every moon is generated, multiplies `moon.radiusEarth`, `radiusScene`, `orbitRadiusEarth`, `orbitRadiusScene`, `radius`, `orbitRadius` by kEarth/kMap. **Mine, `wd-0…1499`: 56 swaps, 31 with moons, 34 moons rescaled, kEarth 0.1329–2.6818, `k === 1` on zero of them.** Any derived `massEarth` is not rescaled ⇒ `surfaceGravity` carries an error of exactly 1/kEarth², up to **56.6×**. The byte-identity gate is structurally blind (same mutation both sides of any A/B). **This is already a live defect on the shipped `tidalHeating` (`MoonGenerator.js:161`), not something 8a introduces.**

**B8 — The Sol gate is unsatisfiable inside Step 8's Files.** *(refuter 3; I verified the two facts)* `grep -c massEarth src/generation/SolarSystemData.js` → **0**; `grep -n MoonGenerator` there → one hit, a comment at `:55`.

**Attacks run that broke nothing** — so "nothing found" is a coverage fact:
- **Append point inside `generate`**: `generate` (`:93-205`) has exactly one early return (`:100`, before any plain-path code); last draw is `:202`; no draw after the return literal. Hoisting to `const moon = {…}; …; return moon;` is valid *with respect to `generate`'s own draws*. (Invalidated only by B7, which is about the record's lifetime.)
- **Post-return re-entry into the shared rng**: none. `moonRng` (`StarSystemGenerator.js:594`) is per-moon and discarded; `:596-597` writes `_systemSeed`/`_ordinal` with no draws. Blast radius of any splice is confined to that one moon — measured 0/6764, 0/1985, 0/803 plain moons across three lanes.
- **Do the new derivations need a drawing callee?** 5 of 6 are draw-free: `equilibriumTemperature` (`PhysicsEngine.js:121`), `tidalLockTimescale` (`:264`), `checkTidalLock` (`:280`), `computeSurfaceHistory` (`:796`), mass-from-density. Only `deriveComposition(…, rngFloat)` (`:380`) takes a drawn float — as the plan says.
- **Do `iceness`/`landPalette`/`lavaGlowColor`/`lavaCrustColor` gate a draw?** No — assigned at `PlanetGenerator.js:808-827`, after the last draw at `:782`. **Does `composition` gate one?** No — `ironFraction` is orbit-free (`PhysicsEngine.js:387-389`), 0/211 flips; ring floats are pre-drawn at `:568-569`.
- **Golden-trajectory harness at risk from 8b?** No — `tests/golden-trajectories/canonical-scenario.js` imports only `accumulator.js` + `mulberry32.js`, zero generator references.
- **Non-JSON hazards in the moon record** (undefined / NaN / ±Inf / -0 / functions / Symbols / Dates / Maps / accessors / cycles): **0 across 794 records**. One real finding: 1598 *aliased* refs — `baseColor`/`accentColor` point into the module-level `PALETTES` table (`MoonGenerator.js:110`). Harmless to hash; **fatal if any 8a code writes in place**.
- **Full suite under a simulated 8b**: control 25 failed / 5293, sim 27 failed / 5293. Newly failing exactly 2, newly passing 0.
- **Rename simulation, 4 scenarios** (lane RENAME, in a tar copy that reproduces the live citation counters byte-identically): B1 file-only → exit 69 module-not-found; B1″ imports fixed, tool stale → exit 3 naming the dead mapping; B2 key frozen, value repointed → **exit 0, counters diff-identical 400/421/0/0/0/2/1/6**; B3 key "tidied" → exit 2 with 6 unresolved. Function rename → exit 2 on **exactly one** citation, `PLAN.md:779`.

---

## 3. THE COMMIT SHAPE

**The recording-vs-checking fact that makes this plan work.** The widened moon hash was recorded in `tests/baseline/body-identity.json` at commit **`b2ac455` (Step 0)**, eight commits before HEAD `f679046`. There is **no "widen Instrument B" commit to write** — the widening shipped. Because the recording predates every commit below, the check **can fail**, and that is an accident of Step 0's sequencing, not of Step 8's design.

**The rule that keeps it non-vacuous, stated once and enforced per commit:** `WD_REBLESS_BODY_IDENTITY=1` must not run inside C1, C2, C3, C4 or C7. Mechanical check before each of those commits — `git log -1 --format=%H -- tests/baseline/body-identity.json` must return a sha **older than the commit being made**, and `git diff --cached --name-only` must not contain `tests/baseline/`.

| # | Commit | What it changes | Why it is its own commit | Gate that must be green before the next starts |
|---|---|---|---|---|
| **C0** | `docs(step 8): correct the numbers Step 8 is sold on` | `PLAN.md` §4 Step 8 + `:545` + §11.7 + `CARRIED.md`. Every row of §1 above that says NO. Per §10, `conditionFromPlanet.js` refs go symbol-only; per the line-count-neutrality rule, **expand lines, do not insert** | Navigational rot inside the region Step 8 edits is class N and blocks per §11.1. Folding it into a code commit makes the code diff unreviewable | `npm run port-uniform-delta:citations` → **400/421/0/0/0/2/1/6, exit 0** (unchanged) |
| **C1** | `test(Instrument B): planet-class side-channel + counted assertions` | Test-only. Add a **top-level** `baseline.planetClassMoons` map keyed `seed/planet/moon`, derived live in `captureAll`'s second pass (`tests/body-identity-fence.test.js:355-361`, which already holds `m.isPlanetMoon`). Rewrite BODY IDENTITY / RECORD SHAPE to assert **counts and partitions**, not identity | ⛔ **It must not go inside `hash({system, planets})` (`:290`).** Measured: adding a `pc` key inside `planets[]` moves `wd-0`'s rollup `e67f7a5184d423ac → 95dbe61d46cc21be`, which breaks NEGATIVE CONTROL at `:572` and forces a 221-seed rebless **inside** the gated commit. And without this commit, "only allowed diff is planet-class" is a sentence with no mechanism | `npm run test:body-identity` → **8 passed**; and every `rollup` in `tests/baseline/body-identity.json` **unchanged** (`git diff --stat tests/baseline/` → empty) |
| **C2** | `refactor: conditionFromPlanet → conditionFromBody (file + function)` | `git mv` the file; rename the export; 25 code files; the 2 string gates (`tests/port-condition-contract.test.js:2757` adapter-name, `:3660` export surface); `tests/port-route-agreement.test.js:124` needle; `tools/port-uniform-delta.mjs:943` **value only** and `:1042`; repair `PLAN.md:779` | Zero behaviour change. Keeping it separate is what makes C4's diff readable. ⛔ **Do not touch the CITE_FILES *key* at `:943`** — measured exit 2 with 6 unresolved refs | Citations **400/421, exit 0, diff-identical**; `npm run test:body-identity` **8 passed, all hashes byte-identical**; full suite failure count unchanged from Instrument A's blessed 24 |
| **C3** | `feat(plumbing): thread the parent's real orbit AU into MoonGenerator` | Pass `orbitRadiusAU` to `MoonGenerator.generate` at `StarSystemGenerator.js:595` (it is in scope there — `:605` writes it onto the wrapper) and forward to `_generatePlanetMoon`. **Nothing consumes it yet** | `planetData.orbitRadiusAU` is undefined on 6279/6279 (mine). Both 8a's `T_eq` and 8b need it. Landing it inert means it can be gated by **full byte-identity**, the strongest gate available — which is impossible once anything consumes it | `npm run test:body-identity` → **all three channels byte-identical green**. Any red here means the signature change leaked |
| **C4** | `feat(8a): moons carry a derived condition record` | `src/generation/MoonGenerator.js` only. Hoist the literal (`:165-204`) to `const moon = {…};`, append the six derivations, `return moon;`. Plain assignment. Use the `:257-263` namespace pattern with a **new** prefix (`mooncomp:`) for `deriveComposition`'s float | The production change alone, against a baseline recorded 8 commits earlier | Three-channel verdict written into the commit message **before the run** — see §6 |
| **C5** | `re-record(Instrument B): bless 8a's additive moon fields, named` | `tests/baseline/body-identity.json` **alone** | Reblessing inside C4 destroys the only control Step 8 has | `git diff --stat` shows exactly one file; the diff touches only moon hash strings + `moonShapes` (a third shape appears); zero `rollup`… wait — rollups **will** move, since moon hashes feed them. State that in the message as an expected count |
| **C6** | `test(8a): value gates for the six derivations` | New `tests/moon-condition-contract.test.js` + `tests/moon-rng-stream-identity.test.js` (§5) | These must be written against a **stable** baseline, or a failing value gate is indistinguishable from an unblessed hash | New file green; a named mutant per gate reds it (§5) |
| **C7** | `fix(8b): planet-class moons generate at the parent's real orbit` | `MoonGenerator.js:278` `1.0` → the threaded AU | The universe change, isolated | Delta table **including geometry columns**; Instrument B partitioned by channel — see §5 gate 7 |
| **C8** | `re-record: bless 8b across three instruments` — **three commits, one per instrument** | `tests/baseline/body-identity.json`; `tests/baseline/port-uniform-capture.json` (65 bodies: 1 S + 64 P); Instrument A's failing-ID baseline (24 → measured 26) | One commit per instrument or the delta table is unfalsifiable — you cannot tell which instrument's red you blessed | Each: exactly one baseline file in the diff, counts in the message matching the numbers C7 predicted |
| **C9** | `test(route agreement): the M stratum + a mutation-window control` | `tests/port-route-agreement.test.js` — add plain moons, with a comparator that is **not** `bakedOn` | ⛔ Adding plain moons to the existing P-stratum comparator reds **1834/1834** instantly, because `bakedOn` (`:207-210`) reads four bakes `MoonGenerator` never writes. This needs its own comparator | Ledger C2 and C3 (`CARRIED.md:18-19`) close with a named mutant each, or they get promoted to blocking per §11.6 |

---

## 4. THE RENAME DECISION

**File AND function, in one commit (C2).**

| | function only | **function + file** |
|---|---|---|
| code files that must change | 19 | **25** |
| …incl. keeping comments consistent | 27 | 33 |
| doc/`.html` files that go stale | 9 | 9 (same set) |
| citations that must be repaired | 1 (`PLAN.md:779`) | **1 (the same one)** |
| lines in `tools/port-uniform-delta.mjs` | 1 | **3** (`:943` value, `:1042`, plus its own prose) |
| citation fence after | 400/421 exit 0 | **400/421 exit 0 — diff-identical** (measured) |
| failure mode if you miss a site | exit 2 + 5 tests red | same **plus** exit 3 (dead CITE_FILES) and exit 69 (module not found) — strictly louder |

**Marginal cost: 6 files, 2 lines, 0 additional citations repaired.** Line numbers survive because a pure rename preserves content byte-for-byte and the CITE_FILES *key* is a citation spelling, not a basename. Three reasons beyond cost: `PLAN.md:398` already lists `src/worldengine/port/conditionFromBody.js` under Files and `:584` already writes the post-rename name, so a function-only rename leaves the plan citing a file that does not exist, in the scanned set, with no gate that can see it (the ref is symbol-less prose); splitting it costs a second migration and leaves every future author's grep for the moon adapter landing on the planet filename; and Step 7 already ran this play and left the recipe in-file at `tools/port-uniform-delta.mjs:964-971`.

**Two hard preconditions, both measured:** do not change the CITE_FILES key at `:943` (repoint the value only — tidying the key is exit 2 with 6 unresolved); and repair `PLAN.md:779`'s symbol (`src/objects/Planet.js:1594 \`const condition = conditionFromPlanet(d);\``) in the same commit — it is the only `line + symbol` citation repo-wide carrying the identifier, verified by `grep -rnoP ':\d+\s*`[^`]*conditionFromPlanet[^`]*`'` → 1 hit.

---

## 5. THE GATE LIST, REWRITTEN

Each replacement gate carries a **named mutant** that must red it.

| Step 8 gate | Verdict | Replacement | Named mutant |
|---|---|---|---|
| **G1** `:394` whole-record hash, byte-identical | **REPAIR** — the widening shipped at `b2ac455`; byte-identity is impossible in the same breath | *"C4: DRAW STREAM green 221/221. BODY IDENTITY red on exactly N plain moons, 0 planets, 0 planet-class. RECORD SHAPE red naming exactly the six appended keys on the plain shape only. **A green RECORD SHAPE is a FAILURE** — it means the append was non-enumerable."* N is written into the commit message before the run | **`nonenum`**: change one append to `Object.defineProperty(moon,'massEarth',{value:m,enumerable:false})` ⇒ RECORD SHAPE must red. **`onemoretoo`**: 771 plain moons instead of N ⇒ counts assertion must red |
| **G2** `:395` per-type draw count pinned to a committed number | **REPLACE** — not satisfiable: every type has 2-8 counts (rocky/ice/captured 11-13, volcanic 12-13, terrestrial 17-18, planet-class 18-29), and the plan's own prescribed namespace idiom draws from a different object the gate cannot see | Delete it. Instrument B's DRAW STREAM channel already strictly dominates it, and C1 makes that channel counted. In its place, `tests/moon-rng-stream-identity.test.js` pins the **per-(parent-type, moonIndex, resulting-type) draw-count SET** over ≥1500 seeds, as documentation of the stream shape rather than a gate | **`extradraw`**: insert `rng.float();` before `MoonGenerator.js:157` ⇒ every set shifts +1 and DRAW STREAM reds |
| **G3** `:396` `_provenance` zero `'defaulted'` on ≥500 moons | **KEEP as a presence gate + ADD value gates** — `conditionFromPlanet.js:682` is `v != null`, so `massEarth: false` reads `'measured'` | Presence arm: reuse `body-identity-fence.test.js:93`'s `BULK_SEEDS` (**713 moons**, 40% headroom, same population as G1) with a population guard `expect(moons.length).toBeGreaterThanOrEqual(500)` as its own `it()` **first**. Baseline to beat: **691/713 defaulted on each of `massEarth`/`age`/`T_eq`/`surfaceHistory` → must go to 0.** Value arm: `\|massEarth − radiusEarth³·ρ_parent\| / massEarth < 1e-9`; `T_eq === equilibriumTemperature(zones.luminosity, parentOrbitAU)` exactly; `tidalState` and `composition` too — the plan gates 4 of its 6 declared derivations | **`zerofill`**: append `{massEarth:0, age:0, T_eq:0, surfaceHistory:{}}` ⇒ presence arm stays green (that is the point), **value arm must red**. **`nodensity`**: `massEarth = radiusEarth³` ⇒ value arm reds |
| **G4** `:397` `surfaceGravity ∈ [0,3] g` | **REPLACE** — cannot fail (max **0.539 g** under the declared formula, mine) and already fails today (planet-class max 3.13-3.26 g, against a shipped `< 5` at `moon-mass-radius-consistency.test.js:76`) | Two-sided, per-body: `\|g − radiusEarth × ρ_parent\| / g < 1e-9` on every plain moon, plus a distribution assertion `p95 < 0.30 && max < 1.0` on plain moons and the existing `< 5` retained for planet-class. **Plus** the ExoticOverlay consistency assertion nobody proposed: **after** `StarSystemGenerator.generate` returns, `\|massEarth / (radiusEarth³ · ρ_parent) − 1\| < 1e-9` on the 34-in-5018 swapped-parent moons | **`nodensity`** (above) ⇒ max jumps to 2.62, still inside [0,3] but the per-body arm reds. **`exotic`**: leave `massEarth` un-rescaled at `ExoticOverlay.js:325-337` ⇒ post-overlay arm reds on the 34, error up to 56.6× |
| **G5** `:398` Sol's Moon 0.165 ± 0.01 g | **REPLACE or DEFER — Max's call (Q1).** Unsatisfiable: `SolarSystemData.js` contains zero `massEarth` (mine), Sol's Moon is a literal at `:191-201`, `MoonGenerator` is never invoked for Sol (mine), and the declared formula gives 0.273 g (Sol-Earth is massless) — **9.8 tolerances off** | If Q1 = yes: give every Sol body a real `massEarth` in `SolarSystemData.js`, add that file to Step 8's Files, and the fixture becomes a genuine regression test. If Q1 = no: retire the gate to the `CRATER_VIS_FLOOR_RAD` follow-on at `:404` — **it is the same undeclared work** | Under Q1=yes: **`moonmass`**: revert the Moon's `massEarth` literal ⇒ fixture reds at 13.4176 |
| **G6** `:399` zero truthy atmosphere with undefined pressure | **REPAIR** — measures 0→0 forever; the only violating shape is the flat-passthrough branch at `conditionFromPlanet.js:380`, which 8a never writes, on a subject that is 0.09-0.14% of moons (**expected 0.46 in a 500-moon sample**) | Add a forced-population arm: pin `wd-1403` (already pinned at `body-identity-fence.test.js:108`) **plus** a synthetic `MoonGenerator` output shaped `{ retained: true, color }` with no `.physics`, asserted **caught**. Without the forced arm, delete the gate rather than ship decoration | **`flatatmo`**: change `MoonGenerator.js:194-196` to emit `{retained:true, color}` ⇒ forced arm reds |
| **G7** `:401` 8b delta table + "Instrument B's only allowed diff is planet-class moons" | **REPLACE** — the declared columns (`T_eq`, composition, `iceness`, `landPalette`, `lavaGlowColor`, `lavaCrustColor`) do not cover what moves, and 7 planets + 6-7 draw profiles move too | Delta table gains **geometry columns**: `radiusEarth`, `orbitRadiusEarth`, `orbitSpeed`, `inclination`, `startAngle` — expect ~22% of planet-class moons to move each. Instrument B split by channel and enumerated: **DRAW STREAM red on exactly the named seed set; BODY IDENTITY red on exactly {24 planet-class moons} ∪ {7 planets, each moving only on `systemContext`}; plain moons 0/803.** Plus the systemContext feedback path named in the message (`StarSystemGenerator.js:966-972`) | **`postmigration`**: substitute the wrapper's **post-**migration `orbitRadiusAU` (mutated at `StarSystemGenerator.js:655`) instead of the pre-migration one ⇒ the enumerated seed set must change |

---

## 6. ORDER OF OPERATIONS FOR 8a's BYTE-IDENTITY (C4)

Spelled out so the gate can fail.

1. **Record the baseline's provenance.** `git log -1 --format='%H %ad' -- tests/baseline/body-identity.json` → must be `b2ac455` (Step 0) or C1's commit, and must be **strictly older** than the commit you are about to make. Paste the sha into the commit message. If it is your own commit, stop — the gate is vacuous.
2. **Capture the before-state.** `npm run test:body-identity` → must be **8 passed**. Record the duration.
3. **Predict, in writing, before touching `src/`.** Run a read-only probe that counts plain vs planet-class moons over the fence's 221 seeds and write the three-channel prediction into the commit message draft: *DRAW STREAM green 221/221 · BODY IDENTITY red on exactly N plain, 0 planet-class, 0 planets · RECORD SHAPE red naming `massEarth, age, T_eq, composition, surfaceHistory, tidalState` on the plain shape only.* (Lane INSTRUMENTB measured N = 770 on the fence's 221 seeds; refuter 3 measured 803 over `wd-0…220`. Re-derive it yourself — the two lanes used different seed lists.)
4. **Write the change.** Hoist `MoonGenerator.js:165-204` to `const moon = { … };`, append with **plain assignment** (`moon.massEarth = …`), `return moon;`. ⛔ No `Object.defineProperty`. ⛔ No in-place write to `moon.baseColor`/`accentColor` — they are refs into the module-level `PALETTES` table (`:110`), 1598 aliased refs measured. ⛔ Any needed float comes from a **new** namespace prefix per `:257-263`, never from `rng`.
5. **Run.** `npm run test:body-identity`.
6. **Read the three channels against the prediction, in this order.**
   - DRAW STREAM red ⇒ **a draw leaked. Revert.** This is the only channel where red means wrong.
   - RECORD SHAPE **green** ⇒ **failure, not pass.** The fields were attached non-enumerably. Revert.
   - BODY IDENTITY red on a count ≠ N, or any planet, or any planet-class moon ⇒ the change was not additive. Revert.
7. **Verify no rebless leaked in.** `git diff --name-only` must contain **only** `src/generation/MoonGenerator.js`. `git log -1 --format=%H -- tests/baseline/body-identity.json` must be unchanged from step 1.
8. **Commit C4 with the failing test run in the message**, verdict-vs-prediction inline.
9. **Only then, C5:** `WD_REBLESS_BODY_IDENTITY=1 npm run test:body-identity`. `git diff --stat` must show exactly one file. Skim the diff: moon hash strings + a third entry in `moonShapes` + moved rollups, nothing else. Message names Step 8a and the N/0/0 split.

The gate can fail at steps 6 and 7 because the answer it is checked against was written at step 3 and recorded at `b2ac455`. Reversing steps 5 and 9 makes every one of those checks vacuous.

---

## 7. OPEN QUESTIONS FOR MAX

Two. Everything else I decided above.

**Q1 — Does Sol get real masses in Step 8, or does the Sol-Moon gate get retired to a follow-on?** `SolarSystemData.js` has zero `massEarth` on any of Sol's 39 bodies; every Sol moon's gravity today is 1/R² (the Moon 13.42 g, Phobos 346,021 g, **Deimos exactly 1,000,000 g**). Fixing it means hand-authoring masses for 39 bodies in a file Step 8 does not declare, and it changes Sol's rendering inputs — the one system that by your standing rule cannot validate procgen. **My recommendation: retire the gate from Step 8 and fold Sol's masses into the `CRATER_VIS_FLOOR_RAD` follow-on already filed at `PLAN.md:404` — it is literally the same undeclared work** (that constant was calibrated "on Sol's 39 bodies" whose gravity was fabricated as 1/R²). Doing both at once, once, with one delta table. This is yours because it changes what Step 8 means as a deliverable.

**Q2 — 8b changes the size and orbit of ~22% of planet-class moons, and those bodies render today.** Three harnesses agree: `radiusEarth`, `orbitRadiusEarth`, `orbitSpeed`, `inclination`, `startAngle` all move on 17/75 and 47/211 planet-class moons, plus `systemContext` on 7/8557 planets. Planet-class moons are ~3.1% of moons and already reach `Planet.js` (`src/main.js:7636`). So this is a visible world change to bodies you may have already flown past — a saved system's big moon can shift orbit and size. **My recommendation: ship it in Step 8 as C7, with the geometry delta table.** The current state (every planet-class moon generated as if at 1 AU) is the defect Step 8 exists to fix, and deferring it means Step 9's crater pack and Step 10's moon rendering both build on fabricated temperatures. But you may want it after Step 10 so the visible change lands once, with the new renderer, rather than twice.

---

## 8. WHAT IS STILL UNMEASURED

1. **N for C4's BODY IDENTITY prediction.** Lane INSTRUMENTB says 770 plain moons over the fence's 221 seeds; refuter 3 says 803 over `wd-0…220`. Different seed lists. **Nobody ran the real 8a append through real vitest** — every lane simulated `moonRecord`/`canon`/`hash` in a probe. Re-derive N in step 3 of §6, and expect the first real run to be the first time the actual test file sees the change.
2. **The per-*yield* draw profile under a splice.** Refuter 1 measured the per-seed draw **total**, which is only that array's last element. `StarSystemGenerator.js:593` `if (m > 0) yield;` folds moon 0 of every planet into the planet's chunk, so a splice in moon 0 may be invisible at a granularity nobody tested.
3. **The 8b delta table's non-`T_eq` columns.** Only `T_eq` was measured at 75/75 and 211/211. `iceness` (130/211), `landPalette` (115/211) and composition (132/211) come from one lane's single probe; `lavaGlowColor`/`lavaCrustColor` at 211/211 from the same probe. Not cross-checked.
4. **Whether the `_provenance` ≥500-moon gate is reachable after 8a.** The 691→0 target assumes all six derivations land on every plain moon. Nobody has run `conditionFromBody` on a post-8a record.
5. **`_generatePlanetMoon`'s own append point.** 8a declares the plain path only; whether the planet-class path has a draw-clean append point is unmeasured. Step 10 will need it.
6. **The exact `PlanetGenerator.generate` signature/plumbing cost for C3.** Three lanes independently confirmed the AU is not in scope, and all three simulated it by monkeypatching. Nobody wrote the real signature change.
7. **Whether `tests/moon-condition-contract.test.js` and `tests/moon-rng-stream-identity.test.js` can be written without importing the fence's private helpers.** Both files are new (`PLAN.md:392` names them); neither exists.
8. **The `[0,3] g` replacement's p95/max thresholds.** I measured p95 0.229 / max 0.539 on `wd-0…1499` under the declared formula. Those are simulation numbers from a formula nobody has implemented; the real 8a may pick a different density source (`planetData.composition.density` in kg/m³ is also in scope, and gives max 2.04 — a 3.8× different answer).
9. **Instrument C (`port-uniform-capture.json`) under 8a.** Only measured under 8b (65 bodies move). Whether the six appended keys move Instrument C's `identityRecord` is unmeasured — and `systemContext` is in it, which is how 8b's planets moved.
10. **The `_computeTidalHeating` seed collision** (`MoonGenerator.js:258`: two moons of the same parent with identical `orbitRadiusEarth` *and* `radiusEarth` get the same eccentricity draw). Flagged by one lane, never measured as a live collision. Any new namespace in 8a inherits the same key shape.
11. **Live/visual verification of anything.** No screenshots, no browser, no render check. Every number here is headless.


---

## 9. THE TWO OPEN QUESTIONS — BOTH DECIDED BY WORKING-CLAUDE, 2026-08-12

§7 escalated two. Max's standing criterion is *"What I care about is being able to use the systems
that we created for world engine in the main well-dipper game. I want to make this as optimized and
well-architected as possible"* — and he has said explicitly that he does not want to be asked things
an agent can decide. Both are decidable against that criterion. **Recorded here so he can veto
either; neither blocks the build.**

**Q1 — Sol's masses: RETIRED FROM STEP 8, folded into the `CRATER_VIS_FLOOR_RAD` follow-on
(`PLAN.md:404`).** Taking the synthesiser's recommendation, and one argument it did not make is the
decisive one: **Sol is the one system that by Max's own standing rule cannot validate procgen** — 18
real NASA textures, a different renderer, no world-engine condition fields, and `BodyRenderer` swaps
the material after `conditionFromBody` runs (`PLAN.md` §7, last bullet). Hand-authoring 39 masses
inside Step 8 spends the step's review budget on the one population whose numbers prove nothing about
moons, in a file Step 8 does not declare. The gravity defect on Sol's bodies is real (Deimos derives
**exactly 1,000,000 g**) and it is filed, not dropped — it lands with the constant that was
calibrated on those same fabricated numbers, once, with one delta table. ⛔ Gate G5 (`Sol's Moon
0.165 ± 0.01 g`) is therefore **retired from Step 8**, not repaired: it is unsatisfiable inside the
step's declared Files (B8), and a gate that cannot pass is not a standard, it is a blocked commit.

**Q2 — 8b SHIPS IN STEP 8, as C7, with the geometry columns in its delta table.** Two reasons, one
of which retires the objection:

1. **The objection does not apply.** §7 framed the risk as *"a saved system's big moon can shift
   orbit and size"* — bodies Max may have already flown past. **There is no save system.** The galaxy
   is regenerated from seed every session; no persisted world state was found under `src/`, and
   system save/share is a parked FUTURE feature. So 8b is not a change to anything anybody holds; it
   is the same class of change as every other procgen correction in this plan.
2. **Deferring is the worse architecture, which is the criterion.** Step 9's crater pack and Step 10's
   moon rendering both consume `T_eq`, composition and `iceness`. Ship 8b after them and both are
   calibrated against fabricated inner-system temperatures — the error is **two-tailed and 44-48% of
   moons are wrong by more than 2×** — and then move under them. That is two visible changes and one
   invalidated calibration, to avoid one visible change now.

⚠ **What this decision costs, stated so it is not discovered later:** 8b is a universe change (B6),
so it moves `radiusEarth`, `orbitRadiusEarth`, `orbitSpeed`, `inclination` and `startAngle` on
~22% of planet-class moons — about 0.7% of all moons. Those bodies render today. The delta table must
carry the geometry columns, not just the six the plan declares, and C8 blesses three instruments in
three separate commits so it stays falsifiable.
