import { restoreArrayBytes } from "./array-storage.js";
import { decodeBase64 } from "./base64.js";
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
  return new Response(decodeBase64(value));
}

export async function readAsset(name) {
  const [info, packed] = await Promise.all([
    readResponse("data/" + name + ".json"), readResponse("data/" + name + ".pack"),
  ]);
  const [meta, bytes] = await Promise.all([
    info.json(), new Response(packed.body.pipeThrough(new DecompressionStream("gzip"))).arrayBuffer(),
  ]);
  const types = {Float32Array, Uint32Array, Uint16Array};
  let sliceStart = performance.now();
  for (const mesh of meta.meshes ?? meta) {
    for (const key of ["positions","normals","uvs","indices","skinIndices","skinWeights"]) {
      const v = mesh[key];
      if (v) {
        restoreArrayBytes(bytes, v);
        mesh[key] = new types[v.type](bytes, v.off, v.len);
        // Yield by elapsed work, rather than adding a nested timer per array.
        if (v.encoding && performance.now() - sliceStart >= 8) {
          await new Promise(resolve => setTimeout(resolve, 0));
          sliceStart = performance.now();
        }
      }
    }
  }
  return meta;
}

