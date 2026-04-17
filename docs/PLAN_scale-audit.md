# Scale Audit — First-Principles Pass

**Status:** Research task, queued for start of next session BEFORE resuming portal refinement.
**Prompted by:** Max 2026-04-16 — "check the scales of everything, keeping in mind we are going to be piloting a spaceship in the main game, going to space stations, and so on. And we need all of that to work at appropriate scales compared to the bodies in solar systems."

## Why this matters

Max's gameplay vision is ship-pilot POV: you're in a spacecraft — possibly the size of a skyscraper (~500m–1km) — flying to space stations, orbiting planets, diving toward moons. For that experience to work, relative sizes have to feel right across the full stack:

```
ship  <<  station  <<  moon  <<  planet  <<  star
```

And each layer has to render correctly at the camera distances where you'd interact with it.

Current code has a mix: **planets use realistic AU-scale** (Earth is 0.042 scene units, Sun is 4.65 — per `ScaleConstants.js`), but **ships are boosted for visibility** (scaled to 0.05–0.15× the planet they orbit, so 0.002–0.07 scene units — hundreds to thousands of "real" kilometers). Portals, stations, and surface details don't have a consistent scale discipline yet.

This audit is the groundwork for a coherent scale system BEFORE adding more gameplay layers (player ship, cockpit, stations, docking).

## Scale context (as of 2026-04-16)

```
Scale constant:    1 AU = 1000 scene units       (ScaleConstants.js:39)
Implication:       1 scene unit  =  ~149,598 km
                   0.001         =  ~150 km
                   0.0001        =  ~15 km
                   0.00001       =  ~1.5 km
                   0.000001      =  ~150 m

Real radii vs scene units:
  Sun       695,700 km   →   4.65    (realistic, matches AU scale)
  Earth       6,371 km   →   0.042   (realistic)
  Mars        3,390 km   →   0.023   (realistic)
  Moon        1,737 km   →   0.012   (realistic)
  Io          1,822 km   →   0.012   (realistic)
  1 km ship           →   0.0000067  (if ship is ~1 km)
  1 km station        →   0.0000067  (if station is ~1 km)

Current ShipSpawner behavior (ShipSpawner.js:71-72):
  shipSize = max(0.002, planetRadius × (0.05 to 0.15))
  → For Earth:    ship = 0.002–0.006   =  300–900 km (way too big for a fighter)
  → For Jupiter:  ship = 0.024–0.072   =  3,600–10,770 km (planet-sized ship)

Camera (RetroRenderer.js + main.js):
  logarithmicDepthBuffer:  true
  FOV:                     50°
  near:                    0.0001 (fixed as of today)
  far:                     200,000 (= 200 AU, past Neptune orbit)
```

## The open question

Do we want **realistic ship scale** (1 km ship ≈ 6.7 nano-scene-units, invisible from even medium distance) or **cinematic compressed ship scale** (ships boosted to be visible at gameplay distances — same way planets are slightly exaggerated visually in many games)?

If realistic: space feels truly vast; ship is a speck; most of the time you see starfield + body you're close to. NPC ships are invisible except at docking distance.

If compressed: ships have presence. You can see another ship passing 1,000 km away. Station exists as a visible object at orbit-of-a-planet distance. Trade-off: relative distances feel "wrong" (a ship half the size of a moon looks weird).

Hybrid is also possible: realistic when inspecting details, compressed when at navigation distances. Requires LOD-style scale switching.

Max's wording — "from the perspective of a person in a spaceship, even if that spaceship is the size of a skyscraper, a planet is just absolutely massive" — reads as **realistic scale where it matters (planets dominate)**, with **ships big enough to see and dock with**. Probably compressed ships, realistic bodies.

## Research tasks

### Task 1: Catalog all existing scales

Grep every file that sets a visible size. Output: table of object type → scale constant/formula → current scene-unit size.

```
Object                  Source                  Current scale             What it means in km
─────────────────────────────────────────────────────────────────────────
Sun (G-class)           ScaleConstants.js       solarRadii×0.00465×1000    ~700k km ✓
Earth                   PlanetGenerator.js      0.042                      ~6,371 km ✓
Jupiter                 PlanetGenerator.js      0.48                       ~73k km ✓
Moon                    MoonGenerator.js        varies                     ?
NPC fighter             ShipSpawner.js:72       0.002–0.072                ~300–10,800 km (too big)
Asteroid                AsteroidBeltGen.js      ?                          ?
Ring system             Planet.js               ?                          ?
Warp portal aperture    WarpPortal.js           0.025                      ~3,750 km (still wrong)
Warp tunnel interior    WarpPortal.js           2.0                        ~300,000 km (wrong)
Landing strip span      WarpPortal.js           4                          ~600,000 km (wrong)
```

### Task 2: Define target scales from ship POV

Assume player ship is ~1 km (skyscraper-class, Max's example). All other scales relate back to that.

Proposed targets (for discussion — don't implement blindly):

```
Ship hull               ~1 km          =  0.0000067 scene units  (real-scale)
                                     OR 0.001 scene units  (compressed ~150×)
Space station           ~5–50 km       =  0.00003–0.00033 (real) / 0.005–0.05 (compressed)
Portal aperture         5× ship        =  0.0000334 (real) / 0.005 (compressed)
Portal rim outer        1.5× aperture  =  same ratios
Tunnel interior         ?              =  open question — is the tunnel hyperspace (any size) or local?
NPC fighter             ~0.1–1× ship   =  0.0000007–0.0000067 (real) / 0.0001–0.001 (compressed)
```

Note the compressed row is ~150× real. That matches the "ships at kilometer-scale scene units" feeling without forcing sub-micro scene coordinates.

### Task 3: Cross-check camera + near plane

At each target orbit distance, verify:
- Object fills desired field of view? (2× radius / distance = angular size)
- Near plane doesn't slice through object? (near < distance-to-surface)
- Log depth buffer handles the object-vs-background z-precision?

Example — at "fill FOV" orbit around a 0.001-unit station (1 km compressed):
```
FOV 50°:  need distance ~2.37× radius = 0.00237 from center, 0.00137 from surface
Near plane: 0.0001 ✓ (less than 0.00137, no clipping)
```

### Task 4: Audit the portal system against chosen scale

Once ship scale is decided, recompute:
- Portal aperture radius (= 5× ship)
- Preview distance (= how far is "in front of you but local")
- Tunnel length (camera travel budget must cover)
- Landing strip spacing (reasonable local runway)
- Entry strip spacing

Current portal at 0.025 radius assumes ship is ~0.005 (compressed scale). If we move to realistic scale, this also shrinks.

### Task 5: Build a ScaleConstants audit document

Extend `src/core/ScaleConstants.js` (or add a new module) with:
- Ship hull reference size (`SHIP_HULL_LENGTH`)
- Station reference size (`STATION_HULL_SIZE`)
- Portal-to-ship ratio constant (`PORTAL_SHIP_RATIO`)
- Scene-unit → meters converter helpers

Goal: every new feature pulls from these constants, no more ad-hoc scaling.

## Deliverables

1. `docs/SCALE_AUDIT.md` — findings + recommendations with concrete numbers
2. Updated `src/core/ScaleConstants.js` — ship/station constants + helpers
3. Any immediate fixes to existing code that's clearly wrong (e.g., ship scale formula)
4. Test scene or lab HTML to verify visual relationships (ship-next-to-station-next-to-planet)

## What to do AFTER this audit

Resume portal refinement (task list from 2026-04-16 session — see `well-dipper-progress.md` for the A/B/C breakdown and the active uncommitted work).
