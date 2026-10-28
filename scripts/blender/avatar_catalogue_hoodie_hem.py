"""Length-preserving lower-band tailoring against rest Body AND Pants.

No IO, topology edits, body edits, modifiers, scaling or pose baking. The
chest-corrected hoodie is the input; z >= BAND_TOP stays byte-for-byte intact.
Radial queries construct a local envelope, not a motion/visual acceptance test.
"""
import math
from collections import Counter

import bpy
from mathutils import Vector
from mathutils.bvhtree import BVHTree
from mathutils.geometry import barycentric_transform

BAND_TOP = .57
FULL_BAND = .50
EASE = .014
MAX_SHIFT = .18


def surface(obj):
    obj.data.calc_loop_triangles()
    points = [obj.matrix_world @ v.co for v in obj.data.vertices]
    triangles = [tuple(t.vertices) for t in obj.data.loop_triangles]
    return obj, points, triangles, BVHTree.FromPolygons(points, triangles, all_triangles=True)


def radial(point):
    origin = Vector((0, -.015, point.z))
    direction = point - origin
    assert direction.length > 1e-6, ('Hem on radial axis', list(point))
    return origin, direction.normalized(), direction.length


def envelope(point, surfaces):
    origin, direction, radius = radial(point)
    hits = []
    for obj, points, triangles, tree in surfaces:
        hit, normal, index, distance = tree.ray_cast(origin + direction * .65, -direction, .65)
        if hit is not None:
            hits.append(((hit - origin).dot(direction), obj, hit, triangles[index], points))
    assert hits, ('No Body/Pants surface under hem', list(point))
    return max(hits, key=lambda hit: hit[0])


def fade(z):
    t = max(0, min(1, (BAND_TOP - z) / (BAND_TOP - FULL_BAND)))
    return t * t * (3 - 2 * t)


def transfer(obj, vertex, hit, rig):
    radius, source, point, triangle, points = hit
    a, b, c = [points[i] for i in triangle]
    bary = barycentric_transform(point, a, b, c,
                                 Vector((1, 0, 0)), Vector((0, 1, 0)), Vector((0, 0, 1)))
    weights = Counter()
    for index, coefficient in zip(triangle, bary):
        for item in source.data.vertices[index].groups:
            name = source.vertex_groups[item.group].name
            if name in rig.data.bones:
                weights[name] += max(0, coefficient) * item.weight
    old = {obj.vertex_groups[g.group].name: g.weight for g in vertex.groups}
    blend = fade((obj.matrix_world @ vertex.co).z)
    total = sum(weights.values())
    assert total > 0, ('Unweighted envelope surface', source.name, vertex.index)
    mixed = {name: blend * weights.get(name, 0) / total + (1 - blend) * old.get(name, 0)
             for name in set(weights) | set(old) if name in rig.data.bones}
    best = sorted(mixed.items(), key=lambda item: (-item[1], item[0]))[:4]
    total = sum(weight for name, weight in best)
    assert total > 0
    for group in obj.vertex_groups:
        group.remove([vertex.index])
    for name, weight in best:
        if weight > 0:
            group = obj.vertex_groups.get(name) or obj.vertex_groups.new(name=name)
            group.add([vertex.index], weight / total, 'REPLACE')
    return source.name


def interpolate_band(original, shifts):
    """Continuous periodic ease field, shared by inner/outer authored band rings.

    Interpolate radial OFFSETS, not radii: retain the authored thickness instead
    of projecting every layer onto the same Pants radius. Knots carry measured
    local requirements; no global scale or uniform inflation is introduced.
    """
    knots, cells = {}, {}
    for i in shifts:
        p = original[i]
        angle = (math.atan2(p.y + .015, p.x) % math.tau) * 64 / math.tau
        height = p.z / .01
        a, z = math.floor(angle), math.floor(height)
        cells[i] = (a, z, angle - a, height - z)
        for da, dz in [(0, 0), (1, 0), (0, 1), (1, 1)]:
            key = ((a + da) % 64, z + dz)
            knots[key] = max(knots.get(key, 0), shifts[i])
    return {i: sum(knots[((a + da) % 64, z + dz)] * wa * wz
                   for da, wa in [(0, 1 - u), (1, u)]
                   for dz, wz in [(0, 1 - v), (1, v)]) * fade(original[i].z)
            for i, (a, z, u, v) in cells.items()}


def fit(objects, body, pants, rig):
    surfaces = [surface(body), surface(pants)]
    results = []
    for obj in objects:
        original = [obj.matrix_world @ v.co for v in obj.data.vertices]
        # Only the authored lower torso band; guard against an unexpected asset.
        band = {i for i, p in enumerate(original) if p.z < BAND_TOP}
        assert band and min(original[i].z for i in band) < .43, 'Unexpected hoodie hem height'
        assert all(abs(original[i].x) < .38 for i in band), 'Lower band includes sleeves: manual authoring needed'
        directions = {i: radial(original[i])[1] for i in band}
        shifts = {i: 0.0 for i in band}
        neighbors = {i: set() for i in band}
        for edge in obj.data.edges:
            a, b = edge.vertices
            if a in band and b in band:
                neighbors[a].add(b)
                neighbors[b].add(a)
        for i in band:
            shifts[i] = max(0, envelope(original[i], surfaces)[0] + EASE - radial(original[i])[2]) * fade(original[i].z)
        # Interpolate the authored lower band with an outward-only graph envelope.
        # This preserves ring connectivity, inner/outer seam pairs and all Z values.
        # Do not average positions inward across the convex Pants silhouette.
        for iteration in range(4):
            shifts = {i: max(shifts[i], sum(shifts[j] for j in neighbors[i]) / len(neighbors[i])
                             * fade(original[i].z)) if neighbors[i] else shifts[i] for i in band}
        field = interpolate_band(original, shifts)
        shifts = {i: max(shifts[i], field[i]) for i in band}
        obj.data.calc_loop_triangles()
        triangles = [tuple(t.vertices) for t in obj.data.loop_triangles
                     if all(i in band for i in t.vertices)]
        # Constrain face interiors/edges too: vertex clearance alone leaves chords
        # through rounded hips. Finite barycentric lattice, explicitly not a proof.
        lattice = [(a / 6, b / 6, 1 - (a + b) / 6)
                   for a in range(7) for b in range(7 - a)]
        residual = 0.0
        for iteration in range(24):
            positions = {i: original[i] + directions[i] * shifts[i] for i in band}
            increments = {i: 0.0 for i in band}
            residual = 0.0
            for triangle in triangles:
                for bary in lattice:
                    point = sum((positions[i] * w for i, w in zip(triangle, bary)), Vector())
                    if point.z > FULL_BAND:
                        continue
                    deficit = envelope(point, surfaces)[0] + EASE - radial(point)[2]
                    residual = max(residual, deficit)
                    if deficit <= .0002:
                        continue
                    direction = radial(point)[1]
                    influence = sum(w * directions[i].dot(direction) * fade(original[i].z)
                                    for i, w in zip(triangle, bary))
                    assert influence > .25, 'Hem facet spans axis: topology-preserving fit not viable'
                    for i, w in zip(triangle, bary):
                        if w > 0:
                            increments[i] = max(increments[i], deficit / influence * fade(original[i].z))
            if residual <= .0002:
                break
            field = interpolate_band(original, increments)
            shifts = {i: shifts[i] + max(increments[i], field[i]) for i in band}
            assert max(shifts.values()) < MAX_SHIFT, 'Product blocker: hem needs excessive ease at fixed length/topology'
        assert residual <= .0002, ('Product blocker: fixed-topology hem lattice did not converge', residual)
        inverse = obj.matrix_world.inverted()
        donors = Counter()
        for i in sorted(band):
            target = original[i] + directions[i] * shifts[i]
            assert target.z == original[i].z
            obj.data.vertices[i].co = inverse @ target
            donors[transfer(obj, obj.data.vertices[i], envelope(target, surfaces), rig)] += 1
        obj.data.update()
        assert max(shifts.values()) < MAX_SHIFT
        totals = Counter()
        for i in band:
            for item in obj.data.vertices[i].groups:
                totals[obj.vertex_groups[item.group].name] += item.weight
        assert any(value > 0 for name, value in totals.items()
                   if name.startswith(('DEF-pelvis', 'DEF-glute'))), 'No pelvic/gluteal lower-band influence'
        results.append({'object': obj.name, 'band_vertices': len(band),
                        'moved_vertices': sum(s > 1e-7 for s in shifts.values()),
                        'max_shift_world': max(shifts.values()), 'ease_world': EASE,
                        'donor_vertices': dict(donors), 'band_weight_totals': dict(totals),
                        'facet_lattice_residual_world': residual, 'iterations': iteration + 1,
                        'limits': 'Rest radial/lattice construction only; actual motion/images require review.'})
    bpy.context.view_layer.update()
    return results
