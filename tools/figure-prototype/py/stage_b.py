"""Prototype stage B – skin form, muscle (écorché) form, hair, drape, eyes, muscle groups and the
fibre normal map of the male prototype. Reads stage A's dump, writes WORK/b/ for stage C.

  python3 tools/figure-prototype/py/stage_b.py <stage A folder> <out folder>

Every step is deterministic (no random state without a fixed seed).
"""
import json
import os
import sys
import time
import pickle
import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import meshio  # noqa: E402
import skinform  # noqa: E402
import ecorche  # noqa: E402
import muscleform  # noqa: E402
import parts  # noqa: E402
import fibres  # noqa: E402
import weights as weightfix  # noqa: E402
from sculpt_io import read_sculpt  # noqa: E402

ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..'))
SCULPT = os.path.join(ROOT, 'assets/figure/male/source/kalethra-male-sculpt.bin.gz')
FIBRE_MAP = int(os.environ.get('FIBRE_MAP', 4096))
GROUPS = ['adductors', 'back', 'biceps', 'calves', 'chest', 'core', 'forearms', 'glutes',
          'hamstrings', 'lats', 'quadriceps', 'shoulders', 'triceps']

t0 = time.time()


def log(msg):
    print(f'[B {time.time() - t0:5.0f}s] {msg}', flush=True)


def main(src, out):
    os.makedirs(out, exist_ok=True)
    body = meshio.load_stage_a(src)
    tris, owner, tris_t = meshio.triangulate(body['faceOffsets'], body['faceVerts'], body['faceUvs'])
    E = meshio.edges_of(tris)
    n = len(body['P'])
    J = body['joints']
    P = body['P']

    cache = os.path.join(out, 'cache_forms.pkl')
    sp = skinform.soft_parts(body)
    if os.environ.get('REUSE') and os.path.exists(cache):  # noqa: SIM108
        # Development shortcut: reuse fitted skin form and anatomy sheets of the last run.
        P_skin, dy, eco = pickle.load(open(cache, 'rb'))
        N_skin = meshio.vertex_normals(P_skin, tris)
        log('reused skin form and anatomy (REUSE)')
    else:
        # ── 1. Skin form: the fine mesh fitted onto the modelled anatomy ────────────────────────────
        detail, kept = skinform.map_coarse(body)
        detail = meshio.smooth_field(detail, E, n, 12)
        kept = meshio.smooth_field(kept, E, n, 12)
        sculpt = read_sculpt(SCULPT)
        dy = skinform.floor_offset(P, (detail > 0.99) & (P[:, 1] > 0.9) & (P[:, 1] < 1.4), sculpt)
        part = skinform.soft_parts(body).argmax(1)
        fit_w = detail * (1 - kept)
        P_skin, _ = skinform.fit_to_sculpt(P, tris, fit_w, sculpt, dy, part)
        neck = skinform.bone_share(body, 'neck') + 0.6 * np.clip(kept * (1 - kept) * 4, 0, 1)
        P_skin = skinform.taubin(P_skin, tris, np.clip(neck, 0, 1) * 0.8 + 0.15 * fit_w, iters=12)
        log(f'skin form fitted (floor shift {dy * 1000:.1f} mm)')

        # ── 2. Anatomy sheets and the muscle form ──────────────────────────────────────────────────
        N_skin = meshio.vertex_normals(P_skin, tris)
        to_b = lambda names: [ecorche.to_blender(np.array([J[k]]))[0] + [0, 0, dy] for k in names]  # noqa: E731
        chains = {'arm': to_b(('upperArm_L', 'forearm_L', 'hand_L')), 'leg': to_b(('thigh_L', 'shin_L', 'foot_L'))}
        eb = ecorche.Body(ecorche.to_blender(P_skin) + [0, 0, dy], ecorche.to_blender(N_skin), tris, sp, chains)
        S, failed = ecorche.run_anatomy(eb)
        if failed:
            log(f'anatomy: {len(failed)} landmarks missed: {failed[:5]}')
        log(f'anatomy: {len(S.sheets)} sheets')
        eco = {'H': S.H, 'G': S.G, 'bumps': S.bumps, 'sheets': S.sheets}
        pickle.dump((P_skin, dy, eco), open(cache, 'wb'))
    # Collapsed spots of the fit (the transfer squeezes MakeHuman's nipple rings into a point,
    # edges under 0.5 mm): spread them out along the surface again, then fair lightly.
    el = np.linalg.norm(P_skin[E[:, 0]] - P_skin[E[:, 1]], axis=1)
    short = np.zeros(n)
    short[E[el < 0.0005].ravel()] = 1
    if short.any():
        spot = np.clip(meshio.smooth_field(short, E, n, 4, 0.5) / 0.01, 0, 1)
        P_skin = skinform.relax_tangential(P_skin, tris, spot, iters=150)
        P_skin = skinform.taubin(P_skin, tris, spot, iters=6)
        N_skin = meshio.vertex_normals(P_skin, tris)
        log(f'skin form: {int(short.sum())} vertices of collapsed spots spread out')
    neutral = sp[:, 5].copy()
    for name in body['jointNames']:
        if name.startswith(('hand_', 'foot_', 'thumb', 'index', 'middle', 'ring', 'pinky')):
            neutral += skinform.bone_share(body, name)
    neutral = meshio.smooth_field(np.clip(neutral, 0, 1), E, n, 6)
    disp, bid, best = muscleform.muscle_form(P_skin, tris, eco, neutral)
    # Nipples are skin: in the muscle form the chest is faired where it stands out locally.
    lap = meshio.smooth_field(P_skin, E, n, 1, 1.0) - P_skin
    bump = -(lap * N_skin).sum(1)
    chest = np.zeros(n)
    for sh in eco['sheets']:
        if sh['label'] and sh['label'].startswith('chest'):
            chest[sh['cand']] = np.maximum(chest[sh['cand']], sh['cov'])
    # Nipples are skin, the écorché has none – and the lower chest groove runs right through
    # MakeHuman's small nipple geometry, which then crumples. Per chest half the crumpled faces
    # (normal against the surface around them) mark the nipple; a 2.5 cm disc there is faired.
    P_muscle = P_skin + disp[:, None] * N_skin

    def disagreeing(P):
        fn = np.cross(P[tris[:, 1]] - P[tris[:, 0]], P[tris[:, 2]] - P[tris[:, 0]])
        fn /= np.maximum(np.linalg.norm(fn, axis=1, keepdims=True), 1e-18)
        vn = meshio.smooth_field(meshio.vertex_normals(P, tris), E, n, 4, 0.5)
        vn /= np.maximum(np.linalg.norm(vn, axis=1, keepdims=True), 1e-18)
        return (fn * vn[tris].mean(1)).sum(1) < 0.3

    bad_tri = disagreeing(P_muscle)
    cent = P_muscle[tris].mean(1)
    nip = np.zeros(n)
    for side in (1, -1):
        on_chest = chest[tris].max(1) > 0.2
        sel = bad_tri & on_chest & (np.sign(cent[:, 0]) == side)
        if sel.sum() >= 3:
            c = np.median(cent[sel], 0)
        else:
            cand = (chest > 0.2) & (np.sign(P_skin[:, 0]) == side)
            c = P_skin[np.nonzero(cand)[0][np.argmax(P_skin[cand, 2])]]
        log(f'nipple {"LR"[side < 0]} at {np.round(c, 3).tolist()} ({int(sel.sum())} crumpled faces)')
        d = np.linalg.norm(P_skin - c, axis=1)
        nip = np.maximum(nip, parts.smoothstep(1.4 - d / 0.025))
    P_muscle = skinform.taubin(P_muscle, tris, np.clip(nip, 0, 1), iters=80)
    # Crumpled spots (the nipple's own small geometry where the lower chest groove runs through
    # it): faces that disagree with the surface around them are faired away, a few rounds.
    for _ in range(4):
        fn = np.cross(P_muscle[tris[:, 1]] - P_muscle[tris[:, 0]], P_muscle[tris[:, 2]] - P_muscle[tris[:, 0]])
        fn /= np.maximum(np.linalg.norm(fn, axis=1, keepdims=True), 1e-18)
        vn = meshio.smooth_field(meshio.vertex_normals(P_muscle, tris), E, n, 4, 0.5)
        vn /= np.maximum(np.linalg.norm(vn, axis=1, keepdims=True), 1e-18)
        agree = (fn * vn[tris].mean(1)).sum(1)
        bad = np.zeros(n)
        bad[tris[(agree < 0.3) & (neutral[tris].max(1) < 0.5)].ravel()] = 1
        if not bad.any():
            break
        spot = np.clip(meshio.smooth_field(bad, E, n, 5, 0.5) / 0.01, 0, 1)
        P_muscle = skinform.taubin(P_muscle, tris, spot, iters=30)
        log(f'muscle form: faired {int(bad.sum())} crumpled vertices')
    N_muscle = meshio.vertex_normals(P_muscle, tris)
    log(f'muscle form: displacement {np.percentile(disp * 1000, 1):.1f} … {np.percentile(disp * 1000, 99):.1f} mm, nipple fairing {(nip > 0).sum()} vertices')

    # ── 3. Regions and muscle groups (contract names) ──────────────────────────────────────────
    regions = body['regions']
    face_region = np.array(regions)[body['faceRegion'][owner]]
    # The muscle view follows the anatomy sheets: where a labelled sheet dominates a triangle,
    # its region wins over the segmentation rules (colour borders run in the modelled grooves).
    labels = [sh['label'] for sh in eco['sheets']]
    vlab = np.array([labels[i] if i >= 0 and labels[i] else '' for i in bid], dtype=object)
    tri_lab = []
    for k, t in enumerate(tris):
        cand = [vlab[v] for v in t if vlab[v]]
        if len(cand) >= 2 and not face_region[k].startswith('skin_head'):
            tri_lab.append(max(set(cand), key=cand.count))
        else:
            tri_lab.append(face_region[k])
    tri_lab = np.array(tri_lab, dtype=object)
    # Soft group weights per vertex (as tools/figures/lib/highlight.mjs: 30 passes, contrast 3.2).
    gi = np.array([GROUPS.index(l.split('_')[0]) if not l.startswith('skin_') else len(GROUPS)
                   for l in tri_lab])
    area = np.linalg.norm(np.cross(P_skin[tris[:, 1]] - P_skin[tris[:, 0]], P_skin[tris[:, 2]] - P_skin[tris[:, 0]]), axis=1)
    W = np.zeros((n, len(GROUPS) + 1))
    for k in range(3):
        np.add.at(W, (tris[:, k], gi), area)
    W /= np.maximum(W.sum(1, keepdims=True), 1e-12)
    W = meshio.smooth_field(W, E, n, 30, 0.5)
    W = W ** 3.2
    order = np.argsort(-W, 1)[:, :4]
    topw = np.take_along_axis(W, order, 1)
    topw /= np.maximum(topw.sum(1, keepdims=True), 1e-12)
    groups4 = order.astype(np.uint8)
    weights4 = np.round(topw * 255).astype(np.int64)
    weights4[:, 0] += 255 - weights4.sum(1)
    log('regions and muscle groups')

    # ── 3b. Skin weights: wider hand-over at shoulder, elbow, hip and knee ─────────────────────
    if os.environ.get('WEIGHTS', '1') != '0':
        wj, ww = weightfix.repair(P_skin, tris, body['wj'], body['ww'], body['jointNames'], J)
        log('skin weights repaired around shoulder, elbow, hip, knee')
    else:
        wj, ww = body['wj'].astype(np.uint8), body['ww'].astype(np.float32)

    # ── 4. Hair, drape, eyes ───────────────────────────────────────────────────────────────────
    head = skinform.bone_share(body, 'head')
    eye_l = body['helpers']['helper-l-eye']['P']
    eye_r = body['helpers']['helper-r-eye']['P']
    centre = parts.head_frame(P_skin, head)
    hf, phi, h = parts.hair_field(P_skin, head, eye_l.mean(0)[1], centre)
    hf = meshio.smooth_field(hf, E, n, 3, 0.5)
    hair = parts.region_component(
        P_skin, tris, hf, head > 0.05,
        thickness=lambda used, f, border: 0.0004 + 0.0092 * parts.smoothstep(f / 0.03),
        relief=lambda Q, Nq, used: parts.hair_relief(centre)(Q, Nq, used) * parts.smoothstep(hf[used] / 0.012),
        rim_depth=0.0006,
    )
    shorts_v = np.zeros(n, bool)
    shorts_v[tris[body['faceShorts'][owner] == 1].ravel()] = True
    df, band = parts.drape_field(P_skin, J, shorts_v, E, n)
    drape_relief = parts.drape_relief(J)
    drape = parts.region_component(
        P_skin, tris, df, band,
        thickness=lambda used, f, border: 0.0028 + 0.0012 * parts.smoothstep(f / 0.012),
        relief=lambda Q, Nq, used: drape_relief(Q, Nq, used) * parts.smoothstep(df[used] / 0.008 + 0.2),
        rim_depth=0.0015,
    )
    eyes = []
    for E_ in (eye_l, eye_r):
        c = E_.mean(0)
        r = np.linalg.norm(E_ - c, axis=1).mean()
        eyes.append(parts.eye_sphere(c, r * 0.985))
    log(f'hair {len(hair["tris"])} tris, drape {len(drape["tris"])} tris, eyes 2× {len(eyes[0][1])} tris')

    # ── 5. Tangents per corner (uv index) and the fibre normal map ─────────────────────────────
    uv = body['uvs']
    tan_tri = fibres.tangents(P_skin, N_skin, uv, tris, tris_t, len(uv))
    Tg = np.zeros((len(uv), 3))
    for k in range(3):
        np.add.at(Tg, tris_t[:, k], tan_tri)
    corner_vertex = np.full(len(uv), -1)
    corner_vertex[tris_t.ravel()] = tris.ravel()
    used_c = corner_vertex >= 0
    Nc = N_skin[np.maximum(corner_vertex, 0)]
    Tg -= (Tg * Nc).sum(1, keepdims=True) * Nc
    Tg /= np.maximum(np.linalg.norm(Tg, axis=1, keepdims=True), 1e-12)
    # Fibre coordinates: the engine's inverse-distance interpolation is piecewise – smooth u and
    # s inside each sheet, or the ridges zigzag across the triangles.
    for sh in eco['sheets']:
        fibres.smooth_sheet(sh, E, n, iters=20)
    img, H = fibres.bake_fibres(P_muscle, N_muscle, Tg, tris, tris_t, uv,
                                eco['sheets'], FIBRE_MAP, neutral)
    Image.fromarray(img).save(os.path.join(out, 'fibre_normal.png'), optimize=True)
    log(f'fibre normal map {FIBRE_MAP}² ({os.path.getsize(os.path.join(out, "fibre_normal.png")) / 1e6:.1f} MB)')

    # ── 6. Write ───────────────────────────────────────────────────────────────────────────────
    def save(name, a):
        a.tofile(os.path.join(out, name))
        return {'file': name, 'type': {np.dtype('float32'): 'Float32Array', np.dtype('int32'): 'Int32Array',
                                       np.dtype('uint8'): 'Uint8Array', np.dtype('uint32'): 'Uint32Array'}[a.dtype],
                'length': int(a.size)}

    region_names = sorted(set(tri_lab))
    meta = {
        'regions': region_names,
        'groups': GROUPS,
        'arrays': {
            'skin': save('skin.f32', P_skin.astype(np.float32).ravel()),
            'skinNormals': save('skinNormals.f32', N_skin.astype(np.float32).ravel()),
            'muscle': save('muscle.f32', P_muscle.astype(np.float32).ravel()),
            'muscleNormals': save('muscleNormals.f32', N_muscle.astype(np.float32).ravel()),
            'tris': save('tris.i32', tris.astype(np.int32).ravel()),
            'trisUv': save('trisUv.i32', tris_t.astype(np.int32).ravel()),
            'triRegion': save('triRegion.i32', np.array([region_names.index(l) for l in tri_lab], np.int32)),
            'uvs': save('uvs.f32', uv.astype(np.float32).ravel()),
            'tangents': save('tangents.f32', Tg.astype(np.float32).ravel()),
            'groups4': save('groups4.u8', groups4.ravel()),
            'weightJoints': save('weightJoints.u8', np.ascontiguousarray(wj).ravel()),
            'weightValues': save('weightValues.f32', np.ascontiguousarray(ww).ravel()),
            'weights4': save('weights4.u8', weights4.astype(np.uint8).ravel()),
        },
        'components': {},
        'fibreMap': 'fibre_normal.png',
        'floorShift': dy,
    }
    for name, comp in (('hair', hair), ('drape', drape)):
        Nc_ = meshio.vertex_normals(comp['P'], comp['tris'])
        # Rim: a soft bevel – its top edge leans towards the top surface's normal, its foot takes
        # the skin's normal (no dark seam where the rim meets the light).
        nt, nb_ = comp['n_top'], comp['nb']
        top_n = Nc_[comp['border']]
        bev = top_n * 0.65 + Nc_[nt:nt + nb_] * 0.35
        Nc_[nt:nt + nb_] = bev / np.linalg.norm(bev, axis=1, keepdims=True)
        Nc_[nt + nb_:] = N_skin[comp['src'][nt + nb_:]]
        meta['components'][name] = {
            'positions': save(f'{name}.positions.f32', comp['P'].astype(np.float32).ravel()),
            'normals': save(f'{name}.normals.f32', Nc_.astype(np.float32).ravel()),
            'tris': save(f'{name}.tris.i32', comp['tris'].astype(np.int32).ravel()),
            'src': save(f'{name}.src.i32', comp['src'].astype(np.int32).ravel()),
        }
    for k, (Pe, Te) in enumerate(eyes):
        name = f'eye_{"LR"[k]}'
        Ne = (Pe - Pe.mean(0)) / np.linalg.norm(Pe - Pe.mean(0), axis=1, keepdims=True)
        meta['components'][name] = {
            'positions': save(f'{name}.positions.f32', Pe.astype(np.float32).ravel()),
            'normals': save(f'{name}.normals.f32', Ne.astype(np.float32).ravel()),
            'tris': save(f'{name}.tris.i32', Te.astype(np.int32).ravel()),
            'bone': 'head',
        }
    json.dump(meta, open(os.path.join(out, 'proto.json'), 'w'), indent=1)
    pickle.dump({'bid': bid, 'neutral': neutral, 'hairField': hf, 'drapeField': df},
                open(os.path.join(out, 'debug.pkl'), 'wb'))
    log('written')


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
