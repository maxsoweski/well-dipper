# Sheet review — player-ship-ext-v2, round 02 (Max's edit: fat rolls + recessed thrusters)

Sheet: `/home/ax/projects/well-dipper-trunk/.astra/jobs/20261002-133357-player-ship-ext-v2/out/player-ship-ext-sheet.png` · sha256 `39c08b15b148` · brief: `docs/WORKSTREAMS/player-ship-lab-2026-10-02/briefs/player-ship-ext-sheet-v2.md` + `feedback.md`
Windows copy for Max: `C:\Users\Max\Documents\Blender\astra\well-dipper-trunk\player-ship\out\player-ship-ext-sheet-r03.png` (before/after: `player-ship-ext-r02-vs-r03.png`)

| # | check | pass/fail | what I saw |
|---|---|---|---|
| 1 | Views, one baseline, same scale; figure | PASS (defect carried) | Unchanged arrangement; top view still ~20 % short vs side. |
| 2 | Labels | PASS | LENGTH 18 m, BUBBLE 2.6 m, five part names, unchanged. |
| 3 | Parts; nothing under the floor | PASS | Same parts; layers now rounded rolls; 3 rear nozzles each sunk in a socket in the rear face (front view hides them). |
| 4 | Silhouette | PASS | Updated: rounded stepped profile, no protruding nozzles. |
| 5 | Nothing the game cannot show | PASS | Clean. |
| + | Max's two asks | PASS by simple gate | Rolls visibly bulge in every coloured view; no nozzle extends past the hull outline. Whether the rolls are fat ENOUGH is Max's call. |

Verdict: ACCEPT pending Max. Note for the 3D step: "fat rolls" are rounded surfaces; on a low-poly flat-shaded model they become a few broad facets per roll, so the 3D brief must say the roll should still read at 240p.
