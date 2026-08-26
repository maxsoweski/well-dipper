# F11 Fluvial River Networks — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render branching river/valley networks as driver-gated relief carved into the planet surface in `world-engine-lab.html`, covering the four F11 variants (dendritic, single-trunk+tributaries, meanders, relict).

**Architecture:** A pure GLSL `drainageField(pos, …)` primitive returns channel strength + analytic gradient — channels are the near-zero band of a domain-warped FBM field, with a gated tributary octave for the dendritic feeder look. A `fluvialCombiner` carves that channel into the shared `canyonHeight` accumulator at Stage 4 (after `canyonCombiner`), biased toward low ground, and bends the shading gradient by chain rule so `perturbAnalytic` lights the walls. Drivers (`uFluvial*`) are derived in `applyDrivers` from already-surfaced `deriveUniforms` outputs (`precipitation`, `surfaceGravity`, `liquidStability`) + the preset's raw `surfaceHistory.erosion`. **Spike-first:** the primitive is proven in a standalone harness before it touches the big shader.

**Tech Stack:** three.js r183.1 RawShaderMaterial (GLSL ES 3.0), lil-gui 0.21.0, Vite dev server (`:5173`), vitest (the one automated gate: `planet-archetypes`), chrome-devtools MCP on `:9223` GPU Chrome for visual verification.

**Verification model (read first — this is not classic unit-TDD):** GLSL shader output is not unit-testable. The automated gate is the `planet-archetypes` vitest (Task 5 guards the registry wiring). Everything else is verified **visually on `:9223`** + **0 console errors** + **even backtick parity** in `world-engine-lab.html` (was 30; re-count after every shader edit). Each task states its concrete acceptance check. Don't claim a task passes without running its check and observing the result (memory rule `verify-before-claiming-health`).

**Environment facts (don't re-discover):**
- Lab accessor is `window._lab` (NOT `window.__wd`). Enables: `window._lab.state.<key>`; derived bundle: `window._lab._derived`; `setPreset(name)` / `setQuality(q)` helpers exist.
- URL: `http://localhost:5173/well-dipper/world-engine-lab.html`. Max runs Vite — **do not start servers**. Check liveness with `mcp__chrome-devtools__list_pages` (NOT Bash curl — sandbox returns 000). Launch 2nd GPU Chrome per `memory/chrome-devtools-9223-launch.md` if needed.
- **Shared working tree has unrelated warp WIP** (`docs/NOW.md`, untracked `cryo-*.png`/`f10-*.png`/`qa-results/**`/`WarpTunnel.js`/warp labs/`research/**`). **Never `git add -A`.** Stage only the explicit paths each task names. One `git add <paths> && git commit` per commit in a SINGLE Bash call (a hook unstages between calls). Sign-off line: `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`. Do not push.
- lil-gui 0.21.0 prefixes CSS with `lil-`; the enable-in-title pattern is `relocateEnableToTitle(folder, prop)` (lab :2393).

---

## File Structure

| File | Responsibility | Change |
|---|---|---|
| `fluvial-drainage-lab.html` | **Spike harness** — prove `drainageField` in isolation (sphere toy) before the big shader | Create (Task 1) |
| `world-engine-lab.html` | Production lab: uniforms, `drainageField` + `fluvialCombiner` GLSL, Stage-4 call, Stage-6 species tint, `state`, `applyDrivers` derivation, frame-loop writes, GUI folder | Modify (Tasks 2,3,4,6) |
| `planet-archetypes.js` | Shared FEATURES/ARCHETYPES registry | Modify (Task 5) — add `rivers` |
| `tests/planet-archetypes.test.js` | Bidirectional registry drift-guard | Run only (Task 5) — must stay green |

Task order: **spike → port primitive → drivers/state → GUI → registry+test → species tint+final verify.** Registry (Task 5) is placed right after the GUI binding exists (Task 4) because the test cross-checks `.add(state,'riversEnabled')` ⇆ `FEATURES.rivers` — both sides must land together.

---

## Task 1: Spike harness — prove the `drainageField` primitive in isolation

**Why first:** Per spec §Risks #1 + memory `feedback_isolated-test-harnesses.md`, the whole feature rides on this primitive reading as *branching rivers*. If it can't read on a simple sphere toy, it can't read inside the 6-level-posterized big shader. 3-cycle cap (memory Response-Start Protocol #5): if branching fails 3 research→build→look rounds, fall back to a simpler primitive and flag it to Max.

**Files:**
- Create: `fluvial-drainage-lab.html`

- [ ] **Step 1: Create the spike harness**

A minimal full-screen three.js sphere with ONLY the drainage primitive driving a grayscale height (no posterize, no other combiners — isolate the variable). Copy the `noised(vec3)` analytic-noise helper from `world-engine-lab.html` (it's at :434, a self-contained `vec4 noised(vec3 x)`), plus a basic orbit camera. Drive these as `lil-gui` knobs: `meander`, `width`, `freq`, `warpAmt`, `warpFreq`, `tribLac`, `tribGate`. Shade the sphere as `vec3(channel)` so channels read white on black, and add a second toggle to shade by the *gradient-lit* carved height (so you can confirm walls light).

Starting `drainageField` GLSL to iterate from (the spike's job is to refine THIS until it reads):

```glsl
// channel = near-zero band of a domain-warped FBM field; +1 gated tributary octave.
// Returns vec4(channelStrength in [0,1], d(channel)/dpos). Analytic gradient via the
// same fold/chain-rule discipline as fbmdRidged (world-engine-lab.html:564).
vec4 drainageField(vec3 pos){
  // domain warp: displace along a low-freq noise gradient (curl-free, cheap — the
  // same "warp by noise, ignore exact Jacobian" shortcut F5 scarpCombiner uses).
  vec4 wn = noised(pos * uWarpFreq);
  vec3 q  = pos + uMeander * uWarpAmt * wn.yzw;
  // coarse trunk
  vec4 f      = noised(q * uFreq);
  float field = f.x;
  vec3  dfield = f.yzw * uFreq;
  float af    = abs(field);
  float chan  = 1.0 - smoothstep(0.0, uWidth, af);
  float dstep = (af < uWidth) ? (6.0*(af/uWidth)*(1.0-af/uWidth))/uWidth : 0.0;
  vec3  dchan = -dstep * sign(field) * dfield;
  // tributary octave — finer channels, switched ON only NEAR the trunk (dendritic feeders)
  float gate  = smoothstep(0.0, uTribGate, chan);
  float w2    = uWidth * 0.6;
  vec4 f2     = noised(q * uFreq * uTribLac);
  float af2   = abs(f2.x);
  float chan2 = 1.0 - smoothstep(0.0, w2, af2);
  float dstep2 = (af2 < w2) ? (6.0*(af2/w2)*(1.0-af2/w2))/w2 : 0.0;
  vec3  dchan2 = -dstep2 * sign(f2.x) * (f2.yzw * uFreq * uTribLac);
  float c  = clamp(chan + gate * chan2 * 0.7, 0.0, 1.0);
  vec3  dc = dchan + gate * dchan2 * 0.7;   // d(gate) dropped (small, like the scarp shortcut)
  return vec4(c, dc);
}
```

- [ ] **Step 2: Load on `:9223` and look**

Confirm Max's Vite is serving (it serves the repo root, so the new file is at `http://localhost:5173/well-dipper/fluvial-drainage-lab.html`). Liveness: `mcp__chrome-devtools__list_pages`. Navigate, `mcp__chrome-devtools__take_screenshot`.

- [ ] **Step 3: Tune until the three acceptance criteria read (≤3 cycles)**

Adjust the knobs (and the GLSL if needed) until ALL THREE hold on the screenshot:
- **(a) Visible branching** — channels form a connected network with tributaries joining trunks, not isolated blobs or parallel stripes.
- **(b) Meanders read** — raising `meander` visibly bends the channels (sinuous, not straight).
- **(c) Gradient lights walls** — in the gradient-lit-height mode, channel walls show a lit/shadow edge (the analytic `dc` is correct; if walls look flat or inverted, the gradient sign/scale is wrong — fix it here, not in the big shader).

Record the final knob values + any GLSL changes in a comment block at the top of `fluvial-drainage-lab.html` (these become the lab defaults in Task 3). **If 3 cycles fail:** stop, write the failure + a simpler fallback proposal (e.g. single-octave channels, no tributaries) to the spec's residual-risks section, and surface to Max before proceeding.

- [ ] **Step 4: Commit the spike**

```bash
git add fluvial-drainage-lab.html && git commit -m "F11 spike: drainageField primitive proven in isolation

Standalone sphere toy — branching/meanders/wall-lighting confirmed on :9223.
Final knob defaults + any GLSL deltas recorded in the file header; ported to
world-engine-lab.html in the next task.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```
Expected: one new file committed, warp WIP untouched (`git status` shows the warp files still unstaged).

---

## Task 2: Port `drainageField` + `fluvialCombiner` + uniforms into the big shader

**Files:**
- Modify: `world-engine-lab.html` — uniform declarations (~:160–330 GLSL block + ~:1559–1694 JS uniforms object), GLSL functions (after `fbmdRidged`, ~:600), Stage-4 call site (:1432–1433), shared accumulators (:1407).

- [ ] **Step 1: Add the fluvial uniform declarations (GLSL)**

In the GLSL uniform block (near the other `uniform vec3 …Offset;` lines, e.g. after :327 `uGlacialOffset`), add:

```glsl
      // ── F11 fluvial drainage (Stage-4, Fluvial domain) ──
      uniform float uFluvialActivity;  // 0=relict/degraded … 1=sharp/active
      uniform float uFluvialDensity;   // network strength + master gate; ≤0 → early-out
      uniform float uFluvialDepth;     // channel carve depth (relief units)
      uniform float uFluvialMeander;   // domain-warp amount (sinuosity)
      uniform float uFluvialWidth;     // channel band half-width (shape knob)
      uniform float uFluvialFreq;      // trunk-network frequency (shape knob)
      uniform float uFluvialWarpAmt;   // warp displacement scale (shape knob)
      uniform float uFluvialWarpFreq;  // warp-noise frequency (shape knob)
      uniform float uFluvialTribLac;   // tributary lacunarity (shape knob)
      uniform float uFluvialTribGate;  // tributary on-gate vs trunk proximity (shape knob)
      uniform float uFluvialLowBias;   // 0=channels everywhere … 1=low-ground only
      uniform float uFluvialHiGround;  // height above which channels fade (with LowBias)
      uniform vec3  uFluvialOffset;    // 🎲 domain offset — default (0,0,0) = unchanged
```

- [ ] **Step 2: Add a `fluvialWet` shared accumulator next to `canyonHeight`**

At :1407 (`float canyonHeight = 0.0;`), add directly below:

```glsl
        float fluvialWet = 0.0;  // F11 channel strength, consumed by the Stage-6 species floor-tint
```

- [ ] **Step 3: Port the proven `drainageField` + add `fluvialCombiner` (GLSL)**

Immediately after `fbmdRidged` (the `}` at :600), insert. **Use the FINAL `drainageField` from the Task-1 spike** (it may differ from the starting version — copy what passed acceptance), rewriting its bare `uWarpFreq`/`uMeander`/etc. to the `uFluvial*` names above:

```glsl
      // ── F11 drainage primitive (ported from fluvial-drainage-lab.html, proven on :9223) ──
      // Pure, no side effects. Returns vec4(channelStrength in [0,1], d(channel)/dpos).
      // Channels = near-zero band of a domain-warped FBM field; +1 gated tributary octave
      // for the dendritic feeder look. Analytic gradient (fbmdRidged fold/chain-rule discipline).
      vec4 drainageField(vec3 pos){
        vec4 wn = noised(pos * uFluvialWarpFreq + uFluvialOffset);
        vec3 q  = pos + uFluvialMeander * uFluvialWarpAmt * wn.yzw;
        vec4 f      = noised(q * uFluvialFreq + uFluvialOffset);
        float field = f.x;
        vec3  dfield = f.yzw * uFluvialFreq;
        float af    = abs(field);
        float chan  = 1.0 - smoothstep(0.0, uFluvialWidth, af);
        float dstep = (af < uFluvialWidth) ? (6.0*(af/uFluvialWidth)*(1.0-af/uFluvialWidth))/uFluvialWidth : 0.0;
        vec3  dchan = -dstep * sign(field) * dfield;
        float gate  = smoothstep(0.0, uFluvialTribGate, chan);
        float w2    = uFluvialWidth * 0.6;
        vec4 f2     = noised(q * uFluvialFreq * uFluvialTribLac + uFluvialOffset);
        float af2   = abs(f2.x);
        float chan2 = 1.0 - smoothstep(0.0, w2, af2);
        float dstep2 = (af2 < w2) ? (6.0*(af2/w2)*(1.0-af2/w2))/w2 : 0.0;
        vec3  dchan2 = -dstep2 * sign(f2.x) * (f2.yzw * uFluvialFreq * uFluvialTribLac);
        float c  = clamp(chan + gate * chan2 * 0.7, 0.0, 1.0);
        vec3  dc = dchan + gate * dchan2 * 0.7;
        return vec4(c, dc);
      }

      // ── F11 fluvialCombiner (Stage-4) — carves the drainage network into the shared
      // canyonHeight accumulator, biased toward low ground, bending grad so perturbAnalytic
      // lights the walls. uFluvialDensity≤0 ⇒ early-out (Stage-A base untouched, regression-safe).
      // Writes fluvialWet for the Stage-6 species floor-tint. Sharing canyonHeight lets a future
      // F14 lake pass pool liquid in these channels for free.
      void fluvialCombiner(vec3 pos, inout float h, inout float canyonHeight, inout vec3 grad, inout float fluvialWet){
        if (uFluvialDensity <= 0.0) return;
        // low-ground preference — mix between "channels everywhere" (flat worlds keep their
        // network) and "low ground only" (rivers stay out of peaks), per uFluvialLowBias.
        float lowGround = mix(1.0, smoothstep(uFluvialHiGround, 0.0, h), uFluvialLowBias);
        vec4 d = drainageField(pos);
        float chan = d.x;
        vec3  dchan = d.yzw;
        float depth = uFluvialDepth * mix(0.35, 1.0, uFluvialActivity);  // relict = shallower
        float s = chan * lowGround * uFluvialDensity;
        float carve = -s * depth;                                        // carve DOWN
        canyonHeight += carve;
        h            += carve;
        // d(carve)/dpos ≈ -depth·uFluvialDensity·lowGround·dchan  (d(lowGround)/dh second-order,
        // dropped — same chain-rule shortcut as scarp/glacial combiners).
        grad += -depth * uFluvialDensity * lowGround * dchan;
        fluvialWet = max(fluvialWet, s);
      }
```

- [ ] **Step 4: Call `fluvialCombiner` at the Stage-4 slot**

At :1432–1433, insert the call AFTER `canyonCombiner` (so fluvial composes on top of tectonic graben, per spec Risk #2):

```glsl
          canyonCombiner(vPos, h, canyonHeight, grad);
          fluvialCombiner(vPos, h, canyonHeight, grad, fluvialWet);   // F11 — channels carve into canyonHeight
```

- [ ] **Step 5: Add the JS uniform entries**

In the `uniforms` object (after `uGlacialOffset` at :1682), add:

```js
      uFluvialActivity: { value: 1.0 },
      uFluvialDensity:  { value: 0.0 },   // off until applyDrivers/state drives it
      uFluvialDepth:    { value: 0.12 },
      uFluvialMeander:  { value: 0.5 },
      uFluvialWidth:    { value: 0.12 },  // ← replace with the Task-1 spike's final defaults
      uFluvialFreq:     { value: 2.5 },   // ←   "
      uFluvialWarpAmt:  { value: 0.3 },   // ←   "
      uFluvialWarpFreq: { value: 1.5 },   // ←   "
      uFluvialTribLac:  { value: 2.5 },   // ←   "
      uFluvialTribGate: { value: 0.25 },  // ←   "
      uFluvialLowBias:  { value: 0.5 },
      uFluvialHiGround: { value: 0.15 },
      uFluvialOffset:   { value: new THREE.Vector3() },
```

- [ ] **Step 6: Verify it compiles + carves, with backtick parity intact**

Backtick parity check (must stay EVEN — was 30):

Run: `grep -o '\`' world-engine-lab.html | wc -l`
Expected: an even number (the shader is one template literal; an odd count means a stray backtick broke it).

Then on `:9223`: `mcp__chrome-devtools__list_pages` → navigate/reload → `mcp__chrome-devtools__list_console_messages`. Temporarily force the feature on to see *something* carve (the driver wiring is Task 3): run via `mcp__chrome-devtools__evaluate_script`:

```js
const u = window._lab.uniforms;
u.uFluvialDensity.value = 1.0; u.uFluvialDepth.value = 0.2;
'forced on';
```
Expected: **0 console errors** (no shader-compile error), and a screenshot shows channels carved into the surface. Revert by reloading.

- [ ] **Step 7: Commit**

```bash
git add world-engine-lab.html && git commit -m "F11: port drainageField + fluvialCombiner into planet-lod-lab shader

Stage-4 carve into the shared canyonHeight accumulator (after canyonCombiner),
low-ground biased, analytic gradient lights the walls. Drivers wired next task;
forced-on screenshot confirms channels carve, 0 console errors, backtick parity even.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: Driver derivation (`applyDrivers`) + `state` + frame-loop writes

**Files:**
- Modify: `world-engine-lab.html` — `state` object (~:1923–1936), `applyDrivers` (~:2168 end, before `state._derived = u;`), the `🎲 transient` offset-reset line (:2164–2167), frame-loop uniform writes (~:2688).

- [ ] **Step 1: Add fluvial fields to `state`**

Near `glacialEnabled: true,` (:1936), add (use the Task-1 spike's proven shape defaults):

```js
      riversEnabled: true,
      fluvialActivity: 1.0, fluvialDensity: 0.0, fluvialDepth: 0.12, fluvialMeander: 0.5,
      fluvialWidth: 0.12, fluvialFreq: 2.5, fluvialWarp: 0.3, fluvialLowBias: 0.5,
      fluvialOffset: [0,0,0],
```

- [ ] **Step 2: Derive `uFluvial*` from surfaced drivers in `applyDrivers`**

Just before `state._derived = u;` (:2168), add. (Audit confirmed `u.precipitation`, `u.surfaceGravity`, `u.liquidStability` are all returned by `deriveUniforms`; `surfaceHistory.erosion` is read raw from the preset, guarded `?? 0`.):

```js
      // ── F11 fluvial (lab audit 2026-06-07) — derive from surfaced drivers ──
      // Existence gate = liquidStability (0 on airless worlds ⇒ no active rivers). Density
      // tracks D4 rain; depth adds a touch of D14 gravity. Relict (was-wet, now-dry: low
      // stability but erosion evidence) gets faint, softened channels via activity→erosion.
      const _fp = DRIVER_PRESETS[driverUI.preset];
      const _erosion = _fp.surfaceHistory?.erosion ?? 0;
      const _stab = u.liquidStability, _rain = u.precipitation, _g = u.surfaceGravity;
      const _clamp01 = x => Math.max(0, Math.min(1, x));
      const _wet = _stab > 0.15;
      state.fluvialActivity = _wet ? 1.0 : _clamp01(_erosion);              // relict if dried
      state.fluvialDensity  = _wet ? _clamp01(_stab * (0.3 + 0.7 * _rain))  // active network
                                   : 0.4 * _clamp01(_erosion);             // faint relict traces
      state.fluvialDepth    = 0.08 + 0.10 * _rain + 0.04 * _clamp01(_g);
      state.fluvialMeander  = 0.3 + 0.5 * _rain;
```

- [ ] **Step 3: Reset the 🎲 offset on preset/quality change**

On the offset-reset line group (:2164–2167), append `state.fluvialOffset = [0,0,0];` so a preset switch discards a manual fluvial roll (matches every other feature's transient-🎲 contract).

- [ ] **Step 4: Write the uniforms each frame, gated by `riversEnabled`**

In the frame loop after the glacial writes (:2688), add. The enable gate zeroes density (early-out path), preserving the slider value (same pattern as `uGlacialStrength`):

```js
      uniforms.uFluvialDensity.value  = state.riversEnabled ? state.fluvialDensity : 0.0;   // ✓ enable gate
      uniforms.uFluvialActivity.value = state.fluvialActivity;
      uniforms.uFluvialDepth.value    = state.fluvialDepth;
      uniforms.uFluvialMeander.value  = state.fluvialMeander;
      uniforms.uFluvialWidth.value    = state.fluvialWidth;
      uniforms.uFluvialFreq.value     = state.fluvialFreq;
      uniforms.uFluvialWarpAmt.value  = state.fluvialWarp;
      uniforms.uFluvialLowBias.value  = state.fluvialLowBias;
      uniforms.uFluvialOffset.value.set(state.fluvialOffset[0], state.fluvialOffset[1], state.fluvialOffset[2]);
```

- [ ] **Step 5: Verify driver-gating across presets on `:9223`**

Reload. Via `mcp__chrome-devtools__evaluate_script`, sweep presets and read back the derived density:

```js
const out = {};
for (const p of ['Rocky (Earthlike)','Ocean (temperate)','Titan (methane seas)','Lava (hot airless)','Frozen (airless)','Europa (icy moon)']) {
  window._lab.setPreset(p);
  out[p] = { density: +window._lab.state.fluvialDensity.toFixed(3), activity: +window._lab.state.fluvialActivity.toFixed(3) };
}
out;
```
Expected: Rocky/Ocean density > 0 (water rivers); Titan density > 0 (methane); **Lava / Frozen / Europa density ≈ 0** (airless, the key gate check). Screenshot Rocky + Lava to confirm channels appear vs. none. **0 console errors.**

- [ ] **Step 6: Commit**

```bash
git add world-engine-lab.html && git commit -m "F11: derive uFluvial* drivers in applyDrivers + frame-loop writes

liquidStability existence-gate; density tracks D4 rain, depth +D14 gravity; relict
path (low stab + erosion) gives faint softened channels. riversEnabled gates
density→0. Verified on :9223: wet worlds show networks, airless show none.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: GUI — "Surface — Gradational" folder → "Rivers & valleys (F11)"

**Files:**
- Modify: `world-engine-lab.html` — new folder after the `fGlacial` block (~:2378), the `featureFolders` bridge map (:2382–2387).

- [ ] **Step 1: Add the new top-level folder + subfolder with knobs**

After the `fGlacial` block (after :2378, before the `// ── Archetype filter` comment at :2380), add. The enable controller MUST be the literal `fRivers.add(state, 'riversEnabled')` (the `planet-archetypes` test's regex `\.add\(state, '(\w+Enabled)'\)` reads it; `relocateEnableToTitle` in Task-existing code then moves the DOM into the title):

```js
    // ▸ Surface — Gradational (NEW family — Fluvial/Aeolian; distinct from Relief).
    // Future F12–F16 land here too. Top-level guiRight folder per spec.
    const fGrad = guiRight.addFolder('Surface — Gradational'); fGrad.open();
    // ▸ Rivers & valleys (F11) — drainage networks carved into canyonHeight. density/depth/
    // meander/activity are the headline knobs (activity = relict↔active override); width/freq/
    // warp/lowBias are shape knobs (lab-tunable, like glacial's mantle/lineation params).
    const fRivers = fGrad.addFolder('Rivers & valleys (F11)'); fRivers.close();
    fRivers.add(state, 'fluvialDensity', 0, 1, 0.01).name('density (rain-driven)').listen();
    fRivers.add(state, 'fluvialDepth', 0, 0.4, 0.01).name('depth').listen();
    fRivers.add(state, 'fluvialMeander', 0, 1, 0.01).name('meander').listen();
    fRivers.add(state, 'fluvialActivity', 0, 1, 0.01).name('activity (relict↔active)').listen();
    fRivers.add(state, 'fluvialWidth', 0.04, 0.3, 0.01).name('channel width');
    fRivers.add(state, 'fluvialFreq', 0.5, 8, 0.1).name('network freq');
    fRivers.add(state, 'fluvialWarp', 0, 1, 0.02).name('warp amount');
    fRivers.add(state, 'fluvialLowBias', 0, 1, 0.02).name('low-ground bias');
    fRivers.add(state, 'riversEnabled').name('✓ enabled');
    fRivers.add({ roll(){ state.fluvialOffset = randOffset(); } }, 'roll').name('🎲 randomize');
```

- [ ] **Step 2: Register `fRivers` in the `featureFolders` bridge map**

In the `featureFolders` object (:2382–2387), add `rivers: fRivers,` (so `relocateEnableToTitle`, the solo loop, and `applyArchetypeFilter` all pick it up). E.g. append to the last line:

```js
      sublimation: fSub, glacial: fGlacial, rivers: fRivers,
```

- [ ] **Step 3: Verify the GUI wiring on `:9223`**

Reload. Screenshot the right panel — confirm a "Surface — Gradational" folder exists with a closed "Rivers & valleys (F11)" subfolder, the ✓ enabled toggle sits in the title bar (not the body), and a 🔆 solo + 🎲 randomize appear. Via `evaluate_script`, exercise solo + enable-all and confirm no throw:

```js
// (the solo button calls setFeatureEnables('rivers'); enable-all calls setFeatureEnables(null))
window._lab.state.riversEnabled;   // sanity read
```
Expected: panel renders correctly, **0 console errors**. (The registry test in Task 5 is what proves solo/filter actually include `rivers`.)

- [ ] **Step 4: Commit**

```bash
git add world-engine-lab.html && git commit -m "F11: add Surface — Gradational GUI folder + Rivers & valleys (F11) subfolder

Headline knobs (density/depth/meander/activity) + shape knobs (width/freq/warp/
lowBias), enable-in-title + solo + 🎲. Registered fRivers in featureFolders so the
solo/filter/relocate machinery picks it up.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: Register `rivers` in `planet-archetypes.js` + green the drift-guard test

**Why now:** The `planet-archetypes` test cross-checks `FEATURES` enableKeys ⇆ panel `.add(state,'…Enabled')` bindings **bidirectionally**. After Task 4 the panel binds `riversEnabled` with NO matching `FEATURES` entry → the test's "every panel enable-key has exactly one FEATURES entry" assertion now FAILS. This task adds the entry and makes it green. (Run the test first to SEE it fail — that confirms the guard works.)

**Files:**
- Modify: `planet-archetypes.js` (:6–21, the `FEATURES` object)
- Test: `tests/planet-archetypes.test.js` (run only — do not edit)

- [ ] **Step 1: Run the test and watch it fail (the binding from Task 4 has no FEATURES entry)**

Run: `npm run test -- planet-archetypes`
Expected: FAIL on "every panel enable-key has exactly one FEATURES entry (no orphan folders)" — `riversEnabled` is bound in the panel but absent from `FEATURES`.

- [ ] **Step 2: Add the `rivers` FEATURES entry**

In `planet-archetypes.js`, after the `glacial:` line (:20), add. Archetypes are water worlds (`tectonic-terrestrial`: Rocky/Ocean) + Titan methane (`volatile-cold`) — both existing ARCHETYPES keys:

```js
  rivers:     { label: 'Rivers & valleys (F11)',enableKey: 'riversEnabled',   archetypes: ['tectonic-terrestrial','volatile-cold'] },
```

- [ ] **Step 3: Run the test and watch it pass**

Run: `npm run test -- planet-archetypes`
Expected: PASS (all suites). This proves: the enableKey is bound + unique, both archetypes are real keys, and `featuresOf('tectonic-terrestrial')`/`featuresOf('volatile-cold')` now include `rivers` (so the archetype filter shows the folder on wet/Titan presets).

- [ ] **Step 4: Commit**

```bash
git add planet-archetypes.js && git commit -m "F11: register rivers in FEATURES (tectonic-terrestrial + volatile-cold)

Drift-guard test green: enableKey bound+unique, archetypes valid, featuresOf
inversion includes rivers on water + Titan presets.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: Stage-6 species floor-tint + full verification sweep

**Files:**
- Modify: `world-engine-lab.html` — Stage-6 albedo region (:1475–1476).

- [ ] **Step 1: Add the faint species-keyed channel-floor tint (albedo, not relief)**

At :1475 (`vec3 albedoCol = mix(uBaseColor, frostShade, frostCover);`), insert before the `posterize` call. Water = subtle dark-blue floor; methane (`uLiquidSpecies==1`) = dark amber. Gated by `fluvialWet` so coverage=0 ⇒ `uBaseColor` unchanged (regression-safe), kept faint so it survives posterize as a floor darkening, not a new band:

```glsl
        // F11 species floor-tint — faint channel-floor albedo (water vs methane). Albedo only;
        // fluvialWet=0 ⇒ unchanged. Kept subtle so it reads as a floor darkening through posterize.
        vec3 fluvTint = (uLiquidSpecies == 1) ? vec3(0.30, 0.22, 0.10) : vec3(0.10, 0.14, 0.24);
        albedoCol = mix(albedoCol, fluvTint, clamp(fluvialWet, 0.0, 1.0) * 0.35 * uFluvialDensity);
```

- [ ] **Step 2: Backtick parity + console check**

Run: `grep -o '\`' world-engine-lab.html | wc -l`
Expected: even (unchanged parity).

Reload `:9223`, `mcp__chrome-devtools__list_console_messages` → **0 errors**. Screenshot Rocky (water — channels show a faint blue floor) and Titan (methane — faint amber). Confirm the tint is subtle, not a hard new posterize band.

- [ ] **Step 3: Full verification sweep (spec §Verification)**

On `:9223`, walk every check from the spec and record pass/fail. Run via `evaluate_script` + screenshots:
- **Branching networks** visible on Rocky + Ocean.
- **Relict look** — on Rocky, drag `activity`→0 (`window._lab.state.fluvialActivity = 0`): channels soften + shallow (no preset is a clean Mars, so relict is shown via the activity override — the manual-override contract, like `lavaActivity`).
- **NONE on airless** — Lava, Frozen, Europa show no channels (`fluvialDensity ≈ 0`).
- **Channels sit in low ground** — not across crater rims/peaks (raise `low-ground bias` if they climb peaks; lower it if a flat world loses its network — spec Risk #3).
- **`canyonHeight` co-tenancy** — on a preset with F4 canyons (Rocky), confirm rivers compose with chasma without double-deepening into a black trench (spec Risk #2).
- **GUI resync** — flip presets / solo / enable-all / reset; the ✓-enabled title box + knobs resync (`.listen()`); `resetAll` doesn't throw (`evaluate_script`: call the reset button path, read `window._lab.state.riversEnabled`).
- **Performance** — frame stays smooth on `:9223` (spec Risk #4); the `uFluvialDensity≤0` early-out covers airless worlds.

- [ ] **Step 4: Re-run the archetype test (regression)**

Run: `npm run test -- planet-archetypes`
Expected: PASS (Stage-6 edit shouldn't touch it, but confirm).

- [ ] **Step 5: Commit**

```bash
git add world-engine-lab.html && git commit -m "F11: Stage-6 species floor-tint (water/methane) + full verification

Faint channel-floor albedo, species-keyed, regression-safe at coverage=0. Full
:9223 sweep passed: branching on wet worlds, none on airless, relict via activity
override, channels in low ground, canyonHeight co-tenancy clean, GUI resyncs.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Post-implementation (outside the task loop)

- [ ] **Update the campaign tracker** `docs/FEATURES/planet-lod-campaign-tracker.md`: flip F11 → ✅, advance ▶️ to F12, log the spike + plan + impl commit hashes in the artifact log.
- [ ] **Update memory** `well-dipper-lod-terrain-campaign.md` with F11 done + the spike-harness pattern outcome.
- [ ] **`superpowers:requesting-code-review`** — dispatch an opus code-review subagent over the F11 diff (`git diff` of the impl commits) before considering it shipped.
- [ ] Surface to Max for UAT (the lab is his gate; no agent closes it).
- [ ] When the warp session's WIP settles, add a `docs/NOW.md` line for the planet-lod campaign (it's currently the warp session's uncommitted file — don't touch it now).

---

## Self-Review (completed during planning)

**Spec coverage:** Goal/4-variants → Tasks 1–4 + variants table (dendritic=primitive default, trunk+tributaries=tribGate octave, meanders=uFluvialMeander warp, relict=activity→0 in Task 3/6). Components §1 drainageField→T1/T2; §2 fluvialCombiner→T2; §3 applyDrivers→T3; §4 GUI→T4; §5 registry→T5; species tint→T6. Data-flow → T2+T3+T6. Verification block → T6 Step 3. Risks #1 (spike)→T1, #2 (canyonHeight)→T6, #3 (low-ground/erosion)→T3+T6, #4 (perf)→T6. **No gaps.**

**Placeholder scan:** The only deliberate "fill from the spike" markers are the `uFluvial*` shape-knob default values (T2 Step 5, T3 Step 1) — these are intentionally sourced from Task 1's empirical result, with concrete fallback values given. The `drainageField` GLSL is fully written in both T1 (starting) and T2 (ported) — T2 says copy the spike's final version, which is the honest contract of a spike-first plan.

**Type/name consistency:** `riversEnabled` (state) ⇆ `FEATURES.rivers.enableKey` ⇆ panel `.add(state,'riversEnabled')` ⇆ `featureFolders.rivers` — consistent across T3/T4/T5. Uniform names `uFluvial*` identical in GLSL decl (T2.1), JS uniforms (T2.5), frame writes (T3.4). `fluvialWet` accumulator declared (T2.2), written (T2.3 combiner), consumed (T6.1). `drainageField`/`fluvialCombiner` signatures match call site (T2.4). Consistent.
