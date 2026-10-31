import fs from "node:fs";
import zlib from "node:zlib";
import assert from "node:assert/strict";
import * as T from "../vendor/three.module.js";
import { createNpcRig } from "../js/npc-rig.js";
for (const id of process.argv.length > 2
  ? process.argv.slice(2)
  : ["rook", "knight", "pawn-b"]) {
  const packed = JSON.parse(
    fs.readFileSync(new URL("../data/npc-" + id + ".json", import.meta.url)),
  );
  const d = JSON.parse(zlib.gunzipSync(Buffer.from(packed.data, "base64")));
  assert.ok(d.bones.length > 0 && d.idle.mappedBones.length >= 20);
  const g = createNpcRig(d, []);
  g.updateMatrixWorld(true);
  const sample = () => {
    const points = [];
    g.traverse((m) => {
      if (m.isSkinnedMesh) {
        for (
          let i = 0;
          i < m.geometry.attributes.position.count;
          i += Math.max(
            1,
            Math.floor(m.geometry.attributes.position.count / 30),
          )
        ) {
          const v = m.getVertexPosition(i, new T.Vector3());
          assert.ok(v.toArray().every(Number.isFinite));
          assert.ok(v.length() < 5);
          points.push(v);
        }
      }
    });
    return points;
  };
  // 망토/치마의 정점 사이 거리가 한 주기 내내 유지되어 찢김·꼬임이 없는지 검사한다.
  const garmentName = { rook: "Cylinder.004", "pawn-b": "Cylinder.005" }[id];
  if (garmentName) {
    const garment = g.getObjectByName(garmentName);
    const attr = garment.geometry.attributes.position;
    const indices = Array.from({ length: 30 }, (_, i) =>
      Math.floor((i * (attr.count - 1)) / 29),
    );
    const original = indices.map((i) =>
      new T.Vector3().fromBufferAttribute(attr, i),
    );
    for (let frame = 0; frame < 60; frame++) {
      g.userData.updateIdle(d.idle.duration / 60);
      g.updateMatrixWorld(true);
      const posed = indices.map((i) =>
        garment.getVertexPosition(i, new T.Vector3()),
      );
      for (let i = 1; i < indices.length; i++) {
        assert.ok(
          Math.abs(
            posed[0].distanceTo(posed[i]) - original[0].distanceTo(original[i]),
          ) < 0.00001,
          "garment retains shape throughout Idle",
        );
      }
    }
  }
  if (id === "knight") {
    const stable = d.bones.filter((b) => /^hand\.[LR]$/.test(b.name));
    for (let frame = 0; frame < 60; frame++) {
      g.userData.updateIdle(d.idle.duration / 60);
      for (const b of stable) {
        const rest = new T.Quaternion();
        new T.Matrix4()
          .fromArray(b.matrix)
          .decompose(new T.Vector3(), rest, new T.Vector3());
        assert.ok(
          g
            .getObjectByName(b.name)
            .quaternion.clone()
            .normalize()
            .angleTo(rest.normalize()) < 0.00001,
          "wrists keep rest angles",
        );
      }
    }
    // 하체 Idle을 복구한 뒤 실제로 다리 회전 트랙이 적용되는지 확인한다.
    const leg = g.getObjectByName("thigh.L");
    const beforeLeg = leg.quaternion.clone();
    g.userData.updateIdle(1);
    assert.ok(
      leg.quaternion.angleTo(beforeLeg) > 0.00001,
      "knight lower body Idle remains active",
    );
    for (const name of ["Cube.003", "RightFoot_Repaired"]) {
      const original = d.meshes.find((m) => m.name === name).positions;
      const positions = g.getObjectByName(name).geometry.attributes.position;
      for (let i = 0; i < positions.count; i++) {
        if (original[i * 3 + 1] <= 0.08) {
          assert.ok(
            new T.Vector3()
              .fromBufferAttribute(positions, i)
              .distanceTo(new T.Vector3().fromArray(original, i * 3)) <
              0.000001,
            "toe and sole preserved",
          );
        }
      }
    }
  }
  g.updateMatrixWorld(true);
  if (id === "knight") {
    for (const name of ["Cylinder.002", "Cube.019", "Cube"]) {
      const original = d.meshes.find((m) => m.name === name);
      const geometry = g.getObjectByName(name).geometry;
      for (let i = 0; i < original.positions.length; i++) {
        assert.ok(
          Math.abs(
            geometry.attributes.position.array[i] - original.positions[i],
          ) < 0.000001,
          "coat, belt, buttons keep original dimensions",
        );
      }
      for (let i = 0; i < geometry.attributes.skinWeight.count; i++) {
        const w = geometry.attributes.skinWeight;
        assert.ok(
          Math.abs(w.getX(i) + w.getY(i) + w.getZ(i) + w.getW(i) - 1) < 0.00001,
          "normalized garment weights",
        );
      }
    }
  }
  if (id === "knight") {
    const arms = ["upper_arm.L", "upper_arm.R"].map((n) =>
      g.getObjectByName(n),
    );
    const initial = arms.map((b) => b.quaternion.clone().normalize());
    for (let i = 0; i < 5; i++) g.userData.updateIdle(0);
    arms.forEach((b, i) =>
      assert.ok(
        b.quaternion.clone().normalize().angleTo(initial[i]) < 0.00001,
        "arm correction does not accumulate",
      ),
    );
  }
  g.updateMatrixWorld(true);
  if (id === "pawn-b") {
    const stable = d.bones.filter((b) =>
      /^(spine(\.00[123])?|hand\.[LR])$/.test(b.name),
    );
    for (let frame = 0; frame < 60; frame++) {
      g.userData.updateIdle(d.idle.duration / 60);
      for (const b of stable) {
        const rest = new T.Quaternion();
        new T.Matrix4()
          .fromArray(b.matrix)
          .decompose(new T.Vector3(), rest, new T.Vector3());
        assert.ok(
          g
            .getObjectByName(b.name)
            .quaternion.clone()
            .normalize()
            .angleTo(rest.normalize()) < 0.00001,
          "pawn torso and wrists keep aligned rest pose",
        );
      }
    }
    g.updateMatrixWorld(true);
  }
  const a = sample();
  g.userData.updateIdle(2);
  g.updateMatrixWorld(true);
  const b = sample();
  assert.ok(a.some((p, i) => p.distanceTo(b[i]) > 0.001));
  g.userData.updateIdle(d.idle.duration - 2);
  g.updateMatrixWorld(true);
  const c = sample();
  assert.ok(
    a.every((p, i) => p.distanceTo(c[i]) < 0.0001),
    "loop returns to start",
  );
  if (id === "knight") {
    assert.ok(g.getObjectByName("RightFoot_Repaired"));
    assert.equal(d.materials[29].map, "Frame 6.png");
    assert.equal(d.materials[30].map, "Frame 5.png");
  }
  console.log("PASS:", id, "skin deformation, bounds, looping, preserved data");
}
