# LOD Lab Live Render-Audit Surfacing — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an **"Audit this world"** button to the planet-LOD lab's World folder that runs the existing in-page `renderDeltaSweep()` for the CURRENT preset, classifies all 47 features via the existing pure auditor (`lab-render-audit.js`) + a new pure status module (`lab-render-status.js`), stores the result on `state.audit`, and surfaces it as per-feature title-bar glyph badges (`✅`/`🔴F`/`⚠️F`/`⚠️D`/`·`/`⬛`) + a World-folder summary that auto-stales on any user edit.

**Architecture:** One **new pure module** (`lab-render-status.js`) owns the tier constants (`EPS`/`STRONG`) and the `statusOf(should, delta, degenerate)` glyph mapping — unit-tested headless, and imported by BOTH the lab (`world-engine-lab.html`) and the offline report generator (`scripts/gen-render-audit.mjs`, which deletes its own local `EPS`/`STRONG`). The lab adds an audit *runner* (calls the already-exposed `renderDeltaSweep()`, runs `expectedMatrix`/`auditRenderMatrix` from `lab-render-audit.js`, derives a glyph per feature via `statusOf`, writes `state.audit`), a **plain-DOM badge** on each feature folder's title bar (mirroring the proven `relocateEnableToTitle()` injection), and **two global `gui.onChange` hooks** (one per top-level GUI) guarded by an `_auditing` boolean that auto-stale the audit on any user control change. **No `planet-lod-lab-core.js` (shader/uniform) change** — Ask 4 adds no GPU code, only a surface over the sweep that already exists, so no planet rendering can regress.

**Tech Stack:** ES modules (`node`/Vitest-importable pure module), Vitest (the `statusOf` unit test — the module is importable; the lab `<script>` is NOT), lil-gui (`addFolder`, controller `.domElement`/`.$title`, top-level `gui.onChange`), plain DOM for the badge, Vite dev server (`localhost:5173`), chrome-devtools MCP on GPU Chrome `:9223` for live GUI verification (NOT Playwright — Playwright is CPU and the sweep needs the GPU; NOT image recognition — `state`/DOM queries only), `node scripts/gen-render-audit.mjs` + `git diff --exit-code` for the byte-identical-report check.

**Spec:** `docs/superpowers/specs/2026-06-15-lod-lab-render-audit-surfacing-design.md` (APPROVED, 5 decisions LOCKED, committed `dd733ce`).

**Sibling plans (format reference):** `docs/superpowers/plans/2026-06-15-lod-lab-feature-info-cards.md` (Ask 2 — has the generator + drift-guard shape) and `docs/superpowers/plans/2026-06-15-lod-lab-archetype-info-view.md` (Ask 3 — the title-bar/field-row injection shape). Ask 4 (this plan) is the **heaviest** of the three info-layer GUI asks: it has a generator-adjacent pure-module + unit-test like Ask 2, the title-bar DOM injection like both, PLUS a live runner and the staleness mechanism unique to it.

---

## Build-ordering note: Ask 4 is INDEPENDENT of Asks 2/3 and Thread B (read before starting)

- **Asks 2/3 named integration points are NOT hard dependencies.** The spec names two optional hook-ins (the Ask 2 card's State line and the Ask 3 roster chips can read `state.audit.results[key].status` *if/when* those ship). This plan does **NOT** build them and does **NOT** require Asks 2/3 to exist. Ask 4's primary surface is its own per-feature title-bar badge, which stands alone. (Spec §"Where badges show".)
- **Thread B is a sequencing preference, not a code dependency.** Ask 4 reads whatever the live sweep returns; it surfaces fewer violations once Thread B lands, but builds and verifies fine before it. (Spec §"Sequencing".)
- **The shared pattern Ask 4 copies is `relocateEnableToTitle()`** (Phase 1, already in the file) — not Asks 2/3.

If Asks 2/3 ship first and already define a `.title-info` CSS rule, Ask 4's badge uses a **distinct** class (`.audit-badge`) so there is no collision. Either order works.

---

## Verification reality (read before any GUI step)

The lab GUI is an **inline `<script>` in `world-engine-lab.html`** — NOT importable by Vitest. The **one genuinely testable seam** is the new pure module `lab-render-status.js` (`statusOf` + `EPS`/`STRONG`), which IS a Node ES module → real Vitest unit test (Task 1). The **byte-identical report re-gen** after the shared-constant refactor is also offline-testable (`node scripts/gen-render-audit.mjs` + `git diff --exit-code`, Task 2). **Everything GUI** (the button, badges, summary, staleness, the `_auditing` guard) is verified **live on `:9223`** (GPU Chrome, NOT Playwright, NOT image recognition) via `window._lab.*` helpers + `evaluate_script` state/DOM queries. Reload `?fresh=1` before each check.

**Existing test contract that must stay green:**
- `tests/render-audit.test.js` — the pure auditor (`expectedMatrix`/`auditRenderMatrix`). The shared-constant refactor (Task 2) changes only **where `gen-render-audit.mjs` sources `EPS`/`STRONG`**, NOT `lab-render-audit.js`'s logic — so this stays green untouched.
- `tests/planet-archetypes.test.js` — scans the lab source with `/\.add\(state, '(\w+Enabled)'\)/g` + the `cityLightsEnabled → PROV_CITYLIGHTS` pin. The badge injection is **plain DOM** and adds NO `.add(state, '…Enabled')` calls and removes none. Do not refactor any `.add(state, 'xEnabled')` line.
- `tests/feature-associations.test.js`, `tests/planet-archetypes.test.js`, the `cityLightsEnabled` pin, and the Stage-D GLSL drift-guard — all untouched (additive GUI-only + a behavior-preserving constants refactor).

---

## Standing cautions

- **Line numbers are HINTS** — `grep -n` every edit site before editing (line drift in `world-engine-lab.html` is a known hazard). Re-grep before each task: `renderDeltaSweep`, `relevantFeatureSet`, `relocateEnableToTitle`, `applyArchetypeFilter`, `fWorld`, the World-folder controller block (~7115-7121), `window._lab`, `guiLeft`/`guiRight`.
- **Stage explicit paths only.** Allowed paths this plan touches: `lab-render-status.js`, `tests/render-status.test.js`, `scripts/gen-render-audit.mjs`, `world-engine-lab.html`, `docs/NOW.md`. **NEVER `git add -A`** — the shared working tree has unrelated warp WIP, loose `.png`/`.webm`/`.html` litter, and a 0-byte `HEAD` file.
- **Do NOT run `git show HEAD`** (the 0-byte `HEAD` litter file collides with the ref).
- Reload `localhost:5173/well-dipper/world-engine-lab.html?fresh=1` before each live verification (`:9223` may hold a stale session; `?fresh=1` opts out of the sessionStorage scenario-restore).
- **Do NOT probe localhost with Bash curl/wget** — the sandbox returns `000`/refused for `:5173`/`:9223` regardless of liveness; check via `mcp__chrome-devtools__list_pages`.
- End every commit message with: `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`

---

## Decisions LOCKED by spec + source inspection (do NOT re-litigate)

These are the spec's 5 LOCKED decisions, confirmed against the live source. Honor every one:

1. **Staleness = one `guiLeft.onChange` + one `guiRight.onChange`, guarded by `_auditing`.** lil-gui bubbles every controller change up to the parent GUI's `onChange` (`node_modules/lil-gui/dist/lil-gui.esm.js` `_callOnChange`), so two top-level hooks cover all ~47 toggles + every slider with no per-controller wiring. ANY user control change → `state.audit.fresh = false`, badges dim, summary shows "stale — re-audit." The audit's OWN sweep mutates enables 6×/feature + calls `syncDisplays()`; the `_auditing` boolean (set across the whole sweep, early-returned in both handlers) prevents the audit self-staling. (Spec §"Detection hook" + §"The `_auditing` guard".)

2. **Glyphs = the report's EXACT strings.** `✅` / `🔴F` (keeps the **F** suffix — never bare `🔴`) / `⚠️F` / `⚠️D` / `·` / `⬛`, matching `gen-render-audit.mjs` `glyph()` (verified at `scripts/gen-render-audit.mjs:56-64`). (Spec §"Per-feature STATUS vocabulary".)

3. **Degenerate `⬛` WINS over the delta tier** for the single in-GUI badge — `statusOf` short-circuits on `degenerate != null` before any delta comparison. This is a deliberate divergence from the offline report (which side-channels degenerates AND still prints the delta glyph); the single-glyph badge has one slot, so ⬛-wins is the honest read. (Spec §"Degenerate precedence".)

4. **Conservative staling: ANY control change stales.** Both global handlers stale on every controller change they see (enables, sliders, preset, filter, camera/view/quality knobs). Exempting pure view/camera knobs is explicit DEFERRED/YAGNI — **not built in v1.** (Spec §"Staling scope".)

5. **Shared constants: BOTH consumers import `EPS`/`STRONG` from `lab-render-status.js`.** `gen-render-audit.mjs` deletes its local `const EPS = 1e-4` / `const STRONG = 5e-4` (verified at `scripts/gen-render-audit.mjs:14-15`) in favor of the import. **Pass `eps` EXPLICITLY to `auditRenderMatrix`** — its own default is `0.01` (verified `lab-render-audit.js:22`), two orders of magnitude coarser than `1e-4`; omitting it silently reclassifies faint renders as inert and makes the badge disagree with the report. (Spec §"Thresholds" + the footgun callout.)

**Source facts confirmed (line numbers are HINTS):**
- `renderDeltaSweep({ settleFrames, perPixelThresh } = {})` is `async`, returns `{ preset, deltas, degenerate }` for the **current** preset (`world-engine-lab.html:7045-7080`). `deltas[key]` = a single frame-fraction number; `degenerate[key]` = `null` | `'black'` | `'blown'`. It freezes auto-spin (`_sweepFreeze`), drives `t`+`state.yaw` by hand, and restores clock/camera/enables/`syncDisplays()`/`_sweepFreeze` at the end (`:7075-7078`). JS-object return only — no file/localStorage write.
- `window._lab.renderDeltaSweep(opts)` is **already exposed** (`:7820`) — the runner can call `renderDeltaSweep()` directly (it's in module scope) and `:9223` verification can call `window._lab.renderDeltaSweep()`.
- `relevantFeatureSet()` returns `{ set, archs }`; `set` is the preset's natural feature union — the sweep's baseline (`:7083-7088`).
- `expectedMatrix(manifest, presets)` and `auditRenderMatrix(expected, actualDeltas, { eps = 0.01 })` are pure/DOM-free/importable (`lab-render-audit.js:8`, `:22-33`). `falseRender = !should && delta > eps`; `deadRender = should && delta <= eps`. Currently **NOT** imported in the lab (net-new import).
- `ASSOCIATIONS` is imported at `world-engine-lab.html:111`; `FEATURES`/`ARCHETYPES`/`featuresOf` at `:110`. `FEATURES` keys ≡ `ASSOCIATIONS` keys (47 each, gap-free join — verified by Asks 2/3).
- `relocateEnableToTitle(folder, prop)` (`:6935-6943`) is the reference title-bar DOM-injection pattern: `appendChild` onto `folder.$title`, `stopPropagation` on the injected control. The relocation loop runs at `:6944-6946`.
- World-folder controllers are created on `fWorld` (`= guiLeft.addFolder('World')`, `:5266`) at `:7115-7121` — preset picker (`:7115`), disabled `archetype` label (`:7116`), `filter to relevant` (`:7117`), solo mode (`:7119`), enable all (`:7120`), clear solo (`:7121`). The "Audit this world" button is added in this block.
- `guiLeft = new GUI(...)` (`:5246`), `guiRight = new GUI(...)` (`:5249`). Neither has an `.onChange` yet (grep confirmed). Feature folders live on `guiRight` (`:6273` onward); World/Drivers/View on `guiLeft`.
- The sweep's own enable churn goes through `applyEnableSet` (`:6972`) + `syncDisplays()` (`:7077`) — the controller mutations the `_auditing` guard must mask.
- `gen-render-audit.mjs`: imports `auditRenderMatrix`/`expectedMatrix` (`:12`), local `EPS`/`STRONG` (`:14-15`), `auditRenderMatrix(..., { eps: EPS })` (`:38`), `glyph()` (`:56-64`), writes `docs/FEATURES/lab-render-audit.md` (`:200`). `lab-render-audit.md` is clean in git now (so a byte-identical re-gen check is meaningful).

---

## File Structure

| File | Responsibility | Action |
|---|---|---|
| `lab-render-status.js` | Pure, DOM-free. Exports `EPS = 1e-4`, `STRONG = 5e-4`, and `statusOf(should, delta, degenerate)` → the report's exact glyph string. Single source of the tier logic + the ⬛-degenerate-wins precedence. Importable in Vitest AND the in-page `<script>`. | **Create** |
| `tests/render-status.test.js` | Unit test: `statusOf` across all six tiers + the `eps`/`STRONG` boundary edges. | **Create** |
| `scripts/gen-render-audit.mjs` | Delete local `EPS`/`STRONG` (`:14-15`); import them from `lab-render-status.js`. Behavior-preserving — verified by byte-identical report re-gen. | **Modify** |
| `world-engine-lab.html` | Import `expectedMatrix`/`auditRenderMatrix` + `statusOf`/`EPS`; add the audit runner (`runAudit()` → `state.audit`, `_auditing` guard); the "Audit this world" button + World summary + "Auditing…" state; per-feature title-bar badges reading `state.audit`; the two global `gui.onChange` staleness hooks; a small CSS block. | **Modify** (inline `<script>` + one CSS block) |
| `docs/NOW.md` | Close-out: note Ask 4 landed `VERIFIED_PENDING_MAX <sha>`. | **Modify** |

No generator (Ask 4 reads everything at runtime; the only authored artifact is the pure module + its test). No new generated data file.

---

## Pre-flight (once, before Task 1)

- [ ] **Step 0.1: Confirm `lab-render-status.js` does not already exist and capture the report's current glyphs for the cross-check.**

Run:
```bash
cd /home/ax/projects/well-dipper
ls -la lab-render-status.js 2>&1 || echo "absent (expected — net new)"
sed -n '56,64p' scripts/gen-render-audit.mjs    # the report's glyph() — our statusOf must match it
grep -n "^const EPS\|^const STRONG" scripts/gen-render-audit.mjs
git status --short docs/FEATURES/lab-render-audit.md && echo "report clean? (blank above = clean)"
```
Expected: `lab-render-status.js` absent; `glyph()` returns `✅` / `⚠️D` / `🔴F` / `⚠️F` / `·` (no `⬛` — degenerates are side-channeled in the report, NOT in `glyph()`); `EPS`/`STRONG` declared at ~L14-15; `lab-render-audit.md` shows no diff (clean — the byte-identical check in Task 2 is meaningful).

- [ ] **Step 0.2: Confirm the dev server + lab are reachable on `:9223`.**

Run (chrome-devtools MCP): `list_pages`, then `navigate_page` reload `localhost:5173/well-dipper/world-engine-lab.html?fresh=1`.
Expected: page loads, planet renders, left (Drivers/World) + right (Features) GUI panels visible.

- [ ] **Step 0.3: Pick a known-violation preset from the offline report** (so later live checks have a concrete expected glyph).

Run:
```bash
cd /home/ax/projects/well-dipper
grep -n "🔴F\|⚠️F\|⚠️D\|🔴 \|Strong false\|Faint false\|Dead-render" docs/FEATURES/lab-render-audit.md | head -30
```
Expected: the report lists specific (feature, preset) violation cells. **Record one concrete strong-false (`🔴F`) cell** — its feature key + preset name. (Fallback if the renderer is now clean: Step 4.x force-enables an irrelevant feature on a clean preset, which is itself a `🔴F` signal — the spec's "this feature paints a world it has no business on" case.)

---

## Task 1: The pure `lab-render-status.js` module + unit test

The one genuinely test-worthy seam. Define `statusOf` + the shared constants, TDD-style.

**Files:**
- Create: `lab-render-status.js`
- Test: `tests/render-status.test.js`

- [ ] **Step 1.1: Write the failing test.**

Create `tests/render-status.test.js`:
```js
// tests/render-status.test.js
// Pure status-mapping seam for the live render-audit surface (Ask 4). statusOf maps
// (should, delta, degenerate) -> the offline report's EXACT glyph string, applying
// the ⬛-degenerate-wins precedence. Boundaries pinned to eps=1e-4 / STRONG=5e-4.
import { describe, it, expect } from 'vitest';
import { statusOf, EPS, STRONG } from '../lab-render-status.js';

describe('lab-render-status', () => {
  it('exports the report thresholds', () => {
    expect(EPS).toBe(1e-4);
    expect(STRONG).toBe(5e-4);
  });

  it('fires-as-declared: should && delta > eps -> ✅', () => {
    expect(statusOf(true, 0.01, null)).toBe('✅');
  });

  it('strong false-render: !should && delta > STRONG -> 🔴F (keeps the F suffix)', () => {
    expect(statusOf(false, 0.001, null)).toBe('🔴F');
  });

  it('faint false-render: !should && eps < delta <= STRONG -> ⚠️F', () => {
    expect(statusOf(false, 2e-4, null)).toBe('⚠️F');
  });

  it('dead-render: should && delta <= eps -> ⚠️D', () => {
    expect(statusOf(true, 0, null)).toBe('⚠️D');
  });

  it('correctly inert: !should && delta <= eps -> ·', () => {
    expect(statusOf(false, 0, null)).toBe('·');
  });

  it('degenerate WINS over the delta tier (⬛), even on a high delta', () => {
    expect(statusOf(true, 0.5, 'black')).toBe('⬛');
    expect(statusOf(false, 0.001, 'blown')).toBe('⬛');   // would be 🔴F without degen
  });

  // ── boundary edges: report uses `> eps` and `> STRONG` (strict >) ──
  it('delta exactly === eps is NOT a render (<= eps): inert when !should, dead when should', () => {
    expect(statusOf(false, EPS, null)).toBe('·');     // EPS is not > EPS
    expect(statusOf(true, EPS, null)).toBe('⚠️D');
  });

  it('delta exactly === STRONG is faint, not strong (STRONG is not > STRONG)', () => {
    expect(statusOf(false, STRONG, null)).toBe('⚠️F');
  });

  it('delta just above STRONG is strong false', () => {
    expect(statusOf(false, STRONG + 1e-9, null)).toBe('🔴F');
  });
});
```

- [ ] **Step 1.2: Run it to verify it fails.**

Run: `cd /home/ax/projects/well-dipper && npx vitest run tests/render-status.test.js`
Expected: FAIL — `Cannot find module '../lab-render-status.js'` (or `statusOf is not a function`).

- [ ] **Step 1.3: Write the minimal implementation.**

Create `lab-render-status.js`:
```js
// lab-render-status.js
// Pure, DOM-free status-mapping for the render-audit surface (Ask 4 of the lab
// menu/info overhaul). The SINGLE source of the tier thresholds + the glyph map,
// imported by BOTH the in-GUI badge (world-engine-lab.html) and the offline report
// generator (scripts/gen-render-audit.mjs) so the live surface and the report can
// never drift apart. No GPU, no DOM — unit-tested headless.

// Tier thresholds, locked to the offline report:
//   eps    = render/inert boundary (frame-fraction; ≈14px of ≈141k, floor is 0)
//   STRONG = false-render above this is "solid", below is "faint trace"
// NOTE: these are applied to the sweep's returned `delta` FRACTION, never to the
// per-pixel `perPixelThresh = 12/255` gate (a different layer).
export const EPS = 1e-4;
export const STRONG = 5e-4;

// statusOf(should, delta, degenerate) -> the offline report's exact glyph string.
//   should:     boolean — does this feature's rendersOn include the current preset?
//   delta:      number  — the sweep's frame-fraction for this feature on this preset
//   degenerate: null | 'black' | 'blown' — the sweep's degenerate flag for the ON frame
//
// ⬛-degenerate-WINS precedence (spec lock #3): a degenerate ON frame makes the delta
// classification meaningless, so the single in-GUI badge shows ⬛ regardless of tier.
// Mirrors gen-render-audit.mjs glyph() for the non-degenerate cases (it uses strict
// `> eps` / `> STRONG`); degenerates are this module's extra slot the report lacks.
export function statusOf(should, delta, degenerate) {
  if (degenerate != null) return '⬛';        // mechanical failure on the ON frame — wins
  const renders = delta > EPS;
  if (should && renders)  return '✅';
  if (should && !renders) return '⚠️D';       // dead-render: declared, inert
  if (!should && renders) return (delta > STRONG ? '🔴F' : '⚠️F');   // strong / faint false-render
  return '·';                                  // correctly inert
}
```

- [ ] **Step 1.4: Run it to verify it passes.**

Run: `cd /home/ax/projects/well-dipper && npx vitest run tests/render-status.test.js`
Expected: PASS — all cases green (6 tiers + 3 boundary cases + the thresholds export = 10 assertions across the `it` blocks).

- [ ] **Step 1.5: Commit.**
```bash
cd /home/ax/projects/well-dipper
git add lab-render-status.js tests/render-status.test.js
git commit -m "feat(lod-lab): pure statusOf + shared EPS/STRONG for render-audit surface (Ask 4)

lab-render-status.js owns the tier thresholds (eps=1e-4, STRONG=5e-4) and the
(should,delta,degenerate)->glyph map that the offline report's glyph() uses,
plus the ⬛-degenerate-wins precedence the single in-GUI badge needs. Unit-tested
across all six tiers + the eps/STRONG boundary edges. Pure/DOM-free; importable
in Vitest and the lab <script>.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: Refactor `gen-render-audit.mjs` to import the shared constants (behavior-preserving)

Delete the generator's local `EPS`/`STRONG` and import them from `lab-render-status.js`. Prove it changed nothing by re-generating `lab-render-audit.md` byte-identical.

**Files:**
- Modify: `scripts/gen-render-audit.mjs` — the import block (~L10-12) and the local constants (~L14-15)

- [ ] **Step 2.1: Replace the local constants with the shared import.**

Re-grep the import + constants: `grep -n "import {.*lab-render-audit\|^const EPS\|^const STRONG" scripts/gen-render-audit.mjs` (~L12, L14-15). Add the new import directly after the existing `lab-render-audit.js` import, then delete the two local `const` lines.

After the existing line:
```js
import { expectedMatrix, auditRenderMatrix } from '../lab-render-audit.js';
```
add:
```js
import { EPS, STRONG } from '../lab-render-status.js';   // shared thresholds — single source of truth (Ask 4)
```
and DELETE these two lines (currently ~L14-15):
```js
const EPS = 1e-4;        // render/inert boundary: ≈14px of 140k; floor is exactly 0 (frozen+deterministic)
const STRONG = 5e-4;     // false-renders above this are "solid", below are "faint trace"
```
**Do NOT change** the `auditRenderMatrix(expected, deltas, { eps: EPS })` call (~L38) — it already passes `eps` explicitly (the footgun is already avoided here); after the refactor `EPS` simply resolves to the imported value. Leave `glyph()` (~L56-64) untouched — it already references `EPS`/`STRONG`, now from the import.

- [ ] **Step 2.2: Re-generate the report and confirm it is byte-identical.**

Run:
```bash
cd /home/ax/projects/well-dipper
node scripts/gen-render-audit.mjs
git diff --exit-code docs/FEATURES/lab-render-audit.md; echo "diff exit=$?"
```
Expected: the generator prints `Wrote docs/FEATURES/lab-render-audit.md`; `git diff --exit-code` exits **0** with no output (the report is byte-identical to the committed version — proving the constants refactor changed nothing). If there IS a diff, the import resolved to a different value than the deleted local `const` — STOP and reconcile (the imported `EPS`/`STRONG` MUST equal `1e-4`/`5e-4`).

- [ ] **Step 2.3: Confirm the auditor's own test stays green.**

Run: `cd /home/ax/projects/well-dipper && npx vitest run tests/render-audit.test.js`
Expected: PASS (the refactor touched only where `gen-render-audit.mjs` sources its constants, not `lab-render-audit.js`).

- [ ] **Step 2.4: Commit.**
```bash
cd /home/ax/projects/well-dipper
git add scripts/gen-render-audit.mjs
git commit -m "refactor(lod-lab): gen-render-audit imports shared EPS/STRONG (Ask 4)

Deletes the generator's local eps/STRONG consts in favor of importing them from
lab-render-status.js, so the offline report and the in-GUI audit surface share
one threshold source. Behavior-preserving: lab-render-audit.md re-generates
byte-identical (git diff --exit-code clean).

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: Lab imports + the audit runner (`state.audit`, the `_auditing` guard)

Import the auditor + `statusOf`, and add `runAudit()` — the function that runs the sweep for the current preset, classifies every feature, and writes `state.audit`. No button/badge yet (Tasks 4-5).

**Files:**
- Modify: `world-engine-lab.html` — imports (~L111-112); a new `runAudit()` defined after `relevantFeatureSet()` (~L7088, so `relevantFeatureSet`/`renderDeltaSweep` are in scope)

- [ ] **Step 3.1: Add the imports.**

Re-grep `grep -n "from './planet-feature-associations.js'" world-engine-lab.html` (~L111). Immediately after the `ASSOCIATIONS` import add:
```js
    import { expectedMatrix, auditRenderMatrix } from './lab-render-audit.js';   // NEW: pure auditor (Ask 4)
    import { statusOf, EPS as AUDIT_EPS } from './lab-render-status.js';          // NEW: glyph map + shared eps (Ask 4)
```
(Alias `EPS` to `AUDIT_EPS` to avoid any clash with a local `eps`/`EPS` symbol; the explicit-eps requirement uses `AUDIT_EPS`.)

- [ ] **Step 3.2: Add the `runAudit()` runner + the `_auditing` flag.**

Re-grep `grep -n "function relevantFeatureSet" world-engine-lab.html` (~L7083); it ends with `return { set, archs }; }` (~L7088). **After** that closing brace add:
```js
    // ── Live render-audit (Ask 4) ─────────────────────────────────────────────
    // Runs the existing in-page sweep for the CURRENT preset, classifies all 47
    // features via the existing pure auditor + statusOf, and stores the result on
    // state.audit. A SECOND in-GUI consumer of renderDeltaSweep() — current-preset
    // only, on demand. Does NOT touch the offline pipeline.
    //
    // _auditing brackets the ENTIRE sweep: the sweep mutates state[*Enabled] ~6×
    // per feature and calls syncDisplays(), which the two global gui.onChange
    // staleness hooks (Task 6) listen on. Without this guard the audit would mark
    // ITSELF stale mid-run. Set before the sweep, cleared in finally (after the
    // sweep's own restore), so any control change DURING the sweep is ignored and
    // any control change AFTER it correctly stales. This is the single load-bearing
    // detail of the staleness mechanism.
    let _auditing = false;
    async function runAudit(){
      const preset = driverUI.preset;
      _auditing = true;
      let sweep;
      try {
        sweep = await renderDeltaSweep();           // { preset, deltas, degenerate } for the CURRENT preset
      } finally {
        _auditing = false;                          // cleared even if the sweep throws
      }
      // expected side: ASSOCIATIONS[f].rendersOn -> should-render-on-this-preset
      const keys = Object.keys(FEATURES);
      const manifest = {};
      for (const f of keys) manifest[f] = { rendersOn: (ASSOCIATIONS[f] && ASSOCIATIONS[f].rendersOn) || [] };
      const expected = expectedMatrix(manifest, [preset]);
      // actual side: wrap the sweep's per-feature fraction into the auditor's shape
      const actualDeltas = {};
      for (const f of keys) actualDeltas[f] = { [preset]: sweep.deltas[f] ?? 0 };
      // auditRenderMatrix is called for parity with the report (its falseRenders/
      // deadRenders sets must agree with statusOf); pass eps EXPLICITLY — the auditor
      // default is 0.01, NOT 1e-4 (footgun). We do not consume its return directly
      // for the badge (statusOf is the per-feature source), but the explicit-eps call
      // keeps the cross-check invariant honest.
      auditRenderMatrix(expected, actualDeltas, { eps: AUDIT_EPS });   // parity call; eps explicit (spec lock #5)
      const results = {};
      for (const f of keys) {
        const should = expected[f][preset];
        const delta = sweep.deltas[f] ?? 0;
        const degenerate = sweep.degenerate[f] ?? null;
        results[f] = { status: statusOf(should, delta, degenerate), delta };
      }
      state.audit = { preset, fresh: true, results };
      return state.audit;
    }
```
**Why the forward references are fine:** `runAudit` is a function declaration (hoisted) and `renderDeltaSweep`/`relevantFeatureSet`/`expectedMatrix`/`statusOf`/`FEATURES`/`ASSOCIATIONS`/`state`/`driverUI` are all defined/imported before any runtime call (the button click in Task 4). `runAudit` is never invoked at definition time.

**Why call `auditRenderMatrix` if `statusOf` produces the badge?** The spec's cross-check invariant requires the in-GUI classification to agree with the offline report cell-for-cell. `statusOf` and the report's `glyph()` share `lab-render-status.js`, and `auditRenderMatrix` (with the explicit `AUDIT_EPS`) is the same auditor the report runs — calling it here on the same eps keeps the two derivations provably aligned and documents the parity at the call site.

- [ ] **Step 3.3: Temporarily expose `runAudit` for verification (removed in Step 3.5).**

Re-grep the `_lab` export object: `grep -n 'window._lab = {' world-engine-lab.html` (~L7813). The object spans several lines and closes with `get sceneTarget(){ return sceneTarget; } };` (~L7826). Add `runAudit(){ return runAudit(); },` inside the object (e.g. right after the existing `renderDeltaSweep(opts){ ... },` line at ~L7820). You will REMOVE this probe line in Step 3.5.

- [ ] **Step 3.4: Verify `runAudit()` produces a well-formed `state.audit` (live).**

Reload `?fresh=1`. Run (`evaluate_script`):
```js
async () => {
  const L = window._lab;
  L.setPreset('Rocky (Earthlike)');
  const audit = await L.runAudit();
  const keys = Object.keys(audit.results);
  // tally the glyph tiers
  const tally = {};
  for (const k of keys) { const s = audit.results[k].status; tally[s] = (tally[s] || 0) + 1; }
  return {
    preset: audit.preset,
    fresh: audit.fresh,
    nFeatures: keys.length,                 // expect 47
    tally,                                  // map of glyph -> count
    sampleHasDelta: typeof audit.results[keys[0]].delta === 'number',
    glyphsValid: keys.every(k => ['✅','🔴F','⚠️F','⚠️D','·','⬛'].includes(audit.results[k].status)),
  };
}
```
Expected: `preset === 'Rocky (Earthlike)'`; `fresh === true`; `nFeatures === 47`; `tally` contains mostly `✅` and `·` (a healthy Rocky world) with whatever residual `🔴F`/`⚠️F`/`⚠️D` the current renderer leaves; `sampleHasDelta === true`; `glyphsValid === true`. The sweep takes a few seconds — the `await` handles it. If `nFeatures !== 47`, the `FEATURES`/`ASSOCIATIONS` join is wrong — STOP and re-check.

- [ ] **Step 3.5: Remove the temporary probe.**

Re-grep `grep -n 'runAudit(){ return runAudit(); }' world-engine-lab.html` and delete that probe line from the `_lab` export. (The runner stays; only the debug export is removed — Task 4 calls it via the button.) Reload `?fresh=1`, confirm no console error: `list_console_messages` shows no new errors.

- [ ] **Step 3.6: Commit.**
```bash
cd /home/ax/projects/well-dipper
git add world-engine-lab.html
git commit -m "feat(lod-lab): live render-audit runner + _auditing guard (Ask 4)

runAudit() runs the existing renderDeltaSweep() for the current preset, builds
the expected matrix from ASSOCIATIONS.rendersOn, classifies all 47 features via
statusOf (eps passed explicitly to auditRenderMatrix — never the 0.01 default),
and stores state.audit = {preset, fresh, results}. The _auditing flag brackets
the whole sweep (set before, cleared in finally) so the sweep's own enable churn
can't self-stale the audit. No button/badge yet. No core/shader change.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: The "Audit this world" button + World summary + "Auditing…" state

Add the button to the World folder, plus a summary line that reads `state.audit`. Wire the button to `runAudit()` with a disabled/"Auditing…" working state.

**Files:**
- Modify: `world-engine-lab.html` — a CSS block (~L94-97); the World-folder controller block (~L7115-7121)

- [ ] **Step 4.1: Add the CSS block.**

Re-grep the existing title-toggle CSS: `grep -n 'title-has-toggle' world-engine-lab.html` (~L94). After the `.lil-gui .title-toggle .lil-widget` rule (~L97), add:
```css
    /* Render-audit surface (Ask 4) — per-feature title-bar glyph + World summary. */
    .lil-gui .audit-badge { margin-left: 6px; font-size: 12px; line-height: 1; user-select: none; }
    .lil-gui .audit-badge.stale { opacity: 0.35; }              /* dimmed when state.audit.fresh === false */
    .lil-gui .audit-summary { font-size: 11px; line-height: 1.4; padding: 4px 8px; margin: 2px 0 4px;
      color: #cfd2d6; }
    .lil-gui .audit-summary.stale { color: #c98a2a; }           /* "stale — re-audit" tint */
    .lil-gui .audit-summary .as-false { color: #d96a6a; }
    .lil-gui .audit-summary .as-dead  { color: #c9a14a; }
```

- [ ] **Step 4.2: Add the "Audit this world" button + summary element after the World controllers.**

Re-grep the World-folder block end: `grep -n "fWorld.add({ clearSolo" world-engine-lab.html` (~L7121). **After** that line add:
```js
    // ── Audit this world (Ask 4) ──────────────────────────────────────────────
    // Runs renderDeltaSweep() for the CURRENT preset, classifies every feature,
    // writes state.audit, then re-renders all badges + this summary. The sweep
    // restores auto-spin/camera/enables itself; the only UI obligation is to
    // disable the button + show "Auditing…" while it runs.
    const auditBtnProxy = { audit(){ runAuditFromButton(); } };
    const auditCtrl = fWorld.add(auditBtnProxy, 'audit').name('Audit this world');
    // Plain-DOM summary line injected directly under the button row.
    const auditSummaryEl = document.createElement('div');
    auditSummaryEl.className = 'audit-summary';
    auditCtrl.domElement.insertAdjacentElement('afterend', auditSummaryEl);

    function renderAuditSummary(){
      const a = state.audit;
      if (!a) { auditSummaryEl.classList.remove('stale'); auditSummaryEl.textContent = 'Audit: (not run)'; return; }
      const stale = !a.fresh || a.preset !== driverUI.preset;   // preset mismatch is stale (spec)
      let nFalse = 0, mDead = 0, dDegen = 0;
      for (const k of Object.keys(a.results)) {
        const s = a.results[k].status;
        if (s === '🔴F' || s === '⚠️F') nFalse++;
        else if (s === '⚠️D') mDead++;
        else if (s === '⬛') dDegen++;
      }
      auditSummaryEl.classList.toggle('stale', stale);
      const freshTag = stale ? '⚠ stale — re-audit' : '✓ fresh';
      auditSummaryEl.innerHTML = `Audit: <span class="as-false">${nFalse} false</span> &middot; `
        + `<span class="as-dead">${mDead} dead</span>`
        + (dDegen ? ` &middot; ${dDegen} degenerate` : '')
        + ` &middot; ${freshTag}`;
    }

    async function runAuditFromButton(){
      auditCtrl.disable();
      const origName = 'Audit this world';
      auditCtrl.name('Auditing…');
      try {
        await runAudit();
      } finally {
        auditCtrl.name(origName);
        auditCtrl.enable();
      }
      renderAllAuditBadges();      // defined in Task 5
      renderAuditSummary();
    }
    renderAuditSummary();          // initial "(not run)"
```
**Note:** `renderAllAuditBadges()` is defined in Task 5 (a function declaration, hoisted) and is only *called* at runtime after a button click — the forward reference is safe. If Task 5 is executed strictly after Task 4, the page still loads (the reference is inside `runAuditFromButton`, not executed at load); but to keep each task's page loadable on its own, **Task 5 must be executed before any live button click verification that exercises badges.** Step 4.4 below verifies only the button + summary (no badge dependency), so Task 4 is independently verifiable.

- [ ] **Step 4.3: Add a temporary no-op `renderAllAuditBadges` so Task 4 loads standalone (removed when Task 5 lands).**

So Task 4 can be verified before Task 5, add a guarded shim **immediately before** `runAuditFromButton` (re-grep its insertion point if needed):
```js
    // TEMP shim (removed in Task 5): no-op until the real badge renderer exists.
    if (typeof renderAllAuditBadges === 'undefined') { var renderAllAuditBadges = function(){}; }
```
**In Task 5 you will DELETE this shim** (the real `function renderAllAuditBadges(){…}` declaration replaces it). If executing Tasks 4 and 5 back-to-back in one session, you may skip this shim and define the real renderer first — but if Task 4 ships alone, the shim prevents a `ReferenceError`.

- [ ] **Step 4.4: Verify the button runs the audit, shows "Auditing…", and updates the summary (live).**

Reload `?fresh=1`. Run (`evaluate_script`):
```js
async () => {
  const L = window._lab;
  L.setPreset('Rocky (Earthlike)');
  // find the button + summary in the World folder
  const findBtn = () => [...document.querySelectorAll('.lil-gui button .lil-name, .lil-gui .lil-name')]
    .map(n => n.closest('.controller')).filter(Boolean)
    .find(c => /Audit this world|Auditing/.test(c.textContent));
  const summary = document.querySelector('.lil-gui .audit-summary');
  const before = summary.textContent;                 // expect "Audit: (not run)"
  // click the button's clickable element
  const btnCtrl = findBtn();
  const clickable = btnCtrl.querySelector('button, .lil-widget') || btnCtrl;
  clickable.click();
  // poll until the summary reflects a completed audit (sweep takes a few seconds)
  const t0 = Date.now();
  while (Date.now() - t0 < 30000) {
    if (/false.*dead.*fresh/.test(summary.textContent)) break;
    await new Promise(r => setTimeout(r, 250));
  }
  return {
    before,
    after: summary.textContent,
    auditOnState: !!(L.state && L.state.audit),
    fresh: L.state.audit && L.state.audit.fresh,
    summaryShowsCounts: /\d+ false .*\d+ dead.*fresh/.test(summary.textContent),
  };
}
```
Expected: `before === 'Audit: (not run)'`; `after` matches `Audit: N false · M dead · ✓ fresh`; `auditOnState === true`; `fresh === true`; `summaryShowsCounts === true`. (`window._lab.state` is exposed at L7813.) If the button never completes, check `list_console_messages` for a sweep error.

- [ ] **Step 4.5: Commit.**
```bash
cd /home/ax/projects/well-dipper
git add world-engine-lab.html
git commit -m "feat(lod-lab): 'Audit this world' button + World summary (Ask 4)

Adds the World-folder button that runs runAudit() with a disabled 'Auditing…'
working state, plus a plain-DOM summary line ('Audit: N false · M dead · ✓ fresh|
⚠ stale') that reads state.audit and treats a preset mismatch as stale. Badge
renderer wired next.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: Per-feature title-bar badge rendering (reads `state.audit`)

Inject a plain-DOM glyph `<span>` into each feature folder's title bar (after the relocated enable toggle) and a `renderAllAuditBadges()` that fills/dims them from `state.audit`.

**Files:**
- Modify: `world-engine-lab.html` — after the enable-relocation loop (~L6944-6946); replace the Task 4.3 shim with the real renderer

- [ ] **Step 5.1: Inject a badge span per feature folder + define `renderAllAuditBadges()`.**

Re-grep the enable-relocation loop: `grep -n "relocateEnableToTitle(folder, FEATURES\[key\].enableKey)" world-engine-lab.html` (~L6945; loop ends ~L6946). **After** that loop closes add:
```js
    // ── Render-audit badges (Ask 4) ───────────────────────────────────────────
    // A plain-DOM glyph on each feature folder's title bar, AFTER the relocated
    // enable toggle (mirrors relocateEnableToTitle's injection). NOT a lil-gui
    // controller, so it never perturbs syncDisplays(), the enable controller, or
    // the reparenting relevance filter. Badge shows on ALL features (relevant or
    // not) — a 🔴F on a force-enabled irrelevant feature is the gate-testing signal.
    const auditBadges = {};   // key -> <span>
    for (const [key, folder] of Object.entries(featureFolders)) {
      const badge = document.createElement('span');
      badge.className = 'audit-badge';
      badge.textContent = '';                 // empty until the first audit
      folder.$title.appendChild(badge);       // after the relocated enable toggle
      auditBadges[key] = badge;
    }
    // Fill every badge from state.audit. Empty when no audit has run; dimmed (.stale)
    // when the audit is not fresh or was computed for a different preset.
    function renderAllAuditBadges(){
      const a = state.audit;
      const stale = a ? (!a.fresh || a.preset !== driverUI.preset) : false;
      for (const key of Object.keys(auditBadges)) {
        const badge = auditBadges[key];
        const r = a && a.results[key];
        badge.textContent = r ? r.status : '';
        badge.classList.toggle('stale', !!r && stale);
      }
    }
```

- [ ] **Step 5.2: Remove the Task 4.3 shim.**

Re-grep `grep -n "TEMP shim (removed in Task 5)\|var renderAllAuditBadges = function" world-engine-lab.html` and DELETE both shim lines. The real `function renderAllAuditBadges(){…}` from Step 5.1 (a hoisted declaration) now satisfies every call site (`runAuditFromButton` in Task 4, the staleness hooks in Task 6). Reload `?fresh=1` and confirm no `renderAllAuditBadges`-related console error: `list_console_messages` clean.

- [ ] **Step 5.3: Verify badges render the correct glyphs after an audit (live, with cross-check).**

Reload `?fresh=1`. Use the known-violation cell recorded in Step 0.3 (or force-enable an irrelevant feature). Run (`evaluate_script`):
```js
async () => {
  const L = window._lab;
  L.setPreset('Rocky (Earthlike)');
  // run the audit via the button path is fine, but call runAudit through a badge-driving click;
  // simplest: drive the sweep + render directly through the public surface used by the button.
  // Click the Audit button:
  const btnCtrl = [...document.querySelectorAll('.lil-gui .controller')]
    .find(c => /Audit this world|Auditing/.test(c.textContent));
  (btnCtrl.querySelector('button, .lil-widget') || btnCtrl).click();
  const summary = document.querySelector('.lil-gui .audit-summary');
  const t0 = Date.now();
  while (Date.now() - t0 < 30000) { if (/fresh|stale/.test(summary.textContent) && /\d+ false/.test(summary.textContent)) break; await new Promise(r => setTimeout(r, 250)); }
  // read badges straight off the DOM and cross-check against state.audit
  const a = L.state.audit;
  const badgeText = {};
  for (const key of Object.keys(L.featureFolders)) {
    const b = L.featureFolders[key].$title.querySelector('.audit-badge');
    badgeText[key] = b ? b.textContent : '(none)';
  }
  // every badge must equal state.audit.results[key].status
  const agree = Object.keys(a.results).every(k => badgeText[k] === a.results[k].status);
  // count summary tiers vs badges
  let nFalse = 0, mDead = 0;
  for (const k of Object.keys(a.results)) { const s = a.results[k].status; if (s==='🔴F'||s==='⚠️F') nFalse++; else if (s==='⚠️D') mDead++; }
  return {
    badgesAgreeWithState: agree,
    summaryText: summary.textContent,
    nFalseFromState: nFalse, mDeadFromState: mDead,
    summaryMatchesCounts: summary.textContent.includes(`${nFalse} false`) && summary.textContent.includes(`${mDead} dead`),
    sampleBadge: badgeText[Object.keys(a.results)[0]],
  };
}
```
Expected: `badgesAgreeWithState === true` (every title-bar glyph equals `state.audit.results[key].status`); `summaryMatchesCounts === true` (the `N false · M dead` summary equals the badge tier counts); glyphs are from the locked set.

- [ ] **Step 5.4: Cross-check the in-GUI classification against the offline report (the anchor invariant).**

Pick a preset that exists in BOTH the live lab and `docs/FEATURES/lab-render-audit.md`. Read the report's column for that preset, then compare a few cells to the live badges. Run (`evaluate_script`) to dump the live glyphs for a named preset:
```js
async () => {
  const L = window._lab;
  L.setPreset('Venus (sulfuric shroud)');     // or any preset with a known report column
  const btnCtrl = [...document.querySelectorAll('.lil-gui .controller')].find(c => /Audit this world|Auditing/.test(c.textContent));
  (btnCtrl.querySelector('button, .lil-widget') || btnCtrl).click();
  const summary = document.querySelector('.lil-gui .audit-summary');
  const t0 = Date.now();
  while (Date.now() - t0 < 30000) { if (/\d+ false/.test(summary.textContent)) break; await new Promise(r => setTimeout(r, 250)); }
  const a = L.state.audit;
  // return the per-feature glyphs sorted by key for eyeball-comparison to the report
  return Object.fromEntries(Object.keys(a.results).sort().map(k => [k, a.results[k].status]));
}
```
Then read the report column:
```bash
cd /home/ax/projects/well-dipper
grep -n "Venus" docs/FEATURES/lab-render-audit.md | head
sed -n '<matrix-header-line>,<matrix-end-line>p' docs/FEATURES/lab-render-audit.md   # the preset×feature table
```
Expected: for the Venus column, the report's glyph for each feature (`✅`/`🔴F`/`⚠️F`/`⚠️D`/`·`) **matches the live badge** for that feature — EXCEPT where the live badge is `⬛` (degenerate-wins divergence: the report side-channels degenerates and still prints the delta glyph, so a `⬛` live badge legitimately corresponds to a report cell that shows the delta glyph + a degenerate punch-list entry). Spot-check at least 3 non-degenerate cells agree exactly. If a non-degenerate cell disagrees, the eps is wrong (confirm `AUDIT_EPS === 1e-4` reaches `statusOf` and `auditRenderMatrix`) — STOP and reconcile. **This is the load-bearing cross-check.**

- [ ] **Step 5.5: Verify a force-enabled irrelevant feature shows its 🔴F badge.**

Reload `?fresh=1`. Run (`evaluate_script`):
```js
async () => {
  const L = window._lab;
  L.setPreset('Gas giant (Jovian)');           // a giant; surface features are irrelevant here
  // force-enable a surface feature that does NOT belong (e.g. mountains)
  L.state.mountainsEnabled = true;             // direct state flip; the sweep's ON set includes it
  const btnCtrl = [...document.querySelectorAll('.lil-gui .controller')].find(c => /Audit this world|Auditing/.test(c.textContent));
  (btnCtrl.querySelector('button, .lil-widget') || btnCtrl).click();
  const summary = document.querySelector('.lil-gui .audit-summary');
  const t0 = Date.now();
  while (Date.now() - t0 < 30000) { if (/\d+ false/.test(summary.textContent)) break; await new Promise(r => setTimeout(r, 250)); }
  const mtnBadge = L.featureFolders.mountains.$title.querySelector('.audit-badge').textContent;
  return { mountainsBadge: mtnBadge, mountainsStatus: L.state.audit.results.mountains.status };
}
```
Expected: `mountainsBadge` is `🔴F` or `⚠️F` (a false-render — "this feature paints a world it has no business on"), matching `mountainsStatus`. (If `mountains` is hidden under the gas-giant atmosphere it may read `·`/`⚠️F`; the key assertion is the badge equals the state and the surface works for irrelevant features. Pick a different surface feature if `mountains` is fully occluded — the report from Step 0.3 names a reliable false-render.)

- [ ] **Step 5.6: Screenshot for the record** (`take_screenshot`): a feature folder title bar showing the enable toggle + the audit glyph badge, with the World summary visible.

- [ ] **Step 5.7: Commit.**
```bash
cd /home/ax/projects/well-dipper
git add world-engine-lab.html
git commit -m "feat(lod-lab): per-feature title-bar audit badges (Ask 4)

Each feature folder gets a plain-DOM glyph badge (after the relocated enable
toggle) that renders state.audit.results[key].status — ✅/🔴F/⚠️F/⚠️D/·/⬛ — on
ALL features (a 🔴F on a force-enabled irrelevant feature is the gate signal).
renderAllAuditBadges() fills + dims them; cross-checked cell-for-cell against the
offline lab-render-audit.md report. No core/shader change.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: Staleness wiring — two global `gui.onChange` hooks + the `_auditing` guard

Register one `onChange` per top-level GUI; each stales the audit on any user control change, early-returning while `_auditing` is set. Re-render badges + summary on stale.

**Files:**
- Modify: `world-engine-lab.html` — after both GUIs and `state.audit`/`renderAll*` exist (place the hooks near the end of GUI build, after the World-folder block — re-grep for a safe insertion point after `renderAuditSummary();` from Task 4)

- [ ] **Step 6.1: Add a `staleAudit()` helper + the two global hooks.**

Re-grep a safe insertion point after the audit button block and the badge renderer are both defined: `grep -n "renderAuditSummary();" world-engine-lab.html` (the initial call at the end of Task 4's block, ~after L7121+). **After** that line add:
```js
    // ── Auto-stale on any control change (Ask 4) ──────────────────────────────
    // lil-gui bubbles EVERY controller change to the parent GUI's onChange, so two
    // top-level hooks (guiLeft + guiRight) cover all ~47 toggles + every slider with
    // no per-controller wiring. Conservative: ANY change stales (spec lock #4 — the
    // view/camera-knob exemption is deferred/YAGNI). The _auditing guard early-returns
    // while the audit's own sweep is mutating enables, so the audit can't self-stale.
    function staleAudit(){
      if (_auditing) return;                 // the sweep's own churn — ignore (LOAD-BEARING)
      if (!state.audit) return;              // nothing to stale yet
      if (state.audit.fresh) {               // only act on the fresh->stale transition
        state.audit.fresh = false;
        renderAllAuditBadges();              // dim badges
        renderAuditSummary();                // "⚠ stale — re-audit"
      }
    }
    guiLeft.onChange(staleAudit);
    guiRight.onChange(staleAudit);
```
**Why guard with `if (_auditing) return` FIRST:** the sweep flips `state[*Enabled]` ~6× per feature and calls `syncDisplays()` — every one of those bubbles to `staleAudit`. Without the early return the audit would mark itself stale dozens of times mid-run, leaving a perpetually-stale badge. The guard is the single load-bearing detail of the staleness mechanism. `_auditing` is set in `runAudit()` (Task 3) before the sweep and cleared in its `finally`, so the bracket is exact.

**Preset change also stales correctly:** changing the preset fires `guiLeft.onChange` (the preset picker is a `guiLeft` controller) → `staleAudit()` flips `fresh = false`. AND `renderAuditSummary()`/`renderAllAuditBadges()` independently treat `a.preset !== driverUI.preset` as stale, so even before the next render the surface never shows glyphs computed for a different world.

- [ ] **Step 6.2: Verify the `_auditing` guard — the audit does NOT self-stale (the self-trigger trap).**

Reload `?fresh=1`. Run (`evaluate_script`):
```js
async () => {
  const L = window._lab;
  L.setPreset('Rocky (Earthlike)');
  const btnCtrl = [...document.querySelectorAll('.lil-gui .controller')].find(c => /Audit this world|Auditing/.test(c.textContent));
  (btnCtrl.querySelector('button, .lil-widget') || btnCtrl).click();
  const summary = document.querySelector('.lil-gui .audit-summary');
  const t0 = Date.now();
  while (Date.now() - t0 < 30000) { if (/\d+ false/.test(summary.textContent)) break; await new Promise(r => setTimeout(r, 250)); }
  // immediately after the audit completes — NO operator edit in between:
  return {
    freshImmediatelyAfter: L.state.audit.fresh,            // MUST be true
    summarySaysFresh: /✓ fresh/.test(summary.textContent), // MUST be true
  };
}
```
Expected: `freshImmediatelyAfter === true` AND `summarySaysFresh === true`. **If `false`, the `_auditing` guard is not bracketing the sweep** — the audit self-staled via the sweep's own enable churn. STOP and fix (verify `_auditing = true` is set before `await renderDeltaSweep()` and cleared only in the `finally`).

- [ ] **Step 6.3: Verify a real user edit AFTER the audit stales it.**

Reload `?fresh=1`. Run (`evaluate_script`):
```js
async () => {
  const L = window._lab;
  L.setPreset('Rocky (Earthlike)');
  const btnCtrl = [...document.querySelectorAll('.lil-gui .controller')].find(c => /Audit this world|Auditing/.test(c.textContent));
  (btnCtrl.querySelector('button, .lil-widget') || btnCtrl).click();
  const summary = document.querySelector('.lil-gui .audit-summary');
  const t0 = Date.now();
  while (Date.now() - t0 < 30000) { if (/\d+ false/.test(summary.textContent)) break; await new Promise(r => setTimeout(r, 250)); }
  const freshBefore = L.state.audit.fresh;                  // true
  // simulate a user edit: toggle a feature's enable via its title checkbox (fires onChange)
  const enableCtrl = L.featureFolders.mountains.$title.querySelector('input[type="checkbox"]');
  enableCtrl.click();                                       // user edit
  const freshAfter = L.state.audit.fresh;                   // MUST be false
  const aBadge = L.featureFolders.mountains.$title.querySelector('.audit-badge');
  const badgeDimmed = aBadge.classList.contains('stale');
  const summaryStale = /stale/.test(summary.textContent);
  enableCtrl.click();                                       // restore (also stays stale)
  return { freshBefore, freshAfter, badgeDimmed, summaryStale };
}
```
Expected: `freshBefore === true`; `freshAfter === false`; `badgeDimmed === true` (badges dim via `.stale`); `summaryStale === true` ("⚠ stale — re-audit"). Re-clicking "Audit this world" must restore `fresh === true` + full-opacity badges (covered in Step 7.2's consolidated pass).

- [ ] **Step 6.4: Verify preset change stales (no glyphs for the wrong world).**

Reload `?fresh=1`. Run (`evaluate_script`):
```js
async () => {
  const L = window._lab;
  L.setPreset('Rocky (Earthlike)');
  const btnCtrl = [...document.querySelectorAll('.lil-gui .controller')].find(c => /Audit this world|Auditing/.test(c.textContent));
  (btnCtrl.querySelector('button, .lil-widget') || btnCtrl).click();
  const summary = document.querySelector('.lil-gui .audit-summary');
  const t0 = Date.now();
  while (Date.now() - t0 < 30000) { if (/\d+ false/.test(summary.textContent)) break; await new Promise(r => setTimeout(r, 250)); }
  const auditedPreset = L.state.audit.preset;                // 'Rocky (Earthlike)'
  L.setPreset('Gas giant (Jovian)');                         // switch worlds
  return {
    auditedPreset,
    nowPreset: L.driverUI.preset,
    presetMismatchStale: /stale/.test(summary.textContent),  // summary reads stale (preset mismatch)
    storedPresetUnchanged: L.state.audit.preset === auditedPreset,  // stored audit still for Rocky
  };
}
```
Expected: `auditedPreset === 'Rocky (Earthlike)'`; `nowPreset === 'Gas giant (Jovian)'`; `presetMismatchStale === true`; `storedPresetUnchanged === true` (the surface never renders the Rocky glyphs as if they were the Gas-giant world's — both the `fresh` flip from `onChange` and the `preset !== driverUI.preset` guard cover this).

- [ ] **Step 6.5: Commit.**
```bash
cd /home/ax/projects/well-dipper
git add world-engine-lab.html
git commit -m "feat(lod-lab): auto-stale-on-edit via guarded global gui.onChange (Ask 4)

Two top-level hooks (guiLeft + guiRight) stale state.audit on ANY user control
change (conservative — view/camera exemption deferred), dimming badges + flipping
the summary to '⚠ stale — re-audit'. Both early-return while _auditing is set so
the sweep's own ~6×/feature enable churn can't self-stale the just-finished audit.
Preset mismatch also reads stale (no glyphs for the wrong world). No core change.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 7: Verification + close-out

- [ ] **Step 7.1: Full unit-test run — new + existing suites green.**

Run: `cd /home/ax/projects/well-dipper && npx vitest run`
Expected: all green, including:
- `tests/render-status.test.js` — the new `statusOf` pin (Task 1).
- `tests/render-audit.test.js` — the auditor, unchanged (the constants refactor moved only where `gen-render-audit.mjs` sources them).
- `tests/planet-archetypes.test.js` — the `\.add\(state, '(\w+Enabled)'\)` scan + `cityLights → PROV_CITYLIGHTS` pin (we added no `.add(state,…Enabled)` and removed none; the badge is plain DOM).
- `tests/feature-associations.test.js` + the Stage-D GLSL drift-guard — untouched.
If any previously-green suite is now red, STOP and diagnose — the GUI change is additive and the constants refactor is behavior-preserving, so a red existing suite means an unintended edit.

- [ ] **Step 7.2: Final consolidated live acceptance pass (`:9223`) against the spec's Verification list.**

Reload `?fresh=1`. Run (`evaluate_script`) — combines the spec's acceptance checks proven per-task into one sweep:
```js
async () => {
  const L = window._lab;
  const out = {};
  const summary = document.querySelector('.lil-gui .audit-summary');
  const clickAudit = () => { const c = [...document.querySelectorAll('.lil-gui .controller')].find(x => /Audit this world|Auditing/.test(x.textContent)); (c.querySelector('button, .lil-widget') || c).click(); };
  const waitDone = async () => { const t0 = Date.now(); while (Date.now()-t0 < 30000) { if (/\d+ false/.test(summary.textContent)) break; await new Promise(r=>setTimeout(r,250)); } };

  L.setPreset('Rocky (Earthlike)');
  clickAudit(); await waitDone();
  out.freshAfterAudit = L.state.audit.fresh === true;                 // _auditing guard works
  out.badgesAgree = Object.keys(L.state.audit.results).every(k =>
    L.featureFolders[k].$title.querySelector('.audit-badge').textContent === L.state.audit.results[k].status);
  out.summaryHasCounts = /\d+ false .*\d+ dead.*✓ fresh/.test(summary.textContent);

  // edit -> stale
  const cb = L.featureFolders.mountains.$title.querySelector('input[type="checkbox"]');
  cb.click();
  out.staleAfterEdit = L.state.audit.fresh === false && /stale/.test(summary.textContent);
  cb.click();   // restore enable (still stale)

  // re-audit -> fresh
  clickAudit(); await waitDone();
  out.freshAfterReaudit = L.state.audit.fresh === true && /✓ fresh/.test(summary.textContent);

  // preset switch -> stale/cleared
  clickAudit(); await waitDone();
  const auditedPreset = L.state.audit.preset;
  L.setPreset('Gas giant (Jovian)');
  out.presetSwitchStale = /stale/.test(summary.textContent) && L.state.audit.preset === auditedPreset;

  // auto-spin + camera restored after a sweep (sweep restores _sweepFreeze + yaw)
  const yawBefore = L.state.yaw;
  await new Promise(r => setTimeout(r, 400));    // let a few frames advance
  out.autoSpinResumed = L.state.yaw !== yawBefore;   // planet is spinning again
  return out;
}
```
Expected: every field `true`:
- `freshAfterAudit` — the `_auditing` guard prevents self-stale.
- `badgesAgree` — every title-bar glyph equals `state.audit.results[key].status`.
- `summaryHasCounts` — `Audit: N false · M dead · ✓ fresh`.
- `staleAfterEdit` — a slider/toggle edit dims badges + flips the summary.
- `freshAfterReaudit` — re-running restores fresh + full opacity.
- `presetSwitchStale` — preset change reads stale, no glyphs for the wrong world.
- `autoSpinResumed` — the sweep restored auto-spin (and camera/clock).

- [ ] **Step 7.3: Confirm `lab-render-audit.md` is still byte-identical (no accidental regen drift).**

Run: `cd /home/ax/projects/well-dipper && git diff --exit-code docs/FEATURES/lab-render-audit.md; echo "exit=$?"`
Expected: exit 0, no diff (Task 2 left it byte-identical and nothing since touched it). If there's a diff, a stray `node scripts/gen-render-audit.mjs` run wrote a changed report — `git checkout docs/FEATURES/lab-render-audit.md` to restore (it must NOT be part of this Ask's commits).

- [ ] **Step 7.4: Update `docs/NOW.md`.**

Re-grep the active menu-overhaul block: `grep -n "menu.*overhaul\|info-layer\|Ask 2\|Ask 3\|Ask 4\|render-audit\|SESSION 2026-06-15" docs/NOW.md`. Update the menu-overhaul entry to note Ask 4 (live render-audit surfacing) landed `VERIFIED_PENDING_MAX <sha>` (use the Task 6 commit SHA — the last user-visible deliverable). Keep to the existing block's format/brevity. Per the charter (`docs/FEATURES/planet-lod-CHARTER.md`) and [[well-dipper-lod-terrain-campaign]], this is lab **tooling** (lab≠game) — note that framing if the block records it; no Max-UAT gate is required for lab tooling (unlike Thread B's render change), but the live `:9223` verification above is mandatory and done.

- [ ] **Step 7.5: Commit the NOW.md update.**
```bash
cd /home/ax/projects/well-dipper
git add docs/NOW.md
git commit -m "docs(now): lod-lab live render-audit surfacing (Ask 4) verified-pending-Max

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Self-Review (run by plan author)

**1. Spec coverage** (every spec section → a task):
- "Freshness = LIVE ON-DEMAND; 'Audit this world' button in World folder; current preset only; state.audit = {preset, fresh, results}" → **Task 3** (`runAudit` → `state.audit`) + **Task 4** (button). ✔
- "'Auditing…' working state; disable button while running; re-enable after; sweep restores spin/camera/enables itself" → **Task 4** (`runAuditFromButton` disables + renames + re-enables in `finally`); verified spin restored (Step 7.2). ✔
- "Classification reuses expectedMatrix/auditRenderMatrix; manifest from ASSOCIATIONS.rendersOn; actualDeltas from sweep; eps passed EXPLICITLY" → **Task 3** (`AUDIT_EPS` passed to `auditRenderMatrix`; manifest built from `ASSOCIATIONS[f].rendersOn`). ✔
- "STATUS vocabulary = the report's EXACT glyphs incl. 🔴F's F suffix; ⬛ for degenerate" → **Task 1** (`statusOf` returns exact strings; test pins `🔴F`). ✔
- "Thresholds eps=1e-4/STRONG=5e-4 as named exports; BOTH consumers import from lab-render-status.js; gen-render-audit deletes its local consts" → **Task 1** (exports) + **Task 2** (refactor). ✔
- "Degenerate ⬛ WINS over the delta tier" → **Task 1** (`statusOf` short-circuits on `degenerate != null`; test asserts ⬛ on high delta). ✔
- "Badges on each feature folder title bar, after the relocated enable toggle; plain DOM not lil-gui; on ALL features incl. force-enabled irrelevant" → **Task 5** (`auditBadges` span on `folder.$title`; Step 5.5 force-enabled irrelevant). ✔
- "World summary 'Audit: N false · M dead · ✓ fresh|⚠ stale'; (not run) before first audit; optional degenerate count" → **Task 4** (`renderAuditSummary`, including `(not run)` + optional `· D degenerate`). ✔
- "Staleness = AUTO-STALE-ON-EDIT; any control change → fresh=false, badges dim, summary stale; re-audit restores" → **Task 6** (`staleAudit`) + Step 6.3 + Step 7.2. ✔
- "Detection hook = one guiLeft.onChange + one guiRight.onChange, guarded by _auditing" → **Task 6** (two hooks) + **Task 3** (`_auditing` set/cleared). ✔
- "_auditing guard prevents self-stale (the self-trigger trap)" → **Task 3** (`finally`-cleared flag) + **Task 6** (early-return) + explicit verification Step 6.2 + Step 7.2 `freshAfterAudit`. ✔
- "Conservative staling: ANY change stales; view/camera exemption deferred/YAGNI" → **Task 6** (no exemption logic; comment notes deferral). ✔
- "Preset-mismatch staleness — never render glyphs for the wrong world" → **Task 4/5/6** (`a.preset !== driverUI.preset` checks in summary + badge renderers; `onChange` flips fresh) + Step 6.4 + Step 7.2 `presetSwitchStale`. ✔
- "Pure statusOf seam + unit test covering all six tiers + eps/STRONG boundaries" → **Task 1** (`statusOf` + the boundary cases). ✔
- "Asks 2/3 integration points named, NOT hard-dependended; Ask 4 ships independently" → build-ordering note + no Ask 2/3 code in plan. ✔
- "Cross-check invariant: in-GUI classification agrees with offline report cell-for-cell" → AC + verification Step 5.4 (the load-bearing cross-check) + the ⬛-divergence caveat. ✔
- "Verification: live :9223 NOT Playwright; ?fresh=1; window._lab + evaluate_script not image recognition; byte-identical report re-gen; existing suites green; explicit-path commits; no Max-UAT gate but live verify mandatory" → Tasks 1-7; explicit paths in every `git add`. ✔
- "Out of scope: full 17-preset regen, auto-audit on preset/load, Ask 2/3 surfaces, Thread B" → none built. ✔

**2. Placeholder scan:** No TBD/TODO/"handle edge cases". Every code step shows complete code. The "re-grep before editing" notes are deliberate line-drift caution (the implementer reads the actual file), not placeholders. The two `sed -n '<line>,<line>p'` in Step 5.4 are deliberate (the implementer fills the matrix line range after the preceding `grep` locates it) — that's reading, not authoring. ✔

**3. Type/name consistency:** `statusOf`, `EPS`/`STRONG` (module) / `AUDIT_EPS` (lab alias), `runAudit`, `_auditing`, `state.audit = {preset, fresh, results}`, `results[key] = {status, delta}`, `runAuditFromButton`, `auditCtrl`, `auditSummaryEl`, `renderAuditSummary`, `auditBadges`, `renderAllAuditBadges`, `staleAudit` used consistently across Tasks 1-7. `statusOf(should, delta, degenerate)` signature matches its call in `runAudit` (Task 3). `renderAllAuditBadges` is forward-referenced in Task 4 (shim in 4.3, real declaration in 5.1, shim deleted in 5.2) — handled explicitly. The badge class is `.audit-badge` (distinct from Asks 2/3's `.title-info`). No `.add(state, 'xEnabled')` line touched (archetypes test stays green). ✔

**4. Verified-against-source facts baked in:** `renderDeltaSweep()` returns `{preset, deltas, degenerate}` (L7079) and is exposed on `_lab` (L7820); `relevantFeatureSet`/`applyArchetypeFilter`/`relocateEnableToTitle`/`fWorld`(on `guiLeft`)/`guiLeft`/`guiRight`/`window._lab`(exposes `state`) at the cited HINT lines; `auditRenderMatrix` default `eps = 0.01` (the footgun) confirmed `lab-render-audit.js:22`; `gen-render-audit.mjs` local `EPS`/`STRONG` at L14-15, `glyph()` L56-64, `{ eps: EPS }` at L38; `lab-render-audit.md` clean in git (byte-identical check meaningful); `FEATURES`≡`ASSOCIATIONS` 47 keys. ✔

---

## Execution Handoff

**Plan complete and saved to `docs/superpowers/plans/2026-06-15-lod-lab-render-audit-surfacing.md`. Two execution options:**

**1. Subagent-Driven (recommended)** — dispatch a fresh subagent per task, review between tasks, fast iteration. REQUIRED SUB-SKILL: superpowers:subagent-driven-development.

**2. Inline Execution** — execute tasks in this session via superpowers:executing-plans, batch execution with checkpoints. REQUIRED SUB-SKILL: superpowers:executing-plans.

**Which approach?**
