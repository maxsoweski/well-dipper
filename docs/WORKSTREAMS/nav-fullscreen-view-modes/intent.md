# nav-fullscreen-view-modes — intent

## Why we care

Max, 2026-09-06, after two sessions were spent making the 43-row cockpit nav panel legible:

> *"we're doing this the wrong way, though...we need to begin by making these nav computer screens
> work in fullscreen first (the N menu) then figure out how to represent that in the diegetic
> screens. What you've done here is fine for now."*

⭐⭐ **THE FULL-SCREEN NAV IS THE SOURCE; THE COCKPIT PANEL IS A REPRESENTATION OF IT.** The panel
work is accepted (*"fine for now"*) and must not be reverted — but it is a derivative of a design
that only ever existed at desktop resolution, and the source has never been drawn at the game's own
resolution. This workstream draws the source.

Then, against a rendered lab of three designs (`nav-240p-lab.html`, `b7c8155`):

> *"1. I love both 1 and 2 for both; I want all of these modes! 2. We keep both for now
>  3. going forward for all these menus and main gameplay I only need 240, 288 and 360 as
>  comparison options"*

And the through-line that governs every surface in the game, from the predecessor workstream and
still open as its AC-9:

> *"I want the whole game to read as a 5th gen game ... we simply need to redesign anything that
> does not read properly at this new resolution"*

## The fact that reframes the job

⭐ **THE FULL-SCREEN NAV IS NOT AT 240p AND NEVER HAS BEEN.** `NavComputer._resizeCanvas()`
(`src/ui/NavComputer.js:612-618`) sets `canvas.width = rect.width` off `getBoundingClientRect()`,
with no `bufferForLines()` and no devicePixelRatio multiply. Over its `calc(100vw-40px) x
calc(100vh-40px)` box that is ~1560x860 on Max's display — **3.58x the world's line count** drawing
vector type over a 240-line world.

So "make the fullscreen nav work at 240p" is not a redesign sitting on working plumbing. The
plumbing does not exist. Three things have to happen and only the third is a design:

1. the overlay has to render into `bufferForLines(...)` and upscale `pixelated`, the way the world
   canvas and the lab both already do;
2. `navLayout`'s chrome has to stop saturating above it — every function saturates at **h >= 160**,
   so a 240-row buffer inherits the DESKTOP numbers verbatim: `navTabHeight(240) = 32` (13% of the
   rows for a tab strip), `navMapSize(427,240) = 160` (a 160x160 square inside a 427-wide frame);
3. the two designs Max ruled on become switchable view modes on that surface.

## ⛔ The constraint that shapes the architecture

**`NavComputer` is ONE class serving TWO surfaces** — the DOM overlay and the cockpit glass. The
panel's picture is accepted and frozen (*"fine for now"*), so the mode selector must be a
**per-instance axis**, defaulting to today's renderer on the panel.

⛔ **NOT `_bare`.** It is `chromeless && level === 'system'`, and `NavPanel.js:222` writes
`chromeless = false` unconditionally every paint under Max's 2026-08-01 ruling, so `_bare` is
permanently FALSE on the panel at every level. Keying a mode off it is a no-op that looks exactly
like a wiring failure. The axis to copy is `dimSurface` (`NavComputer.js:205-216`, whose own comment
records that mistake being made once and corrected).

⛔ **A FIELD COMES OFF THE GLASS, NOT OUT OF THE PIPELINE** — Max, 2026-09-08: *"don't get rid of any
code that allows you to display what we want to display."* A mode may choose not to DRAW a string.
No mode may make a string unproducible.

## Success criteria (Max's language)

- The nav computer he opens with `N` reads as part of the same picture as the world — *"the whole
  game reads as a 5th gen game"* — instead of a sharp vector overlay at 3.6x the world's lines.
- *"I want all of these modes!"* — designs 1 and 2 are both there, on the full-screen nav, and he can
  flip between them.
- Flipping a mode is a **keypress in the running game**, not a console command and not a screenshot.
- The three resolutions he kept — *"only 240, 288 and 360"* — all work, and the nav is drawn for the
  one that is set.
- The cockpit nav panel he already accepted (*"this seems good to me for now"*) is unchanged.
- Picking a destination and jumping still works, from every door the nav opens through.

## Non-goals

- ⛔ **Design 3.** Killed by all three judges for deriving the fullscreen from the 52x43 panel — the
  exact inverse of Max's ruling. Do not resurrect it.
- ⛔ **Re-raising whether GALAXY / SECTOR / REGION earn their place.** Max ruled *"We keep both for
  now"*. It reopens only if he raises it.
- ⛔ **Redesigning the cockpit panel.** That is the *representation*, and by ruling (a) it follows
  from whatever lands here. Not this workstream.
- ⛔ Re-opening the resolution scheme, the line-count list, or the palette. Settled and shipped.
