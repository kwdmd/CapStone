import * as THREE from "../vendor/three.module.js";
import { viewDirection } from "./camera-controls.js";
import {
  createCameraCollision,
  recoverCameraDistance,
} from "./camera-collision.js";
// [구조 설명] 시점·충돌·거리 복귀 계산을 렌더 루프와 분리한다.
export function createCameraRig(camera, meshes, settings) {
  const ray = new THREE.Raycaster();
  const cameraCollision = createCameraCollision();
  let cameraDistance = settings.thirdPersonDistance;
  return (player, avatar, third, dt) => {
    if (third) {
      const elevation = THREE.MathUtils.clamp(
        settings.thirdPersonElevation - player.pitch,
        0.2,
        1.3,
      );
      const target = new THREE.Vector3(player.x, player.y + 1, player.z);
      const offset = new THREE.Vector3(
        Math.sin(player.yaw) * Math.cos(elevation),
        Math.sin(elevation),
        Math.cos(player.yaw) * Math.cos(elevation),
      );
      // [직접 수정] scene.json에서 임시 충돌 보정과 여유 폭, 복귀 속도를 조절한다.
      let safe;
      if (settings.cameraCollisionEnabled) {
        safe = cameraCollision(
          target,
          offset,
          meshes,
          settings.thirdPersonDistance,
          settings.cameraCollisionRadius,
        );
        cameraDistance = recoverCameraDistance(
          cameraDistance,
          safe,
          dt,
          settings.cameraReturnSpeed,
        );
      } else {
        ray.far = settings.thirdPersonDistance;
        ray.set(target, offset);
        const hit = ray.intersectObjects(meshes, false)[0];
        cameraDistance = hit
          ? Math.max(0.3, hit.distance - 0.2)
          : settings.thirdPersonDistance;
      }
      camera.position.copy(target).addScaledVector(offset, cameraDistance);
      // 거리가 0일 때에도 시선 방향이 뒤집히지 않도록 명시한다.
      camera.lookAt(camera.position.clone().sub(offset));
      avatar.visible = cameraDistance > settings.cameraHideAvatarDistance;
    } else {
      const direction = viewDirection(player.yaw, player.pitch);
      camera.position.set(player.x, player.y + settings.eyeHeight, player.z);
      camera.lookAt(
        player.x + direction.x,
        player.y + settings.eyeHeight + direction.y,
        player.z + direction.z,
      );
    }
  };
}
