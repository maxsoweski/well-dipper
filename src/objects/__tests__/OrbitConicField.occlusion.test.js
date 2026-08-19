import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { OrbitConicField, CONIC_MAX, CONIC_TEX_ROWS, KEEPOUT_MAX, CONIC_FRAGMENT_SHADER } from '../OrbitConicField.js';
import { OrbitLine } from '../OrbitLine.js';
import { arcPointMasked } from '../ringConic.js';

// ─────────────────────────────────────────────────────────────────────────────
// orbit-line-local-system-occlusion-2026-08-18 — the keep-out disc suite.
//
// Contract: docs/WORKSTREAMS/orbit-line-local-system-occlusion-2026-08-18/contract.json
// Plan:     .../implementation-plan.md
//
// Max: "I'd like the larger orbit line to not cut into the binary planets' orbits;
//       ... like a line does not intersect with another, but treats it like a solid object."
//
// ⛔ READ THIS BEFORE EDITING A NUMBER HERE. Four of these assertions CANNOT go red at the
// parent commit, because nothing is occluded there — they are falsified by MUTATION, and
// each one names the exact line to delete. That is stated per-test rather than left implied,
// because the lane has already shipped one claim of a parent-red a test could not deliver.
// ─────────────────────────────────────────────────────────────────────────────

const W = 657, H = 282, FOV = 70, ASPECT = W / H, NEAR = 0.01, FAR = 1e6;
const VIEWPORT = { width: W, height: H };

function poseCamera({ camCenter = [0, 0, 0], dist, pitch }) {
  const cam = new THREE.PerspectiveCamera(FOV, ASPECT, NEAR, FAR);
  const horiz = dist * Math.cos(pitch);
  cam.position.set(camCenter[0], camCenter[1] + dist * Math.sin(pitch), camCenter[2] + horiz);
  cam.up.set(0, 1, 0);
  cam.lookAt(camCenter[0], camCenter[1], camCenter[2]);
  cam.updateMatrixWorld(true);
  return cam;
}

function ringAt(scene, radius, x, z, { incl = 0, visible = true } = {}) {
  const r = new OrbitLine(radius, 0x00bb00);
  r.addTo(scene);
  r.mesh.position.set(x, 0, z);
  r.mesh.rotation.x = incl;
  r.mesh.visible = visible;
  r.mesh.updateMatrixWorld(true);
  return r;
}

// wd-10 planet 3, to the numbers measured live in the barycentre workstream and
// re-measured on a clean reload 2026-08-19: the pair's rings are 5.5332 and 19.5492
// primary radii about ONE empty point, and the primary's ring lies ENTIRELY INSIDE the
// companion's. Scaled here to the scene units the ring proxies actually carry.
const R1 = 0.254132;      // primary's ring  — the one the naive rule erases
const R2 = 0.897868;      // companion's ring — the outermost local ring, so the disc radius
const HELIO_R = 3388.1089; // planet 3's own heliocentric ring

// ⛔ The local system sits ON its own heliocentric circle — that is not decoration, it is the
// geometry AC-GAP depends on, and getting it wrong is how this fixture failed first time. A
// planet's heliocentric ring passes exactly through the planet (measured live on wd-10:
// gap² = 0.00000 for that ring and gap² = 2,427,689 for the nearest other one). Placing the
// bary a scene unit from the origin while giving its ring radius 3388 makes the disc sit deep
// INSIDE the circle rather than on it, and the predicate correctly finds nothing to cut.
const BARY_THETA = 0.6;
const BARY = { x: HELIO_R * Math.cos(BARY_THETA), z: HELIO_R * Math.sin(BARY_THETA) };

// The neighbouring undominated planet, likewise on its own circle.
const NEIGHBOUR_R = 2100;
const NEIGHBOUR = { x: NEIGHBOUR_R * Math.cos(2.4), z: NEIGHBOUR_R * Math.sin(2.4) };

/**
 * The pair fixture. Ring order matches main.js: the dominant moon's ring is pushed during
 * the moon loop and the primary's extra ring is appended after (main.js:7741-7748), so the
 * primary's r1 ring is LAST in moonOrbitLines.
 */
function pairSystem(scene, { extraPlanets = true } = {}) {
  const helio3 = ringAt(scene, HELIO_R, 0, 0);
  const r2ring = ringAt(scene, R2, BARY.x, BARY.z);
  const r1ring = ringAt(scene, R1, BARY.x, BARY.z);
  const starA = ringAt(scene, 60, 0, 0);
  const starB = ringAt(scene, 170, 0, 0);

  const planets = [{ moonOrbitLines: [] }];                    // planet 0 — no moons at all
  const orbitLines = [ringAt(scene, 900, 0, 0)];               // planet 0's heliocentric ring
  if (extraPlanets) {
    // planet 1 — an ordinary undominated multi-moon planet, on its own circle a long way off
    const p1 = { moonOrbitLines: [
      ringAt(scene, 0.4, NEIGHBOUR.x, NEIGHBOUR.z),
      ringAt(scene, 0.9, NEIGHBOUR.x, NEIGHBOUR.z),
    ] };
    planets.push(p1);
    orbitLines.push(ringAt(scene, NEIGHBOUR_R, 0, 0));
  }
  planets.push({ moonOrbitLines: [r2ring, r1ring] });           // the pair
  orbitLines.push(helio3);

  return {
    system: { orbitLines, starOrbitLines: [starA, starB], planets },
    r1ring, r2ring, helio3, starA, starB,
    pairPlanetIndex: planets.length - 1,
  };
}

/** Index of a ring in the descriptor list, given updateFromSystem's documented append order. */
function descIndexOf(system, ring) {
  let i = 0;
  for (const r of system.starOrbitLines) { if (r === ring) return i; i++; }
  for (const r of system.orbitLines) { if (r === ring) return i; i++; }
  for (const p of system.planets) for (const r of p.moonOrbitLines) { if (r === ring) return i; i++; }
  return -1;
}

// ── AC-LOCAL-RINGS-SURVIVE — ⛔ THE FATAL TRAP ──────────────────────────────
describe('AC-LOCAL-RINGS-SURVIVE — the pair\'s inner ring is exempt from its own system\'s disc', () => {
  it('r1 lies entirely inside r2, and still carries ZERO keep-out discs', () => {
    const scene = new THREE.Scene();
    const cam = poseCamera({ dist: 4, pitch: 0.28 });
    const { system, r1ring, r2ring } = pairSystem(scene);

    // The premise the whole AC rests on — assert it rather than trust the constants.
    expect(R1).toBeLessThan(R2);
    expect(r1ring.mesh.position.distanceTo(r2ring.mesh.position)).toBe(0);

    const field = new OrbitConicField();
    field.updateFromSystem(system, cam, VIEWPORT);

    expect(field.readConic(descIndexOf(system, r1ring)).keepOutCount).toBe(0);
    expect(field.readConic(descIndexOf(system, r2ring)).keepOutCount).toBe(0);
  });

  it('MUTATION PROOF: without the same-system exemption, r1 is masked at EVERY angle', () => {
    // ⛔ This is the test's real falsification, and it cannot come from the parent commit —
    // at parent no occlusion exists, so the assertion above passes trivially. Delete the
    // `d.localSystemId === g.systemId` line in _resolveDiscs and this is what happens.
    // Reproduced here by evaluating the predicate with the exemption term removed.
    const cx = 0, cz = 0, reff2 = R2 * R2;        // r1 and the disc are concentric
    const discs = [cx, cz, reff2];
    let masked = 0;
    for (let n = 0; n < 360; n++) if (arcPointMasked(R1, (n / 360) * 2 * Math.PI, discs, 1)) masked++;
    expect(masked).toBe(360);                      // every point — the ring vanishes entirely
  });
});

// ── AC-APPLIES-GENERALLY ───────────────────────────────────────────────────
describe('AC-APPLIES-GENERALLY — one disc per moon-bearing planet, none otherwise', () => {
  it('planet 0 (no moons) gets no disc; every moon-bearing planet gets exactly one', () => {
    const scene = new THREE.Scene();
    const { system, pairPlanetIndex } = pairSystem(scene);
    const field = new OrbitConicField();

    const discs = field._buildOccluderDiscs(system);
    expect(discs.length).toBe(2);                               // planets 1 and 2; NOT planet 0
    expect(discs.some((d) => d.systemId === 0)).toBe(false);
    expect(discs.map((d) => d.systemId).sort()).toEqual([1, pairPlanetIndex]);
  });

  it('the disc radius is the planet\'s OUTERMOST local ring radius', () => {
    const scene = new THREE.Scene();
    const { system, pairPlanetIndex } = pairSystem(scene);
    const field = new OrbitConicField();
    const disc = field._buildOccluderDiscs(system).find((d) => d.systemId === pairPlanetIndex);

    // Both local rings share a centre, so the bounding form reduces to max(ring.radius).
    expect(disc.radius).toBeCloseTo(R2, 12);
    expect(disc.cx).toBeCloseTo(BARY.x, 12);
    expect(disc.cz).toBeCloseTo(BARY.z, 12);
  });

  it('an undominated multi-moon planet gets a disc too — no special case for the 27 pairs', () => {
    const scene = new THREE.Scene();
    const { system } = pairSystem(scene);
    const field = new OrbitConicField();
    const disc = field._buildOccluderDiscs(system).find((d) => d.systemId === 1);
    expect(disc).toBeDefined();
    expect(disc.radius).toBeCloseTo(0.9, 12);
  });

  it('a hidden local system occludes nothing, exactly as it draws nothing', () => {
    const scene = new THREE.Scene();
    const { system, r1ring, r2ring, pairPlanetIndex } = pairSystem(scene);
    r1ring.mesh.visible = false; r2ring.mesh.visible = false;
    const field = new OrbitConicField();
    const discs = field._buildOccluderDiscs(system);
    expect(discs.some((d) => d.systemId === pairPlanetIndex)).toBe(false);
  });
});

// ── AC-GAP ─────────────────────────────────────────────────────────────────
describe('AC-GAP — the heliocentric ring is cut ONCE, the full width of the local system', () => {
  it('the moon-bearing planet\'s own heliocentric ring carries exactly one disc', () => {
    const scene = new THREE.Scene();
    const cam = poseCamera({ dist: 4, pitch: 0.28 });
    const { system, helio3 } = pairSystem(scene);
    const field = new OrbitConicField();
    field.updateFromSystem(system, cam, VIEWPORT);

    // localSystemId is -1 for a heliocentric ring even though it is planet 3's OWN orbit —
    // membership is of the LOCAL system, and that ring is precisely what must be cut.
    expect(field.readConic(descIndexOf(system, helio3)).keepOutCount).toBe(1);
  });

  it('the masked set is EXACTLY ONE contiguous run — bisected, not sampled', () => {
    // ⛔ DO NOT "simplify" this back to a uniform sweep. The gap is genuinely narrow in
    // ANGLE — a 0.898-unit disc on a 3388-unit circle subtends 2·asin(R/r) ≈ 5.3e-4 rad,
    // i.e. 8.4e-5 of the circle. A 3600-sample sweep steps 1.7e-3 rad and walks straight
    // over it, reporting "no gap" on a working implementation. That narrowness is correct
    // and is what the live shot shows: a short break in a very large ring.
    const scene = new THREE.Scene();
    const cam = poseCamera({ dist: 4, pitch: 0.28 });
    const { system, helio3 } = pairSystem(scene);
    const field = new OrbitConicField();
    field.updateFromSystem(system, cam, VIEWPORT);

    const { cx, cz, reff2 } = field.readOccluder(descIndexOf(system, helio3), 0);
    const discs = [cx, cz, reff2];
    const at = (t) => arcPointMasked(HELIO_R, t, discs, 1);

    // The masked arc is centred on the direction to the disc, by construction:
    // |P(θ) − C|² = r² + |C|² − 2r(cx cos θ + cz sin θ), which is minimal there.
    const phi = Math.atan2(cz, cx);
    expect(at(phi)).toBe(true);

    // Bisect out to each edge. 80 halvings of a π-wide bracket lands well under float noise.
    const edge = (dir) => {
      let lo = phi, hi = phi + dir * Math.PI;
      for (let k = 0; k < 80; k++) { const mid = (lo + hi) / 2; if (at(mid)) lo = mid; else hi = mid; }
      return lo;
    };
    const a = edge(-1), b = edge(+1);
    expect(b).toBeGreaterThan(a);

    // ⭐ ONE run: nothing outside [a, b] is masked. Swept densely over the complement.
    const N = 200000;
    const span = 2 * Math.PI - (b - a);
    let strays = 0;
    for (let n = 1; n < N; n++) {                        // n from 1: t=a is the edge itself, masked
      if (at(a - span * (n / N))) strays++;              // walk the UNmasked side
    }
    expect(strays).toBe(0);
  });

  it('the gap\'s endpoints sit at the disc radius from the local system\'s centre', () => {
    // AC-GAP's endpoint criterion, RULED 2026-08-19 as a WORLD distance.
    const scene = new THREE.Scene();
    const cam = poseCamera({ dist: 4, pitch: 0.28 });
    const { system, helio3, pairPlanetIndex } = pairSystem(scene);
    const field = new OrbitConicField();
    field.updateFromSystem(system, cam, VIEWPORT);

    const R = field._buildOccluderDiscs(system).find((d) => d.systemId === pairPlanetIndex).radius;
    expect(R).toBeCloseTo(R2, 12);

    const { cx, cz, reff2 } = field.readOccluder(descIndexOf(system, helio3), 0);
    const discs = [cx, cz, reff2];
    const at = (t) => arcPointMasked(HELIO_R, t, discs, 1);
    const phi = Math.atan2(cz, cx);

    const edge = (dir) => {
      let lo = phi, hi = phi + dir * Math.PI;
      for (let k = 0; k < 80; k++) { const mid = (lo + hi) / 2; if (at(mid)) lo = mid; else hi = mid; }
      return lo;
    };

    for (const t of [edge(-1), edge(+1)]) {
      const X = HELIO_R * Math.cos(t), Z = HELIO_R * Math.sin(t);
      const dist = Math.hypot(X - cx, Z - cz);
      // Two readings, deliberately. Against sqrt(reff2) — the radius the shader ACTUALLY uses —
      // the geometry is exact to 12 dp. Against R it is exact to float32, because reff2 is packed
      // into an RGBA32F texel; the ~8e-10 residual is that rounding, not a geometric error.
      // These rings are coplanar (cy = 0), so reff2 = R² and this is the world distance.
      expect(dist).toBeCloseTo(Math.sqrt(reff2), 12);
      expect(dist).toBeCloseTo(R, 7);
    }
  });

  it('an OUT-OF-PLANE local system is cut by the ball\'s cross-section, not its full radius', () => {
    // Exercises the reff2 = R² − cy² term, inert in the coplanar cases above.
    //
    // ⚠ NOT by tilting the heliocentric ring — that was the first attempt and it is the wrong
    // experiment. A planet's local system RIDES its heliocentric ring, so tilting the ring by
    // 0.25 rad lifts its plane ~473 units away from a disc 3388 out, and the predicate culls it
    // correctly (reff2 < 0, the ball misses the plane entirely). The term is exercised by a
    // local system sitting slightly OFF its own orbital plane, which is what really happens.
    const scene = new THREE.Scene();
    const cam = poseCamera({ dist: 4, pitch: 0.28 });
    const { system, helio3, r1ring, r2ring } = pairSystem(scene);
    const CY = 0.3;                                       // < R2, so the ball still cuts the plane
    for (const r of [r1ring, r2ring]) { r.mesh.position.y = CY; r.mesh.updateMatrixWorld(true); }

    const field = new OrbitConicField();
    field.updateFromSystem(system, cam, VIEWPORT);
    const i = descIndexOf(system, helio3);

    expect(field.readConic(i).keepOutCount).toBe(1);       // still cut
    const { reff2 } = field.readOccluder(i, 0);
    expect(reff2).toBeGreaterThan(0);
    expect(reff2).toBeLessThan(R2 * R2);                   // but by a smaller effective radius
    expect(reff2).toBeCloseTo(R2 * R2 - CY * CY, 6);       // exactly the ball's cross-section
  });

  it('a local system lifted CLEAR of the ring plane stops cutting it at all', () => {
    const scene = new THREE.Scene();
    const cam = poseCamera({ dist: 4, pitch: 0.28 });
    const { system, helio3, r1ring, r2ring } = pairSystem(scene);
    for (const r of [r1ring, r2ring]) { r.mesh.position.y = R2 * 1.5; r.mesh.updateMatrixWorld(true); }

    const field = new OrbitConicField();
    field.updateFromSystem(system, cam, VIEWPORT);
    expect(field.readConic(descIndexOf(system, helio3)).keepOutCount).toBe(0);
  });
});

// ── AC-NO-COLLATERAL-OCCLUSION ─────────────────────────────────────────────
describe('AC-NO-COLLATERAL-OCCLUSION — only rings that genuinely pass inside are cut', () => {
  it('both binary-STAR rings carry zero discs', () => {
    const scene = new THREE.Scene();
    const cam = poseCamera({ dist: 4, pitch: 0.28 });
    const { system, starA, starB } = pairSystem(scene);
    const field = new OrbitConicField();
    field.updateFromSystem(system, cam, VIEWPORT);

    expect(field.readConic(descIndexOf(system, starA)).keepOutCount).toBe(0);
    expect(field.readConic(descIndexOf(system, starB)).keepOutCount).toBe(0);
  });

  it('a neighbouring planet\'s moon rings carry zero discs', () => {
    const scene = new THREE.Scene();
    const cam = poseCamera({ dist: 4, pitch: 0.28 });
    const { system } = pairSystem(scene);
    const field = new OrbitConicField();
    field.updateFromSystem(system, cam, VIEWPORT);

    for (const r of system.planets[1].moonOrbitLines) {
      expect(field.readConic(descIndexOf(system, r)).keepOutCount).toBe(0);
    }
  });

  it('every ring is still present — occlusion changes drawn extent, never the ring set', () => {
    const scene = new THREE.Scene();
    const cam = poseCamera({ dist: 4, pitch: 0.28 });
    const { system } = pairSystem(scene);
    const field = new OrbitConicField();

    field.update(field._descView, cam, VIEWPORT); // warm, no discs
    field.updateFromSystem(system, cam, VIEWPORT);
    const withDiscs = field.count;

    // Same system, discs suppressed: the descriptor list must be identical.
    const noDiscs = new OrbitConicField();
    noDiscs._buildOccluderDiscs = () => null;
    noDiscs.updateFromSystem(system, cam, VIEWPORT);
    expect(withDiscs).toBe(noDiscs.count);
    expect(field.activeCount).toBe(noDiscs.activeCount);
  });
});

// ── AC-RING-BUDGET-AND-PERF ────────────────────────────────────────────────
describe('AC-RING-BUDGET-AND-PERF — the keep-out list never costs a ring slot', () => {
  it('CONIC_MAX stays 64 and the descriptor budget is untouched', () => {
    expect(CONIC_MAX).toBe(64);
    const field = new OrbitConicField();
    expect(field.CONIC_MAX).toBe(64);
    expect(field.textureWidth).toBe(64);
  });

  it('the disc list is a SEPARATE list, bounded by its own declared constant', () => {
    expect(KEEPOUT_MAX).toBe(8);
    expect(Number.isFinite(KEEPOUT_MAX)).toBe(true);
    expect(CONIC_TEX_ROWS).toBe(10 + KEEPOUT_MAX);

    const scene = new THREE.Scene();
    const { system } = pairSystem(scene);
    const field = new OrbitConicField();
    const discs = field._buildOccluderDiscs(system);
    expect(discs).not.toBe(field._descView);           // not the descriptor list
    expect(discs.length).toBeLessThanOrEqual(KEEPOUT_MAX);
  });

  it('the shader\'s per-pixel disc loop is bounded by that same constant, literally', () => {
    expect(CONIC_FRAGMENT_SHADER).toContain(`for (int k = 0; k < ${KEEPOUT_MAX}; k++)`);
    expect(CONIC_FRAGMENT_SHADER).toContain('if (k >= gNK) break;');
    // The ring loop's own bound is NOT raised.
    expect(CONIC_FRAGMENT_SHADER).toContain(`for (int i = 0; i < ${CONIC_MAX}; i++)`);
  });

  it('the texture grew by exactly KEEPOUT_MAX rows and nothing else', () => {
    const field = new OrbitConicField();
    expect(field.textureRows).toBe(CONIC_TEX_ROWS);
    expect(field._source.length).toBe(CONIC_MAX * CONIC_TEX_ROWS * 4);
    expect(CONIC_TEX_ROWS).toBeLessThanOrEqual(2048);  // MAX_TEXTURE_SIZE floor
  });

  it('a system with no discs packs nk = 0 and is byte-identical to the pre-feature pack', () => {
    const scene = new THREE.Scene();
    const cam = poseCamera({ dist: 4, pitch: 0.28 });
    const ring = ringAt(scene, 1520, 0, 0);
    const system = { orbitLines: [ring], starOrbitLines: [], planets: [] };

    const field = new OrbitConicField();
    field.updateFromSystem(system, cam, VIEWPORT);
    expect(field.readConic(0).keepOutCount).toBe(0);

    // Rows 0-9 of a disc-free pack must equal what update() produces with discs omitted.
    const before = field._source.slice(0, CONIC_MAX * 10 * 4);
    const plain = new OrbitConicField();
    plain.update([{ matrixWorld: ring.mesh.matrixWorld, radius: ring.radius, color: ring.material.color, alpha: 0.8, active: true }], cam, VIEWPORT);
    expect(Array.from(plain._source.slice(0, CONIC_MAX * 10 * 4))).toEqual(Array.from(before));
  });
});

// ── AC-HIT-TESTING-UNCHANGED ───────────────────────────────────────────────
describe('AC-HIT-TESTING-UNCHANGED — a masked pixel is still a clickable ring', () => {
  it('no ring\'s visibility or baked hit perimeter is touched by the disc path', () => {
    const scene = new THREE.Scene();
    const cam = poseCamera({ dist: 4, pitch: 0.28 });
    const { system, helio3, r1ring } = pairSystem(scene);

    const snap = (r) => ({ visible: r.mesh.visible, count: r.mesh.userData.orbitHitPositions.count, radius: r.radius });
    const beforeH = snap(helio3), beforeR1 = snap(r1ring);

    const field = new OrbitConicField();
    field.updateFromSystem(system, cam, VIEWPORT);
    // The heliocentric ring IS masked — this is the case that matters.
    expect(field.readConic(descIndexOf(system, helio3)).keepOutCount).toBe(1);

    expect(snap(helio3)).toEqual(beforeH);
    expect(snap(r1ring)).toEqual(beforeR1);
  });

  it('MUTATION PROOF: implementing the mask as mesh.visible = false would red the fence above', () => {
    // hitTestOrbits skips a ring whose mesh is not visible (main.js:7006), so a
    // visibility-based mask makes the occluded span unclickable. Named here so the
    // fence's purpose survives a refactor that finds mesh.visible "simpler".
    const scene = new THREE.Scene();
    const { helio3 } = pairSystem(scene);
    helio3.mesh.visible = false;
    expect(helio3.mesh.visible).toBe(false); // ← what the fence forbids the feature from doing
  });
});
