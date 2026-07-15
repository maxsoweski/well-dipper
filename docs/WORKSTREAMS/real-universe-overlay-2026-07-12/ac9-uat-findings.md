# AC9 — Max's batched UAT: findings record

**Workstream:** `real-universe-overlay-2026-07-12` · **Status: UAT IN PROGRESS** (started 2026-07-14)
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
  - **Label collision handling** (Max's hard requirement): declutter for overlapping labels —
    offset/stacking/leader lines and/or zoom-priority culling. Applies to real near-neighbors
    (Rigil↔Proxima) and dense procgen fields alike.
- **Boundary:** far companions with genuinely resolvable separations (Proxima at 0.055 pc) keep
  their own true-position dot; the glyph covers close multiples only (AC10's 2-close-star cap →
  procgen markers are 1–2 dots).

**Routing:** cross-lane C/D — record to the coordinator board at UAT wrap; lane D's scoping
(PRISM increments already in its charter) inherits the render half; lane C successor carries
oracle + data. Composes with the parked empty-rate-calibration seam (representation-cap §6).

---

*(further findings append below as the UAT proceeds)*
