# #4b Venus stagnant-lid — BUILD PLAN (grounded + adversary-corrected)

**Provenance:** workflow `wf_2d29dc2b-607` — 3 parallel grounding agents (dispatch/lab, writer-template/helpers/carrier,
test-conventions) → plan-propose → adversarial critique. Grounding line numbers independently re-confirmed in the critique.
Feeds implementation directly. Full mechanism/math: [`../world-engine-history-program-2026-06-27/increment-4b-venus-stagnantlid-MECHANISM.md`](../world-engine-history-program-2026-06-27/increment-4b-venus-stagnantlid-MECHANISM.md).
Contract: [`contract.json`](contract.json).

---

## Locked decisions (the 7 adversary corrections + 2 open calls, resolved)

1. **Rift corridors = ANALYTIC geodesic point-to-arc distance** (no BFS) → **zero while-loops** in the writer. AC1 asserts `whileCount === 0`. (Kills BFS frontier-order dependence.)
2. **AC5 = set-level variety**, not flaky pairwise: assert `coronaCount` is **not-all-equal** across `SEEDS=[1,2,3,7,42]` (high entropy → strict); `plumeCount` not-all-equal across the set (N_plume∈[6,11] is only 6 values → no strict pairwise `!==`); `isTessera` node-overlap `< 0.2` on one chosen seed pair.
3. **Arm's-length plume predictor uses the writer's EXACT squared Gaussian** `p = exp(-(a/PLUME_BELT)^2)` — NOT the magmatism `centroidPredictor` (which is linear `exp(-a/BELT)`; Pearson r is not invariant under that reshape and would spuriously drop `varExplainedByPlume` below 0.5).
4. **Live `stagnantLidProbe.meanRiftTrench` uses the same LOW mask** as AC2: `{active-corona trench annulus 0.8≤ρ≤1.05}` ∪ `{inRift}` — NOT whole-corona average (the domed interior is above plains and would invert the ordering).
5. **Tessera selection = 64-bin percentile histogram** of `plumeProxAncient`, pick the threshold for the top `TESSERA_FRAC = 0.075` (O(N), no sort, order-independent) — from the START, not the fixed `THRESH=0.55` (which yields ~0.037 when a seed draws only 2 ancient centers, below the 0.06 floor). **Guarantee ≥1 ancient AND ≥1 corona-forming center** deterministically (if the type draw yields zero of either, flip the lowest-index center) so `plumeProxAncient` is never all-zero.
6. **Publish a named `coronaCoverMask`** (node covered iff within any corona's profile support: active ρ<1.6·, inactive ρ<1.3·, in units of ρ=geodesicDist/R_c) so writer/test/probe all compute `plainsFrac` + the `meanPlains` exclusion over the identical population. `plainsFrac = fraction of nodes with !isTessera && !inRift && !coronaCoverMask`.
7. **Explicit disjoint `stagnant:` noise/rng streams**, all created INSIDE the writer (no module-level `alea()`/`createNoise3D()` — the new import at rivers.js must be side-effect-free). `randomPlacementControl` is a flag-guarded option exercised ONLY by AC4; it must consume the SAME per-iteration draw sequence and never allocate/execute when `false`.

Streams (fixed draw order): `stagnant:plumes:` (N_plume then N_plume×randDir, 2 draws each) · `stagnant:ptype:` (N_plume type draws) · `stagnant:warp:` (domain-warp noise) · `stagnant:corona:` (pool: site(2)→accept(1)→[radius(1)→active(1) only on accept]) · `stagnant:tessfold:` · `stagnant:tessribbon:` · `stagnant:age:` · `stagnant:detail:`.

---

## EDIT planet-lod-rivers.js — 6 edits (live line numbers, 2026-07-01; the MECHANISM doc's :439/:440/:1146 are STALE, pre-#4a)

1. **Import** — after the magmatism import at **:32**: `import { writeStagnantLidReliefSphere, stagnantLidRegimeOf } from './src/worldengine/base/stagnantLid.js';`
2. **Predicate** — after `isVolcanicPath`'s close (**:437**), before `writeBodyRelief` (**:439**):
   `export function isStagnantLidPath(archetype, locked = false) { return stagnantLidRegimeOf(archetype, locked) !== null; }`
3. **New branch** — insert after the volcanic block's closing `}` (**:473**), before `writeGrainSphere` (**:474**):
   ```js
   const slRegime = stagnantLidRegimeOf(archetype, locked);
   if (slRegime) {
     const stagnantDiag = writeStagnantLidReliefSphere(carrier, grainDrivers, { macroSeed, regime: slRegime });
     return { path: 'stagnant-lid', plateDiag: null, shellDiag: null, magmaDiag: null, stagnantDiag };
   }
   ```
4. **Uniform return shape** — add `stagnantDiag: null` to the four existing returns (**:448 plate, :453 shell, :472 volcanic, :476 despun**).
5. **route() threading** — mirror the `magmaDiag` trio (NOT plate/shell): `let stagnantDiag = null;` after **:1121**; `stagnantDiag = relief.stagnantDiag;` after **:1184**; `get stagnantDiag() { return stagnantDiag; },` after **:1245**.
6. **Export** — `isStagnantLidPath` exported inline at (2).

Dispatch becomes 5-way: plate(:442) → shell(:451) → volcanic(:458) → **stagnant-lid(new)** → despun(:474). Collision-free: `'stagnant-lid'` isn't terrestrial/ocean (plate misses), isn't a SHELL_REGIMES key and Venus is locked:false so shell's locked-fallback can't fire (shell misses), isn't in `VOLCANIC_ARCHETYPES` (volcanic misses).

## EDIT planet-lod-lab.html — 2 edits
- One `PRESET_ARCHETYPE` line among **:1904-1917**: `'Venus (sulfuric shroud)': 'stagnant-lid',` (Magma's line is the format precedent). Venus is already in `NAMED_BODY` (**:1900**) so `drawPresetRadius` short-circuits at **:1927** → radius stays canonical 0.95 R⊕.
- `stagnantLidProbe()` sibling of `magmaProbe` (**:6136-6192**): read `riverOverlay.stagnantDiag`; null-branch note off-path; rebuild the **squared-Gaussian** plume predictor from `diag.plumeCenters`; return `{ heightSource, regime, plumeCount, coronaCount, tesseraFrac, plainsFrac, activeFrac, varExplainedByPlume, varExplainedByLatitude, meanTessera, meanPlains, meanRiftTrench (trench-annulus∪rift mask), U:Array.from(U) }`.

## NEW src/worldengine/base/stagnantLid.js
Imports (copy plates.js:39-41 form): `alea`, `createNoise3D`, `{ clamp, clamp01 } from './mathutil.js'`. **Never** three. Exports: `STAGNANT_BOUND=4`, `RELAX_PASSES=4`, `STAGNANT_LID_KEYS = new Set(['stagnant-lid','venus'])`, `stagnantLidRegimeOf(archetype, locked=false)` (key-match only, **NOT** locked-gated), `writeStagnantLidReliefSphere(carrier, drivers={}, { macroSeed=0, regime='venus-stagnant-lid', tune=null, randomPlacementControl=false }={})`.

**Copy VERBATIM** (byte-safe per live sources): vec3 `dot`/`cross`/`norm` (plates:166-168) · `randDir` (plates:171-176, 2 draws/call, fixed order) · STEP-0 `meanEdgeAngle` (plates:212-217, diag parity only — all widths are direct geodesic radians so it's non-load-bearing) · domain-warp block + offsets (plates:249-252) · nearest-center strict `>` tie-break (plates:253-259, applied separately to ancient/corona centers) · Jacobi relax (plates:354-363, PASSES=4) · `steeredNoise3` in the **ridged-boolean** form (shellRelief:110-129; both fold & ribbon call `ridged=true` → `0.5-|n|`).

**Writer flow:** plume field (N_plume + centers + centerIsAncient w/ the ≥1-each guard + domain-warp + squared-Gaussian proximity → `plumeProxAncient`,`plumeProx`) → tessera (percentile-histogram threshold on `plumeProxAncient`; foldAngle via finite-diff gradient of `plumeProxAncient` projected to `tangentFrameAt(i)`, atan2(0,0)=0 guard; `fold=steeredNoise3(...,foldAngle+π/2,true,FOLD_FREQ)`, `ribbon=steeredNoise3(...,foldAngle,true,RIBBON_FREQ)`; tessTexture on tessera nodes) → coronae (48-site pool, accept `rng<plumeProx(site)^CORONA_BIAS`, heavy-tailed R_c, isActive `rng<0.65`; radial profiles h_active/h_inactive; build `coronaCoverMask`) → rift (analytic point-to-arc < RIFT_HALFWIDTH between nearest ancient/active center pairs) → resurfAge (diagnostics only) → assembly `U=base+tex+cor+det`, `carrier.height.set(U)`, relax, `carrier.grainAngle.set(foldAngle)` (pre-zeroed Float32Array → 0 outside tessera), `carrier.faultDensity[i]=clamp01(deformIntensity[i])`. **carrier.regime UNTOUCHED** (verify.js:39 asserts {0,1,2}).

**Diag returned:** `{ U, plumeCenters, centerIsAncient, plumeCount, isTessera, tesseraFrac, coronaCenters, coronaRadius, coronaActive, coronaCoverMask, coronaCount, activeFrac, inRift, plainsFrac, resurfAge, deformIntensity, foldAngle, meanEdgeAngle, relaxPasses, regime, PLUME_BELT }`. (`plumeCenters` + `PLUME_BELT` are load-bearing so the probe/test rebuild proximity arm's-length.)

## Calibration (all citation-re-verified 2026-07-01; constants unchanged)
`PLUME_MIN=6, PLUME_SPAN=6` (N_plume∈[6,11]) · `PLUME_BELT=0.35` (squared Gaussian) · `TESSERA_CENTER_FRAC=0.4` (→2-4 ancient, ≥1 guaranteed) · **`TESSERA_FRAC=0.075` via percentile histogram** → tesseraFrac∈[0.06,0.10] · `CORONA_POOL=48, CORONA_BIAS=1.5` (~14-28 accepted) · `CORONA_ACTIVE_FRAC=0.65` · `D_MIN=60,D_MAX=2600 km, SIZE_SKEW=2.5, R_V=6052 km` · active `A_DOME=0.35,A_TRENCH=0.30,A_RISE=0.12` / inactive `A_DEP=0.18,A_RIM=0.22` (all < base gaps) · `BASE_TESSERA=0.70,BASE_PLAINS=0.10,BASE_RIFT=-0.25` · `TESS_FOLD_AMP=0.16,TESS_RIBBON_AMP=0.08 (Σ0.24<0.60 gap), FOLD_FREQ=5,RIBBON_FREQ=13` · `RIFT_HALFWIDTH=0.03` · `YOUNG_LOBE_GAIN=0.35` · `STAGNANT_BOUND=4, RELAX_PASSES=4`. Escalation levers if AC2 marginal: `CORONA_BIAS`/`TESSERA_FRAC` (varExplainedByPlume), `CORONA_POOL`/`SIZE_SKEW`/`RIFT_HALFWIDTH` (plainsFrac).

## Slices
- **SLICE A** (three-free writer + headless AC1-AC5): `stagnantLid.js` + `tests/worldengine-base-stagnantlid-structure.test.js`. Gate: `npx vitest run` green before B. Do NOT start a dev server.
- **SLICE B** (dispatch + lab + AC6/AC7): rivers.js 6 edits + lab.html 2 edits + AC6 no-clobber + AC7 seam blocks (same test file). Then working-Claude drives live AC8 (chrome-devtools, `list_pages` for liveness — no localhost curl). Rule-3 docs + `VERIFIED_PENDING_MAX <sha>` → Max AC9 UAT.

## Test conventions (match siblings)
`TARGET_N=600, LLOYD=2, SEEDS=[1,2,3,7,42]`; `carrierOf = () => makeSphereField(buildIrregularSphere(600,2))`; hand-rolled `pearson`/`varExplained` (magmatism:260-267); byte-identity = build twice on fresh carriers, `Array.from(...).toEqual(...)` for U/grainAngle/faultDensity/resurfAge/isTessera/coronaActive; no-RNG grep (swap `magma:`→`stagnant:`, `whileCount===0`); AC6 uses `plateReference`/`despunReference` baselines (shell-regime-gate:18-31). Single test file (contract layout), not the shell two-file split.
