# Inc-1 UAT triage — instrumented tour telemetry (2026-07-01)

**Why this exists:** Max failed inc-1 UAT ("takes too long, still stuck at the sun,
sometimes never reaches planets"). This dir holds the evidence from a 15.5-minute
instrumented live tour (Sol, dev server `:5173`, all settings at boot defaults,
lingerMult 0.1) and the tools to re-run it.

**Function:** measure what the autopilot tour actually does, per second, so fixes
target measured mechanisms instead of guesses.
**Non-goals:** this is a diagnostic, not a standing CI gate (the reliability suite
`window.__wd.runFlightReliabilitySuite` remains the standing gate); no fixes were
made from this dir.

## Files
- `tour-telemetry-sampler.js` — paste/evaluate in the game page (after
  `_lab.enterSol()` + `_lab.beginAutopilotTour()`). Records 1 Hz to
  `window.__wdTourTelemetry`: leg/phase/speed/cap, cap-dominating body, fresh star
  distance (rebase-safe), stall-detector internals, abort count.
- `analyze-tour.mjs` — `node analyze-tour.mjs` against `tour-telemetry.json`
  (dump `window.__wdTourTelemetry` to that file). Prints leg table, speed
  distribution, abort contexts, star-leg detail.
- `tour-telemetry.json` — the 2026-07-01 dataset (931 samples).
- `analysis-output.txt` — the analyzer's output for that dataset.

## Headline findings (details in the session report / program memory)
44 legs, 7 arrivals (all short hops <100u), 35 stall-aborts, 62.7% of the run
below 0.5 u/s. Root causes identified:
1. **RC1** — WS-1 stall threshold = 2% of *initial* leg distance per 12s; terminal
   crawl (speed ≈ surfaceDist/4) can never meet it → every long leg aborted just
   short of arrival (9,500u leg killed 34.5u out; 15,400u leg killed 2.7u out).
2. **RC2** — post-abort the ship is stranded deep in a body's crawl shell
   (0.01u off planet8's surface); well-escape takes >12s so every following leg
   also aborts → 14-leg / 4.7-min frozen carousel. Wedge is generic to EVERY body.
3. **RC3** — `main.js:6985` nulls keep-out while `warpEffect.isActive`; the
   warp-arrival star leg parks at legacy 2.6R *inside* the keep-out sphere
   (observed 4.04 ≈ 2.6×1.525R), and the next leg crosses starDist 2.5.
4. Tiny-moon capture: `dropMaxSpeed = 4R` is unmeetable for R≈0.004 bodies
   (ship flew to distReal 0.00 without HOLD).
