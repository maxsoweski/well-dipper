# THE COMPREHENSIVE WIRING PLAN — one decision sitting, then nine blocks

**Written 2026-08-20** against `feature/world-engine-production-L1` @ `1777781`. Read-only on `src/`
and `tests/`: nothing under either was touched, no commit, no server, no baseline re-record.
**Companion to** `docs/FEATURES/one-pipeline-two-frontends-PLAN.md` (the plan of record). It
supersedes nothing in it and re-scopes nothing. It answers one question the plan of record does not:
**in what ORDER, and with how few stops.**

⛔ **SUPERSEDES `docs/FEATURES/wiring-execution-plan-2026-08-20.md`** (same day, earlier draft). That
file carried eleven defects that a hostile pass found and this run verified in source — four of them
would have stalled or mis-shipped execution. They are listed in §7.4 with what each would have cost,
so nobody re-derives the earlier shape. **Marking that file superseded is B0 item 1.**

> ⭐⭐ **WHAT MAX ASKED FOR, VERBATIM, 2026-08-20:** *"we need a more comprehensive wiring plan if it
> doesn't exist already that takes dependency/priority orders into account. i don't want to make
> stepwise choices the whole way through the wiring implementation"*
>
> **The second sentence is the design constraint.** A plan that is correctly ordered but keeps
> stopping to ask has failed. The metric being minimised is *how many times does this plan interrupt
> Max* — second only to correctness. Where a stop is unavoidable it is **named here** rather than
> discovered mid-execution.

---

## 0. THE ANSWER, UP FRONT

**Fourteen rulings in one sitting, then SEVEN stops across blocks B0–B7 — and five of those seven are
on the path to a player.** Every one is named in §6.1. A stepwise walk through the same work produces
~19; adopting the Phase-5 plan's own execution model adds ≥20 more on top (§2, B8).

**The shortest path to a player is FIVE blocks: B0 → B2 → B3 → B4 → B7.** Not MVP, not either extra
spine, not Tier 2, not the bakes. Everything shipped in Steps 1–10 — two UAT-passed swaps — is
invisible to players today behind one flag, and what stands between it and them is a short, finite,
fully-enumerated list.

⚠ **This is NOT the earlier draft's "B4 → B7, two blocks."** That claim rested on reading the parity
ledger's `blocking` verdict as "declared, therefore allowed." The ledger defines the word against
itself at docs/FEATURES/step6-parity-ledger.md:94 `- **blocking** — the feature stops reaching the pixel **and the lab material already declares the`
— *"These must close before anyone is shown a parity claim."* Step 12 **is** a parity claim. Flipping
the flag with eight `blocking` rows open ships 632 moons at a pinned terrain frequency, 130
Venus-typed planets with their zonal banding deleted and unrecoverable, 20 live auroras dark, and 59
of 163 newly-admitted solid bodies without their limb exponent. **D-1 is that question and it is
Max's.**

⛔ **This plan cannot be made decision-free, and pretending otherwise is the failure being avoided.**
one-pipeline-two-frontends-PLAN.md:713 `**Max decides:** the round‑2 escalation; anything visual; anything that changes what MVP means; and **retiring** a carried item rather than clearing it. **No agent ever closes UAT** — standing rule, unchanged by this section.`
So the goal is not zero stops — it is **the smallest number of blocks, each ending in at most one Max
touch, with every decision inside a block pre-ruled.**

---

## 0.2 ⭐ THE NINE VERIFIED FACTS THE WHOLE PLAN RESTS ON

Each was measured or read in source **this run**. A plan built without them re-does completed work,
re-asks a refused question, or schedules an impossible gate.

**F-1. Spines 2 and 3 already exist.** `docs/FEATURES/mvp-spine-lab-quality-backlog.md` (QB-1…QB-15,
committed `b2ac455` 2026-08-06) and `docs/FEATURES/mvp-spine-phase5-couplings.md` (69 items,
`P5-G01`…`P5-G52` + `I-1`…`I-15` + `X` + `WS4-7`, same commit) enumerate exactly the two spines
`one-pipeline-two-frontends-PLAN.md:602` says *"still need enumerating"*. Nothing in the plan of
record cites either file, which is why a fresh brief concluded they did not exist. ⛔ **Do not
re-enumerate them.** What genuinely does not exist is the CROSS-SPINE layer (the spine-3 doc contains
zero `QB-` strings) and the ORDER. Those are §1 and §4 of this document. → **B0.**

**F-2. L1 WS1 F1 and F2 shipped 2026-06-24.** Commits `27a77f5` (eccentricity, data-only) and
`367f9fd` (real tidal heating), closed by `ec0cea5`. `docs/NOW.md:2145` records
`**\`world-engine\` PRODUCTION-L1 PORT — WS1 (L0 plumbing) BUILT + ✅ VERIFIED 2026-06-24` and
`docs/NOW.md:1172` already carries the correction in the codebase's own words —
*"WS1 already surfaces tidalHeating — gap is consumption"*. ⛔ The ordering recommendation at HEAD
(`lab-features-not-yet-wired-2026-08-20.md` open item 3, *"WS1 F2 → WS1 F1 → Root 1 → Tier 1"*) sends
execution at completed work.

**F-3. ⭐⭐ NOTHING UNDER `src/` CALLS `deriveUniforms`. This is the most load-bearing fact in the plan
and the earlier draft got its consequence backwards.**
src/worldengine/base/labCore.js:622 `export function deriveUniforms(drivers, qualityTier = 1.0) {`
has **39 call sites: 36 in `tests/`, one in `planet-lod-lab.html`, and ZERO in `src/`.** Six `src/`
files import `labCore` and none imports `deriveUniforms`:
src/worldengine/drivers/rockySurface.js:122 `import { reliefEnvelope } from '../base/labCore.js';` ·
src/rendering/objects/BodyRenderer.js:11 `import { lodRampOf, autoOctaves } from '../../worldengine/base/labCore.js';` ·
src/rendering/LabPlanetMaterial.js:8 `import { lodRampOf, autoOctaves } from '../worldengine/base/labCore.js';` ·
src/main.js:25 `import { approachLadder } from './worldengine/base/labCore.js';` ·
src/camera/agentFraming.js:30 `import { lodPredictionAt } from '../worldengine/base/labCore.js';` ·
src/worldengine/instrument/laws.js:34 `import { reliefEnvelope, Q_RELIEF, Q_RELIEF_DERIVED, RELIEF_FLOOR, RELIEF_CEIL } from '../base/labCore.js';`

**Consequence, stated plainly: a fix inside `deriveUniforms` cannot change one pixel in the game.** It
makes the LAB honest and it pre-writes the laws the packs will carry — that is its whole value, and it
is worth a block, but it is not on the player path and it can never be the thing that answers Max's
Step-10 note by itself.

**F-4. ⭐⭐ THE MOON COMPLAINT'S CAUSE IS TWO-LAYERED, and both layers need a block.**
Measured this run. **Corpus `lab-procedural-0…24` = 110 planets + 86 moons, of which 81 are plain
moons** (`condition.eccentricity === 0`). Sol excluded by construction.

| quantity | plain moons (n=81) | planets (n=110) |
|---|---|---|
| `condition.eccentricity` | **0 on 81/81** | 110 distinct, 1 zero |
| `condition.rawTidalIoRatio` | **>0 on 81/81, 81 distinct** | >0 on 93/110, 94 distinct |
| `condition.atmosphere` null | **81/81** | 0/110 |
| `condition.surfaceHistory.erosion` | undefined 81/81 | undefined 110/110 |
| `condition.surfaceHistory.erosionLevel` | present, 27 distinct | present, 19 distinct |
| `condition.ageNorm` / `condition.seed` / `condition.macroSeed` | undefined 81/81 | undefined 110/110 |
| `deriveUniforms().lavaActivity` | **1 distinct / 0 nonzero** | 60 distinct / 70 nonzero |
| `deriveUniforms().cryoActivity` | **1 distinct / 0 nonzero** | 32 distinct / 40 nonzero |
| counterfactual `clamp01(rawTidalIoRatio)` | **77 distinct / 81 nonzero** | 85 distinct / 93 nonzero |

*Layer 1 — the law.* src/worldengine/base/labCore.js:801 `const tidalProxy = clamp01(tidalHeat);`
reads a `tidalHeat` that src/worldengine/base/labCore.js:649 `const ecc = d.eccentricity ?? 0;`
recomputes from a planet-around-star formula fed an eccentricity that is exactly zero on every plain
moon. The already-forwarded `rawTidalIoRatio` is real and per-body, and
src/worldengine/base/baseStep.js:29 `const rawTidalIoRatio = (d.tidalHeat != null)   // D12 raw Io-ratio, PRE-calibrateTidal`
already has the correct precedence shape eight files away. Aurora dies the same way:
src/worldengine/base/labCore.js:1045 `auroraIntensity: magneticField * (hasAtmo ? 1 : 0),         // Optical reads the field; aurora needs an atmosphere to excite`
and `atmosphere` is null on 81/81.

*Layer 2 — the carrier.* Even with layer 1 fixed, **no pack writes the uniforms.**
src/worldengine/shaders/uniforms.js:235 `uLavaActivity:   { value: 0.0 },   // emissive-crack glow intensity (driven, D12 tidal)` and
src/worldengine/shaders/uniforms.js:462 `uCryoActivity:    { value: 0.0 },   // 0..1 icy-resurfacing activity — owner Cryo; read by Relief (F9/F10 chaos/ridged)`
sit at their factory defaults, and src/worldengine/drivers/rockySurface.js:360 `export const ROCKY_SURFACE_UNIFORMS = Object.freeze([`
declares the pack's whole writer set — **21 names, none of them a lava, cryo, aurora, terminator, limb
or noise-scale name.** `grep -rn 'uLavaActivity\|uCryoActivity' src/worldengine/drivers/` is empty.
`docs/FEATURES/r-rows-decision-packet-2026-08-20.md:394` states the population figure: *"309 are
written by no `src/` pack for any body class"*, of 356.

⭐ **So the earliest honest re-run of the Step-10 moon UAT is at B3, not B1.**

**F-5. ⭐ THREE OF THE EIGHT `blocking` LEDGER ROWS MAY ALREADY BE CLOSED AND NOBODY HAS RE-MEASURED.**
`ROCKY_SURFACE_UNIFORMS` contains **every name in P-12** (`uFreshColor` `uWeatheredColor` `uSedColor`
`uBioGroundColor` `uBioGroundCover` `uIcenessMix`), **every name in P-13** (`uMacroOffset`
`uDetailOffset` `uCraterOffset`) and **four of the five in P-14** (all but `uDispDomainScale`). All
three rows' evidence reads *"value-defaulted on 103/103"* — a denominator from **before** Step 10a
widened the subject set past 163. ⚠ **This is a re-measurement, never an assumption**, because P-11
already recorded the counter-example: `uLimbColor` *"limbDeck writes it too, yet it still diverges from
the game material's value on the compared bodies — so writing a uniform is not the same as agreeing
with the game's own derivation of it."* → **B0.**

**F-6. The "124 stale `planet-lod-uniforms.js` refs" defect does not exist and the repair is prohibited
in source.** `node tools/port-uniform-delta.mjs --check-citations` at HEAD → **exit 0, "all 531
symbol-anchored citations resolve [inputs cf62869fba7a]"**.
tools/port-uniform-delta.mjs:972 `'planet-lod-uniforms.js': 'src/worldengine/shaders/uniforms.js',`
is a deliberate alias under a comment reading *"⭐ STEP 7 MOVED ALL FOUR OF THESE UNDER `src/`, AND THE
KEYS DELIBERATELY DID NOT MOVE WITH THEM… rewriting 152 refs would touch the evidence to spare the map.
⛔ Do not 'tidy' these keys."* ⛔ **Struck, with the reason recorded (§7.1 row 8)** so a fourth session
does not re-discover it.

**F-7. R5 (does `src/worldengine/` admit three.js?) was ANSWERED and Max refused the question once.**
`docs/FEATURES/one-pipeline-two-frontends-CARRIED.md:39` row **C25**: *"⭐ **ANSWERED 2026-08-12 —
`src/rendering/bake/`.** Max declined the question as posed (**"I really don't know how to rule on
this... I'm not sure why it matters"**) and replaced it with a criterion: **"as optimized and
well-architected as possible"** … **Still its own step** — moving 108 KB and 24 exports is not a
ride-along."* one-pipeline-two-frontends-PLAN.md:576 `- **The river/tectonic bakes.**` still poses it as open; that half is stale, and the ref is corrected here from `:575` (the storm slice) — B0 item 5 annotated the real bullet in place.
⛔ Putting it in Max's batch re-asks a refused question.

**F-8. Step 12's Instrument-E caveat has expired, and its tolerance is derivable.** All three hooks
exist: src/main.js:3190 `freezeFrame(declared = {}) {` · src/main.js:3325 `cameraPose() {` ·
src/main.js:3346 `setCameraPose(pose) {`. And `one-pipeline-two-frontends-PLAN.md:765` records that
`freezeFrame` calls `setGrainStrength` with 0 and pins all four clocks, ending *"`uGrainStrength === 0`
and the four declared values are printed in the caption; a shot taken with grain live is inadmissible
on its face."* ⭐ **So B7's "tolerance declared before the shot" has a value: ZERO** (§2, B7's gate).
Leaving it undefined is how `C15` arrives on schedule — the ledger's own name for "raise the tolerance
until the shot passes."

**F-9. ONE FLAG EXPOSES BOTH SWAPS, and the moon route is not the one the earlier draft cited.**
src/objects/Planet.js:2153 `export const LAB_GAS_BODIES_DEFAULT = false;` is the first term of the
admission test at src/objects/Planet.js:2189 `export function labPipelineAdmits(d, condition) {`,
which has exactly one call site — src/objects/Planet.js:2019 `const decision = labPipelineAdmits(d, condition);`
inside `_createLabSurface`, reached for moons through
src/objects/Moon.js:58 `Planet._createLabSurface(geometry, d, conditionFromBody(d), lightDir, lightDir2, starInfo)`.
There is **no separate moon flag**, so this is one flip exposing both shipped swaps at once. ⚠ The
earlier draft cited `src/rendering/objects/PlanetMoonBody.js:33` as a second flag read; that line is
prose inside a comment block and the file reads no flag at all. ⛔ I did not touch the flag.

---

## 1. ⭐⭐ THE DECISION BATCH — ✅ ELEVEN RULED 2026-08-20 · ⛔ FOUR STILL OPEN

⭐⭐ **RULED 2026-08-20 — Max, delegated to the plan's own recommendation** (*"go ahead with your
recommendations"*): **D-1, D-2, D-3, D-4, D-5, D-8, D-10, D-11, D-12, D-13, and D-14's PROMOTE half.**

⛔⛔ **FOUR ARE STILL OPEN, AND ONLY MAX CLOSES THEM** — they are the whole of what §1 still owes:
· **D-6, the canyon look** — B0 took the shot 2026-08-20; it waits on his eyes, not on more work.
· **D-9, `BIO_PIGMENT` darker or greener** — taste, never UAT'd anywhere, and no shot settles it.
· **D-14's RETIREMENT half** — `one-pipeline-two-frontends-PLAN.md:715` reserves it to him by name.
· **D-7** — ⚠ the recommendation CONFLICTS with a hold Max wrote himself. ⛔ NOT adopted; see the row.

⛔ **B0 ran 2026-08-20, before this sitting**, delivering what the batch was owed: the ledger
re-measurement (F-5) and both renders D-6 and §6.3 depend on. No repo file was edited to take them.
**The split criterion is Max's own, given twice** — CHARTER INTENT FRAME (2026-07-19): *"Bring Max only
taste/product calls physics cannot resolve, batched."* And `one-pipeline-two-frontends-PLAN.md:713`.

### 1.1 The fourteen — ✅ eleven RULED 2026-08-20 · ⛔ four STILL OPEN

| # | Status · what was at issue | Blocks | ⭐ THE RULING AS MADE — 2026-08-20, Max, delegated to the plan's recommendation | Lands in |
|---|---|---|---|---|
| **D-1** | ✅ **RULED** — whether the eight `blocking` ledger rows have to CLOSE before the flag flips, or ship as written-down losses. | **B7 — the only player-facing node, and everything behind it** | ⭐ **THEY MUST CLOSE BEFORE THE FLAG FLIPS.** Ruled 2026-08-20 (Max, delegated to the plan's recommendation). The ledger's §2 says so in its own definition: `accepted-loss` is the declared-and-allowed category, `blocking` is not. **This is now B7's gate, not a proposal** — B7 cannot flip with a `blocking` row open. | gate of **B7** |
| **D-2** | ✅ **RULED** — whether *"Pass, with the note that these are all identical"* closes Step 12's Step-10 half. | **B7** | ⭐ **IT DOES NOT. The Step-10 half is ruled OPEN, and is re-run AS B3's UAT** with `wd.labGasBodies` on. Ruled 2026-08-20 (Max, delegated to the plan's recommendation). B1 cannot make one moon look different (F-3, F-4). **No extra stop was created — it merges into a gate that already exists.** | gate of **B3** |
| **D-3** | ✅ **RULED** — scheduling of the two R-rows Max reserved to himself 2026-08-09: **R-07** (Venus zonal banding, **130 bodies**, ruled `blocking`) and **R-05** (lava crust/melt, 52 bodies, `accepted-loss`). | R-07 blocks **B7**; R-05 blocks nothing | ⭐ **R-07 → B3 as a named work item. R-05 → B5, with F8** — same family, same open complaint. Ruled 2026-08-20 (Max, delegated to the plan's recommendation). ⛔ Widening `giantDeck`'s predicate is **struck as a measured no-op**: src/worldengine/drivers/giantDeck.js:201 `const gas = compositionClass(condition) === 'gas';` feeds src/worldengine/drivers/giantDeck.js:225 `uBandStrength: scalar(banded ? 1.0 : 0.0, { gate: 'bands' }),` (⛔ RE-POINTED 2026-08-21 — it read `scalar(gas ? ...)` when this line was written; B3 leg 2 changed it, which is this bullet's own work item done) — a *second* gate behind the pack predicate at src/worldengine/drivers/index.js:115 `applies: (condition) => bandedEnvelopeOf(condition),` (⛔ RE-POINTED 2026-08-21 — it read `compositionClass(condition) === 'gas'` when this line was written). | **B3** / **B5** |
| **D-4** | ✅ **RULED** — scope of the lighting block under ruling #1. | **B4, B7, F52, I-12, 8 optical couplings** | ⭐ **SCOPE IS THE FOUR MEASURED LEDGER ROWS P-01 / P-02 / P-03 / S-01, across the nine verified consumer classes, AUTHORED ON THE LAB MATERIAL — NOT THE LEGACY SHADER.** Ruled 2026-08-20 (Max, delegated to the plan's recommendation). Anything outside those four rows is outside B4. | **B4** |
| **D-5** | ✅ **RULED** — **QB-1, the terminator belt.** Max deferred it 2026-08-14 on the live game (*"that effect needs a ton of work. It has for a long time"*, *"We don't need to do that now."*); ruling #1 (2026-08-06) had folded it into the lighting engine. His later word is the deferral. | **B3's P-11 closure** — a pack must write `uTermStrength`, and with WHICH law was the question | ⭐ **THE DEFERRAL HOLDS. B3 forwards the game's already-tamed law VERBATIM and closes P-11 on parity**; the belt stays exactly as it is. Ruled 2026-08-20 (Max, delegated to the plan's recommendation). ⛔ **No agent re-authors what twilight looks like** — that is the taste call he parked, and it re-opens only on his word. | **B3** (forward) — re-author only if he lifts it, then **B5** |
| **D-6** | ⛔⛔ **OPEN — MAX'S LOOK, AND ONLY HIS.** **QB-7 — are the post-grain canyons enough?** ⭐ **B0 TOOK THE SHOT 2026-08-20; it is now waiting on his eyes, not on more work.** | **F4's block assignment** (694 distinct, never zero — the strongest relief candidate in queue (a)) | ⛔ **NO AGENT MAY ANSWER THIS.** The two frames to look at are `A-PAIR-fulldisc-LEFT-grain0-RIGHT-grain1.png` and `A-PAIR-rift-LEFT-grain0-RIGHT-grain1.png`, in the B0 shot set at `/tmp/claude-1000/-home-ax/d7bf083b-b464-42f5-94fe-04658f23d98e/scratchpad/b0-shots/` with `CAPTIONS.txt` beside them (pose captured BY VALUE and asserted byte-identical across each pair; freeze asserted; the lab carries no film-grain uniform at all). ⚠ **That directory is session-scoped scratchpad — copy it somewhere durable before it ages out.** **If enough → F4 ships in B3; if not → F4 goes to B5** with the other method re-thinks. ⭐ The same shot also settles **P5-G27**, **WS4-7** and part of **P5-G14**: lab-live `1.0` at `planet-lod-lab.html:1442` against the production default at src/worldengine/shaders/uniforms.js:191 `uTectonicGrainStrength`. ⭐ MECHANICAL GATE ONLY, and it is not a canyons-only A/B: grain 0→1 moves 49.37% of the disc ROI while the canyon feature's own footprint is 1.64%, because the grain uniform re-orients six relief features at once. | **B3** or **B5** |
| **D-7** | ✅ **RULED 2026-08-21 — THE HOLD IS LIFTED, WITH A CONDITION ON HOW.** Max: *"I'm fine with this starting after we wrap up here, via handoff to a fresh session."* ⭐ So the `featureRelevant`/`rendersOn` migration MAY start, and ⛔ NOT IN THE SESSION THAT ASKED — it begins in a FRESH session from the handoff, which is the condition and is part of the ruling. ⛔ Lifting this hold does NOT ship WS4: that half of `docs/NOW.md`'s standing instruction is untouched and WS4's AC2/AC3/AC4 remain INSUFFICIENT. Superseded text follows:** ⛔⛔ **WAS: OPEN — ⚠ NOT ADOPTED, because the recommendation collides with a hold Max wrote himself.** Does the `featureRelevant`/`rendersOn` migration come OUT of L1 WS3 into this plan, or does Tier 2 wait for the hold to lift? | **Tier 2 — 5 features, 200–814 distinct masters** | ⚠ **THE CONFLICT, PLAINLY.** The plan recommends **pulling it out**; `docs/NOW.md:1160` is Max's own standing *"do NOT ship WS4; do NOT start WS3."* Adopting the recommendation would override a hold he wrote himself, so **no agent adopted it, and WS3 was NOT started.** ⛔ This row is recorded as a conflict, not as a pending yes. If he lifts the hold, the recommendation stands as written: pull it out with a stop after the FIRST family — **F38 airglow**, same allowlist, unrelated family, tests the mechanism without entangling the four relief laws. ⛔ Naming WS3 F2 as owner does **not** unblock it. | **B8**; promoted to **B5** only if he lifts the hold |
| **D-8** | ✅ **RULED** — **QB-13**: does the shipped e5 deck close the gas-giant close-up complaint, and what happens to the three finished-but-unshipped atmo increments? | QB-13's MVP status; three `verified` workstreams sitting on a shelf | ⭐ **THEY DO NOT SHIP STANDALONE. All three land as B5's gas-atmosphere strand, behind one spike and one UAT.** Ruled 2026-08-20 (Max, delegated to the plan's recommendation). Each carries Max's own open complaints verbatim in its contract (*"still seem pasted on top"*, *"like layers of paper"*), so shipping them as they stand would ship a complaint he has already filed. | **B5** |
| **D-9** | ✅✅ **RULED 2026-08-21 — GREEN, MAX'S OWN WORDS: *"Earth's continents are green where there are forests, if they're on the day side. Green, but I'm interested in alien fauna of different colors also, having systems for that."* ⭐ THE RULING IS **GREEN**, and it comes with a SECOND, LARGER ASK that is NOT this row: a system for per-world pigment colour. ⛔ Do NOT fold the two together — greening `BIO_PIGMENT` is a constant edit inside B5; the per-world system is new scope. ⭐ AND THE SOURCE ALREADY PARKED THE SECOND ONE, WITH ITS INPUT NAMED: src/worldengine/base/surfaceMaterial.js records as a NON-GOAL that *"pigment colour is held fixed. Real photosynthetic pigments track the host star's spectrum… and the condition vector does carry starMassEarth, so this is derivable later"* — verified 2026-08-21, `starMassEarth` resolves 15 times in `src/worldengine/port/conditionFromBody.js`, so the input is reachable today and the only missing piece is the calibration that note declined to guess. ⚠ Max's phrasing says *fauna*; the constant governs photosynthetic ground cover, i.e. flora. Recorded as asked, read as flora, because that is what the pigment drives. Superseded text follows:** ⛔⛔ **WAS: OPEN — TASTE, AND MAX'S ALONE.** **QB-6 — darker or greener?** | QB-6, the only backlog item genuinely wired through a shared module | ⛔ **NO AGENT MAY ANSWER THIS**, and nothing shot so far settles it. src/worldengine/base/surfaceMaterial.js:155 `export const BIO_PIGMENT   = [0.10, 0.16, 0.06];` **darkens** the disc — the physically defensible opposite of *"green stuff"* — and **has never been UAT'd anywhere**. ⛔ Two problems, not one: the pigment is taste and stays here; the coverage law (exactly 0 on 97.9% of 1156 non-gas, max 0.011535, `lab-procedural-0…199`) is its own unit and is NOT gated on this. | **B5** |
| **D-10** | ✅ **RULED** — **QB-12**: authorise the six lab presets; does the METHOD re-think enter MVP? | 8 (d) features + Step 12's deletion of the game's exotic branches | ⭐ **THE SIX LAB PRESETS ARE AUTHORISED. THE METHOD RE-THINK STAYS OUT OF MVP.** Ruled 2026-08-20 (Max, delegated to the plan's recommendation). `mvp-spine-lab-quality-backlog.md:53` names them the hard prerequisite, citing `one-pipeline-two-frontends-PLAN.md:571`: *"replacing a working game feature with a lab feature nobody has ever seen render is how a failure becomes unattributable."* ⚠ **Max named FOUR — biolum, machine, city lights, ecumenopolis. F44 hexTess and F45 shatter were NOT named. ⛔ Nobody widens his complaint to six.** | **B5** |
| **D-11** | ✅ **RULED** — **P5-G17** airglow × limb: does the deliberate layering stay? | 1 coupling | ⭐ **RULED `carried`. ⛔ DO NOT BUILD IT.** Ruled 2026-08-20 (Max, delegated to the plan's recommendation). The spine-3 doc says it cannot be scoped without his word; his word is that it stays carried. | **B8** |
| **D-12** | ✅ **RULED** — does spine 3 enter MVP as 52 items, or as a gated tail? | **what MVP-closable MEANS** | ⭐ **GATED TAIL.** Ruled 2026-08-20 (Max, delegated to the plan's recommendation). ⚠ Corrected against the earlier draft: **only ONE spine-3 item is genuinely free** — `X`, the `ASSOCIATIONS.dependsOn` re-derivation. P5-G18/G19 are **not** free (§2, B8). | **B8** |
| **D-13** | ✅ **RULED** — does the Rule-2 ledger gate land now, or never? | the ability to ever state a number for Rule 2 | ⭐ **IT LANDS NOW.** Ruled 2026-08-20 (Max, delegated to the plan's recommendation). The count is meaningless retroactively; it only bites rows added after it exists. **Split `accepted-loss` into `accepted-loss-lab-has-it` and `accepted-loss-lab-lacks-it`, assert the second's count ≤ 1, and name F52 as the one permitted row.** It was his because it edits a document `tests/material-parity-list.test.js` asserts against. | **B0** |
| **D-14** | ⭐ **SPLIT — PROMOTE half ✅ RULED, RETIREMENT half ⛔ STILL OPEN.** The 10 undead CARRIED rows (C5, C6, C7, C8, C9, C10, C12, C14, C15, C18). | `one-pipeline-two-frontends-PLAN.md` §11.3's exit criterion | ⭐ **PROMOTE half, ruled 2026-08-20 (Max, delegated to the plan's recommendation): a row may be PROMOTED to `blocking` wherever the evidence supports it.** ✅ **RETIREMENT half RULED 2026-08-21 — MAX APPROVED RETIRING THE TEN.** ⚠ HIS WORD WAS *"Ok"* AGAINST A FRAMING OF *"retire ten stale checklist rows… keep or drop"*, so it is recorded as approval-to-retire and NOT as anything wider. ⛔ Each retirement still lands with its evidence cell intact so the act is reversible in git, and ⛔ no ELEVENTH row joins them on this ruling. Superseded text follows:** ⛔⛔ **WAS: RETIREMENT half was NOT delegated and stays Max's alone** — `PLAN.md:715`: *"a carried item that no step clears must be promoted to blocking or explicitly retired by Max."* **No agent retires one.** Every row whose only correct disposition is retirement is PARKED with its evidence assembled, so each costs him one line. | **B0** (promote) · **Max** (retire) |

### 1.2 ⭐ DECIDED — made for you, listed so you can overrule, not so you must rule

| Decision | Made how | Where it lands |
|---|---|---|
| **The bakers land under `src/rendering/bake/`** | Already answered — CARRIED **C25** (F-7). You declined the question as posed. | **B8**, its own step |
| **WS1 F1 + F2 are not scheduled** — they shipped 2026-06-24 | F-2, three independent records | nowhere; struck |
| **The `uNoiseScale` km-wavelength ruling is LIVE** | You ruled it *"AFTER moons ship"*; P-10's evidence bounds the deferral at *"stays at 4.0 through Steps 9-10"*; both shipped and passed. `lab-features-not-yet-wired-2026-08-20.md:354` already drew the conclusion in its own words. Only the calibration table comes to you, at B2's UAT. | **B2** |
| **The `erosion` rename, the `ageNorm` law and the `surfaceGravity` read are BUGS, not authoring calls** | Each disagrees with a law already written elsewhere in the tree (`adaptL0.js:36` and `e1Regime.js:224` both express `clamp01(age/10)`; src/worldengine/base/conditionVector.js:134 `surfaceGravity:  (derived?.surfaceGravity ?? bodySurfaceGravity(fp)) * gravityRadiusRatio(_R, _R_c, _class),` already supplies g). CHARTER INTENT FRAME assigns this class to Claude. | **B1** |
| **F4's chasma axes are FORWARDED on `ctx`, never synthesised in a pack** | Ruled in source: `src/worldengine/drivers/rockySurface.js:48` names the offsets *"⭐ THE OFFSET FAMILY IS NOW FORWARDED — AND STILL NOT DERIVED"* and refuses to synthesise a third seed→vec3 law, and `:76` records that the pack's own test asserts seed-INDEPENDENCE. `reliefOffsets` is the precedent. ⚠ **This corrects the earlier draft**, which told an agent to "fix pack-side" against a pack whose source refuses it. | **B3**, with F4 |
| **Route (iii) for every wiring extraction** — extract each law into a condition-shaped module both sides import | Only route with shipped precedent, three-way: `surfaceMaterial.js`, `bombardment.js` and `atmosphereOptics.js` are each imported by `planet-lod-lab.html`, by `src/objects/Planet.js` AND by a driver pack. `docs/FEATURES/pack-authoring-path.md` documents it; `tests/lab-surface-ratchet.test.js` enforces it shrink-only. | **B3** |
| **P-10 and P-14 get SPLIT, not stretched** | `noiseDetail` *"has no lab counterpart at all and is NOT covered by that ruling"*, and `uDispDomainScale` has no producer — both fail §2's `blocking` test, so both belong with P-06/P-08/P-09 as `accepted-loss`. **The precedent is P-08**, re-ruled 2026-08-19 with *"the original ruling was mine to correct, not Max's to decide."* ⛔ No fourth verdict invented; the three stay three. | gates of **B2** / **B3** |
| **P-13's evidence is stale and gets re-measured, not re-argued** | `db1cf51` forwarded all three offsets; `ROCKY_SURFACE_UNIFORMS` carries them (F-5). | **B0** |
| **The 124-stale-refs repair is STRUCK** | F-6 — the defect does not exist and the fix is prohibited in source. | struck; §7.1 |
| **The aurora law needs no ruling** | Ledger P-05: *"this is a WIRING row, not the law-choice it was filed as, and no ruling from Max is owed"* — the game's `uvFlux` term is not expressible across the condition seam at all. | **B3** |
| **The ordering criterion is DIFFERENTIATION** | docs/FEATURES/r-rows-decision-packet-2026-08-20.md:598 `**Criterion:** what a player sees, per unit of work, on the largest named population — and whether the` — settled, and it is §3's key. | §3 |
| **B7's Instrument-E tolerance is ZERO** | F-8. `freezeFrame` pins all four clocks and forces grain to 0; with grain off and pose restored, full-frame identity means bit-identical. **Any shot needing a nonzero tolerance is inadmissible on its face.** | gate of **B7** |
| **`featureRelevant`'s better-specified owner is L1 WS3 F2** | world-engine-production-L1-plan.md:181 `- **F2 · Replace` (the row reads *"Replace rendersOn allowlists with driver-threshold gates — the biggest lab conflict"*, and names `featureRelevant`) has a migration strategy and a done-criterion at `:194`; `one-pipeline-two-frontends-PLAN.md:578` fences it out with neither. Only the **hold interaction** is yours → D-7. | **B8** |

### 1.3 ⛔ NOT IN THIS BATCH, and why

| Question | Why it is not yours |
|---|---|
| Do the bakers land under `src/rendering/bake/`? | **Already answered** — C25, and you declined the question as posed. |
| Should WS1 eccentricity / tidal heating be scheduled? | **Already shipped 2026-06-24.** |
| Confirm the `uNoiseScale` ruling is live | Its expiry condition is recorded as met in two places. Asking would be choice-theatre in the document arguing against it. |
| The `ageNorm` law | src/worldengine/base/baseStep.js:40 `const ageNorm` was a bug against two existing expressions of the same law, not a third fork. ⭐ **REPAIRED BY B1, 2026-08-20** — the pre-fix text on that line was `d.ageNorm ?? (d.age ?? 0.5)`; it now normalises through `clamp01(d.age / AGE_NORM_DIVISOR)`, the same law adaptL0 and e1Regime already expressed. Movement: `docs/FEATURES/root0-seam-delta-table.md` §Fix 3. |
| The `erosion` rename | A dropped input. The isolation reasoning is already written in source at src/worldengine/port/conditionFromBody.js:261 `// ⛔ AND` — *"deriveUniforms IS DELIBERATELY LEFT UNGUARDED. A defensive fold there would make the…"*. |
| Repair the 124 stale refs | **The defect does not exist and the repair is prohibited** (F-6). |
| Who owns `featureRelevant`? | Doc-conflict, not taste. WS3 F2 wins on done-criteria. Only the WS3-hold interaction is yours → D-7. |
| P-13's `blocking` ruling | Its evidence is stale; re-measure is a technical correction under §11.5. |
| The aurora law | P-05 rules it a wiring row and says no ruling is owed. |
| Parity vs differentiation | **Differentiation** — settled, and it is §3's ordering criterion. |
| **Authorise the two B0 measurements** | Taking a lab render is read-only, costs nothing, and touches no shipped code. The Max-shaped half is the LOOK, and that is D-6. ⛔ Spending a slot in this sitting on permission for a screenshot is the failure the sitting exists to prevent. |

---

## 2. ⭐⭐ THE BLOCKS

Nine blocks. Each is greenlit once and runs to completion without a further question. Gates are stated
**up front**, so nobody discovers one mid-execution.

---

### B0 — Repair the map, re-measure the ledger, take the two shots · **S–M** · no UAT · ⭐ runs BEFORE the batch

**GATE** · `node tools/port-uniform-delta.mjs --check-citations` exit 0 with CHECKED ≥ 531 (it is 531
at HEAD, `inputs cf62869fba7a`) · **§10's line-count-neutrality check** on every edit below
`one-pipeline-two-frontends-PLAN.md:24` — ~30 citations address that file by line, so **expand a line,
never insert one**, verified with the `git show | wc -l` check §10 prescribes · Instrument A: the 32
red-by-design tests unchanged (md5 `2be0e6a9de7be79b5d8c23e0958d2b1c`), everything else green ·
`tests/material-parity-list.test.js` green after every ledger edit.

**Delivers in the world:** nothing visible. It stops the next three sessions from re-deriving what
already exists — which has now happened twice on record — and it tells the batch how big B7 actually is.

**Contents**
1. **Mark `docs/FEATURES/wiring-execution-plan-2026-08-20.md` superseded by this file**, with §7.4's
   defect list as the reason. ⛔ Annotate; do not delete — its evidence is real even where its
   conclusions were not. ⛔⛔ **MOOT, AND EXECUTED AS A RECORD INSTEAD — 2026-08-20.** That file is ABSENT from the tree and `git log --all -- docs/FEATURES/wiring-execution-plan-2026-08-20.md` returns nothing: it was never committed, and it was deleted before B0 ran. There is no file to annotate, so **§7.4 IS the annotation** and is now the only surviving record of that draft. ⛔ Do not recreate it. See §7.4.
2. `docs/FEATURES/planet-lod-CHARTER.md:115` and `:120` still name the superseded
   `lab-pipeline-into-game-PLAN.md` as plan of record. The 2026-08-19 fix repaired only the callout box
   at `:59`. **Two armed copies remain**, in the file `CLAUDE.md` routes every planet-LOD session to
   FIRST, and the charter's own correction box records what this cost.
3. `one-pipeline-two-frontends-PLAN.md:602-605` — correct *"the second and third spines still need
   enumerating"* and **cite both spine files by name** (F-1).
4. `PLAN.md` §7's fence bullet (the 14 backlog entries + 52 couplings, ending *"Max should say so now"*)
   — **annotate as superseded by ruling #2 sixteen lines below it.** `PLAN.md:637` already tabulates the
   change. ⛔ **Annotate in place; do not repeal.** The reasoning it carries is the record of why the
   question was asked.
5. `PLAN.md:576` (the bakers) — annotate as superseded by CARRIED **C25** (F-7). ⚠ **REF CORRECTED 2026-08-20: this read `:575`, which is the STORM SLICE bullet.** The bakers are `:576`. Repaired by locating the symbol, never by adding an offset — the same rule §10 applies to code refs applies to refs into this plan's own sources. **DONE**: annotated in place at `one-pipeline-two-frontends-PLAN.md:576`.
6. **The cross-spine index** — the deliverable ruling #2 actually needs, ~80% pre-computed. Add a QB
   column to the 48-row table in `lab-features-not-yet-wired-2026-08-20.md`; an F/ROOT column to
   `mvp-spine-lab-quality-backlog.md`; a QB column to `mvp-spine-phase5-couplings.md` (currently zero
   `QB-` strings). ⛔ Eight F↔QB pairings are **already** in the 48-doc's *"Already scheduled?"* column
   (F11/F12→QB-3, F18→QB-5, F19→QB-4, F31→QB-9/QB-13, F36→QB-8, F43→QB-11, F46–F49→QB-12, F51→QB-14) —
   do not re-derive them.
7. ⭐ **RE-MEASURE THE LEDGER AT HEAD.** Run `tests/material-parity-list.test.js`'s live pass over the
   post-Step-10a subject set and re-rule **P-12, P-13 and P-14** on measured evidence (F-5). Two outcomes
   are legal and both are fine: `carried` where the pack writes AND agrees, or the row stands with a
   corrected denominator. ⛔ **Compare VALUES, not names** — P-11's `uLimbColor` is the standing
   counter-example.
8. **Correct `world-engine-production-L1-plan.md`'s header.** It still reads *"Status: PLANNING… not
   built"* while WS1 SHIPPED, WS2 SHIPPED (Max UAT, `4b358dc`) and WS4 BUILT-AND-FAILED-UAT under a
   standing hold. Four documents cite it as owner of live work.
9. `planet-scale-normalization-2026-06-15/contract.json` still reads `"status":"building"` for work that
   shipped and passed UAT 2026-06-17. Ledger drift, not build state.
10. ⛔ **STRIKE the stale-path repair item and record WHY** (F-6, §7.1). ⭐ **EXECUTED 2026-08-20 — STRUCK, and the conclusion is recorded at §7.1 row 8, which is where a session doing citation work reads.** Re-measured this run rather than quoted: the fence exits 0 at **542 CHECKED** (`inputs 80196f286708`), i.e. the refs ARE being read. ⛔ A fourth lens has now been stopped here; a fifth should stop too.
11. Add this file to `CITE_SOURCES` at tools/port-uniform-delta.mjs:1023 `const CITE_SOURCES = [` so
    its refs are gated rather than merely written.
12. ⭐ **THE TWO MEASUREMENTS — taken FOR Max, no ruling needed to take them.**
    (a) **the `uTectonicGrainStrength` 0-vs-1 render** on a canyons + scarps + rivers preset — settles
    QB-7 (→ D-6), **P5-G27**, **WS4-7** and part of **P5-G14** in one shot, and the spine-3 doc calls it
    *"the highest-leverage measurement in this document"*;
    (b) **the QB-15 posterize comparison** — one high-`radiusEarth` body in-game at the game's own
    pixelScale against the lab. src/worldengine/shaders/uniforms.js:32 `uLevels:     { value: 6.0 },`
    is a global constant written by no pack, a 0.1667 quantum that caps every COLOUR feature and leaves
    relief untouched. ⭐ **Its result can re-rank B2 and B3** (§6.3 item 1) — take it before the order is
    frozen, not after.
13. **D-13's Rule-2 gate and D-14's ten CARRIED rulings** land here once ruled.

**Closes by ID:** no F / QB / P5 rows. Closes `PLAN.md` §11.1 class-N doc rot, which §11.1 makes blocking
because it sits in files every next step reads. **Possibly closes ledger P-12 and P-13** by
re-measurement.

**Prereqs:** none. **Moves shipped numbers?** **NO** — it moves ledger EVIDENCE, which is the point.
**Needs Max?** **NO to run.** It ends by handing him the batch.

---

### B1 — ROOT-0: the lab-side law seam · **M** · no UAT · ⭐ number-moving, LAB-SIDE ONLY · ⭐ fully parallel

**GATE** · **Instrument C** shipped-uniform delta **byte-identical on all four packs** — a gate that CAN
be met, because of F-3: `deriveUniforms` is not on the game's path, and the only `labCore` export that
reaches a pack is `reliefEnvelope` (src/worldengine/base/labCore.js:1205 `export function reliefEnvelope(radiusEarth, surfaceGravity) {`,
a pure function of two arguments) at `src/worldengine/drivers/rockySurface.js:122`. ⛔ If it goes red the
change leaked out of the seam and must be split; never loosen the gate · **Instrument A** the 32
red-by-design set unchanged, everything else green · **Instrument B** body-identity fence green ·
**a committed delta table** at `docs/FEATURES/root0-seam-delta-table.md`, in the shape of
`docs/FEATURES/step2-tidal-delta-table.md`, **one section per seam fix** — ⛔ the four must NOT be pooled
into one column; the counterfactuals below show the tidal fix and the erosion fix moving **disjoint**
masters, and a pooled table hides that.

⚠ **Blast radius, stated honestly:** 36 test files call `deriveUniforms`, including
`tests/driver-pack-giantdeck.test.js` and the golden fixture `tests/fixtures/v2-0-carrier-golden.mjs`.
The earlier draft said "two test files" and understated this by a factor of eighteen.

**Delivers in the world:** ⛔ **NOTHING A PLAYER SEES, and saying otherwise was the earlier draft's
central error.** What it delivers is (a) every subsequent lab measurement being honest, and (b) the laws
that B3's route-(iii) extractions carry into the packs. **It is not on the player path.**

**The one-defect finding.** `deriveUniforms` is **fp-shaped** and is being handed **condition-shaped**
objects. Four separately-documented "roots" are four symptoms of one impedance mismatch at one seam —
which is why they are ONE block with ONE delta table rather than four blocks with four.

| # | Seam fix | Evidence | Measured effect (`lab-procedural-0…24`: 110 planets + 81 plain moons) |
|---|---|---|---|
| 1 | **erosion** | src/worldengine/base/labCore.js:627 `const erosion` read a key `PhysicsEngine.js:822` never emits — pre-fix text `d.surfaceHistory?.erosion ?? 0`; `erosionLevel` is the one present. ⭐ **REPAIRED BY B1, 2026-08-20**: both spellings resolve, lab wins a tie. | undefined 191/191. On 81 plain moons: `rayBrightness` 1→23, `scarpStrength` 21→42, `mountainAmp` 11→30. On 110 planets: `orogenyStrength` 13→60, `chasmaDepth` 63→95, `plateauStrength` 63→95, `tesseraStrength` 45→62. ⭐ RE-MEASURED over the full 1517: `reliefAmplitude` 1517, `chasmaDepth` 1517, `plateauStrength` 1517, `scarpStrength` 1263, `mountainAmp` 1179, `orogenyStrength` 885, `rayBrightness` 632, `tesseraStrength` 606 |
| 2 | **tidal precedence** | `labCore.js:772` read a `tidalHeat` that `labCore.js:620` recomputed from a zero eccentricity; `baseStep.js:29` already had the correct shape. ⭐ **REPAIRED BY B1, 2026-08-20** — `labCore.js:624` now prefers `d.tidalHeat ?? d.rawTidalIoRatio`, the second being the name a CONDITION uses. | **`lavaActivity` 1 distinct / 0 nonzero → 77 / 81 on 81/81 plain moons.** Same for `cryoActivity`. ⭐ RE-MEASURED over the full 1517: `tidalHeat` moved on 1414, `lavaActivity` 1006, `channelDensity` 1006, `volcanismStrength` 899, `cryoActivity` 596 |
| 3 | **ageNorm** | `baseStep.js:40` got raw Gyr because `conditionVector.js:112` emits `age`, not `ageNorm`; `(1 - ageNorm)` ran negative above 1 Gyr, which is 88.3% of bodies. ⭐ **REPAIRED BY B1, 2026-08-20** — it now normalises through `clamp01(d.age / AGE_NORM_DIVISOR)`. | undefined 191/191. Saturates four interior scalars. ⭐ RE-MEASURED over the full 1517: `ageNorm` 1517, `shellThickness` 1517, `loveK2` 1517, `thermalState` 1503, `despinAmp` 1501, `radialStrainMag` 1501 — the four saturated interiors, named |
| 4 | **surfaceGravity** | src/worldengine/base/labCore.js:639 `const massEarth = d.massEarth ?? 1.0;` fed a g recompute instead of reading `condition.surfaceGravity`. ⭐ **REPAIRED BY B1, 2026-08-20** at `labCore.js:611`, which now prefers `d.surfaceGravity`. | ⚠ **Book as CORRECTNESS, not differentiation.** The 48-doc measures the "correct" substitution making the edifice clamp rail *worse* (834→904 of 1517, `lab-procedural-0…199`). ⭐ **REPRODUCED EXACTLY** by B1's own probe — and the SHAPE is new: the FLOOR rail empties 586→0 while the CEIL absorbs 248→904, so it is one rail replacing two on 59.6%, not the same flatness moved around. Whoever wires the edifice consumer inherits a re-ranging job |

⛔ **THE SEED FIX IS NOT IN THIS BLOCK.** The earlier draft's fix #5 told an agent to route
`ctx.macroSeed` pack-side while simultaneously gating the block on pack byte-identity — two requirements
that cannot both hold, against a pack whose source already refuses the law (`rockySurface.js:48`, `:76`;
`macroSeed` occurs zero times in that file, and `ctx.macroSeed` belongs to gas-only `giantDeck`). The
chasma-axes question is an **F4-wiring** design item whose shape is already ruled in source: forward the
front-end's own axes on `ctx`, exactly as `reliefOffsets` are forwarded. → **B3, with F4.**

⚠ **NOT MONOTONIC.** `erosionLevel < 0.05` on only 144 of 1517 (`lab-procedural-0…199`), so the rename
**narrows** F43's erosion leg from 1517 to 144. Every `< threshold` erosion clause must be re-measured,
not assumed to improve.

**Closes by ID:** no ledger row and no game-visible feature. It takes the **(p) PORT-DROP five** —
**F1** mountains (200→472), **F13** outflow (1→19), **F16** dust mantles (34→173), **F20-strand**
(1→299, 0.0% zero), **F21** karst (23→197) — from dead or near-dead to live at the LAW level, and widens
F3/F4/F5/F6/F12's masters. ⭐ **All five are then wiring work with no bake and no world-gen, and they
need a block: they go to B3's tier 1b.** ⛔ The earlier draft listed them as "unblocked" and gave four of
them no block anywhere; F13 alone is the 48-doc's *"cheapest unblock in the set"* —
docs/FEATURES/lab-features-not-yet-wired-2026-08-20.md:91 `| **F13** | Outflow channels | **(p)** ⭐ |` — planet-lod-lab.html:2166 `state.outflowDensity` → **1 distinct / 100.0% zero** today.

**Prereqs:** none that bind. ⭐ **B1 ∥ B2 ∥ B3 ∥ B4.** ⛔ **B1 → B2 is a FALSE EDGE and B1's own gate
proves it:** src/worldengine/port/craterUniforms.js:157 `const g = Math.max(1e-6, condition?.surfaceGravity ?? 0.5);`
reads the condition directly, and `src/worldengine/base/conditionVector.js:134` builds that field from
`bodySurfaceGravity(fp)`. B1's fix #4 lives inside `deriveUniforms`, which no `src/` file calls. Queue
B0's doc edits rather than applying them while B1 runs
(`feedback_no-mid-run-edits-to-workflow-inputs`).

**Moves numbers?** **YES — lab-side only.** ⛔ It must never ride inside a wiring commit: it would turn a
byte-identity gate red for a reason nobody could attribute. **Needs Max?** **NO.** All four are dropped
inputs or key-spelling disagreements with a law already written elsewhere in the tree.

---

### B2 — The differentiation calibration · **M–L** · ONE UAT · ⭐ number-moving

**GATE** · Instrument A green (32-set unchanged) · Instrument C shipped-uniform delta **deliberately NOT
byte-identical**, with a committed delta table · **the calibration table committed with its corpus
named** · **ledger P-10 SPLIT and re-ruled**: the `noiseScale`/`uNoiseScale` half → `carried` with
measured evidence; a new `noiseDetail` row → `accepted-loss` on the **P-08 precedent**, because it has no
lab counterpart and therefore fails §2's `blocking` test. **M-09 → `carried`** (its evidence already
records that `noiseDetail` has no moon-side equivalent, so it splits clean) · ⛔ three rulings only —
`deferred` is not a legal fourth and `tests/material-parity-list.test.js:772` reddened on it inside one
run the last time a session tried; a deferral lives in EVIDENCE · Instrument E paired shot on a named
body with a same-session liveness pair · **then Max's UAT — the quad, his eyes.**

**Delivers in the world:** ⭐ **bodies stop reading identical at the terrain-frequency and palette level,
on the largest population in the corpus.** `r-rows-decision-packet-2026-08-20.md`'s Option C measures it
as 254 → 371 distinct signatures over 1156 bodies, largest bucket 9.8% → 5.3%.

**Contents** — cite, do not re-derive: `docs/FEATURES/r-rows-decision-packet-2026-08-20.md:564`
`### Option C — Differentiation push: two crater floors, a hue-moving palette input, unpin \`uNoiseScale\``.
1. **Two crater floors** — ✅ **LEG 1 BUILT 2026-08-20.** The line now reads src/worldengine/port/craterUniforms.js:71 `export const CRATER_VIS_FLOOR_RAD = 9.6e-4;`, re-derived from the RENDER-pixel disc at the closest measured approach framing (Max's ruling 2026-08-20: re-derive it from the renderer, touch Sol not at all, and leave the Sol-mass follow-on open) —
   ⛔ the pre-leg text is kept only as the thing corrected and must not be re-quoted as current: it read `CRATER_VIS_FLOOR_RAD = 0.02`, "calibrated on Sol's 39 bodies whose gravity was fabricated as 1/R²". And
   src/worldengine/port/craterUniforms.js:79 `export const CRATER_MIN_VISIBLE = 1.0;`, which retires the fixed `CRATER_MIN_DENSITY = 1e-3` — "which refuses
   151 of 632 plain moons" — into the per-body `density * visibleCells >= CRATER_MIN_VISIBLE`. MEASURED after, on `lab-procedural-0…199`'s 1160 non-gas bodies: cratered 485 → 761, non-gas planets with craters 12 → 214 of 509, distinct `uCraterScale` 21 → 322, bodies rendering under one crater 119 → 0, plain moons with craters 473 → 547 of 632. Derivation + delta table: `docs/FEATURES/crater-floors-calibration-2026-08-20.md`.
2. **A hue-moving palette input** — `uCratonColor === uWeatheredColor` on 73.6% of 1156 non-gas and on
   100% of plain moons (`lab-procedural-0…199`). r-rows §4 calls the palette *"the biggest single reason
   the discs look alike"*.
3. **Unpin `uNoiseScale`** — src/worldengine/shaders/uniforms.js:10 `uNoiseScale: { value: 4.0 },` is
   the factory default on **both** sides while the game draws 4.83–510.6 on its 632 moons with **0 of
   632** equal to 4.0. It is the one frequency in the engine with no physical size behind it, against
   sixteen feature families already km-keyed through `src/worldengine/base/featureScale.js:42`
   `export function featureFrequencyFromKm(radiusEarth, featureSizeKm, cFeature) {`, which
   `src/worldengine/port/writePackUniforms.js:8` makes the pack contract.
4. ⭐ **THE CALIBRATION TABLE IS PART OF THE DELIVERABLE.** Max's condition was that the wavelength
   *"comes to Max calibrated against real bodies, not chosen mid-wiring."* Producing it **inside** the
   block and delivering it at the UAT is exactly how that condition is met without a mid-execution stop.

**Closes by ID:** ledger **P-10** (split) and **M-09** — two of the eight `blocking` rows, i.e. two of
B7's preconditions. ⭐ **No spine-1 feature, and that is the point.**
`lab-features-not-yet-wired-2026-08-20.md` §4 says it in capitals: shipping Tier 1 without these *"leaves
terrain frequency identical on every body in the galaxy and the disc one posterised tone."* These will
never surface from the Tier-1/2/3 list because they are not lab-only features.

**Prereqs:** **B0 only.** ⛔ Not B1 (the false edge, above). **Moves numbers?** **YES**, on ~970 bodies
including UAT'd ones. Own delta table. **Needs Max?** **ONE UAT.** No batch decision — `uNoiseScale`'s
liveness is in the DECIDED list.

⚠ **Why B2's UAT cannot merge with B3's.** Merging ships the Tier-1 packs unseen on top of a
differentiation change; if the quad looks wrong Max cannot attribute it to either. That is the
unattributable-failure trap `PLAN.md` risk 13 exists to prevent. **Two gates here is the cheap option.**

---

### B3 — The wiring block · **L** · ONE UAT (⭐ carries the Step-10 moon re-UAT) · not number-moving

**GATE** · Instrument C shipped-uniform delta **byte-identical on the unswapped population** — this is a
WIRING block and byte-identity is its gate; ⛔ if it goes red, split the number-moving part out, never
loosen it (`src/worldengine/port/conditionFromBody.js:261` names a green gate over a real behaviour
change as this codebase's signature failure) · Instrument A green · Instrument B body-identity ·
Instrument D ≥120 frames, zero exceptions · **ledger P-05, P-11, P-14's crater half and R-07 re-ruled
`carried` with measured evidence**, with `uDispDomainScale` split off as its own `accepted-loss` row on
the P-08 precedent · Instrument E paired shots **with `wd.labGasBodies` ON**, same-session liveness pair
· **then Max's UAT — and D-2 makes this the Step-10 moon re-run.**

**Delivers in the world:** ⭐ **the lab-only features already emitting ≥200 distinct master values start
reaching the game's material, and the moon population stops being identical.** This is the block that
answers Max's Step-10 note, and it is the earliest one that can — F-4.

**Contents, in three tiers.**

*Tier 1a — the nine obstacle-free (a) features* (`lab-features-not-yet-wired-2026-08-20.md:138-147`):
F7 edifices (634 distinct / 22.3% zero), **F37 aurorae** (603/53.5%), F23 snowline (567/51.0%),
F22 polar caps (548/53.6%), F17 glacial (364/69.7%), F9 chaos + F10 ridged icy (227, shared master).
**Held out to B5: F18 sublimation (QB-5), F8 lava (QB-10), and F4 canyons if D-6 says not-enough.**

✅ **LANDED B3 LEG 3, 2026-08-21 — a seventh pack, `solidFeatures`, predicate `!== 'gas'`.** It forwards
fourteen names off ONE `deriveUniforms(condition)` bundle: F7's three, F9/F10's shared `uCryoActivity`
plus `uChaosRaftJitter`, F23's six, F22's `uPldStrength`, F17's two. ⭐ **F37 was already wired at leg 1**
(`solidOptics`, ledger P-05), so leg 3 wired six of the seven and re-measured the seventh.
⭐ **MEASURED over `lab-procedural-0…199` (852 planets + 632 plain moons), before/after on the material:
all fourteen were 1 distinct on every body; after, ten of the fourteen differentiate the 632 plain moons
— `uChaosRaftJitter` 626 distinct, `uGlacialFlowVigor` 626, `uVolcanismStrength` 438, `uPlanetTempEq` 417,
`uPldStrength` 298, `uCryoActivity` 283, `uFrostMaxCoverage` 272, `uEdificeMaxHeight` 40,
`uFrostCondensationT` 5, `uFrostAlbedo` 4.**
⛔ **THREE OF THE FOURTEEN ARE FLAT ON THE MOON HALF and the caption must say so alongside F37's zero:**
`uShieldStratoMix` (1 distinct — `condition.habitability` is undefined on 632/632 plain moons),
`uFrostLocked` (1 — every plain moon reads tidally locked), `uFrostLatitudeBias` (1 — a plain-moon record
carries no obliquity key at all). All three vary on the 852 planets.
⛔ **SEVEN MORE NAMES WERE DELIBERATELY NOT WRITTEN**, each because `labCore` answers it with a bare
literal byte-equal to the lab material's own factory default: `chaosCellScale`, `chaosMatrixRough`,
`doubleRidgeFreq`, `cryoRidgeOffset`, `cryoRidgeWidth`, `groovedBandFreq`, `pldLevels`. Wiring them would
move no pixel and would grow `tests/material-parity-list.test.js`'s non-varying residue, which exists to
tell wiring a law from wiring a constant. ⚠ `uCryoRidgeAxis0`/`uCryoRidgeAxis1` are a DIFFERENT refusal
and they DO cost a value: they are seed-derived and a condition vector carries no `seed` (measured
`undefined` on 1484/1484), so forwarding the bundle's answer would put every body on one rift
orientation. The fix is the `ctx` seed forward F4 got in this same leg; F10's axes are not in leg 3's scope.

⭐ **ROOT-0 FIX 5, FOUND AND LANDED IN THE SAME LEG.** `frostLatitudeBias` was a hard 0 on every
condition-shaped body — not for physics but for a rename: the lab preset key is `axialTilt` and the
condition vector spells it `axialTiltDeg`, and `deriveUniforms` read only the first. MEASURED before:
0 nonzero / 1 distinct on 852 planets and 632 moons, while `condition.axialTiltDeg` ran 0.0123°…85.6487°
over 852 distinct values. After the dual read: 852 nonzero / 852 distinct on planets, still 0 on moons
(their records carry no tilt key of either spelling). Fenced beside B1's four in
`tests/root0-seam-laws.test.js`, same shape as fix 1's erosion/erosionLevel.

⛔ **F37 AURORAE CARRIES A KNOWN DEAD POPULATION, AND THE RULE FOR IT IS GIVEN HERE RATHER THAN ASKED FOR
MID-BLOCK.** `condition.atmosphere` is null on 81/81 plain moons measured and 632/632 in the 48-doc's
corpus, and `src/worldengine/base/labCore.js:1045` multiplies by `hasAtmo`. **Wire it anyway, and say so
in the caption.** P-05 is a `blocking` row whose closure is *forwarding four values*; the value being
zero on moons is a world-generation fact, not a wiring failure, and the row closes either way. ⭐ **But
the UAT caption must state it**, or Max sits down to B3's UAT and reads *"these are all identical"* on
the population B3 exists to fix. The 48-doc wrote that warning already at
`docs/FEATURES/lab-features-not-yet-wired-2026-08-20.md:148` — *"Packing ranks 2, 6 and 8 first and
re-running the moon UAT would produce 632 byte-identical moons on all three."* **Ranks 6 and 8 (F8,
F9/F10) are handled by B1's tidal law reaching the pack through route (iii); rank 2 (F37) is not, and the
honest move is to ship it declared.** The moon differentiation Max will see at this UAT comes from
F9/F10, F17, F22, F23 and B2's frequency work — not from aurorae.

*Tier 1b — the five (p) PORT-DROP features*, live at the law level after B1: **F1** mountains, **F13**
outflow, **F16** dust mantles, **F20-strand**, **F21** karst. ⭐ **F4's chasma axes are forwarded on
`ctx` here**, per the DECIDED list.

⛔⛔ **THIS PARAGRAPH IS WRONG ABOUT FOUR OF THE FIVE, AND B3's RECON MEASURED IT.** Only **F1**'s law is
in `src/` at all. `outflowDensity`, `dustDepth`, `strandStrength` and `karstDensity` return NOTHING from
`grep -rn` over `src/` — they are inline JS inside `planet-lod-lab.html`, outside the module tree and
therefore unreachable from the game. Extracting four laws out of a 5000-line HTML file is a different
unit from wiring a pack, and **Max split them into their own future block on 2026-08-21.** ⛔ Do not
extract or wire them under B3.

✅ **F4's chasma pair LANDED B3 LEG 3** — `chasmaCount` and `chasmaAxes` on `ctx`, from the game's own
`labMacroSeed`, through a single exported `chasmaRiftsFor(seed)` in `labCore` that `deriveUniforms` also
calls (one expression, two callers; byte-identical over 10001 seeds). ⛔ **Forwarded only — no pack
consumes it yet**, which is the DECIDED list's own wording.

⛔⛔ **F1 MOUNTAINS IS ITS OWN UNIT AND B3 LEG 3 DID NOT HALF-WIRE IT.** Its two masters (`mountainAmp`,
`orogenyStrength`) are in `src/`, but the lab's write multiplies them by TWO terms that no condition
vector can answer, and both are PRESET-NAME lookups of exactly the kind
`src/worldengine/drivers/index.js`'s header forbids a pack to make:
`state.featureRelevant.mountains`, recomputed at `planet-lod-lab.html:1987-1988` as
`(ASSOCIATIONS[key]?.rendersOn || []).includes(driverUI.preset) ? 1.0 : 0.0`, and
`state.isExoticCarbonOrGeometric`, computed from `relevantFeatureSet().archs`. The game's answer to
relevance is `src/objects/Planet.js:2204` `export const GAME_RELEVANCE = Object.freeze({});   // pack #1 keys no per-feature relevance`.
`craterRelevanceOf` exists because the lab ALREADY replaced the preset-name lookup for craters with a
condition-derived law (the inc3b S3-fix); **no such law exists for mountains, and writing one is
authoring, not wiring.** ⭐ Recommendation: F1 becomes its own scoped unit alongside the four HTML
extractions, and the first question in it is whether `mountainRelevanceOf(condition)` is a law Max wants
at all — the honest alternative is that mountains are relevant everywhere and both terms collapse to 1.

*Tier 1c — the four `blocking` ledger closures that are pack work:*
- **P-05** aurora — a pack claiming `uAuroraColor` `uAuroraIntensity` `uAuroraRingLat` `uAuroraRingWidth`
  for non-gas conditions. src/worldengine/shaders/uniforms.js:57 `uAuroraIntensity:{ value: 0.0 },   // F37 ring strength (driven: core field x atmosphere, hard-gated field > 0.05; Venus regime-3 override)`.
- **P-11** limb + terminator optics for non-gas — `uLimbColor` `uLimbExponent` `uTermColor`
  `uTermStrength` `uTermWidth`. ⛔ *"must not be closed by scoping the ledger pass to the gas half"*;
  59 of 163 solid bodies diverge on `uLimbExponent` alone. ⭐ **Under D-5's recommendation the terminator
  law is FORWARDED verbatim** — and as of B3-1 it is forwarded from the shared module rather than from
  the game material, so the citations move with it: src/worldengine/base/terminatorOptics.js:58
  `export const TERM_STRENGTH = 0.15;`, and the game reads it at src/objects/Planet.js:1653
  `uTermStrength: { value: term.termStrength },` — never re-authored inside a wiring commit.
- **P-14**'s crater half (`uCraterAmp` `uCraterComplexD` `uCraterScale` `uEjectaAmp`), with
  `uDispDomainScale` split off. ✅ **LANDED B3 LEG 2, 2026-08-21 — and it closed the WHOLE row, not the
  four names.** The ten impact drivers moved OUT of `rockySurface.js` into a shared block both packs
  import, and a sixth entry `craterDeck` (predicate `=== 'gas'`, `rockySurface`'s exact complement)
  emits it on the half that had no writer. MEASURED over `lab-procedural-0…199`, 343 gas planets, all
  ten names: diverging on up to 343 → **0**. On the ledger's own 266-body pass `divergedCarried`
  23 → **15** and `measured()` **67 → 59**. ⛔ `uDispDomainScale` was ALREADY split off at P-15 before
  this leg — verified, not re-done. ⚠ The row's own cell describes the gas half as "the game holds
  craters OFF"; that stopped being true at B2 leg 1 and **204 of 343 gas bodies have a FIRING crater
  schedule**, so the closure forwards a live record rather than switching a family off.
- **R-07** Venus zonal banding, **130 bodies** — per D-3, a condition-derived banding predicate **plus**
  the second gate at `src/worldengine/drivers/giantDeck.js:178`. ⛔ Widening the pack predicate alone is a
  measured no-op. ✅ **LANDED B3 LEG 2, 2026-08-21, AND THERE WAS A THIRD SITE THIS BULLET DOES NOT NAME.**
  One predicate — `bandedEnvelopeOf` (gas OR an opaque CO2 shroud) — read at the registry entry and at
  `uBandStrength`/`uJetStrength`, **plus the pack's `if (!gas) return` early exit**: leaving that would
  have set the master gate to 1.0 with the E5 bake never run, so `zonalBandCol` REPLACES the rocky
  albedo with a flat field. A regression wearing the closure's clothes; measured, not reasoned.
  MEASURED: the condition predicate and the legacy `type === 'venus'` label select the **identical 130
  bodies** (0 in either alone), and all 130 now carry a live gate and a real `aBand`. ⚠ Declared cost:
  those bodies run the gas-giant E5 chain, which re-draws `surfaceGravity` by 5.22 … 20.06× — inside
  the 0.31 … 359.83 spread the deck already applies to the gas bodies it claims today.

**⭐ THE ROUTE — route (iii), and it is Claude's call.** Extract each law into a condition-shaped module
both sides import. Precedent is three-way and shipped (§1.2). ⭐ **Consequence that decouples two
blocks:** each extraction is condition-shaped from birth, so it fixes its own key reads for free —
**B1 is therefore NOT a hard prerequisite for the packs**, only for the lab's honesty and the delta
tables. State this or the plan chains two blocks that need not be chained.

**Closes by ID:** ledger **P-05**, **P-11**, **P-14**(crater half), **R-07** — four more of the eight
`blocking` rows, i.e. four more of B7's preconditions · spine-1 Tier 1a minus three, plus the (p) five.

**Prereqs:** **B2** (they share `rockySurface.js` and `craterUniforms.js`, and concurrent edits to a pack
file make a byte-identity gate unattributable). **B1 recommended, not required.**

**Moves numbers?** **NO** on the shipped population, by construction. New uniforms arrive; existing ones
do not move. **Needs Max?** **ONE UAT**, which is also D-2's re-run.

---

### B4 — The lighting engine, on the lab material · **L** · ONE UAT · ⭐ number-moving · ⭐ PARALLEL

**GATE** · Instrument C **deliberately NOT byte-identical**, with a committed delta table (lighting
changes pixels by design) · Instrument E paired shot **per object class**, on named bodies, ⭐ **taken
with `wd.labGasBodies` ON so the shots are of the material that will ship** — a lighting UAT taken on
`GAS_BODY` is a shot of code B7 deletes · Instrument D ≥120 frames, zero exceptions · ledger
P-01/P-02/P-03/S-01 re-ruled from `accepted-loss` to `carried` with evidence · **then Max's UAT.**

**Delivers in the world:** star colour, second-star diffuse in binaries, and moon-transit / planet shadows
working through the world-engine material — **for all object classes**, per Max's ruling #1: *"yes, the
lighting engine needs to work for all objects in game."*

**Scope — D-4, already measured; ⛔ do not rediscover it.** `docs/FEATURES/step6-parity-ledger.md`:
**P-01** star colour (accepted-loss; 341/341 swapped bodies, 632/632 swapped moons) · **P-02** second-star
diffuse (125 of 341, 64 binary systems) · **P-03** moon-transit + planet shadows = F52 (228 of 341 bodies
carrying 456 moons) · **S-01** the rolled-up accumulation. The lab material has one `uLightDir`, no
star-colour uniform and no shadow casters, while the game carries `lightDir2`, `starColor2`,
`shadowMoonCount`, `shadowPlanetCount`. Nine consumer classes: `src/objects/Planet.js`,
`src/objects/Moon.js`, `src/objects/AsteroidBelt.js`, `src/rendering/shaders/MaterialBodyShader.js`,
`src/rendering/objects/BodyRenderer.js`, `src/effects/WarpEffect.js`, `src/main.js`, `RingRenderer.js`,
`StarRenderer.js`. ⛔ *"The plan only said F52"* is not a reason to scope any of them out.

⭐⭐ **THE WORK LANDS IN THE LAB MATERIAL AND THE GAME'S PER-FRAME SEAM — NEVER IN THE LEGACY FRAGMENT
COPIES.** This is a correction to the earlier draft with a hard reason. `src/objects/Planet.js:380`
`const GAS_BODY = /* glsl */` is deleted **by name** at Step 12; `src/objects/Planet.js:571`
`const ROCKY_BODY = /* glsl */` and src/objects/Planet.js:955 `const EXOTIC_BODY = /* glsl */`
are bypassed for 846 of 852 planets once the flag flips. Authoring lighting in
src/objects/Planet.js:543 `  if (uTermStrength > 0.0) {` and its two copies at `:927` and `:1262` buys
work with a one-block shelf life, and makes B4's UAT a look at the material B7 replaces.

**F52 is a restoration, not a new feature** — the game has it, the lab renders one body and has no
shadow-caster path — so ruling #1 means new lab work **plus** a restoration, and the restoration is the
half with a measured population behind it (228 bodies / 456 moons).

**Closes by ID:** ledger **P-01, P-02, P-03, S-01** · spine-1 **F52** · spine-2 **QB-14**'s lighting half
· spine-3 **I-12** (which cannot run *anywhere* until F52 exists in the lab). Upstream of eight optical
couplings — **P5-G17, G21, G38, G40, G41, G42, G48, G49** — building those first means building them
against a single-white-light model this ruling replaces, then re-deriving all eight.

⛔ **QB-1 IS NOT HERE.** It is a `uTerm*` law; P-11 owns those uniforms; B3 writes them; and D-5 holds
Max's own 2026-08-14 deferral. Keeping it out is what makes B4 ∥ B3 true rather than merely asserted —
with QB-1 in B4, both blocks would target the same uniform family under opposite Instrument-C gates and
a wrong twilight band could not be attributed to either.

**Prereqs:** **none.** ⭐ **Genuinely parallel with B1, B2 and B3** — lighting lives in the shader, the
uniform factory and the per-frame seam; the packs live in `src/worldengine/drivers/`. With QB-1 moved
out, the uniform families are disjoint. **This is the largest parallelism win in the plan, and a false
constraint costs as much as a missed dependency.**

**Moves numbers?** **YES.** Own delta table. **Needs Max?** **ONE UAT** + **D-4** from the batch.

---

### B5 — The quality strand · **L–XL** · ⭐ TWO Max touches (the spike look, then the UAT)

**GATE** · an isolated `*-lab.html` spike per method **before** production
(`feedback_isolated-test-harnesses`) · ⭐ **the spike's pass criterion is Max's look, not an agent's** —
the deliverable is *"the cell-primitive family stops looking like cells"*, and
`one-pipeline-two-frontends-PLAN.md:865` forbids an agent from discharging it: *"No clause in this
section may be discharged by an agent's opinion that a complex render looks right."* The cited precedent
includes the look — QB-3's spike ran an 8-AC contract with an explicit **AC8 Max UAT** · then B3's wiring
gate for the held features (Instrument C byte-identical on the unswapped population) · the anim-rate fix
as a **separate increment** with a NOT-byte-identical gate and its own delta table · Instrument E paired
shots · **then Max's UAT.**

⭐ **B5 is budgeted at TWO touches, not one.** Pretending the spike gate is free is how a block that
re-authors four primitives arrives at a single end-of-block UAT with no attribution if the quad looks
wrong.

**Delivers in the world:** the cell-primitive family stops reading as cells; F8, F18 (and F4 if D-6 says
so) then wire without shipping an open complaint into the game; the shelved gas-atmosphere work ships;
the six exotic presets exist so the (d) queue can ever be scored.

**Five strands, one spike programme** — ⭐ ONE SHARED RESEARCH → ISOLATED-SPIKE, not five workstreams.

1. **The cell-primitive re-think** (QB-5, QB-9, QB-10, QB-11). ⚠ Three corrections that must survive into
   the spike's scope or it fixes the wrong things: **QB-5's mechanism diagnosis is wrong for the species
   Max named** — CH₄ (`uVolatileSpecies == 3`) is a sun-aligned periodic blade train at
   `height.glsl.js:3116-3131`, and the `voronoi3d` path at `:3137` serves H₂O / CO₂ / N₂ only, so scoping
   *"replace the cell system"* from his words fixes the wrong three species and leaves CH₄ untouched;
   **QB-11's guess is correct** (src/worldengine/shaders/height.glsl.js:2778 `void facetCombiner(` is
   voronoi3d, and the post-posterize spark is a second one), so "Theme A" is ~4 features, not 6;
   **QB-7 is not a cell problem at all** — `src/worldengine/shaders/height.glsl.js:2320`
   `void canyonCombiner(` is a great-circle plane cut, by construction a band wrapping the whole sphere,
   i.e. Max's *"one long trench"*. ⭐ **QB-11 is the cheapest first proof** of the pattern: 'Crystal
   (faceted)' is a live lab preset measuring .021 (`cards/PROFILES.md:41`), unlike QB-12's four which have
   no preset at all.
2. **The three held (a) features** — F8 lava, F18 sublimation, and F4 canyons if D-6 routes it here.
   ⭐ **WIRING F8 TODAY SHIPS FOUR KNOWN DEFECTS AT ONCE**, which is the clearest statement of why this
   block exists: (1) the Worley seam cracks Max rejected are still the mechanism
   (`planetShaders.glsl.js:977-983`); (2) ROOT 8 caps `lavaCoverage` at three values on 753 of 852
   planets; (3) `lavaActivity` is dead on all plain moons — B1's law plus B3's pack fix that one;
   (4) the rate half dies at the seam — strand 4.
3. **The gas-atmosphere strand (D-8)** — `world-engine-atmo-expression-2026-07-17`,
   `world-engine-atmo-deck-spiral-rhines-2026-07-19`, `world-engine-atmo-3b-storms-2026-07-14`. All three
   sit at status `verified` (built, not shipped, no UAT) with Max's complaints open in their contracts.
   They ship behind the spike, at B5's UAT, never standalone.
4. ⭐ **THE ANIM-RATE SEAM — in no other document, and three backlog entries meet on one line.**
   src/objects/Planet.js:2203 `export const GAME_ANIM_RATE = 1.0;` — whose own trailing comment reads *"the lab's _animRate GUI knob has no counterpart here"*
   against the lab's `_animRate`, applied to `uJetSpeed`, `uLightRate`, `uMagmaChurnSpeed` and
   `uLavaGlowRate`. `giantDeck.js:189` already emits `uJetSpeed` as `{ animRate: true }` **on a shipped
   pack**, so the game multiplies by 1.0 and jet drift does not slow on a large giant — which makes
   `planet-scale-normalization-2026-06-15/contract.json:41`'s own acceptance criterion **false in the
   game**. QB-2's AC4, QB-10's breathing rate and QB-13's storm drift all land here.
   `animationRateFactor` is already in the shared engine at `labCore.js:1177`, so the fix is one `ctx`
   field. ⛔ It moves a SHIPPED uniform and flips `tests/gas-body-lab-material.test.js:364`, so it is its
   own increment with its own delta table — the Step-2 precedent — not a ride-along.
5. **QB-12's six lab presets (D-10)** and **QB-6's pigment ruling (D-9)**. ⛔ QB-6's two problems do not
   merge: the pigment is taste, the coverage law is a separate unit, and the obvious fix is ruled against
   twice in source at `surfaceMaterial.js:125`. The four sub-gaps are already named at
   `docs/FEATURES/surface-variation-beyond-mvp.md:97-108`.

**Closes by ID:** QB-5, QB-6, QB-7 (if D-6 routes it here), QB-9, QB-10, QB-11, QB-12's presets, QB-13 ·
spine-1 F4, F8, F18, F26, F31a–f · ledger **R-05**.

**Prereqs:** **B1** (the tidal precedence for F8's moon half) and **B3** (the wiring route and the shared
modules). **Moves numbers?** The method half changes **pixels, not masters** — Instrument C stays
byte-identical on masters and the shader delta is the E shot; the anim-rate fix is separately
number-moving and separately gated. **Needs Max?** **D-3, D-5 (if lifted), D-6, D-8, D-9 and D-10 from
the batch, plus the spike look and the UAT.**

---

### B6 — Step 11, the standing "cheaper next time" fence · **M** · no UAT · ⭐ FULLY PARALLEL

**GATE** · `PLAN.md`'s own, verbatim: a deliberately-broken control fixture committed for **each**
registration, failing **by name** with the offending path in the message. *"A pass with no failing
control is worthless."*

one-pipeline-two-frontends-PLAN.md:470 `### Step 11 — The standing "cheaper next time" fence · **M** · deps: Steps 5, 9, 10`
— five registrations plus the Step-5 shrink-only ratchet as a sixth. **Its declared deps are Steps 5, 9
and 10; all three carry ship records, so it is executable today with zero unmet prerequisites, and it is
NOT on B7's dependency path.** ⭐ Say that explicitly so Max is not falsely constrained into ordering B6
against B7 in either direction. Registration 4 is the only one with a visual control, and that control is
the whole fence's: delete `giantDeck`'s entry and the same generated gas giant loses its bands.

**Moves numbers?** **NO.** **Needs Max?** **NO.**

---

### B7 — Step 12: delete the fallbacks, flip the flag · **S in code** · ⭐ THE ONLY PLAYER-FACING NODE

**GATE** · `one-pipeline-two-frontends-PLAN.md:488`'s, **as D-1 rules it**, plus B4 · grep-assert the
fallbacks are **gone, not commented out** · Instruments A and C green · two Instrument-E null sets at
Steps 6 and 10's seeds and stored poses, replayed **against recorded body NAMES, never indices** (Step 10
widened the walk's prefix and every index shifted) · ⭐ **full-frame identity tolerance = ZERO, with
`uGrainStrength === 0` asserted in the caption** (F-8); **any shot needing a nonzero tolerance is
inadmissible on its face** · admissible only with a same-session liveness pair.

**Delivers in the world:** ⭐ **everything above becomes visible to players.** Today **nothing** shipped in
Steps 1–10 reaches one. It moves 846 of 852 planets and 632 moons onto the lab shader
(`lab-procedural-0…199`).

**What MUST precede it**
1. **D-1** — whether the eight `blocking` rows gate the flip. **His call alone.**
2. **D-2** — whether *"Pass, with the note"* closes the Step-10 half, and its re-run at B3's UAT.
3. **The eight `blocking` rows themselves**, on D-1's recommended reading: **P-12, P-13** likely closed by
   **B0**'s re-measurement · **P-10, M-09** by **B2** · **P-05, P-11, P-14's crater half, R-07** by
   **B3** · with `noiseDetail` and `uDispDomainScale` split off as declared `accepted-loss` rows.
   ⚠ **B7's true size is not known until B0 item 7 runs.**
4. **B4, the lighting block.** Step 12 deletes the **only** implementation of P-01/P-02/P-03/S-01 — in
   exactly the area ruling #1 named. ⚠ **Stated honestly: this edge is ruling #1's, not the ledger's.**
   Those four rows are `accepted-loss`, which the ledger permits; the argument for the edge is that
   deleting the fallback converts a *declared, recoverable* loss into a *permanent* one, on the feature
   family Max ruled must work for all objects.
5. ⭐ **Not** the E-harness prerequisite — that caveat has expired (F-8).

**What need NOT precede it** — B1 · B5 · B6 · all of Tier 2 · the (b) and (c) queues · spines 2 and 3 ·
L1 WS3. ⭐ **The plan's current shape implies MVP-completeness gates the player-facing flip, and it does
not** — that implication is the main reason two UAT-passed swaps are still invisible.

**Moves numbers?** It moves **pixels** on 846 of 852 planets and 632 moons. Not a masters change.
**Needs Max?** **D-1 and D-2 from the batch.** No new UAT gate — the gate is B3's UAT plus those two
rulings. ⚠ Honest note: he will want to look after the flip whether or not the plan calls it a gate, and
§6.1 counts that look.

---

### B8 — The gated tail · **XL, genuinely open-ended**

⛔ **A HOLDING PEN WITH NAMED GATES, NOT A QUEUE.** Nothing starts until its gate clears, and most of
those gates are outside this plan. Presenting it as available work is `PLAN.md:56`'s failure mode —
*"the single easiest way to believe this project is 60% done when it is 7.5% done."*

**Tier 2** — F5 scarps (814 distinct / 16.7% zero, highest master in the set), F4 canyons (694/0.0%) if
D-6 does not route it to B5, F6 plateaus + tessera (680/0.0% and 346/59.9%), F38 airglow (525/41.7%),
F1 mountains (200→472 after B1). Gated on the `featureRelevant`/`rendersOn` migration → **D-7**, and ⛔ its
better-specified owner sits behind Max's own hold (`docs/NOW.md:1160`).
⛔ **Carry the counter-example, do not scope around it:** craters is the only family that has been through
the full shape (condition-derived predicate + driver pack + ledger row) and it ended as a moon-only feature
at 2 distinct values because of two downstream numeric floors. *Porting a family correctly* and *having it
render on a useful population* are different jobs.

**The (b) bakes** — F11 rivers, F12 deltas, F27 great-spot, F28 storm clusters, plus the four zero-filled
gas vertex attributes at `src/rendering/LabPlanetMaterial.js:37`
`export const LAB_ATTRIBUTES = ['aBand', 'aShear', 'aMush', 'aStorm'];`. Gated on the bake MOVE, which
**C25 already decided** → `src/rendering/bake/`, *"still its own step"*. ⛔ Do not re-ask.
⭐ **A second, independent reason F11 is game-dead:** `src/rendering/LabPlanetMaterial.js:110`
`export function ensureLabSamplers(uniforms, shaderSource) {` binds all six cube/2D samplers to 1×1 black
placeholder texels in the game, because the game never runs the lab's bake route. F11 dies by bake absence
independent of any driver wiring.
⭐ **One piece of good news the audit's reasoning missed:** `gProvince` is **not** sampler-dependent —
`initProvinces` computes it from procedural `noised()` calls seeded by `uMacroOffset`, so the whole
province-partition architecture works in the game today. `uProvinceCube` drives province COLOUR only,
correctly guarded. The partition-generator work is not blocked on a bake.

**The (c) world-gen four — and one of them is a B1-class fix that must be scheduled the same way.**
src/worldengine/base/labCore.js:674 `const volatileGate = smoothstep(0.05, 0.2, volatileFraction);             // D2 — bone-dry floor at 0.05`
gates F14 lakes, F11 rivers, F36 sunglint, and **14 of the 52 couplings** (G01, G02, G03, G10, G11, G12,
G13, G20, G25, G26, G32, G33, G34, G38). R-06 measured
src/worldengine/base/labCore.js:687 `const liquidStability = clamp01(retentionGate * volatileGate * tempWindow);`
clearing 0.01 on **0 of 6** ocean worlds because `volatileFraction` runs 0.0276–0.0579 against that floor.
⛔ **Its own step, its own delta table, a deliberately-NOT-byte-identity gate — the Step-2 precedent
exactly.** A physics-authoring call that moves numbers must never sit inside a wiring commit. ⭐ Max
already ruled R-06 gets wired — *"it's just a question of when"* — so this is ordering, never scope.
⭐ **F20-strand separates out of R-06 and is a pure port-drop win: 1 → 299 distinct on B1's erosion rename
alone. That half is in B3's tier 1b.**

**Spine 3 — 52 EDGES over 42 of spine 1's own nodes, not 52 new features** (the 104 endpoint slots map
onto 42 F-numbers; zero new). → **D-12.**

⛔ **CORRECTION TO THE EARLIER DRAFT, and it changes what "free" means here.** That draft argued spine 3
has *"zero game-side wiring cost… absorbed entirely by B7"* because every coupling is a line inside the lab
fragment shader. **The shader line is absorbed; the UNIFORM WRITE is not.** A coupling inherits the wiring
status of **both** endpoints, and the endpoints are uniforms. `mvp-spine-phase5-couplings.md:178` records
P5-G18's mechanism running off `uFrostLocked` / `uFrostLatitudeBias` / `uFrostCondensationT` /
`uFrostLapseRate` / `uPlanetTempEq`, and a grep for all five under `src/worldengine/drivers/` returns
**nothing** — consistent with the measured *"309 of 356 uniforms written by no `src/` pack for any body
class"*. Build G18+G19 as "the one free item", flip the flag, and the volatile-budget coupling evaluates on
five factory defaults — identical on all 1156 non-gas bodies and indistinguishable at UAT from not having
built it. ⭐ **So exactly ONE spine-3 item is genuinely free: `X`, the `ASSOCIATIONS.dependsOn`
re-derivation — zero dependencies, `verify-workstream --light`, the cheapest item in the entire spine.**
G18+G19 become one volatile-budget item gated on **a frost pack**, behind B3.

- ⛔ **RETIRE THE PHASE-5 WS NUMBERING AND ITS PER-WS GREENLIGHT MODEL.** Counted from
  `docs/FEATURES/planet-lod-phase5-integration-plan.md`: `:63` a `dev-collab-scope` pass per WS (6),
  `:83` WS4 sub-groups each its own design pass (7), `:216` *"Each WS build is Max-greenlit and Max-UAT'd
  separately"* (10), plus the I-lap, the Phase-7 review lap and the G17 ruling. **≥20 named decision
  stops.** Adopting its sequencing wholesale imports ~20 interruptions into a plan whose design constraint
  is zero. **Key everything to `P5-G01`…`P5-G52` and the 10 design problems, and issue ONE greenlight at
  the batch with each row's gate written into the row.** The WS numbers also collide with the in-tree
  world-engine WS4 (`tests/ws4-grain-*.test.js`).
- ⛔ **A blocker that EXPIRES — do not freeze it into the plan.** The *"G23 and G31 are structurally
  impossible"* note is a property of the **legacy** material only: `src/objects/Planet.js:955`
  `const EXOTIC_BODY = /* glsl */`` opens a chain of `else if (planetType == N)` branches, and the lab
  shader contains **zero** `planetType ==` branches. **B7 retires it.**
- ⭐ **The 17 needs-arch couplings collapse into 10 design problems, not 17** — cross-feature partition
  generator → 5 (G27, G28, G29, G30, G35); lava-as-fluid routing → 2; insolation/aspect → 2;
  weather×surface feedback → 2; router re-route → 1; then 5 standalone smalls.

**Two build blockers with no owner anywhere** — **QB-4** needs a lab render gate answering *"does F19 paint
anything, anywhere"* (it measures INERT .00006 on Mars where it IS declared, `cards/PROFILES.md:30`), and
**QB-8** needs a render gate that puts the sun in the mirror direction (`cards/PROFILES.md:32` says in its
own words the test geometry probably cannot show a glint). ⛔ **Neither may be scored through a renderer
measurement** — that produces a number entirely true and entirely misleading.
`one-pipeline-two-frontends-PLAN.md:556` risk 13 is exactly *"a never-rendered feature gets wired and
blamed on the wrong side."*

---

## 3. THE ORDERING CRITERION, NAMED

Max chose **differentiation**. The criterion is
`docs/FEATURES/r-rows-decision-packet-2026-08-20.md:598`'s, verbatim: *"what a player sees, per unit of
work, on the largest named population — and whether the change exceeds the renderer's own resolution."*

**Two modifiers, both established this run.**
1. ⭐ **A block that makes a uniform REACH THE GAME outranks a block that makes a lab law WIDER.** This is
   F-3's consequence, and it is what demotes B1 off the player path and promotes B2/B3 onto it. The earlier
   draft inverted it, by answering a game-side complaint with a lab-side measurement.
2. **A root that converts a master from DEAD (1 distinct) to LIVE outranks one that widens an already-live
   master** — a dead master is invisible on 100% of its population, a widened one is already contributing.
   This is why B1's law fixes still matter and still get a block, just not the first one.

⚠ **Two standing caveats on every distinct-count in this plan.** (1) Every figure here is CPU **law
output**, not pixels. src/worldengine/shaders/uniforms.js:32 `uLevels:     { value: 6.0 },` posterises
colour to six levels globally — a 0.1667 quantum that caps every COLOUR feature while leaving relief
untouched. Whether a distinct-count is *visible* is Max's eyes, and **QB-15 is exactly that question,
unmeasured until B0 item 12(b).** (2) **Every number carries its corpus.** Where two documents disagree —
1160 vs 1156 non-gas, 632 vs 654 plain moons, and the plan's "22 game-own parallel implementations" against
23 by R-marks and 18 by `[current]` — this plan names the instrument at the point of use and never mixes
denominators inside a section.

---

## 4. THE GRAPH, THE CRITICAL PATH, AND THE THREE SPINES

### 4.1 The graph

```
B0 ──┬──> B2 ──> B3 ──────────> B5             the wiring / quality spine
     │   (UAT)  (UAT)   (spike look + UAT)
     │            ^
     ├──> B1 ─────┘                            lab-side laws; feeds B3+B5, gates neither
     │
     ├──> B4 ─────────────────┐                lighting; parallel with everything
     │   (UAT)                │
     │                        v
     └──> (B0 remeasure + B2 + B3) ──> B7      ⭐ the PLAYER-FACING node (D-1, D-2)

B6 ────────────────────────────                fully parallel, deps all shipped, no UAT
B8 ────────────────────────────                gated tail; gates named per item
```

**Genuinely sequential**
- **B0 → everything.** It supplies the batch, the ledger re-measurement and the two shots.
- **B2 → B3.** They share `rockySurface.js` and `craterUniforms.js`; concurrent edits to a pack file make
  a byte-identity gate unattributable.
- **B1 + B3 → B5.** F8 needs the tidal precedence; all of B5 needs the route.
- **B0 + B2 + B3 + B4 → B7.** Six of the eight `blocking` rows close in B2 and B3, two more probably in B0,
  and B4 is ruling #1's edge (§2, B7, precondition 4).

**Genuinely parallel — ⭐ and a false constraint costs Max as much as a missed dependency**
- **B4 ∥ B1 ∥ B2 ∥ B3.** With QB-1 moved to B3, the uniform families are disjoint: B4 owns star colour, the
  second light and shadows; B3 owns `uTerm*`/`uLimb*`/crater/palette/aurora. **The biggest parallelism win
  in the plan.**
- **B1 ∥ B2 ∥ B3.** `deriveUniforms` is off the game's path, so B1 cannot move a pack input. ⛔ The B1 → B2
  edge asserted by the earlier draft is FALSE, and removing it lets the wiring spine start at B2 on day one.
- **B6 ∥ everything.** Step 11's deps are all shipped and it is not on B7's path.
- B7 does **not** depend on B1, B5, B6, B8, Tier 2, the bakes, world-gen, or either extra spine.

### 4.2 The critical paths

- ⭐ **To a player: B0 → B2 → B3 → B4 → B7. Five blocks.**
- **To MVP: B0 → B1 → B2 → B3 → B5 → B8, and B8 has no end date (§6.2).**

### 4.3 The three spines, reconciled

| | Spine | Where enumerated | Size | The overlap question, ANSWERED |
|---|---|---|---|---|
| **1** | F1–F53 (58 rows with F31's six sub-variants); 48 lab-only | `PLAN.md` §3 + `docs/FEATURES/lab-features-not-yet-wired-2026-08-20.md` | 48 partitioned: **(a) 21 · (b) 4 · (c) 4 · (p) 5 · (d) 8 · shipped/outside-frame 6**; 13 of the 21 (a) already emit ≥200 distinct masters over `lab-procedural-0…199` | — |
| **2** | The lab quality backlog | `docs/FEATURES/mvp-spine-lab-quality-backlog.md` | **QB-1…QB-14 + a QB-15 addendum.** 3 BUILT / 3 PARTIAL / 8 UNBUILT; **3 of 14 reach the game at all** | ⭐ **Eight F↔QB pairings already exist** in the 48-doc's own column (B0 item 6). Spine 2 is **not** 14 new items — it is 14 quality verdicts over spine-1 nodes, plus three with no F-number (QB-2 scale, QB-14 rings, QB-15 posterize) |
| **3** | The Phase-5 integration couplings | `docs/FEATURES/mvp-spine-phase5-couplings.md` | **69 items** — `P5-G01`…`P5-G52` + `I-1`…`I-15` + `X` + `WS4-7`. 0 BUILT / 13 PARTIAL / 56 UNBUILT / **69 game-ABSENT** | ⭐ **52 EDGES over 42 spine-1 NODES — zero new features.** A coupling is buildable only when BOTH its endpoint uniforms are written by a pack, which is why exactly **one** item (`X`) is free today, not four |

**⭐ THE HONEST TOTAL SIZE OF MVP under ruling #2.** Spine 1: 48 lab-only features, 21 wire-and-it-works, 13
with a hard prerequisite outside wiring, 8 with no driver law at all. Spine 2: 14 quality verdicts, 11 of
which the game cannot even exhibit yet. Spine 3: 69 items over 42 nodes, **none of which can be built before
their endpoints are packed.** ⛔ **MVP is not closable this quarter, and compressing that to look achievable
would be the dishonesty the brief warns against.** What IS closable soon is the thing Max has been waiting
for since 2026-08-06: **players seeing the world engine at all** — B0 → B2 → B3 → B4 → B7.

---

## 5. WHAT IS ALREADY SCHEDULED ELSEWHERE — the do-not-redo list

| Item | Owner document + line | Status |
|---|---|---|
| Orbital eccentricity (WS1 F2) | world-engine-production-L1-plan.md:90 `- **F2 · Compute orbital eccentricity** —` *"circularize() (PhysicsEngine.js:321) is dead; orbits are circular by…"* | ✅ **SHIPPED 2026-06-24** (`27a77f5`) |
| Real tidal heating (WS1 F1) | same document, `:85`–`:89` | ✅ **SHIPPED 2026-06-24** (`367f9fd`) |
| `featureRelevant` / `rendersOn` migration | `world-engine-production-L1-plan.md:181` (strategy + done-criterion at `:194`) vs `one-pipeline-two-frontends-PLAN.md:578` (fenced out) | ⛔ **TWO OWNERS, opposite dispositions.** WS3 F2 wins on done-criteria; it sits behind Max's own hold → **D-7** |
| The exotic "overlay/enable" carve-out | world-engine-production-L1-plan.md:205 `**Carve-out (R3):** some features (hexTess, shatter, overlays) are pure-enable lab knobs with **no driver class** —` | ✅ **ALREADY RULED** under a don't-ask heading. F44–F49 re-enumeration is not a new question |
| The bakers' location | `one-pipeline-two-frontends-CARRIED.md:39` row **C25** | ✅ **ANSWERED 2026-08-12** — `src/rendering/bake/`, still its own step |
| `uNoiseScale`'s km wavelength | ledger **P-10** evidence + `lab-features-not-yet-wired-2026-08-20.md:354` | ✅ **RULED**, expiry condition met at Step 10a → executes in **B2** |
| R-05 / R-06 / R-07 get wired | Max, 2026-08-20 — *"it's just a question of when"* | ✅ **SCOPE RULED.** Only R-05's and R-07's **scheduling** is open, and the ledger reserves both to him → **D-3** |
| The aurora law | ledger **P-05** — *"no ruling from Max is owed"* | ✅ **CLOSED as a law question**; it is a wiring row → **B3** |
| Step 11's fence | `one-pipeline-two-frontends-PLAN.md:470` | ⭕ **EXECUTABLE TODAY**, deps all shipped → **B6** |
| Step 12's deletion + flip | `one-pipeline-two-frontends-PLAN.md:488` | ⭕ **GATE READS SATISFIED and nobody has called it** → **D-1, D-2, B7** |
| The 52 couplings' WS sequencing | `planet-lod-phase5-integration-plan.md:63`, `:83`, `:216` | ⛔ **RETIRE the per-WS greenlight model** — ≥20 named decision stops (§2, B8) |
| Sol | `one-pipeline-two-frontends-PLAN.md` §7, Step 6d | ⛔ **STRUCTURALLY REFUSED.** Real NASA textures, a different renderer, no condition fields. Nothing in this plan was measured there |

---

## 6. HONESTY

### 6.1 ⭐ Where this plan stops — ⛔ STILL SEVEN after the 2026-08-20 rulings; the count did NOT drop

| # | Stop | Block | Kind | Avoidable? |
|---|---|---|---|---|
| 1 | ⛔ **The residual sitting** — 11 of 14 ruled 2026-08-20; **D-6, D-7, D-9 and D-14's retirement half remain** | after **B0** (ran 2026-08-20) | decisions | No — D-6 routes F4, and only Max closes any of the four |
| 2 | **B2's UAT** — the quad, after the frequency + palette calibration | **B2** | UAT | No |
| 3 | **B3's UAT** — ⭐ also D-2's Step-10 moon re-run, with `wd.labGasBodies` on | **B3** | UAT | No |
| 4 | **B4's UAT** — lighting, per object class, on the lab material | **B4** | UAT | No |
| 5 | **B5's spike look** — the re-authored primitives, before production | **B5** | look | ⛔ No, and treating it as free is a known failure |
| 6 | **B5's UAT** | **B5** | UAT | No |
| 7 | **The post-flip look** | **B7** | informal | Formally yes — the gate is #3 plus D-1/D-2. He will look anyway |

⭐ **STILL SEVEN STOPS for B0 through B7 — the number did NOT drop.** Eleven rulings landed 2026-08-20 and
stop #1 shrank from fourteen questions to four, but a shrunken stop is still a stop, and D-6 still routes F4.
**FIVE are on the path to a player** (1, 2, 3, 4, 7); B5's two are off it. B0, B1 and B6 have none. ⛔ Booking
the ruling batch as a drop in the stop count would be exactly the false progress this section exists against.

⛔ **It cannot go lower, and the reason is structural rather than a planning failure.** UAT is Max's gate
alone and no agent closes it. Each of B2, B3, B4 and B5 changes what a player would see in a way he has not
seen. Merging any two of those UATs means shipping one change unseen on top of another and losing
attribution when the quad looks wrong — the exact failure this whole ordering exists to prevent.

**Where the reduction comes from, and it is three moves and nothing else:**
1. **Batching every ruling into §1** — a stepwise walk through the same work produces ~19 stops.
2. **Refusing to schedule work that already has a ruling** — §1.3 removes eleven, §1.2 pre-decides thirteen.
3. **Merging D-2's moon re-UAT into B3's existing gate** rather than an eighth stop, and **running B0 first**.

⭐ **What the rulings DID buy, and it is NOT a smaller stop count:** stop #1 is now two one-line looks (D-6,
D-9), ten one-line retirements (D-14's carried rows, each parked with its evidence) and one hold-conflict (D-7);
B2–B7 need no further question. ⛔ **Counter-move unchanged: the Phase-5 execution model for B8 adds ≥20 more stops** (§2, B8) — retiring it is still worth more than any other single ordering decision in this document.

### 6.2 The honest size

- **B0:** S–M. Doc repair, one ledger re-measurement, two renders. Days.
- **B1:** M. Four seam fixes, one delta table, 36 test files in the blast radius.
- **B2 + B3:** M–L + L. The calibration against real bodies, ~18 route-(iii) extractions across three tiers,
  and four `blocking`-row closures.
- **B4:** L. Nine consumer classes and a shadow-caster path the lab has never had.
- **B5:** L–XL. Four method re-thinks, three shelved increments, six presets, one anim-rate increment.
- **B6 + B7:** M + S.
- **B8:** **XL, and genuinely open-ended.** Tier 2 is behind a hold Max set. The bakes are behind a 108 KB
  move. The (c) queue is world-generation. Spine 3 is 52 edges of which **one** is startable.
  ⛔ **This is where the multi-month tail lives.**

### 6.3 ⭐ WHAT IS UNKNOWN OR UNMEASURED — named, never guessed

1. ⭐⭐ **QB-15, the posterize ceiling — the one item that could invalidate this plan's own priority order.**
   uniforms.js:32 `uLevels` is a global constant, identical on both sides, written by no pack. Several of
   B2's and B3's picks are colour/emissive-only. If QB-15 is real they wire cleanly, pass every algebraic
   gate and buy nothing — *"these are all identical"* one layer down. **B0 item 12(b) takes the measurement
   before the order is frozen. If it comes back real, B2's palette leg and B3's colour features drop below
   the relief ones and §3's ranking is re-run.** Max parked QB-15 in 2026-06-16 pending rivers; rivers
   shipped 2026-06-19.
2. **Whether P-12, P-13 and P-14 are already closed.** F-5 says the pack writes every name in two of them and
   four of five in the third; whether it *agrees* with the game's derivation is unmeasured, and P-11's
   `uLimbColor` is the standing counter-example. → B0 item 7. **B7's size is unknown until this runs.**
3. **What B1's tidal law actually recovers on the moon population once it reaches a pack.** The 48-doc says
   the same in its own words: *"What I did not measure is how much of the Tier-1 moon deadness WS1 F1+F2
   actually recovers; that needs the fix in hand."*
4. **Whether `mountainAmp`'s pile-up at its 0.6 cap is fully explained by the erosion drop.** The
   counterfactual moves it 200 → 472 distinct but the zero share does not move, so `rockyCrust` is doing
   something nobody has decomposed.
5. **Tier 2's cost.** Whether a condition-derived predicate per family preserves 200–814 distinct values or
   reproduces craters' two-value outcome cannot be known until a predicate exists.
6. **QB-4 and QB-8 cannot be scored at all today** — F19 measures INERT where it IS declared, and PROFILES
   says the glint test geometry probably cannot show a glint. Both need a render gate that no document
   schedules. ⛔ Neither may be scored through a renderer measurement.
7. **P5-G27, WS4-7 and part of P5-G14 stay UNKNOWN** until B0 item 12(a)'s shot, by their own document's
   statement.
8. **Whether the QB-1 belt is even reachable in the population that exhibits it.** The spine-2 doc records
   that `wd-45/0` was the one airless planet in 6279 and that since break-B7's fix no planet is airless, so
   the band's atmosphere gate never fails — the population is now effectively 100% and nobody has re-looked.
9. **How much of the WS4-1 design pass P5-G12's carve-epoch work retires** — settled by reading the T12b
   deferral, which nobody has.
10. **`condition.density` is measured wrong by >1.5× on 43% of generated giants** (worst: bulk 0.37 g/cc
    reported as 4.39). `PLAN.md` §7 fences it; it will bite whatever reads it next.
11. **Nothing in this plan was measured on Sol**, and nothing in it can be.

### 6.4 Two things that will bite whoever executes this

1. **The moon population is live under an open formation window.** 32 tests are RED BY DESIGN at HEAD
   (moon-formation window, `34b502d`, owned by lane B7; md5 `2be0e6a9de7be79b5d8c23e0958d2b1c`, 32 lines).
   Every moon figure in this plan is window-dependent and must be labelled so; B1 will itself move the moon
   record. ⚠ **Coordinate with lane B7 before scheduling anything that touches `MoonGenerator`.**
2. **`world-engine-production-L1-plan.md` is dangerously stale as a scheduling source**, and four documents
   cite it as the owner of live work. Its header still reads *"Status: PLANNING… not built"* while WS1
   SHIPPED, WS2 SHIPPED (Max UAT, `4b358dc`), WS4 BUILT-AND-FAILED-UAT under a standing hold, and its
   successor increment `world-engine-baked-relief-render-2026-06-25` has sat at `status: building` for ~8
   weeks. → **B0 item 8.**

### 6.5 What this plan does NOT do

- It does not re-enumerate spines 2 or 3 (F-1), or re-derive the 48-row partition, the tier ordering, the
  ten roots, or the eight F↔QB pairings already written.
- It does not decide D-1 or D-2, and it did not touch `LAB_GAS_BODIES_DEFAULT`.
- It does not re-scope R-05/R-06/R-07, re-open the aurora law, re-ask the bakers' location, or invent a
  fourth ledger ruling.
- It does not measure a single pixel. **Every distinct-count here is CPU law output** (§3), and whether the
  differentiation actually differentiates is Max's eyes on the quad.
- ⛔ **It closes no UAT.** No agent ever does.

---

## 7. DOC DEFECTS FOUND — sized, not fixed

### 7.1 In the plan of record and the charter

| # | Defect | Size | Where it lands |
|---|---|---|---|
| 1 | ⭐⭐ **`PLAN.md` §7:584 contradicts ruling #2 sixteen lines below it, in the same file.** The §7 bullet excludes the 14 backlog entries and the 52 couplings and ends *"Max should say so now"* — and ruling #2 IS Max saying so. `PLAN.md:637` already tabulates the change. **A fresh session sizing MVP from §7 gets the wrong answer.** | XS — one annotation | **B0** item 4. ⛔ Annotate, never repeal |
| 2 | ⭐⭐ **`PLAN.md:602-605` still says spines 2 and 3 need enumerating**, and nothing in the plan of record cites either file. This is why a fresh brief concluded they did not exist and commissioned a run to build what was already on disk. | XS — two citations | **B0** item 3 |
| 3 | ⭐⭐ **`planet-lod-CHARTER.md:115` and `:120` still name the superseded `lab-pipeline-into-game-PLAN.md`**, in the file `CLAUDE.md` routes every planet-LOD session to FIRST. The 2026-08-19 fix repaired only the callout box at `:59`, whose own text records what the error cost. **Still armed, twice.** | XS | **B0** item 2 |
| 4 | **`PLAN.md:575` poses the bakers' location as an open decision.** Answered by CARRIED **C25** on 2026-08-12, where Max declined the question as posed. | XS | **B0** item 5 ⚠ **The ref is one line high — `:575` is the storm slice; the bakers are `:576`.** Corrected and annotated 2026-08-20. |
| 5 | **`world-engine-production-L1-plan.md`'s header reads "PLANNING… not built"** while WS1 and WS2 shipped and WS4 failed UAT. Four documents route work to it. | S | **B0** item 8 |
| 6 | **`lab-features-not-yet-wired-2026-08-20.md` open item 3 recommends WS1 F2 → WS1 F1 first.** Both shipped 2026-06-24 (F-2); `docs/NOW.md:1172` already carries the correction. | XS | **B0**, one annotation |
| 7 | **`planet-scale-normalization-2026-06-15/contract.json` reads `"status":"building"`** for work that shipped and passed UAT 2026-06-17. | XS | **B0** item 9 |
| 8 | ⛔ **THE "124 STALE `planet-lod-uniforms.js` REFS ACROSS 56 FILES" DEFECT DOES NOT EXIST.** The fence exits 0 with 531 CHECKED; `tools/port-uniform-delta.mjs:972` is a deliberate alias, one of five, under a comment reading *"⛔ Do not 'tidy' these keys."* Rewriting them converts every pre-move ref into an UNRESOLVED, which the mode exits 2 on. **Three separate lenses have now proposed this repair.** | **STRIKE — 0** | **B0** item 10: record WHY, so a fourth session does not re-discover it · ⭐⭐ **EXECUTED 2026-08-20. THE ITEM IS STRUCK AND THIS ROW IS THE RECORD.** Re-measured this run, not quoted: `npm run --silent port-uniform-delta:citations` exits **0** at **542 CHECKED** (`inputs 80196f286708`), up from the 531 this document was written against, which is the only evidence that separates *"every ref resolves"* from *"no ref was read"* — the distinction `tools/port-uniform-delta.mjs:1093` states in its own words. The aliases are deliberate and the repair is prohibited in source; rewriting them converts every pre-move ref into an UNRESOLVED and the mode exits 2. **Four lenses have now proposed this repair. A fifth should stop at this row.** |
| 9 | The real residue is unrelated and smaller: refs written **without** a backticked symbol sit in the UNCHECKED bucket by §10's own rule — a citation-FORM issue, not a broken path. ⛔ **Do not bulk-rewrite line numbers blind; a ref repaired to a SECOND wrong line is worse than a stale one.** | S, opportunistic | not scheduled; convert on touch |

### 7.2 In the parity ledger

- **P-10 and P-14 carry residues that cannot legally become `carried`** — `noiseDetail` has *"no lab
  counterpart at all"* and `uDispDomainScale` has no producer. Both fail §2's `blocking` test and belong with
  P-06/P-08/P-09. **Split them; the P-08 precedent makes it an agent correction.** ⛔ Do not invent a fourth
  verdict: the last session that tried reddened `tests/material-parity-list.test.js:772` inside one run.
- **P-12, P-13 and P-14's evidence carries a pre-Step-10a denominator** (*"103/103"*) against a subject set the
  fourth pack widened past 163. → B0 item 7.
- **P-13's mechanism claim is stale** — `db1cf51` forwarded all three offsets and `ROCKY_SURFACE_UNIFORMS`
  carries them, while the row still reads *"name-carried and value-defaulted on 103/103."*
- ⚠ **R-05 and R-07 both carry an explicit Max reservation** (*"Scheduling reserved to Max"*) that no plan has
  ever surfaced to him. → **D-3.**

### 7.3 In the spine documents

- **`mvp-spine-phase5-couplings.md` contains zero `QB-` strings** and `mvp-spine-lab-quality-backlog.md`
  predates the R1–R10 partition. Neither can be cross-read against spine 1 without the index B0 item 6 builds.
  This is the layer ruling #2 actually needs, and it is ~80% pre-computed.
- **`planet-lod-phase5-integration-plan.md`'s WS numbering collides with the in-tree world-engine WS4**
  (`tests/ws4-grain-*.test.js`). Two different WS4s.

### 7.4 ⭐ In `wiring-execution-plan-2026-08-20.md` — the eleven this run verified and corrected

Recorded so nobody rebuilds that shape. Each was checked in source this run. ⭐⭐ **B0 ITEM 1 EXECUTED 2026-08-20 AS A RECORD RATHER THAN AN ANNOTATION, BECAUSE THERE IS NO LONGER A FILE TO ANNOTATE.** `docs/FEATURES/wiring-execution-plan-2026-08-20.md` is absent from the working tree and `git log --all` on that path returns **nothing** — it was drafted, its eleven claims were verified against source (this table), and it was deleted before B0 ran, never having been committed. So item 1's *"⛔ Annotate; do not delete"* cannot be obeyed as written, and obeying its INTENT means putting the evidence where it survives: **this table is now the only record of that draft, and it is the annotation.** ⛔ **Do not recreate the file** — recreating it re-arms eleven verified-wrong claims, four of which stall execution. ⚠ Note what this costs: the draft's own supporting evidence is gone with it, so anything here that reads as a bare assertion cannot be traced back to it and must be re-derived from source instead.

| # | The claim | What is true | What it would have cost |
|---|---|---|---|
| 1 | B1 makes moons look different, so D-1 can re-UAT after B1 + B4 | `deriveUniforms` has **zero `src/` call sites**, and `uLavaActivity`/`uCryoActivity` are written by no pack (F-3, F-4) | The re-UAT returns the same *"all identical"*, D-1 stays open, and B7 — *"the only player-facing node"* — never fires |
| 2 | The 8 `blocking` rows are *"declared, so this half reads satisfiable"* | `blocking` is defined as *"must close before anyone is shown a parity claim"*; `accepted-loss` is the declared category | The flip ships with 632 moons pinned at `uNoiseScale` 4.0, 130 Venus bodies' banding deleted permanently, 20 auroras dark, 59 of 163 solid bodies without a limb exponent |
| 3 | R-07 *"is in the blocks"* | It appeared in an exclusion table and a gate list. **No block owned it** | B7 stalls with nothing queued, or ships and makes Venus banding unrecoverable on 130 bodies |
| 4 | B1 → B2 is a dependency (crater floors need a corrected gravity read) | `craterUniforms.js:157` reads `condition.surfaceGravity` directly; B1's fix is inside `deriveUniforms` | The block that answers Max's note is queued behind an M-sized, zero-player-visible block for no reason |
| 5 | B4 ∥ B3, with B4 owning QB-1 | Both target the `uTerm*` family, under **opposite** Instrument-C gates | The C delta contains both changes with no way to attribute a wrong twilight band to either |
| 6 | B4's QB-1 fix lands in `Planet.js:543` / `:927` / `:1262` | Copy #1 is inside `GAS_BODY`, which Step 12 deletes by name; B4's UAT would run at `LAB_GAS_BODIES_DEFAULT = false`, i.e. on the legacy material | Max UAT-passes lighting on shaders the next block deletes, and the first look at the shipped lighting happens after the escape hatch is gone |
| 7 | B1 *"unblocks F1, F3, F4, F5, F6, F8, F9, F10, F12, F13, F16, F20-strand, F21"* | F3, F13, F16 and F21 appeared on that line **and nowhere else in the 857 lines** | The (p) queue's best buy — F13, *"the cheapest unblock in the set"* — ends with no work item and no queue position |
| 8 | Spine 3 has *"zero game-side wiring cost, absorbed entirely by B7"* | The shader line is absorbed; the **uniform write** is not. G18's five frost uniforms are written by no pack | The one "free" item evaluates on five factory defaults, identical on 1156 bodies, indistinguishable at UAT from not building it |
| 9 | B1's seam fix #5: *"Fix pack-side… route the existing seed"* | The gate is pack byte-identity; `macroSeed` occurs zero times in `rockySurface.js`; the pack's source refuses to synthesise a third seed→vec3 law and its test asserts seed-INDEPENDENCE | Three moves, none of them ruled: author a refused law, redden a gate the block forbids loosening, or drop a fix D-3 said must happen regardless |
| 10 | Three citations wrong, two under load — `labCore.js:624` (the symbol is at `:620`), `PlanetMoonBody.js:33` *"reads the same flag"* (it is prose; the real route is `Moon.js:58` → `Planet.js:2019`), and *"`deriveUniforms` is called from two test files"* (36) | Verified | B0's own citation gate would have reddened on the first block, on the citation carrying the plan's central mechanism |
| 11 | D-12 asked Max to confirm the `uNoiseScale` ruling; open item 2 asked him to authorise two read-only measurements | Both are derivable or technical. The expiry condition is recorded twice; taking a render is read-only and touches no shipped code | Two of the sitting's slots spent on choice-theatre, in the document arguing against it |

---

## 8. OPEN ITEMS FOR MAX

1. ⛔⛔ **FOUR THINGS ARE OPEN AND ONLY YOU CLOSE THEM — the other eleven were ruled 2026-08-20**, delegated
   by you to the plan's own recommendations. **(a) D-6, the canyon look** — B0 took the shot; it is waiting on
   your eyes, not on more work (§1.1's D-6 row has the two frames and the full path). **(b) D-9**, darker or
   greener, taste, never UAT'd anywhere. **(c) D-14's RETIREMENT half** — `PLAN.md:715` reserves retiring a
   carried row to you by name; all ten are parked with their evidence, one line each. **(d) D-7, below.**
2. ⚠⚠ **D-7 is a CONFLICT WITH YOUR OWN HOLD, not a recommendation waiting for a yes.** The plan recommends
   pulling `featureRelevant` out of L1 WS3; `docs/NOW.md:1160` is your standing *"do NOT ship WS4; do NOT start
   WS3."* ⛔ No agent adopted it and **WS3 was NOT started.** It moves only if you lift the hold yourself.
3. ⭐ **RULED, and here is what the biggest one now means.** **D-1: the eight `blocking` rows MUST CLOSE before
   the flag flips** — that is now B7's gate, not a proposal. The flag itself is untouched:
   src/objects/Planet.js:2153 `export const LAB_GAS_BODIES_DEFAULT = false;` — and **it is ONE flag exposing
   BOTH swaps**; `labPipelineAdmits` has exactly one call site, reached for moons through
   `src/objects/Moon.js:58`. There is no separate moon flag. **D-3's R-07 is now a named B3 work item.**
4. ⛔ **The honest headline did NOT improve: still seven stops for B0–B7, five on the path to a player.**
   Eleven rulings shrank stop #1 from fourteen questions to four; a shrunken stop is still a stop. §6.1 names each.
5. ⭐ **D-5 held your deferral** — the belt is forwarded verbatim, P-11 closes on parity, nobody re-authors
   twilight. **MVP under ruling #2 is not closable this quarter** (§4.3); the player path is B0→B2→B3→B4→B7.

---

*Written 2026-08-20 against `feature/world-engine-production-L1` @ `1777781`. Read-only: `src/` and `tests/`
show zero changes, no commit, no server, no baseline re-record. Citation fence exit 0 / 531 CHECKED at HEAD.
⛔ No UAT was closed by this document; no agent ever closes one.*

---

## 9. ⭐ B2P — THE POSTERIZE CEILING, MADE RAISABLE · **S** · no UAT · ⭐ APPENDED 2026-08-20, AFTER THE PLAN WAS WRITTEN

⛔ **APPENDED, NOT INSERTED, AND THAT IS LOAD-BEARING.** Six line-anchored refs point INTO this file
from `docs/FEATURES/lab-features-not-yet-wired-2026-08-20.md` — `:302`, `:453`, `:586`, `:591`,
`:601-607`, `:914` — so a block written into §2 where it belongs topically would silently move every one
of them. §10's rule for `PLAN.md` applies to this file now that B0 item 11 put it in `CITE_SOURCES`:
**expand a line, never insert one.** All six were re-resolved by hand before this section was written.

> ⭐⭐ **WHAT MAX ASKED FOR, VERBATIM, 2026-08-20:** *"as we add detail to the game we'll want to be able
> to add additional levels/make this less posterized. Can we work that in?"*

**This is not a re-scope and not a re-rank. It is §6.3 item 1 coming back REAL, and being answered by
lifting the ceiling instead of re-ordering the blocks under it.** That item named QB-15 *"the one item
that could invalidate this plan's own priority order"* and made B0 item 12(b) take the measurement
before the order was frozen. It came back real: on one identical 361×361 box, `uLevels` **6 → 34
distinct colours** and `uLevels` **64 → 804** (23.6×), while removing the retro pixel grid instead moves
34 → 50 (1.5×). ⭐ **The quantum, not the pixelation, is what compresses colour** — and relief is not
capped the same way, which is why §3's ranking favours relief over colour. **B2P is what makes that
ranking stop being forced**, so it runs before B2's UAT rather than after it.

**GATE** · ⭐ **BYTE-IDENTICAL AT THE DEFAULT, and this is the whole gate:** the setting ships at **6.0**,
so every instrument must read exactly as it does at HEAD — Instrument A's 32 red-by-design set unchanged
(md5 `2be0e6a9de7be79b5d8c23e0958d2b1c`), Instrument C's per-uniform table unmoved on the matched
population, citations exit 0 · a shader-compile check on **all four** call sites, because a uniform that
is declared in one program and spent in another fails at link time and not at test time · Instrument E
**paired shot at 6 against a raised value on the same body and the same pose**, which is the only
evidence that the uniform is actually reaching the fragment rather than being written into a program
that ignores it. ⛔ **A green test suite proves nothing here** — the default path is unchanged by
construction, so the suite is green whether or not the uniform is wired at all. The paired shot is the
gate; the suite is the negative control.

**Delivers in the world:** the colour quantum stops being a constant nobody can move. ⛔ **It does NOT
make anything look different by itself** — the default does not change, and changing it is Max's taste
call, not an agent's.

**Contents — four literals, and the fourth is not what the handoff said it was.**
1. src/objects/Planet.js:560 `  finalColor = posterize(finalColor, uPosterizeLevels, gl_FragCoord.xy, 0.4);` ·
   src/objects/Planet.js:944 `  finalColor = posterize(finalColor, uPosterizeLevels, gl_FragCoord.xy, 0.4);` ·
   src/objects/Planet.js:1279 `  finalColor = posterize(finalColor, uPosterizeLevels, gl_FragCoord.xy, 0.4);` — the
   three body programs (`GAS_BODY`, `ROCKY_BODY`, `EXOTIC_BODY`), each a separate fragment shader.
2. ⚠ **REF CORRECTED HERE: the fourth site is the RING material, and it is a different quantity.**
   src/objects/Planet.js:1881 `          color = posterize(color, uPosterizeLevels, gl_FragCoord.xy, 0.4);` spends
   `color`, not `finalColor`, inside a material built by its own factory — and it carries its own second
   copy of the function at src/objects/Planet.js:1837 `        vec3 posterize(vec3 color, vec2 levels, vec2 fragCoord, float edgeWidth) {`,
   distinct from the body copy at src/objects/Planet.js:208 `vec3 posterize(vec3 color, vec2 levels, vec2 fragCoord, float edgeWidth) {`.
   **So this is two shader programs and two function copies, not one program with four call sites**, and
   a single uniform added to one material object reaches neither the other three programs nor the ring.
   ⭐ Whether rings follow the planet quantum or keep their own is a LOOK question; the conservative
   branch is to wire the ring to the same setting so the disc and its ring never quantise differently,
   and to say so rather than discover it in a screenshot.
3. **The lab needs nothing.** It is already a uniform — src/worldengine/shaders/uniforms.js:32 `      uLevels:     { value: 6.0 },`
   — spent through a posterize that already takes a mode argument,
   src/worldengine/shaders/height.glsl.js:681 `      vec3 posterize(vec3 color, float levels, vec2 fragCoord, float edgeWidth, int mode){`.
   ⛔ Do not touch the lab side. ⭐ **And note what this means for B7:** once the flag flips, 846 planets
   and 632 moons render through the LAB program, whose `uLevels` is written by **no pack** — so B2P's
   setting must reach the lab material's `uLevels` too, or the feature evaporates at the exact moment
   the world engine becomes visible. That is one line in the per-frame seam, and leaving it out is how
   a shipped feature becomes a shipped no-op.
4. **The setting.** `src/ui/Settings.js`'s `DEFAULTS` block is the surface, beside `pixelScale` under
   `// Visual`. Default **6**, which is the shipped value, so an absent key falls back through the
   DEFAULTS merge to today's behaviour with no migration — the `flightControlType` precedent in that
   same file, stated in its own words.

**⛔ NON-GOALS, recorded so they are not quietly widened.**
- **The default does not move.** 6.0 ships. What "less posterized" should look like is Max's eyes.
- **The retro pixel grid is not touched.** Measured 1.5× against the quantum's 23.6× — it is a different
  lever with a different look, and bundling them would make a wrong result unattributable.
- **No pack writes `uLevels`.** It stays a global display setting, not a per-body derived quantity;
  making it condition-derived is a different feature and would need a law nobody has authored.

**Closes by ID:** spine-2 **QB-15**'s mechanism half — ⛔ **not its look half**, which is D-9-shaped and
stays Max's. Spine-1 **F50**'s carrier.

**Prereqs:** none. ⭐ **Runs before B2's UAT**, so that the quad Max looks at can be re-looked-at with the
ceiling raised — which is the difference between B2's palette leg being visible work and being work that
passes every algebraic gate and buys nothing (§6.3 item 1's own words). **Moves numbers?** **NO** at the
default. **Needs Max?** **NO to build.** He raises it himself at B2's UAT and tells us where it should sit. ⭐ **BUILT 2026-08-20 — and the contents list above was INCOMPLETE, twice over.** (1) **SIX live call sites across SIX programs, not four sites.** ⚠ **FOUR was wrong in this headline and the paragraph below it says why two sentences later** — four is the DECLARATION count, and separately the posterize() SOURCE-COPY count; the programs are six (gas, rocky, exotic, ring, moon, belt) and the files are three (Planet.js, Moon.js, AsteroidBelt.js). Corrected 2026-08-20. The two this section missed are the two that carry the population: `src/objects/Moon.js:592` — the LEGACY plain-moon program, its own posterize copy, and ⚠ **edgeWidth 0.6, not 0.4**, which 632 moons render through until the lab flag flips — and `src/objects/AsteroidBelt.js:153`, its own program and its own copy again. (2) **⭐ ONE declaration in `FRAG_HEADER` reaches all three body programs, not three declarations.** `GAS_BODY`/`ROCKY_BODY`/`EXOTIC_BODY` are BODIES spliced onto that shared header by `PLANET_SHADER_VARIANTS`, so the "each a separate fragment shader" line above is true about the PROGRAMS and false about the DECLARATION. Four declarations were needed, not six: the shared header, the ring, the moon, the belt. **What shipped:** ⛔ **RE-STATED 2026-08-20 AFTER THE ROUND-3 ARITHMETIC FIX — it is TWO objects, not one, and this sentence described the pre-round-3 shape.** `src/rendering/posterizeLevels.js` holds `POSTERIZE_QUANTUM` = `{ value: new THREE.Vector2(6.0, Math.fround(1 / 6)) }`, handed to all six game programs under `uPosterizeLevels`, and `POSTERIZE_LEVELS` = `{ value: 6.0 }`, the SCALAR the lab program takes under `uniform float uLevels` — a float slot that cannot hold a vec2, which is the whole reason there are two. `setPosterizeLevels` is the single writer of both and sets them together, so they cannot drift. Materials here are built once and mutated, so a build-time-only read would have stranded every mounted body and shipped a no-op; three reads `.value` per draw, so one assignment moves every live material with no registry. The lab path is wired too (`buildLabPlanetMaterial` substitutes the OTHER object, `POSTERIZE_LEVELS`, for `uLevels` — NOT the same object the game material holds), without touching the lab shader or the `uniforms.js` default, so B7 does not evaporate the feature. `posterizeLevels: 6` joined `DEFAULTS`, read on boot and subscribed for change. `src/rendering/objects/RingRenderer.js:269` was left alone: it has ZERO importers in `src/`, and the `MaterialBodyShader`/`TexturedBodyShader` pair already take a `posterizeLevels` uniform and are Sol's path, which is out of scope. **Not built:** no settings-menu control — the value moves through `settings.set('posterizeLevels', n)` today, and where the slider sits is a look question.
