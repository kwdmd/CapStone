# Chess Gambit

GitHub Desktop에서 압축을 푼 파일과 폴더를 저장소 최상위에 복사합니다. index.html, package.json, .github 폴더가 같은 위치에 있어야 합니다.
GitHub 저장소 Settings → Pages → Source를 GitHub Actions로 설정한 뒤 main에 푸시합니다.

로컬 확인: Node.js 22에서 npm install, npm test, npm run build를 실행하고 dist 폴더를 HTTP 서버로 엽니다.
맵·플레이어의 .pack 파일은 브라우저가 직접 압축을 해제합니다. 호스팅에서 이 파일에 Content-Encoding: gzip을 수동 지정하지 마세요.

## 검사 파일 위치
검사 파일은 `scripts/`에 있습니다. `npm test`로 카메라·충돌·NPC·초기화·모바일 입력을 검사합니다.
진단 보고서는 `scripts/reports/`에 생성하며 업로드에서 제외합니다.
