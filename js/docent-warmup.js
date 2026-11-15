import * as THREE from "../vendor/three.module.js";
import { measureStage, recordStage, yieldFrame } from "./docent-performance.js";

// [구조 설명] 도슨트 전체를 한 프레임에 처음 그리지 않고, 보이지 않는 작은
// 렌더 타깃에서 메시별로 준비한다. 원본 형상·재질·모션은 변경하지 않는다.
export async function warmupDocent(group, scene, camera, renderer, id) {
  const staging = new THREE.Scene();
  scene.children.filter(o => o.isLight).forEach(light => staging.add(light.clone()));
  staging.environment = scene.environment;
  staging.add(group);
  const meshes = [];
  group.traverse(o => { if (o.isMesh) meshes.push({ object: o, visible: o.visible, culled: o.frustumCulled }); });
  const textures = new Set();
  meshes.forEach(({object}) => (Array.isArray(object.material) ? object.material : [object.material]).forEach(m => {
    Object.values(m).forEach(value => { if (value?.isTexture) textures.add(value); });
  }));
  const target = new THREE.WebGLRenderTarget(4, 4);
  target.texture.colorSpace = renderer.outputColorSpace;
  try {
    for (const texture of textures) {
      const deadline = performance.now() + 15000;
      while (!texture.image) {
        if (performance.now() > deadline) throw new Error("도슨트 텍스처 준비 시간 초과");
        await yieldFrame();
      }
      const image = texture.image;
      if (image?.decode) await measureStage(id, "texture-decode", () => image.decode());
      await yieldFrame();
      await measureStage(id, "texture-upload-submit", () => renderer.initTexture(texture));
    }
    await yieldFrame();
    await measureStage(id, "shader-compile", () => renderer.compileAsync(staging, camera));
    meshes.forEach(({object}) => { object.visible = false; object.frustumCulled = false; });
    for (const {object, visible} of meshes) {
      if (!visible) continue;
      await yieldFrame();
      object.visible = true;
      // 렌더 타깃을 즉시 복원해 정상 맵 렌더링에 영향을 주지 않는다.
      const previous = renderer.getRenderTarget();
      try {
        renderer.setRenderTarget(target);
        const start = performance.now();
        try { renderer.render(staging, camera); }
        finally { recordStage(id, "mesh-upload-first-draw-submit", start, {
          mesh: object.name, part: object.userData.sourcePart ?? null,
          vertices: object.geometry.attributes.position.count,
          triangles: object.geometry.index.count / 3,
        }); }
      } finally { renderer.setRenderTarget(previous); object.visible = false; }
    }
  } finally {
    meshes.forEach(({object, visible, culled}) => { object.visible = visible; object.frustumCulled = culled; });
    staging.remove(group);
    target.dispose();
  }
}
