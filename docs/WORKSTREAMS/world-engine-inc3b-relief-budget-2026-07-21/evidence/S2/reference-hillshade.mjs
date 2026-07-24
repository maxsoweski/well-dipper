// S2 surface-class reference builder — LRO/LOLA LDEM hillshade through the render display pipeline.
// PRIMARY reference per read-gate-thresholds.json .surfaceClass.referencePrimary.
// Data: LOLA gridded DEM LDEM_16 (16 px/deg, 5760x2880, LSB int16, HEIGHT = DN*0.5 m rel. 1737.4 km sphere).
// Source: NASA PDS Geosciences Node, lro-l-lola-3-rdr-v1 / lola_gdr / cylindrical / img / ldem_16.img
// Lighting matched to lightStaging: sun azimuth 40.6 deg, elevation 20.79 deg.
// Pipeline matched to render: posterize 6 luminance levels, downsample to disc-comparable pixel scale (pixelScale=3).

import fs from 'node:fs';
import { PNG } from 'pngjs';

const DIR = '/home/ax/projects/well-dipper/docs/WORKSTREAMS/world-engine-inc3b-relief-budget-2026-07-21/evidence/S2';

// ---- DEM spec (from ldem_16.lbl-class product) ----
const IMG = `${DIR}/ldem_16.img`;
const NCOL = 5760, NROW = 2880;      // 16 px/deg global cylindrical
const PPD = 16;
const SCALE = 0.5;                    // HEIGHT = DN * 0.5 meters
const R_MOON_M = 1737400;            // reference sphere radius (m) — for cellsize, not relief
const DEG2RAD = Math.PI / 180;

// ---- Lighting (frozen lightStaging) ----
const SUN_AZ = 40.6;                  // deg, from north, clockwise (GDAL convention)
const SUN_EL = 20.79;                 // deg above horizon
const POSTERIZE = 6;                  // render posterizeLevels
const PIXEL_SCALE = 3;                // render pixelScale (chunky-block factor)

// ---- Crop: heavily-cratered farside SOUTHERN HIGHLANDS (saturated, no maria) ----
// lat +90 -> row 0 (top).  row = (90 - lat)*PPD.   col = lon*PPD (lon 0..360, center 180).
// Region: lon 130..200 (nearside SE limb across farside centre), lat -5..-58 (southern highlands).
const LON_MIN = 130, LON_MAX = 200;   // 70 deg wide
const LAT_MAX = -5,  LAT_MIN = -58;   // 53 deg tall
const c0 = Math.round(LON_MIN * PPD);
const c1 = Math.round(LON_MAX * PPD);
const r0 = Math.round((90 - LAT_MAX) * PPD); // top row (less negative lat)
const r1 = Math.round((90 - LAT_MIN) * PPD); // bottom row
const cropW = c1 - c0;
const cropH = r1 - r0;
console.log(`crop rows ${r0}..${r1} (${cropH}) cols ${c0}..${c1} (${cropW})  lat[${LAT_MIN},${LAT_MAX}] lon[${LON_MIN},${LON_MAX}]`);

// ---- Load DEM crop -> elevation (m) ----
const buf = fs.readFileSync(IMG);
function elevAt(r, c) {
  // clamp to edges
  r = Math.max(0, Math.min(NROW - 1, r));
  c = Math.max(0, Math.min(NCOL - 1, c));
  const idx = (r * NCOL + c) * 2;
  return buf.readInt16LE(idx) * SCALE; // meters rel. sphere
}

// cellsize (m): latitude spacing constant; longitude spacing scales by cos(lat)
const cellY = (R_MOON_M * DEG2RAD) / PPD; // ~1895 m/px
function cellXatRow(r) {
  const lat = 90 - (r / PPD);
  return cellY * Math.cos(lat * DEG2RAD);
}

// ---- Lambertian hillshade (GDAL Horn method, z-factor = 1, true scale) ----
const zenithRad = (90 - SUN_EL) * DEG2RAD;
const azMath = (360 - SUN_AZ + 90) % 360; // GDAL math azimuth
const azMathRad = azMath * DEG2RAD;

const hs = new Float32Array(cropW * cropH);
for (let ry = 0; ry < cropH; ry++) {
  const R = r0 + ry;
  const cellX = cellXatRow(R);
  for (let rx = 0; rx < cropW; rx++) {
    const C = c0 + rx;
    // 3x3 Horn kernel (a b c / d e f / g h i)
    const a = elevAt(R - 1, C - 1), b = elevAt(R - 1, C), cc = elevAt(R - 1, C + 1);
    const d = elevAt(R, C - 1),                              f = elevAt(R, C + 1);
    const g = elevAt(R + 1, C - 1), h = elevAt(R + 1, C), i = elevAt(R + 1, C + 1);
    const dzdx = ((cc + 2 * f + i) - (a + 2 * d + g)) / (8 * cellX);
    const dzdy = ((g + 2 * h + i) - (a + 2 * b + cc)) / (8 * cellY);
    const slopeRad = Math.atan(Math.hypot(dzdx, dzdy));
    let aspectRad = Math.atan2(dzdy, -dzdx);
    if (aspectRad < 0) aspectRad += 2 * Math.PI;
    let v = Math.cos(zenithRad) * Math.cos(slopeRad) +
            Math.sin(zenithRad) * Math.sin(slopeRad) * Math.cos(azMathRad - aspectRad);
    if (v < 0) v = 0; if (v > 1) v = 1;
    hs[ry * cropW + rx] = v;
  }
}

// ---- Write pre-pipeline full-res grayscale hillshade (for the record) ----
function writeGray(path, data, w, hgt) {
  const png = new PNG({ width: w, height: hgt });
  for (let p = 0; p < w * hgt; p++) {
    const val = Math.round(data[p] * 255);
    png.data[p * 4] = val; png.data[p * 4 + 1] = val; png.data[p * 4 + 2] = val; png.data[p * 4 + 3] = 255;
  }
  fs.writeFileSync(path, PNG.sync.write(png));
}
writeGray(`${DIR}/reference-hillshade-prepipeline.png`, hs, cropW, cropH);
console.log(`wrote reference-hillshade-prepipeline.png (${cropW}x${cropH})`);

// ---- Display pipeline: downsample to disc-comparable scale, then posterize 6 ----
// Render disc: pxH 1060, discFracHeight ~0.70 => disc ~742 px; pixelScale 3 => ~247 effective px across disc.
// Match: downsample the crop so its SHORT side ~= 247 effective px, then nearest-upscale by PIXEL_SCALE for chunky look.
const EFF = 247;                       // disc-comparable effective resolution (short side)
const short = Math.min(cropW, cropH);
const factor = Math.max(1, Math.round(short / EFF));
const dw = Math.floor(cropW / factor);
const dh = Math.floor(cropH / factor);
const down = new Float32Array(dw * dh);
for (let y = 0; y < dh; y++) {
  for (let x = 0; x < dw; x++) {
    let s = 0, n = 0;
    for (let yy = 0; yy < factor; yy++) for (let xx = 0; xx < factor; xx++) {
      s += hs[(y * factor + yy) * cropW + (x * factor + xx)]; n++;
    }
    down[y * dw + x] = s / n;
  }
}
console.log(`downsample factor ${factor} -> ${dw}x${dh} effective`);

// posterize to POSTERIZE levels, evenly spread on [0,255]
function posterize(v) {
  let lvl = Math.floor(v * POSTERIZE);
  if (lvl > POSTERIZE - 1) lvl = POSTERIZE - 1;
  return Math.round(lvl * 255 / (POSTERIZE - 1));
}

// nearest-upscale by PIXEL_SCALE to match render's chunky-pixel display
const fw = dw * PIXEL_SCALE, fh = dh * PIXEL_SCALE;
const outPng = new PNG({ width: fw, height: fh });
for (let y = 0; y < fh; y++) {
  for (let x = 0; x < fw; x++) {
    const sv = down[Math.floor(y / PIXEL_SCALE) * dw + Math.floor(x / PIXEL_SCALE)];
    const val = posterize(sv);
    const p = (y * fw + x) * 4;
    outPng.data[p] = val; outPng.data[p + 1] = val; outPng.data[p + 2] = val; outPng.data[p + 3] = 255;
  }
}
fs.writeFileSync(`${DIR}/reference-lola-hillshade.png`, PNG.sync.write(outPng));
console.log(`wrote reference-lola-hillshade.png (${fw}x${fh}, posterize ${POSTERIZE}, pixelScale ${PIXEL_SCALE})`);
