# LOD Lab Exotic-Archetype Render Gate — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop two false-renders in `planet-lod-lab.html` — force-enabled `shatter`/`hexTess` painting non-member worlds, and `mountains` rendering on Carbon/Crystal — via a per-feature relevance hard-gate and a targeted exotic-crust knockdown, plus a doc-only ACCEPT for faint Ocean/Europa craters. Zero core/shader changes; byte-identical on every member world.

**Architecture:** Two new `state` signals computed once per preset/quality change in `applyDrivers()` (mirroring the existing `habGate` precedent), consumed by three one-line `×=` multiplies in the per-frame uniform writers. (A) `state.featureRelevant` (a `{shatter, hexTess}` map of `1.0`/`0.0` floats, derived from `ASSOCIATIONS[key].rendersOn.includes(driverUI.preset)` so it honors hexTess's `rendersOnDivergent` Frozen membership) hard-gates shatter+hexTess. (B) `state.isExoticCarbonOrGeometric` (a `1.0`/`0.0` float keyed on Carbon/Crystal archetype membership) knocks mountains to zero on those two presets only — leaving icy-world mountains soft-scaled-and-previewable. `carbon`/`facets` are already honest and are NOT touched.

**Tech Stack:** Inline `<script>` in `planet-lod-lab.html` (NOT importable by Vitest); GLSL shader file `planet-lod-lab-core.js` is **untouched**; verification is **live on GPU Chrome `:9223`** via chrome-devtools MCP (`evaluate_script` + `window._lab.*`, NOT Playwright, NOT image recognition) plus a render-audit Δ re-run (`window._lab.renderDeltaSweep()` → `node scripts/gen-render-audit.mjs`); Vitest only to confirm existing suites stay green.

**Spec:** `docs/superpowers/specs/2026-06-15-lod-lab-exotic-archetype-gate-design.md` (approved, committed `e339b9f`)

**Sibling plans (format reference):** `docs/superpowers/plans/2026-06-15-lod-lab-archetype-info-view.md` (Ask 3) and `…-feature-info-cards.md` (Ask 2). **This plan differs from those in kind:** Asks 2/3 are GUI-chrome-only (no rendering change → no render-audit, live checks are DOM-only). **This is Thread B — it changes REAL planet rendering**, so its verification is heavier: a render-audit Δ re-run **plus** live `:9223` uniform-read checks **plus Max's UAT**. It is also *smaller in code* — a handful of `×=` edits in one file, no generator, no new unit test (the gate is runtime; there is nothing offline to unit-test).

---

## Why this is Thread B, not an Ask (read before starting)

The menu/info overhaul (Asks 2/3/4) is lab *tooling* — it does not change a single rendered pixel, so those plans have no render-audit step and verify GUI structure only. **Thread B is the sibling thread: render-correctness residuals.** It edits the per-frame writers that drive the shader, so a regression here is a *visible planet-rendering* regression. That is why this plan carries:

- a **render-audit Δ re-run** (objective machine check: did the targeted false-renders clear, with no new regressions on member worlds?),
- **live `:9223` GPU checks** (objective integration: force-enable on a wrong world reads `uShatStrength === 0`, etc.), and
- **Max UAT as his gate alone** (he rides the lab across presets — never agent-closeable).

Per the LOD charter (lab≠game by design) this is a *lab* render-correctness fix, not a game feature. It carries forward from the relief-triage Bucket-A/B work (`be989f4` / `5ef6ca9`); source-of-truth verdicts are `docs/FEATURES/relief-triage-verdicts-2026-06-15.md`.

---

## The byte-identical contract (the load-bearing acceptance criterion)

These F4x writers advertise "byte-identical pre-F4x output when the gate is 0." This plan extends that contract to the **gate-is-1** side:

> **Where a feature IS relevant (member world), the new multiply must be by exactly `1.0`, and NO existing clamp or expression may be reordered.**

Consequence, and the central machine-checkable acceptance criterion: the render-audit Δ must show **NO change** on Crystal / Frozen / Carbon / the icy member worlds. **ONLY** these disappear:
1. the force-enable false-renders of `shatter`/`hexTess` on non-member worlds, and
2. `mountains` on Carbon (Δ 0.0007) and Crystal (Δ 0.0017).

If the Δ shows *any* member-world change, the multiply was not byte-identical-when-1 (or a clamp was reordered) — STOP and fix before continuing. This contract is verified in Task 5.

---

## Standing cautions

- **Line numbers are HINTS** — `grep -n` every edit site before editing (line drift in `planet-lod-lab.html` is a known hazard). The sites below were VERIFIED at authoring time; re-grep anyway: `habGate`, `applyDrivers`, `relevantFeatureSet`, `uShatStrength`, `uHexStrength`, `uMountainAmp`, `ARCHETYPES`, `ASSOCIATIONS`, `state.mountainAmp`, `renderDeltaSweep`.
- **Stage EXPLICIT paths only. NEVER `git add -A`.** The working tree has loose litter including a file literally named `HEAD` (verified: 0-byte `-r--r--r-- HEAD` in repo root), plus warp WIP and loose `.png`/`.webm`/`.html`. `git add -A` would stage all of it.
- **Do NOT run `git show HEAD`** — it collides with the loose `HEAD` file. Use `git log`, `git rev-parse HEAD`, or `git show <sha>` with an explicit sha instead.
- **Branch is `master`** (verified). Commit on `master` per the project's normal flow; the campaign tracks on `master`.
- **Verification is GPU Chrome `:9223`, NOT Playwright** (per `well-dipper-testing-reference.md` — the lab needs the GPU path; Playwright is CPU and will not render the shader correctly). Reload `127.0.0.1:5173/well-dipper/planet-lod-lab.html?fresh=1` before EACH live check (`?fresh=1` opts out of the sessionStorage scenario-restore; use `127.0.0.1`, not `localhost`, per `chrome-devtools-screenshot-scaling.md`).
- **Do NOT start a dev server** (`npm run dev` etc.) — assume it is already running on `:5173`; if `:9223` has no page, ask Max to open the lab (per `feedback_no-start-servers.md` + `feedback_specify-user-interactions.md`).
- End every commit message with: `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`

---

## Decisions locked by spec + source inspection (do NOT re-litigate)

These were resolved in the approved spec and re-confirmed against the live source. Honor every one:

1. **Three residuals, two fixes + one ACCEPT.** (#1) shatter/hexTess force-enable leak → per-feature relevance hard-gate. (#2) mountains on Carbon/Crystal → targeted exotic-crust knockdown. (#3) faint craters on Ocean/Europa → ACCEPT, doc-only, NO code. (Spec §"The three residuals".)

2. **The relevance signal is `ASSOCIATIONS[key].rendersOn.includes(driverUI.preset)`, NOT the raw `relevantFeatureSet().set`.** VERIFIED in source (spec finding #5): the raw set is built from archetype↔preset mapping and is **blind to `rendersOnDivergent`**. On `Frozen (airless)` it contains `shatter` (via `exotic-shattered`) but does **NOT** contain `hexTess` (whose only archetype `exotic-geometric` maps to Crystal, not Frozen). Gating hexTess by the raw set would **kill it on Frozen** — the opposite of intent. The manifest `rendersOn` *is* the effective render membership (it lists `Frozen (airless)` for hexTess), so it is the correct signal. (Spec §D2 — this is the spec's one code↔intent reconciliation. Confirmed in source: `hexTess.rendersOn = ['Frozen (airless)']` + `rendersOnDivergent: true` at `planet-feature-associations.js:387-396`.)

3. **mountains is a TARGETED knockdown, NOT a relevance gate.** Multiply by `(1.0 − state.isExoticCarbonOrGeometric)` → hard-zero ONLY on Carbon/Crystal (silicate orogeny is categorically wrong there; relief is owned by carbon-crust F42 / facets F43). On icy worlds (Europa/Titan/Frozen) mountains MUST stay `rockyCrust`-soft-scaled AND force-enable-previewable — Max wants that workflow intact. The asymmetry is deliberate. (Spec §"mountains is a TARGETED knockdown".)

4. **The hard gate overrides force-enable for shatter/hexTess (Max approved).** Force-enabling `shatter` on Rocky shows NOTHING. The "force-enable-to-preview-on-a-wrong-world" workflow **no longer applies to shatter/hexTess** (it still applies to the `rockyCrust`-soft-gated relief family incl. icy mountains). (Spec §"Hard gate — overrides force-enable".)

5. **carbon (F42) and facets (F43) are already honest — DO NOT TOUCH.** Both self-zero off their preset via driven derivations (`uCarbonStrength` clamps to 0 off Carbon; `uFacetStrength` is 0 off the crystal class). Force-enabling them elsewhere already renders nothing. The first-draft spec wrongly proposed gating them; this is the chief correction. (Spec §"carbon and facets are already honest".)

6. **NO manifest edit.** `mountains`/`shatter`/`hexTess`/`carbon`/`facets` `rendersOn` are all already correct; `rendersOnDivergent: true` on hexTess STAYS. This is a no-op verification, not an edit. (Spec §"Manifest — verify-only".)

7. **NO core/shader edit.** Every affected feature has a lab-side per-frame writer to multiply; `planet-lod-lab-core.js` stays untouched. If an edit site turns out NOT to be reachable lab-side after re-grep (it should be — all three are clean `? :` writers), that becomes a flagged core change — raise with Max, do NOT bake it silently. (Spec §finding #2.)

8. **Floats, not booleans, to match the `habGate` idiom.** Store `1.0`/`0.0` so the multiply is uniform with the existing `× state.habGate` writers. (Spec §"Deriving the per-feature relevance signal".)

**Source facts confirmed (line numbers are HINTS):**
- `habGate` computed in `applyDrivers()` at `:5524` (right after `state.habitability` set `:5520`), seeded `:4950`. Consumed by overlay writers via `× state.habGate` (`:7331`, `:7548`, `:7558`, `:7565`).
- `applyDrivers()` defined `:5514`; `state.mountainAmp = u.mountainAmp` set `:5560`.
- Writers (all clean `? value : 0.0`, so all clean `×=` sites): `uShatStrength` `:7536`, `uHexStrength` `:7527`, `uMountainAmp` `:7617`, `uCarbonStrength` `:7507` (DO NOT TOUCH), `uFacetStrength` `:7518` (DO NOT TOUCH).
- `ASSOCIATIONS` imported `:111`; `ARCHETYPES` imported `:110`; `relevantFeatureSet()` defined `:7083` (returns `{set, archs}`, hoisted, callable from `applyDrivers`).
- Exotic archetype keys/presets `planet-archetypes.js:164-166`: `exotic-carbon`→`Carbon (high C/O)`, `exotic-geometric`→`Crystal (faceted)`, `exotic-shattered`→`Frozen (airless)`.
- `renderDeltaSweep()` defined `:7045`, exposed on `_lab` `:7820`; `scripts/gen-render-audit.mjs` exists; `docs/FEATURES/lab-render-audit.md` exists (current: **64 false / 51 dead** at `248b355`).
- Tests: `tests/feature-associations.test.js` has the `rendersOn ⊆ archetype-union` check with divergent-exemption (`:129-149`); `tests/planet-archetypes.test.js` has the PROVINCES↔GLSL drift guard + the `cityLightsEnabled` pin.

---

## File Structure

| File | Responsibility | Action |
|---|---|---|
| `planet-lod-lab.html` | Add `state.featureRelevant` + `state.isExoticCarbonOrGeometric` derivation in `applyDrivers()` (next to `habGate`) + seed safe defaults next to `habGate`'s seed; multiply the three writers (`uShatStrength`, `uHexStrength`, `uMountainAmp`). | **Modify** (inline `<script>` only; NO core/shader, NO new function) |
| `docs/FEATURES/relief-triage-verdicts-2026-06-15.md` | Record the ACCEPT decision for faint Ocean/Europa craters (#3), citing Max's 2026-06-15 call. | **Modify** (doc only) |
| `docs/FEATURES/lab-render-audit.md` | Regenerated by `node scripts/gen-render-audit.mjs` after the render-audit Δ re-run (Task 5). | **Modify** (generated) |
| `docs/NOW.md` | Close-out: note Thread B landed `VERIFIED_PENDING_MAX <sha>`. | **Modify** |

No new files. No generator, no generated module, no new unit test, no `package.json` change — the gate is computed at runtime and has nothing offline to test.

---

## Pre-flight (once, before Task 1)

- [ ] **Step 0.1: Confirm the dev server + lab are reachable on `:9223`.**

Run (chrome-devtools MCP): `list_pages`, then `navigate_page` reload `127.0.0.1:5173/well-dipper/planet-lod-lab.html?fresh=1`.
Expected: page loads, planet renders, left (Drivers/World) + right (Features) GUI panels visible. If `list_pages` shows no page on `:9223`, STOP and ask Max to open the lab in the GPU Chrome (`--remote-debugging-port=9223`, per `chrome-devtools-9223-launch.md`) — do NOT start a server yourself.

- [ ] **Step 0.2: Capture the pre-change baseline from the live runtime** (so later checks have exact expected before/after values, and so we can prove the hard-gate is actually changing behavior).

Run (`evaluate_script`):
```js
() => {
  const L = window._lab;
  const u = () => ({
    shat: L.state ? undefined : undefined,  // read uniforms below instead
  });
  // Read the live uniforms object via the render loop's scope is not exposed;
  // instead drive the documented _lab helpers and read state flags.
  const out = {};
  // shatter force-enabled on Rocky — BEFORE the fix this paints (uShatStrength would be 1).
  L.setPreset('Rocky (Earthlike)');
  L.state.shatterEnabled = true;
  L.state.hexTessEnabled = true;
  out.rockyShatterEnabled = L.state.shatterEnabled;
  out.rockyHexEnabled = L.state.hexTessEnabled;
  // mountains on Carbon/Crystal — BEFORE the fix mountainAmp is nonzero.
  L.setPreset('Carbon (high C/O)');
  out.carbonMountainAmp = L.state.mountainAmp;
  L.setPreset('Crystal (faceted)');
  out.crystalMountainAmp = L.state.mountainAmp;
  // restore
  L.setPreset('Rocky (Earthlike)');
  L.state.shatterEnabled = false; L.state.hexTessEnabled = false;
  return out;
}
```
Expected (pre-fix): `rockyShatterEnabled === true`, `rockyHexEnabled === true`; `carbonMountainAmp` and `crystalMountainAmp` are **> 0** (the false-render source — mountains derive nonzero on Carbon/Crystal because `rockyCrust` reads them as silicate-dense). Record these. After the fix, the *writer* (`uMountainAmp.value`) must be 0 on Carbon/Crystal even though `state.mountainAmp` stays > 0 (the knockdown is in the writer, not the derivation).

> **Note:** the live `uniforms` object is in module scope, not on `window._lab`. The live checks below read **state flags and derived `state.*` values** that `_lab.state` exposes, plus the writer's *effect* (whether the feature renders). Where the spec says "verify `uShatStrength` reads 0," we verify the equivalent observable: the writer's source flags are gated such that the uniform is 0. If a tighter uniform read is needed, Task 5.4 adds a one-line temporary probe to expose `uShatStrength`/`uHexStrength`/`uMountainAmp` on `_lab` and removes it before commit (mirrors Ask 3's Step-1.4 probe pattern).

---

## Task 1: Derive the two `state` signals in `applyDrivers()` (+ safe seeds)

Add the per-feature relevance map and the exotic-carbon/geometric flag where `habGate` is computed, and seed safe defaults where `habGate` is seeded — so the first frame can never read `undefined`. **No writer change yet** (Tasks 2–3), so this task is behavior-neutral: the planet renders exactly as before. This isolates the derivation from the writer multiplies for clean regression bisection.

**Files:**
- Modify: `planet-lod-lab.html` — the `habGate` seed (~`:4950`) and the `habGate` derivation in `applyDrivers()` (~`:5524`).

- [ ] **Step 1.1: Seed safe defaults next to `habGate`'s seed.**

Re-grep: `grep -n "habGate: 1," planet-lod-lab.html` (~`:4950`). That line seeds initial `state` defaults. **After** that line (in the same state-init object), add the seeds so the first frame, before `applyDrivers` runs, multiplies by safe values:
```js
      featureRelevant: { shatter: 1, hexTess: 1 },  // per-feature relevance hard-gate seed (1 = pass; recomputed by applyDrivers from rendersOn). Safe first-frame default.
      isExoticCarbonOrGeometric: 0,                 // Carbon/Crystal exotic-crust knockdown seed (0 = no knockdown). Safe first-frame default.
```
**Why seed to pass-through (`1`/`0`):** before `applyDrivers` runs once, the writers must behave exactly as pre-change (gate = 1, knockdown = 0 → byte-identical). `applyDrivers` runs during GUI build (the initial preset apply), so these seeds are overwritten before any user interaction.

- [ ] **Step 1.2: Add the derivation in `applyDrivers()`, right after the `habGate` computation.**

Re-grep: `grep -n "state.habGate = t \* t" planet-lod-lab.html` (~`:5524`). That line ends the `habGate` block (the `{ const t = …; state.habGate = …; }` one-liner). **Immediately after** that closing `}`, add:
```js
      // ── Per-feature relevance hard-gate (Thread B) ────────────────────────────
      // Each gated feature is multiplied by ITS OWN relevance to the current preset
      // (NOT a blanket "is-exotic-world" flag — see spec §"The core correction").
      // Signal = the manifest's effective render membership (ASSOCIATIONS[key].rendersOn),
      // which HONORS hexTess's rendersOnDivergent Frozen membership (the raw
      // relevantFeatureSet().set does NOT — spec §D2/finding #5). Stored 1.0/0.0 so the
      // writer multiply matches the habGate idiom. Recomputed only on preset/quality change.
      state.featureRelevant = state.featureRelevant || {};
      for (const key of ['shatter', 'hexTess']) {
        state.featureRelevant[key] =
          (ASSOCIATIONS[key]?.rendersOn || []).includes(driverUI.preset) ? 1.0 : 0.0;
      }
      // ── Exotic-crust knockdown signal for mountains (Thread B) ─────────────────
      // 1.0 ONLY on the exotic-carbon (Carbon) / exotic-geometric (Crystal) presets,
      // whose relief is owned by carbon-crust (F42) / facets (F43). Mountains are hard-
      // zeroed there (silicate orogeny categorically wrong); everywhere ELSE — incl. icy
      // worlds — mountains keep their rockyCrust soft-scale + force-enable preview.
      // NOT a general relevance gate (spec §"mountains is a TARGETED knockdown").
      {
        const _archs = relevantFeatureSet().archs;
        state.isExoticCarbonOrGeometric =
          (_archs.includes('exotic-carbon') || _archs.includes('exotic-geometric')) ? 1.0 : 0.0;
      }
```
**Why this placement is safe:** `applyDrivers()` (`:5514`) already reads `driverUI.preset` and computes `habGate`. `ASSOCIATIONS` (imported `:111`) and `relevantFeatureSet()` (hoisted function declaration `:7083`, already called by `applyArchetypeFilter` `:7090`) are both in scope. `relevantFeatureSet().archs` is the array of archetype keys whose `presets` include the current preset — on Carbon it contains `'exotic-carbon'`, on Crystal `'exotic-geometric'` (verified `planet-archetypes.js:164-165`).

- [ ] **Step 1.3: Verify the derivation is correct AND behavior-neutral (no writer change yet).**

Reload `?fresh=1`. Run (`evaluate_script`):
```js
() => {
  const L = window._lab;
  const probe = (preset) => {
    L.setPreset(preset);
    return {
      preset,
      shatterRel: L.state.featureRelevant && L.state.featureRelevant.shatter,
      hexRel: L.state.featureRelevant && L.state.featureRelevant.hexTess,
      exoticCG: L.state.isExoticCarbonOrGeometric,
      mountainAmp: L.state.mountainAmp,   // unchanged by this task (writer not yet touched)
    };
  };
  const out = {
    rocky:   probe('Rocky (Earthlike)'),
    frozen:  probe('Frozen (airless)'),
    crystal: probe('Crystal (faceted)'),
    carbon:  probe('Carbon (high C/O)'),
  };
  L.setPreset('Rocky (Earthlike)');
  return out;
}
```
Expected:
- `rocky`: `shatterRel === 0`, `hexRel === 0`, `exoticCG === 0` (shatter/hexTess do not render on Rocky; Rocky is not exotic-carbon/geometric).
- `frozen`: `shatterRel === 1`, **`hexRel === 1`** (the critical D2 check — hexTess rides Frozen via the divergent flag; the signal must NOT kill it), `exoticCG === 0` (Frozen is exotic-shattered, not carbon/geometric → mountains NOT knocked down on Frozen).
- `crystal`: `hexRel === 0` (hexTess's `rendersOn` is `['Frozen (airless)']`, so it does NOT render on Crystal — only its FROZEN membership counts), `shatterRel === 0`, `exoticCG === 1` (Crystal IS exotic-geometric → mountains knocked down here).
- `carbon`: `shatterRel === 0`, `hexRel === 0`, `exoticCG === 1` (Carbon IS exotic-carbon → mountains knocked down here).
- Every `mountainAmp` is **identical to the Step 0.2 baseline** (writer untouched → no behavior change yet).

If `frozen.hexRel !== 1`, the D2 signal is wrong (you used the raw set, not `rendersOn`) — fix Step 1.2, do NOT relax the test. If any `exoticCG` is wrong, re-check `relevantFeatureSet().archs` contents for that preset.

- [ ] **Step 1.4: Commit.**
```bash
cd /home/ax/projects/well-dipper
git add planet-lod-lab.html
git commit -m "feat(lod-lab): derive per-feature relevance + exotic-crust signals (Thread B)

applyDrivers() now computes state.featureRelevant.{shatter,hexTess} from
ASSOCIATIONS[key].rendersOn (honors hexTess's rendersOnDivergent Frozen
membership; the raw relevantFeatureSet().set does not) and
state.isExoticCarbonOrGeometric from the Carbon/Crystal archetypes, both
1.0/0.0 to match the habGate idiom. Seeded safe defaults next to habGate's seed.
Writers not yet wired -> behavior-neutral this commit. No core/shader change.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: Hard-gate the shatter + hexTess writers

Multiply the two pure-enable writers by their relevance gate. This is the fix for residual #1. Separate task from mountains (Task 3) so a regression is isolatable to exactly one gate.

**Files:**
- Modify: `planet-lod-lab.html` — `uShatStrength` writer (~`:7536`), `uHexStrength` writer (~`:7527`).

- [ ] **Step 2.1: Multiply the hexTess writer by its relevance.**

Re-grep: `grep -n "uniforms.uHexStrength.value" planet-lod-lab.html` (~`:7527`). It currently reads:
```js
      uniforms.uHexStrength.value    = state.hexTessEnabled ? 1.0 : 0.0;   // ✓ enable gate
```
Change it to (keep the original alignment/comment style; the relevant value IS `1.0` on member worlds, preserving byte-identical-when-relevant):
```js
      uniforms.uHexStrength.value    = state.hexTessEnabled ? state.featureRelevant.hexTess : 0.0;   // ✓ enable gate × per-feature relevance hard-gate (zeros force-enable on non-member worlds; 1.0 on Frozen — its member world)
```

- [ ] **Step 2.2: Multiply the shatter writer by its relevance.**

Re-grep: `grep -n "uniforms.uShatStrength.value" planet-lod-lab.html` (~`:7536`). It currently reads:
```js
      uniforms.uShatStrength.value    = state.shatterEnabled ? 1.0 : 0.0;   // ✓ enable gate
```
Change it to:
```js
      uniforms.uShatStrength.value    = state.shatterEnabled ? state.featureRelevant.shatter : 0.0;   // ✓ enable gate × per-feature relevance hard-gate (zeros force-enable on non-member worlds; 1.0 on Frozen — its member world)
```
**Why this stays byte-identical on member worlds:** on Frozen, `state.featureRelevant.shatter` and `…hexTess` are both `1.0` (Task 1.3 verified), so `enabled ? 1.0 : 0.0` is exactly the pre-change expression. Only force-enabled non-member worlds change (relevance `0.0` → writer `0.0` even when enabled).

- [ ] **Step 2.3: Verify the hard-gate live on `:9223`.**

Reload `?fresh=1`. Run (`evaluate_script`):
```js
() => {
  const L = window._lab;
  const out = {};
  // Force-enable shatter + hexTess on Rocky (a non-member world). The gate must zero them.
  L.setPreset('Rocky (Earthlike)');
  L.state.shatterEnabled = true;
  L.state.hexTessEnabled = true;
  // The writer runs each frame; read the GATE the writer consumes (relevance) — it must be 0 here.
  out.rockyShatterGate = L.state.featureRelevant.shatter;   // expect 0 -> writer outputs 0 despite enabled
  out.rockyHexGate     = L.state.featureRelevant.hexTess;   // expect 0
  out.rockyShatterEnabled = L.state.shatterEnabled;          // confirm we DID force-enable (true)
  out.rockyHexEnabled = L.state.hexTessEnabled;              // true
  // On Frozen (member world) both gates must be 1 -> still render.
  L.setPreset('Frozen (airless)');
  L.state.shatterEnabled = true;
  L.state.hexTessEnabled = true;
  out.frozenShatterGate = L.state.featureRelevant.shatter;  // expect 1
  out.frozenHexGate     = L.state.featureRelevant.hexTess;  // expect 1 (D2: hexTess rides Frozen)
  // On Crystal, hexTess must NOT render (rendersOn is Frozen-only); shatter must NOT render.
  L.setPreset('Crystal (faceted)');
  out.crystalHexGate = L.state.featureRelevant.hexTess;     // expect 0
  // restore
  L.setPreset('Rocky (Earthlike)');
  L.state.shatterEnabled = false; L.state.hexTessEnabled = false;
  return out;
}
```
Expected: `rockyShatterGate === 0`, `rockyHexGate === 0` (with `rockyShatterEnabled === true`, `rockyHexEnabled === true` — proving the *gate*, not the enable flag, is doing the zeroing); `frozenShatterGate === 1`, `frozenHexGate === 1`; `crystalHexGate === 0`.

For a tighter uniform-level proof, see the optional probe in Step 5.4 (exposes `uShatStrength`/`uHexStrength` on `_lab` to confirm the *writer output* is 0/1, then removed before commit). Also take a `take_screenshot` on Rocky with shatter+hexTess force-enabled → the planet shows NO shatter/hex relief (visual sanity, not the gate's source of truth).

- [ ] **Step 2.4: Commit.**
```bash
cd /home/ax/projects/well-dipper
git add planet-lod-lab.html
git commit -m "fix(lod-lab): hard-gate shatter + hexTess by per-feature relevance (Thread B #1)

uShatStrength/uHexStrength writers now multiply by state.featureRelevant.<key>,
so force-enabling them on a non-member world renders nothing (the gate beats the
enable flag, like habGate). 1.0 on Frozen -> byte-identical on their member world.
Fixes residual #1 (force-enable false-renders). No core/shader change.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: Knock down mountains on Carbon/Crystal

Multiply the mountains writer's `state.mountainAmp` copy by `(1.0 − state.isExoticCarbonOrGeometric)`. This is the fix for residual #2. Asymmetric by design: hard-zero on Carbon/Crystal only; icy worlds keep soft-scale + preview.

**Files:**
- Modify: `planet-lod-lab.html` — `uMountainAmp` writer (~`:7617`).

- [ ] **Step 3.1: Apply the knockdown in the mountains writer.**

Re-grep: `grep -n "uniforms.uMountainAmp.value" planet-lod-lab.html` (~`:7617`). It currently reads:
```js
      uniforms.uMountainAmp.value      = state.mountainsEnabled ? state.mountainAmp : 0.0;   // ✓ enable gate
```
Change it to:
```js
      uniforms.uMountainAmp.value      = state.mountainsEnabled ? state.mountainAmp * (1.0 - state.isExoticCarbonOrGeometric) : 0.0;   // ✓ enable gate × Carbon/Crystal exotic-crust knockdown (hard-zero on Carbon/Crystal only; icy worlds keep rockyCrust soft-scale + preview)
```
**Why this is byte-identical everywhere except Carbon/Crystal:** `state.isExoticCarbonOrGeometric` is `0.0` on every preset EXCEPT Carbon/Crystal (Task 1.3 verified `frozen.exoticCG === 0`, `rocky.exoticCG === 0`). `(1.0 - 0.0) === 1.0`, so the multiply is by exactly `1.0` everywhere else → the expression equals the pre-change `state.mountainsEnabled ? state.mountainAmp : 0.0`. On Carbon/Crystal `(1.0 - 1.0) === 0.0` → hard-zero. The icy-world soft-scale lives upstream in `state.mountainAmp` (core-derived `× rockyCrust`) and is untouched.

- [ ] **Step 3.2: Verify the knockdown + icy-preview asymmetry live on `:9223`.**

Reload `?fresh=1`. Run (`evaluate_script`):
```js
() => {
  const L = window._lab;
  const out = {};
  // The writer output is state.mountainAmp * (1 - exoticCG). Reproduce that product from state.
  const writerAmp = () => (L.state.mountainsEnabled ? L.state.mountainAmp * (1 - L.state.isExoticCarbonOrGeometric) : 0);
  L.setPreset('Carbon (high C/O)');  L.state.mountainsEnabled = true;
  out.carbon  = { exoticCG: L.state.isExoticCarbonOrGeometric, derivedAmp: L.state.mountainAmp, writerAmp: writerAmp() };
  L.setPreset('Crystal (faceted)'); L.state.mountainsEnabled = true;
  out.crystal = { exoticCG: L.state.isExoticCarbonOrGeometric, derivedAmp: L.state.mountainAmp, writerAmp: writerAmp() };
  // Icy world: force-enable mountains preview MUST survive (knockdown is Carbon/Crystal only).
  L.setPreset('Europa (ice shell)'); L.state.mountainsEnabled = true;
  out.europa  = { exoticCG: L.state.isExoticCarbonOrGeometric, derivedAmp: L.state.mountainAmp, writerAmp: writerAmp() };
  // A normal silicate world: unchanged.
  L.setPreset('Rocky (Earthlike)'); L.state.mountainsEnabled = true;
  out.rocky   = { exoticCG: L.state.isExoticCarbonOrGeometric, derivedAmp: L.state.mountainAmp, writerAmp: writerAmp() };
  return out;
}
```
Expected:
- `carbon.exoticCG === 1` and `carbon.writerAmp === 0` (knocked down) — even though `carbon.derivedAmp > 0` (the derivation still produces relief; the *writer* zeros it).
- `crystal.exoticCG === 1` and `crystal.writerAmp === 0`.
- `europa.exoticCG === 0` and `europa.writerAmp === europa.derivedAmp` (> 0 if `rockyCrust` lets icy worlds preview; the asymmetry is preserved — knockdown does NOT touch icy).
- `rocky.exoticCG === 0` and `rocky.writerAmp === rocky.derivedAmp` (unchanged).

> **Preset-name caution:** the exact icy preset key may be `'Europa (ice shell)'`, `'Titan (…)'`, or `'Frozen (airless)'` — if `setPreset` no-ops (state unchanged), re-grep `DRIVER_PRESETS` for the exact spelling (`grep -n "Europa\|Titan\|Frozen" planet-lod-lab.html`) and use a confirmed icy key. Any icy world demonstrates the asymmetry; Frozen also doubles as the shatter/hexTess member world.

If `europa.writerAmp === 0`, the knockdown leaked onto an icy world (the signal is too broad) — STOP, re-check that `relevantFeatureSet().archs` on the icy preset does NOT contain `exotic-carbon`/`exotic-geometric`.

- [ ] **Step 3.3: Commit.**
```bash
cd /home/ax/projects/well-dipper
git add planet-lod-lab.html
git commit -m "fix(lod-lab): knock down mountains on Carbon/Crystal only (Thread B #2)

uMountainAmp writer now multiplies the state.mountainAmp copy by
(1 - state.isExoticCarbonOrGeometric): hard-zeros silicate orogeny on Carbon/
Crystal (relief owned by carbon-crust F42 / facets F43), while icy worlds keep
their rockyCrust soft-scale + force-enable preview (multiply by 1.0 everywhere
else -> byte-identical). Fixes residual #2. No core/shader change.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: Craters ACCEPT — doc-only (residual #3)

Record the decision to accept the faint Ocean/Europa crater traces. NO code.

**Files:**
- Modify: `docs/FEATURES/relief-triage-verdicts-2026-06-15.md`

- [ ] **Step 4.1: Read the verdicts doc and locate the craters / faint-traces lines.**

Run: `grep -n -iE "crater|faint|defer|accept|ocean|europa" docs/FEATURES/relief-triage-verdicts-2026-06-15.md`
Read the surrounding rows so the new ACCEPT entry matches the doc's existing format (it is the spec's source-of-truth verdicts table). Identify (a) the craters row and (b) the "Faint traces … deferred" line the spec references.

- [ ] **Step 4.2: Promote the craters / faint-traces line to an explicit ACCEPTED entry.**

Edit `docs/FEATURES/relief-triage-verdicts-2026-06-15.md` to record, in the doc's existing row/section style, an explicit ACCEPT decision for the faint craters residual. The entry must state:
- **Residual:** faint `craters` on Ocean / Europa (Δ ~0.0001–0.0005, ⚠️ faint-trace tier).
- **Verdict:** ACCEPT — minor cratering is science-legit on all solid surfaces; the trace is below the 🔴 0.0005 solid-false-render threshold and reads as a real faint signal, not a bug.
- **Decision authority + date:** Max's call, 2026-06-15 (this is the spec's recorded ACCEPT; the spec itself is committed `e339b9f`).
- **Action:** no code — documented and closed; the trace is expected to PERSIST in the render-audit (do not treat its continued presence as a regression).

Keep the edit minimal and in-format — promote the existing deferred line, do not rewrite the table. Do NOT touch any other verdict row.

- [ ] **Step 4.3: Commit.**
```bash
cd /home/ax/projects/well-dipper
git add docs/FEATURES/relief-triage-verdicts-2026-06-15.md
git commit -m "docs(relief-triage): ACCEPT faint Ocean/Europa craters (Thread B #3)

Promotes the deferred faint-traces line to an explicit ACCEPTED verdict: minor
cratering is science-legit on all solid surfaces and the trace is sub-0.0005
(faint-trace tier), so it is accepted, not fixed. Max's call 2026-06-15. No code;
the trace is expected to persist in the render-audit.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: Verification — render-audit Δ + live integration + close-out

This task closes the agent-closeable layers (render-audit Δ + live integration) → `VERIFIED_PENDING_MAX <sha>`. The UAT layer is **deferred-to-Max** and is NOT closed here.

- [ ] **Step 5.1: Existing unit suites stay green (additive change).**

Run: `cd /home/ax/projects/well-dipper && npx vitest run`
Expected: all green, specifically:
- `tests/feature-associations.test.js` — including the `rendersOn ⊆ archetype-union` check (`:129-149`) WITH its `rendersOnDivergent` exemption. Since NO manifest edit was made and the divergent flag is preserved, this stays green. (If it goes red, you accidentally edited the manifest — STOP and revert that edit.)
- `tests/planet-archetypes.test.js` — the PROVINCES↔GLSL drift guard + the `cityLightsEnabled → PROV_CITYLIGHTS` pin. We added NO `.add(state, '…Enabled')` and removed none, and touched no GLSL → this stays green.
If any previously-green suite is now red, STOP and diagnose — the change is additive runtime gating, so a red existing suite means an unintended edit.

- [ ] **Step 5.2: Re-run the render-audit Δ sweep.**

Reload `?fresh=1`. Run (`evaluate_script`) to drive the sweep (it writes the per-preset Δ data the generator consumes):
```js
async () => { return await window._lab.renderDeltaSweep(); }
```
Expected: the sweep completes and returns its result object (no throw). Then regenerate the report:
```bash
cd /home/ax/projects/well-dipper && node scripts/gen-render-audit.mjs
```
Expected: writes `docs/FEATURES/lab-render-audit.md`. (If `renderDeltaSweep` needs the sweep output persisted to a file/localStorage that the generator reads, follow whatever handoff the generator expects — re-read `scripts/gen-render-audit.mjs`'s input contract first; do NOT improvise.)

- [ ] **Step 5.3: Confirm the Δ cleared the targeted false-renders with NO member-world regression.**

Run: `grep -niE "false-render|dead-render" docs/FEATURES/lab-render-audit.md | head` and read the updated counts + the per-feature/per-preset matrix.
Expected (vs the `248b355` baseline of **64 false / 51 dead**):
- The `shatter` / `hexTess` force-enable false-renders on non-member worlds **clear**.
- `mountains` × Carbon (was Δ 0.0007) and `mountains` × Crystal (was Δ 0.0017) false-renders **clear**.
- Total false-renders **drop** from 64 by exactly those rows; **NO new false-renders or dead-renders appear on member worlds** (Crystal/Frozen/Carbon/icy) — this is the byte-identical-when-1 proof.
- The accepted faint `craters` traces on Ocean/Europa (#3) **remain** (intended; documented in Task 4 — do NOT treat as a regression).
- `shatter`/`hexTess` on Frozen and `hexTess`/`facets` on Crystal still render-as-declared (✅), and `carbon` on Carbon unchanged.

If ANY member-world cell changed (a new ⚠️D/🔴F/⚠️F where there was a ✅ or `·`, on Crystal/Frozen/Carbon/icy), the byte-identical-when-1 contract was violated — STOP, re-inspect the three writer edits for a non-`1.0` multiply or a reordered clamp, fix, and re-run from Step 5.2.

- [ ] **Step 5.4: Consolidated live integration sweep on `:9223` (the spec's Verification checklist).**

Reload `?fresh=1`. (Optional tighter proof: temporarily expose the writer uniforms by re-grepping the `_lab` export object `grep -n "renderDeltaSweep(opts)" planet-lod-lab.html` ~`:7820` and adding `getStrengths(){ return { shat: uniforms.uShatStrength.value, hex: uniforms.uHexStrength.value, mtn: uniforms.uMountainAmp.value }; },` to it — then assert against it below, and REMOVE the probe line before Step 5.6's commit, reload, and confirm `list_console_messages` shows no new error. This mirrors Ask 3's Step-1.4/1.6 probe pattern.)

Run (`evaluate_script`) — covers each spec acceptance check:
```js
() => {
  const L = window._lab;
  const out = {};
  // 1. Force-enable shatter on Rocky -> renders nothing (gate beats enable).
  L.setPreset('Rocky (Earthlike)'); L.state.shatterEnabled = true; L.state.hexTessEnabled = true;
  out.rockyShatterGated = L.state.featureRelevant.shatter === 0 && L.state.shatterEnabled === true;
  out.rockyHexGated     = L.state.featureRelevant.hexTess === 0 && L.state.hexTessEnabled === true;
  // 2. Crystal -> hexTess still renders (member via... no: Crystal hex gate is 0; hexTess renders on FROZEN). facets render; NO mountains.
  L.setPreset('Crystal (faceted)'); L.state.mountainsEnabled = true;
  out.crystalNoMountains = (L.state.mountainAmp * (1 - L.state.isExoticCarbonOrGeometric)) === 0;
  out.crystalExoticCG = L.state.isExoticCarbonOrGeometric === 1;
  // 3. Carbon -> NO mountains; carbon's own crust intact (carbon writer untouched).
  L.setPreset('Carbon (high C/O)'); L.state.mountainsEnabled = true;
  out.carbonNoMountains = (L.state.mountainAmp * (1 - L.state.isExoticCarbonOrGeometric)) === 0;
  // 4. Frozen -> shatter AND hexTess still render (member world).
  L.setPreset('Frozen (airless)');
  out.frozenShatterRenders = L.state.featureRelevant.shatter === 1;
  out.frozenHexRenders     = L.state.featureRelevant.hexTess === 1;
  out.frozenNoKnockdown    = L.state.isExoticCarbonOrGeometric === 0;  // mountains NOT knocked down on Frozen (exotic-shattered, not carbon/geometric)
  // restore
  L.setPreset('Rocky (Earthlike)'); L.state.shatterEnabled = false; L.state.hexTessEnabled = false;
  return out;
}
```
Expected: every field `true`. (The icy mountains-preview asymmetry was proven in Step 3.2; re-confirm there if desired.)

- [ ] **Step 5.5: Screenshots for the record** (`take_screenshot`, `127.0.0.1`, verify `innerWidth`/`dpr` before capture per `chrome-devtools-screenshot-scaling.md`):
  - Rocky with shatter+hexTess force-enabled → no shatter/hex relief.
  - Crystal → facets present, no silicate mountains.
  - Frozen with shatter+hexTess enabled → both render.
  - An icy world (e.g. Europa) with mountains force-enabled → mountains still preview.

- [ ] **Step 5.6: Stage the regenerated render-audit (and remove any probe).** If Step 5.4's optional probe line was added, remove it now, reload `?fresh=1`, and confirm no new console error. Then:
```bash
cd /home/ax/projects/well-dipper
git add docs/FEATURES/lab-render-audit.md
# If the probe was added then removed, also: git add planet-lod-lab.html
git commit -m "docs(render-audit): regen after Thread B gate (targeted false-renders cleared)

renderDeltaSweep + gen-render-audit re-run: shatter/hexTess force-enable
false-renders and mountains-on-Carbon/Crystal cleared; member worlds
byte-identical (no new regressions); accepted faint craters retained.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

- [ ] **Step 5.7: Update `docs/NOW.md`.**

Re-grep the active workstream / campaign block: `grep -n -iE "thread b|render-correct|relief|exotic|archetype gate|SESSION 2026-06-15" docs/NOW.md`. Update the relevant entry to note Thread B (exotic-archetype render gate) landed `VERIFIED_PENDING_MAX <sha>` (use the Task 3 commit SHA — the last user-visible rendering deliverable; get it with `git rev-parse HEAD` AFTER Task 3, or `git log --oneline -8`, NOT `git show HEAD`), the render-audit Δ result (which false-renders cleared), and that Max UAT is the remaining gate. Per the LOD charter (lab≠game) note this is a *lab* render-correctness fix. Keep to the existing block's format/brevity.

- [ ] **Step 5.8: Commit the NOW.md update.**
```bash
cd /home/ax/projects/well-dipper
git add docs/NOW.md
git commit -m "docs(now): lod-lab exotic-archetype render gate (Thread B) verified-pending-Max

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

- [ ] **Step 5.9: Hand to Max for UAT (his gate alone — NOT agent-closeable).**

State to Max: agent-closeable layers (existing suites green + render-audit Δ cleared the targeted false-renders with no member-world regression + live `:9223` integration checks pass) are GREEN → status `VERIFIED_PENDING_MAX <sha>`. Ask Max to ride the lab and confirm the gate reads right across presets — specifically: (a) force-enable shatter/hexTess on a wrong world shows nothing; (b) Crystal/Carbon show no silicate mountains but keep their own relief; (c) shatter+hexTess still render on Frozen, hexTess still on Crystal's... (no — on Frozen); (d) an icy world's force-enabled mountains STILL preview. Do NOT mark UAT closed — only Max closes UAT → Shipped.

---

## Self-Review (run by plan author)

**1. Spec coverage** (every spec requirement → a task):
- "Per-feature relevance hard-gate for shatter + hexTess, derived from `ASSOCIATIONS[key].rendersOn`" → Task 1.2 (derivation) + Task 2 (writers). ✔
- "Stored on `state` (`state.featureRelevant` map, 1.0/0.0 floats), mirroring habGate location/shape" → Task 1.1 (seed) + 1.2 (derive next to habGate). ✔
- "Targeted Carbon/Crystal knockdown for mountains via `(1 − isExoticCarbonOrGeometric)`" → Task 1.2 (`state.isExoticCarbonOrGeometric`) + Task 3 (writer). ✔
- "Keep mountains rockyCrust-soft-scaled + previewable on icy worlds (asymmetry)" → Task 3.1 rationale + Step 3.2 europa check + Step 5.4. ✔
- "carbon/facets already honest → untouched" → no task touches `:7507`/`:7518`; called out in Decisions #5 and the writer-edit steps. ✔
- "Craters #3 = ACCEPT, doc-only, cite Max 2026-06-15" → Task 4. ✔
- "Byte-identical on member worlds: multiply by exactly 1.0, no clause reorder; explicit AC + verification step" → "The byte-identical contract" section + Steps 2.2/3.1 rationale + Step 5.3 (the machine check) + Step 5.4. ✔
- "Each gate a separate small task with its own live check" → Task 1 (signals) / Task 2 (shatter+hexTess) / Task 3 (mountains) / Task 4 (craters doc) / Task 5 (verify+close). ✔
- "NO manifest edit; rendersOnDivergent preserved" → Decisions #6; Step 5.1 asserts `feature-associations.test.js` green (proves no manifest drift). ✔
- "NO core/shader edit" → Decisions #7; no task touches `planet-lod-lab-core.js`; every edit is a lab writer. ✔
- "D2: hexTess signal from rendersOn not the raw set (else killed on Frozen)" → Decisions #2 + Step 1.3 `frozen.hexRel === 1` critical check. ✔
- "Verification: live :9223 (not Playwright), ?fresh=1, window._lab.* + evaluate_script (not image recognition)" → Standing cautions + all live steps. ✔
- "Render-audit Δ: renderDeltaSweep + gen-render-audit.mjs → lab-render-audit.md; expect targeted clears vs 64/51 @ 248b355, no member regressions" → Steps 5.2–5.3. ✔
- "Max UAT deferred-to-Max, never agent-closeable; integration-green → VERIFIED_PENDING_MAX <sha>" → Step 5.9 + Task 5 preamble. ✔
- "Existing vitest suites stay green (additive)" → Step 5.1. ✔
- "All commits stage explicit paths (planet-lod-lab.html, relief-triage doc, NOW.md, lab-render-audit.md); never git add -A; don't git show HEAD" → every commit names paths; Standing cautions. ✔

**2. Placeholder scan:** No TBD/TODO/"handle edge cases". Every code step shows the exact before/after line. The "re-grep before editing" notes are deliberate line-drift caution (verified anchors given), not placeholders. The one prose-edit (Task 4.2) specifies exact required content (residual/verdict/authority/action) rather than dumping a table row, because the target doc's row format must be matched in-place — the implementer reads the live rows in Step 4.1 first. ✔

**3. Type/name consistency:** `state.featureRelevant` (object, keys `shatter`/`hexTess`, float values), `state.isExoticCarbonOrGeometric` (float) used identically in the seed (1.1), derivation (1.2), and all three writers (2.1/2.2/3.1) and every verification probe. `relevantFeatureSet().archs` (array) used consistently. No `.add(state, '…Enabled')` line touched (cityLights pin stays green). Writer expressions preserve the original `enabled ? X : 0.0` shape with the multiply folded into `X`. ✔

**4. Verified-against-source facts baked in:** `habGate` seed `:4950` / compute `:5524`; `applyDrivers` `:5514`; `state.mountainAmp` `:5560`; writers `uShatStrength :7536` / `uHexStrength :7527` / `uMountainAmp :7617` (all clean `? :`), `uCarbonStrength :7507` / `uFacetStrength :7518` (untouched); `ASSOCIATIONS :111` / `ARCHETYPES :110` / `relevantFeatureSet :7083`; exotic presets `planet-archetypes.js:164-166`; `hexTess.rendersOn=['Frozen (airless)']`+`rendersOnDivergent:true` / `shatter.rendersOn=['Frozen (airless)']` / `mountains.rendersOn` excludes Carbon/Crystal (`planet-feature-associations.js:59-66,387-402`); `renderDeltaSweep :7045`/`:7820`; audit baseline 64/51 @ `248b355`; `feature-associations.test.js:129-149` union+divergent check. ✔

---

## Risks / ambiguities surfaced while writing this plan (for Max)

1. **Scope of `state.featureRelevant` — only shatter/hexTess, or all features?** The spec stores the map keyed over `['shatter','hexTess']` only (the two that need a NEW gate). This plan follows the spec exactly. The map *shape* (`{key: 1.0/0.0}`) trivially generalizes to all features for future reuse (e.g. if a later thread wants honest force-enable on more features), but extending the loop to all `FEATURES` keys now would be speculative (YAGNI) and would slightly widen the per-preset compute. **Recommendation: ship the two-key version; revisit only when a third feature needs it.** Flagging because it is a one-line change either way and worth Max's awareness.

2. **`renderDeltaSweep` → generator handoff is not fully specified in the spec.** The spec says "re-run the sweep then `node scripts/gen-render-audit.mjs`," but the exact data handoff (does the sweep persist to a file/localStorage the generator reads, or does the generator drive its own headless sweep?) was NOT traced in this plan. Step 5.2 instructs the implementer to re-read the generator's input contract before running — if the handoff is more involved, that surfaces at execution, not as a plan gap. Low risk (the report + script + sweep all exist and produced the current `64/51` baseline), but the precise re-run mechanics are an execution-time read, not pre-verified here.

3. **Icy preset key spelling.** The spec names "Europa/Titan/Frozen" generically for the mountains-preview asymmetry; the exact `DRIVER_PRESETS` key for the icy world used in Step 3.2 must be confirmed live (`setPreset` no-op = wrong spelling). Frozen is a safe fallback (confirmed exotic-shattered, `exoticCG === 0`) and also doubles as the shatter/hexTess member world. Minor.

4. **All three writer sites confirmed as clean `×=` sites — no surprise.** I verified all three are single-line `state.X ? value : 0.0` writers (no compound clamp chains at the writer), so each is a clean multiply with no clause-reorder risk. The `carbon`/`facets` writers I was told not to touch are likewise simple. No site turned out to be a non-`×=` surprise. The only place a clamp lives is upstream (`state.mountainAmp`'s core derivation), which we deliberately do NOT touch — the knockdown multiplies the state copy in the writer, preserving byte-identical-when-1. ✔ (no blocker)

---

## Execution Handoff

**Plan complete and saved to `docs/superpowers/plans/2026-06-15-lod-lab-exotic-archetype-gate.md`. Two execution options:**

**1. Subagent-Driven (recommended)** — dispatch a fresh subagent per task, review between tasks, fast iteration. REQUIRED SUB-SKILL: superpowers:subagent-driven-development.

**2. Inline Execution** — execute tasks in this session via superpowers:executing-plans, batch execution with checkpoints. REQUIRED SUB-SKILL: superpowers:executing-plans.

**Which approach?**
