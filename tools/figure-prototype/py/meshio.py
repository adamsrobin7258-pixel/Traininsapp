"""Reading the stage A dump and small mesh helpers shared by the prototype stages."""
import json
import os
import numpy as np

DTYPES = {'Float64Array': np.float64, 'Float32Array': np.float32, 'Int32Array': np.int32,
          'Uint8Array': np.uint8, 'Uint16Array': np.uint16, 'Uint32Array': np.uint32}


def read_array(folder, spec):
    return np.fromfile(os.path.join(folder, spec['file']), dtype=DTYPES[spec['type']])


def load_stage_a(folder):
    meta = json.load(open(os.path.join(folder, 'body.json')))
    arr = {k: read_array(folder, v) for k, v in meta['arrays'].items()}
    body = {
        'meta': meta,
        'P': arr['positions'].reshape(-1, 3),
        'uvs': arr['uvs'].reshape(-1, 2),
        'used': arr['used'],
        'faceOffsets': arr['faceOffsets'],
        'faceVerts': arr['faceVerts'],
        'faceUvs': arr['faceUvs'],
        'faceRegion': arr['faceRegion'],
        'faceShorts': arr['faceShorts'],
        'wj': arr['weightJoints'].reshape(-1, 4),
        'ww': arr['weightValues'].reshape(-1, 4),
        'coarse': {
            'P': arr['coarsePositions'].reshape(-1, 3),
            'used': arr['coarseUsed'],
            'detail': arr['coarseDetail'],
            'faceKept': arr['coarseFaceKept'],
        },
        'regions': meta['regionNames'],
        'jointNames': meta['jointNames'],
        'joints': {k: np.array(v) for k, v in meta['joints'].items()},
    }
    helpers = {}
    for name, spec in meta['helpers'].items():
        helpers[name] = {
            'P': read_array(folder, spec['positions']).reshape(-1, 3),
            'faceOffsets': read_array(folder, spec['faceOffsets']),
            'faceVerts': read_array(folder, spec['faceVerts']),
        }
    body['helpers'] = helpers
    return body


def triangulate(offsets, verts, extra=None):
    """Fan triangulation of polygons given as offsets/verts. Returns (m,3) and the face index."""
    tris, owner, extra_tris = [], [], []
    for f in range(len(offsets) - 1):
        a, b = offsets[f], offsets[f + 1]
        for k in range(1, b - a - 1):
            tris.append((verts[a], verts[a + k], verts[a + k + 1]))
            owner.append(f)
            if extra is not None:
                extra_tris.append((extra[a], extra[a + k], extra[a + k + 1]))
    tris = np.array(tris, dtype=np.int64)
    owner = np.array(owner, dtype=np.int64)
    if extra is not None:
        return tris, owner, np.array(extra_tris, dtype=np.int64)
    return tris, owner


def vertex_normals(P, tris):
    n = np.cross(P[tris[:, 1]] - P[tris[:, 0]], P[tris[:, 2]] - P[tris[:, 0]])
    N = np.zeros_like(P)
    for k in range(3):
        np.add.at(N, tris[:, k], n)
    l = np.linalg.norm(N, axis=1, keepdims=True)
    return N / np.maximum(l, 1e-12)


def edges_of(tris):
    e = np.concatenate([tris[:, [0, 1]], tris[:, [1, 2]], tris[:, [2, 0]]])
    e = np.sort(e, axis=1)
    return np.unique(e, axis=0)


def smooth_field(F, E, n, iters, lam=0.5, mask=None):
    """Laplacian smoothing of a per-vertex field over the edge graph."""
    F = F.astype(np.float64).copy()
    deg = np.bincount(E.ravel(), minlength=n).astype(float)
    deg[deg == 0] = 1
    for _ in range(iters):
        S = np.zeros_like(F)
        np.add.at(S, E[:, 0], F[E[:, 1]])
        np.add.at(S, E[:, 1], F[E[:, 0]])
        avg = (S.T / deg).T
        upd = F + lam * (avg - F)
        if mask is None:
            F = upd
        else:
            F = np.where(mask if F.ndim == 1 else mask[:, None], upd, F)
    return F
