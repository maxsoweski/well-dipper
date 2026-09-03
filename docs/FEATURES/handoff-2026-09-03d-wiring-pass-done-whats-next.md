# Handoff 2026-09-03d — ⭐⭐ THE WIRING PASS IS DONE. Both partials SHIPPED (F3 rays `6d70d56`, F35 terminator `2e60453`); lane A PUSHED at `bf24fcc`. ▶ NEXT = Max picks the next arc from the parked list

> ⚠ **IN-REPO ON PURPOSE.** Supersedes `handoff-2026-09-03c-*`. **Branch** `feature/world-engine-production-L1` (lane A, NOT master) · **origin = `bf24fcc`, verified by `git ls-remote`** · working tree clean. ⛔ ~700 untracked PNGs are normal, NEVER `git add -A`. ⚠ ALWAYS `npx vitest run --dir tests`.

## 0. WHERE THE PROGRAM IS

Max's 2026-09-02 ruling — *"I want to continue wiring up all the features from the world engine before we try to further develop any of them"* — **is satisfied.** Every F-row the lab has now reaches the game through one pipeline. What is left unwired is **queue (c) only**, and it is world-GENERATION work, not wiring:

| row | why it renders nothing | what would change it |
|---|---|---|
| **F43** `uFacetStrength` | gated on `!cond.atmosphere` for a CRYSTAL body; `conditionFromBody.js` only nulls the atmosphere when `phys.retained === false`, which is 0 of 800 planets | the generator producing an unretained atmosphere, or the facet law re-gated on a real quantity |
| **F46** `habGate ⇒ uBioCoverage` | `biosphereOf` is 0 on 97.9 % of 1,156 bodies, max 0.0115 | a habitability model that produces a live population |

⛔ Both must be scoped as world-generation, never as a wire (PLAN §7; risk #13 — a never-rendered feature wired and blamed on the wrong side).

## 1. THE PARKED DEVELOPMENT LIST — Max's pick

Everything below was deferred BY the wiring ruling and is now due. None is scoped; each needs a fresh `dev-collab-scope`.

1. **The lighting engine / F52** — the terminator's owner. Max 2026-07-16: *"it doesn't work but also this is ultimately something that will need to be rendered in the lighting engine of the main game anyway"*; 2026-08-06: *"yes, the lighting engine needs to work for all objects in game."* The band ships OFF behind one constant (`TERMINATOR_ENABLED`) until this lands; the legacy ungated producer (`Planet.js:1653`, Sol + gallery) is declared, not converged. This is the only parked item Max has ruled IN scope twice.
2. **The rivers' look** — his 2026-09-02 UAT: *"The rivers are not fully developed."* QB-21 (every wet world gets the same 35 % ocean — the router's target is a lab UI constant), QB-22, QB-23 (F13's outflow ramp saturates: 62 of 66 relict worlds render a megaflood), the view-dependent river LOD, the small-body width law.
3. **The storms' look** — QB-16 (the great spot does not blend with the deck), QB-18 (no ink-in-water complexity), QB-24 (the vigor ramp saturates at 130 K: 20 of 32 game gas bodies draw the same Jovian personality).
4. **The rays' look** — the full-disk ray treatment (his 2026-06-10 call, still pending) and the cell-boundary truncation carry-forward ("an obvious clipped square" at ≈ 20 radii).
5. **World generation** — QB-25 (airless erosion is the SYSTEM age alone, so every plain moon of a system carries the identical ray brightness: 19 values over 56 moons), QB-26 (terrestrial moons' physics-less atmosphere record), and the queue-(c) rows above. Also his open questions from the river ship: only 2 of 124 corpus bodies come out wet — is ~1.6 % the density he wants rivers at?
6. **The phone** — ≈ 200 MB of cube maps per system, up to ≈ 300 worst case. His desktop will not notice; the phone is the only instrument. Never measured.
7. **Lab hygiene** — QB-27 (the persisted-blob restore warning at `world-engine-lab.html:3294`), QB-28 (gas `termWidth` settles ≈ 1.5 s after a preset change).

## 2. WHAT SHIPPED TODAY (do not re-derive)

- **F3 ejecta rays** `6d70d56` — Max: *"they do read as spokes"* (rocky-13, the fifth planet's ice moons, key `Y`). One law module `src/worldengine/base/ejectaRays.js`; the crater block emits off the CONDITION (not `craterUniformsFrom` — `CRATERS_OFF` has no key). The plan's "renders nothing" premise was PLANETS-ONLY: every plain moon is airless (56 of 124 solid corpus bodies), rays render on the 52 with a crater host.
- **F35 terminator** `2e60453` — Max: *"Terminator is there (but looks really bad as usual). This has been in the game for weeks at this point though, what's the change"* → the change IS the removal; shipped on *"1 yes"*. The packs began writing the band 2026-08-21, five weeks after his 2026-07-16 ruling turned it off in the lab; ALL_ON had overridden a specific ruling. Now one constant, read by the game's RULED gate policy and both lab producers.
- Instruments: all four green at HEAD (`npm run check:instruments` exit 0). Instrument A re-recorded at `eb58ac9`; Instrument C re-blessed on the intended `uTermStrength` delta (371/633, Δ ∈ [−0.15, 0]).

## 3. ⛔ TRAPS EARNED TODAY

1. **`Agent(isolation:"worktree")` lands on MASTER and puts the worktree UNDER the repo**, where vitest collects it (a bare run doubled to 349 files). Check `git log -1` in the worktree; remove it before any instrument run; a stale `.claude/worktrees/wf_440dc97c-63b-4` is still there.
2. **The citation checker binds a bare `:NNNN` to the nearest preceding filename** — "the lab's :5365" after `craterDeck.js` reads as `craterDeck.js:5365`. Always write the filename. And `--check-citations | tail -1` HIDES the exit code: grep for `Exit 0` before `&&`-chaining a commit.
3. **`verify-workstream` in `light` mode scores only what it audits** and leaves the rest INSUFFICIENT — that is not a fail. A full run is ≈ 2–3 M subagent tokens; compose the verdict from the runs plus measured repairs when the repairs are instrument-level (both verdicts today are `mode: "composed"` with provenance per row).
4. **Live-pair artifacts must live IN-REPO** (`docs/WORKSTREAMS/<slug>/live-pair-<date>/`) — a verifier cannot trace evidence that only exists in a session scratchpad, and it will mark the AC INSUFFICIENT.
5. **`code-explorer` / `Explore` agents have no Bash/Write.** Use `general-purpose` (opus) for anything that runs a script.
6. **A wall-clock ratio cannot gate a µs-scale operation** — AC-6's +10 % bar read 0.87× and 1.40× on identical code. Pin an absolute delta plus a regression-class ceiling.
7. **`_lab.shotState()` is async and takes `{ body, region }`**; `frameBody` re-frames to a LIT view — a crescent needs a camera orbit at fixed distance (`setCameraPose` with the controller's yaw; `shotState().geometry.lighting.litFraction` is the readback) and the lit fraction is read LAST. `packsApplied`, not `packs`.

## 4. WORKING WITH MAX

- Both walks were done with A/B keys and screenshots sent to his device — the pattern that worked: park him in the live thing, send the pair, never describe what it looks like.
- His question *"what's the change"* on a feature that had been visible for weeks is the shape to watch for: a wire whose value is a REMOVAL needs the before/after stated up front, not the mechanism.
- Subagents opus-pinned throughout (his 2026-09-03 instruction). Session spend: 2 builders ≈ 0.7 M, 3 live drives ≈ 0.7 M, contract review 0.76 M, verify runs 2.9 M + 0.34 M + 2.0 M.
