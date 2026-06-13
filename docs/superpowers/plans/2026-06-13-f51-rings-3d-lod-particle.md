# F51 Rings v2 — 3D LOD Particle Ring Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace F51's rejected flat-annulus ring (v1) with a 3D LOD ring: a far-tier impostor (the v1 shader, reused) plus a near-tier point-sprite particle cloud that *emerges* as the camera approaches and resolves into individual glinting particles — proven in a standalone harness first, then integrated into `planet-lod-lab.html`.

**Architecture:** Approach B ("emergence, not swap"). The v1 impostor annulus renders ALWAYS (the ring's permanent body / far tier). A `THREE.Points` cloud layered on top is sized+faded per-particle by camera distance (full near, zero beyond a cull distance), so detail appears only where the camera is close while the impostor carries the rest — no pop, no dissolve. Cloud particle placement is baked from the SAME `generateRingPhysics()` density profile the impostor uses, so the seam is invisible. Build in an isolated `rings-lod-lab.html` first (isolated-test-harness rule); integrate only after the mechanism proves out.

**Tech Stack:** three.js r0.183 (raw `ShaderMaterial`, WebGLRenderer — house style, NOT TSL), Vite dev server (`:5173`), vitest (unit tests for the pure baker), chrome-devtools MCP on GPU Chrome `:9223` (visual verification).

**Full design rationale:** `docs/superpowers/specs/2026-06-13-f51-rings-3d-lod-particle-design.md`.

---

## Key reference code (read these live before coding)

- **v1 impostor block** — `planet-lod-lab.html:4456-4695` (`makeRingPhysics()`, `ringUniforms`, `ringMat`, `ring` mesh). Reused verbatim as the far tier; the harness ports it.
- **RT downscale pipeline** — `planet-lod-lab.html:4697-4760ish` (`rebuildTarget()`, NearestFilter low-res RT + nearest blit). The harness must port this so the retro envelope (dither cell size) is judged at true scale.
- **Point-cloud shader idiom** — `src/objects/Galaxy.js` (full file): `THREE.Points`, attributes `aColor`/`aSize`, perspective `gl_PointSize = aSize * (300/max(-mvPos.z,1))`, `clamp`, twinkle hash, 4×4 `bayerDither`, dither-discard. The cloud shader adapts this (but NormalBlending + LOD ramp + per-particle shadow, NOT additive).
- **Physics object shape** — `generateRingPhysics()` returns `{ ringlets:[{innerR,outerR,opacity,composition}], gaps:[{radius,width}], innerRadius, outerRadius, density, color1, color2 }`. (`src/generation/PhysicsEngine.js:793-905`.)

## File structure

- **Create `ring-particle-cloud.js`** (repo root, sibling to `planet-archetypes.js`) — exports `bakeRingCloud(physics, opts)` (PURE, unit-testable) + `makeRingCloudPoints(baked, opts)` (returns a configured `THREE.Points`). Imported by both the harness and the lab. Root placement mirrors `planet-archetypes.js` and keeps it out of `src/` (parallel warp WIP lives in `src/`).
- **Create `tests/ring-particle-cloud.test.js`** — vitest unit tests for `bakeRingCloud`.
- **Create `rings-lod-lab.html`** (repo root) — standalone harness: scene + planet + v1 impostor (ported) + cloud + camera distance/pitch GUI + RT downscale.
- **Modify `planet-lod-lab.html`** — integration (after harness proves out): import the module, build the cloud next to the existing `ring` mesh (~4695), per-frame LOD-uniform write + tilt + visibility (~7039), GUI checkbox already exists for `ringsEnabled`.
- **Modify `docs/FEATURES/cards/F51-rings.md`** (§6.5 rewrite + §7 v2 verdict) and **`docs/FEATURES/planet-lod-campaign-tracker.md`** (F51 row + phase row) — at verdict time.

## Commit discipline (shared tree — NEVER `git add -A`)

A parallel warp session has WIP in `src/` + loose untracked PNGs. Stage **explicit paths only**. Two-commit pattern per the handoff: (1) code paths → commit → grab sha; (2) doc paths (card §7 + tracker, sha stamped) → commit. Footer: `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`. The commit hook prints harmless `grep: subpattern name expected` lines — not a failure. **Do not push** — Max confirms pushes.

---

### Task 1: The particle baker (pure, TDD)

**Files:**
- Create: `ring-particle-cloud.js` (the `bakeRingCloud` export + `smoothstep`/`COMPOSITION_COLORS` helpers)
- Test: `tests/ring-particle-cloud.test.js`

- [ ] **Step 1: Write the failing test**

```js
// tests/ring-particle-cloud.test.js
import { describe, it, expect } from 'vitest';
import { bakeRingCloud } from '../ring-particle-cloud.js';

// Synthetic physics fixture: two ringlets (ice 4-5, rock 6-8) with a gap between.
const PHYSICS = {
  innerRadius: 4, outerRadius: 8,
  ringlets: [
    { innerR: 4, outerR: 5, opacity: 0.6, composition: 'ice' },
    { innerR: 6, outerR: 8, opacity: 0.5, composition: 'rock' },
  ],
  gaps: [{ radius: 5.5, width: 0.5 }],
  density: 1.0,
};

// Deterministic RNG (mulberry32) so tests are stable.
function seeded(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function radii(baked) {
  const out = [];
  for (let i = 0; i < baked.count; i++) {
    const x = baked.positions[i * 3], z = baked.positions[i * 3 + 2];
    out.push(Math.hypot(x, z));
  }
  return out;
}

describe('bakeRingCloud', () => {
  it('produces matching-length typed arrays', () => {
    const b = bakeRingCloud(PHYSICS, { count: 5000, R: 1, rng: seeded(1) });
    expect(b.positions.length).toBe(b.count * 3);
    expect(b.colors.length).toBe(b.count * 3);
    expect(b.sizes.length).toBe(b.count);
    expect(b.count).toBeGreaterThan(4000); // healthy density places ~all
  });

  it('keeps every particle inside the annulus radius bounds', () => {
    const b = bakeRingCloud(PHYSICS, { count: 5000, R: 1, rng: seeded(2) });
    for (const r of radii(b)) {
      expect(r).toBeGreaterThanOrEqual(4 - 1e-6);
      expect(r).toBeLessThanOrEqual(8 + 1e-6);
    }
  });

  it('keeps every particle within the disk thickness', () => {
    const b = bakeRingCloud(PHYSICS, { count: 5000, R: 1, thickness: 0.02, rng: seeded(3) });
    const yHalf = 0.02 * 4; // thickness * innerRadius*R
    for (let i = 0; i < b.count; i++) {
      expect(Math.abs(b.positions[i * 3 + 1])).toBeLessThanOrEqual(yHalf + 1e-6);
    }
  });

  it('clears the gap: far fewer particles in the gap band than a ringlet band', () => {
    const b = bakeRingCloud(PHYSICS, { count: 8000, R: 1, rng: seeded(4) });
    const rs = radii(b);
    const inGap = rs.filter(r => r > 5.25 && r < 5.75).length;     // gap center ±0.25
    const inRinglet = rs.filter(r => r > 6.5 && r < 7.0).length;   // rock ringlet
    expect(inGap).toBeLessThan(inRinglet * 0.15);
  });

  it('is deterministic for a fixed rng seed', () => {
    const a = bakeRingCloud(PHYSICS, { count: 1000, R: 1, rng: seeded(7) });
    const b = bakeRingCloud(PHYSICS, { count: 1000, R: 1, rng: seeded(7) });
    expect(a.positions[0]).toBe(b.positions[0]);
    expect(a.count).toBe(b.count);
  });

  it('tints particles by the composition of the ringlet they fall in', () => {
    const b = bakeRingCloud(PHYSICS, { count: 5000, R: 1, rng: seeded(9) });
    // ice ≈ (0.85,0.92,0.98); rock ≈ (0.35,0.32,0.30). Find an inner (ice) particle.
    for (let i = 0; i < b.count; i++) {
      const r = Math.hypot(b.positions[i * 3], b.positions[i * 3 + 2]);
      if (r > 4.2 && r < 4.8) { // inside ice ringlet
        expect(b.colors[i * 3]).toBeGreaterThan(0.7); // blue-white, high R
        break;
      }
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/ring-particle-cloud.test.js`
Expected: FAIL — `Cannot find module '../ring-particle-cloud.js'` / `bakeRingCloud is not a function`.

- [ ] **Step 3: Write the baker**

Create `ring-particle-cloud.js` with this content (the `makeRingCloudPoints` export is added in Task 2):

```js
import * as THREE from 'three';

// RingRenderer.js:28-33 composition palette (same as the impostor uses).
export const COMPOSITION_COLORS = {
  ice:   [0.85, 0.92, 0.98],
  rock:  [0.35, 0.32, 0.30],
  dust:  [0.55, 0.45, 0.35],
  mixed: [0.60, 0.58, 0.55],
};

function smoothstep(a, b, x) {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

/**
 * Bake a particle cloud from a ring physics profile. PURE — no three.js objects,
 * no global RNG (pass `rng` for determinism). Returns flat typed arrays.
 *
 * Density is sampled from the SAME ringlet/gap profile the impostor shader draws,
 * so dense ringlets get many particles and gaps get none — the cloud inherits the
 * banded structure and the cloud↔impostor seam stays invisible.
 *
 * @param {object} physics - { ringlets:[{innerR,outerR,opacity,composition}], gaps:[{radius,width}], innerRadius, outerRadius, density }
 * @param {object} opts - { count, R, thickness, rng, sizeMin, sizeMax }
 * @returns {{positions:Float32Array, colors:Float32Array, sizes:Float32Array, count:number}}
 */
export function bakeRingCloud(physics, opts = {}) {
  const {
    count = 80000,
    R = 1.0,
    thickness = 0.02,   // vertical half-extent as a fraction of innerRadius*R (disk depth)
    rng = Math.random,
    sizeMin = 1.0,
    sizeMax = 3.0,
  } = opts;

  const innerR = R * physics.innerRadius;
  const outerR = R * physics.outerRadius;
  const yHalf = thickness * innerR;

  const ringlets = (physics.ringlets || []).filter(r => r.outerR - r.innerR > 0.001);
  const gaps = physics.gaps || [];

  function densityAt(r) {
    let dens = 0, comp = 'mixed';
    for (const rl of ringlets) {
      const a = R * rl.innerR, b = R * rl.outerR;
      if (r >= a && r <= b) {
        const t = (r - a) / Math.max(1e-4, b - a);
        const edge = smoothstep(0, 0.08, t) * (1 - smoothstep(0.92, 1, t));
        const d = (rl.opacity ?? 0.5) * edge;
        if (d > dens) { dens = d; comp = rl.composition || 'mixed'; }
      }
    }
    for (const g of gaps) {
      const gd = Math.abs(r - R * g.radius);
      dens *= smoothstep(0, R * (g.width || 0.05), gd);
    }
    return { dens, comp };
  }

  // Peak of density×r (area weighting) for rejection sampling.
  let maxW = 1e-4;
  const SAMPLES = 512;
  for (let i = 0; i <= SAMPLES; i++) {
    const r = innerR + (outerR - innerR) * (i / SAMPLES);
    maxW = Math.max(maxW, densityAt(r).dens * r);
  }

  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const sizes = new Float32Array(count);

  let placed = 0, guard = 0;
  const guardMax = count * 200;
  while (placed < count && guard < guardMax) {
    guard++;
    const r = innerR + (outerR - innerR) * rng();
    const { dens, comp } = densityAt(r);
    if (rng() * maxW > dens * r) continue;   // reject (area-weighted by r)
    const theta = rng() * Math.PI * 2;
    const y = (rng() * 2 - 1) * yHalf;
    const i3 = placed * 3;
    positions[i3] = r * Math.cos(theta);
    positions[i3 + 1] = y;
    positions[i3 + 2] = r * Math.sin(theta);
    const c = COMPOSITION_COLORS[comp] || COMPOSITION_COLORS.mixed;
    colors[i3] = c[0]; colors[i3 + 1] = c[1]; colors[i3 + 2] = c[2];
    sizes[placed] = sizeMin + rng() * (sizeMax - sizeMin);
    placed++;
  }

  return {
    positions: positions.subarray(0, placed * 3),
    colors: colors.subarray(0, placed * 3),
    sizes: sizes.subarray(0, placed),
    count: placed,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/ring-particle-cloud.test.js`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add ring-particle-cloud.js tests/ring-particle-cloud.test.js
git commit -m "feat(F51): pure ring-particle baker (density-weighted, disk-thickness, tested)"
```

---

### Task 2: The cloud Points factory + shader

**Files:**
- Modify: `ring-particle-cloud.js` (add `makeRingCloudPoints` export)
- Test: `tests/ring-particle-cloud.test.js` (add a construction smoke test)

- [ ] **Step 1: Write the failing test (append to the describe block)**

```js
import { makeRingCloudPoints } from '../ring-particle-cloud.js';
import * as THREE from 'three';

describe('makeRingCloudPoints', () => {
  it('builds a THREE.Points with the baked attributes and LOD uniforms', () => {
    const baked = bakeRingCloud(PHYSICS, { count: 1000, R: 1, rng: seeded(11) });
    const pts = makeRingCloudPoints(baked, { dResolve: 4, dCull: 14, planetRadius: 1 });
    expect(pts).toBeInstanceOf(THREE.Points);
    expect(pts.geometry.getAttribute('position').count).toBe(baked.count);
    expect(pts.geometry.getAttribute('aColor').count).toBe(baked.count);
    expect(pts.geometry.getAttribute('aSize').count).toBe(baked.count);
    expect(pts.material.uniforms.uDResolve.value).toBe(4);
    expect(pts.material.uniforms.uDCull.value).toBe(14);
    expect(pts.material.transparent).toBe(true);
    expect(pts.material.depthWrite).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/ring-particle-cloud.test.js`
Expected: FAIL — `makeRingCloudPoints is not a function`.

- [ ] **Step 3: Add `makeRingCloudPoints` to `ring-particle-cloud.js`**

```js
/**
 * Build the near-tier point-sprite cloud as a THREE.Points.
 * Shader adapts src/objects/Galaxy.js but: NormalBlending (rings reflect, not emit —
 * additive would wash dense ringlets white), a camera-distance LOD ramp (full size
 * below dResolve, zero beyond dCull), per-particle analytic planet-shadow, and a
 * 6-level posterize so it sits inside the retro envelope.
 *
 * The cloud is centered on the planet (add it as a child of / sibling tilted with the
 * planet), so `position` is already relative to the planet center → the shadow test
 * mirrors the impostor's (planet-lod-lab.html:4676-4682).
 *
 * @param {object} baked - output of bakeRingCloud
 * @param {object} opts - { pointScale, dResolve, dCull, planetRadius, lightDir:[x,y,z], sizeClamp }
 */
export function makeRingCloudPoints(baked, opts = {}) {
  const {
    pointScale = 300,
    dResolve = 4,      // camera dist (object-space units, planet R=1): particles full size at/under this
    dCull = 14,        // camera dist: particles faded to zero beyond this → impostor alone
    planetRadius = 1,
    lightDir = [0.6, 0.35, 0.7],
    sizeClamp = 24.0,  // RT-pixel clamp so closest particles don't blow up into full-screen squares
  } = opts;

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(baked.positions, 3));
  geometry.setAttribute('aColor', new THREE.Float32BufferAttribute(baked.colors, 3));
  geometry.setAttribute('aSize', new THREE.Float32BufferAttribute(baked.sizes, 1));

  const material = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    // NormalBlending (default) — NOT additive.
    uniforms: {
      uTime: { value: 0 },
      uPointScale: { value: pointScale },
      uDResolve: { value: dResolve },
      uDCull: { value: dCull },
      uPlanetRadius: { value: planetRadius },
      uLightDir: { value: new THREE.Vector3(lightDir[0], lightDir[1], lightDir[2]).normalize() },
      uSizeClamp: { value: sizeClamp },
    },
    vertexShader: /* glsl */ `
      attribute vec3 aColor;
      attribute float aSize;
      uniform float uTime;
      uniform float uPointScale;
      uniform float uDResolve;
      uniform float uDCull;
      uniform float uPlanetRadius;
      uniform vec3 uLightDir;
      uniform float uSizeClamp;
      varying vec3 vColor;
      varying float vTwinkle;
      varying float vShadow;
      varying float vLod;
      void main() {
        vColor = aColor;
        vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mvPos;

        // LOD ramp: 1 when nearer than dResolve, 0 beyond dCull.
        float camDist = length(mvPos.xyz);
        float lod = 1.0 - smoothstep(uDResolve, uDCull, camDist);
        vLod = lod;

        float distScale = uPointScale / max(-mvPos.z, 1.0);
        float sz = aSize * distScale * lod;
        gl_PointSize = clamp(sz, 0.0, uSizeClamp);

        // Per-particle analytic planet-shadow (object space; position is relative to
        // planet center). Mirrors impostor planet-lod-lab.html:4676-4682.
        float shadowDist = length(cross(position, uLightDir));
        float behind = step(dot(position, uLightDir), 0.0);
        float inShadow = behind * (1.0 - smoothstep(uPlanetRadius * 0.9, uPlanetRadius * 1.1, shadowDist));
        vShadow = 1.0 - inShadow;

        float hash = fract(sin(dot(position.xz, vec2(12.9898, 78.233))) * 43758.5453);
        vTwinkle = 0.85 + 0.15 * sin(uTime * (0.1 + hash * 0.2) + hash * 6.28);
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec3 vColor;
      varying float vTwinkle;
      varying float vShadow;
      varying float vLod;

      float bayerDither(vec2 coord) {
        vec2 p = mod(floor(coord), 4.0);
        float t = 0.0;
        if (p.y < 0.5) {
          t = (p.x < 0.5) ? 0.0 : (p.x < 1.5) ? 8.0 : (p.x < 2.5) ? 2.0 : 10.0;
        } else if (p.y < 1.5) {
          t = (p.x < 0.5) ? 12.0 : (p.x < 1.5) ? 4.0 : (p.x < 2.5) ? 14.0 : 6.0;
        } else if (p.y < 2.5) {
          t = (p.x < 0.5) ? 3.0 : (p.x < 1.5) ? 11.0 : (p.x < 2.5) ? 1.0 : 9.0;
        } else {
          t = (p.x < 0.5) ? 15.0 : (p.x < 1.5) ? 7.0 : (p.x < 2.5) ? 13.0 : 5.0;
        }
        return t / 16.0;
      }
      vec3 posterize6(vec3 c, vec2 fc) {
        float dither = bayerDither(fc) - 0.5;
        vec3 d = c + dither * 0.4 / 6.0;
        return floor(d * 6.0 + 0.5) / 6.0;
      }

      void main() {
        float d = length(gl_PointCoord - 0.5);
        float alpha = 1.0 - smoothstep(0.0, 0.5, d);   // round glint
        alpha *= vTwinkle * vLod;
        vec3 color = vColor * mix(0.18, 1.0, vShadow); // dim in shadow
        alpha *= mix(0.2, 1.0, vShadow);               // shadowed particles go sparse → stars through

        float threshold = bayerDither(gl_FragCoord.xy);
        if (alpha < threshold) discard;                // dither-discard translucency

        color = posterize6(color, gl_FragCoord.xy);
        gl_FragColor = vec4(color, 1.0);
      }
    `,
  });

  return new THREE.Points(geometry, material);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/ring-particle-cloud.test.js`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add ring-particle-cloud.js tests/ring-particle-cloud.test.js
git commit -m "feat(F51): cloud Points factory + LOD/shadow/posterize point shader"
```

---

### Task 3: Harness scaffold (`rings-lod-lab.html`)

Standalone minimal scene to isolate the LOD-emergence mechanism. NO cloud yet — just prove the scene + planet + RT downscale + camera controls render clean on `:9223`.

**Files:**
- Create: `rings-lod-lab.html`

- [ ] **Step 1: Build the scaffold.** Model the boilerplate on `planet-lod-lab.html` lines 100-130 (renderer/scene/camera) and the RT downscale at 4697-4760. Contents:
  - `import * as THREE from 'three';` (bare import — Vite serves it, same as the lab).
  - `const R = 1.0;` planet radius. `const WORLD_LIGHT = new THREE.Vector3(0.6,0.35,0.7).normalize();`
  - A planet `new THREE.SphereGeometry(R, 128, 128)` with a simple `MeshBasicMaterial({color:0x335577})` (the harness is about the RING, not the planet surface — a plain sphere is enough to occlude/shadow against).
  - A directional-ish look: orient WORLD_LIGHT; no need for real lighting on the plain planet.
  - A small starfield backdrop (a `THREE.Points` of ~2000 random far points, or a dark background `scene.background = new THREE.Color(0x05060a)`) so dither-translucency against stars is checkable.
  - **Camera controls via GUI** (use the same lil-gui the lab imports, or plain DOM sliders): `state.distance` (1.1–30, default 12) and `state.pitch` (0=face-on … ~1.5=edge-on). Each frame, position the camera at distance/pitch around the planet looking at origin.
  - **RT downscale:** port `rebuildTarget()` + the render-to-target-then-blit from `planet-lod-lab.html:4697-4760`, with `state.pixelScale` (default 3). This makes the retro dither cell size faithful.
  - `window._rlab = { state, camera, scene, THREE }` for chrome-devtools `evaluate_script` control.

- [ ] **Step 2: Verify it loads clean.** Ask Max to confirm the Vite dev server is up on `:5173` (Claude cannot start it — `feedback_no-start-servers`). Load via chrome-devtools on `:9223`:
  - Load tools: `ToolSearch` → `select:mcp__chrome-devtools__list_pages,mcp__chrome-devtools__navigate_page,mcp__chrome-devtools__take_screenshot,mcp__chrome-devtools__evaluate_script,mcp__chrome-devtools__list_console_messages`
  - `navigate_page` → `http://localhost:5173/well-dipper/rings-lod-lab.html?fresh=1`
  - `list_console_messages` → expect ZERO errors.
  - `take_screenshot` → expect a plain planet sphere centered, dark space background.
  - Verify scale trap avoided: `evaluate_script` → `({iw: innerWidth, dpr: devicePixelRatio})` and confirm sane (per `memory/chrome-devtools-screenshot-scaling.md`).

- [ ] **Step 3: Commit**

```bash
git add rings-lod-lab.html
git commit -m "feat(F51): standalone rings-lod-lab harness scaffold (scene+planet+RT+camera)"
```

---

### Task 4: Port the v1 impostor into the harness (far tier)

**Files:**
- Modify: `rings-lod-lab.html`

- [ ] **Step 1: Port the impostor block.** Copy `planet-lod-lab.html:4456-4695` into the harness verbatim (the `RING_MAX_*` consts, `RING_COMPOSITION_COLORS`, `makeRingPhysics()`, the flatten loops, `ringUniforms`, `ringMat`, `ringGeo`, `ring` mesh, `scene.add(ring)`). It needs `generateRingPhysics` — add at top: `import { generateRingPhysics } from './src/generation/PhysicsEngine.js';` (verify the export name/path live first). Set `ring.visible = true` in the harness (always-on here). Keep `ringPhysics` in scope — Task 5 feeds it to the baker.

- [ ] **Step 2: Per-frame impostor light dir.** In the render loop, write the object-space light into `ringUniforms.lightDir.value` each frame (mirror `planet-lod-lab.html:7039` — copy `WORLD_LIGHT` transformed into the ring's local frame; for the harness with an un-rotated ring, `WORLD_LIGHT` directly is fine for first light).

- [ ] **Step 2.5: Run the unit tests** to confirm nothing regressed:

Run: `npx vitest run tests/ring-particle-cloud.test.js tests/planet-archetypes.test.js`
Expected: PASS (both suites unchanged).

- [ ] **Step 3: Verify the impostor renders.** On `:9223`, `navigate_page` (reload), `take_screenshot` at `state.distance=12` (set via `evaluate_script`: `window._rlab.state.distance = 12`). Expect the flat banded annulus (the v1 look — discrete ringlets + one dominant Cassini gap). `list_console_messages` → zero errors.

- [ ] **Step 4: Commit**

```bash
git add rings-lod-lab.html
git commit -m "feat(F51): port v1 impostor annulus into harness as far tier"
```

---

### Task 5: Add the LOD particle cloud (the crux — make-or-break gate)

**Files:**
- Modify: `rings-lod-lab.html`

- [ ] **Step 1: Build + add the cloud.** At top: `import { bakeRingCloud, makeRingCloudPoints } from './ring-particle-cloud.js';`. After the impostor `ring` is built:

```js
const ringBaked = bakeRingCloud(ringPhysics, {
  count: 80000, R: R, thickness: 0.02,
  // rng: pass a seeded fn if deterministic harness shots are wanted; Math.random is fine here
});
const ringCloud = makeRingCloudPoints(ringBaked, {
  pointScale: 300, dResolve: 4.0, dCull: 14.0, planetRadius: R,
  lightDir: [WORLD_LIGHT.x, WORLD_LIGHT.y, WORLD_LIGHT.z],
});
ringCloud.visible = true;
scene.add(ringCloud);  // centered on planet (origin), same frame as the impostor ring
```

- [ ] **Step 2: Per-frame updates.** In the render loop: `ringCloud.material.uniforms.uTime.value += dt;` (twinkle). The LOD ramp reads camera distance in-shader, so no per-frame CPU LOD write is needed. If the planet/ring is given an axial tilt later, also `ringCloud.quaternion.copy(ring.quaternion)`.

- [ ] **Step 3: Expose tuning knobs** on `window._rlab` so chrome-devtools `evaluate_script` can sweep them without reloads:

```js
window._rlab.ring = {
  cloud: ringCloud, impostor: ring, baked: ringBaked,
  setLOD(dResolve, dCull) {
    ringCloud.material.uniforms.uDResolve.value = dResolve;
    ringCloud.material.uniforms.uDCull.value = dCull;
  },
  setPointScale(s) { ringCloud.material.uniforms.uPointScale.value = s; },
};
```

- [ ] **Step 4: VISUAL GATE — verify the mechanism (the whole point of the harness).** On `:9223`, drive `evaluate_script` to set `window._rlab.state.distance` and screenshot at each:
  - **d=25 (far):** expect impostor-only — the cloud has faded to zero (beyond `dCull`). Should look like the v1 annulus. Save `shots/rings-lod-far-d25.png`.
  - **d=12 (mid):** cloud beginning to emerge over the impostor. Save `shots/rings-lod-mid-d12.png`.
  - **d=4 (resolve):** cloud full — the ring reads as a **dense field of individual glinting particles** with depth, NOT a flat band. Save `shots/rings-lod-near-d4.png`. **This is the shot that must beat v1's rejection.**
  - **Approach sweep d=20→4 in ~5 steps:** confirm NO pop / NO dissolve — detail emerges smoothly while the impostor is continuously present underneath.
  - **Shadow:** top-down-ish pitch → confirm the planet-shadow bite sweeps the particle cloud (shadowed arc goes sparse, stars through). Save `shots/rings-lod-shadow.png`.
  - **Edge-on (pitch≈1.5):** confirm the disk thickness reads (particles spread in depth) and no aggressive shimmer. Save `shots/rings-lod-edgeon.png`.

- [ ] **Step 5: Tune within 3 cycles** (`feedback_think-before-acting` / 3-cycle cap). Knobs: `count` (density), `dResolve`/`dCull` (transition band), `pointScale` + `sizeClamp` (particle size in RT pixels), `thickness` (depth read). **Decision gate:** if 80k static points cannot reach "resolves as individual particles" at d=4 even at max sane `pointScale`, STOP and escalate to the recycled-proximity-patch variant (spec §"Budget strategy + escalation path") — document the decision in the card before building it. Do NOT build recycling speculatively.

- [ ] **Step 6: Commit**

```bash
git add rings-lod-lab.html
git commit -m "feat(F51): LOD particle cloud in harness — emerges to resolved particles on approach"
```

---

### Task 6: Harness verdict gate (Max checkpoint)

- [ ] **Step 1: Surface the harness shots to Max** (Windows-pasteable paths per `feedback_windows-pasteable-paths`: `\\wsl.localhost\Ubuntu\home\ax\projects\well-dipper\docs\FEATURES\cards\shots\rings-lod-*.png`). Specifically the d=4 resolved shot vs the v1 baseline (`docs/FEATURES/cards/shots/F51-faceon-tuned.png`).
- [ ] **Step 2: GATE.** Proceed to integration (Task 7) ONLY if the mechanism reads as genuine-3D-resolving-to-particles in isolation. If it doesn't, iterate the harness (back to Task 5) or escalate. **Do not integrate a mechanism that failed in isolation** (`memory/Response-Start-Protocol` step 4 — isolated harness must work before production integration).

---

### Task 7: Integrate into `planet-lod-lab.html`

Only after Task 6 passes. Port the proven cloud alongside the existing impostor `ring`.

**Files:**
- Modify: `planet-lod-lab.html`

- [ ] **Step 1: Import the module.** Near the top imports, add `import { bakeRingCloud, makeRingCloudPoints } from './ring-particle-cloud.js';`.

- [ ] **Step 2: Build the cloud after the impostor mesh.** Immediately after `scene.add(ring);` (`planet-lod-lab.html:4695`), insert the bake + `makeRingCloudPoints` + `scene.add(ringCloud)` block (same as harness Task 5 Step 1), using the lab's `ringPhysics`, `R`, and `WORLD_LIGHT`. Set `ringCloud.visible = false` (the toggle drives it).

- [ ] **Step 3: Per-frame in the lab render loop** (near the impostor's `ring.visible` write at `planet-lod-lab.html:7039-7040`): add
  ```js
  ringCloud.visible = !!state.ringsEnabled;
  ringCloud.material.uniforms.uTime.value += dt; // use the lab's existing per-frame delta
  ringCloud.quaternion.copy(ring.quaternion);    // tilt with the ring/planet
  ringCloud.material.uniforms.uLightDir.value.copy(ringUniforms.lightDir.value);
  ```
  (The existing `state.ringsEnabled` checkbox + `window._lab.rings()` now drive BOTH impostor and cloud.)

- [ ] **Step 4: Verify in the lab on :9223.** Reload `http://localhost:5173/well-dipper/planet-lod-lab.html?fresh=1`, `window._lab.rings(true)`, repeat the Task-5 distance sweep (`window._lab.state.distance` — lab range 1.1–30). Confirm same behavior as the harness: far impostor → near resolved particles, no pop, shadow sweep, edge-on stable. Save lab shots to `docs/FEATURES/cards/shots/F51-v2-*.png`.

- [ ] **Step 5: Run the full test suite** — must pass UNCHANGED (no FEATURES/PROVINCES edits):

Run: `npx vitest run tests/planet-archetypes.test.js tests/ring-particle-cloud.test.js`
Expected: PASS, planet-archetypes.test.js identical to before.

- [ ] **Step 6: Commit (code)**

```bash
git add planet-lod-lab.html ring-particle-cloud.js tests/ring-particle-cloud.test.js rings-lod-lab.html
git commit -m "feat(F51): integrate 3D LOD particle ring into planet-lod-lab (v2 substrate)"
# grab the sha for the doc commit
git rev-parse --short HEAD
```

---

### Task 8: Verdict + docs

**Files:**
- Modify: `docs/FEATURES/cards/F51-rings.md` (§6.5 + §7)
- Modify: `docs/FEATURES/planet-lod-campaign-tracker.md` (F51 row + phase row)

- [ ] **Step 1: Rewrite card §6.5** to describe the v2 substrate (two-tier impostor+cloud, Approach B), linking the spec + this plan. Keep the v1 §6.5 content as a labeled "v1 (superseded)" subsection for history.
- [ ] **Step 2: Append a v2 entry to card §7** — the verdict (🟢/🟡 with evidence + the `F51-v2-*.png` shot filenames), stamping the code commit sha from Task 7. Mark `VERIFIED_PENDING_MAX <sha>` (integration green; UAT is Max's gate alone — `~/.claude/docs/dev-collab-os.md`). Do NOT mark Shipped.
- [ ] **Step 3: Update the tracker** — F51 row from `🔁 v1 rejected` to `✅ v2 VERIFIED_PENDING_MAX <sha>`; update the phase-4c row to note F51 rework closed (F38/F39 still open).
- [ ] **Step 4: Confirm clean tree on campaign paths.**

Run: `git status --porcelain planet-lod-lab.html ring-particle-cloud.js rings-lod-lab.html docs/FEATURES`
Expected: no output.

- [ ] **Step 5: Commit (docs)**

```bash
git add docs/FEATURES/cards/F51-rings.md docs/FEATURES/planet-lod-campaign-tracker.md
git commit -m "docs(F51): v2 verdict + tracker — 3D LOD particle ring VERIFIED_PENDING_MAX"
```

---

## Self-review (done at plan-writing time)

- **Spec coverage:** two-tier architecture (T1,2,4,5,7) ✓; Approach-B emergence ramp (T2 shader, T5 gate) ✓; density-from-physics baker (T1) ✓; disk thickness (T1) ✓; point-sprite reuse of Galaxy idiom (T2) ✓; retro envelope posterize+dither (T2) ✓; per-particle planet shadow (T2) ✓; RT-downscale clamp (T2 `uSizeClamp`, T5 tune) ✓; isolated harness first (T3-6) ✓; integration (T7) ✓; npm test unchanged (T4.2.5, T7.5) ✓; verdict/docs (T8) ✓; budget escalation path (T5 step 5 decision gate) ✓.
- **Out-of-scope respected:** no collision/gameplay, no hero meshes, no src/ production integration, no new preset, no TSL. ✓
- **Type consistency:** `bakeRingCloud`→`{positions,colors,sizes,count}` used identically in T1/T2/T5/T7; `makeRingCloudPoints(baked, opts)` opts keys (`pointScale,dResolve,dCull,planetRadius,lightDir,sizeClamp`) consistent across T2/T5/T7; uniform names (`uTime,uPointScale,uDResolve,uDCull,uPlanetRadius,uLightDir,uSizeClamp`) consistent shader↔factory↔per-frame writes. ✓
- **Placeholder scan:** none — baker, shader, factory, tests are complete code; visual tasks have explicit acceptance criteria + shot filenames. Port tasks (T3,T4) reference exact line ranges rather than re-inlining 240 lines of harness boilerplate, which is appropriate (the engineer copies live code, not invented code).
