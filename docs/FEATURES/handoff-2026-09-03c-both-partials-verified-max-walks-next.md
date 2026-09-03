# Handoff 2026-09-03c — ⭐ F3 EJECTA RAYS = `VERIFIED_PENDING_MAX 6d70d56` · F35 TERMINATOR = built, merged, live-measured, at `verifying` (full verify `wf_7172985a-9a3` at `2e60453`) · NEXT = Max's TWO walks, then ship both, then push

> ⚠ **IN-REPO ON PURPOSE.** Supersedes `handoff-2026-09-03b-last-partials-scoped-greenlight-next.md`; its §2 traps still hold and are extended in §3 below.
> **Branch** `feature/world-engine-production-L1` · **Repo** `~/projects/well-dipper` (lane A, NOT master) · origin at `dc03fc6` (the greenlight push); everything after is **NOT pushed** — push on Max's word. ⛔ ~700 untracked PNGs are normal, NEVER `git add -A`. ⚠ ALWAYS `npx vitest run --dir tests`.

## 0. STATE

| workstream | status | commit | Max's gate |
|---|---|---|---|
| `wire-ejecta-rays-lab-into-game` (F3 → ✅ 7/7) | **`shipped` `649e669`** — Max's UAT 2026-09-03: *"they do read as spokes"*; previously `verified` — `verdict.json` composed from the full run (AC-1/2/6 PASS 3/3) + the light run (AC-0 PASS) + working-Claude's measured AC-3 repair and AC-4/AC-5 drives, provenance per row | verified `6d70d56`, verdict `2e60453` | **his walk (AC-7)** |
| `wire-terminator-gradient-lab-into-game` (F35 → ✅ 4/4) | **`verified`** — `verdict.json` composed from the full run (AC-0/1 PASS 3/3) + working-Claude's repairs (Instrument C re-blessed on the intended delta; the nine re-pointed lines; artifacts in-repo) and live drives (AC-3/AC-4) | verified `2e60453`, verdict `e7a3050` | **his walk (AC-5)** |

Both PLAN rows are flipped in place; the two addenda (§ THE EJECTA RAYS, WIRED; § THE TERMINATOR, CONVERGED) are at EOF of `one-pipeline-two-frontends-PLAN.md`; the F3 card carries its wired line; the F35 card's line is written at ship (the F27 precedent). Backlog: QB-25..28. NOW.md banner in. Instrument A re-recorded at `eb58ac9` (`6d70d56`).

## 1. WHAT THIS SESSION FOUND (do not re-derive)

1. **The rays' input was never dead** — the plan's 100 %-`hasAtmo` count was planets-only; every plain moon is airless (56/124), rays render on the 52 with a crater host. One law module, three names in the crater block, read off the CONDITION (not `craterUniformsFrom` — `CRATERS_OFF` has no key). Ray brightness is per-SYSTEM (19 values / 56 moons — QB-25). The two biggest airless moons in the corpus have no crater schedule.
2. **The game drew the terminator band Max turned off** (2026-07-16). The lab's OFF lives in the preset dressing table (`planet-feature-associations.js`), not the state literal. Now one constant `TERMINATOR_ENABLED` read by a RULED gate policy and both lab producers; 100 bodies moved 0.15 → 0 (one at 0.1303); `uTermStrength` re-opens in the parity ledger because `Planet.js:1653` (legacy, Sol) still writes it — declared, not converged.
3. **Live numbers:** rays m3 21,181 px / m5 24,743 px (15–17 % of disc), controls 0, 20-radii 366 px; terminator p1 33,435 px (23.4 %) at lit 0.50, airless moon 0, gas 97,073 px; restores exact.
4. **Instrument facts:** AC-6's +10 % wall-clock bar flipped 0.87× → 1.40× on identical code — withdrawn for an absolute + 2× ceiling. Instrument A's old record never covered `src/**/__tests__` (27 pre-existing failures, identical at a clean parent) — re-recorded with the IDs named.

## 2. ▶ NEXT, in order

1. ~~F35 verdict~~ DONE (`e7a3050`); F3 SHIPPED (`649e669`, FEATURES.md `220d32e`).
2. **Max's terminator walk** (§4; the rays walk is done). On his word per workstream: contract `shipped` (+ `shipped.uat`, `shipped.followUp`), FEATURES.md row (Rule 3, the world-engine row), the card line (F35), NOW.md, then **push lane A** (≈ 17 commits since `dc03fc6`) on his say-so. ⛔ never `master`.
3. After both ship: **the wiring pass is DONE** — every F-row the lab has is wired except queue (c) (F43 `uFacetStrength` — `retained === false` unreachable; F46 `habGate`), which is world-generation work. The 2026-09-02 ruling ("wire everything before developing anything") is then satisfied and the parked development items come back to Max as a list: river look (QB-21/22/23), storm blend/ink (QB-16/18/24), the ray full-disk treatment + truncation, the per-system erosion (QB-25), the lighting engine / F52 (the terminator's owner).

## 3. ⛔ TRAPS (new; the 09-03b list still holds)

1. ⛔ **`Agent(isolation:"worktree")` creates the worktree on MASTER** — the F35 builder had to reset it onto lane A. Check `git log -1` in the worktree first. And it lives UNDER the repo (`.claude/worktrees/`), where vitest collects it: remove it before any instrument run (`git worktree remove --force`); a stale `wf_440dc97c-63b-4` is still there.
2. ⛔ **The citation checker parses `:NNNN` after ANY preceding filename** — "the lab's :5365" after `craterDeck.js` reads as `craterDeck.js:5365`. Write `world-engine-lab.html:5365`. And `--check-citations | tail -1` hides the exit code — grep for `Exit 0` before `&&`-chaining a commit (bitten once).
3. ⚠ `verify-workstream` in `light` mode scores only what it audits (AC-0 here) and leaves the rest INSUFFICIENT — that is not a fail. A full run costs ≈ 3 M subagent tokens; compose the verdict from the runs + measured repairs (this session's F3 shape) when the repairs are instrument-level.
4. ⚠ `code-explorer` / `Explore` agents have no Bash/Write; `general-purpose` (opus) for anything that runs a script.
5. ⚠ Rays multiply the crater host — pre-flight every live subject (`craterRelevanceOf === 1`, `density ≥ 0.5`); a sabotage write onto an air body without craters moves 0 px.
6. ⚠ `_lab.shotState()` is async, takes `{ body, region }`; `frameBody` re-frames to a LIT view — a crescent needs `setCameraPose` rotation, lit fraction read LAST; `packsApplied` is the key (not `packs`); gas `termWidth` settles ≈ 1.5 s after a preset change (QB-28).

## 4. WORKING WITH MAX — the two walks

- **Rays (F3, AC-7):** `?system=rocky-13`, the **fifth planet's ice moons** ("f IV" 1.06 R⊕ and "Dione" 0.96 R⊕, named in the orrery), tap **`Y`** while moving in; then any planet with air ("Paurosgara", the second) and `Y` again — nothing changes. *Do the bright rays read as spokes thrown from their own young craters, lit only on the day side, and stay off on worlds with air?* The "clipped square" truncation at full-disk and whether the rays are GOOD are deferred lab items. The fifth planet's FIRST moon and the fourth planet's two big moons have no craters — rays cannot show there.
- **Terminator (F35, AC-5):** `?system=rocky-2`, the **second planet** (0.72 R⊕, rocky) with the day/night line across the disc, tap **`.`** while moving in — the warm band appears and vanishes; OFF is what ships (his 2026-07-16 ruling). *Does the razor terminator read right while the lighting engine waits — or does he want the band back in the game meanwhile?* Either answer is one constant; the lab follows it.
- Subagents: opus pinned throughout (his 2026-09-03 instruction). Spend this session: two builders ≈ 0.7 M, two live drives ≈ 0.7 M, the contract review 0.76 M, F3 verify 2.9 M + 0.34 M, F35 verify running.
