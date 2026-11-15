import * as THREE from "../vendor/three.module.js";

// 별도의 카메라가 전시 모델의 복제본 주위를 돈다.
export function createProductOrbit() {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  const canvas = renderer.domElement;
  canvas.setAttribute("aria-label", "상품 3D 보기. 드래그하거나 방향키로 회전");
  canvas.tabIndex = 0;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xffffff);
  scene.add(new THREE.HemisphereLight(0xffffff, 0xc8ced3, 2));
  const light = new THREE.DirectionalLight(0xffffff, 2);
  light.position.set(3, 7, 4);
  scene.add(light);
  const camera = new THREE.PerspectiveCamera(32, 1, 0.01, 100);
  const center = new THREE.Vector3();
  let model, yaw, pitch, distance, drag;
  function draw() {
    camera.position.setFromSphericalCoords(distance, Math.PI / 2 - pitch, yaw).add(center);
    camera.lookAt(center);
    renderer.render(scene, camera);
  }
  function rotate(dx, dy) {
    yaw -= dx * .012;
    pitch = THREE.MathUtils.clamp(pitch + dy * .012, -1.48, 1.48);
    draw();
  }
  canvas.onpointerdown = event => {
    if (drag || event.button !== 0) return;
    canvas.setPointerCapture(event.pointerId);
    drag = { id: event.pointerId, x: event.clientX, y: event.clientY };
  };
  canvas.onpointermove = event => {
    if (drag?.id !== event.pointerId) return;
    rotate(event.clientX - drag.x, event.clientY - drag.y);
    drag.x = event.clientX;
    drag.y = event.clientY;
  };
  canvas.onlostpointercapture = () => { drag = null; };
  canvas.onkeydown = event => {
    const delta = { ArrowLeft: [-10,0], ArrowRight: [10,0], ArrowUp: [0,10], ArrowDown: [0,-10] }[event.key];
    if (delta) { event.preventDefault(); rotate(...delta); }
  };
  return {
    show(holder, group) {
      if (model) scene.remove(model);
      model = group.clone();
      model.position.set(0, 0, 0);
      scene.add(model);
      const bounds = new THREE.Box3().setFromObject(model);
      bounds.getCenter(center);
      distance = bounds.getBoundingSphere(new THREE.Sphere()).radius / Math.sin(THREE.MathUtils.degToRad(16)) * 1.04;
      yaw = group.userData.productId === "bishop" ? .75 : Math.PI / 2;
      pitch = .14;
      drag = null;
      holder.replaceChildren(canvas);
      const size = Math.max(1, holder.clientWidth);
      renderer.setSize(size, size, false);
      draw();
    },
  };
}
