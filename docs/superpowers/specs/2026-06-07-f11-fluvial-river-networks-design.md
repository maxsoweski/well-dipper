# F11 — Fluvial river networks & valleys (lab) — design spec

**Date:** 2026-06-07 · **Feature:** F11 (Fluvial domain, first of the
gradational-landform campaign) · **Surface:** `planet-lod-lab.html`
(`window._lab`) · **Status:** design APPROVED by Max 2026-06-07, pending
audit by the implementing session.

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

## Risks / audit-these
1. **Drainage primitive may not read as branching** at the retro resolution —
   the whole feature rides on the spike harness succeeding. Auditor: confirm the
   spike-first step is honored; don't let it skip straight to the big shader.
2. **`canyonHeight` interaction with F4 canyons + Cryo chasma** — both write the
   same accumulator; verify fluvial carve composes (doesn't double-deepen or
   fight tectonic graben). Check ordering vs Stage-3 cryo.
3. **Relict derivation** uses `surfaceHistory.erosion` — confirm that field
   exists on all presets (some presets may lack it → guard).
4. **Low-ground preference** must not cancel the network on flat worlds (Ocean
   has low relief) — tune so flat worlds still show channels.
5. **Performance:** drainage primitive adds 2 warped-noise octaves per fragment
   — confirm frame cost acceptable on `:9223` GPU.

## Out of scope (later features, do NOT build here)
F12 deltas/fans, F13 outflow channels, F14 lake-filling of channels, F21 karst.
F11 carves the network only; F14 will reuse `canyonHeight` to pool liquid.
