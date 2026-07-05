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
