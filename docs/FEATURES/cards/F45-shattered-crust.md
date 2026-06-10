# Feature Card — F45 Shattered / fractured crust
Domain: Exotic · Lab status: ⬜ · Build-seq phase: 4c

## 1. Description (WHAT)

F45 "Shattered / fractured crust" (F-exotic-natural table, planet-visual-features.md:324) derives from P15 "Crustal tessellation / fracture" (:156): cooling-contraction or convective stress tiles the crust into regular polygons; **catastrophic stress shatters it into chaotic blocks**; slow crystallization grows facet fields — F45 is the chaotic-blocks endmember of that triplet (F44 hex = polygons, F43 crystal = facets). Drivers: D11, D16 (cooling), uniform lithology, D12/tidal stress; the fracture pattern records the body's disruption history. Intensity axis: "local fracture zone … globally shattered blocks." Real-body example: Miranda (analog — Voyager 2 patchwork of mismatched provinces, fault canyons up to 20 km deep, historically explained as disruption + reaccretion); Europa's Conamara Chaos is the small-scale sibling (F9, which shares the `shattered` type). WD types: shattered (the EXOTIC catastrophic-disruption preset, whose feature set is F45+F9 per :371), rocky, ice. Status: `[aspirational]` *(speculative)* — but per the overlay design note (:386), `shattered` is NOT an overlay exotic: it has a plausible natural physical premise (P15) driven by real L0 params, so it composes through the normal L0→L1→L2 relief chain.

## 2. Current shader approach (HOW, as-built)

Unbuilt (aspirational). No `shatter`/F45 entry exists in the FEATURES registry (/home/ax/projects/well-dipper/planet-archetypes.js:6-23) and no exotic archetype in ARCHETYPES (:27-33); nothing in planet-lod-lab.html references F45. Nearest existing machinery it should plug into: the F9 `chaosCombiner` (/home/ax/projects/well-dipper/planet-lod-lab.html:1171-1186) — a `voronoi3d` cell partition with per-cell constant raft height + per-cell CONSTANT tilt gradient and a recessed "refrozen matrix" between rafts, gated by a low-frequency region mask (`uChaosMaskScale`, uniforms :268-273, :1700-1704) — F45 is essentially that mechanism promoted from masked local patches to a global, two-scale block field; secondarily the F6 `tesseraCombiner` (:1022-1044, warped crosscutting lattice) for crack families, and the graben carve-down profile used by cryo chasma (:836-849). All would ADD IN to the unified relief accumulator (h/grad) at :1476-1509, behind a ≤0 early-out uniform per the registry convention.

## 3. Reference images (real + art)

- [real] https://science.nasa.gov/uranus/moons/miranda/
  — Miranda full-disc: discrete mismatched terrain provinces with sharp seams — the 'reassembled patchwork' read F45 wants at planet scale.
- [real] https://science.nasa.gov/photojournal/miranda-high-resolution-of-large-fault/
  — Verona Rupes (Voyager 2, 36,250 km): a single fault scarp ~20 km high — block boundaries read as huge shadow-casting cliffs, not soft slopes.
- [real] https://photojournal.jpl.nasa.gov/catalog/PIA01182
  — Conamara Chaos (Galileo): rigid crustal rafts shifted, rotated, and tilted in a lower jumbled matrix — the per-block tilt + recessed-matrix form, just scaled up for F45.
- [real] https://svs.gsfc.nasa.gov/11176
  — NASA SVS Europa chaos-terrain visualization: how block fields read at oblique lighting — borders carry the signal, block interiors stay flat.
- [art] https://outerwilds.fandom.com/wiki/Brittle_Hollow
  — Outer Wilds' Brittle Hollow: a stylized low-detail shattered planet where crust plates read as discrete chunks purely through silhouette + flat-shaded facets — proof the form survives heavy stylization.
- [art] https://deep-fold.itch.io/pixel-planet-generator
  — Deep-Fold's dithered pixel-planet generator: cracked/lava planet types show fracture networks reading clearly inside a Bayer-dithered, few-color envelope — directly our posterize regime.

## 4. Math / modeling notes (HOW, from the field)

Academia models catastrophic crustal disruption via impact-fragmentation physics: SPH disruption studies (Benz & Asphaug-style Q*_D thresholds) predict shatter-then-reaccrete rubble bodies, and fragmentation statistics (Mott/Grady theory, Weibull flaw distributions) show fragment patterns are well-approximated by Voronoi-like tessellations — which is exactly why DCC tools (Blender Cell Fracture, Houdini RBD) implement destruction as (often hierarchical/clustered) Voronoi cell fracture. In shader terms, every ingredient is already in the lab's vocabulary from RESEARCH_high-lod-planet-shaders-2026-06-05.md §3.1: a `voronoi3d` cell partition with per-cell hashed constant height offset + per-cell CONSTANT tilt gradient (the chaos-convention "cosmetic gradient" — voronoi3d returns ∂F1 only, so block interiors get exact flat-plate normals that land each block in its own posterize band); IQ's **Voronoi border distance (F2−F1)** two-pass for perpendicular edge distance, inverted into a graben-style carved-DOWN crack groove (reuse the cryo `grabenProfile`); light **domain warping** of the cell-space so crack lines go irregular instead of soap-bubble-regular; a low-frequency mask (the `uChaosMaskScale` pattern) sweeping the intensity axis from local fracture zone to globally shattered (mask→1); and all of it lighting-routed (perturb N from the accumulated grad) so the form survives the 6-level posterize. Two scales sell "shattered" over "paved": low-frequency mega-blocks (province scale, large height/tilt) plus a higher-frequency sub-fracture lattice within blocks (tessera-style or second voronoi octave); an optional emissive crack term added AFTER the posterize (the lava Worley-crack bypass from §3.3) gives a "freshly shattered / hot interior" variant. Most promising approach: write `shatterCombiner` as a globalized two-octave generalization of the existing `chaosCombiner` — voronoi3d mega-blocks with hashed flat height + constant tilt, F2−F1 border distance carved down as deep crevasses with graben walls, region mask defaulting to ~1 for the `shattered` type — adding into the unified h/grad accumulator behind a `uShatterStrength ≤ 0` early-out, exactly matching the registry's combiner conventions.

## 5. Isolation recipe (:9223)

Unbuilt — recommended recipe once built. Register in planet-archetypes.js FEATURES as `shatter: { label: 'Shattered crust (F45)', enableKey: 'shatterEnabled', archetypes: [<new 'exotic-shattered' archetype, or reuse 'icy-active'] }` so the lab's solo plumbing (planet-lod-lab.html:2539 setFeatureEnables / :2908 window._lab.solo) picks it up automatically. Then on the :9223 debug Chrome (chrome-devtools MCP, per well-dipper-testing-reference — NOT Playwright): open planet-lod-lab.html; `window._lab.setPreset('Frozen (airless)')` (best existing preset: airless, high bombardment, cold — closest to a disrupted body; add a dedicated 'Shattered (exotic)' DRIVER_PRESETS entry when the exotic types land); `window._lab.solo('shatter')`; judge at three distances via `window._lab.state.distance = 20` (full disc — global block patchwork), `= 8` (mid lodRamp — border crevasses resolving), `= 3` (LOD2 close — per-block tilt shading + sub-fracture lattice). Cross-check composition with F9: `window._lab.setPreset('Europa (icy moon)'); window._lab.solo('chaos')` shows the existing local-scale sibling. Restore with `window._lab.enableAllFeatures()`.

## 6. What to judge (UAT checklist)

- [ ] Do crustal blocks read as discrete rigid plates — flat or uniformly tilted tops, each landing in its own lighting band — rather than continuous noise lumps, in the 6-level posterized envelope?
- [ ] Do inter-block fractures read as carved-DOWN crevasses (a darker shadowed border band with cliff-like walls) separating plates, holding that read as the terminator sweeps across them?
- [ ] Does the pattern read at two scales — mega-province blocks (Miranda patchwork) subdivided by a finer crack lattice — so the disc says 'violently reassembled', not 'uniform paving stones' (which would read as F44 hex)?
- [ ] At full-disc distance (20 radii), does the limb stay a clean sphere while the surface reads chunked — i.e. does the shatter arrive as relief/lighting, not as albedo splotches that the posterize smears?
- [ ] Does the intensity axis behave: a masked local fracture zone with a sharp seam against intact crust at low strength, ramping to globally shattered blocks at full strength?
- [ ] Do adjacent blocks separate into different posterize bands often enough that the patchwork survives quantization instead of dissolving into dither noise at mid distance?
- [ ] Is the block pattern deterministic on re-approach — same seed, same plates, no temporal drift — consistent with the lab's domain-offset 🎲 convention?
- [ ] When composed with F2 craters (both enabled), do craters sit ON blocks and break at borders plausibly, rather than floating over the fracture field as an unrelated layer?

────────── below filled during UAT, NOT by the workflow ──────────

## 7. Verdict + tweak log

- Rating: (pending)
- Max's feedback: (pending)
- Tweaks applied: (pending)
- Re-verify: (pending)
- Status: open
