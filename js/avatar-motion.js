import * as THREE from "../vendor/three.module.js";
import packed from "../data/avatar-clips.json" with { type: "json" };
import settings from "../data/motion-settings.json" with { type: "json" };
import { gunzipSync, strFromU8 } from "../vendor/fflate.module.js";
import { createLocomotionState } from "./locomotion-state.js";

// [구조 설명] 메시와 텍스처를 복제하지 않고 기존 본에 대기·걷기·달리기 클립을 적용한다.
export const playerClips = JSON.parse(
  strFromU8(
    gunzipSync(Uint8Array.from(atob(packed.data), (c) => c.charCodeAt(0))),
  ),
).clips;

export function createAvatarMotion(bones, updateGarments) {
  const selectState = createLocomotionState();
  const rest = bones.map((b) => b.quaternion.clone());
  const from = rest.map((q) => q.clone());
  // 위치 트랙이 있는 팔·망토 본만 보간한다. 쇄골과 목 뒤는 원래 자세를 따른다.
  const translatedJoints = bones.filter(b => Object.values(playerClips).some(clip => clip.positions?.[b.name]))
    .map(bone => ({ bone, rest: bone.position.clone(), from: bone.position.clone() }));
  const target = new THREE.Vector3(), nextPosition = new THREE.Vector3();
  const qa = new THREE.Quaternion(),
    qb = new THREE.Quaternion();
  let state = "idle",
    time = 0,
    blend = 0;
  const update = (dt, speed = 0, running = false) => {
    dt = Math.max(0, Math.min(dt, 0.1));
    const next = selectState(dt, { speed, running });
    if (next !== state) {
      // 전환 도중 다시 전환해도 현재 자세에서 출발하여 튀는 현상을 줄인다.
      bones.forEach((b, i) => from[i].copy(b.quaternion));
      for (const joint of translatedJoints) joint.from.copy(joint.bone.position);
      state = next;
      time = 0;
      blend = 0;
    }
    const clip = playerClips[state];
    const rate =
      state === "idle"
        ? 1
        : THREE.MathUtils.clamp(
            speed / settings.referenceSpeed[state],
            settings.minimumPlaybackRate,
            settings.maximumPlaybackRate,
          );
    time = (time + dt * rate) % clip.duration;
    blend = Math.min(1, blend + dt / settings.transitionSeconds);
    const frame = time * clip.fps;
    const a = Math.floor(frame) % clip.frames,
      b = (a + 1) % clip.frames;
    const fraction = frame - Math.floor(frame);
    const eased = blend * blend * (3 - 2 * blend);
    bones.forEach((bone, i) => {
      const values = clip.tracks[bone.name];
      if (values)
        qa.fromArray(values, a * 4).slerp(
          qb.fromArray(values, b * 4),
          fraction,
        );
      else qa.copy(rest[i]);
      bone.quaternion.copy(from[i]).slerp(qa, eased);
    });
    for (const joint of translatedJoints) {
      const positions = clip.positions?.[joint.bone.name];
      if (positions) target.fromArray(positions, a*3).lerp(nextPosition.fromArray(positions, b*3), fraction);
      else target.copy(joint.rest);
      joint.bone.position.lerpVectors(joint.from, target, eased);
    }
    updateGarments?.(state, a, b, fraction, eased);
    update.state = state;
    update.phase = time / clip.duration;
    return state;
  };
  update.state = state;
  update.phase = 0;
  return update;
}
