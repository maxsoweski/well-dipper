/**
 * CockpitRig — the cockpit's visual assembly, as ONE thing both hosts construct.
 *
 * Increment 7, workstream `cockpit-into-helm-2026-07-30`, AC-ONE-RIG-TWO-HOSTS.
 *
 * ── WHY THIS FILE EXISTS ────────────────────────────────────────────────────
 *
 * Until 2026-07-30 every line of this lived inline in `cockpit-screens-lab.html`,
 * and `src/main.js` contained none of it — only `CockpitSnapshotProvider`, the
 * data feed. So the game could not show a cockpit at all, and the obvious way to
 * fix that (write the assembly again in main.js) would have produced two copies
 * of the same rig. This program's own worst case is two instruments that
 * disagree: it has been bitten five times, and "the lab passes where the
 * generator fails" is a named failure mode in its memory. One module, two
 * callers, is the whole point.
 *
 * ── THE BOUNDARY, AND WHY IT IS DRAWN HERE ──────────────────────────────────
 *
 * SHARED (in here): the scene, the three lights, the GLB load and its Screen_*
 * census, the glass placeholder override, the Eye_Point resolution, the panel
 * host and its four painters, the mover, the picker, the nav adapter, the
 * pointer router, and the per-frame update order.
 *
 * INJECTED (the host's): the renderer, the camera, the viewport, the buffer
 * height, the zoom knobs, and `makeNav`. Every one of these is something the two
 * hosts genuinely differ on, and every one of them would be a lie if this module
 * picked a value.
 *
 * NOT HERE, deliberately: orbit cameras, background starfields, cabin lights,
 * phosphor cycling, buffer-height cycling, seed tables, sliders, HUD readouts and
 * the ~30-method probe surface. Those are lab affordances. A module that carried
 * them would put a fake starfield in front of the real one the first time the
 * game constructed it.
 *
 * ⚠ THIS MODULE NEVER TOUCHES RENDERER STATE. No `setSize`, `setPixelRatio`,
 * `setClearColor`, `setViewport`, `setScissor`, `toneMapping` or
 * `toneMappingExposure`. The renderer is a PASS-THROUGH: it is handed to
 * `makeNav` so `NavComputer` can render the GPU galaxy image, and that is all.
 * The lab owns a renderer of its own; the game's is RetroRenderer's, shared with
 * the world pass and the palette remap, so a stray write in here would retint the
 * entire game.
 *
 * ⚠ AND IT NEVER ADVANCES `SimClock`. The lab calls `_advanceSimClock` from its
 * own tick and `src/main.js` already advances it once per sim tick; a rig that
 * also advanced it would run every nav drill at 2x in the game, with no error.
 *
 * ── THE TONE-MAPPING TRAP, which is why the two constants below are exported ──
 *
 * three r0.183 hard-forces `toneMapping = NoToneMapping` for any render that is
 * NOT going to the canvas: in `three.module.js`,
 *
 *     let toneMapping = NoToneMapping;
 *     if (material.toneMapped) {
 *       if (currentRenderTarget === null || currentRenderTarget.isXRRenderTarget === true) {
 *         toneMapping = renderer.toneMapping;
 *       }
 *     }
 *
 * The lab renders the cockpit STRAIGHT TO THE CANVAS, so its ACES curve applies.
 * The game renders it INTO A TARGET, where three drops tone mapping entirely. One
 * rig, two materially different-looking cockpits, and nothing anywhere to say so
 * — precisely the drift this file exists to prevent, arriving by a path no
 * boundary review would catch. So the tone regime is part of the RIG's contract:
 * both constants are exported, the lab applies them to its own renderer, and the
 * game applies the equivalent curve to the cockpit sample in its composite.
 * `src/main.js` already records this three behaviour near its own target setup.
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

import { PanelHost } from './PanelHost.js';
import { SCREEN_NODE_RE, DEFAULT_PANEL_ROLES } from './PanelLayout.js';
import { PanelMover, DEFAULT_FILL, DEFAULT_DURATION_MS } from './PanelMover.js';
import { PanelPicker } from './PanelPicker.js';
import { PanelPointerAdapter } from './PanelPointer.js';
import { NavSource } from './NavSource.js';
import { panelPainter } from './panelPainter.js';
import { paintDrive } from './panels/DrivePanel.js';
import { paintTarget } from './panels/TargetPanel.js';
import { paintInfo } from './panels/InfoPanel.js';
import { makeNavPainter } from './panels/NavPanel.js';
import { paintNavHoldingCard } from './panels/NavHoldingCard.js';

/** The model node that says where the pilot's head is. Found, never assumed. */
export const EYE_NODE_NAME = 'Eye_Point';

/** Where the cockpit model lives, relative to the app root. */
export const COCKPIT_GLB_URL = 'assets/cockpit/cockpit.glb';

/** The name test for the canopy glass placeholder. */
export const GLASS_NODE_RE = /glass|canopy/i;

/**
 * The eye camera's optics, exported so BOTH hosts build the same camera.
 *
 * ⚠ 70 IS NOT A ROUND NUMBER PICKED HERE — it is the game's own FOV
 * (`src/ui/Settings.js`), and it is the FOV every framing judgement Max has made
 * about this cockpit was made at. three's PerspectiveCamera defaults to 50, so a
 * host that forgot to pass one would show a cockpit subtending far more of the
 * view than he approved — and `PanelMover` re-solves the zoom fill from the
 * camera's LIVE fov on every solve, so a zoomed panel would land at a size he has
 * never seen, with nothing to say so.
 *
 * NEAR is 0.005 because a zoomed panel lands ~0.17 m from the eye.
 */
export const EYE_FOV = 70;
export const EYE_NEAR = 0.005;
export const EYE_FAR = 8000;

/**
 * The cockpit's tone regime — see the header. Exported so the two hosts cannot
 * drift; neither value is applied by this module.
 */
export const COCKPIT_TONE_MAPPING = THREE.ACESFilmicToneMapping;
export const COCKPIT_TONE_EXPOSURE = 1.25;

/**
 * The canopy glass placeholder treatment.
 *
 * Canopy_Glass is NOT real glass — screen-space refraction is a later increment —
 * and here it must not HIDE the four screens the cockpit exists to show. Faint,
 * and no depth write. ⚠ A host that skipped this gets a canopy that writes depth
 * and can occlude the panels: a first-light failure that looks plausible and
 * raises no error.
 */
export const DEFAULT_GLASS = Object.freeze({ opacity: 0.10, depthWrite: false, doubleSide: true });

/**
 * Key + fill, angled from ahead/above/port so they rake the outward-facing
 * surfaces. The inward-facing ones sit dark, which is physically correct — the
 * only light source is outside the ship — and is precisely why the CRTs being
 * their own light source is the thing to look at.
 *
 * ⚠ THESE ARE THE DIVERGENCE PROBE AC-ONE-RIG-TWO-HOSTS NAMES. Changing an
 * intensity here must move BOTH hosts; if it moves only one, the boundary is
 * wrong and the AC has failed.
 */
export const DEFAULT_COCKPIT_LIGHTS = Object.freeze([
  Object.freeze({ type: 'ambient', color: 0xaebccc, intensity: 0.16 }),
  Object.freeze({ type: 'directional', color: 0xfff2e0, intensity: 2.2, position: Object.freeze([-30, 50, -60]) }),
  Object.freeze({ type: 'directional', color: 0x6f8ab0, intensity: 0.26, position: Object.freeze([24, -8, 34]) }),
]);

/**
 * The four default painters, in `PanelHost.setPainter` form.
 *
 * NAV gets the HOLDING CARD, not the real nav computer: a nav source cannot be
 * built at module load — it needs a canvas, a GalacticMap, a renderer and the NAV
 * panel's buffer size, and that size does not exist until `PanelHost.fromRoot`
 * has bound the panels off the loaded model. The real painter replaces it in
 * `_mountNav`, registered AFTER these four rather than instead of one, so a nav
 * source that could not be built leaves NO SOURCE on the glass and a reason
 * beside it — instead of a black rectangle nobody can account for.
 */
export const DEFAULT_PANEL_PAINTERS = Object.freeze({
  NAV: panelPainter(paintNavHoldingCard),
  DRIVE: panelPainter(paintDrive),
  TARGET: panelPainter(paintTarget),
  INFO: panelPainter(paintInfo),
});

/** Which roles a press is allowed to zoom. One entry, widened by editing it. */
export const DEFAULT_ZOOMABLE_ROLES = Object.freeze(['NAV']);

function required(value, name) {
  if (value === undefined || value === null) {
    throw new Error(`CockpitRig: \`${name}\` is required — the rig cannot pick one for you, ` +
      `because the lab and the game genuinely differ on it.`);
  }
  return value;
}

/**
 * The cockpit, assembled.
 *
 * Construct with `CockpitRig.load(...)`, which NEVER REJECTS: a missing or broken
 * GLB is a legible `rig.loadError` the host can print, not a stack trace and not
 * an unhandled rejection that takes the page down. Same rule for the host and the
 * nav source — `hostError` and `navError` are strings, and the other panels stay
 * worth looking at.
 */
export class CockpitRig {
  /**
   * @param {object} opts
   * @param {string} [opts.glbUrl] where the model is
   * @param {object} opts.renderer PASS-THROUGH ONLY, handed to `makeNav`
   * @param {object} opts.camera the eye camera. Read, never written.
   * @param {() => void} opts.pinCamera makes `camera` current for THIS frame
   * @param {() => {x:number,y:number,width:number,height:number}} opts.getViewport
   *        the RENDERED rect in CSS pixels, read fresh per pick
   * @param {number} opts.bufferHeightPx the one knob PanelHost takes
   * @param {(surface:object) => object} opts.makeNav builds the NavComputer
   * @param {object} [opts.zoom] `{fill, durationMs, followCamera}`
   * @param {string[]} [opts.zoomableRoles]
   * @param {object} [opts.painters]
   * @param {object|null} [opts.glass] the placeholder override, or null to skip
   * @param {Array} [opts.lights]
   * @param {() => boolean} [opts.isLookDragging] host is mid-look-drag → no hover
   * @param {(navSource:object) => void} [opts.onNavMounted] fired once, first build
   */
  constructor(opts = {}) {
    this.opts = opts;
    this.renderer = opts.renderer ?? null;
    this.camera = required(opts.camera, 'camera');
    this._pinCamera = required(opts.pinCamera, 'pinCamera');
    this._getViewport = required(opts.getViewport, 'getViewport');
    this._makeNav = opts.makeNav ?? null;
    this._painters = opts.painters ?? DEFAULT_PANEL_PAINTERS;
    this._glass = opts.glass === undefined ? DEFAULT_GLASS : opts.glass;
    this._lights = opts.lights ?? DEFAULT_COCKPIT_LIGHTS;
    this._isLookDragging = opts.isLookDragging ?? (() => false);
    this._onNavMounted = opts.onNavMounted ?? null;

    this.bufferHeightPx = opts.bufferHeightPx ?? null;
    this.zoom = {
      fill: opts.zoom?.fill ?? DEFAULT_FILL,
      durationMs: opts.zoom?.durationMs ?? DEFAULT_DURATION_MS,
      followCamera: opts.zoom?.followCamera ?? false,
    };
    this.zoomableRoles = opts.zoomableRoles ?? DEFAULT_ZOOMABLE_ROLES;

    this.scene = new THREE.Scene();
    this.model = null;
    this.host = null;
    this.mover = null;
    this.picker = null;
    this.navSource = null;
    this.navAdapter = null;

    this.loadError = null;
    this.hostError = null;
    this.navError = null;

    this.screenNodeNames = [];
    this.glassNodes = [];
    this.glassMats = new Set();
    this.eyePos = new THREE.Vector3(0, 0, 0);
    this.eyeQuat = new THREE.Quaternion();
    this.eyeFound = false;

    this._lightObjects = [];
    this._addLights();

    this.pointer = new CockpitPointerRouter(this);
  }

  _addLights() {
    for (const spec of this._lights) {
      let light = null;
      if (spec.type === 'ambient') {
        light = new THREE.AmbientLight(spec.color, spec.intensity);
      } else if (spec.type === 'directional') {
        light = new THREE.DirectionalLight(spec.color, spec.intensity);
        if (spec.position) light.position.set(...spec.position);
      }
      if (!light) continue;
      this.scene.add(light);
      this._lightObjects.push(light);
    }
  }

  /**
   * Load the model and assemble everything over it.
   *
   * The post-load ORDER is the same one the lab ran and every step of it earns
   * its place: `scene.add(model)` and `updateMatrixWorld(true)` come before
   * `PanelHost.fromRoot`, because the host measures WORLD-SPACE vertices and a
   * model whose matrices have not been flushed measures as if it were at the
   * origin.
   *
   * @returns {Promise<CockpitRig>} always resolves; check `rig.loadError`
   */
  static load(opts = {}) {
    const rig = new CockpitRig(opts);
    const url = opts.glbUrl ?? COCKPIT_GLB_URL;
    return new Promise((resolve) => {
      new GLTFLoader().load(
        url,
        (gltf) => {
          rig.model = gltf.scene;
          rig.scene.add(rig.model);
          rig.model.updateMatrixWorld(true);
          rig._censusAndGlass();
          rig._mountEye();
          rig.remount();
          resolve(rig);
        },
        undefined,
        (err) => {
          // Handled here so GLTFLoader does not console.error — a missing GLB is
          // a legible message for the host to print, not a stack trace.
          rig.loadError = (err && (err.message || String(err))) || 'unknown load error';
          resolve(rig);
        },
      );
    });
  }

  /**
   * The Screen_* census, taken BY NAME and independently of PanelHost.
   *
   * Independence is the point: if the host binds zero panels, this is what
   * distinguishes "the model has no screens" (correct, and the tub's normal
   * state) from "the model has screens and the host failed to bind them" (a bug).
   * Conflating those two is exactly how a broken load gets read as a clean one.
   */
  _censusAndGlass() {
    this.screenNodeNames = [];
    this.glassNodes = [];
    this.glassMats = new Set();
    this.model.traverse((o) => {
      const name = o?.name || '';
      if (SCREEN_NODE_RE.test(name)) this.screenNodeNames.push(name);
      if (GLASS_NODE_RE.test(name)) this.glassNodes.push(o);
    });
    this.screenNodeNames.sort();

    if (!this._glass) return;
    for (const n of this.glassNodes) {
      n.traverse((o) => {
        if (!o.isMesh) return;
        for (const m of (Array.isArray(o.material) ? o.material : [o.material])) {
          if (m) this.glassMats.add(m);
        }
      });
    }
    for (const m of this.glassMats) {
      m.transparent = true;
      m.opacity = this._glass.opacity;
      m.depthWrite = this._glass.depthWrite;
      if (this._glass.doubleSide) m.side = THREE.DoubleSide;
      m.needsUpdate = true;
    }
  }

  /**
   * Put the eye on the model's own Eye_Point node.
   *
   * FOUND, NOT ASSUMED. Eye_Point sits at the origin in today's cockpit GLBs, so
   * hard-coding (0,0,0) would look correct right up until the cabin is re-fitted
   * and the seat moves — at which point every judgement about how the panels
   * subtend would be about the wrong viewpoint, with nothing to say so. Its world
   * QUATERNION is taken too, so a future model that faces the seat somewhere
   * other than -Z still works.
   *
   * A missing node falls back to the origin AND SAYS SO through `eyeFound`.
   * Silent fallback is the failure being avoided: the picture would look
   * plausible.
   */
  _mountEye() {
    const node = this.model.getObjectByName(EYE_NODE_NAME);
    this.eyeFound = !!node;
    if (node) {
      node.getWorldPosition(this.eyePos);
      node.getWorldQuaternion(this.eyeQuat);
    } else {
      this.eyePos.set(0, 0, 0);
      this.eyeQuat.identity();
    }
  }

  /**
   * Build (or rebuild) the panel host, the painters and the motion rig.
   *
   * ⭐ THE RIG COMES DOWN FIRST, BEFORE the host re-measures, and this is not
   * redundant with `_buildZoomRig`'s own teardown. While a panel is rigged its
   * mesh hangs off `PanelPivot_<role>` rather than off the model, and if it is
   * ZOOMED the mesh is physically at the pilot's eye. `PanelHost.fromRoot`
   * measures world-space vertices, so re-binding while that is true would freeze
   * `panel.metrics.centre` AT THE EYE — permanently, for the rest of the session,
   * with nothing to say why. Tearing down first puts every mesh back at its own
   * identity pose, which is the state the measurement is supposed to be of.
   *
   * PUBLIC because the lab's `perturbScreens` / `restoreScreens` need it: they
   * are how AC-MOTION-FOLLOWS-THE-MODEL was verified, and no GLB provides an
   * alternate cockpit, so without a remount entry point increment 6's evidence
   * becomes unreproducible.
   */
  remount() {
    if (this.mover) { this.mover.dispose(); this.mover = null; this.picker = null; }
    if (this.host) { this.host.dispose(); this.host = null; }
    this.hostError = null;
    if (!this.model) return;
    try {
      this.host = PanelHost.fromRoot(this.model, { bufferHeightPx: this.bufferHeightPx });
      for (const role of Object.keys(DEFAULT_PANEL_ROLES)) {
        if (this._painters[role]) this.host.setPainter(role, this._painters[role]);
      }
      this._buildZoomRig();
      this._mountNav();
    } catch (err) {
      this.hostError = (err && err.message) || String(err);
    }
  }

  /**
   * The mover and the picker, over whatever panels are bound now.
   *
   * Both see ALL panels, not just the zoomable one: a click has to be able to
   * land on the zoomed NAV screen and also to be recognised as NOT landing on it,
   * and a picker that could only ever return NAV would report a click on DRIVE as
   * a click on nothing. Rigging is free of side effects — the pivot sits at the
   * measured centre and the mesh carries the compensating offset, so the
   * composition is identity and nothing moves.
   */
  _buildZoomRig() {
    if (this.mover) { this.mover.dispose(); this.mover = null; }
    this.picker = null;
    if (!this.host || this.host.panels.length === 0) return;
    const panels = this.host.panels;
    this.mover = new PanelMover({
      panels,
      root: this.model,
      fill: this.zoom.fill,
      durationMs: this.zoom.durationMs,
      followCamera: this.zoom.followCamera,
    });
    this.picker = new PanelPicker({ panels });
  }

  /**
   * Build the nav computer ONCE, and put the real NAV painter on the glass.
   *
   * ⭐ ONCE, not per remount. A buffer-resolution change tears the host down and
   * rebuilds every panel; the NAV SOURCE deliberately does not follow, because
   * constructing a `NavComputer` regenerates the sector table and reloads a
   * prism's worth of stars — which would stall on every press and reset the view
   * being looked at. `NavSource.resize` is the whole of what a resolution change
   * needs, and the painter calls it from the panel's own current size on every
   * paint. The PAINTER is re-registered unconditionally, because the host it was
   * registered on has just been thrown away.
   *
   * ⚠ `makeNav` IS INJECTED AND THIS MODULE MUST NEVER CONSTRUCT A NavComputer
   * ITSELF. It is the injection point for four of increment 7's ACs: the game's
   * factory installs the autopilot-toggle, commit, sound and drill-sound
   * callbacks and hands over the real star and feature catalogues, none of which
   * the lab can do. A rig that hard-coded the construction would leave those
   * clauses hostless in a new way.
   */
  _mountNav() {
    if (!this.host || !this.host.panel('NAV')) return;
    if (!this._makeNav) return;

    if (!this.navSource && !this.navError) {
      try {
        const { canvas: navCanvas } = this.host.panel('NAV');
        this.navSource = NavSource.mount({
          width: navCanvas.width,
          height: navCanvas.height,
          makeNav: this._makeNav,
        });
        if (this._onNavMounted) this._onNavMounted(this.navSource);
      } catch (err) {
        this.navSource = null;
        this.navError = (err && err.message) || String(err);
      }
    }

    // `isZoomed` is read on EVERY paint. Zooming has to clear the chrome-less
    // intent: the level tabs, the autopilot toggle and BURN/WARP are all
    // withdrawn while bare, which is right in the corner and wrong at the eye.
    if (this.navSource) {
      this.host.setPainter('NAV', panelPainter(makeNavPainter(this.navSource, {
        isZoomed: () => this.navIsZoomed(),
      })));
    }
  }

  /**
   * Whether NAV is zoomed AT ALL — what the PAINTER asks before it draws.
   *
   * Distinct from `navZoomLanded` on purpose, and the distinction is load-bearing
   * in both directions. Which chrome the panel draws is a question about the
   * whole travel: the tabs and the autopilot toggle appear as it comes and stay
   * until it is home.
   */
  navIsZoomed() {
    return !!this.mover && this.mover.zoomedRole === 'NAV';
  }

  /**
   * Whether NAV is at the eye AND finished travelling — what ROUTING asks.
   *
   * `zoomedRole` is non-null throughout BOTH travels, so routing on
   * `navIsZoomed` forwards presses into a nav computer that is still mid-air: a
   * press 21% through a 1200 ms zoom slid 427 px under a stationary cursor before
   * the release, and NavComputer's own 25 px-squared drag rejection then threw
   * the click away. During `toRest` it is worse than lost — a click on the
   * retracting monitor could not re-zoom it and was poked into a panel the pilot
   * can no longer read.
   */
  navZoomLanded() {
    return !!this.mover && this.mover.state === 'zoomed' && this.mover.zoomedRole === 'NAV';
  }

  /**
   * Make the camera current, then hand it over.
   *
   * ⭐ THE INVARIANT IS STATED AT THIS BOUNDARY, NOT INSIDE `PanelMover`. The
   * mover is handed a camera it does not own and must not own: what makes a
   * camera current is the host's business (look state and fov here, `scHead` and
   * the shake composer in the game). A mover that re-pinned its argument would
   * have to reach back into whichever host called it. So: whoever hands the mover
   * a camera hands it a CURRENT one, and `src/cockpit/PanelMover.js` stays
   * byte-identical — which AC-MOTION-FOLLOWS-THE-MODEL requires anyway.
   *
   * Measured cost of getting this wrong: a zoom solved against a camera one frame
   * stale landed 350 px off centre and 65% larger than the fill knob asked for.
   */
  cameraNow() {
    this._pinCamera();
    return this.camera;
  }

  /**
   * What the pointer is over, or null.
   *
   * ⚠ NOT pinned first, deliberately. A pick converts a pointer position against
   * the camera the pixels under that pointer were DRAWN with, which is last
   * frame's — re-pinning here would answer a question about a frame nobody has
   * seen. The mover's need is the opposite: it solves a pose for the frame about
   * to be drawn.
   */
  pickAt(clientX, clientY) {
    if (!this.picker) return null;
    return this.picker.pick(clientX, clientY, {
      camera: this.camera,
      viewport: this._getViewport(),
    });
  }

  /**
   * The pointer adapter over the live nav computer, built on demand.
   *
   * ⚠ THE CACHE KEY IS THE TARGET **AND** THE BUFFER SIZE. The size is a SNAPSHOT
   * taken at construction — the adapter stores whatever `options.size` it was
   * handed and maps every uv through it — so an adapter cached on identity alone
   * survives a resolution change that its numbers do not. Measured: at buffer 384
   * a centre click landed on nav pixel (230.5, 192), exactly right; rebuilding
   * the host at 512 kept the SAME NavComputer, so identity still held, the cache
   * hit, and the same click kept landing on (230.5, 192) instead of (307, 256).
   * The error is the buffer ratio on both axes, zero at the top-left and growing
   * toward the bottom-right — it reads as "the cursor drifts", not as a stale
   * cache, and `clickGlass`'s uvError was 2.8e-16 on every one of those presses
   * because the PICK is exact and the ADAPTER mis-maps it afterwards.
   */
  ensureNavAdapter() {
    const nav = this.navSource && this.navSource.nav;
    const panel = this.host && this.host.panel('NAV');
    if (!nav || !panel || !panel.canvas) {
      if (this.navAdapter) { this.navAdapter.detach(); this.navAdapter = null; }
      return null;
    }
    const want = { width: panel.canvas.width, height: panel.canvas.height };
    if (this.navAdapter && this.navAdapter.target === nav) {
      let got = null;
      // `bufferSize()` throws when it has nothing to measure in. An adapter that
      // cannot say what size it is mapping through is one to rebuild, not one to
      // keep and hope about.
      try { got = this.navAdapter.bufferSize(); } catch { got = null; }
      if (got && got.width === want.width && got.height === want.height) return this.navAdapter;
    }
    if (this.navAdapter) { this.navAdapter.detach(); this.navAdapter = null; }
    this.navAdapter = new PanelPointerAdapter(nav, { size: want });
    return this.navAdapter;
  }

  /**
   * One frame.
   *
   * ⭐ THE ORDER IS THE FIX, not a style. The camera is pinned BEFORE the mover
   * solves: pinning after meant a head-locked zoom re-solved the panel's pose
   * against LAST frame's orientation and the panel trailed the head by exactly
   * one frame of yaw — a constant 40.5 px offset at 800 px/s of look, 143 px at
   * 2800, identical on every frame of a 12-frame sweep and back to 0.000 one
   * frame after the head stopped.
   *
   * ⚠ REAL MILLISECONDS for both, and neither gated on whether the host's own
   * clock is paused. A tween phased on sim time freezes when the flight scrub
   * pauses, and a screen stuck half-way to the eye reads as a hang rather than as
   * a pause. The blink phase in `host.update` makes the same argument.
   *
   * @param {object} p
   * @param {object} p.snapshot the one read-only frame all four panels read
   * @param {number} p.nowMs real time, for repaint and blink phase
   * @param {number} p.dtMs real elapsed ms, for the travel
   */
  update({ snapshot, nowMs, dtMs }) {
    this._pinCamera();
    if (this.mover) this.mover.update(Number.isFinite(dtMs) ? dtMs : 16);
    if (this.host) this.host.update(snapshot, nowMs);
  }

  /** Change the buffer resolution. Rebuilds the host; keeps the nav computer. */
  setBufferHeightPx(px) {
    this.bufferHeightPx = px;
    this.remount();
  }

  /** Re-apply the zoom knobs to the live mover without rebuilding the rig. */
  setZoom(next = {}) {
    if (Number.isFinite(next.fill)) this.zoom.fill = next.fill;
    if (Number.isFinite(next.durationMs)) this.zoom.durationMs = next.durationMs;
    if (typeof next.followCamera === 'boolean') this.zoom.followCamera = next.followCamera;
    if (!this.mover) return;
    if (Number.isFinite(next.fill)) this.mover.fill = this.zoom.fill;
    if (Number.isFinite(next.durationMs)) this.mover.durationMs = this.zoom.durationMs;
    if (typeof next.followCamera === 'boolean') this.mover.followCamera = this.zoom.followCamera;
  }

  dispose() {
    if (this.navAdapter) { this.navAdapter.detach(); this.navAdapter = null; }
    if (this.mover) { this.mover.dispose(); this.mover = null; }
    this.picker = null;
    if (this.host) { this.host.dispose(); this.host = null; }
    if (this.model) { this.scene.remove(this.model); }
    for (const l of this._lightObjects) this.scene.remove(l);
    this._lightObjects = [];
  }
}

/**
 * The pointer router — one pointer, three jobs, and the ORDER between them is the
 * whole design.
 *
 *   1. If NAV has LANDED at the eye and the pointer is on it, the nav computer
 *      gets the event. That is the point of zooming — the pilot is working the
 *      menu — and the map's own drag-to-rotate must beat look-around while they
 *      are doing it.
 *   2. Otherwise, a press on a ZOOMABLE panel zooms it.
 *   3. Otherwise, the host looks around. The router says so and does not do it.
 *
 * ⭐ THE PRESS TRUTH TABLE — all four mover states x what the ray hit.
 *
 *   state    hit NAV (the zoomable one)     other panel   nothing
 *   ───────  ────────────────────────────   ───────────   ───────
 *   rest     zoom it                        host         host
 *   toZoom   NOTHING — it is already        host         host
 *            coming; a press on a panel
 *            in flight must not restart
 *            it, dismiss it, or poke a
 *            nav computer not yet readable
 *   zoomed   forward to the nav adapter;    host         host
 *            with no adapter do NOTHING
 *            rather than swing the head
 *            behind a panel filling the
 *            view
 *   toRest   RE-ZOOM it — the pilot changed
 *            their mind mid-retraction, and
 *            zoom/dismiss both tween from
 *            the CURRENT pose, so it turns
 *            round smoothly
 *
 * ⭐ AND THE HOVER CHANNEL, which is the newest and least obvious part. Every body
 * the player clicks in the map — a planet, a moon, a star at PRISM, a galaxy
 * sector, a grid tile — is resolved by `NavComputer._handleClick` from HOVER
 * state, and that state is recomputed inside the RENDER from `_mouseX`/`_mouseY`,
 * which only `_handleMouseMove` writes. A DOM canvas receives `mousemove`
 * continuously WITH NO BUTTON DOWN; a panel receives nothing unless a router
 * forwards it. Forward only the pressed moves and a quick click resolves against
 * a stale hover and reads as empty space — while press-and-hold appears to fix
 * it, because the hold is what manufactures the missing move. Max found exactly
 * that at increment 6 UAT. `hover()` is that channel and it must not be dropped.
 */
class CockpitPointerRouter {
  constructor(rig) {
    this.rig = rig;
    this.panelDrag = false;
  }

  /**
   * @returns {'nav'|'zoom'|'none'} what the press was used for. 'none' means the
   *          host should treat it as its own (look-around, or nothing).
   */
  down(clientX, clientY) {
    const rig = this.rig;
    const got = rig.pickAt(clientX, clientY);

    if (got && got.role === 'NAV' && rig.navZoomLanded()) {
      const adapter = rig.ensureNavAdapter();
      if (!adapter) return 'none-consumed';
      this.panelDrag = true;
      adapter.pointerDown(got.hit);
      return 'nav';
    }

    if (got && rig.zoomableRoles.includes(got.role) && rig.mover) {
      const settledOrArriving = rig.mover.zoomedRole === got.role
        && (rig.mover.state === 'zoomed' || rig.mover.state === 'toZoom');
      if (!settledOrArriving) rig.mover.zoom(got.role, rig.cameraNow());
      return 'zoom';
    }

    return 'none';
  }

  /** @returns {boolean} whether the router consumed the move. */
  move(clientX, clientY) {
    const rig = this.rig;
    if (this.panelDrag) {
      const adapter = rig.ensureNavAdapter();
      // A miss while pressed is the 3D form of the cursor leaving the canvas, and
      // the adapter has always treated that as a release.
      if (adapter) adapter.pointerMove(rig.pickAt(clientX, clientY)?.hit ?? null);
      return true;
    }

    // HOVER — see the class header. Gated on landed-and-not-look-dragging for the
    // same reasons the press is: at rest NAV is chrome-less and not something the
    // pilot is working, and during a look-drag the head is turning so hover is
    // meaningless. The ROLE TEST MATTERS: a hit on a different panel must arrive
    // as a MISS, or that panel's uv gets mapped into NAV's pixel space.
    if (!this._isLookDragging() && rig.navZoomLanded()) {
      const adapter = rig.ensureNavAdapter();
      if (adapter) {
        const over = rig.pickAt(clientX, clientY);
        adapter.pointerHover(over && over.role === 'NAV' ? over.hit : null);
      }
    }
    return false;
  }

  _isLookDragging() {
    try { return !!this.rig._isLookDragging(); } catch { return false; }
  }

  /** @returns {boolean} whether the router consumed the release. */
  up(clientX, clientY) {
    const rig = this.rig;
    if (!this.panelDrag) return false;
    this.panelDrag = false;
    const adapter = rig.ensureNavAdapter();
    // This is the call that finally forwards `_handleClick` — the level tabs, the
    // SYSTEM sub-views, the autopilot toggle and BURN/WARP all hang off it.
    if (adapter) adapter.pointerUp(rig.pickAt(clientX, clientY)?.hit ?? null);
    return true;
  }

  /** Dismiss whatever is zoomed. ESC means DISMISS EVERYWHERE. */
  dismiss() {
    if (this.rig.mover) this.rig.mover.dismiss();
  }
}
