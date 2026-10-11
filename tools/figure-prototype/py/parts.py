"""Separate components of the skin view: carved hair cap, white drape (loincloth), eyes.

Hair and drape are copies of the body's own faces in their region, lifted off the skin (their
own geometry with a closed rim, skinned with the same weights as the body vertices they come
from, so they follow every movement exactly). The region border is first moved onto a smooth
contour, so the edge is a calm carved line and not the mesh's staircase. Eyes are spheres in the
sockets (MakeHuman's eye helper gives centre and radius), carved blank as in classical sculpture.
"""
import math
import numpy as np
import meshio


def smoothstep(x):
    x = np.clip(x, 0, 1)
    return x * x * (3 - 2 * x)


def region_component(P, tris, field, mask_extra, thickness, relief, rim_depth=0.0012):
    """Copies the faces where the smooth `field` > 0 into an own mesh.

    field: per vertex (metres, signed distance-like); border vertices move onto field = 0.
    thickness(v_index_array, field_values) → offset along the normal (metres);
    relief(points, normals) → extra offset; returns dict with P, tris, src (body vertex per new
    vertex), and the rim faces.
    """
    inside = (field > 0) & mask_extra
    tri_in = inside[tris].sum(1) >= 2  # a triangle with two vertices inside belongs to it
    T = tris[tri_in]
    used = np.unique(T)
    local = np.full(len(P), -1)
    local[used] = np.arange(len(used))
    LT = local[T]
    Q = P[used].copy()
    N = meshio.vertex_normals(P, tris)[used]
    # Border: edges used by exactly one triangle of the component.
    e = np.concatenate([LT[:, [0, 1]], LT[:, [1, 2]], LT[:, [2, 0]]])
    key = np.sort(e, 1)
    uniq, inv, cnt = np.unique(key, axis=0, return_inverse=True, return_counts=True)
    border_edges = e[cnt[inv.ravel()] == 1]
    border = np.unique(border_edges)
    # Move border vertices onto the zero contour (Newton step along the field's surface gradient).
    f = field[used]
    E = meshio.edges_of(LT)
    grad = np.zeros_like(Q)
    deg = np.zeros(len(Q))
    for a, b in ((E[:, 0], E[:, 1]), (E[:, 1], E[:, 0])):
        d = Q[b] - Q[a]
        l2 = np.maximum((d * d).sum(1), 1e-12)
        np.add.at(grad, a, d * ((f[b] - f[a]) / l2)[:, None])
        np.add.at(deg, a, 1)
    grad /= np.maximum(deg, 1)[:, None]
    grad -= (grad * N).sum(1, keepdims=True) * N
    g2 = np.maximum((grad * grad).sum(1), 1e-12)
    step = -(f / g2)[:, None] * grad
    lim = 0.006
    sl = np.linalg.norm(step, axis=1, keepdims=True)
    step = np.where(sl > lim, step / sl * lim, step)
    Q[border] += step[border]
    # Relax the border line along itself a little (calm curve).
    for _ in range(6):
        acc = np.zeros_like(Q); c = np.zeros(len(Q))
        for a, b in ((border_edges[:, 0], border_edges[:, 1]), (border_edges[:, 1], border_edges[:, 0])):
            np.add.at(acc, a, Q[b]); np.add.at(c, a, 1)
        m = c > 0
        Q[m] += 0.35 * (acc[m] / c[m][:, None] - Q[m])
    base = Q.copy()
    off = thickness(used, field[used], border) + relief(Q, N, used)
    top = Q + off[:, None] * N
    # Rim: the border twice more – once at the top surface (own vertices, so the rim's crisp
    # normals do not darken the top surface's edge), once a little inside the skin – joined.
    nb = len(border)
    tmap = np.full(len(Q), -1)
    tmap[border] = len(Q) + np.arange(nb)
    bmap = np.full(len(Q), -1)
    bmap[border] = len(Q) + nb + np.arange(nb)
    rim_pts = base[border] - rim_depth * N[border]
    allP = np.concatenate([top, top[border], rim_pts])
    rim = []
    for a, b in border_edges:  # outward orientation follows the face winding of the border edge
        rim.append((tmap[b], tmap[a], bmap[a]))
        rim.append((tmap[b], bmap[a], bmap[b]))
    tris_out = np.concatenate([LT, np.array(rim, dtype=np.int64)])
    src = np.concatenate([used, used[border], used[border]])
    return {'P': allP, 'tris': tris_out, 'src': src, 'n_top': len(Q), 'nb': nb, 'border': border, 'offset': off}


def head_frame(P, head_share):
    H = P[head_share > 0.5]
    c = np.array([0.0, (H[:, 1].min() + H[:, 1].max()) / 2,
                  H[:, 2].min() + (H[:, 2].max() - H[:, 2].min()) * 0.45])
    return c


def hair_field(P, head_share, eye_y, centre):
    rel = P - centre
    phi = np.degrees(np.arctan2(np.abs(rel[:, 0]), rel[:, 2]))  # 0 front, 180 back
    h = P[:, 1] - eye_y
    pts = np.array([[0, 0.062], [30, 0.058], [55, 0.044], [72, 0.036], [84, 0.006], [98, 0.004],
                    [112, 0.022], [135, -0.025], [160, -0.05], [180, -0.055]])
    line = np.interp(phi, pts[:, 0], pts[:, 1])
    field = h - line
    # Ears stay free: a margin around the ear (lateral, at eye height, beside the head).
    ear = smoothstep((np.abs(P[:, 0]) - 0.062) / 0.006) * smoothstep(1 - np.abs(h + 0.006) / 0.045) \
        * smoothstep((phi - 66) / 8) * smoothstep((140 - phi) / 10)
    field = field - 0.05 * ear
    # Off the head (neck): fade the field out smoothly – no hard cut along the weight border.
    field = field - 0.04 * (1 - smoothstep((head_share - 0.25) / 0.5))
    return field, phi, h


def hair_relief(centre, crown_offset=(0.0, 0.07, -0.04)):
    """Carved locks: ridges radiating from the crown, a little wavy, calmer towards the edge."""
    crown = np.array(centre) + np.array(crown_offset)

    def relief(Q, N, used):
        d = Q - crown
        r = np.linalg.norm(d, axis=1)
        # Angle around the crown in the plane of the scalp (azimuth about the head's up-axis).
        ang = np.arctan2(d[:, 0], d[:, 2])
        wave = 0.35 * np.sin(r * 55.0) + 0.15 * np.sin(r * 140.0 + ang * 3)
        locks = 0.5 + 0.5 * np.cos(ang * 26 + wave * 2.4)
        locks = locks ** 1.6
        curl = 0.5 + 0.5 * np.sin(r * 95.0 + ang * 5.0)
        return 0.0030 * locks + 0.0012 * curl * locks
    return relief


def drape_field(P, J, shorts_v, E, n):
    """The loincloth: a classical wrap – leg openings rising diagonally from the crotch to the
    hip, a low waist line dipping a little at the front."""
    sm = meshio.smooth_field(shorts_v.astype(float), E, n, 6, 0.5)
    crotch = P[(sm > 0.5) & (np.abs(P[:, 0]) < 0.02)][:, 1].min()
    hip = J['pelvis'][1]
    ax = np.abs(P[:, 0])
    front = smoothstep((P[:, 2] - J['pelvis'][2] + 0.01) / 0.04)
    leg_f = crotch + np.clip((ax - 0.035) / 0.13, 0, 1) ** 0.9 * (hip + 0.035 - crotch)
    leg_b = crotch + np.clip((ax - 0.045) / 0.12, 0, 1) ** 0.9 * (hip - 0.055 - crotch)
    leg = front * leg_f + (1 - front) * leg_b
    waist = hip + 0.065 - 0.018 * front * np.exp(-(ax / 0.07) ** 2)
    field = np.minimum(P[:, 1] - leg, waist - P[:, 1])
    torso_band = (P[:, 1] > crotch - 0.05) & (P[:, 1] < hip + 0.12) & (ax < 0.25)
    return meshio.smooth_field(field, E, n, 4, 0.5), torso_band


def drape_relief(J):
    """Folds radiating from a knot at the left hip, a rolled waist band (relative to the field)."""
    knot = np.array([0.135, J['pelvis'][1] + 0.045, 0.06])

    def relief(Q, N, used):
        d = Q - knot
        r = np.linalg.norm(d, axis=1)
        ang = np.arctan2(d[:, 1], np.sign(d[:, 0] + 1e-9) * np.hypot(d[:, 0], d[:, 2]))
        folds = (0.5 + 0.5 * np.cos(ang * 11 + 0.8 * np.sin(r * 30))) ** 2.2
        fade = np.exp(-r / 0.22)
        knot_bulge = 0.006 * np.exp(-(r / 0.03) ** 2)
        return 0.0032 * folds * (0.35 + 0.65 * fade) + knot_bulge
    return relief


def eye_sphere(centre, radius, segments=40, rings=28):
    phi = np.linspace(0, math.pi, rings + 1)
    th = np.linspace(0, 2 * math.pi, segments, endpoint=False)
    pts = []
    for p in phi:
        for t in th:
            pts.append((math.sin(p) * math.sin(t), math.cos(p), math.sin(p) * math.cos(t)))
    pts = np.array(pts) * radius + centre
    tris = []
    for i in range(rings):
        for j in range(segments):
            a = i * segments + j
            b = i * segments + (j + 1) % segments
            c = (i + 1) * segments + j
            d = (i + 1) * segments + (j + 1) % segments
            tris.append((a, c, b))
            tris.append((b, c, d))
    return pts, np.array(tris)
