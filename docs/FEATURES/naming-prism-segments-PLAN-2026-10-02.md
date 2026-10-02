# Plan: one cell = one place, location-based star names, and a segmented PRISM column

*Lane A, branch `feature/world-engine-production-L1`. Written 2026-10-02. This is a **plan only**: no code was changed and this file was not committed. This is the **third draft**. Draft 2 folded in a critique (section 11). Draft 3 makes your "one cell = one thing one level down" rule the first principle and rebuilds the grid around it (section 0). Section 13 lists what changed and why.*

**How to read the labels:**
- **[V]** = verified. Checked in the code (file:line given) or measured by a script running the real modules headless.
- **[I]** = inference or design proposal. Not built, not tested.

Scratch scripts behind the numbers are in `/tmp/claude-1000/-home-ax/e3bfb779-bd19-48ee-9c65-af3fc876407b/scratchpad/`. Draft 3's grid numbers come from `onecell/`: `a-quadtree.mjs` (today's sector sizes), `b-uniform.mjs` and `d-offset.mjs` (uniform grids), `c-prism.mjs` (stars and timing per slab), `e-examples.mjs` (worked examples), `f-today.mjs` (what today's GALAXY cells contain), `g-cells.mjs` (work per slab). Older numbers: `plan-ex.mjs`, `cov.mjs`, `rev-cells.mjs`, `geo*.mjs`, `prism-*.mjs`, `sec.mjs`.

---

## 0. First principle: every cell is exactly one thing from the level below

### 0.1 Your rule (verbatim, 2026-10-02)

> "at each level of the navigation screen, what should be represented by the cells in the grid is the next level down in terms of resolution. So, each cell in the galaxy should represent a single sector. Otherwise, we won't be able to actually navigate between them coherently. Every cell in the sector view should be displaying a single region. Every cell in the region view should be displaying a single prism. If that's not how it's working today, we need to reconsider the scale at which each of these things is representing what's inside of it. And consider a different approach if that's not feasible."

**Why it matters.** When a cell is exactly one child, clicking it takes you to that child, the name of the cell is the name of the child, and the "where am I" label can point at one cell. When a cell holds pieces of several children (or a child is spread over several cells), the click, the label and the name can each pick a different one, so they stop agreeing.

Everything else in this plan (names, the segment bar, the label, loading) now hangs off a grid that obeys this rule.

### 0.2 Today, level by level [V]

| Screen | The rule says each cell is… | What a cell is today | Obeys? |
|---|---|---|---|
| **GALAXY** | one sector | **Design 1** draws a plain 8×8 grid over a 36 kpc square (4.5 kpc cells: `designs.js:1062-1066`, `:1109-1135`). It does **not** follow the sectors. 52 cells are drawn. Each touches **2 to 163 sectors (median 4); none holds exactly one**. Sol's cell touches 15 (`f-today.mjs`). A click goes to whichever of the 775 sectors is under the pointer; the code itself says the cell and the sector "are DIFFERENT OBJECTS" (`designs.js:760-767`). **Design 2** draws each sector as a single dot, with no grid (`designs.js:2942-2947`). The 8 densest cells get ids such as "A1" (`designs.js:1158-1173`, `:1209-1216`). | **No** |
| **SECTOR** | one region | Drilling from GALAXY sets the view to that sector's own square, cut 8×8 (`NavComputer.js:4636-4646`, `:71-73`). So **on arrival** each cell is one region. But the grid is drawn relative to the view, and dragging moves the view (`NavComputer.js:4362-4369`), so after a drag the cells straddle regions. | Only until you drag |
| **REGION** | one prism | Drilling from SECTOR lines up (`NavComputer.js:4655-4672`). The **default** REGION view is 16 × a density-based tile centred on the player (`NavComputer.js:1216-1221`), so its cells are nobody's prisms. Dragging breaks it too. | Only if you drilled and did not drag |
| **PRISM** | one prism column | Loads a box of width 2 × max(3 pc, a ~150-star tile) around the clicked tile's centre (`NavComputer.js:4677-4678`), not the tile itself (section 2.4). | **No** |

**Corrections to the brief I was given [V]:** the GALAXY grid on screen is *not* the 4 kpc base grid inside `GalacticSectors` (that one starts at −15 kpc, `GalacticSectors.js:97-108`). It is a 4.5 kpc grid re-fitted to the reachable disc. And Sol's 4 kpc base square holds 10 sectors, not 16; the busiest base square holds 223, not 256 (`a-quadtree.mjs`).

### 0.3 Why GALAXY is the hard case [V]

Today's 775 sectors are an **adaptive quadtree**: dense ground is cut into smaller squares so each sector holds roughly the same number of stars (`GalacticSectors.js:4-17`, `:126-159`). The sizes are very uneven (`a-quadtree.mjs`):

| Sector size | How many | Width on design 1's GALAXY (216 texels across 36 kpc = 6 texels per kpc) |
|---|---|---|
| 0.25 kpc | **480** (62%) | **1.5 texels** |
| 0.5 kpc | 96 | 3 texels |
| 1 kpc | 106 | 6 texels |
| 2 kpc | 52 | 12 texels |
| 4 kpc | 41 | 24 texels |

Every 0.25 kpc sector sits within R < 4 kpc. A two-character label in the 5×5 pixel font is 11 texels wide, and the existing draw code requires a cell of at least 14 texels to hold one (`designs.js:1163`). Today's chunky 27-texel cells, which you said were good, exist because the grid ignores the sectors.

### 0.4 The options for GALAXY

Each option is described as: what you would see, whether it obeys the rule on every screen, what it does to naming, what it does to the PRISM column, and its risks.

Numbers below assume design 1's 216-texel map square (`designs.js:822-828`: 69 × 40 character cells at 417×240, map 42 cells wide; the square is the 216-texel map height) [V].

#### Option A: draw the quadtree itself on GALAXY (mixed-size cells)

- **What you see:** big squares on the rim, a blizzard of tiny squares in the middle. 480 of the 775 sectors are 1.5 texels wide: too small to see as squares, to click, or to label. To label a 0.25 kpc sector you would need to zoom GALAXY **9.3×**; even a 1 kpc one needs 2.3×. So GALAXY becomes a zoomable map with its own zoom control.
- **Rule:** obeyed on paper at GALAXY (each drawn square is one sector), but not usable without zoom. SECTOR and REGION obey it if the drill snaps (section 5). Neighbouring sectors of different sizes still meet at SECTOR level (0.25 next to 4 kpc), so neighbour drawing stays complicated.
- **Naming:** 775 sectors plus rim fill plus an outer ring (draft 2's plan) to hand-review. Sector edges are computed from the density model, so retuning density would move them and rename stars.
- **PRISM:** keeps equal-ish star counts per prism (1.95 pc wide in the core, 31.25 pc on the rim; ~290 to ~1,700 stars per 100 pc slab). But the work per slab is uneven: a 31.25 pc rim prism evaluates **128,808 cells** per slab, a core one 1,953 (`g-cells.mjs`). The worst slab measured 199 ms warm headless.
- **Risks:** GALAXY zoom is new UI on both designs; hand-review of ~800 words; uneven loading cost.

#### Option B: replace the quadtree with a uniform sector grid

Every sector is the same size, and the 8×8 regions and 16×16 prisms beneath keep today's drill counts.

| | **B1: 1 kpc sectors** | **B2: 2 kpc sectors** |
|---|---|---|
| GALAXY grid | 36×36 at **6 texels** a cell | 18×18 at **12 texels** a cell |
| Sectors that touch R ≤ 18 kpc (where stars exist) | 1,076 | 284 |
| Region (8×8) | 125 pc | 250 pc |
| Prism (16×16) | **7.81 pc** everywhere | **15.63 pc** everywhere |
| Stars per 100 pc mid-plane slab: bulge R 0.3 / inner R 1.5 / R 4 / Sol / outer R 12 / rim R 16 | 6,662 / 5,449 / 1,430 / 312 / 106 / 15 | 26,911 / 22,335 / 5,865 / 1,258 / 420 / 52 |
| Warm headless time per slab | 5–27 ms | 17–72 ms |
| Cells evaluated per slab (same everywhere) | 12,485 | 37,349 |

(`b-uniform.mjs`, `c-prism.mjs`, `g-cells.mjs`)

- **What you see:** B1's 6-texel GALAXY cells can be clicked but carry no labels and lose all of today's chunkiness. B2's 12-texel cells can be clicked and read through edge labels (letters along the top, numbers down the side), but not labelled inside.
- **Rule:** obeyed on every screen, because a uniform grid is the same grid however you pan. A cell is always exactly one child.
- **Naming:** B1 has ~1,100 sector words (too many to hand-review comfortably); B2 has ~280 (reviewable). Sector edges become plain arithmetic, so density retuning can never move them.
- **PRISM:** the trade-off flips. Prism width is the same everywhere, so **the work per slab is the same everywhere** (12,485 cells for B1). Star counts per slab now vary a lot: B1's core slab holds ~6,700 stars against 15 on the rim. B2's core slab holds ~27,000.
- **Equal stars per sector is lost.** That was the quadtree's purpose (`GalacticSectors.js:4-12`). Nothing uses it today: the only readers of the sector table are the nav and the autopilot's drill animation [V: grep of `getSectorAt` / `getSectors` / `sectorRows` in `src/`].

#### Option C: add a level so every screen is uniform and chunky

GALAXY → **ZONE** → SECTOR → REGION → PRISM. For example: GALAXY 10×10 of 4 kpc zones (21.6 texels, room for an id inside each cell; 83 zones touch R ≤ 18) → ZONE 4×4 of 1 kpc sectors (54 texels: room for a whole sector word) → SECTOR 8×8 of 125 pc regions (27 texels) → REGION 16×16 of 7.81 pc prisms.

- **What you see:** every screen keeps big, labelled cells. It costs one extra click on every trip down, and one more screen to learn.
- **Rule:** obeyed. But a GALAXY cell is a *zone*, not a sector, which bends your wording ("each cell in the galaxy should represent a single sector").
- **Naming:** ~1,100 sectors (or 83 zone words plus a generated part, which adds a token to every name).
- **PRISM:** same as B1 (7.81 pc everywhere).
- **Risks:** the level index is hard-wired across the nav: 50 references to `_levelIndex` in `NavComputer.js` (a file held at 4,711 lines), 44 to `S.level` in `designs.js`, plus `navViewModes/index.js`. That makes this the biggest and riskiest change of the four.

#### Option D (recommended): uniform 2 kpc sectors, 16×16 regions, 16×16 prisms

This is B2 with one change: the SECTOR screen is cut **16×16** instead of 8×8. That brings the prism down to the same 7.81 pc as B1, while GALAXY keeps B2's readable 2 kpc cells. It also makes the arithmetic work out: 36 kpc ÷ 7.81 pc ≈ 4,600, and three screens with 16 or fewer cells a side can only reach that if the bottom two are both 16×16 [I, arithmetic].

```
GALAXY   19 × 19 grid of 2 kpc sectors    (11 texels a cell; 293 drawn, corners outside R = 18 kpc not drawn)
SECTOR   one sector, 16 × 16 regions      (125 pc each; 13 texels a cell)
REGION   one region, 16 × 16 prisms       (7.81 pc each; 13 texels a cell)
PRISM    one prism column, cut into 100 pc slabs
```

- **The grid is shifted so Sol and the galactic centre each sit in the middle of a prism** (sector edges at x, z = 1 kpc + 3.9 pc + any multiple of 2 kpc). Sol is then ~1 kpc from every sector edge, and so is the galactic centre (`d-offset.mjs`). This replaces draft 2's decision 8 ("centre Sol in its prism"). One thing it cannot do: with 16-way cuts, the middle of a sector is a corner between regions, so Sol's prism touches the corner of four regions. That only changes the column word (a regional syllable), not the sector word.
- **What you see:** GALAXY cells are about half the size of today's chunky ones (11 against 27 texels) and are read by **edge labels**: A–S along the top, 1–19 down the side. Sol's sector reads like "M9". SECTOR and REGION are both 16×16 grids with A–P / 1–16 edge labels. Every cell can be named by its row and column, which answers your "every cell readable for orientation". Hovering a cell shows its sector word or column word. In design 2's wide GALAXY band (≈9.5 texels per kpc) a sector is ≈19 texels.
- **Rule:** obeyed on every screen, at any pan.
- **Naming:** **293 sector words**, all hand-reviewable. Below them, one shared set of **256 three-letter syllables**: a column word is region syllable + prism syllable (6 letters, 65,536 combinations). Sectors outside R = 18 kpc (distant globular clusters) still have a grid square; they take generated words from a separate "far" set, so no rim fill or outer ring table is needed.
- **PRISM:** 7.81 pc wide everywhere, the same width Sol's prism had in draft 2. Each 100 pc slab costs the same work everywhere: 12,485 cells, 5–27 ms warm headless. That is **7× less than the worst slab in draft 2** (the 31.25 pc rim prism, 199 ms). Stars per mid-plane slab: ~5,600–6,700 in the inner galaxy, ~300 at Sol, ~100 at R 12, ~15 on the rim.
- **Risks:**
  - GALAXY loses its chunky cells (27 → 11 texels).
  - The whole bulge (R < 1 kpc) is **one** sector.
  - Inner-galaxy prisms are dense (~6,000 stars per slab), so the PRISM list there is long.
  - Rim prisms are nearly empty (high slabs on the rim will often have zero stars).
  - Moving 16× more cells into each core slab could make the unexplained in-browser stall worse at the core (section 2.8). **Phase 0 measures a 7.81 pc core slab in the browser before the grid is frozen.**

### 0.5 Recommendation

**Option D.** The criteria, in order:

1. **It obeys your rule on every screen, at any pan or drag.** A, B, C and D all can; C bends the wording at GALAXY.
2. **Every cell can be clicked and read at 417×240:** at least ~11 texels and an edge label. This rules out A (1.5 texels) and B1 (6 texels).
3. **PRISM performance is a hard requirement:** the worst-case work per slab should be bounded and small. D and B1 are best (12,485 cells, ≤27 ms headless). B2 is 3× that and its core slabs hold ~27,000 stars. A's rim slab is 10× that.
4. **Hand-reviewable sector names:** D has 293. A has ~800, B1 and C ~1,100.
5. **Smallest structural change:** D keeps four screens and today's drill counts apart from SECTOR going 8×8 → 16×16. C adds a level across 100+ hard-wired references.

**What D gives up:** today's chunky GALAXY cells, and equal stars per sector. If chunky GALAXY cells matter more to you than one fewer click, C is the alternative. That is decision 0.

---

## 1. The goal, in your words

You asked for:

1. **Names that mean something.** "I like the Elite approach of having readable syllables at the beginning, and naming stars … based on their galactic location." Real catalogue stars and the in-universe named systems keep their own names.
2. **A column you can move through.** Prisms "are very tall … right now you can just press R and F or drag the vertical slider but it takes minutes to go from one section to another." You want visible segments in the nav bar that you can click or drag to, with R/F kept for slow panning.
3. **A "where am I" label** that shows the full address (sector, region, prism, slab), coloured to match the map highlight.
4. **(New, governing) One cell = one thing one level down** on every nav screen (section 0), with **every cell readable** for orientation.
5. **PRISM performance as a hard requirement:** no multi-second stall entering or moving through a column.

You also asked that this not be "a new process slapped on". The July naming system took real work. **This plan keeps its whole precedence chain, every guarantee and the 48,000-name catalogue. It replaces only the last step: how a procedural star's identity is spelled out as text.**

**Why the asks become one project [I].** A name can only carry a location if the galaxy has a fixed, permanent grid of places. Your rule says the nav screens must *be* that grid. So the same grid is what each screen draws, what the segment bar shows, what the label reads from, what a name spells out, and what decides how many stars to load at once. The plan builds it once and uses it everywhere.

---

## 2. What we have today, and the surprises

### 2.1 Where a system's name comes from [V]
The first source that has a name wins:
1. **KnownSystems** (Sol, Alpha Centauri): `main.js:7597-7598`, `arrivalResolution.js:61-63`
2. **Real-star names**: `main.js:6137`, `main.js:14321-14324`, `main.js:14388-14391`
3. **The named-systems catalogue** (48,000 shipped names): `NameGenerator.js:461-462`
4. **Procedural name**: `NameGenerator.js:396-410`

This order is written down in `docs/NAMING_AND_REAL_OBJECTS.md:271-277`.

### 2.2 Why today's procedural names look meaningless [V]
- A procedural name spells out a ~70-bit number that encodes the star's position (`NameGenerator.js:238-288`). That needs 14 or more characters (`:44-50`).
- In the fantasy style, the readable word comes from the **low** bits of that number (`:407`). Two neighbouring stars therefore get unrelated words: "Jessep-4ORN2UU4JC" and "Juddil-4OS5AX07KA". The location sits in the code at the end. Elite does the reverse: the readable part is the location.

### 2.3 Today's sector table cannot be used as it is [V]
*(Draft 3: option D replaces this table with a uniform grid, which removes all four problems below. They are kept here as the reason.)*
- There are 775 sectors but only 453 distinct sector names. 319 names repeat, in mirror-image pairs: (x, z) and (−x, −z) share a name. Sol's sector name "Tau Vela-94" is also used at (−8.5, −0.5). The file itself calls the naming a placeholder (`GalacticSectors.js:209`).
- The table does not cover everything:
  - It spans only x and z from −15 to +17 kpc (`GalacticSectors.js:100-103`), but stars are created out to R = 18 kpc (`HashGridStarfield.js:304`). In a sample, 38,540 of 407,065 points inside R = 18 belonged to no sector; `getSectorAt` silently picks the nearest sector instead (`GalacticSectors.js:58-72`, measured with `cov.mjs`).
  - Beyond R = 18 kpc, `getSectorAt` returns `null` (`GalacticSectors.js:47`). 20 of the 152 globular clusters are out there, and 57 are more than 3 kpc from the plane (measured by the critique).
- Sector boundaries are computed from the density model (`GalacticSectors.js:114-136`). Retuning density would move them.
- Its sizes range from 0.25 to 4 kpc (section 0.3), which is what makes GALAXY break your rule.

### 2.4 A "prism" is not a fixed thing yet [V]
The prism you see depends on how you got there:

| How you reach PRISM | Width at Sol | Code |
|---|---|---|
| Drilled down from SECTOR → REGION → PRISM | 7.8 pc tile | `NavComputer.js:4651-4677` |
| The default region, centred on the player | 41.9 pc tile (670 pc region) | `NavComputer.js:1216-1221` |
| The width actually loaded (a ~150-star cube, used as a half-width) | 20.7 pc | `NavComputer.js:1188`, `:4678`, `:3750` |

On top of that, SECTOR and REGION views pan freely (`NavComputer.js:4362-4369`), and drill tiles are measured from wherever the view is centred (`:4651-4657`). After a pan, a tile straddles fixed cells.

### 2.5 Prisms are far too many to name by hand [V, updated for option D]
Under option D there are 293 sectors × 256 regions × 256 prisms = **19.2 million** prism columns (draft 2's quadtree gave 12.7 million). That is in the same range as Elite's procedurally named sectors. Each can have a generated name, but none can be named by hand. Only the **293 sector words** are few enough to review one by one, plus the 256 syllables used to build column words.

### 2.6 Why moving up and down is slow [V]
- R/F moves at `_localRadius × 0.01` per 60 Hz frame (`NavComputer.js:1373`). That is about 0.9 pc/s at entry zoom and at most about 6 pc/s at Sol (zoom is capped at the cube size, `:4705`).
- The column is ±3 kpc = 6,000 pc tall (`NavComputer.js:3856`). Crossing it takes about 16 minutes fully zoomed out at Sol, and nearly 2 hours at entry zoom.
- The draggable Y gauge reaches only ±2 pc around the player (`designs.js:2211`, clamp at `navViewModes/index.js:1136-1141`): 4 pc of a 6,000 pc column.
- Small mismatch: the "Y RANGE" readout says ±2.0 kpc (`designs.js:2185`), but the loader fills ±3.0 kpc (`NavComputer.js:3856`).

### 2.7 Every procedural star already has a fixed "slot" [V]
- There are 10 spectral tiers: O, B, A, F, G, K, M and three giants Kg, Gg, Mg (`HashGridStarfield.js:73-90`). Each tier has its own cubic grid, from 1.1 pc cells (M) to 74 pc cells (O).
- Each (tier, cell) is hashed once and passes or fails one test, so each slot makes **at most one star** (`HashGridStarfield.js:651-735`).
- This is the same structure as Elite's "mass letter + boxel". Your July ruling already asked for it: prefer "encoding the star's generative grid-cell identity" (`ac5-decision.md`, Addendum, ruling 1).
- The star's `seed` is only 32 bits (`HashGridStarfield.js:729`). With ~2×10¹¹ stars it cannot be unique, so nothing in this plan keys on the seed [I, arithmetic].

### 2.8 The PRISM stall [V]
- The walk (`UAT-walk-2026-09-30.md`) profiled ~3 s of main-thread time per 0.1 kpc loading step near the core, with 98% in the density calculation (`GalacticMap._spiralPotentialOnly`, called from `HashGridStarfield.findStarsInPrism`).
- Headless, the worst step measured is ~210 ms at Sol, and the core is cheap (~10 ms per slab).
- **That 15× gap is unexplained.** Candidates: the cockpit's second NavComputer loading at the same time (`main.js:4700`, `:5895`), the real-feature catalogue (not loaded headless), or profiler overhead.
- **Draft 3 note [I]:** the density calculation runs once per *cell evaluated*, and under option D a core slab evaluates 12,485 cells against ~2,000 for draft 2's 1.95 pc core prism. If the browser cost really is per cell, option D makes core slabs ~6× more expensive than draft 2 did (and the rim ~10× cheaper). Phase 0 measures exactly this before anything is frozen.

---

## 3. The proposed address and name

### 3.1 The fixed hierarchy [I]
None of it depends on where you are or how you got there. Every level is plain arithmetic on position (option D):

```
SECTOR      2 kpc square on one galaxy-wide grid (edges at 1 kpc + 3.9 pc + k × 2 kpc)  → a sector word
  REGION    the sector's 16×16 grid, 125 pc                                              ┐ together: a
    PRISM   the region's 16×16 grid, 7.81 pc (a full-height column)                      ┘ column word
      SLAB  a 100 pc height band: N1, N2 … above the plane, S1, S2 … below
        STAR  tier token + slot number inside that box
```

Each screen draws exactly one row of this ladder: GALAXY draws sectors, SECTOR draws one sector's regions, REGION draws one region's prisms, and the PRISM segment bar draws one column's slabs.

**Name shape (recommended, option A in decision 2):**

```
<Sector word> <Column word> <Slab> <Tier>-<Slot>
Thessa Korabi N1 M-955
```

What each part tells you:
- **Same first word = same sector = same GALAXY cell.** The label, the map highlight and the name all agree.
- **Column word = region syllable + prism syllable.** Columns in the same region share their first syllable ("Korabi", "Korvex", "Kordal"), so neighbours sound related. This is the opposite of today.
- **Slab = height.** "N16" means 1.5 to 1.6 kpc above the plane. The boundary uses `floor`, never rounding, so each star belongs to exactly one slab, the same way real astronomy truncates coordinates in J2000 names.
- **Tier = star type, Slot = which star.** The slot number is counted height-first, so a higher number is higher up inside the slab.

**The same address as map grid references** (edge labels, section 5): sector "M9" on GALAXY, region "I9" on SECTOR, prism "A3" on REGION. The name uses words; the screens use letters and numbers along their edges. Both describe the same cells.

### 3.2 Corrections built into the shape [I]
- **Every tier gets its own token.** O, B, A, F, G, K, M are the dwarfs. The giants get two-letter tokens, **KG, GG, MG**. Without this, a K dwarf and a K giant in the same box could both be called "K-5", because each tier counts its slots from zero. A test pairs every tier with every other tier inside one box.
- **Hyphen and zero-padding on the slot number** (at least 3 digits): "M-042", "K-002", "O-001". Without them, a tail could read like a real designation: "M42" and "M31" are Messier objects, "K2" is a NASA mission. The hyphen also stops "O" being misread as zero. With 7.81 pc prisms, the largest slot is 7,451 (M dwarfs, a 9×92×9 box), so slots are 3 or 4 digits.
- **Fixed-length syllables.** *(Changed in draft 3.)* A column word is always a 3-letter region syllable plus a 3-letter prism syllable (6 letters; e.g. "Kor" + "abi"), both drawn from **one shared set of 256 syllables**. With fixed lengths, a column word can only be split one way, so two different (region, prism) pairs can never spell the same word. This uses the same rule July used: exactly-3-character syllables (`NameGenerator.js:333-343`). A test checks that all 65,536 column words are distinct. The screen also rejects doubled words such as "Korkor".
- **Sector words are one token** (no spaces), unique across the whole table, with a test.

### 3.3 Worked examples [V numbers, I words]
The numbers come from `onecell/e-examples.mjs`, which ran the real `HashGridStarfield` with seed `well-dipper-galaxy-1` on the option D grid. The words are **placeholders**: the real vocabulary does not exist yet.

| Where | Address (numbers) | Example name |
|---|---|---|
| Red dwarf near Sol (8.005, 0.050, 0.027 kpc) | Sector M9. Region I9, prism A3, 7.81 pc wide. Slab N1. M slot (1, 11, 7) in a 9×92×9 box → 955 | **Thessa Korabi N1 M-955** |
| Orange dwarf, same column | K slot (2, 42, 4) in 6×57×6 → 1538 | **Thessa Korabi N1 K-1538** |
| Sun-like star 1.55 kpc above Sol (halo) | Sector M9, region H8, prism P16 (Sol's own column), slab **N16**, G slot (3, 16, 2) in 5×49×5 → 413 | **Thessa Lunvex N16 G-413** |
| Inner galaxy, R ≈ 1.5 kpc | Sector J9. Region B16, prism J3, 7.81 pc. N1. M slot (0, 8, 5) → 693 | **Kethra Virosa N1 M-693** |
| Outer disk, R ≈ 12 kpc | Sector D13. Region P8, prism P3, 7.81 pc. N1. M slot (4, 77, 6) → 6295 | **Oriel Lumaye N1 M-6295** |
| Real or catalogue star | Name unchanged. The label shows its address. | "Sirius · Thessa Korabi N1" |

Stars in one 100 pc slab of these columns [V, headless]: Sol N1 304 · inner N1 5,652 · outer N1 99 · Sol N16 (halo) 69 · rim (R ≈ 16) N1 15.

**Longest possible name [I]:** sector word ≤ 7 letters + column word 6 + slab ≤ 3 ("S30") + tail ≤ 6 ("M-7451", "KG-011"), plus 3 spaces = **25 characters** (draft 2: 26). Section 6.4 says how that fits the nav.

### 3.4 Special cases [I]
- **Stars on a cell edge.** A star whose offset byte is 0 or 255 sits exactly on its cell's edge (`HashGridStarfield.js:717-722`). Working its cell out from its position could give the neighbouring cell, and two stars could then share a slot. Fix: call sites carry the **tier and cell the generator used** (the generator already knows them). Where only a position is available, the namer regenerates the one or two candidate cells and matches positions. That uses only the hash, never the density model.
- **Systems with no grid slot.** These are feature-centre systems, title-screen and `?system=` spawns (named at the player's position, `main.js:7603`, `:5570`), and anything else not made by the hash grid. They get an **X tail**: "X-" plus a short code for the position inside the slab box, quantised at the same 4e-6 kpc step July uses. It is unique and rare. X is not a tier token, so it can never collide with a slot name.
- **Procedural teleports** currently take their contents from the nearest grid star but their name from the player's position (`main.js:8312-8313`). That breaks the "one system, one name" rule (`NAMING_AND_REAL_OBJECTS.md` §6). Fix: name them after `nearest[0]`, using its tier and cell.
- **Far from the disc.** *(Simplified in draft 3.)* The uniform grid continues forever, so every position anywhere belongs to exactly one sector without any rim fill or outer ring. The 293 sectors that touch R ≤ 18 kpc get hand-reviewed words. Every square beyond that gets a word generated from a separate "far" word set, keyed by its grid position. Distant globular clusters therefore get normal-shaped names. Slabs simply keep counting past ±3 kpc (N31, N32 …).

---

## 4. How the plan keeps the July rules

The precedence chain does not change: KnownSystems, then real names, then the 48,000-name catalogue, then procedural. **Only step 4 changes.**

| July rule (source) | How this plan keeps it |
|---|---|
| **Unique by construction, no registry** (ac5 item 1) | [I] Two different stars either differ in sector, column or slab, in which case a head token differs, or share a box. In the same box they have different (tier, cell) slots, because one slot makes at most one star [V `HashGridStarfield.js:651-735`]. Tier tokens are distinct (§3.2), and slot numbers are a fixed mixed-radix count, so the tails differ. Every token can be split only one way (fixed-length syllables, one-word sector words, a fixed token order). All vocabulary comes from fixed tables indexed by position in the grid, so there is no registry. |
| **Same star, same name forever, on every path** (item 1, D5) | The name is a pure function of the star's tier and cell (or position, for X tails). It only stays stable if the grid never changes, so the sector size and offset, the 16×16 and 16×16 cuts, the 100 pc slab height, the tier tokens and the vocabulary all become **frozen shipped constants**, with a golden-names test pinning ~50 stars. Under option D the grid no longer depends on the density model, so retuning the galaxy cannot rename anything. **The one honest exception:** switching over renames every procedural star **once** (decision 1). Nothing durable stores names, so no save or link breaks [V `Settings.js:112`, `ShipCameraSystem.js:514-522`, `flightModes.js:664-681`, `main.js:5558-5571`]. |
| **No fallback when a position is missing** (D5) | Kept. The namer still throws (`NameGenerator.js:444-451`). |
| **Real names win on every path** (D4) | Untouched; those steps run first. |
| **The 48,000 catalogue names keep working** | The position number L (Q = 4e-6 kpc, same ranges, `NameGenerator.js:261-264`) **stays** as the catalogue's lookup key. It is no longer spelled out in procedural names, but all 48,000 keys still match. |
| **Never output a real name or survey label, and never let a name change a system's contents** (item 2, §1.2) | [V] The contents lookups match on the **exact** name (`RealSystemOverlay.js:156`, `:282-283`; `KnownSystems.js:135-152`). The new shape always has 4 tokens and its third token is N/S plus digits. Settled catalogue names are 1 token (`^[A-Z][a-z]+$`) and Greek names are 3 tokens ending in digits (`^Word Word \d{1,4}$`), so the shapes cannot overlap (`injective.test.js:27-28`). [I] A build-time check runs the new name pattern against **every** contents-lookup key set: HYG names, the companion table, exoplanet-archive host names, supplement bridge names and KnownSystems aliases. It must match zero keys. The vocabulary is also screened against real proper names and constellation names. |
| **"Not every name has to become multi-part"** (Max, ac5 :5-6) | Every *procedural* name becomes multi-part. The ~12,000 settled one-word names, ~36,000 Greek names and all real names stay short, which is how Elite works too. Covered by decision 1. |
| **Survey designations "like real astronomy designations"** (Addendum ruling 1) and **core more catalogue-like** (D1) | **This plan changes that, so it is decision 3.** Option A drops the survey class (`_surveyName`, `NameGenerator.js:396-401`) and gives the core its own flavour through sector-word sound alone. Option B keeps a survey-style shape for core sectors. |
| **Region flavour** (D1, in spirit) | Through sector words: crisp syllables in the core, soft ones on the rim (decision 3 chooses whether that is the only carrier). |
| **Naming never changes contents** (§1.2) | The namer only reads tier, cell and position. Generation is untouched. |
| **Use the grid-cell identity** (Addendum ruling 1) | This plan does exactly that. |

---

## 5. Making every screen obey the rule, and "prism" one fixed thing (decision 6) [I]

You can only name a prism if the PRISM screen always shows the same fixed column for the same stars, and your rule needs every screen above it to be the fixed grid too. Proposal (option D):

- **Every grid is locked to the world, not to the view.** GALAXY, SECTOR and REGION draw the fixed grid lines wherever the view is. SECTOR and REGION keep **free panning** (you walked and approved the drag): a pan slides the fixed cells across the glass, it never re-cuts them. The current parent's cells are drawn normally; cells belonging to the neighbouring parent are dimmed and outlined in that parent's colour. Because every sector is the same size, neighbours are the same grid continuing, so draft 2's mixed-size "neighbour blocks" are no longer needed.
- **Drill goes to the fixed cell under the pointer** (at GALAXY, the sector under the pointer is now the cell under the pointer; today they differ, section 0.2).
- **Edge labels on every grid.** GALAXY: letters A–S along the top, numbers 1–19 down the side. SECTOR and REGION: A–P and 1–16. Squaring the grid to 209 texels (19 × 11) or 208 (16 × 13) frees one text row above it, and design 1's map is 36 texels wider than the square, which leaves room for the numbers. These replace design 1's ids on the 8 densest tiles (`designs.js:1158-1173`). Hovering a cell shows its word.
- **The default REGION view snaps** to the fixed region that contains the player (125 pc everywhere, instead of a 670 pc player-centred window at Sol).
- **PRISM shows exactly one fixed column**, 7.81 pc wide everywhere, instead of today's 20.7 pc window at Sol. **WASD clamps at the column edge.** To step sideways, go up to REGION and click the next column. That way the column word on screen never changes underneath you.
- **Zoom is no longer tied to column width.** Today the wheel caps the zoom radius at the cube size (`NavComputer.js:4704-4705`), and R/F speed is proportional to zoom (`:1373`). New limits: zoom radius from 0.0015 kpc up to `max(0.01 kpc, 2 × column width)` = 0.0156 kpc. Today's `max(0.003, …)` floor (`:1188`, `:4678`) is replaced by this rule. The camera can always pull back past the column. (With a uniform 7.81 pc column, draft 2's worry about a 1.95 pc core column that could not be zoomed out no longer arises.)
- **What you will notice:**
  - GALAXY cells are smaller (11 texels against 27 today) and the whole bulge is one cell.
  - SECTOR has 256 smaller cells (13 texels) instead of 64.
  - Sol's PRISM column looks sparser: about 300 stars per 100 pc slab against roughly 2,000 in today's wider window (estimated).
  - Inner-galaxy columns are dense (~5,600–6,700 per slab), and rim columns are nearly empty.
  - On paper the column is very tall relative to its width (~770:1). But you will view and load **one slab at a time** (100 pc tall, about 13:1), so the "very tall" problem moves into the segment bar, where you can jump.

---

## 6. Segments and the nav controls

### 6.1 Two different things: naming slabs and bar bands (decisions 4 and 5) [I]
- **Naming slab (decision 4, permanent).** Its height is baked into every procedural name forever. Recommended: **100 pc**. That matches the loader's existing step (`NavComputer.js:3853-3884`), keeps every query well under the guard that silently drops M dwarfs from queries taller than ~0.44 kpc (`HashGridStarfield.js:661-662`), and makes the token read as a height. A taller slab means fewer slabs but bigger slot numbers. A whole-column box (no slab token) would need 6-digit slot numbers with no height meaning.
- **Bar bands (decision 5, changeable later without renaming anything).** How the bar groups slabs for display. Recommended: one cell per 100 pc slab, 60 cells across ±3 kpc, coloured by layer. The alternative is a handful of labelled floors, like a building's floor selector (thin disk, thick disk, halo, north and south), each expanding to its slabs on hover or click.
- **The bar obeys the rule too:** each bar cell is exactly one slab, the level below a column.

### 6.2 One layer function [V thresholds, I sharing]
`prismNumbers` already prints the layer: THIN under 0.3 kpc, THICK under 1.0, otherwise HALO (`designs.js:2183`). The plan **uses those same thresholds** (not the 0.9 kpc an earlier draft had), in one shared function that both the bar colours and `prismNumbers` call. With 100 pc slabs: N1–N3 thin, N4–N10 thick, N11 and up halo. This avoids the Elite bug where two screens worked out the region differently and disagreed near borders (research, Frontier issue 13286).

### 6.3 The segment bar [I, built on V layout]
- **Design 1:** a new segment column beside the ±2 pc fine gauge you already approved. The map gives up one 6-texel column (map width 252 → 246, `designs.js:822-828`). 60 cells on 216 texels is ~3.6 texels each, enough for a coloured cell but not text. The current slab and layer show in the rail block (`designs.js:1946-1948`) as "N16 · HALO".
- **Design 2:** the new column sits just left of the gauge (gauge at x = W−20, `designs.js:3117`). The bottom bar has no spare room: its last characters are reserved for the height number (`designs.js:2876-2878`). So the slab token **replaces** the existing height and layer clauses (`:2888-2891`) instead of being added.
- **Behaviour:** the current slab is lit, loaded slabs are mid-tone, unloaded slabs are dim, and slabs with no stars (common on the rim and high in the halo under option D) get their own empty mark. **Click** jumps to the middle of a slab. **Drag** moves the highlight and loads on release, so dragging never stalls. **R/F is unchanged** as the slow pan, and the 100 ms per-frame cap stays (`NavComputer.js:44`, `:1371`) so a slow frame cannot teleport the camera.
- **Plumbing:** it reuses the existing grab pattern. Paint publishes a rect, the press is armed at mouse-down, mouse-up releases (`designs.js:2219`, `NavComputer.js:4349`, `:4402`, `:4415`, `navViewModes/index.js:205`, `:1381`).
- **Y range:** the bar spans **±3 kpc**, matching the loader. The "Y RANGE" readout is fixed to the same shared constant (today it says ±2.0).
- **Code constraint:** `NavComputer.js` is held at 4,711 lines (`:156` comment). Segment logic and the grid module go in **new modules**; NavComputer gets call-site changes only.
- **Legacy look:** not in this contract (section 9, follow-ups).

### 6.4 Names in the nav lists [V widths, I fix]
Today nav text is cut **from the right** (`navPixelType.js:146-151`, `designs.js:399`), and that cuts off exactly the part that identifies the star:
- Design 1's PRISM list pads names to **12 characters** (`designs.js:1928`, rail `cols` = 25 at `:825`, `:868`). Every row would read "THESSA KORAB".
- Design 2's name column is 119 texels, ~19 characters (`designs.js:3176`). "THESSA KORABI N1 M-6295" would become "THESSA KORABI N1 M-", and longer sector words cut into the slot number, giving a valid-looking name for a **different** star. That is exactly what `cockpit/designation.js:9-20` forbids.

Fix:
- **Inside PRISM, list rows show only the tail** ("N16 M-7451", at most 10 characters), and the column's head ("THESSA KORABI") is drawn once as a header. Every star in the list shares that head, so nothing is lost.
- **Anywhere else a star name is shortened, whole words are dropped from the front**, the same rule as `fitDesignation`. Characters are never cut from the end of a name.
- The **location label** (§6.5) is a separate thing, not a name. It drops whole fields from the right (star first, then slab), because its job is location.
- **A layout test** renders the longest possible name (§3.3, 25 characters) in every nav field in both designs and fails if any field shows a cut-off token.
- **Long lists [I, new in draft 3]:** an inner-galaxy slab can list ~6,000 stars. The rail already pages; the list is appended per slab (§7), never rebuilt.

### 6.5 The "where am I" label [I]
- Shows **where you are**, not what you are browsing (browsing shows in the rail):
  - Procedural star: `M-955 · [sector colour]THESSA [column colour]KORABI [slab colour]N1`
  - Named star: `SOL · [sector colour]THESSA [column colour]KORABI [slab colour]N1`
- **Each part is coloured with the ink that highlights the same thing on the map**: the sector part matches the highlighted GALAXY cell, the column part matches the highlighted REGION cell, and the slab part matches the lit segment-bar cell. So the label reads as the full address and each piece can be found on screen.
- **Design 1:** the 14-cell `hereName` slot takes the star's own name or tail. The 17-cell sector slot takes "THESSA KORABI N1" (16 characters, fits) (`designs.js:844-847`).
- **Design 2:** the top-bar locator (`designs.js:2787-2790`).
- **One resolver** returns the address **and** the colours, and both the label and the map highlights call it. Each sector gets a fixed colour from a small palette. On a uniform grid a repeating 2 × 2 colour pattern guarantees that side-by-side and diagonal neighbours always differ [I, arithmetic].

---

## 7. Loading one slab at a time, and the stall [I unless marked]

**PRISM performance is a hard requirement.** Proposed acceptance test: an in-browser trace shows **no main-thread task over 50 ms** (the browser's own "long task" line) while entering PRISM or jumping between slabs, at an inner-galaxy column (R ≈ 1.5 kpc) and at Sol, with the cockpit open.

- **Today [V]:** entering PRISM loads the whole ±3 kpc column, about 30 rounds of two 0.1 kpc slabs (`NavComputer.js:3854-3884`). Each round evaluates density for every cell of all 10 tiers (`HashGridStarfield.js:651-694`). Under a design, every round also rebuilds and re-sorts every row (`state.js:986-1011`).
- **New:** load **the slab you are in** first. Then load the slabs above and below while idle. Unload far slabs.
- **Costs under option D [V, headless, warm]:** every slab of every column evaluates the same 12,485 cells. Measured 5–27 ms per slab (bulge 5, inner R 1.5 20, R 4 27, Sol 17, outer 14, rim 11; `onecell/c-prism.mjs`). Draft 2's worst slab (31.25 pc, outer disk) was 199 ms.
- **Splitting the work.** Splitting by tier alone does not bound a frame: M dwarfs are 60% of the cells evaluated (7,452 of 12,485). Instead the loader works through a **cell budget per frame**, splitting M and K by y-row, aiming at ≤ 8 ms of loading per frame. At 27 ms a slab that is about 4 frames.
- **Rows are appended per slab**, with no full rebuild and re-sort per step. Stars in one slab share their head, so the address lookup runs once per slab.
- **Three correctness fixes that come with slab loading:**
  1. **"Here" detection** matches your name against the loaded stars and falls back to the nearest one (`NavComputer.js:2052-2058`). If your own slab were not loaded, the wrong star would be marked. Fix: **always load and pin the player's own slab.**
  2. **Real stars** replace their hash-grid twin only among stars already loaded (`:3790-3800`), and they are de-duplicated once. If the twin's slab loads later, both would appear. Fix: merge real stars against a 2 pc margin that reaches into the neighbouring slabs, and re-run the merge for each slab as it loads.
  3. **`_loadedSeen` is cleared per slab on unload**; otherwise an unloaded slab could never reload.
- **Name cache:** `state.js:571-574` caches names by the 32-bit seed. On a large column some seed collisions are expected, which would show one star's name on another. Fix: key the cache by the address (tier + cell).
- **Bright-star defect [V]:** the prism query drops O and giant stars whose cell centre is outside the prism but whose position is inside it (`HashGridStarfield.js:679-681`; 0 of 40 found in a test). Naming does not depend on this query. But the slab loader is rewritten anyway and you will judge the PRISM view, so the fix lands with the loader (Phase 3).
- **Unknown [V that it is unexplained]:** the walk's ~3 s per step. Slab loading cuts the work ~60-fold whatever the cause. But if one slab really costs seconds in the browser, the first slab would still stall. **Phase 0 profiles in the browser first**: one nav instance only, the location of XIGMAG-2AE101G recorded, the feature catalogue on and off, and **a 7.81 pc inner-galaxy slab** (the option D worst case, §2.8). If that slab breaks the 50 ms line even after per-frame splitting, decision 0 is reopened before anything is frozen.

---

## 8. Everything that depends on a name or on the sector table

| Place | Risk | Handling |
|---|---|---|
| **Call sites of the namer.** `generateSystemName(rng, pos)` takes no tier today (`NameGenerator.js:443`). | Every caller must now pass tier and cell | Callers: nav pick `main.js:6137`; sky-click `:14306`, `:14327`; screensaver `:14379`, `:14393`; spawn via `generateSystemNames` `:7604`; teleport `:8312-8313` (switch to `nearest[0]`); title and `?system=` spawns `:7603`, `:5570` (X tail); nav rows `NavComputer.js:3759`, `state.js:573`; scripts `gen-named-systems.mjs`, `name-census.mjs`. Nav rows store tier as `spectral` (`NavComputer.js:3767`), but the real-star merge overwrites it (`:3812-3815`), so a separate `tier` field is kept. |
| Warp target → arrival, carried as a string (`main.js:6137` → `:6658` → `:7601-7604` → `:8051`) | Works if all callers share one function | One shared function. A test checks that the nav-row name equals the arrival name on every targeting path. |
| **Contents lookups** `RealSystemOverlay.resolve`, `KnownSystems.findByAlias` (`arrivalResolution.js:54-93`, `main.js:6751-6760`) | The dangerous one: a collision would give a procedural star **real planets** | Shape disjointness plus the build-time check against every lookup key set (§4). |
| Nav "here" and the self-warp guard (`state.js:1018-1044`, `navViewModes/index.js:882`) | Breaks if the nav and spawn name stars differently | Same function, same grid. NavComputer stops building its own sector table (`NavComputer.js:141`). |
| **[New] Everything that reads today's 775-sector table** | Under option D the table is replaced by the grid module | `NavComputer.js:141`, `:1183`, `:4636-4646` (GALAXY drill); `picking.js:181-187` (`pickSector` becomes arithmetic); `state.js:966-979` (`sectorRows`: 293 rows); `navViewModes/index.js:929` (hard-coded count of 64 cells at SECTOR becomes 256); `designs.js:1033-1107` (`reachableRadius`, `liveGridCells`: replaced by "draw a cell if it touches R ≤ 18 kpc"), `:2942-2947` (design 2's sector dots become the grid); `AutopilotNavSequence.js:226-250` (autopilot drill reads sector centre and size); `NavComputer.js:71-73` (`gridNForLevel`: SECTOR 8 → 16). |
| Warp-tunnel pattern seeded from the name (`main.js:348`, `:10347-10348`) | Each destination's tunnel looks different after the switch | Cosmetic; accept it. |
| Sector names in the nav (`GalacticSectors.js:207-235`, `state.js:966`) | They become the 293 unique sector words | This also fixes the 319 duplicates. |
| Tests: `NameGenerator.injective.test.js` (`:25-37`, `:148-173`), `scripts/gen-named-systems.mjs:63`, `scripts/name-census.mjs`, `tests/baseline/known-failures.json:210` | The old shape rules fail | Rewrite for the new shape; re-record the baseline deliberately. Tests that only use old names as fixed inputs are fine. Tests that pin today's 775 sectors or GALAXY cell counts are rewritten for the grid. |
| Cockpit name fitting (`cockpit/designation.js:46-56`) drops leading words | A focused procedural star shows "N1 M-955" on 9-column panels | That is a truthful shorter name, not a wrong one. Better cockpit handling is a follow-up. |
| Search (`knownObjectSearch.js`) | Nothing breaks | Search by sector word is a possible follow-up. |
| Planet and moon names that embed the system name | They follow automatically but get long ("Thessa Korabi N1 M-955 b") | Accept; front-drop fitting covers the panels. The planet-name fix is its own follow-up (§9). |

---

## 9. Build order

This spans several systems, so it gets a `dev-collab-scope` contract (`intent.md` + `contract.json`) before any code, and each phase is verified with `verify-workstream`. You do the UAT.

*(Draft 3 adds Phase 2, the grid on screen, so your rule is the first thing you see; later phases move down one number.)*

| Phase | What gets built | What you can see or check afterwards |
|---|---|---|
| **0. Ground truth and scope** | Browser profile of the PRISM stall (one nav instance, location recorded), **including a 7.81 pc inner-galaxy slab**. Your decisions recorded. Contract written. | A one-line answer to "what actually costs 3 s", and whether option D's core slab passes the 50 ms line. |
| **1. The fixed grid** | Grid module: 2 kpc sectors with the Sol-centring offset, 16×16 regions, 16×16 prisms, 100 pc slabs. Position → address and address → box. Ten tier tokens, edge-cell handling, X tails. Placeholder sector ids (grid references). Injectivity, round-trip and golden tests. | No visible change. A lab readout of addresses for sample stars. |
| **2. One cell = one place on every screen** (designs 1 and 2) | GALAXY draws the 19×19 sector grid (cells outside R = 18 kpc not drawn); SECTOR and REGION draw world-locked 16×16 grids with neighbours dimmed; drill goes to the fixed cell under the pointer; default REGION snaps to the player's region; edge labels A–S/1–19 and A–P/1–16; hover shows the cell's id; every reader of the old sector table switched (§8). | **Click any cell on any screen and you land in exactly that place; drag, and the cells stay the same places.** |
| **3. Fixed PRISM, segment bar, slab loading** (designs 1 and 2) | PRISM = one 7.81 pc column, WASD clamp, zoom limits (§5). Segment bar with click and drag. R/F unchanged. Shared layer function and Y-range constant. Slab loader with per-frame budget, pinned own slab, real-star margin merge, `_loadedSeen` per slab. Bright-star fix. In-browser long-task check. | **Mid-plane to 2 kpc in one click, and no main-thread task over 50 ms entering PRISM or jumping slabs.** This fixes your main pain point before any renaming. |
| **4. Vocabulary** | 293 sector words (crisp in the core, soft on the rim), the "far" word set, 256 three-letter syllables. Screened against real names, constellations and a profanity list. | An Artifact review page: you approve or reject every sector word and samples of column words. |
| **5. Name switch** | The procedural step spells out the address. Call-site changes (§8). Address-keyed name cache. Teleport naming. Build-time lookup-key check. Tail-only PRISM rows with a header, front-drop fitting, the layout test. Rewritten tests and re-recorded baseline. | Nav rows and arrivals read "Thessa Korabi N1 M-955". "Here" detection and the self-warp guard still work. |
| **6. Where-am-I label** | One resolver for address and colours, used by the label and the map highlights. | Each part of the label matches the colour of its highlighted cell. |

**Follow-ups (separate contracts, not in this one):**
- the legacy look's segment bar and grid, which reverses the earlier "legacy unchanged" rule;
- cockpit display of procedural star names;
- planet and moon names: one shared names object seeded from the star's address, not the warp counter (`main.js:6644-6645`, `:7568`), replacing the three separate namers. This is the order you set in the walk (`UAT-walk-2026-09-30.md:49-50`): system names first;
- search by sector or column word.

---

## 10. Risks and unknowns

- **[V] The stall's cause is unknown.** Phase 0 exists so we fix the right cost, and it now also tests option D's worst slab before the grid freezes.
- **[I] A frozen grid means frozen names.** Any later change to the sector size or offset, the 16×16 cuts, slab height, tier tokens or vocabulary renames every procedural star. The golden-names test makes such a change loud. That is why the grid choice (decision 0) and the Sol offset are now-or-never.
- **[I] Smaller GALAXY cells.** 11 texels instead of today's 27. Readable through edge labels and hover, not through labels inside the cell.
- **[I] Uneven stars per column (option D).** ~6,000 per slab in the inner galaxy, ~15 on the rim, often zero high above the rim. The work to load a slab is the same everywhere; what varies is how full the list and the picture are.
- **[I] The bulge is one sector.** All of R < 1 kpc shares one sector word.
- **[I] Generated words can be ugly or offensive.** The vocabulary is finite (293 sector words, a far set and 256 syllables), so it can be fully screened, and you review it.
- **[V] 19.2 million columns** can be named only by generator. Only the sector words are fully hand-reviewable.
- **[I] A sparser PRISM view** at Sol (§5).
- **[I] Long planet names**, ~25 characters. Front-drop fitting handles the panels.
- **[I] World-locked grids with dimmed neighbours** (§5) are new drawing work in both designs.
- **[V] Real stars displace a grid star within 2 pc** (`NavComputer.js:3785-3816`). The displaced grid star's address simply goes unused; the real name wins.
- **[I] The model's halo is heavy** (~9% of stars at the mid-plane, majority above ~0.9 kpc), so high slabs are not empty near Sol. This is a fact about the galaxy model, not about naming.

---

## 11. How the critique was handled (draft 2)

| # | Critique point | Handling |
|---|---|---|
| 1 | Tier letter not unique (K vs KG) | **Accepted.** 10 distinct tokens, cross-tier test (§3.2). |
| 2 | Names do not fit the nav lists; cutting from the right gives a wrong name | **Accepted.** Tail-only PRISM rows, a header, front-drop fitting, longest-name layout test (§6.4). |
| 3 | Silently overrides survey designations and catalogue-like core | **Accepted.** Now decision 3, with options. |
| 4 | Lattice is not fixed in the nav (panning, mixed sizes) | **Accepted.** Draft 2: drill and snap rules, neighbour blocks, WASD clamp. Draft 3: superseded by the uniform world-locked grid (§0, §5), which removes mixed sizes altogether. |
| 5 | Slab height is permanent, not a UI default | **Accepted.** Naming slab separated from bar bands; decisions 4 and 5. |
| 6 | Two layer resolvers (0.9 vs 1.0 kpc); design 2's bar has no spare room | **Accepted.** One function using the existing 0.3/1.0 thresholds; the slab token replaces the height and layer clauses (§6.2, §6.3). |
| 7 | Splitting by tier does not bound the frame; cold numbers include JIT warm-up | **Accepted.** Per-frame cell budget, M and K split by y-row; warm numbers quoted (§7). |
| 8 | Narrower PRISM hits the zoom clamp and slows R/F | **Accepted.** Zoom decoupled from column width; new limits stated (§5). |
| 9 | Slab loading breaks "here", real-star merge and `_loadedSeen` | **Accepted.** Own slab pinned, margin merge, per-slab reset (§7). |
| 10 | Seed-keyed name cache | **Accepted.** Keyed by address (§7). |
| 11 | Signature change, call sites, teleport naming | **Accepted.** Full call-site list, separate `tier` field, teleport named after `nearest[0]`, X tails for title and deep-link spawns (§3.4, §8). |
| 12 | No coverage past R = 18 kpc | **Accepted.** Draft 2: outer ring. Draft 3: the uniform grid covers everything; far squares get generated words (§3.4). |
| 13 | Joined syllables can be ambiguous | **Accepted.** Fixed-length syllables (3 + 3 in draft 3), distinctness test (§3.2). |
| 14 | Weak alternative in the name-shape decision | **Accepted.** Option B is now sector word + grid reference (decision 2). |
| 15 | Scope creep | **Mostly accepted.** Legacy bar, cockpit, planet names and search are now follow-ups. **Two items kept:** (a) the bright-star fix stays with the slab loader: it is not needed for naming, but that phase rewrites that loader path and you will judge the PRISM view it affects; (b) the Sol offset stays, now built into the grid choice, because it can only be done before names freeze. Doing it later would rename everything a second time. |
| 16 | Tails look like real designations ("M42", "K2") | **Accepted.** Hyphen plus 3-digit padding ("M-042"). |
| 17 | Y RANGE readout ±2 vs loader ±3 | **Accepted.** One ±3 kpc constant (§6.3). |

---

## 12. Decisions for you

0. **(New, first) How the galaxy is cut into sectors, so every cell on every screen is exactly one thing.**
   - **D (recommended):** uniform 2 kpc sectors (293), each cut 16×16 into 125 pc regions, each cut 16×16 into 7.81 pc prisms. GALAXY cells are 11 texels and read through edge labels. It obeys the rule everywhere, gives the same loading work for every slab, and leaves 293 sector words to review. You lose today's chunky GALAXY cells and equal stars per sector.
   - **C:** add a ZONE screen (GALAXY 4 kpc zones → ZONE 1 kpc sectors → SECTOR → REGION). Every screen keeps big labelled cells, but every trip down costs one more click, there are ~1,100 sector words, and it is the largest code change.
   - **B2:** uniform 2 kpc sectors with today's 8×8 regions. Chunky SECTOR screen and a fuller Sol prism (~1,260 stars per slab), but core slabs hold ~27,000 stars at 3× the loading work.
   - **A:** draw today's 775 mixed-size sectors on GALAXY. Needs GALAXY zoom (9×) before most sectors can be seen or clicked; uneven loading cost.
   - **Recommend: D**, unless Phase 0 shows its inner-galaxy slab cannot stay under 50 ms.
1. **Rename every procedural star once.** Every procedural name becomes multi-part, and July's "same name forever" is broken exactly once; after that it holds again. No save or link breaks. **Recommend: yes.**
2. **Name shape.**
   - **A:** sector word + generated column word: "Thessa Korabi N1 M-955". You get a sayable name and neighbouring columns sound alike. The cost is 65,536 generated column words, built from 256 reviewed syllables, checked by sample only.
   - **B:** sector word + grid reference: "Thessa I9A3 N1 M-955". Only 293 words need review, and the code is exactly what the edge labels on the SECTOR and REGION screens say (stronger under draft 3's edge labels than before). The cost is more letters and numbers, which is the "meaningless strings" look you objected to.
   - **Recommend: A**, with the grid reference shown on hover and on the map edges so you can match the two.
3. **Survey-style names** (your July ruling: "like real astronomy designations"; core "more catalogue-heavy").
   - **A:** drop the survey class. One Elite-style shape for all procedural stars, with the core's feel carried by crisp sector words. This follows today's direction ("readable syllables at the beginning").
   - **B:** keep a survey-style variant in core sectors, e.g. "PVX Thessa-Korabi N1.M-955". That keeps July's ruling, but the name no longer starts with syllables there.
   - **Recommend: A.**
4. **Naming slab height (permanent).** **Recommend: 100 pc**, giving N1–N30 and S1–S30 inside the nav's ±3 kpc.
5. **How the bar groups slabs (changeable later).** **Recommend: 60 cells coloured thin/thick/halo, with the slab name in the rail.** The alternative is ~6 labelled floors that expand to their slabs.
6. **PRISM becomes one fixed column.**
   - The view equals the fixed 7.81 pc column everywhere (sparser at Sol, dense in the inner galaxy).
   - Drill goes to the fixed cell under the pointer.
   - Free panning stays; the grid stays locked to the world, with neighbours dimmed.
   - WASD stops at the column edge.
   - Zoom can always pull back past the column.
   - **Recommend: yes.** Without it, one star could carry different names depending on how you reached it.
7. **Segment bar beside the ±2 pc fine gauge you approved, or replacing it.** **Recommend: beside.**
8. **Centre Sol in its prism (now or never).** *(Now part of decision 0's grid.)* Shift the grid by 1 kpc + 3.9 pc so Sol and the galactic centre each sit in the middle of a prism, about 1 kpc from every sector edge. Without the shift, Sol sits exactly on a corner shared by four sectors, and its home neighbourhood would carry four sector words. **Recommend: yes.**

**Going ahead unless you object:**
- edge labels on every grid (GALAXY A–S × 1–19, SECTOR and REGION A–P × 1–16), replacing design 1's ids on the 8 densest tiles;
- performance acceptance line: no main-thread task over 50 ms entering PRISM or jumping slabs, measured in the browser at the inner galaxy and at Sol;
- tail-only star rows inside PRISM with the column name as a header;
- whole words dropped from the front whenever a name is shortened;
- layer thresholds stay at today's 0.3 / 1.0 kpc;
- the Y range is ±3 kpc everywhere;
- the label shows where you are, not what you are browsing, with each part coloured like its map highlight;
- procedural teleports are named after the star they actually spawn;
- the legacy look, cockpit, planet names and search become follow-ups.

---

## 13. Changelog

**Draft 3 (2026-10-02): your one-cell-one-child rule.**
- **Added section 0.** Your rule, verbatim, as the first principle. An audit of every screen, today against required: GALAXY fails outright (0 of 52 cells hold exactly one sector). SECTOR and REGION obey only until you drag. PRISM does not obey. Four GALAXY options with measured numbers; **option D recommended.**
- **Hierarchy replaced (§3.1).** Draft 2 used the 775-sector adaptive quadtree, frozen as data, plus rim fill and an outer ring, with 8×8 regions and 16×16 prisms. Draft 3 uses a uniform 2 kpc grid (293 sectors inside R = 18 kpc) with 16×16 regions and 16×16 prisms. **Why:** a mixed-size quadtree cannot be drawn one-cell-per-sector at 417×240 (62% of sectors would be 1.5 texels). A uniform grid obeys the rule at any pan, covers all space without special tables, and no longer moves when density is retuned.
- **Prism width is now 7.81 pc everywhere** (was 1.95 pc core to 31.25 pc rim). **Why:** loading work per slab becomes the same everywhere (12,485 cells, 5–27 ms warm headless; the worst slab was 199 ms). The trade is uneven star counts (~6,000 per slab in the inner galaxy, ~15 on the rim).
- **Counts changed (§2.5).** 19.2 million columns (was 12.7 million). 293 sector words to review (was ~800). Column words are 3 + 3 letters from one 256-syllable set (was 2 + 3 letters from 64 + 256 syllables), because regions per sector went from 64 to 256.
- **Names changed (§3.3).** Worked examples were recomputed on the new grid. The slot number is now 4 digits at most, and the longest name is 25 characters (was 26).
- **Sol centring (decision 8)** is now part of the grid (a shift of 1 kpc + 3.9 pc). It also centres the galactic centre.
- **New in §5:** world-locked grids with dimmed neighbours (replacing draft 2's mixed-size neighbour blocks), and edge labels on every grid.
- **New in §6.5:** each part of the where-am-I label is coloured like its map highlight.
- **New in §7:** performance is a hard requirement, with a 50 ms long-task acceptance line. Phase 0 must also test a 7.81 pc inner-galaxy slab in the browser, because option D puts more work into core slabs than draft 2 did.
- **New in §8:** a row listing every reader of today's 775-sector table.
- **Build order (§9):** new Phase 2 (one cell = one place on every screen), so your rule is visible before PRISM, vocabulary or renaming. The later phases moved down one number.
- **Decisions (§12):** new decision 0 (the grid); decision 2's option B noted as now matching the edge labels; decision 8 folded into the grid; two new "going ahead" items (edge labels, the 50 ms line).
- **Corrected from the brief:** the GALAXY grid on screen is a re-fitted 4.5 kpc grid, not the 4 kpc base grid in `GalacticSectors`. Sol's 4 kpc base square holds 10 sectors (not 16), and the busiest holds 223 (not 256).
- **Unchanged:** the naming precedence chain and July guarantees (§4), tier tokens and slot padding, X tails, edge-cell handling, teleport naming, slab height, segment bar layout and plumbing, layer thresholds, the slab-loading correctness fixes, call-site list, follow-ups.

---

## Appendix: Evidence

### Code (branch `feature/world-engine-production-L1`)
- **Name precedence:** `src/generation/NameGenerator.js:443-472` (throw `:444-451`, catalogue `:461-462`); `src/main.js:6137`, `:14321-14324`, `:14388-14391`, `:7597-7598`, `:8356`; `arrivalResolution.js:61-63`, `:82-86`; `docs/NAMING_AND_REAL_OBJECTS.md:271-277`.
- **Position locator L and catalogue key:** `NameGenerator.js:238-288` (constants `:261-264`), `:290-331`; `src/generation/data/namedSystemsCatalog.js:1-57`.
- **Procedural shapes:** survey `NameGenerator.js:396-401`; multipart `:405-410` (word from low bits `:407`); syllables `:333-352`; bit floor `:43-50`; region weights `:366-371`.
- **Shape tests:** `src/generation/__tests__/NameGenerator.injective.test.js:25-37`, `:148-173`; `scripts/gen-named-systems.mjs:63`; `tests/baseline/known-failures.json:210`.
- **Sectors:** `src/generation/GalacticSectors.js:4-17` (purpose: equal stars per sector), `:44-73` (null beyond 1.2 × radius `:47`, nearest fallback `:58-72`), `:92-159` (base grid `:97-124`, quadtree `:126-159`, depth ≤ 4 `:136`), `:114-115` and `:132-136` (density-driven), `:207-243` (placeholder names, hash).
- **Sector table readers:** `NavComputer.js:15`, `:141`, `:1183`, `:1199-1221` (`_setupViewStackForPlayer`), `:4630-4650` (GALAXY drill); `navViewModes/picking.js:181-187`; `navViewModes/state.js:966-979`; `navViewModes/index.js:261`, `:477`, `:929`; `auto/AutopilotNavSequence.js:226-250`.
- **GALAXY drawing:** `designs.js:576-581` (`levelView`), `:760-781` (`pickedSector`, cell ≠ sector; function at `:776`), `:1033-1048` (`reachableRadius`), `:1062-1066` (`d1GalaxyView`), `:1093-1107` (`liveGridCells`), `:1109-1135` (`d1TwoD` grid), `:1158-1173` (8 densest tile ids), `:1209-1216` (`d1TileRows`, ids A–P), `:2942-2947` (design 2 sector dots).
- **Layout and font:** `designs.js:822-828` (design 1 map width, height, rail); `src/rendering/PixelText.js:79-91` (shipped 5×5 face, advance 6).
- **Galaxy extent:** `GalacticMap.js:89-90`, `:93-94` (Sol); `HashGridStarfield.js:304-305`, `:455`, `:684`.
- **Star tiers and slots:** `HashGridStarfield.js:73-90` (10 tiers, `ALL_TYPES`), `:651-735` (one star per tier-cell), `:690` (tier hash offset), `:717-722` (offset bytes), `:729` (32-bit seed), `:661-662` (`yCells > 200` skip), `:679-681` (bright-star drop), `:726-727` (50k cap).
- **Density layers:** `GalacticMap.js:480-494`, `:682-820`, `:766-776`, `:843-872`.
- **Prism geometry and nav:** `NavComputer.js:44` (`MAX_PAN_STEP_MS`), `:71-73` (`gridNForLevel`), `:141` (own sector instance), `:156` (line-freeze note), `:1183-1223`, `:1371-1407` (pan), `:1595-1602` (`computeTileSize`), `:1880-1881`, `:2052-2058` ("here"), `:3539-3673` (legacy minimap), `:3696-3884` (loader, `_queryYRange`, `_scheduleBgExpand`, MAX_Y `:3856`), `:3756-3816` (row naming, real-star merge), `:4349`, `:4362-4369` (view pan), `:4398-4415` (grabs), `:4651-4680` (drill), `:4704-4705` (zoom clamp).
- **Designs:** `src/ui/navViewModes/designs.js:399` (`pad`), `:822-836` (design 1 layout), `:825`, `:868` (rail cols), `:844-853` (status row), `:1928` (PRISM list pad `cols-13`), `:1946-1948` (rail numbers), `:2155-2159` (`d1PlayerTile` grid reference), `:2180-2186` (layer thresholds, Y RANGE ±2), `:2210-2221` (y-gauge ±2 pc), `:2787-2790` (design 2 locator), `:2860-2891` (bottom bar), `:3101-3130` (minimap, gauge), `:3176` (list name 119 texels).
- **Nav state:** `navViewModes/state.js:559-575` (`nameBySeed`), `:610-620`, `:627-657` (design body namer), `:966`, `:986-1011` (row rebuild), `:1018-1044` ("here", self-warp); `navViewModes/index.js:205`, `:882`, `:1121-1141`, `:1320`, `:1381`.
- **Text fitting:** `src/ui/navPixelType.js:146-151` (right-cut `fit`); `src/cockpit/designation.js:9-20`, `:46-56` (front-drop rule).
- **Name-keyed sites:** `main.js:348`, `:5558-5572`, `:6644-6645`, `:6658`, `:6691`, `:6751-6760`, `:6790`, `:7568`, `:7601-7604`, `:8051`, `:8312-8313`, `:10347-10348`, `:14306`, `:14327`, `:14379`, `:14393`; `RealSystemOverlay.js:156`, `:173-215`, `:282-283`; `KnownSystems.js:36-45`, `:135-152`; `knownObjectSearch.js:1-79`, `:202-221`.
- **No durable name storage:** `Settings.js:112`, `:161`; `ShipCameraSystem.js:514-522`; `navViewModes/index.js:1834-1843`; `flightModes.js:664-681`.
- **Two nav instances:** `main.js:4700`, `:5895`.

### Measurements (draft 3, `scratchpad/onecell/`)
- `a-quadtree.mjs`: 775 sectors by size (480 × 0.25, 96 × 0.5, 106 × 1, 52 × 2, 41 × 4 kpc); texels at 6 per kpc; zoom needed to label; sectors per 4 kpc base square (Sol 10, max 223).
- `f-today.mjs`: design 1's 52 drawn GALAXY cells touch 2–163 sectors each (median 4); none holds exactly one; Sol's touches 15.
- `b-uniform.mjs`: uniform 1 / 2 / 4 kpc grids: 1,076 / 284 / 88 squares touching R ≤ 18 kpc.
- `d-offset.mjs`: option D's shifted 2 kpc grid: 293 sectors, 19 × 19, Sol and the galactic centre each at a prism centre ~1 kpc from sector edges; 4 kpc zones: 83 (10 × 10); 1 kpc sectors: 1,093.
- `c-prism.mjs`: stars and warm time per 100 pc slab for 7.81 / 15.63 / 31.25 pc prisms at six radii.
- `g-cells.mjs`: cells evaluated per slab: 1,953 (1.95 pc), 12,485 (7.81 pc), 37,349 (15.63 pc), 128,808 (31.25 pc).
- `e-examples.mjs`: section 3.3's worked examples.

### Records
- `docs/WORKSTREAMS/naming-census-uniqueness-2026-07-07/ac5-decision.md`: ratified items 1-6; Addendum ruling 1 (astronomy-style designations, grid-cell identity); Addenda 2-3 (bit floor, shipped catalogue).
- `docs/NAMING_AND_REAL_OBJECTS.md`: §1.2 (naming never changes contents), §6 (one system, one name).
- `docs/WORKSTREAMS/nav-restorations-2026-09-20/UAT-walk-2026-09-30.md`: body-namer findings and the order "system names first"; the PRISM stall profile; the Elite input; your 2026-10-02 direction.

### Research sources
- **Elite Dangerous name format and sector math (EDTS):** https://bitbucket.org/Esvandiary/edts/raw/HEAD/edtslib/pgdata.py · …/sector.py · …/pgnames.py · C# inversion gist https://gist.github.com/klightspeed/772c654f07292b71dfe7aa55c91397e8
- **Elite galactic regions, and the label-disagreement bug:** https://github.com/klightspeed/EliteDangerousRegionMap · https://issues.frontierstore.net/issue-detail/13286
- **Elite catalogue share:** https://en.wikipedia.org/wiki/Elite_Dangerous · forum (seen via search snippet only): https://forums.frontier.co.uk/threads/how-do-systems-get-their-names.555562/
- **EVE Online system naming:** https://randomwaypoint.fajs.de/2016/04/eve-in-numbers-solar-systems/index.html
- **SpaceEngine:** https://spaceengine.org/news/blog100201/
- **No Man's Sky regions and addresses:** https://nomanssky.miraheze.org/wiki/Region · https://nomanssky.miraheze.org/wiki/Portal_address
- **IAU designation rules (truncate, don't round):** https://cds.unistra.fr/Dic/iau-spec.html
- **Floor-selector UI pattern:** https://mapuipatterns.com/floor-selector/
- **Dwarf Fortress z-levels:** https://dwarffortresswiki.org/index.php/Z-level
- **Not fetched first-hand, treat as unverified:** Elite "alphabet soup" complaints; the original Elite digram table; YouTube chapter-bar details; Dwarf Fortress 10-level keys.
