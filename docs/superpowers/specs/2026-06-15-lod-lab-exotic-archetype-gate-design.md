# Design — Planet-LOD lab exotic-archetype render gate (Thread B of the per-feature quality pass)

**Date:** 2026-06-15
**Author:** working-Claude (brainstormed with Max)
**Status:** spec — pending Max review → implementation plan
**Scope:** `planet-lod-lab.html` (lab `applyDrivers` + per-frame writers) + manifest
`planet-feature-associations.js` (`rendersOn` prune) + one doc edit to
`docs/FEATURES/relief-triage-verdicts-2026-06-15.md`. **Almost certainly NO shader/core change**
(`planet-lod-lab-core.js` untouched — verified below: every affected feature has a lab-side
per-frame writer to multiply). This is a small, surgical gate, not a new system.

**Campaign frame — this is the one that DOES change rendering.** Threads/Asks 2/3/4 are the
menu/info GUI overhaul (no rendering change, lab-tooling only). **Thread B is the sibling thread:
render-correctness residuals.** UNLIKE the GUI asks, it changes REAL planet rendering, so it earns
the campaign-style verification — a render-audit Δ re-run **plus** live `:9223` GPU checks **plus
Max's UAT** (he rides it; the UAT layer is his gate alone, never agent-closeable). It carries
forward from the relief-triage Bucket-A/B work (`be989f4` / `5ef6ca9`); the source-of-truth verdicts
are `docs/FEATURES/relief-triage-verdicts-2026-06-15.md`. Single-system-ish (lab writers + manifest)
→ `dev-collab-scope` is NOT invoked (same call as the sibling specs).

## Why

The post-Bucket-B render-audit (`docs/FEATURES/lab-render-audit.md`, after `248b355`) still lists
**64 false-renders / 51 dead-renders**. Three of those residuals are the subject of this thread; the
relief-triage verdicts already named the remedy for each. Two are real false-renders that need a
**fix**; one is a faint, science-legit trace that Max has decided to **accept** (documented, no code).

The two fixes share **ONE mechanism** — an *exotic-archetype render gate* — modeled exactly on the
existing `habGate` precedent (the gate that stopped cities/biosphere from painting gas giants). The
verdicts doc explicitly calls for an "archetype gate" / "exotic discriminator" for these cases; this
spec makes that gate concrete and grounds it in the actual code.

### The three residuals (from the verdicts table)

| # | Residual | Δ | Verdict bucket | This thread |
|---|---|---|---|---|
| 1 | `shatter` (F45) / `hexTess` (F44) paint **non-exotic** worlds when force-enabled | — (pure-enable; not driver-derived) | feature-buggy (no driver gate at all) | **FIX** via exotic gate |
| 2 | `mountains` (F1) renders on **Carbon / Crystal** | 0.0007 / 0.0017 | feature-buggy — "exotic crust owned elsewhere (carbon F42 / facets F43)" | **FIX** via the same gate |
| 3 | faint `craters` on **Ocean / Europa** | 0.0001–0.0005 | minor cratering is science-legit on all solid surfaces; faint | **ACCEPT** — doc only, NO code |

**#1 — why archetype-membership is the honest gate (not a continuous driver).** `shatter` (shattered
crust) and `hexTess` (hex-tessellated crust) are **type-defining exotic geometry** — they describe a
*kind* of world, not the output of a continuous physical process. There is no `rockyCrust`-style
physical driver that legitimately scales them down on a normal world; they simply **don't belong**
there. So the gate is archetype membership, full stop.

**#2 — why `rockyCrust` can't catch carbon/crystal mountains.** `rockyCrust` is the Bucket-B silicate
discriminator in core: `planet-lod-lab-core.js:557 const rockyCrust = smoothstep(2.5, 3.9, density)`,
applied at `:648 const mountainAmp = clamp01(mix(0.25, 0.6, 1 - erosion)) * rockyCrust`. **Carbon and
Crystal worlds are DENSE** (`Carbon` density 6, `Crystal` density 3.0 — both inside or above the
2.5–3.9 silicate band), so `rockyCrust` reads them as silicate and **passes mountains through**. But
their relief is owned by carbon-crust (F42) / facets (F43), not silicate orogeny — exactly the
verdicts' "exotic crust owned elsewhere." `rockyCrust` is the wrong tool; the exotic gate is the
right one (it keys on archetype identity, not density).

**#3 — why accept.** Science says minor cratering is legitimate on **all** solid surfaces, and these
traces are faint (Δ 0.0001–0.0005, ⚠️-tier). No code change. **The only action for #3 is a documented
"accept" decision recorded in `docs/FEATURES/relief-triage-verdicts-2026-06-15.md`.**

## What — the design

### The mechanism: `exoticGate`, mirroring `habGate` exactly

The `habGate` precedent (verified in code):

- **Computed in `applyDrivers()`** from the preset's properties and stored on `state`
  (`planet-lod-lab.html:5524`):
  ```js
  { const t = Math.min(1, Math.max(0, (state.habitability - 0.1) / 0.3)); state.habGate = t * t * (3 - 2 * t); }
  ```
  Seeded with a safe default (`planet-lod-lab.html:4950  habitability: 0, habGate: 1`).
- **Consumed by the per-frame writers**, which multiply coverage by it — zeroing the overlay even
  when the feature is force-enabled (`planet-lod-lab.html:7331 / 7548 / 7558 / 7565`), e.g.
  ```js
  uniforms.uCityMaturity.value = state.cityLightsEnabled ? state.cityMaturity * state.habGate : 0.0;
  ```

The exotic gate is the **same shape**. `applyDrivers()` derives, per preset, an
**exotic-archetype-membership signal**, stores it on `state`, and the four exotic-feature writers
multiply by it (zero on non-exotic worlds). `mountains` is gated by the **inverse** (zero on the two
exotic crust archetypes).

#### Deriving the signal (reuse the machinery `relevantFeatureSet()` already uses)

`applyDrivers()` already has everything it needs in scope — the lab imports `ARCHETYPES`
(`planet-lod-lab.html:110`) and `relevantFeatureSet()` (`:7083`) already computes the current
preset's archetypes:
```js
const archs = Object.keys(ARCHETYPES).filter(a => ARCHETYPES[a].presets.includes(driverUI.preset));
```
The cleanest derivation is to intersect that `archs` set with the exotic archetype keys. There are
**three** exotic archetypes (`planet-archetypes.js:164–166`):
`exotic-carbon` (preset `Carbon (high C/O)`), `exotic-geometric` (preset `Crystal (faceted)`),
`exotic-shattered` (preset `Frozen (airless)`).

Two distinct membership signals fall out — they must be **separate**, because the four exotic
features do NOT share one archetype (see the deviation below):

- `state.isExoticGeometric` — current preset ∈ `exotic-geometric`'s presets → `facets` + `hexTess`.
- `state.isExoticShattered` — current preset ∈ `exotic-shattered`'s presets → `shatter`.
- `state.isExoticCarbon` — current preset ∈ `exotic-carbon`'s presets → `carbon` (already
  driver-gated; see "carbon is already correct" below).
- `state.isExoticCrust` — `isExoticCarbon || isExoticGeometric` → the **mountains knockout** set
  (the two archetypes the verdicts say own carbon/crystal relief).

These are computed once per preset/quality change in `applyDrivers()` (exactly like `habGate`), not
per frame. (Implementation may derive them directly from `ARCHETYPES[key].presets.includes(...)`
rather than re-running `relevantFeatureSet()`; the plan picks the tidier of the two — both read the
same data.)

### Per-feature wiring (each grounded in its real writer line)

All four exotic-feature writers AND the mountains writer live **in the lab** (`planet-lod-lab.html`),
in the same per-frame `applyDrivers`-adjacent writer block as `habGate`. **None are baked in
`deriveUniforms` with no lab writer** — so every gate is a one-line `×=` at the lab layer and
**`planet-lod-lab-core.js` stays untouched** (verified per feature below; line numbers are HINTS —
re-`grep -n` every site).

| Feature | enableKey | Current writer (HINT line) | Gate to apply |
|---|---|---|---|
| `shatter` (F45) | `shatterEnabled` | `:7536 uShatStrength = shatterEnabled ? 1.0 : 0.0` | `× isExoticShattered` (hard) |
| `hexTess` (F44) | `hexTessEnabled` | `:7527 uHexStrength = hexTessEnabled ? 1.0 : 0.0` | `× isExoticGeometric` (hard) |
| `facets` (F43) | `facetsEnabled` | `:7518 uFacetStrength = facetsEnabled ? facetStrength : 0.0` | `× isExoticGeometric` (hard) — see note |
| `carbon` (F42) | `carbonEnabled` | `:7507 uCarbonStrength = carbonEnabled ? clamp((ratio−0.8)×2.5) : 0` | **no new gate** — already driver-gated |
| `mountains` (F1) | `mountainsEnabled` | `:7617 uMountainAmp = mountainsEnabled ? mountainAmp : 0.0` | `× (1.0 − isExoticCrust)` |

**Concrete form** (mirrors the `habGate` writer idiom — multiply the master gate, leave the lab
shape knobs untouched):
```js
uniforms.uShatStrength.value  = state.shatterEnabled  ? state.isExoticShattered : 0.0;   // hard exotic gate
uniforms.uHexStrength.value   = state.hexTessEnabled  ? state.isExoticGeometric : 0.0;   // hard exotic gate
uniforms.uFacetStrength.value = state.facetsEnabled   ? state.facetStrength * state.isExoticGeometric : 0.0;
uniforms.uMountainAmp.value   = state.mountainsEnabled ? state.mountainAmp * (1.0 - state.isExoticCrust) : 0.0;
```
(`isExotic*` stored as `1.0`/`0.0` floats so the multiply is uniform with the `habGate` style. The
plan may use a boolean and branch instead; the shipped form must keep the byte-identical-when-1
contract these F4x writers already advertise.)

#### carbon (F42) is already correct — no new gate

`carbon`'s writer is **already driver-gated**: `uCarbonStrength = carbonEnabled ? clamp((carbonRatio
− 0.8) × 2.5) : 0` (`:7507`). Every non-carbon preset derives `carbonRatio` 0 (only
`Carbon (high C/O)` sets `composition.carbonToOxygen: 1.2`), so carbon **cannot** false-render
elsewhere — force-enabling it on Rocky already shows nothing. **carbon needs no change.** It is
listed here only because the brainstorm framing grouped "carbon/facets" together; the investigation
shows carbon already behaves and only `facets` (its pure-`facetStrength` sibling) benefits from the
belt-and-suspenders archetype gate. **Flag for Max:** is the redundant `× isExoticGeometric` on
`facets` wanted (defense in depth, parallel to the others), or should `facets` also be left alone
since `facetStrength` already derives 0 off the crystal class? Default in this spec: add the gate to
`facets` for symmetry and force-enable honesty; drop it if Max prefers minimal change.

### Hard gate — overrides force-enable (Max approved)

Exactly like `habGate` for overlays, this gate **zeros these features even when force-enabled**. So
force-enabling `shatter` on Rocky shows **NOTHING**. This is intended (the verdicts: they don't
belong). **State clearly for the menu/UAT:** the "force-enable-to-preview-on-a-wrong-world" workflow
**no longer applies to `shatter` / `hexTess` / `facets`** (and `mountains` on the two exotic-crust
presets). It **still applies** to the `rockyCrust`-soft-gated relief family (mountains/lava/edifices/
tessera on normal worlds), which uses a continuous driver, not a hard archetype gate.

### Manifest prune (`planet-feature-associations.js`)

Align `rendersOn` with the gate so the manifest stops *declaring* the false-renders the gate now
*prevents*. Current state (verified):

- `mountains.rendersOn` (`:65`) = Rocky, Ocean, Venus, Eyeball, Mars, Lava — **already excludes
  Carbon/Crystal.** So the manifest is **already correct for mountains**; the false-render came from
  the driver deriving nonzero on those presets despite the manifest, which the gate now fixes. **No
  manifest edit needed for mountains** (confirm against the audit after the gate lands).
- `shatter.rendersOn` (`:402`) = `['Frozen (airless)']` — correct (its archetype `exotic-shattered`'s
  preset). No prune needed; the false-renders were force-enable leaks, not manifest over-declaration.
- `hexTess.rendersOn` (`:395`) = `['Frozen (airless)']` with **`rendersOnDivergent: true`** (`:394`)
  — flagged because the registry archetype is `exotic-geometric` (preset `Crystal (faceted)`) but the
  manifest rides it on Frozen. **This divergence is the design's biggest wrinkle — see Deviations.**
  Re-check this flag after deciding the gate's preset (Crystal vs Frozen).
- `facets.rendersOn` (`:385`) = `['Crystal (faceted)']` — correct. No prune.

So in practice the manifest is **mostly already aligned**; the brainstorm's "prune `rendersOn` for
these features" reduces to **verify-and-possibly-reconcile `hexTess`'s divergent flag**, not a broad
prune. (If the post-gate audit shows any of the four still declared somewhere the gate now zeros,
prune that entry then.)

## Investigation findings (grounded; line numbers are HINTS)

1. **`habGate` precedent — confirmed, lab-level.** Computed in `applyDrivers()`
   (`planet-lod-lab.html:5524`) from `state.habitability` (`:5520`), seeded `:4950`, consumed by
   per-frame overlay writers `:7331` (bio), `:7548` (machine), `:7558` (city), `:7565` (ecu) via
   `× state.habGate`. `habGate` does **not** exist in `planet-lod-lab-core.js` (grep: 0 hits) — it is
   purely a lab construct. This is the exact pattern the exotic gate copies.

2. **Per-feature writers — ALL lab-level, NONE need a core touch.** Confirmed each feature's master
   strength uniform is written per frame in `planet-lod-lab.html`, where the lab can `×=` a gate:
   - `shatter`: `:7536` `uShatStrength = state.shatterEnabled ? 1.0 : 0.0` — **lab writer, sole owner,
     pure enable.** Gateable lab-side.
   - `hexTess`: `:7527` `uHexStrength = state.hexTessEnabled ? 1.0 : 0.0` — **lab writer, sole owner,
     pure enable.** Gateable lab-side.
   - `facets`: `:7518` `uFacetStrength = state.facetsEnabled ? state.facetStrength : 0.0` — **lab
     writer, sole owner;** `facetStrength` is driver-derived in `applyDrivers` (`:6263`,
     `state.facetStrength = _facetClass ? 1.0 : 0.0`) so it is already 0 off the crystal class.
     Gateable lab-side (redundant gate optional — see carbon note).
   - `carbon`: `:7507` `uCarbonStrength = state.carbonEnabled ? clamp((carbonRatio−0.8)×2.5) : 0` —
     **lab writer, already driver-gated;** cannot false-render. **No change.**
   - `mountains`: `:7617` `uMountainAmp = state.mountainsEnabled ? state.mountainAmp : 0.0` — **lab
     writer.** `mountainAmp` is the core-derived value (`core.js:648`, `× rockyCrust`), copied into
     `state.mountainAmp` at `applyDrivers` `:5560`. The lab can multiply the **state copy** in the
     writer without touching core. Gateable lab-side.

   **Result: zero core touches.** The verdicts' Bucket-B note ("core.js derivations + per-frame
   writers") anticipated a possible core change for the silicate family; for **these specific four**
   the per-frame writer suffices because the gate is archetype identity (a lab concept), not a new
   physical driver. (The silicate `rockyCrust` factor that already lives in core is untouched and
   still does its job for the normal relief family.)

3. **Archetype signal reachable in `applyDrivers` — confirmed.** `ARCHETYPES` is imported at
   `:110`; `relevantFeatureSet()` (`:7083`) already derives `archs` from
   `ARCHETYPES[a].presets.includes(driverUI.preset)`. `applyDrivers` reads `driverUI.preset`
   throughout, so the exotic-membership signal is a one-liner there. Exotic archetype keys are
   `exotic-carbon` / `exotic-geometric` / `exotic-shattered` (`planet-archetypes.js:164–166`).

4. **`hexTess` identity — IS a registry feature, but its archetype/manifest diverge.** `hexTess` is a
   real `FEATURES` key (`planet-archetypes.js:118`, `enableKey: 'hexTessEnabled'`, archetype
   `exotic-geometric`). It does **not** stand alone or map to `facets`/`shatter` as an alias — it is
   its own feature. **BUT:** its registry archetype is `exotic-geometric` (preset
   `Crystal (faceted)`), while its manifest `rendersOn` and the in-code comment
   (`planet-archetypes.js:116`, `planet-feature-associations.js:392–395`) say the **shader rides it
   on `Frozen (airless)`** — hence `rendersOnDivergent: true`. So "gate `hexTess` by exotic-geometric
   membership" would gate it **ON for Crystal and OFF for Frozen** — the opposite of where it's
   declared to render. **This contradicts the clean "gate by exotic archetype" story — see
   Deviations.**

5. **Render-audit re-run mechanism — confirmed.** `window._lab.renderDeltaSweep()` exists
   (`planet-lod-lab.html:7045`, exposed `:7820`); generator `scripts/gen-render-audit.mjs` exists;
   report `docs/FEATURES/lab-render-audit.md` exists with current counts **64 false-renders (57 🔴 /
   7 ⚠️) / 51 dead-renders** (after `248b355`). The verification re-runs this to show the targeted
   false-renders clear.

## Deviations from the approved brainstorm (DO NOT silently "fix" — raise with Max)

These surfaced only by reading the code; they don't break the design but change its details.

- **D1 — `shatter` / `hexTess` don't leak via `relevantFeatureSet`; they leak via force-enable.**
  Their archetypes' presets (`Frozen` for `exotic-shattered`, `Crystal` for `exotic-geometric`) mean
  `relevantFeatureSet()` already keeps them OFF the relevant roster on Rocky/Ocean/etc. The
  false-render is purely the **pure-enable writer painting when force-enabled** (and the audit's
  force-enable methodology catching it). The exotic gate is still the right fix — it makes
  force-enable **honest** (zeros on non-member worlds) — but the framing "they leak onto non-exotic
  worlds" is precisely a **force-enable** leak, not a relevance-filter leak. (No design change; just
  accurate framing for the plan and UAT script.)

- **D2 — `hexTess`'s archetype↔manifest divergence (the real wrinkle).** Registry archetype
  `exotic-geometric` ⇒ preset `Crystal`; manifest/shader ride ⇒ preset `Frozen`
  (`rendersOnDivergent: true`). A naïve `× isExoticGeometric` gate would render `hexTess` on **Crystal
  only** and kill it on **Frozen**, contradicting its declared `rendersOn`. **Decision needed:** which
  is the intended home for `hexTess`?
  - **Option A (gate to Crystal):** `× isExoticGeometric`, and **also** repoint `hexTess.rendersOn`
    Frozen → Crystal and drop `rendersOnDivergent`. Cleanest taxonomy (hexTess sits with its facets
    sibling on the geometric archetype) but **changes where hexTess visibly renders** — a UAT-visible
    behavior change Max should sign off on.
  - **Option B (keep Frozen home):** gate `hexTess` on **`Frozen`-membership** (e.g. a dedicated
    `isHexHome` = preset === `Frozen (airless)`, or reuse `isExoticShattered` since both are Frozen),
    preserving today's render location and the divergent flag. Honors the existing `rendersOn` but
    keeps the taxonomy quirk.
  This spec does **not** pick — it is a taste/identity call for Max. (The other three features have no
  such divergence: `shatter`→Frozen, `facets`→Crystal, `mountains`→knock off Carbon+Crystal are all
  unambiguous.)

- **D3 — manifest prune is nearly a no-op.** As grounded above, `mountains`/`shatter`/`facets`
  `rendersOn` are already correct; only `hexTess`'s divergent flag is in question (folded into D2).
  The brainstorm's "prune `rendersOn` for these features" overstates the manifest work — the real
  work is the gate + the D2 decision.

- **D4 — `carbon` needs no gate.** Already driver-gated (`carbonRatio` 0 off the carbon preset).
  Listed in the brainstorm's "carbon/facets ×= gate" but the investigation shows only `facets` (the
  pure-`facetStrength` one) is a candidate, and even that is redundant. Default: gate `facets` for
  symmetry; skip `carbon`. (Flagged in the carbon note above.)

## Mechanics & risks (on the record)

- **Line-number drift** in `planet-lod-lab.html` is real — every line number here is a **HINT**.
  Re-`grep -n` each edit site (`habGate`, `applyDrivers`, `relevantFeatureSet`, `uShatStrength`,
  `uHexStrength`, `uFacetStrength`, `uMountainAmp`, `ARCHETYPES`) before editing.
- **Byte-identical contract:** these F4x writers advertise "byte-identical pre-F4x output" when their
  gate is 0. The new gate must preserve that — when `isExotic* === 1` on the member preset, the value
  must be **exactly** what it is today (multiply by 1.0, don't reorder the clamp), so member-world
  renders don't shift. Verified by the audit Δ (member presets must show **no** change).
- **No core touch** is the expected outcome (finding #2). If the plan discovers a writer it cannot
  reach lab-side after re-grep (it should not, per the investigation), that becomes a flagged core
  change — do not bake it silently.
- **`facetStrength` is display-`listen()`ed** (`:6758`) — gating the **writer** (not `facetStrength`
  itself) keeps the GUI slider readout honest while the render is gated, matching how `habGate` leaves
  the coverage sliders readable but zeros the render.

## Out of scope

- The menu/info GUI overhaul — Ask 2 (feature info cards), Ask 3 (archetype info view), Ask 4 (live
  render-audit surfacing). Sibling thread, no rendering change.
- The broader Bucket-B silicate-relief family fix (mountains/lava/edifices/tessera on Europa/Titan/
  Frozen) — already landed via `rockyCrust` (`be989f4` / `5ef6ca9`); this thread only adds the
  **exotic** discriminator the silicate gate can't express.
- Any change to `carbon` (already correct) or to the normal-world relief soft-gate.

## Verification

Campaign-style — render-audit Δ **and** live `:9223` **and** Max UAT.

- **Render-audit Δ re-run (objective).** Re-run the sweep via `window._lab.renderDeltaSweep()` +
  `node scripts/gen-render-audit.mjs`, regenerating `docs/FEATURES/lab-render-audit.md`. Expected:
  - The `shatter` / `hexTess` force-enable false-renders on non-member worlds **clear**.
  - The `mountains` × Carbon (Δ 0.0007) and `mountains` × Crystal (Δ 0.0017) false-renders **clear**.
  - Total false-renders drop from the current **64** by those rows; **dead-renders (51) do NOT
    increase** for the member presets (the byte-identical-when-1 contract — member worlds unchanged).
  - The accepted faint `craters` traces (#3) remain (intended; documented).
- **Live on chrome-devtools GPU `:9223`** (NOT Playwright — GPU path; per
  `well-dipper-testing-reference.md`). `127.0.0.1:5173/well-dipper/planet-lod-lab.html?fresh=1`,
  **reload `?fresh=1` before each check**, verify via `window._lab.*` + `evaluate_script` (DOM/uniform
  reads, not image recognition):
  - **Force-enable `shatter` on Rocky** → renders nothing; `uShatStrength` reads 0 (hard gate beats
    the enable flag).
  - **Force-enable `hexTess` on a non-member world** → renders nothing (per the D2 decision: member =
    Crystal under Option A, or Frozen under Option B — test against whichever Max picks).
  - **Crystal (faceted) preset** → `facets`/`hexTess` (per D2) still render on their OWN exotic
    preset, byte-identical to today; **no `mountains`** (`uMountainAmp` reads 0).
  - **Carbon (high C/O) preset** → `carbon` still renders; **no `mountains`**; only carbon's own
    relief.
  - **`shatter` on Frozen** still renders (its member world) — the gate must not over-zero.
- **Doc-only action for #3:** record the "accept faint craters on Ocean/Europa (science-legit, Δ
  ⚠️-tier)" decision in `docs/FEATURES/relief-triage-verdicts-2026-06-15.md` (e.g. promote the
  "Faint traces … deferred" line + the craters row to an explicit ACCEPTED entry). No code.
- **Max UAT** — Max rides the lab and confirms the gate reads right across presets. The UAT layer is
  **deferred-to-Max**, not agent-closeable; agents close only the render-audit + live-integration
  layers → `VERIFIED_PENDING_MAX <sha>`.
- **Existing suites** (`feature-associations`, `planet-archetypes`, the `cityLightsEnabled` pin #16,
  the Stage-D GLSL drift-guard, the `rendersOn ⊆ archetype-union` test) stay green. If the D2 Option-A
  repoint of `hexTess` touches the ⊆-union test, update it in lockstep (flagged for the plan).
- **Commit explicit paths only** (`planet-lod-lab.html`, `planet-feature-associations.js` if
  hexTess is reconciled, `docs/FEATURES/relief-triage-verdicts-2026-06-15.md`,
  `docs/FEATURES/lab-render-audit.md` regen) — never `git add -A` (shared-tree litter: warp WIP +
  loose `.png`/`.webm`/`.html`).
