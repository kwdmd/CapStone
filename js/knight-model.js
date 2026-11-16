import * as THREE from "../vendor/three.module.js";
import { GLTFLoader } from "../vendor/GLTFLoader.js";
import { gunzipSync } from "../vendor/fflate.module.js";
import { readResponse } from "./binary.js";
import { createKnightMotion } from "./knight-motion.js";
import { restoreArrayBytes } from "./array-storage.js";
import motionAsset from "../data/knight-motion.json" with { type: "json" };
import modelLayout from "../data/knight-6a-layout.json" with { type: "json" };

// Eye-only material settings from the supplied Knight-1115.glb reference.
// Pupil images, UVs and geometry stay intact; the face skin keeps its original color.
const eyeReference = new Map([
  ["Material.080", { metallicFactor: 0, roughnessFactor: 1 }],
  ["Material.081", { metallicFactor: 0, roughnessFactor: 1 }],
  ["Material.075", { metallicFactor: 0.1818181574344635, roughnessFactor: 0.2863636314868927 }],
]);

export function createKnightLoader() {
  return new GLTFLoader().register(parser => ({
    name: "KnightEyeReference1115",
    beforeRoot() {
      for (const material of parser.json.materials ?? []) {
        const settings = eyeReference.get(material.name);
        if (!settings) continue;
        if (material.extensions?.KHR_materials_unlit) {
          delete material.extensions.KHR_materials_unlit;
          if (Object.keys(material.extensions).length === 0) delete material.extensions;
        }
        material.pbrMetallicRoughness ??= {};
        Object.assign(material.pbrMetallicRoughness, settings);
      }
    },
  }));
}

// Preserve the supplied GLB's bind matrices and physical cloth sheen.
// Geometry and images are not re-exported or reduced in quality.
export function createKnightGroup(gltf) {
  const normalization = motionAsset.normalization;
  if (!normalization || !Number.isFinite(normalization.scale) || normalization.scale <= 0 ||
      !normalization.offset?.every(Number.isFinite) || normalization.offset.length !== 3) {
    throw new Error("나이트 모델의 크기 설정이 올바르지 않습니다.");
  }
  const group = new THREE.Group();
  group.name = "Knight-6a";
  const model = new THREE.Group();
  model.name = "Knight-6a-normalization";
  model.scale.setScalar(normalization.scale);
  model.position.fromArray(normalization.offset);
  model.rotation.y = normalization.yaw ?? 0;
  model.add(gltf.scene);
  group.add(model);

  const bones = new Set();
  gltf.scene.traverse(object => {
    // The standard loader sanitizes periods in names. Restore the source names;
    // this GLB has no embedded clips and the retargeted controller uses Bone objects.
    const association = gltf.parser.associations.get(object);
    const sourceName = gltf.parser.json.nodes[association?.nodes]?.name;
    if (sourceName) object.name = sourceName;
    if (object.isSkinnedMesh) {
      object.frustumCulled = false;
      object.skeleton.bones.forEach(bone => bones.add(bone));
    }
  });
  gltf.scene.traverse(object => {
    if (!object.isMesh) return;
    let ancestor = object;
    let bounds;
    while (ancestor && !bounds) {
      bounds = motionAsset.renderBounds?.[ancestor.name];
      ancestor = ancestor.parent;
    }
    if (bounds) {
      object.boundingBox = new THREE.Box3(
        new THREE.Vector3().fromArray(bounds.min), new THREE.Vector3().fromArray(bounds.max),
      );
      object.boundingSphere = new THREE.Sphere(new THREE.Vector3().fromArray(bounds.center), bounds.radius);
    }
  });
  if (bones.size === 0) throw new Error("새 나이트의 스켈레톤을 찾을 수 없습니다.");
  group.updateMatrixWorld(true);
  const motion = createKnightMotion(group, [...bones], { forwardZ: -1 });
  group.userData.updateIdle = motion.update;
  group.userData.setTalking = motion.setTalking;
  group.userData.setAttention = motion.setAttention;
  group.userData.modelSource = "Knight-6a.glb";
  return group;
}

// Restore the exact original GLB bytes before handing them to the native loader.
export async function decodeKnightAsset(compressed) {
  let bytes;
  if (typeof DecompressionStream === "function") {
    try {
      bytes = await new Response(new Blob([compressed]).stream()
        .pipeThrough(new DecompressionStream("gzip"))).arrayBuffer();
    } catch {
      // Same lossless fallback as the other compressed character assets.
    }
  }
  if (!bytes) {
    const decoded = gunzipSync(new Uint8Array(compressed));
    bytes = decoded.buffer.slice(decoded.byteOffset, decoded.byteOffset + decoded.byteLength);
  }
  if (bytes.byteLength !== modelLayout.originalBytes) {
    throw new Error("나이트 GLB 파일의 길이가 올바르지 않습니다.");
  }
  let sliceStart = performance.now();
  for (const view of modelLayout.views) {
    restoreArrayBytes(bytes, view);
    if (performance.now() - sliceStart >= 8) {
      await new Promise(resolve => setTimeout(resolve, 0));
      sliceStart = performance.now();
    }
  }
  if (bytes.byteLength < 12 || new DataView(bytes).getUint32(0, true) !== 0x46546c67) {
    throw new Error("나이트 GLB 파일이 손상되었습니다.");
  }
  return bytes;
}

export async function loadKnightModel(compressed) {
  if (!compressed) {
    const response = await readResponse("data/knight-6a.glb.pack");
    compressed = await response.arrayBuffer();
  }
  const bytes = await decodeKnightAsset(compressed);
  const gltf = await createKnightLoader().parseAsync(bytes, "");
  return { group: createKnightGroup(gltf) };
}
