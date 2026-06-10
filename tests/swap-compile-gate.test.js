// Swap compile gate (Goal 3, 2026-06-09): at the warp swap, the freshly
// spawned destination system must NOT be drawn until compileAsync finishes —
// otherwise the next render() pass force-compiles its shaders synchronously
// (measured 0.5-2.0s single-frame stall = Max's "everything stops moving" at
// tunnel entry). The gate hides the scene roots added by spawnSystem, lets
// KHR_parallel_shader_compile do its work invisibly (renderer.compile()
// traverses invisible objects — three r183 uses scene.traverse, not
// traverseVisible), then restores visibility before the AC5 emergence gate
// releases. These tests pin the pure hide/restore bookkeeping.
import { describe, test, expect } from 'vitest';
import { hideNewRoots, restoreRoots } from '../src/effects/swapCompileGate.js';

const node = (visible = true) => ({ visible });

describe('swap compile gate — hide/restore of spawn-added scene roots', () => {
  test('hides only roots added since the snapshot and returns them', () => {
    const a = node(), b = node();
    const before = new Set([a, b]);
    const c = node(), d = node();
    const hidden = hideNewRoots(before, [a, b, c, d]);
    expect(hidden).toEqual([c, d]);
    expect(c.visible).toBe(false);
    expect(d.visible).toBe(false);
    expect(a.visible).toBe(true);   // pre-existing roots untouched
    expect(b.visible).toBe(true);
  });

  test('roots that spawned already-invisible are left alone (not hidden, not restored)', () => {
    const before = new Set();
    const vis = node(true), invis = node(false);
    const hidden = hideNewRoots(before, [vis, invis]);
    expect(hidden).toEqual([vis]);
    restoreRoots(hidden);
    expect(vis.visible).toBe(true);
    expect(invis.visible).toBe(false);  // its own logic decides, not the gate
  });

  test('restoreRoots makes every hidden root visible again', () => {
    const roots = [node(), node(), node()];
    const hidden = hideNewRoots(new Set(), roots);
    expect(roots.every(r => r.visible === false)).toBe(true);
    restoreRoots(hidden);
    expect(roots.every(r => r.visible === true)).toBe(true);
  });

  test('restoreRoots is idempotent and safe on an empty list', () => {
    expect(() => restoreRoots([])).not.toThrow();
    const r = node();
    const hidden = hideNewRoots(new Set(), [r]);
    restoreRoots(hidden);
    restoreRoots(hidden);
    expect(r.visible).toBe(true);
  });
});

// Goal 3b (2026-06-10): renderer.compile() collects LIGHTS via traverseVisible,
// so compiling while the gated roots are hidden bakes a no-lights program
// variant — the reveal frame then sync-links the lit variant (~330ms, profiler:
// getProgramInfoLog at first use). Fix: restore visibility, start compileAsync
// (its synchronous part samples lights), then re-hide via hideRoots — all in
// one synchronous block so no render can interleave.
describe('swap compile gate — hideRoots (re-hide for variant-matched compile)', () => {
  test('hideRoots re-hides every root in the list', async () => {
    const { hideRoots } = await import('../src/effects/swapCompileGate.js');
    const roots = [node(), node(), node()];
    const hidden = hideNewRoots(new Set(), roots);
    restoreRoots(hidden);
    expect(roots.every(r => r.visible === true)).toBe(true);
    hideRoots(hidden);
    expect(roots.every(r => r.visible === false)).toBe(true);
    restoreRoots(hidden);
    expect(roots.every(r => r.visible === true)).toBe(true);
  });

  test('hideRoots is safe on an empty list', async () => {
    const { hideRoots } = await import('../src/effects/swapCompileGate.js');
    expect(() => hideRoots([])).not.toThrow();
  });
});
