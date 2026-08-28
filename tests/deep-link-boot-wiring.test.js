// tests/deep-link-boot-wiring.test.js
// The WIRING half of the `?system=<seed>` deep link (2026-08-28).
//
// src/main.js cannot be imported by a test — it has zero top-level exports and evaluates
// `new THREE.PerspectiveCamera(...)` (:159) and `document.getElementById('canvas')` (:189) at module
// scope. So the DECISION is unit-tested directly (src/flight/__tests__/deepLinkBoot.test.js) and this
// file proves main.js actually calls it. Neither test is sufficient alone: a green reducer that nothing
// calls is dead code, and green wiring over a broken reducer is a link that opens the wrong system.
//
// ⛔ SCANNED THROUGH stripCommentsPreservingOffsets WITH LITERAL TEXT BLANKED, never raw. A raw grep
// is satisfied by the documentation of the thing it is supposed to be checking — and the call site
// this file guards carries a long comment that names every symbol asserted below.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { stripCommentsPreservingOffsets } from './helpers/source-scan.mjs';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const readStripped = (rel) =>
  stripCommentsPreservingOffsets(readFileSync(resolve(REPO, rel), 'utf8'), { blankLiteralText: true });

const MAIN = readStripped('src/main.js');

// ⭐ A SECOND VIEW, COMMENTS STRIPPED BUT STRING LITERALS INTACT — and it exists because the first
// draft of the import assertion below FAILED against MAIN for a reason that had nothing to do with
// the wiring. `blankLiteralText: true` blanks the INTERIOR of every string, so the module specifier
// './flight/flightModes.js' reads as '                        ' and no path can ever be matched in
// that view. The blanked view stays correct for every other assertion here (a brace or a symbol
// cannot hide inside a string), so BOTH are kept, each used for what it can actually see — the same
// two-view idiom driver-pack-rockysurface.test.js records.
const MAIN_STRINGS = stripCommentsPreservingOffsets(readFileSync(resolve(REPO, 'src/main.js'), 'utf8'));

describe('deep-link boot wiring — main.js really calls the reducer', () => {
  // ⚠ THE WINDOW IS DELIBERATELY WIDE, and 400 was too narrow for a measured reason:
  // stripCommentsPreservingOffsets PRESERVES OFFSETS, so a stripped comment is not removed — it becomes
  // whitespace of the SAME LENGTH. The call site carries a ~1,100-character comment explaining the
  // deferral, so a 400-char window landed entirely inside blanked comment and matched nothing. The scan
  // was reading the right file at the right place and still saw nothing; a narrow window over an
  // offset-preserving view is its own vacuous-instrument trap.
  const WINDOW = 2600;


  it('main.js imports deepLinkBoot from the pure reducer module', () => {
    // The import list is one multi-line block; match the symbol inside a from-flightModes import.
    const block = MAIN_STRINGS.match(/import\s*\{[^}]*\}\s*from\s*['"][^'"]*flight\/flightModes\.js['"]/s);
    expect(block, 'an import from flight/flightModes.js exists').toBeTruthy();
    expect(block[0], 'deepLinkBoot is in it').toMatch(/\bdeepLinkBoot\b/);
  });

  it('it is called with location.search — the reducer is never handed something else', () => {
    // The whole point of the reducer taking a string is that main.js owns the `location` read.
    // If this ever became deepLinkBoot({ search: someOtherString }) the unit tests would still pass
    // while the live link did nothing.
    expect(MAIN).toMatch(/deepLinkBoot\(\s*\{\s*search:\s*location\.search\s*\}\s*\)/);
  });

  it('the system is spawned ONLY behind the reducer\'s open flag', () => {
    // Guard against a future edit that calls spawnProceduralSystem unconditionally at boot, which
    // would hijack every normal visit to the site into a procedural system.
    const call = MAIN.match(new RegExp('deepLinkBoot\\(\\s*\\{\\s*search:\\s*location\\.search\\s*\\}\\s*\\)[\\s\\S]{0,' + WINDOW + '}'));
    expect(call, 'the deep-link call site is present').toBeTruthy();
    expect(call[0], 'gated on .open').toMatch(/\.open\b/);
    expect(call[0], 'spawns the named system').toMatch(/spawnProceduralSystem\(/);
  });

  it('⭐⭐ THE CALL IS DEFERRED PAST MODULE INIT — the invariant that replaced a wrong one', () => {
    // ⛔ THIS ASSERTION EXISTS BECAUSE ITS PREDECESSOR WAS WRONG AND SHIPPED GREEN.
    // The first version pinned the call site's POSITION: it must appear after `let titleScreenActive`.
    // It passed, and the link still threw live on first load:
    //     Uncaught ReferenceError: Cannot access 'galleryMode' before initialization
    // spawnProceduralSystem reads module-scope `let` bindings declared as late as :10705, and `let` does
    // not hoist — so there is NO position in this 15,000-line module that is safe for a synchronous call.
    // Pinning position pinned the two identifiers someone had happened to NAME, and silently blessed
    // every other one. The real requirement was never "late enough"; it was "after module evaluation".
    // So the pin is now on the DEFERRAL, which is what actually makes it correct — and which stays
    // correct if the block ever moves.
    const call = MAIN.match(new RegExp('deepLinkBoot\\(\\s*\\{\\s*search:\\s*location\\.search\\s*\\}\\s*\\)[\\s\\S]{0,' + WINDOW + '}'));
    expect(call, 'the deep-link call site is present').toBeTruthy();
    expect(call[0], 'the spawn is deferred past module evaluation')
      .toMatch(/queueMicrotask\(|requestAnimationFrame\(|setTimeout\(/);
    // …and the spawn must be INSIDE that deferral, not merely next to one.
    const deferred = call[0].match(/(?:queueMicrotask|requestAnimationFrame|setTimeout)\([\s\S]{0,200}/);
    expect(deferred, 'a deferral wraps something').toBeTruthy();
    expect(deferred[0], 'spawnProceduralSystem is inside the deferral')
      .toMatch(/spawnProceduralSystem\(/);
  });

  it('CONTROL — the scan can see main.js at all, and is reading code not comments', () => {
    // A zero is not a measurement until something in the same read proves the instrument could have
    // found a non-zero. If stripCommentsPreservingOffsets ever returned empty, or the path moved,
    // every assertion above would pass or fail for reasons that have nothing to do with the wiring.
    expect(MAIN.length).toBeGreaterThan(100000);
    expect(MAIN).toMatch(/window\._lab\s*=/);
    expect(MAIN).toMatch(/spawnProceduralSystem\s*\(\s*seed\s*=/);
    // …and the strings-intact view is live too — it is the only one that can see a module path,
    // so a blanked/empty MAIN_STRINGS would make the import assertion pass or fail for the wrong reason.
    expect(MAIN_STRINGS.length).toBeGreaterThan(100000);
    expect(MAIN_STRINGS).toMatch(/from\s*['"]\.\/flight\/flightModes\.js['"]/);
  });
});
