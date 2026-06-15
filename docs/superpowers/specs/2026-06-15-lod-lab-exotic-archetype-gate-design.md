# Design — Planet-LOD lab per-feature relevance render gate (Thread B of the per-feature quality pass)

**Date:** 2026-06-15
**Author:** working-Claude (brainstormed with Max; revised after Max-approved refinements)
**Status:** spec — pending Max review → implementation plan
**Scope:** `planet-lod-lab.html` (lab `applyDrivers` + per-frame writers) + one doc edit to
`docs/FEATURES/relief-triage-verdicts-2026-06-15.md`. **No manifest edit** (`planet-feature-associations.js`
`rendersOn` is already correct — verified below: this is a no-op verification, not an edit). **Almost
certainly NO shader/core change** (`planet-lod-lab-core.js` untouched — verified below: every affected
feature has a lab-side per-frame writer to multiply). This is a small, surgical gate, not a new system.

**Campaign frame — this is the one that DOES change rendering.** Threads/Asks 2/3/4 are the
menu/info GUI overhaul (no rendering change, lab-tooling only). **Thread B is the sibling thread:
render-correctness residuals.** UNLIKE the GUI asks, it changes REAL planet rendering, so it earns
the campaign-style verification — a render-audit Δ re-run **plus** live `:9223` GPU checks **plus
Max's UAT** (he rides it; the UAT layer is his gate alone, never agent-closeable). It carries
forward from the relief-triage Bucket-A/B work (`be989f4` / `5ef6ca9`); the source-of-truth verdicts
are `docs/FEATURES/relief-triage-verdicts-2026-06-15.md`. Single-system-ish (lab writers only)
→ `dev-collab-scope` is NOT invoked (same call as the sibling specs).

## Why

The post-Bucket-B render-audit (`docs/FEATURES/lab-render-audit.md`, after `248b355`) still lists
**64 false-renders / 51 dead-renders**. Three of those residuals are the subject of this thread; the
relief-triage verdicts already named the remedy for each. Two are real false-renders that need a
**fix**; one is a faint, science-legit trace that Max has decided to **accept** (documented, no code).

The two fixes use **TWO related mechanisms** (both modeled on the existing `habGate` precedent — the
gate that stopped cities/biosphere from painting gas giants):

1. **Per-feature relevance hard-gate** for `shatter` and `hexTess` — each feature is multiplied by
   ITS OWN relevance to the current preset (not a blanket "is-this-an-exotic-world" flag). Zeros the
   feature when force-enabled on a world it doesn't belong to; preserves it on its member world(s).
2. **Targeted exotic-crust knockdown** for `mountains` — a single asymmetric subtraction that
   hard-zeros mountains ONLY on the two exotic-crust presets (Carbon/Crystal), where relief is owned
   elsewhere; mountains keep rendering (incl. force-enable preview) everywhere else.

The verdicts doc called for an "archetype gate" / "exotic discriminator." The first-draft of this
spec interpreted that as a **single blanket exotic-archetype-membership gate** applied to four
features (`shatter`/`hexTess`/`carbon`/`facets`) plus mountains. **That interpretation was wrong** and
this revision corrects it (see "The core correction" below). The honest gate is **per-feature
relevance**, and only **two** features actually need a new gate.

### The three residuals (from the verdicts table)

| # | Residual | Δ | Verdict bucket | This thread |
|---|---|---|---|---|
| 1 | `shatter` (F45) / `hexTess` (F44) paint **non-member** worlds when **force-enabled** | — (pure-enable; not driver-derived) | feature-buggy (no driver gate at all) | **FIX** via per-feature relevance hard-gate |
| 2 | `mountains` (F1) renders on **Carbon / Crystal** | 0.0007 / 0.0017 | feature-buggy — "exotic crust owned elsewhere (carbon F42 / facets F43)" | **FIX** via targeted exotic-crust knockdown |
| 3 | faint `craters` on **Ocean / Europa** | 0.0001–0.0005 | minor cratering is science-legit on all solid surfaces; faint | **ACCEPT** — doc only, NO code |

### The core correction — per-feature relevance, NOT blanket exotic membership

A blanket "is the current preset an exotic world?" gate would be **wrong in both directions**:

- It would render `shatter` on **Crystal** — but `shatter`'s archetype is `exotic-shattered`, whose
  ONLY preset is **`Frozen (airless)`** (`planet-archetypes.js:166`). Shatter does not belong on
  Crystal. A blanket "exotic" gate (true on Crystal) would wrongly pass it through there.
- It would **kill `hexTess` on Frozen** — `hexTess` deliberately rides on `Frozen (airless)` via
  `rendersOnDivergent: true` (`planet-feature-associations.js:394`), even though its registry
  archetype `exotic-geometric` maps to `Crystal (faceted)`. A naïve "gate to my archetype's preset"
  rule would render hexTess on Crystal only and zero it on Frozen — the opposite of where it's
  declared to render.

The correct signal is each feature's OWN relevance to the current preset — the same notion the GUI's
"Not relevant to this world" filter already computes from `relevantFeatureSet()`. `applyDrivers()`
computes a per-feature relevance value, stores it on `state` (a `state.featureRelevant` map, keyed by
feature key, holding `1.0`/`0.0` floats), and the two writers consume their own entry.

**Important nuance, verified in code (this is the spec's main code↔intent reconciliation — see
Deviations D2):** the raw `relevantFeatureSet().set` is built purely from archetype↔preset mapping
and is **blind to `rendersOnDivergent`**. On `Frozen (airless)` that set contains `shatter` (via
`exotic-shattered`) but does **NOT** contain `hexTess` (whose only archetype `exotic-geometric` is not
a Frozen archetype). So gating `hexTess` by the *raw* `relevantFeatureSet().set` would **kill it on
Frozen** — exactly what the refinement wants to avoid. The per-feature relevance signal must therefore
be the feature's **effective render membership**, which honors the divergent flag. The manifest's
`rendersOn` array IS that effective set (it lists `Frozen (airless)` for hexTess), and the manifest is
already imported into the lab. So the relevance signal is derived from
`ASSOCIATIONS[key].rendersOn.includes(driverUI.preset)`, with `relevantFeatureSet()` available as the
GUI-parallel cross-check. (Detail + alternatives in Deviations D2.)

#### Deriving the per-feature relevance signal (code-grounded)

`applyDrivers()` (`planet-lod-lab.html:5514`) has everything it needs in scope:

- The manifest is imported at `planet-lod-lab.html:111`
  (`import { ASSOCIATIONS } from './planet-feature-associations.js';`). `ASSOCIATIONS.shatter.rendersOn`
  = `['Frozen (airless)']` (`:402`) and `ASSOCIATIONS.hexTess.rendersOn` = `['Frozen (airless)']`
  (`:395`, with `rendersOnDivergent: true` at `:394`).
- `relevantFeatureSet()` (`:7083`) returns `{ set, archs }` — VERIFIED at `:7083–7088`:
  ```js
  function relevantFeatureSet(){
    const archs = Object.keys(ARCHETYPES).filter(a => ARCHETYPES[a].presets.includes(driverUI.preset));
    const set = new Set();
    for (const a of archs) for (const k of featuresOf(a)) set.add(k);
    return { set, archs };
  }
  ```
  It is a hoisted function declaration, defined at `:7083` and callable from `applyDrivers` at `:5514`
  (JS function-declaration hoisting — `applyArchetypeFilter` at `:7090` already calls it). `ARCHETYPES`
  is imported at `:110`. So `relevantFeatureSet()` IS reachable from `applyDrivers`.

The derivation stored in `applyDrivers` (once per preset/quality change, exactly like `habGate`):
```js
// per-feature effective render membership (honors rendersOnDivergent — see D2)
state.featureRelevant = state.featureRelevant || {};
for (const key of ['shatter','hexTess']) {
  state.featureRelevant[key] =
    (ASSOCIATIONS[key]?.rendersOn || []).includes(driverUI.preset) ? 1.0 : 0.0;
}
```
Stored as `1.0`/`0.0` floats so the writer multiply matches the `habGate` style.

#### The exotic-crust knockdown signal (for mountains)

A separate, narrow signal — membership in the exotic-**carbon** OR exotic-**geometric** archetypes
(Carbon / Crystal), the two whose relief is owned by carbon-crust (F42) / facets (F43):
```js
const _archs = relevantFeatureSet().archs;                 // or read ARCHETYPES directly
state.isExoticCarbonOrGeometric =
  (_archs.includes('exotic-carbon') || _archs.includes('exotic-geometric')) ? 1.0 : 0.0;
```
Exotic archetype keys + presets (verified `planet-archetypes.js:164–166`):
`exotic-carbon` → `Carbon (high C/O)`, `exotic-geometric` → `Crystal (faceted)`,
`exotic-shattered` → `Frozen (airless)`. **This is deliberately NOT a general relevance gate for
mountains** — see "mountains is a targeted knockdown" below.

## What — the design

### Per-feature wiring (each grounded in its real writer line)

Both gated writers AND the mountains writer live **in the lab** (`planet-lod-lab.html`), in the same
per-frame writer block as `habGate`. **None are baked in `deriveUniforms` with no lab writer** — so
every gate is a one-line `×=` at the lab layer and **`planet-lod-lab-core.js` stays untouched**
(verified per feature below; line numbers are HINTS — re-`grep -n` every site).

| Feature | enableKey | Current writer (VERIFIED line) | Change |
|---|---|---|---|
| `shatter` (F45) | `shatterEnabled` | `:7536 uShatStrength.value = state.shatterEnabled ? 1.0 : 0.0` | `× state.featureRelevant.shatter` (hard) |
| `hexTess` (F44) | `hexTessEnabled` | `:7527 uHexStrength.value = state.hexTessEnabled ? 1.0 : 0.0` | `× state.featureRelevant.hexTess` (hard) |
| `mountains` (F1) | `mountainsEnabled` | `:7617 uMountainAmp.value = state.mountainsEnabled ? state.mountainAmp : 0.0` | `× (1.0 − state.isExoticCarbonOrGeometric)` (targeted knockdown) |
| `carbon` (F42) | `carbonEnabled` | `:7507 uCarbonStrength.value = state.carbonEnabled ? clamp((ratio−0.8)×2.5) : 0` | **NO CHANGE** — already honest |
| `facets` (F43) | `facetsEnabled` | `:7518 uFacetStrength.value = state.facetsEnabled ? state.facetStrength : 0.0` | **NO CHANGE** — already honest |

**Concrete form** (mirrors the `habGate` writer idiom — multiply the gate, leave the lab shape knobs
untouched):
```js
uniforms.uShatStrength.value  = state.shatterEnabled ? state.featureRelevant.shatter : 0.0;   // per-feature hard gate
uniforms.uHexStrength.value   = state.hexTessEnabled ? state.featureRelevant.hexTess : 0.0;   // per-feature hard gate
uniforms.uMountainAmp.value   = state.mountainsEnabled ? state.mountainAmp * (1.0 - state.isExoticCarbonOrGeometric) : 0.0;
// carbon (:7507) and facets (:7518) — UNCHANGED.
```
(Relevance stored as `1.0`/`0.0` floats so the multiply is uniform with the `habGate` style. The plan
may use a boolean and branch instead; the shipped form must keep the **byte-identical-when-1** contract
these F4x writers already advertise — see Verification.)

### carbon (F42) and facets (F43) are already honest — NO gate needed

Both already self-zero off their preset, so force-enabling them elsewhere shows nothing. They are
**not** part of this fix.

- **`carbon`** (writer `:7507`): `uCarbonStrength.value = carbonEnabled ? clamp((carbonRatio − 0.8) ×
  2.5) : 0`. `state.carbonRatio` is derived at `:6235` from `composition.carbonToOxygen`, and ONLY the
  `Carbon (high C/O)` preset sets it (`carbonToOxygen: 1.2`, `:5448`); every other preset derives 0,
  so the clamp is 0. Force-enabling carbon on Rocky already renders nothing. **No change.**
- **`facets`** (writer `:7518`): `uFacetStrength.value = facetsEnabled ? state.facetStrength : 0.0`.
  `state.facetStrength` is derived at `:6263` (`state.facetStrength = _facetClass ? 1.0 : 0.0`,
  airless+pristine crystal class only) and is 0 on every preset off the Crystal class. Force-enabling
  facets elsewhere already renders nothing. **No change.** (`facetStrength` is display-`listen()`ed at
  `:6753`; leaving the writer alone keeps the slider readout honest.)

This is the chief correction from the first draft, which (wrongly) proposed a redundant
`× isExoticGeometric` gate on `facets` and grouped `carbon` into the gate set.

### mountains is a TARGETED knockdown, NOT a relevance gate

`mountains` is treated **differently from shatter/hexTess on purpose.** It is NOT gated by general
per-feature relevance. It is multiplied by `(1.0 − state.isExoticCarbonOrGeometric)` — i.e. hard-zeroed
**only** on the exotic-carbon (Carbon) and exotic-geometric (Crystal) presets.

- **Why zero on Carbon/Crystal:** silicate orogeny relief is categorically wrong there — relief is
  owned by carbon-crust (F42) / facets (F43), exactly the verdicts' "exotic crust owned elsewhere."
  `rockyCrust` (the core silicate discriminator) can't catch these because Carbon (density 6) and
  Crystal (density 3.0) read as silicate-dense and pass through (`planet-lod-lab-core.js:557` band
  2.5–3.9). The exotic-crust knockdown keys on archetype identity, not density.
- **Why NOT a full relevance gate:** mountains must **keep rendering** on icy worlds
  (Europa/Titan/Frozen), including the **force-enable preview workflow** Max wants intact. On those
  worlds `rockyCrust` already soft-scales mountains down (continuous driver), and Max explicitly wants
  to be able to force-enable-to-preview there. A hard relevance gate would kill that preview. So the
  asymmetry is deliberate: **Carbon/Crystal = hard-zero (silicate relief categorically wrong);
  icy = soft-scaled by `rockyCrust` + previewable (unchanged).**

`mountains`' writer multiplies the `state.mountainAmp` copy set at `:5560`
(`state.mountainAmp = u.mountainAmp`, the core-derived `× rockyCrust` value). The lab multiplies the
**state copy** in the writer (`:7617`) without touching core.

### Hard gate — overrides force-enable (Max approved), for shatter/hexTess only

Exactly like `habGate` for overlays, the per-feature relevance gate **zeros shatter/hexTess even when
force-enabled.** So force-enabling `shatter` on Rocky shows **NOTHING**. This is intended (the verdicts:
they don't belong; D1: the leak is a force-enable leak, see below). **State clearly for the menu/UAT:**
the "force-enable-to-preview-on-a-wrong-world" workflow **no longer applies to `shatter` / `hexTess`.**

It **still applies** to the `rockyCrust`-soft-gated relief family (mountains/lava/edifices/tessera on
normal + icy worlds), which uses a continuous driver, not a hard gate — and mountains' knockdown is
narrow (Carbon/Crystal only), so mountains-preview on icy worlds survives.

### Manifest (`planet-feature-associations.js`) — verify-only, NO edit (resolved D3)

The manifest is **already aligned**. This is a no-op verification, not an edit:

- `mountains.rendersOn` (`:65`) = Rocky, Ocean, Venus, Eyeball, Mars, Lava — **already excludes
  Carbon/Crystal.** Correct. The false-render came from the driver deriving nonzero on those presets
  despite the manifest, which the knockdown now fixes. **No edit.**
- `shatter.rendersOn` (`:402`) = `['Frozen (airless)']` — correct (its member preset). The
  false-renders were force-enable leaks, not manifest over-declaration. **No edit.**
- `hexTess.rendersOn` (`:395`) = `['Frozen (airless)']` with **`rendersOnDivergent: true`** (`:394`)
  — **PRESERVED.** This is Max's taxonomy call (resolved D2): hexTess stays on Frozen, the divergent
  flag stays. The relevance gate honors it because the signal is derived from `rendersOn` (Frozen),
  not the raw archetype set. **No edit, no relocation.**
- `carbon.rendersOn` / `facets.rendersOn` — untouched (those features are unchanged). **No edit.**

The first draft's "prune `rendersOn`" language is removed: there is no prune. The implementation plan
should run the post-gate audit and confirm the manifest still matches; if (and only if) the audit
surprises, raise it — do not edit speculatively.

## Investigation findings (grounded; VERIFIED line numbers unless marked HINT)

1. **`habGate` precedent — confirmed, lab-level.** Computed in `applyDrivers()`
   (`planet-lod-lab.html:5524`, HINT) from `state.habitability` (`:5520`), seeded `:4950`, consumed by
   per-frame overlay writers via `× state.habGate`. `habGate` does **not** exist in
   `planet-lod-lab-core.js`. This is the exact pattern the relevance gate copies.

2. **Writer lines — VERIFIED via `grep -n "...value"`:**
   - `shatter`: `:7536` `uniforms.uShatStrength.value = state.shatterEnabled ? 1.0 : 0.0` — **lab
     writer, sole owner, pure enable.** Gateable lab-side.
   - `hexTess`: `:7527` `uniforms.uHexStrength.value = state.hexTessEnabled ? 1.0 : 0.0` — **lab
     writer, sole owner, pure enable.** Gateable lab-side.
   - `mountains`: `:7617` `uniforms.uMountainAmp.value = state.mountainsEnabled ? state.mountainAmp :
     0.0` — **lab writer.** `state.mountainAmp` set at `:5560` from `u.mountainAmp`
     (core-derived `× rockyCrust`). The lab multiplies the state copy without touching core.
   - `carbon`: `:7507` already driver-gated; **no change.** `facets`: `:7518`, `facetStrength` derived
     `:6263`; **no change.**

   **Result: zero core touches.** The gate is archetype/render identity (a lab concept), not a new
   physical driver. The silicate `rockyCrust` factor in core is untouched.

3. **Relevance signal reachable in `applyDrivers` — confirmed.** `ASSOCIATIONS` imported `:111`;
   `relevantFeatureSet()` defined `:7083` returns `{ set, archs }` (hoisted, callable from `:5514`);
   `ARCHETYPES` imported `:110`. Exotic archetype keys/presets `planet-archetypes.js:164–166`.

4. **`hexTess` identity — IS a registry feature; its archetype/manifest diverge BY DESIGN.** `hexTess`
   is a real `FEATURES` key (`planet-archetypes.js:118`, archetype `exotic-geometric`). It does not map
   to `facets`/`shatter` as an alias. Its registry archetype `exotic-geometric` → preset `Crystal`, but
   its manifest `rendersOn` + in-code comment (`planet-feature-associations.js:392–395`) ride it on
   `Frozen (airless)` — hence `rendersOnDivergent: true`. **Max's call (resolved D2): keep it on
   Frozen, keep the flag.** The gate therefore reads relevance from `rendersOn`, which includes Frozen.

5. **Frozen membership of the raw relevant set — VERIFIED, and it omits hexTess.** Archetypes whose
   `presets` include `Frozen (airless)`: `impact-airless` (`:157`), `volatile-cold` (`:161`),
   `exotic-shattered` (`:166`). `featuresOf(archKey)` (`:171`) returns features whose `archetypes`
   array includes that key. `hexTess.archetypes = ['exotic-geometric']` (`:118`), and `exotic-geometric`
   is NOT a Frozen archetype → **`relevantFeatureSet().set` on Frozen does NOT contain `hexTess`.**
   `shatter.archetypes = ['exotic-shattered']` (`:127`) IS → the set DOES contain `shatter`. This is
   precisely why the hexTess gate must read `rendersOn` (which lists Frozen), not the raw set (see D2).

6. **Render-audit re-run mechanism — confirmed.** `window._lab.renderDeltaSweep()` exists
   (`planet-lod-lab.html:7045`, HINT; exposed `:7820`, HINT); generator `scripts/gen-render-audit.mjs`
   exists; report `docs/FEATURES/lab-render-audit.md` exists with current counts **64 false-renders /
   51 dead-renders** (after `248b355`). The verification re-runs this.

## Deviations from the approved brainstorm (DO NOT silently "fix" — raise with Max)

These surfaced only by reading the code; they don't break the design but change its details.

- **D1 — `shatter` / `hexTess` leak via FORCE-ENABLE, not via the relevance filter.** Their member
  presets (`Frozen` for `shatter`; `Frozen` for `hexTess` via the divergent flag) mean the GUI
  relevance filter already keeps them OFF the relevant roster on Rocky/Ocean/etc. The false-render is
  purely the **pure-enable writer painting when force-enabled** (the audit's force-enable methodology
  catches it). The relevance hard-gate is the right fix — it makes force-enable **honest** (zeros on
  non-member worlds). Their `rendersOn` rosters already exclude Rocky/Ocean; this is a force-enable
  leak, NOT a relevance-filter leak. (Accurate framing for the plan + UAT script.)

- **D2 — `hexTess` divergence is RESOLVED (keep on Frozen) but forces the relevance signal to read
  `rendersOn`, not the raw archetype set.** Max's taxonomy call: hexTess stays on `Frozen (airless)`
  with `rendersOnDivergent: true` (no manifest relocation). The consequence, VERIFIED in code
  (finding #5): the raw `relevantFeatureSet().set` on Frozen does NOT contain hexTess, so gating by
  that raw set would **kill hexTess on Frozen** — the opposite of intent. Therefore the per-feature
  relevance signal is derived from `ASSOCIATIONS[key].rendersOn.includes(driverUI.preset)` (the
  effective render membership, which lists Frozen for hexTess). Alternatives the plan may consider, all
  preserving Frozen: (a) the `rendersOn` lookup above [DEFAULT — minimal, honors the divergent flag];
  (b) special-case hexTess to `driverUI.preset === 'Frozen (airless)'`; (c) add `'Frozen (airless)'`
  to `exotic-geometric.presets` so the raw set picks it up [rejected — would change Crystal/Frozen
  archetype semantics and the `rendersOn ⊆ archetype-union` test]. **Default = (a).** This is the one
  place where the refinement's "gate by `relevantFeatureSet().set`" wording does NOT match the data;
  the spec uses the equivalent honest signal (`rendersOn`) and flags it here.

- **D3 — NO manifest edit.** `mountains`/`shatter`/`hexTess`/`carbon`/`facets` `rendersOn` are all
  already correct; the divergent flag stays. The brainstorm's "prune `rendersOn`" reduces to a no-op
  verification after the gate lands.

## Mechanics & risks (on the record)

- **Line-number drift** in `planet-lod-lab.html` is real — line numbers marked HINT are hints;
  re-`grep -n` each edit site (`habGate`, `applyDrivers`, `relevantFeatureSet`, `uShatStrength`,
  `uHexStrength`, `uMountainAmp`, `ARCHETYPES`, `ASSOCIATIONS`) before editing. (Writer `.value`
  lines `:7507/:7518/:7527/:7536/:7617`, `state.mountainAmp` `:5560`, `relevantFeatureSet` `:7083`,
  and imports `:110/:111` were VERIFIED at authoring time.)
- **Byte-identical contract (the verification contract):** these F4x writers advertise
  "byte-identical pre-F4x output" when their gate is 0. Where a feature is **relevant** (member world),
  the gate value must be **exactly `1.0`** and the existing clamps must **not be reordered** — multiply
  by 1.0, leave the lab shape knobs untouched. So member-world renders (Crystal/Frozen/Carbon/icy
  member worlds) show **NO** change in the render-audit Δ; only the force-enable false-renders
  (shatter/hexTess on non-member worlds) and mountains-on-Carbon/Crystal disappear.
- **No core touch** is the expected outcome (finding #2). If the plan discovers a writer it cannot
  reach lab-side after re-grep (it should not), that becomes a flagged core change — do not bake it
  silently.
- **`facetStrength` is display-`listen()`ed** (`:6753`, HINT). Since `facets` is unchanged, this is
  not at risk here; noted only so the plan doesn't accidentally gate the display value.

## Out of scope

- The menu/info GUI overhaul — Ask 2 (feature info cards), Ask 3 (archetype info view), Ask 4 (live
  render-audit surfacing). Sibling thread, no rendering change.
- The broader Bucket-B silicate-relief family fix (mountains/lava/edifices/tessera on Europa/Titan/
  Frozen) — already landed via `rockyCrust` (`be989f4` / `5ef6ca9`); this thread only adds the exotic
  discriminators the silicate gate can't express, and deliberately leaves the icy-relief soft-gate +
  preview workflow intact.
- Any change to `carbon` or `facets` (both already honest) or to the normal/icy-world relief soft-gate.

## Verification

Campaign-style — render-audit Δ **and** live `:9223` **and** Max UAT.

- **Byte-identical contract (member worlds unchanged).** Where a feature is relevant, the gate
  multiplies by exactly `1.0` and existing clamps are not reordered. So the render-audit Δ shows **NO
  change** on Crystal/Frozen/Carbon and the icy member worlds; only the force-enable false-renders
  (shatter/hexTess on non-relevant worlds) + the mountains-on-Carbon/Crystal renders disappear.
- **Render-audit Δ re-run (objective).** Re-run the sweep via `window._lab.renderDeltaSweep()` +
  `node scripts/gen-render-audit.mjs`, regenerating `docs/FEATURES/lab-render-audit.md`. Post-Bucket-B
  baseline (at `248b355`) was **64 false-renders / 51 dead-renders**. Expected:
  - The `shatter` / `hexTess` force-enable false-renders on non-member worlds **clear**.
  - The `mountains` × Carbon (Δ 0.0007) and `mountains` × Crystal (Δ 0.0017) false-renders **clear**.
  - Total false-renders drop from **64** by those rows; **dead-renders (51) do NOT increase** for the
    member presets (byte-identical-when-1 — member worlds unchanged).
  - The accepted faint `craters` traces (#3) remain (intended; documented).
- **Live on chrome-devtools GPU `:9223`** (NOT Playwright — GPU path; per
  `well-dipper-testing-reference.md`). `127.0.0.1:5173/well-dipper/planet-lod-lab.html?fresh=1`,
  **reload `?fresh=1` before each check**, verify via `window._lab.*` + `evaluate_script` (DOM/uniform
  reads, not image recognition):
  - **Force-enable `shatter` on Rocky** → renders nothing; `uShatStrength` reads 0 (hard gate beats
    the enable flag).
  - **Force-enable `hexTess` on a non-member world (e.g. Rocky)** → renders nothing; `uHexStrength`
    reads 0.
  - **Crystal (faceted) preset** → `facets` + `hexTess` still render (their member preset),
    byte-identical to today; **no `mountains`** (`uMountainAmp` reads 0); only Crystal's own relief.
  - **Carbon (high C/O) preset** → `carbon` still renders; **no `mountains`** (`uMountainAmp` reads 0);
    only carbon's own relief.
  - **`shatter` AND `hexTess` on Frozen (airless)** both still render (their member world) — the gate
    must not over-zero; `uShatStrength` / `uHexStrength` read 1.
  - **mountains preview on an icy world (e.g. Europa/Titan/Frozen)** → force-enable still previews
    (knockdown is Carbon/Crystal-only; icy stays `rockyCrust`-soft-scaled + previewable).
- **Doc-only action for #3:** record the "accept faint craters on Ocean/Europa (science-legit, Δ
  ⚠️-tier)" decision in `docs/FEATURES/relief-triage-verdicts-2026-06-15.md` (promote the
  "Faint traces … deferred" line + the craters row to an explicit ACCEPTED entry). No code.
- **Max UAT** — Max rides the lab and confirms the gate reads right across presets. The UAT layer is
  **deferred-to-Max**, not agent-closeable; agents close only the render-audit + live-integration
  layers → `VERIFIED_PENDING_MAX <sha>`.
- **Existing suites** (`feature-associations`, `planet-archetypes`, the `cityLightsEnabled` pin #16,
  the Stage-D GLSL drift-guard, the `rendersOn ⊆ archetype-union` test) stay green. Since no manifest
  edit is made and the divergent flag is preserved, none of these should need updating; if any breaks,
  that signals an unexpected manifest interaction — flag it, don't paper over it.
- **Commit explicit paths only** (`planet-lod-lab.html`,
  `docs/FEATURES/relief-triage-verdicts-2026-06-15.md`, `docs/FEATURES/lab-render-audit.md` regen) —
  never `git add -A` (shared-tree litter: warp WIP + loose `.png`/`.webm`/`.html` + a file literally
  named `HEAD`).
