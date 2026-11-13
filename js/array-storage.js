// 저장 시 바이트 순서만 바꾼 배열을 원래 비트로 복원한다. 정점·UV·본 가중치의 정밀도는 유지한다.
export function restoreArrayBytes(buffer, view) {
  if (!view.encoding) return;
  if (!['byte-shuffle', 'byte-delta'].includes(view.encoding)) throw new Error('Unknown player encoding: ' + view.encoding);
  const stride = view.type === 'Uint16Array' ? 2 : 4;
  const target = new Uint8Array(buffer, view.off, view.len * stride);
  const source = target.slice();
  for (let byte = 0; byte < stride; byte++) {
    let previous = 0;
    for (let i = 0; i < view.len; i++) {
      const stored = source[byte * view.len + i];
      const value = view.encoding === 'byte-delta' ? (previous + stored) & 255 : stored;
      target[i * stride + byte] = value;
      previous = value;
    }
  }
}
