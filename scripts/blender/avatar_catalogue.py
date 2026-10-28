"""T3 isolated authoring/export entrypoint; run via avatar_catalogue_run.py.

Only in-project inputs. Explicit mesh/rig selection on every GLB export.
Catalogue is a candidate until rendered fit and motion are accepted by humans.
"""
from pathlib import Path
import hashlib
import json
import os
import sys
import traceback

import bpy
from mathutils.bvhtree import BVHTree

ROOT = Path(__file__).resolve().parents[2]
sys.dont_write_bytecode = True
sys.path.insert(0,str(Path(__file__).resolve().parent))
import avatar_catalogue_geometry as geo
import avatar_catalogue_validation as validation
from avatar_prepare import glb_audit, compare

OUT = ROOT/'public/models/avatars'
SOURCE = ROOT/'assets/blender/avatars/catalogue'
EVIDENCE = ROOT/'odd/artifacts/avatar-customization/catalogue'
KEEP = ['Body','Head','Pants','boots','ears','eyes','smile']
ORIGINALS = ['assets/blender/character-base.blend','public/models/character.glb',
             'public/models/hair/afro-01.glb','public/models/hair/dreads-01.glb',
             'public/models/clothing/hoodie-01.glb','public/models/clothing/shirt-01.glb',
             'assets/blender/avatars/male-editable.blend','assets/blender/avatars/female-editable.blend']
HAIR = {'male':['classic-short','fade','afro','dreads','long-tied'],
        'female':['original','bob','high-ponytail','bun','afro']}
TOP = {'male':['tshirt','hoodie','shirt','tank','jacket'],
       'female':['tshirt','hoodie','blouse','tank','jacket']}
ACCESSORY = {'male':['round-glasses','square-glasses','cap','headphones','backpack'],
             'female':['glasses','cap','headphones','earrings','handbag']}
LABELS = {'classic-short':'Corto clásico','fade':'Degradado','afro':'Afro','dreads':'Rastas',
          'long-tied':'Largo recogido','original':'Original','bob':'Bob','high-ponytail':'Cola alta',
          'bun':'Rodete','tshirt':'Remera','hoodie':'Buzo con capucha','shirt':'Camisa','blouse':'Blusa',
          'tank':'Musculosa','jacket':'Campera','round-glasses':'Anteojos redondos',
          'square-glasses':'Anteojos cuadrados','cap':'Gorra','headphones':'Auriculares',
          'backpack':'Mochila','glasses':'Anteojos','earrings':'Aros','handbag':'Cartera'}


def hashes():
    return {p:hashlib.sha256((ROOT/p).read_bytes()).hexdigest() for p in ORIGINALS}


def write_json(path, value):
    path.write_text(json.dumps(value,indent=2,ensure_ascii=False,allow_nan=False)+'\n',encoding='utf-8')


def select(objects):
    bpy.ops.object.select_all(action='DESELECT')
    for obj in objects:
        obj.hide_set(False)
        obj.hide_viewport = False
        obj.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]


def export(path, objects, rig, animated=False):
    assert objects and all(o.type=='MESH' for o in objects)
    assert all(not o.name.startswith(('WGT','Icosphere','REF_')) for o in objects)
    select([rig]+objects)
    bpy.ops.export_scene.gltf(filepath=str(path),export_format='GLB',use_selection=True,
                              export_animations=animated,export_animation_mode='NLA_TRACKS',
                              export_force_sampling=True,export_def_bones=False,
                              export_skins=True,export_morph=True,export_yup=True,
                              export_materials='EXPORT',export_extras=False)
    return validation.inspect_glb(path)


def duplicate(obj, name):
    result = obj.copy()
    result.data = obj.data.copy()
    result.name = name
    bpy.context.collection.objects.link(result)
    return result


def neutralize(objects, mat):
    for obj in objects:
        obj.data.materials.clear()
        obj.data.materials.append(mat)
        for poly in obj.data.polygons:
            poly.material_index = 0


def optimize(obj, ratio):
    """Conservative collapse on duplicate only, with bidirectional sampled error."""
    before = [v.co.copy() for v in obj.data.vertices]
    old_tree = BVHTree.FromPolygons(before,[tuple(p.vertices) for p in obj.data.polygons])
    old_triangles = sum(len(p.vertices)-2 for p in obj.data.polygons)
    select([obj])
    mod = obj.modifiers.new('Catalogue conservative simplification','DECIMATE')
    mod.ratio = ratio
    bpy.ops.object.modifier_apply(modifier=mod.name)
    after = [v.co.copy() for v in obj.data.vertices]
    new_tree = BVHTree.FromPolygons(after,[tuple(p.vertices) for p in obj.data.polygons])
    distances = [new_tree.find_nearest(v)[3] for v in before[::max(1,len(before)//2000)]]
    distances += [old_tree.find_nearest(v)[3] for v in after[::max(1,len(after)//2000)]]
    return {'triangles_before':old_triangles,'triangles_after':sum(len(p.vertices)-2 for p in obj.data.polygons),
            'sampled_surface_error_local_max':max(distances),'samples':len(distances),
            'limit':'Sampled geometric deviation, not Hausdorff bound or style/weight acceptance.'}


def existing_module(path, rig, female=False, garment=False):
    previous = set(bpy.context.scene.objects)
    bpy.ops.import_scene.gltf(filepath=str(ROOT/path))
    added = set(bpy.context.scene.objects)-previous
    meshes = [o for o in added if o.type=='MESH' and not o.name.startswith('Icosphere')]
    assert len(meshes)==1, [o.name for o in meshes]
    for obj in meshes:
        old_rig = next(m.object for m in obj.modifiers if m.type=='ARMATURE')
        # Numeric world-rest validation BEFORE reassigning the canonical rig.
        for bone in old_rig.data.bones:
            if bone.name in rig.data.bones:
                a = old_rig.matrix_world @ bone.matrix_local
                b = rig.matrix_world @ rig.data.bones[bone.name].matrix_local
                assert max(abs(a[r][c]-b[r][c]) for r in range(4) for c in range(4))<1e-5
        world = obj.matrix_world.copy()
        obj.parent = rig
        obj.matrix_world = world
        for mod in obj.modifiers:
            if mod.type=='ARMATURE':
                mod.object = rig
        if female and garment:
            for v in obj.data.vertices:
                p = obj.matrix_world @ v.co
                if abs(p.x)<.22 and .43<p.z<.76:
                    # Female bust depth differs; fit front independently from back.
                    p.y *= 1.22 if p.y<0 else 1.13
                    v.co = obj.matrix_world.inverted() @ p
    for obj in added:
        if obj not in meshes:
            obj.hide_render = True
            obj.hide_set(True)
    if female and garment:
        from avatar_catalogue_hoodie import fit
        from avatar_catalogue_hoodie_hem import fit as fit_hem
        fit(meshes, bpy.data.objects['Body'], rig)
        fit_hem(meshes, bpy.data.objects['Body'], bpy.data.objects['Pants'], rig)
    return meshes


def build(body_id, report):
    female = body_id=='female'
    if female:
        bpy.ops.wm.open_mainfile(filepath=str(ROOT/'assets/blender/avatars/female-editable.blend'),load_ui=False,use_scripts=False)
    else:
        bpy.ops.wm.read_factory_settings(use_empty=True)
        bpy.ops.import_scene.gltf(filepath=str(ROOT/'public/models/character.glb'))
    bpy.context.preferences.filepaths.use_scripts_auto_execute = False
    rig = bpy.data.objects['rig']
    body_meshes = [bpy.data.objects[name] for name in KEEP+(['Eyelashes'] if female else [])]
    for obj in bpy.context.scene.objects:
        obj.hide_render = obj not in body_meshes
    (OUT/body_id).mkdir(parents=True,exist_ok=True)
    source_path = SOURCE/f'{body_id}-catalogue.blend'
    body_path = OUT/body_id/'body.glb'
    body_audit, body_metrics = export(body_path,body_meshes,rig,True)
    expected = 13 if female else 17
    assert len(body_audit['clips'])==expected, ('Animation count',len(body_audit['clips']),expected)
    if female:
        assert len(body_audit['skins'][0]['joints'])==41, 'Female extra bones lost'
    body_report = {'body_metrics':body_metrics,'clips':[c['name'] for c in body_audit['clips']],
                   'body_export_allowlist':[o.name for o in body_meshes]+[rig.name], 'entries':[]}
    report['bodies'][body_id] = body_report
    hair_mat = geo.material('AvatarHairTint',(1,1,1),.65)
    cloth_mat = geo.material('AvatarTopTint',(1,1,1),.85)
    accessory_mat = geo.material('AvatarAccessoryTint',(1,1,1),.7)
    detail = geo.material('AvatarDetail',(.22,.17,.23),.8)
    entries = []
    for slot, ids in [('hair',HAIR[body_id]),('top',TOP[body_id]),('accessory',ACCESSORY[body_id])]:
        for identity in ids:
            optimization = None
            mat = {'hair':hair_mat,'top':cloth_mat,'accessory':accessory_mat}[slot]
            if slot=='hair':
                if identity=='original':
                    objects = [duplicate(bpy.data.objects['Hair'],'Original hair')]
                    optimization = optimize(objects[0],.4)
                    neutralize(objects,mat)
                elif identity in ('afro','dreads'):
                    file = 'afro-01' if identity=='afro' else 'dreads-01'
                    objects = existing_module(f'public/models/hair/{file}.glb',rig)
                    neutralize(objects,mat)
                else:
                    objects = geo.hair_style(identity,mat,detail)
                    geo.rigid(objects,rig)
            elif slot=='top':
                if identity=='hoodie':
                    objects = existing_module('public/models/clothing/hoodie-01.glb',rig,female,True)
                    neutralize(objects,mat)
                elif identity=='tank' and female:
                    objects = [duplicate(bpy.data.objects['Top'],'Original fitted tank')]
                    optimization = optimize(objects[0],.25)
                    neutralize(objects,mat)
                else:
                    sleeves = {'tank':0,'tshirt':.16,'shirt':.24,'blouse':.22,'jacket':.34}[identity]
                    objects = [geo.garment(identity,female,sleeves,mat)]
                    if identity in ('shirt','blouse','jacket'):
                        y = -.29 if female else -.23
                        objects.append(geo.tube('Placket',[(0,y,.49),(0,y-.005,.61),(0,y,.72)],.008,detail))
                        objects.append(geo.tube('Folded collar',[(-.11,y+.035,.73),(-.065,y-.01,.68),(0,y,.735),(.065,y-.01,.68),(.11,y+.035,.73)],.014,mat))
                        if identity=='jacket':
                            for s in [-1,1]:
                                objects.append(geo.tube('Pocket welt',[(s*.07,y,.54),(s*.14,y+.015,.57)],.009,detail))
                        elif identity=='blouse':
                            objects.append(geo.ellipse('Blouse bow',(0,y-.01,.70),(.045,.018),detail,'XZ'))
                    geo.transfer(objects,bpy.data.objects['Body'],rig)
            else:
                objects = geo.accessories(identity,mat,detail)
                bone = 'DEF-spine.002' if identity=='backpack' else 'DEF-hand.L' if identity=='handbag' else 'DEF-spine.006'
                geo.rigid(objects,rig,bone)
            assert objects
            for obj in objects:
                obj.hide_render = True
            path = OUT/body_id/f'{slot}-{identity}.glb'
            audit, metrics = export(path,objects,rig)
            assembly = validation.compatible(body_audit,audit)
            entry = {'id':identity,'label':LABELS[identity],'path':'/'+path.relative_to(ROOT/'public').as_posix(),
                     'slot':slot,'tintMaterials':[mat.name],
                     'detailMaterials':sorted({m.name for o in objects for m in o.data.materials if m and m!=mat}),
                     'assembly':assembly}
            entries.append({**entry,'objects':objects})
            body_report['entries'].append({**entry,'metrics':metrics,'optimization':optimization,
                                           'export_allowlist':[o.name for o in objects]+[rig.name]})
    # Sources include all alternatives; export always uses the allowlist above.
    for obj in bpy.context.scene.objects:
        if obj.type=='MESH':
            obj.hide_render = obj not in body_meshes+entries[0]['objects']+entries[5]['objects']
    bpy.context.scene['provenance'] = 'Female export reconstruction, not recovered authoring history' if female else 'Original character.glb import; original preserved'
    bpy.context.scene['catalogue_status'] = 'Candidate: visual and animated fit not yet accepted'
    bpy.context.preferences.filepaths.save_version = 0
    bpy.ops.wm.save_as_mainfile(filepath=str(source_path),check_existing=False,relative_remap=False)
    body_report['visual_evidence'] = validation.evidence(body_id,rig,body_meshes,entries,EVIDENCE)
    return {'id':body_id,'path':'/'+body_path.relative_to(ROOT/'public').as_posix(),
            'rigFamily':f'{body_id}-v1','hair':[e for e in entries if e['slot']=='hair'],
            'tops':[e for e in entries if e['slot']=='top'],'accessories':[e for e in entries if e['slot']=='accessory']}


def run():
    assert bpy.app.background
    assert not (OUT/'catalogue.json').exists(), 'Preserve existing catalogue'
    for folder in [OUT,SOURCE,EVIDENCE]:
        folder.mkdir(parents=True,exist_ok=True)
    before = hashes()
    report = {'status':'running','originals_before':before,'blender':bpy.app.version_string,'bodies':{},
              'limits':['No body topology removed: clothing interchangeability forbids blind hidden-face deletion.',
                        'No exhaustive animation/combination clearance proof; rendered candidates require review.']}
    try:
        bodies = [build(identity,report) for identity in ['male','female']]
        for body in bodies:
            for slot in ['hair','tops','accessories']:
                assert len(body[slot])==5
                for entry in body[slot]:
                    entry.pop('objects')
        catalogue = {'version':1,'status':'candidate-unaccepted','bodies':bodies,
                     'assembly':{'contract':'One body rig and AnimationMixer per avatar. Modules are not animation roots.',
                                 'transforms':'Retain authored transforms; apply world placement/scale to one common parent.',
                                 'slots':'One hair, one top, zero or one accessory. none is a UI option, not an asset.',
                                 'bodyMeshes':KEEP,'femaleAdditionalMeshes':['Eyelashes'],
                                 'fallback':'Keep original baseline until candidate fit is accepted; never hide Body to mask clipping.'}}
        write_json(OUT/'catalogue.json',catalogue)
        duplicates = [(body_id,entry['id'],metric['name'],metric['duplicate_triangle_candidates_1e-6'])
                      for body_id,body in report['bodies'].items() for entry in body['entries']
                      for metric in entry['metrics'] if metric['duplicate_triangle_candidates_1e-6']]
        report['duplicate_face_failures'] = duplicates
        assert not duplicates, ('Duplicate face candidates require inspection',duplicates)
        report['status'] = 'structural-export-complete-visual-review-required'
    finally:
        report['originals_after'] = hashes()
        report['originals_unchanged'] = before==report['originals_after']
        write_json(EVIDENCE/'report.json',report)
        assert report['originals_unchanged']
    print('CATALOGUE_EXPORT_COMPLETE: candidate only; inspect rendered evidence before acceptance',flush=True)


if __name__=='__main__':
    try:
        run()
    except BaseException:
        traceback.print_exc()
        sys.stdout.flush()
        sys.stderr.flush()
        os._exit(1)
