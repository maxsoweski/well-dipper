# F11 — Fluvial river networks & valleys (lab) — design spec

**Date:** 2026-06-07 · **Feature:** F11 (Fluvial domain, first of the
gradational-landform campaign) · **Surface:** `planet-lod-lab.html`
(`window._lab`) · **Status:** design APPROVED by Max 2026-06-07; **AUDITED
2026-06-07** (implementing session — findings folded in below, see §Audit).

**Campaign context:** first feature in the
[planet-lod feature-completion campaign](../../FEATURES/planet-lod-campaign-tracker.md)
— finish the lab feature set F11→done in build-sequence order, full-ceremony
per feature. Order + rationale: `docs/FEATURES/planet-visual-features.md`
(F11 row + §"Build sequence"). HOW reference:
`research/RESEARCH_high-lod-planet-shaders-2026-06-05.md` (stream-power row,
terrestrial row).

**Scope:** lab only. No production `Planet.js` wiring (separate later effort,
no parity goal). "Done" = working + visually verified on GPU Chrome `:9223`.

**Retro envelope:** strict (Option A) — all relief/albedo, funnels through the
existing 6-level `posterize`. No bypass channel.

---

## Goal

Render branching river/valley **networks** as relief carved into the planet
surface, driver-gated so they appear only where a flowing liquid is (or was)
stable, covering the four F11 variants the inventory lists: dendritic network,
single-trunk + tributaries, meanders, relict (degraded). They must read as
*rivers* — visibly branching — even through the 6-level posterize + 4×4 Bayer
dither, on the whole-planet→LOD2 view.

**Chosen approach (Max, 2026-06-07): procedural drainage networks.** Not pure
analytic erosion (undersells — no visible network), not a baked drainage LUT
(needs a bake/texture/UV pipeline the lab doesn't have). Procedural per-fragment
channel-drawing, gated toward low ground, fits the lab's existing combiner
pattern with no new machinery.

## Lab pattern this must fit (verified 2026-06-07)

Every feature is a per-fragment GLSL `xxxCombiner(vPos, h, grad)` that ADDS a
height delta + chain-rule gradient onto the analytic-noise base; a single
`perturbAnalytic(N, grad, reliefAmp)` then bends the normal so everything lights
correctly. Anchors in `planet-lod-lab.html`:

- Shared `canyonHeight` accumulator declared at **:1407**; relief writes tectonic
  graben; **"Fluvial incised gorges … ADD IN at stages 3/4"** (:1406, :1427).
- Combiner call site **:1429–1441** (inside the `uNormalMode != 1` analytic
  branch); `canyonCombiner(vPos, h, canyonHeight, grad)` at **:1432** is the
  closest existing pattern (writes the shared accumulator).
- Stage-4 FLUVIAL placeholder comment at **:1451–1453** ("placeholders until
  their domains land").
- Fluvial data uniforms ALREADY surfaced at **:1692–1694**: `uLiquidStability`
  (0..1 liquid on/off gate — *owner Fluvial*), `uLiquidMask` (coverage),
  `uLiquidSpecies` (0=water 1=methane/ethane).
- Enable flags live in `state` (~**:1923–1936**, e.g. `cratersEnabled`); GUI
  feature folders are `guiRight` subfolders, `.close()`d, with the enable
  controller relocated into the folder `$title` (last session's pattern) + a
  solo button + 🎲 randomize.

## Components (isolated units)

### 1. `drainageField(vPos, …)` — the drainage primitive (NEW, spike first)
Pure function, no side effects. Returns `vec4(channelStrength, gradXYZ)`.
- Domain-warp `vPos` (warp amount = meander control) → sample an
  **inverted-ridged** field; channels are the near-zero band:
  `channel = 1.0 - smoothstep(0.0, w, abs(field))`.
- **Tributaries / dendritic look:** layer a finer octave gated to switch on only
  near the coarser channel (finer channels feed into trunks), 2 levels.
- Returns analytic gradient of the channel field (for chain-rule lighting).
- **Risk = this primitive.** Prove it in a standalone spike harness
  (`fluvial-drainage-lab.html`, flat-quad or simple-sphere shader toy) — confirm
  (a) visible branching, (b) meanders read, (c) gradient lights walls — BEFORE
  porting into the big lab shader. 3-cycle cap: if the branching look fails 3
  research→build→look rounds, fall back to a simpler primitive and flag it.

### 2. `fluvialCombiner(vPos, h, canyonHeight, grad)` — pipeline carve (NEW)
Inserted at the Stage-4 slot (after `canyonCombiner`, around :1432–1433 region,
sequenced per the index at :1406/:1427). Steps:
- `lowGround = smoothstep(hi, lo, h)` (or gradient-based) → channels prefer
  already-low/sloping terrain (folds in a touch of erosion-incision for
  plausibility; keeps rivers out of peaks).
- `s = drainageField(...).x * lowGround * uFluvialDensity` gated by the drivers
  below.
- Carve: `canyonHeight -= s * uFluvialDepth;` and bend `grad` by the channel
  gradient × depth (chain rule), so `perturbAnalytic` lights the walls. Sharing
  `canyonHeight` lets F14 lakes later pool in the channels for free.

### 3. `applyDrivers` extension — driver derivation (generation side)
Derive `uFluvial*` from each preset's `planetData` (presets at ~:2054+):
- **Existence gate:** `uLiquidStability` (exists) — `≈0` ⇒ no active rivers.
- **`uFluvialActivity`** (NEW, 0=relict/degraded … 1=sharp/active): from
  `liquidStability` + `surfaceHistory.erosion` (relict = world that *was* wet:
  low stability but erosion evidence ⇒ softened, shallower channels — the Mars
  case).
- **`uFluvialDensity` / `uFluvialDepth`** (NEW): from D4 rain (surfaced, commit
  `a6891da`) + D14 gravity (`uSurfaceGravity`, surfaced). More rain ⇒
  denser/deeper.
- **Species tint:** `uLiquidSpecies` read at Stage 6 → minor channel-floor
  albedo tint (water vs methane). Albedo, not relief; must survive posterize as
  a faint floor darkening, regression-safe when coverage=0.

### 4. GUI — "Surface — Gradational" folder (NEW) → "Rivers & valleys (F11)"
Add a new top-level `guiRight` folder **"Surface — Gradational"** (matches the
inventory's family split — Fluvial/Aeolian are gradational, distinct from
Relief; future F12–F16 land here too). Inside it, a `.close()`d
**"Rivers & valleys (F11)"** subfolder with: enable toggle relocated into the
`$title` (last-session pattern), solo button, 🎲 randomize, and knobs —
`density`, `depth`, `meander`, `activity` (relict↔active override). New
`riversEnabled` in `state`.

### 5. Archetype-registry wiring (NEW — found in audit, NOT in original design)
The lab's solo/filter/enable-all machinery is driven by a `FEATURES` registry in
`planet-archetypes.js` (imported at lab :110) + a `featureFolders` bridge map
(lab :2382). A new feature that skips this gets no solo button, no archetype
filter, and **fails the `planet-archetypes` vitest** (it cross-checks `FEATURES`
enableKeys ⇆ `.add(state,'xEnabled')` bindings bidirectionally). Required trio,
all-or-none:
- `planet-archetypes.js`: add `rivers: { label:'Rivers & valleys (F11)',
  enableKey:'riversEnabled', archetypes:['tectonic-terrestrial','volatile-cold'] }`
  (water worlds + Titan methane; both are real ARCHETYPES keys).
- lab: bind `fRivers.add(state, 'riversEnabled')` (literal, so the test's regex
  sees it) + add `rivers: fRivers` to the `featureFolders` map.
- The existing `relocateEnableToTitle` / solo / 🎲 loops then pick it up for free.

## Variants coverage (F11 inventory)
| Variant | How |
|---|---|
| Dendritic network | drainage primitive default (warped inverted-ridged + tributary octave) |
| Single trunk + tributaries | tributary-octave gating (coarse trunk, fine feeders) |
| Meanders | domain-warp amount (`uFluvialMeander`) |
| Relict (degraded) | `uFluvialActivity`→0: softened, shallower, lower-density |

## Data flow
`planetData` → `applyDrivers` → `uFluvial*` + existing `uLiquid*` uniforms →
`fluvialCombiner` (reads `h`, writes `canyonHeight` + bends `grad`) →
`perturbAnalytic` lights it → Stage-6 optional species floor-tint → `posterize`.

## Verification (on `:9223`, `window._lab`)
- Branching networks visible on a wet world (Ocean / Rocky-Earthlike).
- Degraded/relict look on a dried world (low stability + erosion history).
- **NONE** on airless worlds — Lava, Frozen-airless (`atmosphere:null` ⇒
  `uLiquidStability=0`). This is the key driver-gate check.
- Channels sit in low ground, not across peaks/crater rims.
- Enable-in-title toggle, solo, 🎲 randomize all work; boxes resync through
  preset switch / solo / enable-all / reset; `resetAll` doesn't throw.
- 0 console errors. **Backtick parity in `planet-lod-lab.html` stays EVEN**
  (was 30 last session — re-check after editing the shader template literal).
- `npm run test -- planet-archetypes` stays green.

## Audit (2026-06-07, implementing session) — resolutions

Audited the spec against live `planet-lod-lab.html` + `planet-lod-lab-core.js` +
`planet-archetypes.js`. Verdict: **sound; implement after these folds.**

- **Anchors accurate** (minor line drift only): canyonHeight :1407, combiner site
  :1429–1441, `canyonCombiner` :1432, fluvial placeholder :1451–1453, liquid
  uniforms :1692–1694, presets :2054+. The lab has MANY more combiners now
  (chaos/cryoRidge/sublimation/glacial/lava) — Stage-4 fluvial still slots after
  `canyonCombiner`, before the `perturbAnalytic` at :1443.
- **Drivers already surfaced — NO core-JS change needed.** `deriveUniforms()`
  returns `precipitation` (D4 rain, core :582/:926), `surfaceGravity` (:514/:921),
  `liquidStability`, `liquidSpecies`, `pressure`. Derive `uFluvial*` in
  `applyDrivers` from `u.precipitation` / `u.surfaceGravity` / `u.liquidStability`.
- **Risk #3 RESOLVED:** all 6 presets carry `surfaceHistory.erosion`. Read it raw
  from `DRIVER_PRESETS[driverUI.preset].surfaceHistory?.erosion ?? 0` (it's a
  local in core, not on the returned `u`). Keep the `?? 0` guard.
- **Do NOT reuse `channelDensity`** (core :758): it's gated on *lava* activity
  (F8 volcanic rilles), unrelated to rain. Derive a fresh `uFluvialDensity`.
- **`fbmdRidged` (lab :564) exists** with an analytic gradient but is hardwired to
  mountain uniforms — copy the fold/chain-rule *technique* into the new
  `drainageField`, don't call it. (Channels are simpler: the near-zero band of a
  warped field, `1 - smoothstep(0,w,|field|)`, grad `-step'·sign(field)·dfield`.)
- **Registry wiring is mandatory** — see Component §5 (new; original design missed
  it). The `planet-archetypes` test forces it.

## Residual risks (verify during implement)
1. **Drainage primitive may not read as branching** at retro resolution — the
   whole feature rides on the spike harness. Honor spike-first; don't skip to the
   big shader. 3-cycle cap, then fall back + flag.
2. **`canyonHeight` co-tenancy** — F4 canyons + Cryo chasma + (now) Fluvial all
   write it. Verify fluvial carve composes (doesn't double-deepen graben). Slot
   fluvial AFTER `canyonCombiner`, and confirm it doesn't fight cryo chasma.
3. **Low-ground preference** must not cancel the network on flat worlds (Ocean =
   low relief) — tune `lowGround` so flat worlds still show channels.
4. **Performance:** +2 warped-noise octaves/fragment — confirm frame cost on
   `:9223` GPU. Mitigated by the `riversEnabled`→0 / `uFluvialDensity≤0` early-out.

## Out of scope (later features, do NOT build here)
F12 deltas/fans, F13 outflow channels, F14 lake-filling of channels, F21 karst.
F11 carves the network only; F14 will reuse `canyonHeight` to pool liquid.
