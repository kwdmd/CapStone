import { playerCollisionSize } from "./player-collision-size.js";
import { touchesObjectWall } from "./object-walls.js";
import * as THREE from "../vendor/three.module.js";
// [구조 설명] 다음 발판 높이를 먼저 구해 계단 앞면과 벽을 구분한다.
export function createWalker(player, meshes, settings, cylinders = [], fences = [], objectWalls = null) {
  const ray = new THREE.Raycaster();
  // 도슨트 원통에는 플레이어 치마 반폭도 더한다. 바닥·카메라 레이에는 넣지 않는다.
  const { radius: playerRadius, height: playerHeight, surfaceRatio } = playerCollisionSize(settings);
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
        .find((h) => h.face.normal.y > 0.55 && h.object.name !== "Cylinder_1" &&
          !(h.object.name === "Cylinder.006_0" && h.point.y > 9.50));
      if (
        !floor ||
        floor.point.y - player.y > settings.stepHeight + 0.001 ||
        player.y - floor.point.y > settings.maxDrop
      )
        return;
      const blocked = cylinders.some(({ x: cx, z: cz, bottom, top, radius }) => {
        if (Math.min(player.y, floor.point.y) >= top ||
            Math.max(player.y, floor.point.y) + playerHeight <= bottom) return false;
        const next = (x - cx) ** 2 + (z - cz) ** 2;
        const previous = (player.x - cx) ** 2 + (player.z - cz) ** 2;
        // 이미 경계 안에서 시작했다면 바깥쪽으로 빠져나갈 수 있다.
        return next < (radius + playerRadius) ** 2 && next <= previous;
      });
      if (blocked) return;
      if (objectWalls && touchesObjectWall(objectWalls, player, x, z, floor.point.y, playerRadius * surfaceRatio, playerHeight)) return;
      for (const fence of fences) {
        if (Math.min(player.y, floor.point.y) >= fence.top ||
            Math.max(player.y, floor.point.y) + playerHeight <= fence.bottom) continue;
        const clearance = playerRadius + fence.thickness / 2;
        const next = distanceToFenceSquared(x, z, fence);
        if (next < clearance ** 2 && next < distanceToFenceSquared(player.x, player.z, fence)) return;
      }
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
            .some((h) => !/^Cylinder(?:_[012]|\.030(?:_\d+)?)$/.test(h.object.name) &&
              !(h.object.name === "Cylinder.006_0" && h.point.y >= 7.9) && Math.abs(h.face.normal.y) < 0.65)
        )
          return;
      }
      player.x = x;
      player.z = z;
      player.y = floor.point.y;
    }
  };
}

// 울타리 선분과 발 중심 사이의 수평 거리. 끝에서도 캐릭터 반폭을 확보한다.
function distanceToFenceSquared(x, z, { start, end }) {
  const dx = end[0] - start[0];
  const dz = end[1] - start[1];
  const projection = ((x - start[0]) * dx + (z - start[1]) * dz) / (dx * dx + dz * dz);
  const t = Math.max(0, Math.min(1, projection));
  return (x - start[0] - t * dx) ** 2 + (z - start[1] - t * dz) ** 2;
}

