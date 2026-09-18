# nav-defects-batch-2026-09-18 — intent

## Why we care

Max, 2026-09-18, after tinkering with the two new 240p nav menus:

> *"From tinkering with the new system, a few issues arise 1. The 3D prism appears too simplistic
> to read now; 2. The 2D system menu doesn't really work intuitively; it's hard to scroll and get
> info; I want you to really look at all the functions of the new menu, what every click and
> keypress does compared to the functionality that is intended in each screen and across the
> transitions between screens and see what should be updated for ease-of-use, visual legibility,
> and consistent workflows across the different screens."*

The audit that answered him (`docs/FEATURES/nav-menu-map-old-vs-new.html`, artifact
https://claude.ai/artifact/F8Ut2bLQbK4hh5V8TJ27UY) split what it found into two groups: twelve
**defects** with no design question inside them, and eleven **restorations** from the old nav that
each need his yes/no/park. He ruled on the split:

> *"1 yes (use subagents/workflows) 2 I need to review first 3. Yes; after 1 and 3 write a handoff
> to a fresh session"*

So this workstream is group A only — the twelve defects — built by agents. The restorations
(items 13-23 on the page) are NOT here; they wait for his review.

**The through-line:** every one of these is a control that lies to the pilot — drawn armed but dead,
bound but invisible, a gesture that outruns the pointer, a selection that cannot be cleared, a
guarantee ("the old nav is byte-identical") that stops holding after one keypress. Fixing them changes
no picture he ruled on; it makes the pictures tell the truth.

## Success criteria (Max's language)

The page's own wording, which he approved with "1 yes":

1. The commit row (design 1) and the WARP chip (design 2) are drawn armed on every screen but only
   answer a click at SYSTEM → **the click does what Enter does.**
2. The selection never clears: with nothing picked, both designs frame a fallback body and say
   BURN TO it; picking the star leaves the frame on a planet → **a real no-selection state, and a
   star selection that the frame follows.**
3. The 2D maps outrun the pointer when dragged: 1.35× in design 1, 1.4× and 2.6× in design 2 →
   **scale by the drawn map.**
4. A drag that starts on the rail, the tabs, the status line or the commit row still pans or
   rotates the map → **only a press on the map starts a gesture.**
5. Keys act on screens where nothing shows it: `,` `.` on every design-1 screen; `L`, `[` `]`,
   `-` `=` on four of five design-2 screens; and `L` on a 2D screen arms invisible list rows that
   steal map clicks → **each key bound only where it draws something.**
6. After one `V` cycle the old nav opens its prism and orrery at the designs' angles, not its own
   (measured live) → **restore the old defaults on the way back.**
7. Right-click "go back" is dead in every look → **bind it properly.**
8. Under the designs the × close button is off-screen and the backdrop cannot be clicked →
   **fix the CSS.**
9. HERE · SECTOR at SYSTEM clears the body selection instead of doing nothing → **eat the click**
   until he rules what it should do there.
10. Multiple-star pips never draw and the COMPS sort does nothing, because the field they read is
    never filled → **fill it.**
11. Design 1's tab band and commit bar overlap by one texel; at SYSTEM the tab wins the commit's top
    row → **move the bar down one texel.**
12. Hidden controls with no legend: `V` everywhere; `/` on design 1's PRISM and SYSTEM; `R` `F` on
    design 1's PRISM; the sort key and page keys in design 2; any legend at all on design 2's SYSTEM;
    Shift+Tab → **print them.**

## Non-goals

- ⛔ The eleven restorations (hover-inspect, prism depth cues, names, planet detail, ship position,
  SYSTEM wheel zoom, belt names, one zoom readout, autopilot, design-2 handles). His review first.
- ⛔ Any picture change beyond what an item names. "Print them" (12) and "move the bar down one
  texel" (11) are the only two that touch the lab, and both go through
  `scripts/extract-nav-designs.mjs`.
- ⛔ Touching the cockpit panel instance.
