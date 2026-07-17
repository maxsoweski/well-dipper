# AC-INTERACT + AC-LIVE live drives — result (both green)

**Driven by:** working-Claude, 2026-07-17, fresh isolated context on :5178 (atmo worktree at
`148cec2` slice I). Real GUI paths throughout: storm toggles via the F27/F28/F29 `✓ enabled`
checkboxes, reseed via the actual `New planet (re-roll both)` button, presets via the dropdown
API. Page closed after; zero console errors/warnings across the whole drive.

## AC-INTERACT — the storm on/off A/B (pinned Jovian seed 1, pinned camera)

In-page pixel diff (canvas capture inside the draw task; sample stride 2, threshold 18/765),
primary storm at screen (1070,697), R = 52.8 px:

| region | diff pixels |
|---|---|
| core `< 2.6R` (the old sticker's reach) | 3555 |
| **annulus `2.6R–6R` (the falsifier region)** | **1426** |
| beyond `6R` | 143 |
| annulus split | **1129 downstream vs 297 upstream (~3.8 : 1)** |

- Pre-slice-I the alpha-over sticker left everything outside ~2.6R byte-identical — the 1426
  annulus pixels are the NEW `dWake` band-field interaction, and the ~4:1 one-sided split is
  the derived-direction downstream cone. Storms-off `uStormCount=0` confirmed (exact-zero gate).
- Visual pair: `ac-interact-storms-ON.png` / `ac-interact-storms-OFF.png` — the ON frame shows
  the storm's bow + smeared trail pulling its band; OFF shows clean bands (dAdvect + jag
  persist by design — the two-identities rule).
- Note: 4 secondary storms were live on the disk, so small annulus/beyond counts include their
  wakes; the concentration pattern around the primary is the signal.

## AC-LIVE — regimes × reseed through the real GUI

- **Reseed wiring (derive-not-freeze inheritance):** `New planet` click re-ran the writers —
  primary storm lat −0.399 → −0.519, storm count 5 → 7, and the new `bandFlow:rough` per-seed
  draw moved 0.756 → 0.711. `ac-live-jovian-reroll.png`.
- **Saturnian:** 3 storms, per-seed rough 1.185 (draw varies per world), ink read present.
  `ac-live-saturnian.png`.
- **Neptunian:** 3 storms, rough 0.724. `ac-live-neptunian.png`.
- Console clean everywhere.

## WAKE_* freeze ruling (slice I's read-gate — CONSTANTS FROZEN AS-BUILT)

`WAKE_LEN 4.5 / WAKE_WID 1.2 / WAKE_BOW 0.34 / WAKE_AMP 0.22 / WAKE_K 7.0` (GLSL ≡ mirror,
parity-tested) — the annulus signature (1426 px, ~4:1 downstream) plus the visible bow/trail
read at judging distance confirm the perceptual bar at these values. No adjustment needed;
frozen as-built. The headless `WAKE_DLAT_FLOOR` (0.01 at ds/R=3, measured 0.034+) stands.
