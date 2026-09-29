/* [한국어 해설]
 * 각도 범위를 제한하는 순수 유틸리티. DOM/Three.js 의존성이 없어 Node 테스트에서 직접 검증한다.
 */
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

/* [한국어 해설]
 * dx/dy는 포인터 이동 픽셀이다. 수평 0.006, 수직 0.004 라디안/픽셀 감도로 누적하고 pitch를 ±1.2로 제한한다.
 */
export function applyLookDelta(player, dx, dy) {
  player.yaw -= dx * 0.006;
  player.pitch = clamp(player.pitch - dy * 0.004, -1.2, 1.2);
}

/* [한국어 해설]
 * yaw/pitch에서 바라보는 단위 방향 벡터를 반환한다. yaw=0, pitch=0이면 -Z 방향이다. 높이 방향은 y다.
 */
export function viewDirection(yaw, pitch) {
  const horizontal = Math.cos(pitch);
  return {
    x: -Math.sin(yaw) * horizontal,
    y: Math.sin(pitch),
    z: -Math.cos(yaw) * horizontal,
  };
}

/* [한국어 해설]
 * 3인칭 궤도 카메라 오프셋. 기존 높이 25와 distance로 반지름을 구하고 elevation을 0.25~1.3으로 제한한다. yaw+0.25는 전시를 비스듬하게 보이게 한다.
 */
export function orbitOffset(yaw, pitch, distance) {
  const radius = Math.hypot(distance, 25);
  const elevation = clamp(Math.atan2(25, distance) - pitch, 0.25, 1.3);
  const horizontal = radius * Math.cos(elevation);
  return {
    x: Math.sin(yaw + 0.25) * horizontal,
    y: radius * Math.sin(elevation),
    z: Math.cos(yaw + 0.25) * horizontal,
  };
}
