import assert from "node:assert/strict";
import { gzipSync } from "node:zlib";
import * as THREE from "../vendor/three.module.js";
import { createGeometry } from "../js/geometry.js";

const values = {
  positions: [0, 0, 0, 1, 0, 0, 0, 1, 0],
  normals: [0, 0, 1, 0, 0, 1, 0, 0, 1],
  uvs: [0, 0, 1, 0, 0, 1],
  indices: [0, 1, 2],
};

function originalGeometry(data) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(data.positions, 3));
  geometry.setIndex(ArrayBuffer.isView(data.indices)
    ? new THREE.BufferAttribute(data.indices, 1)
    : data.indices);
  if (data.normals) {
    geometry.setAttribute("normal", new THREE.Float32BufferAttribute(data.normals, 3));
  } else geometry.computeVertexNormals();
  if (data.uvs) geometry.setAttribute("uv", new THREE.Float32BufferAttribute(data.uvs, 2));
  return geometry;
}

function assertIdenticalGeometry(actual, expected) {
  for (const name of ["position", "normal", "uv"]) {
    const a = actual.getAttribute(name);
    const b = expected.getAttribute(name);
    if (!b) {
      assert.equal(a, undefined);
      continue;
    }
    assert.equal(a.itemSize, b.itemSize);
    assert.equal(a.count, b.count);
    assert.equal(a.normalized, b.normalized);
    assert.equal(a.usage, b.usage);
    assert.deepEqual(a.array, b.array);
  }
  assert.deepEqual(actual.index.array, expected.index.array);
  actual.computeBoundingBox();
  expected.computeBoundingBox();
  assert.deepEqual(actual.boundingBox, expected.boundingBox);
  actual.dispose();
  expected.dispose();
}

for (const ArrayType of [Array, Float32Array, Float64Array]) {
  const data = Object.fromEntries(Object.entries(values).map(([key, array]) => [
    key,
    key === "indices" ? new Uint16Array(array)
      : ArrayType === Array ? array.slice()
        : new ArrayType(ArrayType === Float64Array ? array.map(value => value + 0.1) : array),
  ]));
  for (const copyAttributes of [true, false]) {
    assertIdenticalGeometry(createGeometry(data, { copyAttributes }), originalGeometry(data));
  }
}

const typed = {
  positions: new Float32Array(values.positions),
  normals: new Float32Array(values.normals),
  uvs: new Float32Array(values.uvs),
  indices: new Uint16Array(values.indices),
};
const isolated = createGeometry(typed);
for (const [name, key] of [["position", "positions"], ["normal", "normals"], ["uv", "uvs"]]) {
  assert.notEqual(isolated.getAttribute(name).array, typed[key]);
}
isolated.getAttribute("position").setX(0, 10);
isolated.getAttribute("normal").setY(0, 1);
isolated.getAttribute("uv").setX(0, 1);
assert.deepEqual([...typed.positions], values.positions);
assert.deepEqual([...typed.normals], values.normals);
assert.deepEqual([...typed.uvs], values.uvs);
isolated.dispose();

const viewed = { indices: new Uint16Array(values.indices) };
for (const key of ["positions", "normals", "uvs"]) {
  const backing = new Float32Array(values[key].length + 4).fill(99);
  const view = backing.subarray(2, -2);
  view.set(values[key]);
  viewed[key] = view;
}
const shared = createGeometry(viewed, { copyAttributes: false });
for (const [name, key] of [["position", "positions"], ["normal", "normals"], ["uv", "uvs"]]) {
  assert.equal(shared.getAttribute(name).array, viewed[key]);
  assert.equal(shared.getAttribute(name).array.byteOffset, 8);
}
assertIdenticalGeometry(shared, originalGeometry(viewed));

const withoutNormals = { positions: typed.positions, indices: typed.indices };
assertIdenticalGeometry(
  createGeometry(withoutNormals, { copyAttributes: false }),
  originalGeometry(withoutNormals),
);

// A small fetched rig exercises the actual avatar path without loading the full model.
const fixtureBuffer = new ArrayBuffer(176);
const fixtureMesh = { name: "geometry-test", groups: [[0, 3, 0]] };
for (const [key, Type, offset, array] of [
  ["positions", Float32Array, 0, values.positions],
  ["normals", Float32Array, 36, values.normals],
  ["uvs", Float32Array, 72, values.uvs],
  ["indices", Uint16Array, 96, values.indices],
  ["skinIndices", Uint16Array, 104, new Array(12).fill(0)],
  ["skinWeights", Float32Array, 128, [2, 0, 0, 0, 2, 0, 0, 0, 2, 0, 0, 0]],
]) {
  new Type(fixtureBuffer, offset, array.length).set(array);
  fixtureMesh[key] = { type: Type.name, off: offset, len: array.length };
}
const fixtureRig = {
  materials: [{ name: "fixture", color: [1, 1, 1], roughness: 1, metalness: 0,
    opacity: 1, emissive: [0, 0, 0], emissiveIntensity: 1 }],
  images: {},
  bones: [{ name: "root", parent: -1, matrix: new THREE.Matrix4().toArray() }],
  meshes: [fixtureMesh],
};
const previousFetch = globalThis.fetch;
const previousLocation = globalThis.location;
globalThis.location = { protocol: "http:" };
globalThis.fetch = async url => {
  if (url === "data/rig.json") return Response.json(fixtureRig);
  if (url === "data/rig.pack") return new Response(gzipSync(new Uint8Array(fixtureBuffer)));
  throw new Error(`Unexpected fixture request: ${url}`);
};
try {
  const { createAvatar, rigReady } = await import("../js/avatar.js");
  const decoded = await rigReady;
  const originalWeights = decoded.meshes[0].skinWeights.slice();
  const avatar = createAvatar({ textureLoader: null });
  const mesh = avatar.children.find(object => object.isSkinnedMesh);
  assert.ok(mesh);
  assert.equal(mesh.geometry.getAttribute("position").array, decoded.meshes[0].positions);
  assert.equal(mesh.geometry.getAttribute("skinIndex").array, decoded.meshes[0].skinIndices);
  assert.notEqual(mesh.geometry.getAttribute("skinWeight").array, decoded.meshes[0].skinWeights);
  assert.deepEqual(decoded.meshes[0].skinWeights, originalWeights);
  assert.deepEqual([...mesh.geometry.getAttribute("skinWeight").array],
    [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0]);
  mesh.geometry.dispose();
  for (const material of mesh.material) material.dispose();
  mesh.skeleton.dispose();
} finally {
  globalThis.fetch = previousFetch;
  if (previousLocation === undefined) delete globalThis.location;
  else globalThis.location = previousLocation;
}

console.log("PASS: geometry values, bounds, default isolation, view reuse and avatar weight isolation");
