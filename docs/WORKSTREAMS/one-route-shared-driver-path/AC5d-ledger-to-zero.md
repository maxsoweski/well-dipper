# AC5d — the ledger reaches zero, and what that does and does not mean

**Landed:** 2026-08-26 · `1d15cbc` (the arm) + `c7bc437` (the migration)
**UAT:** ✅ **CLOSED by Max, 2026-08-27** — *"looks the same"*, on the lab parked at
`Gas giant (Jovian)`, 2.4 body radii. Invisible was the pass: the whole workstream moves the route,
not the pixels. ⚠ In the same sitting he named three REAL gas-giant defects — the great spot not
blending, a terrestrial cloud shader over the bands, missing "ink in water" complexity — and ruled
them behind the wiring. They are QB-16/17/18, not regressions from this work.

**Method:** a 12-agent survey/refute/synthesise workflow, which killed the plan it was asked to check.

---

## 1. The plan the workflow killed — and my premise with it

I told Max "the lab's eight call sites in `applyDrivers`". **Three of the eight are not in
`applyDrivers` at all** — giantSurface, rockySurface and craterDeck are in `ensureNetworkRouted`,
giantDeck is in `rebakeE5Bands`, polarDeck is in `applyStormState`; and the last two are also reached
from `reseedGiant()`, which never goes through `applyDrivers`.

Three independent lenses refuted the single-composer-call plan, all at high confidence:

| lens | what kills it |
|---|---|
| ordering | limbDeck's mirror must land BEFORE the thick-haze ×1.3 boost; solidOptics' must land AFTER the terminator/aurora writes it supersedes, ~150 lines later. **No single point satisfies both.** |
| ctx/gates | Three condition-vector families feed the eight sites — **27 numeric field disagreements over 630 rows.** Four sites also pass `ctx.gates`, which the composer refuses. |
| scraped text | ⭐ This one **executed** the collapse on a mutated copy: **19 failed / 43 passed**. The ratchet's bulk arm resolves `Object.assign(state, X)` *lexically inside* `applyDrivers`; the composer assigns in another file. `MIN_BULK_STATE_FIELDS` 33 → 0. |

## 2. What shipped instead

Share the **selection law**; leave every call and mirror exactly where it is. Six packs adopt
`selectPacks` — measured **0/144 gate mismatches** over 18 presets × 8 seeds. The question *"does
this pack apply to this body"* now has one home instead of three hand-written
`compositionClass(...) === 'gas'` copies.

**Browser-verified with a control:** 8 presets × 7 state fields = **56 values, identical before and
after**, control confirmed to lack the call. Venus reads `limbStrength 0.91 = 0.7 × 1.3` in both
arms — the thick-haze boost landing after the mirror, i.e. the very ordering constraint that killed
the single-call plan, surviving the in-place edit.

## 3. ⚠ The row asked for more than this delivers, and the ledger now says so

The deleted row read *"the lab applies packs through applyDriverPacks instead of calling each pack
individually."* **The lab still calls each pack individually.** What is single-homed is the
applicability law — not collision detection, and not a single composition point, which §1 shows is
architecturally unavailable without restructuring `applyDrivers`.

⭐ **Whether that counts as cleared or as a residue to rule on is Max's call.** The distinction is
written into the ledger where the row used to be, so its absence cannot be read as more than it is.

**Not adopted, recorded in-source at each call site rather than left silent:**

| pack | composer would skip on | why gating it is a VISIBLE change |
|---|---|---|
| `giantDeck` | 96/144 rows | writes `bandStrength: 0, jetStrength: 0` — the OFF values. Skipping leaves the previous body's bands on a rocky planet. |
| `solidFeatures` | 40/144 rows | writes 5–6 non-zero fields incl. `tempEq`, all `.listen()`-bound sliders. |
| `polarDeck` | — | adoption would GUARD a call rather than replace a predicate, and the sweep used the drawn vector while that site builds a frozen one. |

## 4. ⛔ The arm that made the clear honest, written FIRST and in its own commit

`packEntryOf` matches `export function \w+Pack(`. Every export of the composition point ends in
**"Packs"**, so it matched none of them, `packEntryOf` returned `null`, and `labExercises`'
`entry == null → true` branch treated the composer as a non-pack module where reachability is the
whole criterion. **The row would have cleared on the import alone.**

That is the free/transitive clear this ledger reversed once already (`solidOptics`, 2026-08-22).
Sabotage-tested rather than asserted:

```
lab as-is, no composer call    -> false   row stays LIVE
lab + a real selectPacks( call -> true    row clears
lab + the import and NO call   -> false   an import alone no longer clears it
the OLD arm                    -> true    cleared on import alone, whatever the lab did
```

⭐ Writing it first also **removed the plan's own "these two cannot be separated" coupling**, so every
later step could be made and verified on its own.

## 5. The trap that bit, recorded because it is the fifth time in this codebase

Blessing the ratchet, I appended the new entry to the **end of the line** — column 665, past the `//`
at column 309, **inside the very comment that says "APPENDED ON THIS LINE, NOT INSERTED"**. Dead on
arrival. The ratchet caught it. The rule means append to the **statements**, before the first `//`;
"on this line" is about not spending a new line, not about the end of the text.
