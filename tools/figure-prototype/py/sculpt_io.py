"""Reading the modelled male anatomy (assets/figure/male/source/kalethra-male-sculpt.bin.gz).

Same layout as tools/figures/lib/transfer.mjs → readSculpt: uint32 header length, JSON header,
int16 positions (header.positionUnit), int8 form and sculpt normals, uint8 part and label.
"""
import gzip
import json
import struct
import numpy as np


def read_sculpt(path):
    raw = gzip.open(path, 'rb').read()
    (hl,) = struct.unpack_from('<I', raw, 0)
    header = json.loads(raw[4:4 + hl].decode('utf8'))
    n = header['count']
    o = 4 + hl

    def take(dtype, count):
        nonlocal o
        size = np.dtype(dtype).itemsize * count
        a = np.frombuffer(raw[o:o + size], dtype=dtype).copy()
        o += size
        return a

    pos = take(np.int16, n * 3).reshape(-1, 3) * header['positionUnit']
    fn = take(np.int8, n * 3).reshape(-1, 3).astype(float)
    sn = take(np.int8, n * 3).reshape(-1, 3).astype(float)
    part = take(np.uint8, n)
    label = take(np.uint8, n) if header.get('labels') else None
    fn /= np.maximum(np.linalg.norm(fn, axis=1, keepdims=True), 1e-9)
    sn /= np.maximum(np.linalg.norm(sn, axis=1, keepdims=True), 1e-9)
    return {'P': pos, 'formN': fn, 'sculptN': sn, 'part': part, 'label': label,
            'labels': header.get('labels', [])}
