// Tour telemetry sampler — paste/evaluate in the game page's console (or via
// chrome-devtools evaluate_script) AFTER _lab.enterSol() + _lab.beginAutopilotTour().
// Records 1 Hz into window.__wdTourTelemetry.{meta,samples,events}. Re-running
// replaces the previous sampler. Stop with clearInterval(__wdTourTelemetry.timer).
// Dump for analyze-tour.mjs:
//   JSON.stringify({meta:T.meta,samples:T.samples,events:T.events})
// GOTCHA: star position must be read FRESH each sample (world-origin rebasing
// shifts ship+star together — a cached star position corrupts distances).
(() => {
  const nav = window._autoNav, sc = window._sc, lab = window._lab;
  if (!nav || !sc || !lab) return 'hooks missing — is the game in-system?';
  if (window.__wdTourTelemetry?.timer) clearInterval(window.__wdTourTelemetry.timer);
  const stopName = (s) => !s ? 'none'
    : s.type === 'star' ? `star${s.starIndex}`
    : s.type === 'planet' ? `planet${s.planetIndex}`
    : `moon${s.planetIndex}.${s.moonIndex}`;
  const T = window.__wdTourTelemetry = {
    samples: [], events: [], startedAt: Date.now(), timer: null,
    meta: {
      system: lab.systemInfo(),
      lingerMult: lab.getSetting('tourLingerMultiplier'),
      star: lab.starKeepOutInfo(),
      queue: nav.queue.map((s, i) => ({ i, stop: stopName(s), linger: s.linger, hasBodyRef: !!s.bodyRef, orbitDistance: +(+s.orbitDistance).toFixed(1), bodyRadius: +(+s.bodyRadius).toFixed(2) })),
    },
  };
  let lastIdx = null, lastPhase = null, lastAborts = null;
  T.timer = setInterval(() => {
    try {
      const m = sc.model, p = sc.pilot;
      const stop = nav.queue?.[nav.currentIndex] ?? null;
      const pt = p._target;
      const star = lab.starKeepOutInfo(); // fresh each sample — see GOTCHA above
      const px = m.position.x, py = m.position.y, pz = m.position.z;
      const starDist = star ? Math.hypot(px - star.x, py - star.y, pz - star.z) : null;
      // Which body dominates the speed cap (same formula as SupercruiseModel.speedCap)
      let nb = null;
      for (let i = 0; i < (m._bodies?.length ?? 0); i++) {
        const b = m._bodies[i];
        const surf = m.position.distanceTo(b.position) - b.radius;
        const cap = Math.max(1e-5, b.radius * 0.5, surf / 3);
        if (!nb || cap < nb.cap) nb = { i, R: +b.radius.toFixed(3), surf: +surf.toFixed(2), cap: +cap.toFixed(3) };
      }
      const realMesh = stop?.bodyRef ?? null;
      const distReal = realMesh?.position ? m.position.distanceTo(realMesh.position)
        : (stop?.type === 'star' && starDist != null ? starDist : null);
      const distPilot = pt?.mesh?.position ? m.position.distanceTo(pt.mesh.position) : null;
      const s = {
        t: +((Date.now() - T.startedAt) / 1000).toFixed(1),
        idx: nav.currentIndex, stop: stopName(stop),
        phase: p.phase,
        speed: +(+m.speed).toFixed(3),
        cap: +(+m.speedCap()).toFixed(3),
        nearBody: nb,
        starDist: starDist == null ? null : +starDist.toFixed(1),
        inKeepOut: star ? starDist < star.keepOut : null,
        distReal: distReal == null ? null : +distReal.toFixed(2),
        distPilot: distPilot == null ? null : +distPilot.toFixed(2),
        waypoint: !!(pt?.mesh && realMesh && pt.mesh !== realMesh), // go-around leg in flight
        stallT: +(+p._cruiseStallTimer).toFixed(1),
        bestDist: p._cruiseBestDist === Infinity ? null : +(+p._cruiseBestDist).toFixed(2),
        holdT: +(+p._holdTimer).toFixed(1),
        aborts: lab.tourStallAbortCount(),
        navActive: nav.isActive,
      };
      T.samples.push(s);
      if (s.idx !== lastIdx) { T.events.push({ t: s.t, ev: 'leg', from: lastIdx, to: s.idx, stop: s.stop, distReal: s.distReal }); lastIdx = s.idx; }
      if (s.phase !== lastPhase) { T.events.push({ t: s.t, ev: 'phase', from: lastPhase, to: s.phase, stop: s.stop, distReal: s.distReal, starDist: s.starDist }); lastPhase = s.phase; }
      if (s.aborts !== lastAborts && lastAborts !== null) { T.events.push({ t: s.t, ev: 'stallAbort', count: s.aborts, stop: s.stop, starDist: s.starDist, distReal: s.distReal, nearBody: s.nearBody }); }
      lastAborts = s.aborts;
      if (T.samples.length > 3600) T.samples.shift();
    } catch (e) { T.events.push({ ev: 'error', msg: String(e) }); }
  }, 1000);
  return 'telemetry sampler installed';
})();
