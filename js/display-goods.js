import * as THREE from "../vendor/three.module.js";
import { gunzipSync, strFromU8 } from "../vendor/fflate.module.js";
import packed from "../data/display-goods-packed.json";
import { createGeometry } from "./geometry.js";
import { createMapMaterials } from "./map-materials.js";

export function addDisplayGoods(scene) {
  const bytes = Uint8Array.from(atob(packed), (character) => character.charCodeAt(0));
  const displays = JSON.parse(strFromU8(gunzipSync(bytes)));
  return displays.map((display) => {
    const group = new THREE.Group();
    const materials = createMapMaterials(display);
    for (const part of display.meshes) {
      group.add(new THREE.Mesh(createGeometry(part), materials[part.material]));
    }
    group.name = display.name;
    group.position.set(display.x, display.y, display.z);
    group.rotation.y = display.rotation;
    group.userData.productId = display.id;
    scene.add(group);
    return group;
  });
}
