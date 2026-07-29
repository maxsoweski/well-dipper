/**
 * PanelPicker — lane F (cockpit-zoom-to-panel-2026-07-29).
 *
 * The piece that has never existed: turning "the player is pointing there" into a
 * hit on a specific piece of glass. There are ZERO `Raycaster` usages anywhere in
 * `src/cockpit/` before this — `PanelPointerAdapter` has been fully unit-tested
 * and never once driven live, because nothing produced the intersections it
 * consumes.
 *
 * ── THE LETTERBOX IS THE TRAP, AND IT IS NOT HYPOTHETICAL ──────────────────
 *
 * The cockpit lab renders into a 16:9 viewport CENTRED INSIDE the canvas, with
 * black bars on whichever axis has slack, precisely so the fraction of Max's view
 * a panel occupies is the fraction it will occupy in the game. The reflex NDC
 * conversion —
 *
 *     x = (clientX / canvas.width) * 2 - 1
 *
 * — is measured against the wrong rectangle whenever those bars are non-zero. The
 * error is ZERO at the centre of the screen and grows toward the edges, so the
 * cursor lines up with the middle of a panel and misses its corners. On the NAV
 * panel that means the orrery responds and the level tabs, which live along the
 * bottom edge, do not. It reads as "the tab strip is broken".
 *
 * So the viewport is an explicit argument here, never inferred from the canvas,
 * and it is checked with bars on both axes and with none.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import * as THREE from 'three';
import { measureQuad } from '../PanelLayout.js';
import { PanelMover } from '../PanelMover.js';
import { PanelPicker, viewportNdc } from '../PanelPicker.js';

const HERE = dirname(fileURLToPath(import.meta.url));

/** A quad facing the eye, at a chosen distance, with uvs and a housing behind it. */
function panelAt({ name, w, h, at, yaw = 0, pitch = 0 }) {
  const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(pitch, yaw, 0, 'YXZ'));
  const centre = new THREE.Vector3(...at);
  const local = [
    [-w / 2, h / 2, 0], [w / 2, h / 2, 0], [-w / 2, -h / 2, 0], [w / 2, -h / 2, 0],
  ];
  const corners = local.map((p) =>
    new THREE.Vector3(...p).applyQuaternion(q).add(centre).toArray());
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(corners.flat(), 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 0, 1, 1, 1], 2));
  geometry.setIndex([0, 2, 1, 1, 2, 3]);
  const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial());
  mesh.name = name;
  return mesh;
}

function cockpit() {
  const root = new THREE.Group();
  // UL sits up-left of the eye, LR down-right; both angled toward the origin.
  const specs = [
    { name: 'Screen_UL', w: 0.24, h: 0.20, at: [-0.30, 0.22, -0.70], yaw: 0.38, pitch: -0.28 },
    { name: 'Screen_LR', w: 0.24, h: 0.20, at: [0.30, -0.22, -0.70], yaw: -0.38, pitch: 0.28 },
  ];
  for (const s of specs) {
    root.add(panelAt(s));
    // A housing directly BEHIND the glass. If the picker ever widens its target
    // set, this is what it starts hitting — and a housing carries no uvs, so the
    // symptom downstream is `PanelPointer`'s "the intersection carries no uv"
    // throw rather than anything that names the picker.
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(s.w * 1.2, s.h * 1.2, 0.03),
      new THREE.MeshBasicMaterial(),
    );
    body.name = s.name.replace('Screen_', 'ScreenBody_');
    body.position.set(...s.at).multiplyScalar(1.03);
    root.add(body);
  }
  root.updateMatrixWorld(true);
  return root;
}

function panelsOf(root) {
  const out = [];
  root.traverse((o) => {
    if (o.isMesh && /^Screen_/.test(o.name || '')) {
      out.push({ role: o.name.replace('Screen_', ''), nodeName: o.name, mesh: o });
    }
  });
  return out;
}

function makeCamera() {
  const cam = new THREE.PerspectiveCamera(70, 16 / 9, 0.005, 8000);
  cam.position.set(0, 0, 0);
  cam.updateMatrixWorld(true);
  return cam;
}

/** Where a world point lands, in CSS pixels, inside a given viewport. */
function screenPointOf(world, cam, viewport) {
  const ndc = world.clone().project(cam);
  return {
    x: viewport.x + ((ndc.x + 1) / 2) * viewport.width,
    y: viewport.y + ((1 - ndc.y) / 2) * viewport.height,
  };
}

/** Bars on the top and bottom, bars on the sides, and none at all. */
const VIEWPORTS = [
  { label: 'no bars', x: 0, y: 0, width: 1600, height: 900 },
  { label: 'horizontal bars (tall window)', x: 0, y: 190, width: 1600, height: 900 },
  { label: 'vertical bars (wide window)', x: 260, y: 0, width: 1600, height: 900 },
  { label: 'offset and scaled', x: 137, y: 61, width: 960, height: 540 },
];

describe('viewportNdc — the letterbox is measured, not assumed', () => {
  for (const vp of VIEWPORTS) {
    it(`maps the viewport centre to (0,0) — ${vp.label}`, () => {
      const n = viewportNdc(vp.x + vp.width / 2, vp.y + vp.height / 2, vp);
      expect(n.x).toBeCloseTo(0, 12);
      expect(n.y).toBeCloseTo(0, 12);
    });

    it(`maps the four corners to the unit square, y flipped — ${vp.label}`, () => {
      expect(viewportNdc(vp.x, vp.y, vp)).toMatchObject({ x: -1, y: 1 });
      expect(viewportNdc(vp.x + vp.width, vp.y, vp)).toMatchObject({ x: 1, y: 1 });
      expect(viewportNdc(vp.x, vp.y + vp.height, vp)).toMatchObject({ x: -1, y: -1 });
    });

    it(`reports a point outside the viewport as outside — ${vp.label}`, () => {
      // Inside the CANVAS but on a black bar. Clamping here would put a live
      // cursor on the letterbox; treating it as a miss is what makes a click on
      // the bar do nothing, which is what it looks like it should do.
      expect(viewportNdc(vp.x - 1, vp.y + 10, vp).inside).toBe(false);
      expect(viewportNdc(vp.x + 10, vp.y - 1, vp).inside).toBe(false);
      expect(viewportNdc(vp.x + vp.width + 1, vp.y + 10, vp).inside).toBe(false);
      expect(viewportNdc(vp.x + 10, vp.y + vp.height + 1, vp).inside).toBe(false);
      expect(viewportNdc(vp.x + 10, vp.y + 10, vp).inside).toBe(true);
    });
  }

  it('differs from the naive canvas-relative conversion whenever there are bars', () => {
    // The assertion that makes the whole argument concrete. If these agreed, the
    // explicit viewport would be ceremony.
    const vp = { x: 260, y: 0, width: 1600, height: 900 };
    const canvas = { width: 2120, height: 900 };
    const px = vp.x + vp.width * 0.9;
    const correct = viewportNdc(px, 450, vp).x;
    const naive = (px / canvas.width) * 2 - 1;
    expect(Math.abs(correct - naive)).toBeGreaterThan(0.1);
  });
});

describe('PanelPicker — hitting the right piece of glass', () => {
  for (const vp of VIEWPORTS) {
    it(`hits a panel aimed at its centre — ${vp.label}`, () => {
      const root = cockpit();
      const panels = panelsOf(root);
      const cam = makeCamera();
      const picker = new PanelPicker({ panels });

      for (const p of panels) {
        const centre = measureQuad(
          [...Array(p.mesh.geometry.getAttribute('position').count)].map((_, i) => {
            const v = new THREE.Vector3()
              .fromBufferAttribute(p.mesh.geometry.getAttribute('position'), i)
              .applyMatrix4(p.mesh.matrixWorld);
            return [v.x, v.y, v.z];
          }),
        ).centre;
        const pt = screenPointOf(new THREE.Vector3(centre.x, centre.y, centre.z), cam, vp);
        // Nudged a pixel off the exact centre: that one point lies on the quad's
        // triangulation diagonal and is a float boundary for both triangles. See
        // the sweep test below, which measures the failing set as a POINT.
        const got = picker.pick(pt.x + 1, pt.y + 1, { camera: cam, viewport: vp });
        expect(got, `${p.role} was not hit near its own centre`).toBeTruthy();
        expect(got.role).toBe(p.role);
        expect(got.hit.uv.x).toBeCloseTo(0.5, 1);
        expect(got.hit.uv.y).toBeCloseTo(0.5, 1);
      }
    });
  }

  it('returns null when the ray misses everything', () => {
    const root = cockpit();
    const cam = makeCamera();
    const picker = new PanelPicker({ panels: panelsOf(root) });
    const vp = VIEWPORTS[0];
    // Dead ahead, between the two corner panels.
    expect(picker.pick(vp.width / 2, vp.height / 2, { camera: cam, viewport: vp })).toBe(null);
  });

  it('returns null for a point on the letterbox bar without raycasting at all', () => {
    const root = cockpit();
    const cam = makeCamera();
    const picker = new PanelPicker({ panels: panelsOf(root) });
    const vp = { x: 260, y: 0, width: 1600, height: 900 };
    expect(picker.pick(10, 450, { camera: cam, viewport: vp })).toBe(null);
  });

  it('rejects a letterbox click even when a panel extends past the frustum edge', () => {
    // ⭐ THE ORIGINAL VERSION OF THIS TEST PASSED WITH THE GUARD DELETED. Any
    // point outside the viewport maps to |ndc| > 1, which is outside the frustum,
    // so with panels that sit comfortably inside the view a click on the bar
    // misses anyway and the test proved nothing. The guard only earns its place
    // when geometry extends BEYOND the frustum edge — then an unguarded pick
    // happily returns a hit for a click on a black bar. So the fixture is built
    // to do exactly that.
    const root = new THREE.Group();
    root.add(panelAt({ name: 'Screen_UL', w: 12, h: 8, at: [0, 0, -0.6] }));
    root.updateMatrixWorld(true);
    const picker = new PanelPicker({ panels: panelsOf(root) });
    const cam = makeCamera();
    const vp = { x: 260, y: 0, width: 1600, height: 900 };

    // Sanity: inside the viewport this panel is hit, so the fixture is live.
    expect(picker.pick(vp.x + 40, 450, { camera: cam, viewport: vp })).toBeTruthy();
    // And on the bar it must not be, even though the geometry is out there.
    expect(picker.pick(10, 450, { camera: cam, viewport: vp }),
      'a click on the letterbox bar reached the glass').toBe(null);
    expect(picker.pick(vp.x + vp.width + 10, 450, { camera: cam, viewport: vp })).toBe(null);
  });

  it('sees a panel the caller moved WITHOUT updating its matrices', () => {
    // The picker refreshes world matrices itself. That is currently belt and
    // braces — `PanelMover` updates the pivot — and it stops being belt and braces
    // the moment anything else moves a panel: the lab's sliders, a future
    // re-fit, main.js's wiring. Removing the refresh does not fail any test that
    // only ever moves panels through the mover, which is why this one moves a mesh
    // directly and deliberately does not update it.
    const root = cockpit();
    const panels = panelsOf(root);
    const picker = new PanelPicker({ panels });
    const cam = makeCamera();
    const vp = VIEWPORTS[0];
    const ul = panels.find((p) => p.role === 'UL');

    // Straight ahead is empty to begin with.
    expect(picker.pick(vp.width / 2 + 2, vp.height / 2 + 2, { camera: cam, viewport: vp })).toBe(null);
    // Move it in front of the eye and do NOT touch matrixWorld.
    ul.mesh.position.set(0.30, -0.22, -0.10);
    const got = picker.pick(vp.width / 2 + 2, vp.height / 2 + 2, { camera: cam, viewport: vp });
    expect(got, 'the picker used a stale world matrix').toBeTruthy();
    expect(got.role).toBe('UL');
  });

  it('is completely unaffected by anything parented UNDER a panel', () => {
    // The raycast is non-recursive, and stating that as "the decal is never
    // returned" does NOT test it — two earlier versions of this test proved that.
    //
    // First the decal was placed at local (0,0,0.05); the glass has an identity
    // transform with world-baked vertices, so that put it at WORLD (0,0,0.05),
    // at the pilot's eye and in front of nothing. Then, correctly placed, it STILL
    // did not fail: with recursion the nearest hit becomes the decal, the decal is
    // not in the panel list, and `pick` returns null — so an assertion about what
    // the returned object IS never runs. The visible symptom of recursion is not a
    // wrong hit, it is a HOLE: dead spots wherever the child covers the glass.
    //
    // So the invariant is stated as the thing that actually matters — parenting
    // something under the glass must not change what the picker returns ANYWHERE —
    // and the two sweeps are compared against each other.
    const cam = makeCamera();
    const vp = VIEWPORTS[0];
    const sweep = (picker) => {
      const out = [];
      for (let sx = 0; sx <= vp.width; sx += 10) {
        for (let sy = 0; sy <= vp.height; sy += 10) {
          const got = picker.pick(sx, sy, { camera: cam, viewport: vp });
          out.push(got ? got.role : null);
        }
      }
      return out;
    };

    const bare = cockpit();
    const barePicker = new PanelPicker({ panels: panelsOf(bare) });
    const before = sweep(barePicker);
    expect(before.filter(Boolean).length, 'the sweep hit nothing, so this proves nothing')
      .toBeGreaterThan(20);

    const withChild = cockpit();
    const panels = panelsOf(withChild);
    const ul = panels.find((p) => p.role === 'UL');
    const decal = new THREE.Mesh(
      new THREE.BoxGeometry(0.3, 0.3, 0.02),
      new THREE.MeshBasicMaterial(),
    );
    decal.name = 'Decal_UL';
    // In WORLD terms, just in front of the glass — see above.
    decal.position.set(-0.30, 0.22, -0.70).multiplyScalar(0.9);
    ul.mesh.add(decal);
    withChild.updateMatrixWorld(true);

    const after = sweep(new PanelPicker({ panels }));
    expect(after, 'a child of the glass changed what the picker returns').toEqual(before);
    expect(after.every((r) => r === null || r === 'UL' || r === 'LR')).toBe(true);
  });

  it('never hits a housing, only the glass', () => {
    const root = cockpit();
    const panels = panelsOf(root);
    const cam = makeCamera();
    const picker = new PanelPicker({ panels });
    const vp = VIEWPORTS[0];
    // Sweep the whole viewport. Every hit must be a Screen_*; a ScreenBody_* has
    // no uvs and would throw one layer downstream, naming the wrong module.
    let hits = 0;
    for (let sx = 0; sx <= vp.width; sx += 20) {
      for (let sy = 0; sy <= vp.height; sy += 20) {
        const got = picker.pick(sx, sy, { camera: cam, viewport: vp });
        if (!got) continue;
        hits += 1;
        expect(got.nodeName).toMatch(/^Screen_/);
        expect(got.hit.uv, 'a hit with no uv reached the caller').toBeTruthy();
      }
    }
    expect(hits, 'the sweep hit nothing at all, so this proves nothing').toBeGreaterThan(10);
  });

  it('picks the NEAREST panel when one is in front of another', () => {
    // Exactly what a zoom produces: the zoomed panel sits between the eye and the
    // panel it used to be next to. Picking the far one would send the click to a
    // screen the player cannot even see.
    const root = new THREE.Group();
    root.add(panelAt({ name: 'Screen_UL', w: 0.30, h: 0.24, at: [0, 0, -0.40] }));
    root.add(panelAt({ name: 'Screen_LR', w: 0.90, h: 0.72, at: [0, 0, -1.20] }));
    root.updateMatrixWorld(true);

    const picker = new PanelPicker({ panels: panelsOf(root) });
    const cam = makeCamera();
    const vp = VIEWPORTS[0];
    const got = picker.pick(vp.width / 2 + 2, vp.height / 2 + 2, { camera: cam, viewport: vp });
    expect(got.role, 'the picker went through the near panel to the far one').toBe('UL');
  });

  it('follows a panel that the mover has zoomed', () => {
    // The picker must read live world transforms, not a snapshot taken at
    // construction. A picker that cached geometry would keep hitting the panel's
    // OLD corner position — so the zoomed screen filling the view would be
    // unclickable while a patch of empty space still responded.
    const root = cockpit();
    const panels = panelsOf(root);
    const cam = makeCamera();
    const picker = new PanelPicker({ panels });
    const vp = VIEWPORTS[0];
    // Deliberately NOT the exact centre — see the sweep test below for why that
    // single point is a float boundary between the quad's two triangles.
    const AIM = { x: vp.width / 2 + 2, y: vp.height / 2 + 2 };

    const beforeCentre = picker.pick(AIM.x, AIM.y, { camera: cam, viewport: vp });
    expect(beforeCentre, 'nothing should be dead ahead before the zoom').toBe(null);

    const mover = new PanelMover({ panels, root, fill: 0.85 });
    mover.zoom('UL', cam);
    for (let i = 0; i < 200 && mover.isMoving; i++) mover.update(8);

    const after = picker.pick(AIM.x, AIM.y, { camera: cam, viewport: vp });
    expect(after, 'the zoomed panel is not pickable where it now is').toBeTruthy();
    expect(after.role).toBe('UL');
    expect(after.hit.uv.x).toBeCloseTo(0.5, 2);
    expect(after.hit.uv.y).toBeCloseTo(0.5, 2);
    mover.dispose();
  });

  it('is pickable across its WHOLE face once zoomed, with no dead region', () => {
    // ⭐ WHY THIS TEST EXISTS. The test above originally aimed at the exact
    // viewport centre and failed — and the cause was not the picker. A screen quad
    // is two triangles, and the diagonal between them runs corner to corner
    // THROUGH the centre of the face. A ray aimed at exactly that point is a
    // boundary case for both triangles and float can reject it from both.
    //
    // That is only tolerable if the failing set is a POINT and not a LINE: a dead
    // seam down the middle of every panel would be a real bug, and one that would
    // present as "clicks near the middle sometimes do nothing". So it is measured
    // rather than reasoned about. Swept at 1px over a 1600x900 viewport: 701,501
    // pixels hit the zoomed panel, and integer versus half-pixel sampling differ
    // by 3 out of those 701,501. The exact centre misses; centre + 0.5px hits.
    //
    // A point, not a line. No mitigation in the picker — nudging the ray would
    // trade a measure-zero miss for a systematic uv error on every real click.
    const root = cockpit();
    const panels = panelsOf(root);
    const cam = makeCamera();
    const picker = new PanelPicker({ panels });
    const vp = VIEWPORTS[0];
    const mover = new PanelMover({ panels, root, fill: 0.85 });
    mover.zoom('UL', cam);
    for (let i = 0; i < 200 && mover.isMoving; i++) mover.update(8);

    // Walk the diagonal the triangulation runs along — the only place a seam
    // could hide — plus a coarse grid over the whole face.
    let hits = 0, misses = 0;
    for (let d = -300; d <= 300; d += 1) {
      const got = picker.pick(vp.width / 2 + d, vp.height / 2 + d * (vp.height / vp.width),
        { camera: cam, viewport: vp });
      if (got) hits += 1; else misses += 1;
    }
    expect(hits, 'the diagonal sweep hit nothing').toBeGreaterThan(300);
    // Everything off the face also counts as a miss, so this is bounded generously;
    // the assertion that matters is that misses are not CONTIGUOUS through the middle.
    const centreBand = [];
    for (let d = -20; d <= 20; d += 1) {
      centreBand.push(!!picker.pick(vp.width / 2 + d + 0.5, vp.height / 2 + d * 0.5625 + 0.5,
        { camera: cam, viewport: vp }));
    }
    expect(centreBand.every(Boolean), 'there is a dead seam through the centre of the panel')
      .toBe(true);
    mover.dispose();
  });

  it('can be restricted to a subset of roles, and honours it', () => {
    // Max: "only necessary for the upper-left monitor." The mechanism is generic;
    // which panels answer a click is wiring. Restricting here rather than at the
    // call site keeps the caller from having to re-implement the filter.
    const root = cockpit();
    const panels = panelsOf(root);
    const cam = makeCamera();
    const vp = VIEWPORTS[0];
    const picker = new PanelPicker({ panels, roles: ['UL'] });
    let sawUL = false;
    for (let sx = 0; sx <= vp.width; sx += 20) {
      for (let sy = 0; sy <= vp.height; sy += 20) {
        const got = picker.pick(sx, sy, { camera: cam, viewport: vp });
        if (!got) continue;
        expect(got.role, 'a restricted picker returned a role it was not given').toBe('UL');
        sawUL = true;
      }
    }
    expect(sawUL, 'the restricted picker hit nothing, so the restriction proves nothing').toBe(true);
  });

  it('refuses to pick without a camera or a viewport, naming which', () => {
    const picker = new PanelPicker({ panels: panelsOf(cockpit()) });
    expect(() => picker.pick(1, 1, { viewport: VIEWPORTS[0] })).toThrow(/camera/i);
    expect(() => picker.pick(1, 1, { camera: makeCamera() })).toThrow(/viewport/i);
    expect(() => picker.pick(1, 1, { camera: makeCamera(), viewport: { x: 0, y: 0, width: 0, height: 9 } }))
      .toThrow(/viewport/i);
  });

  it('a picker over no panels is a legitimate no-op, not a crash', () => {
    // `cockpit-tub.glb` ships zero Screen_* nodes by design, and PanelHost binds
    // zero panels on it in silence. The picker must behave the same way.
    const picker = new PanelPicker({ panels: [] });
    expect(picker.pick(10, 10, { camera: makeCamera(), viewport: VIEWPORTS[0] })).toBe(null);
  });
});

describe('PanelPicker — the source carries no cockpit geometry', () => {
  const CODE = readFileSync(join(HERE, '..', 'PanelPicker.js'), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');

  it('names no corner and bakes no viewport', () => {
    expect(CODE).not.toMatch(/Screen_(UL|UR|LL|LR)/);
    for (const n of ['1920', '1080', '1600', '16 / 9']) {
      expect(CODE, `a literal ${n} means the picker assumes a window size`).not.toContain(n);
    }
  });
});
