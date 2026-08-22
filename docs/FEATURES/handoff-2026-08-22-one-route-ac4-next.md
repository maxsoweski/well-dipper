# Handoff 2026-08-22 — ▶ **NEXT = AC4, THE IMPORT-BACK GATE**

**HEAD:** `35dee96` · **Branch:** `feature/world-engine-production-L1` · **PUSHED** (verified by `git ls-remote`)
**Repo:** `~/projects/well-dipper` — tracked-clean

> ⭐ ~700 untracked PNGs, `screenshots/`, `scratchpad/`, `qa-results/` are normal. ⛔ **NEVER `git add -A`.**
> ⛔ This doc lives in `docs/FEATURES/`, **not `/tmp`** — the `handoff` skill says /tmp and this project
> overrides it, because `NOW.md` pointed at a dead `/tmp/handoff-…` for weeks. That is the whole reason.

---

## 0. THE ONE-PARAGRAPH ORIENTATION

Max's goal, in his words (2026-08-21): *"going forward the game engine and world engine (lod lab) are
connected such that a change to one affects the other and we don't have to spend a month … porting
over lab features to the main game; I want all the lab features (unless depricated) to be in the game,
wired up, and anything new we develop in the lab should be wired as we develop it."*
⛔ **HE HAS SAID THIS BEFORE.** It is already standing constraint #2 of the plan of record
(`docs/FEATURES/lab-pipeline-into-game-PLAN.md:87`, 2026-08-01). Stated as a rule, it was dropped.
The active workstream exists to make it **structural** instead. **The backlog half is done or ruled;
the FORWARD half — AC4 — is not, and it is the half that stops this recurring.**

---

## 1. THE ONE THING TO DO — AC4

**A new pack must not be able to ship without the lab importing it.** Today the ledger *records* drift
and refuses to let it grow, but nothing stops a NEW pack arriving unimported — which is exactly how 7
of 8 got here. AC4 makes that fail **by name, with the offending path**, at authoring time.

- Home: `tests/one-pipeline-fence.test.js`, registration 2 (already has the ledger + liveness).
- The fixture idiom is established: `tests/fixtures/broken-control-pack/` — one deliberately-broken
  control per registration, **executed red before the scanner exists**. ⛔ *"A pass with no failing
  control is worthless"* is this node's gate; do not write the assertion first.
- **Moves pixels? NO. Needs Max? NO.** It is a fence.

**Then AC5** — wire one genuinely-unwired feature end to end and record what it cost, so *"not a month"*
is demonstrated rather than claimed. ⭐ Do AC4 first: it is cheap, preventive, and AC5 is more
meaningful once the gate exists to catch a mistake made *during* it.

**The contract is the reference, not this doc:** `docs/WORKSTREAMS/one-route-shared-driver-path/contract.json`
(schema-valid; validate with `node ~/projects/personal-os-improvements/dev-collab/validate.mjs contract <path>`).

---

## 2. ⭐ MAX'S RULINGS — ALL OF THEM, AND THEY ARE SETTLED

| | ruling |
|---|---|
| **B7 terrain scale** | ✅ **SHIPPED STANDS.** Ruled live on a clean `uNoiseScale` A/B. `uDispDomainScale` needs no revert. Recorded at ledger **P-15** (`docs/FEATURES/step6-parity-ledger.md:135`) — verdict unchanged, *standing* changed: `accepted-loss` recorded that nobody had chosen it; it is now chosen. |
| **workstream shape** | ✅ **PACKS, not a wholesale `applyDrivers` move.** The wholesale plan was killed on measured evidence — `AC2-refutation.md`. |
| **legacy set** | ✅ Resolved from the code, needed no ruling — `AC1-legacy-set.md`. |
| **`stormSeed`** | ✅ **A LAB AUTHORING KNOB. Divergence DECLARED, not closed.** `polarDeck`'s 6 confirmed rows are NOT debt. ⛔ **Do not "fix" them.** |
| **crater floor / `uCraterDensity`** | ✅ **THE GAME'S LAW WINS** — and the lab was converted. ⚠ This REVERSED an earlier "leave it" ruling once it was measured; see §4. |
| **`uTermStrength`** | ✅ **Same — the game's law.** Converted. |
| **the operative test, verbatim** | *"the important thing here is the game and lab end up working the same"* — apply this when a new divergence appears. |

---

## 3. WHERE THE WORKSTREAM ACTUALLY STANDS

| AC | state |
|---|---|
| **AC1** legacy set named | ✅ `tools/legacy-set-scan.mjs` · 3 dead modules, 18 unreached laws, all ruled |
| **AC2** pack conversion | ⚙️ **substantially done** — limb, crater (5 fields), terminator converted; polarDeck declared; `giantSurface` + `solidFeatures` had no real conflicts |
| **AC3** no pixels, no gate breaks | ✅ held on every conversion |
| **AC4** the import-back gate | ⬜ **NEXT** |
| **AC5** wire one feature, record the cost | ⬜ |
| **AC6** the lab still works | ✅ verified live each time |
| **AC7** Max's UAT | ⬜ his gate alone |

⭐ **THE HEADLINE NUMBER: the import-back debt ledger took its FIRST SHRINK, 13 → 11**
(`tests/one-pipeline-fence.test.js:387 IMPORT_BACK_DEBT_CEILING`). It is shrink-only and may never rise.

⚠ **The remaining conversions are NOT mechanical.** Three test suites so far encoded *"the lab holds
the law"*. Max's ruling inverts that, so more will red — each needs its **pin moved onto the module**,
not deleted. `port-terminator-law.test.js` and `worldengine-inc3b-synth-law.test.js` are the worked
examples: both gained an assertion they never had — *that the lab actually reads the shared law*.

---

## 4. ⛔ WHAT COST REAL TIME — READ BEFORE TOUCHING THE LAB

- ⭐⭐ **APPENDING AN IMPORT TO A LINE THAT ALREADY ENDS IN `//` PUTS IT INSIDE THE COMMENT.** Both new
  imports were silently disabled. **Every headless gate stayed green** — vitest never executes the lab
  HTML — and the lab died at runtime on `terminatorOpticsOf is not defined`. Only loading the page found
  it. **Insert BEFORE the trailing comment.** This is the concrete argument for why AC6 is not optional.
- ⭐⭐ **`planet-lod-lab.html` IS LOAD-BEARING AS A CITATION TARGET, NOT JUST AS CODE.** 500 line-anchored
  refs sit at or past `:1933`; **175 inside 1933–2760**. Every edit must be **line-count-neutral**. Same
  for `Planet.js` (2304), `limbDeck.js` (199), `step6-parity-ledger.md`, `lab-surface-ratchet.test.js`.
  ⛔ **This is why the wholesale extraction was killed** — the obstacle was never the code.
- ⭐ **LINE-NEUTRALITY FORBIDS DELETING DEAD CODE, AND A TEST WAS MATCHING IT.** Six crater locals went
  dead; `worldengine-inc3b-synth-law.test.js:144-145` matched those exact constants and would have
  stayed GREEN against code nothing runs. **Neutralise dead lines into comments** — count preserved,
  dead code gone, test correctly red.
- ⛔ **A CITED LINE'S TEXT CHANGING IS NOT A RENUMBERING JOB.** One line changed; three documents
  asserted about it; **two were already wrong** (`Planet.js` pointed at `lab:3749`, a jets GUI slider;
  `PLAN.md:35` at `:2452`, plus a backwards range `Planet.js:1605-1583`). Both survived because they sat
  in the fence's **UNCHECKED column**. Fix the CLAIM, not the quote.
- ⚠ **CHECKED MUST RISE.** It fell twice this session (813→812 both times) from deleting a ref along
  with stale prose. Restore by re-citing in checked form. Now **814**.
- ⚠ **A stale Vite pre-bundle 504s `lil-gui` and the lab will not boot.** Not a code defect. Fix is Max
  restarting the dev server (`npm run dev`) himself — working-Claude cannot start servers.
- ⚠ **`tests/worldengine-inc3b-composite-budget.test.js` IS FLAKY** — red in one full-suite run, green
  the next, no code change, passes 19/19 in isolation. Not among the 31 red-by-design.

---

## 5. GATES — every number measured at `35dee96`

| gate | value |
|---|---|
| Instrument A | **ZERO DRIFT** · 341 files, 5698 tests, **31 failing**, 15 non-collecting · ⭐⭐ MEMBERSHIP diff, **never a count** |
| Instrument C | **exit 0, ZERO delta** on all 55 shipped shared uniforms |
| Citations | **814 resolve, exit 0** · ⭐ CHECKED must **RISE** |
| `Planet.js` | **2304 lines** · `planet-lod-lab.html` **6559** |
| Fence suites | 283/283 across 10 suites |
| Instrument B | **RED, and red at HEAD too** — moon-formation window, another lane. ⛔ Do NOT re-record. |

⛔ **RE-RUN GATES AFTER THE LAST EDIT, NOT BEFORE IT.** This session committed `0e814d1` on top of a red
fence and reported a number measured before the final fix. The fence was right; the process was not.

---

## 6. METHOD THAT WORKED — AND ITS PRICE

Two workflows ran; **both produced output that did not survive its own adversarial pass**, and in both
cases the refuter was **cheaper than the work it prevented**:
- wholesale-extraction plan → **13 defects, 5 gate-breakers** (`AC2-refutation.md`)
- 6-pack law survey → **29 claimed conflicts → 3 real decisions** (`AC2-pack-law-survey.md`); an entire
  pack's claims were refuted by *measuring* (157/157 gas bodies bit-identical), not by arguing.

⚠ Cost: ~460k + ~890k subagent tokens. ⛔ **Pin `model:` on every agent** — omission inherits Fable at
2× Opus cost. Readers on `sonnet`, judgement calls on `opus`, worked well.

⭐⭐ **AND THE LESSON THAT GENERALISES: FOUR INSTRUMENTS WERE BROKEN RATHER THAN THE THING THEY MEASURED**
— a WebGL canvas readback (0% change on A-vs-A), the first terrain A/B (contaminated arm), the
legacy-set scan (`String.match` with no `g` flag inflating 18 → 116), and a same-file-reference blind
spot that condemned four SHIPPED packs. **Every one was caught by demanding the instrument fail on a
known case first.** Do that before trusting any number, including your own.

---

## 7. SUGGESTED SKILLS

- **`superpowers:test-driven-development`** — ⛔ for AC4 this IS the node, not a supporting practice.
  The gate is "prove the fence bites by breaking it on purpose."
- **`superpowers:verification-before-completion`** — ⭐ the highest-value one here, again. See §5's
  process failure.
- **`superpowers:systematic-debugging`** — if a conversion turns into a defect hunt.
- **`handoff`** at the next seam — ⛔ into `docs/FEATURES/`, never `/tmp`.
- ⚠ **Workflows/subagents: APPROVED by Max** (2026-08-22, "continue via subagents/workflows … be token
  efficient where feasible"). Pin models explicitly. Ultracode stays OFF.

---

## 8. PARKED, NOT FORGOTTEN

- **B5** — the quality strand (L–XL). ⭐ TWO Max looks, wants its own fresh session.
- **B8** — the gated tail. ⛔ A holding pen with named gates, not a queue.
- **The ~26 wireable lab features** — `docs/FEATURES/lab-features-not-yet-wired-2026-08-20.md`. The
  follow-on workstream, deliberately sequenced AFTER this one.
- **The 8 features with NO DRIVER LAW** — Max: *"yes we need to author these."* Design work with his
  taste in it, not wiring. Its own workstream.
- **`limbStrength`'s ×1.3 boost** (`planet-lod-lab.html:2479`) — a separate divergence, never analysed,
  deliberately left standing.
- **The 31 red-by-design tests** — moon-formation window, another lane.

---

## 9. OPEN FOR MAX

1. **Nothing blocking.** AC4 needs no ruling and moves no pixels.
2. **A look he has not taken:** crater density roughly DOUBLED in the lab. Everything objective is
   green; whether rocky worlds *read right* at the game's density is his eyes alone.
3. **`uTermStrength` disagreement is 2 thin-column bodies** (~0.1304 vs 0.15) — already converted; noted
   only so nobody re-opens it as a defect.
