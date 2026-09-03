# Handoff 2026-09-03 — ⭐ THE STORM SLICE (F27/F28, `uStorm*`) IS WIRED, LIVE-PAIR MEASURED · verdict at `378b352` = unit PASS · integration PASS · AC-8 deferred-to-max (verify-workstream `wf_14116a31-eca`, light re-run after the full run `wf_bb6e5172-5df` at `378b352`) · NEXT = Max's walk (AC-8) on `rocky-2`, key `I`

> ⚠ **IN-REPO ON PURPOSE** (`/tmp` does not survive a WSL restart).
> ⛔ Supersedes `handoff-2026-09-02b-live-pair-measured-max-uat-next.md` for the WORLD-ENGINE lane. Its §3 traps still hold and are extended in §3 below.

**Branch** `feature/world-engine-production-L1` · **Repo** `~/projects/well-dipper` (lane A, **NOT** master) · **HEAD** = the close-out commit carrying this file (see `git log -1`; the verified code is `f9da55d`) (scope `ea18406` → greenlight `520f2c0` → fixtures `9c3443e` → built `f8ea499` → live pair `378b352` → verdict `f9da55d`). **NOT PUSHED** — lane A pushes are confirmed per batch; origin is at `df94080`.
⛔ ~700 untracked PNGs are normal. NEVER `git add -A`. ⚠ ALWAYS `npx vitest run --dir tests`.
⛔ **Two repos, diverged** — `~/projects/well-dipper-trunk` is `master` and deploys; it has all the mobile code and none of this.

---

## 0. STATE — workstream `docs/WORKSTREAMS/wire-storm-slice-lab-into-game/` (contract **`verified` · `VERIFIED_PENDING_MAX f9da55d`**)

| AC | what | state |
|---|---|---|
| AC-0 | one pipeline: pack #10 `stormDeck` holds the colour law, deckZ law, slot composer + lab mirror; the lab imports them back; copies deleted | ✅ headless (deny/allow scans, registry identity, sibling fences) |
| AC-1 | the pack contract's ONE new shape (rows → `vec4[8]`); every pre-existing driver byte-inert | ✅ headless — fixture at `520f2c0`, 156 bodies + 18 presets; stormDeck the only emitter; writer controls throw |
| AC-2 | refactor byte-identity in the LAB — the pack's mirror + composer vs the lab's OWN pre-move output | ✅ headless — 92 rows × 4 checkbox combos, max delta 0; **deviations: none** |
| AC-3 | coherence with the `aStorm` mask (same vortices) | ✅ headless — 32/32 deep-equal; seed control red 32/32 |
| AC-4 | the population + distinctness | ✅ headless — 26 warm / 6 dark; 22 pearl / 4 barge+oval / 6 scooter; 2–7; ≥20 distinct lats+lons; 0 hot-Jupiter, 0 Uranian |
| AC-5 | LIVE storms A/B (key `I`) | ✅ **MEASURED 2026-09-03** — rocky-2 p2 Saturnian ON/OFF 14,405 px in-disc, 0 outside the body (1 limb px); sabotage a third state (26,391 / 23,446); restore exact (0); p5 Neptunian 5,046; solid control 0; re-approach identical |
| AC-6 | nothing else moves + the lab in Chrome | ✅ Instrument A vs the clean parent: only the new suite; B 8/8; C zero delta; 858/858 citations; lab: 0 script errors, combos 0/1/4/5, slot-sync, 🎲, `.listen()` |
| AC-7 | cost | ✅ 0.5 ms mean / 3.2 ms max per body; zero VRAM; no worker; no new ctx field |
| AC-8 | **Max:** the storms read as PART of the gas deck, same place on return, a different family on the next giant | ⏳ his walk (§5) |

Every live number: **PLAN § THE STORM SLICE, WIRED (vii)–(viii)** (`docs/FEATURES/one-pipeline-two-frontends-PLAN.md`, appended at EOF; the file is 1254 lines, still line-neutral below :24) and `contract.json` `liveEvidence`.

## 1. WHAT THIS SESSION DID

1. **Scoped** (intent + contract, population read at scoping: 32/32 corpus gas bodies storm) → Max: *"Greenlight"*.
2. **Captured two pre-change fixtures at `520f2c0`** BEFORE touching src: every pack's resolved drivers (`tests/fixtures/pack-drivers-baseline.json`) and the lab's storm state sliced from the pinned blob and run through `new Function` (`scripts/capture-storm-lab-baseline.mjs` → `tests/fixtures/storm-lab-state-baseline.json`).
3. **Built** pack #10 + the writer extension + the lab import-back (line-neutral) + the A/B instrument; 26-test suite; re-pointed 7 fences with dated reasons on the line.
4. **Full suite diffed per test ID against the parent in a clean worktree** (`git worktree add … 520f2c0` + a node_modules symlink): the same 20 failures, none new. Instrument A run against a baseline recorded from that clean run (`--baseline=<scratch path>`, so the repo's stale 2026-08-22 baseline was not re-blessed).
5. **Drove the live pair** on rocky-2 (§0 AC-5) and the lab clause; wrote the PLAN addendum; contract → `verifying`; launched `verify-workstream` (`wf_bb6e5172-5df`).

## 2. ⭐ WHAT THE BUILD OVERTURNED — do not re-derive

1. **The writer edit MUST NOT insert lines.** `writePackUniforms.js` is cited by line+symbol from 12 files (`:180`, `:186`, `:191`, `:219`, `:220`, `:240`, `:280`, `:306`). My first version inserted two blocks and broke 28 citations; the fix was two expanded lines + helpers at EOF (`isVectorRows` / `assertVectorRows` / `writeVectorRows`).
2. **The lab's `applyStormState` rewrite must keep `polarDeckPack` on :1916 and `Object.assign(state, polarDeckLabState(_pd))` on :1920** — cited from polarDeck.js, the PLAN and CARRIED. Pad with `//` lines to place them.
3. **Two full-suite failures predate this wire** and fail identically at `520f2c0` in a clean worktree: the gas-deck `[CONTROL] every deny pattern MATCHED the lab before this change` (its pinned blob `4e864bc` predates the lab's rename from `planet-lod-lab.html`) and gas-body's `BodyRenderer.setLOD / setReliefDetail` (uOctaves 1). Recorded, not fixed — not this lane's.
4. **`spotAge` / `spotEmboss` / `spotBillow` were never in the lab's `state` literal** — `applyStormState` created them dynamically; the mirror does the same, so the shrink-only ratchet sees no new field.
5. **The verify workflow's FULL run caught two of my claims, both fair** (contract `amendments`): (a) AC-3's written control "perturb T_eq by 1 K" is unreachable — T_eq reaches the vortices only through the vigor thresholds (0 of 32 by family, 2 of 32 by vortex list); replaced by a threshold crossing that flips 32/32, the nudge pinned at its measured count; (b) the QB-24 backlog row shifted `mvp-spine-lab-quality-backlog.md:87` → :88 under PLAN:75's citation AFTER I had measured 858/858 — re-pointed in place. ⭐ Lesson: run `--check-citations` as the LAST thing before a commit, after every doc row insert, not before.
6. **The lab persists its GUI state** (both storm checkboxes were already ON when the lab opened) — restore whatever you flip.

## 3. ⛔ TRAPS (this session's + the standing ones)

1. ⛔ **The dev-server hook matches the server's NAME anywhere in a Bash command** — even a config-file glob. Use `ls v*.config.*` or the Read tool.
2. ⛔ **A `cd` into a worktree that you then remove leaves the shell's cwd dead** — prefix the next command with `cd /home/ax/projects/well-dipper`.
3. ⛔ **`makeUniforms(LAB_WORLD_LIGHT)`** — it takes the lab light; a bare call reads `.x` of undefined.
4. ⛔ **`_lab.resolveBody({kind:'planet', p}).mesh` is the surface** `_labStorms.slots()` / `record()` want; `frameBody` returns only lighting + body ids.
5. ⚠ **The lab page URL is `http://localhost:5175/well-dipper/world-engine-lab.html`**; its only console error is `/favicon.ico` 404.
6. ⚠ `_labStorms.toggle()` flips EVERY registered gas material — a solid-body control is meaningful only because solid bodies never register.
7. ⚠ The sabotage arm writes the material's slots through the real writer; `restore()` re-derives at `GAME_STORM_SEED` and `record()` says which state the surface is in — read it before any measured pair.
8. (standing) trap 3 (planet-class moons are ENTRIES), the ORRERY zoom (second `frameBody` ≈ 5 s post-spawn), `frameBody` refuses an unlit subject (rocky-2 p0 was dark, p1 lit), lil-gui `lil-` classes, gated pack drivers resolve to 0 when OFF, Instrument A's stored baseline is stale (measure against a clean parent worktree), vitest hides console on pass (write files), HMR fires on src edits (reload before every measured pair).

## 4. ▶ NEXT, in order

1. **Max's walk is the only open gate.** The verdict is written (`verdict.json`); nothing else runs before his word. Housekeeping already landed in the follow-up commit: Instrument A's stored baseline (`tests/baseline/known-failures.json`, stale at `2f7402f` from a dirty tree) re-recorded from a clean full run at HEAD — if `git log` does not show it, do it (`npm run test:baseline:record` from a clean tree) before the next lane trips on it.
2. **Max's walk (AC-8)** — §5. On his word: contract `shipped` (+ `shipped.uat` + `shipped.followUp`) + `docs/FEATURES.md` row (Rule 3, the world-engine row) + NOW.md + cards; push on his say-so.
3. Then queue (c) as world-gen inputs allow (`uRayBrightness ≡ 0`, `uFacetStrength ≡ 0`, `habGate ≡ 0` — world-generation work, not wiring), and the partials F3 (4/7) / F35 (3/4) — each its own `dev-collab-scope` workstream in a fresh session.
4. **Logged for other lanes:** QB-24 (vigor ramp saturates on 20 of 32 game gas bodies); the two pre-existing suite failures (§2.3); the province suite's wrapper read (river handoff §2.4).

## 5. WORKING WITH MAX (delta)

- **His walk, in his frame:** deep link `?system=rocky-2`. Fly in on the **Saturnian** (the 12.6 R⊕ giant, third planet out: a warm red oval at 19° north with four pearls on the same belt) and tap **`I`** while moving in; then the **Neptunian** (the 0.84 R⊕ ice giant, sixth planet out: a dark cleared spot at 19° south with a bright companion and one small scooter). Leave and come back — same storms, same place. His question: *do the storms read as PART of the gas deck — riding its bands, the bands wrapping around them — and does the next gas giant carry a different family?* QB-16 (the spot "does not blend correctly with the rest of the gas") and QB-18 (ink-in-water) will be visible and are deferred by his 2026-09-02 ruling — not this gate. **Claude's route:** `_lab.spawnProceduralSystem('rocky-2')` → wait 5 s → `freezeFrame()` → `frameBody({kind:'planet',p:2},{radii:3})` twice.
- Push cadence unchanged: lane A pushes confirmed per batch; ⛔ never push `master`. This session's commits are NOT pushed.

## Suggested skills
- **`superpowers:verification-before-completion`** before writing `shipped`.
- ⛔ **NOT `dev-collab-scope`** for this workstream — it is one walk from shipped. YES for the next F-row.

## Not in scope
QB-16 / QB-18 / QB-24 · slot animation · obliquity for game gas bodies · a storm-seed UI · the two pre-existing suite failures · Instrument A's stored-baseline re-bless (still stale at 2026-08-22; the measurement is the clean-parent diff).
