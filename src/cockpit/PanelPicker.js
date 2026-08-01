/**
 * PanelPicker — which piece of glass is the player pointing at.
 *
 * Lane F, workstream `cockpit-zoom-to-panel-2026-07-29`.
 *
 * This is the missing half of the input path. `PanelPointerAdapter` has been
 * fully unit-tested since the previous increment and never once driven live,
 * because nothing in the codebase produced the raycast intersections it consumes
 * — there were ZERO `Raycaster` usages anywhere in `src/cockpit/`. It turns a
 * pointer position into `{ role, mesh, hit }`, and the adapter turns that into a
 * press, a drag, a release and now a click on the nav computer.
 *
 * ── THE LETTERBOX, WHICH IS THE ONLY SUBTLE PART ───────────────────────────
 *
 * The reflex conversion from a mouse position to normalised device coordinates
 * measures against the CANVAS:
 *
 *     x = (event.clientX / canvas.width) * 2 - 1
 *
 * The cockpit is not rendered into the canvas. It is rendered into a 16:9
 * viewport CENTRED inside it, with black bars on whichever axis has slack —
 * deliberately, so that the fraction of the view a panel occupies is the fraction
 * it will occupy in the game rather than a fraction of whatever shape Max's
 * window happens to be. Whenever those bars are non-zero the reflex conversion is
 * measured against the wrong rectangle.
 *
 * What makes that worth a paragraph is the SHAPE of the error: it is exactly zero
 * at the centre of the screen and grows toward the edges. So the cursor lines up
 * with the middle of a panel and misses its corners — and on the NAV panel the
 * level-tab strip lives along the bottom edge. The bug presents as "the tab strip
 * does not respond", which is a sentence that sends you to look at
 * `_handleClick`, three modules away from the arithmetic that is actually wrong.
 *
 * So the viewport is an explicit argument. It is never inferred from the canvas
 * and never defaulted, because a default here would be silently correct on one
 * window shape and silently wrong on every other.
 *
 * ── WHAT IT PICKS, AND WHAT IT DELIBERATELY CANNOT ─────────────────────────
 *
 * Only the meshes it was handed, which are the panel records `PanelHost` built —
 * so the housings, the hull, the ribs and the canopy are not merely deprioritised
 * but absent from the target set. That matters because a `ScreenBody_*` carries no
 * uvs, so a housing hit would surface one layer downstream as `PanelPointer`'s
 * "the intersection carries no uv" error, which names the wrong module and reads
 * as a broken asset.
 *
 * Live world transforms every pick, nothing cached. A picker that snapshotted
 * geometry at construction would keep hitting a zoomed panel's OLD corner
 * position — the screen filling the player's view would be unclickable while a
 * patch of empty space still responded.
 *
 * ── ONE MEASURED NON-ISSUE, WRITTEN DOWN SO IT IS NOT RE-DISCOVERED ────────
 *
 * A screen quad is two triangles, and the diagonal between them runs corner to
 * corner THROUGH the centre of the face. A ray aimed at exactly that point is a
 * boundary case for both triangles, and float can reject it from both — so the
 * exact mathematical centre of a panel can miss.
 *
 * That is only tolerable if the failing set is a POINT rather than a LINE, since
 * a dead seam down the middle of every screen would present as "clicks near the
 * middle sometimes do nothing" and be genuinely hard to chase. So it was measured
 * instead of reasoned about: swept at 1 px over a 1600x900 viewport with a panel
 * zoomed to fill it, 701,501 pixels hit, and integer versus half-pixel sampling
 * differ by 3 out of those 701,501. The exact centre misses; centre + 0.5 px hits.
 *
 * A point, not a line. Deliberately NOT mitigated here: nudging the ray would
 * trade a measure-zero miss for a systematic uv error on every real click, and
 * the uv is what positions the nav computer's cursor.
 */
import { Raycaster, Vector2 } from 'three';

/**
 * A pointer position in CSS pixels → normalised device coordinates.
 *
 * `inside` is reported rather than clamped. A click on the black bar is a click
 * on nothing, and clamping it would slide it onto the nearest edge of the render
 * — putting a live cursor on the letterbox and making a click there do something.
 *
 * @param {number} px pointer x, in the same space as `viewport.x`
 * @param {number} py pointer y
 * @param {{x:number, y:number, width:number, height:number}} viewport the RENDERED
 *        rectangle in CSS pixels, not the canvas
 * @returns {{x:number, y:number, inside:boolean}}
 */
export function viewportNdc(px, py, viewport) {
  const { x, y, width, height } = viewport || {};
  if (!(width > 0) || !(height > 0) || !Number.isFinite(x) || !Number.isFinite(y)) {
    throw new Error(
      `viewportNdc: needs a viewport with a finite origin and a positive size, got ` +
      `${JSON.stringify(viewport)}. A zero-sized viewport makes every coordinate ` +
      `Infinity, and the panels then respond to nothing at all rather than to the ` +
      `wrong place — which is harder to notice, not easier.`,
    );
  }
  const u = (px - x) / width;
  const v = (py - y) / height;
  return {
    x: u * 2 - 1,
    // Screen y grows downward, NDC y grows upward.
    y: -(v * 2 - 1),
    inside: u >= 0 && u <= 1 && v >= 0 && v <= 1,
  };
}

/** Picks the nearest cockpit panel under a pointer position. */
export class PanelPicker {
  /**
   * @param {object} opts
   * @param {Array<{role:string, nodeName:string, mesh:object}>} opts.panels the
   *        records `PanelHost` produced
   * @param {string[]} [opts.roles] restrict picking to these roles. Max ruled the
   *        zoom "only necessary for the upper-left monitor"; the mechanism stays
   *        generic and the restriction lives here, so callers do not each
   *        re-implement the same filter slightly differently.
   */
  constructor({ panels = [], roles = null } = {}) {
    this._panels = roles
      ? panels.filter((p) => roles.includes(p.role))
      : panels.slice();
    this._raycaster = new Raycaster();
    this._ndc = new Vector2();
  }

  /** The panel records this picker will consider. */
  get panels() {
    return this._panels.slice();
  }

  /**
   * @param {number} px pointer x in CSS pixels
   * @param {number} py pointer y in CSS pixels
   * @param {object} ctx
   * @param {object} ctx.camera the camera being rendered through
   * @param {{x,y,width,height}} ctx.viewport the RENDERED rectangle
   * @returns {?{role:string, nodeName:string, mesh:object, hit:object}} nearest, or null
   */
  pick(px, py, { camera, viewport } = {}) {
    if (!camera || !camera.isCamera) {
      throw new Error(
        'PanelPicker.pick: needs the camera being rendered through. The ray is built from its ' +
        'projection and its world matrix; there is no sensible default.',
      );
    }
    const ndc = viewportNdc(px, py, viewport);
    // Off the render and onto a black bar. Answered without raycasting at all —
    // not an optimisation, a statement that the bars are not part of the picture.
    if (!ndc.inside) return null;
    if (this._panels.length === 0) return null;

    this._ndc.set(ndc.x, ndc.y);
    this._raycaster.setFromCamera(this._ndc, camera);

    // Live transforms, every pick. See the header: a cached snapshot leaves a
    // zoomed panel unclickable where it now is and clickable where it used to be.
    const meshes = [];
    for (const p of this._panels) {
      p.mesh.updateWorldMatrix(true, false);
      meshes.push(p.mesh);
    }

    // `false` — do not recurse. The panel meshes are the whole target set, and a
    // recursive search would sweep in whatever the mover has parented alongside
    // them under a shared pivot, starting with the housing.
    const hits = this._raycaster.intersectObjects(meshes, false);
    if (hits.length === 0) return null;

    // three sorts by distance, so the nearest is first — which is what makes a
    // zoomed panel take the click instead of the one it is now standing in front of.
    const hit = hits[0];
    const panel = this._panels.find((p) => p.mesh === hit.object);
    if (!panel) return null;
    return { role: panel.role, nodeName: panel.nodeName, mesh: panel.mesh, hit };
  }
}

export default PanelPicker;
