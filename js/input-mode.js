export function chooseInputMode({userAgent = "", platform = "", maxTouchPoints = 0} = {}) {
  const mobile = /Android|iPhone|iPad|iPod/i.test(userAgent) ||
    (/Mac/i.test(platform) && maxTouchPoints > 1 && !/Windows/i.test(userAgent));
  return mobile ? "touch" : "pc";
}
export function isTouchMode() {
  return chooseInputMode(typeof navigator === "undefined" ? {} : navigator) === "touch";
}
export function initInputMode() {
  const touch = isTouchMode();
  document.documentElement.classList.toggle("touch-device", touch);
  document.documentElement.dataset.inputMode = touch ? "touch" : "pc";
  const guide = document.querySelector(".move-guide");
  if (guide && touch) guide.textContent = "밀어서 이동 · 달리기\n드래그로 둘러보기\n두 손가락으로 확대·축소";
}
