import assert from "node:assert/strict";
import * as THREE from "../vendor/three.module.js";
import { createAvatar } from "../js/avatar.js";
const requests = [];
const avatar = createAvatar({
  textureLoader: {
    load(url) {
      requests.push(url);
      return new THREE.Texture();
    },
  },
});
assert.equal(avatar.name, "pawn-A-11");
assert.ok(requests.length >= 2, "Both source textures must be requested");
let texturedMeshes = 0;
for (const mesh of avatar.children.filter((child) => child.isSkinnedMesh)) {
  const { position, normal, uv, skinIndex, skinWeight } =
    mesh.geometry.attributes;
  assert.equal(position.count, normal.count);
  assert.equal(position.count, uv.count);
  assert.equal(position.count, skinIndex.count);
  assert.equal(position.count, skinWeight.count);
  assert.equal(
    mesh.geometry.groups.reduce((sum, g) => sum + g.count, 0),
    mesh.geometry.index.count,
  );
  for (const group of mesh.geometry.groups) {
    assert.ok(mesh.material[group.materialIndex]);
    if (mesh.material[group.materialIndex].map) texturedMeshes++;
  }
}
assert.ok(texturedMeshes >= 2);
assert.ok(requests.every((url) => url.startsWith("data:image/")));
console.log(
  "PASS: pawn-A-11 textures, UVs, normals, skinning attributes and material groups",
);
