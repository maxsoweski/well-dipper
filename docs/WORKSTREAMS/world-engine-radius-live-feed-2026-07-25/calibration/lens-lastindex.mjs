// Verify the [note]: DENY is a module-level /g regex shared between .test() and String.matchAll,
// and matchAll seeds its internal matcher from the source regex's lastIndex.
import { readFileSync } from 'node:fs';
const LAB = readFileSync(new URL('../../../../planet-lod-lab.html', import.meta.url), 'utf8');
const DENY = /(?:\b_fp\b|DRIVER_PRESETS\s*\[[^\]]*\])\s*\??\.\s*radiusEarth/g;

function scan(src) { return [...src.matchAll(DENY)].map((m) => m.index); }

console.log('lastIndex at start:', DENY.lastIndex);
console.log('full scan hits:', scan(LAB).length, 'first index', scan(LAB)[0]);

// Reproduce what the allowlist-staleness test at fence.test.js:113-118 does.
const ALLOW_MATCH = 'craterRelevanceOf(deriveConditionVector(';
const hits = LAB.split('\n').filter((l) => l.includes(ALLOW_MATCH));
for (const l of hits) { DENY.lastIndex = 0; DENY.test(l); }
console.log('lastIndex after the staleness test:', DENY.lastIndex);
const after = scan(LAB);
console.log('scan hits AFTER that test:', after.length, 'first index', after[0]);
console.log('=> matchAll starts at byte offset', DENY.lastIndex, '— it does NOT rescan from 0:',
            after.length !== scan(LAB).length ? 'DIFFERENT' : 'same-length');

// Demonstrate the consequence concretely: a frozen read planted NEAR THE TOP of the file is missed.
DENY.lastIndex = 0;
for (const l of hits) { DENY.lastIndex = 0; DENY.test(l); }
const li = DENY.lastIndex;
const planted = '\n// _fp.radiusEarth\n' + LAB;   // an offender at offset ~4
DENY.lastIndex = li;
const missed = [...planted.matchAll(DENY)].map((m) => m.index);
DENY.lastIndex = 0;
const seen = [...planted.matchAll(DENY)].map((m) => m.index);
console.log(`\nplanted offender at offset 4:`);
console.log(`  with lastIndex = ${li} (the polluted state): first hit at ${missed[0]}  -> ${missed.includes(4) ? 'CAUGHT' : 'MISSED'}`);
console.log(`  with lastIndex = 0   (clean):                first hit at ${seen[0]}    -> ${seen.includes(4) ? 'CAUGHT' : 'MISSED'}`);
