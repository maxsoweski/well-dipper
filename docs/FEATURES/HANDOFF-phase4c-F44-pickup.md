# Handoff — Phase 4c F44 (hex-tessellation) pickup

**Written 2026-06-13** after F43 landed. Durable on-disk (NOT /tmp — /tmp wipes
on WSL restart, which is why the 2026-06-10 handoff was lost). Start a FRESH
session in `~/projects/well-dipper` and read this first.

## Where we are
- **8/15 Phase-4c cards done**, all 🟡 VERIFIED_PENDING_MAX. F43 just landed:
  commit `12be875` (crystalline facets + Crystal preset + exotic-geometric archetype).
- Tree clean for campaign paths; the interleaved supercruise commits are a parallel
  session's — **never touch `src/`, `docs/NOW.md`, or anything outside
  `world-engine-lab.html` / `planet-archetypes.js` / `docs/FEATURES` / `tests/planet-archetypes.test.js`**.
- **NEXT: F44 hex-tessellation**, then F45 (shattered-crust), F46–49 (overlays),
  F51 (rings), + the F38/F39 keep/stylize/drop parked-call to close the phase.

## Don't duplicate — read these (the real state lives here)
- **Position / source of truth:** `docs/FEATURES/planet-lod-campaign-tracker.md`
  (phase-status table + feature index; the ▶️/status column).
- **Method:** campaign spec §13.4 heavy loop = dossier-as-spec → card §6.5 build
  plan → subagent implement → code-review → live verify → §7 verdict.
  Spec: `docs/superpowers/specs/2026-06-09-planet-feature-refinement-campaign-design.md`.
- **Auto-surfacing memory:** `~/.claude/.../memory/well-dipper-lod-terrain-campaign.md`
  (Phase 4c progress block + the F43 live-verify lessons — read them, they save cycles).
- **Testing how-to:** `~/.claude/.../memory/well-dipper-testing-reference.md`.
- **F43 as the freshest exemplar to copy:** `git show 12be875` (preset + archetype +
  combiner + glint + provinces plumbing + GUI + driver gate + the test GLSL_NAME line).

## ⚠️ F44 is a HEAVIER loop than F43 was
**Only F43 had a pre-written §6.5 build plan** (that's why F43 went straight to the
implementer). For F44 onward, the implementer must **write its own §6.5 from the
dossier first**. Check `docs/FEATURES/cards/F44-hex-tessellation.md` — if §6.5 is
absent, the build plan is step 1 of the loop, not a given.

## Hard-won live-verify lessons (carry forward — each cost cycles)
- **Launch GPU Chrome :9223 from WSL** with `dangerouslyDisableSandbox:true` (interop
  is sandbox-blocked: `UtilConnectUnix:524`). Use **PowerShell `Start-Process`**, NOT
  `cmd /c start` (the latter throws "Access is denied" + spawns "Windows cannot find //"
  popups). Use a **fresh `--user-data-dir`** or a stale profile instance swallows the
  launch and :9223 never opens. Exact command that worked is in the campaign memory.
- **GLSL reserved-word / identifier collision blacks out the whole lab** and no static
  check catches it — the live `:9223` load is the ONLY blackout test. (`fc` is taken =
  gl_FragCoord; F43 used an `fct` prefix.)
- **Reading a `uFoo` uniform right after a state/preset change is stale** (frame writer
  runs next rAF) — tick ~5 frames first. `readPixels` post-rAF returns a cleared buffer
  — judge color from screenshots, not pixel reads.
- **Load with `?fresh=1`** or toggling any `*Enabled` flag triggers a sessionStorage
  scenario-restore that resets camera/uTime mid-A/B.
- **Implementer build-plan defaults can under-read** — live-walk the knobs to a value
  where the feature actually READS, then edit the state defaults + widen the GUI range
  so the new default stays mid-range walkable (F43: amp .5→2, scale 9→4, cov .45→.65).
- **Registration trio** (FEATURES + featureFolders + `.add()` GUI binding) is enforced
  by `tests/planet-archetypes.test.js` — run `npx vitest run tests/planet-archetypes.test.js`.
- **`docs/FEATURES/cards/shots/` is gitignored** (.gitkeep only) — shots are referenced
  by filename in card §7 but NOT committed. Commit only the tracked source/doc paths.

## Infra state at handoff
- Dev server: Max had `npm run dev` running on :5173 (he starts it; Claude can't).
- GPU Chrome :9223 is **up but parked at about:blank** (GPU hygiene). Next session just
  navigates the existing tab to `http://localhost:5173/well-dipper/world-engine-lab.html?fresh=1`
  — no relaunch needed unless the window was closed.

## Suggested skills for the next session
- None mandatory. This is an in-flight campaign with its own ceremony (spec §13.4) — do
  NOT invoke `dev-collab-scope`/`verify-workstream` (the campaign predates and replaces
  that flow for these cards). Use the Agent tool directly for implement/review subagents
  (model `opus` — `fable` is unavailable in this environment despite the subagent-model rule).
