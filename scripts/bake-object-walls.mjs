import fs from "node:fs";
import { gunzipSync } from "node:zlib";
import { Box3, Triangle, Vector3 } from "../vendor/three.module.js";

// 맵 교체 후 프로젝트 루트에서 node scripts/bake-object-walls.mjs 실행.
// 각 삼각형과 겹치는 작은 공간만 기록해 오목한 모델의 빈 공간을 보존한다.
const cell = 0.16;
const bytes = gunzipSync(fs.readFileSync("data/map.pack"));
const columns = new Map();
const triangle = new Triangle();
const bounds = new Box3();
const tile = new Box3();
const size = new Vector3(cell, cell, cell);
const settings = JSON.parse(fs.readFileSync("data/scene.json"));
for (const mesh of JSON.parse(fs.readFileSync("data/map.json"))) {
  // 주 지형은 바닥 높이만 제공하고 이동 벽은 만들지 않는다.
  const redBase = mesh.name === "Cylinder.030_2";
  if (!redBase && /^Cylinder\.030(?:_\d+)?$/.test(mesh.name)) continue;
  const positions = new Float32Array(bytes.buffer, bytes.byteOffset + mesh.positions.off, mesh.positions.len);
  const indices = new Uint32Array(bytes.buffer, bytes.byteOffset + mesh.indices.off, mesh.indices.len);
  // 주 지형과 입구 발판의 수평면·낮은 단차는 기존 보행 판정을 사용한다.
  const terrain = /^Cylinder\.050_/.test(mesh.name);
  for (let i = 0; i < indices.length; i += 3) {
    triangle.a.fromArray(positions, indices[i] * 3);
    triangle.b.fromArray(positions, indices[i + 1] * 3);
    triangle.c.fromArray(positions, indices[i + 2] * 3);
    bounds.setFromPoints([triangle.a, triangle.b, triangle.c]);
    // 원형 전시장 아래 빨간 외벽만 복구한다. 계단과 상판은 걸을 수 있다.
    if (/^Cylinder_[012]$/.test(mesh.name)) continue;
    if (mesh.name === "Cylinder.006_0" && bounds.max.y >= 7.9) continue;
    if (redBase) {
      const onRim = [triangle.a, triangle.b, triangle.c].every(p => Math.abs(Math.hypot(p.x - 4, p.z - 14.27) - 8.55) < 0.15);
      if (!onRim || bounds.max.y > 4.05 || bounds.max.y - bounds.min.y < 0.2) continue;
    }
    if (terrain && bounds.max.y - bounds.min.y <= settings.stepHeight) continue;
    for (let x = Math.floor(bounds.min.x/cell); x <= Math.floor(bounds.max.x/cell); x++) {
      for (let z = Math.floor(bounds.min.z/cell); z <= Math.floor(bounds.max.z/cell); z++) {
        const key = x+","+z;
        let occupied = columns.get(key);
        for (let y = Math.floor(bounds.min.y/cell); y <= Math.floor(bounds.max.y/cell); y++) {
          if (occupied?.has(y)) continue;
          tile.min.set(x*cell,y*cell,z*cell);
          tile.max.copy(tile.min).add(size);
          if (!tile.intersectsTriangle(triangle)) continue;
          if (!occupied) columns.set(key, occupied = new Set());
          occupied.add(y);
        }
      }
    }
  }
}
const walls = {};
for (const [key, ys] of columns) {
  const ranges = [];
  for (const y of [...ys].sort((a,b)=>a-b)) {
    if (ranges.length && ranges.at(-1) === y) ranges[ranges.length-1]++;
    else ranges.push(y,y+1);
  }
  walls[key] = ranges;
}
fs.writeFileSync("data/object-walls.json", JSON.stringify({cell,walls}));
console.log("Object collision columns:", columns.size);
