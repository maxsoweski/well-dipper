# Web research summary (subagent, 2026-10-03) — vendor claims, not all verified

## Tools that take your own views
- Hunyuan3D-2mv (local, open): front/left/back(/right), no top. 2.1 was the last open-weights release.
  https://huggingface.co/tencent/Hunyuan3D-2mv
- Hunyuan 3.1 Pro Multiview (hosted): up to 8 views incl. top; dense only. https://www.scenario.com/models/hunyuan-3d-31-pro-multiview
- Tripo P1 multiview: [front,left,back,right], face_limit 48–20,000, ~40–60 credits (~$0.40–0.60, unverified).
  https://docs.tripo3d.ai/model-generation/multiview-to-model-p1-20260311.html
- Rodin Gen-2: multi-view "concat", quad output 4k+; $0.40/gen on fal. https://fal.ai/models/fal-ai/hyper3d/rodin
- Meshy 7: low-poly mode cannot combine with multi-view. TRELLIS.2: single image officially.

## Input prep
- Flat-colour input → thin/odd geometry (Art3D https://arxiv.org/html/2504.10466); fix = depth/Canny-locked shading.
  No study shows instruction-edit models keep silhouettes pixel-locked.

## Retopo
- QuadRemesher ($109.90 perpetual) — hard-edge detection imperfect. Hunyuan PolyGen 1.5 (hosted). Research
  artist-mesh models (MeshAnything V2, FastMesh, DeepMesh, BPT) not shown on stylised hard surface.

## LLM-in-Blender fidelity
- BlenderGym https://arxiv.org/abs/2504.01786 ; 3D-CoS https://arxiv.org/html/2606.10478 — coarse similarity,
  failures at component assembly and high-curvature transitions. Measured 3D reference = better-posed task.

## Human
- Fiverr low-poly spaceship gigs from $35–45 base; estimate $60–300 for this job; turnaround not found.

## Ranking given
1 shaded views → Tripo/Rodin low-poly → Astra cleanup · 2 sculpt → auto retopo · 3 sculpt as measuring stick, Astra
cage snapped to it · 4 human modeller · 5 pure LLM.
