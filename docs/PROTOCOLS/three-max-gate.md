# Three-Max-Gate protocol

Codifies the GATE 1 / 2 / 3 review pattern where Max reviews three
distinct artifacts across a workstream lifecycle. Cross-project
pattern from `~/.claude/CLAUDE.md` Dev Collab OS; this doc names
the well-dipper specifics.

## The three gates

### GATE 1 — Brief review (after PM scopes)

**Artifact:** `docs/WORKSTREAMS/<slug>.md` PM-authored brief +
`Scope:` frontmatter.

**Max's role:** Director + Team Lead. Read the brief; confirm:
- Scope aligns with current JOURNEY milestone
- ACs are measurable + match the felt-experience target in
  `PLAYER_EXPERIENCE.md`
- Blast radius (per Rule 7 dep-graph consultation) is acceptable
- Workstream fits into Team Lead's sequencing

**Verdict options:**
- **PROCEED** — working-Claude begins execution
- **REVISE** — PM re-invoked with feedback
- **PARK** — workstream Status: parked, link to reason

**Typical duration:** Brief read 2-5 min; check-in if needed.

### GATE 2 — Demo review (after coherent unit lands, before Tester)

**Artifact:** Working artifact — usually a chrome-devtools demo,
sometimes a contact-sheet, sometimes a code walkthrough.

**Max's role:** Sense-check. Is the work going in the right
direction? Are there visible defects that need addressing before
formal Tester verification?

**Verdict options:**
- **PROCEED to Tester** — working-Claude invokes Tester subagent
- **ITERATE** — fix specific issues Max named, demo again
- **REDIRECT** — direction is wrong; restart the unit

**Typical duration:** Demo + discussion 5-15 min depending on
complexity.

### GATE 3 — Final UAT (after Tester PASS, before Shipped flip)

**Artifact:** Per `shipped-gate.md` — video recording for visible/
phased features, screenshot for static UI changes, telemetry-equivalence
diff for refactors.

**Max's role:** UAT. With his own hands in real browser, confirm
shipped behavior matches PLAYER_EXPERIENCE.md spec + workstream ACs.

**Verdict options:**
- **PASS** — flip Status to Shipped <commit-sha>; push origin per
  `feedback_push-on-shipped.md`
- **FAIL** — return to working-Claude with specific failures; status
  stays at `VERIFIED_PENDING_MAX`

**Typical duration:** 5-15 min depending on feature scope.

## How this composes with Tester

Tester subagent is between GATE 2 and GATE 3. Tester:
- Reads PM brief + workstream code diff
- Runs integration tests (`__wd.run*Suite()` as applicable)
- Verifies via chrome-devtools / scripts / telemetry that ACs hold
- Verifies doc coverage via `npm run doc-rot --workstream <slug>`
- Renders verdict per `tester.md` shape (per-layer block)

Tester PASS → working-Claude flips Status to
`VERIFIED_PENDING_MAX <commit-sha>` → ping Max for GATE 3.

## Asymmetry

Not every workstream needs all three gates:
- Trivial edits (typo, log level, internal refactor): no gates;
  working-Claude proceeds directly
- Bug fix or single-file change with observable behavior: GATE 2 +
  GATE 3 (PM not invoked; working-Claude scopes inline)
- Multi-system feature: full GATE 1 + GATE 2 + GATE 3 with PM + Tester

Max decides when ambiguous.

## Cross-references

- `docs/PROTOCOLS/shipped-gate.md` — GATE 3 detail
- `docs/PROTOCOLS/max-recording.md` — recording artifact for GATE 3
- `docs/PROTOCOLS/doc-updates-on-ship.md` — doc-coverage criterion
  Tester checks before unlocking GATE 3
- `docs/PERSONAS/pm.md` — GATE 1 producer
- `docs/PERSONAS/tester.md` — between GATE 2 and GATE 3
