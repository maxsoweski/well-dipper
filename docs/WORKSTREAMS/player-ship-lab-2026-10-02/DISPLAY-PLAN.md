# Display plan — player ship cockpit (DRAFT, not signed off)

Source of every data line: `reference/display-inventory.md` (code-read 2026-10-02, not checked live).
Status: Max's layout given 2026-10-02; four open questions below; needs his sign-off sentence (AC-DISPLAY-PLAN).

## Max's layout (verbatim, 2026-10-02)

> I want a circular display component that can show the mode of the ship's engine and some numeric readout
> alternatively, and to the side of that I want a line-shaped segmented throttle and speed display that can show
> how open/closed/reversed the throttle is and how fast the ship is moving compared to its max speed at sublight
> and supercruise. Somewhere close to that we should have some kind of a warp targeting/status indicator. All that
> should be on the lower portion of the dash. Above the dash should be screens where we can show the system info
> and target/scanning images

## Lower dash — instruments

| instrument | shows | data (all real today) |
|---|---|---|
| **Round gauge** | Engine mode, alternating with a number | Mode: sublight vs supercruise `drive.driveOn` (CockpitSnapshot.js:234); during a warp, warp phase `warp.state` (:206). Number: OPEN Q1 |
| **Segmented bar** (beside the gauge) | Throttle open / closed / reversed; speed against max speed | Throttle −1..+1, reverse is real `drive.throttle` (:233, ShipControls.js:43). Speed `drive.speed` (:214). Max at sublight: fixed `drive.sublightCap` (:235). Max at supercruise: the LOCAL cap `drive.speedCap` (:236) — it falls near planets, so "max" moves (see note) |
| **Warp indicator** (near both) | Warp target and warp status | Target name `warp.targetName` (:208), kind (star / nebula / cluster / galaxy) `warp.destType` (:209), phase + progress `warp.state` / `warp.progress` (:206-207), turning-to-align `warp.turning` (:210) |

Note — supercruise "max speed": the game has no single top speed in supercruise; the cap depends on how close the
nearest gravity well is (SupercruiseModel.js:85). The bar can show speed against that live cap, which means a full
bar near a planet is a much lower speed than a full bar in deep space.

Not available, so not drawn: warp charge / readiness / jump range (warp is gated only by "a target is selected and
not already warping"), fuel, hull, heat, cargo, shields, power.

## Above the dash — screens

| screen | shows | data |
|---|---|---|
| **System** | The star system you're in | Star class, temperature, luminosity, single/binary, planet count, belts, habitable zone, age — all generated (StarSystemGenerator.js:828-861) but NOT in the cockpit snapshot today; needs a new snapshot block |
| **Target / scan** | The selected object, and a picture of it | Name, distance, ETA, class, type, T_eq, composition, atmosphere, tides (shown today); radius, mass, rings, rotation, tilt, magnetic field, orbit, moon count (exist, not shown). Picture: OPEN Q2 |

## Open questions for Max

1. Round gauge's number: which one? Recommendation: current speed, so the gauge's number and the bar agree.
2. "Scanning images": what picture? Recommendation: a small picture of the selected planet/moon/star drawn by the
   game itself (it already renders them), not an image file.
3. The nav map (where you pick a planet to burn to and press BURN / WARP from inside the ship) is not in the
   layout. Recommendation: the Target screen switches to the nav map while you are choosing a destination.
4. Flight-assist mode (MANUAL / ALIGN / ASSIST, today's "MODE" line): does "mode of the ship's engine" mean this,
   the drive state (sublight / supercruise / warp), or both? Recommendation: drive state on the gauge; assist mode
   as a small label beside it.

## Sign-off

(Max's sentence goes here.)
