"""Quick look at a stage dump: renders the raw surface in grey from several angles (dev tool)."""
import sys
import numpy as np
from PIL import Image
import meshio
import raster


def render_mesh(P, tris, N, albedo, rough, views, W=480, H=640, ss=2, bg=(0xEC, 0xE9, 0xE3)):
    images = []
    for az, el, dist, ty in views:
        cam = raster.look_at_camera(az, el, dist, ty)
        Pw = P @ cam['turn'].T
        Nw = N @ cam['turn'].T
        tri, bary, _ = raster.rasterize(Pw, tris, cam, W * ss, H * ss)
        img = np.zeros((H * ss * W * ss, 3))
        img[:] = raster.srgb_to_linear(np.array(bg) / 255.0)
        m = tri >= 0
        t = tris[tri[m]]
        b = bary[m]
        n = (Nw[t] * b[:, :, None]).sum(1)
        n /= np.linalg.norm(n, axis=1, keepdims=True)
        p = (Pw[t] * b[:, :, None]).sum(1)
        V = cam['eye'][None] - p
        V /= np.linalg.norm(V, axis=1, keepdims=True)
        alb = (albedo[t] * b[:, :, None]).sum(1) if albedo.ndim == 2 else np.broadcast_to(albedo, (len(n), 3))
        col = raster.shade(n, V, alb, rough)
        col = raster.aces_three(col)
        out = raster.linear_to_srgb(img.reshape(H * ss, W * ss, 3))
        flat = out.reshape(-1, 3)
        flat[m] = raster.linear_to_srgb(col)
        im = Image.fromarray((np.clip(out, 0, 1) * 255).astype(np.uint8)).resize((W, H), Image.LANCZOS)
        images.append(im)
    sheet = Image.new('RGB', (W * len(images), H))
    for i, im in enumerate(images):
        sheet.paste(im, (i * W, 0))
    return sheet


if __name__ == '__main__':
    body = meshio.load_stage_a(sys.argv[1])
    tris, _ = meshio.triangulate(body['faceOffsets'], body['faceVerts'])
    P = body['P']
    N = meshio.vertex_normals(P, tris)
    albedo = raster.srgb_to_linear(np.array([0xD6, 0xC8, 0xB0]) / 255.0)
    views = [(0, 6, 3.4, 0.9), (90, 6, 3.4, 0.9), (180, 6, 3.4, 0.9), (0, 4, 0.8, 1.6), (60, 4, 0.8, 1.6)]
    render_mesh(P, tris, N, albedo, 0.85, views).save(sys.argv[2])
