"""Structural validation and render evidence, independent of catalogue design.

Uses T1's bounded embedded-GLB reader; never imports its external female input.
Collision candidates and selected rendered poses are evidence, not acceptance.
"""
from array import array
import math
from pathlib import Path
import struct
import json
import bpy
from mathutils import Vector, Quaternion
from mathutils.bvhtree import BVHTree
from avatar_prepare import glb_audit, compare, matrix_from, delta


def inspect_glb(path):
    audit = glb_audit(path)
    raw = Path(path).read_bytes()
    json_size = struct.unpack_from('<I', raw, 12)[0]
    doc = json.loads(raw[20:20+json_size])
    start = 20+json_size
    binary = raw[start+8:]

    def values(index):
        a = doc['accessors'][index]
        v = doc['bufferViews'][a['bufferView']]
        count = {'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4,'MAT4':16}[a['type']]
        code = {5121:'B',5123:'H',5125:'I',5126:'f'}[a['componentType']]
        fmt = '<'+code*count
        stride = v.get('byteStride',struct.calcsize(fmt))
        offset = v.get('byteOffset',0)+a.get('byteOffset',0)
        rows = [struct.unpack_from(fmt,binary,offset+i*stride) for i in range(a['count'])]
        if a.get('normalized'):
            divisor = {5121:255,5123:65535}[a['componentType']]
            rows = [tuple(x/divisor for x in row) for row in rows]
        assert all(math.isfinite(x) for row in rows for x in row)
        return rows

    metrics = []
    for node in doc['nodes']:
        if 'mesh' not in node:
            continue
        triangles, duplicates, invalid_weights = 0, 0, 0
        face_keys = set()
        for primitive in doc['meshes'][node['mesh']]['primitives']:
            attrs = primitive['attributes']
            positions = values(attrs['POSITION'])
            indices = [v[0] for v in values(primitive['indices'])] if 'indices' in primitive else list(range(len(positions)))
            assert primitive.get('mode',4) == 4 and len(indices)%3 == 0
            triangles += len(indices)//3
            for i in range(0,len(indices),3):
                key = tuple(sorted(tuple(round(x,6) for x in positions[j]) for j in indices[i:i+3]))
                duplicates += key in face_keys
                face_keys.add(key)
            # Facial meshes may be rigid bone children rather than skinned meshes.
            # Only a node declaring a skin is required to carry skin attributes.
            if 'skin' not in node:
                assert 'JOINTS_0' not in attrs and 'WEIGHTS_0' not in attrs, node['name']
                continue
            assert 'JOINTS_0' in attrs and 'WEIGHTS_0' in attrs, node['name']
            joints, weights = values(attrs['JOINTS_0']), values(attrs['WEIGHTS_0'])
            size = len(doc['skins'][node['skin']]['joints'])
            for js, ws in zip(joints,weights):
                invalid_weights += abs(sum(ws)-1)>1e-4 or min(ws)<0 or any(j>=size for j in js)
            assert invalid_weights == 0, (node['name'],invalid_weights)
        metrics.append({'name':node['name'],'triangles':triangles,'duplicate_triangle_candidates_1e-6':duplicates,
                        'invalid_weights':invalid_weights})
    for skin in audit['skins']:
        names = [j['name'] for j in skin['joints']]
        assert len(names)==len(set(names))
        for joint in skin['joints']:
            residual = delta(joint['world_rest_times_inverse_bind'],[[int(r==c) for c in range(4)] for r in range(4)])
            assert residual < 1e-5, (joint['name'],residual)
    for clip in doc.get('animations',[]):
        assert clip['channels']
        for sampler in clip['samplers']:
            times = values(sampler['input'])
            assert times and all(a[0]<b[0] for a,b in zip(times,times[1:]))
            assert values(sampler['output'])
    return audit, metrics


def compatible(body_audit, module_audit):
    result = compare(body_audit,module_audit)
    assert not result['right_only_joints'], result['right_only_joints']
    assert result['shared_joints'] > 0
    for joint in result['joint_differences']:
        assert joint['parent_equal'] and joint['rest_max_abs_delta'] < 1e-5 and joint['inverse_bind_max_abs_delta'] < 1e-5, joint
    return {'ordered_joints':[[j['name'] for j in s['joints']] for s in module_audit['skins']],
            'remap':'Map names in each module skin order to this body; preserve module inverse binds and mesh bind transforms; reject mismatches at 1e-5. Never substitute differently sized body Skeleton.',
            'shared_joints':result['shared_joints'], 'tolerance':1e-5}


def collision_candidates(body, pieces):
    depsgraph = bpy.context.evaluated_depsgraph_get()
    def tree(obj):
        evaluated = obj.evaluated_get(depsgraph)
        data = evaluated.to_mesh()
        vertices = [evaluated.matrix_world @ v.co for v in data.vertices]
        polygons = [tuple(p.vertices) for p in data.polygons]
        result = BVHTree.FromPolygons(vertices, polygons)
        evaluated.to_mesh_clear()
        return result
    target = tree(body)
    return {p.name:len(target.overlap(tree(p))) for p in pieces}


def setup_render():
    scene = bpy.context.scene
    scene.render.engine = 'CYCLES'
    scene.cycles.device = 'CPU'
    scene.cycles.samples = 8
    scene.cycles.use_denoising = False
    scene.render.resolution_x, scene.render.resolution_y = 256, 320
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = 'PNG'
    scene.world = bpy.data.worlds.new('Evidence world')
    scene.world.use_nodes = True
    scene.world.node_tree.nodes['Background'].inputs[0].default_value = (.35,.38,.45,1)
    scene.world.node_tree.nodes['Background'].inputs[1].default_value = .7
    scene.view_settings.view_transform = 'Standard'
    lights = []
    for loc,power,size in [((2,-3,4),350,4),((-2,-1,2),150,3),((0,3,3),220,3)]:
        data = bpy.data.lights.new('Evidence softbox','AREA')
        data.energy, data.shape, data.size = power,'DISK',size
        obj = bpy.data.objects.new('Evidence softbox',data)
        scene.collection.objects.link(obj)
        obj.location = loc
        obj.rotation_euler = (Vector((0,0,.7))-obj.location).to_track_quat('-Z','Y').to_euler()
        lights.append(obj)
    data = bpy.data.cameras.new('Evidence camera')
    camera = bpy.data.objects.new('Evidence camera',data)
    scene.collection.objects.link(camera)
    camera.data.type, camera.data.ortho_scale = 'ORTHO',1.9
    scene.camera = camera
    return camera, lights


def render(camera, meshes, path, rear=False):
    for obj in bpy.context.scene.objects:
        if obj.type == 'MESH':
            obj.hide_render = obj not in meshes
    camera.location = (2,3 if rear else -3,2.0)
    camera.rotation_euler = (Vector((0,0,.75))-camera.location).to_track_quat('-Z','Y').to_euler()
    bpy.context.scene.render.filepath = str(path)
    bpy.ops.render.render(write_still=True)
    image = bpy.data.images.load(str(path),check_existing=False)
    pixels = array('f',[0])*(256*320*4)
    image.pixels.foreach_get(pixels)
    return pixels


def evidence(body_id, rig, body_meshes, entries, folder):
    camera, lights = setup_render()
    # Disable all imported animation before rest catalogue renders.
    animated = [o for o in [rig]+body_meshes if o.animation_data]
    for obj in animated:
        obj.animation_data.action = None
        for track in obj.animation_data.nla_tracks:
            track.mute = True
    for bone in rig.pose.bones:
        bone.matrix_basis.identity()
    bpy.context.scene.frame_set(1)
    sheets = array('f',[.94,.94,.96,1])*(1280*960)
    ordering = []
    defaults = entries[0]['objects']+entries[5]['objects']
    for index,entry in enumerate(entries):
        selected = entry['objects']
        if entry['slot']=='hair':
            selected = selected+entries[5]['objects']
        elif entry['slot']=='top':
            selected = selected+entries[0]['objects']
        else:
            selected = selected+defaults
        path = folder / f"{body_id}-{entry['slot']}-{entry['id']}.png"
        pixels = render(camera,body_meshes+selected,path)
        col,row = index%5,2-index//5
        for y in range(320):
            a = ((row*320+y)*1280+col*256)*4
            sheets[a:a+1024] = pixels[y*1024:(y+1)*1024]
        ordering.append({'cell':[index//5,index%5],'slot':entry['slot'],'id':entry['id'],'image':path.name})
    image = bpy.data.images.new(f'{body_id} contact sheet',width=1280,height=960)
    image.pixels.foreach_set(sheets)
    image.filepath_raw, image.file_format = str(folder/f'{body_id}-contact-sheet.png'),'PNG'
    image.save()
    poses = []
    # Representative original hair + hoodie, not exhaustive 125 combinations.
    pieces = entries[0]['objects']+entries[6]['objects']+entries[12]['objects']
    body = next(o for o in body_meshes if o.name=='Body')
    for name,frame in [('Idle',24),('Walk',7),('Sit',55),('raised-arm',1)]:
        for obj in animated:
            for track in obj.animation_data.nla_tracks:
                track.mute = name not in track.name
        for bone in rig.pose.bones:
            bone.matrix_basis.identity()
        bpy.context.scene.frame_set(frame)
        if name == 'raised-arm':
            bone = rig.pose.bones['DEF-upper_arm.L']
            bone.rotation_mode = 'QUATERNION'
            bone.rotation_quaternion = Quaternion((0,1,0),-1.3)
            bpy.context.view_layer.update()
        images = []
        for rear in [False,True]:
            path = folder/f"{body_id}-{name}-{'rear' if rear else 'front'}.png"
            render(camera,body_meshes+pieces,path,rear)
            images.append(path.name)
        poses.append({'pose':name,'frame':frame,'images':images,
                      'body_triangle_overlap_candidates':collision_candidates(body,pieces)})
    return {'contact_sheet_order':ordering,'poses':poses,
            'limits':['Rest renders and four representative poses only; no exhaustive combination or swept-motion proof.',
                      'BVH overlap counts are intersection candidates, not signed clearance; no hidden-surface removal inferred.',
                      'Manual raised-arm test is a diagnostic deformation, not a preserved animation clip.',
                      'Images require visual review; structural pass is not visual acceptance.']}
