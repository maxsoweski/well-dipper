// relief-router-repoint.test.js — Phase D / AC3 (re-point wiring source-scan).
//
// WHAT THIS GUARDS (BUILD-PLAN §D.6(b)): the SPLIT-TRAP #5 wiring inside createRiverOverlay.route() in
// planet-lod-rivers.js. The central recurrence risk of this whole workstream is that the renderer (Phase
// C) reads the baked height cube while the router (Phase D) keeps calling sampler.read() (the in-shader
// RTT) — "surface says one thing, rivers say another", the exact WS4 split. This source-scan freezes the
// re-point shape so a later edit can't silently re-open the split:
//
//   1. route() gates the height source on the SAME uReliefBakeStrength uniform the renderer gates on.
//   2. the baked branch reads carrier.height (the IDENTICAL array baked into the cube) — NOT sampler.read.
//   3. the strength-0 fallback (sampler.read / createHeightSampler / ROUTER_MAIN) is PRESERVED, not
//      deleted — strength 0 ⇒ byte-identical legacy path.
//   4. no Math.random / Date.now anywhere in the router module (determinism, G6).
//
// WHY a SOURCE-SCAN, not a runtime route(): route() needs a live WebGL renderer (the height-cube bake +
// the legacy createHeightSampler RTT both need a GPU context) — it cannot run headless in vitest. The
// drainage behaviour on the baked field is covered by tests/relief-router-baked-drainage.test.js (the
// REAL pure routeAndOrder on the REAL baked carrier.height); the live single-source parity is the :9223
// gate (§D.6(c)). This file guards the WIRING that connects the two.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const riversSrc = readFileSync(path.resolve(__dirname, '../planet-lod-rivers.js'), 'utf8');

// Pull the route() function BODY out of the source by walking matched braces. NOTE: route()'s parameter
// list is itself a destructured object (`function route({ ... } = {}) {`), so we MUST anchor on the END
// of the signature (`} = {}) {`) — naively walking from the first `{` after `function route(` would grab
// the destructuring-param brace and stop at its close, cutting off the whole body.
function routeBody(src) {
  const start = src.indexOf('function route(');
  expect(start, '"function route(" must be present in planet-lod-rivers.js').toBeGreaterThanOrEqual(0);
  const sigEnd = src.indexOf('} = {}) {', start);
  expect(sigEnd, 'route() signature end "} = {}) {" must be present').toBeGreaterThanOrEqual(0);
  const open = src.indexOf('{', sigEnd + '} = {})'.length); // the body-opening brace, past the param close
  let depth = 0, i = open;
  for (; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') { depth--; if (depth === 0) { i++; break; } }
  }
  return src.slice(open, i);
}

// Strip JS comments (line + block) so a regex scan for forbidden CALLS (Math.random / Date.now) does not
// false-positive on the many explanatory comments that NAME those identifiers ("...no rng, no Date.now").
function stripComments(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, ' ')   // block comments
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1'); // line comments (avoid eating http:// — keep the char before //)
}

describe('Phase D / AC3 — river-router height-source re-point wiring (SPLIT-TRAP #5 guard)', () => {
  const body = routeBody(riversSrc);

  it('route() gates the height source on the uReliefBakeStrength uniform (the SAME gate as the renderer)', () => {
    // Both consumers fall back together at strength 0. The gate must read uniforms.uReliefBakeStrength
    // (the shared uniform Phase C also reads) and branch on value > 0.
    expect(body).toMatch(/uniforms\.uReliefBakeStrength/);
    expect(body).toMatch(/uReliefBakeStrength[\s\S]{0,40}\.value\s*>\s*0/);
  });

  it('the baked branch reads the margin-composited single source (marginHeight/marginGrad), NOT sampler.read', () => {
    // V2-4 slice-3: the baked branch sets height from `marginHeight` — the IDENTICAL array passed to
    // bakeHeightCube — so router == renderer (single source). marginHeight = `composited || carrier.height`
    // (carrier.height + shelfDepth where the passive-margin channel is nonzero; carrier.height itself is
    // NEVER mutated), so it is generated DATA, never the sampler RTT readback (SPLIT-TRAP #5 still guarded).
    expect(body).toMatch(/const\s+bakedOn\s*=/);
    expect(body).toMatch(/height\s*=\s*marginHeight/);
    expect(body).toMatch(/grad\s*=\s*marginGrad/);
    // the composited source resolves to carrier.height on non-margin worlds — DATA, never sampler.read
    expect(body).toMatch(/const\s+marginHeight\s*=\s*composited\s*\|\|\s*carrier\.height/);
  });

  it('the carrier the router re-points to IS the array baked into the height cube (single source)', () => {
    // V2-4 slice-3: the SAME margin-composited array feeds BOTH the re-point (height = marginHeight) AND the
    // cube bake (bakeHeightCube({ ..., height: marginHeight, ... })). One field, one cube, both consumers.
    // The relief WRITER is the AC5 regime gate writeBodyRelief(carrier, ...) — despun (writeGrainSphere+
    // writeHeightSphere) OR plate (writePlateUpliftSphere); either way it writes carrier.height, which the
    // margin composite READS (adding the own shelfDepth channel) WITHOUT mutating it. Single source preserved.
    expect(body).toMatch(/const\s+carrier\s*=\s*makeSphereField\(/);
    expect(body).toMatch(/writeBodyRelief\(\s*carrier/);
    expect(body).toMatch(/bakeHeightCube\(\{[\s\S]{0,120}height:\s*marginHeight/);
  });

  it('the strength-0 fallback PRESERVES the legacy in-shader RTT (sampler.read still wired in route())', () => {
    // Do NOT delete the legacy path — strength 0 ⇒ byte-identical fallback. The else branch must still
    // call sampler.read() and assign height/grad from it.
    expect(body).toMatch(/sampler\.read\(\)/);
    expect(body).toMatch(/else\b/);
  });

  it('createHeightSampler + ROUTER_MAIN are still present in the module (fallback machinery intact)', () => {
    expect(riversSrc).toMatch(/export function createHeightSampler\b/);
    expect(riversSrc).toMatch(/ROUTER_MAIN/);
    // ensureMesh still builds the legacy sampler the fallback uses.
    expect(riversSrc).toMatch(/sampler\s*=\s*createHeightSampler\(/);
  });

  it('the module introduces NO Math.random / Date.now (determinism, G6 — seed via the alea PRNG only)', () => {
    // Scan CODE only — the module's comments legitimately mention "no Math.random / no Date.now".
    const code = stripComments(riversSrc);
    expect(code, 'planet-lod-rivers.js must not call Math.random').not.toMatch(/Math\.random/);
    expect(code, 'planet-lod-rivers.js must not call Date.now').not.toMatch(/Date\.now/);
  });
});
