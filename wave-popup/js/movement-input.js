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

// Track physical keys and pointers separately; releases never depend on IME text.
/* [한국어 해설]
 * held Map은 입력 출처→방향을 저장한다. W와 ArrowUp을 동시에 눌러도 하나를 놓는 것만으로 전진이 멈추지 않는다.
 * 포인터는 pointer:ID 접두사로 키보드와 충돌하지 않게 구분한다. 변경 때 onChange로 UI를 갱신한다.
 */
export function createMovementInput(onChange = () => {}) {
  const held = new Map();
  return {
    has(direction) {
      return [...held.values()].includes(direction);
    },
    clear() {
      held.clear();
      onChange();
    },
/* [한국어 해설]
 * Ctrl/Meta/Alt 단축키는 무시한다. 초기 키다운을 받지 못한 상태에서 반복 이벤트만 들어오면 이동을 새로 시작하지 않는다.
 */
    keyDown(event) {
      const direction = directions.get(event.code);
      if (!direction || event.ctrlKey || event.metaKey || event.altKey)
        return false;
      if (event.repeat && !held.has(event.code)) return false;
      if (held.get(event.code) === direction) return true;
      held.set(event.code, direction);
      onChange();
      return true;
    },
    keyUp(event) {
      if (held.delete(event.code)) onChange();
    },
    pointerDown(id, direction) {
      held.set(`pointer:${id}`, direction);
      onChange();
    },
    pointerUp(id) {
      if (held.delete(`pointer:${id}`)) onChange();
    },
  };
}

/* [한국어 해설]
 * 이동 속도는 초당 월드 단위다. 기본 4, Shift 달리기 7.5. 실제 프레임 이동량은 app.js에서 dt와 곱한다.
 */
export function movementSpeed(input) {
  return input.has("sprint") ? 7.5 : 4;
}
