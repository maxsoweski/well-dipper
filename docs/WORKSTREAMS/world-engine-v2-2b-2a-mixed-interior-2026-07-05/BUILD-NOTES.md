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
