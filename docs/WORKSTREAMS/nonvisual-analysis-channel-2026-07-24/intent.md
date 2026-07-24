# nonvisual-analysis-channel — intent

## Why we care

Max, verbatim (2026-07-24, session-end, alongside the radius-systems directive):

> "We need a way other than visual for you to be able to analyse what's happening in the lab here;
> and once outside of the lab, ditto, for the rendering pipeline. I want you to, after the handoff,
> research how people in game dev do this: how they are able to monitor what's happening in the
> rendering pipeline (when it includes the kind of features we're developing) in ways other than
> simply eyeballing it."

The felt motivation sits under the directive that came with it, also verbatim:

> "We need to get the radius adjustment working with all other systems. Tectonics, craters,
> everything need to adjust to the new radius when adjusted. **I can tell that's not happening
> across the board.**"

That last clause is the whole problem. Max can *tell*. Claude cannot — not without a screenshot and
an opinion about it. Every claim this lane has made about whether a system responds to a driver has
ultimately rested on someone looking at a picture. That produced, in one day: a build that passed
its own gates and then UAT-failed on the first look; and a read-gate whose instrument turned out to
have a ~25 % seed-noise floor, larger than the 15 % effect it was built to certify. Neither was a
coding failure. Both were *measurement* failures.

So this workstream builds the missing sense organ. Not prettier screenshots — numbers, in physical
units, with error bars, over seeds, that can say "tectonics responds to radius with exponent 0.3 ±
0.05" or "volcanism does not respond at all" without anyone squinting at a planet.

## Success criteria (Max's language)

The first is verbatim; the rest are the question-channels Max selected when asked what he wants to
be able to ask the instrument (his selections, my phrasing of the options he picked).

- **"A way other than visual for you to be able to analyse what's happening in the lab."** When Max
  asks what a system is doing, Claude answers with measurements, not a screenshot and a judgement.
- **"Does system X respond to radius?"** — answered per system, with a number and an error bar,
  for all six: substrate/relief, tectonics/plates, bombardment, volcanism, rivers, atmosphere.
- **"Did this change break anything?"** — a change can be checked against a descriptor baseline
  and flag what moved beyond seed noise, which goldens cannot do when procgen legitimately re-keys
  every pixel.
- **"Does it obey the laws we claimed?"** — the scaling laws already written into this codebase
  (crater count ∝ g^0.34, relief/R ∝ g^-0.58, Rhines band count vs rotation) become checkable
  assertions rather than comments.
- **"Why does it look wrong here?"** — a visual complaint at a place on the planet resolves to
  which writer produced the offending number there.
- **"Is this planet plausible at all?"** — descriptors compared against real bodies (Earth, Mars,
  the Moon), so a world can be scored against actual planetary data, not only against our own laws.

## Scope boundaries

- **Game-side pipeline telemetry is a FOLLOW-ON workstream** (Max's call). The "and once outside of
  the lab, ditto" clause of the directive is real and stays open; it gets scoped once the lab
  channel has proven it catches a real defect. This workstream is lab-only.
- **The realism channel carries a data dependency the others don't** — curated real-body reference
  values (hypsometry, published crater SFDs). Flagged at scope as the natural last slice; it is in
  scope, not deferred, but it is the piece most likely to want its own sourcing pass.
- **The instrument is read-only on generation code.** Same arm's-length discipline as the existing
  `_lab` probes: it observes writers, it never becomes one. The single exception is the positive
  control (AC-POSCTRL), which deliberately unwires a driver and restores it.
- **Crystal stays excluded** — standing parking lot, Max directed twice.
- **This never closes UAT.** Descriptors certify laws, not beauty. A planet can pass every
  descriptor and still be wrong to Max's eye, and his eye wins.

## Why this comes before the radius-systems build

Running the response-curve sweep over radius for all six systems *produces* the WIRED / DEFERRED /
IRRELEVANT census that the radius-systems workstream needs as its scope artifact — measured, with
error bars, instead of asserted from reading code. Building the radius fixes first would put their
acceptance criterion ("everything adjusts to radius") back on the eyeball channel that already
failed once this week.
