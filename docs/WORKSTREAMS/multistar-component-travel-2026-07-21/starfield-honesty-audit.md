# AC8 — Starfield honesty audit

Workstream `multistar-component-travel-2026-07-21`, unit BN4 (committed
artifact per AC8: "The audit report is a committed artifact"). Evidence base:
grounding trace 3 (`increment-b-design.md`, wf_e688b0f3-a4e) + BN5's headless
suite `src/generation/__tests__/starfieldHonesty.test.js` (14/14 green,
run 2026-07-21). **Every quantitative claim below cites a test name from that
suite or a file:line in the current tree** — no hand math. Line numbers are
against the BN5 working tree (this workstream's build); pre-fix locations are
described by function name plus the trace-3 record.

Max's prompt for this AC (intent.md): *"We need to make sure that everything
we're doing is being accurately reflected in the starfield of nearby systems.
Dunno if we've checked on that function at any point while doing this nav
system rework."*

**Verdict up front:** the brightness pipeline was already honest (player-
relative, catalog-true positions) — but a blanket self-exclusion radius hid
*every authored component sibling* from inside its own system, and the render
mapping had no headroom to make a mag −6.9 sibling look brighter than Sirius.
Both are in AC8's declared surface and both are fixed in this workstream
(BN5). Everything else found is recorded for triage in §5.

---

## 1. How the sky brightness works today (verified correct)

Catalog-star brightness **is player-relative** — the core premise of Max's
question holds. `RealStarCatalog.findVisible` (RealStarCatalog.js:237)
recomputes apparent magnitude per vantage from the catalog's *absolute*
magnitude and the live player→star distance:
`appMag = s.absMag + 5 * Math.log10(d_pc / 10)` (RealStarCatalog.js:257-258).
The catalog's Earth-relative `mag` field is never used for sky rendering.

Downstream of that:

- **Color** = spectral base color × `max(0.1, 1.5 − appMag/5)`
  (RealStarCatalog.js:268-269).
- **Size** = bucketed from appMag (RealStarCatalog.js:272-279).
- **Sky direction** = true player→star unit vector (RealStarCatalog.js:263-265)
  — positions are catalog-true from any vantage.
- `StarfieldLayer` renders the baked vertex data verbatim with a per-channel
  white clamp `min(col, vec3(1.0))` (StarfieldLayer.js:315).

Third-system spot-check (headless, pinned): from Sol, Rigil Kentaurus renders
at appMag ≈ −0.011, size 10 — matching real α Cen — and Proxima Centauri's
separate supplement row is correctly cut by the 6.5 naked-eye threshold (its
real appMag from Sol is 11.01). Test: **`physical honesty from Sol: Rigil at
appMag ≈ −0.01 size 10; Proxima cut at the 6.5 threshold`**.

> **Set the Sol expectation now, before the fix sections:** a live Sol check
> will show Alpha Centauri as **ONE point** (A and B share one HYG row;
> their 23.5 AU separation — stellarCompanions.js:94-96 — is sub-resolution
> at 1.3 pc anyway) and **NO Proxima** (appMag 11.01 > 6.5). One point, no
> Proxima, is the *physically honest* result — do not log it as a failure
> at live verification. §6 expands.

Incidental finding while tracing the path: `uBrightnessMin`/`uBrightnessMax`
are dead uniforms — set from SkyRenderer's brightness config
(StarfieldLayer.js:99-100), declared in the fragment shader
(StarfieldLayer.js:254-255), and never referenced in any shader computation.
The documented per-layer brightness budget is unenforced. Recorded in §5;
BN5 deliberately did not design against them (trace 3).

## 2. The defect (in-surface): a 0.1 pc blanket self-skip

`findVisible`'s self-exclusion was a blanket *distance* skip:
`if (dist < 0.0001) continue; // skip self` — 0.0001 kpc = 0.1 pc (trace 3,
pre-fix `RealStarCatalog.findVisible`; the literal is preserved verbatim in
the fix commentary at RealStarCatalog.js:26-38).

The problem: **the entire authored component-separation regime sits inside
that radius.** The separation ceiling for components is ≈ 0.1 pc — the F1
seed-bin identity limit (intent.md, size-limit finding) — and the authored
separations are:

| Pair | separationAU | pc | Source |
|---|---|---|---|
| Rigil (A+B) ↔ Proxima | 13,000 | 0.0554 (catalog rows) | stellarCompanions.js:102 |
| Guniibuu (A+B) ↔ HD 156026 | 4,400 | ~0.021 | stellarCompanions.js:130 |
| Zet-1 Ret ↔ Zet-2 Ret | 3,750 | ~0.018 | stellarCompanions.js:172 |

So from inside Alpha Centauri the sky rendered **no Proxima**, and from
Proxima's coords **no blazing A+B** — the exact scenario AC8 exists to check.
Self-exclusion worked only by coincidence: every arrival/teleport path lands
`playerGalacticPos` exactly on catalog/registry coords, so "self" is always
dist = 0 (trace 3; teleport handler main.js:4970-5060 sets the raw position
directly).

**The fix (BN5):** the skip shrinks to an exported epsilon,
`SELF_SKIP_EPSILON_KPC = 1e-6` kpc ≈ 206 AU (RealStarCatalog.js:39, applied
at :254). Tests:

- **`self-exclusion still works: the vantage star is absent from its own sky
  (dist = 0)`** — both Rigil and Proxima vantages.
- **`epsilon scale: inside 1e-6 kpc is "self", just outside is sky`** — a
  synthetic star at 5e-7 kpc is skipped, at 2e-6 kpc it renders, and the
  constant is pinned to exactly 1e-6.

**Scope guards** — three same-number-different-job literals that must NOT
move with this fix, each pinned:

- `HashGridStarfield`'s two 0.0001 near-origin skips
  (HashGridStarfield.js:193/:371) — shrinking those would newly reveal
  *procgen* stars in every system's sky. Tests: **`HashGridStarfield keeps
  its 0.1 pc near-origin skip (behavioral pin)`** (a procgen star stays
  hidden both at dist 0 and at 5e-5 kpc — goes red if the skip is
  "helpfully" shrunk) and **`` HashGridStarfield source still carries both
  `dist < 0.0001` skips (grep pin) ``**.
- `POSITION_MATCH_TOL = 0.0001` (RealStarCatalog.js:24) — identity matching,
  not self-exclusion; must stay below `KnownSystems.MATCH_RADIUS = 0.0005`
  (KnownSystems.js:34). Test: **`POSITION_MATCH_TOL stays 0.0001 kpc and
  below KnownSystems.MATCH_RADIUS`**.

## 3. What the numbers become post-fix

With the epsilon in place, the already-honest math lands exactly where AC8
wants it (all asserted headlessly over the shipped catalog JSON, fs-fed via
`ingestCatalogData` — RealStarCatalog.js:128):

| Vantage → target | appMag | size | seed | Test |
|---|---|---|---|---|
| A+B (Rigil row) → Proxima | **4.157** (dim naked-eye point) | 4 | 1816942132 | `from Rigil (A+B), Proxima Centauri is in the sky at appMag ≈ 4.16, size 4` |
| Proxima → A+B (one point) | **−6.903** (blazing) | BLAZING_SIZE (20) | — | `from Proxima, the A+B pair (Rigil row) blazes at appMag ≈ −6.90 in the NEW top tier` |
| Sol → Rigil (regression) | **−0.011** | 10 | — | `physical honesty from Sol: Rigil at appMag ≈ −0.01 size 10; Proxima cut at the 6.5 threshold` |

The Proxima-from-A+B record also pins the seed invariant: both Alpha Cen
catalog positions hash to F1 seed **1816942132** (same 0.1 pc bin), so the
sibling sky point carries the same `[WARP]`-log seed as both marker paths
(asserted in the first test above; independently computed in trace 1).

## 4. The render-cap gap: "blazing" needed a new tier

Honest magnitude alone was not enough for AC8's "unmistakably blazing":

- Size buckets capped at **12** for anything below appMag −1 (pre-fix
  mapping; the `appMag < -1 → 12` bucket survives at RealStarCatalog.js:274).
- The shader's white clamp (StarfieldLayer.js:315) saturates every channel
  for anything brighter than ~appMag 2.5.

So a mag **−6.9** sibling rendered **pixel-identical to Sirius-from-Sol
(−1.44)**. That comparison is now pinned in the other direction:
**`anti-saturation: mag −6.9 (A+B from Proxima) is measurably distinct from mag −1.44 (Sirius from Sol)`**.

**The fix (BN5), per working-Claude ruling 2 (increment-b-design.md — the
mag < −3 threshold is DECIDED):**

- A blazing tier in the size mapping: `appMag < BLAZING_MAG_THRESHOLD (−3)
  → BLAZING_SIZE (20)` (RealStarCatalog.js:50/:54, applied at :273). Fires
  ONLY below −3, so every star at appMag ≥ −3 — including Sirius — renders
  byte-identical to before. Tests: **`threshold is −3 and the blazing size
  sits strictly above every legacy bucket`**, **`appMag −2.9 keeps legacy
  size 12; appMag −3.1 gets the blazing tier`** (synthetic 1 pc boundary
  stars), and **`Sirius-from-Sol output is byte-identical to the pre-BN5
  mapping (regression pin)`** (full findVisible record, exact doubles).
- A wider-core / edge-reaching-halo branch in StarfieldLayer's fragment
  shader keyed on `vSize >= 20.0` (StarfieldLayer.js:291-301); the GLSL
  literal is interpolated from the imported `BLAZING_SIZE`
  (StarfieldLayer.js:3/:10) so the two files cannot drift. Ordinary stars
  keep byte-identical shape/size math. Tests: **`fragment shader gains a
  blazing branch keyed on the BLAZING_SIZE tier`** and **`ordinary stars
  keep the exact pre-BN5 shape and size math`** (legacy expressions pinned
  verbatim, StarfieldLayer.js:241/:289).

Sprite arithmetic: aSize 20 rides the existing `> 5.0` doubling rule
(StarfieldLayer.js:241) to a 40 px point sprite — vertex shader untouched.

**Open for Max at UAT (ruling 2 flags this explicitly):** the blazing *look*
is a conservative first cut and GLSL is beyond the headless ceiling — the
tier's aesthetics (within the retro pipeline: Bayer dither, 1/3-res
compositor) are judged live via §7's teleport screenshots and Max's AC10
walkthrough.

## 5. Record-and-triage (findings outside AC8's surface)

None of these are fixed in this workstream. `scripts/` is
contract-untouchable (mustStayWorking) and the rest sit outside the declared
minimal sky surface. For triage with Max; the sky-honesty follow-ups are
lane D's starting point per the contract's outputs.

### 5a. Dedup-absorbed siblings — only Alpha Centauri can show a sibling

Every authored component sibling **except Proxima Centauri** has no
independent catalog row: at catalog regen, `process-hyg-catalog.mjs`'s DEDUP
table (scripts/process-hyg-catalog.mjs:114-125) alias-absorbs them into
their primary's row:

| Dropped row | Absorbed into | Line |
|---|---|---|
| Toliman (α Cen B) | Rigil Kentaurus | :120 |
| HD 155886 (36 Oph B) | Guniibuu | :121 |
| HD 156026 (36 Oph C) | Guniibuu | :122 |
| HD 201092 (61 Cyg B) | HD 201091 | :123 |
| Zet-2 Ret (ζ² Ret) | Zet-1 Ret | :124 |

Consequence: these five can never render as separate sky points from ANY
vantage — **Guniibuu's and Zeta Reticuli's component scenes will show NO
sibling sky point even after the skip fix.** (Toliman is inside A+B's shared
row, so Alpha Cen is unaffected.) The componentSystems payload cannot patch
around it either: it carries no galactic position or direction
(`validateComponentPayload`, componentSystems.js:87-114), so the sky
pipeline has nothing to place. AC8's "sibling visible from each component"
observable is therefore fully satisfiable **only for Alpha Centauri** in
this workstream — working-Claude ruling 3, using the AC's own escape hatch
("larger findings are recorded and triaged with Max").

Sharpest sub-case: real ζ¹/ζ² Ret are both naked-eye stars ~5 arcmin apart
— genuinely resolvable to the naked eye (trace 3, increment-b-design.md AC8
audit draft). Restoring ζ² Ret (or any of the five) as a sky point requires
catalog regen in `scripts/` — a lane-D / future-workstream item.

### 5b. Blast radius of the epsilon fix — 7 additional real close pairs

Shrinking the skip reveals every *genuine* catalog pair closer than 0.1 pc,
not just Rigil↔Proxima. Pairwise scan over hyg ∪ supplement (re-run for this
audit 2026-07-21 over `public/assets/data/hyg-stars.json` +
`real-star-supplement.json`; method equivalent to
`RealStarCatalog.findAllWithin`, RealStarCatalog.js:217): exactly **8**
pairs with 1e-6 kpc ≤ d < 0.0001 kpc — Rigil↔Proxima plus:

| Pair | Separation (pc) |
|---|---|
| HD 165341 (70 Oph A) ↔ unnamed row | 0.0014 |
| Del Equ ↔ unnamed row | 0.0062 |
| Xi Boo ↔ unnamed row | 0.0124 |
| Gam Lep ↔ HD 38392 | 0.0422 |
| HD 120237 ↔ HD 120237 (two same-named rows) | 0.0602 |
| HD 200011 ↔ HD 200026 | 0.0717 |
| Zet Her ↔ unnamed row | 0.0809 |

All are physically honest — real binaries/pairs with independent HYG rows
that the dedup table deliberately or incidentally left separate (γ Lep +
HD 38392 is *documented* as deliberate, scripts/process-hyg-catalog.mjs:
111-113) — and each is visible only from vantages inside its own system.
Several will hit the blazing tier: by the findVisible formula
(RealStarCatalog.js:257-258), the 70 Oph members at 0.0014 pc see each
other at appMag ≈ −13.8 and −18.9. Triage-worthy details:

- **HD 120237 ↔ HD 120237**: two rows with the *same name* 0.0602 pc apart
  — a catalog quirk; from inside that system the sky shows a second point
  with the vantage star's own name.
- Four companions are **unnamed rows** (`name: null`) — they render as
  anonymous sky points; harmless, but nav/search surfaces built on names
  will show nothing for them.

### 5c. StarFlare billboard-vs-background-star claim is stale

`StarFlare.billboardSwitchDistance`'s comment (src/objects/StarFlare.js:
343-350) claims the biggest background star is 16 px and targets a 16-22 px
local-star billboard. Already stale pre-BN5 (catalog size 12 doubles to
24 px), and blazing sprites are now 40 px — so from deep space in a
component scene, the blazing sibling out-renders the local star's billboard.
Physically honest (A+B at −6.9 genuinely outshines Proxima seen from
Proxima's own deep space, ≈ −4.4), and `tests/star-billboard-switch.test.js`
still passes 6/6 — but if UAT reads it as wrong, the knob is the billboard
target-px formula, **not** the sky.

### 5d. Minor render notes

- **Mobile point-size cap**: gl_PointSize 40 is safe on desktop
  (ALIASED_POINT_SIZE_RANGE typically ≥ 1024) but some mobile GPUs cap point
  sprites at 63-64; the blazing sprite would clamp, shrinking the halo. One
  live-drive checklist line if mobile matters.
- **Dead uniforms**: `uBrightnessMin`/`uBrightnessMax`
  (StarfieldLayer.js:99-100, :254-255) are never used in shader math — the
  documented brightness budget is unenforced. Wire or remove in a lane-D
  cleanup; BN5 deliberately did not design against them.

## 6. Pre-empting the "where's the second star?" confusion

Two live observations that are **correct** and must not be logged as
failures (working-Claude ruling 4 + trace 3):

1. **From Proxima, A+B is ONE blazing point, not two.** A and B share a
   single HYG row (Toliman was dedup-absorbed, §5a), and their 23.5 AU
   separation (stellarCompanions.js:94-96) is sub-resolution from 0.0554 pc
   regardless. AC1's observable wording ("A+B as sky points") should be read
   as one point — physically honest.
2. **From Sol, Alpha Cen is ONE point and Proxima is absent** — as set up in
   §1: shared A+B row, and Proxima's appMag 11.01 from Sol is far below the
   6.5 naked-eye cut. Both facts are pinned by **`physical honesty from Sol:
   Rigil at appMag ≈ −0.01 size 10; Proxima cut at the 6.5 threshold`**.

Corollary of §5a for live drives: Guniibuu and Zeta Ret component scenes
show NO sibling point at all — expected, recorded, not a regression.

## 7. Live-vantage protocol (zero code, existing DebugPanel teleport)

The debug teleport regenerates the sky from raw coordinates: the handler
(`teleportToPosition`, main.js:4970-5060) sets `playerGalacticPos` directly
from the given position and calls `skyRenderer.prepareForPosition`
(main.js:4987) — no registry realignment of the position (identity naming
via `findByPosition` at main.js:5006 is name-only). Because teleports land
on exact catalog coords, dist = 0 and the self-skip behaves identically to
arrival. Invoked from the DebugPanel search/POI UI (DebugPanel.js:514-515,
:639).

Protocol (on :5176, autopilot-off, console open):

| # | Teleport to | Expect |
|---|---|---|
| 1 | Proxima supplement coords (8.000902, 0.024956, −0.000937) | ONE blazing 40 px point toward A+B (the −6.9 tier); no Proxima self-point; console clean. Screenshot. |
| 2 | Rigil catalog coords (8.000948, 0.024984, −0.000924) | Dim size-4 point toward Proxima (the 4.16 tier); no Rigil self-point. Screenshot. |
| 3 | Sol (`GalacticMap.getStartPosition`, GalacticMap.js:1693) | α Cen as ONE ~size-10 point; NO Proxima; Sirius unchanged vs pre-BN5 screenshots. |
| 4 | (optional, blast radius) 70 Oph / Zet Her member coords | Sibling point present; 70 Oph companion blazing. Per §5b, only from inside those systems. |

Checks 1-2 demonstrate the fix (pre-fix, both skies were missing the
sibling); check 3 is the §6 honesty regression; check 4 samples §5b. The
"sky generated FROM the component after a real warp arrival" half of AC8
rides BN1's knownWarp position wrapper and is exercised by the AC1/GB7 live
drives; the blazing tier's *look* is Max's call at UAT (§4).

---

**Status:** headless half of AC8 CLOSED by BN5
(`starfieldHonesty.test.js` 14/14 + full related run 164/164, 2026-07-21);
live half pending the §7 drives + Max's UAT verdict on the blazing look.
Triage items §5a-5d open with Max; §5a is lane D's seed list.
