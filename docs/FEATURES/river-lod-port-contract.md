# River-LOD → game port contract

> **Status:** Contract, not a plan. Names exactly what `src/objects/Planet.js` must carry to host
> the lab's river-LOD, so a future port is mechanical rather than archaeological. **Wiring stays
> deferred** (no code in `src/` imports the lab today — see
> [`lab-vs-game-renderer-divergence.md`](lab-vs-game-renderer-divergence.md) §4, the graft-vs-replace
> decision this contract is subordinate to). Written 2026-06-20 (working-Claude) from two
> `code-explorer` sweeps; this file is the durable record of those findings.

## Why a contract (and why now)

River-LOD is **cheap to make port-READY** even though the port itself is deferred. The compute/bake/
geometry stack is already mostly importable; the only consumer-side coupling is a GLSL graft plus a
handful of lab-glue bits. Capturing the seam now (and removing the unit-sphere assumption — §1 below,
landed in `63159a6`) means the eventual port reads off a checklist instead of re-discovering the
boundary. The frame: the lab should build river-LOD so it ports relatively seamlessly, **without**
porting now (respects the charter's "don't wire yet").

## Both renderers are NON-DISPLACED spheres (the load-bearing fact)

All relief on BOTH renderers is **fragment-shader normal-bending**, never vertex displacement:
- **Lab:** `SphereGeometry(1.0, 256, 256)` + ShaderMaterial, pass-through vertex shader
  (`world-engine-lab.html:1386`, `:189`).
- **Game:** `IcosahedronGeometry(d.radius, 5)` + ShaderMaterial, pass-through vertex
  (`src/objects/Planet.js:1029`, `:1088`).

Because nothing pokes out of the sphere, a **constant radial offset** (the ribbon lift) works on both,
and the carve is a pure shader read. This is what makes the port a graft, not a geometry rebuild.

## A. PORTABLE-CORE — import as-is (zero/near-zero change)

These already import THREE explicitly with no `window`/GUI derefs:

| Module / export | File | Role |
|---|---|---|
| `routeAndOrder` | `planet-lod-rivers.js` | priority-flood + D-inf routing + Horton–Strahler order |
| `buildRibbonGeometry` | `planet-lod-rivers.js` | trunk water-line mesh (now radius-parameterized — §1) |
| `buildValleyGeometry` | `planet-lod-rivers.js` | valley footprint → carve cube (radius-invariant — §1) |
| `createCarveCubeMap({renderer,size})` | `planet-lod-rivers.js` | clean factory, direction-keyed depth cube |
| **whole** `planet-lod-tributary-patch.js` | — | `projectToPatch`, `buildFineValleyGeometry`, `buildFineRibbonGeometry`, `createTributaryPatch` — clean importable module, public surface only |

The bake **producers** are drop-in. The **consumer** GLSL is the graft (§B).

## B. SHADER GRAFT — what Planet.js's fragment shader must host

The carve is a **surface-shader property**; it ports WITH the surface shader. Graft into Planet.js's
fragment shader:
- the `sampleCarve` GLSL (samples the carve cube + the optional fine ortho patch, unions under MAX, and
  subtracts a valley profile from `h`);
- the uniform contract it reads: `uRiverCarveMap`, `uRiverCarvePatchMap` / `uRiverCarvePatchN` /
  `uRiverCarvePatchU` / `uRiverCarvePatchV` / `uRiverCarvePatchAngular`, and `uSeaLevel` (the shared
  ocean level-set; the fine carve floods through the SAME F14 level-set as the trunks, so the host must
  already own `uSeaLevel`).

The carve cube is sampled `textureCube(uRiverCarveMap, normalize(vPos)).r` — pure direction, so it is
rotation-invariant and has no equirect seam; the host just needs object-space `vPos`.

## C. RADIUS — the geometry parameter (landed §1, `63159a6`)

The visible ribbons render **directly at the surface**, so they must be built at the game's geometric
radius. `buildRibbonGeometry` and `buildFineRibbonGeometry` now take `params.radius` (default `1.0` =
lab unit sphere = no-op). The port passes `radius = d.radius`. The whole ribbon scales uniformly:
centerline `dir * radius * LIFT` AND lateral width `* radius`, so the river keeps its angular footprint.

**Radius-invariant by construction (do NOT thread radius):** `buildValleyGeometry` (feeds the
direction-keyed carve cube) and `buildFineValleyGeometry` (feeds the angle-keyed ortho patch in planar
tan-space). Their vertex radius never reaches the surface — the cube/patch read by direction/angle, not
position magnitude. This is the audit's sharper read of the original "thread radius through all
builders" task: only the two ribbon builders are load-bearing.

`radius` (geometric) is **orthogonal** to two other scale concepts — keep all three separate:
- `radiusEarth` (AC6 width-proportioning) — scales river WIDTH as a fraction (real-km footprint),
  via `paramsForRadius`. About how thin rivers are, not how big the sphere is.
- `ribbonLift` (the un-occlude **mesh scale**, `eeddaab`) — a per-mesh radial nudge (~1.0004 effective)
  so the water sits just above the far hemisphere without X-ray. Composes with any geometric radius.

## D. RIBBON LIFT — larger for the coarse game icosphere

The lab's fine 256² sphere sits very close to the ideal sphere; the game icosphere is **detail-5**
(coarse), so its facets sag below the ideal sphere. A port needs a **slightly larger lift** than the
lab's tuned `ribbonLift` so the water clears the faceted floor at grazing angles. Tune live at the GPU
gate (the lift is already a runtime uniform/mesh-scale).

## E. DEPTH / CAMERA caveats (game-specific)

- **`logarithmicDepthBuffer: true`** (`RetroRenderer.js:49`). Any CUSTOM ribbon material MUST include
  the `logdepthbuf` GLSL chunks. Today's ribbon uses `MeshBasicMaterial` (vertex-coloured), which adds
  these automatically — so the current ribbon is fine; the caveat bites only if the port hand-rolls a
  shader for the ribbon.
- **Avoid `polygonOffset`** in the game — it interacts badly with log depth. Use the radial ribbon lift
  (§D) for occlusion separation, never polygon offset.

## F. LAB-GLUE — the non-portable bits the port re-implements

These are lab-host responsibilities, NOT in the portable core:
1. The unit-sphere `radius = 1.0` assumption — **removed** for the ribbons (§C); now a parameter.
2. `ensureNetworkRouted` / `riverOverlayState` / `state` orchestration — the lab's bake-on-demand and
   enable-flag wiring. The game supplies its own trigger (when/where to route + bake).
3. GUI knobs (the Rivers folder sliders) — lab-only.
4. Parenting the ribbons to the spinning `planet` so they co-rotate — the game re-parents to its own
   planet object; the geometry is object-space, so co-rotation is just correct parenting.
5. The host-material uniform/GLSL contract (§B) — the lab's shader hosts it today; Planet.js must.

## Not in scope here

The **graft-vs-replace** renderer-unification decision (add the lab's combiners onto the game's
type-branch shader vs. replace Planet.js's shader wholesale), which features ship, and where `type`
lives afterward — all stay in
[`lab-vs-game-renderer-divergence.md`](lab-vs-game-renderer-divergence.md) §4. This contract only names
what crosses the seam, not when or how the seam is crossed.
