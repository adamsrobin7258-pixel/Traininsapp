"""Skin weight repair around the large joints (shoulder/armpit, elbow, hip/crotch, knee).

Cause of the measured creases (deform_metrics.py): MakeHuman's merged weights hand over from one
bone to the next within 1–3 cm at the armpit, the inner elbow, the groin and the back of the
knee. With linear blend skinning a short hand-over concentrates the whole bend in a narrow band:
the skin there is stretched several-fold or folds over. The repair widens the hand-over: the
weights are diffused over the surface inside a soft sphere around each joint (only between the
bones that meet there), then trimmed to four influences and renormalised. Bones, joint positions
and clips stay unchanged; hands and feet are left as they are (the grip is fitted to them).
"""
import numpy as np
import meshio

# joint (bind position of this bone), radius (m), passes, bones that may exchange weight
JOINTS = [
    ('upperArm_{s}', 0.11, 40, ['chest', 'shoulder_{s}', 'upperArm_{s}']),
    ('forearm_{s}', 0.07, 30, ['upperArm_{s}', 'forearm_{s}', 'forearmTwist_{s}']),
    ('thigh_{s}', 0.10, 35, ['pelvis', 'spine', 'thigh_{s}']),
    ('shin_{s}', 0.07, 30, ['thigh_{s}', 'shin_{s}']),
]


def repair(P, tris, wj, ww, names, joints, strength=0.5):
    n = len(P)
    W = np.zeros((n, len(names)))
    for k in range(4):
        np.add.at(W, (np.arange(n), wj[:, k]), ww[:, k])
    E = meshio.edges_of(tris)
    deg = np.bincount(E.ravel(), minlength=n).astype(float)
    deg[deg == 0] = 1
    for side in ('L', 'R'):
        for joint, radius, passes, bones in JOINTS:
            jname = joint.format(s=side)
            idx = [names.index(b.format(s=side)) for b in bones]
            c = np.array(joints[jname])
            d = np.linalg.norm(P - c, axis=1)
            x = np.clip(1 - d / radius, 0, 1)
            mask = x * x * (3 - 2 * x)
            # Only where these bones already own nearly all of the weight.
            own = W[:, idx].sum(1)
            mask *= np.clip((own - 0.6) / 0.3, 0, 1)
            sub = W[:, idx]
            for _ in range(passes):
                S = np.zeros_like(sub)
                np.add.at(S, E[:, 0], sub[E[:, 1]])
                np.add.at(S, E[:, 1], sub[E[:, 0]])
                sub = sub + (strength * mask)[:, None] * (S / deg[:, None] - sub)
            sub *= (own / np.maximum(sub.sum(1), 1e-12))[:, None]
            W[:, idx] = sub
    order = np.argsort(-W, 1)[:, :4]
    top = np.take_along_axis(W, order, 1)
    top /= np.maximum(top.sum(1, keepdims=True), 1e-12)
    return order.astype(np.uint8), top.astype(np.float32)
