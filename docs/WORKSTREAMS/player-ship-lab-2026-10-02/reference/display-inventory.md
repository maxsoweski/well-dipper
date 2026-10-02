# Well Dipper cockpit: display data inventory

Repo: /home/ax/projects/well-dipper-trunk. Read-only research; nothing edited. All paths below are relative to that repo.

## How data reaches the glass (read this first)

- Panels do NOT read game state. main.js builds one plain-data snapshot per frame: `_cockpitSnapshotProvider` at src/main.js:4490, built by `buildCockpitSnapshot` at src/cockpit/CockpitSnapshot.js:139. Blocks: `regime`, `warp`, `drive`, `target`, `survey`, `nav` (CockpitSnapshot.js:182-283).
- Anything a new display needs that is NOT in that snapshot (e.g. star type, planet count, ship position) needs a new block in `buildCockpitSnapshot` plus a source line in main.js:4490-4535. The generator data exists (see System table) but is not carried today.
- Four panels, role -> glass node: NAV=Screen_UL, DRIVE=Screen_UR, INFO=Screen_LL, TARGET=Screen_LR (src/cockpit/PanelLayout.js:52-57). Painters: NAV `makeNavPainter` (panels/NavPanel.js:140), DRIVE `paintDrive` (panels/DrivePanel.js:200), INFO `paintInfo` (panels/InfoPanel.js:87), TARGET `paintTarget` (panels/TargetPanel.js:210). NavHoldingCard (panels/NavHoldingCard.js:40) is a "NAV / NO SOURCE" placeholder.
- Panels repaint on an ambient timer, plus immediately on warp start/end and while a blinking alert is up (PanelHost.js:631-646, `hasBlinkingAlert` :268).
- During a warp the survey block is blanked (CockpitSnapshot.js:178) so INFO goes empty mid-warp.

## 1. System (the star system you are in)

None of this is on a panel today except the system NAME (inside the NAV map). The raw data lives in `system._systemData` (main.js:8011) = `window._systemData` (main.js:7650), output of StarSystemGenerator (src/generation/StarSystemGenerator.js:828-861). It is NOT in the snapshot.

| readout | where it comes from | shown on a panel today? | how it changes |
|---|---|---|---|
| System name | `system.names.system` / snapshot `nav.systemName` (CockpitSnapshot.js:281; main.js:4528 `_currentSystemName`); names built by `generateSystemNames` NameGenerator.js:570-600 | no (carried in snapshot, no painter reads it) | static per system |
| Primary star spectral class (O/B/A/F/G/K/M) | `systemData.star.type` StarSystemGenerator.js:222; weights :60-68 | no (INFO shows it only if that star is selected: TYPE row) | static per system |
| Star temperature (K) | `systemData.star.temp` StarSystemGenerator.js:232 (table :73-79) | no | static per system |
| Star luminosity (x Sol) | `systemData.star.luminosity` StarSystemGenerator.js:233 | no | static per system |
| Star radius (solar radii) | `systemData.star.radiusSolar` StarSystemGenerator.js:225 | no | static per system |
| Star colour (RGB) | `systemData.star.color` StarSystemGenerator.js:221 | no | static per system |
| Full authored class string (real systems only) | `star.spectFull` StarSystemGenerator.js:256 | no | static per system |
| Binary or single | `systemData.isBinary` StarSystemGenerator.js:830 | no | static per system |
| Second star type / temp / luminosity / radius | `systemData.star2` StarSystemGenerator.js:829 (same fields as primary) | no | static per system |
| Binary separation (AU) and mass ratio | `binarySeparationAU`, `binaryMassRatio` StarSystemGenerator.js:833,846 | no | static per system |
| Binary orbit angle (live) | `system.binaryOrbitAngle` main.js:8017 | no | per frame (stars orbit each other) |
| Binary stability limit (AU) | `systemData.binaryStability` StarSystemGenerator.js:717-729,859 | no | static per system |
| Far companion stars (real systems only): name, class, separation | `systemData.farCompanions` StarSystemGenerator.js:874-882 | no | static per system |
| Component sub-systems of far companions | `systemData.componentSystems` StarSystemGenerator.js:903-913 | no | static per system |
| Number of planets | `systemData.planets.length` (count rolled :493-500; 8% of systems have none) | no | static per system |
| Planet names (and moon names) | `system.names.planets[i].name / .moons[j]` main.js:8011; used in `resolveFocusedBody` CockpitSnapshot.js:115,124 | no (NAV system view draws its own labels) | static per system |
| Each planet's orbit distance (AU, scene, map) | `planets[i].orbitRadiusAU / orbitRadiusScene / orbitRadius` StarSystemGenerator.js:545-550,605 | no | static per system (migration/resonance can rewrite it at generation only) |
| Each planet's orbital speed (Kepler) | `planets[i].orbitSpeed` StarSystemGenerator.js:556 | no (a period is derivable but not stored) | static per system |
| Each planet's current orbital angle | `planets[i].orbitAngle` StarSystemGenerator.js:553 (start angle; live angle is advanced on the mesh) | no | per frame |
| Planet type (rocky, gas-giant, ice, lava, ocean, terrestrial, hot-jupiter, eyeball, venus, carbon, sub-neptune) | `planetData.type` PlanetGenerator.js:758; labels BodyInfo.js:10-22 | INFO "TYPE" row, only for the selected planet | per selection |
| Number of moons per planet | `planetData.moonCount` PlanetGenerator.js:596,780 | no | static per system |
| Asteroid belts: centre, width, thickness (AU) | `systemData.asteroidBelts[]` StarSystemGenerator.js:745-754; fields AsteroidBeltGenerator.js:141-155 | no | static per system |
| Trojan clusters (L4/L5 around gas giants) | `systemData.trojanClusters` StarSystemGenerator.js:781-805 | no | static per system |
| Habitable-zone inner/outer, frost line, scorching limit (AU) | `systemData.zones` StarSystemGenerator.js:815-827 | no | static per system |
| System age (Gyr) | `systemData.ageGyr` StarSystemGenerator.js:373-382 | no | static per system |
| System metallicity (dex) | `systemData.metallicity` StarSystemGenerator.js:362 | no | static per system |
| Formation archetype (compact-rocky, spread-giant, ...) | `systemData.archetype` StarSystemGenerator.js:423; `formation` PhysicsEngine.js:605-640 | no | static per system |
| Stellar evolution stage (main-sequence / red-giant / remnant, remnant type) | `systemData.stellarEvolution` StarSystemGenerator.js:714; PhysicsEngine.js:726-750 | no | static per system |
| Orbital resonance chain present | `systemData.resonanceChain` StarSystemGenerator.js:858 | no | static per system |
| Galactic component and spiral-arm context of the system | `systemData.galaxyContext.component`, `.armInfo {armName,isMajor,strength}` GalacticMap.js:~990-1004 | no | static per system |
| System galactic position | `systemData.galacticPosition` StarSystemGenerator.js:838 | no (see Navigation table for the player's own position) | static per system |
| Seed | `systemData.seed` StarSystemGenerator.js:837 | no | static per system |
| NPC ships present (count, archetype) | `shipSpawner.ships[]` ShipSpawner.js:121 | no | **DISABLED**: `SHIPS_ENABLED = false` main.js:184, so the list is always empty |

## 2. Selected object (star / planet / moon)

"Selected" has two feeds that can disagree: `focusIndex/focusMoonIndex/focusStarIndex` (drives INFO; main.js:361-362,10654; resolved at CockpitSnapshot.js:89) and `_selectedTarget` (drives TARGET name and distance; main.js:418, `_makeTarget` main.js:7193). FlightReadout.js:412-425 explains why they must not be merged. INFO shows a blank dossier when focus is system overview (focusIndex -1) or a ship.

| readout | where it comes from | shown on a panel today? | how it changes |
|---|---|---|---|
| Body name | snapshot `survey.name` (CockpitSnapshot.js:270) | INFO "BODY" (InfoReadout.js:213); TARGET hero name uses `target.name` (TargetPanel.js:238) | per selection |
| Body class (star / planet / moon) | snapshot `survey.kind` CockpitSnapshot.js:269 | INFO "CLASS" (InfoReadout.js:214) | per selection |
| Body type (spectral letter for a star, "terrestrial" etc. for planets/moons) | `survey.type` CockpitSnapshot.js:271 | INFO "TYPE" (InfoReadout.js:215) | per selection |
| Equilibrium temperature (K) | `survey.tEq` CockpitSnapshot.js:272; planets PlanetGenerator.js:369,789; moons MoonGenerator.js:267 | INFO "T_EQ" (InfoReadout.js:216); blank for stars | per selection |
| Surface type + iron fraction | `survey.composition` CockpitSnapshot.js:273 (PhysicsEngine.deriveComposition :390) | INFO "COMP" (InfoReadout.js:217) | per selection |
| Atmosphere: none / composition + pressure (bar) | `survey.atmosphere` CockpitSnapshot.js:274 (computeAtmosphere PhysicsEngine.js:150) | INFO "ATMO" (InfoReadout.js:218) | per selection |
| Tidal state (free / synchronous / 3:2 resonance) | `survey.tidalState` CockpitSnapshot.js:275 (checkTidalLock PhysicsEngine.js:290) | INFO "TIDAL" (InfoReadout.js:219) | per selection |
| Distance from ship to selected body | snapshot `target.distance` CockpitSnapshot.js:243 (main.js:13141 `scModel.position.distanceTo`) | TARGET "DIST" (TargetPanel.js:255; formatter :160-174) | per frame |
| Radius (Earth radii, planets and moons) | `planetData.radiusEarth` PlanetGenerator.js:768; `moon.radiusEarth` MoonGenerator.js:192 | no (BodyInfo HUD overlay prints it, BodyInfo.js:62,75) | per selection |
| Radius (solar radii, stars) | `star.data.radiusSolar` StarSystemGenerator.js:225 | no (BodyInfo.js:91) | per selection |
| Mass (Earth masses) | `planetData.massEarth` PlanetGenerator.js:787; `moon.massEarth` MoonGenerator.js:266 | no | per selection |
| Has rings / has clouds / has atmosphere layer (visual flags) | `planetData.rings/clouds/atmosphere` PlanetGenerator.js:772-774 | no (BodyInfo.js:64-66) | per selection |
| Rotation speed, axial tilt | `planetData.rotationSpeed`, `axialTilt` PlanetGenerator.js:783-784 | no | per selection |
| Magnetic field strength | `planetData.magneticField` PlanetGenerator.js:795 | no | per selection |
| Habitability score (0-1) | `planetData.habitability` PlanetGenerator.js:791 (PhysicsEngine.js:649); planets only | no | per selection |
| Orbital eccentricity | `planetData.eccentricity` PlanetGenerator.js:797 | no | per selection |
| Tidal heating | `planetData.tidalHeating` PlanetGenerator.js:798; `moon.tidalHeating` MoonGenerator.js:196 | no | per selection |
| Storms (gas giants) | `planetData.storms` PlanetGenerator.js:611 | no | per selection |
| Orbit distance from star (AU) | `planets[i].orbitRadiusAU` StarSystemGenerator.js:605 | no | per selection |
| Moon orbit distance from planet (Earth radii) and orbit speed (negative = retrograde) | `moon.orbitRadiusEarth`, `orbitSpeed`, `inclination` MoonGenerator.js:194,203-205 | no | per selection |
| Parent planet of a moon | indices `focusIndex` / `target.planetIndex` main.js:7231 | no | per selection |
| Moons in this planet's list (names) | `system.names.planets[i].moons[]` | no | per selection |
| Star physics block | `starObj.physics` is not set by StarFlare (no `physics` assignment found in src/objects/StarFlare.js), so COMP/ATMO/TIDAL read blank for stars | blank on INFO | per selection |
| Ship target (only if ships ever spawn): archetype + index, hull length | `_makeTarget('ship')` main.js:7243-7265; hull `shipHullToScene` | TARGET name only | per selection; unreachable while `SHIPS_ENABLED=false` |

Discrepancy to know about: the comments at InfoReadout.js:46-49 and CockpitSnapshot.js:251-252 (and tests FocusedBody.test.js:78, CockpitSnapshot.test.js:197-201) say moons carry no `T_eq`. Current MoonGenerator.js:267 writes `moon.T_eq`. So a focused moon probably now shows a T_EQ value, not blank. I did not run the game to confirm what the glass shows.

## 3. Ship flight and status

All from the `drive` / `regime` snapshot blocks (CockpitSnapshot.js:190-238) fed by `scModel` (SupercruiseModel, src/flight/SupercruiseModel.js).

| readout | where it comes from | shown on a panel today? | how it changes |
|---|---|---|---|
| Current speed (km/s, Mm/s or c; "REV" prefix if reversing) | `drive.speed` CockpitSnapshot.js:214; formatter FlightReadout.js:241-242, SpeedFormat.js:44-69 | DRIVE hero line (DrivePanel.js:219) | per frame |
| Speed bar (log 4 decades in supercruise, signed linear at sublight) | FlightReadout.js:259-283 | DRIVE bar (DrivePanel.js:235) | per frame |
| Commanded-speed pin on the bar (throttle x live cap) | `drive.commandedSpeed` CockpitSnapshot.js:215; main.js:4500-4502 | DRIVE bar pin (DrivePanel.js:244) | per frame |
| Throttle lever position (-1..+1) | `drive.throttle` CockpitSnapshot.js:233 (`scModel.throttle`, SupercruiseModel.js:50) | DRIVE "THR" bar (DrivePanel.js:278) | per frame (player input) |
| Drive state: supercruise ON vs sublight (dropped out) | `drive.driveOn` CockpitSnapshot.js:234 (SupercruiseModel.js:70) | DRIVE "SUBLIGHT" tag (FlightReadout.js:247, DrivePanel.js:227); also flips bar scale | per press of E |
| Local speed cap (gravity-well limit) | `drive.speedCap` CockpitSnapshot.js:236 (SupercruiseModel.js:85) | DRIVE "CAP" row (DrivePanel.js:291) | per frame (falls near bodies) |
| Turn-rate cap (deg/s) | `drive.turnRateCap` CockpitSnapshot.js:237 (SupercruiseModel.js:121) | DRIVE "TURN" row (DrivePanel.js:292) | per frame |
| Fixed sublight top speed | `drive.sublightCap` CockpitSnapshot.js:235 (SC_TUNING.SUBLIGHT_CAP SupercruiseModel.js:25) | no as a number (only sets the sublight bar scale) | static |
| Flight assist mode (MANUAL / ALIGN / ASSIST) | `regime.flightMode` CockpitSnapshot.js:192; main.js:4478 | DRIVE "MODE: ..." line (FlightReadout.js:389, DrivePanel.js:297) | per Settings change; null outside helm |
| Mass-lock warning ("TOO CLOSE - SUBLIGHT ONLY") | `target.massLockHint` CockpitSnapshot.js:248; main.js:12324,14002; text AlertCue.js:~19 | DRIVE banner, fast blink (DrivePanel.js:308) | event, ~1.5 s (90 frames, main.js:14002) |
| Safe-to-drop / slow-down cue near target | `target.dropState` CockpitSnapshot.js:245 (`_scDropState` main.js:10293, capture sphere 10R) | TARGET banner (TargetPanel.js:262) | per frame, only inside capture sphere |
| Drop-out speed ceiling and capture sphere radius | `target.dropMaxSpeed`, `target.captureSphere` CockpitSnapshot.js:246-247 | drop tick on DRIVE bar (FlightReadout.js:301); sphere radius not shown | per selection |
| Speed band (normal / in-window / too-fast) | FlightReadout.js:333-337 | computed but no panel draws it (header note :90-100) | per frame |
| Helm (hands-on) vs orrery | `regime.helm` CockpitSnapshot.js:191 (`_scManual`) | no | per toggle |
| Autopilot tour running | `regime.tour` CockpitSnapshot.js:193 (`autoNav.isActive`) | no (NAV button label mirrors it, NavComputer.js:4003) | per toggle |
| Autopilot sub-phase (IDLE / ALIGN / CRUISE / HOLD) | `regime.pilotPhase` CockpitSnapshot.js:195 (SupercruisePilot.js:12-14,88) | no | per frame |
| Warp in progress | `regime.warping` / `warp.active` CockpitSnapshot.js:194,205 (`warpEffect.isActive` WarpEffect.js:109) | no (only used to blank INFO, PanelHost.js:631) | per warp |
| Warp phase (idle / fold / enter / hyper / exit) | `warp.state` CockpitSnapshot.js:206 (WarpEffect.js:25) | no | per warp |
| Warp phase progress (0..1) | `warp.progress` CockpitSnapshot.js:207 (WarpEffect.js:27) | no | per frame during warp |
| Ship turning to face warp target | `warp.turning` CockpitSnapshot.js:210 (main.js:4468) | no | per warp start |
| Ship orientation (nose direction) | `scModel.orientation`, `nose()` SupercruiseModel.js:46,78 | no, not in snapshot | per frame |
| Ship position in the system (scene units) | `scModel.position` SupercruiseModel.js:44 | no, not in snapshot (only derived distance to target is) | per frame |
| Sim clock (ms since page load) | `t` CockpitSnapshot.js:187; SimClock.js:34 | no, it is a timestamp for repaint scheduling, not an in-fiction clock | per sim tick |

## 4. Navigation and targeting

| readout | where it comes from | shown on a panel today? | how it changes |
|---|---|---|---|
| Nav map: galaxy / sector / region / prism / system views (the whole NAV panel) | NavComputer.js:46 LEVELS; rendered via NavSource.js:291 `render()` | NAV (panels/NavPanel.js:157-266) | per frame, plus player drill-down |
| Current map level name | `nav.level` CockpitSnapshot.js:279 (NavComputer.js:359); drawn NavComputer.js:4027 | NAV (inside the map); not on any text panel | per player input |
| Current galactic sector name | `GalacticSectors.getSectorAt` GalacticSectors.js:44; `_currentSector` NavComputer.js:1050; drawn :3994 | NAV (non-system levels only; hidden at SYSTEM level) | changes as the ship warps |
| Sector bounds/size/id | sector object GalacticSectors.js:176-190 | no | static per sector |
| Player galactic position x,y,z (kpc) | `nav.galacticPos` CockpitSnapshot.js:280 (main.js:287 `playerGalacticPos`) | no (NAV prism block prints Y only) | per warp |
| Player height above galactic plane + disk/halo region | NavComputer.js:4048-4053 | NAV prism level only | per warp |
| Estimated systems in view block; view radius (ly) | NavComputer.js:4033-4036 | NAV prism level only | per zoom |
| Galactic arm name / bulge at player position | `GalacticMap.nearestArmInfo` GalacticMap.js:432-454 | no | per warp |
| Selected target name | `target.name` CockpitSnapshot.js:242 (main.js:418) | TARGET hero name (TargetPanel.js:238) | per selection |
| Selected target kind | `target.kind` CockpitSnapshot.js:241 | no (INFO shows `survey.kind`, a different feed) | per selection |
| Distance to target | `target.distance` | TARGET "DIST" (TargetPanel.js:255) | per frame |
| ETA to target (M:SS) | FlightReadout.js:345-351; gate `etaVisible` SupercruiseHud.js:20 | TARGET "ETA" (TargetPanel.js:256); only shown while aiming at the target and moving | per frame |
| Aiming at the selected target | `target.aimOnTarget` CockpitSnapshot.js:244 | indirectly (gates ETA) | per frame |
| Warp target name (a far star chosen in the sky or nav) | `warp.targetName` CockpitSnapshot.js:208 (main.js:4455-4466) | TARGET hero name with "WARP TARGET" label, only when no in-system target (TargetPanel.js:230,243) | per selection |
| Warp destination kind (star / nebula / cluster / external galaxy) | `warp.destType` CockpitSnapshot.js:209 | no | per selection |
| Warp readiness / warp charge / "can warp now" | no such state exists | no | n/a |
| Ship scanner: toggle state, ship reticles, off-screen ship arrows | `_shipScannerMode` main.js:435,13590; reticles main.js:13095-13111; spec docs/WORKSTREAMS/ship-scanner-2026-05-09.md | no | Alt toggles it, but `SHIPS_ENABLED=false` (main.js:184) means there are no ships, so it has nothing to show |

## 5. Other

| readout | where it comes from | shown on a panel today? | how it changes |
|---|---|---|---|
| Ship nav list: autopilot ON/OFF label | `_autopilotActive` NavComputer.js:235; synced main.js:13203-13208 | NAV chrome (NavComputer.js:4003), hidden in the chrome-less SYSTEM view | per toggle |
| Time of day / date / orbital date | none in the game; only sim clock ms (SimClock.js:34) and speed-scaling constants (CelestialTime.js:60-88) | no | n/a |
| Frame rate, LOD, debug physics dossier | DebugPanel.js (backtick HUD / F3), dev-only | no | per frame |
| Body info printout (type + radius + flags) | BodyInfo.js (DOM overlay, top-left) | no (separate HUD overlay, not a panel) | per selection |
| Minimap / gravity-well contour map | SystemMap, GravityWellMap (main.js:8040-8060 area) | no (separate HUD overlays) | per frame |

## Not modelled (no data exists; do not draw these)

- Fuel, hull integrity, heat, cargo, shields: confirmed absent. The standing rule is InfoReadout.js:64-70. A repo-wide grep of src/ for fuel/cargo/shield/overheat finds no ship-state variable (hits are only that comment, a JS-comment word "shield" at main.js:3974, and unrelated physics/shader files).
- Power, energy, battery, life support, crew, weapons, ammo, damage, repair.
- Warp charge, warp readiness, or a jump-range limit (warp is gated only by "a target is selected / not already warping").
- Navigation fix quality, signal strength, comms, contacts, other ships (NPC ships are disabled).
- An in-fiction clock or calendar.
- Ship coordinates inside the system and ship heading in the snapshot (the model has them, the snapshot does not carry them).
- Stars have no physics dossier (no composition/atmosphere/tidal data), so a "star details" display must use `star.data` fields (type, temp, luminosity, radiusSolar), not the survey block.

## Interactive things the current panels do

- NAV panel is the only interactive one. Clicking it is forwarded to the nav computer's `_handleClick` (NavComputer.js:4254) by PanelPointer (PanelPointer.js:~440-480, "so we can interact with the full menu").
  - Level tabs (galaxy / sector / region / prism / system): NavComputer.js:4279-4281 (tab strip drawn :3946-3948).
  - AUTOPILOT toggle button (bottom-left, "AUTOPILOT ON/OFF"): drawn NavComputer.js:4003-4016, click handled :4259-4262, wired at main.js:5877-5896 (`setOnAutopilotToggle`); inert in orrery.
  - [ BURN ] (in-system target) / [ WARP ] (other system) commit button: drawn NavComputer.js:2871-2884 and :3305-3317, click -> `_onCommit` (NavComputer.js:973); wired main.js:5863-5870 which retracts the panel and runs `dispatchNavAction` (main.js:6031; burn branch :6032-6058, warp branch :6061+). Burn is inert in orrery.
  - Search result pick also arms a warp: NavComputer.js:~727-755 (`_selectSearchResult`).
  - Both COMMIT and AUTOPILOT hide in the chrome-less SYSTEM view (`_bare`, NavComputer.js:3994,4001).
- Opening NAV zooms the panel to fill the view: `mover.zoom('NAV', ...)` main.js:5982 (N key main.js:13636, Shift+N :13889). ESC dismisses a zoomed panel (main.js:13672-13678) and sends any pending COMMIT through `closeNavComputer`.
- Clicking any other panel zooms it via PanelPicker/PanelPointer (CockpitRig.js:957-959); DRIVE, INFO and TARGET are display-only (no buttons).
- Keyboard controls that change what DRIVE/TARGET show, not panel buttons: E drops/engages supercruise drive (flightModes.js:~50 `nextDriveAction`), F toggles flight/free-look, Space or the on-screen BURN commits the selected target (`commitBurn` main.js:10320-10330), Alt toggles the ship scanner (main.js:13589).
