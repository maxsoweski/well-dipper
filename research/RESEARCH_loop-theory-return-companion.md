# Loop Theory, Reward, Returning, and the Ship Companion

**Prepared by:** Dana (research librarian), 2026-10-02
**For:** Well Dipper MVP play loop (the eight-chart v2 loop design), the screensaver hand-off, and the proposed ship-AI companion
**Status:** Reference research plus a diagnosis of the v2 charts. Nothing here is a committed design decision.
**Companion doc:** `research/RESEARCH_mvp-gameplay-loop-references.md` (game-by-game patterns for signals, refuelling, holds, gambits). I don't repeat it here; where it already covers something, I point to it.

---

## How to read this

**Source key.** Every factual claim carries a tag:
- **[F]** I fetched the page and read the passage.
- **[S]** The claim comes from a search-result summary. The URL is real, but I didn't read the full page, usually because it was a PDF the fetcher couldn't decode or the site returned 403.
- **[M]** From my own memory. Not verified in this session; treat it as a lead.

Paragraphs headed **Analysis** are my reasoning, not the sources'.

**Rigor flags** on the research literature: **rigorous** (peer-reviewed, empirical), **practitioner** (designer talks and essays: real experience, no controlled evidence), **popular** (journalism, wikis).

### Framings in the brief (named, not challenged)

This was a background run, so I couldn't ask about these. I scoped to the brief as written.

1. **"Something like Clippy."** Clippy is the best-documented failure of an assistant character in software history. I've read "like Clippy" as meaning *a small character that offers help*, not as wanting Clippy's behaviour, and section 4 is built around avoiding what made Clippy fail.
2. **"Make the loops tight and rewarding."** Loop tightness comes from free-to-play and idle design, where the goal is retention. PILLARS sets a different goal: a contemplative game. I've kept the loop vocabulary and judged every recommendation against "would this pressure a player to return?" Section 2.4 draws that line.
3. **"Avoid the AI-content tag."** Section 4.5 shows that Valve's rule covers more than live generation. Under the wording I fetched, companion lines *written with* an AI tool and shipped also need disclosure. That affects how the lines get written, not only how they're delivered.

---

## 1. Game loop theory: a diagnostic vocabulary

### 1.1 Loops, arcs, and skill atoms (Daniel Cook, Lostgarden) — *practitioner, widely adopted*

**What the source says [F].** Cook defines a loop as a cycle in which "the player starts with a mental **model** that prompts them to apply an **action** to the game **system** and receives **feedback** that updates their mental model." Loops "are fractal and occur at multiple levels and frequencies throughout a game," and "are very good at building 'wisdom'." An arc is "a broken loop you exit immediately": simple actions with "complex evocative feedback," consumed once. "Since both loops and arcs can be easily nested and connected to one another, in practice you end up with chemistry-like mixtures."

His earlier "Chemistry of Game Design" [F] splits each loop into a **skill atom** with five stages: decision, action, simulation, feedback, modeling. It claims that "the sensation that gamers term 'fun' is derived from the act of mastering knowledge, skills and tools." Its key failure term is **burnout**: a player "masters a new skill, they play with it but fail to find any interesting use for it." Early burnout blocks progress down the **skill chain**, the directed graph of atoms. Later burnout causes "skill atrophy."

**Analysis.** For Well Dipper, two consequences:
- The **artifact clue chain is an arc**. It's consumed once, and the hand-checked three-site chain can't be replayed for meaning.
- The **signal hunt and the skim-or-dive choice are loops**. They have to stay interesting on the 50th run.

Cook's burnout test is a good question for every upgrade: *once I have the deeper drive, is there anything new to do with it, or just more of the same?* The v2 rule "each upgrade must open something you can see" is an anti-burnout rule in Cook's sense.

### 1.2 MDA — *practitioner framework, academic venue, widely criticised but durable*

**What the source says [F, Wikipedia summary of Hunicke, LeBlanc & Zubek 2004].**
- **Mechanics** are "the base components of the game — its rules, every basic action the player can take."
- **Dynamics** are "the run-time behavior of the mechanics acting on player input."
- **Aesthetics** are "the emotional responses evoked in the player."

Designers work forward from mechanics; players experience the chain backwards, starting from aesthetics. The paper lists eight aesthetics, including Discovery ("uncharted territory") and Submission ("pastime"). Critics call the list "a rather arbitrary list of emotional targets." I couldn't extract text from the original PDF, so this is the Wikipedia account.

**Analysis.** Well Dipper's target aesthetics are plainly **Discovery** and **Submission**, the pastime state a screensaver produces. MDA's practical use here is a warning: you can only set mechanics, so "contemplative" has to be checked as a dynamic in playtests (do people slow down?), not assumed from the design.

### 1.3 Internal economies: Machinations (Joris Dormans; Adams & Dormans) — *practitioner/academic, PhD-grounded*

**What the sources say.**
- Ernest Adams [F, Game Developer] defines the Machinations nodes. A **source** creates resources; a **drain** consumes them ("a resource that goes into a drain disappears permanently"); a **pool** is where resources gather; a **converter** turns one resource into another; a **gate** redistributes. He illustrates positive feedback with Monopoly's property acquisition and self-regulation with a toilet cistern.
- Dormans frames feedback as positive or negative, "constructive or destructive, fast or slow" [S, AAAI paper summary].
- *Game Mechanics: Advanced Game Design* (Adams & Dormans 2012) has a pattern library with three families: **engines**, **friction** and **escalation** [S]. Named patterns include:
  - *dynamic engine*: a steady resource flow the player can invest to grow;
  - *dynamic friction*: drain that scales with the player's success;
  - *stopping mechanism*: an action's effect shrinks each time it's used (diminishing returns);
  - *attrition*.
- The MMO literature calls sources **faucets** and drains **sinks**. One Game Developer column [F] separates **money-supply inflation** from **price inflation**. It argues that vendor buy and sell prices act as floors and ceilings that anchor an economy, and that designers should "worry more about equipment faucets and drains than cash faucets and drains."

**Analysis: the four diagnostic questions this vocabulary gives you.**
1. **Every resource needs a faucet and a sink that both matter at every stage of the game.** If the sink stops mattering (all upgrades bought), the resource piles up and the decisions that spent it disappear.
2. **Find every positive loop and ask what brakes it.** "More money → better ship → better finds → more money" is the classic engine. Without friction it runs away, and the early-game decisions become trivial later.
3. **Find every destructive positive loop and ask what breaks it.** Losses that cause further losses (a death spiral) need a circuit-breaker: a floor, a reset, or a rescue.
4. **Converters must not be arbitrage pumps.** If converting A→B→A comes out ahead, players will farm it. The v2 note that interest must be at or above inflation is exactly this check.

### 1.4 Interesting decisions (Sid Meier, GDC 2012) — *practitioner*

**What the source says [F, Game Developer report].** Meier's four qualities of an interesting decision:
- **Tradeoffs** ("the fastest car may have poorer handling").
- **Situational**: "it acts in an interesting way with the game situation".
- **Personal**: it lets you "express your personal play style".
- **Persistent**: it affects the game "for a certain amount of time, as long as the player has enough information to make the decision."

On information: "It's almost worth erring on the side of providing the player with too much information." On feedback: "The worst thing you can do is just move on. There's nothing more paranoia-inducing than having made a decision and the game just kind of goes on." On cutting: "probably a third of the things that we try, if not more, end up getting taken out."

**Analysis.** Meier's tests apply to every diamond in a flowchart. A diamond with a dominant answer is a fake decision. A diamond with no visible consequence is the "paranoia" case. Both can be checked on paper (see the checklist at the end).

### 1.5 Closed vs. leaky loops

**Analysis (no single source; this synthesises 1.1–1.4).** A loop is **closed** when every path out of every node eventually returns to the core, *and* the resources it produces are consumed somewhere that still matters. A loop **leaks** in four ways:
- **Dead ends.** A node with no exit edge, so the player is left with nothing meaningful to do next.
- **Pile-ups.** A faucet with no live sink, so the resource stops mattering.
- **Runaways.** Positive feedback with no brake.
- **Spirals.** Destructive feedback with no breaker.

There is a fifth, softer leak that Cook names: **burnout**. The loop is mechanically closed but no longer teaches anything.

---

## 2. Reward and motivation: what the evidence supports

### 2.1 "Dopamine" as actually supported — *rigorous neuroscience, often misquoted*

**What the sources say.**
- Berridge and Robinson's research separates reward into "wanting" (incentive salience), "liking" (hedonic pleasure) and learning. Mesolimbic dopamine drives **wanting, not pleasure**. Raising dopamine quadrupled rats' "wanting" for food without increasing "liking" [S, Berridge lab and Wikipedia summaries].
- Kidd & Hayden's review of curiosity [F] reports that "dopamine neurons signal both primary and informational reward" and that "to subcortical reward structures, informational value is treated the same as any other valued good."
- Gruber, Gelman & Ranganath (2014, *Neuron*) [S] found heightened midbrain and nucleus-accumbens activity in high-curiosity states, and better memory even for incidental material learned during those states.
- A popular-press summary [S] notes that game play raises dopamine roughly 50–100% above baseline, far below drugs of abuse. I didn't trace the primary study, so treat that figure as unverified.

**Analysis.** The defensible version of "dopamine design":
1. Anticipation and uncertainty drive *wanting*, which is not the same as enjoyment.
2. **Information is a reward in its own right** at the level of the reward system.

The second point matters most for Well Dipper. A signal whose identity is uncertain until you close in is a legitimate reward structure that needs no loot to work. Pop-science claims that games "hijack" dopamine like drugs aren't supported by the sources above.

### 2.2 Variable vs. fixed schedules — *rigorous lab basis, contested extrapolation*

**What the sources say.**
- Skinner's operant work showed that random rewards and variable intervals affect how quickly animals learn a reinforcement system [F, Wikipedia "Compulsion loop"]. Wikipedia's article on compulsion loops carries an "unreliable medical source?" flag on its addiction claims.
- Zendle & Cairns (2018, *PLOS ONE*, n = 7,422) [S] found that loot-box spending was linked to problem-gambling severity, more strongly than other in-game spending. A 2019 replication confirmed the link. The authors say they can't tell which way causation runs.

**Analysis.** Variable reward isn't unethical in itself. Every exploration game is a variable schedule, because you don't know what's behind the next hill. The documented harm sits where variable reward is **sold for money** or **tied to obligation**. Well Dipper has neither in the current design. "Every signal pays something" (fixed) plus "rare finds" (variable) is a sound mix.

### 2.3 Intrinsic motivation: Self-Determination Theory — *rigorous (peer-reviewed, multi-study)*

**What the sources say [S].** Ryan, Rigby & Przybylski (2006, *Motivation and Emotion* 30:347–363) ran four studies. Perceived in-game **autonomy** and **competence** predicted enjoyment, preference for the game, and changes in well-being after play. Intuitive controls and **presence** (immersion) were related to both. In an online multiplayer sample, **relatedness** also independently predicted enjoyment and future play. Rigby & Ryan's *Glued to Games* (2011) builds the PENS ("Player Experience of Need Satisfaction") measure on this [S].

**Analysis.** SDT maps directly onto the design:
- **Autonomy** comes from always-optional cash-in, skippable scans, and writing your own autopilot rules.
- **Competence** comes from the dive edge, reading signals, and a well-written gambit that works.
- **Relatedness** is currently missing. Well Dipper is single-player and isolated by fiction ("no faction support"). A companion is the only relatedness channel in the design, which makes it worth getting right. The research supports relatedness as a motivator in social games; whether a *character* satisfies the need is less well established. The Media Equation (4.1) is the strongest argument that it can.

### 2.4 Curiosity and the information gap — *rigorous (review literature), with an honest gap*

**What the sources say.** Loewenstein (1994, *Psychological Bulletin*) holds that curiosity arises from "the perception of a gap in knowledge and understanding" and works like a drive such as hunger [F, as quoted in Kidd & Hayden]. Kidd & Hayden report an **inverted U**: people "were least curious when they had no clue about the answer and if they were extremely confident; they were most curious when they had some idea about the answer, but lacked confidence" [F]. They also caution: "we lack even the most basic integrative theory of the basis, mechanisms, and purpose of curiosity" [F].

**What exploration games do with it.** Alex Beachum on Outer Wilds: "the only reason the player should be motivated to explore in this game is out of curiosity. And so everything we do needs to inspire curiosity and reward curiosity," and "we want players to explore … because they're curious, not because they want a resource, not because they want to level up. So get rid of all that" [F, The Examined Game]. He also says "a certain amount of mortal peril keeps exploration from feeling too passive," and credits Wind Waker's characters, who "incite player curiosity by telling stories of distant places" [F, Game Developer]. Subnautica's GDC 2019 talk covers "mysterious tooltips" and "adding structure to a sandbox through radio signals" [S]. No Man's Sky [M] sustains play through procedural novelty and ladders of upgrades, and is often criticised for sameness once the generator's range is learned.

**Analysis.** Three things transfer to Well Dipper:
1. **The signal readout already has an inverted-U shape.** The "how sure" readings that sharpen as you close in move the player from "no clue" to "some idea," which is the peak of the curve. The narrowing from three candidate systems in the clue chain does the same. Keep both.
2. **Peril sharpens curiosity** (Beachum). The dive's risk is what stops discovery from feeling passive.
3. **A character telling you about a distant place** (Wind Waker → Outer Wilds) is a curiosity tool, and it's a job a companion can do.

Note the tension. Outer Wilds removed money and upgrades to protect curiosity, while Well Dipper has both. The research doesn't say money kills curiosity. It suggests that **the reward for a discovery should mainly be the discovery itself**, with money as a side effect.

### 2.5 The ethics line: what counts as manipulative

**What the sources say.**
- Zagal, Björk & Lewis (FDG 2013) [S] define dark game-design patterns in three families: temporal, monetary and social-capital. **Playing by appointment** is the temporal case: "the game dictates when the player plays," and missing the schedule is penalised (withered crops). **Grinding** spends players' time on repetitive tasks.
- A 2024 study of 1,496 mobile games [F, arXiv abstract] found dark patterns "not only widespread in games typically seen as problematic but are also present in games that may be perceived as benign," and grouped them as temporal, monetary, social and psychological.
- Katsuya Eguchi on Animal Crossing [F]: "I didn't really want people to feel like they were being punished for not playing," but "if they're a little annoyed by the things that could happen, that probably keeps them coming back"; "we consciously avoided any disaster type situations."
- Tamagotchi is the counter-case: neglected pets died, and the guilt was by design. Later virtual pets (Nintendogs) "never age" and at worst run away [F, Wellcome Collection].

**Analysis: a working line for Well Dipper.** The research doesn't give a clean threshold, so this is my synthesis. A mechanic is manipulative compulsion design if it does any of the following:
1. Makes **absence cost the player something** (decay, death, lost streaks, withering).
2. Sets **time windows** the player must meet (appointments, limited-time events, daily-login chains).
3. Sells **variable rewards or time-skips** for money.
4. Uses **social pressure** (gifting obligations, guild penalties).
5. **Hides odds or costs** until after commitment.

Well Dipper's current charts avoid all five, with one exception, covered in section 5. Two design choices already in v2 matter here:
- "Runs only while the app is open; no simulated progress while it's closed." That removes the appointment problem at the root.
- "Saved leads never expire."

For a game people are asked to fund, I'd treat these five as public commitments. They are cheap to keep and costly to walk back.

---

## 3. "Check back in" design for idle and ambient play

### 3.1 What the references do

- **Neko Atsume** [F, Wikipedia]: cats visit only when the game is closed. You return to see who came, with photos to take and gifts left behind. "There is no end game." Creator Yutaka Takazaki wanted something "children could enjoy without a significant investment of skill or time." Food runs out [M], which pauses visits but punishes nothing.
- **Pokémon Sleep** [F, The Pokémon Company]: "sleep-first." The team "intentionally did not design the app around rewarding specific sleep schedules" so players wouldn't distort their sleep. The return moment is a reveal: "Every time you wake up, you can discover how your Pokémon partner slept that night."
- **Animal Crossing** [F, Eguchi]: real-time clock. Mild weeds and pests, no disasters (2.5). The morning announcements from Isabelle [M] are the series' "while you were away" briefing, delivered by a small character.
- **Cookie Clicker** [S, wiki]: offline production starts at 5% of normal for one hour, then drops by 90%. Upgrades raise both the percentage and the window. This is a **soft cap**.
- **Melvor Idle** simulates offline time fully up to 24 hours. **Eric Guan's** staggered production caps let both active and casual players feel served (both [F/S], covered in the companion doc §4.3).
- **Universal Paperclips / Kittens Game**: Frank Lantz liked Kittens Game's "complex overlapping systems" and wanted something "smaller and more focused." Incremental games "make abstract mathematical relationships feel palpable" [S, GamesBeat/YC]. These are mostly *active* idle games. Their pleasure is watching systems compound, not coming back.
- **Idle-genre monetisation** [S, Pecorella GDC 2015 summary]: offline progress plus *notifications* were added to drive frequent check-ins. Notifications are the step that turns returning into appointment pressure.
- **Tamagotchi** [F]: the anti-pattern, where coming back means facing what your absence caused.

### 3.2 What makes a return satisfying (analysis)

Across the references, satisfying returns share five features:
1. **A reveal before any numbers.** Who visited, how your partner slept. The first thing on screen is something to *look at*, not a ledger.
2. **No loss.** Nothing decayed. At worst, a buffer filled and production paused.
3. **Short.** The summary is readable in seconds and is skippable.
4. **A single suggested next action**, which the player may ignore.
5. **A soft cap that is visible and fair.** The player can see that the buffer stopped, so they don't feel they lost anything by being away.

Pitfalls the references show:
- **Notifications pulling the player back.** Don't add them.
- **Chores on return**, such as collecting each item by hand.
- **Uncapped accumulation of the main currency**, which devalues manual play and, in a game with inflation, pumps the money supply.
- **Caps on things that feel personal.** A full buffer of *leads* reads as "you missed discoveries," a mild fear of missing out.

### 3.3 Capped vs. uncapped (analysis)

Cap what the **economy** produces: money, sellable leads. Leave **non-economic keepsakes** uncapped: things to look at. Neko Atsume's photos and Pokémon Sleep's sleep styles are keepsakes, not currency. That split keeps manual play meaningful and keeps the return moment generous.

---

## 4. Companion and assistant characters

### 4.1 Why Clippy was hated: the documented record

- **The research lineage.** Byron Reeves and Clifford Nass's *The Media Equation* (1996) claims that "individuals' interactions with computers, television, and new media are fundamentally social and natural, just like interactions in real life" [F, Wikipedia]. Nass & Moon (2000) reported that experienced users "vehemently denied" responding socially to a computer, yet did so in the experiments [F]. Critics question whether the experimental designs predisposed subjects to social responses [F]. Rigor: **rigorous program, contested in places**. Nass and Reeves consulted on Microsoft Bob, whose character technology went into Office 97 [S].
- **The engineering gap (Microsoft Research's own account).** Eric Horvitz's Lumière project built Bayesian models of user goals. On his project page [F], he writes that the Office team "employed a relatively simple rule-based system on top of the Bayesian query analysis system to bring the agent to the foreground with a variety of tips," and adds: "We had been concerned upon hearing this plan that this system would be distracting to users—and hoped that future versions … would employ our Bayesian approach … coupled with designs we had demonstrated for employing nonmodal windows that do not require dismissal when they are not used."
- **Microsoft's institutional verdict** [F, Wikipedia "Office Assistant"]:
  - Office XP turned the Assistant off by default, and Microsoft "focused most of their marketing on that change."
  - Steven Sinofsky said the internal codename "TFC" had "C" for "clown."
  - Critics cited "interrupting users and not providing advice that was fully adapted to the situation" ("It looks like you're writing a letter").
  - Alan Cooper called it a "tragic misunderstanding" of the Stanford research: the face became "an annoying interloper distracting the user."
- **Nass's diagnosis** [S, accounts of *The Man Who Lied to His Laptop*, 2010]:
  - Clippy was "utterly clueless and oblivious to the appropriate ways to treat people." It repeated unhelpful answers and never learned users' names or preferences.
  - Nass prototyped a Clippy that asked "Was that helpful?" and, on "no," sided with the user against Microsoft. Twenty-five users reportedly "fell in love" with it.
  - I haven't verified this anecdote against the book; treat the details as [S].
- **Luke Swartz's Stanford honours thesis** (2003, advised by Nass) [F, abstract]: an agent's labels, appearance and behaviour, "if it obeys standards of social etiquette, or if it tells jokes", change how users respond. A search summary [S] says it concludes that agents should leave users "in control" and follow "human rules of etiquette," and that Clippy did neither.
- **Interruption cost.** Mark, Gudith & Klocke (CHI 2008) [S] found that interrupted workers finished slightly *faster* with no drop in quality, but reported more stress, frustration and workload. The cost of an interruption is felt, not necessarily measurable in output.

**Analysis: Clippy's six failures.**
1. **It interrupted unprompted, modally.** You had to dismiss it.
2. **It guessed wrong with confidence.** A crude rule system was presented as an intelligent agent.
3. **It repeated itself.**
4. **It never learned you.**
5. **It took no responsibility.** Its etiquette broke the social rules people apply even to machines.
6. **It commented instead of doing.** It offered help rather than taking actions.

The Media Equation cuts both ways: because people treat characters socially, a rude character feels *personally* rude.

### 4.2 Game companions: what separates charming from annoying

| Companion | What happened | Tag |
|---|---|---|
| **Navi** (Ocarina of Time) | Miyamoto, 1999 strategy-guide interview (Shmuplations translation): "the whole system with Navi giving you advice is the biggest weakpoint of Ocarina of Time"; "she says the same things over and over … we purposely left her at a kind of 'stupid' level"; "I wanted to remove the entire system, but that would have been even more unfriendly." Her intended use: "for players who stop playing for a month or so, who then pick the game back up and want to remember what they were supposed to do." Aonuma: adventuring alone is "lonely and dull." | [F] Nintendo Life; [S] Aonuma |
| **Fi** (Skyward Sword) | Widely criticised for interrupting with repeated information. The 2021 HD remaster made her advice **optional**: the sword chimes, and the player chooses whether to consult her via a menu. | [F] Zelda Universe confirms "optional help from Fi"; [S] mechanism details |
| **BD-1** (Jedi: Fallen Order) | Speaks no dialogue at all. Ben Burtt's beeps plus body animation ("a big head, like a bird … but the emotion of a dog," Jordan Lamarre-Wan). It *does* things: hacks, scans to build an encyclopedia, projects the map, dispenses heals. | [F] Game Informer |
| **Ghost** (Destiny) | Flat delivery of Peter Dinklage's lines ("that wizard came from the moon") became a meme; Bungie re-recorded all lines with Nolan North in 2015. Voice quality alone can sink a companion. | [S] |
| **Paimon** (Genshin) | Comments on everything. One poll: 54.2% "the worst." English voice recast in 2025, with fans calling the new voice "less shrill." | [S] |
| **Claptrap** (Borderlands) | Deliberately polarising. Writer Anthony Burch preferred strong opinions to blandness, then made him more sympathetic in Borderlands 2. | [S] |
| **Vasco** (Starfield) | Criticised as underused, an "Alexa that can punch" that keeps saying it can't feel anything. | [S] PC Gamer (fetch truncated) |
| **Elite Dangerous COVAS** | The ship computer's voice is a purchasable choice. Third-party HCS VoicePacks add voice command via VoiceAttack. Players choosing the voice is an autonomy lever. | [S] |
| **GLaDOS / Wheatley, EDI, Cortana** | Beloved companions with strong, authored voices. The Portal 2 writers recorded far more than they used (~30 hours of GLaDOS dialogue). | [S] for the hours; character details [M] |

**Dialogue-systems evidence.** Valve's Elan Ruskin (GDC 2012) [S] describes Left 4 Dead's rule-based dialogue. Hundreds of world facts are matched against thousands of lines; the **most specific matching rule wins** and general lines are fallbacks. Characters "remember history," and writers can add special cases without programmer help. Supergiant's *Hades* has about 21,000 voice lines, chosen by game state, specifically so players rarely hear repeats [S].

**Analysis: the pattern behind charming vs. annoying.**
- **When it speaks.** Charming companions speak when something *changed* or when *asked*. Annoying ones speak on a timer or on every event, like Navi's repeats, Fi's interruptions, Paimon's commentary.
- **How often.** Repetition is the most-cited failure (Miyamoto, Nass, Hades' design goal). Volume of unique lines matters less than **never saying the same thing twice in a session**.
- **Control.** The fixes that worked hand control to the player: Fi made opt-in, COVAS voices chosen, Clippy turned off by default.
- **Animation over text.** BD-1 shows that personality can live in motion and sound, which can't be "wrong" the way a hint can.
- **Doing over commenting.** BD-1 scans and maps. Clippy and Navi mostly comment.
- **Voice.** Ghost and Paimon show that a bad recorded voice is expensive to fix later. No voice, or a non-verbal voice, avoids the risk.

### 4.3 Briefings, return summaries, and commands in a diegetic cockpit (analysis)

Three jobs fit a companion without turning it into Clippy:
1. **Return summary.** This is Navi's *intended* job by Miyamoto's own account: help a returning player remember what they were doing. Isabelle's morning announcements [M] are the gentle version. The companion presents the screensaver report: reveal first, then leads, then one suggestion.
2. **Arrival and threshold briefings.** One short line on arriving at a new kind of sight, and a cue (sound or animation, not text) as a dive approaches its safe-exit margin. These are **event-driven, not timed**.
3. **Commands and gambit editing.** Clippy failed partly because it offered help instead of taking actions. Giving the companion the *standing orders* panel (the three IF/THEN rules from the hand-off chart) makes it the interface for something the player authors, in the spirit of FF12's gambits (companion doc §4.1). The diegetic framing: "you tell the ship's mind its standing orders."

### 4.4 Chattiness control (analysis, building on 4.2)

Offer a three-step setting, with **quiet as the default** for the screensaver:
- **Quiet**: animation and beeps only; text only when asked.
- **Briefings**: return summary plus arrivals.
- **Chatty**: adds commentary.

This follows the Fi HD fix and Horvitz's "nonmodal windows that do not require dismissal." Nothing the companion says should ever need a click to clear.

### 4.5 Scripted vs. live-generated lines, and Steam's AI disclosure

**What Valve's current Steamworks documentation says [F, partner.steamgames.com/doc/gettingstarted/contentsurvey].**
- **Pre-Generated:** "Any kind of content that ships with your game and is consumed by players that is created with the help of AI tools during development."
- **Live-Generated:** "Any kind of content created with the help of AI tools while the game is running." Same rules, plus "you'll need to tell us what kind of guardrails you're putting on your AI to ensure it's not generating illegal content."
- Development tooling: "efficiency gains through the use of these tools is not the focus of this section."

Valve's January 2024 announcement said it would "include much of your disclosure on the Steam store page" and add an overlay tool for players to report illegal live-generated content [F, GamingOnLinux quoting Valve]. A January 2026 revision narrowed the form toward player-facing content and exempted tools such as code assistants. Live-generated content remains a checkbox disclosure [F, Generation Amiga; S, PC Gamer headline "focused on AI-generated content that is 'consumed by players'"]. Strictly, the disclosure is a section on the store page, not a user tag, though players and curators treat it as a label [S].

**Analysis: what this means for Max.**
1. **A live language-model companion requires disclosure.** There's no way around it under the current wording.
2. **The less obvious point: scripted lines that an AI tool wrote also require disclosure**, because they "ship with your game and [are] consumed by players" and were "created with the help of AI tools." Code that Claude writes is exempt as development tooling; *dialogue text* Claude writes probably isn't. "Created with the help of" is broad, and I found no Valve guidance on where light editing help crosses the line. **If avoiding the disclosure matters, Max should write the companion's lines himself**, using Claude only for the selection engine, not the text.
3. **The same applies to voice.** A text-to-speech voice (for example, a neural TTS model) is AI-generated audio consumed by players. **Non-verbal beeps or synthesised chirps made by conventional means** (the BD-1 route) avoid both disclosure and the Ghost/Paimon voice risk.
4. **Seeded procedural generation is not, on any reading I found, "AI tools" in Valve's sense.** One secondary blog [S] listed "procedurally generated textures" as live-generated AI. That isn't Valve's language, and I'd treat it as that blog's error. Confidence: moderate. If in doubt, ask Valve during the content survey.
5. **A Ruskin-style rule-based selector gives most of the "feels alive" benefit with no AI**: specific-over-general matching, memory of what's been said, and cooldowns. It's deterministic, testable, and safe for a beginner to build, and it fits the gambit system's own "first matching rule wins" logic.

---

## 5. Applying this to Well Dipper's v2 loops

These are diagnoses of the eight charts, all **Analysis**, using the vocabulary above.

**5.1 Dead ends in the charts.** Several nodes have no exit edge:
- In *Signal hunt*, "Keep drifting" and "Site saved for later" go nowhere. Saved sites should flow back into the SURVEY list, and drifting should loop back to new signals.
- In *The whole loop* and *Hand-off*, "Pure viewing" has no edge back into play except "Take the stick."
- In *Time economy*, "Spend it soon," "Carry them to a better market" and "Pay it down" end the chart.
- In *Cash in*, "keep it as a collectible" has no payoff.

The first three are diagram omissions. The fourth is a design gap (5.4).

**5.2 Money piles up later (missing sink).**
- **Faucets:** sales, mortgage loans, autopilot allowance, and rescue debt (a credit faucet).
- **Sinks:** upgrades, rescue fees, interest.

The galaxy is procedural, so finds are an **infinite faucet**, while the upgrade ladder is finite. Once it's climbed, money has no live sink and the "sell, mortgage or keep" diamond stops being a decision. Inflation (time economy) is a dynamic-friction brake, but it only delays the pile-up. Options:
- (a) Accept that money matters only early, and let the late game run on knowledge and sights, following Outer Wilds.
- (b) Make the ladder open-ended, for example with ever-stranger well grades.
- (c) Add a non-instrumental sink the player chooses, such as commissioning a display or funding the search for the offshoot.

For an MVP, (a) is cheapest and most on-pillar.

**5.3 The fuel economy has no money in it, which is fine.** Wells are free and always reachable by skimming, so fuel is a **risk-and-time** resource, not a money one. Damage converts into fuel (repairs), and fuel into stranding. That's correct for "powerful but fragile." It also means **damage → repair → fuel → stranding → debt → interest is the one destructive positive loop**. v2 already flags it ("a setback, not a spiral"). The breakers in place are emergency fuel, a debt limit, and "flying again within a minute." The remaining risk sits in 5.5.

**5.4 Decisions that may be fake.**
- **"Keep exploring or cash in?"** Data storage is unlimited, and nothing is lost by carrying it. Inflation, which would make holding risky, is out of the first test. So for the first playtest this diamond has no tradeoff in Meier's sense. The only pressure is artifact slots. That's acceptable for a first test, but don't read playtesters' cash-in timing as signal.
- **"Keep" vs "sell."** After Astra's ruling ("selling never erases what you learned"), keeping an artifact gives only collectible value, and the chart shows no payoff for it. Give keeping a *visible* consequence: the artifact sits in the cockpit, the companion reacts to it, it's required to complete the chain ending, or its interference changes your instruments. Otherwise "keep" is dominated by "sell."
- **Skim or dive** passes all four of Meier's tests: tradeoff, situational, playstyle, persistent through damage. It's the strongest decision in the design.

**5.5 The one ethics leak: galaxy time during autopilot.** The time-economy chart lists "autopilot work" as an event that advances galaxy time, and galaxy time grows debt with interest. A player in debt who leaves the screensaver running will come back owing more. That's **absence costing the player something**, the first item on the 2.5 list, and it turns the screensaver into a source of guilt. Fixes, cheapest first:
- Autopilot actions advance prices but not interest.
- Debt interest accrues only on manual events.
- The autopilot gets a standing rule "IF in debt: tour only."

**5.6 The return moment is a ledger, not a reveal.** "What changed, which rule ran, your saved leads" lists the *economy*. Section 3.2 says lead with something to look at. Have the screensaver capture **postcards**: framed views of the best sights it toured, an uncapped non-economic keepsake. The companion opens the return with one of them. Leads and earnings follow. This also softens the full-buffer problem: when the three lead slots are full, the screensaver keeps collecting postcards, so time away is never "wasted."

**5.7 The allowance refill is close to an energy mechanic.** "A manual expedition refills the allowance" resembles a stamina system turned inside out. It's ethically fine because it has no timer, no purchase and no penalty. Keep it framed as "the ship learned from your flying," not as a meter to top up, and never show a countdown.

**5.8 Curiosity is the strongest loop and should get the companion's voice.** Signals already create an inverted-U information gap. The companion's best line type is a Wind Waker / Outer Wilds "story about a distant place," a hint at an unvisited sight, rather than a reminder of a mechanic.

---

## Advice for Well Dipper (ranked)

Ranked by how much each fixes, weighted by build cost and PILLARS fit.

1. **Stop autopilot time from growing debt.** Interest accrues on manual events only, or the autopilot tours only while you're in debt. This closes the only mechanic that makes absence cost the player something (5.5). *Cheap; needed before the screensaver hand-off ships.*
2. **Make the return a reveal, then a ledger.** The screensaver saves uncapped "postcards" of the best sights. The companion opens the return with one image, then up to three leads, then earnings, then one optional suggestion. Make it skippable and readable in under ten seconds, with no notifications ever (3.2, 5.6). *Cheap to Medium.*
3. **Build the companion BD-1-first.** A silent, animated low-poly character with non-verbal sound, and text only when asked or on return. **Quiet by default**, with a three-step chattiness setting. Nothing modal and nothing that needs dismissing (4.2–4.4, Horvitz). *Medium (mostly animation).*
4. **Scripted lines, written by Max, chosen by a rule-based selector.** Most-specific-match wins, a memory of what's been said, and no repeats within a session. This avoids Steam's AI disclosure on both the live-generated and pre-generated counts, provided the text and voice aren't AI-made (4.5). *Medium; the selector reuses the gambit evaluator's logic.*
5. **Give the companion three jobs and nothing else: return briefings, first-arrival lines, and standing-orders editing.** Arrival lines should evoke curiosity ("there's something odd about the third moon") rather than explain mechanics. The dive margin is a sound or animation cue, not speech (4.3, 5.8). *Cheap once 3 and 4 exist.*
6. **Give "keep" a visible consequence.** Kept artifacts are displayed in the cockpit, change the companion's behaviour, or are needed for the chain ending. This also answers the open "what does finishing a chain give you?" question: the kept set completes something (5.4). *Cheap to Medium.*
7. **Close the diagram's dead ends.** Saved sites flow back into SURVEY, drifting loops back to new signals, and viewing has an explicit return edge (5.1). *Diagram-only now; small code later.*
8. **Decide where money stops mattering.** For the MVP, accept that the late game runs on knowledge and sights (option (a), 5.2), and say so in the design so it isn't mistaken for a balance bug. *Free (a decision).*
9. **Publish the five no-compulsion commitments** (2.5) on the funding page: no absence penalties, no time windows, no paid randomness, no social pressure, costs shown before commitment. *Free; keeps future-you honest.*
10. **First-playtest instrumentation for the companion.** With Max watching, tally how often each player turns it quieter, skips its summary, or talks back to the screen. Those three counts are the Clippy test. *Free.*

---

## Loop diagram checklist (one page)

Apply this to any flowchart. Each "no" is a finding to fix or deliberately accept.

**A. Flow (is it closed?)**
1. Does every node have an exit edge? (Dead-end test.)
2. Does every path eventually return to the core loop, not just stop?
3. Is every "saved for later" item shown flowing back somewhere?
4. Can the player leave the loop at any point without losing anything? (Autonomy.)

**B. Resources (faucets and sinks)**
5. List every resource: money, fuel, hull, time, leads, slots, debt.
6. Does each have at least one faucet and one sink?
7. Does each sink still matter late in the game, after upgrades are bought? (Pile-up test.)
8. Is any faucet infinite while its sink is finite?
9. Does any conversion chain (A→B→A) come out ahead? (Arbitrage test.)

**C. Feedback**
10. Mark every positive loop (success → more success). What brakes it?
11. Mark every destructive loop (loss → more loss). What breaks it, and how fast does the player recover?
12. Is any friction applied while the player is away? If yes, it's an absence penalty: remove it or make it opt-in.

**D. Decisions (Meier)**
13. For every diamond: is there a real tradeoff, or a dominant answer?
14. Does the right answer depend on the situation?
15. Does the choice persist long enough to matter?
16. Does the player have the information to choose before committing? (Costs shown first.)
17. Does the game visibly respond after the choice? ("The worst thing you can do is just move on.")

**E. Learning (Cook)**
18. Is each loop teaching something new by its 20th run, or burned out?
19. Does each upgrade open a new use of the skill, not just a bigger number?
20. Which pieces are arcs (consumed once)? Is there enough arc content for the session length you expect?

**F. Motivation and ethics**
21. Does the reward for discovering something include the discovery itself (a sight, knowledge), not only money?
22. Is uncertainty shaped as "some idea, not confident" (inverted U), not total blindness?
23. Does anything cost the player for being away? Any time windows, paid randomness, or hidden odds?
24. When the player returns: is the first thing a reveal, is it short, and is nothing lost?

**G. Companion**
25. Does it speak only on change or when asked? Does it never repeat in a session? Does it never need dismissing?
26. Can the player make it quieter?
27. Is any of its player-facing text or voice AI-made? If so, Steam disclosure applies.

---

## What I didn't cover and why

- **Original PDFs for MDA, Dormans' AAAI paper, Ryan/Rigby/Przybylski 2006, Zagal et al. 2013, and Pecorella's GDC slides.** All are real and located, but the fetcher couldn't decode the PDFs or was refused (403). Their claims here are [S] or come via secondary summaries. Before quoting any of them publicly, read the originals.
- ***Glued to Games* and *The Man Who Lied to His Laptop*.** Both are cited from summaries. Nass's Clippy-prototype anecdote is unverified detail.
- **No Man's Sky, GLaDOS/Wheatley, EDI, Cortana, Isabelle.** These come from memory; no design-intent sources were fetched this session.
- **Video talks** (Subnautica GDC 2019, Ruskin GDC 2012, Hades GDC 2021). Not watched; summaries only.
- **Economic-simulation literature (inflation modelling).** Deferred again, as in the companion doc. The faucet/sink checks here are enough to diagnose the charts, not to tune them.
- **Whether a character satisfies the SDT need for relatedness in single-player games.** I found no direct study. The Media Equation suggests it can, but that's inference.
- **Legal advice on Steam disclosure edge cases** (how much AI editing help counts as "created with the help of"). Valve gives no threshold. Ask in the content survey if it matters.

---

## Sources

Fetched [F]:
- Lostgarden, "Loops and Arcs": https://lostgarden.com/2012/04/30/loops-and-arcs/
- Lostgarden, "The Chemistry of Game Design": https://lostgarden.com/2021/03/13/the-chemistry-of-game-design-2/
- Game Developer, "GDC 2012: Sid Meier on how to see games as sets of interesting decisions": https://www.gamedeveloper.com/design/gdc-2012-sid-meier-on-how-to-see-games-as-sets-of-interesting-decisions
- Wikipedia, MDA framework: https://en.wikipedia.org/wiki/MDA_framework
- Game Developer, "The Designer's Notebook: Machinations": https://www.gamedeveloper.com/design/the-designer-s-notebook-machinations-a-new-way-to-design-game-mechanics
- Game Developer, "Emergent Mechanic Design for Video Games with Procedural Content": https://www.gamedeveloper.com/design/emergent-mechanic-design-for-video-games-with-procedural-content
- Game Developer, "The F-Words Of MMOs: Faucets": https://www.gamedeveloper.com/design/the-f-words-of-mmos-faucets
- Wikipedia, Compulsion loop: https://en.wikipedia.org/wiki/Compulsion_loop
- Kidd & Hayden 2015, "The Psychology and Neuroscience of Curiosity" (PMC): https://pmc.ncbi.nlm.nih.gov/articles/PMC4635443/
- Game Developer, "Road to the IGF: Alex Beachum's Outer Wilds": https://www.gamedeveloper.com/design/road-to-the-igf-alex-beachum-s-i-outer-wilds-i-
- The Examined Game, Alex Beachum: https://www.theexaminedgame.com/were-all-going-to-die-creating-outer-wilds-alex-beachum-creative-director/
- Game Developer, Katsuya Eguchi on Animal Crossing: https://www.gamedeveloper.com/design/crossing-into-the-mainstream-katsuya-eguchi-on-i-animal-crossing-i-
- Wikipedia, Neko Atsume: https://en.wikipedia.org/wiki/Neko_Atsume
- The Pokémon Company, "Why We Created Pokémon Sleep": https://corporate.pokemon.co.jp/en/topics/detail/t-9/
- Wellcome Collection, "The life and death of Tamagotchi and the virtual pet": https://wellcomecollection.org/stories/digital-pets
- arXiv, "Level Up or Game Over: Exploring How Dark Patterns Shape Mobile Games": https://arxiv.org/abs/2412.05039
- Luke Swartz, "Why People Hate the Paperclip" (abstract page): https://xenon.stanford.edu/~lswartz/paperclip/
- Wikipedia, Office Assistant: https://en.wikipedia.org/wiki/Office_Assistant
- Eric Horvitz, Lumière project page: http://erichorvitz.com/lum.htm
- Wikipedia, The Media Equation: https://en.wikipedia.org/wiki/The_Media_Equation
- Nintendo Life, Miyamoto on Navi: https://www.nintendolife.com/news/2022/01/even-miyamoto-doesnt-like-stupid-navi-in-zelda-ocarina-of-time
- Zelda Universe, Skyward Sword HD quality-of-life changes: https://zeldauniverse.net/2021/07/04/skyward-sword-hds-quality-of-life-improvements-make-fis-advice-optional-cutscenes-skippable-and-more/
- Game Informer, BD-1 profile: https://gameinformer.com/exclusive/2019/06/15/exclusive-in-depth-profile-on-star-wars-jedi-fallen-orders-new-droid-bd-1
- Steamworks documentation, Content Survey: https://partner.steamgames.com/doc/gettingstarted/contentsurvey
- GamingOnLinux, Valve's January 2024 AI rules: https://www.gamingonlinux.com/2024/01/valve-announces-new-rules-for-games-with-ai-content-on-steam/
- Generation Amiga, Valve's January 2026 rewrite: https://www.generationamiga.com/2026/01/17/valve-rewrites-steams-ai-disclosure-rules-for-developers/

Search-result summaries only [S]:
- Dormans, "Simulating Mechanics to Study Emergence in Games" (AAAI): https://cdn.aaai.org/ojs/12477/12477-52-16005-1-2-20201228.pdf
- Adams & Dormans, *Game Mechanics: Advanced Game Design*: https://www.peachpit.com/store/game-mechanics-advanced-game-design-9780132946704
- Hunicke, LeBlanc & Zubek, MDA paper: https://users.cs.northwestern.edu/~hunicke/MDA.pdf
- Ryan, Rigby & Przybylski 2006: https://selfdeterminationtheory.org/SDT/documents/2006_RyanRigbyPrzybylski_MandE.pdf
- PENS overview: https://selfdeterminationtheory.org/player-experience-of-needs-satisfaction-pens/
- Berridge lab, liking and wanting: https://sites.lsa.umich.edu/berridge-lab/research-overview/neuroscience-of-linking-and-wanting/
- Gruber et al. 2014 (PubMed): https://pubmed.ncbi.nlm.nih.gov/25284006/
- Zendle & Cairns 2018: https://journals.plos.org/plosone/article?id=10.1371%2Fjournal.pone.0206767
- Zendle & Cairns 2019 replication: https://journals.plos.org/plosone/article?id=10.1371%2Fjournal.pone.0213194
- Zagal, Björk & Lewis 2013 (dblp): https://dblp.org/rec/conf/fdg/ZagalB013.html
- DarkPattern.games, Playing by Appointment: https://www.darkpattern.games/pattern/10/playing-by-appointment.html
- Cookie Clicker wiki, Offline Cookie Production: https://cookieclicker.wiki.gg/wiki/Offline_Cookie_Production
- Pecorella, GDC 2015 idle games talk: https://www.gdcvault.com/play/1022065/Idle-Games-The-Mechanics-and
- GamesBeat, Universal Paperclips: https://venturebeat.com/pc-gaming/this-clicker-game-lets-you-take-over-the-world-with-paper-clips/
- GDC Vault, The Design of Subnautica: https://gdcvault.com/play/1025745/The-Design-of-Subnautica
- Microsoft Research, Lumière paper: https://www.microsoft.com/en-us/research/publication/lumiere-project-bayesian-user-modeling-inferring-goals-needs-software-users/
- Nass & Yen, *The Man Who Lied to His Laptop*: https://www.goodreads.com/book/show/8870562
- Mark, Gudith & Klocke 2008: https://www.semanticscholar.org/paper/The-cost-of-interrupted-work:-more-speed-and-stress-Mark-Gudith/b8da65570a3955db52b117b9bedd8f131316501d
- Digital Trends, Destiny Ghost recast: https://www.digitaltrends.com/gaming/destiny-ghost-recast/
- Wikipedia, Paimon: https://en.wikipedia.org/wiki/Paimon_(Genshin_Impact)
- Shacknews, Claptrap retrospective: https://www.shacknews.com/article/87504/the-borderlands-robo-lution-a-claptrap-retrospective
- PC Gamer, Vasco: https://www.pcgamer.com/vasco-should-feel-like-a-love-letter-to-sci-fi-robots-instead-hes-starfields-biggest-early-game-bummer/
- Frontier forums, COVAS and HCS VoicePacks: https://forums.frontier.co.uk/threads/hcs-voicepack-black-friday-sale-and-hcs-voice-pack-to-covas-overlap.559536/
- Game Developer, Valve dynamic dialog (Ruskin): https://www.gamedeveloper.com/design/video-valve-s-system-for-creating-ai-driven-dynamic-dialog
- GamesRadar, Hades 2 line counts: https://www.gamesradar.com/games/hades/hades-2-has-an-epic-script-of-over-400-000-words-and-30-000-voice-lines-around-50-percent-more-than-the-original-roguelike/
- Wikipedia, Portal 2: https://en.wikipedia.org/wiki/Portal_2
- PC Gamer, Steam AI disclosure form update: https://www.pcgamer.com/software/ai/steam-updates-ai-disclosure-form-to-specify-that-its-focused-on-ai-generated-content-that-is-consumed-by-players-not-efficiency-tools-used-behind-the-scenes/
