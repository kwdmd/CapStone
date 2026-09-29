# 🥲 이재범이 직접 구현한 ... — WAVE

2-2map.fbx를 적용한 온라인 팝업 페이지입니다. index.html을 브라우저로 열면 실행됩니다.

- 중앙 흰 영역에만 맵 표시, 1인칭/3인칭 전환, WASD/방향키 이동
- 드래그 시선 회전, Shift 달리기. 줌 조작 없음
- 실제 맵을 투영한 미니맵과 현재 위치 표시
- 원본 FBX에 재질이 없어 임시 중립색 적용

HTML/CSS/JS/JSON 소스는 분리했습니다. js/app.bundle.js는 로컬 파일에서도 작동하도록 JS·설정·맵·Three.js를 묶은 실행 결과물입니다. 직접 수정하지 마세요.
JS 또는 JSON 수정 후 최초 한 번 `npm install`, 이후 `npm run build`를 실행하세요. HTML/CSS만 수정하면 새로고침하면 됩니다.

원본: assets/models/2-2map.fbx. 실행용 정적 형상: data/map.json.
FBX 파일만 바꾸면 자동 반영되지는 않습니다. 새 맵은 형상을 다시 변환해야 합니다.
서버, 실시간 소통, 결제, 음원은 포함하지 않았습니다. 소리 버튼은 설정 상태만 바꿉니다.

자세한 변경 위치는 수정가이드.md에 있습니다. Three.js 라이선스는 vendor/LICENSE.txt에 보관했습니다.
