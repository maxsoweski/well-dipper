// tests/render-audit.test.js
// Tier-2 pure auditor (Phase 2.5 Task 7): turns the manifest's declared rendersOn
// matrix + the live A/B-delta matrix into a violations list. Headless, no GPU —
// the GPU sweep (Task 8) only PRODUCES the delta matrix; this judges it.
import { describe, it, expect } from 'vitest';
import { expectedMatrix, auditRenderMatrix } from '../lab-render-audit.js';

describe('render audit', () => {
  const manifest = {
    rivers: { rendersOn: ['Rocky', 'Ocean'] },
    aurora: { rendersOn: ['Rocky', 'Gas giant'] },
  };
  const presets = ['Rocky', 'Ocean', 'Gas giant'];

  it('expectedMatrix marks the declared render cells true', () => {
    const m = expectedMatrix(manifest, presets);
    expect(m.rivers.Ocean).toBe(true);
    expect(m.rivers['Gas giant']).toBe(false);
    expect(m.aurora['Gas giant']).toBe(true);
  });

  it('flags a false-render (renders where rendersOn says it should not)', () => {
    const expected = expectedMatrix(manifest, presets);
    const actualDeltas = { rivers: { Rocky: 0.4, Ocean: 0.3, 'Gas giant': 0.2 }, // <- 0.2 on Gas giant = bug
                           aurora: { Rocky: 0.5, Ocean: 0.0, 'Gas giant': 0.6 } };
    const v = auditRenderMatrix(expected, actualDeltas, { eps: 0.01 });
    expect(v.falseRenders).toContainEqual({ feature: 'rivers', preset: 'Gas giant', delta: 0.2 });
    expect(v.deadRenders).toEqual([]); // aurora Ocean is 0 but Ocean ∉ rendersOn(aurora) → not dead, correctly absent
  });

  it('flags a dead-render (declared but inert)', () => {
    const expected = expectedMatrix(manifest, presets);
    const actualDeltas = { rivers: { Rocky: 0.0, Ocean: 0.3, 'Gas giant': 0.0 }, // Rocky declared but 0 = dead
                           aurora: { Rocky: 0.5, Ocean: 0.0, 'Gas giant': 0.6 } };
    const v = auditRenderMatrix(expected, actualDeltas, { eps: 0.01 });
    expect(v.deadRenders).toContainEqual({ feature: 'rivers', preset: 'Rocky', delta: 0.0 });
  });
});
