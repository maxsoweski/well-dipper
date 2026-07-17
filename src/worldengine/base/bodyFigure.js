// src/worldengine/base/bodyFigure.js
// World Engine V2-4 slice-5 — the E2-FIGURE DESCRIPTOR (BUILD-PLAN §5, calibration §6.4).
//
// THREE-FREE, RNG-FREE, PURE. `deriveFigureDescriptor` is a pure function of the condition vector (the same
// driver→scalar shape as the E1 regime selector, but E1-BLIND — it neither imports nor calls it) — it reads
// only condition.{rotationHours, radiusEarth, surfaceGravity, tidalState.locked}, draws NO random stream and
// touches NO carrier array. It is DESCRIPTOR-ONLY: it produces a small object that
// rides on the writeBodyRelief return (`relief.figure`) — there is NO visible oblateness render this
// increment (designDecision #FIGURE; the fixed-sphere pipeline cannot express body shape, and building that
// path would collide with the atmosphere lane's shader territory). V2-7 CYCLE-2 imports this directly at its
// epoch seam and reads {presentW0, fossilW0, fPresent, fFossil, despun} to key figure↔grain reorientation.
//
// WHAT IT MODELS (plain language): the body's ROTATIONAL FLATTENING — how oblate a self-gravitating spinning
// body is. A fast spinner bulges at the equator; the flattening f = (equatorial − polar)/equatorial radius.
// We use the HOMOGENEOUS (Maclaurin) small-rotation form f = (5/4)·ω²·a³/GM = (5/4)·ω²·a/g (see below), a
// closed-form driver→figure map that needs only spin + radius + surface gravity — all already on the drivers.
//
// THE §7b RADIUS-NOT-SHELL TRAP (the ROADMAP §7b delegable-#4 layer-thickness trap): the `a` term below is the BODY
// RADIUS (condition.radiusEarth · Earth-radius), the outer figure of the whole body. It is emphatically NOT
// the crustal/lithospheric layer thickness (a physically distinct, ~30× smaller quantity that lives under a
// different condition key). Reading that thinner layer here would under-compute the bulge by orders of
// magnitude. AC-0 grep-DENIES that identifier's substring in this file to make the trap un-fall-into-able.
//
// THE DESPUN / FOSSIL-BULGE SPLIT: a tidally-LOCKED body spins synchronously TODAY (slow) but accreted fast
// and despun over time. Its present figure is small (fPresent from the current period) while a FOSSIL bulge
// frozen from the primordial fast spin can persist (fFossil from PRIMORDIAL_SPIN_HOURS, the named fiducial —
// there is no primordial-spin driver, so this is a deliberate modeling constant, NOT an authored w0). So a
// locked body yields presentW0 ≠ fossilW0 and fPresent ≠ fFossil — the split V2-7 CYCLE-2 needs. This is
// entirely DRIVER-originated; it does NOT touch the shell writer's random spin-axis w0 (a sibling-local red
// herring, designDecision #FIGURE — left untouched, and never referenced or imported here).

// ── PHYSICAL CONSTANTS (unit discipline — the delegable-#4 trap is a UNITS trap) ──────────────────────
const R_EARTH_M = 6.371e6;          // metres per Earth radius (a = radiusEarth · R_EARTH_M)
const G0 = 9.81;                    // m/s² per g (g_SI = surfaceGravity · G0; surfaceGravity is in Earth-g)
const FIGURE_COEFF = 5 / 4;         // homogeneous (Maclaurin) small-rotation coefficient; overestimates a
                                    // centrally-condensed body ~2× (Jupiter ~0.11 vs real ~0.065) — ORDERING
                                    // is the gate, exact value deferred (Darwin–Radau refinement, §6.4/§9).
export const PRIMORDIAL_SPIN_HOURS = 8;  // named fiducial: canonical post-accretion rocky spin (the fossil-
                                         // bulge source for despun bodies). A deliberate modeling choice, not
                                         // an authored/seeded w0 (recorded in SUBSTRATE-MAP).
const DEFAULT_ROTATION_HOURS = 24;  // fallback if condition.rotationHours is absent (mirrors driver-presets D8 default)

// ω (rad/s) from a rotation period in hours. Unit-disciplined: hours → seconds → rad/s.
export function omegaFromHours(hours) { return (2 * Math.PI) / (hours * 3600); }

// The homogeneous flattening f = (5/4)·ω²·a³/GM. With GM = g·a² (surface-gravity definition g = GM/a²), this
// reduces to f = (5/4)·ω²·a/g — the a³/(g·a²) cancellation. We evaluate the reduced a/g form (numerically
// stable), and expose GM on the descriptor so the a³/GM equivalence is documented, not hidden.
export function flattening(omega, aMeters, gSI) { return FIGURE_COEFF * omega * omega * aMeters / gSI; }

// deriveFigureDescriptor(condition) — the pure driver→figure map. Takes EXACTLY ONE argument (the condition
// vector); it accepts NO seed and NO authored-w0 — the descriptor is COMPUTED, never dialed in (AC-FIGURE c).
export function deriveFigureDescriptor(condition) {
  const rotationHours  = condition?.rotationHours  ?? DEFAULT_ROTATION_HOURS;
  const radiusEarth    = condition?.radiusEarth    ?? 1;
  const surfaceGravity = condition?.surfaceGravity ?? 1;               // Earth-g
  const locked         = !!(condition?.tidalState && condition.tidalState.locked);

  const aMeters = radiusEarth * R_EARTH_M;   // BODY RADIUS in metres (§7b radius-not-shell trap: NOT a crustal layer)
  const gSI     = surfaceGravity * G0;       // surface gravity in m/s²
  const GM      = gSI * aMeters * aMeters;    // GM = g·a² — the documented equivalence f = (5/4)ω²a³/GM = (5/4)ω²a/g

  // Present spin: the body's CURRENT rotation (for a locked preset this IS the synchronous period).
  const presentW0 = omegaFromHours(rotationHours);
  const fPresent  = flattening(presentW0, aMeters, gSI);

  // Fossil spin: for a despun (locked) body, the primordial fast spin frozen into a relict bulge; otherwise
  // there is no despin history, so fossil ≡ present (fPresent ≡ fFossil, despun = false).
  let fossilW0 = presentW0, fFossil = fPresent, despun = false;
  if (locked) {
    fossilW0 = omegaFromHours(PRIMORDIAL_SPIN_HOURS);
    fFossil  = flattening(fossilW0, aMeters, gSI);
    despun   = true;
  }

  return {
    // spin rates ω (rad/s) — the figure "w0". Primary keys presentW0/fossilW0 (contract + orchestrator
    // naming); omegaPresent/omegaFossil/omega are BUILD-PLAN §5 aliases (identical values) so a consumer
    // reading either name resolves. See the §11 deviation row (naming superset).
    presentW0, fossilW0,
    omegaPresent: presentW0, omegaFossil: fossilW0, omega: presentW0,
    // flattening f (dimensionless) — homogeneous Maclaurin form
    fPresent, fFossil,
    // provenance flags
    locked, despun,
    // documented intermediates
    aMeters, GM, rotationHours,
  };
}
