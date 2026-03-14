# Research: Procedural 3D Model Generation for Well Dipper

> Research on generating spaceships, stations, and animated models procedurally
> in Blender (via Python/MCP) for import into a Three.js retro space game.

---

## Table of Contents

1. [Hull Generation Approaches](#1-hull-generation-approaches)
2. [Ship Archetypes and Parameters](#2-ship-archetypes-and-parameters)
3. [Blender Python API Reference](#3-blender-python-api-reference)
4. [Existing Procedural Ship Generators](#4-existing-procedural-ship-generators)
5. [Low-Poly / PS1 Aesthetic Considerations](#5-low-poly--ps1-aesthetic-considerations)
6. [Procedural Space Stations](#6-procedural-space-stations)
7. [Animation and Export Pipeline](#7-animation-and-export-pipeline)
8. [Recommendations for Well Dipper](#8-recommendations-for-well-dipper)
9. [Sources](#9-sources)

---

## 1. Hull Generation Approaches

There are five main approaches to procedural hull generation. Each has trade-offs in
complexity, visual quality, and suitability for low-poly retro aesthetics.

### 1a. Iterative Extrusion (The SpaceshipGenerator Method)

**How it works:** Start with a box primitive. Extrude the front and rear faces
multiple times, applying random translation, scaling, and rotation at each step.
Then pick random side faces and extrude those too (reducing scale each time) to
add asymmetry and detail protrusions.

**Algorithm steps:**
1. Create a box (cube or elongated cuboid)
2. Extrude front face N times with random scale/translate per step
3. Extrude rear face M times similarly
4. Categorize remaining faces by orientation (top, bottom, side)
5. Randomly extrude some of these faces to add greebles/details
6. Optionally mirror for bilateral symmetry
7. Apply bevel modifier for edge definition
8. Assign materials by face orientation

**Best for:** Organic, asymmetric ships. Good for freighters and capitals where
irregular shapes look intentional.

**Retro suitability:** Excellent. The extrusion approach naturally produces low-poly
geometry. Each extrusion adds only a handful of faces.

### 1b. Primitive Combination (Kitbashing)

**How it works:** Define a library of pre-made parts (cockpit shapes, wing
profiles, engine bells, hull segments, antenna masts). Assemble ships by
selecting parts from each category and joining/positioning them according to
rules.

**Algorithm steps:**
1. Define part categories: nose, hull_mid, hull_rear, wings, engines, accessories
2. Each category has multiple variants (mesh data or generator functions)
3. Ship recipe: pick one from each category, parameterize size/position
4. Place parts along a central axis, join meshes
5. Optionally use boolean operations to merge intersecting parts

**Best for:** Recognizable ship silhouettes. Fighters and shuttles where you want
distinct cockpits, wings, and engines.

**Retro suitability:** Very good. Each part can be hand-tuned for low poly count.
Total ship = sum of parts, easy to budget polygons.

### 1c. Subdivision + Displacement

**How it works:** Start with a low-poly base shape, apply subdivision surface,
then use displacement (noise textures or procedural functions) to add surface
detail.

**Best for:** Organic/alien ships, asteroids, biological vessels.

**Retro suitability:** Poor for PS1 aesthetic. Subdivision inherently produces
smooth, high-poly results. Would need aggressive decimation afterward, losing
the characteristic flat-shaded angular look.

**Verdict:** Skip this approach for Well Dipper. It fights the retro aesthetic.

### 1d. L-Systems / Grammar-Based Generation

**How it works:** Define a formal grammar with production rules. Starting from
an axiom, apply rules iteratively to produce a string of symbols, then
interpret those symbols as 3D modeling operations (extrude, branch, rotate, place
component).

**Example grammar:**
```
Axiom: HULL
Rules:
  HULL -> [nose] BODY [engines]
  BODY -> segment BODY | segment WING_PAIR
  WING_PAIR -> [left_wing] [right_wing]
  segment -> extrude(random_length, random_scale)
```

**Best for:** Highly varied, branching structures. Good for space stations,
capital ships with complex silhouettes, or alien vessels.

**Retro suitability:** Good, but complex to implement. The grammar approach gives
fine control over structure but requires significant upfront design of the
rule set.

**Verdict:** Interesting for stations (see Section 6). Overkill for simple ship
archetypes where kitbashing is simpler and more controllable.

### 1e. Geometry Nodes (Blender-Native)

**How it works:** Build the ship as a node graph in Blender's Geometry Nodes
system. Parameters become sliders in the modifier panel. A Seed input drives
Random Value nodes for variation.

**This is what Well Dipper is already doing** for the Fighter archetype (see
blender-ships-progress.md). The GeoNodes approach has major advantages:
- Interactive: Max can tweak ships visually in the viewport
- Seed-driven: change one number, get a different ship
- Exportable: bake to mesh, export as .glb
- Reusable: sub-groups for shared operations (taper, UV mapping, etc.)

**Retro suitability:** Excellent. Full control over vertex count via grid
resolutions and mesh detail levels.

### Summary: Which Approach for Which Archetype?

| Archetype | Recommended Approach | Why |
|-----------|---------------------|-----|
| Fighter | Geometry Nodes (already building) | Interactive, seed-driven, good control |
| Shuttle | Geometry Nodes | Simple shapes, few parameters needed |
| Freighter | Geometry Nodes + kitbash parts | Multiple subtypes need modular parts |
| Cruiser | Geometry Nodes | Wedge hull + attachments maps well to nodes |
| Capital | GeoNodes + iterative extrusion for greebles | Need complexity at large scale |
| Explorer | Geometry Nodes | Distinctive shapes via parameter variation |
| Stations | Grammar/modular + GeoNodes | Modular assembly suits stations best |

---

## 2. Ship Archetypes and Parameters

Each archetype needs a set of parameters that, when randomized from a seed,
produce visually distinct but recognizable ships within the archetype.

### Fighter (200-400 polys)
Already in progress via GeoNodes. Current parameters:
- Hull Length, Hull Radius (body proportions)
- Wing Span, Chord, Sweep, Position, Taper, Tip Round, Height
- Still needed: cockpit size/position, engine count/size, seed wiring

**Silhouette goals:** Small, angular, aggressive. Think X-Wing, Viper, Arwing.

### Shuttle (200-400 polys)
- Hull: boxy cuboid, slight taper at nose
- Wings: stubby or absent (delta stubs)
- Engines: 1-2, embedded in rear hull
- Cockpit: wide windshield across front face
- Cargo: visible bay door or rear ramp (single face, different color)

**Parameters:** hull_width, hull_height, hull_length, nose_taper, wing_type
(none/stub/delta), engine_recess, window_rows

### Freighter (400-800 polys)
Five subtypes per blender-ships-progress.md:
1. **Spine hauler:** long backbone with cargo pods hanging off it
2. **Catamaran:** twin parallel hulls with cargo between
3. **Box hauler:** single massive rectangular hull
4. **Disc:** flying saucer shape, cargo underneath
5. **Tanker tug:** small cab pulling large cylindrical tanks

**Parameters:** subtype, spine_length, pod_count, pod_size, hull_separation,
tank_count, cab_size

### Cruiser (400-800 polys)
- Hull: wedge or elongated diamond shape
- Bridge: raised tower near rear
- Engines: bank of 3-6 at stern
- Weapon hardpoints: angled faces along hull sides
- Armor plates: extruded panels

**Parameters:** hull_length, hull_width, wedge_angle, bridge_height,
engine_count, engine_size, plate_count

### Capital Ship (600-1000 polys)
- Hull: massive slab or wedge
- Surface: greeble system (small random extrusions on faces)
- Features: flight deck (recessed bay), antenna arrays, turret bumps
- Scale: 5-10x larger than fighters

**Parameters:** hull_type (slab/wedge/cylinder), greeble_density,
greeble_max_height, bay_count, antenna_count, turret_count

### Explorer (300-600 polys)
- Hull: unusual shapes (saucer + nacelles, hammerhead, ring ship)
- Features: large sensor dish, solar panels, fuel tanks, antenna booms
- Feel: scientific, asymmetric, functional

**Parameters:** hull_type (saucer/hammerhead/ring), nacelle_count,
dish_size, panel_count, boom_length

---

## 3. Blender Python API Reference

### 3a. Creating Meshes with bmesh

bmesh is Blender's mesh editing library. It lets you create and manipulate
mesh data without going through the slower bpy.ops operators.

**Basic workflow:**
```python
import bpy
import bmesh

# Create a new mesh and object
mesh = bpy.data.meshes.new("MyShip")
obj = bpy.data.objects.new("MyShip", mesh)
bpy.context.collection.objects.link(obj)

# Create bmesh, build geometry
bm = bmesh.new()

# Method 1: Start from a primitive
bmesh.ops.create_cube(bm, size=2.0)

# Method 2: Build from scratch
v1 = bm.verts.new((0, 0, 0))
v2 = bm.verts.new((1, 0, 0))
v3 = bm.verts.new((1, 1, 0))
v4 = bm.verts.new((0, 1, 0))
bm.faces.new((v1, v2, v3, v4))

# Write bmesh back to mesh
bm.to_mesh(mesh)
bm.free()
```

**Extrusion (the core spaceship technique):**
```python
import bmesh
from mathutils import Vector
import random

bm = bmesh.new()
bmesh.ops.create_cube(bm, size=1.0)
bm.faces.ensure_lookup_table()

# Pick the front face (+Y normal)
front_face = None
for f in bm.faces:
    if f.normal.y > 0.9:
        front_face = f
        break

# Extrude it forward with random variation
for i in range(4):
    result = bmesh.ops.extrude_face_region(bm, geom=[front_face])
    new_verts = [e for e in result['geom'] if isinstance(e, bmesh.types.BMVert)]

    # Move extruded verts forward
    length = random.uniform(0.3, 1.0)
    scale = random.uniform(0.7, 1.0)
    for v in new_verts:
        v.co.y += length
        v.co.x *= scale
        v.co.z *= scale

    # Update face reference for next iteration
    new_faces = [e for e in result['geom'] if isinstance(e, bmesh.types.BMFace)]
    if new_faces:
        front_face = new_faces[0]
```

### 3b. Boolean Operations

Boolean operations combine meshes (union, difference, intersection). Useful
for kitbashing when you want parts to merge cleanly rather than just overlap.

```python
import bpy

# Assume obj_hull and obj_wing exist
# Add boolean modifier to hull
bool_mod = obj_hull.modifiers.new(name="BoolUnion", type='BOOLEAN')
bool_mod.operation = 'UNION'
bool_mod.object = obj_wing

# Apply the modifier
bpy.context.view_layer.objects.active = obj_hull
bpy.ops.object.modifier_apply(modifier=bool_mod.name)

# Delete the tool object (wing) since it's merged
bpy.data.objects.remove(obj_wing, do_unlink=True)
```

**Warning:** Boolean operations can produce messy topology (non-manifold edges,
n-gons). For low-poly retro ships, it's often better to just join meshes
(`bpy.ops.object.join()`) and accept the overlapping geometry. At 200-500
polys, boolean artifacts are visible and ugly. Simple joining + vertex
merging is more reliable.

### 3c. Modifiers via Script

```python
import bpy

obj = bpy.context.active_object

# Subdivision Surface (use sparingly for retro!)
sub = obj.modifiers.new(name="Subdiv", type='SUBSURF')
sub.levels = 1        # viewport
sub.render_levels = 1  # render

# Solidify (add thickness to flat surfaces)
solid = obj.modifiers.new(name="Solidify", type='SOLIDIFY')
solid.thickness = 0.05

# Bevel (chamfer edges for definition)
bevel = obj.modifiers.new(name="Bevel", type='BEVEL')
bevel.width = 0.02
bevel.segments = 1  # keep it low-poly!

# Decimate (reduce poly count)
dec = obj.modifiers.new(name="Decimate", type='DECIMATE')
dec.ratio = 0.5  # keep 50% of faces

# Apply all modifiers
for mod in obj.modifiers:
    bpy.ops.object.modifier_apply(modifier=mod.name)
```

### 3d. Vertex Colors

Vertex colors are painted per-vertex per-face-loop. They're the most
PS1-authentic way to color low-poly models.

```python
import bpy
import bmesh

obj = bpy.context.active_object
mesh = obj.data

# Create vertex color layer
if not mesh.color_attributes:
    mesh.color_attributes.new(name="Color", type='BYTE_COLOR', domain='CORNER')

bm = bmesh.new()
bm.from_mesh(mesh)

# Access the color layer
color_layer = bm.loops.layers.color.active

# Color faces based on normal direction
for face in bm.faces:
    for loop in face.loops:
        if face.normal.z > 0.5:
            loop[color_layer] = (0.8, 0.4, 0.1, 1.0)  # orange top
        elif face.normal.z < -0.5:
            loop[color_layer] = (0.2, 0.2, 0.3, 1.0)  # dark bottom
        else:
            loop[color_layer] = (0.1, 0.2, 0.6, 1.0)  # blue sides

bm.to_mesh(mesh)
bm.free()
```

**Material setup for vertex colors to display:**
```python
mat = bpy.data.materials.new(name="VertexColorMat")
mat.use_nodes = True
nodes = mat.node_tree.nodes
links = mat.node_tree.links

# Clear default nodes
for node in nodes:
    nodes.remove(node)

# Add vertex color node -> principled BSDF -> output
output = nodes.new('ShaderNodeOutputMaterial')
bsdf = nodes.new('ShaderNodeBsdfPrincipled')
vcol = nodes.new('ShaderNodeVertexColor')
vcol.layer_name = "Color"

links.new(vcol.outputs['Color'], bsdf.inputs['Base Color'])
links.new(bsdf.outputs['BSDF'], output.inputs['Surface'])

# Set metallic to 0, roughness to 1 for flat retro look
bsdf.inputs['Metallic'].default_value = 0.0
bsdf.inputs['Roughness'].default_value = 1.0

obj.data.materials.append(mat)
```

### 3e. Exporting as .glb

```python
import bpy

# Select the objects to export
bpy.ops.object.select_all(action='DESELECT')
obj = bpy.data.objects['MyShip']
obj.select_set(True)
bpy.context.view_layer.objects.active = obj

# Export selected as GLB
bpy.ops.export_scene.gltf(
    filepath='C:/Users/Max/Documents/Blender/ship_exports/fighters/fighter_001.glb',
    export_format='GLB',
    use_selection=True,          # only selected objects
    export_apply=True,           # apply modifiers
    export_colors=True,          # include vertex colors
    export_normals=True,
    export_materials='EXPORT',   # include materials
    export_yup=True,             # Y-up for Three.js
    check_existing=False
)
```

**Batch export (all ships in a collection):**
```python
import bpy
import os

export_dir = 'C:/Users/Max/Documents/Blender/ship_exports/fighters/'
os.makedirs(export_dir, exist_ok=True)

collection = bpy.data.collections.get("Fighters")
if collection:
    for obj in collection.objects:
        # Deselect all, select just this object
        bpy.ops.object.select_all(action='DESELECT')
        obj.select_set(True)
        bpy.context.view_layer.objects.active = obj

        filepath = os.path.join(export_dir, f"{obj.name}.glb")
        bpy.ops.export_scene.gltf(
            filepath=filepath,
            export_format='GLB',
            use_selection=True,
            export_apply=True,
            export_colors=True,
            export_yup=True,
            check_existing=False
        )
        print(f"Exported: {filepath}")
```

---

## 4. Existing Procedural Ship Generators

### a1studmuffin/SpaceshipGenerator (Open Source, Python/bmesh)

**Repository:** https://github.com/a1studmuffin/SpaceshipGenerator

The most well-known open-source procedural spaceship generator for Blender.
Originally written for Blender 2.77, with a maintained fork by ldo at
https://github.com/ldo/blender_spaceship_generator.

**Algorithm summary:**
1. Start with a box
2. Extrude front/rear faces with random transform per step
3. Add asymmetric protrusions by extruding random side faces
4. Categorize faces by orientation, add detail geometry (engines, antenna, turrets)
5. Optionally apply bilateral symmetry
6. Add bevel modifier
7. Assign materials based on face orientation

**What to learn from it:**
- The extrusion-with-variation technique is simple and effective
- Face classification by normal direction is a great way to assign different
  details and colors to different parts of the ship
- Seed-based generation (pass a seed to get reproducible ships)
- The code is well-commented and readable

**Limitations for Well Dipper:**
- Produces high-poly ships (thousands of faces) -- would need decimation
- Material system uses image textures, not vertex colors
- Doesn't produce distinct archetypes (all ships look somewhat similar)
- Written for Blender 2.x, some API calls need updating for 4.x

### Geometry Nodes Spaceship Generators (Commercial/Community)

Several Geometry Nodes-based generators exist on Gumroad and Blender Market:
- **Procedural Starship Generator** (superhivemarket.com) -- uses GeoNodes for
  infinite seed-based variation, includes shaders
- **Spaceship Generator by huykhoi2407** (Gumroad) -- GeoNodes from scratch
- **Blender Studio training** (studio.blender.org) -- free tutorial on building
  a spaceship generator with GeoNodes

**What to learn from them:**
- Seed input -> Random Value nodes for parameterizing every aspect
- Sub-groups for reusable operations (hull taper, engine placement, etc.)
- The GeoNodes approach is the modern standard for this kind of work

### Blender Studio Spaceship Generator Tutorial

Available at: https://studio.blender.org/training/geometry-nodes-from-scratch/spaceship-generator/

This is a free official Blender Studio tutorial that teaches building a
procedural spaceship generator from scratch using Geometry Nodes. Most directly
relevant to what Well Dipper is already doing.

---

## 5. Low-Poly / PS1 Aesthetic Considerations

### Target Poly Counts

PS1-era polygon budgets per model:

| Model Type | PS1 Actual | Well Dipper Target | Notes |
|------------|-----------|-------------------|-------|
| Fighter | 100-300 tris | 200-400 tris | Small on screen, keep lean |
| Shuttle | 100-300 tris | 200-400 tris | Simple shapes |
| Freighter | 200-500 tris | 400-800 tris | Larger, more parts |
| Cruiser | 200-500 tris | 400-800 tris | Detail in silhouette, not surface |
| Capital | 300-800 tris | 600-1000 tris | Greebles add up |
| Explorer | 200-400 tris | 300-600 tris | Distinctive shape > detail |
| Station module | 100-300 tris | 200-500 tris | Repeated, keep cheap |

Well Dipper can be slightly more generous than actual PS1 because WebGL has
no real poly limit at these scales, but the aesthetic demands angular,
faceted geometry. Going above ~1000 tris per ship would look too smooth.

### Vertex Colors vs UV Texturing

**Vertex colors (recommended for most ships):**
- Most PS1-authentic: Spyro, Crash Bandicoot used vertex colors extensively
- Zero texture memory overhead
- Colors are per-vertex-per-face, so you get hard color boundaries at edges
- Perfect for the Chris Foss stripe/chevron patterns Well Dipper uses
- Limitation: color resolution is limited by vertex density. A 6-face cube
  can only have 6 colors.

**UV textures (128x128, for ships that need patterns):**
- Needed when color patterns are more complex than the geometry can express
- Well Dipper's current shader system generates procedural patterns
  (stripes, chevrons) that need baking to 128x128 textures for .glb export
- This is what the GeoNodes Fighter currently plans to do

**Recommendation:** Use the procedural shader -> bake -> 128x128 texture pipeline
already designed. It gives Chris Foss patterns on simple geometry. Vertex colors
alone can't produce striped paint jobs on a 300-poly ship.

### Making Low-Poly Ships Look Good

1. **Silhouette is everything.** At 200-500 polys, surface detail is invisible.
   What reads is the outline shape. Wings, engines, antenna -- anything that
   breaks the silhouette matters more than surface greebles.

2. **Flat shading, not smooth.** Use flat shading (sharp edges) everywhere.
   Smooth shading on low-poly geometry creates ugly "pillow" effects and
   looks nothing like PS1 games.

3. **Bold color contrast.** With posterized colors and Bayer dithering,
   subtle color gradients disappear. Use high-contrast color pairs
   (orange/blue, yellow/black) -- exactly what the Chris Foss palette does.

4. **Asymmetry adds interest** but bilateral symmetry reads as "ship." Most
   PS1 ships were symmetric. Use asymmetry sparingly (one different wing,
   an off-center antenna).

5. **Avoid tiny features.** At the game's render resolution (pixelScale 3),
   any feature smaller than ~3 pixels disappears. Antenna and small details
   need to be exaggerated in size to read on screen.

6. **Emissive faces for engines.** Mark engine exhaust faces with an emissive
   material. In Three.js, these will glow through the dithering shader,
   giving ships visible thrust without particles.

---

## 6. Procedural Space Stations

### Station Types and Construction

#### Orbital Habitat (Ring/Torus)
- Central hub cylinder
- 1-3 torus rings at different angles/sizes
- Spokes connecting rings to hub
- Docking arms extending from hub

**Construction approach:** Generate hub as cylinder, torus rings via
bmesh.ops.create_circle (extruded around a path), spokes as thin cylinders.
Parameterize: ring_count, ring_radius, ring_tilt, spoke_count, hub_length.

#### Military Station
- Angular, aggressive shapes
- Weapon platforms (extruded hexagonal prisms)
- Armor plating (extruded panels)
- Hangar bays (recessed rectangular faces)

**Construction approach:** Start from elongated octagonal prism. Extrude faces
for weapon pods and platforms. Boolean difference for hangar bays.

#### Mining Station
- Irregular, industrial look
- Asteroid-mounted (station geometry attached to a rough sphere)
- Crane arms, ore containers, processing equipment
- Exposed structure, pipes, tanks

**Construction approach:** Noise-displaced icosphere for asteroid base.
Attach modular parts (containers, arms, tanks) at random surface points.

#### Trading Post
- Modular, expandable
- Central docking ring or arm system
- Visible cargo containers/pods
- Communication arrays

**Construction approach:** Central hub + radial docking arms.
Randomize arm_count, arm_length, pod_count per arm.

### Modular Assembly System

The most flexible approach for stations is a module-and-socket system:

**Module types:**
- Hub (cylinder, connects to 2-6 other modules)
- Spoke (thin cylinder, connects hub to ring)
- Ring section (curved segment, connects to other ring sections)
- Dock (rectangular arm with a docking collar at the end)
- Antenna (thin rod with dish or array at tip)
- Solar panel (flat rectangle, possibly angled)
- Cargo pod (cube or cylinder, attached to spoke or hub)
- Hab module (larger cylinder, windowed)

**Connection system:**
```
Each module has attachment points defined as:
  - position (Vector3)
  - direction (Vector3 normal pointing outward)
  - size category (small/medium/large)
  - allowed_connections (list of module types that can attach here)

Assembly algorithm:
  1. Place root module (usually a hub)
  2. For each open attachment point:
     a. Roll random: attach something or leave empty?
     b. If attaching: pick compatible module type
     c. Place module, aligning its input point to the socket
     d. Add the new module's output points to the open list
  3. Repeat until max_modules reached or all points filled
  4. Join all meshes
```

**In Blender Python:**
```python
import bpy
from mathutils import Vector, Quaternion
import random

def place_module(module_mesh, position, direction):
    """Place a module at a connection point, oriented along direction."""
    obj = bpy.data.objects.new("module", module_mesh.copy())
    bpy.context.collection.objects.link(obj)
    obj.location = position

    # Orient module to face along the connection direction
    rot = direction.to_track_quat('Y', 'Z')
    obj.rotation_euler = rot.to_euler()
    return obj

def build_station(seed, max_modules=12):
    random.seed(seed)
    modules = []  # list of placed module objects
    open_points = []  # (position, direction, size) tuples

    # Start with central hub
    hub = create_hub_mesh()  # returns bpy.types.Mesh
    root = place_module(hub, Vector((0,0,0)), Vector((0,1,0)))
    modules.append(root)

    # Hub has 4 radial attachment points
    for angle in [0, 90, 180, 270]:
        rad = angle * 3.14159 / 180
        dir = Vector((cos(rad), 0, sin(rad)))
        open_points.append((dir * 2.0, dir, 'medium'))

    # Grow the station
    while open_points and len(modules) < max_modules:
        pos, dir, size = open_points.pop(0)
        if random.random() < 0.3:  # 30% chance to skip
            continue
        module_type = random.choice(['spoke', 'dock', 'hab', 'cargo'])
        mesh = create_module_mesh(module_type)
        obj = place_module(mesh, pos, dir)
        modules.append(obj)
        # Add this module's output points to the open list...

    # Join all modules into one mesh
    bpy.ops.object.select_all(action='DESELECT')
    for m in modules:
        m.select_set(True)
    bpy.context.view_layer.objects.active = modules[0]
    bpy.ops.object.join()
```

### Scale Considerations

| Object | Well Dipper Scale (units) | Relative Size |
|--------|--------------------------|---------------|
| Fighter | 1-2 | 1x (reference) |
| Shuttle | 1.5-3 | 1.5x |
| Freighter | 3-8 | 4x |
| Cruiser | 5-12 | 6x |
| Capital | 10-25 | 15x |
| Small station | 15-30 | 20x |
| Large station | 40-100 | 50x |
| Planet | 500-5000 | 1000x+ |

Stations should be clearly larger than any ship but much smaller than
planets. At extreme distances, stations can use a simple LOD approach:
replace the detailed mesh with a single bright dot or very simplified shape.

### LOD Strategy for Stations

Given Well Dipper's retro aesthetic and pixelated rendering:
- **Far:** Station is a single bright pixel (point light or sprite)
- **Medium:** Station is a simplified 20-50 poly silhouette mesh
- **Close:** Full station mesh (200-500 polys total)

The pixel-scale rendering (pixelScale 3) means LOD transitions are forgiving --
the low resolution hides pop-in naturally.

---

## 7. Animation and Export Pipeline

### 7a. Blender: Creating Simple Animations

For retro ships, animations should be simple: rotating radar dishes,
pulsing engine glow, opening bay doors.

**Keyframe animation in Python:**
```python
import bpy

obj = bpy.data.objects['RadarDish']

# Set keyframes for rotation
obj.rotation_euler = (0, 0, 0)
obj.keyframe_insert(data_path='rotation_euler', frame=1)

obj.rotation_euler = (0, 0, 6.28318)  # full rotation
obj.keyframe_insert(data_path='rotation_euler', frame=60)

# Make it loop: set interpolation to linear
for fcurve in obj.animation_data.action.fcurves:
    for kp in fcurve.keyframe_points:
        kp.interpolation = 'LINEAR'
    # Set extrapolation to repeat
    fcurve.extrapolation = 'LINEAR'
```

**Exporting with animations:**
```python
bpy.ops.export_scene.gltf(
    filepath='station_animated.glb',
    export_format='GLB',
    export_animations=True,
    export_force_sampling=True,  # bake all keyframes
    export_frame_step=2,         # sample every 2 frames (saves file size)
    export_yup=True,
    check_existing=False
)
```

**Important:** For animations to export in glTF, the animated objects must be
separate from the static geometry. If you join everything into one mesh, the
per-object animations are lost. Instead, export the station as a hierarchy
(parent-child relationships) where animated parts remain separate objects.

### 7b. Three.js: Loading and Playing glTF Animations

```javascript
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { AnimationMixer } from 'three';

const loader = new GLTFLoader();
const mixers = []; // track all active mixers

loader.load('assets/ships/station_animated.glb', (gltf) => {
    const model = gltf.scene;
    scene.add(model);

    // If the model has animations, set up a mixer
    if (gltf.animations.length > 0) {
        const mixer = new AnimationMixer(model);

        // Play all animations
        gltf.animations.forEach((clip) => {
            const action = mixer.clipAction(clip);
            action.play();
        });

        mixers.push(mixer);
    }
});

// In the render loop:
function animate(deltaTime) {
    mixers.forEach(mixer => mixer.update(deltaTime));
}
```

**Finding specific animations by name:**
```javascript
import { AnimationClip } from 'three';

// If you named your action "RadarSpin" in Blender:
const clip = AnimationClip.findByName(gltf.animations, 'RadarSpin');
if (clip) {
    const action = mixer.clipAction(clip);
    action.play();
}
```

### 7c. Runtime Procedural Animation in Three.js

For most ship animations, baked glTF animations are overkill. Simple
runtime math is more flexible and costs nothing to export.

**Ship banking during turns:**
```javascript
// In ship update loop:
const turnRate = ship.angularVelocity; // radians/sec
const maxBank = Math.PI / 6; // 30 degrees

// Bank proportional to turn rate, with smoothing
ship.targetBank = -turnRate * 2.0;
ship.targetBank = Math.max(-maxBank, Math.min(maxBank, ship.targetBank));
ship.currentBank += (ship.targetBank - ship.currentBank) * 0.1;

ship.model.rotation.z = ship.currentBank;
```

**Engine glow (emissive material intensity):**
```javascript
// Find engine meshes (tagged during export or by name convention)
const engineMeshes = [];
ship.model.traverse((child) => {
    if (child.isMesh && child.name.includes('engine')) {
        engineMeshes.push(child);
    }
});

// Pulse engine glow
function updateEngineGlow(throttle, time) {
    const pulse = 0.8 + 0.2 * Math.sin(time * 8); // subtle flicker
    const intensity = throttle * pulse;

    engineMeshes.forEach(mesh => {
        mesh.material.emissiveIntensity = intensity;
    });
}
```

**Retro thruster effect (scaling geometry instead of particles):**
```javascript
// Thruster is a cone mesh parented to the ship
// Scale it based on throttle for a simple "flame" effect
function updateThruster(thrusterMesh, throttle) {
    const len = 0.5 + throttle * 1.5; // flame length
    const flicker = 0.9 + Math.random() * 0.2;
    thrusterMesh.scale.set(1, len * flicker, 1);
    thrusterMesh.visible = throttle > 0.05;
}
```

**Rotating parts (radar dishes, station rings):**
```javascript
// Simple rotation each frame -- no animation system needed
radarDish.rotation.y += deltaTime * 0.5; // half revolution per second
stationRing.rotation.z += deltaTime * 0.1; // slow majestic rotation
```

### 7d. The Existing Ship Pipeline

Ships flow through this pipeline:

```
Blender (procedural generation)
    |
    v
.glb files exported to:
  C:\Users\Max\Documents\Blender\ship_exports\{archetype}\
    |
    v
npm run sync-ships (runs scripts/sync-ships.sh)
    |
    v
rsync copies .glb to public/assets/ships/{archetype}/
    |
    v
scripts/generate-ship-manifest.js creates manifest.json
    |
    v
ShipLoader.js loads manifest, then loads .glb via GLTFLoader
    |
    v
loadShipModel(archetype, index, rng) returns cloned Object3D
```

**For procedurally generated ships to work with this pipeline:**
1. The Blender generation script must export to the correct directory structure
2. File naming must be consistent (e.g., `fighter_seed001.glb`)
3. After batch generation, run `npm run sync-ships` to copy and rebuild manifest
4. ShipLoader.js doesn't need changes -- it already handles arbitrary .glb files
   organized by archetype folder

**Batch generation script (to run via Blender MCP or command line):**
```python
import bpy
import os

EXPORT_BASE = 'C:/Users/Max/Documents/Blender/ship_exports'

def generate_and_export(archetype, seed_start, count):
    """Generate `count` ships of `archetype` starting from seed_start."""
    export_dir = os.path.join(EXPORT_BASE, archetype)
    os.makedirs(export_dir, exist_ok=True)

    for i in range(count):
        seed = seed_start + i

        # Clear previous generation
        bpy.ops.object.select_all(action='SELECT')
        bpy.ops.object.delete()

        # Set seed on the generator (archetype-specific)
        # This would set the Seed input on the GeoNodes modifier
        generate_ship(archetype, seed)  # your generation function

        # Apply all modifiers (realize geometry nodes)
        obj = bpy.context.active_object
        bpy.ops.object.convert(target='MESH')

        # Bake shader to 128x128 texture
        bake_shader_to_texture(obj)  # your bake function

        # Export
        filepath = os.path.join(export_dir, f"{archetype}_seed{seed:04d}.glb")
        bpy.ops.export_scene.gltf(
            filepath=filepath,
            export_format='GLB',
            use_selection=True,
            export_apply=True,
            export_colors=True,
            export_yup=True,
            check_existing=False
        )
        print(f"[{i+1}/{count}] Exported: {filepath}")

# Example: generate 20 fighters
generate_and_export('fighters', seed_start=1, count=20)
```

---

## 8. Recommendations for Well Dipper

### Immediate Next Steps (Phase 1: Complete Fighter)

1. **Finish the GeoNodes Fighter** -- cockpit, engines, seed wiring
2. **Build the shader bake pipeline** -- procedural shader nodes to 128x128
   image texture for .glb export
3. **Test end-to-end:** GeoNodes Fighter -> bake -> export .glb -> sync ->
   load in Three.js -> verify it looks right with dithering shader

### Medium Term (Phase 2: Remaining Archetypes)

4. **One archetype per session** -- each gets its own GeoNodes group
5. **Extract shared sub-groups** -- hull taper, UV mapping, engine placement,
   exhaust discs can be reused across archetypes
6. **Shuttle first** (simplest after fighter), then Freighter (most subtypes),
   then Cruiser, Explorer, Capital

### Batch Generation (Phase 3)

7. **Write the batch export script** -- loop over seeds, realize geometry,
   bake textures, export .glb. Run via Blender MCP or command line.
8. **Target: 10-20 variants per archetype** -- enough visual variety that
   players rarely see the same ship twice in a system
9. **Naming convention:** `{archetype}_seed{NNNN}.glb`

### Stations (Phase 4)

10. **Start with modular assembly approach** -- define 5-8 module types
11. **Build modules as separate GeoNodes groups** in Blender
12. **Assembly script** places and connects modules based on seed
13. **2-3 station variants per type** is probably sufficient initially

### Animation Strategy

14. **Runtime procedural animation** for ships (banking, engine glow, thrusters)
    -- no baked animations needed. This avoids export complexity.
15. **Baked glTF animation** only for stations with rotating rings or moving parts
    -- these are complex enough to warrant it
16. **Engine glow** via emissive material on exhaust faces -- set up in Blender,
    control intensity at runtime in Three.js

### What NOT to Do

- Don't use subdivision surfaces -- they fight the retro aesthetic
- Don't use boolean operations for combining ship parts -- join + merge is
  simpler and more reliable at low poly counts
- Don't over-invest in L-systems or grammar approaches for ships -- the
  GeoNodes approach is already working and more interactive
- Don't bake animations for ships -- runtime procedural is simpler and
  more flexible
- Don't generate hundreds of variants per archetype -- 10-20 is plenty,
  and the seed system means you can always generate more later

---

## 9. Sources

### Procedural Ship Generation
- [SpaceshipGenerator (a1studmuffin)](https://github.com/a1studmuffin/SpaceshipGenerator) -- open-source Blender ship generator, extrusion-based algorithm
- [Blender SpaceshipGenerator fork (ldo)](https://github.com/ldo/blender_spaceship_generator) -- maintained fork for modern Blender
- [Procedural Spaceship Generator (Superhive/Blender Market)](https://superhivemarket.com/products/procedural-starship-spaceship-generator) -- commercial GeoNodes generator
- [Spaceship Generator GeoNodes (Gumroad)](https://huykhoi2407.gumroad.com/l/spaceshipgenerator) -- GeoNodes-based generator
- [Blender Studio: Spaceship Generator Tutorial](https://studio.blender.org/training/geometry-nodes-from-scratch/spaceship-generator/) -- free official tutorial
- [Procedural Surface Detail for Sci-Fi (Waterloo)](https://cs.uwaterloo.ca/~csk/publications/Papers/kinnear_kaplan_2010.pdf) -- academic paper on greeble generation

### Blender Python API
- [BMesh Module Documentation](https://docs.blender.org/api/current/bmesh.html)
- [BMesh Operators (bmesh.ops)](https://docs.blender.org/api/current/bmesh.ops.html)
- [Shaping Models with BMesh (Medium)](https://behreajj.medium.com/shaping-models-with-bmesh-in-blender-2-9-2f4fcc889bf0)
- [Mesh(ID) Blender API](https://docs.blender.org/api/current/bpy.types.Mesh.html)
- [Export Scene Operators (glTF/GLB)](https://docs.blender.org/api/current/bpy.ops.export_scene.html)
- [BooleanModifier API](https://docs.blender.org/api/current/bpy.types.BooleanModifier.html)
- [Sinestesia: Meshes with Python & Blender](https://sinestesia.co/blog/tutorials/python-2d-grid/)
- [Jet BI: Creating 3D Mesh with Python and Blender](https://jetbi.com/blog/creating-3d-mesh-python-and-blender)
- [Vertex Colors in BMesh (Blender Artists)](https://blenderartists.org/t/easy-way-to-access-vertex-colors-in-python-bmesh/543789)

### PS1 / Retro Aesthetic
- [Retro 3D Art FAQ (Polycount)](https://polycount.com/discussion/226167/retro-3d-art-faq-everything-you-need-to-know-to-create-ps1-n64-dreamcast-etc-3d-art) -- comprehensive guide to PS1/N64/Dreamcast art
- [Building a PS1 Style Retro 3D Renderer](https://www.david-colson.com/2021/11/30/ps1-style-renderer.html) -- technical deep-dive
- [PS1 Style in Blender (Medium)](https://medium.com/@kent_edoloverio/how-to-make-ps1-style-in-blender-9e3d719f80c9)
- [PS1 Jitter Shader with R3F (Codrops)](https://tympanus.net/codrops/2024/09/03/how-to-create-a-ps1-inspired-jitter-shader-with-react-three-fiber/)
- [PSX Modular Space Station Pack (itch.io)](https://fabiloco.itch.io/psx-modular-space-station-pack) -- reference art for retro stations

### Procedural Space Stations
- [Rahix/spacestation (GitHub)](https://github.com/Rahix/spacestation) -- procedural station generator
- [Blender Procedural Modeling Masterclass: Space Station](https://www.cgcircuit.com/tutorial/blender---procedural-modeling-masterclass-space-station)
- [Modular Space Station Design Kit (Gumroad)](https://danielgrovedesigns.gumroad.com/l/stationkit)

### Three.js Animation
- [GLTF Animations Tutorial (sbcode.net)](https://sbcode.net/threejs/gltf-animation/)
- [Three.js Animation System (Discover Three.js)](https://discoverthreejs.com/book/first-steps/animation-system/)
- [Loading and Animating Models (Wael Yasmina)](https://waelyasmina.net/articles/all-you-need-to-know-about-loading-and-animating-models-in-three-js/)
- [Three.js Emissive Glow (forum)](https://discourse.threejs.org/t/emissive-glowing-effect-on-custom-model/54146)

### Grammar / L-Systems
- [L-Systems for Procedural Generation (Medium)](https://gkteco.medium.com/procedural-generation-with-l-systems-very-simple-example-4a21df1423c3)
- [Using Grammars for Procedural Generation](https://bekwnn.github.io/blog/2018/01/04/using-grammars-to-define-procedural-generation.html)
- [L-Systems in Games (Medium)](https://medium.com/@wiltchamberian777/l-system-in-game-cc2b79c2a17f)
