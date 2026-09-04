# The open follow-up: these eleven are PAINTED OVER the generative model, not grown from it

Max, 2026-09-04, on the live A/B — the UAT that closed this workstream and opened this row:

> **"They work, but worth noting these features are ones that are not yet fully developed (they are
> just applied over the underlying world engine generative models and don't actually communicate
> with that process AFAIK). So they're wired up"**

He is substantially right, and this file records the measurement rather than the impression, because
"doesn't communicate" is not quite true and the part that IS true is sharper than the phrase.

## What communication actually exists

**All eleven read the province cube.** Every one of the combiners calls
`provinceWeight(PROV_<FEATURE>)` (`src/worldengine/shaders/height.glsl.js`), and that function reads
`gProvince` — the craton / orogen / basin weights the BAKE writes from the body's real history
(`writeProvince` → `uProvinceCube`, shipped 2026-09-02, Max: *"it does read as a crust and coheres"*).
`uProvinceWeight` is 1.0 in the game, so the channel is live on all 124 corpus bodies.

Each feature gets its own channel and polarity, which is a genuine physical claim about where that
landform belongs:

| feature | reads | floor |
|---|---|---|
| mountains, canyons, tessera, mass-wasting | `gProvince.x` (craton axis) | 0.15 – 0.30 |
| lava, karst | `gProvince.y` (orogen axis) | 0.10 – 0.25 |
| scarps, plateaus, sublimation | `gProvince.z` (basin axis) | 0.20 – 0.40 |
| dunes, dust | `1 − gProvince.x` — sand seas among crater fields, not young orogens | 0.30 – 0.50 |

**Three of the eleven also read the accumulated surface**, i.e. the bake's own landforms:
karst and dunes take `lowGround` off the running height (they pool in low ground), and mass-wasting
takes the host-slope residual `gradIn − gradBase` (talus banks at the foot of relief that is really
there). Those three are genuinely reactive to the generated terrain.

## What does NOT communicate — the real seam

1. **A 3-channel mask is not a landform.** The province field says "this region is orogen-ish". It
   does not say *there is a range here, on this strike, of this height, because two plates converged
   at this line*. The generative writers produce that specific geometry in the bake —
   `plates.js` writes convergent-boundary uplift and divergent lows, `stagnantLid.js` writes rift
   corridors and corona rims, `shellRelief.js` writes despin-steered lineaments — and **not one of
   the eleven runtime combiners reads any of it.** They synthesise their own independent noise field
   and merely amplitude-modulate it by the coarse mask.

2. **The floors mean the modulation is partial even where it applies.** At `fl = 0.30` a feature
   still renders at 30 % amplitude in a province that says it does not belong there. Dust's floor is
   0.50 — half-strength everywhere regardless of province.

3. **Eight of the eleven ignore the surface underneath them entirely** — mountains, canyons, scarps,
   plateaus, tessera, lava, sublimation and dust read neither the accumulated height nor its
   gradient. A scarp does not know it is cutting a rift; a plateau does not know it is sitting on a
   crater rim; a lava plain does not know which basin it is flooding.

4. **The direction is one-way.** Nothing the eleven draw feeds back into the generative record — no
   province is redrawn, no budget consumed, no history amended. They are a rendering layer.

## What "fully developed" would concretely mean

Not a taste question — three separable pieces of work, in increasing order of cost:

- **(a) Raise the affinity from a mask to a FIELD.** Give the bake a per-feature suitability channel
  written by the same history that writes the province, so `provinceWeight` reads a real
  "mountain-ness here" rather than a craton weight with a floor. Cheapest, and it removes the floors.
- **(b) Make the eight surface-blind combiners read the accumulated relief**, as karst, dunes and
  mass-wasting already do. A scarp that reads the host gradient cuts across real slopes; a lava plain
  that reads `lowGround` floods real basins. This is the one that would most change how the eleven
  READ, and it is mostly shader work against signals that already exist.
- **(c) Have the generative writers place the landforms and the shader only render them** — the
  bake emits strike lines and range crests, the combiner draws along them. This is the honest end
  state and the largest job; it is also what F1 mountains is waiting on from the OTHER side, since
  `plates.js` currently claims 0 of 124 bodies.

⭐ **(c) and the next arc are the same question.** Max's order put F1 mountains — "why does the plate
path claim zero worlds" — after this deck. That is exactly the generative half of (c): the bake has a
range-writing law that no body selects. Answering it is the first real step out of "painted over".

## Status

This does NOT reopen the workstream. Max's ruling framing it was *"much more development is needed
but this lays the groundwork"*, and his UAT is **"They work … So they're wired up"** — the wire is
the deliverable and it is closed. This row is the development the wire makes possible, and it belongs
in the same queue as the river look (*"the rivers are not fully developed but the wiring appears to
be working here"*, 2026-09-02) and the storm and ray looks.
