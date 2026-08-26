# World-Engine — PARALLEL TRACKS handoff (ground ∥ atmosphere)

**Written:** 2026-06-30 by the flight-systems session (working-Claude), at Max's request, to
bootstrap a **concurrent** World-Engine session. The flight/supercruise work continues separately
in the `~/projects/well-dipper-supercruise` worktree — it does not touch this branch.

**Line of sight (why this exists):** North star = *the COUNT of genuinely distinct, history-coherent
worlds visible per minute* (ROADMAP §North star). The program drives **2-of-11 → 11-of-11** archetypes
having a real history writer. This handoff splits the *remaining* increments into two tracks that can be
built at the same time, and — honestly — names the seams where they are NOT independent.

Read alongside (source of truth, don't re-derive): `ROADMAP.md` (this dir), `UAT-RUBRICS.md`,
`increment-1-shell-relief-DESIGN.md`, `docs/FEATURES/world-engine-architecture-spine.md`,
`docs/FEATURES/planet-lod-CHARTER.md` (lab≠game by design). Memory: `[[well-dipper-world-engine-program]]`.

---

## Current program state (verified against git, 2026-06-30)

- **#1 Despun / ice-shell writer (`shellRelief.js`)** — BUILT, `VERIFIED_PENDING_MAX 54ea74d`.
  **⚠ AC11 UAT is still Max's open gate** — hands-on at `world-engine-lab.html`, step Europa/Frozen/Eyeball/Titan.
  (Max-only action, independent of both tracks below.)
- **#2 Plate driver-response** — **SHIPPED** `87704a9` (D16 age descoped `45cca44` per Max UAT; age → epoch model #6 + weathering #7).
- **Branch:** `feature/world-engine-production-L1`, checked out at `~/projects/well-dipper`. **Push HOLD** (campaign-wide). Lab-only until #9.
- **~~⚠ Uncommitted in that checkout right now:~~ RESOLVED 2026-06-30 (WE-ground session):** `src/auto/CameraChoreographer.js` + `src/debug/LabMode.js` were **STASHED** (`git stash@{0}`, by pathspec — untracked `F*.png` screenshots left in place). Reason: CameraChoreographer was experimental "Loop (a) cycle 4 Attempt 1" spring-damper work on `EstablishingMode` — a subsystem the `supercruise-freelook` workstream is actively retiring from the live path — so it was NOT baked into L1 unverified; LabMode was a safe scenario-4/7 real-warp-flow test fix. Both preserved, recoverable via `git stash pop stash@{0}`. If the camera work was meant to land, pop + commit it. The untracked lab-screenshot pile is a separate (gitignore) concern, untouched.
- **Known gaps (THIN):** Mars (stagnant-lid, NOT plate-driven — the plate assignment is wrong; needs a dedicated stagnant-lid-*rocky* path, Venus-shaped ≠ Mars-shaped); sub-Neptune (no increment home).

---

## The split

### TRACK G — Ground / surface relief  (authors `carrier.height` + structural fields; three-free in `src/worldengine/base/`, lab-only)

| Increment | File | Notes |
|---|---|---|
| **#4 Volcanic / endogenic-heat (E7)** | `magmatism.js` | Hotspot/edifice + effusive lava plains + substellar magma-ocean. Io/lava. **Copy the template from `plates.js` (the real shipped writer), NOT the unbuilt shellRelief.js.** |
| **#4b Venus stagnant-lid branch** | (fork in #4) | tessera + coronae + resurfacing-age off ONE seeded mantle-plume field. Dispatch predicate `isStagnantLidPath` goes in `planet-lod-rivers.js` next to `isEarthlikePlatePath`. Research folded in ROADMAP note (Gulcher/Ivanov/Strom). THIN. |
| **#4.5 Exotic-shattered block-jumble** | `shatter.js` | **BLOCKED — needs a Max geometry decision first:** block-jumble (disfavored science, instantly readable) vs diapir-grooved coronae (favored, different primitive). Also: F45 `shatterCombiner` shader is ALREADY shipped, so this is a retrofit. Do NOT start until Max picks. |
| **#5 Bombardment / cratered (E8a)** | `bombardment.js` | Crater size-frequency by gravity+age → basins/rims/ejecta. Cleanest **editor-on-HOST** exemplar → de-risks the #6 epoch refactor. Moon/Mercury. |
| **#5.5 Shared-field pass** | (a PASS, not a writer) | orientation/stress + passive margins + sediment host + history-tied province + E2-figure. The substrate #6/#7/#8 read. **⚠ `maturity`/`baseLevel`/`standing` are NOT free channels** (E9 already writes them) — add NEW `carrier.accommodation`/`carrier.sediment` or reconcile. |
| **Mars** | (research first) | Dedicated stagnant-lid-rocky treatment: Tharsis hotspot (#4) + ancient cratered highlands (#5) + hemispheric dichotomy + aeolian (#7) + early-active-then-frozen chapter (#6). Needs a research pass; NOT Venus-shaped. |
| (later) exotic carbon/crystal/technogenic | — | from #8. |

### TRACK A — Atmosphere / weather / climate  (authors band/haze/climate fields; gas giants have NO relief, ever)

| Increment | File | Notes |
|---|---|---|
| **#3a E5 band/jet field** | `climate-e5.js` | precip + temperature + wind. **MUST-FIX FIRST:** lift the `u(lat)` jet profile out of GLSL into a `base/` writer, or AC1–AC3 can't run headless. |
| **#3b Vortex & storm placement** | (sub-increment, own ACs) | great-spot / storm-train / polar-vortex. Vortex LATITUDES deterministically selected (argmax anticyclonic shear between jets), RNG only sets longitude/aspect/size. **Equatorial-jet SIGN is regime-dependent** (prograde gas-giant/Saturnian; RETROGRADE Neptunian/ice). Deterministic argmax tie-break for AC1 byte-identity. |
| **Sub-Neptune muted-haze branch** | (branch of #3) | `hazeOpacity = hazeTempBell(T_eq)` (closed form, no RNG), `bandField *= (1 - hazeMute*hazeOpacity)`. **Reconcile the `sub-neptune` vs `ice-giant` short-key radius collision** (`ScaleConstants.js`) before landing. |
| gas-giant / hot-jupiter identity | (#3) | Their WHOLE visual identity IS the E5 field. Hot-Jupiter eastward hotspot offset is the right default (gate on `T_eq`). |
| (later) Tier-5 E4 magnetosphere, E13 transient (aurora) | — | from #8. |

---

## The seams — where the tracks are NOT independent (the honest answer to "won't interact much")

Max's assumption **holds for the writer-authoring phase** (Track G writers REPLACE `carrier.height`; Track A
writes disjoint band/haze/climate channels — different files, different channels, no clobber). But the ROADMAP
names four real couplings. Three of them fall AFTER both tracks' writer work; one is a one-way read that does
**not** block Track A from starting now:

1. **#3 reads ground relief for orographic precip / rain-shadow** (one-way). BUT: (a) the gas-giant / hot-jupiter /
   sub-Neptune path has NO surface → fully independent of ground; (b) for solid worlds, #3 can author against the
   **already-built** #1/#2 relief (Earth-like + icy/despun) — it does NOT need the *unbuilt* #4/#5 ground writers.
   **⇒ Track A can proceed now.**
2. **#5.5 writes the sediment host + orientation field** that climate-driven erosion later deposits onto (Track G work; substrate for Track A's later sculpting).
3. **#6 epoch/host-editor model + CYCLE-1 (atmosphere↔surface dust/frost budget)** — the TRUE two-way rejoin. **#6 is unmechanized** — the fixed-point solver is a placeholder (ROADMAP thin-spot 8). It needs its own real design pass before either track claims the cycle is resolved.
4. **#7 per-regime sculpting** — aeolian (needs E5 wind) + glacial/frost (needs E5 temp) editors are Track-A *physics* operating on Track-G *relief*. Rejoin.

**⇒ Parallel window:** Track G builds #4 → #4b → #5 → #5.5 (+ Mars research); Track A builds #3a → #3b → haze.
**They REJOIN at #6 (epoch + CYCLE-1) and #7 (sculpting).** Do not start #6/#7 in either track alone — they need both.

---

## Recommended starting picks

- **Track A:** start **#3a band/jet field** — highest variety-per-effort (unlocks 4 gas-giant archetypes' entire identity) and fully independent. First action = the GLSL→`base/` `u(lat)` lift so ACs run headless. `dev-collab-scope` it (fold the ROADMAP §3 planning note + UAT-RUBRICS card in as AC framing).
- **Track G:** start **#4 volcanic/endogenic-heat (E7)** — next broaden writer, independent of #3, more visible variety (Io/lava/Venus via #4b). **#5 bombardment** is the close alternative (de-risks the #6 epoch refactor as the cleanest editor-on-host exemplar). Recommend #4 first, #5 next. **Do NOT start #4.5** until Max makes the block-jumble-vs-diapir geometry call.

Each increment: `dev-collab-scope` → per-AC implement→adversarial-audit→adjust workflows → `verify-workstream`
(unit + integration; AC1 no-RNG static-source guard cloned per writer; byte-identity at the Earth reference point) →
`VERIFIED_PENDING_MAX` → Max UAT → Ship. Determinism discipline: `alea` seeded off `macroSeed`, disjoint namespace
per writer, no `Math.random`/`Date.now`, bounded fixed pass counts (no threshold while-loops).

---

## ⚠ Concurrency / worktree collision (read before opening two sessions)

A git branch can be checked out in only ONE worktree. Both tracks live on `feature/world-engine-production-L1`.
The **new writer files are separate** (`magmatism.js`/`bombardment.js` vs `climate-e5.js`) — low collision — but
these are **shared hot spots** both tracks touch: `src/worldengine/base/route.js` + `writeBodyRelief`, the lab
dispatch `planet-lod-rivers.js` (regime predicates), `world-engine-lab.html` (lab UI), and `docs/NOW.md`.

**RESOLVED (2026-06-30, Max delegated the call → working-Claude chose two isolated worktrees):**
- **Track A (atmosphere)** → worktree **`~/projects/well-dipper-we-atmo`** on branch **`feature/world-engine-atmosphere`** (created off L1 @ `2a09e61`; `node_modules` symlinked to the main checkout, no `npm install` needed).
- **Track G (ground)** → the existing main checkout **`~/projects/well-dipper`** on **`feature/world-engine-production-L1`** (where #1/#2 already landed). ⚠ Handle the uncommitted `CameraChoreographer.js`/`LabMode.js` (commit or stash) before starting.
- **Integration:** L1 is the merge target. **Merge `feature/world-engine-atmosphere` → L1 at each seam** (definitely before #6/#7, which need both tracks). Keep merges small/frequent to minimize conflicts on the shared hot-spot files above.
- Rationale: two live sessions writing one working tree is the real corruption risk; separate worktrees eliminate it. Undo if unwanted: `git -C ~/projects/well-dipper worktree remove ~/projects/well-dipper-we-atmo && git branch -D feature/world-engine-atmosphere`.
