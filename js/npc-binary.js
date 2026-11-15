// NPCB v1: gzip 내부에 메타데이터 JSON과 4바이트 정렬된 정점 배열을 보관한다.
// 런타임은 의상 보정/메시 분할/대형 숫자 JSON 파싱 없이 배열 뷰만 만든다.
export function decodeNpcBinary(bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (bytes.length < 12 || view.getUint32(0, true) !== 0x4243504e || view.getUint32(4, true) !== 1)
    throw new Error("지원하지 않는 도슨트 바이너리 형식");
  const length = view.getUint32(8, true);
  const payload = Math.ceil((12 + length) / 4) * 4;
  if (payload > bytes.length) throw new Error("도슨트 메타데이터 길이 오류");
  const rig = JSON.parse(new TextDecoder().decode(bytes.subarray(12, 12 + length)));
  const types = { Float32Array, Uint16Array, Uint32Array };
  for (const mesh of rig.meshes) {
    for (const key of ["positions", "normals", "uvs", "indices", "skinIndices", "skinWeights"]) {
      const d = mesh[key];
      if (!d) continue;
      const Type = types[d.type], offset = payload + d.offset;
      if (!Type || !Number.isSafeInteger(d.length) || d.length < 0 || !Number.isSafeInteger(d.offset) || d.offset < 0 || offset + d.length * Type.BYTES_PER_ELEMENT > bytes.length)
        throw new Error("도슨트 배열 범위 오류: " + key);
      if (d.encoding === "byte-delta" || d.encoding === "byte-shuffle") {
        const stride = Type.BYTES_PER_ELEMENT;
        const encoded = bytes.subarray(offset, offset + d.length * stride);
        const restored = new Uint8Array(encoded.length);
        for (let byte = 0; byte < stride; byte++) {
          let previous = 0;
          for (let i = 0; i < d.length; i++) {
            previous = d.encoding === "byte-delta" ? (previous + encoded[byte * d.length + i]) & 255 : encoded[byte * d.length + i];
            restored[i * stride + byte] = previous;
          }
        }
        // 기존 공유 버퍼에 복원해서 워커 전송 때 추가 복제를 피한다.
        bytes.set(restored, offset);
      } else if (d.encoding) throw new Error("지원하지 않는 도슨트 배열 인코딩");
      mesh[key] = new Type(bytes.buffer, bytes.byteOffset + offset, d.length);
    }
  }
  return rig;
}
