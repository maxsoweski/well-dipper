/**
 * Barycentre render — docs/WORKSTREAMS/binary-barycentre-render-2026-08-18/contract.json
 *
 * ⛔ WHY THESE TESTS ARE SHAPED THIS WAY. `grep -c '^export' src/main.js` = 0, and the module
 * evaluates `new THREE.PerspectiveCamera(...)` (main.js:157) and `document.getElementById`
 * (main.js:187) at top level, so the per-frame sim step CANNOT be imported. The contract was
 * amended rather than the claim bent. What IS reachable headlessly, and is what these use:
 *   1. the pure arithmetic, extracted to src/physics/Barycentre.js + src/physics/BodyMass.js
 *   2. the SHIPPED body classes, which construct with no GL context — precedent
 *      tests/gas-body-lab-material.test.js:819 does the Planet half already
 *   3. a source scan over main.js, which pins the call site exists (existence, NOT behaviour —
 *      the pattern at src/cockpit/__tests__/mainNavWiring.test.js:45)
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { moonMassEarth, planetMassEarth } from '../src/physics/BodyMass.js';
import {
  DOMINANCE_THRESHOLD, predictMoonAngle, moonUnitDirection,
  barycentreOffset, dominantMoon, ringRadii,
} from '../src/physics/Barycentre.js';
import { Moon } from '../src/objects/Moon.js';
import { GravityField } from '../src/physics/GravityField.js';
import { generateSolarSystem } from '../src/generation/SolarSystemData.js';
import { StarSystemGenerator } from '../src/generation/StarSystemGenerator.js';

const MAIN = readFileSync(fileURLToPath(new URL('../src/main.js', import.meta.url)), 'utf8');

/** A plain (non-planet-class) moon as main.js:7623-7628 shapes it for the renderer. */
const plainMoon = (over = {}) => ({
  type: 'ice', radiusEarth: 0.25, orbitRadius: 12, inclination: 0.31,
  startAngle: 0.7, orbitSpeed: 0.021, radiusScene: 0.01,
  baseColor: [0.5, 0.5, 0.5], accentColor: [0.6, 0.6, 0.6],
  noiseScale: 1, ...over,
});

describe('AC-WOBBLE — the mass rule', () => {
  it('is byte-identical to the rule the physics uses', () => {
    const gf = Object.create(GravityField.prototype);
    for (const m of [
      plainMoon(), plainMoon({ type: 'terrestrial' }), plainMoon({ radiusEarth: undefined }),
      plainMoon({ planetData: { massEarth: 3.25 } }),
    ]) {
      expect(moonMassEarth(m)).toBe(gf._estimateMoonMass(m));
    }
  });

  it('⛔ never returns NaN for Sol, which carries no massEarth anywhere', () => {
    // grep -c massEarth src/generation/SolarSystemData.js === 0. Without the
    // estimateMassEarth fallback M_total is undefined and every planet in Sol
    // flies to NaN, taking lighting, moons, rings and gravity with it.
    const sol = generateSolarSystem();
    for (const entry of sol.planets || []) {
      expect(Number.isFinite(planetMassEarth(entry.planetData))).toBe(true);
      for (const m of entry.moons || []) expect(Number.isFinite(moonMassEarth(m))).toBe(true);
    }
  });
});

describe('AC-WOBBLE — the offset', () => {
  it('places the primary so the mass-weighted centre lands on the orbital point', () => {
    const moons = [
      { isPlanetMoon: false, _delegate: { orbitAngle: 0.4 }, data: plainMoon({ orbitRadius: 9 }) },
      { isPlanetMoon: false, _delegate: { orbitAngle: 2.1 }, data: plainMoon({ orbitRadius: 20, radiusEarth: 0.4 }) },
    ];
    const Mp = 4.2, dt = 0.017;
    const off = barycentreOffset(Mp, moons, dt);
    // Rebuild the definition independently: sum m_i*(P + a_i*u_i) + Mp*P === Mtot*B, with B at origin.
    let Mtot = Mp, sx = 0, sy = 0, sz = 0;
    for (const m of moons) {
      const mass = moonMassEarth(m.data);
      const u = moonUnitDirection(m, predictMoonAngle(m, dt));
      Mtot += mass;
      sx += mass * (-off.x + m.data.orbitRadius * u.x);
      sy += mass * (-off.y + m.data.orbitRadius * u.y);
      sz += mass * (-off.z + m.data.orbitRadius * u.z);
    }
    sx += Mp * -off.x; sy += Mp * -off.y; sz += Mp * -off.z;
    for (const v of [sx, sy, sz]) expect(Math.abs(v / Mtot)).toBeLessThan(1e-12);
  });

  it('carries the y term — an inclined moon lifts the primary off the y=0 plane', () => {
    const moons = [{ isPlanetMoon: false, _delegate: { orbitAngle: 1.0 }, data: plainMoon({ inclination: 0.4982 }) }];
    expect(Math.abs(barycentreOffset(1.0, moons, 0).y)).toBeGreaterThan(0);
  });

  it('⛔ reads a PLAIN moon\'s angle off the delegate, not the wrapper', () => {
    // BodyRenderer exposes no orbitAngle getter, so `moon.orbitAngle` is undefined for
    // every plain moon → NaN → the planet, its lighting, its moons, its rings and every
    // SOI query for it die at once, silently, with no throw. main.js:3213 encodes the split.
    const wrapper = { isPlanetMoon: false, _delegate: { orbitAngle: 1.25 }, data: plainMoon() };
    expect(wrapper.orbitAngle).toBeUndefined();
    expect(Number.isFinite(predictMoonAngle(wrapper, 0))).toBe(true);
    expect(predictMoonAngle(wrapper, 0)).toBe(1.25);
    expect(Number.isFinite(barycentreOffset(1, [wrapper], 0.016).x)).toBe(true);
  });

  it('⛔ PREDICTS the next angle without mutating it — a pre-advance doubles every moon\'s rate', () => {
    const data = plainMoon();
    const shipped = new Moon(data, { x: 1, y: 0, z: 0 });
    const wrapper = { isPlanetMoon: false, _delegate: shipped, data };
    const dt = 0.0173;
    const predicted = predictMoonAngle(wrapper, dt);
    expect(shipped.orbitAngle).toBe(data.startAngle);        // prediction mutated nothing
    shipped.updateSim(dt, { x: 0, y: 0, z: 0 }, dt);
    expect(shipped.orbitAngle).toBe(predicted);              // and it lands bit-identically
  });
});

describe('AC-SEPARATION — the body separation is untouched, the RING radii are barycentric', () => {
  it('a shipped Moon still sits exactly orbitRadius from its (moved) parent', () => {
    const data = plainMoon({ orbitRadius: 17.5 });
    const moon = new Moon(data, { x: 1, y: 0, z: 0 });
    const parent = { x: -3.25, y: 0.44, z: 8.1 };            // an offset primary
    moon.updateSim(0.02, parent, 0.02);
    const d = Math.hypot(
      moon.mesh.position.x - parent.x, moon.mesh.position.y - parent.y, moon.mesh.position.z - parent.z);
    expect(d).toBeCloseTo(17.5, 12);
  });

  it('r1 + r2 === a, and r1/r2 === the mass fraction (Convention A survives)', () => {
    const { r1, r2 } = ringRadii(25.1, 0.283 / (1 + 0.283));
    expect(r1 + r2).toBeCloseTo(25.1, 12);
    expect(r1 / 25.1).toBeCloseTo(0.283 / 1.283, 12);
    expect(r2).toBeGreaterThan(r1);
  });

  it('wd-10 planet 3 measures the geometry §9 predicted: r1 = 5.53 R_p, r2 = 19.55 R_p', () => {
    const sys = StarSystemGenerator.generate('wd-10', null);
    const entry = sys.planets[3];
    const Mp = planetMassEarth(entry.planetData);
    const moon = entry.moons[0];
    const mass = moonMassEarth(moon);
    const { r1, r2 } = ringRadii(moon.orbitRadiusScene, mass / (Mp + mass));
    const Rp = entry.planetData.radiusScene;
    expect(r1 / Rp).toBeCloseTo(5.53, 1);
    expect(r2 / Rp).toBeCloseTo(19.55, 1);
    expect((r1 + r2) / Rp).toBeCloseTo(25.1, 1);             // NOT a/(1+q) — Convention B is fatal
  });
});

describe('AC-PAIR-RINGS — the dominance branch', () => {
  it('a single-moon planet is dominated, so it earns the two barycentric rings', () => {
    const moons = [{ isPlanetMoon: false, _delegate: { orbitAngle: 0 }, data: plainMoon() }];
    const d = dominantMoon(2.0, moons);
    expect(d.share).toBe(1);
    expect(d.index).toBe(0);
    expect(d.share >= DOMINANCE_THRESHOLD).toBe(true);
  });

  it('a planet with comparable moons is NOT dominated, so its rings keep following it', () => {
    const moons = [
      { isPlanetMoon: false, _delegate: { orbitAngle: 0 }, data: plainMoon({ orbitRadius: 10 }) },
      { isPlanetMoon: false, _delegate: { orbitAngle: 1 }, data: plainMoon({ orbitRadius: 11 }) },
    ];
    expect(dominantMoon(2.0, moons).share).toBeLessThan(DOMINANCE_THRESHOLD);
  });

  it('wd-133 planet 4 (six moons) is epicyclic and must NOT get barycentric rings', () => {
    const entry = StarSystemGenerator.generate('wd-133', null).planets[4];
    const moons = entry.moons.map((m) => ({ isPlanetMoon: !!m.isPlanetMoon, _delegate: { orbitAngle: m.startAngle }, data: { ...m, orbitRadius: m.orbitRadiusScene } }));
    expect(entry.moons.length).toBe(6);
    expect(dominantMoon(planetMassEarth(entry.planetData), moons).share).toBeLessThan(DOMINANCE_THRESHOLD);
  });
});

describe('AC-NO-BODY-OFF-ITS-LINE — the ring write in main.js', () => {
  it('⛔ the ring loop no longer sources ANY centre from the raw orbital point unconditionally', () => {
    // The trap: main.js:11265-11271 positioned every moon ring from px/pz. Offsetting the
    // primary parks every ring belonging to its other moons at the empty barycentre.
    // Reverting the fix restores that write OUTSIDE any fence, so this is a source assertion
    // on the write itself — a fenced-arithmetic test would stay green and prove nothing.
    // ⛔ lastIndexOf, not indexOf: main.js:~10544 has an EARLIER loop over the same array
    // (the orbits-visible toggle). Anchoring on the first hit tests the wrong loop and passes
    // for the wrong reason — which it did, on the first run of this test.
    const block = MAIN.slice(MAIN.lastIndexOf('for (const line of entry.moonOrbitLines) {'));
    const loop = block.slice(0, block.indexOf('\n    }'));
    expect(loop).toMatch(/_baryCentred/);
    expect(loop).toMatch(/entry\.planet\.mesh\.position/);
  });

  it('the extra ring is kept out of the click-target map', () => {
    // Bounding the registration loop by moonOrbitLines.length makes the barycentric ring a
    // dead click region that highlights on hover and swallows the click (main.js:7072-7073).
    expect(MAIN).toMatch(/for \(let m = 0; m < entry\.moons\.length; m\+\+\) \{\s*\n\s*_orbitLineTargets\.set/);
  });

  it('the spawn write applies the offset too, so the hero shot is not framed on the empty point', () => {
    // main.js:7942 takes a CLONE of the planet position, and setTarget is only ever called at
    // spawn, so a per-frame-only fix leaves the opening camera on the un-offset point forever.
    expect(MAIN).toMatch(/const _spawnOffset = barycentreOffset\(_planetMass, moons, 0\)/);
    expect(MAIN).toMatch(/planet\.mesh\.position\.set\(\s*px - _spawnOffset\.x/);
  });

  it('the non-binary sun direction is computed from the moved mesh, not from px/pz', () => {
    // main.js:11223's closed form `(-px, 0, -pz)` is only equal to (star - planet) while the
    // planet sits ON its orbital point. The offset destroys that equivalence.
    expect(MAIN).not.toMatch(/_sunDir\.set\(-px, 0, -pz\)/);
  });
});

describe('AC-PAIR-RINGS — the pair composes to two circles about one empty point', () => {
  /** Compose exactly what the renderer does: offset the primary, then place each moon on it. */
  const compose = (seed, pi, dt) => {
    const entry = StarSystemGenerator.generate(seed, null).planets[pi];
    const moons = entry.moons.map((m) => ({
      isPlanetMoon: !!m.isPlanetMoon,
      _delegate: { orbitAngle: m.startAngle },
      data: { ...m, orbitRadius: m.orbitRadiusScene },
    }));
    const Mp = planetMassEarth(entry.planetData);
    const off = barycentreOffset(Mp, moons, dt);
    const primary = { x: -off.x, y: -off.y, z: -off.z };            // barycentre B at the origin
    const bodies = moons.map((m) => {
      const u = moonUnitDirection(m, predictMoonAngle(m, dt));
      const a = m.data.orbitRadius;
      return { x: primary.x + a * u.x, y: primary.y + a * u.y, z: primary.z + a * u.z };
    });
    return { entry, moons, Mp, primary, bodies, Rp: entry.planetData.radiusScene };
  };
  const mag = (v) => Math.hypot(v.x, v.y, v.z);

  it('wd-10 planet 3: both bodies hold a CONSTANT radius about the empty point, all orbit long', () => {
    const radii = [];
    for (const dt of [0, 0.31, 0.77, 1.4, 2.9, 5.5]) {
      const { primary, bodies, Rp, moons, Mp } = compose('wd-10', 3, dt);
      const mass = moonMassEarth(moons[0].data);
      const { r1, r2 } = ringRadii(moons[0].data.orbitRadius, mass / (Mp + mass));
      // The primary rides r1 and the companion rides r2 — the two-ring read Max asked for.
      expect(mag(primary)).toBeCloseTo(r1, 10);
      expect(mag(bodies[0])).toBeCloseTo(r2, 10);
      radii.push(mag(primary) / Rp);
    }
    // Constant radius = a circle, which is what makes a STATIC ring honest.
    expect(Math.max(...radii) - Math.min(...radii)).toBeLessThan(1e-9);
    expect(radii[0]).toBeCloseTo(5.53, 1);
    // ⛔ And the two bodies stay diametrically opposed about the point, which is the whole read.
    const { primary, bodies } = compose('wd-10', 3, 1.4);
    const cos = (primary.x * bodies[0].x + primary.y * bodies[0].y + primary.z * bodies[0].z)
      / (mag(primary) * mag(bodies[0]));
    expect(cos).toBeCloseTo(-1, 9);
  });

  it('an epicyclic planet is NOT a circle — which is exactly why it keeps planet-centred rings', () => {
    const radii = [0, 0.4, 1.1, 2.2, 4.0].map((dt) => mag(compose('wd-133', 4, dt).primary));
    expect(Math.max(...radii) - Math.min(...radii)).toBeGreaterThan(1e-6);
  });

  it('⛔ Sol composes finite positions for every body — it carries no massEarth at all', () => {
    const sol = generateSolarSystem();
    for (const entry of sol.planets || []) {
      const moons = (entry.moons || []).map((m) => ({
        isPlanetMoon: !!m.isPlanetMoon,
        _delegate: { orbitAngle: m.startAngle ?? 0 },
        data: { ...m, orbitRadius: m.orbitRadiusScene ?? 0 },
      }));
      const off = barycentreOffset(planetMassEarth(entry.planetData), moons, 0.5);
      for (const v of [off.x, off.y, off.z]) expect(Number.isFinite(v)).toBe(true);
    }
  });
});
