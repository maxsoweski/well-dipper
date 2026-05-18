# Shipped-gate protocol

Codifies the VERIFIED_PENDING_MAX → Shipped flow for well-dipper
workstreams. Cross-project rule lives in
`~/.claude/CLAUDE.md` Dev Collab OS §"Shipped-gate status states";
this doc names the well-dipper specifics.

## States

- **`VERIFIED_PENDING_MAX <commit-sha>`** — Tester PASSed code +
  doc-coverage review; awaiting Max UAT. Workstream Status field set
  to this verbatim.
- **`Shipped <commit-sha> — verified against <recording-path>`** —
  Max UAT confirmed against the named recording artifact. Workstream
  Status set to this verbatim.

## Gate criterion (visible / animated / phased features)

For features that change visible behavior (rendering, motion, UI,
audio, phased sequences), Shipped is **NOT** a valid flip on
working-Claude or Tester proxy evidence alone. A **video recording**
is the acceptance artifact.

Two capture paths:

### Canvas path (default for `<canvas>`-rendered features)

Agent-initiated capture via `~/.claude/helpers/canvas-recorder.js`.
File fetched into project via `~/.local/bin/fetch-canvas-recording.sh`.
Agent surfaces contact sheets / specific-timestamp frames
(`~/.local/bin/contact-sheet.sh`, `frame-at.sh`) for efficient Max
review. Max stays the evaluator; capture is not Max's action item.

### DOM-only path (fallback for features outside `<canvas>`)

Max-driven OS-level capture (Xbox Game Bar, Snipping Tool, OBS). Max
drops file at named path, signals in chat. Used when `captureStream`
has no canvas to target.

## Static UI changes

If one frame can settle the AC, a recording is wasted bytes. Use a
playwright / chrome-devtools screenshot instead. (E.g., button color
change, label text update.) The phased-experience gate does NOT
apply.

## Doc-only / process / refactor workstreams

The recording gate does NOT apply. Tester PASS criterion is just
doc-coverage + telemetry-equivalence (for refactors; see
`refactor-verification.md`).

## After Shipped flip — push protocol

Per Claude memory `feedback_push-on-shipped.md` +
`feedback_deploy-established-sites.md`: well-dipper is on the
established-deploy list. Push origin immediately after Shipped flip;
verify deploy succeeded. The Shipped commit IS the deploy commit.

Backstop: `~/.local/bin/deploy-status.sh` runs daily; writes drift to
`~/briefings/`.

## Cross-references

- `docs/PROTOCOLS/max-recording.md` — full Max-recording protocol
  detail (canvas + DOM-only path mechanics)
- `docs/PROTOCOLS/doc-updates-on-ship.md` — doc updates required before
  Shipped flip
- `docs/PERSONAS/tester.md` — Tester's role at this gate
- Claude memory: `feedback_push-on-shipped.md`,
  `feedback_deploy-established-sites.md`,
  `feedback_motion-evidence-for-motion-features.md`
