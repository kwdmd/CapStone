import * as THREE from "../vendor/three.module.js";
import { gunzipSync, strFromU8 } from "../vendor/fflate.module.js";
import { decodeBase64 } from "./base64.js";
import packedMotion from "../data/knight-motion.json" with { type: "json" };

let sharedMotion;
function motionData() {
  sharedMotion ??= JSON.parse(strFromU8(gunzipSync(decodeBase64(packedMotion.data))));
  return sharedMotion;
}

function frameAt(clip, time, result) {
  const times = clip.times;
  let low = 0, high = times.length - 1;
  while (low + 1 < high) {
    const middle = (low + high) >>> 1;
    if (times[middle] <= time) low = middle;
    else high = middle;
  }
  result.a = low;
  result.b = high;
  result.blend = (time - times[low]) / (times[high] - times[low]);
}

// Exact critically damped spring. Keeping velocity on target changes avoids
// a sudden velocity change into a new pose and remains stable at different frame rates.
function advanceSpring(state, target, frequency, dt) {
  const offset = state.value - target;
  const momentum = state.velocity + frequency * offset;
  const decay = Math.exp(-frequency * dt);
  state.value = target + (offset + momentum * dt) * decay;
  state.velocity = (state.velocity - frequency * momentum * dt) * decay;
}

// The free source clips are retargeted offline; only small quaternion tracks ship.
// Feet stay at their original exhibit positions while the pelvis shifts naturally.
export function createKnightMotion(group, bones, { forwardZ = -1, idleSway = 0.4 } = {}) {
  const data = motionData();
  const byName = new Map(bones.map(bone => [bone.name, bone]));
  const root = byName.get(data.rootBone);
  const head = byName.get("spine.006");
  const tracks = Object.entries(data.clips.idle.tracks)
    .filter(([name]) => byName.has(name))
    .map(([name, idle]) => ({ bone: byName.get(name), idle, talking: data.clips.talking.tracks[name] }));
  if (!root) throw new Error("나이트 모션의 루트 본을 찾을 수 없습니다.");
  const qb = new THREE.Quaternion();
  const idleQ = new THREE.Quaternion(), talkQ = new THREE.Quaternion();
  const idlePosition = new THREE.Vector3(), talkPosition = new THREE.Vector3();
  const positionEndpoint = new THREE.Vector3();
  const idleFrame = { a: 0, b: 1, blend: 0 }, talkFrame = { a: 0, b: 1, blend: 0 };
  const goal = new THREE.Vector3(), hipPoint = new THREE.Vector3();
  const kneePoint = new THREE.Vector3(), anklePoint = new THREE.Vector3();
  const direction = new THREE.Vector3(), pole = new THREE.Vector3();
  const kneeGoal = new THREE.Vector3(), from = new THREE.Vector3(), to = new THREE.Vector3();
  const swing = new THREE.Quaternion(), worldQ = new THREE.Quaternion(), parentQ = new THREE.Quaternion();
  const groupQ = new THREE.Quaternion();
  const attentionTarget = new THREE.Vector3(), headPoint = new THREE.Vector3();
  const lookDirection = new THREE.Vector3();
  const inverseGroupQ = new THREE.Quaternion(), attentionQ = new THREE.Quaternion();
  const attentionEuler = new THREE.Euler(0, 0, 0, "YXZ");
  const weight = { value: 0, velocity: 0 };
  const attentionYaw = { value: 0, velocity: 0 }, attentionPitch = { value: 0, velocity: 0 };
  const facing = forwardZ < 0 ? -1 : 1;
  let hasAttention = false;

  for (const bone of bones) {
    const position = data.reference.localPositions[bone.name];
    const rotation = data.reference.localQuaternions[bone.name];
    if (position) bone.position.fromArray(position);
    if (rotation) bone.quaternion.fromArray(rotation);
  }
  group.updateMatrixWorld(true);
  // Reduce only idle fore/aft translation and torso pitch around the mean pose.
  const swayTracks = new Map();
  const groupInverse = group.getWorldQuaternion(new THREE.Quaternion()).invert();
  for (const track of tracks) {
    if (!/^spine(\.00[123])?$/.test(track.bone.name)) continue;
    const mean = new THREE.Quaternion(0, 0, 0, 0);
    const first = new THREE.Quaternion().fromArray(track.idle);
    for (let i=0;i<track.idle.length-4;i+=4) {
      const q=new THREE.Quaternion().fromArray(track.idle,i);
      const sign=q.dot(first)<0?-1:1;
      mean.x+=q.x*sign;mean.y+=q.y*sign;mean.z+=q.z*sign;mean.w+=q.w*sign;
    }
    mean.normalize();
    const parentRotation=groupInverse.clone().multiply(track.bone.parent.getWorldQuaternion(new THREE.Quaternion()));
    swayTracks.set(track.bone,{mean,axis:new THREE.Vector3(1,0,0).applyQuaternion(parentRotation.invert())});
  }
  const rootMean=new THREE.Vector3();
  const rootValues=data.clips.idle.rootPositions;
  for(let i=0;i<rootValues.length-3;i+=3) rootMean.add(new THREE.Vector3().fromArray(rootValues,i));
  rootMean.multiplyScalar(1/(rootValues.length/3-1));
  const rootAxis=new THREE.Vector3(0,0,1).applyQuaternion(groupInverse.clone().multiply(root.parent.getWorldQuaternion(new THREE.Quaternion())).invert());
  const swayDelta=new THREE.Quaternion(),swayTwist=new THREE.Quaternion(),swayReduced=new THREE.Quaternion();
  const swayOffset=new THREE.Vector3();
  const legs = ["L", "R"].map(side => {
    const hip = byName.get(`thigh.${side}`), knee = byName.get(`shin.${side}`), foot = byName.get(`foot.${side}`);
    if (!hip || !knee || !foot) throw new Error("나이트 다리 본을 찾을 수 없습니다.");
    const k = group.worldToLocal(knee.getWorldPosition(new THREE.Vector3()));
    const a = new THREE.Vector3().fromArray(data.reference.footPositions[side]);
    return { hip, knee, foot, ankle: a, kneeHint: k,
      footRotation: new THREE.Quaternion().fromArray(data.reference.footQuaternions[side]) };
  });
  let idleTime = 0, talkTime = 0, talking = false;

  function sampleRotation(values, frame, result) {
    return result.fromArray(values, frame.a * 4)
      .slerp(qb.fromArray(values, frame.b * 4), frame.blend).normalize();
  }
  function samplePosition(clip, frame, result) {
    return result.fromArray(clip.rootPositions, frame.a * 3)
      .lerp(positionEndpoint.fromArray(clip.rootPositions, frame.b * 3), frame.blend);
  }
  function aim(bone, sourceDirection, targetDirection) {
    if (sourceDirection.lengthSq() < 1e-12 || targetDirection.lengthSq() < 1e-12) return;
    swing.setFromUnitVectors(sourceDirection.normalize(), targetDirection.normalize());
    bone.getWorldQuaternion(worldQ);
    bone.parent.getWorldQuaternion(parentQ);
    bone.quaternion.copy(parentQ.invert().multiply(swing.multiply(worldQ))).normalize();
    bone.updateWorldMatrix(false, true);
  }
  function plantFeet() {
    group.updateMatrixWorld(true);
    group.getWorldQuaternion(groupQ);
    for (const leg of legs) {
      goal.copy(leg.ankle).applyMatrix4(group.matrixWorld);
      leg.hip.getWorldPosition(hipPoint);
      leg.knee.getWorldPosition(kneePoint);
      leg.foot.getWorldPosition(anklePoint);
      const upperLength = hipPoint.distanceTo(kneePoint), lowerLength = kneePoint.distanceTo(anklePoint);
      direction.subVectors(goal, hipPoint);
      const distance = Math.max(1e-6, Math.min(direction.length(), upperLength + lowerLength - 1e-7));
      direction.normalize();
      pole.copy(leg.kneeHint).applyMatrix4(group.matrixWorld).sub(hipPoint);
      pole.addScaledVector(direction, -pole.dot(direction));
      if (pole.lengthSq() < 1e-12) pole.set(0, 0, -1).applyQuaternion(groupQ)
        .addScaledVector(direction, -pole.dot(direction));
      pole.normalize();
      const along = (upperLength ** 2 - lowerLength ** 2 + distance ** 2) / (2 * distance);
      const height = Math.sqrt(Math.max(0, upperLength ** 2 - along ** 2));
      kneeGoal.copy(hipPoint).addScaledVector(direction, along).addScaledVector(pole, height);
      aim(leg.hip, from.subVectors(kneePoint, hipPoint), to.subVectors(kneeGoal, hipPoint));
      leg.knee.getWorldPosition(kneePoint);
      leg.foot.getWorldPosition(anklePoint);
      aim(leg.knee, from.subVectors(anklePoint, kneePoint), to.subVectors(goal, kneePoint));
      leg.foot.parent.getWorldQuaternion(parentQ);
      leg.foot.quaternion.copy(parentQ.invert().multiply(worldQ.copy(groupQ).multiply(leg.footRotation))).normalize();
      leg.foot.updateWorldMatrix(false, true);
    }
  }
  function followAttention(step) {
    if (!head) return;
    let yaw = 0, pitch = 0;
    if (talking && hasAttention) {
      head.getWorldPosition(headPoint);
      lookDirection.subVectors(attentionTarget, headPoint)
        .applyQuaternion(inverseGroupQ.copy(groupQ).invert());
      const horizontal = Math.hypot(lookDirection.x, lookDirection.z);
      if (lookDirection.lengthSq() > 1e-12) {
        if (horizontal > 1e-6) yaw = THREE.MathUtils.clamp(
          Math.atan2(facing * lookDirection.x, facing * lookDirection.z), -Math.PI / 9, Math.PI / 9);
        pitch = THREE.MathUtils.clamp(-facing * Math.atan2(lookDirection.y, horizontal),
          -Math.PI / 18, Math.PI / 18);
      }
    }
    advanceSpring(attentionYaw, yaw, 10, step);
    advanceSpring(attentionPitch, pitch, 10, step);
    if (Math.abs(attentionYaw.value) < 1e-9 && Math.abs(attentionPitch.value) < 1e-9) return;
    attentionEuler.set(attentionPitch.value, attentionYaw.value, 0, "YXZ");
    attentionQ.copy(groupQ).multiply(swing.setFromEuler(attentionEuler))
      .multiply(inverseGroupQ.copy(groupQ).invert());
    head.getWorldQuaternion(worldQ);
    head.parent.getWorldQuaternion(parentQ);
    head.quaternion.copy(parentQ.invert().multiply(attentionQ).multiply(worldQ)).normalize();
    head.updateWorldMatrix(false, true);
  }
  function update(dt) {
    const step = Number.isFinite(dt) ? Math.max(0, Math.min(dt, 0.1)) : 0;
    idleTime = (idleTime + step) % data.clips.idle.duration;
    talkTime = (talkTime + step) % data.clips.talking.duration;
    advanceSpring(weight, talking ? 1 : 0, 12, step);
    const talkWeight = THREE.MathUtils.clamp(weight.value, 0, 1);
    frameAt(data.clips.idle, idleTime, idleFrame);
    frameAt(data.clips.talking, talkTime, talkFrame);
    for (const track of tracks) {
      sampleRotation(track.idle, idleFrame, idleQ);
      const sway=swayTracks.get(track.bone);
      if(sway && idleSway!==1){
        swayDelta.copy(idleQ).multiply(sway.mean.clone().invert());
        const projection=swayDelta.x*sway.axis.x+swayDelta.y*sway.axis.y+swayDelta.z*sway.axis.z;
        swayTwist.set(sway.axis.x*projection,sway.axis.y*projection,sway.axis.z*projection,swayDelta.w).normalize();
        swayReduced.identity().slerp(swayTwist,idleSway);
        idleQ.copy(swayDelta.multiply(swayTwist.invert()).multiply(swayReduced).multiply(sway.mean)).normalize();
      }
      sampleRotation(track.talking, talkFrame, talkQ);
      track.bone.quaternion.copy(idleQ.slerp(talkQ, talkWeight));
    }
    samplePosition(data.clips.idle, idleFrame, idlePosition);
    swayOffset.copy(idlePosition).sub(rootMean);
    idlePosition.addScaledVector(rootAxis,-(1-idleSway)*swayOffset.dot(rootAxis));
    samplePosition(data.clips.talking, talkFrame, talkPosition);
    root.position.copy(idlePosition.lerp(talkPosition, talkWeight));
    plantFeet();
    followAttention(step);
  }
  update(0);
  return {
    update,
    setIdleSway(value) { idleSway=THREE.MathUtils.clamp(value,0,1); },
    setTalking(value) {
      talking = Boolean(value);
    },
    // Pass the player's head/eye world position. Null clears attention smoothly.
    setAttention(point) {
      hasAttention = !!point && Number.isFinite(point.x) && Number.isFinite(point.y) && Number.isFinite(point.z);
      if (hasAttention) attentionTarget.copy(point);
    },
  };
}
