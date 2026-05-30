# docs/ — Well Dipper documentation map

This file is the entry point. Every doc has one job; this map says
which job each doc owns.

## Orientation (read at session start)

| Doc | Job | Decay | Audience |
|---|---|---|---|
| [HEART_OF_DESIRE.md](HEART_OF_DESIRE.md) | WHY this game exists | Rare | Director |
| [JOURNEY.md](JOURNEY.md) | PATH — milestones, KRs, structural debt | Weekly | Director + Team Lead |
| [NOW.md](NOW.md) | Active workstream + next 1-3 + recently shipped | Per-session | Team Lead |

## Game identity

| Doc | Job | Decay | Audience |
|---|---|---|---|
| [PILLARS.md](PILLARS.md) | WHAT this game IS — genre, pillars, aesthetic, key fictions | Rare | Director |
| [PLAYER_EXPERIENCE.md](PLAYER_EXPERIENCE.md) | Per-mode experience targets (SCREENSAVER / ENRICHED / GAME) | Medium | Director + UAT |
| [MOOD/](MOOD/) | Visual references (index in repo; images at Pictures folder) | Progressive | Director + Developer |

## Feature truth

| Doc | Job | Decay | Audience |
|---|---|---|---|
| FEATURES.md *(authored Phase 5)* | Max-authoritative flat inventory of every feature | Per-shipment | Team Lead |
| [FEATURES/](FEATURES/) | Per-feature deep dives (Player Beats, ACs, current state) | Medium | UAT + Developer |

## System truth

| Doc | Job | Decay | Audience |
|---|---|---|---|
| SYSTEMS.md *(authored Phase 6)* | Flat wiring map + auto-generated dep graph | Per-refactor | Developer |
| SYSTEMS/ *(progressive)* | Per-system deep dives (interface, wiring, history, generator catalog) | Per-refactor | Developer |

## Work in flight

| Doc | Job | Decay | Audience |
|---|---|---|---|
| [WORKSTREAMS/](WORKSTREAMS/) | PM-authored briefs with ACs + Tester verdicts + Scope: frontmatter | Per-workstream | PM + Tester + Team Lead |

## Process

| Doc | Job | Decay | Audience |
|---|---|---|---|
| [PERSONAS/](PERSONAS/) | PM / Tester / Game-Dev persona definitions (project-agnostic, symlinked cross-project) | Low | All |
| [PROTOCOLS/](PROTOCOLS/) | Detailed mechanics (max-recording, shipped-gate, three-max-gate, doc-updates-on-ship, development, glossary, test-harnesses, refactor-verification) | Low | All |

## Archaeology

| Doc | Job |
|---|---|
| [ARCHIVE/](ARCHIVE/) | Pre-v5 docs (Game Bible, FEATURE_AUDIT, PLAN_*, dated audits, design docs v2-v4). Consulted as reference; not authoritative. |
| [PARKING_LOT.md](PARKING_LOT.md) | Transitional — P1/P2/P3 deferred items migrate to per-system Open Questions when those systems get authored. Delete when migrations complete. |

## How docs are kept honest

- **Tester PASS-on-Shipped triggers doc updates** (`PROTOCOLS/doc-updates-on-ship.md`)
- **Pre-push hook runs `npm run doc-rot`** (project-wide rot detection; warns, doesn't block)
- **`npm run doc-graph` regenerates SYSTEMS.md graph** (run at PM planning time for system-changing workstreams)
- **`npm run uat-status`** rolls up FEATURES.md `verified-pending-max` + `shipped-code` rows for batch UAT sessions
- **`npm run mood-bootstrap`** refreshes MOOD index Unannotated section from Pictures folder
