# Handoff 2026-09-01b — ✅ THE PROVINCE CUBE IS SHIPPED (Max UAT 2026-09-02) · the lane's next item is NOT scoped — ask Max

> ⚠ **IN-REPO ON PURPOSE** (the handoff skill says OS temp; `/tmp` does not survive a WSL restart — it cost a session on 2026-08-25).
> ⛔ Supersedes `handoff-2026-09-01-mobile-pass-shipped-helm-look-live.md` for the WORLD-ENGINE lane only; that file's mobile facts and its §3 traps still hold.

**Branch** `feature/world-engine-production-L1` · **Repo** `~/projects/well-dipper` (lane A, **NOT** master) · **HEAD `ccee0d1`**, clean, **NOT pushed** (origin is at `dbe17e5`; Max confirms pushes per branch).
⛔ ~700 untracked PNGs are normal. NEVER `git add -A`. ⚠ ALWAYS `npx vitest run --dir tests`.
⛔ **Two repos, diverged** — `~/projects/well-dipper-trunk` is `master` and deploys; it has all the mobile code and none of this. Read `docs/FEATURES/mobile-fixes-live-on-master-2026-08-28.md` before any merge.

---

## 0. STATE — workstream `docs/WORKSTREAMS/wire-province-cube-lab-into-game/`

| AC | what | state |
|---|---|---|
| AC-0 | one pipeline: moved code defined once under `src/`, root modules re-export | ✅ `tests/province-bake-host.test.js` |
| AC-1 | every admitted solid body gets its province from the lab's dispatch; gas none; byte-identical to the lab's path | ✅ 156 bodies / 124 solid / 32 gas |
| AC-2 | the game's mesh IS the lab's (40000 / 4), pinned to `DEFAULT_PARAMS` | ✅ — **re-derived on measurement**, see §2 |
| AC-3 | LIVE: same body, same camera, `uProvinceColorMix` 0.65 vs 0 → pixels differ + sabotage arm + gas control | ✅ **DRIVEN 2026-09-01 late** — 3,540 px differ, ALL inside the body; placeholder re-bound ⇒ identical to OFF; gas body 0 px. See §4 |
| AC-4 | nothing else moves: A / B / C / citations · the lab still bakes | ✅ B 8/8 · C zero delta · 850/850 · A: 19 reds all pre-existing at HEAD (§3) · **lab leg DRIVEN**: `_lab.provinceProbe()` on Rocky (Earthlike) = 26,818 / 3,041 / 10,141 over 40,000 nodes, η² 0.52 pass |
| AC-5 | bake once on first drawn frame, dispose once, worker transport + sync fallback, late reply dropped | ✅ |
| AC-6 | **Max:** flying in on a rocky/icy body, tap `V` — does the ground read as kinds of crust? | ✅ **Max UAT 2026-09-02 — "it does read as a crust and coheres"** — rocky-6, first planet, key V while approaching. Contract `shipped`. |

Instrument E-style back-link: `surface.userData.wd.lab.province` carries `{attached, transport, baked, path, ms, bakeMs, nodes, fractions, …}` per body. `globalThis._labProvince.{toggle,set,count,transport,meshBuilds,meshMs}` is the dev API.

## 1. WHAT SHIPPED — read `ccee0d1`'s message, it carries the full record

- **Moves, byte-verbatim, diffed against HEAD:** `planet-lod-rivers.js` lines 376–429 (at `dbe17e5`) → `src/worldengine/mesh/sphereMesh.js`; `planet-lod-tectonic.js` lines 360–460 → `src/rendering/bake/provinceCube.js`. Both root modules import back + re-export (the `bodyRelief.js` precedent). Boundary fence allowlist still exactly one entry; its `why`/`clears` text now records C25 as TAKEN.
- **New:** `src/rendering/bake/provinceDispatch.js` (CPU) · `provinceWorker.js` (transport) · `labBakeHost.js` (GPU + lifetime + key `V`). Read the three headers; each states function, intent and non-goals.
- **Mount:** `Planet.js:4` import and `:2076` attach ride existing lines; `:2001` and `Moon.js:704` dispose ride existing lines. Both files are symbol-cited; line counts unchanged (2309 / 706).
- **Docs:** PLAN `:132` queue (b) updated on the line; **§ THE PROVINCE CUBE, WIRED** appended at EOF; **QB-20** (despun body-blindness) in `mvp-spine-lab-quality-backlog.md`; `NOW.md` top block REPLACED at the same line count.

## 2. ⭐⭐ THE TWO THINGS THE DATA OVERTURNED — do not re-derive

1. **The handoff said the pieces were unwritten. They were unreachable.** Both existed in root modules the boundary fence keeps out of `src/`. A move, not a build.
2. **Mesh resolution is not a free parameter for the PATTERN.** The appendix measured class *fractions* flat from 2500 nodes and asked for the spatial pattern to be verified. Nearest-node label agreement with 40k at 4096 directions: **69% (2500) · 71% (5000) · 73% (10k)** on shell bodies; per-body class deltas up to 5.23 pt. `writeProvince` relaxes in node units. So the game runs the lab's 40k and pays 35–160 ms/body + 645 ms once **in a worker**. ⚠ The first AC-2 draft gated *per-body* deltas at 1.0 pt off a *population* table — unreachable, superseded in the contract with the reason (`feedback_match-ac-tolerance-to-artifact-tier`, again).

## 3. ⛔ TRAPS THAT BIT TODAY

1. ⛔⛔ **A planet in `sys.planets` is an ENTRY wrapping `planetData`.** Pass the entry to `labPipelineAdmits` and every planet is refused (no `_systemSeed`), and `conditionFromBody(entry)` silently defaults every field so the class census reads "rocky 134, gas 0". Use `e.planetData || e`. The moon-lab-mount suite never hit this because moons are records.
2. ⛔ **An import appended AFTER a trailing `// comment` on the same line is a comment.** `Planet.js:4` ended in `// §4 Step 6a`; the first attempt put the new import after it and `attachProvinceBake` was undefined at the mount. Split at the comment, put the import before it.
3. ⛔ **Instrument A's baseline is stale and was recorded from a DIRTY tree** (`2f7402ff`). 19 "NEWLY RED" — every one reproduced on a clean `git worktree` of HEAD: `agent-camera-api` 6, `relief-octave-lod-ramp` 5, `port-condition-contract` 3, `lab-shader-perframe-seam` 1, `gas-body-lab-material` 6e/uOctaves 1, `driver-pack-giantdeck` GATE 5 (needs git object `4e864bc`, absent here) 1, `world-engine-l0-plumbing` 2. Attribute by worktree, never by reading the list. Not re-blessed — naming what moved is the re-bless's job.
4. ⚠ **Plain `node` cannot import `Planet.js`** (`motion-test-kit` subpath exports). Measurement scripts run as scratch vitest files under `tests/`, writing their report to a file — vitest's console capture hides `console.info` on a passing test in this config.
5. ⚠ **The citation fence reads `file.js:NNN-MMM` in PROSE as a live ref** and flags it PAST-EOF once the file shrinks. Historical ranges are written "`file.js` lines N–M (at `<sha>`)".
6. ⚠ **The dev-server hook matches the server command's text ANYWHERE in a Bash command** — including inside a heredoc that is only writing a doc, and inside an `echo` label. Write such docs with the Write tool, or assemble the string from parts.

## 4. ✅ DONE — Max's A/B (AC-6) passed 2026-09-02; the live pair (AC-3) and the lab leg (AC-4) are recorded below. ▶ **NEXT for the lane = F11/F12, THE RIVER ROUTER — Max's choice, 2026-09-02: *"Both recs sound good"*** (the recs: F11/F12 because it rides the carrier path this wire built; and a FRESH session for it).

**Starting F11/F12 (fresh session):** it is a multi-system wire → `dev-collab-scope` first. Read, in order: `one-pipeline-two-frontends-PLAN.md` § THE PROVINCE CUBE, WIRED (EOF) for the carrier path that now exists in the game (`provinceDispatch.js` → `writeBodyRelief` writes `carrier.height` too); `planet-lod-rivers.js` `createRiverOverlay.route()` for what the lab does after the dispatch (sea level → `routeAndOrder` → ribbon geometry + the carve cube `uRiverCarveMap`, gated with the relief cube `uReliefBakeCube` under `uReliefBakeStrength`); and `LabPlanetMaterial.js:122-126` for the samplers the game still binds as placeholders. ⚠ The router reads the HEIGHT field, so F11/F12 likely carries the relief cube with it — measure which samplers the shader gates rivers on before scoping. Same shape as this wire: move the lab's own pieces, bake in the worker, bind on first draw. Do not read `~/briefings/` for status.

**Needs Max** (only he may start servers): in `~/projects/well-dipper`, the dev server on lane A's port — `npm run dev -- --port 5175`. Chrome:9223 launch is Claude's (`chrome-devtools-9223-launch` memory: `"/mnt/c/Program Files/Google/Chrome/Application/chrome.exe" --remote-debugging-port=9223 --user-data-dir="C:\temp\chrome-mcp-filmstrip" <url>` via interop, sandbox OFF — it worked 2026-09-01).

**Drive (chrome-devtools, never Sol):** open `http://localhost:5175/well-dipper/`; `_lab.spawnProceduralSystem('rocky-3')` (any `rocky-*` seed — every body admits); wait for `_labProvince.count() > 0` and check `_labProvince.transport()` reads `'worker'`; `_lab.frameBody(...)` a solid body (**read `resolvedBy` on the result**); screenshot; `_labProvince.set(0)`; screenshot; diff the two — MUST differ on the body. Control on a gas body: identical. Sabotage arm: bind the placeholder back (`surface.material.uniforms.uProvinceCube.value = <the 1×1 cube>`) and confirm identical. **Screenshots, never `readPixels`** (default framebuffer reads black). Then `_labProvince.set(0.65)`, navigate the tab to `about:blank` and hand to Max.

### ⭐ THE LIVE DRIVE, 2026-09-01 late — what happened and what it cost to make it honest

Dev server `:5175` (Max ran `scripts/dev.sh`), Chrome:9223 launched via interop with the sandbox OFF (worked first time).
`_lab.spawnProceduralSystem('rocky-3')` → 4 planets, **orrery mode**. Transport `'worker'`.

1. ⛔⛔ **In ORRERY the body GROUPS are `visible: false`**, so `onBeforeRender` never fires and nothing bakes — `count()` sat at 0 for 6 s. `_lab.frameBody({kind:'planet',p:0},{radii:6})` makes the group visible; the hook then fired: request → worker reply → bake on the next frame. **p0 (`body.planet.00e0df`, despun): dispatch 74.7 ms in the worker, 16.9 ms main-thread bake, craton 73.4 % / basin 26.6 %.** Bodies never drawn never bake — by design, and in orrery that is every body.
2. ⛔⛔ **FREEZE FIRST, THEN FRAME** — the dev API says so and I did it backwards. Frame → freeze put the body back out of view, and the "pair" was FOUR PIXEL-IDENTICAL SHOTS OF AN EMPTY FRAME (0 differing pixels, which read as "the wire does nothing"). What exposed it: a forced palette probe (craton red, fresh green, sed blue, mix 1.0) — still 0 differing pixels ⇒ the instrument was vacuous (`feedback_identical-output-needs-a-liveness-probe`). Re-framed under the freeze, the same probe showed **red craton and blue basin regions on the body** — the cube is baked, bound and read.
3. **THE HONEST PAIR** (real palette, frozen, framed): 0.65 vs 0 → **3,540 of 1,138,556 px differ, bbox (579,320)–(776,524) = the body, 0 outside, max channel Δ 17.** Sabotage: placeholder re-bound at mix 0.65 → **0 px vs the OFF shot**, the same 3,540 vs ON. Gas control `body.planet.26e35a`: its own mix 0.65 → 0 → **0 px**.
4. ⚠ **Why Δ 17 is small, and what it means for Max's walk:** p0 is DESPUN — two-class, and its palette has `uCratonColor == uWeatheredColor`, so only the basins move (toward `uSedColor`). **For AC-6 put him on a SHELL-path body** (three classes; orogen paints `uFreshColor`). In `rocky-3`, p1 and p2 are solid and unbaked (never drawn); frame one and read `userData.wd.lab.province.path` before choosing — or use a seed whose planets are shell (the corpus is 45 shell / 8 despun / 4 volcanic / 1 stagnant among the 58 moons+planets measured).
5. The lab, same server: Rocky (Earthlike) routes twice on load; `_lab.provinceProbe()` = 26,818 / 3,041 / 10,141 (67.0 / 7.6 / 25.4 %), contiguity 0.996, η² 0.524 vs null p99 0.030 — through `src/rendering/bake/provinceCube.js` and `src/worldengine/mesh/sphereMesh.js`, both visible in the lab's network log. The one console 404 is `favicon.ico`.
6. Shots live in the session scratchpad only (`province-A2-p0-on / B2-p0-off / S2-p0-placeholder / G1-G2 gas / P2-rgb-probe.png`); the numbers above are the record. Frame thawed, mixes restored, tab parked on `about:blank`.

**Max's walk:** procedural system, fly toward a rocky or icy body — a SHELL-path one, see item 4 above — and tap `V` while moving. His question, in his frame: does the ground read as kinds of crust — shield / belt / basin — rather than one tone, and does it cohere with the rest of the surface. His answer closes AC-6; then `VERIFIED_PENDING_MAX` → Shipped on his word.

⚠ **Expected in the live drive, not a defect:** province colour pops in a few hundred ms after a system spawns (the worker builds the 40k mesh once, 645 ms, then ~50 ms per body). If it NEVER appears: `_labProvince.transport()` — `'sync'` means the worker failed to load (check the console for the chunk 404; `vite.config.js` base is `/well-dipper/` in dev, `/` in build).

## 5. WORKING WITH MAX (delta — the 2026-09-01 handoff's §5 still holds)

- He greenlit the contract with one word. The scoping interview was compressed to one gate because the "why" and the criteria were already his words from prior sessions; he did not push back on that shape.
- Push cadence unchanged: lane A pushes are routine but confirmed per branch; ⛔ never push `master`.

## Suggested skills
- **`superpowers:verification-before-completion`** — every wrong claim today was one I had not measured (the "unwritten" pieces; the 1.0-pt bound; the corpus wrapper).
- **`superpowers:systematic-debugging`** if the live pair does not differ.
- ⛔ **NOT `brainstorming`, NOT `dev-collab-scope`** — the contract exists and is greenlit; the next step is verification.

## Not in scope
The relief / crater / river-carve cubes (same carrier path, own increments) · QB-20 (despun body-blindness, the lab's model) · the 108 KB `planet-lod-rivers.js` file move (PLAN §7, still its own step) · Instrument A re-bless (other lanes' failures; name what moved first).
