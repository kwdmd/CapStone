import * as THREE from "../vendor/three.module.js";
export function createAvatar() {
  // [직접 수정] 조종 캐릭터의 색·형상. 위치는 player 상태를 따라간다.
  const avatar = new THREE.Group();
  const part = (geometry, color, y) => {
    const mesh = new THREE.Mesh(
      geometry,
      new THREE.MeshStandardMaterial({ color }),
    );
    mesh.position.y = y;
    avatar.add(mesh);
  };
  part(new THREE.CylinderGeometry(0.25, 0.32, 1, 16), 0xb34e54, 0.6);
  part(new THREE.SphereGeometry(0.26, 16, 12), 0xf0d4b3, 1.4);
  part(new THREE.ConeGeometry(0.31, 0.45, 16), 0x17374e, 1.75);
  return avatar;
}
