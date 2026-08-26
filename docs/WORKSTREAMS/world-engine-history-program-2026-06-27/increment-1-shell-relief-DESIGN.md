# Increment 1 — Despun / Ice-Shell relief writer (`writeShellReliefSphere`)

**Purpose:** a deterministic, history-data relief writer for icy / despun / tidally-locked
shells — a sibling of `plates.js` that organizes relief about a *seeded paleo-spin / tidal frame*
(NOT carrier latitude), replacing the `sin²(lat)` zonal fallback for those bodies **only** and
never touching the validated Earth-like plate path.

**Provenance:** synthesized 2026-06-27 from the despun-writer design workflow (run `w5wc97m7d`):
3 mechanism approaches → adversarial critique → synthesis → build-readiness critic. This doc is the
direct input to a later `dev-collab-scope` pass — it becomes `intent.md` + `contract.json`. The
**MUST-FIX** section at the end is the build-readiness critic's hole list, reproduced faithfully;
it is the must-pin checklist for scoping, NOT optional polish.

---

## Status

**BUILD-READY IN ARCHITECTURE, NOT YET A CONTRACT.**

The critic's verdict, near-verbatim:

> BUILDABLE IN ARCHITECTURE, NOT YET AS A CONTRACT. The seam analysis is correct and verified
> against ground truth: the lab passes short-keys-or-null + `locked` (`world-engine-lab.html:3655-3656`),
> Europa/Titan are `NAMED_BODY` so today they arrive as `archetype=null` (the latent "never-fires" bug
> is real), and the two-line `PRESET_ARCHETYPE` fix + `shellRegimeOf` predicate genuinely resolves it.
> The 3-way dispatch (earthlike-first, then `shellRegimeOf`, then despun) is clean and zero-clobbers
> the validated plate path. The AC4 tilted-w0-band falsifier is a real, constructible improvement over
> a +y-only control.
>
> **THE SINGLE MOST IMPORTANT FIX:** specify the stress-field mathematics concretely — the despin
> membrane-stress closed form, the diurnal stress as `f(angle, phi0)` with its position-dependent
> principal-axis rotation, the symmetric 2×2 diagonalization formula, the stress normalization into
> the threshold band, AND the rule that converts the continuous ridged field `R` into the discrete
> `lineamentNode` set (which the double-ridge cross-section, the BFS predictor, and AC2/AC4 all depend
> on). Without these the writer is underdetermined — two developers produce different fields and the
> structure ACs have no anchor.

This DESIGN + the MUST-FIX list feed `dev-collab-scope`, which pins the math and the secondary
must-fixes into the contract before any per-AC build.

---

## Goal & why (north-star tie)

**Line of sight:** Well Dipper is a screensaver-class procedural-planet engine whose driving outcome
is *genuinely distinct world-types at a glance*. Today every non-Earth-like body falls back to the
same `sin²(lat)` latitude-band relief — Europa, Titan, a locked eyeball, and a frozen airless rock all
read as the same zonal smear. This increment is the highest variety-per-effort move on the board: it
gives the icy / despun / locked regimes a **real** history-data relief field so the screensaver shows
Europa cycloid + double-ridge + chaos shells, despun-lineament eyeballs, and cantaloupe volatile-cold
terrain instead of bands.

From `result.design.goal`:

> Give the icy/despun/locked-shell regimes a REAL deterministic history-data relief field — organized
> about a seeded paleo-spin/tidal frame, NOT carrier latitude — so the screensaver shows genuinely
> distinct world-types (Europa cycloid+double-ridge+chaos shells, despun-lineament eyeballs, cantaloupe
> volatile-cold) instead of the `sin²(lat)` zonal fallback. It REPLACES `carrier.height` for those
> bodies only and NEVER touches the validated Earth-like plate path (sibling writer, lower risk).
> Seed-only this increment; driver-ready via the same `tune`/drivers seam plates.js uses.

**Risk posture (why a sibling writer):** being a sibling of `plates.js` — a new file
`src/worldengine/base/shellRelief.js`, gated AFTER `isEarthlikePlatePath` returns false — means the
validated Earth-like plate path is byte-untouched. Zero-clobber by construction; lower risk than
threading new behavior into the existing path.

**Seed-only this increment.** The `drivers` bundle is accepted for signature parity (and `void`ed),
exactly as `plates.js` shipped. Driver-RESPONSE is the NEXT increment, via the same `tune` / `drivers`
seam.

---

## Scope — IN (3 regimes) / OUT (with reasons)

One coherent stress-tensor + convection-cell writer faithfully covers **three** regime families. The
honest count is 3 — not padded to inflate archetype coverage. From `result.design.regimeScope`:

### IN — 3 regimes (selected by a chaos-vs-lineament WEIGHT split keyed off a normalized regime tag)

- **icy-active (Europa-class)** — the richest case: both diurnal-tidal AND despin stress strong.
  Cycloid + double-ridge lineament network + masked chaos in convection-cell interiors.
  Lab presets: *Europa (icy moon)* and *Frozen (airless)*.
- **volatile-cold (Triton/Pluto cantaloupe)** — despin lineaments + convection-cell partition
  DOMINATE (diurnal weak — far from primary). Cell-interior chaos reads as cantaloupe / diapir terrain.
  Lab preset: *Titan (methane seas)*.
- **eyeball-despun (locked rocky/icy "eyeball", despin-lineament-dominant)** — despin produces a global
  lineament field about the seeded paleo-axis; chaos weight ~0 (no ductile convecting ice shell).
  Lab preset: *Eyeball (locked temperate)*.

### OUT — with reasons (NOT padded to inflate archetype count)

- **Earth-like terrestrial / ocean** — UNTOUCHED. The plate path keeps its validated route; the entire
  point of being a sibling writer is lower risk and zero-clobber.
- **Venus-like stagnant-lid SILICATE** (canonical tectonic-terrestrial/volcanic "Venus" preset) —
  tessera + coronae + global volcanic resurfacing is a mantle-plume / resurfacing primitive with NO
  ice shell and NO despin-lineament organizing field — belongs to the later **E7 volcanism** increment.
  Forcing it through a tidal-stress writer would be physically false AND would pollute the structure
  test. EXCLUDED.
- **exotic-shattered (Miranda / Conamara-superficially-similar)** — catastrophic shatter-then-reassemble
  is a DIFFERENT primitive (already its own archetype per `archetypes.js` F45 reasoning); it needs a
  dedicated block-jumble writer. EXCLUDED.
- **impact-airless (Moon/Mercury, unlocked)** — relief primitive is cratering (F2/F3 additive), not a
  convective/despin history. Keeps the despun zonal fallback. EXCLUDED. *(Note: a locked-impact-airless
  body would qualify as a despun-lineament case, but NO lab preset is both impact-airless AND locked, so
  it is not wired this increment.)*
- **gas-giant / hot-jupiter / sub-neptune** (no solid shell), **exotic-carbon** (mineralogy overlay),
  **exotic-geometric** (facet/hex tiling overlay), **technogenic** (engineered overlay) — distinct
  primitives, not stress relief. EXCLUDED.

---

## Archetype-key resolution (the blocker, resolved)

From `result.design.archetypeKeyResolution`, with the critic's corrections folded in.

**THE BLOCKER:** three vocabularies exist —
1. canonical **LONG** keys in `planet-archetypes.js` (`icy-active`, `volatile-cold`, …);
2. lab **SHORT** keys in `PRESET_ARCHETYPE` (`ice`, `eyeball`, …);
3. the gate matches whatever `route()` is passed.

**Ground truth (verified):** the lab dispatch (`world-engine-lab.html:3655-3656`) passes
`archetype: PRESET_ARCHETYPE[_preset] || null` and `locked: !!(...tidalState.locked)`. So today the
writer would receive a MIX of short keys and `null` — **never the long keys** (those live only in
`planet-archetypes.js`, never threaded to `route()`). Per target preset:

| Lab preset | today's `archetype` | `locked` | source |
|---|---|---|---|
| *Frozen (airless)* | `'ice'` | `false` | `PRESET_ARCHETYPE` (lab:1905); preset locked:false (lab:2597) |
| *Eyeball (locked temperate)* | `'eyeball'` | `true` | `PRESET_ARCHETYPE` (lab:1910); preset locked:true (lab:2635) |
| *Europa (icy moon)* | **`null`** | `true` | NOT in `PRESET_ARCHETYPE` — it is a `NAMED_BODY` (lab:1897); locked:true (lab:2603) |
| *Titan (methane seas)* | **`null`** | `false` | `NAMED_BODY` (lab:1897), not in `PRESET_ARCHETYPE`; locked:**false** (lab:2596) |

→ The Europa/Titan `archetype=null` rows are **the latent "writer never fires" bug** the critic flagged.
Today they would silently drop to `sin²(lat)`.

### RESOLUTION — one canonical predicate + one additive map; fix the seam in TWO concrete places

**(A) In `shellRelief.js`** export a single source-of-truth map `SHELL_REGIMES` accepting BOTH
vocabularies and returning a normalized regime tag or `null`:

```js
const SHELL_REGIMES = Object.freeze({
  'ice':'icy-active', 'eyeball':'eyeball-despun', 'volatile':'volatile-cold',   // short lab keys
  'icy-active':'icy-active', 'volatile-cold':'volatile-cold',                    // canonical long keys (future caller / game-port parity)
});
```

and `shellRegimeOf(archetype, locked)`:
1. if `SHELL_REGIMES[archetype]` → return it;
2. ELSE if (`locked` && archetype is null-or-not-an-earthlike-or-gas key) → return `'eyeball-despun'` —
   the **locked-fallback** that catches the `archetype=null + locked=true` Europa-class fall-through so a
   locked icy/rocky body still routes here instead of silently dropping to `sin²(lat)`;
3. else return `null`. (gas/earthlike are claimed by the plate gate **or** by an explicit
   **`SHELL_EXCLUDE`** set inside `shellRegimeOf` so a locked gas giant never matches — see MUST-FIX
   "Dispatch safety", where `SHELL_EXCLUDE` is enumerated.)

**(B) Fix the lab seam** so the flagship preset carries a real key rather than leaning only on the
locked-fallback — ADD to `PRESET_ARCHETYPE` in `world-engine-lab.html` (~line 1901):

```js
'Europa (icy moon)': 'ice',
'Titan (methane seas)': 'volatile',
```

Titan is volatile-cold; mapping it to `'volatile'` is the honest tag. These one-line-each seam fixes
make Europa dispatch a real `icy-active` tag instead of leaning on the locked-fallback, and route Titan
deterministically even though it is unlocked.

**(C) In `planet-lod-rivers.js`** add
`export function isShellReliefPath(archetype, locked){ return shellRegimeOf(archetype, locked) !== null; }`
and make `writeBodyRelief` 3-way (see Carrier interface). The predicate is checked **AFTER**
`isEarthlikePlatePath` so the earthlike path is untouched (no-clobber AC). The normalized tag
(`icy-active | volatile-cold | eyeball-despun`) is passed into `writeShellReliefSphere` via `opts.regime`
and selects the chaos-vs-lineament weight split.

**NET:** dispatch fires for `ice`/`eyeball` (short keys), `icy-active`/`volatile-cold` (long keys,
future/game), AND the `archetype=null + locked` Europa fall-through (locked-fallback + the additive lab
map). One map, one predicate, documented in one place.

### Critic's corrections to this resolution (carry these into the contract)

- **`'volatile'` is a COINED new short key.** It exists in **no** current vocabulary — `PRESET_ARCHETYPE`
  has no `'volatile'`; `planet-archetypes.js` uses the long `'volatile-cold'`. The design INVENTS this
  4th short key solely for Titan. That is fine, but it must be documented as a **new coinage**, not
  framed as "accepts both existing vocabularies." A dev grepping for where `'volatile'` is *produced*
  will find only the one added `PRESET_ARCHETYPE` line.
- **Titan is single-covered.** Europa is **double-covered** (map entry + locked-fallback, since
  locked:true). Titan is **single-covered by the map line ONLY** — it is locked:**false**, so the
  locked-fallback does NOT fire for it. If the `'Titan (methane seas)':'volatile'` map edit is dropped,
  Titan silently regresses to `sin²(lat)` bands (it has zero fallback net). AC9's phrasing ("Europa
  still routes via locked-fallback") is true for Europa but must NOT be read as covering Titan.

---

## Generative mechanism (build-ready algorithm)

From `result.design.generativeMechanism`. **Three-free** (imports only `alea`, `simplex-noise`, and
`clamp`/`mix`/`smoothstep` from `mathutil.js` — NEVER `three`). **Deterministic:** every draw via
`alea(seedString)` keyed off `seed=(macroSeed|0)`; NO `Math.random` / NO `Date.now` anywhere incl.
helpers. **Generative-not-simulative:** places the determined END-STATE in ONE pass + a bounded fixed
`RELAX_PASSES` Jacobi smooth (verbatim the `plates.js` `h*0.5 + mean*0.5` double-buffered convex
combination — cannot expand the bound). The ONLY iteration besides relaxation is an O(N) multi-source
BFS queue drain (every node enqueued once), copied from `plates.js` — NOT time-stepping.

**Signature** mirrors plates: `writeShellReliefSphere(carrier, drivers={}, { macroSeed=0,
regime='icy-active', tune=null })`. `void drivers` this increment. Copy the vec3 helpers
(`dot`/`cross`/`norm`/`randDir`/`falloffAng`) and the `meanEdgeAngle` computation **verbatim** from
`plates.js` for resolution-independence.

### Regime weights (the chaos-vs-lineament split, from the normalized tag) in `SHELL_DEFAULTS`

```
icy-active     -> { DESPIN_W:0.7, DIURNAL_W:1.0,  CHAOS_W:1.0 }   // cycloids + double-ridges + masked chaos
volatile-cold  -> { DESPIN_W:1.0, DIURNAL_W:0.15, CHAOS_W:0.8 }   // despin lineaments + cantaloupe cells dominate
eyeball-despun -> { DESPIN_W:1.0, DIURNAL_W:0.0,  CHAOS_W:0.0 }   // despin lineament field only; no convecting shell
```

### Alea seed strings (distinct `'shell:'` namespace so it NEVER collides with plates' `'plates:'`)

| seed string | role |
|---|---|
| `'shell:axis:'+seed` | `w0 = randDir(rng)` — the seeded **PALEO-SPIN axis**. Despin stress is organized about THIS random world vector, NOT carrier +y. This is what makes the field non-latitude-aligned (the whole point). |
| `'shell:tidal:'+seed` | `t_hat = randDir(rng)` — the sub-parent (permanent-bulge) axis the diurnal stress oscillates about. |
| `'shell:nsr:'+seed` | `phi0 ∈ [0,2π)` (one draw) — the frozen-in nonsynchronous-rotation / diurnal phase; rotates the diurnal trajectories so cycloids don't all share one phase, and so two seeds differ. |
| `'shell:cells:'+seed` | `K` convection-cell centroids (`K = CELL_MIN + floor(rng()*CELL_SPAN)`, defaults `MIN:9 SPAN:9` ⇒ `[9,18]`; finer than 7–13 plates) + per-cell polarity in `{-1,+1}` + per-cell vigor. |
| `'shell:lineament:'+seed` | per-lineament nucleation/polarity draws (secondary; mostly the steered-noise does the work). |
| `createNoise3D('shell:warp:'+seed)` | domain-warp of stress trajectories (irregular, non-great-circle traces — same role as plates `WARP`). |
| `createNoise3D('shell:detail:'+seed)` | sub-grid texture so interiors aren't perfectly flat (`DETAIL_AMP` << structure). |
| `createNoise3D('shell:chaos:'+seed)` | intra-cell chaos-block roughness. |
| `createNoise3D('shell:ridge:'+seed)` | the steered ridged-noise sampled along `theta_traj` (the lineament carrier). |

### STEP 0 — RESOLUTION KEY

`meanEdgeAngle = mean acos(clamp(-1,1,dot(verts[i],verts[nb])))` over all `adj` edges (verbatim
`plates.js:126-131`). ALL angular widths below are in **GEODESIC RADIANS**, converted to BFS hops via
`meanEdgeAngle`, so widths are IDENTICAL on the 600-node carrier and the ~40k lab mesh.

### STEP 1 — STRESS TENSOR FIELD (the organizing primitive; analog of plates' boundary stress)

At each node dir `d`, build a 2×2 surface stress in the carrier tangent frame
`{east,north} = carrier.tangentFrameAt(i)`:

- **(a) DESPIN term:** `colat_w = angle(d, w0)`. A spinning-down body relaxes rotational flattening →
  a closed-form membrane stress `sigma_despin(colat_w)`: TENSILE longitudinally near the paleo-equator,
  compressive in a polar cap (classic despin global-lineament pattern). Principal directions =
  `(meridian_w, parallel_w)` of the paleo-spin frame (NOT the carrier frame). Scale by `DESPIN_W`.
- **(b) DIURNAL term:** sample at the FROZEN phase `theta=phi0` about `t_hat`:
  `sigma_tidal(angle(d, t_hat), theta)` whose principal axes **ROTATE with position** (this rotation
  curves cycloids in step 3). Scale by `DIURNAL_W`.
- **(c) SUM** the two tensors in the common carrier tangent frame; domain-warp the input dir by
  `createNoise3D('shell:warp')` so traces are irregular. **Diagonalize** the summed 2×2 → per node:
  `sigma1` (max-tensile, SIGNED) and `theta_traj` (the most-tensile principal-axis angle in the tangent
  frame). Store `sigma1 → stressTensile[i]` (diagnostic); `theta_traj → carrier.grainAngle[i]` (reuse
  the carrier grain channel exactly as the despun fallback writes `grainAngle` — the lineament STRIKE).

> ⚠ The closed forms for `sigma_despin`, `sigma_tidal`, AND the 2×2 diagonalization are NOT specified
> in the source design — this is MUST-FIX #1. See that section for what must be pinned.

### STEP 2 — CONVECTION-CELL PARTITION (secondary; only when `CHAOS_W>0`)

Spherical-Voronoi over the `K` warped centroids (nearest-by-max-dot, identical to plates Voronoi).
`cellId[i]`. `cellDist` via the SAME multi-source BFS distance transform (O(N) queue drain). Cell
INTERIORS (far from cell edges) = upwelling/chaos candidates; cell EDGES = downwelling sutures.
`cellInteriorness[i]` derived from `cellDist*meanEdgeAngle` via `falloffAng`.

### STEP 3 — PLACE LINEAMENTS (generative end-state, analog of plates writing uplift at boundaries)

Build ridge potential `R[i] = steeredNoise(createNoise3D('shell:ridge'))` steered along `theta_traj`
using the SAME anisotropic-ridged transform `tectonic.js` already ships (the `|n|-0.5 / 0.5-|n|` ridged
regime + along/across anisotropy), then GATE by `smoothstep(sigma1 over TENSILE_THRESH)`. Where `R`
crosses its crest → a CRACK. Write a fixed analytic **DOUBLE-RIDGE cross-section** as a function of
across-strike phase: a narrow central trough flanked by two positive shoulders (Europa double-ridge
signature), scaled by `RIDGE_AMP` and local `sigma1`, weighted by `DESPIN_W` (despin lineaments) +
`DIURNAL_W` (diurnal/cycloid lineaments). **CYCLOIDS fall out FREE:** because `theta_traj` rotates with
position, the steered crest lines naturally curve / chain into arcs — no arc integrator, no time loop.

> ⚠ `steeredNoise3` is **module-private** in `tectonic.js` (not exported) and `tectonic.js` is
> out-of-scope to edit → it must be COPIED verbatim into `shellRelief.js`, with its `REGIME` branch
> inlined as a boolean. See MUST-FIX. The rule converting continuous `R` → discrete `lineamentNode`
> is also MUST-FIX #1.

### STEP 4 — CHAOS OVERLAY (secondary, masked; `CHAOS_W>0` only)

In cell interiors where `sigma1` also exceeds a higher `CHAOS_THRESH`, mask in a chaos field: low base
(foundered blocks below the ridged plains) + `createNoise3D('shell:chaos')` block-noise roughness, raised
matrix between blocks. `Mask = CHAOS_W * smoothstep(cellInteriorness * normalized-sigma1)` so chaos
appears ONLY in high-stress cell interiors, never globally — clearly secondary to the lineament field.
Store `chaosMask[i]`.

### STEP 5 — ASSEMBLE

`U[i] = SHELL_BASE (flat icy datum) + despinLineament + diurnalDoubleRidge + chaosOverlay +
DETAIL_AMP*detailNoise(d*DETAIL_FREQ)`. Then `carrier.height.set(U)` (REPLACE, like plates — the SOLE
low/mid source for these regimes, so it does NOT re-introduce banding). Bounded `RELAX_PASSES` Jacobi
smooth (default 4). Assert `|U| < SHELL_BOUND` (generous guard, mirror plates `U_BOUND`).
`carrier.faultDensity[i] = clamp01(|sigma1[i]|)` (parity with plates writing
`faultDensity=|boundaryStress|`; lineament/stress IS the activity proxy).

**ALL TUNABLES LOCKED** in a frozen `SHELL_DEFAULTS` (per-regime weights + `TENSILE_THRESH`,
`CHAOS_THRESH`, `RIDGE_AMP`, `BELT_RADIANS` geodesic half-width, `CELL_MIN`/`CELL_SPAN`,
`WARP_FREQ`/`AMP`, `DETAIL_FREQ`/`AMP`, `RELAX_PASSES`, `SHELL_BASE`) — override-able ONLY by the
headless structure test via `tune`, never by `route()`/lab — identical discipline to plates `DEFAULTS`.

---

## Carrier interface + dispatch wiring

From `result.design.carrierInterface`.

**WRITES** `carrier.height[i] = U[i]` via `carrier.height.set(U)` (**REPLACE** — the sole low/mid source
for the shell regimes; same `=` discipline as plates so no additive re-banding). Also writes
`carrier.grainAngle[i] = theta_traj[i]` (the lineament strike — reuses the carrier grain channel exactly
as `writeGrainSphere` does) and `carrier.faultDensity[i] = clamp01(|sigma1[i]|)` (activity proxy, parity
with plates `faultDensity`).

**DISPATCH WIRING** in `planet-lod-rivers.js` `writeBodyRelief` (~line 417), 3-way (earthlike path
BYTE-UNTOUCHED — checked first):

```js
if (isEarthlikePlatePath(archetype, locked)) {
  const plateDiag = writePlateUpliftSphere(carrier, grainDrivers, { macroSeed });
  return { path:'plate', plateDiag, shellDiag:null };
}
const regime = shellRegimeOf(archetype, locked);
if (regime) {
  const shellDiag = writeShellReliefSphere(carrier, grainDrivers, { macroSeed, regime });
  return { path:'shell', plateDiag:null, shellDiag };
}
writeGrainSphere(carrier, grainDrivers);
writeHeightSphere(carrier, {}, grainDrivers, { name:'tectonic-build' }, heightSeed);
return { path:'despun', plateDiag:null, shellDiag:null };
```

The `route()` body (`planet-lod-rivers.js:1129`) already destructures `relief` (`const relief =
writeBodyRelief(...)`; `plateDiag = relief.plateDiag` at :1130); **ADD** `const shellDiag =
relief.shellDiag` alongside, and expose it via a `get shellDiag()` accessor on the overlay (sibling of
`get plateDiag()` at :1189), so the live `shellProbe` can read it. Add
`import { writeShellReliefSphere, shellRegimeOf } from './src/worldengine/base/shellRelief.js'` at the
top of `rivers.js` (next to the plates import — `import { writePlateUpliftSphere } from
'./src/worldengine/base/plates.js'` at :30).

Returns a diagnostics object (peer of `plateDiag`) — see Diagnostics.

---

## Diagnostics + live `shellProbe`

From `result.design.fieldDiagnostics`.

**RETURNS** (peer of `plateDiag`, so the structure test + live `shellProbe` can PROVE the field is real,
arm's-length):

```
{
  U:Float32Array, regime:string, cellId:Int32Array, cellCount:int,
  stressTensile:Float32Array (signed sigma1), thetaTraj:Float32Array (== grainAngle written),
  lineamentNode:Uint8Array (1 where ridge-shoulder/crack placed), chaosMask:Float32Array,
  w0:[x,y,z] (the seeded paleo-axis — REQUIRED so the test can build a w0-latitude control),
  t_hat:[x,y,z], meanEdgeAngle:number, relaxPasses:int
}
```

The **`w0` export is load-bearing:** it lets the structure test run a latitude control ABOUT `w0` (not
just carrier +y), which is the falsifier the critic showed is needed — a tilted-band despin field would
PASS a +y latitude test, but the discrete-lineament-vs-stress signal must beat the `w0`-band,
distinguishing "tilted `sin²`" from "real discrete cracks."

**LIVE `shellProbe()`** — a sibling of `plateProbe()` in `world-engine-lab.html` (~line 5825), reading
`riverOverlay.shellDiag`. **PRECONDITION:** `_lab.reliefBakeStrength(>0)` + route on an
ice/Europa/eyeball/Titan preset, else `heightSource=='sampler'`. It rebuilds the stress-proximity
predictor **ARM'S-LENGTH** from published labels (NOT the generator's internal field), exactly as
`plateProbe` rebuilds boundary proximity:

- from `lineamentNode`, BFS geodesic distance to nearest lineament; `signed-stress-proximity[i] =
  sign(stressTensile at nearest lineament) * exp(-(dist*meanEdgeAngle)/BELT)` — resolution-independent,
  identical on 600-node and 40k meshes. *(See MUST-FIX "Verification tightenings": the predictor must
  be rebuilt from `stressTensile`/`thetaTraj` GEOMETRY, not from `lineamentNode`, to avoid circularity.)*
- `varExplainedByStress = corr(U, signed-stress-proximity)²`
- `varExplainedByLatitudeY = corr(U, sin²(carrier_latitude about +y))²` — must be LOW (falsifier vs the
  `sin²` fallback)
- `varExplainedByLatitudeW0 = corr(U, sin²(colat about w0))²` — the critic's extra control: distinguishes
  a real crack network from a tilted band
- `lineamentInteriorRatio = lineamentAmp / cellInteriorAmp` — must be `>= 2`
- `grainStressCorr = corr(thetaTraj, despin-principal-axis-about-w0)` — high for despin-dominated regimes

Returns `{ heightSource, regime, cellCount, varExplainedByStress, varExplainedByLatitudeY,
varExplainedByLatitudeW0, lineamentInteriorRatio, grainStressCorr, U:Array, cellId:Array,
lineamentNode:Array }`. The despun-fallback case returns a note (no `shellDiag`), mirroring
`plateProbe`'s null-`pd` branch.

---

## Acceptance criteria

All 9 ACs, from `result.design.acceptanceCriteria`, verbatim:

- **AC1 — DETERMINISM + NO-RNG:** a static source guard greps `shellRelief.js` for
  `/Math\.random|Date\.now/` and finds ZERO; and `writeShellReliefSphere(carrier,{},{macroSeed:s,
  regime:r})` run twice on the same fresh 600-node carrier yields byte-identical `U`, `grainAngle`,
  `faultDensity`, `cellId`, `stressTensile` (Float32Array equality) for `s in {1,2,3,7,42}` ×
  `r in {icy-active,volatile-cold,eyeball-despun}`. `|U| < SHELL_BOUND` for all nodes.
- **AC2 — STRUCTURE BAR (SIGNAL must PASS):** on the 600-node carrier, for each regime, the field is
  EXPLAINED by stress geometry: (a) `|corr(U, signed lineament-stress-proximity rebuilt arm's-length via
  BFS geodesic falloff)| >= 0.5`; (b) lineament (ridge-shoulder) node amplitude `>= 2×` cell-interior /
  quiet-plains amplitude (analog of plates convergent `>= 2×` interior); (c) for eyeball-despun +
  volatile-cold, `corr(thetaTraj, despin principal-axis direction about w0) >= 0.5` — strike follows the
  stress trajectory, not a fixed band.
- **AC3 — LATITUDE CONTROL (must FAIL):** `varExplainedByLatitudeY` (U vs `sin²` of carrier +y latitude)
  is LOW (`< 0.15`) AND strictly `< varExplainedByStress`, for ALL three regimes. This is the
  load-bearing falsifier distinguishing a real history field from the `sin²(lat)` fallback it replaces.
- **AC4 — TILTED-BAND CONTROL (the critic's extra falsifier; must hold):** `varExplainedByStress >
  varExplainedByLatitudeW0` (U vs `sin²` colat about the seeded `w0`) — proving the DISCRETE lineament
  network (not the underlying tilted despin band) carries the structure. Guards the failure mode where
  despin-only relief is just `sin²` rotated onto a random pole.
- **AC5 — NOISE CONTROL (must FAIL):** `corr(U, an independent simplex field matched to the same
  amplitude band)` is LOW (`< 0.15`); and a noise-control variant of the writer with the stress gates
  DISABLED (lineaments placed by pure noise, ignoring `sigma1`) must FAIL AC2(a) (corr collapses toward
  0) AND AC2(b) (the 2× ratio breaks). The test PASSES only for the real stress-gated field.
- **AC6 — VARIETY:** two different macroSeeds produce different `cellCount` AND a visibly different
  lineament network (e.g. `<0.2` node-overlap of `lineamentNode`, different `w0`), each reproducible
  per seed.
- **AC7 — NO-CLOBBER of the Earth-like path:** for archetype in `{terrestrial, ocean}` (`locked=false`),
  `writeBodyRelief` still routes to `writePlateUpliftSphere` and returns `path:'plate'` with
  `shellDiag:null`; the plate `U` field is byte-identical to a pre-change baseline (the plate AC2
  structure test still passes unchanged).
- **AC8 — NO-CLOBBER of the other despun/zonal regimes:** for a non-shell non-earthlike body (e.g.
  impact-airless unlocked, gas-giant), `shellRegimeOf` returns `null` and `writeBodyRelief` still calls
  `writeGrainSphere+writeHeightSphere` byte-identical to baseline (`path:'despun'`). A locked gas giant
  must NOT match `shellRegimeOf` (the `SHELL_EXCLUDE` set inside `shellRegimeOf`).
- **AC9 — SEAM FIRES:** with the `PRESET_ARCHETYPE` additions, the lab dispatch routes
  *Europa (icy moon)* → regime `'icy-active'` (via the added `'ice'` key), *Frozen (airless)* →
  `'icy-active'`, *Eyeball (locked temperate)* → `'eyeball-despun'`, *Titan (methane seas)* →
  `'volatile-cold'`; AND with the additions REMOVED, the `archetype=null + locked=true` Europa still
  routes to `'eyeball-despun'` via the locked-fallback (never silently to `sin²(lat)`).

> Note (carry to contract — see MUST-FIX "Dispatch safety"/regime gaps): AC9's "additions REMOVED, still
> routes" clause holds for **Europa** (locked:true → locked-fallback) but **not for Titan** (locked:false
> → no fallback; Titan hard-depends on its one map line).

---

## Test plan

From `result.design.testPlan`.

**HEADLESS** (`tests/worldengine-base-shell-structure.test.js`, vitest, three-free): build a shared
600-node carrier via `makeSphereField(buildIrregularSphere(... small N))` — or the same fixture the
plate test uses; sweep `SEEDS=[1,2,3,7,42]` × `REGIMES=[icy-active,volatile-cold,eyeball-despun]`. Run
AC1 (no-RNG grep + double-run byte-equality + bound), AC2 (signal pass), AC3 (latitude-Y control fail),
AC4 (tilted `w0`-band control), AC5 (noise control + gates-disabled variant fail), AC6 (variety).
**Rebuild EVERY predictor arm's-length from published diagnostics, never the generator's internal
scalar** — exactly as the plate test rebuilds boundary proximity from `boundaryClass`. Add no-clobber
tests (AC7/AC8) that call `writeBodyRelief` with earthlike + despun-fallback archetypes and assert path
+ byte-identity to a captured baseline.

**LIVE** (chrome-devtools on `:9223` — per the `sandbox-localhost-probe` rule: check liveness with
`mcp__chrome-devtools__list_pages`, NOT Bash `curl`): navigate the lab, select *Europa (icy moon)* (then
re-run for *Eyeball*, *Frozen*, *Titan*), call `window._lab.setSeed(1234);
window._lab.reliefBakeStrength(1)`; force a route; then `window._lab.shellProbe()`. Assert
`heightSource=='carrier'`, regime matches the preset, `varExplainedByStress > varExplainedByLatitudeY`
AND `> varExplainedByLatitudeW0`, `lineamentInteriorRatio >= 2`, `grainStressCorr` high (eyeball/volatile).
Take a screenshot to confirm DISTINCT landforms (cracks/cycloids/chaos vs `sin²` bands) — visual
verification done by the agent, not asked of Max.

**UAT** (does it read as a distinct icy/despun world from the user's view) is **Max's gate alone** — the
test plan marks it **deferred-to-max**.

---

## Files touched

From `result.design.filesTouched`.

- **NEW** `src/worldengine/base/shellRelief.js` — the writer + `SHELL_DEFAULTS` + `SHELL_BOUND` +
  `RELAX_PASSES` + `SHELL_REGIMES` + `shellRegimeOf`.
- **NEW** `tests/worldengine-base-shell-structure.test.js`.
- **EDIT** `planet-lod-rivers.js` — add `import { writeShellReliefSphere, shellRegimeOf }` and export
  `isShellReliefPath`; make `writeBodyRelief` 3-way (~417); thread `shellDiag` through `route()` (~1129)
  and add `get shellDiag()` accessor (~1189).
- **EDIT** `world-engine-lab.html` — add `'Europa (icy moon)':'ice'` and `'Titan (methane seas)':'volatile'`
  to `PRESET_ARCHETYPE` (~1901); add the `shellProbe()` method on `_lab` next to `plateProbe()` (~5825).
- **DOC** a one-paragraph build-intent note (`record-build-intent` rule) stating plain-language function
  (icy/despun stress-organized relief), intent (replace `sin²` fallback for icy/despun bodies, sibling to
  plates, zero-clobber), and deliberate non-goals (no Venus/shattered/gas/craters; seed-only,
  driver-response deferred).
- **NO edits** to `plates.js`, `tectonic.js`, `sphereField.js`, `planet-archetypes.js`.

---

## Scope-out

From `result.design.scopeOut`:

- **Earth-like plate path** — untouched (sibling writer; the gate checks `isEarthlikePlatePath` FIRST
  and returns before any shell code).
- **Driver-RESPONSE** — drivers bundle is accepted for signature parity but VOID this increment
  (seed-only first, exactly as `plates.js` shipped). Driver-response is the NEXT increment via the same
  `tune`/`drivers` seam.
- **Venus-like stagnant-lid silicate** (tessera/coronae/resurfacing) — deferred to the E7 volcanism
  increment.
- **exotic-shattered** (Miranda block-jumble) — needs its own dedicated writer; explicitly NOT lumped
  here.
- **impact-airless cratering, gas/hot-jupiter/sub-neptune** (no shell), **exotic-carbon/geometric,
  technogenic** — distinct primitives, keep their existing paths.
- **The game `Planet.js` port** — a separate much-later increment (lab != game per the charter; this
  writer lives three-free in `src/worldengine/base`, headless-testable).
- **Spatially-varying base/sea level and climate coupling** — out; `SHELL_BASE` is a flat icy datum this
  increment.
- **Per-regime fine tuning of `SHELL_DEFAULTS`** beyond what the AC2 structure bar requires — locked
  defaults, swept only by the headless test, never by `route()`/lab.

---

## MUST-FIX BEFORE CONTRACT (the build-readiness critic's holes — do NOT smooth away)

This is the most important section. It reproduces ALL of `result.holes` as an actionable checklist.
These are the gaps that must be closed during `dev-collab-scope` before this becomes a contract — they
are not optional polish.

### #1 (the single most important): PIN THE STRESS-FIELD MATH

Four named-but-unspecified pieces. The despin closed-form `sigma_despin(colat_w)` and the diurnal
`sigma_tidal(angle, theta)` are *named but never specified as formulas*. `plates.js` gives the EXACT
stress decomposition (relative-velocity normal component / `STRESS_REF`, `obliquity =
mag/(mag+absS)`); the shell design hand-waves "a closed-form membrane stress … TENSILE longitudinally
near the paleo-equator, compressive in a polar cap" and "`sigma_tidal` … whose principal axes ROTATE
with position" with **no equation, no constants, no sign convention, no normalization into [-1,1]**.
This is the single largest build hole: two developers would write materially different fields, and the
AC2/AC4 pass-rates depend entirely on the exact functional form (especially whether `sigma1` is
normalized like plates' `STRESS_REF` so `TENSILE_THRESH`/`CHAOS_THRESH` are meaningful).

The contract MUST pin:

- **(a) the despin membrane-stress formula** as a function of colatitude about `w0`, with its **two
  principal components** and the **sign convention**.
- **(b) the diurnal stress** as `f(angle-to-t_hat, phi0)` with the **position-dependent principal-axis
  ROTATION made explicit** — this rotation is what makes cycloids "fall out free" (STEP 3); if it is
  unspecified, cycloids may not emerge and AC2 has no anchor.
- **(c) the normalization** that maps summed stress into the ~`[-1,1]` band the thresholds assume.
- **(d) the symmetric 2×2 diagonalization formula.** The design asserts "Diagonalize the summed 2×2 →
  `sigma1` and `theta_traj`" but gives no eigen-routine. For a symmetric 2×2 `[[a,b],[b,c]]` this is
  closed-form: `theta = 0.5*atan2(2b, a-c)`; eigenvalues `(a+c)/2 ± sqrt(((a-c)/2)² + b²)`. Trivial to
  write but MUST be specified, because `theta_traj` is written to `carrier.grainAngle` AND is the
  steering axis AND is tested by AC2(c)'s `grainStressCorr` — an off-by-90° or `atan2` argument-order
  error **silently** fails AC2(c).
- **(e) the rule converting the continuous ridged field `R` into the DISCRETE `lineamentNode` set.**
  `plates.js` gets proximity for free from BFS-to-boundary; here lineaments are crests of a continuous
  ridged field `R[i]`, so there is **no discrete lineament set to BFS from until AFTER you threshold
  `R` at its crest** — a chicken-and-egg. `lineamentNode` (Uint8, "1 where ridge-shoulder/crack placed")
  must be DERIVED (crest detection on `R` over the graph), and the `shellProbe` THEN BFS's geodesic
  distance from `lineamentNode`. The mechanism is unspecified and is load-bearing for BOTH the
  double-ridge cross-section (needs across-strike phase = signed graph distance from the crack) AND the
  entire AC2(a)/`shellProbe` predictor. **Pin a threshold-based crest rule** (`R[i] > CREST_THRESH`
  gated by `sigma1`) — NOT a relative local-max (a local-max over an irregular graph is
  adj-order/float-equality fragile; a threshold rule is order-independent and resolution-independent).

> These despin/diurnal closed forms are **KNOWN** — Melosh despin membrane stress; diurnal tidal stress.
> They are to be pinned, **with citations**, during scoping. The point is that this DESIGN does not
> contain them; the CONTRACT must.

### Dispatch safety

- **Enumerate `SHELL_EXCLUDE`.** The design names `SHELL_EXCLUDE` but never enumerates it — this is the
  one place dispatch can fire on the WRONG body. The locked-fallback (`locked && not-earthlike-or-gas`)
  would otherwise hand a **locked gas giant**, **locked lava world**, etc. a rocky ice-shell lineament
  field — physically absurd AND an AC8 violation (clobbers the despun path). PIN THE SET:
  `SHELL_EXCLUDE = { terrestrial, ocean, gas-giant, sub-neptune, lava, carbon, crystal }` (all non-shell
  short keys) must be excluded from the locked-fallback. Concretely verified against ground truth:
  - **Lava** is `locked:true` (`lab:2594`), `archetype='lava'` (`lab:1903`). `SHELL_REGIMES` has no
    `'lava'` key → step(1) misses; the locked-fallback fires UNLESS `'lava'` is excluded. Io-class lava
    worlds are volcanic/silicate (E7 territory, OUT). Without `'lava'` in `SHELL_EXCLUDE`, locked Lava
    gets an ice-shell lineament field — wrong regime, clobbers its despun path.
  - **Locked gas case:** the lab `gas-giant` archetype preset is itself `locked:false` (`lab:2613`), but
    the *Hot Jupiter (locked giant)* preset is a `NAMED_BODY` → `archetype=null`, `locked:true`
    (`lab:2649`). For a `null+locked` gas body the locked-fallback would return `'eyeball-despun'` unless
    excluded. (When the explicit `'gas-giant'` key is present and locked, the same exclusion is needed.)
    Either way, `gas-giant`/`sub-neptune` MUST be in `SHELL_EXCLUDE` so AC8 ("locked gas giant must NOT
    match") has a real mechanism.
- **Voronoi tie-break uses strict `>`.** The cell partition uses nearest-by-max-dot over `K` warped
  centroids; if two centroids tie on max-dot, the tie-break MUST be the strict `>` plates uses (so the
  FIRST/lowest-index centroid wins ties — copy that exact `>`, not `>=`). A `>=` would still be
  deterministic but differ from plates and is not called out in the design.
- **`'volatile'` is a coined key.** As above — document `'volatile'` as a NEW short key (exists in no
  current vocabulary), produced by exactly one added `PRESET_ARCHETYPE` line.
- **Titan single-coverage fragility.** Europa is double-covered (map + locked-fallback); **Titan is
  single-covered by the map line ONLY** (it is `locked:false`, so the locked-fallback never fires for it).
  If the `'Titan (methane seas)':'volatile'` map edit is dropped, Titan silently regresses to bands. The
  contract must state this plainly; AC9's phrasing obscures it.

### `steeredNoise3` must be COPIED verbatim

`steeredNoise3` is **NOT exported** from `tectonic.js` — verified: it is a bare `function steeredNoise3(...)`
at `tectonic.js:93` (module-private); the `REGIME` enum lives in `substrate.js` as
`{NORMAL:0, STRIKESLIP:1, THRUST:2}` (verified `substrate.js:4`). STEP 3 says "reuse the … `steeredNoise3`
transform `tectonic.js` already ships," while `filesTouched` says "NO edits to `tectonic.js`." A developer
**cannot** `import { steeredNoise3 }` — it would throw. The only legal path is to **COPY the function body
verbatim** into `shellRelief.js` (the design's own "copy VERBATIM" discipline permits this elsewhere).
**FIX the STEP 3 wording** from "reuse the transform `tectonic.js` ships" to "**COPY `steeredNoise3`'s body
verbatim into `shellRelief.js`** (it is module-private in `tectonic.js`; importing it would require an
export edit, which is out of scope)." The copied helper references `REGIME.NORMAL` — the copy must
**inline the regime branch as a plain boolean** (e.g. a `ridged` flag), since importing `REGIME` from
`substrate.js` pulls a substrate dependency the three-free base writer shouldn't need.

### Verification tightenings

- **AC4 — the eyeball regime MUST use the double-ridge cross-section.** AC4 (`varExplainedByStress >
  varExplainedByLatitudeW0`) is the strongest part of the design and genuinely guards the "tilted `sin²`"
  fake — BUT it has a latent loophole for `eyeball-despun` (`CHAOS_W=0, DIURNAL_W=0`). With ONLY despin
  stress, `theta_traj` is a deterministic function of colat-about-`w0`, and lineament crests sit where
  the despin band is most tensile — i.e. concentric rings at fixed `w0`-colatitudes. Then `corr(U,
  signed-stress-proximity)` (AC2a) and `corr(U, sin²(colat-w0))` (AC4) could BOTH be high because the
  cracks COINCIDE with the band. The **double-ridge cross-section** (trough + shoulders) is the only
  thing that breaks the degeneracy — it makes U oscillate ACROSS each ring so it is NOT monotonic in
  colat-`w0`. The contract must **REQUIRE the double-ridge cross-section be active in `eyeball-despun`**
  (the design lists eyeball as `DESPIN_W:1.0`, and STEP 3 weights the cross-section by `DESPIN_W +
  DIURNAL_W`, so despin lineaments DO get it — confirm this explicitly). Else AC4 is gameable by a smooth
  tilted band and the eyeball regime has no real falsifier.
- **AC5 — the noise control must disable BOTH the `sigma1` gate AND the `theta_traj` steering.** The
  "gates-disabled variant" only disables the `sigma1` gate as written — but if the crest field `R` is
  still steered by `theta_traj` (which derives from stress), the "noise control" still carries stress
  structure and might NOT fully collapse AC2(a), so the fake could pass. Specify that the noise control
  replaces `theta_traj` steering with isotropic/random steering (pure isotropic ridged noise), matching
  plates' true noise control — disable BOTH gate AND steering.
- **`shellProbe` predictor must be rebuilt arm's-length from `stressTensile`/`thetaTraj` GEOMETRY, NOT
  from `lineamentNode`.** `plateProbe` is arm's-length because `boundaryClass` is a GEOMETRIC label
  (which plate you're on, independent of U). `lineamentNode` is NOT geometric-independent of U — if crest
  detection keys off the same ridged field that builds U, the predictor is partly **circular** (predicts
  U from a thing derived alongside U). Tighten: derive the predictor from `stressTensile`/`thetaTraj`
  geodesic structure; treat `lineamentNode` only as a cross-check, so AC2(a) can't pass trivially by
  U-correlates-with-its-own-crest-mask.
- **AC2(b) denominator branches per-regime.** "lineament node amplitude `>= 2×` cell-interior/quiet-plains
  amplitude" — for `eyeball-despun` there ARE no cells (`CHAOS_W=0`, no cell partition per STEP 2 "only
  when `CHAOS_W>0`"), so "cell-interior amplitude" is undefined and `cellId` is all-zero/undefined. The
  test code MUST branch: cells exist only for `icy-active`/`volatile-cold`; **eyeball uses quiet-plains
  (non-lineament) nodes** as the denominator. Specify per-regime or AC2(b) throws on eyeball.

### Determinism — sound, with two pins to carry

The determinism scaffolding is verified sound: `carrier.height.set(U)` REPLACE discipline, the `'shell:'`
alea namespace disjoint from `'plates:'`/`'e6:'`, and `createNoise3D(alea('shell:…:'+seed))` all match the
`plates.js` pattern byte-for-byte; AC1's static no-RNG grep + double-run byte-equality is enforceable. Two
pins fold into the items above: (1) the Voronoi tie-break operator (strict `>`); (2) the crest-detection
rule must be threshold-based (`R[i] > CREST_THRESH`), not a relative local-max, to stay order-independent
and resolution-independent — a hard-coded N-hop window would be a resolution-dependence trap; geodesic
`BELT_RADIANS` is fine.

---

**Next step:** `dev-collab-scope` turns this DESIGN into `intent.md` + `contract.json` — pinning the
stress-field math (MUST-FIX #1, with Melosh/diurnal citations) and the secondary must-fixes — then a
per-AC build verified with the `verify-workstream` workflow.
