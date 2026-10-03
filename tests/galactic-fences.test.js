// Galactic Engine S1 — lab-wired-to-game fences (AC-3, AC-13 CPU half).
// Each fence is a named checker that runs on the real tree AND on a committed broken control that must fail.
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { GalacticMap } from '../src/generation/GalacticMap.js';
import { findCloudSubjects, pickVolumeFeature } from '../src/galactic/subjects.js';
import { serializePack } from '../src/galactic/renderPacks.js';
import { buildPack } from '../src/rendering/galactic/GalacticController.js';
import { integrateRay, applyColourMode, luminance } from '../src/galactic/cloudFieldCPU.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => readFileSync(path.join(ROOT, rel), 'utf8');

// ── Fence 1: the lab imports only from ./src (plus the two libraries) and holds no shader/derivation text ──
function checkLabBoundary(source) {
  const specs = [...source.matchAll(/^\s*import\s[^'"]*['"]([^'"]+)['"]/gm)].map((m) => m[1]);
  const bad = specs.filter((s) => !(s.startsWith('./src/') || s === 'three' || s === 'lil-gui'));
  if (bad.length) throw new Error(`lab imports outside ./src: ${bad.join(', ')}`);
  for (const marker of ['void main(', 'gl_FragColor', 'uniform ', 'precision highp', 'featureHistory(', 'renderPack(']) {
    if (source.includes(marker)) throw new Error(`lab contains logic/shader text: '${marker}'`);
  }
  if (!source.includes('mountGalacticEngine(')) throw new Error('lab does not mount the production controller');
  return specs;
}

// ── Fence 2: each cloud shader chunk exists in exactly one file ──
const SHADER_MARKERS = ['void integrateCloud(', 'float logStructure(', 'uint hashU(', 'void sampleMedium(', 'vec3 applyColourMode(',
  'vec3 cloudAtlasDirection(', 'vec2 cloudAtlasUV(', 'float cloudDepthCDF(', 'vec3 cloudStarTransmittance('];
const SHADER_HOME = 'src/galactic/shaders/cloudField.glsl.js';

function listSources() {
  const out = [];
  const walk = (dir) => {
    for (const name of readdirSync(path.join(ROOT, dir))) {
      const rel = path.join(dir, name);
      if (statSync(path.join(ROOT, rel)).isDirectory()) walk(rel);
      else if (/\.(js|mjs|html)$/.test(name)) out.push(rel);
    }
  };
  walk('src');
  for (const name of readdirSync(ROOT)) if (/\.(js|mjs|html)$/.test(name)) out.push(name);
  return out;
}

function checkShaderOnce(files /* [{rel, text}] */) {
  for (const marker of SHADER_MARKERS) {
    const homes = files.filter((f) => f.text.includes(marker)).map((f) => f.rel);
    if (homes.length !== 1 || homes[0] !== SHADER_HOME) throw new Error(`'${marker}' found in: ${homes.join(', ') || 'nowhere'}`);
  }
}

// ── Fence 3: lab entry and game entry produce identical serialized params for the same feature ──
const gm = new GalacticMap();
const lab = findCloudSubjects(gm); // the lab's entry: subjects near the Sun
function gameEntryFeature(subject) {
  // The game's entry: you warped to it, so the sky is rebuilt AT its centre and the picker chooses it.
  return pickVolumeFeature(gm.findNearbyFeatures(subject.position, 3.0));
}
function checkPackParity(labFeature, gameFeature, mode) {
  const a = serializePack(buildPack(labFeature, mode));
  const b = serializePack(buildPack(gameFeature, mode));
  if (a !== b) throw new Error(`pack parity broken for ${labFeature.seed} (${mode})`);
}

// ── Fence 4: Realistic vs Photo — less saturated, same luminance ──
function renderImage(pack, mode, n = 20) {
  const p = { ...pack, colourMode: mode };
  const d = 3 * pack.radiusPc, half = Math.atan(1.2 * pack.radiusPc / d);
  const px = [];
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const ax = ((x + 0.5) / n * 2 - 1) * half, ay = ((y + 0.5) / n * 2 - 1) * half;
    const rd = [Math.tan(ax), Math.tan(ay), -1];
    const len = Math.hypot(...rd);
    const { L } = integrateRay(p, [0, 0, d], rd.map((v) => v / len), 32);
    px.push(applyColourMode(L, p));
  }
  return px;
}
const saturation = (c) => { const mx = Math.max(...c), mn = Math.min(...c); return mx > 0 ? (mx - mn) / mx : 0; };
const LUM_TOL = 1 / 255;

function checkColourModes(realistic, photo) {
  const lit = photo.map((c, i) => i).filter((i) => luminance(photo[i]) > 1e-3);
  if (lit.length < 10) throw new Error('nebula covers too few pixels');
  const mean = (img) => lit.reduce((s, i) => s + saturation(img[i]), 0) / lit.length;
  const sR = mean(realistic), sP = mean(photo);
  if (!(sR < sP)) throw new Error(`realistic saturation ${sR.toFixed(3)} not below photo ${sP.toFixed(3)}`);
  const dLum = Math.max(...lit.map((i) => Math.abs(luminance(realistic[i]) - luminance(photo[i]))));
  if (dLum > LUM_TOL) throw new Error(`luminance differs by ${dLum} > ${LUM_TOL}`);
  return { sR, sP, dLum };
}

describe('fence: the lab is a camera + sliders over src/', () => {
  const labSrc = read('galactic-cloud-lab.main.js');
  it('lab imports only from ./src and holds no shader or derivation code', () => {
    expect(() => checkLabBoundary(labSrc)).not.toThrow();
    expect(read('galactic-cloud-lab.html')).toContain('galactic-cloud-lab.main.js');
  });
  it('BROKEN CONTROL: a lab with a local helper import fails', () => {
    expect(() => checkLabBoundary(labSrc + "\nimport { x } from './galactic-cloud-lab.helpers.js';\n")).toThrow(/outside \.\/src/);
  });
  it('BROKEN CONTROL: a lab with its own shader text fails', () => {
    expect(() => checkLabBoundary(labSrc + '\nconst frag = `void main() { gl_FragColor = vec4(1.0); }`;\n')).toThrow(/shader text/);
  });
});

describe('fence: the cloud GLSL exists in exactly one file', () => {
  const files = listSources().map((rel) => ({ rel, text: read(rel) }));
  it(`every cloud shader chunk lives only in ${SHADER_HOME}`, () => {
    expect(() => checkShaderOnce(files)).not.toThrow();
  });
  it('BROKEN CONTROL: a copied chunk in a second file fails', () => {
    const copy = { rel: 'src/rendering/galactic/Copy.js', text: 'const s = `float logStructure(vec3 pl) {}`;' };
    expect(() => checkShaderOnce([...files, copy])).toThrow(/logStructure/);
  });
});

describe('fence: lab entry and game entry give identical render params', () => {
  for (const name of ['procedural', 'orion']) {
    for (const mode of ['realistic', 'photo']) {
      it(`${name} (${mode})`, () => {
        const g = gameEntryFeature(lab[name]);
        expect(g.seed).toBe(lab[name].seed);
        expect(() => checkPackParity(lab[name], g, mode)).not.toThrow();
      });
    }
  }
  it('BROKEN CONTROL: an altered input (radius) fails parity by name', () => {
    const altered = { ...lab.procedural, radius: lab.procedural.radius * 1.01 };
    expect(() => checkPackParity(lab.procedural, altered, 'photo')).toThrow(/pack parity broken for .*emission-nebula/);
  });
});

describe('fence: Realistic vs Photo (CPU render through the shared integrator)', () => {
  const pack = buildPack(lab.procedural, 'photo');
  const photo = renderImage(pack, 'photo');
  const realistic = renderImage(pack, 'realistic');
  it('realistic is less saturated; luminance equal within 1/255', () => {
    expect(() => checkColourModes(realistic, photo)).not.toThrow();
  });
  it('BROKEN CONTROL: a "realistic" that is also dimmed fails the luminance check', () => {
    expect(() => checkColourModes(realistic.map((c) => c.map((v) => v * 0.5)), photo)).toThrow(/luminance/);
  });
  it('BROKEN CONTROL: a "realistic" identical to photo fails the saturation check', () => {
    expect(() => checkColourModes(photo, photo)).toThrow(/saturation/);
  });
});

// Regression (2026-10-03, found live): rays built from the inverse projection were NaN on the GPU — the game's
// near plane is 1e-9 and in float32 the far-plane w cancels to exactly 0. Rays must come from the FOV.
import { cameraTanHalf } from '../src/rendering/galactic/GalacticController.js';
import { CLOUD_VOLUME_FRAG } from '../src/galactic/shaders/cloudField.glsl.js';
describe('volume ray basis', () => {
  it('does not depend on the near plane', () => {
    const cam = (near) => ({ fov: 70, aspect: 1.63, near, far: 200000 });
    expect(cameraTanHalf(cam(1e-9))).toEqual(cameraTanHalf(cam(0.1)));
    expect(cameraTanHalf(cam(1e-9))[1]).toBeCloseTo(Math.tan(35 * Math.PI / 180), 12);
  });
  it('the volume shader never builds rays from the inverse projection', () => {
    expect(CLOUD_VOLUME_FRAG).not.toMatch(/uInvProjection|projectionMatrixInverse/);
    expect(CLOUD_VOLUME_FRAG).toMatch(/uTanHalf/);
  });
});
