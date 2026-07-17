// tests/worldengine-v2-4-province.test.js — World Engine V2-4 slice-4 (history-tied province).
// Covers AC-PROVINCE-ASSOC (the honesty-critical AC) + AC-0 (taxonomy exemption) + channel presence/inertness.
//
// The province channel (BUILD-PLAN §4, calibration §6.2/§6.3):
//   • present on BOTH carriers (makeSphereField + makeSubstrate) as a Uint8Array {0=craton,1=orogen,2=basin};
//   • written UNIVERSALLY (every dispatch path) by the §0 post-dispatch seam, AFTER writeAccommodation;
//   • HISTORY-TIED, provably: the real derivation's mean-η² CLEARS the 99th pct of a CONTIGUITY-PRESERVING
//     spatial null (NOT a label shuffle — that would let a blobby noise province pass, lens B#2), and a
//     position-noise CONTROL is REJECTED (η² ≤ that p99) — the rejection is asserted, not assumed;
//   • regions are CONTIGUOUS (legible blobs, not per-node speckle) — contiguity above a calibrated floor;
//   • DETERMINISTIC (RNG-free writer; double-run bit-identical) and byte-inert (writes only `province`).
//
// The pass line is an OBSERVED number (assoc-null.mjs, §6.3): across presets×seeds the real η² (0.23–0.62)
// sits well above the spatial-null p99 (0.04–0.17) and every position-noise control sits below it. The test
// asserts the RELATIONSHIP (real > p99, control ≤ p99) computed live on the same deterministic mesh — so it
// re-derives, not re-reads, the calibration. Metered-safe: pure node/vitest, no claude -p.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { makeSphereField } from '../src/worldengine/base/sphereField.js';
import { makeSubstrate } from '../src/worldengine/base/substrate.js';
import {
  writeProvince, deriveProvinceLabels, provinceAssociation, provinceStats,
  assessProvinceAssociation, classProportions,
  CRATON, OROGEN, BASIN, OROGEN_CUT, BASIN_CUT, PROVINCE_RELAX_PASSES,
} from '../src/worldengine/base/province.js';
import { buildIrregularSphere, writeBodyRelief, DEFAULT_GRAIN_DRIVERS } from '../planet-lod-rivers.js';
import { DRIVER_PRESETS, PRESET_ARCHETYPE } from '../driver-presets.js';
import { buildNeutralBodyDrivers } from '../body-drivers.js';
import { deriveConditionVector } from '../body-condition-vector.js';
import { deriveUniforms } from '../planet-lod-lab-core.js';
import { QUALITY_TIER } from './fixtures/v2-0-carrier-golden.mjs';

const N = 3000;
const NPERM = 200;                      // BUILD-PLAN §6.3 — the null ensemble size (matches assoc-null.mjs)
const MESH = buildIrregularSphere(N, 2);
const CONTIGUITY_FLOOR = 0.90;          // observed 0.977–0.998 across presets (province-thresholds.mjs) — floor well below

// Production-shaped condition-BEARING bundle (mirrors the host-channels/margins tests).
function bundle(name, seed) {
  const fp = DRIVER_PRESETS[name];
  const u = deriveUniforms(fp, QUALITY_TIER);
  return {
    archetype: PRESET_ARCHETYPE[name] ?? null,
    locked: !!(fp && fp.tidalState && fp.tidalState.locked),
    grainDrivers: DEFAULT_GRAIN_DRIVERS,
    bodyDrivers: { ...buildNeutralBodyDrivers(u, fp), condition: deriveConditionVector(fp, u, fp.radiusEarth) },
    macroSeed: seed, heightSeed: 'e6:' + (seed | 0),
    T_eq: (fp && fp.T_eq != null) ? fp.T_eq : 288,
  };
}
function build(name, seed) {
  const carrier = makeSphereField(MESH);
  const relief = writeBodyRelief(carrier, bundle(name, seed));
  return { carrier, path: relief.path };
}
const PROV = readFileSync(fileURLToPath(new URL('../src/worldengine/base/province.js', import.meta.url)), 'utf8');
// balanced-brace slice of a function body (past the signature's opening `{`)
function fnBody(code, sig) {
  const start = code.indexOf(sig);
  expect(start, `"${sig}" found in province.js`).toBeGreaterThan(-1);
  const open = start + sig.length - 1;
  let depth = 0, i = open;
  for (; i < code.length; i++) { if (code[i] === '{') depth++; else if (code[i] === '}') { depth--; if (depth === 0) break; } }
  return code.slice(open, i + 1);
}

// ─────────────────────────────────────────────────────────────────────────────────────────────────
describe('V2-4 AC — province channel presence + identity on both carriers', () => {
  it('makeSphereField exposes province as a Uint8Array of length count, distinct from the E9 reserves', () => {
    const c = makeSphereField(MESH);
    expect(c.province).toBeInstanceOf(Uint8Array);
    expect(c.province.length).toBe(c.count);
    expect(c.province).not.toBe(c.maturity);
    expect(c.province).not.toBe(c.baseLevel);
    expect(c.province).not.toBe(c.accommodation);
  });
  it('makeSubstrate exposes province as a Uint8Array of length count (parity)', () => {
    const s = makeSubstrate({ n: 16, lat0Deg: -80, lat1Deg: 80, domainKm: 1000 });
    expect(s.province).toBeInstanceOf(Uint8Array);
    expect(s.province.length).toBe(s.count);
  });
  it('the seam writes province ∈ {0,1,2} on EVERY dispatch path (universal — unlike the plate-only margins)', () => {
    const perPath = {
      plate: 'Rocky (Earthlike)', shell: 'Europa (icy moon)', despun: 'Mars (arid rocky)',
      volcanic: 'Lava (hot airless)', 'stagnant-lid': 'Venus (sulfuric shroud)',
    };
    for (const [path, name] of Object.entries(perPath)) {
      const { carrier, path: got } = build(name, 1);
      expect(got, `${name} takes the ${path} path`).toBe(path);
      for (let i = 0; i < carrier.N; i++) expect(carrier.province[i] <= 2, `${name} node ${i} label ∈ {0,1,2}`).toBe(true);
      // not a dead all-one-class channel on a relief-bearing world (some craton AND some basin at least)
      const cp = classProportions(carrier.province, carrier.N);
      expect(cp[CRATON], `${name}: cratons present`).toBeGreaterThan(0);
      expect(cp[BASIN], `${name}: basins present`).toBeGreaterThan(0);
    }
  });
});

describe('V2-4 AC-PROVINCE-ASSOC — real province clears the spatial null; noise control REJECTED (across presets×seeds)', () => {
  const PRESETS = ['Rocky (Earthlike)', 'Ocean (temperate)', 'Mars (arid rocky)', 'Venus (sulfuric shroud)', 'Europa (icy moon)'];
  const SEEDS = [1, 42];
  for (const name of PRESETS) {
    for (const seed of SEEDS) {
      it(`${name} @${seed}: real η² > spatial-null p99 (PASS); position-noise control ≤ p99 (REJECTED)`, () => {
        const { carrier } = build(name, seed);
        const fields = [carrier.faultDensity, carrier.grainMag, carrier.accommodation];
        const r = assessProvinceAssociation(carrier.province, MESH, fields, { NPERM, seed });
        // (1) the real derivation is history-tied: it beats the contiguity-matched spatial null's 99th pct
        expect(r.realEta2, `${name}@${seed}: real η² ${r.realEta2.toFixed(4)} > null p99 ${r.nullP99.toFixed(4)}`).toBeGreaterThan(r.nullP99);
        expect(r.pass, `${name}@${seed}: decision rule PASS`).toBe(true);
        // (2) the load-bearing REJECTION half: a single position-noise control (one null draw) is REJECTED —
        //     it sits inside the spatial null (≤ p99) AND far below the real province.
        expect(r.controlEta2, `${name}@${seed}: control η² ${r.controlEta2.toFixed(4)} ≤ null p99 ${r.nullP99.toFixed(4)}`).toBeLessThanOrEqual(r.nullP99);
        expect(r.controlRejected, `${name}@${seed}: control REJECTED by the decision rule`).toBe(true);
        expect(r.controlEta2, `${name}@${seed}: control ≪ real (robust separation)`).toBeLessThan(r.realEta2);
        // the null is a real distribution, not degenerate zero
        expect(r.nullP99, 'spatial-null p99 is a positive observed number (autocorrelation is present)').toBeGreaterThan(0);
      });
    }
  }

  it('a LABEL-SHUFFLE null would be too weak here — the spatial null p99 is strictly higher (autocorrelation)', () => {
    // Demonstrates WHY the null must be contiguity-preserving: shuffling labels destroys contiguity, so the
    // shuffle-null η² collapses far below the spatial-null p99. If we had used the shuffle null, the (blobby)
    // control would have towered over it and falsely PASSED — the pitfall lens B#2 fixed.
    const { carrier } = build('Rocky (Earthlike)', 1);
    const fields = [carrier.faultDensity, carrier.grainMag, carrier.accommodation];
    const labels = carrier.province.slice();
    // deterministic Fisher–Yates shuffle (fixed LCG — no Math.random) of the label array
    let st = 123456789 >>> 0;
    const rnd = () => ((st = (1103515245 * st + 12345) >>> 0) / 4294967296);
    for (let i = labels.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); const t = labels[i]; labels[i] = labels[j]; labels[j] = t; }
    const shuffleEta2 = provinceAssociation(labels, fields);
    const r = assessProvinceAssociation(carrier.province, MESH, fields, { NPERM, seed: 1 });
    expect(shuffleEta2, `shuffle-null η² ${shuffleEta2.toFixed(4)} ≪ spatial-null p99 ${r.nullP99.toFixed(4)}`).toBeLessThan(r.nullP99);
  });
});

describe('V2-4 AC-PROVINCE-ASSOC — contiguity: legible regions, not per-node speckle', () => {
  it('contiguity above the calibrated floor across presets (regions are blobs, components bounded)', () => {
    for (const name of ['Rocky (Earthlike)', 'Mars (arid rocky)', 'Venus (sulfuric shroud)', 'Europa (icy moon)']) {
      const { carrier } = build(name, 42);
      const st = provinceStats(carrier.province, MESH.adj, carrier.N);
      expect(st.contiguity, `${name}: contiguity ${st.contiguity.toFixed(3)} ≥ ${CONTIGUITY_FLOOR}`).toBeGreaterThanOrEqual(CONTIGUITY_FLOOR);
      // not per-node speckle: far fewer connected components than a fraction of N (blobs, not thousands of specks)
      expect(st.components, `${name}: ${st.components} components ≪ N/20`).toBeLessThan(carrier.N / 20);
    }
  });
  it('the relax passes REDUCE speckle: PROVINCE_RELAX_PASSES yields higher contiguity than raw labels', () => {
    const { carrier } = build('Rocky (Earthlike)', 1);
    const fields = { faultDensity: carrier.faultDensity, grainMag: carrier.grainMag, accommodation: carrier.accommodation };
    const raw = deriveProvinceLabels(fields, MESH.adj, carrier.N, { relaxPasses: 0 });
    const relaxed = deriveProvinceLabels(fields, MESH.adj, carrier.N, { relaxPasses: PROVINCE_RELAX_PASSES });
    const cRaw = provinceStats(raw, MESH.adj, carrier.N).contiguity;
    const cRel = provinceStats(relaxed, MESH.adj, carrier.N).contiguity;
    expect(cRel, `relaxed contiguity ${cRel.toFixed(3)} > raw ${cRaw.toFixed(3)}`).toBeGreaterThan(cRaw);
  });
});

describe('V2-4 AC-PROVINCE-ASSOC — determinism + byte-inertness', () => {
  it('the province channel is byte-identical across two fresh writeBodyRelief runs (deterministic per seed)', () => {
    const a = makeSphereField(MESH); writeBodyRelief(a, bundle('Rocky (Earthlike)', 7));
    const b = makeSphereField(MESH); writeBodyRelief(b, bundle('Rocky (Earthlike)', 7));
    expect(Buffer.from(a.province.buffer, a.province.byteOffset, a.province.byteLength)
      .equals(Buffer.from(b.province.buffer, b.province.byteOffset, b.province.byteLength)), 'province double-run bit-identical').toBe(true);
  });
  it('writeProvince writes ONLY province — the history fields it reads are byte-untouched (idempotent re-run)', () => {
    const { carrier } = build('Rocky (Earthlike)', 3);
    const snap = (a) => Buffer.from(Float32Array.from(a).buffer);
    const h0 = snap(carrier.height), fd0 = snap(carrier.faultDensity), gm0 = snap(carrier.grainMag), ac0 = snap(carrier.accommodation);
    const p0 = Buffer.from(Uint8Array.from(carrier.province));
    writeProvince(carrier, { seed: 3 });   // re-run: idempotent + touches only province
    expect(snap(carrier.height).equals(h0), 'height byte-untouched').toBe(true);
    expect(snap(carrier.faultDensity).equals(fd0), 'faultDensity byte-untouched').toBe(true);
    expect(snap(carrier.grainMag).equals(gm0), 'grainMag byte-untouched').toBe(true);
    expect(snap(carrier.accommodation).equals(ac0), 'accommodation byte-untouched').toBe(true);
    expect(Buffer.from(Uint8Array.from(carrier.province)).equals(p0), 'province re-run idempotent').toBe(true);
  });
  it('writeProvince is RNG-FREE (function body has no Math.random / Date.now / alea — the reserved seed is unconsumed)', () => {
    const body = fnBody(PROV, 'export function writeProvince(carrier, {');
    expect(body, 'writeProvince body: no Math.random').not.toMatch(/Math\.random/);
    expect(body, 'writeProvince body: no Date.now').not.toMatch(/Date\.now/);
    expect(body, 'writeProvince body: no alea draw (production writer is field-deterministic)').not.toMatch(/alea/);
  });
});

describe('V2-4 AC-0 — taxonomy exemption (province debug viz is NOT a PROVINCES/gProvince entry, lens B-m4)', () => {
  it('province.js does not touch the shader-province taxonomy (no PROVINCES / gProvince / initProvinces rewire)', () => {
    expect(PROV, 'no PROVINCES table').not.toMatch(/\bPROVINCES\b/);
    expect(PROV, 'no gProvince rewire').not.toMatch(/\bgProvince\b/);
    expect(PROV, 'no initProvinces').not.toMatch(/\binitProvinces\b/);
  });
  it('the lab binds the overlay toggle to a LOCAL object, NOT a state.<x>Enabled feature-card', () => {
    const LAB = readFileSync(fileURLToPath(new URL('../planet-lod-lab.html', import.meta.url)), 'utf8');
    // the toggle is `.add(provinceOverlayUI, 'show')` — never `.add(state, '...Enabled')`, so the
    // planet-archetypes panelEnableKeys regex cannot pick it up (drift guard stays green, unchanged).
    expect(LAB).toMatch(/\.add\(\s*provinceOverlayUI\s*,\s*'show'\s*\)/);
    expect(LAB, 'overlay is not registered as a state.<x>Enabled feature card').not.toMatch(/\.add\(state,\s*'province\w*Enabled'\)/);
  });
});
