#!/usr/bin/env node
/**
 * INSTRUMENT E — numeric coverage for the SHIPPED conic fragment shader.
 * (orbit-ring-phantom-2026-08-11; closes docs/FEATURES/orbit-ring-depth-artefact.md §3)
 *
 * ⛔ WHAT §3 RECORDED, AND WHY THIS EXISTS
 * `CONIC_FRAGMENT_SHADER` — the fullscreen pass every orbit ring is painted by — was NEVER
 * EXECUTED BY ANY TEST. A refuter mutated it four ways, including multiplying every root's
 * clip-w by 0.37, and ALL 102 tests in the conic family stayed green. The JS helpers that ARE
 * tested (`ringCircleDepthW`, `ringDepthW`) have no production caller. §3 calls closing this
 * "the highest-value thing to close in this file, ahead of the artefact itself", and §4 records
 * that the one fix attempted here was refuted 3/3 precisely because it was validated on a twin.
 *
 * ⭐ THIS EXECUTES THE SHIPPED STRING. It imports CONIC_FRAGMENT_SHADER from the module the game
 * ships, compiles it in a real WebGL2 context (headless Chrome + ANGLE/SwiftShader), renders it,
 * and asserts on floats read back out of an RGBA32F colour attachment AND a DEPTH_COMPONENT32F
 * depth texture. Editing the GLSL changes the function under test BY CONSTRUCTION.
 *
 * ⭐⭐ READING THE DEPTH ATTACHMENT IS NOT OPTIONAL. §3's named mutant (every root's clip-w × 0.37)
 * is COVERAGE-IDENTICAL to the original — measured 1671 painted px / 3 rows, both. It is separated
 * ONLY by the recovered wclip range. A harness that scores "which pixels got painted" and stops
 * there rebuilds the exact blindness §3 documents. WebGL2 forbids readPixels on a depth
 * attachment, so pass 2 blits it through texelFetch into RGBA32F.
 *
 * ⚠ CHROME IS AN UNDECLARED EXTERNAL PREREQUISITE, and it CANNOT LAUNCH INSIDE THE AGENT SANDBOX
 * (`socket() failed: Operation not permitted`; no flag fixes it — it is the network policy). Run
 * from a normal terminal, or an agent shell with the sandbox disabled. Missing Chrome THROWS; it
 * never skips. A gate that skips is a dead gate — the same green-means-nothing failure as §3.
 *
 * ⚠ NOT A VITEST FILE ON PURPOSE. `npm test` is `vitest run` with no include filter, so a
 * `*.test.js` here would be collected by the default suite and fail everywhere Chrome is absent,
 * turning Instrument A permanently red. It follows the repo's tool+script idiom instead
 * (cf. port-uniform-delta): `npm run check:conic-gl`.
 *
 * Usage:  npm run check:conic-gl            (exit 0 = gate closed, 1 = a mutant survived)
 *         CHROME_BIN=/path/to/chrome npm run check:conic-gl
 */
import * as THREE from 'three';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import {
  OrbitConicField, CONIC_VERTEX_SHADER, CONIC_FRAGMENT_SHADER, CONIC_MAX, CONIC_TEX_ROWS,
} from '../src/objects/OrbitConicField.js';

// The game's real sceneTarget at pixelScale 3 (1671x855 / 3). The conic math runs in RENDER-TARGET
// pixels — a probe in CSS coordinates measures nothing, which is a mistake already made once.
const W = 557, H = 285, FOV = 70, NEAR = 0.01, FAR = 2e5;
const R = 6748.05;   // the outermost planet's orbit in seed lab-procedural-6 — Max's own repro ring

const CHROME = process.env.CHROME_BIN ?? '/usr/bin/google-chrome';

// ── fixtures ────────────────────────────────────────────────────────────────────────────────────
// Each pose packs REAL rings through the REAL OrbitConicField.update(), so the texture the shader
// samples is the one the game builds.
function build(name, rings, camPos, lookAt) {
  const cam = new THREE.PerspectiveCamera(FOV, W / H, NEAR, FAR);
  cam.position.set(...camPos); cam.up.set(0, 1, 0); cam.lookAt(...lookAt);
  cam.updateMatrixWorld(true); cam.updateProjectionMatrix();
  const f = new OrbitConicField();
  f.update(rings.map((r) => ({
    matrixWorld: r.matrixWorld ?? new THREE.Matrix4(),
    radius: r.radius, color: r.color, alpha: 0.8, active: true,
  })), cam, { width: W, height: H });
  const u = f.material.uniforms;
  const per = rings.map((r, i) => {
    const c = f.readConic(i);
    const sp = r.radius * Math.hypot(c.rowW[0], c.rowW[1]);
    return {
      R: r.radius, Hinv: Array.from(c.Hinv), rowW: Array.from(c.rowW),
      bounds: Array.from(c.bounds), wMin: c.rowW[2] - sp, wMax: c.rowW[2] + sp,
    };
  });
  return {
    name, per, src: Array.from(f._source),
    uni: {
      uCount: u.uCount.value, uPixelWidth: u.uPixelWidth.value, uFeatherPx: u.uFeatherPx.value,
      uAngScale: u.uAngScale.value, uAngCutoffPx: u.uAngCutoffPx.value,
      uLogDepthBufFC: u.uLogDepthBufFC.value,
      uArcTolPx: u.uArcTolPx ? u.uArcTolPx.value : 0,
    },
  };
}

const tilt = (deg) => new THREE.Matrix4().makeRotationZ((deg * Math.PI) / 180);

const CASES = [
  // P1 — THE §7.1 REPRODUCER. Camera INSIDE the ring, pitched off its plane, looking outward.
  // wMin < 0 < wMax (straddle) => the extent AABB is the ±1e30 sentinel by design, the
  // front-branch guard passes on sign, and Sampson's collapsed gradient paints the phantom row.
  build('P1-inside-pitched (§7.1 phantom reproducer)',
    [{ radius: R, color: 0x00ff00 }], [R - 116, 12.95, 0], [R + 400, 0, 0]),
  // P2 — camera OUTSIDE both rings, high above: bounded extents, two overlapping rings.
  build('P2-outside-bounded-2rings',
    [{ radius: R, color: 0x00ff00 }, { radius: R * 0.62, color: 0xff0000 }],
    [0, 26000, 26000], [0, 0, 0]),
  // P3 — M4's missing fixture: EDGE-ON but BOUNDED (camera outside the ring, in its plane).
  // This is d0b5170's own regime; without it, deleting the extent reject changes nothing.
  build('P3-edgeon-bounded (M4 fixture)',
    [{ radius: R, color: 0x00ff00 }], [R * 2.2, 0.9, 0], [0, 0, 0]),
  // P4 — M8's fixture: the co-depth tie-break needs two rings whose clip-w agree to within
  // CONIC_WCLIP_TIE_EPS (0.5%) at a SHARED pixel. A radius split does not achieve that (the rings
  // never coincide in space). Two rings of the SAME radius, one rotated slightly about an in-plane
  // axis, INTERSECT at two exact points — where they are the same 3D point, so their clip-w is
  // identical by construction and the tie branch is guaranteed to run. Just off the crossing their
  // band coverage differs, which is what the tie-break arbitrates on.
  build('P4-codepth-tie (M8 fixture)',
    [{ radius: R, color: 0x00ff00 },
      { radius: R, color: 0xff0000, matrixWorld: new THREE.Matrix4().makeRotationX(0.035) }],
    [0, 21000, 21000], [0, 0, 0]),
  // P5 — M11's missing fixture: a SUB-PIXEL ring (projected radius below the 1.0 px angular
  // cutoff) beside a healthy one, so forcing the angular fade to 1.0 has something to reveal.
  build('P5-subpixel-ring (M11 fixture)',
    [{ radius: R, color: 0x00ff00 }, { radius: 0.9, color: 0xff0000 }],
    [0, 24000, 24000], [0, 0, 0]),
  // P6 — an INCLINED ring inside the straddle regime. The design lane measured that on inclined
  // rings the legit/debris classes INVERT under any w-based bound; this pose is what keeps a
  // future w-bound from being reintroduced on uninclined evidence.
  // ⚠ Hand-placing a camera against a tilted ring produced a pose that painted NOTHING (the ring
  // fell entirely behind the camera, wMax < 0, correctly culled). An inert fixture reads as
  // coverage and is not — so P6 is P1's PROVEN straddle geometry carried through the same tilt as
  // the ring, which preserves the regime by construction.
  build('P6-inclined-straddle',
    [{ radius: R, color: 0x00ff00, matrixWorld: tilt(25) }],
    new THREE.Vector3(R - 116, 12.95, 0).applyMatrix4(tilt(25)).toArray(),
    new THREE.Vector3(R + 400, 0, 0).applyMatrix4(tilt(25)).toArray()),
  // P7 — M3's missing fixture, and the one that pins Max's no-vanish ruling (d7db3a3).
  // Camera EXACTLY in the ring's plane and OUTSIDE it: wMin > 0 so the extent AABB is live, and
  // adj(H) is EXACTLY rank-1 so every pixel reconstructs to the same point at infinity and the
  // recovered wclip collapses. That is the ONLY regime in which the shader's degenerate fallback
  // (wclip = the ring centre's clip w, so the ring is depth-sorted instead of VANISHING) actually
  // runs. Without this pose, deleting the front-branch guard changes nothing measurable — which is
  // how M3 came to survive once the front-arc gate took over the COVERAGE half of that guard's job.
  // The height is exactly 0, not nearly 0: at 0.9 the reconstruction is still finite enough to pass.
  build('P7-exact-edgeon-bounded (M3 fixture)',
    [{ radius: R, color: 0x00ff00 }], [R * 2.2, 0, 0], [0, 0, 0]),
];

// ── mutation battery ────────────────────────────────────────────────────────────────────────────
// The gate is CLOSED only when every mutant moves at least one measured quantity at some pose.
const MUT = [
  ['M0-ORIGINAL', (s) => s],
  ['M1-clipw-x0.37', (s) => s.replace('float wclip = dot(vec3(t6.x, t6.y, t6.z), vec3(XZ, 1.0));', 'float wclip = 0.37 * dot(vec3(t6.x, t6.y, t6.z), vec3(XZ, 1.0));')],
  ['M2-band-x4', (s) => s.replace('smoothstep(uPixelWidth * 0.5, uPixelWidth * 0.5 + uFeatherPx, distPx)', 'smoothstep(uPixelWidth * 2.0, uPixelWidth * 2.0 + uFeatherPx, distPx)')],
  ['M3-drop-frontguard', (s) => s.replace('if (!(wclip > 0.0)) {', 'if (false) {')],
  ['M4-drop-extent', (s) => s.replace(/if \(p\.x < t5\.y - extentMargin[\s\S]*?continue;/, '')],
  ['M5-sampson-nograd', (s) => s.replace('float distPx = abs(vnum) / max(gmag, 1e-12);', 'float distPx = abs(vnum);')],
  ['M6-XZ-no-divide', (s) => s.replace('vec2 XZ = q.xy / q.z;', 'vec2 XZ = q.xy;')],
  ['M7-depthFC-0.4', (s) => s.replace('uLogDepthBufFC * 0.5;', 'uLogDepthBufFC * 0.4;')],
  ['M8-tieEps-x10', (s) => s.replace(/0\.005000/g, '0.050000')],
  ['M9-Hinv-rowswap', (s) => s.replace('vec3 q = vec3(dot(hR0, p), dot(hR1, p), dot(hR2, p));', 'vec3 q = vec3(dot(hR1, p), dot(hR0, p), dot(hR2, p));')],
  ['M10-argmax-flip', (s) => s.replace('if (wclip < bestW * (1.0 - 0.005000)) {', 'if (wclip > bestW * (1.0 - 0.005000)) {')],
  ['M11-angfade-off', (s) => s.replace('float ang = angularFade(t2.y, t2.z);', 'float ang = 1.0;')],
  // M12-M16 cover the FRONT-ARC GATE itself (orbit-ring-phantom-2026-08-12). A gate that does not
  // cover the fix is where §4 was, so the fix does not land without these. M14 is the one that
  // matters most in the OTHER direction: it makes the tolerance far too TIGHT, so if the fixture
  // set cannot see erosion of legitimate far-field ring, M14 survives and says so.
  ['M12-drop-arcgate', (s) => s.replace(/\n *if \(frontArcDist\([\s\S]*?continue;/, '')],
  ['M13-arcgate-x10', (s) => s.replace('p.xy) > uArcTolPx) continue;', 'p.xy) > uArcTolPx * 10.0) continue;')],
  ['M14-arcgate-x0.05', (s) => s.replace('p.xy) > uArcTolPx) continue;', 'p.xy) > uArcTolPx * 0.05) continue;')],
  ['M15-arc-frontcheck-off', (s) => s.replace('if (!(w > 0.0)) return 1.0e30;', 'if (false) return 1.0e30;')],
  ['M16-arc-single-axis', (s) => s.replace(/return min\(arcAxisDist\(fh0, fh1, fhw, radius, pix, 0\),\s*\n\s*arcAxisDist\(fh0, fh1, fhw, radius, pix, 1\)\);/, 'return arcAxisDist(fh0, fh1, fhw, radius, pix, 0);')],
];

const applied = MUT.map(([n, f]) => {
  const out = f(CONIC_FRAGMENT_SHADER);
  return { name: n, src: out, noop: n !== 'M0-ORIGINAL' && out === CONIC_FRAGMENT_SHADER };
});

// ── the page ────────────────────────────────────────────────────────────────────────────────────
// --dump-dom HTML-escapes < > &, so the payload is base64'd rather than parsed out of raw JSON.
const html = `<!doctype html><meta charset=utf8><body><pre id=out>PENDING</pre><script>
const VS=${JSON.stringify(CONIC_VERTEX_SHADER)};
const MUT=${JSON.stringify(applied.map((m) => [m.name, m.src]))};
const CASES=${JSON.stringify(CASES)};
const W=${W},H=${H},CMAX=${CONIC_MAX},ROWS=${CONIC_TEX_ROWS};
const cv=document.createElement('canvas');cv.width=W;cv.height=H;
const gl=cv.getContext('webgl2',{antialias:false});
const out={ok:false,ctx:!!gl,ext:false,results:[],error:null};
try{
if(!gl)throw new Error('no webgl2 context');
out.ext=!!gl.getExtension('EXT_color_buffer_float');
function sh(t,s){const o=gl.createShader(t);gl.shaderSource(o,s);gl.compileShader(o);
 if(!gl.getShaderParameter(o,gl.COMPILE_STATUS))throw new Error('COMPILE: '+gl.getShaderInfoLog(o));return o;}
function link(f,v){const p=gl.createProgram();gl.attachShader(p,sh(gl.VERTEX_SHADER,'#version 300 es\\nin vec3 position;\\n'+(v||VS)));
 gl.attachShader(p,sh(gl.FRAGMENT_SHADER,'#version 300 es\\n'+f));gl.linkProgram(p);
 if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw new Error('LINK: '+gl.getProgramInfoLog(p));return p;}
const vb=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,vb);
gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,0,3,-1,0,-1,3,0]),gl.STATIC_DRAW);
gl.bindVertexArray(gl.createVertexArray());
function mkT(fmt){const t=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,t);gl.texStorage2D(gl.TEXTURE_2D,1,fmt,W,H);
 gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);return t;}
const colT=mkT(gl.RGBA32F),depT=mkT(gl.DEPTH_COMPONENT32F),colT2=mkT(gl.RGBA32F);
const fb=gl.createFramebuffer();gl.bindFramebuffer(gl.FRAMEBUFFER,fb);
gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,colT,0);
gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.DEPTH_ATTACHMENT,gl.TEXTURE_2D,depT,0);
if(gl.checkFramebufferStatus(gl.FRAMEBUFFER)!==gl.FRAMEBUFFER_COMPLETE)throw new Error('FBO incomplete');
const fb2=gl.createFramebuffer();gl.bindFramebuffer(gl.FRAMEBUFFER,fb2);
gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,colT2,0);
// pass 2: WebGL2 forbids readPixels on a depth attachment, so blit it into a colour target.
const p2=link('precision highp float;precision highp sampler2D;uniform sampler2D uD;out vec4 o;void main(){o=vec4(texelFetch(uD,ivec2(gl_FragCoord.xy),0).r,0.,0.,1.);}');
const dtex=gl.createTexture();
function render(prog,C){
 gl.bindTexture(gl.TEXTURE_2D,dtex);
 for(const k of [[gl.TEXTURE_MIN_FILTER,gl.NEAREST],[gl.TEXTURE_MAG_FILTER,gl.NEAREST],[gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE],[gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE]])gl.texParameteri(gl.TEXTURE_2D,k[0],k[1]);
 gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA32F,CMAX,ROWS,0,gl.RGBA,gl.FLOAT,new Float32Array(C.src));
 gl.bindFramebuffer(gl.FRAMEBUFFER,fb);gl.viewport(0,0,W,H);
 gl.clearColor(0,0,0,0);gl.clearDepth(1);gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LESS);gl.depthMask(true);
 gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.useProgram(prog);
 gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,dtex);
 gl.uniform1i(gl.getUniformLocation(prog,'uData'),0);
 gl.uniform1i(gl.getUniformLocation(prog,'uCount'),C.uni.uCount);
 for(const k of ['uPixelWidth','uFeatherPx','uAngScale','uAngCutoffPx','uLogDepthBufFC','uArcTolPx'])
  {const L=gl.getUniformLocation(prog,k);if(L)gl.uniform1f(L,C.uni[k]);}
 let lp=gl.getAttribLocation(prog,'position');gl.enableVertexAttribArray(lp);
 gl.bindBuffer(gl.ARRAY_BUFFER,vb);gl.vertexAttribPointer(lp,3,gl.FLOAT,false,0,0);
 gl.drawArrays(gl.TRIANGLES,0,3);
 const px=new Float32Array(W*H*4);gl.readPixels(0,0,W,H,gl.RGBA,gl.FLOAT,px);
 gl.bindFramebuffer(gl.FRAMEBUFFER,fb2);gl.disable(gl.DEPTH_TEST);gl.useProgram(p2);
 gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,depT);
 gl.uniform1i(gl.getUniformLocation(p2,'uD'),0);
 lp=gl.getAttribLocation(p2,'position');gl.enableVertexAttribArray(lp);
 gl.bindBuffer(gl.ARRAY_BUFFER,vb);gl.vertexAttribPointer(lp,3,gl.FLOAT,false,0,0);
 gl.clearColor(0,0,0,1);gl.clear(gl.COLOR_BUFFER_BIT);gl.drawArrays(gl.TRIANGLES,0,3);
 const dp=new Float32Array(W*H*4);gl.readPixels(0,0,W,H,gl.RGBA,gl.FLOAT,dp);return {px,dp};
}
// ORACLE — for every painted pixel: which ring owns it (by colour), the wclip recovered from the
// DEPTH attachment (inverse of gl_FragDepth = log2(1+w)*FC*0.5), and the plane radius that ring's
// Hinv reconstructs. "debris" = reconstructed |XZ|/R > 2, i.e. provably not on the circle.
function oracle(C,r){
 const FC=C.uni.uLogDepthBufFC;
 let painted=0,wlo=1/0,whi=-1/0,debris=0,worst=0,own0=0,own1=0;const rowset=new Set();
 for(let y=0;y<H;y++)for(let x=0;x<W;x++){
  const o=(y*W+x)*4;if(!(r.px[o+3]>0))continue;
  painted++;rowset.add(y);
  const w=Math.pow(2,r.dp[o]*2/FC)-1;if(w<wlo)wlo=w;if(w>whi)whi=w;
  const gi=r.px[o+1]>0.5?0:1; if(gi===0)own0++;else own1++;
  const P=C.per[Math.min(gi,C.per.length-1)],Hi=P.Hinv;
  const qx=Hi[0]*(x+.5)+Hi[1]*(y+.5)+Hi[2],qy=Hi[3]*(x+.5)+Hi[4]*(y+.5)+Hi[5],qz=Hi[6]*(x+.5)+Hi[7]*(y+.5)+Hi[8];
  const pr=Math.hypot(qx/qz,qy/qz)/P.R;if(pr>2)debris++;if(pr>worst)worst=pr;}
 // own0/own1 = which RING owns each pixel, by colour. Without this an ownership flip is invisible,
 // and ownership is exactly what the co-depth tie-break (M8) and the argmax rule (M10) decide.
 return {painted,rows:rowset.size,wMin:painted?wlo:null,wMax:painted?whi:null,debris,worstPlaneRatio:painted?worst:null,own0,own1};
}
for(const C of CASES){
 const per=[];
 for(const [n,f] of MUT){
  let prog,err=null,s=null;
  try{prog=link(f);s=oracle(C,render(prog,C));}catch(e){err=String(e.message||e).slice(0,120);}
  per.push({mutant:n,err,...(s||{})});
 }
 out.results.push({case:C.name,rings:C.per.map(p=>({R:p.R,wMin:p.wMin,wMax:p.wMax,empty:p.bounds[0]>p.bounds[2],sentinel:p.bounds[0]<=p.bounds[2]&&Math.abs(p.bounds[0])>1e6})),mutants:per});
}
out.ok=true;
}catch(e){out.error=String(e&&e.stack||e);}
document.getElementById('out').textContent='B64:'+btoa(unescape(encodeURIComponent(JSON.stringify(out))));
</script></body>`;

// ── run ─────────────────────────────────────────────────────────────────────────────────────────
const noops = applied.filter((m) => m.noop);
if (noops.length) {
  console.error('FATAL: mutation is a NO-OP (the shader text moved under it): ' + noops.map((m) => m.name).join(', '));
  console.error('A no-op mutant is a silent hole — fix the replace() target, do not ignore it.');
  process.exit(1);
}

if (!fs.existsSync(CHROME)) {
  console.error(`FATAL: Chrome not found at ${CHROME}.`);
  console.error('Set CHROME_BIN. This gate THROWS rather than skipping — a skipped gate is a dead');
  console.error('gate, which is the exact green-means-nothing failure §3 documents.');
  process.exit(1);
}

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'conic-gl-'));
const page = path.join(dir, 'gate.html');
fs.writeFileSync(page, html);

let dom;
try {
  dom = execFileSync(CHROME, [
    '--headless=new', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
    '--disable-gpu-sandbox', '--no-sandbox', '--dump-dom', `file://${page}`,
  ], { encoding: 'utf8', timeout: 240000, maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'] });
} catch (e) {
  console.error('FATAL: Chrome failed to run the gate page.');
  console.error(String(e.message || e).slice(0, 400));
  console.error('\nNOTE: Chrome cannot launch inside the agent sandbox (socket() Operation not');
  console.error('permitted). Run from a normal terminal or with the sandbox disabled.');
  process.exit(1);
}

const m = dom.match(/B64:([A-Za-z0-9+/=]+)/);
if (!m) {
  console.error('FATAL: no payload in the page output — the harness did not reach its final write.');
  console.error(dom.slice(0, 800));
  process.exit(1);
}
const res = JSON.parse(Buffer.from(m[1], 'base64').toString('utf8'));
if (!res.ok) {
  console.error('FATAL: harness threw inside the page:\n' + res.error);
  process.exit(1);
}

// ── report + verdict ────────────────────────────────────────────────────────────────────────────
const fmt = (v) => (v == null ? '-' : (Math.abs(v) >= 1e4 || (v !== 0 && Math.abs(v) < 1e-2) ? v.toExponential(3) : v.toFixed(3)));
console.log('\n── INSTRUMENT E · shipped-shader numeric coverage ──────────────────────────────────────');
console.log(`  executes : CONIC_FRAGMENT_SHADER, imported from src/objects/OrbitConicField.js`);
console.log(`  context  : WebGL2 via ${CHROME} (ANGLE/SwiftShader), RGBA32F + DEPTH_COMPONENT32F FBO`);
console.log(`  target   : ${W}x${H} (the game's sceneTarget at pixelScale 3)`);
console.log(`  front-arc gate present in shader  : YES (M12-M16 cover it)`);

// A mutant is KILLED if it moves any measured quantity at ANY pose, vs M0 at that pose.
const killedBy = new Map();
for (const c of res.results) {
  const base = c.mutants.find((x) => x.mutant === 'M0-ORIGINAL');
  console.log(`\n  ═══ ${c.case}`);
  for (const r of c.rings) {
    console.log(`      ring R=${r.R.toFixed(0)}  wMin=${fmt(r.wMin)}  wMax=${fmt(r.wMax)}  extent=${r.empty ? 'EMPTY (behind camera, culled)' : r.sentinel ? 'UNBOUNDED sentinel' : 'bounded AABB'}`);
  }
  console.log('      ' + 'MUTANT'.padEnd(20) + 'painted'.padStart(8) + 'rows'.padStart(6)
    + 'wclip[min'.padStart(13) + ', max]'.padStart(12) + 'debris'.padStart(8) + 'worstPR'.padStart(11) + 'own(a/b)'.padStart(12));
  for (const r of c.mutants) {
    if (r.err) { console.log('      ' + r.mutant.padEnd(20) + '  SHADER ERROR: ' + r.err); continue; }
    const moved = r.mutant !== 'M0-ORIGINAL' && base && (
      r.painted !== base.painted || r.rows !== base.rows || r.debris !== base.debris
      || fmt(r.wMin) !== fmt(base.wMin) || fmt(r.wMax) !== fmt(base.wMax)
      || r.own0 !== base.own0 || r.own1 !== base.own1);
    if (moved) killedBy.set(r.mutant, (killedBy.get(r.mutant) ?? []).concat(c.case.split(' ')[0]));
    console.log('      ' + r.mutant.padEnd(20) + String(r.painted).padStart(8) + String(r.rows).padStart(6)
      + fmt(r.wMin).padStart(13) + fmt(r.wMax).padStart(12) + String(r.debris).padStart(8)
      + fmt(r.worstPlaneRatio).padStart(11) + `${r.own0}/${r.own1}`.padStart(12)
      + (moved ? '  ← killed' : ''));
  }
}

const expected = applied.map((m) => m.name).filter((n) => n !== 'M0-ORIGINAL');
const survivors = expected.filter((n) => !killedBy.has(n));

console.log('\n── VERDICT ─────────────────────────────────────────────────────────────────────────────');
console.log(`  mutants scored : ${expected.length}`);
console.log(`  killed         : ${expected.length - survivors.length}`);
for (const n of expected) {
  if (killedBy.has(n)) console.log(`      ${n.padEnd(20)} killed by ${[...new Set(killedBy.get(n))].join(', ')}`);
}
if (survivors.length) {
  console.log(`  SURVIVORS      : ${survivors.join(', ')}`);
  console.log('\n  A surviving mutant means the shipped shader can be changed that way and every');
  console.log('  gate stays green. That is §3 restated. Add the fixture that separates it — do NOT');
  console.log('  delete the mutant.');
  console.log('\nINSTRUMENT E: FAILED');
  process.exit(1);
}
console.log('\nINSTRUMENT E: closed — every mutant moves a measured quantity.');
