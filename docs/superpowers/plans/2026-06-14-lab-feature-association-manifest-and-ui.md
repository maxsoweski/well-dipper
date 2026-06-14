# Lab Feature Association Manifest + Reviewable UI — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `planet-lod-lab.html` reviewable — let Max pick a planet kind, see only that planet's features grouped with their associations (dependencies / modifiers / co-location), and isolate any one feature (alone OR in-context) to give per-feature feedback.

**Architecture:** Three layers, built in order. (1) An **association manifest** — a new data file that captures, per feature, the associations that today exist only in shader call-order and prose: domain, province co-location group, driver/feature dependencies, what it modifies downstream, the "isolation kit" needed to render it, and which presets it actually renders on. A vitest drift-guard pins it against the existing `FEATURES`/`PROVINCES` data so it can't silently rot. (2) **Isolation upgrades** on the existing lab — non-destructive solo (save/restore) plus an "in-context" mode that co-enables a feature's dependencies, with a toggle to bare. (3) A **new manifest-driven feature panel** (its own follow-on plan) that replaces the fragile two-root lil-gui with archetype-first navigation, auto-filtering to the current preset, and per-feature association chips.

**Tech Stack:** Vanilla ES modules, lil-gui (existing), vitest (existing test runner), Three.js GLSL lab (no framework).

---

## Design decisions (resolved with Max, 2026-06-14)

1. **Navigation model — Hybrid:** keep a familiar domain tree (relief / fluvial / cryo / atmosphere / optical / overlay / exotic), but every feature carries clickable **association chips** (depends-on, modifies, co-locates-with) that jump-to or isolate the linked feature. The menu shape stays conventional; the associations live on each feature.
2. **Isolation — both modes, toggle:** default is **in-context** (feature + the dependencies it needs to render — so you never see a black planet for a dependent feature like deltas/lakes/mass-wasting), with one click to **bare** (truly alone). Always non-destructive (restores the prior enable state).
3. **Build approach — manifest first, then a new panel:** author the manifest + isolation upgrades against the current lab first (Phases 1–2 here), then rebuild the feature panel data-driven from the manifest (Phase 3, expanded into its own plan once the manifest's shape is real).

## Why this is needed (the core finding)

The associations Max wants to navigate by **are not captured as data anywhere**. They live in:
- shader call-order and accumulator sharing (`grad`, `canyonHeight`, `fluvialWet`, `liquidMask`, bands substrate, nightMask family) — GLSL-only;
- `deriveUniforms()` (core JS, F1–F10) + `applyDrivers()` (HTML, F11–F49) — procedural, split across two files;
- per-feature prose comments in `planet-archetypes.js` (the archetype-membership-vs-actual-render divergence).

`FEATURES` entries carry only `{label, enableKey, archetypes}` — no `domain`, no co-location group, no dependency edges. So the manifest (Phase 1) is the prerequisite for any association-aware UI.

---

## File structure

| File | Responsibility | Created/Modified |
|---|---|---|
| `planet-feature-associations.js` (repo root, sibling of `planet-archetypes.js`) | The manifest: `ASSOCIATIONS[featureKey] = {domain, provinceGroup, dependsOn, modifies, isolationKit, rendersOn}` + enums + helper accessors | **Create** |
| `tests/feature-associations.test.js` | Drift-guard: every `FEATURES` key has an entry; enums valid; `provinceGroup` consistent with `PROVINCES` `{field,polarity}`; `dependsOn.features` / `modifies` / `isolationKit` reference real keys | **Create** |
| `planet-lod-lab.html` | Isolation upgrades (Phase 2): non-destructive solo, in-context vs bare, `window._lab` API additions; `renderDeltaSweep()` live harness (Phase 2.5) | **Modify** |
| `tests/lab-isolation.test.js` | Unit-test the pure isolation helpers (extract the enable-set computation as a pure fn so it's testable headless) | **Create** |
| `lab-render-audit.js` (repo root) | Pure auditor: `expectedMatrix(manifest, presets)` + `auditRenderMatrix(expected, actualDeltas)` → violations (`falseRenders`, `deadRenders`) | **Create** |
| `tests/render-audit.test.js` | Unit-test the pure auditor against a synthetic delta matrix | **Create** |
| `docs/FEATURES/lab-render-audit.md` | Output of the live sweep: preset×feature render matrix + the violations punch-list for Max's review | **Create** (generated) |
| `docs/superpowers/plans/2026-06-14-lab-feature-panel-rebuild.md` | Phase 3 detailed plan (the new panel) | **Create later** (after Phase 1 lands) |

**Shared-tree caution (from handoff):** the working tree also holds an unrelated warp-session `src/` WIP + loose untracked files. Stage **explicit paths only** — never `git add -A`.

---

## The manifest schema (the heart of Phase 1)

```js
// planet-feature-associations.js
// Captures, per feature, the associations that otherwise live only in shader
// call-order + prose. Keyed by the SAME feature keys as FEATURES (planet-archetypes.js).

export const DOMAINS = [
  'relief', 'fluvial', 'cryo', 'aeolian', 'gradational',
  'bands', 'storms', 'clouds', 'thermal', 'optical', 'dust',
  'exotic', 'overlay',
];

// Named co-location groups. Each maps to a {provinceField, polarity} tuple in
// PROVINCES (planet-archetypes.js) — features sharing a tuple physically cluster.
// 'global' = unprovinced (floor 1.0): atmosphere/optics/overlays, no geologic gating.
export const PROVINCE_GROUPS = {
  'tectonic-highlands': { field: 0, polarity:  1 }, // mountains, canyons, tessera, massWasting
  'old-plains':         { field: 0, polarity: -1 }, // craters, ejecta, dunes, dust
  'volcanic-provinces': { field: 1, polarity:  1 }, // edifices, lava, chaos, karst
  'anti-volcanic':      { field: 1, polarity: -1 }, // cryoRidge
  'ancient-high':       { field: 2, polarity:  1 }, // scarps, plateaus, sublimation
  'young-lowlands':     { field: 2, polarity: -1 }, // rivers, deltas, outflow, glacial
  'global':             null,                        // floor 1.0, unprovinced
};

// ASSOCIATIONS[key] = {
//   domain:       one of DOMAINS
//   provinceGroup: one of Object.keys(PROVINCE_GROUPS)
//   dependsOn:    { drivers: [driverName,...], features: [featureKey,...] }
//                 // drivers/features this feature READS (gates/scales on)
//   modifies:     [featureKey,...]  // features this one gates/feeds downstream
//   isolationKit: [featureKey,...]  // also-enable these so this feature renders
//                                   // meaningfully when isolated "in context"
//   rendersOn:    [presetName,...]  // DRIVER_PRESETS keys where this derives nonzero
//                                   // (vs merely folder-visible). [] = renders on none
//                                   //  / not-yet-audited — see note.
// }
export const ASSOCIATIONS = { /* authored in Task 2 */ };
```

The raw association facts to transcribe already exist — they were traced in the explorer reports this session (province groups, the driver→feature consumer table, the shader-coupling categories). Task 2 is transcription + judgment, not rediscovery.

---

## Phase 1 — The association manifest

### Task 1: Manifest scaffold + drift-guard test (TDD — test first)

**Files:**
- Create: `planet-feature-associations.js`
- Create: `tests/feature-associations.test.js`

- [ ] **Step 1: Write the failing test**

```js
// tests/feature-associations.test.js
import { describe, it, expect } from 'vitest';
import { FEATURES } from '../planet-archetypes.js';
import { ASSOCIATIONS, DOMAINS, PROVINCE_GROUPS } from '../planet-feature-associations.js';

const featureKeys = Object.keys(FEATURES);

describe('feature association manifest', () => {
  it('has an entry for every FEATURES key (no gaps)', () => {
    const missing = featureKeys.filter(k => !ASSOCIATIONS[k]);
    expect(missing, `features missing an association entry: ${missing.join(', ')}`).toEqual([]);
  });

  it('has no orphan entries (every entry maps to a real feature)', () => {
    const orphans = Object.keys(ASSOCIATIONS).filter(k => !FEATURES[k]);
    expect(orphans, `association entries for unknown features: ${orphans.join(', ')}`).toEqual([]);
  });

  it('every entry uses a valid domain and provinceGroup', () => {
    for (const k of featureKeys) {
      const a = ASSOCIATIONS[k];
      expect(DOMAINS, `${k}.domain`).toContain(a.domain);
      expect(Object.keys(PROVINCE_GROUPS), `${k}.provinceGroup`).toContain(a.provinceGroup);
    }
  });

  it('dependsOn.features / modifies / isolationKit reference real feature keys', () => {
    for (const k of featureKeys) {
      const a = ASSOCIATIONS[k];
      for (const ref of [...a.dependsOn.features, ...a.modifies, ...a.isolationKit]) {
        expect(FEATURES[ref], `${k} references unknown feature '${ref}'`).toBeTruthy();
      }
    }
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd /home/ax/projects/well-dipper && npx vitest run tests/feature-associations.test.js`
Expected: FAIL — `Cannot find module '../planet-feature-associations.js'`.

- [ ] **Step 3: Create the scaffold (schema + empty ASSOCIATIONS)**

Create `planet-feature-associations.js` with the `DOMAINS`, `PROVINCE_GROUPS`, and an **empty** `ASSOCIATIONS = {}` exactly as in the schema block above.

- [ ] **Step 4: Run the test to verify it now fails on the gap, not the import**

Run: `cd /home/ax/projects/well-dipper && npx vitest run tests/feature-associations.test.js`
Expected: FAIL — first assertion lists all ~49 feature keys as missing. (Import resolves; the completeness test drives Task 2.)

- [ ] **Step 5: Commit the scaffold**

```bash
cd /home/ax/projects/well-dipper
git add planet-feature-associations.js tests/feature-associations.test.js
git commit -m "feat(lab): scaffold feature-association manifest + drift-guard test"
```

### Task 2: Author all association entries

**Files:**
- Modify: `planet-feature-associations.js` (fill `ASSOCIATIONS`)

Transcribe one entry per `FEATURES` key from the traced data. Three fully-worked exemplars (one self-contained relief feature, one dependent fluvial feature, one global optical feature) — follow the same shape for the rest:

```js
export const ASSOCIATIONS = {
  // self-contained relief: renders alone, feeds F19 mass-wasting via grad
  mountains: {
    domain: 'relief',
    provinceGroup: 'tectonic-highlands',
    dependsOn: { drivers: ['erosion', 'tidalHeat'], features: [] },
    modifies: ['massWasting'],
    isolationKit: [],
    rendersOn: ['Rocky (Earthlike)', 'Ocean (temperate)', 'Mars (arid rocky)',
                'Venus (sulfuric shroud)', 'Eyeball (locked temperate)'],
  },

  // dependent fluvial: needs rivers' wet-channels + a basin to deposit into
  deltas: {
    domain: 'fluvial',
    provinceGroup: 'young-lowlands',
    dependsOn: { drivers: ['liquidStability', 'precipitation'], features: ['rivers'] },
    modifies: [],
    isolationKit: ['rivers', 'lakes'], // fluvialWet chain + basin
    rendersOn: ['Rocky (Earthlike)', 'Ocean (temperate)', 'Titan (methane seas)'],
  },

  // global optical: unprovinced, gated by a physical driver, renders alone
  aurora: {
    domain: 'optical',
    provinceGroup: 'global',
    dependsOn: { drivers: ['magneticField'], features: [] },
    modifies: [],
    isolationKit: [],
    rendersOn: ['Rocky (Earthlike)', 'Ocean (temperate)', 'Gas giant (Jovian)',
                'Gas giant (Saturnian)', 'Ice giant (Neptunian)', 'Hot Jupiter (locked giant)'],
  },

  // ... author the remaining ~46 keys identically.
};
```

**Authoring rules (judgment, applied per feature):**
- `domain` — from the explorer's domain column.
- `provinceGroup` — from `PROVINCES[key].{field,polarity}`; floor `1.0` ⇒ `'global'`.
- `dependsOn.drivers` — from the driver→consumer table (e.g. rivers→`liquidStability`+`precipitation`; aurora→`magneticField`; craters→`surfaceGravity`+`craterDensity`).
- `dependsOn.features` + `isolationKit` — from the shader-coupling categories: `fluvialWet` (deltas←rivers), `canyonHeight` writers (canyons/rivers/outflow/karst), `liquidMask` gating (coastlines/frost/dust ← lakes), the `grad` accumulator (massWasting ← every steep relief feature before the F19 line). When a feature needs another to be visible, that other goes in `isolationKit`; when it *gates* another, the other goes in this feature's `modifies` (and the manifest is symmetric — verify the inverse edge exists).
- `rendersOn` — best-effort from the per-feature prose comments (`planet-archetypes.js` L46–150) describing which presets the drivers derive nonzero on. If a feature's render-set is genuinely unaudited, leave `rendersOn: []` and add a `// TODO audit` comment — the panel (Phase 3) treats `[]` as "show under all its archetype presets, unverified," so this is safe, not a blocker.

- [ ] **Step 1: Author every entry** in `ASSOCIATIONS` per the rules above.

- [ ] **Step 2: Run the drift-guard test**

Run: `cd /home/ax/projects/well-dipper && npx vitest run tests/feature-associations.test.js`
Expected: PASS (all four assertions green — no missing keys, no orphans, valid enums, all refs real).

- [ ] **Step 3: Commit**

```bash
cd /home/ax/projects/well-dipper
git add planet-feature-associations.js
git commit -m "feat(lab): author feature-association entries for all features"
```

### Task 3: Pin provinceGroup against the live PROVINCES table

This stops the manifest's co-location groups from drifting away from the actual province affinities the shader uses.

**Files:**
- Modify: `tests/feature-associations.test.js` (add one `describe` block)
- Modify: `planet-feature-associations.js` (export a `provinceGroupOf(field, polarity)` helper used by both manifest and test)

- [ ] **Step 1: Add the helper to the manifest**

```js
// planet-feature-associations.js — add:
export function provinceGroupOf(field, polarity) {
  for (const [name, t] of Object.entries(PROVINCE_GROUPS)) {
    if (t && t.field === field && t.polarity === polarity) return name;
  }
  return 'global';
}
```

- [ ] **Step 2: Write the failing test** (only fails if a manifest provinceGroup contradicts PROVINCES)

```js
// append to tests/feature-associations.test.js
import { PROVINCES } from '../planet-archetypes.js';
import { provinceGroupOf } from '../planet-feature-associations.js';

describe('provinceGroup ⇔ PROVINCES consistency', () => {
  it('each provinced feature\'s group matches its PROVINCES field+polarity', () => {
    for (const k of Object.keys(FEATURES)) {
      const p = PROVINCES[k];
      if (!p || p.floor >= 1.0) continue;            // global / unprovinced — skip
      const expected = provinceGroupOf(p.field, p.polarity);
      expect(ASSOCIATIONS[k].provinceGroup, `${k}`).toBe(expected);
    }
  });

  it('every floor-1.0 (unprovinced) feature is marked global', () => {
    for (const k of Object.keys(FEATURES)) {
      const p = PROVINCES[k];
      if (p && p.floor < 1.0) continue;
      expect(ASSOCIATIONS[k].provinceGroup, `${k}`).toBe('global');
    }
  });
});
```

> Confirm the exact exported name/shape of the provinces table in `planet-archetypes.js` before running (the explorer reported a `PROVINCES` map keyed by feature with `{field, polarity, floor}`; if the export name differs, adjust the import). This is the one place to verify against the live file, not the report.

- [ ] **Step 3: Run — expect PASS** if Task 2 entries are correct; any FAIL pinpoints a feature whose `provinceGroup` disagrees with its actual affinity. Fix the manifest entry (the PROVINCES table is authoritative).

Run: `cd /home/ax/projects/well-dipper && npx vitest run tests/feature-associations.test.js`
Expected: PASS (all six assertions).

- [ ] **Step 4: Commit**

```bash
cd /home/ax/projects/well-dipper
git add planet-feature-associations.js tests/feature-associations.test.js
git commit -m "test(lab): pin manifest provinceGroup to live PROVINCES affinities"
```

**Phase 1 done when:** `npx vitest run tests/feature-associations.test.js` is fully green and the manifest covers every feature. This is the catalog — the single source of truth the panel and isolation upgrades both read.

---

## Phase 2 — Isolation upgrades (current lab)

Goal: make isolation reviewable and non-destructive *before* the panel rebuild, so Max can start reviewing immediately even against today's GUI. Reuses the existing `setFeatureEnables` (`planet-lod-lab.html` ~L6905) and `window._lab` (~L7621).

**Key idea — extract a pure function so it's unit-testable headless:**

```js
// new pure helper (define near setFeatureEnables in planet-lod-lab.html, and
// mirror into a tiny importable module if the test needs it — see Task note):
//   computeEnableSet(allKeys, { solo, mode, isolationKit }) -> Set<string>
//     mode 'bare'      -> just [solo]
//     mode 'context'   -> [solo, ...isolationKit]
//     solo null        -> all keys (un-solo)
```

### Task 4: Non-destructive solo with save/restore
- Capture the enable state into `_preSoloEnables` the first time a solo is entered; `unsolo()` restores it (not just "enable all").
- `window._lab.unsolo()` added; the existing `clear solo` button calls it.

### Task 5: In-context vs bare toggle
- `window._lab.solo(key, { mode })` where `mode` defaults to `'context'`; reads `ASSOCIATIONS[key].isolationKit` to compute the co-enable set via `computeEnableSet`.
- `window._lab.soloMode` getter/setter; a lab control (single dropdown: context | bare) re-applies the current solo on change.
- Per-feature `🔆 solo` buttons honor the current mode.

### Task 6: Unit-test the pure enable-set logic
- `tests/lab-isolation.test.js` covers: bare → `{key}`; context → `{key} ∪ isolationKit`; null → all; restore returns the exact pre-solo set. (Pure fn, no DOM — extract `computeEnableSet` into the manifest module or a small `lab-isolation.js` so vitest can import it.)

> Phase 2 tasks are specified at the task level; each will be expanded to bite-sized TDD steps at execution time (same format as Phase 1). They're deliberately small and depend only on the manifest from Phase 1.

---

## Phase 2.5 — Render-audit quality gate (the final test)

**Why:** today a bunch of features render on presets where they shouldn't — and look broken doing it. The manifest (Phase 1) declares the *intended* render-set per feature (`rendersOn`); this gate verifies the *actual* lab matches it, group by group, so the catalog isn't just documentation but an enforced contract. It is the concrete, automatable form of "a basic quality check as the feature groups are identified."

**What it checks**, for every (preset × feature) cell:
- **False-render (the bug Max sees):** preset ∉ `ASSOCIATIONS[feature].rendersOn`, but the feature's A/B delta (solo ON vs OFF, in-context) is **nonzero** → it's painting pixels on a planet it shouldn't touch. ⚠️ flag.
- **Dead-render:** preset ∈ `rendersOn`, but delta is **zero** → claims to render, actually inert (manifest optimistic, or driver gate broken). ⚠️ flag.
- **Degenerate output ("looks broken"):** on a preset it *should* render on, sample the render target — all-black (nothing emerged), blown-out/NaN (white overflow), or out-of-gamut → 🔧 candidate. (Aesthetic "looks broken" beyond these degenerate cases stays Max's review-lap call; this catches the mechanical failures.)

**Ordering:** runs after Phase 2 because the sweep relies on the **non-destructive solo** (Task 4) to restore state and the **in-context isolation** (Task 5) so dependent features actually emerge. It is organized **by association group** — it sweeps and reports group-by-group (tectonic-highlands, young-lowlands, atmosphere/global, …) so the output reads as a per-group quality check, matching how the groups were catalogued in Phase 1.

**Disambiguation is the point:** each violation tells Max *which* of two fixes a feature needs — manifest wrong (`rendersOn` should include this preset) vs feature actually buggy (driver gate derives nonzero where it shouldn't, in `applyDrivers()`/`deriveUniforms()`). The audit produces the punch-list; the fixes are follow-on work, triaged with Max.

### Task 7: Pure auditor (TDD — headless, no GPU)

**Files:**
- Create: `lab-render-audit.js`
- Create: `tests/render-audit.test.js`

- [ ] **Step 1: Write the failing test**

```js
// tests/render-audit.test.js
import { describe, it, expect } from 'vitest';
import { expectedMatrix, auditRenderMatrix } from '../lab-render-audit.js';

describe('render audit', () => {
  const manifest = {
    rivers: { rendersOn: ['Rocky', 'Ocean'] },
    aurora: { rendersOn: ['Rocky', 'Gas giant'] },
  };
  const presets = ['Rocky', 'Ocean', 'Gas giant'];

  it('expectedMatrix marks the declared render cells true', () => {
    const m = expectedMatrix(manifest, presets);
    expect(m.rivers.Ocean).toBe(true);
    expect(m.rivers['Gas giant']).toBe(false);
    expect(m.aurora['Gas giant']).toBe(true);
  });

  it('flags a false-render (renders where rendersOn says it should not)', () => {
    const expected = expectedMatrix(manifest, presets);
    const actualDeltas = { rivers: { Rocky: 0.4, Ocean: 0.3, 'Gas giant': 0.2 }, // <- 0.2 on Gas giant = bug
                           aurora: { Rocky: 0.5, Ocean: 0.0, 'Gas giant': 0.6 } };
    const v = auditRenderMatrix(expected, actualDeltas, { eps: 0.01 });
    expect(v.falseRenders).toContainEqual({ feature: 'rivers', preset: 'Gas giant', delta: 0.2 });
    expect(v.deadRenders).toEqual([]); // aurora Ocean is 0 but Ocean ∉ rendersOn(aurora) → not dead, correctly absent
  });

  it('flags a dead-render (declared but inert)', () => {
    const expected = expectedMatrix(manifest, presets);
    const actualDeltas = { rivers: { Rocky: 0.0, Ocean: 0.3, 'Gas giant': 0.0 }, // Rocky declared but 0 = dead
                           aurora: { Rocky: 0.5, Ocean: 0.0, 'Gas giant': 0.6 } };
    const v = auditRenderMatrix(expected, actualDeltas, { eps: 0.01 });
    expect(v.deadRenders).toContainEqual({ feature: 'rivers', preset: 'Rocky', delta: 0.0 });
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd /home/ax/projects/well-dipper && npx vitest run tests/render-audit.test.js`
Expected: FAIL — `Cannot find module '../lab-render-audit.js'`.

- [ ] **Step 3: Implement the pure auditor**

```js
// lab-render-audit.js
export function expectedMatrix(manifest, presets) {
  const m = {};
  for (const [feature, a] of Object.entries(manifest)) {
    m[feature] = {};
    for (const p of presets) m[feature][p] = (a.rendersOn || []).includes(p);
  }
  return m;
}

// expected: featureKey -> preset -> bool (should render)
// actualDeltas: featureKey -> preset -> number (measured ON/OFF pixel delta)
export function auditRenderMatrix(expected, actualDeltas, { eps = 0.01 } = {}) {
  const falseRenders = [], deadRenders = [];
  for (const feature of Object.keys(expected)) {
    for (const preset of Object.keys(expected[feature])) {
      const should = expected[feature][preset];
      const delta = (actualDeltas[feature] || {})[preset] ?? 0;
      if (!should && delta > eps) falseRenders.push({ feature, preset, delta });
      if (should && delta <= eps) deadRenders.push({ feature, preset, delta });
    }
  }
  return { falseRenders, deadRenders };
}
```

- [ ] **Step 4: Run to verify PASS**

Run: `cd /home/ax/projects/well-dipper && npx vitest run tests/render-audit.test.js`
Expected: PASS (all three).

- [ ] **Step 5: Commit**

```bash
cd /home/ax/projects/well-dipper
git add lab-render-audit.js tests/render-audit.test.js
git commit -m "feat(lab): pure render-audit (false-render / dead-render detection)"
```

### Task 8: Live sweep harness + generate the audit report

**Files:**
- Modify: `planet-lod-lab.html` (add `window._lab.renderDeltaSweep()`)
- Create (generated): `docs/FEATURES/lab-render-audit.md`

Task-level (expands to bite-sized steps at execution; needs GPU `:9223`, NOT Playwright — see `well-dipper-testing-reference`):
- Add `window._lab.renderDeltaSweep()` — for the **current** preset, loop every feature: in-context solo ON → tick ~5 frames (driven uniforms lag a frame) → read the low-res render target (`_lab.sceneTarget`, NOT the default framebuffer) → solo OFF → tick → read → summed-abs pixel delta. Restore prior enables (Phase-2 non-destructive). Return `{ preset, deltas: {feature: delta}, degenerate: {feature: 'black'|'blown'|null} }`.
- Driver script (chrome-devtools): for each `DRIVER_PRESETS` key → `_lab.setPreset(p)` → `renderDeltaSweep()` → collect.
- Feed the collected matrix through the Task-7 `auditRenderMatrix` + `expectedMatrix` → write `docs/FEATURES/lab-render-audit.md`: a preset×feature table (✅ expected-and-renders / ⚠️ false-render / ⚠️ dead-render / 🔧 degenerate), grouped by association group, with the violations punch-list at top for Max.
- **Gate:** the audit report's existence + a triaged violations list is the Phase-2.5 deliverable. Fixing the violations (manifest `rendersOn` vs driver-gate bugs) is follow-on, triaged with Max — not auto-fixed in this gate.

> The campaign already uses this A/B-delta technique (solo + ON/OFF, double-rAF before reads); reuse those lessons (`well-dipper-lod-terrain-campaign` memory: same-tick uniform reads lie; `?fresh=1` to stop sessionStorage restoring stale state mid-sweep).

---

## Phase 3 — New manifest-driven feature panel (separate plan)

Per the resolved "manifest first, then new panel" decision and the writing-plans scope rule (multiple independent subsystems → separate plans), the panel rebuild gets its own detailed plan authored **after** Phase 1 lands and the manifest's real shape is in hand. Scope to capture there:

- **Archetype-first nav:** archetype dropdown → preset dropdown (filtered to that archetype's presets) → basic rig settings → features. Replaces today's preset-only entry and the dead read-only archetype label.
- **Auto-filter to preset:** wire `applyArchetypeFilter()` to the preset `onChange` (today it's opt-in and goes stale) — show only features in the current planet's relevant set.
- **Hybrid layout:** domain-tree groups, each feature row carrying **association chips** — `depends-on ▸`, `modifies ▸`, `co-locates ▸` — that jump to or isolate the linked feature (data straight from the manifest).
- **Isolation controls inline:** the Phase-2 context/bare toggle + non-destructive solo surfaced on every feature row, not console-only.
- **Replace the two-root lil-gui** (guiLeft/guiRight + DOM title-bar surgery + manual sync) with one purpose-built panel, or a single lil-gui root driven entirely from the manifest — decide in that plan after weighing how much of lil-gui's free behavior (save/load blobs, `.listen()` on driven fields) is worth keeping.

---

## Self-review

- **Spec coverage:** isolate-any-feature → Phase 2 (Tasks 4–6) + Phase 3 inline controls; navigate-by-associations → Phase 1 manifest (`dependsOn`/`modifies`/`provinceGroup`) surfaced as Phase 3 chips; archetype-first + basic-settings-then-features → Phase 3 nav; "catalog and update" → the manifest + drift-guard tests (Tasks 1–3) keep catalog and code in sync; **basic quality check as groups are identified / features rendering when they shouldn't → Phase 2.5 render-audit gate (Tasks 7–8)**, organized by association group, flagging false-renders + degenerate output. Covered.
- **Type consistency:** `ASSOCIATIONS[key]` shape (`domain, provinceGroup, dependsOn:{drivers,features}, modifies, isolationKit, rendersOn`) is identical in the schema block, the three exemplars, and every test assertion. `computeEnableSet(allKeys, {solo, mode, isolationKit})` is referenced identically in Tasks 5 and 6. `provinceGroupOf(field, polarity)` defined in Task 3 Step 1, used in Step 2.
- **Placeholders:** Phase 1 is fully concrete (real test code, real schema, real exemplars). The ~46 un-exemplified manifest entries are bounded by the completeness test (Task 1) and the authoring rules (Task 2) rather than inlined — a deliberate, enforced decomposition, not a TODO. Phases 2–3 are task-level by design (Phase 3 is explicitly a separate plan); they expand to bite-sized steps at execution.

## One thing to verify against the live file before executing
The province table's exact export name and shape (`PROVINCES` keyed by feature, `{field, polarity, floor}`) is taken from the explorer report. Confirm it in `planet-archetypes.js` at execution time (Task 3 Step 2 note) — doc/report line numbers drift badly in this repo; re-grep.
