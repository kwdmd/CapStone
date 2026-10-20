import * as THREE from "../vendor/three.module.js";
// [구조 설명] 변환된 FBX의 정점·인덱스를 공통 BufferGeometry로 만든다.
export function createGeometry(data) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(data.positions, 3),
  );
  geometry.setIndex(data.indices);
  // 원본 노멀과 UV 보존. 없는 기존 모델만 노멀 계산.
  if (data.normals) geometry.setAttribute("normal", new THREE.Float32BufferAttribute(data.normals, 3));
  else geometry.computeVertexNormals();
  if (data.uvs) geometry.setAttribute("uv", new THREE.Float32BufferAttribute(data.uvs, 2));
  return geometry;
}
