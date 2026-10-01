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
  };
}
