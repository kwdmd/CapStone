import { bindProductDetail, products } from "./product-detail.js";
import profiles from "../data/npc-dialogues.json" with { type: "json" };

// 이름, 기물, 대사는 data/npc-dialogues.json에서 수정합니다.
export function bindNpcDialogue({ host, avatars, goods = [], player, reset }) {
  const panel = document.getElementById("npcDialogue");
  const prompt = document.getElementById("npcPrompt");
  const closeButton = document.getElementById("npcClose");
  const buttons = [...panel.querySelectorAll("[data-topic]")];
  // NPC 중심과 플레이어 사이의 수평 거리. 안내 표시와 F 입력에 함께 적용합니다.
  const interactionDistance = 3;
  let active = null;
  // 화면 검수 전용: ?npcPreview=knight|rook|pawn-b. 일반 접속에는 영향을 주지 않는다.
  const previewId = typeof location !== "undefined" ? new URLSearchParams(location.search).get("npcPreview") : null;
  let previewOpened = false;
  const detail = goods.length ? bindProductDetail(host, reset) : null;
  const targets = () => [...avatars, ...goods];
  const nearest = () => targets().filter(a => Math.abs(a.position.y-player.y)<3)
    .map(a => ({a, d: Math.hypot(a.position.x-player.x,a.position.z-player.z)}))
    .filter(v => v.d <= interactionDistance).sort((a,b)=>a.d-b.d)[0]?.a;
  function topic(key) {
    const profile = profiles[active];
    const answer = profile.topics[Number(key)];
    const touch = typeof navigator !== "undefined" && navigator.maxTouchPoints > 0
      || (typeof matchMedia === "function" && matchMedia("(any-pointer: coarse)").matches);
    document.getElementById("npcText").textContent = key === "intro" ? profile.intro
      : (touch && answer.mobileText ? answer.mobileText : answer.text);
    buttons.forEach(b => b.setAttribute("aria-pressed", String(b.dataset.topic === key)));
  }
  function open(avatar) {
    if (!avatar || active || detail?.isOpen()) return;
    if (avatar.userData.productId) {
      prompt.hidden = true;
      detail.show(avatar);
      return;
    }
    active = avatar.userData.npcId;
    const profile = profiles[active];
    if (!profile) { active = null; return; }
    reset();
    host.dataset.dialogueOpen = "true";
    document.querySelector(".popup").classList.add("dialogue-open");
    document.getElementById("npcName").textContent = profile.name;
    document.getElementById("npcSymbol").textContent = profile.symbol;
    document.getElementById("npcPiece").textContent = profile.piece.replace(" · ", "\n");
    // 질문과 답변·닫기 문구는 JSON에서 수정한다. NPC마다 질문 개수가 달라도 대응한다.
    buttons.forEach((button, index) => {
      button.dataset.topic = String(index);
      button.hidden = !profile.topics[index];
      button.textContent = profile.topics[index]?.label || "";
    });
    // [직접 수정] 닫기 아이콘은 모든 NPC에 공통 적용합니다. 접근성 이름은 별도로 유지합니다.
    closeButton.textContent = "×";
    closeButton.setAttribute("aria-label", "NPC 대화창 닫기");
    closeButton.title = "대화창 닫기 (Esc)";
    topic("intro"); panel.hidden = false; prompt.hidden = true;
    buttons[0].focus();
  }
  function close() {
    if (!active) return;
    active = null; panel.hidden = true;
    host.dataset.dialogueOpen = "false";
    document.querySelector(".popup").classList.remove("dialogue-open");
    reset(); host.focus();
  }
  buttons.forEach(b=>b.addEventListener("click",()=>topic(b.dataset.topic)));
  prompt.addEventListener("click", () => open(nearest()));
  closeButton.addEventListener("click",close);
  window.addEventListener("keydown", e => {
    if (e.code === "Escape" && active) { e.preventDefault(); close(); return; }
    if (e.repeat || e.ctrlKey || e.altKey || e.metaKey || e.target.closest("input,textarea,select,[contenteditable=true]")) return;
    if (e.code === "KeyF" && !active && nearest()) { e.preventDefault(); open(nearest()); }
  });
  return { isOpen:()=>!!active || !!detail?.isOpen(), update() {
    if (!previewOpened && profiles[previewId]) {
      const avatar = avatars.find(a => a.userData.npcId === previewId);
      if (avatar) { open(avatar); previewOpened = true; }
    }
    const nearby=active || detail?.isOpen() ? null : nearest();
    prompt.hidden=!nearby;
    if (nearby) {
      const product = products[nearby.userData.productId];
      prompt.textContent = product ? "F · " + product.name + " 보기" : "F · " + profiles[nearby.userData.npcId].name + "와 대화";
    }
  }};
}
