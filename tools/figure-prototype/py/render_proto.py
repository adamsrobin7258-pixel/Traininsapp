"""Screenshots of the prototype without a GPU: renders the GLB the viewer loads (stage C) with the
viewer's look (look.json) – skin or muscle view, a clip time, a highlight – via raster.py.

Shading model (same as viewer/prototypeBody.mjs): stone base colour with object-space variation,
muscle groups tinted per vertex from _MUSCLE_GROUPS/_MUSCLE_WEIGHTS, the muscle view with the
fibre normal map. Labelled as software renders in every output.
"""
import json
import math
import os
import sys
import numpy as np
from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import raster  # noqa: E402

LOOK = json.load(open(os.path.join(HERE, '..', 'look.json')))


def hexlin(h):
    h = h.lstrip('#')
    return raster.srgb_to_linear(np.array([int(h[i:i + 2], 16) for i in (0, 2, 4)]) / 255.0)


def stone_noise(P, scale):
    n = LOOK['stone']['noise']
    acc = np.zeros(len(P))
    for d, ph in zip(n['dirs'], n['phases']):
        d = np.array(d) / np.linalg.norm(d)
        acc += np.sin(P @ d / scale * 2 * math.pi + ph)
    return acc / math.sqrt(3)


def stone_albedo(P_rest, base_hex):
    s = LOOK['stone']
    base = hexlin(base_hex)
    big = stone_noise(P_rest, s['variationLarge']['scale']) * s['variationLarge']['amount']
    fine = stone_noise(P_rest * 1.7, s['variationFine']['scale']) * s['variationFine']['amount']
    warm = stone_noise(P_rest + 3.1, s['variationLarge']['scale'] * 1.6) * s['warmCool']
    col = base[None] * (1 + big + fine)[:, None]
    col = col * (1 + np.stack([warm, 0 * warm, -warm], 1))
    return col


def muscle_mix(groups4, weights4, names, levels, view):
    """Per vertex: tint colour and mix amount (as the viewer's shader)."""
    mv = LOOK['muscleView']
    sv = LOOK['skinView']
    accent = hexlin(LOOK['accent'])
    gcol = np.array([hexlin(LOOK['groups'][g]) for g in names] + [hexlin(LOOK['stone']['color'])])
    any_hl = any(levels.values())
    mixes = []
    for g in names + [None]:
        lv = levels.get(g) if g else None
        if view == 'muscle':
            if g is None:
                mixes.append(0.0)
            elif lv == 'primary':
                mixes.append(mv['primaryMix'])
            elif lv == 'secondary':
                mixes.append(mv['secondaryMix'])
            else:
                mixes.append(mv['dimmedMix'] if any_hl else mv['baseMix'])
        else:
            mixes.append(sv['primaryMix'] if lv == 'primary' else sv['secondaryMix'] if lv == 'secondary' else 0.0)
    mixes = np.array(mixes)
    w = weights4 / 255.0
    if view == 'muscle':
        col = (gcol[groups4] * (w * mixes[groups4])[:, :, None]).sum(1)
        amt = (w * mixes[groups4]).sum(1)
        tint = col / np.maximum(amt, 1e-6)[:, None]
    else:
        amt = (w * mixes[groups4]).sum(1)
        tint = np.broadcast_to(accent, (len(w), 3))
    return tint, amt


_PYRAMIDS = {}


def pyramid(tex):
    """Mip levels (box filter) – the GPU samples a normal map from these, not the full texture."""
    key = id(tex)
    if key not in _PYRAMIDS:
        levels = [tex]
        while levels[-1].shape[0] > 8:
            t = levels[-1]
            t = 0.25 * (t[0::2, 0::2] + t[1::2, 0::2] + t[0::2, 1::2] + t[1::2, 1::2])
            levels.append(t)
        _PYRAMIDS[key] = levels
    return _PYRAMIDS[key]


def sample_mip(tex, uv, footprint):
    """Trilinear sample: footprint = texels per pixel (from the uv derivatives)."""
    levels = pyramid(tex)
    lod = np.clip(np.log2(np.maximum(footprint, 1e-6)), 0, len(levels) - 1)
    lo = np.floor(lod).astype(int)
    f = (lod - lo)[:, None]
    out = np.zeros((len(uv), tex.shape[2]))
    for L in np.unique(lo):
        m = lo == L
        a = raster.sample_texture(levels[L], uv[m])
        b = raster.sample_texture(levels[min(L + 1, len(levels) - 1)], uv[m])
        out[m] = a * (1 - f[m]) + b * f[m]
    return out


def render_scene(meshes, cam, W, H, ss=2, bg=(0xEC, 0xE9, 0xE3)):
    """meshes: dicts with P (corner positions), N, tris, albedo (n,3), rough,
    optional normal map (tex float [-1,1], uv, tangent)."""
    allP, allT, off, owner = [], [], 0, []
    for k, m in enumerate(meshes):
        allP.append(m['P'] @ cam['turn'].T)
        allT.append(m['tris'] + off)
        owner.append(np.full(len(m['tris']), k))
        off += len(m['P'])
    Pw = np.concatenate(allP)
    T = np.concatenate(allT)
    own = np.concatenate(owner)
    tri, bary, _ = raster.rasterize(Pw, T, cam, W * ss, H * ss)
    img = np.tile(raster.srgb_to_linear(np.array(bg) / 255.0), (W * ss * H * ss, 1))
    out = raster.linear_to_srgb(img)
    base = 0
    for k, m in enumerate(meshes):
        sel = (tri >= 0)
        sel[sel] = own[tri[sel]] == k
        if not sel.any():
            base += len(m['P']); continue
        t = T[tri[sel]] - base
        b = bary[sel]
        Nw = m['N'] @ cam['turn'].T
        n = (Nw[t] * b[:, :, None]).sum(1)
        n /= np.linalg.norm(n, axis=1, keepdims=True)
        if 'normal' in m:
            uv = (m['uv'][t] * b[:, :, None]).sum(1)
            # uv derivatives across neighbouring pixels → texture footprint (for the mip level).
            full = np.full((H * ss, W * ss, 2), np.nan)
            full.reshape(-1, 2)[sel] = uv
            du = np.nan_to_num(np.abs(np.diff(full, axis=1, append=full[:, -1:])), nan=0.0)
            dv = np.nan_to_num(np.abs(np.diff(full, axis=0, append=full[-1:])), nan=0.0)
            fp = np.maximum(du.max(2), dv.max(2)).reshape(-1)[sel] * m['normal'].shape[0] * ss
            fp = np.minimum(fp, 64)
            tg = (m['tangent'] @ cam['turn'].T)[t]
            tg = (tg * b[:, :, None]).sum(1)
            tg -= (tg * n).sum(1, keepdims=True) * n
            tg /= np.maximum(np.linalg.norm(tg, axis=1, keepdims=True), 1e-9)
            bt = np.cross(n, tg)
            s = sample_mip(m['normal'], uv, fp)
            s[:, :2] *= m.get('normalScale', 1.0)
            nn = tg * s[:, 0:1] + bt * s[:, 1:2] + n * s[:, 2:3]
            n = nn / np.linalg.norm(nn, axis=1, keepdims=True)
        p = (Pw[t + base] * b[:, :, None]).sum(1)
        V = cam['eye'][None] - p
        V /= np.linalg.norm(V, axis=1, keepdims=True)
        alb = (m['albedo'][t] * b[:, :, None]).sum(1)
        col = raster.shade(n, V, alb, m['rough'], spec_scale=m.get('spec', 1.0))
        out[sel] = raster.linear_to_srgb(raster.aces_three(col))
        base += len(m['P'])
    im = Image.fromarray((np.clip(out.reshape(H * ss, W * ss, 3), 0, 1) * 255).astype(np.uint8))
    return im.resize((W, H), Image.LANCZOS)


def label(im, text):
    d = ImageDraw.Draw(im)
    d.text((8, 6), text, fill=(90, 86, 80))
    return im
