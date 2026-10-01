import * as THREE from "../vendor/three.module.js";
// [구조 설명] 중앙과 둘레 8개 광선으로 카메라의 여유 폭을 근사한다.
// 정확한 구체 충돌은 아니지만 단일 광선보다 모서리 관통을 줄인다.
export function createCameraCollision() {
  const ray = new THREE.Raycaster(),
    right = new THREE.Vector3(),
    up = new THREE.Vector3(),
    origin = new THREE.Vector3();
  return (target, direction, meshes, maxDistance, radius) => {
    right.crossVectors(direction, new THREE.Vector3(0, 1, 0)).normalize();
    up.crossVectors(right, direction).normalize();
    let safe = maxDistance;
    for (let i = -1; i < 8; i++) {
      origin.copy(target);
      if (i >= 0) {
        const angle = (i * Math.PI) / 4;
        origin
          .addScaledVector(right, Math.cos(angle) * radius)
          .addScaledVector(up, Math.sin(angle) * radius);
      }
      ray.set(origin, direction);
      ray.far = maxDistance + radius;
      const hit = ray.intersectObjects(meshes, false)[0];
      if (hit) safe = Math.min(safe, Math.max(0, hit.distance - radius));
    }
    return safe;
  };
}
// [구조 설명] 벽 접근 시 즉시 안전 거리로 줄이고, 복귀만 프레임 시간 기준으로 보간한다.
// [직접 수정] returnSpeed가 클수록 원래 거리로 빨리 돌아간다.
export function recoverCameraDistance(current, safe, dt, returnSpeed) {
  return safe < current
    ? safe
    : current + (safe - current) * (1 - Math.exp(-returnSpeed * dt));
}
