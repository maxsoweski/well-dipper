# AC9 — Max's batched UAT: findings record

**Workstream:** `real-universe-overlay-2026-07-12` · **Status: AC9 FAIL recorded 2026-07-15**
(UAT started 2026-07-14; re-run gated on the multiplicity/legibility fix workstream — finding #2)
**Bundle under test:** build `3e58fac` (branch HEAD `a8c8e44`, docs-only past the build) on `:5176`.
**Session context:** working-Claude pre-drove a smoke circuit before Max's UAT (window had drifted
into Object Gallery debug mode since the prior session — recovered via search→warp→Sol; suite
19/19; all 19 AC1 Sol-vantage assertions re-confirmed, worst error 0.03%; console clean). AC9
judgments below are **Max's alone** — this file records them; no agent marks AC9.

---

## Finding #1 — Prism dot-count is provenance-dependent (binaries render inconsistently)

**Max's observation (verbatim gist):** "Made-up 'Toliman' almost totally overlaps in the nav
computer view with the real Proxima Centauri… procgen binary systems display as one star,
real-world ones display as two stars (in the prism nav screen)."

**Root cause (code- and data-verified this session):**
- Toliman is real (IAU name for α Cen B); the pile-up at ~1.3 pc is the real α Cen triple
  rendered at catalog-true positions — i.e., the Increment-5 position-snap fix working.
- The *inconsistency* is real and structural: a procgen system is one seed → one prism marker
  regardless of multiplicity, while real stars get one marker **per catalog row**. Wide pairs
  that HYG catalogued as separate rows therefore render as 2 dots; close pairs (Sirius B has no
  HYG row) render as 1. Dot count encodes data provenance, not astronomy. The codebase's own
  convention (Sirius B, Proxima: companions live *inside* the system, no separate row) is
  violated only by these separately-catalogued pairs.

**Census (spatial-hash scan of the 15,560 named shipped-catalog stars, ≤0.05 pc separation):**

| Group | Rows | Sep (pc) | In-game today |
|---|---|---|---|
| α Cen A/B (Rigil Kentaurus + Toliman) | 2 | 0.001 | ONE authored system, two dots |
| 61 Cygni A/B (HD 201091 + HD 201092) | 2 | 0.011 | TWO separate systems |
| ζ Reticuli 1/2 | 2 | 0.031 | TWO separate systems |
| γ Leporis + HD 38392 | 2 | 0.042 | TWO separate systems |
| 36 Ophiuchi triple (Guniibuu + HD 155886 + HD 156026) | 3 | 0.026–0.043 | THREE separate systems |
| Alula Australis + Xi UMa | 2 | 0.000 | duplicate rows — SAME star, two names |
| Graffias + Xi Sco | 2 | 0.000 | duplicate rows — SAME star, two names |

The two sep-0.000 pairs are catalog-regen duplicates (one star, two named rows) — also a
naming-uniqueness violation (two destinations at one position). Distinct sub-issue; rides with
the same fix vehicle.

**Max's ruling (2026-07-14):** fix direction = **multiplicity-honest prism markers** — every
system marker shows the appropriate number of dots (procgen and real alike), superseding his
initial cluster-label idea after the feasibility check. **Scoped as a SUCCESSOR workstream;
`real-universe-overlay-2026-07-12` ships without blocking on it.**
**Hard requirement added by Max:** the implementation plan must account for **label
readability** — no overlapping / hard-to-read labels (this does not fully fall out of marker
unification: e.g. Rigil↔Proxima markers at 0.055 pc still collide at prism zoom, and dense
fields pile labels generally).

**Successor scope shape (agreed rec, for the future scoping interview — not a contract):**
- **Lane C (generation/data):**
  - `multiplicityForSeed()` oracle — answers with *arrival truth*; must consult known-system
    aliasing + curated companion table + the snum==1 pin (a glyph must never contradict what
    warping delivers, e.g. TRAPPIST-1 = 1 dot).
  - Extract the generator's pre-binary-roll RNG prefix (`StarSystemGenerator.js:250` region)
    into ONE shared function used by both the generator and the oracle — cadence drift
    impossible by construction; guarded by ProcgenSnapshot byte-identity. (Shared-height-module
    precedent.) Cost: a few RNG draws × ~43k prism stars — negligible.
  - Curated companion-table entries for the 4 real groups (61 Cyg, ζ Ret, γ Lep, 36 Oph) +
    catalog-regen rule: companion/secondary rows drop to aliases (Sirius/Proxima precedent) +
    dedup same-position duplicate rows. NOTE: regenerating the catalog touches
    `neighborhood-reference.json` (Toliman is an asserted Sol neighbor) → AC1 reference +
    audit + tests regenerate with it. This ripple is WHY it's successor-scoped, not folded in.
- **Lane D (NavComputer rendering):**
  - N-dot marker glyph (generalizes the existing Escape-stash double-dot at ~`NavComputer.js:865`
    from "last-visited system" to every marker). Glyph is a SYMBOL — close-pair separations
    (~1e-7 pc) are sub-pixel; positions never move (interview ruling 1 stands).
  - **Label collision handling** (Max's hard requirement) — CONCRETE MECHANISM (designed
    2026-07-15 answering Max's max-zoom overlap question; lane D builds, lane C does not touch
    NavComputer): **deferred label pass with greedy stack-offset.** Today each prism label
    draws inline in the projected-star loop (`fillText` at dot-edge+4px, real named stars
    only, 10px DotGothic — the `star.isReal && star.name` branch) with no awareness of other
    labels. Instead: (1) during the star loop, push `{name, x, y, priority}` into a
    frame-reused array rather than drawing; (2) after the loop, sort by priority
    (selected > current-system > nearest/brightest); (3) greedy screen-space AABB pass —
    label width from `measureText` (cache per name string), height = font size; on overlap
    with an already-placed rect, try ±1–2 line-height vertical slots (stacking — a 2–3-label
    pile like Rigil↔Proxima or an unmerged trio becomes a tidy vertical list); if displaced
    more than ~half a line, draw a 1px leader line from label to dot; if no slot frees, fade
    the loser to ~35% alpha. O(n²) over visible *labelled* stars (dozens at prism zoom) —
    negligible; ~40–60 lines; marker positions untouched (interview ruling 1 intact).
    NOTE the two halves compose: the companion-row dedup above independently removes the
    worst overlap case (Toliman's row → alias ⇒ α Cen = one marker, one label); the label
    pass covers what dedup can't reach — genuinely separate near-neighbors (Rigil↔Proxima,
    0.055 pc) and dense procgen fields.
- **Boundary:** far companions with genuinely resolvable separations (Proxima at 0.055 pc) keep
  their own true-position dot; the glyph covers close multiples only (AC10's 2-close-star cap →
  procgen markers are 1–2 dots).

**Routing:** cross-lane C/D — record to the coordinator board at UAT wrap; lane D's scoping
(PRISM increments already in its charter) inherits the render half; lane C successor carries
oracle + data. Composes with the parked empty-rate-calibration seam (representation-cap §6).

---

## Objective sweep (2026-07-15) — drive-card steps 1–4 machine-covered

**Max's directive:** the objective layer of AC9 (presence/positions/search/arrivals/structures =
disk-truth) is the agent's to verify, at machine scale; his gate narrows to the judgment residue.
Executed via workflow `wf_89f11a25-cee` — full record in
`verdict-ac9-objective-sweep-3e58fac.json` + raw evidence `ac9-sweep-results-3e58fac.json`.
Result: **all green** — 1,503 per-star position assertions at 5 vantages worst error 0.0%
(exact catalog match, independently re-derived from disk); search 50/50 + 6/6 negatives;
arrivals 5/5 correct (α-Cen zero-fill re-confirmed live); structures 10/10; suite 19/19;
console clean. One **UNCONFIRMED possible defect** flagged: stale NavComputer player-position
after search-warp (empty PRISM until close+reopen) — seen only under the agent's synthetic-input
mechanics, never in natural-flow drives; 30-second human check in the verdict file; lane D if real.
RUN 1 note: the :5176 tab crashed (3 WebGL tabs live) — fresh page rebooted, RUN 2 clean.

**Max's remaining AC9 residue:** (1) free-play feel — does exploring read true; (2) the
Alpha-Cen A/B zero-fill-planets call; (3) final AC9 verdict.

---

## UAT status at session seam (2026-07-15)

Max, after the objective sweep + his stale-nav check: **"Looks like it's working."** The
stale-nav-position flag did NOT reproduce for him → treated as agent-mechanics artifact, dropped
(no lane D routing). **Formal AC9 verdict NOT yet given** — still owed: explicit pass/fail, the
α-Cen A/B zero-fill ruling. Two follow-up questions handed to the next session (in the seam
handoff): (1) easy mechanism to stop binary-system label overlap at max prism zoom (= the finding
#1 label hard-requirement, wants a concrete lane-D answer); (2) the 36 Ophiuchi trio near Sol
(Max spotted HD 155886 + HD 156026 + Guniibuu within ~0.2 ly reading as three separate singles —
it's census row 5 of finding #1: a real bound triple, unified by the successor's companion-table
entry; also answer the astronomy: systems that close are bound, not coincidental neighbors).

---

## 2026-07-15 session — the two handed-over questions ANSWERED

1. **Label overlap at max prism zoom** — concrete mechanism designed and folded into the
   successor scope above (deferred label pass, greedy stack-offset + leader lines; lane
   D-owned build). Companion-row dedup alone already merges α Cen A/B to one label; the label
   pass covers true near-neighbors and dense fields.
2. **HD 155886 / HD 156026 / Guniibuu within ~0.2 ly** — confirmed as census row 5 (36
   Ophiuchi): a real, gravitationally bound K-dwarf triple at ~5.9 pc, separations 0.08–0.14 ly.
   Reads as three separate singles only because HYG carries each component as its own catalog
   row; the successor's companion-table entry unifies it. Astronomy: unbound field systems
   essentially never sit within ~0.1 ly of each other (chance alignment ≈ 1 in 30,000 per star
   at local density; two such neighbors ≈ never) — a grouping that tight is bound or a shared
   birth cluster. No new scope.

---

## Finding #2 — SYSTEM view and PRISM view disagree on multiplicity → formal AC9: **FAIL**

**Max's verdict (2026-07-15, verbatim):** "It's a FAIL — it partially works, minus the
difficult legibility, in the PRISM view. But the SYSTEM view doesn't match the PRISM view for
binary/trinary systems today so that is not a pass."

**⚠ MECHANISM CORRECTED (same day, after Max challenged the first write-up):** the original
"SYSTEM view always renders arrival truth / same root cause as finding #1" claim was WRONG.
Live investigation of Max's illustrative case (the 36 Oph trio) found the real mechanism —
FIVE layers that disagree, with THREE root causes beyond finding #1:

1. **PRISM** — 3 single gold dots (one per catalog row) + colliding labels. As before
   (finding #1 territory).
2. **Seed identity is pipeline-dependent — THREE different formulas** (live-verified):
   (a) search resolver + `RealStarCatalog.findVisible` share
   `hashCombine(round(x·1e4), hashCombine(round(y·1e4), round(z·1e4)))` — **0.1 pc position
   quantization → all three trio stars collapse to ONE seed 1336718286**: search-warping any
   of the three names delivers the same system; (b) the prism merge's matched branch
   (`NavComputer.js` real-star overlay, symbol `_queryYRange` merge) **retains the replaced
   hash-grid star's seed** (Guniibuu → 3993234634, HD 155886 → 3256345130); (c) its unmatched
   branch uses a degenerate `round(x·1e4) ^ round(z·1e4)` XOR that ignores y entirely
   (HD 156026 → −80059). Arrival generates from the **dispatched** seed
   (`main.js` `seed = String(resolvedStar.seed)` + every `[WARP] pre-generated (seed …)` log)
   and prism commits carry the entry's own seed (`_buildCommitAction`) → **the same named
   star generates different systems depending on how it was selected.**
3. **SYSTEM view** — only the CURRENT system shows actual spawned data. Any *browsed*
   system renders a locally generated PREVIEW (`_renderSystem` non-current branch:
   `StarSystemGenerator.generate(String(star.seed), galaxyCtx)`) that **never applies
   RealSystemOverlay** — no companion table, no knownPlanets, no snum pin — and uses the
   nav's own selected-entry seed. Live: preview for selected Guniibuu = **6 planets**;
   arrival at Guniibuu = **K+K binary + 4 planets** (console msgids 1328-29 vs 1336-39).
4. **Arrival** — overlay-applied generation from the dispatched seed. For the trio: no
   curated table entry, and the snum pin CANNOT fire (it sits inside the exoplanet-archive
   host branch, `RealSystemOverlay.resolve` — 36 Oph has no archive planets) → procgen
   freely **fabricates a companion**: search-arrival = fictional K+K tight binary @0.16 AU
   + 4 planets (`[BINARY] star2 … sep=159.64` log-confirmed).
5. **Reality** — a genuinely bound K+K+K triple at ~5,000–9,000 AU separations.

So in-game today the trio is: 3 prism dots ≠ a 6-planet SYSTEM preview ≠ one shared
fabricated-binary arrival (via search) or three DIFFERENT arrivals (via prism clicks) ≠ the
real bound triple. (Census row 5's "THREE separate systems in-game" was the data-level view;
the runtime picture above supersedes it.)

**Consequence:** supersedes the 2026-07-14 "ships without blocking on it" disposition — this
is **BLOCKING for AC9**, and the fix is BIGGER than the drafted successor scope. The drafted
scope (multiplicityForSeed oracle + companion table/dedup + N-dot glyph + label-declutter)
covers the glyph layer and gives the trio a table entry, but does NOT cover three newly
grounded root causes, which go to the scoping interview as open scope questions:
- **Seed-identity unification** — one canonical seed per star across search / prism merge /
  sky pipelines (kills both the 0.1 pc collision collapse and the path-dependent arrivals).
- **Preview honesty** — SYSTEM view for a browsed system must preview what arrival would
  actually deliver (apply the overlay + the canonical seed, or don't show planets at all).
- **Fabrication reach ruling (Max's call)** — should un-tabled, un-hosted REAL stars ever
  roll fictional companions? The snum pin only reaches exoplanet-archive hosts today;
  most of the 15,599 catalog stars are outside it.
AC9 re-runs after the fix workstream is live on `:5176`.

**Evidence & retractions (agent-drive hygiene):** the `:5176` window had the boot demo tour
still armed (`autoNav` + `onTourComplete` re-arm) — it auto-warped between systems during
agent drives. Two mid-investigation live claims were tour-contaminated and are RETRACTED:
"prism-click Guniibuu arrives as an M single" (that was the tour's own Xotger hop) and
"HD 155886/156026 warps refused as same-destination" (dispatches swallowed while the tour
owned the nav). The conclusions above rest only on code paths + direct seed probes + the
log-confirmed Guniibuu arrival. Tour STOPPED this session; window re-parked at Sol, suite
19/19. Process rule for future drives: **stop `window._autoNav` before any nav-driving**; a
splash-boot via synthetic Space lands in perpetual demo mode (synthetic internal calls don't
count as user input for mode-ownership cancellation). Flag for lane B: whether the tour's
re-arm loop should survive past the boot at all.

**α-Cen A/B ruling (same exchange):** Max questioned the premise ("should some systems not
realistically be empty of planets? What am I missing?") — empty-is-realistic stands. Recorded
as **SHIP-AS-IS** (the documented 8% empty roll, rep-cap §6; consistent with observation — no
confirmed planets around A or B). The populate knob remains available as pure authoring
content any time; no build. Standing resolution — Max can redirect.

---

## Finding #3 — AC9 RE-RUN (2026-07-15, fix WS live at f6b3eff): far-companion systems read as adjacent duplicate binaries

**Max's observation (verbatim):** "Rigil Kentaurus A&B are right up next to Proxima Centauri
A&B... looks like 3 stars right next to each other in the prism view and then each is a binary
system in the system view. I feel like we keep running into the same issue..."

**Mechanism (live-verified in his window, same session):** the DATA layer is coherent — both
markers carry the same seed 1816942132, both browsed previews resolve to the authored Alpha
Centauri (knownName set, preview ≡ arrival exact, per the fix WS) — but THREE presentation gaps
make one system read as two:
1. **SYSTEM view titles by the clicked marker's name** (`_systemStar.name`): browsing Proxima
   renders the α Cen A+B pair under the title "Proxima Centauri" → reads as "Proxima Centauri
   A&B", a second binary with the wrong star types (G+K under an M dwarf's name) and 0 planets
   (Proxima's b/d ride the invisible far-companion payload).
2. **The SYSTEM view never renders `farCompanions` at all** (zero references in NavComputer) —
   the triple is never visible AS a triple anywhere: Rigil's view shows only A+B; Proxima is
   invisible in it.
3. **The prism has no co-membership cue** between a far-companion marker and its primary — two
   markers 0.055 pc apart (2 dots + 1 dot) with nothing saying "one system".

**Why it slipped the fix contract:** AC4 (preview ≡ arrival) and AC8 (per-marker dot honesty,
incl. the ratified "far companions with resolvable separations keep their own dot") both HOLD.
No AC ever said "a far-companion entry must present as a member of its system, not as a system
under its own name." The recurring class Max is naming: each pass makes one LAYER honest
(naming → seeds/data → per-marker glyphs) while the CROSS-VIEW grammar — "these views all
describe the same one system" — has never been anyone's acceptance criterion.

**Options for Max's ruling (design fork):**
- **(a) System-identity titling + component annotation (smallest):** known/named systems title
  the SYSTEM view by the system ("Alpha Centauri"), clicked component annotated ("via Proxima
  Centauri — far companion"); render `farCompanions` in the SYSTEM view (the triple becomes
  visible as a triple with Proxima's planets on the far chip). NavComputer-only, inside the
  ratified seam.
- **(b) Component-centric preview + arrival (R2's territory, bigger):** browsing/warping a
  far-companion marker centers ON that component (Proxima = M dwarf + b/d + "far companion of
  Alpha Centauri" link; arrival drops you at Proxima, not the pair). Touches arrival mechanics
  (main.js), lane-B-adjacent.
- **(c) Prism co-membership cue:** tether/bracket between far-companion marker and primary on
  hover/selection; label suffix ("Proxima Centauri · α Cen C"). Complements (a).

*(Recorded pre-ruling; Max decides scope + whether this blocks his AC9 verdict.)*

---

*(further findings append below as the UAT proceeds)*
