# Intent — CRUISE stall-detector / no-freeze guard (WS-1)

> **DRAFT for Max's confirmation.** The "Why we care" below is distilled from
> `docs/HEART_OF_DESIRE.md` (the 35% SCREENSAVER heart) + the `supercruise-arrival-modes`
> intent (Max's 2026-06-27 words) + the flight-audit evidence — **not** freshly captured from
> Max. Confirm it reads true or reframe it in your own words before this locks.

## Why we care

The unattended Orrery autopilot tour **is** the screensaver — the thing behind the 35%
SCREENSAVER milestone. Its entire job is to run on its own, showcasing the system,
indefinitely. Phase-2/3 live verification proved it can **freeze permanently**: the pilot
gets stuck in CRUISE (nose wedged behind the star, or chasing a fast-orbiting moon it can
never close on, or handed a stop with no body to fly to) and the tour never advances again.

A screensaver that freezes fails at the one thing a screensaver must do — keep going. This
isn't polish; it's making the screensaver actually be a screensaver. And because the same
pilot flies the player's Assist legs (the first GAME-tier flight capability), the no-freeze
guard protects **both** the screensaver and player-directed flight. In the arrival-modes
language: it's part of the difference between "the ship moves" and "flying works reliably."

## Success criteria (observable — confirm these are what you'd recognize as fixed)

- **The tour never freezes permanently.** A leg whose straight path is blocked by the star
  (a wedge) recovers on its own — the tour gives up on that leg and moves to the next stop —
  within a short window, instead of pinning at the barrier forever.
- **Normal legs are untouched.** A leg that's genuinely still closing on its target is never
  falsely abandoned — no regression to legs that work today.
- **A stop with no body to fly to is skipped**, and the tour keeps going.
- **A fast-orbiting moon the pilot can't catch doesn't hang the tour** — that leg is abandoned
  and the tour continues (default: skip it; see the fast-moon note in the contract).
- **The unattended loop survives a long soak** — a full multi-system screensaver run
  (tour → warp → repeat) completes without a permanent freeze.

## Deliberate non-goals

- **No obstacle-avoidance / re-routing.** The guard *aborts* a stuck leg; it does not teach
  the pilot to fly around the star. (Re-route is a possible later feature, not this.)
- **No fast-moon *capture* by default** — WS-1 skips a non-convergent fast-moon leg rather
  than adding a target-lead term to actually catch it. (Reopen as WS-4 if Max wants visits.)
- **Do not re-tune the `SC_TUNING` scale-bug floors** (two prior live regressions).
- **No change to warp, HELM manual flight, commitBurn, or Toybox** beyond the stall guard.
- No new HUD/UI for the abort (a silent skip-and-continue is the target behavior).

## Success gate

Objective ACs (unit + live integration) are working-Claude/verify-workflow gated. The
holistic "the screensaver runs reliably unattended and still showcases the system" read is
Max's UAT alone.
