# Non-visual analysis channel — research + proposal

**Date:** 2026-07-24 · **Lane A** · working-Claude
**Directive (Max, verbatim, session-end 2026-07-24):**
> "We need a way other than visual for you to be able to analyse what's happening in the lab here;
> and once outside of the lab, ditto, for the rendering pipeline. I want you to, after the handoff,
> research how people in game dev do this: how they are able to monitor what's happening in the
> rendering pipeline (when it includes the kind of features we're developing) in ways other than
> simply eyeballing it."

Research done fresh (WebSearch, 2026-07-24) per `feedback_research-beyond-training` — not answered
from training data. Sources listed at the bottom; browser-capability claims flagged where they need
a runtime probe rather than trust.

---

## 1. What game devs actually use — five families

Sorted by what question each family can answer. The critical distinction for us: most of this
industry tooling answers **"what did the GPU do?"** — very little of it answers **"is the world
we generated correct?"** Those are different questions, and Max's directive is mostly the second.

### Family A — API-level frame capture (RenderDoc / PIX / Nsight / Spector.js / WebGPU Inspector)

Intercepts every graphics call for one frame; you then walk the draw list, inspect bound textures,
uniforms, intermediate targets, and (in RenderDoc/Nsight) step a shader per-invocation.

- **Browser status 2026:** *WebGL2* — **Spector.js** (BabylonJS) is still the standard and still
  maintained; extension or in-page standalone; captures the full command list with visual state per
  call. *WebGPU* — **WebGPU Inspector** (brendan-duncan) is the mature option: frame capture incl.
  buffers/textures/render-pass results, object inspection with creation stacktraces, **live shader
  editing**, frame-time and GPU-object-count plots. Also `webgpu_recorder` (record + replay a
  command stream as a standalone repro), `WebGPUVision`, `webgpu-devtools`.
- **Native profilers on a browser:** possible but brittle. RenderDoc-into-Chrome needs
  `--disable-gpu-sandbox --gpu-startup-dialog --use-angle=gl --disable-gpu-compositing` and process
  injection; multiple sources note it degraded after Chrome moved toward D3D12/Vulkan backends.
  PlayCanvas's own GPU-profiling guide says the sandbox "inherently limits compatibility and
  integration with native GPU profilers."
- **Answers:** why *this specific draw* is wrong. Wrong uniform, wrong bind, wrong blend state.
- **Cannot answer:** anything automated. It is an eyeball tool with a better eye. No assertions,
  no regression gate, no "does this hold across 200 seeds."
- **Verdict for us:** worth having installed for one-off forensics (Spector.js, since the lab is
  `WebGLRenderer` on three r0.183). **Not** the channel Max is asking for.

### Family B — debug channels / AOV readback ("the numeric channel")

Render an intermediate quantity (height, slope, mask, province id, temperature…) into an offscreen
float target, read it back to the CPU, and assert on the numbers. This is the workhorse of internal
engine tooling — the "debug views" (normals/depth/overdraw/complexity) you see in every engine are
the *visual* half; the automated half reads the same buffers back and computes statistics.

- **Shader printf** exists natively in Vulkan (`GL_EXT_debug_printf`, via
  `VK_KHR_shader_non_semantic_info`, promoted to Vulkan 1.3, surfaced per-invocation in RenderDoc)
  and HLSL/DX12. For **WGSL** there's `wgsl-debug` (copies a debug buffer GPU→CPU and prints).
  For **WebGL2/GLSL there is no printf** — the documented technique is exactly the AOV route:
  encode values into a float render target / `imageStore` and read back.
- **In our stack this already exists**: the lab already renders a `FloatType` RTT for the tributary
  patch and reads the live height field through one (`world-engine-lab.html:245`, `:1467`). The
  mechanism is in-house; what's missing is a general, reusable *measurement* layer on top.
- **Answers:** exact numeric state of any intermediate the shader computes, at any sample point.
- **Verdict for us:** **the load-bearing family.** Everything in the proposal below sits on it.

### Family C — golden image + perceptual diff

Unity ships the **Graphics Test Framework** (render → compare to a blessed reference image, manage
references in-editor, run across backends/platforms). Unreal ships the **Screenshot Comparison Tool**
inside its Automation Framework (screenshot history per build, viewed in Session Frontend). Metric
ladder in use: raw pixel diff → **SSIM** (structural: luminance/contrast/structure in local windows;
>0.99 ≈ no visible change) → **ꟻLIP** (NVIDIA's difference evaluator built specifically for
alternating-image comparison of rendered images, i.e. tuned to what a human notices when flipping
between two renders).

- **Answers:** "did anything change since the blessed build."
- **Cannot answer:** "is it right." A golden is only ever as correct as the day it was blessed, and
  for procedural content a re-key/reseed changes every pixel legitimately.
- **In our stack:** `verify-golden` (trajectory hashes, `40c18aad`) + the `renderDeltaSweep`
  readPixels harness (per-feature on/off pixel deltas, 47 features). We already have this family.

### Family D — GPU counters and frame telemetry

- **WebGL2:** `EXT_disjoint_timer_query_webgl2` provides GPU-side timing without stalling the
  pipeline. ⚠️ **Availability must be probed at runtime** (`gl.getExtension(...)`) — browsers have
  gated timer queries for timing-attack reasons at various points; do not assume it's there.
- **WebGPU:** `timestamp-query` shipped in Chrome, but **quantized to 100 µs**, and **not exposed at
  all in non-isolated contexts**; full resolution only under the "WebGPU Developer Features" flag.
- **Engine-level:** `renderer.info` (draw calls, triangles, programs, textures) is free and
  already available. **Tracy** is the reference frame profiler (nanosecond, remote telemetry,
  hybrid instrumentation+sampling, has a WASM viewer) but its Emscripten/browser story is rough
  (no raw TCP in browsers; needs a WebSocket proxy).
- **Answers:** cost and budget questions. **Cannot answer:** correctness.

### Family E — CPU-mirror property tests + domain statistics

The family that actually answers *"is the generated world right"*, and the one the games/graphics
world borrows from science rather than from renderers.

- **Property-based / invariant testing:** rather than compare to a reference, state invariants that
  must hold for *every* seed and check them over generated inputs (seed determinism, conservation,
  monotonicity, scaling laws). Standard PBT practice, directly applicable to procgen because
  procgen is a pure function of (seed, drivers).
- **Domain descriptors for terrain — this is a real literature.** Recommended terrain-quality
  metrics in the procedural-terrain research: **topographic (radial) power spectra, curvature
  distributions, drainage density, hypsometric integral**, plus compliance with geomorphological
  scaling laws — **Hack's law**, **slope–area relations**, hypsometric curves. There is even a
  published perceptual metric, **PTRM (Perceived Terrain Realism Metric)**, that scores a DEM's
  realism (ACM TAP), i.e. the field already accepts that terrain quality is *measurable*, not only
  eyeballable.
- **Domain descriptors for cratered surfaces:** **crater size-frequency distribution (CSFD)** is the
  standard planetary-science instrument — cumulative count of craters larger than D per unit area,
  log-log slope; saturation/**equilibrium SFD slope ≈ 2**; **gravity- and velocity-scaled** crater
  diameter (transient diameter as a function of projectile size/density, target density, and
  **surface gravity g**). This is *exactly* the shape of law our v2-6 gravity coherence already
  claims to implement (crater count ∝ g^0.34) — meaning it is directly checkable.
- **Answers:** "does the world obey the laws we said it obeys, across seeds, across radii."
- **Verdict for us:** **this is what Max is missing**, and it's the half nobody's tooling ships for
  you — because the descriptors are domain-specific to *our* systems.

---

## 2. What Well Dipper already has (inventory — done before proposing new machinery)

| Instrument | Where | Measures | Family |
|---|---|---|---|
| Driver probes: `plateProbe` `shellProbe` `magmaProbe` `stagnantLidProbe` `mixedProbe` `e1Probe` `provinceProbe` `grainProbe` | `world-engine-lab.html` `_lab.*` | **Inputs** — the D-vector / tune values that reached each writer, echoed arm's-length | E (partial) |
| `renderDeltaSweep()` | `world-engine-lab.html:~5233` | **Change** — per-feature on/off pixel delta fraction, 47 features, readPixels | C |
| `verify-golden` (`40c18aad`), v2-0 byte-identity | `tests/golden-trajectories/` | **Change** — trajectory hashes | C |
| vitest suite (2333 pass / 4 known-fail baseline) | `tests/` | Pure-function unit truth on the CPU mirrors | E |
| CPU mirrors: `deriveUniforms`, `craterProfile`, `reliefEnvelope`, `featureFrequencyFromKm`… | `planet-lod-lab-core.js` (1106 lines) | The generation laws, evaluable headlessly | E |
| `FloatType` RTT height read | `world-engine-lab.html:245`, `:1467` | **Output field** — but single-purpose (tributary patch / river routing), not general | B |
| `window.__wd` SceneInspector + integration/warp/phase-A suites | `src/debug/` | Game-side scene inventory + scripted behavioural assertions | E |
| `window.__diag` rebase telemetry, `__swapTiming` | `src/main.js` | Game-side event telemetry | D |
| headless calibration harnesses | `calibration/population-sweep.mjs`, `tools/giant-drivers-calibrate.mjs` | Law calibration offline | E |

**The gap, stated precisely:** we can read the **inputs** to every system (driver probes) and detect
**change** in the render (goldens, delta sweep). We have **no general instrument that measures the
produced field itself** — the actual surface, in its own physical units. That is why the only way to
answer "do craters/tectonics/rivers respond to radius?" today is to look at the screen, and why the
read-gate's band-width instrument had a **~25 % seed-noise floor** that swamped the 15 % effect we
were trying to certify (`evidence/readgate-diagnosis/DIAGNOSIS.md`).

---

## 3. Proposal

### (a) Lab instrumentation — **field probe + response curves**

Three layers, each independently useful, built in this order.

**Layer 1 — `_lab.sampleField(spec)` — the sampler.**
Render the requested channel(s) into a `FloatType` render target and `readPixels` into a typed
array. Two sampling modes: *equirect* (lat/lon grid over the whole sphere, area-weighted) and
*patch* (a km-sized window at a given lat/lon, for fine features). Channels are the quantities the
writers already compute: `height`, `slope`, `provinceId`, `craterMask`, `boundaryDist`,
`temperature`, `riverAccum`, … Output is raw numbers **in physical units** (km of relief, km of
wavelength) — not pixels — because physical units are what stay comparable across radius, and pixels
are exactly what betrayed us last time.

**Layer 2 — `_lab.describeField(samples)` — the descriptor pack.**
Statistics computed over the *whole* field, chosen deliberately so that **seed noise averages out
instead of dominating** (this is the generalisation of `DIAGNOSIS.md` rec #3 — stop comparing
different random patterns to each other):

| System | Descriptor(s) | Predicted radius/gravity response |
|---|---|---|
| substrate / relief | RMS relief (km); radial PSD slope + dominant wavelength (km); slope distribution moments; hypsometric integral | relief/R ∝ g^-0.58 (`Q_RELIEF`) — already a stated law |
| tectonics / plates | boundary length per 10⁶ km²; mean plate area (km²); lineation autocorrelation wavelength (km) | *to be established* — prime Mission-1 suspect |
| bombardment | crater **SFD** (cumulative count vs D, log-log slope); largest-crater D/R; count per 10⁶ km² | count ∝ g^0.34 (v2-6) — directly checkable |
| volcanism | edifice count density; caldera radius (km); thermal-region area fraction | *to be established* |
| rivers | drainage density (channel km per 10⁶ km²); Hack's-law exponent; hypsometric integral | *to be established* |
| atmosphere | band count; Rhines-scale wavelength; storm size distribution | rotation-driven; radius coupling *to be established* |

**Layer 3 — `_lab.responseCurve({driver:'radius', values:[…], seeds:M})` — the sweep runner.**
Sweeps one driver across N values × M seeds, collects the descriptor pack at each point, and returns
**mean ± SEM per point plus a fitted exponent**. The SEM is the whole point: `DIAGNOSIS.md` proved
that any N=1 measurement of a re-keyed field is noise-limited at ~25 %, and computed the fix
(M ≥ 3–5 to make a 15 % bar measurable at all; M ≥ 11–19 to *resolve* it at 2σ). Layer 3 makes that
arithmetic automatic instead of a post-mortem.

**What this buys immediately:** run Layer 3 over radius for every system in the table, and the output
*is* the WIRED / DEFERRED / IRRELEVANT census that Mission 1's scope interview requires — measured,
per system, with error bars, instead of asserted. Max's "I can tell that's not happening across the
board" becomes a table with numbers in it.

### (b) Game-side pipeline instrumentation

The game already has `window.__wd` (scene inventory) and `window.__diag` (rebase telemetry). Extend
the same tier rather than inventing a parallel one:

1. **`__wd.frameStats()`** — `renderer.info` (draw calls, triangles, programs, geometries, textures),
   render-target inventory + estimated VRAM, shader-program compile count/time. Free, no extension
   needed, immediately assertable from CDP in headless checks.
2. **`__wd.gpuTiming()`** — per-pass GPU ms via `EXT_disjoint_timer_query_webgl2`, **behind a runtime
   capability probe** with a documented "unavailable" path (see Family D caveat).
3. **`__wd.pipelineProbe()`** — the same field-sampler idea aimed at the game's render path: read
   back a chosen AOV from the live pipeline so the *shipped* path can be measured, not just the lab's.
   This is what closes Max's "and once outside of the lab, ditto" clause.
4. **Spector.js installed** for one-off forensics (Family A). Zero build cost, no code.

### Sequencing — and why it changes Mission 1's order

The handoff lists Mission 1 (radius across all systems) and Mission 2 (this) as two directives.
They are not parallel: **Mission 2's Layer 1–3 is the verification channel for Mission 1.** If we
scope and build Mission 1 first, its acceptance criterion ("tectonics/craters/everything adjust to
radius") is once again certifiable only by eye — the exact failure mode that produced the
UAT-failed first build and the noise-floored read-gate. Recommendation: **build Layers 1–3 first,
scoped tight to the six systems above, then run the radius census, then scope Mission 1 off the
census.**

---

## 4. Honest limits (stated up front, not after)

- **Descriptors can pass while the planet still looks wrong to Max.** They certify *laws*, not
  *beauty*. UAT stays Max's gate alone; this instrument never closes it.
- **Layer 1 requires the field to be readable.** Anything computed only in the fragment shader's
  final colour path (albedo/emissive blending, some exotic-preset sites) needs a debug-channel
  variant of the shader to expose it. That's real work and it's where the build cost concentrates.
- **Baked mesh geometry (inc3b stamped basins) is measurable but not fixable by this** — the
  mesh-floor residue stays an honest disclosed constraint.
- **M seeds costs M renders.** A 6-radius × 5-seed sweep over 6 systems is ~180 field reads. Fine
  headlessly/offline; not an interactive control.
- **`EXT_disjoint_timer_query_webgl2` availability is unverified in this browser** — treated as a
  runtime probe in the proposal, not an assumption.

---

## 5. Sources

Frame capture / browser tooling:
[WebGPU Inspector](https://github.com/brendan-duncan/webgpu_inspector) ·
[webgpu_recorder](https://github.com/brendan-duncan/webgpu_recorder) ·
[WebGPUVision](https://github.com/WonderInteractive/WebGPUVision) ·
[Spector.js](https://github.com/BabylonJS/Spector.js/) ·
[Capture WebGL with RenderDoc](https://chzhangtud.github.io/en/webgl-renderdoc/) ·
[Profiling WebGPU with RenderDoc (Toji)](https://toji.dev/webgpu-profiling/renderdoc.html) ·
[PlayCanvas GPU Profiling](https://developer.playcanvas.com/user-manual/optimization/gpu-profiling/)

Shader debug channels:
[Vulkan Debug Printf](https://vulkan.lunarg.com/doc/view/1.3.250.1/linux/debug_printf.html) ·
[Vulkan-ValidationLayers debug_printf](https://github.com/KhronosGroup/Vulkan-ValidationLayers/blob/main/docs/debug_printf.md) ·
[wgsl-debug](https://github.com/looran/wgsl-debug) ·
[HLSL printf (MJP)](https://therealmjp.github.io/posts/hlsl-printf/) ·
[printf in GLSL](https://continualai.dev/guide/printf-in-glsl/)

Golden image / perceptual diff:
[Unity Graphics Test Framework](https://docs.unity3d.com/Packages/com.unity.testframework.graphics@8.6/manual/index.html) ·
[Unreal Screenshot Comparison Tool](https://dev.epicgames.com/documentation/en-us/unreal-engine/screenshot-comparison-tool-in-unreal-engine) ·
[Unreal Automation Framework](https://dev.epicgames.com/documentation/en-us/unreal-engine/automation-test-framework-in-unreal-engine) ·
[FLIP (NVIDIA)](https://www.researchgate.net/publication/350329942_FLIP_A_Difference_Evaluator_for_Alternating_Images) ·
[SSIM in visual regression](https://wopee.io/blog/screenshot-comparison-algorithms-visual-testing/)

GPU timing / telemetry:
[EXT_disjoint_timer_query_webgl2 spec](https://registry.khronos.org/webgl/extensions/EXT_disjoint_timer_query_webgl2/) ·
[Chrome WebGPU developer features (timestamp quantization)](https://developer.chrome.com/docs/web-platform/webgpu/developer-features) ·
[Intent to Ship: WebGPU timestamp queries](https://groups.google.com/a/chromium.org/g/blink-dev/c/dtYJ0MQYMlU) ·
[Tracy Profiler](https://github.com/wolfpld/tracy)

Domain statistics (the family that answers "is it right"):
[PTRM: Perceived Terrain Realism Metrics](https://arxiv.org/pdf/1909.04610) ·
[PTRM (ACM TAP)](https://dl.acm.org/doi/10.1145/3514244) ·
[Standard techniques for presentation and analysis of crater size-frequency data](https://www.sciencedirect.com/science/article/abs/pii/0019103579900095) ·
[Equilibrium SFD of small craters](https://arxiv.org/pdf/1902.07746) ·
[Surface gravity and crater diameter as proxies of extra-terrestrial impact](https://www.sciencedirect.com/science/article/abs/pii/S0019103519300272) ·
[PSD-based terrain estimator](https://arxiv.org/pdf/1910.06066) ·
[Property-based testing](https://softwarepatternslexicon.com/functional/testing-patterns/testing-strategies/property-based-testing/)
