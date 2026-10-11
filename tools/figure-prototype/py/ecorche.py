"""Écorché engine of the prototype: the muscle sheets of the anatomy model on the prototype body.

The landmarks and muscle sheets come unchanged from the figure experiment
(tools/figure-experiment/blender/anatomy.py, `build_anatomy`) – the same anatomy that modelled
the male sculpt. The experiment evaluated them with Blender (BVH ray casts); this module is a
numpy/scipy port of its engine (kx_sculpt.py: `Body`, `Sculptor`) without Blender:

  - landmark rays (front, back, side, top, medial) hit the body part's triangles found by a 2-D
    point-in-triangle test along the ray axis (orthographic rays), the nearest hit wins;
  - limb rays A(t, θ) / G(t, θ) use a precomputed cylinder parametrisation of each limb's
    vertices (axis position t, angle θ in the experiment's frame) – the outermost vertex near
    (t, θ) is the hit;
  - "find nearest" on the surface is the nearest vertex (the mesh is fine, ~5 mm).

Coordinates: the experiment works in Blender axes (Z up, −Y front); the body comes in glTF axes
(Y up, +Z front) and is converted on entry: b = (x, −z, y).

Results per vertex: H (muscle volume, metres along the normal), groove depth, and per sheet the
coverage and fibre coordinates (u across, s along) – the muscle view's geometry and fibre map
are built from them (stage_b.py).
"""
import math
import os
import sys
import zlib
import numpy as np
from scipy.spatial import cKDTree

HERE = os.path.dirname(os.path.abspath(__file__))
EXPERIMENT = os.path.join(HERE, '..', '..', 'figure-experiment', 'blender')


def to_blender(P):
    return np.stack([P[:, 0], -P[:, 2], P[:, 1]], 1)


PART_IDS = {'torso': [0, 5], 'head': [5], 'armL': [1], 'armR': [2], 'legL': [3], 'legR': [4],
            'all': [0, 1, 2, 3, 4, 5], 'trunk': [0, 3, 4, 5]}


class Body:
    """The experiment's `Body` (landmark helpers), on a triangle mesh without Blender."""

    def __init__(self, P, N, tris, soft_part, chains):
        self.P = P  # blender axes
        self.N = N
        self.tris = tris
        self.soft_part = soft_part  # (n, 6): torso, armL, armR, legL, legR, head
        self.J = chains  # 'arm'/'leg': [root, middle, end] of the LEFT side (blender axes)
        self.side = 1
        self.tree = cKDTree(P)
        # A triangle belongs to every part that owns a fair share of it (soft borders: the side of
        # the chest under the armpit is torso even where the arm's weights reach it).
        share = soft_part[tris].mean(1)  # (m, 6)
        self.groups = {k: tris[share[:, ids].sum(1) > 0.3] for k, ids in PART_IDS.items()}
        # Looser groups for a second try (the armpit wall belongs to the arm's weights).
        self.groups.update({k + '~': tris[share[:, ids].sum(1) > 0.03] for k, ids in PART_IDS.items()})
        self.limb_param = {}

    # ── rays ──────────────────────────────────────────────────────────────────────────────────
    def _axis_ray(self, group, origin, axis, sign):
        """Orthographic ray along +/− a coordinate axis: returns the first hit or None."""
        T = self.groups[group]
        others = [c for c in range(3) if c != axis]
        A = self.P[T[:, 0]][:, others]
        B = self.P[T[:, 1]][:, others]
        C = self.P[T[:, 2]][:, others]
        p = np.array([origin[others[0]], origin[others[1]]])
        lo = np.minimum(np.minimum(A, B), C)
        hi = np.maximum(np.maximum(A, B), C)
        cand = np.all((lo <= p) & (hi >= p), 1)
        if not cand.any():
            return None
        A, B, C, T = A[cand], B[cand], C[cand], T[cand]
        den = (B[:, 0] - A[:, 0]) * (C[:, 1] - A[:, 1]) - (C[:, 0] - A[:, 0]) * (B[:, 1] - A[:, 1])
        den = np.where(np.abs(den) < 1e-14, 1e-14, den)
        w1 = ((p[0] - A[:, 0]) * (C[:, 1] - A[:, 1]) - (C[:, 0] - A[:, 0]) * (p[1] - A[:, 1])) / den
        w2 = ((B[:, 0] - A[:, 0]) * (p[1] - A[:, 1]) - (p[0] - A[:, 0]) * (B[:, 1] - A[:, 1])) / den
        w0 = 1 - w1 - w2
        inside = (w0 >= -1e-9) & (w1 >= -1e-9) & (w2 >= -1e-9)
        if not inside.any():
            return None
        T, w0, w1, w2 = T[inside], w0[inside], w1[inside], w2[inside]
        hit = (self.P[T[:, 0]] * w0[:, None] + self.P[T[:, 1]] * w1[:, None]
               + self.P[T[:, 2]] * w2[:, None])
        # The ray travels in direction `sign` along the axis: first hit = smallest sign*coord.
        k = np.argmin(sign * hit[:, axis])
        return hit[k]

    def _ray(self, part, origin, axis, sign):
        hit = self._axis_ray(part, origin, axis, sign)
        if hit is None:
            fb = 'trunk' if part in ('torso', 'legL', 'legR', 'head') else 'all'
            hit = self._axis_ray(fb, origin, axis, sign)
            if hit is None:
                hit = self._axis_ray('all', origin, axis, sign)
        if hit is None:
            raise ValueError(f'no hit {part} {origin}')
        return hit

    def _pp(self, part):
        if part in ('arm', 'leg'):
            return part + ('L' if self.side > 0 else 'R')
        return part

    def F(self, x, z, part='torso'):
        return self._ray(self._pp(part), (self.side * x, -1.5, z), 1, +1)

    def B(self, x, z, part='torso'):
        return self._ray(self._pp(part), (self.side * x, 1.5, z), 1, -1)

    def L(self, y, z, part='torso'):
        s = self.side
        for group in (self._pp(part), self._pp(part) + '~'):
            for k in range(12):
                hit = self._axis_ray(group, (s * 1.5, y * (0.93 ** k), z), 0, -s)
                if hit is not None:
                    return hit
        raise ValueError(f'L miss {y} {z}')

    def M(self, y, z, part='leg'):
        s = self.side
        # From the midline outwards: first hit with s*x > 0.
        T = self.groups[self._pp(part)]
        hit = self._axis_ray(self._pp(part), (0.0, y, z), 0, s)
        if hit is None:
            raise ValueError('M miss')
        return hit

    def T(self, x, y, part='torso'):
        return self._ray(self._pp(part), (self.side * x, y, 2.5), 2, -1)

    # ── limbs ─────────────────────────────────────────────────────────────────────────────────
    def _frame(self, chain, t):
        s = self.side
        pts = [np.array(p) * np.array([s, 1, 1]) for p in self.J[chain]]
        k = min(int(math.floor(t)), len(pts) - 2)
        k = max(k, 0)
        f = t - k
        c = pts[k] + f * (pts[k + 1] - pts[k])
        dirs = [(pts[i + 1] - pts[i]) / np.linalg.norm(pts[i + 1] - pts[i]) for i in range(len(pts) - 1)]
        a = dirs[k].copy()
        bw = 0.2
        if f < bw and k > 0:
            w = 0.5 * (1 - f / bw)
            a = (1 - w) * dirs[k] + w * dirs[k - 1]
        if f > 1 - bw and k < len(dirs) - 1:
            w = 0.5 * (1 - (1 - f) / bw)
            a = (1 - w) * dirs[k] + w * dirs[k + 1]
        a = a / np.linalg.norm(a)
        fr = np.array([0, -1.0, 0])
        fr = fr - (fr @ a) * a
        fr /= np.linalg.norm(fr)
        lat = np.cross(a, fr)
        if lat[0] * s < 0:
            lat = -lat
        return c, a, fr, lat

    def _limb_table(self, chain):
        """(t, θ) → outermost vertex of the limb, as a 2-D grid (the ray-cast replacement)."""
        key = (chain, self.side)
        if key in self.limb_param:
            return self.limb_param[key]
        part = chain + ('L' if self.side > 0 else 'R')
        pid = {'armL': 1, 'armR': 2, 'legL': 3, 'legR': 4}[part]
        verts = np.nonzero(self.soft_part[:, pid] > 0.5)[0]
        # Torso vertices near the limb root as well (sheets reach over the shoulder / hip).
        pts = [np.array(p) * np.array([self.side, 1, 1]) for p in self.J[chain]]
        near = np.linalg.norm(self.P - pts[0], axis=1) < 0.12
        verts = np.unique(np.concatenate([verts, np.nonzero(near)[0]]))
        ts = np.linspace(-0.3, 2.2, 251)
        frames = [self._frame(chain, min(max(t, 0.0), 1.999)) for t in ts]
        C = np.array([f[0] for f in frames])
        Pv = self.P[verts]
        # Axis parameter: nearest sampled axis point (fine enough: 1 cm steps).
        tree = cKDTree(C)
        _, ti = tree.query(Pv)
        tv = ts[ti]
        R = Pv - C[ti]
        A = np.array([f[1] for f in frames])[ti]
        FR = np.array([f[2] for f in frames])[ti]
        LAT = np.array([f[3] for f in frames])[ti]
        radial = R - (R * A).sum(1, keepdims=True) * A
        rad = np.linalg.norm(radial, axis=1)
        th = np.degrees(np.arctan2((radial * LAT).sum(1), (radial * FR).sum(1))) % 360
        self.limb_param[key] = (verts, tv, th, rad)
        return self.limb_param[key]

    def _limb(self, chain, t, theta, part):
        verts, tv, th, rad = self._limb_table(chain)
        length = np.linalg.norm(np.diff(self.J[chain], axis=0), axis=1).mean()
        dth = np.abs(((th - (theta % 360)) + 180) % 360 - 180)
        d = np.hypot((tv - t) * length, np.radians(dth) * np.maximum(rad, 0.02))
        near = d < 0.012
        if not near.any():
            near = d <= np.min(d) + 0.006
        # Outermost among the near ones (the first hit of a ray coming from outside).
        k = np.nonzero(near)[0][np.argmax(rad[near] - 0.5 * d[near])]
        return self.P[verts[k]]

    def A(self, t, theta):
        return self._limb('arm', t, theta, 'arm')

    def G(self, t, theta):
        return self._limb('leg', t, theta, 'leg')

    def nearest(self, p):
        return self.P[self.tree.query(p)[1]]


def polyline_interp(pts, u):
    pts = np.asarray(pts)
    seg = np.linalg.norm(np.diff(pts, axis=0), axis=1)
    L = np.concatenate([[0], np.cumsum(seg)])
    L /= L[-1] if L[-1] > 0 else 1
    out = np.empty((len(u), 3))
    for i in range(3):
        out[:, i] = np.interp(u, L, pts[:, i])
    return out


def value_noise3(P, scale, seed):
    rng = np.random.default_rng(seed)
    acc = np.zeros(len(P))
    for _ in range(6):
        d = rng.normal(size=3)
        d /= np.linalg.norm(d)
        acc += np.sin(P @ d / scale * 2 * math.pi + rng.uniform(0, 2 * math.pi))
    return acc / math.sqrt(3)


class Sculptor:
    """The experiment's `Sculptor`, recording per sheet what the muscle view needs."""

    def __init__(self, body, groove_scale=1.0):
        self.b = body
        n = len(body.P)
        self.H = np.zeros(n)
        self.G = np.zeros(n)  # grooves (positive = depth)
        self.bumps = np.zeros(n)
        self.sheets = []  # dicts: name, label, side, cand, cov, uu, ss, nf, across, along, fall
        self.groove_scale = groove_scale

    def _resolve(self, spec):
        if isinstance(spec, tuple) and len(spec) == 3 and isinstance(spec[0], str):
            return self.b.A(spec[1], spec[2]) if spec[0] == 'A' else self.b.G(spec[1], spec[2])
        return np.asarray(spec)

    def _grid(self, O, I, M, nu, ns):
        u = np.linspace(0, 1, nu)
        s = np.linspace(0, 1, ns)
        limb = all(isinstance(p, tuple) and isinstance(p[0], str) for p in list(O) + list(I) + (list(M) if M else []))
        if limb:
            kind = O[0][0]

            def pi(pts, u):
                a = np.array([[p[1], p[2]] for p in pts], float)
                if len(a) == 1:
                    return np.repeat(a, len(u), 0)
                L = np.linspace(0, 1, len(a))
                return np.stack([np.interp(u, L, a[:, 0]), np.interp(u, L, a[:, 1])], 1)

            Ou = pi(O, u)
            Iu = pi(I, u)
            Mu = pi(M, u) if M else 0.5 * (Ou + Iu)
            S = ((1 - s)[None, :, None] ** 2 * Ou[:, None, :] + 2 * ((1 - s) * s)[None, :, None] * Mu[:, None, :]
                 + (s ** 2)[None, :, None] * Iu[:, None, :]).reshape(-1, 2)
            f = self.b.A if kind == 'A' else self.b.G
            return np.array([f(t, th) for t, th in S]), u, s
        O = [self._resolve(p) for p in O]
        I = [self._resolve(p) for p in I]
        M = [self._resolve(p) for p in M] if M else None
        Ou = polyline_interp(O, u)
        Iu = polyline_interp(I, u)
        Mu = polyline_interp(M, u) if M is not None else 0.5 * (Ou + Iu)
        S = ((1 - s)[None, :, None] ** 2 * Ou[:, None, :] + 2 * ((1 - s) * s)[None, :, None] * Mu[:, None, :]
             + (s ** 2)[None, :, None] * Iu[:, None, :]).reshape(-1, 3)
        return S, u, s

    def sheet(self, name, O, I, M=None, T=0.006, pu=0.7, ps=(1.2, 1.2), floor=(0.0, 0.0), soft=0.006,
              fib=0.0003, spacing=0.006, parts=('all',), nu=48, ns=64, label=None, ndot=0.25, reach=0.05):
        b = self.b
        S, u, s = self._grid(O, I, M, nu, ns)
        Sn = b.P[b.tree.query(S)[1]]
        Nn = b.N[b.tree.query(S)[1]]
        UU = np.repeat(u, ns)
        SS = np.tile(s, nu)
        tree = cKDTree(Sn)
        lo = Sn.min(0) - reach
        hi = Sn.max(0) + reach
        cand = np.where(np.all((b.P > lo) & (b.P < hi), axis=1))[0]
        if len(cand) == 0:
            return
        d, ix = tree.query(b.P[cand], k=6)
        w = 1.0 / (d + 1e-4) ** 2
        w /= w.sum(1, keepdims=True)
        uu = (UU[ix] * w).sum(1)
        ss = (SS[ix] * w).sum(1)
        nd = (b.N[cand] * Nn[ix[:, 0]]).sum(1)
        dist = d[:, 0]
        grid = Sn.reshape(nu, ns, 3)
        step = np.median(np.linalg.norm(np.diff(grid, axis=1), axis=2))
        step = max(step, np.median(np.linalg.norm(np.diff(grid, axis=0), axis=2)))
        out = np.clip(dist - 0.7 * step, 0, None)
        fall = np.exp(-(out / soft) ** 2) * np.clip((nd - ndot) / 0.5, 0, 1) ** 2
        if parts != ('all',):
            ids = []
            for p in parts:
                if p in ('arm', 'leg'):
                    ids.append({'arm': 1, 'leg': 3}[p] + (0 if b.side > 0 else 1))
                else:
                    ids.append({'torso': 0, 'armL': 1, 'armR': 2, 'legL': 3, 'legR': 4, 'head': 5}[p])
            if 0 in ids:
                ids.append(5)
            ok = b.soft_part[cand][:, ids].sum(1)
            fall *= np.clip(ok, 0, 1)
        f0, f1 = floor
        base = np.sin(np.pi * np.clip(uu, 0, 1)) ** pu
        edge = np.where(uu < 0.5, f0, f1)
        across = edge + (1 - edge) * base
        p, q = ps
        along = (np.clip(ss, 1e-4, 1) ** p) * (np.clip(1 - ss, 1e-4, 1) ** q)
        smax = p / (p + q)
        along /= (smax ** p) * ((1 - smax) ** q)

        def sm(x):
            y = np.clip(x, 0, 1)
            return y * y * (3 - 2 * y)

        along *= sm(ss / 0.18) * sm((1 - ss) / 0.18)
        h = T * across * along * fall
        self.H[cand] += h
        width = np.mean(np.linalg.norm(np.diff(grid[:, ns // 2], axis=0), axis=1)) * (nu - 1)
        nf = max(width / spacing, 3)
        cov = across * np.clip(along * 3, 0, 1) * fall
        self.sheets.append({
            'name': name, 'label': label, 'side': b.side, 'cand': cand, 'cov': cov, 'uu': uu, 'ss': ss,
            'nf': nf, 'fib': fib, 'across': across, 'along': along, 'fall': fall,
            'seed': zlib.crc32(name.encode()), 'T': T,
        })

    def groove(self, pts, depth=0.002, width=0.004, profile=None, n=200, parts=('all',)):
        b = self.b
        depth *= self.groove_scale if depth > 0 else 1.0
        if all(isinstance(p, tuple) and isinstance(p[0], str) for p in pts):
            a = np.array([[p[1], p[2]] for p in pts], float)
            L = np.linspace(0, 1, len(a))
            uu = np.linspace(0, 1, n)
            f = b.A if pts[0][0] == 'A' else b.G
            C = np.array([f(np.interp(x, L, a[:, 0]), np.interp(x, L, a[:, 1])) for x in uu])
        else:
            C = polyline_interp([self._resolve(p) for p in pts], np.linspace(0, 1, n))
        Cn = b.P[b.tree.query(C)[1]]
        if profile is None:
            profile = np.ones(n)
        else:
            profile = np.interp(np.linspace(0, 1, n), np.linspace(0, 1, len(profile)), profile)
        tree = cKDTree(Cn)
        lo = Cn.min(0) - 4 * width
        hi = Cn.max(0) + 4 * width
        cand = np.where(np.all((b.P > lo) & (b.P < hi), axis=1))[0]
        d, ix = tree.query(b.P[cand])
        self.G[cand] += depth * profile[ix] * np.exp(-(d / width) ** 2)

    def bump(self, c, radius, height, aniso=None):
        b = self.b
        c = b.nearest(self._resolve(c))
        d = b.P - c
        if aniso is not None:
            ax = np.array(aniso[0], dtype=float) * np.array([b.side, 1, 1])
            ax /= np.linalg.norm(ax)
            k = aniso[1]
            along = d @ ax
            d = d - np.outer(along, ax) + np.outer(along / k, ax)
        r = np.linalg.norm(d, axis=1)
        m = r < 3 * radius
        self.bumps[m] += height * np.exp(-(r[m] / radius) ** 2)


def run_anatomy(body, sides=(1, -1), skip_head_and_hands=True):
    """Runs the experiment's anatomy (both sides) on the prototype body."""
    sys.path.insert(0, EXPERIMENT)
    sys.dont_write_bytecode = True  # no __pycache__ inside the experiment's folder
    import importlib
    anatomy = importlib.import_module('anatomy')
    if skip_head_and_hands:
        # Head and hand details belong to the reduced sculpt face and the curled hand of the
        # experiment; the prototype keeps MakeHuman's face and hands.
        anatomy.build_head = lambda b, S: None
        anatomy.build_hand = lambda b, S: None
    S = Sculptor(body)
    failed = []
    for side in sides:
        body.side = side
        # Wrap the sheet/groove/bump calls: one missed landmark must not stop the rest.
        for kind in ('sheet', 'groove', 'bump'):
            orig = getattr(Sculptor, kind)

            def safe(self, *a, _orig=orig, _kind=kind, **k):
                try:
                    return _orig(self, *a, **k)
                except ValueError as e:
                    failed.append((_kind, a[0] if _kind == 'sheet' else '', str(e)))
            setattr(S, kind, safe.__get__(S))
        anatomy.build_anatomy(body, S)
    body.side = 1
    return S, failed
