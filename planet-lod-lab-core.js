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
  const liquidWater = (T > 250 && T < 330) ? 1 : 0;              // specular band

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

  return {
    surfaceGravity,                                             // Earth-relative g (Relief F2/F7, Aeolian F15)
    tidalHeat,                                                  // Io-normalized planet self-heating (Relief F8/F7, Cryo P7)
    emissive: hot,                                               // lava glow on hot bodies
    limbStrength: hasAtmo ? 0.7 : 0.0,                           // rim glow needs an atmosphere
    specStrength: (hasAtmo && liquidWater) ? 0.8 : iron * 0.15,  // ocean specular vs faint metal sheen
    auroraIntensity: iron * (locked ? 0.2 : 1.0) * (hasAtmo ? 1 : 0),
    cloudCoverage: hasAtmo ? clamp01((d.habitability ?? 0) + 0.2) : 0,
    reliefAmplitude: mix(1.0, 0.6, erosion),                     // eroded worlds = softer relief
    ...qualityKnobs(qualityTier),
  };
}
