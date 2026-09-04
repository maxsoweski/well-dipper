# Handoff — ▶ **(2) THE SNOW BUDGET**, then **(3) the lighting engine / F52**

> ⚠ **IN-REPO ON PURPOSE** (`/tmp` does not survive a WSL restart). Supersedes
> `handoff-2026-09-05-label-split-then-snow-then-lighting.md`; **its arc (1) is CLOSED** and its trap
> list is carried and extended below.
> **Branch** `feature/world-engine-production-L1` (lane A, **NOT** master) · **HEAD = origin =
> `a0f1356`, verified by `git ls-remote`.**
> ⛔ **662 untracked files (mostly stray PNGs) are normal — NEVER `git add -A`.** Stage explicitly and
> audit with `git show --stat` after every commit.
> ⚠ ALWAYS `npx vitest run --dir tests --root /home/ax/projects/well-dipper`.

## 0. ⛔⛔ READ THIS BEFORE YOU BELIEVE A TEST RESULT

**THE SUITE IS ALREADY RED AT HEAD, AND IT WAS RED BEFORE THIS SESSION TOO.** 8 files / 20 tests fail
at `a0f1356` with nothing of yours in the tree:

```
agent-camera-api · driver-pack-giantdeck · gas-body-lab-material · lab-shader-perframe-seam
moon-condition-contract · moon-rng-stream-identity · port-condition-contract · relief-octave-lod-ramp
```

The previous handoff's "all four instruments green" meant four NAMED instruments, not the suite, and
reading it as "the suite is green" costs you an hour. **Capture the baseline first, diff against it,
and never attribute a pre-existing failure to your change.** The method that worked:

```
git stash push -- <your files> ; <run suite, save titles> ; git stash pop ; <run again, comm -23>
```

## 1. WHAT SHIPPED THIS SESSION, so it is not re-litigated

Both arcs are Max-UAT'd and pushed. Full records in the workstreams; do not re-derive.

**Arc (1) — THE LABEL SPLIT.** `docs/WORKSTREAMS/derived-world-class/` (contract `shipped`, intent,
LIVE-CHECK, DEVIATIONS, `census.mjs`, `additive-check.mjs`). Max: *"1 works"*. `PlanetGenerator.type`
stays the FORMATION SEED; a derived `worldClass` computed from the finished body's condition vector is
what the info panel, both orrery colour tables, the seed search and the cockpit TYPE row read. Misnamed
warm-wet worlds 11 → 0, hot-dry "ocean" 7 → 0, cold "lava" 15 → 0, hot "ice" 6 → 0.

**Arc (1.5, unplanned) — THE GAME GATES.** `docs/WORKSTREAMS/world-engine-feature-gates/` + the PLAN's
**§ THE GAME GATES**. Max asked for it mid-session: *"turn off the world engine features that have not
yet been developed … then we'll flip them on once developed."* **Ten of solidRelief's eleven are now
OFF in the GAME and all eleven still live in the LAB.**

⭐ **The one sentence to carry from it:** the switch already existed and had never been thrown —
`gatesFor` answered `GATE_RULINGS[g] ?? true` and `index.js:267` said outright *"all eleven default ON
and none is ruled off today."* The work was the ruling, not the mechanism.

## 2. ▶ ARC (2) — THE SNOW BUDGET. Scope it with `dev-collab-scope`.

**The full write-up with every number is `docs/WORKSTREAMS/volatile-delivery/FOLLOWUP-frost-budget.md`.
Read it; this section is only the orientation.**

`labCore.js` computes `frostMaxCoverage = smoothstep(0.05, 0.4, volatileFraction)` — **no temperature
term at all.** The whole temperature test is delegated to the shader's `localT`, which uses
`uFrostLatChill = 0.35`, a value `shaders/uniforms.js:268` itself labels **"lab knob"**. At 0.35 the
sea-level snowline lands at **26° latitude on a 293 K world** — 56 % of the surface before any relief,
with an altitude term of −88 K per unit of relief on top. Earth's is ~66° / ~10 %.

⚠ **Note the direction of the error, because it is the strongest single argument:** that world's
equilibrium temperature is 293 K, **38 K warmer than Earth's 255 K**. It should carry LESS permanent
ice than Earth's ~10 %, not five times more.

⭐ **It is a LAB defect of long standing, not one this program introduced.** The lab's own
`Ocean (temperate)` preset (V 0.35, T_eq 295) scores a **0.945** budget and always has. The game simply
had no warm wet world to display it on until 2026-09-04.

**Two separable halves, and the split is already made:**
- **(a)** the budget needs a temperature term — today a 700 K world with volatiles gets the same
  budget as a 200 K one and is saved only by the shader;
- **(b)** `uFrostLatChill` / `uFrostLapseRate` are underived knobs sitting where a real pole-to-equator
  gradient belongs.

⚠ **Decompose before flagging risk** (`feedback_decompose-before-flagging-risk`): (a) is a law with a
calibration target; (b) is replacing two hand-set constants with a physical gradient. They are not the
same size and should not be bundled into one ask.

⭐ **Anchor body for any live check:** `?system=rocky-126`, the **second** planet
(`PVX J3DK6GAO+RBJGI5M c`, 1.08 R⊕, 293 K, volatiles 0.310). It is the world Max UAT'd twice and it is
the one that showed the defect. Its measured uniforms at the time: `uFrostMaxCoverage` 0.834,
`uFrostCondensationT` 273, `uPlanetTempEq` 292.9, `uIcenessMix` **0** (so this is frost deposition, NOT
the icy-body path — do not debug the wrong law).

## 3. ⛔ STILL PARKED

- **The REPORT's Block B** — `if (locked) return shell('eyeball-despun')` sits ABOVE both roads to
  `plate()` and eats **74 %** of bodies (875 of 1,183). Max agreed it gets its own session. The class
  it shuts out is real: tidally-locked temperate worlds are the commonest habitable-zone configuration.
- **The orrery draws a different system than the scene** — `docs/WORKSTREAMS/orrery-shows-wrong-system/FINDING.md`.
  Max ruled 2026-09-04 it gets its own session. ⚠ The leading hypothesis in that file is explicitly
  marked NOT ESTABLISHED; do not repeat it as fact.
- **The eight+two gated-off features** — each row in `SOLID_RELIEF_GAME_GATES` names its exit. The exit
  for almost all of them is FOLLOWUP **(b)** in `WORKSTREAMS/solid-relief-deck/FOLLOWUP-not-fully-developed.md`.
- **A second one-name-two-meanings pair, found and deliberately not fixed:** `compositionClass` cuts
  carbon at C/O > 1.0 (`e1Regime.js:68`), `deriveComposition` at 0.8 (`PhysicsEngine.js:596`).
- **`carbon` has no physical referent in this galaxy at all** — C/O tops out at 0.769 across 200 seeds
  while the formation roll labels 126 bodies carbon. The derived `carbon` branch is therefore UNPROVEN
  CODE: written, and exercised by nothing.

## 4. ⛔ TRAPS

### Carried from the previous handoff (1–17 there; the ones that keep firing)
10. `cd` moves the session's cwd — it happened again this session. **Use absolute paths.**
11. An import appended past a trailing `//` lands INSIDE the comment and is silently dead.
12. A screenshot pair of a ROTATING body measures the rotation (`_lab.freezeFrame()` is the control).
15. ⭐⭐ **A fresh `new SeededRandom(...)` for a side draw moves Instrument B's draw stream with ZERO
    values moved.** Use `namespacedFloat`.
16. ⭐ **Editing `PlanetGenerator` / `MoonGenerator` / `PhysicsEngine` drifts every line-anchored
    citation into them.** Repair by locating the SYMBOL, never by bumping the integer.
17. ⛔⛔ **`git add -A` committed 705 stray PNGs once.** Stage explicitly. Always.

### NEW, and every one of them cost time this session
18. ⭐⭐⭐ **A LIVENESS PROBE CAN ITSELF BE VACUOUS, AND MINE WAS.** The first gate instrument fed
    `ray-pack-corpus.mjs:64`'s **already-resolved** numbers back into `resolveDriver`. A plain number
    carries no `.gate`, so the gate branch never ran: it reported `mountains: 103` with the gate ruled
    OFF **and its own liveness check PASSED**, because both the test column and the control column were
    the same ungated number. ⛔ **"The control is unmoved" is NOT a liveness check** — it passes under
    exactly the bug it is meant to catch. **The control must DISCRIMINATE: the ruled answer must
    DIFFER from the control answer, and differ in the specific direction claimed.** This is the sharper
    form of `feedback_identical-output-needs-a-liveness-probe` and it deserves promoting.
19. ⭐ **`resolvedPacks` (tests/fixtures/ray-pack-corpus.mjs) PRE-RESOLVES its drivers under a policy
    PINNED to ALL_ON** (`:61`, deliberately, so the cross-commit harness compares code and not
    policies). To measure anything gate-dependent, call `entry.pack(cond, packCtx)` yourself and
    resolve the DESCRIPTORS.
20. ⭐ **`strip()` in `driver-pack-terminator.test.js` BLANKS STRING-LITERAL TEXT**
    (`blankLiteralText: true`). A source-fence regex that matches a string literal must use
    `stripKeepText`. Mine failed on blanked quotes, not on the code, and read as a real regression.
21. ⭐ **The lab's per-feature checkboxes DEFAULT OFF.** Reading `_lab.uniforms` straight after
    `setPreset` gives all zeros and looks like you broke the lab. Call `_lab.enableAllFeatures()` first.
22. ⭐ **`?system=<seed>` and `_lab.spawnProceduralSystem` do NOT move galactic position**, so the
    orrery renders a different system than the scene. Any orrery measurement on a debug-spawned system
    is measuring the wrong bodies (see §3).
23. **Line-stability idiom, and this file's own convention:** when adding an import to a
    heavily-cited file, **append it to an existing import line** (`e1Regime.js:22`, `main.js:7`,
    `index.js:59` all say why). Make UI edits line-count-neutral. This session touched 5 files and
    drifted exactly ONE citation.
24. **A month-old workflow worktree lives at `.claude/worktrees/wf_440dc97c-63b-4`** (detached,
    Aug 25). Running a single test file BY PATH makes vitest execute **both** copies and report a
    month-old snapshot's failures as current. `--dir tests` is unaffected. Not removed — not ours.

## 5. ⭐⭐ THE METHODOLOGICAL LESSON WORTH AS MUCH AS THE TRAPS

**Max's UAT sharpened a bar I had written too loosely, and the correction generalises.**

I gated features on "does it read the bake's accumulated surface". Dunes and karst passed. Max: *"Everything
still has the dunes drawn across the surface."* He was right, and the cause was **the change's own
doing**: their gates (`lowGround`, `gentle`) are smoothsteps DOWN from relief, so turning the other
eight features off **flattened the field they read**, both terms went to 1, and only the province floor
(0.30 / 0.25) was left. Mass-wasting survived because it reads a **residual** (`gradIn - gradBase`),
which goes to exact zero on flats.

⭐ **The rule:** *reacting to relief is not the same as reacting to its absence.* A gate that OPENS when
the terrain goes flat is painted on, however many terrain terms it multiplies. **Ask which way the gate
moves as its input goes to zero.** This applies directly to arc (2): `frostMaxCoverage` has no
temperature term at all, so ask the same question of every term you add — what does it do at 700 K, and
what does it do at 100 K?

## 6. WORKING WITH MAX

- ⭐⭐ **THE RECAP IS A STATUS REPORT AGAINST THE ROADMAP, IN HIS LANGUAGE.** Read
  `feedback_director-level-recaps.md` and `feedback_asks-in-his-language-not-the-contract-s.md` IN FULL.
  No AC ids, no file paths, no bare keys in the asks.
- ⭐ **HE CHECKS PREMISES AND HE IS USUALLY HALF RIGHT IN A WAY THAT IMPROVES THE FIX.** *"the label is
  just randomized"* was half right, and the correction (it is UPSTREAM, so it is a loop not a relabel)
  is what made arc (1) scopeable. **Answer the premise precisely rather than agreeing.**
- ⭐ **HIS UAT FINDS THE THING THE TESTS CANNOT.** The dune defect passed every gate I wrote and he
  caught it in one look. Put him in the LIVE thing; do not substitute a screenshot you describe.
- **He rules fast and in few words when the ask is concrete** — *"1 works"*, *"2. yes"*, *"3. push"*.
  Keep asks to one line each with a recommendation stated.
- **Pushing is confirmed each time.** He said yes twice this session; that is not standing.

## 7. SUGGESTED SKILLS

- **`dev-collab-scope`** — FIRST, before any code. Arc (2) is multi-AC and multi-system (a generation
  law + two shader constants + the lab's presets). Writes `intent.md` + `contract.json` in
  `docs/WORKSTREAMS/<slug>/`. Interview Max on the bar; do NOT ask him what you can measure.
- **`superpowers:systematic-debugging`** — if the frost law turns out not to behave as
  FOLLOWUP-frost-budget.md predicts. Measure before changing a constant.
- **`library-context`** — a SessionStart hook reports no cached three.js brief for this project and
  post-cutoff r183/r184 capabilities may be invisible. Only worth it if the arc turns shader-heavy.
- ⛔ **NOT `verify-workstream` until a coherent unit is built** — it audits a contract that must exist
  first.

## 8. FIRST FIVE MINUTES

1. `docs/NOW.md` — top entry is this session; the arc order is in it.
2. `docs/WORKSTREAMS/volatile-delivery/FOLLOWUP-frost-budget.md` — the whole of arc (2).
3. Capture the test baseline (§0) **before** touching anything.
4. `~/.claude/state/dev-collab/active-workstream.json` still points at `world-engine-feature-gates`
   (shipped) — repoint it when arc (2) is scoped.
5. Then `dev-collab-scope`.
