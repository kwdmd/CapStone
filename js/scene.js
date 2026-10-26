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
  const tryMove = createWalker(player, meshes, settings);
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
  let previous = performance.now();
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
  }
  status.hidden = true;
  requestAnimationFrame(animate);
}
