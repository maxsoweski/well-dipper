# V2-2b-2a — BUILD-NOTES (decisions log)

Running log of build-time decisions, per the BUILD-PLAN's `[RESOLVED-BY-SYNTH]` gates.

## MF1 — render seam (Slice B→C hard gate) — RESOLVED 2026-07-05

**Decision (Max): Option B — the `route()` lab-override hook.**
Add a null-default `labLidOverride` param + branch + `get mixedDiag()` to `route()` in
`planet-lod-rivers.js`. Every production caller passes no override → `route()` is byte-inert;
the 75-golden byte-identity harness bypasses `route()` entirely, so the golden cannot move.
The contract's AC-ZERO-CLOBBER(d) file-fence is amended to permit `planet-lod-rivers.js
(route() only)` — same file + pattern V2-2b-1 already used at the dispatch seam. Production
dispatch stays on `PRESET_ARCHETYPE` (no V2-3 flip). This unblocks Slice C.

## Gate-3 synthetic-generator import (allowlist item 7) — RESOLVED 2026-07-05

**Decision (working-Claude, low-risk call): add `export` to the generators only.**
AC-INTERPEN reproduces gate-3's 100%/0% separation over its 80 synthetic worlds. Rather than
copy-paste the generators (`genTiled/genCompound/genCompoundMixed/genScatter` + `buildFibSphere`)
into the test — which risks drift from the gate-3 source of truth — add `export` to them in
`gate-3-interpenetration-validation.mjs` (behavior-inert; the script's own runtime is unchanged).
The file is a program-dir validation script, NOT in the contract's forbidden `mustStayWorking`
source list. Reversible; if Max prefers the fence held literally, fall back to copying the
generators into `tests/worldengine-interpenetration.test.js`.

## Slice A+B build (wf_554f85a2-f5c) — 2026-07-05

Built via workflow: composer (`mixedInterior.js`) + wire router `case 'mixed'` + `lid:` audit
reconcile + composer/pierce tests; then Π instrument (`interpenetration.js`) + AC-INTERPEN test
+ gate-3 export. **Independently re-run by working-Claude: 7 core+zero-clobber suites, 174 tests
green** (75-golden 75/75, corner byte-anchors green, e1-shadow-audit green; full suite 1800 pass,
only the 4 pre-existing known failures, not grown). Both adversarial lenses returned **PASS**
(testsRunGreen=true): BYTE-SAFETY/ZERO-CLOBBER + ANTI-MUSH CORRECTNESS.

**Notable build deviations (all faithful, none affect ACs):**
- Instrument taken by INJECTION (`opts.interpen`) not import — preserves AC-0's exactly-3-imports
  assertion on the composer and avoids a router↔composer↔statistic cycle (MF2). `interpenetration→
  lidResponse` (familyOf) stays one-way. Slice C's lab render seam is the production injector.
- Geodesic distance analytic (`acos(dot)`) not BFS — mirrors stagnantLid; the 4 required helpers
  (randDir/steeredNoise3/geodesicPointToArc/percentileThreshold) ARE copied verbatim.
- AC-STRUCTURE `structureMask` = province-membership binary field (mirrors the shipped
  stagnant/magma structure tests; raw-height corr is diluted by the ~82% plains background).

**Review findings + resolutions:**
- [should-fix, byte] not-ours `CameraChoreographer.js`/`LabMode.js` dirty in tree → RESOLVED:
  staged the workstream commit EXPLICITLY (no `git add -A`); those files left untouched.
- [should-fix, anti-mush] AC-INTERPEN claimed the instrument "reads centerId" but the gate-3 port
  is adjacency-based → RESOLVED: contract text (AC-INTERPEN statement + observable + dd#5) corrected
  to "reads primitiveId + familyOf; centerId co-emitted for probe/2b-2b, not consumed by Π".
- [nit] composer writes undocumented `carrier.faultDensity` (parity bookkeeping; byte-inert on the
  un-wired mixed path) → DEFERRED to Slice C: wire a named consumer (the lab render) or drop it.
- [nit] AC-MIX-DISCRETE kernel-match band-checks tessera/rift/plains only, not PIERCE/corona
  interiors → ACCEPTED per reviewer rationale (shield→plains decays continuously = no sharp step;
  shields constrained by the budget-bound + histogram + pierce tests; one-primitive-per-node IS
  asserted for all nodes via primitiveId). verify-workstream is the backstop.
- [nit] AC-PIERCE mean-band [1,3] redundant with per-seed [1,3] → ACCEPTED (harmless); could tighten
  to ~[1,2] in a later polish.

## Slice C build (lab seam + live Tharsis) — 2026-07-05 (working-Claude, direct build)

Built the three Slice C pieces + drove the live AC-THARSIS. Faithful to BUILD-PLAN §A(Slice C)/§B/§C/§D/§E
and GROUNDING §10. Files touched (matches the (E) file-fence exactly): `lidResponse.js` (interpen forward),
`planet-lod-rivers.js` (route() hook), `planet-lod-lab.html` (folder + `_lab` API + probe),
`tests/worldengine-lid-router-audit.test.js` (reconciled), BUILD-NOTES. **Staged EXPLICITLY** (no `git add -A`);
the not-ours `CameraChoreographer.js`/`LabMode.js` + the untracked screenshot pile left out.

**1. Interpen injection (MF2-faithful).** `writeLidResponseSphere` gained a null-default `interpen` opt forwarded
into the composer's `case 'mixed':` call; the router itself imports NO statistic. The **route()** lab hook
(planet-lod-rivers.js — the route/lab boundary, NOT a `base/` writer) imports `interpenetration` and injects it,
so mixedDiag carries `Pi`/`M`/`legibleByFamily`. Import graph stays acyclic: rivers → {lidResponse, interpenetration};
interpenetration → lidResponse. No `base/` module imports the statistic → no router↔composer↔statistic cycle.

**2. route() labLidOverride hook (MF1 Option B).** Added `labLidOverride=null` param + a branch (after
`writeBodyRelief`, before `reliefGrad` so the shading gradient tracks the mixed height) + `get mixedDiag()`. The
branch runs `writeLidResponseSphere` on the hand-set E1 coordinate (composer REPLACES carrier.height), builds a
**≤8-key primitiveId histogram in route()** (per-node arrays never leave route() — the token-overflow gotcha), and
stashes `{...composerDiag, path, fineClass, primitiveIdHistogram}`. Every production caller passes `labLidOverride
= null` → the branch is skipped → route() byte-inert (75-golden bypasses route() entirely). If the hand-set
coordinate does NOT classify mixed, the probe surfaces the honest `path`/`fineClass` (no stale mixed diag).

**3. Lab folder + `_lab` API (byte-safe seam).** New lil-gui folder `Drivers → mixed lid (V2-2b-2)` (L / Φ / n /
tidal sliders + `▶ Render mixed` + `Mixed A/B` flip + mode readout), a `mixedOv` state object (Tharsis defaults),
and `_lab.setMixedDrivers / renderMixed / mixedOff / mixedProbe`. The override object is built OUTSIDE the
`riverOverlay.route({...})` block (SF1 — the e1-shadow-audit forbids a bare `e1` token there; only the identifier
`_mixedLidOverride` rides in). `mixedProbe` returns **SCALARS ONLY** (pierceCount, tentCount, primitiveIdHistogram,
Pi, M, beltScale, path, fineClass, heightSource, legibleByFamily, Ybase, L, Φ). renderMixed forces `applyReliefBake(1)`
so heightSource=='carrier'.

**Nit resolutions (both BUILD-PLAN carry-overs):**
- **faultDensity → KEEP (not drop).** `carrier.faultDensity[i] = clamp01(prox[i])` is faithful sibling-parity: ALL
  four corner writers write it identically as an activity proxy (magmatism.js:413 / stagnantLid.js:470 / plates.js:368
  / shellRelief.js:367). It is a standard hashed carrier field (sphereField.js:17, tracked by verify.js:27) consumed
  by the tectonic/grain path (tectonic.js:182). On the LAB mixed render path it is now live and correctly populated.
  No change to the verified composer; the existing "parity bookkeeping (activity proxy)" comment already documents it.
- **lid-router-audit AC-ZERO-CLOBBER(dispatch) reconciled.** The V2-2a guard "planet-lod-rivers.js references neither
  lidResponse nor writeLidResponseSphere anywhere" is now false under MF1 Option B. RECONCILED (mirroring Slice B's
  `lid:` reconciliation): the router reference is PERMITTED but CONFINED to route()'s labLidOverride hook (the test
  asserts the import + that the `labLidOverride` guard sits immediately above the `writeLidResponseSphere(` call);
  the second `it` still fences `writeBodyRelief` (production dispatch) router-free. Load-bearing invariant unchanged.

**Verification — headless GREEN + live AC-THARSIS PASS (working-Claude, independently run):**
- Zero-clobber + audits: **162/162** across v2-0-byte-identity (75-golden **75/75**), lid-byte-anchors,
  e1-shadow-audit (rivers.js + lab route block clean), reconciled lid-router-audit, lid-primitiveid.
- Mixed suites + drift: **47/47** (mixed-composer, mixed-pierce, interpenetration, planet-archetypes).
- Full suite: only the **4 pre-existing known failures** (KnownObjects ×3, GalacticFeatures ×1) — NOT grown; the
  13 `vendor/motion-test-kit` file failures are pre-existing "No test suite found" collection quirks, disjoint from
  every Slice C file.
- **Live AC-THARSIS** (chrome-devtools, localhost:5173 lab, seeds {1,2,3,7,42} at the hand-set Tharsis coordinate
  L 0.551 / Φ 0.27 / n 6 / tidal 0): all classify **mixed** (`path=='lid-mixed'`), `heightSource=='carrier'`,
  **pierceCount ∈ [1,3]** every seed (2,3,2,2,1), discrete primitiveId histogram (shield 1 + preserved-plain 8 +
  rift 7 + tessera/corona/caldera), **Π finite always** and **Π>0 iff ≥2 legible pierce components** (MF4 exactly:
  seed 2 → 3 legible → Π=0.63; seeds 1&42 → 1 legible → Π=0), M≈0.05 ≪ 0.70, `Ybase(0.551)=0.222` (pins ≈0.220),
  console clean of NEW errors (only a pre-existing favicon.ico 404). Zoomed screenshot shows discrete rift corridors
  + shield/tessera piles on a preserved-plains datum — NOT a smeared average. **Pinned seed = 2.**

### AC-0 conformance table (channel × named consumer — the V2-1-style discipline)

Every channel the composer emits maps to a named reader in the DAG (no dead knobs). Reproduced here as the durable
table AC-0's verifyVia.input calls for (added post-verify per the workflow's evidence-discipline caveat):

| Emitted channel | Where written | Named consumer(s) — the reader in the DAG |
|---|---|---|
| `carrier.height` (U) | mixedInterior.js:383 | lidResponse `case 'mixed'` return → route()'s bakedOn re-point + bakeHeightCube (render); AC-MIX-DISCRETE interior-kernel + AC-ORDER-MIX province-mean tests |
| `primitiveId` (multi-valued Int32Array) | mixedInterior.js:364 | AC-MIX-DISCRETE one-primitive-per-node; `interpenetration(mesh, primitiveId, familyOf)` (Π=C·F); the lab `mixedProbe` primitiveId histogram |
| `centerId` (Int32Array) | mixedInterior.js:260 | AC1 determinism test (Int32Array byte-equality over seeds {1,2,3,7,42}); lid-router-audit per-node emission test; **reserved consumer** for 2b-2b (co-emitted for the probe/2b-2b, NOT read by the adjacency-based Π — corrected 2026-07-05). A tested, byte-anchored channel, not a dead knob. |
| `mixedDiag.beltScale` | mixedInterior.js:390 | AC-STRUCTURE arm's-length squared-Gaussian center predictor; `mixedProbe.beltScale` |
| `mixedDiag.strength` / `yield` / `pierce` | mixedInterior.js:390 | AC-PIERCE arm's-length boolean recompute; `mixedProbe.pierceCount`/`tentCount` |
| `mixedDiag.centers` | mixedInterior.js:390 | AC-STRUCTURE center predictor (rebuilt from published centers) |
| `mixedDiag.A_e` / `Psi_e` / `isAncient` / `coronaActive` | mixedInterior.js:390 | AC-ORDER-MIX edifice-budget bound; province-mask reconstruction |
| `mixedDiag.Pi` / `M` / `legibleByFamily` | mixedInterior.js:404-406 (interpen INJECTED) | AC-INTERPEN Π validation; `mixedProbe.Pi`/`M`/`legibleByFamily` (MF4 gate: Π>0 ⇔ legibleByFamily.pierce ≥ 2) |
| `mixedDiag.n` / `pierceCount` / `Ybase` / `L` / `Φ` | mixedInterior.js:390 | `mixedProbe` scalars; AC-PIERCE Ybase pins |
| `carrier.faultDensity` | mixedInterior.js:384 | sibling-parity activity proxy (magma:413 / stagnant:470 / plates:368 / shell:367), consumed by the tectonic/grain path (tectonic.js:182); tracked by verify.js:27 |

### Verify-workstream verdict (wf_86460f4e-0c7, commit 9a343d4) → VERIFIED

Full-mode verify (38 agents, 3× adversarial). **Unit layer PASS** — all 7 unit ACs (AC-0, AC1, AC-PIERCE,
AC-STRUCTURE, AC-ORDER-MIX, AC-MIX-DISCRETE, AC-INTERPEN) independently re-run + adversarially judged (2–3/3
sufficient). **AC-ZERO-CLOBBER PASS** (75-golden 78/78, corner byte-diffs EMPTY, forbidden files untouched, 4 known
failures not grown). **AC-THARSIS** was marked INSUFFICIENT *by rule* in the raw verdict (a `live=true` AC the
headless workflow cannot drive — the verdict explicitly deferred it to working-Claude via `liveBranch:main`);
**working-Claude drove it green live** against 9a343d4 (evidence above + the re-confirm at seeds {2,3}). With
AC-THARSIS discharged and **NO UAT AC (dd#10)**, the terminal gate = **VERIFIED** (like V2-2a/V2-0), NOT
VERIFIED_PENDING_MAX — the workflow's generic "flips to VERIFIED_PENDING_MAX" synthesis is overridden by the
contract's dd#10 (the holistic pilot UAT is deferred to 2b-2b by design). Verdict archived at `verdict.json` (same
dir). Two verify caveats both resolved: (1) AC-0 conformance table — ADDED above; (2) the two uncommitted
`CameraChoreographer.js`/`LabMode.js` edits are pre-existing NOT-ours warp/autopilot work (handoff-flagged),
correctly EXCLUDED from the commit — my commit staged only its 5 in-scope files, so it is scope-clean.
