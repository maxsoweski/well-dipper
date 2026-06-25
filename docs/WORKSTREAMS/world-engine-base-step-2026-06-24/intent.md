# world-engine-base-step-2026-06-24 — intent

WS2 of the production-L1 port (lab-only; see `docs/FEATURES/world-engine-production-L1-plan.md`).
Branch: `feature/world-engine-production-L1`. Consumes WS1 (`world-engine-l0-plumbing-2026-06-23`).

## Why we care

> "This underlying why remains that we need a programmatic way of writing the 'history' of a
> planet based on the foundation set by the galactic generation engine, and this new world engine
> is how we do that. Then, the rendering pipeline 'reads' that history by rendering the outputs
> visually."
> — Max, 2026-06-24.

The through-line is a **write-side / read-side** split: the world-engine **writes** a planet's
history; the renderer **reads** it. WS1 made the L0 drivers *real* (computed, surfaced, tested).
WS2 is the first step where those drivers stop being inert data and start being **written into
history** — a thin L1 derivation layer (the "base step") that consumes WS1's outputs and derives
the structured fields the relief engines need: orientation/grain, an Anderson stress regime, a thin
interior field. It is the write side doing its job. The visible "read" payload — a planet that reads
as a landscape with a history — lands at **WS4**, when these fields drive the renderer. WS2's own
visible milestone is the **interim field-viz** (below): see the L0→L1 layer directly, before WS4.

## Scope (Max, 2026-06-24)

- **WS2 = F1 (base-step interface) + F2 (L0 consumption adapter) + F4 (orientation/stress field) +
  F7 (determinism + verifier gate)** — all full; **F3 (sphere field carrier) and F5 (thin interior
  field) THINNED**; **F6 (field-topology) DEFERRED** (no first-wave consumer).
- New `src/worldengine/base/` tree; **`src/generation/` stays untouched** (Option A).
- **Include the interim field-viz** as a thin NEW page that reads the *production* base-step output,
  so the L0→L1 fields are visible before WS4.

## Success criteria (Max's language)

- The world-engine **WRITES a planet's history programmatically** from the L0 foundation — the
  now-real drivers (tidal heat, age, magnetic field, the system graph) become structured fields a
  relief engine can read: which way the grain runs, what kind of faulting a place gets, how thick
  the crust is.
- **Switch to a different kind of world and you get categorically different fields** — not recolored
  noise.
- **I can SEE the L0→L1 layer:** an interim field-viz paints the derived grain / stress regime /
  crustal thickness so I can eyeball that the derivation is real and sensible, before any relief is
  rendered.
- **Same world, same seed → byte-identical fields** every time; a verifier proves the fields are
  finite, bounded, seam-consistent, and physically ordered (equator→thrust, mid-lat→strike-slip,
  pole→normal).
- **Nothing in `src/generation/` changes;** WS1's outputs and the save/serialization path stay intact.

## Notes (technical defaults applied during scope; revisitable in the plan)

- Magnetic-field lock-predicate cleanup kept **separate** (lives in `src/generation/`; real behavior
  change to 3:2-resonance atmosphere; already deferred in WS1).
- Interior field stays **in the base step** (extraction-to-E0 criterion written into the module).
- Base step **prefers upstream `tidalHeating`** over recompute; **quantized grain port** `{0, π/2}`;
  age normalized `/~10 Gyr`; tidal calibration via a **tanh knee** (Io anchored mid-range, strictly
  ordered, non-saturating — a tunable constant); F7 verifier gates on the F2-adapter output **plus**
  the 5 relief presets pinned as fixtures; `loveK2` surfaced as a bounded ordered proxy.

Scope grounded by a 17-agent code-grounding + adversarial-verify workflow (`wf_03004682-2bd`,
2026-06-24); dossier in the session scratchpad.
