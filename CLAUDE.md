# Well Dipper — project-local Claude instructions

Auto-loaded by Claude Code when working in `~/projects/well-dipper/`.
Supplements the global `~/.claude/CLAUDE.md`.

**Doc map:** [`docs/README.md`](docs/README.md) — entry point listing
every top-level doc and its job.

## Session start

1. Re-read [`docs/HEART_OF_DESIRE.md`](docs/HEART_OF_DESIRE.md) (5s — re-anchor to what we're for)
2. Skim [`docs/JOURNEY.md`](docs/JOURNEY.md) current-objective + KR status
3. Read [`docs/NOW.md`](docs/NOW.md) Active workstream + Next 1-3
4. Verify `~/.claude/state/dev-collab/active-workstream.json` well-dipper key matches NOW.md — if not, update one or the other before proceeding
5. **If the session is planet-LOD lab work → read [`docs/FEATURES/planet-lod-CHARTER.md`](docs/FEATURES/planet-lod-CHARTER.md) FIRST** (the durable strategic frame: lab≠game by design, the program arc, the canonical model location). It exists because fresh sessions keep losing that wider context; read it before tactical status.

## Session end

Update [`docs/NOW.md`](docs/NOW.md) to reflect what landed, what moved in/out of queue.

## Contextualize each feature in the larger structure

When PM-scoping / starting work / shipping, name which JOURNEY milestone
the work serves and which PLAYER_EXPERIENCE tier it lives in. One sentence
per workstream entry, brief, commit, or session-start orientation. Goal:
reflexive orientation, not bureaucratic ritual.

→ Full mechanics: [`PROTOCOLS/doc-updates-on-ship.md`](docs/PROTOCOLS/doc-updates-on-ship.md)

## Project-specific triggers

### Rule 7 — Refresh dep graph before PM scoping (system-changing workstreams)
Run `npm run doc-graph` to refresh SYSTEMS.md auto-regions, then invoke
PM with refreshed SYSTEMS.md. PM brief includes "Blast radius" section.
After PM returns brief, working-Claude post-processes to add `Scope:`
frontmatter (PM persona stays project-agnostic per Rule 11).
→ Full mechanics: [`PROTOCOLS/doc-updates-on-ship.md`](docs/PROTOCOLS/doc-updates-on-ship.md) §PM-trigger

### Rule 3 — Update docs before flipping workstream Status to Shipped
Update: FEATURES.md row (always); PLAYER_EXPERIENCE.md (if shipped
diverges from spec); SYSTEMS/<sys>/README.md (if wiring changed);
SYSTEMS/<sys>/changelog.md (if approach was tried-and-abandoned).
Tester checks via `npm run doc-rot --workstream <slug>`. Doc gap = FAIL.
→ Full mechanics: [`PROTOCOLS/doc-updates-on-ship.md`](docs/PROTOCOLS/doc-updates-on-ship.md) §Rule-3

### Rule 8 — Pre-push doc-rot check
`scripts/git-hooks/pre-push` runs `npm run doc-rot` project-wide on every
`git push`. Warns; does NOT block by default. Requires one-time setup:
`bash scripts/install-hooks.sh`.
→ First-time setup detail: [`PROTOCOLS/development.md`](docs/PROTOCOLS/development.md)

### Rule 11 — Project-specific triggers live HERE, not in PERSONAS/
`docs/PERSONAS/*` files are symlinked cross-project and stay
project-agnostic. Well-dipper-specific commands (`npm run doc-graph`,
file paths, YAML schemas) live in this file.
→ Rationale: [`PROTOCOLS/doc-updates-on-ship.md`](docs/PROTOCOLS/doc-updates-on-ship.md) §Rule-11

### Rule 12 — Project docs link Claude memory files, don't paste
When info exists in BOTH a memory `feedback_*.md` and a project doc,
the project doc links + adds project-specific context. Never pastes.
Drift prevention.
→ Rationale + linking pattern: [`PROTOCOLS/doc-updates-on-ship.md`](docs/PROTOCOLS/doc-updates-on-ship.md) §Rule-12

### Rule 14 — Structured fields where automation reads them
`Module(s):` in SYSTEMS/<sys>/README.md, `Systems touched:` in
FEATURES/<feature>.md, `Scope:` frontmatter in WORKSTREAMS/<slug>.md
follow specified formats. Free-form prose in these locations breaks
`doc-graph.js` and `doc-rot-check.sh` parsing.

## Sibling project: well-dipper-visual

`~/projects/well-dipper-visual/` is a separate working tree on a
different branch (per `memory/projects-inventory.md`). First E2E example
of the Dev Collab OS. Don't cross-contaminate workstream branches.

---

**Updated 2026-05-18** for doc system v5 (Phase 9 of migration). Compact
trigger-index pattern per Rule 13; detailed protocols live in
`docs/PROTOCOLS/`. Update freely as WD-specific patterns evolve, but
preserve the under-120-line size budget — beyond that, this file gets
ignored per zazencodes / Anthropic-eng patterns.
