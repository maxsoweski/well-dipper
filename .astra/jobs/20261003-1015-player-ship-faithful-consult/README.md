# Consult 2026-10-03 — getting a 3D model faithful to r10
- Input to Hunyuan3D-2mv: r10's OWN views, labels removed by pixel edit, shared scale (`pship10_inputs_row.png`;
  sources + raw mesh in `~/projects/model-supply/refs/i23d/pship10/`). Raw mesh render: `pship10_s1234_4view.png`.
  ComfyUI crashed before a second seed.
- Web research (subagent, opus) ranked: shaded views → hosted low-poly multiview (Tripo/Rodin); sculpt → auto retopo;
  sculpt as measuring stick + Astra cage; human modeller ($50–300 est.); pure LLM last. Saved as `research.md`.
- Astra (fresh thread in `thread.txt`) reply: `reply.md`. Recommends pipeline 3 (sculpt as measuring stick) with a
  gate: Max marks accepted/rejected shell relationships → Astra builds only the two main shells + aft termination
  (600–900 tris) → one correction allowed → if overlap/termination still needs reinterpreting, hire a human for the
  hull cage.
- CC assessment: agree with Astra over the researcher on ordering. Hunyuan-from-r10 already produced the sweeping
  shells without shading, so the flat-colour risk the research cited did not show up here; shading would add an
  interpretation step for no observed gain. Tripo is a ~$0.50 side comparison, a new spend category — optional, not
  on the critical path.
