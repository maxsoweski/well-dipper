# player-ship-lab-2026-10-02 — intent

Increment 1 of the PLAYER SHIP program. Lab-only; cannot break the game.

## Why we care

Max, 2026-10-02, verbatim:

> It should feel 5th gen aesthetic appropriate; it should feel like "woah cool I've never seen that
> kind of ship in a game before"; the cockpit should feel like it doesn't detract too much from the
> environment, and the displays can give you useful info about the system you're in, the
> star/planet/moon/object you've selected, your speed/fuel/status while working with the resolution
> constraints we've chosen

On the current cockpit: "The current one was only ever a placeholder."

On the Steam constraint (governs every AI-made file in this program):

> I have plans to potentially release on Steam in the future; I want to avoid having to tag this as
> made with AI assets. So any models we make this way will be placeholders that I will eventually
> replace with hand-made assets. So, I want that to be easy--the pipeline for development should
> accomodate this future work easily, and should include a "how to" for every model to help me get a
> head start when it comes time for this to redo myself

## Success criteria (Max's language)

- "At base, the way that we would know this is working is if we could, at least in a test mode, fly
  a camera into and out of the cockpit, and the cockpit would feel appropriately sized compared to
  the ship, and the player's view would work inside of the ship and outside of the ship."
- Interior and exterior "actually be one model".
- The cockpit is "basically the bubble cockpit of helicopters format" (reference:
  `reference/cockpit-bubble-rebels.jpg`) — "I don't want all those screens though; I want to plan
  through with you what cockpit displays need to show and design them from there."
- The exterior follows Chris Foss (Jodorowsky's Dune ship concepts). Max chose to give Astra Foss
  images as references.
- Size: "about that size [20 m] still holds … I'm fine if we make the ship slightly smaller to
  accommodate." Bubble: "about [helicopter cockpit] size is right."
- "A very fast animation transition … rather than just a sudden jump"; changing FOV during the
  transition is fine.
- Every AI-made model is a placeholder with a hand-rebuild how-to.

## Decisions ruled by Max this session (2026-10-02)

- Outside camera: behind and a little above the ship, mouse orbits it (like free-look inside).
- Displays show only what the sim really tracks; fuel becomes its own later feature if wanted
  (`src/cockpit/InfoReadout.js:66`: the sim models no fuel, hull, heat, cargo or shields).
- Autopilot: outside = today's cinematic tour with the ship in frame; inside = the same tour from the seat.
- Program shape below accepted; this contract covers increment 1 only.
- Foss: give Astra his images (Max's call, made after working-Claude flagged the derivative-art /
  Steam risk and recommended words-only).

## Program (later increments get their own contracts)

1. **This one — the lab:** display plan, Astra concept sheets, one-piece prelim model, fly-in/out
   test page, placeholder pipeline (interface, how-to, AI register).
2. Two views in HELM: one button, fast animated transition, both views flyable.
3. Per-view behaviour: autopilot framing; burn-target selection on the diegetic display inside vs.
   the ORRERY nav view outside.
4. The displays themselves, at 240p, from increment 1's plan.

## Out of scope

Any `src/` change; wiring into HELM; display rendering; a fuel system; replacing `cockpit.glb`
(that GLB's 46 named nodes are read by `src/cockpit/*` — the new model must learn that interface
in increment 2, not break it here).
