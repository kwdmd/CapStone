import * as THREE from "../vendor/three.module.js";

const yieldFrame = () =>
  new Promise((resolve) => requestAnimationFrame(() => setTimeout(resolve, 0)));
// [설명] 실제 조명은 건드리지 않고 별도 장면에서 0~반경 내 최대 광원 개수의 셰이더를 준비합니다.
// 첫 재질 준비는 16개씩, 이후에는 중복을 제거한 대표 재질만 준비합니다.
export async function prepareLightShaders(
  renderer,
  scene,
  camera,
  onProgress = () => {},
) {
  const start = performance.now();
  scene.userData.lightWarmupStartedAt = start;
  scene.userData.lightWarmupSlowestBatchMs = 0;
  scene.userData.lightWarmupSlowBatches = [];
  const stage = new THREE.Scene();
  stage.environment = scene.environment;
  stage.fog = scene.fog;
  const points = [];
  scene.children
    .filter((o) => o.isLight)
    .forEach((o) => {
      const copy = o.clone();
      copy.visible = true;
      stage.add(copy);
      if (copy.isPointLight) points.push(copy);
    });
  const proxies = [],
    materials = [],
    seen = new Set(),
    compiledSources = new Set();
  scene.traverse((object) => {
    if (
      !(object.isMesh || object.isPoints || object.isLine || object.isSprite) ||
      !object.material
    )
      return;
    const sourceMaterials = Array.isArray(object.material)
      ? [
          ...new Set(
            object.geometry.groups.map((g) => object.material[g.materialIndex]),
          ),
        ]
      : [object.material];
    const signature = JSON.stringify([
      object.type,
      object.isSkinnedMesh,
      object.isInstancedMesh,
      Object.entries(object.geometry.attributes).map(([k, v]) => [
        k,
        v.itemSize,
      ]),
      Object.entries(object.geometry.morphAttributes).map(([k, v]) => [
        k,
        v.length,
      ]),
    ]);
    for (const source of sourceMaterials) {
      if (!source) continue;
      const key = source.uuid + signature;
      if (seen.has(key)) continue;
      seen.add(key);
      // 이미 화면/도슨트 준비에서 컴파일된 동일 프로그램은 재질마다 다시 준비하지 않는다.
      // 캐시가 없는 재질은 기존 방식으로 컴파일하므로 보이지 않던 물체도 누락하지 않는다.
      const sourcePrograms = renderer.properties?.get(source)?.programs;
      if (sourcePrograms instanceof Map && sourcePrograms.size) {
        const compiledKey =
          signature + JSON.stringify([...sourcePrograms.keys()].sort());
        if (compiledSources.has(compiledKey)) continue;
        compiledSources.add(compiledKey);
      }
      const material = source.clone();
      material.onBeforeCompile = source.onBeforeCompile;
      material.customProgramCacheKey = source.customProgramCacheKey;
      materials.push(material);
      const proxy = object.clone(false);
      proxy.geometry = object.geometry;
      proxy.material = material;
      proxy.visible = true;
      proxy.userData = {};
      proxy.frustumCulled = false;
      proxy.onBeforeRender = () => {};
      proxy.onAfterRender = () => {};
      proxies.push(proxy);
    }
  });
  const maximumCount = Math.min(
    points.length,
    scene.userData.lightWarmupMaxCount ?? points.length,
  );
  let representatives = proxies;
  try {
    for (let count = 0; count <= maximumCount; count++) {
      points.forEach((light, i) => {
        light.visible = i < count;
      });
      const compileBatchSize = count === 0 ? 16 : representatives.length || 1;
      for (
        let index = 0;
        index < representatives.length;
        index += compileBatchSize
      ) {
        await yieldFrame();
        const batch = representatives.slice(index, index + compileBatchSize);
        stage.add(...batch);
        // 화면 출력용 컴파일만 준비합니다. 오프스크린용 중복 변형은 만들지 않습니다.
        try {
          await renderer.compileAsync(stage, camera);
        } finally {
          stage.remove(...batch);
        }
      }
      if (count === 0) {
        // 이 프로젝트의 고정된 Three.js r169 캐시 키로 동일 셰이더를 묶습니다.
        // 재질 색/텍스처 UUID만 다른 경우에도 shader key가 같으면 대표 하나만 컴파일합니다.
        // 내부 캐시 형식이 바뀌면 축약하지 않고 전체 준비로 안전하게 돌아갑니다.
        representatives = uniqueShaderRepresentatives(proxies, renderer);
      }
      // 원본 geometry와 프로그램 조합의 VAO도 준비합니다. 별도 geometry만 그리면
      // 실제 이동 시 원본 버퍼를 처음 연결하는 비용이 남습니다.
      // 최초 버퍼는 16개씩, 이후 광원 조합은 대표 메시 하나씩 나눠 준비한다.
      const renderables = [];
      scene.traverse((o) => {
        if (o.isMesh || o.isPoints || o.isLine || o.isSprite)
          renderables.push(o);
      });
      // 버퍼 최초 준비 이후에는 동일 프로그램의 대표 메시만 GPU 첫 사용을 준비한다.
      const warmObjects = count === 0 ? renderables : representatives;
      const batchSize = count === 0 ? 16 : 1;
      for (let offset = 0; offset < warmObjects.length; offset += batchSize) {
        await yieldFrame();
        const batch = new Set(warmObjects.slice(offset, offset + batchSize));
        const actualLights = scene.children.filter((o) => o.isLight);
        const actualPoints = actualLights.filter((o) => o.isPointLight);
        const visibility = actualPoints.map((o) => o.visible);
        const masks = new Map(),
          ranges = new Map(),
          culled = new Map();
        const cameraMask = camera.layers.mask;
        const previous = renderer.getRenderTarget();
        const oldScissor = renderer.getScissor(new THREE.Vector4());
        const oldScissorTest = renderer.getScissorTest();
        try {
          // 검수용 레이어는 동기 준비 렌더에만 사용하고 정상 프레임 전에 복구한다.
          if (count > 0) scene.add(...batch);
          camera.layers.set(31);
          for (const o of [
            ...actualLights,
            ...renderables,
            ...(count > 0 ? batch : []),
          ]) {
            masks.set(o, o.layers.mask);
            o.layers.disable(31);
            if (o.isLight || batch.has(o)) o.layers.enable(31);
          }
          for (const o of batch) {
            culled.set(o, o.frustumCulled);
            o.frustumCulled = false;
            if (o.geometry && !ranges.has(o.geometry)) {
              ranges.set(o.geometry, { ...o.geometry.drawRange });
              o.geometry.setDrawRange(0, 3);
            }
          }
          actualPoints.forEach((o, i) => {
            o.visible = i < count;
          });
          renderer.setRenderTarget(null);
          renderer.setScissor(0, 0, 1, 1);
          renderer.setScissorTest(true);
          const batchStart = performance.now();
          renderer.render(scene, camera);
          const elapsed = performance.now() - batchStart;
          if (elapsed > 20)
            scene.userData.lightWarmupSlowBatches.push({
              count,
              ms: +elapsed.toFixed(1),
              names: [...batch].map((o) => o.name),
            });
          scene.userData.lightWarmupSlowestBatchMs = Math.max(
            scene.userData.lightWarmupSlowestBatchMs,
            performance.now() - batchStart,
          );
        } finally {
          if (count > 0) scene.remove(...batch);
          renderer.setRenderTarget(previous);
          renderer.setScissor(oldScissor);
          renderer.setScissorTest(oldScissorTest);
          camera.layers.mask = cameraMask;
          masks.forEach((mask, o) => {
            o.layers.mask = mask;
          });
          culled.forEach((value, o) => {
            o.frustumCulled = value;
          });
          ranges.forEach((range, g) =>
            g.setDrawRange(range.start, range.count),
          );
          actualPoints.forEach((o, i) => {
            o.visible = visibility[i];
          });
        }
      }
      onProgress(count, maximumCount);
    }
    return {
      milliseconds: performance.now() - start,
      counts: maximumCount + 1,
      materials: proxies.length,
      representativeMaterials: representatives.length,
    };
  } finally {
    // 준비된 프로그램의 참조를 유지합니다. 공유 geometry/texture는 dispose하지 않습니다.
    scene.userData.lightShaderWarmupMaterials = materials;
  }
}

// 양면 투명 재질의 앞/뒤 프로그램을 모두 포함해 키를 비교합니다.
export function uniqueShaderRepresentatives(proxies, renderer) {
  const seen = new Set();
  return proxies.filter((proxy) => {
    const programs = renderer.properties?.get(proxy.material)?.programs;
    if (!(programs instanceof Map) || programs.size === 0) return true;
    const key = JSON.stringify([...programs.keys()].sort());
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
