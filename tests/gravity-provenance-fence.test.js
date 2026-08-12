// tests/gravity-provenance-fence.test.js — gravity-selfcompression-2026-07-28, AC-PROVENANCE.
//
// WHY THIS FILE EXISTS. AC-PROVENANCE's observable is repo-wide: "no remaining comment or doc
// asserts g = g_c·(R/R_c) as current behaviour on the rocky branch." Three verify rounds checked
// that by hand-grepping, and the adversarial pass rejected the method even though it found no
// defect — a documentation-accuracy claim verified by someone remembering to grep is not a
// verifiable claim, it is a habit. It also missed real cases twice: three annotation banners sat
// BELOW the stale prose they were supposed to cover, and one file was missed entirely.
//
// So the grep becomes a test. If someone reintroduces the retired law as current fact, or writes a
// superseded-banner below the text it claims to cover, CI says so.
//
// SCOPE NOTE: this fences PROSE, not behaviour. The law itself is pinned by
// tests/gravity-selfcompression.test.js and by the two LAW_REGISTRY entries.

import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

// The retired law, written the several ways this repo actually writes it.
const RETIRED = /g_c\s*[·*]\s*\(\s*R\s*\/\s*R_c\s*\)|g_canon\s*[·*]\s*\(\s*R\s*\/\s*R_c\s*\)|surfaceGravity\s*=\s*g_c\s*[·*]/;
const MARKER = 'gravity-selfcompression-2026-07-28';

const SKIP_DIRS = new Set([
  'node_modules', '.git', 'dist', 'build', 'vendor', 'screenshots', 'qa-results',
  '.claude', 'coverage', 'scratchpad',
]);
const EXTS = /\.(js|mjs|md|html)$/;

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue;
    const full = join(dir, name);
    let st;
    try { st = statSync(full); } catch { continue; }
    if (st.isDirectory()) walk(full, out);
    else if (EXTS.test(name)) out.push(full);
  }
  return out;
}

const FILES = walk(ROOT);

describe('AC-PROVENANCE — the retired constant-density law is never asserted as current', () => {
  it('finds a non-trivial number of files to scan (the walk itself is not silently empty)', () => {
    // A fence that scans nothing passes forever. Assert the scan is real before trusting its result.
    expect(FILES.length).toBeGreaterThan(200);
    expect(FILES.some((f) => f.endsWith('src/worldengine/base/conditionVector.js'))).toBe(true);
  });

  // A mention of the retired law is fine; asserting it as CURRENT is not. So the fence asks for a
  // qualifier, not a banner. Three legitimate shapes exist in this repo and all must pass:
  //   (a) the workstream's own record — it exists to describe the change, so mentions are the point;
  //   (b) an annotated historical doc — carries the superseded marker;
  //   (c) a local comparison — e.g. `const gRetired = g_c * (R / R_c)` in a discriminating test.
  // Anything else is prose telling a future reader the retired law is what the engine does.
  // \s+ rather than a literal space throughout: these windows are multi-line joins, so a qualifying
  // phrase routinely straddles a line break ("a law the engine no\nlonger implements"). A literal
  // space silently fails to match there, which would make the fence flag correctly-qualified prose.
  const QUALIFIER = /retired|superseded|legacy|withdrawn|constant[-\s]+density|formerly|\bwas\s|pre-fix|no\s+longer|used\s+to|audit\s+trail/i;
  const OWN_RECORD = 'world-engine-gravity-selfcompression-2026-07-28';

  it('every mention of the retired law is qualified as retired, not asserted as current', () => {
    const offenders = [];
    for (const f of FILES) {
      const rel = relative(ROOT, f);
      if (rel.includes(OWN_RECORD)) continue;              // (a) the change's own record
      const text = readFileSync(f, 'utf8');
      if (!RETIRED.test(text)) continue;
      if (text.includes(MARKER)) continue;                  // (b) annotated historical doc
      // (c) every individual mention must be locally qualified, within a +/- 6 line window.
      const lines = text.split('\n');
      const unqualified = [];
      lines.forEach((l, i) => {
        if (!RETIRED.test(l)) return;
        const window = lines.slice(Math.max(0, i - 6), i + 7).join('\n');
        if (!QUALIFIER.test(window)) unqualified.push(i + 1);
      });
      if (unqualified.length) offenders.push(`${rel} (lines ${unqualified.join(', ')})`);
    }
    expect(offenders, 'prose asserting the retired law as current behaviour').toEqual([]);
  });

  it('the qualifier rule is not vacuous — a planted unqualified assertion is caught', () => {
    // Positive control. Without this, a regex that never matches would pass the test above forever.
    const planted = ['// the engine derives surfaceGravity = g_c·(R/R_c) from the drawn radius',
                     '// and that is how it works today.'].join('\n');
    const lines = planted.split('\n');
    let caught = false;
    lines.forEach((l, i) => {
      if (!RETIRED.test(l)) return;
      const window = lines.slice(Math.max(0, i - 6), i + 7).join('\n');
      if (!QUALIFIER.test(window)) caught = true;
    });
    expect(caught, 'the fence must flag an unqualified assertion of the retired law').toBe(true);
  });

  it('the marker always sits ABOVE the first mention it covers — a banner below its subject is not a banner', () => {
    // The defect that slipped through twice: the insertion landed after the leading comment block,
    // which is exactly where each file's stale prose lives, so "references below" covered nothing.
    const offenders = [];
    for (const f of FILES) {
      const lines = readFileSync(f, 'utf8').split('\n');
      const firstStale = lines.findIndex((l) => RETIRED.test(l));
      const firstMarker = lines.findIndex((l) => l.includes(MARKER));
      if (firstStale === -1 || firstMarker === -1) continue;
      if (firstMarker > firstStale) {
        offenders.push(`${relative(ROOT, f)} (stale line ${firstStale + 1}, marker line ${firstMarker + 1})`);
      }
    }
    expect(offenders, 'superseded markers placed below the prose they claim to cover').toEqual([]);
  });

  it('the shipped derivation names its sources, its validity band, and calibration-vs-derivation', () => {
    const src = readFileSync(join(ROOT, 'src/worldengine/base/conditionVector.js'), 'utf8');
    for (const needle of [
      'Zeng', 'Valencia', '1512.08827', 'astro-ph/0511150',
      'CALIBRATION', 'DERIVATION', 'INFERENCE FLAG',
      '1–8 M⊕',                       // the high branch's stated validity band
    ]) {
      expect(src.includes(needle), `conditionVector.js must name: ${needle}`).toBe(true);
    }
  });

  it('does not claim giant-drivers inherits the new mass law — it back-solves from a pinned mass', () => {
    // The exact false claim that failed AC-0 in verify round 3, pinned so it cannot come back. It
    // had been corrected in intent.md but not in the shipped source comment or the contract.
    const targets = [
      'src/worldengine/base/conditionVector.js',
      'docs/WORKSTREAMS/world-engine-gravity-selfcompression-2026-07-28/intent.md',
      'docs/WORKSTREAMS/world-engine-gravity-selfcompression-2026-07-28/contract.json',
    ];
    for (const rel of targets) {
      const text = readFileSync(join(ROOT, rel), 'utf8');
      if (!/giant-drivers/.test(text)) continue;
      // Wherever giant-drivers is named alongside the mass law, the disclaimer must be present too.
      expect(/back-solve|back solves|pinned mass|never reads this law/i.test(text),
        `${rel} names giant-drivers but does not state that it back-solves from a pinned mass`).toBe(true);
    }
  });
});
