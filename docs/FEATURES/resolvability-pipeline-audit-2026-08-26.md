# Where the "must span >= 4 render px" ruling applies — and where it does not

**Max, 2026-08-26:** *"make sure this ruling about resolution of objects is going to apply across
the rendering pipeline."*

⭐ **THE HONEST ANSWER: it currently applies in exactly TWO places out of roughly seventy.** This
file is the survey, so the gap is a list rather than a feeling. Nothing here is fixed yet except
where noted.

The ruling, stated once: **a feature must span at least 4 render pixels at the closest measured
approach framing to READ as that feature** — 2x Nyquist, because a thing has to show its parts, not
merely be detected. Original statement and arithmetic: `src/worldengine/port/craterUniforms.js:65-71`.
⛔ It matters here and not in a normal engine because `RetroRenderer` renders the scene NATIVELY at
`w/pixelScale` (534x333 today) with `NearestFilter` and `antialias: false` and then MAGNIFIES —
there is no downsample, so sub-pixel detail cannot average into tone. It point-samples, and moves.

---

## 1. WHERE IT APPLIES TODAY — two places

| where | the gate | notes |
|---|---|---|
| **Craters** | `CRATER_VIS_FLOOR_RAD = 9.6e-4` clips the size-frequency band at the raster floor | the ONLY physical, km-based resolvability floor in the engine |
| **The fbm octave stack** (`fbmd`, `fbmdRidged`, `fbmdHetero`, `fbmdDamped`, F-ECU border) | `uFwClamp` — tri-state as of 2026-08-26; arm 2 is the 4 px legibility bar, on key `[K]` | 5 shader sites; footprint made isotropic the same day |

## 2. ⛔ WHERE IT DOES NOT APPLY — about 68 frequency-bearing uniforms with NO gate at all

Counted by reading `src/worldengine/shaders/height.glsl.js`: **68 uniforms whose name carries a
spatial frequency** (`*Scale`, `*Freq`, `*Cells`, `*Density`, `*Count`). Only the five fbm sites in
§1 consult a screen footprint. Every other feature draws at whatever frequency its law emits,
regardless of whether that survives to a pixel. By family:

- **Cities / districts** — `uCityScale`, `uEcuBlockScale`, `uEcuDistrictScale`, `uMachBlockScale`,
  `uMachDistrictScale`, `uMachWindowDensity`. ⭐ Windows are the worst case in the whole engine: the
  smallest deliberate feature we draw.
- **Fluvial + outflow + karst** — `uFluvialFreq`, `uFluvialWarpFreq`, `uOutflowFreq`,
  `uOutflowGrooveFreq`, `uKarstDolineFreq`, `uKarstMazeFreq`, `uDeltaDensity`.
- **Tectonic / structural** — `uScarpFreq`, `uScarpWarpFreq`, `uTesseraFreq`, `uTesseraWarpFreq`,
  `uWrinkleFreq`, `uGroovedBandFreq`, `uDoubleRidgeFreq`, `uLineationFreq`, `uLineationWarpFreq`.
- **Surface texture** — `uDuneFreq`, `uDuneDensity`, `uCrackScale`, `uFacetScale`, `uHexScale`,
  `uShatScale`, `uShatSubFreq`, `uSubPitScale`, `uSubPolyScale`, `uChaosCellScale`, `uBladeFreq`,
  `uGlintDensity`, `uLavaScale`, `uFrostNoiseScale`, `uBioScale`.
- **Voronoi** — `uVoroScale`, `uVoroCells`, `uWeatherCells` (craters ride this one and ARE gated;
  the other consumers are not).

⚠ **Not all of these need the same treatment.** A feature whose law is already keyed in km can take
the crater-style physical floor; a pure in-shader pattern needs the fbm-style screen fade. Which one
each family wants is a per-family call, not a global switch.

## 3. ⛔ TEXTURES MINIFY WITH NO FILTERING AT ALL — the same defect, a different surface

`src/rendering/objects/BodyRenderer.js:388-389` and `:404-405`, `src/objects/Billboard.js:71`,
`src/objects/OrbitConicField.js:411-413` (which also sets `generateMipmaps = false`), and all four
`RetroRenderer` targets set **both** `magFilter` and `minFilter` to `NearestFilter`.

⭐ **Those two halves are not the same decision and should not share an answer.**
- `magFilter = NearestFilter` is the retro look, and is correct. Keep it.
- `minFilter = NearestFilter` means a texture being SHRUNK is point-sampled — one texel chosen per
  pixel, no averaging. That is not an aesthetic; it is aliasing, and it SPARKLES under motion.

⚠ **Sol's bodies are real NASA photographs** (see memory `sol-is-nasa-textured-not-representative`),
and a photo minified by point-sampling is the worst case for this. At `pixelScale 3` a distant planet
is only a few dozen render pixels across, so its texture is being minified hard. The standard fix is
mipmaps with `minFilter = LinearMipmapLinearFilter` while `magFilter` stays `NearestFilter` — retro
where the pixels are big, filtered where they are small. **Not changed here; it is a separate call.**

## 4. WHAT WOULD MAKE THIS A RULING RATHER THAN A HABIT

Today the 4 px rule is a sentence in one comment in one file, re-derived by hand each time. Options,
cheapest first — ⛔ none of these is chosen, this is the menu:

1. **One shared constant + helper**, imported by every law that emits a size in km, so the bar is
   stated once instead of transcribed. Cheap; catches the km-keyed families only.
2. **One GLSL helper** (`legibleWeight(screenFootprint, freq)`) that every in-shader pattern
   multiplies its amplitude by — the fbm fade generalised. Medium; catches the pattern families.
3. **A fence test** that fails when a new frequency-bearing uniform lands with no gate — the same
   shape as the uniform-inventory ratchets that already exist and that caught a bad change on
   2026-08-26. This is what stops the list in §2 growing again.

⚠ **Doing any of this widens the blast radius a long way past terrain** — §2 is most of the visible
surface detail in the game. It should follow Max's verdict on `[K]`, not precede it.
