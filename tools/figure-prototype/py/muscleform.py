"""The muscle (écorché) form: the skin form with the muscles separated.

From the anatomy engine's sheets (ecorche.py): every vertex gets its dominant muscle (sheet), the
borders between different muscles become grooves of a soft profile (deeper between muscle
groups than between parts of one muscle, between a muscle and bare bone/tendon somewhat less),
the experiment's own grooves (intermuscular septa, tendinous intersections …) are pressed in
deeper than in the skin form, and the bellies gain a little volume – the skin and fat layer over
them is gone. Proportions stay natural: no extra muscle mass beyond that.
"""
import numpy as np
from scipy.sparse import coo_matrix
from scipy.sparse.csgraph import dijkstra
import meshio

# Groove depths (metres) and width (gaussian, metres).
SEPARATE_GROUPS = 0.0042
SEPARATE_PARTS = 0.0026
SEPARATE_BARE = 0.0030
GROOVE_WIDTH = 0.0038
EXTRA_GROOVES = 0.6  # experiment grooves, on top of what the skin form already has (≈0.75)
BELLY = 0.35  # share of the sheet volume added to the bellies
MIN_COVER = 0.03


def group_of(label):
    return label.split('_')[0] if label else None


def dominant_sheet(sheets, n):
    best = np.zeros(n)
    bid = np.full(n, -1)
    for k, sh in enumerate(sheets):
        c = sh['cov']
        m = c > best[sh['cand']]
        best[sh['cand'][m]] = c[m]
        bid[sh['cand'][m]] = k
    bid[best < MIN_COVER] = -1
    return bid, best


def separation(P, tris, sheets, bid):
    """Groove depth per vertex along the borders between different muscles."""
    E = meshio.edges_of(tris)
    a, b = E[:, 0], E[:, 1]
    differ = bid[a] != bid[b]
    labels = [sh['label'] for sh in sheets]
    names = [sh['name'] for sh in sheets]

    def depth(i, j):
        if i < 0 or j < 0:
            return SEPARATE_BARE
        gi, gj = group_of(labels[i]), group_of(labels[j])
        if names[i] == names[j]:  # left/right of the same muscle at the midline
            return SEPARATE_PARTS
        if gi is not None and gi == gj:
            return SEPARATE_PARTS
        return SEPARATE_GROUPS

    seed_depth = np.zeros(len(P))
    for x, y in zip(a[differ], b[differ]):
        d = depth(bid[x], bid[y])
        seed_depth[x] = max(seed_depth[x], d)
        seed_depth[y] = max(seed_depth[y], d)
    seeds = np.nonzero(seed_depth > 0)[0]
    w = np.linalg.norm(P[a] - P[b], axis=1)
    n = len(P)
    G = coo_matrix((np.concatenate([w, w]), (np.concatenate([a, b]), np.concatenate([b, a]))), shape=(n, n)).tocsr()
    dist, _, src = dijkstra(G, indices=seeds, min_only=True, return_predecessors=True, limit=0.02)
    out = np.zeros(n)
    ok = np.isfinite(dist) & (src >= 0)
    # The border runs between two vertices: the groove's bottom lies half an edge off a seed.
    out[ok] = seed_depth[src[ok]] * np.exp(-(np.maximum(dist[ok] - 0.0015, 0) / GROOVE_WIDTH) ** 2)
    return meshio.smooth_field(out, E, n, 3, 0.5)


def muscle_form(P_skin, tris, eco, region_neutral):
    """Displacement along the normal from the skin form to the muscle form (metres, signed).

    `region_neutral`: 1 where the muscle view keeps the skin form (head, hands, feet)."""
    n = len(P_skin)
    bid, best = dominant_sheet(eco['sheets'], n)
    sep = separation(P_skin, tris, eco['sheets'], bid)
    belly = np.zeros(n)
    for sh in eco['sheets']:
        belly[sh['cand']] = np.maximum(belly[sh['cand']], sh['T'] * sh['across'] * sh['along'] * sh['fall'])
    disp = -sep - EXTRA_GROOVES * eco['G'] + BELLY * belly
    E = meshio.edges_of(tris)
    disp = meshio.smooth_field(disp, E, n, 2, 0.5)
    disp *= 1 - region_neutral
    return disp, bid, best
