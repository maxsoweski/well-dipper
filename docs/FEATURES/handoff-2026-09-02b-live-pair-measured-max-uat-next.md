# Handoff 2026-09-02b — ⭐ THE RIVER ROUTER'S LIVE PAIR IS MEASURED (AC-4 / AC-5 / AC-6 lab clause) · the CORPUS RECORD was wrong and is corrected · NEXT = verdict re-run → `VERIFIED_PENDING_MAX` → Max's walk (AC-8)

> ✅✅ **SHIPPED 2026-09-02 (session 2).** Verdict `1ee0219` at `5c952e3` (unit PASS · integration PASS); **Max's UAT on rocky-4's outer planet, his words: *"The rivers are not fully developed but the wiring appears to be working here. The wiring for U is also working."*** Read as: the WIRE is accepted. ⭐ **MAX'S RULING, same session: *"I want to continue wiring up all the features from the world engine before we try to further develop any of them"*** — so "not fully developed" is DEFERRED (contract `shipped.followUp`) and **▶ NEXT = the next unwired F-row: PLAN queue (b) = F27/F28, the storm slice (`uStorm*` uniform family), then queue (c) as world-gen inputs allow, then the partials F3 (4/7) and F35 (3/4)** — each its own `dev-collab-scope` workstream, in a fresh session. Contract `shipped` (+ `shipped.followUp`), FEATURES.md row added (Rule 3). ⚠ The `.superpowers/sdd/2026-09-02-wire-river-router-lab-into-game/` ledger is left in place (git-ignored); delete when convenient — the rulings are in the commit messages and the contract.
> ⚠ **IN-REPO ON PURPOSE** (`/tmp` does not survive a WSL restart).
> ⛔ Supersedes `handoff-2026-09-02-river-router-built-live-pair-next.md` for the WORLD-ENGINE lane. That file's §3 traps still hold; two of its FACTS were wrong and are corrected in §2 below.

**Branch** `feature/world-engine-production-L1` · **Repo** `~/projects/well-dipper` (lane A, **NOT** master) · **HEAD** = `60e3bd7` (the ruling commit; ship `c565537`, verdict `1ee0219`, live pair `5c952e3`), **PUSHED 2026-09-02 — origin at `60e3bd7`, verified by `git ls-remote`**; later pushes are confirmed per batch (§5).
⛔ ~700 untracked PNGs are normal. NEVER `git add -A`. ⚠ ALWAYS `npx vitest run --dir tests` (the root config collects nested worktrees and vendor kits: 685 files vs 195).
⛔ **Two repos, diverged** — `~/projects/well-dipper-trunk` is `master` and deploys; it has all the mobile code and none of this.

---

## 0. STATE — workstream `docs/WORKSTREAMS/wire-river-router-lab-into-game/` (contract **`shipped`**; `verdict.json` re-run light at `5c952e3` = `1ee0219`: unit PASS · integration PASS · AC-8 deferred-to-max, then closed on Max's word)

| AC | what | state |
|---|---|---|
| AC-0 | one pipeline, root modules re-export, the lab reads pack #9 back | ✅ headless (at `a737ffd`) |
| AC-1 | every solid body gets the fluvial family from its condition | ✅ headless — **RE-MEASURED: wet 2 / relict 66 / airless 56** (was 4 / 64 / 56 — §2) |
| AC-2 | the worker's route IS the lab's route | ✅ headless — 68 routed, 0 orphans / 0 uphill, ocean 0.347–0.354, **2** wet networks recorded |
| AC-3 | routing surface = display surface | ✅ headless |
| AC-4 | LIVE relief A/B (key `U`) | ✅ **MEASURED 2026-09-02 session 2** — `rocky-14` p0m0 `body.planet.64b466` (0.948 R⊕, relict): 124,960 px ON/OFF, 0 outside the disc, floor 0, gas control 0, sabotage a third state (§1) |
| AC-5 | LIVE rivers A/B (key `J`) + the sea | ✅ **MEASURED** — `rocky-4` p5 `body.planet.8ad228` (0.449 R⊕, wet): 6,141 px ON/OFF, 0 outside, floor 0, ribbon alone 2,103 (visible, not buried), sabotage 228 px from OFF, airless control 0; `uSeaLevel` = the solved sea ≠ −1, `uCoastStrength` 1 |
| AC-6 | nothing else moves + the lab in Chrome | ✅ instruments at `a737ffd` (workflow re-measures) · **lab clause MEASURED**: 0 console errors, real 1024/256/256/128 cubes, Rivers toggle → ribbon (8,736 px) |
| AC-7 | lifetime + thread + recorded cost | ✅ headless; live costs one sample: wet 146.8 ms (route 110.3) · relict 82.2 (route 62.5), transport `'worker'` on every body |
| AC-8 | **Max:** rivers in their own valleys draining into a sea that looks right, deltas at the mouths — one coupled system | ✅ **Max, 2026-09-02 — his words in the banner; the wire accepted, "not fully developed" deferred by his ruling** |

Every live number, the arms and the instruments: **PLAN § THE RIVER ROUTER, WIRED → (viii) The live pair: MEASURED** (`docs/FEATURES/one-pipeline-two-frontends-PLAN.md`), mirrored as `liveEvidence` on AC-4 / AC-5 / AC-6 in `contract.json`.

## 1. WHAT THIS SESSION DID

1. **Drove the pair** on lane A's server (:5175, already up) + Chrome:9223 (already up), chrome-devtools only, never Sol, clean page load before every measured pair, `freezeFrame()` then `frameBody`. Instruments: page screenshots (compositor path, never `readPixels`), `scripts/shot-diff.mjs` with the `_lab.shotState()` sidecar + an ON/ON floor pair, and a pngjs per-pixel counter (threshold 2/255) that uses the sidecar's disc to count pixels OUTSIDE the body. The shots are in the session scratchpad, not committed.
2. **Found and fixed the corpus defect** (§2) in both corpus builders, re-measured every recorded count, corrected every doc that carried the old ones (PLAN, NOW, contract, intent, backlog QB-21/22/23, two code comments), and amended the AC-4 sabotage clause in place (dated).
3. **Extra data for Max's walk:** `U` on the WET body moves 48,928 px at strength 0.385 — both keys say something on `rocky-4` p5.

**The AC-4 sabotage is not the OFF frame, and cannot be.** The lab's crossover mixes analytic·(1−s) with cube·s; a 1×1 black placeholder at s≈1 is a *flattened* body — 130k px from OFF, 132k from ON, 0 outside the disc. The contract clause "returns to identical" was written on the province wire's MIX-KNOB model and does not transfer; the arm still proves a cube that never reached the material could not pass. Amended in `contract.json` AC-4 to "sabotage ≠ ON and ≠ OFF". AC-5's sabotage (placeholder carve + ribbon hidden at the ON amounts) IS ≈ OFF: 228 px (0.16 % of the disc), the amounts' cube-independent residual.

## 2. ⭐⭐ WHAT THE LIVE CHECK OVERTURNED — do not re-derive

1. **The corpus record was wrong; the wire was not.** The scripted body (`rocky-14`'s 0.948 R⊕ "wet moon") came up **RELICT** live (T_eq 409 K). Root cause, confirmed headless both ways: a PLANET-CLASS moon in `e.moons` is an **ENTRY wrapping `planetData`** (trap 3), exactly like a planet in `sys.planets`. Both corpus builders passed the wrapper to `conditionFromBody`, where `T_eq` defaulted to **288 K** (→ 310 K with greenhouse → wet). The game mounts the INNER record with the provenance stamps copied on (`src/main.js:7757`: `_systemSeed: systemData.seed, _ordinal: \`pm-${moonData._ordinal}\``) → 379 K raw → 409 K → relict. Fixed in `tests/river-bake-host.test.js` and `tests/driver-pack-fluvialdeck.test.js` (the read now mirrors the mount, minus render-only fields).
2. **Corrected corpus (24 `rocky-*` seeds, 124 solid / 32 gas): wet 2 · relict 66 · airless 56.** Routed still 68. Raw single-spelling read 2 / 0 / 122 (66 disagreements). Erosion carried on **124 of 124** (the old "2 of 124 without" were the two wrappers). Outflow non-zero on **68**; strandlines on **124**; the F13 ramp saturates on **62 of 66** relict (QB-23; was 60 of 64); erosion range on relict 0.325–1.0 (unchanged).
3. **The two wet worlds in the whole corpus: `rocky-2` p4 (0.446 R⊕, carbon, 110 K) and `rocky-4` p5 (0.449 R⊕, carbon, 87 K).** There is NO wet body in the relief A/B's 0.7–1.4 R⊕ window, so "one body does both A/Bs" does not exist; the pair ran on two bodies. Both wet worlds are Titan-cold carbon planets — that is the lab's own `liquidStability > 0.15` gate speaking, and it is one of Max's three open calls (NOW.md).
4. **The province suite has the same wrapper read** (`tests/province-bake-host.test.js:50`), and there it cuts the other way: read through `planetData` FRESH FROM THE GENERATOR (no stamps) the two planet-moons are REFUSED by `labPipelineAdmits` ("no `_systemSeed` / no `_ordinal`"), so its "156 bodies, all admitted" assertion would read 154 — while the live game admits and bakes them (rocky-14 p0m0 baked live, `isLabPipeline: true`). The mount-faithful read (`{ ...m.planetData, _systemSeed, _ordinal: 'pm-…' }`) is the fix there too. **Logged, NOT touched** — the province wire is shipped and that suite is its own lane's.
5. **ORRERY trap, sharpened.** After `spawnProceduralSystem` the orrery ARRIVAL ZOOM runs for a few seconds; a `frameBody` issued inside it leaves the group `visible: false` and nothing bakes. A SECOND `frameBody` after the zoom settles (≈ 5 s post-spawn) shows the group and the bake follows on the next frame. Reproduced twice (2 tries each system).
6. **HMR fired into the measurement session** when two source COMMENTS were edited mid-session (`fluvialDeck.js`, `provinceWorker.js`): `_labRelief` vanished from the page. Every AC-4 / AC-5 number predates those edits; the one shot taken after them was discarded and re-taken on a clean reload. ⛔ Edit `src` only after the browser work is done, or reload before every measured pair.

## 3. ⛔ TRAPS (this session's + the standing ones from 2026-09-02 §3, all still live)

1. ⛔ **A planet-class moon is an ENTRY** — read `m.planetData` + the mount's stamps (§2.1). Sibling of trap 3 ("a planet in `sys.planets` is an ENTRY").
2. ⛔ **ORRERY hides body groups until a post-zoom `frameBody`** (§2.5). "Nothing bakes" = nothing drawn, not a broken worker.
3. ⛔ **`frameBody` refuses an UNLIT subject** (night side under the freeze) — pick another body or thaw → frame → re-freeze; `rocky-4` p0m0 was dark, p2m0 was lit.
4. ⛔ **The lab's GUI is lil-gui with `lil-` prefixed classes** (`.lil-gui`, `.lil-title`, `.lil-controller.lil-boolean`); the Rivers enable is the TITLE-BAR checkbox of "Rivers & valleys (F11)"; `.click()` it — writing `state.riversEnabled` alone does not call `setRiverOverlay`. A checkbox click toggles from the DISPLAYED state, so read `checked` first.
5. ⛔ **A gated pack driver resolves to 0 when OFF** (`writePackUniforms.js:186`); `uSeaLevel` is emitted ungated for that reason.
6. ⛔ **Instrument A's stored baseline is stale** (2026-08-22, dirty tree): the measurement is the per-test-ID set diff on a clean worktree of the parent (`2e39f36`), never `check:instruments`' exit code.
7. ⚠ **`uReliefBakeCube.value` is the record's `.cube.texture`**, not `.cube` (a `WebGLCubeRenderTarget`) — compare against `.texture`.
8. ⚠ The verify workflow does NOT write `verdict.json`; it returns the structure and the controller writes the file. The last run's args: `mode:"full", liveBranch:"main"` (SDD ledger :95).
9. ⚠ vitest hides `console.info` on passing tests: write recorded numbers to a file. ⚠ The dev-server hook matches the server command's text anywhere in a Bash command — write such docs with the Write/Edit tool.

## 4. ▶ NEXT, in order

1. **Re-run the verdict at this commit:** `Workflow({scriptPath:"/home/ax/projects/personal-os-improvements/dev-collab/workflows/verify-workstream.mjs", args:{contractPath:"<repo>/docs/WORKSTREAMS/wire-river-router-lab-into-game/contract.json", mode:"light", commit:"<sha>", liveBranch:"main"}})` — AC-4 / AC-5 / AC-6's lab clause are integration ACs whose evidence is the `liveEvidence` fields + PLAN (viii); the workflow can audit the record but cannot re-drive Chrome (it marks UAT-layer ACs `deferred-to-max`, never PASS). Write the returned structure to `verdict.json`; contract `status` → `verified`; NOW.md gains `VERIFIED_PENDING_MAX <sha>`; commit.
2. **Max's walk (AC-8)** — §5. On his word: contract `shipped` + `FEATURES.md` row (Rule 3) + NOW.md + push. Then `rm -rf .superpowers/sdd/2026-09-02-wire-river-router-lab-into-game` (the git history is the record).
3. **Logged for other lanes, not this one:** the province suite's wrapper read (§2.4); QB-21 / QB-22 / QB-23; the phone VRAM question.

## 5. WORKING WITH MAX (delta)

- **His walk, in his frame:** warp to a `rocky-*` system and fly to **`rocky-4`'s OUTERMOST planet** (0.45 R⊕, the carbon world — one of exactly two wet worlds in the 24-seed corpus). Tap **`J`** and **`U`** *while moving in*. His question: *do the rivers sit in their own valleys and drain into a sea that looks right, with deltas at the mouths — one coupled system, not blue lines painted on a ball?* Its sea is small (histogram 35 % at a solved level near 0) and the world is Titan-cold; that IS the population under the lab's gate. For the Earth-sized relief look, `rocky-14`'s big moon (relict: carve + outflow channels, no sea, no ribbon) is the body. **Claude's route to the same bodies:** `_lab.spawnProceduralSystem('rocky-4')` → wait 5 s → `freezeFrame()` → `frameBody({kind:'planet',p:5},{radii:6})` twice → `frameBody(…,{radii:3})`.
- Three calls still his, none blocking (NOW.md item 2): QB-21 (the 35 % ocean on every wet world), QB-23 (F13 saturates on 62 of 66 relict), the wet density (2 of 124 ≈ 1.6 %). Plus the phone VRAM question.
- Push cadence unchanged: lane A pushes are confirmed per batch; ⛔ never push `master`. This session's commits are NOT pushed until he says so.

## Suggested skills
- **`superpowers:verification-before-completion`** before writing `VERIFIED_PENDING_MAX`.
- ⛔ **NOT `dev-collab-scope`** — the contract exists, is greenlit, and is one workflow run from `verified`.

## Not in scope
The grain cube · the view-dependent river LOD · `createHeightSampler` · the condition→coverage law (QB-21) · per-body admission in the lab (QB-22) · the F13 ramp (QB-23) · the province suite's wrapper read (§2.4) · the 108 KB `planet-lod-rivers.js` file move · Instrument A's re-bless · line-only citation rots outside CITE_SOURCES.
