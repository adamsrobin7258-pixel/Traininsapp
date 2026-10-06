/** RGB(A) PNG encoder on top of node:zlib (no dependencies). */
import { deflateSync } from 'node:zlib';

const CRC = new Int32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c;
});
function crc32(bytes) {
  let c = -1;
  for (const b of bytes) c = CRC[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}
function chunk(type, data) {
  const head = Buffer.alloc(8);
  head.writeUInt32BE(data.length, 0);
  head.write(type, 4, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([Buffer.from(type, 'ascii'), data])), 0);
  return Buffer.concat([head, data, crc]);
}

/** `pixels`: Uint8Array, rows top to bottom, `channels` 3 or 4. */
export function encodePng(width, height, pixels, channels = 3) {
  const stride = width * channels;
  const raw = Buffer.alloc((stride + 1) * height);
  const candidate = Buffer.alloc(stride);
  const best = Buffer.alloc(stride);
  const at = (y, x) => (y < 0 || x < 0 ? 0 : pixels[y * stride + x]);
  for (let y = 0; y < height; y++) {
    // Adaptive filter per row (the one with the smallest absolute sum), as libpng does.
    let bestType = 0;
    let bestSum = Infinity;
    for (let type = 0; type < 5; type++) {
      let sum = 0;
      for (let x = 0; x < stride; x++) {
        const value = pixels[y * stride + x];
        const a = at(y, x - channels);
        const b = at(y - 1, x);
        const c = at(y - 1, x - channels);
        let predicted = 0;
        if (type === 1) predicted = a;
        else if (type === 2) predicted = b;
        else if (type === 3) predicted = (a + b) >> 1;
        else if (type === 4) {
          const p = a + b - c;
          const pa = Math.abs(p - a);
          const pb = Math.abs(p - b);
          const pc = Math.abs(p - c);
          predicted = pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
        }
        const out = (value - predicted) & 0xff;
        candidate[x] = out;
        sum += out < 128 ? out : 256 - out;
      }
      if (sum < bestSum) {
        bestSum = sum;
        bestType = type;
        candidate.copy(best);
      }
    }
    raw[y * (stride + 1)] = bestType;
    best.copy(raw, y * (stride + 1) + 1);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = channels === 4 ? 6 : 2;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}
