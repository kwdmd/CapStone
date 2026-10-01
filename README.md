# WAVE — GitHub Pages 배포용

PC용 3D 온라인 팝업 전시입니다. 전체 화면 UI, 1/3인칭 카메라, 미니맵, 오브젝트 5개와 임시 카메라 충돌 보정을 포함합니다.

## GitHub에 올리기

1. GitHub에서 새 저장소를 만들고 기본 브랜치를 main으로 설정합니다.
2. GitHub Desktop으로 저장소를 Clone합니다.
3. 이 폴더의 **내용 전체**를 저장소 루트에 복사합니다. index.html, package.json, .github 폴더가 바로 루트에 있어야 합니다. ZIP 자체를 올리지 마세요.
4. Commit 후 Push합니다. .github/workflows/pages.yml도 반드시 포함하세요.
5. 저장소 Settings → Pages → Build and deployment → Source를 **GitHub Actions**로 선택합니다.
6. Actions → Deploy WAVE to GitHub Pages에서 실행 상태를 확인합니다. 필요하면 Run workflow로 다시 실행하세요.
7. 성공하면 Settings → Pages 또는 배포 작업에 사이트 주소가 표시됩니다.

주소 형태: https://계정명.github.io/저장소명/

대형 모델 데이터가 있으므로 웹의 파일 드래그 업로드 대신 **GitHub Desktop 또는 Git**을 사용하세요. 배포 후에는 다른 PC에서도 사이트 주소로 접속할 수 있습니다.

## 파일 구성

- index.html / css/: 화면 구조와 디자인
- js/: 역할별 JavaScript 소스 (생성된 app.bundle.js는 Git에서 제외)
- data/: 브랜드·카메라·배치 설정 및 변환된 3D 형상
- assets/fonts/: 로컬 Pretendard와 라이선스
- vendor/: Three.js와 라이선스
- tests/: 카메라·입력 검증
- scripts/prepare-dist.mjs: 공개할 파일만 dist에 모으는 스크립트
- .github/workflows/pages.yml: main Push 시 검증·빌드·배포

원본 FBX와 사용하지 않는 아이콘은 배포 폴더에서 제외했습니다. 기존 outputs/wave-popup에는 그대로 보관되어 있습니다. data의 변환 형상은 빌드에 필요하므로 삭제하지 마세요.

## 로컬 작업

Node.js 22 환경에서 npm install → npm test → npm run build 순서로 실행합니다.
빌드 후 dist/index.html을 열거나 dist 폴더를 정적 서버로 제공하면 됩니다.
소스 수정 후 Commit/Push하면 자동 배포됩니다. 브랜치가 main이 아니라면 pages.yml의 branches를 변경하세요.

## 참고

소리 버튼은 상태만 전환하며 음원은 없습니다. 서버·결제·실시간 통신 기능은 포함하지 않았습니다. 큰 모델 데이터 때문에 첫 로딩에 시간이 걸릴 수 있습니다. 이번 작업은 배포 구조 정리이며 3D 모델 경량화는 포함하지 않습니다.

GitHub 공식 안내: https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages
