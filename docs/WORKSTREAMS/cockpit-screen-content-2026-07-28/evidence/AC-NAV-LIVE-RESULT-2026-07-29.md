# NAV chrome-less + full colour — LIVE verification, 2026-07-29

Driven by working-Claude in `http://localhost:5181/well-dipper/cockpit-screens-lab.html` via
chrome-devtools. Everything below is a measurement, not a report of one.

## AC-NAV-OVERLAY-UNCHANGED — PASS, at the pixel level

The design's verification item 1. Both modules imported into ONE page, a real `NavComputer` built
from each on its own 614 × 512 canvas, the same `_systemStar` / rotation / zoom deep-cloned onto
each, `chromeless` unset on both.

| level | settle drift (current) | settle drift (baseline) | differing bytes, frame 1 | frame 2 |
|---|---|---|---|---|
| galaxy | 0 | 0 | **0** | **0** |
| sector | 0 | 0 | **0** | **0** |
| region | 0 | 0 | **0** | **0** |
| prism | 0 | 0 | **0** | **0** |
| system | 677 | **677** | **0** | **0** |

Star `Wanveb-4OQSLX9698` (seed 840691304), 3 planets. **`ALL_IDENTICAL: true`.**

### Three ways this measurement was wrong before it was right

Each of these produced a confident, meaningless number first. They are recorded because every one
of them would silently pass a broken implementation.

1. **A fresh page has no `_systemStar`.** The first run compared level 4 and reported 0 differing
   bytes — because `_renderSystem` warns and returns when `_systemData` is null, so both modules
   drew a background and nothing else. **A vacuous pass.** `openToCurrentSystem()` → `_findNearestStar()`
   returns null until the prism has loaded stars, and it bails SILENTLY.
2. **Prism is not self-deterministic.** Level 3 showed 241, then 745 bytes of *self*-drift between
   two renders of the SAME instance. Freezing `performance.now` and `Date.now` took it to 0 — so it
   was a clock read, not a divergence. Comparing without the self-drift check would have reported a
   real divergence that was not there.
3. **Unequal render counts.** Comparing A's second frame against B's first showed 677 bytes at
   SYSTEM. `_renderSystem` MUTATES state on its first frame — a foreign system forces a selection —
   so the two instances were one frame out of step. With equal counts the drift appears identically
   on both modules (677 = 677) and the cross-diff is 0.

**Anyone re-running this must: load a star first, freeze the clock, and render both the same number
of times.** Skipping any one gives a number that looks authoritative and means nothing.

## AC-NAV-CHROMELESS-SYSTEM — PASS

Text counted by wrapping the context's own `fillText`/`strokeText`, so nothing in the class was
trusted to report on itself.

| | text calls | `_autopilotButtonRect` | `_commitButtonRect` |
|---|---|---|---|
| SYSTEM, chromed | **15** — `ASTEROID BELT`, three planet names, the system header, `[ WARP ]`, `DRAG TO ROTATE · ESC TO RETURN`, … | published | published |
| SYSTEM, chrome-less | **0** | `null` | `null` |

**Survivors present:** star, orbit ellipses, habitable-zone ring, belt annulus, planet discs. Ink
coverage 3.61% — non-zero, so "chrome-less" is not being satisfied by a blank screen.

### Far-companion chips — the item the handoff's list missed

The lab has **no real star catalog loaded**, and `farCompanions` reaches `systemData` only from the
real-system overlay, so Alpha Centauri is unreachable here. `_drawFarCompanionChips` reads exactly
one input, `_systemData.farCompanions`, so the overlay's shape was **injected** to exercise the
identical path. Stated plainly rather than implied.

| | text | chip rects |
|---|---|---|
| chromed | `Proxima Centauri`, `far companion · 13,000 AU` | 1 |
| chrome-less | none | 0 |

The chromed half is the load-bearing one: it proves the path was **reached** rather than trivially
empty.

## AC-NAV-EXPANDED — PASS

Measured off the projected path geometry (`moveTo`/`lineTo`), not a lit-pixel bounding box. The
first attempt used the bounding box and reported the bare picture as **smaller** (0.394×) — because
chrome is drawn edge to edge, so that measurement compared *chrome extent* against *orrery extent*.

| | orrery span X | vertical centre |
|---|---|---|
| chromed | 327.3 px | y = 231 |
| chrome-less | 405.3 px | y = **256** |

**Expansion 1.238× measured vs 1.239× predicted** from the two geometry expressions. The panel's own
centre is 256, so the picture stops sitting high and centres itself.

Both knobs live and independent: fill 0.55 / 0.95 / 1.35 → 237.4 / 405.3 / 576.0 px; zoom 1× → 2×
doubles the span exactly (405.3 → 810.7). A **non-finite fill** leaves the span unchanged at 405.3
with zero non-finite path points — the `_systemFill` fallback holds. That guard was added as a
"minor" from the adversarial pass and is **actively load-bearing**: the lab writes `null` onto
`systemFillFactor`, so without it the panel would blank.

## AC-NAV-FULL-COLOUR — PASS, on the corrected test

| panel | distinct values | off the ink ramp |
|---|---|---|
| **NAV** | 774 | **1.621%** |
| DRIVE | 187 | 0.000% |
| TARGET | 218 | 0.000% |
| INFO | 179 | 0.000% |

⚠ **The AC's original observable was wrong and this measurement is what corrected it.** It said the
one-ink panels show "exactly 2 distinct colours" — which would **fail a correct panel**, because the
painters draw anti-aliased text. The two-value figure came from the H4 study, which measured the
*dithered* NAV buffer; nothing else on the glass was ever dithered. The right test is the ramp:
for `k = max(r/0xED, g/0xE8, b/0xDE)`, every channel within 10 of `k ×` the ink.

## Max's drill ruling — PASS

With the intent set true at every level, `_bare` resolves false everywhere except SYSTEM:

| level | intent | `_bare` | text calls |
|---|---|---|---|
| galaxy | true | **false** | 8 |
| sector | true | **false** | 8 |
| region | true | **false** | 8 |
| prism | true | **false** | 21 |
| system | true | **true** | **0** |

The autopilot's star-pick drill keeps its chrome, with no cooperation required from the caller.

## ⚠ What this change makes invisible — for Max's eye at UAT

At SYSTEM with **no system data**, NavComputer draws its background and returns. Chromed, you still
saw the tab bar, the autopilot toggle and the level label, so the panel was visibly a nav computer
having a bad day. Chrome-less, the panel is **completely blank** — indistinguishable from a working
screen showing empty space.

Observed for real: driving the lab to SYSTEM before the prism had loaded stars produced **3,715**
background-only frames with nothing on the glass to say so. The data path is unchanged and this is
not a regression in behaviour — but the change removed the only visible symptom.

## Re-running the byte-equality proof after this commit

`src/ui/NavComputer.baseline.js` was scaffolding and has been **deleted** — it was git-excluded, so
it was never committed, and leaving a 173 KB duplicate in the tree invites someone to edit the wrong
file. Regenerate it from the pin instead:

```bash
git show 38b3dcb:src/ui/NavComputer.js > src/ui/NavComputer.baseline.js
```

`38b3dcb` is the commit before any of this work; md5 `1e7aa68c10f8a9bba060b6e67aeb48c3`. Then run the
A/B described above, and delete it again afterwards.

⚠ **This guarantee is not in CI and will rot.** An adversarial reviewer disproved the premise this
workstream inherited from `NavSource.js`'s header — that a real `NavComputer` cannot be constructed
headless — by constructing one in plain node with a stub canvas and a stub 2D context and rendering
a full SYSTEM frame. So a render-based regression test **is** possible in this repo and is the right
home for this proof. It is outstanding work, not a closed question.

## Also worth knowing

- **The ship marker does not draw in a foreign system.** The screenshots show a browsed system, so
  there is no ship diamond. That is correct — `shipP` is null unless you are in that system — and
  it is not evidence the player marker was lost.
- Screenshots: `nav-chromeless-system-2026-07-29.png` (in the cockpit),
  `nav-chromed-vs-bare-2026-07-29.png` (buffers flat, side by side — the honest way to judge layout).
