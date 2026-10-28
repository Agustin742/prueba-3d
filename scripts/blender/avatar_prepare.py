"""T1 read-only audit and editable derivatives, never catalogue generation.

Run only in a fresh process: blender --background --factory-startup --python
scripts/blender/avatar_prepare.py. Outputs must not already exist. All inputs
are fixed; no external GLTF resources or arbitrary source scripts are executed.
Female output is an imported export, not recovered original authoring history.
"""
from pathlib import Path
import hashlib
import json
import os
import struct
import sys
import traceback

import bpy
from mathutils import Matrix, Quaternion, Vector

ROOT = Path(__file__).resolve().parents[2]
EVIDENCE = ROOT / "odd/artifacts/avatar-customization"
OUT = ROOT / "assets/blender/avatars"
FEMALE = ROOT.parent / "character-female.glb"
BASE = ROOT / "assets/blender/character-base.blend"
GLBS = [ROOT / "public/models/character.glb",
        ROOT / "public/models/hair/afro-01.glb",
        ROOT / "public/models/hair/dreads-01.glb",
        ROOT / "public/models/clothing/hoodie-01.glb",
        ROOT / "public/models/clothing/shirt-01.glb", FEMALE]
C = Matrix(((1, 0, 0, 0), (0, 0, -1, 0), (0, 1, 0, 0), (0, 0, 0, 1)))
TOLERANCE = 1e-5


def label(path):
    return path.relative_to(ROOT).as_posix() if path.is_relative_to(ROOT) else "../character-female.glb"


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def matrix_list(matrix):
    return [[float(value) for value in row] for row in matrix]


def matrix_from(values):
    return Matrix([values[i:i + 4] for i in range(0, 16, 4)]).transposed()


def delta(a, b):
    return max(abs(a[r][c] - b[r][c]) for r in range(4) for c in range(4))


def write_json(path, data):
    with path.open("x", encoding="utf-8") as stream:
        json.dump(data, stream, indent=2, allow_nan=False)
        stream.write("\n")


def glb_audit(path):
    data = path.read_bytes()
    magic, version, length = struct.unpack_from("<4sII", data)
    assert magic == b"glTF" and version == 2 and length == len(data), label(path)
    offset, document, binary = 12, None, b""
    while offset < length:
        size, kind = struct.unpack_from("<I4s", data, offset)
        chunk = data[offset + 8:offset + 8 + size]
        if kind == b"JSON":
            document = json.loads(chunk)
        elif kind == b"BIN\x00":
            binary = chunk
        offset += size + 8
    assert document is not None and offset == length
    for resource in document.get("buffers", []) + document.get("images", []):
        assert "uri" not in resource, "External/URI resource prohibited"
    nodes = document.get("nodes", [])
    parents = {child: i for i, node in enumerate(nodes) for child in node.get("children", [])}
    cache = {}

    def world(index):
        if index in cache:
            return cache[index]
        node = nodes[index]
        if "matrix" in node:
            local = matrix_from(node["matrix"])
        else:
            x, y, z, w = node.get("rotation", [0, 0, 0, 1])
            local = Matrix.LocRotScale(Vector(node.get("translation", [0, 0, 0])),
                                        Quaternion((w, x, y, z)),
                                        Vector(node.get("scale", [1, 1, 1])))
        cache[index] = world(parents[index]) @ local if index in parents else local
        return cache[index]

    def accessor(index):
        item = document["accessors"][index]
        assert not item.get("sparse"), "Sparse accessor not supported by bounded audit"
        view = document["bufferViews"][item["bufferView"]]
        assert view.get("buffer", 0) == 0
        components = {"SCALAR": 1, "VEC2": 2, "VEC3": 3, "VEC4": 4, "MAT4": 16}[item["type"]]
        code = {5120: "b", 5121: "B", 5122: "h", 5123: "H", 5125: "I", 5126: "f"}[item["componentType"]]
        fmt = "<" + code * components
        stride = view.get("byteStride", struct.calcsize(fmt))
        start = view.get("byteOffset", 0) + item.get("byteOffset", 0)
        return [struct.unpack_from(fmt, binary, start + i * stride) for i in range(item["count"])]

    skins = []
    for skin in document.get("skins", []):
        joints = skin["joints"]
        ibms = accessor(skin["inverseBindMatrices"]) if "inverseBindMatrices" in skin else [tuple(Matrix.Identity(4).transposed()[r][c] for r in range(4) for c in range(4))] * len(joints)
        entries = []
        for index, values in zip(joints, ibms):
            entries.append({"node": index, "name": nodes[index].get("name", str(index)),
                            "parent": nodes[parents[index]].get("name", str(parents[index])) if index in parents else None,
                            "world_rest": matrix_list(world(index)),
                            "inverse_bind": matrix_list(matrix_from(values)),
                            "world_rest_times_inverse_bind": matrix_list(world(index) @ matrix_from(values))})
        assert len(entries) == len(joints)
        skins.append({"name": skin.get("name"), "joints": entries})
    meshes = []
    for index, node in enumerate(nodes):
        if "mesh" not in node:
            continue
        mesh = document["meshes"][node["mesh"]]
        primitives = []
        for primitive in mesh["primitives"]:
            position = document["accessors"][primitive["attributes"]["POSITION"]]
            primitives.append({"vertices": position["count"], "min": position.get("min"), "max": position.get("max"),
                               "indices": document["accessors"][primitive["indices"]]["count"] if "indices" in primitive else None,
                               "mode": primitive.get("mode", 4), "attributes": primitive["attributes"],
                               "material": primitive.get("material"), "morph_targets": len(primitive.get("targets", []))})
        meshes.append({"node": index, "name": node.get("name"), "mesh_name": mesh.get("name"),
                       "skin": node.get("skin"), "world": matrix_list(world(index)), "primitives": primitives})
    clips = []
    for clip in document.get("animations", []):
        channels = []
        for channel in clip["channels"]:
            target = channel["target"]
            sampler = clip["samplers"][channel["sampler"]]
            times = accessor(sampler["input"])
            channels.append({"node": target.get("node"), "target": nodes[target["node"]].get("name") if "node" in target else None,
                             "path": target["path"], "keys": len(times),
                             "time_range": [times[0][0], times[-1][0]] if times else [],
                             "interpolation": sampler.get("interpolation", "LINEAR")})
        clips.append({"name": clip.get("name"), "channels": channels})
    return {"path": label(path), "generator": document.get("asset", {}).get("generator"),
            "nodes": len(nodes), "skins": skins, "meshes": meshes, "clips": clips,
            "coordinate_system": "glTF Y-up; authored units nominal meters; no normalization applied"}


def compare(a, b):
    """Compare joint mapping, ancestry AND numeric rest/bind matrices, not names alone."""
    left = {j["name"]: j for j in a["skins"][0]["joints"]} if a["skins"] else {}
    right = {j["name"]: j for j in b["skins"][0]["joints"]} if b["skins"] else {}
    shared = sorted(left.keys() & right.keys())
    differences = []
    for name in shared:
        x, y = left[name], right[name]
        differences.append({"name": name, "parent_equal": x["parent"] == y["parent"],
                            "rest_max_abs_delta": delta(x["world_rest"], y["world_rest"]),
                            "inverse_bind_max_abs_delta": delta(x["inverse_bind"], y["inverse_bind"])})
    targets = sorted({c["target"] for clip in a["clips"] for c in clip["channels"]})
    all_right_targets = {m["name"] for m in b["meshes"]} | set(right)
    return {"left": a["path"], "right": b["path"], "shared_joints": len(shared),
            "left_only_joints": sorted(left.keys() - right.keys()), "right_only_joints": sorted(right.keys() - left.keys()),
            "joint_differences": differences,
            "left_animation_targets_absent_from_right_mesh_or_joint_names": [t for t in targets if t not in all_right_targets],
            "numeric_skin_match": bool(shared) and left.keys() == right.keys() and all(d["parent_equal"] and d["rest_max_abs_delta"] <= TOLERANCE and d["inverse_bind_max_abs_delta"] <= TOLERANCE for d in differences),
            "limit": "First-skin comparison only; all skins retained above. Numeric match does not prove geometric fit or animation semantics."}


def scene_audit():
    meshes, rigs = [], []
    for obj in sorted(bpy.context.scene.objects, key=lambda o: o.name):
        if obj.type == "ARMATURE":
            rigs.append({"name": obj.name, "world": matrix_list(obj.matrix_world),
                         "scale": list(obj.scale), "bones": [{"name": b.name, "parent": b.parent.name if b.parent else None,
                         "deform": b.use_deform, "local_rest": matrix_list(b.matrix_local),
                         "world_rest": matrix_list(obj.matrix_world @ b.matrix_local)} for b in obj.data.bones]})
        elif obj.type == "MESH":
            mesh = obj.data
            edge_counts = {}
            face_keys = set()
            duplicates = 0
            # Coincident polygons are only candidates, never authorization to delete.
            for poly in mesh.polygons:
                coords = tuple(sorted(tuple(round(float(v), 6) for v in mesh.vertices[i].co) for i in poly.vertices))
                duplicates += coords in face_keys
                face_keys.add(coords)
                for key in poly.edge_keys:
                    key = tuple(sorted(key))
                    edge_counts[key] = edge_counts.get(key, 0) + 1
            coords = [obj.matrix_world @ v.co for v in mesh.vertices]
            bounds = [[min(v[i] for v in coords) for i in range(3)], [max(v[i] for v in coords) for i in range(3)]] if coords else []
            meshes.append({"name": obj.name, "vertices": len(mesh.vertices), "polygons": len(mesh.polygons),
                           "triangles": sum(max(0, len(p.vertices) - 2) for p in mesh.polygons),
                           "boundary_edges": sum(n == 1 for n in edge_counts.values()),
                           "nonmanifold_edges_over_two_faces": sum(n > 2 for n in edge_counts.values()),
                           "coincident_polygon_candidates_1e_minus_6": duplicates,
                           "world": matrix_list(obj.matrix_world), "scale": list(obj.scale), "world_bounds": bounds,
                           "parent": obj.parent.name if obj.parent else None,
                           "materials": [m.name if m else None for m in mesh.materials],
                           "vertex_groups": [v.name for v in obj.vertex_groups],
                           "armature_modifiers": [m.object.name if m.object else None for m in obj.modifiers if m.type == "ARMATURE"],
                           "shape_keys": [k.name for k in mesh.shape_keys.key_blocks] if mesh.shape_keys else []})
    return {"unit_system": bpy.context.scene.unit_settings.system, "unit_scale": bpy.context.scene.unit_settings.scale_length,
            "rigs": rigs, "meshes": meshes,
            "actions": [{"name": a.name, "frame_range": list(a.frame_range)} for a in bpy.data.actions],
            "limit": "Raw mesh topology/rest bounds, not evaluated animated collision or occlusion. No internal faces removed."}


def derivative(path, provenance):
    before = scene_audit()
    bpy.context.scene["avatar_source_provenance"] = provenance
    bpy.context.preferences.filepaths.save_version = 0
    bpy.ops.wm.save_as_mainfile(filepath=str(path), check_existing=False, relative_remap=False)
    bpy.ops.wm.open_mainfile(filepath=str(path), load_ui=False, use_scripts=False)
    after = scene_audit()
    assert before == after, "Derivative scene roundtrip changed audited structure"
    return {"path": label(path), "sha256": digest(path), "provenance": provenance,
            "roundtrip_structure_equal": True, "scene": after}


def run():
    assert bpy.app.background, "Only an isolated background process is allowed"
    bpy.context.preferences.filepaths.use_scripts_auto_execute = False
    assert not (EVIDENCE / "structure.json").exists(), "Evidence already exists; preserve previous run"
    for name in ("male-editable.blend", "female-editable.blend"):
        assert not (OUT / name).exists(), "Derivative already exists; preserve previous work"
    originals = [BASE] + GLBS
    hashes = {label(p): digest(p) for p in originals}
    report = {"blender_executable": bpy.app.binary_path, "blender_version": bpy.app.version_string,
              "tolerance": TOLERANCE, "original_sha256_before": hashes,
              "coverage": ["S3: topology evidence only", "S4: existing hair preservation and rig audit only", "S5: existing garments rig audit only", "S7: editable bases without body controls"],
              "limitations": ["No catalogue generated", "No material neutralization or baseline replacement", "No visual/animated fit acceptance", "Female BLEND reconstructed from export; no original authoring history recovered"]}
    try:
        audits = [glb_audit(p) for p in GLBS]
        report["glbs"] = audits
        report["comparisons"] = [compare(audits[0], a) for a in audits[1:]]
        report["female_to_male_animation_targets"] = compare(audits[-1], audits[0])
        OUT.mkdir(parents=True, exist_ok=True)
        bpy.ops.wm.open_mainfile(filepath=str(BASE), load_ui=False, use_scripts=False)
        male = scene_audit()
        report["original_blend_scene"] = male
        report["blend_to_glb_rest_comparisons"] = []
        for rig in male["rigs"]:
            bones = {b["name"]: b for b in rig["bones"]}
            report["blend_to_glb_rest_comparisons"].append({"rig": rig["name"], "axis_conversion": "glTF(x,y,z) -> Blender(x,-z,y)",
                "bone_local_basis": "Exporter retains bone-local axes; convert world basis on the left only",
                "joints": [{"name": j["name"], "world_rest_max_abs_delta": delta(bones[j["name"]]["world_rest"], matrix_list(C @ Matrix(j["world_rest"])))}
                           for skin in audits[0]["skins"] for j in skin["joints"] if j["name"] in bones],
                "glb_joints_absent": sorted({j["name"] for skin in audits[0]["skins"] for j in skin["joints"]} - bones.keys())})
        report["derivatives"] = [derivative(OUT / "male-editable.blend", "Editable copy of assets/blender/character-base.blend; original preserved")]
        # Factory reset affects this background process only. Never use an interactive connection.
        bpy.ops.wm.read_factory_settings(use_empty=True)
        bpy.context.preferences.filepaths.use_scripts_auto_execute = False
        bpy.ops.import_scene.gltf(filepath=str(FEMALE))
        report["derivatives"].append(derivative(OUT / "female-editable.blend", "Imported ../character-female.glb export; original style/materials preserved, not original authoring history"))
        assert all(d["scene"]["rigs"] and d["scene"]["meshes"] for d in report["derivatives"])
        report["assertions"] = {"background_only": True, "embedded_glb_resources_only": True,
                                 "derivatives_have_rigs_and_meshes": True, "derivative_roundtrips_equal": True}
        report["status"] = "passed"
    finally:
        report["original_sha256_after"] = {label(p): digest(p) for p in originals}
        report["originals_unchanged"] = hashes == report["original_sha256_after"]
        if not report["originals_unchanged"]:
            report["status"] = "failed: originals changed"
        write_json(EVIDENCE / "structure.json", report)
    assert report["originals_unchanged"]
    print("AVATAR_T1_PASS: originals unchanged; both editable derivatives roundtrip structurally equal", flush=True)


if __name__ == "__main__":
    try:
        run()
    except BaseException:
        traceback.print_exc()
        sys.stdout.flush()
        sys.stderr.flush()
        # Blender otherwise may return success for a --python exception.
        os._exit(1)
