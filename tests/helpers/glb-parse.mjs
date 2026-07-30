// tests/helpers/glb-parse.mjs
//
// SCOPE: a dependency-free reader for binary glTF 2.0 (.glb), sized for headless
// geometry assertions in vitest. It parses the 12-byte header, the JSON chunk and
// the BIN chunk, decodes accessors (including byteStride and sparse), walks the node
// hierarchy to world matrices, and produces world-space triangle lists so a test can
// measure a plane's centroid, its normal, a subtree's bounding box, and — via
// trianglePlanes/signedDistanceToPlane — the half-spaces a solid's faces bound, so
// "is this vertex inside that shell?" is answerable from the mesh itself rather than
// from constants copied out of the generator.
//
// The MEASUREMENT section adds the primitives the increment-1 re-spec needs, all of
// them answering a question about the exported mesh rather than about the script:
//   triangleListArea        — how big is this display face, really
//   boundaryEdges           — where does an open shell end (its rim), and is it open at all
//   planarFrame             — the oriented rectangle a flat quad actually occupies, so a
//                             bezel can be measured as a difference of extents
//   tanSpaceProject         — where does a point land in the pilot's view, so "outside the
//                             player's POV" is a number
//   distanceToTriangleList  — is this rib actually lying on that shell (UNSIGNED: see below)
//   rayTriangleListHits     — is this screen inside the canopy or poking through it
//   insideShellFromEye      — SIDED containment: is this vertex reached before the shell is,
//                             i.e. inboard of the glass rather than bolted to its outside
//   distanceToSegmentList   — does this band follow that rim polyline
//   polylineLength          — how long is the run a perimeter frame has to cover
//   closedMeshVolume        — how much material is in a closed solid, so a band's
//                             cross-section can be recovered as volume / run
//   sampleSegments          — densify a rim so "is the band here?" can be asked from the
//                             edge's side, where the answer is (a four-sided frame has no
//                             vertices at all along the middle of its bottom run)
//   principalAxisEnds       — which vertices are the two ENDS of a long thin part
//
// A NOTE ON SIDEDNESS, because it is the difference between a test and a decoration:
// distanceToTriangleList is UNSIGNED (Math.hypot of the closest-point difference). A rib
// bolted to the OUTSIDE of the canopy measures exactly the same as one lying correctly
// inboard, so proximity alone can only ever say "near the shell", never "inside it".
// insideShellFromEye is the sided companion — it answers "inboard" from the pilot's own
// ray, independently of the shell's winding. Use BOTH: proximity for "follows the
// surface", sidedness for "on the right side of it".
//
// WHY NOT three.js GLTFLoader: it is a browser loader. Headless it needs DOM/URL/
// ImageBitmap shims and a fake FileLoader, and it silently normalises/merges data on
// the way in. For "assert exactly what the exporter wrote" the raw container is both
// simpler and more honest — what you measure is what is in the file.
//
// DEFERRED (not needed by the cockpit increment-1 contract, and deliberately absent
// so nobody mistakes this for a general loader): Draco/meshopt/KHR_* extensions,
// external .bin / data: URIs, images and materials, animations, skins, morph targets,
// TRIANGLE_STRIP / TRIANGLE_FAN / point / line primitive modes.
//
// AXIS CONVENTION: everything returned is in glTF axes exactly as stored in the file
// (+X right, +Y up, forward = -Z). No conversion is applied anywhere in this module.

import { createHash } from 'node:crypto';

const GLB_MAGIC = 0x46546c67; // 'glTF'
const CHUNK_JSON = 0x4e4f534a; // 'JSON'
const CHUNK_BIN = 0x004e4942; // 'BIN\0'

const COMPONENT_TYPES = {
  5120: { name: 'BYTE', array: Int8Array, bytes: 1, normDiv: 127 },
  5121: { name: 'UNSIGNED_BYTE', array: Uint8Array, bytes: 1, normDiv: 255 },
  5122: { name: 'SHORT', array: Int16Array, bytes: 2, normDiv: 32767 },
  5123: { name: 'UNSIGNED_SHORT', array: Uint16Array, bytes: 2, normDiv: 65535 },
  5125: { name: 'UNSIGNED_INT', array: Uint32Array, bytes: 4, normDiv: 4294967295 },
  5126: { name: 'FLOAT', array: Float32Array, bytes: 4, normDiv: 1 },
};

const TYPE_COMPONENTS = {
  SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT2: 4, MAT3: 9, MAT4: 16,
};

// ─────────────────────────────────────────────────────────────────────────────
// Container
// ─────────────────────────────────────────────────────────────────────────────

function toUint8(input) {
  if (input instanceof Uint8Array) return input; // node Buffer is a Uint8Array
  if (input instanceof ArrayBuffer) return new Uint8Array(input);
  if (ArrayBuffer.isView(input)) return new Uint8Array(input.buffer, input.byteOffset, input.byteLength);
  throw new TypeError('parseGLB expects a Buffer, Uint8Array, ArrayBuffer or TypedArray');
}

/**
 * Parse a .glb byte buffer.
 * @returns {{ json: object, bin: Uint8Array, byteLength: number, version: number }}
 *   `bin` is a VIEW onto the input bytes (not a copy) — mutating it mutates the input,
 *   which the AC-REPRO sensitivity test relies on.
 */
export function parseGLB(input) {
  const bytes = toUint8(input);
  if (bytes.byteLength < 12) {
    throw new Error(`Not a GLB: only ${bytes.byteLength} bytes, need at least a 12-byte header`);
  }
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

  const magic = dv.getUint32(0, true);
  if (magic !== GLB_MAGIC) {
    throw new Error(`Not a GLB: magic is 0x${magic.toString(16)}, expected 0x${GLB_MAGIC.toString(16)} ('glTF')`);
  }
  const version = dv.getUint32(4, true);
  if (version !== 2) throw new Error(`Unsupported GLB container version ${version} (only glTF 2.0 is supported)`);
  const declaredLength = dv.getUint32(8, true);
  if (declaredLength > bytes.byteLength) {
    throw new Error(`Truncated GLB: header declares ${declaredLength} bytes, file has ${bytes.byteLength}`);
  }

  let json = null;
  let bin = null;
  let offset = 12;
  const end = Math.min(declaredLength, bytes.byteLength);
  while (offset + 8 <= end) {
    const chunkLength = dv.getUint32(offset, true);
    const chunkType = dv.getUint32(offset + 4, true);
    const start = offset + 8;
    const stop = start + chunkLength;
    if (stop > bytes.byteLength) {
      throw new Error(`Truncated GLB chunk at offset ${offset}: declares ${chunkLength} bytes, only ${bytes.byteLength - start} remain`);
    }
    if (chunkType === CHUNK_JSON) {
      json = JSON.parse(new TextDecoder().decode(bytes.subarray(start, stop)));
    } else if (chunkType === CHUNK_BIN) {
      bin = bytes.subarray(start, stop);
    } // unknown chunk types are skipped per spec
    offset = stop + ((4 - (stop % 4)) % 4);
  }

  if (!json) throw new Error('GLB has no JSON chunk');
  return { json, bin: bin ?? new Uint8Array(0), byteLength: bytes.byteLength, version };
}

// ─────────────────────────────────────────────────────────────────────────────
// Accessors
// ─────────────────────────────────────────────────────────────────────────────

function readComponent(dv, byteOffset, componentType) {
  switch (componentType) {
    case 5120: return dv.getInt8(byteOffset);
    case 5121: return dv.getUint8(byteOffset);
    case 5122: return dv.getInt16(byteOffset, true);
    case 5123: return dv.getUint16(byteOffset, true);
    case 5125: return dv.getUint32(byteOffset, true);
    case 5126: return dv.getFloat32(byteOffset, true);
    default: throw new Error(`Unsupported accessor componentType ${componentType}`);
  }
}

function binView(bin) {
  return new DataView(bin.buffer, bin.byteOffset, bin.byteLength);
}

/** Decode a raw {componentType,type,count,bufferView,byteOffset} descriptor. */
function readDescriptor(gltf, bin, desc) {
  const ct = COMPONENT_TYPES[desc.componentType];
  if (!ct) throw new Error(`Unsupported componentType ${desc.componentType}`);
  const numComponents = TYPE_COMPONENTS[desc.type];
  if (!numComponents) throw new Error(`Unsupported accessor type "${desc.type}"`);

  const out = new ct.array(desc.count * numComponents);
  if (desc.bufferView === undefined || desc.bufferView === null) {
    return { array: out, numComponents }; // spec: absent bufferView means all zeros
  }

  const bv = (gltf.bufferViews ?? [])[desc.bufferView];
  if (!bv) throw new Error(`Accessor references missing bufferView ${desc.bufferView}`);
  const buffer = (gltf.buffers ?? [])[bv.buffer ?? 0];
  if (buffer && buffer.uri) {
    throw new Error('External buffer URIs are not supported — this reader only handles self-contained GLB');
  }

  const elementBytes = numComponents * ct.bytes;
  const stride = bv.byteStride && bv.byteStride > 0 ? bv.byteStride : elementBytes;
  const base = (bv.byteOffset ?? 0) + (desc.byteOffset ?? 0);
  const needed = base + (desc.count > 0 ? (desc.count - 1) * stride + elementBytes : 0);
  if (needed > bin.byteLength) {
    throw new Error(`Accessor overruns the BIN chunk: needs ${needed} bytes, BIN is ${bin.byteLength}`);
  }

  const dv = binView(bin);
  for (let i = 0; i < desc.count; i++) {
    const elementOffset = base + i * stride;
    for (let c = 0; c < numComponents; c++) {
      out[i * numComponents + c] = readComponent(dv, elementOffset + c * ct.bytes, desc.componentType);
    }
  }
  return { array: out, numComponents };
}

/**
 * Decode accessor `index` into a typed array, applying sparse substitution if present.
 * @returns {{ array: TypedArray, count: number, type: string, componentType: number,
 *             numComponents: number, normalized: boolean, min: number[]|undefined,
 *             max: number[]|undefined }}
 */
export function readAccessor(gltf, bin, index) {
  const acc = (gltf.accessors ?? [])[index];
  if (!acc) throw new Error(`No accessor at index ${index}`);

  const { array, numComponents } = readDescriptor(gltf, bin, acc);

  if (acc.sparse) {
    const { count, indices, values } = acc.sparse;
    const idx = readDescriptor(gltf, bin, {
      componentType: indices.componentType, type: 'SCALAR', count,
      bufferView: indices.bufferView, byteOffset: indices.byteOffset,
    }).array;
    const val = readDescriptor(gltf, bin, {
      componentType: acc.componentType, type: acc.type, count,
      bufferView: values.bufferView, byteOffset: values.byteOffset,
    }).array;
    for (let i = 0; i < count; i++) {
      const target = idx[i] * numComponents;
      for (let c = 0; c < numComponents; c++) array[target + c] = val[i * numComponents + c];
    }
  }

  return {
    array,
    count: acc.count,
    type: acc.type,
    componentType: acc.componentType,
    numComponents,
    normalized: Boolean(acc.normalized),
    min: acc.min,
    max: acc.max,
  };
}

/** The accessor's declared min/max (the exporter's own bounds), or null if absent. */
export function accessorMinMax(gltf, index) {
  const acc = (gltf.accessors ?? [])[index];
  if (!acc) throw new Error(`No accessor at index ${index}`);
  if (!acc.min || !acc.max) return null;
  return { min: [...acc.min], max: [...acc.max] };
}

/**
 * Byte range of an accessor's data WITHIN the BIN chunk (tightly-packed accessors only).
 * Used by the AC-REPRO sensitivity check to perturb a single vertex in place.
 */
export function accessorByteRange(gltf, index) {
  const acc = (gltf.accessors ?? [])[index];
  if (!acc) throw new Error(`No accessor at index ${index}`);
  if (acc.bufferView === undefined) throw new Error(`Accessor ${index} has no bufferView`);
  const bv = gltf.bufferViews[acc.bufferView];
  const ct = COMPONENT_TYPES[acc.componentType];
  const numComponents = TYPE_COMPONENTS[acc.type];
  const elementBytes = numComponents * ct.bytes;
  const stride = bv.byteStride && bv.byteStride > 0 ? bv.byteStride : elementBytes;
  const start = (bv.byteOffset ?? 0) + (acc.byteOffset ?? 0);
  const end = start + (acc.count > 0 ? (acc.count - 1) * stride + elementBytes : 0);
  return { start, end, stride, elementBytes, componentBytes: ct.bytes };
}

// ─────────────────────────────────────────────────────────────────────────────
// Nodes and meshes
// ─────────────────────────────────────────────────────────────────────────────

/** @returns {{index:number, name:string|undefined, node:object}[]} every node in the file. */
export function listNodes(gltf) {
  return (gltf.nodes ?? []).map((node, index) => ({ index, name: node.name, node }));
}

/** @returns {{index:number, name:string|undefined, mesh:object}[]} every mesh in the file. */
export function listMeshes(gltf) {
  return (gltf.meshes ?? []).map((mesh, index) => ({ index, name: mesh.name, mesh }));
}

/** First node with this exact name, or null. */
export function findNode(gltf, name) {
  const hit = listNodes(gltf).find((n) => n.name === name);
  return hit ?? null;
}

/** Like findNode but throws a diagnosable error instead of returning null. */
export function requireNode(gltf, name) {
  const hit = findNode(gltf, name);
  if (!hit) {
    const names = listNodes(gltf).map((n) => n.name ?? `<unnamed #${n.index}>`).join(', ');
    throw new Error(`GLB has no node named "${name}". Nodes present: ${names || '(none)'}`);
  }
  return hit;
}

/** First mesh with this exact name, or null. */
export function findMesh(gltf, name) {
  const hit = listMeshes(gltf).find((m) => m.name === name);
  return hit ?? null;
}

// ── column-major 4x4 maths (glTF's matrix convention, same as three.js) ──

export function identityMatrix() {
  const m = new Float64Array(16);
  m[0] = m[5] = m[10] = m[15] = 1;
  return m;
}

export function multiplyMatrices(a, b) {
  const out = new Float64Array(16);
  for (let col = 0; col < 4; col++) {
    for (let row = 0; row < 4; row++) {
      let sum = 0;
      for (let k = 0; k < 4; k++) sum += a[k * 4 + row] * b[col * 4 + k];
      out[col * 4 + row] = sum;
    }
  }
  return out;
}

export function composeTRS(translation, rotation, scale) {
  const [x, y, z, w] = rotation;
  const [sx, sy, sz] = scale;
  const x2 = x + x, y2 = y + y, z2 = z + z;
  const xx = x * x2, xy = x * y2, xz = x * z2;
  const yy = y * y2, yz = y * z2, zz = z * z2;
  const wx = w * x2, wy = w * y2, wz = w * z2;
  const m = new Float64Array(16);
  m[0] = (1 - (yy + zz)) * sx; m[1] = (xy + wz) * sx; m[2] = (xz - wy) * sx; m[3] = 0;
  m[4] = (xy - wz) * sy; m[5] = (1 - (xx + zz)) * sy; m[6] = (yz + wx) * sy; m[7] = 0;
  m[8] = (xz + wy) * sz; m[9] = (yz - wx) * sz; m[10] = (1 - (xx + yy)) * sz; m[11] = 0;
  m[12] = translation[0]; m[13] = translation[1]; m[14] = translation[2]; m[15] = 1;
  return m;
}

/** A node's own transform, from node.matrix if present else its TRS. */
export function nodeLocalMatrix(node) {
  if (node.matrix) return Float64Array.from(node.matrix);
  return composeTRS(node.translation ?? [0, 0, 0], node.rotation ?? [0, 0, 0, 1], node.scale ?? [1, 1, 1]);
}

/** Scale factors of a column-major matrix (basis-column lengths, sign-corrected). */
export function matrixScale(m) {
  const sx = Math.hypot(m[0], m[1], m[2]);
  const sy = Math.hypot(m[4], m[5], m[6]);
  const sz = Math.hypot(m[8], m[9], m[10]);
  // A negative determinant means one axis is mirrored; attribute it to X by convention.
  const det = m[0] * (m[5] * m[10] - m[6] * m[9])
    - m[4] * (m[1] * m[10] - m[2] * m[9])
    + m[8] * (m[1] * m[6] - m[2] * m[5]);
  return [det < 0 ? -sx : sx, sy, sz];
}

export function matrixTranslation(m) {
  return [m[12], m[13], m[14]];
}

/** A node's declared local scale — node.scale if given, else decomposed from node.matrix. */
export function nodeLocalScale(node) {
  if (node.scale) return [...node.scale];
  if (node.matrix) return matrixScale(Float64Array.from(node.matrix));
  return [1, 1, 1];
}

/** childIndex -> parentIndex (-1 for roots). */
export function buildParentMap(gltf) {
  const nodes = gltf.nodes ?? [];
  const parents = new Int32Array(nodes.length).fill(-1);
  nodes.forEach((node, i) => {
    for (const child of node.children ?? []) parents[child] = i;
  });
  return parents;
}

/** Full world transform of a node, walking up through its ancestors. */
export function nodeWorldMatrix(gltf, nodeIndex, parentMap = buildParentMap(gltf)) {
  const chain = [];
  let cursor = nodeIndex;
  const guard = new Set();
  while (cursor !== -1 && cursor !== undefined) {
    if (guard.has(cursor)) throw new Error(`Cycle in the node hierarchy at node ${cursor}`);
    guard.add(cursor);
    chain.push(cursor);
    cursor = parentMap[cursor];
  }
  let m = identityMatrix();
  for (let i = chain.length - 1; i >= 0; i--) {
    m = multiplyMatrices(m, nodeLocalMatrix(gltf.nodes[chain[i]]));
  }
  return m;
}

export function transformPoint(m, p) {
  const [x, y, z] = p;
  const w = m[3] * x + m[7] * y + m[11] * z + m[15];
  const iw = w === 0 ? 1 : 1 / w;
  return [
    (m[0] * x + m[4] * y + m[8] * z + m[12]) * iw,
    (m[1] * x + m[5] * y + m[9] * z + m[13]) * iw,
    (m[2] * x + m[6] * y + m[10] * z + m[14]) * iw,
  ];
}

/**
 * Rotate a direction by a matrix's upper 3x3 (no translation).
 * NOTE: this is the inverse-transpose only when the scale is uniform. AC-METRIC pins
 * every node's scale to (1,1,1), so for this asset it is exact. Geometry-derived
 * normals (triangleListNormal) don't go through here at all.
 */
export function transformDirection(m, v) {
  const [x, y, z] = v;
  return [
    m[0] * x + m[4] * y + m[8] * z,
    m[1] * x + m[5] * y + m[9] * z,
    m[2] * x + m[6] * y + m[10] * z,
  ];
}

// ─────────────────────────────────────────────────────────────────────────────
// Geometry
// ─────────────────────────────────────────────────────────────────────────────

function primitiveIndices(gltf, bin, primitive, vertexCount) {
  if (primitive.indices === undefined || primitive.indices === null) {
    const seq = new Uint32Array(vertexCount);
    for (let i = 0; i < vertexCount; i++) seq[i] = i;
    return seq;
  }
  return Uint32Array.from(readAccessor(gltf, bin, primitive.indices).array);
}

/**
 * World-space triangles of one mesh primitive.
 * @returns {{a:number[], b:number[], c:number[]}[]}
 */
export function primitiveWorldTriangles(gltf, bin, primitive, worldMatrix) {
  const mode = primitive.mode ?? 4;
  if (mode !== 4) {
    throw new Error(`Primitive mode ${mode} is not supported (only 4 = TRIANGLES; Blender's glTF exporter always writes 4)`);
  }
  const posIndex = primitive.attributes?.POSITION;
  if (posIndex === undefined) throw new Error('Primitive has no POSITION attribute');
  const pos = readAccessor(gltf, bin, posIndex);
  const indices = primitiveIndices(gltf, bin, primitive, pos.count);

  const world = new Array(pos.count);
  for (let i = 0; i < pos.count; i++) {
    world[i] = transformPoint(worldMatrix, [pos.array[i * 3], pos.array[i * 3 + 1], pos.array[i * 3 + 2]]);
  }
  const tris = [];
  for (let i = 0; i + 2 < indices.length; i += 3) {
    tris.push({ a: world[indices[i]], b: world[indices[i + 1]], c: world[indices[i + 2]] });
  }
  return tris;
}

function walkSubtree(gltf, nodeIndex, recursive, visit) {
  visit(nodeIndex);
  if (!recursive) return;
  for (const child of gltf.nodes[nodeIndex].children ?? []) walkSubtree(gltf, child, true, visit);
}

/** Every world-space triangle under a node (its own mesh plus, by default, its children's). */
export function nodeWorldTriangles(gltf, bin, nodeIndex, { recursive = true } = {}) {
  const parents = buildParentMap(gltf);
  const tris = [];
  walkSubtree(gltf, nodeIndex, recursive, (i) => {
    const node = gltf.nodes[i];
    if (node.mesh === undefined) return;
    const world = nodeWorldMatrix(gltf, i, parents);
    for (const prim of gltf.meshes[node.mesh].primitives ?? []) {
      tris.push(...primitiveWorldTriangles(gltf, bin, prim, world));
    }
  });
  return tris;
}

/** Every world-space POSITION vertex under a node. */
export function nodeWorldPositions(gltf, bin, nodeIndex, { recursive = true } = {}) {
  const parents = buildParentMap(gltf);
  const points = [];
  walkSubtree(gltf, nodeIndex, recursive, (i) => {
    const node = gltf.nodes[i];
    if (node.mesh === undefined) return;
    const world = nodeWorldMatrix(gltf, i, parents);
    for (const prim of gltf.meshes[node.mesh].primitives ?? []) {
      const pos = readAccessor(gltf, bin, prim.attributes.POSITION);
      for (let v = 0; v < pos.count; v++) {
        points.push(transformPoint(world, [pos.array[v * 3], pos.array[v * 3 + 1], pos.array[v * 3 + 2]]));
      }
    }
  });
  return points;
}

/**
 * Every TEXCOORD_0 uv under a node, in the SAME order `nodeWorldPositions` emits
 * its points — same subtree walk, same primitive order, same vertex order — so the
 * two lists pair index-for-index by construction rather than by luck.
 *
 * THROWS on a primitive with no TEXCOORD_0 rather than pushing a short array. A
 * length mismatch between positions and uvs is the same silent-misalignment bug
 * this helper exists to rule out, one layer down: the caller would pair vertex 4's
 * position with vertex 0's uv and measure a plausible-looking wrong answer.
 */
export function nodeWorldUvs(gltf, bin, nodeIndex, { recursive = true } = {}) {
  const uvs = [];
  walkSubtree(gltf, nodeIndex, recursive, (i) => {
    const node = gltf.nodes[i];
    if (node.mesh === undefined) return;
    for (const prim of gltf.meshes[node.mesh].primitives ?? []) {
      if (prim.attributes.TEXCOORD_0 === undefined) {
        throw new Error(
          `nodeWorldUvs: node ${nodeIndex} (${gltf.nodes[nodeIndex].name || 'unnamed'}) has a ` +
          `primitive with no TEXCOORD_0. Returning the uvs it does have would leave a list ` +
          `shorter than nodeWorldPositions', and every pair after the gap would be wrong.`,
        );
      }
      const uv = readAccessor(gltf, bin, prim.attributes.TEXCOORD_0);
      for (let v = 0; v < uv.count; v++) uvs.push([uv.array[v * 2], uv.array[v * 2 + 1]]);
    }
  });
  return uvs;
}

export function boundsOfPoints(points) {
  if (!points.length) return null;
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (const p of points) {
    for (let i = 0; i < 3; i++) {
      if (p[i] < min[i]) min[i] = p[i];
      if (p[i] > max[i]) max[i] = p[i];
    }
  }
  return { min, max, size: [max[0] - min[0], max[1] - min[1], max[2] - min[2]] };
}

/** World-space AABB of a node's subtree, or null if it has no geometry. */
export function nodeWorldBounds(gltf, bin, nodeIndex, opts) {
  return boundsOfPoints(nodeWorldPositions(gltf, bin, nodeIndex, opts));
}

/**
 * World-space AABB of a scene, computed vertex-by-vertex (exact, not the conservative
 * 8-corner bound — the screens are rotated, so corner-transforming would overstate it).
 */
export function sceneBoundingBox(gltf, bin, { scene = gltf.scene ?? 0, allNodes = false } = {}) {
  let roots;
  if (allNodes || !gltf.scenes || !gltf.scenes[scene]) {
    const parents = buildParentMap(gltf);
    roots = listNodes(gltf).filter((n) => parents[n.index] === -1).map((n) => n.index);
  } else {
    roots = gltf.scenes[scene].nodes ?? [];
  }
  const points = [];
  for (const root of roots) points.push(...nodeWorldPositions(gltf, bin, root));
  return boundsOfPoints(points);
}

// ── vector helpers ──

export function normalize(v) {
  const len = Math.hypot(v[0], v[1], v[2]);
  if (len === 0) throw new Error('Cannot normalize a zero-length vector');
  return [v[0] / len, v[1] / len, v[2] / len];
}

export function angleBetweenDegrees(a, b) {
  const ua = normalize(a);
  const ub = normalize(b);
  const dot = Math.min(1, Math.max(-1, ua[0] * ub[0] + ua[1] * ub[1] + ua[2] * ub[2]));
  return (Math.acos(dot) * 180) / Math.PI;
}

/**
 * Area-weighted unit normal of a triangle list. Derived from vertex WINDING
 * (counter-clockwise = front face, per the glTF spec), so it is the direction the
 * surface actually faces — a back-to-front flip shows up as ~180 degrees, which is
 * exactly what a screen mounted facing away from the pilot should look like.
 */
export function triangleListNormal(tris) {
  if (!tris.length) throw new Error('triangleListNormal: empty triangle list');
  let nx = 0, ny = 0, nz = 0;
  for (const { a, b, c } of tris) {
    const e1 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
    const e2 = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    nx += e1[1] * e2[2] - e1[2] * e2[1];
    ny += e1[2] * e2[0] - e1[0] * e2[2];
    nz += e1[0] * e2[1] - e1[1] * e2[0];
  }
  return normalize([nx, ny, nz]);
}

/** Area-weighted centroid of a triangle list (the true centroid of a planar quad). */
export function triangleListCentroid(tris) {
  if (!tris.length) throw new Error('triangleListCentroid: empty triangle list');
  let total = 0;
  const acc = [0, 0, 0];
  for (const { a, b, c } of tris) {
    const e1 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
    const e2 = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    const cross = [
      e1[1] * e2[2] - e1[2] * e2[1],
      e1[2] * e2[0] - e1[0] * e2[2],
      e1[0] * e2[1] - e1[1] * e2[0],
    ];
    const area = 0.5 * Math.hypot(cross[0], cross[1], cross[2]);
    total += area;
    for (let i = 0; i < 3; i++) acc[i] += ((a[i] + b[i] + c[i]) / 3) * area;
  }
  if (total === 0) {
    // Degenerate (zero-area) geometry: fall back to the plain vertex mean.
    const pts = tris.flatMap(({ a, b, c }) => [a, b, c]);
    return [0, 1, 2].map((i) => pts.reduce((s, p) => s + p[i], 0) / pts.length);
  }
  return acc.map((v) => v / total);
}

// ── planes and half-spaces ──

/**
 * Group a triangle list into the distinct PLANES its faces lie in.
 *
 * Each returned plane is `{ normal, d, area, triangleCount }` and satisfies
 * `dot(normal, x) === d` for every point x on it. `normal` is the winding normal —
 * the direction the surface FACES — so for a closed solid it points out of the
 * material. A ring solid's inner wall therefore has normals pointing INTO the
 * cavity, which is what makes containment testable without knowing the shape.
 *
 * WHY THIS EXISTS: it lets a test ask "does this vertex sit inside that shell?"
 * against the exported mesh, instead of re-deriving the shell from the generator's
 * own constants — which would only ever prove the generator agrees with itself.
 *
 * Coplanar triangles merge when their normals agree to within `cosEps` (as
 * 1 - dot) AND their plane offsets agree to within `distEps` metres. Two faces
 * that are coplanar but oppositely wound stay SEPARATE planes (their normals are
 * antiparallel), which is correct: they bound the solid from opposite sides.
 * Degenerate (near-zero-area) triangles are dropped rather than contributing a
 * garbage normal.
 *
 * @returns {{normal:number[], d:number, area:number, triangleCount:number}[]}
 *   in first-appearance order, so the result is deterministic for a given mesh.
 */
export function trianglePlanes(tris, { cosEps = 1e-5, distEps = 1e-4, minArea = 1e-12 } = {}) {
  const groups = [];
  for (const { a, b, c } of tris) {
    const e1 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
    const e2 = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    const cr = [
      e1[1] * e2[2] - e1[2] * e2[1],
      e1[2] * e2[0] - e1[0] * e2[2],
      e1[0] * e2[1] - e1[1] * e2[0],
    ];
    const twiceArea = Math.hypot(cr[0], cr[1], cr[2]);
    const area = 0.5 * twiceArea;
    if (area <= minArea) continue; // degenerate: no meaningful normal
    const n = [cr[0] / twiceArea, cr[1] / twiceArea, cr[2] / twiceArea];
    const d = n[0] * a[0] + n[1] * a[1] + n[2] * a[2];

    const hit = groups.find((g) => {
      const dot = g.ref[0] * n[0] + g.ref[1] * n[1] + g.ref[2] * n[2];
      return 1 - dot <= cosEps && Math.abs(g.refD - d) <= distEps;
    });
    if (hit) {
      hit.nAcc[0] += n[0] * area; hit.nAcc[1] += n[1] * area; hit.nAcc[2] += n[2] * area;
      hit.dAcc += d * area;
      hit.area += area;
      hit.triangleCount += 1;
    } else {
      groups.push({
        ref: n, refD: d, nAcc: [n[0] * area, n[1] * area, n[2] * area],
        dAcc: d * area, area, triangleCount: 1,
      });
    }
  }
  return groups.map((g) => ({
    normal: normalize(g.nAcc),
    d: g.dAcc / g.area,
    area: g.area,
    triangleCount: g.triangleCount,
  }));
}

/**
 * Signed distance of a point from a plane, in metres. Positive means the point is
 * on the side the plane's normal points to — for a winding-derived normal, the side
 * the surface faces (i.e. OUTSIDE the material it bounds).
 */
export function signedDistanceToPlane(plane, p) {
  return plane.normal[0] * p[0] + plane.normal[1] * p[1] + plane.normal[2] * p[2] - plane.d;
}

// ─────────────────────────────────────────────────────────────────────────────
// Measurement
//
// Everything below takes world-space triangles or points and returns a number about
// them. Nothing here reads the generator's constants — that is the whole point: a
// bezel measured as (body extent - face extent) can disagree with the constant the
// script declares, and a rib measured against the shell it is supposed to sit on can
// be found floating in mid-air.
// ─────────────────────────────────────────────────────────────────────────────

// Module-local vector arithmetic. Deliberately not exported: the public surface is
// "questions about a mesh", not a linear-algebra library.
const sub3 = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot3 = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross3 = (a, b) => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const len3 = (a) => Math.hypot(a[0], a[1], a[2]);

/** Total surface area of a triangle list, in square metres. */
export function triangleListArea(tris) {
  let total = 0;
  for (const { a, b, c } of tris) {
    const e1 = sub3(b, a);
    const e2 = sub3(c, a);
    total += 0.5 * len3(cross3(e1, e2));
  }
  return total;
}

/** Every distinct vertex position in a triangle list, welded at `weld` metres. */
export function uniquePoints(tris, { weld = 1e-6 } = {}) {
  const seen = new Map();
  for (const t of [...tris]) {
    for (const p of [t.a, t.b, t.c]) {
      const k = `${Math.round(p[0] / weld)},${Math.round(p[1] / weld)},${Math.round(p[2] / weld)}`;
      if (!seen.has(k)) seen.set(k, p);
    }
  }
  return [...seen.values()];
}

/**
 * The edges of a triangle list used by exactly ONE triangle — i.e. the open boundary.
 *
 * A closed solid has none. An open shell's boundary is its rim, which is what makes
 * "does this shell bulge forward of its own rim?" answerable, and what separates a
 * quad's four sides from the diagonal the exporter split it along (the diagonal is
 * shared by both triangles, so it drops out).
 *
 * Vertices are welded at `weld` metres before edges are keyed, so an indexed mesh and
 * a de-indexed one give the same answer. Insertion order is preserved, so the result
 * is deterministic for a given mesh.
 *
 * @returns {{a:number[], b:number[]}[]}
 */
export function boundaryEdges(tris, { weld = 1e-6 } = {}) {
  const key = (p) => `${Math.round(p[0] / weld)},${Math.round(p[1] / weld)},${Math.round(p[2] / weld)}`;
  const edges = new Map();
  for (const t of tris) {
    const pts = [t.a, t.b, t.c];
    for (let i = 0; i < 3; i++) {
      const p = pts[i];
      const q = pts[(i + 1) % 3];
      const kp = key(p);
      const kq = key(q);
      if (kp === kq) continue; // degenerate edge contributes no boundary
      const ek = kp < kq ? `${kp}|${kq}` : `${kq}|${kp}`;
      const hit = edges.get(ek);
      if (hit) hit.count += 1;
      else edges.set(ek, { a: p, b: q, count: 1 });
    }
  }
  return [...edges.values()].filter((e) => e.count === 1).map(({ a, b }) => ({ a, b }));
}

/**
 * The oriented rectangle a (roughly planar) triangle list occupies.
 *
 * WHY NOT AN AABB: a corner screen is rotated to face the pilot, so its world-axis
 * bounding box is bigger than the panel and grows with the tilt. Measuring a 1-inch
 * bezel as a difference of two AABBs would be measuring the tilt, not the bezel.
 *
 * The in-plane axes are chosen by minimum bounding-rectangle area over the boundary-edge
 * directions — the standard result that a minimum-area enclosing rectangle is flush with
 * an edge of the convex hull. For an authored rectangle that recovers its own sides
 * exactly, whether or not the exporter split it along a diagonal or welded its corners.
 *
 * `u` is always the LONGER axis, `w = normal x u`, and `u`'s sign is pinned to its
 * first significant component so two runs agree. `centre` is the rectangle's centre,
 * not the area centroid (they coincide for a rectangle).
 *
 * @returns {{normal:number[], centre:number[], u:number[], w:number[], halfU:number, halfW:number}}
 */
export function planarFrame(tris, { normal = null, points = null } = {}) {
  if (!tris.length) throw new Error('planarFrame: empty triangle list');
  const n = normalize(normal ?? triangleListNormal(tris));
  const pts = points ?? tris.flatMap((t) => [t.a, t.b, t.c]);
  if (!pts.length) throw new Error('planarFrame: no points to bound');
  const seed = triangleListCentroid(tris);

  const candidates = [];
  for (const e of boundaryEdges(tris)) {
    const d = sub3(e.b, e.a);
    const k = dot3(d, n);
    const flat = [d[0] - n[0] * k, d[1] - n[1] * k, d[2] - n[2] * k];
    if (len3(flat) > 1e-9) candidates.push(normalize(flat));
  }
  if (!candidates.length) {
    // No open boundary (a closed shell): fall back to any stable in-plane axis. The
    // extents are then orientation-dependent, which callers measuring a rectangle
    // should never hit — a rectangle always has a boundary.
    const seedAxis = Math.abs(n[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0];
    candidates.push(normalize(cross3(n, seedAxis)));
  }

  let best = null;
  for (const u0 of candidates) {
    const w0 = normalize(cross3(n, u0));
    let uMin = Infinity; let uMax = -Infinity; let wMin = Infinity; let wMax = -Infinity;
    for (const p of pts) {
      const r = sub3(p, seed);
      const cu = dot3(r, u0);
      const cw = dot3(r, w0);
      if (cu < uMin) uMin = cu;
      if (cu > uMax) uMax = cu;
      if (cw < wMin) wMin = cw;
      if (cw > wMax) wMax = cw;
    }
    const area = (uMax - uMin) * (wMax - wMin);
    if (!best || area < best.area - 1e-12) best = { u: u0, w: w0, uMin, uMax, wMin, wMax, area };
  }

  const midU = (best.uMin + best.uMax) / 2;
  const midW = (best.wMin + best.wMax) / 2;
  const centre = [
    seed[0] + best.u[0] * midU + best.w[0] * midW,
    seed[1] + best.u[1] * midU + best.w[1] * midW,
    seed[2] + best.u[2] * midU + best.w[2] * midW,
  ];
  let u = best.u;
  let halfU = (best.uMax - best.uMin) / 2;
  let halfW = (best.wMax - best.wMin) / 2;
  if (halfW > halfU) {
    // Long axis must be u. w = n x u already, and n x (n x u) = -u, so swapping to
    // (u, w) := (w, -u) keeps the frame right-handed; w is recomputed below anyway.
    u = best.w;
    const t = halfU; halfU = halfW; halfW = t;
  }
  const ref = Math.abs(u[0]) > 1e-6 ? 0 : (Math.abs(u[1]) > 1e-6 ? 1 : 2);
  if (u[ref] < 0) u = [-u[0], -u[1], -u[2]];
  return { normal: n, centre, u, w: normalize(cross3(n, u)), halfU, halfW };
}

/** A point's (along-u, along-w, along-normal) coordinates in a planarFrame, metres. */
export function frameCoords(frame, p) {
  const r = sub3(p, frame.centre);
  return [dot3(r, frame.u), dot3(r, frame.w), dot3(r, frame.normal)];
}

/** Min/max of a point set in a frame's coordinates: {u:{min,max}, w:{...}, n:{...}}. */
export function frameExtents(frame, points) {
  const acc = [
    { min: Infinity, max: -Infinity },
    { min: Infinity, max: -Infinity },
    { min: Infinity, max: -Infinity },
  ];
  for (const p of points) {
    const c = frameCoords(frame, p);
    for (let i = 0; i < 3; i++) {
      if (c[i] < acc[i].min) acc[i].min = c[i];
      if (c[i] > acc[i].max) acc[i].max = c[i];
    }
  }
  return { u: acc[0], w: acc[1], n: acc[2] };
}

/**
 * Where a point lands in the pilot's view, as (tan of horizontal angle, tan of vertical
 * angle) from the eye at the origin looking down -Z.
 *
 * A perspective camera maps directions linearly onto this plane, so a comparison here IS
 * the on-screen comparison. Returns null for a point at or BEHIND the eye plane — which
 * is not a measurement failure but a real answer: such a point is out of view whatever
 * the FOV is, and callers asking "is this outside the frame?" must treat null as yes.
 *
 * @returns {number[]|null} [tanX, tanY]
 */
export function tanSpaceProject(p, { eps = 1e-9 } = {}) {
  const depth = -p[2];
  if (depth <= eps) return null;
  return [p[0] / depth, p[1] / depth];
}

/** Half-extents of a view frustum in tan-space. `fovDeg` is VERTICAL, as three.js uses. */
export function frustumTanExtents(fovDeg, aspect) {
  const tanV = Math.tan((fovDeg * Math.PI) / 360);
  return { tanH: tanV * aspect, tanV };
}

/** Is a world point inside the view frame? A point at/behind the eye is never inside. */
export function insideTanFrame(p, { tanH, tanV }, { slack = 0 } = {}) {
  const t = tanSpaceProject(p);
  if (!t) return false;
  return Math.abs(t[0]) <= tanH + slack && Math.abs(t[1]) <= tanV + slack;
}

/**
 * Closest point on one triangle to `p` (Ericson, Real-Time Collision Detection §5.1.5).
 * Handles the vertex, edge and face regions, so it is exact for a point beyond a corner
 * as well as one hovering over the middle.
 */
export function closestPointOnTriangle(tri, p) {
  const { a, b, c } = tri;
  const ab = sub3(b, a);
  const ac = sub3(c, a);
  const ap = sub3(p, a);
  const d1 = dot3(ab, ap);
  const d2 = dot3(ac, ap);
  if (d1 <= 0 && d2 <= 0) return a;

  const bp = sub3(p, b);
  const d3 = dot3(ab, bp);
  const d4 = dot3(ac, bp);
  if (d3 >= 0 && d4 <= d3) return b;

  const vc = d1 * d4 - d3 * d2;
  if (vc <= 0 && d1 >= 0 && d3 <= 0) {
    const v = d1 / (d1 - d3);
    return [a[0] + ab[0] * v, a[1] + ab[1] * v, a[2] + ab[2] * v];
  }

  const cp = sub3(p, c);
  const d5 = dot3(ab, cp);
  const d6 = dot3(ac, cp);
  if (d6 >= 0 && d5 <= d6) return c;

  const vb = d5 * d2 - d1 * d6;
  if (vb <= 0 && d2 >= 0 && d6 <= 0) {
    const w = d2 / (d2 - d6);
    return [a[0] + ac[0] * w, a[1] + ac[1] * w, a[2] + ac[2] * w];
  }

  const va = d3 * d6 - d5 * d4;
  if (va <= 0 && d4 - d3 >= 0 && d5 - d6 >= 0) {
    const w = (d4 - d3) / ((d4 - d3) + (d5 - d6));
    return [b[0] + (c[0] - b[0]) * w, b[1] + (c[1] - b[1]) * w, b[2] + (c[2] - b[2]) * w];
  }

  const denom = 1 / (va + vb + vc);
  const v = vb * denom;
  const w = vc * denom;
  return [
    a[0] + ab[0] * v + ac[0] * w,
    a[1] + ab[1] * v + ac[1] * w,
    a[2] + ab[2] * v + ac[2] * w,
  ];
}

/**
 * Distance from a point to the nearest surface point of a triangle list.
 * @returns {{distance:number, point:number[]|null}}
 */
export function distanceToTriangleList(tris, p) {
  let distance = Infinity;
  let point = null;
  for (const t of tris) {
    const q = closestPointOnTriangle(t, p);
    const d = Math.hypot(q[0] - p[0], q[1] - p[1], q[2] - p[2]);
    if (d < distance) { distance = d; point = q; }
  }
  return { distance, point };
}

/**
 * Ray/triangle-list intersection (Möller–Trumbore), two-sided so a shell's winding does
 * not decide whether it is hit.
 * @returns {number[]} hit distances along the NORMALISED direction, ascending.
 */
export function rayTriangleListHits(origin, direction, tris, { eps = 1e-12, minT = 1e-6 } = {}) {
  const dir = normalize(direction);
  const hits = [];
  for (const { a, b, c } of tris) {
    const e1 = sub3(b, a);
    const e2 = sub3(c, a);
    const pv = cross3(dir, e2);
    const det = dot3(e1, pv);
    if (Math.abs(det) < eps) continue; // ray parallel to the triangle's plane
    const inv = 1 / det;
    const tv = sub3(origin, a);
    const u = dot3(tv, pv) * inv;
    if (u < -1e-9 || u > 1 + 1e-9) continue;
    const qv = cross3(tv, e1);
    const v = dot3(dir, qv) * inv;
    if (v < -1e-9 || u + v > 1 + 1e-9) continue;
    const t = dot3(e2, qv) * inv;
    if (t > minT) hits.push(t);
  }
  return hits.sort((x, y) => x - y);
}

/**
 * SIDED containment against an open shell, decided by a ray from the eye.
 *
 * WHY THIS EXISTS: distanceToTriangleList is unsigned, so "0.05 m from the canopy" is
 * the same number for a rib lying correctly inboard, a rib bolted to the OUTSIDE of the
 * glass, and a rib punched half-way through it. Sidedness has to come from somewhere
 * else. It comes from the pilot: walk from the eye towards each point and ask whether
 * the point is reached BEFORE the shell is. That is winding-independent (the shell's
 * face orientation never enters into it) and it is the same question the render answers,
 * which is why the same predicate serves the screen units and the canopy structure.
 *
 * Points whose eye-ray misses the shell entirely are SKIPPED, not counted as inside:
 * they are outside the glazed cone, which is legitimate near the rim. That makes the
 * measurement partial by construction, so `tested` is reported and callers must assert
 * it is non-zero rather than let a silently-empty result read as a pass.
 *
 * @returns {{tested:number, skipped:number, worst:{over:number, point:number[]|null, hit:number|null}}}
 *   `over` = (distance from eye to the point) - (distance from eye to the nearest shell
 *   hit). Positive means the point is BEYOND the shell — outboard, i.e. wrong side.
 */
export function insideShellFromEye(shellTris, points, { eye = [0, 0, 0] } = {}) {
  let tested = 0;
  let skipped = 0;
  let worst = { over: -Infinity, point: null, hit: null };
  for (const p of points) {
    const dir = sub3(p, eye);
    const range = len3(dir);
    if (range < 1e-9) { skipped += 1; continue; }
    const hits = rayTriangleListHits(eye, dir, shellTris);
    if (!hits.length) { skipped += 1; continue; }
    tested += 1;
    const over = range - hits[0];
    if (over > worst.over) worst = { over, point: p, hit: hits[0] };
  }
  return { tested, skipped, worst };
}

/**
 * Distance from a point to the nearest point on a list of segments ({a,b} pairs) — the
 * form boundaryEdges returns, so "does this band follow the shell's rim?" is answerable
 * against the rim itself rather than against a bounding box that would also accept a
 * plate covering the whole opening.
 * @returns {{distance:number, point:number[]|null}}
 */
export function distanceToSegmentList(segments, p) {
  let distance = Infinity;
  let point = null;
  for (const { a, b } of segments) {
    const ab = sub3(b, a);
    const l2 = dot3(ab, ab);
    let t = l2 > 1e-18 ? dot3(sub3(p, a), ab) / l2 : 0;
    t = t < 0 ? 0 : (t > 1 ? 1 : t);
    const q = [a[0] + ab[0] * t, a[1] + ab[1] * t, a[2] + ab[2] * t];
    const d = Math.hypot(q[0] - p[0], q[1] - p[1], q[2] - p[2]);
    if (d < distance) { distance = d; point = q; }
  }
  return { distance, point };
}

/** Total length of a segment list — e.g. the run a perimeter frame has to cover. */
export function polylineLength(segments) {
  let total = 0;
  for (const { a, b } of segments) total += len3(sub3(b, a));
  return total;
}

/**
 * Enclosed volume of a CLOSED triangle mesh (divergence theorem, summed about the
 * origin), returned unsigned so the mesh's winding does not decide the answer.
 *
 * Meaningless for an open shell — check boundaryEdges(tris).length === 0 first. Its use
 * here is to recover a band's CROSS-SECTION without knowing how the band was authored:
 * for a solid of roughly constant section, volume / run = cross-sectional area, so
 * sqrt(volume / run) is the band's equivalent side. That is how "fairly thin" gets
 * measured on a closed perimeter frame, whose bounding box says nothing about its width.
 */
export function closedMeshVolume(tris) {
  let sixV = 0;
  for (const { a, b, c } of tris) sixV += dot3(a, cross3(b, c));
  return Math.abs(sixV) / 6;
}

/**
 * Points sampled along a segment list, at most `spacing` metres apart, endpoints
 * included.
 *
 * WHY: "does this band follow the canopy edge the whole way round?" cannot be asked from
 * the BAND's side. A four-sided frame has vertices only at its corners — there is no
 * geometry at all along the middle of its bottom run — so any per-vertex histogram
 * reports a perfectly good frame as full of holes. Densifying the RIM and asking "is
 * there frame near this point?" for every sample asks the question from the side that
 * has the answer, and names WHERE the gap is when there is one.
 */
export function sampleSegments(segments, { spacing = 0.05 } = {}) {
  const out = [];
  for (const { a, b } of segments) {
    const d = sub3(b, a);
    const steps = Math.max(1, Math.ceil(len3(d) / spacing));
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      out.push([a[0] + d[0] * t, a[1] + d[1] * t, a[2] + d[2] * t]);
    }
  }
  return out;
}

/**
 * The two END regions of a long thin part, along its own dominant axis.
 *
 * Which axis is "along the part" is derived from the geometry (the largest bounding
 * extent), not from a label, so a re-authored rib that runs diagonally is still measured
 * end-to-end. `fraction` is the share of the total run treated as an end.
 *
 * @returns {{axis:number, min:number, max:number, span:number, low:number[][], high:number[][]}|null}
 */
export function principalAxisEnds(points, { fraction = 0.05, axis = null } = {}) {
  const box = boundsOfPoints(points);
  if (!box) return null;
  const ax = axis ?? box.size.indexOf(Math.max(...box.size));
  const span = box.max[ax] - box.min[ax];
  const cut = fraction * span;
  return {
    axis: ax,
    min: box.min[ax],
    max: box.max[ax],
    span,
    low: points.filter((p) => p[ax] <= box.min[ax] + cut),
    high: points.filter((p) => p[ax] >= box.max[ax] - cut),
  };
}

/** Distance from a point to an axis-aligned box ({min,max}); 0 when inside. */
export function distanceToBox(box, p) {
  let sum = 0;
  for (let i = 0; i < 3; i++) {
    const over = Math.max(box.min[i] - p[i], 0, p[i] - box.max[i]);
    sum += over * over;
  }
  return Math.sqrt(sum);
}

// ─────────────────────────────────────────────────────────────────────────────
// AC-REPRO — geometric identity hashing
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Stable sort key for a mesh: the name of the node that references it (the script's
 * object name, e.g. "Cockpit_Frame") falling back to the mesh-data name. File order
 * is deliberately NOT part of the key, so an exporter that reorders meshes between
 * runs does not change the hash.
 */
function meshSortKey(gltf, meshIndex) {
  const nodeNames = (gltf.nodes ?? [])
    .filter((n) => n.mesh === meshIndex && n.name)
    .map((n) => n.name)
    .sort();
  const meshName = (gltf.meshes ?? [])[meshIndex]?.name ?? '';
  return `${nodeNames[0] ?? meshName} ${meshName}`;
}

/**
 * SHA-256 over the decoded geometry of every mesh, in deterministic name order.
 *
 * What is hashed, and why:
 *  - POSITION accessors, as raw little-endian float32 bytes, in the exporter's own
 *    vertex order, preceded by a length-prefixed mesh/primitive label. Local
 *    (pre-transform) positions, matching the AC's "decode the vertex-position buffers".
 *  - Index buffers, WIDENED to uint32 first, so an exporter that switches uint16 ->
 *    uint32 because a mesh crossed 65535 verts is not mistaken for a geometry change.
 *  - Mesh iteration order comes from meshSortKey, not from file order.
 *
 * `quantize` (metres, default 0 = exact bytes) is an escape hatch: if a Blender
 * upgrade ever introduces sub-micron float noise between runs, set e.g. 1e-6 to hash
 * a rounded copy. Leave it at 0 unless a real two-run diff proves it necessary.
 *
 * @returns {{ positions: string, indices: string }} lowercase hex digests.
 */
export function hashGeometry(glbBuffer, { quantize = 0 } = {}) {
  const { json: gltf, bin } = parseGLB(glbBuffer);
  const entries = (gltf.meshes ?? []).map((mesh, index) => ({ mesh, index, key: meshSortKey(gltf, index) }));
  entries.sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));

  const posHash = createHash('sha256');
  const idxHash = createHash('sha256');

  for (const { mesh, key } of entries) {
    const primitives = mesh.primitives ?? [];
    for (let p = 0; p < primitives.length; p++) {
      const prim = primitives[p];
      const label = `${key}#${p} `;
      posHash.update(label);
      idxHash.update(label);

      const pos = readAccessor(gltf, bin, prim.attributes.POSITION);
      let f32 = Float32Array.from(pos.array);
      if (quantize > 0) f32 = Float32Array.from(f32, (v) => Math.round(v / quantize) * quantize);
      posHash.update(new Uint8Array(f32.buffer, f32.byteOffset, f32.byteLength));

      const idx = primitiveIndices(gltf, bin, prim, pos.count);
      idxHash.update(new Uint8Array(idx.buffer, idx.byteOffset, idx.byteLength));
    }
  }

  return { positions: posHash.digest('hex'), indices: idxHash.digest('hex') };
}
