# HIERO 백엔드 docs/ 폴더

> 작업 지시서 모음. 도나2/루카가 작업할 때 이 폴더의 md 파일을 순서대로 읽고 진행.

---

## 파일 목록

| 파일 | 용도 | 작업 상태 |
|---|---|---|
| `launches-frontend-implementation.md` | Launches 페이지 **기본 구조** 구현 가이드 | ✅ Step 1-2 완료, 진행 중 |
| `launches-stage-content.md` | Launches **단계별 콘텐츠** 정의 (StageModal 재작성) | ⏳ 대기 (1번 완료 후) |
| `launches-roadmap.md` | Launches 미래 기능 ROADMAP (지도/등기부/전자계약 등) | 📋 참고용 (당장 안 함) |
| `launches-frontend-instruction.md` | (구버전 짧은 요약) | ⚠️ 무시 — implementation에 포함됨 |

---

## 도나2/루카 작업 순서

### 1단계: 기본 구조 (이미 진행 중)
**파일**: `launches-frontend-implementation.md`

- 라우팅 설정 (main.jsx)
- 사이드바 추가 (Layout.jsx)
- 컴포넌트 9개 생성:
  - `pages/Launches.jsx`
  - `pages/LaunchDetail.jsx`
  - `components/launches/LaunchList.jsx`
  - `components/launches/LaunchCard.jsx`
  - `components/launches/Timeline.jsx`
  - `components/launches/StageModal.jsx` (기본 폼)
  - `components/launches/NewLaunchModal.jsx`
  - `hooks/useLaunches.js`
  - `utils/launchUtils.js`

이 단계 끝나면 `/admin/launches` 칸반이 뜨고, 새 런칭 생성 + 단계 진행이 가능해짐.

---

### 2단계: 단계별 콘텐츠 (1단계 완료 후)
**파일**: `launches-stage-content.md`

- 백엔드: LaunchStage entity에 `details` JSON 컬럼 추가
- 백엔드: Launch entity에 district/expectedGrade/buildingYear 추가
- 백엔드: GET /api/launches/pool-stats endpoint 추가
- 프론트: `STAGE_TEMPLATES` 정의 (8단계 각각의 체크리스트/필드/가이드)
- 프론트: `StageModal.jsx` 재작성 (단계별 다른 렌더링)
- 프론트: `StagePoolMatch.jsx` 신규 (생활권×등급 풀 매칭 위젯)
- 프론트: `StageSubSteps.jsx` 신규 (셋팅 5 sub-step)
- 프론트: `NewLaunchModal.jsx` 강화 (생활권/등급/연식 추가)

이 단계 끝나면 8단계가 각각 다른 폼/체크리스트/가이드를 가지게 되고, HIERO 핵심 가치(생활권×등급 풀)가 운영 도구에 녹아듦.

---

### 3단계: 미래 (지금은 안 함)
**파일**: `launches-roadmap.md`

지도 자동 분석, 등기부 API, 계약서 OCR, 전자계약, 띵동 통합 등.
heiro가 명시적으로 "Phase 2 진행" 지시할 때만 시작.

---

## 작업 원칙

1. **추측하지 말 것** — 막히면 heiro에게 질문, 가짜 결정 X
2. **순서 지킬 것** — 1단계 완전히 끝나기 전 2단계 시작 금지
3. **기존 코드 살릴 것** — Dashboard/Health/Layout 패턴 재사용 (`C` 디자인 토큰 등)
4. **새 Context 만들지 말 것** — useState로 충분
5. **백엔드 변경 시 빌드 + 컨트롤러 응답 직접 확인** — typeorm 변경은 synchronize: true 가정

---

## 검증

각 단계 끝나면 보고:
- 빌드 성공 / 에러 0
- 변경된 파일 목록
- 검증 체크리스트 결과
- (가능하면) 화면 스크린샷

heiro 컨펌 후 다음 단계.
