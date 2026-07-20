# build-plan.md — multistar-components-2026-07-19 (Increment A)

> Phase-2 adversarial BUILD PLAN. Implements §3.3 `componentSystems` substrate + §4 nav drill-in + §3.3 rep-cap amendment of `../real-universe-overlay-2026-07-12/multistar-render-feasibility.md` (anchor of record `7cb8253`). Satisfies the 10-AC `contract.json`; AC10 is Max-only UAT.
> **Line of sight:** exploration-immersion — a triple like Alpha Centauri becomes *experienceable* as a triple in nav (JOURNEY: real-universe navigability; PLAYER_EXPERIENCE: the nav-computer tier).
> **Hard boundary:** ZERO `src/main.js` edits; no `src/flight/`, `src/auto/`, `SC_TUNING`, `src/rendering/sky/*`; `realStarSeed.js` byte-identical; ProcgenSnapshot 24/24; suite ≥ 1,557/0. Vitest from the repo dir only. **Diff surface (AC9): `src/ui/`, `src/generation/`, `tests`/`__tests__`, and `docs/` ONLY — nothing in `scripts/`.**

Two reviews (design-correctness, boundaries/testability) were folded; see the closing **§ Review resolution**. A third, FABLE-model final gate (3 lenses: code-groundedness, determinism/byte-safety, contract compliance — Max's directive 2026-07-20) then verified the revised plan against source; its corrections are folded throughout and recorded in **§ Fable final-gate resolution**, and three contract amendments (AC5 render wording, AC8 doc-rot runnability, AC9 unscoped diff) were applied so Phase 4 verifies against reality. The load-bearing corrections vs. the draft: (1) `buildComponentContext` **destructure-omits** `farCompanions`/`companionSpec`/`knownPlanets` (a comment cannot strip a spread key — the draft shipped a stack overflow); (2) the recursive sub-generation is `yield*`-delegated, not a blocking sync call (keeps warp-FOLD `generateAsync` breathing); (3) `componentSeed` genuinely routes through `SeededRandom.child`; (4) no `scripts/` file — capture logic lives in `tests`; (5) AC8's done-check is project-wide `npm run doc-rot` (the scoped command errors on directory-format workstreams and its fix is out-of-surface).

---

## Payload shape (pinned — AC1 references this)

`systemData.componentSystems` is an **authored-only, additive** array, 1:1 and same-order with `systemData.farCompanions`, **absent** (never `null`) on procgen output:

```
componentSystems?: Array<{
  name:         string,   // = fc.name                          e.g. 'Proxima Centauri'
  class:        string,   // = fc.class  (full display class — honesty)  e.g. 'M5.5Ve'
  type:         string,   // = normalizeSpectralClass(fc.class) || 'M'   e.g. 'M'
  separationAU: number,   // = fc.separationAU                  e.g. 13000
  seed:         string,   // = componentSeed(canonicalSystemSeed, idx)
                          //   e.g. 'alpha-centauri:component-0:<base36 child draw>'
  systemData:   object,   // a FULL StarSystemGenerator.generate() payload for the component:
                          //   single star (no fabricated close binary), its known-planet pins
                          //   (Proxima b/d) + child-stream procgen fill, own planets/moons/
                          //   belts/zones — the spawnable neighborhood Increment B consumes.
}>
```

`name/class/type/separationAU` mirror `farCompanions[idx]` exactly (the field name `componentSystems` is distinct from the close-pair `companionSpec.components` descriptors, per report §3.3's terminology trap); `type` uses the same `normalizeSpectralClass` the far-companions emission already uses (StarSystemGenerator.js:861). `seed` + `systemData` are the promotion from inert record to spawnable component. Census breadth = the **three** far-bearing `STELLAR_COMPANIONS` rows (D4 default, Max-overridable): Alpha Centauri→Proxima (b, d pins), Guniibuu→HD 156026 (0 pins), Zet-1 Ret→Zet-2 Ret (0 pins).

**JSON-safety.** `systemData` is plain data (no functions, no cycles: `buildComponentContext` returns a fresh object, so `component.systemData.galaxyContext` is not `parentCtx`, and the parent never back-references its components). So the payload round-trips through `JSON.stringify` — the mechanism AC2's path-independence deep-equals and ProcgenSnapshot both rely on.

---

## DECISION (a) — Component payload residency: **INLINE, generated eagerly, cooperatively scheduled**

**Decision.** Each component's full `systemData` is generated inside `StarSystemGenerator._generateIterator` (the far-companions emission block) and stored on `systemData.componentSystems[idx].systemData`. On the async path the sub-generation is **`yield*`-delegated** so it does not block warp FOLD (see DECISION b). No lazy `resolveComponentSystem(seed, idx)` resolver.

**Rationale (grounded in code read):**
- **preview ≡ arrival symmetry is automatic.** Every componentSystems-bearing system funnels through one generation site: nav preview (`NavComputer._renderSystem → resolveArrivalSystem → knownWarp.generate()/StarSystemGenerator.generate`), warp arrival (`resolveArrivalSystemAsync → knownWarp.generate()/generateAsync`, sharing `_generateIterator`), and the bulk-overlay merge (`RealSystemOverlay.applyToContext → generate`). One site ⇒ byte-identical payloads on all paths — the exact class `arrivalResolution.js` was built to close. A lazy resolver would re-split the determinism contract across two call sites.
- **Byte-safety by construction.** The emission lives inside the existing authored-only guard (`if (Array.isArray(galaxyContext?.farCompanions) && …length > 0)`, StarSystemGenerator.js:856), so the procgen path never enters it (AC3). The component seed derives from a **fresh** `SeededRandom(canonicalSeed)` (DECISION b), never the live parent `rng`, so it draws nothing from the parent stream — verified: after line 856 the parent `rng` is not consumed (the only later consumer, `ExoticOverlay.apply`, self-seeds `systemData.seed+'-overlay'`, ExoticOverlay.js:27), and the fresh-root choice is byte-safe even if a future draw were added.
- **Save/load: non-issue.** No code path serializes `systemData` — the localStorage writers (`src/ui/Settings.js`, `src/camera/ShipCameraSystem.js`) store settings strings only; `main.js` regenerates on spawn/warp. ProcgenSnapshot JSON-round-trips only procgen samples, which carry no `componentSystems`. Inlining adds zero save/snapshot bloat.
- **Increment B wants it inline.** The joint-B+C spawn consumes `componentSystems[idx].systemData` directly; a self-contained payload is its input.

**Rejected — lazy `resolveComponentSystem(seed, idx)`:** re-splits determinism across generation + resolver (re-opening preview≠arrival), and forces both the nav drill-in and Increment B's spawn onto a new stateful resolver. Its only gain — a smaller in-memory `systemData` — is immaterial: `systemData` is never persisted and the key is absent from every snapshot sample.

---

## DECISION (b) — Child-stream seed, sub-generation site, and pin join

**Decision — seed (routes through `SeededRandom.child` — AC2 mechanism, verbatim).** The component seed is minted by a **fresh child stream** off the **one canonical system seed**, keyed by component index, never touching the parent `rng`:

```
// src/generation/componentSystems.js  (pure; imports SeededRandom ONLY)
export function componentSeed(canonicalSeed, idx) {
  // Fresh SeededRandom rooted on the ONE canonical system seed → .child keyed by
  // component index: the EXACT SeededRandom.child mechanism AC2 + the hard
  // constraint name. Fresh root ⇒ ZERO draw from the parent generator's live rng
  // (byte-safe by construction, independent of emission-block placement).
  // NEVER routes through realStarSeed (report §3.3: a realStarSeed-keyed component
  // bins Proxima to Rigil's (80009,250,-9) 0.1pc cell and COLLIDES with the system
  // seed). The readable prefix is visibly NOT a bare realStarSeed uint32; the
  // suffix's entropy is genuinely drawn from the child stream (not bare concat).
  const child = new SeededRandom(String(canonicalSeed)).child(`component-${idx}`);
  return `${canonicalSeed}:component-${idx}:${child.int(0, 0xffffffff).toString(36)}`;
}
```

This is **deterministic** (pure function of `(canonicalSeed, idx)`), **distinct per index** (different `.child` suffix → different Alea stream → different draw) and **per system** (different root + prefix), **path-independent** (canonicalSeed = the seed `generate()` receives — `'alpha-centauri'` for Alpha Cen on preview AND arrival, verified KnownSystems.js:108 + generateAuthoredSystem→generate(entry.seed); `String(realStarSeed(pos))` for the overlay rows on both paths), and carries **zero** `realStarSeed` references (AC2 static check). `realStarSeed.js` is untouched.

**Decision — sub-generation site + cooperative scheduling.** The sub-generation runs **inside `_generateIterator`, in the far-companions emission block** (after the `.map()` close at :866, INSIDE the :856 guard's braces, before the pre-overlay `yield` at :869 — the fable gate caught that ":867" is the guard's closing brace; the loop must sit inside it, as the code block below shows). It is a **`yield*`-delegated recursion** in a `for` loop (NOT `.map`, so `yield*` is legal):

```
if (Array.isArray(galaxyContext?.farCompanions) && galaxyContext.farCompanions.length > 0) {
  systemData.farCompanions = galaxyContext.farCompanions.map(/* unchanged */);
  const componentSystems = [];
  for (let idx = 0; idx < galaxyContext.farCompanions.length; idx++) {
    const fc = galaxyContext.farCompanions[idx];
    const normalizedType = this.normalizeSpectralClass(fc.class) || 'M';
    const componentCtx = buildComponentContext(galaxyContext, fc, normalizedType);
    const cSeed = componentSeed(seed, idx);
    const componentSystemData = yield* this._generateIterator(cSeed, componentCtx); // delegates yields
    componentSystems.push({
      name: fc.name, class: fc.class, type: normalizedType,
      separationAU: fc.separationAU, seed: cSeed, systemData: componentSystemData,
    });
  }
  systemData.componentSystems = componentSystems;
}
```

`yield*` propagates the child iterator's yields to the parent driver, so on the async warp path `generateAsync` keeps yielding between the component's heavy chunks (no single blocking burst). For **Alpha Cen** it rides `KnownSystems.generate()`, which is synchronous on both preview and arrival (arrivalResolution.js header) — the component already rides that sync drive; the cost is one bounded single-star sub-generation. Recursion is bounded: `componentCtx` has **no** `farCompanions` (stripped below), so the recursive call never re-enters the emission block. `_generateIterator`'s `return systemData` becomes the `yield*` value.

**Decision — component context (pure helper, NO `StarSystemGenerator`-instance/circular dep).** The recursion guard is **executable destructuring**, not a comment:

```
// src/generation/componentSystems.js
export function buildComponentContext(parentCtx, fc, normalizedType) {
  // Destructure-OMIT the parent's multi-star fields (executable strip, not a
  // comment): farCompanions removed → recursion guard; companionSpec removed →
  // no fabricated close binary inherited; knownPlanets replaced → the component
  // gets ITS OWN pins, never the parent's. rest reuses the parent galaxy physics
  // (same 0.1pc cell): metallicity, age, starWeights, binaryModifier, position.
  const { farCompanions, companionSpec, knownPlanets, ...rest } = parentCtx;
  return {
    ...rest,
    starTypeOverride: normalizedType,                        // component star = far companion's class
    companionSpec: {
      kind: 'single', source: 'component',                   // suppress fabricated close binary — HONEST
      components: [{ name: fc.name, class: fc.class }],      // lets stellarPrefix stamp star.spectFull
    },                                                       //   ('M5.5Ve' display honesty — fable M1)
    knownPlanets: Array.isArray(fc.planets) ? fc.planets : [], // Proxima b/d pins, or []
    // farCompanions intentionally absent (recursion guard + rep-cap §3 per-component collapse)
  };
}
```

This is the load-bearing fix vs. the draft: `buildAuthoredContext` sets **both** `ctx.companionSpec` (KnownSystemAuthoring.js:103) and `ctx.farCompanions` (:114), so a `{...parentCtx}` spread would carry `farCompanions` (a comment cannot delete a spread key) and the recursive `generate` would re-enter the guard → stack overflow. `companionSpec:{kind:'single', …}` rides the existing `forceBinary=false` path in `stellarPrefix` (StarSystemGenerator.js:250) — a real single (Proxima, HD 156026, Zet-2 Ret) never rolls a fabricated companion (pin-by-default honesty), and it fires on the component's own fresh stream only, so parent byte-safety is unaffected. The `components: [{name, class}]` carry (fable M1) exists ONLY so `stellarPrefix` :254-256 stamps `star.spectFull` from `components[0].class` — full-class display honesty (`'M5.5Ve'`), matching how authored arrivals treat Sirius; `kind` stays `'single'` so no close-count consumer misreads it (S2 asserts `star2===null` AND `star.spectFull===fc.class`). `normalizedType` is passed in (computed by the caller via `this.normalizeSpectralClass`) so the helper needs no `StarSystemGenerator` import — required, because `StarSystemGenerator` imports `componentSystems.js`, so the reverse import would cycle.

**Decision — where authored pins join the fill.** **At the join the recursion re-uses for free.** The emission forwards `fc.planets → componentCtx.knownPlanets`; `fc.planets` is already archive-shaped (Proxima b/d from `KNOWN_SYSTEM_CONTENTS['Proxima Centauri']` via `buildAuthoredContext`:108-113 / `RealSystemOverlay.resolve`:164-170; `[]` for HD 156026 / Zet-2 Ret). The recursive `_generateIterator` runs the **same** D3 known-planet injection (StarSystemGenerator.js:394-410 sort by sma; 500-501 slot floor; 513-521 pin orbit; 573-621 immunity/known-flag) the parent's own `knownPlanets` use. Because the component is `companionSpec:{kind:'single'}` (no binary cull) and knowns are migration/resonance-immune, b/d land once at their archive sma — d at 0.02881 AU (slot 0), b at 0.04848 AU (slot 1) — real generated orbits, never synthesized (AC5).

**Rejected — `parentRng.child('component-'+idx)` off the live stream:** `SeededRandom.child` calls `this.rng()`, consuming a draw from the **live parent** stream — byte-safe only by the accident that `ExoticOverlay` is the last consumer; a future draw after the block would break it. The fresh-root form is byte-safe independent of placement. Also rejected — pre-generating payloads in the authoring layer and threading them via `ctx.componentSystems`: duplicates payload construction across the authored and bulk paths (two sites), whereas `resolveArrivalSystem`/`arrivalResolution` flow authored fields *transparently* — the single generation site keeps them in lockstep for free.

---

## DECISION (c) — Drill-in render source + hit-test geometry

**Decision — state + render (mirror the planet-detail *drill mechanism*; render a *system orrery*).** Add `_systemMode='component'` + `_selectedComponentIdx` (mirroring `'planet'` + `_selectedPlanetIdx`, NavComputer.js:103-104), dispatched by `_renderSystem` (a `component` branch **before** the `planet` branch at :2006). The **state-machine** mirrors the planet-detail drill exactly (sub-mode + index + render fn + ESC pop); the **render** reuses `_renderSystem`'s SYSTEM-scale orrery (star at origin + planets at real `orbitRadiusAU` under the same `sqrt(AU)` projection) sourced from `componentSystems[idx].systemData` — NOT `_renderPlanetDetail`'s moon-scale projection, because a component is a full system. Footer `'VIEW ONLY · ESC TO GO BACK'`; `_commitButtonRect = null` and no commit action (no travel affordance — Increment B owns it; warp semantics unchanged, the drill-in is a VIEW). **All view text derives from a new pure module** `src/ui/componentIdentity.js` (systemIdentity.js pattern — pure, no NavComputer-instance dep, unit-testable bare):

```
// src/ui/componentIdentity.js  (imports deriveSystemTitle/deriveSystemAnnotation from systemIdentity.js)
export function findComponentIndexByName(systemData, markerName) → idx | -1  // match componentSystems[i].name
export function deriveComponentView(parentSystemData, idx, markerName) → {
  title:      deriveSystemTitle(parent, markerName),          // 'Alpha Centauri'          (clause 1)
  breadcrumb: `part of ${title}`,                             // 'part of Alpha Centauri'   (clause 4 cue)
  annotation: deriveSystemAnnotation(parent, componentName),  // 'via Proxima Centauri — far companion' (clause 3)
  componentName, systemData: parent.componentSystems[idx].systemData,  // clause 2: planets payload-sourced
}
```

**Decision — ESC pop.** In `handleEscape` at `_levelIndex===4` (NavComputer.js:1001), add a `component` pop **before** the `planet` pop (:1003): `if (this._systemMode==='component'){ this._systemMode='system'; this._selectedComponentIdx=-1; return true; }`. First ESC: component→SYSTEM; second: SYSTEM→PRISM (unchanged).

**Decision — entry (a): far-chip click.** `_farChipRects` is published by `_drawFarCompanionChips` (NavComputer.js:666). Two edits close the latent index-desync both reviews flagged: (1) `buildFarCompanionChips` (farCompanionChips.js) carries the **source** index on each descriptor — its loop becomes `for (let i=0; i<arr.length; i++){ const fc=arr[i]; if(!fc) continue; …; chips.push({…, index:i}); }` so a future falsy far entry (skipped by `if(!fc) continue`, :65) cannot desync chip position from `farCompanions`/`componentSystems` index; (2) the rect push carries it: `this._farChipRects.push({ x, y, w, h, chip, index: chip.index })`. In `_handleClick` at `_levelIndex===4`, **system** mode, after the COMMIT check (:3728-3735) and the planet-mode block (:3737-3761), before the body checks (:3763): hit-test `_farChipRects`; on a hit **guarded by `this._systemData?.componentSystems?.[r.index]`**, set `_selectedComponentIdx=r.index; _systemMode='component'`. The guard preserves today's behavior on a system with `farCompanions` but no `componentSystems` (chip stays hover-only, no drill — AC5 verify). A click in **component** mode returns to SYSTEM (info-only, mirroring the foreign planet-detail return at :3757-3759).

**Decision — entry (b): PRISM far-member marker.** Clicking Proxima's own PRISM marker **already** lands Alpha Centauri's SYSTEM view (prism-click :3799-3810 sets `_systemStar=star; _systemData=null`; `_renderSystem` → `resolveArrivalSystem(displayName:'Proxima Centauri', hasNavStar:true)` → `findByAlias` → Alpha Cen). Add a deferred pre-select: the prism-click handler sets `this._pendingComponentSelect = star.name` (alongside the existing `_systemData=null`). At the top of `_renderSystem`, **after** `_systemData` resolves (after the :1970-2000 block) and **before** the mode dispatch (:2006): `if (this._pendingComponentSelect){ const idx=findComponentIndexByName(this._systemData, this._pendingComponentSelect); if (idx>=0){ this._selectedComponentIdx=idx; this._systemMode='component'; } this._pendingComponentSelect=null; }`. Deferred because `componentSystems` isn't available until `_systemData` is generated; the field persists across the 400ms prism→system zoom anim and is consumed on the first level-4 render. Unconditional set is safe: `findComponentIndexByName` returns −1 for a non-component marker (Rigil Kentaurus, a procgen star) → no pre-select. Warp untouched: `_systemStar`/COMMIT still build seed 1816942132.

**Decision — file split.**
- `src/ui/farCompanionChips.js`: **descriptor gains `index`** (source-index carry — the only change; still pure geometry).
- `src/ui/NavComputer.js`: state fields; `_renderComponentDetail`; `_renderSystem` dispatch + `_pendingComponentSelect` consumption; `_handleClick` far-chip hit-test + component-mode return + prism pre-select; `handleEscape` pop; the `_farChipRects.push` index.
- `src/ui/componentIdentity.js`: **new** pure module (view-model derivation + hit-test-by-name).

**Rejected — a fabricated view-only orbit set:** recreates the preview≠arrival defect class; AC5/intent forbid it (orbits are payload-sourced). Rejected — a click handler *inside* `farCompanionChips.js`: that module is pure geometry; the click owner is `NavComputer` (it owns `_farChipRects` + the canvas listener bound at :177).

---

## Slices

Each slice is independently committable and adversarially verifiable. Oracle-lockstep is its own slice (S4). The rep-cap amendment is the final slice (S8). **Vitest runs from the repo dir only.**

---

### S1 — Component seed + context pure helpers (`componentSystems.js`)

**Goal.** The `SeededRandom.child` seed + the component-context builder + the payload-shape validator, as a pure module unit-tested bare (no `StarSystemGenerator`, no `NavComputer`). Closes AC2 at the derivation level; sets up AC9 helper-purity.

**Test-first — `src/generation/__tests__/componentSystems.test.js`:**
- `it('componentSeed is deterministic for the same (seed, idx)')`
- `it('componentSeed is distinct per component index and per system seed')`
- `it('componentSeed routes through SeededRandom.child — a spy on SeededRandom.prototype.child fires with `component-${idx}`')` (proves the AC2-named mechanism is actually used, not string-concat theater).
- `it('componentSeed never references realStarSeed — module source has zero occurrences')` (`readFileSync('componentSystems.js')` asserts no `realStarSeed` substring — hermetic).
- `it('buildComponentContext sets starTypeOverride to the passed normalized type')`
- `it('buildComponentContext forces companionSpec kind:single with components[0] = {name: fc.name, class: fc.class} (no fabricated close binary; spectFull carry)')`
- `it('buildComponentContext routes fc.planets → knownPlanets, [] when absent')`
- `it('buildComponentContext strips parent farCompanions AND companionSpec AND knownPlanets (recursion + no-inherit guard)')` — pass a parentCtx carrying all three; assert the result has none of the parent's values (the executable-strip regression pin).
- `it('validateComponentPayload accepts a well-formed entry and rejects each missing/mistyped key')`

**Files + symbols.** New `src/generation/componentSystems.js` — exports `componentSeed`, `buildComponentContext`, `validateComponentPayload`. Imports `SeededRandom` only.

**Contract ACs.** AC2 (derivation), AC9 (helper purity), AC3 (baseline capture — see below).

**Done-check.** `npx vitest run src/generation/__tests__/componentSystems.test.js` green; `! grep -q realStarSeed src/generation/componentSystems.js` (grep -q negated — `grep -c` exits 1 on zero matches, fable NIT).

**S1 ALSO delivers the S3 baselines (fable M5 — capture is structurally out of order if left in S3):** write `src/generation/__tests__/_captureAuthoredParent.mjs` NOW and run it at THIS slice's tree (StarSystemGenerator untouched ⇒ authored output byte-identical to `dc0f3c5`), writing `docs/WORKSTREAMS/multistar-components-2026-07-19/authored-parent-baseline.json` (Alpha Cen) AND `sirius-baseline.json` (a non-far authored row — AC1's 'byte-unchanged' observable, fable M4). The helper asserts `componentSystems` is ABSENT from what it captures and refuses otherwise (fable N4 — a post-S2 re-run cannot silently capture a wrong baseline). Fixtures committed with S1.

---

### S2 — Substrate emission + validators (`StarSystemGenerator` + `stellarCompanions`)

**Goal.** `StarSystemGenerator` emits `systemData.componentSystems` (1:1 with `farCompanions`, each a full generated single-star sub-system with real pins+fill) via `yield*`; the far-row promotability validator extension is in place. Census holds over all three far-bearing rows; preview ≡ arrival on the genuinely-distinct sync/async path.

**Test-first:**
- `src/generation/__tests__/componentSystems.substrate.test.js`:
  - `it('census: every farCompanions-bearing STELLAR_COMPANIONS row yields componentSystems.length === farCompanions.length; every other row yields no key')` — walk `STELLAR_COMPANIONS`; Alpha Cen via `generateAuthoredSystem`, Guniibuu + Zet-1 Ret via `arrivalCtx`-driven `generate`; each payload passes `validateComponentPayload`.
  - `it('Alpha Cen component is Proxima (type M, star.spectFull === M5.5Ve) with b and d at archive orbits')` — `componentSystems[0].systemData.planets` includes wrappers with `known===true`, letters `b`/`d`, `orbitRadiusAU` ≈ 0.04848 / 0.02881 (payload-sourced); `systemData.star.spectFull` carries the full class (the `components[0].class` stamp, fable M1).
  - `it('Guniibuu → HD 156026 (0 pins) and Zet-1 Ret → Zet-2 Ret (0 pins) are single stars, procgen fill only')` — each component `systemData.star2===null`; no `known` planets.
  - `it('payload seed === componentSeed(canonicalSeed, idx) — not realStarSeed')` (recompute and compare).
  - `it('AC2 path-independence: Alpha Cen componentSystems deep-equal across generateAuthoredSystem, resolveArrivalSystem (nav-pick), and a same-path repeat')`.
  - `it('AC2 sync≡async: Guniibuu componentSystems deep-equal across resolveArrivalSystem (sync preview) and await resolveArrivalSystemAsync (async arrival)')` — the genuinely distinct path (Alpha Cen's authoring vs nav-pick are the same sync function; this exercises `generate` vs `generateAsync` sharing `_generateIterator`, incl. the `yield*` delegation, so it is byte-identical).
- `src/generation/__tests__/stellarCompanions.promotability.test.js`:
  - `it('validateStellarCompanions passes on the real table and asserts far-row promotability for all three far-bearing rows')`
  - `it('a synthetic far row whose class has no normalizable leading letter is reported un-promotable')`
  - `it('the validator promotability predicate agrees with StarSystemGenerator.normalizeSpectralClass across a class battery')` — closes drift between the validator's local acceptance mirror and the real normalizer (the test imports the real normalizer; the validator does not, keeping `stellarCompanions.js` dependency-free).

**Files + symbols.**
- `src/generation/StarSystemGenerator.js` — in `_generateIterator`, the emission block (after `systemData.farCompanions = …map(…)`, :867, before the pre-overlay `yield` :869): the `for`-loop above calling `buildComponentContext` + `componentSeed` + `yield* this._generateIterator`. Uses `this.normalizeSpectralClass` for `type`. Import `componentSeed`, `buildComponentContext` from `./componentSystems.js`.
- `src/generation/data/stellarCompanions.js` — extend `validateStellarCompanions`: for each `farCompanions` entry assert a normalizable leading class letter via a **local** `_promotableLead` predicate (documented as mirroring `normalizeSpectralClass`'s acceptance `OBAFGKMD`+`W/C/S/L/T/Y`; pinned by the agreement test above). Keeps this data module import-free / non-circular.

**Contract ACs.** AC1, AC2.

**Known intentional collateral (fable M2 — name it so a future reader doesn't misread the slowdown as a regression):** the emission guard is structural, so two existing tests begin recursing at S2: `StarSystemGenerator.overlay.test.js` `det-overlay` (synthetic far row, :202-220) and `alpha-cen-overlay` (:223-257). Both were fable-verified to SURVIVE (their deep-equals are generate-vs-generate, additive-key-symmetric; the `letter:'z'` no-sma known rides the null-sma path inside the component without error) — but their runtime grows and their semantics widen from "inert far data" to "far data + sub-generation."

**Done-check.** `npx vitest run src/generation/__tests__/componentSystems.substrate.test.js src/generation/__tests__/stellarCompanions.promotability.test.js` green; `npx vitest run src/generation/__tests__/ProcgenSnapshot.test.js` 24/24; **and the full suite `npm test` ≥ 1,557/0** (surfaces any additive-key breakage here rather than at S7 — correctness-review confirmation); `realStarSeed` reference count in `StarSystemGenerator.js` unchanged from `dc0f3c5` (currently 0 — the emission additions must not import it; fable N3 widened the AC2 static check beyond `componentSystems.js`).

---

### S3 — Procgen + authored byte-safety guard (AC3)

**Goal.** Prove zero perturbation: `componentSystems` absent from procgen output, ProcgenSnapshot 24/24, procgen RNG draw-for-draw unchanged, and the **authored parent** unperturbed except for the added key.

**Test-first — `src/generation/__tests__/componentSystems.byteSafety.test.js`:**
- `it('componentSystems key is ABSENT (not null) from a battery of purely-procgen systems')` — seeds across regions; `expect('componentSystems' in sys).toBe(false)`.
- `it('poison probe: the emission machinery is NEVER invoked on the procgen path')` — a REAL structural probe (fable M1: output identity is necessary, not sufficient — a draw added after the emission block would change no output while violating 'zero added draws'): spy on the `componentSystems.js` module exports (`componentSeed`, `buildComponentContext`) across the procgen battery and assert ZERO invocations; ProcgenSnapshot byte-identity then pins the output side. Together: the guard never fires AND the output is byte-stable.
- `it('additivity: authored Alpha Cen minus componentSystems is deep-equal to the pre-increment authored-parent baseline')` — deep-equal `rt(omit(generateAuthoredSystem(alphaCen), 'componentSystems'))` to the checked-in S1 fixture, where `rt()` is the existing JSON-round-trip idiom (`arrivalResolution.test.js`) — the fixture is parsed JSON, so the generated side must round-trip too (fable N3).
- `it('non-far authored row byte-unchanged: Sirius deep-equals its pre-increment baseline')` — `rt(generate(sirius))` vs the S1 `sirius-baseline.json` fixture (AC1's 'byte-unchanged' observable, fable M4; no `omit` needed — the key must be absent).
- Re-run `ProcgenSnapshot.test.js` (unchanged) as the 24/24 pin.

**Files + symbols.** The test file only — the capture helper `_captureAuthoredParent.mjs` and both fixtures are S1 deliverables (fable M5: capture must precede S2's generator edit structurally, not as prose). No `src/` production edits (guard slice).

**Contract ACs.** AC3.

**Done-check.** `npx vitest run src/generation/__tests__/componentSystems.byteSafety.test.js src/generation/__tests__/ProcgenSnapshot.test.js` green (24/24 + guards). `realStarSeed.js` zero-diff is asserted as a shell gate in S7 (not shelled from inside vitest — hermetic-ness NIT).

---

### S4 — Oracle / glyph lockstep pin (AC4) — OWN slice

**Goal.** Prove the additive `componentSystems` key does not desync `multiplicityForSeed` or the test helper `mult()`, and pin every census dot count — including Zet-1 Ret's third topology — at `5583651` behavior. **Framing (accurate):** `componentSystems` is structurally invisible to the oracle (`multiplicityForSeed` reads `companionSpec`/`farCompanions` only, multiplicityOracle.js:135-171) and to the glyph (`_glyphDotCount ← _glyphMult ← multiplicityForSeed` + `_localStarNames`, NavComputer.js:1636/1774/1812 — it never consumes a generated `systemData`). So these tests prove **additive non-interaction / dot-count invariance**, not "lockstep under a componentSystems-bearing payload." The outcome is **no oracle/glyph production change**.

**Test-first:**
- `src/generation/__tests__/multiplicityOracle.componentLockstep.test.js` (reuses `mult() = 1 + (star2?1:0) + farCompanions.length` and the real-catalog `beforeAll` from `multiplicityOracle.test.js`):
  - `it('mult() ignores componentSystems — a synthetic sys with a componentSystems key returns the same count')`.
  - `it('componentSystems.length === farCompanions.length for every census row')` (the 1:1 invariant — so even a future switch to counting components still agrees).
  - `it('oracle.count === mult(generated systemData) for the full census WITH componentSystems present')` — Alpha Cen 3, Guniibuu 3, Zet-1 Ret 2, Sirius 2, procgen binary 2.
- `src/ui/__tests__/NavComputer.glyphLabels.componentLockstep.test.js` (extends the existing dot-count census, NavComputer.glyphLabels.test.js:200-209):
  - `it('procgen binary marker = 2 dots (unchanged from 5583651)')`
  - `it('Guniibuu marker = 3 dots (unchanged)')`
  - `it('Rigil Kentaurus = 2 dots, Proxima Centauri = 1 dot (unchanged)')`
  - `it('Zet-1 Ret = 2 dots — single primary + collapsed far companion, the third topology (unchanged)')`
  - Each `it` documents that the dot count is oracle-derived and `componentSystems`-blind (the invariance is the point).

**Files + symbols.** Test files ONLY. `multiplicityOracle.js` (`multiplicityForSeed`, `_closeFromSpec`) and `prismMembership.js` are untouched; this slice guards their invariance.

**Contract ACs.** AC4.

**Done-check.** `npx vitest run src/generation/__tests__/multiplicityOracle.componentLockstep.test.js src/ui/__tests__/NavComputer.glyphLabels.componentLockstep.test.js` green, plus the pre-existing `multiplicityOracle.test.js` + `NavComputer.glyphLabels.test.js` still green.

---

### S5 — Drill-in render, headless (AC5)

**Goal.** The component sub-view + both entries + ESC pop, mirroring the planet-detail drill mechanism with a system-orrery render; all four grammar clauses; payload-sourced orbits; no-drill on a no-componentSystems system. Entry (a) and entry (b) are **separately committable** within this slice (independent features — boundaries NIT).

**Test-first:**
- `src/ui/__tests__/componentIdentity.test.js` (pure, bare — constructs NO NavComputer):
  - `it('findComponentIndexByName matches componentSystems[i].name, -1 on miss')`
  - `it('deriveComponentView title names the SYSTEM (clause 1): Alpha Centauri, not Proxima Centauri')`
  - `it('deriveComponentView annotation marks the component (clause 3): via Proxima Centauri — far companion')`
  - `it('deriveComponentView breadcrumb cues co-membership (clause 4): part of Alpha Centauri')`
  - `it('deriveComponentView.systemData.planets are payload-sourced (clause 2): deep-equal componentSystems[idx].systemData.planets')`
  - `it('procgen system (no _knownSystemNames / no componentSystems) → view falls back, no throw')`
- `src/ui/__tests__/NavComputer.componentDrill.test.js` (bare `Object.create(NavComputer.prototype)` harness — **stub `_getCanvasPos` to return the click point** (bypassing `getBoundingClientRect`), and seed `_levelIndex=4`, `_systemMode='system'`, `_autopilotButtonRect=null`, `_commitButtonRect=null`, `_farChipRects`, `_systemData.componentSystems`; this needs more scaffolding than the render-only glyphLabels harness — the extra stubs are enumerated here so the reuse claim is honest):
  - **Entry (a):** `it('far-chip click → component mode with the matching _selectedComponentIdx')`
  - **Entry (a):** `it('far-chip click on a system WITHOUT componentSystems does NOT drill (chip stays hover-only)')`
  - **Entry (b):** `it('PRISM far-member entry: _renderSystem consumes _pendingComponentSelect and sets component mode with the matching idx; a non-component marker leaves system mode')`
  - `it('ESC in component mode pops to system (mode=system, idx=-1); a second ESC leaves level 4')`
  - `it('component-mode click returns to system (info-only)')`
  - `it('_renderComponentDetail reads orbits from the payload — b/d orbitRadiusAU deep-equal the component systemData, not synthesized; sets no commit affordance (_commitButtonRect=null)')`
  - `it('b and d markers are present in the drilled view (structure list = payload planets)')`
  - `it('_renderComponentDetail publishes its OWN label rects to _labelRects (cleared per frame, one rect per drawn label)')` — fable M2: `_labelRects` is populated only by the PRISM-level `_drawLabelPass` today, so without this publication AC6's live non-overlap assertion would measure stale PRISM rects (vacuously passing). `_renderComponentDetail` routes its labels through the label-pass mechanism (or clears-and-pushes `_labelRects` directly) so the live handle reflects the drilled view.

**Files + symbols.**
- New `src/ui/componentIdentity.js` (`findComponentIndexByName`, `deriveComponentView`; imports `deriveSystemTitle`, `deriveSystemAnnotation` from `systemIdentity.js`).
- `src/ui/farCompanionChips.js`: `buildFarCompanionChips` descriptor carries `index` (source index).
- `src/ui/NavComputer.js`:
  - constructor state near :104: `_selectedComponentIdx = -1`, `_pendingComponentSelect = null`.
  - `_renderSystem` (:1966): consume `_pendingComponentSelect` after `_systemData` resolves; add `if (this._systemMode==='component'){ this._renderComponentDetail(ctx,w,h); return; }` before the `planet` branch (:2006).
  - new `_renderComponentDetail(ctx, w, h)` — reuse `_renderSystem`'s orrery projection over `deriveComponentView(...).systemData`; draw title/breadcrumb/annotation + payload planets; footer `'VIEW ONLY · ESC TO GO BACK'`; `_commitButtonRect=null`; publishes its label rects to `_labelRects` (fable M2 — the AC6 live handle must reflect THIS view).
  - `_drawFarCompanionChips` (:666): push `index: chip.index`.
  - `_handleClick` (:3724): far-chip hit-test (system mode, guarded by `componentSystems?.[r.index]`); component-mode click → system; prism pre-select `_pendingComponentSelect = star.name` (:3807 area).
  - `handleEscape` (:1003): component pop before planet pop.

**Contract ACs.** AC5, AC9 (helper purity — `componentIdentity.test.js` builds no NavComputer).

**Done-check.** `npx vitest run src/ui/__tests__/componentIdentity.test.js src/ui/__tests__/NavComputer.componentDrill.test.js` green.

---

### S6 — Live drill-in + arrival unchanged (AC6, AC7)

**Goal.** Both entries and warp-invariance verified in the wired app on `:5176` (working-Claude drives chrome-devtools; objective checks only — Max owns UAT).

**Live drive protocol (not vitest).** Stop `window._autoNav` immediately on load and after any warp; canvas `MouseEvent`s for clicks; CDP `press_key` for ESC; confirm `_hoveredLocalStar` before a click-drill; close every page opened.
- **AC6(a):** from Alpha Centauri's SYSTEM view (click Rigil/Toliman marker), click Proxima's far-companion chip → component sub-view shows Proxima with **b and d** markers; ESC → SYSTEM view. Screenshot per step to the workstream dir; `window._navComputer._labelRects` pairwise non-overlapping in the drilled view.
- **AC6(b):** click Proxima's own PRISM marker → lands Alpha Centauri SYSTEM view with the component pre-selected + annotated (`'via Proxima Centauri — far companion'`) + breadcrumb (`'part of Alpha Centauri'`); ESC round-trips to SYSTEM view.
- **AC7:** browse both α Cen markers → both preview title `'Alpha Centauri'` with A+B rendered + far chip, AND capture the per-marker preview seed (the nav-side resolved seed the marker dispatches, per the grammar-WS drive method) = `1816942132` BEFORE warping (fable N1 — the contract names the seed at preview, not only at warp); warp from each → `[WARP]` log shows seed `1816942132`, authored G2V+K1V @23.5 AU arrival. Console clean throughout.
- **Watch-item (non-gating, fable N2):** α Cen rides the sync `KnownSystems.generate()` drive on the async arrival wrapper too, so parent + Proxima component generate in one main-thread burst at warp — watch the α Cen warp FOLD for a visible hitch; if material, flag to the Increment B scoping (where component generation cost meets the travel path), do NOT fix here (main.js/warp is out of surface).

**Files + symbols.** None (verification slice over S5). Evidence screenshots → `docs/WORKSTREAMS/multistar-components-2026-07-19/`.

**Contract ACs.** AC6, AC7.

**Done-check.** Screenshots on disk per entry path; `_labelRects` non-overlap asserted via the instrumented handle; `[WARP]` seed `1816942132` confirmed both markers; console clean.

---

### S7 — Regression guardrail sweep (AC9)

**Goal.** Nothing lane-owned moved; diff confined to the permitted surface; helpers pure.

**Checks.**
- Full suite from the repo dir: `npm test` → ≥ 1,557/0 (baseline grows-never-shrinks; ProcgenSnapshot 24/24 per S3).
- **Unscoped** `git diff --stat dc0f3c5` (NOT `-- src` — the draft's `-- src` scope was blind to non-`src` additions): assert touches confined to `src/ui/` (`NavComputer.js`, new `componentIdentity.js`, `farCompanionChips.js`), `src/generation/` (`StarSystemGenerator.js`, `stellarCompanions.js`, new `componentSystems.js`), `src/generation/__tests__/` + `src/ui/__tests__/` (test files + `_captureAuthoredParent.mjs`), and `docs/` (baseline fixture + S8 rep-cap). **Explicitly assert `scripts/` is untouched.**
- `git diff dc0f3c5 -- src/main.js` empty (lane-B flag ledger stays FOUR); `git diff --quiet dc0f3c5 -- src/generation/realStarSeed.js` (the AC2 realStarSeed zero-diff, as a shell gate — hermetic, not shelled inside vitest); no `src/flight/`, `src/auto/`, `SC_TUNING`, `src/rendering/sky/*`.
- Helper-purity: `componentSystems.test.js` and `componentIdentity.test.js` import the modules bare and construct no `StarSystemGenerator`/`NavComputer`.

**Files + symbols.** None (sweep). Re-runs after S8's doc edit as the final gate.

**Contract ACs.** AC9.

**Done-check.** `npm test` ≥ 1,557/0; unscoped `git diff --stat` scoped to the allowed surfaces with `scripts/` empty; `main.js` + `realStarSeed.js` zero-diff.

---

### S8 — Rep-cap two-stroke amendment (AC8) — FINAL

**Goal.** Amend `representation-cap.md` in exactly two strokes (report §3.3); §3 higher-order-collapse text unchanged.

**Checks.**
- **Stroke (a) — §2 `**Data-level v1: no scene body.**` line (:38):** add an explicit supersession note citing `multistar-components-2026-07-19` — a far companion now gains its **own component scene** (`systemData.componentSystems`: a full generated payload, navigable via the nav drill-in now, spawnable in Increment B), NOT a slot in the pair's scene. **The note explicitly governs, by reference, the §2 heading parenthetical (`(data-level)`, :31) and §5's "Far-companion planets remain data-level … never scene bodies" bullet (:128)** — so no reader is misled and the doc is not left internally contradictory, without a third textual stroke (§2 heading and §5 are NOT edited — AC8 caps at two strokes). This is honest for Increment A: the drill-in is a nav-HUD view and `componentSystems` is data + Increment-B-spawnable — **no 3D scene body is spawned in the parent scene**, so the §2-heading/§5 "not close stars / never scene bodies" claims remain literally true; only the "data-level" framing is superseded (now also a full component payload).
- **Stroke (b) — §1 header (:15) `## 1. At most 2 CLOSE stars per system`** reworded to per-rendered-scene (e.g. `## 1. At most 2 CLOSE stars per rendered scene`), body still asserting the ≤2-close cap (each component scene holds ≤2 close stars).
- **§3** (higher-order collapse) textually unchanged; per-component collapse holds by DECISION (b)'s `companionSpec:{kind:'single'}` + stripped `farCompanions`.
- **Non-gating:** `NAMING_AND_REAL_OBJECTS.md` §6 cross-ref only if that doc is touched (it is not, here) — skip.
- **FLAG to Max (non-gating):** the two-stroke cap defers a fuller §2-heading/§5 refresh until **Increment B** lands a real far-companion *scene body*; at that point "never scene bodies" genuinely falls and those passages need direct edits. Recorded here so it is not lost.

**Done-check.** **`npm run doc-rot` (project-wide — NOT `--workstream <slug>`)** → no new flags attributable to `representation-cap.md`, **plus a manual read** confirming: §2 line carries the supersession note citing this workstream (governing §2-heading + §5 by reference); §1 header contains "per rendered scene" AND still asserts ≤2 close stars; §3 unchanged. **Rationale for the project-wide command:** the scoped `npm run doc-rot -- --workstream multistar-components-2026-07-19` **errors (exit 2)** — `doc-rot-check.sh:84-87` resolves `WS_FILE=docs/WORKSTREAMS/${slug}.md` and this workstream is directory-format (no `.md`). The scoped-mode fix (lane A, 2026-07-14) is **owed on this branch but NOT ported here**, because porting it edits `scripts/doc-rot-check.sh` — outside AC9's permitted diff surface. Project-wide doc-rot IS runnable (warn-only, exit 0) and satisfies AC8's real observable (two amended lines + no new rot). Then re-run S7's full-suite + diff-scope sweep as the final state (docs are within the allowed surface).

**Files + symbols.** `docs/WORKSTREAMS/real-universe-overlay-2026-07-12/representation-cap.md` — §1 header (:15) + §2 data-level line (:38).

**Contract ACs.** AC8.

---

## AC → slice coverage map

| AC | Slice(s) | Layer |
|---|---|---|
| AC1 components-substrate | S2 | unit |
| AC2 child-seed-determinism | S1 (derivation + `.child` proof + static realStarSeed check), S2 (path-independence incl. sync≡async), S7 (realStarSeed zero-diff shell gate) | unit |
| AC3 procgen-byte-safety | S3 (+ S2 sanity) | unit |
| AC4 oracle-lockstep | **S4 (own slice)** | unit |
| AC5 drill-in-render | S5 | unit |
| AC6 drill-in-live | S6 | integration (live) |
| AC7 arrival-unchanged | S6 | integration (live) |
| AC8 rep-cap-amendment | **S8 (final slice)** | unit (doc) |
| AC9 regression-guardrail | S7 (+ S1/S5 helper-purity, S3 byte pins, unscoped diff) | unit |
| AC10 uat | — deferred-to-max (no agent closes it) | uat |

**Integration→VERIFIED_PENDING_MAX gate.** After S1–S5 + S7–S8 green (headless) + S6 live (AC6/AC7), working-Claude drives the AC6/AC7 live *integration* checks; the verify-workstream workflow marks AC10 `deferred-to-max`. Green integration → `VERIFIED_PENDING_MAX <sha>` → Max's UAT sitting (AC10) re-runs the three riding gates (real-universe-overlay AC9, unification AC11, grammar AC8) on this build.

---

## Review resolution

Every BLOCKER/MATERIAL from both reviews, plus applied NITs. Where REJECTED, the code was re-checked.

**BLOCKER — AC8 scoped doc-rot done-check unrunnable (boundaries).** **ADDRESSED.** Verified `doc-rot-check.sh:84-87`: `WS_FILE="docs/WORKSTREAMS/${WORKSTREAM_SLUG}.md"` then `[ ! -f ] → exit 2`; confirmed no `multistar-components-2026-07-19.md` sibling (directory-format). S8's done-check is now **project-wide `npm run doc-rot`** (runnable, warn-only) + manual read of the two amended lines. Not porting the scoped-mode fix: it edits `scripts/`, outside AC9's surface.

**MATERIAL — `buildComponentContext` recursion guard is a comment → stack overflow (both reviews).** **ADDRESSED.** Verified `buildAuthoredContext` sets BOTH `ctx.companionSpec` (KnownSystemAuthoring.js:103) and `ctx.farCompanions=fars` (:114); a `{...parentCtx}` spread copies `farCompanions` and no key overrides it → recursive re-entry of the guard (StarSystemGenerator.js:856) → infinite recursion. DECISION (b) now **destructure-omits** `farCompanions`, `companionSpec`, and `knownPlanets` (executable strip), pinned by S1's `'strips parent farCompanions AND companionSpec AND knownPlanets'` test.

**MATERIAL — `scripts/` breaches AC9 surface + S7 diff blind to it (boundaries).** **ADDRESSED.** Verified AC9 permits `src/ui/, src/generation/, tests, docs` only. The capture helper moved from `scripts/capture-authored-parent.mjs` to `src/generation/__tests__/_captureAuthoredParent.mjs` (test surface); the fixture stays in `docs/`. S7's diff is now **unscoped** `git diff --stat dc0f3c5` (not `-- src`) and **explicitly asserts `scripts/` untouched**.

**MATERIAL — sync recursive `generate` in the async path stalls warp FOLD (boundaries).** **ADDRESSED.** Verified `generateAsync` (StarSystemGenerator.js:154-162) awaits `setTimeout(0)` between yields; a blocking sync `generate` in the emission block would run a full sub-system in one burst mid-FOLD for Guniibuu/Zet-1 Ret. DECISION (b) now uses **`yield* this._generateIterator(cSeed, componentCtx)`** in a `for` loop (not `.map`), delegating yields to the async driver. Noted Alpha Cen rides the sync `KnownSystems.generate()` drive on both paths (bounded), so no async concern there.

**MATERIAL — `componentSeed` never uses `SeededRandom.child`, contradicting AC2 + the hard constraint (boundaries).** **ADDRESSED.** Verified `child()` (SeededRandom.js:93-96) = `new SeededRandom(this.rng()+'-'+suffix)`; the draft's bare `${seed}:component-${idx}` never calls it and would leave "imports SeededRandom only" false. `componentSeed` now genuinely does `new SeededRandom(String(canonicalSeed)).child(\`component-${idx}\`)` (fresh root ⇒ byte-safe, no parent-draw coupling) and returns a readable string incorporating the child draw; S1 spies on `SeededRandom.prototype.child` to pin the mechanism.

**MATERIAL — S3 capture procedure impossible (`node scripts/…` absent at `dc0f3c5`) (boundaries).** **ADDRESSED.** The capture helper is run at the **post-S1 / pre-S2 working-tree state** (StarSystemGenerator un-edited there ⇒ authored parent == `dc0f3c5`), not from a `dc0f3c5` checkout — the reviewer's own correction. S3 documents this explicitly.

**MATERIAL — the two-stroke rep-cap amendment leaves §2-heading/§5 self-contradictory (boundaries).** **ADDRESSED (partial) / REJECTED (partial), code re-checked.** Re-read `representation-cap.md`: §2 heading (:31) "…FAR COMPANIONS (data-level), not close stars" and §5 (:128) "Far-companion planets remain data-level … never scene bodies." Against **what Increment A actually ships** (verified against DECISION c): the drill-in is a **nav-HUD view**, and `componentSystems` is **data + Increment-B-spawnable** — **no 3D scene body is spawned in the parent scene**. So "not close stars" and "never scene bodies" remain **literally true** at Increment A (REJECT "now false"); only the "(data-level)" framing is superseded (now also a full payload). Rather than a third stroke, the §2 supersession note (stroke a) is worded to **govern §2-heading and §5 by explicit reference**, so the doc is not left contradictory while honoring AC8's exactly-two-strokes. The residual full refresh (owed when Increment B lands a real scene body) is **flagged to Max, non-gating** in S8.

**NIT — chip→component index assumes no falsy `farCompanions` (correctness N1 / boundaries).** **APPLIED.** `buildFarCompanionChips` carries the **source** index on each descriptor (its loop skips falsy at farCompanionChips.js:65, which would desync a chip-loop counter); `_farChipRects` and the hit-test use `chip.index`. `componentSystems` is 1:1 with `farCompanions` by construction, so the source index keys both.

**NIT — S4 glyph test framing overclaims (correctness N2 / boundaries).** **APPLIED.** Verified the glyph path (`_glyphDotCount ← _glyphMult ← multiplicityForSeed`) never reads a generated `systemData`. S4 is reframed as an **additive non-interaction / dot-count-invariance** guard (not "lockstep under a componentSystems payload"), each `it` documenting the oracle-derived, componentSystems-blind nature.

**NIT — `git diff --quiet` inside vitest is environment-fragile (correctness N3).** **APPLIED.** realStarSeed zero-diff is a **shell gate in S7**, not a vitest test; the hermetic in-vitest check is the `readFileSync` "zero realStarSeed references in `componentSystems.js`" static assertion (S1).

**NIT — "small sub-system" understates async cost (correctness N4).** **APPLIED.** DECISION (a)/(b) name the cost honestly and mitigate it via `yield*` cooperative scheduling; DECISION (a) keeps residency = inline (un-challenged) with the scheduling nuance called out.

**NIT — AC2 path-independence near-tautological for Alpha Cen (boundaries).** **APPLIED.** Verified Alpha Cen's nav-pick and authoring paths both route the same sync `generateAuthoredSystem`. S2 adds a **genuinely distinct** `sync≡async` deep-equal on Guniibuu (`resolveArrivalSystem` vs `await resolveArrivalSystemAsync`, exercising `generate` vs `generateAsync` + the `yield*` delegation).

**NIT — S5 bundles too much / bare-harness `_handleClick` needs more scaffolding (boundaries).** **APPLIED.** S5 marks entry (a) and entry (b) as separately committable, and enumerates the extra harness stubs (`_getCanvasPos` override, `_levelIndex`, `_autopilotButtonRect=null`, `_commitButtonRect=null`, `_farChipRects`, `_systemData.componentSystems`) so the "follows glyphLabels" reuse claim is honest.

**Confirmations carried forward (correctness hunt-areas 1–5 CLEAN; extra AC9 regression note).** Snapshot/RNG, determinism, authored-pin join, oracle/glyph lockstep, and no-hidden-main.js all verified CLEAN against the code (fresh-root seed, guard-gated emission, D3 immunity join, additive-key blindness, canvas listener already bound at NavComputer.js:177). Per the correctness reviewer's note that S2's original done-check ran only new files + ProcgenSnapshot, **S2 now runs the full suite** so any additive-key breakage surfaces at S2, not only at S7.

---

## Fable final-gate resolution (2026-07-20, Max's directive — 3 fable lenses over the revised plan)

**Lens verdicts:** code-groundedness — every load-bearing claim in DECISIONs a/b/c verified true against source, 4 NITs; determinism/byte-safety — no blockers, all 5 attack vectors clean (seed-path identity traced across every call site incl. main.js debug paths; ProcgenSnapshot's 24 samples carry zero farCompanions; no shared mutable state in the recursion), 2 MATERIALs; contract compliance — plan boundary-clean and non-goal-clean, but 1 BLOCKER + 6 MATERIALs where plan and CONTRACT disagreed (Phase 4 verifies the contract, not the plan).

**Folded into this plan:**
- **spectFull carry (det M1):** `buildComponentContext` companionSpec gains `components:[{name, class}]` so `stellarPrefix` stamps `star.spectFull` — component stars are no longer class-anonymous vs how authored arrivals treat Sirius. S1/S2 tests pin it.
- **Poison probe made real (comp M1):** S3's probe now spies the emission-machinery exports over a procgen battery (zero invocations) instead of leaning on the false "identical output ⟺ identical draws" biconditional.
- **Label rects (comp M2):** `_renderComponentDetail` publishes its OWN `_labelRects`; S5 pins the publication; without it AC6's live non-overlap assertion would measure stale PRISM rects.
- **Baseline capture moved to S1 (comp M5) + Sirius fixture added (comp M4) + helper self-guard (det N4):** the capture is structurally pre-S2 in the slice order; the helper refuses a componentSystems-bearing capture.
- **Collateral tests named (det M2):** `overlay.test.js` det-overlay + alpha-cen-overlay begin recursing at S2 — verified surviving, named in S2 so the slowdown reads as intended.
- **S6 additions:** per-marker preview-seed capture (comp N1); α Cen FOLD-burst watch-item, flag-to-Increment-B only (det N2).
- **Static-check widening (comp N3):** `realStarSeed` reference count in `StarSystemGenerator.js` pinned unchanged at S2.
- **Mechanical (cg NITs 1–3, comp N2):** emission-site cite corrected to :866-inside-guard; localStorage sentence includes `ShipCameraSystem.js`; `! grep -q` replaces `grep -c` in done-checks. (cg NIT-4 oracle-span cite left as-is — the substantive claim was confirmed.)

**Contract amendments applied (and re-validated) so Phase 4 verifies reality:**
- **AC8 (comp B1):** verifyVia now names project-wide `npm run doc-rot` (scoped mode exits 2 on directory-format workstreams — verified against `doc-rot-check.sh`) and the observable is "no NEW flags attributable to representation-cap.md", not the unsatisfiable "flagged: 0".
- **AC5 (comp M3):** "mirrors the planet-detail drill MECHANISM… rendered as a SYSTEM-scale orrery" — the contract no longer implies `_renderPlanetDetail`'s moon-scale projection, which intent.md's "SYSTEM-scale nav view" always meant.
- **AC9 (comp M6):** the diff input is now UNSCOPED vs `dc0f3c5` with `scripts/` explicitly asserted untouched — the src/-scoped diff could not police its own observable.