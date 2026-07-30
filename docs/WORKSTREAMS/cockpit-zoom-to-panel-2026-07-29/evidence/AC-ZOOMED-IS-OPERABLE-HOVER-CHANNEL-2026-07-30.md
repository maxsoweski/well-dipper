# The hover channel — Max's "unresponsive nav computer", found and fixed

**2026-07-30.** Reported by Max at increment 6 UAT:

> *"One issue I am noticing is that interacting with the nav computer is something
> unresponsive; what seems to fix it is if i press and hold the mouse button for
> some reason."*

He was right, and the workaround was the diagnosis.

---

## Root cause

`NavComputer._handleClick` resolves **the whole map body** from HOVER state, not from
the click's own position:

| Target | Resolved from | Set where |
|---|---|---|
| planet / moon / star at SYSTEM | `_hoveredBody` | inside `_renderSystem` / `_renderPlanetDetail` |
| a star at PRISM | `_hoveredLocalStar` | inside `_renderLocal` |
| a galaxy sector | `_hoveredTile.sector` | inside `_renderSectorOverlay` |
| a grid tile at SECTOR / REGION | `_hoveredTile` | `_handleMouseMove`, **non-dragging branch** |
| level tabs, autopilot, COMMIT, far chips | the click position | — (these always worked) |

Every one of those hover fields is recomputed **during the render**, by testing each
body's freshly projected position against `this._mouseX` / `this._mouseY`. Those two
numbers are written in exactly one place: `_handleMouseMove`.

A DOM canvas receives `mousemove` continuously **with no button down**, so hover is
always current. **That invariant was never ported to the panel.**
`cockpit-screens-lab.html` forwarded `pointermove` into the adapter only inside
`if (panelDrag)` — that is, only while the primary button was held.

So with the button up, moving across the glass told the nav computer *nothing*. A
quick click resolved against a stale hover — `(0, 0)`, the panel's top-left, on a
fresh page — and fell through to "clicked empty space". Holding the button made
`panelDrag` true, so the smallest jitter delivered a move, the next frame resolved
hover, and the release then found a body. **The hold was manufacturing the missing
channel, not fixing a timing problem.**

### The prediction that confirmed the cause rather than the symptom

If the diagnosis is right, SECTOR and REGION grid tiles were dead **even with the
workaround** — their `_hoveredTile` is set after `if (this._dragging) return`, and
during a hold `_dragging` is true. Confirmed in `PanelPointer.hover.test.js`: an
unpressed hover resolves a tile, a held drag does not. One missing channel explains
every case, including one Max had not reached.

### ⚠ Why increment 6's verification passed over this

`clickGlass`, the scripted-click probe, fires **down → move → wait for repaint → up**
and its own header explains why: *"a down/up with no move in between hover-picks
against a stale cursor at (0, 0)"*. The probe put the move **inside the gesture** —
which is precisely what press-and-hold does by hand. So the instrument compensated
for the defect it should have exposed, and every scripted click passed while the
player's gesture failed. `hoverAt` in `headlessNav.mjs` documents the same mechanism
for tests. Both understood it locally; neither asked whether the *product* had the
channel. **A probe that works around a defect to reach its subject has hidden that
defect, not routed around it.**

---

## The fix

One new channel, no NavComputer change.

- **`PanelPointer.js` — `PanelPointerAdapter.pointerHover(hit)`**: forwards
  `_handleMouseMove` when no press is outstanding. A miss parks the position at
  `OFF_GLASS = -1e4` and forwards anyway, so the class clears its own hover using its
  own proximity tests. `-1` would **not** do: hit radii run to 14 px and a body can be
  projected into the corner, so `(-1, -1)` still hovers it. A press in flight makes
  this a no-op — `pointerMove` owns that case.
- **`cockpit-screens-lab.html`** — the `pointermove` handler forwards unpressed moves
  when `navZoomLanded() && !dragging && mode === 'eye'`, and passes a hit on any
  **other** panel as a miss so its uv is never mapped into NAV's pixel space.
- **Probe gaps closed by the same change**: `pointerCensus()` now wraps and counts
  `pointerHover` (it watched the other three and was blind to the one that fires on
  every mouse move), and `navProbe()` exposes `mouse: {x, y}` — the pair the bug is
  about, and the only direct evidence that an unpressed move reached the class.

## Unit evidence — `src/cockpit/__tests__/PanelPointer.hover.test.js`, 6 tests

Real `NavComputer` via `headlessNav.mjs`, driven through the real adapter.

- **CONTROL**: press + release on a located planet, no hover forwarded → `_systemMode`
  stays `system`. The bug, as an assertion.
- hover → frame → same press + release → drills, and `_selectedPlanetIdx` equals the
  index **the frame resolved** (mode alone would pass on any planet).
- a hover neither presses nor releases (`isPressed` false, `_dragging` false).
- a hover that misses clears the hover it left behind.
- the off-glass park exceeds every hit radius.
- an unpressed hover resolves a grid tile; a held drag does not.

**Plant-and-revert, 5 defects, every one red in the right place:**

| Planted | Reddened |
|---|---|
| `pointerHover` a no-op | drills / miss-clears / corner / grid tile (4) |
| a miss forwards nothing | miss-clears, corner (2) |
| `OFF_GLASS = -1` instead of `-1e4` | corner (1) |
| hover also presses | presses-nor-releases, miss-clears (2) |
| `pointerDown` manufactures the hover itself (a plausible **alternative** fix) | **the CONTROL** (1) |

The last one exists because the control stayed green under the first four, and a
control that cannot fail is not a control.

⚠ **The instrument trap this file hit first, recorded so it is not hit again.** The
adapter's constructor **overrides `_getCanvasPos`** — its whole purpose. The harness's
`hoverAt` drives the DOM path. Once the adapter is attached, `hoverAt` reads the
adapter's parked position instead of the point it asked for, so the sweep probed
`(0, 0)` ~3,500 times and reported that the fixture system has no planets. **Find and
park on the DOM path, then attach.** Same family as the workstream's "an instrument
cannot be its own control" — here the subject disables the instrument.

Also corrected in the first draft: `_selectedBody` is the **wrong observable**. The
fixture star resolves to a FOREIGN system, whose arm drills a clicked planet in for
info and deliberately does not re-select; and `openToCurrentSystem` has *already* set
`_selectedBody` to `{type:'star'}`. Asserting it "becomes" a planet fails on a working
build, and asserting it "becomes null" passes when the click lands on empty space.
The test now asserts `_systemMode` + `_selectedPlanetIdx`, and throws if the fixture
ever becomes the current system.

## Live evidence — the real page, real `PointerEvent`s, `:5181`

Zoomed NAV, button **up** throughout except the two clicks.

1. **The channel is live.** Three unpressed moves across the glass →
   `pointerCensus() = {down: 0, move: 0, up: 0, hover: 3, lastRole: 'NAV'}`, and
   `navProbe().mouse` tracked **x = 3.79 → 307 → 610.2** over a 614-wide buffer with
   **y = 256.000** pinned at the vertical centre. Linear and exact.
2. **A miss clears.** A move onto the letterbox bar → `mouse = (-10000, -10000)`.
3. **PRISM, Max's gesture.** Hovered star markers found from a live `ctx.arc` census
   (413 arcs, 39 in-bounds); the third candidate hovered **`Parbuk-4ORRCDGHZF`** at
   buffer (485, 324) — `mouse` equalled the requested pixel on every probe. Then
   `clickGlass('NAV', u, v, {move: false})` — **pointerdown → pointerup, nothing in
   between** — took the panel **prism → system**, `systemUnpopulatedDrawsNothing:
   false`. Screenshot: `hover-channel-system-reached-2026-07-30.png`.
4. **SYSTEM, the same gesture.** Hover resolved a star at (307, 231) and a planet at
   (314, 263); a quick click on the planet took `systemMode` **system → planet** with
   `selectedPlanetIdx: 0`, matching the hovered index.
5. **`move: 0` in the census across all of it** — no pressed-move occurred in any
   gesture, so the hover channel is doing the work and the old path is not masking it.

**The "before" state is evidenced by the CONTROL test, not by a live baseline run.**
The live pass ran only against the fixed page.

## Suite

**2275 passed / 4 skipped** + the 15 known `vendor/motion-test-kit` collection errors.
Baseline was 2269; the +6 are this file. Nothing regressed.

## Named, not fixed — one thing found while reading, deliberately left

`cockpit-screens-lab.html`'s **pressed** path forwards `pickAt(e)?.hit ?? null`
without checking the role, so dragging the nav map and sliding onto an adjacent
screen maps **that** panel's uv into NAV's pixel space instead of releasing. The new
hover path does check the role. This is pre-existing, is not what Max reported, and
fixing it in the same change would mix two behaviours in one commit. Increment 7 owns
it — the game wiring has to make the same decision anyway.

## ⭐ What increment 7 must not repeat

Nothing in `src/` builds a `PanelHost`, so the game wiring will install its **own**
pointer routing. If it forwards only pressed moves, this bug ships into the game
exactly as it shipped into the lab. **The game's `pointermove` must call
`pointerHover` for unpressed moves.** This belongs in the increment 7 contract as an
AC, not as a note in a file someone may not read.
