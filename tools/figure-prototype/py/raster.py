"""Software renderer for prototype screenshots (numpy only, no GPU, no browser).

Reproduces the app's figure light (tools: src/modules/training/figure/figureRenderer.ts →
addFigureLights): hemisphere sky/ground fill plus key, fill and rim directional lights fixed to
the camera, a metal/roughness PBR surface (Lambert + GGX), ACES filmic tone mapping (three.js
variant) with exposure 1.05 and sRGB output. It is a faithful approximation of the WebGL path,
not the WebGL path itself: no MSAA (supersampling instead), no shadow maps (the app has none).
"""
import math
import numpy as np

SKY = np.array([1.0, 1.0, 1.0])
GROUND = np.array([0x8A, 0x86, 0x78]) / 255.0
LIGHTS = [  # (direction towards the light, colour (sRGB hex), intensity)
    ((3.2, 3.2, 2.2), 0xFFF6EC, 2.5),
    ((-3.0, 1.2, 2.4), 0xEEF2FF, 0.55),
    ((-2.5, 2.2, -3.0), 0xFFFFFF, 0.9),
]
HEMI_INTENSITY = 1.15


def srgb_to_linear(c):
    c = np.asarray(c, dtype=np.float64)
    return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)


def linear_to_srgb(c):
    c = np.clip(c, 0, 1)
    return np.where(c <= 0.0031308, c * 12.92, 1.055 * c ** (1 / 2.4) - 0.055)


def hex_linear(h):
    return srgb_to_linear(np.array([(h >> 16) & 255, (h >> 8) & 255, h & 255]) / 255.0)


def aces_three(color, exposure=1.05):
    """three.js ACESFilmicToneMapping (RRT+ODT fit by Stephen Hill)."""
    color = color * exposure / 0.6
    m1 = np.array([[0.59719, 0.07600, 0.02840], [0.35458, 0.90834, 0.13383], [0.04823, 0.01566, 0.83777]])
    m2 = np.array([[1.60475, -0.10208, -0.00327], [-0.53108, 1.10813, -0.07276], [-0.07367, -0.00605, 1.07602]])
    color = color @ m1
    a = color * (color + 0.0245786) - 0.000090537
    b = color * (0.983729 * color + 0.4329510) + 0.238081
    color = a / b
    color = color @ m2
    return np.clip(color, 0, 1)


def look_at_camera(az_deg, el_deg, dist, target_y, fov_deg=30.0, target_point=None):
    """Camera on +Z (azimuth turns the body, not the camera – as the app's stage does).
    `target_point`: a body point (before turning) to look at instead of (0, target_y, 0)."""
    el = math.radians(el_deg)
    turn = math.radians(az_deg)
    rot = np.array([[math.cos(turn), 0, math.sin(turn)], [0, 1, 0], [-math.sin(turn), 0, math.cos(turn)]])
    target = np.array([0.0, target_y, 0.0]) if target_point is None else rot @ np.asarray(target_point, float)
    eye = target + np.array([0.0, dist * math.sin(el), dist * math.cos(el)])
    f = target - eye
    f /= np.linalg.norm(f)
    r = np.cross(f, [0, 1, 0])
    r /= np.linalg.norm(r)
    u = np.cross(r, f)
    return {'eye': eye, 'r': r, 'u': u, 'f': f, 'fov': fov_deg, 'turn': rot}


def rasterize(P, tris, cam, W, H):
    """Visible triangle and barycentrics per pixel. P in world space (already turned)."""
    rel = P - cam['eye']
    xc = rel @ cam['r']
    yc = rel @ cam['u']
    zc = rel @ cam['f']
    t = math.tan(math.radians(cam['fov']) / 2)
    aspect = W / H
    sx = (xc / (zc * t * aspect) * 0.5 + 0.5) * W
    sy = (0.5 - yc / (zc * t) * 0.5) * H
    a, b, c = tris[:, 0], tris[:, 1], tris[:, 2]
    area = (sx[b] - sx[a]) * (sy[c] - sy[a]) - (sx[c] - sx[a]) * (sy[b] - sy[a])
    keep = (area < -1e-9) & (zc[a] > 0.05) & (zc[b] > 0.05) & (zc[c] > 0.05)  # front faces (y down)
    tid = np.nonzero(keep)[0]
    a, b, c = a[tid], b[tid], c[tid]
    x0 = np.floor(np.minimum(np.minimum(sx[a], sx[b]), sx[c])).astype(np.int64)
    x1 = np.ceil(np.maximum(np.maximum(sx[a], sx[b]), sx[c])).astype(np.int64)
    y0 = np.floor(np.minimum(np.minimum(sy[a], sy[b]), sy[c])).astype(np.int64)
    y1 = np.ceil(np.maximum(np.maximum(sy[a], sy[b]), sy[c])).astype(np.int64)
    x0 = np.clip(x0, 0, W - 1); x1 = np.clip(x1, 0, W - 1)
    y0 = np.clip(y0, 0, H - 1); y1 = np.clip(y1, 0, H - 1)
    bw = x1 - x0 + 1
    bh = y1 - y0 + 1
    ok = (bw > 0) & (bh > 0) & (bw * bh < 40000)
    tid, a, b, c, x0, y0, bw, bh = tid[ok], a[ok], b[ok], c[ok], x0[ok], y0[ok], bw[ok], bh[ok]
    best_depth = np.full(W * H, np.inf)
    best_tri = np.full(W * H, -1, dtype=np.int64)
    best_bary = np.zeros((W * H, 3))
    # Process in chunks to bound memory.
    sizes = bw * bh
    order = np.argsort(sizes)
    start = 0
    budget = 6_000_000
    while start < len(order):
        cum = np.cumsum(sizes[order[start:]])
        end = start + max(1, int(np.searchsorted(cum, budget)))
        sel = order[start:end]
        start = end
        n = sizes[sel]
        rep = np.repeat(np.arange(len(sel)), n)
        offs = np.arange(n.sum()) - np.repeat(np.cumsum(n) - n, n)
        px = x0[sel][rep] + offs % bw[sel][rep]
        py = y0[sel][rep] + offs // bw[sel][rep]
        fx = px + 0.5
        fy = py + 0.5
        ia, ib, ic = a[sel][rep], b[sel][rep], c[sel][rep]
        ar = area[tid[sel]][rep]
        w0 = ((sx[ib] - fx) * (sy[ic] - fy) - (sx[ic] - fx) * (sy[ib] - fy)) / ar
        w1 = ((sx[ic] - fx) * (sy[ia] - fy) - (sx[ia] - fx) * (sy[ic] - fy)) / ar
        w2 = 1 - w0 - w1
        inside = (w0 >= -1e-6) & (w1 >= -1e-6) & (w2 >= -1e-6)
        if not inside.any():
            continue
        px, py, w0, w1, w2 = px[inside], py[inside], w0[inside], w1[inside], w2[inside]
        ia, ib, ic = ia[inside], ib[inside], ic[inside]
        tri_ids = tid[sel][rep][inside]
        # Perspective-correct barycentrics.
        q0, q1, q2 = w0 / zc[ia], w1 / zc[ib], w2 / zc[ic]
        s = q0 + q1 + q2
        depth = 1 / s
        pix = py * W + px
        order2 = np.lexsort((depth, pix))
        pix, depth = pix[order2], depth[order2]
        first = np.ones(len(pix), bool)
        first[1:] = pix[1:] != pix[:-1]
        pix, depth = pix[first], depth[first]
        o = order2[first]
        better = depth < best_depth[pix]
        pix, depth, o = pix[better], depth[better], o[better]
        best_depth[pix] = depth
        best_tri[pix] = tri_ids[o]
        best_bary[pix] = np.stack([q0[o] / s[o], q1[o] / s[o], q2[o] / s[o]], 1)
    return best_tri, best_bary, best_depth


def sample_texture(tex, uv):
    """Bilinear sample (uv in [0,1], origin top-left as glTF)."""
    h, w = tex.shape[:2]
    x = np.clip(uv[:, 0], 0, 1) * (w - 1)
    y = np.clip(uv[:, 1], 0, 1) * (h - 1)
    x0 = np.floor(x).astype(int); y0 = np.floor(y).astype(int)
    x1 = np.minimum(x0 + 1, w - 1); y1 = np.minimum(y0 + 1, h - 1)
    fx = (x - x0)[:, None]; fy = (y - y0)[:, None]
    return (tex[y0, x0] * (1 - fx) * (1 - fy) + tex[y0, x1] * fx * (1 - fy)
            + tex[y1, x0] * (1 - fx) * fy + tex[y1, x1] * fx * fy)


def shade(N, V, albedo, rough, metal=0.0, spec_scale=1.0):
    """PBR shading of the app's light rig (lights fixed to the camera space = world here)."""
    up = N[:, 1]
    t = (0.5 * up + 0.5)[:, None]
    hemi = (srgb_to_linear(GROUND)[None] * (1 - t) + srgb_to_linear(SKY)[None] * t) * HEMI_INTENSITY
    diffuse = albedo * (1 - metal)
    f0 = 0.04 * (1 - metal) + albedo * metal
    out = diffuse / math.pi * hemi
    a = np.maximum(rough, 0.05) ** 2
    for d, col, inten in LIGHTS:
        L = np.array(d, float)
        L /= np.linalg.norm(L)
        c = hex_linear(col) * inten
        ndl = np.clip(N @ L, 0, 1)[:, None]
        Hh = L[None] + V
        Hh /= np.linalg.norm(Hh, axis=1, keepdims=True)
        ndh = np.clip((N * Hh).sum(1), 0, 1)
        ndv = np.clip((N * V).sum(1), 1e-4, 1)
        vdh = np.clip((V * Hh).sum(1), 0, 1)
        D = a ** 2 / (math.pi * ((ndh ** 2) * (a ** 2 - 1) + 1) ** 2)
        k = a / 2
        G = (ndv / (ndv * (1 - k) + k)) * (ndl[:, 0] / (ndl[:, 0] * (1 - k) + k + 1e-6))
        Fr = f0 + (1 - f0) * ((1 - vdh) ** 5)[:, None]
        spec = Fr * (D * G / (4 * ndv * np.maximum(ndl[:, 0], 1e-4) + 1e-6))[:, None] * spec_scale
        out = out + (diffuse / math.pi * (1 - Fr) + spec) * ndl * c
    return out
