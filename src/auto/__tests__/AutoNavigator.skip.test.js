// src/auto/__tests__/AutoNavigator.skip.test.js
//
// WS-1 — null-bodyRef skip-guard (AC4). A tour stop whose bodyRef is null (a
// mesh-spawn failure) must be SKIPPED, not frozen on. main.js advances the
// index but skips flyTo when bodyRef is null -> the tour freezes flying nothing
// (flight-audit 2026-06-30). advanceToNextWithBody() advances past null-bodyRef
// stops to the next stop that HAS a bodyRef (or returns null if none remain,
// without hanging).
import { describe, it, expect } from 'vitest';
import { AutoNavigator } from '../AutoNavigator.js';

const stop = (bodyRef, type = 'planet') => ({ type, bodyRef, orbitDistance: 0, bodyRadius: 5, linger: 10 });

describe('AutoNavigator.advanceToNextWithBody — null-bodyRef skip-guard (AC4)', () => {
  it('exposes advanceToNextWithBody()', () => {
    const nav = new AutoNavigator();
    expect(typeof nav.advanceToNextWithBody).toBe('function');
  });

  it('skips a null-bodyRef stop and lands on the next stop that has a bodyRef', () => {
    const nav = new AutoNavigator();
    const A = stop({ id: 'A' }, 'star'), B = stop(null), C = stop({ id: 'C' });
    nav.queue = [A, B, C];
    nav.state = 'active';
    nav.currentIndex = 0; // currently on A

    const landed = nav.advanceToNextWithBody();

    expect(landed).toBe(C);          // skipped B (null bodyRef)
    expect(nav.currentIndex).toBe(2);
    expect(nav.getCurrentStop()).toBe(C);
  });

  it('returns null when NO stop has a bodyRef (no infinite loop / freeze)', () => {
    const nav = new AutoNavigator();
    nav.queue = [stop(null), stop(null), stop(null)];
    nav.state = 'active';
    nav.currentIndex = 0;

    const landed = nav.advanceToNextWithBody();

    expect(landed).toBe(null);
  });
});
