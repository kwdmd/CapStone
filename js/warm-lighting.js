import { maximumLightsInRadius } from "./light-range-budget.js";
import lampWallOffsets from "../data/lamp-wall-offsets.json" with { type: "json" };
import { addBulbHalos } from "./bulb-halos.js";
import * as THREE from "../vendor/three.module.js";
import config from "../data/lighting.json" with { type: "json" };

// [직접 수정] 밝기·조명 범위·동시 개수는 data/lighting.json에서 조절한다.
// 원본 재질 색과 충돌 메시는 유지하며, 플레이어 주변 조명만 실시간으로 켠다.
export function createWarmLighting(scene, meshes) {
  const allLightsOn = typeof location !== "undefined" && new URLSearchParams(location.search).get("lighting") === "all" || config.allLightsOn;
  const halosEnabled = config.halosEnabled && !(typeof location !== "undefined" && new URLSearchParams(location.search).get("halos") === "off");
  const lamps = [], strings = [], stringBulbs = [], candles = [];
  const highlights = new Map();
  const lampPositions = new Map();
  for (const mesh of meshes) {
    const isLamp = /^Cylinder\.(029|031|032|033|034|035|036|037|038|039|040|048)_1$/.test(mesh.name);
    const isString = /^Sphere\.(015|016|017|019|020|021)_1$/.test(mesh.name);
    // [설명] 초 몸통·심지를 제외한 별도 불꽃 메시만 광원으로 사용한다.
    const isCandle = /^Sphere(?:\.(001|002|005|006|007|008|009|010|011|012|013|014|018|022|023|024))?_0$/.test(mesh.name);
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
    if (!isLamp && !isString && !isCandle) continue;
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
    else if (isCandle) {
      // 불꽃 중심에 작은 광원을 배치한다. 밝기와 후광 크기는 lighting.json에서 수정한다.
      candles.push(center);
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
    if (isCandle) continue; // 원본 불꽃 발광 재질은 유지한다.
    // 전구 자체의 과도한 발광을 낮춘다. 공유 재질의 기본 색은 수정하지 않는다.
    const indexes = new Set(mesh.geometry.groups.map(g => g.materialIndex));
    for (const index of indexes) {
      let material = mesh.material[index];
      if (material?.emissive) {
        // [직접 수정] lighting.json의 bulbColor로 가로등·줄전구·후광의 색을 조절한다. #FFB66E는 크리스마스 밤의 따뜻한 주황색이다.
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
  // [설명] 후광은 불꽃별로 유지하고 실제 광원만 가까운 촛불 묶음의 중심으로 합친다.
  const candleLights = groupCandleLights(candles, config.candleGroupRadius);
  if (halosEnabled) addBulbHalos(scene, lamps, stringBulbs, config, candles);
  if (allLightsOn) {
    // [직접 수정] 전체 점등. 그림자는 끄고 거리 제한을 두어 렌더링 비용을 줄인다.
    for (const [anchors, intensity, distance] of [
      [lamps, config.lampIntensity, config.lampDistance],
      [strings, config.stringBulbIntensity, config.stringBulbDistance],
      [candleLights, config.candleIntensity, config.candleDistance],
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
  // [직접 수정] 수평 반경 15, 거리 12부터 15까지 거리별 감쇠. 높이가 다른 전구도 포함합니다.
  const radius = config.playerLightRadius;
  const fadeStart = config.playerLightFadeStart;
  const candidates = [
    ...candleLights.map(anchor => ({ anchor, intensity: config.candleIntensity, distance: config.candleDistance })),
    ...lamps.map(anchor => ({ anchor, intensity: config.lampIntensity, distance: config.lampDistance })),
    ...strings.map(anchor => ({ anchor, intensity: config.stringIntensity, distance: config.stringDistance })),
  ];
  // maxPlayerLights=null이면 개수 제한 없이 모든 후보에 슬롯을 할당합니다.
  // 객체는 재사용하되 범위 밖 슬롯은 visible=false로 렌더러의 광원 목록에서 제외합니다.
  // 광원 개수가 달라질 때는 Three.js가 해당 개수의 셰이더 변형을 선택합니다.
  const slots = Array.from({ length: config.maxPlayerLights == null ? candidates.length : Math.min(candidates.length, config.maxPlayerLights) }, () => {
    const light = new THREE.PointLight(config.bulbColor, 0, 1, 2);
    light.castShadow = false;
    light.visible = false; // 밝기 0만으로는 GPU 광원 계산에서 제외되지 않습니다.
    scene.add(light);
    return { light, source: null };
  });
  // 점등 개수를 제한하지 않고, 준비할 조합만 실제 고정 배치로 계산합니다.
  scene.userData.lightWarmupMaxCount = Math.min(slots.length,
    maximumLightsInRadius(candidates.map(source => source.anchor), radius));
  const range = new THREE.Group();
  range.name = "player-light-range";
  range.visible = config.showPlayerLightRange;
  // 바깥 민트색 원 = 점등 한계, 안쪽 원 = 밝기 감소가 시작되는 경계. 충돌 판정은 없습니다.
  for (const [r, opacity] of [[radius, 0.8], [fadeStart, 0.35]]) {
    const ring = new THREE.Mesh(new THREE.RingGeometry(r - 0.035, r + 0.035, 128),
      new THREE.MeshBasicMaterial({ color: 0x63ffcf, transparent: true, opacity,
        side: THREE.DoubleSide, depthWrite: false, depthTest: false, toneMapped: false }));
    ring.rotation.x = -Math.PI / 2;
    ring.renderOrder = 1000;
    ring.raycast = () => {};
    range.add(ring);
  }
  scene.add(range);
  return (player, dt) => {
    range.position.set(player.x, player.y + 0.04, player.z);
    const distance = source => Math.hypot(source.anchor.x-player.x, source.anchor.z-player.z);
    // 준비 중에도 이동 가능. 준비된 슬롯 수를 넘겨 새 셰이더가 동기 컴파일되지 않게 한다.
    const readySlots = slots.slice(0, scene.userData.lightPreparedCount ?? slots.length);
    for (const slot of slots.slice(readySlots.length)) { slot.light.visible = false; slot.light.intensity = 0; slot.source = null; }
    const desired = candidates.filter(source => distance(source) < radius)
      .sort((a,b) => distance(a)-distance(b)).slice(0, readySlots.length);
    const alpha = 1 - Math.exp(-config.transitionSpeed * Math.max(0, dt));
    const occupied = new Set(slots.map(slot => slot.source));
    for (const list of highlights.values()) for (const highlight of list) highlight.visible = false;
    for (const slot of readySlots) {
      if (slot.source && !desired.includes(slot.source)) {
        // 범위 밖에서는 즉시 0 (경계 직전 smoothstep으로 이미 0에 수렴).
        // 순위 교체는 기존 광원이 어두워진 뒤 재사용하므로 슬롯을 재사용합니다.
        slot.light.intensity *= 1-alpha;
        if (distance(slot.source) >= radius) slot.light.intensity = 0;
        if (slot.light.intensity > 0.01) continue;
        slot.light.intensity = 0;
        slot.light.visible = false;
        occupied.delete(slot.source);
        slot.source = null;
      }
      if (!slot.source) {
        slot.source = desired.find(source => !occupied.has(source)) ?? null;
        if (!slot.source) { slot.light.visible = false; continue; }
        occupied.add(slot.source);
        slot.light.position.copy(lampPositions.get(slot.source.anchor) ?? slot.source.anchor);
        slot.light.distance = slot.source.distance;
      }
      const t = THREE.MathUtils.clamp((distance(slot.source)-fadeStart)/(radius-fadeStart), 0, 1);
      const target = slot.source.intensity * (1-t*t*(3-2*t));
      slot.light.intensity += (target-slot.light.intensity)*alpha;
      // 경계로 이동할 때 시간 보간 잔광이 거리 감쇠보다 밝아지지 않도록 제한합니다.
      slot.light.intensity = Math.min(slot.light.intensity, target);
      slot.light.visible = slot.light.intensity > 0;
      if (slot.light.intensity > 0.05) {
        for (const highlight of highlights.get(slot.source.anchor) ?? []) highlight.visible = true;
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


// [직접 수정] candleGroupRadius: 같은 묶음으로 볼 수평 거리. 높이 차가 큰 촛불은 분리한다.
export function groupCandleLights(anchors, radius = 1.3) {
  const remaining = new Set(anchors);
  const centers = [];
  while (remaining.size) {
    const first = remaining.values().next().value;
    remaining.delete(first);
    const group = [first];
    for (let i = 0; i < group.length; i++) {
      for (const other of remaining) {
        if (Math.hypot(group[i].x - other.x, group[i].z - other.z) <= radius &&
            Math.abs(group[i].y - other.y) <= 1) {
          remaining.delete(other);
          group.push(other);
        }
      }
    }
    const center = new THREE.Vector3();
    for (const anchor of group) center.add(anchor);
    centers.push(center.divideScalar(group.length));
  }
  return centers;
}
