# Journey — Well Dipper

**This file changes at milestone boundaries (~weekly cadence). It maps where we are on the path from current state to heart-of-desire achievement.**

For the heart of desire itself, see `HEART_OF_DESIRE.md`. For what we're doing right now, see `NOW.md`.

## The path

The Game Bible (§1A — Three Development Layers) defines the lifecycle taxonomy. The journey moves through those layers:

```
[SCREENSAVER MVP] → [ENRICHED] → [GAME] → fully-fledged shipped game
       ↑              ↑            ↑              ↑
      35%            60%          85%           100% = heart's desire achieved
       │              │            │
       └─ where        └─ Layer 2   └─ Layer 3 (the Bible §9 Game Systems)
          we are        (Bible §6,
                         exploration
                         depth + reactivity)
```

Below: explicit milestones, what they look like felt-experience-wise, and what's in flight / queued / scoped under each.

## 35% — SCREENSAVER MVP shipped (CURRENT)

**What it looks like to hold this in your hand:** Open `wow.pjh.is/well-dipper/` in any modern browser. Title screen plays. First warp executes cleanly. Autopilot tour through the first system is visually polished — no ghosting reticles, no persisting landing strips, no mid-warp freezes, no tunnel-second-half blackouts. Auto-warp to next system. Loop indefinitely. Max can leave it running on a second monitor and feel pride, not catalog defects.

**Bible scope (§1A):** SCREENSAVER layer. Bible claims "functionally complete." `PLAN_inspection-layer-v2.md` documents 5+ visible defects observed at the 2026-05-07 UAT walkthrough that contradict the "complete" claim. **This milestone is NOT yet shipped** — the screensaver runs, but visible defects remain.

**Status:** ~95% done. Closing in.

**In flight / queued under this milestone:**
- [In flight, awaiting Max UAT] `warp-landing-strip-persists-2026-05-10` @ `e31ee65` — landing strip stops following the player post-warp. **Tester VERIFIED_PENDING_MAX**.
- [Queued] `warp-tunnel-second-half-not-rendering` — needs PM-scoping. Last warp regression. Likely a substantial Phase E rewrite of the tunnel visual pipeline.
- [Queued] `inspection-layer-v2 Phase B` — frame-timing primitives. Test infrastructure to catch frame stalls. PM-scoped at `docs/WORKSTREAMS/inspection-layer-v2-phase-b-frame-timing-primitives-2026-05-08.md`.
- [Queued] Gameplay music (per `MVP_SYSTEMS_REVIEW_2026-03-30.md` blocker list) — explore.mp3 / hyperspace.mp3 / deepsky.mp3. Status of Max's brother's tracks unknown. **Needs verification this session or next.**
- [Deferred] Sol-naming triage (inspection layer tags `body.star.sol` etc).
- [Deferred] CRT scanline filter (Bible §1 polish).

**Decision needed before declaring shipped:** What does "MVP done" mean — functional-with-known-defects (Bible's current claim) or zero-visible-defects (the inspection-layer-v2 defect-log standard)? Reconcile.

## 60% — ENRICHED layer landed

**What it looks like to hold this in your hand:** Same screensaver loop, but visiting a system shows DEPTH that the MVP didn't. Asteroid belts have textures and density variation. Rings have multiple bands with gaps. Some planets have visible megastructures or environmental hazards. Nebulae have interior detail when flown through. A handful of named known objects (Sol, Trappist-1, the Pleiades) render with bespoke detail. The "screensaver" still works untouched; depth is additive.

**Bible scope:** §1A Layer 2 ENRICHED. Includes §6 Overlay Systems (Civilized, Exotic, Megastructures, Environmental Hazards) wired into render path, §4 system-generation depth (rings, asteroid belt physics), §3 Galactic structure depth, §8H propulsion-landscape lore as in-game text. Per `FEATURE_AUDIT.md` (2026-04-20): much of this exists in generators but doesn't reach a shader yet — the audit catalogs "procedural data that exists but never reaches a shader." Layer 2 is largely about wiring existing dead code into the render path.

**Status:** ~5% done. Some pieces exist in the codebase but not wired (e.g., `RingRenderer.js` has 16-ringlet/8-gap support sitting unused).

**Scoped briefs:** None yet authored at Layer-2 scope. Several Layer-2-ish workstreams exist as one-off feature briefs in `docs/WORKSTREAMS/` (autopilot-camera-establishing, autopilot-star-orbit-distance, autopilot-toggle-ui-and-warp-select, ooi-capture-and-exposure-system, warp-phase-perf-pass — all dated 2026-04-20). These need re-evaluation in light of Layer-2 framing.

**Substantial deferred dependency:** `PLAN_world-origin-rebasing.md` blocks ship-scale features. Required before any Layer-3 work and probably some Layer-2 work involving close-approach to ships / megastructures. Estimated 2-4 focused days.

## 85% — GAME layer playable

**What it looks like to hold this in your hand:** Player has a ship (the small house-sized vessel from Bible §8A). Can take manual control during the autopilot tour. Can dock at stations, refuel, look at ships from up close. Can engage in a basic combat encounter. Can build a discovery log. Can warp to a destination the player chose, not just one autopilot picked. A 10-minute play session feels like a game, not a screensaver.

**Bible scope:** §1A Layer 3 GAME. Includes most of §7 (Nav Computer, Scanner, In-System Travel manual mode), §8 (Ships full lifecycle), §9 (Rotor fuel, ship upgrades, NPC comms, combat, factions, discovery log, galaxy map), §15 (Narrative Framework). The Ship Scanner workstream just shipped (2026-05-10) is the first Layer-3-flavored capability — selectable + burnable vehicles — landing here pre-MVP because the inspection-layer work made it cheap to scope.

**Status:** ~3% done. Ship Scanner is the first land. World-origin rebasing is the architectural prerequisite. Most of this is unscoped at workstream level.

**Bible's open questions that bear on Layer 3:** §14 Open Questions & Research Needed enumerates them. Several are blockers (e.g., what's the player ship's exact propulsion lore? — affects Layer-3 UI for fuel + travel).

## 100% — Heart of Desire achieved

Per `HEART_OF_DESIRE.md` — the meta-purpose is **Max's confidence + capability in agentic game development with Claude**. The product reaching Layer 3 is a proof-point, not the destination.

**Felt criterion:** Max can pitch this project (or a sibling) to a colleague / podcast / collaborator and convincingly describe both the WHAT (the game) and the HOW (the dev practice with Claude). The HOW story includes specific patterns — PM-scoped briefs, Tester gates, inspection-layer probes, three-decay-rate doc structure, telemetry-first defect diagnosis — that another developer could adopt.

## Current objective

**SCREENSAVER MVP shipped (35% milestone).** Key results:

- **KR1:** All visible-defect items in `PLAN_inspection-layer-v2.md` §"Visible defects observed" either fixed or explicitly deferred with documented rationale. **Status: 4 of 5 addressed (reticle ghosting ✓, landing-strip persistence ✓-pending-UAT, scene-inspection layer ✓, Sol-not-rendered deferred to Phase F triage). Remaining: warp tunnel second-half not rendering — needs Phase E PM-scoping.**
- **KR2:** Gameplay music tracks present (at least `explore.mp3`, `hyperspace.mp3`). **Status: UNKNOWN — needs verification this session.**
- **KR3:** A clean 10-minute observation in real Chrome with zero Max-flagged defects. **Status: not yet attempted in a single pass; piecemeal UAT only.**
- **KR4:** Bible §1A "SCREENSAVER" subsections re-audited and "functionally complete" claim reconciled (either confirmed or revised). **Status: not done.**
- **KR5:** This file structure (`HEART_OF_DESIRE.md`, `JOURNEY.md`, `NOW.md`) is in use and contextualized at the start of every working session. **Status: shipping in this session.**

**Kill if:** Max declares the screensaver scope satisfied (or revises it) AND a more capable scope replaces it. (Unlikely; this is the foundation for everything.)

**Next review:** After warp-landing-strip ships + music status confirmed.

---

**Source:** Authored 2026-05-18 by working-Claude alongside `HEART_OF_DESIRE.md` and `NOW.md`. Anchored to Game Bible §1A Three Development Layers taxonomy. Milestone percentages are estimates — adjust as the project's contour becomes visible.
