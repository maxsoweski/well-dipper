# Feature Card — F19 Mass-wasting deposits
Domain: Gradational · Lab status: ⬜ · Build-seq phase: 4a

## 1. Description (WHAT)

Mass-wasting deposits (F19, Gradational family) — surface expression of P12 Mass-wasting: slope material fails under gravity and runs out as landslides, slump scarps, talus aprons, and ice-cemented lobate debris aprons (docs/FEATURES/planet-visual-features.md:153, :241). Physical chain: steep relief (made by other processes — scarps, crater walls, canyon walls) + gravity (D14 mass/g, which also sets dune/talus repose angle, :105) + a trigger (quake, undercutting) + optionally D2 ground ice (volatile budget, :93) for the viscous-flow LDA variant. Timescale signature: a single event leaves one sharp lobe; slow creep builds aprons. Intensity axis runs small slump → long-runout sturzstrom (runouts 20-30x the fall height). Variants per the L2 row: landslide lobe · slump terraces · talus apron · lobate debris apron. Real-body examples: Valles Marineris canyon-wall landslides, Mars lobate debris aprons (Deuteronilus/Promethei Terra, nearly pure ice under a debris armor), and Iapetus ice sturzstroms (largest in the solar system, up to 80 km runout). WD types: all rocky + ice (listed in the 'rocky' archetype feature set at :359). Status: [aspirational].

## 2. Current shader approach (HOW, as-built)

Unbuilt (aspirational) — no mass-wasting key exists in the FEATURES registry (/home/ax/projects/well-dipper/planet-archetypes.js:6-22) and no talus/landslide/slump combiner exists in planet-lod-lab.html; all grep hits for "apron"/"slope" belong to other features. The nearest existing machinery it should plug into: (1) F3's ejectaProfile/ejectaCombiner (planet-lod-lab.html:740-775) — an analytic radial deposit profile (1/r² skirt blended with a Gaussian terminal rampart ridge, exact dh/dr) that is already, mathematically, a lobate-deposit shape; (2) fbmdDamped slope-damped FBM (planet-lod-lab.html:923-949) — the "erosion FBM" whose accumulated analytic gradient gives a free per-fragment slope measure, dot(grad,grad); (3) the F17 glacial block (planet-lod-lab.html:1306-1345), which already computes a coarse REGIONAL slope to pond an ice mantle in low-slope basins and align flow lineations — exactly the "deposit collects where slope drops" mechanic mass-wasting needs, run at the foot of steeps instead of in basins; (4) F5 scarpProfile (planet-lod-lab.html:853 area) and the F2/F4 crater/canyon walls as the steep "source" relief whose accumulated gradient gates where deposits may appear. A new massWasting combiner would read the running (h, grad) accumulator after the host-relief combiners and add slope-gated deposits, registered in FEATURES with archetypes spanning impact-airless / tectonic-terrestrial / volcanic / icy-active / volatile-cold.

## 3. Reference images (real + art)

- [real] https://www.uahirise.org/ESP_022632_1670
  — HiRISE landslides in Valles Marineris — tongue-shaped lobes with a sharp head scarp above and a textured runout fan below; note the smooth deposit against rough wall rock.
- [real] https://www.jpl.nasa.gov/images/pia12996-lobate-debris-apron-in-deuteronilus-mensae/
  — Lobate debris apron in Deuteronilus Mensae — a thick convex-edged collar wrapping a mesa base, reading as one smooth raised shelf rather than scattered rubble.
- [real] https://www.uahirise.org/ESP_020319_1470
  — Ice-rich LDAs in Promethei Terra — apron surface texture is uniform and low-frequency compared to the plateau it drains from; the boundary is a clean lobate contour.
- [real] https://planetarygeomorphology.wordpress.com/2014/12/01/diverted-landslides-in-valles-marineris/
  — Diverted Valles Marineris landslides — runout lobes deflect around obstacles, showing flow-following behavior (lobe axis tracks local downslope, not a circle around the source).
- [real] https://planetarygeomorphology.wordpress.com/2013/09/16/sturzstroms-on-saturns-moon-iapetus/
  — Iapetus sturzstroms — extreme long-runout ice avalanches off crater rims; the icy end-member where lobes stretch many times their fall height across crater floors.
- [art] https://www.rioki.org/2014/08/23/procedural-terrain-ue4.html
  — Procedural terrain material driven purely by slope masks (cliff vs. scree vs. flat) — the classic slope-threshold dispatch our combiner generalizes, no painted maps.
- [art] https://80.lv/articles/creating-a-snowy-landscape-in-ue4-terrain-and-organic-shaders
  — Slope-blended snowy-terrain shaders — how a smooth mantling material banked against steeps reads at a stylized level of detail; the value contrast (smooth fill vs. rough rock) is the look to keep.
- [art] https://gamesartist.co.uk/layered-cliff/
  — Stylized layered-cliff breakdown — hand-authored cliffs put debris wedges at the base for silhouette grounding; that wedge-at-the-foot read is what F19 must produce procedurally.

## 4. Math / modeling notes (HOW, from the field)

Geomorphology models mass-wasting in two regimes. (1) Continuous creep/talus: hillslope diffusion — Culling's linear law ∂h/∂t = κ∇²h, refined by Roering et al.'s nonlinear flux q = κ∇h / (1 − (|∇h|/Sc)²) which diverges as slope approaches a critical angle Sc (the angle of repose, ~30-35° for dry talus, lower for ice-cemented flow); the steady-state result is straight slope faces standing at Sc with smooth concave aprons banked below. (2) Discrete failure: a landslide is a slope-stability threshold event; its deposit is characterized by Heim's ratio H/L (fall height over runout length) — ordinary slides ~0.5, sturzstroms anomalously mobile at ~0.1, which is why Iapetus lobes run 20-30x their drop. Games/procgen approximate regime 1 with Musgrave-style "thermal erosion": any cell steeper than the talus angle sheds material to its downhill neighbor until everything sits at repose — an iterative cellular sim we cannot run per-fragment (same determinism/ping-pong restriction the research doc applies to Gray-Scott/stable-fluids, RESEARCH_high-lod-planet-shaders-2026-06-05.md §3.3). Terrain shaders instead fake the *result* with slope masks (world-aligned slope-blend materials: scree texture where the normal tilts past a threshold). Our codebase already has the analytic equivalent of both halves: the running gradient from analytic-derivative noised() FBM gives exact per-fragment slope for free (§3.1 "slope-damped FBM — free erosion"), and ejectaProfile is a vitest-pinned analytic radial lobe (skirt + rampart ridge) with exact dh/dr. Most promising shader-side approach: a massWasting combiner that (a) computes a coarse REGIONAL slope (the F17 pattern at planet-lod-lab.html:1333-1345), (b) adds a talus-apron fill term where regional slope falls off below a steep neighbor — height blended toward a repose-clamped envelope, with fbmdDamped killing high-frequency octaves on the deposit so it reads smooth against rough source walls — and (c) hash-seeds discrete landslide lobes on a steep-slope mask via the existing Voronoi placement machinery, shaping each with an ejectaProfile-style skirt+rampart profile stretched along −grad (downhill) instead of radially. All of it is relief routed through normals (lighting-routed detail), so it survives the 6-level posterize by design; D14 gravity scales the repose threshold and D2 ground ice swaps talus-wedge parameters for fat convex LDA collars.

## 5. Isolation recipe (:9223)

Unbuilt — recommended recipe once built. Register the feature in planet-archetypes.js FEATURES as key 'massWasting' (label 'Mass-wasting (F19)', enableKey 'massWastEnabled', archetypes: impact-airless, tectonic-terrestrial, volcanic, icy-active, volatile-cold); the lab auto-generates its GUI solo button and solo key from the registry. Then, in the second Chrome on :9223 (per memory/chrome-devtools-9223-launch.md), open planet-lod-lab.html and run: window._lab.setPreset('Rocky (Earthlike)'); window._lab.solo('massWasting'). CAVEAT unique to this feature: it is parasitic on slope — solo alone disables the steep host relief that sources the deposits — so after solo, re-enable one host: window._lab.state.scarpsEnabled = true (or cratersEnabled for crater-wall talus) so deposits have something to bank against; judge the pure-solo state only to confirm the early-out (no deposits without steeps = correct). Distances: window._lab.state.distance = 3.0 for the regional read (lobes at scarp feet, apron bands hugging relief), then 1.3-1.5 surface-skimming for the detail-contrast read (smooth apron vs. rough wall under the dither). Repeat with setPreset('Frozen (airless)') + cratersEnabled for airless crater-wall talus, and setPreset('Europa (icy moon)') for the ice/LDA variant. Clear with window._lab.enableAllFeatures().

## 6. What to judge (UAT checklist)

- [ ] Does the talus apron read as a smooth low-detail wedge banked against rough steep walls — i.e., does the deposit/source DETAIL CONTRAST survive as calm dither bands against busy wall texture in the 6-level posterized envelope?
- [ ] Does each landslide read as a downslope-pointing tongue/lobe — head scarp above, raised terminal edge below — rather than a symmetric blob around its seed point?
- [ ] Does placement obey slope: deposits only at the foot of steep relief (scarps, crater walls, canyon walls), never sprinkled on flats or crests, and vanishing entirely when host relief is disabled?
- [ ] Does the lobate-debris-apron variant (ice worlds) read as a thick convex-edged collar wrapping a mesa/massif base, visibly fatter than the thin talus skirt of the dry variant?
- [ ] Does runout direction follow downhill: lobes elongated along −gradient, with long-runout (sturzstrom) lobes reading as stretched tongues rather than circles?
- [ ] Do deposits overprint the host relief — burying the lower wall's texture under the smooth fill — rather than blending through it translucently?
- [ ] Under the 4x4 Bayer dither at surface-skimming distance, does the apron stay as stable flat posterize bands (smoothness reads as calm) instead of shimmering?
- [ ] Does gravity scaling behave: on a low-g preset do aprons stand steeper/shorter, and on ice presets do they slump fatter, in a way that reads as form change, not just amplitude change?

────────── below filled during UAT, NOT by the workflow ──────────

## 7. Verdict + tweak log

- Rating: (pending)
- Max's feedback: (pending)
- Tweaks applied: (pending)
- Re-verify: (pending)
- Status: open
