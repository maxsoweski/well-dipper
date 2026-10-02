# Plan: location-based star names and a segmented PRISM column

*Lane A, branch `feature/world-engine-production-L1`. Written 2026-10-02. This is a **plan only**: no code was changed and this file was not committed. It is the revised draft, with a critique folded in. Section 11 lists how each critique point was handled.*

**How to read the labels:**
- **[V]** = verified. Checked in the code (file:line given) or measured by a script running the real modules headless.
- **[I]** = inference or design proposal. Not built, not tested.

Scratch scripts behind the numbers are in `/tmp/claude-1000/-home-ax/e3bfb779-bd19-48ee-9c65-af3fc876407b/scratchpad/`: `plan-ex.mjs` (worked examples and segment loads), `cov.mjs` (sector coverage), `rev-cells.mjs` (cells per segment and warm timings), `geo*.mjs`, `prism-*.mjs`, `sec.mjs`.

---

## 1. The goal, in your words

You asked for three things:

1. **Names that mean something.** "I like the Elite approach of having readable syllables at the beginning, and naming stars … based on their galactic location." Real catalogue stars and the in-universe named systems keep their own names.
2. **A column you can move through.** Prisms "are very tall … right now you can just press R and F or drag the vertical slider but it takes minutes to go from one section to another." You want visible segments in the nav bar that you can click or drag to, with R/F kept for slow panning.
3. **A "where am I" label** that shows the sector and region you are in, coloured to match the map highlight.

You also asked that this not be "a new process slapped on". The July naming system took real work. **This plan keeps its whole precedence chain, every guarantee and the 48,000-name catalogue. It replaces only the last step: how a procedural star's identity is spelled out as text.**

**Why the three asks become one project [I].** A name can only carry a location if the galaxy has a fixed, permanent grid of places. That same grid is what a segment bar would show, what the label would read from, and what decides how many stars to load at once. So the plan builds that fixed grid once and uses it for naming, navigation and loading.

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

### 2.3 Sector names cannot be used as they are [V]
- There are 775 sectors but only 453 distinct sector names. 319 names repeat, in mirror-image pairs: (x, z) and (−x, −z) share a name. Sol's sector name "Tau Vela-94" is also used at (−8.5, −0.5). The file itself calls the naming a placeholder (`GalacticSectors.js:209`).
- The sector table does not cover everything:
  - It spans only x and z from −15 to +17 kpc (`GalacticSectors.js:100-103`), but stars are created out to R = 18 kpc (`HashGridStarfield.js:304`). In a sample, 38,540 of 407,065 points inside R = 18 belonged to no sector; `getSectorAt` silently picks the nearest sector instead (`GalacticSectors.js:58-72`, measured with `cov.mjs`).
  - Beyond R = 18 kpc, `getSectorAt` returns `null` (`GalacticSectors.js:48`). 20 of the 152 globular clusters are out there, and 57 are more than 3 kpc from the plane (measured by the critique).
- Sector boundaries are computed from the density model (`GalacticSectors.js:121-125`). Retuning density would move them.

### 2.4 A "prism" is not a fixed thing yet [V]
The prism you see depends on how you got there:

| How you reach PRISM | Width at Sol | Code |
|---|---|---|
| Drilled down from SECTOR → REGION → PRISM | 7.8 pc tile | `NavComputer.js:4651-4677` |
| The default region, centred on the player | 41.9 pc tile (670 pc region) | `NavComputer.js:1218-1223` |
| The width actually loaded (a ~150-star cube, used as a half-width) | 20.7 pc | `NavComputer.js:1188`, `:4678`, `:3750` |

On top of that, SECTOR and REGION views pan freely (`NavComputer.js:4362-4369`), and drill tiles are measured from wherever the view is centred (`:4651-4657`). After a pan, a tile straddles fixed cells.

### 2.5 "Few enough prisms to name each one" does not hold [V]
If prisms are the fixed 16 × 16 tiles inside each region's 8 × 8 grid inside each sector, there are **12.7 million** of them (775 × 128² = 12,697,600; all contain stars). That is in the same range as Elite's procedurally named sectors. They can each have a generated name, but none can be named by hand. Only the ~775 sectors are few enough to review one by one.

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
- The walk (`UAT-walk-2026-09-30.md`) measured ~3 s per loading step near the core, with 98% of the time in the density calculation.
- Headless, the worst step measured is ~210 ms at Sol, and the core is cheap (~10 ms per slab).
- **That 15× gap is unexplained.** Candidates: the cockpit's second NavComputer loading at the same time (`main.js:4700`, `:5895`), the real-feature catalogue (not loaded headless), or profiler overhead.

---

## 3. The proposed address and name

### 3.1 The fixed hierarchy [I]
None of it depends on where you are or how you got there.

```
SECTOR      ~775 adaptive sectors (frozen as data) + rim fill + an unbounded outer ring   → a sector word
  REGION    the sector's 8×8 grid                                                         ┐ together: a
    PRISM   the region's 16×16 grid (a full-height column)                                ┘ column word
      SLAB  a 100 pc height band: N1, N2 … above the plane, S1, S2 … below
        STAR  tier token + slot number inside that box
```

**Name shape (recommended, option A in decision 2):**

```
<Sector word> <Column word> <Slab> <Tier>-<Slot>
Thessa Abrin N1 M-3677
```

What each part tells you:
- **Same first word = same sector.** The label, the map highlight and the name all agree.
- **Column word = region syllable + prism syllable.** Columns in the same region share their first syllable ("Korin", "Kovey", "Kodal"), so neighbours sound related. This is the opposite of today.
- **Slab = height.** "N16" means 1.5 to 1.6 kpc above the plane. The boundary uses `floor`, never rounding, so each star belongs to exactly one slab, the same way real astronomy truncates coordinates in J2000 names.
- **Tier = star type, Slot = which star.** The slot number is counted height-first, so a higher number is higher up inside the slab.

### 3.2 Corrections built into the shape [I]
- **Every tier gets its own token.** O, B, A, F, G, K, M are the dwarfs. The giants get two-letter tokens, **KG, GG, MG**. Without this, a K dwarf and a K giant in the same box could both be called "K-5", because each tier counts its slots from zero. A test pairs every tier with every other tier inside one box.
- **Hyphen and zero-padding on the slot number** (at least 3 digits): "M-042", "K-002", "O-001". Without them, a tail could read like a real designation: "M42" and "M31" are Messier objects, "K2" is a NASA mission. The hyphen also stops "O" being misread as zero.
- **Fixed-length syllables.** The column word is always a 2-letter region syllable plus a 3-letter prism syllable (5 letters; e.g. "Ko" + "rin"). With fixed lengths, a column word can only be split one way, so two different (region, prism) pairs can never spell the same word. This uses the same rule July used: exactly-3-character syllables (`NameGenerator.js:333-343`). A test checks that all 16,384 column words are distinct.
- **Sector words are one token** (no spaces), unique across the whole table, with a test.

### 3.3 Worked examples [V numbers, I words]
The numbers come from `plan-ex.mjs`, which ran the real `GalacticSectors` and `HashGridStarfield` with seed `well-dipper-galaxy-1`. The words are **placeholders**: the real vocabulary does not exist yet. Today's sector names are shown so you can find each place. These are on today's grid; if decision 8 (centre Sol in its prism) is approved, the numbers shift.

| Where | Address (numbers) | Example name |
|---|---|---|
| Red dwarf near Sol (8.005, 0.050, 0.027 kpc) | Sector #29 (today "Tau Vela-94", 1 kpc). Region (0,0), prism (0,3), 7.81 pc wide. Slab N1. M slot (5,45,3) in a 9×92×9 box → 3677 | **Thessa Abrin N1 M-3677** |
| Orange dwarf, same column | K slot (1,28,2) in 6×57×6 → 1021 | **Thessa Abrin N1 K-1021** |
| Sun-like star 1.53 kpc up, same area (halo) | Prism (0,0), slab **N16**, G slot (1,16,0) in 5×49×5 → 401 | **Thessa Abal N16 G-401** |
| Inner galaxy, R ≈ 1.5 kpc | Sector #180 (today "Iota Cygnus-24", 0.25 kpc). Region (6,4), prism (6,12), **1.95 pc** wide. N1. M slot (0,44,1) in 3×92×3 → 399 | **Kethra Viros N1 M-399** |
| Outer disk, R ≈ 12 kpc (longest case) | Sector #752 (4 kpc). Region (4,5), prism (0,12), **31.25 pc** wide. N1. M slot (14,47,14) in 30×92×30 → 42734 | **Oriel Lumay N1 M-42734** |
| Real or catalogue star | Name unchanged. The label shows its address. | "Sirius · Thessa Abrin N1" |

Stars in one 100 pc slab of a fixed column [V, headless]: Sol N1 293 · inner N1 291 · outer N1 1,710 · Sol N16 (halo) 65.

**Longest possible name [I]:** sector word ≤ 7 letters + column word 5 + slab ≤ 3 ("S30") + tail ≤ 8 ("KG-42734"), plus 3 spaces = **26 characters**. Section 6.4 says how that fits the nav.

### 3.4 Special cases [I]
- **Stars on a cell edge.** A star whose offset byte is 0 or 255 sits exactly on its cell's edge (`HashGridStarfield.js:717-722`). Working its cell out from its position could give the neighbouring cell, and two stars could then share a slot. Fix: call sites carry the **tier and cell the generator used** (the generator already knows them). Where only a position is available, the namer regenerates the one or two candidate cells and matches positions. That uses only the hash, never the density model.
- **Systems with no grid slot.** These are feature-centre systems, title-screen and `?system=` spawns (named at the player's position, `main.js:7603`, `:5570`), and anything else not made by the hash grid. They get an **X tail**: "X-" plus a short code for the position inside the slab box, quantised at the same 4e-6 kpc step July uses. It is unique and rare. X is not a tier token, so it can never collide with a slot name.
- **Procedural teleports** currently take their contents from the nearest grid star but their name from the player's position (`main.js:8312-8313`). That breaks the "one system, one name" rule (`NAMING_AND_REAL_OBJECTS.md` §6). Fix: name them after `nearest[0]`, using its tier and cell.
- **Outside the sector table.** The frozen table gains rim sectors to fill the gap inside R = 18 kpc. It also gains an **unbounded outer ring**: a coarse fixed grid of 8 kpc squares beyond the table, each with a generated sector word from a separate "far" word set. Every position anywhere then belongs to exactly one sector, so distant globular clusters get normal-shaped names. Slabs simply keep counting past ±3 kpc (N31, N32 …).

---

## 4. How the plan keeps the July rules

The precedence chain does not change: KnownSystems, then real names, then the 48,000-name catalogue, then procedural. **Only step 4 changes.**

| July rule (source) | How this plan keeps it |
|---|---|
| **Unique by construction, no registry** (ac5 item 1) | [I] Two different stars either differ in sector, column or slab, in which case a head token differs, or share a box. In the same box they have different (tier, cell) slots, because one slot makes at most one star [V `HashGridStarfield.js:651-735`]. Tier tokens are distinct (§3.2), and slot numbers are a fixed mixed-radix count, so the tails differ. Every token can be split only one way (fixed-length syllables, one-word sector words, a fixed token order). All vocabulary comes from fixed tables indexed by position in the hierarchy, so there is no registry. |
| **Same star, same name forever, on every path** (item 1, D5) | The name is a pure function of the star's tier and cell (or position, for X tails). It only stays stable if the grid never changes, so the sector table, rim, outer ring, 8×8 and 16×16 drill and 100 pc slab height all become **frozen shipped constants**, with a golden-names test pinning ~50 stars. **The one honest exception:** switching over renames every procedural star **once** (decision 1). Nothing durable stores names, so no save or link breaks [V `Settings.js:112`, `ShipCameraSystem.js:514-522`, `flightModes.js:664-681`, `main.js:5558-5571`]. |
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

## 5. Making "prism" one fixed thing (decision 6) [I]

You can only name a prism if the PRISM screen always shows the same fixed column for the same stars. Proposal:

- **Drill resolves to the fixed cell under the pointer.** SECTOR and REGION views keep **free panning** (you walked and approved the drag). Each view draws its own parent's grid (one sector's 8×8 regions, one region's 16×16 prisms). Neighbouring parents appear as outlined blocks labelled with their sector or column word and coloured by sector. They are not subdivided, so tiles of different sizes never mix at a sector border (neighbouring sectors range from 0.25 to 4 kpc). Clicking a neighbour block moves the view onto it.
- **The default REGION view snaps** to the fixed region that contains the player (125 pc at Sol instead of a 670 pc player-centred window).
- **PRISM shows exactly one fixed column** (7.8 pc at Sol, 1.95 pc at the core, 31.25 pc in the outer disk) instead of today's 20.7 pc window. **WASD clamps at the column edge.** To step sideways, go up to REGION and click the next column. That way the column word on screen never changes underneath you.
- **Zoom is no longer tied to column width.** Today the wheel caps the zoom radius at the cube size (`NavComputer.js:4704-4705`), and R/F speed is proportional to zoom (`:1373`). A 1.95 pc core column would sit below the 1.5 pc minimum, so you could not zoom out at all, and R/F would be stuck at ~0.9 pc/s. New limits: zoom radius from 0.0015 kpc up to `max(0.01 kpc, 2 × column width)`. Today's `max(0.003, …)` floor (`:1188`, `:4678`) is replaced by this rule. The camera can always pull back past the column.
- **What you will notice:** Sol's column looks sparser, about 293 stars per 100 pc slab against roughly 2,000 today (estimated). On paper the column is now even taller relative to its width (~770:1 at Sol). But you will view and load **one slab at a time** (100 pc tall: about 13:1 at Sol, 3:1 in the outer disk), so the "very tall" problem moves into the segment bar, where you can jump.

---

## 6. Segments and the nav controls

### 6.1 Two different things: naming slabs and bar bands (decisions 4 and 5) [I]
- **Naming slab (decision 4, permanent).** Its height is baked into every procedural name forever. Recommended: **100 pc**. That matches the loader's existing step (`NavComputer.js:3853-3884`), keeps every query well under the guard that silently drops M dwarfs from queries taller than ~0.44 kpc (`HashGridStarfield.js:661-662`), and makes the token read as a height. A taller slab means fewer slabs but bigger slot numbers. A whole-column box (no slab token) would need 6-digit slot numbers with no height meaning.
- **Bar bands (decision 5, changeable later without renaming anything).** How the bar groups slabs for display. Recommended: one cell per 100 pc slab, 60 cells across ±3 kpc, coloured by layer. The alternative is a handful of labelled floors, like a building's floor selector (thin disk, thick disk, halo, north and south), each expanding to its slabs on hover or click.

### 6.2 One layer function [V thresholds, I sharing]
`prismNumbers` already prints the layer: THIN under 0.3 kpc, THICK under 1.0, otherwise HALO (`designs.js:2183`). The plan **uses those same thresholds** (not the 0.9 kpc the draft had), in one shared function that both the bar colours and `prismNumbers` call. With 100 pc slabs: N1–N3 thin, N4–N10 thick, N11 and up halo. This avoids the Elite bug where two screens worked out the region differently and disagreed near borders (research, Frontier issue 13286).

### 6.3 The segment bar [I, built on V layout]
- **Design 1:** a new segment column beside the ±2 pc fine gauge you already approved. The map gives up one 6-texel column (map width 252 → 246, `designs.js:819-836`). 60 cells on 216 texels is ~3.6 texels each, enough for a coloured cell but not text. The current slab and layer show in the rail block (`designs.js:1946-1948`) as "N16 · HALO".
- **Design 2:** the new column sits just left of the gauge (gauge at x = W−20, `designs.js:3117`). The bottom bar has no spare room: its last characters are reserved for the height number (`designs.js:2876-2878`). So the slab token **replaces** the existing height and layer clauses (`:2888-2891`) instead of being added.
- **Behaviour:** the current slab is lit, loaded slabs are mid-tone, unloaded slabs are dim. **Click** jumps to the middle of a slab. **Drag** moves the highlight and loads on release, so dragging never stalls. **R/F is unchanged** as the slow pan, and the 100 ms per-frame cap stays (`NavComputer.js:44`, `:1371`) so a slow frame cannot teleport the camera.
- **Plumbing:** it reuses the existing grab pattern. Paint publishes a rect, the press is armed at mouse-down, mouse-up releases (`designs.js:2219`, `NavComputer.js:4349`, `:4402`, `:4415`, `navViewModes/index.js:205`, `:1381`).
- **Y range:** the bar spans **±3 kpc**, matching the loader. The "Y RANGE" readout is fixed to the same shared constant (today it says ±2.0).
- **Code constraint:** `NavComputer.js` is held at 4,711 lines (`:156` comment). Segment logic goes in a **new module**; NavComputer gets call-site changes only.
- **Legacy look:** not in this contract (section 9, follow-ups).

### 6.4 Names in the nav lists [V widths, I fix]
Today nav text is cut **from the right** (`navPixelType.js:146-151`, `designs.js:399`), and that cuts off exactly the part that identifies the star:
- Design 1's PRISM list pads names to **12 characters** (`designs.js:1928`, rail `cols` = 25 at `:825`, `:868`). Every row would read "THESSA ABRIN".
- Design 2's name column is 119 texels, ~19 characters (`designs.js:3176`). "THESSA ABRIN N1 M-3677" would become "THESSA ABRIN N1 M-36", a valid-looking name for a **different** star. That is exactly what `cockpit/designation.js:9-20` forbids.

Fix:
- **Inside PRISM, list rows show only the tail** ("N1 M-3677", 9 characters), and the column's head ("THESSA ABRIN") is drawn once as a header. Every star in the list shares that head, so nothing is lost.
- **Anywhere else a star name is shortened, whole words are dropped from the front**, the same rule as `fitDesignation`. Characters are never cut from the end of a name.
- The **location label** (§6.5) is a separate thing, not a name. It drops whole fields from the right (star first, then slab), because its job is location.
- **A layout test** renders the longest possible name (§3.3, 26 characters) in every nav field in both designs and fails if any field shows a cut-off token.

### 6.5 The "where am I" label [I]
- Shows **where you are**, not what you are browsing (browsing shows in the rail):
  - Procedural star: `M-3677 · [sector colour]THESSA ABRIN N1`
  - Named star: `SOL · [sector colour]THESSA ABRIN N1`
- **Design 1:** the 14-cell `hereName` slot takes the star's own name or tail. The 17-cell sector slot takes "THESSA ABRIN N1" (15 characters, fits) (`designs.js:844-847`).
- **Design 2:** the top-bar locator (`designs.js:2787-2790`).
- **One resolver** returns the address **and** the colour, and both the label and the map highlight call it. Each sector gets a fixed colour from the palette, chosen so adjacent sectors differ.

---

## 7. Loading one slab at a time, and the stall [I unless marked]

- **Today [V]:** entering PRISM loads the whole ±3 kpc column, about 30 rounds of two 0.1 kpc slabs (`NavComputer.js:3854-3884`). Each round evaluates density for every cell of all 10 tiers (`HashGridStarfield.js:651-694`). Under a design, every round also rebuilds and re-sorts every row (`state.js:986-1011`).
- **New:** load **the slab you are in** first. Then load the slabs above and below while idle. Unload far slabs.
- **Costs [V, headless]:** single cold calls take 40–270 ms per slab (Sol 62, core 47, outer 267, halo 40; `plan-ex.mjs`). With warm JIT, Sol takes **13 ms** and the outer disk **199 ms** (`rev-cells.mjs`).
- **Splitting the work.** Splitting by tier alone does not bound a frame: M dwarfs are 60–65% of the cells evaluated (89,373 of ~138k in the outer disk), so the M step alone is ~130 ms. Instead the loader works through a **cell budget per frame**, splitting M and K by y-row, aiming at ≤ 8 ms of loading per frame.
- **Rows are appended per slab**, with no full rebuild and re-sort per step. Stars in one slab share their head, so the sector lookup runs once per slab.
- **Three correctness fixes that come with slab loading:**
  1. **"Here" detection** matches your name against the loaded stars and falls back to the nearest one (`NavComputer.js:2052-2058`). If your own slab were not loaded, the wrong star would be marked. Fix: **always load and pin the player's own slab.**
  2. **Real stars** replace their hash-grid twin only among stars already loaded (`:3790-3800`), and they are de-duplicated once. If the twin's slab loads later, both would appear. Fix: merge real stars against a 2 pc margin that reaches into the neighbouring slabs, and re-run the merge for each slab as it loads.
  3. **`_loadedSeen` is cleared per slab on unload**; otherwise an unloaded slab could never reload.
- **Name cache:** `state.js:571-574` caches names by the 32-bit seed. On an ~80k-star column about 0.75 seed collisions are expected, which would show one star's name on another. Fix: key the cache by the address (tier + cell).
- **Bright-star defect [V]:** the prism query drops O and giant stars whose cell centre is outside the prism but whose position is inside it (`HashGridStarfield.js:679-681`; 0 of 40 found in a test). Naming does not depend on this query. But the slab loader is rewritten anyway and you will judge the PRISM view, so the fix lands with the loader (Phase 2).
- **Unknown [V that it is unexplained]:** the walk's ~3 s per step. Slab loading cuts the work ~60-fold whatever the cause. But if one slab really costs seconds in the browser, the first slab would still stall. **Phase 0 profiles in the browser first**: one nav instance only, the location of XIGMAG-2AE101G recorded, and the feature catalogue on and off.

---

## 8. Everything that depends on a name

| Place | Risk | Handling |
|---|---|---|
| **Call sites of the namer.** `generateSystemName(rng, pos)` takes no tier today (`NameGenerator.js:443`). | Every caller must now pass tier and cell | Callers: nav pick `main.js:6137`; sky-click `:14306`, `:14327`; screensaver `:14379`, `:14393`; spawn via `generateSystemNames` `:7604`; teleport `:8312-8313` (switch to `nearest[0]`); title and `?system=` spawns `:7603`, `:5570` (X tail); nav rows `NavComputer.js:3759`, `state.js:573`; scripts `gen-named-systems.mjs`, `name-census.mjs`. Nav rows store tier as `spectral` (`NavComputer.js:3767`), but the real-star merge overwrites it (`:3812-3815`), so a separate `tier` field is kept. |
| Warp target → arrival, carried as a string (`main.js:6137` → `:6658` → `:7601-7604` → `:8051`) | Works if all callers share one function | One shared function. A test checks that the nav-row name equals the arrival name on every targeting path. |
| **Contents lookups** `RealSystemOverlay.resolve`, `KnownSystems.findByAlias` (`arrivalResolution.js:54-93`, `main.js:6751-6760`) | The dangerous one: a collision would give a procedural star **real planets** | Shape disjointness plus the build-time check against every lookup key set (§4). |
| Nav "here" and the self-warp guard (`state.js:1018-1044`, `navViewModes/index.js:882`) | Breaks if the nav and spawn name stars differently | Same function, same frozen table. NavComputer stops building its own sector table (`NavComputer.js:141`). |
| Warp-tunnel pattern seeded from the name (`main.js:348`, `:10347-10348`) | Each destination's tunnel looks different after the switch | Cosmetic; accept it. |
| Sector names in the nav (`GalacticSectors.js:207-235`, `state.js:966`) | They become the unique sector words | This also fixes the 319 duplicates. |
| Tests: `NameGenerator.injective.test.js` (`:25-37`, `:148-173`), `scripts/gen-named-systems.mjs:63`, `scripts/name-census.mjs`, `tests/baseline/known-failures.json:210` | The old shape rules fail | Rewrite for the new shape; re-record the baseline deliberately. Tests that only use old names as fixed inputs are fine. |
| Cockpit name fitting (`cockpit/designation.js:46-56`) drops leading words | A focused procedural star shows "N1 M-3677" on 9-column panels | That is a truthful shorter name, not a wrong one. Better cockpit handling is a follow-up. |
| Search (`knownObjectSearch.js`) | Nothing breaks | Search by sector word is a possible follow-up. |
| Planet and moon names that embed the system name | They follow automatically but get long ("Thessa Abrin N1 M-3677 b") | Accept; front-drop fitting covers the panels. The planet-name fix is its own follow-up (§9). |

---

## 9. Build order

This spans several systems, so it gets a `dev-collab-scope` contract (`intent.md` + `contract.json`) before any code, and each phase is verified with `verify-workstream`. You do the UAT.

| Phase | What gets built | What you can see or check afterwards |
|---|---|---|
| **0. Ground truth and scope** | Browser profile of the PRISM stall (one nav instance, location recorded). Your decisions recorded. Contract written. | A one-line answer to "what actually costs 3 s". |
| **1. The fixed grid** | Frozen sector table with unique placeholder ids, rim fill, outer ring and Sol offset if approved. Address module: (tier, cell or position) → address, and address → box. Ten tier tokens, edge-cell handling, X tails. Injectivity, round-trip and golden tests. | No visible change. A lab readout of addresses for sample stars. |
| **2. Fixed PRISM, segment bar, slab loading** (designs 1 and 2) | Drill and snap rules (§5). Zoom limits. Segment bar with click and drag. R/F unchanged. Shared layer function and Y-range constant. Slab loader with per-frame budget, pinned own slab, real-star margin merge, `_loadedSeen` per slab. Bright-star fix. | **Mid-plane to 2 kpc in one click, and no multi-second freeze on entering PRISM.** This fixes your main pain point before any renaming. |
| **3. Vocabulary** | ~800 sector words (crisp in the core, soft on the rim), outer-ring words, 64 two-letter and 256 three-letter syllables. Screened against real names, constellations and a profanity list. | An Artifact review page: you approve or reject every sector word and samples of column words. |
| **4. Name switch** | The procedural step spells out the address. Call-site changes (§8). Address-keyed name cache. Teleport naming. Build-time lookup-key check. Tail-only PRISM rows with a header, front-drop fitting, the layout test. Rewritten tests and re-recorded baseline. | Nav rows and arrivals read "Thessa Abrin N1 M-3677". "Here" detection and the self-warp guard still work. |
| **5. Where-am-I label** | One resolver for address and colour, used by the label and the map highlight. | The label colour matches the map highlight. |

**Follow-ups (separate contracts, not in this one):**
- the legacy look's segment bar, which reverses the earlier "legacy unchanged" rule;
- cockpit display of procedural star names;
- planet and moon names: one shared names object seeded from the star's address, not the warp counter (`main.js:6644-6645`, `:7568`), replacing the three separate namers. This is the order you set in the walk (`UAT-walk-2026-09-30.md:49-50`): system names first;
- search by sector or column word.

---

## 10. Risks and unknowns

- **[V] The stall's cause is unknown.** Phase 0 exists so we fix the right cost.
- **[I] A frozen grid means frozen names.** Any later change to the sector table, slab height, drill sizes, tier tokens or vocabulary renames every procedural star. The golden-names test makes such a change loud. That is also why the Sol offset (decision 8) is now-or-never.
- **[I] Generated words can be ugly or offensive.** The vocabulary is finite (~800 sector words plus 320 syllables), so it can be fully screened, and you review it.
- **[V] 12.7 million columns** can be named only by generator. Only the sector words are fully hand-reviewable.
- **[I] A sparser PRISM view** at Sol (§5).
- **[I] Long planet names**, ~26 characters. Front-drop fitting handles the panels.
- **[I] Map rendering of neighbour blocks** (§5) is new drawing work in both designs.
- **[V] Real stars displace a grid star within 2 pc** (`NavComputer.js:3785-3816`). The displaced grid star's address simply goes unused; the real name wins.
- **[I] The model's halo is heavy** (~9% of stars at the mid-plane, majority above ~0.9 kpc), so high slabs are not empty. This is a fact about the galaxy model, not about naming.

---

## 11. How the critique was handled

| # | Critique point | Handling |
|---|---|---|
| 1 | Tier letter not unique (K vs KG) | **Accepted.** 10 distinct tokens, cross-tier test (§3.2). |
| 2 | Names do not fit the nav lists; cutting from the right gives a wrong name | **Accepted.** Tail-only PRISM rows, a header, front-drop fitting, longest-name layout test (§6.4). |
| 3 | Silently overrides survey designations and catalogue-like core | **Accepted.** Now decision 3, with options. |
| 4 | Lattice is not fixed in the nav (panning, mixed sizes) | **Accepted.** Drill and snap rules, neighbour blocks, WASD clamp (§5, decision 6). |
| 5 | Slab height is permanent, not a UI default | **Accepted.** Naming slab separated from bar bands; decisions 4 and 5. |
| 6 | Two layer resolvers (0.9 vs 1.0 kpc); design 2's bar has no spare room | **Accepted.** One function using the existing 0.3/1.0 thresholds; the slab token replaces the height and layer clauses (§6.2, §6.3). |
| 7 | Splitting by tier does not bound the frame; cold numbers include JIT warm-up | **Accepted.** Per-frame cell budget, M and K split by y-row; warm numbers quoted (§7). |
| 8 | Narrower PRISM hits the zoom clamp and slows R/F | **Accepted.** Zoom decoupled from column width; new limits stated (§5). |
| 9 | Slab loading breaks "here", real-star merge and `_loadedSeen` | **Accepted.** Own slab pinned, margin merge, per-slab reset (§7). |
| 10 | Seed-keyed name cache | **Accepted.** Keyed by address (§7). |
| 11 | Signature change, call sites, teleport naming | **Accepted.** Full call-site list, separate `tier` field, teleport named after `nearest[0]`, X tails for title and deep-link spawns (§3.4, §8). |
| 12 | No coverage past R = 18 kpc | **Accepted.** Unbounded outer ring of sectors, so the name shape is the same everywhere (§3.4). |
| 13 | Joined syllables can be ambiguous | **Accepted.** Fixed 2 + 3 letter syllables, distinctness test (§3.2). |
| 14 | Weak alternative in the name-shape decision | **Accepted.** Option B is now sector word + grid reference (decision 2). |
| 15 | Scope creep | **Mostly accepted.** Legacy bar, cockpit, planet names and search are now follow-ups. **Two items kept:** (a) the bright-star fix stays in Phase 2: it is not needed for naming, but Phase 2 rewrites that loader path and you will judge the PRISM view it affects; (b) the Sol offset stays as decision 8, because it can only be done before names freeze. Doing it later would rename everything a second time. |
| 16 | Tails look like real designations ("M42", "K2") | **Accepted.** Hyphen plus 3-digit padding ("M-042"). |
| 17 | Y RANGE readout ±2 vs loader ±3 | **Accepted.** One ±3 kpc constant (§6.3). |

---

## 12. Decisions for you

1. **Rename every procedural star once.** Every procedural name becomes multi-part, and July's "same name forever" is broken exactly once; after that it holds again. No save or link breaks. **Recommend: yes.**
2. **Name shape.**
   - **A:** sector word + generated column word: "Thessa Abrin N1 M-3677". You get a sayable name and neighbouring columns sound alike. The cost is 16,384 generated column words, reviewed by sample only.
   - **B:** sector word + grid reference, as Elite does: "Thessa C7K12 N1 M-3677". Only ~800 words need review, and the code matches the letters on the nav map. The cost is more letters and numbers, which is the "meaningless strings" look you objected to.
   - **Recommend: A.**
3. **Survey-style names** (your July ruling: "like real astronomy designations"; core "more catalogue-heavy").
   - **A:** drop the survey class. One Elite-style shape for all procedural stars, with the core's feel carried by crisp sector words. This follows today's direction ("readable syllables at the beginning").
   - **B:** keep a survey-style variant in core sectors, e.g. "PVX Thessa-Abrin N1.M-3677". That keeps July's ruling, but the name no longer starts with syllables there.
   - **Recommend: A.**
4. **Naming slab height (permanent).** **Recommend: 100 pc**, giving N1–N30 and S1–S30 inside the nav's ±3 kpc.
5. **How the bar groups slabs (changeable later).** **Recommend: 60 cells coloured thin/thick/halo, with the slab name in the rail.** The alternative is ~6 labelled floors that expand to their slabs.
6. **PRISM becomes one fixed column.**
   - The view equals the fixed tile (7.8 pc at Sol; a sparser view).
   - Drill snaps to the fixed cell under the pointer.
   - Free panning stays, with neighbours drawn as labelled blocks.
   - WASD stops at the column edge.
   - Zoom can always pull back past the column.
   - **Recommend: yes.** Without it, one star could carry different names depending on how you reached it.
7. **Segment bar beside the ±2 pc fine gauge you approved, or replacing it.** **Recommend: beside.**
8. **Centre Sol in its prism (now or never).** Today the Sun sits exactly on a corner shared by four sectors, so its home neighbourhood would carry four different sector words. A small fixed offset of the frozen grid fixes that, and it costs nothing now. After names freeze, it would mean a second rename. **Recommend: yes.**

**Going ahead unless you object:**
- tail-only star rows inside PRISM with the column name as a header;
- whole words dropped from the front whenever a name is shortened;
- layer thresholds stay at today's 0.3 / 1.0 kpc;
- the Y range is ±3 kpc everywhere;
- the label shows where you are, not what you are browsing;
- procedural teleports are named after the star they actually spawn;
- the legacy look, cockpit, planet names and search become follow-ups.

---

## Appendix: Evidence

### Code (branch `feature/world-engine-production-L1`)
- **Name precedence:** `src/generation/NameGenerator.js:443-472` (throw `:444-451`, catalogue `:461-462`); `src/main.js:6137`, `:14321-14324`, `:14388-14391`, `:7597-7598`, `:8356`; `arrivalResolution.js:61-63`, `:82-86`; `docs/NAMING_AND_REAL_OBJECTS.md:271-277`.
- **Position locator L and catalogue key:** `NameGenerator.js:238-288` (constants `:261-264`), `:290-331`; `src/generation/data/namedSystemsCatalog.js:1-57`.
- **Procedural shapes:** survey `NameGenerator.js:396-401`; multipart `:405-410` (word from low bits `:407`); syllables `:333-352`; bit floor `:43-50`; region weights `:366-371`.
- **Shape tests:** `src/generation/__tests__/NameGenerator.injective.test.js:25-37`, `:148-173`; `scripts/gen-named-systems.mjs:63`; `tests/baseline/known-failures.json:210`.
- **Sectors:** `src/generation/GalacticSectors.js:44-73` (null beyond 1.2 × radius `:48`, nearest fallback `:58-72`), `:85-162` (quadtree), `:100-103` (extent), `:121-125` (density-driven), `:207-243` (placeholder names, hash).
- **Galaxy extent:** `GalacticMap.js:89-90`, `:93-94` (Sol); `HashGridStarfield.js:304-305`, `:455`, `:684`.
- **Star tiers and slots:** `HashGridStarfield.js:73-90` (10 tiers, `ALL_TYPES`), `:651-735` (one star per tier-cell), `:690` (tier hash offset), `:717-722` (offset bytes), `:729` (32-bit seed), `:661-662` (`yCells > 200` skip), `:679-681` (bright-star drop), `:726-727` (50k cap).
- **Density layers:** `GalacticMap.js:480-494`, `:682-820`, `:766-776`, `:843-872`.
- **Prism geometry and nav:** `NavComputer.js:44` (`MAX_PAN_STEP_MS`), `:71-73`, `:141` (own sector instance), `:156` (line-freeze note), `:1183-1223`, `:1371-1407` (pan), `:1595-1602` (`computeTileSize`), `:1880-1881`, `:2052-2058` ("here"), `:3539-3673` (legacy minimap), `:3696-3884` (loader, `_queryYRange`, `_scheduleBgExpand`, MAX_Y `:3856`), `:3756-3816` (row naming, real-star merge), `:4349`, `:4362-4369` (view pan), `:4398-4415` (grabs), `:4641-4680` (drill), `:4704-4705` (zoom clamp).
- **Designs:** `src/ui/navViewModes/designs.js:399` (`pad`), `:819-836` (design 1 layout), `:825`, `:868` (rail cols), `:844-853` (status row), `:1928` (PRISM list pad `cols-13`), `:1946-1948` (rail numbers), `:2155-2159` (`d1PlayerTile` grid reference), `:2180-2186` (layer thresholds, Y RANGE ±2), `:2210-2221` (y-gauge ±2 pc), `:2787-2790` (design 2 locator), `:2860-2891` (bottom bar), `:3101-3130` (minimap, gauge), `:3176` (list name 119 texels).
- **Nav state:** `navViewModes/state.js:559-575` (`nameBySeed`), `:610-620`, `:627-657` (design body namer), `:966`, `:986-1011` (row rebuild), `:1018-1044` ("here", self-warp); `navViewModes/index.js:205`, `:882`, `:1121-1141`, `:1320`, `:1381`.
- **Text fitting:** `src/ui/navPixelType.js:146-151` (right-cut `fit`); `src/cockpit/designation.js:9-20`, `:46-56` (front-drop rule).
- **Name-keyed sites:** `main.js:348`, `:5558-5572`, `:6644-6645`, `:6658`, `:6691`, `:6751-6760`, `:6790`, `:7568`, `:7601-7604`, `:8051`, `:8312-8313`, `:10347-10348`, `:14306`, `:14327`, `:14379`, `:14393`; `RealSystemOverlay.js:156`, `:173-215`, `:282-283`; `KnownSystems.js:36-45`, `:135-152`; `knownObjectSearch.js:1-79`, `:202-221`.
- **No durable name storage:** `Settings.js:112`, `:161`; `ShipCameraSystem.js:514-522`; `navViewModes/index.js:1834-1843`; `flightModes.js:664-681`.
- **Two nav instances:** `main.js:4700`, `:5895`.

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
