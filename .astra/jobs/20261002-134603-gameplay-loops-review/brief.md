# Review brief — Well Dipper MVP gameplay loops (design review, no files to write)

## What you are reviewing
A first-draft gameplay-loop design for **Well Dipper**, a retro (PS1/Saturn-era dithered look) procedural space
game built in three.js by Max, a solo beginner developer who directs Claude Code. The design is eight flowcharts.
Their Mermaid source is inside this HTML file (read it; ignore the CSS/JS):
`/tmp/claude-1000/-home-ax/44ca56e3-729e-4508-8a86-c250cf327b84/scratchpad/wd-loops/wd-gameplay-loops.html`

In the charts, a node with class `p` (dashed) is a proposal from Claude or a research pass; a plain node is
something Max said himself. Each loop also has a "My flags" list of Claude's open questions.

Background you may read (read-only):
- `/home/ax/projects/well-dipper-trunk/docs/PILLARS.md` — identity, pillars, anti-scope
- `/home/ax/projects/well-dipper-trunk/research/RESEARCH_mvp-gameplay-loop-references.md` — the reference research
  the dashed nodes came from (Outer Wilds, Heaven's Vault, Dredge, Elite fuel scoop, Dragon Age tactics, etc.)

## Why it matters (Max's goals, in his words where possible)
- The MVP is "a relatively cheap toy that is fun to watch" (screensaver and ORRERY viewing modes stay the main
  product) "and is fun to play enough that it intrigues people and makes them want to fund a crowdsourced bigger
  game". It is the skeleton/spine of a bigger game and is NOT set in that game's main plot.
- First proof test: friends and family play it while Max watches.
- Moment to moment: "searching for signals or some kind of a sign that there's something worth exploring … and
  then going and doing it and finding the thing." Interesting data should be visually interesting on the body
  and/or in the cockpit's information screens.
- Refueling the gravity drive from gravity wells "needs to be a lot of fun", with risk/reward, rewarding both
  skill and upgrades. Max chose: skim (safe, frequent) OR dive (risky, big payoff), chosen per well.
- Running dry: stasis until rescue; time skip scales with distance to the nearest settlement; adds to
  "time debt"; pay rescuers a bounty or go into debt.
- Galaxy time passing costs: shifting settlement economies, debt interest, currency inflation.
- Long arc: bigger warps, more collectibles, stranger finds; human-civilization remnants whose clues lead to
  where offshoots went; very rare, valuable, possibly dangerous alien artifacts; store finds until a settlement
  appraises them; then sell or mortgage them.
- Screensaver hand-off: player-authored if-then rules (like FF12 gambits) fly the ship while Max is away;
  progress is real but capped; rare finds need manual play.
- Max decided these; do not overturn them. If you think one is a mistake, say so in a separate clearly labelled
  section with your reasoning, but review the design as decided.

## What I want back (your `report` field, Markdown)
Be a demanding game designer, not a cheerleader. No praise. Specific, concrete, numbers where you can.
1. **Per loop (8 sections):** the most serious problems. Look especially for: chore risk (repetition that tests
   patience, not judgement), dominant strategies or exploits (e.g. autopilot farming, inflation/mortgage
   arbitrage, always-skim), dead ends and missing exits in the chart, missing player feedback moments, states
   the chart omits, and conflicts with the pillars or the "cheap toy" scope.
2. **Cross-loop problems:** where two loops interact badly (economy vs. autopilot, stranding vs. dive risk,
   time debt vs. the contemplative pace, etc.).
3. **Your answers to Claude's flags:** a recommended answer for each "My flags" question, one line each, with why.
4. **Top 5 improvements, ranked:** each with what changes in which loop, what it fixes, and a rough build cost
   for a solo beginner + AI (cheap / medium / expensive).
5. **What to cut or defer** from the first friends-and-family build, and why.
6. **(Optional) Disagreements with Max's decisions**, labelled as such.

Keep the whole report under about 2,500 words. This is a read-only review: write no files; `artifacts` is empty.
