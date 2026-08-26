# Autopilot Camera Motion — Prior-Art Survey

**Date:** 2026-04-24
**Librarian:** Dana
**Scope:** 2 hr cap, 2 pp output. Prior art only; no Well Dipper internals, no recommendations.

---

## Executive summary

Across commercial space sims, cinematic third-person cameras, and middleware (Unity Cinemachine, Unreal's "SmoothDamp" patterns), the **prior-art convergence is strong and specific**: when a camera needs to track a moving subject smoothly, the dominant mechanism is a **critically-damped spring applied to the look-at target's *position*** (or to the camera's own position), **not an angular-rate clamp on the camera's orientation**. The orientation is then derived *from* the smoothed target — so jerk is absorbed upstream, before it ever becomes an angular-velocity problem. A secondary convergence: professional systems separate **aim** (orientation) from **body** (position) into two independently-damped stages, with composition rules (dead zone / soft zone) determining *when* the camera re-aims at all. The "angular rate limit on look-at" approach does not appear in the reputable literature as a primary mechanism; it appears as a *secondary* safety net on top of a damped target. Where per-axis clamps are discussed, they are flagged as prone to the exact failure modes you hit: degenerate geometry near colinear up/target vectors, per-axis decomposition artifacts, and parallax sensitivity.

---

## Mechanism shortlist (ordered by fit for a composed, inertial, Kubrickian tour camera)

1. **Critically-damped spring on target position** (`simple_spring_damper_exact`, `SmoothDamp`). Smooth a moving goal vector with a mass-spring-damper parameterized by a *half-life* (time to close half the gap). Frame-rate independent. The camera then does a plain `lookAt(smoothedTarget)` each frame. This is the single most common pattern in the tutorials, middleware docs, and developer blogs surveyed. Fit: high. Matches "slow, composed, inertial."
2. **Two-stage damping: damp the camera's position, then damp the aim separately** (Cinemachine's Body + Aim split; Composer + Framing Transposer). Position controller positions the camera; orientation controller re-aims with its own damping and a dead/soft zone that determines *whether* to re-aim at all. Small target wobble → no re-aim. Fit: high; most faithful to "heavy physical camera operator" feel Cinemachine explicitly models.
3. **Slerp of orientation toward a goal quaternion with a half-life / exponential decay**. Standard for rotational smoothing when the goal is an *orientation*, not a *point*. Constant-angular-velocity interpolation. Useful when the camera must blend between two intentional framings, less useful as the primary tracker (it damps angle but does nothing about the underlying point-tracking jerk from ship parallax).
4. **Low-pass / exponential moving average (one-pole filter)** on target position. The simplest possible smoother: `smoothed = lerp(smoothed, target, 1 - exp(-dt/tau))`. Frame-rate independent when written with the exp form. Identical feel to an over-damped spring. Fit: acceptable as a baseline; lacks velocity continuity, so if the target's velocity changes abruptly (e.g., ship decelerates), the camera "sticks" briefly.
5. **Look-ahead / velocity-aware smoothing**. Smooth `target + k * targetVelocity` instead of raw `target`. Cinemachine exposes this as "Look Ahead." Reduces lag on fast-moving subjects without reducing smoothness. Useful *in combination with* #1 or #2, not a replacement.

Angular-rate clamping on the camera's look direction — the approach you've been patching — does not appear as a named primary mechanism in the surveyed literature. Where rate limits appear, they are documented as *secondary* safety caps layered on top of a damped target, and as sources of the failure modes you've been hitting.

---

## Terminology glossary

- **Virtual camera (vcam)** — Cinemachine's unit of framing intent. A vcam declares *what* to follow (`Follow`) and *what* to look at (`LookAt`), independently.
- **Body / Aim** — Cinemachine's split. Body = position controller; Aim = orientation controller. Damped independently.
- **Composer** — Cinemachine's aim controller. Screen-space composition + damping on orientation.
- **Framing Transposer** — Cinemachine's body controller. Position in a fixed screen-space relationship to the follow target, damped.
- **Dead zone / soft zone** — Screen-space regions in a Composer. Target in dead zone → no re-aim. Target crosses into soft zone → camera re-aims with damping. Target outside soft zone → hard re-aim. A principled way to prevent re-aiming on micro-jitter.
- **Critically-damped spring** — Mass-spring-damper with damping ratio = 1. Reaches the goal as fast as possible without overshoot. The default regime for camera smoothing.
- **Half-life parameterization** — Parameterizing a damper by "time to close half the remaining distance" instead of raw stiffness/damping. More intuitive and decoupled from mass. Daniel Holden's `spring_damper_exact` uses this; Unity's `SmoothDamp` is equivalent.
- **SmoothDamp** — Unity's implementation of the Game Programming Gems 4 critically-damped smoother (Thomas Lowe). Takes a current value, a goal, a velocity (mutated in-place), a `smoothTime`. Frame-rate independent.
- **Slerp** — Spherical linear interpolation between two unit quaternions along the shortest arc. Constant angular velocity. For orientation-goal smoothing, not target-point smoothing.
- **Look-ahead** — Extrapolate the target forward by `k * velocity` before smoothing. Reduces apparent lag without reducing smoothness.

---

## Citations

**Middleware / engine docs (authoritative):**
- Unity Cinemachine 2.10 manual — Virtual cameras, Body/Aim split. https://docs.unity3d.com/Packages/com.unity.cinemachine@2.10/manual/CinemachineUsing.html
- Unity Cinemachine — Class `CinemachineComposer` (look-at damping). https://docs.unity3d.com/Packages/com.unity.cinemachine@2.1/api/Cinemachine.CinemachineComposer.html
- Unity Cinemachine — Class `CinemachineFramingTransposer` (body damping). https://docs.unity3d.com/Packages/com.unity.cinemachine@2.1/api/Cinemachine.CinemachineFramingTransposer.html
- Unity Scripting API — `Quaternion.Slerp`. https://docs.unity3d.com/ScriptReference/Quaternion.Slerp.html

**Primary technique writeups (rigorous — read in full if redesigning):**
- Daniel Holden, *"Spring-It-On: The Game Developer's Spring-Roll-Call"* — canonical reference on `damper_exact`, `spring_damper_exact`, half-life parameterization, frame-rate-independent forms. https://theorangeduck.com/page/spring-roll-call
- Ryan Juckett, *"Damped Springs"* — derivation + practical code for all three damping regimes (under-, critically-, over-). https://www.ryanjuckett.com/damped-springs/
- Allen Chou, *"Game Math: Deriving the Slerp Formula"* — rigorous derivation, useful if you go the orientation-smoothing route. https://allenchou.net/2018/05/game-math-deriving-the-slerp-formula/

**GDC / professional talks:**
- John Nesky, *"50 Game Camera Mistakes,"* GDC 2014 (dynamic camera designer, *Journey*). Catalogs common failure modes and fixes. https://gdcvault.com/play/1020460/50-Camera (GDC Vault) / https://www.youtube.com/watch?v=C7307qRmlMI (YouTube)
- Itay Keren, *"Scroll Back: The Theory and Practice of Cameras in Side-Scrollers,"* GDC — systematic framework for camera motion; the dead-zone / soft-zone vocabulary comes from this lineage. https://gdcvault.com/play/1022243/Scroll-Back-The-Theory-and

**Supporting developer writeups:**
- Alexis Bacot, *"The Art of Damping"* — practitioner's overview. https://www.alexisbacot.com/blog/the-art-of-damping
- Little Polygon, *"Tech Breakdown: Third Person Cameras in Games"* — Distance / Angle / Smoothing framework; notes low-pass or critically-damped spring as standard for position tracking. https://blog.littlepolygon.com/posts/cameras/
- Thomas Lowe, *"Critically Damped Ease-In/Ease-Out Smoothing,"* Game Programming Gems 4 (offline; cited ubiquitously as the basis of Unity's `SmoothDamp`).

**Rigor flags:**
- Cinemachine and Unity docs: **rigorous** — authoritative, maintained.
- Holden, Juckett, Chou, Lowe: **rigorous** — primary technical sources, widely cited.
- Nesky GDC 2014: **rigorous** — primary practitioner talk from a shipped AAA cinematic camera.
- Little Polygon, Bacot: **serious practitioner writeups** — useful framing, not primary.
- Space-sim specific material (Elite Dangerous, No Man's Sky, Star Citizen): **thin.** The commercial space sims have extensive player-facing documentation of *what* their autopilots do behaviorally, but virtually no developer-facing documentation of *how* their cameras are damped. Hello Games and Frontier have not published on this. The convergence evidence is therefore from the middleware and cinematic-camera literature, not from space-sim postmortems.

---

## Landmines (documented failure modes the redesign should avoid)

1. **Colinear up vector and look direction → degenerate `lookAt`.** When the camera's up-vector and its look direction become parallel (e.g., camera directly above/below target, or camera coincident with target), the look-at matrix construction is ill-defined. Documented across engines and forums. This is a distinct problem from gimbal lock but often conflated with it. Prior-art fix: detect the colinearity condition and either (a) blend the up-vector toward a secondary reference, or (b) freeze orientation until the geometry de-degenerates.
2. **Target coincident with camera → zero-length target vector.** When the ship passes through or very near the subject, `target - cameraPos` shrinks to zero and normalization blows up. Documented in the Godot `phantom-camera` issue tracker and on GameDev.net. Prior-art fix: define a minimum-separation floor; below it, hold the previous valid orientation or damp toward it.
3. **Per-axis rate clamping on orientation produces diagonal artifacts.** Clamping yaw and pitch independently causes the camera to move along axis-aligned arcs rather than great-circle arcs — the camera "staircases." This is why the literature damps the *target point* (in 3D) and derives orientation from it, rather than clamping orientation axes.
4. **Euler-angle-based smoothing hits gimbal lock near ±90° pitch.** Not a problem if you smooth target positions and rebuild the orientation via `lookAt` each frame; a severe problem if you smooth the euler angles directly. Quaternion or target-point smoothing is the standard dodge.
5. **Frame-rate-dependent smoothing.** Naive `smoothed = lerp(smoothed, target, 0.1)` has behavior that changes with framerate. The `1 - exp(-dt/tau)` form (or Unity's `SmoothDamp`, or Holden's `*_exact` family) is frame-rate independent. This is non-negotiable for any released game.
6. **Parallax-from-self-motion confounds angular-rate clamps.** When the camera is mounted to a moving ship and the ship decelerates near the subject, the apparent angular velocity of the subject in the camera frame spikes *even though the subject isn't moving*. An angular-rate clamp on the camera fights this spike by lagging, which then overshoots when the ship stops. A damped *target position* (in world space) doesn't have this pathology — the world-space target is stable; only the camera-to-target vector changes, and the smoother handles that naturally.
7. **Small target wobble triggers re-aim jitter.** Documented in Cinemachine's dead-zone rationale: if the camera always re-aims at the exact target center, sub-pixel wobble becomes visible camera hunting. Prior-art fix: a dead zone / soft zone in screen space, so the camera re-aims only when the target meaningfully moves.

---

## What I didn't cover and why

- **Specific implementations in shipped space sims.** Neither Frontier (Elite Dangerous), Hello Games (No Man's Sky), nor CIG (Star Citizen) has published developer-facing material on their autopilot camera smoothing. The behavioral descriptions in player wikis were not load-bearing for the research questions. If this becomes important, the path forward is a GDC Vault search for talks by those studios, not forum trawling.
- **Math derivations.** Per scope. The citations point to the derivations; the redesign should read Holden + Juckett in full before implementing, not re-derive.
- **Kerbal Space Program, EVE Online, FreeSpace 2, Wing Commander.** Surveyed for convergence evidence; nothing new beyond what Cinemachine + the damping literature already establishes. KSP's reference-frame-transition camera is a separate problem (origin-rebasing, not smoothing) and is already on your roadmap via `well-dipper-rebasing-plan.md`.
