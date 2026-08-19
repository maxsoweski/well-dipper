# Handoff 2026-08-19 — ▶ **THE FIRST THING TO DO IS PUT THE LANE CHOICE TO MAX.**

**HEAD:** see `git log -1` · **Branch:** `feature/world-engine-production-L1` · tracked tree **CLEAN**
**Repo:** `~/projects/well-dipper`

> ⭐ **~700 untracked PNGs and `scratchpad/` are normal. ⛔ NEVER `git add -A`.**
> ⛔ **Do NOT invoke `library-context`.** The SessionStart hook nags about a three.js brief for an
> unrelated project (`gesar-app-skin`). This repo pins three.js **0.183.1**.

---

## 0. ⭐⭐ THE ONE DECISION THAT SHAPES THIS SESSION

Max's closing words: *"let's /handoff to a fresh session and then continue. **I want to drive to
getting all the world engine rendering into the main welldipper game.**"*

⛔ **"Continue" and that goal point at DIFFERENT LANES, and the ambiguity is not resolvable from the
transcript.** Put it to him before doing anything else.

| | the lane we were in | the lane he named |
|---|---|---|
| what | **B5 — the moon window.** Moon *generation*: channel model, mass-first sampler, feeding zones, the C4 irregular tail. | **The world-engine program.** Getting the lab's planet *rendering* pipeline into the game. |
| plan of record | [`moon-formation-b5-build-plan-2026-08-19.md`](moon-formation-b5-build-plan-2026-08-19.md) — 12 commits | [`lab-pipeline-into-game-PLAN.md`](lab-pipeline-into-game-PLAN.md) — 6 layers |
| does it advance his stated goal? | **No.** Not one line of it is rendering. | **Yes. It is the goal, restated.** |

### ⭐ Why the choice is genuinely open right now, and won't be later

**ZERO B5 steps have been cut.** The only thing that landed toward it is **S0-a** (`905f77e`), a
*regression repair* that was owed regardless of lane — see §3. So:

- **Pivot now: costs nothing.** The B5 build plan is written, verified and committed; it keeps.
- **Pivot after step 1: expensive.** From step 1 on, every instrument is red for a long stretch and
  there is no clean look at the game until B7 re-blesses. Stopping mid-window strands the tree in a
  state where nothing can be validated and ~70 hand-derived numbers are half-moved.

**⛔ Do not silently pick one.** *Rec: ask, and recommend the world-engine lane* — it is what he said
he wants to drive to, it is the only lane that advances it, and the pivot is free exactly once.

### Where the two lanes actually meet — worth telling him

**The condition contract.** It is world-engine **LAYER 0** (*"NEW, AND IT IS UNDERNEATH EVERYTHING"*,
`lab-pipeline-into-game-PLAN.md:228`) and it is simultaneously B5's hardest constraint:
`port-condition-contract.test.js:286`'s `CORPUS_BODIES = 526` pin **must not move**, and it has **no
re-bless mechanism** — a break there is a hand-repair with no safety net. Doing layer 0 first would
make the B5 window *safer* to open later, not harder. That is a real argument for the pivot, not a
rationalisation of it.

---

## 1. WORLD-ENGINE LANE — the state, if he picks it

`docs/FEATURES/lab-pipeline-into-game-PLAN.md`. **Read `## How to pick this up in a fresh session`
(`:943`) and `## The criterion, verbatim` (`:969`) FIRST.**

| layer | owns | status |
|---|---|---|
| **0** | condition contract — what a body's physical description IS, and honest reporting of what is missing | `TODO` ⭐ **underneath everything** |
| **1** | world-gen physics — bodies whose conditions actually *differ* | `TODO` — diagnosed, not fixed |
| **2** | renderer conformance | ✅ **DONE, verified live 2026-08-06** |
| **3** | the driver — condition → uniforms | `IN PROGRESS` |
| **4** | the bakes | `TODO` — ✅ priced 2026-08-05, no longer the unpriced risk |
| **5** | body-class coverage (rocky, giants, moons) | `TODO` — gated behind layer 0 |

⭐ **Layers 0/1 and layer 2 are independent parallel tracks** (`:210-212`) — 0/1 is pure data and needs
no renderer. Layer 3 is where they meet. **Layer 2 is already done**, so the shortest path to "all the
rendering in the game" runs **0 → 1 → 3 → 4 → 5**, and layer 0 is the front of it.

⛔ **Read before touching it:** `## Traps that have each cost real time` (`:852`) — *"a black frame is
indistinguishable from a clean negative control"*, *"a byte-identical string does not prove the page
still runs"* — and ⛔⛔ `## SOL CANNOT VALIDATE ANY OF THIS WORK` (`:884`).

---

## 2. B5 LANE — the state, if he picks it

**Plan of record: [`moon-formation-b5-build-plan-2026-08-19.md`](moon-formation-b5-build-plan-2026-08-19.md).**
Twelve commits. Do not re-derive it; it cost 14 agents and it has been verified. Its §10 is
working-Claude's own re-check and **corrects two of the synthesis's claims** — read §10 before
trusting §7's risk ranking.

Lane context lives in [`moon-formation-handoff-2026-08-18-b5.md`](moon-formation-handoff-2026-08-18-b5.md):
**§2 (the three invariants B5 must not unlearn), §3 (the deliberately-red literals), §12 (today's rulings).**

- ⛔ **The instruments are RED BY DESIGN.** ~32 tests fail at HEAD. This is expected, established by
  B4's prediction commit; B7 closes the window. **Do not report them as defects or "fix" them.**
- ▶ **Next commit is S0-b**, the 57/7 disjointness replacement — writable and provable **only before
  step 3**, because it is green now and red from step 3 on.
- ⛔ **The single most dangerous step is 4**, the `_generatePlanetMoon` merge. The build plan's §3 is a
  written contract for it. It must carry the `hashRng` entry point and `targetQ`, or every companion
  moves and the window's only exact prediction stops being checkable.

---

## 3. ⛔ WHAT I GOT WRONG THIS SESSION

1. ⭐⭐ **I shipped a citation-fence regression and closed a UAT without noticing.** `52031fd` (the
   barycentre render) added 82 net lines to `main.js` and shifted **36 symbol-anchored citations**
   across **8 files**. I flipped that workstream to Shipped having run the test battery *and* the
   conic-gl mutation gate — but **not `npm run check:instruments`**, which is where the citation fence
   lives and which would have caught it in one command. Found four commits later, by a workflow
   looking for something else. **Repaired at `905f77e`; fence is 423/0.**
   ⭐ **The lesson is the command, not the care:** `npm run check:instruments` before any ship flip.
2. **I built the orbit-line occlusion to green and Max rejected the premise.** Every AC passed, it
   measured working live, and it is reverted (`baa4935`). Not wasted — but the sequencing lesson is
   real: **it went from scoped to shipped without him seeing an intermediate.** A rough preview of the
   *look* would have surfaced the objection before the mutation gate ran.
3. **My occlusion test fixture was wrong twice before it was right** — I put the barycentre 1.15 units
   from the origin while giving its heliocentric ring radius 3388, then sampled a `5.3e-4` rad gap at a
   `1.7e-3` rad step and concluded there was no gap. Both are commented in the reverted test file with
   why. **A test that reports "feature absent" on a working feature is the expensive kind.**

---

## 4. TECHNIQUES THAT EARNED THEIR KEEP

- ⭐ **Prove a repair, don't heuristic it.** S0-a's 36 refs were repaired by taking each symbol's
  **ordinal** at the last-good commit and mapping it to HEAD — not by "nearest line carrying the
  symbol", which would have had 12 coin-flips. The tool's own warning is that a ref repaired to a
  second wrong line is *worse* than a stale one.
- ⭐ **Measure the predicate against live data before writing the shader.** The occlusion design was
  validated by running its exact CPU predicate over wd-10's real ring set — 1 of 14 foreign rings
  masked, the right one, `gap² = 0`; nearest false positive off by ~3e6 — *before* a line was written.
- ⭐ **Prove "my change reds nothing" by diffing failure SETS, not counts.** Stash only the changed
  `src` files, re-run, compare. ⚠ Strip the `NNms` timings from test names first or `comm` matches
  nothing and you will conclude the opposite.
- **Reload before every browser measurement.** Non-negotiable in this repo; see the b5 handoff §11.
- ⛔ **Verify the verifiers.** Across two workflows the refuters caught real fatal errors *and* were
  themselves wrong several times. Both layers need re-opening before acting.

---

## 5. STATE + GOTCHAS

- **Max is parked** in the live game at `http://localhost:5173/well-dipper/`, wd-10, planet 3
  (`Meameinath`), orbits on. Dev server runs from `~/projects/well-dipper` (pid was 2006011).
- ⛔ **Any `src` edit fires HMR into that page.** Reload before measuring anything there.
- ⛔ **`npm run check:conic-gl` needs the agent sandbox DISABLED** — Chrome cannot `socket()` inside
  it and the gate FATALs on launch, which looks exactly like a real failure.
- ⛔ **`_lab.resolveBody` ignores `planetIndex`/`starIndex`. The working keys are `p` and `m`.**
- ⛔ **A body reading BLACK is almost certainly camera PHASE, not a defect.**
- ⛔ **Sol cannot validate procgen.** Use `_lab.spawnProceduralSystem(seed)`.
- **Probe worktrees `~/wd-b5-probe` and `~/wd-b4-probe` still exist.** Remove when the lane ends.

---

## 6. SUGGESTED SKILLS

- **`dev-collab-scope`** — ⛔ required before code if he picks the world-engine lane; layer 0 spans
  generation ↔ port ↔ renderer. Also required for the star↔planet barycentre if that gets pulled in.
- **Workflow tool** — the lane's method, and Max asked for it by name. ⛔ Pin `model: 'opus'` on every
  agent; brief every agent with the **ACTUAL HEAD** and what already shipped.
- **`superpowers:verification-before-completion`** — §3 item 1 is exactly what it exists to prevent.
- **`superpowers:test-driven-development`** — every test in these lanes is proven by reverting the fix
  and confirming the *specific* assertions go red.
- **`superpowers:systematic-debugging`** — for anything that looks like a rendering defect.
- **`handoff`** at the next seam — ⛔ into `docs/FEATURES/`, never `/tmp`.

---

## 7. OPEN FOR MAX

1. ⭐⭐ **THE LANE CHOICE (§0).** *Rec: the world-engine lane, starting at layer 0.* Free to pivot now,
   expensive after B5 step 1, and layer 0 makes the B5 window safer to open later.
2. **Step 9's cap removal moves a render he UAT-passed** — `wd-234`'s pair resizes ~1.86×. Needs his
   eyes once it lands. (B5 lane only.)
3. **The 100 km small-moon threshold removes orbit rings from 49 moons that ship today** — a visible
   change to the current game, not only to C4's output. His eyes, at step 8. (B5 lane only.)
4. **Star↔planet barycentre** — filed, and he wants it *considered* before the rotor-fuel gravity-well
   minigame. `PARKING_LOT.md` + `FEATURES.md` GAME tier. Not now.
5. **Sol's masses** — filed; needs the B5 window CLOSED (post-B7) because
   `port-condition-contract.test.js` has no re-bless mechanism.
