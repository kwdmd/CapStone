import * as THREE from "../vendor/three.module.js";
import rigData from "../data/avatar-rig.json" with { type: "json" };
import { createGeometry } from "./geometry.js";
import { createAvatarMotion } from "./avatar-motion.js";

// [구조 설명] 원본 FBX의 본 계층·정점 가중치를 보존한 웹용 파생 모델.
// 위치와 회전은 scene.js, 팔다리 동작은 avatar-motion.js가 담당한다.
export function createAvatar() {
  const avatar = new THREE.Group();
  avatar.name = "pawn-3";
  const bones = rigData.bones.map(data => {
    const bone = new THREE.Bone();
    bone.name = data.name;
    new THREE.Matrix4().fromArray(data.matrix).decompose(bone.position,bone.quaternion,bone.scale);
    return bone;
  });
  rigData.bones.forEach((data,i) => {
    (data.parent < 0 ? avatar : bones[data.parent]).add(bones[i]);
  });
  avatar.updateMatrixWorld(true);
  const skeleton = new THREE.Skeleton(bones);
  for (const data of rigData.meshes) {
    const geometry=createGeometry(data);
    geometry.setAttribute('skinIndex',new THREE.Uint16BufferAttribute(data.skinIndices,4));
    geometry.setAttribute('skinWeight',new THREE.Float32BufferAttribute(data.skinWeights,4));
    for(const [start,count,index] of data.groups)geometry.addGroup(start,count,index);
    const materials=data.colors.map(color=>new THREE.MeshStandardMaterial({color:new THREE.Color(...color),roughness:.8,side:THREE.DoubleSide}));
    const mesh=new THREE.SkinnedMesh(geometry,materials);
    mesh.name=data.name;mesh.normalizeSkinWeights();
    avatar.add(mesh);
    mesh.bind(skeleton,new THREE.Matrix4());
    // [구조 설명] 움직이는 팔다리가 정적 경계 밖으로 나가도 잘리지 않도록 한다.
    mesh.frustumCulled=false;
  }
  avatar.userData.updateMotion=createAvatarMotion(bones);
  return avatar;
}
