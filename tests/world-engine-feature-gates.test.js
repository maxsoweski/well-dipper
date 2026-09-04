// tests/world-engine-feature-gates.test.js — the GAME gates over the world-engine features.
// Workstream: docs/WORKSTREAMS/world-engine-feature-gates/.
//
// ⭐ MAX'S BAR, ruled 2026-09-04: **"grown from the engine, not painted on"** — a feature is ON in the
// GAME only if it reads the bake's accumulated landforms, not just the province mask with a floor
// under it. His purpose, in his words: *"I want to be able to continue developing the features in the
// lab then seamlessly be able to switch them on in game when ready."*
//
// ⛔⛔ THE ONE THING THIS FILE EXISTS TO PREVENT: **an OFF switch that does not actually stop the
// render is a lie that looks like a feature**, and it would be believed, because the whole point is
// that nobody thinks about these again until they are flipped on. So nothing here reads a flag back.
// Every assertion resolves drivers through the SAME writer the game runs and counts BODIES.
import { describe, it, expect } from 'vitest';
import { corpus, MESH } from './fixtures/ray-pack-corpus.mjs';
import { labPackCtx } from '../src/objects/Planet.js';
import { gatesFor, GATE_POLICY_ALL_ON, GATE_POLICY_RULED, GATE_RULINGS, GAME_GATE_RULINGS } from '../src/worldengine/drivers/index.js';
import { resolveDriver } from '../src/worldengine/port/writePackUniforms.js';
import { solidReliefPack, SOLID_RELIEF_ENTRY, SOLID_RELIEF_GATES, SOLID_RELIEF_GAME_GATES } from '../src/worldengine/drivers/solidRelief.js';

// gate -> [master uniform, bodies it reached BEFORE the ruling]. The counts are the ones the scoping
// read recorded and Max was shown when he accepted the deck (driver-pack-solidrelief.test.js
// EXPECTED_NONZERO). They are the control: they are what "the player used to see".
const MASTER = Object.freeze({
  mountains: ['uMountainAmp', 103], canyons: ['uChasmaDepth', 124], scarps: ['uScarpStrength', 122],
  plateaus: ['uPlateauStrength', 124], tessera: ['uTesseraStrength', 46], lava: ['uLavaCoverage', 103],
  sublimation: ['uSubStrength', 40], dust: ['uDustDepth', 68],
  karst: ['uKarstDensity', 68], dunes: ['uDuneDensity', 68], massWasting: ['uMassWastDensity', 124],
});

const SOLID = corpus().filter((b) => b.cls !== 'gas');

// ⛔⛔ THE PACK IS CALLED HERE, NOT `resolvedPacks()`, AND THAT IS THE WHOLE MEASUREMENT.
// `ray-pack-corpus.mjs:64` ALREADY RESOLVES its drivers, under a policy PINNED to ALL_ON (`:61`, so
// the cross-commit fixture harness compares code and not policies). Feeding one of its numbers back
// into `resolveDriver` hands the gate branch a plain number with no `.gate` on it — the gate is never
// consulted and every count comes out identical under every policy. The first cut of this file did
// exactly that: it reported `mountains: 103` with the gate ruled OFF and its own liveness check
// PASSED, because both columns were the same ungated number. Take the DESCRIPTORS from the pack and
// resolve them against the gates under test.
const countNonZero = (gates) => {
  const nz = {};
  for (const b of SOLID) {
    const ctx = labPackCtx(b.d, b.cond, MESH);
    const packCtx = { ...ctx, gates };
    const r = solidReliefPack(b.cond, packCtx);       // descriptors, unresolved
    for (const [g, [name]] of Object.entries(MASTER)) {
      if (resolveDriver(name, r.drivers[name], packCtx) > 0) nz[g] = (nz[g] ?? 0) + 1;
    }
  }
  return nz;
};

describe('world-engine feature gates — the GAME draws only what is grown from the engine', () => {
  const gameGates = gatesFor(SOLID_RELIEF_ENTRY, GATE_POLICY_RULED, GAME_GATE_RULINGS);
const labGates  = gatesFor(SOLID_RELIEF_ENTRY);   // gatesFor's DEFAULT map is the convergence one — what the LAB takes
const ruled = countNonZero(gameGates);                                          // what the game writes
  const allOn = countNonZero(gatesFor(SOLID_RELIEF_ENTRY, GATE_POLICY_ALL_ON));   // the pre-ruling answer

  it('AC-1 — every painted-over feature reaches ZERO bodies in the game', () => {
    for (const [g, [, was]] of Object.entries(MASTER)) {
      if (SOLID_RELIEF_GAME_GATES[g].on) continue;
      expect(ruled[g] ?? 0, `${g} must draw on no body (it reached ${was})`).toBe(0);
    }
  });

  it('AC-1 — the three reactive features are UNTOUCHED, by value', () => {
    // karst / dunes / massWasting read the accumulated surface, so they clear the bar and must not
    // have moved by a single body. Asserted by count, not by "we did not mean to change them".
    for (const [g, [, was]] of Object.entries(MASTER)) {
      if (!SOLID_RELIEF_GAME_GATES[g].on) continue;
      expect(ruled[g] ?? 0, g).toBe(was);
    }
  });

  it('⛔ LIVENESS — the zeros are the GATE biting, not an instrument that cannot see gates', () => {
    // Without this the AC-1 zeros are worthless in TWO different ways, and the second one actually
    // happened while writing this file:
    //   1. a feature that reached no bodies anyway would give the same passing result;
    //   2. an instrument that never consults the gates gives the same passing result for the ON rows
    //      and would have given a FAILING result for the OFF ones — which is how the bug was caught,
    //      but only by luck of which assertion ran first.
    // So the control is not "ALL_ON is unmoved" — that passes under both bugs. The control is that
    // ruling a gate off must CHANGE THE ANSWER on that gate, and change it all the way to zero.
    for (const [g, [, was]] of Object.entries(MASTER)) {
      expect(allOn[g] ?? 0, `${g} under ALL_ON is the control and must be unmoved`).toBe(was);
      if (SOLID_RELIEF_GAME_GATES[g].on) continue;
      expect(was, `${g} must have been drawing something, or its zero proves nothing`).toBeGreaterThan(0);
      expect(ruled[g] ?? 0, `${g}: RULED must DIFFER from ALL_ON — this is the discriminating check`)
        .not.toBe(allOn[g] ?? 0);
    }
    const offCount = Object.values(SOLID_RELIEF_GAME_GATES).filter((r) => !r.on).length;
    expect(offCount, 'a run with nothing switched off would pass every test above vacuously').toBe(10);   // ⭐ 8 -> 10 on Max's UAT 2026-09-04: dunes ("Everything still has the dunes drawn across the surface") and karst, whose gate is character-identical. Only massWasting clears the sharpened bar — its gate reads a RESIDUAL, which closes on flat ground instead of opening.
  });

  it('AC-5 — flipping ONE value is the whole ship action', () => {
    // The promise: "when a feature is ready, switching it on is one change, not a re-wiring job."
    // One boolean, no other edit anywhere, and the feature's bodies come back.
    const flipped = countNonZero({ ...gameGates, mountains: true });
    expect(flipped.mountains ?? 0).toBe(MASTER.mountains[1]);
    // ...and flipping one on must not disturb any other row.
    for (const [g, [, was]] of Object.entries(MASTER)) {
      if (g === 'mountains') continue;
      expect(flipped[g] ?? 0, g).toBe(SOLID_RELIEF_GAME_GATES[g].on ? was : 0);
    }
  });

  it('AC-4 — the registry cannot rot: every gate has a row, every OFF row names its exit', () => {
    expect(Object.keys(SOLID_RELIEF_GAME_GATES).sort()).toEqual([...SOLID_RELIEF_GATES].sort());
    for (const [name, row] of Object.entries(SOLID_RELIEF_GAME_GATES)) {
      expect(typeof row.on, name).toBe('boolean');
      expect(row.why, `${name} must say WHY`).toBeTruthy();
      // An OFF row with no exit condition is a permanent divergence wearing a temporary hat.
      if (!row.on) expect(row.waitingFor, `${name} is OFF and must name what it is waiting for`).toBeTruthy();
      else expect(row.waitingFor, `${name} is ON and must not be waiting for anything`).toBeNull();
    }
  });

  it('AC-4 — the game map is DERIVED from the registry, not a second list', () => {
    for (const [g, row] of Object.entries(SOLID_RELIEF_GAME_GATES)) expect(GAME_GATE_RULINGS[g], g).toBe(row.on);
    expect(Object.isFrozen(GAME_GATE_RULINGS)).toBe(true);
  });

  it('⭐⭐ AC-3 — THE LAB KEEPS EVERY FEATURE. This is the point of the whole workstream.', () => {
    // The development gates are GAME-ONLY. If they ever leak into the convergence map, the lab stops
    // drawing the very features it exists to develop — which is precisely what the first cut of this
    // did, and it showed up as eight names vanishing from LEDGER.labVarying in material-parity-list.
    for (const g of SOLID_RELIEF_GATES) {
      expect(labGates[g], `${g} must still be ON for the lab`).toBe(true);
      expect(GATE_RULINGS, `${g} must NOT be in the convergence map`).not.toHaveProperty(g);
    }
    // ...and the one CONVERGENCE ruling still binds both sides: the terminator is off everywhere.
    expect(GATE_RULINGS.terminator).toBe(false);
    expect(GAME_GATE_RULINGS.terminator).toBe(false);
    // Measured, not asserted from the flags: every OFF feature still reaches its bodies under the lab's map.
    const lab = countNonZero(labGates);
    for (const [g, [, was]] of Object.entries(MASTER)) expect(lab[g] ?? 0, `lab ${g}`).toBe(was);
  });

  it('the ruling answers only the names it declares — no other pack is weakened', () => {
    // `gatesFor` answers `rulings[g] ?? true`, so a gate nobody has ruled on is still ON. This is the
    // property that keeps the policy honest: turning eight features off must not be a global dimmer.
    const ours = new Set([...SOLID_RELIEF_GATES, 'terminator']);
    expect([...Object.keys(GAME_GATE_RULINGS)].filter((n) => !ours.has(n)), 'unexpected names').toEqual([]);
    expect(Object.keys(GATE_RULINGS)).toEqual(['terminator']);   // the convergence map stays minimal
  });
});
