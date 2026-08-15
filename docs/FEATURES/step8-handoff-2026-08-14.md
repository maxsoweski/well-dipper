# Handoff — Well Dipper. ✅ B7 CLOSED. NEXT = C7 (8b), and Max's eyes on B7's 10 planets.

> ## ✅ UPDATE, later on 2026-08-14 — §2(a) IS DONE. §2(b) IS NOT.
>
> **Break B7 is closed. `tests/moon-condition-contract.test.js` is 15/15** (was 13/2), both of
> C6's red-by-design gates pass, and **neither was weakened by a character**. All four
> instruments green. HEAD `dc0779c`, tracked tree clean, **NOT PUSHED — needs Max's OK.**
>
> | commit | |
> |---|---|
> | `10d4d1a` | src — a moon's mass follows its radius through a swap (3 moons) |
> | `490db3e` | Instrument B re-bless |
> | `2154de1` | src — a retyped planet keeps its own zones AND its own generation orbit (10 planets) |
> | `ed8d069` | gate — 19 port-contract populations re-derived; 2 emptied pins flipped |
> | `f61d092` | Instrument B re-bless + the `wd-45` pin comment |
> | `952c5d0` | Instrument C re-record |
> | `dc0779c` | Instrument A re-record |
>
> **There were THREE root causes, not the two §2(a) names.** RC1 = the un-rescaled `massEarth`.
> RC2 = `zones: null`, so every swapped planet was derived as if it orbited the Sun. ⭐ **RC3 —
> the one C6 could not name a fix for** — `_swapPlanetType` regenerated at the wrapper's
> **post-migration** AU while every other body in the system uses its **generation-time** AU.
> Re-derived by measurement: RC2 alone reproduces C6's "3 → 1" exactly; RC2+RC3 gives 0.
>
> ### ⭐⭐ THE ONE THING STILL OPEN ON B7 — MAX'S EYES
> `2154de1` moves `landPalette` / `lavaGlowColor` / `lavaCrustColor` on **10 planets**, and
> `wd-45/0`'s hex planet **gains an atmosphere** (T_eq fell 1023.57 K → 457.75 K, so Jeans escape
> stopped firing). They were being shaded as if they orbited the Sun. That the physics is now
> right is measured; **that it LOOKS right is his call and no instrument here substitutes for it.**
> Park him in the live game on `wd-45`, `wd-79`, `wd-614` — see §5/§6 for how.
>
> ### Filed, measured, NOT done
> 1. The rescale loop still leaves `tidalHeating`, `tidalState`, `surfaceHistory` on pre-rescale
>    geometry and the OLD parent type. **Nothing gates it — it needs a gate before a fix.**
>    ⚠ C6's note lists `T_eq` here too; that is wrong, `T_eq` has no moon-geometry input.
> 2. `atmoPhysics.retained === false` is now **unreached for planets** across 6279 of them —
>    i.e. the atmospheric-escape branch is dead in practice. Wants a physics review or a gate.
> 3. `ExoticOverlay.js` is still outside `CITE_SOURCES` (adding it shifts 3 refs into
>    `port-uniform-delta.mjs` — `:1090`, `:1565`, `:1628`).
> 4. Migrated/snapped planets still carry physics for an orbit they no longer occupy. RC3 made
>    the swap **consistent** with that convention; it did not fix it.
>
> ### ⛔ Two traps this session paid for — read before C7
> - ⭐⭐ **A WRONG INSTRUMENTATION POINT IS §3.1's CONFIDENT ZERO IN A NEW COSTUME.** I predicted
>   "draw count unchanged on 197/197 seeds" from a counter patching `SeededRandom.prototype.float`
>   — but `range`/`chance`/`int`/`pick`/`gaussian` call `this.rng()` **directly** and never route
>   through `float()`. The fence was right and I was wrong. Patch `float`, `range`, `chance` and
>   `gaussian` (cost 1,1,1,**2**); `int`/`pick` delegate to `range` and would double-count.
> - ⭐ **INSERTING LINES INTO `StarSystemGenerator.js` BREAKS 25 REFS ACROSS 12 FILES**, and the
>   citation fence sees only ONE of them (the rest are symbol-less and rot in UNCHECKED). An
>   8-line insert was written and thrown away; the shipped edit is **line-count-neutral** (3
>   changed, 0 inserted) using PLAN §11.8's technique. Do the same in C7.
> - The port-contract file had **already diagnosed B7 in prose** ("…whose `metallicity` is
>   PlanetGenerator.js:376's `|| 0` arm firing on an absent `zones`") and pinned it as a count of
>   6. **Grep the gates for a description of your bug before assuming nobody has seen it.**

---

# (original handoff below — §2(a) is now history; §2(b), §3, §4, §5, §6 all still apply)

# Handoff — Well Dipper. NEXT = break B7, then C7 (8b).

**Date:** 2026-08-14 · **Repo:** `~/projects/well-dipper`, branch `feature/world-engine-production-L1`
**HEAD:** `235adef` · **tracked tree CLEAN · everything PUSHED** (remote verified by `git ls-remote`, not by push's output)
**Instrument A** 324 files / 5312 tests / 26 failed — no drift. **Instrument B** 8 passed. **Citations** 400 CHECKED / 447 UNCHECKED / 0 UNRESOLVED, exit 0.
(~700 untracked PNGs + `scratchpad/` are normal. ⛔ **Never `git add -A`.**)

> ⭐ **THIS FILE IS IN THE REPO ON PURPOSE.** Its predecessor was written to `/tmp` and swept before
> anyone read it; a whole session went into recovering it from transcripts. **An artifact that lives
> only in `/tmp` does not exist.** Recovery of that one is at
> [`step8-handoff-2026-08-12.md`](step8-handoff-2026-08-12.md).

---

## ⛔ MAX'S PRIORITY, IN HIS OWN WORDS — read before choosing anything

> *"What I care about is being able to use the systems that we created for world engine in the main
> well-dipper game. I want to make this as optimized and well-architected as possible."*

He does **not** want to be asked things an agent can decide. Several decisions were taken for him
this session and recorded for veto; he vetoed none. Decide, state the criteria, move.
⭐ But **anything that changes what he SEES is his call** — he ruled on the cockpit T_eq row and
UAT-passed the 8a visual himself.

---

## 1. WHAT CLOSED — read the record, do not re-derive it

**8a IS SHIPPED AND UAT-PASSED.** 770 plain moons carry `massEarth`, `age`, `T_eq`, `composition`,
`surfaceHistory`, `tidalState`.

| commit | |
|---|---|
| `bcb62d1` | C0 — corrected the numbers Step 8 was sold on |
| `c272591` | C1 — Instrument B planet-class side-channel + counted assertions |
| `f81e9a1` | C2 — `conditionFromPlanet` → `conditionFromBody` |
| `0b329da` | C3 — parent orbit AU threaded, consumed by nothing |
| `2f3f8fd` `ea8afca` | **C4 + C5** — the six fields, and the named re-bless |
| `8b026b8` | cockpit survey shows a real moon T_eq (Max's ruling) |
| `1340c4d` | C6 — 19 value gates, 2 red by design |
| `426b7b9` | Instrument A re-record |
| `a7e1982` `235adef` | `nearGiant` fix + re-bless |
| `909022e` `63078e5` `d9b06b3` `1a25328` | recovery of the lost handoff + docs corrections |

**Every commit message is long and carries its own evidence. Read the one you are building on
before you touch its file — that is faster than re-measuring.**

⛔ **Plan of record:** [`step8-build-plan-2026-08-12.md`](step8-build-plan-2026-08-12.md).
⚠ Its §3 gate cells still quote **400/421**; the live figure is **400/447** (C0 moved it). The
correction is annotated in place — do not "fix" the historical readings at `:20`/`:80`/`:116`.

---

## 2. ▶ NEXT — START HERE

### (a) Break B7 — the last open 8a defect. C6's two red gates ARE this.

`src/generation/ExoticOverlay.js` rescales an **already-generated** moon's `radiusEarth` (and
`radiusScene`/`orbitRadiusEarth`/`orbitRadiusScene`) by `kEarth` **without rescaling `massEarth`**.
So the invariant `massEarth === radiusEarth³ · density/ρ⊕` — which C4's own comment states and which
**holds at return time** — is **broken after `StarSystemGenerator.generate` returns**, on **3 of 705**
fence moons.

Two gates in `tests/moon-condition-contract.test.js` are red on exactly those 3 bodies and stay red
until this is fixed. They are blessed-as-failing in Instrument A, **not** blessed-as-acceptable.

⚠ **Gate 8's named fix is measured and OVERPROMISED — read its in-file comment before starting.**
Passing real `zones` takes it **3 violators → 1, NOT 0**. The survivor (`wd-79`) is a *second,
separate* defect: the moon's `T_eq` uses the **pre-migration** `parentOrbitAU` while
`_swapPlanetType` regenerates the planet at the **final** orbit; residual exactly
`sqrt(527.736/524.442) = 1.00314×`. And it is not a one-line change — `_swapPlanetType` has no
`zones` parameter and `systemData.zones` is four AU boundaries with no luminosity. A working version
took **3 edits across 2 files**.

**Shape:** src fix → three-channel read → separate re-bless. Same as `a7e1982`/`235adef`.

> ✅ **(b) IS SHIPPED — 2026-08-15, at `4cee76a`.** The `1.0` quoted below is no longer the code;
> `:378` now reads `Math.max(parentOrbitAU ?? 1.0, 0.01)`. Delta table: `step8b-c7-delta-table-2026-08-14.md`.
> ⭐ The "NEEDS MAX'S EYES" half is still open.

### (b) C7 = 8b — the universe change. ⭐ NEEDS MAX'S EYES.

`MoonGenerator.js:378` generates every planet-class moon at `PlanetGenerator.generate(rng, 1.0, …)`
— a hardcoded 1 AU. ⚠ **That line was `:278` in the plan; the 8a append and the `nearGiant` fix
shifted it. Verify before citing.**

⛔ **8b is a UNIVERSE change, not a value change** (build plan break B6) — the plan says otherwise in
a sentence labelled *"Correction to the recon, in the plan's favour"*, and its `radiusEarth 0/400`
control measured the wrong object. It moves `radiusEarth`, `orbitRadiusEarth`, `orbitSpeed`,
`inclination` and `startAngle` on ~22% of planet-class moons — bodies that **render today**.

The delta table must carry the **geometry columns**, not just the six the plan declares. C8 blesses
three instruments in **three separate commits** so the table stays falsifiable.

⭐ **Get the server up and park Max in the live game for this one.** Ask him to start it — see §5.

---

## 3. ⛔ WHAT COST TIME THIS SESSION (none of it is in any other artifact)

1. ⭐⭐ **A wrong property path returns a CONFIDENT ZERO, not an error.** This bit **five times** in
   one session: `p.type` (planets are wrappers — the record is at `p.planetData`), `_lab.currentSystem()`,
   and the baseline JSON traversal **three times running**. Every time it produced a plausible number
   that was simply false. **Verify the object path on ONE instance before any population sweep**, and
   treat a suspiciously round zero as a probe bug until proven otherwise.
2. **The `no-dev-servers` hook matches the WORD `vite` anywhere in a Bash command** — it blocked a
   read-only `pgrep -af "vite"`. Also blocks commit-message heredocs. ⭐ **Write commit messages to a
   file and `git commit -F <file>`** — do that by default.
3. ⛔ **`CITE_SOURCES` is a HAND-MAINTAINED allowlist, not a directory walk.** Two consequences that
   pull opposite ways: adding files to `docs/` does **not** move the counters (so a green fence after
   adding a doc proves nothing), and a file **not** in the list has its citations rot **invisibly**.
   `tests/moon-condition-contract.test.js` is not in the list — 11 of its citations went stale and the
   fence stayed green throughout. Filed follow-up: widen `CITE_SOURCES` **and** convert its refs to
   `line + symbol` form in one commit ("adding a source and GATING a source are different acts").
4. ⛔ **Any line insertion into `MoonGenerator.js` shifts every citation pointing into it.** The 8a
   append shifted `+24/+40`. Repair by **verifying against what the citation pointed at BEFORE the
   shift** (`git show HEAD:<file>`), never by guessing intent — and **add the symbol** while you are
   there so it cannot rot silently again.
5. **Do not splice a symbol after a line number inside an existing code span** — the PLAN's house
   style already wraps refs in backticks, so it splits the span. Symptom: the scanner's counters do
   not move at all.
6. **`git diff HEAD` fails "ambiguous argument"** where a file named `HEAD` exists. Use `git diff HEAD --`.
7. **`_lab.systemInfo()` returns a SUMMARY**, not record arrays. The live debug surface does **not**
   expose raw generated records — **record-level verification belongs headless**, where you get the
   whole population instead of one system.

---

## 4. ⭐ THE PATTERN THAT WORKED — reuse it

**recon (parallel) → PREDICT IN WRITING → implement → adversarial verify (parallel).**

- ⭐⭐ **Predict before touching `src/`, and put the prediction in the commit message.** This is the
  single highest-value structure in the whole plan (build plan §6). It caught C4's blocker *before*
  the run and made "the gate can fail" true rather than aspirational. A prediction you **inherit**
  cannot falsify anything — re-derive it even when a previous commit measured it.
- ⭐ **Mutate the PASSING gates, not just the failing ones.** Both false claims found this session
  (gate 8's overpromise, gate 10's non-biting `compswap`) came from mutating gates that looked fine.
  Tell verifiers: *a mutant that fails to red is the most valuable finding available.*
- **Refuse any number that arrives without its corpus.** C6 measures on 197 seeds / 705 moons; the
  fence uses 221 seeds / 770. Four corpus mix-ups happened; every threshold must name its population
  at its own site. ⚠ `moved = 181` agrees across both corpora **by accident** — the one literal that
  looks right for the wrong reason.
- **Pin `model: 'opus'` explicitly on every `agent()`.** Omission is expensive.
- ⚠ **A stop hook can force a commit before its verifier returns.** It happened twice. Run the gates
  yourself, say in the message that the review was still in flight, and **do the follow-up** — one of
  those follow-ups found a false statement.

---

## 5. WORKING RULES THAT WILL BITE IF UNKNOWN

- ⛔⛔ **RUN INSTRUMENT A AFTER EVERY COMMIT — INCLUDING ONES WHOSE TESTS ARE EXPECTED RED.** A
  cockpit regression from C4 survived two commits and a push because the reasoning was "C4's tests
  are expected red anyway, the signal is in the three channels." **Instrument A would have caught it
  on the first run** (proven: `NEWLY RED tests/cockpit-screens-lab.test.js`). The instrument was
  correct, available, and not run.
- **Read RECORD SHAPE according to the change.** In C4 (a key was appended) a **green** shape channel
  meant FAILURE — the append had gone on non-enumerably. In the `nearGiant` fix (a value moved)
  **green is correct**. Do not read the channel by habit.
- ⛔ **A re-bless is always its own commit.** Reblessing inside the change destroys the only control
  the step has. Before any gated commit: `git log -1 --format=%H -- tests/baseline/body-identity.json`
  must be **strictly older** than the commit you are about to make.
- ⛔ **PLAN.md edits above its `## 11.` heading must be LINE-COUNT-NEUTRAL** — expand lines, never
  insert. §11.8 carries the recipe; every hunk must be `NcN`.
- **Commit at seams without asking; CONFIRM before `git push`.** Verify a push with `git ls-remote`,
  **never** with push's own output — it lies above ~10 MB. Disable the sandbox for push.
- **Max is on the CLI.** He leads and reviews; he does not hand-code.
- ⭐ **Max's eyes are the gate on whether it looks right.** Park him in the live game. A screenshot is
  your check, not his.
- **End every response with an open-items block containing only DECISIONS.** No affirmations.

---

## 6. STATE YOU NEED

- **Live game:** ⛔ the dev server is **NOT** running and you cannot start one (the process dies when
  the Bash call returns). Ask Max to run, in his Ubuntu/WSL terminal:
  `cd ~/projects/well-dipper && npm run dev`
  then, from **Windows PowerShell**:
  `& "C:\Program Files\Google\Chrome\Application\chrome.exe" --remote-debugging-port=9223 --user-data-dir="C:\temp\chrome-mcp-filmstrip" http://localhost:5173/well-dipper/`
  The separate `--user-data-dir` keeps his main Chrome untouched.
- ⭐ **Check rAF fps before trusting any live reading** — a minimized window throttles to ~1 fps and
  `hasFocus`/`visibility` lie. Healthy is ~240.
- **Pre-8a live baseline, for comparison:** 240.4 fps · 6-planet procedural system
  `PVX J3DK6GAO+RBJGI5M` · 74 meshes / 65 visible / 19 painting >1px · 16 programs · 0 console errors
  · largest body 31.362°. Post-8a: angular sizes identical to 3 dp.
- ⛔ **Sol cannot validate procgen** — use `_lab.spawnProceduralSystem('lab-procedural-6')` or Caph.
- **Master worktree is `~/projects/well-dipper-trunk`.** `~/projects/well-dipper` is **lane A's
  branch, NOT master**. `git worktree list` before merging.
- ⛔ **Scratch in `$TMPDIR`, NOT `<repo>/scratchpad`** — `CITE_SKIP_DIRS` excludes it, so a tree copy
  there reds the citation fence with ~101 unresolved refs and no clue why. But a probe that imports a
  repo module **must** live inside the repo tree — put it at the repo root and delete it after.
- **Recovered evidence, if a number is ever in doubt:**
  [`step8-recon-lane-output-2026-08-12.md`](step8-recon-lane-output-2026-08-12.md) (9 lane returns),
  [`step8-recon-process-notes-2026-08-12.md`](step8-recon-process-notes-2026-08-12.md) (20 gotchas,
  8 probes, 9 measurement traps),
  [`step8-recon-workflow-2026-08-12.mjs`](step8-recon-workflow-2026-08-12.mjs) (the method).
- **Archived, do not lose:** `archive/wf_2c473003-f77-5-max-measurequad` holds a commit authored by
  Max that existed on no remote. `~/wd-worktree-archive-2026-08-14/` holds 7 patches of uncommitted
  work from the 11 stale agent worktrees deleted this session (1.3 GB reclaimed).

---

## Suggested skills

- **`superpowers:verification-before-completion`** — every claim needs an executed control that
  MOVED. The session's recurring failure was a confident zero from a bad property path.
- **`superpowers:systematic-debugging`** — B7 has a measured mechanism and a *wrong* documented fix.
  Re-derive before applying.
- **Workflow tool** — see §4. B7 and C7 both warrant one; C7 especially, because its delta table
  needs geometry columns nobody has measured.
- **`handoff`** at the next seam — ⛔ **and write it into `docs/FEATURES/`, not `/tmp`.**

⛔ Do **not** invoke `library-context` reflexively; the SessionStart hook nags about a three.js brief
for an unrelated project (`gesar-app-skin`). This repo is on three.js **0.183.1**.
