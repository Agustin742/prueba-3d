"""SECOND correction, source preparation only; parent executes once in isolation.

Parent command (same Blender installation as connected MCP, NOT live scene):
"D:/Descargas App/Blender/blender.exe" --background --factory-startup --python-exit-code 1 --python scripts/blender/avatar_catalogue_hoodie_hem_validate.py

Read-only input: assets/blender/avatars/catalogue-correction/female-hoodie.blend
Only new GLB/BLEND and hoodie-hem-correction evidence paths below may be written.
No subprocesses, polling, auto-retry, manifest promotion or fit acceptance.
Reuses the first validator for exact same cameras, actual actions and audits.
On any fixed-length/topology guard failure: report blocker, do NOT relax guards.
"""
from pathlib import Path
import os
import sys
import traceback

sys.dont_write_bytecode = True
sys.path.insert(0, str(Path(__file__).resolve().parent))
import bpy
import avatar_catalogue_hoodie_validate as shared
from avatar_catalogue_hoodie_hem import BAND_TOP, fit

ROOT = shared.ROOT
shared.EVIDENCE = ROOT / 'odd/artifacts/avatar-customization/hoodie-hem-correction'
shared.OUTPUT = ROOT / 'public/models/avatars-hem-correction/female/top-hoodie.glb'
shared.SOURCE = ROOT / 'assets/blender/avatars/catalogue-hem-correction/female-hoodie.blend'
INPUT = ROOT / 'assets/blender/avatars/catalogue-correction/female-hoodie.blend'


def upper_signature(objects):
    return {o.name: [(v.index, list(v.co), [(g.group, g.weight) for g in v.groups])
                     for v in o.data.vertices if (o.matrix_world @ v.co).z >= BAND_TOP]
            for o in objects}


def tailor(objects, body, rig):
    chest = upper_signature(objects)
    result = fit(objects, body, bpy.data.objects['Pants'], rig)
    assert chest == upper_signature(objects), 'Existing chest/hood/sleeve correction changed'
    for item in result:
        item['upper_geometry_and_weights_unchanged'] = True
    return result


if __name__ == '__main__':
    report = {'status': 'running', 'pid': os.getpid(), 'blender': bpy.app.version_string,
              'argv': sys.argv, 'visual_verdict': 'NOT_ACCEPTED: parent must inspect actual images',
              'limits': ['Fixed original rest length and topology; no body or Pants edits/hiding.',
                         'Finite rest radial/facet lattice is construction, NOT acceptance.',
                         'Three actual-action samples per clip, one rendered sample; not swept motion.',
                         'Body AND Pants BVH candidates are diagnostic, not signed clearance.',
                         'Before images are the first chest correction, not the original catalogue.',
                         'No browser/runtime validation; no promotion.']}
    try:
        shared.run(report, input_source=INPUT, fitting=tailor, preserve_length=True)
    except BaseException:
        report['status'] = 'failed-no-retry'
        report['error'] = traceback.format_exc()
        raise
    finally:
        path = shared.EVIDENCE / 'report.json'
        if shared.EVIDENCE.exists() and not path.exists():
            shared.write(path, report)
