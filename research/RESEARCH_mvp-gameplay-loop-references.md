# MVP Gameplay Loop: Reference Patterns

**Prepared by:** Dana (research librarian), 2026-10-02
**For:** Well Dipper game-mode spine (signal → fly → scan → hold → appraise/cash → upgrade → bigger warps; gravity-well refuelling; stasis and rescue; gambit autopilot)
**Status:** Reference research. Not a design decision. Nothing here has been committed.

---

## How to read this

**Source key.** Every claim is tagged:
- **[F]** I fetched the page and read the relevant passage.
- **[S]** The claim came from a search-result summary. The URL is real, but I did not read the full page.
- **[M]** From my own memory of the game. Not verified in this session; treat it as a lead to check.

The **analysis** paragraphs in each entry are mine and are labelled. Build-cost tiers assume a solo beginner working with Claude on top of the systems Well Dipper already ships: supercruise, HELM cockpit with four glass panels (NAV / DRIVE / SURVEY / TARGET), mass-lock, the collision barrier, the procedural galaxy, and the warp.

- **Cheap** = days. Mostly new state plus a panel readout, built on existing systems.
- **Medium** = one or two weeks. Needs a new subsystem, such as trajectory prediction or an inventory UI.
- **Expensive** = needs authored content at volume, a simulation economy, or tuning against many playtesters.

### Framings in the brief (named, not challenged)

This was a background run, so I could not ask about these. I scoped to the brief as written and am flagging them here.

1. **Refuelling is framed as a frequent skill toy.** That pulls against the "slow contemplative pace" in PILLARS. The references below split on this. Elite makes scooping routine. Lunar Lander makes it the whole game. I treated refuelling as a short, tense set-piece that happens a few times per session, not a constant one.
2. **Mortgage, debt interest, inflation and shifting economies make up a full economic simulation.** The brief also calls the MVP a "cheap spine". I researched how games hold, appraise and collateralise items. I did **not** research macro-economy or inflation simulation (see "What I didn't cover").
3. **"Rare finds need manual play"** treats manual play as the real game and autopilot as a lesser version of it. PILLARS pillar 5 calls the two modes "siblings". The automation section offers a pattern that keeps both modes meaningful without ranking them.
4. **"Older / simpler games."** The best-documented design reasoning I found is mostly from 2010s–2020s indies (Outer Wilds, Dredge, Heaven's Vault). Older titles (Starflight, Lunar Lander, Star Control II) are included, but their design intent is less documented, so more of those entries are [M].

---

## 1. Signal / lead-driven exploration

The question is how a game makes "there's something here" readable, and how it makes the hunt-then-find feel good.

### 1.1 Outer Wilds signalscope: a directional instrument with distance

**What the source says [F].** Mobius's dev blog ("Separating the Signal From the Noise") records that the original signalscope had three problems: all sounds were on one frequency, localisation was poor, and the UI did not show distance or direction. The fix Alex Beachum calls "a gamechanger for the tool" was a **distance indicator**: "players were pointing the signalscope at, say, the rock in front of them, and think the signal was coming from that, when it's actually from the other side of the planet." Signals were also split into separate **channels**, and a "natural channel" was added for tornadoes and waterfalls so that ambient exploration was rewarded too. A search summary [S] adds that much of the narrative design was "created with the signalscope in mind".

**Analysis.** The lesson is specific. *Direction alone misleads; direction plus distance creates a hunt.* Channels let one instrument carry several kinds of lead (people, nature, the anomalous) without clutter. The payoff in Outer Wilds is **knowledge, not loot** [M]: the ship log fills in, and no inventory grows.

**Build:** Cheap. A bearing-and-range readout on the SURVEY panel, with a channel selector, is mostly a UI over existing positions. **Fit:** Very high. The instrument is diegetic and quiet, and it rewards attention rather than reflexes.

### 1.2 Elite Dangerous FSS + DSS: tune, then map efficiently

**What the source says.** The Full Spectrum System Scanner has three inputs: reticle movement, zoom, and a frequency bar you tune. It "automatically emits a regular pulse of energy that briefly highlights points of interest" [S, Steam guide summary; the Fandom wiki returned HTTP 402 when fetched]. The Detailed Surface Scanner fires probes, and if you map 90% of a body in at most the listed **"Efficiency Target"** probes (2–22 depending on mass), you earn a bonus. Mapped value is roughly 4–5× discovered value. "First discovery" and "first cartography" tags each add a 60% bonus [S].

**Analysis.** There are two good ideas here. (1) **Tuning a band** turns "where is it" into a perceptual puzzle, closer to tuning a radio than reading a list. (2) **The efficiency target** turns a chore (cover the sphere) into a small skill test (cover it in few shots). A recurring complaint about the FSS from memory [M] is that it is modal and slow when used on every body in every system. The skill test helps, but repetition at scale still wears it down.

**Build:** FSS-like tuning is Medium; probe-efficiency mapping is Medium. **Fit:** Good for the cockpit fiction. The risk is that it becomes the ME2 problem below if it is required on every body.

### 1.3 Heaven's Vault: lead chains through artifacts and inscriptions

**What the sources say.** From a GDC Vault listing and Wikipedia summaries [S]: the game "plays out as a detective story with the player following a chain of leads from one ancient ruin to another", with "no prescribed path, few bottlenecks and no fail state". It mixes authored content with "procedurally generated 'glue' content to ensure players are always making progress". A review I fetched [F, Just Adventure] says: "Like a trail of bread crumbs, each artifact or site that you examine leads to additional facts and areas to explore," and as you gather more, "it becomes easier to pin down a new site's location." A search summary [S] adds that merchants trade artifacts **for goods or leads on new sites**, and that translated inscriptions "reduce the area in which you need to search."

**Analysis.** This is the closest existing model for the human-remnant arc. Each artifact (a) has value, (b) carries a lead, and (c) **narrows a search area** instead of dropping a waypoint. "The lead shrinks the search cone" works well procedurally. A lead can be a galactic sector plus constraints (star class, a gas giant with rings, a moon around it), and each additional artifact tightens the cone. Selling an artifact versus keeping it to read its lead becomes a real choice.

**Build:** Medium as a system (a lead is a set of constraints over the seeded galaxy, which the procedural galaxy can answer). Expensive if you want authored inscription translation like Heaven's Vault; do not attempt that for the MVP. **Fit:** Very high. It is contemplative, and it can stay unexplained, like the warp.

### 1.4 Starflight (1986): orbital sensor read → land → rover finds ruins

**What the sources say [S].** The science officer scans a planet for temperature, gravity, composition, minerals and life, and readings are only as good as that officer's training. You then land and drive a terrain vehicle that "periodically scan[s]" for "minerals, lifeforms, and alien ruins". Money comes from selling minerals, artifacts and lifeforms, and from recommending colony worlds.

**Analysis.** Two patterns matter for Well Dipper. **Scanner quality gates the legibility of readings**, which is an upgrade path that changes *what you can see*, not just how fast you see it. And there are **two scan tiers**: orbital tells you whether a place is worth it, and close-in finds the thing.

**Build:** Cheap for tiered orbital readouts. **Fit:** High.

### 1.5 Subnautica scanner and Scanner Room

**What the sources say [S].** A handheld scanner scans fragments, and N fragments unlock a blueprint. The Scanner Room builds a local 3D map, scans for a chosen resource, and only lists "what is actually within its search radius."

**Analysis.** Partial-fragment progress ("2 of 3") is a cheap, satisfying meter. The Scanner Room shows a **lead-generation instrument whose range is the upgrade**.

**Build:** Cheap. **Fit:** Medium. Blueprint unlocking is more crafting game than drift game.

### 1.6 Highfleet radio interception

**What the sources say [S].** Players intercept transmissions by manually setting wavelength, direction and frequency, then decode them. Reviewers called the minigame "gimmicky and tiresome". In a Game Developer interview I fetched [F], Koshutin describes his analogue interfaces as "never… perceived as a menu. Rather, it is a small museum where you are allowed to touch and twist everything," and says "it is the analogue interface that gives this feeling of immersiveness."

**Analysis.** The aesthetic is right for the HELM glass. The repeated-minigame form is the risk. Use the knob feel once per lead, not once per readout.

**Build:** Medium. **Fit:** High aesthetically, but low tolerance for repetition.

### 1.7 Other references (unverified this session) [M]

- **FTL beacons:** the next jump is always a visible node with a hint marker (store, distress). Leads are cheap because the map is small.
- **Star Control II:** leads come from alien conversations and point to specific coordinates. It is hand-authored and expensive.
- **Elite (1984) / Frontier, Escape Velocity:** mostly trade and mission boards. There is no real signal-hunt layer, which is a gap Well Dipper can fill.
- **No Man's Sky:** the scanner pulse paints icons on the world. Readable, but it trains players to follow icons rather than look.
- **Out There:** probing a gas giant for H/He fuel. The "lead" is just a planet type icon [S confirms the probing, M the rest].
- **Sunless Sea:** port reports and rumours act as leads [M].
- **Dredge:** odd fishing spots show as disturbed water [M].

### 1.8 Counterexamples: scanning as a chore

**Mass Effect 2 [S].** You move a slow reticle over a planet and fire a probe when an oscilloscope spikes. Players called it "long, tedious, unbelievably repetitive". The diagnosis in those threads is mechanical, not conceptual: the cursor is slow until upgraded, minerals are "randomly placed" so "you truly have to search everywhere", and "gathering them is not challenging at all, just really time consuming." One Destructoid writer liked it as a meditative activity, which is worth knowing given Well Dipper's tone.

**Starfield [S].** PC Gamer called planetary exploration "a horrendous chore, where the grand scale is merely an illusion." Players "exhaustively scan[ned] a bunch of stuff until there was nothing new to find". Commentators blame procedural repetition: the "same set of bases, caves, and locations copied everywhere". I could not fetch the Todd Howard interview page (HTTP 403), so I am not quoting him.

**Analysis: why these fail and Outer Wilds doesn't.** I see four failure conditions:
1. **No information before effort.** ME2 gives no lead about where to look.
2. **Completion percentages without stakes.** Starfield's surveys feel like quotas.
3. **Effort that tests patience, not judgement.** A slow cursor tests nothing.
4. **Payoffs that are interchangeable.** Mineral number +N, or another copied outpost.

The working examples avoid all four. They give direction plus distance before effort, they let you skip anything without penalty, they test reading, tuning or efficiency, and they pay off in something unique, such as a story beat or a constraint that narrows the next search. **This matters for a procedural game.** Well Dipper's finds must be varied enough, or rare enough, that the fourth condition does not apply. A rare, visually distinct find on the body itself is the defence. The brief already asks for this.

---

## 2. Refuelling as a skill toy

### 2.1 Elite Dangerous fuel scoop: proximity vs heat

**What the source says [F, Lave Wiki].** "Scooping rate is based on distance from the corona, rather than speed." Heat is the danger: "It is very easy to quickly heat up and suffer damage, even when quite far away from the star," and damage begins at 150% heat. Only some star classes can be scooped (DA, DC, L, T, TTS and Y cannot). Upgrades scale rate a lot: Class 1A gives 42 kg/s and Class 4C gives 245 kg/s, and "A-rated scoop can be more effective than a low rated higher class scoop." A Steam guide summary adds [S] that you must face the star, and that the comfortable band is 70–80% heat.

**Analysis.** This is the clearest proven template. Its strengths are a single readable risk dial (heat), a continuous skill (holding the right distance), upgrades that change the rate rather than the act, and star type as a filter on where you can refuel. Its weakness, from memory [M], is that experienced players find scooping a reflex with no tension once their gear is good. The risk curve flattens with upgrades. A design note follows: **upgrades should open deeper and stranger wells, not just make shallow ones safe.**

**Build:** Cheap. Well Dipper already has distance-to-body, mass-lock and the collision barrier. **Fit:** High.

### 2.2 Lunar Lander (Atari, 1979): fuel is the clock

**What the source says [F, Wikipedia].** Fuel replaced the timer: players bought fuel with coins, and when fuel ran out the game was over. Points scaled with 2×–5× multipliers for harder landing pads. Co-designer Wendi Allen found that the first faithful-physics version was nearly impossible: "even the real lunar landers had computer assist!" They added difficulty levels.

**Analysis.** There are two lessons. **Fuel can be the timer, and the score multiplier for harder targets is the risk/reward.** And **real physics needs assistance to be playable.** For Well Dipper, take the feel of orbital mechanics, not the precision.

**Build:** Cheap. **Fit:** Medium. The landing mechanic itself is off-tone, but the multiplier-for-difficulty idea transfers.

### 2.3 Kerbal Space Program: gravity assists and Oberth burns as discoverable mastery

**What the source says [S].** Falanghe's systems were "about presenting key information to players in ways that wouldn't be too intimidating," such as showing that you were in orbit "without a daunting wall of numbers." Players reached orbit "before the game had information on the interface to show they were in orbit."

**Analysis.** In KSP, gravity-assist mastery is emergent and slow to learn [M]. Many players never do one. For Well Dipper, the takeaway is to **show the outcome of a pass before the player commits**, like a ghost trajectory or a predicted yield, so the skill becomes judgement rather than calculation.

**Build:** Medium to Expensive (trajectory prediction). **Fit:** Medium. KSP's precision is off-tone.

### 2.4 Gravity Ghost: orbiting as play, not chore

**What the sources say.** It is a "2D orbiter rather than a 2D platformer": you circle tiny planets and push off into "graceful loops" [S]. In a Game Developer article [F], Erin Robinson says she learns "by watching the playtesters": players enjoyed walking in circles around planets, so she built mechanics that reward that behaviour. The GDC 2015 postmortem exists on GDC Vault and archive.org [S]; I did not watch it.

**Analysis.** Its feel shows that orbiting can be the verb itself and still be contemplative. That supports a refuel mechanic that *feels like dancing with a well*, rather than a heat bar.

**Build:** Depends on the mechanic. **Fit:** Very high in tone.

### 2.5 Other references (unverified this session) [M]

- **Thrust** and **Solar Jetman:** inertia plus gravity with a towed load. The skill is managing momentum under a pull. Solar Jetman's tethered "pod" is a direct ancestor of "carrying fragile cargo near a well".
- **Out There [S]:** probe gas giants for H/He fuel and mine rocky planets for hull. Refuelling is a menu choice there, not a skill.
- **FTL:** running out of fuel lets you send a distress signal that may bring help or hostiles [M]. This is a cheap precedent for Max's stasis-and-rescue idea.

### 2.6 The real physics, as raw material

**What the sources say [F, Wikipedia "Gravity assist"; S, Wikipedia "Oberth effect"].**
- **Gravity assist.** "In the planet's frame of reference, the space probe leaves with the exact same speed at which it had arrived." Speed is gained only relative to the Sun, by borrowing a little of the planet's orbital motion. Wikipedia uses a train analogy: a ball thrown at an oncoming train bounces off and leaves faster relative to the platform.
- **Closer is stronger.** "The closer to the center of the planet that approach is, the greater the achievable change in velocity," but atmosphere limits how close you can go, since drag "can exceed that gained".
- **Oberth effect.** The same burn adds more kinetic energy when you are moving faster, so the best place to burn is the lowest, fastest point of the orbit (periapsis). "A given rocket burn always provides the same change in velocity, but the change in kinetic energy is proportional to the vehicle's velocity at the time of the burn."
- **Powered flyby.** Burning near closest approach "can add the Oberth effect to the gravity slingshot effect, producing a larger change in orbital velocity than either effect by itself."

**Analysis: what this gives the fiction.** Real physics gives you no free energy from a well, only borrowed motion and better leverage for fuel you already carry. A "gravity drive that refuels from wells" is therefore **fiction**, which is fine, and it can stay unexplained like the warp. But the real physics provides a **true, intuitive rule set** the player can feel:
1. Deeper equals more.
2. Faster at the bottom equals more.
3. Moving bodies (moons around a giant, planets around a star) give more than static ones.
4. Something always caps how deep you can go: atmosphere, heat, tides, the surface.

Each of the candidates below is built on one of those four rules.

### 2.7 Five candidate gravity-drive refuel mechanics

**A. Periapsis Dip ("the dip").** You plunge toward a body and the drive charges at a rate that rises steeply with depth (for example, inverse square of altitude). A stress gauge also rises: tidal strain near rocky bodies, heat near stars, drag in an atmosphere. You must commit to the exit before stress maxes out, or the ship sustains damage.
- **Skill tested:** judging depth and exit timing. This is the Elite scoop's proximity-versus-heat logic expressed in Well Dipper's own terms.
- **Upgrades:** stress tolerance (dip deeper), collector efficiency (more per second), and a cockpit "depth line" readout at higher scanner tiers that shows the safe floor.
- **Risk/reward:** the payout per pass curves sharply in the last 10% of depth.
- **Build:** Cheap. Altitude, the collision barrier and mass-lock already exist. **Fit:** Very high. The name of the game is "Well Dipper".

**B. Slingshot Harvest.** The charge equals the turn angle of a fast flyby around a *moving* body (gravity-assist rule 3). The cockpit draws a predicted pass corridor, and threading a tighter, faster line yields more.
- **Skill tested:** lining up an approach vector and holding it.
- **Upgrades:** prediction quality (a longer, more accurate ghost line), and harvest efficiency per degree of turn.
- **Build:** Medium (trajectory prediction against moving bodies in supercruise). **Fit:** High, and it reads beautifully on screen.

**C. Resonance Pump.** You hold a near-circular orbit and pulse the drive in time with an on-glass rhythm tied to the orbital period. In-phase pulses bank charge and out-of-phase pulses bleed it. Deeper orbits have a faster rhythm and a bigger payout.
- **Skill tested:** rhythm and attention.
- **Upgrades:** a wider timing window, multi-phase pumping.
- **Build:** Cheap to Medium. **Fit:** Very high for contemplative play, and the most screensaver-compatible of the five. The autopilot could do a lesser version.

**D. Well Chain.** Consecutive dips across different bodies within a time window multiply the yield (moon → giant → moon, or a binary star's two wells).
- **Skill tested:** route planning in-system.
- **Upgrades:** a longer chain window, a higher multiplier cap.
- **Build:** Medium. It layers on A or B. **Fit:** High. It turns the system map into a refuelling puzzle.

**E. Well Grade by body type.** Not a separate verb. It is a yield/risk table over the procedural catalogue: gas giants are safe and modest, M dwarfs are moderate, white dwarfs and neutron stars pay huge but need upgrades to approach at all, and black holes are the endgame. This is Elite's scoopable-star filter turned into a ladder.
- **Skill tested:** knowledge of the galaxy.
- **Upgrades:** unlock access to more extreme grades.
- **Build:** Cheap. It is a table. **Fit:** Very high. It ties refuelling to discovery and "stranger things", and gives bigger warps a reason to reach exotic stars.

**My recommendation for the spine:** **A + E** first (cheap, on-name, upgrade ladder built in). Add **C** as the autopilot-safe variant. Defer **B** and **D** until trajectory prediction exists for other reasons.

---

## 3. Holding, appraising and cashing in loot

### 3.1 Dredge: a spatial hold that is also your health

**What the source says [F, Game Developer deep dive, Joel Mason].** "Items have to be weighed up against others, and depending on the player's current situation, one may be more suitable than another." Damage takes up grid space, so the hold doubles as the health system, and players trade rods (fishing speed) against cargo space. "Most key items can be destroyed… players can discard people's packages, unique items, or even… characters." The grid is "the perfect opportunity for upgrades to fit into the core loop," and playtesters called packing "fun", with "a definite sense of satisfaction gained from slotting a plaice into the perfect place." A search summary [S] adds that the spatial inventory was added after the prototype, and that the team then found "everything revolved around" it. Aberrations, the mutated high-value catches, I know only from memory [M]; I did not verify their mechanics.

**Analysis.** For Well Dipper, a small grid hold on a cockpit panel turns "should I carry the dangerous alien artifact" into a physical decision: it takes up 3×2, and it might cost hull cells if it acts up. Hold expansion is the upgrade path, as Mason says.

**Build:** Medium (grid UI and item shapes). **Fit:** High. A "house-sized" ship with limited cargo is consistent with the fiction.

### 3.2 Diablo-style identify / appraisal [M]

Unidentified items show only a base type. A scroll or an NPC (Deckard Cain in Diablo II) reveals their properties.

**Analysis.** Appraisal works as a **second reveal**. You get one hit of excitement when you find the object and another at the settlement. In Well Dipper terms, the scan in the field gives you a class ("ancient human, pre-schism, intact"). The appraiser gives you value, the lead it contains, and whether it is dangerous. That splits one moment into two without adding systems.

**Build:** Cheap. **Fit:** High.

### 3.3 Elite Dangerous: unsold data is lost on death

**What the sources say [S, Steam threads].** "If your ship blows up with exploration data unsold, you lose the data." Selling at any Universal Cartographics office "locks in" discoveries.

**Analysis.** This is the cheapest risk/reward possible: carrying data is carrying risk, and that drives the "go home and cash in" rhythm. In Well Dipper, death is replaced by stasis, so the analogue would be **data degrading during stasis** (time debt corrupts unsold data). That ties three of Max's systems together.

**Build:** Cheap. **Fit:** High.

### 3.4 Escape from Tarkov: secure container plus insurance

**What the sources say [S].** Insurance is a fee paid before a raid. Lost gear returns after 12–36 hours *unless another player extracted it*. Faster insurers charge more. The secure container is a small slot whose contents always survive death; it holds found loot, not worn gear. Some item classes cannot be insured.

**Analysis.** Two transferable ideas. (1) **A small "always safe" slot** reduces the feel-bad of loss while keeping most of the hold at risk. Upgrading its size is a natural purchase. (2) **Insurance as a prepaid cost with a delay** is a cousin of Max's rescue bounty. The player pays in time or money, chosen in advance. The PvP element does not transfer.

**Build:** Cheap (the secure slot). **Fit:** Medium to High.

### 3.5 Sea of Thieves: loot is physical and its condition matters

**What the sources say [S].** Merchant Alliance cargo must arrive within a time limit and "in good condition"; if mishandled, its condition worsens and the gold payout drops. Commissioned goods sell for ten times their normal value if delivered on time. Treasure is carried physically and can be stolen [M].

**Analysis.** **Condition as a value multiplier** suits "possibly dangerous alien artifacts". Rough flying, or a deep dip with an unstable artifact aboard, degrades it. That links the refuel skill to the loot loop.

**Build:** Cheap. **Fit:** High.

### 3.6 Collateral, loans and debt (thin literature) [M]

I found little documented design writing on **mortgaging items**. From memory:
- **Recettear:** a shopkeeper game built on weekly debt repayments; missing one ends the game.
- **Animal Crossing:** Tom Nook's mortgage has no interest and no deadline, a deliberately low-stress design.
- **Sunless Sea:** has items with no use beyond resale, though its postmortem [F] admits the early game was "rawer and grindier than it should have been".

**Analysis.** "Mortgage the artifact instead of selling it" is a clean idea. You get cash now and keep the artifact's *lead*, but if time debt grows, the lender seizes it. I could not find a proven reference that does exactly this, so it is untested design, not established pattern.

**Build:** Medium. It is cheap as a single loan slot and becomes Expensive once interest, inflation and economic drift are added.

---

## 4. Automation handoff

### 4.1 Final Fantasy XII gambits

**What the source says [F, Game Developer].** Takashi Katano: FF4's monster AI "was somewhat similar to the Gambit system", and "having the player pick out commands for every single one of them would have taken away from what was supposed to be the fun of the game." Ito designed the system [S, Wikipedia]. The team "feared that if they added just the real-time aspect… controlling everything might be too fast-paced," and gambits were the solution.

**Analysis.** Gambits succeed because **writing the rules is itself the play**, and rule slots and rule *conditions* are unlocked by progress [M]. The automation's ceiling is set by what the player has earned and written.

### 4.2 Dragon Age: Origins tactics

**What the sources say [S, wiki].** Each slot is IF condition → THEN action, checked top to bottom, and the first match wins. Characters start with 2 slots and gain more at set levels or through a skill. There are up to three saved presets.

**Analysis.** This is the cleanest spec to copy: **an ordered list, first match wins, slots as an upgrade, presets.**

**Build (gambits/tactics):** Medium. A rule evaluator is simple, but a good rule-editor UI on cockpit glass is real work. Start with 3 slots and a fixed menu of conditions and actions. **Fit:** High. A "ship's standing orders" panel fits the old-watch ship.

### 4.3 Idle and incremental design: caps and returning

**What the sources say.** Melvor Idle simulates offline time "as if the player had remained online", up to **24 hours** [S, Melvor wiki]. Eric Guan's "Idle Game Design Principles" [F] uses staggered caps: "Cheese-producing Creameries cap every 5 hours… If Cheese remains uncollected for 5 hours, the stash fills up and the Creamery stops producing." Active and casual players are each served by different production clocks. The Wikipedia summary [S] says idle games balance "rules that encourage players to leave the game and rules that reward them for returning."

**Analysis.** There are three ways to keep manual play meaningful without making autopilot pointless:
1. **Cap by storage, not by nerf.** The autopilot fills a small "unsorted signals" buffer and stops when it is full. This is Guan's cap.
2. **Cap by verb.** The autopilot can travel, dip shallow wells (Resonance Pump, candidate C) and collect *leads*. Deep dips, artifact retrieval and appraisal are manual verbs.
3. **Cap by slot.** The number of gambit slots is an upgrade.

Option 2 gives the screensaver a real job: **it is a lead-generator.** You come back to a queue of signals it logged while you were away, and manual play follows them up. That makes the two modes partners, which respects pillar 5. Rare finds stay manual by construction, without an arbitrary drop-rate penalty.

**Build:** Cheap for options 1 and 2. **Fit:** Very high.

---

## 5. Build-cost summary

| Pattern | Build | Fit | Notes |
|---|---|---|---|
| Signalscope (bearing + range + channels) | Cheap | Very high | Distance was the "gamechanger" [F] |
| Tiered orbital readout (Starflight) | Cheap | High | Scanner tier gates readability |
| Lead = shrinking search cone (Heaven's Vault) | Medium | Very high | Core of the artifact arc; skip authored translation |
| FSS-style band tuning | Medium | High | Risk of ME2-style repetition |
| DSS-style efficiency target | Medium | Medium | Optional mastery layer |
| Periapsis Dip (A) | Cheap | Very high | Elite scoop logic, on-name |
| Well Grade table (E) | Cheap | Very high | Ties fuel to discovery |
| Resonance Pump (C) | Cheap–Med | Very high | Autopilot-safe |
| Slingshot Harvest (B) / Well Chain (D) | Medium | High | Needs trajectory prediction |
| Grid hold (Dredge) | Medium | High | Upgrades plug in naturally |
| Two-stage reveal: field class → appraiser value | Cheap | High | Second hit of excitement |
| Unsold data / condition decays | Cheap | High | Links stasis to loot |
| Secure slot (Tarkov) | Cheap | Med–High | Softens loss |
| Single-artifact mortgage | Medium | Medium | Untested in references |
| Inflation / economic drift | Expensive | Unclear | Not researched |
| Gambit autopilot, 3 slots, fixed menu | Medium | High | DA:O spec |
| Autopilot as lead-generator, capped buffer | Cheap | Very high | Pillar-5-friendly |

---

## Recommended patterns for the spine

Ranked by how much loop each buys per unit of cost, judged against PILLARS (contemplative, powerful but fragile, warp unexplained).

1. **Signalscope with distance on the SURVEY panel.** This is the cheapest way to make "there's something here" readable, and the only scanning pattern in this survey whose fix is documented by its own developer as transformative. Without distance, players misread direction (Mobius [F]).

2. **Leads as shrinking search cones (Heaven's Vault), with artifacts as lead carriers.** This is the skeleton of the whole artifact arc, and it runs on the procedural galaxy Well Dipper already has. It also creates the sell / mortgage / keep tension for free: selling an artifact loses its lead.

3. **Periapsis Dip + Well Grade table.** One refuel verb on the game's own name, with a risk dial (stress) and a ladder (body grades) that upgrades extend *outward* toward stranger wells rather than making shallow wells trivial. That ordering corrects Elite's flattening-tension problem [M].

4. **Two-stage reveal plus risk while carrying.** Classify in the field, appraise at the settlement. Unsold data and fragile artifacts degrade with rough flying and with stasis time debt. This links refuel skill, the stasis mechanic and the cash-in loop using only a few numbers, with no new simulation.

5. **Autopilot as a capped lead-generator.** Standing orders (DA:O-style ordered IF/THEN, 3 slots to start), a buffer that fills and stops, and manual-only verbs for deep dips and retrieval. Rare finds stay manual by design, and the screensaver is a sibling with a real job.

**What to defer.** Inflation and shifting economies, interest-bearing debt beyond one loan slot, FSS-style band tuning, trajectory-prediction mechanics (B, D), and any Highfleet-style minigame repeated per readout. Each is either Expensive or carries a documented chore risk (ME2, Starfield, Highfleet reviews).

**Defence against the chore failure.** Every scan in the spine should satisfy four conditions:
- (a) it starts from a lead, not a blind sweep;
- (b) it is skippable;
- (c) it tests judgement rather than patience;
- (d) it pays off in something unique, ideally visible on the body itself.

If a proposed scan fails any of these, it is a candidate ME2.

---

## What I didn't cover and why

- **Macro-economy, inflation and settlement economies shifting over time.** These are their own research topic (economic simulation in games: X4, Mount & Blade, Patrician). They also conflict with "cheap spine". Worth a separate brief if Max wants it.
- **Time-debt and relativistic time-skip precedents.** There is already `research/RESEARCH_relativistic-experience.md`, which I did not re-read. I did not look for new game references here.
- **Rescue precedents beyond FTL [M].** Elite's player-run Fuel Rats [M] is a community phenomenon, not a mechanic. I did not verify it.
- **Full talks.** I did not watch the Outer Wilds GDC 2020 or Gravity Ghost GDC 2015 postmortem videos. The Gravity Ghost lessons here come from a secondary article.
- **Dredge aberrations, Diablo identify, FTL, Star Control II, Escape Velocity, Thrust, Solar Jetman, No Man's Sky.** All of these are from memory [M]. They are low-risk, but treat them as unverified.
- **Fetch failures:** the Elite FSS Fandom wiki (HTTP 402), the Todd Howard Starfield quote page (HTTP 403), and the Outer Wilds GDC article (landing page only). Claims tied to those topics rely on other sources or are marked [S].

---

## Sources

Fetched [F]:
- Mobius Digital, "Separating the Signal From the Noise": https://www.mobiusdigitalgames.com/news/separating-the-signal-from-the-noise
- Game Developer, "Deep Dive: The surprising depth of spatial inventories in Dredge": https://www.gamedeveloper.com/design/deep-dive-the-surprising-depth-of-spatial-inventories-in-dredge
- Just Adventure, Heaven's Vault review: https://www.justadventure.com/2019/04/17/heavens-vault-review/
- Game Developer, Heaven's Vault preview (translation-focused): https://www.gamedeveloper.com/design/-i-heaven-s-vault-i-inkle-s-game-about-a-nebula-riding-archaeologist
- The Browser, Jon Ingold notes: https://thebrowser.com/notes/jon-ingold/
- Lave Wiki, Fuel Scoop: https://lavewiki.com/fuel-scoop
- Wikipedia, Gravity assist: https://en.wikipedia.org/wiki/Gravity_assist
- Wikipedia, Lunar Lander (1979): https://en.wikipedia.org/wiki/Lunar_Lander_(1979_video_game)
- Game Developer, Gravity Ghost design: https://www.gamedeveloper.com/design/space-oddity-deconstructing-the-curious-design-of-i-gravity-ghost-i-
- Game Developer, FF4 and FF12 gambits: https://www.gamedeveloper.com/design/why-i-final-fantasy-iv-i-was-key-to-i-ffxii-i-s-ai-driven-gambit-system
- Eric Guan, Idle Game Design Principles: https://ericguan.substack.com/p/idle-game-design-principles
- Game Developer, Sunless Sea postmortem: https://www.gamedeveloper.com/audio/postmortem-failbetter-games-i-sunless-sea-i-
- Game Developer, Designing Highfleet: https://www.gamedeveloper.com/design/designing-i-highfleet-i-a-strategy-game-with-heavy-machinery-and-twirling-knobs

Search-result summaries only [S]:
- Wikipedia, Oberth effect: https://en.wikipedia.org/wiki/Oberth_effect
- GDC Vault, Heaven's Vault: Creating a Dynamic Detective Story: https://gdcvault.com/play/1025392/-Heaven-s-Vault-Creating
- Wikipedia, Heaven's Vault: https://en.wikipedia.org/wiki/Heaven%27s_Vault
- GDC Vault, Outer Wilds narrative talk: https://gdcvault.com/play/1027008/Independent-Games-Summit-Sparking-Curiosity
- Steam guide, Elite FSS: https://steamcommunity.com/sharedfiles/filedetails/?id=2009331585
- Elite DSS wiki: https://elite-dangerous.fandom.com/wiki/Detailed_Surface_Scanner
- Steam thread, Elite data lost on death: https://steamcommunity.com/app/359320/discussions/0/405691491124329884/
- Fextralife, ME2 planet scanning thread: https://fextralife.com/forums/p6767009/planet-scanning-worst-idea-of-mass-effect-2/
- Destructoid, "I like scanning planets": https://www.destructoid.com/a-mass-effect-confession-i-like-scanning-planets/
- PC Gamer, Starfield review: https://www.pcgamer.com/starfield-review/
- Game Design Skills, Why Did Starfield Fail: https://gamedesignskills.com/game-design/why-did-starfield-fail/
- Wikipedia, Starflight: https://en.wikipedia.org/wiki/Starflight
- Subnautica wiki, Scanner Room: https://subnautica.fandom.com/wiki/Scanner_Room_(Subnautica)
- Wikipedia, HighFleet: https://en.wikipedia.org/wiki/HighFleet
- Dragon Age wiki, Tactics (Origins): https://dragonage.fandom.com/wiki/Tactics_(Origins)
- Wikipedia, Final Fantasy XII: https://en.wikipedia.org/wiki/Final_Fantasy_XII
- Melvor Idle wiki, Offline Progression: https://wiki.melvoridle.com/w/Offline_Progression
- Wikipedia, Incremental game: https://en.wikipedia.org/wiki/Incremental_game
- Tarkov secure containers guide: https://tarkovescapezone.com/articles/tarkov-secure-containers-in-2026-a-loot-goblin-s-guide-to-not-losing-everything
- Sea of Thieves wiki, Merchant Alliance: https://seaofthieves.fandom.com/wiki/Merchant_Alliance
- TouchArcade, Out There review: https://toucharcade.com/2014/03/04/out-there-review/
- RocketSTEM, KSP: https://www.rocketstem.org/2015/07/07/kerbal-space-program-brings-rocket-science-to-video-gaming/
- GDC Vault, Gravity Ghost postmortem: https://gdcvault.com/play/1022023/Gravity-Ghost-A
