"""Explicit material-only revision of the existing reception; no import-time edits.

Connected Blender: runpy.run_path(...), dry_run(root), then revise(root, receipt).
The caller must inspect the dry-run receipt before approving revise. Failures keep
staging evidence for inspection; no automatic deletion, reset or retry is used.
"""
from pathlib import Path
import copy
import hashlib
import json
import runpy
import struct

import bpy

PREFIX = "ITReception_"
ARTIFACTS = "odd/artifacts/reception-turquoise"


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def read_glb(path):
    data = path.read_bytes()
    magic, version, length = struct.unpack_from("<4sII", data)
    size, kind = struct.unpack_from("<I4s", data, 12)
    if (magic, version, length, kind) != (b"glTF", 2, len(data), b"JSON"):
        raise ValueError("Expected a complete GLB 2.0")
    document = json.loads(data[20:20+size])
    offset = 20+size
    binary_size, binary_kind = struct.unpack_from("<I4s", data, offset)
    if binary_kind != b"BIN\0" or offset+8+binary_size != len(data):
        raise ValueError("Expected one embedded BIN chunk")
    if any("uri" in item for key in ("buffers", "images") for item in document.get(key, [])):
        raise ValueError("External resources are forbidden")
    return document, data[offset+8:]


def assert_geometry_equal(before, before_bin, after, after_bin):
    """Allow only material tables and primitive material indices to differ."""
    documents = []
    for document in (before, after):
        normalized = copy.deepcopy(document)
        normalized.pop("materials", None)
        for mesh in normalized.get("meshes", []):
            for primitive in mesh.get("primitives", []):
                primitive.pop("material", None)
        documents.append(normalized)
    if documents[0] != documents[1] or before_bin != after_bin:
        raise ValueError("Non-material GLB JSON or geometry BIN changed")


def geometry(scene):
    """Hash every object's identity/transform and raw/evaluated mesh topology."""
    graph = bpy.context.evaluated_depsgraph_get()
    records = []
    for obj in sorted(scene.objects, key=lambda item: item.name):
        record = {"name": obj.name, "type": obj.type,
                  "parent": obj.parent.name if obj.parent else None,
                  "matrix": [list(row) for row in obj.matrix_world],
                  "collections": sorted(c.name for c in obj.users_collection)}
        if obj.type == "MESH":
            meshes = [obj.data, obj.evaluated_get(graph).data]
            record["geometry"] = [{"vertices": [list(v.co) for v in mesh.vertices],
                "edges": [list(e.vertices) for e in mesh.edges],
                "faces": [list(p.vertices) for p in mesh.polygons],
                "material_indices": [p.material_index for p in mesh.polygons]}
                for mesh in meshes]
        records.append(record)
    return hashlib.sha256(json.dumps(records, sort_keys=True).encode()).hexdigest()


def paths_for(project_root):
    root = Path(project_root).resolve(strict=True)
    if not (root / "master-document.md").is_file():
        raise ValueError("Expected project checkout")
    paths = {"root": root, "source": root / "assets/blender/reception.blend",
             "export": root / "public/models/rooms/reception.glb",
             "avatar": root / "public/models/character.glb", "evidence": root / ARTIFACTS}
    if any(not path.resolve().is_relative_to(root) for path in paths.values()):
        raise ValueError("Path escapes checkout")
    return paths


def dry_run(project_root):
    """Read-only baseline and exact assignment plan. Does not create files."""
    paths = paths_for(project_root)
    source = paths["source"]
    if Path(bpy.data.filepath).resolve() != source or bpy.data.is_dirty:
        raise ValueError("Open the unchanged canonical reception source before revision")
    if bpy.context.mode != "OBJECT" or bpy.context.window is None:
        raise ValueError("Expected connected UI in Object mode")
    scene = bpy.context.scene
    if scene.name != PREFIX+"Scene" or len(bpy.data.scenes) != 1 or bpy.data.texts:
        raise ValueError("Unexpected source scenes or embedded texts")
    recipe = runpy.run_path(str(paths["root"] / "scripts/blender/author_reception.py"))
    if recipe["git_blob_hash"](paths["avatar"]) != recipe["AVATAR_GIT_HASH"]:
        raise ValueError("Original avatar does not match approved Git blob")
    art = [o for o in scene.objects if o.type == "MESH" and o.name.startswith(PREFIX)]
    if len(scene.objects) != 160 or len(art) != 144:
        raise ValueError("Expected original 160 objects and 144 authored meshes")
    plan = []
    for obj in sorted(art, key=lambda item: item.name):
        if len(obj.data.materials) != 1:
            raise ValueError("Expected one material per authored mesh")
        material = obj.data.materials[0]
        token = material.name.removeprefix(PREFIX)
        if token not in recipe["PALETTE"]:
            raise ValueError("Unexpected authored material")
        shader = material.node_tree.nodes.get("Principled BSDF")
        expected = (*recipe["linear"](recipe["PALETTE"][token]), 1)
        if any(abs(a-b) > 1e-6 for a, b in zip(shader.inputs["Base Color"].default_value, expected)):
            raise ValueError("Palette identity changed")
        target = recipe["reception_material"](obj.name.removeprefix(PREFIX), token)
        if bpy.data.materials.get(PREFIX+target) is None:
            raise ValueError("Missing target palette material")
        if target != token:
            plan.append({"object": obj.name, "from": token, "to": target})
    document, binary = read_glb(paths["export"])
    if len(document.get("nodes", [])) != 144 or len(document.get("meshes", [])) != 144:
        raise ValueError("Unexpected original GLB inventory")
    if any(document.get(k) for k in ("skins", "animations", "cameras")):
        raise ValueError("Unexpected reference/studio export")
    if not plan:
        raise ValueError("No original material assignments remain; do not reapply")
    return {"filepath": bpy.data.filepath, "scene": scene.name, "objects": 160,
            "room_meshes": 144, "geometry_sha256": geometry(scene),
            "sha256": {key: sha(paths[key]) for key in ("source", "export", "avatar")},
            "bin_sha256": hashlib.sha256(binary).hexdigest(), "plan": plan}


def revise(project_root, approved_receipt):
    """Apply only a previously inspected exact dry-run plan and stage all outputs.

    Never promotes canonical files: inspect returned staging evidence, then call
    promote. Library write targets a new absent path, so no save-version setting
    or global preference is needed. Both original bytes are retained locally.
    """
    receipt = dry_run(project_root)
    if receipt != approved_receipt:
        raise ValueError("Baseline differs from inspected dry-run receipt")
    paths = paths_for(project_root)
    folder = paths["evidence"]
    names = ("original.blend", "original.glb", "revised.blend", "revised.glb",
             "desktop.png", "mobile.png", "grayscale.png", "evidence.json")
    if any((folder / name).exists() for name in names):
        raise FileExistsError("Revision evidence already exists; inspect without overwrite")
    folder.mkdir(parents=True, exist_ok=True)
    for key, name in (("source", "original.blend"), ("export", "original.glb")):
        with (folder / name).open("xb") as output:
            output.write(paths[key].read_bytes())
        if sha(folder / name) != receipt["sha256"][key]:
            raise ValueError("Original backup hash mismatch")
    scene = bpy.context.scene
    selection = [o for o in scene.objects if o.select_get()]
    active = bpy.context.view_layer.objects.active
    camera_location = scene.camera.location.copy()
    camera_scale = scene.camera.data.ortho_scale
    camera_sensor_fit = scene.camera.data.sensor_fit
    resolution = (scene.render.resolution_x, scene.render.resolution_y)
    render_path = scene.render.filepath
    tree = scene.compositing_node_group if hasattr(scene, "compositing_node_group") else scene.node_tree
    output = next(n for n in tree.nodes if n.type in ("GROUP_OUTPUT", "COMPOSITE"))
    original_socket = output.inputs["Image"].links[0].from_socket
    layers = next(n for n in tree.nodes if n.type == "R_LAYERS")
    gray = next(n for n in tree.nodes if n.type == "RGBTOBW")
    recipe = runpy.run_path(str(paths["root"] / "scripts/blender/author_reception.py"))
    try:
        for change in receipt["plan"]:
            bpy.data.objects[change["object"]].data.materials[0] = bpy.data.materials[PREFIX+change["to"]]
        art = [o for o in scene.objects if o.type == "MESH" and o.name.startswith(PREFIX)]
        for obj in scene.objects:
            obj.select_set(obj in art)
        bpy.context.view_layer.objects.active = art[0]
        result = bpy.ops.export_scene.gltf(filepath=str(folder / "revised.glb"), export_format="GLB",
            use_selection=True, use_active_scene=True, export_apply=True, export_animations=False,
            export_cameras=False, export_lights=False, export_yup=True,
            export_materials="EXPORT", export_extras=False)
        if "FINISHED" not in result:
            raise RuntimeError("Export did not finish")
        before, before_bin = read_glb(paths["export"])
        after, after_bin = read_glb(folder / "revised.glb")
        assert_geometry_equal(before, before_bin, after, after_bin)
        # Verify every primitive uses the exact resolver-selected source material.
        for old_mesh, new_mesh in zip(before["meshes"], after["meshes"]):
            for old_primitive, new_primitive in zip(old_mesh["primitives"], new_mesh["primitives"]):
                old_name = before["materials"][old_primitive["material"]]["name"].removeprefix(PREFIX)
                new_name = after["materials"][new_primitive["material"]]["name"].removeprefix(PREFIX)
                expected = recipe["reception_material"](old_mesh["name"].removeprefix(PREFIX), old_name)
                if new_name != expected:
                    raise ValueError("GLB primitive/source assignment mismatch")
        for name, width, height in (("desktop", 1280, 800), ("mobile", 390, 844), ("grayscale", 1280, 800)):
            recipe["frame_camera"](scene, art, width, height)
            tree.links.new(gray.outputs[0] if name == "grayscale" else layers.outputs["Image"], output.inputs["Image"])
            scene.render.filepath = str(folder / (name+".png"))
            bpy.ops.render.render(write_still=True)
    finally:
        tree.links.new(original_socket, output.inputs["Image"])
        scene.camera.location = camera_location
        scene.camera.data.ortho_scale = camera_scale
        scene.camera.data.sensor_fit = camera_sensor_fit
        scene.render.resolution_x, scene.render.resolution_y = resolution
        scene.render.filepath = render_path
        for obj in scene.objects:
            obj.select_set(obj in selection)
        bpy.context.view_layer.objects.active = active
        bpy.context.view_layer.update()
    if geometry(scene) != receipt["geometry_sha256"] or sha(paths["avatar"]) != receipt["sha256"]["avatar"]:
        raise ValueError("Source geometry/transforms or avatar bytes changed")
    bpy.data.libraries.write(str(folder / "revised.blend"), {scene}, path_remap="NONE", fake_user=True)
    with bpy.data.libraries.load(str(folder / "revised.blend")) as (data, unused):
        if data.scenes != [scene.name] or data.texts:
            raise ValueError("Unexpected staged source inventory")
    if bpy.data.filepath != receipt["filepath"]:
        raise ValueError("Original session filepath changed")
    evidence = {"baseline": receipt, "geometry_sha256": geometry(scene),
                "bin_sha256": hashlib.sha256(after_bin).hexdigest(),
                "staged_sha256": {name: sha(folder / name) for name in names if name != "evidence.json"},
                "source_export_assignments_match": True, "canonical_promoted": False}
    with (folder / "evidence.json").open("x", encoding="utf-8") as output_file:
        json.dump(evidence, output_file, indent=2)
    return evidence


def promote(project_root):
    """Explicit second phase after caller inspects staged evidence; no rerun."""
    paths = paths_for(project_root)
    folder = paths["evidence"]
    evidence = json.loads((folder / "evidence.json").read_text())
    for name, digest in evidence["staged_sha256"].items():
        if sha(folder / name) != digest:
            raise ValueError("Staging evidence changed")
    for key in ("source", "export", "avatar"):
        if sha(paths[key]) != evidence["baseline"]["sha256"][key]:
            raise ValueError("Canonical baseline changed before promotion")
    assert_geometry_equal(*read_glb(paths["export"]), *read_glb(folder / "revised.glb"))
    # Deliberate authorized material revision; no Blender backup/preferences touched.
    for key, name in (("source", "revised.blend"), ("export", "revised.glb")):
        paths[key].write_bytes((folder / name).read_bytes())
        if sha(paths[key]) != evidence["staged_sha256"][name]:
            raise ValueError("Canonical promotion hash mismatch")
    return {key: sha(paths[key]) for key in ("source", "export", "avatar")}
