# Handoff 2026-08-19 (evening) — ▶ **NEXT = STEP 10b/c. MOONS. It is unblocked.**

**HEAD:** `db1cf51` · **Branch:** `feature/world-engine-production-L1` · tracked tree **CLEAN**
**Repo:** `~/projects/well-dipper` · **3 commits unpushed** (`b7adc76`, `532d246`, `db1cf51`)

> ⭐ **~700 untracked PNGs and `scratchpad/` are normal. ⛔ NEVER `git add -A`.**
> ⛔ **Do NOT invoke `library-context`** — the SessionStart hook nags about a three.js brief for an
> unrelated project (`gesar-app-skin`). This repo pins three.js 0.183.1.

---

## 0. THE ONE THING TO DO

**Step 10b/c — moons render through the pipeline.** Max asked for it by name: *"We only got part way
through (haven't implemented moons yet) and I want to continue that too."*

Plan of record: [`one-pipeline-two-frontends-PLAN.md`](one-pipeline-two-frontends-PLAN.md) Step 10
(`:439`). ⛔ **Read §1 below before it** — a build agent verified every one of Step 10's own citations
against the tree and **three of them are wrong**. Trusting the PLAN's line numbers here costs a
session.

Everything Step 10 depends on has landed. There is no open decision in front of it.

---

## 1. ⛔ WHAT STEP 10's TEXT GETS WRONG — verified against the tree, 2026-08-19

| PLAN says | the tree says |
|---|---|
| widen the filter at `main.js:2424` | **That line is a COMMENT.** `main.js:2432` records that the walk moved into `_lab.bodySurfaces()`. The real gate is the **default** `ownerPrefix ?? 'body.planet.'` around `main.js:2933`, because `tryLabShader` calls the walk with no opts. Widen the default to `'body.'` |
| `BodyRenderer.createMoon` builds the lab material instead of `Moon.js`'s shader at `:217-254` | **`createMoon` builds no material at all** — it is a two-line factory. The material is built inside `new Moon(...)` in the else arm around `BodyRenderer.js:108-116`. And `Moon.js:217-254` is shadow-ray/normal-perturbation code; the generic simplex is `Moon.js:143-186` |
| keep the LOD registration at `main.js:6422` | **Wrong line, and nothing to do.** `lodManager.register` appears only at `main.js:7613` (planets) and `:7695` (all moons, hoisted out of the else arm 2026-08-11). Both moon kinds are already covered — leave it alone |
| `~571 plain moons` | Matches no corpus. **632** over `lab-procedural-0…199`; **770** over FENCE-221. Name the corpus with the number |

**Two more facts the next session should not re-derive:**

- ✅ **Sol is already excluded — do NOT write the test Step 10 asks for.** Measured: 0 of Sol's 25
  plain moons pass `worldEngineProvenance`, because `SolarSystemData.js` stamps `_systemSeed: 'sol'`.
  ⚠ There is a **stale ⛔ comment around `Planet.js:2122-2126`** claiming Step 10 *would* admit Sol's
  moons. Correct the comment; do not act on it.
- ✅ **The two unguarded frame-loop writes are already guarded** (`f3157c5`), which Step 10's own text
  says must happen first. Fence: `tests/moon-shadow-write-guard.test.js`, 12 cases with committed
  mutants. Verify in the tree, don't assume.

### The placement decision, which is not free

Nine readers consult `this._delegate.surface`. **Two of them — `BodyRenderer.js` around `:512`
`setShadowMoons` and `:526` `setShadowPlanets` — use `_delegate.surface?.material` with NO mesh
fallback.** Giving the Moon delegate a `.surface` wakes those on moons for the first time, writing
into a lab material that declares neither uniform. Their `?.` guards hold, so it is a silent no-op —
but prefer setting `.surface` on the **BodyRenderer** itself, which leaves all nine resolutions
unchanged. Whichever you pick, **assert the behaviour rather than reasoning about it.**

### What the moon branch must reproduce

`Planet._createLabSurface` (around `Planet.js:2018-2072`): `conditionFromBody(moonData)` →
`labPipelineAdmits` → `buildLabPlanetMaterial` → `applyDriverPacks` with `labPackCtx` → **and write
the `userData.wd` back-link in the same shape.** `grep userData src/objects/Moon.js` returns **zero**
today, so a plain moon is invisible to `_lab.resolveBody` and Instrument E would have nothing to
caption.

---

## 2. GATES — which work, which do not

⛔ **The moon window is OPEN.** Instruments A, B, C are RED BY DESIGN — 32 failing tests over a
blessed baseline of 24, opened at `34b502d` by the unrelated moon-formation program. **Do not report
them as defects, do not fix them, do not re-record any baseline.** B7 owns closing them.

⭐⭐ **THE ONLY ACCEPTABLE PROOF THAT A CHANGE BROKE NOTHING IS A FAILING-SET DIFF, NOT A COUNT.**
Reproduce the set at HEAD first, then compare `comm` in **both** directions. A count match with a
membership change is exactly what this rule exists against — it caught two real regressions today.

⭐ **THE CITATION FENCE LIES BY OMISSION.** `port-uniform-delta:citations` must stay exit 0, but
`0 BROKEN` proves *nothing on its own* — it cannot distinguish "every ref resolved" from "no ref was
read". **CHECKED is 512 at HEAD.** If you add a file to `CITE_SOURCES` the count MUST RISE; if you
edit a cited file, refs SHIFT. **Repair by locating the symbol, never by adding an offset.** Measured
today: appending 12 lines to `port-uniform-delta.mjs` rotted five refs that were all correct before;
a comment fix in `index.js` rotted nine more.

⛔ **ADDING AN IMPORT LINE AT THE TOP OF `Planet.js` SHIFTS ~24 LIVE CITATIONS.** Ride an existing
line (`9b` did exactly this) or repair them all in the same edit.

**Owed and NOT run** — none of these can be faked and none was approximated:
- **Instrument D**, Step 10's declared primary gate: ≥120 frames, zero uncaught exceptions, rAF
  advanced. Needs a browser. ⛔ Never `runIntegrationSuite` — it is the Sol-scoped scene inspector
  with no frame loop and no error listeners.
- **≥95% of plain moons resolve non-zero `uCraterDensity` with ≥20 DISTINCT values** (today 0 of 632).
  ⚠ A constant across 632 moons is a dead wire that a "≥95% non-zero" gate passes.
- **The per-class distinctness quad** — {rocky planet, gas giant, plain moon, planet-class moon} from
  one seed, addressed **by NAME** (Step 10 widens the walk's prefix, so every index shifts). Any two
  identical is the degenerate shared pipeline this step must not ship. **This is what P-13 landed
  for**; if it still fails, say so plainly rather than weakening the gate.

---

## 3. WHAT SHIPPED THIS SESSION — read the commit messages, they carry the evidence

| commit | |
|---|---|
| `f3157c5` | frame-loop guards — Step 10's stated prerequisite |
| `2e089b4` | `craterUniforms` exposes `Dchar`, so the rocky pack reaches the display-policy seam |
| `f65d2d3` | ledger: P-08 → accepted-loss, P-10 corrected, P-05 demoted from law-choice to wire |
| `b7adc76` | the three false docs in the next session's startup path |
| `532d246` | **Step 9a** — the `rockySurface` pack, UNREGISTERED |
| `db1cf51` | **Step 9b + P-13 + Step 10a** — swap, per-body noise offsets, registration |

### ⭐ The finding that matters most for whoever ships Step 12

`index.js` said *"Registration cannot move a body from the legacy material to the lab material."*
**True of the three gas entries, FALSE as of `db1cf51`.** `Planet.js:2197` feeds `packs.length > 0`
into the admission test, so a pack claiming bodies no other pack claimed **admits them**. Swapped
planets went **341 → 846**, and **188 newcomers lose a legacy branch** nothing yet rewrites — lava
52, ocean 6, venus 130 (ledger rows **R-05, R-06, R-07**).

⭐ **Not a live regression, and the reason is the flag rather than the pack:** `Planet.js:2158`
`LAB_GAS_BODIES_DEFAULT = false` is the first term of that same test. Nothing reaches a player until
Step 12 deletes the fallbacks. **It IS the trajectory Step 12 commits to.**

---

## 4. ⛔ WHAT I GOT WRONG THIS SESSION

1. ⭐⭐ **I nearly rebuilt a shipped subsystem, because a doc pointed me at a superseded plan.**
   `planet-lod-CHARTER.md` — which CLAUDE.md sends every planet-LOD session to FIRST — named
   `lab-pipeline-into-game-PLAN.md` as the plan of record. It was superseded on 2026-08-06 and its
   layer table read `TODO` for work that had shipped 13 days earlier. Fixed at `b7adc76`.
   **The lesson: `git log` outranks every document, and a doc that is WRONG is worse than one that is
   MISSING, because it reads as freshly verified.**
2. **I ran a scoping interview on already-scoped work.** Max: *"We have already scoped out/talked
   about this migration... Why are we relitigating this now??"* He was right. The plan was greenlit
   2026-08-06 with all five rulings answered, and its standing constraint 6 says *"if it can be
   decided from the above, decide it — do not ask."*
3. **I told Max three parity rows needed his ruling. Two did not.** P-08 was mis-ruled (I had
   `baseColor` as the ground palette; source says it is ocean/ice/cloud/band colour and the world
   engine's palette is bedrock). P-05's "two divergent aurora laws" turned out to share ring
   geometry and colour verbatim, and `uvFlux` — the only real difference — appears nowhere in
   `src/worldengine/`, so it is not choosable. **Investigate before escalating.**
4. **I invented a fourth ledger ruling and the ledger's own test caught me inside one run.** I
   re-ruled P-10 `deferred (Max, 2026-08-19)`; `material-parity-list.test.js` reddened: *illegal
   ruling*. **WHEN a blocking row gets fixed is SCHEDULING, not a fourth verdict.**
5. **I asserted the world-engine lane was blocked behind the moon window.** A verification workflow
   killed it: Instrument C prints its full delta table and *then* exits 2, and both A and C accept
   alternate baseline paths. Only the **DONE stamp** is blocked, not the building.

---

## 5. ⭐ TECHNIQUES THAT EARNED THEIR KEEP

- **Verify the agent's report, don't relay it.** Every workflow result this session was re-run by
  hand before commit. Two caught real gaps the agents missed — an unscanned `CITE_SOURCES` and a
  false `index.js` claim.
- **A green gate whose input set is empty is not a green gate.** The citation fence reported
  `424 CHECKED / 0 BROKEN` on the commit that introduced 76 unread refs. **Watch the CHECKED delta.**
- **Prove a repair, don't heuristic it.** Every shifted citation was repaired by locating the symbol
  and confirming it sits on the new line. A ref repaired to a second wrong line is worse than a
  stale one.
- **Halt rather than pile.** The Step 10b/c agent reported `proceed=false` instead of building on an
  unresolved delta. That was correct and saved a tangled diff.
- **Docs asserted by a TEST are the only ones that do not rot.** The parity ledger caught its own
  author within an hour; `doc-rot-check.sh` caught 0 of this session's 3 doc defects.

---

## 6. OPEN FOR MAX

1. ⭐ **Moons (Step 10b/c)** — greenlit and unblocked. Nothing waiting on him to start.
2. **R-05/R-06/R-07 scheduling** — venus banding on 130 bodies is the big one. Nothing renders until
   Step 12, but it is the trajectory he would be accepting. Reserved to him since 2026-08-09.
3. **Doc-rot triage, three items awaiting his go** (full plan came from a 5-agent read-only pass):
   - **Gate repairs**, ~30 min, 335 → ~92 flags: stop the false all-clear (the hook prints
     "doc-rot clean" one line after "flagged: 335"); exclude test files (137 of 304 are tests no
     README claims by convention); read `SYSTEMS.md`'s own table as a claim source; fix the
     broken-link counter (it increments a Python-local, never the shell's); use
     `git log -1 --format=%ct` not `stat -c %Y` (**mtime is not preserved by git — a fresh clone
     reports 0 stale flags on the same tree**).
   - **The citation sweep**, ~1 hr, new construction: **2,590 line-anchored refs across 199 docs**;
     the existing fence's allowlist covers 30 files. A spot-scan already found four refs pointing
     *past EOF*. The only proposed instrument that would have caught anything this session found.
   - **Two deep dives**: rewrite `SYSTEMS/worldengine/README.md` (says the engine is lab-only while
     `Planet.js` imports it in three places) and write `cockpit` (no row at all). Silence the rest.
     Side effect: `doc-graph.js` builds the wiring map from those lists, which is why a 369-file game
     renders as **three nodes**.
4. **P-10's km wavelength** — his ruling: give the base terrain field a characteristic wavelength in
   km, in the engine's established shape, **after moons ship**. Bring it to him **calibrated against
   real bodies**, not chosen mid-wiring. Reasoning is in the ledger's P-10 row.
5. **3 commits unpushed.** ⛔ Push with the sandbox DISABLED and verify with `git ls-remote` — this
   repo fails above ~10 MB in-sandbox and then lies with "Everything up-to-date".

---

## 7. STATE + GOTCHAS

- ⛔ **`_lab.resolveBody` ignores `planetIndex`/`starIndex`. The working keys are `p` and `m`.**
- ⛔ **A body reading BLACK is almost certainly camera PHASE, not a defect.**
- ⛔⛔ **Sol cannot validate procgen** — real NASA textures, a different renderer, no condition
  fields. Use `_lab.spawnProceduralSystem(seed)`. ⭐ Sol IS legitimate for measuring a **pure
  function's output** (Step 9b used it that way) — never let that become a rendering claim.
- ⛔ **Check `localStorage['wd.labGasBodies']` before quoting ANY game-vs-lab comparison.** A flag-ON
  measurement of "the game" is the lab material wearing the game's scene graph. It has produced a
  wrong finding in this program before.
- ⛔ **Reload before every browser measurement.** HMR-duplicated module state has faked a stable,
  reproducible defect that survived four respawns.
- ⛔ **`npm run check:conic-gl` needs the agent sandbox DISABLED** — Chrome cannot `socket()` inside
  it and the gate FATALs on launch, which looks exactly like a real failure.
- ⛔ **Never quote `planet-lod-lab.html:5358` verbatim** in any file under `src/worldengine/**` —
  `tests/vis-scale-fence.test.js` sweeps RAW TEXT including comments for the display-scale token.
- **Probe worktrees `~/wd-b5-probe` and `~/wd-b4-probe` still exist.** Remove when the B5 lane ends.

---

## 8. SUGGESTED SKILLS

- **Workflow tool** — the lane's method and Max asked for it by name (*"continue via workflows"*).
  ⛔ Pin `model: 'opus'` on every agent; brief each with the **ACTUAL HEAD** and what already shipped.
  Working scripts to adapt live in this session's scratchpad — the shape that worked is
  *build sequentially → hostile review lenses in parallel → confirm-or-kill each finding → repair
  only what survives*, with a `proceed` flag so a failed stage halts the chain.
- **`superpowers:verification-before-completion`** — §4 items 1 and 4 are what it exists to prevent.
- **`superpowers:test-driven-development`** — every gate here is proven by reverting the fix and
  confirming the *specific* assertions go red. `f3157c5` is the worked example.
- **`superpowers:systematic-debugging`** — for anything that looks like a rendering defect.
- ⛔ **`dev-collab-scope` is NOT needed for Step 10.** It is already scoped in the greenlit plan;
  invoking it is the mistake §4 item 2 records.
- **`handoff`** at the next seam — ⛔ into `docs/FEATURES/`, never `/tmp`.
