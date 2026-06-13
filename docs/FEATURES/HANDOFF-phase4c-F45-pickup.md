# Handoff — Phase 4c F45 (shattered-crust) pickup

**Written 2026-06-13** after F44 landed (`dde2332`). Durable on-disk (NOT /tmp —
/tmp wipes on WSL restart; that's why the 2026-06-10 handoff was lost). Start a
FRESH session in `~/projects/well-dipper` and read this first. This handoff
deliberately front-loads the things I had to *discover* mid-F44 — read the
"⚠️ Hard-won this session" block before writing any code.

## Where we are
- **Phase 4c: 9/15 cards done**, all 🟡/🟢 VERIFIED_PENDING_MAX. F44 just landed:
  commit `dde2332` (hexTess feature, `voronoi3dReg` BCC scan + `hexCrust` combiner,
  reuses `exotic-geometric`, `PROV_HEXTESS=40`). 🟢 — one taste-call for Max (5–7-sided
  natural variance vs crisp textbook-hex) logged in the F44 card §7 for Phase 7.
- **NEXT: F45 shattered-crust**, then F46–49 (overlays, marked ⬜(lab)), F51 (rings, 🟡),
  + the F38/F39 keep/stylize/drop parked-call to close the phase.
- **Source of truth for position:** `docs/FEATURES/planet-lod-campaign-tracker.md`
  (phase-status table + feature index; F44 row now ✅🟢).
- **Method:** campaign spec §13.4 heavy loop. Spec:
  `docs/superpowers/specs/2026-06-09-planet-feature-refinement-campaign-design.md`.
  Do NOT invoke `dev-collab-scope`/`verify-workstream` — the campaign predates and
  replaces that flow for these cards.

## ⚠️ Hard-won THIS SESSION (the stuff I wish I'd had at F44 start)

These cost real cycles on F44. F45 is **also a relief combiner**, so #1 and #2 apply
verbatim — bake them into the implement and verify subagent prompts up front.

1. **A relief combiner MUST feed the analytic-normal `grad` accumulator, not just `h`.**
   The lab lights surfaces from the analytic normal built off `grad`. Height written to
   `h` alone does NOT light. F44's first impl wrote `h` + scaled the border gradient by
   the *width* knob (≤0.2) → ~12× too weak → **feature totally invisible (ON==OFF
   pixel-identical)**. Fix: route relief into `grad` at magnitude **~0.9, matching the
   reference combiner** (F43 `facetCombiner` / F9 `chaosCombiner` — both render). Tell the
   implementer to do a **static magnitude self-check**: compare its combiner's `grad`
   contribution against the reference combiner's at comparable knob settings *before*
   declaring done. F9 `chaosCombiner` (planet-lod-lab.html:1171-1186) is F45's direct
   reference — mirror exactly how strongly it pushes `grad`.

2. **⚠️ FALSE-NEGATIVE isolation trap — cost a whole fix-cycle on F44.** The verify agent
   "isolated" by setting `window._lab.state.perturb = 0`. But `uPerturb` is the **global
   gain on the entire `grad`** the analytic normal reads (planet-lod-lab.html ~:3006) — at
   perturb≈0 *nothing* lights, combiner or not, so it wrongly reported 🔴. **Correct
   relief-combiner isolation:** `perturb 0.55` + `solo(feature)` (base FBM cancels in the
   ON/OFF delta). For cell-SHAPE judgement, additionally `octAuto=false, octaves=1`
   flattens base FBM while keeping the relief consumer live. NEVER verify a relief combiner
   at perturb=0. This recipe is also in the campaign memory.

3. **`SendMessage` is NOT available in this environment.** You cannot continue/re-prompt a
   finished subagent — each follow-up is a FRESH `Agent` dispatch (it re-reads the file
   region; that's fine and stays compact). Plan the loop as discrete dispatches.

4. **Subagent model: `opus`.** `fable` is unavailable here despite the global
   `subagent-model` rule. Use `subagent_type: general-purpose, model: opus`.

5. **The delegation flow that worked (reuse it for F45)** — keeps the main session lean
   (Max's explicit preference). Five discrete `Agent` dispatches, each returning a ~12-line
   compact summary (NO code/diffs/screenshots back to main):
   1. **Architect** → reads dossier + the machinery it plugs into + F44 (`git show dde2332`)
      as the plumbing exemplar → writes a `## 6.5 Build plan` section into the F45 card
      (between §6 and the `────── below filled during UAT ──────` divider).
   2. **Implement** → edits per §6.5, runs `npx vitest run tests/planet-archetypes.test.js`.
   3. **Code-review** → `git --no-pager diff` the changed files, GLSL-correctness-weighted,
      BLOCKERS/NITS/CLEAN. (On F44 this caught a wrong lattice *before* live-verify.)
   4. **Live-verify** on :9223 (see recipe below) → tunes defaults to walkability, writes §7.
   5. (Only if 🔴) **fix round** → fresh implement dispatch. Budget = 3 fix-cycles then park.
   The full F44 subagent prompts are in this session's transcript if you want to clone them.

6. **Commit discipline (shared tree — a parallel warp session has WIP in `src/`):** stage
   ONLY explicit paths — `planet-lod-lab.html planet-archetypes.js
   tests/planet-archetypes.test.js docs/FEATURES/...`. **NEVER `git add -A`.** Never touch
   `src/`, `docs/NOW.md`, or anything outside the campaign paths. The commit PreToolUse hook
   prints harmless `grep: subpattern name expected` lines — not a failure; check the
   returned sha.

## F45 specifics (from the card dossier — read the card for full detail)
Card: `docs/FEATURES/cards/F45-shattered-crust.md`. **§6.5 is ABSENT → step 1 is the
architect writing it.** F45 = the chaotic-blocks endmember of the P15 triplet (F44 hex =
polygons, F43 crystal = facets).
- **Build it as:** `shatterCombiner` = a **globalized two-octave generalization of F9
  `chaosCombiner`** (planet-lod-lab.html:1171-1186): `voronoi3d` mega-blocks with per-cell
  hashed flat height + per-cell CONSTANT tilt gradient (chaos "cosmetic gradient" — gives
  each block its own posterize band), **F2−F1 border distance carved DOWN as graben
  crevasses** (reuse the cryo `grabenProfile`, ~planet-lod-lab.html:836-849), a low-freq
  region mask (`uChaosMaskScale` pattern, ~:268-273) defaulting to **~1** for the global
  "shattered" read, plus a finer **second-octave sub-fracture lattice** within blocks
  (tessera-style — F6 `tesseraCombiner` ~:1022-1044 — or a 2nd voronoi octave). Two scales
  is what sells "violently reassembled" over "uniform paving stones" (UAT item 3).
- Add into the unified h/grad accumulator (~:1476-1509) behind a `uShatterStrength ≤ 0`
  early-out, per registry convention. **Lighting-routed (see lesson #1).**
- **PROV id = 41** (40 is now F44's `PROV_HEXTESS`). New feature `shatter` /
  `shatterEnabled`. **GLSL prefix:** pick a unique one (F43=`fct`, F44=`hx` → F45 e.g.
  `sh`/`shat`); avoid reserved words (`fc`=gl_FragCoord).
- **Archetype decision (flag to architect/Max):** §5 says *new `exotic-shattered`
  archetype, or reuse `icy-active`*. F43/F44 share `exotic-geometric`, but F45 should read
  DISTINCT from F44 (not paving stones), so a dedicated `exotic-shattered` archetype is the
  cleaner call — confirm before building.
- **Registration trio** (FEATURES + `featureFolders` + `.add(state,'shatterEnabled')` GUI
  binding) + the GLSL_NAME line in `tests/planet-archetypes.test.js` are enforced by vitest.
- **Optional v1 cut:** the emissive "freshly-shattered hot-interior" crack term (added AFTER
  posterize, lava Worley-crack bypass) and a dedicated 'Shattered (exotic)' preset — scope
  to v2 unless cheap, like F44 skipped its preset.

## Live-verify recipe (ready to paste into the verify subagent)
- chrome-devtools MCP tools are DEFERRED — load via ToolSearch
  `select:mcp__chrome-devtools__list_pages,mcp__chrome-devtools__navigate_page,mcp__chrome-devtools__take_screenshot,mcp__chrome-devtools__evaluate_script,mcp__chrome-devtools__list_console_messages`.
  NOT Playwright (CPU; useless for GPU shaders).
- **Infra:** dev server is up on :5173 (Max starts it — Claude can't). GPU Chrome is up on
  :9223, parked at about:blank. `list_pages` → `navigate_page` the EXISTING page to
  `http://localhost:5173/well-dipper/planet-lod-lab.html?fresh=1`. The `?fresh=1` is
  REQUIRED (stops a sessionStorage scenario-restore that resets camera/uTime mid-A/B). Do
  NOT bash-probe ports (sandbox returns 000 false-negative) — check liveness via MCP only.
- **Blackout = first check.** After navigating: screenshot + `list_console_messages` for
  GLSL compile errors. A reserved-word/identifier collision blacks the WHOLE lab and NO
  static check catches it — the live load is the only test. If blank/shader-error → STOP,
  report exact error as a BLOCKER (needs a GLSL fix round, not tuning).
- **Isolation:** `solo('shatter')`, `setPreset('Frozen (airless)')`, **`state.perturb=0.55`**
  (see lesson #2 — NOT 0). Distances via `state.distance`: 20 (global block patchwork),
  8 (border crevasses resolving as relief), 3 (per-block tilt + sub-fracture close-up).
- **Stale reads:** after any state/preset change let ~5 rAFs pass before trusting a
  `_lab.state`/uniform read. **Judge from screenshots, not `readPixels`** (post-rAF returns
  a cleared buffer).
- **Tune:** build-plan defaults under-read (F44: scale 4.0→1.6, borderDepth→1.1). Live-walk
  the knobs to where it READS at mid distance, then edit `state.shat*` DEFAULTS in
  planet-lod-lab.html + widen any GUI slider range whose good value sits at an edge.
- Judge the 8 UAT items in F45 card §6 (blocks-as-discrete-plates, crevasses-carved-down,
  two-scale read, limb-clean-while-surface-chunked, intensity-axis, posterize-survival,
  determinism, F2-crater composition). Write §7 verdict (🟢/🟡 taste-call/🔴 + shots +
  `VERIFIED_PENDING_MAX (pending sha)`).
- Shots → `docs/FEATURES/cards/shots/` (gitignored — referenced in §7, NOT committed; commit
  only the tracked source/doc paths).

## Don't-duplicate references (real state lives here)
- **Tracker / position:** `docs/FEATURES/planet-lod-campaign-tracker.md`.
- **Campaign memory (auto-surfaces; has the F44 process notes + the two lessons above):**
  `~/.claude/projects/-home-ax/memory/well-dipper-lod-terrain-campaign.md`.
- **Freshest plumbing exemplar:** `git -C ~/projects/well-dipper show dde2332` (F44 — full
  feature: uniforms decl + THREE uniforms object + frame writer + combiner + call site +
  PROV define/arm/row + FEATURES + featureFolders + GUI folder + state init + GLSL_NAME test
  line, with CORRECT grad routing). F43 `12be875` is the prior exemplar.
- **Testing how-to:** `~/.claude/projects/-home-ax/memory/well-dipper-testing-reference.md`.
- **Chrome :9223 launch (if the window got closed):**
  `~/.claude/projects/-home-ax/memory/chrome-devtools-9223-launch.md` — PowerShell
  `Start-Process` (NOT `cmd /c start`), fresh `--user-data-dir`, `dangerouslyDisableSandbox:true`.

## Suggested skills for the next session
- **None mandatory.** This is an in-flight campaign with its own ceremony (spec §13.4). Use
  the `Agent` tool directly for the five-dispatch loop above (general-purpose, model `opus`).
  Do NOT invoke `dev-collab-scope` or the `verify-workstream` workflow — the campaign
  replaces them for these cards.

## Infra state at handoff
- Dev server: Max has `npm run dev` on :5173 (he confirmed it up this session).
- GPU Chrome :9223: up; this session left its tab navigated to the lab. Next session just
  re-navigates to `...planet-lod-lab.html?fresh=1` (relaunch only if the window was closed).
- Tree: clean on campaign paths at `dde2332`. Parallel warp WIP may be uncommitted elsewhere
  in the tree — stage explicit paths only, never `git add -A`.
