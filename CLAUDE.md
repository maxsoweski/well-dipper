# Well Dipper — project-local Claude instructions

This file is auto-loaded by Claude Code when working in `~/projects/well-dipper/`. It supplements the global `~/.claude/CLAUDE.md` with WD-specific rules.

## Three-file orienting structure (READ THESE)

Project-altitude state lives in three files with different decay rates:

| File | Purpose | Decay rate |
|---|---|---|
| `docs/HEART_OF_DESIRE.md` | Why we're building Well Dipper. Two layers: agentic-dev practice meta-purpose + screensaver→game product arc. | Rare |
| `docs/JOURNEY.md` | The path. Anchored to Game Bible §1A SCREENSAVER → ENRICHED → GAME taxonomy. Milestones, current objective, KRs. | ~Weekly |
| `docs/NOW.md` | One screen. Active workstream, next 1-3 queued, recently shipped. | Every session |

**Session start protocol for this project:**
1. Re-read `docs/HEART_OF_DESIRE.md` (5 seconds — just re-anchor to what we're for)
2. Skim `docs/JOURNEY.md` current-objective section (KR status)
3. Read `docs/NOW.md` Active workstream + Next 1-3
4. Verify `~/.claude/state/dev-collab/active-workstream.json` well-dipper key matches `NOW.md` Active workstream — if not, update one or the other before proceeding

**Session end protocol:** Update `docs/NOW.md` to reflect what landed this session, what moved in/out of queue, what's now active.

## Contextualize each feature in the larger structure

**Rule (per Max 2026-05-18):** As we work, contextualize each feature being developed/tested/shipped in terms of the larger structure — the Heart of Desire, the Journey milestone it serves, and the Bible layer it belongs to.

**What this means in practice:**

- **When PM-scoping a new workstream brief:** the brief's "Why" section names the Journey milestone (35% SCREENSAVER MVP / 60% ENRICHED / 85% GAME) and the Bible layer tag ([SCREENSAVER] / [ENRICHED] / [GAME] / [BOTH]). If the feature doesn't fit any current milestone, that's a signal — either the milestone needs revision or the feature is premature.

- **When starting a coding session on an existing workstream:** state in a sentence which milestone this work serves and why it's the right next thing. Example: *"Continuing warp-landing-strip-persists — closes the last visible warp-arrival defect en route to 35% SCREENSAVER MVP shipped."*

- **When shipping a workstream:** the commit message and Status update mention the milestone connection. Update `docs/JOURNEY.md` if the shipment moves the milestone percentage materially, and `docs/NOW.md` always.

- **When proposing a refactor or new infrastructure:** name which Bible layer / Journey milestone it enables. If it's pure infrastructure with no specific feature consumer, say so AND tie it to the agentic-dev meta-purpose (Heart of Desire layer 1) — infrastructure that compounds Claude's effectiveness on this codebase counts.

- **When Max asks "what should we work on next":** orient the answer in milestone terms first, then specific feature options. Don't list features without their milestone context.

- **When Max asks "where are we":** answer in JOURNEY altitude (current milestone + KR status), not NOW altitude (in-flight workstream details), unless he specifically asks "what's in flight."

**Don't over-do it.** The rule is "every feature gets contextualized," not "every paragraph cites the Heart of Desire." A single sentence per workstream entry, brief commit, or session-start orientation is enough. The goal is reflexive orientation, not bureaucratic ritual.

## Game Bible anchoring

`docs/GAME_BIBLE.md` is the authoritative scope document. Every feature is tagged `[SCREENSAVER]` / `[ENRICHED]` / `[GAME]` / `[BOTH]` per §1A. When PM-scoping or evaluating a workstream's fit:

- Reference the Bible section number (e.g., "this feature implements §6A Civilized overlay")
- Check the Bible's layer tag — if it's [GAME] and we're targeting 35% milestone, that's a signal the feature may be premature
- If the feature isn't in the Bible at all, propose adding it (§14 Open Questions is the right home for "should this exist?")

## Inspection-layer-v2 is the testing roadmap

`docs/PLAN_inspection-layer-v2.md` (Phase A → G) is the de facto current testing-infrastructure roadmap. New defect-class features generally fit into one of those phases. If a new defect-class doesn't fit any phase, the plan needs updating; check before scoping a one-off workstream.

## Sibling project: well-dipper-visual

`~/projects/well-dipper-visual/` is a separate working tree on a different branch (per `memory/projects-inventory.md`). Flagged in the inventory as *"first E2E example of the Dev Collab OS."* Be aware it exists; don't accidentally cross-contaminate workstream branches.

---

**Created 2026-05-18** as part of the file-structure-for-orientation work. Update freely as the WD-specific patterns evolve.
