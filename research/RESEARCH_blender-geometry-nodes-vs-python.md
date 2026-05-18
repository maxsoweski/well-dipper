# Research: Blender Geometry Nodes vs Python API for Procedural 3D Assets

**Date:** 2026-03-14
**Context:** Well Dipper is a retro space game (PS1-era aesthetics, low-poly, Three.js) that needs procedurally generated spaceships, space stations, and other 3D assets exported as .glb files. Claude can execute Python in Blender remotely via MCP addon (port 9876). We are already building a Fighter archetype with geometry nodes.

---

## 1. Geometry Nodes Overview

### What Are They?

Geometry Nodes are a visual, node-based system for creating and manipulating geometry procedurally. Instead of manually modeling a shape, you build a "recipe" -- a graph of connected nodes -- that describes *how* to generate geometry. Change an input, and the entire output updates instantly.

Think of it like a flowchart: data flows from left to right through nodes. Each node does one operation (create a cylinder, move vertices, instance objects, etc.). You wire them together to build complex results from simple steps.

### How They Work

1. **Node Tree:** A modifier on an object contains a node group (the "recipe")
2. **Group Input:** The starting point -- receives the base geometry of the object plus any custom parameters you define (sliders, seeds, colors)
3. **Processing Nodes:** Transform, combine, scatter, instance, extrude, and manipulate geometry
4. **Group Output:** The final geometry that gets displayed/rendered

Key node categories:
- **Mesh Primitives:** Create cylinders, cubes, spheres, grids, cones, etc.
- **Geometry Operations:** Join, transform, set position, set material
- **Instances:** Place copies of objects at points (scatter, instance on points)
- **Math/Utilities:** Random Value, math operations, map range, clamp
- **Fields:** Per-element data (like "the X position of each vertex") that flows through nodes
- **Attributes:** Named data stored on geometry (UVs, colors, custom data)

### Parameterization

You expose parameters as **Group Inputs** on the node tree. These appear as sliders/fields in Blender's modifier panel. Types include:
- **Integer** (seed values, counts)
- **Float** (sizes, ratios, angles)
- **Boolean** (toggle features on/off)
- **Vector** (positions, directions)
- **Object/Collection** (reference external geometry to instance)
- **Material** (assign materials)

Each input can have a default value, min/max range, and tooltip.

### Seed-Based Randomization

The **Random Value** node generates random numbers. It takes:
- **Seed** input: an integer that determines the random sequence
- **ID** input: by default uses the element index, so each vertex/face/instance gets a different value
- **Min/Max:** the range of output values

Wire a Group Input integer to the Seed, and you get deterministic randomization: same seed = same ship every time. Different seed = different ship.

### Version History

| Version | Year | What Changed |
|---------|------|-------------|
| 2.92 | 2021 | Geometry Nodes introduced (basic scattering, instancing) |
| 2.93 | 2021 | 22 new nodes, mesh primitives, attribute system |
| 3.0 | 2021 | **Fields redesign** -- complete overhaul, much more intuitive |
| 3.1-3.6 | 2022-23 | Simulation zones, repeat zones, mesh operations (extrude, etc.) |
| 4.0 | 2023 | Rotation sockets, bake support, menu sockets |
| 4.2 LTS | 2024 | Performance optimizations, more built-in nodes |
| 4.4 | 2024 | Current version Max is using |
| 4.5 LTS | 2025 | Camera Info, Instance Bounds, string handling nodes |
| 5.0 | 2025-26 | Repeat zones in shading nodes, continued expansion |

The system is mature and actively developed. Most procedural modeling tutorials from 2023+ use the post-3.0 "fields" paradigm, which is what we use.

---

## 2. Geometry Nodes for Procedural Spaceships

### Can You Build a Procedural Spaceship Generator? Yes -- Absolutely.

This is one of the most popular geometry nodes use cases. Multiple tutorials, commercial products, and free resources exist:

- **Blender Studio** has an official "Spaceship Generator" course in their Geometry Nodes from Scratch series
- **Commercial generators** on Gumroad/Blender Market let you generate entire fleets from sliders
- **Community tutorials** show modular construction kit approaches (frigates, cruisers, battleships from one node tree)

### How It Works

There are three main architectural approaches:

#### A. Monolithic Parametric (What We're Doing)
One node tree generates an entire ship type. Parameters control proportions, features, and style.
- Hull = cylinder/cube with Set Position for tapering
- Wings = grid mesh with taper + sweep transforms
- Engines = cylinders instanced at rear
- Details = smaller primitives joined to hull
- **Pros:** Self-contained, one modifier per ship type
- **Cons:** Complex node trees, harder to share parts between types

#### B. Modular Kit-Bashing
A collection of parts (hull segments, wings, engines, cockpits) gets instanced and assembled by a node tree.
- Parts are separate objects in a collection
- Node tree picks random parts, positions them along a spine
- Instance on Points + rotation/scaling for variety
- **Pros:** Huge variety from a small parts library, easy to add new parts
- **Cons:** Need to model the parts first, alignment can be tricky

#### C. Profile Extrusion
Define a 2D cross-section profile, extrude it along a curve, vary the profile at control points.
- Curve to Mesh node does the heavy lifting
- Profile changes along the curve create hull shaping
- **Pros:** Very organic/smooth shapes, few nodes needed
- **Cons:** Harder to get hard-edged sci-fi looks, less control over topology

**For Well Dipper, we're using approach A** (monolithic parametric), which is the right call for distinct ship archetypes with specific silhouettes. Approach B could be interesting for the Freighter (5 subtypes from shared cargo modules) or Capital Ship (greeble library).

### Controlling Low-Poly Output

Geometry nodes give you direct control over polygon count:
- **Mesh primitives have vertex/segment counts** -- a Cylinder node takes "Vertices" (8 = octagonal, 6 = hexagonal, etc.) and "Side Segments"
- **Grid node** takes Vertices X and Vertices Y -- use low values (3x8 for wings, like our fighter)
- **No subdivision = no extra polys** -- unlike traditional modeling where you might subdivide and then decimate, you build with exactly the poly count you want
- **Decimate node** exists as a fallback if you need to reduce after complex operations

This is a natural fit for PS1-era aesthetics. You simply use low vertex counts in your primitive nodes.

### Seed-Based Control in Practice

```
Group Input "Seed" (Integer, default=42)
  |
  +--> Random Value (Seed=Seed, ID=0) --> Hull Length (mapped to 1.5-6.0 range)
  +--> Random Value (Seed=Seed, ID=1) --> Wing Span (mapped to 0.3-3.0 range)
  +--> Random Value (Seed=Seed, ID=2) --> Wing Sweep (mapped to -1.5-2.0 range)
  +--> Random Value (Seed=Seed, ID=3) --> Engine Count (mapped to 1-4, rounded)
  ...etc
```

Each Random Value node with the same Seed but different ID produces a different-but-deterministic value. Change the Seed input, get a completely different ship. Same Seed = same ship every time.

---

## 3. Geometry Nodes for Space Stations

### Modular Station Assembly

Space stations are a natural fit for geometry nodes because they're modular by nature:

**Hub + Spokes + Rings architecture:**
1. **Central hub:** Cylinder or octagonal prism (low vertex count)
2. **Spokes:** Thin cylinders instanced radially from hub using Instance on Points + rotation
3. **Ring/Torus:** Curve Circle + Curve to Mesh (profile circle extruded along ring path), or a Mesh primitive torus with low segment counts
4. **Docking bays:** Box primitives instanced at spoke ends
5. **Solar panels:** Flat planes instanced and rotated

### How to Build It

```
Hub (Cylinder, 8 verts)
  |
  +--> Mesh to Points (end faces) --> Instance Spokes radially
  |
  +--> Instance Ring at midpoint (Torus, low-res)
  |
  +--> Instance Docking Pods at spoke tips
  |
  +--> Join All --> Group Output
```

**Randomization via seed:**
- Number of spokes (3-8)
- Ring radius and thickness
- Whether ring exists at all (boolean from Random Value > 0.5)
- Spoke length variation
- Docking pod style (from collection of pod shapes)
- Solar panel orientation

### Ring/Torus Habitat Generation

For a rotating habitat ring:
- **Mesh Primitive Torus node** -- takes Major Radius, Minor Radius, Major Segments, Minor Segments
- Low segment counts (16 major, 6 minor) give a nice chunky PS1 look
- Or **Curve Circle + Curve to Mesh** for more control over the cross-section profile
- Scale the profile non-uniformly for rectangular cross-section corridors

### Procedural Attachment/Snapping

Geometry nodes don't have a built-in "snap to surface" for modular assembly, but you can:
- Use **math nodes** to calculate attachment points (spoke_end = hub_radius + spoke_length along each radial direction)
- Use **Rotate Euler** to distribute spokes evenly (angle = 2*pi / spoke_count * index)
- Use **Instance on Points** where points are generated at calculated positions

---

## 4. Python API (bpy/bmesh) for the Same Tasks

### How to Build a Procedural Ship with Pure Python

The classic example is [a1studmuffin's SpaceshipGenerator](https://github.com/a1studmuffin/SpaceshipGenerator) -- a Blender addon that generates ships from a seed using bmesh operations:

1. **Create a base mesh** (cube or cylinder)
2. **Extrude faces** forward/backward with random scale/rotation for hull shape
3. **Select faces by normal direction** (up-facing, side-facing, rear-facing)
4. **Inset + extrude** faces for detail (engine nozzles, panel lines, antenna mounts)
5. **Instance detail objects** at selected face positions
6. **Apply materials** to different face selections
7. **Mirror** for symmetry

### Key bmesh Operations

```python
import bpy, bmesh
from random import Random

rng = Random(seed)
bm = bmesh.new()

# Create hull
bmesh.ops.create_cube(bm, size=1.0)

# Extrude a face
face = bm.faces[4]  # select a face
result = bmesh.ops.extrude_face_region(bm, geom=[face])
bmesh.ops.translate(bm, vec=(0, 0, rng.uniform(0.5, 2.0)),
                    verts=[v for v in result['geom'] if isinstance(v, bmesh.types.BMVert)])

# Inset a face for detail
bmesh.ops.inset_individual(bm, faces=[face], thickness=0.1)

# Boolean operations
bmesh.ops.boolean(bm, geom=..., geom2=..., operation='DIFFERENCE')

# Finalize
mesh = bpy.data.meshes.new("Ship")
bm.to_mesh(mesh)
obj = bpy.data.objects.new("Ship", mesh)
bpy.context.collection.objects.link(obj)
```

### Advantages of Python/bmesh

- **Full programmatic control:** Loops, conditionals, functions, classes -- all of Python available
- **Can run headlessly:** No GUI needed, works in background mode (`blender --background --python script.py`)
- **Directly scriptable from MCP:** Claude sends Python, Blender executes it, no manual steps
- **Version controllable:** Scripts are plain text files, easy to diff and track
- **Complex logic is natural:** "If this face is rear-facing AND wider than 0.3 units, add an engine" is easy in Python, awkward in nodes
- **Batch generation:** Loop over seeds, generate + export in one script

### Disadvantages of Python/bmesh

- **Verbose:** What takes 3 connected nodes takes 10+ lines of Python
- **Blind iteration:** You write code, run it, see the result, tweak, repeat. No live preview while editing
- **Topology management:** Manual face/edge/vertex tracking is error-prone
- **No visual feedback during development:** Hard to debug spatial relationships without rendering
- **UV mapping is manual:** Must calculate and assign UV coordinates explicitly
- **Fragile face indexing:** Face indices change after operations (extrude, inset), so you can't rely on hardcoded indices

### Our Experience with Python/bmesh

From the progress file: *"Python bmesh approach worked but was slow to iterate (blind code-to-render loop)"*. We built 5 freighter subtypes (78 objects) with bmesh before switching to geometry nodes for the fighter. The bmesh ships work but the development process was painful -- each change required a full code-run-screenshot cycle through MCP.

---

## 5. Head-to-Head Comparison

| Criteria | Geometry Nodes | Python API (bpy/bmesh) |
|----------|---------------|----------------------|
| **Ease of creating variations** | Excellent -- change a slider or seed | Good -- change a parameter and re-run script |
| **Visual iteration speed** | Instant -- live viewport updates | Slow -- code, execute, render, repeat |
| **Parameterization (seed, type, size)** | Built-in (Group Inputs, Random Value) | Built-in (function args, Python random) |
| **Low-poly output control** | Direct -- set vertex counts on primitives | Direct -- control geometry operations |
| **Export to .glb programmatically** | Needs Python wrapper (apply modifier + export) | Native -- script includes export call |
| **Can be triggered from Claude MCP** | Partially -- Python sets parameters + exports, but can't build the node tree easily | Fully -- entire generation is Python |
| **Reusability across ship types** | Moderate -- sub-groups can be shared, but each type needs its own tree | High -- Python functions/classes are naturally reusable |
| **Learning curve for Max** | Moderate -- visual and interactive, but nodes are a new paradigm | Steep -- requires reading/understanding Python code |
| **Learning curve for Claude** | Hard -- building node trees via Python is very verbose and unintuitive | Easy -- Python is Claude's native language |
| **Community examples/resources** | Many tutorials, commercial generators, Blender Studio course | Classic SpaceshipGenerator addon, general scripting docs |
| **Debugging** | Visual -- see data flow, but complex trees get tangled | Text-based -- print statements, but can inspect mesh data |
| **Interactive tweaking by Max** | Excellent -- sliders in modifier panel, instant feedback | None -- must edit code or ask Claude to change values |
| **Complex conditional logic** | Awkward -- Switch nodes, math-based conditionals | Natural -- if/else, loops, functions |
| **Maintainability at scale** | Challenging -- large node trees become "spaghetti" | Good -- well-structured code is readable and modular |

### Summary

**Geometry Nodes win on:** interactive development, visual feedback, Max's ability to experiment, viewport iteration speed

**Python wins on:** Claude's ability to create and modify, batch processing, complex logic, export pipelines, code reuse

---

## 6. The Hybrid Approach (Best of Both Worlds)

The hybrid approach uses geometry nodes for the shape generation (interactive, visual, tweakable) and Python for driving parameters and handling export. This is what we should do.

### Setting Geometry Node Inputs from Python

```python
# Get the object and its geometry nodes modifier
obj = bpy.data.objects["GN_Fighter"]
modifier = obj.modifiers["GeometryNodes"]  # or whatever the modifier name is

# Set input values by their socket identifier
# Find identifiers: right-click an input in Blender > "Copy Full Data Path"
modifier["Socket_2"] = 42          # Seed (integer)
modifier["Socket_3"] = 3.5         # Hull Length (float)
modifier["Socket_4"] = 0.4         # Hull Radius (float)

# Force viewport update after changing values
obj.data.update()

# Or use the identifier names (Blender 4.x):
# modifier["Input_2"] format depends on Blender version
```

**Important note:** The socket identifiers (Socket_2, Input_3, etc.) are internal IDs, not the display names. You find them by right-clicking the input in Blender and selecting "Copy Full Data Path", or by iterating the modifier's keys in Python.

### Realizing Geometry for Export

Geometry nodes output is "virtual" -- it exists only as a modifier result. To export it:

```python
import bpy

obj = bpy.data.objects["GN_Fighter"]

# Method 1: Apply the modifier (destructive -- converts to real mesh)
bpy.context.view_layer.objects.active = obj
bpy.ops.object.modifier_apply(modifier="GeometryNodes")

# Method 2: Use depsgraph to get evaluated mesh (non-destructive)
depsgraph = bpy.context.evaluated_depsgraph_get()
eval_obj = obj.evaluated_get(depsgraph)
mesh = bpy.data.meshes.new_from_object(eval_obj)
# Create a temporary object with this mesh for export
```

For batch generation, Method 1 is simpler: set seed, apply modifier, export, undo, repeat. Or duplicate the object first.

### Realize Instances Node

If your geometry nodes use Instance on Points (which they will for engines, details, etc.), you **must** add a **Realize Instances** node before Group Output for the instances to be included in exports. Without it, instances are virtual and won't export.

Alternatively, put Realize Instances only in the export script path and not in the node tree itself (to keep viewport performance), by applying the modifier which auto-realizes.

### Full Batch Export Pipeline

```python
import bpy

def export_ship(obj_name, modifier_name, seed, output_path):
    obj = bpy.data.objects[obj_name]
    modifier = obj.modifiers[modifier_name]

    # 1. Set the seed
    modifier["Socket_2"] = seed  # adjust socket ID

    # 2. Force update
    bpy.context.view_layer.update()

    # 3. Select only this object
    bpy.ops.object.select_all(action='DESELECT')
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj

    # 4. Duplicate (so we don't destroy the original)
    bpy.ops.object.duplicate()
    dup = bpy.context.active_object

    # 5. Apply modifier on duplicate
    bpy.ops.object.modifier_apply(modifier=modifier_name)

    # 6. Export as GLB
    bpy.ops.export_scene.gltf(
        filepath=output_path,
        export_format='GLB',
        use_selection=True,
        export_apply=False,  # already applied
        export_animations=False,
        export_cameras=False,
        export_lights=False,
    )

    # 7. Delete duplicate
    bpy.ops.object.delete()

# Generate a fleet
for seed in range(100):
    export_ship("GN_Fighter", "GeometryNodes", seed,
                f"//exports/fighter_{seed:03d}.glb")
```

### Shader Baking (Required for .glb)

Procedural shader nodes (like our Foss-style band/chevron shader) do NOT export to .glb -- only image textures do. The bake step:

```python
# 1. Create a target image (128x128 for PS1 aesthetic)
img = bpy.data.images.new("BakeTarget", 128, 128)

# 2. Add an Image Texture node to the material (set as active but not connected)
mat = obj.data.materials[0]
tex_node = mat.node_tree.nodes.new('ShaderNodeTexImage')
tex_node.image = img
mat.node_tree.nodes.active = tex_node  # must be active for bake target

# 3. Bake (requires Cycles renderer)
bpy.context.scene.render.engine = 'CYCLES'
bpy.ops.object.bake(type='DIFFUSE', pass_filter={'COLOR'})

# 4. Reconnect: plug baked image into Principled BSDF Base Color
# 5. Export -- now the .glb has the baked texture embedded
```

This bake step is already noted as "not yet implemented" in our progress file.

---

## 7. Recommendation for Well Dipper

### Use the Hybrid Approach (Continue What We're Already Doing)

Based on the comparison, our current approach is correct and should be formalized:

**Geometry Nodes** for shape generation (per archetype):
- Max can tweak sliders interactively in Blender's viewport
- Claude builds the node trees via MCP Python (verbose but doable)
- Each archetype gets its own node group (FighterGen, ShuttleGen, FreighterGen, etc.)
- Seed input drives Random Value nodes for deterministic variation

**Python scripts** for the pipeline:
- Set geometry node parameters (seed, archetype-specific overrides)
- Bake procedural shaders to 128x128 textures
- Apply modifiers (realize geometry)
- Export to .glb
- Batch loop: generate N variants per archetype

### Why Not Pure Python/bmesh?

We tried it. It worked for the freighters but the iteration cycle was painful. Every change required: edit Python code, send via MCP, execute in Blender, take screenshot, review, repeat. Geometry nodes let Max see changes instantly and experiment with slider values -- that's a better creative workflow for a beginner.

### Why Not Pure Geometry Nodes?

Because the export pipeline (bake + batch export) requires Python regardless. And Claude building complex node trees via Python is extremely verbose -- each node needs to be created, positioned, and wired individually. The hybrid approach means Claude builds the node tree once (or Max builds it with Claude's guidance), then Python handles the repetitive export/batch work.

### Specific Recommendations by Asset Type

| Asset | Approach | Rationale |
|-------|----------|-----------|
| **Fighter** | GeoNodes (already built) + Python export | Continue current work, add seed randomization |
| **Shuttle** | GeoNodes (new tree) | Simple geometry, good for interactive tweaking |
| **Freighter** | GeoNodes + modular kit-bash from collection | 5 subtypes = instance different cargo modules from a parts collection |
| **Cruiser** | GeoNodes | Parametric wedge hull similar to fighter approach |
| **Capital Ship** | GeoNodes + greeble collection | Large flat surfaces need detail -- instance greeble objects from collection |
| **Explorer** | GeoNodes | Unusual shapes = fun to experiment with interactively |
| **Space Station** | GeoNodes + Python batch | Modular hub/spoke/ring is natural for nodes, Python for batch variants |

### Immediate Next Steps

1. **Finish Fighter GeoNodes** (cockpit, engines, seed wiring) -- already in progress
2. **Build the Python export pipeline** (bake shader, apply modifier, export .glb)
3. **Test the full loop:** seed in, .glb out, load in Three.js, verify it looks right
4. **Then move to next archetype** with the pipeline proven

### Tools Worth Knowing About

- **[NodeToPython](https://github.com/BrendanParmer/NodeToPython):** Blender addon that converts existing node trees to Python scripts. Useful if Max builds something in the GUI and we want to reproduce it programmatically.
- **[Geometry Script](https://github.com/carson-katri/geometry-script):** Write geometry node trees as Python functions. Could simplify Claude building node trees, but adds a dependency.
- **[geonodes](https://github.com/al1brn/geonodes):** Similar to Geometry Script -- Python DSL for geometry nodes. May be worth evaluating later for complex archetypes.

---

## Sources

- [Blender Studio: Spaceship Generator (Geometry Nodes from Scratch)](https://studio.blender.org/training/geometry-nodes-from-scratch/spaceship-generator/)
- [80.lv: Making 3D Spaceship Concepts with Blender's Geometry Nodes](https://80.lv/articles/making-3d-spaceship-concepts-with-blender-s-geometry-nodes)
- [a1studmuffin/SpaceshipGenerator (Python/bmesh)](https://github.com/a1studmuffin/SpaceshipGenerator)
- [Blender Procedural Cities: Python vs Geometry Nodes](https://lonedevr.com/2022/03/20/blender-procedural-cities-python-vs-geometry-nodes/)
- [How to Script Geometry Nodes in Blender with Python (2026)](https://blog.cg-wire.com/blender-scripting-geometry-nodes-2/)
- [Beginner's Guide to Geometry Nodes in Blender (2026)](https://blog.cg-wire.com/blender-scripting-geometry-nodes/)
- [Blender Python API: NodesModifier](https://docs.blender.org/api/current/bpy.types.NodesModifier.html)
- [Blender Python API: Export Scene Operators](https://docs.blender.org/api/current/bpy.ops.export_scene.html)
- [Blender Manual: Random Value Node](https://docs.blender.org/manual/en/latest/modeling/geometry_nodes/utilities/random_value.html)
- [Blender Manual: Instances](https://docs.blender.org/manual/en/latest/modeling/geometry_nodes/instances.html)
- [Exporting Geometry Nodes from Blender (Ryosuke)](https://whoisryosuke.com/blog/2023/exporting-geometry-nodes-from-blender/)
- [Blender Artists: Setting Geometry Node Parameters from Python](https://blenderartists.org/t/how-do-i-set-the-value-of-a-geometry-nodes-parameter-from-python/1467816)
- [Geometry Nodes Workshop: September 2025](https://code.blender.org/2025/10/geometry-nodes-workshop-september-2025/)
- [Superhive: Procedural Space Station Generator Tutorial](https://superhivemarket.com/products/blender-tutorial---create-procedural-space-station-generator-with-blender-geometry-nodes)
- [NodeToPython (convert node trees to Python)](https://github.com/BrendanParmer/NodeToPython)
- [Geometry Script (Python DSL for GeoNodes)](https://github.com/carson-katri/geometry-script)
- [geonodes (Python library for GeoNodes)](https://github.com/al1brn/geonodes)
- [Blender Geometry Nodes to Unreal Engine 5 Guide](https://medium.com/@Jamesroha/blender-geometry-nodes-to-unreal-engine-5-the-proced-environment-art-guide-05cf8d8b4701)
- [Blender Release Notes: Geometry Nodes 2.92](https://developer.blender.org/docs/release_notes/2.92/geometry_nodes/)
- [Blender 5.0 Release](https://www.blender.org/download/releases/5-0/)
