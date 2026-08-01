# cockpit-zoom-to-panel-2026-07-29 — intent

**Lane F, increment 6 of the HELM cockpit ladder.** The last increment before the
cockpit gets wired into the game. Program state:
`~/.claude/projects/-home-ax/memory/well-dipper-cockpit-program.md`.

Opened as its OWN workstream rather than as an amendment to
`cockpit-screen-content-2026-07-28`, deliberately: that contract is `status: building`
with `AC-NOTHING-I-HAD-GOT-LOST` still open at the `uat` layer. Folding increment 6
into it would mean Max could not close a gate on work he has already seen without
also signing off work that did not exist when he looked.

## Why we care

Max, 2026-07-29, on what stands between the cockpit and implementation:

> "The only thing that seems to be separating us from there is a system by which the
> screen will move up to fill the player's view, centered, so we can interact with
> the full menu. This is only necessary for the upper-left monitor. But let's make
> the system for moving around these screens flexible so that it will not need to be
> totally reworked if we update the position of the screens in the future."

The shape of it was set when lane F opened, 2026-07-28:

> "I want the monitors to display stuff in a default helm view, but then be able to
> select them with my cursor/a hotkey and have that screen move towards the camera's
> POV to center it/zoom it in for easier interaction."

Note what travels: **the SCREEN goes to the eye, not the camera to the screen.**

This increment is load-bearing rather than a nicety, and became so on 2026-07-29 when
Max reversed the H4 dither decision for NAV:

> "we don't need to show the text and buttons unless we 'expand' that menu by
> bringing the screen closer to us through selecting it."

NAV at rest is now chrome-less on purpose. Without a zoom there is no route to the
text and buttons at all — the nav computer's ~3,000 lines of interaction surface are
unreachable, and with them the warp commit that closes the whole loop.

## Success criteria (Max's language)

- **"the screen will move up to fill the player's view, centered"** — the upper-left
  monitor travels to the eye and parks centred in view, big enough to work.

- **"so we can interact with the full menu"** — the zoomed screen is the nav computer
  as it exists today: all five levels, the tab strip, planet and component detail,
  the autopilot toggle, and the `[ BURN ]` / `[ WARP ]` commit. Clicking things works.

- **"only necessary for the upper-left monitor"** — NAV is the only panel wired to
  zoom. DRIVE, TARGET and INFO stay where they are.

- **"flexible so that it will not need to be totally reworked if we update the
  position of the screens in the future"** — re-fitting screen geometry in lane E and
  regenerating the GLB must require **no edit** to the motion code. Every pose is
  measured off the loaded mesh, never written down. This is the constraint with teeth:
  lane E is still moving the screens.

- **Whole monitor, not just the glass** (chosen 2026-07-29 from three mock-ups):
  `Screen_UL` and its housing `ScreenBody_UL` travel together, so a physical monitor
  swings in rather than a pane of glass detaching from its bezel. The arm stays behind.

- **"After we bring up the nav computer, esc should just dismiss it, retracting it
  back to its original position. Let's change the behavior so we just manually click
  through the different nav levels and esc is not wired to that function."**
  Ruled on 2026-07-29, and ruled to apply **everywhere** — the cockpit panel *and* the
  full-screen ORRERY overlay — so ESC has one meaning wherever the nav computer is
  drawn. Level navigation becomes click-only, via the tab strip.

## Deliberate non-goals

- **Keyboard on the zoomed panel.** `NavComputer.activate()` is not called. It buys
  keyboard navigation and the search box, but search is a DOM overlay that
  `_ensureSearchDom` refuses to build on a canvas with no `parentElement`, and
  `activate()` registers capture-phase handlers that swallow W/A/S/D/R/F. Mouse alone
  reaches the whole menu. Keyboard is its own question, later.

- **Right-click as "back".** `NavComputer._handleClick` treats `e.button === 2` as an
  escape; the synthetic panel event carries no `button` by design, so it is already
  inert on the glass and stays inert. Consistent with unwiring ESC from level
  navigation.

- **Zooming the other three panels.** The mechanism is built generically because it
  costs nothing extra — it reads `panel.metrics` like everything else in lane F — but
  only NAV is wired to a trigger.

- **The §6 debt from the previous handoff** (the chrome-less source scan is evadable
  seven ways; a render-based regression test was proved possible with a stub canvas).
  Real, not dropped, and not folded in here — it would roughly double this workstream.
  It is the next piece after this one.
