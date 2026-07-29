#!/usr/bin/env node
// AC-SAMPLER inertness comparator.
//
// Compares the DECODED pixel buffers of two captures, not the PNG containers — a PNG
// container can differ (encoder state, chunk order) while the image is identical, and it
// can match while the image is not. Any differing channel falsifies "byte-inert".
//
// Usage: node compare-frames.cjs A.png B.png [label]

const { PNG } = require('pngjs');
const fs = require('fs');
const crypto = require('crypto');

const [, , fa, fb, label = ''] = process.argv;
if (!fa || !fb) { console.error('usage: compare-frames.cjs A.png B.png [label]'); process.exit(2); }

const readPix = f => { const p = PNG.sync.read(fs.readFileSync(f)); return { data: p.data, w: p.width, h: p.height }; };
const h16 = x => crypto.createHash('sha256').update(x).digest('hex').slice(0, 16);

const A = readPix(fa), B = readPix(fb);
const out = { label, a: fa, b: fb, dimsA: [A.w, A.h], dimsB: [B.w, B.h], hashA: h16(A.data), hashB: h16(B.data) };

if (A.data.length !== B.data.length) {
  out.verdict = 'SIZE MISMATCH — not comparable';
  console.log(JSON.stringify(out, null, 1));
  process.exit(1);
}

let nChan = 0, maxDelta = 0, sumSq = 0;
const diffPx = new Set();
// Bounding box of the differing region, so a red result says WHERE as well as how much.
let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
const histogram = {}; // per-channel |delta| -> count
for (let i = 0; i < A.data.length; i++) {
  const d = Math.abs(A.data[i] - B.data[i]);
  if (!d) continue;
  nChan++; sumSq += d * d;
  if (d > maxDelta) maxDelta = d;
  histogram[d] = (histogram[d] || 0) + 1;
  const px = (i / 4) | 0;
  diffPx.add(px);
  const x = px % A.w, y = (px / A.w) | 0;
  if (x < minX) minX = x; if (x > maxX) maxX = x;
  if (y < minY) minY = y; if (y > maxY) maxY = y;
}

out.totalChannels = A.data.length;
out.differingChannels = nChan;
out.differingPixels = diffPx.size;
out.totalPixels = A.w * A.h;
out.fractionPixelsDiffering = +(diffPx.size / (A.w * A.h)).toFixed(8);
out.maxPerChannelDelta = maxDelta;
out.rmsOverDifferingChannels = nChan ? +Math.sqrt(sumSq / nChan).toFixed(4) : 0;
out.deltaHistogram = histogram;
out.diffBBox = nChan ? { minX, minY, maxX, maxY } : null;
out.verdict = nChan === 0 ? 'IDENTICAL' : 'DIFFERENT';

console.log(JSON.stringify(out, null, 1));
process.exit(nChan === 0 ? 0 : 1);
