# Handoff — Well Dipper. **C7 (Step 8b) IS SHIPPED, PUSHED AND ANSWERED.** ▶ NEXT = the world-engine deep dive.

**Date:** 2026-08-15 · **Repo:** `~/projects/well-dipper`, branch `feature/world-engine-production-L1`
**HEAD:** `1c08f16` · tracked tree **CLEAN** · **PUSHED and verified by `git ls-remote`** (not by push's output).
**All four instruments GREEN**, and back to their pre-C7 values: A 324 files / 5312 tests / **24 failed**
("every test ID is exactly where the baseline left it") · B **8/8** · C 526 bodies / **0 uniforms moved** ·
citations **401 CHECKED / 447 UNCHECKED / 0 UNRESOLVED**, exit 0.
(~700 untracked PNGs + `scratchpad/` are normal. ⛔ **Never `git add -A`.**)

> ⭐ **IN THE REPO ON PURPOSE.** Predecessors: [`step8-handoff-c7-2026-08-14.md`](step8-handoff-c7-2026-08-14.md)
> and [`step8-handoff-2026-08-14.md`](step8-handoff-2026-08-14.md). **Their §3–§6 working rules all still
> apply and are NOT repeated here.** Everything C7 measured is in
> [`step8b-c7-delta-table-2026-08-14.md`](step8b-c7-delta-table-2026-08-14.md) — do not re-derive it.

---

## ⛔ MAX'S PRIORITY, IN HIS OWN WORDS — and it moved this session

> *"What I care about is being able to use the systems that we created for world engine in the main
> well-dipper game. I want to make this as optimized and well-architected as possible."*

**New, 2026-08-15, and it sets the next session's agenda:**
> *"want to make a fix a priority as we continue to implement the world engine rendering system"*
> *"do a deep dive into the remainder of the implementation plan for world engine, and consider what
> other kinds of reconciliations like the one we just found will need to be planned/implemented"*

---

## 1. WHAT CLOSED — C7, in six commits. Read the commit messages; each carries its own evidence.

| commit | |
|---|---|
| `9ebb24b` | the delta table, measured pre-change, **committed one commit BEFORE the edit** |
| `4cee76a` | src — the universe change, isolated (`7c7`, 587→587 lines, **zero insertions**) |
| `ab173a3` | gate — draw-stream set re-derived; now the convention's only witness |
| `6fe87a5` | re-bless Instrument B |
| `a07b522` | re-record Instrument C |
| `1c08f16` | docs — four stale references repaired |

**Every predicted number held; nothing was adjusted to fit.** Instrument B returned exactly
`{systems 0, planets 7, plainMoons 0, planetClassMoons 24}` and the 7 draw-shifted seeds down to their
first-divergence yield indices. Instrument C moved exactly 65 fingerprints (64/64 P + 1/372 S + 0/90 G)
across 31 of 55 uniforms.

⭐ **Instrument A needed NO re-record.** The gate re-derivation and B's re-bless returned all four
newly-red tests to green. **The build plan's C8 assumed a 24 → 26 re-record; it was wrong.**

### ✅ MAX'S UAT — PASSED 2026-08-15, and he redirected the question
Parked on `wd-27/3/1` in the live game. His answer: *"yes? you would know better than me though in
terms of the sizes and what's realistic."* ⭐ **That is a correction worth keeping: I had asked him a
question he was not positioned to answer.** Physical plausibility is measurable and is MY job; his
eyes are the gate on whether it *looks* right, not on whether the physics is sane. The plausibility
check I then ran is §5 below, and it found a real defect.

---

## 2. ▶ NEXT — THE DEEP DIVE. START HERE.

**Two halves, in this order:**

### (a) Read the remainder of the world-engine implementation plan and say what is actually left
⛔ **The plan of record is in-repo, not in `~/briefings/`.** Start from
[`world-engine-INDEX.md`](world-engine-INDEX.md) §7 and
[`step8-build-plan-2026-08-12.md`](step8-build-plan-2026-08-12.md), then
[`lab-pipeline-into-game-PLAN.md`](lab-pipeline-into-game-PLAN.md) and
[`one-pipeline-two-frontends-PLAN.md`](one-pipeline-two-frontends-PLAN.md) (its §853 row is Step 8b's,
now repaired and carrying C7's measured figures).
⚠ **The build plan has been wrong three times in ways that shipped**: its 8b "universe change" call
(break B6), its `radiusEarth 0/400` safety control, and C8's Instrument-A assumption. **Treat its
declared blast radii as claims to re-measure, not as inputs.**

### (b) Hunt the bug family — this is the part Max asked for by name
[`world-engine-reconciliations-2026-08-15.md`](world-engine-reconciliations-2026-08-15.md) names the
family, files the first confirmed instance of its unfixed sub-shape, and carries a **6-row candidate
table with honest status flags** plus the audit method. **Read it before touching anything.**

The family, in one line: **a generation constant authored when the generator had no physics, never
revisited once physics arrived.** B7 RC2, B7 RC3 and C7 are all the *Sol-defaults* sub-shape and are
all fixed. The *authored-for-looks* sub-shape has **zero fixes so far**.

---

## 3. ⭐ WHAT MAX DECIDED THIS SESSION

1. **Push: approved.** `1c08f16` is on the remote. ⛔ Still confirm before every future push.
2. **File the moon-size finding: yes**, and *"make a fix a priority as we continue to implement the
   world engine rendering system."* ⚠ My recommendation had been to defer it until after Step 10's
   moon rendering so he looks at the change once; **he asked for it prioritised. Do not re-litigate,
   but the ordering question — before or after Step 10 — is still genuinely open and is his.**
3. **File/plan the range fix: yes.** Shape is in the reconciliations doc §3. ⛔ **The target value is
   a GAME-FEEL decision and is his** — physically honest is ~4–6× smaller planet-class moons, and
   they exist *because* a big moon is interesting to fly to. Do not pick it unilaterally.

---

## 4. ⛔ WHAT I GOT WRONG THIS SESSION

1. ⭐⭐ **I TOLD MAX THE DEV SERVER WAS NOT RUNNING. IT WAS.** I inherited that from the predecessor
   handoff's §6 instead of checking. `mcp__chrome-devtools__list_pages` answers it in one call and
   the page was live the whole time. **Check the live surface before quoting a handoff about it.**
2. ⭐ **A PROBE REPORTED `luminosity` NULL ON 221/221 SYSTEMS. IT WAS A WRONG PROPERTY PATH.**
   `sys.zones` on the returned object is **not** the `zones` built at `StarSystemGenerator.js:457`
   and passed to the generators. It was caught ONLY because it contradicted C7's already-verified
   temperature. This is the predecessor's trap 1 for the sixth time. **A confident, dramatic zero is
   a probe bug until proven otherwise — and this family's real bugs all LOOK like dramatic zeros.**
3. ⭐ **I FABRICATED A COMMIT SHA** in NOW.md before the commit existed, then hit it again when
   `--amend` rotated the sha. **A commit cannot contain its own hash — use a symbolic reference.**
   Every sha in NOW.md was afterwards verified against `git cat-file -e`.
4. **I dumped a full `takeSceneInventory()` into the tool result** — tens of KB for three numbers.
   Filter inside the `evaluate_script`, always.
5. I over-interpreted a 102° bounding-sphere reading as a possible atmosphere-halo defect. A single
   screenshot showed a normal body. **The reading was an interior shell's bounding sphere, not a
   visible extent.**

---

## 5. ⭐ THE TECHNIQUE THAT ANSWERED MAX'S QUESTION — reuse it

**VERIFY A PHYSICAL RESULT WITHOUT TRUSTING THE GENERATOR.** When Max asked whether 175 K on a
2.17 R⊕ moon was realistic, the answer did not come from any instrument in the tree. It came from
the star's **own habitable zone**: `wd-27`'s HZ is 520–750 AU, and 520.34/750.38 = 1.442, the same
ratio as the Sun's 0.95–1.37 AU — so the generator is scaling the standard HZ by √L, which puts the
star at ~3×10⁵ L☉ (Rigel/Deneb class). T ∝ r^−½ then makes that HZ span **261 K inner → 217 K
outer**, bracketing Earth's 255 K, and the parent at 1.72× the outer edge lands at 165.65 K. **The
generator's number was confirmed by a calculation that never read the generator.**

That same check is what exposed §2's defect: the temperature was right, and the SIZE was not.

Also carried forward, all still true and all still earning their keep:
**predict in writing before touching src, and commit the prediction FIRST**; **two harnesses, each
with a byte-identical control**; **line-count-neutral src edits**; **a re-bless is always its own
commit**; **mutate the PASSING gates**; **refuse any number without its corpus**; **pin
`model: 'opus'`**; **write commit messages to a file and `git commit -F`**.

⭐ **AND A NEW ONE: A REPAIRED CITATION MUST BE VERIFIED BY THE COUNTERS, NOT THE EXIT CODE.**
Re-quoting the whole new line of `:378` made the fence print *"all 400 citations resolve, Exit 0"* —
green and wrong. `tools/port-uniform-delta.mjs:1142` caps a symbol span at **110 characters**; the new
line is ~125, so the ref matched no symbol and was demoted into the 447-deep UNCHECKED pile where it
would have rotted forever. **CHECKED had gone 401 → 400 and nothing said so.** Anchor to a short
token, then confirm 401 / 447 / 0.

---

## 6. STILL OPEN — filed, measured, NOT done

1. ⭐ **Planet-class moons are binary planets** (7.1 % of parent mass). Reconciliations doc §2/§3.
   **Max wants this prioritised.**
2. `PlanetGenerator.js:368/372/373` use `||` where `MoonGenerator.js:248` documents `??` — the two
   generators disagree about whether a legitimate 0 is a value. **LATENT, unmeasured.**
3. Instrument A's baseline provenance: recorded from `952c5d0` with `dirty: true`; the instrument
   warns about it itself.
4. `tools/port-uniform-delta.mjs` prints *"the `bake`, `condition` and `gate` rows are unaffected"* —
   **false under C7**; 13 of 31 movers are non-record tier and read a hollow `0/461`.
5. Everything still open on 8a: the stale-rescale gate; `atmoPhysics.retained === false` unreached
   for planets across 6279; `ExoticOverlay.js` outside `CITE_SOURCES`; migrated planets carrying
   physics for an orbit they no longer occupy; composition-weighted greenhouse τ (`2ac8ea7`).
6. **QB-1** (terminator band), **QB-11** (crystal), **QB-12** (exotics) — Max deferred all three:
   *"We don't need to do that now."* ⚠ QB-1 is the **terminator gradient**, NOT the atmosphere.

---

## 7. STATE YOU NEED

- **Live game: it IS running** at `http://localhost:5173/well-dipper/` with chrome-devtools attached
  (see §4.1). **Check `list_pages` before assuming otherwise.** Healthy rAF is ~240 — measured 240.5
  this session. ⭐ **Max drives it** — *"you bring me where you want me to be."* Park him with
  `_lab.spawnProceduralSystem(seed)` then `_lab.frameBody({kind:'moon', p:N, m:M}, {radii:3.2})`
  **yourself**, then tell him to look.
- ⭐ `_lab.resolveBody({kind:'moon', p:3, m:1})` is the useful accessor — it returns `planetData`,
  `condition`, `mesh`, `isPlanetMoon`. `_lab.systemInfo()` is only `{name, hasPlanets, planetCount,
  destinationName}`. ⛔ `_lab.bodySurfaces()` is ~500 KB. **Filter inside `evaluate_script`.**
- ⭐ **`effect.starflare.<seed>` in the scene graph is objective proof of which seed is loaded.**
- **Corpora, three different things:** fence/Instrument B = **221 seeds** (961 planets, 770 plain +
  24 planet-class moons); moon contract = **197 seeds** / 705 plain; `port-condition-contract` =
  **120 `pcc-*` seeds** / 526 bodies; the stream gate = **1500 seeds**; Instrument C = **526 bodies**
  (372 S + 64 P + 90 G). ⛔ **Never quote a threshold from one against another.**
- ⛔ **Sol cannot validate procgen.** Master worktree is `~/projects/well-dipper-trunk`;
  `~/projects/well-dipper` is **lane A's branch, NOT master**. `git worktree list` before merging —
  9 legitimate project worktrees; a scratch one was created and removed this session.
- **Scratch in `$TMPDIR`**, but a probe importing a repo module must live at the repo root and be
  **deleted after**. Three were created and deleted this session; `ls probe-*.mjs` is the check.

## Suggested skills

- **`superpowers:verification-before-completion`** — §4.2. Every claim needs an executed control that
  MOVED *and* an instrumentation point proven to be measuring the thing.
- **`superpowers:systematic-debugging`** — the candidate table in the reconciliations doc is six
  hypotheses, not six findings.
- **`superpowers:brainstorming`** — §3's open question (narrow the moon range vs raise parent mass;
  before or after Step 10) is a design choice with game-feel stakes, and it is Max's.
- **Workflow tool** — C7's numbers came from a 13-agent workflow with two controlled harnesses. The
  deep dive is the same shape: broad read, then adversarial verification of each candidate.
- **`handoff`** at the next seam — ⛔ **into `docs/FEATURES/`, not `/tmp`.**

⛔ Do **not** invoke `library-context` reflexively; the SessionStart hook nags about a three.js brief
for an unrelated project (`gesar-app-skin`). This repo is on three.js **0.183.1**.
