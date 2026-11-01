import { addCartItem } from "./cart.js";
import { createProductOrbit } from "./product-orbit.js";

const commonSpec = "SIZE: 12 × 15cm\n소재: 아크릴";

export const products = {
  "queen": {
    image: "assets/products/queen_2D.png",
    "name": "QUEEN 아크릴 스탠드",
    "price": 16000,
    "spec": commonSpec,
    "description": "가로와 세로, 대각선을 자유롭게 누비는 퀸.\n왕관과 붉은 드레스를 갖춘 퀸을 체스판 무늬 받침대에 세워 보세요."
  },
  "king": {
    image: "assets/products/king_2D.png",
    "name": "KING 아크릴 스탠드",
    "price": 16000,
    "spec": commonSpec,
    "description": "한 번에 한 칸씩 움직이는 킹은 마지막까지 지켜야 할 기물이에요.\n킹을 책상 위에 세우거나 퀸 스탠드와 나란히 전시해 보세요."
  },
  "bishop": {
    image: "assets/products/bishop_2D.png",
    "name": "BISHOP 키링",
    "price": 16000,
    "spec": commonSpec,
    "description": "같은 색 칸을 따라 대각선으로 움직이는 비숍.\n가방이나 열쇠에 달아 전시장에서 만난 비숍과 일상을 함께해 보세요."
  }
};

export function bindProductDetail(host, reset) {
  const dialog = document.getElementById("productDetail");
  const find = selector => dialog.querySelector(selector);
  const holder = find(".product-photo");
  const [minus, plus] = dialog.querySelectorAll(".product-stepper button");
  const close = find(".product-close");
  const feedback = find(".product-feedback");
  let product, quantity, selectedGroup, orbit;
  const modeButtons = [...dialog.querySelectorAll(".view-ticket button")];
  function setMode(mode) {
    const hint = find(".orbit-hint");
    hint.textContent = "";
    if (mode === "3d") {
      try {
        orbit ??= createProductOrbit();
        orbit.show(holder, selectedGroup);
        hint.textContent = "드래그해서 상품을 돌려보세요";
      } catch {
        mode = "2d";
        hint.textContent = "3D 보기를 열 수 없어 정면 이미지를 표시합니다.";
      }
    }
    if (mode === "2d") {
      const image = new Image();
      image.src = product.image;
      image.alt = product.name;
      holder.replaceChildren(image);
    }
    modeButtons.forEach(button => button.setAttribute("aria-pressed", String(button.dataset.mode === mode)));
  }
  modeButtons.forEach(button => button.onclick = () => setMode(button.dataset.mode));
  function renderQuantity() {
    find("output").textContent = quantity;
    minus.disabled = quantity <= 1;
    plus.disabled = quantity >= 99;
    find(".product-total strong:last-child").textContent = product.price
      ? (product.price * quantity).toLocaleString("ko-KR") + "원" : "가격 준비 중";
    feedback.textContent = "";
  }
  minus.onclick = () => { quantity = Math.max(1, quantity - 1); renderQuantity(); };
  plus.onclick = () => { quantity = Math.min(99, quantity + 1); renderQuantity(); };
  close.onclick = () => dialog.close();
  find(".product-add").onclick = () => {
    addCartItem({ name: product.name, image: product.image, spec: product.spec, quantity });
    feedback.textContent = quantity + "개를 장바구니에 담았어요.";
  };
  dialog.addEventListener("close", () => {
    reset();
    host.dataset.dialogueOpen = "false";
    host.focus();
  });
  return {
    isOpen: () => dialog.open,
    show(group) {
      const id = group.userData.productId;
      product = products[id];
      selectedGroup = group;
      quantity = 1;
      reset();
      host.dataset.dialogueOpen = "true";
      find("#productName").textContent = product.name;
      find(".product-description").textContent = product.description;
      find(".product-spec").textContent = product.spec || "";
      setMode("2d");
      renderQuantity();
      dialog.showModal();
      close.focus();
    },
  };
}
