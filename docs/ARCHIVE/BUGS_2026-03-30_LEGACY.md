# Bugs Found 2026-03-30

## 1. Binary star companion not rendering in 3D game view
- **System:** Wise 8783 (binary)
- **Symptom:** Only one star visible in the game world, nav computer correctly shows both
- **Likely cause:** In main.js spawnSystem(), we changed `star2` creation to always use `new StarFlare(sceneStarData2)` but the binary companion may not be getting positioned/added correctly
- **File:** src/main.js, around the `systemData.isBinary` block (~line 1380)

## 2. Nav computer shows fewer planets than actual system
- **System:** Wise 8783 — nav shows 2 planets, game has 4
- **Cause:** Nav computer generates its OWN system data using `StarSystemGenerator.generate(star.seed)` independently from main.js. The seed or generation context may differ, producing different planet counts. The nav computer doesn't use the ACTUAL spawned system data.
- **Fix needed:** When viewing the current system, the nav computer should use the REAL system data instead of regenerating. Pass `system` data to NavComputer via a setter.
- **File:** src/ui/NavComputer.js `_renderSystem()` line ~1187

## 3. Orbit lines have a chunk missing
- **Symptom:** Visible gap in the orbit ring when orbit display is turned on
- **Likely cause:** The orbit line segments don't complete the full 2π circle, or there's a rendering artifact at the wrap point
- **File:** Likely in src/objects/Planet.js or wherever orbit lines are drawn

## 4. Planet/star billboards look square in 3D game view
- **Symptom:** StarFlare and planet sprites appear square instead of circular
- **Likely cause:** At the game's resolution (with the RetroRenderer downscaling), the sprite textures may not have enough resolution or the dithering shader is creating square artifacts
- **Note:** The 1×1 pixel dithering we reverted to (from master) may contribute — at low resolution, individual dithered pixels create a square grid pattern on round sprites
- **File:** src/objects/StarFlare.js shader, src/rendering/RetroRenderer.js resolution settings
