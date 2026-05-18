# Heart of Desire — Well Dipper

**This file changes rarely. It defines what we're for.**

## The meta-purpose (what Well Dipper is FOR)

**Improve Max's abilities to work with Claude Code to do agentic development — with video games in particular.**

Well Dipper is the vehicle, not the destination. The product matters; the practice of building it with Claude matters more. Every choice we make about workflow, test infrastructure, persona structure, brief-and-Tester loops, inspection layers, telemetry — all of it serves this meta-purpose. The reason we build a defect-detection probe instead of fixing the visible bug by hand is so that the next defect detects itself. The reason we PM-scope before coding is so that the practice of PM-then-build becomes a learned reflex rather than a friction-laden ritual.

A successful session is one where the codebase moves forward AND Max's confidence in driving Claude on a game-development task increases. A successful year is one where Max can ship a substantial game-development feature end-to-end with Claude as the primary executor without it feeling like wrestling.

## The product arc (what gets shipped)

**MVP is two coupled deliverables:**

1. **Functionally complete retro space screensaver** meeting Max's requirements. Title screen → first warp → autopilot tour → auto-warp → continued drift, indefinitely. Visual polish at the level Max would be proud to share. No visible defects during a 10-minute observation.

2. **A codebase shaped for ongoing development beyond MVP** — toward the fully-fledged video game described in `docs/GAME_BIBLE.md`. The Bible's SCREENSAVER → ENRICHED → GAME three-layer taxonomy is the post-MVP path. The MVP architecture must not box us out of any of it.

The screensaver is not the end. It's the foundation that makes Layer 2 (ENRICHED) and Layer 3 (GAME) reachable. The Bible §1A puts it explicitly: *"The screensaver is the MVP. The game systems grow out of it."*

## Why this matters in the bigger picture

Well Dipper sits inside Max's broader life arc — the Sovereignty project (exit from SouthState, build Easymaking) names Claude-Code-driven creative work as a primary income vehicle. Game development is the highest-leverage demonstration of that capability. If we can build a credible space game with Claude as primary executor, we've shown the capability has commercial weight, not just hobbyist appeal.

## Holding both desires in tension

When a session-level decision tugs in two directions:
- **Toward shipping the screensaver quickly** vs. **investing in test infrastructure that pays off in Layer 2/3** — favor the infrastructure when the game-dev capability gain is real. Favor shipping when the infrastructure investment is speculative.
- **Toward fixing the visible bug** vs. **building a probe that catches the bug AND its siblings** — favor the probe when the bug is in a class likely to recur (motion artifacts, frame-timing, render-order, scale precision). Favor the direct fix when it's a one-off.
- **Toward letting Claude run autonomously** vs. **stopping to verify in real Chrome** — favor verification when the surface is felt-experience-class (anything Max would notice in a 10-second look). Favor autonomy when the surface is structural (telemetry, math, contracts).

When tension can't be resolved by session-level judgment, surface it to Max explicitly. Do not silently optimize for one desire while neglecting the other.

---

**Source:** Authored 2026-05-18 by working-Claude based on Max's verbal correction during the contextualization session. Quotes from Max's verbatim message:

> "The heart's desire I have here is to improve my abilities to work with Claude Code to do agentic development with video games in particular. The MVP to ship this thing is that it works functionally as a retro space screensaver and meets all of my requirements. The MVP also includes that it's been developed in such a way that enables ongoing development beyond that MVP to eventually ship this as a fully fledged video game that is more than just a fun space tour."

Max should edit this file into his own voice. The agentic-dev framing was not previously in source per the 2026-05-18 survey — `grep -i agentic` returned zero hits across docs + memory before this file was created.
