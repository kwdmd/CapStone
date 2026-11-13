import * as THREE from "../vendor/three.module.js";

// 모든 후광을 한 번의 드로콜로 그린다. 실제 광원·충돌 메시를 추가하지 않는다.
export function addBulbHalos(scene, lamps, bulbs, config) {
  const positions = [], sizes = [];
  for (const [centers, size] of [[lamps, config.lampHaloSize], [bulbs, config.stringHaloSize]]) {
    for (const center of centers) {
      positions.push(center.x, center.y, center.z);
      sizes.push(size);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("haloSize", new THREE.Float32BufferAttribute(sizes, 1));
  const material = new THREE.ShaderMaterial({
    uniforms: { viewportHeight: { value: 1 }, opacity: { value: config.haloOpacity }, haloColor: { value: new THREE.Color(config.bulbColor) } },
    vertexShader: `
      attribute float haloSize;
      uniform float viewportHeight;
      void main() {
        vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * viewPosition;
        gl_PointSize = clamp(haloSize * viewportHeight * projectionMatrix[1][1]
          / (2.0 * max(0.01, -viewPosition.z)), 1.0, 64.0);
      }`,
    fragmentShader: `
      uniform float opacity;
      uniform vec3 haloColor;
      void main() {
        float radius = length(gl_PointCoord - vec2(0.5)) * 2.0;
        if (radius >= 1.0) discard;
        float fade = pow(1.0 - radius, 2.5);
        gl_FragColor = vec4(haloColor, fade * opacity);
      }`,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    depthTest: true,
    toneMapped: false,
  });
  const halos = new THREE.Points(geometry, material);
  halos.name = "bulb-halos";
  halos.raycast = () => {};
  const drawingSize = new THREE.Vector2();
  halos.onBeforeRender = renderer => {
    renderer.getDrawingBufferSize(drawingSize);
    material.uniforms.viewportHeight.value = drawingSize.y;
  };
  scene.add(halos);
  return halos;
}
