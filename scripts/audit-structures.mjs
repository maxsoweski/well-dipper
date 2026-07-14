#!/usr/bin/env node
/**
 * audit-structures.mjs — AC6 structures audit (real-universe-overlay-2026-07-12,
 * design D6).
 *
 * Compares the shipped deep-sky objects against committed reference values and
 * writes a Markdown report:
 *   (a) the 37 KnownObjectProfiles — recompute galactocentric position from the
 *       published (l,b,d) in structures-reference.json and compare to the stored
 *       galacticPos (catches a mis-derived position); compare stored radius to a
 *       published physical radius (factor-2 tolerance, sizes are fuzzy).
 *   (b) the 152 Harris globular clusters — position self-consistency ((l,b,rSun)
 *       vs the shipped X/Y/Z-derived xyz) and the D5 tidal-radius derivation
 *       (spot-check, non-uniformity, physical range).
 *
 * Every out-of-tolerance entry is either corrected in KnownObjectProfiles.js
 * (and re-passes here) or listed with a rationale in the report.
 *
 * Run: node scripts/audit-structures.mjs
 * Output: docs/WORKSTREAMS/real-universe-overlay-2026-07-12/structures-audit.md
 */

import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { KNOWN_OBJECT_PROFILES } from '../src/data/KnownObjectProfiles.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const WS = join(HERE, '../docs/WORKSTREAMS/real-universe-overlay-2026-07-12');
const REF = JSON.parse(readFileSync(join(WS, 'structures-reference.json'), 'utf8'));
const GLOBULARS = JSON.parse(readFileSync(join(HERE, '../public/assets/data/globular-clusters.json'), 'utf8'));

const DEG = Math.PI / 180;
const T = REF._meta.tolerances;

// Published (l,b,d) -> game galactocentric position (Sun at 8.0, 0.025, 0).
function galacticToGame(l, b, d) {
  const cb = Math.cos(b * DEG), sb = Math.sin(b * DEG);
  const cl = Math.cos(l * DEG), sl = Math.sin(l * DEG);
  const xTowardGC = d * cb * cl;
  const yRot = d * cb * sl;
  const zNGP = d * sb;
  return { x: 8.0 - xTowardGC, y: 0.025 + zNGP, z: yRot };
}

const dist3 = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
const fx = (n, p = 3) => (n == null ? '—' : n.toFixed(p));

// ── (a) profile position + size audit ────────────────────────────────────────
const profileRows = [];
for (const [key, ref] of Object.entries(REF.profiles)) {
  const p = KNOWN_OBJECT_PROFILES[key];
  if (!p) { profileRows.push({ key, missing: true }); continue; }
  const recomputed = galacticToGame(ref.l, ref.b, ref.d);
  const posErr = dist3(recomputed, p.galacticPos);
  const posTol = Math.max(T.profilePosKpc, T.profilePosFracOfDistance * ref.d);
  const posPass = posErr <= posTol;

  const storedPc = p.radius * 1000;
  const sizeRatio = storedPc / ref.radiusPc;
  const sizePass = sizeRatio >= 1 / T.profileSizeFactor && sizeRatio <= T.profileSizeFactor;

  profileRows.push({
    key, name: p.name, type: p.type, d: ref.d,
    posErr, posTol, posPass, storedPc, refPc: ref.radiusPc, sizeRatio, sizePass, source: ref.source,
  });
}
const profileFails = profileRows.filter(r => !r.missing && (!r.posPass || !r.sizePass));
const profileMissing = profileRows.filter(r => r.missing);

// ── (b) globular position + radius audit ─────────────────────────────────────
const gcById = new Map(GLOBULARS.map(g => [g.id, g]));
const gcPosRows = [];
for (const g of GLOBULARS) {
  const recomputed = galacticToGame(g.l, g.b, g.rSun);
  const posErr = dist3(recomputed, { x: g.x, y: g.y, z: g.z });
  const posTol = Math.max(T.globularPosKpc, T.globularPosFracOfDistance * g.rSun);
  gcPosRows.push({ id: g.id, name: g.name, rSun: g.rSun, posErr, posTol, pass: posErr <= posTol });
}
const gcPosFails = gcPosRows.filter(r => !r.pass);

const radiiPc = GLOBULARS.map(g => g.radiusKpc * 1000);
const distinctRadii = new Set(GLOBULARS.map(g => g.radiusKpc)).size;
const range = REF.globulars.physicalRangePc;
const outOfRange = GLOBULARS.filter(g => {
  if (g.radiusMethod === 'placeholder') return false; // the 30 pc default is intentional
  const pc = g.radiusKpc * 1000;
  return pc < range.min || pc > range.max;
});
const placeholders = GLOBULARS.filter(g => g.radiusMethod === 'placeholder');

const spotRows = [];
for (const [id, refPc] of Object.entries(REF.globulars.spotRadiiPc)) {
  const g = gcById.get(id);
  const gotPc = g ? g.radiusKpc * 1000 : null;
  const pass = g != null && Math.abs(gotPc - refPc) <= REF.globulars.spotRadiiTolerancePc;
  spotRows.push({ id, refPc, gotPc, pass });
}
const [oA, oB, oC] = REF.globulars.orderingCheck.map(id => gcById.get(id));
const orderingPass = oA && oB && oC && oA.radiusKpc > oB.radiusKpc && oB.radiusKpc > oC.radiusKpc;

const countPass = GLOBULARS.length === REF.globulars.expectedCount;

// ── Corrections applied this audit (documented, not auto-detected) ────────────
const CORRECTIONS = [
  {
    key: 'M13',
    what: 'galacticPos',
    from: '(4.37, 4.54, 3.34)',
    to: '(5.23, 4.67, 4.60)',
    why: 'Stored position was 1.53 kpc from the value its own published l=59.0 b=40.9 d=7.1 imply — 44% past the 15%-of-distance tolerance, and disagreeing with the real Hercules-Cluster position. Re-derived from (l,b,d), same fix pattern as the earlier IC434/M78 position correction.',
  },
  {
    key: 'M57',
    what: 'galacticPos',
    from: '(7.54, 0.19, 0.45)',
    to: '(7.69, 0.19, 0.61)',
    why: 'Stored position was 0.22 kpc (31% of the 0.7 kpc distance) from its published l=63.2 b=13.5 d=0.7 — past the 15% tolerance. Re-derived from (l,b,d).',
  },
  {
    key: 'M45',
    what: 'galacticPos.z',
    from: '-0.06',
    to: '0.03',
    why: 'Stored z had the wrong sign vs its published l=166.6 b=-23.5 d=0.136 (recomputed z = +0.029), a 0.089 kpc error past the 0.05 kpc floor. Re-derived from (l,b,d); x and y were already correct.',
  },
];

// ── Emit the report ───────────────────────────────────────────────────────────
const now = 'generated by scripts/audit-structures.mjs';
let md = '';
md += '# Structures audit — AC6 (real-universe-overlay-2026-07-12)\n\n';
md += `> ${now}. Reference: \`structures-reference.json\`. Subjects: the 37 `;
md += '`KnownObjectProfiles` deep-sky objects and the 152 Harris (2010) globular clusters.\n\n';
md += 'Position tolerance (profiles): within '
  + `${T.profilePosKpc} kpc OR ${T.profilePosFracOfDistance * 100}% of distance (positions were hand-derived from l/b/d). `;
md += `Size tolerance: within a factor of ${T.profileSizeFactor} (nebular/cluster size is genuinely fuzzy). `;
md += `Globular position tolerance: within ${T.globularPosKpc} kpc OR ${T.globularPosFracOfDistance * 100}% of distance `;
md += '(absorbs the catalog\'s 1-decimal X/Y/Z rounding).\n\n';

md += '## Result\n\n';
md += `- Profiles: **${profileRows.length - profileMissing.length}/${Object.keys(REF.profiles).length}** audited; `;
md += `**${profileRows.filter(r => !r.missing).length - profileFails.length} within tolerance**, ${profileFails.length} out (after corrections below).\n`;
md += `- Globular positions: **${gcPosRows.length - gcPosFails.length}/${gcPosRows.length}** self-consistent.\n`;
md += `- Globular radii: ${distinctRadii} distinct values across ${GLOBULARS.length} clusters `;
md += `(range ${Math.min(...radiiPc).toFixed(1)}–${Math.max(...radiiPc).toFixed(1)} pc; was a uniform 30 pc); `;
md += `spot-checks ${spotRows.filter(s => s.pass).length}/${spotRows.length}; ordering ${orderingPass ? 'OK' : 'FAIL'}; count ${countPass ? 'OK' : 'FAIL'}.\n\n`;

md += '## Corrections applied to KnownObjectProfiles.js\n\n';
for (const c of CORRECTIONS) {
  md += `- **${c.key}.${c.what}**: \`${c.from}\` → \`${c.to}\`. ${c.why}\n`;
}
md += '\n';

md += '## Profile position + size (all 37)\n\n';
md += '| key | name | type | d (kpc) | pos err (kpc) | pos tol | pos | size (stored/ref pc) | size |\n';
md += '|---|---|---|---|---|---|---|---|---|\n';
for (const r of profileRows.filter(r => !r.missing).sort((a, b) => b.posErr - a.posErr)) {
  md += `| ${r.key} | ${r.name} | ${r.type} | ${fx(r.d, 2)} | ${fx(r.posErr, 4)} | ${fx(r.posTol, 3)} | `;
  md += `${r.posPass ? 'PASS' : '**FAIL**'} | ${fx(r.storedPc, 2)} / ${fx(r.refPc, 2)} (×${fx(r.sizeRatio, 2)}) | `;
  md += `${r.sizePass ? 'PASS' : '**FAIL**'} |\n`;
}
md += '\n';
if (profileMissing.length) {
  md += `Reference rows with no matching profile: ${profileMissing.map(r => r.key).join(', ')}.\n\n`;
}

md += '## Out-of-tolerance profiles (post-correction) and rationale\n\n';
if (profileFails.length === 0) {
  md += 'None. All 37 profiles are within the documented position and size tolerance after the corrections above.\n\n';
} else {
  for (const r of profileFails) {
    md += `- **${r.key} (${r.name})**: `;
    if (!r.posPass) md += `position off by ${fx(r.posErr, 4)} kpc (tol ${fx(r.posTol, 3)}). `;
    if (!r.sizePass) md += `size ×${fx(r.sizeRatio, 2)} of reference (tol ½–2×). `;
    md += 'RATIONALE: (needs review).\n';
  }
  md += '\n';
}

md += '## Notable within-tolerance residuals\n\n';
const notable = profileRows.filter(r => !r.missing && r.posPass && r.posErr > T.profilePosKpc)
  .sort((a, b) => b.posErr - a.posErr);
if (notable.length === 0) {
  md += 'None beyond the flat 0.05 kpc floor.\n\n';
} else {
  for (const r of notable) {
    md += `- **${r.key} (${r.name})**: ${fx(r.posErr, 4)} kpc (passes on the ${(T.profilePosFracOfDistance * 100)}%-of-distance branch, tol ${fx(r.posTol, 3)}).\n`;
  }
  md += '\n';
}

md += '## Globular clusters\n\n';
md += `- **Radii** now per-cluster from Harris Part III (tidal radius r_t = r_c·10^c, converted at rSun). `;
md += `${GLOBULARS.length - placeholders.length}/${GLOBULARS.length} clusters have real structural radii; `;
md += `${placeholders.length} keep the 30 pc placeholder (no Part III structural params): `;
md += `${placeholders.map(g => g.name).join(', ') || 'none'}.\n`;
md += `- **Non-uniformity**: ${distinctRadii} distinct radii; largest and smallest —\n`;
const bySize = [...GLOBULARS].filter(g => g.radiusMethod !== 'placeholder').sort((a, b) => b.radiusKpc - a.radiusKpc);
for (const g of bySize.slice(0, 5)) md += `    - ${g.name} (${g.id}): ${(g.radiusKpc * 1000).toFixed(1)} pc, rSun ${g.rSun} kpc, c ${g.concentration}\n`;
md += '    - …\n';
for (const g of bySize.slice(-3)) md += `    - ${g.name} (${g.id}): ${(g.radiusKpc * 1000).toFixed(1)} pc\n`;
md += `- **Spot-checks** (hand-computed tidal radius, ±${REF.globulars.spotRadiiTolerancePc} pc):\n`;
for (const s of spotRows) md += `    - ${s.id}: got ${fx(s.gotPc, 2)} pc vs ref ${s.refPc} pc — ${s.pass ? 'PASS' : '**FAIL**'}\n`;
md += `- **Ordering** (Omega Cen > 47 Tuc > Pal 1): ${orderingPass ? 'PASS' : '**FAIL**'}.\n`;
md += `- **Count**: ${GLOBULARS.length} (expected ${REF.globulars.expectedCount}) — ${countPass ? 'PASS' : '**FAIL**'}.\n`;
if (outOfRange.length) {
  md += `- **Outside the ${range.min}–${range.max} pc plausibility band** (documented, not failed — these are genuine): `;
  md += outOfRange.map(g => `${g.name} ${(g.radiusKpc * 1000).toFixed(0)} pc`).join(', ') + '.\n';
} else {
  md += `- All real radii sit inside the ${range.min}–${range.max} pc plausibility band.\n`;
}
md += '\n';

md += '## Position self-consistency — globular worst offenders\n\n';
md += '| id | name | rSun (kpc) | pos err (kpc) | tol | verdict |\n|---|---|---|---|---|---|\n';
for (const r of [...gcPosRows].sort((a, b) => b.posErr - a.posErr).slice(0, 8)) {
  md += `| ${r.id} | ${r.name} | ${fx(r.rSun, 1)} | ${fx(r.posErr, 4)} | ${fx(r.posTol, 3)} | ${r.pass ? 'PASS' : '**FAIL**'} |\n`;
}
if (gcPosFails.length) {
  md += `\n${gcPosFails.length} globular(s) out of position tolerance: `;
  md += gcPosFails.map(r => `${r.id} (${fx(r.posErr, 3)} kpc)`).join(', ') + '.\n';
} else {
  md += '\nAll 152 globular positions are self-consistent between their (l,b,rSun) and shipped X/Y/Z.\n';
}
md += '\n';

writeFileSync(join(WS, 'structures-audit.md'), md);

// Console summary + non-zero exit if a real (post-correction) failure remains.
const hardFail = profileFails.length > 0 || gcPosFails.length > 0 || !orderingPass
  || !countPass || spotRows.some(s => !s.pass) || outOfRange.length > 0;
console.log(`Profiles: ${profileRows.filter(r => !r.missing).length - profileFails.length} pass, ${profileFails.length} fail`);
console.log(`Globular positions: ${gcPosRows.length - gcPosFails.length}/${gcPosRows.length} self-consistent`);
console.log(`Globular radii: ${distinctRadii} distinct, range ${Math.min(...radiiPc).toFixed(1)}-${Math.max(...radiiPc).toFixed(1)} pc, ordering ${orderingPass ? 'OK' : 'FAIL'}`);
console.log(`Report: docs/WORKSTREAMS/real-universe-overlay-2026-07-12/structures-audit.md`);
if (hardFail) { console.error('AUDIT: unresolved out-of-tolerance entries (see report).'); process.exit(1); }
console.log('AUDIT: all subjects within documented tolerance.');
