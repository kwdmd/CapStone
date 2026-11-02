import {fitKnightCoat} from "./knight-coat.js";
import * as THREE from "../vendor/three.module.js";
import { gunzipSync, strFromU8 } from "../vendor/fflate.module.js";

// 압축 해제와 숫자 배열 변환을 렌더 스레드 밖에서 끝낸다.
self.onmessage = ({ data: source }) => {
  try {
    const packed = JSON.parse(source);
    const bytes = Uint8Array.fromBase64(packed.data);
    const rig = JSON.parse(strFromU8(gunzipSync(bytes)));
    if (rig.name === "Knight-4-2-right-foot") {
      for (const mesh of rig.meshes.filter(m => ["Cylinder.002","Cube"].includes(m.name))) {
        const position = new THREE.Float32BufferAttribute(mesh.positions,3);
        const fit = fitKnightCoat(rig,mesh,{attributes:{position}});
        mesh.skinIndices=fit.indices; mesh.skinWeights=fit.weights; mesh.coatWeightsReady=true;
      }
    }
    const transfer = [];
    for (const mesh of rig.meshes) {
      for (const [key, Type] of Object.entries({
        positions: Float32Array, normals: Float32Array, uvs: Float32Array,
        indices: Uint32Array, skinIndices: Uint16Array, skinWeights: Float32Array,
      })) {
        if (!mesh[key]) continue;
        mesh[key] = new Type(mesh[key]);
        transfer.push(mesh[key].buffer);
      }
    }
    self.postMessage({ rig }, transfer);
  } catch (error) {
    self.postMessage({ error: error.message });
  }
};

