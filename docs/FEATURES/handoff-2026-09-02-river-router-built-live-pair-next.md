# Handoff 2026-09-02 — ⭐ THE RIVER ROUTER (F11/F12) IS BUILT + FENCE-GREEN · the LIVE PAIR is the next item (needs Max's server) · then Max's UAT

> ⚠ **IN-REPO ON PURPOSE** (`/tmp` does not survive a WSL restart).
> ⛔ Supersedes `handoff-2026-09-01b-province-cube-wired-live-check-next.md` for the WORLD-ENGINE lane; that file's §3 traps still hold and are re-listed below.

**Branch** `feature/world-engine-production-L1` · **Repo** `~/projects/well-dipper` (lane A, **NOT** master) · **HEAD `a737ffd (+ the close-out docs commit that carries this handoff)`**, clean, **PUSHED 2026-09-02 — origin at `08946b7` (+ this handoff commit)**; later pushes are confirmed per batch.
⛔ ~700 untracked PNGs are normal. NEVER `git add -A`. ⚠ ALWAYS `npx vitest run --dir tests` (the root config collects nested worktrees and vendor kits: 685 files vs 195).
⛔ **Two repos, diverged** — `~/projects/well-dipper-trunk` is `master` and deploys; it has all the mobile code and none of this.

---

## 0. STATE — workstream `docs/WORKSTREAMS/wire-river-router-lab-into-game/` (contract `verifying`, `verdict.json` at `a737ffd`)

`verdict.json` at `a737ffd`: AC-0/1/2/3/7 PASS (2–3 of 3 adversarial votes), AC-4/AC-5 INSUFFICIENT = the live pair, AC-6 INSUFFICIENT only on its lab-in-Chrome clause (fold into the live pass), AC-8 deferred-to-max.

| AC | what | state |
|---|---|---|
| AC-0 | one pipeline: router core / bakers / fluvial pack defined once under `src/`, root modules re-export; the lab reads pack #9 back at `:2136` | ✅ headless (`tests/river-bake-host.test.js`, `tests/driver-pack-fluvialdeck.test.js`); the `_fp`→`_dp` seam delta is DECLARED + pinned (§H): 11 of 72 preset×seed combos move on uLiquidMask/seaLevel, 24 on uFluvialDepth |
| AC-1 | every solid body gets the fluvial family from its condition | ✅ workflow PASS 3/3 — wet 4 / relict 64 / airless 56 of 124 (ROOT-0 fix 1 applied to its third reader: `erosion ?? erosionLevel`) |
| AC-2 | the worker's route IS the lab's route | ✅ headless — byte-identical on both `compositeMargins` arms; 68 routed; 0 orphans / 0 uphill; ocean 0.347–0.354; maxStrahler + R_b recorded per wet body |
| AC-3 | routing surface = display surface (strength law) | ✅ workflow PASS 2/3 — 0 routed bodies at crossover 0 |
| AC-4 | LIVE relief A/B (key `U`) | ⏳ **PENDING Max's server** — drive below |
| AC-5 | LIVE rivers A/B (key `J`) + the sea | ⏳ **PENDING Max's server** — drive below |
| AC-6 | nothing else moves | ✅ measured on a clean worktree of `2e39f36`: 20 failing / 8 files on both trees, set-diff empty; B 8/8; C 0/57; citations 858/858 |
| AC-7 | lifetime + thread + recorded cost | ✅ headless — 4 cubes + ribbon disposed once; late reply dropped; worker chunk emitted; timings best-of-3 recorded |
| AC-8 | **Max:** rivers on the planet's own terrain, draining into a sea that looks right, deltas at the mouths — one coupled system | ⏳ after AC-4/5 |

`surface.userData.wd.lab.bake` (= `.province`, same object) carries `{ baked, transport, ms, routeMs, relief: {strength, restore}, rivers: {class, routed, admitted, seaLevel}, bytes }`. Dev APIs: `_labProvince`, `_labRivers { toggle, count, class(surface) }`, `_labRelief { toggle, strength(surface) }`. Keys: `V` province · `J` rivers · `U` relief.

## 1. WHAT SHIPPED — commits `2ce7ba3..a737ffd (+ the close-out docs commit that carries this handoff)` (read the messages; each carries its record)

- **Moves (byte-verbatim vs `3dded82`):** router core → `src/worldengine/rivers/{router,ribbon,seaLevel}.js`; bakers → `src/rendering/bake/{carveCube,heightCube}.js`; root modules re-export; `route()` untouched.
- **Pack #9 `src/worldengine/drivers/fluvialDeck.js`** — ten uniforms, three gates (deltas/coast/outflow), `uSeaLevel` ungated (an OFF gate resolves to 0 = a sea at height zero), `uFluvialDensity` not emitted (the lab pins it 0). `fluvialClassOf(condition)` is the ONE class source (host, worker, tests).
- **Bundle + worker** — `buildLabBundleForBody` mirrors `route()` step for step (base params for `routeAndOrder`, `pEff` for the two builders); one message per body; ribbon built only for `wet`.
- **Host** — `attachLabBake`/`disposeLabBake` (province aliases kept); relief + crater cubes on every solid body, carve cube on routed, ribbon + histogram sea + the lab's carve amounts on wet; sea −1 at attach (arrives with the rivers); the record owns every render target from allocation; a failed or class-disagreeing wet bake gives the pack's sea back.
- **Docs:** PLAN rows F11/F12/F13/F14/F20 ✅ (live pair pending), queue (b) = F27/F28 only, § THE RIVER ROUTER, WIRED at EOF; backlog QB-21 (35 % ocean constant), QB-22 (global rivers toggle), QB-23 (F13 ramp saturates: 60 of 64 relict at 1.0); `NOW.md` top block.

## 2. ⭐⭐ WHAT THE DATA OVERTURNED — do not re-derive

1. **F11/F12 were never "inert".** The .00014 measured the retired worm-trail; the dendritic overlay is the feature (backlog :87).
2. **The lab's block was the missed third reader of ROOT-0 fix 1.** `surfaceHistory.erosion` vs the game's `erosionLevel`: single-spelling = 4/0/120, dual = 4/64/56. The relict population (64) is the DOMINANT outcome of this wire — carve + outflow + deltas at the mouths of an undrawn 35 % sea, no ribbon, no sea — and nobody has seen one.
3. **Only 4 of 124 corpus bodies are wet** under the lab's own gate (`liquidStability > 0.15`): rocky-2 planet (0.446 R⊕, strength 0.377), rocky-4 planet (0.449, 0.385), **rocky-14 moon (0.948, 0.996)**, rocky-15 moon (0.354, 0.157).
4. **The `_fp`→`_dp` seam moves the LAB's own values** (the other seven packs already did): Rocky (Earthlike) seed 0 uLiquidMask 0.295→0.372, seaLevel −0.052→−0.014; uFluvialDepth moves on 24/72 (radius-aware gravity). Declared in AC-0, pinned in §H — not byte-identity.
5. **VRAM is per ROUTED body, not per wet body:** 57.3 MB carve+relief+crater+province per routed body + 7.0 MB per other solid body ⇒ **204 MB mean / 300 MB worst per procedural system** (max 5 routed). Unbudgeted; recorded in `record.bytes`; the phone is the instrument.
6. **Timings (40k mesh, best-of-3 (worst), ms):** wet 57.6 (94.5) dispatch / 57.2 (97.9) route; relict 32.6 / 56.1; airless 46.8 / 3.4. CPU floor; the cube renders are on top.

## 3. ⛔ TRAPS (this session's + the standing ones)

1. ⛔ **A gated pack driver resolves to 0 when OFF** (`writePackUniforms.js:186`); for `uSeaLevel` that is a sea, not no-sea → emit it ungated.
2. ⛔ **Instrument A's stored baseline is stale** (2026-08-22, dirty tree): `check:instruments` exits 1 on BOTH the parent and HEAD with the identical NEWLY-RED set; the measurement is the per-test-ID set diff on a clean worktree (raw vitest JSON). The two `moon-*` suites and their 3 failures are in the stored known-failures and fail at the parent.
3. ⛔ A planet in `sys.planets` is an ENTRY wrapping `planetData` (`e.planetData || e`). Moons are records.
4. ⛔ An import appended after a trailing `// comment` is a comment. Split at the comment.
5. ⚠ The citation fence reads live `file:NNN` refs; historical ranges are "`file` lines N–M (at `<sha>`)". Root-file shrinks rot line-only refs the fence cannot see (44 in archived docs; ~60 more into the lab, pre-existing).
6. ⚠ Timings under a parallel full-suite run measure contention (3.4× spread): best-of-N with the spread, never one sample.
7. ⚠ The dev-server hook matches the server command's text anywhere in a Bash command. Write such docs with the Write/Edit tool.
8. ⚠ vitest hides `console.info` on passing tests: write recorded numbers to a file.
9. ⚠ The verify workflow does NOT write `verdict.json`; it returns the structure — the controller writes the file.

## 4. ▶ NEXT — THE LIVE PAIR (AC-4 / AC-5), then Max's UAT (AC-8)

**Needs Max** (only he starts servers): in `~/projects/well-dipper`, the dev server on lane A's port (`scripts/dev.sh` — the command is in `NOW.md`'s OPEN-FOR-MAX item 1). Chrome:9223 is Claude's (`chrome-devtools-9223-launch` memory: interop launch, sandbox OFF).

**Drive (chrome-devtools, never Sol), ONE body does both A/Bs:** open `http://localhost:5175/well-dipper/`; `_lab.spawnProceduralSystem('rocky-14')`; FREEZE FIRST, then `_lab.frameBody(...)` the **moon** whose `condition.radiusEarth ≈ 0.948` (read `resolvedBy` on the result; confirm `userData.wd.lab.bake.rivers.class === 'wet'` and `.baked === true` — wait for it; `transport` should read `'worker'`). Screenshot ON. **AC-4:** `_labRelief.toggle()` (or key `U`) → screenshot → diff: pixels differ on the body only; sabotage: rebind the placeholder relief + crater cubes at the live strength → identical to OFF; control: a gas body → identical. **AC-5:** `_labRivers.toggle()` (key `J`) → screenshot → diff: differ on the body only; assert `uRiverCarveMap.value` is a real cube, the ribbon is a child, `uSeaLevel === record.rivers.seaLevel !== -1`, `uCoastStrength === 1`; sabotage: placeholder carve cube + ribbon hidden → identical to OFF; control: an airless body under the same flip → identical, `uSeaLevel === -1`. **Screenshots, never `readPixels`.** Restore both toggles, park the tab on `about:blank`, record the pixel counts in the PLAN addendum (vii) and the contract, then `verify-workstream` with `mode:"light"` → `VERIFIED_PENDING_MAX <sha>`.

**Also look at (headless can't):** the ribbon's seat at `bodyRadius × 1.0014` on the game's `SphereGeometry(r, 96, 48)` — "no ribbon visible" has two causes (buried vs absent); a RELICT body (e.g. any `rocky-4` solid body) — carve + deltas with no sea, the population Max will see most; the lab itself loaded once (its import-line edit has not been seen in a browser).

**Max's walk (AC-8):** `rocky-14`, fly toward the moon, tap `J` and `U` while moving. His question, in his frame: do the rivers sit in their own valleys and drain into a sea that looks right, with deltas at the mouths — one coupled system, not blue lines painted on a ball. His answer closes AC-8 → Shipped on his word → FEATURES.md row (Rule 3) → push.

## 5. WORKING WITH MAX (delta)

- He greenlit the contract with "Greenlight and go with your recommendations" — the three scoping decisions (rivers on by default; the lab's 35 % ocean; the relief cubes riding along) are his by that word. Three NEW calls are his and sit in `NOW.md`: the 35 % ocean on every wet world (QB-21), F13 outflow saturating (QB-23), only 4 wet worlds in 24 systems.
- Push cadence unchanged: lane A pushes are confirmed per branch; ⛔ never push `master`.

## 6. SESSION RECORD — the 2026-09-02 build session (for the agent that continues)

**How this was built:** `dev-collab-scope` → the plan `docs/superpowers/plans/2026-09-02-wire-river-router-lab-into-game.md` (8 tasks) → `superpowers:subagent-driven-development` (fresh implementer + task review per task, one fix round each on Tasks 1/3/4/5, a whole-branch review, one fix wave, one scoped re-review) → the `verify-workstream` workflow twice (`dcdd431`, then `a737ffd` = the verdict) → the close-out commit `08946b7`. **Every controller ruling, deferred minor, and parked finding is in the SDD ledger** `.superpowers/sdd/2026-09-02-wire-river-router-lab-into-game/progress.md` (git-ignored; `git clean -fdx` destroys it — the rulings are also listed in `git log 3dded82..08946b7` messages and in the contract's amended clauses). The per-task reports and review packages sit beside it. The ledger's `Ruling:` lines are exhaustive; read them before re-deciding anything.

**Pushed 2026-09-02:** origin `feature/world-engine-production-L1` at `08946b7` (+ this handoff commit), Max's word: *"push; let's /handoff to a fresh session and continue"*.

**Max's answers this session:** greenlit the contract as scoped (*"Greenlight and go with your recommendations"* — rivers on by default, the lab's 35 % ocean, relief cubes riding along); push confirmed. **Still open, carried in `NOW.md` OPEN FOR MAX:** F13 outflow saturating on 60 of 64 relict worlds (recommendation: pass for now, judge on a relict world); only 4 wet worlds in 24 systems (recommendation: pass for now, lab-model row).

**The next session's sequence, in order:** (1) Max starts lane A's server (`scripts/dev.sh` from `~/projects/well-dipper`); Claude launches Chrome:9223 (sandbox OFF). (2) Drive §4 on `rocky-14`'s moon: AC-4 (`U`), AC-5 (`J`), sabotage arms, controls; also load the lab once (AC-6's lab-in-Chrome clause) and look at one relict body. (3) Record the pixel counts in PLAN addendum (vii) + the contract; `verify-workstream` with `mode:"light"` at that commit; write `verdict.json` from the result (the script returns it, it does not write the file); contract → `verified`, `VERIFIED_PENDING_MAX <sha>`. (4) Max's walk (AC-8). (5) On his word: contract `shipped` + `FEATURES.md` row (Rule 3) + `NOW.md` + push. Then `rm -rf .superpowers/sdd/2026-09-02-wire-river-router-lab-into-game` (the git history is the record).

**If the live pair does NOT differ:** check, in order, `surface.userData.wd.lab.bake.transport` (`'sync'` = the worker chunk failed to load: `vite.config.js` base `/well-dipper/` in dev), `.baked`, `.rivers.class` (must be `'wet'` on the moon), `.rivers.admitted`, the `[lab bake]` console warnings (class disagreement / pack sea restored), then the ribbon's seat (buried vs absent — `bodyRadius × 1.0014` over the game's `SphereGeometry(r, 96, 48)`).

## Suggested skills
- **`superpowers:verification-before-completion`** — the live pair is the half of this wire nobody has seen.
- **`superpowers:systematic-debugging`** if the live pair does not differ (start with `transport`, `baked`, `classAgrees`, then the ribbon's seat).
- ⛔ **NOT `dev-collab-scope`** — the contract exists and is greenlit.

## Not in scope
The grain cube · the view-dependent river LOD (`uRiverCarvePatchMap`, spike `building`) · `createHeightSampler` (stays root; the fence's one allowlist entry) · the condition→coverage law (QB-21) · per-body admission in the lab (QB-22) · the F13 ramp (QB-23) · the 108 KB `planet-lod-rivers.js` file move · Instrument A's re-bless · the ~100 line-only citation rots outside CITE_SOURCES.
