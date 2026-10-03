from pathlib import Path
import json,zipfile,hashlib,shutil
from PIL import Image
J=Path.cwd();O=Path('/mnt/c/Users/Max/Documents/Blender/astra/well-dipper-trunk/player-ship/envelope')
a=json.load(open(O/'acceptance.json'));blend=json.load(open(O/'blend-check.json'))
assert blend['packed_blueprints']==4 and blend['flat_polygons']
for v in ['A','B']:
 r=json.load(open(O/f'reimport-{v}.json'));assert r['triangles']==a[v]['triangles'];assert a[v]['varying_triangle_corner_normals']==0
 for view in ['34','side','front','top','rear']:assert Image.open(O/f'envelope-{v}-{view}.png').size==(960,540)
 for view in ['side','front','top']:assert Image.open(O/f'envelope-{v}-overlay-{view}.png').width==1600
# Archive only files created in this run. Existing supplied references and blueprints stay untouched.
temp=[]
for pat in ['pass*.png','pass*-outline-metrics.json','check-*.png','mask-debug.png','render-*.log','build.log','inspect-blend.log','reimport-*.json','registration.json','blend-check.json','build_envelope.py','render_envelope.py','inspect_blend.py']:
 temp+=list(O.glob(pat))
temp=sorted(set(temp));archive=O/'envelope-evidence.zip'
with zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED) as z:
 for p in temp:z.write(p,p.name)
 for p in ['composite.py','audit.py','measure_overlays.py','finish.py']:z.write(J/p,'scripts/'+p)
with zipfile.ZipFile(archive) as z:assert z.testzip() is None
for p in temp:p.unlink()
backup=O/'envelope.blend1'
if backup.exists():backup.unlink()
# Rejected exploratory segmentation measurement remains documented inside the archive.
(J/'measure_overlays.py').unlink()
rows='\n'.join(f"| `{x['name']}` | {x['triangles']} | {x['triangles']} |" for x in a['A']['objects'])
bz=a['A']['bubble_z_range'];bb=a['A']['bbox_gltf_min'];bt=a['A']['bbox_gltf_max']
report=f'''# Player ship coarse envelope — six-pass acceptance report

**Technical checks passed. Visual approval is pending Max.** Two variants, 14 mesh objects each, 1,450 triangles each, seven materials each. This is a faceted volume study, not the finished hull.

## Technical checks passed

| Check | A — as drawn | B — contract |
|---|---:|---:|
| Triangles, GLB index count / 3 | 1,450 / 1,500 | 1,450 / 1,500 |
| Mesh objects | 14 | 14 |
| Materials | 7 | 7 |
| Length × height × width, metres | 18.025 × 10.900 × 10.400 | 18.025 × 10.900 × 10.400 |
| Bubble outer width | 5.100 m | 2.950 m |
| Bubble outer height including bands | 4.024 m | 2.146 m |
| Bubble length including bands | 3.455 m | 3.455 m |
| Bubble_MAIN glTF z-range | {bz[0]:.6f} to {bz[1]:.6f} m | {bz[0]:.6f} to {bz[1]:.6f} m |
| Cameras / lights / textures in GLB | 0 / 0 / 0 | 0 / 0 / 0 |
| Re-import mesh triangle count | 1,450 | 1,450 |
| GLB triangles with varying corner normals | 0 | 0 |

Both glTF bounding boxes, X/Y/Z in metres: min ({bb[0]:.6f}, {bb[1]:.6f}, {bb[2]:.6f}); max ({bt[0]:.6f}, {bt[1]:.6f}, {bt[2]:.6f}). glTF +Y is up and negative Z is forward. Bubble_MAIN is entirely forward of the origin.

The independent binary audit reads GLB accessors, counts indices, checks names and material values, and compares shared vertex arrays. All 12 common parts are byte-for-byte equal in exported position arrays. Only Bubble_MAIN and P05_Head differ. Blender then re-imported each GLB into an empty scene; every final render and every pass overlay renders that imported geometry. No source-only render is substituted. Blender imports glTF custom normals using smooth polygon flags; this flag alone is not evidence of smooth shading. The binary audit verifies identical normals at all three corners of every exported triangle (0 varying triangles), and the source .blend has 0 smooth polygons.

The seven material names are `glass`, `cockpit_frame`, `spine`, `decks`, `underslung`, `engine_block`, `nozzles`. All seven base colors match the requested linear RGB values within 1e-6; metallic is 0 and roughness is 1. Glass alpha is 0.15 with glTF alphaMode BLEND. There are no image textures or UV maps in the GLBs. Hollow sockets are integrated into P12_Engine_Carrier, with four dark interiors recessed 0.22 m behind their mouths; the mouths lie inside the surrounding rear rim and ahead of the 18 m rear limit.

The .blend contains Variant_A and Variant_B, 14 objects each, plus presentation objects and four packed blueprint image references. These are Blender image-reference planes (image empties), not exported geometry. Variant B starts hidden for a single-model viewport. The file has metre units, a 55 mm review camera, and flat polygon shading.

Origin: a common equal-density structural-component volume centroid, with overlapping component volumes counted and the cabin, variable brow, and open engine surfaces excluded. This is an explicit mass proxy, not a claimed physical centre of mass of an unspecified interior. Both variants use the same origin. Registration coordinates after centring are stored in the evidence archive.

## Object list, both variants

| Object | A triangles | B triangles |
|---|---:|---:|
{rows}

P07 contains two buried side bulges. Each P09 group contains a port and starboard rounded mass; there are three groups rather than a proposed final module count. P10 contains the attachment body and lower pod. P02 includes its crown. Bubble_MAIN contains glazing, two cream bands and the perimeter frame. Hatch and manoeuvring thrusters are omitted as requested.

## Registration and render method

Side crop: 29.4 px/m, x=10 at the nose and y=336 at the lowest pod. Front: 27 px/m, centreline x=145 and common baseline y=307. Rear reference: 27 px/m, centreline x=150 and y=307. Top: 26.3 px/m, nose x=10 and centreline y=145. Every crop retains uniform scale. The front centreline is 12.5 px left of the crop centre, so it is explicitly registered there instead of assuming the crop is centred. The side camera looks from Blender -X so the bow appears on the left.

Final standard views are 960×540. The ¾ camera is 20° above the XY plane, azimuth 125° measured from +X toward +Y, 55 mm, distance 53 m. Background RGB is (10,10,18), the 8-bit equivalent of (0.04,0.04,0.07). Side/front/top overlays are 1600 px wide with the same orthographic orientation, cropped to blueprint registration. The blueprint is composited at 50% opacity over white, and the model at 60% opacity over that to expose intersecting reference lines. No blueprint axis is stretched. Full model renders retain the specified material alpha.

## Loop log

Six geometry passes were built, exported, re-imported, and inspected in side, front and top for both variants. All 36 per-pass overlays, six A/B review pairs, and the raw registered renders are in envelope-evidence.zip. The following distances are visual estimates against the registered metre scale unless given as an explicit geometry dimension; they are not a pixel-fit certificate.

1. **Pass 1.** Corrected an initially reversed side camera and a front crop-centre offset before judging the overlays. Head: forward brow spread roughly 0.8–1.2 m too far sideways in top view. Crest: rise and 10.9 m summit in range; high yellow shoulders roughly 0.5–0.8 m low in front. Rear: surround skirt about 1 m below the side-view rear curve; closed aft hull would obscure sockets. Shoulders/bulges: box-like lobes exposed a roughly 0.8 m high side patch instead of merging. Belly: lowest pod around 2 m too far aft, subsequently isolated more clearly in pass 3. Modules: outer floors roughly 0.5–0.7 m low in front. Bubble: A necessarily exceeds the side-view height; B necessarily misses the front-view width. Fixes: narrowed brow, replaced bulge boxes with rounded buried forms, raised module floors, began opening rear housing.
2. **Pass 2.** Head/flank: plan body still approximately 0.6–0.9 m too wide forward of midship. Crest: same shoulder-height deficit. Rear: skirt and carrier treatment still too deep by approximately 0.6–1 m at the lower aft edge. Belly: longitudinal offset remained. Modules: grouped outlines now attached but side gaps needed inspection. Bubble: C1 differences remain. Interior lines: narrowed flank and extended the brow to make the front arch legible; the shell boundary remains a shallow overlap, not another horizontal plate. Fixes: narrowed forward/main flank, reduced rear surround depth, enlarged brow arch, added cream perimeter framing.
3. **Pass 3.** Head: B tracks the low side nose; A still intersects the common low nose volume. Crest: crown too broad in front and shoulders about 0.5–0.7 m low. Rear: localized lower edge discrepancy remained; the full rear check was scheduled. Belly: lowest pod centre was 10.5 m aft versus approximately 8 m in the crop, a ~2.5 m error. Modules: grouping left a short exposed side gap. Bubble: intentional size conflict plus A roof/hull penetration, requiring a geometry change. Fixes: moved pod centre to 8.3 m, broadened high shell curvature and narrowed crown, moved perimeter frame to cabin's widest section.
4. **Pass 4.** Head/bubble: A's taller cabin was visibly penetrated by the low yellow nose, exceeding 0.5 m locally. Crest: remaining high-shoulder discrepancy reduced below roughly 0.5 m. Rear: the added rear render showed yellow faces behind/over the socket interiors; this was a real geometry defect. Belly: longitudinal position now within roughly 0.3 m at the lower pod; attachment needed a later vertical-contact check. Modules: a ~0.4 m longitudinal gap created a larger local indentation than r10. Top: shared plan perimeter follows the main width trend, with box corners and shell facets remaining. Fixes: terminated closed hull parts ahead of sockets, retained shoulder above them, lifted A's brow and removed the redundant common nose volume, extended middle module group. Also widened ¾ camera framing to remove cabin clipping.
5. **Pass 5.** Head: A's raised brow now clears its cabin; this leaves a deliberate ~1.6 m departure from the low side-view brow. B follows the low nose. Crest: no new >0.5 m summit discrepancy identified. Rear: all four dark recesses visible; rear cap remains angular compared with the drawing. Belly: attachment top at 2.4 m stopped about 0.6 m below the central hull floor. Modules: outer floors still up to about 0.5 m low in the front comparison. Bubble: B roof had a local 0.3–0.6 m gap to the brow. Fixes: extended attachment into the hull to height 3.3 m, raised middle/aft module floors 0.2/0.4 m, lowered B's inner brow to height 2.55 m so it meets the roof. A's cabin conflict and the early spine boundary remain intentional/open.
6. **Pass 6.** Inspected all six final registered overlays. Head/bubble: A's taller/wider cabin and elevated brow still differ from side/top r10; B still differs from its large front-view cabin. Crest: height 10.9 m; crown spans 12.8–14.3 m aft. Rear: all four sockets clear, no engine part beyond the rear limit; faceted cap and local silhouette difference about 0.5 m remain. Shoulders: high arch is closer, while the coarse shell edge is still angular and interior overlap lines are not exact traced curves. Belly: no remaining detached root; lowest point 0 m, lower pod spans 7.1–9.5 m aft. Modules: no stalks; silhouette simplification and local differences of about 0.3–0.6 m remain. Bubble: B outer width 2.95 m, A 5.10 m. Stopped at the required six-pass maximum with those differences explicitly retained for Max's review, not declared approved.

An exploratory color-mask silhouette distance calculation was rejected: pale cream frame gaps and annotation strokes introduced false internal boundaries. Its JSON/script are archived as exploratory evidence only and are not used as acceptance numbers. The verified dimensional numbers come from exported positions; the visual estimates above come from viewing registered overlays.

## Remaining differences from r10

| Part | Remaining difference / decision |
|---|---|
| P01 front spine | Actual visible orange tip starts 1.65 m aft, following the early orange shape in the side crop. This does **not** implement the map's textual 5.3 m start. Top r10 starts around 3.4 m, so the boundary remains about 1.75 m earlier there; much of this low orange segment is buried under A's raised brow. Image precedence was used and this is an unresolved part-reading choice. |
| P02 rear spine / crest | 10.9 m summit and 12.8–14.3 m crown span fit the landmark range; crown and ridge are polygonal and the small crown is integrated into the ridge, not a separate raised detail. |
| P03 upper deck | Continuous swept overlap follows the rise; its side/top interior edge is a coarse chordal approximation and can depart approximately 0.5–0.8 m from drawn open strokes. No horizontal discs. |
| P04 flank | Common body begins behind the cabin so the two brow variants can solve their different roof heights. Outer plan/facet corners and lower curvature differ locally by roughly 0.3–0.6 m. The disputed long flank line remains one shallow overlap, not a third plate. |
| P05 head | B preserves the low nose. A raises the forward brow underside from about 2.9 to 4.5 m to clear the tall cabin, visibly departing from the side drawing. The broad front brow is faceted; forward ports are deferred thrusters and absent. |
| P06a aft shoulder | Rearmost cap is flatter and more angular than r10's rounded lobe. Rear reaches 18.0 m; cap construction is kept clear of the upper sockets. |
| P06b engine surround | Separate, thick faceted ring, 6.9 m at its outer rear width versus about 6.7 m in the map. Lower rear edge is locally about 0.5 m from the side curve. |
| P07 bulges | Emergence spans 8.4–12.7 m as mapped; 10.4 m maximum width. The low-resolution domes still make small visible side facets where the drawing reads a merged yellow body. |
| Bubble_MAIN A | 5.10 m outer width and 4.024 m outer height follow the large front cabin, not the small side/top cabin. Height exceeds the ~2.1 m side cabin by ~1.9 m and plan width exceeds the ~3 m cabin by ~2.1 m. Clear glass extends around the sides; the brief's ~3.5 m glass number is interpreted as a front-opening cue, not the full wraparound glazing bounding box. |
| Bubble_MAIN B | 2.95 m outer width, 2.146 m height and 3.455 m length follow the small cabin choice. It is 2.15 m narrower and about 1.88 m shorter vertically than A, so it intentionally disagrees with the unmodified front blueprint. |
| P09 module groups | Six rounded masses grouped in three objects replace the drawing's many individual boxes. Exact count, step rhythm, side hatch, rear panel and tiny recesses are deferred. Local silhouette corners differ about 0.3–0.6 m. |
| P10 belly pod | Lowest point 0 m, centre 8.3 m aft; attachment now intersects the hull. More consolidated and symmetric than the drawn steps. |
| P12 carrier | Four ten-sided recessed sockets; no nozzle protrusion. Some upper carrier area is covered by the yellow shoulder, and the rear carrier/surround proportions remain provisional. |

These are not an empty difference list and not visual approval. Max chooses A or B and judges the overall part reading before detailed panel work.

## Decisions and exclusions

Used only the supplied r10 crops and maps, never old sculpts/models. Built longitudinal swept hull volumes with intersecting boundaries, not stacked discs. Used three paired module groups. Adopted one shared structural origin for both variants. Stored packed image reference planes in the .blend. No hatch, thrusters, interior, textures, labels, decals or glow were added to asset geometry. Review comparison labels exist only outside the model renders. Source/render processes were short separate background Blender calls; no existing parent project scene was modified or saved.

## Files

All paths below are absolute. The evidence ZIP contains the per-pass images, logs, re-import checks, registration and executable source copies; these member files are not additional loose deliverables.
'''
# Final loose artifacts, including reproducible sources in the job directory.
final_out=[O/'envelope.blend',O/'envelope-A.glb',O/'envelope-B.glb']
for v in ['A','B']:
 for view in ['34','side','front','top','rear']:final_out.append(O/f'envelope-{v}-{view}.png')
 for view in ['side','front','top']:final_out.append(O/f'envelope-{v}-overlay-{view}.png')
final_out += [O/'envelope-comparison.png',O/'acceptance.json',archive,O/'report.md']
jobfiles=[J/p for p in ['build_envelope.py','render_envelope.py','composite.py','audit.py','inspect_blend.py','finish.py','report.md','out/audit-summary.json','out/artifact-manifest.json']]
allfiles=final_out+jobfiles
report+='\n'.join('- '+str(p) for p in allfiles)+'\n'
(J/'report.md').write_text(report);(O/'report.md').write_text(report)
manifest=[]
for p in allfiles:
 if p.name=='artifact-manifest.json':continue
 assert p.exists(),p
 manifest.append({'path':str(p),'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()})
(J/'out/artifact-manifest.json').write_text(json.dumps(manifest,indent=2))
print(json.dumps({'verified_artifacts':len(allfiles),'triangle_counts':[a[v]['triangles'] for v in ['A','B']],'bbox':a['A']['bbox_gltf_dimensions'],'bubble_z_range':bz,'glb_hashes':{v:hashlib.sha256((O/f'envelope-{v}.glb').read_bytes()).hexdigest() for v in ['A','B']},'blend_check':blend},indent=2))
