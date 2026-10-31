import { gunzipSync, strFromU8 } from "../vendor/fflate.module.js";
import { createNpcRig } from "./npc-rig.js";
import { createMapMaterials } from "./map-materials.js";
import rook from "../data/npc-rook.json";
import knight from "../data/npc-knight.json";
import pawn from "../data/npc-pawn-b.json";
import placements from "../data/npcs.json";
// [직접 수정] data/npcs.json에서 x/y/z와 rotation(라디안)을 바꾼다. scale은 높이 1.8 기준 배율이다.
// Idle.fbx 대기 모션을 반복 재생한다. 이동·대화 기능은 별도이다.
export function addNpcs(scene) {
  const avatars = [];
  const cylinders = [];
  const sources = { rook, knight, "pawn-b": pawn };
  for (const placement of placements) {
    const packed = sources[placement.id];
    const data = JSON.parse(
      strFromU8(
        gunzipSync(Uint8Array.from(atob(packed.data), (c) => c.charCodeAt(0))),
      ),
    );
    const materials = createMapMaterials(data);
    // Blender에서 가져온 이미지의 UV 변환도 보존한다. 공유 텍스처는 복제 후 개별 설정한다.
    materials.forEach((material, i) => {
      for (const key of [
        "map",
        "normalMap",
        "roughnessMap",
        "metalnessMap",
        "emissiveMap",
      ]) {
        const transform = data.materials[i][key + "Transform"];
        if (!material[key] || !transform) continue;
        const texture = material[key].clone();
        texture.offset.fromArray(transform.offset);
        texture.repeat.fromArray(transform.repeat);
        texture.rotation = transform.rotation;
        material[key] = texture;
      }
    });
    const group = createNpcRig(data, materials);
    group.userData.npcId = placement.id;
    avatars.push(group);
    // [구조 설명] 높이 1.8 기준 모델에 개별 배율을 적용한다. Rook은 원본의 32.4%, Knight는 40.5%, pawn-B는 사용자 캐릭터 크기를 사용한다.
    group.scale.setScalar(placement.scale ?? 1);
    group.position.set(placement.x, placement.y, placement.z);
    group.rotation.y = placement.rotation;
    scene.add(group);
    // [직접 수정] collisionRadius는 배율 적용 전 의상 폭 기준. 위치·크기는 도슨트 배치를 따른다.
    cylinders.push({
      x: group.position.x, z: group.position.z,
      bottom: group.position.y, top: group.position.y + 1.82 * group.scale.y,
      radius: placement.collisionRadius * group.scale.x,
    });
  }
  const update = (dt) => avatars.forEach((avatar) => avatar.userData.updateIdle(dt));
  update.avatars = avatars;
  update.cylinders = cylinders;
  return update;
}
