# Audit — Is the feature-association manifest a *functional* system?

> **Companion to** `2026-06-14-lab-feature-association-manifest-and-ui.md`.
> **Question (Max, 2026-06-14):** audit `planet-feature-associations.js` from first
> principles — is it *functional*, not merely *internally consistent*? Design the
> pass/fail criteria first, then assess. This is a falsification pass, not a polish pass.

## TL;DR verdict

The manifest is **neither proven-functional nor yet fully internally-consistent.** The
handoff's premise ("structurally sound, just functionally unproven → build the GPU
render-delta harness next") is **partly refuted**: there is a *cheaper static tier* sitting
between the 6 existing tests and the GPU harness. That tier is unbuilt, and when run by hand
it **fails in several places that are provable headless against the shader** — no GPU needed.

Three tiers of "correctness", only the first of which the current tests touch:

| Tier | What it proves | Cost | Status |
|---|---|---|---|
| **0 — self-consistency** (6 existing tests) | completeness, valid enums, refs resolve, provinceGroup pinned to `PROVINCES` | headless, built | ✅ green |
| **1 — cross-source consistency** (this audit) | `rendersOn` strings real; `modifies`⇄`dependsOn` agree with shader call-order + `liquidMask` reads; `isolationKit` closed; `rendersOn` vs archetype membership | **headless, UNBUILT** | ❌ **~6 grounded defects + 4 model tensions** |
| **2 — correspondence to the rendered planet** | enabling X+kit actually paints pixels; `rendersOn` matches measured A/B delta; disabling a dep actually changes output | **GPU :9223 (Phase 2.5)** | ⬜ unproven |

**Recommended order:** build Tier-1 tests + fix the grounded defects + resolve the 4 model
tensions with Max **before** building the Tier-2 GPU harness. Rationale: Tier 2 measures the
*planet* to infer whether a *manifest edge* is right; if the edge is wrong on its face (e.g.
`massWasting` is missing 12 of its 20 real upstreams), the GPU sweep can't disambiguate
"feature is buggy" from "manifest was wrong" — you'd be calibrating against a broken ruler.

A second, sharper finding: **a large part of what the handoff assumed needs a GPU — the
dependency edges (`dependsOn.features`/`modifies`) — is groundable headless against the
shader.** The combiner call-order + the `inout grad` / `liquidMask` reads ARE the source of
truth for the dependency relation. So the dependency claims (3 & 6 below) get a *static*
functional test, not just a GPU one.

---

## Part 1 — Pass/fail criteria (the functional-test spec)

Each row is a falsifiable claim the manifest makes. "Tier" = cheapest infra that can
falsify it. A claim is **functional** (vs merely consistent) when its test compares the
manifest to something *outside the manifest* — the shader, or the rendered planet.

| # | Claim | Pass / Fail test | Tier | Priority |
|---|---|---|---|---|
| **1** | every `rendersOn` string is a real preset | string ∈ `Object.keys(DRIVER_PRESETS)` (the 17). FAIL on any miss | 1 static | high (trivial, currently untested) |
| **2** | `provinceGroup` = `PROVINCES[k]` affinity | already pinned (tests 5–6). Functional *spatial* co-location (same-group features cluster) is Tier-2, low pri | 0/2 | low |
| **3** | `dependsOn.features` / `modifies` record the **real shader couplings** (`grad` accumulator, `liquidMask`, `fluvialWet`, `canyonHeight`) | extract couplings from the combiner call-order + which combiner reads which `inout`/mask; every real read-edge present, no spurious edge, **`modifies` is the exact inverse of `dependsOn.features`** | **1 static** (shader-grounded) | **high** |
| **4** | `isolationKit` makes X render in-context | (4a static) kit ⊇ X's transitive feature-deps; (4b GPU) X+kit yields non-black A/B delta on ≥1 `rendersOn` preset | 1 + 2 | high |
| **5** | `rendersOn` ⇔ where X actually renders (false-render / dead-render) | GPU A/B delta per (preset×feature): delta>ε **iff** preset∈`rendersOn`. This is Phase 2.5 | **2 GPU** | high |
| **6** | `dependsOn.features` is causal | GPU: disabling Y measurably changes X's output (or X can't render w/o Y) | 2 GPU (3 is the static proxy) | medium |
| **7** | `rendersOn` is coherent with archetype membership | each `rendersOn` preset ∈ union of `ARCHETYPES[FEATURES[k].archetypes].presets`, **OR** the divergence is explicit & the panel's `[]`-fallback handles it | 1 static | medium (model decision) |
| **8** | `dependsOn.drivers` complete | each driver name ∈ the real driver set (`deriveUniforms`/`applyDrivers`); none stubbed | 1 static | medium |

Tier-1 pass bars are exact and automatable as vitest (extend `feature-associations.test.js`).
Tier-2 pass bars need the live harness (`renderDeltaSweep()`, GPU :9223) — eps-thresholded
summed-abs pixel delta on the low-res `_lab.sceneTarget`, ~5-frame settle, non-destructive solo.

---

## Part 2 — Assessment against the criteria (what's already determinable)

Run headless: `node` cross-check of the manifest vs `planet-archetypes.js` + grep of the
shader call-order in `world-engine-lab.html`. (Throwaway script logic is reproduced in §Appendix.)

### Claim 1 — rendersOn validity → **PASS, but untested**
0 of the ~250 `rendersOn` strings reference a non-existent preset. Clean today — but **nothing
in the suite enforces it**; a typo would pass all 6 tests and silently drop a feature from its
preset in the future panel. → add the one-line test.

### Claim 3 — dependency edges vs shader → **FAIL (the headline)**
Grounded against the shader, not guessed:

- **`massWasting.dependsOn.features` lists 8; the shader feeds it 20.** The F19 contract
  (`world-engine-lab.html` ~L3107, L3131-3135) is explicit: *every combiner above the
  `massWastCombiner` line writes `grad` additively, and F19 derives its gate from
  `gradIn − gradBase`.* Counting the call order (L3117-3137), **20 features write `grad`
  before the F19 read**; the manifest names only `mountains,canyons,scarps,plateaus,tessera,
  edifices,chaos,craters`. **Missing 12:** `rivers, outflow, karst, ejecta, facets, hexTess,
  shatter, machine, ecumenopolis, cryoRidge, sublimation, glacial`. Those same 12 *do* carry
  `modifies:['massWasting']` — so the **write-side is right, the read-side is 60% incomplete.**
  Downstream features (`dunes,dust,lava,carbon,deltas`, all below the F19 line) correctly
  absent. ⇒ not a too-strict check; a real, shader-confirmed factual error.

- **frost, dust missing their `lakes` dependency.** Both read `*= (1 − liquidMask)`
  (L3212, L3215); `liquidMask` is owned by lakes (L3160, gated by `lakesEnabled` L7144).
  Manifest has `lakes.modifies ∋ {frost,dust}` but `frost.dependsOn.features = dust.…= []`.
  Asymmetric; shader confirms the edge is real → add it.

- **sunglint missing `lakes` dependency AND isolationKit.** `spec *= liquidMask` (L3928);
  the shader even hard-codes the proof (L4938: *"solo('sunglint') must re-enable lakes"*).
  Manifest: `sunglint.dependsOn.features=[]`, `isolationKit=[]`. Wholly missing edge — a
  feature that renders nothing alone, with no kit to fix it. (The static symmetry check
  can't catch this one because the edge is *absent*, not asymmetric — it needs the
  shader-extraction test, or Tier-2.)

- **cityLights missing `lakes` dependency.** Reads `liquidMask` (L3696-3699). `dependsOn.features=[]`.

- **`lakes.dependsOn.features:['rivers']` is SPURIOUS.** lakes is a level-set cut on `h`
  (L3160-61: `smoothstep(uSeaLevel±, h)`), independent of rivers — it floods wherever
  `h < seaLevel`. The author inferred "lakes needs rivers" from prose; the shader contradicts
  it. ⇒ **delete the edge** (this also dissolves the lakes branch of the isolationKit finding).

### Claim 4a — isolationKit transitive closure → **FAIL (2 cases, after the lakes fix)**
- `lakes`: empty kit — but with the spurious rivers-dep removed, lakes needs no kit (level-set). ✓ after fix.
- `coastlines`: kit `[lakes]`; depends on lakes (real, L3179) which is level-set → likely sufficient. Confirm at Tier-2.
- `massWasting`: kit `[mountains,canyons]` = 2 of 20 deps. **Not a defect — deliberate
  representative subset** (2 steep hosts are enough to make talus). This is the model tension
  below: `isolationKit` is a *judgment* field ("enough to render"), not "all deps", so a
  hard closure test would be wrong here.

### Claim 7 — rendersOn vs archetype → **FAIL (1 case, exposes a model gap)**
`hexTess.rendersOn = ['Frozen (airless)']` but its only archetype is `exotic-geometric`
(preset `Crystal (faceted)`). So hexTess claims *"I'm a member of the Crystal archetype but
I render on Frozen, NOT on Crystal."* This is a real, documented divergence
(`planet-archetypes.js` L112-117: *"rides 'Frozen (airless)'"*). It means **`rendersOn` and
`FEATURES.archetypes` are two independent registrations that can contradict**, and the
panel's planned fallback — *"`rendersOn:[]` ⇒ show under all archetype presets"* — is
**incoherent for divergent features**: for hexTess the archetype preset is exactly where it
does *not* render. Decision needed (see tensions).

### Claim 8 — driver completeness → **16/47 stubbed (34%)**
`dependsOn.drivers:[] // TODO` for: `bands, jets, weatherBands, greatSpot, stormTrain,
polarVortex, lightning, terminator, carbon, facets, hexTess, shatter, bioMats, machine,
cityLights, ecumenopolis` — i.e. **all** atmosphere-dynamics + exotic + overlay features. The
driver-dependency relation simply **isn't claimed** for a third of features. Not "wrong",
but "functional w.r.t. drivers" is false by ~34% coverage until filled or scoped out.

### Clean checks (grounded PASS)
- No self-references in `dependsOn`/`modifies`/`isolationKit`.
- No `isolationKit` member that shares zero archetype-presets with its host.
- All `rendersOn` strings valid (Claim 1).

---

## Part 3 — Data-model critique (the "first principles" part)

The defects above are symptoms; the schema choices that *let* them happen:

1. **`modifies` and `dependsOn.features` are not enforced inverses — and the asymmetry is
   exactly where the errors live.** Every asymmetric edge, grounded against the shader,
   resolved to a *missing read-edge* (massWasting, frost, dust) or a *spurious edge*
   (lakes→rivers). A symmetry-enforcing test would have forced all of them to the surface at
   authoring time. **Recommendation: make `modifies` derived from `dependsOn.features`
   (single source) — or keep both and add the inverse-edge test.** Don't hand-maintain two
   directions of the same relation.

2. **`dependsOn` conflates two different relations.** *Driver* deps (X reads a physical
   uniform) and *feature* deps (X reads another feature's shader output) are different kinds
   of edge with different tests (driver = enum check; feature = shader-coupling check). The
   schema already splits the *field* (`{drivers, features}`) — good — but the audit/UI should
   treat them as two relations, not one "depends-on".

3. **`isolationKit` is a judgment field masquerading as data.** It means "enough also-enabled
   features to make X render meaningfully", which is *deliberately* a subset of deps
   (massWasting: 2 of 20). So it can't be pinned by a closure test; only Tier-2 ("kit yields
   non-black") can validate it. Name it as judgment; test it only at Tier 2.

4. **`rendersOn` is a flat per-feature list, but rendering is `(preset × feature ×
   enable-state)`.** It also silently competes with `FEATURES.archetypes` as a second
   registration (Claim 7). Two sub-decisions for Max:
   - Is per-feature flat enough, or does behavior vary by preset within the list? (Tier-2 sweep answers.)
   - When `rendersOn` and archetype membership disagree (hexTess), which wins in the panel,
     and is the `[]`-means-"all archetype presets" fallback retired in favor of
     "render-audited" vs "unaudited" flags?

5. **`isolationKit` may need to be preset-specific.** The kit to render deltas on Rocky
   (needs a wet sea) differs from Titan. A single per-feature kit may be insufficient — Tier-2
   sweep across presets is the only way to know. Flag, don't assume.

---

## Recommended next actions (audit output — not executed this session)

1. **Tier-1 tests** (extend `tests/feature-associations.test.js`, all headless):
   `rendersOn`-validity (Claim 1); `modifies`⇄`dependsOn.features` inverse-edge (Claim 3);
   `rendersOn` ⊆ archetype-union *unless flagged-divergent* (Claim 7); driver-name validity (Claim 8).
2. **Fix the grounded defects:** complete `massWasting` deps (+12); add `lakes` to
   frost/dust/sunglint/cityLights `dependsOn`; delete spurious `lakes→rivers`; add `lakes` to
   sunglint `isolationKit`. (Consider auto-deriving `modifies` from `dependsOn` instead.)
3. **Resolve the 4 model tensions with Max** (symmetry-derivation; rendersOn-vs-archetype
   winner; isolationKit-as-judgment; preset-specific kits) — these are decisions, not code.
4. **Then** build the Tier-2 GPU render-delta harness (Phase 2.5) for Claims 4b/5/6 — now
   measuring against a manifest that no longer contradicts itself or the shader.

## Appendix — reproduce the static checks
- Manifest×data cross-check: `node` importing `FEATURES,ARCHETYPES,PROVINCES` +
  `ASSOCIATIONS`; checks A–G (preset validity, archetype-union, modifies/dependsOn symmetry
  both directions, isolationKit transitive closure, self-ref, kit archetype-compat).
- Shader grounding: combiner call-order `world-engine-lab.html` L3117-3137 (grad writers before
  the F19 line ~L3137); `liquidMask` writer L3160 + readers L3179/3212/3215/3696/3928; lakes
  level-set L3160-61; sunglint-needs-lakes hard-coded note L4938.
- 17 presets = `Object.keys(DRIVER_PRESETS)`, lab L5326-5520.
