"""Muscle fibre normal map of the muscle view.

The fibre relief of the anatomy engine (experiment: kx_sculpt.py, `fib`) is evaluated per texel
instead of per vertex – the prototype mesh (~5 mm) is too coarse for 4–6 mm fibre spacing, the
texture is not: each sheet's coordinates (u across, s along) and weights are interpolated over
its triangles in UV space and the ridge formula runs at texel resolution. The height field
becomes a tangent-space normal map in the frame three.js reconstructs from the exported tangents
(T, B = N × T, N).
"""
import math
import numpy as np
import ecorche

FIBRE_SCALE = 1.3  # stone needs a little more relief than skin to read in the app's light


def smooth_sheet(sh, E, n, iters=20):
    """Laplacian smoothing of a sheet's u and s over its own vertices (edges inside the sheet)."""
    cand = sh['cand']
    idx = np.full(n, -1)
    idx[cand] = np.arange(len(cand))
    a, b = idx[E[:, 0]], idx[E[:, 1]]
    ok = (a >= 0) & (b >= 0)
    a, b = a[ok], b[ok]
    deg = np.bincount(np.concatenate([a, b]), minlength=len(cand)).astype(float)
    deg[deg == 0] = 1
    for key in ('uu', 'ss'):
        f = sh[key].astype(float).copy()
        for _ in range(iters):
            acc = np.zeros_like(f)
            np.add.at(acc, a, f[b])
            np.add.at(acc, b, f[a])
            f = np.where(deg > 0, 0.5 * f + 0.5 * acc / deg, f)
        sh[key] = f


def tangents(P, N, uv, tris_v, tris_t, n_corner):
    """Per corner (vertex, uv) tangents from UV gradients (Lengyel), orthogonalised to N."""
    T = np.zeros((n_corner, 3))
    p0, p1, p2 = P[tris_v[:, 0]], P[tris_v[:, 1]], P[tris_v[:, 2]]
    t0, t1, t2 = uv[tris_t[:, 0]], uv[tris_t[:, 1]], uv[tris_t[:, 2]]
    e1, e2 = p1 - p0, p2 - p0
    d1, d2 = t1 - t0, t2 - t0
    r = d1[:, 0] * d2[:, 1] - d2[:, 0] * d1[:, 1]
    r = np.where(np.abs(r) < 1e-12, 1e-12, r)
    tan = (e1 * d2[:, 1:2] - e2 * d1[:, 1:2]) / r[:, None]
    return tan


def rasterize_uv(uv_tri, size, chunk=20000):
    """Texels covered by UV triangles: returns (texel index, triangle index, barycentrics)."""
    if len(uv_tri) > chunk:
        parts = [rasterize_uv(uv_tri[i:i + chunk], size, chunk) for i in range(0, len(uv_tri), chunk)]
        return (np.concatenate([p[0] for p in parts]),
                np.concatenate([p[1] + i * chunk for i, p in zip(range(len(parts)), parts)]),
                np.concatenate([p[2] for p in parts]))
    sx = uv_tri[:, :, 0] * size - 0.5
    sy = uv_tri[:, :, 1] * size - 0.5
    x0 = np.floor(sx.min(1)).astype(int); x1 = np.ceil(sx.max(1)).astype(int)
    y0 = np.floor(sy.min(1)).astype(int); y1 = np.ceil(sy.max(1)).astype(int)
    x0 = np.clip(x0, 0, size - 1); x1 = np.clip(x1, 0, size - 1)
    y0 = np.clip(y0, 0, size - 1); y1 = np.clip(y1, 0, size - 1)
    bw = x1 - x0 + 1; bh = y1 - y0 + 1
    n = bw * bh
    rep = np.repeat(np.arange(len(uv_tri)), n)
    offs = np.arange(n.sum()) - np.repeat(np.cumsum(n) - n, n)
    px = x0[rep] + offs % bw[rep]
    py = y0[rep] + offs // bw[rep]
    ax, ay = sx[rep, 0], sy[rep, 0]
    bx, by = sx[rep, 1], sy[rep, 1]
    cx, cy = sx[rep, 2], sy[rep, 2]
    den = (by - cy) * (ax - cx) + (cx - bx) * (ay - cy)
    den = np.where(np.abs(den) < 1e-12, 1e-12, den)
    w0 = ((by - cy) * (px - cx) + (cx - bx) * (py - cy)) / den
    w1 = ((cy - ay) * (px - cx) + (ax - cx) * (py - cy)) / den
    w2 = 1 - w0 - w1
    ok = (w0 >= -0.02) & (w1 >= -0.02) & (w2 >= -0.02)
    return (py[ok] * size + px[ok]).astype(np.int64), rep[ok], np.stack([w0[ok], w1[ok], w2[ok]], 1).astype(np.float32)


def bake_fibres(P, N, Tg, tris_v, tris_t, uv_corner, sheets, size, region_neutral):
    """Normal map (size², RGB uint8) of the fibre relief; Tg: tangent per uv corner."""
    n = len(P)
    height = np.zeros(size * size)
    covered = np.zeros(size * size, bool)
    # Per triangle UV coordinates (glTF orientation: v flipped like the export).
    uv_tri = uv_corner[tris_t].copy()
    uv_tri[:, :, 1] = 1 - uv_tri[:, :, 1]
    for sh in sheets:
        if sh['fib'] <= 0:
            continue
        cand = sh['cand']
        idx = np.full(n, -1)
        idx[cand] = np.arange(len(cand))
        tri_in = np.all(idx[tris_v] >= 0, 1)
        if not tri_in.any():
            continue
        tv = tris_v[tri_in]
        ti = idx[tv]
        tex, tri, bary = rasterize_uv(uv_tri[tri_in], size)
        if not len(tex):
            continue
        def interp(a):
            return (a[ti[tri]] * bary).sum(1)
        uu = interp(sh['uu'])
        across = np.clip(interp(sh['across']), 0, None)
        along = np.clip(interp(sh['along']), 0, None)
        fall = np.clip(interp(sh['fall']), 0, None)
        Pp = (P[tv[tri]] * bary[:, :, None]).sum(1)
        Pb = ecorche.to_blender(Pp)
        ph = ecorche.value_noise3(Pb, 0.05, sh['seed'] % 1000) * 0.12
        amp = 0.55 + 0.45 * ecorche.value_noise3(Pb, 0.035, sh['seed'] % 997 + 1)
        nf = sh['nf']
        r = np.cos(2 * np.pi * (uu * nf + ph)) + 0.35 * np.cos(4 * np.pi * (uu * nf * 1.03 + ph * 1.7))
        h = sh['fib'] * FIBRE_SCALE * r * np.clip(amp, 0, 1) * np.sqrt(np.clip(across, 0, 1)) \
            * np.clip(along, 0, 1) ** 0.8 * fall
        np.add.at(height, tex, h)
        covered[tex] = True
    # Texel → triangle map for the frame (any triangle, last one wins: neighbours agree).
    tex, tri, bary = rasterize_uv(uv_tri, size)
    owner = np.full(size * size, -1, dtype=np.int64)
    owner[tex] = tri
    ob = np.zeros((size * size, 3), dtype=np.float32)
    ob[tex] = bary
    del tex, tri, bary
    neutral = np.zeros(size * size, dtype=np.float32)
    H = height.reshape(size, size)
    # A light 3×3 blur: single-texel spikes (where a sheet's weights end) become no dark pits.
    H = (H + np.roll(H, 1, 0) + np.roll(H, -1, 0) + np.roll(H, 1, 1) + np.roll(H, -1, 1)) / 5
    gx = np.zeros(size * size, dtype=np.float32)
    gy = np.zeros(size * size, dtype=np.float32)
    gx.reshape(size, size)[:, 1:-1] = (H[:, 2:] - H[:, :-2]) / 2
    gy.reshape(size, size)[1:-1, :] = (H[2:, :] - H[:-2, :]) / 2
    img = np.zeros((size * size, 3), dtype=np.float32)
    img[:, 2] = 1
    has_all = np.nonzero(owner >= 0)[0]
    for start in range(0, len(has_all), 1_000_000):
        has = has_all[start:start + 1_000_000]
        t = owner[has]
        b = ob[has].astype(np.float64)
        v = tris_v[t]
        nu = (region_neutral[v] * b).sum(1)
        p0, p1, p2 = P[v[:, 0]], P[v[:, 1]], P[v[:, 2]]
        q = uv_tri[t] * size
        d1 = q[:, 1] - q[:, 0]; d2 = q[:, 2] - q[:, 0]
        e1 = p1 - p0; e2 = p2 - p0
        det = d1[:, 0] * d2[:, 1] - d2[:, 0] * d1[:, 1]
        det = np.where(np.abs(det) < 1e-9, 1e-9, det)
        dPdx = (e1 * d2[:, 1:2] - e2 * d1[:, 1:2]) / det[:, None]
        dPdy = (e2 * d1[:, 0:1] - e1 * d2[:, 0:1]) / det[:, None]
        Nn = (N[v] * b[:, :, None]).sum(1)
        Nn /= np.linalg.norm(Nn, axis=1, keepdims=True)
        a11 = (dPdx * dPdx).sum(1); a12 = (dPdx * dPdy).sum(1); a22 = (dPdy * dPdy).sum(1)
        det2 = a11 * a22 - a12 * a12
        det2 = np.where(np.abs(det2) < 1e-18, 1e-18, det2)
        k = 1 - np.clip(nu, 0, 1)
        cx = (a22 * gx[has] - a12 * gy[has]) / det2 * k
        cy = (a11 * gy[has] - a12 * gx[has]) / det2 * k
        grad = dPdx * cx[:, None] + dPdy * cy[:, None]
        # Fibre relief is shallow: limit the tilt (slope ≤ 0.5) so no texel turns to a pit.
        gl = np.linalg.norm(grad, axis=1, keepdims=True)
        grad = np.where(gl > 0.5, grad / np.maximum(gl, 1e-12) * 0.5, grad)
        n2 = Nn - grad
        n2 /= np.linalg.norm(n2, axis=1, keepdims=True)
        T = (Tg[tris_t[t]] * b[:, :, None]).sum(1)  # tangents per uv corner (as exported)
        T -= (T * Nn).sum(1, keepdims=True) * Nn
        T /= np.maximum(np.linalg.norm(T, axis=1, keepdims=True), 1e-12)
        B = np.cross(Nn, T)
        img[has] = np.stack([(n2 * T).sum(1), (n2 * B).sum(1), (n2 * Nn).sum(1)], 1)
    del ob, gx, gy
    # Dilate into the gaps between UV islands (no seams from bilinear filtering / mip maps).
    img = img.reshape(size, size, 3)
    filled = (owner >= 0).reshape(size, size)
    del owner
    for _ in range(8):
        acc = np.zeros_like(img)
        cnt = np.zeros((size, size), dtype=np.float32)
        for dy, dx in ((0, 1), (0, -1), (1, 0), (-1, 0)):
            sf = np.roll(filled, (dy, dx), (0, 1))
            acc += np.roll(img, (dy, dx), (0, 1)) * sf[:, :, None]
            cnt += sf
        new = ~filled & (cnt > 0)
        img[new] = acc[new] / cnt[new][:, None]
        filled |= new
        del acc
    img /= np.linalg.norm(img, axis=2, keepdims=True)
    return ((img * 0.5 + 0.5) * 255 + 0.5).astype(np.uint8), H
