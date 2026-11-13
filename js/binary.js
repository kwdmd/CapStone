import { restoreArrayBytes } from "./array-storage.js";
const pending = new Map();

// file://에서는 fetch 대신 빌드 시 만든 로컬 전용 스크립트로 데이터를 읽는다.
export async function readResponse(path) {
  if (location.protocol !== "file:") {
    const response = await fetch(path);
    if (!response.ok) throw new Error(path + " (HTTP " + response.status + ")");
    return response;
  }
  window.chessLocalAsset = (name, value) => pending.get(name)?.(value);
  const value = await new Promise((resolve, reject) => {
    const script = document.createElement("script");
    pending.set(path, resolve);
    script.src = (document.querySelector('meta[name="local-assets"]')?.content ?? "local-assets/") + path.split("/").pop() + ".js";
    script.onerror = () => reject(new Error(path + " 로컬 데이터 누락"));
    script.onload = () => { pending.delete(path); script.remove(); };
    document.head.append(script);
  });
  if (!path.endsWith(".pack")) return new Response(value);
  const bytes = typeof Uint8Array.fromBase64 === "function"
    ? Uint8Array.fromBase64(value) : Uint8Array.from(atob(value), c => c.charCodeAt(0));
  return new Response(bytes);
}

export async function readAsset(name) {
  const [info, packed] = await Promise.all([
    readResponse("data/" + name + ".json"), readResponse("data/" + name + ".pack"),
  ]);
  const [meta, bytes] = await Promise.all([
    info.json(), new Response(packed.body.pipeThrough(new DecompressionStream("gzip"))).arrayBuffer(),
  ]);
  const types = {Float32Array, Uint32Array, Uint16Array};
  for (const mesh of meta.meshes ?? meta) {
    for (const key of ["positions","normals","uvs","indices","skinIndices","skinWeights"]) {
      const v = mesh[key];
      if (v) {
        restoreArrayBytes(bytes, v);
        mesh[key] = new types[v.type](bytes, v.off, v.len);
        // 큰 배열 복원 사이에는 UI에 실행 기회를 돌려준다.
        if (v.encoding) await new Promise(resolve => setTimeout(resolve, 0));
      }
    }
  }
  return meta;
}

