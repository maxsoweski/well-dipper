# Convention — Isolated test harnesses for visual features

When building a new visual feature (shader, rendering effect, procedural generation change), the working pattern in this project is:

1. **Create a standalone HTML harness** at the project root named after the feature: `galaxy-glow-viewer.html`, `tunnel-lab.html`, `<feature>-lab.html`.
2. **Import only the module(s) under test**, not the whole game. Minimal Three.js scene: renderer, camera, the mesh being tested.
3. **If the feature touches a production renderer, copy it first.** Create `Experimental*` / `WarpTunnel*` / similar variant and modify the copy. The production class stays untouched until the look is locked.
4. **Expose tunable uniforms via sliders** with live update handlers. Add buttons for canonical test states (teleport presets, animation sequences, regenerate data).
5. **Expose a `window._lab` / `window._viewer` object** with imperative helpers so the harness can be driven programmatically (playwright automation, console debugging, etc.).
6. **Iterate in the harness until the look is right.** Resist the temptation to also edit production code — that's what makes this pattern fast.
7. **Port approved changes into the real file** in one focused pass once the harness visuals are locked, then delete the experimental copy.

## Existing harnesses

| File | Tests | Notable features |
|---|---|---|
| `galaxy-glow-viewer.html` | `ProceduralGlowLayer.js` | 7 teleport presets (Sun, core, above disk, rim, outside, in-arm, inter-arm), molecular-cloud sliders, clouds ON/OFF toggle |
| `tunnel-lab.html` | `WarpTunnelStarfieldLayer.js` (experimental) | Tunnel warp sliders (phase, scroll, radius, length), "Play Full Warp" button that runs the FOLD / ENTER / HYPER / EXIT sequence |

## Running a harness

```
cd ~/projects/well-dipper
npx vite
# then browse to:
# http://localhost:5173/well-dipper/<harness-name>.html
```

The dev server serves under `/well-dipper/` because of the GitHub Pages base path in `vite.config.js`.

## Why this pattern

- **Fast iteration.** Reloading one HTML file is instant. Reloading the whole game isn't.
- **Isolated blast radius.** Production shaders don't get destabilized while tuning a new feature.
- **A/B comparisons become trivial.** An on/off toggle button in the harness compares two states instantly. In the full game, you'd have to replay to a specific scenario to see the difference.
- **Playwright-driven verification works cleanly.** A harness with a `window._lab` exposure lets automation drive it for visual regression snapshots and perf testing without needing to navigate game UI.
- **Shippable as a reference.** The harness stays in the repo after the feature ships. Future refactors or parameter changes can re-use the harness to verify nothing broke.

## What NOT to do

- Don't edit `src/rendering/sky/StarfieldLayer.js`, `ProceduralGlowLayer.js`, `RetroRenderer.js`, or other production renderers while iterating on a feature's look. Copy them into experimental variants first.
- Don't skip the harness because "the feature is small." If there's a visual parameter to tune, a harness is faster.
- Don't delete old harnesses when merging a feature. They stay as references.

## Screenshot storage

All playwright / automated visual test screenshots go into `screenshots/` at the project root (`~/projects/well-dipper/screenshots/`). When calling `mcp__playwright__browser_take_screenshot`, always prefix the filename with `screenshots/` so the output lands there, not in the parent working directory. This keeps the project root clean and makes it easy to browse past test artifacts from one place (accessible from Windows at `\\wsl.localhost\Ubuntu\home\ax\projects\well-dipper\screenshots\`).
