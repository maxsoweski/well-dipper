---
status: ACTIVE — promoted 2026-04-18 from _drafts/warp.md by PM to unblock workstream brief
captured: 2026-04-18
captured_by: Director (channeled via working-Claude), interview with Max
promoted_by: PM, 2026-04-18 (Director out of session; draft self-marked "pending merge" — PM bootstrap per persona rules)
related_plan: docs/PLAN_warp-tunnel-v2.md
related_bible: docs/GAME_BIBLE.md §"The Warp as Sacred Experience"
pending_bible_diff: docs/FEATURES/_drafts/GAME_BIBLE_diff_warp.md (not yet merged into GAME_BIBLE.md — Director action)
---

# Warp

## One-sentence feature

The player seamlessly travels from their current star system to a selected destination star system via an exotic, continuous, no-cut passage through a tunnel of stars — a tube connecting two points in space, invisible except through its openings.

## Source

- `docs/GAME_BIBLE.md` §"The Warp as Sacred Experience" — establishes warp as sacred/progression experience, fold-generator lore.
- `docs/PLAN_warp-tunnel-v2.md` — active implementation plan (hybrid 3D stencil portal + screen-space composite, lab-first sequence).
- Director interview with Max, 2026-04-18 — vision articulation that supersedes any ambiguity in the above.

## Lore / mechanism

The ship is an "exotic mechanism that can control gravity." The warp is achieved by the ship's fold generator dilating space directly in front of it, creating a gravitational lens roughly 500m ahead.

The fold opens onto a **tunnel** — in a higher-dimensional sense, shaped like an esophagus. Once the ship enters the tunnel, the tunnel **pulls** the ship forward. Motion through the tunnel is a property of the tunnel itself, not the ship's thrusters. The tunnel pulls the ship faster than light — FTL by virtue of the tunnel, not by thrust.

**Core mental model:** the warp is a **tube** connecting two points in space. The tube is **invisible except through its openings** (the portals at each end).

**Key geometric property — non-Euclidean:** the portal is a **2D hole into a 3D tunnel**. The tunnel exists only through its opening. Side-views do not exist. You cannot observe the tunnel from outside; if you were to move laterally during FOLD/ENTER you would lose the view down the tunnel. This is a hard constraint — any rendering that would allow the tunnel to be seen from an angle violates the spec.

**Relativistic consequence:** inside the tunnel, the player is traveling so fast that stars visibly **blue-shift ahead** and **red-shift behind**.

**Bible alignment:** this is consistent with the bible's "Personal warp capability — you carry your own fold generator" and "fold animation" terminology. The progression described in the bible (early: tunnel + ship shake; mid: anomalies; late: impossible spaces) continues to govern future content; this feature doc captures the **early game / V1 baseline**.

## Phase sequence

### Pre-warp: Alignment + initiation

1. **Alignment** — player selects a target star; the ship (or at least the view) aligns with that star.
2. **Initiation** — player presses a button to begin the sequence.

### Warp phases (per `PLAN_warp-tunnel-v2.md` naming)

3. **FOLD** — space ~500m ahead begins to unfold. A gravitational lens dilates open. Inside the opening: a tunnel made of stars. Portal should visually read as *space-time bending around it*, not a magical doorway. Tunnel visible through the opening.

4. **ENTER** — approach and threshold crossing:
   - Landing lights appear on the HUD, indicating approach and giving the player a sense of distance being traversed. (Lights are on the HUD, not on the ship mesh.)
   - Ship accelerates toward the portal.
   - Camera can shake briefly during acceleration — thrusters amping up to keep the ship on line. Shake is a directed effect, not an artifact. Smooths out once in the fold.
   - At the threshold crossing: the camera stays visually continuous. **No punch-through-water effect.** The tunnel "opens up as though space itself is dilating open in front of you."
   - **Both-visible crossing moment:** when half-in, peripheral vision sees origin space *around* the hole AND down the tunnel *through* the hole. Only when fully in does origin space drop away.

5. **HYPER** — inside the tunnel:
   - Player is carried forward by the tunnel (esophagus pull).
   - Tunnel geometry: long cylinder, "as far as the eye can see" (not globe, not sphere).
   - Tunnel interior is made of stars — a starfield shaped into a cylinder rather than the inside of a sphere.
   - Relativistic blue-shift on stars ahead, red-shift on stars behind.
   - The destination system becomes visible far in the distance — the tunnel opens into non-exotic space at the far end, including the destination star. (**Does not need to be visible for the entire traversal** — can appear partway through if easier to engineer.)

6. **EXIT** — crowning out:
   - Player gets closer and closer to the tunnel's end.
   - "Crowning" transition: giant-flying-headfirst analogy. There is a moment where the ship's front has emerged into destination space but the rear is still in the tunnel.
   - Quick transition; camera continuous.
   - Player flies through into the new system.

## Success criteria

### Primary criterion — "seamless"

**Seamless = motion continuity** across visual, audio, temporal, and spatial axes. The feature has failed if ANY of the following occurs at ANY phase or phase boundary:

- Black frames at phase transitions
- Frozen moments — movement into, through, or out of the portal stops
- Audio freeze, or lack of smooth transition between audio phases
- Framerate change
- FOV change
- Sudden jarring speed change
- Sudden jarring camera position change

This is the acceptance rubric for the entire feature.

### Phase-level criteria (V1)

- **FOLD:** portal visually reads as gravitational lensing / space-time bending. Tunnel is visible through the 2D opening. Portal stays locked in world-space ~500m ahead of the ship (not screen-locked).
- **ENTER:** both-visible partial-in moment occurs cleanly. Camera continuous through threshold. No sudden position change.
- **HYPER:** tunnel geometry is cylindrical and extends into distance. Starfield tunnel (not sphere interior). Destination visible at the far end at some point during HYPER.
- **EXIT:** crowning transition, camera continuous, end state is flying in the destination system.

## Failure criteria / broken states

What "not working" looks like specifically (from today's interview + prior state):

- **Loading-induced hitches.** The most likely cause of seamless-break today. Stated root-cause hypothesis: asset loading happens during a phase where the player is supposed to be in continuous motion. Fix: destination system assets must be **ready before** any phase where a freeze would occur, not streamed during. This is a **load-timing** problem, not a shader / frame-budget problem.
- **Stuff popping in/out** — also loading-related.
- **Tunnel visible from the side** — violates the non-Euclidean spec; the tunnel should not be observable as an object in 3D space.
- **Thrust-driven motion in HYPER** — wrong mental model; tunnel pulls, not thrusters push.
- **Cut between phases** — any hard cut or fade between FOLD/ENTER/HYPER/EXIT violates continuity.

## V1 / V-later triage

### V1 — must ship

- Portal fold opening (gravitational-lens visual)
- Threshold crossing with both-visible partial-in moment
- Tunnel traversal (esophagus pull motion)
- Cylindrical star tunnel extending into distance
- Destination star visible at end of tunnel (timing flexible during HYPER)
- Exit crowning
- Motion continuity / seamlessness across all phase transitions (the primary criterion)

### V-later — polish, **must graft on without architectural rewrite**

- HUD landing lights (affordance during ENTER)
- Camera shake during acceleration
- Relativistic blue/red shift on stars inside tunnel
- Free look during warp (player can look back during HYPER/EXIT to see the tunnel or origin system receding)

### V1 architectural affordances for V-later items

Each V-later item requires a specific extension hook **built into V1** even if not exercised:

- **HUD landing lights** → HUD overlay layer that respects and reacts to warp state; V1 HUD state machine must have warp-phase states wired even if only one overlay is drawn.
- **Camera shake** → camera controller that accepts additive shake input; V1 camera must be the "camera + additive offsets" pattern, not a single hand-animated camera path.
- **Blue/red shift** → tunnel shader has a color-transform injection point (e.g., a uniform-driven color ramp or a post-process hook specifically for the tunnel interior); V1 tunnel shader is written to accept a future transform without restructuring.
- **Free look** → warp-state camera controller optionally accepts look input; V1 camera decouples "look direction" from "travel direction" as two separable inputs, with look input clamped to fixed forward for V1.

The Director will flag any V1 design decision that forecloses a V-later path.

## Critical architectural realizations

1. **The 2D-hole-into-3D-tunnel spec justifies the stencil/portal-render approach** in `PLAN_warp-tunnel-v2.md` and rules out alternatives. Any tunnel rendering that can be observed from outside the portal opening violates the spec. Stencil, render-to-texture, or fullscreen screen-space composition (during HYPER when the portal occupies the full view) are the compatible approaches.

2. **The ENTER freeze is a load-timing problem, not a shader problem.** Fix is structural: the destination system's assets must be loaded before ENTER begins, not streamed during HYPER or EXIT. This reorders the engineering — prefetching / async preload becomes a V1 requirement, not a V-later optimization.

## Current state snapshot (2026-04-18)

- **FOLD** — portal appearance works okay today.
- **ENTER** — **weakest link.** 1–2 second freeze at the initial slowdown. This is the primary bug blocking V1.
- **HYPER** — compositor-owned rendering restored post-`0cb717c` (which reverted `81dda69`). The authored HYPER experience lives in `src/rendering/RetroRenderer.js` `hyperspace()` at L420–492: ray-cone depth producing the "long tunnel extending into distance" feel, scrolling procedural starfield on the tunnel walls seeded from `uHyperOriginSeed` / `uHyperDestSeed` with `uHyperBridgeMix` sweeping origin→destination, and the destination-star vanishing-point glow at L486–489 that crowns at the far end. The prior "second half broken" orphan-bug era ended at `10642b2`; post-un-do HYPER is what `10642b2` + `a1ff634` gave us, minus the `81dda69` regression that had made the 3D mesh occlude the compositor's authored experience. Remaining HYPER questions (tuning of brightness, streak density, destination-star timing, relativistic blue/red shift) are open — not bugs, not regressions. Final closure pending Max's recorded-warp verification on the un-do workstream (currently VERIFIED_PENDING_MAX per `0cb717c`).
- **EXIT** — believed to work per §"Phase sequence EXIT" (crowning-out + fizz reveal). The compositor's EXIT mechanism — `uTunnelRecession` driving tunnel radius outward + `uExitReveal` driving the dithered-edge fizz hole — lives in `RetroRenderer.js` at L683–713 and was present before `81dda69`, untouched by the un-do. The prior close-out of the dimness workstream claimed EXIT-forensics-confirmed, but that claim rested on the same static-screenshot evidence that closed dimness wrong — treat as unverified. Final closure pending the same Max-recorded warp on the un-do workstream.

## Open questions

- **Loading architecture forensics:** where exactly does destination-system asset loading happen today? Confirming this is a prerequisite for fixing the ENTER freeze. Deferred to working-Claude / warp-session.
- **EXIT state forensics:** is the working EXIT implementation currently in the code, or was it reverted? Deferred to working-Claude / warp-session.
- **Destination-star-visible timing:** at what fraction through HYPER should the destination star first become visible? Max said "doesn't have to be visible the entire traversal" — so it can appear partway. Exact timing is a tuning decision, probably during visual-lab iteration.
- **Audio transition shape:** the bible specifies `warp-charge`, `hyperspace`, `arrival` tracks with crossfades. Does the camera-shake period correspond to `warp-charge` or does it cross into `hyperspace`? Probably answered by sound designer / Max during music integration.

## Workstreams

Child workstream briefs (PM-owned) that carry this feature forward:

- **`docs/WORKSTREAMS/warp-hyper-orphan-fix-and-tunnel-brightness-2026-04-18.md`** — **Shipped 2026-04-18** (commits `10642b2` + `a1ff634`). Landed the HYPER-phase Portal A orphan fix (on-disk `async onTraversal` + `await onSwapSystem` in `main.js`) and polished tunnel wall brightness (wire `uScroll` per HYPER frame, wire `uHashSeed`/`uDestHashSeed` from origin + destination system seeds). Primary attack on the "HYPER second half is broken" failure in the Current-state snapshot above. Did NOT re-attempt Freeze 2 or the ENTER freeze. Spawned dimness-carryover workstream below.
- **`docs/WORKSTREAMS/warp-hyper-dimness-2026-04-18.md`** — **Active 2026-04-18.** Find the remaining lab↔production delta for HYPER tunnel brightness (`starfield-cylinder-lab.html` renders bright; production HYPER renders as ~six sparse streaks on near-black). Shader-fork vs. pipeline-fork decision gated by a matched-inputs comparison before any `WarpPortal.js` edit. Includes an opportunistic read-only EXIT forensics pass (is the working EXIT implementation still in-tree?). Explicitly does NOT attempt ENTER freeze, Freeze 2, streak/blue-shift polish, or EXIT bugfixes.
