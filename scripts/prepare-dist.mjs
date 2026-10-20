import { mkdir, copyFile, cp, writeFile } from 'node:fs/promises';
// [구조 설명] 실제 서비스에 필요한 파일만 dist에 담는다. 원본 FBX·소스·테스트는 배포하지 않는다.
await mkdir('dist/js', { recursive: true });
await copyFile('index.html', 'dist/index.html');
await copyFile('js/app.bundle.js', 'dist/js/app.bundle.js');
await cp('css', 'dist/css', { recursive: true });
await cp('assets/fonts', 'dist/assets/fonts', { recursive: true });
await mkdir('dist/licenses', { recursive: true });
await copyFile('vendor/LICENSE.txt', 'dist/licenses/three-LICENSE.txt');
await writeFile('dist/.nojekyll', '');
console.log('GitHub Pages 배포 폴더: dist');
await copyFile('vendor/fflate-LICENSE.txt', 'dist/licenses/fflate-LICENSE.txt');
