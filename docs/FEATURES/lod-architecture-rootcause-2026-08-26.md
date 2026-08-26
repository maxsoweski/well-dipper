# How the LOD transitions actually work — and why none of the knobs helped

**Max, 2026-08-26:** *"I feel like you're taking stabs in the dark here and need to take a step back
and think about how the LOD transitions are working."* He was right. This is the step back.

Reproduce with `node tools/lod-chain-probe.mjs`.

---

## 1. THERE ARE THREE MECHANISMS AND THEY ARE NOT INDEPENDENT

| # | mechanism | driven by | its proper job |
|---|---|---|---|
| 1 | **octave budget** `mix(4, 9, smoothstep(20, 6, d))` | **distance** | art direction — *when* detail appears |
| 2 | **fwidth fade** `1 - smoothstep(bar, bar, footprint*freq)` | **screen frequency** | anti-aliasing — never draw what would shimmer |
| 3 | **the wavelength law** `uNoiseScale` | body physics | sets where 1 and 2 both land |

## 2. ⭐⭐ THE FADE DECIDES AT EVERY DISTANCE. THE BUDGET NEVER BINDS.

Measured at every distance from 20 radii to 1.3, before and after the extrapolation bound: the
budget allows 4–9 octaves and the fade permits **0–4**. The budget is never the tighter constraint,
so it is decorative.

⭐ **Consequence: "how fine is the terrain" and "when does detail appear" are the same knob.** Both
are screen frequency. That is why coarsening the law for sense-of-scale *also* made detail arrive
further out — a bigger feature clears a screen bar from further away. **It is not a bug and no
setting of the law or the bar can separate the two.** Max hit this immediately and correctly.

## 3. ⭐⭐⭐ BUT THE REAL ROOT CAUSE IS UPSTREAM: THERE IS NO LOD HEADROOM TO SPEND

An LOD stack needs its **coarsest** octave to sit far above the pixel limit, so finer ones have
somewhere to arrive *from*. Usable octaves between "spans the disc" and "starts to alias", at 4 body
radii / 1.3 body radii, at the game's pixel budget:

| λ/R | body | usable octaves @4R / @1.3R |
|---|---|---|
| 1.162 | Earth | **6 / 8** |
| 1.439 | Luna | **6 / 8** |
| 0.635 | Mercury — the coarsest anchor | 5 / 7 |
| 0.068 | Io — the finest REAL body | 2 / 4 |
| 0.0496 | the law today, after the bound | **1 / 3** |
| 0.0133 | the law before the bound | **0 / 1** |

⛔ **At the law's hot end the coarsest octave is ALREADY at the pixel limit.** Zero headroom. There
is no coarse shape for finer detail to arrive onto, and nothing left to reveal on approach.

⭐ **This one cause produces all three of Max's complaints simultaneously:**
- *"deletes any sense of scale"* — octave 0 **is** the grain. There is no landform.
- *"pops in too soon / arrives all at once"* — with one usable octave there is no progression; the
  field is absent, then present.
- *"higher LOD grain totally unrelated to the lower LOD"* — there is no lower LOD to relate to.

## 4. ⚠ AND THE CALIBRATION TABLE DOES NOT SUPPORT WHAT THE LAW DID WITH IT

`macroWavelength.js` §1 lists Io as *"a mountain, mean basal length ~157 km"* (λ/R 0.086) and
*"a patera, mean Ø ~41 km"* (0.023). **Those are features ON Io.** What they actually record is that
Io has very little **large-scale relief** — it is resurfaced faster than big topography can build.

The law encoded that as a **much higher base frequency**, which collapses the entire octave stack
onto one scale. The same evidence is more honestly encoded as **lower amplitude in the coarse
octaves**, leaving the characteristic length near one body radius — where *every other body in the
table* sits (0.635–1.652, a factor of 2.6 across seven bodies).

⭐ Physically: tidal resurfacing **erases big topography**. It does not shrink the planet's
characteristic length.

## 5. THE PROPOSAL — ⛔ not implemented, this is a model change and it is Max's call

1. **Move the tidal process term from FREQUENCY to AMPLITUDE.** Every body keeps a macro wavelength
   of order one body radius (the seven-body consensus). Tidal drive instead attenuates the coarse
   octaves, so an Io-like world is *flat at large scales and rough at small* — which is what Io
   looks like, and which the current model cannot express at all.
2. **Then the budget can do its job.** With 6–8 usable octaves the distance ramp finally becomes the
   binding constraint, so *"we don't need to see this until we're quite close"* becomes a tunable in
   the units Max speaks in — radii — instead of an emergent side-effect of a frequency.
3. **And the fade goes back to being only an anti-aliasing floor**, which is all it should ever have
   been. The `[K]` legibility arm becomes unnecessary once the budget binds; keep it as a safety net.

⚠ **What this costs:** it changes how every tidally-active world looks, and it retires the
`macroShortening` frequency term that B2 leg 3 was spent building. The eight-body calibration table
survives — it is being read more carefully, not discarded.
