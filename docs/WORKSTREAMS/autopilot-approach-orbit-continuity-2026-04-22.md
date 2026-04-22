# Workstream: Autopilot APPROACH → ORBIT velocity continuity (2026-04-22)

## Status

`Drafted — pending Director audit`. Created 2026-04-22 after Max flagged a "slight jump" / "little hitch" at the APPROACH → ORBIT phase transition while reviewing the round-10 shake recording. Director diagnosed the hitch as a nav-layer velocity discontinuity (NOT shake-originated — see Director audit `~/.claude/state/dev-collab/audits/autopilot-shake-redesign-2026-04-21.md` §"Round-10 post-review Q2"). Round-9's violent shake had masked it; round-10's subtle rotation-only shake surfaced it.

This workstream is SEPARATE from `autopilot-shake-redesign-2026-04-21.md` — the two were surfaced together but the fix lives in `NavigationSubsystem`, not `ShipChoreographer`. Shake-redesign can ship independently.

## Parent feature

`docs/FEATURES/autopilot.md` — arrival/orbit transition cinematography. Find the specific § when authoring; if none exists, flag for Director to stub.

## The problem

At the APPROACH → ORBIT phase transition in `NavigationSubsystem`, the ship's velocity is not C¹-continuous:

- **End of APPROACH close-in** (`_updateApproach` line 665–670): ship position moves radially inward along `_approachInitialDir` via `_ease(closeT)` over ~3 seconds. At `closeT = 1`, radial velocity asymptotes to near-zero (easing curve ends on a flat tangent).
- **Begin of ORBIT** (`_updateOrbit` line 586, frame 1): ship position derived from `(orbitYaw, orbitPitch, dist)` with `orbitYaw` advancing at `orbitYawSpeed × entryFactor` where `entryFactor` ramps from 0 → 1 over the 2s entry-blend. On frame 1, `entryFactor ≈ 0` (so position matches approach endpoint smoothly), BUT the **velocity derivative** is tangential-nonzero from the orbital math that frame, while the approach's last velocity was radial-near-zero.

Net: position is continuous, velocity direction flips instantly. Visible as a "hitch" in the camera.

## Proposed fixes (for Director's audit to pick between)

### Candidate A — Velocity-ease-in on orbit entry

Scale `orbitYawSpeed` and `orbitPitchPhase` advance rates by `entryFactor` for the first 2s of orbit, not just the position derivation. Over the entry-blend window, tangential velocity ramps from 0 → full to match the approach's near-zero radial velocity at handoff.

- **Pro:** Minimal edit — ~3 lines in `_updateOrbit` (multiply `orbitYaw += orbitYawSpeed * deltaTime * orbitDirection` by `entryFactor`).
- **Con:** During the 2s ramp, the orbit doesn't advance at full speed — changes the observable orbit-start position slightly (ship starts further along its pre-randomized starting yaw than it otherwise would). Likely imperceptible, but worth confirming.

### Candidate B — Settle sub-phase between APPROACH and ORBIT

Add a 0.5s "settle" micro-phase after APPROACH close-in completes, where position is held at the approach endpoint and `orbitYawSpeed * entryFactor` smoothly ramps from 0. Orbit phase begins after settle, at `entryFactor = 1`.

- **Pro:** Explicit architectural boundary; easier to reason about and test.
- **Con:** Adds a new phase enum value + state machine branch; more invasive than Candidate A.

### Candidate C — Extend the approach close-in ease to carry terminal tangential velocity

Modify `_updateApproach` line 670 so that the final frames of close-in deposit the ship at the approach endpoint with the exact tangential velocity ORBIT frame 1 expects. Requires approach to pre-compute the orbit's initial velocity and curve into it.

- **Pro:** Velocity-continuous at handoff by construction.
- **Con:** Largest edit; couples approach and orbit state. May create its own cinematography artifacts (approach looks less like "straight in," more like "curving into orbit").

**Director's lean (from audit):** Candidate A is the surgical pick. Candidate B is a reasonable alternative if A has artifacts.

## Acceptance criteria

1. **AC #1 — Position continuity.** `_position` value at the last frame of APPROACH ≤ 0.001 scene-unit distance from `_position` value at the first frame of ORBIT (already true; this AC is a regression guard).
2. **AC #2 — Velocity continuity.** `(_position at frame N) - (_position at frame N-1)` magnitude is continuous across the APPROACH → ORBIT transition — no single-frame step that differs by more than 2× the adjacent-frame steps.
3. **AC #3 — Visible smoothness at arrival.** In a recording capture from Max's eye: no perceived hitch at arrival into orbit.
4. **AC #4 — No regression in orbit behavior after entry-blend.** At `entryFactor = 1` (2s after orbit-begin), orbit yaw/pitch/distance evolution matches round-10 behavior within `orbitYawSpeed * 2s` tolerance on yaw advance (i.e., the ship arrives at essentially the same orbit state it would have under round-10, just took a smoothly-accelerating 2s to get there).
5. **AC #5 — No changes to APPROACH close-in behavior.** The approach cinematography is unchanged before the last frame.
6. **AC #6 — No changes to shake mechanism.** `ShipChoreographer` is not edited; shake behavior unchanged.

## Out of scope

- Any changes to orbit behavior AFTER entry-blend completes.
- Any changes to APPROACH close-in cinematography (start-to-late).
- Any changes to shake mechanism.
- Any changes to `FlythroughCamera` or `main.js`.

## Handoff to working-Claude

Not yet. This brief is `Drafted — pending Director audit`. When Director rules on A vs B (or other), this workstream goes through the normal PM → Director → working-Claude release cycle on its own schedule. Max greenlights when he's ready to pick this up.

## Revision history

- **2026-04-22 — Drafted** by working-Claude (degraded-mode PM-proxy after PM agent timeout) to capture the hitch issue surfaced during round-10 shake review. Director direction referenced from the shake-redesign audit file. Awaiting PM confirmation + Director audit.

*(Authored by working-Claude on 2026-04-22 after the PM agent's stream timed out mid-work on the round-11 shake amendment + this brief. Director direction from shake audit file is the canonical source. This draft should be reviewed by PM when next invoked.)*
