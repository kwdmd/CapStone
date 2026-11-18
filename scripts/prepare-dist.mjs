// 도슨트 .pack은 bake-docents.mjs의 사전 계산된 바이너리를 그대로 배포한다.
import { mkdir, copyFile, cp, writeFile, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const distRoot = path.resolve(projectRoot, "dist");
if (path.dirname(distRoot) !== projectRoot || path.basename(distRoot) !== "dist") {
  throw new Error("Invalid deployment directory");
}
process.chdir(projectRoot);
// 이전 빌드에서 삭제된 파일이 배포 폴더에 남지 않도록 재생성한다.
await rm(distRoot, { recursive: true, force: true });
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
await copyFile("vendor/three-addons-LICENSE.txt", "dist/licenses/three-addons-LICENSE.txt");
await copyFile("vendor/Quaternius-motion-LICENSE.txt", "dist/licenses/Quaternius-motion-LICENSE.txt");

await copyFile("js/docent-worker.bundle.js", "dist/js/docent-worker.bundle.js");
await mkdir("dist/data", {recursive:true});
for (const name of ["map.json","map.pack","rig.json","rig.pack","npc-rook.pack","knight-6a.glb.pack","npc-pawn-b.pack","map-materials.json"]) await copyFile("data/"+name,"dist/data/"+name);

// 더블클릭 미리보기용. GitHub Pages의 HTTP 경로에서는 이 파일을 요청하지 않는다.
const { readFile } = await import("node:fs/promises");
await mkdir("local-assets", {recursive:true});
for (const path of ["data/map.json","data/map.pack","data/rig.json","data/rig.pack","data/npc-rook.pack","data/knight-6a.glb.pack","data/npc-pawn-b.pack","data/map-materials.json","js/docent-worker.bundle.js"]) {
  const content = (await readFile(path)).toString(path.endsWith(".pack") ? "base64" : "utf8");
  const name = path.split("/").pop() + ".js";
  await writeFile("local-assets/"+name, "window.chessLocalAsset("+JSON.stringify(path)+","+JSON.stringify(content)+");");
}
// 같은 컴퓨터에서 dist/index.html을 직접 열 때도 상위의 로컬 데이터에 연결한다.
const distHtml = (await readFile("index.html","utf8")).replace("<head>", '<head><meta name="local-assets" content="../local-assets/">');
await writeFile("dist/index.html",distHtml);
