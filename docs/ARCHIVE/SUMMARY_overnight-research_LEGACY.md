# Overnight Research Summary — 2026-03-14

> Start here. This summarizes everything the research agents found overnight.
> Detailed findings are in the individual RESEARCH_*.md and REPORT_*.md files.

---

## What Was Researched (8 docs, ~235 KB)

| Document | Topic | Key Takeaway |
|----------|-------|-------------|
| `REPORT_implementation-readiness.md` | Game bible audit | 16 systems implemented, 8 ready to build, 4 need research, 8 need Max's decisions |
| `RESEARCH_galaxy-generation.md` | Galaxy procedural gen | Spiral arm math, NMS/Elite/Space Engine approaches, complete seed architecture with code |
| `RESEARCH_star-population-synthesis.md` | Star properties from position | Kroupa IMF with sampling code, metallicity/age by region, density model |
| `RESEARCH_megastructures-and-nav-computer.md` | Megastructures + CRT UI | 13 megastructure types with Three.js rendering, retro nav computer design |
| `RESEARCH_zone-variability.md` | Planet distribution science | Already used — drove today's generation overhaul |
| `RESEARCH_procedural-3d-generation.md` | Ships + stations in Blender | Hull gen approaches, station modules, animation pipeline |
| `RESEARCH_blender-geometry-nodes-vs-python.md` | Geo nodes vs Python API | Hybrid is best — geo nodes for shapes, Python for pipeline/export |
| `RESEARCH_game-interaction-systems.md` | Game mechanics | Flight model, scanning, save system, combat analysis, build order |

---

## Top-Line Findings

### 1. Galaxy Generation — Ready to Build
The research provides complete code for:
- Spiral arm placement (logarithmic spirals, 4 arms, 12-degree pitch)
- Star density by galactic component (thin disk, thick disk, bulge, halo)
- Metallicity/age derivation from galactic position
- Seed hierarchy: galaxy seed -> sector seeds -> system seeds
- Sector hashing with LRU cache for nearby star lookup
- NMS uses 256 galaxies, ~4.2B regions each, 122-642 systems per region

### 2. Procedural 3D Models — Hybrid Approach Wins
- **Geometry Nodes** for shape generation (visual, interactive, seed-driven)
- **Python via MCP** for the pipeline (set parameters, bake shaders, batch export .glb)
- Pure Python/bmesh is too painful (blind code-run loops)
- Pure Geometry Nodes can't handle export pipeline alone
- The a1studmuffin/SpaceshipGenerator is a useful reference
- Target: 200-1000 tris per ship for PS1 aesthetic

### 3. Game Systems — Build Order Identified
Priority order for game mechanics (from the interaction systems research):

| Priority | System | Effort | Why First |
|----------|--------|--------|-----------|
| 1 | Save system | 1 day | Everything else needs it. localStorage + seed. |
| 2 | Ship movement | Medium | Transitions from "camera" to "you're in a ship" |
| 3 | Scanning & discovery | Medium | Most natural mechanic for exploration game |
| 4 | Discovery codex | Small | Rarity system becomes progression hook |
| 5 | Passive NPC ships | Medium | Makes universe feel alive (pipeline exists) |

**Skip combat.** It conflicts with the meditative vibe. Outer Wilds and Journey prove exploration games don't need it. Environmental hazards can create tension instead.

### 4. Implementation Readiness — What's Next

**Quick wins (small effort, high impact):**
- CRT scanline filter (GLSL shader, research has pseudocode)
- Add exotic type names to BodyInfo HUD (trivial)
- Star age effects on generation (data already stored)

**Medium efforts (clear approach, needs coding):**
- Galaxy seed architecture
- Navigation computer UI (render-to-texture + CRT shader)
- Save system

**Needs Max's decisions:**
- Civilized planet spawn rates (finalize percentages)
- Which megastructures to build first
- Nav computer layout and interaction
- Ship behavior priority vs other features
- Whether to pursue combat at all
- Discovery log design

---

## Decisions for Max

When you wake up, these are the questions that came out of the research:

1. **Combat: yes or no?** Research strongly suggests skipping it — the meditative vibe is your differentiator. Environmental hazards (radiation zones, asteroid fields) can create tension without combat systems. Agree?

2. **Build order priority:** Save system -> ship movement -> scanning -> codex -> NPC ships. Does this order feel right, or do you want to prioritize differently?

3. **Galaxy generation timing:** The research is complete and code-ready. Do you want to build this next session (the holistic pipeline), or tackle some quick wins first?

4. **Megastructures:** 13 types researched across 4 rarity tiers. Which ones excite you most? Dyson swarms (affect star visually), ring habitats (like Halo), or something else?

5. **Procedural ships:** Ready to start building geometry node setups in Blender for each archetype. Want to do a session on this, or keep it queued?

---

## File Map

```
docs/
  GAME_BIBLE.md                              -- Source of truth (updated today)
  SUMMARY_overnight-research.md              -- THIS FILE (start here)
  REPORT_implementation-readiness.md         -- Full audit of every bible feature
  RESEARCH_galaxy-generation.md              -- Galaxy structure, seed arch, density
  RESEARCH_star-population-synthesis.md      -- IMF, metallicity, age, components
  RESEARCH_megastructures-and-nav-computer.md -- 13 megastructures + CRT nav UI
  RESEARCH_zone-variability.md               -- Planet distribution (already used)
  RESEARCH_procedural-3d-generation.md       -- Ships + stations in Blender
  RESEARCH_blender-geometry-nodes-vs-python.md -- Geo nodes vs Python comparison
  RESEARCH_game-interaction-systems.md       -- Flight, scanning, saves, combat, NPCs
```
