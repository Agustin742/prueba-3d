"""Split the approved reception GLB into reusable module GLBs.

The monolith public/models/rooms/reception.glb was retired after this split. Recover it from git
history (commit 49070f7) or re-export it from assets/blender/reception.blend via
author_reception.py / recolor_reception.py, then point SOURCE at it to rerun the split.

Blender MCP safe mode cannot read files or runpy, so paste this file into Blender and call
split(project_root). It works only in a new scene named SCENE; the user's scenes are untouched.

Module convention: pivot at the bottom-centre of the module bounds, front facing Blender -Y
(Three +Z), wall runs along local X. Prints the reception placements as JSON in Three space:
position = Blender (x, z, -y); yaw about the up axis keeps its sign.
"""
import json
import math

import bpy
from mathutils import Matrix, Vector

PREFIX = "ITReception_"
SCENE = "RoomModules"
SOURCE = "public/models/rooms/reception.glb"  # retired; see the module docstring for how to recover it
TARGET = "public/models/rooms/modules"
QUARTER = math.pi / 2


def numbered(name, count):
    return [name] + [f"{name}.{i:03d}" for i in range(1, count)]


# id -> (part names, yaw that turns the authored piece to face -Y / run along X)
MODULES = {
    "floor-tile-cream": (["Tile 0-0"], 0.0),
    "floor-tile-pale": (["Tile 0-1"], 0.0),
    "floor-plinth": (["Floating plinth"], 0.0),
    "wall-back-left": (["Back left", "Back left lower band", "Back left rail"], 0.0),
    "wall-back-right": (["Back right", "Back right lower band", "Back right rail"], 0.0),
    "wall-left": (["Left wall", "Left lower band", "Left rail"], -QUARTER),
    "door": (["Door header", *numbered("Door jamb", 2), "Door lintel wall", "Threshold",
              "Portal crest"], 0.0),
    "window": (["Rounded window frame", "Blue inset glass", "Window mullion",
                *numbered("Window broad glint", 2)], -QUARTER),
    "counter-l": (["L counter warm carcass", "Coral counter crown",
                   *numbered("Counter fluted inlay", 6), "Counter recessed toe",
                   "Counter letter tray", "Tray stationery"], 0.0),
    "desk-bell": (["Bell foot", "Bell dome", "Bell button"], 0.0),
    "bench": ([*numbered("Peach seat cushion", 2), *numbered("Seat arm", 2),
               *numbered("Seat foot", 4), "Seat timber cradle", "Upholstered back"], -QUARTER),
    "display-shelf": ([*numbered("Layered display shelf", 2), *numbered("Shelf book", 4),
                       "Shelf bowl", "Shelf ceramic vase"], -QUARTER),
    "planter": (["Tapered planter", "Planter rim", "Recessed soil",
                 *numbered("Plant petiole", 9), *[f"Lance leaf {i}" for i in range(9)]], 0.0),
    "pendant-lamp": (["Pendant cord", "Pendant diffuser", "Pendant shade"], 0.0),
    "noticeboard": (["Noticeboard frame", "Noticeboard inset", *numbered("Notice pin", 3),
                     *numbered("Pinned notice", 3)], 0.0),
}
# Extra reception instances of a module: (module id, part used to locate it).
REPEATS = [("pendant-lamp", "Pendant cord.001")]


def bounds(objects):
    points = [o.matrix_world @ v.co for o in objects for v in o.data.vertices]
    low = Vector([min(p[i] for p in points) for i in range(3)])
    high = Vector([max(p[i] for p in points) for i in range(3)])
    return low, high


def pivot_of(objects):
    low, high = bounds(objects)
    return Vector(((low.x + high.x) / 2, (low.y + high.y) / 2, low.z))


def placement(module_id, pivot, yaw):
    # The instance undoes the normalising yaw.
    return {"module": module_id,
            "position": [round(pivot.x, 4), round(pivot.z, 4), round(-pivot.y, 4)],
            "yaw": round(-yaw, 6)}


def tile_module(obj):
    return "floor-tile-cream" if obj.data.materials[0].name.endswith("cream") else "floor-tile-pale"


def split(root):
    if bpy.data.scenes.get(SCENE):
        raise RuntimeError(f"Scene {SCENE} already exists; remove it before re-running")
    if any(o.name.startswith(PREFIX) for o in bpy.data.objects):
        raise RuntimeError("Reception objects already loaded; import would rename parts")
    scene = bpy.data.scenes.new(SCENE)
    bpy.context.window.scene = scene
    bpy.ops.import_scene.gltf(filepath=f"{root}/{SOURCE}")
    parts = {o.name.removeprefix(PREFIX): o for o in scene.objects if o.type == "MESH"}
    if len(parts) != 144:
        raise RuntimeError(f"Expected 144 reception meshes, got {len(parts)}")

    placements = []
    for name in sorted(n for n in parts if n.startswith("Tile ")):
        placements.append(placement(tile_module(parts[name]), pivot_of([parts[name]]), 0.0))
    for module_id, part in REPEATS:
        names = MODULES[module_id][0]
        suffix = part.removeprefix(names[0])
        placements.append(placement(module_id, pivot_of([parts[n + suffix] for n in names]), 0.0))

    exported = {}
    for module_id, (names, yaw) in MODULES.items():
        objects = [parts[n] for n in names]
        pivot = pivot_of(objects)
        if not module_id.startswith("floor-tile"):
            placements.append(placement(module_id, pivot, yaw))
        local = Matrix.Rotation(yaw, 4, "Z") @ Matrix.Translation(-pivot)
        holder = bpy.data.objects.new(module_id, None)
        scene.collection.objects.link(holder)
        for obj in objects:
            if obj.matrix_world != Matrix.Identity(4):
                raise RuntimeError(f"{obj.name} is not baked at the origin")
            obj.data.transform(local)
            obj.name = obj.name.removeprefix(PREFIX)
            obj.parent = holder
        bpy.ops.object.select_all(action="DESELECT")
        holder.select_set(True)
        for obj in objects:
            obj.select_set(True)
        path = f"{root}/{TARGET}/{module_id}.glb"
        result = bpy.ops.export_scene.gltf(filepath=path, export_format="GLB", use_selection=True,
                                          use_active_scene=True, export_apply=True,
                                          export_animations=False, export_cameras=False,
                                          export_lights=False, export_yup=True,
                                          export_materials="EXPORT", export_extras=False)
        if result != {"FINISHED"}:
            raise RuntimeError(f"{module_id} export did not finish")
        low, high = bounds(objects)
        exported[module_id] = {"parts": len(objects), "size": [round(v, 3) for v in high - low]}

    print(json.dumps({"modules": exported, "placements": placements}))
