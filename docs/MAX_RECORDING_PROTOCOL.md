# Max-recording drop protocol

The Shipped-gate artifact for any visible / animated / phased feature is a Max-driven OS-level screen recording. This doc names how Max captures, where he drops the file, how he signals delivery, and how working-Claude picks it up. Authored 2026-04-18 as part of `warp-shipped-gate-process-fix-2026-04-18`; consumed first by `warp-hyper-dimness-undo-2026-04-18`.

## Why OS-level, not Playwright

Playwright's video recorder captures inside the headless/extension-driven browser. When a fix regresses framerate or GPU throughput (exact failure mode of the 2026-04-18 dimness miss), Playwright undersamples or stalls — the tool being used to evaluate the fix is degraded by the fix itself. OS-level capture is outside the browser process, so any rendering the player would actually see, the recording sees. Max is also the evaluator of record; the artifact being Max-driven keeps him in the loop, which is the whole point of the gate.

## How Max captures (Windows)

Any of the below — pick whichever is available and convenient. All produce acceptable artifacts.

1. **Xbox Game Bar (built-in, preferred).** `Win+G` opens the Game Bar overlay. Click the record button (or press `Win+Alt+R`) to start, same to stop. Output lands in `C:\Users\Max\Videos\Captures\` as `.mp4`. Zero setup; always available on Windows 11.
2. **Snipping Tool recording (built-in, fallback).** `Win+Shift+R` starts a region-select recording. Save to the project `screenshots/max-recordings/` directly. Output is `.mp4`.
3. **OBS Studio (heavy fallback).** Use if already installed and configured. Scene: Display Capture of the monitor showing the Well Dipper tab. Output container: `.mp4` or `.mkv`.

Any format in `{.mp4, .mov, .webm}` works for downstream. `.mkv` is fine if OBS defaults to it; rename to `.mp4` or leave as-is — the extension is informational, not validated.

## Drop path convention

`screenshots/max-recordings/<workstream-slug>-<YYYY-MM-DD>.<ext>`

- `<workstream-slug>` matches the workstream brief filename without the `.md` and without the trailing date. E.g., `warp-hyper-dimness-undo` for `docs/WORKSTREAMS/warp-hyper-dimness-undo-2026-04-18.md`.
- `<YYYY-MM-DD>` is the recording date, same convention as the workstream brief.
- Multiple recordings per workstream (re-takes) are suffixed: `-v2`, `-v3`. Latest wins.

The `screenshots/max-recordings/` directory doesn't need to pre-exist — `mkdir -p` equivalent behavior; Max drops into whatever path, working-Claude finds it.

## How Max signals delivery

Plain-text chat message with the file path. No JSON, no ceremony. Examples:

- *"Recording at `screenshots/max-recordings/warp-hyper-dimness-undo-2026-04-18.mp4`."*
- *"Dropped the warp recording — `screenshots/max-recordings/warp-hyper-dimness-undo-2026-04-18-v2.mp4` is the good take."*
- *"Recording in `C:\Users\Max\Videos\Captures\Well Dipper 2026-04-18 23-47-15.mp4` — haven't moved it yet, but it's done."* (Working-Claude can read from that path too; a copy into `screenshots/max-recordings/` happens on demand.)

## How working-Claude verifies

**Working-Claude cannot watch the video.** The verification step is not visual; it is:

1. **File existence.** `ls -la <path>` or equivalent. If the file is missing or zero bytes, ask Max to re-export.
2. **File size sanity.** Recordings of 5–10 seconds of a Well Dipper warp at 1080p or similar should be in the range of a few MB to a few tens of MB. A 100-byte file is broken; a 2 GB file is likely a full screen recording that accidentally wasn't stopped — ask Max.
3. **Format recognition.** Extension in `{.mp4, .mov, .webm, .mkv}`. If something exotic (`.flv`, `.avi`) lands, note it but don't refuse — Max sees the file, Max evaluates the ACs.

Max is the evaluator. Working-Claude's role on the recording is custodial: confirm the file is where Max said it is, note file metadata, flag if anything is obviously wrong. The AC evaluation itself ("did you see the destination-star crown?") is Max's call, reported back in chat.

## What working-Claude does after verification

1. Update the workstream brief's `## Status` line from `VERIFIED_PENDING_MAX <commit-sha>` to `Shipped <commit-sha> — verified against <recording-path>`.
2. Commit the brief-status edit with a message like `status(workstreams): <brief-slug> shipped — Max recording verified`.
3. If any AC fails per Max's evaluation, escalate — the workstream may need iteration or a follow-up workstream. Do not re-open Shipped on one-off feedback; scope the iteration properly.

## Missing-file / zero-byte fallback

- **If Max says a path in chat but the file isn't there:** reply with the `ls -la` output (or absence thereof), ask for the actual path or a re-export.
- **If the file is zero bytes:** *"Recording at `<path>` exists but is 0 bytes — can you re-export? Xbox Game Bar sometimes corrupts on fast stop-start."*
- **If Max drops a Playwright filmstrip or a set of screenshots instead of an OS recording:** flag it. *"That looks like a filmstrip / screenshot series, not an OS-level recording. The Shipped gate requires OS-level capture — can you do a Game Bar recording instead?"* — unless Max explicitly overrides the gate for this case, in which case honor the override and note in the Status line.

## Scope of this gate

Applies to: **visible, animated, or phased feature workstreams.** Warp phases, transitions, any animation sequence, progressive reveals, visual mechanics.

Does NOT apply to: pure-docs workstreams, refactors with no visual surface, bug fixes in non-visual code paths, infrastructure / tooling work. The `warp-shipped-gate-process-fix-2026-04-18` workstream (this doc's authoring context) is itself doc-only and does not require a Max-recording to close.

Director and PM decide per-workstream whether the gate applies. Default to yes when in doubt; cheap to add, expensive to retroactively insist on.

## See also

- `~/.claude/CLAUDE.md` §"Development Collaboration OS" — `VERIFIED_PENDING_MAX` → `Shipped` status transition that this protocol feeds.
- `docs/PERSONAS/pm.md` §"Per-phase AC rule" — the companion rule for AC authoring (phase-sourced ACs from feature docs) that the recording verifies against.
- `docs/WORKSTREAMS/warp-shipped-gate-process-fix-2026-04-18.md` — the workstream that authored this doc.
- `docs/WORKSTREAMS/warp-hyper-dimness-undo-2026-04-18.md` — the first workstream to consume this protocol.
