"""Original reception study. Load with runpy, then call build(project_root) in Blender.

No module-level scene changes. Never opens/saves the user's current .blend.
Existing outputs and names are deliberately a hard stop, including partial runs.
"""
from pathlib import Path
import hashlib
import json
import math
import struct

import bpy
from mathutils import Vector

PREFIX = "ITReception_"
AVATAR_GIT_HASH = "fa08fdeacfef59a2c53a2c32cd7f58dfed56cbe3"
OUTPUTS = {
    "blend": "assets/blender/reception.blend",
    "glb": "public/models/rooms/reception.glb",
    "desktop": "odd/artifacts/reception/desktop.png",
    "mobile": "odd/artifacts/reception/mobile.png",
    "grayscale": "odd/artifacts/reception/grayscale.png",
}
PALETTE = {
    "cream": "FFF0D8", "pale": "FFF9EB", "sand": "E9C99B",
    "clay": "C88D65", "wood": "AF7B52", "coral": "E66861",
    "peach": "F5B5AB", "butter": "F7D86B", "teal": "62CFC7",
    "sky": "A9E7F4", "lime": "A6D96A", "leaf": "65B96A",
    "deep": "3E8654", "lavender": "B5A7D6",
}


def reception_material(name, material):
    """Approved reception revision: remap assignments, never palette identities."""
    if name.startswith("Tile ") and material == "sand":
        return "pale"
    return {"coral": "teal", "peach": "cream", "clay": "wood"}.get(material, material)


def linear(hex_value):
    rgb = [int(hex_value[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple(v / 12.92 if v <= 0.04045 else ((v + .055) / 1.055) ** 2.4
                 for v in rgb)


def git_blob_hash(path):
    data = path.read_bytes()
    return hashlib.sha1(f"blob {len(data)}\0".encode() + data).hexdigest()


def glb_json(path):
    data = path.read_bytes()
    magic, version, length = struct.unpack_from("<4sII", data)
    size, kind = struct.unpack_from("<I4s", data, 12)
    if magic != b"glTF" or version != 2 or length != len(data) or kind != b"JSON":
        raise ValueError("Expected a complete GLB 2.0 container")
    result = json.loads(data[20:20 + size])
    for item in result.get("buffers", []) + result.get("images", []):
        if "uri" in item:
            raise ValueError("External or URI-based resources are not permitted")
    return result


class Author:
    """Small scene-local helpers, not a shared asset pipeline."""

    def __init__(self, scene):
        self.scene = scene
        self.groups = {}
        for name in ("Architecture", "Counter", "Waiting", "Noticeboard",
                     "WindowShelf", "Plant", "Reference", "Studio"):
            group = bpy.data.collections.new(PREFIX + name)
            scene.collection.children.link(group)
            self.groups[name] = group
        self.materials = {}
        for name, color in PALETTE.items():
            material = bpy.data.materials.new(PREFIX + name)
            material.use_nodes = True
            shader = material.node_tree.nodes.get("Principled BSDF")
            shader.inputs["Base Color"].default_value = (*linear(color), 1)
            shader.inputs["Roughness"].default_value = .82
            shader.inputs["Metallic"].default_value = 0
            material.diffuse_color = (*linear(color), 1)
            self.materials[name] = material

    def mesh(self, name, vertices, faces, material, group, bevel=0):
        mesh = bpy.data.meshes.new(PREFIX + name)
        mesh.from_pydata(vertices, [], faces)
        mesh.update()
        obj = bpy.data.objects.new(PREFIX + name, mesh)
        self.groups[group].objects.link(obj)
        mesh.materials.append(self.materials[reception_material(name, material)])
        if bevel:
            modifier = obj.modifiers.new("Soft manufactured edge", "BEVEL")
            modifier.width = bevel
            modifier.segments = 3
            modifier.harden_normals = True
            obj.modifiers.new("Broad face normals", "WEIGHTED_NORMAL")
        return obj

    def prism(self, name, outline, bottom, top, material, group, bevel=.06):
        count = len(outline)
        vertices = [(x, y, z) for z in (bottom, top) for x, y in outline]
        faces = [tuple(reversed(range(count))), tuple(range(count, 2 * count))]
        faces += [(i, (i + 1) % count, (i + 1) % count + count, i + count)
                  for i in range(count)]
        return self.mesh(name, vertices, faces, material, group, bevel)

    def box(self, name, center, size, material, group, bevel=.06):
        x, y, z = center
        a, b, c = [value / 2 for value in size]
        return self.prism(name, [(x-a, y-b), (x+a, y-b), (x+a, y+b), (x-a, y+b)],
                          z-c, z+c, material, group, bevel)

    def rod(self, name, start, end, radius, material, group, upper=None):
        start, end = Vector(start), Vector(end)
        axis = (end - start).normalized()
        tangent = axis.cross(Vector((0, 1, 0))).normalized()
        if tangent.length < .1:
            tangent = axis.cross(Vector((1, 0, 0))).normalized()
        bitangent = axis.cross(tangent)
        vertices = []
        for origin, r in ((start, radius), (end, radius if upper is None else upper)):
            for i in range(24):
                angle = i * math.tau / 24
                vertices.append(origin + r * (math.cos(angle)*tangent + math.sin(angle)*bitangent))
        faces = [tuple(reversed(range(24))), tuple(range(24, 48))]
        faces += [(i, (i+1) % 24, (i+1) % 24+24, i+24) for i in range(24)]
        obj = self.mesh(name, vertices, faces, material, group, .015)
        for polygon in obj.data.polygons[2:]:
            polygon.use_smooth = True
        return obj

    def leaf(self, name, start, tip, width, material):
        start, tip = Vector(start), Vector(tip)
        direction = tip - start
        side = direction.cross(Vector((0, 0, 1))).normalized()
        vertices = []
        # Closed, curved lance leaves; broad silhouettes, no sphere crowns.
        for i in range(9):
            t = .001 + .998 * i / 8
            center = start + direction*t + Vector((0, 0, .16*math.sin(math.pi*t)))
            radius = math.sin(math.pi*t) ** .8 * width
            for j in range(8):
                angle = j * math.tau / 8
                vertices.append(center + side*(math.cos(angle)*radius)
                                + Vector((0, 0, math.sin(angle)*radius*.15)))
        faces = [tuple(reversed(range(8))), tuple(range(64, 72))]
        faces += [(i*8+j, i*8+(j+1) % 8, (i+1)*8+(j+1) % 8, (i+1)*8+j)
                  for i in range(8) for j in range(8)]
        obj = self.mesh(name, vertices, faces, material, "Plant")
        for face in obj.data.polygons:
            face.use_smooth = True


def compose(a):
    box, rod = a.box, a.rod
    box("Floating plinth", (0, 0, -.24), (11.1, 9.9, .42), "wood", "Architecture", .14)
    for x in range(8):
        for y in range(7):
            box(f"Tile {x}-{y}", (-4.725+x*1.35, -4.05+y*1.35, -.025),
                (1.332, 1.332, .05), "cream" if (x+2*y) % 5 == 0 else "sand",
                "Architecture", .012)
    # Back wall is genuinely open at the doorway (x=1.4..3.4), not a painted door.
    for name, x, width in (("Back left", -2, 6.8), ("Back right", 4.4, 2)):
        box(name, (x, 4.73, 1.8), (width, .22, 3.6), "cream", "Architecture")
        box(name+" lower band", (x, 4.59, .53), (width, .10, 1.06), "clay", "Architecture", .03)
        box(name+" rail", (x, 4.51, 1.08), (width, .13, .10), "wood", "Architecture", .025)
    box("Door lintel wall", (2.4, 4.73, 3.3), (2, .22, .6), "cream", "Architecture")
    box("Left wall", (-5.4, 0, 1.8), (.22, 9.6, 3.6), "cream", "Architecture")
    box("Left lower band", (-5.26, 0, .53), (.10, 9.6, 1.06), "clay", "Architecture", .03)
    box("Left rail", (-5.19, 0, 1.08), (.13, 9.6, .10), "wood", "Architecture", .025)
    for x in (1.29, 3.51):
        box("Door jamb", (x, 4.50, 1.5), (.22, .36, 3), "wood", "Architecture")
    box("Door header", (2.4, 4.5, 3.03), (2.44, .36, .22), "wood", "Architecture")
    # A recessed open portal gives a clear threshold without a blocking leaf.
    box("Threshold", (2.4, 4.55, .025), (2, .55, .05), "teal", "Architecture", .012)
    box("Portal crest", (2.4, 4.28, 3.29), (.60, .09, .20), "coral", "Architecture", .03)
    # Six prop families: counter, seat, board, window/shelf, plant, pendants.
    outline = [(-3.8, 1.1), (-.3, 1.1), (-.3, 3.5), (-1.5, 3.5),
               (-1.5, 2.25), (-3.8, 2.25)]
    a.prism("L counter warm carcass", outline, .10, 1.30, "wood", "Counter", .13)
    a.prism("Coral counter crown", outline, 1.30, 1.49, "coral", "Counter", .09)
    box("Counter recessed toe", (-2.05, 1.69, .12), (3.18, .83, .22), "clay", "Counter")
    for x in (-3.45, -2.9, -2.35, -1.8, -1.25, -.7):
        box("Counter fluted inlay", (x, 1.087, .76), (.16, .055, .76), "sand", "Counter", .025)
    rod("Bell foot", (-2.7, 1.65, 1.49), (-2.7, 1.65, 1.56), .19, "wood", "Counter")
    rod("Bell dome", (-2.7, 1.65, 1.56), (-2.7, 1.65, 1.69), .15, "butter", "Counter", .08)
    rod("Bell button", (-2.7, 1.65, 1.69), (-2.7, 1.65, 1.75), .045, "wood", "Counter")
    box("Counter letter tray", (-1.65, 1.67, 1.54), (.68, .43, .09), "wood", "Counter", .025)
    box("Tray stationery", (-1.65, 1.67, 1.60), (.53, .32, .04), "pale", "Counter", .012)
    for y in (-2.8, -.65):
        for x in (-4.9, -3.9):
            rod("Seat foot", (x, y, .04), (x, y, .44), .09, "wood", "Waiting")
    box("Seat timber cradle", (-4.4, -1.73, .46), (1.55, 2.65, .21), "wood", "Waiting", .09)
    box("Upholstered back", (-4.98, -1.73, .98), (.28, 2.65, 1.08), "coral", "Waiting", .12)
    for y in (-2.36, -1.10):
        box("Peach seat cushion", (-4.28, y, .70), (1.19, 1.16, .30), "peach", "Waiting", .12)
    for y in (-3.0, -.46):
        box("Seat arm", (-4.35, y, .98), (1.48, .20, .58), "coral", "Waiting", .08)
    box("Noticeboard frame", (-2.7, 4.43, 2.43), (2.85, .20, 1.55), "wood", "Noticeboard", .10)
    box("Noticeboard inset", (-2.7, 4.30, 2.43), (2.58, .10, 1.28), "sand", "Noticeboard", .04)
    for x, z, color in ((-3.42, 2.62, "pale"), (-2.65, 2.33, "cream"), (-1.96, 2.62, "peach")):
        box("Pinned notice", (x, 4.22, z), (.53, .06, .61), color, "Noticeboard", .035)
        rod("Notice pin", (x, 4.16, z+.20), (x, 4.11, z+.20), .045, "coral", "Noticeboard")
    box("Rounded window frame", (-5.19, 1.17, 2.44), (.30, 2.65, 1.65), "wood", "WindowShelf", .14)
    box("Blue inset glass", (-5.00, 1.17, 2.44), (.12, 2.35, 1.35), "teal", "WindowShelf", .055)
    for y in (.61, 1.73):
        box("Window broad glint", (-4.925, y, 2.65), (.035, .42, .09), "sky", "WindowShelf", .015)
    box("Window mullion", (-4.90, 1.17, 2.44), (.12, .12, 1.39), "pale", "WindowShelf", .035)
    for z in (1.43, 2.05):
        box("Layered display shelf", (-5.0, -3.4, z), (.68, 2.20, .13), "wood", "WindowShelf", .04)
    for i, color in enumerate(("coral", "sand", "peach", "cream")):
        box("Shelf book", (-5.02, -4.1+i*.21, 1.71), (.34, .15, .41-i*.035), color, "WindowShelf", .025)
    rod("Shelf ceramic vase", (-5, -3.0, 2.12), (-5, -3.0, 2.48), .17, "peach", "WindowShelf", .11)
    rod("Shelf bowl", (-5, -2.8, 1.50), (-5, -2.8, 1.64), .12, "butter", "WindowShelf", .22)
    rod("Tapered planter", (4.35, 3.63, .06), (4.35, 3.63, .78), .36, "clay", "Plant", .49)
    rod("Planter rim", (4.35, 3.63, .73), (4.35, 3.63, .84), .51, "sand", "Plant")
    rod("Recessed soil", (4.35, 3.63, .79), (4.35, 3.63, .82), .44, "wood", "Plant")
    for i in range(9):
        angle = i*2.39996
        base = (4.35, 3.63, .81)
        branch = (4.35+.16*math.cos(angle), 3.63+.16*math.sin(angle), 1.18+(i % 3)*.24)
        tip = (4.35+.87*math.cos(angle), 3.63+.72*math.sin(angle), 1.55+(i % 3)*.40)
        rod("Plant petiole", base, branch, .028, "deep", "Plant")
        a.leaf(f"Lance leaf {i}", branch, tip, .22, ("deep", "leaf", "lime")[i % 3])
    for x in (-3.0, -.9):
        rod("Pendant cord", (x, 2.7, 3.72), (x, 2.7, 3.12), .025, "wood", "Studio")
        rod("Pendant shade", (x, 2.7, 2.94), (x, 2.7, 3.17), .30, "coral", "Studio", .12)
        rod("Pendant diffuser", (x, 2.7, 2.92), (x, 2.7, 2.96), .24, "butter", "Studio")
        light = bpy.data.lights.new(PREFIX+"Pendant glow", "POINT")
        light.energy, light.shadow_soft_size = 18, .45
        light.color = linear(PALETTE["butter"])
        obj = bpy.data.objects.new(PREFIX+"Pendant glow", light)
        a.groups["Studio"].objects.link(obj)
        obj.location = (x, 2.7, 2.84)


def reference_avatar(a, path):
    before = set(bpy.data.objects)
    if "FINISHED" not in bpy.ops.import_scene.gltf(filepath=str(path)):
        raise RuntimeError("Original avatar import did not finish")
    imported = set(bpy.data.objects) - before
    source_mesh_names = {node['name'] for node in glb_json(path).get('nodes', [])
                         if 'mesh' in node and 'name' in node}
    reference_meshes = {obj for obj in imported if obj.type == 'MESH'
                        and obj.name in source_mesh_names}
    if len(reference_meshes) != len(source_mesh_names):
        raise RuntimeError('Imported source mesh names do not match the approved avatar')
    # The importer creates an Icosphere for bone display; it is not avatar geometry.
    for obj in imported - reference_meshes:
        if obj.type == 'MESH':
            obj.hide_render = True
            obj.hide_set(True)
    for obj in imported:
        for group in list(obj.users_collection):
            group.objects.unlink(obj)
        a.groups["Reference"].objects.link(obj)
    idle_frames = []
    for obj in imported:
        animation = obj.animation_data
        if not animation:
            continue
        idle_tracks = [track for track in animation.nla_tracks
                       if any("idle" in strip.name.lower() or
                              (strip.action and "idle" in strip.action.name.lower())
                              for strip in track.strips)]
        if idle_tracks:
            animation.action = None
            for track in animation.nla_tracks:
                track.is_solo = False
                track.mute = track not in idle_tracks
            idle_frames.extend(strip.frame_start for track in idle_tracks for strip in track.strips)
    if not idle_frames:
        raise RuntimeError("Could not identify imported Idle NLA; no substitute pose is accepted")
    a.scene.frame_set(int(min(idle_frames)))
    root = bpy.data.objects.new(PREFIX+"Reference placement only", None)
    a.groups["Reference"].objects.link(root)
    for obj in imported:
        if obj.parent not in imported:
            obj.parent = root
    bpy.context.view_layer.update()

    def bounds():
        graph = bpy.context.evaluated_depsgraph_get()
        return [obj.evaluated_get(graph).matrix_world @ Vector(corner)
                for obj in reference_meshes
                for corner in obj.evaluated_get(graph).bound_box]

    points = bounds()
    if not points:
        raise RuntimeError("Original avatar has no evaluated mesh bounds")
    root.scale = (2 / (max(p.z for p in points)-min(p.z for p in points)),) * 3
    bpy.context.view_layer.update()
    points = bounds()
    root.location = (-.05-(max(p.x for p in points)+min(p.x for p in points))/2,
                     -1.5-(max(p.y for p in points)+min(p.y for p in points))/2,
                     -min(p.z for p in points))
    bpy.context.view_layer.update()
    points = bounds()
    if abs(min(p.z for p in points)) > .005:
        raise RuntimeError("Reference feet are not anchored to the floor")
    return {"height": max(p.z for p in points)-min(p.z for p in points),
            "foot_z": min(p.z for p in points), "pose": "Imported Idle NLA",
            "source_meshes": len(reference_meshes)}


def frame_camera(scene, art, width, height):
    """Fit the complete authored room, not a portrait crop of the desktop view."""
    scene.render.resolution_x, scene.render.resolution_y = width, height
    bpy.context.view_layer.update()
    camera = scene.camera
    inverse = camera.matrix_world.inverted()
    points = [inverse @ (obj.matrix_world @ Vector(corner))
              for obj in art for corner in obj.bound_box]
    low_x, high_x = min(p.x for p in points), max(p.x for p in points)
    low_y, high_y = min(p.y for p in points), max(p.y for p in points)
    camera.location += camera.matrix_world.to_quaternion() @ Vector(
        ((low_x + high_x) / 2, (low_y + high_y) / 2, 0))
    camera.data.sensor_fit = 'HORIZONTAL'
    camera.data.ortho_scale = max(high_x - low_x, (high_y - low_y) * width / height) * 1.12
    bpy.context.view_layer.update()
    from bpy_extras.object_utils import world_to_camera_view
    projected = [world_to_camera_view(scene, camera, obj.matrix_world @ Vector(corner))
                 for obj in art for corner in obj.bound_box]
    if any(not (.02 <= p.x <= .98 and .02 <= p.y <= .98) for p in projected):
        raise RuntimeError('Authored room exceeds the intended safe camera frame')
    return camera.data.ortho_scale


def studio(a):
    scene = a.scene
    engines = {item.identifier for item in scene.render.bl_rna.properties["engine"].enum_items}
    engine = next((name for name in ("BLENDER_EEVEE_NEXT", "BLENDER_EEVEE") if name in engines), None)
    if engine is None:
        raise RuntimeError("Eevee unavailable; no silent renderer/device fallback")
    scene.render.engine = engine
    scene.world = bpy.data.worlds.new(PREFIX+"Sky fill")
    scene.world.use_nodes = True
    background = scene.world.node_tree.nodes.get("Background")
    background.inputs["Color"].default_value = (*linear(PALETTE["sky"]), 1)
    background.inputs["Strength"].default_value = .45
    for name, position, power, size, color in (
        ("Warm key", (1, -3, 10), 1600, 7, "pale"),
        ("Sky softbox", (-1, -5, 7), 850, 8, "sky"),
        ("Rear bounce", (4, 3, 7), 900, 6, "cream"),
    ):
        light = bpy.data.lights.new(PREFIX+name, "AREA")
        light.energy, light.shape, light.size = power, "DISK", size
        light.color = linear(PALETTE[color])
        obj = bpy.data.objects.new(PREFIX+name, light)
        a.groups["Studio"].objects.link(obj)
        obj.location = position
        obj.rotation_euler = (Vector((0, 0, 0))-obj.location).to_track_quat("-Z", "Y").to_euler()
    camera = bpy.data.cameras.new(PREFIX+"Orthographic")
    obj = bpy.data.objects.new(PREFIX+"Orthographic", camera)
    a.groups["Studio"].objects.link(obj)
    obj.location = (16, -16, 20)
    obj.rotation_euler = (Vector((0, 0, 1))-obj.location).to_track_quat("-Z", "Y").to_euler()
    camera.type, camera.ortho_scale = "ORTHO", 17.5
    scene.camera = obj
    scene.view_settings.view_transform = "AgX"
    scene.view_settings.exposure = 0
    scene.render.image_settings.file_format = "PNG"
    scene.render.resolution_percentage = 100
    scene.render.film_transparent = False
    scene.render.use_file_extension = True
    # Blender 5 uses a compositor node group; older Eevee uses scene.node_tree.
    # Both branches create only owned data, with no handlers or embedded texts.
    if hasattr(scene, "compositing_node_group"):
        tree = bpy.data.node_groups.new(PREFIX+"Compositor", "CompositorNodeTree")
        scene.compositing_node_group = tree
        tree.interface.new_socket(name="Image", in_out="OUTPUT", socket_type="NodeSocketColor")
        composite = tree.nodes.new("NodeGroupOutput")
        composite.is_active_output = True
    else:
        scene.use_nodes = True
        tree = scene.node_tree
        composite = next(node for node in tree.nodes if node.type == "COMPOSITE")
    layers = tree.nodes.new("CompositorNodeRLayers")
    layers.scene = scene
    gray = tree.nodes.new("CompositorNodeRGBToBW")
    tree.links.new(layers.outputs["Image"], gray.inputs["Image"])
    tree.links.new(layers.outputs["Image"], composite.inputs["Image"])
    return engine, tree, layers, gray, composite


def build(project_root):
    """Build once into five fixed, absent outputs. Returns JSON-safe evidence.

    On failure retain the isolated scene/partial outputs for inspection; never
    delete data or attempt destructive recovery. A second run refuses them.
    """
    root = Path(project_root).resolve(strict=True)
    if not root.is_dir() or not (root / "master-document.md").is_file():
        raise ValueError("project_root must be the project checkout")
    paths = {key: root / value for key, value in OUTPUTS.items()}
    avatar = root / "public/models/character.glb"
    for path in [*paths.values(), avatar]:
        if not path.resolve().is_relative_to(root):
            raise ValueError("Path escapes project_root")
    for path in paths.values():
        if path.exists() or path.is_symlink():
            raise FileExistsError(f"Refusing existing output: {path}")
    for blocks in (bpy.data.scenes, bpy.data.collections, bpy.data.objects,
                   bpy.data.meshes, bpy.data.materials, bpy.data.worlds,
                   bpy.data.cameras, bpy.data.lights, bpy.data.node_groups):
        if any(block.name.startswith(PREFIX) for block in blocks):
            raise ValueError("Owned namespace is occupied; inspect it without automatic deletion")
    if git_blob_hash(avatar) != AVATAR_GIT_HASH:
        raise ValueError("Original character.glb differs from the approved Git blob hash")
    glb_json(avatar)  # Reject external resources before the importer sees them.
    window = bpy.context.window
    if window is None or bpy.context.mode != "OBJECT":
        raise RuntimeError("Use the connected UI in Object mode; current mode will not be changed")
    previous_scene, previous_layer = window.scene, window.view_layer
    previous_selection = [obj for obj in previous_layer.objects if obj.select_get()]
    previous_active = previous_layer.objects.active
    previous_filepath = bpy.data.filepath
    scene = bpy.data.scenes.new(PREFIX+"Scene")
    warnings = ["Prepared composition requires human desktop/mobile/grayscale acceptance.",
                "Clearance metadata is provisional geometry guidance, not collision/runtime proof."]
    try:
        window.scene = scene
        scene.unit_settings.system = "METRIC"
        scene.unit_settings.scale_length = 1
        scene["module_m"] = 4/3
        scene["door_clear_width_m"] = 2.0
        scene["door_clear_height_m"] = 2.92
        scene["central_clear_lane_m"] = 2.8
        author = Author(scene)
        compose(author)
        engine, tree, layers, gray, composite = studio(author)
        bpy.context.view_layer.update()
        art = [obj for group in author.groups.values() for obj in group.objects if obj.type == "MESH"]
        expected = ("Architecture", "Counter", "Waiting", "Noticeboard", "WindowShelf", "Plant")
        if not all(any(obj.type == "MESH" for obj in author.groups[key].objects) for key in expected):
            raise RuntimeError("Missing expected authored group")
        if not art or any(not obj.data.polygons or not obj.data.materials for obj in art):
            raise RuntimeError("Empty authored mesh/material")
        # A bounded AABB check for this proposed central lane, not a navmesh.
        # Architecture is checked by the explicit open portal dimensions above.
        for key in ("Counter", "Waiting", "Noticeboard", "WindowShelf", "Plant"):
            for obj in author.groups[key].objects:
                points = [obj.matrix_world @ Vector(corner) for corner in obj.bound_box]
                if (max(p.x for p in points) > -.25 and min(p.x for p in points) < 2.55
                        and max(p.y for p in points) > -3.8 and min(p.y for p in points) < 3.8):
                    raise RuntimeError(f"Prop intrudes on provisional clear lane: {obj.name}")
        if any(tuple(obj.scale) != (1, 1, 1) for obj in art):
            raise RuntimeError("Authored export objects must have unit scale")
        reference = reference_avatar(author, avatar)
        # Reserve only fixed outputs, exclusively; foreign files are never overwritten.
        for path in paths.values():
            path.parent.mkdir(parents=True, exist_ok=True)
            with path.open("xb"):
                pass
        for name, width, height in (("desktop", 1280, 800),
                                    ("mobile", 390, 844),
                                    ("grayscale", 1280, 800)):
            frame_camera(scene, art, width, height)
            tree.links.new(gray.outputs[0] if name == "grayscale" else layers.outputs["Image"],
                           composite.inputs["Image"])
            scene.render.filepath = str(paths[name])
            bpy.ops.render.render(write_still=True)
        tree.links.new(layers.outputs["Image"], composite.inputs["Image"])
        scene.render.resolution_x, scene.render.resolution_y = 1280, 800
        for obj in scene.objects:
            obj.select_set(False)
        for obj in art:
            obj.select_set(True)
        bpy.context.view_layer.objects.active = art[0]
        result = bpy.ops.export_scene.gltf(filepath=str(paths["glb"]), export_format="GLB",
                                          use_selection=True, use_active_scene=True, export_apply=True,
                                          export_animations=False, export_cameras=False,
                                          export_lights=False, export_yup=True,
                                          export_materials="EXPORT", export_extras=False)
        if "FINISHED" not in result:
            raise RuntimeError("Room GLB export did not finish")
        exported = glb_json(paths["glb"])
        if not exported.get("meshes") or not exported.get("materials"):
            raise RuntimeError("Room GLB is empty")
        if any(exported.get(key) for key in ("skins", "animations", "cameras")):
            raise RuntimeError("Reference or studio data leaked into room GLB")
        if "KHR_lights_punctual" in exported.get("extensionsUsed", []):
            raise RuntimeError("Studio lights leaked into room GLB")
        if len(exported.get("nodes", [])) != len(art):
            raise RuntimeError("Unexpected room GLB nodes: check export scope")
        if git_blob_hash(avatar) != AVATAR_GIT_HASH:
            raise RuntimeError("Original avatar hash changed")
        bpy.data.libraries.write(str(paths["blend"]), {scene}, path_remap="NONE", fake_user=True)
        checks = {"output_scope": True, "expected_groups": True,
                  "nonempty_meshes_materials": True, "avatar_hash_unchanged": True,
                  "reference_feet_on_floor": True, "room_export_mesh_only": True,
                  "glb_embedded_resources": True, "central_lane_prop_aabbs_clear": True,
                  "authored_unit_scale": True, "camera_safe_frame": True}
        return {"scene": scene.name, "paths": {k: str(v) for k, v in paths.items()},
                "engine": engine, "avatar": reference, "checks": checks,
                "meshes": len(art), "polygons_before_modifiers": sum(len(o.data.polygons) for o in art),
                "glb_bytes": paths["glb"].stat().st_size, "warnings": warnings}
    finally:
        window.scene = previous_scene
        window.view_layer = previous_layer
        for obj in previous_layer.objects:
            obj.select_set(obj in previous_selection)
        previous_layer.objects.active = previous_active
        if bpy.data.filepath != previous_filepath:
            raise RuntimeError("Unexpected user filepath change")
