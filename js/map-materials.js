import * as THREE from '../vendor/three.module.js';
import source from '../data/map-materials.json';
// [구조 설명] 텍스처는 data URI로 포함해 로컬 HTML에서도 외부 경로 없이 표시한다.
// 색상은 Blender의 선형 RGB 값이다. PNG 색상 텍스처에만 sRGB를 지정한다.
export function createMapMaterials() {
 const loader = new THREE.TextureLoader(), cache = new Map();
 const texture = (name, color) => {
  const key = `${name}:${color}`;
  if (!cache.has(key)) {
   const tex = loader.load(source.images[name]);
   tex.colorSpace = color ? THREE.SRGBColorSpace : THREE.NoColorSpace;
   tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
   cache.set(key, tex);
  }
  return cache.get(key);
 };
 return source.materials.map(data => {
  const mat = new THREE.MeshStandardMaterial({
   name:data.name, color:new THREE.Color(...data.color), metalness:data.metalness,
   roughness:data.roughness, opacity:data.opacity, transparent:data.opacity < 1,
   depthWrite:data.opacity >= 1, side:THREE.DoubleSide,
   emissive:new THREE.Color(...data.emissive), emissiveIntensity:data.emissiveIntensity
  });
  for (const key of ['map','normalMap','emissiveMap']) if(data[key]) mat[key] = texture(data[key],key !== 'normalMap');
  return mat;
 });
}
