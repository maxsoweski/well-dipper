# Planet Rendering Foundation (Stage A) — Build Plan

> # ⛔ STATUS: COMPLETE & SUPERSEDED — DO NOT EXECUTE
> **Stage A is fully built and committed** (Tasks 1–7, on `master` and on the
> `planet-rendering-foundation` branch). The work has moved well past this:
> **Stage B research is done** (`research/stage-b/`) and we are now in **Stage C
> implementation** (Relief domain). **Do not treat this file as a to-do.**
>
> **➡️ The single source of truth for "where are we / what's next" is
> `research/stage-c/STATUS-stage-c-2026-06-06.md`.** Read that, not this.
> This file is retained only as the historical record of how Stage A was built.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task (Inline Execution — NOT subagent-driven; see spec §6: one coupled shader + one HTML file, live eyes-on verification). Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Land the Stage-A planet-rendering foundation in the isolated lab harness `planet-lod-lab.html` — lil-gui control shell, plumbed `lodRamp` uniform + hysteresis, a tunable envelope composite-split, and the driver→semantic-uniform scaffolding (+ `qualityTier`) that every Stage-B feature plugs into.

**Architecture:** The lab is one HTML file (renderer + GLSL shader + UI). Pure CPU-side foundation math (lodRamp, hysteresis, qualityTier knobs, driver→uniform derivation) is extracted into a sibling ES module `planet-lod-lab-core.js` imported by **both** the HTML and a vitest test — this is the code that later grafts into production `PlanetGenerator`, so it earns real unit tests. The shader and UI wiring stay in the HTML and are verified visually through chrome-devtools on the GPU Chrome at `:9223`. No production `src/` files are touched this session (harness-first).

**Tech Stack:** three.js r183.1 (ShaderMaterial, WebGL2, `fwidth`), lil-gui 0.21.0 (bare import via Vite), vitest 4.1.0 (`npm test`), chrome-devtools MCP `:9223` for live visual verification.

---

## Spec & grounding (read before starting)

- **Approved spec:** `docs/superpowers/specs/2026-06-06-planet-rendering-foundation-design.md` (Parts 1 & 2, build sequence §5). Do not re-derive decisions.
- **Feature accounting:** `docs/FEATURES/planet-visual-features.md`. **Research:** `research/RESEARCH_high-lod-planet-shaders-2026-06-05.md`.
- **Current lab state (already present from the design session):** `planet-lod-lab.html` already contains the IQ analytic-gradient `noised()` (value + analytic gradient), variable-octave `fbmd()` with trailing-octave fade + `fwidth` clamp, `perturbAnalytic`, the analytic↔finite-diff A/B toggle (`uNormalMode`), the faithful low-res retro blit (`pixelScale` ÷3), pointer-orbit + wheel-zoom camera, per-layer macro/detail seed steppers, and `window._lab`. **Spec §5 steps 2 & 4 are therefore largely implemented** — Tasks 2 and 4 below are *validation*, not build.
- **Driver precedent (the pattern Task 6 generalizes):** `src/generation/PlanetGenerator.js:435-487` derives aurora `fieldStrength = composition.ironFraction * (isLocked ? 0.2 : 1.0)` and color from atmospheric composition — physics → semantic params, CPU-side, no `planetType` branch. Driver fields produced by the generator: `composition.{ironFraction,density}`, `T_eq`, `tidalState.{locked,lockType}`, `atmosphere|null`, `habitability` (`habScore`), `surfaceHistory`, `axialTilt`, `rotationSpeed`.

## Working discipline (carry-forward, every task)

- **Do NOT start servers.** Max runs Vite. Live verification = chrome-devtools MCP `:9223` (`mcp__chrome-devtools__*`), NOT Playwright. Launch the 2nd Chrome per `memory/chrome-devtools-9223-launch.md`. Entry/inventory per `memory/well-dipper-testing-reference.md`.
- **Sandbox:** Bash curl/wget to `:9223`/`:5173` returns `000`/refused even when up — check liveness with `mcp__chrome-devtools__list_pages`, never Bash.
- **Commit hygiene:** the working tree has UNRELATED uncommitted changes (`src/main.js`, `tests/orbit-ring-rebase.test.js`) from the parallel screensaver/warp workstream. **Never `git add -A`.** Stage only this build's files by explicit path: `planet-lod-lab.html`, `planet-lod-lab-core.js`, `tests/planet-lod-foundation.test.js`. Do NOT touch `docs/NOW.md` or the `system-tags-save-search` branch.
- **3-cycle cap** on any mechanism that fails research→implement→test 3×. Likeliest cap-hit: envelope dither-mode banding at high levels.
- Tone: zero affirmations; flag risk/uncertainty up front; re-anchor to spec §0 (NO parity-with-old goal) before scoping.

## Preflight (before Task 1)

- [ ] **P1: Confirm GPU Chrome `:9223` + Vite are up.** Run `mcp__chrome-devtools__list_pages`. If it fails, STOP and ask Max to (a) run the Vite dev server and (b) launch the 2nd Chrome per `memory/chrome-devtools-9223-launch.md`. Do not proceed to visual steps without it.
- [ ] **P2: Confirm the lab loads today.** Navigate `:9223` to the lab URL (`http://localhost:5173/planet-lod-lab.html`, port per Max's Vite). `mcp__chrome-devtools__list_console_messages` → expect no shader-compile errors. `evaluate_script`: `return Object.keys(window._lab)` → expect `state, uniforms, planet, camera, lodRampOf, autoOctaves, rebuildTarget, settingsBlob, applySettings, sceneTarget`.
- [ ] **P3: Capture the pre-build baseline screenshot** (`mcp__chrome-devtools__take_screenshot`, save `screenshots/planet-foundation-00-baseline-prebuild.png`) at default state — this is the regression reference for Task 1.

---

## File Structure

- **Create `planet-lod-lab-core.js`** (repo root, beside the HTML) — pure CPU foundation math, zero three.js/DOM deps. Exports: `smoothstep`, `lodRampOf`, `autoOctaves`, `lodHysteresis`, `qualityKnobs`, `deriveUniforms`, helpers `clamp01`, `mix`. Imported by the HTML (`import { ... } from './planet-lod-lab-core.js'`) and by the test (DRY — one source of truth for the math).
- **Create `tests/planet-lod-foundation.test.js`** — vitest unit tests for `planet-lod-lab-core.js`.
- **Modify `planet-lod-lab.html`** — (Task 1) replace hand-rolled `<div class="row">` controls with lil-gui folders; import the core module; (Task 3) plumb `uLodRamp`; (Task 5) envelope composite-split shader + `▸ Envelope` folder; (Task 6) wire `deriveUniforms` + driver-bundle presets; (Task 7) clouds/aurora on `noised()`.

---

## Task 1: lil-gui migration (pure framework swap — regression-verify identical render)

**Files:**
- Modify: `planet-lod-lab.html` (controls block `:97-113`, all `bindRange`/`bindToggle`/seed/`reset`/`copy` wiring `:447-599`, help overlay `:667-702`)
- Create: `planet-lod-lab-core.js` (move `smoothstep`, `lodRampOf`, `autoOctaves` out of the inline script)

- [ ] **Step 1: Create the core module with the existing math (no behavior change).**

```js
// planet-lod-lab-core.js
// Pure CPU-side foundation math for the Planet LOD Lab.
// Imported by planet-lod-lab.html AND tests/planet-lod-foundation.test.js (DRY).
// No three.js / DOM deps — keep it unit-testable in node/vitest.

export const clamp01 = (x) => Math.min(1, Math.max(0, x));
export const mix = (a, b, t) => a + (b - a) * t;

export function smoothstep(e0, e1, x) {
  const t = clamp01((x - e0) / (e1 - e0));
  return t * t * (3 - 2 * t);
}

// lodRamp: 0 (far) → 1 (closest). e0 > e1 (descending) — detail RISES as distance shrinks.
export function lodRampOf(distanceRadii) {
  return smoothstep(20.0, 6.0, distanceRadii);
}

// Octave budget ramps with lodRamp: mix(4,9,lodRamp), then trimmed by qualityTier (0..1).
export function autoOctaves(lodRamp, qualityTier = 1.0) {
  const full = mix(4.0, 9.0, lodRamp);
  return mix(4.0, full, qualityTier); // qualityTier<1 trims the LOD2 octaves on weak GPUs
}
```

- [ ] **Step 2: In `planet-lod-lab.html`, import the core and delete the now-duplicated inline defs.** At the top of the `<script type="module">` add `import { smoothstep, lodRampOf, autoOctaves } from './planet-lod-lab-core.js';` and remove the inline `smoothstep` (`:440-443`), `lodRampOf` (`:444`), `autoOctaves` (`:445`). Leave the rest untouched for this step. (Verify in P-step below that the planet still renders before touching controls — fail fast on the import.)

- [ ] **Step 3: Add lil-gui import and build the folder shell.** Add `import GUI from 'lil-gui';`. Replace the entire `<div id="controls">` block (`:97-113`) — delete it. After `state` is defined, construct the GUI. Folders per spec §3, collapsed except `View & LOD` and `Envelope` (the active surfaces this session):

```js
const gui = new GUI({ title: 'PLANET LOD LAB — foundation' });

// ▸ View & LOD (always open)
const fView = gui.addFolder('View & LOD'); fView.open();
fView.add(state, 'distance', 1.1, 30, 0.1).name('distance (radii)').listen();
fView.add(state, 'octaves', 1, 9, 0.1).name('octaves (manual)').listen();
fView.add(state, 'octAuto').name('octaves AUTO (lodRamp)');
fView.add(state, 'fwClamp').name('fwidth clamp');
fView.add(state, 'pixelScale', 1, 6, 1).name('pixelScale ÷').onChange(() => rebuildTarget());
fView.add(state, 'normalMode', { ANALYTIC: 0, 'FINITE-DIFF': 1 }).name('normals');
fView.add(state, 'spin').name('spin');

// ▸ Surface — Relief
const fRelief = gui.addFolder('Surface — Relief'); fRelief.close();
fRelief.add(state, 'perturb', 0, 1.5, 0.01).name('perturb (relief)');

// ▸ Seeds
const fSeeds = gui.addFolder('Seeds'); fSeeds.close();
fSeeds.add(state, 'macroSeed', 0, 10000, 1).name('macro seed').listen().onChange(updateSeedUniforms);
fSeeds.add(state, 'detailSeed', 0, 10000, 1).name('detail seed').listen().onChange(updateSeedUniforms);
fSeeds.add({ newPlanet(){ state.macroSeed = (Math.random()*10000)|0; state.detailSeed = (Math.random()*10000)|0; updateSeedUniforms(); } }, 'newPlanet').name('New planet (re-roll both)');

// ▸ Presets (lil-gui save/load)
const fPresets = gui.addFolder('Presets'); fPresets.close();
fPresets.add({ copy(){ const j = JSON.stringify(gui.save()); window._lab._lastCopied = j; navigator.clipboard?.writeText(j).catch(()=>{}); } }, 'copy').name('Copy settings (JSON)');
fPresets.add({ reset(){ gui.reset(); } }, 'reset').name('Reset');
```

- [ ] **Step 4: Make state-driven controls write through to uniforms each frame (they already do — confirm the `frame()` block `:630-635` reads `state.*`).** lil-gui mutates `state` in place via `add(state, key, ...)`, so the existing per-frame `uniforms.*.value = state.*` lines keep working unchanged. The `normalMode` dropdown sets `state.normalMode` to `0`/`1` directly (no separate toggle handler). Delete the old `bindRange`/`bindToggle`/manual seed-button/`$('reset')`/`$('copy')` wiring (`:447-599`) and the `$` helper if now unused. Keep `updateSeedUniforms`, `seedOffset`, `settingsBlob`/`applySettings` (still referenced by `_lab`).

- [ ] **Step 5: Keep the `?` help overlay** (`:667-703`) — it documents the lab and is read-only; lil-gui's own `.name()` labels supplement it. No change required, but verify the help button still opens.

- [ ] **Step 6: Verify the import + render headlessly first (cheap fail-fast).** Run `node -e "import('./planet-lod-lab-core.js').then(m => console.log(typeof m.lodRampOf, m.lodRampOf(20).toFixed(3), m.autoOctaves(1).toFixed(1)))"`. Expected: `function 0.000 9.0`. (Catches a broken module before involving the browser.)

- [ ] **Step 7: VISUAL REGRESSION via `:9223`.** Reload `planet-lod-lab.html`. `list_console_messages` → no errors. `take_screenshot` → `screenshots/planet-foundation-01-postmigration.png`. **Acceptance:** render is visually identical to `planet-foundation-00-baseline-prebuild.png` (same planet, same dither, same lighting) — this is a pure framework swap, pixels must match. `evaluate_script: return Object.keys(window._lab)` still returns the full API. Drag/zoom/seed-step/preset-save all still function (spot-check 2-3 via clicks).

- [ ] **Step 8: Commit.**

```bash
git add planet-lod-lab.html planet-lod-lab-core.js
git commit -m "feat(planet-lab): migrate controls to lil-gui folders + extract core math module"
```

---

## Task 2: VALIDATE analytic `noised()` swap (already implemented — spec §5 step 2)

**Files:** none expected (validation). The analytic stack (`noised` `:259-293`, `fbmd` `:298-320`, `perturbAnalytic` `:322-328`) is present.

- [ ] **Step 1: A/B at LOD1 (low detail).** Via `:9223`, set `window._lab.state.distance = 20; state.octaves = 4; state.octAuto = false;`. Screenshot analytic (`state.normalMode = 0`) → `screenshots/planet-foundation-02a-analytic-lod1.png`. Screenshot finite-diff (`state.normalMode = 1`) → `02b-finitediff-lod1.png`.
- [ ] **Step 2: Acceptance (eyes-on).** Analytic and finite-diff agree on overall relief shape at LOD1, AND analytic carries relief across the FULLY-LIT face where finite-diff goes flat (finite-diff only shows relief near the terminator). No popping/seams on the analytic sphere. If analytic shows seams or NaN speckle → that's a real bug; debug per `systematic-debugging` (3-cycle cap) before continuing. Otherwise record "validated" and move on.
- [ ] **Step 3:** No commit (no change) unless a fix was needed.

---

## Task 3: `lodRamp` uniform + hysteresis (the genuine dead-`lodLevel` gap-fill — spec §5 step 3, §2.B)

**Files:**
- Modify: `planet-lod-lab-core.js` (add `lodHysteresis`)
- Create/modify: `tests/planet-lod-foundation.test.js` (hysteresis + lodRamp tests)
- Modify: `planet-lod-lab.html` (add `uLodRamp` uniform; shader uses it to scale detail amplitude; HUD shows hysteresis flag)

- [ ] **Step 1: Write the failing tests.**

```js
// tests/planet-lod-foundation.test.js
import { describe, it, expect } from 'vitest';
import { lodRampOf, autoOctaves, lodHysteresis } from '../planet-lod-lab-core.js';

describe('lodRampOf', () => {
  it('is 0 at/over the far edge (>=20 radii)', () => {
    expect(lodRampOf(20)).toBe(0);
    expect(lodRampOf(30)).toBe(0);
  });
  it('is 1 at/under the near edge (<=6 radii)', () => {
    expect(lodRampOf(6)).toBe(1);
    expect(lodRampOf(1.1)).toBe(1);
  });
  it('rises monotonically as distance shrinks', () => {
    expect(lodRampOf(10)).toBeGreaterThan(lodRampOf(15));
  });
});

describe('autoOctaves', () => {
  it('is 4 at far (lodRamp 0)', () => expect(autoOctaves(0)).toBe(4));
  it('is 9 at near (lodRamp 1, full quality)', () => expect(autoOctaves(1, 1.0)).toBe(9));
  it('trims LOD2 octaves at low qualityTier', () => {
    expect(autoOctaves(1, 0.0)).toBe(4);          // no LOD2 octaves on weakest GPU
    expect(autoOctaves(1, 0.5)).toBeCloseTo(6.5); // half the ramp
  });
});

describe('lodHysteresis (enter 18 / exit 22 radii)', () => {
  it('activates only inside 18 when previously inactive', () => {
    expect(lodHysteresis(19, false)).toBe(false); // in dead-band, stays off
    expect(lodHysteresis(17, false)).toBe(true);  // crossed enter threshold
  });
  it('stays active through the dead-band until past 22', () => {
    expect(lodHysteresis(20, true)).toBe(true);   // in dead-band, holds on
    expect(lodHysteresis(23, true)).toBe(false);  // crossed exit threshold
  });
  it('has a non-flickering dead-band: same distance, opposite states', () => {
    expect(lodHysteresis(20, true)).toBe(true);
    expect(lodHysteresis(20, false)).toBe(false);
  });
});
```

- [ ] **Step 2: Run to verify failure.** Run: `npx vitest run tests/planet-lod-foundation.test.js`. Expected: FAIL — `lodHysteresis is not a function`.

- [ ] **Step 3: Implement `lodHysteresis` in `planet-lod-lab-core.js`.**

```js
// Hysteresis on the discrete "is this body LOD2-active" flag.
// enter at 18 radii, exit at 22 radii — the 4-radius dead-band kills boundary flicker.
// prevActive: the flag's previous value. Returns the new flag.
export function lodHysteresis(distanceRadii, prevActive) {
  if (prevActive) return distanceRadii < 22.0; // stay active until we retreat past 22
  return distanceRadii < 18.0;                  // only activate once we're inside 18
}
```

- [ ] **Step 4: Run to verify pass.** Run: `npx vitest run tests/planet-lod-foundation.test.js`. Expected: PASS (9 tests).

- [ ] **Step 5: Plumb `uLodRamp` into the shader.** In `planet-lod-lab.html`: add `uLodRamp: { value: 0.0 }` to `uniforms` (`:355-366`); add `uniform float uLodRamp;` to the fragment shader (`:151-160`); in `fbmd`'s use site, scale detail amplitude by lodRamp so "one scalar drives all complexity" (spec §2.B) — change the analytic-path block (`:337-342`) to multiply `uPerturb` by `mix(0.7, 1.0, uLodRamp)` (relief amplitude grows with approach):

```glsl
// analytic path, replacing the perturbAnalytic call site
float fwBase = max(max(fwidth(vPos.x), fwidth(vPos.y)), fwidth(vPos.z));
vec4 hd = fbmd(vPos, uOctaves, fwBase);
float reliefAmp = uPerturb * mix(0.7, 1.0, uLodRamp);
shadeN = perturbAnalytic(N, hd.yzw, reliefAmp);
```

- [ ] **Step 6: Drive `uLodRamp` + the hysteresis flag from `frame()`.** In `planet-lod-lab.html`, import `lodHysteresis`. In `frame()` (`:609-651`): `const lod = lodRampOf(state.distance);` already exists — add `uniforms.uLodRamp.value = lod;`. Track the flag across frames: `state._lod2Active = lodHysteresis(state.distance, state._lod2Active ?? false);`. Add a HUD line: `lod2 flag : ${state._lod2Active ? 'ACTIVE' : 'off'}`.

- [ ] **Step 7: VISUAL via `:9223`.** Reload. Zoom from 30→1.1 and back. **Acceptance:** relief visibly deepens on approach (amplitude grows with lodRamp), and the `lod2 flag` HUD line flips to ACTIVE only inside ~18 radii and back to off only past ~22 (watch it NOT flicker when hovering near 20). Screenshot near + far → `03a-near-lodramp.png`, `03b-far.png`.

- [ ] **Step 8: Commit.**

```bash
git add planet-lod-lab-core.js tests/planet-lod-foundation.test.js planet-lod-lab.html
git commit -m "feat(planet-lab): plumb uLodRamp uniform + hysteresis flag (TDD'd)"
```

---

## Task 4: VALIDATE variable-octave FBM + `fwidth` clamp (already implemented — spec §5 step 4)

**Files:** none expected (validation). `fbmd` `:298-320` already does variable octaves (`if (float(i) >= octaves) break`), trailing-octave fade (`w = clamp(octaves - float(i), 0, 1)`), and the `fwidth` clamp.

- [ ] **Step 1: fwidth-clamp A/B at distance.** Via `:9223`, set `state.distance = 25` (far, octaves auto-ramps low but the far side is sub-pixel). Screenshot clamp ON (`state.fwClamp = true`) → `04a-clamp-on.png`; clamp OFF (`state.fwClamp = false`) → `04b-clamp-off.png`.
- [ ] **Step 2: Acceptance.** Clamp OFF shows shimmer/aliasing crawl on the far/grazing side under the dither; clamp ON is clean (sub-pixel octaves faded to mean). Octave count (HUD `octaves(eff)`) ramps 4→9 as you zoom 20→6. If clamp ON still shimmers → real bug, debug (3-cycle cap). Otherwise record "validated."
- [ ] **Step 3:** No commit unless a fix was needed.

---

## Task 5: Envelope composite-split + `▸ Envelope` folder (spec §5 step 5, §2.C — the A/B/C decision surface)

**Files:**
- Modify: `planet-lod-lab.html` (shader final-composite split `:344-351`; new uniforms; `▸ Envelope` lil-gui folder; IGN dither fn)

The §4 **tracked open goal** lives here: this task delivers the *controls*; settling values per body type is downstream Max playtesting — do NOT pre-commit envelope values.

- [ ] **Step 1: Add the envelope uniforms** to `uniforms` (`:355-366`):

```js
uPosterizeLevels: { value: 6.0 },   // rename of uLevels concept; slider 6→16
uDitherMode:      { value: 0 },      // 0 = Bayer, 1 = IGN/triangular
uEmissive:        { value: 0.0 },    // emissive glow strength (lava/hot bodies)
uSpecStrength:    { value: 0.0 },    // specular glint (ocean/ice)
uLimbStrength:    { value: 0.0 },    // limb/atmosphere rim glow
uEmissiveBypass:  { value: 0 },      // 1 = this term skips the quantizer
uSpecBypass:      { value: 0 },
uLimbBypass:      { value: 0 },
```

Keep `uLevels` as an alias or migrate `state.levels`→`state.posterizeLevels` (rename the state key + the frame() write). Use `uPosterizeLevels` everywhere `uLevels` was read.

- [ ] **Step 2: Add an IGN (interleaved-gradient-noise) dither** beside `bayerDither` in the shader (`:210-219`). IGN gives a finer, less-grid-patterned dither needed when levels are pushed high (spec §2.C):

```glsl
// Interleaved Gradient Noise (Jimenez 2014) — finer than Bayer at high level counts.
float ignDither(vec2 coord){
  return fract(52.9829189 * fract(dot(coord, vec2(0.06711056, 0.00583715))));
}
float ditherVal(vec2 coord, int mode){
  return (mode == 1) ? ignDither(coord) : bayerDither(coord);
}
```

Change `posterize` to take the mode:

```glsl
vec3 posterize(vec3 color, float levels, vec2 fragCoord, float edgeWidth, int mode){
  float dither = ditherVal(fragCoord, mode) - 0.5;
  vec3 dithered = color + dither * edgeWidth / levels;
  return floor(dithered * levels + 0.5) / levels;
}
```

- [ ] **Step 3: Split the final composite** in `main()` (`:344-351`). Compute the three envelope terms, each routed through the quantizer OR bypassed (spec §2.C: a bypassed term skips quantization → smooth glow over the posterized surface):

```glsl
// ── Surface (posterized) ──
float diff = max(dot(shadeN, uLightDir), 0.0);
vec3 surface = uBaseColor * (diff + 0.035);
surface = posterize(min(surface, vec3(1.0)), uPosterizeLevels, gl_FragCoord.xy, 0.4, uDitherMode);

// ── Emissive glow (lava/hot) — Lambert-independent ──
vec3 emissive = uBaseColor * uEmissive;
emissive = (uEmissiveBypass == 1) ? emissive
         : posterize(emissive, uPosterizeLevels, gl_FragCoord.xy, 0.4, uDitherMode);

// ── Specular glint (ocean/ice) — Blinn-Phong against the light ──
vec3 V = normalize(cameraPosition - vPos);     // cameraPosition is object-space here (planet quat = identity)
vec3 H = normalize(uLightDir + V);
float spec = pow(max(dot(shadeN, H), 0.0), 48.0) * uSpecStrength * step(0.0, diff);
vec3 specC = vec3(spec);
specC = (uSpecBypass == 1) ? specC
      : posterize(specC, uPosterizeLevels, gl_FragCoord.xy, 0.4, uDitherMode);

// ── Limb / atmosphere rim glow (fresnel) ──
float limb = pow(1.0 - max(dot(N, V), 0.0), 3.0) * uLimbStrength * (diff + 0.15);
vec3 limbC = uBaseColor * limb;
limbC = (uLimbBypass == 1) ? limbC
      : posterize(limbC, uPosterizeLevels, gl_FragCoord.xy, 0.4, uDitherMode);

gl_FragColor = vec4(min(surface + emissive + specC + limbC, vec3(1.0)), 1.0);
```

> Note: `cameraPosition` is a three.js built-in uniform in object space when the mesh transform is identity (the lab keeps `planet.quaternion` identity — see camera comment `:528-530`). If the view vector looks wrong, pass an explicit `uCamPos` object-space uniform instead (set from `camera.position` each frame, since the planet is at the origin un-rotated).

- [ ] **Step 4: Add the `▸ Envelope` folder** (open) in the GUI block. The state object needs the new keys (`posterizeLevels`, `ditherMode`, `emissive`, `specStrength`, `limbStrength`, `emissiveBypass`, `specBypass`, `limbBypass`):

```js
const fEnv = gui.addFolder('Envelope'); fEnv.open();
fEnv.add(state, 'posterizeLevels', 6, 16, 1).name('posterize levels');
fEnv.add(state, 'ditherMode', { Bayer: 0, 'IGN/triangular': 1 }).name('dither mode');
fEnv.add(state, 'emissive', 0, 1, 0.01).name('emissive (lava)');
fEnv.add(state, 'specStrength', 0, 1, 0.01).name('specular (ocean/ice)');
fEnv.add(state, 'limbStrength', 0, 1, 0.01).name('limb glow');
fEnv.add(state, 'emissiveBypass').name('emissive bypass quantizer');
fEnv.add(state, 'specBypass').name('spec bypass quantizer');
fEnv.add(state, 'limbBypass').name('limb bypass quantizer');
```

Write all eight through to uniforms in `frame()`.

- [ ] **Step 5: VISUAL via `:9223`** — verify each term independently. Reload; check no compile errors. Then, one at a time:
  - posterizeLevels 6→16: banding softens; at 16 with Bayer the grid may show → switch dither to IGN → cleaner. Screenshot `05a-levels16-bayer.png`, `05b-levels16-ign.png`.
  - emissive 0→1: a glow that does NOT vanish on the dark side (Lambert-independent). `05c-emissive.png`.
  - specStrength 0→1: a moving highlight where light reflects toward camera; orbit to confirm it tracks. `05d-spec.png`.
  - limbStrength 0→1: a rim glow at the silhouette edge. `05e-limb.png`.
  - bypass toggles: with a term at high strength, toggling its bypass switches it between hard-banded and smooth. `05f-bypass-ab.png`.
  - **Acceptance:** all four terms are independently visible and controllable; bypass visibly changes quantization; the surface alone (all extras 0) matches the Task-1 look. This is the A/B/C surface — leave values at 0 defaults (tracked-open goal).

- [ ] **Step 6: Commit.**

```bash
git add planet-lod-lab.html
git commit -m "feat(planet-lab): envelope composite-split (emissive/spec/limb + bypass + IGN dither) and ▸ Envelope folder"
```

---

## Task 6: Driver → semantic-uniform scaffolding + `qualityTier` (spec §5 step 6, §2.D/E — the generation-side foundation)

**Files:**
- Modify: `planet-lod-lab-core.js` (`qualityKnobs`, `deriveUniforms`)
- Modify: `tests/planet-lod-foundation.test.js` (derivation + qualityTier tests)
- Modify: `planet-lod-lab.html` (`▸ Drivers` folder + driver-bundle presets; apply `deriveUniforms` output to uniforms)

This is the production-coupled piece: the lab proves the pattern (`drivers → deriveUniforms → semantic uniforms`, no `planetType` branch) that later grafts into `PlanetGenerator`. The driver schema mirrors `PlanetGenerator.js` real fields.

- [ ] **Step 1: Write the failing tests.**

```js
// append to tests/planet-lod-foundation.test.js
import { qualityKnobs, deriveUniforms } from '../planet-lod-lab-core.js';

describe('qualityKnobs (graceful-mobile scalar)', () => {
  it('full desktop tier → 27-cell craters, raymarch atmosphere, 9 octaves', () => {
    const k = qualityKnobs(1.0);
    expect(k.craterCells).toBe(27);
    expect(k.atmosphereModel).toBe('raymarch');
    expect(k.maxOctaves).toBe(9);
  });
  it('low tier → 9-cell craters, fresnel atmosphere, 4 octaves', () => {
    const k = qualityKnobs(0.0);
    expect(k.craterCells).toBe(9);
    expect(k.atmosphereModel).toBe('fresnel');
    expect(k.maxOctaves).toBe(4);
  });
});

describe('deriveUniforms (physics drivers → semantic uniforms, no type branch)', () => {
  const hotAirless = { composition: { ironFraction: 0.7, density: 7 }, T_eq: 900, tidalState: { locked: true, lockType: 'synchronous' }, atmosphere: null, habitability: 0, surfaceHistory: { erosion: 0 } };
  const oceanWorld = { composition: { ironFraction: 0.3, density: 5 }, T_eq: 290, tidalState: { locked: false }, atmosphere: { color: [0.5,0.5,0.8] }, habitability: 0.8, surfaceHistory: { erosion: 0.6 } };

  it('hot body emits; cool body does not', () => {
    expect(deriveUniforms(hotAirless).emissive).toBeGreaterThan(0.5);
    expect(deriveUniforms(oceanWorld).emissive).toBeLessThan(0.1);
  });
  it('airless body has no limb glow and no aurora; atmo body does', () => {
    expect(deriveUniforms(hotAirless).limbStrength).toBe(0);
    expect(deriveUniforms(oceanWorld).limbStrength).toBeGreaterThan(0);
  });
  it('liquid-water temperature + atmosphere → strong specular', () => {
    expect(deriveUniforms(oceanWorld).specStrength).toBeGreaterThan(0.5);
    expect(deriveUniforms(hotAirless).specStrength).toBeLessThan(0.2);
  });
  it('tidal lock cuts aurora (magnetic-field proxy)', () => {
    const locked = deriveUniforms({ ...oceanWorld, tidalState: { locked: true, lockType: 'synchronous' } });
    const free = deriveUniforms(oceanWorld);
    expect(locked.auroraIntensity).toBeLessThan(free.auroraIntensity);
  });
  it('erosion softens relief amplitude', () => {
    expect(deriveUniforms(oceanWorld).reliefAmplitude).toBeLessThan(deriveUniforms(hotAirless).reliefAmplitude);
  });
  it('passes qualityTier knobs through', () => {
    expect(deriveUniforms(oceanWorld, 0.0).craterCells).toBe(9);
    expect(deriveUniforms(oceanWorld, 1.0).craterCells).toBe(27);
  });
});
```

- [ ] **Step 2: Run to verify failure.** Run: `npx vitest run tests/planet-lod-foundation.test.js`. Expected: FAIL — `deriveUniforms is not a function`.

- [ ] **Step 3: Implement in `planet-lod-lab-core.js`.**

```js
// qualityTier 0 (mobile/cheap) → 1 (desktop/full). Scales the cost knobs (spec §2.E).
export function qualityKnobs(qualityTier) {
  return {
    craterCells: qualityTier >= 0.5 ? 27 : 9,                  // 3D 27-cell vs tangent 9-cell
    atmosphereModel: qualityTier >= 0.5 ? 'raymarch' : 'fresnel',
    maxOctaves: Math.round(mix(4, 9, qualityTier)),            // 4..9
  };
}

// deriveUniforms: physics driver-bundle → flat semantic uniform values.
// Generalizes the aurora/atmosphere precedent in PlanetGenerator.js:435-487
// (fieldStrength = composition.ironFraction * (locked ? 0.2 : 1.0); no planetType branch).
// Mapping values are LAB-TUNABLE — the tests pin the LOGIC (hot→emissive, airless→no limb, etc.),
// not the exact constants. Drivers schema mirrors PlanetGenerator's real fields.
export function deriveUniforms(drivers, qualityTier = 1.0) {
  const d = drivers || {};
  const iron = d.composition?.ironFraction ?? 0.3;
  const hasAtmo = !!d.atmosphere;
  const T = d.T_eq ?? 280;
  const erosion = d.surfaceHistory?.erosion ?? 0;
  const locked = !!d.tidalState?.locked;

  const hot = clamp01((T - 400) / 600);                         // 400K..1000K → 0..1
  const liquidWater = (T > 250 && T < 330) ? 1 : 0;             // specular band

  return {
    emissive: hot,                                              // lava glow on hot bodies
    limbStrength: hasAtmo ? 0.7 : 0.0,                          // rim glow needs an atmosphere
    specStrength: (hasAtmo && liquidWater) ? 0.8 : iron * 0.15, // ocean specular vs faint metal sheen
    auroraIntensity: iron * (locked ? 0.2 : 1.0) * (hasAtmo ? 1 : 0),
    cloudCoverage: hasAtmo ? clamp01((d.habitability ?? 0) + 0.2) : 0,
    reliefAmplitude: mix(1.0, 0.6, erosion),                    // eroded worlds = softer relief
    ...qualityKnobs(qualityTier),
  };
}
```

- [ ] **Step 4: Run to verify pass.** Run: `npx vitest run tests/planet-lod-foundation.test.js`. Expected: PASS (all foundation tests, ~21).

- [ ] **Step 5: Wire driver-bundle presets into the lab.** In `planet-lod-lab.html`, import `deriveUniforms`. Add a small set of representative driver bundles (types = driver-bundle presets, spec §2.D) and an `applyDrivers` that pipes the derived values into uniforms + `state` (so the Envelope sliders reflect them):

```js
import { deriveUniforms } from './planet-lod-lab-core.js';

const DRIVER_PRESETS = {
  'Rocky (Earthlike)': { composition:{ironFraction:0.32,density:5.5}, T_eq:288, tidalState:{locked:false}, atmosphere:{color:[0.5,0.6,0.9]}, habitability:0.7, surfaceHistory:{erosion:0.4} },
  'Lava (hot airless)': { composition:{ironFraction:0.7,density:7}, T_eq:950, tidalState:{locked:true,lockType:'synchronous'}, atmosphere:null, habitability:0, surfaceHistory:{erosion:0} },
  'Ocean (temperate)': { composition:{ironFraction:0.28,density:5}, T_eq:295, tidalState:{locked:false}, atmosphere:{color:[0.4,0.6,0.95]}, habitability:0.9, surfaceHistory:{erosion:0.6} },
  'Frozen (airless)': { composition:{ironFraction:0.2,density:2.5}, T_eq:60, tidalState:{locked:false}, atmosphere:null, habitability:0.05, surfaceHistory:{erosion:0.1} },
};
const driverUI = { preset: 'Rocky (Earthlike)', qualityTier: 1.0 };

function applyDrivers() {
  const u = deriveUniforms(DRIVER_PRESETS[driverUI.preset], driverUI.qualityTier);
  state.emissive = u.emissive; state.specStrength = u.specStrength; state.limbStrength = u.limbStrength;
  uniforms.uEmissive.value = u.emissive; uniforms.uSpecStrength.value = u.specStrength; uniforms.uLimbStrength.value = u.limbStrength;
  state._derived = u;   // craterCells/atmosphereModel/cloudCoverage/auroraIntensity consumed by Task 7 + Stage C
  gui.controllersRecursive().forEach(c => c.updateDisplay());
}

const fDrivers = gui.addFolder('Drivers'); fDrivers.open();
fDrivers.add(driverUI, 'preset', Object.keys(DRIVER_PRESETS)).name('type preset').onChange(applyDrivers);
fDrivers.add(driverUI, 'qualityTier', 0, 1, 0.01).name('qualityTier').onChange(applyDrivers);
applyDrivers();
```

- [ ] **Step 6: VISUAL via `:9223`.** Reload; no compile errors. Cycle the `type preset`: **Acceptance:** Lava → emissive glow appears (visible on dark side); Ocean → specular highlight + limb glow; Frozen → no limb, no glow, plain posterized surface; Rocky → modest limb. The Envelope sliders move to match each preset (proving the derivation drives them). qualityTier slider changes `state._derived.craterCells` (read via `evaluate_script: return window._lab.state._derived`). Screenshot each preset → `06-{rocky,lava,ocean,frozen}.png`.

- [ ] **Step 7: Commit.**

```bash
git add planet-lod-lab-core.js tests/planet-lod-foundation.test.js planet-lod-lab.html
git commit -m "feat(planet-lab): driver→semantic-uniform scaffolding + qualityTier (TDD'd) + type-preset bundles"
```

---

## Task 7: Convert clouds + aurora onto `noised()` (spec §5 step 7, Q7 all-layers — completes the foundation scope)

**Files:**
- Modify: `planet-lod-lab.html` (cloud + aurora layers in the shader, sampling `fbmd`/`noised` not plain `snoise`; driven by `cloudCoverage`/`auroraIntensity` from `deriveUniforms`)

- [ ] **Step 1: Add the cloud + aurora uniforms** (`:355-366`): `uCloudCoverage: { value: 0.0 }`, `uAuroraIntensity: { value: 0.0 }`, `uTime: { value: 0.0 }`.

- [ ] **Step 2: Add a cloud term on `noised()`** in `main()`, composited before the envelope sum. Clouds = a thresholded analytic-FBM band over the lit surface (clouds-as-relief base; weather layer may animate via `uTime` per spec Q4 — clouds need NOT be reproducible). Sample the SAME `fbmd` base (Q7: clouds off plain snoise, onto `noised`):

```glsl
// ── Clouds (analytic-FBM, weather layer — animated, not determinism-bound) ──
vec3 cloudN = fbmd(vPos * 1.7 + vec3(uTime * 0.02, 0.0, 0.0), 5.0, 0.0).yzw; // gradient unused, value below
float cloudH = fbmd(vPos * 1.7 + vec3(uTime * 0.02, 0.0, 0.0), 5.0, 0.0).x;
float cloud = smoothstep(0.15, 0.5, cloudH) * uCloudCoverage * (diff + 0.05);
vec3 cloudC = vec3(1.0) * cloud;
cloudC = posterize(cloudC, uPosterizeLevels, gl_FragCoord.xy, 0.4, uDitherMode);
```

(Combine the two `fbmd` calls into one `vec4 cw = fbmd(...);` and use `cw.x` — do not double-evaluate.)

- [ ] **Step 3: Add an aurora ring** mirroring `Planet.js` getAurora (`:180-199`) but with its noise on `noised()`. Night-side ring at a latitude band, rays from `noised`:

```glsl
// ── Aurora (night-side ring; rays from analytic noise) ──
float lat = vObjN.y;                                 // -1..1 latitude proxy
float ringMask = exp(-pow((abs(lat) - 0.7) / 0.12, 2.0));
float nightMask = smoothstep(0.1, -0.1, diff);       // visible in darkness/twilight
float rays = 0.5 + 0.5 * noised(vObjN * 8.0 + vec3(uTime * 0.1)).x;
float aurora = ringMask * nightMask * rays * uAuroraIntensity;
vec3 auroraC = vec3(0.3, 0.9, 0.5) * aurora * 0.6;   // skips quantizer (smooth glow, like emissive bypass)
```

Add `cloudC + auroraC` into the final `gl_FragColor` sum (`gl_FragColor = vec4(min(surface + emissive + specC + limbC + cloudC + auroraC, vec3(1.0)), 1.0);`).

- [ ] **Step 4: Drive the new uniforms from `applyDrivers` + `frame()`.** In `applyDrivers` (Task 6): `uniforms.uCloudCoverage.value = u.cloudCoverage; uniforms.uAuroraIntensity.value = u.auroraIntensity;`. In `frame()`: `uniforms.uTime.value = t;` (the existing `t` accumulator `:607,610`).

- [ ] **Step 5: VISUAL via `:9223`.** Reload; no compile errors. **Acceptance:** select Ocean/Rocky preset → soft cloud bands drift over the lit face (animated) and posterize with the surface; select a preset with iron + atmosphere + no lock → a green aurora ring glows on the NIGHT side near the poles and fades on the lit side. Frozen/airless → no clouds, no aurora. Clouds/aurora visibly use the analytic base (no plain-snoise blockiness). Screenshot → `07a-clouds-ocean.png`, `07b-aurora-nightside.png`.

- [ ] **Step 6: Commit.**

```bash
git add planet-lod-lab.html
git commit -m "feat(planet-lab): convert clouds + aurora onto analytic noised() base (Q7 all-layers) — Stage-A foundation complete"
```

---

## Definition of done (Stage-A foundation)

- [ ] All vitest foundation tests pass (`npx vitest run tests/planet-lod-foundation.test.js`).
- [ ] Lab loads on `:9223` with zero shader-compile/console errors.
- [ ] lil-gui folders mirror the driver-bundle model (spec §3); presets save/load.
- [ ] `lodRamp` is a live uniform driving relief amplitude; hysteresis flag does not flicker at the boundary.
- [ ] Envelope split: posterizeLevels (6→16), dither mode (Bayer/IGN), emissive/spec/limb each independently visible + bypassable — the A/B/C surface (values left open per §4).
- [ ] `deriveUniforms` drives the envelope from physics driver-bundles with NO `planetType` branch; type presets visibly change the planet; qualityTier scales the cost knobs.
- [ ] Clouds + aurora render on the analytic `noised()` base.
- [ ] **Tracked open goal NOT closed:** "retro envelope settled per-type in the lab" — the controls exist; per-type values are Max's downstream playtesting.

## After the foundation lands → Stage B (NOT this session)

Dispatch 8 per-feature research agents (`model: opus`), one per domain (relief, fluvial, aeolian, cryo/sublimation, bands/storms, clouds/haze, optical, exotic/overlay) — the parallel-subagent fan-out (`superpowers:dispatching-parallel-agents`). Each researches BOTH render-technique and generation-path (`D#`→`P#`→uniform). The foundation is explicitly NOT a fan-out (spec §6).

## Self-review notes

- **Spec coverage:** §5 steps 1-7 → Tasks 1-7. §2.A (analytic noise) → Task 2 validate. §2.B (lodRamp/hysteresis) → Task 3. §2.C (envelope axis) → Task 5. §2.D (driver scaffolding) → Task 6. §2.E (qualityTier) → Task 6. §2.F (single shader) → honored (no compiled variants). §3 (lil-gui folders, presets, semantic-uniform rule) → Tasks 1,5,6. §4 (tracked-open goal) → called out in Task 5 + DoD. §6 (inline not subagent) → header + execution handoff.
- **Type consistency:** `deriveUniforms` returns `{emissive, limbStrength, specStrength, auroraIntensity, cloudCoverage, reliefAmplitude, craterCells, atmosphereModel, maxOctaves}` — consumed by `applyDrivers` (Task 6) and Task 7 (`cloudCoverage`, `auroraIntensity`). State keys `posterizeLevels/ditherMode/emissive/specStrength/limbStrength/*Bypass` introduced in Task 5, reused in Task 6. Uniform names `uLodRamp` (T3), `uPosterizeLevels/uDitherMode/uEmissive/uSpecStrength/uLimbStrength/u*Bypass` (T5), `uCloudCoverage/uAuroraIntensity/uTime` (T7) — consistent across tasks.
- **Risk flags:** (1) `cameraPosition` object-space assumption in Task 5 spec-step 3 — fallback `uCamPos` noted. (2) IGN dither at high levels may still band → 3-cycle cap, Bayer is the safe default. (3) Task 7 cloud `fbmd` double-eval must be collapsed to one call (noted inline).
</content>
</invoke>
