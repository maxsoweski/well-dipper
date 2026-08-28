# Handoff 2026-08-28 — ▶ INSTRUMENTS CLOSED · STORM BAKE SHIPPED + UAT-CLOSED · NEXT IS THE PROVINCE CUBE

**Branch** `feature/world-engine-production-L1` · **Repo** `~/projects/well-dipper` (lane A's branch, **NOT** master)
**HEAD at writing** `e2589a3`, all pushed · lab is `world-engine-lab.html`, game is `index.html`
⛔ **~700 untracked PNGs are normal. NEVER `git add -A` at the repo root.**

> ⚠ **`/tmp` DOES NOT SURVIVE A WSL RESTART** — it cost a session on 2026-08-25, which is why this
> lives in-repo despite the handoff skill saying otherwise. Read this copy.

---

## 0. STATE

| instrument | state |
|---|---|
| **B** `test:body-identity` | ✅ **8/8** — re-blessed `b7630e1`, first green since 2026-08-18 |
| **C** `port-uniform-delta:check` | ✅ **exit 0**, zero delta over 633 bodies × 57 uniforms — re-recorded `3c1700c` |
| **C** citation fence | ✅ **850/850** |
| **A** `test:baseline` | ⛔ RED, 20 tests / 8 files — **all other lanes** (LOD ramp, camera API, port-condition-contract). Not ours, do not re-bless. |
| full suite | **8 failing files / 20 tests = the standing baseline.** Anything else is a regression. |

⚠ **ALWAYS `npx vitest run --dir tests`.** Without `--dir tests` vitest also globs a stale copy under
`.claude/worktrees/wf_440dc97c-63b-4/` and **doubles every count**.

⭐ **Wiring headline: 13 of 53 (24.5%)**, enumerated by F-id in
`one-pipeline-two-frontends-PLAN.md:121` — complete F2, F22, F23, F24, F25, F29, F34, F51; partial
F3, F31b, F35, F53. It read `4 of 53` this morning. **Most of that jump was the map catching up with
the tree, not new code** — see §1.

---

## 1. WHAT SHIPPED — read the commit, not the code

Five commits. Each carries its own full record; do not re-derive.

1. **`dca9891` — the lab converged onto the game's terrain law.** Max ruled arm B of the `[N]` A/B
   (*"tidal flattens the landform … as i understand it's physically correct also"*), so arm A was
   **deleted**, not parked. `state.abNoiseScale` now has zero writers.
2. **`87c017a` + `3461481` — the map was wrong in three directions.** F22/F23/F29 were **already
   wired** and only their rows were stale (they reach the game through the pack registry and the
   shared uniform bag, so a grep of `Planet.js` says "absent"). F51 rings had landed unrecorded.
   And **queue (a) was empty**: `PLAN.md:131` listed F3 as buildable while `:133` correctly called it
   degenerate — two lines apart, and `:131` is the line a build session reads first.
3. **`c79e34e` — the `aStorm` bake. One absent attribute held three feature rows dead.**
   F24/F25/F31b all multiply their output by `clamp(wStorm,0,1)`; `giantDeckPack` never baked the
   mask. Measured: `aBand`/`aShear`/`aMush` non-zero on **124 of 124** gas bodies, `aStorm` **ABSENT
   on 124 of 124**. After: present on 124/124, non-zero on 91 — and **the 33 all-zero are all
   venus-class**, exactly the bodies `polarDeck` does not claim. Physics, not a gap.
   ✅ **UAT CLOSED same day.** Max, on an in-game A/B (same body, same camera, mask live vs zeroed):
   *"the gas giant looks good to me. It looks kind of like a Neptune type planet."*
4. **`e2589a3` — P7 parked** in `docs/PARKING_LOT.md`. See §3.

---

## 2. ▶ NEXT WORK

### 2a. The province cube — `uCratonColor`, the last queue-(b) item with a clear shape

Max greenlit this lane. `uCratonColor` is read at `planetShaders.glsl.js:573` inside
`if (provSum > 0.001)` (`:569`), where `provSum` sums `sampleProvince(vObjN)` from `:566`. The game
binds a **1×1 opaque-black placeholder** (`LabPlanetMaterial.js:84`, created at `:127`, and `:122-126`
says outright *"The game never runs that route, so they never exist"*). The producer is lab-only
(`planet-lod-rivers.js:1621`, bound at `world-engine-lab.html:2921`) and **zero files under `src/`
import `createRiverOverlay`**.

⚠ **`planet-lod-rivers.js` imports `three` and `ConvexHull`.** `PLAN.md:576` records this as an
**unresolved architecture decision**: *does `src/worldengine/` admit a three.js dependency, or do
GPU-coupled bakers land under `src/rendering/bake/`?* **That decision is a prerequisite, not a
detail** — settle it (it is a technical call, so decide it and tell Max) before writing code.

**Predicted number to have BEFORE the change** (trap 3): `uCratonColor`'s read is gated on
`provSum > 0.001` and the placeholder is opaque black, so `provSum ≡ 0` today. The number that must
move is the count of admitted solid bodies where `provSum > 0.001` — **0 → N**. Get N from a probe
first, exactly as the ring work predicted "9 of 33" before wiring.

### 2b. ⭐ THREE SCOPING QUESTIONS MAX RAISED — he asked for these to be worked **via workflows**

He raised all three at the end of 2026-08-28, in the context of travelling and steering by Remote
Control. **These are scoping/reconnaissance jobs, not builds.** His words:

> *"can we make changes to the main game incrementally, of course, um, with tests baked in? And can
> we scope some improvements to the mobile version of the game that uses the orrery mode? That way I
> could test specific functions. Also, is there some way for us to work out some functions such that
> you could give me a URL that I could access remotely that would open the game and load in
> automatically to a specific system?"*

1. **Incremental game changes with tests baked in.** What the shape of a safe, small, test-covered
   change to `src/main.js` / `src/objects/Planet.js` actually is, given both files are line-cited
   (Planet.js to :2251) and `main.js` is 13,000+ lines. There is real prior art to survey:
   `dev-collab-scope` + the `verify-workstream` workflow already exist for exactly this.
2. **Mobile / ORRERY mode improvements, scoped so he can test specific functions from a phone.**
   The game's landing screen offers **ORRERY** (*"watch & plan — god's-eye overview"*) and **HELM**
   (*"take the ship — pilot & free-look"*). ORRERY is the non-piloting mode and therefore the one
   that survives a touch screen. There is an existing mobile dock in `main.js` (the speed-dial the
   2026-08-01 merge fought over). ⭐ **This is the highest-leverage of the three**, because it
   attacks the constraint named in §5 below: today he cannot judge anything that needs motion while
   away from his desk.
3. **A deep-link URL that opens the game on a specific system.** The hooks already exist —
   `_lab.spawnProceduralSystem(seed)` works from the console today and I drove it this session. The
   job is a URL parameter route (`?system=<seed>`) plus whatever splash/title bypass it needs
   (`spawnProceduralSystem` already handles `splashActive || titleScreenActive`). ⚠ It must work on
   **`welldipper.maxsoweski.com`**, not just localhost — see `well-dipper-hosting-domain` memory; the
   mode-dependent Vite base and `public/CNAME` are load-bearing.

⛔ **Do NOT build these in the same pass as 2a.** Max asked for them to be *figured out via
workflows* alongside the province-cube lane, i.e. reconnaissance in parallel with a build, which is
the hybrid shape that worked today.

---

## 3. ⛔⛔ THE THING TO READ TWICE — a "one-line fix" whose cost is two instrument re-blesses

`ExoticOverlay.js:401` replaces `planetEntry.planetData` and never re-applies the
`_systemSeed`/`_ordinal` stamped at `StarSystemGenerator.js:566-567`. **5 of 800 planets** (seeds
1–200, all `crystal`) carry no provenance and are refused the shared pipeline.

Max cleared the visual risk (*"Crystal types are not yet developed enough to worry about"*), so I
went to land it **and measured the blast radius first**:

> The tree holds exactly **two** `planetData` key-sets — **795 records at 36 keys and 5 at 34**,
> differing by exactly `_systemSeed` and `_ordinal`. Re-stamping **collapses two shapes into one**,
> so Instrument B reds on RECORD SHAPE *and* BODY IDENTITY, and Instrument C reds structurally.

The workflow's own plan asserted *"A and B unaffected"*. **It was wrong, and only measuring caught
it.** Parked as **P7** in `docs/PARKING_LOT.md` — pull it bundled with the next B/C re-bless that is
happening anyway. ⚠ P7 also records that
`moon-formation-b4-prediction-2026-08-17.md` §8.7 trap 1 **depends on the bug**: it states
`selectsBinaryCompanion` cannot be re-evaluated against `generate()`'s output *because* of this
strip. Read §8.7 before fixing it.

---

## 4. ⛔ TRAPS THAT BIT TODAY

1. ⛔⛔ **TWO OF MY OWN PROBES WERE VACUOUS AND I NEARLY REPORTED BOTH.**
   - Reading `aStorm` with `mesh: null` said "ABSENT on 91 of 91" — **but so was `aBand`**, which is
     live. No mesh, no bake, both read identical.
   - The polar probe threw on a missing `macroSeed` and would have read as "the pack produces
     nothing".
   ⭐ **What made the third reading evidence: the SAME call returned `aBand`/`aShear`/`aMush`
   non-zero while reporting `aStorm` absent.** A zero is not a measurement until something in the
   same call proves the instrument could have seen a non-zero.
2. ⛔ **A dev API answered `ok: true` five times for five different questions.**
   `_lab.frameBody({planet: N})` framed the *same* body for N = 0…4. **Not a defect — my error.**
   The index keys are `{kind, p, m}`; `{planet: N}` is unaddressed, so it legitimately falls back to
   the default, and `resolvedBy: 'default'` said so in the return value I did not read. The guard is
   `src/util/lab-subject.js:62`. **Read `resolvedBy` on every `frameBody` result.**
   Same family: `_lab.frameBody(2.2)` is a silent no-op — the signature is `(subject, opts)` and the
   radii live at `opts.radii`.
3. ⛔ **A stale in-code note nearly sent Max to judge against a dead law.** `world-engine-lab.html:5566`
   claimed the `[N]` A/B moved three presets by 40–110×; that was measured 2026-08-25 and died the
   next day when `b0c0cda` moved the tidal term out of the frequency. Re-measured live: **1.392× on
   all 13 non-gas presets, radius-independent.** Corrected at `5b84b4d`.
4. ⚠ **Four written fences said `aStorm` stays zero-filled** (`giantDeck.js:310-312`, `PLAN.md:575`,
   and two test files). All four were **converted, not deleted**, each keeping its old text as a
   `WAS:` record. The strongest now asserts the opposite of what it did — it required every value be
   0 and now requires the array to vary.

---

## 5. WORKING WITH MAX

⭐⭐ **HE RE-SCOPES BETTER THAN THE PLAN, AGAIN.** *"There must be a feature development backlog you
can park this in rather than carrying it in session memory"* — said when I had been re-raising QB-19
in the open-items block every single turn. **QB-19 was already fully parked** in
`mvp-spine-lab-quality-backlog.md:60` with his own words and the diagnosis. Check the backlog before
carrying anything.

⭐ **THE REMOTE-CONTROL CONSTRAINT, and it now shapes what work is even schedulable.** He steers from
his phone via Remote Control and is travelling. Two lanes:
- **Judgeable from a still** — pattern questions (band structure, colour, landform shape, a term
  present or absent). Push them with **`SendUserFile`**; verified working this session, and he
  confirmed: *"the two shots do read clearly on my phone."* The format that worked was **one variable,
  same body, same camera, two images** — plus a caption naming which is which.
- **Needs his hands on the keys** — anything with MOTION in it (`feedback_showcase-by-parking-the-live-game`).
  Ring thickness, the `[E]` ejecta call, "does it feel right while flying". **Batch these; do not
  send a still that cannot answer the question.**
⭐ For approach-dependent properties, the untested middle option is a **stepped-approach strip**
(stills at 20/10/6/3/2 body radii in one image). Offered, not yet used.

⛔ **Never promise work between his messages** (`feedback_no-false-overnight-promises`).

⛔ Read `feedback_director-level-recaps` **IN FULL** before any end-of-turn summary. **CUT TEST:**
delete everything above the asks — do they still stand alone?

⭐ **Commit at seams without asking. Confirm before `git push`** — he grants it per-branch, and did so
four times today. Push with the sandbox OFF, then verify with `git ls-remote`. ⛔ **NEVER push
`master`** — it auto-deploys.

---

## 6. OPEN FOR MAX

| item | where | state |
|---|---|---|
| Metre-scale ring thickness *"with some LOD magic"* | **QB-19**, `mvp-spine-lab-quality-backlog.md:60` | his target; parked, fully recorded, **needs its own measurement pass**. Do not re-raise per-turn. |
| Gas giant: spot not blending · earth-like cloud over the bands · *"ink in water"* | **QB-16/17/18** | logged in his words, queued behind wiring on his own ruling |
| `[E]` ejecta family A/B | prior handoff | still an open preference call — **needs motion, batch it** |
| P7 ExoticOverlay provenance | `PARKING_LOT.md` | deferred on cost; bundle with the next B/C re-bless |

---

## Suggested skills

- **`superpowers:verification-before-completion`** — ⭐ the single highest-value one for this lane.
  Every claim that turned out wrong today was one I had not probed, and two of my own probes were
  vacuous in the same way the repo's own notes had already recorded.
- **`dev-collab-scope`** — for 2b item 2 (mobile/ORRERY). It is a multi-system feature and it is
  exactly what the skill's threshold is for.
- **Workflow** for 2b — Max asked for these *by name* (*"figure out via workflows"*), which is the
  explicit opt-in. Shape that worked today: **sonnet finders → opus refuters → opus synthesis**, with
  each refuter's only job being to KILL its finder's claim. Three of four recons were refuted and the
  refutations were worth more than the surveys. ⛔ Pin `model` on every `agent()` call
  (`feedback_subagent-model`). ⛔ Keep workflows **read-only**; the two big files are line-cited and
  parallel edits would manufacture the exact failures this session cleaned up.
- ⛔ **NOT `brainstorming`** for 2a — the province-cube shape is already measured and written above.

## Not in scope

The rings-v2 particle cloud (QB-19), Instrument A's 20 standing failures (other lanes), the F31a/c/d/e/f
cloud variants, and F3's ray system — **F3 is queue (c) and cannot be measured through the renderer**:
`planetData.atmosphere` is falsy on **0 of 800** planets, so `uRayBrightness ≡ 0` and
`height.glsl.js:2191` returns before any pixel. Un-degenerating it is world-gen work nobody has scoped.
