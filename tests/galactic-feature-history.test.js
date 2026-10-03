// Galactic Engine S1 — featureHistory + renderPack: determinism, distinctness, provenance, declared directions.
// Every distinctness/determinism check is a named function that ALSO runs against a broken control
// (a constant-output constructor), which must fail it — so a degenerate constant can't pass.
import { describe, it, expect } from 'vitest';
import { GalacticMap } from '../src/generation/GalacticMap.js';
import { featureHistory } from '../src/galactic/featureHistory.js';
import { renderPack, serializePack } from '../src/galactic/renderPacks.js';
import { findCloudSubjects } from '../src/galactic/subjects.js';

const gm = new GalacticMap('well-dipper-galaxy-1');
const { procedural, orion } = findCloudSubjects(gm);
const emissionNebulae = gm.findNearbyFeatures(gm.getStartPosition(), 3.0)
  .filter((f) => f.type === 'emission-nebula' && !f.isKnownObject);

/** Same input twice → identical record. */
function checkDeterministic(ctor, feature) {
  const a = JSON.stringify(ctor(feature));
  const b = JSON.stringify(ctor(structuredClone(feature)));
  if (a !== b) throw new Error('not deterministic');
}

/** Different features → different records (on the fields that carry the story, not just the id). */
function checkDistinct(ctor, fa, fb) {
  const strip = (h) => { const { featureId, seed, centreKpc, ...rest } = h; return JSON.stringify(rest); };
  if (strip(ctor(fa)) === strip(ctor(fb))) throw new Error('two different features produced the same history');
}

const FIXED = featureHistory(procedural);
const constantHistory = () => structuredClone(FIXED); // broken control

describe('featureHistory', () => {
  it('test subjects exist in the real GalacticMap (procedural nebula near the Sun, and Orion M42)', () => {
    expect(procedural).toBeTruthy();
    expect(orion).toBeTruthy();
    expect(emissionNebulae.length).toBeGreaterThanOrEqual(2);
  });

  it('is deterministic for the same feature', () => {
    expect(() => checkDeterministic(featureHistory, procedural)).not.toThrow();
    expect(() => checkDeterministic(featureHistory, orion)).not.toThrow();
  });

  it('two different seeds give different histories', () => {
    expect(() => checkDistinct(featureHistory, emissionNebulae[0], emissionNebulae[1])).not.toThrow();
  });

  it('BROKEN CONTROL: a constant-output history fails the distinctness check', () => {
    expect(() => checkDistinct(constantHistory, emissionNebulae[0], emissionNebulae[1])).toThrow(/same history/);
  });

  it('does not depend on where the observer stands (lab at the Sun vs game at the centre)', () => {
    const fromCentre = gm.findNearbyFeatures(procedural.position, 3.0).find((f) => f.seed === procedural.seed);
    expect(fromCentre.insideFeature).toBe(true);
    expect(JSON.stringify(featureHistory(fromCentre))).toBe(JSON.stringify(featureHistory(procedural)));
  });

  it('never treats GalacticMap placeholders (age 10 Gyr / metallicity 0) as physical for known objects', () => {
    expect(orion.context.age).toBe(10.0); // the placeholder is still there in the map
    const h = featureHistory(orion);
    expect(h.ageMyr).toBeLessThan(10); // an H II region, not a 10 Gyr population
    expect(h.provenance.source).toBe('catalog');
    expect(h.provenance.age).toBe('catalog');
    const p = featureHistory(procedural).provenance;
    expect(p.source).toBe('procedural');
    expect(p.age).toBe('galacticmap-context');
  });

  it('carries typed fields in pc / Myr', () => {
    const h = featureHistory(procedural);
    expect(h.radiusPc).toBeCloseTo(procedural.radius * 1000, 9);
    expect(h.ionizing.offsetPc).toHaveLength(3);
    expect(Math.hypot(...h.ionizing.offsetPc)).toBeLessThan(h.radiusPc);
    expect(h.dustToGas).toBeGreaterThan(0);
  });

  it('shape fields (v2): blister in [0,1] (Orion from the catalogue), triaxial axes with major = 1, lobes in range', () => {
    for (const f of [procedural, orion, ...emissionNebulae.slice(0, 20)]) {
      const h = featureHistory(f);
      expect(h.blister).toBeGreaterThanOrEqual(0);
      expect(h.blister).toBeLessThanOrEqual(1);
      expect(h.axes[0]).toBe(1);
      expect(h.axes[1]).toBeGreaterThanOrEqual(0.4);
      expect(h.axes[2]).toBeLessThanOrEqual(0.7);
      expect(h.lobeAmp).toBeGreaterThanOrEqual(0.2);
      expect(h.lobeAmp).toBeLessThanOrEqual(0.45);
    }
    expect(featureHistory(orion).blister).toBe(0.9);
  });

  it('declared direction: an older, stronger region has broken out further (higher blister)', () => {
    const young = { ...procedural, context: { ...procedural.context, age: 0.0006 } }; // 0.6 Myr
    const old = { ...procedural, context: { ...procedural.context, age: 0.02 } };     // 20 Myr
    expect(featureHistory(old).blister).toBeGreaterThan(featureHistory(young).blister);
  });

  it('two different seeds give different shapes (axes / lobes), deterministically', () => {
    const a = featureHistory(emissionNebulae[0]), b = featureHistory(emissionNebulae[1]);
    expect(a.axes).not.toEqual(b.axes);
    expect(a.lobeAmp).not.toBe(b.lobeAmp);
    expect(featureHistory(emissionNebulae[0]).axes).toEqual(a.axes);
  });
});

describe('renderPack', () => {
  it('is a plain serializable object, deterministic', () => {
    const p = renderPack(featureHistory(procedural));
    expect(JSON.parse(serializePack(p))).toEqual(JSON.parse(JSON.stringify(p)));
    expect(serializePack(renderPack(featureHistory(procedural)))).toBe(serializePack(p));
  });

  it('declared direction: a stronger ionizing source gives a brighter cloud and a bigger cavity', () => {
    const h = featureHistory(procedural);
    const strong = structuredClone(h);
    strong.ionizing.strength = h.ionizing.strength * 2;
    const a = renderPack(h, { overrides: {} }), b = renderPack(strong, { overrides: {} });
    expect(b.emission.scale).toBeGreaterThan(a.emission.scale);
    expect(b.cavity.radiusPc).toBeGreaterThan(a.cavity.radiusPc);
  });

  it('declared direction: more dust gives more extinction', () => {
    const h = featureHistory(procedural);
    const dusty = structuredClone(h);
    dusty.dustToGas = h.dustToGas * 2;
    expect(renderPack(dusty, { overrides: {} }).extinction.scale).toBeGreaterThan(renderPack(h, { overrides: {} }).extinction.scale);
  });

  it('registered overrides change the pack (the lab sliders write here)', () => {
    const h = featureHistory(procedural);
    const base = renderPack(h, { overrides: {} });
    const tuned = renderPack(h, { overrides: { sigma: 0.3 } });
    expect(tuned.noise.sigma).toBe(0.3);
    expect(base.noise.sigma).not.toBe(0.3);
  });
});
