import * as THREE from "../vendor/three.module.js";
import packedRig from "../data/avatar-rig.json" with { type: "json" };
import { gunzipSync, strFromU8 } from "../vendor/fflate.module.js";
// [구조 설명] 원본의 UV·노멀·리깅을 보존한 데이터를 압축해 저장한다.
const rigData =
  packedRig.encoding === "gzip-base64"
    ? JSON.parse(
        strFromU8(
          gunzipSync(
            Uint8Array.from(atob(packedRig.data), (c) => c.charCodeAt(0)),
          ),
        ),
      )
    : packedRig;
import { createGeometry } from "./geometry.js";
import { createAvatarMotion } from "./avatar-motion.js";

// [구조 설명] 원본 FBX의 본 계층·정점 가중치를 보존한 웹용 파생 모델.
// 위치와 회전은 scene.js, 팔다리 동작은 avatar-motion.js가 담당한다.
export function createAvatar({
  textureLoader = typeof document === "undefined"
    ? null
    : new THREE.TextureLoader(),
} = {}) {
  // [구조 설명] 재질을 메시 간 공유한다. Node 테스트에서는 이미지 로더를 주입할 수 있다.
  const textureCache = new Map();
  const materials = rigData.materials.map((data) => {
    const mat = new THREE.MeshStandardMaterial({
      name: data.name,
      color: new THREE.Color(...data.color),
      roughness: data.roughness,
      metalness: data.metalness,
      opacity: data.opacity,
      transparent: data.opacity < 1,
      depthWrite: data.opacity >= 1,
      emissive: new THREE.Color(...data.emissive),
      emissiveIntensity: data.emissiveIntensity,
      side: THREE.DoubleSide,
    });
    for (const key of [
      "map",
      "normalMap",
      "roughnessMap",
      "metalnessMap",
      "emissiveMap",
    ]) {
      if (!data[key] || !textureLoader) continue;
      const transform = data[key + "Transform"];
      const cacheKey = JSON.stringify([data[key], key, transform]);
      if (!textureCache.has(cacheKey)) {
        const tex = textureLoader.load(rigData.images[data[key]]);
        tex.colorSpace =
          key === "map" || key === "emissiveMap"
            ? THREE.SRGBColorSpace
            : THREE.NoColorSpace;
        tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
        if (transform) {
          tex.offset.fromArray(transform.offset);
          tex.repeat.fromArray(transform.repeat);
          tex.rotation = transform.rotation;
        }
        textureCache.set(cacheKey, tex);
      }
      mat[key] = textureCache.get(cacheKey);
    }
    return mat;
  });
  const avatar = new THREE.Group();
  avatar.name = "pawn-A-11";
  const bones = rigData.bones.map((data) => {
    const bone = new THREE.Bone();
    bone.name = data.name;
    new THREE.Matrix4()
      .fromArray(data.matrix)
      .decompose(bone.position, bone.quaternion, bone.scale);
    return bone;
  });
  rigData.bones.forEach((data, i) => {
    (data.parent < 0 ? avatar : bones[data.parent]).add(bones[i]);
  });
  avatar.updateMatrixWorld(true);
  const skeleton = new THREE.Skeleton(bones);
  for (const data of rigData.meshes) {
    const geometry = createGeometry(data);
    geometry.setAttribute(
      "skinIndex",
      new THREE.Uint16BufferAttribute(data.skinIndices, 4),
    );
    geometry.setAttribute(
      "skinWeight",
      new THREE.Float32BufferAttribute(data.skinWeights, 4),
    );
    for (const [start, count, index] of data.groups)
      geometry.addGroup(start, count, index);
    const mesh = new THREE.SkinnedMesh(geometry, materials);
    mesh.name = data.name;
    mesh.normalizeSkinWeights();
    avatar.add(mesh);
    mesh.bind(skeleton, new THREE.Matrix4());
    // [구조 설명] 움직이는 팔다리가 정적 경계 밖으로 나가도 잘리지 않도록 한다.
    mesh.frustumCulled = false;
  }
  avatar.userData.updateMotion = createAvatarMotion(bones);
  return avatar;
}
