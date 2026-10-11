"""Before/after screenshots (software renders, see raster.py) of the production male body and the
prototype – same cameras, the app's light. Writes PNG sheets into an output folder.

  python3 tools/figure-prototype/py/render_shots.py <production.glb> <prototype.glb> <out dir>
"""
import io
import os
import sys
import numpy as np
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import raster  # noqa: E402
import render_proto as R  # noqa: E402
import posed  # noqa: E402
from glb_read import load_glb  # noqa: E402

PROD_SKIN = '#cdbdae'
PROD_CLOTH = '#2a2c30'
BENCH = {'chest': 'primary', 'triceps': 'secondary', 'shoulders': 'secondary'}
PULL = {'lats': 'primary', 'biceps': 'secondary', 'back': 'secondary'}


_IMAGES = {}


def image_of(g, b, name):
    """Decoded normal map (cached: one array per image, so its mip pyramid is built once)."""
    for im in g.get('images', []):
        if im.get('name') == name:
            bv = g['bufferViews'][im['bufferView']]
            key = (name, bv['byteLength'])
            if key not in _IMAGES:
                data = b[bv.get('byteOffset', 0): bv.get('byteOffset', 0) + bv['byteLength']]
                _IMAGES[key] = (np.array(Image.open(io.BytesIO(data)).convert('RGB')).astype(np.float32) / 255 * 2 - 1)
            return _IMAGES[key]
    return None


def production_scene(path, clip, t, highlight):
    g, b, items, heads = posed.posed_meshes(path, clip, t)
    nm = image_of(g, b, 'detail_normal')
    accent = R.hexlin('#557a5b')
    ms = []
    for it in items:
        if it['name'].startswith('prop_'):
            ms.append({'P': it['P'], 'N': it['N'], 'tris': it['tris'],
                       'albedo': np.tile(R.hexlin('#bdbab1' if it['material'] == 'equipment' else '#8f8d87'), (len(it['P']), 1)),
                       'rough': 0.8})
            continue
        base = R.hexlin(PROD_CLOTH if it['material'] == 'cloth' else PROD_SKIN)
        alb = np.tile(base, (len(it['P']), 1))
        if 'groups4' in it:
            names = sorted(['adductors', 'back', 'biceps', 'calves', 'chest', 'core', 'forearms', 'glutes',
                            'hamstrings', 'lats', 'quadriceps', 'shoulders', 'triceps'])
            mixes = np.array([0.8 if highlight.get(n) == 'primary' else 0.5 if highlight.get(n) == 'secondary' else 0
                              for n in names] + [0])
            amt = (it['weights4'] / 255.0 * mixes[it['groups4']]).sum(1)
            alb = alb * (1 - amt[:, None]) + accent * amt[:, None]
        m = {'P': it['P'], 'N': it['N'], 'tris': it['tris'], 'albedo': alb, 'rough': 0.74 if it['material'] != 'cloth' else 0.9}
        if nm is not None and 'tangent' in it and 'uv' in it:
            m.update({'normal': nm, 'uv': it['uv'], 'tangent': it['tangent']})
        ms.append(m)
    return ms, heads


def prototype_scene(path, clip, t, highlight, view):
    morph = 1.0 if view == 'muscle' else 0.0
    g, b, items, heads = posed.posed_meshes(
        path, clip, t, morph, visible=lambda n: view == 'skin' or not n.startswith(('proto_hair', 'proto_drape')))
    root = next(n for n in g['nodes'] if n['name'].startswith('kalethra_'))
    names = root['extras']['muscleGroups']
    fibre = image_of(g, b, 'fibre_normal')
    ms = []
    for it in items:
        if it['name'].startswith('prop_'):
            ms.append({'P': it['P'], 'N': it['N'], 'tris': it['tris'],
                       'albedo': np.tile(R.hexlin('#bdbab1' if it['material'] == 'equipment' else '#8f8d87'), (len(it['P']), 1)),
                       'rough': 0.8})
            continue
        colour = {'drape': R.LOOK['cloth']['color'], 'eye': R.LOOK['eyes']['color']}.get(it['material'], R.LOOK['stone']['color'])
        alb = R.stone_albedo(it['P_rest'], colour)
        if 'groups4' in it:
            tint, amt = R.muscle_mix(it['groups4'], it['weights4'], names, highlight, view)
            alb = alb * (1 - amt[:, None]) + tint * amt[:, None]
        m = {'P': it['P'], 'N': it['N'], 'tris': it['tris'], 'albedo': alb,
             'rough': R.LOOK['cloth']['roughness'] if it['material'] == 'drape' else R.LOOK['stone']['roughness']}
        if view == 'muscle' and fibre is not None and 'tangent' in it:
            m.update({'normal': fibre, 'uv': it['uv'], 'tangent': it['tangent'],
                      'normalScale': R.LOOK['muscleView']['fibreNormalScale']})
        ms.append(m)
    return ms, heads


FONT = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 12) \
    if os.path.exists('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf') else ImageFont.load_default()


def caption(im, text):
    d = ImageDraw.Draw(im)
    d.rectangle([0, 0, im.width, 18], fill=(236, 233, 227))
    d.text((6, 2), text, fill=(70, 66, 60), font=FONT)
    return im


def sheet(images, cols):
    w, h = images[0].size
    rows = (len(images) + cols - 1) // cols
    out = Image.new('RGB', (w * cols, h * rows), (236, 233, 227))
    for i, im in enumerate(images):
        out.paste(im, ((i % cols) * w, (i // cols) * h))
    return out


def shot(kind, path, clip, t, highlight, cam, size, view='skin'):
    if kind == 'production':
        ms, heads = production_scene(path, clip, t, highlight)
    else:
        ms, heads = prototype_scene(path, clip, t, highlight, view)
    az, el, dist, target = cam
    tp = heads[target] if isinstance(target, str) else None
    ty = target if not isinstance(target, str) else 0
    return R.render_scene(ms, raster.look_at_camera(az, el, dist, ty, target_point=tp), *size)


def main(prod, proto, out):
    os.makedirs(out, exist_ok=True)
    W, H = 360, 520
    label = 'Software-Render (numpy, Licht wie App) – kein Gerätescreenshot'
    sets = {
        '01_ruhe_vergleich': [('rest', 0.0, {}, (az, 6, 3.3, 0.9)) for az in (0, 90, 180)],
        '02_bankdruecken': [('horizontalPush_bench', t, BENCH, (74, 30, 2.6, 'chest')) for t in (0.0, 2.2)],
        '03_latzug': [('verticalPull_cable', t, PULL, (az, 10, 3.0, 'chest')) for t, az in ((0.0, 0), (2.2, 0), (2.2, 180))],
    }
    for name, shots in sets.items():
        rows = []
        for kind, view, tag in (('production', 'skin', 'vorher 0.33.0'), ('prototype', 'skin', 'Prototyp Haut'),
                                ('prototype', 'muscle', 'Prototyp Muskeln')):
            for clip, t, hl, cam in shots:
                im = shot(kind, prod if kind == 'production' else proto, clip, t, hl, cam, (W, H), view)
                rows.append(caption(im, f'{tag} · {clip} t={t:.1f}s · az {cam[0]}°'))
        s = sheet(rows, len(shots))
        caption(s, label).save(os.path.join(out, f'{name}.png'))
        print('wrote', name)
    # Details (prototype only).
    details = [
        ('Gesicht', 'rest', 0.0, {}, (20, 2, 0.55, 'head'), 'skin'),
        ('Haare hinten', 'rest', 0.0, {}, (160, 10, 0.6, 'head'), 'skin'),
        ('Hände', 'rest', 0.0, {}, (60, 0, 0.45, 'hand_L'), 'skin'),
        ('Tuch', 'rest', 0.0, {}, (25, 0, 0.9, 'pelvis'), 'skin'),
        ('Rücken Muskeln', 'rest', 0.0, {}, (180, 5, 1.2, 'chest'), 'muscle'),
        ('Brust Muskeln', 'rest', 0.0, BENCH, (15, 5, 0.9, 'chest'), 'muscle'),
        ('Arm Muskeln', 'rest', 0.0, {}, (80, 0, 0.8, 'forearm_L'), 'muscle'),
        ('Beine Muskeln', 'rest', 0.0, {}, (25, 0, 1.5, 'shin_L'), 'muscle'),
    ]
    rows = [caption(shot('prototype', proto, c, t, hl, cam, (W, H), v), f'Prototyp · {lab}') for lab, c, t, hl, cam, v in details]
    caption(sheet(rows, 4), label).save(os.path.join(out, '04_details.png'))
    print('wrote details')


if __name__ == '__main__':
    main(*sys.argv[1:4])
