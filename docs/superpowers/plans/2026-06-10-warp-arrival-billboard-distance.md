# Warp Arrival at Billboard Distance — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Warp arrivals land far enough from the destination star(s) that they render as billboard dots — derived from StarFlare's own LOD switch formula, not a tuned constant.

**Architecture:** Extract StarFlare's screen-space flare→billboard switch threshold into a pure method `billboardSwitchDistance(fovDegrees, screenHeightPx)`; `update()` consumes it (single source of truth). `warpSwapSystem` in main.js then computes the arrival distance as that threshold × margin (default 1.3, live-tunable via `window._warpArrivalMargin`), max over both stars for binaries. Nothing else changes — camera placement, interp resync, Portal-B anchoring, the post-reveal fly-in all stay as-is.

**Tech Stack:** three.js, Vitest. Spec: `docs/superpowers/specs/2026-06-10-warp-arrival-billboard-distance-design.md`.

**Constraints for all workers (carried from session handoff):**
- **Scoped `git add` only** — name exact paths. A parallel session has dirty files (`planet-lod-lab.html`, `planet-archetypes.js`, `docs/FEATURES/cards/F*`, `tests/planet-*`, F-prefix PNGs, `.mcp.json`). NEVER `git add -A` / `git add .`.
- Do NOT start dev servers (`npm run dev`, `vite`, etc.).
- Run tests with `npx vitest run <file>` (full suite: `npx vitest run`).

---

### Task 1: `StarFlare.billboardSwitchDistance` + LOD block refactor

**Files:**
- Modify: `src/objects/StarFlare.js` (method added near `update()`; LOD block inside `update()` at ~lines 339-390 rewritten)
- Test: `tests/star-billboard-switch.test.js` (new)

The current `update()` computes the switch inline (condition `visibleDiameterPx < targetPx`). The extraction is algebra-equivalent: `visibleDiameterPx < targetPx ⇔ dist > R·6·pixelsPerRadian/targetPx ≡ switchDist`. The billboard sizing and spike fade also re-express exactly: `worldSize = (targetPx/ppr)·dist = R·6·dist/switchDist`, and the fade ramp `(visibleDiameterPx − targetPx)/(3·targetPx) = (switchDist/dist − 1)/3`.

- [ ] **Step 1: Write the failing test**

Create `tests/star-billboard-switch.test.js`:

```js
// StarFlare.billboardSwitchDistance — the camera distance at which the
// flare disc yields to the distance billboard. Extracted 2026-06-10 from
// the inline math in update() so warp arrival placement can land the
// camera in guaranteed-billboard range (see
// docs/superpowers/specs/2026-06-10-warp-arrival-billboard-distance-design.md).
// These tests pin parity with the pre-extraction inline formula.

import { describe, test, expect } from 'vitest';
import { StarFlare } from '../src/objects/StarFlare.js';

const FOV = 50;        // game camera FOV
const SCREEN_H = 1440;

function makeStar({ radius = 1, luminosity = 1 } = {}) {
  return new StarFlare({ radius, luminosity, color: [1, 0.9, 0.8] });
}

// Reference: the inline math from StarFlare.update() as of 2026-06-10
// (pre-extraction). Switch fired when visibleDiameterPx < targetPx.
function referenceSwitchDistance(radius, luminosity, fovDeg, screenH) {
  const lumFactor = Math.max(0.55, Math.min(2.0, 0.7 + 0.2 * Math.log10(luminosity)));
  const pixelsPerRadian = (screenH / 2) / Math.tan((fovDeg * Math.PI / 180) / 2);
  const targetPx = Math.max(16, Math.min(22, 16 + 6 * (lumFactor - 0.55)));
  return (radius * 6 / targetPx) * pixelsPerRadian;
}

describe('StarFlare.billboardSwitchDistance', () => {
  test('parity with pre-extraction inline formula across star classes', () => {
    const cases = [
      { radius: 0.3, luminosity: 0.04 },   // M-class
      { radius: 1.0, luminosity: 1.0 },    // G-class (Sol)
      { radius: 1.8, luminosity: 20 },     // A-class
      { radius: 6.0, luminosity: 300000 }, // O-class
    ];
    for (const c of cases) {
      const star = makeStar(c);
      expect(star.billboardSwitchDistance(FOV, SCREEN_H))
        .toBeCloseTo(referenceSwitchDistance(c.radius, c.luminosity, FOV, SCREEN_H), 6);
    }
  });

  test('boundary semantics match the old visibleDiameterPx test', () => {
    // Just beyond switchDist the old condition (visibleDiameterPx < targetPx)
    // was true (billboard); just inside it was false (flare).
    const star = makeStar({ radius: 1, luminosity: 1 });
    const d = star.billboardSwitchDistance(FOV, SCREEN_H);
    const ppr = (SCREEN_H / 2) / Math.tan((FOV * Math.PI / 180) / 2);
    const targetPx = 16 + 6 * (0.7 - 0.55); // G-class lumFactor = 0.7
    expect((1 * 6 / (d * 1.001)) * ppr).toBeLessThan(targetPx);    // billboard side
    expect((1 * 6 / (d * 0.999)) * ppr).toBeGreaterThan(targetPx); // flare side
  });

  test('monotonic: larger radius → larger switch distance (linear)', () => {
    const d1 = makeStar({ radius: 1 }).billboardSwitchDistance(FOV, SCREEN_H);
    const d2 = makeStar({ radius: 2 }).billboardSwitchDistance(FOV, SCREEN_H);
    expect(d2).toBeCloseTo(d1 * 2, 6);
  });

  test('luminosity clamps: floor at 16 px, ceiling at 22 px', () => {
    // Below the lumFactor floor (0.55) all stars share targetPx = 16.
    const dimA = makeStar({ radius: 1, luminosity: 0.04 });
    const dimB = makeStar({ radius: 1, luminosity: 0.001 });
    expect(dimA.billboardSwitchDistance(FOV, SCREEN_H))
      .toBeCloseTo(dimB.billboardSwitchDistance(FOV, SCREEN_H), 6);
    // Above the ceiling all stars share targetPx = 22.
    const hotA = makeStar({ radius: 1, luminosity: 3e5 });
    const hotB = makeStar({ radius: 1, luminosity: 3e7 });
    expect(hotA.billboardSwitchDistance(FOV, SCREEN_H))
      .toBeCloseTo(hotB.billboardSwitchDistance(FOV, SCREEN_H), 6);
    // And brighter ⇒ bigger dot ⇒ switch fires closer in.
    expect(hotA.billboardSwitchDistance(FOV, SCREEN_H))
      .toBeLessThan(dimA.billboardSwitchDistance(FOV, SCREEN_H));
  });

  test('taller screen → larger switch distance (screen-space criterion)', () => {
    const star = makeStar({ radius: 1, luminosity: 1 });
    expect(star.billboardSwitchDistance(FOV, 2160))
      .toBeGreaterThan(star.billboardSwitchDistance(FOV, 1080));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/star-billboard-switch.test.js`
Expected: FAIL — `star.billboardSwitchDistance is not a function`

- [ ] **Step 3: Add the method and refactor `update()`**

In `src/objects/StarFlare.js`, add immediately BEFORE the `update(deltaTime, camera)` method:

```js
  /**
   * Camera distance at which the flare disc yields to the distance
   * billboard (and vice versa) — the same screen-space criterion
   * update() applies per frame: the flare's visible glow
   * (renderRadius × 6 world units) projecting below a
   * luminosity-dependent 16–22 px target. Pure math, no renderer
   * needed — warp arrival placement calls this to land the camera in
   * guaranteed-billboard range (main.js warpSwapSystem).
   */
  billboardSwitchDistance(fovDegrees, screenHeightPx) {
    const fovRad = fovDegrees * Math.PI / 180;
    const pixelsPerRadian = (screenHeightPx / 2) / Math.tan(fovRad / 2);
    const lf = this._lumFactor || 0.7;
    // The biggest background stars in StarfieldLayer use aSize=8 which
    // doubles to gl_PointSize=16. Target 16-22 px so the billboard is
    // always at least as big as the brightest BG star:
    //   any star (clamp floor)   → 16 px
    //   G-class (Sol, lf ~0.7)   → 17 px
    //   A-class (~1.0)           → 19 px
    //   O-class (~1.5)           → 22 px (clamp ceiling)
    const targetPx = Math.max(16, Math.min(22, 16 + 6 * (lf - 0.55)));
    // Visible glow diameter is renderRadius*6 (shader glowRadius*2);
    // switch when it projects below targetPx:
    //   (R*6/dist)*pixelsPerRadian < targetPx  ⇔  dist > this value.
    return (this._renderRadius * 6 / targetPx) * pixelsPerRadian;
  }
```

Then in `update()`, replace the LOD block — everything from `// ── Distance LOD: swap flare disc for circular billboard ──` (~line 339) through the `else { ... }` that sets `uniforms.uSpikeIntensity.value` (~line 390) — with:

```js
      // ── Distance LOD: swap flare disc for circular billboard ──
      // Threshold math lives in billboardSwitchDistance() (single source
      // of truth — warp arrival placement reuses it). The billboard
      // renders at a constant screen size so the star is always at least
      // as big and bright as a peak background starfield star and its
      // halo has room to dither out into a hazy glow.
      const dist = Math.max(
        camera.position.distanceTo(this.mesh.position), 0.001);
      const switchDist =
        this.billboardSwitchDistance(camera.fov, window.innerHeight);

      if (dist > switchDist) {
        // Star has shrunk to background-star size — show the billboard.
        this._flareDisc.visible = false;
        this._billboard.visible = true;
        // World-space scale that produces exactly targetPx pixels at the
        // current camera distance (targetPx/pixelsPerRadian == R*6/switchDist,
        // so worldSize == R*6*dist/switchDist). Recomputed every frame so
        // the projected size stays constant as you fly away.
        const worldSize = (this._renderRadius * 6 * dist) / switchDist;
        this._billboard.scale.set(worldSize, worldSize, 1);
        this._billboard.quaternion.copy(camera.quaternion);
      } else {
        this._flareDisc.visible = true;
        this._billboard.visible = false;
        // Spike fade — ramp diffraction spike contribution down to 0 by
        // the time we'd switch to the billboard, so the flareDisc's last
        // visible state matches the billboard's circular dot. Full spikes
        // above 4× the switch-size, smooth fade down to the switch. (In
        // the old px terms: (visibleDiameterPx − targetPx)/(3·targetPx)
        // == (switchDist/dist − 1)/3 — same ramp, re-expressed.)
        const t = Math.max(0, Math.min(1, (switchDist / dist - 1) / 3));
        const spikeIntensity = t * t * (3 - 2 * t); // smoothstep
        uniforms.uSpikeIntensity.value = spikeIntensity;
      }
```

Do NOT touch anything outside that block (the `quaternion.copy` billboard-facing line above it, the uScreenAngle comment, the brightness-pulse code below it).

- [ ] **Step 4: Run the new test, then the full suite**

Run: `npx vitest run tests/star-billboard-switch.test.js` — Expected: PASS (5 tests)
Run: `npx vitest run` — Expected: all pass (54 prior + 5 new; the parallel session's planet tests may be mid-edit — a failure ONLY in `tests/planet-archetypes.test.js` is not ours, report it but don't fix it).

- [ ] **Step 5: Commit (scoped paths)**

```bash
git add src/objects/StarFlare.js tests/star-billboard-switch.test.js
git commit -m "refactor: extract StarFlare.billboardSwitchDistance (LOD threshold, single source)

Pure method for the flare→billboard switch distance; update() now
consumes it. Algebra-equivalent rewrite of the LOD block (worldSize and
spike fade re-expressed in switchDist terms). Characterization tests pin
parity with the old inline formula. Prep for billboard-range warp
arrival (spec 2026-06-10)."
```

---

### Task 2: Billboard-range arrival in `warpSwapSystem`

**Files:**
- Modify: `src/main.js` — the star-system branch of the teleport block (~lines 5431-5448, comment + `orbitDist` line)

No headless test — `main.js` doesn't import standalone; this layer is verified live (Task 3) per the spec's test plan.

- [ ] **Step 1: Replace the star-system arrival block**

In `warpSwapSystem()`, find the `else` branch beginning `// Star system: approach toward the star.` and ending with `camera.lookAt(starPos);`. Replace the comment block and the three lines (`const star = ...`, `const starPos = ...`, `const orbitDist = ...`) with:

```js
      // Star system: approach toward the star.
      // orbitDist sets the final camera-to-star distance post-EXIT (travel
      // and coast terms cancel with starting position). Arrival lands in
      // BILLBOARD range — derived from the same screen-space formula
      // StarFlare.update() uses for its flare→billboard switch, × margin —
      // so the destination star reads as the same dot the player targeted
      // in the origin starfield (Max, 2026-06-10; spec:
      // docs/superpowers/specs/2026-06-10-warp-arrival-billboard-distance-design.md).
      // The switch is screen-space (window height / FOV / luminosity), so
      // a fixed radius multiplier — the previous radius×100, tuned
      // 2026-04-16 for a prominent ~17° flare — can't guarantee billboard
      // on every display; the derived distance can. Binaries take the max
      // over both stars so both render as dots. The post-reveal nav leg
      // still flies us in (cruise speed scales with leg length, 12s
      // ceiling); that handoff is the future supercruise seam.
      const star = system.star;
      const starPos = star.mesh.position;
      // UAT knob (pattern: _warpPreviewDist, ec47b84). Read per-warp so
      // live tuning applies to the next jump.
      const arrivalMargin = (typeof window._warpArrivalMargin === 'number')
        ? window._warpArrivalMargin : 1.3;
      let switchDist = star.billboardSwitchDistance(camera.fov, window.innerHeight);
      if (system.star2) {
        switchDist = Math.max(switchDist,
          system.star2.billboardSwitchDistance(camera.fov, window.innerHeight));
      }
      const orbitDist = switchDist * arrivalMargin;
```

The `camera.position.set(...)` and `camera.lookAt(starPos)` lines below stay EXACTLY as they are, as does everything after (`cameraInterp.resync`, etc.).

- [ ] **Step 2: Build + suite sanity**

Run: `npx vitest run` — Expected: same pass count as Task 1 Step 4 (this change isn't unit-covered; we're checking nothing broke).
Run: `npm run build` — Expected: clean build, no errors.

- [ ] **Step 3: Commit (scoped paths)**

```bash
git add src/main.js
git commit -m "feat: warp arrival at billboard range (derived from StarFlare LOD switch)

orbitDist = billboardSwitchDistance(fov, innerHeight) × margin (1.3,
live knob window._warpArrivalMargin) instead of radius×100 — destination
star(s) emerge as billboard dots, continuous with the origin-starfield
view. Same rule for starfield-targeted and nav-comp warps; binaries take
the max over both stars. Fly-in unchanged (supercruise seam)."
```

---

### Task 3: Live verification (GPU 9223) — driven by working-Claude, NOT a subagent

Per `memory/well-dipper-testing-reference.md` (chrome-devtools on the 9223 Chrome, not Playwright; rAF fps check first; boot ritual `_lab.enterSol()` → `stopAutopilot()` ×7 → settle).

- [ ] Hard-reload the page (main.js edit → Vite entry-module HMR trap).
- [ ] Boot ritual, then run ≥3 warps (starfield-targeted; at least 1 nav-comp warp).
- [ ] At the emergence crossing and again post-coast assert in-page: `window.__wd`-style check that `system.star._billboard.visible === true` (and `star2`'s if binary) — billboard LOD active, flare disc off.
- [ ] Confirm no AC4/AC5 console warnings; approach leg completes (camera reaches the star stop); `parkBackDepth`/emergence gate behave (they key off Portal-B distance — expected orthogonal).
- [ ] Eyeball checks: destination through the tunnel's far opening at the new distance; supergiant/large-R system if one comes up (arrival in the thousands of units — far plane/fog sanity).
- [ ] Result → `VERIFIED_PENDING_MAX <sha>`, update `docs/NOW.md` (warp-session-owned), commit scoped. Max then rides: starfield warp + nav-comp warp, tunes `window._warpArrivalMargin` if the felt distance is off; confirmed value gets baked.
