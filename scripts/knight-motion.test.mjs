import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { gunzipSync, gzipSync } from "node:zlib";
import * as THREE from "../vendor/three.module.js";
import { createKnightMotion } from "../js/knight-motion.js";
import { createKnightGroup, createKnightLoader, decodeKnightAsset } from "../js/knight-model.js";

const packedMotion = JSON.parse(await readFile(new URL("../data/knight-motion.json", import.meta.url), "utf8"));
const motion = JSON.parse(gunzipSync(Buffer.from(packedMotion.data, "base64")));
const modelLayout = JSON.parse(await readFile(new URL("../data/knight-6a-layout.json", import.meta.url), "utf8"));
const compressedModel = await readFile(new URL("../data/knight-6a.glb.pack", import.meta.url));
const glb = Buffer.from(await decodeKnightAsset(compressedModel));
const modelHash = createHash("sha256").update(glb).digest("hex");
assert.equal(glb.byteLength, modelLayout.originalBytes);
assert.equal(glb.readUInt32LE(8), glb.byteLength);
assert.equal(modelHash, packedMotion.model.sha256);
assert.equal(modelHash, modelLayout.originalSha256);
const nativeDecompressor = globalThis.DecompressionStream;
try {
  globalThis.DecompressionStream = undefined;
  const fallback = Buffer.from(await decodeKnightAsset(compressedModel));
  assert.equal(createHash("sha256").update(fallback).digest("hex"), modelHash,
    "Fallback decoding restores the exact original GLB bytes");
} finally {
  if (nativeDecompressor === undefined) delete globalThis.DecompressionStream;
  else globalThis.DecompressionStream = nativeDecompressor;
}
await assert.rejects(decodeKnightAsset(new Uint8Array([1, 2, 3])), "Reject corrupt gzip data");
await assert.rejects(decodeKnightAsset(compressedModel.subarray(0, 64)), "Reject truncated gzip data");
await assert.rejects(decodeKnightAsset(gzipSync(glb.subarray(0, glb.length - 4))),
  "Reject a truncated GLB even when its gzip stream is valid");
const sourceJson = JSON.parse(glb.subarray(20, 20 + glb.readUInt32LE(12)).toString("utf8"));
const sourceBoneNames = sourceJson.skins[0].joints.map(index => sourceJson.nodes[index].name);
const loader = createKnightLoader();
loader.register(() => ({ name: "HEADLESS_TEXTURE", loadTexture: () => Promise.resolve(new THREE.Texture()) }));
// Only image decode is stubbed. The real loader still constructs geometry,
// native parent transforms, bind inverses and physical/unlit materials.
const gltf = await loader.parseAsync(glb.buffer.slice(glb.byteOffset, glb.byteOffset + glb.byteLength), "");
const placements = JSON.parse(await readFile(new URL("../data/npcs.json", import.meta.url), "utf8"));
const placement = placements.find(item => item.id === "knight");
assert.ok(placement);

const loopVelocityJumps = {};
for (const [clipName, clip] of Object.entries(motion.clips)) {
  assert.ok(clip.duration > 0 && Number.isFinite(clip.duration));
  assert.ok(clip.times.length >= 2);
  assert.equal(clip.times[0], 0);
  assert.ok(clip.times.at(-1) >= clip.duration - 1e-5);
  for (let i = 1; i < clip.times.length; i++) assert.ok(clip.times[i] > clip.times[i - 1]);
  assert.equal(clip.rootPositions.length, clip.times.length * 3);
  let maximumLoopVelocityJump = 0;
  for (const name of sourceBoneNames) {
    const track = clip.tracks[name];
    assert.equal(track.length, clip.times.length * 4);
    assert.deepEqual(track.slice(0, 4), track.slice(-4), `Closed quaternion loop: ${name}`);
    const initial = angularVelocity(new THREE.Quaternion().fromArray(track),
      new THREE.Quaternion().fromArray(track, 4), clip.times[1] - clip.times[0]);
    const last = angularVelocity(new THREE.Quaternion().fromArray(track, track.length - 8),
      new THREE.Quaternion().fromArray(track, track.length - 4), clip.times.at(-1) - clip.times.at(-2));
    maximumLoopVelocityJump = Math.max(maximumLoopVelocityJump, initial.sub(last).length());
  }
  assert.deepEqual(clip.rootPositions.slice(0, 3), clip.rootPositions.slice(-3));
  assert.ok(maximumLoopVelocityJump < 0.1, "Loop overlap preserves approximately matching boundary velocity");
  loopVelocityJumps[clipName] = maximumLoopVelocityJump;
}

const parsedMaterials = await Promise.all(sourceJson.materials.map((_, index) => gltf.parser.getDependency("material", index)));
let sheenMaterials = 0, unlitMaterials = 0;
for (let index = 0; index < parsedMaterials.length; index++) {
  const material = parsedMaterials[index], source = gltf.parser.json.materials[index];
  assert.deepEqual(material.color.toArray(), source.pbrMetallicRoughness?.baseColorFactor?.slice(0, 3) ?? [1, 1, 1]);
  if (source.extensions?.KHR_materials_unlit) {
    assert.ok(material.isMeshBasicMaterial, "Native unlit face material must stay unlit");
    unlitMaterials++;
  }
  if (source.extensions?.KHR_materials_sheen) {
    const sheen = source.extensions.KHR_materials_sheen;
    assert.ok(material.isMeshPhysicalMaterial, "Native cloth sheen must keep the physical material");
    assert.equal(material.sheen, 1);
    assert.deepEqual(material.sheenColor.toArray(), sheen.sheenColorFactor ?? [0, 0, 0]);
    assert.equal(material.sheenRoughness, sheen.sheenRoughnessFactor ?? 0);
    sheenMaterials++;
  }
}
assert.equal(sheenMaterials, 2);
assert.equal(unlitMaterials, 0, "Reference eye materials receive scene lighting");
const nativeGeometry = geometryHash(gltf.scene);
const nativeBindings = bindingHash(gltf.scene);
const group = createKnightGroup(gltf);
assert.equal(geometryHash(), nativeGeometry, "Normalization does not bake changes into native geometry");
assert.equal(bindingHash(), nativeBindings, "Native inverse-bind matrices remain unchanged");
const normalized = group.children[0];
assert.equal(normalized.scale.x, packedMotion.normalization.scale);
assert.equal(normalized.scale.y, normalized.scale.x);
assert.equal(normalized.scale.z, normalized.scale.x);
assert.deepEqual(normalized.position.toArray(), packedMotion.normalization.offset);
assert.equal(typeof group.userData.updateIdle, "function");
assert.equal(typeof group.userData.setTalking, "function");
assert.equal(typeof group.userData.setAttention, "function");
group.position.set(placement.x, placement.y, placement.z);
group.scale.setScalar(placement.scale);
group.rotation.y = placement.rotation;
const bones = [];
group.traverse(object => { if (object.isBone) bones.push(object); });
assert.equal(bones.length, sourceBoneNames.length, "Animation does not add or remove rig bones");
assert.deepEqual(bones.map(bone => bone.name).sort(), [...sourceBoneNames].sort());
const byName = new Map(bones.map(bone => [bone.name, bone]));

// A separate bare-bone control keeps idle time aligned through the conversation.
// It lets the integration test detect that the real NPC enters and leaves talking.
const control = group.clone(true);
const controlBones = [];
control.traverse(object => { if (object.isBone) controlBones.push(object); });
const idleControl = createKnightMotion(control, controlBones);
const controlByName = new Map(controlBones.map(bone => [bone.name, bone]));

function geometryHash(subject = group) {
  const hash = createHash("sha256");
  subject.traverse(object => {
    if (!object.isMesh) return;
    for (const name of Object.keys(object.geometry.attributes).sort()) {
      const array = object.geometry.attributes[name].array;
      hash.update(name);
      hash.update(new Uint8Array(array.buffer, array.byteOffset, array.byteLength));
    }
    const index = object.geometry.index?.array;
    if (index) hash.update(new Uint8Array(index.buffer, index.byteOffset, index.byteLength));
  });
  return hash.digest("hex");
}
function bindingHash(subject = group) {
  const hash = createHash("sha256");
  const visited = new Set();
  subject.traverse(object => {
    if (!object.isSkinnedMesh || visited.has(object.skeleton)) return;
    visited.add(object.skeleton);
    for (const inverse of object.skeleton.boneInverses) hash.update(JSON.stringify(inverse.toArray()));
    hash.update(JSON.stringify(object.bindMatrix.toArray()));
  });
  return hash.digest("hex");
}
const originalGeometry = geometryHash();
group.userData.updateIdle(0);
group.updateMatrixWorld(true);
const expectedFeet = ["L", "R"].map(side => ({
  bone: byName.get(`foot.${side}`),
  position: new THREE.Vector3().fromArray(motion.reference.footPositions[side]).applyMatrix4(group.matrixWorld),
}));
const initialRotations = new Map(bones.map(bone => [bone.name, bone.quaternion.clone()]));
const initialRoot = byName.get(motion.rootBone).position.clone();
const changedBones = new Set();
let maximumFootDrift = 0;
let rootMotion = 0;
let maximumIdleStep = 0;
const point = new THREE.Vector3();
function validate() {
  group.updateMatrixWorld(true);
  for (const bone of bones) {
    assert.ok(bone.quaternion.toArray().every(Number.isFinite), `Finite rotation: ${bone.name}`);
    assert.ok(bone.position.toArray().every(Number.isFinite), `Finite position: ${bone.name}`);
    assert.ok(Math.abs(bone.quaternion.length() - 1) < 1e-5, `Normalized rotation: ${bone.name}`);
    if (bone.quaternion.angleTo(initialRotations.get(bone.name)) > 0.005) changedBones.add(bone.name);
  }
  rootMotion = Math.max(rootMotion, byName.get(motion.rootBone).position.distanceTo(initialRoot));
  for (const foot of expectedFeet) {
    maximumFootDrift = Math.max(maximumFootDrift, foot.bone.getWorldPosition(point).distanceTo(foot.position));
  }
  for (const name of ["hand.L", "hand.R"]) {
    assert.ok(byName.get(name).quaternion.angleTo(initialRotations.get(name)) < 1e-6,
      `Retargeting preserves the model's corrected wrist pose: ${name}`);
  }
}
function step(dt) {
  group.userData.updateIdle(dt);
  idleControl.update(dt);
  validate();
}
const idleFrames = Math.ceil(motion.clips.idle.duration * 2.2 * 30);
for (let i = 0; i < idleFrames; i++) {
  const previous = bones.map(bone => bone.quaternion.clone());
  step(1 / 30);
  maximumIdleStep = Math.max(maximumIdleStep,
    ...bones.map((bone, index) => bone.quaternion.angleTo(previous[index])));
}
assert.ok(changedBones.size >= 4, "Idle must animate several body joints");
assert.ok(rootMotion > 0.0001, "Idle includes subtle weight shifting");
assert.ok(maximumIdleStep < 0.5, "Idle loops continuously without abrupt pose jumps");

const pose = () => bones.map(bone => bone.quaternion.clone());
const difference = previous => Math.max(...bones.map((bone, index) => bone.quaternion.angleTo(previous[index])));
let before = pose();
group.userData.setTalking(true);
step(0);
assert.ok(difference(before) < 1e-5, "Entering conversation starts with a crossfade, not a pose snap");
let maximumTalkDifference = 0;
let maximumConversationStep = 0;
const talkingFrames = Math.ceil(motion.clips.talking.duration * 2.2 * 60);
for (let i = 0; i < talkingFrames; i++) {
  before = pose();
  step(1 / 60);
  maximumConversationStep = Math.max(maximumConversationStep, difference(before));
  for (const name of ["upper_arm.L", "upper_arm.R", "forearm.L", "forearm.R", "spine.003", "head"]) {
    if (byName.has(name)) maximumTalkDifference = Math.max(maximumTalkDifference,
      byName.get(name).quaternion.angleTo(controlByName.get(name).quaternion));
  }
}
assert.ok(maximumTalkDifference > 0.02, "Talking uses distinct body/arm motion");
assert.ok(maximumConversationStep < 0.5, "Talking has no abrupt large per-frame pose jumps");
before = pose();
group.userData.setTalking(false);
step(0);
assert.ok(difference(before) < 1e-5, "Leaving conversation does not snap to idle");
for (let i = 0; i < 180; i++) step(1 / 60);
for (const bone of bones) {
  assert.ok(bone.quaternion.angleTo(controlByName.get(bone.name).quaternion) < 1e-4,
    `Returns smoothly to idle: ${bone.name}`);
}
for (const dt of [NaN, Infinity, -Infinity, -1, undefined]) {
  before = pose();
  step(dt);
  assert.ok(difference(before) < 1e-5, "Invalid/negative dt freezes the pose safely");
}
step(1000);

// Compare finite-difference velocities at a state switch, between source keys.
// A first-order target snap would cause a large change here even with update(0).
function angularVelocity(a, b, dt) {
  const delta = a.clone().invert().multiply(b).normalize();
  if (delta.w < 0) delta.set(-delta.x, -delta.y, -delta.z, -delta.w);
  const value = new THREE.Vector3(delta.x, delta.y, delta.z);
  const length = value.length();
  return length < 1e-12 ? value.set(0, 0, 0)
    : value.multiplyScalar(2 * Math.atan2(length, delta.w) / (length * dt));
}
step(0.0073);
const derivativeStep = 0.0001;
const left = pose();
step(derivativeStep);
const middle = pose();
group.userData.setTalking(true);
step(derivativeStep);
const right = pose();
const transitionVelocityJump = Math.max(...bones.map((bone, index) =>
  angularVelocity(left[index], middle[index], derivativeStep)
    .sub(angularVelocity(middle[index], right[index], derivativeStep)).length()));
assert.ok(transitionVelocityJump < 0.05, "Conversation blend keeps velocity continuous");
for (let i = 0; i < 65; i++) step(1 / 60);
group.userData.setTalking(false);
step(1 / 60);
before = pose();
group.userData.setTalking(true);
step(0);
const rapidReopenJump = difference(before);
assert.ok(rapidReopenJump < 1e-5, "Rapid close/reopen cannot restart a visible gesture phase");
group.userData.setTalking(false);
for (let i = 0; i < 180; i++) step(1 / 60);

// A synchronized controller without attention isolates the additive head layer.
idleControl.setTalking(true);
group.userData.setTalking(true);
const target = new THREE.Vector3(8, 6, -4).applyMatrix4(group.matrixWorld);
before = pose();
group.userData.setAttention(target);
step(0);
assert.ok(difference(before) < 1e-5, "Attention starts without a head pose snap");
for (let i = 0; i < 180; i++) step(1 / 60);
const head = byName.get("spine.006"), controlHead = controlByName.get("spine.006");
const groupRotation = group.getWorldQuaternion(new THREE.Quaternion());
const headCorrection = groupRotation.clone().invert()
  .multiply(head.getWorldQuaternion(new THREE.Quaternion()))
  .multiply(controlHead.getWorldQuaternion(new THREE.Quaternion()).invert())
  .multiply(groupRotation).normalize();
const lookAngles = new THREE.Euler().setFromQuaternion(headCorrection, "YXZ");
assert.ok(Math.abs(lookAngles.y) <= Math.PI / 9 + 1e-4, "Head yaw stays within 20 degrees");
assert.ok(Math.abs(lookAngles.x) <= Math.PI / 18 + 1e-4, "Head pitch stays within 10 degrees");
assert.ok(lookAngles.y < -0.02 && lookAngles.x > 0.02, "Negative-Z facing model looks toward the viewer");
for (const bone of bones) {
  if (bone !== head) assert.ok(bone.quaternion.angleTo(controlByName.get(bone.name).quaternion) < 1e-4,
    `Attention leaves other local bone motion unchanged: ${bone.name}`);
}
before = pose();
group.userData.setAttention({ x: NaN, y: 0, z: 0 });
step(0);
assert.ok(difference(before) < 1e-5, "Invalid attention target clears smoothly");
for (let i = 0; i < 180; i++) step(1 / 60);
assert.ok(head.quaternion.angleTo(controlHead.quaternion) < 1e-4, "Head returns smoothly from attention");
group.userData.setAttention(target);
idleControl.setTalking(false);
group.userData.setTalking(false);
for (let i = 0; i < 180; i++) step(1 / 60);
assert.ok(head.quaternion.angleTo(controlHead.quaternion) < 1e-4, "Idle does not keep tracking the viewer");
assert.ok(maximumFootDrift < 0.0005,
  `Feet stay at exhibit placement after scale/rotation; drift=${maximumFootDrift}`);
assert.equal(geometryHash(), originalGeometry, "Animation does not modify geometry/skin data");
assert.equal(bones.length, sourceBoneNames.length);
assert.equal(bindingHash(), nativeBindings, "Motion preserves original skin bindings");
console.log("PASS: exact GLB native/fallback decode, corrupt-data rejection, native rig/materials/bindings, loops, C1 crossfade and attention");
console.log(JSON.stringify({ modelBytes: glb.byteLength, modelSha256: modelHash,
  compressedBytes: compressedModel.byteLength, bones: bones.length, changedBones: changedBones.size,
  sheenMaterials, unlitMaterials, maximumFootDrift, rootMotion, maximumIdleStep, maximumTalkDifference,
  maximumConversationStep, loopVelocityJumps, transitionVelocityJump, rapidReopenJump,
  attentionYawDegrees: lookAngles.y * 180 / Math.PI, attentionPitchDegrees: lookAngles.x * 180 / Math.PI }));
