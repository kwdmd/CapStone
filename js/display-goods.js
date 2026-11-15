import * as THREE from "../vendor/three.module.js";

// 새 맵에서 받침과 인쇄면을 포함하는 원본 노드 이름이다.
const standNodes = { queen: "Cylinder.054", king: "Cylinder.055", bishop: "Plane", "photocard-a": "Cube.005", "photocard-b": "Cube.006" };

export function addDisplayGoods(scene, meshes) {
  return Object.entries(standNodes).map(([productId, node]) => {
    const parts = meshes.filter(mesh => mesh.name.startsWith(node + "_"));
    if (!parts.length) throw new Error("Missing product stand: " + node);

    // 맵의 실제 메시를 묶고, 상호작용 기준점은 받침 중앙에 둔다.
    const bounds = new THREE.Box3();
    for (const mesh of parts) bounds.expandByObject(mesh);
    const group = new THREE.Group();
    bounds.getCenter(group.position);
    group.position.y = bounds.min.y;
    group.name = node;
    group.userData.productId = productId;
    scene.add(group);
    for (const mesh of parts) group.attach(mesh);
    return group;
  });
}
