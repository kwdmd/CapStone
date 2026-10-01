import { createGeometry } from "./geometry.js";
import { createAvatar } from "./avatar.js";
import { createMinimap } from "./minimap.js";
import { bindSceneInput } from "./scene-input.js";
import { createCameraRig } from "./camera-rig.js";
import objectData from "../data/object.json";
import placements from "../data/objects.json";
import * as THREE from "../vendor/three.module.js";
import mapData from "../data/map.json";
import settings from "../data/scene.json";
import { createMovementInput } from "./movement-input.js";

// [구조 설명] FBX의 정적 형상은 data/map.json으로 변환해 보관한다.
// 원본 재질이 없어 중립색을 사용하며, Three.js는 중앙 scene 요소 안에서만 그린다.
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
  for (const data of mapData) {
    const geometry = createGeometry(data);
    // [직접 수정] 바닥/구조물의 임시 색상. 원본 FBX에는 재질이 없다.
    const color =
      data.name === "Cylinder.001"
        ? 0xdce2e5
        : data.name.startsWith("Cube")
          ? 0x8faaaa
          : 0xb7c7c4;
    const mesh = new THREE.Mesh(
      geometry,
      new THREE.MeshStandardMaterial({
        color,
        roughness: 0.85,
        side: THREE.DoubleSide,
        flatShading: true,
      }),
    );
    mesh.name = data.name;
    meshes.push(mesh);
    scene.add(mesh);
  }
  scene.updateMatrixWorld(true);
  const avatar = createAvatar();
  scene.add(avatar);
  // [직접 수정] spawn은 시작 x/z, spawnYaw는 초기 시선 각도(라디안). 현재 오른쪽에서 중앙을 바라본다.
  const player = {
    x: settings.spawn[0],
    y: 0,
    z: settings.spawn[1],
    yaw: settings.spawnYaw ?? 0,
    pitch: 0,
  };
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
    avatar.rotation.y = Math.atan2(dx, dz);
  }
  document.addEventListener("popup:view-change", (event) => {
    third = event.detail !== "first-person";
    reset();
    host.focus();
  });
  // [구조 설명] wheel/pinch로 카메라 거리를 바꾸는 로직은 없다. 줌 기능을 제공하지 않는다.
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
  let previous = performance.now(),
    frame = 0;
  function animate(now) {
    requestAnimationFrame(animate);
    const dt = Math.min((now - previous) / 1000, 0.05);
    previous = now;
    let x = +input.has("right") - input.has("left"),
      z = +input.has("down") - input.has("up");
    const length = Math.hypot(x, z);
    if (length) {
      const speed =
        ((input.has("sprint") ? settings.runSpeed : settings.walkSpeed) * dt) /
        length;
      x *= speed;
      z *= speed;
      tryMove(x * Math.cos(player.yaw) + z * Math.sin(player.yaw), 0);
      tryMove(0, -x * Math.sin(player.yaw) + z * Math.cos(player.yaw));
    }
    avatar.position.set(player.x, player.y, player.z);
    avatar.visible = third;
    updateCamera(player, avatar, third, dt);
    renderer.render(scene, camera);
    if (++frame % 6 === 0) updateMinimap(player);
  }
  status.hidden = true;
  requestAnimationFrame(animate);
}
