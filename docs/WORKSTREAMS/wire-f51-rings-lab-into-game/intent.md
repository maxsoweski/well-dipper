# wire-f51-rings-lab-into-game — intent

## Why we care

Max, 2026-08-26: *"Our goal is to wire up the World Engine renderer. If the world engine renderer is
missing something important, then we need to log that as something important to work on after we get
things wired up. But we can't shoestring everything together."*

And the program's standing constraint #3, Max 2026-07-31, verbatim in
`docs/FEATURES/one-pipeline-two-frontends-PLAN.md:95`: **"REPLACE, not graft"** —
*"the goal here is to have the lab's rendering pipeline in the game — the procgen and the rendering
itself."*

**F51 (Rings) is `LAB ✅ | GAME ❌ R`** in that plan's checklist — the lab has a ring that has been
observed rendering, and the game has its own parallel implementation to delete. The honest headline
on the whole program is **4 of 53 features driven by the world engine in both lab and game**; this
moves one more.

Max also ruled, asked directly whether the discarded ring physics should be wired: *"yes I want this
wired."*

⛔ **This workstream builds no new renderer capability.** Everything it needs already exists in
`world-engine-lab.html`. Where the lab is missing something, it gets a backlog row and stays missing.

## Success criteria (Max's language)

- The game's rings are drawn by **the lab's ring**, not by the game's own hand-written one.
- Rings show **real gaps where the moons actually put them**, and their colour comes from **what the
  ring is made of** — ice, rock or dust — instead of one fixed palette on every planet.
- Tilt a ring toward edge-on and its bands **fade smoothly to an even tone** instead of flickering
  and crawling. (Max's ruling this session, accepting the recommendation: smooth is correct.)
- ⭐ **Nothing else about the universe moves.** Same planets, same moons, same seeds.

## Deliberately NOT in this workstream — logged, not built

- **Fine detail inside a ring band.** Measured: once moons are wired, 24 of 33 rings get zero
  resonance gaps and none gets more than two, so 73% render as a single flat band. The lab has no
  intra-band texture model either. ⭐ **Max already logged this himself** as **QB-14** in
  `docs/FEATURES/mvp-spine-lab-quality-backlog.md` — *"Rings — composition + lighting appearance —
  'have not been worked out at all yet'"*, UNBUILT / ABSENT. That row is the home for it.
- **The rings-v2 near-tier particle cloud** (`world-engine-lab.html:745+`). A separate LOD tier.
  Wiring it in the same increment would make any failure unattributable between the two tiers.
- **Ring faintness.** 67% of generated rings sit at the `density` floor of 0.2 and draw ~2 pixels in
  16. That is the age model working as written (`PhysicsEngine.js:937`). ⚠ Flagged as risk, not
  fixed: the lab has only ever rendered a *young dense* disk (`ageGyr: 0.3`), so the tenuous regime
  is unobserved on either side. That is this plan's own risk #13.

## ⛔ Sequencing — this is BLOCKED, and deliberately

Corrected after reading `docs/WORKSTREAMS/one-route-shared-driver-path/`. Max, 2026-08-21:

> *"what I care about is going forward the game engine and world engine (lod lab) are connected such
> that a change to one affects the other and we don't have to spend a month (like we have in this
> workstream) porting over lab features to the main game"*

Hand-porting the lab's ring shader into `Planet.js` is **exactly that month**. It would make rings
the ninth extraction the lab never imports back, and the plan of record warns in its own words:
*"do 1 and 2 BEFORE wiring moons/gas giants. Wire them first and you wire them into the two-route
world, then pay to migrate them a second time."*

**The route is 2 debt rows from done** (13 → 2, measured; `tests/one-pipeline-fence.test.js` green,
31 assertions). So rings wait, and then ride the finished route as a shared module both front-ends
import. That is also this workstream's cleanest possible proof of AC5 in the route contract —
*"wiring the NEXT lab feature is demonstrably not a hand reconciliation of two routes."*
