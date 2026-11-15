import * as THREE from "../vendor/three.module.js";
import { recordStage, yieldFrame } from "./docent-performance.js";

let renderer;
let queue = Promise.resolve();
let pending = 0;
// [구조 설명] 3D 장면이 초기 텍스처를 전부 등록한 후 호출한다.
// 아직 이미지 로드 콜백이 오지 않은 작업도 pending에 포함한다.
// initTexture 호출 완료를 기다리며 GPU 강제 동기화(gl.finish)는 하지 않는다.
export async function waitForStartupTextures(timeoutMs = 30000) {
  const deadline = performance.now() + timeoutMs;
  while (pending > 0) {
    if (performance.now() >= deadline) throw new Error("초기 텍스처 준비 대기 시간 초과");
    await yieldFrame();
  }
  await queue;
  // 마지막 업로드 직후 파일 파싱을 붙이지 않고 화면을 그릴 기회를 준다.
  await yieldFrame();
}
// [구조 설명] 이미지 로드가 같은 시점에 끝나도 GPU 업로드를 한 프레임에 몰지 않는다.
// 개별 이미지 한 장의 업로드 자체는 더 작은 작업으로 나누지 못한다.
export function setStartupTextureRenderer(value) { renderer = value; }
export function createStartupTextureLoader(loader = new THREE.TextureLoader()) {
  return {
    load(url) {
      pending++;
      const texture = new THREE.Texture();
      loader.load(url, loaded => {
        queue = queue.then(async () => {
          await yieldFrame();
          const start = performance.now();
          try {
            texture.image = loaded.image;
            texture.needsUpdate = true;
            renderer?.initTexture(texture);
          } finally {
            recordStage("startup", "texture-upload-submit", start, { texture: texture.userData.profileLabel || "unlabelled", width: loaded.image.width, height: loaded.image.height });
            loaded.dispose();
            pending--;
            if (!pending) recordStage("startup", "all-textures-ready", performance.now());
          }
        }).catch(error => {
          window.dispatchEvent(new ErrorEvent("error", {message: "초기 텍스처 준비 실패: " + error.message, error}));
        });
      }, undefined, () => { pending--; window.dispatchEvent(new ErrorEvent("error", {message: "초기 텍스처 이미지 로드 실패"})); });
      return texture;
    },
  };
}
