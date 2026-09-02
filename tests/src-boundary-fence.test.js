// tests/src-boundary-fence.test.js — PLAN §4 Step 7's boundary fence.
//
// THE INVARIANT: no file under `src/` imports a module OUTSIDE `src/`, except the entries in the
// ALLOWLIST below.
//
// ⛔ WHY THIS IS NOT WRITTEN AS "ZERO ALLOWLIST ENTRIES", stated up front because a zero is the
// tempting headline and it would be a lie. Step 7's own text rules it out: after the five moves,
// `fieldSampler.js` still reaches `planet-lod-rivers.js` at the root, and rivers imports `three` and
// `ConvexHull`, so whether it belongs under `src/worldengine/` or `src/rendering/bake/` is an
// UNRESOLVED decision (PLAN §7, "The river/tectonic bakes"), not a rewrite this step may make. An
// allowlist that hides that is a fence drawn around a boundary nobody has actually decided. So the
// allowlist is stated honestly — EXACTLY ONE root-file entry, carrying what removes it — and
// `the root-file allowlist is exactly one entry` below reds if a second one is ever added quietly.
//
// The four `src/cockpit/__tests__ → tests/helpers/glb-parse.mjs` entries are a different animal and
// are counted separately: a TEST importing a TEST HELPER is not a production dependency escaping the
// tree, and folding them in with the rivers entry would make "one root-file entry" read as five.
//
// WHAT IT SCANS, and the two spellings that matter:
//   · relative      `./x.js`, `../../x.js`  — resolved against the importing file's directory
//   · root-absolute `/x.js`                 — vite resolves these from the project root, so a
//                                             `/planet-lod-rivers.js` would escape the tree while
//                                             LOOKING like an in-tree path. Both are resolved and
//                                             compared, never pattern-matched.
// Bare specifiers (`three`, `alea`) are node_modules and are not this fence's subject.
//
// ⚠ .mjs IS WALKED, not just .js. `jsFilesUnder` in tests/helpers/source-scan.mjs filters to `.js`
// (correctly, for the corpora that use it); five .mjs files live under src/ today and a sixth would
// otherwise be born outside every boundary check. This file therefore has its own walker.
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative, resolve } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

function sourceFilesUnder(rel) {
  const out = [];
  const walk = (d) => {
    for (const ent of readdirSync(join(ROOT, d), { withFileTypes: true })) {
      const child = `${d}/${ent.name}`;
      if (ent.isDirectory()) walk(child);
      else if (/\.(js|mjs)$/.test(ent.name)) out.push(child);
    }
  };
  walk(rel);
  return out.sort();
}

const SRC_FILES = sourceFilesUnder('src');

// `from '…'`, `import('…')`, `import '…'`. Deliberately NOT anchored to line start: re-exports
// (`export { x } from '…'`) and dynamic imports inside a function body both matter.
const SPEC_RE = /(?:\bfrom\s*|\bimport\s*\(\s*|\bimport\s+)(['"])([^'"]+)\1/g;

// ── the allowlist ────────────────────────────────────────────────────────────────────────────────
// `file` + `spec` together key an entry, and BOTH are checked for liveness below: an entry whose
// file no longer holds that specifier is deleted, not left standing. `clears` is the thing that
// removes it — a step where one exists, and where one does not, the open decision and whose call it
// is. ⛔ "TBD" is not an admissible value; `every allowlist entry names what clears it` reds on it.
const ALLOWLIST = [
  {
    kind: 'root-module',
    file: 'src/worldengine/instrument/fieldSampler.js',
    spec: '../../../planet-lod-rivers.js',
    why: 'the instrument samples the SAME height field the bake routes, so it reads createHeightSampler '
       + 'from the bake module rather than re-deriving it — a second sampler is exactly the drift this '
       + 'plan exists to remove. planet-lod-rivers.js still cannot follow the others under src/ as a FILE: '
       + 'its sampler is GPU-coupled (an RTT readback). The 2026-09-01 province wire moved out the mesh builder '
       + '(→ src/worldengine/mesh/) and the province baker, and the 2026-09-02 router wire the router core (→ src/worldengine/rivers/) and the carve + height cube bakers (→ src/rendering/bake/).',
    clears: 'the remaining 59 KB of planet-lod-rivers.js — PLAN §7 "The river/tectonic bakes", still its own step. '
          + 'The DECISION half is TAKEN (carried C25, 2026-08-12/20, applied 2026-09-01): three.js is admitted '
          + 'under src/worldengine/ (uniforms.js, mesh/sphereMesh.js); anything needing a RENDERER lands under '
          + 'src/rendering/bake/ (provinceCube.js). createHeightSampler needs one, so it moves there when it moves.',
  },
  // ── test helpers. A test reaching a test helper is not the tree leaking; it is two halves of the
  // test suite that happen to sit on opposite sides of a directory line. They are listed (rather than
  // excluded by a `__tests__` filter) because an exclusion by path shape would also stop scanning
  // whatever else those directories grow.
  ...['PanelHost', 'PanelLayout', 'PanelMover', 'ScreenUV'].map((n) => ({
    kind: 'test-helper',
    file: `src/cockpit/__tests__/${n}.test.js`,
    spec: '../../../tests/helpers/glb-parse.mjs',
    why: 'a co-located cockpit test importing the shared GLB parser from tests/helpers. Test-to-test-'
       + 'helper, not production code escaping the tree.',
    clears: 'nothing, deliberately — these are tests, and moving the helper into src/ to satisfy a '
          + 'boundary check would put test scaffolding in the shipped tree to make a number nicer.',
  })),
];

// Returns [{ file, line, spec, target }] for every specifier that resolves OUTSIDE src/.
// `overrides` maps a repo-relative path to replacement TEXT, so a planted escape is built in memory
// and never written to disk — the working tree stays clean on every run, including a failing one.
function scanEscapes(overrides = new Map(), allowlist = ALLOWLIST) {
  const out = [];
  for (const rel of SRC_FILES) {
    const text = overrides.get(rel) ?? readFileSync(join(ROOT, rel), 'utf8');
    const lines = text.split('\n');
    for (let i = 0; i < lines.length; i++) {
      for (const m of lines[i].matchAll(SPEC_RE)) {
        const spec = m[2];
        if (!/^[./]/.test(spec)) continue;                       // bare ⇒ node_modules
        const abs = spec.startsWith('/')
          ? resolve(ROOT, '.' + spec)                            // vite root-absolute
          : resolve(dirname(join(ROOT, rel)), spec);
        const target = relative(ROOT, abs);
        if (target.startsWith('src/') || target.startsWith('src\\')) continue;
        if (allowlist.some((a) => a.file === rel && a.spec === spec)) continue;
        out.push({ file: rel, line: i + 1, spec, target });
      }
    }
  }
  return out;
}

describe('AC-BOUNDARY — nothing under src/ imports outside src/ (Step 7)', () => {
  it('the walker really walked (a THRESHOLD, and only that)', () => {
    // ⚠ STATED SO IT IS NOT MISTAKEN FOR A COVERAGE CHECK, the same warning the radius fence's walker
    // carries. Measured 2026-08-12: 370 files under src/ (365 .js + 5 .mjs), so `> 100` survives
    // losing three quarters of the tree. It proves the walk returned something. The escape scan below
    // is what has the real property, and the planted controls are what prove IT can fail.
    expect(SRC_FILES.length).toBeGreaterThan(100);
    expect(SRC_FILES).toContain('src/worldengine/base/conditionVector.js');
    expect(SRC_FILES).toContain('src/worldengine/shaders/uniforms.js');
    expect(SRC_FILES.some((f) => f.endsWith('.mjs')), 'the .mjs arm is exercised by a real file').toBe(true);
  });

  it('every import that leaves src/ is on the allowlist', () => {
    const escapes = scanEscapes();
    expect(escapes.map((e) => `${e.file}:${e.line} -> ${e.spec}`),
      'an import under src/ resolves outside src/. Either move the module in, or add an allowlist '
      + 'entry that states WHY and what clears it — a silent entry defeats the fence.').toEqual([]);
  });

  it('the root-file allowlist is exactly one entry, and it is the rivers sampler', () => {
    // The honest-allowlist assertion. Step 7's text: "State the allowlist honestly: exactly one
    // root-file entry, carrying the named step that removes it." A second one added quietly is the
    // failure mode that turns this fence into decoration, so the count is pinned rather than described.
    const rootEntries = ALLOWLIST.filter((a) => a.kind === 'root-module');
    expect(rootEntries.map((a) => `${a.file} -> ${a.spec}`)).toEqual([
      'src/worldengine/instrument/fieldSampler.js -> ../../../planet-lod-rivers.js',
    ]);
    expect(ALLOWLIST.filter((a) => a.kind === 'test-helper')).toHaveLength(4);
    expect(ALLOWLIST).toHaveLength(5);            // no third kind arriving unannounced
  });

  it('every allowlist entry is LIVE — the file exists and still holds that exact specifier', () => {
    // A stale entry is worse than none: it reads as a justified exemption while its site is gone, and
    // it silently pre-forgives whatever lands on that (file, spec) pair next.
    for (const a of ALLOWLIST) {
      expect(existsSync(join(ROOT, a.file)), `allowlist file '${a.file}' does not exist`).toBe(true);
      const text = readFileSync(join(ROOT, a.file), 'utf8');
      const held = [...text.matchAll(SPEC_RE)].some((m) => m[2] === a.spec);
      expect(held, `'${a.file}' no longer imports '${a.spec}' — the entry is STALE. Delete it in the `
        + 'commit that moved the import, rather than leaving an exemption pointed at nothing.').toBe(true);
    }
  });

  it('every allowlist entry names what clears it, in a sentence', () => {
    for (const a of ALLOWLIST) {
      expect(a.why.length, `entry '${a.file}' has no stated reason`).toBeGreaterThan(40);
      expect(a.clears.length, `entry '${a.file}' does not say what removes it`).toBeGreaterThan(20);
      expect(/^\s*(tbd|todo|later|\?+)\s*$/i.test(a.clears),
        `entry '${a.file}' parks its clearer in a placeholder`).toBe(false);
    }
  });
});

describe('AC-BOUNDARY — MANDATORY NEGATIVE CHECKS: the fence catches a real escape', () => {
  // A gate that has never failed is not a gate (PLAN §11.3.1). Each of these takes the REAL current
  // source, plants one defect in memory, and asserts the scanner reports it.
  const VICTIM = 'src/worldengine/port/conditionFromBody.js';
  const src = () => readFileSync(join(ROOT, VICTIM), 'utf8');

  it('PLANTED: a relative import escaping to the repo root is caught', () => {
    const planted = new Map([[VICTIM, `import { X } from '../../../driver-presets.js';\n${src()}`]]);
    const hits = scanEscapes(planted);
    expect(hits.map((h) => h.spec)).toEqual(['../../../driver-presets.js']);
    expect(hits[0].target).toBe('driver-presets.js');
  });

  it('PLANTED: a vite ROOT-ABSOLUTE import is caught (it looks in-tree and is not)', () => {
    // The spelling a relative-path regex misses. `/planet-lod-rivers.js` resolves from the project
    // root, not from src/, so a path-shape check would read it as fine.
    const planted = new Map([[VICTIM, `import { Y } from '/planet-lod-rivers.js';\n${src()}`]]);
    expect(scanEscapes(planted).map((h) => h.target)).toEqual(['planet-lod-rivers.js']);
  });

  it('PLANTED: a re-export and a dynamic import are caught, not just static `import … from`', () => {
    const planted = new Map([[VICTIM,
      `export { a } from '../../../lab-isolation.js';\nconst m = await import('../../../body-drivers.js');\n${src()}`]]);
    expect(scanEscapes(planted).map((h) => h.target).sort()).toEqual(['body-drivers.js', 'lab-isolation.js']);
  });

  it('PLANTED: the allowlist forgives its OWN (file, spec) pair and nothing else', () => {
    // The exemption is keyed on the pair. A DIFFERENT root import in the allowlisted file must still
    // be caught — otherwise one entry launders the whole file.
    const rivers = 'src/worldengine/instrument/fieldSampler.js';
    const planted = new Map([[rivers,
      `import { Z } from '../../../planet-lod-tectonic.js';\n${readFileSync(join(ROOT, rivers), 'utf8')}`]]);
    const hits = scanEscapes(planted);
    expect(hits.map((h) => h.target)).toEqual(['planet-lod-tectonic.js']);   // the allowlisted one stays forgiven
  });

  it('PLANTED: a STALE allowlist entry is reported rather than silently widening the fence', () => {
    // The liveness test's own control: point an entry at a specifier the file does not hold and
    // assert the same predicate the live test uses would fail.
    const stale = { kind: 'root-module', file: 'src/worldengine/instrument/fieldSampler.js', spec: '../../../nope.js' };
    const text = readFileSync(join(ROOT, stale.file), 'utf8');
    expect([...text.matchAll(SPEC_RE)].some((m) => m[2] === stale.spec)).toBe(false);
  });

  it('CONTROL: the scan is non-vacuous — it sees the real imports it is meant to be reading', () => {
    // A scanner whose regex silently matched nothing would pass every assertion above. Count what it
    // actually resolves across the tree, so "zero escapes" means "read everything and found none".
    let total = 0;
    for (const rel of SRC_FILES) {
      for (const m of readFileSync(join(ROOT, rel), 'utf8').matchAll(SPEC_RE)) {
        if (/^[./]/.test(m[2])) total++;
      }
    }
    expect(total, 'the specifier regex resolved almost nothing — it is broken, not the tree').toBeGreaterThan(300);
  });
});
