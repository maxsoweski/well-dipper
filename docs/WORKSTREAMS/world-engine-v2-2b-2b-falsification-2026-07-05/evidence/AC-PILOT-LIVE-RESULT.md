# AC-PILOT-LIVE — live integration result (working-Claude, 2026-07-08)

**Setup:** external Windows Chrome on `127.0.0.1:9223` (chrome-devtools MCP, real GPU); dev server
`localhost:5175`, lab `planet-lod-lab.html`; driven at commit `03992a3` (fa9f0a5 + the cross-resolution
nesting fix found during THIS check). Fresh tab, closed after (window hygiene). All numbers below are
verbatim `_lab.mixedProbe()` scalars.

## World 1 — wet-stagnant (raw L 0.16, effectiveL 0.60, Φ 0.42, n 6, seed 2)

- Routing: `path 'lid-mixed'`, `fineClass 'mixed'`, `heightSource 'carrier'` — the effectiveL hand-up
  routes a raw-L-0.16 body (off-pilot under raw L) into the mixed interior. ✅
- `pierceCount 3` (small handful — matches the headless seed-2 prediction exactly; per-center booleans are
  mesh-independent), `Ybase 0.3413` (= Ybase(effectiveL 0.60), not Ybase(0.16)≈0.0072). ✅
- Histogram (lab mesh ~40k): shield 1677 / caldera 39 / corona 81 / tessera 2586 / rift 331 / plain 35286
  → TENT fraction ≈ 0.957, minority-but-nonzero PIERCE. TENT-dominant, not a Venus lock. ✅
- `coronaPiercedCount 0` (Φ 0.42 < PHI_BREACH — the wet world is correctly breach-free). ✅
- `effectiveL 0.6` and raw `L 0.16` both published. ✅
- Live Π 0.6272 / M 0.0512 on the lab mesh — **this is the "0.63" of 2b-2a's notes**, live-confirming the
  cross-check reconciliation (0.627 = lab-mesh value; 0.662 = headless N=1500 value; same seed-2 field).
- Visual: distinct broad provinces + a dark rift corridor; structured, not uniform resurfacing.
  Screenshots: `pilot-live-wet-stagnant-L016-eff060-phi042-seed2.png` (d20), `…-d4.png`, `…-d2p5.png`.

## World 2 — corona-pierced (L 0.58, Φ 0.50, n 9, seed 22 — the pinned coordinate)

- FIRST DRIVE (at fa9f0a5) FAILED the visible observable: histogram had **zero corona nodes** — every
  breach core swallowed its annulus on the fine lab mesh (measured live: Rc 0.0484 / support 0.0775 rad vs
  Psi_e 0.129–0.144 rad). Root cause + fix recorded in BUILD-NOTES §"SLICE 2 amendment"; fix committed
  `03992a3` (breached-center corona radius floors at `BREACH_ANNULUS_SCALE·Psi_e`, N=1500 pin bit-identical,
  247/247 tests green, search re-pin identical).
- RE-DRIVE (at 03992a3): `heightSource 'carrier'`, `coronaPiercedCount 3` (≥2), `Π 0.7900 > 0`,
  `M 0.0687 ≤ 0.70`, `legibleByFamily.pierce 8 ≥ 2`; histogram shield 2686 / caldera 58 / **corona 1899** /
  tessera 2993 / rift 352 / plain 32012 — the annuli exist. ✅
- Visual: camera over breach center p=1 — a raised shield with summit structure nested INSIDE a concentric
  corona ring (trench + rim), one center; a second ringed compound visible lower-left. "A shield emerging
  from a corona" reads directly. Screenshot:
  `pilot-live-corona-pierced-L058-phi050-n9-seed22-center1-d3.png`. ✅

## Console

Exactly one error across the whole session: the pre-existing `favicon.ico` 404 (same sole error as 2b-2a's
live block). **Clean of NEW errors.** ✅

**AC-PILOT-LIVE: PASS at `03992a3`.** AC-PILOT-UAT remains Max's gate (deferred-to-max, untouched).
