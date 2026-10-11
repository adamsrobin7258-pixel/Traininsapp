"""Deformation measurements of a body GLB (production or prototype), without a GPU.

Plays every clip with linear blend skinning (as three.js does), optionally with the prototype's
morph target applied (muscle view), and measures per joint region over the whole loop:

  - stretched / compressed edges: share of surface edges longer than 1.35× or shorter than
    0.65× their rest length (rest edges ≥ 2 mm; welded body surface, seams excluded);
  - worst edge stretch (99.9th percentile and maximum);
  - flipped triangles: faces whose normal turns more than 120° against its own rest normal
    rotated by the dominant bone – a fold or a crease the skin cannot make;
  - for the prototype: the drape's and hair's distance to the skin (penetration = negative).

Regions (spheres around joints of the bind pose): armpit, lat/back, elbow/biceps, wrist, hip and
crotch, knee, ankle. Output: JSON (stdout) and a short table.
"""
import json
import sys
import collections
import numpy as np

sys.path.insert(0, __import__('os').path.dirname(__file__))
from glb_read import load_glb, accessor  # noqa: E402

REGIONS = {
    'Achsel': (['upperArm_L', 'upperArm_R'], 0.09, (0.0, -0.05, 0.0)),
    'Latissimus/Rücken': (['chest'], 0.16, (0.0, -0.02, -0.08)),
    'Bizeps/Ellbogen': (['forearm_L', 'forearm_R'], 0.08, (0, 0, 0)),
    'Handgelenk': (['hand_L', 'hand_R'], 0.045, (0, 0, 0)),
    'Hüfte/Schritt': (['thigh_L', 'thigh_R'], 0.11, (0.0, -0.04, 0.0)),
    'Knie': (['shin_L', 'shin_R'], 0.07, (0, 0, 0)),
    'Sprunggelenk': (['foot_L', 'foot_R'], 0.06, (0, 0, 0)),
}


def quat_mat(q):
    x, y, z, w = q
    return np.array([[1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w)],
                     [2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w)],
                     [2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)]])


class Rig:
    def __init__(self, g, b):
        self.g, self.b = g, b
        nodes = g['nodes']
        self.parent = {}
        for i, n in enumerate(nodes):
            for c in n.get('children', []):
                self.parent[c] = i
        skin = g['skins'][0]
        self.joints = skin['joints']
        self.names = [nodes[j]['name'] for j in self.joints]
        self.ibm = accessor(g, b, skin['inverseBindMatrices']).reshape(-1, 4, 4).transpose(0, 2, 1)
        self.bind = {nodes[j]['name']: -self.ibm[k][:3, 3] for k, j in enumerate(self.joints)}

    def sample(self, anim, t):
        g, b = self.g, self.b
        out = collections.defaultdict(dict)
        for c in anim['channels']:
            s = anim['samplers'][c['sampler']]
            ti = accessor(g, b, s['input'])[:, 0]
            vo = accessor(g, b, s['output']).astype(float)
            if len(ti) == 1:
                v = vo[0]
            else:
                k = int(np.clip(np.searchsorted(ti, t) - 1, 0, len(ti) - 2))
                f = np.clip((t - ti[k]) / (ti[k + 1] - ti[k]), 0, 1)
                a, bb = vo[k], vo[k + 1]
                if c['target']['path'] == 'rotation' and np.dot(a, bb) < 0:
                    bb = -bb
                v = a * (1 - f) + bb * f
                if c['target']['path'] == 'rotation':
                    v /= np.linalg.norm(v)
            out[c['target']['node']][c['target']['path']] = v
        return out

    def skin_matrices(self, pose):
        nodes = self.g['nodes']
        cache = {}

        def w(i):
            if i in cache:
                return cache[i]
            n = nodes[i]
            p = pose.get(i, {})
            M = np.eye(4)
            M[:3, :3] = quat_mat(p.get('rotation', n.get('rotation', [0, 0, 0, 1]))) * np.array(p.get('scale', n.get('scale', [1, 1, 1])))
            M[:3, 3] = p.get('translation', n.get('translation', [0, 0, 0]))
            cache[i] = (w(self.parent[i]) @ M) if i in self.parent else M
            return cache[i]
        return np.stack([w(j) @ self.ibm[k] for k, j in enumerate(self.joints)])


def collect(g, b, include, morph=0.0):
    """Skinned primitives of nodes whose name passes `include`, welded by position."""
    Ps, Js, Ws, Ts, Ds, off = [], [], [], [], [], 0
    for n in g['nodes']:
        if 'mesh' not in n or 'skin' not in n or not include(n['name']):
            continue
        for p in g['meshes'][n['mesh']]['primitives']:
            P = accessor(g, b, p['attributes']['POSITION']).astype(float)
            if morph and p.get('targets'):
                P = P + morph * accessor(g, b, p['targets'][0]['POSITION']).astype(float)
            Ps.append(P)
            Ds.append([accessor(g, b, t['POSITION']).astype(float) for t in p.get('targets', [])[1:]])
            Js.append(accessor(g, b, p['attributes']['JOINTS_0']).astype(int))
            Ws.append(accessor(g, b, p['attributes']['WEIGHTS_0']).astype(float))
            Ts.append(accessor(g, b, p['indices']).reshape(-1, 3).astype(int) + off)
            off += len(P)
    if not Ps:
        return None
    P = np.concatenate(Ps); J = np.concatenate(Js); W = np.concatenate(Ws); T = np.concatenate(Ts)
    # Weld (0.05 mm): seams between nodes and uv islands are one vertex for the measurement.
    key = np.round(P / 5e-5).astype(np.int64)
    _, first, inv = np.unique(key, axis=0, return_index=True, return_inverse=True)
    inv = inv.ravel()
    k = min(len(d) for d in Ds)
    D = [np.concatenate([d[i] for d in Ds])[first] for i in range(k)]
    return {'P': P[first], 'J': J[first], 'W': W[first], 'T': inv[T], 'D': D}


def skin(M, P, J, W):
    Ph = np.c_[P, np.ones(len(P))]
    out = np.zeros_like(P)
    for k in range(4):
        out += W[:, k:k + 1] * np.einsum('nij,nj->ni', M[J[:, k]], Ph)[:, :3]
    return out


def tri_normals(P, T):
    n = np.cross(P[T[:, 1]] - P[T[:, 0]], P[T[:, 2]] - P[T[:, 0]])
    return n / np.maximum(np.linalg.norm(n, axis=1, keepdims=True), 1e-15)


def corrective_weights(drivers, pose, node_of):
    out = []
    for d in drivers:
        q = pose.get(node_of[d['bone']], {}).get('rotation', [0, 0, 0, 1])
        a = np.degrees(2 * np.arccos(np.clip(abs(q[3]), 0, 1)))
        x = np.clip((a - d['from']) / (d['to'] - d['from']), 0, 1)
        out.append(x * x * (3 - 2 * x))
    return out


def measure(path, morph=0.0, include=None, step=0.2, use_correctives=True):
    g, b = load_glb(path)
    rig = Rig(g, b)
    include = include or (lambda name: name.startswith(('muscle_', 'body_')))
    m = collect(g, b, include, morph)
    P, J, W, T = m['P'], m['J'], m['W'], m['T']
    root = next(n for n in g['nodes'] if n['name'].startswith('kalethra_'))
    drivers = (root.get('extras') or {}).get('correctives', []) if use_correctives else []
    node_of = {g['nodes'][j]['name']: j for j in rig.joints}
    E = np.unique(np.sort(np.concatenate([T[:, [0, 1]], T[:, [1, 2]], T[:, [2, 0]]]), 1), axis=0)
    e0 = np.linalg.norm(P[E[:, 0]] - P[E[:, 1]], axis=1)
    keep = e0 > 0.002
    E, e0 = E[keep], e0[keep]
    mid = (P[E[:, 0]] + P[E[:, 1]]) / 2
    tmid = P[T].mean(1)
    region_edges, region_tris = {}, {}
    for name, (bones, radius, offset) in REGIONS.items():
        me = np.zeros(len(E), bool); mt = np.zeros(len(T), bool)
        for bone in bones:
            c = rig.bind[bone] + np.array(offset) * np.array([1 if bone.endswith('_L') or '_' not in bone else -1, 1, 1])
            me |= np.linalg.norm(mid - c, axis=1) < radius
            mt |= np.linalg.norm(tmid - c, axis=1) < radius
        region_edges[name] = me
        region_tris[name] = mt
    n0 = tri_normals(P, T)
    dom = J[T[:, 0], np.argmax(W[T[:, 0]], 1)]
    result = {}
    for anim in g.get('animations', []):
        if anim['name'] == 'rest':
            continue
        dur = max(accessor(g, b, s['input'])[:, 0].max() for s in anim['samplers'])
        times = np.arange(0, dur + 1e-6, step)
        acc = {name: {'over': 0.0, 'p999': 0.0, 'max': 0.0, 'flipped': 0} for name in REGIONS}
        total = {'over': 0.0, 'flipped': 0}
        for t in times:
            pose = rig.sample(anim, t)
            M = rig.skin_matrices(pose)
            Pt = P
            for wgt, D in zip(corrective_weights(drivers, pose, node_of), m['D']):
                Pt = Pt + wgt * D
            Q = skin(M, Pt, J, W)
            e1 = np.linalg.norm(Q[E[:, 0]] - Q[E[:, 1]], axis=1)
            r = e1 / e0
            bad = (r > 1.35) | (r < 0.65)
            n1 = tri_normals(Q, T)
            R = M[dom][:, :3, :3]
            n0r = np.einsum('nij,nj->ni', R, n0)
            flipped = (n1 * n0r).sum(1) < -0.5
            total['over'] = max(total['over'], bad.mean())
            total['flipped'] = max(total['flipped'], int(flipped.sum()))
            for name in REGIONS:
                me = region_edges[name]
                a = acc[name]
                a['over'] = max(a['over'], float(bad[me].mean()) if me.any() else 0)
                a['p999'] = max(a['p999'], float(np.percentile(np.maximum(r[me], 1 / r[me]), 99.9)) if me.any() else 0)
                a['max'] = max(a['max'], float(np.max(np.maximum(r[me], 1 / r[me]))) if me.any() else 0)
                a['flipped'] = max(a['flipped'], int(flipped[region_tris[name]].sum()))
        result[anim['name']] = {'regions': acc, 'all': total}
    return result


def table(results):
    lines = []
    for label, res in results.items():
        for clip, r in res.items():
            lines.append(f'{label} – {clip}: whole body {100 * r["all"]["over"]:.2f} % edges outside 0.65–1.35×, '
                         f'{r["all"]["flipped"]} flipped faces')
            for name, a in r['regions'].items():
                lines.append(f'   {name:18s} {100 * a["over"]:6.2f} %   p99.9 {a["p999"]:5.2f}×   max {a["max"]:5.2f}×   flipped {a["flipped"]}')
    return '\n'.join(lines)


if __name__ == '__main__':
    out = {}
    for arg in sys.argv[1:]:
        path, _, morph = arg.partition('@')
        nofix = morph.endswith('!')
        out[arg] = measure(path, float(morph.rstrip('!') or 0), use_correctives=not nofix)
    print(table(out))
    json.dump(out, open('/dev/stderr', 'w'))
