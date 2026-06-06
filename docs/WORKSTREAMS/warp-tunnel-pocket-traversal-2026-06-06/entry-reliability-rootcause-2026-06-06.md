# Warp entry-crossing reliability — root cause (2026-06-06)

**Status:** Phase-1 root cause COMPLETE (systematic-debugging). Fix not yet chosen
(decision point for Max — see end).

**Method:** Built first-class per-frame telemetry (handoff step 1) instead of
monkeypatch + screenshots:
- `WarpPortal.updateTraversal` now records a gated per-frame `_trace` (off by
  default, zero cost) of exactly what the entry gate sees: `dotA/prevDotA`,
  **both** the production `latBuggy = sqrt(d²−along²)` AND a numerically-stable
  `latStable = |offset − along·n|`, `camLocalLen`, `camWorldLen`,
  `worldOriginLen`, `fwdDotNormalA`, sign-flip + insideFlip flags.
- `__wd.runWarpEntrySuite({warps})` drives N warps with the trace on and
  extracts the crossing (or missed-crossing) frame per warp + a verdict.

## The data (6-warp suite + 5-warp raw-trace capture, GPU 9223)

Reliability **4/6 registered (~67%)** — matches the handoff's "~2/3".

| Warp | Outcome | latBuggy | latStable | gate(3u) | fwd·normal | along-step | lateral |
|---|---|---|---|---|---|---|---|
| Psi Bootis | REGISTERED | 0.665 | 0.665 | pass | −1.000 | ~0.36/frame | flat |
| Saenor Haven | REGISTERED | 1.71 | 1.71 | pass | −1.000 | ~0.33/frame | flat |
| Merfrar | MISSED | 34.13 | 34.13 | reject | −1.000 | — | 34u |
| Secamon | MISSED | 56.3 | 56.3 | reject | −0.719 | 52.7u/step | 56u |
| TYC 9096 | MISSED | 34.7 | 34.7 | reject | −0.931 | 82.8u/step | 34u |
| Friordaran | MISSED | 16849 | 16849 | reject | −0.732 | 16749u/step | 16849u |

## Findings

1. **NOT float32 precision.** `latBuggy ≡ latStable` to 1e-13…1e-21 in every
   frame. The gate operates in local/rebased coordinates (`camLocalLen` 0–90),
   so the `sqrt(d²−along²)` cancellation never bites. The handoff's leading
   hypothesis #2 (precision → world-origin rebasing) is **refuted**. The
   "latA 78→0.02 snap" observed manually was a rebase repairing a frame whose
   geometry was already broken by the jump below — not precision noise.

2. **NOT a gradual curved path.** Good warps approach dead-on: `fwd·normal =
   −1.000`, `latStable` flat (~0.66), `dotA` decrements ~0.36/frame over ~250
   frames (the FOLD ramp), clean crossing inside the 3u disc.

3. **It IS a single-step overshoot that is also off-axis.** Failing warps cross
   at "frame 1" of the approach: `dotA` jumps from +30 (fresh anchor, 30u
   ahead) to a large negative in ONE fixed-timestep sim step, with `latStable`
   simultaneously exploding. The camera traverses the entire 60u pocket and
   ends up tens-to-thousands of units off the portal axis in a single step, so
   the per-frame point-in-3u-disc sampler never observes a frame with the
   camera inside the disc → `OUTSIDE_A→INSIDE` never fires → tunnel stays
   stencil-masked → empty HYPER. (Destination load is timer-driven and stays
   robust — only the visual choreography fails.)

## Mechanism

- `simStep` runs on a fixed-timestep accumulator (`stepMs = 1/60`), so `dt` is
  constant — the giant steps are large *velocity*, not a dt spike.
- Per-frame warp motion (`main.js:6755-6756`) advances the camera along its
  **instantaneous `getWorldDirection()`**, while `6749-6750` slerps that facing
  toward `riftDir` over FOLD/ENTER. Early in FOLD the facing is still mid-slerp
  (`fwd·normal −0.72…−0.93`), so the motion is **off the portal axis**. The
  portal was anchored once at FOLD-start assuming a straight on-axis approach
  along `_tunnelForward` (`6631-6634`).
- Result: the camera's actual flight path does not pass through the 3u disc.
  Interpolating Secamon's step to the plane gives ~32u off-center — so even a
  swept-segment crossing test or a moderately widened gate would still reject.
- Friordaran (worldOrigin 6.1M, rebase every frame, 16k-unit steps) is the
  galactic-scale extreme of the same effect: the 60u pocket is hopelessly
  undersized vs the per-step travel distance.

## Fix options (decision for Max — touches AC2 "real crossing" purity)

- **A — anchor Portal A on the camera's actual path** (re-anchor each approach
  frame so the camera is always on-axis). Keeps a geometric crossing; needs the
  swept test too to survive overshoot. Most code, preserves AC2 spirit.
- **C — drive INSIDE from FOLD/ENTER progress, not geometric sampling**
  (recommended). The pocket is synthetic and the destination swap is already
  timer-driven; make the visual mode follow the same deterministic timeline.
  Eliminates the whole geometric-miss class. **Changes AC2** ("real crossing,
  not a forced set") → contract change → `dev-collab-scope` + revisit
  `tests/warp-tunnel-rebase.test.js`.
- **B — widen/adapt the gate: insufficient.** Can't catch 32–16,849u lateral
  misses.
- **E — swept-segment crossing alone: insufficient.** Path genuinely goes
  off-axis; would still reject.

Recommendation: **C** (simplest, robust, matches the already-robust timer-driven
swap), accepting the AC2 contract change. A is the fallback if Max wants to keep
a literal geometric crossing.
