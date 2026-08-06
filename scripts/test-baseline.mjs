#!/usr/bin/env node
/**
 * Instrument A — per-test-ID test baseline.
 *
 * WHY THIS EXISTS
 * ---------------
 * The known-good baseline for this branch has been a SCALAR:
 *   "24 failed | 22685 passed | 36 skipped  /  17 failed files | 1423 passed"
 * A scalar cannot see one test going red while another goes green — the counts
 * stay equal. It also cannot tell a *logic* failure from a suite that stopped
 * COLLECTING (a prose backtick inside a GLSL template literal, or a `sed` that
 * broke an import specifier). That second failure mode reads as
 * "0 failed tests against N failed FILES" and is invisible to a test count.
 * See docs/FEATURES/one-pipeline-two-frontends-PLAN.md §6 risks 10 and 11.
 *
 * So this instrument compares SETS, not counts:
 *   - failingTests        — every failing test ID. A test that goes GREEN fails
 *                           the check just as loudly as one that goes red. An
 *                           unexpected pass is a signal, not a gift.
 *   - nonCollectingFiles  — files that failed with ZERO collected assertions.
 *                           This is the backtick / broken-import signature,
 *                           tracked separately from assertion failures so the
 *                           two are never confused for each other.
 *   - failingFiles        — files that failed WITH at least one failing assertion.
 *   - skippedTests/todoTests — so "skip a passing test" is caught. (The plan's
 *                           own Step 0 gate asks for exactly that.)
 *   - files{path: count}  — every collected file and how many tests it holds, so
 *                           a suite that VANISHES (renamed, unresolvable path)
 *                           is caught. A vanished suite changes no failure set.
 *
 * Nothing timing-dependent is recorded: no durations, no start/end times, no
 * failure messages. Every list is sorted, so test ORDER cannot move the file.
 *
 * USAGE
 *   node scripts/test-baseline.mjs --check     # exit 1 if any ID moved, either way
 *   node scripts/test-baseline.mjs --record    # re-capture (deliberate re-bless)
 *   node scripts/test-baseline.mjs --check --from=<raw-vitest-json>   # reuse a run
 *   node scripts/test-baseline.mjs --check --only-failures            # relaxed
 */

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');

const BASELINE_PATH = path.join(ROOT, 'tests', 'baseline', 'known-failures.json');

/**
 * SCOPE — read this before changing it.
 *
 * `.claude/worktrees/` holds 8 stale checkouts of this repo. Vitest's default
 * `exclude` does NOT cover them, so a bare `npx vitest run` collects
 * 1440 files — 1136 of which are duplicate copies of code nobody is editing.
 * Measured 2026-08-06: excluding `.claude/**` drops the run from 1440 files to
 * 304 and from ~13 min of duplicated work to 14 s, while preserving ALL 17
 * failing files and ALL 24 failing tests — every failure lives in the real tree.
 *
 * ⚠ CONSEQUENCE, stated plainly: the *pass* counts here (4646 passed, 4 skipped)
 * are NOT the 22685/36 in the historical scalar baseline. That number counted
 * the stale worktree copies. Both numbers are correct; they measure different
 * file sets. Do not "reconcile" them by dropping this exclusion — worktrees are
 * created and destroyed by parallel agents, so including them makes this
 * instrument alarm on work that never touched the codebase.
 *
 * CLI `--exclude` APPENDS to vitest's defaults rather than replacing them —
 * verified 2026-08-06: `vitest list --filesOnly --exclude '**\/.claude/**'`
 * returns 304 files and zero node_modules paths.
 */
const EXTRA_EXCLUDE = ['**/.claude/**'];

const SEP = ' :: ';

// ─────────────────────────────────────────────────────────────────────────────
// args
// ─────────────────────────────────────────────────────────────────────────────

function parseArgs(argv) {
  const opts = { mode: null, from: null, onlyFailures: false, baseline: BASELINE_PATH };
  for (const arg of argv) {
    if (arg === '--check') opts.mode = 'check';
    else if (arg === '--record' || arg === '--update') opts.mode = 'record';
    else if (arg === '--only-failures') opts.onlyFailures = true;
    else if (arg.startsWith('--from=')) opts.from = path.resolve(ROOT, arg.slice(7));
    else if (arg.startsWith('--baseline=')) opts.baseline = path.resolve(ROOT, arg.slice(11));
    else if (arg === '--help' || arg === '-h') opts.mode = 'help';
    else {
      console.error(`test-baseline: unknown argument "${arg}"`);
      process.exit(2);
    }
  }
  return opts;
}

const HELP = `Instrument A — per-test-ID test baseline

  --check            run the suite and diff the current test-ID sets against
                     tests/baseline/known-failures.json. Exit 1 if ANY id moved
                     in EITHER direction (red->green counts as drift).
  --record           re-capture the baseline. Prints what it is blessing.
  --from=<file>      reuse an existing raw \`vitest --reporter=json\` report
                     instead of running the suite.
  --only-failures    compare only the failing-test and failed-file sets.
                     Ignores skip/todo moves and per-file test counts.
  --baseline=<file>  override the baseline path.
`;

// ─────────────────────────────────────────────────────────────────────────────
// running vitest
// ─────────────────────────────────────────────────────────────────────────────

function runVitest() {
  const out = path.join(
    fs.mkdtempSync(path.join(os.tmpdir(), 'test-baseline-')),
    'report.json',
  );
  const vitestBin = path.join(ROOT, 'node_modules', 'vitest', 'vitest.mjs');
  if (!fs.existsSync(vitestBin)) {
    console.error(`test-baseline: cannot find ${vitestBin} — run npm install first.`);
    process.exit(2);
  }
  const args = ['run'];
  for (const pattern of EXTRA_EXCLUDE) args.push('--exclude', pattern);
  args.push('--reporter=json', `--outputFile=${out}`);

  process.stderr.write(
    `test-baseline: running vitest (${EXTRA_EXCLUDE.length} extra exclude(s))…\n`,
  );
  const res = spawnSync(process.execPath, [vitestBin, ...args], {
    cwd: ROOT,
    encoding: 'utf8',
    maxBuffer: 256 * 1024 * 1024,
  });

  // Vitest exits 1 whenever any test fails, which is the EXPECTED state on this
  // branch. So the exit code is not the signal — a parseable report is.
  if (!fs.existsSync(out)) {
    console.error('test-baseline: vitest produced no JSON report. Raw output follows.\n');
    console.error(res.stdout || '');
    console.error(res.stderr || '');
    process.exit(2);
  }
  return out;
}

function loadReport(file) {
  let report;
  try {
    report = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (err) {
    console.error(`test-baseline: could not parse ${file}: ${err.message}`);
    process.exit(2);
  }
  if (!Array.isArray(report.testResults) || report.testResults.length === 0) {
    console.error(
      `test-baseline: ${file} has no testResults — the run collected nothing. ` +
        'That is itself a failure; refusing to compare against it.',
    );
    process.exit(2);
  }
  return report;
}

// ─────────────────────────────────────────────────────────────────────────────
// summarising
// ─────────────────────────────────────────────────────────────────────────────

const byCodeUnit = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

function relPath(abs) {
  return path.relative(ROOT, abs).split(path.sep).join('/');
}

/** Compact the raw vitest JSON into a stable, diff-friendly shape. */
function summarize(report) {
  const failingTests = [];
  const skippedTests = [];
  const todoTests = [];
  const otherStatusTests = [];
  const failingFiles = [];
  const nonCollectingFiles = [];
  const files = {};
  const currentStatusById = new Map();

  let passed = 0;

  for (const file of report.testResults) {
    const rel = relPath(file.name);
    const assertions = file.assertionResults || [];
    files[rel] = assertions.length;

    let fileHasFailingAssertion = false;
    for (const a of assertions) {
      const id = `${rel}${SEP}${a.fullName}`;
      currentStatusById.set(id, a.status);
      if (a.status === 'failed') {
        failingTests.push(id);
        fileHasFailingAssertion = true;
      } else if (a.status === 'passed') {
        passed += 1;
      } else if (a.status === 'skipped' || a.status === 'pending') {
        skippedTests.push(id);
      } else if (a.status === 'todo') {
        todoTests.push(id);
      } else {
        otherStatusTests.push(`${a.status}${SEP}${id}`);
      }
    }

    if (file.status !== 'passed') {
      // THE DISTINCTION THAT MATTERS. A failed file with zero collected
      // assertions did not fail an assertion — it never got that far. That is
      // the GLSL-backtick / broken-import-specifier / "No test suite found"
      // signature, and it is invisible to a failing-test count.
      if (assertions.length === 0) nonCollectingFiles.push(rel);
      else if (fileHasFailingAssertion) failingFiles.push(rel);
      else nonCollectingFiles.push(rel); // failed in a hook, collected but no failing test
    }
  }

  const sortedFiles = {};
  for (const key of Object.keys(files).sort(byCodeUnit)) sortedFiles[key] = files[key];

  return {
    summary: {
      counts: {
        collectedFiles: report.testResults.length,
        failingFiles: failingFiles.length,
        nonCollectingFiles: nonCollectingFiles.length,
        tests: failingTests.length + skippedTests.length + todoTests.length +
          otherStatusTests.length + passed,
        failed: failingTests.length,
        passed,
        skipped: skippedTests.length,
        todo: todoTests.length,
      },
      nonCollectingFiles: nonCollectingFiles.sort(byCodeUnit),
      failingFiles: failingFiles.sort(byCodeUnit),
      failingTests: failingTests.sort(byCodeUnit),
      skippedTests: skippedTests.sort(byCodeUnit),
      todoTests: todoTests.sort(byCodeUnit),
      otherStatusTests: otherStatusTests.sort(byCodeUnit),
      files: sortedFiles,
    },
    currentStatusById,
  };
}

function vitestVersion() {
  try {
    return JSON.parse(
      fs.readFileSync(path.join(ROOT, 'node_modules', 'vitest', 'package.json'), 'utf8'),
    ).version;
  } catch {
    return 'unknown';
  }
}

function gitHead() {
  const res = spawnSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: ROOT, encoding: 'utf8' });
  return res.status === 0 ? res.stdout.trim() : 'unknown';
}

// ─────────────────────────────────────────────────────────────────────────────
// diffing
// ─────────────────────────────────────────────────────────────────────────────

/** Multiset diff — two tests may legitimately share a fullName. */
function multisetDiff(base = [], cur = []) {
  const counts = new Map();
  for (const id of base) counts.set(id, (counts.get(id) || 0) + 1);
  for (const id of cur) counts.set(id, (counts.get(id) || 0) - 1);
  const removed = [];
  const added = [];
  for (const [id, n] of counts) {
    for (let i = 0; i < n; i += 1) removed.push(id);
    for (let i = 0; i < -n; i += 1) added.push(id);
  }
  return { removed: removed.sort(byCodeUnit), added: added.sort(byCodeUnit) };
}

function mapDiff(base = {}, cur = {}) {
  const changed = [];
  const gone = [];
  const appeared = [];
  for (const key of Object.keys(base).sort(byCodeUnit)) {
    if (!(key in cur)) gone.push(key);
    else if (base[key] !== cur[key]) changed.push([key, base[key], cur[key]]);
  }
  for (const key of Object.keys(cur).sort(byCodeUnit)) {
    if (!(key in base)) appeared.push(key);
  }
  return { changed, gone, appeared };
}

function section(title, lines, note) {
  if (lines.length === 0) return [];
  const out = ['', `── ${title} ${'─'.repeat(Math.max(0, 66 - title.length))}`];
  if (note) out.push(`   ${note}`);
  out.push(...lines);
  return out;
}

function diffSummaries(base, cur, currentStatusById, onlyFailures) {
  const lines = [];
  let drift = false;

  // 1. non-collecting files — the backtick / broken-path signature.
  const nc = multisetDiff(base.nonCollectingFiles, cur.nonCollectingFiles);
  if (nc.added.length || nc.removed.length) drift = true;
  lines.push(
    ...section(
      'SUITES THAT STOPPED COLLECTING',
      [
        ...nc.added.map((f) => `  + ${f}`),
        ...nc.removed.map((f) => `  - ${f}  (now collects again)`),
      ],
      'a file here failed WITHOUT running an assertion — parse error, broken ' +
        'import\n   specifier, or an empty suite. This is NOT a logic failure.',
    ),
  );

  // 2. files with failing assertions.
  const ff = multisetDiff(base.failingFiles, cur.failingFiles);
  if (ff.added.length || ff.removed.length) drift = true;
  lines.push(
    ...section('FILES WITH FAILING ASSERTIONS', [
      ...ff.added.map((f) => `  + ${f}`),
      ...ff.removed.map((f) => `  - ${f}  (no longer has a failing test)`),
    ]),
  );

  // 3. individual failing test IDs — the core of the instrument.
  const ft = multisetDiff(base.failingTests, cur.failingTests);
  if (ft.added.length || ft.removed.length) drift = true;
  lines.push(
    ...section(
      'FAILING TESTS',
      [
        ...ft.added.map((id) => `  NEWLY RED    ${id}`),
        ...ft.removed.map((id) => {
          const now = currentStatusById.get(id);
          const why = now === undefined
            ? 'GONE — deleted or renamed'
            : now === 'passed'
              ? 'now PASSES'
              : `now ${now}`;
          return `  NO LONGER RED ${id}\n                  ↳ ${why}`;
        }),
      ],
      'a test leaving this set is drift too. An unexpected pass is a signal,\n' +
        '   not a gift — something changed, and nobody said what.',
    ),
  );

  if (!onlyFailures) {
    // 4. skipped / todo.
    const sk = multisetDiff(base.skippedTests, cur.skippedTests);
    const td = multisetDiff(base.todoTests, cur.todoTests);
    const other = multisetDiff(base.otherStatusTests, cur.otherStatusTests);
    if (sk.added.length || sk.removed.length || td.added.length || td.removed.length ||
        other.added.length || other.removed.length) drift = true;
    lines.push(
      ...section('SKIPPED / TODO / OTHER', [
        ...sk.added.map((id) => `  + skipped  ${id}`),
        ...sk.removed.map((id) => `  - skipped  ${id}  (now ${currentStatusById.get(id) ?? 'GONE'})`),
        ...td.added.map((id) => `  + todo     ${id}`),
        ...td.removed.map((id) => `  - todo     ${id}  (now ${currentStatusById.get(id) ?? 'GONE'})`),
        ...other.added.map((id) => `  + ${id}`),
        ...other.removed.map((id) => `  - ${id}`),
      ]),
    );

    // 5. collected files + per-file test counts — catches a VANISHED suite,
    //    which moves no failure set at all.
    const fd = mapDiff(base.files, cur.files);
    if (fd.gone.length || fd.appeared.length || fd.changed.length) drift = true;
    lines.push(
      ...section(
        'COLLECTED FILES',
        [
          ...fd.gone.map((f) => `  VANISHED  ${f}  (held ${base.files[f]} tests)`),
          ...fd.appeared.map((f) => `  NEW       ${f}  (${cur.files[f]} tests)`),
        ],
        'a suite that disappears changes NO failure set. That is why it is here.',
      ),
    );
    lines.push(
      ...section(
        'PER-FILE TEST COUNTS',
        fd.changed.map(([f, b, c]) => `  ${f}: ${b} → ${c}`),
      ),
    );
  }

  return { drift, lines };
}

function countsLine(c) {
  return `files ${c.collectedFiles} (${c.failingFiles} failing, ${c.nonCollectingFiles} non-collecting) · ` +
    `tests ${c.tests} (${c.failed} failed, ${c.passed} passed, ${c.skipped} skipped, ${c.todo} todo)`;
}

// ─────────────────────────────────────────────────────────────────────────────
// main
// ─────────────────────────────────────────────────────────────────────────────

function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.mode === 'help' || opts.mode === null) {
    process.stdout.write(HELP);
    process.exit(opts.mode === 'help' ? 0 : 2);
  }

  const reportFile = opts.from ?? runVitest();
  const report = loadReport(reportFile);
  const { summary, currentStatusById } = summarize(report);

  const baselineExists = fs.existsSync(opts.baseline);
  const baseline = baselineExists ? JSON.parse(fs.readFileSync(opts.baseline, 'utf8')) : null;

  if (opts.mode === 'record') {
    if (baseline) {
      const { lines } = diffSummaries(
        baseline.summary ?? {}, summary, currentStatusById, opts.onlyFailures,
      );
      if (lines.length) {
        process.stdout.write(
          '\ntest-baseline: RE-RECORDING. What is being blessed:\n' + lines.join('\n') + '\n',
        );
      } else {
        process.stdout.write('\ntest-baseline: re-recording an identical baseline.\n');
      }
    }
    const doc = {
      _readme: [
        'Instrument A — the per-test-ID baseline for this branch. Generated by',
        'scripts/test-baseline.mjs; do not hand-edit. Re-capture deliberately with',
        '`node scripts/test-baseline.mjs --record` and say in the commit message which',
        'IDs moved and why. A blanket re-record throws the instrument away.',
        'Lists are sorted; no durations or timestamps are recorded, so nothing here',
        'churns on test order or machine speed.',
      ],
      recordedAt: new Date().toISOString(),
      recordedFromCommit: gitHead(),
      vitest: vitestVersion(),
      scope: {
        extraExclude: EXTRA_EXCLUDE,
        note:
          'Vitest default excludes do NOT cover .claude/worktrees/, which holds 8 stale ' +
          'checkouts of this repo (1136 duplicate test files). Excluding them preserves ' +
          'all 17 failing files and all 24 failing tests. The pass counts below are ' +
          'therefore NOT the historical 22685 scalar — that number counted the copies.',
      },
      summary,
    };
    fs.mkdirSync(path.dirname(opts.baseline), { recursive: true });
    fs.writeFileSync(opts.baseline, `${JSON.stringify(doc, null, 2)}\n`);
    process.stdout.write(
      `\ntest-baseline: recorded ${relPath(opts.baseline)}\n` +
      `  ${countsLine(summary.counts)}\n`,
    );
    process.exit(0);
  }

  // --check
  if (!baseline) {
    console.error(
      `test-baseline: no baseline at ${relPath(opts.baseline)}. ` +
        'Run `node scripts/test-baseline.mjs --record` first.',
    );
    process.exit(2);
  }

  const warnings = [];
  const baseScope = (baseline.scope?.extraExclude ?? []).join(',');
  if (baseScope !== EXTRA_EXCLUDE.join(',')) {
    warnings.push(
      `scope MISMATCH: baseline recorded exclude [${baseScope}], script uses ` +
        `[${EXTRA_EXCLUDE.join(',')}]. The two runs measured different file sets.`,
    );
  }
  const bv = baseline.vitest;
  if (bv && bv !== vitestVersion()) {
    warnings.push(`vitest version moved ${bv} → ${vitestVersion()} since the baseline was recorded.`);
  }

  const { drift, lines } = diffSummaries(
    baseline.summary ?? {}, summary, currentStatusById, opts.onlyFailures,
  );

  const scopeDrift = baseScope !== EXTRA_EXCLUDE.join(',');

  process.stdout.write(`\ntest-baseline --check${opts.onlyFailures ? ' --only-failures' : ''}\n`);
  process.stdout.write(`  baseline : ${countsLine(baseline.summary.counts)}\n`);
  process.stdout.write(`  current  : ${countsLine(summary.counts)}\n`);
  for (const w of warnings) process.stdout.write(`  ⚠ ${w}\n`);

  if (!drift && !scopeDrift) {
    process.stdout.write(
      '\nOK — every test ID is exactly where the baseline left it ' +
        `(${summary.counts.failed} failing, ${summary.counts.nonCollectingFiles} non-collecting files).\n`,
    );
    process.exit(0);
  }

  process.stdout.write(lines.join('\n'));
  process.stdout.write(
    '\n\nDRIFT — the test-ID set moved. Nothing here is automatically good or bad:\n' +
    '  · a NEWLY RED test is a regression to fix.\n' +
    '  · a NO LONGER RED test is a change nobody declared. Find out why, then\n' +
    '    re-record with `--record` and name the IDs in the commit message.\n' +
    '  · a suite that STOPPED COLLECTING is a parse/import break, not a logic bug.\n' +
    '  · a VANISHED file is a rename or an unresolvable path.\n',
  );
  process.exit(1);
}

main();
