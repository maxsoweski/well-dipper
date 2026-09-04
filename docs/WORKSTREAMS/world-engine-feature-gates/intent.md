# world-engine-feature-gates — intent

## Why we care

Max, 2026-09-04:

> *"We need to turn off the world engine features that have not yet been developed/worked into the
> pipeline. This should be documented somewhere related to the LoD lab/world engine. And then we'll
> flip them on once developed. **Part of the point of wiring these up is I want to be able to continue
> developing the features in the lab then seamlessly be able to switch them on in game when ready.**"*

The bolded sentence is the actual requirement, and it reframes the wiring pass that just finished.
Wiring a feature into the game was never the same as shipping it. What the wiring bought is the
**ability to ship it later by flipping one value** — and that only pays off if the flip exists and if
the un-flipped state is genuinely off rather than half-drawn.

This is the follow-up he opened in the same breath as accepting the solid-relief deck:

> *"They work, but worth noting these features are ones that are not yet fully developed (they are
> just applied over the underlying world engine generative models and don't actually communicate with
> that process AFAIK). So they're wired up"*

## His ruling on the bar, 2026-09-04

**"Grown from the engine, not painted on."** A feature is ON in the game only if it reads the bake's
actual accumulated landforms — not merely the province mask with a floor under it.

He chose this over two alternatives (off = anything whose LOOK he hasn't passed; off = only the
provably dead), and he chose it **having been told the cost**: it removes most of the landform detail
he accepted the session before, and the game will look barer until each feature is developed.

## Success criteria (Max's language)

- The features that are just painted over the world engine are off in the game, and the game still
  looks coherent — barer, but nothing broken or half-drawn.
- I can carry on developing those features in the lab exactly as before; turning them off in the game
  changes nothing about the lab.
- There is one place that tells me, per feature, whether it is on in the game and what it is waiting
  for — and it lives with the world engine, not in a handoff.
- When a feature is ready, switching it on in the game is one change, not a re-wiring job.

## Deliberate non-goals

- **NOT developing any of the eight.** The three jobs that would make them "grown from the engine"
  are already written up (a per-feature suitability field; making the surface-blind combiners read
  the accumulated relief; having the generative writers place the landforms) in
  `WORKSTREAMS/solid-relief-deck/FOLLOWUP-not-fully-developed.md`. This workstream builds the switch
  and throws it; it does not do that work.
- **NOT a lab change.** The lab is where development continues, so it keeps every feature on.

## The one thing to get right, or this is worse than nothing

⛔ **An OFF switch that does not actually stop the render is a lie that looks like a feature**, and it
would be believed — the whole point is that Max stops thinking about these until he flips them on. So
every gate must be proven to control the render by SABOTAGE, not by reading the flag back: turn it
off, measure that the feature's contribution is gone; turn it on, measure that it returns. A gate that
has never been shown to bite is not a gate. (Same discipline as the volatile-delivery attribution
control and the `identical-output-needs-a-liveness-probe` rule.)

⚠ **Every OFF row is DEBT, not a decision.** Per `converge-dont-declare-divergence`, a lab/game
divergence is debt until proven otherwise. It is sanctioned here because it has a named exit — each
row records what it is waiting for — but a row that sits OFF for months with nothing moving is a
defect in this workstream, not a steady state.
