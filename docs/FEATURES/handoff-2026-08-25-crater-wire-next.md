# Handoff 2026-08-25 — ▶ NEXT IS THE CRATER WIRE, AND THE SPEC ALREADY EXISTS

**HEAD** `c0c08c3` · **Branch** `feature/world-engine-production-L1` · **tracked tree clean**
**Repo** `~/projects/well-dipper` (lane A's branch, **NOT** master) · lab at **6559 lines**
⛔ **~700 untracked PNGs are normal. NEVER `git add -A`.**

> ⚠ A `/tmp` copy of this exists for the session that wrote it. `/tmp` does not survive a WSL
> restart — that bit us this morning. **This in-repo file is the durable copy.**

---

## 0. ⛔ DO THIS FIRST — FIVE COMMITS ARE UNPUSHED

`origin` is at **`47170f9`**; local HEAD is **`c0c08c3`**. Everything after the first commit of the
day is local only, and **Max has not been asked to approve that push.** Ask him, then:

```bash
git push origin feature/world-engine-production-L1     # sandbox OFF; verify with git ls-remote
```

Pushing this BRANCH is safe. ⛔ **Pushing `master` AUTO-DEPLOYS** to
`welldipper.maxsoweski.com` — `.github/workflows/deploy.yml` is `on: push branches [master]`, with
no staging step between merge and live.

## 1. WHY THIS WORK EXISTS — Max, 2026-08-25

> "I want Welldipper and the World Engine to be wired together, so they share the same rendering
> pipeline/tech."

and, separately:

> "I don't wanna be, like, a month ahead of live with a bunch of changes and not be considering when
> we're going to merge."

`master` is **24 days stale**. This branch is **782 commits ahead, 0 behind** — a clean fast-forward,
so divergence is not creating merge risk, it is only creating distance from live.

⭐ **MAX RULED THE MERGE GATE IS `ledger ≤ 2` WITH HONEST `clears` TEXT — NOT ZERO.** Zero needs a
ruling he should not have to make plus an architecture rewrite unrelated to the lab/game split.

## 2. WHERE THE LEDGER STANDS — 6 rows, ceiling 6, **NO SLACK**

`tests/one-pipeline-fence.test.js`. `ledgerSlack` is asserted 0, so **every clear forces the ceiling
down in the same commit**.

| row | clears when |
|---|---|
| `drivers/craterDeck.js` | the crater wire below |
| `drivers/rockySurface.js` | the crater wire below |
| `base/macroWavelength.js` | falls out FREE with the crater wire (enters the closure via `rockySurface.js`) |
| `base/emission-e.js` | §4 — reaches the gate |
| `drivers/index.js` | composition question, carried past the merge |
| `shaders/craterRelief.glsl.js` | carried past the merge |

Cleared today: `polarDeck`, `solidOptics`, `limbDeck`.

⚠ **Registration 2b's non-vacuity CONTROL is a HARDCODED list, not derived from the roster.** It must
be rewritten at every step that changes the lab's closure or it reds naming the wrong subject.

## 3. ▶ THE CRATER WIRE — both mirrors already exist and are committed

⭐ **THE FULL SPEC IS ALREADY WRITTEN. READ IT BEFORE TOUCHING ANYTHING:**
`/tmp/claude-1000/-home-ax/a9745590-9785-4516-abea-3b41b464090f/tasks/w4fubtfgk.output` → `result.report`.
It carries the exact ctx shapes, the supersede table and the measured no-op evidence. If `/tmp` is
gone, the same facts are reconstructible from the two pack files' own headers.

`rockySurfaceLabState` (9 bound names) and `craterDeckLabState` (6) landed at `c0c08c3`. They are
exact complements — measured over 156 bodies: **0 with two owners, 0 with none.**

**Both calls go in `ensureNetworkRouted`, AFTER line 2880.** ⛔ Not at `:2821` where `giantSurface`
sits — the inline crater block at `:2845-2879` would overwrite five of six bound names on the next
line. `ensureNetworkRouted` is always the last writer (`:2759 riverRerouteDebounced()` → `:3037`).

- `rockySurfacePack` ctx: `displayRadiusEarth` **plus all three** of `macroOffset` / `detailOffset` /
  `craterOffset` — an absent one THROWS, it does not default.
- `craterDeckPack` ctx: `displayRadiusEarth` only.

**Neutralise in the same commit:** `:2785`, `:2788`, `:2820`, `:2845`, `:2854`, `:2866`, `:2871`,
`:2879`, and `:2027` / `:2041` in `applyDrivers`.
**KEEP `:2834`** (`craterRelevance` — the frame writer reads it, the mirrors do not supply it).
**KEEP `:2040`** (`ejectaStrength` stays lab-owned — see §5).

⛔⛔ **NEUTRALISE BY COMMENTING IN PLACE, NEVER BY DELETING.** 500+ line-anchored citations sit at or
past `:1933`; any net line change reds the citation fence. The idiom is already visible in this exact
block. **Ledger 6 → 3** when this lands.

## 4. THEN emission-e — ledger 3 → 2, which REACHES THE GATE

Full edit list in the same report, §4. Its debt row's stated blocker ("the lab has no emission control
surface") is **false** — the lab has the F32/F33 thermal family with GUI at `:3846-3857`.

Import `EMISSION_PHYS` appended to **line 188 before that line's trailing `//`** (a new line reds 64
citations; an import landing *inside* the comment has already killed a page load twice). Then `:1042`,
`:2443`, `:2446`, and:

⛔ **THE PER-FRAME TRAP — `:5344`.** It re-assigns `state.dayTempK` 60×/s and unconditionally
overwrites `:2443`. Convert `:2443` alone and nothing changes — **and it looks like it worked**,
because both routes yield the same number until someone drags the T_eq slider. Both sites, or the law
keeps two homes.

Then delete the row at fence `:422-427` and lower the ceiling to **5**.

## 5. OPEN FOR MAX — carry all of these

1. **The push in §0.**
2. **A crater SHAPE defect he approved fixing FIRST.** Small craters are drawn deeper than wide —
   depth/diameter **0.53** at the smallest hashed size against ~0.2 for real simple craters. Floor-
   invariant, so no A/B rung touches it. ⛔ Fix it BEFORE flying the size A/B or he judges crater size
   on a field of spikes.
3. **Three A/B keys to fly in the LIVE lab** (`feedback_showcase-by-parking-the-live-game` — bare-key
   A/B flipped while moving, never screenshots):
   - **terrain frequency** — `uNoiseScale`. ⭐ The lab has **never set it**; it sits at the factory
     4.0 forever. The shared law moves it on **all 13 non-gas presets**, three of them by 40–110×.
     He ruled the law's SHAPE but has never seen it in the lab. Must be flown BEFORE the crater wire.
   - **crater size** — `CRATER_VIS_FLOOR_RAD`, KeyJ, **9.6e-4 (shipped) vs 3.823e-3**. Single
     variable at that pair; the next rung up moves two things and is not an A/B.
   - **ejecta appearance** — the `strength + amp + lump` family, ~113× change. ⛔ Closes together or
     not at all: binding one factor of the shader's product moves the lab FURTHER from the game.

## 6. TRAPS THAT COST REAL TIME TODAY

1. ⛔⛔ **A pack call in the WRONG FUNCTION is invisible to every headless gate** and dies only on page
   load. Always name which lab function AUTHORS the target state fields.
2. **Identical output cannot prove a wire is live.** Sabotage a required input — NaN into
   `displayRadiusEarth` raises `PackContractError`. ⚠ **AND MY FIRST SABOTAGE WAS VACUOUS:**
   `applyDrivers` re-draws `planetRadiusEarth` at `:1955` on preset CHANGE, wiping it before the call
   site, and both branches read "not executing". Call `_lab.applyDrivers()` directly with the preset
   unchanged so that reset stays gated off. **A control that cannot reach its subject is not evidence.**
3. ⛔ **NEVER put a backtick inside a GLSL template literal.** It terminates the string. 15 files went
   non-collecting, 399 tests silently vanished from the run — **and the failure COUNT went down**, so
   it reads as an improvement. Instrument A's per-test-ID baseline is what caught it.
4. **Every lab edit line-neutral, or repair citations by LOCATING each symbol** — never by adding an
   offset. The tool says so itself: a ref repaired to a second wrong line is worse than a stale one.
5. **Instrument B + three other identity fences are RED BY DESIGN**, from two deliberate generation
   changes: the binary-companion channel (`34b502d`, 2026-08-18, another lane's, scheduled to re-bless
   at B7) and this session's ocean-world change. They clear with **ONE** re-bless. Instrument A's
   expected set is **36 failed / 8 files** — anything else is drift.
6. **Four flaky tests confirmed** — `GalacticFeatures`, `worldengine-inc3b-composite-budget`,
   `ringConic.frontarc`, +1. They pass in isolation AND together; they only red in the full 341-file
   run, so it is a runner condition, not a logic bug. ⛔ **Run them in isolation before the re-bless**
   or a random failure gets frozen in as permanently expected.
7. **`test:body-identity:rebless` is INCOMPLETE.** It rewrites only the JSON; three failing values are
   hardcoded literals inside the test source at `:687`, `:288-293`, `:777-780`. Fix before B7 or
   someone hand-edits numbers under time pressure.
8. **Docs go stale and cost sessions.** Two did today — one put an already-answered question in front
   of Max as a headline ask. Check a doc's claim against HEAD before acting on it.

## 7. WORKING WITH MAX

⭐⭐ **Read `feedback_director-level-recaps.md` IN FULL before any end-of-turn summary** — from the
file, not from `MEMORY.md`'s one-line gloss. Working from the gloss broke this rule twice today.
**Run the CUT TEST**: delete everything above the asks; do they still stand alone? He is the director,
does not read code, and cannot reconstruct context mid-decision.

⚠ **Do not ask subagents to write for Max.** A synthesis prompt asking for "a decision-ready page for
Max" produces something that looks finished and gets forwarded with its jargon intact. Ask them for
facts and tradeoffs addressed to YOU; the translation is yours and must not be skippable.

⛔ He noticed oscillation today — *"you keep going back and forth on this."* Once he reaffirms a
decision, it is made: build it, and fix what is in the way rather than re-asking.

## Suggested skills

- **`superpowers:verification-before-completion`** — before claiming any wire works. The whole
  session's method is that green gates are not evidence until a sabotage probe proves liveness.
- **`superpowers:systematic-debugging`** — if the crater wire misbehaves on page load; traps 1 and 2
  are both debugging failures wearing a green suite.

## Not in scope

The personal-os rule-tier restructure — its own handoff is at
`~/projects/personal-os-improvements/docs/handoff-rule-tier-restructure-2026-08-25.md` (committed
`ca7b62b`). Nothing in this document depends on it.
