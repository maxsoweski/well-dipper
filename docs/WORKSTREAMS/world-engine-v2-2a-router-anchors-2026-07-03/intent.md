# world-engine-v2-2a-router-anchors-2026-07-03 — intent

**The first half of the V2-2 pilot split** (§7a RESOLVED 2026-07-03: *"router + both anchors first,
stagnant response + mixed interior second"*). This half stands up the **Option-A anchor-preserving
router** and proves it clobbers nothing; the response that actually *answers* Max's complaint is V2-2b.

## Why we care

**Max's motivating concern for the whole condition-first re-founding** (ROADMAP-v2 §0, verbatim):

> *catalog-bounded variety* — **"every stagnant-lid world is a re-rolled Venus."** He wants condition
> **combinations** to produce **predicted-but-never-observed** landforms, not re-rolls of the catalog.

**The two shipped writers this pilot's router unifies** are the VOLCANIC writer (`magmatism.js` →
Lava/Magma, the **pure-weak** corner, ROADMAP-v2 §5 anchor #1) and the STAGNANT writer (`stagnantLid.js`
→ Venus, the **pure-strong** corner, anchor #2) — **NOT** the icy-shell writer (`shellRelief.js`), which
is a byte-preserved *sibling* the subtractive gate deliberately keeps OFF the pilot (AC-SUBTRACTIVE-GATE).

**Max's load-bearing UAT feedback** is on the pure-strong corner — the Venus stagnant-lid increment
(AC9, basis-level PASS 2026-07-03):

> *"These...look like the first steps toward the kinds of planets they're supposed to be. Very crude
> still. Landforms are pretty samey-looking (not necessarily between worlds but across the same world).
> This may be fine for this stage in the process."* → *"OK then, based on this description all pass."*

The load-bearing phrase is **"samey-looking … across the same world."** The Venus verdict routes it
explicitly: *"Within-world sameness is the KNOWN seed-only-BROADEN limitation, **owned by V2-2's
stagnant-side response space** (ROADMAP-v2 disposition #4b)."* That within-world variety is what a
**new stagnant-side response** delivers — and **that response is V2-2b, not this half.** (The pure-weak
corner — the volcanic Lava/Magma writer — was UAT-accepted separately at `world-engine-magmatism-multiply`
AC7, 2026-07-01: *"If that's expected then it passes."* The identical "samey-looking" quote also appears
on the icy-shell AC11 verdict, but that increment is a *sibling*, not a pilot corner — it is not the
router's delegate.)

**So why build V2-2a at all, if it renders nothing new?** Because the new response space cannot be
dropped onto the shipped writers safely without first proving the seam. V2-2a lays the **spine** of the
unification — one *condition-derived router* that classifies a body's E1 coordinates into pure-weak /
pure-strong / mixed / off-pilot — and proves, byte-for-byte, that routing the **already-UAT'd** Lava,
Magma and Venus worlds through it changes **not a single byte** of what renders. It also authors the
**instrument schema** (the `primitiveId` enum + `familyOf` map) that V2-2b's variety statistic will
measure. It **prepares** the fix; it does not ship it. This is the V2-0 character: a pure
routing/plumbing increment, zero player-visible change.

**And the standing process ask** (SPINE-CONFORMANCE, Max verbatim 2026-07-01):

> *"How can we always be operating in such a way as to be procedurally building this system, as opposed
> to me having to constantly ask 'are we tacking something on?'"*

The answer here is the same as every world-engine increment: the AC-0 spine-conformance check is a
*checked artifact* (§7 below), not vigilance — the router reads **E1 coordinates, never a label**, and
every field it emits has a named downstream reader.

## Success criteria (Max's language + the signed roadmap / gate briefs)

- **Both anchors byte-identical, through preserved code paths** (§5.1 Option A): a `pure-weak`
  classification calls `writeMagmatismSphere(...)` **UNCHANGED**; a `pure-strong` classification calls
  `writeStagnantLidReliefSphere(...)` **UNCHANGED**. Byte-identity holds at **both reference vectors**
  (`MAGMA_REF`, Venus) **AND at the real Lava + Magma preset vectors** — the shipped worlds the
  discipline actually protects (D3-MF3), with `T_ss` computed **before** the gate and passed through so
  Magma's substellar magma-ocean basin is bit-for-bit identical.
- **The router reads conditions, not archetypes** (§1 invariant): classification consumes the E1
  coordinates (`compositionClass`, `m_hp`, `L`, `geodynamicRegime`, raw Io-ratio) at the **pinned
  boundary defaults** — `L_STRONG = 0.63` (gate-1 §4, range [0.60,0.66]), the **tidal-shoulder rule**
  `pure-strong = L≥L_STRONG AND rawTidal < SHOULDER_LO(0.15)` (gate-2 PG-5), and `m_hp > 0` firing
  **before** `L` (gate-1 §4). A shipped preset drifting into `mixed` **fails** the conformance gate.
- **The gate is subtractive, and clobbers no shipped despun world** (D3-MF1): the unbroken-lid path
  requires `rocky/magma-ocean` **AND** (`heat-pipe edge` **OR** `hot-surface-stagnant edge`) **ONLY** —
  Mars and every currently-despun rocky body **stay on their fallback**; the two despun destinations
  (shell `eyeball-despun` for locked, final zonal fallback for unlocked; real Mars is unlocked → final
  despun) are never conflated; authored exotics stay behind the §1 label carve-out.
- **Zero behavioral change, everywhere** (§5.3 AC-ZERO-CLOBBER): the standing 75-golden byte-identity
  gate stays green **untouched** (the router is NOT wired into `writeBodyRelief` — that is V2-3), and
  the plate / shell / volcanic / stagnant sibling suites pass unchanged. Un-changed green **is** the
  zero-clobber proof for the shipped dispatch.
- **No new height-writing machinery** (§5.5): the `'lid:'` namespace is **RESERVED** (no draws this
  increment); a `mixed` vector routes to an **explicit-unimplemented marker** with `carrier.height` left
  **unwritten**. The instrument's *schema* (the `primitiveId` enum + `familyOf` map, lava-plain ≠
  stagnant-basaltic-plain per gate-3 Open-Q1/Q2) is authored as exported constants; its *populate +
  measure* is V2-2b.

## DOES / UNLOCKS card (Rule 15; edges read from the ROADMAP-v2 §3.1 DAG, not invented)

**What it DOES** (each output × what sets it × its named consumer — *nothing renders new; pure routing/plumbing*):

| V2-2a output | set by (input → derivation) | read by (named consumer) |
|---|---|---|
| `classifyLidPath(e1, rawTidal)` → `'pure-weak' \| 'pure-strong' \| 'mixed' \| 'off-pilot'` | E1 coordinates in gate order: `compositionClass` terminal → `m_hp>0` (pure-weak) → `L≥L_STRONG AND rawTidal<SHOULDER_LO` (pure-strong) → else mixed/off-pilot (gate-1 §4, gate-2 PG-5) | AC-CONFORMANCE-FINE test **now**; V2-3 dispatch flip |
| `isUnbrokenLidPath(e1)` — the subtractive gate (D3-MF1) | `rocky/magma-ocean` AND (`heat-pipe` OR `hot-surface-stagnant`) ONLY | AC-SUBTRACTIVE-GATE **now**; V2-3 (widens as siblings are absorbed) |
| `pure-weak` delegation → `writeMagmatismSphere(carrier, bodyDrivers, {macroSeed, locked, T_ss, tune})` **UNCHANGED** | `m_hp>0` (Lava/Magma; huge margin +7.8e5/+7.6e7) | AC-BYTE-WEAK-REF / -LAVA / -MAGMA **now**; ships byte-identical Lava/Magma |
| `pure-strong` delegation → `writeStagnantLidReliefSphere(carrier, grainDrivers, {macroSeed, regime})` **UNCHANGED** | `L≥L_STRONG AND rawTidal<SHOULDER_LO` (Venus 0.728 → +0.10) | AC-BYTE-STRONG-REF **now**; ships byte-identical Venus |
| `T_ss` pre-gate pass-through | caller computes `locked ? (T_eq ?? 0) * 1.4 : 0` (planet-lod-rivers.js:476), passed in opts UNCHANGED | AC-TSS-PRE-GATE + AC-BYTE-MAGMA (basin byte-identity, T_ss>LIQUIDUS) |
| `mixed` → explicit-unimplemented return-marker; `carrier.height` **unwritten** | mixed band (hand-set only in V2-2a — no shipped preset reaches it) | AC-MIXED-STUB **now**; V2-2b swaps the real mixed machinery in at exactly this branch |
| `primitiveId` enum + `familyOf` map — exported constants (lava-plain ≠ stagnant-basaltic-plain; PIERCE=1/TENT=0) | authored schema (gate-3 Open-Q1/Q2) | AC-PRIMITIVEID-SCHEMA **now**; V2-2b `primitiveId` populate + the gate-3 `Π=C·F` interpenetration statistic |
| `'lid:'` alea namespace **RESERVED** (no draws) | — | V2-2b `'lid:strength:'` / `'lid:yield:'` mixed-interior draws (gate-2 PG-1) |

**What it UNLOCKS:** **V2-2b** — the mixed-interior + stagnant-side response drops into the `mixed`
branch and the reserved `'lid:'` namespace (the `'lid:strength:'`/`'lid:yield:'` draws, `AC-ORDER-MIX`,
`AC-MIX-DISCRETE`, AC5 within-world variety, the from-scratch `stagnantDriversToTune`, the `primitiveId`
populate + `centerId` co-emit + the `Π=C·F` statistic freeze, all three §5.4 falsification worlds, and
the pilot UAT card). **V2-3** — dispatch flips to read `classifyLidPath`, retiring `PRESET_ARCHETYPE`.
Per §3.1, V2-2 as a whole unlocks *"Tharsis-volcanism expression; corona-pierced, heat-pipe-to-stagnant,
wet-stagnant worlds; the pierce↔tent↔flood continuum"* — but **only V2-2b renders any of them.**

**Program context / line of sight:** serves the north star (*count of genuinely distinct,
history-coherent worlds visible per minute*, §0) by standing up the router the whole condition-first
architecture routes through. JOURNEY milestone = the SCREENSAVER world-variety arc. **No
PLAYER_EXPERIENCE tier is touched** — the tier lands when V2-2b fills the response space and V2-3/V2-10
wire it to what renders.

## Deliberate non-goals (scope fence)

**Everything mixed-interior + stagnant-response is V2-2b** (§7a "stagnant response + mixed interior
second"):
- No mixed-interior height machinery: the `'lid:strength:'`/`'lid:yield:'` draws (gate-2 PG-1),
  `AC-ORDER-MIX` (absolute-datum province stack + edifice budget bound, §2.4), `AC-MIX-DISCRETE`, and
  `AC5` within-world variety.
- No stagnant-side response: the from-scratch `stagnantDriversToTune` build and its stagnant-side
  `AC-TUNE-NULL` (the builder does not exist today — §3.2 #4b; this half's AC-TUNE-NULL is **weak-side
  only**).
- No `primitiveId` **populate/measure**: the multi-valued populate, the `centerId` co-emit (gate-3
  Open-Q3), and the `Π=C·F` / `M` statistic real-world freeze (gate-3 Open-Q6) — V2-2a authors the
  *schema* only.
- No falsification worlds: the wet-stagnant world (§5.4 #1, **still OPEN** pending E1's effective-`L`
  mechanism), the corona-pierced compound (§5.4 #2), and the Tharsis integration checkpoint (§5.4 #3,
  hand-set D-vector) — all V2-2b.
- **No UAT AC** (Q6): V2-2a produces byte-identical output to worlds Max has already UAT-passed — the
  **volcanic Lava/Magma corner** (via #4a skeleton + `world-engine-magmatism-multiply` AC7, accepted
  2026-07-01) and **Venus** (via #4b — AC9 basis-level PASS 2026-07-03) — and **no new visible world**.
  (The icy-shell AC11 is a *sibling* writer, NOT a pilot corner, so it is not cited as a delegate here.)
  Per the omit-when-no-experience rule, and because the pilot UAT card (UAT-RUBRICS Increment 4/4b) is
  entirely about *rendered* worlds, the UAT belongs to **V2-2b**. V2-2a's terminal gate is
  `verify-workstream` green → **VERIFIED** (no `VERIFIED_PENDING_MAX` hold — the V2-0 pattern).
- **No standalone AC2/AC3** (structure + latitude-control, §5.3 row / grounding Q4): at the two anchors
  it is **subsumed by AC-BYTE-*** (the router's corner output is byte-identical to the shipped
  Lava/Magma/Venus worlds that already PASS AC2/AC3, so bit-for-bit equality proves it without a re-run);
  the **mixed-world** AC2/AC3 is **V2-2b**.

**Standing §5.5 non-goals (unchanged):** no dispatch flip (V2-3); no game port / `_pickType` change
(V2-10); no palette/shader; no plate-path demotion; no shell unification (SP-LID-DISRUPTION design-noted
only); no retirement of `magmatism.js` / `stagnantLid.js`; no single-sequence collapse. The router is
**lab-only with ZERO dispatch influence** this increment — exactly the V2-1 shadow discipline, one layer up.
