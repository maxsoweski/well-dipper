/**
 * NavPanel — what the NAV screen draws: the real nav computer, in full colour.
 *
 * Lane F, workstream `cockpit-screen-content-2026-07-28`, AC-NAV-BUFFER,
 * AC-NAV-CHROMELESS-SYSTEM, AC-NAV-FULL-COLOUR. AC-NAV-LEVEL-POLICY moved OUT of
 * this file on 2026-07-29 — see "THIS PANEL STATES AN INTENT" below.
 *
 * ── THE H4 FORK WAS ANSWERED, AND THE ANSWER WAS "NOT LIKE THIS" ────────────
 *
 * This file used to quantise the nav computer to one ink through
 * `../PhosphorDither.js`, and the whole point was that NOBODY KNEW IF IT READ.
 * Max looked at it on 2026-07-29 and ruled: "the monotone is too crude for this
 * view … just showing the system objects/orbits/player position and in full
 * color." So NAV — and only NAV — is now full colour.
 *
 * The dither is NOT deleted and this is not a retraction of it. `PhosphorDither`
 * still draws DRIVE, TARGET and INFO, its measurements still stand, and its test
 * still runs. What changed is which panels it is right for: three panels that are
 * BUILT out of strings and bars, and one panel that is a four-thousand-line
 * colour instrument borrowed whole. See
 * `docs/WORKSTREAMS/cockpit-screen-content-2026-07-28/nav-chromeless-design-2026-07-29.md`
 * for the measurement that closed it (SECTOR and REGION turn to mud because
 * `_renderDensityBg` draws a near-uniform bright field — a CONTENT problem, so no
 * threshold and no extra resolution rescues it).
 *
 * The known cost, stated because it is the thing Max is judging: there is no CRT
 * shader in this repo. One ink on black is the ONLY thing making a panel read as
 * phosphor today, so a full-colour NAV sits beside three one-ink panels looking
 * like a different device. No treatment is being added — "in its original form
 * for now" was the steer.
 *
 * ── THIS PANEL STATES AN INTENT; THE LEVEL GATE IS THE NAV COMPUTER'S ───────
 *
 * `chromeless` is an INTENT, and it is written unconditionally: "this host wants
 * a bare screen wherever bare makes sense." It is NOT the answer to "is this
 * frame bare." That answer is `NavComputer`'s own, resolved at DRAW time from the
 * level it is actually drawing.
 *
 * This file used to compute the answer itself — read `nav.level`, apply a
 * SYSTEM-only policy, write the resulting boolean — and that was unsound, in a way
 * that was measured rather than argued. `NavComputer.render()` MOVES `_levelIndex`
 * TO 4 PART-WAY THROUGH THE FRAME, in the `_systemZoomAnim` completion block, long
 * after a painter-side gate has been fixed from the PRE-transition level. So the
 * first SYSTEM frame of a prism-to-system zoom drew FULLY CHROMED: twelve text
 * calls, plus a published autopilot button rectangle — a live, invisible control
 * sitting on a screen that is supposed to have no controls on it. That last part
 * is unreachable only because nothing in the cockpit forwards pointer events at
 * NAV yet; the increment that turns clicks on turns the bug on with it.
 *
 * No amount of care on this side fixes that. The level is not stable across the
 * render boundary, so any value derived from it before `render()` is a value that
 * can be wrong by the time it is read. The gate therefore lives where the level is
 * true: inside the class, evaluated per draw.
 *
 * Max's ruling is unchanged and is now enforced without this file's cooperation —
 * chrome-lessness applies at the SYSTEM level and nowhere else. `AutopilotNavSequence`
 * drives the panel through levels 0–3 while it picks a star, and SECTOR and REGION
 * are mostly LABELS: stripped, they are a bare grid, and you would be watching the
 * ship choose a star whose name you cannot read. Those levels keep their chrome
 * because the nav computer refuses to strip them, not because the painter
 * remembered to ask nicely.
 *
 * There is exactly ONE definition of the SYSTEM-only rule, and it is in
 * `NavComputer.js`, where it is applied. A second copy here — which is what this
 * file used to hold — is a copy that can drift, and the drift symptom is the worst
 * kind: the file you read says one thing and the file that runs says another.
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
 * THERE IS NO DITHER KNOB PARAMETER ANY MORE. It was removed rather than left
 * accepting-and-ignoring, because its own doc-comment named the exact failure a
 * dead knob causes — "the control appear to do nothing" — and a parameter that
 * silently does nothing is that failure with the evidence hidden. The two knobs
 * that replace it, `systemFillFactor` and `_systemZoom`, are fields ON THE NAV
 * COMPUTER; whoever owns the instance writes them, which is the lab today.
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
 *     nav picture is 1:1 with the glass. Resampling would soften line art that is
 *     already one pixel wide at this size.
 *   - IT FEEDS THE NAV COMPUTER NOTHING BUT THE DRAW FLAG. Player position,
 *     current system, focus and the warp target are pushed onto the instance by
 *     whoever owns it (the lab today; main.js when the cockpit is wired in). A
 *     painter that reached into the snapshot and wrote nav state would be doing
 *     that once per repaint, on the drawing path, which is where
 *     `setPlayerPosition` — which resets the prism's star loading — must never be
 *     called from. `chromeless` is the one exception and it is a PRESENTATION
 *     flag: it changes what is drawn this frame and nothing that persists.
 *   - NO SECOND CATCH. `PanelHost` owns the reporting. A catch here would swallow
 *     the throw before the place that logs it ever saw it.
 *   - IT DOES NOT SUPPRESS INPUT. `NavComputer._handleClick` derives the level-tab
 *     strip and the autopilot button from canvas geometry, not from whether they
 *     drew, so with the chrome hidden they are still clickable and now invisible.
 *     Nothing in the cockpit routes pointer events at NAV yet; when something
 *     does, that is its problem to solve and this comment is the warning.
 *   - IT DOES NOT DECIDE WHICH LEVELS ARE BARE, and it must not start. See above:
 *     any level read taken here is taken on the wrong side of the render boundary.
 */

/**
 * Build the NAV painter over a nav source.
 *
 * @param {import('../NavSource.js').NavSource} source the hosted nav computer
 * @returns {(screen:object, snapshot:object, nowMs:number) => void}
 */
export function makeNavPainter(source) {
  if (!source || typeof source.render !== 'function' || typeof source.readPixels !== 'function') {
    throw new Error(
      'makeNavPainter: needs a NavSource — something that can render a nav frame and hand ' +
      'back its pixels. Registered without one, the NAV panel would throw on its first ' +
      'repaint, inside PanelHost\'s catch, and then simply stay black with one line in the ' +
      'console to explain a quarter of the cockpit.',
    );
  }

  return function paintNav(screen, snapshot, nowMs) {   // eslint-disable-line no-unused-vars
    // FIRST, and before anything that can throw. See the header: a NAV panel that
    // fails must go black with a cause in the log, never freeze on a picture that
    // still looks like a working nav computer.
    screen.clear();

    // AN INTENT, WRITTEN UNCONDITIONALLY AND WITHOUT LOOKING AT ANYTHING. It says
    // "this host wants a bare screen wherever bare makes sense", and nothing more.
    // Which frames are actually bare is settled inside the nav computer, at the
    // moment it draws, because that is the only moment the level is true — see the
    // header: `render()` moves the level part-way through the frame, so a gate
    // computed HERE is computed from a level the frame has already left behind.
    //
    // It is still written on EVERY paint rather than once at wiring time. The same
    // instance is the game's full-screen overlay under main.js's future wiring, and
    // whoever hands it to the overlay is entitled to clear this flag; re-stating it
    // per paint means the cockpit's intent cannot be silently lost, and re-stating
    // an unconditional truth cannot itself go stale.
    //
    // `source.nav` is a public field on NavSource but it is NOT part of the duck
    // type guarded above, and every stand-in in the tests goes without one. No nav
    // object means there is nothing to write the flag on, which is the correct
    // no-op rather than a throw: the flag is additive and default-off, so a source
    // that cannot receive it draws exactly as it would have.
    const nav = source.nav;
    if (nav) nav.chromeless = true;

    // The panel may have been rebuilt at a new buffer height under us. The source
    // is NOT rebuilt with it — building one means building a NavComputer, which
    // regenerates sectors and reloads a prism of stars — so it is told instead.
    // This runs BEFORE render() for the obvious reason, and after the flag for a
    // less obvious one: the flag has to be on the instance before it draws.
    source.resize(screen.width, screen.height);
    source.render();

    const pixels = source.readPixels();

    // The size agreement used to be checked for us. `ditherToPhosphor` compared
    // its source and its output surface and threw a named error when they
    // disagreed; putting pixels straight through has no such check built in,
    // because putImageData does not have one — hand it a surface of the wrong
    // size and it writes the overlap and returns, leaving a nav map ANCHORED TO
    // THE TOP-LEFT with a black band down two sides, or silently cropped. Either
    // reads as "the nav computer is drawing badly", which is the wrong place to
    // start looking. So the check is kept, explicitly, at the seam that lost it.
    if (!pixels || pixels.width !== screen.width || pixels.height !== screen.height) {
      throw new Error(
        `NavPanel: the nav source handed back ${pixels ? `${pixels.width} x ${pixels.height}` : 'nothing'} ` +
        `for a ${screen.width} x ${screen.height} panel. The source is resized from the panel on ` +
        `every paint, so a disagreement here means the resize did not take — a canvas whose ` +
        `dimensions were reset under it, or a buffer that collapsed to zero.`,
      );
    }

    // putImageData and not drawImage: it writes the source's pixels verbatim, with
    // no smoothing, no transform and no compositing. drawImage would resample the
    // nav computer's one-pixel orbit ellipses and its smallest type into a blur at
    // any scale but exactly 1:1 — and the guard above is what makes 1:1 a fact
    // rather than an assumption.
    //
    // There is no intermediate surface any more. The dither needed one because it
    // WROTE a second image; this puts the source's own ImageData, which is already
    // exactly the panel's size and is reallocated by `readPixels` per call anyway.
    screen.ctx.putImageData(pixels, 0, 0);
  };
}

export default makeNavPainter;
