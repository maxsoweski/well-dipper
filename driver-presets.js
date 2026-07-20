// driver-presets.js — the lab's body driver-preset vectors + archetype map, extracted
// verbatim from planet-lod-lab.html (World Engine V2-0 Slice A). Single source of truth so
// the lab GUI, the headless AC1 byte-identity harness, tests/planet-archetypes.test.js, and
// the V2-1 conformance oracle all read the SAME data (no scrape, no drift).
//
//   DRIVER_PRESETS    — all 17 body preset descriptors (incl. Mars + Hot Jupiter, which carry
//                       data but no archetype mapping).
//   PRESET_NAMES      — Object.keys(DRIVER_PRESETS), the GUI dropdown order.
//   PRESET_ARCHETYPE  — the 15 mapped preset-name -> RADIUS_RANGES_EARTH archetype tags
//                       (Mars + Hot Jupiter deliberately absent — see NAMED_BODY in the lab).
//
// Relocation only: values are byte-for-byte what the lab literal held at ad156cc; the
// tests/v2-0-slice-a-byte-safety.test.js deep-equal guard pins them to the pre-change snapshot.
//
// V2-6 slice-5 (draw-law extraction, Lens L21): NAMED_BODY + drawPresetRadius() are lifted OUT of
// planet-lod-lab.html to here so the lab GUI and calibration/population-sweep.mjs draw radii from ONE
// shared law (no scrape, no drift). Both the range lookup and the seeded draw live here; the lab
// imports drawPresetRadius and the harness will too. New draws use alea (mulberry32 retired) — see §1H.

import alea from 'alea';
import { RADIUS_RANGES_EARTH } from './src/core/ScaleConstants.js';

export const DRIVER_PRESETS = {
  // age (Gyr) is the D16 driver-response field surfaced this increment — read ONLY by the plate-path
  // bodyDrivers build below (terrestrial/ocean archetypes). Other presets omit it → bodyDrivers.age
  // defaults to 4.5 (= age0) in the writer → ageTerm 0 → no age response (the AC4 age-less guard).
  'Rocky (Earthlike)': { radiusEarth:1.0, massEarth:0.9, eccentricity:0.017, starMassEarth:332946, orbitRadiusEarth:23455, composition:{ironFraction:0.32,density:5.5,volatileFraction:0.15}, age:4.5, T_eq:288, tidalState:{locked:false}, atmosphere:{color:[0.5,0.6,0.9],retained:true,pressure:1.0,composition:'n2-o2'}, habitability:0.7, surfaceHistory:{erosion:0.4,bombardmentIntensity:0.55,resurfacingRate:0.1} },
  'Lava (hot airless)': { radiusEarth:0.9, massEarth:0.65, eccentricity:0.15, starMassEarth:332946, orbitRadiusEarth:938, composition:{ironFraction:0.7,density:7,volatileFraction:0.02}, T_eq:950, tidalState:{locked:true,lockType:'synchronous'}, atmosphere:null, habitability:0, surfaceHistory:{erosion:0,bombardmentIntensity:0.3,resurfacingRate:0.95} },
  'Ocean (temperate)': { radiusEarth:1.1, massEarth:1.3, eccentricity:0.02, starMassEarth:332946, orbitRadiusEarth:23455, composition:{ironFraction:0.28,density:5,volatileFraction:0.35}, age:3.0, T_eq:295, tidalState:{locked:false}, atmosphere:{color:[0.4,0.6,0.95],retained:true,pressure:1.5,composition:'n2-o2'}, habitability:0.9, surfaceHistory:{erosion:0.6,bombardmentIntensity:0.4,resurfacingRate:0.3} },
  'Titan (methane seas)': { radiusEarth:0.4, massEarth:0.025, eccentricity:0.03, starMassEarth:332946, orbitRadiusEarth:120000, composition:{ironFraction:0.18,density:1.9,volatileFraction:0.4}, T_eq:94, tidalState:{locked:false}, atmosphere:{color:[0.8,0.6,0.3],retained:true,pressure:1.5,composition:'n2-o2'}, habitability:0.05, surfaceHistory:{erosion:0.2,bombardmentIntensity:0.5,resurfacingRate:0.4} },
  'Frozen (airless)': { radiusEarth:0.5, massEarth:0.07, eccentricity:0.005, starMassEarth:332946, orbitRadiusEarth:117275, composition:{ironFraction:0.2,density:2.5,volatileFraction:0.3}, T_eq:60, tidalState:{locked:false}, atmosphere:null, habitability:0.05, surfaceHistory:{erosion:0.1,bombardmentIntensity:0.85,resurfacingRate:0.05} },
  // "Europa (icy moon)" exercises Cryo P7: tidal ENERGY (eccentric close orbit) + VOLATILE-rich
  // (water-ice crust, vf 0.5) + COLD (T_eq 110 K, frozen shell) → derives cryoActivity≈1, the SHARED
  // uCryoActivity gate F9/F10 read (chaos rafts + double ridges render from the preset, no lab knob).
  // The lab models planet-around-STAR self-heating, so the close eccentric orbit stands in for a real
  // moon's planet-sourced tidal flexing (the documented P7 seam) — same convention as "Lava" at orbit 938.
  'Europa (icy moon)': { radiusEarth:0.5, massEarth:0.07, eccentricity:0.1, starMassEarth:332946, orbitRadiusEarth:2500, composition:{ironFraction:0.2,density:2.0,volatileFraction:0.5}, T_eq:110, tidalState:{locked:true,lockType:'synchronous'}, atmosphere:null, habitability:0.05, surfaceHistory:{erosion:0.05,bombardmentIntensity:0.3,resurfacingRate:0.6} },
  // ── Phase 4b gas worlds (F24 zonal belts; F25/F27-F29 ride these same presets) ──
  // No solid surface: surfaceHistory zeros + resurfacing 1 derive the relief gates to
  // ~0 (and lavaCoverage 1 re-smooths the residual ridged base); volatileFraction 0.04
  // sits UNDER the bone-dry floor (0.05) so frost/glacial/sublimation/liquid all gate 0
  // — the h2-he envelope (composition 'h2-he', rainFactor 0) IS the visible surface.
  // rotationHours is NEW (D8 spin, the Rhines band-count driver): only the F24
  // derivation reads it; terrestrial presets omit it (defaults 24 h, inert behind
  // bandStrength 0). eccentricity stays near-circular: the lab's star-tidal model
  // scales with R⁵ and a giant's R≈10 would otherwise derive Io-grade lavaActivity.
  'Gas giant (Jovian)': { radiusEarth:11.2, massEarth:317.8, rotationHours:9.9, eccentricity:0.005, starMassEarth:332946, orbitRadiusEarth:122000, composition:{ironFraction:0.03,density:1.33,volatileFraction:0.04}, T_eq:125, tidalState:{locked:false}, atmosphere:{color:[0.78,0.62,0.44],retained:true,pressure:1000,composition:'h2-he'}, habitability:0, surfaceHistory:{erosion:0,bombardmentIntensity:0,resurfacingRate:1} },
  'Gas giant (Saturnian)': { radiusEarth:9.4, massEarth:95.2, rotationHours:10.7, eccentricity:0.005, starMassEarth:332946, orbitRadiusEarth:224000, composition:{ironFraction:0.03,density:0.69,volatileFraction:0.04}, T_eq:95, tidalState:{locked:false}, atmosphere:{color:[0.85,0.76,0.55],retained:true,pressure:1000,composition:'h2-he'}, habitability:0, surfaceHistory:{erosion:0,bombardmentIntensity:0,resurfacingRate:1} },
  'Ice giant (Neptunian)': { radiusEarth:3.9, massEarth:17.1, rotationHours:16.1, eccentricity:0.005, starMassEarth:332946, orbitRadiusEarth:705000, composition:{ironFraction:0.05,density:1.64,volatileFraction:0.04}, T_eq:55, tidalState:{locked:false}, atmosphere:{color:[0.35,0.48,0.85],retained:true,pressure:1000,composition:'h2-he'}, habitability:0, surfaceHistory:{erosion:0,bombardmentIntensity:0,resurfacingRate:1} },
  // ── F31 clouds-family presets (card §6.5 step 2 — data only) ──
  // "Venus (sulfuric shroud)" exercises regime 3 (opaque H2SO4 blanket, P18): co2 at
  // 92 bar trips the co2 && pressure > 10 venus gate; T_eq 737 derives a faint thermal
  // floor the blanket must hide (the zero-ground-leak check). rotationHours 5832 (the
  // 243-day retrograde spin) collapses F26 to the single-cell Titan/Venus regime.
  'Venus (sulfuric shroud)': { radiusEarth:0.95, massEarth:0.815, rotationHours:5832, eccentricity:0.007, starMassEarth:332946, orbitRadiusEarth:16888, composition:{ironFraction:0.3,density:5.24,volatileFraction:0.02}, T_eq:737, tidalState:{locked:false}, atmosphere:{color:[0.93,0.87,0.65],retained:true,pressure:92,composition:'co2'}, habitability:0, surfaceHistory:{erosion:0.3,bombardmentIntensity:0.2,resurfacingRate:0.7} },
  // "Sub-Neptune (hazy)" exercises regime 2 (photochemical haze mute, P19 — GJ 1214 b):
  // h2-he below BOTH the radius 6 and mass 10 sub-neptune gates. Gas-row conventions
  // (surfaceHistory zeros + resurfacing 1, volatileFraction 0.04 under the bone-dry
  // floor) so relief gates ~0; no rotationHours ⇒ default 24 h ⇒ bandCount 3 — the
  // 2-3 flat bands that survive under the mute (card §6 item F31c). Near-circular
  // 1 AU orbit keeps star-tidal lavaActivity 0 (the gas-row eccentricity lesson:
  // R^5/a^5 tidal at a close orbit would paint glowing cracks on the haze globe);
  // T_eq 550 is GJ 1214 b's — illustrative, not orbit-consistent, like the gas rows.
  'Sub-Neptune (hazy)': { radiusEarth:2.7, massEarth:8.2, eccentricity:0.002, starMassEarth:332946, orbitRadiusEarth:23455, composition:{ironFraction:0.1,density:2.2,volatileFraction:0.04}, T_eq:550, tidalState:{locked:false}, atmosphere:{color:[0.72,0.66,0.58],retained:true,pressure:1000,composition:'h2-he'}, habitability:0, surfaceHistory:{erosion:0,bombardmentIntensity:0,resurfacingRate:1} },
  // "Eyeball (locked temperate)" exercises regime 4 (P21 substellar pupil + terminator
  // ring): the FIRST locked preset WITH an atmosphere (card §5 — Lava/Europa are locked
  // but airless). Also flips the pre-plumbed F26 weatherLocked + F23 frostLocked eyeball
  // switches for free. Near-circular orbit keeps star-tidal heating quiet.
  'Eyeball (locked temperate)': { radiusEarth:1.0, massEarth:1.0, eccentricity:0.01, starMassEarth:332946, orbitRadiusEarth:23455, composition:{ironFraction:0.3,density:5.5,volatileFraction:0.25}, T_eq:270, tidalState:{locked:true,lockType:'synchronous'}, atmosphere:{color:[0.55,0.62,0.85],retained:true,pressure:1.0,composition:'n2-o2'}, habitability:0.5, surfaceHistory:{erosion:0.3,bombardmentIntensity:0.4,resurfacingRate:0.2} },
  // ── F32/F33 thermal preset (F32 card §6.5 step 2 — data only) ──
  // "Hot Jupiter (locked giant)" exercises the thermal pair: locked + h2-he +
  // retained trips the _hotJup gate (thermalStrength 1, day 1610 K / night 1100 K).
  // Gas-row conventions throughout (surfaceHistory zeros + resurfacing 1,
  // volatileFraction 0.04 under the bone-dry floor — the envelope IS the surface).
  // rotationHours 80 = pseudo-synchronous slow spin: bandCount clamps to the
  // 3-band floor (few broad bands under the glow). The orbit follows the gas-row
  // "illustrative, not orbit-consistent" convention: T_eq 1400 is DATA (a real hot
  // jupiter hugs its star), while orbitRadiusEarth 150000 keeps the R^5 star-tidal
  // term quiet — R 13 is the biggest disc in the lab and a close orbit would
  // derive Io-grade lavaActivity (glowing cracks on a gas deck, the gas-row
  // eccentricity lesson). Verified by node script through the real
  // deriveUniforms: lavaActivity 0.0052 — under the Jovian row's own 0.007.
  'Hot Jupiter (locked giant)': { radiusEarth:13, massEarth:400, rotationHours:80, eccentricity:0.005, starMassEarth:332946, orbitRadiusEarth:150000, composition:{ironFraction:0.03,density:1.3,volatileFraction:0.04}, T_eq:1400, tidalState:{locked:true,lockType:'synchronous'}, atmosphere:{color:[0.55,0.38,0.28],retained:true,pressure:1000,composition:'h2-he'}, habitability:0, surfaceHistory:{erosion:0,bombardmentIntensity:0,resurfacingRate:1} },
  // ── F40 dust-storm preset (card §6.5 step 1 — data only) ──
  // "Mars (arid rocky)" is the F40 carrier: the dry thin-but-present-atmosphere
  // world. retained co2 at 0.01 bar passes D6 retention as PRESENT but sits under
  // BOTH the 0.05-bar liquid retention gate and the F15/F16 saltation ramp —
  // liquidStability derives 0 three ways over (pressure, T_eq 210 outside both
  // liquid windows, and the gates multiply), so the fluvial stack stays relict-
  // only (erosion 0.35 = the Noachian valley-network evidence) and F40's dryness
  // gate passes. KNOWN MODEL TENSION (logged): real Mars saltates at 0.006 bar,
  // but the lab's F15/F16 air gate floors at 0.05 bar — dunes/dust-mantles derive
  // 0 here; F40 carries its own veil and does not read that ramp. volatileFraction
  // 0.1 clears the bone-dry floor JUST enough for a small H2O polar cap
  // (frostMaxCoverage ~0.06, condensation 273 K) without waking glacial (0.15
  // threshold) or liquid (the other two gates hold it at 0). ironFraction 0.10:
  // DELIBERATELY under Mars's true ~0.2 compositional share — the core's
  // iron-only D13 model cannot express a DEAD dynamo (field = iron x lock), and
  // 0.19 would derive a Titan-grade 0.19 polar oval on a world with no global
  // field; 0.10 lands a faint 0.10 (the Sub-Neptune faint-aurora precedent),
  // defensible as MAVEN's observed faint discrete/diffuse aurorae rather than
  // zero. axialTilt 25 (real 25.2 deg) spreads seasonal frost low per D3.
  // Eccentric 1.52 AU orbit keeps star-tidal heat ~0 (no lava/cryo). The co2
  // composition derives: pink CO2-dissociation aurora hue, rainFactor 0.2 (faint
  // F26/F30), regime-0 weather deck at low coverage (~0.29 via habitability
  // 0.05), terminator width clamped to the 0.06 hairline — with the recorded
  // Mars-blue sunset hue now LIVE in TERM_COLOR_BY_PRESET below (review N6).
  'Mars (arid rocky)': { radiusEarth:0.53, massEarth:0.107, rotationHours:24.6, eccentricity:0.093, starMassEarth:332946, orbitRadiusEarth:35652, axialTilt:25, composition:{ironFraction:0.10,density:3.93,volatileFraction:0.1}, age:4.5, T_eq:210, tidalState:{locked:false}, atmosphere:{color:[0.80,0.58,0.36],retained:true,pressure:0.01,composition:'co2'}, habitability:0.05, surfaceHistory:{erosion:0.35,bombardmentIntensity:0.7,resurfacingRate:0.15} },
  // ── V2-5 bombardment preset (impact-airless dead-rocky; the UAT target) — NON-GOLDEN by design ──
  // "Moon/Mercury (impact-airless)" is the V2-5 carrier: an airless, dead, cold, small rocky body whose
  // surface IS its impact record. It is added to DRIVER_PRESETS but DELIBERATELY NOT to PRESET_ARCHETYPE —
  // so the 75-golden carrier loop (Object.keys(PRESET_ARCHETYPE)) never sees it (LANDMINE #2), and it joins
  // the V2-3 dispatch oracle as an archetype-null row alongside Mars + Hot Jupiter. It routes dead-lid through
  // the EXISTING derived dispatch (no new dispatch rule, no label routing): g = 0.04/0.38² = 0.277 g → rocky
  // (density 4.5 > 3.9), lidStrength L≈0.588 < L_STRONG(0.63), T_eq 235 < 250 + Φ≈0.161 < 0.4 + rawTidal~0 ⇒
  // computeE1 = 'dead-lid' ⇒ writeBodyRelief rule (3f) despun (§5 arithmetic verified). orbitRadiusEarth
  // 117275 = Frozen/Crystal's cold-far distance ⇒ rawTidalIoRatio ~0 (guaranteed dead, no active tidal
  // resurfacing). UNLOCKED — else dispatch rule (3b) would route eyeball-despun, not dead-lid. atmosphere
  // null + volatileFraction 0.02 (bone-dry) ⇒ isImpactSurface (airless+dead+cold) fires ⇒ the bombardment
  // writer populates craterField. surfaceHistory (battered old surface) is legacy-knob consistency; the
  // crater writer reads condition.age (4.5), not these fields. NAMED_BODY (planet-lod-lab.html) locks its
  // canonical 0.38 R⊕ so drawPresetRadius never seeds a random radius ⇒ deterministic surfaceGravity.
  'Moon/Mercury (impact-airless)': {
    radiusEarth: 0.38, massEarth: 0.04, eccentricity: 0.05,
    starMassEarth: 332946, orbitRadiusEarth: 117275,
    composition: { ironFraction: 0.4, density: 4.5, volatileFraction: 0.02 },
    age: 4.5, T_eq: 235,
    tidalState: { locked: false },
    atmosphere: null, habitability: 0,
    surfaceHistory: { erosion: 0.05, bombardmentIntensity: 0.9, resurfacingRate: 0.05 },
  },
  // ── F41 magma-ocean preset (card §6.5 step 1 — data only) ──
  // "Magma (K2-141b)" is the F41 proper carrier: the locked iron-rich
  // super-Earth whose permanent dayside melts outright. T_eq 2000 -> T_ss
  // 2800 K (rock vaporizes — the K2-141b GCM endpoints) -> sea iso-angle
  // ~1.52 rad: the shoreline sits well inside the dayside, matching the
  // discovery papers' ~2/3-in-perpetual-daylight geometry. AIRLESS BY CHOICE
  // (atmosphere:null): the real body's silicate-vapor envelope is thin and
  // collapse-condensing — null keeps limb / terminator / aurora / clouds /
  // F40 naturally 0 (NO LIMB/TERM color-map rows needed: the N6 rule binds
  // ATMOSPHERIC presets only) and the rock-vapor wind/rain stack is the
  // card's logged v1 scope cut. volatileFraction 0 = bone-dry floor (frost /
  // liquid / sublimation / glacial / dunes all gate 0 — the nightside
  // rock-frost is F41's own term, not F22's). ironFraction 0.4 = the
  // measured iron-rich density class (D13 field 0.4 x 0.2 lock-damp = 0.08
  // — above the 0.05 gate but aurora needs an atmosphere: inert). Orbit
  // ~212 follows the Lava-row rough-consistency convention (a scales as
  // T^-2 from Lava's 938 at 950 K); at that distance even the token
  // eccentricity 0.01 saturates the R^5/a^5 star-tidal term ->
  // lavaActivity 1 + lavaCoverage 1 (resurfacing 1) — DELIBERATE: the card
  // §1 recipe row is F8 + F41 (crack glow rides the solid nightside while
  // the sea owns the dayside) and the molten interior keeps the surface
  // zero-age (craters 0 via bombardment 0, erosion 0). rotationHours 6.7 =
  // the locked spin (the real 0.28-day orbital period); only gas/atmosphere-
  // gated consumers read it — inert but honest data.
  'Magma (K2-141b)': { radiusEarth:1.5, massEarth:5, rotationHours:6.7, eccentricity:0.01, starMassEarth:332946, orbitRadiusEarth:212, composition:{ironFraction:0.4,density:8,volatileFraction:0}, T_eq:2000, tidalState:{locked:true,lockType:'synchronous'}, atmosphere:null, habitability:0, surfaceHistory:{erosion:0,bombardmentIntensity:0,resurfacingRate:1} },
  // ── F42 carbon-world preset (card §6.5 step 1 — data only) ──
  // "Carbon (high C/O)" is the F42 carrier: a warm airless super-Earth condensed
  // from a carbon-rich disk. composition.carbonToOxygen 1.2 is the ONE new data
  // field (D10 — deriveUniforms ignores unknown composition fields, so it rides
  // through core untouched and applyDrivers reads it from the preset directly;
  // every other preset omits it -> ratio 0 -> F42 inert, the regression
  // contract). UNLOCKED + T_eq 600 deliberately avoids the F41 magma class
  // (locked && T_ss > 1300 cannot fire: unlocked derives T_ss 0 outright) — the
  // hot molten 55 Cnc e variant is the card's logged v1 scope cut. AIRLESS
  // (atmosphere:null): limb / terminator / aurora / clouds / weather / F40 all
  // naturally 0 (no N6 color-map rows needed — the rule binds atmospheric
  // presets only). volatileFraction 0.02 sits UNDER the bone-dry floor (0.05):
  // frost / liquid / sublimation / glacial / dunes / dust-mantle all gate 0 —
  // no white frost diluting the dark-body read; the dark "flats" here are
  // F42's own tar, not F14 liquid. Orbit 23455 (1 AU) follows the Sub-Neptune
  // "illustrative, not orbit-consistent" convention: a T-consistent ~2350
  // orbit would saturate the R^5/a^5 star-tidal term (lavaActivity ~1 — Io
  // cracks glowing through the graphite); at 1 AU with eccentricity 0.01 it
  // derives ~0.001, and lavaCoverage 0.1 (resurfacing) keeps F8 a trace dark
  // basalt patch at most — consistent with an old carbon crust. bombardment
  // 0.5 + erosion 0.1 keep craters + sharp ridged relief ALIVE (the card asks
  // for relief interest: form must read through shading/silhouette on a
  // near-black world, and the crest probe needs real crests for glints).
  'Carbon (high C/O)': { radiusEarth:1.1, massEarth:1.4, eccentricity:0.01, starMassEarth:332946, orbitRadiusEarth:23455, composition:{ironFraction:0.3,density:6,volatileFraction:0.02,carbonToOxygen:1.2}, T_eq:600, tidalState:{locked:false}, atmosphere:null, habitability:0, surfaceHistory:{erosion:0.1,bombardmentIntensity:0.5,resurfacingRate:0.1} },
  // ── F43 crystalline-facet preset (card §6.5 step 1 — data only) ──
  // "Crystal (faceted)" is the F43 carrier: a small, cold, AIRLESS body with a
  // PRISTINE surface history — undisturbed lithology given the geological time to
  // grow a near-equilibrium facet field (the Naica-selenite / Pluto-blade template,
  // card section 4). The driver class is read from REAL fields (no new data column):
  // airless && erosion < 0.05 && resurfacingRate < 0.05 && bombardmentIntensity < 0.2.
  // erosion 0 + resurfacingRate 0 = nothing weathers or repaves the crust (the slow-
  // crystallization precondition); bombardmentIntensity 0.1 sits UNDER the 0.2 gate
  // yet keeps a few sparse craters alive so the world isn't a featureless ball under
  // the facets (the card asks for relief interest). AIRLESS (atmosphere:null): limb /
  // terminator / aurora / clouds / weather all naturally 0 (no N6 color-map rows
  // needed). volatileFraction 0.02 sits UNDER the bone-dry floor (0.05): frost /
  // liquid / sublimation / glacial / dunes / dust all gate 0 — no white frost diluting
  // the clean crystalline read. T_eq 150 (cool blue-grey) via orbit 117275 (the Frozen-
  // class cold-airless distance). radiusEarth 0.8 (small body). Every OTHER preset
  // fails at least one gate term (atmospheric presets fail airless; Lava/Magma fail
  // resurfacingRate ~1; Frozen/Europa/Carbon fail erosion ≥ 0.05) — the F43 regression
  // contract: ONLY this preset fires facetStrength 1.
  'Crystal (faceted)': { radiusEarth:0.8, massEarth:0.5, eccentricity:0.01, starMassEarth:332946, orbitRadiusEarth:117275, composition:{ironFraction:0.25,density:3.0,volatileFraction:0.02}, T_eq:150, tidalState:{locked:false}, atmosphere:null, habitability:0, surfaceHistory:{erosion:0,bombardmentIntensity:0.1,resurfacingRate:0} },
};

export const PRESET_NAMES = Object.keys(DRIVER_PRESETS);

// preset key → RADIUS_RANGES_EARTH archetype key (only used for the seeded-random presets).
export const PRESET_ARCHETYPE = {
  'Rocky (Earthlike)': 'terrestrial',
  'Lava (hot airless)': 'lava',
  'Ocean (temperate)': 'ocean',
  'Frozen (airless)': 'ice',
  'Gas giant (Jovian)': 'gas-giant',
  'Gas giant (Saturnian)': 'gas-giant',
  // ── V2-3 AC-TAXONOMY-NEPTUNE — SHARED TAXONOMY IDENTITY, DELIBERATE (Option B, plan §8/MF#2). ──
  // 'Ice giant (Neptunian)' and 'Sub-Neptune (hazy)' INTENTIONALLY share the 'sub-neptune' key:
  // an explicitly-shared taxonomy identity, not an accidental collision. Both resolve the SAME
  // RADIUS_RANGES_EARTH['sub-neptune'] = [2.5, 4.0] (Neptune itself = 3.88 R⊕ sits inside it),
  // so drawPresetRadius's seeded draw range is identical for both and the ROADMAP §3.1 radius
  // hazard — demoting Neptunian to 'gas-giant' [6.0, 14.0] and inflating a seeded Neptunian to
  // Jupiter size — CANNOT fire. Writer routes are identical too (both despun: gas-row dead-lid
  // under the derived dispatch AND under the legacy archetype chain). A distinct 'ice-giant' key
  // (Option A) is Max-gated out of scope: it would edit src/core/ScaleConstants.js AND bump the
  // frozen v2-0-preset-archetype.ad156cc.json fixture, both outside AC-ZERO-CLOBBER(g).
  // Guarded by tests/worldengine-v2-3-taxonomy.test.js.
  'Ice giant (Neptunian)': 'sub-neptune',
  'Sub-Neptune (hazy)': 'sub-neptune',
  'Eyeball (locked temperate)': 'eyeball',
  'Europa (icy moon)': 'ice',            // shell-relief increment: NAMED_BODY → real icy-active tag (else null+locked → locked-fallback)
  'Titan (methane seas)': 'volatile',    // shell-relief increment: COINED short key → volatile-cold (locked:false, single-covered, no fallback net)
  'Magma (K2-141b)': 'lava',             // magmatism increment: NAMED_BODY (locked) → the volcanic 'lava' tag. Without this, archetype resolves null+locked → shell's eyeball-despun locked-fallback (a misroute). NAMED_BODY still forces the canonical radius, so drawPresetRadius is unaffected.
  'Venus (sulfuric shroud)': 'stagnant-lid',  // #4b: NAMED_BODY (locked:false) → the coined 'stagnant-lid' key → writeStagnantLidReliefSphere. LOAD-BEARING: Venus has NO fallback net (unlocked, archetype null otherwise), so dropping this ONE line silently regresses Venus to sin²(lat). NAMED_BODY forces the canonical 0.95 R⊕ radius, so drawPresetRadius is unaffected.
  'Carbon (high C/O)': 'carbon',
  'Crystal (faceted)': 'crystal'
};

// ── V2-6 slice-5: shared preset-radius draw law (extracted from planet-lod-lab.html, Lens L21) ──
// NAMED_BODY worlds are the canonical-radius lock (no seeded draw ⇒ deterministic surfaceGravity):
// the AC-REROLL named-body clause. Every other archetype preset draws its radius from its
// RADIUS_RANGES_EARTH band. Single source of truth so the lab GUI and calibration/population-sweep.mjs
// stay byte-aligned.
export const NAMED_BODY = new Set([
  'Mars (arid rocky)', 'Titan (methane seas)', 'Europa (icy moon)',
  'Venus (sulfuric shroud)', 'Magma (K2-141b)', 'Hot Jupiter (locked giant)',
  'Moon/Mercury (impact-airless)'   // V2-5: canonical 0.38 R⊕ lock ⇒ deterministic surfaceGravity (no seeded radius draw)
]);

// Resolve the radius for a preset given a seed: canonical lock for named bodies, else a seeded
// draw from the archetype range (falls back to the preset's own radiusEarth if no mapping).
// V2-6 slice-5: the draw PRNG is alea('draw:radius:'+seed) — mulberry32 retired for new draws
// (its definition survives in the lab as the storm-e envelope guard; see §1H).
export function drawPresetRadius(presetName, seed) {
  const preset = DRIVER_PRESETS[presetName];
  const canonical = preset.radiusEarth ?? 1.0;
  if (NAMED_BODY.has(presetName)) return canonical;
  const arch = PRESET_ARCHETYPE[presetName];
  const range = arch && RADIUS_RANGES_EARTH[arch];
  if (!range) return canonical;   // archetype-less preset (overlay types) keep their value
  const r = alea('draw:radius:' + (seed >>> 0))();
  return range[0] + r * (range[1] - range[0]);
}
