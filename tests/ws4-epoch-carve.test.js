// ws4-epoch-carve.test.js — WS4 T12, AC `epoch-carve-visible` (integration, live).
//
// THE GATE IS A NUMERIC HEIGHT DROP, NOT A SCREENSHOT (plan §T12 / D5c, critic feasibility BLOCKER).
// The lab already has a COSMETIC valley-floor darkening (Stage 6 `carveFloorCol`) that makes valleys LOOK
// cut with NO height drop — that is exactly the failure mode this AC exists to catch ("genuinely lower,
// not just darkened", intent success #2). So `epoch-carve-visible` binds to a per-direction HEIGHT
// READBACK that must DECREASE at channel-node directions when the carve epoch turns on, while off-channel
// directions stay ~equal. A colour screenshot is supplementary (Max's eye), never the pass condition.
//
// WHAT T12 ADDS (the remaining piece — the probes from T12-probe already exist): a carve-EPOCH TOGGLE on
// `window._lab` that gates whether `_lab.sampleRoutedHeight(dirs)` returns the AUTHORED routed substrate
// (epoch 1, carve OFF) or the CARVED field `applyIncision(authored, perNodeIncision(routed, authored))`
// (epoch 2, carve ON). Per plan §D5c there is NO rendered-chain sampler in WS4 (that is the deferred
// T12b); the readback is the ROUTER_MAIN field the carve is computed over (`riverOverlay.height` + the
// routed graph), so the readback witnesses the SAME `perNodeIncision` Δ≤0 the unit (ws4-carve-subtractive,
// ws4-epoch) already proved subtractive. T12 wires that proven law behind the live epoch toggle.
//
// THIS FILE HAS TWO HALVES:
//   (A) HEADLESS NUMERIC PROOF (real, runnable here): re-run the EXACT composition the toggle wires —
//       `applyIncision(authored, perNodeIncision({mesh,routed,authored}))` — over a synthetic-mesh harness
//       (the same hydration as ws4-carve-subtractive/ws4-epoch) and prove the readback at channel-node
//       directions STRICTLY DECREASES vs the authored field, while off-channel nodes are UNCHANGED. This
//       is the mechanism the live AC observes; proving it headless catches the cosmetic-darkening failure
//       mode at the unit level (a darkening-only carve would leave height EQUAL → this test would fail).
//   (B) SOURCE-SCAN of the `_lab` block (page-scoped JS, un-runnable headless — same approach as
//       ws4-lab-probes.test.js): assert the epoch toggle exists, that `sampleRoutedHeight` routes through
//       `perNodeIncision`/`applyIncision` when the epoch is ON, that the helpers are imported from
//       rivers.js, and that the epoch-carve path introduces NO Math.random / Date.now (HARD RULE).
//
// The genuinely live-only part — flipping the toggle on the REAL GPU overlay on :9223 over a BUILT relief
// and reading a numeric drop at real channel directions — is listed under liveDeferred (never faked here).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import {
  buildIrregularSphere, routeAndOrder, perNodeIncision, applyIncision, DEFAULT_PARAMS,
} from '../planet-lod-rivers.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const labSrc = readFileSync(path.resolve(__dirname, '../planet-lod-lab.html'), 'utf8');

// ── shared harness (mirrors ws4-carve-subtractive / ws4-epoch: hydrate + synthetic field + ocean mask) ──
function hydrateMesh(mesh) {
  const N = mesh.verts.length;
  const pos = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {
    pos[i * 3] = mesh.verts[i][0];
    pos[i * 3 + 1] = mesh.verts[i][1];
    pos[i * 3 + 2] = mesh.verts[i][2];
  }
  mesh.pos = pos;
  mesh.N = N;
  return mesh;
}
function syntheticField(mesh) {
  const N = mesh.N;
  const height = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    const x = mesh.pos[i * 3], y = mesh.pos[i * 3 + 1], z = mesh.pos[i * 3 + 2];
    height[i] =
      0.55 * Math.sin(3.0 * x + 1.3) * Math.cos(2.0 * y - 0.7) +
      0.30 * Math.sin(5.0 * z + 0.4) +
      0.20 * Math.cos(4.0 * x - 2.0 * z) +
      0.15 * Math.sin(7.0 * y + 1.1) * Math.sin(6.0 * x);
  }
  return height;
}
function oceanMaskByFraction(height, frac) {
  const N = height.length;
  const sorted = Float32Array.from(height).sort();
  const thr = sorted[Math.floor(frac * N)];
  const isOcean = new Uint8Array(N);
  for (let i = 0; i < N; i++) isOcean[i] = height[i] <= thr ? 1 : 0;
  return isOcean;
}
const PARAMS = { ...DEFAULT_PARAMS, TARGET_N: 2000, LLOYD_ITERS: 2 };

// Replicate the EXACT readback composition the _lab epoch toggle wires: nearest-mesh-node (max dot) lookup
// into a per-node height field. This mirrors sampleRoutedHeight's loop so the headless proof exercises the
// SAME mapping the live probe uses.
function sampleAtDirs(mesh, field, dirs) {
  const verts = mesh.verts, N = verts.length;
  const out = new Float64Array(dirs.length);
  for (let k = 0; k < dirs.length; k++) {
    const d = dirs[k];
    const dl = Math.hypot(d[0], d[1], d[2]) || 1;
    const dx = d[0] / dl, dy = d[1] / dl, dz = d[2] / dl;
    let best = -2, bi = 0;
    for (let i = 0; i < N; i++) {
      const v = verts[i];
      const dot = v[0] * dx + v[1] * dy + v[2] * dz;
      if (dot > best) { best = dot; bi = i; }
    }
    out[k] = field[bi];
  }
  return out;
}

function buildRouted() {
  const mesh = hydrateMesh(buildIrregularSphere(PARAMS.TARGET_N, PARAMS.LLOYD_ITERS));
  const authored = syntheticField(mesh);
  const isOcean = oceanMaskByFraction(authored, 0.35);
  const routed = routeAndOrder({ mesh, height: authored, grad: null, isOcean, params: PARAMS });
  return { mesh, authored, isOcean, routed };
}

describe('WS4 T12 (A) — the epoch-carve composition is a REAL numeric height drop at channel dirs', () => {
  const { mesh, authored, routed } = buildRouted();
  // epoch 2 = the field the toggle returns when carve is ON: authored + perNodeIncision (the proven Δ≤0).
  const incision = perNodeIncision({ mesh, routed, authored, params: PARAMS });
  const carved = applyIncision(authored, incision);

  // channel directions = the mesh-node directions where the carve actually incises (isChannel & Δ<0);
  // off-channel = nodes the carve leaves untouched. The readback must DROP on the former, hold on the latter.
  const channelDirs = [], flatDirs = [];
  for (let i = 0; i < mesh.N && (channelDirs.length < 24 || flatDirs.length < 24); i++) {
    const dir = [mesh.verts[i][0], mesh.verts[i][1], mesh.verts[i][2]];
    if (incision[i] < -1e-6 && channelDirs.length < 24) channelDirs.push(dir);
    else if (incision[i] === 0 && flatDirs.length < 24) flatDirs.push(dir);
  }

  it('has real channel nodes to probe (the proof is non-vacuous)', () => {
    expect(channelDirs.length).toBeGreaterThan(0);
    expect(flatDirs.length).toBeGreaterThan(0);
  });

  it('readback at channel dirs DECREASES carve-on vs carve-off (the cosmetic-darkening failure mode fails here)', () => {
    const hOff = sampleAtDirs(mesh, authored, channelDirs);
    const hOn = sampleAtDirs(mesh, carved, channelDirs);
    for (let k = 0; k < channelDirs.length; k++) {
      // strict drop — a darkening-only carve (no height change) would leave hOn === hOff and FAIL this.
      expect(hOn[k]).toBeLessThan(hOff[k]);
    }
  });

  it('readback at off-channel dirs is UNCHANGED carve-on vs carve-off (carve is local to drainage)', () => {
    const hOff = sampleAtDirs(mesh, authored, flatDirs);
    const hOn = sampleAtDirs(mesh, carved, flatDirs);
    for (let k = 0; k < flatDirs.length; k++) {
      expect(hOn[k]).toBe(hOff[k]); // off-channel Δ=0 ⇒ byte-identical readback
    }
  });

  it('the carved readback is NEVER above the authored readback at any probed dir (monotone non-increasing)', () => {
    const allDirs = channelDirs.concat(flatDirs);
    const hOff = sampleAtDirs(mesh, authored, allDirs);
    const hOn = sampleAtDirs(mesh, carved, allDirs);
    for (let k = 0; k < allDirs.length; k++) expect(hOn[k] - hOff[k]).toBeLessThanOrEqual(1e-9);
  });
});

// Pull a single JS function/method body out of the lab source by walking matched braces (same helper as
// ws4-lab-probes.test.js) so per-method assertions don't bleed into neighbouring methods.
function bodyAfter(src, marker) {
  const start = src.indexOf(marker);
  expect(start, `"${marker}" must be present in planet-lod-lab.html`).toBeGreaterThanOrEqual(0);
  const open = src.indexOf('{', start);
  let depth = 0, i = open;
  for (; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') { depth--; if (depth === 0) { i++; break; } }
  }
  return src.slice(start, i);
}

describe('WS4 T12 (B) — the _lab carve-epoch toggle wires the proven law behind the readback', () => {
  it('imports perNodeIncision + applyIncision from planet-lod-rivers.js (the readback uses the real law)', () => {
    expect(labSrc).toMatch(/import\s*\{[^}]*\bperNodeIncision\b[^}]*\}\s*from\s*['"]\.\/planet-lod-rivers\.js['"]/);
    expect(labSrc).toMatch(/import\s*\{[^}]*\bapplyIncision\b[^}]*\}\s*from\s*['"]\.\/planet-lod-rivers\.js['"]/);
  });

  it('_lab exposes a carve-epoch toggle (setCarveEpoch + carveEpoch read-back)', () => {
    // the epoch toggle the live AC flips off→on. A setter (gates the readback) + a getter (probe state).
    expect(labSrc).toMatch(/setCarveEpoch\s*\(\s*\w*\s*\)\s*\{/);
    expect(labSrc).toMatch(/get\s+carveEpoch\s*\(\s*\)\s*\{/);
  });

  it('sampleRoutedHeight returns the CARVED field when the epoch is ON, the AUTHORED field when OFF', () => {
    const body = bodyAfter(labSrc, 'sampleRoutedHeight(dirs)');
    // still reads the overlay's routed substrate (ov.height) — honest per D5c (ROUTER_MAIN, not rendered).
    expect(body).toMatch(/=\s*riverOverlay\b/);
    expect(body).toMatch(/\bov\.height\b/);
    // when the epoch is ON it folds the proven law onto a FRESH array via applyIncision(authored,
    // perNodeIncision(...)) — so the readback witnesses the SAME Δ≤0 the unit proved subtractive.
    expect(body).toMatch(/carveEpoch/);
    expect(body).toMatch(/perNodeIncision\s*\(/);
    expect(body).toMatch(/applyIncision\s*\(/);
    // the incision needs the routed graph — the overlay retains it as ov.routed.
    expect(body).toMatch(/\bov\.routed\b/);
    // still a nearest-mesh-node (max dot) lookup returning a numeric array.
    expect(body).toMatch(/dot/i);
    expect(body).toMatch(/return\b/);
  });

  it('the epoch-carve readback path introduces NO Math.random / Date.now (HARD RULE — deterministic)', () => {
    const body = bodyAfter(labSrc, 'sampleRoutedHeight(dirs)');
    expect(body).not.toMatch(/Math\.random/);
    expect(body).not.toMatch(/Date\.now/);
  });
});
