# AC-NAV-OVERLAY-UNCHANGED — the baseline, captured BEFORE NavComputer was touched

**2026-07-29, at HEAD `38b3dcb`, before any edit to `src/ui/NavComputer.js`.**

This file exists because the NAV rebuild adds a `chromeless` flag to a 4,097-line class that the
game's own full-screen nav overlay is still built on. The flag is additive and default-off, and the
claim that has to be *proved* rather than asserted is: **with the flag unset, the drawing is
byte-identical to what shipped.**

## Why this is not a vitest test

A real `NavComputer` cannot be constructed in this repo's vitest — no jsdom, no happy-dom, no
node-canvas; its constructor calls `canvas.getContext('2d')` and adds seven DOM listeners.
`src/cockpit/NavSource.js`'s header states this at length and it is still true. The only place a
real NavComputer exists is a browser, so the baseline is captured in the browser.

## The determinism finding this rests on — and the trap in it

A hash comparison is only meaningful if the SYSTEM view is deterministic frame to frame. It is
**not, by default**, and the first capture attempt proved it:

| condition | 4–5 consecutive frame hashes | deterministic |
|---|---|---|
| as found (`_selectedBody = {type:'star',starIndex:0}`) | `e991ba93`, `ecebc63`, `c752747c`, `93d34412` | **NO** |
| `_selectedBody = null`, `_hoveredBody = null` | `d7986730` ×5 | **YES** |

The single time-dependent pixel in the whole SYSTEM view is the selection ring's
`pulse = 0.6 + 0.4 * Math.sin(performance.now() * 0.004)` at **`NavComputer.js:2546`**, and it is
guarded by `if (this._selectedBody)`. The lab had a body selected, so the naive capture was noise.

**Anyone re-running this must clear the selection first.** A comparison taken with a body selected
will fail every time and say nothing about the change.

## The captured baseline

Lab `http://localhost:5181/well-dipper/cockpit-screens-lab.html`, `_cockpitScreensLab.setNavLevel(4)`.

| | |
|---|---|
| **baseline hash (FNV-1a over the full RGBA buffer)** | **`d7986730`** |
| buffer | `614 × 512` (the NAV panel's own size) |
| level | `system` (`_levelIndex` 4) |
| star | `Wanveb-4OQSLX9698`, seed `840691304` |
| planets | 3 |
| `farCompanions` | **0** |
| `_systemZoom` | 1.0 |
| `_systemRotX/Y` | 0.5 / 0 |
| `_selectedBody` / `_hoveredBody` | null / null |
| lab flight seed | `well-dipper-lane-F` |
| ink coverage (as-found, selection on) | 12.259% |

## ⚠ What this baseline does NOT cover

**`farCompanions` is 0 in this system, so `_drawFarCompanionChips` never ran.** That path draws
named text chips at the top-right (`NavComputer.js:632`) and is one of the chrome items being
suppressed — it is therefore *unexercised by this hash*. A wide-binary system must be driven
separately to prove both that the chips are gone when chrome-less and that they are unchanged when
not. Do not read `d7986730` as covering it.

## The stronger check that supersedes this one

A cross-page-load hash comparison assumes two loads generate the same system. That assumption is
avoidable: `src/ui/NavComputer.baseline.js` is a **pristine byte-identical copy** of the file taken
at `38b3dcb` (md5 `1e7aa68c10f8a9bba060b6e67aeb48c3`, verified equal at copy time). The real proof
constructs **both** modules in ONE page, hands them the same star and the same buffer size, renders
each with `chromeless` unset, and compares buffers directly — immune to any cross-load variation.

`NavComputer.baseline.js` is scaffolding and **must be deleted before the work is committed.**
