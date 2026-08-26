# Scope: the "must span >= 4 render px" ruling, across surface rendering

**Max, 2026-08-26:** *"I want all of the relevant pipeline in scope; you determine what is relevant
to surface rendering across all objects/models in the game."*

## The scope boundary I am drawing, and why

**IN: anything that draws a SURFACE whose detail can fall below one render pixel.** That is the
class the ruling was written for — a feature too small to read is not detail, it is noise, and at
`pixelScale 3` (534x333) with no downsample it cannot average into tone.

**OUT: things that are sub-pixel BY NATURE** — stars, orbit lines, HUD strokes, distant billboards.
⭐ These have the opposite problem: they must be given a *minimum* size or they scintillate as they
cross pixel boundaries. Same underlying cause, opposite remedy, different work. Naming them here so
"out of scope" is a decision rather than an omission.

---

## Tier 1 — procedural surfaces. The ruling applies directly.

| family | files | state | mechanism it needs |
|---|---|---|---|
| Planet/moon base field | `heightNoise.glsl.js`, `height.glsl.js` | ✅ gated (`uFwClamp`, key `[K]`), footprint now anisotropic | done pending Max's verdict |
| Craters | `port/craterUniforms.js` | ✅ km-based physical floor | done |
| **Everything else on the planet — 68 uniforms** | `height.glsl.js` | ⛔ **no gate at all** | see below |
| **Rings** | ⭐ `Planet.js` `_createRing()` **:1764** — ⛔ **NOT** the three files this row first named; see below | ✅ **MEASURED 2026-08-26**, ⛔ not built | ⭐ **confirmed: bands fail the 4px bar over ~74% of the sky on the median body.** Wants the fbm-style screen fade — `fwidth(t)` against the band cycle count. Record: `ring-resolvability-measurement-2026-08-26.md` |
| **Asteroid belts** | `AsteroidBelt.js` | ⛔ unmeasured | many small bodies, most of them sub-pixel most of the time |

⛔ **THIS ROW ORIGINALLY NAMED `RingRenderer.js`, `ringConic.js` AND `OrbitRingSDF.js`, AND ALL
THREE WERE WRONG** — corrected 2026-08-26 after measurement. `RingRenderer.js` is dead code,
instantiated nowhere in `src/` (also recorded in `FEATURE_AUDIT_LEGACY §2.4` and `JOURNEY.md:48`).
`ringConic.js` and `OrbitRingSDF.js` draw **orbit** rings, which already measure their band in render
pixels and are OUT of scope by this document's own boundary two paragraphs up. The live planetary
ring is the legacy `sin(t*30.0)` path in `Planet.js`, in every case — its physics branch is inert
(`PlanetGenerator.js:561` passes `moons: []`, and `rings.physics` is read nowhere in rendering).
⛔ **And so the world-engine lab CANNOT judge the game's ring**: `world-engine-lab.html:489`
deliberately swaps in the dead physics path. The lab/game parity that is load-bearing for terrain
does not extend to rings.

**The 68, by family** — cities/districts (incl. `uMachWindowDensity`, the smallest thing we
deliberately draw), fluvial/outflow/karst, scarps/tessera/wrinkles/ridges/lineations,
dunes/cracks/facets/hex/shatter/subpits/chaos/blades/glints/lava/frost/bio, and the non-crater
voronoi consumers. ⚠ **They do not all want the same remedy:** a family whose law is already keyed
in km can take the crater-style physical floor; a pure in-shader pattern needs the fbm-style screen
fade. Which one each takes is a per-family call.

## Tier 2 — textured surfaces. Same ruling, different surface.

| family | files | state |
|---|---|---|
| Sol bodies (real NASA photos) | `BodyRenderer.js:388-389, :404-405` | ⛔ `minFilter = NearestFilter` — point-sampled minification, sparkles under motion. Worst case in the game, because photos carry full-spectrum detail |
| Billboards | `Billboard.js:71` | ⛔ same |
| Conic field | `OrbitConicField.js:411-413` | ⛔ same, plus `generateMipmaps = false` |
| RetroRenderer targets | `RetroRenderer.js:822-845` | ✅ correct as-is — these are 1:1 or magnifying, which is the retro look |
| Ship / cockpit models | `ShipLoader.js`, cockpit | ⛔ unmeasured |

⭐ **The fix here is one line per texture and is not a taste call:** keep `magFilter = NearestFilter`
(that IS the retro look) and set `minFilter = LinearMipmapLinearFilter` with mipmaps on. Retro where
the pixels are big; filtered where they are small.

## Tier 3 — make it a ruling rather than a habit

Today the bar is one sentence in one comment, re-derived by hand each time. Three layers:

1. **One shared constant + helper** for every law that emits a size in km.
2. **One GLSL helper** — `legibleWeight(footprint, freq)` — that every in-shader pattern multiplies
   its amplitude by. The fbm fade, generalised, so a new feature gets the gate by construction.
3. ⭐ **A fence test** that fails when a new frequency-bearing uniform lands with no gate. Same shape
   as the uniform-inventory ratchets that already exist — and those caught a bad change on
   2026-08-26, so the shape is proven in this repo.

## Sequencing — ⛔ this is the part that matters

**Nothing in Tier 1's "68" should start until Max has flown the current state and confirmed the
direction.** The terrain work is the pilot: it establishes what the bar looks like in motion, at
game parity, on the bodies where it bites hardest. Sweeping 68 features before that verdict risks
doing the same rework 68 times.

**Recommended order:** (a) Max's verdict on `[K]` at parity → (b) Tier 2 texture filtering, which is
small, self-contained and independent of the verdict → (c) Tier 1 rings + asteroids, measured first
→ (d) the 68, family by family, behind the Tier 3 helper → (e) the fence, last, so it locks in a
finished state rather than a moving one.
