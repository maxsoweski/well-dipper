# Flight Reliability Roadmap — Where We Are / Where We're Going (2026-07-01)

**Line of sight:** the unattended Orrery tour IS the screensaver behind the **35% SCREENSAVER
heart**. This doc reconciles (a) what's actually in the game at HEAD, (b) the approved
4-increment intelligent-tour plan, (c) the 2026-07-01 UAT-failure telemetry, and (d) the
navigation-AI research — into one sequenced path. It supersedes the "NEXT PRIORITY" section
of [`FLIGHT_RELIABILITY_PROGRAM_2026-06-30.md`](FLIGHT_RELIABILITY_PROGRAM_2026-06-30.md)
as the plan-of-record for sequencing; that doc remains the program charter.

**Governing design principle (research-confirmed):** *stuck is a design-out problem, not a
detect-and-recover problem.* Every surveyed game that relies on reactive stall detection has
documented stuck-loops (Elite's Supercruise Assist disengage-on-obstruction, X4's
stop-adjust-retry, the "loop of shame"); every one that gates transit behind explicit
preconditions avoids stuck states by construction (Elite's mass-lock + escape-vector
departure, Freelancer's steer-around, aviation obstacle-departure procedures). Max's
orbit-over-the-horizon vision is the by-construction approach. The stall detector stays —
but as the last-resort net, never the router.

---

## 1. Where we are — the measured present (HEAD `f97394a`)

| In the game | Status | Measured reality (telemetry, 15.5-min Sol run) |
|---|---|---|
| Gravity-well speed model (`SC_TUNING`, cap ≈ surfaceDist/3, floor R×0.5; 1.05R collision barrier) | Locked by design — never retune | Crawl band is ~16u wide around EVERY body (absolute, not scaled by R). Open-space cruise 500–1,200 u/s is healthy. |
| WS-1 CRUISE stall-detector (`VERIFIED_PENDING_MAX 5945f07`) | **Defective criterion (RC1)** | Progress threshold = 2% of *initial* leg distance per 12s — unmeetable in the terminal crawl → killed every leg >~100u *just short of arrival* (9,500u leg killed 34.5u out; 15,400u killed 2.7u out). 35 aborts, 7 arrivals (all <100u hops) in 44 legs. |
| Inc-1 star standoff + go-around (`VERIFIED_PENDING_MAX aa8ea8d`) | **Works on normal legs; two gaps (RC3, AC3-B)** | Clean go-around observed live (minStar 20.7 > keepOut 16.3). BUT `main.js:6985` nulls keep-out while `warpEffect.isActive` → warp-arrival star leg parks at legacy 2.6R INSIDE the keep-out (obs. 4.04 ≈ 2.6×1.525R); next leg crossed starDist 2.5. Also: go-around geometry from inside the sphere is best-effort (the AC3 "impossible" case does occur, via this path). |
| Post-abort behavior | **Nothing owns recovery (RC2)** | Abort strands the ship where it stopped — deep in a crawl shell (0.01u off planet8's surface); well-escape takes >12s so every next leg aborts too → 14-leg / 4.7-min frozen carousel. The wedge is generic to every body, not just the star. |
| Arrival capture (dropRadius 10R, dropMaxSpeed 4R) | **Unmeetable for tiny bodies (RC4)** | A R≈0.004 moon requires arrival speed ≤0.016 u/s — ship flew to distance 0.00 without HOLD. |
| Tour orchestration (AutoNavigator queue → warp to next system on wrap) | Working | Wrap → cinematic warp → new-system restart confirmed live (this is where RC3 fires). |
| Boot mapping HELM→manual / ORRERY→tour | Inverse of Max's model | Increment 4 target (unchanged). |
| Diagnostic instrumentation | **New standing asset** | 1 Hz tour sampler + analyzer: `docs/WORKSTREAMS/autopilot-standoff-routing-2026-07-01/triage/`. Re-run as the acceptance gate for every step below. |

Net effect Max saw: slow (63% of run <0.5 u/s), stuck at the sun (RC3 + RC2), never reaches
planets (RC1 + RC4).

## 2. Where we're going — the approved destination (unchanged)

Max's verbatim vision (program doc §NEXT): the autopilot *understands the mechanics* —
decides how to get away from the current body (usually: orbit until the nose points over the
horizon at the next target), then how to go toward the next body, looping the whole system.

The approved spec ([`2026-07-01-autopilot-intelligent-tour-design.md`](superpowers/specs/2026-07-01-autopilot-intelligent-tour-design.md))
already encodes this as increments: **1** standoff+go-around (shipped, gaps above) → **2**
DEPART orbit-to-horizon phase (reachability core; covers player Assist) → **3** showcase
policy ("chosen by the system") → **4** HELM/ORRERY reconciliation (capstone; reverses the
2026-06-27 peer-mode non-goal — confirm at its contract; mobile default open).

**The research validates this architecture and sharpens it** (sources in the two research
reports, session 2026-07-01):

- **Two-phase departure is industry doctrine** (Elite's mass-lock + escape-vector: climb
  radially away first, *ignore the destination*, hand off to transit only once clear).
  Spec's DEPART phase + its "back off radially first" mitigation = exactly this; promote the
  radial climb from mitigation to the phase's first act, gated by `v/vmax`.
- **The theory unifies Max's two complaints.** With speed a function of position (our
  speedCap), time-optimal paths *bend away from slow regions* (Zermelo/Fermat — same math as
  Snell's law). The star detour and the slow departure crawl are one phenomenon: geodesics
  in the speed field. "Orbit over the horizon" ≈ the time-optimal geodesic — Max's instinct
  is the mathematically correct policy, not just aesthetics.
- **Transit routing generalizes inc-1, cheaply.** A tangent/visibility graph over all ~40
  keep-out spheres (SPARTAN-style; ~1,600 tangent pairs, trivial cost) replaces
  "straight leg + single star detour" with shortest-safe-path for arbitrary geometry —
  including today's uncovered cases (binary companion star2 has NO keep-out; threading
  between near bodies). Discretized stand-in for the provably-minimum-free sphere-world
  navigation function (Rimon–Koditschek) without its tuning cost.
- **Commit-and-hold phase discipline** (ED "don't touch the throttle after the 7-second
  rule"; aviation "no reconfig until obstacle cleared"): once DEPART/TRANSIT/ARRIVE is
  chosen, hold that phase's control law to completion — two blended control loops fighting
  is what produces oscillation. (WS-1's re-gate per phase, already in the spec, is this.)
- **ETA-gated arrival scheduling**: schedule deceleration so its effect *culminates* at
  the capture window (MechJeb node-centered burns; ED blue-zone) instead of letting the
  cap curve dictate an open-loop crawl. Pilot-layer throttle policy, zero `SC_TUNING`
  contact. The terminal crawl near the *visited* body is the cinematic point and stays.
- **Anti-patterns to avoid** (documented failures elsewhere): reactive
  disengage-on-obstruction; continuous re-optimization against a spatially-varying cap
  (loop of shame); raw potential-field blending (local-minima trap = literally our
  stuck-at-star geometry).

## 3. The sequenced roadmap

**Step 0 — Corrections workstream (`tour-reliability-corrections`, scope next).** Fix what's
shipped before building new phases; every item measurable with the sampler.
1. **RC1**: stall criterion → cap-relative ("stuck" = sustained speed ≪ current speedCap
   allows / no progress *relative to achievable*, not an absolute quota). Keeps WS-1 as the
   net; stops it killing healthy arrivals.
2. **RC3**: warp-arrival dispatch must apply star geometry (don't null `ko` during warp for
   the standoff decision, or defer the star dispatch until warp completes).
3. **AC3-B hardening**: `goAroundWaypoint` correct from on/inside the sphere (the premise
   "can't happen" is measured false) — also groundwork for inc-2 geometry.
4. **RC4 (small)**: floor the capture window (`dropMaxSpeed`) for tiny bodies — pilot-layer.
   (Or explicitly defer to WS-4 if Max prefers skip-behavior for tiny moons.)
   Gate: re-run the 15-min sampler — expect arrivals ≈ legs, aborts ≈ 0.

**Step 1 — Increment 2: DEPART phase (research-informed).** As spec'd, plus the research
inputs: radial climb-out first (gated by v/vmax), horizon-clear predicate tested against ALL
bodies (incl. star2 — closes the binary gap), commit-and-hold transitions, DEPART's own
timeout so WS-1 never false-trips it.

**Step 2 — Transit routing upgrade (fold into inc-2's contract or a thin follow-on).**
Generalize `planLeg` from single-star detour to the small tangent graph over all keep-out
spheres; per-frame clearance switch stays. This is inc-1's geometry becoming the general
router the research recommends.

**Step 3 — Increment 3: showcase policy** (unchanged; now sits on measured reachability).

**Step 4 — Increment 4: HELM/ORRERY reconciliation** (unchanged; contract opens by
confirming the peer-mode reversal; mobile default decision inside).

**Parked lane (unchanged owners/order):** WS-2 roll-on-exit, WS-3 focus-burn cancellable,
WS-5 cleanups; tour *pacing* as a taste decision for Max **after Step 0** (once legs actually
arrive, is surfaceDist/4 arrival pacing right for a screensaver?); tiny-moon visit-vs-skip
taste call (WS-4) if not settled in Step 0.

## 4. Open decisions (Max)

1. **Greenlight Step 0 scope** (`dev-collab-scope` pass; items 1–4 above as draft ACs).
2. **Tiny moons:** capture-floor fix (visit them) vs. graceful skip (WS-4 decision) — Step 0
   item 4 vs. parked.
3. **Pacing taste** — judge after Step 0's re-run, not now.
4. (Standing, from spec) Inc-4 peer-mode reversal + mobile default — decided at that contract.

## 5. Standing measurement

Every step's exit gate: `runFlightReliabilitySuite()` green **plus** a 15-min sampler run
(`triage/tour-telemetry-sampler.js` → `analyze-tour.mjs`) compared leg-for-leg against the
2026-07-01 baseline (`triage/analysis-output.txt`). The baseline numbers to beat: 7/44
arrivals, 35 aborts, 62.7% of time <0.5 u/s.
