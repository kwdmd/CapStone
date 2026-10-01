import * as THREE from "../vendor/three.module.js";
// [구조 설명] 변환된 FBX의 정점·인덱스를 공통 BufferGeometry로 만든다.
export function createGeometry(data) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(data.positions, 3),
  );
  geometry.setIndex(data.indices);
  geometry.computeVertexNormals();
  return geometry;
}
