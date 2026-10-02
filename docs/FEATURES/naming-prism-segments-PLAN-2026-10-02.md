# Plan: one cell = one place, location-based star names, and a segmented PRISM column

*Lane A, branch `feature/world-engine-production-L1`. Written 2026-10-02. This is a **plan only**: no code was changed. Draft 4 is not committed yet. This is the **fourth draft**. Draft 2 folded in a critique. Draft 3 made your "one cell = one thing one level down" rule the first principle (section 0). Draft 4 folds in Astra's review of draft 3 and your rulings since then. The biggest addition is section 3: before any name is frozen, every star must have exactly one owner and one identity that the whole game uses. Section 14 lists what changed and why.*

**How to read the labels:**
- **[V]** = verified. Checked in the code (file:line given) or measured by a script running the real modules headless.
- **[A]** = measured by Astra in its review and **not re-checked** by us (the browser-trace timings in section 8).
- **[I]** = inference or design proposal. Not built, not tested.

Astra's review: `.astra/jobs/20261002-103745-naming-prism-plan-review/report.md` (verdict: **feasible with changes; option D stands provisionally; not ready to freeze names**). A review agent checked Astra's findings against the code: 14 of 15 confirmed; the per-slab loop count was confirmed by recompute; Astra's own trace timings were not re-checked.

Scratch scripts behind the numbers are in `/tmp/claude-1000/-home-ax/e3bfb779-bd19-48ee-9c65-af3fc876407b/scratchpad/onecell/`: `a-quadtree.mjs` (today's sector sizes), `b-uniform.mjs` and `d-offset.mjs` (uniform grids), `c-prism.mjs` (stars and timing per slab), `e-examples.mjs` (worked examples; **draft 4 uses `e2-examples-rowsfromtop.mjs`**, which fixes the grid references), `f-today.mjs` (what today's GALAXY cells contain), `g-cells.mjs` (work per slab; **undercounts**, see §8).

---

## 0. First principle: every cell is exactly one thing from the level below

### 0.1 Your rule (verbatim, 2026-10-02)

> "at each level of the navigation screen, what should be represented by the cells in the grid is the next level down in terms of resolution. So, each cell in the galaxy should represent a single sector. Otherwise, we won't be able to actually navigate between them coherently. Every cell in the sector view should be displaying a single region. Every cell in the region view should be displaying a single prism. If that's not how it's working today, we need to reconsider the scale at which each of these things is representing what's inside of it. And consider a different approach if that's not feasible."

**Why it matters.** When a cell is exactly one child, clicking it takes you to that child, the name of the cell is the name of the child, and the "where am I" label can point at one cell. When a cell holds pieces of several children, the click, the label and the name can each pick a different one, so they stop agreeing.

Section 3 applies the same idea one level further down: **every star belongs to exactly one box**, so its name, its click and its warp all point at the same star.

### 0.2 Today, level by level [V]

| Screen | The rule says each cell is… | What a cell is today | Obeys? |
|---|---|---|---|
| **GALAXY** | one sector | **Design 1** draws a plain 8×8 grid over a 36 kpc square (4.5 kpc cells: `designs.js:1062-1066`, `:1109-1135`). It does **not** follow the sectors. 52 cells are drawn. Each touches **2 to 163 sectors (median 4); none holds exactly one**. Sol's cell touches 15 (`f-today.mjs`). The code itself says the cell and the sector "are DIFFERENT OBJECTS" (`designs.js:760-767`). **Design 2** draws each sector as a dot, with no grid (`designs.js:2942-2947`). | **No** |
| **SECTOR** | one region | Drilling from GALAXY sets the view to that sector's own square, cut 8×8 (`NavComputer.js:4636-4646`, `:71-73`). After a drag the cells straddle regions (`:4362-4369`). | Only until you drag |
| **REGION** | one prism | Drilling lines up (`NavComputer.js:4655-4672`). The **default** REGION view is a density-based tile around the player (`:1216-1221`), so its cells are nobody's prisms. | Only if you drilled and did not drag |
| **PRISM** | one prism column | Loads a box around the clicked tile's centre (`NavComputer.js:4677-4678`), not the tile itself (§2.4). | **No** |

Sol's 4 kpc base square holds 10 sectors and the busiest holds 223 (`a-quadtree.mjs`).

### 0.3 Why GALAXY is the hard case [V]

Today's 775 sectors are an **adaptive quadtree**: dense ground is cut smaller so each sector holds roughly the same number of stars (`GalacticSectors.js:4-17`, `:126-159`). 480 of them (62%) are 0.25 kpc wide, which is **1.5 texels** on design 1's GALAXY (6 texels per kpc). A two-character label needs a cell of at least 14 texels (`designs.js:1163`). Today's chunky 27-texel cells exist only because the grid ignores the sectors.

### 0.4 The options for GALAXY

Numbers assume design 1's 216-texel map square (`designs.js:822-828`) [V].

- **A: draw the quadtree itself.** 480 sectors would be 1.5 texels; GALAXY would need a 9.3× zoom to label them. ~800 sector words. Uneven loading work per slab (a 31.25 pc rim prism is about 10× a 7.8 pc one).
- **B: uniform sector grid with today's 8×8 regions.** B1 (1 kpc sectors) gives 6-texel GALAXY cells (too small to read) and ~1,100 words. B2 (2 kpc) gives 15.6 pc prisms with ~27,000 stars per core slab and about 3× D's loading work.
- **C: add a ZONE screen** (GALAXY → ZONE → SECTOR → REGION → PRISM). Every screen keeps big labelled cells, but one more click every trip, ~1,100 words, and the biggest code change (the level index is hard-wired in 100+ places: 50 `_levelIndex` in `NavComputer.js`, 44 `S.level` in `designs.js`).
- **D (recommended): uniform 2 kpc sectors, 16×16 regions, 16×16 prisms.**

```
GALAXY   19 × 19 grid of 2 kpc sectors    (11 texels a cell; 293 touch R ≤ 18 kpc and are drawn)
SECTOR   one sector, 16 × 16 regions      (125 pc each; 13 texels a cell)
REGION   one region, 16 × 16 prisms       (7.8125 pc each; 13 texels a cell)
PRISM    one prism column, cut into 100 pc slabs
```

- **Exact constants [V, Astra recomputed].** Prism width is **2/256 kpc = 7.8125 pc exactly**. The grid is shifted by **1.00390625 kpc** (1 kpc plus half a prism) so Sol at (8, 0) and the galactic centre at (0, 0) each sit in the middle of a prism, about 1 kpc from every sector edge. Both numbers are exact in binary, so every computer computes the same cell. **The rounded figures 7.81 pc and 3.9 pc in earlier drafts must never become constants.** The full grid runs from −18.99609375 to +19.00390625 kpc: 19×19 = 361 squares, of which 293 touch R ≤ 18 kpc and 68 corners do not.
- **One thing the shift cannot do:** the middle of a sector is a corner between four regions, so Sol's prism touches four regions. That changes the column word, not the sector word. Also, the central sector does not hold literally every point within 1 kpc of the centre: its lower edges are at −0.99609375 kpc.
- **What you see:** GALAXY cells are about 11 texels (today 27), read through **edge labels**: A–S along the top, 1–19 down the side. Sol's sector is **N10**; the galactic centre's is **J10**. SECTOR and REGION are 16×16 with A–P / 1–16. Hovering a cell shows its word.
- **Rule:** obeyed on every screen, at any pan, because a uniform grid is the same grid however you pan.
- **Loading:** every 100 pc slab of every column runs the same loop: **13,680 cell visits** [V, recomputed from the production loops; draft 3's 12,485 came from a scratch formula that did not match the code]. What varies is how many stars come out: ~5,600–6,700 per slab in the inner galaxy, ~300 at Sol, ~15 on the rim.
- **Risks:** smaller GALAXY cells; the whole bulge is one sector; dense inner-galaxy lists; empty rim slabs; and the browser cost of a core slab is still unproven (§8). **D is provisional until Phase 0 and Phase 3 measure it in the browser.**

### 0.5 Recommendation

**Option D.** The criteria, in order: (1) obeys your rule on every screen at any pan; (2) every cell clickable and readable at 417×240 (rules out A and B1); (3) PRISM performance is a hard requirement, so the worst-case work per slab must be small and the same everywhere (D and B1 best); (4) sector words few enough to hand-review (D: 361 including the corners; others ~800–1,100); (5) smallest structural change (D keeps four screens). **What D gives up:** chunky GALAXY cells and equal stars per sector. That is decision 0.

---

## 1. The goal, in your words

1. **Names that mean something.** "I like the Elite approach of having readable syllables at the beginning, and naming stars … based on their galactic location." Real catalogue stars and in-universe named systems keep their own names.
2. **A column you can move through.** Prisms "are very tall … right now you can just press R and F or drag the vertical slider but it takes minutes to go from one section to another." Visible segments you can click or drag to, with R/F kept for slow panning.
3. **A "where am I" label** showing the full address, coloured to match the map highlight.
4. **(Governing) One cell = one thing one level down** on every nav screen, with every cell readable for orientation.
5. **PRISM performance is a hard requirement** (your words in the walk): no multi-second stall entering, moving through, or leaving a column.

You also asked that this not be "a new process slapped on". **This plan keeps July's whole precedence chain, every guarantee and the 48,000-name catalogue. It replaces only the last step: how a procedural star's identity is spelled out as text.**

### 1.1 Your rulings since draft 3, and where each one goes

| Ruling (walk, `UAT-walk-2026-09-30.md`) | Where it goes | Why there |
|---|---|---|
| **PRISM performance is a hard requirement**, including the ~1.5 s hitch on leaving PRISM | **In this plan** (§8, Phase 0 and Phase 3) | The slab loader is rebuilt here; leaving PRISM is part of the acceptance test. |
| **The whole instruction/legend row above the tab strip is removed** (key hints included) | **Its own small fix in the nav-restorations batch**, not this plan | It is a walk defect on today's screens and should not wait for a multi-phase project. This plan's layouts (§6, §7) assume the row is gone; if it has not landed by Phase 2, Phase 2 removes it, since it redraws those screens anyway. |
| **Search shows one row per destination** (Sol appears twice: real star + KnownSystems) | **Nav-restorations batch**, not this plan | It is a search merge (`knownObjectSearch.js:145-196`). Note: the stable identity for real objects in §3.4 is the natural merge key, so if search is fixed first it should key on the KnownSystems/real-star link, which §3 will reuse. |
| **The GPS line works in every mode**: HELM Enter burns; ORRERY reads GO TO <body> and Enter glides the view along the line (July's "nothing flies in ORRERY" kept) | **Separate SYSTEM-screen contract**, not this plan | It is the SYSTEM screen and the burn workflow, not the galaxy grid or names. |
| **The cockpit nav gets a full redesign after this non-diegetic redesign** | **Follow-up** (replaces draft 3's "cockpit display of names" follow-up) | This plan adds no new widgets to the cockpit nav. But the cockpit runs its own nav instance (`main.js:4700`, `:5895`), so it must keep working and must pass the performance test (§8). |

**Why the asks become one project [I].** A name can only carry a location if the galaxy has a fixed grid of places, and your rule says the screens must *be* that grid. So the same grid is what each screen draws, what the segment bar shows, what the label reads, what a name spells out, and what decides how many stars load at once.

---

## 2. What we have today, and the surprises

### 2.1 Where a system's name comes from [V]
The first source that has a name wins: (1) **KnownSystems** (Sol, Alpha Centauri: `main.js:7597-7598`, `arrivalResolution.js:61-63`); (2) **real-star names** (`main.js:6137`, `:14321-14324`, `:14388-14391`); (3) **the 48,000-name catalogue** (`NameGenerator.js:461-462`); (4) **procedural** (`NameGenerator.js:396-410`). Written down in `docs/NAMING_AND_REAL_OBJECTS.md:271-277`.

### 2.2 Why today's procedural names look meaningless [V]
A procedural name spells out a ~70-bit position number (`NameGenerator.js:238-288`), and the readable word comes from its **low** bits (`:407`), so neighbouring stars get unrelated words ("Jessep-4ORN2UU4JC", "Juddil-4OS5AX07KA"). Elite does the reverse: the readable part is the location.

### 2.3 Today's sector table cannot be used as it is [V]
*(Option D replaces it.)* 775 sectors but only 453 distinct names (mirror pairs share names; `GalacticSectors.js:209` calls it a placeholder). It spans only −15 to +17 kpc (`:100-103`) while stars reach R = 18 kpc; `getSectorAt` silently picks the nearest sector for 38,540 of 407,065 sampled points (`:58-72`) and returns `null` beyond 1.2 × the galaxy radius (`:47`). Its edges come from the density model (`:114-136`), so retuning density would move them.

### 2.4 A "prism" is not a fixed thing yet [V]
| How you reach PRISM | Width at Sol | Code |
|---|---|---|
| Drilled SECTOR → REGION → PRISM | 7.8 pc tile | `NavComputer.js:4651-4677` |
| The default region, centred on the player | 41.9 pc tile | `NavComputer.js:1216-1221` |
| The width actually loaded | 20.7 pc | `NavComputer.js:1188`, `:4678`, `:3750` |
| **The autopilot's drill** | its own 8×8 grid over 44 kpc (5.5 kpc squares), subdivided by 16; PRISM entry uses adaptive widths, direct entry a synthetic 0.01 kpc view | `AutopilotNavSequence.js:464-475`, `:312`, `:352`, `:371` |

The autopilot's hover reads the sector table (`:233`), but the destination it actually drills to comes from that separate grid (`:244`). Draft 3 said the autopilot "reads sector centre and size"; that was wrong.

### 2.5 Prisms are far too many to name by hand [V]
Option D has 293 × 256 × 256 = **19.2 million** prism columns. Only the sector words are few enough to review one by one.

### 2.6 Why moving up and down is slow [V]
R/F moves at about 0.9 pc/s at entry zoom and at most ~6 pc/s at Sol (`NavComputer.js:1373`, zoom cap `:4705`). The column is ±3 kpc (`:3856`): about 16 minutes to cross at best. The draggable Y gauge reaches only ±2 pc around the player (`designs.js:2211`, clamp `navViewModes/index.js:1136-1141`). The "Y RANGE" readout says ±2.0 kpc (`designs.js:2185`) but the loader fills ±3.0.

### 2.7 Every procedural star has a fixed slot, but the game does not use it [V]
- 10 spectral tiers (O, B, A, F, G, K, M and giants Kg, Gg, Mg), each with its own cubic grid from 1.1 pc cells (M) to 74 pc (O) (`HashGridStarfield.js:73-90`). Each (tier, cell) makes **at most one star** (`:651-735`). July already asked to name stars by this "grid-cell identity" (`ac5-decision.md`, Addendum ruling 1).
- **But the generator throws that identity away.** The star records it returns carry position, seed and type, not the cell (`HashGridStarfield.js:731`); the sky's copy is the same (`:216`).
- **Instead the game identifies stars by their 32-bit `seed`** (`:729`), which cannot be unique across ~2×10¹¹ stars. Draft 3 said "nothing in this plan keys on the seed". That was true of the plan, but **the game already does, in five places**: a PRISM list click (`navViewModes/index.js:496`), a PRISM map click (`picking.js:271`), selection (`state.js:1031`), the multiplicity cache (`state.js:611`) and the name cache (`state.js:571-574`) all find "the star with this seed"; and loading de-duplicates on seed plus X rounded to 6 decimals (`NavComputer.js:3755`). Two different stars with the same seed can therefore be **clicked as each other and warped to the wrong one**. Section 3 fixes this.

### 2.8 The PRISM stall [V unless marked]
- The walk profiled ~3 s of main-thread time per loading step near the core (system XIGMAG-2AE101G).
- **From the saved trace [A]:** of a 94.5 s trace, 93.1 s was inside the query chain (`_queryYRange` → `findStarsInPrism`), of which 66.7 s in `_spiralPotentialOnly`. Rebuilding the rows took 0.21 s and the real-feature density 0.09 s. The 32 background steps took a median of 3.09 s each. So **the cost is the star query itself**, not the list or the feature catalogue.
- **Headless [A]:** the same kind of 7.8125 pc × 100 pc query at six radii made 7,834–8,964 density calls and took 5.9–15.6 ms warm.
- **The gap is still unexplained.** Astra's leading suspect is that the measurements were not like for like: the walk's steps used a different box (wider, two slabs, at another location) than the headless runs. The bulge (R < 0.5 kpc) is unusually cheap (`GalacticMap.js:845`); elsewhere each density call runs seven spiral evaluations (`:770`). A browser or profiler overhead may remain after that is normalised. **Phase 0 measures exactly that** (§8).
- **Draft 3 claimed slab loading "cuts the work ~60-fold whatever the cause". That was wrong**: loading one slab instead of the whole column reduces the total, but does not make an individual slow query faster. Only a time-sliced loader bounds each task.

---

## 3. Star identity: one star, one owner, one key (the gate before any name is frozen) [I unless marked]

**Why this comes first.** A name is a promise: one star, one string, forever. That promise only holds if (a) every star belongs to exactly one box, so the box part of the name cannot depend on which query found it, and (b) the game uses one identity for that star everywhere: when it lists it, draws it, you click it, it de-duplicates it, it warps to it and it names it. Today neither holds (§2.7). Astra rated this the one **blocker**: not a reason to drop option D, but a reason not to freeze names until it is done.

### 3.1 Rule 1: exactly one owning box per star
- Every box is **half-open on every axis: the lower edge belongs to it, the upper edge belongs to the next box.** In code: index = `floor((coordinate − origin) / size)`, for X, Y and Z, at every level (sector, region, prism, slab).
- **Negative coordinates use the same floor**, so they need no special case: −0.1 kpc ≤ y < 0 is index −1.
- **Slabs:** slab index k = `floor(y / 0.1 kpc)`. k ≥ 0 is **N(k+1)**; k < 0 is **S(−k)**. So **y = 0 exactly is N1**, and the first star below the plane is S1. There is no "slab zero".
- **One function, called by everything.** Position → address is a single shared function. 7.8125 pc and 1.00390625 kpc are exact in binary, but 0.1 kpc is not; that is safe only if every caller does the same arithmetic, so no screen, loader or namer may compute a box itself.
- **Why lower-inclusive:** today the generator puts stars exactly on cell edges (offset byte 0 or 255, `HashGridStarfield.js:717`) and the prism filter accepts both edges (`:724`). Without a rule, a star on an edge is in two boxes and can get two names.

### 3.2 Rule 2: one identity, carried everywhere
- **A procedural star's identity is (tier, cellX, cellY, cellZ)**: the generating slot the hash grid already used. The generator returns it on every star record (it already knows it), and the sky's copy (`HashGridStarfield.js:216`) carries it too.
- **It is carried, never recomputed from position, through:** query results → list rows and map hits → picking (map and list) → selection → de-duplication → the warp target → arrival → naming.
- **Real and catalogue objects get their own stable identity** (their catalogue id or KnownSystems id), kept separate from the procedural slot they replace.
- **The seed stays exactly as it is, as a generation input.** Nothing a system contains changes; only how the game *finds* a star changes.

### 3.3 Rule 3: the slot number inside a box
- A star's name tail is its tier token plus a **slot number**: the index of its generating cell among **all** that tier's cells that can place a star inside the owning box, counted in a fixed, documented mixed-radix order (height first, so a bigger number is higher up).
- **Coarse tiers need care.** An O-star cell is 74 pc, much bigger than a 7.8125 pc column, so many columns share one O cell, and a box's candidate cells include ones whose centre lies outside the box. The slot counts those boundary-touching cells too. Every tier's cell size and the counting order become **frozen constants alongside the grid**.
- **When only a position is known** (should be rare once identity is carried), the namer regenerates the candidate cells from the hash alone (never the density model). At a corner that can be **up to eight** cells, not "one or two" as draft 3 said. If more than one candidate matches, it reports an error rather than guessing.
- **Draft 3's worked-example slot numbers were computed from position with `floor`, the very method this section rules out**, so they are placeholders and will change (§4.3).

### 3.4 What switches off the seed (replacing every seed-keyed lookup)
| Site | Today | Becomes |
|---|---|---|
| PRISM list click, `navViewModes/index.js:496` | first loaded star with the same seed | the star with the same identity |
| PRISM map click, `picking.js:271` | same | same |
| Selection, `state.js:1031`; multiplicity cache `:611` | by seed | by identity |
| Name cache, `state.js:571-574` | by seed | by identity |
| Load de-duplication, `NavComputer.js:3755` | seed + X to 6 decimals (ignores Y, Z, tier) | by identity |
| Warp target transport, `main.js:6137` → `:6658` → `:7601-7604` | position + name string | adds the identity |

### 3.5 Systems that are not galaxy stars
- **Feature-centre systems** (real galaxy objects not made by the hash grid) are places in the galaxy: they keep a position-based **X tail** (§4.4).
- **Debug, title-screen and `?system=` systems** are not. `spawnProceduralSystem(seed)` makes a system from any seed without giving it a galactic position (`main.js:2358-2370`), and naming then falls back to wherever the player happens to be (`:7603`). So two different seeds at one spot would get the same name, and one seed at two spots two names. **Decision (technical, made here):** these are **excluded from the galaxy-name guarantee** and named from **their own seed**, in a separate shape that cannot be mistaken for a galaxy address. Seed links keep producing the same contents. Tests: same position with different seeds gives different names; same seed at different positions gives the same name.

### 3.6 Tests, and the gate
- Stars exactly on **faces, edges and corners** of prisms, regions, sectors and slabs; **negative** coordinates; **y = 0**; coarse tiers (O, giants) across adjacent queries; the same star found by two neighbouring queries gets one box and one name.
- **Two stars with deliberately equal seeds** at different positions: clicking each on the map and in the list selects, warps to and arrives at the right one.
- **The gate:** no vocabulary approval (Phase 4) and no name switch (Phase 5) until these tests pass. Identity is built in Phase 1, before anything on screen changes.

---

## 4. The proposed address and name

### 4.1 The fixed hierarchy [I]
Every level is plain arithmetic on position (§3.1), independent of where you are or how you got there:

```
SECTOR      2 kpc square (edges at 1.00390625 kpc + k × 2 kpc)            → a sector word
  REGION    the sector's 16×16 grid, 125 pc                                ┐ together: a
    PRISM   the region's 16×16 grid, 7.8125 pc (a full-height column)      ┘ column word
      SLAB  a 100 pc height band: N1, N2 … above the plane, S1, S2 … below
        STAR  tier token + slot number (§3.3)
```

Each screen draws exactly one row of this ladder.

**Grid references, one direction everywhere [I, matches V].** Letters run left to right with increasing X. **Numbers run top to bottom, row 1 at the largest Z**, which is how the existing drill already counts rows (`NavComputer.js:4657`: row 0 is at the view's top, `centre.z + extent`). The same rule applies on GALAXY (A–S, 1–19), SECTOR and REGION (A–P, 1–16), and one conversion function is used for drawing, picking, labels and names. With it, **Sol's sector is N10** and the galactic centre's is **J10** (the 19 rows are symmetric, so Sol is row 10 either way; draft 3's "M9" was an off-by-one in the example script).

**Name shape (recommended, decision 2 A):**

```
<Sector word> <Column word> <Slab> <Tier>-<Slot>
Thessa Korabi N1 M-955
```

- **Same first word = same sector = same GALAXY cell.**
- **Column word = region syllable + prism syllable.** Columns in the same region share their first syllable, so neighbours sound related.
- **Slab = height.** "N16" means 1.5 to 1.6 kpc above the plane.
- **Tier and slot = which star in the box.**

### 4.2 Corrections built into the shape [I]
- **Every tier gets its own token**: O, B, A, F, G, K, M, and **KG, GG, MG** for giants, so a K dwarf and a K giant in one box cannot both be "K-5". A test pairs every tier with every other inside one box.
- **Hyphen and zero-padding** (at least 3 digits): "M-042", never "M42" (a Messier object) or "K2" (a NASA mission). The hyphen also stops "O" being read as zero.
- **Column words from two separate syllable sets.** *(Changed in draft 4.)* Draft 3 used one shared set of 256 syllables for both halves and also rejected doubles such as "Korkor". Astra pointed out the arithmetic: 256 of the 65,536 pairs are doubles, so rejecting them leaves 65,280, too few for 256 prisms in each of 256 regions. **Fix:** a **region set** of 256 three-letter syllables and a separate **prism set** of 256, with no syllable in both (for example, the first set starts with a consonant and the second with a vowel). Then no column word can be a double, every one of the 65,536 pairs is distinct, and each word splits only one way. **All 65,536 column words are screened exhaustively** (not by sample) for distinctness, real names and bad joins. The mapping is frozen once shipped.
- **Sector words are one token** (no spaces), unique across the table, with a test.

### 4.3 Worked examples [V numbers, I words]
Grid references from `onecell/e2-examples-rowsfromtop.mjs`, which ran the real `HashGridStarfield` (seed `well-dipper-galaxy-1`) on the option D grid with the row rule above. The words are placeholders. **The slot numbers are placeholders too** (§3.3); the canonical mapping will change them.

| Where | Address (numbers) | Example name |
|---|---|---|
| Red dwarf beside Sol's column (8.005, 0.050, 0.027 kpc) | Sector N10, region I8, prism A14, slab N1 | **Thessa Korabi N1 M-955** |
| Orange dwarf, same column | same | **Thessa Korabi N1 K-1538** |
| Sun-like star 1.55 kpc above Sol (Sol's own column) | Sector N10, region H9, prism P1, slab **N16** | **Thessa Lunvex N16 G-413** |
| Inner galaxy, R ≈ 1.5 kpc | Sector K10, region B1, prism J14, N1 | **Kethra Virosa N1 M-693** |
| Outer disk, R ≈ 12 kpc | Sector E6, region P9, prism P14, N1 | **Oriel Lumaye N1 M-6295** |
| Real or catalogue star | Name unchanged; the label shows its address | "Sirius · Thessa Korabi N1" |

Stars in one 100 pc slab of these columns [V, headless]: Sol-side N1 304 · inner N1 5,652 · outer N1 99 · Sol N16 (halo) 69 · rim (R ≈ 16, sector J2) N1 15.

### 4.4 Name lengths and the exceptions [I, widths V]
- **Ordinary procedural name:** head (sector ≤ 7 + column 6 + slab ≤ 3, with spaces) is **at most 18 characters**; with the tail (≤ 6, "M-7451", "KG-011") **at most 25** inside the nav's ±3 kpc.
- **X tails are longer, and the 25-character limit does not cover them.** A position inside a 7.8125 × 100 × 7.8125 pc box at July's 4e-6 kpc step needs ~95 billion codes, so at least 8 base-36 characters: "X-" + 8 = **10 characters**. They are rare (feature-centre systems only).
- **Authored names** (real stars, KnownSystems, the 48,000 catalogue names) have their own lengths and **never** take the procedural shape.

### 4.5 A bounded naming area *(Changed in draft 4; technical, decided here)*
Draft 3 let the grid run forever with a finite "far" word set. Astra pointed out that a finite set cannot name an unbounded grid uniquely. **Fix [I]:**
- **All 361 squares of the 19×19 grid get hand-reviewed sector words** (the 293 drawn ones plus the 68 corners). The grid spans ±19 kpc, which contains everywhere the hash grid makes stars: it rejects any cell whose centre is beyond R = 18 kpc (`HashGridStarfield.js:684`, R measured in the disc plane) [V].
- **Slab numbers** are allowed up to three digits (N999/S999, ±99.9 kpc). Phase 1 confirms the largest height any tier can actually produce sits well inside that.
- **Anything outside that area** has no procedural stars. A non-grid object out there (for example a feature-centre system in a distant globular cluster) gets a distinct fixed-length "far" code, which is unique by construction.
- **What this does not do:** it does not make stars appear around distant clusters, and it does not make far slabs selectable on the ±3 kpc segment bar. Out-of-range objects show their address in the label and detail text; the bar shows an "above" or "below" mark at its end.

---

## 5. How the plan keeps the July rules

The precedence chain does not change: KnownSystems, then real names, then the 48,000-name catalogue, then procedural. **Only step 4 changes.**

| July rule (source) | How this plan keeps it |
|---|---|
| **Unique by construction, no registry** (ac5 item 1) | Each star has one owning box (§3.1). Two stars in different boxes differ in a head token; two in the same box have different (tier, cell) slots, because one slot makes at most one star [V `HashGridStarfield.js:651-735`]. Tier tokens are distinct, slot numbers are a fixed mixed-radix count, and every token splits only one way. Debug and `?system=` systems are outside this guarantee and named by their own seed (§3.5). |
| **Same star, same name forever, on every path** (item 1, D5) | The name is a pure function of the star's identity (§3.2), never of which query found it. The grid, offset, cuts, slab height, tier cell sizes, slot order, tokens and vocabulary become **frozen constants**, pinned by a golden-names test of ~50 stars, including edge and corner stars. **The one exception:** the switch renames every procedural star **once** (decision 1). Nothing durable stores names, so no save or link breaks [V `Settings.js:112`, `ShipCameraSystem.js:514-522`, `flightModes.js:664-681`, `main.js:5558-5571`]. |
| **No fallback when a position is missing** (D5) | Kept; the namer still throws (`NameGenerator.js:444-451`). |
| **Real names win on every path** (D4) | Untouched. |
| **The 48,000 catalogue names keep working** | The position number L (`NameGenerator.js:261-264`) stays as the catalogue's lookup key; all 48,000 keys still match. |
| **Never output a real name, never let a name change contents** (item 2, §1.2) | The contents lookups match on the **exact** name (`RealSystemOverlay.js:156`, `:282-283`; `KnownSystems.js:135-152`). The new shape always has 4 tokens with N/S-plus-digits third; settled catalogue names are 1 token and Greek names 3, so the shapes cannot overlap (`injective.test.js:27-28`). A build-time check runs the new pattern against every lookup-key set (HYG names, companion table, exoplanet hosts, supplement bridge names, KnownSystems aliases) and must match zero. |
| **"Not every name has to become multi-part"** (Max) | Only *procedural* names become multi-part; settled, Greek and real names stay short. |
| **Survey designations** (Addendum ruling 1) and **catalogue-like core** (D1) | **Changed by this plan: decision 3.** |
| **Use the grid-cell identity** (Addendum ruling 1) | Done, and now carried through the whole game (§3). |

---

## 6. Every screen and every entry path obeys the rule [I]

- **Every grid is locked to the world, not to the view.** SECTOR and REGION keep **free panning**; a pan slides the fixed cells across the glass and never re-cuts them. Cells of a neighbouring parent are dimmed.
- **Drill goes to the fixed cell under the pointer.** Drawing and picking use the same function, so a drawn cell can never point somewhere else.
- **Edge labels on every grid** (GALAXY A–S × 1–19, SECTOR and REGION A–P × 1–16), replacing design 1's ids on the 8 densest tiles (`designs.js:1158-1173`). Hover shows the cell's word.
- **The default REGION view snaps** to the fixed region containing the player.
- **PRISM shows exactly one fixed column**, 7.8125 pc wide everywhere. **WASD clamps at the column edge**; to step sideways, go up to REGION and pick the next column, so the column word never changes underneath you.
- **Zoom is no longer tied to column width.** Zoom radius 0.0015 kpc up to `max(0.01 kpc, 2 × column width)` = 0.015625 kpc, replacing `max(0.003, …)` (`NavComputer.js:1188`, `:4678`, `:4704-4705`).
- **Every way into PRISM uses the same two functions** *(new in draft 4)*: "address → view" (what a screen shows for a sector, region or column) and "enter column". That covers the manual drill, Tab banking, the default view, and **the autopilot**. The autopilot's own 8×8 / 44 kpc grid (`AutopilotNavSequence.js:464-475`), its adaptive PRISM setup (`:312`) and its synthetic 0.01 kpc direct-entry view (`:352`, `:371`) are deleted and replaced by calls to those functions, so the hover and the destination are the same cell (`:233` vs `:244` today). Tests: animated and direct entry, row direction, the destination slab ready on arrival, an empty slab, and the selection after loading finishes.
- **"Here" means the player, not a list row** *(new in draft 4)*. Today "here" is the loaded row with your system's name, else **the nearest loaded row** (`state.js:1018-1027`; legacy `NavComputer.js:2052`), and that row's name overrides your real system's name. Once you can browse other columns, the nearest row is a stranger. **Fix:** the player's address is computed from the player's own position and identity, independently of what is loaded. **A column that is not the player's shows no "here" mark at all.** Distances in the list are measured from the player, not from the query's centre (today they are from the centre: `HashGridStarfield.js:728`, `NavComputer.js:3768`). Tests: browse a far column at your own height, an empty column, and a case where your star is not among the loaded rows.
- **Legacy look keeps working** *(new in draft 4)*. Its new segment widget is still a follow-up, but its grids (`NavComputer.js:1634`, `:1654`) share the same picking and drilling, so in Phase 2 they draw the fixed grid too. Otherwise a legacy cell could send you somewhere else.
- **Design changes go into the lab first** *(new in draft 4)*. `designs.js` is generated from `nav-240p-lab.html` by `scripts/extract-nav-designs.mjs` (`designs.js:2`; ownership documented in `docs/FEATURES/handoff-2026-09-07-nav-screens-close-pass.md:255`). Every drawing change in this plan is made in the lab file, regenerated, and checked with the extractor's `--check`; an edit to `designs.js` alone would be lost at the next extraction.
- **What you will notice:** smaller GALAXY cells and the bulge as one cell; 256 cells on SECTOR; Sol's PRISM column sparser (~300 stars per slab against ~2,000 in today's wider window); dense inner columns, empty rim columns.

---

## 7. Segments and the nav controls

### 7.1 Naming slabs and bar bands (decision 4) [I]
- **Naming slab (decision 4, permanent):** recommended **100 pc**. It matches the loader's existing step (`NavComputer.js:3853-3884`), stays well under the guard that silently drops M dwarfs from queries taller than ~0.44 kpc (`HashGridStarfield.js:661-662`), and reads as a height.
- **Bar bands (changeable later without renaming):** one cell per slab, 60 cells across ±3 kpc, coloured thin/thick/halo. *(Draft 3's decision 5; now in "going ahead unless you object".)*
- **The bar obeys the rule:** each bar cell is exactly one slab.

### 7.2 One layer function [V thresholds, I sharing]
`prismNumbers` already prints THIN under 0.3 kpc, THICK under 1.0, otherwise HALO (`designs.js:2183`). One shared function uses those thresholds for both the bar colours and the readout: N1–N3 thin, N4–N10 thick, N11 and up halo.

### 7.3 The segment bar, and the fine gauge after a jump (decision 7) [I, layout V]
- **Design 1:** a new column beside the ±2 pc fine gauge; the map gives up 6 texels (`designs.js:822-828`). 60 cells on 216 texels is ~3.6 texels each: drawable, but whether it is comfortable to hit is for your UAT at real resolution. The current slab and layer show in the rail block (`:1946-1948`) as "N16 · HALO".
- **Design 2:** the gauge is at x = W−20 (`designs.js:3117`) and the minimap occupies W−44 to W−20 (`:3092`), so a new column just left of the gauge **would land on the minimap**. **Fix (technical):** the minimap moves left by the bar's width, and every widget gets its own non-overlapping paint and click rectangle (the gauge's click area today adds one texel each side, `index.js:1121`, so two adjacent widgets' click areas would overlap). The slab token replaces the height and layer clauses in the bottom bar (`:2888-2891`).
- **Design 2's list mode:** today the gauge is not drawn in list mode (`designs.js:3034`). **The segment bar is drawn in list mode too**, because changing slab is exactly what you want while reading a list; the fine gauge stays map-only.
- **Behaviour:** current slab lit, loaded mid-tone, unloaded dim, empty slabs marked. Click jumps to a slab's middle; drag moves the highlight and loads on release. R/F unchanged, with the 100 ms per-frame cap (`NavComputer.js:44`, `:1371`).
- **The problem Astra found with the fine gauge.** Today the ±2 pc gauge is centred on **your ship's height**, not on where you are looking (`designs.js:2211`, `:2220`), and dragging it clamps to your ship ±2 pc (`index.js:1136`). So if you jump to N16 with the bar and then grab the fine gauge, you are **thrown back to your ship's height**, 1.5 kpc away. That is decision 7:
  - **A (recommended): the fine gauge follows where you are looking.** After a jump it is centred on the view's height and fine-adjusts there. Your ship is shown as a mark at the gauge's edge (an arrow) whenever it is out of range. One rule: bar = big jumps, gauge = small moves, both around what you see.
  - **B: the fine gauge stays tied to your ship.** It keeps its current meaning, but after any jump grabbing it pulls you home. Simple, but surprising.
  - **C: drop the fine gauge**; use the bar for jumps and R/F for fine movement. Less on screen, but it removes a control you approved.
- **Tests:** every bar cell hit, shared boundaries between widgets, drag release, leaving the canvas mid-drag, switching views mid-drag.
- **Y range:** the bar spans ±3 kpc, matching the loader; the "Y RANGE" readout uses the same constant.
- **Code constraint:** `NavComputer.js` is held at 4,711 lines (`:156`). The grid, identity and segment logic go in **new modules**; NavComputer gets call-site changes only.

### 7.4 Names in the nav lists [V widths, I fix]
Nav text is cut **from the right** today (`navPixelType.js:146-151`, `designs.js:399`), which cuts exactly the part that identifies a star. Design 1's PRISM list allows **12 characters** (`designs.js:1928`); design 2's name column is 119 texels, ~19 characters (`:3177`). Design 1's location field is 17 characters (`:847`). And the cockpit's `fitDesignation` drops words from the front but, as a last resort, **cuts the final word** (`cockpit/designation.js:56`), so draft 3's "never cut a token" was not true of the code it cited.

**Rules (namespace-aware) *(changed in draft 4)*:**
- **Procedural address names in PRISM rows show only the tail** ("N16 M-7451", ≤ 10 characters); the column's head ("THESSA KORABI") is drawn once as a list header, since every procedural star in the column shares it.
- **X tails:** a procedural row with an X tail would need up to 14 characters ("N16 X-…" + 8), more than design 1's 12. In design 1 those rows show the 10-character X tail alone; the slab is on the bar and in the detail.
- **Real, KnownSystems and catalogue names are never turned into a tail.** They show their own name. If one does not fit, it is shortened with a visible cut mark so a shortened name can never look like a different complete name; the full name is in hover and detail.
- **Elsewhere, procedural names are shortened by dropping whole words from the front.** Characters are never cut from the end.
- **A displayed (possibly shortened) string is never used as an identity or a contents-lookup key.**
- **Layout test:** the longest ordinary name, an X name, a far address, a one-word catalogue name, a Greek name, a real designation and a component suffix, in every nav field in both designs. It fails on any cut-off token.

### 7.5 The "where am I" label [I]
- Shows **where you are**, not what you are browsing: `M-955 · [sector colour]THESSA [column colour]KORABI [slab colour]N1`; for a named star, `SOL · …`.
- **Each part uses the ink of its map highlight** (GALAXY cell, REGION cell, lit bar cell). A repeating 2 × 2 colour pattern on the uniform grid keeps neighbours different.
- **Design 1:** the 14-cell `hereName` slot and the 17-cell sector slot ("THESSA KORABI N1" is 16) (`designs.js:844-847`). **Design 2:** the top-bar locator (`:2787-2790`).
- **One resolver** returns address and colours for both the label and the highlights, and it reads the player's address from §6's player resolver, never from loaded rows.

---

## 8. Loading and performance (a hard requirement) [I unless marked]

**Acceptance line:** an in-browser trace shows **no main-thread task over 50 ms**, at an inner-galaxy column (R ≈ 1.5 kpc), at Sol, **and at the original failing location (XIGMAG-2AE101G)**, with the cockpit's nav instance open as well, covering:
- **cold** entry to PRISM (first time after load) and warm entry;
- rapid slab changes on the bar, including **cancelling** a slab mid-load;
- a slab replaced by another with the same number of stars;
- all six PRISM sort modes (`state.js:245`);
- **leaving PRISM** (the walk saw a ~1.5 s hitch there once).

**Today [V]:** entering PRISM loads the whole ±3 kpc column in about 30 synchronous steps (`NavComputer.js:3854-3884`). The query sorts its whole result in one go (`HashGridStarfield.js:740`); then the nav copies every row, works out multiplicity and re-sorts all rows (`state.js:993`, `:1008`); then the map projects every loaded row (`designs.js:3038`).

**New loader:**
- **Load the slab you are looking at first**, then the slabs above and below while idle; unload far slabs.
- **A time limit, not a cell count.** Draft 3 budgeted a fixed number of cells per frame. A cell count does not bound time across locations, cold starts or slower machines. The loader instead **works until a deadline (≈ 8 ms per frame), stops, and resumes next frame where it left off**. The starfield generator already has elapsed-time yielding (`HashGridStarfield.js:290`) and frame-aligned scheduling (`:92`) to build on.
- **Everything after the query is budgeted too**: naming, real-star replacement, multiplicity, merging into the list, sorting and publishing. Draft 3's "append, never re-sort" conflicted with a sorted list; instead each arriving slab is sorted on its own and **merged** into the sorted list in budgeted steps, so the chosen sort order is kept.
- **Cancellation:** each slab request carries a generation number; if you jump elsewhere, stale work is dropped at the next check, and that cancel step is itself inside the 50 ms line.
- **An explicit data revision number** is published with each change, because today's cache checks the array and its length (Astra), so swapping one slab for another of the same size could leave stale rows on screen.
- **Cost per slab [V]:** 13,680 cell visits for a 7.8125 × 100 pc slab, the same everywhere. **[A]** 7,834–8,964 density calls and 5.9–15.6 ms warm headless at six radii.

**Correctness fixes that come with slab loading:**
1. **Real-star replacement, decided by identity, not by load order** *(changed in draft 4)*. Today a real star replaces the nearest procedural star **among the rows already loaded** (`NavComputer.js:3779-3815`): it queries real stars only inside the current volume (`:3779`), searches only loaded rows (`:3794`), and a name key stops later passes (`:3788`). So which procedural star is replaced can depend on what loaded first, and a real star near a column edge can have its twin in the next column, which a height-only margin (draft 3) cannot reach. **Fix:** for each real star, its twin is chosen from a **full 3D neighbourhood** (all directions, across column and slab edges), generated directly from the hash grid regardless of what is loaded, with ties broken by identity order. The result is a **suppression list keyed by identity**, separate from the display rows, so the same procedural star is hidden whatever order slabs load or unload in. Catalogue positions and KnownSystems membership are kept. Tests: adjacent columns and slabs loaded in both orders, unload and reload, two real stars competing for one twin.
2. **`_loadedSeen`** becomes identity-keyed and is cleared per slab on unload, so an unloaded slab can reload.
3. **"Here"** is handled by §6's player resolver, so it no longer needs the player's slab pinned in the list.

**Bright-star defect [V]:** the query drops O and giant stars whose cell centre is outside the box but whose star is inside it (`HashGridStarfield.js:679-681`). The fix lands with the loader, and its corrected query is benchmarked in Phase 0.

**Phase 0 (measure before freezing) [I]:** at the original failing location, record for each nav instance the **exact query bounds, the loop count per tier, the number of density calls, and the elapsed time**, **with and without the profiler running**; repeat the identical query headless. Then benchmark a corrected 7.8125 pc slab at the inner galaxy and at Sol. If one slab cannot be sliced under the 50 ms line, decision 0 is reopened before anything is frozen.

---

## 9. Everything that depends on a name, an identity or the sector table

| Place | Risk | Handling |
|---|---|---|
| **Call sites of the namer.** `generateSystemName(rng, pos)` takes no identity today (`NameGenerator.js:443`) | Every caller must pass the identity | Nav pick `main.js:6137`; sky-click `:14306`, `:14327`; screensaver `:14379`, `:14393`; spawn `:7604`; title/`?system=` `:7603`, `:5570` (seed-named, §3.5); nav rows `NavComputer.js:3759`, `state.js:573`; scripts `gen-named-systems.mjs`, `name-census.mjs`. Nav rows keep a separate `tier` field, because the real-star merge overwrites `spectral` (`:3812-3815`). |
| **Seed-keyed lookups** (§3.4) | Wrong star clicked or warped to | Switched to identity in Phase 1. |
| **Procedural teleports** (`main.js:8295-8354`) | Today a teleport sets the player at the requested spot, takes context from there (`:8300`), borrows the nearest grid star's seed (`:8315`), and re-rolls the star type unless it is a real star (`:8336`, `:8354`). So it can differ from warping to the same star, not just in name | **Route procedural teleports through the shared arrival resolver** (`arrivalResolution.js:54`) with the chosen star's identity, position, type and seed. Test: preview, teleport and warp to the same star give the same name and contents. KnownSystems and real-star precedence kept. |
| Warp target → arrival (`main.js:6137` → `:6658` → `:7601-7604` → `:8051`) | Works if all callers share one function | One function; a test checks nav-row name = arrival name on every targeting path. |
| **Contents lookups** (`arrivalResolution.js:54-93`, `main.js:6751-6760`) | A collision would give a procedural star real planets | Shape disjointness plus the build-time key check (§5). |
| Nav "here" and the self-warp guard (`state.js:1018-1044`, `navViewModes/index.js:882`) | Wrong "here" in a foreign column | Player resolver (§6). |
| **Readers of today's 775-sector table and grid sizes** | Under option D the table is replaced | `NavComputer.js:141`, `:1183`, `:4636-4646`; `picking.js:181-187`; **`picking.js:62` (`gridNFallback`, also imported by `state.js:117`)**; `state.js:966-979` (`sectorRows`: 361 rows, 293 drawn); `navViewModes/index.js:929` (64 → 256 cells); **`designs.js:579` (SECTOR subdivision), `:1844` and `:1866` (64-cell counts)**; `designs.js:1033-1107`, `:2942-2947`; **`navViewModes/geometry.js:45` (repeats map and gauge geometry)**; `NavComputer.js:71-73` (`gridNForLevel`: SECTOR 8 → 16); **legacy grids `NavComputer.js:1634`, `:1654`**; **autopilot `AutopilotNavSequence.js:233`, `:244`, `:312`, `:352`, `:371`, `:464-475`** (§6). |
| **The lab file** `nav-240p-lab.html` | `designs.js` is generated from it | Every drawing change is made in the lab and regenerated; extractor `--check` must pass (§6). |
| Tests | Pinned old values fail | **Each phase updates the tests it breaks, in that phase.** Phase 2: `navViewModes.test.js:83` and `navPicking.test.js:793` (775 sectors), GALAXY cell counts. Phase 5: `NameGenerator.injective.test.js` (`:25-37`, `:148-173`), `scripts/gen-named-systems.mjs:63`, `scripts/name-census.mjs`, baseline `tests/baseline/known-failures.json:210` (re-recorded deliberately). |
| Warp-tunnel pattern seeded from the name (`main.js:348`, `:10347-10348`) | Each tunnel looks different after the switch | Cosmetic; accepted. |
| Sector names in the nav (`GalacticSectors.js:207-235`, `state.js:966`) | Become the sector words | Also fixes today's 319 duplicates. |
| Cockpit name fitting (`cockpit/designation.js:46-56`) | A focused star may show "N1 M-955" | Truthful but short. The cockpit nav redesign (follow-up) handles it properly. |
| Planet and moon names embedding the system name | Get long | Front-drop fitting covers panels; the planet-name fix is its own follow-up. |

The whole-tree search found no production system outside the nav and the autopilot that reads the sector table [V, Astra and draft 3].

---

## 10. Build order

This spans several systems, so it gets a `dev-collab-scope` contract (`intent.md` + `contract.json`) before any code, and each phase is verified with `verify-workstream`. You do the UAT. *(Draft 4 merges draft 3's Phase 2 and the geometry half of Phase 3 into one milestone, adds identity to Phase 1, and moves each test change into the phase that causes it.)*

| Phase | What gets built | What you can see or check afterwards |
|---|---|---|
| **0. Ground truth and scope** | Browser measurement at the failing location, with and without the profiler (§8): bounds, loop and density-call counts, time, both nav instances. Corrected-slab benchmark at the inner galaxy and Sol. Your decisions recorded. Contract written. | A plain answer to "what actually costs 3 s", and whether option D's slab can stay under 50 ms. |
| **1. The fixed grid and star identity (the gate)** | Grid module with the exact constants (§0.4), half-open boxes and slabs (§3.1), the one row direction (§4.1). Generator returns identity; it is carried through rows, picking, selection, de-duplication and warp transport, replacing every seed lookup (§3.4). Seed-named debug/`?system=` systems (§3.5). Slot mapping including coarse tiers (§3.3). Placeholder sector ids. Tests: faces, edges, corners, negatives, y = 0, coarse tiers, equal seeds; round trip; injectivity. | Little visible change. **Two equal-seed stars can no longer be clicked as each other.** A lab readout of addresses for sample stars. |
| **2. One cell = one place, on every screen and every entry path** (designs 1 and 2, made in the lab file; legacy grids kept correct) | GALAXY 19×19 grid; world-locked 16×16 SECTOR and REGION with neighbours dimmed; edge labels; drill to the fixed cell; default REGION snap; **PRISM = one fixed 7.8125 pc column**, WASD clamp, zoom limits; **autopilot through the same address → view and enter-column functions**; **player resolver for "here"**; every reader of the old table switched (§9); the 775-sector tests rewritten. | **Click any cell on any screen and land in exactly that place; drag, and the cells stay the same places; the autopilot drills to the same cells you would.** |
| **3. Slab loader and segment bar** | Deadline-based, resumable, cancellable loader budgeting naming, merge, sort and publish; data revision number; identity-based real-star replacement; bright-star fix. Segment bar (click, drag, list mode in design 2), fine-gauge rule (decision 7), minimap moved, shared layer function and Y-range constant. **The 50 ms acceptance test (§8).** | **Mid-plane to 2 kpc in one click, and no main-thread task over 50 ms entering, browsing, cancelling or leaving PRISM.** Your main pain point is fixed before any renaming. **Option D is confirmed or reopened here.** |
| **4. Vocabulary** (only after Phase 1's identity tests and Phase 3's performance test pass) | 361 sector words (crisp in the core, soft on the rim), two separate 256-syllable sets, all 65,536 column words screened exhaustively, plus real-name, constellation and profanity screens. | An Artifact review page: you approve or reject every sector word and samples of column words. |
| **5. Name switch** | The procedural step spells out the address. Namer call sites (§9). Teleports through the arrival resolver. Build-time lookup-key check. Namespace-aware list rules and the layout test (§7.4). Name tests rewritten, baseline re-recorded. | Nav rows and arrivals read "Thessa Korabi N1 M-955"; real names untouched; teleport, preview and warp agree. |
| **6. Where-am-I label** | One resolver for address and colours, used by the label and the map highlights. | Each part of the label matches its highlighted cell. |

**Follow-ups (separate contracts):**
- **the cockpit (diegetic) nav redesign**, which you ruled comes after this one; it will also handle procedural names on cockpit panels;
- the legacy look's segment bar (its grids are kept correct in Phase 2);
- planet and moon names seeded from the star's address, not the warp counter (`main.js:6644-6645`, `:7568`). Changing system names does **not** fix those;
- search by sector or column word.

**Elsewhere (nav-restorations batch or the SYSTEM-screen contract, §1.1):** the legend row removal, one search row per destination, the GPS line in every mode.

---

## 11. Risks and unknowns

- **[A/V] The stall's cause is narrowed but not explained.** The time is in the star query, not the list (§2.8). Phase 0 measures like for like before the grid freezes.
- **[I] A frozen grid means frozen names.** Any later change to the grid constants, cuts, slab height, tier cell sizes, slot order, tokens or vocabulary renames every procedural star; the golden-names test makes such a change loud.
- **[I] Identity work touches the click → warp path.** It is the right fix for a real wrong-warp risk, but it changes code you have already walked; Phase 1's equal-seed test and the warp-path test guard it.
- **[I] Smaller GALAXY cells** (11 texels against 27); readable through edge labels and hover.
- **[I] Uneven stars per column**: ~6,000 per inner slab, ~15 on the rim, often zero high above the rim. Loading work is the same; list length is not.
- **[I] The bulge is one sector.**
- **[I] A 3.6-texel bar cell** is drawable; whether it is comfortable to hit is your UAT.
- **[I] Generated words can be ugly.** The vocabulary is finite and fully screened, and you review it.
- **[I] Long planet names** (~25+ characters); front-drop fitting handles panels.
- **[I] The model's halo is heavy**, so high slabs near Sol are not empty.

---

## 12. How reviews were handled

### 12.1 Astra's review of draft 3 (draft 4)

| # | Finding (severity) | Handling |
|---|---|---|
| 1 | Star ownership not specified (blocker) | **Accepted.** New §3: half-open boxes, identity carried end to end, coarse-tier slots, up-to-8-candidate recovery that refuses to guess; Phase 1 gate. |
| 2 | Seed-keyed picking, selection and de-duplication can pick the wrong star | **Accepted.** §3.4 table; equal-seed test. |
| 3 | `?system=` and title systems cannot be told apart by position | **Accepted.** Excluded from the galaxy guarantee and named by their own seed (§3.5). |
| 4 | Autopilot drills on its own grid | **Accepted.** Same address → view and enter-column functions (§6). |
| 5 | Pinning the player's slab does not fix "here" in a foreign column | **Accepted.** Player resolver; no "here" in foreign columns; distances from the player (§6). |
| 6 | Real-star replacement depends on load order | **Accepted.** Full 3D neighbourhood, identity-keyed suppression list (§8). |
| 7 | Performance evidence overstated (60-fold, constant work 12,485) | **Accepted.** Count corrected to 13,680; 60-fold claim withdrawn; Phase 0 records bounds, counts and time, with and without the profiler (§2.8, §8). |
| 8 | A cell budget does not bound task time | **Accepted.** Deadline-based, resumable, cancellable loader that budgets everything through publishing; wider acceptance test (§8). |
| 9 | Unbounded far naming | **Accepted.** Bounded 19×19 naming area plus a unique far code (§4.5). |
| 10 | Missed consumers, lab file, phase coupling | **Accepted.** §9 rows; lab-first rule (§6); Phases 2 and 3 geometry merged; tests move with their phase (§10). |
| 11 | Teleport naming alone does not make paths agree | **Accepted.** Teleports through the shared arrival resolver (§9). |
| 12 | Constants rounded; grid references off by one | **Accepted.** 7.8125 pc and 1.00390625 kpc pinned; one row direction; Sol is N10 (§0.4, §4.1, §4.3). |
| 13 | Rejecting doubled syllables breaks 65,536 | **Accepted.** Two separate syllable sets; exhaustive screen (§4.2). |
| 14 | Segment bar vs fine gauge meaning and design 2's minimap | **Accepted.** Minimap moved, separate click areas, bar in list mode; gauge meaning is decision 7 (§7.3). |
| 15 | Length and cut rules ignore X, catalogue and real names | **Accepted.** Namespace-aware rules; X rows and authored names excepted; display strings never used as keys (§4.4, §7.4). |

### 12.2 The draft 2 critique (kept for the record; section numbers are draft 2's)

All 17 points were accepted or mostly accepted: distinct tier tokens; names fitting the lists; survey names as a decision; a lattice fixed in the nav; slab height as a permanent decision; one layer function; per-frame budgeting (now replaced by a time deadline, §8); zoom decoupled from width; slab-loading correctness fixes (now reworked, §6, §8); no seed-keyed name cache (now extended to all seed lookups, §3.4); full call-site list; coverage past R = 18 (now a bounded area, §4.5); unambiguous syllables (now two sets, §4.2); a stronger alternative name shape; scope trimmed to follow-ups (bright-star fix and Sol offset kept); hyphenated, padded tails; one Y-range constant.

---

## 13. Decisions for you

> **RULED 2026-10-02 — Max: "go with recs".** D0 = D (provisional until Phase 3's in-browser test), D1 = yes, D2 = A,
> D3 = A (drop survey names), D4 = 100 pc, D7 = A (fine gauge follows the view). The "going ahead" list below stands.
> Max also: stay in this session, build with workflows, use Astra as checker / second opinion / tester.

Only what needs you. Decision numbers are kept from draft 3 so earlier references still work; decisions 5, 6 and 8 moved to "going ahead" below.

0. **How the galaxy is cut into sectors.** **Recommend D** (uniform 2 kpc sectors → 16×16 regions of 125 pc → 16×16 columns of 7.8125 pc), **provisionally**: it is confirmed only when Phase 3's in-browser test passes; if a slab cannot stay under 50 ms, this reopens before any name is frozen. You lose chunky GALAXY cells (27 → 11 texels) and equal stars per sector. The alternative, C, adds a ZONE screen to keep big cells everywhere at the cost of one more click and the largest code change.
1. **Rename every procedural star once.** July's "same name forever" is broken exactly once, then holds again. No save or link breaks. **Recommend: yes.**
2. **Name shape.** **A:** sector word + column word, "Thessa Korabi N1 M-955" (sayable; neighbours sound alike). **B:** sector word + grid reference, "Thessa I8A14 N1 M-955" (only the sector words need review, but more letters and numbers). **Recommend A**, with the grid reference shown on hover and the map edges.
3. **Survey-style names** (your July ruling: "like real astronomy designations"). **A:** drop them; one Elite-style shape, with the core's feel carried by crisp sector words. **B:** keep a survey variant in core sectors. **Recommend A.**
4. **Naming slab height (permanent).** **Recommend 100 pc** (N1–N30 and S1–S30 inside ±3 kpc).
7. **What the fine ±2 pc gauge means after you jump with the segment bar.** Today it is tied to your ship, so after jumping to N16 grabbing it throws you back 1.5 kpc. **A:** it follows where you are looking, with your ship shown as an edge mark when out of range. **B:** it stays tied to your ship. **C:** remove it. **Recommend A.**

**Going ahead unless you object:**
- the star identity work (§3) before any name is frozen, including no "here" mark on a column that is not yours;
- PRISM is one fixed column; WASD stops at its edge; zoom can always pull back past it (was decision 6);
- the segment bar has 60 one-slab cells coloured thin/thick/halo, sits beside the fine gauge, and also shows in design 2's list mode; design 2's minimap moves left to make room (was decisions 5 and 7's layout half);
- the grid is shifted so Sol and the galactic centre sit mid-prism (was decision 8, now part of decision 0);
- edge labels on every grid; one row direction (row 1 at the top);
- debug, title-screen and `?system=` systems are named by their own seed, outside the galaxy-name guarantee;
- the naming area is the 19×19 grid (361 reviewed words) plus a unique far code beyond it;
- two separate syllable sets for column words;
- procedural teleports go through the same arrival code as warps;
- performance acceptance as in §8;
- real and catalogue names are never shortened into a procedural tail;
- the cockpit nav redesign, legacy segment bar, planet names and search-by-word are follow-ups; the legend row, search duplicates and the GPS line belong to other contracts (§1.1).

---

## 14. Changelog

**Draft 4 (2026-10-02): Astra's review and your rulings.**
- **New §3, star identity.** Every star has exactly one owning box (half-open on every axis, defined at y = 0 and for negatives) and one identity (tier + generating cell) carried through queries, picking, selection, de-duplication, warp transport and naming. Every seed-keyed lookup is replaced. It is a gate before vocabulary or names. **Why:** without it a star on an edge can get two names, and two stars with the same seed can be clicked as each other and warped to wrongly (Astra's blocker and finding 2, confirmed in code).
- **Debug, title and `?system=` systems** are named by their own seed, outside the galaxy guarantee (§3.5). **Why:** position alone cannot tell them apart.
- **Autopilot** routes through the same address → view and enter-column functions (§6). **Why:** it drills on its own 44 kpc grid today; draft 3 described it wrongly.
- **"Here"** is computed from the player, not from list rows; foreign columns show no "here" (§6).
- **Real-star replacement** is decided over a full 3D neighbourhood by identity, independent of load order (§8).
- **Performance (§2.8, §8):** loop count corrected to 13,680 (draft 3's 12,485 came from a formula that did not match the code); the "60-fold" claim withdrawn; the loader is now deadline-based, resumable and cancellable, and budgets naming, merge, sort and publishing; the acceptance test now covers cold entry, cancellation, equal-size replacement, all sort modes, both nav instances and leaving PRISM, at the original failing location too; Phase 0 records exact bounds, counts and timing with and without the profiler.
- **Bounded naming area (§4.5):** 361 reviewed sector words for the whole 19×19 grid and a unique far code beyond, replacing the unbounded "far" word set.
- **Exact constants:** 7.8125 pc and 1.00390625 kpc. **Grid references fixed:** one row direction (row 1 at the top, as the drill code already counts); Sol's sector is N10 (was "M9"); all worked examples recomputed; the example slot numbers are marked as placeholders.
- **Syllables:** two separate 256-sets instead of one shared set with doubles rejected (which only gave 65,280 words); all 65,536 screened exhaustively.
- **Segment bar (§7.3):** design 2's minimap collision and overlapping click areas resolved; bar shown in design 2's list mode; the fine gauge's meaning after a jump is the new decision 7.
- **Name lengths (§4.4, §7.4):** X tails (10 characters) and authored names are excepted from the 25-character and tail-only rules; real and catalogue names are never shown as tails; displayed strings are never keys; draft 3's claim that `fitDesignation` never cuts a token corrected.
- **Teleports** go through the shared arrival resolver, not just a renamed label (§9).
- **Missed consumers added (§9):** `designs.js:579`, `:1844`, `:1866`; `picking.js:62`; `geometry.js:45`; legacy grids; the two 775-sector tests; the full autopilot path; and the rule that drawing changes go into `nav-240p-lab.html` first.
- **Build order (§10):** draft 3's Phase 2 and the geometry half of Phase 3 merged into one milestone; identity added to Phase 1; tests move in the phase that breaks them; vocabulary waits for both the identity and performance gates.
- **Your rulings (§1.1):** performance (in this plan); legend row removal, one search row per destination, the GPS line in every mode (other contracts); cockpit nav redesign after this one (follow-up).
- **Decisions (§13):** shortened to six. Decisions 5, 6 and 8 moved to "going ahead"; decision 7 now asks what the fine gauge means after a jump.
- **Sections renumbered:** draft 3's §3–§13 are now §4–§14 (identity inserted as §3). §0.4's option comparison is condensed. `docs/GAME_BIBLE.md` does not exist; Astra used `docs/ARCHIVE/GAME_BIBLE_LEGACY.md`.

**Draft 3 (2026-10-02): your one-cell-one-child rule.** Added §0 (the rule, an audit of every screen, four GALAXY options, option D recommended); replaced draft 2's 775-sector quadtree with a uniform 2 kpc grid; prism width the same everywhere; Sol and galactic-centre centring built into the grid; world-locked grids and edge labels; the 50 ms performance line; a table of sector-table readers; new Phase 2 (the grid on screen).

---

## Appendix: Evidence

### Code (branch `feature/world-engine-production-L1`)
- **Name precedence:** `src/generation/NameGenerator.js:443-472` (throw `:444-451`, catalogue `:461-462`); `src/main.js:6137`, `:14321-14324`, `:14388-14391`, `:7597-7598`, `:8356`; `arrivalResolution.js:54-93`; `docs/NAMING_AND_REAL_OBJECTS.md:271-277`.
- **Position locator L and catalogue key:** `NameGenerator.js:238-288` (constants `:261-266`), `:290-331`; `src/generation/data/namedSystemsCatalog.js:1-57`.
- **Procedural shapes:** survey `NameGenerator.js:396-401`; multipart `:405-410`; syllables `:333-352`.
- **Shape tests:** `NameGenerator.injective.test.js:25-37`, `:148-173`; `scripts/gen-named-systems.mjs:63`; `tests/baseline/known-failures.json:210`; `navViewModes.test.js:83`, `navPicking.test.js:793` (775 sectors).
- **Sectors:** `GalacticSectors.js:4-17`, `:44-73`, `:92-159`, `:207-243`.
- **Star identity and edges:** `HashGridStarfield.js:73-90` (tiers), `:216` (sky transport), `:651-735` (one star per tier-cell), `:657`, `:668` (loop extents), `:679-681` (bright-star drop), `:684` (R ≤ 18 kpc), `:717-724` (edge offsets, inclusive filter), `:728` (distance from query centre), `:729` (32-bit seed), `:731` (records without cell), `:740` (whole-result sort), `:290`, `:92` (existing yielding and scheduling).
- **Seed-keyed lookups:** `navViewModes/index.js:496`; `picking.js:271`; `state.js:571-574`, `:611`, `:1031`; `NavComputer.js:3755`.
- **"Here":** `state.js:1018-1027`; `NavComputer.js:2052`, `:3697`, `:3768`.
- **Real-star merge:** `NavComputer.js:3779-3815`.
- **Spawns and teleports:** `main.js:2358-2370`, `:5571`, `:7603`, `:8295-8354`; `flightModes.js:667`; `arrivalResolution.js:54`.
- **Autopilot:** `AutopilotNavSequence.js:233`, `:244`, `:312`, `:352`, `:371`, `:464-475`.
- **Grid consumers:** `NavComputer.js:71-73`, `:141`, `:1183`, `:1634`, `:1654`, `:4636-4672` (drill; row direction `:4657`); `picking.js:62`, `:181-187`; `state.js:117`, `:966-979`; `navViewModes/index.js:929`; `geometry.js:45`; `designs.js:579`, `:1033-1107`, `:1844`, `:1866`, `:2942-2947`.
- **Lab ownership:** `designs.js:2`; `scripts/extract-nav-designs.mjs`; `docs/FEATURES/handoff-2026-09-07-nav-screens-close-pass.md:255`.
- **Layout and widgets:** `designs.js:399`, `:822-853`, `:1158-1173`, `:1928`, `:1946-1948`, `:2180-2186`, `:2205-2221` (y-gauge on player Y), `:2787-2790`, `:2860-2891`, `:3034` (list mode), `:3038`, `:3092` (minimap), `:3117` (gauge), `:3177`; `navViewModes/index.js:1121-1141`; `state.js:245` (sort modes), `:993`, `:1008`.
- **Text fitting:** `navPixelType.js:146-151`; `cockpit/designation.js:9-20`, `:46-56`.
- **Density:** `GalacticMap.js:770`, `:843-872`.
- **No durable name storage:** `Settings.js:112`, `:161`; `ShipCameraSystem.js:514-522`; `flightModes.js:664-681`.
- **Two nav instances:** `main.js:4700`, `:5895`.

### Measurements (`scratchpad/onecell/` and Astra)
- `a-quadtree.mjs`, `f-today.mjs`, `b-uniform.mjs`, `d-offset.mjs`, `c-prism.mjs`: as in draft 3.
- `e2-examples-rowsfromtop.mjs`: §4.3 grid references with row 1 at the top (Sol N10, centre J10).
- **13,680** loop iterations per 7.8125 × 100 pc slab, from the production loop extents (Astra, confirmed by recompute). `g-cells.mjs` used a different formula and undercounts.
- **[A]** saved-trace attribution, density-call counts and warm timings in §2.8 and §8.

### Records
- `docs/WORKSTREAMS/naming-census-uniqueness-2026-07-07/ac5-decision.md`: items 1-6; Addendum ruling 1.
- `docs/NAMING_AND_REAL_OBJECTS.md`: §1.2, §6.
- `docs/WORKSTREAMS/nav-restorations-2026-09-20/UAT-walk-2026-09-30.md`: the PRISM stall, your one-cell rule, and the rulings in §1.1.
- `.astra/jobs/20261002-103745-naming-prism-plan-review/report.md`: Astra's review of draft 3.
- `docs/ARCHIVE/GAME_BIBLE_LEGACY.md` (there is no current `docs/GAME_BIBLE.md`).

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
