import { applyLookDelta } from "./camera-controls.js";
// [구조 설명] 키보드·드래그 입력 바인딩. 시점 전환 시 reset으로 입력을 초기화한다.
export function bindSceneInput(host, canvas, player, input) {
  let drag = null;
  const reset = () => {
    input.clear();
    drag = null;
  };
  window.addEventListener("keydown", (event) => {
    // [구조 설명] 상단 아이콘에 포커스가 남아 있어도 이동 키는 받는다.
    // 입력 필드와 다른 버튼에서는 입력/키보드 조작을 우선한다.
    const target = event.target;
    if (target.isContentEditable || target.closest("input,textarea,select"))
      return;
    if (target.closest("button") && !target.closest(".icon-controls")) return;
    if (input.keyDown(event)) event.preventDefault();
  });
  window.addEventListener("keyup", (event) => input.keyUp(event), true);
  window.addEventListener("blur", reset);
  document.addEventListener("visibilitychange", reset);
  canvas.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) return;
    host.focus();
    drag = { x: event.clientX, y: event.clientY };
    canvas.setPointerCapture(event.pointerId);
  });
  canvas.addEventListener("pointermove", (event) => {
    if (!drag) return;
    applyLookDelta(player, event.clientX - drag.x, event.clientY - drag.y);
    drag = { x: event.clientX, y: event.clientY };
  });
  for (const type of ["pointerup", "pointercancel", "lostpointercapture"])
    canvas.addEventListener(type, () => (drag = null));
  return reset;
}
