"""Catalogue construction in Blender coordinates (front = -Y), no scene IO.

Open garment seams are authored boundaries, not body-face removal. Existing
female hair/tank are conservative decimated derivatives, never replacements.
"""
import math
import bpy
from mathutils import Vector, kdtree


def material(name, color, roughness=.8):
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = (*color, 1)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get('Principled BSDF')
    bsdf.inputs['Base Color'].default_value = (*color, 1)
    bsdf.inputs['Roughness'].default_value = roughness
    return mat


def mesh(name, vertices, faces, mat):
    data = bpy.data.meshes.new(name)
    data.from_pydata(vertices, [], faces)
    data.update()
    obj = bpy.data.objects.new(name, data)
    bpy.context.collection.objects.link(obj)
    obj.data.materials.append(mat)
    for p in data.polygons:
        p.use_smooth = True
    return obj


def tube(name, points, radius, mat, sides=12, closed=False):
    vertices, faces = [], []
    for i, point in enumerate(points):
        tangent = Vector(points[(i + 1) % len(points)]) - Vector(points[i - 1])
        if not closed and i == 0:
            tangent = Vector(points[1]) - Vector(point)
        if not closed and i == len(points) - 1:
            tangent = Vector(point) - Vector(points[i - 1])
        tangent.normalize()
        u = tangent.cross(Vector((0, 1, 0))).normalized()
        if u.length < .1:
            u = tangent.cross(Vector((1, 0, 0))).normalized()
        v = tangent.cross(u).normalized()
        for j in range(sides):
            a = 2 * math.pi * j / sides
            vertices.append(Vector(point) + radius * (math.cos(a) * u + math.sin(a) * v))
    for i in range(len(points) if closed else len(points) - 1):
        for j in range(sides):
            a, b = i * sides + j, i * sides + (j + 1) % sides
            c, d = ((i + 1) % len(points)) * sides + j, ((i + 1) % len(points)) * sides + (j + 1) % sides
            faces.append((a, b, d, c))
    if not closed:
        faces.extend([tuple(reversed(range(sides))), tuple((len(points)-1)*sides+j for j in range(sides))])
    return mesh(name, vertices, faces, mat)


def ellipse(name, center, radii, mat, plane='XY'):
    pts = []
    for i in range(40):
        a = i * math.tau / 40
        x, y = radii[0]*math.cos(a), radii[1]*math.sin(a)
        pts.append(Vector(center) + Vector((x, y, 0) if plane == 'XY' else (x, 0, y)))
    return tube(name, pts, .012, mat, closed=True)


def box(name, center, size, mat, bevel=.025):
    bpy.ops.mesh.primitive_cube_add(size=1, location=center)
    obj = bpy.context.object
    obj.name = name
    obj.dimensions = size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.data.materials.append(mat)
    mod = obj.modifiers.new('Soft tailored edges', 'BEVEL')
    mod.width, mod.segments = bevel, 3
    bpy.ops.object.modifier_apply(modifier=mod.name)
    for p in obj.data.polygons:
        p.use_smooth = True
    return obj


def cap(name, bottom, height, rx, ry, mat, center_y=0, exponent=1):
    vertices, faces = [], []
    n, rows = 48, 12
    # Rounded dome with a single pole, no coincident pole vertices or bottom cap.
    for row in range(rows):
        a = row / rows * math.pi / 2
        for j in range(n):
            t = j / n * math.tau
            vertices.append((rx*math.cos(t)*math.cos(a)**exponent,
                             center_y + ry*math.sin(t)*math.cos(a)**exponent,
                             bottom + height*math.sin(a)))
    for row in range(rows-1):
        for j in range(n):
            a = row*n+j
            b = row*n+(j+1)%n
            faces.append((a, b, b+n, a+n))
    vertices.append((0, center_y, bottom+height))
    pole = len(vertices)-1
    for j in range(n):
        faces.append(((rows-1)*n+j, (rows-1)*n+(j+1)%n, pole))
    return mesh(name, vertices, faces, mat)


def rigid(objects, rig, bone='DEF-spine.006'):
    assert bone in rig.data.bones, bone
    for obj in objects:
        world = obj.matrix_world.copy()
        # Skin to one bone: rest world placement remains intact, no bone-parent offset.
        obj.parent = rig
        obj.matrix_world = world
        obj.vertex_groups.clear()
        group = obj.vertex_groups.new(name=bone)
        group.add(list(range(len(obj.data.vertices))), 1, 'REPLACE')
        mod = obj.modifiers.new('Canonical rig', 'ARMATURE')
        mod.object = rig


def transfer(objects, body, rig):
    """Nearest body weights, normalized top four; visual deformation still required."""
    tree = kdtree.KDTree(len(body.data.vertices))
    for v in body.data.vertices:
        tree.insert(body.matrix_world @ v.co, v.index)
    tree.balance()
    for obj in objects:
        world = obj.matrix_world.copy()
        obj.parent = rig
        obj.matrix_world = world
        obj.vertex_groups.clear()
        groups = {g.name: obj.vertex_groups.new(name=g.name) for g in body.vertex_groups if g.name in rig.data.bones}
        for v in obj.data.vertices:
            _, index, _ = tree.find(obj.matrix_world @ v.co)
            weights = sorted([(body.vertex_groups[g.group].name, g.weight) for g in body.data.vertices[index].groups
                              if body.vertex_groups[g.group].name in groups and g.weight > 0], key=lambda p: -p[1])[:4]
            total = sum(w for _, w in weights)
            assert total > 0, 'Unweighted source body vertex'
            for name, weight in weights:
                groups[name].add([v.index], weight / total, 'REPLACE')
        mod = obj.modifiers.new('Canonical rig', 'ARMATURE')
        mod.object = rig


def garment(name, female, sleeves, mat):
    """Single connected open shell: torso armholes stitched to sleeve loops.

    Torso rings use 16 vertices. Side patches are omitted during construction
    and replaced by sleeves, so no capped tubes or doubled armpit surfaces.
    """
    n = 16
    front, back = (.277, .108) if female else (.218, .115)
    vertices, faces = [], []
    levels = [(.47, .168), (.55, .185), (.63, .196), (.72, .205)]
    for z, width in levels:
        for j in range(n):
            t = j/n*math.tau
            vertices.append((width*math.cos(t), (back if math.sin(t)>0 else front)*math.sin(t), z))
    # Side armhole at the last two bands, one on each side.
    omitted = {0, 7, 8, 15}
    for row in range(3):
        for j in range(n):
            if sleeves and row >= 1 and j in omitted:
                continue
            faces.append((row*n+j, row*n+(j+1)%n, (row+1)*n+(j+1)%n, (row+1)*n+j))
    # Shoulder annulus to an elliptical neck opening, preserving an open neckline.
    for j in range(n):
        t = j/n*math.tau
        vertices.append((.083*math.cos(t), -.018+.072*math.sin(t), .748))
    for j in range(n):
        if sleeves and j in omitted:
            continue
        faces.append((48+j,48+(j+1)%n,64+(j+1)%n,64+j))
    if sleeves:
        # Each boundary follows the two omitted columns from waist-side to neck.
        for sign, loop in [(1,[31,16,17,33,49,65,64,79,63,47]),(-1,[23,24,25,41,57,73,72,71,55,39])]:
            previous = loop
            for step in range(1, 5):
                fraction = step/4
                center = Vector((sign*(.19+sleeves*fraction), -.012, .69-.38*sleeves*fraction))
                current = []
                for j in range(len(loop)):
                    a = j/len(loop)*math.tau
                    current.append(len(vertices))
                    vertices.append(center+Vector((sign*.025*math.sin(a), .072*math.cos(a), .066*math.sin(a))))
                for j in range(len(loop)):
                    faces.append((previous[j], previous[(j+1)%len(loop)], current[(j+1)%len(loop)], current[j]))
                previous = current
    obj = mesh(name, vertices, faces, mat)
    # Smooth the tailored shell without capping intentional openings.
    mod = obj.modifiers.new('Tailored smoothing', 'SUBSURF')
    mod.levels = 2
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.object.modifier_apply(modifier=mod.name)
    obj.select_set(False)
    return obj


def hair_style(style, mat, detail):
    objects = []
    if style == 'afro':
        # Continuous lobed dome, not intersecting sphere clusters.
        obj = cap('Afro crown', 1.00, .52, .49, .45, mat, .035, .36)
        for v in obj.data.vertices:
            t = math.atan2(v.co.y-.035, v.co.x)
            scale = 1+.045*math.cos(9*t)*math.sin((v.co.z-1)*11)
            v.co.x *= scale
            v.co.y = .035+(v.co.y-.035)*scale
        return [obj]
    bottom = 1.12 if style in ('fade','classic-short') else 1.08
    objects.append(cap('Hair crown', bottom, .25, .352, .335, mat, -.015, .55))
    if style == 'fade':
        objects.append(cap('Raised flat fade', 1.28, .11, .25, .24, mat, -.015, .22))
    elif style == 'classic-short':
        objects.append(tube('Swept forelock', [(-.27,-.28,1.22),(-.12,-.34,1.31),(.10,-.29,1.35),(.27,-.16,1.31)], .055, mat))
    elif style in ('bob','long-tied'):
        # Rear curtain with an open bottom, no hidden scalp duplicate.
        verts, faces = [], []
        for row,z in enumerate([1.22,1.04,.83 if style=='bob' else 1.02]):
            for j in range(25):
                a = -.08+j/24*(math.pi+.16)
                verts.append((.36*math.cos(a),.35*math.sin(a),z))
        for row in range(2):
            for j in range(24):
                a=row*25+j
                faces.append((a,a+1,a+26,a+25))
        objects.append(mesh('Bob curtain' if style=='bob' else 'Tied nape',verts,faces,mat))
        if style == 'long-tied':
            objects.append(tube('Low tied tail',[(0,.32,1.10),(0,.44,.99),(.035,.43,.79)],.085,mat))
            objects.append(ellipse('Tail tie',(0,.40,1.01),(.089,.06),detail))
    elif style == 'high-ponytail':
        objects.append(tube('High ponytail',[(0,.22,1.33),(0,.44,1.45),(0,.53,1.20),(.04,.49,.94)],.09,mat))
        objects.append(ellipse('Ponytail tie',(0,.29,1.37),(.092,.06),detail))
    elif style == 'bun':
        objects.append(cap('Coiled bun',1.30,.22,.16,.15,mat,.20,.6))
        objects.append(ellipse('Bun band',(0,.20,1.32),(.16,.15),detail))
    return objects


def accessories(style, mat, detail):
    objects = []
    if 'glasses' in style:
        for x in [-.16,.16]:
            if style == 'square-glasses':
                pts=[(x-.115,-.36,.91),(x+.115,-.36,.91),(x+.115,-.36,1.025),(x-.115,-.36,1.025)]
                objects.append(tube('Square frame',pts,.013,mat,closed=True))
            else:
                objects.append(ellipse('Round frame',(x,-.36,.965),(.114,.079),mat,'XZ'))
        objects.append(tube('Bridge',[(-.045,-.36,.98),(0,-.37,.99),(.045,-.36,.98)],.012,mat))
        for s in [-1,1]:
            objects.append(tube('Temple',[(s*.275,-.36,.98),(s*.35,-.13,.97),(s*.36,.015,.91)],.012,mat))
    elif style == 'cap':
        objects.append(cap('Cap crown',1.16,.24,.37,.35,mat,-.01,.65))
        objects.append(box('Cap visor',(0,-.36,1.18),(.56,.26,.035),mat,.017))
        objects.append(box('Cap badge',(0,-.356,1.26),(.09,.012,.045),detail,.005))
    elif style == 'headphones':
        pts=[(.43*math.cos(i/32*math.pi),0,1.02+.39*math.sin(i/32*math.pi)) for i in range(33)]
        objects.append(tube('Headband',pts,.028,mat))
        for s in [-1,1]:
            objects.append(box('Ear cushion',(s*.42,0,1.015),(.075,.16,.20),detail,.035))
            objects.append(box('Ear cup',(s*.46,0,1.015),(.04,.135,.17),mat,.018))
    elif style == 'earrings':
        for s in [-1,1]:
            objects.append(ellipse('Hoop earring',(s*.396,-.035,.785),(.035,.052),mat,'XZ'))
    elif style == 'backpack':
        objects.append(box('Backpack',(0,.205,.575),(.28,.15,.29),mat,.045))
        objects.append(box('Outer pocket',(0,.295,.52),(.20,.045,.11),detail,.016))
        for s in [-1,1]:
            objects.append(tube('Shoulder strap',[(s*.11,.20,.47),(s*.15,.11,.72),(s*.14,-.03,.74),(s*.12,-.13,.57)],.016,detail))
    elif style == 'handbag':
        objects.append(box('Handbag',(.37,-.02,.37),(.20,.105,.18),mat,.025))
        pts=[(.37+.072*math.cos(i/20*math.pi),-.02,.46+.10*math.sin(i/20*math.pi)) for i in range(21)]
        objects.append(tube('Bag handle',pts,.013,detail))
        objects.append(box('Bag clasp',(.37,-.079,.42),(.035,.012,.028),detail,.005))
    return objects
