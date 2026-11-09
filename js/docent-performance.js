// [측정] CPU 경과 시간이다. GPU 자체의 실행 시간과 구분해서 해석한다.
export const docentTimings = [];
export function recordStage(id, stage, start, details = {}) {
  const end = performance.now();
  docentTimings.push({ id, stage, startMs: start, endMs: end, durationMs: end - start, ...details });
}
// rAF 콜백 안에서 바로 무거운 작업을 하면 그 프레임의 paint를 막는다.
// 다음 프레임의 paint 기회를 준 뒤 작업을 이어간다.
export const yieldFrame = () => new Promise(resolve => requestAnimationFrame(() => setTimeout(resolve, 0)));
export async function measureStage(id, stage, task) {
  const start = performance.now();
  try { return await task(); } finally { recordStage(id, stage, start); }
}
