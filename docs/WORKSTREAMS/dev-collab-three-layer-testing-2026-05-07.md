# Workstream: dev-collab three-layer testing framework (2026-05-07)

Meta-workstream. Modifies the dev-collab framework itself rather than building a feature. Output: PM brief shape gains a Test Coverage Plan section; Tester verdict shape classifies evidence by layer; per-project TESTING_CONVENTIONS template + well-dipper instance. Cross-project applicable.

## Why we care

Max's words (paraphrased from session 2026-05-07): the dev-collab framework currently produces success criteria in his language and Tester verifies them — that's heavily UAT-flavored, with unit and integration coverage handled implicitly. Industry-standard testing language (unit / integration / UAT) should be the spine of how workstreams are planned and verified. Making the layers explicit gives:

- **Coverage signal** — every AC names which layer covers it; gaps visible at brief time, not surprise-time.
- **Cleaner Tester verdicts** — evidence classified by layer, per-layer pass/fail, not lumped.
- **Portability** — same vocabulary regardless of project stack. PM brief written for max-gtd or motion-test-kit uses the same shape with project-specific conventions plugged in.
- **No conflict with existing personas / gate** — layer classification is a SHAPE concern (what goes in brief, what goes in verdict). The dev-collab-gate hook stays edit-count-based.

The conversation that surfaced this (Ari Nielsen review of the scene-inspection-layer test plan) was independently endorsing the framework's deliberate "felt-experience deferred to Max" carve-out as a *feature*: subjective UAT verification can't be automated; the framework's explicit Max-only handoff matches the textbook user-acceptance-testing definition.

## Current objective + success criteria

**Objective:** Bring industry-standard unit / integration / UAT vocabulary into the dev-collab framework as a first-class shape concern, without breaking what works (PM step-into role, Tester subagent, dev-collab-gate, three-Max-gate loop).

**Success criteria (in Max's language):**

1. **PM brief template gains a "Test Coverage Plan" section.** Per AC, names which layer covers it (unit / integration / UAT-if-applicable). Names the verification mechanism per layer. Tester reads this as the explicit map of what to verify and at what layer.
   - Tester verifies via: read updated `docs/PERSONAS/pm.md`, confirm new section is present + the brief-template snippet is well-formed.

2. **Tester verdict shape classifies evidence by layer.** Verdict line includes per-layer status: e.g. `Unit: PASS / Integration: PASS / UAT: deferred to Max`.
   - Tester verifies via: read updated `docs/PERSONAS/tester.md`, confirm verdict template includes per-layer block.

3. **System-wide TESTING_CONVENTIONS template** at `~/.claude/agents/templates/TESTING_CONVENTIONS.md`. Cross-project. Each project copies + customizes.
   - Tester verifies via: file exists, template is generic (no well-dipper-specific paths), includes the conditional-UAT rule.

4. **Well-dipper TESTING_CONVENTIONS instance** at `~/projects/well-dipper/docs/TESTING_CONVENTIONS.md`. Names what unit / integration / UAT mean for well-dipper specifically: vitest + node:test (unit), `__wd.runIntegrationSuite()` + future record-replay goldens (integration), chrome-devtools press_key by Tester + Max in real Chrome (UAT — applicable since well-dipper has visible behavior).
   - Tester verifies via: file exists at the path, names the conventions concretely with citations to existing infrastructure (`__wd`, kit's `createInputRecorder`, etc.).

5. **Conditional UAT rule.** PM persona doc states explicitly: most projects need only unit + integration; PM asks per-project whether UAT is relevant. Engineering-only projects (motion-test-kit-style libraries with no UI) explicitly N/A UAT in their conventions doc with rationale.
   - Tester verifies via: PM persona doc + system template both name the rule.

6. **Retroactive update to one shipped brief — `welldipper-scene-inspection-layer-2026-05-06`.** Adds a Test Coverage Plan section showing how the new vocabulary maps to what was actually verified. Validates the framework on real material rather than abstract.
   - Tester verifies via: section is present, classifies the work that already happened (T1-T4 verdicts) into unit/integration/UAT cleanly, identifies any gaps surfaced by the new lens.

7. **Cross-project applicability.** A second project either (a) has a TESTING_CONVENTIONS.md already, OR (b) is flagged in the brief as "next-up" so the framework gets exercised beyond well-dipper. Recommendation: spec out max-gtd's conventions as part of this workstream since it's the next-most-active project with a UI.
   - Tester verifies via: max-gtd has a stub or filled TESTING_CONVENTIONS.md.

8. **No regressions to existing framework.** PM persona's interview structure stays; Tester subagent's invocation pattern stays; dev-collab-gate hook untouched; three-Max-gate loop unchanged. New shape is ADDITIVE.
   - Tester verifies via: diff against pre-workstream state of PERSONAS docs shows additions only, no deletions of existing rules.

## Architectural connections

### Inputs (what this consumes)

- **PM persona** at `~/projects/well-dipper/docs/PERSONAS/pm.md` — the brief template living here. Step-into-role per `feedback_pm-is-step-into-role.md`.
- **Tester persona** at `~/projects/well-dipper/docs/PERSONAS/tester.md`, symlinked to `~/.claude/agents/tester.md`. Cross-project entry point.
- **`feedback_one-feature-at-a-time.md`** — three-Max-gate loop. Test-coverage planning happens during PM scoping (before Max GATE 1).
- **`feedback_pass-fail-vs-diagnostic.md`** — composes with layer-classification: each layer has its own PASS/FAIL + regression findings.
- **`feedback_input-record-replay-integration.md`** — names the canonical integration mechanism for runtime-behavior projects.
- **`feedback_test-actual-user-flow.md`** — UAT mechanism for projects with UI: real keypress / real click via chrome-devtools.

### Outputs (what depends on this)

- **All future PM briefs.** Brief template change applies prospectively to every workstream from now on.
- **All future Tester verdicts.** Verdict shape change is a public-API change; subagent calls in any project return the new shape.
- **Per-project conventions docs.** Each project gains a TESTING_CONVENTIONS.md eventually; this workstream seeds well-dipper + max-gtd.
- **Tester audit log structure.** New verdicts under `~/.claude/state/dev-collab/tester-audits/<slug>.md` use the per-layer shape.
- **The retroactive scene-inspection-layer brief annotation** validates the new framework on real material; serves as worked example for future PMs to reference.

### Features that must stay working (regression-prevention checklist)

- PM step-into-role interview structure (4 extractions) — unchanged.
- PM brief sections (Why we care / Current objective + success criteria / Architectural connections / In scope / Out of scope / Drift risks / Handoff) — unchanged. Test Coverage Plan inserted between "Architectural connections" and "In scope."
- Tester two-output verdict shape (Summary for Max + structured verdict) — unchanged. Per-layer classification adds to the structured verdict; Summary for Max stays plain-English.
- dev-collab-gate hook — untouched. Edit-count threshold + Tester PASS unblock semantics preserved.
- Three-Max-gate loop — untouched. Test-coverage planning happens BEFORE Max GATE 1, not as a new gate.
- Existing memos referenced as composers (`feedback_pass-fail-vs-diagnostic.md`, `feedback_input-record-replay-integration.md`, `feedback_test-actual-user-flow.md`) — unchanged.
- All existing skills + slash commands — untouched.

## Test Coverage Plan (this workstream's own — eating own dogfood)

Demonstrates the new section's shape on this workstream itself.

| AC | Unit coverage | Integration coverage | UAT coverage |
|---|---|---|---|
| 1 PM brief template extension | grep for the new section header in `pm.md`; bash test in conventions doc | New brief written using updated template parses + reads coherently | Max reviews the next PM brief written under the new shape and confirms it reads naturally |
| 2 Tester verdict shape | grep for per-layer block in `tester.md` | A Tester invocation in a future workstream returns a verdict with per-layer classification | Max reads next Tester verdict; the per-layer shape is legible without him having to ask |
| 3 System-wide template | File exists at canonical path; minimal valid markdown | A second project (max-gtd) successfully copies + customizes | N/A — doc-only artifact, no felt-experience |
| 4 Well-dipper instance | File exists; names existing infrastructure citations | The retroactive scene-inspection-layer annotation (AC 6) demonstrates the conventions in use | Max confirms in his next session that the conventions match how he thinks about the project |
| 5 Conditional UAT rule | grep for the rule text in `pm.md` + system template | A future motion-test-kit workstream has UAT marked N/A in its brief; a future well-dipper workstream has UAT marked relevant | N/A — process rule |
| 6 Retroactive annotation | grep for new section in `welldipper-scene-inspection-layer-2026-05-06.md` | The annotation parses cleanly + classifies T1-T4 evidence | Max reads the annotation; the layer-mapping makes sense to him |
| 7 Cross-project applicability | max-gtd file exists | max-gtd's next workstream uses the conventions | Eventually-live; not blocking |
| 8 No regressions | Diff against pre-workstream state shows additions-only | Existing in-flight workstream artifacts (briefs, verdicts) still parse | Max confirms his next workstream interview feels the same as before |

UAT layer applicable here because Max's eyes are the load-bearing instrument for "does this framework feel right to use." Not all ACs need all layers; "N/A" is a valid entry.

## In scope

- PM persona doc update at `~/projects/well-dipper/docs/PERSONAS/pm.md`.
- Tester persona doc update at `~/projects/well-dipper/docs/PERSONAS/tester.md`.
- System-wide template at `~/.claude/agents/templates/TESTING_CONVENTIONS.md`.
- Well-dipper instance at `~/projects/well-dipper/docs/TESTING_CONVENTIONS.md`.
- Retroactive Test Coverage Plan section appended to `~/projects/well-dipper/docs/WORKSTREAMS/welldipper-scene-inspection-layer-2026-05-06.md`.
- max-gtd stub TESTING_CONVENTIONS.md (filled in if quick; otherwise marked TBD with placeholder).
- New feedback memo at `~/.claude/projects/-home-ax/memory/feedback_three-layer-test-coverage.md`.
- MEMORY.md index entry for the new memo.

## Out of scope

- Editing the dev-collab-gate hook. Layer classification is a shape concern, not a gate concern; hook stays edit-count-based.
- Editing the three-Max-gate loop. Loop unchanged.
- Wiring CI for unit / integration tests. That's the testing-framework-upgrade roadmap (Phases 0-5 in `well-dipper-progress.md`); this workstream produces the vocabulary, the next workstream uses the vocabulary to plan the CI work.
- Updating every shipped brief retroactively. Only `welldipper-scene-inspection-layer-2026-05-06` because it's the live one with pending Max UAT.
- The actual Phase 0 record-replay integration work. That's a separate workstream that uses the new vocabulary.

## Drift risks

### Risk 1 — PM briefs become bloated with test-coverage tables nobody reads

PM brief grows with every section we add. Test Coverage Plan adds rows per AC. For small workstreams, this becomes overhead.

**Why it happens:** every framework-upgrade tries to legislate the maximum case.

**Guard:** PM persona doc names the rule that for trivial-scope workstreams (1-2 ACs), Test Coverage Plan can collapse to a 1-paragraph summary. The table form is for non-trivial workstreams. PM judges per-brief.

### Risk 2 — UAT layer becomes a checkbox even when truly N/A

Engineering-only library work (kit-style) doesn't have UAT. Forcing every brief to fill in a UAT row makes it look like UAT was done when it wasn't.

**Why it happens:** rules-as-templates-without-judgment.

**Guard:** PM asks per-project whether UAT is relevant. If N/A, the brief says so explicitly with rationale (e.g., "UAT N/A — engineering-only library; integration tests are the deepest layer applicable"). Tester verdict mirrors: `Unit: PASS / Integration: PASS / UAT: N/A (per brief)`.

### Risk 3 — Per-layer Tester verdict shape breaks existing tooling

Tester verdicts go into `~/.claude/state/dev-collab/tester-audits/<slug>.md`. Anything parsing that file expects the existing shape.

**Why it happens:** changing public APIs.

**Guard:** the per-layer block ADDS to the verdict; existing fields (Summary for Max, Verdict line, Required artifacts, etc.) stay. Audit-log readers tolerate the addition. Verify by visually inspecting one new verdict file post-shipment.

### Risk 4 — Cross-project portability claim isn't true until a second project actually uses it

Writing a system-wide template doesn't mean other projects will adopt it. Theoretical portability vs actual.

**Why it happens:** shipping the template ≠ shipping its adoption.

**Guard:** AC 7 specifically requires max-gtd to have a (possibly stub) TESTING_CONVENTIONS.md. Stub is fine; presence proves the template was at least flowed through one extra project. The full max-gtd adoption is the next workstream's concern.

## Handoff

**Working-Claude executes this workstream directly** (no separate sub-phase like the scene-inspection-layer). Doc-only changes; no code; no live verification needed except grep-style assertions. ~1-2 hours.

After implementation, **Tester verifies per the Test Coverage Plan above** — most assertions are file-presence + grep-style + diff-style. UAT items defer to Max in next session(s) as he uses the new shape.

After Tester PASS, the workstream flips to Shipped. The framework's first real test will be the next workstream Max scopes — that brief uses the new shape, that Tester verdict uses the new shape, and Max can adjust the templates if anything feels wrong in practice.
