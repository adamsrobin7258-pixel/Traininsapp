"""Posed geometry of a GLB at a clip time (for screenshots): every skinned primitive with its
attributes, skinned like three.js (LBS, morph target first), props placed by their clip tracks."""
import numpy as np
from glb_read import load_glb, accessor
from deform_metrics import Rig, skin, quat_mat, corrective_weights


def node_world(g, pose, parent, i):
    n = g['nodes'][i]
    p = pose.get(i, {})
    M = np.eye(4)
    M[:3, :3] = quat_mat(p.get('rotation', n.get('rotation', [0, 0, 0, 1]))) * np.array(p.get('scale', n.get('scale', [1, 1, 1])))
    M[:3, 3] = p.get('translation', n.get('translation', [0, 0, 0]))
    return (node_world(g, pose, parent, parent[i]) @ M) if i in parent else M


def posed_meshes(path, clip='rest', t=0.0, morph=0.0, visible=lambda name: True):
    g, b = load_glb(path)
    rig = Rig(g, b)
    anim = next(a for a in g['animations'] if a['name'] == clip)
    pose = rig.sample(anim, t)
    M = rig.skin_matrices(pose)
    root = next((n for n in g['nodes'] if n['name'].startswith('kalethra_')), {})
    drivers = (root.get('extras') or {}).get('correctives', [])
    node_of = {g['nodes'][j]['name']: j for j in rig.joints}
    fix = corrective_weights(drivers, pose, node_of)
    out = []
    equipment = clip.split('_')[1] if '_' in clip else None
    for i, n in enumerate(g['nodes']):
        if 'mesh' not in n or not visible(n['name']):
            continue
        if n['name'].startswith('prop_') and n['name'].split('_')[1] != equipment:
            continue
        for p in g['meshes'][n['mesh']]['primitives']:
            at = p['attributes']
            P = accessor(g, b, at['POSITION']).astype(float)
            P0 = P.copy()  # the shader's `position` (stone pattern): before any morph
            N = accessor(g, b, at['NORMAL']).astype(float)
            if morph and p.get('targets'):
                P = P + morph * accessor(g, b, p['targets'][0]['POSITION']).astype(float)
                if 'NORMAL' in p['targets'][0]:
                    N = N + morph * accessor(g, b, p['targets'][0]['NORMAL']).astype(float)
            for w, tgt in zip(fix, p.get('targets', [])[1:]):
                if w > 0:
                    P = P + w * accessor(g, b, tgt['POSITION']).astype(float)
            T = accessor(g, b, p['indices']).reshape(-1, 3).astype(int)
            item = {'name': n['name'], 'material': g['materials'][p['material']]['name'], 'P_rest': P0, 'tris': T}
            if 'skin' in n:
                J = accessor(g, b, at['JOINTS_0']).astype(int)
                W = accessor(g, b, at['WEIGHTS_0']).astype(float)
                item['P'] = skin(M, P, J, W)
                Nh = np.zeros_like(N)
                for k in range(4):
                    Nh += W[:, k:k + 1] * np.einsum('nij,nj->ni', M[J[:, k]][:, :3, :3], N)
                item['N'] = Nh / np.maximum(np.linalg.norm(Nh, axis=1, keepdims=True), 1e-12)
                if 'TANGENT' in at:
                    Tg = accessor(g, b, at['TANGENT']).astype(float)[:, :3]
                    Th = np.zeros_like(Tg)
                    for k in range(4):
                        Th += W[:, k:k + 1] * np.einsum('nij,nj->ni', M[J[:, k]][:, :3, :3], Tg)
                    item['tangent'] = Th
            else:
                parent = {}
                for k, nn in enumerate(g['nodes']):
                    for c in nn.get('children', []):
                        parent[c] = k
                Wm = node_world(g, pose, parent, i)
                item['P'] = P @ Wm[:3, :3].T + Wm[:3, 3]
                Nn = N @ Wm[:3, :3].T
                item['N'] = Nn / np.maximum(np.linalg.norm(Nn, axis=1, keepdims=True), 1e-12)
            if 'TEXCOORD_0' in at:
                item['uv'] = accessor(g, b, at['TEXCOORD_0']).astype(float)
            if '_MUSCLE_GROUPS' in at:
                item['groups4'] = accessor(g, b, at['_MUSCLE_GROUPS']).astype(int)
                item['weights4'] = np.round(accessor(g, b, at['_MUSCLE_WEIGHTS']) * 255).astype(int)
            out.append(item)
    heads = {}
    for k, j in enumerate(rig.joints):
        heads[rig.names[k]] = (M[k] @ np.r_[rig.bind[rig.names[k]], 1])[:3]
    return g, b, out, heads
