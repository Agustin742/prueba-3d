"""One parent-supervised isolated Blender correction run; never run in live MCP scene.

blender --background --factory-startup --python-exit-code 1 --python
scripts/blender/avatar_catalogue_hoodie_validate.py
Writes ONLY the three correction directories. No subprocesses or retries.
"""
from pathlib import Path
import hashlib
import json
import os
import re
import sys
import traceback

sys.dont_write_bytecode = True
sys.path.insert(0, str(Path(__file__).resolve().parent))
import bpy
from mathutils import Quaternion
import avatar_catalogue as catalogue
import avatar_catalogue_validation as validation
from avatar_catalogue_hoodie import fit

ROOT = catalogue.ROOT
EVIDENCE = ROOT / 'odd/artifacts/avatar-customization/hoodie-correction'
OUTPUT = ROOT / 'public/models/avatars-correction/female/top-hoodie.glb'
SOURCE = ROOT / 'assets/blender/avatars/catalogue-correction/female-hoodie.blend'


def write(path, value):
    with path.open('x', encoding='utf-8') as stream:
        json.dump(value, stream, indent=2, allow_nan=False)
        stream.write('\n')


def protected_hashes():
    paths = {ROOT / p for p in catalogue.ORIGINALS}
    for directory in ['public/models/avatars', 'assets/blender/avatars/catalogue',
                      'odd/artifacts/avatar-customization/catalogue',
                      'public/models/avatars-correction',
                      'assets/blender/avatars/catalogue-correction',
                      'odd/artifacts/avatar-customization/hoodie-correction']:
        paths.update(p for p in (ROOT / directory).rglob('*') if p.is_file())
    # Exclude only this invocation's new destinations, not the prior correction.
    paths = {p for p in paths if p not in {OUTPUT, SOURCE} and EVIDENCE not in p.parents}
    return {p.relative_to(ROOT).as_posix(): hashlib.sha256(p.read_bytes()).hexdigest()
            for p in sorted(paths)}


def mesh_signature(obj):
    data = {'vertices': [list(v.co) for v in obj.data.vertices],
            'faces': [list(p.vertices) for p in obj.data.polygons],
            'weights': [[(obj.vertex_groups[g.group].name, g.weight) for g in v.groups]
                        for v in obj.data.vertices],
            'world': [list(row) for row in obj.matrix_world]}
    return hashlib.sha256(json.dumps(data, sort_keys=True).encode()).hexdigest()


def reset(rig):
    for obj in bpy.context.scene.objects:
        if obj.animation_data:
            obj.animation_data.action = None
            for track in obj.animation_data.nla_tracks:
                track.mute = True
    for bone in rig.pose.bones:
        bone.matrix_basis.identity()
    bpy.context.scene.frame_set(0)
    bpy.context.view_layer.update()


def body_points(body):
    evaluated = body.evaluated_get(bpy.context.evaluated_depsgraph_get())
    mesh = evaluated.to_mesh()
    points = [evaluated.matrix_world @ mesh.vertices[i].co
              for i in range(0, len(mesh.vertices), 53)]
    evaluated.to_mesh_clear()
    return points


def action_sources(rig):
    assert rig.animation_data, 'Female source rig has no animation'
    sources = []
    for track in rig.animation_data.nla_tracks:
        for strip in track.strips:
            if strip.action:
                sources.append((track.name, strip.name, strip.action,
                                getattr(strip, 'action_slot', None)))
    return sources


def choose_action(sources, name):
    pattern = re.compile(r'(^|[|_. ])' + re.escape(name) + r'($|[|_. ])', re.I)
    matches = [source for source in sources
               if any(pattern.search(value) for value in (source[0], source[1], source[2].name))]
    unique = {(source[2].as_pointer(), getattr(source[3], 'handle', None)): source for source in matches}
    assert len(unique) == 1, ('Ambiguous/missing female clip', name,
                              [(s[0], s[1], s[2].name) for s in matches])
    return next(iter(unique.values()))


def set_action(rig, source, frame):
    reset(rig)
    rig.animation_data.action = source[2]
    if source[3] is not None:
        rig.animation_data.action_slot = source[3]
    integer = int(frame)
    bpy.context.scene.frame_set(integer, subframe=frame - integer)
    bpy.context.view_layer.update()


def overlaps(body, pants, hoodie):
    return {target.name: validation.collision_candidates(target, hoodie)
            for target in [body, pants]}


def render_evidence(rig, body, visible, sources, stage, camera):
    reset(rig)
    pants = bpy.data.objects['Pants']
    hoodie = [o for o in visible if o.name.startswith('Hoodie')]
    assert hoodie and body in visible and pants in visible, 'Never conceal Body/Pants'
    rest = body_points(body)
    garment_rest = {o.name: body_points(o) for o in hoodie}
    rest_bones = {b.name: b.matrix.copy() for b in rig.pose.bones}
    results = []
    for name in ['Idle', 'Walk', 'Sit', 'raised-arm']:
        if name == 'raised-arm':
            reset(rig)
            bone = rig.pose.bones['DEF-upper_arm.L']
            bone.rotation_mode = 'QUATERNION'
            bone.rotation_quaternion = Quaternion((0, 1, 0), -1.3)
            bpy.context.view_layer.update()
            proof = {'kind': 'manual-diagnostic', 'bone': bone.name, 'angle_radians': -1.3}
        else:
            source = choose_action(sources, name)
            start, end = map(float, source[2].frame_range)
            assert end > start
            samples = []
            for fraction in [.15, .5, .85]:
                frame = start + (end - start) * fraction
                set_action(rig, source, frame)
                points = body_points(body)
                assert len(points) == len(rest)
                displacement = max((a - b).length for a, b in zip(points, rest))
                matrix_delta = max(abs(b.matrix[r][c] - rest_bones[b.name][r][c])
                                   for b in rig.pose.bones for r in range(4) for c in range(4))
                garment_delta = {o.name: max((a - b).length for a, b in
                                 zip(body_points(o), garment_rest[o.name])) for o in hoodie}
                assert garment_delta and all(value > 1e-6 for value in garment_delta.values()), (
                    'No actual garment motion', name, frame, garment_delta)
                samples.append({'frame': frame, 'body_displacement_from_rest': displacement,
                                'garment_displacement_from_rest': garment_delta,
                                'triangle_overlap_candidates': overlaps(body, pants, hoodie),
                                'bone_matrix_delta_from_rest': matrix_delta})
            chosen = max(samples, key=lambda sample: sample['body_displacement_from_rest'])
            assert chosen['body_displacement_from_rest'] > 1e-6, ('No actual female motion', name, samples)
            set_action(rig, source, chosen['frame'])
            proof = {'kind': 'female-source-action', 'track': source[0], 'strip': source[1],
                     'action': source[2].name, 'slot': getattr(source[3], 'identifier', None),
                     'action_frame_range': [start, end], 'samples': samples, 'render_frame': chosen['frame']}
        images = []
        for rear in [False, True]:
            path = EVIDENCE / f"{stage}-{name}-{'rear' if rear else 'front'}.png"
            # Straight front/rear, closer and higher resolution than first-run sheets.
            camera.location = (0, 3 if rear else -3, 1.25)
            from mathutils import Vector
            camera.rotation_euler = (Vector((0, 0, .7)) - camera.location).to_track_quat('-Z', 'Y').to_euler()
            for obj in bpy.context.scene.objects:
                if obj.type == 'MESH':
                    obj.hide_render = obj not in visible
            bpy.context.scene.render.filepath = str(path)
            bpy.ops.render.render(write_still=True)
            images.append(path.name)
        results.append({'pose': name, 'proof': proof, 'images': images,
                        'triangle_overlap_candidates': overlaps(body, pants, hoodie)})
    reset(rig)
    return results


def garment_contract(objects):
    return {o.name: {'vertices': len(o.data.vertices),
                     'edges': [list(e.vertices) for e in o.data.edges],
                     'faces': [list(p.vertices) for p in o.data.polygons],
                     'world_z': [(o.matrix_world @ v.co).z for v in o.data.vertices]}
            for o in objects}


def rig_contract(rig):
    return {'world': [list(row) for row in rig.matrix_world],
            'bones': {b.name: {'parent': b.parent.name if b.parent else None,
                               'rest': [list(row) for row in b.matrix_local]}
                      for b in rig.data.bones},
            'tracks': [(t.name, t.mute, [(s.name, s.action.name if s.action else None,
                         getattr(getattr(s, 'action_slot', None), 'identifier', None),
                         s.frame_start, s.frame_end) for s in t.strips])
                       for t in rig.animation_data.nla_tracks]}


def run(report, input_source=None, fitting=None, preserve_length=False):
    assert bpy.app.background, 'Never execute in interactive Blender'
    for path in [OUTPUT, SOURCE, EVIDENCE / 'report.json']:
        assert not path.exists(), ('Preserve prior correction', str(path))
    for directory in [OUTPUT.parent, SOURCE.parent, EVIDENCE]:
        directory.mkdir(parents=True, exist_ok=True)
    # Refuse overwrite of rendered evidence even if a previous invocation failed.
    assert not list(EVIDENCE.glob('*.png')), 'Existing correction renders'
    input_source = input_source or catalogue.SOURCE / 'female-catalogue.blend'
    fitting = fitting or fit
    before = protected_hashes()
    report['protected_before'] = before
    report['input_source'] = input_source.relative_to(ROOT).as_posix()
    try:
        old = json.loads((catalogue.EVIDENCE / 'report.json').read_text(encoding='utf-8'))['bodies']['female']
        manifest = json.loads((catalogue.OUT / 'catalogue.json').read_text(encoding='utf-8'))
        female = next(b for b in manifest['bodies'] if b['id'] == 'female')
        entry = next(e for e in old['entries'] if e['slot'] == 'top' and e['id'] == 'hoodie')
        bpy.ops.wm.open_mainfile(filepath=str(input_source),
                                 load_ui=False, use_scripts=False)
        bpy.context.preferences.filepaths.use_scripts_auto_execute = False
        bpy.context.preferences.filepaths.save_version = 0
        rig = bpy.data.objects['rig']
        hoodie = [bpy.data.objects[name] for name in entry['export_allowlist'] if name != rig.name]
        assert hoodie and all(o.type == 'MESH' for o in hoodie)
        body = bpy.data.objects['Body']
        body_meshes = [bpy.data.objects[name] for name in old['body_export_allowlist'] if name != rig.name]
        hair_entry = next(e for e in old['entries'] if e['slot'] == 'hair' and e['id'] == 'original')
        hair = [bpy.data.objects[name] for name in hair_entry['export_allowlist'] if name != rig.name]
        sources = action_sources(rig)
        original_rig = rig_contract(rig)
        original_mutes = {track.name: track.mute for track in rig.animation_data.nla_tracks}
        for obj in hoodie:
            assert all(mod.object == rig for mod in obj.modifiers if mod.type == 'ARMATURE')
            assert any(mod.type == 'ARMATURE' for mod in obj.modifiers)
        report['available_female_actions'] = [[s[0], s[1], s[2].name] for s in sources]
        reset(rig)
        untouched = {o.name: mesh_signature(o) for o in bpy.context.scene.objects
                     if o.type == 'MESH' and o not in hoodie}
        topology = garment_contract(hoodie)
        report['fit'] = fitting(hoodie, body, rig)
        assert untouched == {name: mesh_signature(bpy.data.objects[name]) for name in untouched}
        current = garment_contract(hoodie)
        for name, contract in topology.items():
            for key in ['vertices', 'edges', 'faces']:
                assert contract[key] == current[name][key], ('Topology changed', name, key)
            if preserve_length:
                delta = max(abs(a - b) for a, b in zip(contract['world_z'], current[name]['world_z']))
                assert delta < 1e-7, ('Garment length/Z changed', name, delta)
                report.setdefault('length_contract', {})[name] = {
                    'before_min_world_z': min(contract['world_z']),
                    'after_min_world_z': min(current[name]['world_z']),
                    'all_vertex_world_z_max_delta': delta,
                    'world_z_tolerance': 1e-7, 'vertex_count': contract['vertices']}
        report['rig_rest_unchanged'] = original_rig['bones'] == rig_contract(rig)['bones']
        assert report['rig_rest_unchanged']
        report['untouched_mesh_signatures'] = untouched
        report['hoodie_topology_unchanged'] = True
        audit, metrics = catalogue.export(OUTPUT, hoodie, rig)
        report['metrics'] = metrics
        assert not any(m['duplicate_triangle_candidates_1e-6'] for m in metrics)
        body_audit, _ = validation.inspect_glb(ROOT / 'public/models/avatars/female/body.glb')
        report['assembly'] = validation.compatible(body_audit, audit)
        assert not audit['clips'], 'Garment must not become animation root'
        bust = {g.name: sum(vg.weight for v in o.data.vertices for vg in v.groups if vg.group == g.index)
                for o in hoodie for g in o.vertex_groups if g.name.startswith('DEF-bust.')}
        assert all(bust.get(name, 0) > 0 for name in ['DEF-bust.L', 'DEF-bust.R']), bust
        report['bust_weight_totals'] = bust
        # Restore original track mute flags in editable source, not diagnostic pose.
        for track in rig.animation_data.nla_tracks:
            track.mute = original_mutes[track.name]
        assert original_rig == rig_contract(rig), 'Rig/bind/NLA contract changed'
        report['rig_and_clip_contract_unchanged'] = True
        source_visible = body_meshes + hair + hoodie
        for obj in bpy.context.scene.objects:
            if obj.type == 'MESH':
                obj.hide_render = obj not in source_visible
        bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE), check_existing=False, relative_remap=False)
        camera, _ = validation.setup_render()
        bpy.context.scene.render.resolution_x = 512
        bpy.context.scene.render.resolution_y = 640
        bpy.context.scene.cycles.samples = 24
        visible = body_meshes + hair + hoodie
        report['after'] = render_evidence(rig, body, visible, sources, 'after', camera)
        visible_names = [obj.name for obj in visible]
        # Reopen the unmodified candidate for exact same-source before comparisons.
        bpy.ops.wm.open_mainfile(filepath=str(input_source),
                                 load_ui=False, use_scripts=False)
        rig = bpy.data.objects['rig']
        body = bpy.data.objects['Body']
        visible = [bpy.data.objects[name] for name in visible_names]
        sources = action_sources(rig)
        camera, _ = validation.setup_render()
        bpy.context.scene.render.resolution_x = 512
        bpy.context.scene.render.resolution_y = 640
        bpy.context.scene.cycles.samples = 24
        report['before'] = render_evidence(rig, body, visible, sources, 'before', camera)
        replacement = next(e for e in female['tops'] if e['id'] == 'hoodie').copy()
        replacement.update(path='/' + OUTPUT.relative_to(ROOT / 'public').as_posix(),
                           assembly=report['assembly'], status='unaccepted-visual-review-required')
        write(EVIDENCE / 'replacement.json', replacement)
        report['status'] = 'structural-complete-visual-review-required'
    finally:
        report['protected_after'] = protected_hashes()
        report['protected_unchanged'] = before == report['protected_after']
        assert report['protected_unchanged'], 'Protected originals/candidates/evidence changed'


if __name__ == '__main__':
    report = {'status': 'running', 'pid': os.getpid(), 'blender': bpy.app.version_string,
              'argv': sys.argv, 'visual_verdict': 'NOT_ACCEPTED: parent must inspect actual images',
              'limits': ['No body deletion/hiding to conceal clipping.',
                         'Three action samples per clip, one rendered sample; not swept-motion proof.',
                         'BVH overlap counts are not signed clearance or visual acceptance.',
                         'No browser/runtime validation.']}
    try:
        run(report)
    except BaseException:
        report['status'] = 'failed-no-retry'
        report['error'] = traceback.format_exc()
        raise
    finally:
        if EVIDENCE.exists() and not (EVIDENCE / 'report.json').exists():
            write(EVIDENCE / 'report.json', report)
