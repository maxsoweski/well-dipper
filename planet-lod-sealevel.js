// planet-lod-sealevel.js — the SINGLE SOURCE of the sea-level solver, RE-EXPORTED, NOT RE-DECLARED.
//
// ⭐ MOVED 2026-09-02 → src/worldengine/rivers/seaLevel.js, byte-verbatim, for
// docs/WORKSTREAMS/wire-river-router-lab-into-game/. It moved with the GPU-free router core because
// the game's bake worker must run the same solve the lab runs, and nothing under src/ could reach a
// module at the repo root (tests/src-boundary-fence.test.js). This line is the only thing keeping the
// lab's and the suites' existing `from './planet-lod-sealevel.js'` call sites unchanged — deleting it
// is a breaking change. The doc comment, the histogram method and the degenerate-case clamps all live
// in the new module; do not restate them here, and never re-declare solveSeaLevel in this file.
export { solveSeaLevel } from './src/worldengine/rivers/seaLevel.js';
