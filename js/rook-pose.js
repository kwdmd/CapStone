import * as THREE from "../vendor/three.module.js";

// [직접 수정] 룩의 공수 자세. 좌표는 높이 1.8로 정규화된 모델 기준이다.
// 치마 위에서 손을 포개고 팔꿈치는 양옆으로 벌려 치마와 간격을 유지한다.
export function createRookPose(group, bones) {
  const find = (n) => bones.find((b) => b.name === n);
  const root = find("spine");
  group.updateMatrixWorld(true);
  const restRoot = root.matrixWorld.clone();
  const rootInverse = restRoot.clone().invert();
  const arms = ["L", "R"].map((side) => {
    const upper = find("upper_arm." + side),
      fore = find("forearm." + side),
      hand = find("hand." + side);
    return {
      upper,
      fore,
      hand,
      rest: [upper, fore, hand].map((b) =>
        b.getWorldQuaternion(new THREE.Quaternion()),
      ),
      lengths: [
        upper
          .getWorldPosition(new THREE.Vector3())
          .distanceTo(fore.getWorldPosition(new THREE.Vector3())),
        fore
          .getWorldPosition(new THREE.Vector3())
          .distanceTo(hand.getWorldPosition(new THREE.Vector3())),
      ],
    };
  });
  function orient(bone, direction, restRotation) {
    const old = new THREE.Vector3(0, 1, 0)
      .applyQuaternion(restRotation)
      .normalize();
    const desired = new THREE.Quaternion()
      .setFromUnitVectors(old, direction.clone().normalize())
      .multiply(restRotation)
      .normalize();
    bone.quaternion.copy(
      bone.parent
        .getWorldQuaternion(new THREE.Quaternion())
        .invert()
        .multiply(desired),
    );
    bone.quaternion.normalize();
    bone.updateWorldMatrix(false, true);
  }
  return () => {
    group.updateMatrixWorld(true);
    const frame = root.matrixWorld.clone().multiply(rootInverse);
    for (const arm of arms) {
      const start = arm.upper.getWorldPosition(new THREE.Vector3());
      const side = Math.sign(
        new THREE.Vector3().copy(start).applyMatrix4(frame.clone().invert()).x,
      );
      const target = new THREE.Vector3(
        side * 0.12,
        side < 0 ? 1.16 : 1.135,
        side < 0 ? -0.29 : -0.26,
      ).applyMatrix4(frame);
      const pole = new THREE.Vector3(side * 0.36, 1.13, -0.13).applyMatrix4(
        frame,
      );
      const axis = target.clone().sub(start).normalize();
      const normal = pole.sub(start);
      normal.addScaledVector(axis, -normal.dot(axis)).normalize();
      const scale = new THREE.Vector3().setFromMatrixScale(frame).x;
      const a = arm.lengths[0] * scale,
        b = arm.lengths[1] * scale;
      const distance = THREE.MathUtils.clamp(
        start.distanceTo(target),
        Math.abs(a - b) + 0.0001,
        a + b - 0.0001,
      );
      const along = (a * a - b * b + distance * distance) / (2 * distance);
      const elbow = start
        .clone()
        .addScaledVector(axis, along)
        .addScaledVector(normal, Math.sqrt(Math.max(0, a * a - along * along)));
      // 맵 배치 배율이 포함된 행렬을 회전으로 직접 읽으면 손/팔이 확대된다.
      // 회전과 배율을 분리한 뒤 단위 쿼터니언만 사용한다.
      const rotation = new THREE.Quaternion();
      frame.decompose(new THREE.Vector3(), rotation, new THREE.Vector3());
      rotation.normalize();
      orient(
        arm.upper,
        elbow.clone().sub(start),
        rotation.clone().multiply(arm.rest[0]),
      );
      orient(
        arm.fore,
        target.clone().sub(elbow),
        rotation.clone().multiply(arm.rest[1]),
      );
      orient(
        arm.hand,
        new THREE.Vector3(-side, -0.25, 0).transformDirection(frame),
        rotation.clone().multiply(arm.rest[2]),
      );
      arm.hand.quaternion.multiply(
        new THREE.Quaternion().setFromAxisAngle(
          new THREE.Vector3(0, 1, 0),
          (-side * Math.PI) / 2,
        ),
      );
      arm.hand.updateWorldMatrix(false, true);
    }
  };
}
