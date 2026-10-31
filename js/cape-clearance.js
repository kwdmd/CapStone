import * as THREE from "../vendor/three.module.js";
import { gunzipSync } from "../vendor/fflate.module.js";
import fit from "../data/cape-clearance.json" with { type: "json" };

// 각 프레임에서 소매의 바깥면까지 필요한 반경을 방향·높이별로 보관한다.
// 목과 소매가 닿지 않는 곳에서는 원래 리깅 결과가 그대로 사용된다.
const { angles, heights, tiles, bottom, top, center } = fit;
const states = ["idle", "walk"];
let sharedTexture;

function contactTexture() {
  if (sharedTexture) return sharedTexture;
  const frames = fit.frames.idle + fit.frames.walk;
  const width = angles * tiles;
  const height = heights * Math.ceil(frames / tiles);
  const pixels = new Uint16Array(width * height);
  const bytes = gunzipSync(Uint8Array.from(atob(fit.grid), c => c.charCodeAt(0)));
  const rows = new Uint16Array(bytes.buffer, bytes.byteOffset, bytes.byteLength / 2);
  for (let f = 0; f < frames; f++) {
    const x = (f % tiles) * angles;
    const y = Math.floor(f / tiles) * heights;
    for (let h = 0; h < heights; h++) {
      const src = (f * heights + h) * angles;
      pixels.set(rows.subarray(src, src + angles), (y + h) * width + x);
    }
  }
  sharedTexture = new THREE.DataTexture(pixels, width, height, THREE.RedIntegerFormat, THREE.UnsignedShortType);
  sharedTexture.internalFormat = "R16UI";
  sharedTexture.needsUpdate = true;
  return sharedTexture;
}

export const capeShader = `
uniform highp usampler2D capeGrid;
uniform vec3 capeFrames[2];
uniform vec2 capeWeights;
float clearanceAt(int frame, vec2 uv) {
  ivec2 tile = ivec2(frame % ${tiles}, frame / ${tiles}) * ivec2(${angles}, ${heights});
  ivec2 a = ivec2(floor(uv));
  ivec2 b = ivec2((a.x + 1) % ${angles}, min(a.y + 1, ${heights-1}));
  vec2 t = fract(uv);
  float low = mix(float(texelFetch(capeGrid,tile+a,0).r), float(texelFetch(capeGrid,tile+ivec2(b.x,a.y),0).r), t.x);
  float high = mix(float(texelFetch(capeGrid,tile+ivec2(a.x,b.y),0).r), float(texelFetch(capeGrid,tile+b,0).r), t.x);
  return mix(low,high,t.y) / 16000.0;
}
vec3 capeContactOffset(vec3 point) {
  vec2 radial = point.xz - vec2(${center[0]},${center[1]});
  float radius = length(radial);
  float angle = fract(atan(radial.y, radial.x)/6.28318530718) * ${angles}.0;
  vec2 uv = vec2(angle, clamp((point.y-${bottom})/(${top}-${bottom}),0.0,1.0)*${heights-1}.0);
  float push = 0.0;
  for (int i=0; i<2; i++) {
    if (capeWeights[i] <= 0.0) continue;
    vec3 frames = capeFrames[i];
    float required = mix(clearanceAt(int(frames.x),uv),clearanceAt(int(frames.y),uv),frames.z);
    // 목 뒤와 안쪽은 보정하지 않고, 소매 옆에서만 최대 0.045까지 부드럽게 밀어낸다.
    float side = smoothstep(0.065, 0.16, abs(radial.x));
    float belowCollar = 1.0 - smoothstep(1.17, 1.27, point.y);
    float extra = max(0.0, required - radius);
    push += capeWeights[i] * side * belowCollar * 0.045 * tanh(extra / 0.045);
  }
  vec2 offset = radial * (push / max(radius,0.00001));
  return vec3(offset.x,0.0,offset.y);
}`;

export function createCapeClearance() {
  const samples = states.map(() => new THREE.Vector3());
  const weights = new THREE.Vector2(), from = new THREE.Vector2();
  let previous;
  return {
    uniforms() {
      return { capeGrid: {value:contactTexture()}, capeFrames: {value:samples}, capeWeights: {value:weights} };
    },
    update(state, a, b, fraction, blend) {
      if (state !== previous) { from.copy(weights); previous = state; }
      const index = states.indexOf(state);
      if (index >= 0) {
        const start = index === 0 ? 0 : fit.frames.idle;
        samples[index].set(start+a,start+b,fraction);
      }
      for (let i=0;i<2;i++) weights.setComponent(i,from.getComponent(i)*(1-blend)+(i===index?blend:0));
    },
  };
}
