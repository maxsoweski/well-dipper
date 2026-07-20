// tests/worldengine-atmo-deck-spiral-rhines.test.js
// ─────────────────────────────────────────────────────────────────────────────
// world-engine-atmo-deck-spiral-rhines — Slice S1 (RHINES + ROTATION WIRES, ONE BAND COUNT).
// Closes AC-RHINES / AC-ROTDRAW / AC-ONECOUNT / AC-0(1) headlessly. Source greps use the
// storm-e/giant-drivers SRC-matchAll house pattern, COMMENT-STRIPPED (K_CODE/I_CODE) so a token
// living only in documentation prose can't pass or fail a code-level assertion.
// Later slices (S2 substrate, S3 deckZ, S4 dSpiral) append their own describe-blocks to this file.
// ─────────────────────────────────────────────────────────────────────────────
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  E5_REGIME, DRIVER_BUNDLES, resolveParams, rhinesWavenumber, PHYS,
} from '../src/worldengine/base/climate-e5.js';
import {
  giantDriverScalars, drawRotationHours, tidalLockRotationHours, ROTATION_RANGES_HOURS,
} from '../src/worldengine/base/giant-drivers.js';

// ── comment-stripped source text (the house K_CODE/I_CODE pattern) ─────────────────────────────────
const src = (rel) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8');
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
const GD_SRC = src('../src/worldengine/base/giant-drivers.js');
const GD_CODE = strip(GD_SRC);
const GLSL_CODE = strip(src('../planet-lod-height.glsl.js'));
const UNIF_CODE = strip(src('../planet-lod-uniforms.js'));
const LAB_CODE = strip(src('../planet-lod-lab.html'));

// balanced-brace body extractor over comment-stripped code (defn found by a signature substring).
// Skips the parameter list FIRST (paren-balanced) so a destructured/`= {}` param brace isn't mistaken
// for the body open — then brace-balances the body.
function fnBody(code, sig) {
  const i = code.indexOf(sig);
  if (i < 0) return '';
  const pOpen = code.indexOf('(', i);
  let pd = 0, j = pOpen;
  for (; j < code.length; j++) {
    if (code[j] === '(') pd++;
    else if (code[j] === ')') { pd--; if (pd === 0) { j++; break; } }
  }
  const bOpen = code.indexOf('{', j);
  let bd = 0;
  for (let k = bOpen; k < code.length; k++) {
    if (code[k] === '{') bd++;
    else if (code[k] === '}') { bd--; if (bd === 0) return code.slice(bOpen, k + 1); }
  }
  return code.slice(bOpen);
}

// The Rhines m for a DRAWN (R, rot) under a regime bundle: giantDriverScalars normalizes the drawn
// radius/rotation exactly as the lab does, resolveParams merges them over the frozen triple (uPeak from
// the bundle's internalHeat/dissipation/shellDepthFrac), and m = rhinesWavenumber(rotRate, radius, uPeak).
const mFor = (regime, R, rotH, seed = 0) =>
  resolveParams(regime, giantDriverScalars(R, rotH), seed).m;

// ── AC-RHINES — the drawn radius/rotation actually reach the Rhines law (span the sqrt(a·Ω) envelope) ──
describe('S1 AC-RHINES — Rhines wire reads the drawn radius + rotation', () => {
  const GAS_R = [6, 8, 10, 12, 14];
  const GAS_ROT = [8, 10, 12, 14];
  const ICE_R = [2.5, 3.0, 3.5, 4.0];
  const ICE_ROT = [12, 14, 16, 20];

  it('[gas leg] m tracks sqrt(radius·rotationRate) monotonically at fixed uPeak; corner (14 RE, 8 h) ≥ 15', () => {
    // uPeak is bundle-fixed for GAS_GIANT ⇒ m depends ONLY on the drawn radius·rotationRate.
    const pts = [];
    for (const R of GAS_R) for (const rot of GAS_ROT) {
      const s = giantDriverScalars(R, rot);
      pts.push({ prod: s.radius * s.rotationRate, m: mFor(E5_REGIME.GAS_GIANT, R, rot) });
    }
    pts.sort((a, b) => a.prod - b.prod);
    for (let i = 1; i < pts.length; i++) expect(pts[i].m).toBeGreaterThanOrEqual(pts[i - 1].m);  // monotone non-decreasing
    expect(mFor(E5_REGIME.GAS_GIANT, 14, 8)).toBeGreaterThanOrEqual(15);                          // fast-large corner
    // seed-independence (m reads no per-seed jitter): a different seed gives the same m at the corner
    expect(mFor(E5_REGIME.GAS_GIANT, 14, 8, 4242)).toBe(mFor(E5_REGIME.GAS_GIANT, 14, 8, 0));
  });

  it('[ice leg — NEPTUNIAN-pinned, F12] m is 3-class ONLY under the Neptunian regime bundle (uPeak ≈ 7.70)', () => {
    // The m≈3 prediction is a property of the NEPTUNIAN drivers (internalHeat 2.60 / dissipation 0.15 ⇒
    // high uPeak, the Neptune-wind-paradox), NOT of (R, rot). There is NO 'ice' rotation range (F11);
    // the ice giant rides the sub-neptune 12–20 h band.
    for (const R of ICE_R) for (const rot of ICE_ROT) {
      expect(mFor(E5_REGIME.NEPTUNIAN, R, rot)).toBeLessThanOrEqual(4);
    }
    // the same corner under GAS_GIANT gives a much finer count — do NOT assert 3 there (F12)
    expect(mFor(E5_REGIME.NEPTUNIAN, 4, 12)).toBeLessThanOrEqual(4);
    expect(mFor(E5_REGIME.GAS_GIANT, 4, 12)).toBeGreaterThanOrEqual(5);
  });

  it('[population span] the combined gas + ice population spans ≥ ×2 in band count', () => {
    const ms = [];
    for (const R of GAS_R) for (const rot of GAS_ROT) ms.push(mFor(E5_REGIME.GAS_GIANT, R, rot));
    for (const R of ICE_R) for (const rot of ICE_ROT) ms.push(mFor(E5_REGIME.NEPTUNIAN, R, rot));
    expect(Math.max(...ms) / Math.min(...ms)).toBeGreaterThanOrEqual(2);
  });

  it('[hot-Jupiter] the derived tidal-lock rotation collapses the count to M_MIN', () => {
    const rotH = tidalLockRotationHours(150000, 332946);   // ≈ 1.42e5 h (preset non-orbit-consistent, by design)
    const m = resolveParams(E5_REGIME.HOT_JUPITER, giantDriverScalars(13, rotH), 0).m;
    expect(m).toBe(PHYS.M_MIN);
  });
});

// ── AC-ROTDRAW — rotation is drawn per archetype; hot-Jupiter derived; locked solids canonical ──────
describe('S1 AC-ROTDRAW — drawRotationHours', () => {
  const SEEDS = [0, 1, 7, 13, 42, 101, 256, 777, 1234, 9999];

  it('[ranges] each gas archetype draw stays inside ROTATION_RANGES_HOURS over many seeds', () => {
    for (const [arch, [lo, hi]] of Object.entries(ROTATION_RANGES_HOURS)) {
      for (const s of SEEDS) {
        const h = drawRotationHours({ archetype: arch, hydrogenAtmo: true }, s);   // gas, unlocked ⇒ drawn
        expect(h).toBeGreaterThanOrEqual(lo);
        expect(h).toBeLessThanOrEqual(hi);
      }
    }
    // and the draw genuinely varies across seeds (not a constant)
    const hs = SEEDS.map((s) => drawRotationHours({ archetype: 'gas-giant', hydrogenAtmo: true }, s));
    expect(new Set(hs).size).toBeGreaterThan(1);
  });

  it('[determinism] same archetype + seed ⇒ identical hours', () => {
    for (const s of SEEDS) {
      expect(drawRotationHours({ archetype: 'sub-neptune', hydrogenAtmo: true }, s))
        .toBe(drawRotationHours({ archetype: 'sub-neptune', hydrogenAtmo: true }, s));
    }
  });

  it('[hot-Jupiter-class DERIVED] locked + h2-he ≡ tidalLockRotationHours(orbit, starMass) exactly (identity, not magnitude)', () => {
    const args = { locked: true, hydrogenAtmo: true, orbitRadiusEarth: 150000, starMassEarth: 332946 };
    const expected = tidalLockRotationHours(150000, 332946);
    for (const s of SEEDS) expect(drawRotationHours(args, s)).toBe(expected);   // seed-independent (not drawn)
    // archetype is irrelevant on this branch — the identity is the ONLY key (hot-Jupiter absent from PRESET_ARCHETYPE)
    expect(drawRotationHours({ ...args, archetype: 'gas-giant' }, 3)).toBe(expected);
  });

  it('[locked SOLIDS canonical — F10 regression net] every locked solid returns canonicalHours', () => {
    // Eyeball/Lava/Europa/Magma/Frozen: locked (or not), NON-hydrogen ⇒ no gas range ⇒ canonical, never Kepler.
    const solids = [
      { name: 'Eyeball', archetype: 'eyeball', canonicalHours: 24 },
      { name: 'Lava',    archetype: 'lava',    canonicalHours: 13.7 },
      { name: 'Europa',  archetype: 'ice',     canonicalHours: 85.2 },
      { name: 'Magma',   archetype: 'lava',    canonicalHours: 6.7 },
      { name: 'Frozen',  archetype: 'ice',     canonicalHours: 42.0 },
    ];
    for (const b of solids) {
      for (const s of SEEDS) {
        // locked path
        expect(drawRotationHours({ archetype: b.archetype, canonicalHours: b.canonicalHours, locked: true, hydrogenAtmo: false }, s), b.name)
          .toBe(b.canonicalHours);
        // unlocked path (same canonical outcome — no gas range either way)
        expect(drawRotationHours({ archetype: b.archetype, canonicalHours: b.canonicalHours, locked: false, hydrogenAtmo: false }, s), b.name)
          .toBe(b.canonicalHours);
      }
    }
    // a body with no archetype + no canonicalHours falls back to 24 h
    expect(drawRotationHours({ locked: false }, 5)).toBe(24);
  });

  it('[alea-only] the S1 rotation code uses alea, never Math.random / mulberry32 / wall-clock', () => {
    expect(GD_CODE).not.toMatch(/Math\.random\s*\(/);
    expect(GD_CODE).not.toMatch(/mulberry32/);
    expect(GD_CODE).not.toMatch(/Date\.now\s*\(/);
    const body = fnBody(GD_CODE, 'function drawRotationHours');
    expect(body).toMatch(/alea\(/);
    expect(body).toContain('giantD:rot:');
  });
});

// ── AC-ONECOUNT — exactly one band count (uBandM); the vestigial uBandCount is gone ─────────────────
describe('S1 AC-ONECOUNT — uBandCount retired, uBandM is the single band count', () => {
  it('[absent] uBandCount appears in no code (GLSL / uniforms / lab), comment-stripped', () => {
    expect(GLSL_CODE).not.toContain('uBandCount');
    expect(UNIF_CODE).not.toContain('uBandCount');
    expect(LAB_CODE).not.toContain('uBandCount');
  });

  it('[jets ladder] jetU / jetShearGate / jetsDisp all read uBandM', () => {
    for (const sig of ['jetU(float', 'jetShearGate(float', 'jetsDisp(float']) {
      expect(fnBody(GLSL_CODE, sig), sig).toContain('uBandM');
    }
  });

  it('[wire] BOTH lab driver-assembly sites read the drawn radius through giantDriverScalars', () => {
    const hits = [...LAB_CODE.matchAll(/giantDriverScalars\(state\.planetRadiusEarth/g)];
    expect(hits.length).toBe(2);
  });
});

// ── AC-0(1) — driver connectivity: rotation keys on the sanctioned archetype tag, not a preset name ──
describe('S1 AC-0 — spine conformance (driver connectivity)', () => {
  it('[no preset-name routing] the rotation ranges + draw key on archetype tags, not DRIVER_PRESETS names', () => {
    for (const name of ['Jovian', 'Saturnian', 'Neptunian', 'Sub-Neptune', 'Hot Jupiter', 'Gas giant', 'Ice giant']) {
      expect(GD_CODE).not.toContain(name);
    }
    // the range keys are the RADIUS_RANGES_EARTH archetype tags (the single-source map), not names
    expect(Object.keys(ROTATION_RANGES_HOURS).sort()).toEqual(['gas-giant', 'sub-neptune']);
  });

  it('[giantDriverScalars] normalizes drawn radius/rotation to the Jupiter-normalized bundle convention', () => {
    // Jupiter canonical (11.2 RE, 9.9 h) ⇒ rotationRate 1.0, radius 1.0 (the DRIVER_BUNDLES gas anchor)
    const s = giantDriverScalars(11.2, 9.9);
    expect(s.rotationRate).toBeCloseTo(1.0, 9);
    expect(s.radius).toBeCloseTo(1.0, 9);
    expect(giantDriverScalars(11.2, 9.9, 2).rotationRate).toBeCloseTo(2.0, 9);   // e5RotationScale multiplies
  });
});
