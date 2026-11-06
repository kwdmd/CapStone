// [확장 위치] 상품 모듈에서 popup:cart-update 이벤트의 detail.items에
// [{name:'상품명', quantity:2}]를 전달하면 목록과 총 수량 배지가 함께 갱신된다.
// 현재 상품 구매/서버 기능은 없으며 처음에는 빈 장바구니다.
const basket = new Map();

// 상품 상세창과 장바구니 버튼이 같은 수량을 사용한다.
function publishCart() {
  const items = Array.from(basket.values());
  document.dispatchEvent(new CustomEvent("popup:cart-update", { detail: { items } }));
}

export function addCartItem(item) {
  const previous = basket.get(item.name);
  basket.set(item.name, { ...item, quantity: (previous?.quantity ?? 0) + item.quantity });
  publishCart();
}

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
    basket.clear();
    for (const item of items) basket.set(item.name, item);
    const count = items.reduce((sum, i) => sum + i.quantity, 0);
    badge.hidden = count === 0;
    badge.textContent = count > 99 ? "99+" : String(count);
    button.setAttribute("aria-label", `장바구니, 상품 ${count}개`);
    list.replaceChildren();
    if (!count) list.textContent = "아직 담은 상품이 없습니다.";
    for (const item of items) {
      const row = document.createElement("div");
      row.className = "cart-item";
      if (item.image) {
        const thumbnail = document.createElement("img");
        thumbnail.src = item.image;
        thumbnail.alt = "";
        row.append(thumbnail);
      }
      const label = document.createElement("span");
      label.textContent = item.name;
      const control = (symbol, action, change) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.textContent = symbol;
        btn.setAttribute("aria-label", item.name + " " + action);
        btn.onclick = event => {
          event.stopPropagation();
          change();
          publishCart();
          const next = [...list.querySelectorAll("button")].find(b =>
            !b.disabled && b.getAttribute("aria-label") === btn.getAttribute("aria-label"));
          (next || list.querySelector("button:not(:disabled)") || button).focus();
        };
        return btn;
      };
      const stepper = document.createElement("span");
      stepper.className = "cart-stepper";
      const minus = control("−", "수량 줄이기", () => basket.set(item.name, { ...item, quantity: item.quantity - 1 }));
      minus.disabled = item.quantity <= 1;
      const plus = control("+", "수량 늘리기", () => {
        basket.set(item.name, { ...item, quantity: item.quantity + 1 });
      });
      stepper.append(minus, String(item.quantity), plus);
      // 상품별 금액은 단가 × 현재 수량으로 계산해 수량 변경 때 함께 갱신한다.
      const price = document.createElement("span");
      price.className = "cart-price";
      price.textContent = Number.isFinite(item.price) && item.price >= 0
        ? (item.price * item.quantity).toLocaleString("ko-KR") + "원"
        : "가격 준비 중";
      label.append(price, stepper);
      const remove = control("×", "삭제", () => basket.delete(item.name));
      remove.className = "cart-remove";
      row.append(label, remove);
      list.append(row);
    }
  });
}
