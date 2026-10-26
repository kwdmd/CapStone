import * as THREE from "../vendor/three.module.js";
// [구조 설명] 다음 발판 높이를 먼저 구해 계단 앞면과 벽을 구분한다.
export function createWalker(player, meshes, settings) {
  const ray = new THREE.Raycaster();
  const down = new THREE.Vector3(0, -1, 0);
  const direction = new THREE.Vector3();
  return (dx, dz) => {
    const length = Math.hypot(dx, dz);
    if (!length) return;
    // [직접 수정] 달릴 때 좁은 계단을 건너뛰지 않도록 이동을 나눈다.
    const steps = Math.ceil(length / 0.08);
    dx /= steps;
    dz /= steps;
    direction.set(dx, 0, dz).normalize();
    for (let i = 0; i < steps; i++) {
      const x = player.x + dx,
        z = player.z + dz;
      ray.set(
        new THREE.Vector3(x, player.y + settings.stepHeight + 0.01, z),
        down,
      );
      ray.far = settings.stepHeight + settings.maxDrop + 0.02;
      const floor = ray
        .intersectObjects(meshes, false)
        .find((h) => h.face.normal.y > 0.55);
      if (
        !floor ||
        floor.point.y - player.y > settings.stepHeight + 0.001 ||
        player.y - floor.point.y > settings.maxDrop
      )
        return;
      const base = Math.max(player.y, floor.point.y);
      for (const height of [settings.stepHeight + 0.03, 1.65]) {
        ray.set(
          new THREE.Vector3(player.x, base + height, player.z),
          direction,
        );
        ray.far = Math.hypot(dx, dz) + 0.18;
        if (
          ray
            .intersectObjects(meshes, false)
            .some((h) => Math.abs(h.face.normal.y) < 0.65)
        )
          return;
      }
      player.x = x;
      player.z = z;
      player.y = floor.point.y;
    }
  };
}
