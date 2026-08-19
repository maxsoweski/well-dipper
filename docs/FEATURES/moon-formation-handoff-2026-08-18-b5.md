# Handoff — the moon-formation lane. ▶ NEXT = **§10's queue, in order, via workflows.**

⛔ B5.0 shipped and **FAILED UAT** (§9). This is the lane's single live handoff — there is no
companion doc. Read §10 first for the order and the workflow playbook, then §2, §3 and §9.

**Date:** 2026-08-18 · **Repo:** `~/projects/well-dipper`, branch `feature/world-engine-production-L1`
**HEAD:** `34b502d` · tracked tree **CLEAN**
Supersedes [`moon-formation-handoff-2026-08-18.md`](moon-formation-handoff-2026-08-18.md), whose §1
next-action is done. **Its §2 doc map, §5 techniques and §6 state are still current — read them.**

> ⭐ **~700 untracked PNGs and `scratchpad/` are normal. ⛔ NEVER `git add -A`.**

## ⛔ INSTRUMENTS ARE RED BY DESIGN. The window is open.

| instrument | reading at `34b502d` | why |
|---|---|---|
| A per-test-ID | not re-recorded | ⚠ do not re-record mid-window |
| B — DRAW STREAM | ✗ **28 seeds, every one `+2`** | two grandfathered sub-rngs fire per companion |
| B — BODY IDENTITY | ✗ | the population moved |
| B — RECORD SHAPE | ✗ `planetClass.records 24 → 51` only | shapes `1`, keyCounts `[20]` **unmoved** |
| B — NEGATIVE CONTROL | ✓ **green** | scoped to `wd-0` (`:824`), which has no companion |
| C — shipped-uniform | ✗ exit 2, `bodies in capture : 526 now: 633` | POPULATION MISMATCH, the trigger §3c named |
| C — citation fence | ✓ **423 CHECKED / 0 BROKEN** | three refs repaired by symbol this session |

**B7 closes the window and re-blesses. Nothing before it should.**

---

## 1. WHAT LANDED, IN ORDER

| commit | what |
|---|---|
| `1ed1176` | **B4 §8** — the binary line item: selector, `p`, per-corpus yield, the 27-row coordinate list, the revised partition, Instrument C's 526→633, three traps. Plus `tools/binary-yield-probe.mjs`. |
| `5ddebe0` | handoff update; two of the old §3's numbers came from the concave approximation |
| `c52d397` | **B4 §8.10** — the verification pass: what §8 missed (four files, one wrong assertion, and an unreachable `q`) |
| `34b502d` | **B5.0** — the binary companion channel, plus the two required fixes |

⭐ **B5.0 landed ALONE, before steps 1–9, deliberately.** §8.5's Route-M-alone partition is this
window's only exact separable prediction and step 2 saturates the arms. It was checked and it held:
population `{961, 821, 770, 51}` identical, **51/51 coordinates in byte-identical order**, shape held
at 20 keys, Instrument C at exactly the predicted 633.

---

## 2. ⭐ THE THREE THINGS B5 STEPS 1–9 MUST NOT UNLEARN

1. **The companion is built from `hashRng`, never the generation stream** (`MoonGenerator.js`, end of
   file). Not tidiness: a stream-built companion is a function of the moon loop's draw *position*, so
   steps 2, 3 and 6 would move every companion and §8.4 — the window's only exact prediction — would
   stop being checkable after the second sub-step. **Hash-built, the pair survives the whole window
   unmoved.** ⛔ Step 4 merges `_generatePlanetMoon` into the shared tail; the merge must carry the
   `hashRng` companion path and the `targetQ` parameter with it.
2. **DRAW STREAM's red set is companions *built*; §8.4's list is companions *shipped*.** 28 vs 27.
   The extra is `wd-170`, whose ordinal 4 passes the gate before migration destroys 4 of its planets.
   ⛔ **Do not "fix" the 28 back to 27.**
3. **`q = (ρ_c/ρ_p)·f³`**, so the builder's shipped `rng.range(0.10, 0.25)` caps `q` near 0.031 —
   4× below the ruled floor. The companion path passes `targetQ` and inverts it. §8.10 item 6.

---

## 3. ⛔ THE LITERALS LEFT DELIBERATELY RED. Every one is a hand-derivation.

| file:line | today → after B5.0 | mechanism |
|---|---|---|
| `body-identity-fence.test.js:288-293` | 24 → **51** strings, §8.4 has the list in walk order | `:477` |
| `:687` | `{961, 794, 770, 24}` → `{961, 821, 770, 51}` | `plain` is derived at `:683`, so it cancels |
| `:697` `onDisk` | `{961, 794}` → `{961, 821}` — **only after the re-bless** | sums the on-disk JSON |
| `:740-742` partition | → `{systems 27, planets 27, plainMoons 0, planetClassMoons 27}` | ⛔ classifier is `:733`, **by the `:288` literal**, so `:288` and `:740` must land together |
| `:779` | `records: 24 → 51` | shapes/keyCounts hold |
| `moon-condition-contract.test.js:162`/`:163`/`:370` | 23→**45**, 728→**750**, 23→**45** | `:161` and `:166` unchanged |
| `tools/moon-census.mjs:116` | `planetClass: 24 → 51` | ⛔ **exits 3**, "Do NOT adjust the expected numbers to match" |
| `StarSystemGenerator.binary-barycentre.test.js:163-174` | rows `wd-10` and `wd-27`, `moons 5 → 6` | ⛔ no re-bless; its own comment misdiagnoses this red |
| `moon-rng-stream-identity.test.js:349-356` **ORPHANS** | `orphanPlanetClass 2 → −20` | ⛔⛔ **not a re-number** — see below |
| `ProcgenSnapshot.test.js:81` | one sample, subject to the `:63` `active` filter | re-bless exists |

⛔⛔ **ORPHANS needs a mechanism change, not a constant.** `calls` comes off a wrapper on
`MoonGenerator.generate` (`:326`); `survivors` walks the finished system (`:339-341`). The companion
is a survivor that was never a call, so the *containment* `calls ⊇ survivors` breaks. Re-deriving the
three literals to green would **delete the invariant**. Count appended companions as their own term,
or say out loud that B5 did not. §8.10 item 1.

---

## 4. ⭐ NEW FINDING — sub-neptune, measured because Max noticed it

**It is 20.9% of all planets — joint-most-common with `rocky` (201 each of 961, FENCE-221.)**
`_pickType` gives it a band in four of the five orbital zones and only the scorching zone excludes
it: inner `roll 0.50–0.65` (15%), HZ `→0.48` (~21% after the terrestrial/ocean/eyeball draws),
**transition `roll < 0.30` (30%, its largest)**, outer `gasProb→0.68`.

**On planets the class is well-formed and defensible.** 201 bodies, radius **2.50 – 3.99 R⊕** —
exactly its `RADIUS_RANGES_EARTH` band — and mass 12.8–28.4 M⊕, which is genuinely giant-side and
justifies its place in `GIANT_PARENT_TYPES` (`MoonGenerator.js:29`). Real demographics agree that
sub-Neptunes are the commonest class.

⛔ **Two things are wrong, and neither is the rate:**

1. **The label survives a 6× shrink.** `PLANET_MOON_TYPES_BY_ZONE` includes `sub-neptune`, then
   `_generatePlanetMoon` overrides `radiusEarth` to a fraction of the parent — and the type string
   rides along. Measured over FENCE-221's 51 planet-class moons: **4 carry a giant type string**, at
   16,818 / 5,911 / 4,951 / **2,588 km**. That last is **0.41 R⊕ — six times below its own class's
   radius floor**, labelled `sub-neptune`. `wd-10`'s companion is one of these.
2. **Two subsystems disagree about the string.** `MoonGenerator.js:29` calls sub-neptune a GIANT;
   `ExoticOverlay.js:176` puts it in `_applyFungal`'s **`isRocky`** list. Same type, two
   classifications, and the second is a live giant→solid boundary crossing (§8.7 trap 2).

**Consequence for this lane:** 20.9% of planets are excluded from binary eligibility purely on the
strength of a type string, which is exactly what the plan's own rule (*"read from mass and
composition, never the type string"*, PLAN:37) exists to prevent. ⚠ **Not fixed. Scoped, not filed** —
it wants its own increment, and it overlaps B5 step 9's mass-ratio work.

### ⭐ §4b — NEW FINDING 2026-08-18. The 0.95 radius cap silently clips the high-`q` tail.

Found while checking Max's naming ruling, so it is a by-product, not a hunt. `_generatePlanetMoon`
(`MoonGenerator.js:381`) caps the radius fraction at `Math.min(0.95, …)`. When the cap binds, `f` is
smaller than the one that inverts `targetQ`, and since `q = (ρ_c/ρ_p)·f³` the **delivered `q` comes in
under the sampler's draw with nothing recording it.** Measured over `wd-0…wd-999`, 97 companions:

| | count | worst |
|---|---:|---|
| cap binds (`f = 0.95`) | **7 / 97** | `wd-234/5` — `targetQ 0.7475` → **delivered 0.4016**, a **46.3%** shortfall |
| uncapped, `q ≠ targetQ` | 1 / 90 | `wd-450/4` +13.74% — the `ExoticOverlay._swapPlanetType` parent swap, already documented in `tools/binary-yield-probe.mjs`'s header |

⭐ **The inversion is otherwise exact: 89 of 90 uncapped companions deliver `targetQ` to floating point.**
So the mechanism is sound and only the clamp leaks. Consequence: the triangular sampler on
`[0.122, 0.83]` is **not** the shipped `q` distribution — its top end is compressed, and the
population holds fewer near-co-equal pairs than §8.2's derivation assumes. ⛔ **This bears directly on
B5 step 9 (the mass-ratio commit) and on anything that asserts a `q` distribution.** Not fixed.

---

## 5. STATE YOU NEED

- **Max is PARKED** in the live game at `http://localhost:5173/well-dipper/` on `wd-10`, planet 3
  (`Meameinath` + `Meameinath I`), camera sunward at 1.75 units, pitch 0.28, both bodies lit.
- ⛔ **A body reading BLACK is almost certainly PHASE, not a defect.** Re-observed twice this session
  and both times it was the camera on the night side. `moon-goes-black-on-approach-2026-08-15.md` is
  **WITHDRAWN** — read its §0 before re-investigating. To fix it, put the camera sunward: read
  `_lab.cameraPose()`, take `controller.target`, find `effect.starflare.<seed>` in the scene, and set
  `yaw = atan2(starX − targetX, starZ − targetZ)`. Convention, verified this session:
  `position = target + d·(cos(pitch)·sin(yaw), sin(pitch), cos(pitch)·cos(yaw))`.
- ⛔ **`_lab.resolveBody` ignores `planetIndex`/`starIndex`. The working keys are `p` and `m`** —
  `resolveBody({kind:'planet', p:3})`, `resolveBody({kind:'moon', p:3, m:0})`. Undocumented until now.
- `_lab.frameBody(subject, {radii:N})` works but gives no control of azimuth, so it lands night-side
  as often as not. Use `setCameraPose` when the shot matters.
- Probe worktrees: `~/wd-b5-probe` (detached at `65d3bb5`, carries the two observation stamps) and
  `~/wd-b4-probe` (at `a76f9e7`). **Remove both when the lane ends.** The committed
  `tools/binary-yield-probe.mjs` supersedes their scripts and refuses to lie without `--stamped`.
- ⛔ **Sol cannot validate procgen.** `_lab.spawnProceduralSystem(seed)`.

---

## 6. ⛔ WHAT I GOT WRONG THIS SESSION

1. ⭐⭐ **I shipped §8.5 asserting all four stream literals stay green. ORPHANS does not, and it goes
   negative.** Caught by the verification pass, not by me, three commits after it shipped. The
   scoping doc had said "not routed through `MoonGenerator.generate` leaves the stream literals
   green" — true of three, and I generalised it to the fourth without opening the file.
2. **I imported a subagent's misreading of §4b into §8.2** — it read "clears the ceiling by 0.466 pp"
   as *exceeds* rather than *passes with headroom*. Caught before commit, but only because a refuter
   checked the sentence I had already accepted. **A trace's arithmetic being right does not make its
   reading of a document right.**
3. **My first §8 named four files and missed four more** (barycentre pins, `moon-census`'s exit-3
   pin, three `moon-condition-contract` literals, `ProcgenSnapshot`). The toll list I trusted was a
   floor and I presented it as a total.
4. **I cited `moon-census.mjs:346` for a symbol on `:345`.** Caught by re-reading before commit. The
   lane's rule is that a ref repaired to a second wrong line is worse than a stale one.

---

## 7. ⭐ TECHNIQUES THAT EARNED THEIR KEEP

- **Predict the integer, not the rate.** §8.4's 27 coordinates made B5.0 checkable in one command.
  A predicted *rate* would have been satisfied by a wrong implementation.
- **Land the separable thing first.** B5.0 alone is the only point in the window where the binary
  contribution is visible in `planets` and `planetClassMoons`. After step 2 only `systems` stays clean.
- **Verify by intervention.** The `massEarth: NaN` trap was proved by running the overlay's own
  arithmetic on a real record and watching 20 keys become 21 — not by reading the code.
- **Derive the same number two ways.** `q/f³ = 1.2093` against a measured density ratio of 1.2090.
- **Let the adversarial phase overrule the design phase**, and then check the refuter too: the
  refutation that killed my §4b claim was right; three others in the same batch were not.
- **Commit the probe, don't archive it.** The scoping doc's `scratchpad/probe-binary-criteria.mjs`
  was gone within a day.

---

## 8. OPEN FOR MAX

1. ✅ **UAT ANSWERED 2026-08-18 — FAILED, cause named. See §9.** Max: *"planet with a big moon
   because the orbit lines center one planet in orbit around the other rather than both around a
   shared empty gravitational center."* The barycentre render is now REQUIRED, not a non-goal.
2. ✅ **NAMING RULED 2026-08-18 — closed.** Max: *"name seems fine to me; largest planet can get
   primary designation."* So `Meameinath` + `Meameinath I` stands, and the rule is **the larger body
   holds the primary designation**. ⭐ **Already satisfied by construction, and measured rather than
   assumed:** `_generatePlanetMoon` sets `radiusEarth = fraction * planetData.radiusEarth` with
   `fraction = Math.min(0.95, …)` (`MoonGenerator.js:381-382`), so over `wd-0…wd-999` / **97
   companions, 0 exceed their parent** in either radius or mass. No work follows from this ruling.
3. **The sub-neptune finding (§4) wants its own increment.** *Rec: fold the label-survives-shrink
   half into B5 step 9 (it is already the mass-ratio commit) and file the
   `GIANT_PARENT_TYPES`-vs-`isRocky` disagreement separately.*
4. **B5 steps 1–9 in a fresh session**, per your call. Start with step 1 (channel selector at
   `MoonGenerator.js:122-127`) — and ⛔ read §2 above before touching step 4's merge.

---

## 9. ⛔⛔ B5.0 FAILED UAT. The barycentre render is back on the critical path.

The generation half is right and verified; **the render half is not**. Full finding, geometry, fix
location and blast radius: [`binary-planets-scoping-2026-08-17.md`](binary-planets-scoping-2026-08-17.md) **§9**,
which also annotates the three statements in that document the verdict refutes.

**One-paragraph version.** On `wd-10` (`q = 0.283`, `a = 25.1` primary radii) the primary should
circle the barycentre at `r1 = 5.53` primary radii and the companion at `r2 = 19.55`, with **two**
rings around an empty point. It is drawn with the primary **fixed**, the companion at the full 25.1,
and **one** ring centred on the primary — which is the satellite read. ⭐ The fix is small and §1 of
the scoping doc mislocated why it looked fatal: an offset applied *inside* the planet write at
`main.js:11197-11203` is picked up consistently by lighting, plain moons and the companion, and the
companion needs no change at all. ⛔ The one thing that breaks with it is `:11265-11271`, which
sources moon rings from the recomputed `px/pz` rather than the planet's mesh position — fix in the
same change or every ring on the primary's other moons detaches.

⚠ **Wider blast radius than the pair.** §4 measured 13 of 713 *existing* moon/parent pairs whose
barycentre already sits outside the primary, worst `r1/R_p = 9.618`. All are drawn wrong today and
the fix moves them too — so this is a visual change to non-binary bodies, and it needs its own UAT.

**It does not block B5 steps 1–9** and they do not block it: B5 moves masses and radii, this moves
where a body is drawn, and they meet only at `q`. ⛔ 2+ systems → `dev-collab-scope` before code.

---

## 10. ▶ THE QUEUE, IN ORDER — and how to run it

⚠ **The order is assumed, not ruled.** Max said *"work all in order via workflows"* directly after
I recommended the barycentre render before B5 steps 1–9, with the reason: it is the smaller piece,
it is the difference between *binaries exist* and *binaries read as binaries*, and steps 1–9 red
every instrument for a long stretch during which there is no clean look at a pair. **If he says
otherwise, he outranks this line.**

| # | item | entry condition | blocked by |
|---|---|---|---|
| **1** | **Barycentre render** — §9 | ⛔ `dev-collab-scope` FIRST (renderer + orbit lines + a generation read = 2+ systems) | nothing |
| **2** | **B5 steps 1–9** — the moon window proper, PLAN §3 | ⛔ read §2 of this doc before step 4's merge | nothing; independent of (1) |
| **3** | **B6** citation repair → **B7** re-derivation + re-bless → **B8** acceptance/calibration → **B9** shape | B7 is what finally clears every literal in §3 | (2) |
| **4** | **sub-neptune** — §4 | — | *rec:* fold the label-survives-shrink half into B5 step 9; file the `GIANT_PARENT_TYPES`-vs-`isRocky` disagreement separately |
| **5** | **B10** `deriveFormation` — PLAN §3 B10 | — | nothing depends on it, which is why it is last |

**Two things B8 must not skip**, both raised late and easy to lose: redo §4b's co-satisfiability on
the **exact** conversion (§8.2 — the tension is at the **floor**, not the ceiling), and state which
denominator any Band A rate is asserted against (§4a).

### The workflow playbook that worked this session

- **Pin `model: 'opus'` on every agent.** Omission inherits Fable at ~2× Opus cost.
- **Brief every agent with the ACTUAL HEAD and what already shipped.** ⛔ This session's synthesis
  opened with *"THE PREMISE IS STALE"* because the finders were briefed at `65d3bb5` while the work
  landed at `1ed1176`/`c52d397`. Four agents re-derived what the tree already held.
- **Hard rules that produced the good output, verbatim:** read-only; no `src` edits (a dev server on
  `:5173` fires HMR into Max's session); no chrome-devtools; no servers; scripts under `/tmp` only;
  every claim carries a `file:line` **you opened**, with the line quoted; a comment stating what code
  intends is not evidence of what it computes.
- ⭐ **"An honest 'not found' beats a plausible invention."** Single highest-yield instruction.
- **Shape:** `pipeline(finders, find → parallel([citation-accuracy lens, logical/corpus-soundness
  lens]))` → synthesis. Corpus-soundness matters here specifically because *two different corpora are
  both called "221"*.
- ⛔⛔ **VERIFY THE VERIFIERS.** Of four finder reports, the refuters caught one genuinely fatal
  misreading — **and three of their own refutations were themselves wrong.** Working-Claude must
  re-open every load-bearing line before acting on either layer. §6 items 1 and 2 are what happens
  when that step is skipped.
- **Cost, so it can be budgeted:** 13 agents, ~43 min wall clock, ~2.5M subagent tokens for one
  4-topic audit.

### Suggested skills for the next session

- **`dev-collab-scope`** — ⛔ REQUIRED before item 1 touches code. Produces `intent.md` +
  `contract.json`; `verify-workstream` then runs against them.
- **Workflow tool** — the lane's method, per the playbook above.
- **`superpowers:verification-before-completion`** — §6 of this doc is four entries long, and two of
  them shipped into a commit before being caught.
- **`superpowers:test-driven-development`** — every test in this lane is proven by reverting the fix
  and confirming the *specific* assertions go red.
- **`superpowers:systematic-debugging`** — for anything that looks like a rendering defect. ⛔ And see
  §5: a body reading black is almost always camera phase.
- **`handoff`** at the next seam — ⛔ into `docs/FEATURES/`, never `/tmp`, and extend this file rather
  than starting a second one.
- ⛔ **Do NOT invoke `library-context`.** The SessionStart hook nags about a three.js brief for an
  unrelated project (`gesar-app-skin`). This repo is on three.js **0.183.1**.


---

## 11. ▶ SESSION 2026-08-18/19 — queue item 1 SHIPPED-PENDING-UAT, item 2 SCOPED. Start here.

**HEAD `87cdcd3`** · branch `feature/world-engine-production-L1` · tracked tree **CLEAN**
⛔ Max's rulings this session are in §8 items 2 and 4 and below. §10's queue order held.

### ⭐⭐ READ THIS BEFORE ANY BROWSER MEASUREMENT — it cost this session three commits and a workflow

**A page that has been hot-reloaded through a build is not evidence about the shipped code.**
Every `src` edit fires Vite HMR into the open game. After a dozen-plus reloads, stale duplicated
module state gave planet-class moons a **constant 0.779424× drawn-orbit-radius error** that:

- survived four consecutive `spawnProceduralSystem` calls (a respawn rebuilds the scene, **not**
  HMR-duplicated module state),
- survived `_lab.freezeFrame`,
- appeared identically in `mesh.position`, `_interpPrev` and `_interpCurr`,
- and **vanished completely on one page reload** — 1.000000 on every body across wd-10, wd-17 and
  wd-133, planet-class and plain alike.

**RELOAD FIRST, THEN MEASURE.** A 13-agent workflow honestly returned NOT FOUND because the defect
was not in `src/`. Six mechanisms were each killed by measurement — that record is in
`docs/WORKSTREAMS/binary-barycentre-render-2026-08-18/live-integration-evidence.md`, worth reading
before re-deriving any of them.

### Queue item 1 — BARYCENTRE RENDER. Code shipped, integration green, **Max's UAT still open.**

`docs/WORKSTREAMS/binary-barycentre-render-2026-08-18/` — `intent.md`, `contract.json` (status
`verified`, `verifiedPendingMax`), `live-integration-evidence.md`. Code at **`52031fd`**.

- `src/physics/BodyMass.js` — the one mass rule; `GravityField._estimateMoonMass` delegates to it.
  ⛔ `planetMassEarth`'s `?? estimateMassEarth(…)` arm is load-bearing: `SolarSystemData.js` has
  **zero** `massEarth`, and without it every planet in Sol goes NaN.
- `src/physics/Barycentre.js` — predicts, never mutates. Reads a plain moon's angle off `_delegate`.
- `src/main.js` — four seams: per-frame planet write, spawn write, non-binary sun dir, ring loop.
- 19 headless tests; all five source assertions proven red-at-parent / green-at-HEAD.

**Verified live** (clean load): `r1 = 5.5332 R_p`, `r2 = 19.5492`, both rings on the empty point,
`cos∠ = −1`, 16/16 ring proxies accounted for, single-star lighting arm `dot = 1` at wd-17.

⛔ **Max's UAT item 1 — "one of the planets is not riding along its orbit line" — was almost
certainly the HMR artifact above.** He was parked on the poisoned page. **He must re-look on a clean
reload before any work is spent on it.** ▶ **That re-look is the immediate next action.**

### Queue item 2 — ORBIT-LINE OCCLUSION. Scoped, greenlit, **NOT started.**

`docs/WORKSTREAMS/orbit-line-local-system-occlusion-2026-08-18/` at **`f411974`**, 7 ACs, status
`scoping`. From Max's UAT: the heliocentric line must not cut through a planet's local ring system.

- **Whole-disc erase**, ruled against a side-by-side preview — one clean gap, not four nicks.
- **Every moon-bearing planet**, not just the 27 pairs (his standing no-special-case preference).
- ⛔⛔ **AC-LOCAL-RINGS-SURVIVE is the fatal trap.** The pair's inner ring lies *entirely inside* its
  outer ring, so a naive "mask anything inside the outermost local radius" rule **erases the
  primary's ring** and silently deletes what item 1 shipped. The same-system exemption is load-bearing.
- ⛔ Needs `OrbitConicField.js` — the only ring pixel source (`OrbitRingSDF.js:49`). **Max lifted the
  `docs/PARKING_LOT.md:239-241` hold on 2026-08-18.** That entry also flags a real perf-architecture
  decision, carried as `AC-RING-BUDGET-AND-PERF`.

### Still open for Max

1. ⛔ **SOL — unanswered, and he asked for it as a workflow, after items 1 and 2.** Sol carries no
   masses at all, so 19 of its 26 moons imply impossible bulk densities (to 15.8× Earth) and the
   barycentre term makes **Earth wobble 1.271 of its own radii, Saturn 0.530, Pluto 7.447, Eris
   4.644**. *Rec (unchanged): ship as-is and fix Sol's mass data as its own increment — the defect is
   the data, and editing it mid-window risks reddening `port-condition-contract.test.js`, which has
   no re-bless mechanism.*
2. **Shipped flip on item 1** — gated on his UAT re-look, per the §11 note above.
3. **§4b — the `0.95` radius cap clips the high-`q` tail** (7 of 97 companions, worst 46.3%
   shortfall). *Rec: fold into B5 step 9, the mass-ratio commit.*

### Queue after that — §10 is otherwise unchanged

**B5 steps 1–9** (independent of both items above; ⛔ read §2 before step 4's merge) → **B6/B7/B8/B9**
→ **sub-neptune (§4)** → **B10**.
