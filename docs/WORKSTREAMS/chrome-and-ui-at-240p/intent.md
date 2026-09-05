# chrome-and-ui-at-240p — intent

## Why we care

Max, 2026-09-05, immediately after closing the apparent-magnitude arc:

> *"from here, scope out and implement versions of the nav computer, the cockpit, the orbit lines,
> the ui, etc. that match our new resolution scheme."*

This is the last of the seven surfaces the 2026-09-06 inventory named, and it has been queued behind
the starfield by his own ruling since then — *"yes we still need to do this once we figure out the
starfield"*. The starfield is now figured out: resolution is a line count, the close star reads as a
star, and in-system bodies out-read the field behind them. What is left is everything the ship and
the interface put in front of that world, all of which still draws at full native resolution against
a 240-line picture.

The through-line, in one sentence: **the world stopped being modern and the chrome did not.**

## The ruling that shapes the scope (Max, 2026-09-05)

Asked what "match our new resolution scheme" meant, he chose a **per-surface split** and then
overruled the one documented objection:

- **Into the 240p grid:** the cockpit, the orbit lines, the HUD, the reticle, body labels — the
  things the ship *contains*, which belong to the same image as the world.
- **Staying sharp:** the settings panel, the nav computer, body-info text, the title screen — the
  layer you pull *over* the game to operate it, which is not part of the fiction.
- **The cockpit goes in whole, text and all.** `RetroRenderer.js:253` says the cockpit is full-res
  *"because the panels carry text the pilot has to read at 17 degrees"*. He chose "All of it at
  240p" against that note, knowing it means ~5px glyphs on the readouts he uses while flying. The
  era genuinely did this. ⭐ **The constraint is not forgotten, it is overruled** — do not quietly
  reinstate it.

⚠ He accepted the stated risk of the split: **the seam is visible when both are on screen at once.**

## Success criteria (Max's language)

- The cockpit *"matches our new resolution scheme"* — its panels, bezels, dials and its text all
  land on the same pixel grid as the world behind them, rather than sitting on top of it sharp.
- The orbit lines match — the green ellipses stop being crisp vector strokes over a chunky world.
- The HUD and the reticle match.
- The nav computer and the menus **stay legible** — they are the surfaces he operates the game with,
  and the split exists precisely so they do not degrade.
- Nothing he already accepted this session regresses: 240p is still 240p, the close star still reads
  as a star, and in-system bodies still out-read the starfield.

## Non-goals

- ⛔ **The cockpit's PhosphorDither one-ink law.** That is a separate, current, deliberate design
  position (lane F). This workstream is about RESOLUTION only. Do not touch the ink rule.
- ⛔ Re-opening the resolution scheme itself. Line count, aspect derivation and the 31-level palette
  are settled and shipped.
- ⛔ Making the menus or nav computer chunky. That is the explicit other side of his split.
