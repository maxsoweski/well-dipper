// Vitest config used ONLY by Stryker mutation runs (`npm run test:mutation:*`).
// It exists so a mutation run executes 3 test files instead of the repo's 308.
//
// WHY A SEPARATE CONFIG AND NOT `vite.config.js`
// The repo's suite measured 4838 tests across 308 files. Stryker re-runs the
// suite once per surviving-candidate mutant, so an unscoped run multiplies that
// by the mutant count and is useless. Scoping the *test* side here (rather than
// scoping on Stryker's side) is the only lever the vitest runner exposes:
// @stryker-mutator/vitest-runner drives vitest through its own config file,
// which we hand it via `vitest.configFile` in stryker.conf.mjs.
//
// ⚠ ROOT IS DERIVED FROM import.meta.url ON PURPOSE.
// Stryker copies the project into a sandbox (.stryker-tmp/sandbox-*) and runs
// there. The three suites in scope also derive their own ROOT from
// import.meta.url and then read real files off disk (planet-lod-lab.html,
// planet-lod-shaders.glsl.js, src/worldengine/**). If this config hard-coded an
// absolute repo path, vitest would run the sandbox's *mutated* test files
// against the REAL repo's sources — and every mutant would look identical to
// the original. Deriving root here keeps the sandbox self-consistent: the
// sandbox is a genuine copy (Stryker copies, it does not symlink source files),
// so `realpathSync` on anything vitest loads stays inside the sandbox.
//
// SCOPE SWITCH: env `WD_MUTATION_SCOPE`
//   'helper'     -> tests/source-scan-helper.test.js only. Used when the mutated
//                   subject is tests/helpers/source-scan.mjs, so a survivor
//                   means "that helper branch has no assertion in the helper's
//                   OWN suite that kills it" — the two other suites also import
//                   the helper and would mask the gap.
//   'assertions' -> all three suites. Used when the mutated subjects are the
//                   test files themselves; every one of them must be present
//                   both as mutation target and as executing suite.
//   unset        -> all three (the safe superset).

import { defineConfig } from 'vitest/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const SCOPE = process.env.WD_MUTATION_SCOPE ?? 'assertions';

const HELPER_SUITE = ['tests/source-scan-helper.test.js'];
const ALL_SUITES = [
  'tests/source-scan-helper.test.js',
  'tests/radius-live-feed.test.js',
  'tests/radius-live-feed-fence.test.js',
];

export default defineConfig({
  root: ROOT,
  resolve: {
    alias: {
      // Mirrors vite.config.js. Kept so an in-scope suite that reaches the
      // vendored motion-test-kit resolves the same way it does under
      // `npm test`. None of the three currently import it; this is here so a
      // future in-scope suite does not fail in a way that reads as a mutant.
      'motion-test-kit': path.resolve(ROOT, 'vendor/motion-test-kit'),
    },
  },
  test: {
    include: SCOPE === 'helper' ? HELPER_SUITE : ALL_SUITES,
    // `.claude/` holds plugin/skill trees with their own *.test.js files. The
    // repo's own scripts already pass `--exclude '**/.claude/**'` for the same
    // reason; a config-level exclude is the equivalent that survives being
    // invoked by Stryker rather than by npm.
    exclude: ['**/node_modules/**', '**/.claude/**', '**/.stryker-tmp/**'],
    // ⚠ REDUNDANT UNDER STRYKER, KEPT FOR THE HAND-RUN CASE. The vitest runner
    // overrides parallelism itself — node_modules/@stryker-mutator/vitest-runner
    // `maxWorkers: 1` alongside `maxThreads: 1` / `maxConcurrency: 1` — so this
    // line changes nothing when Stryker is driving. It matters when a human
    // reproduces a survivor by hand with
    //   npx vitest run -c tools/vitest.mutation.config.mjs
    // and needs the same serial ordering Stryker saw.
    fileParallelism: false,
    // ⚠ 60s, NOT vitest's 5s default, and the reason is instrumentation — not
    // slow tests. MEASURED: the three suites run in 596ms unmutated
    // (`npx vitest run` on them, 171 passed). Under Stryker the whole subject
    // file is rewritten so every statement carries a `stryCov_9fa48(...)`
    // coverage call and every expression a `stryMutAct_9fa48(id)` switch. With
    // `coverageAnalysis: 'perTest'` that instrumentation lands inside
    // source-scan.mjs's per-character state machine, and the FIRST run —
    // the unmutated dry run — blew the 5s default on
    // "lineOf agrees on raw and stripped source at every 1000th offset".
    // Raising it here is scoped to mutation runs; `npm test` still uses the 5s
    // default, so a genuinely slow test still shows up as slow in normal CI.
    //
    // ⚠ THIS NUMBER MUST STAY ABOVE stryker.conf.mjs's per-mutant budget's
    // floor, and BELOW nothing in particular — hangs are Stryker's job to kill,
    // not vitest's. Mutating the state machine's unterminated-comment arms so
    // the index moves BACKWARDS makes the scan loop spin forever; it is
    // synchronous, so vitest's timer never gets a turn and the worker would
    // hang with no output. Stryker kills the whole runner PROCESS on its own
    // timeout, which is why such a mutant is reported as `Timeout` (counted as
    // killed) instead of wedging the run.
    testTimeout: 60_000,
    hookTimeout: 60_000,
  },
});
