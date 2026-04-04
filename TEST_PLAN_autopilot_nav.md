# Test Plan: Autopilot Nav Computer Sequence

## Feature
When autopilot finishes touring a star system, the nav computer opens and visually drills down through galaxy levels before warping to a new destination. Showcases different parts of the Milky Way.

## Prerequisites
- Open https://maxsoweski.github.io/well-dipper/
- Press any key to dismiss title screen
- Let autopilot run (or press A to enable autopilot)

## Test Cases

### T1: Basic sequence fires after tour completion
- **Steps:** Let autopilot tour an entire system (star + all planets + moons)
- **Expected:** Nav computer opens automatically. Shows galaxy view (full spiral). After ~2.5s, drills to sector. After ~2s, drills to region. After ~2s, drills to column (3D stars). After ~2.5s, zooms into a star. After ~2s, nav closes and warp begins.
- **Total sequence:** ~13-15 seconds from nav open to warp start
- **Pass criteria:** All 5 zoom levels visible in sequence, warp fires

### T2: Destination variety
- **Steps:** Watch 3+ complete autopilot cycles (tour → nav → warp → tour → nav → warp)
- **Expected:** Nav computer drills to visibly different parts of the galaxy each time. Not the same sector/region repeatedly.
- **Pass criteria:** At least 2 different galactic regions visited across 3 warps

### T3: User interrupt during nav sequence
- **Steps:** While the nav sequence is drilling down, click the mouse or press any key
- **Expected:** Nav sequence aborts. Nav computer closes. Autopilot stops. Camera returns to manual control.
- **Pass criteria:** No crash, clean abort, camera responsive

### T4: Warp completes normally after nav sequence
- **Steps:** Let the full nav sequence complete and warp fire
- **Expected:** Warp animation plays (fold → tunnel → exit). New system spawns. Autopilot resumes touring the new system. Nav sequence can fire again after this tour.
- **Pass criteria:** New system visible, autopilot active, no black screen

### T5: Nav computer visual correctness during sequence
- **Steps:** Watch the nav sequence carefully
- **Expected:**
  - Galaxy view: Full Milky Way spiral visible
  - Sector view: Zoomed into one sector of the grid
  - Region view: Zoomed into one tile within the sector
  - Column view: 3D star field with stars loading in
  - System view: Star's planetary system visible briefly
- **Pass criteria:** Each level renders correctly, no blank/black frames

### T6: Sound effects during sequence
- **Steps:** Watch with sound on
- **Expected:** Drill sounds play at each level transition (navDrill0 through navDrill4)
- **Pass criteria:** At least some drill sounds audible (depends on SoundEngine state)

### T7: Deep sky destination handling
- **Steps:** If a deep sky object (galaxy/nebula) is the current destination, let tour complete
- **Expected:** Nav sequence fires normally (deep sky tour uses the same onTourComplete path)
- **Pass criteria:** No crash when coming from deep sky

### T8: Rapid autopilot toggle
- **Steps:** During nav sequence, press the autopilot toggle key or nav button
- **Expected:** Sequence aborts cleanly
- **Pass criteria:** No hanging timers, no zombie nav computer

### T9: Mobile/touch
- **Steps:** On mobile/tablet, let autopilot run to completion
- **Expected:** Nav computer sequence works identically to desktop
- **Pass criteria:** Touch overlays don't interfere, nav renders in overlay

## Known Limitations
- Stars in column view load asynchronously — sequence retries up to 10 times (3s) if stars haven't loaded
- If no stars found in the target region after retries, sequence falls back to old random warp behavior
- The nav computer overlay keyboard listeners activate during the sequence — intercepted input may need tuning
- Destination list is static (16 hardcoded galactic regions) — could be dynamic based on galaxy model density
