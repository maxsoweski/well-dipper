# AC-LIVE-SWEEP — live result (2026-07-13, working-Claude via chrome-devtools)

**Setup:** Max-started dev server `:5175` + debug Chrome `:9223`; fresh tab
`http://localhost:5175/well-dipper/world-engine-lab.html`; page macroSeed 1; route settle
confirmed per preset by polling `state._lastBodyDrivers` identity (all settled ~1.1–1.5 s).
Route inferred per the verify-run instruction: the active writer's family probe carries
populated family fields (plateCount / shell regime / plumeCount / coronaCount); despun = all
four null. Verified at working tree `9322645` (V2-3 code at `b08cd01` + verify follow-ups).

**11 presets swept (contract asks ≥9) — every route matches the pinned §0 table:**

| Preset | e1 (cls/regime/sub) | Live route | Table | Note |
|---|---|---|---|---|
| Rocky (Earthlike) | rocky/stagnant* | plate (plateCount 10) | plate ✓ | *seeded pick drew 'stagnant' at seed 1 — modal collapse routed plate (designDecision #1 live) |
| Ocean (temperate) | rocky/mobile | plate (plateCount 10) | plate ✓ | |
| Lava (hot airless) | rocky/heat-pipe | volcanic (plumeCount 11) | volcanic ✓ | router pure-weak |
| Magma (K2-141b) | rocky/heat-pipe | volcanic (plumeCount 11) | volcanic ✓ | magmaDiag.appliedTune present |
| Venus (sulfuric shroud) | rocky/stagnant | stagnant-lid (coronaCount 350 @seed 1) | stagnant-lid ✓ | router pure-strong; stagnantDiag.appliedTune present (null) |
| **Frozen (airless)** | icy/dead-lid | **despun** (all family fields null) | **despun ✓ — REROUTE #1 live** | screenshot `frozen-post-flip-despun-seed1.jpeg` |
| Eyeball (locked temperate) | rocky/stagnant (seed 1) | shell:eyeball-despun | shell ✓ | dispatch locked-awareness intercepted BEFORE the in-band map — "today wins" live |
| Mars (arid rocky) | rocky/dead-lid | despun | despun ✓ | oracle-row adjudication, render unchanged |
| Gas giant (Jovian) | gas/dead-lid | despun | despun ✓ | composition terminal |
| Europa (icy moon) | icy/icy/**icy-active** | shell:icy-active | shell ✓ | sub-regime distinctness live (MF-2) |
| Titan (methane seas) | icy/icy/**volatile-cold** | shell:volatile-cold | shell ✓ | ≠ Europa's sub-regime, as required |

**Hot Jupiter (reroute #2):** not lab-sweepable as a distinct visual check (gas deck masks
relief); its shell→despun reroute is pinned headlessly by the 17-oracle (24/24) and the
adjudication is byte-real per BUILD-PLAN §6. Recorded here for completeness.

**Console:** exactly 1 error across the whole sweep — the pre-existing favicon 404
(msgid=4, present since before the flip). Zero NEW errors.

**Window hygiene:** the agent tab was closed after the sweep; Max's tabs untouched.

**Fallback-oracle cross-check note (per the amended AC-FLIP):** the cross-check is
probe-vs-pinned-table (this document) + the headless 17-oracle; the AC-0 label-free grep
forbids an in-block runtime comparison, per the 2026-07-13 contract amendment.
