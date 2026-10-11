"""Resource figures of a body GLB: file size, triangles, vertices, textures, and an estimate of the
GPU memory three.js needs for it (vertex buffers as stored, morph targets as three packs them
into a float texture, images as RGBA8 with mip maps). Estimates, not measurements on a device.

  python3 tools/figure-prototype/py/resources.py <file.glb> [...]
"""
import io
import os
import sys
import json
import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(__file__))
from glb_read import load_glb  # noqa: E402

SIZE = {5120: 1, 5121: 1, 5122: 2, 5123: 2, 5125: 4, 5126: 4}
NC = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4, 'MAT4': 16}


def figures(path):
    g, b = load_glb(path)
    acc = g['accessors']
    tri = 0
    verts = 0
    vbytes = 0
    morph_bytes = 0
    body_tri = 0
    for n in g['nodes']:
        if 'mesh' not in n:
            continue
        for p in g['meshes'][n['mesh']]['primitives']:
            count = acc[p['attributes']['POSITION']]['count']
            t = acc[p['indices']]['count'] // 3
            tri += t
            if not n['name'].startswith('prop_'):
                body_tri += t
            verts += count
            for a in p['attributes'].values():
                vbytes += acc[a]['count'] * NC[acc[a]['type']] * SIZE[acc[a]['componentType']]
            vbytes += acc[p['indices']]['count'] * SIZE[acc[p['indices']]['componentType']]
            targets = p.get('targets', [])
            if targets:
                # three.js (WebGL2): one RGBA float texel per vertex, target and morphed attribute.
                per = 2 if any('NORMAL' in t for t in targets) else 1
                morph_bytes += count * len(targets) * per * 16
    tex = []
    tex_bytes = 0
    for im in g.get('images', []):
        bv = g['bufferViews'][im['bufferView']]
        data = b[bv.get('byteOffset', 0): bv.get('byteOffset', 0) + bv['byteLength']]
        w, h = Image.open(io.BytesIO(data)).size
        tex.append({'name': im.get('name'), 'size': f'{w}×{h}', 'fileBytes': bv['byteLength']})
        tex_bytes += w * h * 4 * 4 / 3
    return {
        'file': path,
        'fileMiB': round(os.path.getsize(path) / 1048576, 2),
        'triangles': tri,
        'bodyTriangles': body_tri,
        'vertices': verts,
        'bones': len(g['skins'][0]['joints']),
        'morphTargets': max((len(p.get('targets', [])) for m in g['meshes'] for p in m['primitives']), default=0),
        'textures': tex,
        'gpuEstimateMiB': {
            'vertexBuffers': round(vbytes / 1048576, 1),
            'morphTexture': round(morph_bytes / 1048576, 1),
            'textures': round(tex_bytes / 1048576, 1),
            'total': round((vbytes + morph_bytes + tex_bytes) / 1048576, 1),
        },
    }


if __name__ == '__main__':
    print(json.dumps([figures(p) for p in sys.argv[1:]], indent=1, ensure_ascii=False))
