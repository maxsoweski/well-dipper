# Well Dipper — Quick Verification Checklist

**What changed this session:** No code changes. QA audit only. TEST_PLAN.md added.

Run the dev server in **Ubuntu terminal**: `cd ~/projects/well-dipper && npm run dev`
Open in browser (usually http://localhost:5173/).

## 30-Second Smoke Test

1. **Page loads?** You should see a star system with planets. No blank screen.
2. **Drag to orbit?** Left-click + drag rotates the camera around the star/planet.
3. **Scroll to zoom?** Mouse wheel zooms in/out smoothly.
4. **Warp works?** Press Space — you should warp to a new star system.
5. **Autopilot works?** Leave it idle for ~30 seconds — camera should start touring.

If all 5 pass, the existing features are stable. The bugs are in the **physics flight system** which is dormant (built but not connected). You won't see those bugs in normal use — they only matter when we activate gravity-driven flight.

## What's Broken (by design — not yet connected)

- **WASD moves camera** but doesn't interact with gravity (uses legacy velocity, not FlightDynamics)
- **Clicking a planet** doesn't fly you toward it (approach state is dead code)
- **CinematicDirector** computes compositions but camera doesn't use them

These are the things we're going to fix next session via the TDD rebuild of ShipCameraSystem.update().
