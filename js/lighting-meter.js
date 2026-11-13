// 조명 비교 전용: ?lightTest=1에서만 표시. 도슨트가 모두 나온 후 측정을 시작한다.
export function createLightingMeter() {
  const query = new URLSearchParams(location.search);
  if (!query.has("lightTest")) return () => {};
  const before = query.get("halos") === "off";
  const mode = query.get("lighting") === "all" ? "이전 전체 점등 · 75개" :
    (before ? "후광 적용 전 · 광원 7개" : "후광 적용 후 · 광원 7개");
  const panel = document.createElement("div");
  panel.style.cssText = "position:fixed;left:20px;top:80px;z-index:9999;background:#111e;color:white;padding:16px;font:14px sans-serif;max-width:440px";
  const output = document.createElement("p");
  output.textContent = mode + " / 도슨트 로딩 완료 후, 같은 위치에서 30초 측정하세요.";
  const button = document.createElement("button");
  button.textContent = "30초 측정 시작";
  const other = document.createElement("a");
  other.href = "?lightTest=1&lighting=limited&halos=" + (before ? "on" : "off");
  other.textContent = " 반대 버전 열기";
  other.style.color = "#8defff";
  panel.append(output, button, other);
  document.body.append(panel);
  let start = null, previous = null, frames = [];
  button.onclick = () => { start = performance.now(); previous = null; frames = []; button.disabled = true; };
  document.addEventListener("visibilitychange", () => {
    if (document.hidden && start !== null) {
      start = null; button.disabled = false; output.textContent = "탭이 숨겨져 측정을 취소했습니다. 다시 측정하세요.";
    }
  });
  return now => {
    if (start === null) return;
    if (previous !== null) frames.push(now - previous);
    previous = now;
    if (now - start < 30000) { output.textContent = mode + " 측정 중 · " + Math.floor((now-start)/1000) + "/30초"; return; }
    const mean = frames.reduce((a,b)=>a+b,0)/frames.length;
    const sorted = [...frames].sort((a,b)=>a-b);
    output.textContent = `${mode} / 평균 ${(1000/mean).toFixed(1)} FPS / 50ms 초과 ${frames.filter(v=>v>50).length}회 / 최장 ${Math.max(...frames).toFixed(1)}ms / P95 ${sorted[Math.floor(sorted.length*.95)].toFixed(1)}ms`;
    start = null; button.disabled = false;
  };
}
