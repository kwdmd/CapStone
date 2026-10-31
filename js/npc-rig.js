import { createRookPose } from "./rook-pose.js";
import { fitKnightCoat } from "./knight-coat.js";
import * as THREE from "../vendor/three.module.js";
import { createGeometry } from "./geometry.js";
// [구조 설명] 각 모델의 원래 스킨 웨이트와 본을 사용하고, Idle.fbx에서 변환한 회전 트랙을 재생한다.
// [직접 수정] 제자리 도슨트 전용 의상 보정: 모델명 → 의상 메시명 → 따라갈 본.
// 손/다리의 잘못된 웨이트로 의상이 찢어지지 않도록 의상 전체를 한 본에 연결한다.
// 원본 모델 데이터는 유지한다. 걷기/의상 물리가 필요해지면 원본 웨이트를 다시 작업한다.
const idleGarmentBindings = {
  // 망토 천과 흰 테두리는 Cylinder.005에 함께 들어 있다.
  // Plane.004는 별도 의상이므로 원래 웨이트를 유지한다.
  "pawn-B-11": { "Cylinder.005": "spine.002" },
  "Knight-4-2-right-foot": {
    "Plane.012": "spine.003", // 망토는 팔 대신 상체를 따라간다.
    "Cube.024": "shoulder.R", // 견장 판과 술이 동일한 어깨를 따라간다.
    "Cube.026": "shoulder.R",
  },
  "Rook-1": { "Cylinder.004": "spine" }, // 넓은 치마: 골반의 움직임을 따른다.
};

export function createNpcRig(data, materials) {
  const group = new THREE.Group();
  group.name = data.name;
  const bones = data.bones.map((d) => {
    const bone = new THREE.Bone();
    bone.name = d.name;
    new THREE.Matrix4()
      .fromArray(d.matrix)
      .decompose(bone.position, bone.quaternion, bone.scale);
    return bone;
  });
  data.bones.forEach((d, i) =>
    (d.parent < 0 ? group : bones[d.parent]).add(bones[i]),
  );
  group.updateMatrixWorld(true);
  const skeleton = new THREE.Skeleton(bones);
  for (const mesh of data.meshes) {
    const geometry = createGeometry(mesh);
    // [직접 수정] 나이트 부츠의 바지 안쪽 부분만 좁힌다(정규화된 모델 좌표).
    // 발끝/밑창과 높이는 유지하고 y=0.08~0.12에서 점진적으로 폭을 줄인다.
    if (
      data.name === "Knight-4-2-right-foot" &&
      ["Cube.003", "RightFoot_Repaired"].includes(mesh.name)
    ) {
      const position = geometry.attributes.position;
      const centerX = mesh.name === "Cube.003" ? -0.079754 : 0.079754;
      for (let i = 0; i < position.count; i++) {
        const t = THREE.MathUtils.smoothstep(position.getY(i), 0.08, 0.12);
        const scale = 1 - 0.55 * t;
        position.setX(i, centerX + (position.getX(i) - centerX) * scale);
        position.setZ(i, -0.03 + (position.getZ(i) + 0.03) * scale);
      }
      geometry.computeVertexNormals();
    }
    if (data.name === "Knight-4-2-right-foot") {
      const position = geometry.attributes.position;
      if (mesh.name === "Plane.012") {
        // [직접 수정] 뒤쪽 이동은 제거하고 망토를 위로만 0.04 올린다.
        for (let i = 0; i < position.count; i++) {
          position.setY(i, position.getY(i) + 0.04);
        }
      }
      if (["Cube.024", "Cube.026"].includes(mesh.name)) {
        // 견장 전체 크기는 유지하고, 어깨 표면 위/바깥으로 조금 이동한다.
        for (let i = 0; i < position.count; i++) {
          position.setX(i, position.getX(i) + 0.012);
          position.setY(i, position.getY(i) + 0.03);
        }
      }
    }
    const garmentBone = idleGarmentBindings[data.name]?.[mesh.name];
    let skinIndices = mesh.skinIndices;
    let skinWeights = mesh.skinWeights;
    // 룩 장갑의 손가락에 섞인 다른 본 영향을 제거한다. 공수 자세에서는
    // 각 손을 원래 형태 그대로 손목에 연결하여 손가락이 길게 늘어나지 않게 한다.
    if (data.name === "Rook-1" && mesh.name === "Cube.035") {
      skinIndices = new Uint16Array(mesh.skinIndices.length);
      skinWeights = new Float32Array(mesh.skinWeights.length);
      const hands = ["hand.L", "hand.R"].map((name) => {
        const index = data.bones.findIndex((b) => b.name === name);
        return {
          index,
          x: bones[index].getWorldPosition(new THREE.Vector3()).x,
        };
      });
      for (let i = 0; i < mesh.positions.length / 3; i++) {
        const hand = hands.reduce((a, b) =>
          Math.abs(a.x - mesh.positions[i * 3]) <
          Math.abs(b.x - mesh.positions[i * 3])
            ? a
            : b,
        );
        skinIndices[i * 4] = hand.index;
        skinWeights[i * 4] = 1;
      }
    }
    // 룩의 어깨 망토는 공수 자세의 위팔 움직임을 함께 따라간다.
    // 중앙 부착부는 가슴에, 양옆은 같은 쪽 위팔에 연결해 소매와 분리 변형을 막는다.
    if (data.name === "Rook-1" && mesh.name === "Cylinder.007") {
      skinIndices = new Uint16Array(mesh.skinIndices.length);
      skinWeights = new Float32Array(mesh.skinWeights.length);
      const chest = data.bones.findIndex((b) => b.name === "spine.003");
      for (let i = 0; i < mesh.positions.length / 3; i++) {
        const x = mesh.positions[i * 3],
          y = mesh.positions[i * 3 + 1];
        const arm = data.bones.findIndex(
          (b) => b.name === (x < 0 ? "upper_arm.L" : "upper_arm.R"),
        );
        const amount = THREE.MathUtils.smoothstep(Math.abs(x), 0.06, 0.16);
        skinIndices[i * 4] = arm;
        skinWeights[i * 4] = amount;
        skinIndices[i * 4 + 1] = chest;
        skinWeights[i * 4 + 1] = 1 - amount;
      }
    }
    const coat = fitKnightCoat(data, mesh, geometry);
    if (coat) {
      skinIndices = coat.indices;
      skinWeights = coat.weights;
    }
    if (garmentBone) {
      const boneIndex = data.bones.findIndex(
        (bone) => bone.name === garmentBone,
      );
      if (boneIndex < 0) throw new Error(`의상 보정 본 없음: ${garmentBone}`);
      skinIndices = new Uint16Array(mesh.skinIndices.length);
      skinWeights = new Float32Array(mesh.skinWeights.length);
      for (let i = 0; i < skinIndices.length; i += 4) {
        skinIndices[i] = boneIndex;
        skinWeights[i] = 1;
      }
    }
    geometry.setAttribute(
      "skinIndex",
      new THREE.Uint16BufferAttribute(skinIndices, 4),
    );
    geometry.setAttribute(
      "skinWeight",
      new THREE.Float32BufferAttribute(skinWeights, 4),
    );
    for (const [start, count, index] of mesh.groups)
      geometry.addGroup(start, count, index);
    const object = new THREE.SkinnedMesh(geometry, materials);
    object.name = mesh.name;
    object.frustumCulled = false;
    group.add(object);
    object.bind(skeleton, new THREE.Matrix4());
  }
  const poseRook = data.name === "Rook-1" ? createRookPose(group, bones) : null;
  const mixer = new THREE.AnimationMixer(group);
  // 본 이름에 점이 있으므로 UUID로 트랙을 연결한다.
  // [직접 수정] 폰 B만 하체를 고정한다. 나이트는 하체 Idle을 그대로 재생한다.
  // 나이트 부츠 형태는 위에서 별도로 보정한다.
  // 나이트 손목도 원래 로컬 각도를 유지하여 보정된 아래팔 방향을 자연스럽게 따른다.
  // 골반과 상체의 Idle은 계속 재생한다. 걷기 모션에는 이 제한을 그대로 사용하지 않는다.
  const animatedBones = bones.filter((bone) => {
    if (
      data.name === "Rook-1" &&
      /^(upper_arm|forearm|hand)\.[LR]$/.test(bone.name)
    )
      return false;
    // 룩 공수 자세: 골반~가슴의 직립 자세와 평행한 다리를 유지한다.
    // 발 위치를 중앙으로 강제 이동하지 않아 원래 발 사이 간격이 남는다.
    if (
      data.name === "Rook-1" &&
      /^(spine(\.00[123])?|(thigh|shin|foot|toe)\.[LR])$/.test(bone.name)
    )
      return false;
    const stationaryLegs = data.name === "pawn-B-11";
    // [직접 수정] 폰 B 골반~가슴 축은 원래 직립 자세를 유지한다.
    // 팔·목·머리의 Idle은 계속 재생하며 손목은 아래팔을 자연스럽게 따른다.
    if (stationaryLegs && /^(spine(\.00[123])?|hand\.[LR])$/.test(bone.name))
      return false;
    if (stationaryLegs && /^(thigh|shin|foot|toe)\.[LR]$/.test(bone.name))
      return false;
    if (data.name === "Knight-4-2-right-foot" && /^hand\.[LR]$/.test(bone.name))
      return false;
    return true;
  });
  const tracks = animatedBones.map(
    (b) =>
      new THREE.QuaternionKeyframeTrack(
        b.uuid + ".quaternion",
        data.idle.times,
        data.idle.tracks[b.name],
      ),
  );
  const clip = new THREE.AnimationClip("Idle", data.idle.duration, tracks);
  mixer.clipAction(clip).setLoop(THREE.LoopRepeat, Infinity).play();
  // [직접 수정] 폰 B: 앞쪽 6도/바깥 4도. 나이트: 앞쪽 10도/바깥 4도. 매 프레임
  // 원래 Idle을 계산한 다음 보정하므로 회전이 누적되지 않는다.
  const rawArmRotations = new Map();
  const correctArms = () => {
    if (!["Knight-4-2-right-foot", "pawn-B-11"].includes(data.name)) return;
    group.updateMatrixWorld(true);
    const modelRotation = group.getWorldQuaternion(new THREE.Quaternion());
    for (const [name, sign] of [
      ["upper_arm.L", -1],
      ["upper_arm.R", 1],
    ]) {
      const arm = bones.find((b) => b.name === name);
      const parent = arm.parent.getWorldQuaternion(new THREE.Quaternion());
      const pawn = data.name === "pawn-B-11";
      // 모델별 좌우 본 이름 차이를 고려해 폰 B는 실제 어깨 위치로 바깥 방향을 구한다.
      const outward = pawn
        ? Math.sign(
            group.worldToLocal(arm.getWorldPosition(new THREE.Vector3())).x,
          )
        : sign;
      const delta = new THREE.Quaternion().setFromEuler(
        new THREE.Euler(
          THREE.MathUtils.degToRad(pawn ? 6 : 10),
          0,
          THREE.MathUtils.degToRad(outward * 4),
          "XYZ",
        ),
      );
      const local = parent
        .clone()
        .invert()
        .multiply(modelRotation)
        .multiply(delta)
        .multiply(modelRotation.clone().invert())
        .multiply(parent);
      rawArmRotations.set(arm, arm.quaternion.clone());
      arm.quaternion.premultiply(local).normalize();
    }
  };
  mixer.update(0);
  correctArms();
  poseRook?.();
  group.userData.updateIdle = (dt) => {
    for (const [arm, rotation] of rawArmRotations)
      arm.quaternion.copy(rotation);
    mixer.update(dt);
    correctArms();
    poseRook?.();
  };
  return group;
}
