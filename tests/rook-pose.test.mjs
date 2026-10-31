import fs from "node:fs";
import zlib from "node:zlib";
import * as T from "../vendor/three.module.js";
import { createNpcRig } from "../js/npc-rig.js";
const d = JSON.parse(
  zlib.gunzipSync(
    Buffer.from(
      JSON.parse(
        fs.readFileSync(new URL("../data/npc-rook.json", import.meta.url)),
      ).data,
      "base64",
    ),
  ),
);
const g = createNpcRig(d, []);
let gap = Infinity;
for (let f = 0; f < 60; f++) {
  g.userData.updateIdle(d.idle.duration / 60);
  g.updateMatrixWorld(true);
  const inv = g.getObjectByName("spine").matrixWorld.clone().invert();
  let top = -Infinity,
    bottom = Infinity;
  for (const name of ["Cylinder.004", "Cube.002", "Cube.035"]) {
    const m = g.getObjectByName(name);
    for (let i = 0; i < m.geometry.attributes.position.count; i++) {
      const v = m
        .getVertexPosition(i, new T.Vector3())
        .applyMatrix4(m.matrixWorld)
        .applyMatrix4(inv);
      if (name === "Cylinder.004") top = Math.max(top, v.y);
      else bottom = Math.min(bottom, v.y);
    }
  }
  gap = Math.min(gap, bottom - top);
}
console.log("MIN_LOCAL_VERTICAL_GAP", gap);

if (gap < 0.04) throw new Error("룩 손/소매와 치마 사이 간격 부족");

// 실제 맵 배율/위치 및 회전에서도 모델 내부의 자세가 같아야 한다.
for (const yaw of [0, 0.8]) {
  const plain = createNpcRig(d, []),
    placed = createNpcRig(d, []);
  placed.scale.setScalar(1.5365897211804986);
  placed.position.set(1, 1.4144738912582397, -16);
  placed.rotation.y = yaw;
  for (let frame = 0; frame < 12; frame++) {
    plain.userData.updateIdle(d.idle.duration / 12);
    placed.userData.updateIdle(d.idle.duration / 12);
    plain.updateMatrixWorld(true);
    placed.updateMatrixWorld(true);
    for (const name of ["Cube.002", "Cube.035"]) {
      const a = plain.getObjectByName(name),
        b = placed.getObjectByName(name);
      for (let i = 0; i < a.geometry.attributes.position.count; i += 17) {
        const av = a.getVertexPosition(i, new T.Vector3()),
          bv = b.getVertexPosition(i, new T.Vector3());
        if (av.distanceTo(bv) > 0.0001)
          throw new Error("맵 배율 적용 시 룩 변형 발생: " + av.distanceTo(bv));
      }
    }
  }
}
console.log(
  "PASS: rook pose is invariant under map scale, placement, rotation",
);
