import * as THREE from "../vendor/three.module.js";

function floatAttribute(array, itemSize, copyAttributes) {
  return !copyAttributes && array instanceof Float32Array
    ? new THREE.BufferAttribute(array, itemSize)
    : new THREE.Float32BufferAttribute(array, itemSize);
}

// [구조 설명] 변환된 FBX의 정점·인덱스를 공통 BufferGeometry로 만든다.
// 원본 배열을 수정하지 않는 맵·플레이어만 복제 생략을 명시한다.
export function createGeometry(data, { copyAttributes = true } = {}) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    floatAttribute(data.positions, 3, copyAttributes),
  );
  geometry.setIndex(ArrayBuffer.isView(data.indices)?new THREE.BufferAttribute(data.indices,1):data.indices);
  // 원본 노멀과 UV 보존. 없는 기존 모델만 노멀 계산.
  if (data.normals)
    geometry.setAttribute(
      "normal",
      floatAttribute(data.normals, 3, copyAttributes),
    );
  else geometry.computeVertexNormals();
  if (data.uvs)
    geometry.setAttribute("uv", floatAttribute(data.uvs, 2, copyAttributes));
  return geometry;
}
