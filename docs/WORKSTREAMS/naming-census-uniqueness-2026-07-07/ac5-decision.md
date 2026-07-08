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
