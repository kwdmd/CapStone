import { wheelPixels } from "./camera-zoom.js";
import { createGeometry } from "./geometry.js";
import { createAvatar } from "./avatar.js";
import { createMinimap } from "./minimap.js";
import { bindSceneInput } from "./scene-input.js";
import { createCameraRig } from "./camera-rig.js";
import objectData from "../data/object.json";
import placements from "../data/objects.json";
import * as THREE from "../vendor/three.module.js";
import mapData from "./map-data.js";
import { createMapMaterials } from "./map-materials.js";
import settings from "../data/scene.json";
import { createMovementInput } from "./movement-input.js";

// [구조 설명] FBX의 정적 형상은 data/map.json으로 변환해 보관한다.
// 원본 재질·UV·노멀을 함께 사용한다.
export function startScene(initialView) {
  const host = document.getElementById("scene");
  const status = document.getElementById("sceneStatus");
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true });
  } catch {
    status.textContent =
      "3D 화면을 열 수 없습니다. WebGL을 지원하는 브라우저로 다시 열어 주세요.";
    return;
  }
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  host.appendChild(renderer.domElement);
  // [직접 수정] 맵 바깥 배경색. 오브젝트 재질과 조명은 별도로 설정한다.
  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#000000");
  const camera = new THREE.PerspectiveCamera(48, 1, 0.08, 250);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x77818d, 2.2));
  const sunlight = new THREE.DirectionalLight(0xfff1dc, 2.5);
  sunlight.position.set(-25, 55, 30);
  scene.add(sunlight);
  const meshes = [];
  const mapMaterials = createMapMaterials();
  for (const data of mapData) {
    const geometry = createGeometry(data);
    // 원본 FBX의 면별 재질을 연결한다.
    for (const [start, count, materialIndex] of data.groups || [])
      geometry.addGroup(start, count, materialIndex);
    const mesh = new THREE.Mesh(geometry, mapMaterials);
    mesh.name = data.name;
    meshes.push(mesh);
    scene.add(mesh);
  }
  scene.updateMatrixWorld(true);
  // [직접 수정] 현재 FBX의 정면이 -Z이므로 180도 보정. +Z 정면 모델로 교체하면 0으로 변경하세요.
  const avatarFacingOffset = Math.PI;
  const avatar = createAvatar();
  scene.add(avatar);
  // [직접 수정] data/scene.json의 spawn=[X,Z]는 시작 위치. 높이 Y는 바닥에서 자동 계산.
  // 흰 발판 중심 [29.35,-9.59], 중앙을 향하는 spawnYaw=1.886607(라디안).
  const player = {
    x: settings.spawn[0],
    y: 0,
    z: settings.spawn[1],
    yaw: settings.spawnYaw ?? 0,
    pitch: 0,
  };
  // 초기 자세도 카메라가 바라보는 전방(-Z 기준)에 맞춘다.
  avatar.rotation.y = player.yaw + Math.PI + avatarFacingOffset;
  const ray = new THREE.Raycaster();
  const ground = (x, z, ceiling = 40) => {
    ray.far = 100;
    ray.set(new THREE.Vector3(x, ceiling, z), new THREE.Vector3(0, -1, 0));
    return ray
      .intersectObjects(meshes, false)
      .find((hit) => Math.abs(hit.face.normal.y) > 0.55);
  };
  // [직접 수정] 5개 오브젝트 위치는 data/objects.json의 x/z/rotation(라디안).
  // 형상·재질을 공유하여 같은 모델을 반복 로딩하지 않는다. y는 맵 바닥에 자동 정렬한다.
  const template = new THREE.Group();
  for (const data of objectData) {
    const geometry = createGeometry(data);
    const material = new THREE.MeshStandardMaterial({
      color: new THREE.Color(...data.color),
      roughness: 0.8,
      side: THREE.DoubleSide,
    });
    template.add(new THREE.Mesh(geometry, material));
  }
  // 모든 바닥 높이를 복제물 추가 전에 계산한다.
  const surfaces = placements.map((p) => ground(p.x, p.z));
  placements.forEach((p, index) => {
    if (!surfaces[index])
      throw new Error(`오브젝트 ${index + 1} 위치에 바닥이 없습니다.`);
    const instance = template.clone();
    instance.name = `전시 오브젝트 ${index + 1}`;
    instance.position.set(p.x, surfaces[index].point.y, p.z);
    instance.rotation.y = p.rotation;
    scene.add(instance);
    instance.updateMatrixWorld(true);
    instance.traverse((child) => {
      if (child.isMesh) meshes.push(child);
    });
  });
  const spawnHit = ground(player.x, player.z);
  if (!spawnHit) {
    status.textContent =
      "시작 위치에 바닥이 없습니다. scene.json의 spawn을 확인해 주세요.";
    return;
  }
  player.y = spawnHit.point.y;
  let third = initialView !== "first-person";
  const input = createMovementInput();
  const reset = bindSceneInput(host, renderer.domElement, player, input);
  // [구조 설명] 벽과 높이 차이를 확인한 뒤에만 이동한다. 점프/물리 엔진은 포함하지 않는다.
  function tryMove(dx, dz) {
    const length = Math.hypot(dx, dz);
    if (!length) return;
    for (const height of [0.4, 1.15]) {
      ray.far = length + 0.28;
      ray.set(
        new THREE.Vector3(player.x, player.y + height, player.z),
        new THREE.Vector3(dx, 0, dz).normalize(),
      );
      if (
        ray
          .intersectObjects(meshes, false)
          .some((hit) => Math.abs(hit.face.normal.y) < 0.65)
      )
        return;
    }
    const hit = ground(
      player.x + dx,
      player.z + dz,
      player.y + settings.stepHeight,
    );
    if (!hit || player.y - hit.point.y > settings.maxDrop) return;
    player.x += dx;
    player.z += dz;
    player.y = hit.point.y;
  }
  document.addEventListener("popup:view-change", (event) => {
    third = event.detail !== "first-person";
    reset();
    host.focus();
  });
  // [구조 설명] 화면 크기 변화 시 렌더러와 카메라 비율을 갱신한다.
  const resize = () => {
    const w = host.clientWidth,
      h = host.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  new ResizeObserver(resize).observe(host);
  resize();
  const updateMinimap = createMinimap(
    document.getElementById("miniCanvas"),
    mapData,
  );
  const updateCamera = createCameraRig(camera, meshes, settings);
  // [구조 설명] 맵 위의 휠만 처리하여 장바구니 스크롤과 충돌하지 않는다.
  renderer.domElement.addEventListener(
    "wheel",
    (event) => {
      if (event.ctrlKey) return; // 브라우저 자체 확대 단축키는 유지한다.
      event.preventDefault();
      updateCamera.zoom(
        wheelPixels(event.deltaY, event.deltaMode, host.clientHeight),
        third,
      );
    },
    { passive: false },
  );
  let previous = performance.now(),
    frame = 0;
  function animate(now) {
    requestAnimationFrame(animate);
    const dt = Math.min((now - previous) / 1000, 0.05);
    previous = now;
    let x = +input.has("right") - input.has("left"),
      z = +input.has("down") - input.has("up");
    const length = Math.hypot(x, z);
    const oldX = player.x,
      oldZ = player.z;
    if (length) {
      const speed =
        ((input.has("sprint") ? settings.runSpeed : settings.walkSpeed) * dt) /
        length;
      x *= speed;
      z *= speed;
      tryMove(x * Math.cos(player.yaw) + z * Math.sin(player.yaw), 0);
      tryMove(0, -x * Math.sin(player.yaw) + z * Math.cos(player.yaw));
    }
    const movedX = player.x - oldX,
      movedZ = player.z - oldZ;
    const actualSpeed = dt > 0 ? Math.hypot(movedX, movedZ) / dt : 0;
    if (actualSpeed > 0.05)
      avatar.rotation.y = Math.atan2(movedX, movedZ) + avatarFacingOffset;
    avatar.userData.updateMotion(dt, actualSpeed, input.has("sprint"));
    avatar.position.set(player.x, player.y, player.z);
    avatar.visible = third;
    updateCamera(player, avatar, third, dt);
    renderer.render(scene, camera);
    if (++frame % 6 === 0) updateMinimap(player);
  }
  status.hidden = true;
  requestAnimationFrame(animate);
}
