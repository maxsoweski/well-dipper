# Handoff — ▶ NEXT ARC, in Max's order: **(1) the `solidRelief` deck** → **(2) F1 mountains: why no body takes the plate path** → **(3) the lighting engine (F52)**

> ⚠ **IN-REPO ON PURPOSE** (`/tmp` does not survive a WSL restart). Supersedes `handoff-2026-09-03d-wiring-pass-done-whats-next.md`; its §3 traps still hold and are extended below.
> **Branch** `feature/world-engine-production-L1` (lane A, **NOT** master) · **origin = `2a0e75c`, verified by `git ls-remote`; working tree clean, nothing owed.** ⛔ ~700 untracked PNGs are normal, NEVER `git add -A`. ⚠ ALWAYS `npx vitest run --dir tests`.

## 0. THE RULING (Max, 2026-09-03, verbatim)

Asked whether the lighting engine could start: *"Lighting should be next but only if we now have all world engine rendering in the game."* The audit answered **no** (§ THE COVERAGE AUDIT, MEASURED at the PLAN's EOF). Shown the three-way split, he ruled the order: **"1 then 3 then 2"** —

1. **The `solidRelief` deck** — forward the thirteen unforwarded master gates. His condition, and one pack-shaped job.
2. **F1 mountains** — why `plates.js` claims 0 of 124 bodies. A GENERATION question, scoped before any F1 wiring.
3. **The lighting engine / F52** — his 2026-07-16 and 2026-08-06 rulings; the terminator's owner.

⛔ Do not reorder. Do not start (3) early because it is independent — he was told it is independent and still put it third.

## 1. READ FIRST

- `docs/FEATURES/one-pipeline-two-frontends-PLAN.md` **§ THE COVERAGE AUDIT, MEASURED** (EOF) — the two roads, the thirteen gates, the three unnamed gaps, F1's generation block. Then the F-spine rows §3 (re-scored 2026-09-03: F37 was flatly wrong; F7/F17 stale; F4/F6/F8/F9/F10 reach pixels through the BAKE).
- `docs/WORKSTREAMS/coverage-audit-2026-09-03/` — `REPORT.md` + the corpus JSON + the two scripts that measured it. **Re-run them rather than re-deriving.**
- The shape to copy: `docs/WORKSTREAMS/wire-ejecta-rays-lab-into-game/` and `.../wire-terminator-gradient-lab-into-game/` (contract + intent + `live-pair-2026-09-03/` + verdict), and their PLAN addenda.
- `~/.claude/projects/-home-ax/memory/well-dipper-world-engine-program.md` (last six entries).

## 2. THE WORK — (1) the `solidRelief` deck

**What it is.** Thirteen master gates are computed per body by `labCore.deriveUniforms` and written every frame by the lab, and **no pack forwards one of them**. The laws exist and run; only the carriage is missing. ONE pack — the `fluvialDeck` precedent answered five F-rows in one workstream.

| gate | F-row | input today |
|---|---|---|
| `uMountainAmp` | F1 mountains | ⛔ **generation-blocked** — the plate path claims 0 of 124 bodies. Forwarding it lights a law nothing selects (risk #13). **Scope it in, wire it, and record that it renders nothing until (2) is answered — or hold it out and say so.** Working-Claude's call at scoping; state it either way. |
| `uChasmaDepth` | F4 canyons/rifts | live (the bake already carries `stagnantLid`'s rifts on 10 bodies; this is the runtime half) |
| `uScarpStrength` | F5 scarps | live — F5 reaches NEITHER road today |
| `uPlateauStrength`, `uTesseraStrength` | F6 plateaus/tessera | live (bake carries 10; runtime half absent) |
| `uLavaCoverage` | F8 lava plains | live (bake carries 14) |
| `uDuneDensity` | F15 dunes | live — reaches neither road today |
| `uDustDepth` | F16 dust mantles | live — reaches neither road today |
| `uSubStrength` | F18 sublimation | live — reaches neither road today |
| `uMassWastDensity` | F19 mass-wasting | ⚠ live gate, but the LAB half measured **.00006** (inert). Wire it and log the lab defect, or hold it out — say which. |
| `uKarstDensity` | F21 karst | live — reaches neither road today |
| `uFacetStrength` | F43 crystal facets | ⛔ **queue (c)** — `retained === false` never happens; forwards a dead 0 |
| `uBioCoverage` | F46 bioluminescence | ⛔ **queue (c)** — `habGate ≡ 0`; forwards a dead 0 |

**Honest split to put in the intent: 8 gates with live inputs and no current road (F5, F15, F16, F18, F21 + the runtime halves of F4/F6/F8), 1 inert-in-the-lab (F19), 1 generation-blocked (F1), 2 queue-(c) dead (F43, F46).** Do not let the headline become "thirteen features wired".

**Shape.** `dev-collab-scope` first (multi-AC, multi-system). Copy the ray/terminator contract shape: population measured at scoping over the 24-seed corpus (how many of 124 bodies get a non-zero value per gate — that is the honest "what will the player see"); fixtures captured at the parent BEFORE any src edit; an A/B key + `globalThis._lab*` instrument registering EVERY lab material with a `dispose` listener from the start; executed `[CONTROL]`s that assert RED; a live pair on a body the population read names; `verify-workstream` (`mode:"full"`, every agent `model:"opus"`).

**Two design questions to settle at scoping, not during the build.** (a) Does `solidRelief` become an eleventh pack, or do these names join `rockySurfacePack` (which already carries the terrain palette)? The registry's collision throw and the per-pack fence tests make the answer non-obvious — measure both against `ROCKY_SURFACE_UNIFORMS`'s existing 26. (b) The runtime gates and the BAKE both drive the same geometry on F4/F6/F8/F9/F10 — decide and record whether they compose or double-count, and put a control on it. **This is the workstream's central risk: the bake already draws these features on some bodies, so a naive wire can double the relief.**

## 3. THE WORK — (2) F1 mountains, a GENERATION question

`plates.js` claims **0 of 124** corpus bodies, so mountains reach pixels through neither road. Before any F1 wiring: read `computeE1`'s mobile-lid band and find why no generated body selects the plate path. Is the band unreachable by construction (a threshold on a quantity the generator never produces), or is the population genuinely all stagnant-lid? `feedback_physics-first-worldengine-scoping` applies — derive it, do not ask Max a taste question. Related, from the same audit: `writePassiveMargins` never fires (plate-path only), and there is **no bake crossover at all below 0.22 R⊕ (41 of 124 bodies — every small moon draws the pre-bake analytic surface)**. Those three may share one cause; check that before scoping three fixes.

## 4. THE WORK — (3) the lighting engine / F52

Max 2026-07-16: *"…this is ultimately something that will need to be rendered in the lighting engine of the main game anyway."* 2026-08-06: *"yes, the lighting engine needs to work for all objects in game."* It owns the terminator band (shipped OFF behind `TERMINATOR_ENABLED`, one constant to flip back), the legacy ungated producer at `Planet.js:1653` (Sol + gallery bodies, declared not converged), and eclipse/moon shadows. ⭐ **F52 runs the OTHER way — into the lab.** The game already feeds `shadowCast` per render tick (`Planet.js:1976`, `Moon.js:678`, populated at `main.js:11452`) and `LabPlanetMaterial.js:577` writes `uShadowMoonCount`/`uShadowMoonPos`; the lab has no shadow-caster path at all (PLAN §7: "the ONE feature where the lab is behind"). So this arc is: bring F52 into the lab so it can be developed there like everything else, and make lighting correct for every object class.

## 5. ⛔ TRAPS (the 09-03d seven, plus what this session added)

1. **`Agent(isolation:"worktree")` lands on MASTER and puts the worktree UNDER the repo**, where vitest collects it (a bare run doubled to 349 files). Check `git log -1` inside it; remove it before any instrument run. A stale `.claude/worktrees/wf_440dc97c-63b-4` is still there.
2. **The citation checker binds a bare `:NNNN` to the nearest preceding filename** — write `world-engine-lab.html:5365`, never "the lab's :5365". And `--check-citations | tail -1` HIDES the exit code: `grep -q "Exit 0"` before `&&`-chaining a commit.
3. **`verify-workstream` `light` mode scores only what it audits** and leaves the rest INSUFFICIENT — not a fail. Full is ≈ 2–3 M subagent tokens. Both of today's verdicts are `mode: "composed"` from a full run + a light run + working-Claude's measured repairs, with provenance per row; that is an acceptable close when the repairs are instrument-level.
4. **Live-pair artifacts must live IN-REPO** (`docs/WORKSTREAMS/<slug>/live-pair-<date>/`) — a verifier cannot trace evidence that exists only in a session scratchpad and will mark the AC INSUFFICIENT.
5. **`code-explorer` / `Explore` agents have no Bash/Write.** `general-purpose` (opus) for anything that runs a script.
6. **A wall-clock ratio cannot gate a µs-scale operation** — a +10 % bar read 0.87× and 1.40× on identical code. Pin an absolute delta plus a regression-class ceiling.
7. **`_lab.shotState()` is async and takes `{ body, region }`**; `frameBody` re-frames to a LIT view, so a crescent needs a camera orbit at fixed distance — set `controller.yaw` on the pose (`camPos = target + d·[sin yaw·cos pitch, sin pitch, cos yaw·cos pitch]`), read `shotState().geometry.lighting.litFraction`, and read the lit fraction LAST. `packsApplied`, not `packs`.
8. ⭐ **NEW — the F-spine's status column is not evidence.** Three rows were flatly wrong this session (F37, F7, F17) and five more scored ❌ while the BAKE was already drawing them. Measure the code before scoping anything off that table.
9. ⭐ **NEW — Instrument A's stored baseline is scope-sensitive.** It now covers 349 files / 5,922 tests (re-recorded at `eb58ac9`); the old record never covered `src/**/__tests__` or `vendor/motion-test-kit/tests`. Instrument C was re-blessed on the terminator's intended delta. All four are green at `2a0e75c` (`npm run check:instruments` exit 0) — if one goes red, diff per test ID against a clean parent worktree placed OUTSIDE the repo before touching the baseline.

## 6. WORKING WITH MAX

- **A wire whose value is a REMOVAL must lead with the before/after, not the mechanism.** He looked at the terminator A/B and asked *"This has been in the game for weeks at this point though, what's the change"* — the answer was that the change IS the removal, and I had led with the constant instead of the dates.
- **Park him in the live thing and send the pair.** Both walks this session were an A/B key plus two screenshots sent to his device; he judged in one message each. Never describe what it looks like.
- **He checks the premise.** He asked the coverage question before authorising the arc he wanted, and it was right to ask — the answer was no. Expect the same on the `solidRelief` deck: *does forwarding these gates actually put anything on screen?* Have the population read ready at scoping.
- Subagents: **opus pinned everywhere** (his 2026-09-03 instruction, `feedback_subagent-model`); workflows where they earn it.
