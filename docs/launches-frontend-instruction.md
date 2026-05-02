# Launches 운영페이지 프론트엔드 작업 지시

## 배경
- 백엔드 완성: api/launches CRUD + advance + overdue + stages
- 프론트 0개 파일 — 새로 만듦
- 8단계 워크플로우: 물건탐색 → 현장확인 → 계약진행 → 잔금납부 → 청소 → 셋팅 → 플랫폼 등록 → 판매게시(LIVE)

## 백엔드 API (이미 존재)

```
POST   /api/launches                    런칭 생성
GET    /api/launches?status=&stage=     목록 (필터링)
GET    /api/launches/overdue            지연된 단계 알림
GET    /api/launches/:id                상세
PATCH  /api/launches/:id                기본 정보 수정
DELETE /api/launches/:id                삭제
POST   /api/launches/:id/advance        다음 단계로 진행
PATCH  /api/launches/:id/stages/:stage  특정 단계 정보 갱신
```

## Entity 필드

```typescript
Launch {
  id, name, address, status, currentStage,
  ownerUserId, hostexId,
  benchmarkHostexIds: string[],   // 벤치마크 호실들 (예측 근거)
  expectedRent, expectedMonthlyRevenue, area,
  memo,
  abandonedAt, abandonedReason,
  stages: LaunchStage[],
  createdAt, updatedAt
}

LaunchStageType:
  SEARCHING (물건탐색)  → VISITING (현장확인)
  → CONTRACTING (계약진행) → PAYING (잔금납부)
  → CLEANING (청소) → SETUP (셋팅)
  → LISTING (플랫폼 등록) → LIVE (판매게시)
```

## 프론트엔드 작업

### 1. 라우팅 + 네비게이션

- `src/pages/Launches.jsx` 신규 (메인 페이지)
- `App.jsx` 또는 router에 `/admin/launches` 라우트 추가
- `Layout.jsx` navItems에 항목 추가:
  ```js
  { to: "/admin/launches", icon: Rocket, label: "런칭 운영", badge: overdueCount }
  ```
  - badge: overdue 단계 알림 카운트 (실시간)
  - lucide-react 의 Rocket 아이콘 사용

### 2. 메인 뷰 — 칸반 보드 (권장)

```
┌─────────────────────────────────────────────────────────────────┐
│  [+ 새 런칭]  [필터: 전체 ▾]  [정렬: 진행률 ▾]                   │
├──────────┬──────────┬──────────┬──────────┬────┬────┬────┬─────┤
│ 물건탐색  │ 현장확인  │ 계약진행  │ 잔금납부  │청소│셋팅│등록│LIVE │
│   3      │   1      │   2      │   1      │ 0  │ 1  │ 2  │ 4   │
├──────────┼──────────┼──────────┼──────────┼────┼────┼────┼─────┤
│ ┌──────┐ │ ┌──────┐ │ ┌──────┐ │ ...                          │
│ │카드1 │ │ │카드  │ │ │카드  │ │                              │
│ │주소  │ │ │주소  │ │ │주소  │ │                              │
│ │₩예상 │ │ │      │ │ │ 🚨   │ │  ← 7일 이상 stuck = overdue  │
│ │7일전 │ │ │      │ │ │      │ │                              │
│ └──────┘ │ └──────┘ │ └──────┘ │                              │
└──────────┴──────────┴──────────┴──────────┴────┴────┴────┴─────┘
```

각 카드:
- 이름 + 주소
- 예상 월매출
- 현재 단계 진입 후 며칠 경과
- overdue (예: 단계당 7일 초과) 시 ⚠ 표시
- 클릭 → 상세 모달 (또는 우측 드로어)

칸 헤더에 호실 수 카운트.

### 3. 카드 → 상세 드로어/모달

- 8단계 진행 시각화 (가로 stepper)
- 각 단계 클릭 → 해당 단계의 상세 (시작일, 완료일, 메모)
- 액션 버튼:
  - "다음 단계로 진행" (POST /:id/advance)
  - "기본 정보 수정"
  - "포기 처리" (status를 ABANDONED로)

### 4. 새 런칭 생성 모달

필드:
- 이름, 주소 (필수)
- 예상 월세, 예상 월매출, 면적 (선택)
- 벤치마크 호실 (멀티셀렉트 — 기존 properties에서 선택)
- 메모

### 5. LIVE 단계 → Properties 연결

LIVE에 도달하면:
- `hostexId` 입력 받기 (Hostex에 호실 등록 후 받은 ID)
- 입력 시 properties 테이블에 자동 등록 (백엔드에 endpoint 추가 필요할 수도)
- 또는 LIVE 카드에 "Properties로 이전" 버튼

## 디자인 토큰 (기존 시스템 재사용)

```javascript
const C = {
  bg: "#F5F2EC",
  card: "#FFFFFF",
  ink: "#1A1917",
  forest: "#1E3A2F",
  terracotta: "#C65D3A",
  ochre: "#B8842F",
  red: "#A63D2A",
  green: "#4A7A4A",
  border: "#E5E1D6",
};
```

Layout.jsx, Dashboard.jsx, PortfolioHealth.jsx 와 동일한 토큰 사용.

## 라이브러리

- react-router-dom (이미 사용 중)
- lucide-react 아이콘
- 칸반 드래그앤드롭: @dnd-kit/core (선택사항 — 단순 클릭으로 advance해도 됨)

## 작업 순서

1. 페이지 스켈레톤 + 라우팅 + 사이드바 등록
2. GET /api/launches 호출 → 칸반 8칸으로 그루핑
3. 카드 클릭 → 상세 드로어 + advance 버튼
4. + 새 런칭 모달 (CRUD)
5. overdue 시각 신호 (7일 이상 stuck)
6. LIVE → Properties 연결 (마지막)

## 기본값 (heiro 사전 결정)

1. 칸반 vs 테이블 → **칸반** (8단계 시각화 강점)
2. overdue 임계치 → **7일**
3. 벤치마크 호실 → **1~3개 선택 가능**
4. LIVE → Properties → **수동** (hostexId 입력 → properties row 자동 생성)
5. abandoned 처리 → **별도 탭 "포기됨"**

## 작업량

예상 4~6시간.
