// tests/lab-isolation.test.js
// Tier-2 prerequisite (Phase 2): the pure enable-set logic behind non-destructive
// solo. computeEnableSet is the single source of truth for "which features are on"
// in any solo mode; extracted so it's unit-testable headless (no DOM, no GPU).
import { describe, it, expect } from 'vitest';
import { computeEnableSet } from '../lab-isolation.js';

describe('computeEnableSet', () => {
  const allKeys = ['rivers', 'lakes', 'frost', 'dust', 'aurora'];

  it('bare mode → just the soloed key', () => {
    const s = computeEnableSet(allKeys, { solo: 'frost', mode: 'bare', isolationKit: ['lakes'] });
    expect([...s].sort()).toEqual(['frost']);
  });

  it('context mode → soloed key ∪ its isolationKit', () => {
    const s = computeEnableSet(allKeys, { solo: 'frost', mode: 'context', isolationKit: ['lakes', 'dust'] });
    expect([...s].sort()).toEqual(['dust', 'frost', 'lakes']);
  });

  it('context mode with empty kit → just the key', () => {
    const s = computeEnableSet(allKeys, { solo: 'aurora', mode: 'context', isolationKit: [] });
    expect([...s].sort()).toEqual(['aurora']);
  });

  it('solo null → all keys (un-solo)', () => {
    const s = computeEnableSet(allKeys, { solo: null, mode: 'context', isolationKit: [] });
    expect([...s].sort()).toEqual([...allKeys].sort());
  });

  it('defaults to context mode when mode omitted', () => {
    const s = computeEnableSet(allKeys, { solo: 'frost', isolationKit: ['lakes'] });
    expect([...s].sort()).toEqual(['frost', 'lakes']);
  });

  it('returns a Set', () => {
    const s = computeEnableSet(allKeys, { solo: 'frost', mode: 'bare', isolationKit: [] });
    expect(s).toBeInstanceOf(Set);
  });

  it('never includes a kit member that is not a real key', () => {
    // kit may carry a stale key; the result is intersected with allKeys so the
    // caller never tries to enable a feature the lab does not have.
    const s = computeEnableSet(allKeys, { solo: 'frost', mode: 'context', isolationKit: ['lakes', 'ghostFeature'] });
    expect([...s].sort()).toEqual(['frost', 'lakes']);
  });
});
