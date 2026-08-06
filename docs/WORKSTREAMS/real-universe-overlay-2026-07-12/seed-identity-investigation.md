# Real-star seed-identity investigation & solution plan (2026-07-15)

**Trigger:** AC9 FAIL (Max, 2026-07-15) — the 36 Ophiuchi illustrative case
(`ac9-uat-findings.md` finding #2). Max: the defect is procgen-level, affecting main gameplay,
not just nav. This doc is the root-cause record + solution plan for the fresh implementation
session. Ground truth gathered via live drives + 2 read-only opus inventory agents + a full
catalog collision census.

## 1. Problem statement

A real catalog star's procgen identity (the seed passed to `StarSystemGenerator.generate`)
is **pipeline-dependent**: the same named star carries different seeds on different selection
paths, so it generates **different systems depending on how you reached it** — and the nav's
SYSTEM-view preview generates via yet another path that skips the real-universe overlay
entirely. Separately, most real stars can roll **fabricated stellar companions** (the snum
pin only reaches exoplanet-archive hosts). Live proof: warping to Guniibuu (36 Oph, a real
bound K-triple) delivers a fictional K+K binary @0.16 AU with 4 planets, after the nav
previewed 6 planets for the same selection.

## 2. Seed families and who uses them

| Family | Formula | Used by |
|---|---|---|
| **F1** | `hashCombine(round(x·1e4), hashCombine(round(y·1e4), round(z·1e4)))` — position hash, 0.1 pc bins | `RealStarCatalog.findVisible`; `knownObjectSearch.seedFromPos` (byte-identical); sky `starData` for real stars via `StarfieldGenerator._finalizeFromGridData` |
| **GRID** | `hashCombine(_hashCell(cx,cy,cz,typeOffset), cx·31+cz·997)` — procgen cell hash | `HashGridStarfield` (procgen stars); **retained** by NavComputer's prism merge when a real star replaces a grid star (matched branch); debug teleport picks nearest-grid |
| **XOR** | `round(x·1e4) ^ round(z·1e4)` — ignores y | NavComputer prism merge, unmatched branch |
| **KNOWN** | literal registry seed (`'sol'`, `'alpha-centauri'`) | KnownSystems name-keyed bypass — arrival ignores the dispatched seed entirely |

**Agreement matrix (real star NOT in KnownSystems):** search-warp ≡ sky-click-warp (both F1).
Prism-click-warp (GRID or XOR) agrees with nothing. Debug teleport (nearest-GRID) agrees with
nothing. Nav SYSTEM preview uses whatever `_systemStar` carries (F1 from search, GRID/XOR from
prism) **and** generates overlay-less. The KnownSystems bypass masks the whole split for the
handful of registered systems — which is why Sol/α Cen/Sirius/TRAPPIST-1 behaved in all prior
verify circuits while ordinary catalog stars are broken.

Full per-site inventory (16 sites A–Q with file:symbol anchors): agent report archived in this
session's handoff; key sites: `NavComputer.js:_queryYRange` matched (~:2688 retains grid seed)
and unmatched (~:2710 XOR); arrival `main.js` destType `'star-system'` (`seed =
String(resolvedStar.seed)`); preview `NavComputer.js:_renderSystem` (~:1590, overlay-less).

**Seed drives more than structure:** planet/moon names derive from `fnv1a(seed:ordinal)`;
`ExoticOverlay` seeds from `systemData.seed`; the prism binary-stash matcher
(`s.seed === _systemStar.seed`, ~:867) only works when seeds agree — divergence is why the
Escape-stash double-dot rarely fires for real stars.

## 3. Collision census (full 15,560 named rows)

- **F1**: 6 multi-star cells / 13 stars — α Cen A/B, 36 Oph trio, 61 Cyg A/B, ζ Ret 1/2,
  and the 2 duplicate-name rows (Alula Australis/Xi UMa, Graffias/Xi Sco). These are
  **precisely real bound multiples + dup rows** — F1's quantization accidentally performs the
  correct physical unification; it just needs honest companion-table arrivals (finding #1
  successor scope). γ Lep + HD 38392 (0.042 pc) straddle cells and stay separate — acceptable
  (wide pair; far-companion representation available later).
- **XOR**: catastrophic — 3,818 collision groups, **10,986/15,560 stars**, incl.
  Sol↔Bet Com↔HD 3708 and Sirius↔3 unrelated stars.

## 4. Compat / blast radius of unifying on F1 (agent-verified)

- **No persistence exists** — only user prefs + camera mode in localStorage; no savegame, no
  visited history. No returning-player regression. No shipped share/seed-tag surface.
- **System/star names are position-keyed** (`generateSystemName` ignores the seed) — names
  stable across the change. Planet names/count ride the contents change (expected fallout).
- **KnownSystems (Sol, α Cen, …) unaffected** — explicit seeds + curated generate().
- **References** (`neighborhood-reference.json`, `structures-reference.json`) carry zero seeds.
- **Tests:** exactly ONE loud tripwire — `NavComputer.merge.test.js` hard-pins the retained-GRID
  (:83) and XOR (:105) expectations → rewrite to canonical F1 (becomes the guard).
  ProcgenSnapshot pins procgen-only grid systems and explicitly excludes real-covered cells —
  safe **as long as `GalacticMap.hashCombine` and the GRID cell formula are untouched**.
- Net: the three derivation sites are the only silent breakers; everything else is insulated.

## 5. Solution plan (increments for the fix workstream)

**Fix 1 — canonical identity: F1 everywhere for real stars.**
Prism merge matched branch: overwrite `ls.seed` with F1(catalog pos) instead of retaining the
grid seed; unmatched branch: replace XOR with F1 (one shared function — reuse
`knownObjectSearch.seedFromPos` or extract to a tiny module both import; do NOT fork the
formula a third time). Debug teleport: resolve real stars by name/position → F1 (minor).
Rewrite `NavComputer.merge.test.js` to F1. Result: search ≡ sky ≡ prism ≡ preview identity;
binary-stash matcher starts working. GRID formula for procgen stars untouched
(ProcgenSnapshot-safe).

**Fix 2 — preview honesty: one shared arrival-resolution function.**
Extract the arrival generation stack from `main.js` `onPrepareSystem` (context derivation +
`starTypeOverride` + `RealSystemOverlay.applyToContext` + generate + merged names) into a
shared module used by BOTH arrival and `NavComputer._renderSystem` preview
(shared-height-module precedent; sync/async wrappers around one core). Preview then shows
exactly what arrival delivers. (KnownSystems bypass: preview should route through
`findByAlias` the same way arrival does.)

**Fix 3 — fabrication reach (MAX RULING at scoping).** Multiplicity vs planets are distinct:
planet FILL around real stars stays per rep-cap §6 (fill-ON, 8% empty roll — already ruled).
The question is fabricated **stellar companions**. Options:
  (a) status quo — unpinned real stars roll procgen companions (fiction, but consistent once
      Fixes 1–2 land);
  (b) **pin-by-default (recommended)** — un-tabled/un-hosted REAL stars never roll fabricated
      companions (synthesize `{kind:'single'}` for all real-catalog arrivals without table
      entry; archive snum + table still win). Matches the workstream's structure-honesty basis
      (D2/D4: structure is table-scoped). Tradeoff, stated honestly: real binaries not yet in
      the table render single until data grows — under-representation, never fiction;
  (c) later: derive a catalog multiplicity flag at regen (HYG comp fields / WDS) to widen the
      pin with data — successor territory, composes with (b).

**Fix 4 — the drafted successor items (unchanged, now composing):** companion-table entries
for the 6 census groups (36 Oph unifies the trio; the 2 dup-name rows dedup at regen) +
N-dot glyph + **label-declutter pass** (mechanism designed 2026-07-15, `ac9-uat-findings.md`
finding #1 — deferred label pass w/ greedy stack-offset; NavComputer render = lane-D-owned,
build under an AC2-style Max-ratified seam). Note Max's FAIL cited legibility too — labels
block AC9 re-run alongside Fixes 1–3.

**Recommended shape:** ONE new fix workstream (scoping interview first — dev-collab-scope),
covering Fixes 1–3 + the lane-C data half of Fix 4, with the lane-D render half (glyph +
labels) either folded under a ratified seam or sequenced immediately after.
`real-universe-overlay-2026-07-12` stays `verified` with AC9-FAIL recorded; AC9 re-runs after
the fix workstream is live on `:5176`.

## 6. Verification anchors for the build session

- Live: prism-click warp and search warp to the SAME unregistered real star arrive at the
  identical system (seed in `[WARP]` log + `_systemData` deep-compare); nav preview matches
  subsequent arrival for both a plain star and a table star (Sirius).
- Suite: `NavComputer.merge.test.js` rewritten-green; ProcgenSnapshot 24/24 byte-identical;
  suite baseline 1,404 + new tests.
- Census: 36 Oph — PRISM (post-table) one marker; arrival = authored triple; search of all
  three names → same destination, honestly.
- **Drive rule:** stop `window._autoNav` first (`feedback_wd-nav-drives-autopilot-off`);
  confirm your own seed in the `[WARP]` log before trusting any arrival read.

## 7. Standing items carried (do not lose)

1. **α-Cen A/B fill = SHIP-AS-IS** (standing resolution from Max's "empty is realistic"
   framing, 2026-07-15; populate knob remains available; redirect welcome).
2. **Label-declutter design** done + folded (finding #1); lane-D-owned build.
3. **Formal close-out sequence** for `real-universe-overlay-2026-07-12` (contract → shipped +
   validate, Rule-3 doc pass incl. NAMING_AND_REAL_OBJECTS.md additions, FEATURES.md row,
   doc-rot check) — runs only AFTER the fix workstream ships and AC9 re-runs PASS.
4. **Lane B flags:** boot-tour warp collision (already on board) + NEW: should the demo tour's
   `onTourComplete` re-arm survive past boot at all? (Ran ~18 h in the shared :5176 window.)
5. Parked: universe-wide empty-rate calibration; six absent famous stars; structures authoring;
   seedtags (its AC2 search surface remains the designated future home).
