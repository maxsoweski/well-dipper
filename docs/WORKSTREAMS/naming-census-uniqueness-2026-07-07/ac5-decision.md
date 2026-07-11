# AC5 decision record — naming scheme ratified with amendments (2026-07-07)

Max reviewed the census report + NAMING_AND_REAL_OBJECTS.md (D1–D5) and ruled. His words:

> "your recommendations all sound good to me, but i like the hard guarantee, so long as
> every name doesn't have to become multi-part. I'm fine with many names being multi-part.
> I'm also very okay with many systems having a positional name; even with a galaxy where
> settling/discovery/naming has become commonplace with warp travel for thousands of years,
> the vast majority of stars would still have those names based on location"

## Ratified scheme (feeds AC6/AC7/AC9 builds)

1. **Hard uniqueness guarantee, by construction, no registry** — every procgen name derives
   injectively from the system's canonical position (its stable identity). Same position →
   same name forever (AC7 falls out of the same root fix); two positions can never share a
   full name.
2. **Name classes** (lore: thousands of years of warp-era settlement; most stars keep
   location-based designations):
   - **Positional/catalog designations** — the common case. Catalog numeric ranges widened
     to cover the sector space; tiny real-survey ranges (TRAPPIST 1–99 etc.) dropped or
     bounded to realistic counts (D2: "TRAPPIST-92 is a worse immersion break than a
     collision").
   - **Multi-part fantasy** ("Lyreon Vask" / "Lyreon Theta-12" shapes) — common; the second
     part carries the position-derived uniqueness bits.
   - **Bare fantasy words** ("Lyreon") — deliberately RARE, the "settled/discovered" proper
     names. Allocated injectively from a finite partitioned word supply (deterministic
     eligibility by position; allocation capacity kept ≤~50% of supply as safety margin).
     Exact scarcity ratio is build latitude; Max reacts to fresh samples at UAT.
   - **Real proper names** — real stars only, from the regenerated catalog. Procgen may
     never emit one of the ~355 real proper names (blocklist check).
3. **Real names win on every targeting path** (D4 ratified as a scheme rule; AC7
   implements — sky-click stops discarding `entry.starData.name`).
4. **No-position fallback eliminated** (D5): every naming call site must carry a canonical
   position; the sectorCode-0 branch goes away rather than being mitigated.
5. **D7 pulled forward into this workstream as AC9:** regenerate `public/assets/data/`
   `hyg-stars.json` with the already-fixed `scripts/process-hyg-catalog.mjs` so ~15.6k real
   stars carry usable names (proper name or HD/HIP designation) instead of the `"` artifact.
6. **D1 (regional style mix):** region flavor weights persist in spirit (core more
   catalog-heavy, rim more fantasy-leaning) re-expressed over the new name classes; exact
   ratios are build latitude, reviewed via refreshed samples at Max's final UAT.

## Explicitly deferred to the successor real-universe-overlay workstream

- D8 (real planet/system characteristics — new data source + merge logic)
- D9 (schema unification across the four real-object mechanisms — tolerate four adapters
  for now)

Increment plan after this gate: **3a** = AC9 (HYG regen) + sky-click real-name fix;
**3b** = position-derived procgen naming (AC6 + AC7); then AC8 Sol guardrail + the batched
live checks (incl. increment 0's Horsehead render).

## Addendum — sample-review knob rulings (2026-07-08, after increment 3b)

Max reviewed the first position-derived samples and ruled on the three flagged knobs:

1. **Shorter, astronomy-shaped designations:** "I like your recommendation, and I like
   something like the real astronomy designations (expanded and with creative sci fi
   license)." → Survey designations should read like plausible catalog entries the way
   real surveys encode position into designations (2MASS J05551028+0724255,
   PSR B1919+21), with fictional far-future survey prefixes — structured/grouped
   coordinate-style fields, not base-36 serial soup. Prefer encoding the star's
   generative grid-cell identity (fewer bits, kills the cross-color residual) if call
   sites can recover it; else a coarser quantization.
2. **Bare-word rarity stays; enumerability is the requirement:** "Not sure if this is an
   issue, so long as we can find them... in setting, settled systems would be cataloged
   for those who want to find them." → Keep ~1-in-16.8M (≈12k settled systems
   galaxy-wide). The allocation must be deterministically ENUMERABLE (helper + gazetteer
   emit) so a future in-game "settled systems catalog / search" feature can list them.
   That UI feature itself = captured ask for the successor workstream / parked
   system-tags-save-search revival, NOT this workstream.
3. **Greek style returns:** "I like this idea." → Restored as a fourth class (greek
   letter + region-flavored word + position-bit numeral), region-weighted.

## Addendum 2 — class restructure ruling (2026-07-08, after increment 3c)

The 3c bit-floor finding (full-galaxy injectivity floors any bits-bearing name at ~14
base-36 chars; "Alpha Vozara 4821"-style names for every system are mathematically
impossible) was put to Max with the recommendation: put the long codes where nobody
cares — common systems get designations, only notable systems get names, mirroring real
astronomy (Bayer letters belong to bright stars only) and the settled-systems lore.
Max: **"Yes, restructure based on your suggestions here."**

Ratified class structure (increment 3d):
- **Common** (bits-bearing, long codes acceptable *by design*): survey designations +
  multipart fantasy — current 3c shapes.
- **Greek — rare allocated class** ("notable systems"): letter + short pleasant word +
  short numeral ("Alpha Vozara 4821" shape). Injectively allocated from a finite
  partitioned supply via sparse position eligibility (same pattern as settled systems),
  NOT position-bit encoding. Frequency: uncommon but regularly encountered (order
  1-in-500 to 1-in-2000; build latitude, supply fill ≤50%). Enumerable (notable-systems
  catalog basis).
- **Bare words — stay very rare** (~1-in-16.8M settled systems), but now SHORT
  (2-3 syllables, "Veshara"/"Kolnir" shape) since allocation only has to cover ~12k
  systems, not encode raw position. Enumerable (existing gazetteer/helper).
- Real-proper-name blocklist applies to both rare-word supplies. All hard constraints
  unchanged (pure function of position, no registry, zero duplicates, revisit-stable,
  path-agreeing, D5 throw, contents untouched).

## Addendum 3 — shipped named-systems catalog (2026-07-08, after 3d blocked)

Increment 3d blocked itself correctly: registry-free runtime allocation must be injective
over every ELIGIBLE position (not just occupied stars), so short pretty words are
mathematically impossible at meaningful frequencies (full arithmetic in the 3d workflow
result). Working-Claude's "rarity escapes the bit floor" reasoning was wrong at the
proposed frequencies — corrected on record.

Resolution put to Max: make his own lore literal — "in setting, settled systems would be
cataloged" → ship the catalog. Max: **"This sounds good."**

Ratified structure (increment 3e):
- **Build-time script** deterministically selects real star positions (via the actual
  HashGridStarfield generation code, so positions match in-game stars exactly) and
  authors a static named-systems catalog: ~12k settled (bare pretty words, "Veshara"
  shape, mixed CV/CVC open-vowel alphabet) + ~30-60k greek notables ("Alpha Vozara 4821"
  shape). Duplicate-checked + real-proper-name-blocklisted AT BUILD TIME.
- **Placement lever:** a documented fraction of notables placed near known objects/
  features (nebulae, clusters) so players meet named systems more often than uniform
  chance — tunable.
- **Runtime:** synchronous lookup by quantized position key, precedence
  known-systems > real-star names > named-catalog > procgen. The FIFTH data mechanism,
  same pattern as KnownSystems.
- **Procgen simplifies to two classes** (survey + multipart designations — long by
  design; region weights rebalanced). The 3c greek/bare runtime classes are REMOVED.
- Hard guarantee holds end-to-end: catalog uniqueness by build-time check; procgen
  injective as in 3c; shape exclusivity prevents cross-collisions.
- Named systems are a finite set — lore-consistent (settlement history is finite).
