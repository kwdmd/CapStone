import lampWallOffsets from "../data/lamp-wall-offsets.json" with { type: "json" };
import { addBulbHalos } from "./bulb-halos.js";
import * as THREE from "../vendor/three.module.js";
import config from "../data/lighting.json" with { type: "json" };

// [직접 수정] 밝기·조명 범위·동시 개수는 data/lighting.json에서 조절한다.
// 원본 재질 색과 충돌 메시는 유지하며, 플레이어 주변 조명만 실시간으로 켠다.
export function createWarmLighting(scene, meshes) {
  const allLightsOn = typeof location !== "undefined" && new URLSearchParams(location.search).get("lighting") === "all" || config.allLightsOn;
  const halosEnabled = config.halosEnabled && !(typeof location !== "undefined" && new URLSearchParams(location.search).get("halos") === "off");
  const lamps = [], strings = [], stringBulbs = [];
  const highlights = new Map();
  const lampPositions = new Map();
  for (const mesh of meshes) {
    const isLamp = /^Cylinder\.(029|031|032|033|034|035|036|037|038|039|040|048)_1$/.test(mesh.name);
    const isString = /^Sphere\.(015|016|017|019|020|021)_1$/.test(mesh.name);
    const isPost = /^Cube\.(041|042|044|045|046|047|048)_1$/.test(mesh.name);
    if (isPost) {
      // [설명] 체크무늬 낮은 기둥의 발광 창만 보정한다. 기둥 몸체와 무늬는 유지한다.
      // [직접 수정] postEmissiveIntensity로 창 밝기 조절. 실제 광원은 추가하지 않는다.
      mesh.material = [...mesh.material];
      for (const index of new Set(mesh.geometry.groups.map(group => group.materialIndex))) {
        const original = mesh.material[index];
        if (!original?.emissive) continue;
        const material = original.clone();
        material.emissive.set(config.bulbColor);
        material.emissiveIntensity = config.postEmissiveIntensity;
        mesh.material[index] = material;
      }
    }
    if (!isLamp && !isString) continue;
    // [직접 수정] showLightObjects=false이면 오브젝트 색 표시만 숨긴다.
    // 실제 전구 메시와 같은 형상을 겹쳐 표시한다. 빛의 범위나 충돌벽은 만들지 않는다.
    let objectHighlight;
    if (config.showLightObjects) {
      const highlight = new THREE.Mesh(
        mesh.geometry,
        new THREE.MeshBasicMaterial({
          color: isLamp ? 0xff8a00 : 0x00eeff,
          transparent: true,
          opacity: 0.9,
          toneMapped: false,
          depthWrite: false,
          polygonOffset: true,
          polygonOffsetFactor: -1,
          polygonOffsetUnits: -1,
        }),
      );
      highlight.name = "light-object-debug";
      highlight.raycast = () => {}; // 상호작용 및 레이캐스트 대상에서 제외한다.
      const outline = new THREE.LineSegments(
        new THREE.EdgesGeometry(mesh.geometry, 30),
        new THREE.LineBasicMaterial({ color: 0xffffff, toneMapped: false }),
      );
      outline.raycast = () => {};
      highlight.add(outline);
      highlight.visible = false;
      mesh.add(highlight);
      objectHighlight = highlight;
    }
    mesh.geometry.computeBoundingBox();
    const box = mesh.geometry.boundingBox;
    let center = box.getCenter(new THREE.Vector3());
    mesh.updateWorldMatrix(true, false);
    mesh.localToWorld(center);
    if (isLamp) {
      // 029/031, 032/033은 같은 위치의 중복 전구다. 빛이 두 배가 되지 않도록 묶는다.
      const existing = lamps.find(anchor => anchor.distanceToSquared(center) < 0.0001);
      if (existing) center = existing;
      else lamps.push(center);
      // [직접 수정] 벽 근처 가로등만 실제 광원을 안쪽으로 이동한다.
      // 전구 발광·후광 중심은 원본 위치를 유지하고, 전체 밝기/줄전구는 바꾸지 않는다.
      lampPositions.set(center, center.clone().add(new THREE.Vector3(...(lampWallOffsets[mesh.name] ?? [0, 0, 0]))));
    }
    else {
      // 한 메시 안의 전구 여러 개는 줄의 중앙 부근 대표 조명으로 묶는다.
      center.y = box.min.y + (box.max.y - box.min.y) * 0.3;
      const centers = (allLightsOn || halosEnabled) ? bulbCenters(mesh) : [];
      stringBulbs.push(...centers);
      if (allLightsOn) {
        // 연결된 면을 전구별로 분리해 각 전구 중심에 광원을 둔다.
        strings.push(...centers);
      } else strings.push(center);
    }
    if (objectHighlight) {
      const list = highlights.get(center) ?? [];
      list.push(objectHighlight);
      highlights.set(center, list);
    }
    // 전구 자체의 과도한 발광을 낮춘다. 공유 재질의 기본 색은 수정하지 않는다.
    const indexes = new Set(mesh.geometry.groups.map(g => g.materialIndex));
    for (const index of indexes) {
      let material = mesh.material[index];
      if (material?.emissive) {
        // [직접 수정] lighting.json의 bulbColor로 가로등·줄전구·후광의 색을 조절한다. #FFCA8A는 크리스마스 밤의 따뜻한 살구빛 주황색이다.
        // 전구 재질만 복제해 다른 오브젝트의 공유 재질은 유지한다.
        mesh.material = [...mesh.material];
        material = material.clone();
        mesh.material[index] = material;
        material.emissive.set(config.bulbColor);
        // [직접 수정] 발광 강도를 낮춰 크림색이 흰색으로 날아가는 현상을 완화한다.
        material.emissiveIntensity = isLamp
          ? config.lampEmissiveIntensity
          : config.stringEmissiveIntensity;
      }
    }
  }
  if (halosEnabled) addBulbHalos(scene, lamps, stringBulbs, config);
  if (allLightsOn) {
    // [직접 수정] 전체 점등. 그림자는 끄고 거리 제한을 두어 렌더링 비용을 줄인다.
    for (const [anchors, intensity, distance] of [
      [lamps, config.lampIntensity, config.lampDistance],
      [strings, config.stringBulbIntensity, config.stringBulbDistance],
    ]) {
      for (const anchor of anchors) {
        const light = new THREE.PointLight(config.bulbColor, intensity, distance, 2);
        light.position.copy(lampPositions.get(anchor) ?? anchor);
        light.castShadow = false;
        scene.add(light);
      }
    }
    return () => {};
  }
  const pools = [makePool(lamps, config.activeLamps, config.lampIntensity, config.lampDistance),
    makePool(strings, config.activeStrings, config.stringIntensity, config.stringDistance)];
  function makePool(anchors, count, intensity, distance) {
    return { anchors, intensity, slots: Array.from({length: Math.min(count, anchors.length)}, () => {
      const light = new THREE.PointLight(config.bulbColor, 0, distance, 2);
      light.castShadow = false; // 다중 그림자 렌더링 비용을 피한다.
      scene.add(light);
      return {light, anchor:null};
    }) };
  }
  return (player, dt) => {
    const alpha = 1 - Math.exp(-config.transitionSpeed * dt);
    // [설명] 후보 전체가 아닌 실제 활성 광원에 연결된 오브젝트만 강조한다.
    for (const list of highlights.values()) {
      for (const highlight of list) highlight.visible = false;
    }
    for (const pool of pools) {
      const desired = [...pool.anchors].sort((a,b) =>
        (a.x-player.x)**2+(a.z-player.z)**2 - ((b.x-player.x)**2+(b.z-player.z)**2)).slice(0,pool.slots.length);
      const occupied = new Set(pool.slots.map(s=>s.anchor));
      for (const slot of pool.slots) {
        if (slot.anchor && !desired.includes(slot.anchor)) {
          slot.light.intensity *= 1-alpha;
          if (slot.light.intensity > 0.05) continue;
          occupied.delete(slot.anchor);slot.anchor=null;
        }
        if (!slot.anchor) {
          slot.anchor=desired.find(a=>!occupied.has(a));
          if (!slot.anchor) continue;
          occupied.add(slot.anchor);slot.light.position.copy(lampPositions.get(slot.anchor) ?? slot.anchor);
        }
        slot.light.intensity += (pool.intensity-slot.light.intensity)*alpha;
      }
      for (const slot of pool.slots) {
        if (slot.anchor && slot.light.intensity > 0.05) {
          for (const highlight of highlights.get(slot.anchor) ?? []) highlight.visible = true;
        }
      }
    }
  };
}

// 동일 위치의 UV 경계 정점을 합친 뒤 연결된 삼각형마다 전구 중심을 구한다.
function bulbCenters(mesh) {
  const geometry = mesh.geometry;
  const positions = geometry.getAttribute("position");
  const parent = Array.from({ length: positions.count }, (_, i) => i);
  const find = i => { while (parent[i] !== i) { parent[i] = parent[parent[i]]; i = parent[i]; } return i; };
  const join = (a, b) => { parent[find(b)] = find(a); };
  const welded = new Map();
  for (let i = 0; i < positions.count; i++) {
    const key = [positions.getX(i), positions.getY(i), positions.getZ(i)].map(v => v.toFixed(5)).join(",");
    if (welded.has(key)) join(i, welded.get(key)); else welded.set(key, i);
  }
  const index = geometry.index;
  const count = index ? index.count : positions.count;
  for (let i = 0; i < count; i += 3) {
    const a = index ? index.getX(i) : i;
    join(a, index ? index.getX(i + 1) : i + 1);
    join(a, index ? index.getX(i + 2) : i + 2);
  }
  const boxes = new Map(), point = new THREE.Vector3();
  for (let i = 0; i < positions.count; i++) {
    const id = find(i);
    if (!boxes.has(id)) boxes.set(id, new THREE.Box3());
    boxes.get(id).expandByPoint(point.fromBufferAttribute(positions, i));
  }
  return [...boxes.values()].map(box => mesh.localToWorld(box.getCenter(new THREE.Vector3())));
}
