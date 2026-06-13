# Handoff — Phase 4c F46 (fungal-mats / bioluminescent overlay) pickup

**Written 2026-06-13** after F45 shattered-crust landed (`e94323e` feature +
`f7c8d14` doc-stamp). Durable on-disk in the repo, NOT `/tmp` — `/tmp` wipes on
WSL restart (that's how the 2026-06-10 handoff was lost). Start a FRESH session in
`~/projects/well-dipper` and read this first. Supersedes
`HANDOFF-phase4c-F45-pickup.md` (F45 is done — that file can be deleted).

## Where we are
- **Phase 4c: 10/15 cards done**, all 🟡/🟢 VERIFIED_PENDING_MAX. F45 just landed
  (`e94323e`): `shatterCombiner`, PROV_SHATTER=41, new `exotic-shattered` archetype.
  🟡 — one taste-call logged for Max in F45 card §7 (mega-block density; walk
  `shatScale` slider, no code change). The F45 five-dispatch loop ran with **zero
  fix cycles**.
- **NEXT: F46 fungal-mats** (Overlay), then F47 machine-surface, F48 city-lights,
  F49 ecumenopolis (all Overlay, ⬜(lab)), F51 rings (🟡), + the F38/F39
  keep/stylize/drop parked-call to close the phase.
- **Source of truth for position:** `docs/FEATURES/planet-lod-campaign-tracker.md`
  (phase-status table + F-index; F45 row now ✅🟡).
- **Method:** campaign spec §13.4 heavy loop. Spec:
  `docs/superpowers/specs/2026-06-09-planet-feature-refinement-campaign-design.md`.
  Do NOT invoke `dev-collab-scope`/`verify-workstream` — the campaign predates and
  replaces that flow for these cards.

## ⚠️ F46 IS A DIFFERENT FEATURE FAMILY — the F43–F45 relief lessons mostly DON'T apply
F43/F44/F45 were **relief combiners** (height + analytic-normal `grad`, behind a
PROV id, in the h/grad accumulator). **F46–F49 are emissive OVERLAYS.** Read the
F46 card `docs/FEATURES/cards/F46-fungal-mats.md` §2 + §4 — they spell the
mechanism out precisely. In short:
- F46 = **clone the aurora night-side emissive term** in the post-posterize
  **emissive-bypass channel**. Swap aurora's latitude `ringMask` for a
  domain-warped-FBM **biosphere coverage mask**; keep the `nightMask`
  (`smoothstep(0.1,-0.1,diff)`) gate and the bypass-add AFTER the quantizer.
- **NO `grad` routing. NO relief. NO PROV id.** It's a Lambert-independent
  emissive that BYPASSES the 6-level posterize (so it survives on the dark
  hemisphere; an albedo tint would get crushed). The F45/F44 "must feed grad at
  ~0.9" lesson is IRRELEVANT here — don't carry it over.
- Feature key `bioMats` / enableKey `bioMatsEnabled`, archetype `tectonic-terrestrial`
  (habitable bases). Driving uniforms mirror `uAuroraIntensity`/`uEmissive`/
  `uEmissiveBypass`. GUI home = **Envelope folder**, not a new relief folder.
- **Determinism trap (card §4 flags it):** use thresholded warped-noise contours
  ("fake-Turing") for the reticulated veining — do NOT use true reaction-diffusion
  (ping-pong breaks re-approach determinism, violating the 🎲 domain-offset convention).
- Registration is lighter than a relief feature: FEATURES entry + featureFolders +
  GUI binding + the GLSL_NAME test line, but **likely no PROV define/arm/row** since
  it's not a province. Confirm against the card — the architect decides.

## ⚠️⚠️ HEADLINE LESSON FROM THIS SESSION — DO NOT TRUST LINE NUMBERS IN DOCS
The F45 handoff cited chaosCombiner at `:1171` and the accumulator at `:1476`. **Both
were wrong by ~1200 lines** — the live file had chaosCombiner at `:2372`, the
accumulator at `:2940`. The architect caught it only because it re-read the live
file. **The F46 card has the SAME problem**: it cites `featureFolders` at `:2515`
and `setFeatureEnables` at `:2539`, but the F45 implementer found `featureFolders`
at **~:6153**. The emissive-split lines (`:1572-1597`), uniform lines (`:1611/1614/
1618`), and Envelope-folder lines (`:2126-2134`) in the F46 card are ALL likely
stale too. **MANDATE: the architect must `grep -n` every edit site in the live
file and ignore the card's/handoff's line numbers as anything but rough hints.**
This is the single highest-value thing I wish I'd known at F45 start; it's why F45
cost zero fix cycles.

## The five-dispatch loop that worked (reuse it for F46 — keeps the main session lean)
Five discrete `Agent` dispatches (general-purpose, **model `opus`** — `fable` is
unavailable here despite the global rule). Each returns a ~12-line compact summary;
**NO code/diffs/screenshots back to the main session** (Max's explicit preference —
in-thread screenshot Reads are the dominant context cost).
1. **Architect** → reads card + the emissive-bypass machinery it plugs into +
   `git show e94323e` (F45, freshest plumbing exemplar) → **greps live line numbers**
   → writes `## 6.5 Build plan` into the F46 card (between §6 and the
   `────── below filled during UAT ──────` divider). **F46 card §6.5 is ABSENT →
   step 1 is the architect, same as F45.**
2. **Implement** → edits per §6.5, runs `npx vitest run tests/planet-archetypes.test.js`
   (must be green; it enforces the registration trio + GLSL_NAME line).
3. **Code-review** → `git --no-pager diff` the changed files, GLSL-correctness-weighted,
   BLOCKERS/NITS/CLEAN. (Trace every new uniform: declared in GLSL ↔ in THREE uniforms
   object ↔ written by the per-frame writer. A GLSL compile error blacks the WHOLE lab
   and no static test catches it.)
4. **Live-verify** on :9223 (overlay recipe below) → tunes defaults, writes §7.
5. (Only if 🔴) **fix round** → fresh implement dispatch. **Budget = 3 fix-cycles then park.**

`SendMessage` is NOT available — you cannot re-prompt a finished subagent. Each
follow-up is a FRESH `Agent` dispatch (re-reads the file region; stays compact).

## Live-verify recipe for an OVERLAY (different from the relief recipe!)
- chrome-devtools MCP tools are DEFERRED — load via ToolSearch
  `select:mcp__chrome-devtools__list_pages,mcp__chrome-devtools__navigate_page,mcp__chrome-devtools__take_screenshot,mcp__chrome-devtools__evaluate_script,mcp__chrome-devtools__list_console_messages`.
  NOT Playwright (CPU; useless for GPU shaders).
- **Pre-check infra liveness YOURSELF from the main session before dispatching verify**
  (this avoided a wasted dispatch this session): `list_pages` (Chrome :9223 should
  show the lab tab on :5173), `navigate_page` to
  `http://localhost:5173/well-dipper/planet-lod-lab.html?fresh=1`, `list_console_messages`
  (zero errors = no GLSL blackout), and an `evaluate_script` confirming
  `window._lab.state` has the new `bioMatsEnabled` key. If :5173 is down, ONLY Max can
  start it (`npm run dev`) — ask him; Claude can't. Do NOT bash-probe ports (sandbox
  returns 000 false-negative).
- **Blackout = first check.** A reserved-word/identifier collision blacks the whole lab
  and no static check catches it — the live load is the only test. Blank/shader-error →
  STOP, report the exact console error as a BLOCKER (GLSL fix round, not tuning).
- **Overlay isolation** (per card §5, NOT the relief recipe — no perturb=0.55, no
  octaves=1): `setPreset('Ocean (temperate)')` or `'Rocky (Earthlike)'` (the habitable
  bases F46 overlays); `solo('bioMats')` / `setFeatureEnables('bioMats')`; **turn ON the
  Envelope folder's "emissive bypass quantizer"**; **set `state.spinSpeed > 0` to sweep
  the terminator** and confirm the mats light ONLY on the night side (like aurora). Sweep
  `uBioCoverage` 0→1 for the sparse-patches → planet-spanning-mat ladder.
- Distances via `state.distance`: ~3 (patch DISTRIBUTION across the disk), ~1.3 (patch
  EDGES + glow crispness under the 4×4 Bayer dither).
- **Stale reads:** after any state/preset change let ~5 rAFs pass before trusting a
  `_lab.state`/uniform read. **Judge from screenshots, not `readPixels`** (post-rAF
  returns a cleared buffer). Watch the screenshot-scaling trap (verify
  `innerWidth`/`devicePixelRatio` sane; use `?fresh=1`; 127.0.0.1 if a persisted zoom bites).
- **ON/OFF delta discipline:** capture ON vs OFF at the same camera; an emissive overlay
  that's identical ON/OFF means the bypass-add isn't firing (analogous to F45's invisible-
  relief bug, different cause) — that's a 🔴, report it, don't tune around it.
- Judge the UAT items in F46 card §6 (self-emission-not-albedo, biological-patches,
  maturity-ladder, + the rest). Write §7 verdict (🟢/🟡 taste-call/🔴 + shots +
  `VERIFIED_PENDING_MAX <sha>`). Shots → `docs/FEATURES/cards/shots/` (gitignored —
  referenced in §7, NOT committed).

## Commit discipline (shared tree — a parallel warp session has WIP in `src/`)
Stage ONLY explicit paths — `planet-lod-lab.html planet-archetypes.js
tests/planet-archetypes.test.js docs/FEATURES/...`. **NEVER `git add -A`.** Never touch
`src/`, `docs/NOW.md`, or anything outside the campaign paths. The commit PreToolUse hook
prints harmless `grep: subpattern name expected` lines — NOT a failure; check the
returned sha. Pattern that worked for F45: commit feature with `(pending sha)` →
nothing; actually F45 committed the card with the sha already known by doing it in two
commits (feature first → get sha → stamp §7 status + tracker row in a 2nd doc commit).
Either order is fine; just make sure §7 ends with the real sha and the tracker F-index
row flips to ✅ + rating.

## Other carried lessons (verified this session)
- **Defaults under-read** — build-plan defaults usually need walking up at live-verify
  (F45: `shatSubAmt` 0.4→0.7, `shatSubFreq` 3.5→5.0 to make the second scale read; F44:
  scale 4.0→1.6). The verify agent edits the `state.*` defaults in planet-lod-lab.html +
  widens any GUI slider whose good value sits at an edge.
- **Highest PROV id in use = 41** (F45). Only relevant if a later card IS a relief
  feature — F46–F49 overlays should not need one.

## Don't-duplicate references (real state lives here)
- **Tracker / position:** `docs/FEATURES/planet-lod-campaign-tracker.md`.
- **Campaign memory (auto-surfaces; has F44/F45 process notes + the relief lessons):**
  `~/.claude/projects/-home-ax/memory/well-dipper-lod-terrain-campaign.md`.
- **Freshest plumbing exemplar:** `git -C ~/projects/well-dipper show e94323e` (F45 — full
  relief feature) and `dde2332` (F44). NOTE: F46 is an overlay, so the *edit-site SET*
  differs (no PROV, emissive-bypass instead of accumulator) — use these for the
  uniform-decl / THREE-uniforms / per-frame-writer / FEATURES / GUI / state-init / test-line
  PATTERN, not for the relief-specific bits.
- **Testing how-to:** `~/.claude/projects/-home-ax/memory/well-dipper-testing-reference.md`.
- **Chrome :9223 launch (if the window got closed):**
  `~/.claude/projects/-home-ax/memory/chrome-devtools-9223-launch.md` — PowerShell
  `Start-Process`, fresh `--user-data-dir`, `dangerouslyDisableSandbox:true`.

## Suggested skills for the next session
- **None mandatory.** This is an in-flight campaign with its own ceremony (spec §13.4).
  Use the `Agent` tool directly for the five-dispatch loop (general-purpose, model `opus`).
  Do NOT invoke `dev-collab-scope` or the `verify-workstream` workflow — the campaign
  replaces them for these cards. Do NOT use `brainstorming` — the F46 card already scopes
  the feature; the architect writes the build plan.

## Infra state at handoff
- Dev server: Max has `npm run dev` on :5173 (confirmed up this session — F45 live-verified
  against it). It MAY have stopped between sessions; pre-check via MCP (above) and ask Max
  to restart if down.
- GPU Chrome :9223: up; this session left page 1 navigated to the lab (`?fresh=1`, zero
  console errors). Next session just re-navigates (relaunch only if the window was closed).
- Tree: clean on campaign paths at `f7c8d14`. Loose untracked PNGs sit at repo root (prior-
  session shots) — leave them, they're outside campaign paths. Parallel warp WIP may be
  uncommitted in `src/` — stage explicit paths only, never `git add -A`.
