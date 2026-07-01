# Increment 4b — Venus stagnant-lid relief writer (`writeStagnantLidReliefSphere`)

**Purpose:** a deterministic, history-data relief writer for the **stagnant-lid silicate** regime —
Venus. A three-free sibling of `plates.js` / `shellRelief.js` that organizes relief about **ONE
seeded mantle-plume field** (tessera crustal plateaus + coronae + a global resurfacing-age datum),
NOT carrier latitude, replacing the `sin²(lat)` zonal fallback for Venus (and any future
stagnant-lid silicate body) **only**, and never touching the validated Earth-like plate path or the
shipped ice-shell path.

**Provenance:** authored 2026-06-30 by working-Claude from the ROADMAP increment-4 planning note
(`ROADMAP.md` §"Planning notes per increment" → Increment 4, `sound=true`) + the increment-4 UAT
rubric card, deepened with web research (Gülcher et al. 2020 *Nat. Geosci.*; Gülcher et al. 2023 &
2025 *JGR Planets*; the 2025 gravity+topography *Science Advances* corona-activity study; Ivanov &
Head Venus stratigraphy; the Magellan tessera survey). Format/depth model:
[`increment-1-shell-relief-DESIGN.md`](increment-1-shell-relief-DESIGN.md) + its pinned-math sibling
[`../world-engine-shell-relief-2026-06-27/SLICE-B-stress-math.md`](../world-engine-shell-relief-2026-06-27/SLICE-B-stress-math.md).
Code ground-truth: `src/worldengine/base/plates.js` (writer template), `.../shellRelief.js` (sibling +
the copy-verbatim `steeredNoise3`), `.../verify.js` (the `regime ∈ {0,1,2}` gate), `planet-lod-rivers.js`
(the dispatch seam), `planet-lod-lab.html` (preset routing).

**Status:** BUILD-READY IN ARCHITECTURE + MATH. Feeds `dev-collab-scope` → `intent.md` + `contract.json`
→ per-AC build verified with `verify-workstream`. This doc pins the mechanism, the analytic profiles,
and the ACs; scoping should carry the §"Sound-check corrections" table into the contract as must-fixes.

---

## Overview + line of sight

**North star (program):** *the COUNT of genuinely distinct, history-coherent worlds visible per
minute* — not toggled shader effects on a historyless substrate. Today Venus (a `NAMED_BODY`,
`archetype=null`, `locked:false` — verified `planet-lod-lab.html:2615`) falls through **every** relief
gate to the despun `sin²(lat)` fallback: the single **most-recognizable non-Earth rocky world** reads
as latitude bands. This increment gives Venus its own history-data relief field so the screensaver
shows the instantly-Venus silhouette — **tessera crustal plateaus, corona rings, and a young basaltic
plains sea** — instead of a smear.

**Player-experience tier / JOURNEY:** BROADEN move — takes one archetype from "same as 8 others" to
"its own world-type." Venus is the 4b half of increment 4 (the 4a active-volcanic half — Io shields /
lava plains / magma-ocean basins — is a separate branch; see Scope-OUT).

**Line of sight in one line:** *distinct-worlds-per-minute → Venus must not read as bands → give it a
plume-organized tessera+coronae+plains relief field → this writer.*

**What ships to `carrier.*` (basis, as data):**

| Field | Written | Meaning |
|---|---|---|
| `carrier.height[i]` | **REPLACE** (`.set(U)`) | tessera plateaus (high) + plains datum (mid) + corona lobes + rift/trench lows. The SOLE low/mid source for Venus. |
| `carrier.grainAngle[i]` | `.set(…)` | tessera fold-fabric strike (fold ⊥ shortening); 0 outside tessera. Parity with `shellRelief` writing `grainAngle`. |
| `carrier.faultDensity[i]` | per-node | normalized deformation intensity (tessera fold+ribbon amplitude, corona ring stress). Activity proxy, parity with plates/shell. |
| `carrier.regime` | **UNTOUCHED** | left exactly as-is — `verify.js:39` asserts `∈ {0,1,2}`; plates/shell leave it alone, so does this. |
| *(diagnostics only)* `resurfAge` | RETURNED | normalized [0,1] resurfacing-age field (1=oldest tessera, ~0.5=regional plains, ~0.1=young lobate flows). PARTIAL-visible (needs a later palette increment); carrier home deferred — see Open decisions. |

Direct-displacement testable in the lab (`reliefBakeStrength=1`) exactly like plates/shell.

---

## Scope — IN / OUT

### IN — one regime: **Venus stagnant-lid silicate** (`venus-stagnant-lid`)
A single coherent plume-field writer covers Venus's three signature structures (tessera, coronae,
resurfacing plains). Lab preset that routes here: **`Venus (sulfuric shroud)`** (`NAMED_BODY`), via a
one-line `PRESET_ARCHETYPE` add (the same seam-fix pattern the shell writer used for Europa/Titan).
Any future stagnant-lid silicate body that carries the coined `stagnant-lid` key routes here too.

### OUT — with reasons (not padded to inflate coverage)
- **Mars** — EXPLICITLY OUT. Mars is a *different* stagnant-lid-rocky shape (Tharsis stationary-hotspot
  rise + preserved ancient cratered highlands + hemispheric dichotomy + aeolian overprint), not a
  tessera+coronae+resurfacing world. It needs its own research pass and its own writer (#4 Tharsis / #5
  bombardment / #6 epoch chapters / #7 aeolian). Forcing Mars through this Venus-shaped writer would be
  physically false and would pollute the structure test. **4b is Venus-only.** (ROADMAP flags this GAP
  2026-06-28.)
- **Earth-like plate path** (`terrestrial`/`ocean`) — UNTOUCHED; the dispatch checks
  `isEarthlikePlatePath` FIRST and returns before any stagnant-lid code (zero-clobber by construction).
- **Ice-shell / despun** (`icy-active`/`volatile-cold`/`eyeball-despun`) — UNTOUCHED; checked second,
  before this. Venus never matches `shellRegimeOf` (not a shell key, and `locked:false` so the shell
  locked-fallback never fires — verified).
- **4a active-volcanic** (Io shields / lava plains / magma-ocean basins — `lava`, `Magma (K2-141b)`) —
  the *other* half of increment 4, a separate branch. Shares the plume seam conceptually but is a
  distinct writer; not built here. When 4a lands, dispatch order becomes plate → shell → volcanic →
  stagnant-lid → despun (see Dispatch).
- **Resurfacing as a simulated time-history** — OUT. Active/inactive coronae are a *morphology
  SELECTOR* (a static end-state), not a time-step; the resurfacing-age field is a datum, not an
  evolution. Generative-not-simulative, exactly like plates/shell.

---

## The seeded mantle-plume field (the organizing primitive)

Everything below is keyed off ONE field — reproducing the **BAT-region causal logic** (Beta–Atla–Themis:
Venus's coronae, rifts, and youngest volcanism cluster over concentrated mantle upwelling), not stickers.
This is the analog of plates' boundary-stress field and shell's despin/diurnal stress field.

### Construction (verbatim-plates discipline)
```
seed = (macroSeed | 0)
// STEP 0 — resolution key (COPIED VERBATIM from plates.js:212-217 / shellRelief STEP 0):
meanEdgeAngle = mean over all adj edges of acos(clamp(-1,1, dot(verts[i], verts[nb])))
// all angular widths below are GEODESIC RADIANS → resolution-independent (600-node ≡ 40k mesh).

// N plume centers from macroSeed (analog of plate centroids):
rngPlume = alea('stagnant:plumes:' + seed)
N_plume  = PLUME_MIN + floor(rngPlume() * PLUME_SPAN)         // default [6, 12)  (see heuristic)
centers[c] = randDir(rngPlume)                                 // copy plates randDir (z=2u-1, azimuth 2πv)

// per-center attributes (drawn in a FIXED order for determinism):
rngType = alea('stagnant:ptype:' + seed)
for c in 0..N_plume-1:
  centerIsAncient[c] = rngType() < TESSERA_CENTER_FRAC         // ancient→tessera cap ; else→corona-forming province
```

### Per-node plume proximity (smooth superposition, NOT hard Voronoi)
Venus's provinces MERGE (the BAT triangle is a broad upwelling swath), so use a nearest-center Gaussian
rather than a Voronoi partition. Domain-warp the sample dir first (irregular provinces, like plates WARP):
```
warp   = createNoise3D(alea('stagnant:warp:' + seed))
for i in 0..N-1:
  d  = verts[i]
  wd = norm( d + WARP_AMP * [warp(d·WARP_FREQ …3 offset lanes…)] )       // == plates domain-warp
  // nearest ancient center and nearest corona-forming center, STRICT '>' tie-break (lowest index wins, == plates):
  bestAnc = bestCor = -Infinity ; idxAnc = idxCor = 0
  for c in centers:
    a = acos(clamp(-1,1, dot(wd, centers[c])))                            // geodesic dist to center c
    p = exp( -(a / PLUME_BELT)^2 )                                         // Gaussian proximity ∈ (0,1]
    if centerIsAncient[c]: if p > bestAnc: bestAnc = p ; idxAnc = c
    else:                  if p > bestCor: bestCor = p ; idxCor = c
  plumeProxAncient[i] = bestAnc     // organizes TESSERA
  plumeProx[i]        = max(bestAnc, bestCor)   // organizes CORONA acceptance + young-flow age
```
`PLUME_BELT ≈ 0.35 rad` (broad provinces). The **strict `>`** matches plates/shell so AC1 byte-identity
holds across mesh orderings.

### Plume-count heuristic
Few, broad provinces (unlike Earth's many plates): major Venus upwelling is concentrated (BAT ≈ 3 loci
plus a handful of distributed rises). `PLUME_MIN=6, PLUME_SPAN=6 ⇒ N_plume ∈ [6,11]`. Rationale, not a
fit: the 740-corona catalog is *populated by* these provinces (many coronae per province, see below),
so the province count is deliberately smaller than the corona count. Swept against the AC2 structure bar
(coronae must correlate with the field) + AC6 variety, exactly as plates sweeps `PLATE_COUNT_*`.

---

## Tessera fabric (old, high, ~7–8% of surface, orthogonal ribbon+fold double-deformation)

**Placement rule — where on the plume field:** tessera = **ancient crustal plateaus** over the OLDEST
plume upwellings (crust thickened over the rise, then froze; stratigraphically oldest, embayed by
plains). Tessera occupies the high-`plumeProxAncient` caps — a DIFFERENT selection of the one field from
coronae (which are discrete annuli over corona-forming centers). This is why the two don't collide:
tessera = broad ancient caps; coronae = discrete recent rings.

**Hitting ~7–8% deterministically:** threshold the ancient-proximity field.
```
isTessera[i] = plumeProxAncient[i] > TESSERA_THRESH
```
`TESSERA_THRESH` is a LOCKED constant tuned so the resulting areal fraction lands in **[0.06, 0.10]**
across seeds — the same "tune a threshold against a structure AC" discipline as plates' `BELT_RADIANS`.
(Deterministic *exact*-fraction alternative if the band proves seed-sensitive: build a 64-bin histogram
of `plumeProxAncient`, pick the percentile threshold for the top `TESSERA_FRAC=0.075` — O(N), no sort,
order-independent. Contract picks one; recommend the fixed threshold first, escalate to the percentile
only if AC2(b) fails variety.)

**The orthogonal ribbon+fold double-deformation as a closed-form height contribution.** Two crossed
anisotropic *ridged* fields, exactly the `steeredNoise3` mechanism `shellRelief` already uses (COPY the
helper verbatim from `tectonic.js:93` — it is module-private there; inline its `REGIME` branch as a
boolean `ridged`, identical to shell's copy). Local strike from the field: **folds strike ⊥ to the
shortening direction**, and shortening over an upwelling is *radial* (toward the ancient center), so:
```
foldAngle[i] = atan2( dot(gradTess, north), dot(gradTess, east) )      // strike of the radial-shortening axis in {east,north}
              // gradTess = tangent-plane gradient of plumeProxAncient at i (finite-diff over adj, projected to {east,north})
tessNoiseF = createNoise3D(alea('stagnant:tessfold:'  + seed))
tessNoiseR = createNoise3D(alea('stagnant:tessribbon:'+ seed))
fold   = steeredNoise3(tessNoiseF, d, east, north, foldAngle[i] + PI/2, /*ridged*/true, FOLD_FREQ)   // long-λ contractional ridges ⊥ shortening
ribbon = steeredNoise3(tessNoiseR, d, east, north, foldAngle[i],        /*ridged*/true, RIBBON_FREQ)  // short-λ extensional lineaments ∥ shortening (orthogonal to folds)
tessTexture[i] = TESS_FOLD_AMP * (fold + 0.5) + TESS_RIBBON_AMP * (ribbon + 0.5)   // both ≥0 lobes on the cap
```
`FOLD_FREQ ≈ 5`, `RIBBON_FREQ ≈ 13` (ribbons finer, the two-scale "tessera" signature). Fold and ribbon
strikes are **orthogonal** (`+π/2` apart) → the crosscutting double-fabric that DEFINES tessera ("two or
more intersecting tectonic elements"). Write `carrier.grainAngle[i] = foldAngle[i]` on tessera nodes.

**Amplitude (1–5 km normalized into the bound).** Real tessera stands ~1–2 km above plains, crustal
plateaus culminate 2–4 km above datum (Magellan survey; medium confidence on exact km — it is normalized,
so it doesn't need to be exact). Map to the writer's normalized band:
```
BASE_TESSERA  = 0.70      // ancient-plateau datum (the "high ground") — analog of plates BASE_CONT=0.36 but higher
TESS_FOLD_AMP = 0.16 ; TESS_RIBBON_AMP = 0.08     // texture << the BASE gap so it can't invert the mean ordering
```
`U_bound` guard `STAGNANT_BOUND = 4` (generous, mirror of plates `U_BOUND`).

---

## Coronae (size distribution, count, active/inactive morphology selector, `CORONA_ACTIVE_FRAC`)

**Placement — organized BY the plume field (not sprinkled).** Draw a POOL of candidate corona sites,
accept each with probability rising in plume proximity → coronae cluster in provinces (the BAT
clustering), count varies by seed (AC6):
```
rngCor = alea('stagnant:corona:' + seed)
for k in 0..CORONA_POOL-1:                          // CORONA_POOL default 48
  site   = randDir(rngCor)
  p      = plumeProx(site)                           // sample the field at the candidate (nearest-center Gaussian)
  if rngCor() < p^CORONA_BIAS:                       // CORONA_BIAS ≈ 1.5 → strong concentration on highs
     accept site as a corona:
       R_c       = coronaRadius(rngCor)              // geodesic radius, from the size distribution below
       isActive  = rngCor() < CORONA_ACTIVE_FRAC     // the MORPHOLOGY SELECTOR
```
The **random-placement control** (AC) replaces `p^CORONA_BIAS` with a constant → coronae ignore the
field → the structure correlation collapses. That control MUST fail; the real writer must pass. (This is
the anti-tautology guard, exactly like shell's gates-disabled variant.)

**Size distribution (60–2600 km).** Venus coronae span ~60 km to Artemis's ~2600 km (classic figure;
newer catalogs give Artemis ~2100–2400 km — medium confidence on the exact ceiling; the median corona is
~200–300 km). Diameters are heavy-tailed (many small, few giant) → inverse power-law draw. Convert km to
geodesic radians with Venus radius `R_V = 6052 km`:
```
D_MIN = 60 ; D_MAX = 2600            // km
u = rngCor()                          // uniform
D = D_MIN * (D_MAX / D_MIN) ^ (u ^ CORONA_SIZE_SKEW)   // CORONA_SIZE_SKEW ≈ 2.5 → most near D_MIN, few giant
R_c = (D / 2) / R_V                   // geodesic radius in radians  (D=200km→0.0165 ; D=2600km→0.215)
```

**Active/inactive morphology as an analytic radial profile.** Let `ρ = geodesicDist(node, center) / R_c`
be the normalized radius. Both profiles are added ON TOP of `BASE_PLAINS` where the corona sits; both are
smooth closed forms (raised-cosine dome + Gaussian annuli). Source: Gülcher 2020 cross-sections.

**ACTIVE** — domed interior + marginal trench + outer rise (plume buoyancy + edge downwelling suction):
```
h_active(ρ) =  A_DOME  * max(0, 1 - (ρ/0.75)^2)                     // buoyant raised interior (peaks at center)
             - A_TRENCH * exp( -((ρ - 0.95)/0.12)^2 )               // annular trench at the rim (deepest ring)
             + A_RISE  * exp( -((ρ - 1.25)/0.18)^2 )                // broad low outer rise
             ,  0 for ρ > 1.6
// A_DOME=0.35, A_TRENCH=0.30, A_RISE=0.12
```

**INACTIVE** — raised rim + interior depression (buoyancy gone; thinned lithosphere sags, rim relict):
```
h_inactive(ρ) = - A_DEP * max(0, 1 - (ρ/0.85)^2)                    // sagged interior depression
               + A_RIM * exp( -((ρ - 0.95)/0.10)^2 )                // annular raised rim
               ,  0 for ρ > 1.3
// A_DEP=0.18, A_RIM=0.22
```
All lobe amplitudes are < the `BASE_TESSERA − BASE_PLAINS` gap, so coronae never invert the tessera>plains
mean ordering. The **active trench annulus** (`ρ≈0.95`, where `h_active` is most negative) is the corona
contribution to the "active-plume/rift" LOW population sampled by the ordering AC (the domed interior is a
*separate* high sub-feature — see the ordering guarantee).

**`CORONA_ACTIVE_FRAC` — resolving the flagged 0.35-vs-~0.70.**
- **0.35 provenance:** Gülcher 2020 (*Nat. Geosci.*) classified **≥37 of 133** large coronae as active on
  **topography alone** (≈0.28, and stated as a *floor* — "at least"). Rounded/conservative → ~0.35.
- **~0.70 provenance:** the 2025 gravity+topography study (*Science Advances*, adt5932) found buoyant
  mantle beneath **52 of 75** *resolved* coronae ≈ **0.69** — gravity reveals active support where
  topography alone is ambiguous. This is the ROADMAP's "resolved-corona literature ~0.70," now sourced.
- **Recommendation: `CORONA_ACTIVE_FRAC = 0.65`** (locked look constant). Anchored to the best resolved
  estimate (0.69) but nudged down so the inactive morphology (rim + depression) still reads as a clearly
  distinct ~35% population rather than a rarity. **This is LOOK-TUNING:** the value only sets the
  active:inactive morphology mix — it changes no physics and no other field. Any value in **[0.35, 0.70]**
  is defensible against the literature; 0.65 is the recommended default, swept only by the headless test.

**Corona count target:** with `CORONA_POOL=48`, `CORONA_BIAS=1.5`, provinces of `PLUME_BELT=0.35`, expect
~14–28 accepted coronae/seed (variety by AC6). Not calibrated to the literal 740 (that's a real-planet
catalog at full resolution); calibrated to *legible density on a screensaver sphere* + the clustering AC.

---

## Resurfacing-age field (~300–700 Myr plains datum, younger lobes near plumes, ~70–80%)

**Representation — a normalized [0,1] age channel** `resurfAge[i]` (1 = oldest):
```
resurfAge[i] =
  isTessera[i]                          ? 0.90 + 0.10*ageNoise   // OLDEST — ancient crustal plateaus (embayed by plains)
  : (inCoronaOrRift[i])                 ? 0.10 + 0.15*ageNoise   // YOUNGEST — fresh corona/rift volcanism
  : clamp01( 0.50 - YOUNG_LOBE_GAIN * plumeProx[i] + 0.12*ageNoise )   // regional plains datum, younger toward plume centers (lobate flows)
// ageNoise = createNoise3D(alea('stagnant:age:'+seed)) sampled at d*AGE_FREQ ; YOUNG_LOBE_GAIN ≈ 0.35
```
This is the *global resurfacing-age datum*: the ~70–80% regional-plains background sits at ~0.5 (the
~300–700 Myr basaltic plains — Ivanov & Head; regional+shield plains ≈70%, basaltic plains ≈80% of the
surface), with **younger lobate flows near plume centers** (age dips toward active provinces) and the
oldest tessera at the top.

**Areal fraction ~70–80% emerges by construction:** plains = complement of tessera (~7–8%) + corona
structures + rift corridors (~12–20%) ⇒ plains ≈ 70–80%. The AC checks `plainsFrac ∈ [0.65, 0.85]`.

**How it feeds elevation ordering:** age is a *companion* field, not the height driver — height is set by
the base constants. Age is *consistent* with the ordering (old tessera = highest; young plains = mid; the
youngest active/rift zones include the lows), so a later palette increment can color by age without
contradicting the relief. `resurfAge` is PARTIAL-visible now (needs palette expression) → returned in
diagnostics; carrier home deferred (Open decision).

---

## Assembly + the elevation-ordering guarantee

```
// LOCKED base constants (ordered by construction):
BASE_TESSERA = 0.70    // ancient plateau high ground
BASE_PLAINS  = 0.10    // basaltic regional-plains datum (analog of plates BASE_OCEAN=0.10)
BASE_RIFT    = -0.25   // rift-corridor / chasma trough floor

for i in 0..N-1:
  base = isTessera[i] ? BASE_TESSERA : (inRift[i] ? BASE_RIFT : BASE_PLAINS)
  tex  = isTessera[i] ? tessTexture[i] : 0
  cor  = Σ over coronae covering i of ( isActive ? h_active(ρ) : h_inactive(ρ) )   // radial profiles, summed if overlap
  det  = DETAIL_AMP * detailNoise(d * DETAIL_FREQ)                                  // sub-grid texture (<< structure), copy plates
  U[i] = base + tex + cor + det

carrier.height.set(U)                       // REPLACE — sole low/mid source for Venus
// bounded fixed RELAX_PASSES Jacobi smooth (double-buffered convex combination, VERBATIM plates:355-363)
// carrier.grainAngle.set(foldAngle) ; carrier.faultDensity[i] = clamp01(deformIntensity[i])
```
**Rift corridors** (the "rift" in "active-plume/rift"): `R_RIFT` great-circle arc segments between the
nearest ancient/active center pairs; nodes within `RIFT_HALFWIDTH ≈ 0.03 rad` of a segment set
`inRift=1` (→ `BASE_RIFT`). Light feature; gives the ordering test a clean linear-low population.

**Why `mean(tessera) > mean(plains) > mean(active-plume/rift)` holds BY CONSTRUCTION:**
1. The three **base constants are strictly ordered**: `BASE_TESSERA(0.70) > BASE_PLAINS(0.10) > BASE_RIFT(-0.25)`.
2. Every texture/lobe amplitude is bounded **smaller than the gaps** between adjacent base constants
   (`TESS_FOLD_AMP+TESS_RIBBON_AMP = 0.24 < 0.60` gap tessera→plains; corona/detail lobes `< 0.35`), so
   no local texture can lift a plains node above the tessera mean or push it below the rift mean.
3. The **ordering AC samples the RIGHT populations** (this is the one clarification the ROADMAP phrase
   "mean(active-plume/rift)" needs — see Sound-check #3): the "active-plume/rift" low population is
   `{inRift nodes} ∪ {active-corona TRENCH-annulus nodes (0.8 ≤ ρ ≤ 1.05)}` — genuinely below plains. It
   is NOT the area-average of a whole active corona (whose broad domed interior is *above* plains); if you
   averaged the entire corona the ordering could fail. Sample the trench/rift lows, and the ordering is
   guaranteed.

So the guarantee is exactly plates' guarantee shape ("convergent ≥ 2× interior via `UPLIFT_GAIN` + a base
step"): ordered base constants + bounded texture + a correctly-scoped sampling population.

---

## Dispatch (`isStagnantLidPath` in `planet-lod-rivers.js`, NOT `base/`)

The **writer** (`writeStagnantLidReliefSphere`) stays three-free in `src/worldengine/base/stagnantLid.js`.
The **dispatch predicate** goes at the `route()`/lab boundary in `planet-lod-rivers.js`, next to
`isEarthlikePlatePath` (:408) and `isShellReliefPath` (:420) — the layer boundary the ROADMAP note pins.

**(A) In `base/stagnantLid.js`** export the regime resolver (mirror of `shellRegimeOf`):
```js
export const STAGNANT_LID_KEYS = new Set(['stagnant-lid', 'venus']);   // coined short key + optional long alias
export function stagnantLidRegimeOf(archetype, locked = false) {
  return STAGNANT_LID_KEYS.has(archetype) ? 'venus-stagnant-lid' : null;   // does NOT gate on `locked`
}
```
> **Do NOT gate on `locked`.** Venus is a slow *retrograde* rotator, `locked:false` (`lab:2615`) — gating
> on `locked` would MISS it (that is precisely the fall-through bug). Key-based match only.

**(B) In `planet-lod-lab.html`** add ONE line to `PRESET_ARCHETYPE` (~line 1902):
```js
'Venus (sulfuric shroud)': 'stagnant-lid',
```
Venus is a `NAMED_BODY`, so `drawPresetRadius` short-circuits on `NAMED_BODY.has(...)` (verified
`lab:1925`) BEFORE reading `PRESET_ARCHETYPE` → **radius stays canonical** (0.95 R⊕), exactly as the
Europa `'ice'` add did not perturb Europa's size. `'stagnant-lid'` is a **coined short key** (exists in no
current vocabulary — like `'volatile'` was coined for Titan); document it as produced by exactly this one
added line. **Single-coverage fragility (mirror the Titan warning):** Venus has NO fallback net (unlocked,
so no locked-fallback anywhere) — drop this one line and Venus silently regresses to `sin²(lat)`. State
this plainly in the contract; AC-seam tests it both ways.

**(C) In `planet-lod-rivers.js`** — `import { writeStagnantLidReliefSphere, stagnantLidRegimeOf }`; export
`isStagnantLidPath`; make `writeBodyRelief` N-way (checked AFTER earthlike + shell, so both are byte-
untouched):
```js
export function isStagnantLidPath(archetype, locked = false) {
  return stagnantLidRegimeOf(archetype, locked) !== null;
}
// inside writeBodyRelief, after the shell block (:439), before the despun fallback (:440):
const slRegime = stagnantLidRegimeOf(archetype, locked);
if (slRegime) {
  const stagnantDiag = writeStagnantLidReliefSphere(carrier, grainDrivers, { macroSeed, regime: slRegime });
  return { path: 'stagnant-lid', plateDiag: null, shellDiag: null, stagnantDiag };
}
```
Thread `stagnantDiag` through `route()` (:1146) and add a `get stagnantDiag()` overlay accessor (sibling
of `get plateDiag()`/`get shellDiag()`) so the live probe can read it.

**Dispatch order (N-way):** `plate → shell → [volcanic 4a] → stagnant-lid → despun-fallback`. Today
(pre-4a) it is `plate → shell → stagnant-lid → despun`. **No collision:** the `stagnant-lid` key is not
`terrestrial`/`ocean` (plate misses), not a `SHELL_REGIMES` key and unlocked (shell misses — the shell
locked-fallback can't fire on an unlocked body), so order after shell is safe. (Note for a *future* locked
stagnant-lid body: either add its key to `SHELL_EXCLUDE` — a `shellRelief.js` edit, OUT of scope for 4b —
or check `isStagnantLidPath` before shell. Venus being unlocked makes this a non-issue now.)

---

## Determinism + carrier discipline

- **`alea` namespace `'stagnant:'`** — disjoint from `'plates:'`, `'shell:'`, `'e6:'`, so it never shares
  a stream. Seed strings (drawn in FIXED order): `'stagnant:plumes:'` (centers+count), `'stagnant:ptype:'`
  (ancient/corona type), `'stagnant:warp:'` (province warp), `'stagnant:corona:'` (site pool + accept gate
  + radius + active/inactive), `'stagnant:tessfold:'` / `'stagnant:tessribbon:'` (double-deform noises),
  `'stagnant:age:'` (young-lobe noise), `'stagnant:detail:'` (sub-grid). All `createNoise3D(alea('stagnant:…:'+seed))`.
- **NO `Math.random` / NO `Date.now`** anywhere, incl. the copied `steeredNoise3`. Same `(macroSeed)` ⇒
  byte-identical `U`, `grainAngle`, `faultDensity`, `resurfAge` (AC1 static-source grep + double-run equality).
- **Render-once:** the determined end-state in ONE pass + a bounded fixed `RELAX_PASSES` Jacobi smooth
  (default 4, verbatim plates convex combination). The only other iteration is O(N) graph work (province
  proximity, rift-corridor distance) — NOT time-stepping, NO convergence while-loop.
- **REPLACE `carrier.height`** via `.set(U)` (`=`, never `+=`) — the sole low/mid source, so no additive
  re-banding.
- **`carrier.regime` UNTOUCHED** — `verify.js:39` asserts `∈ {0,1,2}`; introduce NO 4th regime constant
  (the archetype-string "stagnant-lid" regime is a different concept from the per-node Anderson field, as
  the 4.5 note warns). Plates/shell leave `carrier.regime` alone; so does this.
- **NO edits to `plates.js` or `shellRelief.js`** (copy `steeredNoise3` + the vec3 helpers + `randDir` +
  `meanEdgeAngle` verbatim into `stagnantLid.js`, as shell copied from plates). NO edits to `tectonic.js`,
  `sphereField.js`, `verify.js`, `planet-archetypes.js`.

---

## Diagnostics + live `stagnantLidProbe`

**RETURNS** (peer of `plateDiag`/`shellDiag`, so the structure test + live probe PROVE the field is real,
arm's-length):
```
{
  U:Float32Array, regime:'venus-stagnant-lid',
  plumeCenters:[[x,y,z]…], centerIsAncient:Uint8Array, plumeCount:int,   // GEOMETRIC labels for the arm's-length predictor
  isTessera:Uint8Array, tesseraFrac:number,
  coronaCenters:[[x,y,z]…], coronaRadius:Float32Array, coronaActive:Uint8Array, coronaCount:int, activeFrac:number,
  inRift:Uint8Array, plainsFrac:number,
  resurfAge:Float32Array, deformIntensity:Float32Array, foldAngle:Float32Array,
  meanEdgeAngle:number, relaxPasses:int
}
```
`plumeCenters` is **load-bearing** (like shell's `w0`): it lets the probe rebuild plume proximity
**arm's-length** and prove structure sits on the field — while the random-placement control (coronae/
tessera ignoring the field) fails the same test, so it is not a tautology.

**LIVE `stagnantLidProbe()`** — sibling of `plateProbe()`/`shellProbe()` in `planet-lod-lab.html`, reading
`riverOverlay.stagnantDiag`. Precondition: `reliefBakeStrength(>0)` + route on `Venus (sulfuric shroud)`,
else `heightSource=='sampler'`. Rebuilds predictors ARM'S-LENGTH from the geometric labels:
- `plumeProxPredictor[i]` — rebuilt from `plumeCenters` (nearest-center Gaussian), independent of `U`.
- `varExplainedByPlume = corr(structureMask, plumeProxPredictor)²` where `structureMask` = tessera∪corona
  membership — must be HIGH, and **>> the random control**.
- `varExplainedByLatitude = corr(U, sin²(carrier lat about +y))²` — must be LOW (falsifier vs `sin²`).
- `meanTessera / meanPlains / meanRiftTrench` (over the correctly-scoped masks) — assert the ordering.
- `tesseraFrac ∈ [0.06,0.10]`, `plainsFrac ∈ [0.65,0.85]`, `activeFrac ≈ CORONA_ACTIVE_FRAC ± 0.12`.
- corona radial-profile signature check: at a sample of active coronae, `h(ρ≈0)>0` (dome) & `h(ρ≈0.95)<0`
  (trench) & `h(ρ≈1.25)>0` (rise); at inactive, `h(ρ≈0)<0` (depression) & `h(ρ≈0.95)>0` (rim).
Returns `{ heightSource, regime, plumeCount, coronaCount, tesseraFrac, plainsFrac, activeFrac,
varExplainedByPlume, varExplainedByLatitude, meanTessera, meanPlains, meanRiftTrench, U:Array }`.
Despun-fallback case returns a note (no `stagnantDiag`), mirroring `plateProbe`'s null branch.

---

## Proposed basis-level ACs (mirror the shell-relief AC pattern, Venus-adapted)

Each stated **input → observable**. Sweep `SEEDS=[1,2,3,7,42]`, regime `venus-stagnant-lid`, on a shared
600-node carrier; rebuild EVERY predictor arm's-length from published diagnostics (never the writer's
internal scalar).

- **AC1 — DETERMINISM + NO-RNG.** *Input:* static grep of `stagnantLid.js` for `/Math\.random|Date\.now/`;
  run `writeStagnantLidReliefSphere` twice on the same fresh carrier per seed. *Observable:* zero matches;
  byte-identical `U`/`grainAngle`/`faultDensity`/`resurfAge`/`isTessera`/`coronaActive` (Float32/typed
  equality); `|U| < STAGNANT_BOUND` for all nodes.
- **AC2 — STRUCTURE BAR (must PASS).** *Input:* the field per seed. *Observable:* (a) coronae+tessera
  organized BY the plume field — `varExplainedByPlume ≥ 0.5` (arm's-length `plumeCenters` predictor);
  (b) `tesseraFrac ∈ [0.06,0.10]` AND `plainsFrac ∈ [0.65,0.85]`; (c) **elevation ordering**
  `meanTessera > meanPlains > meanRiftTrench` (masks scoped as in the ordering guarantee); (d) the
  active/inactive **morphology selector** is present — sampled active coronae show dome+trench+rise,
  inactive show depression+rim (radial-profile signs above); (e) `activeFrac ≈ CORONA_ACTIVE_FRAC ± 0.12`.
- **AC3 — LATITUDE CONTROL (must FAIL).** *Input:* `U` vs `sin²(carrier lat)`. *Observable:*
  `varExplainedByLatitude < 0.15` AND `< varExplainedByPlume`, all seeds. The load-bearing falsifier:
  **Venus does NOT fall to `sin²(lat)`** — tessera/coronae are plume-scattered, not banded.
- **AC-RANDOM (control must FAIL).** *Input:* a writer variant that places coronae+tessera by pure RNG
  (accept-gate = constant, `TESSERA_THRESH` on an independent noise field, ignoring `plumeProx`).
  *Observable:* `varExplainedByPlume` collapses `< 0.15` and AC2(a) FAILS for the control — proving the
  real placement is causally plume-organized, not sprinkled.
- **AC-VARIETY.** *Input:* two seeds. *Observable:* different `plumeCount` AND `coronaCount` AND a visibly
  different tessera pattern (`< 0.2` node-overlap of `isTessera`), each reproducible per seed.
- **AC-NO-CLOBBER (plate / shell / despun).** *Input:* `writeBodyRelief` with `terrestrial` (→plate),
  `ice` (→shell), `gas-giant` unlocked (→despun). *Observable:* each routes to its prior path and returns
  `stagnantDiag:null`; plate `U` + shell `U` + despun `U` byte-identical to captured baselines.
- **AC-SEAM-FIRES.** *Input:* the lab dispatch on `Venus (sulfuric shroud)`. *Observable:* WITH the
  `PRESET_ARCHETYPE` line, Venus → `path:'stagnant-lid'`, regime `venus-stagnant-lid`, does NOT fall to
  `sin²`; WITHOUT the line, Venus (`archetype=null, locked:false`) has NO fallback net and routes to
  `path:'despun'` (documents the single-coverage fragility — the contract must keep the line).
- **AC-LIVE-PROBE.** *Input:* chrome-devtools on the lab (`list_pages` for liveness, per
  `sandbox-localhost-probe`), select Venus, `setSeed(1234); reliefBakeStrength(1)`, `stagnantLidProbe()`.
  *Observable:* `heightSource=='carrier'`, `varExplainedByPlume > varExplainedByLatitude`, ordering holds,
  `tesseraFrac`/`plainsFrac`/`activeFrac` in-band; screenshot shows tessera plateaus + corona rings +
  plains (NOT `sin²` bands) — visual verification by the agent, not asked of Max.
- **AC-UAT (Max's gate alone).** Does Venus read as a distinct, recognizably-Venus world from the user's
  view? **Deferred-to-max** — no agent closes it (`VERIFIED_PENDING_MAX <sha>` on integration green, then
  Max UAT → Shipped).

---

## Sound-check corrections (adversarial pass over the ROADMAP note — carry into the contract)

Each ROADMAP mechanism claim, marked `sound=true` (buildable as stated) or a needed correction.

| # | Claim | Verdict | Note |
|---|---|---|---|
| 1 | Three structures keyed off ONE seeded plume field (tessera / coronae / resurfacing) | **sound=true** | Reproduced as tessera=ancient-center caps, coronae=field-biased annuli, plains=complement, age=field-derived. One field, three selections. |
| 2 | Coronae 60–2600 km, active vs inactive morphology selector | **sound=true** | Active=dome+trench+rise, inactive=rim+depression confirmed (Gülcher 2020). 2600 km is Artemis-specific (newer catalogs ~2100–2400); median ~200–300 km. Kept 60–2600 as the draw range; medium confidence on the ceiling. |
| 3 | `mean(tessera) > mean(plains) > mean(active-plume/rift)` | **sound=true, WITH a required scoping fix** | The "active-plume/rift" low population must be sampled as `{rift corridors} ∪ {active-corona trench annulus}` — NOT the area-average of a whole active corona (its domed interior is *above* plains; averaging the whole corona could invert the ordering). The AC + probe must scope the mask this way. Pinned in the ordering guarantee. |
| 4 | Tessera ~7–8%, 1–5 km, orthogonal ribbon+fold double-deformation | **sound=true** (amplitude adjusted) | 7–8% confirmed. Real elevation ~1–2 km above plains / crustal plateaus 2–4 km above datum — "1–5 km" is high on the top end but irrelevant once normalized; used a normalized `BASE_TESSERA=0.70`. Double-fabric = two orthogonal `steeredNoise3` ridged fields. |
| 5 | `CORONA_ACTIVE_FRAC ~0.35 too low; literature ~0.70; flag as look-tuning` | **sound=true; RESOLVED** | 0.35 = Gülcher 2020 topography-only floor (37/133≈0.28); 0.70 = 2025 gravity+topography (52/75≈0.69). **Recommend 0.65**, stated as look-tuning; any value in [0.35,0.70] defensible. |
| 6 | "copy template from `plates.js`, NOT the unbuilt `shellRelief.js`" | **sound=false (stale fact)** | `shellRelief.js` is now BUILT (`VERIFIED_PENDING_MAX 54ea74d`) and is a *useful second template* (source of the copy-verbatim `steeredNoise3` for the tessera double-fabric + the province/BFS pattern). Primary structural template stays `plates.js` (centroids→proximity→base-elevation step); copy `steeredNoise3` from `tectonic.js`/`shellRelief.js`. |
| 7 | "today's dispatch is 2-way, so this makes it 3-way" | **sound=false (stale fact)** | Dispatch is ALREADY 3-way post-shell (`plate → shell → despun`, `rivers.js:427–442`). 4b makes it **4-way** now (`…→ stagnant-lid → despun`), **5-way** once 4a volcanic lands. Predicate placement (in `rivers.js`, not `base/`) is unchanged and correct. |
| 8 | `isStagnantLidPath` in `planet-lod-rivers.js` next to `isEarthlikePlatePath`, writer three-free in `base/` | **sound=true** | Matches the shipped `isShellReliefPath` pattern exactly. |

---

## Open decisions for Max

- **(1) `CORONA_ACTIVE_FRAC` value.** *Recommendation:* **0.65** (sourced to the 2025 gravity+topography
  52/75≈0.69, nudged down so inactive coronae stay a visible ~35% population). Pure look-tuning; any
  value in [0.35, 0.70] is literature-defensible. *Proceeding with 0.65 unless Max prefers another point
  in the range.*
- **(2) Resurfacing-age carrier home.** *Recommendation:* keep `resurfAge` in the **diagnostics object
  only** for 4b (age is PARTIAL-visible — it needs a later palette increment to render; there is no
  basis-level UAT that requires a carrier channel now). Defer a dedicated `carrier.resurfAge` channel to
  the E12 palette increment, to avoid the `maturity`/`baseLevel`/`standing` channel-collision the 5.5 note
  warns about, and to avoid overloading `grainMag`. *Flagging because it is a small architecture choice
  Max may want to make now if the palette increment is near.*
- **(3) Coined short key string.** Recommend `'stagnant-lid'` (parallel to the coined `'volatile'`). Trivial;
  flagging only so the contract fixes the exact literal a dev would grep for.
- **(4) Mars is OUT of 4b** — restated as a non-decision: Mars needs its own stagnant-lid-*rocky* research
  pass (Tharsis + cratered highlands + dichotomy), not this Venus-shaped writer. No action here; noted so
  the "Venus stagnant-lid" label is never mistaken for "all stagnant-lid worlds."

---

## Sources (with per-claim confidence)

- **Gülcher, A. J. P. et al. (2020), "Corona structures driven by plume–lithosphere interactions and
  evidence for ongoing plume activity on Venus," *Nature Geoscience* 13, 547–554**
  (nature.com/articles/s41561-020-0606-1; Springer Nature community post). Active vs inactive corona
  cross-sections (active = elevated interior + outer trench + outer rise; inactive = outer rim + inner
  depression); **133 large coronae analyzed, ≥37 active** (topography-only floor ≈0.28). *Confidence: HIGH*
  for the morphology signatures; *HIGH* for the counts.
- **The corona gravity+topography study (2025), *Science Advances* (doi:10.1126/sciadv.adt5932; PubMed
  40367154).** **52 of 75 resolved coronae** show buoyant mantle / active support ≈ **0.69** — the sourced
  "~0.70." *Confidence: HIGH* for the 52/75 figure (via PubMed abstract; full text paywalled).
- **Gülcher, A. J. P. et al. (2025), "Coronae on Venus: An Updated Global Database…," *JGR Planets*
  (doi:10.1029/2024JE008749); Gülcher et al. (2023) *JGR Planets* (doi:10.1029/2023JE007978).**
  **~740–741 coronae**, diameters **60 to >2000 km** (Artemis ~2100 km in the new catalog), coronae ≈9.5%
  of the surface. *Confidence: HIGH* for count/coverage; *MEDIUM* for the exact 2600 km ceiling (older refs
  cite Artemis ~2400–2600 km; used as the rare tail). Full text paywalled — figures via search abstracts.
- **Ivanov, M. A. & Head, J. W. — Venus global stratigraphy / regional-plains mapping** (e.g.
  "Global Stratigraphy and Resurfacing History of Venus," Springer 2023; regional-plains units rp1/rp2).
  Regional+shield plains ≈70%, basaltic plains ≈80% of the surface; surface age <1 Ga, possibly <300 Ma
  (Strom et al. 1994 catastrophic/equilibrium resurfacing frames the 300–700 Myr datum). *Confidence: HIGH*
  for the ~70–80% coverage; *MEDIUM* for the exact 300–700 Myr band (model-dependent; mean-age estimates
  range ~150–750 Myr).
- **Magellan tessera survey — Ivanov & Head (1996), "Tessera terrain on Venus…," *JGR* 101, 14861;
  Tessera (Venus) / crustal-plateau literature.** Tessera **7–8%** of the surface (~8%, ~35×10⁶ km²),
  stratigraphically oldest, highest, multiply-deformed ("two or more intersecting tectonic elements" =
  fold-thrust belts crosscut by ribbons/grabens = the orthogonal double-fabric); stands **~1–2 km above
  plains**, crustal plateaus culminate **2–4 km above datum**. *Confidence: HIGH* for the 7–8% and the
  double-deformation; *MEDIUM* for the exact elevation (normalized in the writer, so not load-bearing).
- **BAT (Beta–Atla–Themis) region** as the type example of concentrated active mantle upwelling
  (coronae + rifts + young volcanism clustering) — standard Venus interpretation. *Confidence: HIGH* for
  the qualitative clustering used by the placement mechanism.

---

## Build intent (record-build-intent)

**Function:** a three-free deterministic writer that gives Venus (stagnant-lid silicate) a real
history-data relief field — tessera crustal plateaus + coronae (active/inactive morphology selector) +
a resurfacing-age plains datum — all keyed off ONE seeded mantle-plume field, REPLACING `carrier.height`.
**Intent:** replace the `sin²(lat)` fallback for the most-recognizable non-Earth rocky world, as a
sibling writer that zero-clobbers the plate and ice-shell paths. **Deliberate non-goals:** NOT Mars (a
different stagnant-lid-rocky shape — own writer); NOT the 4a active-volcanic branch; NOT a simulated
resurfacing time-history (morphology is a static selector); seed-only (driver-response deferred to the
`tune`/`drivers` seam); no new `carrier.regime` constant; `resurfAge` carrier channel deferred.
