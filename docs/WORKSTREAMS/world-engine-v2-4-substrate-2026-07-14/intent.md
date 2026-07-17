# world-engine-v2-4-substrate-2026-07-14 — intent

## Why we care

Max (2026-07-14): "The roadmap's checkpoints here ARE the things missing. We've set up a
basic process for creating planet-scale landforms but A. They're still very rough/primitive
B. The planets themselves mainly still look like balls of clay; we have already specified
WHY we have this world engine — we don't need to re-litigate this."

V2-4 is the groundwork those missing checkpoints stand on: the five shared-substrate fields
that V2-5 bombardment (craters), V2-7 epochs, V2-8 sculpting, and V2-9 palette/inhabitation
all READ. The "balls of clay" complaint is what those expression increments fix — V2-4 is
their host, and is judged as groundwork, not expression.

**Line of sight → north star:** distinct, history-coherent worlds per minute. V2-4 is the
program's explicit guard against later increments becoming "a bag of overlays divorced from
history" (ROADMAP §3.2 #5.5 row) — every substrate field ties downstream expression to the
world's actual structural history.

## Success criteria (Max's language)

- **Margins (the one visible surface):** "It should look like coastlines on Earth do from
  space, as a start." And per-world character: "probably the coastline will need to differ;
  this is why we set up all these procgen variables" — margin form responds to the drivers,
  not one stamped template.
- **Clean records (Max's condition for the invisible plumbing):** "That's fine if it's
  plumbing so long as we have clean records specifying function and where it lives in the
  procgen/rendering pipeline" — every substrate field ships with a written record of its
  function, its position in the write→read pipeline, and its named consumers. Contractual
  (AC-DOCS), not aspirational.
- **History-tied, not noise (the program's own honesty bar):** the province field must
  provably track the world's structural history — a shuffled/independent-noise province
  must FAIL the association test.

## Explicitly NOT this increment

- Making planets stop looking like "balls of clay" — that's V2-5/V2-7/V2-8 expression work
  on top of this substrate (the UAT gate carries this carve-out verbatim).
- Visible oblateness/triaxial render — figure ships as a DESCRIPTOR for V2-7 CYCLE-2; the
  body-shape render path doesn't exist and building it collides with the concurrent atmo
  branch's shader territory. Parked as its own later item.
- Rewiring the shader's noise-based `gProvince` — that's V2-9's job (palette derives from
  province there); V2-4 ships the history-tied field + a lab debug overlay.

## DOES / UNLOCKS (Rule 15 card)

**DOES:** adds carrier.sediment + carrier.accommodation (new host channels); extracts the
four copy-pasted `steeredNoise3` stress-fabric writers into one owned module (byte-identical,
V2-7d mold); writes passive continental margins (shelf/break/slope) as an own-channel
composite at continent/ocean boundaries; derives a history-tied province field (+ lab
debug overlay) from faultDensity/grainMag/accommodation; computes the E2-figure descriptor
(driver-originated w0 + flattening + present-vs-fossil axis) with D8 rotation newly plumbed
into the condition vector.

**UNLOCKS:** V2-5 bombardment (host channels + dead-lid placement), V2-7 epochs (figure
descriptor for CYCLE-2 figure↔grain; sediment for the volumetric budget), V2-8 sculpting
(accommodation sink-ranking + margins + province), V2-9 palette/inhabitation (province).
