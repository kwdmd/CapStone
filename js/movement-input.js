/* [한국어 해설]
 * event.key 대신 물리 키 위치인 event.code를 매핑하므로 한글 입력 상태에서도 WASD가 같은 방향으로 동작한다.
 */
const directions = new Map([
  ["KeyW", "up"],
  ["ArrowUp", "up"],
  ["KeyS", "down"],
  ["ArrowDown", "down"],
  ["KeyA", "left"],
  ["ArrowLeft", "left"],
  ["KeyD", "right"],
  ["ArrowRight", "right"],
  ["ShiftLeft", "sprint"],
  ["ShiftRight", "sprint"],
]);

// [구조 설명] 물리 키 기준으로 입력을 추적하여 한글 입력 상태에서도 키 해제가 동작한다.
/* [한국어 해설]
 * held Map은 입력 출처→방향을 저장한다. W와 ArrowUp을 동시에 눌러도 하나를 놓는 것만으로 전진이 멈추지 않는다.
 * 입력 변경 때 onChange를 호출한다.
 */
function inputCode(event) {
  if (event.key === "Shift" || event.code === "Shift" || event.keyCode === 16) {
    if (event.location === 2) return "ShiftRight";
    if (event.location === 1) return "ShiftLeft";
    if (event.code === "ShiftLeft" || event.code === "ShiftRight") return event.code;
    return "ShiftUnknown";
  }
  return event.code;
}
directions.set("ShiftUnknown", "sprint");

export function createMovementInput(onChange = () => {}) {
  const held = new Map();
  let modifierShift = false;
  function syncShift(event) {
    if (typeof event.shiftKey !== "boolean") return;
    modifierShift = event.shiftKey;
    if (!modifierShift) for (const [code, direction] of held) {
      if (direction === "sprint") held.delete(code);
    }
  }
  let touch = { x: 0, z: 0, sprint: false };
  return {
    setTouch(x, z, sprint = false) { touch = { x, z, sprint }; onChange(); },
    axes() {
      return { x: Number(this.has("right")) - Number(this.has("left")) + touch.x,
        z: Number(this.has("down")) - Number(this.has("up")) + touch.z };
    },
    has(direction) {
      if (direction === "sprint" && (touch.sprint || modifierShift)) return true;
      return [...held.values()].includes(direction);
    },
    clear() {
      held.clear();
      modifierShift = false;
      touch = { x: 0, z: 0, sprint: false };
      onChange();
    },
    /* [한국어 해설]
     * Ctrl/Meta/Alt 단축키는 무시한다. 초기 키다운을 받지 못한 상태에서 반복 이벤트만 들어오면 이동을 새로 시작하지 않는다.
     */
    keyDown(event) {
      const code = inputCode(event);
      const direction = directions.get(code);
      if (!direction || event.ctrlKey || event.metaKey || event.altKey)
        return false;
      syncShift(event);
      if (event.repeat && !held.has(code)) return false;
      if (held.get(code) === direction) return true;
      held.set(code, direction);
      onChange();
      return true;
    },
    keyUp(event) {
      const previousSprint = this.has("sprint");
      const removed = held.delete(inputCode(event));
      syncShift(event);
      if (removed || previousSprint !== this.has("sprint")) onChange();
    },
  };
}
