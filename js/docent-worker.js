import { gunzipSync } from "../vendor/fflate.module.js";
import { decodeNpcBinary } from "./npc-binary.js";

// 브라우저 내장 gzip 해제를 워커에서 사용한다. 미지원 환경은 기존 방식으로 복원한다.
// 모델 파일 및 복원된 수치는 변경하지 않는다.
self.onmessage = async ({ data: source }) => {
  try {
    const start = performance.now();
    let bytes, decompressor = "javascript-gzip", fallbackReason;
    if (typeof DecompressionStream === "function") {
      try {
        const stream = new Blob([source]).stream().pipeThrough(new DecompressionStream("gzip"));
        bytes = new Uint8Array(await new Response(stream).arrayBuffer());
        decompressor = "native-gzip";
      } catch (error) {
        fallbackReason = error.message;
      }
    }
    if (!bytes) bytes = gunzipSync(new Uint8Array(source));
    const unpacked = performance.now();
    const rig = decodeNpcBinary(bytes);
    const decoded = performance.now();
    // 공유 버퍼는 복제하지 않고 한 번만 소유권을 이전한다.
    self.postMessage({ rig, timings: {
      decompressMs: unpacked - start, metadataAndViewsMs: decoded - unpacked,
      decompressor, ...(fallbackReason ? { fallbackReason } : {}),
    } }, [bytes.buffer]);
  } catch (error) {
    self.postMessage({ error: error.message });
  }
};
