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
