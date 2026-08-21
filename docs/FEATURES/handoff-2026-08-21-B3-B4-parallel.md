# Handoff 2026-08-21 — ▶ **NEXT = B3 ∥ B4, SIMULTANEOUS. THEN B7.**

**HEAD:** `564e0db` · **Branch:** `feature/world-engine-production-L1` · **NOT pushed**
**Repo:** `~/projects/well-dipper`

> ⭐ ~700 untracked PNGs, `screenshots/`, `scratchpad/` and `qa-results/` are normal. ⛔ **NEVER `git add -A`.**
> ⛔ Written into `docs/FEATURES/`, **not `/tmp`** — the `handoff` skill says /tmp and the project overrides it,
> because `NOW.md` still points at a dead `/tmp/handoff-…-2026-06-25.md`. That is the whole reason.

---

## 0. THE ONE THING TO DO

**Run B3 and B4 AT THE SAME TIME, then B7.** Both are specified in
[`comprehensive-wiring-plan-2026-08-20.md`](comprehensive-wiring-plan-2026-08-20.md) §2. Max, 2026-08-21:
*"Independent and simultaneous; your recommended ordering sounds good."*

⛔ **AND THE ORDERING I RECOMMENDED TO HIM WAS WRONG — DO NOT REPEAT IT.** I told him B7 should run
next. It cannot. B7's own precondition list (§2, B7, "What MUST precede it") requires the eight
`blocking` ledger rows closed and B4 landed: **B0** closed P-12/P-13, **B2** closed P-10/M-09, and
**B3 closes the remaining four** (P-05, P-11, P-14's crater half, R-07). Max caught the shape before
I did. The plan's own graph in §4.1 has it right. **B3 ∥ B4 → B7.**

**B3 ∥ B4 is genuinely parallel and the plan argues it hard** (§4.1): with QB-1 moved out of B4 into
B3, the uniform families are disjoint — B4 owns star colour, second-star diffuse and shadows; B3 owns
`uTerm*`/`uLimb*`/crater/palette/aurora. ⛔ A false constraint here costs as much as a missed
dependency.

---

## 1. ⭐ MAX'S FOUR RULINGS, 2026-08-21 — recorded in the plan, repeated here because they change work

| | ruling |
|---|---|
| **D-9 pigment** | ✅ **GREEN.** *"Earth's continents are green where there are forests, if they're on the day side."* ⭐ **AND A SECOND, LARGER ASK CAME WITH IT** — *"I'm interested in alien fauna of different colors also, having systems for that."* ⛔ **These are two units, do not merge them.** Greening `BIO_PIGMENT` (`surfaceMaterial.js:155`) is a constant edit inside **B5**. The per-world pigment SYSTEM is new scope with no block — ⭐ but the source already parked it *and named its input*: the NON-GOAL note above that constant says pigment *"track[s] the host star's spectrum… and the condition vector does carry `starMassEarth`"*. **Verified 2026-08-21: `starMassEarth` resolves 15× in `src/worldengine/port/conditionFromBody.js`**, so the input is reachable today and the only missing piece is the calibration that note declined to guess. ⚠ He said *fauna*; the constant drives photosynthetic ground cover, i.e. flora. |
| **D-14 retire** | ✅ **APPROVED — retire the ten CARRIED rows.** ⚠ His word was **"Ok"** against a framing of *"retire ten stale checklist rows… keep or drop"*. Recorded as approval-to-retire and nothing wider. ⛔ Keep each evidence cell intact so the act is reversible in git; ⛔ no eleventh row joins them on this ruling. |
| **D-7 WS3 hold** | ✅ **LIFTED, WITH A CONDITION ON HOW.** *"I'm fine with this starting after we wrap up here, via handoff to a fresh session."* The `featureRelevant`/`rendersOn` migration MAY start — ⛔ **and the fresh-session condition is part of the ruling, not packaging.** ⛔ Lifting it does **NOT** ship WS4; that half of `docs/NOW.md`'s standing instruction is untouched. |
| **ordering** | ✅ **B3 ∥ B4 simultaneous, then B7** (see §0, and my error there). |

---

## 2. WHAT SHIPPED TODAY — read the commit messages, they carry the evidence

`d9655aa..564e0db`, nine commits. Do not re-derive any of it.

| commit | |
|---|---|
| `bed3235` | **B2P written into the plan** as §9 — the raisable posterize level Max asked for |
| `332acc9` · `b5e7e6f` · `1d5fc54` · `e17ca25` | **B2P built, then took FIVE rounds to make its prose true.** Final state: the colour quantum is a setting reaching six game programs + the lab material |
| `5afef82` | **B2 leg 1 — both crater floors re-derived from the RENDERER.** Rocky planets with craters **12 → 214 of 509**; bodies rendering <1 crater **119 → 0** |
| `68c39d5` · `5fb6197` | **B2 legs 3 + 2**, then both blockers closed |
| `564e0db` | **posterize default 6 → 31** — Max's era-parity ruling |

---

## 3. ⛔ WHAT IS TRUE ABOUT THIS CODEBASE THAT COSTS A SESSION TO REDISCOVER

- ⭐⭐ **THE SCENE RENDERS AT 1/3 RESOLUTION.** `RetroRenderer.js:811` sizes `sceneTarget` at
  `ceil(width / pixelScale)`, pixelScale 3. **So `gl_FragCoord` is in RENDER pixels** and every
  screen-pixel estimate is out by 3×. This is what unlocked leg 1 and nobody had noticed it.
  Measured disc RADIUS on a procedural body at 1600×999 dpr1: **1078.23 screen px at 1.2 body radii**.
- ⭐⭐ **`freezeFrame()` PINS ORBIT TO 0, WHICH TELEPORTS THE BODY.** Freeze **FIRST**, then
  `frameBody`, then capture the pose. Framing first puts your subject off-screen and `shotState`
  returns `discR: 0`. Cost two attempts.
- ⭐ **`npx vitest run --exclude '**/.claude/**'` DOES NOT EXCLUDE `scratchpad/`**, which holds
  untracked probe tests that silently join the run. **Always pass BOTH excludes.**
- ⭐⭐ **A TRACKED FILE IMPORTING AN UNTRACKED ONE IS INVISIBLE TO EVERY GATE.** It happened twice
  today: B2P shipped its only object-identity fence untracked while the ledger cited it as live proof,
  and B2 leg 3 had tracked `rockySurface.js` importing untracked `macroWavelength.js` — a clone would
  have crashed on every body. ⛔ **The citation fence CANNOT catch this: it resolves against the
  WORKING TREE, not the index.** Sweep with `git ls-files` + a module-graph walk before committing.
- ⭐ **The lab program still divides by `uLevels`** (`height.glsl.js:683-684`) where the game now
  multiplies by a CPU-carried reciprocal. Consequence for **B7**: the lab renders the top posterize
  band one 8-bit code darker than the game and always has (~15k px on a 256×256 body). Harmless
  behind the flag; **at the flip, that band shifts on every planet and moon.**
- ⛔ `uCratonColor` **paints zero pixels in the game** — `ensureLabSamplers` binds `uProvinceCube` to a
  1×1 placeholder, so the province branch never runs. **Confirmed live**, not inferred. Anything
  scoped against craton colour is scoped against nothing.

---

## 4. GATES — the numbers to beat, verified BY HAND at `564e0db`

| gate | value | how |
|---|---|---|
| failing set | **32**, md5 `2be0e6a9de7be79b5d8c23e0958d2b1c` | ⭐⭐ **MEMBERSHIP diff, `comm` BOTH ways. NEVER a count.** Baseline: regenerate at HEAD |
| citations | **708 CHECKED**, exit 0 | a DROP means refs stopped being READ; repair BY SYMBOL, never by bumping an offset |
| Instrument C | exit **2**, 514 bodies, every row `0/514` | ⛔ the STRUCTURAL BREAK is **pre-existing** (Instrument B's moon-window finding). Do not fix, do not re-record |
| line counts | every citation-bearing file **N added / N deleted** | `Planet.js` carries 379 refs across 202 lines; the ledger has refs at `:94`/`:251` |

The 32 are **RED BY DESIGN** (moon-formation window `34b502d`). ⛔ Not defects.
⚠ `ringConic.frontarc` and `GalacticFeatures` are **load-dependent timeout flakes** — they appear only
under heavy parallel agent load. Re-run before reporting either.

---

## 5. ⚠ KNOWN-IMPRECISE, DO NOT QUOTE WITHOUT RE-MEASURING

The two new calibration docs carry derived comparison figures that an audit found unreliable — the
legacy-comparator rows, the planet-class census, the "reaches a pixel" counts.
**The code they describe is sound and every gate holds; the numbers are not.**
`macroWavelength.js` now says so in its own comment, including that its LEGACY column was measured off
the record field rather than the mounted uniform, three passes running.

---

## 6. ⭐⭐ THE PROCESS FINDING, AND IT IS THE REAL OUTPUT OF TODAY

**The code converged fast. The CLAIMS did not.** B2P took five rounds; B2's repair pass took false
statements from **16 → 26**. Every round, prose outran measurement: a comment asserted exactness before
anyone sampled a knife edge; a ledger row asserted coverage before the test existed; a gate was
reported PASS while its own script exited 1; a "corrected" figure was measured off the wrong field
three times.

**What works:** a **claims auditor with no authority to write anything**, whose only job is checking
assertions against measurements. It caught every one of the above. ⭐ **Make it a standing stage.**

**What also works, and is cheaper:** when a figure has been wrong twice, **WITHDRAW it and say why**
instead of publishing the next candidate. Done twice today; both times it ended the loop.

⛔ **What does NOT work: another repair round.** That is the trap.

---

## 7. SUGGESTED SKILLS

- **Workflow tool** — Max asked for workflows by name and the lane's method is agent-driven. ⭐ **Pin
  `model: 'opus'` on every agent** (omission inherits Fable at 2× cost). The shape that works:
  *build sequentially → hostile lenses in parallel → confirm-or-kill each finding → repair only
  survivors → claims audit*. ⛔ **Have agents write reports to FILES and return only
  `{proceed, reportPath, headline}`** — a workflow died today after 135 tool calls because an agent
  tried to return a large structured object five times. ⭐ Serialize any browser stage to ONE agent.
- **`superpowers:verification-before-completion`** — every agent report today was re-run by hand
  before commit, and doing so caught a gate reported PASS whose script exited 1.
- **`superpowers:test-driven-development`** — prove a gate by reverting the fix and confirming the
  *specific* assertion reds. Two controls shipped dead today and hostile review caught both.
- **`superpowers:systematic-debugging`** — for anything that looks like a rendering defect.
- **`dev-collab-scope`** — ⭐ **NEEDED for D-9's second half** (the per-world pigment system). That is
  new multi-system scope with no block; it is exactly what the skill is for. ⛔ NOT needed for B3/B4,
  which are already scoped in the greenlit plan.
- **`handoff`** at the next seam — ⛔ into `docs/FEATURES/`, **never `/tmp`**.

---

## 8. OPEN FOR MAX

1. **Nothing is blocking B3/B4.** All four of his standing decisions were ruled today.
2. **`git push` has never happened this session** — nine commits sit local. ⛔ Confirm before pushing,
   and push with the sandbox **disabled** (this repo lies with "Everything up-to-date" above ~10 MB
   in-sandbox); verify with `git ls-remote`.
3. **The posterize shot set** is at `screenshots/b2p-posterize-2026-08-21/` (untracked, per repo
   convention) with `CAPTIONS.txt`. Six frames, same body, same frozen pose.
