"""The skin form of the prototype body: the fine (twice subdivided) mesh brought back onto the
modelled anatomy, plus local fairing where the transfer leaves creases (neck, upper back)."""
import numpy as np
from scipy.spatial import cKDTree
import meshio

PART_OF = {  # contract bone → body part (torso, armL, armR, legL, legR, head)
    'root': 0, 'pelvis': 0, 'spine': 0, 'chest': 0, 'neck': 0, 'head': 5,
}


def part_of_bone(name):
    if name in PART_OF:
        return PART_OF[name]
    side = 1 if name.endswith('_L') else 2
    if name.startswith(('thigh', 'shin', 'foot')):
        return 3 if side == 1 else 4
    if name.startswith('shoulder'):
        return 0
    return side  # arms, hands, fingers


def soft_parts(body):
    """Per vertex membership of the six body parts (weights summed per part)."""
    names = body['jointNames']
    lut = np.array([part_of_bone(n) for n in names])
    out = np.zeros((len(body['P']), 6))
    for k in range(4):
        np.add.at(out, (np.arange(len(out)), lut[body['wj'][:, k]]), body['ww'][:, k])
    return out


def bone_share(body, name):
    j = body['jointNames'].index(name)
    return (body['ww'] * (body['wj'] == j)).sum(1)


def map_coarse(body):
    """Relief weight and kept-face weight of the coarse mesh, per fine vertex (nearest)."""
    c = body['coarse']
    tree = cKDTree(c['P'][c['used']])
    _, i = tree.query(body['P'])
    src = c['used'][i]
    return c['detail'][src], c['faceKept'][src]


def floor_offset(P, mask, sculpt):
    """The transfer moved the body to the floor; find that shift against the sculpt's points."""
    tree = cKDTree(sculpt['P'][::3])
    dy = 0.0
    for _ in range(8):
        q = sculpt['P'][::3][tree.query(P[mask] + [0, dy, 0])[1]]
        dy += float(np.median(q[:, 1] - (P[mask][:, 1] + dy)))
    return dy


def reproject(P, tris, weight, sculpt, dy, limit=0.004, smooth=2, radius=0.02, part=None):
    """Moves vertices along their normal onto the sculpt's surface (signed plane distance to the
    best nearby sculpt point with an agreeing normal), clamped and lightly smoothed – the second
    subdivision step's rounding is taken back, the modelled relief comes through as geometry."""
    N = meshio.vertex_normals(P, tris)
    idx = np.nonzero(weight > 0)[0]
    tree = cKDTree(sculpt['P'])
    d, j = tree.query(P[idx] + [0, dy, 0], k=16, distance_upper_bound=radius)
    best = np.full(len(idx), np.nan)
    score = np.full(len(idx), np.inf)
    for k in range(j.shape[1]):
        ok = np.isfinite(d[:, k])
        jj = np.where(ok, j[:, k], 0)
        agree = (sculpt['formN'][jj] * N[idx]).sum(1)
        ok &= agree > 0.5
        q = sculpt['P'][jj] - [0, dy, 0]
        plane = ((q - P[idx]) * sculpt['formN'][jj]).sum(1)
        sc = d[:, k] + (1 - agree) * 0.01
        if part is not None:
            sc = sc + np.where(sculpt['part'][jj] != part[idx], 0.03, 0)
        better = ok & (sc < score)
        score[better] = sc[better]
        best[better] = plane[better]
    disp = np.zeros(len(P))
    found = np.isfinite(best)
    disp[idx[found]] = np.clip(best[found], -limit, limit)
    E = meshio.edges_of(tris)
    disp = meshio.smooth_field(disp, E, len(P), smooth, 0.5)
    return P + (weight * disp)[:, None] * N, disp


def nearest_targets(P, N, idx, sculpt, dy, radius, part):
    """Nearest sculpt point per vertex (normal agreement and body part respected)."""
    tree = cKDTree(sculpt['P'])
    d, j = tree.query(P[idx] + [0, dy, 0], k=16, distance_upper_bound=radius)
    target = np.full((len(idx), 3), np.nan)
    score = np.full(len(idx), np.inf)
    for k in range(j.shape[1]):
        ok = np.isfinite(d[:, k])
        jj = np.where(ok, j[:, k], 0)
        agree = (sculpt['formN'][jj] * N[idx]).sum(1)
        ok &= agree > 0.4
        sc = d[:, k] + (1 - agree) * 0.02 + np.where(sculpt['part'][jj] != part[idx], 0.03, 0)
        better = ok & (sc < score)
        score[better] = sc[better]
        target[better] = sculpt['P'][jj[better]] - [0, dy, 0]
    return target


def relax_tangential(P, tris, mask, iters=4, lam=0.5):
    """Evens the vertex spacing along the surface (Laplacian, tangential part only)."""
    E = meshio.edges_of(tris)
    n = len(P)
    deg = np.bincount(E.ravel(), minlength=n).astype(float)
    deg[deg == 0] = 1
    for _ in range(iters):
        N = meshio.vertex_normals(P, tris)
        S = np.zeros_like(P)
        np.add.at(S, E[:, 0], P[E[:, 1]])
        np.add.at(S, E[:, 1], P[E[:, 0]])
        L = S / deg[:, None] - P
        L -= (L * N).sum(1, keepdims=True) * N
        P = P + (lam * mask)[:, None] * L
    return P


def fit_to_sculpt(P, tris, weight, sculpt, dy, part, rounds=10):
    """Shrink-wrap onto the modelled anatomy, coarse to fine: each round moves every fitted
    vertex part of the way to its nearest sculpt point (displacement field smoothed over the mesh,
    so whole areas move together), then evens the spacing along the surface (no folds where the
    surface contracts). The upper back of the transferred body lies up to ~4 cm inside the
    modelled one – the production transfer searches 4.5 cm and does not reach it (the shirt hid
    it there). A last round along the normal brings the fine relief."""
    E = meshio.edges_of(tris)
    idx = np.nonzero(weight > 0)[0]
    for r in range(rounds):
        wide = r < rounds // 2
        N = meshio.vertex_normals(P, tris)
        t = nearest_targets(P, N, idx, sculpt, dy, 0.07 if wide else 0.02, part)
        D = np.zeros_like(P)
        ok = np.all(np.isfinite(t), 1)
        D[idx[ok]] = t[ok] - P[idx[ok]]
        D = meshio.smooth_field(D, E, len(P), 40 if wide else 10, 0.5)
        P = P + (weight * 0.6)[:, None] * D
        P = relax_tangential(P, tris, weight, iters=3)
    P, disp = reproject(P, tris, weight, sculpt, dy, limit=0.003, smooth=1, part=part)
    return P, disp


def taubin(P, tris, mask, iters=20, lam=0.5, mu=-0.53):
    """Volume-preserving fairing of the masked vertices (mask: 0..1 weight per vertex)."""
    E = meshio.edges_of(tris)
    n = len(P)
    deg = np.bincount(E.ravel(), minlength=n).astype(float)
    deg[deg == 0] = 1
    Q = P.copy()
    for _ in range(iters):
        for f in (lam, mu):
            S = np.zeros_like(Q)
            np.add.at(S, E[:, 0], Q[E[:, 1]])
            np.add.at(S, E[:, 1], Q[E[:, 0]])
            Q = Q + (f * mask)[:, None] * (S / deg[:, None] - Q)
    return Q
