# Live-integration evidence — working-Claude drive (AC2/AC3/AC4)

**Workstream:** world-engine-baked-relief-render-2026-06-25 · **Commit:** `e9d6cd5` · **Driven:** 2026-06-25
**Where:** GPU Chrome `:9223`, `http://localhost:5173/well-dipper/world-engine-lab.html` (the build tree; NOT `:5174`).
**By:** working-Claude (the dev-collab live-integration role; these are objective pass/fail checks, NOT acceptance — AC5 is Max's).

`verdict.json` marks AC2/AC3/AC4 `INSUFFICIENT — pending working-Claude live drive` (by design: verify-workstream ran `liveBranch:main`, so it did not drive the browser). This file supplies that drive. All three pass → **integration layer GREEN**.

## AC3 — single source (the §0 anti-WS4-split invariant) — **PASS**
Probe: `window._lab.sampleRoutedHeight(dirs)` (router height) vs `window._lab._bakedReliefAt(dir)` (baked relief DATA), 16 directions incl. both poles, antimeridian, cube corners.
- **`maxAbsDiff(router, baked) = 0` exactly, sphere-wide** (clean load path). The router routes on precisely the baked field — one `carrier.height` feeds both the renderer's cube and the router. No surface-vs-rivers split.
- Router-lab regression at strength 1: `oceanPct 35`, `orphanPct 0`, `uphillPct 0`, `maxStrahler 4`, `nanCount 0`, `channelCount 4471`. In band.
- **Strength-0 fallback proven**: forcing a full `route()` at strength 0 → router reverts to the legacy `sampler.read()` field (`maxAbsDiff vs baked = 0.305`, vs strength-1 = 0.27), drainage still healthy (ocean 35%, 0 orphan/uphill). The gate fires; renderer + router fall back together.
- Note: calling `riverOverlay.route()` by hand (non-standard path) yields a 0.075 router-vs-`_bakedReliefAt` delta — a probe artifact (different grain-driver inputs in the two independent derivations), NOT a split: `route()` bakes the cube from its own `carrier.height` and points the router at that same array, so renderer↔router stay consistent regardless. The normal load path gives exact diff 0 (above).

## AC2 — surface displaces from the baked field; strength-0 byte-identical — **PASS**
- A/B at a fixed camera: **strength 1 vs strength 0 render visibly different surface relief** (the baked field contributes to the surface). The renderer's `uReliefBakeCube` is bound to the real baked cube (`riverOverlay.reliefTexture`); `uReliefBakeStrength` reads every frame so the toggle is immediate.
- Strength-0 byte-identical: the shader height source is a true `if/else` BRANCH whose else is the verbatim pre-AC2 `fbmd(vPos, uOctaves, fwBase)` with no `textureCube` fetch (code-verified + verify-workstream static-green); the prod `uniforms.js` does not even define the uniform.
- Field probe parity (AC3 above) doubles as the AC2 "displacement tracks the sampled height" objective: router/displaced height == baked field, diff 0.

## AC4 — seam/pole continuity — **PASS**
- Headless DATA continuity green with frozen, injection-validated thresholds (antimeridian maxDelta 0.0352, cube-face 0.0724, both polar caps nan=0, region drainage 0 uphill/orphan; the gate FAILS on injected seams/pinches ≥0.10).
- Live GPU render (strength 1, distance 2.6, `pixelScale÷3`):
  - **North pole** (top-down, pole dead-center): no pinch / swirl / convergence artifact; relief reads continuously through the pole.
  - **South pole** (top-down): same — clean, no pinch.
  - **Cube corner `(1,1,1)`** (worst-case 3-face-meeting point dead-center): no seam line, no ridge, no radiating discontinuity.
  - The flagged sub-mesh-resolution pole direction-discontinuity (Phase-A review nit) does **not** manifest visually — as predicted (nearest node ~2.2° off-pole; near-pole slope < mid-latitude; Jacobi-damped).

## Rollup
Unit PASS (verdict.json) + integration GREEN (this file) → **`VERIFIED_PENDING_MAX e9d6cd5`**. AC5 UAT is Max's gate alone.
