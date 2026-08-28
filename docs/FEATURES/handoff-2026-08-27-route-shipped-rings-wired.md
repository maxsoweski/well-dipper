# Handoff 2026-08-27 — ▶ ROUTE SHIPPED · RINGS WIRED · NEXT IS INSTRUMENT B's +27 MOONS

**HEAD** `75bc8fa` · **Branch** `feature/world-engine-production-L1` · **4 commits UNPUSHED**
**Repo** `~/projects/well-dipper` (lane A's branch, **NOT** master) · lab is `world-engine-lab.html`
⛔ **~700 untracked PNGs are normal. NEVER `git add -A` at the repo root.**

> ⚠ **`/tmp` DOES NOT SURVIVE A WSL RESTART** — it cost a session on 2026-08-25, which is why this
> lives in-repo despite the handoff skill saying otherwise. Read this copy.

---

## 0. STATE — 23 commits this session, 19 pushed, 4 not

⛔ **PUSH THE LAST 4 FIRST** (Max grants push explicitly, per-branch; he granted it four times today).
`git push origin feature/world-engine-production-L1` — sandbox OFF, then verify with `git ls-remote`.
⛔ **NEVER push `master`** — it auto-deploys.

**Instruments at HEAD:**
| instrument | state |
|---|---|
| `port-uniform-delta:citations` | ✅ **848/848 resolve** |
| `tests/one-pipeline-fence.test.js` | ✅ **31 pass** — the import-back ledger is at **ZERO** |
| `test:body-identity` (Instrument B) | ⛔ **3 RED** — ▶ **this is the next job, see §2** |
| `port-uniform-delta:check` (Instrument C) | ⚙️ alive again, exits 2 on a structural break — expected, see §2 |
| full suite `npx vitest run --dir tests` | 9 failing files = the standing baseline |

⚠ **ALWAYS `npx vitest run --dir tests`.** Without `--dir tests` vitest also globs a stale copy under
`.claude/worktrees/wf_440dc97c-63b-4/` and **doubles every count**.

---

## 1. WHAT SHIPPED — do not re-derive

Four things, each with its own record. Read the record, not the code, first.

1. **The shared driver route — `one-route-shared-driver-path` is SHIPPED, Max UAT-closed it** (*"looks
   the same"* — invisible was the pass). `IMPORT_BACK_DEBT` **13 → 0**. Record:
   `docs/WORKSTREAMS/one-route-shared-driver-path/AC5c-*.md` and `AC5d-ledger-to-zero.md`.
   ⚠ **The row's text asked for more than was delivered and the ledger says so where the row used to
   be**: the lab still calls each pack individually; what is single-homed is the *applicability law*.
   A single composition point is architecturally unavailable — two mirrors have mutually
   unsatisfiable positions, three call sites are not in `applyDrivers` at all, and three different
   condition vectors feed the eight.
2. **The crater path CONVERGED** — one shared source, both front-ends. Max UAT-closed it. Record:
   `AC5c-crater-path-convergence.md`. Two of the three "deliberate divergences" turned out not to be
   divergences; the header concealed a fourth it did not list.
3. **F51 rings WIRED, both halves** — `src/worldengine/shaders/ringRelief.glsl.js` is the one ring
   program and both front-ends splice it. The game's `sin(t*30.0)` is gone. Rings also gained
   **resonance gaps for the first time** (`deriveRingStructure`, re-derived once moons exist, drawing
   zero new random numbers). 9 of 33 rings now have divisions.
4. **Instrument C revived** — it had been dead since `b0c0cda` and the handoff I inherited said it was
   repaired. See §3, which is the most important thing in this document.

---

## 2. ▶ NEXT WORK, IN ORDER — the plan is written, follow it

⭐ **The plan of record is `docs/FEATURES/instrument-c-and-noisescale-2026-08-27.md`.** It is a
6-agent workflow's output: ordered steps, exact edits by symbol, hazards, and an explicit
"what must NOT be done". **Read it before touching `tools/port-uniform-delta.mjs`.**

### 2a. ⛔ FIRST — Instrument B's +27 moons. Everything else is blocked behind it.

`npx vitest run --dir tests tests/body-identity-fence.test.js` → **3 failed**:
- `DRAW STREAM: draw profile moved on 28 seed(s)`
- `BODY IDENTITY: moons 821 vs a baseline of 794` — **+27 moons, unexplained**
- `RECORD SHAPE: planetClass records 24 → 51`

⚠ **This is NOT mine and NOT new** — the handoff I inherited already recorded it as pre-existing
(another lane's binary-companion moon-generation change). But it is now **load-bearing**: it is the
source of Instrument C's 41-body population mismatch, and **re-recording C's baseline while B is red
would freeze a population B rejects.** The tool prints that warning itself.

**Either explain and re-bless (`npm run test:body-identity:rebless`) or fix. Then and only then**
proceed to 2b.

### 2b. Instrument C — re-tier, fix the headline, re-record

Three ordered edits, all line-neutral, all specified in the plan doc:
1. **Re-tier `uNoiseScale` `'record'` → `'condition'`** (`tools/port-uniform-delta.mjs:705`). The
   cited legacy branch is dead for admitted bodies since B7. Tiering it `'record'` put it on the
   "NOT evidence of stability" caveat list *while it was the one row that moved* — the caveat and the
   finding contradicted each other on the same page.
2. **Fix the headline bug at `:1933`** — it prints the *first* uniform's population (232) instead of
   the max (592), which is why my report to Max understated the corpus.
3. **Re-record at a clean commit**, in a commit naming all three moves.

### 2c. Harden Instrument C so it fails loudly — Max approved this

Today an unclassified uniform makes `resolveSharedUniforms` **throw and exit 1** — the *same* code
the tool uses for "shipped uniforms moved". **A dead instrument and a firing one are
indistinguishable from outside.** It has happened twice (`uProvinceWeight` 2026-08-25, `uCoarseCut`
in `b0c0cda`, found today). ⚠ And the completeness fence at `:596-606` does **not** catch it: it
folds `nameMatched` in wholesale with no `TIER_BY_NAME` membership test, so a new uniform passes the
loud fence and dies four lines later on a bare throw.

Design + exact edits in the plan doc: drop the untiered name, record it in `RES.untiered`, print a
banner, compare the other 55 rows normally, **new exit code 4** for "coverage gap".

### 2d. ▶ THEN the real lab/game divergence — `world-engine-lab.html:5359`

⭐ **This is the actual converge job, and Instrument C cannot see it.** That one line carries both:
```
uniforms.uNoiseScale.value = (state.abNoiseScale && state._abNoiseScaleGame > 0) ? state._abNoiseScaleGame : 4.0;
uniforms.uCoarseCut.value  = state.abNoiseScale ? (state._abCoarseCut || 0) : 0.0;
```
`state.abNoiseScale` is the bare `[N]` key, **default off, no localStorage** (`grep -c localStorage
world-engine-lab.html` = 0). So **by default the lab writes `4.0` where the game writes `2.8736`** —
**1.392× apart on terrain feature frequency, on every non-gas body.** Under Max's converge ruling
this is debt. Needs his eye on the `[N]` A/B, then the losing arm deleted.
⛔ Do not bundle with 2b/2c — this one moves lab pixels; those do not.

---

## 3. ⛔⛔ THE THING TO READ TWICE — I reported a finding that was WRONG

I told Max Instrument C had found *"a real lab/game difference in terrain noise scale on 133
planets"* and recommended chasing it. **Instrument C never differences the lab against the game.**
Its own header says so at `tools/port-uniform-delta.mjs:24-30`: *"EVERY comparison this tool makes is
SAME-TREE-BEFORE vs SAME-TREE-AFTER … It is NEVER lab-vs-game."*

The 133-body move is the **game measured against its own five-day-old baseline**, and it is
**correct by design** — `b0c0cda` deliberately moved the tidal term from frequency to amplitude.

⭐ **It was caught because I put a lens in the workflow whose only job was to kill my own finding.**
Do that again. The refutation was worth more than the investigation.

⛔ **NEVER CITE INSTRUMENT C IN A CONVERGE ARGUMENT.** The tools that answer converge questions are
`tests/one-pipeline-fence.test.js` and the lab's A/B keys.

---

## 4. ⛔ TRAPS THAT BIT TODAY — every one cost real time

1. ⛔⛔ **THE APPEND-PAST-A-COMMENT TRAP BIT ME TWICE, in two different files, and every headless gate
   stayed GREEN both times.** A statement appended after a `//` on a line is dead code.
   - In `tests/lab-surface-ratchet.test.js` the entry landed at column 665 past a `//` at 309 —
     **inside the very comment that says "APPENDED ON THIS LINE, NOT INSERTED."** It means append to
     the *statements*, before the first `//`; it is not about avoiding a new line only.
   - In `src/generation/StarSystemGenerator.js` the whole ring re-derivation landed dead. **The
     corpus diff read "no change", which is exactly what a correct no-op looks like.** It was caught
     ONLY because a probe written earlier predicted 9 rings would gain gaps and 0 did.
   ⭐ **Lesson: have a predicted number before you make an output-identical change.**
2. ⛔ **A `git add` path glob silently shipped half a feature.** I committed F51 with
   `git add -A src/ tests/ docs/` — `world-engine-lab.html` is at the **repo root** and matched none
   of them. The commit message claimed both front-ends were wired; only the game was. **No gate can
   catch this: the fences read the working tree, so everything was green on a file never committed.**
   Verify with `git status` after committing, not before.
3. ⛔ **The lab died on page load twice with every gate green** — `ringInnerR`/`ringOuterR` defined
   inside a block I neutralised, and `sunDir` never existed (the lab's light is `WORLD_LIGHT`).
   **Loading the page is the only thing that finds this class.**
4. ⛔ **NEVER mutate a live scene object to hold state for a screenshot.** I used
   `Object.defineProperty(ring, 'visible', {writable:false})`; the render loop assigns it every frame,
   threw, and the lab went black. **Max saw it and reported a false defect against working code.**
   Use the app's own controls (`state.ringsEnabled`, `frameBody`), and reload before handing over.
5. ⚠ **Check the right instrument.** `gl.readPixels` returned 0% non-black on a plainly-rendering
   canvas (no `preserveDrawingBuffer`); the screenshot showed the planet. And I concluded "the
   particle cloud never culls" from `mesh.visible`, when that cloud fades **per-particle in its
   shader** and never touches `.visible`.
6. ⚠ **`setPreset` with a wrong name silently does the wrong thing.** I measured five presets before
   noticing three of the names did not exist. Real names live in `driver-presets.js` —
   `Gas giant (Jovian)`, `Rocky (Earthlike)`, `Venus (sulfuric shroud)`, `Moon/Mercury (impact-airless)`.
7. ⛔ **Deleting a block from a line-cited file is hostile.** Removing the game's 132-line ring broke
   **183 citations, 53 ambiguously**. The repo's own convention is **NEUTRALISE IN PLACE** — keep the
   old text as a comment, stay line-neutral. `Planet.js` is cited to :2251, the lab to 500+ past :1933.

---

## 5. WORKING WITH MAX

⭐⭐ **HE RE-FRAMES BETTER THAN THE DIAGNOSIS, AGAIN.** Every turn today came from him:
*"we can't shoestring everything together"* (killed a plan that would have built a third parallel
ring); *"we need to converge; I need to be able to stop saying this"* (overruled my recommendation to
declare a divergence permanent); *"the ring looks very thick, almost more like a planetary accretion
disk"* (a vague open item of mine became a measurable defect); *"can we get down to meter scale?"*
(raised the bar rather than accepting the flat disc).

⛔ **DO NOT ASK HIM TO ARBITRATE AN INTERNAL REFACTOR.** Asked whether a partial convergence was
acceptable, he said *"dunno what the context for this and so don't really understand the tradeoffs."*
That question was my vocabulary and had no visible consequence for him. Either decide it and say so,
or phrase it in terms of **what he would SEE differ**.

⭐ **Wiring outranks feature work, in his words:** *"all of these do not need to be implemented before
we get things wired up. Part of the reason to wire up all the rendering tech here is that as we
continue to experiment and add new features, they'll be implemented into the game seamlessly and
quickly."* When a real visual defect surfaces mid-wiring: **a backlog row in his words, not a detour.**

⛔ Read `feedback_director-level-recaps` **IN FULL** before any end-of-turn summary. **CUT TEST:**
delete everything above the asks — do they still stand alone?

⭐ **Commit at seams without asking. Confirm before `git push`.**

---

## 6. OPEN FOR MAX — carried forward, all logged

| item | where | state |
|---|---|---|
| Metre-scale ring thickness *"with some LOD magic"* | **QB-19**, `mvp-spine-lab-quality-backlog.md` | ⭐ his target; needs its own measurement pass, aspect ratio ~3e-8 makes it a LOD problem not a slider |
| Gas giant: spot not blending · earth-like cloud shader over the bands · *"ink in water"* complexity | **QB-16/17/18** | logged in his words, queued behind wiring on his own ruling |
| The two ring LOD tiers overlap ~10→35 body radii | **QB-19** | diagnosed: the volumetric look is the 400k-point cloud, not the disc |
| `[E]` ejecta family A/B | prior handoff | still an open preference call |

---

## Suggested skills

- **`superpowers:systematic-debugging`** — ⭐ for 2a. Instrument B's +27 moons are unexplained and
  the temptation is to re-bless without root cause. Re-blessing an unexplained population is how a
  baseline becomes fiction.
- **`superpowers:verification-before-completion`** — every claim today that turned out wrong was one
  I had not probed: the dead code with a green suite, the half-committed feature, the "lab/game"
  drift that was never lab-vs-game.
- **`dev-collab-scope`** — for 2d (the `:5359` gate). It moves lab pixels and needs Max's eye, so it
  wants `intent.md` + `contract.json`, not an inline fix.
- ⛔ **NOT `brainstorming`** for 2a–2c. The plan is already written and adversarially verified;
  re-deriving it would discard six agents' work.

## Not in scope

The rings-v2 particle cloud (QB-19), the 48 still-unwired lab features (the long game — the F1–F53
checklist in `one-pipeline-two-frontends-PLAN.md` §3 is the source of truth, now **5 of 53**), and
anything under `src/worldengine/` that the `vis-scale-fence` bans a display-scale token from.
