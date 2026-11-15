import * as THREE from "../vendor/three.module.js";

// 바닥과 벽이 같은 재질을 공유하므로 위를 향하는 바닥 면만 별도 재질로 분리한다.
// [직접 수정] 값이 클수록 반사가 넓고 부드러워진다. 색·금속성·조명은 유지한다.
const roughness = { "Material.064": 0.45, "Material.065": 0.4, "Material.083": 0.35, "Material.084": 0.45 };
export function softenFloorReflections(mesh) {
  if (!/^Cylinder\.030_[0-4]$/.test(mesh.name)) return;
  const geometry = mesh.geometry, index = geometry.index, position = geometry.attributes.position;
  const materials = [...mesh.material], buckets = new Map(), clones = new Map();
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), normal = new THREE.Vector3();
  for (const group of geometry.groups) {
    const original = materials[group.materialIndex], target = roughness[original.name];
    for (let i = group.start; i < group.start + group.count; i += 3) {
      const ids = [index.getX(i), index.getX(i + 1), index.getX(i + 2)];
      a.fromBufferAttribute(position, ids[0]); b.fromBufferAttribute(position, ids[1]); c.fromBufferAttribute(position, ids[2]);
      normal.crossVectors(b.sub(a), c.sub(a)).normalize();
      let materialIndex = group.materialIndex;
      if (target !== undefined && normal.y > 0.7) {
        if (!clones.has(materialIndex)) {
          const material = original.clone();
          material.roughness = Math.max(original.roughness, target);
          clones.set(materialIndex, materials.length); materials.push(material);
        }
        materialIndex = clones.get(materialIndex);
      }
      if (!buckets.has(materialIndex)) buckets.set(materialIndex, []);
      buckets.get(materialIndex).push(...ids);
    }
  }
  const reordered = []; geometry.clearGroups();
  for (const [materialIndex, ids] of buckets) {
    geometry.addGroup(reordered.length, ids.length, materialIndex);
    for (const id of ids) reordered.push(id);
  }
  geometry.setIndex(new THREE.BufferAttribute(new index.array.constructor(reordered), 1));
  mesh.material = materials;
}
