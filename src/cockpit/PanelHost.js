/**
 * PanelHost — the runtime that turns "there is a cockpit model in the scene"
 * into "four screens are showing live data".
 *
 * Lane F, workstream `cockpit-screen-content-2026-07-28`, AC-PANEL-HOST.
 *
 * Everything else in lane F is a pure function over plain data: CockpitSnapshot
 * copies the game's state, InfoReadout and FlightReadout turn a snapshot into
 * strings, AlertCue turns two fields into words and a blink tier, PanelLayout
 * measures a quad. None of them touch a mesh, a canvas or the clock. THIS module
 * is where those meet the actual cockpit, and it owns exactly five jobs:
 *
 *   1. bind roles to the screen nodes the loaded model actually has,
 *   2. measure each face off its own vertices,
 *   3. make a drawing buffer whose SHAPE comes from that measurement,
 *   4. wire that buffer to the glass as a texture — and to nothing else,
 *   5. decide how often to repaint.
 *
 * It draws nothing itself. What a panel SAYS is a painter, handed in with
 * `setPainter(role, fn)`, so the host can be tested without a font, a palette or
 * a renderer, and so the four panels' content can be built and replaced one at a
 * time without touching this file.
 *
 * ── 1. THE BUFFER HAS ONE KNOB AND THE REST IS DERIVED ──────────────────────
 *
 * The caller supplies a TARGET HEIGHT IN PIXELS. The width is then
 * `round(height * metrics.aspect)`, where the aspect was measured off the mesh.
 * Never the other way round, and never two independent numbers.
 *
 * Two independent numbers is precisely how the screens got stretched before: the
 * display face has been re-proportioned five times as the cabin was re-fitted
 * (its aspect has been 3:2 and is 6:5 today), so any buffer whose shape is
 * written down rather than measured is drawing a 6:5 face with 3:2 pixels. The
 * picture does not error — it is simply squashed, on every screen, forever.
 * Deriving width from height plus the measured aspect makes that unrepresentable.
 *
 * WHY 512 IS THE DEFAULT HEIGHT, so the next person can move it knowingly:
 * the screens subtend about 17 degrees of a 70-degree vertical field of view. On
 * a 1080-tall display that is roughly 15 screen pixels per degree, so a panel
 * occupies about 260 SCREEN pixels top to bottom. A 512-tall buffer is therefore
 * about 2x supersampled — enough that the panel's edges and its type stay clean
 * under the perspective minification, with headroom for a pilot who leans in.
 * Going higher buys nothing visible: `renderer.setPixelRatio(1)` caps the ceiling
 * anyway, and each doubling quadruples both the rasterising cost and the
 * per-repaint texture upload, four times over because there are four panels.
 * Going lower is the cheap direction if the repaint ever shows up in a frame
 * budget — 384 or 256 are the obvious steps, and 256 is roughly native.
 *
 * NO PANEL DIMENSION IN METRES APPEARS ANYWHERE IN THIS FILE. Not directly, and
 * not read back out of the metrics sidecar, which is the same hard-coding one
 * indirection out and is currently stale for both models on disk. PanelLayout.js
 * says why at length; PanelLayout.test.js enforces it by scanning this directory.
 *
 * ── 2. WHY CANVAS CREATION IS INJECTED ──────────────────────────────────────
 *
 * `makeCanvas(width, height)` defaults to a real `document.createElement`, and
 * tests pass a stub. Without that seam the host could only be exercised in a
 * browser, which means the buffer maths, the role binding and the repaint tier
 * would all be verified by looking at a screenshot — i.e. not verified. The same
 * reasoning as every other injected surface in lane F: the thing that touches the
 * platform is a parameter.
 *
 * ── 3. MISSING SCREENS FAIL LOUDLY. NO SCREENS AT ALL DOES NOT. ─────────────
 *
 * Two different situations that look alike and must not be conflated:
 *
 *   - The model HAS `Screen_*` nodes but not the ones the role config names.
 *     That is a broken pairing between config and asset, and it throws, naming
 *     the missing node. `resolvePanelRoles` already does this; the host just lets
 *     it. A silent short list here means one panel is quietly never drawn, and
 *     "one of the four screens is black" has no thread to pull on.
 *   - The model has NO `Screen_*` nodes whatsoever. `cockpit-tub.glb` is exactly
 *     this today and it is a live path, not a hypothetical. Zero panels, no
 *     throw, and NOTHING on the console — a cockpit with no screens in it is a
 *     legitimate cockpit, and a warning printed once per load teaches everyone to
 *     ignore the console, which is how the real error gets missed later.
 *
 * A null `root`, by contrast, throws. That is not "a cockpit without screens", it
 * is a caller that has not loaded a cockpit.
 *
 * ── 4. THE REPAINT TIER, AND WHICH CLOCK IT RUNS ON ─────────────────────────
 *
 * Repainting four CRT textures at 60 Hz to show a number that changes once a
 * second is waste: each repaint is a rasterise plus a full texture upload, four
 * times a frame. But an alert that blinks on a 300/150 ms cycle ALIASES if it is
 * only resampled every 80 ms — the duty cycle wobbles and the blink reads as a
 * flicker fault rather than as a warning. So there are two tiers:
 *
 *   ambient    — repaint at `DEFAULT_AMBIENT_REPAINT_MS` (80 ms, 12.5 Hz).
 *   escalated  — repaint on EVERY update() while the frame carries a BLINKING
 *                alert cue.
 *
 * Note "blinking", not "any cue". `SAFE TO DROP` is `BLINK.STEADY` — a lit line
 * that does not move — so it does not escalate anything. Only `slow` and `fast`
 * do. Escalating on the mere presence of a cue would mean the panel runs at 60 Hz
 * for the entire approach to every planet, which is most of the flying.
 *
 * The tier is ONE decision for the whole host, not one per panel. Four panels
 * reading one snapshot must show one instant; staggering their repaints would let
 * the DRIVE screen show a speed from 80 ms after the TARGET screen's distance,
 * and a pilot cross-reading two panels would see numbers that never quite agree.
 *
 * WHICH CLOCK: the `nowMs` handed to `update()`, which in the game is the
 * `performance.now()` the render loop already has. Explicitly NOT `snapshot.t`.
 * `t` is the SIM clock, and CockpitSnapshot.js says why that matters: it REPEATS
 * across frames on a display above 60 Hz, and it stops entirely when the sim is
 * paused. A blink driven by `t` therefore stutters on a 120 Hz monitor and
 * FREEZES MID-CYCLE on a pause — an alarm that has stopped moving reads as no
 * alarm, which is the one thing an alert must never do. `renderDt` is the right
 * cadence but it is a DELTA, not a clock, so it would have to be integrated here
 * into a second timeline that can drift from the caller's. It is used only as a
 * fallback, when no usable `nowMs` arrives at all (note the unit change: main.js
 * computes `renderDt` in SECONDS, `(_now - _lastRenderT) / 1000`).
 *
 * ── 5. LIFECYCLE: WHAT THE GLASS DOES DURING A WARP ─────────────────────────
 *
 * During a warp the snapshot deliberately blanks its `survey` block — the dossier
 * the INFO panel draws from. `system` is never nulled in main.js, so mid-warp it
 * still points at BodyRenderers whose meshes have already left the scene, and a
 * dossier read from it describes a system that no longer exists. Read the comment
 * in CockpitSnapshot.js.
 *
 * CHOSEN: keep painting, every panel, every warp frame — and FORCE a repaint of
 * every panel on the frame `regime.warping` changes, ahead of the ambient tick.
 *
 * Why: the snapshot is already the thing that decides what is untrustworthy, and
 * it blanks exactly the block that is — `survey`, the one INFO draws — and nothing
 * else. Speed, flight mode, warp progress and the destination name are all still
 * TRUE during a warp,
 * and a warp is the moment a pilot most wants to read them. The forced repaint
 * exists because the ambient tier alone would leave the just-invalidated dossier
 * sitting on the glass for up to one ambient period — brief, but it is literally
 * the "stale numbers from the system you just left" case, so it gets closed.
 *
 * REJECTED — blank the glass for the duration: it throws away three panels'
 * worth of true readings to solve a problem that only ever affected one, and four
 * dark screens through a ten-second warp reads as a hardware fault, not as an
 * intentional state.
 * REJECTED — freeze (stop painting, keep the last image): that is the stale
 * readout in its purest form. The numbers stay crisp, legible and wrong.
 *
 * ── 6. THE TWO WIRING TRAPS ─────────────────────────────────────────────────
 *
 * (a) ALL FOUR FACES SHARE ONE MATERIAL. Measured in cockpit.glb on 2026-07-28:
 *     `Screen_UL/UR/LL/LR` all reference material index 4, `Mat_Screen`. A loader
 *     gives you ONE material instance for the four meshes, so `mesh.material.map
 *     = texture` on each in turn leaves all four screens showing whichever canvas
 *     was assigned last. Every panel therefore gets its OWN CLONE of the material,
 *     always — not "when it looks shared", because whether it is shared is a
 *     property of today's export and not a contract. `dispose()` puts the
 *     original back.
 *
 * (b) THE BEZELS ARE NOT THE GLASS. `ScreenBody_*` is the housing each face sits
 *     in (it carries `Mat_Body`, shared with other structure). The underscore in
 *     `/^Screen_/` is the whole of what separates them — a matcher of `/^Screen/`
 *     binds eight nodes and paints readouts onto the housings. Nothing outside
 *     the four bound meshes is written to, ever.
 *
 * Also: assigning `.map` to a material that had none CHANGES THE SHADER, so
 * `material.needsUpdate = true` is required. Without it three keeps the compiled
 * program that has no map sampler in it and the screen renders as if no texture
 * had been assigned — black glass, no error, nothing to search for.
 *
 * ── 7. THE PAINTER CONTRACT ─────────────────────────────────────────────────
 *
 * `fn(panel, snapshot, nowMs)`. The panel carries its own `ctx`, `canvas` and
 * measured `metrics`; the snapshot is the frame's plain data; `nowMs` is the
 * advancing clock from §4, which is what a blink must be phased on.
 *
 * THE HOST DOES NOT CLEAR THE CANVAS BEFORE CALLING THE PAINTER. A painter that
 * draws text without clearing first will overprint itself into mush — that is the
 * painter's bug to avoid, and it is worth the trade, because clearing here would
 * mean this file choosing a background colour. Phosphor's ink and its black are a
 * taste knob with several settings (the lab's [P] cycles four), so a colour
 * written down here is the same category of mistake as a size written down here.
 * A panel with NO painter is `clearRect`-ed exactly once — cleared, not filled,
 * so no colour is invented — and then left alone until it gets one.
 */

import {
  DEFAULT_PANEL_ROLES, SCREEN_NODE_RE, measureQuad, resolvePanelRoles,
} from './PanelLayout.js';
import { createPanelTexture } from './PanelPointer.js';
import { BLINK, buildAlertCue } from '../ui/AlertCue.js';

/**
 * Target height of a panel's drawing buffer, in pixels. THE knob — see §1 of the
 * header for where 512 comes from and which way to move it.
 */
export const DEFAULT_PANEL_BUFFER_HEIGHT_PX = 512;

/**
 * The ambient repaint period, in milliseconds. 80 ms is 12.5 Hz: fast enough that
 * a changing number never looks stuck to a pilot glancing across, slow enough
 * that four texture uploads a frame become four every fifth frame.
 */
export const DEFAULT_AMBIENT_REPAINT_MS = 80;

/**
 * Turn a measured face plus a target height into an integer drawing buffer.
 *
 * The aspect comes from the mesh, so this function is the only place the buffer's
 * SHAPE is decided and it cannot be decided wrongly: pass a taller target and the
 * panel gets proportionally wider, on whatever model happens to be loaded.
 *
 * Both guards throw rather than clamping. A zero or NaN here does not produce a
 * bad-looking panel, it produces a canvas the browser reports as 0 x 0 — which is
 * also the exact state PanelPointer's `readSize` calls out, because every pointer
 * coordinate derived from it comes back Infinity. Silently substituting a
 * plausible number would hide which of the two inputs was broken.
 *
 * @param {{aspect:number}} metrics from `measureQuad` — only `aspect` is read
 * @param {number} [heightPx] target buffer height
 * @returns {{width:number, height:number}} integers, both >= 1
 */
export function derivePanelBuffer(metrics, heightPx = DEFAULT_PANEL_BUFFER_HEIGHT_PX) {
  const aspect = metrics && metrics.aspect;
  if (!Number.isFinite(aspect) || aspect <= 0) {
    throw new Error(
      `derivePanelBuffer: needs a measured aspect, got ${aspect}. The buffer's shape ` +
      `is derived from the face's own vertices — a missing aspect means the panel was ` +
      `never measured, and any width chosen here would be a guess baked into a texture.`,
    );
  }
  if (!Number.isFinite(heightPx) || heightPx < 1) {
    throw new Error(
      `derivePanelBuffer: buffer height must be a positive number of pixels, got ${heightPx}.`,
    );
  }
  const height = Math.round(heightPx);
  // The one line this module exists for. Width FROM height and the MEASURED
  // aspect; a second independent number here is how a 6:5 face gets drawn 3:2.
  const width = Math.max(1, Math.round(height * aspect));
  return { width, height };
}

/**
 * Does this frame carry an alert that BLINKS?
 *
 * Exported because it is the tier's whole rule and deserves to be testable on its
 * own — in particular the negative case, that a STEADY cue does not escalate.
 *
 * An unrecognised `dropState` makes `buildAlertCue` throw by design (main.js
 * renaming its enum must not silently blank the approach warning). Here that
 * throw is caught and read as "escalate", for one reason: this function decides
 * only HOW OFTEN to repaint, and the safe answer to "I cannot tell" is "as often
 * as possible". The error itself is not swallowed — the panel painter calls the
 * same builder and will surface it where the wrong cue is actually being drawn,
 * which is where somebody can act on it. What must not happen is the ship's whole
 * render loop dying because a dossier enum was renamed.
 *
 * @param {object|null} snapshot one frame from CockpitSnapshotProvider
 * @returns {boolean}
 */
export function hasBlinkingAlert(snapshot) {
  let cue;
  try {
    cue = buildAlertCue({
      dropState: snapshot?.target?.dropState,
      massLockHint: snapshot?.target?.massLockHint,
    });
  } catch {
    return true;
  }
  const blinks = (c) => !!c && c.blink !== BLINK.STEADY;
  return blinks(cue.drop) || blinks(cue.massLock);
}

/**
 * Apply a column-major 4x4 (three's `Matrix4.elements` layout, which is also
 * glTF's) to a point. Written out rather than reached for through `Vector3` so
 * this module needs nothing from three but the texture factory, and so it works
 * against anything that exposes a `matrixWorld.elements` — including the test's
 * stand-ins for a loaded cockpit.
 */
function applyMatrix(e, x, y, z) {
  const w = e[3] * x + e[7] * y + e[11] * z + e[15];
  const iw = w === 0 ? 1 : 1 / w;
  return [
    (e[0] * x + e[4] * y + e[8] * z + e[12]) * iw,
    (e[1] * x + e[5] * y + e[9] * z + e[13]) * iw,
    (e[2] * x + e[6] * y + e[10] * z + e[14]) * iw,
  ];
}

/** Every world-space vertex of one mesh, for `measureQuad` to reduce to a size. */
function meshWorldPositions(mesh, label) {
  const attr = mesh?.geometry?.attributes?.position;
  if (!attr || typeof attr.getX !== 'function' || !Number.isFinite(attr.count)) {
    throw new Error(
      `PanelHost: ${label} has no readable position attribute, so its face cannot be ` +
      `measured. Every panel's size and shape is derived from its own vertices; there ` +
      `is no written-down fallback and there must not be one.`,
    );
  }
  const e = mesh.matrixWorld?.elements;
  const out = [];
  for (let i = 0; i < attr.count; i++) {
    const x = attr.getX(i), y = attr.getY(i), z = attr.getZ(i);
    out.push(e ? applyMatrix(e, x, y, z) : [x, y, z]);
  }
  return out;
}

/** The mesh a `Screen_*` node's glass actually lives on. */
function meshForScreenNode(node, label) {
  if (node.isMesh) return node;
  let found = null;
  if (typeof node.traverse === 'function') {
    node.traverse((o) => { if (!found && o !== node && o.isMesh) found = o; });
  }
  if (found) return found;
  // Not the same thing as "no screens". This is a screen we can see but cannot
  // draw on, and a host that quietly bound three panels instead of four would be
  // reporting success while a quarter of the cockpit stayed dark.
  throw new Error(
    `PanelHost: ${label} matches the screen-node pattern but carries no mesh, so it has ` +
    `no glass to draw on. If the model now parents the display face under a transform ` +
    `node, this lookup has to follow that — it must not bind one panel fewer.`,
  );
}

/** The default buffer factory: a real, offscreen 2D canvas. */
function domCanvas(width, height) {
  if (typeof document === 'undefined' || typeof document.createElement !== 'function') {
    throw new Error(
      'PanelHost: no document to create a canvas from. Outside a browser you must pass ' +
      'opts.makeCanvas(width, height) — that seam is what makes this host testable at all.',
    );
  }
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

/**
 * Holds the four panels and pumps them.
 *
 * Built through `PanelHost.fromRoot(root)`; the constructor takes an
 * already-prepared panel list and is not the intended entry point.
 */
export class PanelHost {
  /**
   * Bind, measure, buffer and wire every configured panel on a loaded cockpit.
   *
   * @param {object} root a three.js Object3D holding the loaded cockpit model
   * @param {object} [opts]
   * @param {Record<string,string>} [opts.roles] role → node name; DEFAULT_PANEL_ROLES
   * @param {number} [opts.bufferHeightPx] the one resolution knob (see §1)
   * @param {(w:number,h:number)=>object} [opts.makeCanvas] buffer factory
   * @param {RegExp} [opts.screenNodeRe] which nodes are glass; SCREEN_NODE_RE
   * @param {number} [opts.ambientRepaintMs] the unescalated repaint period
   * @returns {PanelHost}
   */
  static fromRoot(root, opts = {}) {
    if (!root || typeof root.traverse !== 'function') {
      throw new Error(
        'PanelHost.fromRoot: needs the loaded cockpit as a traversable Object3D. ' +
        'A missing root is not "a cockpit with no screens" — it is no cockpit at all, ' +
        'and binding zero panels to it would hide a load that never happened.',
      );
    }

    const {
      roles = DEFAULT_PANEL_ROLES,
      bufferHeightPx = DEFAULT_PANEL_BUFFER_HEIGHT_PX,
      makeCanvas = domCanvas,
      screenNodeRe = SCREEN_NODE_RE,
      ambientRepaintMs = DEFAULT_AMBIENT_REPAINT_MS,
    } = opts;

    // World matrices first. Local-space vertices would give the right SIZE for a
    // rigidly-placed face, so this is the kind of omission that looks fine right
    // up until a parent carries a scale, at which point every panel is measured
    // at the wrong shape and nothing says so.
    if (typeof root.updateMatrixWorld === 'function') root.updateMatrixWorld(true);

    const found = new Map();
    root.traverse((o) => {
      const name = o?.name || '';
      if (!screenNodeRe.test(name)) return;
      if (!found.has(name)) found.set(name, o);
    });

    // A cockpit with no screens in it is a legitimate cockpit (cockpit-tub.glb
    // ships exactly that). Zero panels, no throw, and nothing printed — see §3.
    if (found.size === 0) return new PanelHost([], { roles, ambientRepaintMs });

    // TWO ROLES ON ONE SCREEN is the other way the role table can be wrong, and
    // `resolvePanelRoles` cannot see it — it only asks whether each named node
    // EXISTS, and a duplicated name exists twice over. It is the likely typo,
    // because swapping two entries is exactly the edit this table invites (§1 of
    // PanelLayout's header) and a half-finished swap leaves both entries pointing
    // at the same node. Measured on 2026-07-28 with `DRIVE: 'Screen_UL'`: the
    // second panel's material clone replaces the first's, so NAV's canvas is
    // rendered by nothing at all; Screen_UR binds to no role and stays dark, which
    // is the exact silent-blank-panel failure §3 exists to prevent; and dispose()
    // then restores the FIRST clone rather than the model's own material, leaving
    // the mesh wearing a material it has just disposed.
    //
    // Checked here rather than above the screenless early return on purpose: a
    // cockpit with no glass in it binds nothing and so has nothing to get wrong,
    // and §3's promise that such a cockpit loads in silence outranks reporting a
    // config bug that could not have bitten yet.
    const seen = new Map();
    for (const [role, node] of Object.entries(roles)) {
      if (seen.has(node)) {
        throw new Error(
          `PanelHost: the role table points both ${seen.get(node)} and ${role} at ${node}. ` +
          `Two roles cannot share one piece of glass — one of them would be drawn over by ` +
          `the other, and whichever screen lost its entry would stay dark with nothing to ` +
          `say why. This is what a half-finished swap of two entries looks like.`,
        );
      }
      seen.set(node, role);
    }

    // Some screens but not the configured ones: throws, naming the missing node.
    const bindings = resolvePanelRoles(roles, [...found.keys()]);

    const panels = bindings.map(({ role, node }) => {
      const label = `${role} → ${node}`;
      const mesh = meshForScreenNode(found.get(node), label);
      if (Array.isArray(mesh.material)) {
        throw new Error(
          `PanelHost: ${label} carries several materials. Which one is the glass is not ` +
          `something this host can decide, and guessing would either paint the readout ` +
          `onto a sub-face or silently paint nothing.`,
        );
      }

      const metrics = measureQuad(meshWorldPositions(mesh, label));
      const buffer = derivePanelBuffer(metrics, bufferHeightPx);

      const canvas = makeCanvas(buffer.width, buffer.height);
      if (!canvas || canvas.width !== buffer.width || canvas.height !== buffer.height) {
        throw new Error(
          `PanelHost: makeCanvas returned a ${canvas && canvas.width} x ` +
          `${canvas && canvas.height} surface for ${label}, expected ` +
          `${buffer.width} x ${buffer.height}. A buffer that is not the size it was ` +
          `asked for draws the panel at the wrong shape and nothing downstream can tell.`,
        );
      }
      const ctx = typeof canvas.getContext === 'function' ? canvas.getContext('2d') : null;
      if (!ctx) {
        throw new Error(
          `PanelHost: could not get a 2d context for ${label}. A null context accepts no ` +
          `drawing calls and reports nothing — the panel would simply stay black.`,
        );
      }

      const texture = createPanelTexture(canvas);

      // Its OWN material, always. The four faces share Mat_Screen in the model,
      // so assigning maps to the shared instance leaves all four showing the last
      // canvas written. See §6(a).
      const originalMaterial = mesh.material ?? null;
      const material = originalMaterial && typeof originalMaterial.clone === 'function'
        ? originalMaterial.clone()
        : originalMaterial;
      if (!material) {
        throw new Error(
          `PanelHost: ${label} has no material to carry the panel texture. An untextured ` +
          `screen face is indistinguishable from a working one that happens to be blank.`,
        );
      }
      material.name = `${originalMaterial.name || 'Mat_Screen'}__${role}`;
      material.map = texture;
      // The CRT is its own light source. Without this the panel is lit only by
      // the cabin, and the cabin light is OFF in the shipped look — four screens
      // that read perfectly in a lit test scene and are black in the game.
      if ('emissiveMap' in material) material.emissiveMap = texture;
      if (material.emissive && typeof material.emissive.setRGB === 'function') {
        material.emissive.setRGB(1, 1, 1);
      }
      // Adding a map changes the shader. See §6.
      material.needsUpdate = true;
      mesh.material = material;

      return {
        role, nodeName: node, mesh, metrics, canvas, ctx, texture,
        // Private bookkeeping, prefixed so it reads as not-part-of-the-contract.
        _originalMaterial: originalMaterial,
        _material: material,
        _blanked: false,
        _reportedError: false,
      };
    });

    return new PanelHost(panels, { roles, ambientRepaintMs });
  }

  /** @param {Array} panels prepared by `fromRoot` @param {object} config */
  constructor(panels = [], { roles = DEFAULT_PANEL_ROLES, ambientRepaintMs = DEFAULT_AMBIENT_REPAINT_MS } = {}) {
    this._panels = panels;
    this.roles = roles;
    this.ambientRepaintMs = ambientRepaintMs;
    this._painters = new Map();
    this._clockMs = 0;
    this._lastPaintMs = null;       // null = nothing painted yet, so paint now
    this._lastWarping = null;       // null = no frame seen yet
    this._forceRepaint = false;
    this._disposed = false;
  }

  /**
   * The bound panels. A copy of the list, so a caller cannot splice the host's
   * own bookkeeping; the panel objects themselves are live, because their `ctx`
   * is the whole point.
   */
  get panels() {
    return this._panels.slice();
  }

  /** One panel by role, or null. Null is normal — a cockpit may have no screens. */
  panel(role) {
    return this._panels.find((p) => p.role === role) ?? null;
  }

  /**
   * Set (or with `null`, clear) what a panel draws.
   *
   * Validated against the ROLE CONFIG, not against the bound panels — deliberately.
   * A typo'd role must throw, because a painter registered under 'NVA' would leave
   * that screen blank forever with nothing to explain it. But on a cockpit with no
   * screens at all there are no bound panels, and the game still registers all four
   * painters at start-up; making that throw would turn the legitimate no-screens
   * cockpit into a crash at exactly the seam §3 exists to keep quiet.
   *
   * Setting a painter forces a repaint on the next update rather than waiting for
   * the ambient tick — a panel that ignores its new content for a tenth of a second
   * looks like the painter did not take.
   *
   * @param {string} role one of the configured roles
   * @param {?(panel:object, snapshot:object, nowMs:number)=>void} fn
   */
  setPainter(role, fn) {
    if (!Object.prototype.hasOwnProperty.call(this.roles, role)) {
      throw new Error(
        `PanelHost.setPainter: no role ${JSON.stringify(role)} in this cockpit's role ` +
        `config (${Object.keys(this.roles).join(', ')}). A painter under an unknown role ` +
        `would never be called and its screen would stay blank with nothing to say why.`,
      );
    }
    if (fn === null || fn === undefined) this._painters.delete(role);
    else if (typeof fn !== 'function') {
      throw new Error(`PanelHost.setPainter: ${role}'s painter must be a function, got ${typeof fn}.`);
    } else this._painters.set(role, fn);

    const panel = this.panel(role);
    if (panel) {
      panel._blanked = false;
      panel._reportedError = false;
    }
    this._forceRepaint = true;
    return this;
  }

  /**
   * Advance the paint clock. See §4: `nowMs` is the render-cadence timestamp the
   * caller already has, and `snapshot.t` is deliberately not consulted.
   *
   * The `renderDt` fallback is for a caller that hands over no usable timestamp —
   * it integrates the render delta (SECONDS in main.js, hence the x1000) so the
   * blink keeps moving. With neither, the clock stands still and only forced
   * repaints happen; the visible result is a frozen panel, which is the honest
   * symptom of a host being fed no time at all.
   */
  _advanceClock(snapshot, nowMs) {
    if (Number.isFinite(nowMs)) {
      this._clockMs = nowMs;
      return;
    }
    const dt = snapshot?.renderDt;
    if (Number.isFinite(dt) && dt > 0) this._clockMs += dt * 1000;
  }

  /**
   * Paint whatever needs painting this frame.
   *
   * @param {object|null} snapshot one frame from CockpitSnapshotProvider.get()
   * @param {number} [nowMs] the render-cadence timestamp (performance.now())
   * @returns {number} how many panels were repainted
   */
  update(snapshot, nowMs) {
    // Disposal races the render loop during teardown; a no-op is the only answer
    // that does not make every caller write a guard of its own.
    if (this._disposed) return 0;

    this._advanceClock(snapshot, nowMs);

    const warping = !!snapshot?.regime?.warping;
    // The warp EDGE, not the warp. See §5: this is what gets the just-invalidated
    // dossier off the glass within one frame instead of within one ambient tick.
    const warpChanged = this._lastWarping !== null && this._lastWarping !== warping;
    this._lastWarping = warping;

    const escalated = hasBlinkingAlert(snapshot);
    const due = this._lastPaintMs === null
      || this._forceRepaint
      || warpChanged
      || escalated
      || (this._clockMs - this._lastPaintMs) >= this.ambientRepaintMs;

    if (!due) return 0;

    this._forceRepaint = false;
    this._lastPaintMs = this._clockMs;

    let painted = 0;
    for (const panel of this._panels) {
      if (this._paintPanel(panel, snapshot)) painted += 1;
    }
    return painted;
  }

  /** Paint one panel. Returns whether its texture was actually re-uploaded. */
  _paintPanel(panel, snapshot) {
    const painter = this._painters.get(panel.role) ?? null;

    if (!painter) {
      // Unclaimed glass: cleared once, then left alone. Cleared rather than
      // filled because a fill needs a colour and this file owns no palette (§7).
      if (panel._blanked) return false;
      panel.ctx.clearRect(0, 0, panel.canvas.width, panel.canvas.height);
      panel._blanked = true;
      panel.texture.needsUpdate = true;
      return true;
    }

    panel._blanked = false;
    try {
      painter(panel, snapshot, this._clockMs);
    } catch (err) {
      // One panel's painter must not take the frame down, and must not stop the
      // other three drawing — the same rule InfoReadout applies to one bad row.
      // Reported ONCE per panel: at 60 Hz a per-frame report is a console that
      // nobody can read, which is functionally the same as no report at all.
      if (!panel._reportedError) {
        panel._reportedError = true;
        console.error(`PanelHost: the ${panel.role} painter threw; that panel is not updating.`, err);
      }
      return false;
    }

    // Only panels that actually painted get re-uploaded. A blanket needsUpdate
    // would push four full buffers to the GPU every repaint whether or not
    // anything changed.
    panel.texture.needsUpdate = true;
    return true;
  }

  /**
   * Release everything this host made and put the model back as it was found.
   *
   * Textures are disposed (a CanvasTexture holds a GPU allocation that no garbage
   * collector reclaims) and so are the per-panel material clones. The mesh's
   * ORIGINAL material is restored, so a cockpit that is unloaded and reloaded —
   * or handed to the lab's material overrides — is not left wearing four clones
   * that point at disposed textures.
   *
   * Idempotent, because teardown paths get called twice.
   */
  dispose() {
    if (this._disposed) return;
    this._disposed = true;

    for (const panel of this._panels) {
      panel.texture?.dispose?.();
      if (panel.mesh && panel._originalMaterial) panel.mesh.material = panel._originalMaterial;
      if (panel._material && panel._material !== panel._originalMaterial) {
        panel._material.map = null;
        if ('emissiveMap' in panel._material) panel._material.emissiveMap = null;
        panel._material.dispose?.();
      }
    }
    this._panels = [];
    this._painters.clear();
  }

  /** Whether dispose() has run. */
  get disposed() {
    return this._disposed;
  }
}
