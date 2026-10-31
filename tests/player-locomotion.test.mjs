import assert from "node:assert/strict";
import { createLocomotionState } from "../js/locomotion-state.js";
import { createAvatarMotion, playerClips } from "../js/avatar-motion.js";
import settings from "../data/motion-settings.json" with { type: "json" };
import * as THREE from "../vendor/three.module.js";
const select = createLocomotionState(settings);
assert.equal(select(0.016, { speed: 0, aheadDelta: 0.44 }), "idle");
assert.equal(select(0.016, { speed: 4 }), "walk");
assert.equal(select(0.016, { speed: 7.5, running: true }), "run");
assert.equal(
  select(0.016, { speed: 7.5, running: true, aheadDelta: 0.44 }),
  "run",
);
assert.equal(select(0.1, { speed: 4 }), "walk");
assert.equal(select(0.1, { speed: 4, heightDelta: -0.44 }), "walk");
for (let i = 0; i < 5; i++) select(0.1, { speed: 4 });
assert.equal(select(0.1, { speed: 4 }), "walk");
assert.equal(select(0.1, { speed: 0 }), "idle");
assert.deepEqual(Object.keys(playerClips).sort(), [
  "idle",
  "run",
  "walk",
]);
assert.equal(select(0.016, {speed: 7.5, running: true}), "run");
const bones = Object.keys(playerClips.idle.tracks).map((name) => {
  const b = new THREE.Bone();
  b.name = name;
  return b;
});
const update = createAvatarMotion(bones);
for (const [state, speed, running, terrain] of [
  ["idle", 0, false, {}],
  ["walk", 4, false, {}],
  ["run", 7.5, true, {}],
  ["run", 7.5, true, { aheadDelta: 0.44 }],
  ["run", 7.5, true, { aheadDelta: -0.44 }],
]) {
  for (let i = 0; i < 240; i++) update(1 / 60, speed, running, terrain);
  assert.equal(update.state, state);
  for (const b of bones) {
    assert.ok(b.quaternion.toArray().every(Number.isFinite));
    assert.ok(Math.abs(b.quaternion.length() - 1) < 1e-5);
  }
  const c = playerClips[state];
  assert.ok(c.frames > 1);
  for (const values of Object.values(c.tracks))
    assert.equal(values.length, c.frames * 4);
}
console.log(
  "PASS: three FBX clips, finite poses, sprint on ascending and descending stairs, stop and walk",
);
