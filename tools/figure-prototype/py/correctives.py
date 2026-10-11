"""Pose-driven corrective shapes (baked delta mush) for elbow, knee and shoulder.

Measured cause (deform_metrics.py, phase 1A): the strong creases are not abrupt weight borders –
widening the weight hand-over (weights.py) changed fewer than 400 vertices and no measured value –
but linear blend skinning itself: blending two rotated copies of a vertex shrinks it towards the
joint axis, so the inner elbow collapses and folds when the arm bends 100°+, the knee when
seated, the armpit when the arm is raised overhead.

Correction: at the most bent frame of the clips, the skinned surface is replaced by its
delta-mush version (Mancewicz et al. 2014): the posed surface is smoothed, and each vertex's rest
detail – its offset from the smoothed rest surface, stored in the local frame of that smoothed
surface – is added back. That keeps the surface's volume and detail instead of collapsing it. The
difference to plain skinning, taken back into the rest space (through the vertex's blended
rotation), becomes a morph target; at runtime its weight follows the joint's bend
(`driver`: angle of the bone's local rotation, ramped between `from` and `to` degrees).
Bones, weights and clips stay unchanged.
"""
import numpy as np
from scipy.sparse import coo_matrix, identity
import meshio

CORRECTIVES = [
    # name, driving bone, ramp (deg), region bones, radius around the driving joint (m)
    ('fix_elbow_{s}', 'forearm_{s}', (25, 125), ['upperArm_{s}', 'forearm_{s}', 'forearmTwist_{s}'], 0.13),
    ('fix_knee_{s}', 'shin_{s}', (25, 110), ['thigh_{s}', 'shin_{s}'], 0.14),
    ('fix_shoulder_{s}', 'upperArm_{s}', (40, 160), ['chest', 'shoulder_{s}', 'upperArm_{s}'], 0.16),
]
MUSH_ITERS = 60


def angle_of(q):
    return np.degrees(2 * np.arccos(np.clip(abs(q[3]), 0, 1)))


def ramp(angle, lo, hi):
    x = np.clip((angle - lo) / (hi - lo), 0, 1)
    return x * x * (3 - 2 * x)


def smoothing_operator(tris, n, mask):
    """Uniform Laplacian step restricted to the masked vertices (others stay)."""
    E = meshio.edges_of(tris)
    a = np.concatenate([E[:, 0], E[:, 1]])
    b = np.concatenate([E[:, 1], E[:, 0]])
    deg = np.bincount(a, minlength=n).astype(float)
    deg[deg == 0] = 1
    A = coo_matrix((1.0 / deg[a], (a, b)), shape=(n, n)).tocsr()
    m = mask.astype(float)
    # x' = (1-m) x + m (0.5 x + 0.5 A x)
    from scipy.sparse import diags
    return diags(1 - 0.5 * m) + diags(0.5 * m) @ A


def smooth(S, P, iters):
    for _ in range(iters):
        P = S @ P
    return P


def frames(P, tris, nbr):
    N = meshio.vertex_normals(P, tris)
    t = P[nbr] - P
    t -= (t * N).sum(1, keepdims=True) * N
    t /= np.maximum(np.linalg.norm(t, axis=1, keepdims=True), 1e-12)
    b = np.cross(N, t)
    return np.stack([t, b, N], 2)  # columns: t, b, n


def bake(P, tris, wj, ww, skin_matrices, rest_names, joints, poses):
    """poses: {corrective name: (skin matrices at the target frame)} → morph deltas (n, 3)."""
    n = len(P)
    E = meshio.edges_of(tris)
    nbr = np.zeros(n, dtype=int)
    nbr[E[:, 0]] = E[:, 1]
    nbr[E[:, 1]] = E[:, 0]
    out = {}
    for name, spec in poses.items():
        M, region = spec
        mask = region > 0.01
        # Smooth over a ring wider than the region (the mush needs context), then fade.
        S = smoothing_operator(tris, n, meshio.smooth_field(region, E, n, 6, 0.5) > 0.001)
        Rs = smooth(S, P, MUSH_ITERS)
        Fr = frames(Rs, tris, nbr)
        delta = np.einsum('nji,nj->ni', Fr, P - Rs)  # rest detail in the local frame
        # Skinned (LBS) pose.
        Ph = np.c_[P, np.ones(n)]
        Bl = np.zeros((n, 4, 4))
        for k in range(4):
            Bl += ww[:, k, None, None] * M[wj[:, k]]
        X = np.einsum('nij,nj->ni', Bl, Ph)[:, :3]
        Xs = smooth(S, X, MUSH_ITERS)
        Fp = frames(Xs, tris, nbr)
        D = Xs + np.einsum('nij,nj->ni', Fp, delta)
        C = (D - X) * region[:, None]
        # Back into rest space: three adds the morph before skinning (final = Bl · (P + m)).
        inv = np.linalg.inv(Bl[mask][:, :3, :3])
        m = np.zeros((n, 3))
        m[mask] = np.einsum('nij,nj->ni', inv, C[mask])
        out[name] = m
    return out
