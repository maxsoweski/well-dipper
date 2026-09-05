/**
 * APPARENT MAGNITUDE AT 240p — how big an in-system body has to be drawn to READ as brighter than
 * the starfield behind it.
 *
 * Max, 2026-09-04: *"even the close star looks no brighter (dimmer in some cases) than stars much
 * farther away"*, *"the billboards are still illegible"*, and the licence: *"The star and planets
 * should simply appear to be brighter than the other stars ... I'm fine with cheating a bit and
 * using some screen-space effects or post processing or whatever."*
 *
 * ── WHY SIZE AND NOT BRIGHTNESS ─────────────────────────────────────────────────────────────────
 *
 * `sceneTarget` is UnsignedByteType (RetroRenderer.js) and there is no bloom, no EffectComposer and
 * no tone map anywhere in src/rendering — grepped, zero matches. Every program clips at 1.0. So once
 * a core saturates it is white, and white is white: VALUE CANNOT CARRY MAGNITUDE past that point.
 * Measured live at 240p, the system's own star and the brightest background star BOTH peak at 255.
 * Area is the only channel left, which is what "cheating with screen-space effects" comes down to
 * here — spread, not intensity.
 *
 * ── THE TWO DEFECTS, MEASURED RATHER THAN REASONED ──────────────────────────────────────────────
 *
 * Read back off the real render targets at 240p (contiguous run through the peak, everything else in
 * the scene hidden, buffer 475x240):
 *
 *     brightest background star   2 x 3 buffer px   peak 255
 *     the system's OWN star       1 x 2 buffer px   peak 255
 *     planet billboards           1 - 2 buffer px   peak 204-221
 *
 * ⭐ DEFECT A — THE STAR'S SIZE TARGET WAS CALIBRATED AGAINST A CEILING THE GAME DOES NOT USE.
 * StarFlare's own comment says "The biggest background stars in StarfieldLayer use aSize=8 which
 * doubles to gl_PointSize=16. Target 16-22 px so the billboard is always at least as big as the
 * brightest BG star". aSize 8 is the ceiling of StarfieldLayer's LEGACY random path only. The game
 * builds its starfield from generator data, and a histogram of the LIVE aSize attribute reads
 * 3:1517, 4:10911, 6:1571, 8:111, 10:7 — the ceiling is 10, which doubles to 20 screen px against
 * the billboard's 16. The stated intent is not merely modest, IT IS NOT MET.
 *
 * ⭐ DEFECT B — THE STAR BILLBOARD HAS NO LUMINOSITY TERM AT ALL. Its output is `uColor * shape *
 * 1.8` and its only uniforms are uDitherScale and uColor; `lumFactor` is computed and then spent
 * exclusively on the switch distance. An O-class supergiant and an M-dwarf write the SAME peak byte
 * and differ by well under one buffer pixel in size. Meanwhile the starfield DOES carry a magnitude,
 * baked into each star's colour. The starfield has a magnitude law and the system's star does not.
 *
 * ── THE ANCHOR, AND WHY IT IS NOT A TUNING CONSTANT ─────────────────────────────────────────────
 *
 * Every size below is expressed as a margin IN BUFFER PIXELS above the sky's own ceiling, converted
 * to screen pixels through the live sky scale. That makes the law resolution-aware by construction —
 * the margin stays visible at 144p and at 720p — instead of being pinned to screen px that mean
 * different things at different resolutions. Two numbers to turn, not four magic ones.
 *
 * ⛔ AND IT IS THE SINGLE SOURCE. `orreryEntryGeometry.starGlowRadiusPx()` used to RE-IMPLEMENT the
 * old formula verbatim, citing StarFlare line numbers that had already gone stale, and it feeds
 * arrival framing — so changing the star's size in one place silently desynced the orrery camera in
 * the other. It imports from here now. Do not re-inline this.
 */

/**
 * ⭐ THE A/B, ON THE BACKSLASH KEY. 0 = the shipped law exactly as it was, 1 = the magnitude law.
 * Max judges size changes in motion, not from a screenshot, and he has previously rejected a change
 * for "super chunky stars look quite bad" — so the old behaviour stays one keypress away.
 * ⚠ Read at call time, never captured, so the toggle reaches bodies already in the scene.
 */
export const MAGNITUDE_LAW = { value: 1 };

/** @param {number} on @returns {number} */
export function setMagnitudeLaw(on) { MAGNITUDE_LAW.value = on ? 1 : 0; return MAGNITUDE_LAW.value; }
/** @returns {{on:boolean, name:string}} */
export function toggleMagnitudeLaw() {
  const v = setMagnitudeLaw(!MAGNITUDE_LAW.value);
  return { on: !!v, name: v ? 'MAGNITUDE LAW' : 'LEGACY (pre-fix)' };
}

/**
 * The sky's size ceiling in screen pixels, i.e. what an in-system body has to beat.
 * ⭐ 24, NOT THE 20 THE LIVE HISTOGRAM SHOWS. Procedural skies top out at aSize 10 -> 20, but the
 * real-star catalog reaches aSize 12 -> 24 for appMag < -1 (Sirius, Canopus), and Sol's sky uses it.
 * Anchoring on the worst case means the law does not quietly fail in exactly one system.
 * ⚠ `baseSize = aSize > 5 ? aSize * 2 : aSize` is StarfieldLayer's doubling; 12 * 2 = 24.
 */
export const SKY_CEILING_PX = 24;

/** Clear of the brightest star by this many BUFFER pixels at the dimmest luminosity. */
export const MAGNITUDE_MARGIN_BUFFER_PX = 1.0;
/** Extra buffer pixels an O-class supergiant gets over an M-dwarf. THE MAGNITUDE SIGNAL ITSELF. */
export const MAGNITUDE_SPAN_BUFFER_PX = 2.5;

/**
 * The shared luminosity clamp. Sol = 1 -> 0.7; the bounds are StarFlare's and are unchanged.
 * @param {number} luminosity solar luminosities @returns {number} in [0.55, 2.0]
 */
export function lumFactorOf(luminosity) {
  const L = Number(luminosity);
  if (!Number.isFinite(L) || L <= 0) return 0.7;
  return Math.min(2.0, Math.max(0.55, 0.7 + 0.2 * Math.log10(L)));
}

/**
 * Target on-screen DIAMETER of the star's billboard, in screen px.
 *
 * @param {number} lumFactor from lumFactorOf()
 * @param {number} skyPixelScale screen px per buffer px (SKY_PIXEL_SCALE.value)
 * @returns {number} screen px
 */
export function starTargetPx(lumFactor, skyPixelScale) {
  const lf = Number.isFinite(lumFactor) ? lumFactor : 0.7;
  if (!MAGNITUDE_LAW.value) {
    // ⛔ THE LEGACY LAW, VERBATIM, so the A/B compares against what actually shipped.
    return Math.max(16, Math.min(22, 16 + 6 * (lf - 0.55)));
  }
  const s = Number.isFinite(skyPixelScale) && skyPixelScale > 0 ? skyPixelScale : 1;
  // 0 at the luminosity floor, 1 at the ceiling. 1.45 = 2.0 - 0.55, the clamp's own span, so the
  // ramp is derived from the existing bounds rather than from a number chosen here.
  const u = Math.min(1, Math.max(0, (lf - 0.55) / 1.45));
  return SKY_CEILING_PX + s * (MAGNITUDE_MARGIN_BUFFER_PX + MAGNITUDE_SPAN_BUFFER_PX * u);
}

/**
 * Target on-screen DIAMETER of a planet/moon billboard, in screen px.
 *
 * ⭐ THE FLOOR IS THE POINT. StarfieldLayer clamps a sub-pixel star to a whole buffer pixel and
 * exempts that case from its dither discard, so the FAINTEST star in the sky is a guaranteed lit
 * pixel. PlanetBillboard had neither, so a rocky moon's dot came out at about half a buffer pixel
 * with a live discard — it samples its own falloff once and winks on and off with sub-pixel camera
 * drift. That is the "illegible" complaint in arithmetic, and the in-tree intent for the retired
 * Billboard class even said so: "Larger than background stars (1px) so moons stand out".
 *
 * ⚠ PLANETS STAY UNDER THE STAR, DELIBERATELY. The old law's whole shape was "never as big as star
 * billboards" and that ordering is still right — a planet that out-reads its own sun is wrong. The
 * fix is a floor above the STARFIELD, not parity with the star.
 *
 * @param {number} sceneRadius @param {number} skyPixelScale @returns {number} screen px
 */
export function planetTargetPx(sceneRadius, skyPixelScale) {
  const logR = Math.log10(Math.max(Number(sceneRadius) || 0.01, 0.01));
  const t = Math.min(1, Math.max(0, (logR + 1.9) / 1.73));
  if (!MAGNITUDE_LAW.value) return Math.max(4, Math.min(10, 4 + 6 * t));   // ⛔ legacy, verbatim
  const s = Number.isFinite(skyPixelScale) && skyPixelScale > 0 ? skyPixelScale : 1;
  // Floor at 2 buffer px so the smallest moon is a solid two-pixel dot rather than a flickering
  // half-pixel; span 2 more so a gas giant still reads as bigger. Both stay under starTargetPx's
  // floor of SKY_CEILING_PX + s, which is what keeps the sun the brightest thing in its own system.
  return s * (2.0 + 2.0 * t);
}
