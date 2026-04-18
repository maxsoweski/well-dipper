# Workstream: Visual enhancements — April 2026

**Status:** Active. PR1–PR4 shipped (partial); PR3B, PR4B, PR5, PR6 pending.
**Branch:** `feature/visual-enhancements`
**Bootstrap:** 2026-04-18 — first workstream brief under the new FEATURES/WORKSTREAMS structure.

## Parent feature
`docs/FEATURES/planet-visual-identity.md`

## Implementation plan
N/A (feature is workstream-sized — no separate PLAN_ doc needed; the feature doc's V1 triage is sufficient architectural guidance).

## Scope statement

A six-PR sequence of targeted improvements to the planet + exotic-planet + post-process rendering pipeline that closes gaps between generator output and on-screen appearance. What makes this a single workstream rather than a loose bundle: every PR expresses existing generator data that wasn't reaching a shader, or establishes lab tooling to evaluate that expression. Shared infrastructure (common GLSL helpers, visual-lab harness, post-process pipeline) ships early so later PRs land on solid ground.

## How it fits the bigger picture

Advances `planet-visual-identity` feature's V1 scope: closes a subset of FEATURE_AUDIT §2 items (procedural data that isn't expressed) — specifically the ones tractable in one workstream. Aligns with **GAME_BIBLE §11.2 (No Tack-On)** — every PR is a generation → renderer wiring, not a cosmetic filter.

## Acceptance criteria

- **PR1:** Common GLSL helper module extracted; ≥20 duplicate GLSL blocks consolidated with no regressions. *Shipped (commit `7ba21d5`).*
- **PR2:** Visual-lab post-process pipeline with individually-toggleable Pixelation, Vignette, ACES — each producing a distinct visible effect on at least one test body. *Shipped (commit `044ec38`).*
- **PR3 (partial):** Crystal renders with visible polygonal facet seams (F2-F1 Voronoi); Fungal glow spots drift and breathe over time. Both verified visually. *Shipped (commit `794a027`).*
- **PR4 (partial):** Gas-giant bands visibly wiggle/flow (jet-stream-like) rather than being perfectly horizontal. *Shipped (commit `4080378`).*
- **PR3B (pending):** Shattered uses F2-F1 Worley for crystalline fracture; Machine/Ecumenopolis use Truchet tiles for procedural circuit patterns.
- **PR4B (pending):** Rocky planets gain ridged multifractal terrain; gas-giant storm uniforms wire through with time-based rotation.
- **PR5 (pending):** Ocean planets render Gerstner wave displacement; applicable types gain vertex displacement for terrain relief.
- **PR6 (optional):** HDR bloom + CRT toggle evaluated; ship only if they advance the retro aesthetic without violating Principle 3 (per-object retro, not screen-wide filters).
- **Workstream-level:** every shipped PR has Playwright-screenshot visual verification; every commit has programmatic-and-visual confirmation; no renderer-side overrides of generator output.

## Principles that apply

From `docs/GAME_BIBLE.md §11` Development Philosophy:

- **Principle 2 — No Tack-On Systems.** Load-bearing. Every PR in this workstream exists because generator data wasn't reaching a shader. The fix is always in the pipeline, never in a post-hoc overlay. If a PR's acceptance criterion can only be met by "paint it on top of the rendered image," the PR is wrong-shaped and should be rewritten as a generation/pipeline change.

- **Principle 5 — Model → Pipeline → Renderer (one-directional).** Load-bearing, previously violated in this workstream (see Drift risks). Every shader uniform must trace back to a generator-produced field; the renderer must not invent data or override generator output. When a lab harness needs "nicer framing" or "consistent silhouette," find a camera-side solution — never a data-override solution.

- **Principle 3 — Per-Object Retro Aesthetic.** Relevant for PR2 and PR6. The lab's post-process pipeline is a *lab* convenience for visual comparison — production rendering keeps dither/posterize per-object in fragment shaders. Any PR considering a screen-wide filter for production must be flagged and re-scoped.

- **Principle 6 — First Principles Over Patches.** If any PR in this workstream requires 2–3 rounds of patching to reach its acceptance criterion, stop and re-architect. The lab's `pixelation` effect is an example: the UV-snap implementation produced visible band artifacts on a single round; the correct fix is render-to-smaller-target + nearest upsample (the pattern production's RetroRenderer already uses), not another UV-snap patch.

## Drift risks

- **Risk: Renderer-side override of generator output.**
  **Why it happens:** Lab/tool UX convenience — wanting "consistent framing" or "predictable silhouette" across wildly different body sizes. Feels harmless because it's "just the lab."
  **Guard:** The lab must render at generator-produced scale. If framing feels awkward across sizes, fix the camera (log-scale zoom, adaptive framing) or disclaim the lab as comparison-only. Never rescale generator fields to satisfy a UX goal.
  **Prior incident:** 2026-04-17 — `BODY_SCALE = 2.0` normalization in `visual-lab.html` forced all bodies (moons 0.02 R⊕ through hot-jupiters 10 R⊕) to the same display radius, and rescaled `noiseScale`/`cloud scale`/`rings` to "match." Shader changes were then evaluated against fabricated data, not generator truth. Violated Principle 5 directly.

- **Risk: Visual tweak lands on renderer when underlying issue is in generation.**
  **Why it happens:** It's faster to adjust a uniform or a multiplier in the shader than to trace what the generator produced. Quick fix in the wrong place.
  **Guard:** For any visual-quality concern, *first* check what the generator produced for the affected field — grep through `src/generation/`, print the field values in a test. If generator is wrong, fix there. Only reach for shader edits when the generator's output is correct but the shader is dropping or misexpressing it.

- **Risk: Lab-only validation passing when production fails.**
  **Why it happens:** Lab harness and production renderer have different pipelines (no RetroRenderer pixelScale in lab; no HUD compositing; different post-process stack).
  **Guard:** Any shipped PR requires validation against production rendering, not just lab rendering. For shader changes, test in-game via the main build (not just `visual-lab.html`). Use Playwright on the running game, not just the lab.

- **Risk: Per-type visual similarity across seeds.**
  **Why it happens:** Generator seed variation exists but isn't reaching the shader; OR shader effectively ignores the varied fields.
  **Guard:** For each PR affecting a planet type, screenshot 3 consecutive seeds and confirm visible variation. If seeds render identically, it's a drift.

## In scope

- Planet shader modifications (src/objects/Planet.js — NATURAL_BODY, EXOTIC_BODY, GAS_BODY)
- Moon shader modifications where they parallel planet changes
- Asteroid belt shader (if any PR touches it)
- Visual-lab harness (visual-lab.html) — maintained as a comparison tool with explicit scale-fidelity rules
- Shared GLSL helpers module (src/rendering/shaders/common.glsl.js)

## Out of scope

- Production RetroRenderer composite-pass changes (redirect to a `retro-pipeline-upgrade` workstream if needed)
- New planet types or overlays (redirect to `planet-type-expansion` workstream)
- Galaxy/sky/nebula rendering (different feature — out of `planet-visual-identity`)
- Warp/portal rendering (parallel session; different feature)
- Time-scale system (raised in 2026-04-17 review) — separate workstream under a future `time-scales` feature if promoted

## Handoff to working-Claude

You are operating inside the `planet-visual-identity` feature. Before touching any shader, confirm the change expresses a generator-produced field rather than inventing data renderer-side. For each PR:

1. **Read the generator first.** What does `PlanetGenerator.generate()` (or `MoonGenerator`, etc.) produce for the field you're about to render? Are you consuming that field, or substituting a hardcoded value?
2. **Test at generator-produced scale.** Any in-lab validation must run at generator-produced body radius, NOT the normalized lab radius. If the lab still has BODY_SCALE normalization when you read this, remove it or explicitly disclaim the lab's output.
3. **Screenshot 3 seeds.** For any shader change affecting a planet type, capture 3 consecutive seeds via Playwright and confirm visible variation. If seeds render identically, investigate before shipping.
4. **Per-object retro, per Principle 3.** Any post-process effect added to production must be per-object in the body's fragment shader, not a screen-wide pass. Screen-wide passes are lab-only.
5. **Commit + push per PR.** Each PR lands as its own commit on `feature/visual-enhancements` with programmatic + visual verification artifacts referenced in the commit message (path to screenshot in /tmp/ or checked-in qa-results/).

"Done" for this workstream: all pending PRs either shipped or consciously deferred with rationale in the feature doc's V-later section; visual-identity test (3-seed-per-type variation) passes for every natural + exotic type touched; no Principle-5 violations remain in the lab.

---

## Progress log

**2026-04-17 (initial session):**
- PR1 shipped — GLSL helpers module.
- PR2 shipped — lab post-process (pixelation / vignette / ACES).
- PR3 partial shipped — Crystal F2-F1, Fungal animated.
- PR4 partial shipped — Gas-giant domain warp.
- Lab harness BODY_SCALE drift identified; moon render-fidelity bug fixed.

**2026-04-18 (product-manager interview + bootstrap session):**
- `planet-visual-identity` feature doc drafted (this workstream's parent).
- This workstream brief drafted under new FEATURES/WORKSTREAMS structure.
- Director/PM/Working-Claude role separation formalized; agents live at `~/.claude/agents/`.
- Drift risks above updated to encode BODY_SCALE case as named prior incident.

**Pending next:** PR3B (Shattered Worley + Machine/Ecumenopolis Truchet). Reviewer feedback from 2026-04-17 on visible-effect tuning (vignette stronger, ACES visibility, pixelation band artifact, gas-giant warp variability) carried into PR3B scope.
