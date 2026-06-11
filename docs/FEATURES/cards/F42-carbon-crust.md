# Feature Card — F42 Carbon-world crust
Domain: Exotic · Lab status: ⬜ · Build-seq phase: 4c

## 1. Description (WHAT)

Carbon-world crust — surface mineralogy of a planet formed from a high carbon-to-oxygen disk, where graphite/silicon-carbide/diamond replace silicate rock. Sole L0 driver: D10 `carbonToOxygen` (C/O ratio, computed in `deriveComposition:344`, status [current]) — high C/O → carbon-planet surfaces (graphite/diamond/carbide, tar plains). The F42 row (planet-visual-features.md:321, F-exotic-natural group, [aspirational] *(speculative)*) lists three variants: graphite plain (near-black matte crust), diamond-studded ridges (crystalline high-pressure carbon at uplifted crests), and hydrocarbon/tar flats (reduced-carbon liquid/solid fills in basins). Real-body examples are all hypothesized: 55 Cancri e (the original "diamond planet" candidate, since downgraded) and PSR J1719-1438 b (crystalline-carbon pulsar companion); Titan's dark hydrocarbon dune/lake material and carbonaceous asteroids (Ryugu/Bennu, albedo 4-5%) are the nearest observed material analogs. WD types: carbon (headline — Appendix A row 365: "F42 + dark surface + emissive diamond glints"), crystal, rocky. Carbon worlds also inherit cross-listed features in carbon chemistry form: F11 hydrocarbon rivers, F14 methane/tar seas, F15 silicate-sand dunes, F21 karst.

## 2. Current shader approach (HOW, as-built)

Unbuilt (aspirational). No carbon/graphite/diamond/tar code exists in /home/ax/projects/well-dipper/planet-archetypes.js (no FEATURES entry — registry ends at `rivers`, lines 6-22) or planet-lod-lab.html. Nearest existing machinery it should plug into: the F8 lava system — `uLavaCoverage` region-mask resurfacing combiner (planet-lod-lab.html:1094-1120, fbm01+smoothstep region that SMOOTHS relief — the exact pattern tar flats need) and the F8 Worley F2−F1 emissive cracks (:1121+, uCrackScale/uCrackWidth :257-258) with the emissive-bypass channel (`uEmissiveBypass` :165, `uEmissive`/`uSpecStrength` :162-163, emissive added AFTER posterize) — the channel diamond glints need; plus the F23/F22 frost albedo-overlay pattern (`uFrostAlbedo` :288, coverage mask as albedo not relief) as the template for the dark graphite albedo mask. The D10 driver is already computed CPU-side (`deriveComposition:344` per the inventory) and just needs surfacing as a uniform.

## 3. Reference images (real + art)

- [real] https://www.isas.jaxa.jp/en/gallery/feature/ryugu/
  — JAXA Hayabusa2 Ryugu gallery — what 4-5% albedo carbonaceous material actually looks like: near-black matte surface where form reads almost entirely through shading and silhouette, our lowest-buckets target for the graphite plain.
- [real] https://science.nasa.gov/photojournal/titan-t16-viewed-by-cassinis-radar-july-22-2006/
  — Cassini radar view of Titan's dark hydrocarbon dune fields — organic material pooling as smooth dark flats between brighter rough terrain, the real-world template for tar-flat vs crust contrast.
- [real] https://en.wikipedia.org/wiki/PSR_J1719%E2%88%921438_b
  — PSR J1719-1438 b — the crystalline-carbon 'diamond planet'; data context for how speculative the whole class is (a license to stylize, not photo-match).
- [real] https://science.nasa.gov/exoplanet-catalog/55-cancri-e/
  — NASA's 55 Cancri e catalog page — the original carbon-planet candidate; note it's hot and molten, so a carbon world can legitimately share lava-world heat cues.
- [art] https://esawebb.org/images/weic2412a/
  — ESA/Webb 55 Cnc e artist's concept — dark rocky ball with sparse glowing accents against black; notice how few luminance values the artist needs, which maps cleanly onto 6 posterize levels.
- [art] https://asd.gsfc.nasa.gov/blueshift/index.php/2013/07/12/jasons-blog-next-stop-diamond-planets/
  — NASA Blueshift 'Next Stop: Diamond Planets' — artist renderings of diamond/carbon worlds; notice glints rendered as isolated bright specks on a dark body, the exact sparse-sparkle read we want.
- [art] https://www.centauri-dreams.org/2016/06/08/in-search-of-carbon-planets/
  — Centauri Dreams carbon-planet survey with artist impressions — tar-black crust framing; notice how the dark surface makes any rim/limb light and emissive accent carry the whole composition.

## 4. Math / modeling notes (HOW, from the field)

Academia models carbon planets via condensation chemistry, not geomorphology: above disk C/O ≈ 0.8 the condensation sequence swaps silicates for graphite, SiC, TiC, and (at depth/pressure) diamond (Kuchner & Seager's extrasolar carbon planets; Madhusudhan's carbon-rich 55 Cnc e interior). Visually that cashes out as three MATERIAL regimes, not new landforms — F42 is primarily an albedo/specular/emissive feature layered onto existing relief, which is exactly the inventory's framing (Appendix A: "F42 + dark surface + emissive diamond glints"). In research-doc vocabulary: (1) graphite plain = a large low-frequency albedo mask (the "lighting-routed detail" discipline — reserve albedo changes for low-frequency masks; relief still reads via the analytic-derivative FBM normals and dither texture); (2) tar flats = the F8 `uLavaCoverage` pattern verbatim — fbm01 + smoothstep coverage region that SMOOTHS relief in basins (height-based stratification gating so tar pools low), optionally with a broad soft specular; (3) diamond-studded ridges = a ridged-multifractal crest mask (the `1-abs(n)` fold already used by F1 mountains) intersected with sparse Voronoi-F1 hashed cells, each cell contributing a view/sun-dependent `pow(max(dot(N,H),0),k)` glint — the classic game snow-sparkle technique (per-cell hashed micro-normals) — routed through the Option-C emissive/spec bypass channel so glints stay crisp single-pixel-bright points instead of getting banded ("the few high-energy effects that look wrong when banded"). Most promising shader-side approach: a `carbonCombiner` in the F8 mold — one fbm coverage mask flattening relief into tar flats, one global dark-albedo multiply driven by a new `uCarbonRatio` uniform (surfaced from D10), and a crest×Voronoi glint term added after `posterize()` via the existing `uEmissiveBypass`/`uSpecStrength` path. No new keystone primitives needed; it composes voronoi3d, ridged FBM, and the emissive-bypass channel that all already exist in the lab.

## 5. Isolation recipe (:9223)

Unbuilt — recommended recipe once built: register in planet-archetypes.js FEATURES as `carbon: { label: 'Carbon crust (F42)', enableKey: 'carbonEnabled', archetypes: ['exotic-carbon'] }` (new archetype, or temporarily attach to 'volcanic' since it shares the heat/airless profile). Add a `'Carbon (high C/O)'` preset (clone 'Lava (hot airless)' at planet-lod-lab.html:2151 — hot, airless, tidally locked — plus `composition.carbonToOxygen: 1.2`); until then 'Lava (hot airless)' is the nearest base. Then on the :9223 lab Chrome: load planet-lod-lab.html, select the preset, run `window._lab.solo('carbon')` (the solo API at planet-lod-lab.html:2908 → setFeatureEnables), and judge at three distances via `window._lab.state.distance`: 20 (global silhouette — does it read as a dark world), 6 (LOD-ramp midpoint — tar flats vs crust boundaries), 2.5 (close-up — glint behavior; orbit the camera/sun to confirm glints are view-dependent). `window._lab.enableAllFeatures()` to clear solo.

## 6. What to judge (UAT checklist)

- [ ] Does the graphite crust read as a distinctly DARK body — terrain living in the lowest 1-2 posterize buckets — while relief still reads through dither texture and limb shading, not crushed to a featureless black disc?
- [ ] Do diamond glints read as sparse, crisp, single-bucket-bright specks that sit on ridge crests and shift as sun/camera angle changes (specular behavior), rather than static white noise sprinkled everywhere?
- [ ] Do the glints survive the 6-level Bayer envelope as sharp points (via the emissive/spec bypass channel) instead of being banded/dithered into soft blobs?
- [ ] Do tar/hydrocarbon flats read as smooth low-lying fills with crisp shorelines against rough crust — the same flooded-basin behavior as the F8 lava plains — so flat dither fields contrast with textured relief?
- [ ] Does material placement read as geology — glints on uplifted crests, tar pooled in basins, graphite everywhere else — rather than three random decal layers?
- [ ] At distance 20 does it read as one coherent 'black world with rare sparkle' silhouette; at distance 2.5 do all three materials stay distinguishable within 6 luminance levels?
- [ ] Does the dark albedo stay a low-frequency mask — i.e., no high-frequency albedo noise that would fight the dither and shimmer under the posterizer?

## 6.5 Build plan (working-Claude, 2026-06-10 — Phase 4c heavy loop)

Strategy: §4's three MATERIAL regimes layered on existing relief — no new
keystone primitives; composes the F8 coverage-combiner, ridged-FBM crest
fold, voronoi3d, and the emissive/spec bypass channel. Exemplars
`0161a93` (F41, freshest incl. preset pattern) / `b66550c` (F40).

1. **New preset (data)** — `'Carbon (high C/O)'`: airless, T_eq ~600,
   UNLOCKED (deliberately avoids the F41 magma class — locked+hot would
   fire a melt pond; the 55 Cnc e "hot molten carbon world" variant is a
   v1 cut), iron ~0.3, `composition.carbonToOxygen: 1.2`, near-black
   palette. Opens with `radiusEarth:`. No N6 rows (airless).
2. **New archetype (data)** — `'exotic-carbon'` in ARCHETYPES (bodies:
   55 Cnc e?, PSR J1719-1438 b; presets: the new one). Register `carbon`
   in FEATURES (archetypes: ['exotic-carbon']) + featureFolders +
   `carbonEnabled` default true + GUI "Carbon crust (F42)" in
   Surface — Exotic (driven `.listen()`: carbonRatio display, tarCoverage,
   glintDensity; ✓ enable LAST).
3. **Driver** — uCarbonRatio surfaced in applyDrivers from
   `_fp.composition.carbonToOxygen` (D10; CPU side already computes it —
   core.js untouched, preset data carries the field); feature fires at
   ratio > 0.8; all 15 existing presets derive 0/absent ⇒ inert.
4. **Graphite plain** — global dark-albedo multiply toward near-black
   (Ryugu 4-5% albedo), LOW-FREQUENCY mask only (one fbm01 octave at
   planet scale — no high-frequency albedo noise fighting the dither);
   relief keeps reading via normals + dither + limb.
5. **Tar flats** — the F8 uLavaCoverage pattern VERBATIM: fbm01 +
   smoothstep coverage region in the sanctioned relief-combiner chain
   (mirror lavaCombiner's integration exactly — this is the established
   height-domain combiner, NOT a new accumulator write), flattening
   basins into smooth dark fills with crisp shorelines + a broad soft
   specular (low exponent, dim — distinct from F36's liquid glint).
6. **Diamond glints** — crest mask (the F1 ridged 1-abs fold) ∩ sparse
   voronoi3d F1 hashed cells; per-cell hashed micro-normal →
   `pow(max(dot(Nc,H),0.0), k~60)` view/sun-dependent specks, routed
   POST-posterize via the emissive/spec bypass family — sparse crisp
   single-bucket-bright points on uplifted crests only.
7. **Plumbing** — PROV_CARBON=38 + PROVINCES neutral row + provinceWeight
   row + GLSL_NAME line; frame writer sole uniform owner; reserved-word
   audit (F40 lesson).

v1 scope cuts (logged, not built): hot/molten 55 Cnc e variant (carbon
preset is warm-airless); carbon-chemistry cross-inheritance (hydrocarbon
rivers/methane seas on carbon worlds — F11/F14 own those); SiC/TiC
spectral coloring; pressure-depth diamond stratification.

────────── below filled during UAT, NOT by the workflow ──────────

## 7. Verdict + tweak log

- Rating: **🟡 taste-call — VERIFIED_PENDING_MAX** (2026-06-10, Phase 4c heavy loop)
- Evidence (repo root + docs/FEATURES/screenshots, gitignored): `F42-carbon-d20.png` vs `F42-rocky-d20-ref.png` (dark body: lit-disc median lum 0 / mean 6.0 with 23% of px in the 10-50 relief band vs Rocky median 85 — dark but NOT featureless), `F42-carbon-glints-d3.png`(+yaw2 pair) (3 crisp 255-lum specks; yaw sweep 0/3/1/0 with zero centroid overlap — fully view-dependent), `F42-carbon-tar-d5-fixed.png` (smooth warm-dark basin fills, crisp shorelines).
- §6 checklist: dark body w/ readable relief 🟢 · sparse view-dependent crest glints 🟢 (crisp single-dither-cell blocks, on crust never in tar) · glints survive bypass 🟢 · tar flats 🟢 post-fix (warm-dark [9.0,5.7,4.0] R/B 2.2 vs near-neutral crust; basin gate keeps 1.0 = all-basins, not whole-world paint) · geology-not-decals 🟢 · whole-disc coherence 🟢 · low-freq albedo only 🟢. Tar sheen: broad dim un-dithered gradient patches, max 43 — nothing F36-like.
- New preset 'Carbon (high C/O)' (16th) + NEW archetype 'exotic-carbon' (filter machinery is open-set — rides free). 15-preset byte-identity hash-verified by the implementer live; carbon-class emissive zeroing unreachable elsewhere (only this preset carries composition.carbonToOxygen).
- Tweaks applied: 2 of 3 cycles, both on the tar coverage mapping. (1) Default 0.35 was PIXEL-IDENTICAL to 0 (visible onset ~0.55 — the basin gate restricts the raw F8 mapping) → flat 1.8 gain; re-verify showed the gain just moved the dead zone (walkable range only ~[0.28,0.45]). (2) Range remap cbCovEff = 0.5 + 0.38·knob → sweep 0/185/739/915/931 px at 0/0.15/0.35/0.6/1.0: strictly increasing, 4 distinct steps, default clearly visible, basin-gate cap intact.
- Code review (fable): APPROVE-WITH-FIXES (two stale load-bearing comments — F19 contract enumeration + "runs LAST" — fixed pre-verify). Notes: finite-diff path comment corrected; glints have NO LOD fade (vs F36's uLodRamp precedent) — at d20 they appear as intermittent single-frame pops during rotation, not continuous shimmer (verifier data, item 7).
- Taste forks for Max's lap: (a) glint sparsity — 2 of 4 yaw views at d3 had ZERO glints, and d20 "rare sparkle" is temporally rare (single-frame pops); knobs glintDensity + crest thresholds (0.05/0.16) exist, and the uLodRamp fade is the remedy if pops read as flicker; (b) tarCoverage is an authored knob NOT derived per-preset (setPreset doesn't reset it — verifier caught it left at 1.0); (c) carbon palette/identity overall (new world + new archetype); (d) 1 AU illustrative orbit (T-consistent orbit would saturate star-tidal → Io-grade glowing cracks — a possible deliberate hot-carbon variant later).
- Status: VERIFIED_PENDING_MAX
