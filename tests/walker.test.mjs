import assert from "node:assert/strict";
import * as T from "../vendor/three.module.js";
import { createWalker } from "../js/walker.js";
const meshes = [];
function box(x, y, w, h) {
  const m = new T.Mesh(new T.BoxGeometry(w, h, 4), new T.MeshBasicMaterial());
  m.position.set(x, y, 0);
  m.updateMatrixWorld();
  meshes.push(m);
}
box(-1, -0.1, 2, 0.2);
box(0.4, 0.3, 0.8, 0.6);
box(1.2, 0.6, 0.8, 1.2);
box(2, 0.9, 0.8, 1.8);
const p = { x: -0.5, y: 0, z: 0 };
const move = createWalker(p, meshes, { stepHeight: 0.75, maxDrop: 0.85 });
for (let i = 0; i < 28; i++) move(0.1, 0);
assert.ok(p.x > 2.2);
assert.ok(Math.abs(p.y - 1.8) < 1e-5);
for (let i = 0; i < 28; i++) move(-0.1, 0);
assert.ok(p.x < 0);
assert.ok(Math.abs(p.y) < 1e-5);
box(0.5, 2, 0.2, 4);
for (let i = 0; i < 20; i++) move(0.1, 0);
assert.ok(p.x < 0.4, "wall blocks walking");
console.log("PASS: stairs up/down and tall wall");
