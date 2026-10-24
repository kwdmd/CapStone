// [구조 설명] 브라우저 wheel 단위를 픽셀로 맞추고 한 이벤트의 과도한 확대를 제한한다.
export function wheelPixels(delta, mode, height = 800) {
  return Math.max(
    -240,
    Math.min(240, delta * (mode === 1 ? 16 : mode === 2 ? height : 1)),
  );
}
export function zoomValue(current, delta, min, max) {
  return Math.max(min, Math.min(max, current * Math.exp(delta * 0.0015)));
}
