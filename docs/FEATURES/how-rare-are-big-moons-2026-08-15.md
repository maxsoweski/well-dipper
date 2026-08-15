# What "rare" means — the literature answer, and the target rates it supports

**Date:** 2026-08-15 · Produced by the `wd-how-rare-are-big-moons` workflow (5 agents: 4 sourced
literature sweeps + 1 reconciliation). Raw output in `scratchpad/rare-moons-*.json`.

**Why:** the moon-formation audit found the owner's operative clause — *"so long as they're rare"* —
was never operationalised, leaving the acceptance bar unfalsifiable. This supplies it.

⛔ **Every number below carries its source. Where the literature has no number, this file says so
rather than borrowing one.**

---

## 0. ⭐⭐ FIRST, A FRAMING ERROR IN HOW THE QUESTION WAS PUT

The audit reported, and the open question repeated, that planet-class moons are **26 of 829 = 3.1%**
and asked what that number should be. **That denominator is per-MOON, and nothing in the literature
uses it.** Converting requires a quantity the generator has never emitted: **mean moons per system
(m̄)**.

    large moons per system = (per-moon fraction) × m̄

At m̄ = 20 the game's 3.1% is a **per-system rate of 62%** — nearly two systems in three. ⛔ **Until
the generator reports m̄ and a per-parent-planet rate, its 3.1% cannot be compared to anything
published, in either direction.** Emitting those two figures is a prerequisite for any acceptance
test, and is cheaper than any fix in the audit.

---

## 1. ⭐ THE DESIGN FINDING — these are TWO different objects, not one dial

The literature treats Moon-class satellites and >1 R⊕ companions as **different objects made by
different mechanisms around different parents.** They need separate targets and separate gates.

### Band A — Moon-class satellites, ~0.2–0.7 R⊕, SOLID parents
Giant-impact channel. Well supported.
- **Target: 1 in 4 to 1 in 15 systems** host at least one. Both ends are Elser, Moore, Stadel &
  Morishima (2011, *Icarus*; arXiv:1105.4616) — 25% and 2.2% per terrestrial planet — converted
  through ~3 terrestrial planets per system, `1 − (1−p)³`. That conversion is defensible because
  denominator and multiplicity come from the same simulation suite.
- **Parent gate:** rocky < 6 M⊕, icy < 1 M⊕ (Nakajima et al. 2022, *Nat. Commun.* 13, 568). Above
  that the debris disk fully vaporises. **A binary condition, not a probability.**
- **Size cap ~0.6 R⊕:** Malamud et al. (2020, MNRAS 492, 5089) never exceeded 0.186 M⊕ across
  parents up to 18 M⊕. ⚠ The radius is the workflow's arithmetic; the paper states no radius.

### Band B — the >1 R⊕ companion Max asked for, GAS-GIANT parents only
- The **only** published mechanism is pull-down capture during runaway envelope accretion: Hansen
  (2019, *Sci. Adv.* 5, eaaw8665) captures a ~10 M⊕ body around a ~2 M_J planet at **8.5% / 2.1% /
  0.3%** efficiency for envelope-growth timescales of 10 / 100 / 1000 orbital periods — **conditional
  on a co-orbital body already existing, a precondition the paper does not price.**
- Generous ceiling: 26.6% of stars host a giant (Fernandes et al. 2019, ApJ 874, 81) × 8.5% capture,
  precondition treated as certain → 2.3% ≈ **1 in 45 systems**. Hard ceiling, since P(precondition) ≤ 1.
- Empirical anchor: 14.1% of stars host a 2–8 au giant (Fulton et al. 2021) × the 1-in-70 cool-giant
  candidate yield (Kipping et al. 2022, *Nat. Astron.* 6, 367) → 0.20% ≈ **1 in 500 systems** — and
  this end collapses toward zero if that candidate is spurious, which Heller & Hippke argue.
- **Target: roughly 1 in 150 to 1 in 250 systems**, between the two, nearer the anchor.
- **Per-moon check:** across any plausible m̄ from 5 to 50, Band B lands between **0.004% and 0.4%
  of all generated moons.** The current 3.1% is **8× to ~800× too high** depending on m̄.

---

## 2. ⛔ THE HARD FINDING — no published channel makes a 2 R⊕ MOON at all

A 2 R⊕ body is roughly 5–10 M⊕, which is **above Nakajima's 6 M⊕ threshold for being a moon-forming
PARENT.** Malamud topped out at 0.186 M⊕ and called collisional formation of a detectable exomoon
"extremely difficult." Barr & Bruck Syal (2017, MNRAS 466, 4868) reached a 0.3 M⊕ *disk* (~0.72 R⊕
if fully assembled — again the workflow's arithmetic; ⚠ the paper's 4.37 g/cm³ density figure is
"widely misquoted as Earth-radius"). Cilibrasi et al. (2018, arXiv:1801.06094) predict a
circumplanetary tail reaching "a few Earth masses," but that is one model-dependent synthesis in
tension with the Canup & Ward cap, and the HEK limit constrains the same channel.

> ⭐ **The honest design ruling: if the game wants 2 R⊕ companions, they are BINARY PLANETS, not
> satellites.** And the literature is *more* permissive there, not less — **Ochiai et al. (2014,
> ApJ 790, 92) give ~10% of systems undergoing orbital crossing; Lazzoni et al. (2024, MNRAS 527,
> 3837) give 14.3% per simulated system**, both gas-giant only.

⭐ **This independently confirms the option raised and withdrawn in
[`world-engine-reconciliations-2026-08-15.md`](world-engine-reconciliations-2026-08-15.md) §3.1** —
arrived at there from orbital arithmetic, here from the formation literature. **And it inverts the
cost:** as a moon, a 2 R⊕ companion is unsupported at any rate; as a binary planet it is
~**1 in 7 to 1 in 10 systems** — far commoner than the 1-in-200 Band B allows.

---

## 3. ⭐ THE CONDITIONING VARIABLES — this is the anti-dice-roll machinery

The audit's §5 warned that every channel proposal hung on "system dynamical temperature," which the
generator does not have. **These four are real, sourced, and computable from attributes the
generator already holds or can derive.**

| driver | dependence | source | strength |
|---|---|---|---|
| **Stellar mass × metallicity** — gates whether a Band B parent exists at all | **f ∝ M\* × 10^(1.2·[Fe/H])**, 3.5% at 0.5 M☉ → 14% at 2 M☉ at solar [Fe/H] | Johnson et al. 2010, ApJ 721, 1104 | ⭐ **measured, not simulated** — the cleanest directly-implementable dependence available |
| **Stellar mass** — suppressor for large moons in the HZ | Luna-like moons unstable before 1e7 yr at M4, 1e8 at M2, <1e9 at M0 | Patel et al. 2025 (arXiv:2511.03625); Zollinger et al. 2017 (M\* ≲ 0.2 M☉ cannot host); Barnes & O'Brien 2002 (floor M\* > 0.15 M☉) | ⭐ **largest single suppressor**, since M dwarfs dominate the stellar population. Three-way agreement in direction |
| **Parent orbital period** — the retention curve | ~0 below 10 d · rising 10–300 d · **50% near P ≈ 100 d** · 70–90% above 300 d, for moons 1–10% of parent mass | Dobos et al. 2021, PASP 133, 094401 | exactly the planet-class regime; apply as a multiplier on the parent's actual period |
| **Parent mass** — vaporisation gate | rocky > ~1.6 R⊕ (~6 M⊕), icy > ~1.3 R⊕ (~1 M⊕) cannot form a fractionally large moon | Nakajima et al. 2022 | **binary condition** — multiply, don't roll |

Analytic floor worth carrying: in-situ prograde moons cannot survive below **a_p ≈ 0.016 au**,
scaling as (M\*/M☉)² · (2 g cm⁻³ / ρ_sat) — Namouni 2010, ApJL 719, L145.

⭐ **Metallicity and stellar mass are already in `zones`; parent mass and orbital period are already
on the record at moon-generation time.** All four are available without a reordering.

---

## 4. ⚠ CONFIDENCE — and a correction to a number this project already quoted

**Measured (lean on these):** giant-planet occurrence rates (Fernandes 2019; Fulton 2021);
TNO binary fractions ~30% cold classicals vs ~10% excited (Noll et al. 2020, arXiv:2002.04075);
dwarf-planet satellite mass ratios by ALMA wobble (Brown & Butler 2023) — Orcus–Vanth 0.16 ± 0.02,
Pluto–Charon ~0.125, Eris–Dysnomia < 0.0085.

**Upper limits from null detections — ⛔ NOT rates.** HEK's **η < 0.38 at 95%** for Galilean-analog
moon *systems* (Teachey, Kipping & Schmitt 2018, AJ 155, 36) is dominated by a non-detection; its
central 0.16 rests on a Bayes factor of ~2 the authors call "no more than a hint." ⭐ **The HEK
sensitivity figures ("Pluto–Charon ratios for ~40% of KOIs") are COMPLETENESS, not occurrence — the
single most common misquote in the field.**

**Simulated, and thinner than it looks.** Elser's 8% is **one 2011 study of 64 simulations under a
perfect-accretion assumption**, patched with a flat 30% angular-momentum reduction, with
simulation count and initial-condition range flagged as HIGH unquantified uncertainty *on top of*
the 2–25% bracket. No modern redo with imperfect-accretion codes was found. **It is a fifteen-year-old
single-study number carrying the field, in open unresolved dispute with Raymond et al. (2009,
*Icarus* 203, 644), who found only 4% of late giant impacts met Canup's criteria — zero of the last
three on any Earth analog — and concluded "the Earth's Moon must be a cosmic rarity."**

⛔ **CORRECTION TO THIS PROJECT'S OWN AUDIT.** The migration-retention figures the audit carried and
that were reported in conversation — *"~5% prograde / ~24% retrograde under disk migration, ~0% /
~0.6% under high-eccentricity migration"* — come from **Pu, Li & Zhu (2025, arXiv:2509.13263), an
unrefereed preprint containing a stated arithmetic error (6/637 printed as 0.0094%) and an
abstract/conclusion contradiction.** Do not use them. Use Dobos 2021's period curve instead.

**Also flagged unreliable:** Meier et al. (2024/25)'s 191/6247 = 3.1% direct-satellite figure is
numerically identical to the game's current 3.1% and means something entirely different — its grid
is pre-selected to be Moon-favourable, so it is "per impact already in the good regime," and
Kegerreis et al. (2022, ApJL 937 L40) show it is resolution-dependent. Stewart & Leinhardt's
"one third each" outcome split reached the sweep only via secondary sources and is **unverified**.
Sasaki & Barnes (2014) is second-hand and **unverified**.

**Two live disputes, reported not resolved:** Kepler-1625 b-i and Kepler-1708 b-i. Heller & Hippke
(2024, *Nat. Astron.* 8, 193) find false-positive rates of 10.9% and 1.6% and conclude neither is
likely moon-hosted; Kipping et al. (2025, *Nat. Astron.* 9, 795) reply both remain viable.

---

## 5. WHAT THE LITERATURE DOES NOT SUPPORT — say it, don't borrow

- **No occurrence rate for ~1–2 R⊕ moons around anything.** §2.
- **No retention rate for giant-impact moons specifically.** Every retention study simulates moons
  of *giant* planets; Gyr survival of a Moon-analog around a solid planet is N = 1 plus generic
  tidal criteria.
- **No composite retention rate.** Nobody has published branching fractions for scattering vs
  high-e migration vs quiescent evolution alongside per-channel retention. ⛔ Composing
  Dobos × Hong × Patel assumes an independence no paper supports.
- **No mass-ratio distribution for satellites as a population.** The two real ones (Robinson et al.
  2020, A&A 643, A55, for pebble-cloud collapse at ~100 km; Cilibrasi for gas-giant disks) are
  channel-specific and non-overlapping. ⛔ **TNO binary statistics do NOT transfer to planet scale** —
  the controlling parameter has no planet-scale analogue.
- Unquantified: stripping by stellar flybys in clusters; retention around binary/multiple stars;
  terrestrial binary-planet occurrence.
