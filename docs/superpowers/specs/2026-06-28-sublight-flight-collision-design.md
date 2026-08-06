# Design Spec — Sublight Flight + Collision Safety (Piece B-c)

**Date:** 2026-06-28 · **Branch:** `feature/supercruise-freelook`
**Predecessor:** Piece A (`61980fb`, targeting brackets + contextual ETA, shipped-pending-Max-UAT).
**Grounding map:** `docs/superpowers/specs/2026-06-28-piece-b-sublight-mass-grounding-map.md` (read for file:line anchors; line numbers there predate Piece A — re-grep before editing).

---

## 0. Why this exists (outcome traceability)

**IUAT Issue 2:** when you drop out of supercruise at a body, the ship is *fully parked* — drive-OFF decays speed to 0 and ignores throttle, so W/S do nothing. Arriving at a planet is a dead-end: you reach it but can't *be there and maneuver around it*. This piece adds sublight propulsion so the destination becomes a place you fly in, not a wall you stop at — serving the core supercruise/flight-feel player experience.

Max then added a hard requirement during scoping: **you must never be able to fly through a body.** That folds in a collision barrier + a forced supercruise drop-out near bodies, with stars deadlier than planets/moons.

This piece is **positional safety only** — no heat/damage near stars (deferred), no gravitational pull simulation (explicitly out of scope; see §8).

---

## 1. Decisions locked (with Max, 2026-06-28)

| # | Decision | Choice |
|---|----------|--------|
| Throttle | Sublight throttle behavior | **Full-stop + forward + reverse** (bipolar throttle axis) |
| Readout | How the HUD signals sublight | **"SUBLIGHT" label + dedicated (linear bipolar) speed bar** |
| Sublight cap | What sets sublight top speed | **Fixed constant ~300 km/s**, no mass, live-tunable |
| Forced drop | Near-body supercruise safety | **Mass-based escape-velocity horizon**, scoped to stars (planets/moons floor-dominated) |
| Mass-lock | Re-engage inside the drop zone | **Blocked**, with a "TOO CLOSE" HUD hint |
| Gravity sim | Real gravitational pull | **No** — horizon is a derived *threshold*, not a force |

---

## 2. The physics (forced-drop horizon)

"How close before you're pulled in" is governed by **escape velocity** `v_esc(d) = √(2GM/d)` — the speed needed at distance `d` to coast to infinity against the body's gravity. The meaningful horizon is the distance where escape velocity rises to meet the ship's top speed `v_ref`:

```
d_horizon = 2·G·M / v_ref²            (∝ mass; radius does NOT enter)
```

Radius enters only as the **collision floor** (you can't go below the surface). So the unified forced-drop distance per body is:

```
forced_drop_distance = max( FORCED_DROP_FLOOR_FACTOR × radius ,  2GM / v_ref² )
```

with `v_ref = SUBLIGHT_CAP` (~300 km/s). Worked consequences:

- **Planets / moons:** surface escape velocity is 11–60 km/s (Earth ~11, Jupiter ~60) ≪ 300, so the mass term lands *inside* the body → the `floor × radius` term wins. They're always ~1.1R. **Mass is irrelevant for them** — which is why we only need *star* mass.
- **Stars:** surface escape velocity exceeds 300 (Sun ~618 km/s) → the mass term dominates. A G-class star (1 R☉ rendered = 4.65 scene-u) lands the horizon at ~4.24 R☉ ≈ 19.7 scene-u. More massive star → larger multiple, automatically (a blue giant pushes you out farther than a red dwarf — the flat-tier approach couldn't do that).

**Worked check (G-star):** M = 1.989e30 kg, v_ref = 3e5 m/s → `d = 2·6.674e-11·1.989e30 / (3e5)² = 2.95e9 m = 4.24 R☉ = 19.7 scene-u`. Floor = 1.1 × 4.65 = 5.1 scene-u. `max(5.1, 19.7) = 19.7` → mass term dominates. ✓

**Note on role:** the forced drop is a *safety net*, not the normal arrival path. Players normally drop out manually (E) at the existing drop window (further out) and sublight around from there. The forced drop only fires if you stayed in supercruise dangerously close.

---

## 3. Architecture overview

Motion + collision live in the **pure model** (`SupercruiseModel`); the drive-state machine (when to force-drop, mass-lock, choreography) lives in **main.js** where the E-key/`nextDriveAction` logic already is; the **horizon math** is a new pure helper; the **readout** is `SpeedFormat` (pure) + `SupercruiseHud` (view).

The model is already ~80% ready: `speed` is signed (reverse < 0), `throttle` is already `-1..1`, translation already moves backward for negative speed, the gravity clamp already preserves sign, and the **HUD already renders reverse** (REV prefix + bipolar throttle bar). The core change is the drive-OFF branch.

---

## 4. Units of work

### Unit 1 — Sublight propulsion (drive-OFF regime)
**File:** `src/flight/SupercruiseModel.js` `update()`, the `else` (drive-OFF) branch (currently `speed *= exp(-dt/DROP_TAU)`).
**Change:** exp-approach toward `throttle × SUBLIGHT_CAP` — the same math the drive-ON path uses, minus the `MIN_CRUISE` floor (full stop allowed) and allowing negative targets (reverse):
```
// drive OFF (sublight)
const cap = this.tuning.SUBLIGHT_CAP;
const target = this.throttle * cap;            // throttle ∈ [-1,1] → reverse … stop(0) … forward
const k = 1 - Math.exp(-dt / this.tuning.SUBLIGHT_TAU);
this.speed += (target - this.speed) * k;
```
The existing gravity clamp (preserves sign) and the snap-to-zero (`|speed| < 1e-9`) below it are unchanged. Full-stop and reverse fall out for free; no new translation code.
**Tests:** OFF + throttle 1 → speed→+cap; OFF + throttle 0 → speed→0 (full stop); OFF + throttle −1 → speed→−cap (reverse); OFF + high initial speed + throttle 0 → decays to 0 (dropout settle).

### Unit 2 — Tuning constants
**File:** `src/flight/SupercruiseModel.js` `SC_TUNING`.
- **Add** `SUBLIGHT_CAP: 0.002` — u/s, ≈ 300 km/s (300 / 149,597.87). Fixed sublight top speed, no mass. **KEY TUNING KNOB.** Also serves as `v_ref` for the horizon.
- **Rename** `DROP_TAU` → `SUBLIGHT_TAU` (keep 0.4). Now governs the OFF-branch exp-approach (both the hard decel on dropout *and* throttle response at sublight).
- **Add** `FORCED_DROP_FLOOR_FACTOR: 1.1` — center-distance multiple of radius; the minimum forced-drop buffer (dominates for planets/moons).
- **Add** `COLLISION_FACTOR: 1.05` — uniform hard-barrier multiple of radius (all bodies; see Unit 3 for why uniform).
**Tests:** none (constants); covered via Units 1/3/4.

### Unit 3 — Hard collision barrier (the "never fly through" guarantee)
**File:** `src/flight/SupercruiseModel.js` `update()`, after the translation step (`position.addScaledVector(...)`).
**Mechanic:** for each body, if the new `position` is within `COLLISION_FACTOR × radius` of the body center, project it back out onto that barrier sphere and zero the speed:
```
for (const b of this._bodies) {
  const d = this.position.distanceTo(b.position);
  const barrier = this.tuning.COLLISION_FACTOR * b.radius;
  if (d < barrier) {
    // push out along (ship − body); degenerate (d≈0) → use nose() as fallback dir
    dir = d > 1e-9 ? (position − b.position)/d : this.nose();
    this.position.copy(b.position).addScaledVector(dir, barrier);
    this.speed = 0;
  }
}
```
Runs **every tick, both regimes** — the universal guarantee. Bodies don't overlap, so at most one is violated per tick (single pass is sufficient). You can still turn freely and fly *away*: the clamp only fires when a step crosses *inward* (turning away → new position is outside → no clamp).
**Why uniform 1.05 (no star tier):** the barrier only needs to stop penetration of the visible surface. Stars are kept far via the mass-based forced-drop (Unit 4); their special danger is the *horizon*, not the barrier. A bigger star standoff would only matter with heat/damage (deferred). Keeping it uniform also avoids needing a star flag on the autopilot seed body-lists.
**Tests:** approach a body head-on past the barrier → position clamped to `1.05R`, speed 0; then rotate 180° + throttle forward → position moves outward freely (can leave); degenerate at-center step → projected out along nose, no NaN; reverse away from barrier never clamps.

### Unit 4 — Mass-based forced-drop horizon
**New file:** `src/flight/proximityHorizon.js` (pure; unit-tested). Two functions:
```
starMassKgFromSceneRadius(sceneRadius)   // solarRadii = sceneRadius / solarRadiiToScene(1); massSolar = solarRadii^1.25; × M_SUN
forcedDropRadiusScene(massKg, vRefScenePerSec)  // 2·G·M / v_ref² in SI, then meters→scene
```
Imports `G`, `M_SUN` (newly **exported** from `src/generation/PhysicsEngine.js` — they're physical constants; exporting avoids duplication/drift), and `solarRadiiToScene` / `sceneToMeters` / `metersToScene` from `ScaleConstants`. `v_ref` is `SUBLIGHT_CAP` converted to m/s.

**Builder change** — `src/main.js` live `_scBodies` builder (currently `main.js:7785` star, `7788` star2): attach `massKg` to the **star pushes only** (planets/moons stay `{position, radius}` — floor-dominated, mass omitted ⇒ treated as 0). The seed/resolver builders (`main.js:681/682`, `613/616`) are **not** changed — they feed autopilot simulation, which doesn't run the forced-drop orchestration (that's manual-flight-only, §Unit 5) and whose barrier (Unit 3) is mass-free.

**Model query** — `src/flight/SupercruiseModel.js` new pure method:
```
proximityDropRequired() {
  for (const b of this._bodies) {
    const floor = this.tuning.FORCED_DROP_FLOOR_FACTOR * b.radius;
    const horizon = b.massKg ? forcedDropRadiusScene(b.massKg, vRefScene) : 0;
    if (this.position.distanceTo(b.position) < Math.max(floor, horizon)) return true;
  }
  return false;
}
```
(`vRefScene = this.tuning.SUBLIGHT_CAP`.) Used by main.js for both the forced drop and the mass-lock (same query).
**Tests:** `starMassKgFromSceneRadius(4.65)` ≈ 1 M☉ (1.989e30 kg) within tolerance; `forcedDropRadiusScene(1.989e30, vRef)` ≈ 19.7 scene-u; `proximityDropRequired` true inside / false outside the horizon for a star; false for an Earth-radius body with no `massKg` until within the 1.1R floor.

### Unit 5 — Forced-drop orchestration + mass-lock
**File:** `src/main.js`.
- **Sim step** (the per-tick block that builds `_scBodies` and calls `scModel.update`): after building the live body list, in manual flight only (`_scManual && scModel.driveOn`), if `scModel.proximityDropRequired()` → `scModel.setDrive(false)` + `scModel.setThrottle(0)` + `shipChoreographer.dropImpulse()` + `console.log('[MODE] forced proximity drop')`. (Gated to manual flight so autopilot manages its own approach.)
- **E-key handler** (`main.js:9124`, the `'reengage'` and `'engage'` branches): if `scModel.proximityDropRequired()`, **block** the (re)engage and surface a "TOO CLOSE" hint instead of calling `setDrive(true)`. Prevents the engage→instant-force-drop flicker (mass-lock).
**Tests:** integration/live (not unit) — drive a body approach in Sol and confirm forced drop + blocked reengage.

### Unit 6 — Throttle reset on drive transitions
**File:** `src/main.js` E-key handler (`'dropout'` and `'reengage'` branches), plus the Unit-5 forced-drop path.
**Change:** on every drive transition, `scModel.setThrottle(0)`. **Why:** holding S in supercruise silently drives throttle to −1 (floored to no-effect in the ON branch); without a reset you'd lurch into reverse the instant the drive goes OFF. Reset → you drop out and **settle to a stop**, then W/S to maneuver. Also fix the stale `setThrottle clamps to 0..1` comment (`main.js:8080`) — it's −1..1.
**Tests:** covered live with Unit 5.

### Unit 7 — Readout (SUBLIGHT label + dedicated bar)
**File A:** `src/ui/SpeedFormat.js` — add pure `sublightBarFrac(speed, cap)` → signed `[-1, 1]` = `clamp(speed/cap, -1, 1)` (linear, bipolar). The existing log `speedToBarFrac` pins ~4% at sublight cap, so sublight needs its own linear scale.
**File B:** `src/ui/SupercruiseHud.js`:
- When `state.driveOn === false`: replace the **log speed bar** (lines ~93-99) with a **center-anchored bipolar bar** driven by `sublightBarFrac(speed, sublightCap)` (left = reverse, center = stopped, right = forward). The `REV ` speed prefix (line 80) and bidirectional throttle bar (lines 115-139) already exist — unchanged.
- Add a **"SUBLIGHT"** mode label (distinct color, e.g. amber) shown while `driveOn === false`, near the speed cluster. (The existing top-center `MODE: …` reflects flight-assist mode, a different axis — keep both.)
- Add a **"TOO CLOSE"** hint (brief, near center) when the player attempts a mass-locked reengage (fed via a transient state flag from Unit 5).
**File C:** `src/main.js` HUD feed (`scHud.update({...})`, `main.js:8502`): add `driveOn: scModel.driveOn` and `sublightCap: SC_TUNING.SUBLIGHT_CAP`; make `commandedSpeed` regime-aware → `scModel.driveOn ? scModel.throttle * scModel.speedCap() : scModel.throttle * SC_TUNING.SUBLIGHT_CAP`.
**Tests:** `sublightBarFrac(+cap)=1`, `(0)=0`, `(-cap)=-1`, `(2×cap)=1` (clamped), sign preserved. HUD drawing is live-verified.

### Unit 8 — turnRateCap reverse robustness
**File:** `src/flight/SupercruiseModel.js` `turnRateCap()` (line 91). Use `Math.abs(this.speed)` in the `frac` so reverse motion doesn't inflate turn rate above `TURN_RATE_MAX`.
**Test:** `turnRateCap` at speed −X equals that at +X.

---

## 5. Tuning constants (all live-tunable)

| Constant | Default | Meaning |
|----------|---------|---------|
| `SUBLIGHT_CAP` | `0.002` u/s (~300 km/s) | sublight top speed; also `v_ref` for the horizon |
| `SUBLIGHT_TAU` | `0.4` s | OFF-branch exp-approach time constant (renamed from `DROP_TAU`) |
| `FORCED_DROP_FLOOR_FACTOR` | `1.1` × radius | minimum forced-drop buffer (dominates for planets/moons) |
| `COLLISION_FACTOR` | `1.05` × radius | uniform hard barrier (never fly through) |

Star forced-drop distances emerge from mass (no star-specific constant).

---

## 6. Deliberate non-goals (YAGNI)

- **No mass for planets/moons** in the flight model — they're floor-dominated; only star mass matters, and it's re-derived from radius at the seam (no upstream generator/persistence change; not the deferred B-a/B-b SOI work).
- **No gravitational pull / acceleration** — the model still only translates along the nose by throttle. The horizon is a derived threshold distance, not a force (§8).
- **No heat/damage near stars** — positional safety only.
- **No separate sublight module** — reuse the model's OFF branch.
- **No asymmetric reverse** — reverse cap == forward cap for v1.
- **No new input keys** — S already drives throttle negative.

---

## 7. Test plan

**Unit (TDD, `npx vitest run src/flight src/ui`):** Units 1, 3, 4, 7, 8 as listed (pure: sublight regime, collision clamp + can-leave, horizon math + `proximityDropRequired`, `sublightBarFrac`, turn-rate abs).
**Adversarial review:** subagent (`model:"opus"`) after green — focus on the collision clamp (tunneling, degenerate-at-center, multi-body), the horizon unit bridge, and the mass-lock not soft-locking the player.
**Live (working-Claude, chrome-devtools, Sol):** drop out → W/S/stop/reverse maneuver; SUBLIGHT label + bipolar bar render; approach a planet head-on → clamps at surface, can turn and leave; approach the star → forced drop at several radii + blocked reengage + TOO CLOSE hint.
**UAT:** Max's gate alone (feel of sublight + the safety net).

---

## 8. Open / flagged

- **Gravity-sim boundary (flagged to Max):** near a star you're force-dropped at ~4R and mass-locked out of supercruise, but with no real pull you can still sublight back out (slowly). Acceptable "stars are a hassle zone" feel without a physics rewrite. Real gravitational capture/death would be a separate, much larger feature.
- **Star mass precision:** re-derived from rendered radius via `^1.25`; may differ slightly from the generator's `starMassSolar` (computed from `radiusSolarVaried`). Tolerable for a tunable safety distance; persisting `starMassSolar` onto `system.star.data` is a future refinement if precision ever matters.
- **`v_ref` coupling:** the horizon uses `SUBLIGHT_CAP` directly as `v_ref`. If tuning ever needs them decoupled, split out a `HORIZON_REF_SPEED` constant.
