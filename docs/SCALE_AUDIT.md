# Scale Audit — Well Dipper

**Status:** In progress. Task 1 complete (2026-04-16). Tasks 2–5 pending.
**Prompt:** `docs/PLAN_scale-audit.md`
**Scale decision (Max 2026-04-16):** Realistic body/distance scale as the base. Gameplay (multi-ship combat, docking, close maneuvers) takes place at unrealistically close ranges, with a sci-fi in-universe explanation. Nav-computer augmented vision fills the visibility gap at realistic scale — HUD can "patch in" contacts that would be sub-pixel otherwise.

Scale conversion (from `src/core/ScaleConstants.js`):

```
1 AU = 1000 scene units   →   1 scene unit = ~149,598 km
0.001 scene unit = ~150 km
0.0001 = ~15 km
0.00001 = ~1.5 km
0.000001 = ~150 m
```

---

## Task 1 — Catalog of existing scales

### Bodies (rendered at **realistic** scene scale)

| Object | Source | Formula / range | Scene-unit size | Real km | Notes |
|---|---|---|---|---|---|
| Star O | `StarSystemGenerator.js:59` | `solarRadii × 0.00465 × 1000` | ~55.8 | ~8.3M km | 12.0 R☉ |
| Star G | `StarSystemGenerator.js:63` | `1.0 × 0.00465 × 1000` | 4.65 | ~695k km | Sun-equivalent |
| Star M | `StarSystemGenerator.js:65` | `0.3 × 0.00465 × 1000` | 1.40 | ~209k km | Red dwarf |
| Rocky planet | `PlanetGenerator.js:325` | `earthRadiiToScene(0.3–0.8)` | 0.013–0.034 | 1,910–5,100 km | Mercury-to-Mars |
| Terrestrial | `PlanetGenerator.js:326` | `(0.8–1.5) × 0.0000426 × 1000` | 0.034–0.064 | 5,100–9,550 km | Earth-class |
| Sub-Neptune | `PlanetGenerator.js:333` | `(2.5–4.0) × earthRadii` | 0.107–0.170 | 15,900–25,500 km | Neptune = 3.88 R⊕ |
| Gas giant | `PlanetGenerator.js:334` | `(6.0–14.0) × earthRadii` | 0.256–0.596 | 38,200–89,400 km | Jupiter-class |
| Hot-Jupiter | `PlanetGenerator.js:335` | `(8.0–16.0) × earthRadii` | 0.341–0.681 | 51,000–102k km | Inflated |
| Moon (rocky) | `MoonGenerator.js:217-218` | `fraction(0.03–0.08) × parent.radiusEarth` | varies | 200–5,000 km | Small |
| Moon (large) | `MoonGenerator.js:215-216` | `fraction(0.15–0.25) × parent` | varies | 1,000–8,000 km | Titan/Ganymede-class |
| Moon (gas-giant satellite) | `MoonGenerator.js:210-213` | `fraction(0.04–0.20) × parent` | varies | 1,500–15,000 km | Io/Europa/Ganymede |
| Orbit distance | `StarSystemGenerator.js:316-318` | `orbitAU × 1000` | e.g. 1,000 (Earth) | 149.6M km | Realistic |
| Ring inner | `Planet.js:1107, 1241` | `data.radius × rings.innerRadius` | multiplier 1.1–1.5× | scales with planet | Roche-computed |
| Ring outer | `Planet.js:1108, 1242` | `data.radius × rings.outerRadius` | multiplier 1.5–3.0× | scales with planet | PhysicsEngine:844-857 |

### Flavor / decorative objects (mixed conventions — NOT in realistic scale)

| Object | Source | Current value | Real km equiv | Problem |
|---|---|---|---|---|
| **NPC ship** | `ShipSpawner.js:20, 72` | `max(0.002, planetRadius × 0.05–0.15)` | **300–10,770 km** | Ship is 30–2,000× too big. At Earth → 300–900 km (already city-class+). At Jupiter → up to Pluto-sized. |
| Ship orbit distance | `ShipSpawner.js:84` | `planetRadius × 2.5–5.5` | e.g. at Earth 0.11–0.23 → 16K–34K km | Ships hover close, reasonable given planet scale. |
| Asteroid individual | `AsteroidBeltGenerator.js:99` | `0.012 + t^6 × 0.06` | **~1,800–10,800 km** | Uses **map units** — belt geometry is mixed map/scene. Individual rocks are planet-scale. |
| Asteroid belt width | `AsteroidBeltGenerator.js:145, 152` | map units + `widthScene` | scene-unit width available but renderer uses map | Dual-unit belt — needs reconciliation. |
| StarFlare bloom | `StarFlare.js:148` | `starRadius × 30` | e.g. G-class → 140 scene | Visibility hack — intentional; keeps star legible at distance. |
| Planet billboards | `PlanetBillboard.js` (via `Billboard.js:97-119`) | scale-corrected to constant **screen-space px** | N/A | Visibility hack for distant bodies. Works by design. |

### Warp / portal system (2026-04-16 afternoon values, ship-local scale)

| Object | Source | Current value | Real km | Designed for |
|---|---|---|---|---|
| Portal aperture | `WarpPortal.js:63` | `radius = 0.025` | ~3,750 km | "5× a ~0.005 ship" — but ships are themselves oversized. Will shrink when ship is realistic. |
| Tunnel interior radius | `WarpPortal.js:63` | `2.0` | ~300,000 km | TARDIS-interior, decoupled from aperture. Reads as "hyperspace corridor" from inside. |
| Tunnel length | `WarpPortal.js:63` | `200` | ~30M km (~0.2 AU) | Fits HYPER_DUR=3s × ~80u/s. |
| Portal preview distance | `main.js:377` | `_portalLabPreviewDistance = 2` | ~300,000 km | Spawn point for Portal A during lab-mode alignment. |
| Entry strip span | `WarpPortal.js:408-409` | `5 × 0.4 = 2u` | ~300,000 km | Matches preview distance. |
| Landing strip span | `WarpPortal.js:373-374` | `20 × 0.2 = 4u` | ~600,000 km | "Runway" past Portal B. |
| Rim sprite side offset | `WarpPortal.js:372, 411` | `radius × 2.0` | ~7,500 km | Cross sprites ±2r from tunnel axis. |

### Camera + rendering bounds

| Parameter | Source | Value | Notes |
|---|---|---|---|
| FOV | `main.js:74` (settings-driven) | 50° default | User-configurable via Settings panel. |
| Near plane | `main.js:4597, 5535` | **0.0001** (simplified 2026-04-16 PM) | Was distance-scaled `max(0.0001, min(1.0, dist × 0.01))`. Simplified after log-depth buffer made it redundant. |
| Far plane | `main.js:74` | 200,000 | = 200 AU (past Neptune orbit). Extended dynamically up to nebula-needed size (see `main.js:2665, 2706`). |
| Log depth buffer | `RetroRenderer.js` | `true` | Handles the 10-order-of-magnitude range from 0.0001 near to 200k far. |

### Galactic scale (separate coordinate frame — NOT scene units)

| Parameter | Source | Value | Notes |
|---|---|---|---|
| Galaxy radius | `GalacticMap.js:89` | 15 kpc | Kiloparsec. Star-system positions live in galactic coords; only the **active** system is localized into scene units. Two frames never mix. |
| Solar position R | `GalacticMap.js` | ~8 kpc | Earth-analog offset from galactic center. |

### Mixed unit surfaces (legacy "map" scale still parallel to scene)

Several objects carry a **second set** of radius/orbit values in the old "map" units (pre-physics visual scale) for the system-map HUD minimap:

- `planetData.radius` vs `radiusScene` — map is visible-dot-scale (0.2–3.5), scene is realistic (0.01–0.6)
- `orbitRadius` vs `orbitRadiusScene` — map is compressed (8–50), scene is AU-accurate (390–30,000)
- `mapToSceneRatio` used at `main.js:2142, 2196, 3462` to reconcile

Scene-space 3D rendering uses the `Scene` variants; the minimap HUD still reads the legacy variants. Asteroid belt generator is the one renderer that hasn't been switched — it emits map-unit geometry (see `AsteroidBeltGenerator.js:69-72, 127-129`) and includes scene-unit metadata in parallel but the renderer doesn't use it yet.

---

## Task 1 — Key takeaways

1. **Stars, planets, moons, and orbits are already realistic** (AU-accurate). The core scene is not "exaggerated everywhere"; only the minimap HUD uses compressed values, and planet visibility at range is handled by billboards, not by inflating radii.
2. **Ships are the major outlier** — current formula yields objects 300 km to 10,770 km across depending on the planet they spawn near. They're not "fighter-scale flavor" at all; they're moons in a trench coat.
3. **Warp portal constants are internally consistent with the oversized ship**. Once ship scale shrinks to realistic, the portal (5× ship), preview distance (ship-local), and strips all shrink proportionally. Everything in the warp system is a function of ship size.
4. **Asteroids** render at map-unit scale (~1,800–10,800 km individually) — dwarfs Ceres (940 km), which is the largest real asteroid. Scene-unit metadata exists on the belt but the renderer ignores it.
5. **Camera is already tuned for huge dynamic range** (near 0.0001, far 200k, log-depth). Ready for realistic scales without changes.
6. **Visibility hacks are already in place** for stars (StarFlare ×30 bloom) and distant bodies (scale-corrected billboards). This is exactly the "augmented vision" pattern Max described — we're already doing it for stars, just need to extend to ships and maybe stations.

---

## Parked for later — Periscope / gravitational-lens magnification

**Idea (Max 2026-04-16):** When a system scan knows an object is there (planet, ship, station) but it's too far to visually resolve, the player can open a magnification window over the object's position. The in-universe explanation is that the ship generates an ad-hoc gravitational lens to resolve distant objects on demand.

**Why this belongs in the scale audit:** This is *the* mechanism that makes a realistic-scale world playable. At 1 AU = 1000 scene units, a 1 km ship 10,000 km away subtends about 1/15th of a pixel at 1080p — the periscope is how the player sees it. Pair with the existing billboard visibility hack (already in `Billboard.js`) and StarFlare bloom: we have three tiers of augmented vision — automatic bloom for stars, automatic constant-screen-size billboards for bodies at medium distance, manual periscope for things you deliberately zoom on.

**Interaction with Task 2 target scales:** Realistic scale becomes tenable because augmented vision carries the load. Ships can be truly 1 km without becoming invisible.

**Not a task for this audit — captured for later implementation.**

---

## Task 2 — Target scales (realistic baseline)

**Decision locked (Max 2026-04-16):** All objects render at real-world scale. Visibility is handled by augmented vision (StarFlare bloom, screen-space billboards, periscope magnifier) and by combat/encounters taking place at close range. No scene-layer scale fudging.

### Proposed target scales

Conversion: `scene = meters × 6.685×10⁻⁹` (i.e. `meters / 149,598,000`). Or go through `AU`: `scene = au × 1000`.

| Object | Real size | Scene-unit size | Source / justification |
|---|---|---|---|
| **Player ship hull (scion)** | 20 m | **0.000000134** | *House-sized, unusually small by design.* Breakaway-line engineering — hand-built, compact, peer with a family home or a Millennium Falcon without the wings. Smaller than every standard military/civilian archetype in the game. |
| Fighter | 50 m | 0.000000334 | X-wing 12.5 m, TIE 7.2 m. 50 m gives sci-fi padding for legibility at close combat ranges. |
| Shuttle | 50 m | 0.000000334 | Space Shuttle Orbiter 37 m. |
| Freighter | 300 m | 0.000002 | Supertanker 400 m. |
| Cruiser | 500 m | 0.00000334 | Naval cruiser 170 m; sci-fi inflation. |
| Capital | 2 km | 0.0000134 | Rare showpiece. |
| Explorer | 200 m | 0.00000134 | Dedicated survey vessel. |
| Small station (outpost) | 500 m | 0.00000334 | ISS 109 m; near-future outposts 300–500 m. |
| Large station (rotating habitat) | 10 km | 0.0000669 | O'Neill-cylinder scale habitat. |
| **Portal aperture** | 100 m | **0.000000669** | 5× player ship per Max's spec. Ship-local, clearly smaller than any encountered vessel larger than a fighter. |
| Portal preview distance | ~1 km | 0.0000067 | "Just ahead of the ship" — 50× ship length. Close enough to feel local, far enough for a visible approach arc. |
| Entry strip span | ~1 km | 0.0000067 | Matches preview distance. |
| Landing strip span | ~2 km | 0.0000134 | Runway past Portal B. |
| Tunnel length | **KEEP 200 scene units** | 200 | Tunnel is hyperspace, not local space. Treat its length as decoupled from physical-scale conventions — it's a non-Euclidean tube. The 200-unit length is a function of camera-travel budget (HYPER_DUR=3s × ~80u/s peak), not geography. |
| Tunnel interior radius | **KEEP 2.0 scene units** | 2.0 | Same rationale. TARDIS-style "bigger on the inside" is the lore; the visual is of flying through a corridor, not a tube proportional to the aperture. |

### Visibility math (why augmented vision is the load-bearing element)

Assumptions: FOV 50°, vertical resolution 1080p (angular size per pixel ≈ 50°/1080 ≈ 0.0463° ≈ 8.09×10⁻⁴ rad).

**1-pixel threshold** — distance at which the object subtends exactly 1 pixel (diameter equals angular size):

| Object | 1-pixel threshold | Notes |
|---|---|---|
| **20 m player ship** | **~25 km** | Others see the player as a speck past this |
| 50 m fighter | ~62 km | Beyond this, invisible without augmentation |
| 500 m cruiser | ~620 km | |
| 2 km capital | ~2,470 km | |
| 500 m station | ~620 km | |
| 10 km rotating habitat | ~12,400 km | |
| 6,371 km Earth | ~7.9M km (~0.053 AU) | Naked-eye Earth vanishes well inside its own orbit |
| 695,700 km Sun | ~860M km (~5.75 AU) | Sun is naked-eye-visible past Jupiter orbit — consistent with existing StarFlare bloom |

**Useful-detail threshold** — distance at which the object is 100 pixels across (enough for hull silhouette / combat target):

| Object | 100-pixel threshold |
|---|---|
| **20 m player ship** | **~247 m** |
| 50 m fighter | ~620 m (dogfight range) |
| 500 m cruiser | ~6.2 km |
| 2 km capital | ~24.7 km |
| 10 km rotating habitat | ~124 km |

**Implications:**

- **Dogfight combat fits sub-km ranges naturally.** WW2 air-combat ranges were 200–800 m. 50 m fighters at sub-km ranges read as combat without needing any augmentation. This lines up with Max's "unrealistically close combat with in-universe explanation" design — the ranges required for legibility are the ranges the lore wants anyway.
- **Beyond-visual-range combat requires periscope.** At 50 km a fighter is <1 pixel; even a capital ship is 80 pixels (~a thumbnail). Periscope is the weapons-range telescope.
- **Docking approach fits realistic scale comfortably.** At a 500 m station, approaching from 50 km gives a 10-pixel silhouette — enough for nav-computer display, not enough to read docking bays. Periscope for silhouette lock, switch to real-pixel view at <5 km.
- **Stations bigger than ~10 km dominate the sky at visit distance** — rotating habitats should read as dominant structures, consistent with sci-fi references (Babylon 5 is 8 km; Niven's Ringworld is planetary).
- **Earth and Sun baselines validate the scale.** The Sun being naked-eye visible past Jupiter orbit (5.75 AU threshold) tracks with the real solar system; the existing StarFlare bloom handles this already. Earth becoming invisible ~0.053 AU from itself explains why distant planets need billboards — confirming the existing mechanism.

### Portal scale re-derivation

Currently (`WarpPortal.js` 2026-04-16 values, sized for 0.005-unit ship = 748 km "ship"):
- Aperture 0.025 (3,750 km)
- Preview distance 2 (300,000 km)
- Entry strip span 2 (300,000 km)
- Landing strip span 4 (600,000 km)

Realistic (sized for 20 m house-class player ship):
- Aperture **0.000000669** (100 m — 5× ship)
- Preview distance **0.0000067** (1 km — 50× ship, "just ahead")
- Entry strip span **0.0000067** (1 km — matches preview)
- Landing strip span **0.0000134** (2 km — 2× preview, gives exit runway)
- Tunnel interior radius: **unchanged at 2.0** (hyperspace convention — not a physical proportion)
- Tunnel length: **unchanged at 200** (camera-travel budget)

Reduction factor for portal aperture: ~37,400× smaller. The portal moves from "larger than a small moon" to "ship-class door." Good.

### Deferred decisions

- **Ship hull sizes per archetype:** above are proposals; the `SHIP_HULL_SIZES` table lands in Task 5 as `ScaleConstants.js` additions. Max can dial the numbers there when it matters.
- **Station taxonomy:** §8B in the Game Bible is marked [GAME] (Future). A concrete station-class table is out of scope for this audit — two reference sizes (500 m outpost, 10 km habitat) are enough to derive the scale.
- **Tunnel visual upgrade:** the 2.0-radius tunnel interior still uses the sparse dithered starfield shader. Swapping it for something with more visual interest is tracked in `well-dipper-progress.md` as "B2" in the A/B/C pickup list — separate from scale work.

## Task 3 — Camera + near-plane cross-check

**Current camera setup** (`src/main.js:74`, `:4597`, `:5535`):
- PerspectiveCamera, FOV 50° (settings-driven), near **0.0001**, far **200,000**
- Log depth buffer enabled (`RetroRenderer.js`)
- Far plane extended dynamically for deep sky objects (`main.js:2665, 2706`)

### The math

At 50° FOV and 1080p vertical resolution:
- One pixel ≈ 50° / 1080 = 0.0463° = **8.09×10⁻⁴ rad**
- For an object of radius R to fill the vertical FOV (subtend 50°): `distance_center ≈ R × 2.144`, so `distance_surface ≈ R × 1.144`
- For the near plane to **not** slice through a sphere at fill-FOV distance: `near < R × 1.144`

So the near plane at its current **0.0001 scene units (≈15 km)** is only safe for objects where `R × 1.144 > 0.0001` → `R > 0.0000874 scene ≈ 13 km radius` (≈26 km diameter).

### Safety table — current near plane (0.0001 ≈ 15 km)

| Object | Radius (scene) | Radius (km) | Fill-surface dist | Clips at fill-FOV? |
|---|---|---|---|---|
| 20 m player ship | 6.69×10⁻⁸ | 0.01 | 7.65×10⁻⁸ (0.011 m) | ❌ Catastrophic |
| 50 m fighter | 1.67×10⁻⁷ | 0.025 | 1.91×10⁻⁷ (0.029 m) | ❌ Catastrophic |
| 100 m portal aperture | 3.34×10⁻⁷ | 0.05 | 3.82×10⁻⁷ (0.057 m) | ❌ Catastrophic |
| 500 m station | 1.67×10⁻⁶ | 0.25 | 1.91×10⁻⁶ (0.286 m) | ❌ Catastrophic |
| 2 km capital | 6.69×10⁻⁶ | 1 | 7.65×10⁻⁶ (1.14 m) | ❌ Bad |
| 10 km rotating habitat | 3.34×10⁻⁵ | 5 | 3.82×10⁻⁵ (5.72 km) | ❌ Clips (5.72 < 15) |
| 1,737 km moon | 0.0058 | 1,737 | 0.0066 (987 km) | ✅ Safe |
| 6,371 km Earth | 0.021 | 6,371 | 0.024 (3,590 km) | ✅ Safe |
| 73,000 km Jupiter | 0.244 | 73,000 | 0.279 (41,780 km) | ✅ Safe |

**The 0.0001 near plane is sized for moons and planets. Every ship, station, and portal clips at close approach.** This is the root cause of the 2026-04-16 "moon going transparent when camera got close" symptom — that fix (0.01 → 0.0001) was in the right direction but stopped ~5 orders of magnitude short.

### Combat / inspection range check

What near plane do we need for realistic gameplay ranges?

| Scenario | Camera-to-surface | Required near |
|---|---|---|
| Third-person player ship view (50 m behind) | 50 m | < 3.34×10⁻⁷ |
| Dogfight range (500 m) | ~475 m | < 3.18×10⁻⁶ |
| Close strafe (100 m) | ~75 m | < 5×10⁻⁷ |
| Point-blank / ramming (30 m center-to-center) | ~5 m | < 3.3×10⁻⁸ |
| Docking approach (5 m to hull) | 5 m | < 3.3×10⁻⁸ |
| First-person cockpit (0.5–2 m to interior geo) | 0.5 m | < 3.3×10⁻⁹ |

**Conclusion:** the near plane needs to be around **1×10⁻⁹ scene units (≈15 cm)** to handle cockpit rendering, docking, and close combat without clipping. This is 100,000× smaller than the current 0.0001.

### Log depth buffer — does 1e-9 work?

With `logarithmicDepthBuffer: true`, depth precision is logarithmic across the range. The number of distinguishable depth steps is approximately:

```
steps ≈ 2^24 × log2(1 + c * w) / log2(1 + c * far)
```

At `far = 200,000` and `near = 1e-9`, log₂(200,001) ≈ 17.6; over 24 bits of depth buffer that's ~950,000 steps per order of magnitude in log space. Z-fighting is not a concern — log depth is designed for exactly this range.

**Verdict: 1×10⁻⁹ near plane is safe with log depth buffer on.**

### Far plane — is 200,000 enough?

- Neptune orbit: 30 AU = 30,000 scene ✅
- 200 AU covers the solar system comfortably
- Deep sky objects (galaxies, nebulae) — already extended dynamically at `main.js:2665, 2706`. This mechanism stays as-is.
- Inter-system distances (parsec-scale) — never raw-rendered; always traversed via warp sequence, which swaps systems mid-transit. Parsec-scale rendering is a non-concern.

**Verdict: far plane stays at 200,000 with dynamic extension.**

### Field-of-view check at realistic scale

At 50° FOV, one screen-pixel covers:
- At 1 m: 0.8 mm
- At 10 m: 8.09 mm
- At 100 m: 8.1 cm
- At 1 km: 81 cm
- At 100 km: 81 m

So at 100 km, even a 50 m fighter is 0.6 pixel — confirms the periscope need. At 1 km, a 20 m ship is 25 pixels — legible silhouette. At 100 m, a 20 m ship is 247 pixels — hero-shot closeup. Combat at 100 m to 1 km reads beautifully.

### Recommended camera changes

1. **Near plane: 0.0001 → 1×10⁻⁹** (fixed, with log depth buffer). This is the single blocking change for realistic-scale small-object rendering.
2. **Far plane: unchanged at 200,000** with existing dynamic extension for nebulae.
3. **FOV: unchanged** (settings-driven, user default 50°).
4. **No dynamic near plane needed.** With log depth, a fixed small near works across all ranges — the abandoned `max(0.0001, min(1.0, dist × 0.01))` formula was a pre-log-depth workaround.

These changes unblock realistic rendering of ships, portals (100 m aperture), stations, and close-body approach (moons clipping fix).


## Task 4 — Portal system audit against chosen scale

**Inputs:** realistic ship scale = 20 m (0.000000134), portal aperture 5× ship = 100 m (0.000000669), preview distance 50× ship = 1 km (0.0000067), entry strip span 1 km, landing strip span 2 km. Tunnel length 200 scene units and tunnel radius 2.0 scene units unchanged (hyperspace convention, not proportional geometry).

### Current constants (as of working tree 2026-04-16 PM) and recommended values

| Constant | File : line | Current | Recommended | Delta | Notes |
|---|---|---|---|---|---|
| Portal aperture radius (default) | `src/effects/WarpPortal.js:63` | `radius = 0.025` | **`0.000000669`** (100 m) | ÷37,400 | 5× player ship |
| Tunnel length (default) | `src/effects/WarpPortal.js:63` | `tunnelLength = 200` | `200` (unchanged) | — | HYPER_DUR travel budget |
| Tunnel interior radius (default) | `src/effects/WarpPortal.js:63` | `tunnelRadius = 2.0` | `2.0` (unchanged) | — | Hyperspace corridor |
| Entry strip cross spacing | `src/effects/WarpPortal.js:409` | `spacing = 0.4` | **`radius × 2.0`** (= 0.00000134 at new default) | proportional | Was hardcoded to scene units; tie to radius so it tracks ship scale |
| Entry strip cross count | `src/effects/WarpPortal.js:408` | `count = 5` | `5` (unchanged) | — | Span = 5 × spacing = 1 km ✓ |
| Entry strip side offset | `src/effects/WarpPortal.js:411` | `radius * 2.0` | `radius * 2.0` (unchanged) | — | Already proportional |
| Entry strip cross scale | `src/effects/WarpPortal.js:410` | `radius * 0.5` | `radius * 0.5` (unchanged) | — | Already proportional |
| `entryStripLength` accessor | `src/effects/WarpPortal.js:438` | `return 2;` | **`return this._radius * 10;`** | recompute live | Currently hardcoded; needs to match actual span (count × spacing = 5 × radius × 2 = radius × 10) |
| Landing strip cross spacing | `src/effects/WarpPortal.js:374` | `spacing = 0.2` | **`radius × 1.0`** (= 0.000000669 at new default) | proportional | Span = 20 × spacing = 2 km ✓ |
| Landing strip cross count | `src/effects/WarpPortal.js:373` | `count = 20` | `20` (unchanged) | — | |
| Landing strip side offset | `src/effects/WarpPortal.js:372` | `radius * 2.0` | `radius * 2.0` (unchanged) | — | Already proportional |
| Landing strip cross scale | `src/effects/WarpPortal.js:375` | `radius * 0.5` | `radius * 0.5` (unchanged) | — | Already proportional |
| Portal lab preview distance | `src/main.js:377` | `_portalLabPreviewDistance = 2` | **`0.0000067`** (1 km) | ÷300,000 | 50× ship. Camera ramp needs to cover this in FOLD phase |
| HYPER_DUR | `src/effects/WarpEffect.js` | `3.0` | `3.0` (unchanged) | — | Camera still traverses 200 scene units in HYPER |

### FOLD phase camera ramp — sanity check

Preview distance shrinks from 2 → 0.0000067 scene units (÷300,000). FOLD phase camera ramp (40 u/s peak per the 2026-04-16 PM notes) previously covered the 2u preview distance in ~0.3s. After change: 0.0000067 / 40 = 1.7×10⁻⁷ seconds — the camera crosses the preview distance functionally instantaneously.

**This breaks the lab-mode 3-stage alignment UX.** The whole point of the preview phase was seeing the portal spawn ahead and slerping toward it. If the camera is at the portal before the eye can blink, the alignment stage disappears.

**Options:**
1. Drop the peak ramp speed for ship-scale distances — target "covers 1 km in ~0.5s" = 2 km/s = 0.0000134 u/s. That's 3×10⁶× slower than current ramp.
2. Extend the preview distance — 1 km → 5 km → 50 km — until the camera ramp duration feels right at current speeds.
3. Decouple ramp speed from a ship-scale "cruise velocity" constant that gets defined explicitly (e.g., SHIP_MAX_SPEED = 500 m/s) and size everything from that.

**Recommendation: Option 3.** Add `SHIP_MAX_SPEED` (or `WARP_APPROACH_SPEED`) to `ScaleConstants.js` in Task 5; derive ramp rates from it; the approach animation then scales correctly at any ship size. Hardcoded speed constants have already bitten us once — they shouldn't slip through again.

**Interim answer if Task 5 isn't landing immediately:** start with preview distance 1 km + ramp ~2 km/s, check it feels right in Playwright, tune from there.

### Disc geometry subdivision

`CircleGeometry(radius, 64)` at `WarpPortal.js:73` — 64 segments. At radius 100 m, that's 64 segments around a 628 m circumference, ~9.8 m per segment. Fine for a ship-class aperture. **No change needed.**

### Tunnel geometry subdivision

`CylinderGeometry(tunnelRadius, tunnelRadius, tunnelLength, 48, 1, true)` at `WarpPortal.js:102` — 48 radial segments, 1 length segment, open-ended. Unchanged. **No change needed.**

### Stencil and rendering state

All stencil / depth / renderOrder settings are scale-invariant. **No change needed.**

### Work to be executed in Task 5 (ScaleConstants extension)

- Patch WarpPortal.js defaults and hardcoded spacings (or inject via constructor from scene-scale constants)
- Patch `_portalLabPreviewDistance` to pull from constants
- Add `SHIP_MAX_SPEED` + drive FOLD ramp off it
- Re-verify lab-mode 3-stage UX via Playwright after changes

None of the changes in this task should break existing tests — all stencil, state, and geometry plumbing is unchanged. Visuals shrink by consistent factors.

## Task 5 — ScaleConstants.js extensions

### Landed

**`src/core/ScaleConstants.js`** — extended with the full ship-scale framework. All constants come with JSDoc explaining *why*. Anyone adding a new physical dimension pulls from here.

New section — **Meter Conversion:**
- `METERS_PER_AU` (149,597,870,700 — IAU 2012 definition)
- `METERS_PER_SCENE` (derived: 149,597,870.7 m per scene unit)
- `metersToScene(m)`, `sceneToMeters(scene)`

New section — **Ship & Station Hull Sizes:**
- `SHIP_HULL_LENGTHS_M` — archetype key → hull length in meters. Plural keys match `assets/ships/manifest.json`. Player ship (`player`) is 20 m; `fighters` 50, `shuttles` 50, `freighters` 300, `cruisers` 500, `capitals` 2000, `explorers` 200.
- `STATION_HULL_LENGTHS_M` — `outpost` 500 m, `habitat` 10,000 m.
- `shipHullToScene(archetype)` — returns scene units; throws on unknown archetype.
- `stationHullToScene(kind)`
- `playerShipLengthScene()` — shortcut for the canonical player.

New section — **Portal Geometry Ratios:**
- `PORTAL_APERTURE_TO_SHIP = 5`
- `PORTAL_PREVIEW_TO_SHIP = 50`
- `PORTAL_LANDING_STRIP_TO_SHIP = 100`
- `portalApertureScene()`, `portalPreviewDistanceScene()`

New section — **Hyperspace Tunnel (abstract, not physically scaled):**
- `TUNNEL_LENGTH_SCENE = 200`
- `TUNNEL_INTERIOR_RADIUS_SCENE = 2.0`

New section — **Ship Speeds:**
- `SHIP_APPROACH_SPEED_MS = 6000` (informational reference — used via derived helpers)
- `HYPER_TRAVERSAL_SCENE_PER_S = 80` (tunnel traversal speed, decoupled from ship scale)
- `foldPeakSpeedScenePerSec(foldDurSec)` — quadratic-ramp peak so camera covers preview distance over FOLD_DUR at any ship scale

### Files refactored to pull from ScaleConstants

- **`src/effects/WarpPortal.js`** — constructor defaults now call `portalApertureScene()`, `TUNNEL_LENGTH_SCENE`, `TUNNEL_INTERIOR_RADIUS_SCENE`. Entry/landing strip spacings made proportional to `radius` (fix #1 from Task 4). `entryStripLength` accessor now returns live `radius × 10` instead of hardcoded 2.
- **`src/effects/WarpEffect.js`** — FOLD/ENTER/HYPER/EXIT camera speeds parametrized by `foldPeakSpeedScenePerSec(FOLD_DUR)` and `HYPER_TRAVERSAL_SCENE_PER_S`. FOLD ramp scales automatically with preview distance; HYPER stays at tunnel-geometry speed. (Fix #2 from Task 4.)
- **`src/objects/ShipSpawner.js`** — ship size formula replaced with `shipHullToScene(archetype)`. Old `Math.max(0.002, planetRadius × (0.05–0.15))` formula is gone. Spawning distance logic (function of `planetRadius`) unchanged.
- **`src/main.js`** — camera near plane 0.0001 → 1e-9 (three locations — constructor + two runtime resets). `_portalLabPreviewDistance = portalPreviewDistanceScene()` — computed, not hardcoded.

### Known UX regression — ships may appear sub-pixel at orbit distance

At realistic 50 m fighter hull, ships orbit at planet-radius-multiples distance that puts them well past the 62 km (single pixel) threshold. They'll often be invisible without augmented vision.

**This is expected and will be handled separately.** A ship billboard (analogous to `PlanetBillboard`) is the near-term fix; the periscope magnifier (§7 Game Bible) is the longer-term fix. Tracked in `well-dipper-progress.md` as "ship billboarding follow-up."

### Testing plan

In a browser (dev server already running via Vite, HMR will pick up changes):

1. **Baseline screensaver** — load `http://localhost:5173/` without flags. Verify star systems still look right (planets/moons/orbits unchanged — they use existing scale conventions).
2. **Ships** — verify `ShipSpawner` doesn't crash on archetype lookup; check console for any "Unknown ship archetype" errors. Ships will be tiny/invisible — that's expected.
3. **Warp (production)** — hit spacebar on a target, watch the warp animation. FOLD camera approach should feel like a smooth acceleration toward portal over ~4 seconds. ENTER enters portal. HYPER tunnel traversal at normal pace. EXIT decelerates to new system.
4. **Warp (lab)** — `?portalLab` query flag, run the 3-stage spacebar flow. Stage 1 should show a tiny dot portal 1 km ahead. Stage 2 alignment slerp. Stage 3 fires warp.
5. **Moon transparency check** — fly close to a moon. The 2026-04-16 transparency-on-approach symptom should be fully resolved with near plane at 1e-9.

Any visual regression reports feed into further refinement; the scale framework is in place.
