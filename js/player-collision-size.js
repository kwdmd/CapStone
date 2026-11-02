export function playerCollisionSize(settings) {
  const scale = settings.characterScale ?? 1;
  return { radius: 0.68 * scale, height: 1.8 * scale, surfaceRatio: 0.85 };
}
