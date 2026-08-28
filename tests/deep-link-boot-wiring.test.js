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
    const call = MAIN.match(/deepLinkBoot\(\s*\{\s*search:\s*location\.search\s*\}\s*\)[\s\S]{0,400}/);
    expect(call, 'the deep-link call site is present').toBeTruthy();
    expect(call[0], 'gated on .open').toMatch(/\.open\b/);
    expect(call[0], 'spawns the named system').toMatch(/spawnProceduralSystem\(/);
  });

  it('⭐⭐ THE CALL SITE IS AFTER titleScreenActive IS DECLARED — the constraint that is not obvious', () => {
    // spawnProceduralSystem reads `splashActive` (let, ~:5177) and `titleScreenActive` (let, ~:5335).
    // Both are in the TEMPORAL DEAD ZONE until those lines execute, so a deep-link dispatch placed
    // anywhere earlier in this 15,000-line module throws a ReferenceError at boot — and it throws on
    // the ONE path a normal visit never takes, so nobody would see it until Max tapped a link.
    // ⛔ This is the assertion that earns this file's existence: nothing else in the suite can catch
    // a well-meaning refactor that hoists the block "up with the other URL params" (main.js:2157 and
    // :4384 both read URL params, and both are ABOVE the dead line).
    const decl = MAIN.search(/\blet\s+titleScreenActive\b/);
    const call = MAIN.search(/deepLinkBoot\(\s*\{\s*search:\s*location\.search\s*\}\s*\)/);
    expect(decl, 'titleScreenActive declaration found').toBeGreaterThan(-1);
    expect(call, 'deep-link call site found').toBeGreaterThan(-1);
    expect(call, 'the deep-link dispatch runs AFTER titleScreenActive is initialised')
      .toBeGreaterThan(decl);
    // …and after splashActive too, which is declared earlier still — asserted rather than inferred.
    const splash = MAIN.search(/\blet\s+splashActive\b/);
    expect(splash, 'splashActive declaration found').toBeGreaterThan(-1);
    expect(call).toBeGreaterThan(splash);
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
