from pathlib import Path
from PIL import Image
import json,hashlib,zipfile,struct
J=Path.cwd();O=Path('/mnt/c/Users/Max/Documents/Blender/astra/well-dipper-trunk/player-ship/envelope')
a=json.load(open(O/'round02-acceptance.json'));b=json.load(open(O/'round02-build-check.json'));c=json.load(open(O/'round02-shape-check.json'));r=json.load(open(O/'reimport-B.json'))
assert a['triangles']==b['triangles']==r['triangles']==2092
assert a['symmetry_max_vertex_m']==0 and a['unmatched_material_triangles']==0
assert b['A_scene_geometry_sha256_before']==b['A_scene_geometry_sha256_after']
assert len(c['port_back_visibility_rays'])==20 and all(p['first_material']=='engine_glow' for p in c['port_back_visibility_rays'])
old=json.load(open(J/'out/round02/A-before.json'))
for p,h in old.items():assert hashlib.sha256(Path(p).read_bytes()).hexdigest()==h
# Compare all original material factors directly against protected A.
def doc(p):
 data=p.read_bytes();n=struct.unpack_from('<I',data,12)[0];return json.loads(data[20:20+n])
am={m['name']:m for m in doc(O/'envelope-A.glb')['materials']};bm={m['name']:m for m in doc(O/'envelope-B.glb')['materials']}
for name,m in am.items():assert m['pbrMetallicRoughness']==bm[name]['pbrMetallicRoughness']
for view in ['34','side','front','top','rear','underside','symmetry']:assert Image.open(O/f'envelope-B-{view}.png').size==(960,540)
for view in ['side','front','top']:assert Image.open(O/f'envelope-B-overlay-{view}.png').width==1600
# Archive only intermediate files created during round 02.
temp=[]
for pat in ['round02-pass*.png','round02-check-*.png','round02-*.log','round02-build-check.json','round02-shape-check.json','round02-baseline.blend','fix_b_round02.py','render_b_round02.py','inspect_b_round02.py','registration.json','reimport-B.json']:
 temp+=list(O.glob(pat))
temp=sorted(set(temp));zpath=O/'round02-evidence.zip'
scripts=['fix_b_round02.py','prepare_b_round02.py','render_b_round02.py','compose_b_round02.py','inspect_b_round02.py','finish_b_round02.py']
with zipfile.ZipFile(zpath,'w',zipfile.ZIP_DEFLATED) as z:
 for p in temp:z.write(p,p.name)
 for name in scripts:z.write(J/name,'source/'+name)
with zipfile.ZipFile(zpath) as z:
 assert z.testzip() is None
 assert len([n for n in z.namelist() if n.startswith('round02-pass') and '-overlay-' in n])==9
for p in temp:p.unlink()
backup=O/'envelope.blend1'
if backup.exists():backup.unlink()
rows='\n'.join(f"| `{o['name']}` | {o['triangles']} |" for o in a['objects'])
ports='\n'.join(f"| {p['name']} | {p['host']} | ±{p['centre'][0]:.3f} | {11.130549430847168-p['centre'][1]:.3f} | {p['centre'][2]+5.406834125518799:.3f} | {p['radius']:.3f} |" for p in b['ports'])
report=f'''# Round 02 — variant B fixes

Max chose B and accepted its overall silhouette as the starting point. This round changes the seven requested areas and preserves A.

## Technical checks

| Check | Verified result |
|---|---:|
| B triangles, exported index count / 3 | 2,092 / 2,200 |
| B mesh objects | 17 |
| B materials | 10 |
| Length × height × width | 18.025 × 10.900 × 10.400 m |
| Largest mirrored vertex mismatch | 0.000000 m |
| Unmatched reflected triangles, including material assignment | 0 |
| Triangles with varying corner normals | 0 |
| Bubble outer width | 2.950 m |
| Bubble glTF z-range | −11.155549 to −7.700549 m |
| Bubble projects ahead of shortened head | 1.625 m |
| Minimum gap between the two module rows | 5.150 m |
| Manoeuvring ports / main nozzles | 16 / 4 |
| Recess depth, all ports and nozzles | 0.100 m |
| Glow-back visibility rays reaching engine_glow | 20 / 20 |
| Rear aperture samples with yellow obstruction | 0 / 353 |
| Centre-belly samples with geometry below 2.5 m | 0 / 60 |
| Protected A files with unchanged SHA-256 | 9 / 9 |
| A collection geometry/material signature before vs after | identical |

All existing seven material factors match protected A directly. Added `engine_glow` (0.03, 0.03, 0.035), `hatch` (0.8, 0.05, 0.05), and `thrusters` (0.85, 0.0, 0.6), linear RGB. All materials have metallic 0 and roughness 1. There is no baked emission; engine_glow is a charcoal Principled surface for game-controlled brightness. No cameras, lights, or textures are exported.

Symmetry is constructed by retaining one half, triangulating it, then reflecting each triangle with reversed winding and identical material assignment. The audit independently tests the GLB positions and material-tagged triangles, not just the Blender modifier or bounding box. A numerical x offset of approximately 0.000552 m was removed from B's vertices; object/world origin, longitudinal placement and vertical placement are unchanged. The maximum distance from an original control vertex to a corrected vertex across P01, P02, P03, P04, P07 and Bubble_MAIN is {max(c['max_original_vertex_distance_to_corrected_vertices_m'].values()):.9f} m. New port vertices are excluded from that retention comparison; triangulation intentionally changes.

The .blend retains A's mesh coordinates, polygons, object names and material assignments exactly. Its recorded A signature is `{b['A_scene_geometry_sha256_after']}`. A is hidden in the B review view layer; none of the nine envelope-A files was rewritten. B is visible in the saved file. Four packed blueprint references remain.

All final renders were produced by importing the final B GLB into an empty Blender scene. Standard views are 960×540; registered overlays are 1600 px wide. The ¾ camera retains 55 mm, 20° elevation and 125° azimuth. The symmetry image is the centred front render blended with its horizontal mirror at exactly 50%, using symmetric lighting. Its mean absolute mirrored pixel-channel difference before blending was 0.228 / 255, attributable to rendering noise; geometry mismatch is separately measured as zero. Source polygons are flat; Blender's GLB importer may use smooth flags to carry the exported custom normals, so the audit checks the corner normals themselves.

### Fixes delivered

1. **Symmetry:** hull, spine, glazing/frame, ports, keel modules and hatches are all mirrored facet for facet, with 0 unmatched material triangles.
2. **Rear lip:** replaced the pointed end with a rounded cross-section and successive curved longitudinal sections. It overhangs the carrier mouth plane by 0.580 m. It remains flat-shaded and faceted, with no upright rear slab.
3. **Clipping:** terminated the upper lip's low underside ahead of the carrier. Its underside is at least 8.12 m high in the aft clearance region; the grey carrier reaches 7.84 m. All 353 probes inside the chamfered opening reach non-yellow surfaces. The surrounding yellow frame still borders and covers the plate perimeter as a frame should; buried shell-to-shell overlaps remain part of the approved body construction.
4. **Undercarriage:** removed P10_Belly_Pod and the three old paired module groups. Added six 1.75 m-wide rounded cuboids per side, closely spaced longitudinally, in six paired P09_Keel objects. Their lowest points vary from 0.00 to 1.30 m, preserving the former maximum depth. Their tops intersect the hull at 4.05 m. No central module or stalk remains; the two rows leave a minimum 5.15 m centre gap.
5. **Ports:** added eight mirrored pairs on the mapped head, flank, shoulder, forward/side/rear module faces, and downward-facing keel undersides. Each is a real opening in its host surface, with a shallow bevel and a separate engine_glow back surface. The four main nozzles are openings in the grey carrier at the mouth plane, not cylinders standing proud of it. All 20 back faces are directly visible along their recess axes.
6. **Head/bubble:** shortened the forward nose to station 1.6 m aft of the bubble nose; retained the bubble's size and position. The roof attaches near the back of the cabin, with the cabin visibly below and ahead. Head ports are small and oblique, and the second pair faces out toward the sides; no projecting lip wraps around the cabin like a mouth.
7. **Hatch:** added red panels on the aft module at station 12.8 m, mirrored to retain symmetry.

### Objects

| Object | Triangles |
|---|---:|
{rows}

### Port placement

Coordinates use x across the ship, station aft of the bubble nose, and height above the lowest module; every row represents a mirrored pair. Centres were fitted to exposed faces of the existing coarse hull, rather than changing its approved mass to match a painted marker. The shoulder ports are inset into the exposed upper-deck surface in the rear-shoulder region.

| Pair | Host | x (m) | Station (m) | Height (m) | Outer radius (m) |
|---|---|---:|---:|---:|---:|
{ports}

Main nozzle centres: x=±1.520 m, height=4.650 and 6.950 m; mouth station=17.420 m; back station=17.320 m; radius=0.860 m.

### Review loop

- **Pass 1:** inspected side/front/top overlays and front/rear/¾ renders. Confirmed mirrored hull facets and split rows. Found that the original four nozzle mouths still stood proud of the grey plate; retained depth alone was insufficient. Also identified placement and polygon-count tradeoffs for the new ports. Rebuilt the carrier with actual holes and removed only three buried end caps to stay within budget.
- **Pass 2:** inspected the same views after rebuilding the carrier and fitting ports closer to their reference landmarks. Rear holes were now flush at their mouths and recessed 0.10 m. The normal-ray checks and ¾ render exposed yellow overlap over the forward-head and shoulder ports. Those locations were moved onto exposed portions of their host faces; smaller ports use six-sided bevels and the larger forward pair nine-sided bevels. Refined the rear lip's transverse curvature.
- **Pass 3:** inspected final side/front/top overlays, ¾, front, rear, underside and mirrored-front comparison. Confirmed clear head/shoulder openings, 20 visible glow backs, an open centre between the rows, red aft panels, and exact reflected facets. No additional geometry correction was identified within the requested fix scope. Nine registered pass overlays and all supporting images are archived in round02-evidence.zip.

## Remaining differences from r10 and this fix list

- The round-one shell/spine profile and its known differences from r10 were deliberately retained, since Max approved that massing. Shell boundaries still use broad polygonal approximations; this round does not re-fit them to every reference stroke.
- B remains the 2.95 m cabin option and therefore differs from the larger cabin drawn in the original front blueprint. Its dimensions and placement were preserved; the head around it was shortened.
- The new paired keel rows intentionally differ from r10's central stepped pod and mixed module outline. They implement Max's revised open-centre undercarriage request.
- Port positions follow the corresponding r10 faces and regions but are adjusted locally to exposed facets. This is not a claim that every port centre exactly overlays the 2D marker. The coordinate table records the actual result.
- Round ports and the rounded rear lip remain visibly faceted: six sides for small manoeuvring ports, nine for the forward pair, and eight for main nozzle openings. The file remains flat-shaded and under budget.
- The small oblique front ports and shortened nose are the implemented response to the caterpillar-face concern; whether that visual reading is fully resolved is Max's judgement.
- No known technical item from the seven requested fixes remains open. Rear clearance is supported by geometry separation and sampled visibility checks, not claimed as an exhaustive proof that all intentional buried hull overlaps were removed.

## Approval

Technical checks passed. This round is ready for Max's visual review; no claim of approval is made. Max's earlier approval applies to B's starting silhouette, not automatically to these fixes.

## Decisions

Mirrored the hatch and all ports, even where r10 shows one side, to preserve full symmetry. Used six modules per side as the concrete interpretation of thinner, closely packed fin-like rows. Kept one engine_glow material shared by 20 disconnected back surfaces. Kept the cabin mesh dimensions and world placement, shortening the head rather than moving the cabin outside the approved envelope. Removed three completely buried end caps; no visible shell surface was removed to fund the additions. Used symmetric preview lighting to make the front symmetry comparison readable. The archived round02-baseline.blend is the reproducible source baseline; it must be extracted alongside the fix script to rebuild this round.

## Artifact paths

'''
files=[O/'envelope.blend',O/'envelope-B.glb']
for view in ['34','side','front','top','rear','underside','symmetry']:files.append(O/f'envelope-B-{view}.png')
for view in ['side','front','top']:files.append(O/f'envelope-B-overlay-{view}.png')
files += [O/'report.md',O/'round02-acceptance.json',zpath]
files += [J/p for p in scripts]+[J/'report.md',J/'out/round02/A-before.json',J/'out/round02/acceptance.json',J/'out/round02/artifact-manifest.json']
report+='\n'.join('- '+str(p) for p in files)+'\n'
(J/'report.md').write_text(report);(O/'report.md').write_text(report)
manifest=[]
for p in files:
 if p.name=='artifact-manifest.json':continue
 assert p.exists(),p
 manifest.append({'path':str(p),'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()})
(J/'out/round02/artifact-manifest.json').write_text(json.dumps(manifest,indent=2))
print(json.dumps({'artifacts':len(files),'triangles':a['triangles'],'B_sha256':hashlib.sha256((O/'envelope-B.glb').read_bytes()).hexdigest(),'A_sha256':hashlib.sha256((O/'envelope-A.glb').read_bytes()).hexdigest(),'checks':'passed'},indent=2))
