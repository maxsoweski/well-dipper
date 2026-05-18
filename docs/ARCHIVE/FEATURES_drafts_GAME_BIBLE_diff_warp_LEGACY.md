---
status: DRAFT — proposal for GAME_BIBLE.md updates based on 2026-04-18 warp interview
target: docs/GAME_BIBLE.md
section_affected: "The Warp as Sacred Experience" + adjacent warp references
author: Director (channeled via working-Claude)
---

# GAME_BIBLE diff list — warp articulations from 2026-04-18 interview

## Scope

The bible already establishes the warp's narrative role (§"The Warp as Sacred Experience") and early/mid/late progression. Today's interview did not contradict that progression — today was about **early game / V1 baseline** articulation. These changes are **additive**, not rewrites.

## Additions proposed

### 1. Lore — portal geometry (non-Euclidean)

**Insert into or adjacent to §"The Warp as Sacred Experience":**

> **Portal geometry.** The warp portal is a two-dimensional hole opening into a three-dimensional tunnel. The tunnel exists only through its opening; it has no "side" that can be viewed from outside. Lateral movement during FOLD or ENTER does not reveal the tunnel from an angle — it simply removes the line of sight. This is not a visual effect but a property of the exotic space the fold generator produces.

**Rationale:** Establishes the hard geometric constraint that rules out scene-object tunnel rendering. Load-bearing for every future visual decision.

### 2. Lore — tunnel motion (esophagus model)

**Insert near the progression paragraph or in a new "Warp Mechanism" sub-section:**

> **How the tunnel moves you.** Once inside the tunnel, forward motion is a property of the tunnel, not of the ship's thrusters. The tunnel, in a higher-dimensional sense, is shaped like an esophagus — it pulls whatever enters it toward the far opening. The ship's fold generator opens the tunnel; the tunnel itself does the traveling. Faster-than-light passage is a consequence of entering the tunnel, not of any thrust applied.

**Rationale:** Fixes a mental model currently ambiguous in lore. Working-Claude has in the past treated tunnel motion as thrust-driven; this explicitly reframes it.

### 3. Lore — tunnel shape

**Insert adjacent to (2):**

> **What you see inside.** The tunnel is shaped as a long cylinder extending as far as the eye can see — not the interior of a sphere. Its interior is made of stars; the effect is a starfield shaped into a cylindrical passage rather than the sphere of open space. The exotic geometry is the reason the starfield takes this shape instead of the normal all-around celestial sphere.

**Rationale:** Pins down the tunnel's geometric presentation. Prevents future implementations from drifting toward "inside of a sphere" renderings.

### 4. Lore — relativistic visual

**Insert adjacent to (3):**

> **Relativistic shift.** Inside the tunnel, the player's apparent velocity is high enough that stars visibly blue-shift ahead of the ship and red-shift behind.

**Rationale:** Establishes the color shift as canonical lore, not optional polish. Even if implementation is V-later, the lore is V1.

### 5. Tagline / core mental model

**Insert at the top of §"The Warp as Sacred Experience", or at the top of a new "Warp Mechanism" sub-section:**

> **Core mental model: a tube connecting two points in space, invisible except through its openings.** Everything else about the warp is elaboration on this fact.

**Rationale:** Gives the bible and any doc downstream of it (feature docs, plan docs, implementation comments) a single three-clause mental model to anchor against. Prevents drift.

### 6. Phase naming (minor — internal consistency)

The bible currently refers generically to "fold animation," "hyperspace," "arrival." `PLAN_warp-tunnel-v2.md` uses the formal phase names **FOLD**, **ENTER**, **HYPER**, **EXIT**. When a `docs/FEATURES/warp.md` is promoted from the current draft, its phase names will use the formal set.

**Proposal:** in the bible's warp references, optionally align to `FOLD / ENTER / HYPER / EXIT` for consistency, OR leave the bible's narrative phrasing ("fold animation", "hyperspace") as narrative-facing and let the technical phase names live only in FEATURES/ + PLAN_*. Max's call.

## Refinements — no contradictions found

### Fold generator lore (§8H reference on line 32)

Consistent with today's articulation. The "exotic mechanism that can control gravity" framing from the interview matches the bible's "personal fold generator." No changes needed.

### The Sacred Experience progression

Today's articulation was V1 baseline ("light tunnel, ship shaking" in the bible's phrasing). Mid-game anomalies and late-game impossible spaces are downstream of V1 and do not need updates as part of this diff.

### Star selection mechanic (§around line 1040)

"Click-and-hold magnifier" matches today's "player selects a target star." No changes.

### Music / SFX (§musical vision, SFX table)

`warp-charge` / `hyperspace` / `arrival` track structure is consistent with today's phases. One open question: does the camera-shake period correspond to `warp-charge` or cross into `hyperspace`? This is a sound design decision, noted as an open question in `warp.md` draft. No bible change needed yet.

## Summary

Six proposed insertions, all additive. Zero rewrites of existing lore. Zero contradictions. The bible's warp content is consistent with today's interview — today's interview *added resolution* to areas the bible had previously left general.

Applied-or-not decision is Max's; the Director proposes, the author approves.
