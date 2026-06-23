export const meta = {
  name: 'assess-world-engine-divergence-spec',
  description: 'Principled multi-lens assessment of the world-engine body-divergence design spec vs Max north star + system-design principles',
  phases: [
    { title: 'Assess', detail: 'one agent per lens — grounded, small-output, opus' },
    { title: 'Synthesize', detail: 'adversarial synthesis: would Max say this drifts?' },
  ],
}

const REPO = '/home/ax/projects/well-dipper'
const MEM = '/home/ax/.claude/projects/-home-ax/memory'
const SPEC = `${REPO}/docs/superpowers/specs/2026-06-23-world-engine-body-divergence-design.md`

const PREAMBLE = `
You are one lens in a principled assessment of a COMMITTED design spec. Max (the user) chose to route his
"review the spec" gate through a multi-agent check instead of reading it inline. Your job is to judge the spec
AGAINST one specific principle and report grounded findings — NOT to redesign it, NOT to re-run the design
research, NOT to re-litigate decisions already locked.

THE SPEC under assessment: ${SPEC}
Read it IN FULL first.

REPO root: ${REPO}. The relief lab files live at repo root (relief-*.js, world-engine-relief-lab.*,
tests/world-engine-relief-slice.test.js). Use Glob/Grep to locate any file (e.g. planet-lod-lab-core.js,
src/generation/PhysicsEngine.js) — do not assume paths.

ESTABLISHED FACTS — do NOT re-litigate these (they are load-bearing and already verified this campaign):
- The relief slice (E6 tectonic build -> E9 hydrology carve) is UAT-PASSED. The renderer is preset-blind BY DESIGN.
- Max's UAT found body presets change only AMPLITUDE, not structure ("coat-swap"). This design fixes that.
- A 4-agent design-research workflow returned verdict="fails" on "gate the two engines alone" — at a fixed seed
  the E6 field layout is byte-identical across bundles (seeds exclude the body). That finding is baked into spec
  §2. You may rely on it; do not re-derive it.
- The 5-layer Approach A and the early-exit rule are the design's answer to that finding. Assess whether they are
  FAITHFUL to your lens — not whether a different design would be better.

VERIFICATION DISCIPLINE (critical): the spec is dense with code citations (file:line). A 45-day-old memory warns
file:line citations drift. Where your lens depends on a cited fact, OPEN the actual file and verify the citation.
Report each citation you checked as accurate / drifted / not-found. A spec that the build will follow MUST have
accurate citations — drift is a real, reportable gap.

OUTPUT DISCIPLINE: keep your output SMALL and structured (the orchestrator wedges on big outputs). Ground every
gap and every change-rec in a spec section/line ref AND a code/doc evidence ref. Severity: "blocking" = build
should not start until fixed; "significant" = real gap worth a spec edit; "minor" = nit / optional polish.
Default to "aligned: true" unless you find a genuine, evidenced gap — Max's rule is "do not change for the sake
of changing." Be a skeptic, not a pedant.
`

const LENS_SCHEMA = {
  type: 'object', additionalProperties: false,
  required: ['lens', 'aligned', 'confidence', 'gaps', 'changeRecs', 'verifiedCitations', 'summary'],
  properties: {
    lens: { type: 'string' },
    aligned: { type: 'boolean', description: 'true if the spec is faithful to this lens with at most minor gaps' },
    confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
    gaps: {
      type: 'array', items: {
        type: 'object', additionalProperties: false,
        required: ['severity', 'description', 'specRef', 'evidence'],
        properties: {
          severity: { type: 'string', enum: ['blocking', 'significant', 'minor'] },
          description: { type: 'string' },
          specRef: { type: 'string', description: 'spec section/line the gap concerns' },
          evidence: { type: 'string', description: 'code file:line or doc ref grounding the gap' },
        },
      },
    },
    changeRecs: {
      type: 'array', items: {
        type: 'object', additionalProperties: false,
        required: ['rec', 'rationale', 'wouldChangeSpec', 'priority'],
        properties: {
          rec: { type: 'string' },
          rationale: { type: 'string' },
          wouldChangeSpec: { type: 'boolean' },
          priority: { type: 'string', enum: ['must', 'should', 'optional'] },
        },
      },
    },
    verifiedCitations: {
      type: 'array', items: {
        type: 'object', additionalProperties: false,
        required: ['citation', 'status'],
        properties: {
          citation: { type: 'string' },
          status: { type: 'string', enum: ['accurate', 'drifted', 'not-found', 'not-checked'] },
          note: { type: 'string' },
        },
      },
    },
    summary: { type: 'string', description: '2-4 sentence bottom line' },
  },
}

const LENSES = [
  {
    key: 'north-star-fidelity', phase: 'Assess',
    body: `LENS: NORTH-STAR FIDELITY.
Read also: ${REPO}/docs/FEATURES/planet-lod-CHARTER.md (the durable north star) and ${REPO}/docs/FEATURES/world-engine-INDEX.md §1.
The north star (CHARTER §"NORTH STAR"; INDEX §1): bodies look distinctive because features share ENGINES rooted in
the body's history + composition + place — and FEATURES WORK TOGETHER (co-dependence: rivers respect mountain
topology, rivers feed the ocean, downstream features keyed to real drainage). "Lab != game by design."
Judge:
1. Does each layer route a real physical driver (composition/thermal/orbital/regime) into the FIELD's geometry, so
   divergence is carried by the engine, not a palette? Or does any layer smuggle in distinctiveness that is NOT
   rooted in composition/history/place?
2. Co-dependence: does the design keep E9 (carve) coupled to the E6 (build) substrate it shares, so the wet world's
   rivers still respect the real relief? Does adding the liquidStability gate or re-keying break any existing
   coupling the slice already shipped?
3. Is the DECISIVE gate (host-field divergence, E9-off DEM distance at one seed) actually a measure of the north
   star, or a proxy that could rise while the worlds are still not "rooted in composition" (e.g. mere seed change)?
4. Lab!=game respected (no game-wiring, no production edits)?`,
  },
  {
    key: 'proc-gen-not-render', phase: 'Assess',
    body: `LENS: PROC-GEN-LAYER-NOT-RENDER (Max's directive this session).
Read also: ${MEM}/feedback_procgen-layer-not-render.md IN FULL.
The principle: the renderer (L2) is a faithful expression of the generative model (L1) and MUST stay
structure/preset-blind. ALL distinctiveness originates in the generation layer. The anti-pattern is tacking a
feature/branch/cosmetic patch onto the renderer.
Judge:
1. Does EVERY one of the 5 layers change a GENERATIVE lever (driver -> process -> field) and leave the renderer
   untouched and preset-blind? Open the relevant relief-*.js to confirm the named edit sites are generation-side
   (field/substrate writes), not render-side.
2. Spec §3 L1 claims "the renderer needs no change: steeredNoise already swaps ridges vs grabens on regime flip,
   so a regime flip auto-swaps morphology." Verify this is a GENERATION-layer mechanism (steeredNoise writes the
   height field), not a render-side dependency. Is the claim accurate against relief-e6-tectonic.js?
3. Any place the spec relies on the renderer to express something the generation layer doesn't actually produce?
4. Does the design hold the line that the renderer stays preset-blind "by construction"?`,
  },
  {
    key: 'realizes-canonical-model', phase: 'Assess',
    body: `LENS: REALIZES-THE-CANONICAL-MODEL-NOT-A-PARALLEL-SCHEME.
Read also: ${REPO}/docs/FEATURES/planet-visual-features.md (the canonical D1-D16 -> P1-P28 -> F1-F53 model +
Appendix A: types = driver bundles -> which features). The CHARTER's hard rule: "do NOT re-invent the model."
Judge:
1. Does the spec REALIZE this existing model (its levers map onto real D/P/F nodes), or does it invent a parallel
   scheme with its own vocabulary that competes with D/P/F?
2. VERIFY the spec's specific citations into this model are accurate (open the file, check the line):
   - P2 at planet-visual-features.md:143 (D16 cooling->contraction / D2 ice-shell extension)
   - F5 at :220 (lobate-scarp/wrinkle-ridge compression vs horst-and-graben extension)
   - F4 at :219 (tectonic graben/chasma extension)
   - F11 at :233 (rivers gated to terrestrial/ocean/ice/carbon)
   - Appendix A F-gradational / lava "–" at :400
   Report each as accurate / drifted / not-found.
3. METASYSTEMICITY (read ${MEM}/feedback_metasystematicity.md): does the spec force a 1:1 mapping between its
   layers and D/P/F nodes that the model doesn't actually support, or are the mappings genuinely grounded? Flag any
   "X corresponds to Y" that lacks grounding.
4. Layer 4 mirrors the production liquidStability formula "verbatim". Verify that formula exists where cited
   (planet-lod-lab-core.js liquidStability / retentionGate / volatileGate / tempWindow; PhysicsEngine.js Jeans
   chain) and that copying it is faithful realization, not reinvention.`,
  },
  {
    key: 'isolation-bounded-units', phase: 'Assess',
    body: `LENS: ISOLATION & WELL-BOUNDED UNITS (dev-collab-os discipline + the isolated-harness discipline).
Read also: /home/ax/.claude/docs/dev-collab-os.md (skim for the isolation/bounded-unit principles).
The design claims: 5 layers, each changes ONE generative lever, holds the others OFF, has its own gate metric;
isolated lab; renderer untouched; additive on master; zero production edits.
Judge:
1. Is each layer genuinely ONE lever, or does any layer bundle multiple independent changes (e.g. does L1 actually
   touch two files with two conceptual changes; does L4 smuggle several gates)? Open relief-base-step.js,
   relief-e6-tectonic.js, relief-e9-hydrology.js to check the named edit sites are real and scoped.
2. Is the "hold the other levers off" discipline actually testable per layer, or do later layers' effects
   contaminate earlier gate metrics?
3. Is dev-collab-scope / contract.json correctly judged NOT warranted here (isolated lab, low blast radius, the
   spec is the design contract)? Or does the build touch enough surface to warrant a contract?
4. Are there any edits the spec claims are "lab only" that actually reach into production/shared modules
   (planet-lod-lab-core.js, PhysicsEngine.js are production — does the design EDIT them or only READ/copy from them)?
   Editing them would break the isolation claim; copying a formula into a relief-* module would not.`,
  },
  {
    key: 'honesty-caveats-earlyexit', phase: 'Assess',
    body: `LENS: HONESTY OF CAVEATS + EARLY-EXIT INTEGRITY (the adversarial-rigor lens).
Focus on spec §3 (the L1 age caveat), §5 (the verifier + decisive gate), §6 (non-goals), §7 (the one input gap),
and the early-exit rule.
Judge HARD:
1. Are the stated caveats ACCURATE? Verify the load-bearing claims by opening code:
   - "age is absent from all 4 presets (default 0.5)" — check relief-presets.js + relief-base-step.js.
   - "targetFrac = 0.4 is hardcoded" in E9 — check relief-e9-hydrology.js.
   - "host-field divergence is ~0 today" — is this asserted or demonstrated? Is it plausibly true given the seeds
     exclude the bundle?
   - "uvStripFactor dropped" / "no atmosphere object on relief bundles" — check relief-presets.js + PhysicsEngine.js.
2. THE SHARPEST RISK — does the decisive gate metric (host-field divergence) actually discriminate "categorically
   different worlds" from "coat-swap-of-a-different-color"? Layer 3 RE-KEYS the seed. A seed re-key TRIVIALLY moves
   any distribution-distance metric off zero (different noise stream = different layout) WITHOUT necessarily
   producing meaningfully different WORLDS. So could L3 alone pass the decisive gate while the result is still just
   "a different random map," defeating the point? Does the spec guard against this (e.g. does it require L1/L2's
   physically-grounded regime/geometry divergence to carry the metric, not just L3's reseed)? This is a potential
   blocking gap — assess it carefully and say whether the spec already addresses it or needs an edit.
3. Is the early-exit rule a REAL falsifiable stop (a concrete metric + threshold that, if unmet, halts the build),
   or decorative? Is the threshold defined well enough to act on?
4. Any UNSTATED risk a careful reviewer would want flagged before building? (e.g. tuning-circularity: thresholds
   "tuned in lab then locked" against the same bundles they must discriminate.)`,
  },
]

phase('Assess')
const lensResults = await parallel(LENSES.map((L) => () =>
  agent(`${PREAMBLE}\n\n========\n${L.body}\n\nReturn the structured assessment for lens "${L.key}".`, {
    label: `lens:${L.key}`,
    phase: 'Assess',
    schema: LENS_SCHEMA,
    model: 'opus',
    effort: 'high',
  }).then((r) => (r ? { ...r, lens: r.lens || L.key } : { lens: L.key, aligned: null, error: 'agent returned null' }))
))

const compact = lensResults.map((r) => ({
  lens: r.lens,
  aligned: r.aligned,
  confidence: r.confidence,
  gaps: r.gaps,
  changeRecs: r.changeRecs,
  citationIssues: (r.verifiedCitations || []).filter((c) => c.status === 'drifted' || c.status === 'not-found'),
  summary: r.summary,
}))

phase('Synthesize')
const SYNTH_SCHEMA = {
  type: 'object', additionalProperties: false,
  required: ['overallVerdict', 'driftRisks', 'recommendedEdits', 'greenlightBuild', 'summary'],
  properties: {
    overallVerdict: { type: 'string', enum: ['aligned', 'aligned-with-edits', 'drifts-needs-rework'] },
    driftRisks: {
      type: 'array', items: {
        type: 'object', additionalProperties: false,
        required: ['risk', 'severity', 'sourceLens'],
        properties: {
          risk: { type: 'string' },
          severity: { type: 'string', enum: ['blocking', 'significant', 'minor'] },
          sourceLens: { type: 'string' },
        },
      },
    },
    recommendedEdits: {
      type: 'array', items: {
        type: 'object', additionalProperties: false,
        required: ['specSection', 'edit', 'rationale', 'priority'],
        properties: {
          specSection: { type: 'string' },
          edit: { type: 'string' },
          rationale: { type: 'string' },
          priority: { type: 'string', enum: ['must', 'should', 'optional'] },
        },
      },
    },
    greenlightBuild: { type: 'boolean' },
    summary: { type: 'string' },
  },
}

const synthesis = await agent(
  `You are the ADVERSARIAL SYNTHESIS reviewer for the world-engine body-divergence design spec.
The spec: ${SPEC} — read it (at least §1, §3, §5, §6). North star: ${REPO}/docs/FEATURES/planet-lod-CHARTER.md.

Five lens agents assessed the spec. Their compact findings (JSON):
${JSON.stringify(compact, null, 2)}

Your job: ask the question Max would ask — "what would make me say this design has DRIFTED from the north star,
or that the build will produce a coat-swap-of-a-different-color rather than categorically different worlds?"
- Weigh the lens findings. Promote only genuinely load-bearing gaps; discard pedantry. Max's rule is
  "edit the spec ONLY if a real gap surfaces — do not change for the sake of changing."
- Pay special attention to: (a) whether the decisive host-field-divergence gate can be passed trivially by the
  Layer-3 reseed without real physical divergence (a coat-swap-of-a-different-color), and (b) any DRIFTED or
  NOT-FOUND code citations, since the build will follow them.
- For each recommended edit, name the exact spec section and the concrete change, with priority must/should/optional.
- Decide greenlightBuild: true if the spec is sound to build as-is or with only should/optional edits; false only
  if a "must" edit is needed before building.
Keep output small and structured.`,
  { label: 'synthesis:adversarial', phase: 'Synthesize', schema: SYNTH_SCHEMA, model: 'opus', effort: 'high' }
)

return { lenses: lensResults, synthesis }
