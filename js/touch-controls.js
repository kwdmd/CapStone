import { applyLookDelta } from "./camera-controls.js";

// [직접 수정] 중심 12%는 정지, 반경 72% 이상 밀면 달리기. 복귀는 64%로 떨림을 방지한다.
export function joystickVector(x, y, radius, wasRunning = false) {
  const distance = Math.hypot(x, y);
  const amount = Math.min(1, distance / radius);
  if (amount < 0.12) return { x: 0, z: 0, sprint: false };
  return { x: x / distance, z: y / distance, sprint: amount >= (wasRunning ? 0.64 : 0.72) };
}

// 맵 로딩 전부터 모바일 안내를 표시한다. 갤럭시 탭도 같은 문구를 사용한다.
export function initTouchGuide() {
  const enabled = navigator.maxTouchPoints > 0 || matchMedia("(any-pointer: coarse)").matches;
  if (!enabled) return;
  document.documentElement.classList.add("touch-device");
  const guide = document.querySelector(".move-guide");
  if (guide) guide.textContent = "조이스틱 살짝 밀기: 걷기 · 끝까지 밀기: 달리기\n한 손가락 드래그: 시점 회전\n두 손가락 벌리기·오므리기: 3인칭 확대·축소";
}

export function bindTouchControls(host, canvas, player, input, zoom) {
  // 화면 폭이나 UA 대신 터치 기능으로 판별하여 데스크톱 모드의 갤럭시 탭도 포함한다.
  const enabled = navigator.maxTouchPoints > 0 || matchMedia("(any-pointer: coarse)").matches;
  if (!enabled) return;
  document.documentElement.classList.add("touch-device");
  const pad = document.createElement("div");
  pad.className = "touch-joystick";
  pad.setAttribute("aria-label", "이동 조이스틱: 바깥쪽까지 밀면 달리기");
  pad.innerHTML = '<span class="joystick-ring"></span><span class="joystick-knob"></span><span class="joystick-label">걷기 / 달리기</span>';
  host.parentElement.append(pad);
  const knob = pad.querySelector(".joystick-knob");
  let stickId = null, running = false;
  const fingers = new Map();
  const blocked = () => host.dataset.dialogueOpen === "true" || !!document.querySelector("dialog[open]");
  const reset = () => {
    stickId = null; running = false; fingers.clear();
    input.setTouch(0, 0);
    knob.style.transform = "translate(-50%, -50%)";
    pad.classList.remove("running");
  };
  const moveStick = e => {
    const rect = pad.getBoundingClientRect();
    const radius = rect.width * 0.36;
    const x = e.clientX - rect.left - rect.width / 2;
    const y = e.clientY - rect.top - rect.height / 2;
    const vector = joystickVector(x, y, radius, running);
    running = vector.sprint;
    input.setTouch(vector.x, vector.z, running);
    const scale = Math.min(1, radius / (Math.hypot(x, y) || 1));
    knob.style.transform = `translate(calc(-50% + ${x * scale}px), calc(-50% + ${y * scale}px))`;
    pad.classList.toggle("running", running);
  };
  pad.addEventListener("pointerdown", e => {
    if (stickId !== null || blocked()) return;
    e.preventDefault(); stickId = e.pointerId;
    pad.setPointerCapture(stickId); moveStick(e);
  });
  pad.addEventListener("pointermove", e => { if (e.pointerId === stickId) moveStick(e); });
  for (const type of ["pointerup", "pointercancel", "lostpointercapture"])
    pad.addEventListener(type, e => { if (e.pointerId === stickId) reset(); });
  const distance = () => {
    const [a, b] = [...fingers.values()];
    return b ? Math.hypot(a.x - b.x, a.y - b.y) : 0;
  };
  canvas.addEventListener("pointerdown", e => {
    if (e.pointerType !== "touch" || blocked()) return;
    e.preventDefault();
    fingers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener("pointermove", e => {
    const last = fingers.get(e.pointerId);
    if (!last) return;
    if (blocked()) { reset(); return; }
    const before = distance();
    fingers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (fingers.size === 1) applyLookDelta(player, e.clientX - last.x, e.clientY - last.y);
    else if (fingers.size === 2) zoom((before - distance()) * 3);
  });
  for (const type of ["pointerup", "pointercancel", "lostpointercapture"])
    canvas.addEventListener(type, e => fingers.delete(e.pointerId));
  window.addEventListener("blur", reset);
  window.addEventListener("orientationchange", reset);
  document.addEventListener("visibilitychange", reset);
  document.addEventListener("popup:view-change", reset);
  new MutationObserver(() => {
    pad.hidden = blocked();
    if (blocked()) reset();
  }).observe(host, { attributes: true, attributeFilter: ["data-dialogue-open"] });

}
