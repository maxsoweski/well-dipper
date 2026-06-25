// src/worldengine/base/verify.js
// F7 GATE: field-level verifier. Pure, no three.js. Accepts {drivers,crust,substrate} (flat) or a
// sphere carrier (with adj + latDegOf). seamConsistent is a defined no-op-pass when there is no adj.
import { REGIME } from './substrate.js';
import { REGIME_BAND_DEG, GRAIN_BAND_DEG, SEAM_LAT_TOL_DEG } from './tectonic.js';

const between = (bands, la, lb) => bands.some(b => (Math.abs(la) - b) * (Math.abs(lb) - b) < 0);

function latOfIndex(sub, i) {
  if (typeof sub.latDegOf === 'function') return sub.latDegOf(i);
  // flat band: row -> latitude
  const n = sub.n; if (!n) return 0;
  const row = Math.floor(i / n);
  const t = n <= 1 ? 0 : row / (n - 1);
  return sub.lat0Deg + (sub.lat1Deg - sub.lat0Deg) * t;
}

export function verify(output) {
  const detail = [];
  const sub = output.carrier || output.substrate || output;
  const drivers = output.drivers || {};
  const crust = output.crust || {};
  const len = sub.regime ? sub.regime.length : (sub.height ? sub.height.length : 0);

  // ── finite ──
  let finite = true;
  for (const name of ['height','grainAngle','grainMag','regime','faultDensity','flowAccum','baseLevel','standing','maturity']) {
    const a = sub[name]; if (!a) continue;
    for (let i = 0; i < a.length; i++) if (!Number.isFinite(a[i])) { finite = false; detail.push(`finite: ${name}[${i}]=${a[i]}`); break; }
  }
  if (crust.crustalThickness) for (let i = 0; i < crust.crustalThickness.length; i++)
    if (!Number.isFinite(crust.crustalThickness[i])) { finite = false; detail.push(`finite: crustalThickness[${i}]`); break; }
  for (const [k, v] of Object.entries(drivers)) if (typeof v === 'number' && !Number.isFinite(v)) { finite = false; detail.push(`finite: drivers.${k}`); }
  for (const k of ['loveK2', 'thermalState', 'shellThickness']) if (typeof crust[k] === 'number' && !Number.isFinite(crust[k])) { finite = false; detail.push(`finite: crust.${k}`); }

  // ── bounded ──
  let bounded = true;
  if (sub.grainMag) for (let i = 0; i < sub.grainMag.length; i++) if (sub.grainMag[i] < 0 || sub.grainMag[i] > 1) { bounded = false; detail.push(`bounded: grainMag[${i}]=${sub.grainMag[i]}`); break; }
  if (sub.regime) for (let i = 0; i < sub.regime.length; i++) { const r = sub.regime[i]; if (r !== 0 && r !== 1 && r !== 2) { bounded = false; detail.push(`bounded: regime[${i}]=${r}`); break; } }
  if (crust.crustalThickness) for (let i = 0; i < crust.crustalThickness.length; i++) { const v = crust.crustalThickness[i]; if (v < 0 || v > 1) { bounded = false; detail.push(`bounded: crustalThickness[${i}]=${v}`); break; } }
  for (const k of ['rockyCrust','radialStrainMag','despinAmp','liquidStability','tidalHeat']) if (drivers[k] != null && (drivers[k] < 0 || drivers[k] > 1)) { bounded = false; detail.push(`bounded: drivers.${k}=${drivers[k]}`); }
  if (drivers.radialStrainSign != null && drivers.radialStrainSign !== 1 && drivers.radialStrainSign !== -1) { bounded = false; detail.push('bounded: radialStrainSign'); }
  if (crust.thermalState != null && (crust.thermalState < 0 || crust.thermalState > 1)) { bounded = false; detail.push('bounded: thermalState'); }

  // ── physicallyOrdered: compression concentrates toward the equator. Equator is THRUST-dominant;
  //    poles are NOT THRUST-dominant. (Contraction-biased fields make poles strike-slip, not normal,
  //    so we check "poles not thrust" rather than "poles normal".) ──
  let physicallyOrdered = true;
  if (sub.regime && len > 0) {
    let eqT = 0, eqC = 0, poT = 0, poC = 0;
    for (let i = 0; i < len; i++) {
      const al = Math.abs(latOfIndex(sub, i));
      if (al < 20) { eqC++; if (sub.regime[i] === REGIME.THRUST) eqT++; }
      else if (al > 70) { poC++; if (sub.regime[i] === REGIME.THRUST) poT++; }
    }
    if (eqC > 0 && poC > 0) {
      const eqFrac = eqT / eqC, poThrustFrac = poT / poC;
      if (!(eqFrac > 0.5 && poThrustFrac < 0.5)) { physicallyOrdered = false; detail.push(`physicallyOrdered: eqThrust=${eqFrac.toFixed(2)} poleThrust=${poThrustFrac.toFixed(2)}`); }
    }
  }

  // ── seamConsistent: same-latitude seam neighbours agree on regime (off REGIME_BAND_DEG) and on
  //    grainAngle (off the 45° GRAIN_BAND_DEG flip). No-op pass when there is no adjacency (flat). ──
  let seamConsistent = true;
  if (sub.adj && sub.regime) {
    outer:
    for (let i = 0; i < len; i++) {
      const li = latOfIndex(sub, i);
      for (const j of sub.adj[i]) {
        const lj = latOfIndex(sub, j);
        if (Math.abs(li - lj) >= SEAM_LAT_TOL_DEG) continue;
        if (!between(REGIME_BAND_DEG, li, lj) && sub.regime[i] !== sub.regime[j]) {
          seamConsistent = false; detail.push(`seamConsistent: regime ${i},${j} at lat~${li.toFixed(1)}`); break outer;
        }
        if (sub.grainAngle && !between([GRAIN_BAND_DEG], li, lj) && sub.grainAngle[i] !== sub.grainAngle[j]) {
          seamConsistent = false; detail.push(`seamConsistent: grain ${i},${j} at lat~${li.toFixed(1)}`); break outer;
        }
      }
    }
  }

  const pass = finite && bounded && seamConsistent && physicallyOrdered;
  return { pass, signals: { finite, bounded, seamConsistent, physicallyOrdered }, detail };
}
