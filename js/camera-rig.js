import { zoomValue } from "./camera-zoom.js";
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
  let desiredDistance = settings.thirdPersonDistance;
  let followY;
  const update = (player, avatar, third, dt) => {
    // [직접 수정] 계단 높이 변화는 부드럽게 따라가되 발보다 지나치게 낮아지지 않게 제한한다.
    followY ??= player.y;
    followY +=
      (player.y - followY) *
      (1 - Math.exp(-(settings.cameraHeightSpeed ?? 10) * dt));
    followY = THREE.MathUtils.clamp(followY, player.y - 0.25, player.y + 0.25);
    const fov = 48;
    if (camera.fov !== fov) {
      camera.fov = fov;
      camera.updateProjectionMatrix();
    }
    if (third) {
      const elevation = THREE.MathUtils.clamp(
        settings.thirdPersonElevation - player.pitch,
        0.2,
        1.3,
      );
      const target = new THREE.Vector3(player.x, followY + 1, player.z);
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
          desiredDistance,
          settings.cameraCollisionRadius,
        );
        cameraDistance = recoverCameraDistance(
          cameraDistance,
          Math.max(safe, Math.min(settings.cameraCollisionMinDistance ?? 0, desiredDistance)),
          dt,
          settings.cameraReturnSpeed,
          settings.cameraApproachSpeed ?? 6,
        );
      } else {
        ray.far = desiredDistance;
        ray.set(target, offset);
        const hit = ray.intersectObjects(meshes, false)[0];
        cameraDistance = hit
          ? Math.max(0.3, hit.distance - 0.2)
          : desiredDistance;
      }
      // [직접 수정] 충돌 자동 확대의 최소 거리. 좁은 공간에서는 벽 가림이 생길 수 있다.
      // 사용자가 휠로 더 가까이 설정한 경우에는 그 수동 거리를 존중한다.
      cameraDistance = Math.max(
        Math.min(settings.cameraCollisionMinDistance ?? 0, desiredDistance),
        cameraDistance,
      );
      camera.position.copy(target).addScaledVector(offset, cameraDistance);
      // 거리가 0일 때에도 시선 방향이 뒤집히지 않도록 명시한다.
      camera.lookAt(camera.position.clone().sub(offset));
      avatar.visible = cameraDistance > settings.cameraHideAvatarDistance;
    } else {
      const direction = viewDirection(player.yaw, player.pitch);
      camera.position.set(player.x, followY + settings.eyeHeight, player.z);
      camera.lookAt(
        player.x + direction.x,
        followY + settings.eyeHeight + direction.y,
        player.z + direction.z,
      );
    }
  };
  // 3인칭에서만 거리를 조절한다. 1인칭 시야각은 48도로 고정한다.
  update.zoom = (delta, third) => {
    if (third)
      desiredDistance = zoomValue(
        desiredDistance,
        delta,
        settings.zoomMinDistance ?? 3,
        settings.zoomMaxDistance ?? 45,
      );
  };
  return update;
}
