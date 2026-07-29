/**
 * NavPanel — what the NAV screen draws: the real nav computer, one ink.
 *
 * Lane F, workstream `cockpit-screen-content-2026-07-28`, AC-NAV-BUFFER.
 *
 * ── THIS IS THE H4 FORK, AND THE POINT IS THAT MAX LOOKS AT IT ──────────────
 *
 * The other three painters compose their panel out of strings and bars. This one
 * does not draw a nav map at all. It renders `src/ui/NavComputer.js` — four
 * thousand lines that already draw all seven navigation levels, the drill
 * animations, the blinking auto-cursor and the star picker — into a buffer of its
 * own, and quantises the result to one ink.
 *
 * That is a decision Max made rather than an implementation shortcut, and the
 * reason it is a fork is that NOBODY KNOWS IF IT READS. The nav computer is full
 * colour by design: per-spectral-class star colours, a cyan you-are-here, a green
 * selection, gold labels, a GPU-rendered galaxy density image. Phosphor law is
 * one ink on black. Whether that dithers into something that reads as a phosphor
 * CRT or into mud is a judge-by-eye question that no argument settles. It is his
 * gate and no agent may close it.
 *
 * If it reads, about 3,900 lines of drawing code are saved. If it does not, the
 * screens get re-authored one at a time against a host that is already proven —
 * and everything under this file, the source, the dither and the panel plumbing,
 * is identical in both outcomes.
 *
 * ── WHY THIS IS A FACTORY AND THE OTHER THREE ARE NOT ───────────────────────
 *
 * `paintDrive`, `paintTarget` and `paintInfo` are plain functions of the
 * snapshot: hand them a kit and a frame and they draw. This panel needs a live,
 * long-lived object — a `NavSource` holding a `NavComputer` — and there is
 * exactly one of those per cockpit. Making it an argument rather than a module
 * global is the same reasoning that runs through the rest of lane F: the thing
 * that touches the platform is a parameter, so the file that draws can be
 * reasoned about and the file that builds a nav computer is somebody else's.
 *
 * `makeNavPainter` therefore returns a painter of the SAME
 * `(screen, snapshot, nowMs)` shape as the other three, so all four register
 * through `panelPainter` interchangeably. A painter with a different arity is a
 * wiring bug waiting to happen.
 *
 * ── WHAT HAPPENS WHEN IT GOES WRONG, AND WHY THAT IS DELIBERATE ─────────────
 *
 * The first line is `screen.clear()`, and it runs BEFORE anything that can
 * throw. That ordering is chosen, not incidental.
 *
 * `PanelHost` wraps every painter call, logs the first throw naming the panel,
 * and then leaves that screen exactly as it was. So if the nav render fails —
 * a collapsed buffer, a missing context, a galaxy renderer that is not there —
 * the choice is between a panel FROZEN on its last good frame and a panel that
 * goes BLACK with a named cause on the console. Frozen is worse, and worse in
 * the specific way this workstream keeps guarding against: a nav map that is
 * still legible and no longer true is indistinguishable, at a glance from the
 * pilot's seat, from one that is working. Clearing first makes the failure
 * visible on the glass and findable in the log.
 *
 * There is NO holding card and NO fallback drawing here, for the same reason.
 * A plausible-looking placeholder on the NAV panel is exactly how "the nav
 * computer is live from the first frame" gets ticked off by mistake. If the real
 * thing is not drawing, this panel shows nothing.
 *
 * ── DELIBERATE NON-GOALS ────────────────────────────────────────────────────
 *
 *   - NO SCALING. The source is rendered at the panel's own buffer size, so the
 *     dither is 1:1 with the glass. Resampling would soften exactly the texture
 *     the ordered dither exists to create — see PhosphorDither's header.
 *   - IT FEEDS THE NAV COMPUTER NOTHING. Player position, current system, focus
 *     and the warp target are pushed onto the instance by whoever owns it (the
 *     lab today; main.js when the cockpit is wired in). A painter that reached
 *     into the snapshot and wrote nav state would be doing that once per repaint,
 *     on the drawing path, which is where `setPlayerPosition` — which resets the
 *     prism's star loading — must never be called from.
 *   - NO SECOND CATCH. `PanelHost` owns the reporting. A catch here would swallow
 *     the throw before the place that logs it ever saw it.
 */

import { DEFAULT_DITHER, ditherToPhosphor } from '../PhosphorDither.js';

/**
 * Build the NAV painter over a nav source.
 *
 * @param {import('../NavSource.js').NavSource} source the hosted nav computer
 * @param {() => {threshold?:number, gamma?:number}} [readKnob] the dither setting,
 *        read FRESH every paint. A function and not a plain object on purpose:
 *        the whole point of the knob is that the lab sweeps it while Max watches
 *        the glass, and a value captured once at wiring time would make the
 *        control appear to do nothing — the one failure that would waste the
 *        judgement this panel exists to enable.
 * @returns {(screen:object, snapshot:object, nowMs:number) => void}
 */
export function makeNavPainter(source, readKnob = () => DEFAULT_DITHER) {
  if (!source || typeof source.render !== 'function' || typeof source.readPixels !== 'function') {
    throw new Error(
      'makeNavPainter: needs a NavSource — something that can render a nav frame and hand ' +
      'back its pixels. Registered without one, the NAV panel would throw on its first ' +
      'repaint, inside PanelHost\'s catch, and then simply stay black with one line in the ' +
      'console to explain a quarter of the cockpit.',
    );
  }
  if (typeof readKnob !== 'function') {
    throw new Error(
      `makeNavPainter: the dither knob must be a function returning {threshold, gamma}, got ` +
      `${typeof readKnob}. It is read once per paint so the lab's sweep reaches the glass; a ` +
      `plain object here would freeze the setting at whatever it was when this was wired.`,
    );
  }

  /**
   * The dither's output surface, reused across repaints.
   *
   * Held in the closure rather than reallocated per frame: this is a full RGBA
   * buffer the size of the panel — around a megabyte and a quarter at the default
   * 512-tall buffer — and allocating one per repaint is real garbage on the paint
   * path for no benefit, since every pixel of it is overwritten every time.
   *
   * Re-made whenever the panel's size changes, which is the buffer-resolution
   * knob's doing. Keyed on the actual dimensions rather than on "have we made one
   * yet", because a stale surface of the wrong size is what a naive cache hands
   * back after a rebuild — and `ditherToPhosphor` would reject it, correctly, but
   * only after the panel had already stopped drawing.
   */
  let out = null;

  return function paintNav(screen, snapshot, nowMs) {   // eslint-disable-line no-unused-vars
    // FIRST, and before anything that can throw. See the header: a NAV panel that
    // fails must go black with a cause in the log, never freeze on a picture that
    // still looks like a working nav computer.
    screen.clear();

    // The panel may have been rebuilt at a new buffer height under us. The source
    // is NOT rebuilt with it — building one means building a NavComputer, which
    // regenerates sectors and reloads a prism of stars — so it is told instead.
    source.resize(screen.width, screen.height);
    source.render();

    const pixels = source.readPixels();

    if (!out || out.width !== screen.width || out.height !== screen.height) {
      if (typeof screen.ctx.createImageData !== 'function') {
        throw new Error(
          'NavPanel: the panel context has no createImageData(), so the dithered frame has ' +
          'nowhere to be written. This painter puts pixels rather than drawing shapes, which ' +
          'is the one thing it needs beyond the Phosphor kit.',
        );
      }
      out = screen.ctx.createImageData(screen.width, screen.height);
    }

    ditherToPhosphor(pixels, readKnob(), out);

    // putImageData and not drawImage: it writes the panel's pixels verbatim, with
    // no smoothing, no transform and no compositing. Any of those three would
    // blend neighbouring ink and background into a grey — a THIRD COLOUR — and
    // one ink on black is the law this whole screen is being judged against.
    screen.ctx.putImageData(out, 0, 0);
  };
}

export default makeNavPainter;
