// [구조 설명] 큰 메시의 삼각형과 모든 정점 속성을 그대로 유지한 채
// 업로드 단위만 나눈다. 워커에서 실행해 메인 화면의 입력을 막지 않는다.
export function splitNpcMesh(mesh, maxVertices = 40000, maxIndices = 90000) {
  if (mesh.positions.length / 3 <= maxVertices) return [mesh];
  const sizes = { positions: 3, normals: 3, uvs: 2, skinIndices: 4, skinWeights: 4 };
  const parts = [];
  let lookup = new Map(), vertices = [], indices = [], groups = [];
  function flush() {
    if (!indices.length) return;
    const part = { ...mesh, indices: new Uint16Array(indices), groups, sourcePart: parts.length };
    for (const [key, size] of Object.entries(sizes)) {
      if (!mesh[key]) continue;
      const original = mesh[key];
      const array = new original.constructor(vertices.length * size);
      vertices.forEach((vertex, i) => array.set(original.subarray(vertex * size, (vertex + 1) * size), i * size));
      part[key] = array;
    }
    parts.push(part);
    lookup = new Map(); vertices = []; indices = []; groups = [];
  }
  for (const [start, count, material] of mesh.groups) {
    for (let i = start; i < start + count; i += 3) {
      const triangle = [mesh.indices[i], mesh.indices[i + 1], mesh.indices[i + 2]];
      const missing = new Set(triangle.filter(index => !lookup.has(index))).size;
      if (vertices.length + missing > maxVertices || indices.length + 3 > maxIndices) flush();
      let group = groups.at(-1);
      if (!group || group[2] !== material) { group = [indices.length, 0, material]; groups.push(group); }
      for (const index of triangle) {
        if (!lookup.has(index)) { lookup.set(index, vertices.length); vertices.push(index); }
        indices.push(lookup.get(index));
      }
      group[1] += 3;
    }
  }
  flush();
  return parts;
}
