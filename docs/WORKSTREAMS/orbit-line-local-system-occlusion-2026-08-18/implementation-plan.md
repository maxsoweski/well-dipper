# Implementation Plan — `orbit-line-local-system-occlusion-2026-08-18`

Verified against the tree at HEAD `51e3c7f`, branch `feature/world-engine-production-L1`. Every line number below was opened by me. Nothing was written.

---

## 0. VERIFYING THE VERIFIERS — adjudications that changed the design

| # | Objection | Verdict | Line I opened |
|---|---|---|---|
| 1 | **F1-soundness #1**: the same-system exemption is *inert* because the finder's own `ring.radius <= R_p → continue` independently culls every same-system ring, so AC-LOCAL-RINGS-SURVIVE's revert-test can never go red | **UPHELD.** `R_p = max(|pos−C| + radius)` ≥ every local ring's own radius by construction, so the radius predicate subsumes the exemption. **Design change: the radius predicate is DELETED.** Predicate is exemption + 3-D containment only | logic on the finder's own ordering; `src/physics/Barycentre.js:113` `return { r1: a * massFraction, r2: a * (1 - massFraction) };` |
| 2 | **F2-soundness #1**: finder 2's screen-space circle carries no depth term, so it erases a near ring that merely *overlaps* a far local system | **UPHELD, decisive. Finder 2's geometry is REJECTED**; finder 1's world-space test is adopted | `src/objects/OrbitConicField.js:339` `wclip = arc.z < 1.0e30 ? arc.z : arc.y;` — every other reject here is depth-aware; a screen-coverage test is not |
| 3 | **F1-soundness #3**: masking a root also removes it from `acc.z`, the min-covering clip-w, so the depth/argmax claim "no change" is false | **UPHELD as a correction, not a design change.** It is the *intended* behaviour; documented in §6 | `:204` `if (r.x <= reach && r.y < acc.z) acc.z = r.y;` and `:339` |
| 4 | **F1-soundness #4** / prox-fade revival | **SPLIT.** Overruled on the mechanism — the retired fade's kill radius scaled with the **ORBIT** radius; this disc's radius is the local system's and is camera-independent. **Upheld on the guard**: finder 1's `\|camPos−centre\| <= R_p → skip` produces a one-frame pop. **Design change: that guard is DELETED** | `:571-574` `// ORBIT radius, not the body being approached (near = max(0.35, 0.02*R)), so on` / `// a r=67622 ring the line died 1352 units out while the planet was ~1 unit` |
| 5 | **F1-soundness #6 / F3-soundness #1**: the bounding/`offsetMax` radius formula exceeds AC-APPLIES-GENERALLY's stated observable | **UPHELD.** **Design change**: disc radius is derived from **ring geometry only** and reduces *exactly* to `max(ring.radius)` whenever the local rings share a centre — which is every case the AC enumerates. No mass data, no `barycentreOffset`, no main.js edit | `src/main.js:11344-11352` (bary branch vs `line.mesh.position.copy(entry.planet.mesh.position)`) |
| 6 | **F1-soundness #2**: `DISC_MAX = 8` was justified from a comment, and the comment is stale | **UPHELD.** Verified: `grep -c '^      moonCount:' SolarSystemData.js` = 14 (13 records + the mapper at `:736`); 13 `moons: [` of which 5 are `[]` ⇒ **8 moon-bearing**. `SolarSystemData.js:349` = `      moonCount: 9,` falsifies `OrbitConicField.js:48`'s "1+6 moons". Number kept, justification rewritten | ran `tools/barycentre-probe.mjs` §3 — lists exactly 8 moon-bearing Sol planets |
| 7 | **F2-soundness #3**: `ownerBit = 1<<planetIndex` vs keep-out slot `k` are different index spaces | **UPHELD**, and moot — this design has no owner bit; the exemption never reaches the GPU | `:530` `for (let i = 0; i < pl.length; i++) {` (runs over *all* planets, not moon-bearing ones) |
| 8 | **F4-soundness #1**: finder 4's "exempt a ring belonging to the same planet" would erase the very ring the workstream exists to cut | **UPHELD.** The identifier is **local-system membership**, not planet ownership | `src/main.js:7934` `{ type: 'planet', planetIndex: i }` vs `:7940` `{ type: 'moon', planetIndex: i, moonIndex: m }` — same `planetIndex` |
| 9 | **F3-soundness #2**: "there is no single winning `cs`" — `arcFold` maintains two winners | **OVERRULED as a design objection.** It correctly refutes finder 3's plan to *thread `cs` out of* `frontArcSolve`. It does not touch the ruled design, which masks the root **inside `arcRoot`**, before either accumulator sees it. Dissolved by placement | `:202-206` (`arcFold`), `:194-199` (`arcRoot`) |
| 10 | **F2/F4**: "contract's `OrbitConicField.js:75-104` for the angular fade is comment only" | **OVERRULED.** `:79` `const ANGULAR_FADE_LO_FRAC = 0.5;` and `:98` `const CONIC_WCLIP_TIE_EPS = 0.005;` are executable and inside the span. The span is *imprecise*, not comment-only | `:79`, `:98` |
| 11 | **F4 headline**: `conic-gl-gate.mjs` no-op FATAL is blast-radius **#1** | **OVERRULED as ranked.** I opened all 22 mutant targets at `tools/conic-gl-gate.mjs:170-199`. This design touches **none** of them: it inserts lines, never re-indents `:324`, never edits the `arcAxis` call in `frontArcSolve`, never edits `if (!(w > 0.0)) return vec2(1.0e30, 0.0);` or `arcRoot`'s return. Downgraded to rank 5. (Also: M12's real target has **four** leading spaces, M16's **two** — both finders misquoted it as one) | `tools/conic-gl-gate.mjs:185` `  ['M12-drop-arcgate', (s) => s.replace('    if (arc.x > uArcTolPx) continue;\n', '')],` |
| 12 | **F4 blast-radius #4**: "3 adapter tests throw on the `{ moonOrbitLines: [ring] }` fixture" | **OVERRULED twice.** Only one fixture puts anything in `system.planets`; and the disc builder reads only `.radius` / `.mesh.visible` / `.mesh.position`, all of which a real `OrbitLine` has. Zero fixture risk | `src/objects/__tests__/OrbitConicField.system.test.js:98` `      planets: [{ moonOrbitLines: [moonRing] }],` |
| 13 | **F4-citation #3**: `main.js:7635-7755` / `:11260-11350` / `:7936-7941` are not contract refs | **UPHELD.** `grep` over `contract.json` + `intent.md` returns exactly one main.js ref: `main.js:~7011`. Those spans came from the task brief. Corrections in §8 are attributed accordingly | `contract.json` line 92 |
| 14 | **F3-citation #1**: binary-separation floor is star-size dependent; 0.078 AU is the G+G case | **UPHELD** (M+M ⇒ ~0.058 AU). It *tightens* finder 3's margin rather than loosening it — but the ruled design is geometric, so the margin never enters the predicate | `src/generation/StarSystemGenerator.js:333` `const starSumAU = (star.radiusSolar + star2.radiusSolar) * SOLAR_RADIUS_AU;`, `:83` M `radiusSolar: 0.3` |
| 15 | Off-by-ones: `:573` misquote (`:572` is the "ORBIT radius" line), "shader reads only `t9.z`" (`:321` reads `t9.x`/`t9.y`) | **UPHELD**, cosmetic. Correct statement: **`t9.w` is never read by the shader** — which is what the design needs | `:321-322`, `:572-573` |

---

## 1. THE DECISION

**Keep-out geometry.** A **world-space ball** — centre and radius taken from the planet's own local ring set — tested against the **3-D point on the occluded ring's own circle that this pixel is painting**, expressed in that ring's local plane frame; not a screen circle and not a projected-disc sign test, because only a 3-D test can distinguish "passes inside" from "passes in front of," which is exactly what AC-NO-COLLATERAL-OCCLUSION forbids conflating, and because it never touches `adj(H)`, whose rank-1 collapse at grazing (`ringConic.js:37-47`, `OrbitConicField.js:304-312`) is the regime the whole front-arc workstream exists to escape.

**Data path.** The **same** `RGBA32F` DataTexture the field already owns, extended from 10 to 18 rows, with the per-ring disc list pre-transformed into that ring's local frame on the CPU and a per-ring disc count riding row 9's one genuinely spare float (`:660` / `:673` `src[o9 + 3] = 0`, never read by `readConic`) — not a second texture and not a uniform array, because `tools/conic-gl-gate.mjs:213` bakes `ROWS=${CONIC_TEX_ROWS}` into its page and `:243` uploads `f._source` generically, so a new row travels to the GPU with **zero gate edits**, whereas a second sampler or a named uniform needs a hand edit at `:248-251` (which enumerates uniforms *by name*) or the gate silently runs blind and reports a false green.

**Predicate.** A ring is masked at a pixel iff the circle point it is painting lies inside a disc that does **not** belong to the ring's own local system — two terms, no radius comparison, because the radius comparison is what made the exemption dead code (adjudication #1) and because a 3-D containment test already excludes every foreign ring by thousands of scene units.

**Where the finders disagreed, and the rulings:**

- *Separate texture (F1) vs new rows in the existing one (F2).* → **F2.** The file names itself "the single shipping data path" (`:29-30`), and the gate/test evidence is one-sided: `OrbitConicField.test.js:177-182` pins dims against the exported constants (tautological — stays green at 18 rows), `tools/conic-gl-gate.mjs:76` copies `_source` wholesale. A second texture costs a sampler uniform, a second `needsUpdate`, a `dispose()` line, and a gate edit, and buys nothing.
- *Screen-space disc (F2) vs world-space ball (F1/F3).* → **F1/F3.** Depth-blindness is disqualifying (adjudication #2).
- *Mask inside `arcRoot` (F1) vs thread the winning `cs` out of `frontArcSolve` (F3).* → **F1.** F3's route is refuted by its own reviewer (`arcFold` at `:202-206` keeps two independent winners) *and* it would change the `arcAxis` call line that mutant M16 replaces literally, FATALing the gate. Masking at the root is immune to both.
- *Disc radius from masses + `offsetMax` (F3) vs from ring radii (F1).* → **F1's source, with F3's bounding form.** See §3.
- *Keep the redundant `ring.radius > k.radius` term as a fail-safe (F3) vs drop it.* → **DROP.** F3's own fail-safe is what disarms the exemption (adjudication #1). A fail-safe that silently converts the AC's falsification test into a no-op is worse than no fail-safe.
- *`DISC_MAX` 8 (F1) vs `KEEPOUT_MAX` 16 (F2).* → **8**, but bounding the *disc list*, not the per-ring count — see §3.

---

## 2. THE SEAMS

Ordered. Every line verified at `51e3c7f`. **Zero edits to `src/main.js`.**

| # | File : line | Function | Change |
|---|---|---|---|
| 1 | `src/objects/OrbitConicField.js:48-51` | — | Fix the stale inventory comment (Sol's Saturn is `moonCount: 9`, `SolarSystemData.js:349`; Sol carries 13 planet records, so the "8 planets × (1+6 moons)" arithmetic is not how the real worst case is reached). `CONIC_MAX = 64` **unchanged**. |
| 2 | `:53-73` | — | Fix the row-layout comment (it says "the 8 rows" at `:54` while `CONIC_TEX_ROWS` is 10 — already stale). Document rows 10-17. Raise `export const CONIC_TEX_ROWS = 10;` (`:73`) → `18`. |
| 3 | new, beside `:73` | — | `export const KEEPOUT_MAX = 8;` + the justification comment (§3). |
| 4 | `:189` (file scope, above `arcRoot`) | GLSL | Add `int gRing = 0; int gNK = 0;` with the note that these are per-pixel-per-ring scratch, not temporal state. |
| 5 | `:194-199` | GLSL `arcRoot` | Insert the disc loop **after** `if (!(w > 0.0)) return vec2(1.0e30, 0.0);` (`:197`) and **before** the return (`:198`). ⛔ Do not modify either of those two lines — M15 and M20 replace them literally (`tools/conic-gl-gate.mjs:188`, `:197`). |
| 6 | between `:319` and `:320` | GLSL `main` | `gRing = i; gNK = int(t9.w);` — one inserted line. `t9` is already fetched at `:319`; no extra texelFetch, and a fully-masked ring is dropped at `:324` **before** the two `arcAxis` calls, the loop's only `sqrt`s. |
| 7 | `:520-542` | `updateFromSystem` | Build the disc list once (`this._buildOccluderDiscs(system)`), pass the planet index into `_appendRing(mo[j], i)` at `:532` and `-1` at `:525`/`:527`, and forward the list at `:540` → `this.update(view, camera, viewport, discs)`. |
| 8 | new, after `:542` | `_buildOccluderDiscs(system)` | See §3. Reads only `moonOrbitLines[j].radius`, `.mesh.visible`, `.mesh.position`. Zero-alloc pooled, same discipline as `_descPool`. |
| 9 | `:549-553` | `_appendRing(ring, systemId = -1)` | Pooled descriptor literal at `:553` gains `localSystemId: -1`; set `d.localSystemId = systemId`. Opaque integer — keeps the Slice-B "knows NOTHING about OrbitLine" contract at `:39-45` intact, exactly as `alpha` names no hover concept. |
| 10 | `:587` | `update(descriptors, camera, viewport, discs = null)` | 4th optional arg. Per ring: cull + transform + pack (§4). **All 10 existing call sites are 3-arg** — 6 in `OrbitConicField.test.js` (`:60/74/93/105/189/209`), `ringConic.extent.test.js:200`, `ringConic.frontarc.test.js:258`, the internal `:540`, and **`tools/conic-gl-gate.mjs:62`** (which both finder 2 and finder 4 omitted). `discs = null` ⇒ `nk = 0` ⇒ byte-identical behaviour. |
| 11 | `:632-677` | `_packRing(..., nk, discBuf)` | `src[o9 + 3] = nk` in **both** branches (`:660` and `:673`). Add `const oK = o9 + stride;` and write rows 10..10+nk-1 at `oK + k*stride`. Slots past `nk` are deliberately **not** cleared — the shader breaks at `nk`, the same reasoning `docs/PARKING_LOT.md:206-213` gives for stale `_source` past `uCount`. |
| 12 | `:685-706` | `readConic(i)` | Return `keepOutCount: src[o9 + 3]`. Add `readOccluder(i, k)` returning `{cx, cz, reff2}` for tests. |
| 13 | `src/objects/ringConic.js:371-385` | `arcRootEval` | Add the same mask, as trailing optional params `(…, discs = null, nDisc = 0)` threaded through `arcSolve` / the JS `arcAxis`. ⚠ The JS mirror and the GLSL do **not** share a signature today anyway (`arcRootEval` takes `(Hfwd, rowW, radius, px, py, c, s, out)`; `arcRoot` takes `(fh0, fh1, fhw, rw, radius, pix, cs)`) — "byte-mirror" here means numerical parity. Params in JS, globals in GLSL, is the correct asymmetry: it keeps M16's literal target intact. |
| 14 | `ringConic.js:451`, `:480` | `frontArcDistPx`, `frontArcDepthW` | Trailing optional `discs`, defaulting to none — every existing mirror test stays byte-identical. |

**Corrections to spans the task brief carried** (the *contract* carries none of these — see §8): moon-ring construction is `:7713-7724`, the primary ring `:7741-7748`, the position fix-up `:7749-7752`, the heliocentric ring `:7761-7765`; the per-frame ring writes are `:11333-11353` inside the planet loop opened at `:11257`; `_orbitLineTargets` is `:7931-7942`.

---

## 3. THE PACKING

### Row 9, slot 3 — the per-ring disc count

Currently `src[o9 + 3] = 0` at `:660` (conic branch) and `:673` (null branch); `readConic` reads `o9+2` for `hScale` and stops (`:696`); the shader's only row-9 reads are `t9.x`, `t9.y` (`:321`) and `t9.z` (`:322`). **`t9.w` is dead.** It now carries `nk ∈ [0, 8]` — exact in float32.

### Rows 10..17, column *i* — ring *i*'s *k*-th applicable disc

One texel. The circle point `arcRoot` builds at `:195` is `q = vec3(radius*cs.x, radius*cs.y, 1.0)`, and `q.xy` **is** `(X, Z)` in the ring's own plane — `ringConic.js:211`: *"columns [0,2,3] (the local-Y column is dropped — the ring is a planar circle)"*, corroborated by `OrbitLine.js:59-63` baking the perimeter as `(cos·r, 0, sin·r)` in object space. So the disc is pre-transformed into that frame CPU-side:

| slot | value | why |
|---|---|---|
| `.x` | `cx` — disc centre's local **X** | matches `q.x` |
| `.y` | `cz` — disc centre's local **Z** | matches `q.y` |
| `.z` | `Reff2 = R² − cy²` — squared radius of the ball ∩ ring-plane circle | `cy` is the out-of-plane offset; folding it in makes the per-pixel test 2-D |
| `.w` | `0` | reserved |

⛔ **Subtract before squaring.** The closed-form `cos(θ−φ) > K` variant is a float32 trap: at a real ring radius of 67622 (`OrbitConicField.js:573`, `ringConic.frontarc.test.js:233` iterates that radius) against a ~20-unit ball, `1 − cos Δθ ≈ 4e-8`, below float32 resolution near 1, and the gap vanishes silently. `precision highp float;` is declared at `:157`.

### The iteration constant

```js
// Per-frame occluder-disc ceiling, sized the way CONIC_MAX is. This bounds the
// DISC LIST, not the per-ring count — so truncation is IMPOSSIBLE, not merely
// unlikely: nk <= (number of discs) <= (number of moon-bearing planets).
//   procgen: the largest planetRange upper bound is 8 (StarSystemGenerator.js:80-81,
//            F and G), and the roll is clamped to it (:499).
//   known:   :502 `Math.max(rolledPlanetCount, knownSorted.length)` is the one path
//            that can exceed the roll. Its only shipped instance is Sol, which has
//            13 planet RECORDS of which exactly 8 carry moons (SolarSystemData.js:
//            5 of the 13 `moons:` lists are empty; verified by tools/barycentre-probe.mjs
//            section 3, which enumerates earth/mars/jupiter/saturn/uranus/neptune/
//            pluto/eris and nothing else).
// Headroom is free at runtime: the shader loop breaks on the per-ring nk exactly as
// the ring loop breaks on uCount (OrbitConicField.js:252), so the bound costs
// compile-time unroll capacity and 8 texture rows (4 KB) only. Should a future system
// exceed 8 moon-bearing planets, discs are dropped SMALLEST-RADIUS-FIRST, the same
// least-visible-first drop discipline CONIC_MAX uses at :49-50.
export const KEEPOUT_MAX = 8;
```

Texture grows `64 × 10 × 4` → `64 × 18 × 4` floats = 10 KB → 18 KB, well under the 2048 `MAX_TEXTURE_SIZE` floor the layout test asserts at `OrbitConicField.test.js:179-180`.

### The disc itself (CPU, `_buildOccluderDiscs`)

```
for each planet index i, mo = planets[i].moonOrbitLines:
    consider only rings with mesh.visible                    // matches _appendRing's own gate at :550
    if none: no disc for planet i                            // AC-APPLIES-GENERALLY: planet 0 gets nothing
    out = the ring with the largest .radius
    out.mesh.updateMatrixWorld(true)
    C = out.mesh world position
    R = max over the planet's visible local rings of ( |ring.mesh.position − C| + ring.radius )
    emit { centre: C, radius: R, systemId: i }
```

**Why this exact form.** When all of a planet's local rings share a centre — which is *every* case AC-APPLIES-GENERALLY enumerates (wd-10 planet 3: both rings `_baryCentred`, both written to `(px,0,pz)−worldOrigin` at `main.js:11345-11349`; wd-10 planet 4: undominated, all rings on `entry.planet.mesh.position` at `:11351`) — the `|pos − C|` term is exactly 0 and `R` reduces to **`max(ring.radius)`**, which is the AC's literal observable. For planet 3 that is `r2 = 19.5492` primary radii, exactly AC-GAP's stated endpoint number. The bounding form only bites on a *mixed* planet (a dominated pair carrying an extra non-dominant moon). `tools/barycentre-probe.mjs` §2 reports `max moons on a DOMINATED planet: 2` across FENCE-221 and §3 shows Sol's Saturn is dominated (share 0.997) with 9 moons and an excursion of 0.530 planet radii — i.e. the excess there is ~1 % of the outermost ring radius. Correct and invisible.

**No mass data, no `barycentreOffset`, no `_domRings`, no `entry.planet`.** That is deliberate: it is what keeps `main.js` untouched (dissolving `tests/barycentre-render.test.js:177`'s `lastIndexOf` anchor risk entirely) and what keeps `OrbitConicField.system.test.js:98`'s bare `{ moonOrbitLines: [moonRing] }` fixture working.

**Not covered: moon bodies.** They are already occluded by the depth buffer — `depthTest: true, depthWrite: true` (`:431-433`) at `renderOrder` 999, *"draw after opaque bodies (occlusion depth already written)"* (`:392`). Growing the disc by a body radius would widen the gap past the local system for nothing.

---

## 4. THE PREDICATE

### CPU, once per (ring *i*, disc *k*), inside `update()`

```
nk = 0
for k in discs:
    // ── (a) THE SAME-SYSTEM EXEMPTION. Load-bearing and ALONE.
    //     ⛔ localSystemId, NOT "which planet owns this ring": orbitLines[i] is
    //     planet i's OWN heliocentric ring and is exactly what must be cut, so it
    //     carries -1. Only rings from planets[i].moonOrbitLines carry i.
    if (desc.localSystemId >= 0 && desc.localSystemId === k.systemId) continue

    // ring i's matrixWorld is RIGID — rotation.x + position only, never scale
    // (no `.scale` write exists in OrbitRingSDF.js or OrbitLine.js; WorldOrigin.js:169
    //  writes position only) — so the basis columns are orthonormal and this is
    // three dot products, no matrix inverse.
    v  = k.centre − translation(mw)
    cx = v·col0 ;  cy = v·col1 ;  cz = v·col2
    Reff2 = k.radius*k.radius − cy*cy
    if (Reff2 <= 0) continue                             // ball misses the ring's plane entirely
    d   = hypot(cx, cz)
    gap = d − desc.radius
    if (gap*gap >= Reff2) continue                       // the circle never enters the disc
    pack (cx, cz, Reff2, 0) at row 10+nk, column i ; nk++
    if (nk === KEEPOUT_MAX) break
pack nk into src[o9+3]
```

### GPU, inside `arcRoot`

```glsl
vec2 arcRoot(vec3 fh0, vec3 fh1, vec3 fhw, vec3 rw, float radius, vec2 pix, vec2 cs) {
  vec3 q = vec3(radius * cs.x, radius * cs.y, 1.0);
  float w = dot(fhw, q);
  if (!(w > 0.0)) return vec2(1.0e30, 0.0);          // ⛔ UNCHANGED — M15 replaces this literally

  for (int k = 0; k < ${KEEPOUT_MAX}; k++) {
    if (k >= gNK) break;
    vec4 d = texelFetch(uData, ivec2(gRing, 10 + k), 0);
    vec2 e = q.xy - d.xy;                              // q.xy IS (X, Z) in the ring's own plane
    if (dot(e, e) < d.z) return vec2(1.0e30, 0.0);     // inside the solid — this root does not exist
  }
  return vec2(length(vec2(dot(fh0, q), dot(fh1, q)) / w - pix), dot(rw, q));  // ⛔ UNCHANGED — M20
}
```

The `1.0e30` sentinel is the file's *existing* "this root does not count" encoding (`:197`), and a fully-masked ring is already dropped by the existing gate at `:324` `if (arc.x > uArcTolPx) continue;`. **No new discard, no new alpha channel, no new uniform, no new sampler.**

### Walked against the r1-inside-r2 trap, with real numbers

wd-10 planet 3, dominated pair. Both rings are `_baryCentred` (`main.js:7719`, `:7745`) and both are written to the same point each frame (`:11345-11349`) and at spawn (`:7750`). The r1 ring (5.5332 primary radii) is pushed into the **same** `moonOrbitLines` array as the r2 ring (19.5492) at `main.js:7747`.

- Disc for planet 3: `C` = the r2 ring's position, `R` = `max(19.5492, |0| + 5.5332)` = **19.5492**, `systemId = 3`.
- **r1 ring**: `localSystemId = 3` (appended from `planets[3].moonOrbitLines` at `:532`) `=== k.systemId` → **exempt at term (a)**. `nk = 0`. Ring drawn in full. ✓ **AC-LOCAL-RINGS-SURVIVE.**
- **Revert the exemption** (the AC's own falsification test): `v = 0` ⇒ `cx = cy = cz = 0`, `Reff2 = 19.5492²`, `d = 0`, `gap = −5.5332`, `gap² = 30.62 < 382.17` → **not culled**, disc packed. Every θ then satisfies `|q.xy − (0,0)|² = 5.5332² = 30.62 < 382.17` → every root masked → `arc.x` stays `1.0e30 > uArcTolPx` → **r1 erased in its entirety**. The unit assertion goes red. ✓ **The exemption is the only thing protecting it — which is precisely what adjudication #1 forced.**
- **r2 ring** (were it not exempt): `gap = −19.5492`, `gap² = 382.17`, `Reff2 = 382.17` → `>=` → culled by the geometric test. Fail-safe direction (ring survives), but it rests on a float equality; the exemption is what makes it deterministic. Say so in the comment.
- **Planet 3's heliocentric ring**: `localSystemId = −1` (appended at `:527`) → **not exempt**. Its circle is centred on the system origin and passes exactly through the barycentre `(px, 0, pz)`, so `d = orbitRadius`, `gap ≈ 0`, `gap² < Reff2` → disc packed, one arc erased. ✓ **AC-GAP.**
- **Both binary-star rings**: `localSystemId = −1`, centred on the system origin with radii `sep·q/(1+q)` and `sep/(1+q)` (`main.js:7539-7540`), thousands of scene units from any planet's barycentre → `gap² ≫ Reff2` → **culled, `nk = 0`, fully drawn.** ✓ **AC-NO-COLLATERAL-OCCLUSION.**
- **A neighbouring planet's moon ring**: different `systemId`, and its circle is an orbit-separation away from this disc → culled by geometry. Not by a radius comparison, which is why the radius comparison was deletable.

### Exactly one gap, provable

For circle radius *r* about the local origin and disc centre `(cx, cz)`:
`|P(θ) − C|² = r² + cx² + cz² + cy² − 2r(cx cos θ + cz sin θ)`.
The masked set is `{θ : cx cos θ + cz sin θ > K}` = `{θ : cos(θ − φ) > K′}` — **one contiguous arc, at every camera pose, by construction**, because the predicate contains no camera term at all. Its endpoints satisfy `|P − C| = R` in 3-D exactly. That is AC-GAP's *world*-distance reading; the *screen* reading agrees only where the heliocentric ring and the local system are near-coplanar (see §9).

---

## 5. THE TEST PLAN

| AC | Layer | Assertion | Red at parent? |
|---|---|---|---|
| **AC-APPLIES-GENERALLY** | unit | `buildOccluderDiscs(wd10Shaped)` → one disc per planet with ≥1 visible moon ring; **none** for planet 0; disc for planet 3 has `radius === max(mo.map(r => r.radius))` and `systemId === 3`; a disc exists for planet 4 (undominated, 3 moons) | **Red by non-existence** — the function does not exist at parent. Weak; state it as such in the evidence file rather than claiming a behavioural red |
| **AC-LOCAL-RINGS-SURVIVE** | unit (new) + integration (contract) | Unit: `field.updateFromSystem(pairFixture, cam, vp)` → `field.readConic(idxOfR1).keepOutCount === 0`. Live: two rings still drawn about the empty point at 5.53 and 19.55 primary radii, inner one continuous | **Red by mutation, not by parent.** Delete the `localSystemId === systemId` line → `keepOutCount` becomes 1 → red. Walked in §4 with numbers. At parent it passes trivially (no occlusion exists). ⛔ Do not claim a parent red this test cannot deliver |
| **AC-RING-BUDGET-AND-PERF** | unit + live | Unit: `field.count` identical before/after on the same system; `CONIC_MAX === 64`; `field.textureWidth === 64`; `KEEPOUT_MAX` is exported and finite; `CONIC_FRAGMENT_SHADER` contains the literal `k < 8` loop header; the disc array is a distinct object, not `descriptors`. Live: frame-time, same seed, frozen pose, same window, **parent commit vs build commit, page RELOADED between arms**, N ≥ 300 frames per arm, report median + p95 + delta | Descriptor-count assertion is a **fence**, not a parent-red — it is 16 at parent and must stay 16. Say so. The perf number has no parent-red at all |
| **AC-HIT-TESTING-UNCHANGED** | unit fence + integration | Fence: after `updateFromSystem` with discs live, every registered ring's `mesh.visible` and `mesh.userData.orbitHitPositions.count` are unchanged. Live: click inside and outside the gap, same planet selected both times | **Red by mutation.** Implement the mask as `mesh.visible = false` and `main.js:7006` `if (!mesh.visible) continue;` makes the span unclickable → fence red. Satisfied *by construction* otherwise: `hitTestOrbits` reads only `_orbitLineTargets`, `mesh.visible`, its own `updateMatrixWorld` (`:7007`), `mesh.userData.orbitHitPositions` (`:7013`) and the camera |
| **AC-NO-COLLATERAL-OCCLUSION** | unit + integration | Unit: `readConic(starRing).keepOutCount === 0` for both star rings; same for a neighbouring planet's moon ring. Live: the same 16 ring proxies enumerate before and after | ⚠ **The contract's own observable (16 proxies present) passes trivially with or without the feature** — the descriptor list is untouched by any shader-side mask. It is not a test of the predicate. The `keepOutCount` assertions are the real test; recommend amending the AC |
| **AC-GAP** | unit core + integration | Unit: run the JS mirror over 360 θ samples → the masked set is **exactly one contiguous run**, and both endpoints satisfy `\|P − C\| === R` within float tolerance. Live: sample the rendered image along the heliocentric ring's screen path → one contiguous unlit span, no lit pixels inside | Unit is red-by-non-existence. Live half is genuinely red at parent (there is no gap) — the one AC with a real parent red |
| **AC-UAT** | uat | **Max's gate alone. `deferred-to-max`. No agent ever PASSes it.** `verify-workstream` marks it `deferred-to-max`, never PASS | n/a |

**Staging note for AC-UAT** (working-Claude's job, not this plan's): park Max in the live game and show him three things — the pair, an ordinary multi-moon planet, and a close approach where the camera is *inside* the local system.

---

## 6. WHAT WILL BREAK

Ranked by likelihood × cost.

1. **`npm run check:instruments` → Instrument A drift, exit 1. CERTAIN.** `scripts/test-baseline.mjs:445-446` sets `drift = true` on any change to the collected-file set or any per-file test count; `EXTRA_EXCLUDE` at `:90` excludes only `.claude` and `scratchpad`. Every new test reds it. Fix: one deliberate `npm run test:baseline:record` at the end with the reason named. Not a failure — but it needs Max's OK once.
2. **Depth changes inside the erased span. CERTAIN, and intended.** `arcFold` at `:204` folds each root's `w` into `acc.z`, the min covering clip-w, and `:339` makes that the ring's `wclip`, the sole input to the argmax at `:356`. Masking the near root removes it from that minimum, so near edge-on — the pose `:331-334` documents, where near *and* far points both cover one pixel — the ring now depth-sorts on the far root and can lose a pixel it previously won. No existing assertion pins this; the gate's depth checksum (`tools/conic-gl-gate.mjs:285` `depthSum`) *would* catch it, but its fixtures pass no discs so `nk = 0` and it stays green. **Correcting finder 1's claim of "no change to the overlap/argmax selection" — that claim is false.**
3. **`OrbitConicField.js:53-54`'s row-layout comment goes wrong twice over** (already says "the 8 rows" at 10 rows). Must be rewritten, not appended to.
4. **The descriptor pool literal at `:553` gains a field.** I grepped for assertions on that object's shape and found none — the closest are `expect(field.readConic(0).active).toBe(1)` (`OrbitConicField.test.js:63/76/95`, `system.test.js:147`), which read `t2.w`, untouched. Low risk, but `readConic`'s return shape also grows.
5. **`npm run check:conic-gl` no-op FATAL** (`tools/conic-gl-gate.mjs:302-307`, which fires *before* the Chrome check at `:309`, so it triggers inside the sandbox). I opened all 22 mutant targets at `:170-199`; **this design touches none of them**. M12's target is `'    if (arc.x > uArcTolPx) continue;\n'` (four leading spaces) and M16's is `'  acc = arcAxis(fh0, fh1, fhw, rw, radius, pix, 1, reach, acc);\n'` (two) — neither line is re-indented or edited. M15 and M20 sit inside `arcRoot`, on the two lines the insert goes *between*. **Downgraded from finder 4's rank 1 to rank 5 — but RUN IT ANYWAY after every shader edit**, and note that the gate gives the new code **zero mutation coverage** (its fixtures pass no discs). Recommended follow-on, not required by any AC: one keep-out fixture + `M23-drop-disc-mask` / `M24-disc-mask-inverted`.
6. **Dissolved, listed so nobody re-raises them.** (a) `tests/barycentre-render.test.js:177`'s `lastIndexOf('for (const line of entry.moonOrbitLines) {')` anchor — this design makes **zero** `main.js` edits, and the two existing loops (`:10604`, `:11343`) are untouched. (b) `OrbitConicField.system.test.js:98`'s bare `{ moonOrbitLines: [moonRing] }` fixture — the disc builder reads only ring geometry. (c) `OrbitConicField.test.js:177-182` textureRows — both sides use `CONIC_TEX_ROWS`, tautological. (d) `:237-238` no `inverse(`/`transpose(` — all transforms are CPU-side hand-written dots. (e) `OrbitRingSDF.proxfade.test.js:207`'s alpha pin — alpha is never touched; the mask is a root reject, so it composes with the angular fade at `:344` rather than double-counting (the reject happens before `a` is formed). (f) `ringConic.frontarc.test.js:271-274`'s `uArcTolPx` pin — `setBand` untouched. (g) `tools/conic-gl-gate.mjs` — uploads `_source` generically at `:76`/`:243` with `ROWS=${CONIC_TEX_ROWS}` at `:213`, so the new rows travel with no gate edit and no new uniform.

---

## 7. OPEN QUESTIONS FOR MAX

Two, both UAT-stage observations rather than pre-code blockers. Everything else I ruled.

1. **Camera inside a local system.** The predicate is camera-independent, so when you fly in among a planet's moons the heliocentric line still has its gap — a gap that now surrounds you rather than sitting out ahead. The alternative (disable the disc once the camera is inside it) removes that, at the cost of a hard one-frame pop as you cross the boundary. **I ruled for the gap** — no pop, geometrically honest, and unlike the fade you killed on 2026-08-01 the erased extent is fixed in world space and scales with the *local system*, not with the orbit radius. Flagging it because it is a visible behaviour at a pose you fly through constantly. Recommend: look at it live before ruling.
2. **The far arc.** The ball erases the arc that passes *inside* it, not the arc that passes screen-behind it. Looking nearly down a heliocentric ring's tangent, the far half of the orbit still draws across the local system's screen area — geometrically correct (that arc is genuinely not inside the solid), but it may read as "not working." Closable later by an additive depth-guarded silhouette clause; deliberately out of v1 because that clause reintroduces screen-space reasoning and needs your eyes to justify. Recommend: judge it at UAT, not now.

---

## 8. STALE REFS FOUND

**In `contract.json`:**

| Cited | Correct at `51e3c7f` |
|---|---|
| `"The angular-size fade (OrbitConicField.js:75-104)"` | Imprecise, **not** comment-only (`:79` `const ANGULAR_FADE_LO_FRAC = 0.5;` and `:98` `const CONIC_WCLIP_TIE_EPS = 0.005;` are executable, and `:98` is unrelated to the fade). Precise refs: `:75-79` band comment + `LO_FRAC`, `:107` `DEFAULT_ANGULAR_CUTOFF_PX`, `:121-129` JS mirror `angularFadeFactor`, `:174-177` GLSL `angularFade`, `:344` the multiply |
| `"worst system stays at 27 of 64 — measured by tools/barycentre-probe.mjs"` | **The probe does not print it.** I ran it: §2 prints `worst-case rings for one planet (moons + extra): 6`; the `27` that appears in §1 is the **companion-pair count** across FENCE-221, not a per-system descriptor total. Either extend the probe with a per-system total or cite the derivation |
| `"one entry per moon-bearing planet, worst case 8 in FENCE-221"` | **8 is Sol's number, not FENCE-221's.** Probe §3 enumerates exactly 8 moon-bearing Sol planets (earth, mars, jupiter, saturn, uranus, neptune, pluto, eris). The probe prints no per-system moon-bearing-planet count for FENCE-221 |
| `"main.js:~7011"` | The executable read is **`:7013`** — `const posAttr = mesh.userData.orbitHitPositions \|\| …`. `:7011` lands inside the explanatory comment |
| `"docs/PARKING_LOT.md:236-243"` | Straddles two blocks; the follow-up list is `:230-237` and the sequencing note `:239-241` (which is what `intent.md` cites, correctly) |
| `AC-NO-COLLATERAL-OCCLUSION`: *"an asteroid-belt ring"* | **Names an object that cannot exist.** `updateFromSystem` reads only `starOrbitLines` (`:524`), `orbitLines` (`:526`), `planets[i].moonOrbitLines` (`:531`); `system.asteroidBelts` (`main.js:7841`) is not among them, and there are exactly five `new OrbitLine(` sites in production code (`main.js:7551, 7555, 7718, 7742, 7761`), none a belt. Vacuous clause — correct it rather than test around it |

**In the task brief** (`contract.json` carries no `main.js` line ranges at all — `grep` returns only `main.js:~7011`):

`main.js:7635-7755` → the span is right; ring construction is `:7713-7724`, primary ring `:7741-7748`, position fix-up `:7749-7752`, heliocentric ring `:7761-7765`. `main.js:11260-11350` → the planet loop opens at `:11257` and the ring-write block is `:11333-11353`. `main.js:7936-7941` → the block is `:7931-7942` (map reset `:7932`, planet register `:7934`, moon register `:7939-7941`).

**In-file, pre-existing:**

`OrbitConicField.js:53-54` says *"the 8 rows"* at `CONIC_TEX_ROWS = 10`. `:48` says *"8 planets x (1+6 moons)"* — Sol's Saturn is `moonCount: 9` (`SolarSystemData.js:349`) and Sol carries 13 planet records. `:497` cites `main.js :11210` for the hover material write; `:11210` at HEAD is a deep-sky comment. `:556` cites `main.js:4119` for `hitTestOrbits`' per-mesh sync; the real one is **`main.js:7007`**. `docs/PARKING_LOT.md:209` cites `OrbitConicField.js:177-178` for the shader's early break; it is **`:251-252`**. `docs/PARKING_LOT.md:237` says *"none encountered in normal play exceeded 39 rings"* — Sol now reaches 44 (13 heliocentric + 26 moon + 5 barycentric extras, from probe §3).

---

## 9. NOT FOUND

1. **A measured frame-time number, and any harness that could produce one.** `tools/conic-gl-gate.mjs` has no clock (its oracle at `:285` returns `painted/rows/wMin/wMax/debris/worstPlaneRatio/own0/own1/depthSum`), and it cannot launch Chrome in the sandbox by its own header at `:25`. `tools/barycentre-probe.mjs` has no timing at all. AC-RING-BUDGET-AND-PERF requires a measured number with a sample size. **Settles it:** a live chrome-devtools frame-time comparison — same seed, frozen pose, same window, parent vs build, page reloaded between arms, N ≥ 300. Everything I can say statically is that `nk = 0` costs one integer compare per `arcRoot` call, on pixels that already passed band + extent + front-branch.
2. **Whether AC-GAP's endpoint criterion is a WORLD distance or a SCREEN distance.** The design satisfies the world reading exactly at every pose. The screen reading agrees only where the heliocentric ring and the local system are near-coplanar and the line is not running down the line of sight. **Settles it:** one clarifying line in the contract before the AC is measured, or the live measurement will be ambiguous. My recommendation: world, with the screen check treated as corroboration.
3. **The FENCE-221 worst-case ring-descriptor count and worst-case moon-bearing-planet count per system.** Finder 4 reported 27 and 7 (wd-116) from an unshown re-implementation of `main.js`'s ring rule. The probe prints neither. **Settles it:** extend `tools/barycentre-probe.mjs` §2 with a per-system descriptor total and a per-system moon-bearing-planet count, then quote it in the contract. The design does not depend on either number — `KEEPOUT_MAX = 8` is justified from the planet ceiling, not from a ring count.
4. **Maximum per-ring `nk` in a shipped system.** The bound is safe by construction (`nk ≤` disc count `≤ 8`), but the *typical* value drives the perf story and I have not measured it. Geometrically it should be 0 for every moon ring and star ring and 1 for a moon-bearing planet's own heliocentric ring, with a second only reachable when two planets' orbit radii differ by less than a local-system radius. **Settles it:** a unit assertion that enumerates max `nk` over a FENCE-221 sweep.
5. **Whether Sol's 13 planet records all reach `main.js`'s `moonOrbitLines` construction path.** I read `SolarSystemData.js`, not the Sol→scene adapter. It cannot change the ≤ 8 bound either way. **Settles it:** a probe run that counts constructed rings rather than data records.
6. **The spawn-frame world-origin inconsistency.** `main.js:7750` writes bary rings at raw `(px, 0, pz)` while `:7762` places the heliocentric ring at `−worldOrigin` — so in a warp-reached system, *before the first `simStep`*, the two disagree by the full world origin. This design reads `ring.mesh.position` directly and inherits whatever is there, and `updateFromSystem` runs inside `renderFrame` (`:13071`), which `bindToRAF` schedules after `simUpdate`/`simStep` (`:13102-13113`), so by the first rendered frame `:11343-11353` has run. Only a render that precedes any sim tick could see it. **Settles it:** a live check on a warp arrival, or a one-line spawn fix in the barycentre workstream's territory — out of scope here.
7. **Whether any authored/known system actually places a binary-star ring inside a planet's local system.** `StarSystemGenerator.js:724` exempts known planets from the binary-stability cull, so it is possible in principle; I did not enumerate the known-companion catalogue. If it happens the ring gets a gap, which is the consistent "solid" read, and AC-NO-COLLATERAL's stated observable (no ring disappears entirely) still holds. **Settles it:** a probe over the known-system table.
---

## 10. ⭐ WORKING-CLAUDE'S VERIFICATION PASS — 2026-08-19, before any code

Per the lane rule *"VERIFY THE VERIFIERS — re-open every load-bearing line before acting on either
layer."* Every line below I opened myself at `51e3c7f`.

### The linchpin held

The whole GPU predicate rests on one claim: that `q.xy` inside `arcRoot` is `(X, Z)` **in the ring's
own plane frame**. It is, and the JS mirror says so in its variable names, not in a comment:

- `src/objects/OrbitConicField.js:195` — `  vec3 q = vec3(radius * cs.x, radius * cs.y, 1.0);`
- `src/objects/ringConic.js:371` — `  const X = radius * c, Z = radius * s;`
- `src/objects/ringConic.js:211` — *"columns [0,2,3] (the local-Y column is dropped — the ring is a planar circle)"*

### Insert-site safety, re-checked against the gate

`grep -c` on the two mutant literals returns **1 each** — the insert between `:197` and `:198` cannot
collide with `String.replace`'s first-match semantics.

- `:197` `  if (!(w > 0.0)) return vec2(1.0e30, 0.0);` ← M15's literal (`tools/conic-gl-gate.mjs:188`), matched WITHOUT leading whitespace
- `:198` `  return vec2(length(vec2(dot(fh0, q), dot(fh1, q)) / w - pix), dot(rw, q));` ← M20's (`:197`)
- `:324` `    if (arc.x > uArcTolPx) continue;` ← M12's, four leading spaces, untouched

### Row 9 slot 3 is genuinely dead

`grep -n "t9\."` returns exactly two lines, `:321` and `:322`, reading `.x`, `.y`, `.z`. **No shader
read of `t9.w` exists.** Writers are `:660` and `:673` (`src[o9 + 3] = 0`); `readConic` reads `o9+2`
(`:696`) and stops. The slot is free.

### The adapter line numbers the contract cites are CORRECT

`:524 system.starOrbitLines`, `:526 system.orbitLines`, `:531 planets[i].moonOrbitLines`,
`:540 this.update(view, camera, viewport)`, `_appendRing(ring)` at `:549`,
`update(descriptors, camera, viewport)` at `:587`. Nothing stale here.

### ⭐ The predicate measured against the LIVE ring set, not derived

wd-10 planet 3, clean page reload, orbits on. Ran the plan's §4 CPU predicate verbatim over every
ring proxy in the scene:

| quantity | measured | plan predicted |
|---|---|---|
| local rings about planet 3 | 2, **sharing one centre** | 2, `_baryCentred` |
| ⇒ disc radius `R` | **0.897868** | reduces to `max(ring.radius)` |
| `R` in primary radii | **19.5492** | AC-GAP's stated endpoint |
| foreign rings tested | 14 | — |
| foreign rings MASKED | **1** | 1 (planet 3's own heliocentric ring) |
| that ring's `gap²` | **0.00000** | ≈0, its circle passes through the barycentre |
| nearest FALSE positive | `gap² = 2 427 689` vs `Reff² = 0.806` | culled by geometry alone |
| both binary-star rings | **unmasked** | AC-NO-COLLATERAL-OCCLUSION |

The false-positive margin is ~3×10⁶. **This is why the `ring.radius > k.radius` fail-safe was
correctly deleted** (adjudication #1): geometry alone separates foreign rings by six orders of
magnitude, so the redundant term bought nothing and cost the exemption its falsifiability.

Barycentre-render numbers re-measured on the same clean load, matching the previous session exactly:
`r1 = 5.5332` R_p, `r2 = 19.5492`, both bodies on their rings at ratio **1.000000**, out-of-plane
−5e-8, `cos∠ = −1`, 16/16 ring proxies visible.

⛔ **NOT verified live and still NOT FOUND:** the frame-time number (§9 item 1) and the screen-vs-world
reading of AC-GAP's endpoint (§9 item 2). Both need the build to exist first.
