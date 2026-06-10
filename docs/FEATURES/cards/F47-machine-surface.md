# Feature Card — F47 Machine / structured surface
Domain: Overlay · Lab status: ⬜(lab) · Build-seq phase: 4c

## 1. Description (WHAT)

Machine / structured surface — an artificial, engineered crust overlay (F-overlay group, domain: Overlay). Physical chain: L0 drivers D15 (→tech) + D16, with D7 (nightside lights) feeding the sibling F48, drive L1c process P28 "Technospheric development": a civilization builds out over civilizational time, replacing/coating natural terrain with engineered structures, running to planet-saturation (ecumenopolis, F49). F47 is the mid-band of that track: variants run from scattered structures up to a fully machined crust (circuit grid). No geomorphic formation exists — per the Appendix-A overlay design note, the representation is base-type + overlay layer compositing over a natural base planet (machine over a rocky base) whose own L0→L1→L2 chain still runs beneath, so base relief/weather show through where the overlay doesn't cover. Real-body examples: none — Dyson-tier hypothetical; nearest nascent analogs are Earth's engineered surface signatures (urban street grids and agricultural grids visible from orbit). WD type: machine (EXOTIC family). Inventory status: `[current]` (circuit grid) — referring to the legacy production shader, not the lab.

## 2. Current shader approach (HOW, as-built)

Unbuilt (aspirational) in planet-lod-lab.html — `machine` has no entry in the FEATURES registry (planet-archetypes.js:6-22) and no combiner in the lab shader. The slot it must fill already exists: the Stage-7 EXOTIC overlay placeholder (planet-lod-lab.html:1554-1556, "base-type + overlay-layer composite; consumes the FULL natural-base lit color + landMask; renders LAST among surface terms, before the envelope split; maturity→0 must reveal the bare stage-6 base"). Nearest existing machinery: the ★ emissive bypass channel (planet-lod-lab.html:1572-1581, the Option-C posterize(surface)+emissive split whose stated owners include city lights F48/49 and bioluminescence F46) is where glowing circuit traces belong, exactly like the F8 `lavaCrackEmissive` survivor. A legacy production implementation exists outside the lab: src/objects/Planet.js — planetType==15 pattern at :750-765 (3D `fract()` rectilinear grid-line SDF + intersection accent + per-cell hash for lit/dark cells), albedo at :825-831 (dark metallic base → accent on grid lines + bright tier), dark-side emissive grid glow at :903-917; palettes in src/generation/PlanetGenerator.js:260-266 (dark metal + amber/green/orange/cyan glow). Note the production grid is a 3D lattice intersected with the sphere (curved slice lines, no surface-aligned blocks) — the lab rebuild should not copy it verbatim.

## 3. Reference images (real + art)

- [real] https://earthobservatory.nasa.gov/features/CitiesAtNight/page1.php
  — ISS night photography of cities — rectilinear street grids read as crisp engineered lines against dark land, the nascent real analog of a machined surface.
- [real] https://science.nasa.gov/earth/earth-observatory/agricultural-patterns-6605/
  — Agricultural grids and circles from orbit — humanity's actual 'structured surface' texture: large coherent geometric tiles replacing natural terrain patchwise, not uniformly.
- [real] https://science.nasa.gov/earth/earth-observatory/windy-city-of-lights-153622/
  — Chicago's strict street grid at night — note the scale hierarchy: bright arterial lines, dimmer infill cells, irregular old districts vs compass-aligned new ones.
- [real] https://earthsky.org/space/kic-8462852-tabbys-star-no-alien-megastructure/
  — Tabby's Star / Dyson-swarm hypothesis — the scientific framing behind the 'Dyson-tier hypothetical' end of the variant range (it was dust, but the concept is the F47 ceiling).
- [art] https://www.denofgeek.com/movies/greebles-how-tiny-details-make-a-huge-star-wars-universe/
  — ILM greeble/kitbash principle (Death Star): mix smooth plates with dense detail regions — uniform fine texture kills the sense of scale; contrast sells hugeness.
- [art] https://www.deviantart.com/artofanrach/art/Machine-World-727558690
  — Machine-world concept art — fully industrialized surface with regions specialized by function: zonal variation, not one repeated tile.
- [art] https://steamcommunity.com/sharedfiles/filedetails/?id=1144654097
  — Stellaris 'Real Machine Worlds' planet textures — game-art treatment of machined crusts at globe distance: dark metal base, emissive trace networks, panel seams.

## 4. Math / modeling notes (HOW, from the field)

There is no geomorphology here — the field models artificial surfaces with pattern synthesis, not process equations. The standard toolkit: (1) rectilinear grid SDFs — `fract()`-based line distance, exactly what the production planetType==15 path does, but done as surface-aligned 2D grids via triplanar projection (blend weights `pow(abs(N), 4..8)`, per the research doc's triplanar row) or cube-face UVs, so panels lie ON the sphere instead of being a 3D lattice sliced by it; (2) hierarchical subdivision / greebling — recursive quad-splitting with per-cell hash (the kitbash principle formalized): 2-3 nested grid scales (district / block / trace) where a hash decides whether a cell subdivides, stays a smooth plate, or hosts dense detail — this gives the mixed smooth-vs-greebled contrast that sells scale; (3) Voronoi with Chebyshev/Manhattan metric for plate tessellation — the existing voronoi3d keystone (F2 craters' placement engine) reused with a different distance metric yields rectangular-ish panel plates, and IQ's border-distance pass (F2−F1, already in the research table) gives panel seams; (4) Truchet/circuit-tile patterns for trace routing inside lit cells. Composition follows the Stage-7 contract: a low-frequency FBM coverage mask thresholded by a technogenic-maturity driver (D15/D16 → a derived uniform like uTechMaturity, the same gate pattern as uCryoActivity for F9/F10) decides where machine plates replace the natural base — scattered structures at low maturity, full circuit grid at 1.0, bare Stage-6 base at 0. Posterization strategy per the research doc's spine ("route detail through normals/specular, not color"): panel-edge bevels go through the normal channel (grid border distance → perturbation, a height-terracing relative that survives the envelope), the dark-metal albedo stays nearly flat, and the glowing traces + per-cell-hash lit windows ride the ★ emissive bypass channel like F8's lava cracks so they stay crisp over the 6-level quantize and read on the night side. Most promising shader-side approach: a triplanar 2-scale rectilinear grid SDF (district + block) with per-cell hash subdivision and Chebyshev-Voronoi plate variety, composited over the full natural-base lit color through a maturity-driven FBM coverage mask in the Stage-7 slot; bevel relief through the normal, trace/window glow through the emissive bypass. One combiner, three reused keystones (triplanar weights, voronoi3d, fbmd mask), no new pipeline stages.

## 5. Isolation recipe (:9223)

Unbuilt — recipe for once it lands. Register it as `machine: { label: 'Machine surface (F47)', enableKey: 'machineEnabled', archetypes: ['technogenic'] }` in planet-archetypes.js FEATURES (new archetype, since none of the five existing natural archetypes fit an overlay), wired through the existing solo plumbing (setFeatureEnables, planet-lod-lab.html:2540-2543 / window._lab.solo at :2908). Then on the :9223 Chrome (chrome-devtools MCP, not Playwright): load the lab, run `window._lab.setPreset('Rocky (Earthlike)')` (the Appendix-A base for the machine overlay — the overlay-correctness test needs a visible natural base), set the maturity driver to full (whatever GUI knob derives uTechMaturity; until driver wiring exists, the lab folder's strength slider), then `window._lab.solo('machine')`. Distances (planet radii, clamp 1.1-30 per :2615): `window._lab.state.distance = 8` for the globe read (coverage-patch shapes + grid curvature over the limb), `= 3` for district structure, `= 1.5` for panel/trace detail near the LOD2 hysteresis. Sanity checks: solo off + maturity 0 must show the bare Rocky base (Stage-7 contract); rotate to the terminator to verify trace glow persists into the night side.

## 6. What to judge (UAT checklist)

- [ ] Does the surface read as engineered — straight seams, right angles, repeated rectilinear cells — against the organic FBM base, even after the 6-level posterize + Bayer dither chews the albedo?
- [ ] Does it read as an overlay ON a natural world: base relief/coast showing through between coverage patches at mid maturity, and the bare Stage-6 base returning cleanly at maturity 0?
- [ ] Do the coverage patches read as deliberate build-out (coherent blobs with hard engineered edges, scattered → saturated as maturity rises), not as random noise speckle?
- [ ] Is there a scale hierarchy — district / block / trace — so new finer grids resolve as the camera closes, implying hugeness rather than a single tiled texture (greeble principle: smooth plates contrasted with dense regions)?
- [ ] Do panel seams and bevels read through LIGHTING (edges catching the sun, dither texture from normal perturbation) rather than through albedo gradients the quantizer crushes?
- [ ] Do the glowing circuit traces and lit cells read as crisp un-banded emissive on the night side (bypass channel), the way F8 lava cracks do, while the dark-metal plates stay inside the posterized envelope?
- [ ] Do grid lines stay stable and continuous over the limb and poles as the sphere rotates — no polar pinching, no 3D-lattice slice artifacts, no shimmer at the envelope's pixel scale?

────────── below filled during UAT, NOT by the workflow ──────────

## 7. Verdict + tweak log

- Rating: (pending)
- Max's feedback: (pending)
- Tweaks applied: (pending)
- Re-verify: (pending)
- Status: open
