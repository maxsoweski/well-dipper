// galactic-shape-contact-sheet.mjs — CPU-rendered A/B of the cloud shape (v1 ring vs v2 reshaped), six views each,
// for the procedural test nebula and Orion (M42). Prints the ring metrics and writes
// research/nebula-refs/shape-v1-vs-v2.png (labels added with python3 PIL when available).
//
//   node scripts/galactic-shape-contact-sheet.mjs [--n 96] [--out path.png]
//
// Rows: procedural v1, procedural v2, orion v1, orion v2. Columns: the six views of sixViews() (face-on front,
// face-on back, four sides). Exposure is shared between v1 and v2 of a subject, so brightness is comparable.
import { writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';
import { GalacticMap } from '../src/generation/GalacticMap.js';
import { findCloudSubjects } from '../src/galactic/subjects.js';
import { featureHistory } from '../src/galactic/featureHistory.js';
import { renderPack } from '../src/galactic/renderPacks.js';
import { renderOrtho, ringMetrics, sixViews, sourceDirectionGalactic, readsAsRing } from '../src/galactic/shapeMetrics.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const N = Number(arg('--n', 96));
const OUT = path.resolve(ROOT, arg('--out', 'research/nebula-refs/shape-v1-vs-v2.png'));
const OVERRIDES = JSON.parse(arg('--ov', '{}')); // v2 exploration: renderPackOverrides, e.g. '{"frontScale":0.6}'
const PER_ROW_EXPOSURE = process.argv.includes('--per-row-exposure');
const SCALE = 2, GAP = 4;

const gm = new GalacticMap('well-dipper-galaxy-1');
const subjects = findCloudSubjects(gm);
const rows = [];
const t0 = Date.now();
for (const name of ['procedural', 'orion']) {
  const h = featureHistory(subjects[name]);
  const p1 = renderPack(h, { overrides: {}, shapeVersion: 1 });
  const p2 = renderPack(h, { overrides: OVERRIDES, shapeVersion: 2 });
  const views = sixViews(sourceDirectionGalactic(p1));
  // Same framing for both versions: the larger of the two bounds.
  const halfPc = Math.max(p1.boundRadiusPc, p2.boundRadiusPc) * 1.02;
  const imgs = {};
  for (const [v, p] of [[1, p1], [2, p2]]) {
    imgs[v] = views.map((vw) => renderOrtho(p, vw.dir, { n: N, halfPc }));
  }
  const p995 = (ims) => { const a = ims.flatMap((im) => Array.from(im.Y)).sort((x, y) => x - y); return a[Math.floor(a.length * 0.995)]; };
  const shared = 1 / Math.max(p995([...imgs[1], ...imgs[2]]), 1e-12);
  for (const v of [1, 2]) {
    const expo = PER_ROW_EXPOSURE ? 1 / Math.max(p995(imgs[v]), 1e-12) : shared;
    console.log(`  ${name} v${v} p99.5 luminance ${p995(imgs[v]).toExponential(3)}`);
    const metrics = imgs[v].map((im) => ringMetrics(im));
    rows.push({ name, version: v, imgs: imgs[v], expo, metrics, views });
    console.log(`\n${name} v${v}  (blister ${h.blister.toFixed(2)}, axes ${h.axes.map((a) => a.toFixed(2)).join(':')}, lobeAmp ${h.lobeAmp.toFixed(2)})`);
    metrics.forEach((m, i) => console.log(`  ${views[i].name.padEnd(30)} ring ${m.ringRatio.toFixed(2).padStart(5)}  CV ${m.angularCV.toFixed(3)}  off ${m.centroidOff.toFixed(3)}  circ ${m.circularity.toFixed(2)}  aspect ${m.aspect.toFixed(2)}  meanY ${m.meanY.toExponential(2)}  ${readsAsRing(m) ? 'RING' : '-'}`));
  }
}
console.log(`\nrendered in ${((Date.now() - t0) / 1000).toFixed(1)} s`);

// ── PNG ──
const tile = N * SCALE;
const W = 6 * tile + 7 * GAP, H = rows.length * tile + (rows.length + 1) * GAP;
const png = new PNG({ width: W, height: H });
png.data.fill(0);
for (let i = 3; i < png.data.length; i += 4) png.data[i] = 255;
const tone = (v) => Math.round(255 * Math.min(1, Math.pow(Math.max(v, 0), 1 / 2.2)));
rows.forEach((row, r) => {
  row.imgs.forEach((im, c) => {
    const ox = GAP + c * (tile + GAP), oy = GAP + r * (tile + GAP);
    for (let y = 0; y < tile; y++) for (let x = 0; x < tile; x++) {
      const i = Math.floor(y / SCALE) * N + Math.floor(x / SCALE);
      const o = ((oy + y) * W + ox + x) * 4;
      for (let ch = 0; ch < 3; ch++) png.data[o + ch] = tone(im.rgb[i * 3 + ch] * row.expo);
    }
  });
});
writeFileSync(OUT, PNG.sync.write(png));

// Labels (optional): a header row and a left column, via PIL.
const labels = {
  rows: rows.map((r) => `${r.name} v${r.version}${r.version === 1 ? ' (ring)' : ''}`),
  cols: rows[0].views.map((v) => v.name),
  metrics: rows.map((r) => r.metrics.map((m) => `ring ${m.ringRatio.toFixed(2)} CV ${m.angularCV.toFixed(2)} circ ${m.circularity.toFixed(2)} asp ${m.aspect.toFixed(2)}`)),
  tile, gap: GAP,
};
try {
  execFileSync('python3', ['-c', `
import json, sys
from PIL import Image, ImageDraw
L = json.loads(sys.argv[2]); im = Image.open(sys.argv[1]).convert('RGB')
t, g = L['tile'], L['gap']; left, top = 150, 22
out = Image.new('RGB', (im.width + left, im.height + top), (0, 0, 0)); out.paste(im, (left, top))
d = ImageDraw.Draw(out)
for c, s in enumerate(L['cols']): d.text((left + g + c * (t + g) + 4, 5), s, fill=(200, 200, 200))
for r, s in enumerate(L['rows']):
    y = top + g + r * (t + g)
    d.text((6, y + t // 2 - 6), s, fill=(230, 230, 230))
    for c, m in enumerate(L['metrics'][r]): d.text((left + g + c * (t + g) + 4, y + t - 14), m, fill=(150, 220, 150))
out.save(sys.argv[1])
`, OUT, JSON.stringify(labels)]);
} catch (e) {
  console.warn('labels skipped (python3 + PIL not available):', e.message.split('\n')[0]);
}
console.log(`wrote ${path.relative(ROOT, OUT)}`);
