// tests/ws4-router-zero-drift.test.js — WS4 T15: router-lab zero-drift + both-poles + lakes gate.
//
// AC: router-zero-drift (integration, live=true).
//
// THE TASK (plan §T15): the router-lab regression is the standing zero-drift check that T10 — the
// ONLY WS4 touch to planet-lod-rivers.js (perNodeIncision/stream-power swap inside buildValleyGeometry's
// DEPTH, which is DOWNSTREAM of routeAndOrder) — must not break. Per the plan's "repo conventions that
// bite", a depthAt→stream-power swap CANNOT drift oceanPct/maxStrahler/orphanPct/uphillPct: those are
// properties of routeAndOrder, which T10 never touches. So the metric re-run is a SANITY CHECK; if any
// metric moves, the change leaked into routing (a bug), not a legitimate drift.
//
// WHY a SOURCE-SCAN, not a runtime route(): the regression page (rivers-terrain-lab.html →
// rivers-terrain-lab.main.js) needs a live WebGL renderer (createHeightSampler RTT readback) to produce
// window._rivers.stats — it cannot run headless in vitest (no DOM/WebGL). The numeric metrics
// (oceanPct≈35, maxStrahler≈5, orphanPct===0, uphillPct===0) are the LIVE :9223 gate, listed under
// liveDeferred and never faked here.
//
// WHAT T15 ADDS (the headless-assertable part): the orchestration task title extends the bare
// zero-drift gate to "both-poles + lakes". The existing window._rivers.stats exposes the four
// zero-drift metrics but NO numeric pole-region or lake read-out — so the both-poles/lakes half of the
// AC degrades to "does the screenshot look clean?", which the dossier (live-test discipline) warns is
// exactly the failure mode a numeric probe must replace. T15 budgets a `polesAndLakes()` probe on
// window._rivers that returns FALSIFIABLE numbers off the routed graph (pole-cap orphan/uphill counts
// from receiver/surf; lake/endorheic-basin count from filled>height + selfLoopLand), so the live gate
// reads back numbers, not pixels. This vitest gate asserts that probe EXISTS with the documented shape
// + wiring (reads routed graph fields, mesh.verts for the pole caps, no rng). The "probe returns finite
// numbers on a built relief" check is the LIVE-only :9223 smoke (verify phase), under liveDeferred.
//
// HARD RULE: no Date.now / Math.random in derivation. The probe reads the already-routed graph; it must
// not sprinkle rng of its own.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const mainSrc = readFileSync(path.resolve(__dirname, '../rivers-terrain-lab.main.js'), 'utf8');

// Pull a single JS function/method body out of the source by walking matched braces from the first `{`
// after `marker`, so per-probe assertions don't bleed into neighbouring methods.
function bodyAfter(src, marker) {
  const start = src.indexOf(marker);
  expect(start, `"${marker}" must be present in rivers-terrain-lab.main.js`).toBeGreaterThanOrEqual(0);
  const open = src.indexOf('{', start);
  let depth = 0, i = open;
  for (; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') { depth--; if (depth === 0) { i++; break; } }
  }
  return src.slice(start, i);
}

describe('WS4 T15 — router-lab zero-drift + both-poles + lakes gate', () => {
  it('still consumes the SHARED planet-lod-rivers.js module (zero-DRIFT: one source of the router)', () => {
    // The whole point of the regression: the router lab and the planet lab import the SAME
    // createRiverOverlay, so a T10 edit to the shared module is what the regression catches. If this
    // import drifts to a private copy, the gate stops guarding the shipped router.
    expect(mainSrc).toMatch(/import\s*\{[^}]*\bcreateRiverOverlay\b[^}]*\}\s*from\s*['"]\.\/planet-lod-rivers\.js['"]/);
  });

  it('exposes window._rivers.stats — the four zero-drift metrics the live gate reads', () => {
    // The metrics (oceanPct/maxStrahler/orphanPct/uphillPct) come off buildStats via lastStats; the
    // live gate asserts them on :9223. Here we only confirm the surface still exists for the live read.
    expect(mainSrc).toMatch(/window\._rivers\s*=/);
    expect(mainSrc).toMatch(/get\s+stats\s*\(\s*\)\s*\{[^}]*lastStats/);
    expect(mainSrc).toMatch(/__riversTerrainReady\s*=\s*true/);
  });

  it('_rivers.polesAndLakes() exists and returns the documented pole-cap + lake read-out shape', () => {
    // The both-poles + lakes half of the AC needs NUMERIC read-back, not a screenshot. The probe walks
    // the routed graph (retained on the overlay) + mesh.verts and returns per-pole orphan/uphill counts
    // and an endorheic-basin (lake) count.
    expect(mainSrc).toMatch(/polesAndLakes\s*\(\s*\)\s*\{/);
    const body = bodyAfter(mainSrc, 'polesAndLakes()');
    // it must read the routed graph the overlay retains (receiver/surf/filled/isOcean/selfLoopLand),
    // exposed via overlay.routed (the retained graph), NOT recompute its own routing.
    expect(body).toMatch(/overlay\.routed\b/);
    // pole caps are identified by mesh vertex y near ±1 (the sphere poles) — the "both poles clean" read.
    expect(body).toMatch(/mesh\b/);
    expect(body).toMatch(/verts\b/);
    // returns an object naming both pole caps + a lake/basin count.
    expect(body).toMatch(/north/i);
    expect(body).toMatch(/south/i);
    expect(body).toMatch(/lake|basin|endorheic/i);
    expect(body).toMatch(/return\b/);
  });

  it('the pole-cap read uses the routed graph orphan/uphill condition (clean = 0), not pixels', () => {
    const body = bodyAfter(mainSrc, 'polesAndLakes()');
    // "clean pole" = no orphaned (never-reaches-ocean) and no uphill receiver edges in the cap. The
    // probe re-uses the routed graph's own fields (receiver + the surf closure) so it matches the
    // committed AC2/AC3 router definition exactly (no second routing implementation to drift).
    expect(body).toMatch(/receiver\b/);
    expect(body).toMatch(/isOcean\b/);
  });

  it('the lake read counts endorheic basins from filled>height (priority-flood) + selfLoopLand', () => {
    const body = bodyAfter(mainSrc, 'polesAndLakes()');
    // priority-flood RAISES height to filled at internally-drained basins (filled[i] > height[i]); those
    // filled cells + the land sinks (selfLoopLand) are the lakes. "lakes intact" = a nonzero, stable
    // count — the probe surfaces it so the live gate reads a number, not a colour.
    expect(body).toMatch(/filled\b/);
    expect(body).toMatch(/height\b/);
  });

  it('the probe introduces NO Math.random / Date.now (it reads the already-routed graph)', () => {
    const body = bodyAfter(mainSrc, 'polesAndLakes()');
    expect(body, 'polesAndLakes must not call Math.random').not.toMatch(/Math\.random/);
    expect(body, 'polesAndLakes must not call Date.now').not.toMatch(/Date\.now/);
  });
});
