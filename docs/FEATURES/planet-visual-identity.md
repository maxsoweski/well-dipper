# Planet Visual Identity

**Status:** Active feature. First workstream in progress (2026-04).
**Owner:** Director for vision; PM for workstream scoping; working-Claude for implementation.

## One-sentence feature

Every natural and exotic planet type expresses its full procedural identity through rendering, so each world the player encounters telegraphs its type at a glance and its individual character through generator-driven variation.

## Source

- **GAME_BIBLE.md §5** — Natural Planet Types (catalog, per-type behavior)
- **GAME_BIBLE.md §6** — Overlay Systems (exotic + civilized variants)
- **GAME_BIBLE.md §11** — Development Philosophy (Principle 2 No Tack-On, Principle 5 Model → Pipeline → Renderer — load-bearing for this feature)
- **FEATURE_AUDIT.md §1.4** — Planetary-body scale current state
- **FEATURE_AUDIT.md §2.1, §2.3, §2.5, §2.6** — procedural data that isn't expressed (storm fields, crater distribution, palette variety, composition.surfaceType)
- **Direct Max articulation** — session 2026-04-17 (visual enhancements kickoff) + 2026-04-18 (product-manager interview, BODY_SCALE drift case)

## Vision / what the player feels

When the player drifts past a new world, the visual immediately answers "what kind of place is this?" — not by a type label, but by character. A rocky planet reads as rocky (cratered, dry silhouette, pitted at close range). A gas giant reads as gas giant (bands that flow like jet streams, swirling storms, horizon-spanning atmospheric perspective). A crystal world reads as crystal (faceted, refractive, gemstone cells). An ecumenopolis reads as inhabited (city grids, night-side glow).

Within a type, seeds produce visible variation grounded in the generator's actual outputs — no two terrestrials look alike because the generator gave them different ocean extents, cloud cover, axial tilts, atmospheric colors. The visual richness is an expression of procedural truth, not a decorative overlay.

## Success criteria

### Primary criterion — "procedural expression"

Every generator-produced field that has visual implications reaches a shader and is expressed in rendering. No generator field is silently dropped. No renderer-side field is invented that the generator didn't produce. Model → Pipeline → Renderer flows one-directional, cleanly.

**Concrete test:** grep through the Planet / Moon / AsteroidBelt shader uniforms and trace each one back to a generator-produced field. If a uniform comes from a hardcoded constant instead of generator data, flag it. If a generator field has no corresponding uniform, that's a gap.

### Per-type criteria (V1)

- **Natural (11 types — rocky, terrestrial, ocean, ice, lava, gas-giant, hot-jupiter, carbon, eyeball, sub-neptune, venusian):** each type has a characteristic silhouette and surface treatment. No two types are confusable at typical viewing distance.
- **Exotic (7+ overlays — hex, shattered, crystal, fungal, machine, city-lights, ecumenopolis):** each overlay reads as unambiguously exotic and distinct from the others. Crystal looks faceted; shattered looks fractured; fungal reads as organic; machine reads as constructed; ecumenopolis reads as urbanized.
- **Seed variation:** at 5 consecutive seeds per type, surface appearance visibly differs in generator-grounded ways (different ocean extents, different cloud configurations, different storm distributions, different cell patterns, etc.).

### Per-generator-field criteria

- `baseColor` + `accentColor` — consumed in type-appropriate roles
- `noiseScale` — used for surface detail scaling
- `radius` — used for camera LOD tiers and silhouette scale (NOT overridden downstream — see Drift risks below)
- `clouds.{color, density, scale, speed}` — consumed; animation time scale respects the BPM clock
- `rings.{innerRadius, outerRadius, composition, tilt}` — consumed when present; gaps from Kirkwood/resonance physics are visible
- `atmosphere.{color, density, rim}` — consumed for limb glow + rim treatment
- `storm.{latitude, longitude, size, angularVelocity}` (where generated) — consumed in fragment shader
- `composition.surfaceType` — consumed (currently unused per audit §2.6)

## Failure criteria / broken states

- Generator field produced but renderer-ignored (audit §2 pattern — the bulk of known drift)
- Renderer field invented without generator source (BODY_SCALE pattern — Principle 5 violation)
- Two different types render visually similar at default seed (type-identity collapse)
- All seeds within a type render visually similar (variation collapse — generator variation not reaching shader)
- Visual tweak lands on the renderer side when the underlying issue is in generation (Principle 2 violation)

## V1 / V-later triage

### V1 — must ship (current workstream scope)

- Audit completeness: every Planet/Moon shader uniform traced to a generator-produced field, gaps inventoried.
- Principle-5 drift fixed: remove renderer-side overrides of generator output (lab BODY_SCALE pattern is an example of what to find + retire).
- §2 audit items closed: storm wiring, crater distribution, palette variety fixes where tractable in one workstream.
- Each type has visible per-seed variation across at least 3 sampled seeds.

### V-later — polish, must graft on without architectural rewrite

- Full crater physics (cratering depth driven by `PhysicsEngine.computeSurfaceHistory`)
- Trojan cluster rendering (audit §2.9)
- Galaxy context metadata → system visuals (audit §2.12)
- LOD close-up tiers with enhanced detail
- Vertex displacement for mountain/ridge relief (PR5 candidate)
- Gerstner ocean waves for water surfaces (PR5 candidate)

### V1 architectural affordances for V-later items

- Shader uniforms named for generator fields, not renderer concepts (e.g., `u_craterDensity` from `composition.craterDensity`, not `u_bumpIntensity`)
- Per-object shader structure kept modular (category-split fragment shaders already exist — NATURAL_BODY, EXOTIC_BODY, GAS_BODY) so adding new uniforms doesn't blow the 20KB compile ceiling
- LOD branching points marked in-shader so close-up tiers can be wired without restructuring

## Critical architectural realizations

- **The lab is not the game.** A visual-PR lab that normalizes body scale for consistent framing is a convenience, not a preview — any shader change evaluated only in the lab risks being evaluated against fabricated data. Lab harnesses must either render at true generator-produced scale or be explicitly scoped as comparison-only tools with a disclaimer.
- **Visual similarity ≠ generator similarity.** When two planets look alike, the first question is whether the generator produced similar data or whether the renderer collapsed different data into the same output. Debug by reading generator output first, renderer second.

## Current state snapshot (2026-04-18)

- **Shipped** (on branch `feature/visual-enhancements`): Crystal F2-F1 facet edges, Fungal animated bioluminescent flicker, Gas-giant domain warp, Moon render-fidelity bug fix (update-arg drift).
- **Partial / pending** (in current workstream): PR3B (Shattered Worley + Machine/Ecumenopolis Truchet), PR4B (Rocky ridged terrain + gas-giant storm wiring), PR5 (Gerstner ocean + vertex displacement), PR6 (HDR bloom + CRT — optional).
- **Known drift retired:** lab BODY_SCALE normalization logged as Principle-5 violation; workstream brief carries the guard for future work.

## Open questions

- Should the lab be retired in favor of in-game scale previews, or reframed with an explicit "comparison harness — not game-scale" banner?
- Does the "visual identity" vision require a per-type design bible (each type's character explicitly specified) or does it emerge from the generator's existing output?
- Time-scale system (raised in 2026-04-17 review): rotation, cloud drift, storm rotation, and fungal pulse all currently use real-time-seconds. The game needs a timescale knob. Is that a workstream under this feature, or a separate cross-cutting feature?

## Related workstreams

- **`docs/WORKSTREAMS/visual-enhancements-2026-04.md`** — current workstream covering PR1–PR6 (natural + exotic + post-process) on branch `feature/visual-enhancements`.
- (Future) per-type refinement workstreams as audit §2 items close out.
