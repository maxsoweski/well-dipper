// src/worldengine/instrument/sampling.js
// Non-visual analysis channel — SAMPLE GEOMETRY + UNIT CONVERSION (nonvisual-analysis-channel-2026-07-24).
//
// THREE-FREE, PURE. Where to put the sample points, and what the numbers that come back MEAN in physical
// units. Deliberately split from the GPU glue (fieldSampler.js) so all of the geometry and every unit
// conversion is testable headlessly — the part most likely to be silently wrong is the part that never
// needs a GPU.
//
// SPHERE CONVENTION: y is the polar axis, matching the lab shader's own `asin(N.y)` latitude
// (world-engine-lab.html:676). lat = asin(y), lon = atan2(z, x). A direction for (lat, lon) is therefore
// (cos lat cos lon, sin lat, cos lat sin lon). This matters for diagnoseAt(): a lat/lon Max reads off
// the screen has to land where he thinks it lands.
//
// ── THE TWO FRAMES, AND WHY BOTH ARE REPORTED ───────────────────────────────────────────────────────
// "How big is a form" has two different correct answers in this lab, and conflating them is what
// produced the UAT-failed first radius build.
//
//   PHYSICAL frame — lengths in km on the real body (radiusKm = radiusEarth * 6371). This is the frame
//       planetary science works in, the frame the generation systems should answer, and the frame the
//       radius census must be read in: "does bombardment produce the right crater sizes on a bigger
//       world" is a physical question.
//   ANGULAR frame — lengths in degrees of arc, independent of the body's size. On-screen size is this
//       times the drawn disc scale, so the angular frame is what the shipped display keying actually
//       holds constant: world-engine-lab.html keys texture frequencies to a display pseudo-radius
//       rather than the real radius precisely so on-screen form size stays put as the disc grows.
//
// A form held constant on SCREEN while the planet grows is NOT constant in km — it grows as sqrt(R)
// under the display-scale convention (the drawn disc goes as the square root of radius). Neither
// frame is "the truth"; they answer different questions. So every
// sampled field is described in BOTH, and no report is allowed to quote one without the other.

export const R_EARTH_KM = 6371;                  // mirrors planet-lod-lab-core.js (kept local: this module is THREE-free and standalone)
const DEG = Math.PI / 180;
const RAD_TO_DEG = 180 / Math.PI;

// ── unit conversion ─────────────────────────────────────────────────────────────────────────────────

/**
 * Shader height (unit-sphere fraction) -> kilometres on the real body.
 * Exact inverse of planet-lod-lab-core.js reliefAmplitudeFromKm(hKm, RE) = hKm / (RE * R_EARTH_KM).
 * True by definition of the unit-sphere height field, independent of how the amplitude uniform was
 * derived — so the display-frequency keying cannot corrupt this conversion.
 */
export function heightUnitsToKm(hUnits, radiusEarth) {
  return hUnits * radiusEarth * R_EARTH_KM;
}

/** Kilometres on the real body -> shader height units. */
export function kmToHeightUnits(hKm, radiusEarth) {
  return hKm / (radiusEarth * R_EARTH_KM);
}

/** Physical-frame grid: horizontal lengths come out in km on the real body. */
export function physicalGrid(width, height, radiusEarth) {
  return { mode: 'equirect', width, height, radiusKm: radiusEarth * R_EARTH_KM, frame: 'physical' };
}

/**
 * Angular-frame grid: horizontal lengths come out in DEGREES of arc. Setting the sphere radius to
 * 180/pi makes arc length equal arc degrees, so every descriptor works unchanged and simply reports
 * in degrees. Multiply by the drawn disc scale to get the on-screen reading.
 */
export function angularGrid(width, height) {
  return { mode: 'equirect', width, height, radiusKm: RAD_TO_DEG, frame: 'angular' };
}

/** Physical-frame patch grid of the given km span. */
export function physicalPatchGrid(width, height, spanKmX, spanKmY) {
  return { mode: 'patch', width, height, spanKmX, spanKmY, frame: 'physical' };
}

/** Angular-frame patch grid: the same window expressed in degrees of arc. */
export function angularPatchGrid(width, height, spanKmX, spanKmY, radiusEarth) {
  const R = radiusEarth * R_EARTH_KM;
  return {
    mode: 'patch', width, height,
    spanKmX: (spanKmX / R) * RAD_TO_DEG,
    spanKmY: (spanKmY / R) * RAD_TO_DEG,
    frame: 'angular',
  };
}

// ── direction generation ────────────────────────────────────────────────────────────────────────────

/** Unit direction for a latitude/longitude in degrees, in the lab's y-polar convention. */
export function dirFromLatLon(latDeg, lonDeg) {
  const la = latDeg * DEG, lo = lonDeg * DEG;
  return [Math.cos(la) * Math.cos(lo), Math.sin(la), Math.cos(la) * Math.sin(lo)];
}

/** Latitude/longitude in degrees for a unit direction. Inverse of dirFromLatLon. */
export function latLonFromDir(d) {
  const y = Math.max(-1, Math.min(1, d[1]));
  return { latDeg: Math.asin(y) * RAD_TO_DEG, lonDeg: Math.atan2(d[2], d[0]) * RAD_TO_DEG };
}

/**
 * Unit directions for a full-sphere equirect grid, row-major, matching the descriptor grid contract:
 * row 0 is the +90 side, column 0 is -180 longitude, cell centres at the half-step.
 */
export function equirectDirections(width, height) {
  const out = new Array(width * height);
  for (let j = 0; j < height; j++) {
    const lat = 90 - ((j + 0.5) * 180) / height;
    for (let i = 0; i < width; i++) {
      const lon = -180 + ((i + 0.5) * 360) / width;
      out[j * width + i] = dirFromLatLon(lat, lon);
    }
  }
  return out;
}

/**
 * Unit directions for a km-sized window centred on (latDeg, lonDeg), row-major with row 0 to the NORTH.
 *
 * Constructed on the sphere rather than on a tangent plane: with an east/north orthonormal frame at the
 * centre, a sample at angular offsets (au, av) is
 *     n*cos(au)*cos(av) + east*sin(au)*cos(av) + north*sin(av)
 * which reproduces the angular offset EXACTLY along both axes through the centre and departs only in
 * the cross terms. A plain gnomonic tangent-plane projection would stretch the km scale by 1/cos^2 out
 * at the corners; this does not, which is why patch-measured wavelengths can be quoted in km without a
 * projection caveat at the spans this instrument uses.
 *
 * At the poles the east direction is degenerate (the polar axis and the centre normal are parallel);
 * the frame falls back to the x axis so a polar patch still returns a well-formed grid.
 */
export function patchDirections({ latDeg, lonDeg, spanKmX, spanKmY, radiusEarth, width, height }) {
  const R = radiusEarth * R_EARTH_KM;
  const n = dirFromLatLon(latDeg, lonDeg);
  const polar = [0, 1, 0];
  let east = cross(polar, n);
  if (norm(east) < 1e-8) east = cross([1, 0, 0], n);   // polar degeneracy
  east = normalize(east);
  const north = normalize(cross(n, east));
  const spanAngX = spanKmX / R, spanAngY = spanKmY / R;
  const out = new Array(width * height);
  for (let j = 0; j < height; j++) {
    const av = (0.5 - (j + 0.5) / height) * spanAngY;   // row 0 is north
    for (let i = 0; i < width; i++) {
      const au = ((i + 0.5) / width - 0.5) * spanAngX;
      const ca = Math.cos(au), sa = Math.sin(au), cb = Math.cos(av), sb = Math.sin(av);
      out[j * width + i] = normalize([
        n[0] * ca * cb + east[0] * sa * cb + north[0] * sb,
        n[1] * ca * cb + east[1] * sa * cb + north[1] * sb,
        n[2] * ca * cb + east[2] * sa * cb + north[2] * sb,
      ]);
    }
  }
  return out;
}

/** Great-circle angular separation (radians) between two unit directions. */
export function angleBetween(a, b) {
  const d = Math.max(-1, Math.min(1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2]));
  return Math.acos(d);
}

// ── tiny vector helpers (local; this module stays dependency-free) ──────────────────────────────────
function cross(a, b) {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}
function norm(a) { return Math.hypot(a[0], a[1], a[2]); }
function normalize(a) {
  const l = norm(a);
  return l > 0 ? [a[0] / l, a[1] / l, a[2] / l] : [0, 0, 1];
}
