# Well Dipper — Movement & Camera Test Plan

Focus: Player movement, camera system, physics-driven flight, and autopilot.

---

## P0: Critical Path

If ANY P0 test fails, the movement system is fundamentally broken.

### [P0-001] Orbit camera works
**Priority:** P0
**Precondition:** App loaded, star system visible
**Steps:**
1. Left-drag mouse horizontally
2. Left-drag mouse vertically
3. Scroll wheel up and down
**Expected:** Horizontal drag rotates camera around planet (yaw). Vertical drag tilts (pitch, clamped to avoid flipping). Scroll zooms in/out smoothly with damping.
**Verify:** Code — ShipCameraSystem.update() applies smoothedYaw/smoothedPitch/smoothedDistance to camera position. Browser — planet stays centered while camera orbits.

### [P0-002] Camera doesn't crash or produce NaN
**Priority:** P0
**Precondition:** Any state
**Steps:**
1. Rapidly scroll zoom in/out
2. Drag wildly
3. Warp to a new system
4. Check camera position after each
**Expected:** Camera position and rotation never become NaN or Infinity. No visual glitches (camera inside planet, black screen, etc.)
**Verify:** Unit test — update() with extreme inputs never produces NaN. Code — clamp checks on distance, pitch.

### [P0-003] Warp between systems works
**Priority:** P0
**Precondition:** In a star system
**Steps:**
1. Trigger warp (Space or nav computer)
2. Wait for warp animation
3. Arrive at new system
**Expected:** Warp effect plays (fold→enter→hyper→exit). New system generates and renders. Camera lands in a valid orbit position around the new star.
**Verify:** Browser — visual warp sequence completes without freeze. Code — WarpEffect state machine transitions cleanly.

### [P0-004] Autopilot tour works
**Priority:** P0
**Precondition:** In a star system, idle
**Steps:**
1. Wait for autopilot to engage (idle timeout)
2. Watch camera fly between objects
**Expected:** Camera smoothly moves between star, planets, moons using Hermite spline paths. No sudden jumps or freezes. Eventually tours all interesting objects.
**Verify:** Code — FlythroughCamera.update() produces smooth interpolation. AutoNavigator builds valid tour queue.

---

## P1: Physics-Driven Flight

These tests verify that FlightDynamics actually controls camera position — the core connection that's currently missing.

### [P1-001] FlightDynamics gravity integration is correct
**Priority:** P1
**Precondition:** Unit test environment
**Steps:**
1. Create FlightDynamics with a body at origin (mass M)
2. Place ship at distance r with zero velocity
3. Update for N frames
**Expected:** Ship accelerates toward body. Acceleration ≈ GM/r². Position changes in the correct direction.
**Verify:** Unit test — position after 100 frames is closer to body than starting position. Acceleration magnitude matches expected value within 5%.

### [P1-002] Circular orbit stability
**Priority:** P1
**Precondition:** Unit test environment
**Steps:**
1. Place ship at distance r with velocity = circular velocity (perpendicular to radial)
2. Update for 1000 frames
**Expected:** Ship stays at approximately the same distance (drift < 15%). Flight state detects ORBIT.
**Verify:** Unit test — distance after 1000 frames within 15% of initial. State === ORBIT after ~10 frames.

### [P1-003] Player thrust moves camera in flight mode
**Priority:** P1
**Precondition:** Flight mode active (gravity initialized)
**Steps:**
1. Press W (forward thrust)
2. Hold for 2 seconds
3. Release
**Expected:** Camera accelerates forward. After release, camera decelerates due to drag. Position changes smoothly.
**Verify:** Code — setFlightInput() feeds into FlightDynamics thrust. Camera position updates from flight.position. Browser — visible forward movement.

### [P1-004] WASD directional thrust works
**Priority:** P1
**Precondition:** Flight mode
**Steps:**
1. Press W (forward), S (backward), A (left), D (right)
2. Press Shift+W (boosted forward)
**Expected:** Each key produces thrust in the correct direction relative to camera facing. Shift multiplies thrust by boost factor (3x). All directions work independently.
**Verify:** Unit test — velocity vector changes in expected direction for each input.

### [P1-005] Flight state transitions work
**Priority:** P1
**Precondition:** Flight mode with gravity
**Steps:**
1. Start at rest near a body → should be IDLE
2. Apply thrust → transitions to FREE
3. Reach circular velocity → transitions to ORBIT
4. Thrust above escape velocity → transitions back to FREE
**Expected:** State machine transitions at correct thresholds. No rapid oscillation between states.
**Verify:** Unit test — each transition fires at documented thresholds. Hysteresis prevents flicker.

### [P1-006] CinematicDirector compositions render
**Priority:** P1
**Precondition:** Flight mode, various states
**Steps:**
1. In ORBIT state → director should output BODY_PORTRAIT composition
2. Apply thrust to leave orbit → DEPARTURE_WATCH (3s) then TRACKING_FORWARD
3. Approach a body → ARRIVAL_ANTICIPATION
4. Stop moving → SCENIC_DRIFT
**Expected:** Camera look-at target and offset change based on composition. Smooth blending between compositions (no snapping).
**Verify:** Unit test — composition state matches flight state. Look target moves smoothly (no NaN, no jumps > threshold per frame).

### [P1-007] Approach body command works
**Priority:** P1
**Precondition:** Flight mode, planet visible
**Steps:**
1. Click on a planet
2. Camera should fly toward it
3. Arrive and settle into orbit
**Expected:** Ship decelerates as it approaches. Settles into circular orbit at appropriate distance. Camera frames the planet nicely.
**Verify:** Code — approachBody() sets target, braking logic fires, state transitions to ORBIT.

### [P1-008] Orbit mode ↔ Flight mode switch
**Priority:** P1
**Precondition:** In a star system
**Steps:**
1. Start in orbit mode (default)
2. Press WASD → should enter flight mode
3. Stop moving, wait → should return to orbit mode
**Expected:** Transition is smooth — no camera jump between modes. Orbit target preserved when returning.
**Verify:** Code — mode switch logic in ShipCameraSystem. Camera position continuous across transition.

---

## P2: Edge Cases

### [P2-001] Zoom limits enforced
**Priority:** P2
**Precondition:** Orbit mode
**Steps:**
1. Scroll zoom all the way in
2. Scroll zoom all the way out
**Expected:** Distance clamped between minDistance (0.01) and maxDistance (50000). No camera inside planet. No camera at infinity.
**Verify:** Code — distance clamp in update(). Unit test — distance never exceeds bounds.

### [P2-002] Free-look returns cleanly to orbit
**Priority:** P2
**Precondition:** Orbit mode
**Steps:**
1. Middle-click to enter free-look
2. Look around
3. Release middle button
**Expected:** Camera smoothly slerps back to orbit orientation. No snap or jump. Orbit target unchanged.
**Verify:** Code — return-to-orbit logic in ShipCameraSystem. Browser — smooth transition visible.

### [P2-003] Warp during orbit doesn't crash
**Priority:** P2
**Precondition:** Orbiting a planet
**Steps:**
1. Trigger warp while in orbit
**Expected:** Warp initiates cleanly. No crash from orbit state cleanup. Camera transitions to warp state.
**Verify:** Code — enterWarp() in FlightDynamics freezes physics. State → WARP.

### [P2-004] Gravity field updates when system changes
**Priority:** P2
**Precondition:** Warp to new system
**Steps:**
1. Warp from system A to system B
2. Check gravity field
**Expected:** GravityField is reinitialized with new system's bodies. Old bodies removed. No references to destroyed Three.js objects.
**Verify:** Code — clearGravity() called before initGravity() on system change.

### [P2-005] Touch input works for orbit
**Priority:** P2
**Precondition:** Touch device or emulation
**Steps:**
1. Single-finger drag → orbit
2. Two-finger pinch → zoom
**Expected:** Same behavior as mouse drag/scroll. No accidental free-look entry on touch.
**Verify:** Code — touch handlers in ShipCameraSystem map to same orbit logic.

### [P2-006] Camera near-plane scales with distance
**Priority:** P2
**Precondition:** Any mode
**Steps:**
1. Zoom very close to a planet surface
2. Zoom far away to see whole system
**Expected:** Near objects don't clip (near plane small enough). Far objects don't z-fight (near plane not too small). Dynamic near-plane scaling based on camera distance.
**Verify:** Code — near-plane calculation in main.js animate loop.
