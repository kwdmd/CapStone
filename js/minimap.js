export function createMinimap(mini, mapData) {
  // [구조 설명] 미니맵은 실제 메시의 삼각형을 평면 투영해 한 번 그리고 플레이어 위치만 갱신한다.
  const ctx = mini.getContext("2d");
  const base = document.createElement("canvas");
  base.width = base.height = 280;
  const bc = base.getContext("2d");
  const X = (x) => 140 + x * 3.5,
    Z = (z) => 140 + z * 3.5;
  for (const data of mapData) {
    bc.fillStyle = data.name === "Cylinder.001" ? "#b5c0c7" : "#758f90";
    for (let i = 0; i < data.indices.length; i += 3) {
      bc.beginPath();
      for (let j = 0; j < 3; j++) {
        const k = data.indices[i + j] * 3;
        const x = X(data.positions[k]),
          y = Z(data.positions[k + 2]);
        j ? bc.lineTo(x, y) : bc.moveTo(x, y);
      }
      bc.closePath();
      bc.fill();
    }
  }

  return (player) => {
    if (!ctx) return;
    ctx.clearRect(0, 0, 280, 280);
    ctx.drawImage(base, 0, 0);
    ctx.fillStyle = "#ad3749";
    ctx.beginPath();
    ctx.arc(X(player.x), Z(player.z), 5, 0, Math.PI * 2);
    ctx.fill();
  };
}
