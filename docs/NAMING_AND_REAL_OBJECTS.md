# Naming & Real Objects — how systems get named, and where real astronomy enters the game

**What this is.** A ground-truth walkthrough of two tangled machines: (1) the
procedural name generator that labels every star system, and (2) the four
separate mechanisms that splice *real* astronomy (real names, real objects)
into an otherwise made-up galaxy. It is the evidence package for two upcoming
decisions:

- **AC5 — your ratify-or-amend review of the proc-gen naming scheme.** You
  asked to "understand the current system in depth so I can figure out"
  whether you're happy with it (`intent.md`). This doc is the depth.
- **Scoping the successor "real-universe overlay" workstream** — your ask 3:
  "all known systems/stars/planets we can reasonably easily find … names
  overwrite the algo ones … system characteristics may have to replace the
  ones we have." To scope that, we first have to inventory what real data
  *already* flows in today. Sections 2 and 3 are that inventory.

**How to read the citations.** Every factual claim about the code carries a
`file:line` pointer — e.g. `NameGenerator.js:331`. Line numbers are as of the
`feature/system-details` branch at the time of writing and can drift a few
lines as code moves; the surrounding function name is the durable anchor.
Numbers from the census cite `docs/WORKSTREAMS/naming-census-uniqueness-2026-07-07/census-report.md`.

**One orientation note before the detail.** There are two completely separate
questions that are easy to conflate:

- *"What NAME does a system show?"* — decided by the name generator plus a few
  override paths. This is what most of this doc is about.
- *"What's INSIDE the system (its star type, planets, orbits)?"* — decided by
  a different generator on a different random-number stream. Naming can never
  change contents. Section 1.2 explains exactly why, because it's the load-
  bearing safety property for the whole workstream (you can rename the entire
  galaxy without a single planet moving).

---

## 1. How a system gets its name, end to end

> **⚠️ Updated by increment 3b (AC6/AC7, 2026-07-08).** Sections 1.1 and 1.3
> below describe the *original* seed-based scheme that this doc was written to
> review (AC4/AC5). That scheme has since been **replaced**: `generateSystemName`
> is now a **pure, injective function of canonical galactic position** — the
> `rng`/seed argument is ignored, so naming is unique by construction (AC6) and
> revisit-stable on every path (AC7). The three live classes are survey
> designation / multi-part fantasy / rare bare word; there is no `sectorCode`
> mitigation and no no-position fallback (D5 eliminated). The mechanism is
> documented at the top of `src/generation/NameGenerator.js`, proven by
> `src/generation/__tests__/NameGenerator.injective.test.js`, and measured in
> `docs/WORKSTREAMS/naming-census-uniqueness-2026-07-07/census-report.md`. The
> real-object machinery in §2/§3 is unchanged. Read §1.1/§1.3 as history.

### 1.1 The generator: five styles, region-weighted

Every procedural name is produced by one function, `generateSystemName(rng,
galacticPos)` (`src/generation/NameGenerator.js:326-364`). It rolls one random
number and picks one of **five** output styles by cumulative threshold:

| # | Style | Example | Code |
|---|---|---|---|
| 1 | Catalog designation | `HD 47832`, `TRAPPIST-12` | `:340-342` → `_catalogName` `:414-423` |
| 2 | Greek + constellation + number | `Alpha Centauri 4821` | `:345-350` |
| 3 | Pronounceable word | `Velorath`, `Syndara` | `:352-354` → `_regionWord` `:369-389` |
| 4 | Prefixed word | `Aldorfio`, `Cyrath` | `:357-359` → `_regionPrefixedName` `:394-407` |
| 5 | Word + title suffix | `Kator Haven`, `Todu Minor` | `:362-363` |

The census groups these into **three** buckets by visible shape, because
styles 3/4/5 all produce pure-letter "fantasy" output with no digits and are
indistinguishable *as names* (census "Classification method"). So throughout
this doc and the census: **catalog** = style 1, **greek** = style 2,
**fantasy** = styles 3+4+5.

**The style mix is not uniform — it's weighted by galactic region.** The
weights live in `REGION_STYLES` (`:307-312`):

| Region | catalog | greek | fantasy (3+4+5) | Feel |
|---|---|---|---|---|
| core | 40% | 15% | 45% | formal, catalog-heavy |
| arm | 20% | 10% | 70% | default mix |
| rim | 10% | 5% | 85% | exotic, mostly invented |
| halo | 15% | 10% | 75% | archaic, titled |

Which region a position falls into is decided by `_classifyRegion`
(`:275-300`): **halo** if height above the galactic plane `|y| > 2.0` kpc
(checked first, wins regardless of radius, `:289`); **core** if radius from
center `< 3.0` kpc (`:291`); **rim** if radius `> 14.0` kpc (`:293`);
**arm** otherwise. The census confirms the generator's real output tracks
these configured weights within sampling noise (census "Classification
method" table), so the weights on the page are the weights the player gets.

**Regional flavor goes deeper than the style mix.** Two more region tables
change *how the invented words sound*: `REGION_ONSETS` and `REGION_SUFFIXES`
(`:254-266`). Core names lean on hard consonants (`k`, `t`, `g`, `kh`) and
short endings (`-ax`, `-us`, `-ek`); rim names lean on soft/flowing sounds
(`sh`, `th`, `l`, `v`) and airy endings (`-eon`, `-ara`, `-iel`). This is why
core reads terse and rim reads ornate — it's deliberate, in the tables.

**Downstream names** (star, planet, moon) hang off the system name:
- **Star:** normally identical to the system name; binary systems append
  ` A` / ` B` (`generateStarName` `:442-447`).
- **Planet:** 55% letter-suffix (`Velorath b`), 25% its own invented word,
  10% numeral, 10% descriptive (`generatePlanetName` `:469-499`).
- **Moon:** 40% Roman numeral, 35% from a fixed pool of 40 short names,
  25% invented (`generateMoonName` `:520-541`).

### 1.2 Seed-stream isolation — why renaming can never change contents

This is the property that makes the whole workstream safe, so it's worth being
precise. When the game spawns a system (`src/main.js:4181-4194`):

1. **Contents first, on their own RNG.** `StarSystemGenerator.generate(seed)`
   (`:4181`, or the async form during warp `:3423`) builds the star type,
   planets, orbits, moons. It creates and fully consumes its *own*
   `SeededRandom` internally.
2. **Names second, on a fresh RNG.** Only after contents exist does naming run:
   `const nameRng = new SeededRandom(seed)` (`:4192`) — a brand-new generator
   object, seeded from the same string but a *separate instance*, passed to
   `generateSystemNames` (`:4193`).
3. **Naming immediately forks a child stream.** The first thing
   `generateSystemNames` does is `rng.child('names')` (`NameGenerator.js:567`),
   and `child()` derives a new independent generator from one draw of its
   parent (`SeededRandom.js:93-96`). Each star/planet/moon then forks its own
   further child (`:573-605`).

Because contents are generated by a different generator instance, and are
already fixed before naming starts, **the naming code never shares a draw
sequence with the content code.** You can rewrite every naming table, change
the style weights, add a uniqueness registry — and a given seed's planets,
orbits, and star type stay byte-identical. Naming *reads* the system data
(to know how many planets need names) but never writes back to it.

This is also why the workstream can do a one-time galaxy-wide rename without
breaking saves: nothing durable stores names (localStorage holds only settings
+ camera mode, per `intent.md`), and contents live on the untouched content
stream.

### 1.3 sectorCode: the collision mitigation, and where it is switched off

`_classifyRegion` also computes a **`sectorCode`**: a spatial hash that buckets
position into ~1 kpc cubes (`NameGenerator.js:282-286`). Its whole job is to
push two systems at *different* places toward *different* names even when they
roll the same style. It feeds in at three points:

- **RNG diversification:** `const nameRng = sectorCode ? rng.child('sec-' +
  sectorCode) : rng` (`:331`) — same seed at a different position takes a
  different random branch.
- **Catalog numbers:** the sector code is added into the catalog number and
  wrapped to the catalog's range (`_catalogName` `:420-421`).
- **Greek suffix:** the trailing number is `sectorCode % 9000 + 1000`
  (`:348`) — a 1000–9999 spread bolted onto the ~600 base
  `GreekLetter × Constellation` combos.

**Where it does NOT apply — three gaps that matter for your review:**

1. **The fantasy path has no sector mixing of its own.** Styles 3/4/5 get the
   sector-diversified `nameRng` (`:331`) but nothing analogous to the
   catalog-number offset or greek suffix — no numeric tail, no registry. This
   is why fantasy is the path with unmitigated collisions (census: worst
   offender `Lyreon`, 17 hits).

2. **Tiny catalog ranges defeat the offset.** The offset wraps modulo the
   catalog's own range (`:421`). `TRAPPIST` is defined as 1–99
   (`CATALOG_FORMATS:89`) — only ~98 possible numbers — so it saturates almost
   immediately regardless of sector. This is the entire top of the census
   worst-offender list (`TRAPPIST-69` / `-74`, 28 collisions each).

3. **The no-position fallback switches sectorCode off entirely.** When a system
   is named with no position, `_classifyRegion(null)` returns `{ region:
   'arm', sectorCode: 0 }` (`:276`), and because `0` is falsy, the
   `sectorCode ? … : rng` guard (`:331`) skips the sector child. Every
   catalog/greek mitigation above then no-ops (offset `= 0`, greek falls back
   to a plain random number). In practice this fires only when the spawn has
   no override name to carry (see §3.4 "Path E") — but when it fires, that
   system is named as if it lived in a generic arm sector with zero spatial
   spreading.

---

## 2. The four real-object mechanisms, side by side

Real astronomy enters the game through **four independent subsystems**. They
were built at different times for different jobs and — this is the key
finding for scoping the overlay workstream — **they share no common schema.**
Each is consumed by a different part of the engine through a different adapter.

| | 1. KnownSystems | 2. RealStarCatalog | 3. KnownObjectProfiles | 4. RealFeatureCatalog |
|---|---|---|---|---|
| **File** | `src/generation/KnownSystems.js` | `src/generation/RealStarCatalog.js` | `src/data/KnownObjectProfiles.js` | `src/generation/RealFeatureCatalog.js` |
| **Covers** | Whole handcrafted star systems (only **Sol** today) | ~15,599 real naked-eye stars (HYG v4.0) | 37 Messier/NGC/IC deep-sky objects (nebulae, clusters, SNRs) | 152 real globular clusters (Harris catalog) |
| **Data source** | Hardcoded in-file | `public/assets/data/hyg-stars.json` (fetched) | Hardcoded in-file | `public/assets/data/globular-clusters.json` (fetched) |
| **Position field** | `position:{x,y,z}` (`:37`) | raw `x/y/z` → render `worldX/Y/Z` (`:141-145`) | `galacticPos:{x,y,z}` (`:30`) | `position:{x,y,z}` (`:47`) |
| **Name field** | `name` + a full `names` tree (`:45-64`) | `name` (`:150`) | `name`,`messier`,`ngc` (`:26-29`) | `name` (`:57`) |
| **Identity tag** | *(none)* | `isRealStar:true` (`:154`) | `isKnownObject:true` (`:1554`, set at injection) | `isReal:true` (`:69`) |
| **What it overrides** | **Contents + all names** | Star's sky dot + its name (see §3) | A deep-sky feature's *appearance* | A deep-sky feature's presence/size |
| **Match/hook** | `findAt(pos)` within 0.005 kpc (`:24`,`:76-87`) | `findVisible()` per frame (`:95-161`) | injected into galaxy features (`GalacticMap.js:1515-1566`) | `findNearby()` (`:83-106`) |

Detail per mechanism:

**1. KnownSystems — the only full override.** A registry (`:34-68`) whose one
entry is Sol, matched by galactic position within a 5 pc radius
(`MATCH_RADIUS = 0.005`, `:24`; `findAt` `:76-87`). When it matches, its
`generate()` builds the *entire* handcrafted system and its `names` object
supplies every real name — Mercury→Eris, real moons (`:45-64`). This is the
strongest mechanism: it replaces **both** contents **and** names. It's also
the template closest to your overlay ask ("characteristics may have to
replace the ones we have"), because it's the only one that already replaces
characteristics.

**2. RealStarCatalog — real dots, real names, procedural insides.** Loads the
HYG catalog by `fetch` at startup (`:44-57`) and, per frame, returns the real
stars visible from the player's position, each carrying `name` (real, e.g.
"Sirius"), spectral type, and magnitude (`:141-155`). These render as real
sky stars. Crucially it supplies a name and a *type* but **not a system** —
warping to one still generates procedural planets (see §3.2).

**3. KnownObjectProfiles — appearance styling for named deep-sky objects.**
37 profiles (`:19-1164`), each a big bag of *visual* parameters (colors, noise
octaves, dark lanes, embedded-star counts) plus `name`/`messier`/`ngc`/`type`/
`galacticPos`/`radius`. They are folded into the galaxy's feature list at
`GalacticMap.js:1515-1566`: any overlapping procedural feature within 2× the
object's radius is deleted to avoid doubling (`:1524-1533`), then the known
object is pushed as a feature tagged `isKnownObject:true` carrying its
`knownProfile` (`:1543-1564`). Searchable by name/catalog id via
`searchKnownObjects` (`:1173-1191`). It styles *how a deep-sky smudge looks*;
it does not touch star-system naming or contents.

**4. RealFeatureCatalog — real globular clusters as features.** Loads the
Harris catalog by `fetch` (`:37-75`) and maps each cluster into the same
feature shape the galaxy generator uses — `position`, `radius`, `seed:
harris-<id>`, `name`, plus context/overrides that make its stars old and
metal-poor (`:46-70`), tagged `isReal:true`. `findNearby` returns them by
distance (`:83-106`).

**Why "no shared schema" is the load-bearing point.** The position key alone
is spelled three different ways (`position`, `galacticPos`, raw `x/y/z`); the
identity flag is a different string in each (or absent); one carries a full
name tree, the others a flat `name`; two are hardcoded and two are fetched
JSON. An overlay that wants "all reasonably findable objects" to have real
names + real characteristics has to either unify these four or add a fifth
adapter — that's a real scoping fork, called out in §5.

---

## 3. What real data actually reaches the player, per targeting path

There are three ways to pick a warp destination, and they do **not** agree on
how much real data survives. This section traces each.

### 3.1 The name you see IS the name you get

Whatever name is chosen at *target-selection* time is carried through the warp
and becomes the final system name. The mechanism: target selection sets
`warpTarget.name`; warp prep copies it into `pendingSystemData._warpTargetName`
(the `_warpTargetName` chain: external-galaxy `:3325`, feature route `:3358`,
known-system `:3420`, default `:3433`); and spawn passes that as the
*override* name to `generateSystemNames` (`:4193`). If an override is present,
`generateSystemNames` uses it verbatim and never rolls a fresh system name
(`NameGenerator.js:570`). So the split below — decided at selection time — is
what sticks.

### 3.2 NavComputer path — real names win

Selecting a star through the nav computer runs
`_setWarpTargetFromNavStar(navStar)` (`src/main.js:2800-2840`). The name line:

```js
warpTarget.name = navStar.name || generateSystemName(
  new SeededRandom(`warp-nav-${navStar.seed}`), {x, y, z});   // :2833
```

`navStar.name ||` means: **if the selected star carries a real name, that real
name wins**; only nameless procedural stars fall through to the generator. So
targeting Sirius via the nav computer shows "Sirius."

But note what does **not** carry through: the *system contents*. At warp
resolution the star's position and seed drive
`StarSystemGenerator.generateAsync(seed, galaxyContext)` (`:3423`), with the
only real characteristic injected being the star's **spectral type**
(`galaxyContext.starTypeOverride = resolvedStar.type`, `:3404-3405`) and its
**position** feeding local metallicity/age via `deriveGalaxyContext` (`:3401`).
Everything else — how many planets, their orbits, their names — is procedural.
There is no data path today by which a real star's *real planets* reach the
player. That gap is exactly what the overlay workstream is for.

### 3.3 Sky-click path — real name is in hand, then discarded

Clicking a star in the sky runs the handler at `src/main.js:9450-9499`. It
resolves the clicked star and stores its full data:

```js
warpTarget.navStarData = entry.starData;   // :9465  (real stars carry .name, RealStarCatalog.js:150)
```

…but two lines later, for a normal star, it names the target from the
*starfield index* instead of from that stored name:

```js
const nameRng = new SeededRandom(`warp-star-${result.index}`);          // :9492
warpTarget.name = generateSystemName(nameRng.child('names').child('system'), starPos);  // :9493
```

So on the sky-click path, **a real star's real name (`entry.starData.name`) is
available and then thrown away** — the player sees a procedural name for a star
the nav computer would have called "Sirius." The screensaver auto-select path
(`autoSelectWarpTarget` `:9511-9553`) does the identical thing (`:9548-9549`).
This is the sky-click-vs-NavComputer naming split from `intent.md`.

### 3.4 The transient-index problem — revisit instability

The sky-click seed is `warp-star-${result.index}` (`:9492`), where
`result.index` is the star's index **in the current starfield** — and the
code's own comment flags that this index is transient: it resolves star data
"NOW (before starfield regeneration invalidates the index)" (`:9462`). The
starfield is rebuilt every time the player moves to a new position. So the
same physical star can be assigned a *different* index on a later visit →
a different `warp-star-N` seed → a **different procedural name**. That breaks
the second half of your success criterion ("re-visiting … must give back the
SAME name every time"). It's the reason AC7 exists as its own increment.

Contrast: the NavComputer path seeds from `warp-nav-${navStar.seed}` (`:2833`),
and the seed is a stable property of the star, not a transient index — so it's
already revisit-stable on that path. The instability is specific to sky-click.

### 3.5 What real *characteristics* flow into contents — summary

| Path | Name shown | Real name used? | Real characteristics into contents |
|---|---|---|---|
| KnownSystems (Sol) | handcrafted names (`:4189-4190`) | yes — full tree | **yes** — entire system is handcrafted (`:3418`) |
| NavComputer → real star | real (`navStar.name`, `:2833`) | yes | only spectral **type** (`:3404-3405`) + position-derived context; planets procedural |
| NavComputer → procedural star | procedural | n/a | procedural |
| Sky-click → real star | **procedural** (`:9493`) | **no (discarded)** | spectral type + position context; planets procedural |
| Sky-click → procedural star | procedural | n/a | procedural |

The one-line takeaway for scoping: **today, only Sol delivers real system
contents. Real stars deliver at most a name (and only on the nav path) and a
spectral type. No real planet/mass/orbit data reaches the player from any
path.**

---

## 4. The census numbers, read honestly

Full data: `census-report.md`. It calls the real, unmodified
`generateSystemName()` through the exact production seed-chaining pattern, at
volumes far beyond any player's reach (120,000 names, 30,000 per region). It is
**evidence, not a pass/fail test** — its job is to let you see the naming
system at scale before you ratify it.

### 4.1 Headline

| Metric | Value |
|---|---|
| Names generated | 120,000 |
| Distinct names | 108,013 |
| Overall duplicate rate | **9.99%** |
| catalog dup rate | 19.65% (n=25,526) |
| greek dup rate | 2.56% (n=12,083) |
| fantasy dup rate | 8.08% (n=82,391) |

The ranking matches the mechanism analysis in §1.3 exactly:

- **catalog worst (19.65%)** — dominated by tiny-range prefixes. `TRAPPIST`
  (1–99) fills the entire worst-offender list at 22–28 collisions each.
- **greek best (2.56%)** — protected by its `sectorCode % 9000 + 1000` numeric
  suffix (`:348`); worst greek collision is a mere 4.
- **fantasy middling (8.08%)** — no mitigation at all, so it collides purely by
  the birthday effect on its word space; worst is `Lyreon` at 17.

### 4.2 What a duplicate RATE does and doesn't tell you

**These rates are a saturation measurement, not a per-player collision
probability.** At 30,000 draws in one region, the name space is being pushed
hard toward its ceiling, so the rate reflects "how crowded does this path get
when hammered," not "how likely is *a player* to see a repeat." A real
playthrough generates far fewer systems — hundreds to low thousands, not tens
of thousands — so the absolute chance of *any* repeat in a session is much
lower than 9.99%. But it is **not zero**, and two facts push the real risk
*up* from a naive reading, both flagged in the census "Known limitations":

- **Sampling was uniform in space, but players aren't.** Real play clusters
  around Sol, known objects, and popular sectors, so per-sector collision
  pressure in those hotspots is *at or above* what a uniform sample shows.
- **The tiny-range catalog names collide fast.** A player who favors the
  catalog-heavy core, or who just visits a lot of systems, meets `TRAPPIST-N`
  repeats early because there are only ~98 of them to go around.

So the honest reading for your criterion ("never the same name twice"): the
current scheme makes duplicates *uncommon at small N* but *inevitable at large
N*, and provides **no by-construction guarantee** against them anywhere. If the
criterion is literally "never," the scheme as-is cannot meet it without the
AC6 uniqueness mechanism — that's a statement about the mechanism (no registry,
no exhaustion handling exists in `NameGenerator.js`), not a judgment about the
flavor.

### 4.3 The HYG real-name collisions — small, but an immersion tell

The census cross-checked procedural output against the shipped real-star
catalog. **8 distinct procedural names exactly matched a real star name**
(`Rigel`, `Polaris`, `Mira`, `Naos`, `Ain`, `Ran`, `Rana`, `Polis`), across
20 of the 120,000 samples (~0.017%). Small in rate — but each one is a system
falsely wearing a famous real star's name, which is precisely the kind of thing
an astronomy-literate player notices.

**A data-quality caveat sits underneath this number, and it matters for the
overlay workstream.** The shipped `hyg-stars.json` has **15,243 of its 15,599
entries with `name` set to a literal `"` character** — so only **355** entries
carry a usable real name. The census therefore cross-checked against those 355,
not the full 15.6k. The catalog *processing* script writes proper/Bayer/HD
names correctly today (`scripts/process-hyg-catalog.mjs:106-113`), so the
shipped JSON predates that logic or came from a different path. Two
consequences:

- The 8-collision figure is measured against a **crippled** name set. With a
  properly named catalog (15k+ real designations instead of 355), procedural-
  vs-real collisions would be **more** frequent, not fewer.
- "Real names for all reasonably findable stars" (your overlay ask) is blocked
  on regenerating this file first — 97.7% of the catalog currently has no name
  to overlay.

---

## 5. Decisions this evidence puts in front of Max

These are framed as decision points with the evidence attached, not
recommendations. Where an assessment appears, its criteria and reasoning are
stated so you can check them.

### For AC5 — ratify or amend the proc-gen naming scheme

**D1. The regional style mix (`REGION_STYLES:307-312`).** Core is 40% catalog /
45% fantasy; rim is 10% / 85%; etc. (§1.1 table, confirmed by census as what
players actually get). Sample blocks per region are in `census-report.md`.
*Decision:* keep these weights, or re-balance the catalog/greek/fantasy split
per region.

**D2. Tiny catalog ranges.** `TRAPPIST` (1–99) and other small ranges
(`CATALOG_FORMATS:78-95`) are the entire top of the collision list because
their range is smaller than the number of systems that roll them. *Decision
options on the table:* widen the ranges, drop the smallest prefixes, or accept
them as flavor and let AC6's uniqueness mechanism absorb the collisions.
*Assessment (criterion = immersion realism):* `TRAPPIST-92` is arguably a
worse immersion break than a collision, because real TRAPPIST only goes to ~1;
that's a reason to reconsider the range independent of uniqueness. Reasoning:
the prefix advertises a real survey with a known small size.

**D3. Fantasy path has zero collision mitigation (§1.3).** ~70% of names
(arm) come from a path with no numeric tail and no registry. *Decision:* is
uniqueness for these names something the *scheme* should provide (e.g. a
sector-derived tail like greek has), or is it fine to leave the scheme as-is
and solve uniqueness entirely in AC6's separate mechanism? This choice changes
what AC6 builds.

**D4. The sky-click naming split (§3.3).** The same real star shows its real
name via the nav computer (`:2833`) but a procedural name via sky-click
(`:9493`), because the sky-click handler discards `entry.starData.name`.
*Decision:* ratify that "real stars should always show their real name on every
path" as a scheme rule (which AC7 would then implement), or accept the split.
This is a scheme-level question even though the fix lives in AC7.

**D5. The no-position fallback (§1.3, census "Path E").** When a spawn has no
override name, naming runs as generic-arm with sectorCode 0 and zero spatial
spreading. *Decision:* accept (it's a narrow branch), or require every spawn to
carry a position so the fallback never fires.

### For scoping the successor real-universe-overlay workstream

**D6. Which mechanism is the template?** Of the four (§2), only **KnownSystems**
already overrides *contents + names*; the other three override appearance or
label only. Your ask ("characteristics may have to replace the ones we have")
is a contents override, which today exists *only* for Sol. *Decision:* extend
the KnownSystems pattern to more objects, unify the four schemas, or add a
fifth overlay adapter. *Assessment (criterion = least new surface area):*
KnownSystems is the smallest step for *systems* specifically, because the
contents-override plumbing (`_knownSystemNames`, `findAt`, `generate()`)
already exists and is exercised by Sol every boot; the cost is authoring data,
not building a mechanism. This does not cover stars-without-systems or deep-sky
objects, which is why it's a fork, not a default.

**D7. The HYG catalog is 97.7% unnamed (§4.3).** 15,243 of 15,599 entries have
no usable name. *Decision / dependency:* regenerating `hyg-stars.json` via the
already-correct `scripts/process-hyg-catalog.mjs` is a prerequisite for "real
names for all findable stars," and should be an explicit early AC of the
overlay workstream rather than an assumption.

**D8. Real characteristics have no source today (§3.5).** No path delivers real
planets/masses/orbits; real stars contribute only a spectral type. *Decision:*
the overlay workstream must name where real characteristics come from (a
catalog of known exoplanets? real stellar parameters?) and how they replace
generated contents — this is genuinely new data + new merge logic, not a tweak
to existing paths. Flagging it now so it isn't discovered mid-build.

**D9. Schema unification (§2).** The four mechanisms disagree on position key,
identity flag, and name shape. *Decision:* an overlay spanning stars + deep-sky
+ systems either unifies these or tolerates four adapters. This is an
architecture decision to make *before* the overlay build, because it
determines whether the overlay is one system or four extensions.

---

## Appendix — file map

| Concern | File | Key lines |
|---|---|---|
| Name generator (all styles) | `src/generation/NameGenerator.js` | `generateSystemName:326-364`, `_classifyRegion:275-300`, `REGION_STYLES:307-312`, `_catalogName:414-423`, `generateSystemNames:565-613` |
| Seeded RNG + child streams | `src/generation/SeededRandom.js` | `child:93-96` |
| Handcrafted systems (Sol) | `src/generation/KnownSystems.js` | `KNOWN_SYSTEMS:34-68`, `findAt:76-87` |
| Real star catalog (HYG) | `src/generation/RealStarCatalog.js` | `load:44-57`, `findVisible:95-161` |
| Deep-sky style profiles | `src/data/KnownObjectProfiles.js` | profiles `19-1164`, `searchKnownObjects:1173-1191` |
| Real globular clusters | `src/generation/RealFeatureCatalog.js` | `_loadGlobularClusters:37-75`, `findNearby:83-106` |
| Known-object injection | `src/generation/GalacticMap.js` | build `181-188`, inject `1515-1566` |
| Naming touchpoints | `src/main.js` | nav merge `2833`, `_warpTargetName` chain `3325/3358/3420/3433`, spawn naming `4186-4194`, sky-click `9450-9499`, screensaver `9511-9553` |
| HYG processing script | `scripts/process-hyg-catalog.mjs` | name build `106-113` |
| Collision census | `docs/WORKSTREAMS/naming-census-uniqueness-2026-07-07/census-report.md` | headline, worst-offenders, HYG cross-check |

---

*Written for AC4 of `naming-census-uniqueness-2026-07-07`. Serves AC5 (your
ratify-or-amend review) and the scoping of the successor real-universe-overlay
workstream.*
