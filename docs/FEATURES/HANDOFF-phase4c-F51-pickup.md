# Handoff — Phase 4c F51 (rings) + F38/F39 call — pickup

**Written 2026-06-13** after the entire **F46–F49 overlay family landed in one
session** (8 commits, see below). Durable on-disk in the repo, NOT `/tmp`. Start a
FRESH session in `~/projects/well-dipper` and read this first. **Supersedes
`HANDOFF-phase4c-F46-pickup.md` — that file is now stale and can be deleted.**

## Where we are
- **Phase 4c: 14/15 cards done.** This session shipped the whole Overlay family, all
  🟡/🟢 VERIFIED_PENDING_MAX, clean tree:
  - **F46 fungal-mats** 🟢 — `1afe4ec` feat / `4984924` doc. (1 fix cycle: the `patch` blackout.)
  - **F47 machine-surface** 🟡 — `685a7a4` feat / `7176a2e` doc. Taste-call: day-side metal brightness.
  - **F48 city-lights** 🟡 — `1a5bcc0` feat / `acefaed` doc. Taste-call: default maturity 0.5 (drop to ~0.35 for nascent).
  - **F49 ecumenopolis** 🟡 — `92bf873` feat / `c40824a` doc. Tweak applied (`ecuCanyonDepth` 0.45→0.70). Taste-calls: day-relief strength; optional denser district scale.
- **NEXT: two items remain to close the phase goal (tracker line 104):**
  1. **F51 rings** — lab-status 🟡 (partial in-lab build EXISTS), but §7 is still all "(pending)". Needs a **verify→§7 verdict** pass (and possibly finishing the build — read the card to see how complete the lab impl is). It is **"Crosscutting" (rings), NOT a surface overlay** — see the ⚠️ family warning below.
  2. **F38/F39 airglow / cloud-optics** — status `[subtle]`, no dossier. Needs a **keep/stylize/drop recommendation, marked parked-for-Max in the tracker** (tracker row ~:82). This is a TASTE DECISION — per `feedback_decision-needed-threshold`, produce the recommendation + reasoning but PARK it for Max; do not unilaterally build/drop.
- **Source of truth for position:** `docs/FEATURES/planet-lod-campaign-tracker.md` (F-index + the `/goal` block at line 104). F46–F49 rows now ✅.
- **Method:** campaign spec §13.4 heavy loop. Do NOT invoke `dev-collab-scope`/`verify-workstream` — the campaign predates and replaces that flow for these cards. Do NOT use `brainstorming` — the cards already scope the features.

## ⚠️ F51 IS A DIFFERENT FAMILY — the F46–F49 overlay lessons may NOT transfer
F46–F49 were **surface overlays** (emissive-bypass and/or analytic-normal relief, gated by a per-feature coverage/maturity uniform, neutral PROV row, composited over the natural base). **F51 rings is "Crosscutting"** — a planetary ring system is geometry/scattering AROUND the body, not a surface term ON it. **Read `docs/FEATURES/cards/F51-rings.md` §2/§4/§5 fresh** before assuming any of the overlay plumbing (emissive bypass site, the FEATURES/PROV registration trio, the `if (uCoverage>0.0)` guard pattern) applies. The architect decides what F51 actually needs against the live file. Since it's already 🟡 in-lab, step 1 may be **verify the existing build → write §7**, not architect-from-scratch — check the card's §6.5/state first.

## The five-dispatch loop (it worked beautifully — F46–F49 cost ONE fix cycle total)
Five discrete `Agent` dispatches (general-purpose, **model `opus`** — `fable` unavailable here despite the global rule). Each returns a ~12-line compact summary; **NO code/diffs/screenshots back to the main session** (Max's explicit preference — in-thread screenshot Reads are the dominant context cost).
1. **Architect** → reads card + the machinery it plugs into + `git show <freshest exemplar>` → **greps live line numbers** → writes `## 6.5 Build plan` into the card (between §6 and the UAT divider). *For F51, if it's already built, this may instead be a quick scope-check.*
2. **Implement** → edits per §6.5, runs `npx vitest run tests/planet-archetypes.test.js` (must stay green).
3. **Code-review** → `git --no-pager diff` the changed files, GLSL-correctness-weighted, BLOCKERS/NITS/CLEAN. (Trace every new uniform: GLSL decl ↔ THREE uniforms object ↔ per-frame writer.)
4. **Live-verify** on :9223 → tunes defaults, writes §7. *Working-Claude pre-checks the blackout itself first (below) before spending this dispatch.*
5. (Only if 🔴) **fix round** → fresh implement dispatch. **Budget = 3 fix-cycles then park.**

`SendMessage` is NOT available — each follow-up is a FRESH `Agent` dispatch.

## ⭐ HARD-WON LESSONS (all verified across F46–F49 — apply them to F51)
1. **LINE NUMBERS IN CARDS/HANDOFFS ARE STALE BY ~1200+ LINES.** The file is >6300 lines and grows ~hundreds per feature. **MANDATE: `grep -n` every edit site in the LIVE file; ignore cited numbers as anything but rough hints.** This is the single highest-value habit — it's why F47/F48/F49 each cost ZERO fix cycles.
2. **GLSL RESERVED WORDS black out the WHOLE lab and no static test catches it.** F46 cost its one fix cycle because a local was named `patch` (reserved in GLSL ES 3.00, alongside `sample, filter, input, output, active, common, partition, resource, superp`, all `mat*`/`vec*`/`sampler*`). **Tell the architect/implementer to pick a clear feature prefix and check every identifier against the reserved list.** The codebase documents the `patch`→`dustPatch`/`bioPatch` workaround near lab `dustPatch`.
3. **WORKING-CLAUDE PRE-CHECKS THE BLACKOUT ITSELF before the verify dispatch.** After implement, reload `:5173/well-dipper/world-engine-lab.html?fresh=1` (ignoreCache) on Chrome :9223, then `list_console_messages` (zero errors = shader compiled) + an `evaluate_script` confirming `window._lab.state` has the new enable key. A GLSL compile error here = STOP, report as a BLOCKER (fix round, not tuning). This caught F46's blackout in the main session cheaply and saved a wasted verify dispatch on F47–F49.
4. **A PROV ID *IS* REQUIRED for any feature registered in FEATURES** (even "neutral" overlays). The test asserts `keys(PROVINCES).toEqual(keys(FEATURES))` + a GLSL `provinceWeight` arm per non-ejecta key. The card prose claiming "overlays need no PROV" is WRONG (caught at F46). **Highest PROV id in use is now `PROV_ECUMENOPOLIS=45`** → the next is **46**. Overlays use a NEUTRAL row (`f=gProvince.z; fl=1.00`, the FROST/aurora pattern). *F51 rings may differ — confirm against the card.*
5. **ARCHETYPE REUSE beats new archetypes.** F48 + F49 both REUSED the existing `tectonic-terrestrial` archetype (its presets list Rocky/Ocean/Eyeball — the verify bases). F47's `technogenic` archetype lists ONLY Rocky, which would break Ocean/Eyeball verify legs. The test enforces test:50 (every preset is a real DRIVER_PRESETS key) + test:57 (≥1 feature per archetype). Prefer reusing an archetype whose presets already cover your verify bases.
6. **The live aurora nightMask is `1.0 - smoothstep(-0.1, 0.1, diff)`** — the cards' prose `smoothstep(0.1, -0.1, diff)` is INVALID GLSL (edge0>edge1 is undefined). Use the live form.
7. **Defaults under-read at build time** — verify routinely walks them up (F49 `ecuCanyonDepth` 0.45→0.70; F45 `shatSubAmt` 0.4→0.7). The verify agent edits `state.*` defaults in world-engine-lab.html + widens any GUI slider whose good value sits at an edge.

## Live-verify recipe (overlay flavor — adapt for F51 rings geometry)
- chrome-devtools MCP tools are DEFERRED — load via ToolSearch
  `select:mcp__chrome-devtools__list_pages,mcp__chrome-devtools__navigate_page,mcp__chrome-devtools__take_screenshot,mcp__chrome-devtools__evaluate_script,mcp__chrome-devtools__list_console_messages`. NOT Playwright (CPU).
- Helpers confirmed this session: `window._lab.setPreset(name)`, `window._lab.solo(featureKey)`, `window._lab.state.*`. **There is NO `setFeatureEnables` helper and NO light-direction helper** — sweep the terminator via `state.yaw` (static) / `state.spinSpeed>0` (animated); `uLightDir` is rewritten per-frame. Let ~5 rAFs pass after any state change before a shot/read. **Judge from screenshots, not `readPixels`** (returns a cleared buffer post-rAF).
- **ON/OFF + coverage-0 delta discipline:** capture ON vs OFF at the same camera; identical ON/OFF means the term isn't firing → 🔴, report, don't tune around it.
- dpr was 1.25 / innerW 1402 all session (sane, no scaling trap). Use `?fresh=1`; verify innerWidth/dpr before trusting a capture.
- Shots → `docs/FEATURES/cards/shots/` (gitignored — referenced in §7, NOT committed).

## Commit discipline (shared tree — a parallel warp session has WIP in `src/`)
Two-commit pattern used all session: (1) `git add` the **explicit code paths** (`world-engine-lab.html planet-archetypes.js tests/planet-archetypes.test.js`) → commit → grab the short sha; (2) stamp `VERIFIED_PENDING_MAX <sha>` in the card §7 + flip the tracker F-index row to ✅ + rating → `git add` the **explicit doc paths** → commit. **NEVER `git add -A`** (untracked loose PNGs + parallel `src/` WIP must stay out). The commit PreToolUse hook prints harmless `grep: subpattern name expected` lines — NOT a failure; check the returned sha. Never touch `src/`, `docs/NOW.md`, or anything outside the campaign paths.

## Infra state at handoff
- Dev server: Max has `npm run dev` on :5173 (confirmed up all session). May stop between sessions — pre-check via MCP (`list_pages` should show the lab tab); if down, ONLY Max can restart (`npm run dev`) — ask him, Claude can't.
- GPU Chrome :9223: up; left navigated to the lab (`?fresh=1`, zero console errors) at F49 close. Next session re-navigates (relaunch only if the window was closed — see `~/.claude/projects/-home-ax/memory/chrome-devtools-9223-launch.md`).
- Tree: clean on campaign paths at `c40824a`. Loose untracked PNGs + `src/` warp WIP sit outside campaign paths — leave them; stage explicit paths only.

## After F51 + F38/F39 → the phase 4c `/goal` is met
Then flip the tracker phase-status row (line 22, `4c … ▶️ pending`) to ✅ with a date, and the build pass for 4c is complete. Remaining campaign work after that lives in the tracker (INTEGRATION phase 5, the parked taste-calls Max still owns across F34–F49).
