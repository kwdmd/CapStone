import fs from "node:fs/promises";
import zlib from "node:zlib";
import path from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
import * as THREE from "../vendor/three.module.js";
import { fitKnightCoat } from "../js/knight-coat.js";
import { splitNpcMesh } from "../js/split-npc-mesh.js";
import { decodeNpcBinary } from "../js/npc-binary.js";

// [직접 수정] 모델/의상 보정 변경 후 이 스크립트를 실행하고 npm run build 한다.
// data/npc-*.json은 변환용 원본이며 웹 배포에는 .pack만 포함한다.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const keys = { positions: Float32Array, normals: Float32Array, uvs: Float32Array,
  indices: Uint32Array, skinIndices: Uint16Array, skinWeights: Float32Array };
// [직접 수정] 복원 비용 대비 이득이 큰 배열만 변환한다. gzip 자체는 모든 데이터에 유지한다.
const selection = { minimumSavedBytes: 8192, minimumCompressedSavingRatio: 0.25, minimumSavingPerDecodedByte: 0.12 };
const report = [];
for (const id of ["knight", "rook", "pawn-b"]) {
  const source = JSON.parse(await fs.readFile(path.join(root, `data/npc-${id}.json`), "utf8"));
  const oldPacked = Buffer.from(source.data, "base64");
  const rig = JSON.parse(zlib.gunzipSync(oldPacked));
  const start = performance.now();
  // 기존 워커의 연산과 동일한 순서·정밀도로 배포 전에 한 번만 계산한다.
  if (rig.name === "Knight-4-2-right-foot") {
    for (const mesh of rig.meshes.filter(m => ["Cylinder.002", "Cube"].includes(m.name))) {
      const position = new THREE.Float32BufferAttribute(mesh.positions, 3);
      const fit = fitKnightCoat(rig, mesh, { attributes: { position } });
      mesh.skinIndices = fit.indices; mesh.skinWeights = fit.weights; mesh.coatWeightsReady = true;
    }
  }
  for (const mesh of rig.meshes) for (const [key, Type] of Object.entries(keys))
    if (mesh[key]) mesh[key] = new Type(mesh[key]);
  if (["Rook-1", "pawn-B-11"].includes(rig.name))
    rig.meshes = rig.meshes.flatMap(m => m.positions.length / 3 > 100000 ? splitNpcMesh(m) : [m]);
  const preparationMs = performance.now() - start;
  const arrays = [];
  const chunks = []; let offset = 0;
  const meta = { ...rig, meshes: rig.meshes.map(mesh => {
    const out = { ...mesh };
    for (const key of Object.keys(keys)) {
      const a = mesh[key]; if (!a) continue;
      const padding = (4 - offset % 4) % 4;
      if (padding) { chunks.push(Buffer.alloc(padding)); offset += padding; }
      out[key] = { type: a.constructor.name, offset, length: a.length, encoding: "byte-delta" };
      // 같은 바이트 위치끼리 모으고 이전 값과의 차이를 저장한다.
      // 반올림 없이 모든 비트를 보존하면서 gzip이 반복을 잘 찾게 한다.
      const raw = new Uint8Array(a.buffer, a.byteOffset, a.byteLength);
      const encoded = Buffer.allocUnsafe(a.byteLength), stride = a.BYTES_PER_ELEMENT;
      for (let byte = 0; byte < stride; byte++) {
        let previous = 0;
        for (let i = 0; i < a.length; i++) {
          const value = raw[i * stride + byte];
          encoded[byte * a.length + i] = (value - previous) & 255;
          previous = value;
        }
      }
      // 배열별로 가장 작은 무손실 표현을 선택한다.
      const shuffled = Buffer.allocUnsafe(raw.length);
      for (let byte = 0; byte < stride; byte++)
        for (let i = 0; i < a.length; i++) shuffled[byte * a.length + i] = raw[i * stride + byte];
      const candidates = [[undefined, raw], ["byte-shuffle", shuffled], ["byte-delta", encoded]];
      const measured = candidates.map(([encoding, data]) => ({ encoding, data, size: zlib.gzipSync(data, { level: 9 }).length }));
      const smallest = [...measured].sort((a, b) => a.size - b.size)[0];
      const saved = measured[0].size - smallest.size;
      const useTransform = saved >= selection.minimumSavedBytes
        && saved / measured[0].size >= selection.minimumCompressedSavingRatio
        && saved / raw.length >= selection.minimumSavingPerDecodedByte;
      const best = useTransform ? smallest : measured[0];
      arrays.push({ mesh: mesh.name, attribute: key, decodedBytes: raw.length, rawGzipBytes: measured[0].size,
        selectedGzipBytes: best.size, encoding: best.encoding || "raw", savedBytes: measured[0].size - best.size });
      out[key].encoding = best.encoding;
      chunks.push(best.data); offset += a.byteLength;
    }
    return out;
  }) };
  const json = Buffer.from(JSON.stringify(meta));
  const header = Buffer.alloc(Math.ceil((12 + json.length) / 4) * 4);
  header.writeUInt32LE(0x4243504e, 0); header.writeUInt32LE(1, 4); header.writeUInt32LE(json.length, 8); json.copy(header, 12);
  const packed = zlib.gzipSync(Buffer.concat([header, ...chunks]), { level: 9 });
  const decoded = decodeNpcBinary(new Uint8Array(zlib.gunzipSync(packed)));
  // 모든 정점 속성과 본·이미지·재질·모션 트랙의 동일성을 검증한다.
  assert.deepStrictEqual(decoded, rig);
  await fs.writeFile(path.join(root, `data/npc-${id}.pack`), packed);
  report.push({ id, sourceBytes: oldPacked.length, binaryBytes: packed.length, preparationMs, meshes: rig.meshes.length, selection, transformedArrays: arrays.filter(a => a.encoding !== "raw").length, transformedBytes: arrays.filter(a => a.encoding !== "raw").reduce((n,a) => n+a.decodedBytes,0), exactRoundTrip: true, arrays });
}
await fs.writeFile(path.join(root, "data/docent-bake-report.json"), JSON.stringify(report, null, 2));
console.log(report.map(({ arrays, ...summary }) => summary));
