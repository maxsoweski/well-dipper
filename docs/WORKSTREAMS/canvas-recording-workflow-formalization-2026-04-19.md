# Workstream: Canvas-recording workflow formalization — agent-initiated capture + cross-project tooling (2026-04-19)

## Parent feature

None — this is a **process / tooling workstream**, not a game-feature
workstream. It is the second process workstream in this project, a direct
follow-on to `docs/WORKSTREAMS/warp-shipped-gate-process-fix-2026-04-18.md`
(commit `8482f86`). That sibling established the **Max-driven** OS-level
screen recording as the Shipped-gate artifact for visible / animated /
phased features. This brief formalizes the **agent-initiated** capture
workflow that was prototyped and validated the same day
(commit `0cb717c`, the warp-hyper-dimness-undo recording) and codifies
it as reusable infrastructure across any canvas-rendered project Max
works on.

The process artifacts it produces are adjacent to `docs/MAX_RECORDING_PROTOCOL.md`
(the Max-driven protocol it partially supersedes for canvas features) and
to `~/.claude/CLAUDE.md` §"Development Collaboration OS" (the Shipped-gate
paragraph added in `8482f86` that needs updating for the new path).

## Implementation plan

N/A — process / tooling workstream. Three small helper files, two doc
edits, one cross-project validation capture. No architectural reasoning
needed beyond the design choices captured in `## In scope` below; the
deliverables ARE the artifacts.

## Scope statement

Formalize the agent-initiated canvas recording workflow prototyped this
session into reusable cross-project tooling. Three helper files
(`canvas-recorder.js`, a WSL-side save helper, ffmpeg frame-review
helpers), two doc edits (protocol doc rewrite, CLAUDE.md §Dev Collab OS
update), and one cross-project validation capture on a non-Well-Dipper
canvas project. One unit of work because all six deliverables share a
single test criterion — does the workflow work end-to-end on a project
*other than* Well Dipper — and none of the intermediate pieces are
individually useful without the others (the helper needs a save path;
the save path needs ffmpeg review tools; the protocol doc and CLAUDE.md
edit need the helper they describe to exist; the cross-project
validation is the only way to substantiate "cross-project").

## How it fits the bigger picture

Against `~/.claude/CLAUDE.md` §"Development Collaboration OS"
Shipped-gate paragraph (added 2026-04-18 in commit `8482f86`):
the gate currently reads "a Max-driven OS-level screen recording is
the acceptance artifact." That phrasing was correct for the 2026-04-18
afternoon but was superseded within an hour by the agent-initiated
prototype that worked cleanly end-to-end. The gate's *principle* —
motion evidence, Max-evaluated, not author/auditor proxy — is unchanged.
The *mechanism* shifts: for canvas-rendered features, the agent drives
capture; Max's role narrows to evaluator. For DOM-only features
(forms, layouts, anything outside `<canvas>`), the Max-driven path
from the sibling brief remains canonical.

Against Well Dipper `docs/GAME_BIBLE.md` §11 Principle 6 — First
Principles Over Patches: the sibling `warp-shipped-gate-process-fix`
brief explicitly named "shipping a sophisticated automated video-diff
pipeline, a Playwright video-recorder integration, or a frame-diff
dashboard" as Principle-6 violations — patches over the
first-principles answer (*Max records, Max evaluates, we pick up the
file*). This workstream walks right up to that line and must not
cross it. The agent-initiated capture is NOT a replacement for Max's
evaluative role; it is a mechanical shortcut for the capture step that
leaves Max's evaluative role intact and in fact cheaper (agent can pull
exact frames / timestamps for Max to eyeball rather than asking him to
scrub the whole recording). The Drift risks section below pins down
where the line is.

Cross-project scope is load-bearing: Max explicitly requested it
("not just for our project going forward, but for other projects
where video screen capture is relevant"). The helpers therefore live
in `~/.claude/helpers/` (global) and `~/.local/bin/` (global), not in
Well Dipper's tree. The protocol doc's global-vs-local question is
decided in `## In scope` below.

## Acceptance criteria

1. **Canvas-recorder helper exists at `~/.claude/helpers/canvas-recorder.js`
   and installs idempotently via the same IIFE pattern as `filmstrip.js`.**
   Contract per `## In scope` Deliverable 1. Verified by installing in
   Well Dipper's dev page via `mcp__playwright__browser_evaluate`, calling
   `window.__canvasRecorder.start({ selector: 'canvas', fps: 30 })`,
   triggering a visible ~3s action, calling `await window.__canvasRecorder.stop()`,
   and confirming the `.webm` file appears in `C:\Users\Max\Downloads\`
   within 5s. The second install call returns `'already installed'`.

2. **WSL-side save helper exists at `~/.local/bin/fetch-canvas-recording.sh`
   (per Deliverable 2 below) and polls
   `/mnt/c/Users/Max/Downloads/<filename>` until present (with timeout),
   copies to the target path, prints size + target path on success.**
   Verified by running the helper immediately after AC #1's recording
   completes and confirming the file lands at
   `~/projects/well-dipper/screenshots/max-recordings/<filename>` with
   non-zero size.

3. **ffmpeg helpers `~/.local/bin/contact-sheet.sh` and
   `~/.local/bin/frame-at.sh` exist, are executable, and produce correct
   output.** `contact-sheet.sh <input.webm> <cols>x<rows> <fps> <output.png>`
   produces a tiled PNG. `frame-at.sh <input.webm> <mm:ss.fff> <output.png>`
   produces a single frame at the named timestamp. Verified by running
   both against the AC #1 recording and opening the resulting PNGs via
   Read tool (image view).

4. **`docs/MAX_RECORDING_PROTOCOL.md` is updated to reflect the
   agent-initiated path as the default for canvas features while
   retaining the Max-driven fallback for DOM-only features.** Specific
   edits per PM decision in `## In scope` Deliverable 4 below
   (local-canonical; no global copy). Doc names: (a) the agent-initiated
   workflow — install `canvas-recorder.js`, record, fetch via WSL helper;
   (b) the DOM-only fallback — unchanged from today's doc; (c) the
   boundary rule — if `captureStream` can reach the feature, agent-initiated;
   otherwise, Max-driven; (d) Max's evaluator role — unchanged in both
   paths; (e) failure modes — content-classifier refusal from base64
   retrieval (DON'T), zero-byte files, framerate mismatch.

5. **`~/.claude/CLAUDE.md` §"Development Collaboration OS" Shipped-gate
   paragraph is updated** to state that canvas-rendered features use
   agent-initiated capture via `canvas-recorder.js`, with the motion-evidence
   principle and Max's evaluator role intact, and that DOM-only features
   retain the Max-driven OS-level path. The boundary is named explicitly
   (one sentence is enough). Edit lands inline; Max's eyeball invited in
   the commit message.

6. **Cross-project validation — canvas-heavy target only.** This
   workstream's validation covers the **canvas-rendered** path of the
   Shipped gate. The target is **Shader Lab** (`~/projects/shader-lab/`),
   a WebGL-canvas-at-60Hz project — the strictest test available for
   the agent-initiated canvas path. Working-Claude installs
   `canvas-recorder.js` on Shader Lab's primary canvas, captures ≥3s
   of animation, runs `contact-sheet.sh`, and records the resulting
   contact-sheet path in this brief's close-out section. Pass =
   recording + contact sheet both exist and are non-empty; fail = any
   helper needs a project-specific patch to work.
   **Out of scope for this AC:** validating the **DOM-only** Max-driven
   path on a DOM-only project, and validating a **hybrid canvas+DOM**
   project (e.g., Approaching Vividness, which mixes `<canvas>` and
   DOM across lessons). Those validations belong to a future workstream
   — see `## Out of scope` §"Hybrid + DOM-only validation (future
   workstream)." The cross-project *claim* this workstream
   substantiates is therefore narrower than "works on any project":
   it is "works on any canvas-heavy project." That is what the
   deliverables in this brief actually build and test.

7. **Two commits, one per owning tree.** One Well Dipper commit stages
   `docs/MAX_RECORDING_PROTOCOL.md`, this brief, and any updates to the
   sibling `warp-shipped-gate-process-fix-2026-04-18.md` close-out
   (noting that the gate's capture path has evolved). One `~/.claude/`
   edit (not a git commit — `~/.claude/` is not a repo per global
   MEMORY.md; the edit lands in place and the session's commit log
   records it via normal file mtime). The three global helper files
   (`canvas-recorder.js`, `fetch-canvas-recording.sh`, `contact-sheet.sh`,
   `frame-at.sh`) also land in `~/.claude/helpers/` and `~/.local/bin/`
   in place, not a git tree. Well Dipper commit message shape:
   `process(dev-collab): agent-initiated canvas recording workflow
   + cross-project helpers`. Commit body cites commit `8482f86`
   (sibling brief), commit `0cb717c` (prototype that validated the
   pattern), and this brief path.

## Principles that apply

(From `docs/GAME_BIBLE.md` §11 Development Philosophy. Two principles
are load-bearing for a process / tooling workstream; the other four
are feature-oriented and not directly relevant here.)

- **Principle 6 — First Principles Over Patches.** The sibling
  `warp-shipped-gate-process-fix` brief named "building an automated
  video-diff pipeline" as a Principle-6 violation — a patch over the
  first-principles answer (*Max records, Max evaluates, we pick up the
  file*). The agent-initiated capture is the closest this workstream
  can get to that violation without crossing into it. The first-principles
  test: does the mechanism preserve Max's evaluator role, or does it
  replace him? Answer: preserves. Agent captures and surfaces frames;
  Max evaluates ACs against what he saw. If a future deliverable
  started doing frame-level automated comparison against a "known good"
  recording, that crosses the line. The three ffmpeg helpers stop at
  contact-sheet / single-frame extraction — observability tools, not
  judgment tools.
  *Violation in this workstream would look like:* an automated
  "diff this recording against the last shipped recording" helper,
  a PSNR / SSIM frame-compare tool, a video-hash "regression detector,"
  a CI-side recording validator, or any mechanism that lets the agent
  claim Shipped without Max seeing the recording.

- **Principle 2 — No Tack-On Systems.** The cross-project scope could
  tempt a new layer — "Max's visual-QA framework," "the Canvas Capture
  System" with a config file, a registry of recordings per project,
  an index of contact sheets. That's exactly what Principle 2 warns
  against. The global helpers are three files in `~/.claude/helpers/`
  and `~/.local/bin/`, same shape as `filmstrip.js` today. No registry,
  no config, no index. Each project's recordings live where that
  project already puts them (Well Dipper: `screenshots/max-recordings/`;
  other projects: wherever they keep visual artifacts today or a new
  parallel directory). Source of truth for "did Max verify this?"
  remains the workstream brief's Status line, unchanged.
  *Violation in this workstream would look like:* building
  `~/.claude/canvas-recordings-registry.json`, a config-driven
  project-recognition layer in the canvas-recorder helper, a
  "recordings dashboard" HTML, or a cross-project symlink farm.

## Drift risks

- **Risk: Scope-creep into a "canvas recording framework."**
  Adjacent capabilities are each individually defensible — automated
  frame diffing, audio capture, OBS-like overlay compositing, video
  trimming, Chromium-DevTools-Protocol-based capture for better
  timing guarantees, a project-recognition layer that auto-selects
  the canvas selector. Each one is a patch in Principle-6 terms and
  a tack-on in Principle-2 terms.
  **Why it happens:** Max invited cross-project scope, which creates
  a permission gradient for "while we're at it" additions. Also:
  building tools feels like leverage; the actual leverage was the
  40-line IIFE that already works.
  **Guard:** AC scope freezes the deliverables at three helpers,
  two doc edits, one validation capture. Anything beyond that is a
  new workstream. If working-Claude notices a capability worth
  adding, write it into `## Out of scope` with a note for a future
  brief — don't reach for it here.

- **Risk: Collapsing the gate's principle by accident.** The
  Shipped-gate exists because static-frame proxies hid temporal
  regressions (2026-04-18 dimness miss). Agent-initiated capture
  is a mechanical improvement to the *capture* step but must not
  become an excuse to claim Shipped without Max watching the recording.
  **Why it happens:** once the agent can fetch the recording, pull
  frames, and build a contact sheet, it's a short cognitive slip to
  "the contact sheet shows the feature, we're done." The sibling
  brief explicitly named this — the contact sheet is another static
  proxy.
  **Guard:** Protocol doc (Deliverable 4) names explicitly that
  the contact sheet / frame extractions are *orientation tools for
  Max's evaluation*, not Max-replacement. Status transition remains
  `VERIFIED_PENDING_MAX <sha>` → `Shipped <sha> — verified against
  <recording-path>`. Agent-initiated just means the agent produced
  the recording; Max still watches it (or reviews the frames the
  agent surfaces for him) before Shipped flips.

- **Risk: Content-classifier refusal blocks the workflow in the
  middle of a session.** Session 2026-04-18/19 incident: retrieving
  a ~1 MB base64-encoded video blob via `evaluate_script` return
  value tripped a content-classifier refusal on Opus. The prototype
  pivoted to download-trigger; the formalized helper must not
  regress to eval-return.
  **Why it happens:** base64 return is the most obvious shape for
  "browser code produces data, agent consumes data." A future
  session might try to "simplify" the helper by removing the
  download-trigger and returning bytes directly. It reads cleaner
  until it hits the classifier.
  **Guard:** Deliverable 1's contract names download-trigger
  explicitly. Helper source includes a comment at the top stating
  the **general rule** — *"do not retrieve large binary payloads via
  `evaluate_script` return values; route them through filesystem
  (download-trigger → Downloads folder → WSL `cp`)."* — alongside the
  specific case it was learned from: *"DO NOT return blob data from
  stop(); use download-trigger. See 2026-04-18/19 classifier refusal."*
  The general rule covers future binary-payload shapes that haven't
  been encountered yet (audio buffers, depth textures, frame
  sequences, etc.). Protocol doc repeats the warning in the
  failure-modes section, and the header comment of
  `canvas-recorder.js` carries the general rule so future
  maintainers see it without having to trace back through this brief.

- **Risk: Forgetting the DOM-only fallback.** `captureStream(30)`
  only reaches canvas content. DOM-only features (forms, layouts,
  non-canvas animations, SVG) still need Max-driven OS-level
  recording. If the protocol doc is rewritten as "agent-initiated
  is now the default" without preserving the DOM-only path, a future
  workstream touching a DOM feature has no gate.
  **Why it happens:** the agent-initiated path is strictly cheaper
  when it applies, so the revision temptation is to call it "the
  new way" and drop the "old way." The old way still covers cases
  the new way can't.
  **Guard:** AC #4 and AC #5 both name the DOM-only retention
  explicitly. Protocol doc has two named paths (agent-initiated for
  canvas; Max-driven for DOM) with a one-sentence boundary rule
  between them.

- **Risk: Agent over-reliance on captured recordings.** The new
  capability makes it trivial for working-Claude to always capture
  recordings, including for cases where a static screenshot would be
  cheaper and equally valid. If working-Claude now captures 15 MB
  webms for every trivial UI change, that's a new failure mode
  introduced by this workstream — cheap-to-invoke tools develop a
  gravity of their own, and bytes + review-time that could have been
  zero become the new default.
  **Why it happens:** with the helper installed and the save path
  automated, the *marginal* cost of "also capture a recording" feels
  like zero to working-Claude. The actual cost lands on Max —
  attention budget for reviewing a 30s webm when a single frame
  would have settled the AC — and on the project's `screenshots/`
  tree, which bloats with redundant motion evidence. The sibling
  brief's Shipped gate applies to *phased / animated / time-windowed*
  features; extending recording to every change is scope inflation
  of the gate itself.
  **Guard:** Protocol doc (Deliverable 4) names the trigger
  criterion explicitly — recording is for *phased / animated /
  time-windowed* changes per the Shipped-gate scope inherited from
  the sibling brief; static UI changes remain a PNG screenshot
  (Playwright `browser_take_screenshot`). Rule of thumb stated in
  the protocol doc: *if a single frame can settle the AC, a
  recording is wasted bytes.* The canvas-recorder helper is a tool
  for the cases where motion is the thing under test, not a
  replacement for static screenshot capture.

- **Risk: Framerate mismatch misleads Max on evaluation.**
  `captureStream(30)` samples at a fixed 30 Hz; the page may render
  slower (GPU-bound) or faster (high-refresh monitor). The recorded
  `.webm` may have stretched or compressed temporal spacing relative
  to what Max saw live. For warp-class features where phase durations
  matter ("HYPER is 3s, crown recedes in ~500ms"), a framerate-drifted
  recording could read as correct when the live experience was
  actually degraded.
  **Why it happens:** `captureStream` API doesn't guarantee
  one-frame-per-rAF-tick; it samples. Max would evaluate what he
  sees in the recording, not what the game actually rendered.
  **Guard:** Protocol doc names this limitation in failure modes.
  For phase-duration-sensitive features, the agent-initiated path
  is treated as a first-pass evaluator and Max retains the option
  to call for an OS-level recording if the webm looks off. Not a
  blocker for this workstream; documented caveat.

## In scope

### Deliverable 1 — `~/.claude/helpers/canvas-recorder.js`

Global helper, mirrors `filmstrip.js` shape. Contract:

- **Install pattern:** IIFE paste into `evaluate_script`. Idempotent —
  second install returns `'already installed'` without re-registering.
- **API:**
  - `window.__canvasRecorder.start({ selector = 'canvas', fps = 30, videoBitsPerSecond = 3_000_000, filename = null })` →
    returns `{ started, fps, mimeType, canvasW, canvasH }`.
    If `filename` omitted, defaults to `<selector>-<timestamp>.webm`
    where timestamp is `YYYYMMDD-HHMMSS`.
  - `window.__canvasRecorder.stop()` → async. On stop, triggers
    `<a download>` click to write the blob to Chrome's Downloads
    folder. Returns `{ sizeBytes, mimeType, filename }`. **Does NOT
    return the blob bytes.**
  - `window.__canvasRecorder.clear()` → releases MediaRecorder +
    stream + anchor element references. Idempotent.
- **Recording format:** `video/webm;codecs=vp9`, fallback
  `video/webm` if VP9 unsupported. Never attempt `video/mp4` —
  MediaRecorder support is uneven and a partial success is worse
  than a clean fallback.
- **Header comment block** names: (a) the purpose, (b) the
  **general rule** — *"do not retrieve large binary payloads via
  `evaluate_script` return values; route them through filesystem
  (download-trigger → Downloads folder → WSL `cp`)"* — stated at
  the top so future maintainers see it before they see the specific
  case, (c) the classifier-refusal history (2026-04-18/19 session,
  see Drift risks above) as the concrete instance the general rule
  was learned from, (d) why download-trigger instead of eval-return,
  (e) why VP9 webm, (f) why canvas-only (DOM-overlay bleed
  explanation — debug panels / HUDs that shouldn't contaminate
  evaluation frames).

### Deliverable 2 — `~/.local/bin/fetch-canvas-recording.sh`

Bash helper. Contract:

- **Signature:** `fetch-canvas-recording.sh <filename> <target-dir>
  [timeout-seconds]`
- **Behavior:** polls `/mnt/c/Users/Max/Downloads/<filename>` every
  0.2s up to `timeout-seconds` (default 10). On found: `cp` (not
  `mv` — leave the Downloads copy alone) to `<target-dir>/<filename>`,
  print `<size-bytes> <target-path>` on stdout, exit 0. On timeout:
  print error to stderr and exit 2.
- **Permissions:** `chmod +x` after creation.
- PM explicitly rejects the POST-to-local-endpoint alternative
  (see §"PM decision: download-trigger vs. POST endpoint" below).

### Deliverable 3 — ffmpeg frame-review helpers

Two small Bash wrappers in `~/.local/bin/`:

- `contact-sheet.sh <input-video> <cols>x<rows> <fps> <output-png>`
  → wraps `ffmpeg -i <input> -vf "fps=<fps>,scale=320:-1,tile=<cols>x<rows>"
  -frames:v 1 <output>`. Thumbnail width hardcoded at 320 (keeps
  contact sheets readable without requiring another arg).
- `frame-at.sh <input-video> <mm:ss.fff> <output-png>` → wraps
  `ffmpeg -ss <timestamp> -i <input> -frames:v 1 <output>`. Single
  frame at a named timestamp.

Kept minimal — no frame-diff helper. Principle-6: build only what
working-Claude will reach for at least three times; don't build
frameworks. If a third helper becomes clearly needed in practice,
add it in a future workstream.

### Deliverable 4 — `docs/MAX_RECORDING_PROTOCOL.md` rewrite

**PM decision: local-canonical, no global copy.** Reasoning:
the global helpers in `~/.claude/helpers/` and `~/.local/bin/` are
Max's dotfiles surface and are genuinely cross-project. The protocol
doc, by contrast, describes a workstream-lifecycle interaction
(Shipped gate, VERIFIED_PENDING_MAX transition, Max evaluator role)
that is inherently coupled to the project's docs tree — the
`## Status` line of the workstream brief lives in the project, not
globally. Putting the protocol doc in `~/.claude/docs/` would couple
the protocol to Max's dotfiles while the status state lives in the
project — two sources of truth for one process. Local-canonical keeps
one source per process; each project that adopts this workflow copies
the protocol doc into its own `docs/` when it adopts the PM + Director
pair (same copy-in pattern as the persona files). The helper files
are mechanical; the protocol is process — different homes.

Edits to `docs/MAX_RECORDING_PROTOCOL.md`:

- **Title / framing:** keep the filename (`MAX_RECORDING_PROTOCOL.md` —
  the "Max" in the title now refers to *Max as evaluator*, which is
  still the load-bearing role; the capture step's author is mechanical).
  Alternative considered and rejected: rename to
  `CANVAS_RECORDING_PROTOCOL.md`. Rejected because the doc also
  documents the DOM-only fallback where Max is still the capture author.
  Single filename for both paths keeps lookups simple.
- **New §"Capture path — canvas features (default)":** describes the
  agent-initiated workflow. Install `canvas-recorder.js`, call
  `start()`, trigger the feature, call `stop()`, run
  `fetch-canvas-recording.sh` to copy into `screenshots/max-recordings/`.
  Names the drop path convention from today's doc (unchanged).
- **Renamed §"Capture path — DOM-only features (fallback)":** what
  was today's entire doc, slightly trimmed. Xbox Game Bar, Snipping
  Tool, OBS. Used when the feature is outside `<canvas>`.
- **New §"Which path applies":** one paragraph. If the feature
  renders to a `<canvas>` element (any WebGL / WebGPU / 2D-canvas
  game, shader project, procedural art app), canvas path. If it
  renders to DOM (forms, layouts, typography projects that use HTML,
  SVG-only features), DOM-only path. When in doubt, start with canvas;
  if `captureStream` fails on the selector, fall back to DOM-only
  without ceremony.
- **New §"When to record vs. when to screenshot":** names the
  recording-trigger criterion inherited from the sibling brief —
  recording is for *phased / animated / time-windowed* changes
  (warp phases, transitions, reveals, sequenced motion). Static UI
  changes (a menu label swap, a static HUD adjustment, a stable
  shader still) remain a PNG screenshot via Playwright
  `browser_take_screenshot`. **Rule of thumb:** *if a single frame
  can settle the AC, a recording is wasted bytes.* This section
  guards against the over-capture drift risk above — the new
  helper is a precision tool for motion evaluation, not a
  default-for-everything capture mechanism.
- **Updated §"How Max signals delivery":** canvas path eliminates
  delivery signal — agent produced the file, agent knows where it
  is. DOM-only path preserves the plain-text chat convention from
  today's doc.
- **Updated §"How working-Claude verifies":** canvas path adds
  "file lands at expected target via `fetch-canvas-recording.sh` exit
  code 0; size > 0 bytes." DOM-only path unchanged.
- **Updated §"Failure modes":** adds (a) content-classifier refusal
  on base64 eval-return — don't; (b) framerate mismatch caveat for
  phase-duration-sensitive features; (c) `captureStream` selector
  mismatch (selector doesn't match any canvas) — fall back to DOM-only.
  Retains today's zero-byte and missing-file cases for DOM-only.
- **Updated §"See also":** adds pointers to
  `~/.claude/helpers/canvas-recorder.js` and
  `~/.local/bin/fetch-canvas-recording.sh`. Retains pointers to
  `~/.claude/CLAUDE.md` §Dev Collab OS and
  `docs/PERSONAS/pm.md` §"Per-phase AC rule."

### Deliverable 5 — `~/.claude/CLAUDE.md` §"Development Collaboration OS" edit

Update the Shipped-gate paragraph added in commit `8482f86`. Current
text (paraphrased): *"For visible / animated / phased feature
workstreams, Shipped is not a valid flip on working-Claude or Director
proxy evidence alone — a Max-driven OS-level screen recording is the
acceptance artifact."*

Updated text should say:

- For **canvas-rendered** features, the acceptance artifact is an
  **agent-initiated recording** via
  `~/.claude/helpers/canvas-recorder.js`, fetched to the project via
  `~/.local/bin/fetch-canvas-recording.sh`, and reviewed by Max
  (directly or via contact sheet the agent surfaces).
- For **DOM-only** features, the acceptance artifact remains a
  **Max-driven OS-level** screen recording per
  `docs/MAX_RECORDING_PROTOCOL.md` §"Capture path — DOM-only features."
- The **principle is unchanged**: motion evidence, Max-evaluated, not
  author/auditor proxy. The `VERIFIED_PENDING_MAX <sha>` →
  `Shipped <sha> — verified against <recording-path>` transition
  applies to both paths.

Edit lands inline. Commit / file-mtime records it; Max's eyeball
invited via the Well Dipper commit message body (Max reads commit
messages; this is the signal channel for user-visible edits to his
files — same convention as commit `8482f86`).

### Deliverable 6 — Cross-project validation capture

**PM recommendation: Shader Lab** (`~/projects/shader-lab/`).

Reasoning:
- Shader Lab's domain *is* WebGL-canvas animation at 60Hz; if the
  helpers don't work on Shader Lab they don't work on any Well Dipper
  adjacent project. Worst-case test for cross-project claim.
- Currently active (started 2026-04-15 per
  `~/.claude/projects/-home-ax/memory/shader-lab-progress.md`) — Max
  is likely to benefit from the helpers being installed there soon.
- Simple mental model: one primary canvas per lesson page, same
  `canvas` selector default works.

Alternative considered: **Approaching Vividness** (the 18-lesson eG
storyboards adaptation, live at easymaking.io/av). Rejected as first
target because AV may mix canvas and DOM across lessons, which is a
mixed test rather than a clean cross-project test. After Shader Lab
validates, AV is a good second target — but that's for a future
session, not this workstream.

Also considered: **Pretext Lab**. Rejected because its Typographer's
Workbench aesthetic is primarily DOM-rendered (typography library);
would exercise the DOM-only fallback, not the new canvas path, so it
doesn't validate the cross-project claim for the new helper.

Validation procedure:
1. Start Shader Lab's dev server per its README (working-Claude does
   NOT start it — Max runs in his terminal per
   `feedback_no-start-servers.md`; ask Max if the server isn't already
   running).
2. Navigate via Playwright to a Shader Lab lesson with a visible
   canvas animation.
3. Install `canvas-recorder.js` via `browser_evaluate`.
4. `start({ selector: 'canvas', fps: 30 })`.
5. Wait ~3s with the animation running.
6. `await stop()`.
7. Run `fetch-canvas-recording.sh <filename>
   ~/projects/shader-lab/screenshots/` (create that dir if it doesn't
   exist — `mkdir -p` first).
8. Run `contact-sheet.sh <copied-file> 3x4 2
   ~/projects/shader-lab/screenshots/<contact-sheet-name>.png`.
9. Verify both files are non-empty. Record the contact sheet's path
   in this brief's close-out.

Pass = both files exist and are non-empty with no helper patching.
Fail = any helper needed a project-specific edit; iterate the helper
here (or file a follow-up workstream if iteration requires rethinking
the contract).

### Workstream artifacts

- Three global helper files land in place (`~/.claude/helpers/` and
  `~/.local/bin/`). `~/.claude/` is not a git repo per global MEMORY.md,
  so these are not "committed" in the git sense; they're recorded by
  file mtime and referenced from the Well Dipper commit body.
- Two doc edits (`docs/MAX_RECORDING_PROTOCOL.md`,
  `~/.claude/CLAUDE.md`).
- One Well Dipper git commit staging specifically:
  `docs/MAX_RECORDING_PROTOCOL.md`, this brief, and any update to
  `docs/WORKSTREAMS/warp-shipped-gate-process-fix-2026-04-18.md`
  close-out note. Not `git add -A`.
- One cross-project screenshots directory populated on Shader Lab
  (`~/projects/shader-lab/screenshots/` with the webm + contact sheet).
  Not committed to Shader Lab unless Max requests — this is a
  validation artifact for this brief, not a Shader Lab deliverable.

## Out of scope

- **Automated video-diff / frame-hash / "regression detector" tooling.**
  Principle-6 violation; see Drift risks. The ffmpeg helpers stop at
  contact-sheet and single-frame extraction. A future workstream may
  add more if clearly needed; not this one.
- **Audio capture.** `captureStream` can include audio tracks; the
  helper does not. Well Dipper's audio evaluation is a separate
  concern and not load-bearing for the Shipped gate today.
- **DOM-page recording via `getDisplayMedia`.** Requires user gesture
  per browser security model; doesn't fit the
  `evaluate_script`-driven workflow. DOM-only features remain on the
  Max-driven OS-level path; documented in Deliverable 4.
- **CI integration / automated test harness.** The recording is an
  evaluative artifact for Max, not a CI gate. If a future session
  wants CI-side verification, that's a new workstream and requires
  explicit Principle-6 scrutiny.
- **Recordings registry / dashboard / cross-project index.**
  Principle-2 violation. Workstream brief Status line remains the
  source of truth per workstream.
- **Retroactively re-gating past Shipped workstreams.** Sibling brief
  already decided forward-only; this workstream inherits that decision.
- **Playwright's built-in video recording.** Considered and rejected
  for the same reason the sibling brief rejected it — Playwright
  video undersampling degrades under the same conditions the gate
  needs to catch (GPU-bound fixes). `captureStream` on the page's
  own canvas runs inside the same GPU context as the rendering
  under test — if the rendering degrades, the recording degrades in
  the same way and Max sees what he would have seen live.
- **Changing `filmstrip.js`.** It addresses a different phase of
  visual QA (contact-sheet sampling during a live test run, before
  Shipped). Complementary, not replaced.
- **Broader Dev Collab OS rewrite.** Only the Shipped-gate paragraph
  is edited in Deliverable 5. The rest of §"Development Collaboration
  OS" is untouched.
- **Hybrid + DOM-only validation (future workstream).** AC #6 covers
  a canvas-heavy target (Shader Lab) only. Validating the agent
  workflow against a **hybrid canvas+DOM project** (e.g., Approaching
  Vividness — mixes `<canvas>` lessons and DOM lessons) and
  validating the DOM-only Max-driven path end-to-end on a **DOM-only
  project** (e.g., Pretext Lab, easymaking-site) are explicitly
  deferred. A future validation workstream may carry those cases if
  the workflow is adopted on a hybrid or DOM-only project and a
  previously-unseen failure shows up. Named here so the scope is
  honest — this workstream substantiates the *canvas-heavy* cross-
  project claim, not a blanket "works everywhere" claim.

## PM decision: download-trigger vs. POST endpoint

**Download-trigger wins.** Reasoning:

- **Validated.** The prototype this workstream formalizes uses
  download-trigger end-to-end (commit `0cb717c`, ~13s / 3.67 MB
  recording landed cleanly). POST-to-local-endpoint is theoretical.
- **Principle 2 (No Tack-On Systems).** POST requires a local HTTP
  server or Vite middleware — a new component with its own failure
  modes (port conflicts, CORS, middleware lifecycle tied to dev
  server). Download-trigger is zero infrastructure: browser feature,
  WSL `cp`, done.
- **Cross-project cost.** POST-based needs each project to configure
  a dev-server middleware. Download-trigger is identical across all
  projects — same browser API, same Downloads folder, same WSL `cp`.
  The cross-project claim is cheaper to substantiate with
  download-trigger.
- **One drawback acknowledged:** download-trigger takes ~1-3s to land
  the file after `stop()` returns. That's what Deliverable 2's
  polling helper handles. POST would be synchronous. For this
  workflow's cadence (capture → WSL fetch → review), the async delay
  is inconsequential — Max isn't waiting on sub-second response times
  for a gate artifact.

If a future workstream hits a case where the async delay matters
(rapid iteration across many captures; batch processing), POST is
the right escalation target. Not now.

## PM decision: global-vs-local for protocol doc

**Local-canonical (`docs/MAX_RECORDING_PROTOCOL.md` in each project
that adopts the workflow).** Reasoning above in Deliverable 4.
One-line summary: the helpers are mechanical (global); the protocol
describes a workstream-lifecycle interaction coupled to the
project's `## Status` source of truth (local). Same homes as the
persona files (`docs/PERSONAS/pm.md` etc. — project-local).

## Pushback on scope framing from the invocation

The invocation asked for PM pushback on its scope framing. Two items:

1. **AC #7 in the invocation says "separate commit for the global
   helper files in `~/.claude/` if that's a separate repo (it isn't —
   `~/.claude/` isn't a git repo, so that edit just lands in-place)."**
   That's accurate but the phrasing "separate commit" may mislead
   future sessions. Reframed in AC #7 of this brief as "one Well
   Dipper git commit; helper files land in place in `~/.claude/` and
   `~/.local/bin/` and are referenced from the commit body by
   absolute path." One source of truth (the Well Dipper commit), no
   phantom "second commit" that doesn't exist.

2. **The invocation's framing of Deliverable 6 ("pick whichever is
   closest to hand; Shader Lab or Approaching Vividness are likely
   candidates") is correct but underspecifies.** The cross-project
   claim is load-bearing enough that the validation target should be
   chosen on worst-case-test criteria, not convenience criteria. PM
   picks Shader Lab (Deliverable 6 above) specifically because its
   domain is WebGL-canvas animation at 60 Hz — if the helpers work
   there, they work on any Well Dipper-adjacent project. Approaching
   Vividness is a weaker first test because its canvas/DOM mix makes
   failures ambiguous ("did the helper fail, or did we pick a DOM
   lesson?"). PM strengthens the AC from "pick what's closest" to
   "pick the strictest canvas-only test available."

No pushback on the three-helpers-two-docs-one-validation scope shape
itself. That shape is right.

## Ownership

- **Writing the three helper files (`canvas-recorder.js`,
  `fetch-canvas-recording.sh`, `contact-sheet.sh`, `frame-at.sh`):**
  working-Claude, per this brief. Four files technically (two ffmpeg
  helpers); "three deliverables" groups the two ffmpeg helpers as one
  deliverable since they share purpose + location.
- **`docs/MAX_RECORDING_PROTOCOL.md` rewrite:** working-Claude
  authors per Deliverable 4. PM reviews against ACs if Max wants.
- **`~/.claude/CLAUDE.md` §"Development Collaboration OS" edit:**
  working-Claude writes the edit inline. Max's file; edit is
  **proposed, awaits Max's acceptance** in the sense that Max's
  invocation in this session covers the edit landing, but the commit
  message flags the specific §"Development Collaboration OS" change
  so Max can eyeball at his convenience. If Max rejects the phrasing,
  iterate in a follow-up commit.
- **Cross-project validation capture (Deliverable 6):** working-Claude
  runs the test against Shader Lab. Max is not in the loop for this —
  it's an infrastructure validation, not a feature evaluation. If the
  test fails, working-Claude notifies Max and iterates.
- **Status transitions on this brief:** PM-owned.
  `Drafted → In progress → Shipped` (on all seven ACs met; this
  workstream is doc-only / process / tooling and does NOT require a
  Max-recording to close — the gate does not apply to itself, same
  carve-out as the sibling brief).

## Handoff to working-Claude

Read this brief. Then:

1. `~/.claude/helpers/filmstrip.js` — the shape pattern
   `canvas-recorder.js` mirrors (IIFE, idempotent install,
   `window.__*` namespace, `.start() / .stop() / .clear()`). Read it
   in full before writing the new helper.
2. `docs/MAX_RECORDING_PROTOCOL.md` — today's version; you're rewriting
   it, so carry its phrasing and register forward where applicable.
3. `docs/WORKSTREAMS/warp-shipped-gate-process-fix-2026-04-18.md` —
   the sibling brief this workstream extends. Its §"Ownership" and
   its treatment of the `~/.claude/CLAUDE.md` edit is the pattern to
   follow.
4. `~/.claude/CLAUDE.md` §"Development Collaboration OS" — the
   section you'll be editing. Locate the Shipped-gate paragraph
   added in commit `8482f86`.

Then, in order:

1. **Write `~/.claude/helpers/canvas-recorder.js`.** IIFE shape per
   `filmstrip.js`. Contract per Deliverable 1. Header comment names
   the classifier-refusal history, the download-trigger rationale,
   and the canvas-only rationale. Install idempotent.
2. **Write `~/.local/bin/fetch-canvas-recording.sh`** per Deliverable 2.
   `chmod +x` after creation.
3. **Write `~/.local/bin/contact-sheet.sh`** and
   **`~/.local/bin/frame-at.sh`** per Deliverable 3. `chmod +x` both.
4. **Smoke-test on Well Dipper** — install `canvas-recorder.js` in the
   running Well Dipper dev page via Playwright, capture a ~3s
   recording of any visible animation (galaxy rotation, ship thrust,
   whatever's immediately available), run `fetch-canvas-recording.sh`,
   run `contact-sheet.sh`. Confirm end-to-end. This is NOT the AC #1
   verification of a polished deliverable — it's a mid-workstream
   sanity check before spending time on docs. If it fails, iterate
   the helper before moving on.
5. **Rewrite `docs/MAX_RECORDING_PROTOCOL.md`** per Deliverable 4.
   Preserve the DOM-only fallback as a full section; add the
   canvas-default path as a new leading section; name the boundary
   rule between them.
6. **Edit `~/.claude/CLAUDE.md` §"Development Collaboration OS"**
   Shipped-gate paragraph per Deliverable 5.
7. **Run the Shader Lab cross-project validation** per Deliverable 6.
   Start by asking Max to confirm Shader Lab's dev server is running
   (do NOT start it yourself — `feedback_no-start-servers.md`). Record
   the contact-sheet path back into this brief's close-out.
8. **Stage specific Well Dipper paths and commit.** Commit message
   per AC #7.
9. **Update §"Status" in this brief to Shipped** once all seven ACs
   are met. Record commit SHA, contact-sheet path from the Shader Lab
   validation, and any iteration notes if helpers needed tweaking.
10. **Notify in chat:** *"Canvas recording workflow landed. Global
    helpers at `~/.claude/helpers/canvas-recorder.js` and
    `~/.local/bin/{fetch-canvas-recording.sh, contact-sheet.sh,
    frame-at.sh}`. Protocol doc rewritten at
    `docs/MAX_RECORDING_PROTOCOL.md`. `~/.claude/CLAUDE.md` §Dev
    Collab OS Shipped-gate paragraph updated — please eyeball and
    adjust phrasing if you want. Shader Lab validation passed —
    contact sheet at `<path>`."*

Artifacts expected at close: four helper files, two doc edits, one
Well Dipper commit, one cross-project validation run with contact
sheet, this brief Status line flipped to Shipped. No Max-recording
required — this workstream is process / tooling only; the gate does
not apply to itself (same carve-out as the sibling brief).

## Status

**Drafted by PM 2026-04-19.** Awaiting working-Claude execution.
Status transitions expected: `Drafted` → `In progress` → `Shipped
<sha>` on all seven ACs met, including the Shader Lab cross-project
validation producing a non-empty contact sheet.
