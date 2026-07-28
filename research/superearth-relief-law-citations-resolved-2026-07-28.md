# The three unresolved citations — RESOLVED (2026-07-28)

> Companion to `research/superearth-relief-law-2026-07-28.md`, which flagged three citations as
> unverified and said **"someone must open the book."** Two of the three are now retrieved and read
> in full. This file records what they actually say, because in both cases they say something
> **different from what the derivation claimed**, and in one case they relocate a conclusion.
>
> Retrieved by direct PDF fetch + PyMuPDF text extraction (the `WebFetch` markdown converter returns
> unusable binary for both files — extract locally, don't re-try the fetch-and-read path).

| citation | prior status | now |
|---|---|---|
| Melosh 2011 ch.3 (**load-bearing**) | UNVERIFIED — "sole cited support for the piecewise structure" | ✅ **RETRIEVED, quote verbatim-confirmed** — `https://sseh.uchicago.edu/doc/ch4_of_melosh.pdf` (file is named ch4, contains **Chapter 3, "Strength versus gravity"**, book pp. 49–103) |
| Kite, Manga & Gaidos 2009 | UNVERIFIED verbatim quote | ✅ **RETRIEVED** — `https://sseh.uchicago.edu/doc/Kite_et_al_ApJ_2009.pdf`, ApJ 700:1732, doi:10.1088/0004-637X/700/2/1732 |
| Valencia et al. 2006 (astro-ph/0511150) | NOT RETRIEVED | still open — assigned to the g(R) grounding pass |

---

## 1. Melosh 2011 — the quote is REAL, verbatim, and correctly attributed

**Book p. 64, §3.3.3 "A model of planetary topography"** (verbatim, lower-case as the extraction
renders it):

> "same for all the terrestrial planets, we should expect 8 km high mountains on Venus, 24 km high
> mountains on Mars and 50 km high mountains on the Moon. as shown in figures 2.3b and 2.3e, this is
> not far off for Venus and Mars, but is more than twice the observed topographic range on the Moon
> in figure 2.3d. **evidently strength is not the major factor limiting the Moon's topography:
> History must play a role, too.**"

The derivation quoted this accurately. **The load-bearing citation gap is closed.**

### 1a. The formula is right, but Melosh never writes it as `2Y/(ρ_c g)`

Melosh's actual equations (book p. 63):

- **(3.16)** `Y ≈ ½Δσ = (2/3)·π·G·ρ̄·ρ_c·R̄·Δh`
- **(3.17)** `Δh ≈ (3/2π)·Y/(G·ρ_c·ρ̄·R̄)`
- **(3.18)** `Δh_earth(m) ≈ 80.4·Y(MPa)` for ρ̄ = 5200, ρ_c = 2700, R̄ = 6340 km

Substituting his own **(3.15)** `g = (4/3)πGρ̄R̄` into (3.17) collapses it to `Δh = 2Y/(ρ_c g)`.
Verified numerically: (3.17) gives **80.37 m/MPa**, `2Y/(ρ_c g)` gives **80.37 m/MPa**, book says 80.4.

So `h = 2Y/(ρ_c g)` **is** Melosh eq 3.17, and Guimond+2022's second-hand attribution is correct. The
"different Melosh max-height form" a prior search surfaced (`H_max = (2c/ρg)·tan(45+Φ/2)`) is the
**Coulomb/frictional** small-body branch (his eq 3.20–3.21 territory), not a competing statement of
the same law. Not a contradiction.

⚠️ **The "2" is the optimistic end of a factor-1.5 band.** Jeffreys' Theorem as Melosh states it
(p. 62): *"The minimum stress difference required to support a surface load of ρgh is (1/2 to 1/3)
ρgh."* He takes the ½ branch. The ⅓ branch gives `h = 3Y/(ρ_c g)`. Any ceiling quoted from this
formula carries ±50% before the uncertainty in `Y` is even considered.

### 1b. ⭐ The break is NOT at g = 1 — and Melosh's own data says it cannot be located in g at all

Melosh applies a *fixed* `Y` across the terrestrial planets and reports where the model holds. I
recomputed his ceilings at Y = 100 MPa and the observed/ceiling ratios independently:

| body | g (g⊕) | strength ceiling | observed relief | obs/ceiling |
|---|---|---|---|---|
| Earth | 1.000 | 7.6 km | 19.9 km | **2.63** |
| Venus | 0.904 | 7.8 km | 13.7 km | **1.76** |
| Mars | 0.378 | 18.6 km | 29.4 km | **1.58** |
| Mercury | 0.377 | 18.6 km | 9.8 km | **0.53** |
| Moon | 0.165 | 48.4 km | 19.9 km | **0.41** |

This **independently reproduces the derivation's table** (it had 1.75 / 2.62 / 1.50 / 0.49 / 0.44) —
that table is sound.

Melosh's verdict partitions these as {Venus, Earth, Mars} = "not far off" versus {Moon} = strength is
not the limiter. **Mars and Mercury sit at effectively identical gravity (0.378 vs 0.377) and land on
opposite sides of that partition, 1.58 vs 0.53 — a factor of 3 apart.**

> **Therefore: the audit's "the g = 1 break is DECLARED, not derived" understates the problem. The
> data cannot locate a break anywhere in g. Whatever separates Mars from Mercury is not gravity, and
> Melosh names it: "History must play a role, too."**

Consequence for the code: a piecewise-in-g structure with a break at g = 1 has **no support from its
own load-bearing citation**, and the citation's actual message is that the supply/history-limited
regime is the **low-g** end, not the super-Earth end.

### 1c. A tension the v2 derivation must state, not hide

Melosh's model line implies fractional relief `Δh/R̄ ∝ 1/R̄²` (his eq 3.17 at fixed ρ̄, and his own
description of Figure 3.5, book p. 69: *"following an approximate 1/R̄² dependence on the log–log
plot… the ultimate strength of planetary crusts is about 0.1 GPa"*).

The anchors the code actually fits do not show that. Refitting `relief/R` (Earth forced = 1, through
the origin) over the code's own anchor set:

```
relief/R ~ g^-0.559   (Earth/Mercury/Mars/Moon/Mimas)   <-- reproduces the code's Q_RELIEF = 0.58
relief/R ~ g^-0.699   (Mimas excluded)
relief/R ~ R^-0.790   (all five)
relief/R ~ R^-0.860   (Mimas excluded)
```

The strength model wants **R^-2**; the observed anchors give **R^-0.86**. Melosh acknowledges exactly
this gap for the Moon and attributes it to history.

> **So `Q_RELIEF = 0.58` is not "wrong" — it is an OBSERVED exponent, and it disagrees with the
> STRENGTH-MODEL exponent by a factor of ~2.3 in log-slope.** The v2 derivation proposes adopting
> `q = 1` (the strength model) above 1 g. That is defensible — above 1 g there is no data and the
> model is all we have — but it means **switching from the observationally-fit exponent to the model
> exponent exactly where the model is untestable**, and the model demonstrably over-predicts size
> dependence in the one regime where it *can* be tested. Label it as such in code and in the doc.

Also confirmed for the record (p. 69): Melosh puts the frictional→strength regime break at
**R̄ ≈ 200 km**. Mimas (R = 198 km) sits *on* that break, so including it in the `Q_RELIEF` fit mixes
two physical regimes. Excluding it moves the fit 0.559 → 0.699.

---

## 2. Kite, Manga & Gaidos 2009 — the 1/g lever is real, but the paper's net result is the opposite

**§3.1, verbatim:**

> "Potential temperature increases monotonically with mass, so the pressure at the base of the crust
> also increases monotonically (Figure 3). However, **the absolute thickness of the crust also scales
> as the inverse of gravity.** In other words, although bigger planets run hotter, higher surface
> gravity moves the solidus and suppresses melting. For temperatures close to the solidus, the first
> effect dominates, and **increasing planet mass increases crustal thickness** (Figures 5(b) and (c)).
> Young and/or large planets show the opposite trend, with crustal thickness decreasing as planet
> mass increases. **Crustal thicknesses are within a factor of 2 of each other for 1–25 M⊕** until
> 8.6 Gyr."

**Abstract, verbatim:** *"(2) crustal thickness (and melting rate normalized to planet mass) is
**weakly dependent on planet mass**"*

So the `1/g` clause the derivation cited **exists verbatim** — the citation is not fabricated. But
citing it as support for `h ∝ 1/g` is **selective**: in Kite's own model the 1/g suppression is
cancelled by a hotter interior, the net dependence is weak, and over 1–25 M⊕ crustal thickness varies
by less than a factor of 2. Taking the 1/g half while dropping the compensating half overstates the
case for `q = 1`.

⚠️ **And Kite+2009 says nothing about topography at all.** Full-text search over the paper:
`topograph` — **0 hits**. `relief` — **0 hits**. `elevation` — **0 hits**. Route (3) is therefore an
inference *from* Kite, not a result *of* Kite — the same charge the audit already sustained against
route (4). It must be relabelled the same way.

---

## What this changes in the v2 derivation

1. ✅ **Melosh is verified.** Stop treating the piecewise structure as resting on an unverified quote.
2. ❌ **But it does not support a break at g = 1.** Drop that framing. Melosh's evidence places the
   supply/history-limited regime at **low g** (Moon, Mercury), and shows gravity cannot separate Mars
   from Mercury at all. → **This is now a decision for Max**, and it is a different decision from the
   one on record: not "hard kink or smoothed `min()` at g = 1?" but **"should there be a g-break at
   all, or is the honest structure one law in g plus a history/composition term?"**
3. ❌ **Route (3) (Kite) drops out as an independent lever** — it is an inference, and Kite's net
   result contradicts the strong form. With route (1) ≡ (3) ≡ (4) already collapsed by the audit and
   (3) now further weakened, the derivation is down to **one mechanistic route (Guimond's convective
   dynamic topography) plus the strength ceiling.**
4. ⚠️ **New, and it belongs in the code comment:** `Q_RELIEF = 0.58` is an *observed* exponent that
   disagrees with the *strength-model* exponent (R^-2) by ~2.3× in log-slope. Adopting `q = 1` above
   1 g is adopting the model over the data in the regime where the data ends. That is the honest
   description and the comment must say it.
5. 📌 `h = 2Y/(ρ_c g)` should be cited as **Melosh 2011 eq. 3.17 (rearranged via eq. 3.15)**, with the
   note that the leading 2 is the ½-branch of Jeffreys' Theorem and the ⅓-branch gives 3 instead.

Still open: **Valencia et al. 2006** (astro-ph/0511150), load-bearing twice as a mass–radius
cross-check.
