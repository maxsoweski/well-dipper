# Testing conventions — template

System-wide template for per-project `docs/TESTING_CONVENTIONS.md`. Copy this file to `<project>/docs/TESTING_CONVENTIONS.md` and customize. The PM persona's brief template cites this conventions doc per project.

The framework: industry-standard three layers (unit / integration / UAT) with a conditional UAT rule. Most projects need unit + integration; UAT is relevant when the project has visible behavior a human user evaluates with their eyes.

## How this gets used

PM authors a workstream brief with a `## Test Coverage Plan` section. Each AC has a unit / integration / UAT entry. The PM cites THIS conventions doc rather than re-deriving per workstream what each layer means in this project.

Tester verdict's `## Evidence reviewed` section is organized by layer per the same vocabulary, with per-layer pass/fail in the verdict line.

Both depend on the conventions being filled in here, project-specific.

---

## Project: <NAME>

Replace this section in your project's instance.

### Stack
[Vite / Three.js / React / Vue / Astro / Cloudflare Workers / Express / etc.]

### Visible behavior?
[Yes / No]

If **No** (libraries, kits, internal tooling, doc-only projects), UAT is structurally N/A; the deepest layer applicable is integration. Workstream briefs in such projects mark UAT N/A with rationale.

If **Yes** (web apps, games, CLIs with output, anything a user observes), UAT is required for any workstream that touches the user-facing surface. PM asks per workstream whether a specific change touches the user-facing surface.

---

## Layer definitions

### Unit
**Scope:** smallest possible scope; internal to the code; deterministic; no external state.

**Mechanism:** [vitest / node:test / jest / pytest / cargo test / ...]

**Run:** [`npm test` / specific command]

**Lives at:** [`tests/` / `src/**/*.test.ts` / etc.]

**Examples in this project:**
- [pure-function tests, predicate tests, math helpers, string-parsing utilities]

**When to add:** any new pure function, parser, predicate, math helper, or data-transformation utility.

### Integration
**Scope:** biggest possible scope; exercises the system through a real-input or simulated-input funnel; deterministic if seeded.

**Mechanism:** [recording-replay against committed end-state goldens / Playwright scripts / supertest against API / cypress / ...]

**Run:** [specific command]

**Lives at:** [`tests/integration/` / `tests/recordings/` / `e2e/` / etc.]

**Examples in this project:**
- [recorded user sessions replayed; API request-response captured; full-render snapshots]

**When to add:** any feature whose correctness depends on multiple components composed (state machine + rendering, API + database, multiple modules in flow).

**Goldens:** committed at [path]. Generated via [command]. Diff via [tool/predicate].

### UAT (conditional)
**Applicable in this project?** [Yes / No / Per-workstream]

**UAT presupposes integration is GREEN** (added 2026-05-08). UAT is for ergonomics / navigation / workflow of features whose integration tests have CONFIRMED FUNCTIONAL — not for catching feature bugs. If integration reports regressions for the SUT, UAT cannot run on that SUT. See `feedback_three-layer-test-coverage.md` (updated 2026-05-08), `feedback_integration-must-cover-visible.md`, `feedback_pass-fail-vs-diagnostic.md` (rewritten 2026-05-08).

**For visible-behavior projects:** integration must catch every visible defect programmatically before UAT runs. If a defect can only be detected by asking the user to look at the screen, that's an integration coverage gap, not a UAT-layer surface. See `feedback_research-game-dev-testing-standards.md` for industry-standard mechanisms by dimension (screen-space, frame timing, cross-event state, pixel buffer, etc.).

**Drive-vs-watch litmus** (added 2026-05-08): UAT requires the user actually driving in their own environment with their own hands. Working-Claude or Tester driving via chrome-devtools is INTEGRATION, not UAT — even if the user reads the result. See `feedback_drive-vs-watch-distinction.md`.

**Mechanism (if applicable):** [Max with his own hands in his real browser / lab-mode keybinds in his Chrome / similar — explicitly user-driven]

**Lives at:** [`docs/uat/` / inline in workstream briefs / Tester verdict's "What Max should try" section]

**Felt-experience handoff:** Max's eyes are the load-bearing instrument for ergonomics evaluation of WORKING features. Tester PASSes integration structurally; Max GATE 3 confirms ergonomics in real environment. UAT items in the brief explicitly flag whether they require Max's eyes-AND-hands.

**When N/A:** rationale required (e.g., "engineering-only library; no user-facing surface").

**When BLOCKED:** integration is FAIL for the SUT; UAT cannot run. Workstream is integration-extension or triage, not UAT. Re-classify before greenlighting.

---

## Conditional UAT rule

PM asks per workstream: *"Is UAT relevant for this workstream?"* Most projects we work on together have visible behavior; UAT is usually relevant. Some workstreams within a project don't touch user-facing surface (refactor, dependency bump, internal helper); UAT can be N/A even within a UAT-applicable project.

**Mark N/A with rationale.** Don't force every layer onto every workstream — the table form is overhead when the workstream is genuinely small.

**Trivial workstreams** (1-2 ACs): collapse the Test Coverage Plan to a one-paragraph summary instead of a table. The vocabulary still applies; the formatting is right-sized.

---

## Tester verdict shape (this project)

When invoking `Agent(subagent_type="tester")` for this project, the verdict structure follows `~/projects/well-dipper/docs/PERSONAS/tester.md` §"Evidence reviewed (per layer)" + §"Verdict (per layer)". Per-layer block:

```
**Unit:** PASS | FAIL | N/A (rationale)
**Integration:** PASS | FAIL | N/A (rationale)
**UAT:** PASS | deferred to Max | N/A (rationale)
```

Followed by overall verdict line.

---

## Cross-references

- `~/projects/well-dipper/docs/PERSONAS/pm.md` §"Test Coverage Plan" — the brief-template section.
- `~/projects/well-dipper/docs/PERSONAS/tester.md` §"Evidence reviewed (per layer)" — the verdict shape.
- `~/.claude/projects/-home-ax/memory/feedback_three-layer-test-coverage.md` — the rule.
- `~/.claude/projects/-home-ax/memory/feedback_pass-fail-vs-diagnostic.md` — composes with layer-classification.
- `~/.claude/projects/-home-ax/memory/feedback_input-record-replay-integration.md` — canonical integration mechanism for runtime-behavior projects.
- `~/.claude/projects/-home-ax/memory/feedback_test-actual-user-flow.md` — UAT mechanism for projects with UI.
- `~/projects/well-dipper/docs/TESTING_CONVENTIONS.md` — example filled-in instance.
