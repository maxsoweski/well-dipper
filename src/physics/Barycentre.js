/**
 * Barycentre — where a planet is actually drawn once its moons are allowed to move it.
 *
 * Contract: docs/WORKSTREAMS/binary-barycentre-render-2026-08-18/contract.json
 * Why:      B5.0's binary companion generated correctly and failed UAT on the first pair.
 *           Max: "planet with a big moon because the orbit lines center one planet in orbit
 *           around the other rather than both around a shared empty gravitational center."
 *
 * The primary was nailed to its orbital point. That point is not where the planet is — it is
 * where the planet-plus-moons SYSTEM balances. Given the orbital point B:
 *
 *     P = B - (1/M_total) * SUM_i m_i * a_i * u_i
 *
 * and every moon then sits at `P + a_i * u_i` exactly as it does today, which is why the moon
 * placement code needs no change at all. Max ruled this applies to EVERY moon, with no
 * mass-ratio cutoff and no flag on the record.
 *
 * ⛔ THIS MODULE PREDICTS. IT NEVER MUTATES. A moon advances its own angle exactly once per
 * frame — planet-class in main.js, plain inside `Moon.updateSim` (Moon.js:589). Pre-advancing
 * here to learn a direction and then letting the real advance run doubles every plain moon's
 * orbital rate: plausible on screen, and invisible to every test in the battery. `celestialDt =
 * 0` is not an escape hatch either — Moon.js:609 spends the same dt on moon rotation.
 */
import { moonMassEarth } from './BodyMass.js';

/**
 * The share of a planet's excursion one moon must own before its pair is drawn barycentrically.
 *
 * ⭐ NOT a physics cutoff — Max ruled the offset itself is unconditional. This is a statement
 * about what a CIRCLE can describe. A ring centred on the barycentre is the body's true path
 * only in the two-body case; with several comparable moons the path is epicyclic, and drawing a
 * circle for it would put the body visibly off its own orbit line — a defect that does not exist
 * today. Above this share the residual is under a percent.
 *
 * Measured over FENCE-221 (tools/barycentre-probe.mjs): 377 of 521 moon-bearing planets are
 * dominated, every one of the 27 binary companions is, and no dominated planet carries more than
 * two moons — so the extra ring never lands on a crowded gas giant.
 */
export const DOMINANCE_THRESHOLD = 0.99;

/** Where a moon's live orbit angle actually lives. */
function angleOwner(moon) {
  // ⛔ Planet-class moons keep it on the wrapper (PlanetMoonBody.js:53); plain moons keep it on
  // the DELEGATE (Moon.js:18) and `BodyRenderer` exposes no `orbitAngle` getter. Reading
  // `moon.orbitAngle` uniformly returns undefined for every plain moon, which NaNs the planet,
  // its lighting, its moons, its rings and every SOI query for it — silently, with no throw.
  // `freezeFrame` already encodes this split at main.js:3213.
  return moon._delegate ?? moon;
}

/** The angle the moon WILL hold this frame, without advancing it. */
export function predictMoonAngle(moon, celestialDt) {
  // Operand order is transcribed from the two real advances (main.js:11243, Moon.js:589) so the
  // prediction is bit-identical to where they land, not merely close.
  return angleOwner(moon).orbitAngle + moon.data.orbitSpeed * celestialDt;
}

/** Unit direction from the planet to the moon, in the renderer's frame. */
export function moonUnitDirection(moon, angle) {
  // Each branch keeps its OWN inclination expression: planet-class coerces (main.js:11246
  // `moon.data.inclination || 0`), plain does not (Moon.js:593). Mirroring both means an
  // undefined inclination fails exactly where it fails today rather than somewhere new.
  const incl = moon.isPlanetMoon ? (moon.data.inclination || 0) : moon.data.inclination;
  const sa = Math.sin(angle);
  // Must match OrbitLine's rotation.x = inclination: y' = -sin(incl)*z, z' = cos(incl)*z.
  return { x: Math.cos(angle), y: -Math.sin(incl) * sa, z: Math.cos(incl) * sa };
}

/**
 * How far the primary sits from its orbital point, this frame. Subtract from the orbital point.
 * @param {number} planetMass  Earth masses — MUST come from planetMassEarth(), which carries the
 *                             Sol fallback. An undefined mass here NaNs the whole planet.
 */
export function barycentreOffset(planetMass, moons, celestialDt) {
  let total = planetMass, x = 0, y = 0, z = 0;
  for (const moon of moons) {
    const m = moonMassEarth(moon.data);
    const a = moon.data.orbitRadius;
    const u = moonUnitDirection(moon, predictMoonAngle(moon, celestialDt));
    total += m;
    x += m * a * u.x; y += m * a * u.y; z += m * a * u.z;
  }
  return { x: x / total, y: y / total, z: z / total };
}

/**
 * Which moon owns the primary's excursion, and by how much.
 * Static per system — masses and orbit radii never change — so callers resolve it once at spawn.
 */
export function dominantMoon(planetMass, moons) {
  let total = planetMass;
  for (const moon of moons) total += moonMassEarth(moon.data);
  let sum = 0, top = 0, index = -1;
  for (let i = 0; i < moons.length; i++) {
    const c = moonMassEarth(moons[i].data) * moons[i].data.orbitRadius / total;
    sum += c;
    if (c > top) { top = c; index = i; }
  }
  return { index, share: sum > 0 ? top / sum : 1, massFraction: sum > 0 ? top / moons[index].data.orbitRadius : 0 };
}

/**
 * The two radii of a barycentric pair, about the empty point.
 *
 * ⛔ `r2 = a/(1+q)` is CORRECT for the ring and FATAL for the body separation — that is scoping
 * §3's Convention-B trap, which is silent because no test in the battery measured a drawn
 * separation until this workstream's. `r1 + r2 === a` is the invariant that keeps the two apart.
 *
 * @param {number} a             the FULL parent-relative separation (Convention A)
 * @param {number} massFraction  m_moon / M_total, i.e. q/(1+q)
 */
export function ringRadii(a, massFraction) {
  return { r1: a * massFraction, r2: a * (1 - massFraction) };
}
