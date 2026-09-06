/**
 * panelBufferRows — how many BUFFER ROWS a cockpit panel is actually worth.
 *
 * ⭐ THE FAILURE THIS PREVENTS IS A LIE ABOUT RESOLUTION. Until 2026-09-06 every panel drew into a
 * flat 512-tall canvas while the cockpit itself was rendered at window resolution, so a panel was
 * MINIFIED on its way to the glass and looked fine by accident. The moment the cockpit target drops
 * onto the world's pixel grid (RetroRenderer.resize → `bufferForLines`), a 240-line frame gives a
 * panel roughly forty-three rows of screen — and pushing 512 rows of glyphs through forty-three is a
 * ~12:1 point-sample that shreds them. The panel has to be AUTHORED at the size it will be SHOWN.
 *
 * ⛔ THIS IS THE PIXEL FRACTION, NOT THE ANGULAR ONE, AND THE DIFFERENCE IS ~14%. The tempting form
 * is `2 * atan(h / 2d) / fov` — the share of the vertical FIELD OF VIEW the panel subtends. That is
 * the wrong question. A perspective projection is not linear in angle; it is linear in the TANGENT.
 * A framebuffer row is a slice of the projection plane, so the fraction of ROWS a face covers is
 *
 *     rows = (h / d) / (2 * tan(fov / 2)) * bufferHeight
 *
 * — the face's half-height over the projection plane's half-height, both at the same depth. The
 * angular form returns 49 rows where this gives 43 at 240p/70°, and it is not even an upper bound of
 * the right shape.
 *
 * ⛔⛔ AND THIS NUMBER IS A FLOOR, NOT A CEILING — MEASURED 2026-09-06, AND THE OPPOSITE WAS WRITTEN
 * HERE FIRST. The natural assumption is that an off-axis panel subtends LESS than a fronto-parallel
 * one, because it sits further from the eye than its perpendicular depth. That is backwards. A
 * perspective projection divides by the DEPTH, not by the radial distance, so a face out at the edge
 * of the frame is STRETCHED — which is the same effect that fattens spheres in the corners of a wide
 * shot. The shipped screens sit ~41.5° off the view axis (`cockpit-metrics.json` /screens: centre
 * (-0.497, 0.186, -0.599), |c| = 0.800 but depth only 0.599), and they are tilted, so their glass
 * does not even cover a constant number of rows across its own width:
 *
 *     pair    authored    actually covered, near edge → far edge    magnification
 *     upper      43              51.9  →  68.1 rows             1.211x .. 1.589x
 *     lower      46              53.6  →  70.5 rows             1.163x .. 1.531x
 *
 * ⭐ THE BAND IS CONSTANT AT EVERY RESOLUTION AND EVERY FOV, which is what makes it safe rather than
 * merely lucky: both the authored count and the covered count carry the same `bufferHeight /
 * 2·tan(fov/2)` factor, so it cancels and only the geometry is left. Pinned in the spec.
 *
 * ⛔ SO WHY KEEP THE SMALLER NUMBER? BECAUSE THE TWO ERRORS ARE NOT THE SAME SIZE. Under Nearest
 * sampling — and `createPanelTexture` now pins `magFilter` to Nearest for AC-1 — magnifying
 * DUPLICATES texels and minifying DELETES them. Every glyph in this cockpit is a 3x5 face with
 * one-texel stems and every rule is a one-texel hairline, so a minified panel loses whole strokes
 * and reads as a smear of gaps, while a magnified one keeps every stroke and merely renders some of
 * them two world-pixels wide instead of one. Authoring under the glass makes minification
 * unreachable in every shipped configuration. That is the actual argument, and it is worth stating
 * because the number it defends looks at first glance like an undersize.
 *
 * ⚠ THE COST IS REAL AND IT IS AC-9's TO JUDGE: irregular stem widths, and panels that read ~1.2-1.6x
 * blockier than the world behind them. The lever, if Max's eye says they sit off the world's grid, is
 * to author from the MINIMUM covered edge, FLOORED (51 upper / 53 lower) instead — still never minifying, and
 * the 7x12 type grid is unchanged there because `s = floor(min(H/43, W/49))` is still 1 at 51 rows.
 *
 * ⛔ THE EYE IS AN ARGUMENT AND IS NEVER ASSUMED TO BE THE ORIGIN. `CockpitRig._mountEye` refuses
 * that assumption by name — it finds `Eye_Point` in the model, falls back to the origin only when
 * the node is missing, and SAYS SO through `eyeFound` — precisely because a seat that moves would
 * otherwise silently resize every panel against the wrong viewpoint while still looking plausible.
 * The distance here is |centre - eyePos|, measured, every remount.
 *
 * ⛔ NO `RENDER_BUFFER` IMPORT. `bufferHeight` arrives as an argument so this stays a pure function
 * of numbers, testable with no renderer, no GL and no window. The CALLER resolves the live buffer
 * (main.js, through `resolveRenderBuffer`) — which is also what stops this module from stranding on
 * a boot-time copy of a value that moves on every resize (renderBuffer.js).
 */

/**
 * Rows of drawing buffer a panel deserves, given where the eye is and how coarse the world is.
 *
 * Every guard throws rather than clamping, for `derivePanelBuffer`'s own reason: a plausible
 * substitute hides WHICH input was broken, and the visible symptom — a panel that is merely blurry,
 * or a 0 x 0 canvas that accepts draws and reports nothing — points at the wrong file.
 *
 * @param {{height:number, centre:{x:number,y:number,z:number}}} metrics from `measureQuad`;
 *        `height` is the face's extent in WORLD METRES and `centre` its world-space midpoint
 * @param {{eyePos:{x:number,y:number,z:number}, fovDeg:number, bufferHeight:number}} view
 *        the pilot's eye, the live vertical fov in degrees, and the world buffer's line count
 * @returns {number} an integer >= 1
 */
export function panelBufferRows(metrics, view) {
  const height = metrics && metrics.height;
  if (!Number.isFinite(height) || height <= 0) {
    throw new Error(
      `panelBufferRows: needs the face's measured height in metres, got ${height}. ` +
      `The row count is that height divided by the projection plane's — without it the ` +
      `panel would fall back to some default size and read as merely soft, with nothing ` +
      `to say the measurement never happened.`,
    );
  }
  const centre = metrics && metrics.centre;
  if (!isVec3(centre)) {
    throw new Error(
      `panelBufferRows: needs the face's world-space centre from measureQuad, got ` +
      `${describe(centre)}. Distance from the eye is the whole of this derivation; a ` +
      `missing centre would silently become a distance of zero, i.e. an infinite panel.`,
    );
  }
  if (!view || typeof view !== 'object') {
    throw new Error(
      `panelBufferRows: needs a view {eyePos, fovDeg, bufferHeight}, got ${describe(view)}. ` +
      `A panel sized without one is sized against nothing in particular.`,
    );
  }
  const { eyePos, fovDeg, bufferHeight } = view;
  if (!isVec3(eyePos)) {
    throw new Error(
      `panelBufferRows: needs the pilot's eye position, got ${describe(eyePos)}. ` +
      `⛔ It is NOT safe to assume the origin — CockpitRig._mountEye reads Eye_Point from the ` +
      `model and reports \`eyeFound\` exactly so this assumption cannot creep back in. ` +
      `Assuming it would size every panel against the wrong viewpoint and still look plausible.`,
    );
  }
  if (!Number.isFinite(fovDeg) || fovDeg <= 0 || fovDeg >= 180) {
    throw new Error(
      `panelBufferRows: vertical fov must be finite and in (0, 180) degrees, got ${fovDeg}. ` +
      `At 0 the projection plane has no height and every panel asks for an infinite buffer; ` +
      `at 180 it is infinitely tall and every panel asks for zero rows. Both allocate before ` +
      `anything checks them.`,
    );
  }
  if (!Number.isFinite(bufferHeight) || bufferHeight < 1) {
    throw new Error(
      `panelBufferRows: the world buffer's height must be a positive number of lines, got ` +
      `${bufferHeight}. Zero is what an unresized RetroRenderer publishes — resolve it through ` +
      `\`resolveRenderBuffer\` rather than reading RENDER_BUFFER raw, or every panel comes back ` +
      `one row tall.`,
    );
  }

  const dx = centre.x - eyePos.x;
  const dy = centre.y - eyePos.y;
  const dz = centre.z - eyePos.z;
  const distance = Math.hypot(dx, dy, dz);
  if (!Number.isFinite(distance) || distance <= 1e-6) {
    throw new Error(
      `panelBufferRows: the panel centre is ${distance} m from the eye. A panel AT the eye ` +
      `subtends everything, so this would ask for a buffer of unbounded height. This is what a ` +
      `remount taken while a panel is ZOOMED looks like — the mesh is physically at the pilot's ` +
      `eye then; see CockpitRig.remount, which tears the zoom rig down first for that reason.`,
    );
  }

  // The one line this module exists for. Half the face over half the projection plane, both at
  // `distance`, times the rows the plane is drawn with. See the header for why it is not angular.
  const rows = (height / distance) / (2 * Math.tan((fovDeg * Math.PI) / 180 / 2)) * bufferHeight;
  return Math.max(1, Math.round(rows));
}

/** A three Vector3 or a plain `{x,y,z}` — the rig hands the first, tests and the lab the second. */
function isVec3(v) {
  return !!v && Number.isFinite(v.x) && Number.isFinite(v.y) && Number.isFinite(v.z);
}

/** Legible in a thrown message: `null`, `undefined` and `{}` must not all print as "object". */
function describe(v) {
  if (v === null) return 'null';
  if (v === undefined) return 'undefined';
  if (typeof v === 'object') return `${JSON.stringify(v)}`;
  return String(v);
}
