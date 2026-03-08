# Blender Export Snippet — Reference Code
#
# Add this to the end of your Blender ship generator script to auto-export
# each generated ship as a .glb file to the ship_exports folder.
#
# This file is NOT run directly — it's a reference for what to paste into
# your Blender generator scripts.

import bpy
import os

# --- Paste this function into your generator script ---

def export_ship_glb(archetype, seed):
    """
    Exports selected objects as .glb to the ship_exports folder.

    archetype: 'fighters', 'shuttles', 'freighters', 'cruisers', 'capitals', 'explorers'
    seed: the seed used to generate this ship (used in filename)
    """
    export_base = r"C:\Users\Max\Documents\Blender\ship_exports"
    export_dir = os.path.join(export_base, archetype)
    os.makedirs(export_dir, exist_ok=True)

    filepath = os.path.join(export_dir, f"{archetype[:-1]}_seed{seed}.glb")

    bpy.ops.export_scene.gltf(
        filepath=filepath,
        export_format='GLB',
        use_selection=True,
        export_apply=True,       # apply modifiers
        export_yup=True,         # Three.js uses Y-up
        export_colors=True,      # include vertex colors if present
        export_normals=True,
    )

    print(f"Exported: {filepath}")
    return filepath

# --- Usage example at end of generator ---
# export_ship_glb('fighters', seed)
