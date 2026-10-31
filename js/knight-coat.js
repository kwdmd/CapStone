import * as THREE from "../vendor/three.module.js";

// 표면의 삼각형 내부 위치를 이용해 웨이트를 보간한다. 정점 번호/거리만으로
// 찾으면 단추가 가까운 옷 표면과 다른 본을 따라 움직일 수 있다.
function surfaceWeights(source, point, allowedMaterials = null) {
  const triangle = new THREE.Triangle();
  const closest = new THREE.Vector3();
  const bary = new THREE.Vector3();
  let best = Infinity,
    result = new Map();
  for (const [start, count, material] of source.groups) {
    if (allowedMaterials && !allowedMaterials.has(material)) continue;
    for (let t = start; t < start + count; t += 3) {
      const ids = source.indices.slice(t, t + 3);
      triangle.set(
        ...ids.map((i) =>
          new THREE.Vector3().fromArray(source.positions, i * 3),
        ),
      );
      triangle.closestPointToPoint(point, closest);
      const distance = point.distanceToSquared(closest);
      if (distance >= best) continue;
      triangle.getBarycoord(closest, bary);
      if (!Number.isFinite(bary.x)) continue;
      best = distance;
      result = new Map();
      ids.forEach((id, j) => {
        for (let k = 0; k < 4; k++) {
          const b = source.skinIndices[id * 4 + k];
          result.set(
            b,
            (result.get(b) || 0) +
              source.skinWeights[id * 4 + k] * bary.getComponent(j),
          );
        }
      });
    }
  }
  return result;
}
function writeWeights(indices, weights, vertex, influences) {
  const top = [...influences]
    .filter((p) => p[1] > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4);
  const total = top.reduce((sum, p) => sum + p[1], 0);
  if (!total) throw new Error("外투 웨이트 표면을 찾지 못했습니다.");
  for (let k = 0; k < 4; k++) {
    indices[vertex * 4 + k] = top[k]?.[0] ?? 0;
    weights[vertex * 4 + k] = (top[k]?.[1] ?? 0) / total;
  }
}

// [직접 수정] 크기/실루엣은 바꾸지 않고 외투의 본 영향만 수정한다.
export function fitKnightCoat(data, mesh, geometry) {
  if (data.name !== "Knight-4-2-right-foot") return null;
  const indices = new Uint16Array(mesh.skinIndices),
    weights = new Float32Array(mesh.skinWeights);
  if (mesh.name === "Cube.001") {
    // 외투에 완전히 덮이는 골반 옆만 안쪽으로 이동한다. 허리선/무릎/밑단은 유지.
    const position = geometry.attributes.position;
    for (let i = 0; i < position.count; i++) {
      const x = position.getX(i),
        y = position.getY(i),
        z = position.getZ(i);
      const band =
        THREE.MathUtils.smoothstep(y, 0.75, 0.88) *
        (1 - THREE.MathUtils.smoothstep(y, 1.0, 1.07));
      const side = THREE.MathUtils.smoothstep(Math.abs(x), 0.07, 0.13);
      const factor = 1 - band * (0.14 + 0.14 * side);
      position.setX(i, x * factor);
      position.setZ(i, -0.055 + (z + 0.055) * factor);
    }
    geometry.computeVertexNormals();
    return null;
  }
  if (mesh.name === "Cylinder.002") {
    const pants = data.meshes.find((m) => m.name === "Cube.001");
    const belt = data.meshes.find((m) => m.name === "Cube.019");
    for (let i = 0; i < geometry.attributes.position.count; i++) {
      const point = new THREE.Vector3().fromBufferAttribute(
        geometry.attributes.position,
        i,
      );
      const lower = surfaceWeights(pants, point);
      // 허리선은 벨트를 따라 움직이고, 아래쪽만 바지 웨이트로 부드럽게 전환한다.
      const upper = THREE.MathUtils.smoothstep(point.y, 0.9, 1.025);
      if (upper > 0) {
        for (const [b, w] of lower) lower.set(b, w * (1 - upper));
        for (const [b, w] of surfaceWeights(belt, point))
          lower.set(b, (lower.get(b) || 0) + w * upper);
      }
      writeWeights(indices, weights, i, lower);
    }
    return { indices, weights };
  }
  if (mesh.name !== "Cube") return null;
  const gold = new Set(),
    white = new Set();
  for (const [start, count, material] of mesh.groups) {
    if (data.materials[material].name === "Material.068") {
      for (const i of mesh.indices.slice(start, start + count)) gold.add(i);
    } else white.add(material);
  }
  // 단추는 각각 한 덩어리로 움직인다. 중심에서 가장 가까운 외투 표면의
  // 웨이트를 공유해 모양이 찌그러지거나 옷 속으로 서로 다르게 움직이지 않게 한다.
  const remaining = new Set(gold);
  while (remaining.size) {
    const component = [remaining.values().next().value];
    remaining.delete(component[0]);
    for (let cursor = 0; cursor < component.length; cursor++) {
      const a = new THREE.Vector3().fromArray(
        mesh.positions,
        component[cursor] * 3,
      );
      for (const i of remaining) {
        const b = new THREE.Vector3().fromArray(mesh.positions, i * 3);
        if (a.distanceToSquared(b) < 0.0001) {
          component.push(i);
          remaining.delete(i);
        }
      }
    }
    const center = new THREE.Vector3();
    component.forEach((i) =>
      center.add(new THREE.Vector3().fromArray(mesh.positions, i * 3)),
    );
    center.divideScalar(component.length);
    const influence = surfaceWeights(mesh, center, white);
    component.forEach((i) => writeWeights(indices, weights, i, influence));
  }
  return { indices, weights };
}
