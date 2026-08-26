# Direction Audit — Is the world-engine architecture headed the right way?

**Assessment date:** 2026-06-25 · **Branch:** `feature/world-engine-production-L1` · **READ-ONLY.**
**Lens:** Direction audit. Does the LOCKED design (shared mutable relief substrate + host-editor/epoch +
Option-A expose+derive + type-as-label) actually answer Max's "generate tectonic history as DATA →
render reads it" vision? Is the WS4 UAT failure a flaw in the DIRECTION or only in the WS4 IMPLEMENTATION?
What is the gap from the validated lab slice to a production renderer? And does any locked decision deserve
to be revisited?

This audit reads the three design docs (`world-engine-architecture-spine.md`,
`world-engine-wf2-synthesis.md`, `world-engine-INDEX.md`), the four code-map files and four research files
in this folder, the WS4 artifacts, and the `world-engine-production-L1-plan.md`. Every load-bearing code
claim below was spot-verified against source (cites are `file:line`).

---

## 0. The one-paragraph verdict

**The direction is right. The WS4 UAT failure is an IMPLEMENTATION/SCOPE failure, not a direction failure —
and it is traceable to ONE locked sub-decision (Max decision #6, "augment not replace"), which the evidence
says should be revisited, not the architecture.** The locked design — a first-class mutable relief substrate
that BUILD engines write and SCULPT engines edit, ordered by epoch, derived by a thin Tier-1 base step, with
type demoted to a label — is exactly "procgen decides the structure as data; render expresses it." It is
already IMPLEMENTED and Max-UAT-PASSED in the relief slice (2026-06-23), and it independently matches every
shipping production planet renderer surveyed (Outerra, Star Citizen Genesis, World Orogen, geometry clipmaps).
WS4 failed UAT because it wired only the **orientation half** of that architecture into the renderer (a
latitude-banded strike director) and left the **structure half** (the baked `height` field) in shader noise.
That asymmetry was not an accident of coding — it was *designed in* by decision #6, which scoped WS4 to
"augment `gProvince` (orientation/regime)" rather than "displace from a baked height substrate." The fix is to
carry the substrate's `height` channel into the renderer (the thing the slice proves and `src/worldengine/base/`
is already heading toward), not to change the architecture.

---

## 1. Is the LOCKED design the right answer to the vision? — YES, with strong external corroboration

### 1.1 Restating the vision in its own terms (so the audit has a criterion)

Max's north star (spine §0/§1, preserved verbatim): *"what you see when you look at a planet IS its
billions-of-years history … the world engine is a STORY ENGINE: procgen WRITES the body's tectonic/geological
history as DATA upstream; rendering only READS/EXPRESSES that already-generated history. PROCGEN DECIDES,
RENDER EXPRESSES."* The operational test of any architecture against this vision is therefore a single question:

> **Is the planet's relief structure committed to DATA before rendering, and does the renderer READ that data
> rather than re-deciding the structure itself?**

That is the criterion this audit applies throughout. It is binary at the level of the relief *body* (the
low/mid-frequency shape — continents, ranges, plains, basins): either that shape exists as a sampled field, or
the shader invents it.

### 1.2 The locked design satisfies the criterion by construction

The four locks, read against that criterion:

- **Shared mutable RELIEF SUBSTRATE** (wf2-synthesis §2). This IS "structure as data": a first-class object
  holding the per-cell `height` (plus grain/regime/flowAccum/baseLevel). The renderer's job becomes "displace
  and shade from `height`" — pure expression. This is the direct embodiment of the criterion.
- **Host-editor / epoch model** (spine §3.1, locked 2026-06-22). This is what makes the data a *history* and
  not just a heightmap: BUILD engines (E6/E7/E8a) write the host, SCULPT engines (E9/E10/E11) edit it in a
  causal order, so the rendered surface encodes "a river later cut a mountain that was already there." A flat
  one-pass stack structurally cannot encode that on-patch sequence; the epoch model is the minimum structure
  that makes the north star reachable. WF2 found 11/18 engines are editor-on-host (synthesis §7) — the model
  isn't a nicety, it's how most of the stack works.
- **Option-A expose + derive** (spine §4c). Locates the history-writing (derivation) work in the NEW L1 layer,
  not the fragile `PlanetGenerator`/`PhysicsEngine` core — lowest blast radius, and "derivation IS the
  history-writing work" so it belongs there by definition.
- **Type → derived label** (spine §4b). Removes the co-genesis-violating input where a discrete type
  pre-decides outcomes; drivers + fields decide, type only names. This is required for the data to be a
  *consequence* of the body's physics rather than a lookup-table costume.

Each lock maps onto a clause of the criterion. There is no clause of the vision the locks fail to address.

### 1.3 External corroboration: the locked direction is the industry-standard "build-then-express"

The production-renderer research (`research-production-renderers.md`) is decisive here, because it tests the
direction against *shipping* systems rather than against the team's own reasoning. Every documented
production/near-production planet renderer **bakes a coarse structural field as real data, then amplifies
detail conditioned on that data**:

| Engine | Coarse structure stored as | Detail conditioned on it? |
|---|---|---|
| Outerra | ~150 m elevation dataset, cube-face textures (wavelet, GPU-decompressed) | Yes — noise amplitude modulated by slope/curvature/elevation derived from the data |
| Star Citizen v5 / Genesis | Baked global heightmap + Temp/Humidity/Geology/Soil/SlopeAspect "shared data pool" | Yes — pools DRIVE texture/flora/rock/erosion-debris placement |
| No Man's Sky | Density field evaluated into a 3D voxel volume, then polygonized | Yes — analytical derivatives keep all features on one coherent surface |
| World Orogen (OSS) | Plate/stress/erosion elevation grid (~20k regions) | Yes — priority-flood + stream-power erosion EDIT the stored grid; mesh displaces from it |
| Geometry clipmaps (GPU Gems 2) | Coarse elevation pyramid (per-level textures) | Yes — fractal detail = noise RESIDUAL added on top of upsampled coarse |

Two of these are near-exact mirrors of the locked design:
- **Star Citizen's Genesis "shared data pool" ≈ wf2-synthesis §2's "first-class mutable RELIEF SUBSTRATE."**
  Same idea: a baked field stack that downstream expression reads. Star Citizen's product guarantee —
  *"players can scout a location from orbit knowing the appearance won't change when they reach the surface"* —
  is **only achievable if the coarse shape is authoritative data sampled at every LOD**, never re-rolled from
  noise per view. That is the strongest possible statement of why the substrate must be data.
- **World Orogen independently arrived at the relief slice's exact algorithms** — priority-flood pit
  resolution + iterative stream-power incision into a shared mutable height grid — and renders by displacing a
  mesh from that grid. It is the relief-slice architecture, externally validated down to the literal algorithm
  names (compare `relief-e9-hydrology.js`: priority-flood + `dz = K·A^m·S^n` subtracted into `substrate.height`).

The research's bottom line: the relief slice matches **every** production row; the WS4 grain cube matches
**none** of them (it is the only "stored structure" that is a *direction with no underlying stored height*).
**The direction is not just internally coherent — it is the field-standard answer.**

### 1.4 Verified in code: the locked design is real, not just documented

The relief slice implements the host-editor model literally (spot-verified):
- E6 WRITES the host: `relief-e6-tectonic.js:122` — `substrate.height[i] += baseAmp * h * blend`.
- E9 SUBTRACTS from the SAME array: `relief-e9-hydrology.js:139` — `substrate.height[i] -= dz`.
- The orchestrator snapshots between epochs as a temporal-legibility witness: `relief-slice.js:39-44`
  (`heightAfterBuild = cloneHeight(substrate)` between the E6 build and the E9 carve).
- The renderer is preset-blind and reads the data: `world-engine-relief-lab.main.js` displaces the mesh by
  `substrate.height[i]` and colours from `standing`/`flowAccum` — it synthesizes no relief.

This is "PROCGEN DECIDES, RENDER EXPRESSES" realized. **Conclusion: the locked direction is the right answer
to the vision, and it has already been proven (in the lab, on a flat DEM) and externally corroborated.**

---

## 2. Does the WS4 UAT failure reveal a flaw in the DIRECTION or only in WS4? — Only in WS4 (scope), and it traces to ONE locked sub-decision

### 2.1 What WS4 actually wired (verified)

WS4 wired two engines into the **production lab renderer** (`world-engine-lab.html` shader). What crosses CPU→GPU:
- **E6 grain cube** (`uTectonicGrainCube`): a HalfFloat `samplerCube` whose `RG = world strike.xy`,
  `B = grainMag`, `A = regime`. Verified strike-only: `planet-lod-height.glsl.js:144` declares the cube as
  "baked strike-only cube (RG = world strike.xy)". The strike is `smoothStrikeAngle = atan2(|sZon|,|sMer|)`
  (`planet-lod-tectonic.js:44-45`) over `stressAtLat(carrier.latDegOf(i), drivers)`
  (`src/worldengine/base/tectonic.js:56-57`) — a **pure function of latitude**, so the grain carries ZERO
  within-body longitudinal structure. It is a compass field, not relief.
- **E9 carve cube** (`uRiverCarveMap`): a genuinely baked, strictly-subtractive drainage-depth field over the
  REAL routed dendritic network — this part is sound and is NOT the source of the fail.

The relief BODY is still synthesized in-shader: `planet-lod-height.glsl.js` is a chain of `h += ... noised(...)`
combiners (e.g. `:972`, `:828-833`, `:755`), and the grain enters each grained combiner only as an orientation
input via `mix(uOrogenyAxis, sampleGrainStrike(pos), uTectonicGrainStrength)` → `grainProvinceRotate`
(`:950`, plus chasma/scarp/tessera/lava/cryo). The grain rotates the noise; it never becomes the height.
There is **no baked height sampler anywhere** in the lab shader (only `uTectonicGrainCube`).

That is *exactly* Max's UAT verdict — "an orientation overlay, not a planet with a tectonic history as data" —
and it is visible directly in the GLSL, not inferred.

### 2.2 The architecture that WS4 was missing EXISTS and PASSED — it just wasn't the thing wired

The decisive structural fact (grep-verified): the height-writing half of the architecture is **never called by
the renderer**.
- `runE6` (writes `substrate.height`) is called ONLY by `relief-slice.js` and test files — zero renderer/HTML
  callers.
- `makeBaseStep` is called ONLY by `relief-slice.js`, the read-only `worldengine-fieldviz.html`, and tests —
  never by `world-engine-lab.html` or the game.
- `writeGrainSphere` (the **orientation** half) is the ONLY world-engine producer wired into the renderer
  (`planet-lod-tectonic.js:86`).

So there is no contradiction between "the slice passed" and "WS4 failed": the slice and WS4 are at **different
layers**. The slice realizes the L1 substrate (E6 builds a real height array, E9 carves it). WS4 is the L2
renderer step — and it ported the producer's *orientation output*, not its *height substrate*. The mechanism
verified (one shared grain feeds six consumers — a real plumbing win) and the UAT failed (no structure-as-data
was baked). **Mechanism-verify tested orientation coherence; UAT tested structure-as-data, which was never
baked.** Two different things.

### 2.3 The root cause is Max decision #6 — a LOCKED sub-decision, not the architecture

This is the sharpest finding of the audit. WS4's orientation-only scope was not a coding shortcut — it was
**specified** by a locked decision:

> **Decision #6** (`world-engine-production-L1-plan.md:264`, restated in WS4 `intent.md:28` and `notes.md:24-62`):
> *"E6 grain vs existing `gProvince` (WS4): **augment** (province = amplitude/where; grain = orientation/regime),
> not replace."*

Under decision #6, WS4 was correctly built: the grain AUGMENTS `gProvince` by supplying orientation, while the
amplitude (`gProvince`) and the relief height stay synthesized in the fragment shader. The
`renderer-expression-only` AC even PASSED by *confirming* that `gProvince`/`initProvinces`/`provinceWeight` were
preserved (verdict.json AC `renderer-expression-only`). In other words: **WS4 faithfully executed a decision
whose own definition guaranteed the relief would remain shader noise.** The UAT failure is the first place
where the consequence of decision #6 became visible.

Decision #6 is the one I FLAG (see §4). It is not one of the four headline structural locks — it is a tactical
"how do E6 and the existing province field relate in the shader" call. But it is the proximate cause of the UAT
miss, and it quietly contradicts the deeper lock it was supposed to serve (wf2-synthesis §2 wants a substrate
whose **height** the renderer expresses; decision #6 keeps height in the shader and only shares orientation).

### 2.4 Why the direction is exonerated

If the *direction* were the flaw, the relief slice (which IS the direction) would also have failed Max's UAT.
It passed — "they all read as distinct," three categorically different worlds at one seed (INDEX §1). The thing
that failed is the renderer surface that did NOT adopt the substrate. **That is a scope boundary, not a design
error.** The production renderer research reaches the same conclusion independently: it "indicts the WS4
*shortcut* (orientation-only cube), not the WS4 *goal*" (research §9).

---

## 3. The gap from the validated lab slice to a production renderer

The slice proves the mechanism on a flat 2D latitude-band DEM, baked on the CPU, rendered by displacing a plane
mesh. Production needs the same `height` data, sphere-native, sampled by the real planet renderer. The concrete
gaps, in rough order of risk:

### 3.1 Sphere-native height field (the real work — medium risk, partially started)
The slice's #1 deliberate non-goal is "flat 2D latitude-band DEM, not sphere/cubemap" (`relief-slice.js:22`).
Production must commit the relief `height` to a **sphere-native sampled field** (cube faces / per-node sphere
graph). This is the single biggest un-validated generalization, and it is the one the research flags as "the
port's real work" (research §9). Status: **already in progress** — `src/worldengine/base/sphereField.js`
provides the per-node sphere carrier with `latDegOf`/`tangentFrameAt`, and `writeGrainSphere`
(`tectonic.js:53-63`) is the sphere-native E6 writer. Two important de-riskers were found in the maps:
- The production **river router is already sphere-native and seam-free by construction**
  (`planet-lod-rivers.js` builds a spherical-Delaunay mesh, RTT-reads height, runs priority-flood + D-inf +
  Horton-Strahler). So the feared "cubemap-seam lake breakage" hazard **does not exist in this pipeline**
  (production-L1-plan finding #2). The seam risk is smaller than the slice's caveat implied.
- The grain's seam continuity holds because regime/grain are a pure function of latitude, so same-latitude seam
  neighbours agree by construction (`tectonic.js:50-52`, gated by `verify.js` `seamConsistent`).

**Missing piece:** `src/worldengine/base/*` ported only the BUILD side's orientation writer + carrier. It has
**no `runE6`-into-the-renderer height path and no E9/hydrology at all** (map-worldengine-base §1). So the
sphere carrier exists, but nothing yet bakes the substrate `height` onto it AND samples it in the shader.

### 3.2 Bake the height as a sampled field and SAMPLE it in the shader (the actual UAT-closing move)
This is the change decision #6 deferred. The same WS4 cube machinery
(`buildGrainCubeGeometry`/`createGrainCube`) that today carries orientation could carry a baked **height /
displacement** channel (or a province-amplitude field derived from the baked height). The shader's role then
flips to what every production engine does: **displace/shade from the sampled coarse height, and add detail as
a residual conditioned on that height** (slope/curvature-modulated, à la Outerra and geometry clipmaps) — not
synthesize the structure from noise and rotate it. The grain cube can REMAIN, but as the orientation input to
*detail on top of* a baked coarse height, not *instead of* one (research §9).

### 3.3 GPU bake of E9 (deferred optimization — low architectural risk)
The slice's E9 is a CPU bake-time reference (`relief-e9-hydrology.js` header). WF2 already established E9 is
bake-time, not per-frame, and the honest target is FastFlow (Jain 2024) accumulation + a handful of bounded
incision passes, seconds per body (wf2-synthesis §8). Production already has the sphere router that does the
routing; the open item is the incision-pass count / bake budget (production-L1-plan decision #8, "seconds not
per-frame"). This is a performance tuning gap, not an architecture gap.

### 3.4 The full engine stack beyond E6/E9 (explicitly later work)
WS4/the slice cover only 2 of ~15 engines. Max's own bar (WS4 `intent.md:13-16`) names Earth's continental
shapes (plate tectonics) and Pluto's impact-smoothed Sputnik Planitia (bombardment + cryo) — those come from
E7/E8a/E11, NOT this slice. The substrate model is exactly what lets those engines be added as further
host-editors on the same `height`, so the gap is additive, not a re-architecture.

### 3.5 Game renderer (`Planet.js`) is OUT of scope (locked, correctly)
The production-L1 port is **lab-only** (locked 2026-06-23). The game shader (`Planet.js`, a 40+ branch
`if (planetType==N)` shader fed by `_pickType` + `ExoticOverlay`) is a separate, very-high-blast-radius
deferred workstream. The game L0 still writes scalars + a type LABEL and synthesizes ALL relief in-shader
(map-game-L0) — but that is correctly deferred and does not block the lab port.

---

## 4. LOCKED decisions flagged for revisiting

### 4.1 FLAG — Max decision #6 ("augment, not replace") — REVISIT (the proximate cause of the UAT miss)
**Decision:** `world-engine-production-L1-plan.md:264` — grain AUGMENTS `gProvince` (orientation/regime), the
shader keeps synthesizing amplitude/height.
**Why flag it:** This is the single locked decision the evidence directly indicts. It is *internally* consistent
(WS4 built exactly what it said), but it quietly under-serves the deeper lock it was meant to implement
(wf2-synthesis §2 wants the renderer to express the substrate's **height**, not just its orientation). Under #6
the relief body necessarily stays shader noise → the UAT result was baked in from the decision, not discovered
in the build. **Recommended re-scope (not a contradiction of the §2 substrate lock — a sharpening of it):**
the renderer should sample a baked **height / coarse-amplitude field derived from the substrate** as the
load-bearing structure, with the grain cube demoted to orienting the *detail residual* on top of it. This is
the "substrate-as-data reading" both the map (map-worldengine-base §5) and the research (§9) recommend, and it
is what the slice already proves. Decision #6 should be reopened as "decide WHICH channel of the already-built
substrate the renderer expresses: orientation-only (current, failed UAT) vs height/coarse-amplitude (matches
the vision)." This is a scope question for Max.

### 4.2 NOT flagged (verified intact): the four headline structural locks
- **Shared mutable relief substrate** (wf2-synthesis §2) — corroborated by the slice's pass AND by every
  production renderer surveyed. Keep.
- **Host-editor / epoch model** (spine §3.1) — validated by WF2 (11/18 engines are editor-on-host) and proven
  in the slice (E6 build → E9 carve, witnessed). Keep.
- **Option-A expose + derive** (spine §4c) — `src/worldengine/base/*` implements it cleanly (adaptL0 →
  makeBaseStep → derived fields, zero edits to `src/generation/`). Keep.
- **Type → derived label** (spine §4b) — the base step derives `discriminator` from physics, never takes a
  type input (`baseStep.js:64`); demotion is correctly scoped as a separate high-blast-radius WS3. Keep.

None of these is challenged. The relief slice is a faithful (if 2D) instance of all four.

### 4.3 Honest sub-flags (not lock challenges, just calibration the docs already own)
- The "cubemap-seam lake breakage" hazard cited in the slice caveats is **smaller than stated** for the
  production pipeline (the router is already seam-free) — the production-L1-plan already caught this (finding
  #2); the slice caveat should be read as flat-DEM-specific, not a production blocker.
- The stale `PlanetGenerator.js:565` D12 cite (the hard-zero is actually at `:613` per map-game-L0) — relevant
  only if/when the game-side plumbing is touched; the lab port doesn't depend on it.

---

## 5. Bottom line for Max

1. **Direction: right.** The four structural locks ARE "procgen writes structure as data; render reads it,"
   they are proven in the UAT-passed relief slice, and they match the field-standard build-then-express pattern
   of every shipping planet renderer surveyed. No headline lock should be revisited.
2. **WS4 failure: implementation/scope, not direction.** WS4 wired the architecture's *orientation* half into
   the renderer and left the *structure* half in shader noise. The relief slice (the structure half) passed UAT
   at the same time, which exonerates the direction.
3. **The fix is the channel, not the model.** Carry the substrate's baked **height** (or a coarse-amplitude
   field derived from it) into the renderer as a sampled sphere-native field; demote the grain cube to orienting
   the *detail residual* on top of it. The slice proves the data; `src/worldengine/base/sphereField.js` +
   the WS4 cube machinery are the carriers; only the **height channel** is missing.
4. **One lock to reopen: decision #6 ("augment not replace").** It is the proximate cause of the UAT miss and
   should be re-scoped to "which channel does the renderer express" — surfacing height as the load-bearing
   structure. This sharpens, not contradicts, the §2 substrate lock.
5. **Remaining gaps are tractable and mostly started:** sphere-native height bake (the real work, de-risked by
   the already-seam-free router), GPU E9 bake (performance tuning), and the rest of the engine stack (additive
   host-editors on the same substrate). The game `Planet.js` port stays correctly deferred.
