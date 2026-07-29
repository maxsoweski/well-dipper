# world-engine-tectonic-realism-2026-07-29 — intent

## Why we care

Max, opening the parent program (2026-07-28):

> *"fix this all such that 1. Plate tectonics work across all sizes of planets 2. Craters work
> across all sizes of planets 3. Make sure these are all being programmatically generated and
> aren't being patched on"*

Item 3 is the acceptance criterion for the other two, not a nice-to-have. A clamp that flattens a
symptom is the failure mode, not the fix.

Then, ruling out the cosmetic route when told the tectonic pattern is faded out of the render
above R ≈ 2 (2026-07-29):

> *"let's not worry at this point about what would make tectonics read as being there when we know
> they aren't there. Let's just get them working. The tectonics system exists to do more than
> create terrain height variation."*

And the criterion for the whole thing:

> *"success here means simply that we can model earth-like planets (or any planet that has tectonic
> activity) in a way that makes the features read realistically as they would from space. This is
> the basis for all sorts of downstream systems, e.g., water cycle."*

> *"keep in mind that from space we can zoom in and look more closely at these features (in the
> current lab we can do this and get quite close to the terrain)."*

On the measurement and calibration half:

> *"1. We should be able to measure the height of mountains 2. We still need to fix the vertical
> calibration"* … *"I want honest numbers and honest renders."*

**The through-line for scope discipline:** what makes a planet read from space is *structure* — plan-form
of belts, coastlines cutting a bimodal hypsometry, material keyed to real geology — not vertical
amplitude. Earth's relief is 0.31% of its radius. Any time this workstream is tempted to reach for an
amplitude knob to fix an appearance problem, that is the patch-on-top behaviour item 3 forbids.

## Success criteria (Max's language)

- **"We should be able to measure the height of mountains."** A km figure for mountain relief that
  describes the body actually being rendered, not a dead constant and not a confident wrong number.
- **"We still need to fix the vertical calibration."** The vertical axis carries a real unit, derived,
  and it is a function of radius and gravity rather than a literal — because it demonstrably is one.
- **"I want honest numbers and honest renders."** The render's vertical exaggeration becomes a single
  declared, derived, tested constant stated alongside the true km — exaggerating on the record instead
  of by drift. Currently it is ~160×, arrived at through an undocumented artistic slider.
- **"The tectonics system exists to do more than create terrain height variation."** Tectonic emissions
  that already exist and are wired only to debug instruments — the craton/orogen/basin province field,
  boundary classification, boundary orientation — reach the render and change what the world is made
  of and how it is laid out, not merely how tall it is.
- **"Plate tectonics work across all sizes of planets."** Across the radius band, for the presets that
  reach a tectonic writer — with no magic clamp standing in for physics anywhere in the chain.
- **"Features read realistically as they would from space"**, holding when you zoom in to the lab's
  camera floor (1.1 radii from centre ≈ 637 km altitude at Earth scale — everything here is orbital).

## Scope boundary (ruled by Max, 2026-07-29)

**IN:** plate emissions → real province field → `gProvince`; bimodal hypsometry (so the existing sea
level lands coastlines and shelves correctly); boundary orientation → range strike; km-honest vertical
axis + measurement; declared exaggeration.

**OUT:** water cycle, clouds, ice caps, vegetation, new albedo/biome systems.

**Body set:** the 8 presets that reach a tectonic writer today — Rocky (Earthlike) and Ocean (temperate)
on the plate path; Europa, Titan and Eyeball on the shell path; Lava and Magma on the volcanic
heat-pipe path; Venus on the stagnant-lid path. Across the radius band.

**Named finding, deliberately deferred:** Mars routes to `despun` — the latitude-band despin/radial-strain
model — not to a plate writer, despite having real tectonic features. Changing that means reopening
adjudicated dispatch reroute decisions, which would swallow this workstream. Filed, not actioned.

## The structural fact this workstream exists to fix

There are **two** tectonic models in the repo and they do not speak to each other. The plate model
(`plates.js`) serves 2 of 18 presets and decides **where** things are. The despun latitude-band model
(`tectonic.js`) serves 10 and decides **which way they run** — and the grain cube it bakes orients
mountains, canyons and scarps on *every* dispatch path, including the plate path. So a plate world's
ranges are correctly placed and arbitrarily oriented. The per-edge boundary normal and tangent needed
to fix this are computed at `plates.js:289-291` and discarded.

Meanwhile the renderer already has the socket the plate system belongs in: `gProvince` gates ~48
features' amplitude and albedo and its three fields are literally named *tectonic, volcanic, ancient*.
They are FBM noise of position. The real province field is computed on every route and displayed only
in a hidden debug overlay. `planet-lod-lab.html:1500` says so in source: "the V2-9 gProvince rewire is
a separate job." This is that job.
