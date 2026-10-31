import { addDisplayGoods } from "./display-goods.js";
import { bindNpcDialogue } from "./npc-dialogue.js";
import { addNpcs } from "./npcs.js";
import fenceWalls from "../data/fence-walls.json";
import { createWalker } from "./walker.js";
import { wheelPixels } from "./camera-zoom.js";
import { createGeometry } from "./geometry.js";
import { createAvatar } from "./avatar.js";
import { bindSceneInput } from "./scene-input.js";
import { createCameraRig } from "./camera-rig.js";
import * as THREE from "../vendor/three.module.js";
import mapData from "./map-data.js";
import { createMapMaterials } from "./map-materials.js";
import settings from "../data/scene.json";
import motionSettings from "../data/motion-settings.json";
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
  let texturesReady = true;
  THREE.DefaultLoadingManager.onStart = () => { texturesReady = false; };
  THREE.DefaultLoadingManager.onLoad = () => { texturesReady = true; };
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
  // [직접 수정] 모든 캐릭터의 공통 크기는 scene.json의 characterScale에서 조절한다.
  avatar.scale.setScalar(settings.characterScale ?? 1);
  scene.add(avatar);
  // [직접 수정] data/scene.json의 spawn=[X,Z]는 시작 위치. 높이 Y는 바닥에서 자동 계산.
  // 시작 위치와 방향은 scene.json의 spawn, spawnYaw에서 설정한다.
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
  // [구조 설명] 임시 전시 아바타는 사용자 캐릭터와 별도로 배치한다.
  const goods = addDisplayGoods(scene);
  const updateNpcs = addNpcs(scene);
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
  const dialogue = bindNpcDialogue({ host, avatars: updateNpcs.avatars, goods, player, reset });
  const tryMove = createWalker(player, meshes, settings, updateNpcs.cylinders, fenceWalls);
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
  // 전구를 매단 줄과 전구 조각은 카메라가 통과할 수 있는 장식이다.
  const hangingLights = /^(?:NurbsPath\.00[2-7]_0|Sphere\.(?:015|016|017|019|020|021)_[01])$/;
  const cameraObstacles = meshes.filter(mesh => !hangingLights.test(mesh.name));
  const updateCamera = createCameraRig(camera, cameraObstacles, settings);
  // [구조 설명] 맵 위의 휠만 처리하여 장바구니 스크롤과 충돌하지 않는다.
  renderer.domElement.addEventListener(
    "wheel",
    (event) => {
      if (!third || dialogue.isOpen() || event.ctrlKey) return; // 브라우저 자체 확대 단축키는 유지한다.
      event.preventDefault();
      updateCamera.zoom(
        wheelPixels(event.deltaY, event.deltaMode, host.clientHeight),
        third,
      );
    },
    { passive: false },
  );
  let previous = performance.now();
  let visualHeight = player.y;
  function animate(now) {
    requestAnimationFrame(animate);
    const dt = Math.min((now - previous) / 1000, 0.05);
    previous = now;
    let x = +input.has("right") - input.has("left"),
      z = +input.has("down") - input.has("up");
    const length = Math.hypot(x, z);
    const oldX = player.x,
      oldZ = player.z;
    const sprinting = input.has("sprint");
    if (length && !dialogue.isOpen()) {
      const speed =
        ((sprinting ? settings.runSpeed : settings.walkSpeed) * dt) /
        length;
      x *= speed;
      z *= speed;
      const dx = x * Math.cos(player.yaw) + z * Math.sin(player.yaw);
      const dz = -x * Math.sin(player.yaw) + z * Math.cos(player.yaw);
      // 원통에 한 축이 막혀도 입력한 이동 방향을 바라본다.
      if (dt > 0) avatar.rotation.y = Math.atan2(dx, dz) + avatarFacingOffset;
      tryMove(dx, 0);
      tryMove(0, dz);
    }
    const movedX = player.x - oldX,
      movedZ = player.z - oldZ;
    const actualSpeed = dt > 0 ? Math.hypot(movedX, movedZ) / dt : 0;
    avatar.userData.motionState = avatar.userData.updateMotion(dt, actualSpeed, sprinting);
    // 이동 판정은 실제 바닥 높이를 사용하고, 표시 높이만 완만하게 따라가게 한다.
    visualHeight +=
      (player.y - visualHeight) *
      (1 - Math.exp(-motionSettings.visualHeightResponse * dt));
    avatar.position.set(player.x, visualHeight, player.z);
    avatar.visible = third;
    updateCamera(player, avatar, third, dt);
    updateNpcs(dt);
    dialogue.update();
    renderer.render(scene, camera);
    if (texturesReady && !status.hidden) status.hidden = true;
  }
  requestAnimationFrame(animate);
}
