/**
 * AC-OVERLAYS-RETIRE-IN-HELM, the 320² slot half.
 *
 * The slot hosts TWO scenes that retire differently: the MINIMAP goes in HELM
 * (the cockpit's NAV panel replaces it) and stays in ORRERY, which has no
 * cockpit to host anything; the GRAVITY WELL survives in BOTH, because it has
 * no NavComputer level, no cockpit panel and no snapshot field to fold into.
 *
 * ── THE DEFECT THIS PINS ───────────────────────────────────────────────────
 *
 * Five separate places used to push a scene into the slot, and one of them —
 * `spawnSystem` — runs on EVERY ARRIVAL. A regime gate written at the other
 * four would look correct, pass a live check, and then put the minimap straight
 * back on top of the cockpit at the next warp. The contract's own verify step
 * calls that out by name. So the shape of the fix is the thing worth guarding:
 * ONE decision point, and no `setHud` anywhere else.
 *
 * A source scan, because `src/main.js` builds a WebGL renderer at module scope
 * and is not importable here — same standing reason as `mainNavWiring.test.js`.
 * Comments are stripped before matching: a previous guard in this lane went red
 * on its own prose, and an earlier one went GREEN on a comment quoting the code
 * it was hunting.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const RAW = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), '../../main.js'), 'utf8');
/** Code only — block and line comments removed. */
const SRC = RAW.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');

describe('the HUD slot has exactly one decision point', () => {
  it('CONTROL: the decision point and its two readers still exist', () => {
    // If these are renamed away, every assertion below is stale, not passing.
    expect(SRC, 'no _hudSlotScene — this scan is stale').toMatch(/function _hudSlotScene\(\)/);
    expect(SRC, 'no _applyHudSlot — this scan is stale').toMatch(/function _applyHudSlot\(\)/);
    expect(SRC, 'no _minimapLive — the click gates lost their predicate').toMatch(/function _minimapLive\(\)/);
  });

  it('every retroRenderer.setHud call lives in _applyHudSlot or _blankHudSlot', () => {
    // Two intents, two functions. `_applyHudSlot` DECIDES; `_blankHudSlot`
    // SUPPRESSES for the warp fold and the object gallery, where `system` is
    // still set and a re-decide would put the minimap back over a system that
    // is no longer on screen. Anything else is a third decision point.
    const decideStart = SRC.indexOf('function _applyHudSlot()');
    const decideEnd = SRC.indexOf('function _blankHudSlot()', decideStart);
    const blankStart = decideEnd;
    const blankEnd = SRC.indexOf('function _minimapLive()', blankStart);
    expect(decideStart).toBeGreaterThan(-1);
    expect(blankEnd).toBeGreaterThan(blankStart);

    const all = [...SRC.matchAll(/retroRenderer\.setHud\(/g)].map((m) => m.index);
    const outside = all.filter(
      (i) => !(i > decideStart && i < decideEnd) && !(i > blankStart && i < blankEnd),
    );
    expect(
      outside.length,
      `setHud called from ${outside.length} site(s) outside the two — a second `
      + 'decision point is how the minimap comes back after a warp',
    ).toBe(0);
    expect(all.length, 'three deciding branches plus one blank').toBe(4);

    // …and the blank really is a blank, not a smuggled second decision.
    expect(SRC.slice(blankStart, blankEnd)).toMatch(/setHud\(null, null\)/);
    expect(SRC.slice(blankStart, blankEnd)).not.toMatch(/scene/);
  });

  it('the minimap branch is gated on the regime and the gravity well is NOT', () => {
    const scene = SRC.slice(SRC.indexOf('function _hudSlotScene()'), SRC.indexOf('function _applyHudSlot()'));
    const wellLine = scene.split('\n').find((l) => l.includes("'well'"));
    const mapLine = scene.split('\n').find((l) => l.includes("'minimap'"));
    expect(mapLine, 'the minimap must retire in HELM').toMatch(/!_scManual/);
    expect(
      wellLine,
      'the gravity well has no cockpit replacement — gating it off in HELM deletes it outright',
    ).not.toMatch(/_scManual/);
  });

  it('spawnSystem re-decides on arrival — the warp trap', () => {
    // The arrival path must go through the decision point, not set the slot
    // itself. Anchored on ORDER: the re-decide has to come after the SystemMap
    // is (re)built, or it decides against the previous system's map.
    const spawn = SRC.indexOf('systemMap = new SystemMap(');
    expect(spawn).toBeGreaterThan(-1);
    const after = SRC.slice(spawn, spawn + 700);
    expect(after, 'no _applyHudSlot() after the SystemMap is rebuilt').toMatch(/_applyHudSlot\(\);/);
  });

  it('a regime flip re-decides — the minimap must come BACK in ORRERY', () => {
    // Found live 2026-07-30: gating the minimap on `_scManual` made the regime
    // an INPUT to the decision, and nothing re-decided when the regime flipped.
    // So it vanished on entering HELM and never returned on leaving — the
    // retirement worked and the restoration silently did not. `setScManual` is
    // the file's own "THE universal regime-flip point" and already hooks the
    // mode-swap button and the orbit lines for exactly this reason.
    const start = SRC.indexOf('function setScManual(on)');
    expect(start, 'setScManual renamed — this scan is stale').toBeGreaterThan(-1);
    const body = SRC.slice(start, SRC.indexOf('\n}', start));
    expect(body, 'no re-decide on the regime flip').toMatch(/_applyHudSlot\(\)/);
  });

  it('the click and drag dead zones ask the same question the renderer asked', () => {
    // Otherwise HELM keeps a live 320² hole that eats clicks meant for the
    // world over a minimap that is not being drawn.
    const readers = [...SRC.matchAll(/_minimapLive\(\)/g)].length;
    expect(readers, 'expected the definition plus the click and drag gates').toBeGreaterThanOrEqual(3);
    expect(
      SRC,
      'a hand-rolled minimap-visibility test survives somewhere — it will drift from _hudSlotScene',
    ).not.toMatch(/systemMap && minimapVisible && !gravityWellVisible/);
  });
});
