// Capture the PRE-REWIRE values straight out of `git show HEAD:planet-lod-lab.html`, so the byte-
// inertness oracle is literals from the real prior build — not a substitution on the live source.
import { execSync } from 'node:child_process';
import { DRIVER_PRESETS, drawPresetRadius } from '../../../../driver-presets.js';
import { deriveConditionVector } from '../../../../src/worldengine/base/conditionVector.js';
import { deriveUniforms } from '../../../../src/worldengine/base/labCore.js';

const OLD = execSync('git show HEAD:planet-lod-lab.html', { cwd: new URL('../../../../', import.meta.url).pathname, maxBuffer: 64 * 1024 * 1024 }).toString();
const NEW_SRC = (await import('node:fs')).readFileSync(new URL('../../../../planet-lod-lab.html', import.meta.url), 'utf8');
const TIER = 1.0;
const PRESETS = Object.keys(DRIVER_PRESETS);

const grab = (src, re, label) => { const m = src.match(re); if (!m) throw new Error('no match: ' + label); return m[1].trim(); };
const mkE = (s) => new Function('env', `const { state, _fp, _gas, _rotH, _gcond, _scond } = env; return (${s});`);
const mkB = (s) => new Function('env', `const { state, _fp, _gas, _rotH, _gcond, _scond } = env;\n${s}\nreturn _cloudRegime;`);

const envFor = (p, R) => {
  const _fp = DRIVER_PRESETS[p];
  const u = deriveUniforms(_fp, TIER);
  const cond = deriveConditionVector(_fp, u, R);
  return { state: { planetRadiusEarth: R }, _fp, _gcond: cond, _scond: cond,
           _gas: _fp.atmosphere?.composition === 'h2-he', _rotH: _fp.rotationHours ?? 24 };
};

const OLD_band   = mkE(grab(OLD, /state\.bandCount\s*=\s*(.+?);\s*$/m, 'old bandCount'));
const NEW_band   = mkE(grab(NEW_SRC, /state\.bandCount\s*=\s*(.+?);\s*$/m, 'new bandCount'));
const OLD_dyn    = mkE(grab(OLD, /const\s+_giantDynamo\s*=\s*(.+?);/, 'old dynamo'));
const NEW_dyn    = mkE(grab(NEW_SRC, /const\s+_giantDynamo\s*=\s*(.+?);/, 'new dynamo'));
const OLD_reg    = mkB(grab(OLD, /(let _cloudRegime = 0;[\s\S]*?;)\s*\n\s*state\.cloudRegime = _cloudRegime;/, 'old regime'));
const NEW_reg    = mkB(grab(NEW_SRC, /(let _cloudRegime = 0;[\s\S]*?;)\s*\n\s*state\.cloudRegime = _cloudRegime;/, 'new regime'));
const OLD_rad    = mkE(OLD.split('\n').filter((l) => /^\s*radius:\s*.*\/\s*11\.2\s*,/.test(l))[0].match(/radius:\s*(.*?)\s*,\s*(?:\/\/.*)?$/)[1]);
const NEW_rad    = mkE(NEW_SRC.split('\n').filter((l) => /^\s*radius:\s*.*\/\s*11\.2\s*,/.test(l))[0].match(/radius:\s*(.*?)\s*,\s*(?:\/\/.*)?$/)[1]);

console.log('// PRE-REWIRE VALUES, captured from `git show HEAD:planet-lod-lab.html` (commit 710f8a2).');
console.log('// [preset]: [bandCount, cloudRegime, giantDynamo, e5RadiusDriver]');
console.log('const PRE_REWIRE = {');
for (const p of PRESETS) {
  const env = envFor(p, DRIVER_PRESETS[p].radiusEarth ?? 1);
  console.log(`  ${JSON.stringify(p)}: [${OLD_band(env)}, ${OLD_reg(env)}, ${OLD_dyn(env)}, ${OLD_rad(env)}],`);
}
console.log('};');

console.log('\n// BOOT DISCLOSURE — the lab default (radiusSeed 1), OLD vs NEW at each rewired site.');
console.log('preset'.padEnd(30), 'Rc'.padStart(6), 'Rdrawn'.padStart(9), '| band O->N | regime O->N | dynamo O->N');
const deltas = [];
for (const p of PRESETS) {
  const Rc = DRIVER_PRESETS[p].radiusEarth ?? 1;
  const Rd = drawPresetRadius(p, 1, { labUnlock: true });
  const eo = envFor(p, Rc), en = envFor(p, Rd);
  const row = { p, Rc, Rd,
    bandO: OLD_band(eo), bandN: NEW_band(en),
    regO: OLD_reg(eo), regN: NEW_reg(en),
    dynO: OLD_dyn(eo), dynN: NEW_dyn(en) };
  deltas.push(row);
  const chg = (row.bandO !== row.bandN || row.regO !== row.regN || row.dynO !== row.dynN) ? '  *** CHANGES AT BOOT' : '';
  console.log(p.padEnd(30), String(Rc).padStart(6), Rd.toFixed(4).padStart(9),
    `| ${row.bandO}->${row.bandN}`.padEnd(12), `| ${row.regO}->${row.regN}`.padEnd(12), `| ${row.dynO}->${row.dynN}`.padEnd(16), chg);
}
console.log('\npresets changing at least one rewired site at boot:',
  deltas.filter((r) => r.bandO !== r.bandN || r.regO !== r.regN || r.dynO !== r.dynN).length, '/', PRESETS.length);
