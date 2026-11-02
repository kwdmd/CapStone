import { mkdir, copyFile, cp, writeFile } from "node:fs/promises";
// [구조 설명] 실제 서비스에 필요한 파일만 dist에 담는다. 원본 FBX·소스·테스트는 배포하지 않는다.
await mkdir("dist/js", { recursive: true });
await copyFile("index.html", "dist/index.html");
await copyFile("js/app.bundle.js", "dist/js/app.bundle.js");
await cp("css", "dist/css", { recursive: true });
await cp("assets/products", "dist/assets/products", { recursive: true });
await cp("assets/fonts", "dist/assets/fonts", { recursive: true });
await mkdir("dist/licenses", { recursive: true });
await copyFile("vendor/LICENSE.txt", "dist/licenses/three-LICENSE.txt");
await writeFile("dist/.nojekyll", "");
console.log("GitHub Pages 배포 폴더: dist");
await copyFile("vendor/fflate-LICENSE.txt", "dist/licenses/fflate-LICENSE.txt");

await copyFile("js/docent-worker.bundle.js", "dist/js/docent-worker.bundle.js");
await mkdir("dist/data", {recursive:true});
for (const name of ["map.json","map.pack","rig.json","rig.pack","npc-rook.json","npc-knight.json","npc-pawn-b.json"]) await copyFile("data/"+name,"dist/data/"+name);

// 더블클릭 미리보기용. GitHub Pages의 HTTP 경로에서는 이 파일을 요청하지 않는다.
const { readFile } = await import("node:fs/promises");
await mkdir("local-assets", {recursive:true});
for (const path of ["data/map.json","data/map.pack","data/rig.json","data/rig.pack","data/npc-rook.json","data/npc-knight.json","data/npc-pawn-b.json","js/docent-worker.bundle.js"]) {
  const content = (await readFile(path)).toString(path.endsWith(".pack") ? "base64" : "utf8");
  const name = path.split("/").pop() + ".js";
  await writeFile("local-assets/"+name, "window.chessLocalAsset("+JSON.stringify(path)+","+JSON.stringify(content)+");");
}
// 같은 컴퓨터에서 dist/index.html을 직접 열 때도 상위의 로컬 데이터에 연결한다.
const distHtml = (await readFile("index.html","utf8")).replace("<head>", '<head><meta name="local-assets" content="../local-assets/">');
await writeFile("dist/index.html",distHtml);
