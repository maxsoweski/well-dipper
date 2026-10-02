# Display plan — player ship cockpit (DRAFT, not signed off)

Source of every data line: `reference/display-inventory.md` (code-read 2026-10-02, not checked live) plus
`src/flight/SupercruiseModel.js` read directly for top speeds.
Status: Max's layout given and revised 2026-10-02; needs his sign-off sentence (AC-DISPLAY-PLAN).
Aesthetic: nav systems and menus read as 4th-gen (sprites, tiled frames, simple polygons) — memory
`well-dipper-aesthetic-generations`; the 3D cockpit around them is 5th-gen; all at the 240p rule.

## Max's words (verbatim, 2026-10-02)

Layout:
> I want a circular display component that can show the mode of the ship's engine and some numeric readout
> alternatively, and to the side of that I want a line-shaped segmented throttle and speed display that can show
> how open/closed/reversed the throttle is and how fast the ship is moving compared to its max speed at sublight
> and supercruise. Somewhere close to that we should have some kind of a warp targeting/status indicator. All that
> should be on the lower portion of the dash. Above the dash should be screens where we can show the system info
> and target/scanning images

Revisions:
> segmented bar: I go back on my decision: we only need throttle in one direction, and the guage next to it can
> display/flash reverse indicator when that's the case. I DO want to figure out what the fixed top speed is, and
> have the speed relative to that displayed on the dash. I know the autopilot system determines what the
> acceptable top speed we're moving at actually is, but we can figure out what the top speed is of the ship in
> general.

> Warp: we will always warp to the center of gravity of whatever the system in question is; for this indicator I
> mean more the status of the warp drive; we can create gylphs/symbols to show what the status of the drive is:
> disengaged, targeted, engaging, firing, in warp

> for the targets: I'm thinking it would be cool to be able to fire some kind of gravitational pulse that returns
> a low-res image of the planet/object that resolves over a few seconds, then to be able to expand that into a
> readout of attributes, by bringing the screen closer to the player camera. … with some kind of a mosaic filter
> that reduces in strength until a clearer image resolves; keep in mind the aesthetic for the nav systems in-game
> is 4th gen videogames

> I said I wanted 2 screens above the dash, one for targets and one for system; the system screen would show a
> simplified system view until you bring it closer to the screen and at that point you can navigate it as the
> game's "full" nav system (galaxy down to system view)

## Lower dash — instruments

| instrument | shows | data |
|---|---|---|
| **Round gauge** | Drive state (SUBLIGHT / SUPERCRUISE; warp phase while warping), alternating with current speed as a number; flashes a REVERSE indicator while throttle < 0 | `drive.driveOn` (CockpitSnapshot.js:234), `warp.state` (:206), `drive.speed` (:214, km/s / Mm/s / c formatter SpeedFormat.js:44-69), `drive.throttle` (:233) sign. Flight-assist mode (MANUAL / ALIGN / ASSIST, `regime.flightMode` :192) as a small label beside it |
| **Segmented bar** | ONE direction: how open the throttle is (magnitude), and speed against the ship's FIXED top speed for the current drive | Throttle `|drive.throttle|`. Top speeds (fixed constants): sublight `SC_TUNING.SUBLIGHT_CAP` = 0.002 u/s ≈ 300 km/s (SupercruiseModel.js:22); supercruise `SC_TUNING.CAP_MAX` = 20,000 u/s ≈ 10,000 c (:15; 1 u/s ≈ 149,598 km/s ≈ 0.5 c). Supercruise floor `MIN_CRUISE` = 2 u/s ≈ 1 c (:24), so the supercruise scale spans 1 c → 10,000 c, four decades: log scale. The local gravity-well limit (`drive.speedCap`, :85) is a separate tick on the bar, not the bar's end |
| **Warp drive glyph** | Status of the warp drive, as one of five glyphs | DISENGAGED = no warp target and `warp.state` idle; TARGETED = `warp.targetName` set, idle; ENGAGING = `warp.turning` (ship aligning, main.js:4468); FIRING = `warp.state` fold / enter (WarpEffect.js:25); IN WARP = `warp.state` hyper (exit returns to DISENGAGED). Destination is always the target system's centre of gravity (Max) |

Not available, so not drawn: warp charge / readiness / jump range, fuel, hull, heat, cargo, shields, power.

## Above the dash — two screens

| screen | at rest | zoomed (screen brought close to the camera — zoom-to-panel already ships, `cockpit-zoom-to-panel-2026-07-29`) |
|---|---|---|
| **System** | A simplified view of the current system | The game's full nav system, galaxy down to system, operable (BURN / WARP live here, as today's NAV panel). Star data (class, temperature, luminosity, binary, planet count, belts, habitable zone, age) is generated (StarSystemGenerator.js:828-861) but not in the cockpit snapshot today: needs a new snapshot block |
| **Target** | NEW MECHANIC: fire a gravitational pulse at the selected object; a low-res image of it comes back under a mosaic filter that weakens over a few seconds until a clear image resolves | A readout of the object's attributes: name, distance, ETA, class, type, T_eq, composition, atmosphere, tides (shown today) + radius, mass, rings, rotation, tilt, magnetic field, orbit, moon count (exist, not shown) |

Picture source for the pulse (working-Claude's call, open to Max's override): the game renders the selected body
itself into the screen, then pixelates it. No image files.

## Where this lands in the program

The lab step (increment 1) only needs the PLACEMENT: round gauge + bar + glyph on the lower dash, two screens above
it. Everything that draws on them is increment 4; the gravitational-pulse scan is a new gameplay mechanic and gets
its own scoped contract when we reach it.

## Sign-off

(Max's sentence goes here.)
