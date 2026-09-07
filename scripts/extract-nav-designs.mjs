#!/usr/bin/env node
/**
 * extract-nav-designs — lift designs 1 and 2 out of `nav-240p-lab.html` into
 * `src/ui/navViewModes/designs.js`.
 *
 * ── WHY THIS IS A SCRIPT AND NOT A ONE-OFF COPY ────────────────────────────────────────────────
 *
 * Max ruled on two PICTURES, drawn at 427x240 with the shipped face and the game's own data. Every
 * hand-transcription of ~500 lines of texel-exact draw code is a chance to ship a picture he did not
 * rule on, and the drift would be INVISIBLE — it reads as a design decision, not as a typo. So the
 * game's copy is generated, and `node scripts/extract-nav-designs.mjs --check` is the audit: it
 * regenerates and diffs, and a non-zero exit means the two have parted.
 *
 * ⭐ IT ALSO MAKES THE LAB THE PLACE TO CHANGE A DESIGN. When Max rules on a change — as he did on
 * 2026-09-07 for the SYSTEM ladder — the edit goes in `nav-240p-lab.html` and this script carries it
 * across. That keeps the lab a LIVING SPEC instead of a frozen artifact the game slowly diverges
 * from, which is the debt `converge-dont-declare-divergence` is about.
 *
 * ── ⛔ MARKERS, NOT LINE NUMBERS ────────────────────────────────────────────────────────────────
 *
 * The first version of this extraction used line ranges. That works exactly once: the moment anyone
 * edits the lab, every range silently points at the wrong code and the output still LOOKS plausible.
 * Every boundary below is a string that appears once in the file.
 *
 * ── THE FIVE DELIBERATE DEPARTURES FROM THE LAB, ALL PLUMBING ───────────────────────────────────
 *
 *  1. `fire()` reports through an injected `onViolation` rather than `console.error`, so a headless
 *     test can assert the guard fired instead of scraping a console.
 *  2. `lumImage`'s async CPU fallback drops the lab's `draw()` call — the nav repaints continuously,
 *     and a second redraw would be one animation loop fighting another.
 *  3. `zoomIdx` and the lab's `const S = {...}` block go: both arrive from the caller instead.
 *  4. `PixelText` comes in as parameters, so a test can drive the designs with no module graph.
 *  5. Design 3 is never extracted. All three judges killed it for deriving the fullscreen layout
 *     from the 52x43 cockpit panel — the exact inverse of Max's ruling that the fullscreen nav is
 *     the SOURCE. ⛔ Do not add it.
 *
 * Usage:  node scripts/extract-nav-designs.mjs            regenerate
 *         node scripts/extract-nav-designs.mjs --check    verify the checked-in copy matches
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const LAB = join(ROOT, 'nav-240p-lab.html');
const OUT = join(ROOT, 'src/ui/navViewModes/designs.js');

const lab = readFileSync(LAB, 'utf8');

/** Text between two unique markers, `from` inclusive and `to` exclusive. Throws if either is not unique. */
function slice(from, to) {
  for (const m of [from, to]) {
    const n = lab.split(m).length - 1;
    if (n !== 1) throw new Error(`marker ${JSON.stringify(m.slice(0, 60))} appears ${n} times, needs exactly 1`);
  }
  const a = lab.indexOf(from), b = lab.indexOf(to);
  if (b < a) throw new Error(`markers out of order: ${JSON.stringify(from.slice(0, 40))}`);
  return lab.slice(a, b).replace(/\s+$/, '');
}

/** A banner line is a run of box-drawing rules; match the TITLE that follows one, not the rule. */
const banner = (title) => `// ${'═'.repeat(96)}\n// ${title}`;

const BLOCKS = [
  // the layout guard, proved by sabotage in the lab and the only thing between "this design fits"
  // and "the canvas clipped the overflow for free"
  slice('const _fired = new Set();', banner('STATE')),
  // LEVELS / INK / isHere / SPECTRAL — but NOT the lab's own `S`, which the caller supplies
  slice("const LEVELS = ['GALAXY'", banner('PRIMITIVES.')),
  // fillRect-only primitives: no arc, no stroke, no dash — a 1px stroke at 240p is a grey smear
  slice('// PRIMITIVES.', banner('REAL DATA.')),
  // the per-tile star estimate, which design 2's status line needs
  slice('function estStars(', 'function reindexStars('),
  // luminosity blit + the level extents + the prism projection
  slice('const LUM_CAP = 448;', banner('DESIGN 1 —')),
  // ⭐ THE TWO DESIGNS THEMSELVES, VERBATIM
  slice('// DESIGN 1 —', banner('DESIGN 3 —')),
];

let body = BLOCKS.join('\n\n');

// ── departure 1: report through the injected callback ────────────────────────────────────────────
const CONSOLE_LINE = '  console.error(`NAV-240p OVERFLOW [D${S.design} ${LEVELS[S.level]} ${S.lines}p ${FACE.name}] — ${msg}`);';
if (!body.includes(CONSOLE_LINE)) throw new Error('departure 1: fire()’s console line not found');
body = body.replace(CONSOLE_LINE,
  '  const line = `NAV VIEW-MODE OVERFLOW [D${S.design} ${LEVELS[S.level]} ${S.lines}p ${FACE.name}] — ${msg}`;\n' +
  '  if (onViolation) onViolation(line, { design: S.design, level: S.level, lines: S.lines, msg });');

// ── departure 2: no second repaint loop ─────────────────────────────────────────────────────────
if (!body.includes('    draw();\n')) throw new Error('departure 2: lab draw() call not found in lumImage');
body = body.replace('    draw();\n', '');

// ── departure 3: zoomIdx comes from S ───────────────────────────────────────────────────────────
if (!body.includes('let zoomIdx = 0;\n')) throw new Error('departure 3: zoomIdx declaration not found');
body = body.replace('let zoomIdx = 0;\n', '');
body = body.split('ZOOM_STOPS[zoomIdx]').join('ZOOM_STOPS[S.zoomIdx | 0]');
// …and the lab's own `S` literal, which would SHADOW the injected one. ⛔ A shadowed `S` is the
// worst possible failure here: every design would paint a fixed default view, forever, silently.
const S_BLOCK = /^const S = \{\n(?:.*\n)*?^\};\n/m;
if (!S_BLOCK.test(body)) throw new Error("departure 3: the lab's `const S = {...}` block not found");
body = body.replace(S_BLOCK, '');

const HEADER = readFileSync(join(ROOT, 'src/ui/navViewModes/designs.header.js'), 'utf8');
const FOOTER = `
  return { drawDesign1, drawDesign2, LEVELS, INK, SPECTRAL, isHere, levelView, projectPrism, ZOOM_STOPS,
           regions: () => REGIONS, violations: () => _violations,
           resetViolations: () => { _violations = 0; _fired.clear(); },
           // ⛔ REGIONS MUST BE CLEARED BETWEEN FRAMES OR THE GUARD GOES SOFT. \`assertFits\` reports
           // "region X was never declared this frame" — but with a stale map it cannot tell, so a
           // design asserting against a region only the OTHER design declares would pass against
           // last frame's rectangle. The lab never hit this because it drew one design per page load.
           resetRegions: () => { REGIONS = {}; } };
}
`;

const indented = body.split('\n').map((l) => (l.trim() ? '  ' + l : l)).join('\n');
const out = HEADER + '\n' + indented + '\n' + FOOTER;

if (process.argv.includes('--check')) {
  const have = readFileSync(OUT, 'utf8');
  if (have === out) { console.log('designs.js matches nav-240p-lab.html'); process.exit(0); }
  console.error('⛔ designs.js has DRIFTED from nav-240p-lab.html — run: node scripts/extract-nav-designs.mjs');
  process.exit(1);
}
writeFileSync(OUT, out);
console.log(`wrote ${OUT} (${out.split('\n').length} lines) from nav-240p-lab.html`);
