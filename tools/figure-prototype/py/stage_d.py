"""Prototype stage D – bakes the pose-driven corrective shapes into the prototype GLB.

  python3 tools/figure-prototype/py/stage_d.py <in.glb> <out.glb>

Reads the GLB of stage C (body, rig, clips), welds the body surface, finds per corrective the
clip frame where its driving bone bends most, bakes the delta-mush corrective there
(correctives.py) and appends it as a morph target to every body primitive. The drivers (bone,
ramp in degrees) go into the root node's extras (`correctives`), where the viewer reads them.
"""
import json
import struct
import sys
import numpy as np

sys.path.insert(0, __import__('os').path.dirname(__file__))
from glb_read import load_glb, accessor  # noqa: E402
from deform_metrics import Rig, collect  # noqa: E402
import correctives as cx  # noqa: E402


def write_glb(path, g, b):
    text = json.dumps(g, separators=(',', ':')).encode()
    text += b' ' * ((4 - len(text) % 4) % 4)
    b = bytes(b) + b'\0' * ((4 - len(b) % 4) % 4)
    total = 12 + 8 + len(text) + 8 + len(b)
    with open(path, 'wb') as f:
        f.write(struct.pack('<III', 0x46546C67, 2, total))
        f.write(struct.pack('<II', len(text), 0x4E4F534A))
        f.write(text)
        f.write(struct.pack('<II', len(b), 0x004E4942))
        f.write(b)


def main(src, dst):
    g, b = load_glb(src)
    b = bytearray(b)
    rig = Rig(g, bytes(b))
    body = lambda name: name.startswith(('muscle_', 'body_'))  # noqa: E731
    m = collect(g, bytes(b), body)
    P, J, W, T = m['P'], m['J'], m['W'], m['T']
    names = rig.names
    node_of = {g['nodes'][j]['name']: j for j in rig.joints}
    # Target frames: per corrective the clip time with the largest bend of its bone.
    poses, drivers = {}, []
    for name_t, bone_t, (lo, hi), bones_t, radius in cx.CORRECTIVES:
        for s in ('L', 'R'):
            name, bone = name_t.format(s=s), bone_t.format(s=s)
            best = (0, None, None)
            for anim in g['animations']:
                if anim['name'] == 'rest':
                    continue
                dur = max(accessor(g, bytes(b), smp['input'])[:, 0].max() for smp in anim['samplers'])
                for t in np.arange(0, dur + 1e-6, 0.1):
                    pose = rig.sample(anim, t)
                    q = pose.get(node_of[bone], {}).get('rotation')
                    if q is None:
                        continue
                    a = cx.angle_of(q)
                    if a > best[0]:
                        best = (a, anim['name'], t)
            angle, clip, t = best
            anim = next(a for a in g['animations'] if a['name'] == clip)
            M = rig.skin_matrices(rig.sample(anim, t))
            idx = [names.index(x.format(s=s)) for x in bones_t]
            share = np.zeros(len(P))
            for k in range(4):
                share += W[:, k] * np.isin(J[:, k], idx)
            c = rig.bind[bone]
            d = np.linalg.norm(P - c, axis=1)
            x = np.clip(1 - d / radius, 0, 1)
            region = (x * x * (3 - 2 * x)) * np.clip((share - 0.5) / 0.4, 0, 1)
            # Weight at the target frame from the ramp: the shape is scaled so the ramp reproduces it.
            w_target = cx.ramp(angle, lo, hi)
            poses[name] = (M, region)
            drivers.append({'name': name, 'bone': bone, 'from': lo, 'to': hi, 'bakedAt': {
                'clip': clip, 'time': round(float(t), 2), 'angle': round(float(angle), 1), 'weight': round(float(w_target), 3)}})
    deltas = cx.bake(P, T, J, W, None, names, None, poses)
    for d in drivers:
        w = d['bakedAt']['weight']
        if w > 1e-3:
            deltas[d['name']] = deltas[d['name']] / w
    # Map welded vertices back to every body primitive and append the targets.
    key_all = np.round(P / 5e-5).astype(np.int64)
    lookup = {tuple(k): i for i, k in enumerate(key_all)}

    def append(array, target=34962, minmax=False):
        pad = (4 - len(b) % 4) % 4
        b.extend(b'\0' * pad)
        g['bufferViews'].append({'buffer': 0, 'byteOffset': len(b), 'byteLength': array.nbytes, 'target': target})
        b.extend(array.tobytes())
        acc = {'bufferView': len(g['bufferViews']) - 1, 'componentType': 5126, 'count': len(array), 'type': 'VEC3'}
        if minmax:
            acc['min'] = array.min(0).tolist()
            acc['max'] = array.max(0).tolist()
        g['accessors'].append(acc)
        return len(g['accessors']) - 1

    order = [d['name'] for d in drivers]
    for n in g['nodes']:
        if 'mesh' not in n or not body(n['name']):
            continue
        mesh = g['meshes'][n['mesh']]
        for p in mesh['primitives']:
            Pp = accessor(g, bytes(b), p['attributes']['POSITION']).astype(float)
            ids = np.array([lookup[tuple(k)] for k in np.round(Pp / 5e-5).astype(np.int64)])
            for name in order:
                p.setdefault('targets', []).append({'POSITION': append(deltas[name][ids].astype(np.float32), minmax=True)})
        mesh['weights'] = [0.0] * len(mesh['primitives'][0]['targets'])
        mesh.setdefault('extras', {})['targetNames'] = ['muscle'] + order
    root = next(n for n in g['nodes'] if n['name'].startswith('kalethra_'))
    root.setdefault('extras', {})['correctives'] = drivers
    g['buffers'][0]['byteLength'] = len(b)
    write_glb(dst, g, b)
    for d in drivers:
        print(f"{d['name']}: bone {d['bone']} ramp {d['from']}–{d['to']}°, baked at {d['bakedAt']}, "
              f"max offset {np.linalg.norm(deltas[d['name']], axis=1).max() * 1000:.1f} mm")


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
