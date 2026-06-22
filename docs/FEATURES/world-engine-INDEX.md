# World-Engine — MASTER PICKUP INDEX (read THIS first)

**Status:** BRAINSTORM in progress, 2026-06-22. Repo `~/projects/well-dipper`, branch `master`,
**everything local — nothing pushed.** This index is the single cheap entry point so the next
session resumes WITHOUT re-reviewing ~300KB of state. Read this → the spine → the two audits, then act.

## 1. Where we are

We are **brainstorming** (NOT building) a co-genesis **"world-engine" L1 layer** for the planet-LOD lab.
The problem: today each visual feature is an independent overlay → bodies read as a "bag of toggled
effects" (slop). Real bodies look distinctive because features share **engines** rooted in the body's
**history + composition + place in the system**. The world-engine is a **new generative layer upstream
of rendering** (L0 galaxy procgen → **L1 world-engine (NEW)** → L2 feature renderers that just *express*
it). Frame: a **"story engine"** — what renders IS the body's billions-of-years history; the engine
dependency order is **time's arrow**. WF1 (outcomes catalog) is **done**. In-thread we **collapsed ~84
candidate engines → 15 engines in 5 tiers** (the spine), ran a **story-lens review** (two audits), and
**FOLDED its findings into the spine** (§3.1 + §4: tier re-slots, the epoch/host-editor model, the
broken+over-supplying L0 boundary). **ALL STRUCTURAL CHOICES LOCKED 2026-06-22** — Max delegated the technical
calls (criterion: "easiest-to-optimize path toward the story-engine north star"); working-Claude locked the
epoch/host-editor model + tier re-slots + the **L0-gap → Option A (expose + derive)** (spine §3.1/§4c/§5).
**WF2 by-engine research is now GO — launched** (per-engine research → adversarial verify pipeline, built to dodge
the runner wedge; §7).

## 2. Read order for next session

1. **THIS index** (the map).
2. **`world-engine-architecture-spine.md`** — the central design doc (15-engine/5-tier stack + L0 interface + story frame).
3. **`world-engine-L0-audit.md`** + **`world-engine-history-ordering-audit.md`** — the story-lens review findings (what's still open).

That's enough to resume. The outcomes catalog is 298KB — do **NOT** read it whole; read only its top ~30 lines.

> **The two `/tmp` handoffs are now MIGRATED into this index and SUPERSEDED** — their durable content
> (runner-wedge lesson, locked decisions, Max's framing quotes, cautions) is folded in below.
> `/tmp/handoff-cogenesis-wf1-done-wf2-next-2026-06-22.md` and
> `/tmp/handoff-cogenesis-shared-drivers-brainstorm-2026-06-22.md` can be abandoned.

## 3. Artifact pointers

| Artifact | What it is | Anchor |
|---|---|---|
| `world-engine-architecture-spine.md` | ⭐ Central doc: 15 engines × 5 tiers (§3) + review re-slots/epoch model (§3.1), L0 broken+over-supply (§4), locked (§5), what's-next (§6) | review folded in |
| `world-engine-outcomes-catalog.md` | WF1 output: 125 net-new + 84 candidate engines + 60 reclassifications. **Read top ~30 lines only (298KB).** | committed `75681a7` |
| `world-engine-L0-audit.md` | A1 story-lens: Q1 sufficiency + Q2 over-supply | DRAFT |
| `world-engine-history-ordering-audit.md` | A2 story-lens: Q3 history/time's-arrow | DRAFT |
| `planet-lod-CHARTER.md` | Strategic frame: NORTH STAR = co-dependence; lab≠game by design | durable charter |
| `planet-visual-features.md` | Existing D1–D16/P1–P28/F1–F53 model; its deferred "Phase 2" **IS** this L1 layer | baseline |
| `feature-interaction-audit-2026-06-20.md` | 84-edge / 52-gap lateral audit → WF2 validation set | reference |
| `planet-drivers.js` | SOURCE OF TRUTH for driver vocab: canonical L0 D1–D16 + L1 P1–P28 | code |
| `planet-archetypes.js` | Archetype taxonomy (FEATURES + presets); the Q2 over-supply suspect (type-keyed feature sets) | code |
| `planet-feature-associations.js` | Per-feature `processes:[P#]` + `dependsOn`; A2: encodes RENDER order, not HISTORY order | code |
| `src/generation/PhysicsEngine.js` | Stateless physics (composition, atmosphere, tidal, habitability) the game L0 calls | code |
| `src/generation/PlanetGenerator.js` | Game L0 body generator; `_pickType` is the master type-branch (Q2 C1) | code |

**Current working-tree HEAD = `ccd6b8d`** (later than the artifact shas above; use explicit shas — see §7 cautions).

## 4. Converged architecture (detail in spine §3)

3-layer model: **L0** galaxy procgen (exists) → **L1** world-engine (NEW, 15 engines) → **L2** renderers (express only).
The **15 engines in 5 tiers** (spine §3 has full I/O — don't re-list here):
- **T1 Body-defining:** E1 composition/regime (+ derived "type" label) · E2-figure · E12-province *(moved here from T5)*
- **T2 Forcing fields:** E3 tidal/orbital · E4 magnetosphere/radiation · E5 atmosphere/climate
- **T3 Surface-building/relief:** E6 tectonic-grain · E7 magmatism · E8a bombardment
- **T4 Surface-sculpting:** E9 hydrology · E10 aeolian · E11 cryosphere *(North-Star couplings live here)*
- **T5 Modality/coherence:** E8b space-weathering · E12-palette · E13 temporal/transient · E14 inhabitation · E15 rings
- **Render-frame sidecar (not a tier):** E2-illumination *(modifies how every tier reads)*

## 5. Story-lens review findings (condensed — detail in the two audits)

**L0-gaps / sufficiency (A1, `world-engine-L0-audit.md`):** 10/15 engines SHORT, 2 clean (E1,E5), 3 contingent (E9,E10,E12).
- **D12 tidalHeating is DEAD in the game** (hard-zeroed; `tidalHeating()` only called in tests) → starves E3/E6/E7/E11, the North-Star spine. *Highest-leverage single fix.*
- **No per-body system context** (moons/rings/companion/resonances unreachable from a body) → starves E2/E4/E13/E15/E3.
- **D13 magneticField never surfaced** (computed inline, discarded) · **eccentricity never computed** (`circularize` dead code) · **D16 age + metallicity computed-then-dropped**.

**Over-supply / type-conflict (A1, Q2):** "**type" is load-bearing at the input boundary** — co-genesis wants it to be a *derived label*, not an upstream gate.
- C1 `_pickType` master branch (palette/atmo/moons by type lookup) · C2 `planet-archetypes.js` `rendersOn` allowlists hard-code feature sets per named preset (biggest conflict) · C3 D13/D15 are derived composites = layering inversion · C4 lab `DRIVER_PRESETS` is a 2nd per-type input contract · C5 ExoticOverlay swaps type post-hoc.

**History-ordering / time's arrow (A2, `world-engine-history-ordering-audit.md`):** gross arrow correct; 3 structural breaks.
- **Composition-over-time is THE central gap** — a flat "each engine runs once" model can't express event SEQUENCES (crater later intruded by magma; channel later exhumed into ridge). **Needs host/editor composition + 2–4 epochs** (NOT billion-year time-stepping). This changes the architecture's *shape*, not just labels.
- **2 cross-tier cycles** a one-pass DAG can't express: C1 atmosphere↔surface (shared dust/frost field) · C4 figure↔grain (despin/TPW 2nd-gen lineaments via epochs). (C2 tidal↔volcanism, C3 base-level resolve via "place-once-at-epoch" / intra-engine fixed-point.)
- **Mis-tiers:** E8 split (bombardment T3 / space-weathering late) = highest-confidence · E2 illumination → render-frame sidecar · E12 province → body-defining (palette stays terminal).

## 6. Locked decisions (carry forward)

- WF1 outcomes catalog reconciled → **125 net-new + 84 candidate engines** (committed `75681a7`).
- **WF2 fans out BY ENGINE, not by feature** (operationalizes rivers+mountains-as-one-engine).
- Outcome sweep covered **all 4 grounding tiers** (OBS/SIM/THEO/SF) **with clear tagging**.
- **Two-workflow sequence with a Max review checkpoint between** WF1 and WF2 (checkpoint passed).
- **Engine collapse done in-thread** (not a workflow agent — dodges the runner wedge, §7). WF2 fans out per *approved* engine.
- This is a **BRAINSTORM, not a build.** No `dev-collab-scope`, no build/verify workflow yet.

## 7. Open decisions / what's next

**Convergence items — ✅ ALL LOCKED 2026-06-22** (Max delegated technical calls; criterion = easiest-to-optimize
toward the story-engine north star). Items 1–3 below are RESOLVED; WF2 is launched:
1. **Tier re-slots — ADOPTED in spine §3.1** (split E8a bombardment / E8b space-weathering-late; E2-illumination → render-frame sidecar; E12-province → T1, palette stays terminal). Pending only Max's final read. E3/E5 stay put.
2. **Epoch / host-editor model — ADOPTED in spine §3.1** (2–4 named epochs + editor-on-host composition; the "history-machine" fix). Pending Max's read. (Re-typing `planet-feature-associations.js` edges render→history is a WF2/build task.)
3. **L0-gap resolution** — spine §4 "expose + derive" lean: L0 exposes the system graph it already computes + a thin Tier-1 base step derives structured fields. A1's ordered fix list: (1) plumb D12 + (2) compute eccentricity → (3) surface dropped primitives → (4) expose system graph → (5–7) the type-demotion refactor (high blast radius, defer to WF2). Decide: expose+derive vs extend-L0 vs decide-after-WF2-gap-list.
4. **Type → derived-label demotion** — long-horizon target: `_pickType` becomes a seed/label; palette/atmo/feature-set derive from drivers + fields (replace `rendersOn` allowlists with driver-threshold gates).

**WF2 by-engine plan** (after sign-off): collapse to ~8–15 ROOT engines (each must also emit MODALITY outputs — body-wide palette/province/seasonal fields, not just landforms); per engine → mechanism · inputs (flag L0 under-supply) · cheap procedural approximations + citations · engine↔feature map · cost estimate (closed-form/steered-noise/baked-field/relaxation = real-time budget answer). Then engine DAG → feasibility/budget triage → first vertical slice (Max's recurring case: **terrain↔sea-level↔drainage** — does mountains+rivers collapse into one engine?). Map the 84-edge interaction audit on as a validation set. Adversarially verify the budget/exotic claims.

### ⚠ Workflow-RUNNER wedge — operational lesson (migrated from /tmp)

The `Workflow` tool's orchestration **stalled 3× at the synthesis/merge stage even though every subagent
completed**. Symptom: harness reports "running"; per-agent `.jsonl` mtimes go stale 20–30+ min; journal shows
`started` with no `result`. The **agents work; the *runner* wedges** — trigger is a single **no-tool agent doing a
big merge** (large prompt in + large structured output out). Mitigations for WF2 (use all):
- Do mechanical merges/dedup in **plain JS inside the script**, never a big no-tool merge agent.
- Keep any judgment agent **small I/O**; use `agentType:'general-purpose'` for web research (the 10 domain agents of that type all succeeded).
- **Disk-salvage pattern:** structured outputs persist per-agent at `<transcriptDir>/subagents/workflows/<runId>/agent-*.jsonl`. Extract each `StructuredOutput` tool_use `input`, classify by schema keys, merge in Python. WF1 was fully salvaged this way. (The throwaway `/tmp/we_*.py` scripts may be gone — re-derive from the committed catalog, which is the durable artifact.)
- Stop a wedged run with `TaskStop`; `resumeFromRunId` re-wedged on the orchestrator — prefer direct background `Agent(...)` for final stages.

### Cautions (migrated from /tmp — carry forward)

- **Stage EXPLICIT paths only, NEVER `git add -A`.** Tree has pre-existing dirty files (`src/auto/CameraChoreographer.js`, `src/debug/LabMode.js` warp WIP) + hundreds of loose `.png/.webm/.html`.
- A file literally named **`HEAD` exists in repo root → never `git show HEAD`**; use explicit shas. Current HEAD = `ccd6b8d`.
- Commit at seams (good messages); **confirm before `git push`** — nothing pushed across these sessions.
- **Subagents / workflow agents inherit `opus`** (fable gated/unavailable here).
- Active skill is **`superpowers:brainstorming`** — re-invoke it; do NOT jump to `dev-collab-scope` or any build/verify workflow until the brainstorm yields a Max-approved design direction.
