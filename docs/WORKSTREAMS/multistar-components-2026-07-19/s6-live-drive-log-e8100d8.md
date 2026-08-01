# S6 live drives — AC6 + AC7 (2026-07-21, build e8100d8)

Working-Claude drove chrome-devtools on `:5176` (debug Chrome 9223) per the pinned
protocol in `build-plan.md` § S6. Objective integration checks only — AC10 UAT stays
Max's. Both ACs **PASS**.

## Protocol compliance

- `window._autoNav` stopped at boot chooser and re-checked after EVERY warp
  (it re-armed twice — once at HELM-tour boot, once on arrival — stopped both times
  within the same drive step; **zero `[NAV-SEQ]` lines** all session; every arrival's
  `[NAV DISPATCH]`/`[WARP]` seed matched MY dispatch, none inherited).
- Trusted CDP keys only for game-level input (N open/close, Escape); canvas
  `MouseEvent`s through the real listener chain (`_handleMouseMove`/`_handleClick`)
  for hover/click/commit; search-warp rows via their own DOM `mousedown` handlers.
- Marker disambiguation: the two α Cen prism dots project ~9 px apart with
  `hitDist=12` (last-match-wins) — each hover/click point was chosen inside the
  target's hit radius and OUTSIDE the other's, and `_hoveredLocalStar.star.name`
  was confirmed before every click (protocol requirement).
- Boot noise (pre-drive, not mine): the HELM choice auto-warped to procgen
  "Fisxam-4OPZ1SMDUO" seed 1635859914 ("Warp: booting into HELM tour, hands-off") —
  the standing lane-B boot-tour flag, recorded here for the seam handoff.

## AC6(a) — far-chip drill-in (entry a) — PASS

From the α Cen SYSTEM view (entered via Rigil's marker), clicked the Proxima
far-companion chip (`_farChipRects[0]`, guarded by `componentSystems[0]`):

- `_systemMode='component'`, `_selectedComponentIdx=0`; `_componentView` =
  {title 'Alpha Centauri', breadcrumb 'part of Alpha Centauri', annotation
  'via Proxima Centauri — far companion', componentName 'Proxima Centauri'}.
- Component payload is the REAL generated system: authored pins **Proxima Cen d
  (0.02881 AU)** + **Proxima Cen b (0.04848 AU)** rendered at their actual orbits,
  plus 4 procgen-fill siblings (P3–P6) — never fabricated view-only orbits.
- **`_labelRects` pairwise non-overlap: 6 labels, 15 pairs, ZERO overlaps**
  (asserted via the instrumented handle, exact float rects).
- ESC → `_systemMode='system'`, component state fully cleared (idx −1, view null).

## AC6(b) — PRISM far-member pre-select (entry b) — PASS

Clicked Proxima's OWN prism marker (hover confirmed 'Proxima Centauri' first):

- Console: `[NAV] Entering system view for: Proxima Centauri seed: 1816942132 type: M`.
- Landed level 4 with the component PRE-SELECTED: `_systemMode='component'`,
  `_selectedComponentIdx=0`, `_pendingComponentSelect` consumed (null), same
  title/breadcrumb/annotation strings as entry (a); resolves to the one α Cen system
  (`_knownSystemNames` {system 'Alpha Centauri', star 'Rigil Kentaurus', star2 'Toliman'}).
- Non-overlap re-asserted in this drilled view: 15 pairs, ZERO overlaps.
- ESC round-trips to SYSTEM view; commit action survives (warp · Proxima Centauri ·
  seed 1816942132).
- Rigil control case: clicking Rigil's marker set then consumed the pre-select as a
  no-op (`findComponentIndexByName` → −1) — plain SYSTEM view, as designed.

## AC7 — arrival unchanged, both markers — PASS

Per-marker preview seed captured BEFORE warping (fable N1), then warped from each:

| Leg | Marker | Preview seed (pre-warp) | `[NAV DISPATCH]` | `[WARP]` | Arrival |
|---|---|---|---|---|---|
| 1 (from Fisxam) | Rigil Kentaurus (G) | **1816942132** (state + msgid 39) | star=Rigil Kentaurus seed=1816942132 | Known system override: Alpha Centauri | G+K binary, Star 1.04 R☉ + Star2 0.76 R☉ K, **sep 23.500 AU** (scene 23500.00), 0 planets, farCompanions [Proxima b,d], componentSystems [Proxima] |
| 2 (from Sol, via search-warp return log-confirmed seed 163760118) | Proxima Centauri (M) | **1816942132** (state + msgid 87) | star=Proxima Centauri seed=1816942132 | Known system override: Alpha Centauri | identical authored arrival (msgid 97–100) |

Both previews titled 'Alpha Centauri' with A+B rendered + far chip
('Proxima Centauri / far companion · 13,000 AU / planets: b, d').

**Console: 97 messages, ZERO errors, ZERO warnings across the whole session.**

## FOLD-hitch watch-item (non-gating, fable N2) — flagged, not fixed

rAF frame-delta watcher armed at each commit click:

- Leg 1 (Fisxam → α Cen): 2,400 frames, mean 8.3 ms, **worst 18 ms — no hitch**.
- Leg 2 (Sol → α Cen): 1,899 frames, mean 8.9 ms, **one 998 ms stall**, next-worst 22 ms.

Attribution is NOT established: leg 1 ran the identical parent+component generation
burst cleanly, so the stall may equally be Sol's outgoing scene teardown (13 planets,
400 asteroids) or tab-visibility throttling. Flag rides to the Increment B joint
scoping (where component generation cost meets the travel path); no fix here —
main.js/warp out of surface.

## Evidence files (this dir)

- `evidence-s6-prism-rigil-hover.png` — prism, Rigil hovered pre-click
- `evidence-s6-ac7-system-via-rigil.png` — SYSTEM view via Rigil (A+B + far chip + [WARP])
- `evidence-s6-ac6a-component-drilled.png` — component view via far chip (b, d + fill)
- `evidence-s6-ac6a-esc-back-system.png` — ESC return to SYSTEM view
- `evidence-s6-ac7-arrival-via-rigil.png` — leg-1 arrival
- `evidence-s6-prism-proxima-hover.png` — prism, Proxima hovered pre-click
- `evidence-s6-ac6b-preselect-via-proxima-marker.png` — pre-selected component view via Proxima's marker
- `evidence-s6-ac7-arrival-via-proxima.png` — leg-2 arrival

Browser parked for Max: in-system Alpha Centauri, nav closed, tour OFF; no agent-opened
pages left behind.
