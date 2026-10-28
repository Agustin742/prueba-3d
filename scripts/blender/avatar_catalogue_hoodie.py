"""Female-only hoodie tailoring; no IO and no changes to the body or rig.

Input is the legacy female hoodie after existing_module's initial depth fit.
Use the same helper for correction and future catalogue generation.
"""
import math
import bpy
from mathutils import Vector
from mathutils.bvhtree import BVHTree
from mathutils.geometry import barycentric_transform


def fit(objects, body, rig):
    """Fit torso radially to actual rest body, then interpolate its skin weights.

    Sleeves, hood, cuffs, topology and materials stay intact. Ray queries are
    construction aids, NOT a visual clearance verdict or swept-motion proof.
    """
    assert {'DEF-bust.L', 'DEF-bust.R'} <= set(rig.data.bones.keys())
    body.data.calc_loop_triangles()
    vertices = [body.matrix_world @ v.co for v in body.data.vertices]
    triangles = [tuple(t.vertices) for t in body.data.loop_triangles]
    tree = BVHTree.FromPolygons(vertices, triangles, all_triangles=True)
    stats = []
    for obj in objects:
        inverse = obj.matrix_world.inverted()
        groups = {g.name: g for g in obj.vertex_groups}
        for group in body.vertex_groups:
            if group.name in rig.data.bones and group.name not in groups:
                groups[group.name] = obj.vertex_groups.new(name=group.name)
        moved, weighted, maximum = 0, 0, 0.0
        for vertex in obj.data.vertices:
            point = obj.matrix_world @ vertex.co
            # Torso only: never expand sleeves, hood, head or the whole avatar.
            if not (.43 < point.z < .79 and abs(point.x) < .235):
                continue
            direction = Vector((point.x, point.y + .015, 0))
            if direction.length < 1e-6:
                continue
            direction.normalize()
            origin = Vector((0, -.015, point.z))
            hit, normal, index, distance = tree.ray_cast(origin + direction * .65, -direction, .65)
            if hit is None or abs(hit.x) > .24:
                continue
            body_radius = (hit - origin).dot(direction)
            radius = (point - origin).dot(direction)
            # 14 mm ease over the female surface, no inward shrink or global scale.
            ease = .014
            target = origin + direction * max(radius, body_radius + ease)
            shift = (target - point).length
            assert shift < .18, ('Unexpected torso correction', obj.name, vertex.index, shift)
            vertex.co = inverse @ target
            moved += shift > 1e-7
            maximum = max(maximum, shift)
            # Barycentric body weights at ray-hit triangle, including bust bones.
            triangle = triangles[index]
            a, b, c = [vertices[i] for i in triangle]
            bary = barycentric_transform(hit, a, b, c,
                                         Vector((1, 0, 0)), Vector((0, 1, 0)), Vector((0, 0, 1)))
            weights = {}
            for source_index, coefficient in zip(triangle, bary):
                for item in body.data.vertices[source_index].groups:
                    name = body.vertex_groups[item.group].name
                    if name in groups and name in rig.data.bones:
                        weights[name] = weights.get(name, 0) + max(0, coefficient) * item.weight
            weights = sorted(weights.items(), key=lambda item: -item[1])[:4]
            total = sum(weight for _, weight in weights)
            assert total > 0
            for group in obj.vertex_groups:
                group.remove([vertex.index])
            for name, weight in weights:
                if weight > 0:
                    groups[name].add([vertex.index], weight / total, 'REPLACE')
            weighted += 1
        obj.data.update()
        assert weighted and moved, ('No torso fit applied', obj.name)
        stats.append({'object': obj.name, 'moved_vertices': moved,
                      'reweighted_vertices': weighted, 'max_shift_world': maximum,
                      'ease_world': .014})
    bpy.context.view_layer.update()
    return stats
