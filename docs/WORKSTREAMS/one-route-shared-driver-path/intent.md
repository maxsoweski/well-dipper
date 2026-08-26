# one-route-shared-driver-path — intent

## Why we care

Max, 2026-08-21:

> "what I care about is going forward the game engine and world engine (lod lab) are connected such
> that a change to one affects the other and we don't have to spend a month (like we have in this
> workstream) porting over lab features to the main game; I want all the lab features (unless
> depricated) to be in the game, wired up, and anything new we develop in the lab should be wired as
> we develop it"

⛔ **HE HAS SAID THIS BEFORE AND THE SYSTEM DID NOT HOLD.** It is already standing constraint #2 in
the plan of record (`docs/FEATURES/lab-pipeline-into-game-PLAN.md:87`, 2026-08-01, his words):

> "We will likely do additional development in the world engine lab, and so we need to easily be able
> to move the latest developments from that lab into the main game in the future."
> → **The load-bearing one.** … The seam must be **shared modules that the lab itself imports**, so
> "porting" a future lab change is not an action anyone has to take.

So this workstream is not a new idea. It is the constraint being made **structural** instead of
aspirational, because stated as a rule it was dropped.

**What the diagnosis says, and it is the plan's own** (§"Why migrations are expensive today"): the
lab and the game reach the world engine by TWO SEPARATE ROUTES, so each migration is a hand
reconciliation. Its named fix — *"Extract `applyDrivers` into the shared pipeline and have the LAB
IMPORT IT BACK"* — is called **"the single highest-leverage unblock in this file"** and has not been
done. Measured 2026-08-21: `applyDrivers` is still at `world-engine-lab.html:1933`, **828 lines, 146
distinct state fields**, with no counterpart under `src/`; the lab HTML has GROWN 6420 → 6559 since
the plan measured it.

Meanwhile eight per-pack extractions shipped, and **seven of the eight were never imported back by
the lab** — first measured by `tests/one-pipeline-fence.test.js` registration 2, 2026-08-21. The
discipline held for pack #1 and was dropped for every pack after it. The plan also warned the
sequencing would cost twice: *"do 1 and 2 BEFORE wiring moons/gas giants. Wire them first and you
wire them into the two-route world, then pay to migrate them a second time."* Gas giants, moons and
rocky bodies were wired first. That is the month he is describing.

⚠ **In fairness, and recorded so this is not read as pure waste:** those packs did reach players at
B7. The route was expensive, not fruitless.

## Success criteria (Max's language)

- "a change to one affects the other" — the lab and the game run **the same driver code**, so a
  change made in one is live in the other with no porting action by anyone.
- "we don't have to spend a month porting over lab features to the main game" — wiring the NEXT lab
  feature is not a hand reconciliation of two routes.
- "anything new we develop in the lab should be wired as we develop it" — a new pack **cannot ship**
  without the lab importing it. Not a convention: a gate that fails by name.
- "I want all the lab features (unless depricated) to be in the game, wired up" — the remaining
  wireable features become cheap to wire, because there is one route to wire them into. ⚠ The wiring
  itself is the FOLLOW-ON workstream, sequenced after this one, deliberately: wiring first is what
  the plan warns costs twice.

## Deliberate non-goals

- ⛔ **Wiring the ~26 currently-wireable lab features.** That is the follow-on, and doing it here
  would repeat the exact sequencing mistake this workstream exists to stop.
- ⛔ **Authoring the 8 missing driver laws.** Max: *"yes we need to author these"* — but they are
  design work with his taste in them, not wiring, and they are their own workstream.
- ⛔ **Closing all 13 import-back debt rows as an end in itself.** They are the symptom; most close
  as a consequence of one route existing. Rows that do not are declared, not forced.

## The carve-out Max added, which bounds the work

> "keep in mind we have develop features in world engine that are now legacy and not actually used in
> the lod lab; i don't want to waste time on those"

⭐ **This lands on the EXTRACTION, not only on the follow-on.** `applyDrivers` is 828 lines and some
of what it holds is dead — engine features the lab itself no longer exercises. Extracting wholesale
would carry that dead weight into the shared pipeline and make every future reader pay for it. So
identifying the legacy set is IN scope here, and what is dead is excluded from the extraction and
recorded as deprecated rather than silently dropped.
