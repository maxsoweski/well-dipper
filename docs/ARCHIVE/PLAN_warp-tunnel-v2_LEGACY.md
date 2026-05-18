# Warp Tunnel Production Plan v2 (2026-04-14)

**Supersedes:** `PLAN_warp-tunnel.md` (outdated — recommended fullscreen shader which Max rejected)

## Architecture

Hybrid rendering: 3D stencil portal for FOLD/ENTER, screen-space composite for HYPER/EXIT.
Single-frame handoff at ENTER→HYPER boundary, with matched tunnel size for visual continuity.

| Phase | Duration | Active System | Visual |
|-------|----------|---------------|--------|
| FOLD | 4.0s | 3D stencil portal (world-space) | Portal opens in front of camera, rim glows, stars fold inward |
| ENTER | 1.5s | 3D stencil portal (world-space) | Camera flies INTO portal; portal fills frame |
| **HANDOFF** | 1 frame | portal hidden + composite tunnel activated | Matched on-screen size keeps swap invisible |
| HYPER | 3.0s | Screen-space composite shader (procedural starfield walls) | Stars stream, bridge blend origin→destination seeds |
| EXIT | 2.0s | Screen-space composite (recession + iris) | Walls recede, iris wipes, destination revealed |

## Reference labs (DO NOT MODIFY — working)
- `stencil-portal-lab.html` — working 3D stencil portal
- `stencil-minimal.html` — minimal stencil proof

## New labs to build (isolation testing first)
1. `accretion-disk-lab.html` — rim glow shader
2. `starfield-cylinder-lab.html` — cylindrical procedural starfield
3. `portal-handoff-lab.html` — 3D→screen-space transition
4. `exit-handoff-lab.html` — tunnel recession + iris

## Sequential implementation steps
1. Build `accretion-disk-lab.html`, iterate on rim shader
2. Build `starfield-cylinder-lab.html`, verify seamless wrap
3. Build `portal-handoff-lab.html`, prove visual continuity
4. Build `exit-handoff-lab.html`, tune recession
5. Add rim to `WarpPortal.js` (additive ring mesh, renderOrder=12)
6. Replace tunnel shader in `WarpPortal.js` with procedural starfield
7. Add phase flags to `WarpEffect.js` (portalVisible, portalRimIntensity, etc.)
8. Wire `WarpEffect`→`WarpPortal` in `main.js` (portal follows warp state)
9. Suppress composite shader tunnel during FOLD/ENTER (3D portal owns those phases)
10. Add procedural starfield walls to composite shader `hyperspace()`
11. Add destination seed blending in composite shader (bridge effect)
12. Add exit recession uniform (`uTunnelRadiusScale`)
13. Fine-tune phase boundaries with Playwright single-frame verification

## Critical files
- `src/effects/WarpPortal.js` — rim + new starfield shader
- `src/effects/WarpEffect.js` — phase state flags
- `src/rendering/RetroRenderer.js` — composite shader updates
- `src/main.js` — state machine wiring

## Key risks
- Portal + sky clipping (different render target resolutions)
- Handoff flash if tunnel sizes don't match
- Breaking reference labs — don't modify them
- Performance: 27 hashes/pixel for starfield (3 layers × 9 neighbors)

## Research findings reference
See `well-dipper-session-2026-04-14.md` in memory for the full research log.
