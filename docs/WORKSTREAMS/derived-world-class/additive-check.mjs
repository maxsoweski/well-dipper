// AC-3 — THE ADDITIVE PROOF. Dump every generated body record with `worldClass` STRIPPED, run it in
// both states (git stash the generator to get HEAD) and compare the two hashes. Equal ⇒ the split
// added a field and moved nothing.
//
// ⛔ AN EQUAL HASH CANNOT PROVE ITS OWN INSTRUMENT IS LIVE. Run the liveness probe before believing
// it: disable the strip (`const strip = (o) => o || {}`) and re-run — the hash MUST move, because
// that is the only evidence the dump reads `worldClass` at all and that the equality above is the
// strip's doing rather than the script's blindness. Measured 2026-09-04:
//     stripped   4b68e420a640e62099efdc884985d2e9895f9797a4336ed9b904693eb0c6aabf  (HEAD == split)
//     unstripped c9e53ed85f6dc853ec64b5cc478d2bcc5aa53ef2bf479c907c50984216e6495b  (differs ⇒ live)
//
// original header: dump every generated body record with `worldClass` STRIPPED, so the two states are
// comparable. Any difference at all means the split was not additive.
import { createHash } from 'node:crypto';
import { StarSystemGenerator } from '/home/ax/projects/well-dipper/src/generation/StarSystemGenerator.js';
const strip = (o) => { const { worldClass, ...rest } = o || {}; return rest; };
const out = [];
for (let i = 0; i < 200; i++) {
  const sys = StarSystemGenerator.generate(`rocky-${i}`, null);
  for (const e of sys.planets) {
    out.push(JSON.stringify(strip(e.planetData || e)));
    for (const m of (e.moons || [])) out.push(JSON.stringify(m.isPlanetMoon ? strip(m.planetData) : strip(m)));
  }
}
console.log(out.length + ' records  sha256=' + createHash('sha256').update(out.join('\n')).digest('hex'));
