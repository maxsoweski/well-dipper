# Spec — New Planet Rendering System: Stage-A Foundation & Lab Architecture

**Date:** 2026-06-06
**Project:** `~/projects/well-dipper` (three.js / WebGL2 space game, retro dithered/posterized envelope)
**Branch:** `master` (parallel feature — does NOT touch `docs/NOW.md` active workstream or the `system-tags-save-search` branch)
**Status:** Stage-A design APPROVED (both parts) — ready for `writing-plans` → build-session handoff
**Supersedes scope framing in:** `/tmp/claude-1000/handoff-wd-planet-rendering-foundational-research-2026-06-06.md`

---

## 0. Frame (read first)

We are building an **entirely new, ground-up planet rendering system** — NOT refactoring the
old `Planet.js` type-ladder. Reason: real LOD requires it. The current system renders only
**1 LOD** (orbital) beyond billboards; `lodLevel` is declared but dead. The new system:

- builds **up in complexity from the existing 1-LOD aesthetic foundation**, keeping the
  retro/dithered/posterized envelope consistent;
- is wired **feature by feature**, each feature **driver-derived** (physics → semantic uniform);
- exists to **CHANGE the visuals** → there is **NO parity-with-old goal**. Do not propose
  golden-image parity checks against the old look;
- retires the ~50-branch `if (planetType == N)` ladder — **types become driver-bundle presets**
  (inventory Appendix A), not shader branches.

The full feature accounting is `docs/FEATURES/planet-visual-features.md` (16 drivers / 28
processes / 53 feature entries). The foundational research is
`research/RESEARCH_high-lod-planet-shaders-2026-06-05.md`.

**This spec is Stage A only.** The agreed three-stage pipeline (in `planet-visual-features.md`):
- **Stage A — Finish foundational research + lock base architecture** ← *this spec*.
- **Stage B — Per-feature research, by domain** (8 domains; parallel-subagent fan-out; begins
  once the foundation lands).
- **Stage C — Implement per-domain in the lab** (`planet-lod-lab.html`), harness-first, verified
  via chrome-devtools :9223.

---

## 1. Decisions resolved (Max's calls, 2026-06-06)

| # | Decision | Resolution |
|---|---|---|
| Platform | Mobile a target? | **Desktop-primary, graceful mobile.** Build the rich path as primary; keep cheap fallbacks (fresnel atmosphere, reduced octaves, 9-cell craters) **reachable behind the same uniforms** via a quality scalar, untuned for now. |
| §2 / Q5 | Retro envelope A/B/C + posterizer level | **Not a locked stance — a tunable axis in the lab.** Decided empirically per body type. Architecture parameterizes it (level-count slider + per-effect bypass toggles). See §2.C. **TRACKED OPEN GOAL** (§4). |
| Q7 | LOD2 scope boundary | **Surface + all layers.** LOD2 enriches surface relief AND clouds/atmosphere/aurora; convert clouds/aurora off plain `snoise` onto the `noised()` base too. |
| Lab | Control framework | **lil-gui** — folders = feature sections, auto value-readout, built-in preset save/load. One-time migration of existing ~10 hand-rolled controls. |
| Q8 | Civilized / Sol bodies | **Defer to last (Phase 4).** Baked NASA textures already carry detail; a thin procedural overlay is optional, lowest priority. |
| Q4 | Animation vs reproducibility | **RESOLVED earlier by Max (2026-06-05):** determinism binds the **static/structural layer only** (continents, craters, mountains, coastlines). The **weather layer** (clouds, storms, gas flow, lava churn, ocean waves) need NOT be reproducible across visits → FBO-accumulation sims re-opened **for weather only, never surface**. Evaluate time-animated-noise vs FBO per-effect in the harness (UX, not correctness). |

**Deferred to Stage-C harness spikes (technical forks, not Max's taste):**
- **Q2 — sphere flow-frame** (consistent tangent frame / 3D-domain noise for curl/Gerstner
  advection so poles don't pinch). *The single biggest technical risk* → dedicated spike for
  lava/ocean/gas. 3-cycle cap applies.
- **Q3 — crater Voronoi** 3D 27-cell (seamless, desktop) vs tangent-space 9-cell (cheap, mobile).
  Build **27-cell primary, 9-cell behind the quality scalar**; prototype both in the lab.
- **Q6 — single mega-shader vs compiled variants.** Build behind the quality scalar + `lodRamp`
  in a single shader now; defer the `#define LOD2` compiled-variant-bound-to-closest-body
  optimization until a real 5080 profile shows the register/occupancy tax matters.

---

## 2. Part 1 — Base architecture (what every feature plugs into)

### A. Noise foundation (shader)
- Swap finite-diff normals → **analytic-derivative `noised()`** returning `vec3(value, dH/dx, dH/dy)`
  (exact normals free). Per Q7, convert surface **and** clouds/aurora onto this base.
- **Variable-octave FBM loop:** `octaves = mix(4.0, 9.0, lodRamp)`, fractional trailing-octave
  weight, `const int MAX_OCT` bound + runtime `break`.
- **fwidth octave clamp** ships alongside the variable loop — without it the new octaves shimmer
  under the dither. These two are inseparable.
- **Body-local noise space** preserved: never pass `vWorldPos` into `computeHeight`. (Separate
  from the ship-scale rebasing problem in `PLAN_world-origin-rebasing.md`; unaffected by it.)

### B. LOD plumbing
- CPU-side **`lodRamp = smoothstep(20.0, 6.0, dist/radius)`** uniform replaces the dead `lodLevel`.
- **Hysteresis** (enter 18 / exit 22 radii) on the discrete which-body-is-LOD2 flag to stop flicker.
- One scalar drives all complexity (octaves, detail amplitude, layer enable).

### C. Envelope as a tunable axis (the §2 decision, made structural)
- Final composite **splits** into:
  `posterize(surface, posterizeLevels) + emissiveGlow + specGlint + limbGlow`.
- **`posterizeLevels`** uniform (slider 6→16) — covers A/C (at 6) vs B (higher).
- **Per-effect bypass toggles** — `emissiveBypass`, `specBypass`, `limbBypass` — each term skips
  the quantizer or runs at a higher level count. Covers A (all off) vs C-per-effect.
- **Dither mode** toggle: Bayer (low N) ↔ IGN / triangular-PDF (needed when levels pushed high).
- Net: A, C-per-effect, and B-via-levels are all **reachable from lab controls**. The look is
  settled empirically, per type — not pre-committed.

### D. Driver → semantic-uniform scaffolding (the generation-side foundation)
- Generalize the **existing aurora/atmosphere precedent** (`Planet.js:1051, 1070-1076`):
  `PlanetGenerator` derives feature params CPU-side from the physics drivers **already present in
  `planetData`** (`composition`, `T_eq`, `tidalState`, `surfaceHistory`, `atmosphere`,
  `habitability`, `rotationSpeed`, `axialTilt` — returned at `:679-707`); passes them as
  **semantic uniforms**; the shader consumes them generically with **no `planetType` branch**.
- **Types = driver-bundle presets** (inventory Appendix A). Picking a "type" loads a bundle of
  uniform values; it is not a code path.

### E. Quality scalar (the "graceful mobile" call)
- A **`qualityTier`** scalar scales: octave budget, crater cell-count (27↔9), atmosphere model
  (Lague raymarch ↔ fresnel). Desktop = full. The cheap path is reachable behind the same
  uniforms but **untuned now**.

### F. Shader-variant strategy (Q6)
- Single shader behind `qualityTier` + `lodRamp` now. Compiled `#define LOD2` variant deferred
  until a 5080 profile justifies it.

---

## 3. Part 2 — Lab structure (the experimentation surface)

`planet-lod-lab.html` is the Stage-C harness AND the surface on which Max settles every taste
decision. Currently ~711 lines, single file, **flat hand-rolled `<div class="row">` controls**
(pixelScale, octaves, posterize-lv [already 2–16], perturb, type, normal-mode, macro/detail seed
steppers, copy-settings, pointer/wheel camera). Flat rows do not scale to 8 feature domains.

### Control framework: migrate to lil-gui
Folders = feature sections, collapsed by default except the active one:

- **`▸ View & LOD`** — camera distance (drives `lodRamp`), `lodRamp` manual override + slider,
  octaves (`mix 4→9`), fwidth-clamp toggle, pixelScale, normal-mode debug. *Always-open panel.*
- **`▸ Envelope`** — `posterizeLevels` (6→16), dither mode (Bayer / IGN-triangular),
  `emissiveBypass` / `specBypass` / `limbBypass` toggles. *The A/B/C decision surface.*
- **`▸ Surface — Relief`** — analytic-FBM base, ridged / slope-damped / billow mix, height-warp.
  (F-relief / F-gradational — the **widest current gap**, dead-`lodLevel` story.)
- **`▸ Fluvial`** · **`▸ Aeolian`** · **`▸ Cryo / Sublimation`** — other surface domains.
- **`▸ Bands & Storms`** — gas/ice-giant banded FBM, domain warp, storm-mask swirl.
- **`▸ Clouds & Haze`** — clouds-as-relief, cloud-shell parallax, terminator shadow.
- **`▸ Optical / Atmosphere`** — fresnel (default) vs Lague raymarch (desktop), aurora.
- **`▸ Exotic / Overlay`** — RD-LUT / fake-Turing, artificial/biotic compositing (P27/P28).
- **`▸ Seeds`** — macro/detail seed steppers (built), new-planet, reset.
- **`▸ Presets`** — lil-gui save/load. "Favorite-planet baseline" lives here; also the hook for
  the later seed-tags/share feature.

### Two structural rules that make it scale
1. **Folders mirror the driver-bundle model, not the type ladder.** A "planet type" is a
   **preset** that sets folder values — not a shader branch. Lab and architecture tell one story.
2. **Every control is a semantic uniform, declared once.** Adding a Stage-C feature = uniform in
   the registry + one `folder.add(...)` line + its shader code. No bespoke per-control HTML wiring.

### Stays as-is
Pointer/wheel camera; copy-settings export (migrates to lil-gui export so it round-trips with
presets); GPU-Chrome :9223 verification loop.

### Out of scope for the lab now
Real-time fluid FBO sims (the Q4 weather-accumulation path) — Stage-C harness spike, not a
foundation control.

---

## 4. Tracked open goal (do NOT close)

**"Retro envelope settled per-type in the lab."** Max's decision was explicitly *"I'll need to
experiment to verify — that's why we have the variable sliders."* The envelope (A/B/C, posterizer
level, per-effect bypass) is therefore an **empirical decision made via the lab controls in
§3**, not a resolved value in this spec. The build delivers the *controls*; settling the *values
per body type* is downstream playtesting. Keep this open until Max signs off per type.

---

## 5. Build sequence (for writing-plans)

Maps to research §5 Phases 0–1 (the foundation), reordered to land the lab framework first so
every later step is verifiable through it.

1. **lil-gui migration** of the existing lab controls (no behavior change — pure framework swap,
   regression-verify the current planet still renders identically). Establishes the folder shell.
2. **Analytic-derivative `noised()` swap** in the lab shader (surface first). Regression-verify
   the normal looks identical to finite-diff at LOD1 before adding anything.
3. **`lodRamp` uniform + hysteresis** (CPU-side) — the genuine dead-`lodLevel` gap-fill.
4. **Variable-octave FBM + fwidth clamp** (ship together). *Quick win:* getting close now *feels*
   like more detail, posterization-safe, no new visual systems.
5. **Envelope composite-split** (§2.C) + its `▸ Envelope` folder controls.
6. **Driver → semantic-uniform scaffolding** (§2.D) + **`qualityTier` scalar** (§2.E) wiring —
   the generation-side foundation that Stage B features plug into.
7. **Convert clouds/aurora onto `noised()`** (Q7 all-layers) — completes the foundation's scope.

**Harness-mandatory before any production `Planet.js` change:** the noise swap and every visual
mechanism, per MEMORY.md isolated-test-harness rule. **3-cycle cap** on any mechanism that fails
research→implement→test 3×. Likeliest cap-hit candidates: sphere-tangent flow advection (Q2),
Lague raymarch perf/banding.

**After the foundation lands → Stage B:** dispatch 8 per-feature research agents (model opus),
one per domain (relief, fluvial, aeolian, cryo/sublimation, bands/storms, clouds/haze, optical,
exotic/overlay). Each researches BOTH render-technique and generation-path (`D#`→`P#`→uniform).
This is the parallel-subagent fan-out; the foundation is not.

---

## 6. Execution model (decided 2026-06-06)

- **Stage-A foundation is NOT a subagent job.** One tightly-coupled GLSL shader + one lab HTML
  file; parallel edits collide; verification is a live eyes-on chrome-devtools :9223 loop driven
  on the main thread (dev-collab OS). Build it in **one focused session, TDD'd, visually
  checkpointed**. Forcing subagents here risks merge collisions + a compiles-but-looks-wrong
  result — the exact failure the harness-first rule prevents.
- **Stage B research IS a subagent fan-out** (§5). **Stage C** per-domain implementation can be
  worktree-isolated subagents once the foundation is locked, but each domain still wants the
  live visual-verification loop.
- **Handoff:** this spec + the `writing-plans` output go to a **fresh build session** (clean
  context beats this loaded one for a careful shader build).

---

## 7. Key code grounding (verified, don't re-discover)

- Physics already in `planetData` — `PlanetGenerator.generate()` returns physics + derived visual
  fields at `:679-707`.
- Aurora/atmosphere semantic-uniform precedent — `Planet.js:1051, 1070-1076` (consumed with no
  type branch). This is the pattern the whole system generalizes (§2.D).
- The ladder to retire — `Planet.js` fragment shader `:253–:904` (~50 `if (planetType == N)`);
  `planetType` from `_typeIndex()` `:1262-1269`; family dispatch `:1034-1036`.
- Dead/partial wiring — `lodLevel` declared `:44` / defaulted `:1077`, never read → zero LOD2.
  `RingRenderer.js` dead. Gas `storms.spots`/`polarStorm` generated `(:649, 693)` but unwired.
- `Moon.js` has PARTIAL LOD2 (branches `lodLevel >= 2` at 355/441/459) but only `moonType 0|1`.
- PhysicsEngine exports 31 driver functions.
- `planet-lod-lab.html` (untracked) — Stage-C harness, API `window._lab`.

## 8. Working discipline (carry-forward)
- Don't start dev servers — Max runs Vite; connect via chrome-devtools :9223
  (`mcp__chrome-devtools__*`), NOT Playwright. See `memory/well-dipper-testing-reference.md`,
  `memory/chrome-devtools-9223-launch.md`.
- Tone: zero affirmations; flag risks/uncertainty up front; re-anchor to the §0 frame before scoping.
- Every `Agent(...)` call includes `model: "opus"`.
- three.js r183.1 — `library-context` brief at `~/.claude/state/library-context/well-dipper.md`.
