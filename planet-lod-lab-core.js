// planet-lod-lab-core.js
// Pure CPU-side foundation math for the Planet LOD Lab.
// Imported by planet-lod-lab.html AND tests/planet-lod-foundation.test.js (DRY).
// No three.js / DOM deps — keep it unit-testable in node/vitest.
//
// This is the code that later grafts into production PlanetGenerator, so it
// earns real unit tests. The shader + UI live in the HTML and are verified
// visually through chrome-devtools (:9223).

export const clamp01 = (x) => Math.min(1, Math.max(0, x));
export const mix = (a, b, t) => a + (b - a) * t;

export function smoothstep(e0, e1, x) {
  const t = clamp01((x - e0) / (e1 - e0));
  return t * t * (3 - 2 * t);
}

// lodRamp: 0 (far) -> 1 (closest). e0 > e1 (descending) — detail RISES as distance shrinks.
export function lodRampOf(distanceRadii) {
  return smoothstep(20.0, 6.0, distanceRadii);
}

// Octave budget ramps with lodRamp: mix(4,9,lodRamp), then trimmed by qualityTier (0..1).
export function autoOctaves(lodRamp, qualityTier = 1.0) {
  const full = mix(4.0, 9.0, lodRamp);
  return mix(4.0, full, qualityTier); // qualityTier<1 trims the LOD2 octaves on weak GPUs
}

// Hysteresis on the discrete "is this body LOD2-active" flag.
// enter at 18 radii, exit at 22 radii — the 4-radius dead-band kills boundary flicker.
// prevActive: the flag's previous value. Returns the new flag.
export function lodHysteresis(distanceRadii, prevActive) {
  if (prevActive) return distanceRadii < 22.0; // stay active until we retreat past 22
  return distanceRadii < 18.0;                  // only activate once we're inside 18
}

// qualityTier 0 (mobile/cheap) -> 1 (desktop/full). Scales the cost knobs (spec §2.E).
export function qualityKnobs(qualityTier) {
  return {
    craterCells: qualityTier >= 0.5 ? 27 : 9,                  // 3D 27-cell vs tangent 9-cell
    atmosphereModel: qualityTier >= 0.5 ? 'raymarch' : 'fresnel',
    maxOctaves: Math.round(mix(4, 9, qualityTier)),            // 4..9
  };
}

// ── voronoi3d — KEYSTONE shared primitive (integration-index §1) ─────────────
// Seam-free 3D-domain cellular noise: relief craters (F2), cryo pits/polygons,
// exotic hex/crystal/shatter all route through ONE of these (do NOT fork). Built
// here as the CPU oracle the GLSL is transcribed from; the analytic gradient of
// F1 is pinned against finite-diff so the shader normal can be trusted.
//
// 3D domain (sampled on object-space position) is inherently seamless on the
// sphere — no UV seam, no pole pinch — which is the whole reason to pay for the
// 27-cell search (spec Q3 / index §5 risk #1). Returns:
//   f1       nearest jittered-center distance       (crater radial coordinate)
//   f2       second-nearest distance                (F2−F1 = border proximity)
//   cellId   integer lattice cell of the nearest    (per-cell hash: diameter, jitter)
//   toCenter vector fragment→nearest center         (radial direction)
//   grad     ∂f1/∂p = normalize(p − center)         (relief-normal contribution)
//
// hashCell mirrors the GLSL hash33 (sin-dot-fract) so JS and shader share shape.
export function hashCell(ix, iy, iz) {
  const dot = (a, b, c) => ix * a + iy * b + iz * c;
  const sx = Math.sin(dot(127.1, 311.7, 74.7)) * 43758.5453123;
  const sy = Math.sin(dot(269.5, 183.3, 246.1)) * 43758.5453123;
  const sz = Math.sin(dot(113.5, 271.9, 124.6)) * 43758.5453123;
  return [sx - Math.floor(sx), sy - Math.floor(sy), sz - Math.floor(sz)]; // [0,1)^3
}

// cells: 27 = full 3×3×3 neighbourhood (true global nearest, seam-free desktop path);
//         9 = reduced cheap/mobile search (lossy, never closer — the fallback-ladder path).
export function voronoi3d(p, cells = 27) {
  const ix = Math.floor(p[0]), iy = Math.floor(p[1]), iz = Math.floor(p[2]);
  const fx = p[0] - ix, fy = p[1] - iy, fz = p[2] - iz;       // fragment within its cell

  // 27 → full neighbourhood. 9 → the centre slab (gz=0) 3×3 plus the two axis
  // neighbours: a deliberately reduced lossy set for the untuned mobile tier.
  const offs = [];
  if (cells >= 27) {
    for (let gz = -1; gz <= 1; gz++)
      for (let gy = -1; gy <= 1; gy++)
        for (let gx = -1; gx <= 1; gx++) offs.push([gx, gy, gz]);
  } else {
    for (let gy = -1; gy <= 1; gy++)
      for (let gx = -1; gx <= 1; gx++) offs.push([gx, gy, 0]);
  }

  let f1 = Infinity, f2 = Infinity;
  let nCell = [ix, iy, iz], nR = [0, 0, 0];
  for (const [gx, gy, gz] of offs) {
    const h = hashCell(ix + gx, iy + gy, iz + gz);
    const cx = gx + h[0], cy = gy + h[1], cz = gz + h[2];     // center, relative to ix,iy,iz cell origin
    const rx = cx - fx, ry = cy - fy, rz = cz - fz;           // fragment → center
    const d = Math.sqrt(rx * rx + ry * ry + rz * rz);
    if (d < f1) {
      f2 = f1; f1 = d;
      nCell = [ix + gx, iy + gy, iz + gz];
      nR = [rx, ry, rz];
    } else if (d < f2) {
      f2 = d;
    }
  }
  // grad f1 = ∂|p−c|/∂p = (p−c)/|p−c| = −toCenter / f1  (center constant within cell)
  const inv = f1 > 1e-9 ? 1 / f1 : 0;
  return { f1, f2, cellId: nCell, toCenter: nR, grad: [-nR[0] * inv, -nR[1] * inv, -nR[2] * inv] };
}

// ── emissiveBlackbody — shared incandescence color ramp (integration-index §1) ─
// ONE curve, two consumers: Bands thermal (F32/F33, 500–3000 K) and Exotic magma
// (F41, 1500–4000 K). Returns CHROMATICITY only ([r,g,b] in 0..1, peak channel
// ≈1); the caller scales brightness (uThermalStrength × starFacing). The GLSL
// helper in planet-lod-lab.html is a transcription of these same stops.
//
// Stylized Planckian-locus ramp, not a spectral integration: piecewise-smooth
// interpolation between color stops anchored to real blackbody sRGB appearance
// (Mitchell Charity's blackbody datafile), normalized to the peak channel.
// Red saturates first (~Draper point) and stays maxed; green then blue climb as
// the body whitens. Posterize-bypass term, so banding isn't a concern — the
// smoothness here is for the emissive glow's hue, not its quantization.
const BB_STOPS = [
  { T:  800, c: [1.0, 0.18, 0.05] },   // deep dull red
  { T: 1500, c: [1.0, 0.42, 0.10] },   // orange
  { T: 2500, c: [1.0, 0.66, 0.32] },   // amber / yellow
  { T: 4000, c: [1.0, 0.85, 0.70] },   // warm white
  { T: 6500, c: [1.0, 0.98, 0.96] },   // white (ceiling; magma stays below)
];
export function emissiveBlackbody(tempK) {
  // Below the first / above the last stop → clamp to that stop (no runaway).
  if (tempK <= BB_STOPS[0].T) return [...BB_STOPS[0].c];
  const last = BB_STOPS[BB_STOPS.length - 1];
  if (tempK >= last.T) return [...last.c];
  // Find the bracketing segment and smoothstep-blend across it (matches the GLSL
  // chained-mix form, where each segment's weight is smoothstep(Tlo,Thi,tempK)).
  let c = [...BB_STOPS[0].c];
  for (let i = 1; i < BB_STOPS.length; i++) {
    const w = smoothstep(BB_STOPS[i - 1].T, BB_STOPS[i].T, tempK);
    c = [mix(c[0], BB_STOPS[i].c[0], w), mix(c[1], BB_STOPS[i].c[1], w), mix(c[2], BB_STOPS[i].c[2], w)];
  }
  return c;
}

// ── craterProfile — F2 analytic crater radial profile (relief doc §F2.a) ─────
// The crater shape as a function of normalized radius r = dist(fragment,center) /
// craterRadius, plus its analytic derivative dh/dr — the relief-normal term the
// GLSL accumulates as dhdr·∂r/∂p into the shading gradient. The GLSL craterCombiner
// is a transcription of this; pinning dhdr against finite-difference here is the
// relief-doc §5.4 silent-bug guard (a sign-wrong gradient lights inverted faces
// backward yet compiles fine — exactly what a CPU oracle catches before the shader).
//
//   cavity     parabolic bowl depth·(r²−1) inside r<1 (depth/diameter ≈0.2, simple)
//   rim        gaussian peak at r≈1, raised ~rimH above datum, decaying both ways
//   peak       morphology-gated central uplift (complex craters) — smoothstep bump
//   terraces   morphology-gated cos rings on the inner wall (slumped terrace look)
//   relaxation multiplies the whole profile → faint palimpsest (icy/old, F2.a)
// Beyond r≈2 every term has decayed to ~0 (distant cells don't bleed in).
const CRATER_DEPTH = 0.2, CRATER_RIM_H = 0.05, CRATER_PEAK_H = 0.14, CRATER_TERRACE_H = 0.02;
export function craterProfile(r, opts = {}) {
  const morphology = opts.morphology ?? 0;
  const relaxation = opts.relaxation ?? 0;
  const terraceCount = opts.terraceCount ?? 4;
  let h = 0, dhdr = 0;

  if (r < 1.0) {
    // parabolic cavity: −depth at the center → 0 at the rim (r=1)
    h    += CRATER_DEPTH * (r * r - 1.0);
    dhdr += CRATER_DEPTH * 2.0 * r;

    // central peak (complex): s(r) = smoothstep(0.4, 0, r) — 1 at the center, 0 by
    // r=0.4. ds/dr = 6t(1−t)·dt/dr with t=(r−0.4)/(0−0.4), dt/dr = 1/(0−0.4).
    const e0 = 0.4, e1 = 0.0;
    const tt = (r - e0) / (e1 - e0);
    if (tt > 0 && tt < 1) {
      const s = tt * tt * (3 - 2 * tt);
      const dsdr = 6 * tt * (1 - tt) * (1 / (e1 - e0));
      h    += morphology * CRATER_PEAK_H * s;
      dhdr += morphology * CRATER_PEAK_H * dsdr;
    } else if (tt >= 1) {
      h += morphology * CRATER_PEAK_H;       // r≈0 — fully on the peak (flat top)
    }

    // terraces: cos rings on the inner wall, morphology-gated (slumped rim look)
    const tw = CRATER_TERRACE_H * morphology;
    const w = 2 * Math.PI * terraceCount;
    h    += tw * Math.cos(w * r);
    dhdr += tw * -w * Math.sin(w * r);
  }

  // rim — gaussian around r=1, present just inside & just outside the cavity edge
  const rs = (r - 1.0) / 0.18;
  const rg = Math.exp(-(rs * rs));
  h    += CRATER_RIM_H * rg;
  dhdr += CRATER_RIM_H * rg * (-2.0 * (r - 1.0) / (0.18 * 0.18));

  const k = 1 - relaxation;                  // relaxation flattens to palimpsest
  return { h: h * k, dhdr: dhdr * k };
}

// ── ridgedFold — F1 ridged-multifractal per-octave fold (relief doc §F1.a/§5.4) ─
// The single highest silent-bug risk in the RELIEF domain (doc §5.4 risk #4): the
// Decarpentier sign correction on the abs() fold. Given a noise sample's value and
// its gradient (∂value/∂pos), the ridged signal is `s = offset − |value|`, then
// SHARPENED by squaring (`s²`) so ridges read as crisp crestlines. The crest is at
// value=0 (s=offset, the maximum); flanks fold downward as |value| grows.
//
//   value gradient d(s²)/dpos = 2·s·ds/dpos,  with ds/dpos = −sign(value)·grad
//   (the chain rule through BOTH the square AND the |.| fold — the `−sign` is the
//    correction; drop it and normals light inverted ridge faces backward, yet the
//    shader compiles fine. This oracle pins it against finite-difference in tests.)
//
// The GLSL fbmdRidged() is transcribed from this; the multifractal octave-weighting
// (weight = clamp(s·gain,0,1) applied to the NEXT octave) is a locally-constant gain
// modulation, NOT differentiated — standard (Musgrave/Decarpentier), so the per-octave
// fold here is the exactly-differentiable unit the finite-diff test pins.
export function ridgedFold(value, grad, offset = 1.0) {
  const signal = offset - Math.abs(value);
  const sgn = Math.sign(value);                 // 0 at value=0 — the crest, where the kink lives
  // d(s²)/dpos = 2·s·(−sign(value))·grad
  const k = 2.0 * signal * -sgn;
  return { value: signal * signal, grad: [k * grad[0], k * grad[1], k * grad[2]] };
}

// deriveUniforms: physics driver-bundle -> flat semantic uniform values.
// Generalizes the aurora/atmosphere precedent in PlanetGenerator.js:435-487
// (fieldStrength = composition.ironFraction * (locked ? 0.2 : 1.0); NO planetType branch).
// Mapping CONSTANTS are lab-tunable; the tests pin the LOGIC (hot->emissive, airless->no
// limb, etc.). Drivers schema mirrors PlanetGenerator's real fields.
export function deriveUniforms(drivers, qualityTier = 1.0) {
  const d = drivers || {};
  const iron = d.composition?.ironFraction ?? 0.3;
  const hasAtmo = !!d.atmosphere;
  const T = d.T_eq ?? 280;
  const erosion = d.surfaceHistory?.erosion ?? 0;
  const locked = !!d.tidalState?.locked;

  const hot = clamp01((T - 400) / 600);                          // 400K..1000K -> 0..1

  // ── §2 generation-side surfacings (index §2) ────────────────────────────────
  // surfaceGravity (#1): g = M/R² in Earth-relative units. massEarth + radiusEarth
  // are already in the generator's output (PhysicsEngine.estimateMassEarth), so
  // this is a pure derivation, not a new generator field. Gates Relief (crater
  // simple→complex transition F2, edifice height F7) + Aeolian (dune repose/scale
  // F15). Defaults to 1 g when the bundle omits mass/radius (robust, finite).
  const radiusEarth = d.radiusEarth ?? 1.0;
  const massEarth = d.massEarth ?? 1.0;
  const surfaceGravity = massEarth / (radiusEarth * radiusEarth);

  // tidalHeat (#2): the planet-level analog of PhysicsEngine.tidalHeating() — a
  // planet self-heats on an eccentric close orbit around its STAR (Relief risk #2).
  // Same Io-normalized physics (∝ e²·M_parent²·R_body⁵ / a⁵), star-parameterized;
  // raw scalar (huge dynamic range), the consumers map it to 0..1 (uLavaActivity
  // F8 / uVolcanismStrength F7 / cryoActive P7). Constants mirror the moon fn's Io
  // reference EXACTLY. Defaults to 0 (circular / no orbital data). Production TODO:
  // confirm eccentricity + star mass + orbit reach planetData (Relief flag §F8).
  const ecc = d.eccentricity ?? 0;
  const starMassEarth = d.starMassEarth ?? 332946;             // 1 M_sun in Earth masses
  const orbitRadiusEarth = d.orbitRadiusEarth ?? 23455;        // 1 AU in Earth radii
  const ioRef = (0.0041 * 0.0041) * (317.8 * 317.8) * Math.pow(0.286, 5) / Math.pow(66, 5);
  const tidalHeat = orbitRadiusEarth > 0
    ? (ecc * ecc * starMassEarth * starMassEarth * Math.pow(radiusEarth, 5) / Math.pow(orbitRadiusEarth, 5)) / ioRef
    : 0;

  // liquidStability + liquidSpecies (#3): the MASTER liquid gate (Fluvial owner;
  // read by Aeolian dryness, Cryo freeze-boundary, Optical glint-presence). Per the
  // Fluvial doc's master gate, a thermodynamically stable RETAINED liquid needs THREE
  // things AND'd together — any one zero ⇒ the whole fluvial/coastal/karst stack is
  // bypassed (the explicit "airless/bone-dry world skips this family" switch):
  //   D6 retention — an atmosphere holds enough pressure (a vacuum world boils/
  //                  sublimes any surface liquid away → 0).
  //   D2 volatiles — a volatile budget above the bone-dry floor (vf<0.05 ⇒ 0).
  //   D1 T-window  — T_eq sits inside a liquid window for SOME species.
  // liquidSpecies (enum 0=water, 1=methane/ethane — registry contract) names which
  // window T_eq landed in; methane/ethane is stable only at the cold Titan band.
  // Soft-edged windows so stability is a continuous 0..1 (no magic binary).
  const atmo = d.atmosphere;
  const retained = atmo ? (atmo.retained !== false) : false;
  const pressure = atmo ? (atmo.pressure ?? 1.0) : 0;            // bar-ish; presets mirror computeAtmosphere
  const retentionGate = retained ? smoothstep(0.05, 0.3, pressure) : 0;     // D6
  const volatileFraction = d.composition?.volatileFraction ?? 0.15;
  const volatileGate = smoothstep(0.05, 0.2, volatileFraction);             // D2 — bone-dry floor at 0.05
  const waterWindow   = smoothstep(248, 273, T) * (1 - smoothstep(373, 398, T));  // ~273–373 K plateau
  const methaneWindow = smoothstep(85, 90, T) * (1 - smoothstep(112, 120, T));    // ~90–112 K Titan band
  const tempWindow = Math.max(waterWindow, methaneWindow);                  // D1 — in-window for SOME species
  const liquidStability = clamp01(retentionGate * volatileGate * tempWindow);
  const liquidSpecies = methaneWindow > waterWindow ? 1 : 0;               // 0=water, 1=methane/ethane

  // volatileSpecies (#4): the Cryo frost-species classifier — a JS selector (the ONLY
  // allowed branch, in JS not shader), paralleling Clouds' cloudSpeciesFor(). Picks the
  // characteristic SOLID volatile from D2 volatileFraction + D1 T_eq condensation bands.
  // enum 0=none, 1=H₂O, 2=CO₂, 3=CH₄, 4=N₂ (descending condensation temp). Drives Cryo's
  // sublimation-landform combiner (F18) + frost albedo/tint (F22) when Cryo lands (step 3).
  // T_eq is the load-bearing axis (the doc's "D1 gates which species is solid"); a
  // composition refinement within a band (CO₂-atmo vs CH₄-outer) is a Cryo-step-3 TODO.
  const volatileSpecies =
    volatileFraction < 0.05 ? 0 :   // no volatile budget → no characteristic frost
    T > 273 ? 0 :                    // warm — liquid/Fluvial regime, no perennial frost
    T > 150 ? 1 :                    // H₂O water-ice caps (Earth/Mars)
    T > 90  ? 2 :                    // CO₂ dry-ice (Mars S-pole swiss-cheese)
    T > 40  ? 3 :                    // CH₄ bladed/penitente (Pluto Tartarus Dorsa)
    4;                               // N₂ convection polygons (Triton / Sputnik Planitia)

  // precipitation (#5): surfaces D4 "rain" as a first-class scalar (today only implied by
  // atmosphere composition). Feeds Fluvial F11 channel activity. Rain needs BOTH a
  // currently-stable liquid (liquidStability — covers water AND methane cycles) and an
  // atmosphere of a condensible-cycle TYPE. Composition strings come from computeAtmosphere:
  // n2-o2 (active cycle) full → co2-n2 partial → co2 (hot/dry) trace → h2-he (gas, no
  // surface)/none none. PAST rain on a now-dry world is carried by riverRelict (a later #).
  const atmoComp = atmo?.composition;
  const rainFactor =
    atmoComp === 'n2-o2'  ? 1.0 :
    atmoComp === 'co2-n2' ? 0.5 :
    atmoComp === 'co2'    ? 0.2 :
    0.0;                             // h2-he (no surface), none, or unknown → no rain
  const precipitation = clamp01(liquidStability * rainFactor);

  // magneticField (#7, D13): Q6-resolved — GENERATION derives, Optical reads (aurora F37);
  // also drives atmosphere stripping. Mirrors PhysicsEngine.js:168 fieldStrength EXACTLY
  // (ironFraction × lock-factor): a tidally-locked world spins slowly → weak dynamo → 0.2×.
  // auroraIntensity is now expressed in terms of it (= field gated by atmosphere) so the
  // two can't drift.
  const magneticField = iron * (locked ? 0.2 : 1.0);

  // ── F2 craters (Stage-C step 3, Relief domain — relief doc §F2.b) ───────────
  // The first VISIBLE Relief surfacing + first consumer of the voronoi3d keystone.
  // craterDensity = surface AGE: bombardment net of resurfacing. An old, heavily
  // bombarded surface is crater-saturated; Io-grade resurfacing (resurfacingRate→1)
  // wipes it to a near-zero-age crater-free plain (P6).
  const bombardment = clamp01(d.surfaceHistory?.bombardmentIntensity ?? 0.5);
  const resurfacing = clamp01(d.surfaceHistory?.resurfacingRate ?? 0);
  const craterDensity = clamp01(bombardment * (1 - resurfacing));

  // craterComplexD: the simple→complex transition DIAMETER, ∝ g⁻¹ (Melosh ch.6).
  // High-gravity worlds push craters complex at SMALLER sizes (Earth ~3 km vs Moon
  // ~20 km) → a denser-g world has a smaller transition → MORE central-peak craters.
  // k is switched by volatiles (icy crust is weaker — transitions at a smaller
  // diameter → smaller k). Crater-radius units, lab-tunable; clamp g away from 0 so
  // a zero-mass bundle can't divide-by-zero. The shader blends morphology with NO
  // type branch: smoothstep(complexD·0.6, complexD, hashedDiameter).
  const kRocky = 0.9, kIcy = 0.45;
  const kMorph = mix(kRocky, kIcy, volatileGate);          // volatileGate = D2 bone-dry→volatile ramp (#3 above)
  const craterComplexD = kMorph / Math.max(surfaceGravity, 0.05);

  // craterRelaxation: viscous relaxation flattens craters into faint palimpsests on
  // icy AND warm surfaces (Ganymede). Needs a volatile budget × warmth toward the
  // ice-melt range — cold airless rock barely relaxes; warm ice ghosts its craters.
  const relaxWarmth = smoothstep(120, 273, T);
  const craterRelaxation = clamp01(volatileFraction * relaxWarmth * 2.0);

  // ── F1 mountains / ranges (Stage-C step 3, Relief domain — relief doc §F1.b) ─
  // Ridged-multifractal base relief, the layer every other relief feature sits on.
  // mountainAmp: ranges GROW with tectonic/volcanic activity, SHRINK as the surface
  // erodes (old worlds = rounded low ranges). The proxy for "young/active" is simply
  // (1−erosion); a constant base scales it into a felt amplitude. Stays in 0..1.
  const habitability = clamp01(d.habitability ?? 0);
  const mountainAmp = clamp01(mix(0.25, 0.6, 1 - erosion));

  // orogenyStrength: blends isotropic ridged hills (0) ↔ anisotropic linear fold
  // BELTS (1, the "Himalaya" look). True fold-mountain belts need plate subduction,
  // which water lubricates — so habitability (D15) is the subduction proxy — AND a
  // young-age window (belts haven't eroded flat yet → ×(1−erosion)).
  const orogenyStrength = clamp01(habitability * (1 - erosion));

  // orogenyAxis: a stable per-planet strike direction (unit vec2) hashed from seed,
  // so a planet's ranges share a coherent grain. Lab-tunable downstream via an angle
  // knob; production passes the real planet seed. Deterministic, magnitude 1.
  const seed = d.seed ?? 0;
  const sa = Math.sin(seed * 12.9898 + 1.7) * 43758.5453;
  const orogenyAngle = (sa - Math.floor(sa)) * Math.PI * 2;      // [0, 2π)
  const orogenyAxis = [Math.cos(orogenyAngle), Math.sin(orogenyAngle)];

  return {
    mountainAmp,                                                // F1 — ridged base relief amplitude (erosion-softened)
    orogenyStrength,                                            // F1 — isotropic ridged ↔ anisotropic fold-belt blend
    orogenyAxis,                                                // F1 — per-planet strike direction (unit vec2, seed-derived)
    surfaceGravity,                                             // Earth-relative g (Relief F2/F7, Aeolian F15)
    tidalHeat,                                                  // Io-normalized planet self-heating (Relief F8/F7, Cryo P7)
    liquidStability,                                            // master liquid gate (Fluvial owner; Aeolian/Cryo/Optical read)
    liquidSpecies,                                              // 0=water, 1=methane/ethane (Optical glint IOR/tint)
    volatileSpecies,                                            // Cryo frost classifier 0=none/1=H₂O/2=CO₂/3=CH₄/4=N₂ (F18/F22)
    precipitation,                                              // D4 rain 0..1 (Fluvial F11 channel activity)
    pressure,                                                   // atmosphere surface pressure passthrough (Aeolian grain transport F15)
    magneticField,                                              // D13 dynamo strength (Optical aurora F37 + atmo stripping)
    craterDensity,                                              // F2 — Voronoi cell-fill probability (surface age)
    craterComplexD,                                             // F2 — simple→complex transition diameter (g⁻¹, icy-switched)
    craterRelaxation,                                           // F2 — icy/warm palimpsest flattening
    terraceCount: 4,                                            // F2 — inner-wall terrace ring count (constant, lab-tunable)
    emissive: hot,                                               // lava glow on hot bodies
    limbStrength: hasAtmo ? 0.7 : 0.0,                           // rim glow needs an atmosphere
    specStrength: hasAtmo ? mix(iron * 0.15, 0.8, clamp01(liquidStability / 0.5)) : iron * 0.15,  // ocean specular vs faint metal sheen
    auroraIntensity: magneticField * (hasAtmo ? 1 : 0),         // Optical reads the field; aurora needs an atmosphere to excite
    cloudCoverage: hasAtmo ? clamp01((d.habitability ?? 0) + 0.2) : 0,
    reliefAmplitude: mix(1.0, 0.6, erosion),                     // eroded worlds = softer relief
    ...qualityKnobs(qualityTier),
  };
}
