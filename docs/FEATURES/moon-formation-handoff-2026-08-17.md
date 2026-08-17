# Handoff — the moon-formation lane. ▶ NEXT = binary-planet scoping, then B4, then B5.

**Date:** 2026-08-17 · **Repo:** `~/projects/well-dipper`, branch `feature/world-engine-production-L1`
**HEAD:** `1a9cc4c` · tracked tree **CLEAN** · ⛔ **17 commits UNPUSHED — Max has not been asked yet.**
**All four instruments GREEN, exit 0.** Current baselines, which are NOT the ones the predecessor
handoff quotes:

| instrument | reading |
|---|---|
| A per-test-ID | 324 files · **5314** tests · **24 failed** · baseline == current |
| B body-identity fence | **8/8** |
| C shipped-uniform delta | **526** bodies, **ZERO** delta |
| C citation fence | **423 CHECKED / 480 UNCHECKED / 0 UNRESOLVED** |

⚠ A moved 5312 → 5314 (B1's two ring tests) and `known-failures.json` was re-recorded at `3800dff`.
The 24-entry failure-ID list is **byte-identical** — verified, nothing changed colour. But
**Instrument A is now certified against a baseline this lane wrote, from a dirty tree.** Inherited
flaw, not new; treat the pointer as soft.

> ⭐ **~700 untracked PNGs and `scratchpad/` are normal. ⛔ NEVER `git add -A`.**

---

## 1. THE DOCS ARE THE WORK. Read in this order; do not re-derive them.

| doc | what it is |
|---|---|
| [`moon-formation-channel-model-PLAN-2026-08-15.md`](moon-formation-channel-model-PLAN-2026-08-15.md) | ⭐ **PLAN OF RECORD.** §1 the model, §2 insertion points, §3 build sequence B0–B10, §4 missing instruments, §5 deferrals, §6 **all four owner questions ANSWERED** |
| [`moon-census-baseline-2026-08-15.md`](moon-census-baseline-2026-08-15.md) | the measured baseline. `tools/moon-census.mjs` regenerates it |
| [`how-rare-are-big-moons-2026-08-15.md`](how-rare-are-big-moons-2026-08-15.md) | sourced target rates; §2.1 the barycentre correction |
| [`moon-formation-audit-2026-08-15.md`](moon-formation-audit-2026-08-15.md) | the 72-entry gap register distilled; §0 carries **four corrections, one to itself** |
| [`world-engine-reconciliations-2026-08-15.md`](world-engine-reconciliations-2026-08-15.md) | the bug family; §2.1 root cause; §3.0 owner rulings |
| [`moon-goes-black-on-approach-2026-08-15.md`](moon-goes-black-on-approach-2026-08-15.md) | ⛔ **a WITHDRAWN defect.** Read §0 before re-investigating a black body |

Raw workflow output is untracked in `scratchpad/`: `moon-audit-*.json/md`, `rare-moons-*`,
`moon-design-plan.md`, `probe-moonmass-ratio.mjs` (copy to repo root to run, then delete).

---

## 2. ▶ NEXT, IN ORDER

### (a) Binary-planet scoping — a workflow, on a settled tree
**Max wants binary planets to EXIST.** Plan §5 deferred them wholesale on **renderer** grounds;
§6/Q3 narrows that. ⛔ **Do not read §5 as "out of scope."** The unsettled question, in one line:

> Can the pair be generated with correct barycentric physics while the renderer draws it
> provisionally (primary-centred, flagged) until barycentre support lands — or does a provisional
> render seed exactly the barycentre bug §5 warns about?

The obstacle is concrete: `main.js:7690-7692` builds every `OrbitLine` as a circle **centred on the
planet**. Rates are real: Ochiai 2014 ~10% of systems, Lazzoni 2024 14.3%, gas-giant only.

### (b) B4 — the PREDICTION COMMIT. Zero cost. Opens the window.
Template is C7's delta table at `9ebb24b`. Plan §3 B4 lists exactly what it must predict.
⭐ **The subtle one it must name: re-keying `compSeed` (`MoonGenerator.js:256`) and `moonecc:`
(`:358`) makes `namespacedFloat` (`:578`) return a different float for EVERY moon**, moving
composition on the whole population — and `namespacedFloat` takes **zero rng draws**, so DRAW
STREAM stays green through all of it and it surfaces only on BODY IDENTITY. Also: the
parameter-free composition identity gate at `moon-condition-contract.test.js:528-542` reads green
straight through that reshuffle and **must not be cited as evidence the reorder was safe.**

### (c) B5 — THE WINDOW. The one commit that moves the universe. B4 is its revert target.
⭐ **ONE window, not several.** The battery charges a fixed toll per population move, and neither
`moon-rng-stream-identity.test.js` nor `moon-condition-contract.test.js` has **any** re-bless
mechanism — no flag, no baseline, no `--record` — so both need a purpose-built capture harness.
**A one-line fix costs the same toll as a hundred-line one.**

---

## 3. ⛔ WHAT I GOT WRONG THIS SESSION — every one shipped into a doc before being caught

1. ⭐⭐ **I reported a rendering defect that does not exist.** "Moon renders black past ~3.5 body
   radii" came from a sweep that mixed **one pre-freeze screenshot with five post-freeze ones**,
   in a session where `freezeFrame` had permanently teleported every body. My ROI was also 55 px
   off-centre. Withdrawn in `e6e49ac`. **A black body against black space cannot be measured by
   eye and is barely measurable by crop-and-average.**
2. ⭐ **I built a sweep whose rungs were ordered in BOTH the independent variable and in time.**
   That is what made session state look like physics. The controls that worked were the ones that
   made something **move and move back**: hiding the mesh and differencing frames, and A→B→A.
3. ⭐ **I propagated a "correction" that was itself wrong** — the Hill count "understated 4×,
   32 outright". Measured: 16. The original was right. It failed on the very corpus that
   reproduces every other figure beside it.
4. ⭐ **I quoted figures without their corpus, repeatedly.** The audit's numbers are BULK-221; the
   fence is FENCE-221; the plan's `m̄ = 3.69` reproduces on **neither** (3.5928 / 3.7453 / 4.0510).
   I also converted a per-moon 3.1% using an **assumed** `m̄ = 20`.
5. **I broke line-count neutrality in `main.js`** and only found out via 27 broken citations —
   there are **602** refs into that file alone. Redone at 16/16.
6. **I collapsed a real distinction into a false dichotomy** (large moons *vs* binary planets).
   Max caught it. A 2 R⊕ body at ~8 M⊕ on a 318 M⊕ giant is mass ratio 0.025 — a satellite.
7. **I presented four "conditioning variables" as the anti-dice-roll machinery. Three are inert
   here** — metallicity is locally flat (±0.05 dex), Dobos is ~constant across 76% of parents, and
   the M-dwarf suppressor never fires. The real conditioning is **geometric**.

---

## 4. ⭐ TECHNIQUES THAT EARNED THEIR KEEP — reuse these

- **Verify by intervention, not by reading.** `freezeFrame`'s teleport was proven by making
  alignment jump 0.885036 → exactly 1.0 and the miss 3.76698 → 0.000301 in one call.
- **Verify a workflow's answer before believing it.** Two workflows returned high-confidence
  answers that live measurement refuted. A third correctly refused to invent a root cause — that
  one was right, and it was right *because* it was allowed to say "not found."
- **Give the corpus with every number, or refuse the number.**
- **Line-count-neutral src edits**, then confirm citations **by the counters, not the exit code**.
- **Write the commit message to a file and `git commit -F`.**
- **Pin `model: 'opus'` on every workflow agent.**
- Tell workflow agents: no chrome-devtools, no dev server, read-only unless the phase says otherwise.

---

## 5. STATE YOU NEED

- **Live game IS running** at `http://localhost:5173/well-dipper/`, chrome-devtools attached.
  ⭐ **Check `list_pages` before assuming otherwise.** Max is parked on `wd-27/3/1` (MEAMEINATH),
  `radii 3.2`, mesh scale `[1,1,1]`, unfrozen, lit.
- ⭐ `_lab.resolveBody({kind:'moon',p:3,m:1})` returns `{ok, mesh, group, planetData, condition,
  holder, backLink, isPlanetMoon, swapped, gameShaderVariant}`. `window._scene` is the scene root.
  **There is NO camera in the scene graph** — derive it from `_lab.cameraPose()`.
  ⛔ `_lab.bodySurfaces()` is ~500 KB. **Filter inside `evaluate_script`, always.**
- ⚠ **Editing `src/` triggers HMR and can drop `_lab` entirely.** After any src edit, re-check
  `window._lab`, reload if needed, and **respawn the system** before measuring.
- ⛔ **Sol cannot validate procgen.** Master worktree is `~/projects/well-dipper-trunk`;
  `~/projects/well-dipper` is **lane A's branch, NOT master**.
- **Corpora, and they are different things:** FENCE-221 = 221 seeds / 961 planets / 770 plain +
  24 planet-class; BULK-221 = 948 planets / 829 moons / 26 planet-class; moon contract = 197 seeds
  / 705 plain; `port-condition-contract` = 120 `pcc-*` / 526 bodies; stream gate = 1500 seeds.

---

## 6. OPEN FOR MAX

1. **Push?** 17 commits unpushed. Not asked yet. ⛔ Confirm before pushing.
2. **B4's predictions are his to read before B5 runs** — B5 is the only commit that moves the
   universe and B4 is its revert target.
3. Standing forward-notes, recorded as direction of travel, not scope: he eventually wants the
   irregular swarm **renderable and flyable**, and binary planets rendered properly.

## Suggested skills

- **`superpowers:verification-before-completion`** — §3 is seven entries long because claims got
  written up before an executed control moved.
- **`superpowers:systematic-debugging`** — §3.1/§3.2. Confounded variables, not shallow bugs.
- **Workflow tool** — the lane's whole method. ⭐ Give agents the evidence log AND the rule that an
  honest "not found" beats a plausible invention; that instruction is what produced the best result.
- **`dev-collab-scope`** — for the binary-planet question in §2(a), which is genuinely multi-system.
- **`handoff`** at the next seam — ⛔ **into `docs/FEATURES/`, not `/tmp`.**

⛔ Do **not** invoke `library-context` reflexively; the SessionStart hook nags about a three.js
brief for an unrelated project (`gesar-app-skin`). This repo is on three.js **0.183.1**.
