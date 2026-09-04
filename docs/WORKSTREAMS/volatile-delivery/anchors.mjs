// AC-3 — the law must reproduce the six real bodies driver-presets.js is calibrated on.
// Bounds are DERIVED from the gate each body must sit on, never round numbers picked for looks.
import { surfaceVolatileInventory } from '/home/ax/projects/well-dipper/src/generation/PhysicsEngine.js';

const FROST = 4.85;   // AU, solar
// ⚠ TWO PRESETS CARRY A DECORATIVE ORBIT SLOT and it is not the calibration input: 'Europa (icy moon)'
// stores 2500 R⊕ (its orbit around JUPITER) and 'Moon/Mercury (impact-airless)' stores 117275 R⊕ (a
// placeholder). At runtime MoonGenerator.js:259 passes the PARENT's heliocentric AU, so the real
// heliocentric distance is what the law actually sees. Everything else is the preset's own value.
const BODIES = [
  // name                  M⊕      R⊕     T_eq  orbitAU  iceF   bound            why the bound is there
  ['Earth',                1.0,    1.0,   288,  1.00,    0.035, [0.12, 0.20],
    'must clear e1Regime BAND.V_MIN 0.12; passiveMargins MARGIN_VF0 anchors 1.0 at 0.15'],
  ['Venus',                0.815,  0.95,  737,  0.723,   0.030, [0.00, 0.05],
    'at/under labCore.js:693 bone-dry floor; stagnantLid.js:94 makes Venus the dryness reference at 0.02'],
  ['Mars',                 0.107,  0.53,  210,  1.524,   0.040, [0.05, 0.14],
    'must clear the bone-dry floor (Mars has ground ice) and reach surfaceMaterial OX_VOL_HI 0.10'],
  ['Moon (as Moon/Mercury)', 0.04, 0.38,  235,  1.00,    0.035, [0.00, 0.03],
    'OX_VOL_LO sits ON it at 0.02 and it must read EXACTLY zero oxidiser'],
  ['Titan',                0.025,  0.40,   94,  9.54,    0.44,  [0.30, 0.70],
    'beyond the frost line — proves the delivery term did not eat the in-situ law'],
  ['Europa',               0.07,   0.50,  110,  5.20,    0.31,  [0.30, 0.70],
    'beyond the frost line — same arm'],
];

let fail = 0;
const run = (deliveryOn) => {
  console.log(deliveryOn ? '\n── THE LAW ──' : '\n── [CONTROL] delivery zeroed: Earth must FAIL, Titan/Europa must PASS ──');
  for (const [name, M, R, T, au, iceF, [lo, hi], why] of BODIES) {
    const V = surfaceVolatileInventory({
      iceFraction: iceF, frostRatio: au / FROST, massEarth: M, radiusEarth: R, T_eq: T,
      metallicity: 0, solidInventory: 0.05, deliveryFloat: deliveryOn ? 0.5 : -Infinity,
    });
    const ok = V >= lo && V <= hi;
    if (deliveryOn && !ok) fail++;
    console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name.padEnd(22)} V = ${V.toFixed(4)}   bound [${lo}, ${hi}]`);
    if (deliveryOn) console.log(`        ${why}`);
  }
};
run(true);
// [CONTROL] deliveryFloat -Infinity => draw = exp(-inf) = 0 => the delivered term vanishes entirely.
run(false);
console.log(fail === 0 ? '\nALL SIX ANCHORS HOLD' : `\n${fail} ANCHOR(S) OUT OF BOUND`);
process.exit(fail === 0 ? 0 : 1);
