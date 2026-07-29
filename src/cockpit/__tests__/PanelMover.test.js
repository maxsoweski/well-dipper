/**
 * PanelMover — lane F (cockpit-zoom-to-panel-2026-07-29), AC-PIVOT-IDENTITY and
 * AC-EASE-LANDS-EXACTLY.
 *
 * Max: "a system by which the screen will move up to fill the player's view,
 * centered ... let's make the system for moving around these screens flexible so
 * that it will not need to be totally reworked if we update the position of the
 * screens in the future."
 *
 * ── EVERY ASSERTION HERE IS MADE ON THE MESH, NOT ON THE MOVER ──────────────
 *
 * The mover's own idea of where it put the panel is exactly the thing that can be
 * confidently wrong, so nothing in this file asks it. Every check re-measures the
 * panel's world geometry through `measureQuad` / `measureQuadBasis` — the same
 * functions `PanelHost` uses at bind time — and reasons about THAT. A mover whose
 * internal state says "zoomed, at 0.143 m" while the vertices say otherwise fails
 * here, which is the only failure mode worth defending against: the previous
 * increment in this lane lost a day to a probe that read the INTENT rather than
 * the effective state, and a byte-equality measurement that looked like a pass
 * three times running while comparing two empty frames.
 *
 * ── WHY THE FIXTURES COME OFF THE REAL GLB, AND ALSO DO NOT ─────────────────
 *
 * Both. The real cockpit's own Screen_* vertices are used, so the shapes, the
 * tilts and the aspect are the model's actual ones rather than a convenient
 * rectangle facing down -Z. But a SECOND, deliberately different synthetic
 * cockpit is used for the same battery — different sizes, different aspect,
 * different positions, different tilts — because the whole claim of this
 * workstream is that re-fitting the screens needs no edit here, and a suite that
 * only ever sees one cockpit cannot tell a derived answer from a fitted one.
 *
 * ── THE DRIFT TEST IS THE POINT OF THE FILE ─────────────────────────────────
 *
 * Ten zoom/dismiss round trips, comparing against the ORIGINAL measurement each
 * time. A mover that restores from a cached copy of the rest pose passes a single
 * round trip; one that accumulates a rounding error per cycle also passes a single
 * round trip. Both leave the cockpit visibly crooked after a play session, and
 * neither is findable by looking at it once.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import * as THREE from 'three';
import {
  parseGLB, readAccessor, listNodes, buildParentMap, nodeWorldMatrix, transformPoint,
} from '../../../tests/helpers/glb-parse.mjs';
import { measureQuad, measureQuadBasis, SCREEN_NODE_RE } from '../PanelLayout.js';
import { solveFillDistance } from '../panelPose.js';
import { PanelMover } from '../PanelMover.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const ASSET_DIR = join(HERE, '..', '..', '..', 'public', 'assets', 'cockpit');

const FOV = 70;
const ASPECT = 16 / 9;

// ───────────────────────────────────────────────────────────────────────────
// Fixtures
// ───────────────────────────────────────────────────────────────────────────

/** Every .glb by GLOB — a rename must not silently empty this suite. */
const glbFiles = () => readdirSync(ASSET_DIR).filter((f) => f.endsWith('.glb'));

/**
 * A three.js cockpit built from a real GLB's own screen vertices AND uvs.
 *
 * The uvs are carried through because the panel's UP direction is derived from
 * them — v = 0 is the TOP edge on these faces — and without them there is no way
 * to know which way round a panel is, so a zoomed screen could arrive perfectly
 * centred and upside down.
 */
function cockpitFromGLB(file) {
  const { json, bin } = parseGLB(readFileSync(join(ASSET_DIR, file)));
  const parents = buildParentMap(json);
  const root = new THREE.Group();
  const shared = new THREE.MeshStandardMaterial({ name: 'Mat_Screen' });
  let faces = 0;

  for (const { index, name, node } of listNodes(json)) {
    if (node.mesh === undefined) continue;
    const isFace = SCREEN_NODE_RE.test(name || '');
    const isBody = /^ScreenBody_/.test(name || '');
    if (!isFace && !isBody) continue;

    const world = nodeWorldMatrix(json, index, parents);
    const prim = json.meshes[node.mesh].primitives[0];
    const pos = readAccessor(json, bin, prim.attributes.POSITION);
    const corners = [];
    for (let i = 0; i < pos.array.length; i += 3) {
      corners.push(transformPoint(world, [pos.array[i], pos.array[i + 1], pos.array[i + 2]]));
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(corners.flat(), 3));
    if (prim.attributes.TEXCOORD_0 !== undefined) {
      const uv = readAccessor(json, bin, prim.attributes.TEXCOORD_0);
      geometry.setAttribute('uv', new THREE.Float32BufferAttribute(Array.from(uv.array), 2));
    }
    if (prim.indices !== undefined) {
      geometry.setIndex(Array.from(readAccessor(json, bin, prim.indices).array));
    }
    const mesh = new THREE.Mesh(geometry, shared);
    mesh.name = name;
    root.add(mesh);
    if (isFace) faces += 1;
  }
  root.updateMatrixWorld(true);
  return { root, faces };
}

/**
 * A cockpit that is NOT the one on disk — different sizes, aspect, places, tilts.
 *
 * This is the flexibility constraint made testable at the smallest scale. Lane E
 * has already changed the panel face five times and its aspect once; a mover
 * fitted to today's cockpit would pass every test that only ever loads today's
 * cockpit.
 */
function syntheticCockpit() {
  const root = new THREE.Group();
  const specs = [
    { name: 'Screen_UL', w: 0.62, h: 0.21, at: [-0.9, 0.55, -1.4], yaw: 0.62, pitch: -0.30, roll: 0.11 },
    { name: 'Screen_UR', w: 0.31, h: 0.44, at: [1.1, 0.48, -1.2], yaw: -0.51, pitch: -0.22, roll: -0.07 },
    { name: 'Screen_LL', w: 0.18, h: 0.18, at: [-0.7, -0.62, -1.05], yaw: 0.44, pitch: 0.36, roll: 0.0 },
    { name: 'Screen_LR', w: 0.55, h: 0.30, at: [0.8, -0.58, -1.6], yaw: -0.33, pitch: 0.28, roll: 0.19 },
  ];
  for (const s of specs) {
    // Authored in a local frame, then BAKED into world coordinates with an
    // identity transform — which is exactly how cockpit.glb ships (46 flat root
    // nodes, no translations, no rotations, vertices already in world space).
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(s.pitch, s.yaw, s.roll, 'YXZ'));
    const centre = new THREE.Vector3(...s.at);
    // uv (0,0) is the TOP-LEFT of these faces, so corner order below is
    // TL, TR, BL, BR and the v values say so.
    const local = [
      [-s.w / 2, s.h / 2, 0], [s.w / 2, s.h / 2, 0],
      [-s.w / 2, -s.h / 2, 0], [s.w / 2, -s.h / 2, 0],
    ];
    const uvs = [0, 0, 1, 0, 0, 1, 1, 1];
    const corners = local.map((p) =>
      new THREE.Vector3(...p).applyQuaternion(q).add(centre).toArray());
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(corners.flat(), 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geometry.setIndex([0, 2, 1, 1, 2, 3]);
    const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial());
    mesh.name = s.name;
    root.add(mesh);

    // A housing, so "the whole monitor travels" has something to travel with.
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(s.w * 1.15, s.h * 1.15, 0.04),
      new THREE.MeshStandardMaterial(),
    );
    body.name = s.name.replace('Screen_', 'ScreenBody_');
    body.position.copy(centre);
    body.quaternion.copy(q);
    root.add(body);
  }
  root.updateMatrixWorld(true);
  return { root, faces: specs.length };
}

/**
 * Both cockpits, as FACTORIES rather than as built objects.
 *
 * Every test builds its own. A shared root would let one test's rigging leak into
 * the next — two movers over one mesh means two nested pivots, and the second
 * one's "rest pose" is the first one's zoomed pose. That failure would look like a
 * mover bug and be a fixture bug, which is the worst kind of afternoon.
 */
function cockpitFactories() {
  const out = glbFiles()
    .filter((f) => cockpitFromGLB(f).faces > 0)
    .map((f) => ({ label: `real: ${f}`, build: () => cockpitFromGLB(f) }));
  out.push({
    label: 'synthetic (deliberately unlike the shipped model)',
    build: syntheticCockpit,
  });
  return out;
}

/** A camera looking somewhere non-trivial, so nothing passes by facing down -Z. */
function makeCamera({ yaw = 0.23, pitch = -0.14 } = {}) {
  const cam = new THREE.PerspectiveCamera(FOV, ASPECT, 0.005, 8000);
  cam.rotation.order = 'YXZ';
  cam.position.set(0, 0, 0); // Eye_Point is the origin of the cockpit scene
  cam.quaternion.setFromEuler(new THREE.Euler(pitch, yaw, 0, 'YXZ'));
  cam.updateMatrixWorld(true);
  return cam;
}

/** The panel records a mover is handed — the shape `PanelHost` already produces. */
function panelsOf(root) {
  root.updateMatrixWorld(true);
  const out = [];
  root.traverse((o) => {
    if (!o.isMesh || !SCREEN_NODE_RE.test(o.name || '')) return;
    out.push({ role: o.name.replace('Screen_', ''), nodeName: o.name, mesh: o, metrics: measure(o) });
  });
  return out;
}

/** World-space measurement, re-read from the mesh every time it is called. */
function worldPoints(mesh) {
  mesh.updateWorldMatrix(true, false);
  const pos = mesh.geometry.getAttribute('position');
  const v = new THREE.Vector3();
  const out = [];
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i).applyMatrix4(mesh.matrixWorld);
    out.push([v.x, v.y, v.z]);
  }
  return out;
}

function measure(mesh) {
  return measureQuad(worldPoints(mesh));
}

function basis(mesh) {
  const uv = mesh.geometry.getAttribute('uv');
  const pairs = [];
  for (let i = 0; i < uv.count; i++) pairs.push([uv.getX(i), uv.getY(i)]);
  return measureQuadBasis(worldPoints(mesh), pairs);
}

const V = (o) => new THREE.Vector3(o.x, o.y, o.z);

/** Run a mover to completion, in small steps, returning every sample. */
function runToRest(mover, dtMs = 8, limit = 500) {
  const samples = [];
  for (let i = 0; i < limit; i++) {
    mover.update(dtMs);
    samples.push(mover.progress);
    if (!mover.isMoving) break;
  }
  return samples;
}

// ───────────────────────────────────────────────────────────────────────────

describe('PanelMover — rigging a panel does not move it', () => {
  it('finds cockpits to test against, so nothing below is vacuous', () => {
    const list = cockpitFactories();
    expect(list.length, 'no cockpit fixtures at all').toBeGreaterThan(1);
    expect(list.some((c) => c.label.startsWith('real:')), 'no real GLB was loaded').toBe(true);
  });

  for (const { label, build } of cockpitFactories()) {
    it(`leaves every panel exactly where it was — ${label}`, () => {
      const { root } = build();
      const panels = panelsOf(root);
      const before = panels.map((p) => measure(p.mesh));

      const mover = new PanelMover({ panels, root });

      panels.forEach((p, i) => {
        const after = measure(p.mesh);
        expect(after.width).toBeCloseTo(before[i].width, 12);
        expect(after.height).toBeCloseTo(before[i].height, 12);
        expect(after.aspect).toBeCloseTo(before[i].aspect, 12);
        expect(V(after.centre).distanceTo(V(before[i].centre))).toBeLessThan(1e-9);
        // Newell's normal can come back either way round depending on winding;
        // what must not change is the AXIS.
        expect(Math.abs(V(after.normal).dot(V(before[i].normal)))).toBeCloseTo(1, 9);
      });
      mover.dispose();
    });

    it(`rests at an identity pivot transform, so rest is not a remembered number — ${label}`, () => {
      const { root } = build();
      const panels = panelsOf(root);
      const mover = new PanelMover({ panels, root });
      for (const p of panels) {
        const pivot = mover.pivotFor(p.role);
        expect(pivot, `no pivot for ${p.role}`).toBeTruthy();
        // The pivot sits AT the measured centre with no rotation. The mesh under
        // it carries the compensating offset, so the composition is identity.
        expect(pivot.position.distanceTo(V(p.metrics.centre))).toBeLessThan(1e-9);
        expect(pivot.quaternion.angleTo(new THREE.Quaternion())).toBeLessThan(1e-9);
      }
      mover.dispose();
    });

    it(`takes the housing with the glass — ${label}`, () => {
      const { root } = build();
      const panels = panelsOf(root);
      const mover = new PanelMover({ panels, root });
      const role = panels[0].role;
      const bodyName = panels[0].nodeName.replace('Screen_', 'ScreenBody_');
      const body = root.getObjectByName(bodyName);
      if (!body) return; // some fixtures carry no housings; the glass test covers those

      const pivot = mover.pivotFor(role);
      expect(pivot.getObjectByName(bodyName), `${bodyName} is not under the pivot`).toBeTruthy();

      const before = new THREE.Vector3();
      body.getWorldPosition(before);
      mover.zoom(role, makeCamera());
      runToRest(mover);
      const after = new THREE.Vector3();
      body.getWorldPosition(after);
      expect(after.distanceTo(before), 'the housing stayed behind').toBeGreaterThan(0.05);
      mover.dispose();
    });

    it(`restores the original parenting on dispose — ${label}`, () => {
      const { root } = build();
      const panels = panelsOf(root);
      const parentsBefore = panels.map((p) => p.mesh.parent);
      const mover = new PanelMover({ panels, root });
      mover.dispose();
      panels.forEach((p, i) => {
        expect(p.mesh.parent).toBe(parentsBefore[i]);
        expect(p.mesh.position.length()).toBeLessThan(1e-9);
        expect(p.mesh.quaternion.angleTo(new THREE.Quaternion())).toBeLessThan(1e-9);
      });
    });
  }
});

describe('PanelMover — the zoomed panel lands where it was solved to land', () => {
  for (const { label, build } of cockpitFactories()) {
    it(`arrives centred, square to the eye, level and the right way up — ${label}`, () => {
      const { root } = build();
      const panels = panelsOf(root);
      const mover = new PanelMover({ panels, root, fill: 0.85 });
      const cam = makeCamera();
      const target = panels[0];

      mover.zoom(target.role, cam);
      runToRest(mover);
      expect(mover.isMoving).toBe(false);

      const b = basis(target.mesh);
      const m = measure(target.mesh);
      const toCam = new THREE.Matrix4().copy(cam.matrixWorld).invert();

      // Centre, in the camera's own frame: dead ahead, at the solved distance.
      const centre = V(m.centre).applyMatrix4(toCam);
      const solved = solveFillDistance({
        width: m.width, height: m.height, fovDeg: cam.fov, aspect: cam.aspect, fill: 0.85,
      });
      expect(Math.abs(centre.x), 'off-centre horizontally').toBeLessThan(1e-6);
      expect(Math.abs(centre.y), 'off-centre vertically').toBeLessThan(1e-6);
      expect(-centre.z, 'not at the solved distance').toBeCloseTo(solved.distance, 9);

      // Orientation, in the camera's frame: the face's own up is the view's up,
      // and its normal points back down the barrel. Anything else is a panel that
      // is centred and unreadable.
      const camRot = new THREE.Matrix4().extractRotation(toCam);
      const up = V(b.up).applyMatrix4(camRot);
      const normal = V(b.normal).applyMatrix4(camRot);
      expect(up.dot(new THREE.Vector3(0, 1, 0)), 'the panel is not level / is upside down')
        .toBeCloseTo(1, 6);
      expect(normal.dot(new THREE.Vector3(0, 0, 1)), 'the panel is not square to the eye')
        .toBeCloseTo(1, 6);
    });

    it(`puts uv (0,0) in the TOP-LEFT of the view, read WITHOUT measureQuadBasis — ${label}`, () => {
      // ⭐ THIS TEST EXISTS BECAUSE THE ONE ABOVE CANNOT DO ITS JOB ALONE.
      //
      // The check above reads the landed panel's orientation through
      // `measureQuadBasis` — which is the same function `PanelMover` SOLVED the
      // orientation with. So a consistent error in that function cancels itself
      // out perfectly: flip v, and the solver builds a compensating rotation, and
      // the measurement reads the flipped result back as correct. Proven, not
      // supposed — planting a v-flip, a u-mirror and a reversed normal in
      // `measureQuadBasis` left all 31 tests green.
      //
      // So this one reads the uv attribute and the position attribute directly
      // and asks the only question that cannot be answered circularly: does the
      // corner the texture calls top-left actually ARRIVE at the top left of the
      // player's view? v = 0 is the top edge and u = 0 is the pilot's left, which
      // is the same convention `PanelPointer` maps pixels with and
      // `createPanelTexture` sets flipY = false for.
      const { root } = build();
      const panels = panelsOf(root);
      const mover = new PanelMover({ panels, root, fill: 0.85 });
      const cam = makeCamera();
      const target = panels[0];

      mover.zoom(target.role, cam);
      runToRest(mover);

      const mesh = target.mesh;
      mesh.updateWorldMatrix(true, false);
      const pos = mesh.geometry.getAttribute('position');
      const uv = mesh.geometry.getAttribute('uv');
      const toCam = new THREE.Matrix4().copy(cam.matrixWorld).invert();

      let checked = 0;
      for (let i = 0; i < pos.count; i++) {
        const u = uv.getX(i);
        const v = uv.getY(i);
        const p = new THREE.Vector3().fromBufferAttribute(pos, i)
          .applyMatrix4(mesh.matrixWorld).applyMatrix4(toCam);

        expect(p.z, `corner uv(${u},${v}) is behind the camera`).toBeLessThan(0);
        // The camera looks down -Z with +X right and +Y up, so a corner at u = 0
        // must land at negative x and a corner at v = 0 at positive y.
        if (u === 0) expect(p.x, `uv u=0 is not on the LEFT`).toBeLessThan(0);
        if (u === 1) expect(p.x, `uv u=1 is not on the RIGHT`).toBeGreaterThan(0);
        if (v === 0) expect(p.y, `uv v=0 is not at the TOP`).toBeGreaterThan(0);
        if (v === 1) expect(p.y, `uv v=1 is not at the BOTTOM`).toBeLessThan(0);
        checked += 1;
      }
      expect(checked, 'the panel carries no vertices to check').toBeGreaterThanOrEqual(4);
      mover.dispose();
    });

    it(`covers the fraction it was asked for, and never overflows the view — ${label}`, () => {
      for (const fill of [0.5, 0.85, 1.0]) {
        const { root } = build();
      const panels = panelsOf(root);
        const mover = new PanelMover({ panels, root, fill });
        const cam = makeCamera();
        mover.zoom(panels[0].role, cam);
        runToRest(mover);

        const m = measure(panels[0].mesh);
        const toCam = new THREE.Matrix4().copy(cam.matrixWorld).invert();
        const d = -V(m.centre).applyMatrix4(toCam).z;
        const halfV = Math.tan((cam.fov * Math.PI) / 180 / 2);
        const cover = {
          v: (m.height / 2) / (d * halfV),
          h: (m.width / 2) / (d * halfV * cam.aspect),
        };
        expect(Math.max(cover.v, cover.h), `fill ${fill}`).toBeCloseTo(fill, 6);
        expect(cover.v).toBeLessThanOrEqual(fill + 1e-9);
        expect(cover.h).toBeLessThanOrEqual(fill + 1e-9);
        mover.dispose();
      }
    });

    it(`moves ONLY the panel it was asked to move — ${label}`, () => {
      const { root } = build();
      const panels = panelsOf(root);
      const before = panels.map((p) => measure(p.mesh));
      const mover = new PanelMover({ panels, root });
      mover.zoom(panels[0].role, makeCamera());
      runToRest(mover);

      panels.slice(1).forEach((p, i) => {
        const after = measure(p.mesh);
        expect(V(after.centre).distanceTo(V(before[i + 1].centre)), `${p.role} moved`)
          .toBeLessThan(1e-9);
      });
      expect(V(measure(panels[0].mesh).centre).distanceTo(V(before[0].centre)),
        'the zoomed panel did not move at all').toBeGreaterThan(0.05);
      mover.dispose();
    });
  }
});

describe('PanelMover — the travel lands and the return is exact', () => {
  for (const { label, build } of cockpitFactories()) {
    it(`returns to the measured rest pose, with no drift over ten round trips — ${label}`, () => {
      const { root } = build();
      const panels = panelsOf(root);
      const origin = measure(panels[0].mesh);
      const originBasis = basis(panels[0].mesh);
      const mover = new PanelMover({ panels, root });

      for (let cycle = 1; cycle <= 10; cycle++) {
        mover.zoom(panels[0].role, makeCamera({ yaw: 0.1 * cycle, pitch: -0.05 * cycle }));
        runToRest(mover);
        mover.dismiss();
        runToRest(mover);

        const back = measure(panels[0].mesh);
        const backBasis = basis(panels[0].mesh);
        // Compared against the ORIGINAL, never against the previous cycle — a
        // per-cycle comparison passes happily while the panel walks across the
        // cockpit a micron at a time.
        expect(V(back.centre).distanceTo(V(origin.centre)), `centre drifted by cycle ${cycle}`)
          .toBeLessThan(1e-9);
        expect(back.width).toBeCloseTo(origin.width, 12);
        expect(back.height).toBeCloseTo(origin.height, 12);
        expect(V(backBasis.up).dot(V(originBasis.up)), `up drifted by cycle ${cycle}`)
          .toBeCloseTo(1, 12);
        expect(V(backBasis.normal).dot(V(originBasis.normal)), `normal drifted by cycle ${cycle}`)
          .toBeCloseTo(1, 12);
      }
      expect(mover.state).toBe('rest');
      mover.dispose();
    });

    it(`approaches the target without overshooting it — ${label}`, () => {
      const cam = makeCamera();

      // Pass one: find where it lands. A separate cockpit, because two movers
      // over one mesh nest two pivots and the second one's "rest" is the first
      // one's zoomed pose.
      const first = build();
      const firstPanels = panelsOf(first.root);
      const scout = new PanelMover({ panels: firstPanels, root: first.root, durationMs: 400 });
      scout.zoom(firstPanels[0].role, cam);
      runToRest(scout);
      const target = V(measure(firstPanels[0].mesh).centre);
      scout.dispose();

      // Pass two: watch the approach against that known landing point. Monotone
      // decrease is what "no overshoot" means — a spring or a back-eased curve
      // fails here, and an overshooting panel visibly punches through the
      // pilot's face on its way to stopping.
      const { root } = build();
      const panels = panelsOf(root);
      const mover = new PanelMover({ panels, root, durationMs: 400 });
      mover.zoom(panels[0].role, cam);
      let prev = Infinity;
      for (let i = 0; i < 500; i++) {
        mover.update(8);
        const d = V(measure(panels[0].mesh).centre).distanceTo(target);
        expect(d, `overshoot at step ${i}`).toBeLessThanOrEqual(prev + 1e-12);
        prev = d;
        if (!mover.isMoving) break;
      }
      expect(prev, 'did not actually land on the target').toBeLessThan(1e-9);
      mover.dispose();
    });

    it(`does not snap when dismissed mid-travel — ${label}`, () => {
      const { root } = build();
      const panels = panelsOf(root);
      const rest = V(panels[0].metrics.centre);
      const mover = new PanelMover({ panels, root, durationMs: 400 });
      const cam = makeCamera();

      mover.zoom(panels[0].role, cam);
      for (let i = 0; i < 20; i++) mover.update(8); // ~160 ms into a 400 ms travel
      const atReversal = V(measure(panels[0].mesh).centre);
      const travel = mover.zoomTargetPosition.distanceTo(rest);
      expect(travel, 'this panel barely moves, so the test proves nothing').toBeGreaterThan(0.1);

      mover.dismiss();
      mover.update(8);
      const jump = V(measure(panels[0].mesh).centre).distanceTo(atReversal);

      // The tolerance is RELATIVE, and it has to be. At 160 ms into a cubic-out
      // the panel is still moving quickly, so any CORRECT reversal moves it a
      // couple of centimetres in the next 8 ms frame — an absolute tolerance
      // tight enough to look impressive would fail a working mover. What this
      // separates is smooth reversal from the real defect: a mover that rebuilds
      // the tween as "from the zoom target, to rest, t = 0" snaps FORWARD to the
      // target on the first frame, which is the whole remaining travel at once.
      expect(jump, 'the panel jumped on reversal').toBeLessThan(travel * 0.05);

      runToRest(mover);
      expect(V(measure(panels[0].mesh).centre).distanceTo(rest)).toBeLessThan(1e-9);
      mover.dispose();
    });

    it(`reports progress that starts at 0, ends at 1, and never runs backwards — ${label}`, () => {
      const { root } = build();
      const panels = panelsOf(root);
      const mover = new PanelMover({ panels, root, durationMs: 400 });
      mover.zoom(panels[0].role, makeCamera());
      const samples = runToRest(mover);
      expect(samples[samples.length - 1]).toBe(1);
      for (let i = 1; i < samples.length; i++) {
        expect(samples[i]).toBeGreaterThanOrEqual(samples[i - 1]);
      }
      mover.dispose();
    });
  }
});

describe('PanelMover — the state machine says what it is doing', () => {
  const build = syntheticCockpit;

  it('walks rest → toZoom → zoomed → toRest → rest', () => {
    const { root } = build();
    const panels = panelsOf(root);
    const mover = new PanelMover({ panels, root, durationMs: 400 });
    expect(mover.state).toBe('rest');
    expect(mover.zoomedRole).toBe(null);

    mover.zoom(panels[0].role, makeCamera());
    expect(mover.state).toBe('toZoom');
    expect(mover.zoomedRole).toBe(panels[0].role);
    runToRest(mover);
    expect(mover.state).toBe('zoomed');

    mover.dismiss();
    expect(mover.state).toBe('toRest');
    runToRest(mover);
    expect(mover.state).toBe('rest');
    expect(mover.zoomedRole).toBe(null);
    mover.dispose();
  });

  it('refuses to zoom a role it does not have, naming it', () => {
    const { root } = build();
    const panels = panelsOf(root);
    const mover = new PanelMover({ panels, root });
    expect(() => mover.zoom('NOPE', makeCamera())).toThrow(/NOPE/);
    mover.dispose();
  });

  it('refuses a camera it cannot solve against', () => {
    const { root } = build();
    const panels = panelsOf(root);
    const mover = new PanelMover({ panels, root });
    expect(() => mover.zoom(panels[0].role, null)).toThrow(/camera/i);
    mover.dispose();
  });

  it('ignores a second zoom of the same panel rather than restarting the travel', () => {
    const { root } = build();
    const panels = panelsOf(root);
    const mover = new PanelMover({ panels, root, durationMs: 400 });
    const cam = makeCamera();
    mover.zoom(panels[0].role, cam);
    for (let i = 0; i < 20; i++) mover.update(8);
    const mid = mover.progress;
    mover.zoom(panels[0].role, cam);
    expect(mover.progress, 'the travel restarted from zero').toBe(mid);
    mover.dispose();
  });

  it('dismisses cleanly when nothing is zoomed', () => {
    const { root } = build();
    const panels = panelsOf(root);
    const mover = new PanelMover({ panels, root });
    expect(() => mover.dismiss()).not.toThrow();
    expect(mover.state).toBe('rest');
    mover.dispose();
  });

  it('does nothing at all on update while at rest', () => {
    const { root } = build();
    const panels = panelsOf(root);
    const before = panels.map((p) => measure(p.mesh));
    const mover = new PanelMover({ panels, root });
    for (let i = 0; i < 50; i++) mover.update(16);
    panels.forEach((p, i) => {
      expect(V(measure(p.mesh).centre).distanceTo(V(before[i].centre))).toBeLessThan(1e-12);
    });
    mover.dispose();
  });
});

describe('PanelMover — the source carries no cockpit geometry', () => {
  const SOURCE = readFileSync(join(HERE, '..', 'PanelMover.js'), 'utf8');
  const CODE = SOURCE
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');

  it('holds no baked distance, size or corner', () => {
    for (const n of ['0.45', '0.240', '0.200', '0.300', '0.648', '0.800', '0.842']) {
      expect(CODE, `a literal ${n} in PanelMover.js is baked geometry`).not.toContain(n);
    }
    expect(CODE, 'a hard-coded corner id defeats the role table').not.toMatch(/Screen_(UL|UR|LL|LR)/);
  });

  it('solves the distance rather than carrying one', () => {
    expect(CODE).toMatch(/solveFillDistance/);
  });
});

describe('PanelMover.reframe — re-solving under a live slider', () => {
  const build = syntheticCockpit;

  it('re-solves the zoomed pose immediately when the fill changes', () => {
    // The lab's ZOOM FILL slider is a judge-by-eye knob, and a knob whose effect
    // only appears on the NEXT zoom is one Max has to guess at and re-trigger to
    // see. `reframe` is what makes dragging it move the panel under his eye.
    const { root } = build();
    const panels = panelsOf(root);
    const mover = new PanelMover({ panels, root, fill: 0.85 });
    const cam = makeCamera();
    mover.zoom(panels[0].role, cam);
    runToRest(mover);

    const toCam = new THREE.Matrix4().copy(cam.matrixWorld).invert();
    const distAt = () => -V(measure(panels[0].mesh).centre).applyMatrix4(toCam).z;
    const before = distAt();

    mover.fill = 0.5;
    mover.reframe(cam);
    const after = distAt();
    // A smaller fill means a smaller panel, which means further away.
    expect(after).toBeGreaterThan(before);

    const m = measure(panels[0].mesh);
    const halfV = Math.tan((cam.fov * Math.PI) / 180 / 2);
    // The BINDING axis, not the vertical one. This panel is 2.95:1 against a
    // 16:9 view, so WIDTH binds — asserting vertical coverage here read 0.301
    // against an expected 0.5 and looked like a reframe bug. It was the test
    // assuming the shape of a panel it had itself made deliberately unusual.
    const cover = Math.max(
      (m.height / 2) / (after * halfV),
      (m.width / 2) / (after * halfV * cam.aspect),
    );
    expect(cover).toBeCloseTo(0.5, 6);
    mover.dispose();
  });

  it('lands exactly, with no tween, so a drag does not lag the slider', () => {
    const { root } = build();
    const panels = panelsOf(root);
    const mover = new PanelMover({ panels, root, fill: 0.85 });
    const cam = makeCamera();
    mover.zoom(panels[0].role, cam);
    runToRest(mover);

    mover.fill = 0.6;
    mover.reframe(cam);
    expect(mover.state, 'reframe restarted the travel instead of re-solving').toBe('zoomed');
    expect(mover.isMoving).toBe(false);
    // And it is where it was put, not somewhere on the way there.
    const pivot = mover.pivotFor(panels[0].role);
    expect(pivot.position.distanceTo(mover.zoomTargetPosition)).toBeLessThan(1e-12);
    mover.dispose();
  });

  it('is a no-op when nothing is zoomed, and does not throw', () => {
    const { root } = build();
    const panels = panelsOf(root);
    const before = panels.map((p) => measure(p.mesh));
    const mover = new PanelMover({ panels, root });
    expect(() => mover.reframe(makeCamera())).not.toThrow();
    expect(mover.state).toBe('rest');
    panels.forEach((p, i) => {
      expect(V(measure(p.mesh).centre).distanceTo(V(before[i].centre))).toBeLessThan(1e-12);
    });
    mover.dispose();
  });

  it('is a no-op MID-TRAVEL, so a slider drag cannot teleport a moving panel', () => {
    const { root } = build();
    const panels = panelsOf(root);
    const mover = new PanelMover({ panels, root, durationMs: 400 });
    const cam = makeCamera();
    mover.zoom(panels[0].role, cam);
    for (let i = 0; i < 10; i++) mover.update(8);
    const mid = V(measure(panels[0].mesh).centre);
    mover.fill = 0.4;
    mover.reframe(cam);
    expect(V(measure(panels[0].mesh).centre).distanceTo(mid),
      'reframe snapped a panel that was still travelling').toBeLessThan(1e-12);
    expect(mover.state).toBe('toZoom');
    mover.dispose();
  });
});

