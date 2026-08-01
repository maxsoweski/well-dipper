# NAV goes full colour and chrome-less — design

**2026-07-29.** Approved by Max in-thread before any code was written. Amends the workstream
`cockpit-screen-content-2026-07-28`; it does not replace `intent.md`.

## Max's steer, verbatim

> "This is looking good; I think what we need to do is to show an expanded version of the system
> nav screen in cockpit view; we can just show this in its original form for now (the monotone is
> too crude for this view) minus the names and so on; just showing the system objects/orbits/player
> position and in full color. We don't need to show the text and buttons unless we 'expand' that
> menu by bringing the screen closer to us through selecting it"

This **reverses H4 for NAV**. The Phosphor dither was built, it works, and its measurements stand
(see the program memory). DRIVE / TARGET / INFO remain one-ink and are unaffected. Nothing about
the dither is deleted.

## The four decisions

### 1. Chrome-less is a property of the SYSTEM view ONLY — Max's ruling, 2026-07-29

Asked what NAV should show while `AutopilotNavSequence` performs its star-pick drill (it writes
`_nav._levelIndex = 0 → 1 → 2 → 3` directly), Max chose: **the drill shows, with its own chrome.**

This matters more than it looks. It means chrome-lessness is not a global mode — it is one flag that
applies at one level. Levels 0–3 draw exactly as they do today, with zero new code, and
`AC-NAV-PANEL-HOSTS-AUTOSEQUENCE` is untouched. It also means SECTOR and REGION keep the labels that
are most of their content: stripped, they are a bare grid, and you would be watching the ship pick a
star whose name you cannot read.

### 2. NAV is full colour in BOTH states — working-Claude's decision, not Max's

The handoff left the zoomed state's colour open and flagged it "confirm". Closing it without asking,
because the H4 measurement already answers it:

SECTOR (17.6% ink) and REGION (28.0%) turned to mud because `_renderDensityBg` draws a
near-uniform bright field at those scales — a threshold sweep of 0.06→0.60 across gamma 1→2.6
*eroded* the slab rather than revealing structure. **That is a content problem, not a resolution
problem**, so enlarging the panel when it flies to the eye does not rescue it, and the zoomed state
includes those two levels. Add that a panel which changes ink mid-flight needs a crossfade and reads
as two different devices.

**Consequence:** the NAV panel is never dithered. This closes handoff open decision (3) — whether
the density background matters for the zoomed state — by removing the question.

### 3. "Expanded" = reclaim the chrome reserve, then two knobs

`_renderSystem` reserves 50 px at the bottom for chrome (`drawH = h - 50`, line 1996) and fills 85%
of what remains (`viewSize = Math.min(w, drawH) * 0.85`, line 2073). On the 614 × 512 panel that is
a 393 px picture in a 512 px panel — **77% of the height**. With the chrome gone both numbers are
wrong.

Chrome-less sets `drawH = h` and exposes the fill factor as a lab slider. At 0.95 the picture is
486 px — about **1.24× larger**. The existing `_systemZoom` (0.3–5.0, already implemented, line
4108) becomes a second slider for pushing past the point where the outermost orbit still fits.

Numbers are not picked here. They are knobs Max sets by eye, which is what worked for the tub
section, the screen fit and the dither.

### 4. The flag is dumb; the policy lives in lane F

`NavComputer` gets an additive, **default-off** draw flag. Every suppression site is guarded so that
with the flag unset the drawing is byte-identical. The *policy* — "chrome-less only at SYSTEM" —
lives in lane F: `NavPanel` reads `source.nav.level` (the getter already exists at
`NavComputer.js:230`) and sets the flag per frame.

Rejected alternatives:
- **Fork `_renderSystem` into lane F.** ~600 duplicated lines that drift the first time anyone
  touches navigation.
- **Post-mask the buffer.** Cannot remove *interior* labels — planet names sit on the orrery itself.

## The chrome inventory — measured, not inherited

The handoff's §4 list was checked against the file. It was right about seven items and **missed
one**; two more live at `render()` level.

| line | what | in handoff's list |
|---|---|---|
| 2190 | `'KUIPER BELT'` / `'ASTEROID BELT'` labels | yes |
| 2365 | planet display names (`_planetDisplayName`) | yes |
| 2426 | `_drawLeaderCallout` — hover tooltip | yes |
| 2481 | the `'SHIP'` word (the diamond glyph **stays**) | yes |
| 2538 | `_drawSystemHeader` — system name, star name, planet count | yes |
| **2541** | **`_drawFarCompanionChips` — named text chips, top-right** | ⚠ **NO** |
| 2574–2586 | the `[ BURN ]` / `[ WARP ]` button | yes |
| 2592–2601 | instruction footer (`DRAG TO ROTATE · ESC TO RETURN`) | yes |
| 1008 | `_renderLevelTabs` — the 32 px tab bar | at `render()` level |
| 3650–3667 | the autopilot toggle button (drawn at **every** level, ungated) | at `render()` level |
| 3669–3673 | the `LEVEL_NAMES[...]` label, top-right | at `render()` level |

`_drawFarCompanionChips` (defined line 632) only draws when `_systemData.farCompanions` is a
non-empty array — wide binaries — which is presumably why it was missed. **The baseline system has
zero far companions**, so it is unexercised by the captured baseline hash and needs its own check.

`_renderHUD` already suppresses the current-system and sector names at SYSTEM (`_levelIndex !== 4`,
lines 3635 and 3644), so those two need nothing.

**Survivors** — Max's list, plus graphics that carry no words: the star, the orbit ellipses, the
habitable-zone ring, the planets, the green ship diamond (`_drawPlayerMarker`), and the dashed
trajectory line. **The rule is: graphics stay, words go.**

## Verification

1. **Byte-equality with the flag off.** `src/ui/NavComputer.baseline.js` is a pristine copy pinned
   at `38b3dcb`. Both modules are constructed in ONE page, given the same star and buffer size,
   rendered with `chromeless` unset, and compared. In-process A/B rather than cross-load hashing, so
   no assumption that two page loads generate the same system.
   Pre-change baseline recorded in `evidence/AC-NAV-OVERLAY-UNCHANGED-BASELINE.md`: **`d7986730`**
   — valid **only with `_selectedBody` cleared** (see that file; the selection-ring pulse at line
   2546 is the sole time-dependent pixel).
2. **Chrome-less is real.** With the flag on, a text-detection pass over the NAV buffer and a
   direct check that each listed call site did not run; plus the survivors are still drawn.
3. **A wide-binary system is driven separately** for `_drawFarCompanionChips`.
4. **Unit:** the level→flag policy against a NavComputer-shaped stub, and a source-scan that every
   suppression site is guarded and the default is off.
5. **Max looks at it.** UAT is his gate alone.

## Risks, stated up front

- **There is no CRT shader.** `PhosphorDither.js:124` and `PhosphorScreen.js:138` both say
  scanlines/bloom/curvature are "a shader pass over the whole panel" — and that pass was never
  built. So the *only* thing making a panel read as Phosphor today is one ink on black. NAV in raw
  full colour will sit beside three one-ink panels **looking like a different device**. Max's steer
  says "in its original form for now", so no treatment is being added. This is the thing to judge.
- **Editing `NavComputer.js` touches live game code.** The full-screen overlay is still built on it.
  Mitigated by decision 4 and verification 1, not by hope.
- **`AC-NO-COLOUR-ON-THE-GLASS` must be amended**, not quietly broken — its statement currently says
  there is no colour on *the glass*, universally. It becomes a rule about the three one-ink panels
  with NAV explicitly carved out.

## Sequencing — a deliberate departure from the handoff

The handoff said scope increment 6 (zoom-to-panel) *before* building NAV, on the grounds that the
zoomed state changes what the at-rest state must be. Decision 1 dissolves that: chrome-less is a
SYSTEM-only draw flag, and the zoomed state is the nav computer as it already is. Increment 6 is now
a camera-and-input problem with no content design left in it.

**Build chrome-less expanded NAV first; scope increment 6 as its own contract after Max has looked.**
