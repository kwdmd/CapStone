// 지형과 관계없이 실제 이동량과 Shift 입력으로 대기·걷기·달리기를 선택한다.
export function createLocomotionState() {
  return (_dt, { speed = 0, running = false } = {}) => {
    if (speed < 0.05) return "idle";
    return running ? "run" : "walk";
  };
}
