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

## DOES / UNLOCKS card

Per the standing world-engine convention (Claude memory `feedback_worldengine-does-unlocks-map`,
linked not pasted per Rule 12). This increment emits no world fields — it emits *measurements of*
world fields — so the DOES table reads one column over.

**What it DOES**

| Emits | Measured from | What it lets someone see |
|---|---|---|
| RMS relief (km), hypsometric integral, slope distribution | live height field via float-RTT readback | how rough / how high the mass sits, in km, comparable across radii |
| dominant wavelength (km), spectral slope | radial PSD / autocorrelation of a patch | **how big the forms are** — the number the radius question turns on |
| crater SFD slope + density per 10^6 km^2 | crater population on the sampled surface | whether bombardment answers gravity as the g^0.34 law claims |
| drainage density, boundary density (km per 10^6 km^2) | channel / boundary masks, metric pair-summed | whether rivers and tectonics answer radius |
| zonal band count | latitude profile of the atmosphere field | whether banding answers rotation and radius |
| exponent +/- SE per driver, three-valued law verdict | the ensemble across N radii x M seeds | whether a claimed law holds, fails, or is unresolvable at this sample size |

**What it UNLOCKS**

- **The radius-across-all-systems workstream** consumes AC-CENSUS directly — it is that workstream's
  scope artifact, replacing "read the code and assert" with "measure and tabulate."
- **Every future perceptual AC** consumes the ensemble machinery: `requiredSeeds` / `seedsToResolve`
  now compute the sample size BEFORE a bar is set, which is the specific failure the read-gate hit.
- **The game-side pipeline telemetry follow-on** consumes the same descriptor pack, pointed at the
  shipped render path instead of the lab's.
- **The read-gate's own retired instrument** is superseded: `autocorrWavelengthKm` is the
  same-pattern feature-tracking metric that `DIAGNOSIS.md` rec #3 named and never got built.

## AC-0 spine conformance (Rule 15)

1. **Driver connectivity.** The instrument introduces NO new drivers and routes on no archetype
   string. It reads (a) the live uniform set already derived by `deriveUniforms` from D-slots, and
   (b) published law constants (`Q_RELIEF`, `RELIEF_FLOOR/CEIL`, the v2-6 g^0.34 crater law). The
   sweep axis — radius — is D-slot backed and reaches the systems through gravity exactly once, per
   the v2-6 coherence resolution.
2. **Named consumer.** Every descriptor emitted is read by a named consumer in this contract:
   AC-CENSUS (the census table), AC-LAWS (the law registry), AC-REGRESS (the baseline store),
   AC-DIAG (the point dump). No descriptor is computed without a reader.
3. **Taxonomy registration.** The instrument adds console `_lab.*` API only — no `state.*Enabled`
   feature card, no preset, no GLSL province entry. Taxonomy-exempt on the same ground as the
   province debug overlay, and the `tests/planet-archetypes.test.js` drift guards stay green
   (verified: full suite at exact baseline).

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
