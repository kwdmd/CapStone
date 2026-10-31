import { capeShader, createCapeClearance } from "./cape-clearance.js";
import * as THREE from "../vendor/three.module.js";
import { gunzipSync } from "../vendor/fflate.module.js";
import review from "../data/player-garments.json" with { type: "json" };

// 검토본의 의상 좌표와 법선을 GPU에서 두 자세 사이로 보간한다.
// 맵의 이동 속도나 화면 주사율이 달라도 의상과 본은 같은 프레임을 읽는다.
const states = Object.keys(review.states);
const atlasWidth = 2048;
function unpack(encoded, Type) {
  const bytes = gunzipSync(Uint8Array.from(atob(encoded), c => c.charCodeAt(0)));
  return new Type(bytes.buffer, bytes.byteOffset, bytes.byteLength / Type.BYTES_PER_ELEMENT);
}

const declarations = `
attribute float reviewVertex;
attribute vec3 reviewNormalDetail;
uniform highp isampler2D reviewAtlas;
uniform int reviewVertexCount;
uniform vec3 reviewSamples[3];
uniform vec3 reviewWeights;
ivec4 reviewFetch(int frame) {
  int id = frame * reviewVertexCount + int(reviewVertex);
  return texelFetch(reviewAtlas, ivec2(id % 2048, id / 2048), 0);
}
vec3 reviewDecodeNormal(int packedValue) {
  int bits = packedValue & 65535;
  vec2 xy = vec2(bits & 255, bits >> 8) / 127.5 - 1.0;
  vec3 n = vec3(xy, 1.0 - abs(xy.x) - abs(xy.y));
  if (n.z < 0.0) n.xy = (1.0 - abs(n.yx)) * mix(vec2(-1), vec2(1), greaterThanEqual(n.xy, vec2(0)));
  return normalize(n);
}`;
const sampleGarments = `
float reviewAmount = dot(reviewWeights, vec3(1));
vec3 reviewOffset = vec3(0), reviewNormal = vec3(0);
for (int i = 0; i < 3; ++i) {
  float weight = reviewWeights[i];
  if (weight <= 0.0) continue;
  vec3 sampleAt = reviewSamples[i];
  ivec4 a = reviewFetch(int(sampleAt.x)), b = reviewFetch(int(sampleAt.y));
  reviewOffset += weight * mix(vec3(a.xyz), vec3(b.xyz), sampleAt.z) / 16000.0;
  reviewNormal += weight * (mix(reviewDecodeNormal(a.w), reviewDecodeNormal(b.w), sampleAt.z) + reviewNormalDetail);
}`;

export function createGarmentMotion() {
  const samples = Array.from({ length: 3 }, () => new THREE.Vector3());
  const weights = new THREE.Vector3();
  const from = new THREE.Vector3();
  const layers = [];
  const clearance = createCapeClearance();
  let previous = null;

  function attach(mesh) {
    const source = review.meshes[mesh.name];
    if (!source) return;
    const geometry = mesh.geometry;
    const isCape = mesh.name === "Circle" || mesh.name === "Torus.001";
    const ids = unpack(source.map, Uint16Array);
    const rest = unpack(source.restNormals, Int8Array);
    const detail = new Float32Array(ids.length * 3);
    const normals = geometry.attributes.normal.array;
    for (let i = 0; i < detail.length; ++i) {
      detail[i] = normals[i] - rest[ids[Math.floor(i / 3)] * 3 + i % 3] / 127;
    }
    geometry.setAttribute("reviewVertex", new THREE.Float32BufferAttribute(ids, 1));
    geometry.setAttribute("reviewNormalDetail", new THREE.BufferAttribute(detail, 3));

    const frames = unpack(source.frames, Int16Array);
    const stride = source.count * 4;
    for (let i = stride; i < frames.length; ++i) frames[i] += frames[i - stride];
    const height = Math.ceil(frames.length / (atlasWidth * 4));
    const pixels = new Int16Array(height * atlasWidth * 4);
    pixels.set(frames);
    const texture = new THREE.DataTexture(pixels, atlasWidth, height, THREE.RGBAIntegerFormat, THREE.ShortType);
    texture.internalFormat = "RGBA16I";
    texture.needsUpdate = true;

    // 같은 재질을 공유하는 얼굴과 다른 의상에는 이 셰이더를 적용하지 않는다.
    mesh.material = mesh.material.slice();
    for (const index of new Set(geometry.groups.map(g => g.materialIndex))) {
      const material = mesh.material[index].clone();
      mesh.material[index] = material;
      material.customProgramCacheKey = () => isCape ? "player-cape-contact-v2" : "reviewed-player-cloth-v1";
      material.onBeforeCompile = shader => {
        Object.assign(shader.uniforms, {
          reviewAtlas: { value: texture },
          reviewVertexCount: { value: source.count },
          reviewSamples: { value: samples },
          reviewWeights: { value: weights },
        });
        if (isCape) Object.assign(shader.uniforms, clearance.uniforms());
        const contact = isCape ? "capeContactOffset(transformed)" : "vec3(0.0)";
        shader.vertexShader = (isCape ? capeShader : "") + declarations + "\n" + shader.vertexShader
          .replace("#include <beginnormal_vertex>", "#include <beginnormal_vertex>\n" + sampleGarments)
          .replace("#include <skinnormal_vertex>", "#include <skinnormal_vertex>\nobjectNormal = (1.0 - reviewAmount) * objectNormal + reviewNormal;")
          .replace("#include <skinning_vertex>", "#include <skinning_vertex>\ntransformed = (1.0 - reviewAmount) * transformed + reviewAmount * position + reviewOffset + " + contact + ";");
      };
    }
    const hidden = unpack(source.hidden, Uint32Array);
    if (hidden.length) {
      const original = geometry.index;
      const trimmed = original.clone();
      // 검토본에서 겉감에 완전히 가려진 안쪽 삼각형만 제외한다.
      for (const face of hidden) trimmed.array.fill(trimmed.array[face * 3], face * 3, face * 3 + 3);
      layers.push({geometry, original, trimmed});
    }
  }

  function update(state, a, b, fraction, blend) {
    clearance.update(state, a, b, fraction, blend);
    if (previous !== state) {
      from.copy(weights);
      previous = state;
    }
    const selected = states.indexOf(state);
    if (selected >= 0) {
      const [offset] = review.states[state];
      samples[selected].set(offset + a, offset + b, fraction);
    }
    for (let i = 0; i < states.length; ++i) {
      weights.setComponent(i, from.getComponent(i) * (1 - blend) + (i === selected ? blend : 0));
    }
    const active = weights.x + weights.y + weights.z > 0.5;
    for (const layer of layers) layer.geometry.setIndex(active ? layer.trimmed : layer.original);
  }
  return { attach, update };
}
