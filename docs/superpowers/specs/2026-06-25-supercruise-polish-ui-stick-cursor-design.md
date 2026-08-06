# Supercruise polish — Elite-style speed/throttle HUD · non-linear stick · hide-cursor

**Date:** 2026-06-25 · **Branch:** `feature/supercruise-freelook` (worktree `~/projects/well-dipper-supercruise`)
**Builds on:** `2026-06-24-supercruise-hud-movement-design.md` (Bugs A/B/C + flight-controls harness).
**Approved by Max** (brainstorming, 2026-06-25): physically-true km/s+c units; hide-cursor with the current
absolute-from-center stick (not pointer-lock).

Three polish items on the now-working manual supercruise. Research (Elite supercruise HUD grammar; industry
stick/expo curves) done via background workflow `wf_f763d374-845` — sources at the end.

---

## Item 1 — Elite-style speed/throttle HUD (also fixes the "speed reads 0" bug)

### The bug
`SupercruiseHud.update()` draws `SPD ${state.speed.toFixed(0)} u/s`. Near small bodies `speed` is ~0.01–0.05
scene-u/s → `toFixed(0)` = `"0"`. Root fix: never render raw scene-units; convert to a readable physical unit.

### Speed units — physically-true, three-tier (Elite's exact grammar)
`ScaleConstants.METERS_PER_SCENE = 149_597_870.7 m`, so **1 scene-u/s = 149,597.87 km/s = 0.499 c**.
Derived constants:
- `KM_PER_SCENE = METERS_PER_SCENE / 1000 = 149_597.8707`
- `c = 299_792.458 km/s` → **`C_IN_SCENE_PER_S = 299792.458 / 149597.8707 = 2.00399… scene-u/s`** (1 c)
- `1 Mm/s = 1000 km/s = 0.0066847 scene-u/s`

Tier thresholds (on the displayed value, Elite-style — keeps the number small/legible):
| condition (scene-u/s) | unit | displayed value |
|---|---|---|
| `< 0.0066847` (`< 1 Mm/s`) | **km/s** | `speed × KM_PER_SCENE` |
| `0.0066847 … 2.00399` (`1 Mm/s … 1 c`) | **Mm/s** | `speed × KM_PER_SCENE / 1000` |
| `≥ 2.00399` (`≥ 1 c`) | **c** | `speed / C_IN_SCENE_PER_S` |

Formatting: km/s → integer or 1-dp with thousands separators (`"149,598 km/s"`); Mm/s → 2-dp (`"2.99 Mm/s"`);
c → 2-dp under 100, else integer (`"0.50 c"`, `"9,980 c"`). Always non-zero while moving.

### New module — `src/ui/SpeedFormat.js` (pure, unit-tested)
```
import { METERS_PER_SCENE } from '../core/ScaleConstants.js';
export const KM_PER_SCENE       = METERS_PER_SCENE / 1000;           // 149597.8707
export const C_IN_SCENE_PER_S   = 299792.458 / KM_PER_SCENE;         // 2.00399… (1 c in scene-u/s)
export const MM_S_IN_SCENE_PER_S = 1000 / KM_PER_SCENE;              // 0.0066847 (1 Mm/s in scene-u/s)

// → { value: string, unit: 'km/s'|'Mm/s'|'c', raw: number }
export function formatSpeed(sceneUPerSec) { … }

// log-scale bar position. Default display window covers the live range
// (~0.0005 c near a body … 10000 c deep-space cap). Returns clamped 0..1.
export const SPEED_BAR_MIN_C = 0.0005;   // log10 = -3.30
export const SPEED_BAR_MAX_C = 10000;    // log10 = 4.00
export function speedToBarFrac(sceneUPerSec) {
  const cVal = Math.max(1e-9, sceneUPerSec / C_IN_SCENE_PER_S);
  const lo = Math.log10(SPEED_BAR_MIN_C), hi = Math.log10(SPEED_BAR_MAX_C);
  return Math.min(1, Math.max(0, (Math.log10(cVal) - lo) / (hi - lo)));
}
```

### HUD state contract (what `main.js` passes to `scHud.update(state)`)
```
{
  visible: boolean,
  speed: number,            // scene-u/s, actual (scModel.speed)
  commandedSpeed: number,   // scene-u/s, throttle × speedCap()  (the chase "pin")
  throttle: number,         // 0..1 (raw W/S throttle)
  deflection: { x, y },     // stick reticle (unchanged)
  targetPos: Vector3|null,
  targetDistance: number|null,  // scene-u, scModel.position → target
  captureSphere: number|null,   // 10R (scene-u)
  dropMaxSpeed: number|null,    // (10R)/2.5 (scene-u/s) — safe-drop ceiling
  dropState: 'none'|'in-window'|'too-fast',
}
```
`main.js` builds `commandedSpeed = scModel.throttle * scModel.speedCap()`. The drop numbers come from
extending `_scDropState()` to also return `{ d, captureSphere, dropMaxSpeed }` (single-sourced from
`scPilot.tuning` — DO NOT re-derive the 10R / (10R)/2.5 constants anywhere else).

### HUD layout (rewrite of `SupercruiseHud.update`) — bottom-left cluster + target marker
1. **Numeric speed** (large): `formatSpeed(speed).value + ' ' + .unit`. The bug fix.
2. **Log speed bar** (horizontal, ~180px): fill to `speedToBarFrac(speed)`; a **pin** (triangle/notch) at
   `speedToBarFrac(commandedSpeed)` — actual chases commanded; a **drop-here tick** at
   `speedToBarFrac(dropMaxSpeed)` when a target is selected. Fill color: blue `#7bff9e`-ish when
   `dropState==='in-window'` or speed ≤ dropMaxSpeed; amber/red `#ff7b6b` when `dropState==='too-fast'`;
   default cyan `#9fe8ff`. (Reproduces Elite's blue "sweet-spot" band, but derived from the real drop physics.)
3. **Throttle bar** (0–100%, keep the existing simple bar): fill `throttle`, with its own commanded pin.
4. **Target marker** (existing projected box) + **ETA** `M:SS` = `targetDistance / speed` (only when speed > 0
   and a target is selected; show `--:--` otherwise) + label: `SLOW DOWN` (amber) while inside captureSphere
   but too fast, `SAFE TO DROP` (green) when `dropState==='in-window'`.

The HUD imports `formatSpeed`/`speedToBarFrac` from `SpeedFormat.js`. Keep the canvas DPR/CSS-size pinning
from Bug A (`28bf089`) intact. Keep `getLastFrameState()` probe; extend `_last` with the new fields.

### Scope cut (v1) — NO auto-throttle
Elite auto-decelerates on approach. WD's model **already** auto-decelerates via the shrinking `speedCap()`
near a body, so v1 is **HUD/readout-only**: no new auto-throttle behavior (that would change flight feel and
needs its own UAT). The HUD *shows* the safe band; the player manages throttle.

---

## Item 2 — Non-linear virtual-stick response (cubic "expo" blend)

### Curve
`out = (1 − e)·m + e·m³`, default **e = 0.30**, exposed knob over **[0, 0.6]** (0 = linear). Chosen over pure
`|x|^k` because the cubic blend has a **nonzero center slope (1−e)** (fine control, no dead/mushy spot) AND
hits `out(0)=0, out(1)=1` exactly — so the downstream speed-coupled `turnRateCap()` shrink is fully preserved
(the curve is on the *stick axis only*, per the guard). This is the RC/Betaflight/DCS-standard curve.

### New module — `src/flight/stickCurve.js` (pure, unit-tested)
```
export const STICK_TUNING = {
  DEADZONE: 0.06,   // radial deadzone (matches the prior per-axis 0.06)
  EXPO: 0.30,       // cubic-blend expo, [0, 0.6]
};

// Curved magnitude for a normalized radial magnitude m_raw ≥ 0. Deadzone + rescale + cubic blend.
export function shapeMagnitude(mRaw, { deadzone = STICK_TUNING.DEADZONE, expo = STICK_TUNING.EXPO } = {}) {
  const dz = deadzone;
  const r = Math.min(1, Math.max(0, mRaw));
  if (r <= dz) return 0;
  const m = (r - dz) / (1 - dz);              // rescaled 0..1
  return (1 - expo) * m + expo * m * m * m;   // cubic blend
}

// Radial deadzone+expo on a 2D stick vector; preserves direction (NEVER per-axis → diagonals stay correct).
// Returns { x, y } with magnitude = shapeMagnitude(|in|).
export function shapeStick(x, y, opts = {}) {
  const mag = Math.hypot(x, y);
  if (mag < 1e-6) return { x: 0, y: 0 };
  const curved = shapeMagnitude(mag, opts);
  const k = curved / mag;
  return { x: x * k, y: y * k };
}
```
Invariants asserted in tests: `shapeMagnitude(0)=0`, `shapeMagnitude(1)=1`, monotonic increasing,
`shapeMagnitude(dz)=0` (continuous from 0), slope at dz⁺ ≈ `(1−expo)/(1−dz)`, and `shapeStick` preserves
direction (diagonals: `out.x/out.y == in.x/in.y`).

### Wiring (`main.js`, mouse joystick block ~9155–9167)
Replace the per-axis `shape()` (deadzone applied independently per axis — distorts diagonals) with a single
radial call:
```
import { shapeStick, STICK_TUNING } from './flight/stickCurve.js';
…
const nx = ((e.clientX - r.left) - r.width/2) / (r.width/2);
const ny = ((e.clientY - r.top)  - r.height/2) / (r.height/2);
const s = shapeStick(nx, ny, _scStickTuning);     // radial deadzone + expo
scModel.setTurnInput(-s.x, -s.y);                  // sign convention UNCHANGED (UAT-tuned)
_scDeflection = { x: s.x, y: s.y };                // HUD reticle uses the shaped value
```
Expose `_scStickTuning` (a live copy of `STICK_TUNING`) on `window._sc.stickTuning` for harness/UAT tuning.
The autopilot path (`scPilot` → `setTurnInput`) stays UNSHAPED — expo is a human-stick concern only.

---

## Item 3 — Hide the mouse cursor during manual flight (option a)

`document.body.style.cursor` toggled by a single setter so the restore can't be missed on any exit path.
```
function setScManual(on) {
  _scManual = on;
  document.body.style.cursor = on ? 'none' : '';
}
```
Replace every direct `_scManual = true/false` assignment (entry: F-key ~8749, autopilot W/S takeover ~8784;
exit: ~1951, ~5648, ~7564, F-key ~8757) with `setScManual(…)`. Guard the body-hover cursor writes
(`canvas.style.cursor = 'pointer'|''` ~9197/9224/9226) with `if (!_scManual)` so they don't repaint a pointer
while flying. Absolute-from-center stick math is untouched (no pointer-lock).

---

## Verification

**Harness-first** — extend `flight-controls-lab.html`:
- Instantiate the REAL updated `SupercruiseHud` against the real model (preview the actual shipping HUD, not a
  mock) with a fake selected target so the speed bar / drop tick / ETA render.
- Add a **deflection → achieved-turn-rate plot** (canvas): x = deflection 0..1, y = `shapeMagnitude(x) ×
  turnRateCap()`, redrawn live as the new **EXPO** slider (0..0.6) moves. Route the drag through `shapeStick`.

**Headless:** `npm test` (full vitest) + `npx vitest run src/flight/__tests__/` green; `npm run build` clean.
New tests: `src/flight/__tests__/stickCurve.test.js`, `src/ui/__tests__/SpeedFormat.test.js`.

**Live (`:9223`, the `:5174` tab only):** enter manual flight, confirm (a) speed readout never "0" and shows
km/s↔Mm/s↔c as you accelerate, (b) the log bar fill chases the commanded pin, (c) selecting a target shows the
drop tick + ETA + SLOW DOWN→SAFE TO DROP flip, (d) the stick is fine near center / faster at the edge, (e) the
cursor vanishes on entry and returns on every exit. Then Max UAT.

## Guards (carry forward)
- NEVER re-tune `CAP_MIN_FRAC` / `CAP_MIN_ABS` / `ETA_K` / `ACCEL_TAU` floors (scale-bug; two prior live
  regressions). This work does not touch the model's speed math — only readout + input shaping + cursor.
- Reuse the drop-window math (10R / (10R)/2.5) from `scPilot.tuning`; do not re-derive it.
- HARD-RELOAD the `:5174` tab after a `main.js` edit before trusting any UAT (HMR won't hot-swap the entry).
- Don't add ad-hoc debug shortcuts; extend the documented `_sc`/`_lab`/`__wd` surfaces.

## Sources (research workflow `wf_f763d374-845`)
Elite HUD: elite-dangerous.fandom.com/wiki/Supercruise · /wiki/HUD/Center · /wiki/Supercruise_Assist ·
elitepve.com "7 second rule" · commanderjavelin.blogspot.com new-pilot guide.
Stick curves: oscarliang.com/rates · betaflight.com Rate-Calculator · betaflight `src/main/fc/rc.c`
(power3/power5 blends) · dexerto.com CoD aim-response curves · DCS curvature (Steam) ·
gamedeveloper.com "Doing Thumbstick Dead Zones Right" (radial rescale).
