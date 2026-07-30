/**
 * PanelMover — bringing a cockpit screen to the pilot's eye, and putting it back.
 *
 * Lane F, workstream `cockpit-zoom-to-panel-2026-07-29`, AC-PIVOT-IDENTITY and
 * AC-EASE-LANDS-EXACTLY.
 *
 * Max: "a system by which the screen will move up to fill the player's view,
 * centered, so we can interact with the full menu ... let's make the system for
 * moving around these screens flexible so that it will not need to be totally
 * reworked if we update the position of the screens in the future."
 *
 * Two rulings shape everything below. It is the SCREEN that travels to the eye,
 * not the camera to the screen. And it is the WHOLE MONITOR that travels — glass
 * plus housing — which Max chose over the glass alone flying out of its bezel.
 * The support arm stays where it is; that was in the mock-up he picked.
 *
 * ── THE PIVOT, AND WHY THE REST POSE COSTS NOTHING TO REMEMBER ──────────────
 *
 * Every node in `cockpit.glb` is a flat root with its vertices already baked in
 * world space and no transform of its own — 46 of them, no translations, no
 * rotations, no parenting. That sounds like an obstacle to moving one and is
 * actually the gift that makes this whole file short:
 *
 *   pivot.position = the panel's MEASURED centre        mesh.position = -centre
 *
 * The two compose to identity, so the panel does not budge when it is rigged, and
 * "rest" is not a number anybody wrote down or has to restore — it is the identity
 * transform. Change the GLB, re-measure, and the rig reconstitutes itself around
 * the new geometry with nothing here to edit. That is Max's flexibility constraint
 * satisfied by construction rather than by anyone remembering to honour it.
 *
 * It has a second consequence worth naming, because it removes a whole class of
 * bug: the pivot sits EXACTLY at the face centre, so the face centre in pivot-local
 * space is the origin. Which means the pivot's target position simply IS the
 * target position of the panel's centre. No offset arithmetic, nothing to get
 * sign-wrong.
 *
 * ── HOW THE TARGET ORIENTATION IS BUILT ─────────────────────────────────────
 *
 * The panel must arrive square to the eye AND the right way up, and those are two
 * different requirements — a screen can be perfectly perpendicular to your gaze
 * and rotated ninety degrees. So the rest ORIENTATION is measured too, off the
 * panel's uvs (`measureQuadBasis`), not off its plane normal, for the reasons in
 * that function's header.
 *
 * Then, with the face's rest basis R and the camera's world rotation C:
 *
 *     pivot rotation = C * R⁻¹        pivot position = eye + forward * d
 *
 * because at rest the pivot has no rotation, so the face's world basis IS R, and
 * rotating the pivot by `C * R⁻¹` carries R onto C. C is the camera's own basis,
 * whose +X is the view's right, +Y the view's up and +Z back down the barrel —
 * exactly the three things a readable screen has to line up with.
 *
 * `d` is not decided here. It is solved by `panelPose.solveFillDistance` from the
 * panel's measured size and the camera's live optics.
 *
 * ── PARKED, NOT WELDED TO THE HEAD ──────────────────────────────────────────
 *
 * The target is computed from the camera at the MOMENT of the zoom and then held
 * in cockpit space. It does not follow the head afterwards. That is a taste call
 * and it is exposed as `followCamera` so the lab can flip it: the reason for the
 * default is that increment 4 adds head sway, and a panel welded to the head can
 * never show any of it, whereas a parked one gets parallax against the cockpit
 * for free. Max judges by eye; this file only makes sure both are reachable.
 *
 * ── REVERSAL ────────────────────────────────────────────────────────────────
 *
 * Dismissing mid-travel tweens from WHERE THE PANEL ACTUALLY IS, not from the far
 * end of the trip it never completed. The alternative — rebuilding the tween as
 * "from the zoom target, to rest, t = 0" — is the natural way to write it and it
 * snaps the panel forward onto the target for one frame before easing back.
 */
import { Group, Matrix4, Quaternion, Vector3 } from 'three';
import { measureQuad, measureQuadBasis } from './PanelLayout.js';
import { solveFillDistance, cubicOut, GAME_FOV_DEG } from './panelPose.js';

/** How much of the view a zoomed panel covers. A judge-by-eye knob; the lab owns it. */
export const DEFAULT_FILL = 0.85;

/**
 * Travel time in milliseconds.
 *
 * Matched to NavComputer's own drill animations (350 / 400 / 500 ms) so the panel
 * arriving and the map drilling read as one machine rather than two.
 */
export const DEFAULT_DURATION_MS = 400;

/**
 * Which other nodes travel with a panel's glass.
 *
 * A function, not a list, so "the whole monitor" stays a rule rather than four
 * hard-coded pairs — and so a cockpit that names its housings differently is a
 * config change instead of an edit here. The arm is deliberately absent: it is
 * five jointed nodes bolted to a rib, and Max's chosen mock-up left it behind.
 */
export const defaultCompanions = (nodeName) => [nodeName.replace(/^Screen_/, 'ScreenBody_')];

const _m = new Matrix4();
const _q = new Quaternion();
const _v = new Vector3();

/** A panel's world-space vertices, re-read rather than remembered. */
function worldPoints(mesh) {
  mesh.updateWorldMatrix(true, false);
  const pos = mesh.geometry.getAttribute('position');
  const out = [];
  for (let i = 0; i < pos.count; i++) {
    _v.fromBufferAttribute(pos, i).applyMatrix4(mesh.matrixWorld);
    out.push([_v.x, _v.y, _v.z]);
  }
  return out;
}

/** A panel's uvs, in the same order as its vertices. */
function uvPairs(mesh) {
  const uv = mesh.geometry.getAttribute('uv');
  if (!uv) {
    throw new Error(
      `PanelMover: ${mesh.name || 'a panel'} has no uv attribute, so there is no way ` +
      `to tell which of its edges is the top. It would arrive at the eye centred and ` +
      `possibly upside down — which looks like a rendering bug and is a missing ` +
      `attribute. The Screen_* faces are the only meshes in the cockpit with uvs; ` +
      `this one is not one of them, or it was rebuilt without them.`,
    );
  }
  const out = [];
  for (let i = 0; i < uv.count; i++) out.push([uv.getX(i), uv.getY(i)]);
  return out;
}

/**
 * Moves cockpit panels between their mounted pose and a pose at the pilot's eye.
 *
 * Built generically for every panel it is given, because reading `panel.metrics`
 * costs the same for one as for four. Which panels are actually reachable by a
 * trigger is the caller's business — Max ruled the zoom "only necessary for the
 * upper-left monitor", and that is wiring, not a property of this class.
 */
export class PanelMover {
  /**
   * @param {object} opts
   * @param {Array<{role:string, nodeName:string, mesh:object, metrics:object}>} opts.panels
   *        the records `PanelHost` already produces
   * @param {object} [opts.root] the object companions are looked up under; defaults
   *        to each mesh's own parent
   * @param {number} [opts.fill] fraction of the view a zoomed panel covers
   * @param {number} [opts.durationMs] travel time
   * @param {boolean} [opts.followCamera] recompute the target every frame
   * @param {(nodeName:string) => string[]} [opts.companions] what travels with the glass
   */
  constructor({
    panels = [],
    root = null,
    fill = DEFAULT_FILL,
    durationMs = DEFAULT_DURATION_MS,
    followCamera = false,
    companions = defaultCompanions,
  } = {}) {
    this.fill = fill;
    this.durationMs = durationMs;
    this.followCamera = followCamera;

    this._rigs = new Map();
    this._state = 'rest';
    this._role = null;
    this._t = 0;
    this._from = { position: new Vector3(), quaternion: new Quaternion() };
    this._to = { position: new Vector3(), quaternion: new Quaternion() };
    this._disposed = false;

    for (const panel of panels) this._rig(panel, root, companions);
  }

  /**
   * Wrap one panel's glass and housing in a pivot at its measured centre.
   *
   * The measurement is taken HERE, off the mesh, rather than trusted from
   * `panel.metrics` — not because the host's measurement is suspect (it is the
   * same function) but because a rig built from a stale record would place the
   * pivot somewhere the panel is not, and the panel would jump on its first zoom
   * with nothing to say why.
   * @private
   */
  _rig(panel, root, companions) {
    const { role, nodeName, mesh } = panel;
    const parent = mesh.parent;
    if (!parent) {
      throw new Error(
        `PanelMover: ${role} (${nodeName}) is not in a scene, so there is nothing to ` +
        `insert a pivot into. A detached mesh moves invisibly.`,
      );
    }

    const metrics = measureQuad(worldPoints(mesh), uvPairs(mesh));
    const basis = measureQuadBasis(worldPoints(mesh), uvPairs(mesh));

    const pivot = new Group();
    pivot.name = `PanelPivot_${role}`;
    pivot.position.set(metrics.centre.x, metrics.centre.y, metrics.centre.z);
    parent.add(pivot);
    pivot.updateMatrixWorld(true);

    // The face's rest basis as a rotation. Columns are right / up / normal, which
    // is the same column order a camera's world rotation uses, so carrying one
    // onto the other is a single multiply rather than an axis-matching exercise.
    const restRotation = new Matrix4().makeBasis(
      new Vector3(basis.right.x, basis.right.y, basis.right.z),
      new Vector3(basis.up.x, basis.up.y, basis.up.z),
      new Vector3(basis.normal.x, basis.normal.y, basis.normal.z),
    );

    const members = [mesh];
    const searchRoot = root || parent;
    for (const name of companions(nodeName)) {
      const found = searchRoot.getObjectByName ? searchRoot.getObjectByName(name) : null;
      // A missing housing is NOT an error. `cockpit-tub.glb` ships no screens at
      // all, and a cockpit could legitimately mount bare glass. Throwing here would
      // turn a valid model into a crash at the seam that exists to stay quiet.
      if (found && found !== mesh) members.push(found);
    }

    // Saved so `dispose()` can put every member back bit-exactly, rather than
    // relying on `attach()` to invert its own arithmetic without drift.
    const saved = members.map((o) => ({
      object: o,
      parent: o.parent,
      position: o.position.clone(),
      quaternion: o.quaternion.clone(),
      scale: o.scale.clone(),
    }));
    // `attach` re-parents while preserving world transform, which is what keeps
    // the panel from moving as it is rigged.
    for (const o of members) pivot.attach(o);

    this._rigs.set(role, {
      role,
      nodeName,
      mesh,
      pivot,
      parent,
      saved,
      restPosition: pivot.position.clone(),
      restQuaternion: pivot.quaternion.clone(),
      restRotationInverse: new Matrix4().copy(restRotation).invert(),
    });
  }

  /** The pivot group a role's panel hangs from, or null. */
  pivotFor(role) {
    return this._rigs.get(role)?.pivot ?? null;
  }

  /** `'rest' | 'toZoom' | 'zoomed' | 'toRest'`. */
  get state() {
    return this._state;
  }

  /** The role currently zoomed or on its way there; null once fully at rest. */
  get zoomedRole() {
    return this._state === 'rest' ? null : this._role;
  }

  /** Whether a travel is in flight. */
  get isMoving() {
    return this._state === 'toZoom' || this._state === 'toRest';
  }

  /** Progress through the current travel, 0 to 1. */
  get progress() {
    return this.isMoving ? this._t : 1;
  }

  /** Where the current travel is headed — exposed so a test need not infer it. */
  get zoomTargetPosition() {
    return this._to.position.clone();
  }

  /**
   * Solve the pose that puts this panel centred, square and full in the view.
   *
   * Everything is read live: the panel's size off its own vertices, the distance
   * off the camera's current fov and aspect. Nothing is cached from construction,
   * so a lab slider that changes the fill or a camera that changes its fov both
   * take effect on the next zoom without this class being told.
   * @private
   */
  _solveTarget(rig, camera) {
    // The uvs go in with the positions because they are what says which extent is
    // the width. Without them a portrait face arrives here transposed and
    // `solveFillDistance` places it at (u/v) of the right distance — centred,
    // square, and hanging off the edge of the view.
    const metrics = measureQuad(worldPoints(rig.mesh), uvPairs(rig.mesh));
    const { distance } = solveFillDistance({
      width: metrics.width,
      height: metrics.height,
      fovDeg: Number.isFinite(camera.fov) ? camera.fov : GAME_FOV_DEG,
      aspect: camera.aspect,
      fill: this.fill,
    });

    camera.updateMatrixWorld(true);
    const camRotation = new Matrix4().extractRotation(camera.matrixWorld);

    // The camera looks down its own -Z, so forward is the third basis column negated.
    const forward = new Vector3(0, 0, -1).applyMatrix4(camRotation).normalize();
    const eye = new Vector3().setFromMatrixPosition(camera.matrixWorld);

    const position = eye.clone().addScaledVector(forward, distance);
    // Carry the face's rest basis onto the camera's: C * R⁻¹.
    const rotation = _m.copy(camRotation).multiply(rig.restRotationInverse);
    const quaternion = new Quaternion().setFromRotationMatrix(rotation);

    return { position, quaternion };
  }

  /**
   * Bring a panel to the eye.
   *
   * Re-zooming the panel that is already zooming is a no-op rather than a restart:
   * the trigger is a click on a piece of glass, and clicking a screen that is
   * already on its way would otherwise send it back to the start of its travel.
   *
   * @param {string} role which panel
   * @param {object} camera the camera being rendered through
   */
  zoom(role, camera) {
    const rig = this._rigs.get(role);
    if (!rig) {
      throw new Error(
        `PanelMover: no panel is rigged for role ${JSON.stringify(role)}. Rigged roles: ` +
        `${[...this._rigs.keys()].join(', ') || '(none)'}. A zoom aimed at a role that ` +
        `does not exist would silently do nothing, which reads as the click not landing.`,
      );
    }
    if (!camera || !camera.matrixWorld) {
      throw new Error(
        'PanelMover.zoom: needs the camera being rendered through — the target pose is ' +
        'solved from its position, orientation, fov and aspect. Without one there is no ' +
        '"the player\'s view" to fill.',
      );
    }
    if (this._role === role && (this._state === 'toZoom' || this._state === 'zoomed')) return;

    this._role = role;
    this._to = this._solveTarget(rig, camera);
    this._camera = camera;
    this._from = {
      position: rig.pivot.position.clone(),
      quaternion: rig.pivot.quaternion.clone(),
    };
    this._t = 0;
    this._state = 'toZoom';
  }

  /**
   * Re-solve where the zoomed panel should be, and put it there at once.
   *
   * For the knobs. `fill` is a judge-by-eye question and the lab exposes it as a
   * slider; a slider whose effect only appears on the NEXT zoom is one Max has to
   * guess at and re-trigger to see, which is not a knob you can judge anything by.
   *
   * NO TWEEN, on purpose. The slider is already the animation — a 400 ms ease
   * chasing every input event lags the drag and reads as a laggy control rather
   * than a moving panel.
   *
   * A NO-OP unless the panel is fully settled. Mid-travel it would teleport a
   * screen that is still moving, and at rest there is nothing to reframe.
   *
   * @param {object} camera the camera being rendered through
   */
  reframe(camera) {
    if (this._state !== 'zoomed') return false;
    const rig = this._rigs.get(this._role);
    if (!rig || !camera || !camera.matrixWorld) return false;
    this._camera = camera;
    this._to = this._solveTarget(rig, camera);
    rig.pivot.position.copy(this._to.position);
    rig.pivot.quaternion.copy(this._to.quaternion);
    rig.pivot.updateMatrixWorld(true);
    return true;
  }

  /**
   * Send the panel back to its mount.
   *
   * From wherever it currently is — see the header. The destination is the rig's
   * remembered identity pose, which is exact, so the round trip cannot drift no
   * matter how many times it is made.
   */
  dismiss() {
    if (this._state === 'rest') return;
    const rig = this._rigs.get(this._role);
    if (!rig) { this._state = 'rest'; this._role = null; return; }

    this._from = {
      position: rig.pivot.position.clone(),
      quaternion: rig.pivot.quaternion.clone(),
    };
    this._to = {
      position: rig.restPosition.clone(),
      quaternion: rig.restQuaternion.clone(),
    };
    this._t = 0;
    this._state = 'toRest';
  }

  /**
   * Advance the travel.
   *
   * @param {number} dtMs milliseconds since the last call
   */
  update(dtMs) {
    if (this._disposed) return;
    const rig = this._rigs.get(this._role);
    if (!rig) return;

    if (this._state === 'zoomed') {
      // Head-locked mode only. Parked panels are finished and must not be touched
      // again — re-writing an unchanged transform every frame is how a pose that
      // is meant to be settled acquires drift.
      if (this.followCamera && this._camera) {
        const target = this._solveTarget(rig, this._camera);
        rig.pivot.position.copy(target.position);
        rig.pivot.quaternion.copy(target.quaternion);
        rig.pivot.updateMatrixWorld(true);
      }
      return;
    }
    if (!this.isMoving) return;

    const step = Number.isFinite(dtMs) && dtMs > 0 ? dtMs : 0;
    this._t = this.durationMs > 0 ? Math.min(1, this._t + step / this.durationMs) : 1;

    if (this._state === 'toZoom' && this.followCamera && this._camera) {
      this._to = this._solveTarget(rig, this._camera);
    }

    const e = cubicOut(this._t);
    if (this._t >= 1) {
      // Land on the endpoint itself rather than on an interpolation that happens
      // to evaluate at t = 1. Exactness here is what makes AC-REST-IS-RESTORED's
      // ten round trips return to the original measurement rather than near it.
      rig.pivot.position.copy(this._to.position);
      rig.pivot.quaternion.copy(this._to.quaternion);
    } else {
      rig.pivot.position.lerpVectors(this._from.position, this._to.position, e);
      rig.pivot.quaternion.copy(_q.slerpQuaternions(this._from.quaternion, this._to.quaternion, e));
    }
    rig.pivot.updateMatrixWorld(true);

    if (this._t >= 1) {
      if (this._state === 'toZoom') {
        this._state = 'zoomed';
      } else {
        this._state = 'rest';
        this._role = null;
        this._camera = null;
      }
    }
  }

  /**
   * Un-rig everything, leaving the cockpit exactly as it was found.
   *
   * Members are re-parented and then have their saved local transforms written
   * back verbatim, rather than being handed to `attach()` to invert its own work.
   * `attach` composes two matrices and decomposes the result, which is correct to
   * within float noise — and "within float noise" is the thing that turns into
   * visible crookedness after enough teardowns.
   */
  dispose() {
    if (this._disposed) return;
    this._disposed = true;
    for (const rig of this._rigs.values()) {
      for (const s of rig.saved) {
        if (s.parent) s.parent.add(s.object);
        else rig.pivot.remove(s.object);
        s.object.position.copy(s.position);
        s.object.quaternion.copy(s.quaternion);
        s.object.scale.copy(s.scale);
        s.object.updateMatrixWorld(true);
      }
      rig.pivot.parent?.remove(rig.pivot);
    }
    this._rigs.clear();
    this._state = 'rest';
    this._role = null;
    this._camera = null;
  }
}

export default PanelMover;
