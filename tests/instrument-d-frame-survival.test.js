// tests/instrument-d-frame-survival.test.js — the gate on INSTRUMENT D (PLAN §4 Step 6 gate,
// §12.3 cost row 14).
//
// ── WHAT INSTRUMENT D IS, AND THE PART A HEADLESS TEST CAN REACH ─────────────────────────────────
// D runs the live loop for ≥120 frames and reports whether it survived. Collecting that evidence
// needs a browser; DECIDING on it does not. The decision is where this instrument can be wrong in
// the way that matters — a verdict function that reports a dead render loop healthy is a green gate
// pointed at nothing, PLAN §11.1's class D arriving through the front door. So `frameSurvivalVerdict`
// is a pure function fenced by sentinel comments in `src/main.js`, and this file SLICES IT OUT OF
// THE SHIPPED FILE and evaluates it. Not a copy: a copy is a second expression of the law, which is
// the defect §2 of the PLAN records happening four separate times.
//
// ⛔ `window.__wd.runIntegrationSuite()` IS NOT INSTRUMENT D. It is the Sol-scoped scene inspector:
// its entry point throws unless Sol has been entered, its checks name `body.planet.earth`, and it
// installs no error handler at all. A fence below asserts it appears nowhere in D's hook.
//
// ── THE CONTROL DISCIPLINE (PLAN §11.3.1 and §11.3.3) ───────────────────────────────────────────
// Every clause of the verdict gets two things: an input on which it FAILS, and a MUTANT of the
// shipped source with that clause deleted, shown to PASS the same input. The first proves the clause
// is reachable; the second proves it is load-bearing. A clause with only the first is a clause that
// could be deleted with the suite still green.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { stripCommentsPreservingOffsets } from './helpers/source-scan.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const MAIN = readFileSync(join(ROOT, 'src/main.js'), 'utf8');
const BINDING = readFileSync(join(ROOT, 'vendor/motion-test-kit/adapters/three/three-loop-binding.js'), 'utf8');

const BEGIN = '// D-VERDICT-' + 'BEGIN';
const END = '// D-VERDICT-' + 'END';

/** Slice the shipped verdict function out of src/main.js. */
function extractVerdictSource(source = MAIN) {
  const a = source.indexOf(BEGIN);
  const b = source.indexOf(END);
  if (a < 0 || b < 0 || b < a) throw new Error('D verdict sentinels missing or out of order in src/main.js');
  return source.slice(a + BEGIN.length, b);
}

/** Compile a verdict function from source text. The mutants go through this same door. */
function compileVerdict(src) {
  // eslint-disable-next-line no-new-func
  return new Function(`${src}\nreturn frameSurvivalVerdict;`)();
}

const verdict = compileVerdict(extractVerdictSource());

/** A run that survived: 120 clean frames, the loop scheduling, the renderer drawing. */
const HEALTHY = Object.freeze({
  framesRequired: 120, framesAsked: 120, framesObserved: 120, timedOut: false,
  elapsedMs: 2000, fps: 60, throttled: false, documentHidden: false,
  rafIdsIssued: 244, probeRafRegistrations: 122,
  rendererFrameStart: 5000, rendererFrameEnd: 5120,
  errorCount: 0, rejectionCount: 0, onerrorClobbered: false,
});
const obs = (over) => ({ ...HEALTHY, ...over });

// ═════════════════════════════════════════════════════════════════════════════════════════════════
// 0. THE EXTRACTION ITSELF — if this rots, every assertion below is testing a ghost.
// ═════════════════════════════════════════════════════════════════════════════════════════════════
describe('the extraction', () => {
  it('finds exactly one sentinel pair in src/main.js', () => {
    expect(MAIN.split(BEGIN).length - 1).toBe(1);
    expect(MAIN.split(END).length - 1).toBe(1);
    expect(MAIN.indexOf(BEGIN)).toBeLessThan(MAIN.indexOf(END));
  });

  it('⛔ the fenced text is PURE — it closes over nothing the extraction cannot supply', () => {
    // The extraction evaluates it with nothing else in scope, so a reference to `window`,
    // `retroRenderer` or `this` would throw at call time HERE — but NOT in the browser, where those
    // are in scope in main.js. A live D would keep working while this test's copy broke, and the
    // failure would read as "the test harness is fragile" rather than "the law moved".
    // ⚠ A RAW SUBSTRING SCAN CANNOT EXPRESS THIS, and the first version of this test was wrong in
    // exactly the way this program keeps being wrong: it read the clauses' OWN PROSE and their own
    // failure strings as dependencies. `'window.onerror was reassigned'` is a message; `documentHidden`
    // is a property of `obs`. Comments and string bodies are blanked, and the identifier must be
    // FREE — not preceded by a dot and not part of a longer word.
    const src = stripCommentsPreservingOffsets(extractVerdictSource(), { blankLiteralText: true });
    for (const forbidden of ['window', 'document', 'retroRenderer', 'performance', 'requestAnimationFrame', 'THREE']) {
      expect(src).not.toMatch(new RegExp(`(?<![.\\w$])${forbidden}\\b`));
    }
    expect(src).not.toContain('this');
    // ⭐ The control, so the scan is not a no-op that happens to pass: the SAME regex over a
    // one-line mutant that adds a genuine free reference must hit.
    expect(`${src}\nconst x = window.foo;`).toMatch(/(?<![.\w$])window\b/);
    expect(typeof verdict).toBe('function');
  });

  it('the fenced text declares exactly the function this file compiles', () => {
    expect(extractVerdictSource()).toContain('function frameSurvivalVerdict(obs)');
  });
});

// ═════════════════════════════════════════════════════════════════════════════════════════════════
// 1. THE VERDICT'S CLAUSES. One failing input each, then one mutant each.
// ═════════════════════════════════════════════════════════════════════════════════════════════════
describe('frameSurvivalVerdict', () => {
  it('passes a run that actually survived', () => {
    const v = verdict(obs());
    expect(v.verdict).toBe('PASS');
    expect(v.pass).toBe(true);
    expect(v.failures).toEqual([]);
    expect(v.otherRafRegistrations).toBe(122);
    expect(v.renderFramesAdvanced).toBe(120);
    expect(v.renderCoverage).toBe(1);
  });

  it('fails on an uncaught exception', () => {
    const v = verdict(obs({ errorCount: 1 }));
    expect(v.verdict).toBe('FAIL');
    expect(v.failures.join(' ')).toMatch(/uncaught exception/);
  });

  it('fails on an unhandled rejection — a JS throw inside a promise is still a crash', () => {
    expect(verdict(obs({ rejectionCount: 2 })).verdict).toBe('FAIL');
  });

  it('fails when window.onerror was reassigned mid-run', () => {
    // ⛔ Not pedantry. The error channel was off for an unknown part of the run, so `errorCount: 0`
    // is unsupported rather than reassuring — and "unsupported" must not print as PASS.
    const v = verdict(obs({ onerrorClobbered: true }));
    expect(v.verdict).toBe('FAIL');
    expect(v.failures.join(' ')).toMatch(/reassigned mid-run/);
  });

  it('fails when fewer frames ran than were required', () => {
    expect(verdict(obs({ framesObserved: 119 })).verdict).toBe('FAIL');
    expect(verdict(obs({ timedOut: true, framesObserved: 40 })).verdict).toBe('FAIL');
  });

  it('⛔ fails when the required count is below the plan\'s 120 floor', () => {
    // The cheapest way to write past this gate is to ask it for fewer frames. The hook floors the
    // request AND the verdict refuses a floor below 120, so the bypass has to defeat two places.
    const v = verdict(obs({ framesRequired: 10, framesObserved: 10 }));
    expect(v.verdict).toBe('FAIL');
    expect(v.failures.join(' ')).toMatch(/below the 120-frame floor/);
  });

  it('⭐ fails when the rAF handle advanced ONLY for the probe — the dead-loop case', () => {
    // The probe's own chain ticks 120 clean frames on a corpse. This is the clause that separates
    // "the loop survived" from "my probe survived", and it is the whole reason the plan says
    // "assert the rAF handle advanced".
    const v = verdict(obs({ rafIdsIssued: 122, probeRafRegistrations: 122, rendererFrameEnd: 5000 }));
    expect(v.verdict).toBe('FAIL');
    expect(v.failures.join(' ')).toMatch(/rAF handle advanced ONLY for this probe/);
  });

  it('fails an incoherent handle counter rather than reading it as liveness', () => {
    const v = verdict(obs({ rafIdsIssued: 3, probeRafRegistrations: 122 }));
    expect(v.failures.join(' ')).toMatch(/incoherent/);
    expect(v.failures.join(' ')).not.toMatch(/ONLY for this probe/);
  });

  it('fails when the renderer never drew, and when the counter is unreadable', () => {
    expect(verdict(obs({ rendererFrameEnd: 5000 })).failures.join(' ')).toMatch(/did not advance/);
    expect(verdict(obs({ rendererFrameStart: null, rendererFrameEnd: null })).failures.join(' '))
      .toMatch(/unreadable/);
  });

  it('reports a throttled or hidden run INCONCLUSIVE — neither a pass nor a failure', () => {
    // A backgrounded window throttles rAF to ~1 Hz while `document.hidden` can read false, and every
    // per-frame verdict then means nothing. Calling that a FAIL would train a reader to re-run until
    // green; calling it a PASS is the lie.
    const t = verdict(obs({ throttled: true, fps: 1 }));
    expect(t.verdict).toBe('INCONCLUSIVE');
    expect(t.pass).toBe(false);
    expect(t.failures).toEqual([]);
    expect(verdict(obs({ documentHidden: true })).verdict).toBe('INCONCLUSIVE');
    // …and a real failure still outranks it, so a throttled crash is not laundered into "unknown".
    expect(verdict(obs({ throttled: true, errorCount: 1 })).verdict).toBe('FAIL');
  });
});

// ═════════════════════════════════════════════════════════════════════════════════════════════════
// 2. ⭐ THE MUTANTS. Each deletes ONE clause from the SHIPPED SOURCE and shows the input that used
//    to fail now passes. This is what makes each clause load-bearing rather than decorative.
// ═════════════════════════════════════════════════════════════════════════════════════════════════
describe('committed failing controls — each clause, deleted, lets a bad run through', () => {
  const src = extractVerdictSource();
  const mutate = (find, replace) => {
    expect(src).toContain(find);                       // the mutation must actually apply
    return compileVerdict(src.replace(find, replace));
  };

  it('delete the exception clause ⇒ a crashing run reports PASS', () => {
    const m = mutate('if (obs.errorCount > 0)', 'if (false)');
    expect(verdict(obs({ errorCount: 1 })).verdict).toBe('FAIL');
    expect(m(obs({ errorCount: 1 })).verdict).toBe('PASS');
  });

  it('delete the rejection clause ⇒ an unhandled rejection reports PASS', () => {
    const m = mutate('if (obs.rejectionCount > 0)', 'if (false)');
    expect(m(obs({ rejectionCount: 3 })).verdict).toBe('PASS');
  });

  it('⭐ delete the rAF liveness clause ⇒ a DEAD RENDER LOOP reports PASS', () => {
    // The headline control. 120 clean frames, zero exceptions, and the game frozen solid.
    const dead = obs({ rafIdsIssued: 122, probeRafRegistrations: 122, rendererFrameEnd: 5120 });
    expect(verdict(dead).verdict).toBe('FAIL');
    const m = mutate('} else if (otherRaf <= 0) {', '} else if (false) {');
    expect(m(dead).verdict).toBe('PASS');
  });

  it('delete the draw clause ⇒ a loop that schedules but never draws reports PASS', () => {
    const stalled = obs({ rendererFrameEnd: 5000 });
    expect(verdict(stalled).verdict).toBe('FAIL');
    const m = mutate('else if (renderFramesAdvanced <= 0)', 'else if (false)');
    expect(m(stalled).verdict).toBe('PASS');
  });

  it('delete the 120 floor ⇒ `{frames: 10}` reports PASS', () => {
    const short = obs({ framesRequired: 10, framesObserved: 10 });
    expect(verdict(short).verdict).toBe('FAIL');
    const m = mutate('if (obs.framesRequired < 120)', 'if (false)');
    expect(m(short).verdict).toBe('PASS');
  });

  it('delete the clobber clause ⇒ a run with its error channel switched off reports PASS', () => {
    const m = mutate('if (obs.onerrorClobbered)', 'if (false)');
    expect(m(obs({ onerrorClobbered: true })).verdict).toBe('PASS');
  });

  it('collapse INCONCLUSIVE into PASS ⇒ a 1 fps background run reports PASS', () => {
    const m = mutate('const inconclusive = obs.throttled === true || obs.documentHidden === true;',
      'const inconclusive = false;');
    expect(verdict(obs({ throttled: true })).verdict).toBe('INCONCLUSIVE');
    expect(m(obs({ throttled: true })).verdict).toBe('PASS');
  });
});

// ═════════════════════════════════════════════════════════════════════════════════════════════════
// 3. THE COLLECTION SIDE — the parts of `_lab.frameSurvival` a headless run can still pin, and the
//    PREMISE the liveness clause rests on.
// ═════════════════════════════════════════════════════════════════════════════════════════════════
describe('the hook, and the premise under it', () => {
  const hook = (() => {
    const a = MAIN.indexOf('  async frameSurvival(opts = {}) {');
    expect(a).toBeGreaterThan(-1);
    return MAIN.slice(a, MAIN.indexOf('\n  },\n', a));
  })();

  it('installs BOTH error channels and the rejection listener', () => {
    // `window.onerror` is what PLAN §4 names; `addEventListener('error')` is what survives being
    // clobbered. Neither alone is the instrument.
    expect(hook).toContain('window.onerror = onErrorProp;');
    expect(hook).toContain("window.addEventListener('error', onErrorEvt, true);");
    expect(hook).toContain("window.addEventListener('unhandledrejection', onRejection);");
  });

  it('restores every handler it installed', () => {
    expect(hook).toContain('window.onerror = prevOnError;');
    expect(hook).toContain("window.removeEventListener('error', onErrorEvt, true);");
    expect(hook).toContain("window.removeEventListener('unhandledrejection', onRejection);");
  });

  it('⛔ chains to the page\'s own handler instead of swallowing', () => {
    // An instrument that returns `true` from onerror hides the exception from everyone else for the
    // duration of its own measurement.
    expect(hook).toContain('return prevOnError ? prevOnError.apply(this, arguments) : false;');
  });

  it('floors the frame count at 120 in the COLLECTOR as well as the verdict', () => {
    expect(hook).toContain('const framesRequired = Math.max(120, framesAsked);');
  });

  it('settles the microtask queue before reading the rejection tally', () => {
    // `unhandledrejection` fires only after a microtask checkpoint passes with no handler attached,
    // so a promise rejected on the last frame is reported after the loop resolves. Reading the
    // tally immediately is a false PASS produced by reading too early.
    expect(hook).toMatch(/setTimeout\(r, \d+\)/);
  });

  it('⛔ names no part of the Sol-scoped integration suite', () => {
    expect(hook).not.toContain('runIntegrationSuite');
    expect(hook).not.toContain('__wd');
  });

  it('⭐ THE PREMISE: the loop binding reschedules at the BOTTOM, so a throw kills it', () => {
    // The whole liveness clause exists because of this line ordering. If the vendored binding ever
    // moves `raf(frame)` above `render(alpha)`, a throw would no longer stop the chain — the
    // liveness clause would stop being able to fire, and D's own docblock would be describing a
    // mechanism that no longer exists.
    const frameFn = BINDING.slice(BINDING.indexOf('function frame(t)'), BINDING.indexOf('return {'));
    expect(frameFn).toContain('render(alpha);');
    expect(frameFn).toContain('rafHandle = raf(frame);');
    expect(frameFn.indexOf('render(alpha);')).toBeLessThan(frameFn.indexOf('rafHandle = raf(frame);'));
  });

  it('⭐ THE OTHER PREMISE: `isRunning()` is NOT cleared on a throw, so it cannot be the signal', () => {
    // `running` is set false only inside `stop()`. A loop that died in `render` still reports true —
    // which is why `frameSurvival` prints it as `loopRunningFlag` with a note and never reads it.
    const stopFn = BINDING.slice(BINDING.indexOf('stop() {'), BINDING.indexOf('isRunning() {'));
    expect(stopFn).toContain('running = false;');
    // Exactly TWO occurrences in the whole file: the `let running = false;` declaration and the one
    // inside `stop()`. A third would mean some other path clears it and the flag might be honest.
    expect(BINDING.match(/running = false;/g).length).toBe(2);
    expect(BINDING).toContain('let running = false;');
    expect(MAIN).toContain('loopRunningFlagNote:');
  });
});
