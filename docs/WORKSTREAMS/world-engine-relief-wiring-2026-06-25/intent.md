# world-engine-relief-wiring-2026-06-25 — intent

**Campaign:** World-Engine production-L1 port (WS4). **Renderer:** LAB only (game `Planet.js` shader demotion deferred/OUT). Source: `docs/FEATURES/world-engine-production-L1-plan.md` §WS4.

## Why we care
WS4 is the first workstream that writes a real chapter of the world's history and lets us read it by looking. Two things land here, and they're what we've been pushing toward:
- **One shared tectonic grain.** Today every relief feature hashes its own independent strike axis — there's no shared lineament field, so mountains, scarps, tessera, and canyons point in unrelated directions. WS4 authors one E6 grain field they all read, making real Max's topo-map observation: *"the same tectonic activity produces both the mountains AND the structured valleys that shape rivers."* Features stop being a bag of toggled effects and start sharing a cause.
- **Drainage that actually cuts the relief.** The carve becomes a real host-edit: drainage post-dates the tectonics and incises into the same relief, so a second route would see the carved surface — drainage with a history, not an overlay.

The through-line: distinct 3D landforms that read each other's real output, not semi-homogeneous slop.

## What "coherent grain" means to Max (his words — the north-star bar)
> "I would note the grain is coherent if we saw distinct landforms playing out across the surface of the planet, the way that we see on every single planet we have ever observed. There are smaller details that may read as noise, sure. But when looking at the planet as a whole, you can see the results of the forces that formed it — whether that's the major continental shapes on Earth, the mountain ranges, plateaus, plains, and so on; or the surface features of Pluto where you can see ice mountains, ranges of those, and regions that are smoothed over where a kind of film formed after a major collision with its moon."

## Scope honesty — WS4 is a milestone toward that bar, not the whole bar
Max's bar above is the full story-engine vision. WS4 wires only TWO of the ~15 engines (E6 tectonic grain + E9 hydrology). So WS4's concrete move toward the bar is: the relief features read as ONE coherent tectonic system (ranges/scarps/canyons share a grain and amplitude provinces, not random scatter) AND drainage has cut into that relief. Fuller landform variety — Earth's continental shapes (plate tectonics), Pluto's impact-smoothed Sputnik-Planitia plain (bombardment + cryo resurfacing) — comes from engines NOT in this campaign (E7/E8/E11…) and is explicitly later work. WS4's UAT judges the grain+drainage read as a coherent step, not the finished planet.

## Success criteria (Max's language)
- Looking at the planet as a whole, you can see the results of the forces that formed it: the relief reads as a coherent tectonic system (ranges, scarps, plateaus, canyons belong together along a shared grain), not random scatter — small-detail noise is fine.
- Flipping the drainage epoch off→on reads as "uncut relief" → "drainage carved into that same relief": valleys are genuinely lower, cut into the surface, not just darkened.
- With the grain strength dialled to 0, the planet is byte-identical to today (safe fallback).

## Scope boundary (confirmed direction; flagged for Max's greenlight)
- WS4 OWNS: the shared E6 grain substrate + making the E9 carve genuinely subtractive over it + epoch ordering (build-then-carve).
- WS4 does NOT reopen river SCALE or water-fill — those shipped with the rivers feature (Max UAT-passed 2026-06-19) and WS4 inherits them; the carve leverages the existing flood/water-fill mechanism rather than rebuilding it.

## Decisions
- **Grain augments the province field** (`gProvince` = amplitude/where; grain = orientation/regime) — not a replacement.
- **Per-body bake budget:** once-per-body, rebuilt only on preset/seed/sea-level change; start at the lab's ~5 incision passes. Max deferred the exact number — it is documented as a named tunable so that if something reads wrong or runs slow, it's a known variable to adjust.
