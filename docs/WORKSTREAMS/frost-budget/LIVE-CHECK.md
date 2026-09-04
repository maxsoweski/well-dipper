# frost-budget — live check

Driven in the running game and lab on :5175. ⚠ **Both pages were RELOADED first** — `src` was edited
this session, and a hot-reloaded page is not evidence about shipped code
(`feedback_reload-before-browser-measurement`).

---

## AC-6 — the world Max walked ✅

`?system=rocky-126`, `PVX J3DK6GAO+RBJGI5M c`, framed at 2.2 body radii, 96.8 % lit.

⛔ **The body was identified by its TEMPERATURE, not by its position in a list.** `frameBody({index: 1})`
resolves to planet *b*, not the anchor, and the harness said so itself. Every reading below is off the
mesh whose `uPlanetTempEq` is 292.95.

| uniform | before | after |
|---|---:|---:|
| `uFrostMaxCoverage` (cap WHITENESS) | 0.834 | **0.619** |
| `uFrostLatChill` (pole→equator gradient) | 0.35, every world in the galaxy | **0.162**, derived from its 1.25 bar |
| sea-level snowline | 26° | **60°** |
| `uIcenessMix` | 0 | **0** — the icy-body path is untouched, as scoped |

`live-rocky126-before.png` (captured last session, same body) vs `live-rocky126-after.png`.

**Before:** white and grey over most of the disc, with small blue patches.
**After:** deep blue oceans, brown and tan continents, green coastal belts, visible river networks —
and the white that remains sits on the **high ground**.

⭐ That last part is not a coincidence, and §AC-4 below is why.

## AC-4 — "in high places" ✅ PASSES, and the measurement is the finding

Measured on the lab's `Rocky (Earthlike)` through `_lab.sampleField` — which taps the **compiled
shader**, so it is the same `h` the shader hands `frostCoverage`, not a re-derived quantity.

At **58.4° latitude**, the same latitude, on the same world:

| | h | localT | |
|---|---:|---:|---|
| high point | 1.993 | **105.6 K** | frosted |
| low point | 0.082 | **285.6 K** | bare |

A **180 K** spread at one latitude. Max's criterion is delivered.

⚠ **AND THE NUMBER IT DEMANDED IS THE OPEN QUESTION.** The contract required the altitude term's
strength be *measured, not assumed*, with `h`'s observed range beside it:

- `h` runs **−0.297 … 1.993** on that world.
- The lapse term is **94.2 K per unit of h** → **215.6 K across the observed relief range**.
- Earth's real environmental lapse is 6.5 K/km; Everest, at 8.85 km, is ~58 K colder than sea level.

So a single world's relief spans nearly four Everests of cooling. **The altitude term is now the
DOMINANT contributor to how much of a temperate world is drawn white** — on `Rocky (Earthlike)` the
sea-level snowline yields *nothing*, and 33.8 % of the surface is painted by altitude alone.

⛔ **This is the shape of last session's lesson repeating.** I fixed the term I was looking at, and a
different term took over the answer. `uFrostLapseRate` is the second of the two underived knobs the
follow-up named, and it is still 0.3 with nothing behind it.

## AC-5 — the frozen worlds ✅

Byte-identical in the live lab: `Frozen (airless)`, `Titan (methane seas)`, `Europa (icy moon)`.
`uFrostLatChill` reads **0.600** on all three (airless) against **0.157** at 1.5 bar and **0.168** at
1 bar — the derived gradient discriminating across three real pressures, live in the material.

## ⚠ A lab/headless divergence found on the way, NOT introduced here

The lab's presets do not render at the temperature their `T_eq` field states — the lab derives T from
orbit and luminosity instead:

| preset | preset `T_eq` | live lab `uPlanetTempEq` |
|---|---:|---:|
| `Ocean (temperate)` | 295 | **267.2** |
| `Rocky (Earthlike)` | 288 | **313.9** |
| `Frozen (airless)` | 60 | 62.7 |

The game path (`conditionFromBody`) uses the stated number, so the headless census is right about the
GAME and the lab is running different worlds than its labels claim. **The law behaves correctly on
both** — the lab's 267 K "Ocean" is genuinely below freezing and correctly keeps its full budget; its
314 K "Earthlike" is genuinely hot and correctly loses almost all of it. Pre-existing, logged, not
this workstream's (`feedback_converge-dont-declare-divergence` — it is debt, not a ruling).

## AC-7 — Max's gate, NOT closed by any of the above

Fly to `PVX J3DK6GAO+RBJGI5M c` and to a frozen world. **The game is parked on it right now.**
