// NavComputer.level — a read accessor for the current view level, added for
// lane F (cockpit-screen-content-2026-07-28).
//
// Why an accessor rather than exporting LEVELS: `const LEVELS` and
// `const LEVEL_NAMES` are private module consts with zero importers. The NAV
// panel's snapshot needs the level as a STRING, and the three ways to get one
// are (a) re-declare the array in lane F — which then has to stay in lockstep
// with a private const nobody would think to update, (b) read `_levelIndex` and
// index a lane-F copy — the same drift one indirection out, or (c) let the class
// name its own level. (c) is the only one with no second copy of the array.
//
// The constructor is DOM-bound (`canvas.getContext('2d')`) and the node test env
// has no `window`, so these drive an Object.create'd instance — the same pattern
// NavComputer.merge.test.js and its five siblings already use.

import { describe, it, expect } from 'vitest';
import { NavComputer } from '../NavComputer.js';

const at = (levelIndex) => {
  const nav = Object.create(NavComputer.prototype);
  nav._levelIndex = levelIndex;
  return nav;
};

describe('NavComputer.level', () => {
  it('names each of the five view levels', () => {
    expect(at(0).level).toBe('galaxy');
    expect(at(1).level).toBe('sector');
    expect(at(2).level).toBe('region');
    expect(at(3).level).toBe('prism');
    expect(at(4).level).toBe('system');
  });

  it('reports the constructor default of PRISM', () => {
    // `this._levelIndex = 3; // start at PRISM`
    expect(at(3).level).toBe('prism');
  });

  it('reads as unknown rather than undefined when the index is out of range', () => {
    // AutopilotNavSequence writes _levelIndex directly (_startAtGalaxy → 0,
    // _startAtSector → 1, …). A panel should render a word, not `undefined`.
    expect(at(-1).level).toBe('unknown');
    expect(at(99).level).toBe('unknown');
  });
});
