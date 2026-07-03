# OMR 카드 판독기 v32

v32는 **GitHub Pages에서 내장 카메라를 실행**하고, **Google Apps Script가 기존 구글 스프레드시트에 결과를 저장**하는 분리형 구조입니다.

## 폴더 구성

```text
omr_v32_package/
├─ github_pages/
│  ├─ index.html        ← GitHub Pages에 올릴 메인 앱
│  ├─ config.js         ← Apps Script 웹앱 URL 입력 파일
│  ├─ manifest.json     ← 홈 화면 앱 실행 설정
│  ├─ sw.js             ← PWA 서비스워커
│  ├─ icon-192.svg
│  └─ icon-512.svg
└─ apps_script/
   └─ Code.gs           ← 기존 스프레드시트 Apps Script에 붙여넣을 저장 백엔드
```

## 1. Apps Script에 넣는 코드

기존 스프레드시트에 연결된 Apps Script에서 `Code.gs` 내용을 `omr_v32_package/apps_script/Code.gs`로 교체합니다.

기존 결과 시트 구조는 유지됩니다.

- 과목별 시트명: `국어(00)`, `수학(01)`, `사회(02)`, `과학(03)`
- 학생 점수 저장 위치: 기존과 동일하게 해당 학생 행의 D열
- 로그 시트: `OMR_판독로그`

배포는 다음과 같이 합니다.

```text
배포 → 새 배포 → 유형: 웹 앱
실행 사용자: 나
액세스 권한: 모든 사용자
배포
```

배포 후 나오는 웹앱 URL을 복사합니다.

## 2. GitHub Pages에 올리는 파일

GitHub 저장소에 `omr_v32_package/github_pages` 폴더 안의 파일들을 저장소 루트에 올립니다.

```text
저장소 루트
├─ index.html
├─ config.js
├─ manifest.json
├─ sw.js
├─ icon-192.svg
└─ icon-512.svg
```

`config.js`를 열어서 아래 줄의 따옴표 안에 Apps Script 웹앱 URL을 넣습니다.

```js
window.OMR_APPS_SCRIPT_WEB_APP_URL = '여기에 Apps Script 웹앱 URL';
```

URL을 비워 두어도 앱 첫 화면에서 직접 붙여넣고 저장할 수 있습니다.

## 3. GitHub Pages 켜기

```text
GitHub 저장소 → Settings → Pages
Branch: main
Folder: /root
Save
```

생성된 GitHub Pages 주소를 크롬에서 엽니다.

## 4. 주소창 없이 앱처럼 실행하기

안드로이드 크롬에서 GitHub Pages 주소를 연 뒤:

```text
오른쪽 위 ⋮ → 홈 화면에 추가 → 추가
```

이후 홈 화면 아이콘으로 실행하면 `manifest.json`의 `display: fullscreen`, `orientation: landscape` 설정에 따라 주소창이 없는 앱 형태로 실행됩니다.

단, iPhone Safari는 iOS 정책에 따라 주소창 숨김/전체화면 동작이 Android Chrome과 다를 수 있습니다.

## 5. 저장 방식

GitHub Pages 앱은 카메라 실행과 OMR 판독을 담당합니다.
Apps Script는 다음 작업을 담당합니다.

- 정답 템플릿 저장
- 정답 템플릿 불러오기
- 학생 결과를 기존 스프레드시트에 저장
- `OMR_판독로그`에 상세 기록 추가

외부 페이지에서 Apps Script로 저장할 때는 브라우저 CORS 제한 때문에 저장 응답을 직접 읽지 못합니다. 앱 화면에는 `스프레드시트 전송!확인 필요`처럼 표시될 수 있지만, Apps Script는 요청을 받아 기존 스프레드시트에 저장합니다.

## 6. v32 유지 기능

- 실제 스캔본 비율 기반 `900×331` OMR 프레임
- 내장 카메라 900×331 프레임 촬영
- 명도 80, 채도 100, 대비 200 기본값
- 검정 밝기 기준 60
- 검정 픽셀 기준 0.30
- 마킹 점수 기준 0.70
- 빨간 타원 가로 40%, 세로 80%
- 인식값 확인표
- 마킹 판정 타원 반투명 빨간색 채움
- 구획 선택 후 해당 범위만 조정
- 기존 스프레드시트 결과 저장 구조 유지
