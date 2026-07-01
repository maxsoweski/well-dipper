# tour-reliability-corrections-2026-07-01 — intent

## Why we care

Max, failing inc-1 UAT (2026-07-01): "I've been watching the autopilot for a little while
now, and it doesn't really work very well. It takes too long to reach planets and still is
getting stuck at the sun. And also, sometimes just never seems to reach planets at all."

And setting the direction: "Stall detector is good, but also can't we write the algorithms
for the autopilot AI in such a way as that it actively makes decisions in such a way as to
avoid getting stuck in the first place?"

This workstream is **Step 0 of the reconciled roadmap**
(`docs/FLIGHT_RELIABILITY_ROADMAP_2026-07-01.md`, Max-greenlit): fix the four *measured*
defects in what's already shipped, so the proactive work (inc-2 DEPART, tangent routing)
builds on a floor where legs actually arrive. The proactive intelligence itself is NOT this
workstream.

Evidence base: the 15.5-min instrumented tour
(`docs/WORKSTREAMS/autopilot-standoff-routing-2026-07-01/triage/`) — 7/44 arrivals, 35
stall-aborts, 62.7% of run below 0.5 u/s.

## Success criteria (Max's language + the measured gate)

- Planets get reached: legs stop being killed just short of arrival ("never seems to reach
  planets at all" → gone). Measured: sampler re-run shows arrivals ≈ attempted legs, aborts ≈ 0
  (baseline 7/44, 35).
- The sun never traps the ship — including right after the warp into a new system (the
  measured park-inside-the-glow case).
- Tiny moons get visited, not flown through (capture succeeds at distance 0 instead of
  failing).
- The stall detector stays as the backstop ("stall detector is good") but judges *stuck*
  relative to what the gravity well permits, so it never kills a healthy crawling approach.
- Pacing is explicitly NOT judged here — Max re-judges pace after this lands (roadmap open
  decision 3).
