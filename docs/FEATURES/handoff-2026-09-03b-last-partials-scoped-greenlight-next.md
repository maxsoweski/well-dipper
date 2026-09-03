# Handoff 2026-09-03b — ⏳ THE LAST TWO PARTIALS (F3 ejecta rays, F35 terminator gradient) ARE SCOPED, REVIEW-AMENDED, AWAITING MAX'S GREENLIGHT · NEXT = greenlight → build F3 first (the bigger wire), then F35

> ⚠ **IN-REPO ON PURPOSE** (`/tmp` does not survive a WSL restart). Supersedes `handoff-2026-09-03-storm-slice-verified-max-walk-next.md` for the WORLD-ENGINE lane; its §3 traps still hold.
> **Branch** `feature/world-engine-production-L1` · **Repo** `~/projects/well-dipper` (lane A, NOT master) · scope commit `250e712` + the amendments commit carrying this file (see `git log -2`) · origin still at `4af25c4` — **NOT pushed**. ⛔ ~700 untracked PNGs are normal, NEVER `git add -A`. ⚠ ALWAYS `npx vitest run --dir tests` (20 pre-existing failures, the parent's set).

## 0. STATE

| workstream | status | contract | what Max decides |
|---|---|---|---|
| `docs/WORKSTREAMS/wire-ejecta-rays-lab-into-game/` (F3, 4/7 → 7/7) | `scoping`, validated, review-amended | 8 ACs (AC-0..AC-6 unit/integration, AC-7 his walk) | greenlight |
| `docs/WORKSTREAMS/wire-terminator-gradient-lab-into-game/` (F35, 3/4 → 4/4) | `scoping`, validated, review-amended | 6 ACs (AC-0..AC-4, AC-5 his walk) | greenlight **+ the direction of convergence** (recommended OFF, his 2026-07-16 ruling; ON is the same constant flipped and the lab's 13 presets get the band back) |

Both intents carry a "Decisions taken in scoping" list he can overrule at greenlight. Evidence beside each contract: `scoping-corpus-2026-09-03.json` (+ `.mjs`) and `scoping-live-pair-2026-09-03.json`.

## 1. WHAT THIS SESSION FOUND (do not re-derive)

1. **F3 is a queue-(b) wire, not queue (c).** PLAN :131/:133/:574's "hasAtmo true on 100 % of bodies" (0/800) was measured over PLANETS. Over the 24 `rocky-*` seeds (21 produce bodies): `condition.atmosphere` is null on 56/56 plain moons, non-null on 68/68 planets + planet-class moons (min 0.105 bar); the lab's law gives the 56 rayBrightness 0.70–0.94 (`deriveUniforms` and `airlessnessOf` agree 124/124). `r-rows-decision-packet-2026-08-20.md:441-444` recorded this on 2026-08-20; neither PLAN absorbed it (`lab-pipeline-into-game-PLAN.md:398/:403` too).
2. **Rays multiply the crater host.** Value > 0 on 56; render-capable (density × relevance > 0) on 52; visible (> 0.01) on 39. Four airless moons have NO crater schedule (rocky-13 p3m0 1.27 R⊕ and p4m0, rocky-14 p3m0, rocky-19 p0m0) — the two biggest airless moons in the corpus cannot show a ray. Every rocky/volcanic moon of rocky-13 is bare; every ice moon is saturated. **Live subjects = rocky-13 p4m3 (ice 1.06 R⊕) and p4m5 (ice 0.96 R⊕), the FIFTH planet's moons**, each pre-flighted.
3. **Ray brightness is per-SYSTEM, not per-body:** 19 distinct values over 56 moons, one per system — airless erosion = min(0.3, systemAge × 0.03) (`PhysicsEngine.js:823-825` fed the system age at `MoonGenerator.js:300`), so the population is floored at 0.70 by construction. Two world-gen backlog rows to log at build.
4. **F35's 4th piece is `uTermBypass`** — the plan's fractions count the uniforms per F-block in `uniforms.js`; the block (:47-51) holds the derived triple + the bypass knob (lab GUI, no law, no writer under `src/`). Its sibling `uLimbBypass` is in the same state (F34 reads 2/2 only by block layout). Its only consumer sits inside the shader's `uTermStrength > 0` block — under the ruling it is a wired PRODUCER, not a game rendering path.
5. **The game draws the band Max turned off.** Live on rocky-2: `uTermStrength` 0.15 on 6/6 planets; ON/OFF rim signal above a zero floor (near-full phase, faint). Headless (parent fixture): 67/68 air-bearing solid at 0.15, one at 0.1303 (rocky-3 p0 — `columnFraction × 0.15` is a CEILING), 32/32 gas at 0.15, 56 airless at 0. Lab: `terminatorEnabled` false on all 13 presets since 2026-07-16 — **authored by `DEFAULT_DRESSING` (`planet-feature-associations.js:493`) through `applyEnableSet` (lab :4274), NOT by the state literal (:1053)**. Rulings (verbatim in the contract): 2026-07-16 "disable terminator gradient totally; it doesn't work … lighting engine" (applied as a REVERSIBLE defaults amendment, manual toggle kept); 2026-08-22 "the game and lab end up working the same"; 2026-08-06 "the lighting engine needs to work for all objects in game".
6. **Keys:** every letter A–Z but `Y` is bound (`Y` → rays); non-letters bound are Backquote, Digit1, Enter, Escape, Space, Tab (`.` → terminator).
7. **`conditionFromPlanet.js` no longer exists** (it is `conditionFromBody.js`); the PLAN carries the old spelling on 19 lines and `tools/port-uniform-delta.mjs` pins it — leave it.

## 2. ⛔ TRAPS (new this session; §3 of the storm handoff still holds)

1. ⛔ **`_lab.shotState()` is ASYNC and takes `{ body, region }`** — called bare it reads the SELECTED body (p0, disc r 0.06, off screen) and returns a promise that JSON-stringifies to `{}`. Declare the ROI in the sidecar, not with `--region` at diff time.
2. ⛔ **`frameBody` re-frames to a LIT view** — the second call on rocky-2 p1 landed at lit fraction 0.98 (terminator at the limb). A crescent needs `setCameraPose` (`main.js:3346`) rotation at the same distance, then a re-`frameBody`, litFraction read LAST.
3. ⛔ **`code-explorer` / `Explore` agents have NO Bash/Write** — dispatch `general-purpose` (opus) when the agent must run a script or write a report.
4. ⚠ **"Flip the constant in a test copy" is not executable against a `const` export** — every new constant in these contracts has a parameter seam; build them that way.
5. ⚠ The lab's :2505 width retype runs LAST on the gas path (after :2821 in `ensureNetworkRouted`) — its deletion is admissible only by value-equality in BOTH call orders.
6. ⚠ `localStorage['wd.labGasBodies'] = '0'` in a browser silently keeps the legacy Moon.js shader (no `uRay*`, ungated `uTermStrength` at Planet.js:1653) — clear it before any live pair.

## 3. ▶ NEXT, in order

1. **Max's greenlight on both** (+ the F35 direction). On his word: contract `greenlight` block + status `building`, commit (`ea18406` → `520f2c0` is the shape).
2. **Build F3 first** (the bigger wire; the same session or a fresh one): capture the two fixtures at the parent BEFORE touching src (`tests/fixtures/ray-lab-baseline.json`, re-capture `pack-drivers-baseline.json`), then the module + the block + the lab import + the `Y` instrument + the suite; `--check-citations` LAST before every commit; live pair on rocky-13 p4m3/p4m5 after the pre-flight; `verify-workstream` (`mode:"full"`, every agent `model:"opus"`); `VERIFIED_PENDING_MAX <sha>`; his walk.
3. **Then F35** the same way (fixtures in both gas orders; the six test pins + the fixture re-pointed with the ruling on each line; the crescent pair with the derived bar — if the bar is not met, record and STOP).
4. **Docs at ship:** PLAN rows expanded in place (F3 :67, F35 :99), :133/:574 + `lab-pipeline-into-game-PLAN.md:398/:403` annotated, two addenda at EOF, the two world-gen backlog rows, FEATURES.md rows (Rule 3), cards, NOW.md.
5. Push lane A on his say-so (three+ commits since `4af25c4`). ⛔ never `master`.

## 4. WORKING WITH MAX (delta)

- **F3 walk:** `?system=rocky-13`, the fifth planet's ice moons (1.06 and 0.96 R⊕), `Y` while moving in; then any planet with air, `Y` again (nothing changes). He judges the WIRE; the full-disk ray read and the "clipped square" truncation are deferred lab items.
- **F35 walk:** `?system=rocky-2`, the second planet at a crescent, `.` while moving in — the band appears/vanishes; OFF ships. His question: does the razor terminator read right while the lighting engine waits, or does he want the band back meanwhile? Either is one constant.
- Subagents: opus pinned everywhere (his 2026-09-03 instruction); the pre-greenlight review cost 0.76 M subagent tokens and caught 12 must-fixes — worth it before a build, not after.
