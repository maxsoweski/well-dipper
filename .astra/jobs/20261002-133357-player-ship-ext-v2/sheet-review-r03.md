# Sheet review — player-ship-ext-v2, round 03 (rear view, hanging cockpit, more Foss, part-colour map)

Sheet: `/home/ax/projects/well-dipper-trunk/.astra/jobs/20261002-133357-player-ship-ext-v2/out/player-ship-ext-sheet.png` · sha256 `4b7462bd3220` · feedback: `feedback.md` (round 3)
Windows copy for Max: `C:\Users\Max\Documents\Blender\astra\well-dipper-trunk\player-ship\out\player-ship-ext-sheet-r04.png` (before/after: `player-ship-ext-r03-vs-r04.png`)

| # | check | pass/fail | what I saw |
|---|---|---|---|
| 1 | Views, one baseline, same scale; figure | PASS (defect carried) | Side, front, rear, top labelled and on one baseline; ¾ view; figure. Top ~15 % short vs side. |
| 2 | Labels | PASS | LENGTH 18 m, BUBBLE 2.6 m, BUBBLE / SPINE / DECKS / ENGINES / HATCH, plus view names. ≈ 11.3 figure-heights ≈ 20 m. |
| 3 | Parts; nothing under the floor | PASS | Spine, stacked deck rolls, ~5 teal underslung modules, engine block with 4 nozzles, hanging bubble in a cream frame, hatch. All large. |
| 4 | Silhouette | PASS | Updated; the hanging bubble reads as a distinct round lump under the nose. |
| 5 | Nothing the game cannot show | PASS | Clean. Slight tonal shading inside fills (Astra's FAIL 7) is irrelevant: the sheet is a part map. |
| + | Max's round-3 asks | PASS by simple gate | Rear view present, nozzles face backward; bubble hangs under the forward hull (a teal module dips a few px lower — Astra's FAIL 12, not material); paint bands gone; 8-colour legend. |

Verdict: ACCEPT pending Max's taste. For the 3D brief: the part legend becomes the material-slot list (one slot per part), which also gives HOW-TO-REBUILD.md its part breakdown.
