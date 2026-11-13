import assert from "node:assert/strict";
import * as T from "../vendor/three.module.js";
import {
  createCameraCollision,
  recoverCameraDistance,
} from "../js/camera-collision.js";
const check = createCameraCollision(),
  target = new T.Vector3(),
  dir = new T.Vector3(0, 0, 1);
assert.equal(check(target, dir, [], 32, 0.35), 32);
const wall = new T.Mesh(
  new T.BoxGeometry(10, 10, 1),
  new T.MeshBasicMaterial(),
);
wall.position.z = 5;
wall.updateMatrixWorld();
assert.ok(Math.abs(check(target, dir, [wall], 32, 0.35) - 4.15) < 0.0001);
const approaching = recoverCameraDistance(32, 4, 0.016, 4, 6);
assert.ok(approaching > 4 && approaching < 32);
let near60 = 18, near30 = 18;
for (let i = 0; i < 60; i++) near60 = recoverCameraDistance(near60, 6, 1 / 60, 4, 6);
for (let i = 0; i < 30; i++) near30 = recoverCameraDistance(near30, 6, 1 / 30, 4, 6);
assert.ok(Math.abs(near60 - near30) < 1e-8);
assert.ok(near60 >= 6 && near60 < 6.1);
let a = 4,
  b = 4;
for (let i = 0; i < 60; i++) a = recoverCameraDistance(a, 32, 1 / 60, 4);
for (let i = 0; i < 30; i++) b = recoverCameraDistance(b, 32, 1 / 30, 4);
assert.ok(Math.abs(a - b) < 1e-8);
assert.ok(a > 4 && a < 32);
wall.position.set(0.35, 0, 5);
wall.geometry = new T.BoxGeometry(0.1, 0.1, 1);
wall.updateMatrixWorld();
assert.ok(check(target, dir, [wall], 32, 0.35) < 32);
console.log(
  "PASS: empty space, wall clearance, off-center obstacle, smooth approach, smooth frame-independent recovery",
);
