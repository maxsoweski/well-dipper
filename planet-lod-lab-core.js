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

// ── Radius → visual DISPLAY scale (radius-display-scale-2026-07-24) ───────────
// DISPLAY-ONLY: sVis is applied to the rendered sphere's transform (planet.scale)
// so a bigger-radius world reads bigger on screen. It NEVER feeds procgen, height,
// schedules, featureFrequencyFromKm, or any headless/golden path — the height noise
// is evaluated in object space (pre-scale), so the fence holds structurally.
// sqrt keeps the 0.3–16 RE span (53×) inside the fixed camera: 1 RE → 1 exactly,
// 0.3 → 0.5477, 16 → 4.0. Reference radius is 1 RE, so the normalization is the identity.
// VIS_SCALE_EXP is the ONE UAT-tunable knob (Math.pow bound to it, not a hard-coded 0.5).
export const VIS_SCALE_EXP = 0.5;
export function visScaleOf(radiusEarth) {
  return Math.pow(radiusEarth, VIS_SCALE_EXP);   // pow(1,·) === 1 exactly (zero-change at 1 RE)
}

// Camera min-distance guard: the camera must never enter the scaled sphere. The floor
// scales WITH the disc so the surface-skim margin is radius-invariant. At sVis=1 this is
// 1.1 — bit-identical to the lab's existing wheel floor (planet-lod-lab.html :5588), so
// every pre-increment path is untouched. 1.1 > 1.05 satisfies minDistance > sVis·1.05.
export const CAMERA_CLEARANCE = 1.1;
export function minCameraDistance(sVis) {
  return sVis * CAMERA_CLEARANCE;
}

// ── Hold-apparent-size compensation (radius-live-feed R1 close-out, 2026-07-28) ─
// WHY THIS EXISTS: the Rhines band count goes as R^0.5 and visScaleOf goes as R^0.5, so
// dragging the radius slider at a FIXED camera grows the disc at exactly the rate the bands
// multiply — on-screen band DENSITY is invariant (measured +0.031 ± 0.029, i.e. zero) and the
// radius→banding response is invisible BY CONSTRUCTION. Evidence:
// docs/WORKSTREAMS/world-engine-radius-live-feed-2026-07-25/evidence/G4-rendered-belt-count.md.
// The fix for the READ (not for the physics — Max ruled VIS_SCALE_EXP stays 0.5) is to hold the
// disc at a constant apparent size while radius moves, which is the same discipline
// renderDeltaSweep applies to its captures (SWEEP_DISTANCE * sVis, planet-lod-lab.html).
// MECHANISM: the invariant held is the LOGICAL distance distance/sVis — the camera's distance in
// scaled-planet-radii, the same quantity the LOD already keys on. Scaling absolute distance by
// the sVis ratio keeps it fixed, so the wheel stays fully live (it sets a new logical distance,
// which is then preserved) and only radius-driven scale changes are compensated.
// Identity when sVis does not change, so a still frame is bit-unchanged whether the toggle is on
// or off; returns distance untouched on any non-finite / non-positive input rather than emitting
// a NaN camera position.
export function holdApparentDistance(distance, sVisPrev, sVisNext) {
  if (!Number.isFinite(distance) || !Number.isFinite(sVisPrev) || !Number.isFinite(sVisNext)) return distance;
  if (sVisPrev <= 0 || sVisNext <= 0) return distance;
  if (sVisNext === sVisPrev) return distance;            // exact identity — no float drift on still frames
  return distance * (sVisNext / sVisPrev);
}

// ── Radius slider LOG-position map (radius-display-scale-2026-07-24, Slice A) ──
// lil-gui has no native log slider, so the lab drives the radius through a [0,1]
// proxy track `t` that exp-maps onto planetRadiusEarth. This is a pure UI/ERGONOMICS
// term — it NEVER feeds procgen/height/schedules; the physics still reads
// state.planetRadiusEarth. The point is perceptual uniformity: because
// radiusFromT(t) = MIN·(MAX/MIN)^t, equal slider travel Δt is a constant MULTIPLICATIVE
// step in radius everywhere on the track (radiusFromT(t+dt)/radiusFromT(t) = (MAX/MIN)^dt,
// independent of t) — killing the linear slider's 0.2 RE/px left-edge violence and
// right-edge dead zone (DIAGNOSIS Finding 1). Endpoints: t=0 → 0.3, t=1 → 16.
export const RADIUS_SLIDER_MIN = 0.3;   // Moon-class draw floor (RE)
export const RADIUS_SLIDER_MAX = 16;    // Sub-Neptune ceiling (RE)
export function radiusFromT(t) {
  return RADIUS_SLIDER_MIN * Math.pow(RADIUS_SLIDER_MAX / RADIUS_SLIDER_MIN, t);
}
export function tFromRadius(r) {
  return Math.log(r / RADIUS_SLIDER_MIN) / Math.log(RADIUS_SLIDER_MAX / RADIUS_SLIDER_MIN);
}

// ── Slice D — bake→synth crossover (radius-display-scale-2026-07-24) ───────────
// PROBLEM: the live default renders the macro body from the BAKED relief cube
// (reliefBakeStrength = 1). That cube is angular-fixed geometry — its continents GROW
// with the disc under planet.scale (θ const ⇒ S = θ·sVis) — and it CANNOT be re-keyed by a
// display frequency: the read-gate/UAT preset (Rocky/Earthlike) bakes its body from the
// plate-Voronoi partition (writePlateUpliftSphere), whose feature size is set by plate COUNT
// + boundary-stress geometry, NOT a noise frequency there is no domain hook for. (The plan's
// route-rebake targeted writeHeightSphere, which the Earthlike preset does not even use —
// see BUILD-NOTES Slice D.) MECHANISM: rather than re-bake, cross-fade the EFFECTIVE bake
// strength 1 → 0 as the disc departs sVis = 1, handing the macro body to the Slice-C
// domain-scaled analytic path (fbmd · uDispDomainScale), which IS constant-on-screen and is
// preset-AGNOSTIC (every preset's shader shares the same fbmd body). Byte-safe: touches no
// src/worldengine/** and needs NO re-bake — it only re-weights the existing blend uniform.
//   effective uReliefBakeStrength = base · bakeReliefCrossover(sVis)
// At sVis = 1 the factor is EXACTLY 1 (fully baked) ⇒ the frame write re-affirms the base ⇒
// identity ⇒ byte-identical to today. Symmetric in disc-doublings (|log2 sVis|) so growing
// AND shrinking both hand off to the constant-size synth body. RESIDUE (disclosed, D3): the
// baked continent PATTERN (incl. stamped basins) morphs into the analytic body across the
// fade — a visible change in continent CHARACTER, not size; the size-constancy bar is met.
// BAKE_CROSS_SPAN = the |log2 sVis| distance (disc-doublings) over which the bake fades fully
// to synth. It is a READ-GATE TUNABLE: the form-constancy gate (b) over the {0.5, 2, 8} trio
// picks the final value (a no-browser builder cannot run that gate). Default 1.0 = fully synth
// by radius 4 (grow) / 0.25 (shrink); ≈half-blend at radius 2 / 0.5. If (b) fails at radius 2
// (forms still visibly growing), reduce toward ~0.5 so the fade completes sooner.
export const BAKE_CROSS_SPAN = 1.0;
export function bakeReliefCrossover(sVis) {
  // smoothstep ease: zero slope at sVis = 1 (a tiny nudge off radius 1 barely morphs), easing
  // to pure synth by BAKE_CROSS_SPAN. smoothstep(0, SPAN, 0) === 0 exactly ⇒ returns 1 exactly
  // at sVis = 1 (byte-identity guard). clamp inside smoothstep keeps the result in [0, 1].
  const d = Math.abs(Math.log2(sVis));   // sVis = 1 → 0 exactly
  return 1 - smoothstep(0, BAKE_CROSS_SPAN, d);
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
export const CRATER_DEPTH = 0.2;   // profile SHAPE depth factor — exported so the synth amp law can divide it out (inc3b S3-fix: composed depth must equal Pike D_D_SIMPLE once, not twice)
const CRATER_RIM_H = 0.05, CRATER_PEAK_H = 0.14, CRATER_TERRACE_H = 0.02;
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

// ── ejectaProfile — F3 ejecta apron radial profile (relief doc §F3.a) ────────
// The EJECTA height as a function of normalized radius r = dist(fragment,center) /
// craterRadius, for the apron OUTSIDE the crater rim (1 < r < rOuter). F2 owns the
// cavity/rim (r ≤ 1); ejecta is zero there and beyond rOuter (distant cells don't
// bleed in). Two morphologies blended by `rampart` ∈ [0,1]:
//
//   skirt (dry, rampart=0): a NORMALIZED 1/r² apron — (1/r² − 1/rOuter²)/(1 − 1/rOuter²),
//     = 1 at the rim (r=1, ejecta thickest) → 0 at rOuter. The classic monotonic-
//     decaying continuous-ejecta blanket. d/dr = (−2/r³)·norm (always < 0 — the
//     sign-drop guard: a flipped sign lights the apron brightening OUTWARD, backward).
//   ridge (fluidized, rampart=1): a lobate TERMINAL RIDGE — a gaussian bump at
//     EJECTA_RAMP_R (the frozen flow margin; Mars rampart craters, D2 ground-ice).
//
// The GLSL ejectaProfile() is transcribed from this; dhdr is pinned vs central
// finite-diff in tests (relief-doc §5.4 silent-bug gate, like craterProfile/grabenProfile).
// The combiner reuses F2's voronoi3d centers (no new placement) and chain-rules dr/dpos.
const EJECTA_ROUTER = 2.5, EJECTA_RAMP_R = 2.0, EJECTA_RAMP_W = 0.3;
export function ejectaProfile(r, rampart = 0, rOuter = EJECTA_ROUTER) {
  if (r <= 1.0 || r >= rOuter) return { h: 0, dhdr: 0 };
  const invO2 = 1.0 / (rOuter * rOuter);
  const norm = 1.0 / (1.0 - invO2);                 // so skirt(1)=1, skirt(rOuter)=0
  const skirt  = (1.0 / (r * r) - invO2) * norm;
  const dskirt = (-2.0 / (r * r * r)) * norm;
  const rs = (r - EJECTA_RAMP_R) / EJECTA_RAMP_W;   // rampart gaussian terminal ridge
  const ridge  = Math.exp(-(rs * rs));
  const dridge = ridge * (-2.0 * (r - EJECTA_RAMP_R) / (EJECTA_RAMP_W * EJECTA_RAMP_W));
  return {
    h:    skirt  * (1.0 - rampart) + ridge  * rampart,
    dhdr: dskirt * (1.0 - rampart) + dridge * rampart,
  };
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

// ── grabenProfile — F4 tectonic-rift radial profile (relief doc §F4.a) ───────
// A linear rift on the sphere is the intersection of the sphere with a plane through
// the centre (a great circle); a surface point's PERPENDICULAR distance to that rift
// line is d = |dot(pos, planeNormal)| (pos on the unit sphere). This profile is the
// trench cross-section as a function of d: a flat-floored, steep-walled graben.
//
//   depth(d) = -(1 - smoothstep(floorHalf, halfWidth, d))    (∈ [-1, 0], a trench)
//     d ≤ floorHalf : depth = -1            (the flat down-dropped floor)
//     floorHalf..halfWidth : smooth wall, rising -1 → 0
//     d ≥ halfWidth : depth = 0             (untouched datum outside the rift)
//   floorHalf = floorFrac · halfWidth
//
// dddd = d(depth)/dd = smoothstep'(floorHalf, halfWidth, d) — the wall SLOPE the GLSL
// combiner chain-rules into the shading gradient (×sign(s)·planeNormal). Pinned vs
// finite-diff in tests (relief-doc §5.4 silent-bug gate: a sign-wrong wall lights the
// trench inside-out yet compiles fine — exactly what a CPU oracle catches first).
export function grabenProfile(d, halfWidth = 0.12, floorFrac = 0.4) {
  const floorHalf = floorFrac * halfWidth;
  const span = halfWidth - floorHalf;
  const depth = smoothstep(floorHalf, halfWidth, d) - 1.0;   // -1 floor → 0 outside
  let dddd = 0.0;
  if (span > 1e-9 && d > floorHalf && d < halfWidth) {
    const t = (d - floorHalf) / span;
    dddd = (6.0 * t * (1.0 - t)) / span;                     // d/dd of smoothstep
  }
  return { depth, dddd };
}

// ── scarpProfile — F5 fault-scarp soft-step profile (relief doc §F5.a) ───────
// A scarp is a ONE-SIDED cliff: a step in elevation across an iso-contour of some
// smooth field. This profile is that step as a function of the field value:
//
//   height(field) = smoothstep(level − width, level + width, field)   (∈ [0,1])
//     field ≤ level−width : height = 0     (the low block)
//     level−width..+width : the cliff face, rising 0 → 1
//     field ≥ level+width : height = 1     (the high block)
//
// dhdf = d(height)/dfield — the cliff-face SLOPE the GLSL combiner chain-rules into
// the shading gradient (× dfield/dpos). Pinned vs finite-diff in tests (relief-doc
// §5.4 silent-bug gate, like grabenProfile/craterProfile — a sign-wrong cliff face
// lights the scarp backward yet compiles fine). Zero outside the band (flat blocks).
// The GLSL scarpProfile() is transcribed from this (same smoothstep derivative).
export function scarpProfile(field, level = 0.0, width = 0.15) {
  const e0 = level - width, e1 = level + width;
  const height = smoothstep(e0, e1, field);   // 0 below → 1 above, soft step over 2·width
  let dhdf = 0.0;
  const span = e1 - e0;                         // = 2·width
  if (span > 1e-9 && field > e0 && field < e1) {
    const t = (field - e0) / span;
    dhdf = (6.0 * t * (1.0 - t)) / span;        // d/dfield of smoothstep
  }
  return { height, dhdf };
}

// ── terraceProfile — F6 mesa/plateau height-terrace (relief doc §F6.a) ───────
// Plateaus/mesas read as STACKED FLAT TREADS separated by steep risers. This quantizes
// a height into `levels` bands but with a SOFT riser (smoothstep) so the gradient exists
// (a hard floor(h·N)/N has none). Returns the terraced value + its slope dv/dh:
//
//   scaled = h·levels ; idx = floor(scaled) ; frac = scaled − idx        (∈ [0,1))
//   riser  = smoothstep(1−softness, 1, frac)   (0 on the flat tread, →1 at the band top)
//   value  = (idx + riser) / levels            (continuous across band boundaries)
//   dv/dh  = smoothstep'(1−softness, 1, frac)  (0 on the tread, peaks mid-riser)
//
// The value is CONTINUOUS at every band boundary (tread of band k+1 = top of band k), so
// only the DERIVATIVE is kinked (tread↔riser). Pinned vs finite-diff INSIDE a riser
// (relief-doc §5.4 silent-bug gate); the flat-tread zero-slope is a separate invariant.
// The GLSL terraceProfile() is transcribed from this (same softstep riser).
export function terraceProfile(h, levels = 4, softness = 0.4) {
  const scaled = h * levels;
  const idx = Math.floor(scaled);
  const frac = scaled - idx;                    // [0,1)
  const e0 = 1.0 - softness;                     // riser starts at this point in the band
  const riser = smoothstep(e0, 1.0, frac);       // 0 on tread → 1 at band top
  const value = (idx + riser) / levels;
  let dvdh = 0.0;
  const span = 1.0 - e0;                          // = softness
  if (span > 1e-9 && frac > e0 && frac < 1.0) {
    const t = (frac - e0) / span;
    dvdh = (6.0 * t * (1.0 - t)) / span;          // d/dfrac of smoothstep = d/dh of value
  }
  return { value, dvdh };
}

// ── ridgeWave — F6 tessera crosscutting-ridge primitive (relief doc §F6.a) ───
// Tessera (Venus Ovda Regio) is rendered as TWO intersecting warped-iso-contour
// ridge fields, MULTIPLIED so the grooves of both lattice orientations show (the
// product → 0 wherever EITHER field is in a groove → the crosscutting lattice). The
// per-axis ridge is this fold of the field's phase:
//
//   value(phase) = 1 − |sin(phase)|        crests (=1) at phase=nπ, grooves (=0) at π/2+nπ
//   dvdphase     = −sign(sin(phase))·cos(phase)
//
// This is the SAME silent-bug class as ridgedFold (relief doc §5.4 risk #4): the
// `−sign(sin)` correction across the |.| fold can be dropped and still compile, but
// it lights the groove walls backward. Pinned vs finite-diff in tests; the GLSL
// tesseraCombiner() chain-rules dvdphase through dphase/dpos = freq·dfield per axis
// and applies the product rule across the two ridges. The kink lives at phase=nπ
// (sin=0, the crest) — the finite-diff sweep stays strictly inside a smooth half-period.
export function ridgeWave(phase) {
  const s = Math.sin(phase);
  const value = 1.0 - Math.abs(s);
  const dvdphase = -Math.sign(s) * Math.cos(phase);   // chain rule through −|sin|
  return { value, dvdphase };
}

// ── bladeProfile — F18 CH₄ penitente / bladed-terrain primitive (cryo-doc §2 F18) ─
// Pluto's Tartarus Dorsa is tall, thin, sharp, parallel methane-ice blades (penitentes:
// 3–5 km spacing, ~500 m deep — a large amplitude-to-spacing ratio, i.e. deep+sharp).
// The blade cross-section is the F6 ridgeWave (1−|sin|) SHARPENED by a power: raising the
// rounded ridge to sharpness>1 narrows the crest into a thin spike (the penitente), while
// the crest height (1) and groove floor (0) are preserved. Reuses the already-§5.4-pinned
// ridgeWave; the pow is chain-ruled through it:
//   value    = pow(rw.value, sharpness)
//   dvdphase = sharpness · pow(rw.value, sharpness−1) · rw.dvdphase
// The −sign(sin) correction lives INSIDE ridgeWave and is INHERITED — the same silent-bug
// class as ridgedFold / doubleRidgeProfile (relief doc §5.4 risk #4): drop it and the blade
// flanks light backward yet it compiles. Pinned vs central finite-diff in tests (both sin
// branches). The GLSL bladeProfile() is transcribed from this. The kink lives at phase=nπ
// (the crest, sin=0); the finite-diff sweep stays strictly inside a smooth half-period.
export function bladeProfile(phase, sharpness = 3.0) {
  const rw = ridgeWave(phase);
  const value = Math.pow(rw.value, sharpness);
  // d(rw^s)/dphase = s·rw^(s−1)·d(rw)/dphase; at rw=0 (groove) pow(0,s−1)=0 for s>1 → 0 (smooth floor).
  const dvdphase = sharpness * Math.pow(rw.value, sharpness - 1.0) * rw.dvdphase;
  return { value, dvdphase };
}

// ── pldBands — F22 polar-layered-deposit strata (cryo-doc §2 F22 / §F17 PLD) ──
// The perennial polar cap reads as STACKED bright/dark annular bands — preserved depositional
// layers exposed in the cap. This is an ALBEDO/luminance banding (NOT relief: no height/grad, so no
// finite-diff oracle — the banding LOGIC is unit-tested, the cap verified VISUALLY, exactly like the
// step-2 frost mask). It rides the SAME softened-floor quantizer idea as terraceProfile (relief F6):
// the band coordinate is a POLE-DISTANCE coordinate ∈ [0,1] (coldFactor: 0 at the snowline edge → 1
// at the pole / antistellar cold point) ramping smoothly across the whole cap, so iso-value contours
// ARE the concentric annular rings. (The coverage itself can't carry rings — it saturates to the
// budget just past the snowline.) The coordinate is sliced into `levels`
// layers; adjacent layers alternate bright/dark by PARITY, crossfaded across the soft riser so the
// rings read smooth rather than hard-stepped. Returns a LUMINANCE FACTOR ∈ [1−strength, 1] the
// shader multiplies into the frost albedo (even rings bright, odd rings dimmed):
//   phase = coverage·levels ; idx = floor(phase) ; frac = phase − idx
//   riser = smoothstep(1−softness, 1, frac)             (crossfade band idx → idx+1)
//   parity = mix(idx&1, (idx+1)&1, riser)               (smooth 0↔1 alternation)
//   factor = 1 − strength·parity
// strength≤0 OR levels<1 ⇒ 1 (no-op, regression-safe); coverage≤0 ⇒ idx 0, parity 0 ⇒ 1 (bare
// ground / cap edge untouched). The GLSL pldBands() is transcribed from this (same parity crossfade).
export function pldBands(coverage, levels = 6, softness = 0.4, strength = 0.0) {
  if (strength <= 0.0 || levels < 1) return 1.0;
  const phase = Math.max(coverage, 0.0) * levels;
  const idx = Math.floor(phase);
  const frac = phase - idx;
  const e0 = 1.0 - softness;
  const riser = smoothstep(e0, 1.0, frac);
  const parityThis = idx & 1;
  const parityNext = (idx + 1) & 1;
  const parity = mix(parityThis, parityNext, riser);
  return 1.0 - strength * parity;
}

// ── edificeProfile — F7 volcanic-edifice radial profile (relief doc §F7.a) ───
// A single volcano as a function of normalized radius r = dist(fragment,center) /
// edificeRadius, plus its analytic dh/dr (the relief-normal term the GLSL combiner
// chain-rules into the shading gradient). Two parts:
//
//   cone   pow(1−r, p) for r<1, p = mix(1.5, 4, shieldStratoMix): SHIELD (broad
//          shallow, p=1.5 — Mauna Loa/Olympus) ↔ STRATO (steep narrow, p=4 — Fuji).
//          Summit at r=0 (h=1), tapering to the base at r=1 (h=0).
//   caldera a parabolic bowl subtracted at the summit (r<calderaR) — reuses the F2
//          inverted-bowl shape: depth·((r/calderaR)²−1), = −depth at center → 0 at
//          the caldera rim, so the very summit reads as a crater pit.
//
// Zero for r ≥ 1 (distant cells don't bleed in, like craterProfile/ejectaProfile).
// The GLSL edificeProfile() is transcribed from this; dhdr is pinned vs central
// finite-diff in tests (relief-doc §5.4 silent-bug gate — a sign-wrong cone face
// lights the volcano inside-out yet compiles fine). The cone derivative
// d(pow(1−r,p))/dr = −p·pow(1−r,p−1); the caldera's = depth·2r/calderaR².
const EDIFICE_SHIELD_P = 1.5, EDIFICE_STRATO_P = 4.0;
// Caldera depth must exceed the cone's drop across calderaR (steepest case: strato p=4
// drops ~0.40 over r∈[0,0.12]) or the summit reads as a peak, not a pit. 0.5 clears it
// for every mix with margin → a clean summit crater.
const EDIFICE_CALDERA_R = 0.12, EDIFICE_CALDERA_DEPTH = 0.5;
export function edificeProfile(r, shieldStratoMix = 0.5, calderaR = EDIFICE_CALDERA_R) {
  if (r >= 1.0) return { h: 0, dhdr: 0 };
  const p = mix(EDIFICE_SHIELD_P, EDIFICE_STRATO_P, clamp01(shieldStratoMix));
  const omr = 1.0 - r;
  let h = Math.pow(omr, p);
  let dhdr = -p * Math.pow(omr, p - 1.0);                  // d(pow(1−r,p))/dr
  if (r < calderaR) {                                      // summit caldera bowl (F2 cavity shape)
    const s = r / calderaR;
    h    += EDIFICE_CALDERA_DEPTH * (s * s - 1.0);         // −depth at center → 0 at rim
    dhdr += EDIFICE_CALDERA_DEPTH * 2.0 * r / (calderaR * calderaR);
  }
  return { h, dhdr };
}

// ── doubleRidgeProfile — F10 Europa double-ridge cross-line profile (relief doc §F10.a) ─
// The signature icy-tectonic feature: TWO parallel raised ridges flanking a central
// trough (NASA: cracks that open-and-close repeatedly build the flanking ridges, so the
// DOUBLE profile is the right primitive). A function of the signed cross-line coordinate
// t — in GLSL t = sin(phase) of a warped directional field, so the line repeats along the
// surface like F6 tessera / F8 wrinkle ridges. Symmetric in t (a=|t|):
//
//   ridge  = exp(−((a−offset)/width)²)          gaussian crest peaking at a=offset
//   trough = exp(−(a/(offset·TROUGH_W))²)        gaussian dip at the line center a=0
//   h      = ridge − TROUGH_AMP·trough           crest (h≈1) at ±offset, dip (h<0) at 0
//
// dh/dt = dh/da·sign(t); the −sign(t) fold across |t| is the SAME silent-bug class as
// ridgeWave / ridgedFold (relief doc §5.4 risk #4 — drop it and the t<0 flank lights
// backward yet it compiles). Pinned vs central finite-diff in tests, both flanks. The
// GLSL doubleRidgeProfile() is transcribed from this; the kink lives at t=0 (the trough
// floor), avoided by the finite-diff sweep.
const DR_TROUGH_AMP = 0.6, DR_TROUGH_W = 0.5;
export function doubleRidgeProfile(t, offset = 0.45, width = 0.18) {
  const a = Math.abs(t);
  const sq = (x) => x * x;
  const troughW = offset * DR_TROUGH_W;
  const ridge  = Math.exp(-sq((a - offset) / width));
  const trough = Math.exp(-sq(a / troughW));
  const h = ridge - DR_TROUGH_AMP * trough;
  const dridge_da  = ridge  * (-2.0 * (a - offset) / (width * width));
  const dtrough_da = trough * (-2.0 * a / (troughW * troughW));
  const dh_da = dridge_da - DR_TROUGH_AMP * dtrough_da;
  const dhdt = dh_da * Math.sign(t);                    // chain rule through a=|t|
  return { h, dhdt };
}

// seededUnitVec3 — a deterministic ~uniform point on the unit sphere from a scalar seed.
// z uniform in [-1,1], azimuth uniform in [0,2π) (the standard sphere-point sampler);
// shape mirrors seedOffset()'s sin-fract hashing. Used for F4 rift-plane normals.
function seededUnitVec3(seed) {
  const h = (n) => { const x = Math.sin(n) * 43758.5453; return x - Math.floor(x); };
  const z = h(seed * 12.9898 + 1.1) * 2.0 - 1.0;
  const phi = h(seed * 78.233 + 3.3) * Math.PI * 2.0;
  const r = Math.sqrt(Math.max(0.0, 1.0 - z * z));
  return [r * Math.cos(phi), r * Math.sin(phi), z];
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
  // rockyCrust (Bucket B, relief triage 2026-06-15): the SILICATE-vs-ICE crust discriminator.
  // Bulk density is the rock↔ice axis (ρ≳3.9 g/cm³ rocky, ≲2.5 icy) — deliberately NOT
  // volatileFraction, because water-rich-but-rock-crusted worlds (Earth/Ocean, high vf) DO build
  // silicate mountains/volcanoes. The silicate-relief family (mountains/lava/edifices/tessera)
  // multiplies by this so it zeroes on icy worlds (Europa 2.0 / Titan 1.9 / Frozen 2.5) — where
  // relief is ice-tectonics/cryo, carried by their own features — while KEEPING silicate worlds
  // incl. Io-grade Lava (7) and Venus (5.24). See docs/FEATURES/relief-triage-verdicts-2026-06-15.md.
  const density = d.composition?.density ?? 5.5;
  const rockyCrust = smoothstep(2.5, 3.9, density);
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

  // ── F3 ejecta & rays (Stage-C step 3, Relief domain — relief doc §F3.b) ─────
  // NO new driver surfacing — all three derive from existing fields (relief doc §F3.b).
  // ejectaStrength: the apron exists wherever craters do, so it tracks craterDensity
  // directly (more craters → more ejecta). The combiner wraps the SAME F2 voronoi3d
  // centers, so a crater-free resurfaced world (density≈0) has no ejecta either.
  const ejectaStrength = craterDensity;
  // ejectaRampart (0=dry smooth skirt ↔ 1=fluidized lobate terminal ridge): ground ice
  // fluidizes ejecta into rampart flows (Mars). volatileFraction is the rock↔ice axis;
  // a fresh threshold (rocky vf≲0.15 → dry, icy vf≳0.4 → rampart), reusing the §F5 idea.
  const ejectaRampart = smoothstep(0.15, 0.4, volatileFraction);
  // rayBrightness: bright rays are the ALBEDO exception (relief doc §F3.a) — fresh
  // high-albedo streaks from YOUNG craters, and AIRLESS-ONLY (an atmosphere weathers
  // them away → gate hard on hasAtmo). Fade with erosion (rays are the first thing to
  // go as a surface ages). Airless + pristine → bright; any atmosphere → 0.
  const rayBrightness = clamp01(1 - erosion) * (hasAtmo ? 0 : 1);

  // ── F1 mountains / ranges (Stage-C step 3, Relief domain — relief doc §F1.b) ─
  // Ridged-multifractal base relief, the layer every other relief feature sits on.
  // mountainAmp: ranges GROW with tectonic/volcanic activity, SHRINK as the surface
  // erodes (old worlds = rounded low ranges). The proxy for "young/active" is simply
  // (1−erosion); a constant base scales it into a felt amplitude. Stays in 0..1.
  const habitability = clamp01(d.habitability ?? 0);
  const mountainAmp = clamp01(mix(0.25, 0.6, 1 - erosion)) * rockyCrust;   // ×rockyCrust: silicate orogeny only (icy worlds relieve via cryo/ice-tectonics)

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

  // ── F4 canyons / rifts (Stage-C step 3, Relief domain — relief doc §F4.b) ───
  // The tectonic-graben variant of canyons (I own this; Fluvial incised gorges + Cryo
  // chasma ADD INTO the same shared `canyonHeight` accumulator downstream). A rift is a
  // great-circle trench; its DEPTH scales with how tectonically active / stressed the
  // crust is and shrinks as the surface erodes the rift shoulders down (relief doc D11/
  // D12/D14). Proxy for "active": resurfacing (volcano-tectonic resurfacing rate),
  // plate-tectonics (habitability is the subduction proxy, cf. orogenyStrength), and
  // tidal stress (tidalProxy = Io-grade tidal heating clamped to 0..1). Dead, inert
  // worlds (Frozen) barely rift; Io-grade worlds (Lava) rift hard. ×(1−0.4·erosion) so
  // old eroded crust rounds/fills its rifts. 0.28 scales it into a relief amplitude
  // (cf. mountainAmp's mix(0.25,0.6,…)); the lab `uChasmaDepth` reads it directly.
  const tidalProxy = clamp01(tidalHeat);
  const tectonicActivity = clamp01(Math.max(resurfacing, habitability * 0.7) + tidalProxy * 0.5);
  const chasmaStrength = clamp01(tectonicActivity * (1 - 0.4 * erosion));
  const chasmaDepth = chasmaStrength * 0.28;

  // chasmaCount (1..3) + chasmaAxes (3 seeded unit-vec3 rift-plane normals — each great
  // circle ⊥ its normal is a rift). Seed-deterministic so a planet's rift system is
  // stable; production passes the real planet seed. The combiner uses chasmaCount rifts.
  const cs = Math.sin(seed * 45.164 + 9.1) * 43758.5453;
  const chasmaCount = 1 + Math.floor((cs - Math.floor(cs)) * 3);   // 1..3
  const chasmaAxes = [seededUnitVec3(seed + 1), seededUnitVec3(seed + 2), seededUnitVec3(seed + 3)];

  // ── F5 scarps / fault systems (Stage-C step 3, Relief — relief doc §F5.b) ───
  // Lobate contraction scarps form from GLOBAL COOLING/CONTRACTION as a planet ages
  // (relief doc D11/D16) — a DISTINCT driver from the tectonic/tidal stress that drives
  // chasma (F4). SMALLER bodies cool faster and contract more (Mercury's Discovery Rupes
  // / the Moon's lobate scarps are the type localities), so smallness is the load-bearing
  // axis; erosion wears scarps down over time (×(1−0.5·erosion)). 0.12 scales it into a
  // subtle relief amplitude (scarps are small but read as hard lit/shadow EDGES under the
  // posterizer — relief doc §F5.c). `smallness` ramps a big world (R≥1.3) to 0 and a small
  // one (R≤0.3) to 1, but never fully zeroes terrestrial worlds (Earth has wrinkle ridges).
  const smallness = clamp01((1.3 - radiusEarth) / 1.0);
  const scarpStrength = clamp01(smallness * (1 - 0.5 * erosion)) * 0.12;

  // scarpStyle (0=thrust↔1=normal): rock contracts → THRUST (compression) scarps; an icy
  // shell EXTENDS → NORMAL (extension) faults (relief doc §F5.b, D2). volatileFraction is
  // the rock↔ice axis; a fresh threshold (rocky vf≲0.15 → thrust, icy vf≳0.3 → normal),
  // distinct from the liquid-gate's D2 ramp. The combiner flips the cliff polarity on it.
  const scarpStyle = smoothstep(0.1, 0.3, volatileFraction);

  // scarpAxis: a seeded unit-vec3; the scarp fronts are iso-contours of dot(pos, axis), so
  // they run as parallel fault lines ⊥ this axis. Seed-deterministic (stable per planet).
  const scarpAxis = seededUnitVec3(seed + 7);

  // ── F6 plateaus / highlands / tessera (Stage-C step 3, Relief — relief doc §F6.b) ──
  // Plateaus/highlands are THICKENED crust — they grow with tectonic activity (crustal
  // thickening D11/D12) and erode down over time. The HeteroTerrain shader makes them
  // flat-topped with rough margins; the terrace adds mesa steps. plateauStrength is the
  // relief amplitude (×0.2 ceiling — felt but below mountains/chasma). Reuses the F4
  // `tectonicActivity` proxy (resurfacing / plate-subduction / tidal-stress).
  const plateauStrength = clamp01(tectonicActivity * (1 - 0.4 * erosion)) * 0.2;

  // tessera (Venus Ovda Regio) = INTENSELY deformed crust — only the MOST tectonically
  // stressed worlds show the crosscutting ridge lattice, so a high smoothstep gate on
  // tectonicActivity (a dead/mild world shows none), eroded-down. ×0.15 scales the
  // dual-axis intersecting-ridge lattice amplitude.
  const tesseraStrength = clamp01(smoothstep(0.45, 0.9, tectonicActivity) * (1 - 0.4 * erosion)) * 0.15 * rockyCrust;   // ×rockyCrust: Venus-type silicate landform (icy crust deforms as ridges/chaos)

  // tesseraAxes: 2 seeded unit-vec3 — the two lattice orientations whose intersecting
  // warped ridges form the crosscutting tessera grid (seed-deterministic per planet).
  const tesseraAxes = [seededUnitVec3(seed + 8), seededUnitVec3(seed + 9)];

  // ── F7 volcanic edifices (Stage-C step 3, Relief — relief doc §F7.b) ────────
  // volcanismStrength: the edifice density/size gate (≤0 ⇒ combiner early-out). Volcanic
  // activity is driven by D12 tidal heating (Io self-heats → effusive shields) and D11
  // young-age resurfacing (fresh volcanic plains), plus a modest subduction-arc proxy
  // (habitability is this file's plate-tectonics proxy — Earth's arc volcanoes). A dead,
  // cold, un-resurfaced world (Frozen) shows none; Io-grade tidal (Lava) saturates.
  const volcanismStrength = clamp01(tidalProxy + resurfacing * 0.5 + habitability * 0.3) * rockyCrust;   // ×rockyCrust: silicate edifices only (icy worlds get cryovolcanic domes, a separate feature)

  // edificeMaxHeight (∝ 1/g, D14): low-gravity worlds grow GIANT shields — Olympus Mons
  // is 22 km because Mars is ~0.38 g (a tall edifice would slump under Earth gravity).
  // 1 g (Earth) → 1.0; clamped to [0.2, 2.0] so a near-zero-g bundle can't blow up the
  // relief amplitude (registry range). The combiner scales cone height by this.
  const edificeMaxHeight = Math.min(2.0, Math.max(0.2, 1.0 / Math.max(surfaceGravity, 0.05)));

  // shieldStratoMix (0=effusive SHIELD ↔ 1=explosive STRATO): a magma-VISCOSITY proxy.
  // Wet subduction-zone magma is silica-rich and viscous → steep stratovolcanoes (Earth);
  // dry/hot basaltic magma is fluid → broad shields (Io, Mars, Hawaii). habitability is
  // the wet-plate-tectonics proxy, so it doubles as the viscosity axis (dry world → 0,
  // shield). The combiner blends the cone exponent pow(1−r, mix(1.5,4,this)).
  const shieldStratoMix = clamp01(habitability);

  // ── F8 lava plains & flows (Stage-C step 3, Relief — relief doc §F8.b) ───────
  // lavaCoverage (D11): the volcanic-resurfacing fraction. Drives the flood-basalt
  // plains that SMOOTH/suppress older relief (an Io-grade resurfaced world is mostly
  // fresh smooth plain; an old cratered world has none). Direct passthrough of the
  // resurfacing rate (the F2 craterDensity already reads (1−resurfacing), so the two
  // are consistent: high resurfacing ⇒ few craters + broad lava plains).
  const lavaCoverage = clamp01(resurfacing) * rockyCrust;   // ×rockyCrust: silicate flood-basalt only (icy resurfacing is cryo, carried by cryoActivity)

  // lavaActivity (D12): the EMISSIVE driver — is the lava COLD (old solidified plains,
  // tidal≈0) or GLOWING (active, tidally self-heated like Io)? tidalProxy is the same
  // Io-normalized tidal-heat clamp F7 uses, so a close eccentric world's cracks glow.
  // The GLSL crack mask multiplies this in; 0 ⇒ the spatial emissive term early-outs.
  const lavaActivity = tidalProxy * rockyCrust;   // ×rockyCrust: silicate emissive lava only (icy tidal heating drives cryoActivity, not glowing rock)

  // channelDensity (seed × activity): gates the deferred leveed-channel / sinuous-rille
  // combiner (relief doc §F8.a rich tier). _derived-only for now (no GLSL consumer until
  // channels land), surfaced so the contract is complete — mirrors how precipitation /
  // pressure were surfaced ahead of their Fluvial/Aeolian consumers. Dead world ⇒ 0.
  const channelHash = (() => { const x = Math.sin((seed + 11) * 12.9898) * 43758.5453; return x - Math.floor(x); })();
  const channelDensity = clamp01(lavaActivity * (0.5 + 0.5 * channelHash));

  // lavaAxis: the wrinkle-ridge strike direction (seeded unit-vec3). Wrinkle ridges are
  // linear compressional ridges on the basalt plain (deferred from F5 to F8); the GLSL
  // combiner carves a warped directional field ⊥ this axis, mirroring F5/F6's pattern.
  const lavaAxis = seededUnitVec3(seed + 12);

  // ── Cryo step 1: cryoActivity (P7 cryovolcanism) — OWNS the shared uCryoActivity gate ──
  // The icy-resurfacing activity F9/F10 read (registry RESERVED→LIVE; replaces the option-A
  // lab-knob stub). THREE drivers AND'd as a product of gates: D12 tidal ENERGY (tidalProxy)
  // drives the resurfacing; D2 VOLATILES (volatileGate) make that resurfacing CRYO (ice), not
  // ROCK (lava); D1 COLD (T_eq below the water-ice point) keeps the volatiles a solid ice
  // SHELL, not a warm liquid ocean. The product separates a Europa (tidal + icy + cold →
  // chaos/ridges) from an Io (tidal but volatile-poor → F8 lava) and from a warm ocean world
  // (tidal + icy + WARM → ocean, no shell). A dead frozen world (no tidal) → 0 — which is why
  // the Frozen preset showed nothing until the option-A lab knob forced it.
  const cryoColdGate = 1.0 - smoothstep(220, 273, T);   // 1 below 220K (frozen shell) → 0 above 273K (too warm for an ice shell)
  const cryoActivity = clamp01(tidalProxy * volatileGate * cryoColdGate);

  // ── Cryo step 2: frost-coverage mask (F23/F22 — THE keystone every cryo feature layers on) ──
  // A per-fragment COVERAGE test ("is it cold enough here for this volatile to be solid?"), NOT
  // relief — so no finite-diff oracle; the surfacing LOGIC is unit-tested, the mask itself verified
  // VISUALLY. CPU derives the four params the shader's frostCoverage() evaluates against localT;
  // the shader mixes the surface albedo toward frostAlbedo through LUMINANCE so the cap survives
  // posterize (the colour TINT is the stylize/drop part, cryo-doc §2.a). Reuses the already-derived
  // volatileSpecies classifier (#4) + the vSubstellarAngle varying (the tidally-locked eyeball cap).
  //
  // frostCondensationT — the freeze point of the characteristic frost. A volatile-bearing
  // temperate/warm world still grows WATER caps at its cold poles (H₂O 273 K), so species 0 (T>273
  // but vf≥floor) falls back to water; colder classifications carry their own colder ice. Bone-dry
  // ⇒ 0 (shader early-out). The shader's localT<condensationT test does the hot-world rejection — a
  // 950 K Lava world never frosts even if it had a volatile budget.
  const frostCondensationT =
    volatileFraction < 0.05 ? 0   :   // bone dry → no characteristic frost
    volatileSpecies <= 1     ? 273 :   // H₂O water-ice (incl. warm worlds: cold-pole water caps)
    volatileSpecies === 2    ? 150 :   // CO₂ dry-ice (Mars S-pole)
    volatileSpecies === 3    ? 90  :   // CH₄ (Pluto Tartarus Dorsa)
    45;                                // N₂ (Triton / Sputnik Planitia, ~45 K)
  // frostMaxCoverage — the global frost BUDGET from the volatile fraction (D2); the localT field
  // decides WHERE within that budget frost actually deposits. Bone-dry → 0 (early-out).
  const frostMaxCoverage = clamp01(smoothstep(0.05, 0.4, volatileFraction));
  // frostLatitudeBias — D3 axial tilt spreads frost to LOW latitudes (Mars-like seasonal caps);
  // zero-tilt worlds hold sharp polar-symmetric caps. axialTilt in degrees (default 0).
  const axialTilt = d.axialTilt ?? 0;
  const frostLatitudeBias = clamp01(axialTilt / 90);
  // frostAlbedo — luminance is load-bearing (bright → survives posterize); the TINT is the
  // stylize/drop call (cryo-doc §6 Q1): H₂O white, CO₂ grey-white, CH₄ tholin-pink, N₂ blue-white.
  const frostAlbedo =
    volatileSpecies === 2 ? [0.88, 0.88, 0.90] :   // CO₂ grey-white
    volatileSpecies === 3 ? [0.93, 0.84, 0.82] :   // CH₄ tholin-pink (irradiated methane)
    volatileSpecies === 4 ? [0.84, 0.91, 0.93] :   // N₂ blue-white (fresh nitrogen)
    [0.93, 0.94, 0.96];                            // H₂O / default near-white
  const frostLocked = locked ? 1 : 0;              // tidally-locked → eyeball nightside cap (vSubstellarAngle)

  // ── Cryo step 3: F22 polar-layered-deposit (PLD) strata — the perennial-cap banding (cryo-doc §2 F22) ──
  // The cap reads as STACKED bright/dark annular layers (the pldBands albedo primitive). Gated by a
  // real cap existing (frostMaxCoverage, D2) AND the surface being OLD enough to PRESERVE strata
  // (1−resurfacing) — a young, resurfaced ice shell (Europa, resurfacingRate→1) shows little layering,
  // an ancient cap (Mars/Frozen) shows strong strata. NOT gated on axial tilt — tilt drives the
  // deferred seasonal advance/retreat (the non-deterministic weather layer, cryo-doc §6 Q3). The
  // value IS the dark-band luminance dip amplitude (modest, ≤~0.35); ≤0 ⇒ shader pldBands early-out.
  const pldStrength = clamp01(frostMaxCoverage * (1.0 - resurfacing)) * 0.35;
  const pldLevels = 6;                             // number of annular strata bands (constant, lab-tunable)

  // ── Cryo step 4: F18 sublimation-landscape relief gate (cryo-doc §2 F18) ──
  // F18 is RELIEF (height/grad, finite-diff-pinned bladeProfile + radial grabenProfile pits) that
  // exists ONLY where a volatile is SOLID and being etched. The MORPHOLOGY is switched in-shader on
  // volatileSpecies (CO₂→swiss-cheese pits, N₂→convection polygons, CH₄→penitente blades, H₂O→mild
  // hollows — the one allowed semantic-uniform switch, NOT a planetType branch). subStrength is the
  // single per-planet AMOUNT gate the shader's sublimationCombiner reads (≤0 ⇒ early-out): the frost
  // BUDGET (frostMaxCoverage, D2) × a species-active factor. CO₂/CH₄/N₂ (2/3/4) etch full landforms;
  // H₂O (1) makes only MILD terrestrial sublimation hollows (×0.4); a warm world (0) makes none. The
  // combiner spatially confines the relief to the cold cap in-shader (coldFactor, same as the frost
  // mask) and scales to relief units via the uSubAmp lab knob — so subStrength stays a clean [0,1] gate.
  const subActiveFactor =
    volatileSpecies === 0 ? 0.0 :   // warm / bone-dry → no sublimation regime
    volatileSpecies === 1 ? 0.4 :   // H₂O → mild hollows only
    1.0;                            // CO₂ / CH₄ / N₂ → full sublimation landforms
  const subStrength = clamp01(frostMaxCoverage) * subActiveFactor;

  // ── Cryo step 5: F17 glacial relief gate (cryo-doc §2 F17 — mantle + flow lineations) ──
  // F17 glacial landforms (slope-damped ice mantle + flow-aligned moraine/esker lineations) are
  // RELIEF that needs ENOUGH ice to FLOW, not just a thin frost coat. So glacialStrength uses a
  // HIGHER volatile-budget threshold than the frost mask (smoothstep 0.15→0.5 vs frost's
  // 0.05→0.4): an ice-rich cold world glaciates; a modest-volatile world only frosts. WHERE the
  // ice sits is confined in-shader by the cold cap (the same localT<condensationT gate F18/frost
  // use — a warm world glaciates only at its cold poles, a uniformly-cold Pluto broadly). Both
  // pieces reuse §5.4-pinned primitives (mantle = a slope-damped noised()-reweighting like
  // fbmdHetero; lineations = ridgeWave) → NO new finite-diff oracle. ≤0 ⇒ combiner early-out.
  const glacialStrength = clamp01(smoothstep(0.15, 0.5, volatileFraction));
  // glacialFlowVigor ∝ 1/g (D14): low-gravity worlds build THICKER, more sluggish ice sheets with
  // more prominent flow lineations (a low-g moon's ice piles deep; a high-g world's ice is thin
  // and sluggish to deform). mix(0.4,0.9) keeps even a high-g world's glaciers visible. Scales the
  // lineation amplitude in-shader (the mantle amplitude is a flat lab knob — vigor reads on the flow texture).
  const glacialFlowVigor = clamp01(mix(0.4, 0.9, 1.0 - clamp01(surfaceGravity)));

  // ── F9 chaos / disrupted terrain (Stage-C step 3, Relief — relief doc §F9.b) ──
  // The COVERAGE of chaos is gated by the SHARED uCryoActivity (Cryo-owned — D2/D12→P7;
  // NOW DERIVED above as cryoActivity; the lab knob remains a manual override). Relief owns only the
  // rendering SHAPE of the rafts:
  //   chaosCellScale — raft size (voronoi3d frequency; bigger value ⇒ smaller rafts).
  //   chaosRaftJitter — height + tilt displacement of each raft. DERIVED from g: a low-g
  //     icy moon (Europa g≈0.13) breaks into more dramatically displaced blocks than a
  //     high-g world. Reuses surfaceGravity (already read by F2/F7), so it's Relief-owned,
  //     not a Cryo overlap. Clamped to a visible band so even high-g chaos still reads.
  //   chaosMatrixRough — high-freq roughness of the refrozen matrix between rafts.
  const chaosCellScale = 5.0;
  const chaosRaftJitter = mix(0.3, 0.8, 1.0 - clamp01(surfaceGravity));
  const chaosMatrixRough = 0.5;

  // ── F10 ridged / grooved icy terrain (Stage-C step 3, Relief — relief doc §F10.b) ──
  // Double ridges (Europa) + grooved bands (Ganymede), gated in-shader by the SHARED
  // uCryoActivity. Relief owns the rendering SHAPE constants + two seeded orientations:
  //   doubleRidgeFreq — how many double-ridge lines wrap the surface.
  //   ridgeOffset / ridgeWidth — feed doubleRidgeProfile (flank position / sharpness).
  //   groovedBandFreq — the FINE parallel ridges inside a grooved band (≫ doubleRidgeFreq).
  //   cryoRidgeAxes — [double-ridge line direction, grooved-band direction] (seeded unit vec3).
  const doubleRidgeFreq = 3.0;
  const cryoRidgeOffset = 0.45;   // NB distinct from F1's uRidgeOffset (ridged-multifractal fold)
  const cryoRidgeWidth = 0.18;
  const groovedBandFreq = 14.0;
  const cryoRidgeAxes = [seededUnitVec3(seed + 13), seededUnitVec3(seed + 14)];

  return {
    mountainAmp,                                                // F1 — ridged base relief amplitude (erosion-softened)
    orogenyStrength,                                            // F1 — isotropic ridged ↔ anisotropic fold-belt blend
    orogenyAxis,                                                // F1 — per-planet strike direction (unit vec2, seed-derived)
    chasmaDepth,                                                // F4 — rift relief amplitude (tectonic activity × young-age) → canyonHeight
    chasmaCount,                                               // F4 — number of rifts (1..3, seed-derived)
    chasmaAxes,                                                // F4 — rift great-circle plane normals (3× unit vec3, seed-derived)
    scarpStrength,                                             // F5 — fault-scarp relief amplitude (cooling-contraction × smallness, eroded-down)
    scarpStyle,                                                // F5 — 0=thrust↔1=normal cliff polarity (rock vs ice, from volatileFraction)
    scarpAxis,                                                 // F5 — scarp-front orientation axis (unit vec3, seed-derived)
    plateauStrength,                                           // F6 — flat-topped highland relief amplitude (tectonic thickening, eroded-down)
    tesseraStrength,                                           // F6 — crosscutting-lattice amplitude (high-stress gate, eroded-down)
    tesseraAxes,                                               // F6 — 2 lattice orientations (unit vec3 ×2, seed-derived)
    volcanismStrength,                                         // F7 — edifice density/size gate (tidal + resurfacing + arc proxy)
    edificeMaxHeight,                                          // F7 — edifice height scale ∝ 1/g, clamped [0.2,2.0] (low-g → giant shields)
    shieldStratoMix,                                           // F7 — 0=effusive shield ↔ 1=explosive strato (viscosity/habitability proxy)
    lavaCoverage,                                              // F8 — flood-basalt resurfacing fraction (D11; SMOOTHS/suppresses relief)
    lavaActivity,                                              // F8 — emissive-crack glow intensity (D12 tidal; cold plains vs glowing lava)
    channelDensity,                                            // F8 — leveed-channel/rille gate (seed × activity; _derived-only, combiner deferred)
    lavaAxis,                                                  // F8 — wrinkle-ridge strike direction (unit vec3, seed-derived)
    cryoActivity,                                              // Cryo P7 — SHARED uCryoActivity gate (tidal×volatiles×cold); F9/F10 read it (registry LIVE)
    frostMaxCoverage,                                          // Cryo step 2 — frost BUDGET (D2 volatileFraction); ≤0 ⇒ shader early-out
    frostCondensationT,                                        // Cryo step 2 — per-species freeze point (K); 0=bone-dry no-frost; localT<this ⇒ frost
    frostLatitudeBias,                                         // Cryo step 2 — D3 axial-tilt: high obliquity → low-latitude seasonal frost
    frostAlbedo,                                               // Cryo step 2 — frost tint (vec3; luminance load-bearing, colour stylized) by species
    frostLocked,                                               // Cryo step 2 — 1 ⇒ tidally-locked eyeball cap (antistellar) via vSubstellarAngle
    tempEq: T,                                                 // Cryo step 2 — T_eq passthrough for the shader localT field (uPlanetTempEq)
    pldStrength,                                               // Cryo step 3 — F22 PLD strata dark-band dip (cap budget × surface-age preservation); ≤0 ⇒ no banding
    pldLevels,                                                 // Cryo step 3 — F22 PLD annular band count (constant, lab-tunable)
    subStrength,                                                // Cryo step 4 — F18 sublimation-relief gate (frost budget × species-active); ≤0 ⇒ combiner early-out
    glacialStrength,                                            // Cryo step 5 — F17 glacial-relief gate (volatile budget, HIGHER threshold than frost); ≤0 ⇒ combiner early-out
    glacialFlowVigor,                                          // Cryo step 5 — F17 flow-lineation amplitude ∝ 1/g (low-g → thicker sheets, bolder lineations)
    chaosCellScale,                                            // F9 — raft size (voronoi3d frequency)
    chaosRaftJitter,                                           // F9 — raft height/tilt displacement (∝ 1/g — low-g moons displace more)
    chaosMatrixRough,                                          // F9 — refrozen inter-raft matrix roughness
    doubleRidgeFreq,                                           // F10 — double-ridge line frequency
    cryoRidgeOffset,                                           // F10 — double-ridge flank position (→ doubleRidgeProfile; ≠ F1 uRidgeOffset)
    cryoRidgeWidth,                                            // F10 — double-ridge crest sharpness (→ doubleRidgeProfile)
    groovedBandFreq,                                           // F10 — fine grooved-band ridge frequency (Ganymede)
    cryoRidgeAxes,                                             // F10 — [double-ridge dir, grooved-band dir] (2× unit vec3, seed-derived)
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
    ejectaStrength,                                             // F3 — ejecta apron amplitude (tracks craterDensity)
    ejectaRampart,                                             // F3 — 0=dry skirt ↔ 1=fluidized rampart ridge (D2 volatiles)
    rayBrightness,                                             // F3 — bright-ray albedo strength (airless-only × young)
    emissive: hot * 0.25,                                        // F8: faint thermal-floor only — the SPATIAL lava cracks (lavaActivity) now carry the glow (no double-count)
    limbStrength: hasAtmo ? 0.7 : 0.0,                           // rim glow needs an atmosphere
    specStrength: hasAtmo ? mix(iron * 0.15, 0.8, clamp01(liquidStability / 0.5)) : iron * 0.15,  // ocean specular vs faint metal sheen
    auroraIntensity: magneticField * (hasAtmo ? 1 : 0),         // Optical reads the field; aurora needs an atmosphere to excite
    cloudCoverage: hasAtmo ? clamp01((d.habitability ?? 0) + 0.2) : 0,
    reliefAmplitude: mix(1.0, 0.6, erosion),                     // eroded worlds = softer relief
    ...qualityKnobs(qualityTier),
  };
}

// ── Real-units → unit-sphere uniform conversion (planet-scale-normalization-2026-06-15, AC1) ──
// Pure helpers that let deriveUniforms (and the lab GUI, later phase) express planet radius,
// feature horizontal size, and relief height in REAL km — converting to the shader's unit-sphere
// uniform space given the planet's real radius. The shader still runs on a unit sphere; only the
// uniform VALUES change. These do NOT touch the analytic-gradient / voronoi3d / crater-shape math.
// ⭐ EXTRACTED 2026-08-09 (PLAN §4 "Step 5", 5b): `R_EARTH_KM` and `featureFrequencyFromKm` are now
// DEFINED in src/worldengine/base/featureScale.js and imported BACK here, so the shared pack writer
// (src/worldengine/port/writePackUniforms.js) and this lab core call the SAME function object, not
// two copies that agree today — the heightNoise.glsl.js pattern. The re-export keeps every existing
// importer working unchanged; tests/pack-contract.test.js pins single-definition by identity with
// `toBe`, which a copy cannot satisfy even when its numbers are byte-identical. ⚠ The `import`
// sits HERE, not at the top (imports hoist): the edit is LINE-COUNT-NEUTRAL so §10 refs still hold.
import { R_EARTH_KM, featureFrequencyFromKm } from './src/worldengine/base/featureScale.js';
export { R_EARTH_KM, featureFrequencyFromKm };

// Relief height → unit-sphere amplitude. EXACT: a height of h km on a body of real radius
// radius_km is a fraction h / radius_km of the (unit) radius. No clamping here — the gravity cap
// is applied separately via reliefGravityFactor.
export function reliefAmplitudeFromKm(featureHeightKm, radiusEarth) {
  return featureHeightKm / (radiusEarth * R_EARTH_KM);
}

// Gravity cap on authored relief height. Bounded, MONOTONIC-DECREASING in surfaceGravity:
// low-g worlds (Mars/Titan) get a larger factor (exaggerated relief, Olympus-Mons read); high-g
// worlds get a smaller factor (isostatic limit, subdued relief). Chosen form:
//   clamp( surfaceGravity^(-0.5), FLOOR, CEIL )  with FLOOR = 0.4, CEIL = 2.5.
// g^(-1/2) is smooth, strictly decreasing on g > 0, equals 1 at g = 1 (Earth ⇒ unchanged), and
// the clamp keeps it off the degenerate flat/spiky extremes. surfaceGravity is floored at 1e-3
// before the power so a near-zero g can't blow up before the clamp catches it.
export function reliefGravityFactor(surfaceGravity) {
  const FLOOR = 0.4, CEIL = 2.5;
  const f = Math.pow(Math.max(surfaceGravity, 1e-3), -0.5);
  return Math.min(CEIL, Math.max(FLOOR, f));
}

// ── Inc-3 relief-scale envelope (2026-07-21) — the DERIVED, strength-capped replacement for the
// lab's retired reliefNorm = (1/RE)·reliefGravityFactor(g). The (1/RE) term was UNCAPPED and blew
// apparent relief/radius to ~7× at low radius (R=0.27,g=0.28 → 7.0×; → ∞ as R → 0), which the
// v2-6 UAT read as "molten waves" (MATH-CHECK-2026-07-21). deriveConditionVector derives
// surfaceGravity from the drawn radius (g = g_c·f(R)/f(R_c) since gravity-selfcompression-2026-07-28;
// it was g_c·(R/R_c) when this comment was written), so g is MONOTONIC in the drawn radius at fixed
// composition — g ALREADY carries the radius signal. Radius therefore flows through g exactly ONCE
// (the audit footnote-14 double-dip resolved) and the explicit 1/RE is DROPPED.
//
// THAT ARGUMENT IS NOW TRUE AT THIS FUNCTION'S BIGGEST CALL SITE TOO (v2-relief-law-2026-07-28).
// It used to be false there: planet-lod-lab.html computed uPerturb from `state.surfaceGravity`,
// whose sole writer took deriveUniforms' CANONICAL, radius-blind g rather than the condition
// vector's, so for the global relief-amplitude uniform the radius signal never arrived. That
// writer (planet-lod-lab.html:3033) now assigns deriveConditionVector(...).surfaceGravity, so the
// radius signal does arrive and the "radius flows through g exactly once" argument covers the
// uniform as well as the vector. The historical record of the defect, kept because it explains
// why the fix had to ship in the same commit as the law:
//   docs/WORKSTREAMS/world-engine-gravity-selfcompression-2026-07-28/evidence/FINDING-uperturb-radius-blind.md
//
// ── THE SEAM AT g = 1 (v2 relief law, 2026-07-28). CALIBRATION BELOW, DERIVATION ABOVE. ───────
// This is a DATA boundary, NOT a physical transition. Nothing changes about the rock at 1 g; what
// changes is whether there is anything to fit. Earth is the only Solar-System body at ≥ 0.9 g, so
// the measurements the calibration rests on simply stop there. Two branches, both in g only:
//   g <  1  →  g^-Q_RELIEF          the shipped 5-body least-squares fit, UNCHANGED and
//                                   bit-identical to the pre-v2 build at every reachable point.
//   g >= 1  →  g^-Q_RELIEF_DERIVED  Guimond+2022's ABSOLUTE slope 1.09, converted to fractional
//                                   relief/R, so absolute relief h = E·R follows g^-1.09 ON THE
//                                   ROCKY SUPER-EARTH BRANCH (where gravity goes as R^1.70).
// Continuous by construction: Math.pow(1, ±anything) === 1, so both branches meet at exactly 1 for
// ANY radius. The conversion factor that makes the derived branch fractional is the radius at which
// a body's own curve crosses 1 g, and that radius cancels against the body's radius identically —
// which is why this function still needs no radius term and radiusEarth stays unused.
//
// TWO RESIDUALS, DECLARED RATHER THAN HIDDEN:
//  (1) NON-ROCKY classes above the seam receive an absolute exponent of -0.678235294117647, not
//      -1.09 (37.8% shallow). Reachable inside the seeded draw bands (Jovian and Sub-Neptune draw
//      wholly above the seam; Saturnian and Neptunian partly). The cause is NOT this function: it
//      is body-condition-vector.js's declared debt, where gravityRadiusRatio gates the
//      self-compression shape on the rocky class and leaves every other class on the linear ratio
//      R/R_c — a status quo held deliberately because Zeng has no standing for h2-he envelopes,
//      ice mantles or carbon worlds. No two-argument (R, g) form can repair it and stay continuous.
//  (2) The ROCKY SUB-BRANCH CORNER (drawn R < 1 while g ≥ 1) receives -0.928235294117647, because
//      below 1 R⊕ gravity goes as R^(4/3) and the conversion exponent is 0.75, not 0.5882. Worst
//      magnitude error ≈1.8%. Reachable on exactly two presets and only by dragging the radius
//      slider, never by a seeded draw: Magma R ∈ [0.9214, 1) and Moon/Mercury R ∈ [0.9952, 1).
//
// surfaceGravity is floored at
// 1e-3 before the power so a degenerate near-zero g caps the multiplier at (1e-3)^-Q ≈ 55 (≤ the
// Phobos strength extreme) instead of blowing up. Q_RELIEF and RELIEF_CEIL are anchor-fit
// in the workstream's calibration/relief-envelope.mjs (least squares through the real-body
// relief/radius anchors Earth/Mercury/Mars/Moon/Mimas, forced Earth=1); RELIEF_FLOOR is NOT — it
// was inherited from reliefGravityFactor's 0.40 and was moved to 0.01 by the v2 relief law, where
// it stopped being a physics clamp and became a degenerate-safety guard. radiusEarth is accepted
// for call-site symmetry with the old reliefNorm signature but is UNUSED in the return (radius via
// g). Sign kept: lower g ⇒ higher relief/R.
// ⚠ Q_RELIEF IS CALIBRATION, AND IT DISAGREES WITH THE STRENGTH MODEL. It is a least-squares fit
// through Solar System anchors — all of them at or below 1 g, because Earth is the only body in the
// system at ≥ 0.9 g. Melosh 2011 ch.3 (eq. 3.17, and Figure 3.5 at book p.69) gives the competing
// STRENGTH-MODEL line, fractional relief ∝ R̄^-2; refitting these same anchors gives R̄^-0.86
// (g^-0.559, which is where 0.58 comes from). The model wants a size dependence ~2.3× steeper in
// log-slope than the bodies actually show, and Melosh attributes the gap to history rather than
// strength. Two further cautions before anyone retunes this: Mimas (R = 198 km) sits ON his
// frictional/strength regime break at R̄ ≈ 200 km, so including it fits across two regimes
// (excluding it moves 0.559 → 0.699); and there is NO measured super-Earth topography at all, so
// nothing above 1 g is calibration. Full record + verbatim quotes:
//   research/superearth-relief-law-citations-resolved-2026-07-28.md
export const Q_RELIEF = 0.58;      // relief/R ∝ g^-Q_RELIEF BELOW the seam; 2-sig-fig least-squares fit (CALIBRATION, g ≤ 1 only)
// ⚠ HAND-WRITTEN LITERAL, deliberately NOT imported/derived. = 1.09 + 1/GRAV_R_EXP_SUPER
// = 1.09 + 1/1.70, exact in IEEE. Guimond, Rudge & Shorttle 2022 (doi:10.3847/PSJ/ac562e) give
// the ABSOLUTE slope 1.09; dividing through by the rocky radius→gravity exponent 1.70 converts it
// to the fractional relief/R this function returns. Importing GRAV_R_EXP_SUPER to derive it would
// turn this zero-import leaf module into one that pulls baseStep/alea/simplex-noise; the coupling
// is guarded instead by a cross-module consistency test in
// tests/worldengine-inc3-relief-envelope.test.js, which hand-writes BOTH numbers.
export const Q_RELIEF_DERIVED = 1.678235294117647;
export const RELIEF_FLOOR = 0.01;  // DEGENERATE-SAFETY GUARD, not a physics clamp. It names no binding
                                   // gravity: on the rocky curve it first binds at R = 5.0236 / M = 392 M⊕,
                                   // ~78x past Guimond's cited 5 M⊕ upper domain edge, and it does not bind
                                   // on any seeded draw of any preset (worst is Jovian at R≈14 → 0.14459).
export const RELIEF_CEIL = 133;    // apparent-0.40 ceiling as a multiplier; never binds (g-floor caps ≈ 55)
export function reliefEnvelope(radiusEarth, surfaceGravity) {
  const g = Math.max(surfaceGravity, 1e-3);
  return Math.min(RELIEF_CEIL, Math.max(RELIEF_FLOOR, Math.pow(g, g >= 1 ? -Q_RELIEF_DERIVED : -Q_RELIEF)));
}

// Animation-rate factor. Bounded, ∝ 1/radiusEarth relative to a reference radius: big worlds
// animate slower (lava breathing, glint shimmer, storm drift, aurora pulse). Chosen form:
//   clamp( refRadiusEarth / radiusEarth, FLOOR, CEIL )  with FLOOR = 0.1, CEIL = 3.
// refRadiusEarth defaults to 1 (Earth). radiusEarth is floored at 1e-6 so a degenerate ~0 radius
// can't divide-by-zero before the clamp.
export function animationRateFactor(radiusEarth, refRadiusEarth = 1) {
  const FLOOR = 0.1, CEIL = 3.0;
  const f = refRadiusEarth / Math.max(radiusEarth, 1e-6);
  return Math.min(CEIL, Math.max(FLOOR, f));
}

// ── Stage-D provinceWeightFromField (LIVE 2026-06-10) — CPU mirror of the GLSL accessor's
// MAPPING stage: field sample (already in [0,1]) → per-feature weight, given an affinity row
// from planet-archetypes.js PROVINCES and the global influence dial. The GLSL computes
//   f' = polarity >= 0 ? f : 1 - f
//   w  = mix(1, floor + (1 - floor) * f', dial)
// Pinned properties (vitest): dial 0 ⇒ 1 exactly; range [mix(1,floor,dial), 1]; monotone in f
// per polarity; Lipschitz |Δw| ≤ (1-floor)·dial·|Δf| (soft fields stay soft through the map).
// The SPATIAL fields themselves are smoothstep-of-FBM (C¹ by construction) in the shader.
export function provinceWeightFromField(fieldValue, affinity, dial = 1) {
  const f = affinity.polarity >= 0 ? fieldValue : 1 - fieldValue;
  return mix(1, affinity.floor + (1 - affinity.floor) * f, dial);
}

// ─────────────────────────────────────────────────────────────────────────────────────────────
// APPROACH MEASUREMENT — the shared half of the agent-facing camera API.
//
// Both front-ends frame bodies through their OWN camera (the game drives ShipCameraSystem, the lab
// writes state.distance/yaw/pitch), because their camera stacks are genuinely different. What they
// must NOT do differently is decide where the rungs of an approach are, or what LOD state a given
// distance implies — a paired A/B is only a comparison if both sides answer those two questions
// with the same code. That is what lives here.
// ─────────────────────────────────────────────────────────────────────────────────────────────

/**
 * The rungs of an approach, from far to near, in body radii.
 *
 * ⭐ GEOMETRIC, NOT LINEAR, and the choice is load-bearing rather than aesthetic. Apparent size goes
 * as 1/d, so a linear ladder from 20 to 1.2 spends most of its rungs in the range where the disc is
 * barely changing and crosses the entire visually-violent last stretch in one step. Equal RATIOS
 * give equal apparent-size increments, which is the quantity the eye is actually judging when the
 * question is "does detail keep resolving as I close?".
 *
 * Endpoints are written exactly rather than accumulated, so `from` and `to` come back as the caller
 * spelled them and a sweep's first and last rows can be quoted without a float-drift caveat.
 *
 * @param {number} from  starting distance in body radii (the far end)
 * @param {number} to    ending distance in body radii (the near end); must be > 0 and < from
 * @param {number} steps how many rungs, counting both endpoints; must be >= 2
 * @returns {number[]} descending distances in body radii
 */
export function approachLadder(from, to, steps) {
  if (!(from > 0) || !(to > 0)) throw new RangeError(`approachLadder: distances must be > 0 (got from=${from}, to=${to})`);
  if (!(from > to)) throw new RangeError(`approachLadder: an approach must close — need from > to (got from=${from}, to=${to})`);
  const n = Math.floor(steps);
  if (!(n >= 2)) throw new RangeError(`approachLadder: need at least 2 rungs to span both endpoints (got ${steps})`);
  const ratio = Math.log(to / from) / (n - 1);
  const out = new Array(n);
  for (let i = 0; i < n; i++) out[i] = from * Math.exp(ratio * i);
  out[0] = from;
  out[n - 1] = to;
  return out;
}

/**
 * What the renderer's LOD law says SHOULD happen at a given distance — the prediction half of the
 * live-vs-predicted pair the camera API reports.
 *
 * ⭐ WHY THE PAIR EXISTS AT ALL. Reporting one blended "octaves" number would make a body whose
 * uniform never got updated indistinguishable from a body correctly sitting at 4 octaves because it
 * is far away. Reported separately, a disagreement is a visible fact — which is how the camera API
 * surfaces planet-class moons never registering with LODManager (their live uOctaves stays at its
 * 4.0 default at every distance) instead of averaging it into something plausible.
 *
 * `saturated` is called out because it is the whole of Max's approach-consistency criterion: lodRampOf
 * is smoothstep(20, 6, d), so from 6 body radii inward the octave budget is pinned at its ceiling
 * while the disc keeps growing. Everything below that distance resolves no new detail BY THE LAW,
 * not by accident — a fact the sweep should print rather than leave to be inferred from equal numbers.
 *
 * @param {number} distanceRadii camera distance in body radii
 * @param {number} [qualityTier=1] the GPU quality trim autoOctaves applies
 * @returns {{ramp: number, octaves: number, saturated: boolean}}
 */
export function lodPredictionAt(distanceRadii, qualityTier = 1.0) {
  const ramp = lodRampOf(distanceRadii);
  return {
    ramp,
    octaves: autoOctaves(ramp, qualityTier),
    // >= rather than === : smoothstep returns exactly 1 at and below its near edge, but the guard is
    // written as a bound so a future eased ramp that asymptotes cannot silently stop reporting it.
    saturated: ramp >= 1.0,
  };
}
