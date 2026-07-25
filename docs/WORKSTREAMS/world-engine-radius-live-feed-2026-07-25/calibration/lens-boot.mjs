// Verify finding [1]/[4]: does the lab's default boot draw a NON-canonical radius?
import { DRIVER_PRESETS, drawPresetRadius, NAMED_BODY, PRESET_ARCHETYPE } from '../../../../driver-presets.js';

const SEED = 1;   // planet-lod-lab.html:2004  radiusSeed: 1
const rows = [];
for (const p of Object.keys(DRIVER_PRESETS)) {
  const canon = DRIVER_PRESETS[p].radiusEarth ?? 1;
  const drawn = drawPresetRadius(p, SEED, { labUnlock: true });   // == the lab's :3010 call
  rows.push({ p, canon, drawn, named: NAMED_BODY.has(p), inert: Object.is(canon, drawn) });
}
let nonInert = 0;
for (const r of rows) {
  if (!r.inert) nonInert++;
  console.log(
    r.p.padEnd(32),
    String(r.canon).padStart(8),
    r.drawn.toFixed(6).padStart(12),
    r.inert ? 'INERT' : 'CHANGES',
    r.named ? '(NAMED_BODY)' : '');
}
console.log(`\nnon-inert presets at seed ${SEED}: ${nonInert} / ${rows.length}`);
