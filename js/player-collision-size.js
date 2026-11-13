export function playerCollisionSize(settings) {
  // [직접 수정] 충돌 배율은 외형 배율과 별도로 조정한다. 표시 원통에도 같은 값을 사용한다.
  const scale = settings.playerCollisionScale ?? settings.characterScale ?? 1;
  return { radius: 0.68 * scale, height: 1.8 * scale, surfaceRatio: 0.85 };
}
