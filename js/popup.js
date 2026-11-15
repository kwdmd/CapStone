import { initTouchGuide } from "./touch-controls.js";
import { initCart } from "./cart.js";
import config from "../data/project.json";
import { startScene } from "./scene.js";
// 초기 시점과 소리 설정은 data/project.json에서 변경한다. 실제 음원은 아직 연결하지 않았다.
const state = { view: config.initialView, soundEnabled: config.soundEnabled };
const viewButton = document.getElementById("viewButton");
const soundButton = document.getElementById("soundButton");
// 아이콘은 현재 상태를, 접근성 이름은 클릭 시 수행할 동작을 표시한다.
function renderControls() {
  const third = state.view === "third-person";
  // [구조 설명] 기본 SVG 도형은 고정하고 숫자와 상태 표시만 전환한다. 시점 숫자는 현재 상태다.
  viewButton.dataset.view = third ? "third" : "first";
  document.getElementById("cameraStateText").textContent = third ? "3P" : "1P";
  viewButton.setAttribute(
    "aria-label",
    third ? "1인칭으로 전환" : "3인칭으로 전환",
  );
  viewButton.title = viewButton.getAttribute("aria-label");
  soundButton.dataset.sound = state.soundEnabled ? "on" : "off";
  soundButton.setAttribute(
    "aria-label",
    state.soundEnabled ? "소리 끄기" : "소리 켜기",
  );
  soundButton.title = soundButton.getAttribute("aria-label");
  soundButton.setAttribute("aria-pressed", String(state.soundEnabled));
}
// scene.js에서 이벤트를 받아 실제 카메라를 전환한다.
viewButton.addEventListener("click", () => {
  state.view = state.view === "third-person" ? "first-person" : "third-person";
  renderControls();
  document.dispatchEvent(
    new CustomEvent("popup:view-change", { detail: state.view }),
  );
});
/* [구조 설명] 소리 상태를 반전하고 boolean 값을 이벤트로 전달한다.
[확장 위치] 음원 모듈은 popup:sound-change를 구독한다. 현재 ON 표시는 설정 상태만 뜻하며 실제 재생은 하지 않는다. */
soundButton.addEventListener("click", () => {
  state.soundEnabled = !state.soundEnabled;
  renderControls();
  document.dispatchEvent(
    new CustomEvent("popup:sound-change", { detail: state.soundEnabled }),
  );
});
// [구조 설명] JSON을 빌드에 포함하므로 로컬 파일에서도 동일한 설정을 사용한다.
document.title =
  config.pageTitle === config.projectName
    ? config.projectName
    : `${config.pageTitle} · ${config.projectName}`;

// [직접 수정] projectNameLines 배열의 각 항목을 한 줄로 표시한다.
const brandName = document.getElementById("projectName");
brandName.replaceChildren();
(config.projectNameLines || [config.projectName]).forEach((line, index) => {
  if (index) brandName.append(document.createElement("br"));
  brandName.append(document.createTextNode(line));
});
document.querySelector(".brand").setAttribute("aria-label", config.projectName);
const visibilityButton = document.getElementById("visibilityButton");
visibilityButton.addEventListener("click", () => {
  const hidden = document
    .querySelector(".popup")
    .classList.toggle("details-hidden");
  visibilityButton.setAttribute("aria-pressed", String(!hidden));
  visibilityButton.title = hidden ? "조작 안내 표시" : "조작 안내 숨기기";
  visibilityButton.setAttribute("aria-label", visibilityButton.title);
});
renderControls();
initCart();
initTouchGuide();
Promise.resolve(startScene(state.view)).catch((error) => {
  console.error(error);
  document.getElementById("sceneStatus").textContent =
    "전시장을 열 수 없습니다: " + error.message;
});
