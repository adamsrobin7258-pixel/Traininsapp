/**
 * Minimal glTF 2.0 binary (GLB) writer – enough for a skinned, animated body with textures.
 * No dependencies; every buffer view is 4-byte aligned.
 */
const COMPONENT = { 5121: 1, 5123: 2, 5125: 4, 5126: 4 };
const TYPE_SIZE = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 };

export class GltfBuilder {
  constructor() {
    this.json = {
      asset: { version: '2.0', generator: 'Kalethra figure build (tools/figures)' },
      scene: 0,
      scenes: [{ nodes: [] }],
      nodes: [],
      meshes: [],
      materials: [],
      accessors: [],
      bufferViews: [],
      buffers: [{ byteLength: 0 }],
    };
    this.chunks = [];
    this.length = 0;
  }

  view(bytes, target) {
    const pad = (4 - (this.length % 4)) % 4;
    if (pad) {
      this.chunks.push(new Uint8Array(pad));
      this.length += pad;
    }
    const view = { buffer: 0, byteOffset: this.length, byteLength: bytes.byteLength };
    if (target) view.target = target;
    this.chunks.push(new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength));
    this.length += bytes.byteLength;
    this.json.bufferViews.push(view);
    return this.json.bufferViews.length - 1;
  }

  /** Adds an accessor; `array` is a typed array, `type` SCALAR/VEC2/… */
  accessor(array, type, { target, minMax = false, normalized = false } = {}) {
    const componentType =
      array instanceof Float32Array
        ? 5126
        : array instanceof Uint32Array
          ? 5125
          : array instanceof Uint16Array
            ? 5123
            : 5121;
    const size = TYPE_SIZE[type];
    const accessor = {
      bufferView: this.view(array, target),
      componentType,
      count: array.length / size,
      type,
    };
    if (normalized) accessor.normalized = true;
    if (minMax) {
      const min = new Array(size).fill(Infinity);
      const max = new Array(size).fill(-Infinity);
      for (let i = 0; i < array.length; i++) {
        const c = i % size;
        if (array[i] < min[c]) min[c] = array[i];
        if (array[i] > max[c]) max[c] = array[i];
      }
      accessor.min = min.map((v) => Math.fround(v));
      accessor.max = max.map((v) => Math.fround(v));
    }
    this.json.accessors.push(accessor);
    return this.json.accessors.length - 1;
  }

  add(kind, item) {
    (this.json[kind] ??= []).push(item);
    return this.json[kind].length - 1;
  }

  image(png, name) {
    const bufferView = this.view(png);
    return this.add('images', { name, mimeType: 'image/png', bufferView });
  }

  toGlb() {
    const bin = new Uint8Array(this.length + ((4 - (this.length % 4)) % 4));
    let offset = 0;
    for (const chunk of this.chunks) {
      bin.set(chunk, offset);
      offset += chunk.byteLength;
    }
    this.json.buffers[0].byteLength = bin.byteLength;
    for (const key of Object.keys(this.json)) {
      if (Array.isArray(this.json[key]) && this.json[key].length === 0) delete this.json[key];
    }
    let jsonText = JSON.stringify(this.json);
    while (Buffer.byteLength(jsonText) % 4) jsonText += ' ';
    const jsonBytes = Buffer.from(jsonText);
    const total = 12 + 8 + jsonBytes.byteLength + 8 + bin.byteLength;
    const out = Buffer.alloc(total);
    out.writeUInt32LE(0x46546c67, 0);
    out.writeUInt32LE(2, 4);
    out.writeUInt32LE(total, 8);
    out.writeUInt32LE(jsonBytes.byteLength, 12);
    out.writeUInt32LE(0x4e4f534a, 16);
    jsonBytes.copy(out, 20);
    const binStart = 20 + jsonBytes.byteLength;
    out.writeUInt32LE(bin.byteLength, binStart);
    out.writeUInt32LE(0x004e4942, binStart + 4);
    Buffer.from(bin.buffer, bin.byteOffset, bin.byteLength).copy(out, binStart + 8);
    return out;
  }
}
