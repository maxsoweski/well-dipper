# chrome-and-ui-at-240p — intent

## Why we care

Max, 2026-09-06, when the cockpit's type scale turned out not to survive 240p:

> *"I want the whole game to read as a 5th gen game (there are things that are going to be
> anachronistic and I'm totally fine with that, but some things like the resolution are harder
> limits to get that aesthetic); so we simply need to redesign anything that does not read properly
> at this new resolution; if that's true of the in-game hud and nav panels etc. then that's where we
> go next."*

⭐ **THAT SENTENCE IS THE WHOLE SCOPE DISCIPLINE, AND IT INVERTS THE USUAL ONE.** The resolution is
not a cost to be worked around; it is the hard constraint everything else bends to. When a surface
does not read at 240p, the answer is to **redesign the surface**, never to exempt it from the
resolution. Anachronism elsewhere is explicitly fine — he said so — so nothing here needs to argue
about period accuracy in general. It only has to hold the one line that is not negotiable.

⛔ **THIS RETIRES THE "EXEMPT THE TEXT" OPTION BY NAME.** It was offered and not taken. Do not
reintroduce it as a fix when a panel proves hard to read; that is the failure mode this paragraph
exists to prevent.

The immediate occasion: this is the last of the seven surfaces the 2026-09-06 inventory named,
queued behind the starfield by his own earlier ruling — *"yes we still need to do this once we
figure out the starfield"*. The starfield is now figured out: resolution is a line count, the close
star reads as a star, and in-system bodies out-read the field behind them. What is left is
everything the ship and the interface put in front of that world.

## The ruling that shapes the scope (Max, 2026-09-05)

Asked what "match our new resolution scheme" meant, he first chose a **per-surface split**, then
overruled the one documented objection, and then — when the arithmetic came back — replaced the
split's *rationale* with the harder rule above. The surviving reading, which both his messages
support: **everything IN-GAME goes to 240p and is redesigned if it fails there; the out-of-game
harness does not.** His qualifier was "the in-game hud and nav panels"; the settings panel and
title screen are the harness you use to configure the game, not the game.

- **Into the 240p grid:** the cockpit, the orbit lines, the HUD, the reticle, body labels — the
  things the ship *contains*, which belong to the same image as the world.
- **Staying sharp:** the settings panel and the title screen — the out-of-game harness.
- ⛔ **THE NAV COMPUTER MOVED SIDES, AND IT HAD TO.** The first split listed it as staying sharp.
  That was not implementable: `main.js:5630` `liveNavComputer()` returns the COCKPIT panel whenever
  the cockpit renders, and `main.js:5900` says it outright — *"IN HELM THE NAV COMPUTER IS ON THE
  GLASS ... There is no overlay to show."* The DOM overlay is only the ORRERY / failed-GLB fallback.
  So "cockpit at 240p" and "nav computer sharp" named the same pixels. Under the rule above it
  coarsens with the cabin and gets **redesigned until it reads**.
- **The cockpit goes in whole, text and all.** `RetroRenderer.js:253` says the cockpit is full-res
  *"because the panels carry text the pilot has to read at 17 degrees"*. He chose "All of it at
  240p" against that note. ⭐ **The constraint is not forgotten, it is overruled** — do not quietly
  reinstate it.

⚠ **AND THE NUMBER HE APPROVED WAS MINE AND IT WAS WRONG BY 2x.** I told him "~5px glyphs". The type
scale is fixed ratios of panel height (`PhosphorScreen.js:194-200`: display H/6, body H/17, label
H/20) and the panels are 0.20 m tall at 0.800 m from the eye — measured off `cockpit.glb` from its
own Eye_Point, and re-read here from `public/assets/cockpit/cockpit-metrics.json` rather than from a
comment.

⛔ **AND MY FIRST NUMBER WAS 14% TOO HIGH, BY THE EXACT MISTAKE THIS REPO ALREADY WARNS ABOUT.** I
computed `14.25/70 x 240` = 48.9 rows. That is the ANGULAR fraction, and a perspective projection is
not linear in angle — it is linear in TAN. `panelPose.js:34-49` writes both forms out under the
heading "PIXEL FRACTION, NOT ANGULAR FRACTION" and says plainly that "solving the angular form
yields a panel that measures correct on a protractor and looks wrong in the cockpit". The right form
is `(0.10/0.800) / tan(35 deg) x 240` = **42.84 rows**, confirmed by projecting all four measured
corners through a 70-degree camera. So the tiers are:

| tier | ratio | buffer px at 240p | what I first told Max |
|------|-------|-------------------|-----------------------|
| display | H/6 | **7.14** | 8.1 |
| lead | H/11 | **3.89** | 4.4 |
| body | H/17 | **2.52** | 2.9 |
| label | H/20 | **2.14** | 2.4 |

⚠ It is WORSE than he was told, not better, and it does not change his ruling — he generalised
rather than retreating, and the generalisation is what governs. But every downstream number must be
derived from 42.84, never 48.9. The tiers he actually
reads are at half the figure he was given, and `PhosphorScreen.js:81` already calls H/20 "THE
FLOOR". Re-put to him with the real arithmetic, he did not retreat — he generalised, which is the
quote at the top of this file.

⚠ Note the trap in that arithmetic: the glyphs' PHYSICAL size on screen barely changes (2.4 buffer
px x 4.708 magnification is about 11 screen px, which is what they are today). What collapses is the
number of pixel ROWS available to draw a letterform, and two or three rows cannot make a legible
letter at any magnification. Size is not the problem; resolution is.

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
