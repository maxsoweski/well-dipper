# Recording protocol (canvas + DOM-only)

The Shipped-gate artifact for any visible / animated / phased feature is a video recording of the feature, evaluated by Max. Two paths exist depending on what the feature renders to:

- **Canvas path (default for `<canvas>`-rendered features):** agent captures via `~/.claude/helpers/canvas-recorder.js`, file lands in project via `~/.local/bin/fetch-canvas-recording.sh`, Max evaluates on playback or via contact sheet.
- **DOM-only path (fallback for features outside `<canvas>`):** Max captures via OS-level tool, drops file at a known path, agent picks up metadata only.

Both paths close the same `VERIFIED_PENDING_MAX <sha>` → `Shipped <sha> — verified against <recording-path>` status transition. The principle — motion evidence, Max-evaluated, not author/auditor proxy — is identical across paths. The mechanism differs only in who authors the capture.

Authored 2026-04-18 (DOM-only version) and 2026-04-19 (canvas path added). See `docs/WORKSTREAMS/warp-shipped-gate-process-fix-2026-04-18.md` + `docs/WORKSTREAMS/canvas-recording-workflow-formalization-2026-04-19.md` for the full provenance.

## Which path applies

- Feature renders to a `<canvas>` element (any WebGL / WebGPU / 2D-canvas game, shader project, procedural art app) → **canvas path**.
- Feature renders to DOM (forms, layouts, typography projects, SVG-only visuals) → **DOM-only path**.
- When in doubt, start with canvas. If `captureStream` fails on the selector (no `<canvas>` matches) the agent falls back to DOM-only without ceremony.

## When to record vs. when to screenshot

Recording is for **phased / animated / time-windowed** changes — warp phases, transitions, reveals, sequenced motion, anything where the authored experience unfolds across frames.

Static UI changes (a menu label swap, a static HUD adjustment, a stable shader still) remain a Playwright `browser_take_screenshot`. The recorder is a precision tool for motion evaluation; it is not the default for any visual change.

**Rule of thumb: if a single frame can settle the AC, a recording is wasted bytes.**

This section guards against over-capture — the agent-initiated recorder lowered capture cost to near-zero, which invites using it for changes where a PNG would be cheaper and equally valid.

## Capture path — canvas features (default)

Agent-initiated. Max's role is evaluator only; no capture action from Max.

### How the agent captures

1. Install the recorder helper via `browser_evaluate` / `evaluate_script`. The helper lives at `~/.claude/helpers/canvas-recorder.js`; paste its IIFE body into the eval. Install is idempotent.
2. Trigger the feature under test (click destination, Space ×3, whatever the workflow is). Real-flow input per `feedback_test-actual-user-flow.md`.
3. `await window.__canvasRecorder.stop()` — returns `{ sizeBytes, mimeType, filename, chunkCount }`. The blob is download-triggered to Chrome's Downloads folder; the agent does not receive the bytes.
4. From WSL: `fetch-canvas-recording.sh <filename> <project>/screenshots/max-recordings/`. The script polls Chrome's Downloads for up to 30s (Chrome's download flush is variable), then copies the file into the project.

### Drop path convention

`screenshots/max-recordings/<workstream-slug>-<YYYY-MM-DD>.webm`

- `<workstream-slug>` matches the brief filename without `.md` and without its trailing date.
- Multiple captures per workstream are suffixed: `-v2`, `-v3`. Latest wins.
- Target directory is auto-created by the fetch script.

### How the agent verifies

- `fetch-canvas-recording.sh` exits 0 and prints `<size-bytes> <target-path>`.
- Size > 0 bytes. A zero-byte file is a broken capture — re-run.
- For AC evaluation, the agent can extract a contact sheet (`~/.local/bin/contact-sheet.sh <video> <cols>x<rows> <fps> <output.png>`) or a single frame at a specific timestamp (`~/.local/bin/frame-at.sh <video> <mm:ss.fff> <output.png>`).
- The agent surfaces the contact sheet and any specific-timestamp frames to Max in chat. Max evaluates. Agent flips `VERIFIED_PENDING_MAX` → `Shipped` on Max's pass.

### Failure modes — canvas path

- **Timeout fetching from Downloads.** Chrome's flush latency occasionally exceeds 30s. Increase the fetch timeout (third arg) or re-run `stop()` to re-trigger the download.
- **`captureStream` selector mismatch.** The helper's `start()` returns `{ error: "no element matches selector ..." }` if no canvas matches. Adjust the selector (e.g., `#game-canvas`) or fall back to DOM-only.
- **Content-classifier refusal on `evaluate_script` return.** Do not retrieve blob data via eval-return — the 2026-04-18/19 incident was a 1M-char base64 chunk tripping a content classifier on Opus. The helper's contract is that `stop()` returns only metadata; route bytes through filesystem (download-trigger). If a future change to the helper accidentally returns blob bytes, it will hit this failure mode. General rule for all such helpers: *do not retrieve large binary payloads via `evaluate_script` return values; route them through the filesystem.*
- **Framerate mismatch.** If the page renders below the requested `fps`, the recording's timestamps are stretched. Not usually a correctness problem for Max's evaluation, but note if phase durations are AC-relevant.

## Capture path — DOM-only features (fallback)

Max-driven. Used when the feature renders to DOM and `captureStream` has no canvas to target.

### How Max captures (Windows)

Any of the below — pick whichever is convenient.

1. **Xbox Game Bar (preferred).** `Win+G` opens the overlay; record button or `Win+Alt+R` to toggle. Output lands in `C:\Users\Max\Videos\Captures\` as `.mp4`.
2. **Snipping Tool recording (fallback).** `Win+Shift+R` region-select recording. Save to the drop path directly.
3. **OBS Studio (heavy fallback).** Use if already configured.

Any format in `{.mp4, .mov, .webm, .mkv}` works for downstream.

### Drop path + delivery signal

Same path convention as the canvas path: `screenshots/max-recordings/<workstream-slug>-<YYYY-MM-DD>.<ext>`.

Max signals delivery in chat as plain text: *"Recording at `<path>`."*

### How the agent verifies — DOM-only path

- `ls -la <path>` — file existence and size sanity (few MB for 5–10s of 1080p).
- Format recognized (extension in the supported list).
- Agent **cannot watch the video**; Max is the evaluator. Agent's role is custodial: confirm the file exists, note metadata, flag anything obviously wrong.

### Failure modes — DOM-only path

- **Missing file at the named path.** `ls -la` returns nothing — ask Max for the actual path or a re-export.
- **Zero-byte file.** Xbox Game Bar occasionally corrupts on fast stop-start. Ask Max to re-export.
- **Exotic format.** Extensions outside `{.mp4, .mov, .webm, .mkv}` land — note it, don't refuse; Max sees the file.
- **Max drops screenshots or a filmstrip instead.** Flag it. *"That looks like a screenshot set, not an OS-level recording. Want to re-capture via Game Bar, or do you want to override the gate for this case?"* Honor explicit overrides; note in Status.

## Scope of the gate

Applies to: **visible, animated, or phased feature workstreams.** Warp phases, transitions, any animation sequence, progressive reveals, visual mechanics.

Does NOT apply to: pure-docs workstreams, refactors with no visual surface, bug fixes in non-visual code paths, infrastructure / tooling work. The workstreams that authored this protocol (`warp-shipped-gate-process-fix-2026-04-18` and `canvas-recording-workflow-formalization-2026-04-19`) are themselves doc/tooling and do not require a recording to close.

Director and PM decide per-workstream whether the gate applies. Default to yes when in doubt; cheap to add, expensive to retroactively insist on.

## See also

- `~/.claude/helpers/canvas-recorder.js` — agent-side capture helper.
- `~/.local/bin/fetch-canvas-recording.sh` — WSL-side save helper.
- `~/.local/bin/contact-sheet.sh`, `~/.local/bin/frame-at.sh` — ffmpeg review helpers.
- `~/.claude/CLAUDE.md` §"Development Collaboration OS" — `VERIFIED_PENDING_MAX` → `Shipped` status transition this protocol feeds.
- `docs/PERSONAS/pm.md` §"Per-phase AC rule" — companion rule for AC authoring (phase-sourced ACs from feature docs) that recordings verify against.
- `docs/WORKSTREAMS/warp-shipped-gate-process-fix-2026-04-18.md` — original DOM-only protocol authorship.
- `docs/WORKSTREAMS/canvas-recording-workflow-formalization-2026-04-19.md` — canvas path formalization.
