import * as THREE from "../vendor/three.module.js";
import source from "../data/map-materials.json";
// [구조 설명] 텍스처는 data URI로 포함해 로컬 HTML에서도 외부 경로 없이 표시한다.
// 색상은 Blender의 선형 RGB 값이다. PNG 색상 텍스처에만 sRGB를 지정한다.
export function createMapMaterials() {
  const loader = new THREE.TextureLoader(),
    cache = new Map();
  const texture = (name, color) => {
    const key = `${name}:${color}`;
    if (!cache.has(key)) {
      const tex = loader.load(source.images[name]);
      tex.flipY = source.flipY ?? true;
      tex.colorSpace = color ? THREE.SRGBColorSpace : THREE.NoColorSpace;
      tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
      cache.set(key, tex);
    }
    return cache.get(key);
  };
  return source.materials.map((data) => {
    const mat = new THREE.MeshStandardMaterial({
      name: data.name,
      color: new THREE.Color(...data.color),
      metalness: data.metalness,
      roughness: data.roughness,
      opacity: data.opacity,
      transparent: data.alphaMode
        ? data.alphaMode === "BLEND"
        : data.opacity < 1,
      alphaTest: data.alphaMode === "MASK" ? data.alphaCutoff : 0,
      depthWrite: data.alphaMode
        ? data.alphaMode !== "BLEND"
        : data.opacity >= 1,
      side: data.doubleSided === false ? THREE.FrontSide : THREE.DoubleSide,
      emissive: new THREE.Color(...data.emissive),
      emissiveIntensity: data.emissiveIntensity,
    });
    for (const key of [
      "map",
      "normalMap",
      "emissiveMap",
      "roughnessMap",
      "metalnessMap",
    ])
      if (data[key])
        mat[key] = texture(data[key], key === "map" || key === "emissiveMap");
    if (data.normalScale !== undefined)
      mat.normalScale.setScalar(data.normalScale);
    // GLB의 unlit 재질은 조명에 영향을 받지 않는 원본 표시 방식으로 연결한다.
    if (data.unlit) {
      const unlit = new THREE.MeshBasicMaterial({
        color: mat.color,
        map: mat.map,
        opacity: mat.opacity,
        transparent: mat.transparent,
        alphaTest: mat.alphaTest,
        depthWrite: mat.depthWrite,
        side: mat.side,
      });
      mat.dispose();
      return unlit;
    }
    return mat;
  });
}
