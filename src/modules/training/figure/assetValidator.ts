/**
 * File-level validator for a Kalethra body asset (GLB): reads the binary container and checks it
 * against the asset contract and the budgets – without three.js, so it runs in tests and CI on
 * the bundled files. The loader additionally checks names at runtime (`validateFigureAsset`).
 *
 * Checks: container (magic, version, chunks, JSON), references (every index points to something
 * that exists, buffer views stay inside the binary chunk), safe names, the contract (muscle groups,
 * bones, clips, rest clip), the optional soft-highlight attributes, variant, materials, textures
 * (size from the image header), triangles,
 * file size, and the coordinate system (metres, +Y up, +Z front, floor at y = 0, origin under the
 * body) from the bind-pose bounds of the body meshes.
 */
import {
  ASSET_BUDGET,
  BODY_NODE_PREFIX,
  MUSCLE_NODE_PREFIX,
  PROP_NODE_PREFIX,
  SAFE_NAME,
  muscleGroupOfNode,
  validateFigureAsset,
  type AssetReport,
  type FigureVariant,
} from './contract';

/** Plausible standing height of an adult figure in metres – catches cm/mm or inch exports. */
export const HEIGHT_RANGE = [1.45, 2.05] as const;
/** Floor and centring tolerances (metres). */
export const FLOOR_TOLERANCE = 0.02;
export const CENTRE_TOLERANCE = 0.06;

export interface GlbStats {
  bytes: number;
  triangles: number;
  materials: number;
  textures: { width: number; height: number }[];
  /** Bind-pose bounds of the body meshes (metres). */
  bounds: { min: [number, number, number]; max: [number, number, number] } | null;
  variant: string | null;
  bones: string[];
  clips: string[];
}

export interface GlbReport {
  ok: boolean;
  errors: string[];
  stats: GlbStats;
  contract: AssetReport | null;
}

interface Json {
  asset?: { version?: string; extras?: { kalethra?: { variant?: string; units?: string } } };
  scene?: number;
  scenes?: { nodes?: number[] }[];
  nodes?: {
    name?: string;
    extras?: { muscleGroups?: unknown };
    mesh?: number;
    skin?: number;
    children?: number[];
    translation?: number[];
    rotation?: number[];
    scale?: number[];
    matrix?: number[];
  }[];
  meshes?: {
    primitives?: {
      attributes?: Record<string, number>;
      indices?: number;
      material?: number;
      mode?: number;
    }[];
  }[];
  materials?: {
    name?: string;
    normalTexture?: { index?: number };
    pbrMetallicRoughness?: {
      baseColorTexture?: { index?: number };
      metallicRoughnessTexture?: { index?: number };
    };
  }[];
  textures?: { source?: number; sampler?: number }[];
  images?: { bufferView?: number; uri?: string; mimeType?: string }[];
  samplers?: unknown[];
  skins?: { joints?: number[]; inverseBindMatrices?: number; skeleton?: number }[];
  animations?: {
    name?: string;
    channels?: { sampler?: number; target?: { node?: number; path?: string } }[];
    samplers?: { input?: number; output?: number }[];
  }[];
  accessors?: {
    bufferView?: number;
    count?: number;
    normalized?: boolean;
    min?: number[];
    max?: number[];
    type?: string;
    componentType?: number;
  }[];
  bufferViews?: { buffer?: number; byteOffset?: number; byteLength?: number }[];
  buffers?: { byteLength?: number; uri?: string }[];
}

/** Width and height from a PNG or JPEG header, or `null`. */
export function imageSize(bytes: Uint8Array): { width: number; height: number } | null {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (bytes.length >= 24 && view.getUint32(0) === 0x89504e47) {
    return { width: view.getUint32(16), height: view.getUint32(20) };
  }
  if (bytes.length > 4 && view.getUint16(0) === 0xffd8) {
    let offset = 2;
    while (offset + 9 < bytes.length) {
      const marker = view.getUint16(offset);
      const length = view.getUint16(offset + 2);
      // Start of frame (baseline, progressive …): height, then width.
      if (marker >= 0xffc0 && marker <= 0xffcf && ![0xffc4, 0xffc8, 0xffcc].includes(marker)) {
        return { width: view.getUint16(offset + 7), height: view.getUint16(offset + 5) };
      }
      offset += 2 + length;
    }
  }
  return null;
}

const MAGIC = 0x46546c67;
const JSON_CHUNK = 0x4e4f534a;
const BIN_CHUNK = 0x004e4942;

/** Validates a GLB file (its bytes) as a Kalethra body asset. */
export function validateGlb(file: ArrayBuffer, expected?: { variant?: FigureVariant }): GlbReport {
  const errors: string[] = [];
  const stats: GlbStats = {
    bytes: file.byteLength,
    triangles: 0,
    materials: 0,
    textures: [],
    bounds: null,
    variant: null,
    bones: [],
    clips: [],
  };
  const fail = (): GlbReport => ({ ok: false, errors, stats, contract: null });

  // Container.
  const view = new DataView(file);
  if (file.byteLength < 20 || view.getUint32(0, true) !== MAGIC) {
    errors.push('not a GLB file (magic)');
    return fail();
  }
  if (view.getUint32(4, true) !== 2) errors.push('GLB version is not 2');
  if (view.getUint32(8, true) !== file.byteLength)
    errors.push('GLB length does not match the file');
  const jsonLength = view.getUint32(12, true);
  if (view.getUint32(16, true) !== JSON_CHUNK || 20 + jsonLength > file.byteLength) {
    errors.push('first chunk is not JSON');
    return fail();
  }
  let json: Json;
  try {
    json = JSON.parse(new TextDecoder().decode(new Uint8Array(file, 20, jsonLength))) as Json;
  } catch {
    errors.push('JSON chunk does not parse');
    return fail();
  }
  let bin = new Uint8Array(0);
  const binStart = 20 + jsonLength;
  if (binStart + 8 <= file.byteLength) {
    const binLength = view.getUint32(binStart, true);
    if (
      view.getUint32(binStart + 4, true) !== BIN_CHUNK ||
      binStart + 8 + binLength > file.byteLength
    )
      errors.push('second chunk is not a valid BIN chunk');
    else bin = new Uint8Array(file, binStart + 8, binLength);
  }
  if (json.asset?.version !== '2.0') errors.push('asset.version is not 2.0');

  // References.
  const nodes = json.nodes ?? [];
  const meshes = json.meshes ?? [];
  const accessors = json.accessors ?? [];
  const bufferViews = json.bufferViews ?? [];
  const materials = json.materials ?? [];
  const textures = json.textures ?? [];
  const images = json.images ?? [];
  const skins = json.skins ?? [];
  const animations = json.animations ?? [];
  const inRange = (index: number | undefined, list: readonly unknown[], what: string) => {
    if (index === undefined) return;
    if (!Number.isInteger(index) || index < 0 || index >= list.length)
      errors.push(`broken reference: ${what} → ${String(index)}`);
  };
  (json.buffers ?? []).forEach((buffer, i) => {
    if (buffer.uri !== undefined) errors.push(`buffer ${String(i)} refers to an external file`);
  });
  bufferViews.forEach((bv, i) => {
    inRange(bv.buffer, json.buffers ?? [], `bufferView ${String(i)} buffer`);
    if ((bv.byteOffset ?? 0) + (bv.byteLength ?? 0) > bin.length)
      errors.push(`bufferView ${String(i)} lies outside the binary chunk`);
  });
  accessors.forEach((a, i) => {
    inRange(a.bufferView, bufferViews, `accessor ${String(i)} bufferView`);
  });
  meshes.forEach((mesh, m) => {
    (mesh.primitives ?? []).forEach((p, k) => {
      const where = `mesh ${String(m)} primitive ${String(k)}`;
      for (const [attribute, index] of Object.entries(p.attributes ?? {}))
        inRange(index, accessors, `${where} ${attribute}`);
      inRange(p.indices, accessors, `${where} indices`);
      inRange(p.material, materials, `${where} material`);
      if (p.attributes?.POSITION === undefined) errors.push(`${where} has no POSITION`);
    });
  });
  nodes.forEach((node, i) => {
    inRange(node.mesh, meshes, `node ${String(i)} mesh`);
    inRange(node.skin, skins, `node ${String(i)} skin`);
    for (const child of node.children ?? []) inRange(child, nodes, `node ${String(i)} child`);
  });
  for (const scene of json.scenes ?? [])
    for (const root of scene.nodes ?? []) inRange(root, nodes, 'scene node');
  inRange(json.scene, json.scenes ?? [], 'scene');
  skins.forEach((skin, i) => {
    for (const joint of skin.joints ?? []) inRange(joint, nodes, `skin ${String(i)} joint`);
    inRange(skin.inverseBindMatrices, accessors, `skin ${String(i)} inverseBindMatrices`);
    inRange(skin.skeleton, nodes, `skin ${String(i)} skeleton`);
  });
  materials.forEach((material, i) => {
    inRange(material.normalTexture?.index, textures, `material ${String(i)} normalTexture`);
    inRange(
      material.pbrMetallicRoughness?.baseColorTexture?.index,
      textures,
      `material ${String(i)} baseColorTexture`,
    );
    inRange(
      material.pbrMetallicRoughness?.metallicRoughnessTexture?.index,
      textures,
      `material ${String(i)} metallicRoughnessTexture`,
    );
  });
  textures.forEach((texture, i) => {
    inRange(texture.source, images, `texture ${String(i)} source`);
    inRange(texture.sampler, json.samplers ?? [], `texture ${String(i)} sampler`);
  });
  images.forEach((image, i) => {
    if (image.uri !== undefined) errors.push(`image ${String(i)} refers to an external file`);
    inRange(image.bufferView, bufferViews, `image ${String(i)} bufferView`);
  });
  animations.forEach((animation, a) => {
    const samplers = animation.samplers ?? [];
    samplers.forEach((sampler, s) => {
      inRange(sampler.input, accessors, `animation ${String(a)} sampler ${String(s)} input`);
      inRange(sampler.output, accessors, `animation ${String(a)} sampler ${String(s)} output`);
    });
    for (const channel of animation.channels ?? []) {
      inRange(channel.sampler, samplers, `animation ${String(a)} channel sampler`);
      inRange(channel.target?.node, nodes, `animation ${String(a)} channel node`);
    }
  });
  if (errors.some((error) => error.startsWith('broken reference') || error.includes('outside')))
    return fail();

  // Names.
  nodes.forEach((node, i) => {
    if (!node.name) errors.push(`node ${String(i)} has no name`);
    else if (!SAFE_NAME.test(node.name)) errors.push(`unsafe node name "${node.name}"`);
  });
  for (const animation of animations) {
    if (!animation.name || !SAFE_NAME.test(animation.name))
      errors.push(`unsafe clip name "${animation.name ?? ''}"`);
  }
  for (const material of materials) {
    if (material.name !== undefined && !SAFE_NAME.test(material.name))
      errors.push(`unsafe material name "${material.name}"`);
  }

  // Contract.
  const nodeNames = nodes.map((node) => node.name ?? '');
  stats.bones = [
    ...new Set(skins.flatMap((skin) => (skin.joints ?? []).map((j) => nodeNames[j] ?? ''))),
  ];
  stats.clips = animations.map((animation) => animation.name ?? '');
  const contract = validateFigureAsset({
    nodeNames,
    boneNames: stats.bones,
    clipNames: stats.clips,
  });
  if (!contract.ok) errors.push(`breaks the contract: ${JSON.stringify(contract)}`);
  for (const name of nodeNames) {
    if (name.startsWith(PROP_NODE_PREFIX) && !/^prop_[a-z][a-zA-Z]*_[a-zA-Z0-9]+$/.test(name))
      errors.push(`prop node "${name}" is not named prop_<variant>_<part>`);
  }

  // Soft highlight (optional): per-vertex muscle groups and weights, both or neither, matching
  // the vertex count, and a group list of known muscle groups on a node.
  const groupLists = nodes
    .map((node) => node.extras?.muscleGroups)
    .filter((list) => list !== undefined);
  let softPrimitives = 0;
  meshes.forEach((mesh, m) => {
    (mesh.primitives ?? []).forEach((p, k) => {
      const where = `mesh ${String(m)} primitive ${String(k)}`;
      const groups = p.attributes?._MUSCLE_GROUPS;
      const weights = p.attributes?._MUSCLE_WEIGHTS;
      if (groups === undefined && weights === undefined) return;
      softPrimitives++;
      if (groups === undefined || weights === undefined) {
        errors.push(`${where} has only one of _MUSCLE_GROUPS / _MUSCLE_WEIGHTS`);
        return;
      }
      const count = accessors[p.attributes?.POSITION ?? -1]?.count;
      for (const [name, index] of [
        ['_MUSCLE_GROUPS', groups],
        ['_MUSCLE_WEIGHTS', weights],
      ] as const) {
        const a = accessors[index];
        if (a?.type !== 'VEC4' || a.componentType !== 5121 || a.count !== count)
          errors.push(`${where} ${name} is not a VEC4 of unsigned bytes per vertex`);
      }
      if (!accessors[weights]?.normalized)
        errors.push(`${where} _MUSCLE_WEIGHTS is not normalized`);
    });
  });
  if (softPrimitives > 0) {
    const list = groupLists[0];
    if (
      groupLists.length !== 1 ||
      !Array.isArray(list) ||
      list.some((name) => muscleGroupOfNode(`${MUSCLE_NODE_PREFIX}${String(name)}`) === null)
    )
      errors.push('soft highlight without one list of known muscle groups (extras.muscleGroups)');
  }

  // Variant.
  stats.variant = json.asset?.extras?.kalethra?.variant ?? null;
  if (expected?.variant && stats.variant !== expected.variant)
    errors.push(`variant is ${String(stats.variant)}, expected ${expected.variant}`);
  if (json.asset?.extras?.kalethra?.units !== 'metre')
    errors.push('units are not declared as metre');

  // Materials and textures.
  stats.materials = materials.length;
  if (materials.length > ASSET_BUDGET.maxMaterials)
    errors.push(
      `${String(materials.length)} materials, budget ${String(ASSET_BUDGET.maxMaterials)}`,
    );
  images.forEach((image, i) => {
    const bv = image.bufferView === undefined ? undefined : bufferViews[image.bufferView];
    const bytes = bv
      ? bin.subarray(bv.byteOffset ?? 0, (bv.byteOffset ?? 0) + (bv.byteLength ?? 0))
      : null;
    const size = bytes ? imageSize(bytes) : null;
    if (!size) {
      errors.push(`image ${String(i)} is neither PNG nor JPEG`);
      return;
    }
    stats.textures.push(size);
    if (Math.max(size.width, size.height) > ASSET_BUDGET.maxTextureSize)
      errors.push(
        `texture ${String(size.width)}×${String(size.height)}, budget ${String(ASSET_BUDGET.maxTextureSize)}`,
      );
  });

  // Triangles (every drawn mesh instance) and file size.
  for (const node of nodes) {
    if (node.mesh === undefined) continue;
    for (const p of meshes[node.mesh]?.primitives ?? []) {
      const mode = p.mode ?? 4;
      if (mode !== 4) errors.push('only triangle lists are allowed');
      const count =
        p.indices === undefined
          ? (accessors[p.attributes?.POSITION ?? -1]?.count ?? 0)
          : (accessors[p.indices]?.count ?? 0);
      stats.triangles += Math.floor(count / 3);
    }
  }
  if (stats.triangles > ASSET_BUDGET.maxTriangles)
    errors.push(
      `${String(stats.triangles)} triangles, budget ${String(ASSET_BUDGET.maxTriangles)}`,
    );
  if (file.byteLength > ASSET_BUDGET.maxBytes)
    errors.push(`${String(file.byteLength)} bytes, budget ${String(ASSET_BUDGET.maxBytes)}`);

  // Coordinate system, scale and origin – from the bind-pose bounds of the body meshes.
  const boundsOf = (filter: (name: string) => boolean) => {
    const min: [number, number, number] = [Infinity, Infinity, Infinity];
    const max: [number, number, number] = [-Infinity, -Infinity, -Infinity];
    for (const node of nodes) {
      if (node.mesh === undefined || !filter(node.name ?? '')) continue;
      for (const p of meshes[node.mesh]?.primitives ?? []) {
        const accessor = accessors[p.attributes?.POSITION ?? -1];
        if (!accessor?.min || !accessor.max) continue;
        for (let k = 0; k < 3; k++) {
          min[k] = Math.min(min[k] ?? Infinity, accessor.min[k] ?? Infinity);
          max[k] = Math.max(max[k] ?? -Infinity, accessor.max[k] ?? -Infinity);
        }
      }
    }
    return Number.isFinite(min[0]) ? { min, max } : null;
  };
  const centre = (b: { min: number[]; max: number[] } | null, k: number) =>
    b ? ((b.min[k] ?? 0) + (b.max[k] ?? 0)) / 2 : NaN;
  const body = boundsOf(
    (name) => name.startsWith(MUSCLE_NODE_PREFIX) || name.startsWith(BODY_NODE_PREFIX),
  );
  stats.bounds = body;
  if (!body) errors.push('no body meshes with POSITION bounds');
  else {
    const height = body.max[1] - body.min[1];
    if (height < HEIGHT_RANGE[0] || height > HEIGHT_RANGE[1])
      errors.push(
        `height ${height.toFixed(3)} m outside ${String(HEIGHT_RANGE[0])}–${String(HEIGHT_RANGE[1])} m (scale?)`,
      );
    if (Math.abs(body.min[1]) > FLOOR_TOLERANCE)
      errors.push(`floor at y = ${body.min[1].toFixed(3)}, expected 0`);
    if (
      Math.abs(centre(body, 0)) > CENTRE_TOLERANCE ||
      Math.abs(centre(body, 2)) > CENTRE_TOLERANCE * 2
    )
      errors.push('body is not centred over the origin');
    // +Y up: the head above the feet. +Z front: the chest in front of the back.
    const head = boundsOf((name) => name === `${BODY_NODE_PREFIX}head`);
    const feet = boundsOf((name) => name === `${BODY_NODE_PREFIX}feet`);
    if (!(centre(head, 1) > centre(feet, 1))) errors.push('+Y is not up (head not above the feet)');
    const chest = boundsOf((name) => name.startsWith(`${MUSCLE_NODE_PREFIX}chest`));
    const back = boundsOf((name) => name.startsWith(`${MUSCLE_NODE_PREFIX}back`));
    if (!(centre(chest, 2) > centre(back, 2)))
      errors.push('+Z is not the front (chest not in front of the back)');
  }
  // Origin: the scene's top nodes and the skeleton root sit at the origin, unrotated, unscaled.
  for (const index of json.scenes?.[json.scene ?? 0]?.nodes ?? []) {
    const node = nodes[index];
    if (node?.matrix || node?.rotation || node?.scale || node?.translation?.some((x) => x !== 0))
      errors.push(`scene node "${node.name ?? ''}" is transformed (origin)`);
  }
  const root = nodes.find((node) => node.name === 'root');
  if (
    root &&
    (root.rotation || root.scale || root.matrix || root.translation?.some((x) => x !== 0))
  )
    errors.push('bone "root" is not at the origin');

  return { ok: errors.length === 0, errors, stats, contract };
}
