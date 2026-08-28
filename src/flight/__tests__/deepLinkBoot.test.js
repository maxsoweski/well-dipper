// src/flight/__tests__/deepLinkBoot.test.js
// `?system=<seed>` deep-link boot — the PURE decision half (2026-08-28).
//
// Max, travelling and steering from his phone: "is there some way for us to work out some functions
// such that you could give me a URL that I could access remotely that would open the game and load in
// automatically to a specific system?"
//
// src/main.js cannot be imported by a test — zero top-level exports, and it evaluates
// `new THREE.PerspectiveCamera(...)` (:159) and `document.getElementById('canvas')` (:189) at module
// scope. So the decision lives in flightModes.js (33 exports, imports nothing) and is tested directly
// here; that main.js actually CALLS it is a separate source-scan fence, tests/deep-link-boot-wiring.test.js.
// Two tests, because one of them alone is a half-measure: a green reducer that nothing calls is dead
// code, and a green wiring scan over a broken reducer is a link that opens the wrong system.
import { describe, it, expect } from 'vitest';
import { deepLinkBoot, DEEP_LINK_SYSTEM_MAX, DEEP_LINK_SYSTEM_RE } from '../flightModes.js';

const INERT = { open: false, system: null };

describe('deepLinkBoot — ?system=<seed> opens the game on that system (pure)', () => {
  it('a real seed opens it', () => {
    // The three seed shapes this repo actually generates with.
    expect(deepLinkBoot({ search: '?system=rocky-0' })).toEqual({ open: true, system: 'rocky-0' });
    expect(deepLinkBoot({ search: '?system=lab-procedural-1' })).toEqual({ open: true, system: 'lab-procedural-1' });
    expect(deepLinkBoot({ search: '?system=wd-12' })).toEqual({ open: true, system: 'wd-12' });
  });

  it('survives the other params it will really be seen next to', () => {
    // The occupied namespace, measured 2026-08-28. `system` must not be confused with any of them,
    // and must still be found when it is not the first param.
    expect(deepLinkBoot({ search: '?debug&system=rocky-3' })).toEqual({ open: true, system: 'rocky-3' });
    expect(deepLinkBoot({ search: '?system=rocky-3&warpDebug' })).toEqual({ open: true, system: 'rocky-3' });
    expect(deepLinkBoot({ search: '?lab&portalLab&system=wd-7&debug' })).toEqual({ open: true, system: 'wd-7' });
  });

  it('⭐ `seed` is NOT the deep-link param and must never be treated as one', () => {
    // src/core/SimRandom.js:37 already reads ?seed= and coerces it to a uint32 for the SIM RNG.
    // If this reducer ever answered to `seed`, a determinism param would silently become a
    // navigation param — the bug this test exists to keep out.
    expect(deepLinkBoot({ search: '?seed=rocky-0' })).toEqual(INERT);
    expect(deepLinkBoot({ search: '?seed=12345' })).toEqual(INERT);
    // …and when BOTH are present, only `system` decides where we land.
    expect(deepLinkBoot({ search: '?seed=999&system=rocky-0' })).toEqual({ open: true, system: 'rocky-0' });
  });

  it('absent / empty / whitespace-only → boots normally, never throws', () => {
    for (const search of ['', '?', '?debug', '?system=', '?system=%20%20', '?system=+']) {
      expect(() => deepLinkBoot({ search }), JSON.stringify(search)).not.toThrow();
      expect(deepLinkBoot({ search }), JSON.stringify(search)).toEqual(INERT);
    }
  });

  it('a missing args object, or a non-string search, never throws', () => {
    // Same robustness contract as bootSkipDecision above it in flightModes.js.
    expect(() => deepLinkBoot()).not.toThrow();
    expect(deepLinkBoot()).toEqual(INERT);
    for (const bad of [undefined, null, 0, 42, {}, [], true, () => {}]) {
      expect(() => deepLinkBoot({ search: bad })).not.toThrow();
      expect(deepLinkBoot({ search: bad })).toEqual(INERT);
    }
  });

  it('⛔ REFUSES anything outside the seed grammar — it does not sanitise it into something', () => {
    // The value is handed to StarSystemGenerator.generate() straight off a URL anyone can send Max.
    // Every one of these must come back inert, NOT stripped-and-accepted: a reducer that quietly
    // repaired `<script>` into `script` would open a system he did not ask for and call it success.
    const hostile = [
      '?system=<script>', '?system=../../etc/passwd', "?system=a'b", '?system=a b',
      '?system=a%2Fb', '?system=a/b', '?system=a\\b', '?system=a;b', '?system=a|b',
      '?system=a%26b', '?system=💥', '?system=a%00b', '?system=%3Cimg%20src%3Dx%3E',
    ];
    for (const search of hostile) {
      expect(deepLinkBoot({ search }), search).toEqual(INERT);
    }
  });

  it('a bare `&` is the PARAMETER SEPARATOR, not a hostile character — and that distinction was MEASURED', () => {
    // ⛔ THE FIRST DRAFT OF THE LIST ABOVE ASSERTED THAT '?system=a&b' MUST BE REFUSED, and running it
    // is what showed that wrong. '&' can never appear inside a value un-encoded, because it ENDS the
    // value: '?system=a&b' is an ordinary URL meaning system='a' plus a separate flag 'b', and refusing
    // it would break every deep link that carries a second parameter. The hostile form is the ENCODED
    // one, '?system=a%26b', which decodes to a literal 'a&b' — and that IS refused, in the list above.
    // Both halves are kept here so the distinction is never re-litigated as a bug report.
    expect(deepLinkBoot({ search: '?system=a&b' })).toEqual({ open: true, system: 'a' });
    expect(deepLinkBoot({ search: '?system=a%26b' })).toEqual(INERT);
  });

  it('⛔ is BOUNDED — a very long seed is refused, at the reducer\'s own limit', () => {
    // Asserted against the EXPORTED constant, never a transcribed number: a copied limit is a second
    // source of truth that drifts silently the moment the real one moves.
    const ok = 'a'.repeat(DEEP_LINK_SYSTEM_MAX);
    const tooLong = 'a'.repeat(DEEP_LINK_SYSTEM_MAX + 1);
    expect(deepLinkBoot({ search: `?system=${ok}` })).toEqual({ open: true, system: ok });
    expect(deepLinkBoot({ search: `?system=${tooLong}` })).toEqual(INERT);
  });

  it('CONTROL — the grammar it exports is the grammar it applies', () => {
    // Guards against the failure where the regex is exported for documentation and the function
    // quietly tests something else: every accepted value must satisfy the exported pattern, and a
    // value that satisfies it must be accepted.
    expect(DEEP_LINK_SYSTEM_RE.test('rocky-0')).toBe(true);
    expect(DEEP_LINK_SYSTEM_RE.test('a b')).toBe(false);
    const r = deepLinkBoot({ search: '?system=Sol_2.b:9-x' });
    expect(r.open).toBe(true);
    expect(DEEP_LINK_SYSTEM_RE.test(r.system)).toBe(true);
  });

  it('trims surrounding whitespace rather than refusing a hand-typed link', () => {
    expect(deepLinkBoot({ search: '?system=%20rocky-0%20' })).toEqual({ open: true, system: 'rocky-0' });
  });
});
