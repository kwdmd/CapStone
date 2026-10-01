// [확장 위치] 상품 모듈에서 popup:cart-update 이벤트의 detail.items에
// [{name:'상품명', quantity:2}]를 전달하면 목록과 총 수량 배지가 함께 갱신된다.
// 현재 상품 구매/서버 기능은 없으며 처음에는 빈 장바구니다.
export function initCart() {
  const button = document.getElementById("cartButton");
  const panel = document.getElementById("cartPanel");
  const badge = document.getElementById("cartBadge");
  const list = document.getElementById("cartItems");
  const close = () => {
    panel.hidden = true;
    button.setAttribute("aria-expanded", "false");
  };
  button.addEventListener("click", () => {
    panel.hidden = !panel.hidden;
    button.setAttribute("aria-expanded", String(!panel.hidden));
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !panel.hidden) {
      close();
      button.focus();
    }
  });
  document.addEventListener("click", (e) => {
    if (!panel.contains(e.target) && !button.contains(e.target)) close();
  });
  document.addEventListener("popup:cart-update", (e) => {
    if (!Array.isArray(e.detail?.items)) return;
    const items = e.detail.items.filter(
      (i) =>
        i &&
        typeof i.name === "string" &&
        Number.isSafeInteger(i.quantity) &&
        i.quantity > 0,
    );
    const count = items.reduce((sum, i) => sum + i.quantity, 0);
    badge.hidden = count === 0;
    badge.textContent = count > 99 ? "99+" : String(count);
    button.setAttribute("aria-label", `장바구니, 상품 ${count}개`);
    list.replaceChildren();
    if (!count) list.textContent = "아직 담은 상품이 없습니다.";
    for (const item of items) {
      const row = document.createElement("p");
      row.textContent = `${item.name} × ${item.quantity}`;
      list.append(row);
    }
  });
}
