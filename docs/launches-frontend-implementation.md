# Launches 프론트엔드 — 직접 실행 가능 구현 가이드

> 도나2가 그대로 실행할 수 있도록 작성된 단일 문서.  
> 추측 없이 이 가이드대로 만들면 됨.

---

## 0. 검증된 사실 (코드 직접 확인 완료)

### 라우터 위치
- **`src/main.jsx`** (NOT App.jsx — App.jsx는 별도 데모)
- BrowserRouter + Routes 사용
- 어드민 경로: `/admin/*`

### 사이드바 위치
- **`src/Layout.jsx`** — `navItems` 배열
- `lucide-react` 아이콘 사용
- `<Outlet />` 으로 자식 라우트 렌더링

### 백엔드 API (전수 확인)
```
POST   /api/launches                          런칭 생성
GET    /api/launches?status=&currentStage=    필터링 목록
GET    /api/launches/kanban                   ★ 칸반 (가공된 데이터)
GET    /api/launches/abandoned                포기됨 목록
GET    /api/launches/overdue                  지연된 단계
GET    /api/launches/:id                      상세
GET    /api/launches/:id/summary              요약 (비용·진행)
PATCH  /api/launches/:id                      기본 정보 수정
DELETE /api/launches/:id                      삭제
POST   /api/launches/:id/advance              다음 단계로
POST   /api/launches/:id/abandon              포기 처리
POST   /api/launches/:id/link-property        Properties 연결
PATCH  /api/launches/:id/stages/:stage        특정 단계 수정
```

### `/api/launches/kanban` 응답 구조 (확정)
```typescript
{
  columns: [
    {
      stage: "searching" | "visiting" | ... | "live",
      label: "물건탐색" | ...,    // 한글 라벨
      order: 1 | 2 | ... | 8,
      cards: [
        {
          id: number,
          name: string,
          address: string,
          status: "active" | "abandoned" | "live",
          expectedRent: number | null,
          expectedMonthlyRevenue: number | null,
          area: number | null,
          memo: string | null,
          hostexId: string | null,
          daysInStage: number,        // 자동 계산
          isOverdue: boolean,         // daysInStage >= 7
          enteredAt: Date,
          stages: LaunchStage[],
        }
      ]
    },
    // ... 8개 컬럼
  ],
  totalActive: number,
  totalAbandoned: number,
}
```

### LaunchStage 필드 (전수)
```typescript
{
  id, launchId, stage, stageOrder,
  targetDate: Date | null,        // 목표일
  enteredAt: Date | null,         // 진입일
  completedAt: Date | null,       // 완료일
  completedBy: string | null,     // 레거시
  assignee: string | null,        // 담당자
  issue: string | null,           // 이슈/문제
  cost: number,                   // 이 단계 비용 (default 0)
  attachments: string[] | null,   // 사진 URL 목록
  memo: string | null,
}
```

### 단계 enum 라벨 (백엔드와 동일)
```javascript
const STAGE_LABELS = {
  searching:    "물건탐색",
  visiting:     "현장확인",
  contracting:  "계약진행",
  paying:       "잔금납부",
  cleaning:     "청소",
  setup:        "셋팅",
  listing:      "플랫폼 등록",
  live:         "판매게시",
};

const STAGES_IN_ORDER = [
  "searching", "visiting", "contracting", "paying",
  "cleaning", "setup", "listing", "live"
];
```

---

## 1. 폴더 구조 (정확)

```
src/
├── pages/
│   ├── Launches.jsx              ← 메인 칸반 페이지 (/admin/launches)
│   └── LaunchDetail.jsx          ← 상세 페이지 (/admin/launches/:id)
├── components/
│   └── launches/
│       ├── LaunchList.jsx        ← 칸반 8칸 그리드
│       ├── LaunchCard.jsx        ← 단일 런칭 카드
│       ├── Timeline.jsx          ← 8단계 stepper 시각화
│       ├── StageModal.jsx        ← 단계 정보 수정 모달
│       └── NewLaunchModal.jsx    ← 새 런칭 생성 모달
├── hooks/
│   └── useLaunches.js            ← API 호출 로직 분리
└── utils/
    └── launchUtils.js            ← 포맷팅 유틸 (백엔드 보조용)
```

### ⚠️ 백엔드 활용 원칙

`/api/launches/kanban` 응답에 다음이 **이미 계산되어 있음**:
- `daysInStage` (이 단계 며칠째)
- `isOverdue` (7일 이상 stuck 여부)
- `enteredAt` (이전 단계 completedAt 또는 launch.createdAt)

→ **프론트에서 이걸 다시 계산하지 마세요.** 백엔드 응답 그대로 쓰면 됩니다.  
utils는 **포맷팅 전용** (날짜, 통화, 라벨 매핑).

---

## 2. 상태 관리 결정 (답: useState만)

**Context 새로 만들 필요 없음.** 이유:
- Launches 페이지는 다른 페이지(Dashboard, PortfolioHealth)와 데이터 공유 안 함
- 단일 라우트 안에서만 사용
- 새로고침 시 다시 fetch하는 게 정상 (UX 부담 없음)
- 기존 DataContext에 끼워넣으면 오히려 복잡해짐

**대신 페이지 단위 useState + URL 파라미터:**
- `Launches.jsx`: kanban data를 useState로 보유
- `LaunchDetail.jsx`: useParams로 :id 받기
- 모달 open/close: 부모 컴포넌트의 useState로 제어

---

## 3. 라우팅 설정 — `src/main.jsx` 수정

### 현재 (33~40줄 import 부분):
```javascript
import LandingPage from './LandingPage.jsx'
import Layout from './Layout.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Properties from './pages/Properties.jsx'
import Reservations from './pages/Reservations.jsx'
import Calendar from './pages/Calendar.jsx'
import PortfolioHealth from './pages/PortfolioHealth.jsx'
import CostManagement from './pages/CostManagement.jsx'
import { DataProvider } from './lib/DataContext.jsx'
```

### 추가 (CostManagement 다음 줄):
```javascript
import Launches from './pages/Launches.jsx'
import LaunchDetail from './pages/LaunchDetail.jsx'
```

### 라우트 추가 (현재 79~80줄, "messages" 위에 삽입):
```jsx
<Route path="dashboard" element={<Dashboard />} />
<Route path="health" element={<PortfolioHealth />} />
<Route path="reservations" element={<Reservations />} />
<Route path="calendar" element={<Calendar />} />
<Route path="properties" element={<Properties />} />
<Route path="costs" element={<CostManagement />} />
<Route path="launches" element={<Launches />} />              {/* ← 추가 */}
<Route path="launches/:id" element={<LaunchDetail />} />     {/* ← 추가 */}
<Route path="messages" element={<Placeholder title="메시지" />} />
```

---

## 4. 사이드바 추가 — `src/Layout.jsx` 수정

### 현재 import 부분 (1~26줄)에 Rocket 추가:
```javascript
import {
  LayoutDashboard,
  CalendarDays,
  Building2,
  MessageSquare,
  BarChart3,
  Settings,
  Layers,
  Activity,
  Wallet,
  Rocket,                    // ← 추가
  ChevronLeft,
  ChevronRight,
  // ... 나머지 그대로
} from "lucide-react";
```

### navItems 배열 (28~38줄)에 한 줄 추가:
```javascript
const navItems = [
  { to: "/admin/dashboard", icon: LayoutDashboard, label: "대시보드" },
  { to: "/admin/health", icon: Activity, label: "포트폴리오 건강" },
  { to: "/admin/calendar", icon: CalendarDays, label: "간트 달력" },
  { to: "/admin/reservations", icon: CalendarDays, label: "예약 관리" },
  { to: "/admin/properties", icon: Building2, label: "숙소 관리" },
  { to: "/admin/launches", icon: Rocket, label: "런칭 운영" },     // ← 추가
  { to: "/admin/costs", icon: Wallet, label: "비용 관리" },
  { to: "/admin/messages", icon: MessageSquare, label: "메시지", badge: 3 },
  { to: "/admin/reports", icon: BarChart3, label: "리포트" },
  { to: "/admin/settings", icon: Settings, label: "설정" },
];
```

(overdue 카운트 badge는 나중에 — 일단 없이 시작)

---

## 5. 스타일링 (기존 패턴 그대로)

- **Tailwind 클래스 + 인라인 style 혼용** (PortfolioHealth.jsx 패턴)
- 색상은 디자인 토큰 `C` 객체에서 가져옴
- 카드: `bg-white border border-[#E5E1D6] rounded-xl`
- lucide-react 아이콘만 사용

### 디자인 토큰 (각 파일 상단에 복붙)
```javascript
const C = {
  bg: "#F5F2EC",
  card: "#FFFFFF",
  ink: "#1A1917",
  ink2: "#3A362E",
  muted: "#6B6458",
  border: "#E5E1D6",
  borderStrong: "#CFC8B8",
  forest: "#1E3A2F",
  forestLight: "#E8EDE8",
  terracotta: "#C65D3A",
  ochre: "#B8842F",
  red: "#A63D2A",
  redLight: "#FEF2F2",
  green: "#4A7A4A",
  greenLight: "#E8F0E8",
};
```

---

## 6. 컴포넌트 구현체 (직접 복붙 가능)

### 6.1 `src/pages/Launches.jsx` — 메인 페이지

```jsx
import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Loader2, Archive, Rocket } from "lucide-react";
import LaunchList from "../components/launches/LaunchList.jsx";
import NewLaunchModal from "../components/launches/NewLaunchModal.jsx";

const C = {
  bg: "#F5F2EC", card: "#FFFFFF", ink: "#1A1917", ink2: "#3A362E",
  muted: "#6B6458", border: "#E5E1D6", forest: "#1E3A2F",
  forestLight: "#E8EDE8", terracotta: "#C65D3A", ochre: "#B8842F",
  red: "#A63D2A", green: "#4A7A4A",
};

export default function Launches() {
  const navigate = useNavigate();
  const [kanban, setKanban] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showNewModal, setShowNewModal] = useState(false);
  const [tab, setTab] = useState("active"); // "active" | "abandoned"
  const [abandoned, setAbandoned] = useState([]);

  const fetchKanban = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/launches/kanban");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setKanban(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchAbandoned = async () => {
    try {
      const res = await fetch("/api/launches/abandoned");
      if (res.ok) setAbandoned(await res.json());
    } catch {}
  };

  useEffect(() => {
    fetchKanban();
    fetchAbandoned();
  }, []);

  const handleCreated = () => {
    setShowNewModal(false);
    fetchKanban();
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 size={28} className="animate-spin" style={{ color: C.forest }} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-full flex items-center justify-center" style={{ color: C.red }}>
        오류: {error}
        <button
          onClick={fetchKanban}
          className="ml-3 px-3 py-1 rounded text-sm"
          style={{ background: C.forest, color: "white" }}
        >
          재시도
        </button>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto pr-1 space-y-5">
      {/* 헤더 */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-medium mb-1" style={{ color: C.ink }}>
            런칭 운영
          </h2>
          <p className="text-sm" style={{ color: C.muted }}>
            {kanban?.totalActive || 0}건 진행 · {kanban?.totalAbandoned || 0}건 포기됨
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div
            className="flex items-center gap-1 rounded-lg p-1"
            style={{ background: C.card, border: `1px solid ${C.border}` }}
          >
            <button
              onClick={() => setTab("active")}
              className="px-3 py-1.5 rounded text-xs font-medium transition-colors"
              style={{
                background: tab === "active" ? C.forest : "transparent",
                color: tab === "active" ? "#fff" : C.muted,
              }}
            >
              진행중
            </button>
            <button
              onClick={() => setTab("abandoned")}
              className="px-3 py-1.5 rounded text-xs font-medium transition-colors inline-flex items-center gap-1"
              style={{
                background: tab === "abandoned" ? C.forest : "transparent",
                color: tab === "abandoned" ? "#fff" : C.muted,
              }}
            >
              <Archive size={12} /> 포기됨 {abandoned.length}
            </button>
          </div>
          <button
            onClick={() => setShowNewModal(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium"
            style={{ background: C.forest, color: "#fff" }}
          >
            <Plus size={14} /> 새 런칭
          </button>
        </div>
      </div>

      {/* 메인 영역 */}
      {tab === "active" ? (
        <LaunchList
          columns={kanban?.columns || []}
          onCardClick={(id) => navigate(`/admin/launches/${id}`)}
          onAdvance={fetchKanban}
        />
      ) : (
        <AbandonedList items={abandoned} onCardClick={(id) => navigate(`/admin/launches/${id}`)} />
      )}

      {/* 모달 */}
      {showNewModal && (
        <NewLaunchModal onClose={() => setShowNewModal(false)} onCreated={handleCreated} />
      )}
    </div>
  );
}

function AbandonedList({ items, onCardClick }) {
  if (items.length === 0) {
    return (
      <div className="text-center py-12" style={{ color: C.muted }}>
        포기된 런칭이 없습니다.
      </div>
    );
  }
  return (
    <div className="grid grid-cols-3 gap-3">
      {items.map((l) => (
        <button
          key={l.id}
          onClick={() => onCardClick(l.id)}
          className="text-left p-4 rounded-xl border hover:shadow-sm transition"
          style={{ background: C.card, borderColor: C.border, opacity: 0.7 }}
        >
          <div className="font-medium text-sm" style={{ color: C.ink }}>
            {l.name}
          </div>
          <div className="text-xs mt-1" style={{ color: C.muted }}>
            {l.address}
          </div>
          {l.abandonedReason && (
            <div className="text-xs mt-2" style={{ color: C.red }}>
              사유: {l.abandonedReason}
            </div>
          )}
        </button>
      ))}
    </div>
  );
}
```

### 6.2 `src/components/launches/LaunchList.jsx` — 칸반

```jsx
import React from "react";
import LaunchCard from "./LaunchCard.jsx";

const C = {
  bg: "#F5F2EC", card: "#FFFFFF", ink: "#1A1917", muted: "#6B6458",
  border: "#E5E1D6", forest: "#1E3A2F", forestLight: "#E8EDE8",
};

export default function LaunchList({ columns, onCardClick, onAdvance }) {
  return (
    <div className="overflow-x-auto pb-4">
      <div className="flex gap-3" style={{ minWidth: 1200 }}>
        {columns.map((col) => (
          <div
            key={col.stage}
            className="flex-1 rounded-xl"
            style={{ background: C.bg, border: `1px solid ${C.border}`, minWidth: 180 }}
          >
            {/* 컬럼 헤더 */}
            <div
              className="px-3 py-2.5 flex items-center justify-between border-b"
              style={{ borderColor: C.border }}
            >
              <div>
                <div className="text-xs" style={{ color: C.muted }}>
                  {String(col.order).padStart(2, "0")}
                </div>
                <div className="text-sm font-medium" style={{ color: C.ink }}>
                  {col.label}
                </div>
              </div>
              <div
                className="text-xs font-semibold rounded-full px-2 py-0.5"
                style={{
                  background: col.cards.length > 0 ? C.forestLight : "transparent",
                  color: col.cards.length > 0 ? C.forest : C.muted,
                }}
              >
                {col.cards.length}
              </div>
            </div>

            {/* 카드 리스트 */}
            <div className="p-2 space-y-2 min-h-[200px]">
              {col.cards.length === 0 ? (
                <div className="text-xs text-center py-6" style={{ color: C.muted }}>
                  비어있음
                </div>
              ) : (
                col.cards.map((card) => (
                  <LaunchCard
                    key={card.id}
                    card={card}
                    onClick={() => onCardClick(card.id)}
                  />
                ))
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

### 6.3 `src/components/launches/LaunchCard.jsx` — 단일 카드

```jsx
import React from "react";
import { AlertTriangle, MapPin, Coins } from "lucide-react";

const C = {
  card: "#FFFFFF", ink: "#1A1917", ink2: "#3A362E", muted: "#6B6458",
  border: "#E5E1D6", forest: "#1E3A2F", terracotta: "#C65D3A",
  red: "#A63D2A", redLight: "#FEF2F2",
};

const krwMan = (n) => {
  if (n == null) return "—";
  return `${(n / 10000).toFixed(0)}만`;
};

export default function LaunchCard({ card, onClick }) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left p-3 rounded-lg hover:shadow-sm transition"
      style={{
        background: C.card,
        border: `1px solid ${card.isOverdue ? C.terracotta : C.border}`,
      }}
    >
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <div className="text-sm font-medium leading-tight" style={{ color: C.ink }}>
          {card.name}
        </div>
        {card.isOverdue && (
          <AlertTriangle size={14} style={{ color: C.terracotta, flexShrink: 0 }} />
        )}
      </div>
      <div
        className="text-xs leading-snug mb-2 flex items-start gap-1"
        style={{ color: C.muted }}
      >
        <MapPin size={10} className="mt-0.5 flex-shrink-0" />
        <span className="line-clamp-2">{card.address}</span>
      </div>
      <div className="flex items-center justify-between text-[11px]">
        <div className="flex items-center gap-1" style={{ color: C.ink2 }}>
          <Coins size={10} />
          {card.expectedMonthlyRevenue ? `예상 ${krwMan(card.expectedMonthlyRevenue)}` : "—"}
        </div>
        <div
          style={{
            color: card.isOverdue ? C.terracotta : C.muted,
            fontWeight: card.isOverdue ? 600 : 400,
          }}
        >
          {card.daysInStage}일째
        </div>
      </div>
    </button>
  );
}
```

### 6.4 `src/components/launches/NewLaunchModal.jsx` — 새 런칭 생성

```jsx
import React, { useState } from "react";
import { X } from "lucide-react";

const C = {
  card: "#FFFFFF", ink: "#1A1917", ink2: "#3A362E", muted: "#6B6458",
  border: "#E5E1D6", forest: "#1E3A2F", red: "#A63D2A",
};

export default function NewLaunchModal({ onClose, onCreated }) {
  const [form, setForm] = useState({
    name: "",
    address: "",
    expectedRent: "",
    expectedMonthlyRevenue: "",
    area: "",
    memo: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const handleChange = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.address.trim()) {
      setError("이름과 주소는 필수입니다.");
      return;
    }
    setSubmitting(true);
    setError(null);

    const payload = {
      name: form.name.trim(),
      address: form.address.trim(),
      ...(form.expectedRent ? { expectedRent: Number(form.expectedRent) } : {}),
      ...(form.expectedMonthlyRevenue ? { expectedMonthlyRevenue: Number(form.expectedMonthlyRevenue) } : {}),
      ...(form.area ? { area: Number(form.area) } : {}),
      ...(form.memo.trim() ? { memo: form.memo.trim() } : {}),
    };

    try {
      const res = await fetch("/api/launches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(`생성 실패: ${txt}`);
      }
      onCreated();
    } catch (err) {
      setError(err.message);
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.4)" }}
      onClick={onClose}
    >
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={handleSubmit}
        className="w-[480px] rounded-xl p-6 space-y-4"
        style={{ background: C.card, border: `1px solid ${C.border}` }}
      >
        <div className="flex items-start justify-between">
          <h3 className="text-lg font-medium" style={{ color: C.ink }}>
            새 런칭
          </h3>
          <button type="button" onClick={onClose} className="p-1">
            <X size={18} style={{ color: C.muted }} />
          </button>
        </div>

        <Field label="이름 *" value={form.name} onChange={handleChange("name")} />
        <Field label="주소 *" value={form.address} onChange={handleChange("address")} />
        <div className="grid grid-cols-2 gap-3">
          <Field label="예상 월세 (원)" type="number" value={form.expectedRent} onChange={handleChange("expectedRent")} />
          <Field label="예상 월매출 (원)" type="number" value={form.expectedMonthlyRevenue} onChange={handleChange("expectedMonthlyRevenue")} />
        </div>
        <Field label="면적 (㎡)" type="number" value={form.area} onChange={handleChange("area")} />
        <div>
          <label className="text-xs font-semibold" style={{ color: C.muted }}>메모</label>
          <textarea
            value={form.memo}
            onChange={handleChange("memo")}
            rows={3}
            className="w-full mt-1 px-3 py-2 rounded-lg text-sm outline-none border resize-none"
            style={{ borderColor: C.border, background: "#fff", color: C.ink }}
          />
        </div>

        {error && (
          <div className="text-xs p-2 rounded" style={{ background: "#FEF2F2", color: C.red }}>
            {error}
          </div>
        )}

        <div className="flex gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2 rounded-lg text-sm font-medium border"
            style={{ borderColor: C.border, color: C.ink2 }}
          >
            취소
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="flex-1 py-2 rounded-lg text-sm font-medium"
            style={{ background: C.forest, color: "#fff", opacity: submitting ? 0.6 : 1 }}
          >
            {submitting ? "생성 중..." : "생성"}
          </button>
        </div>
      </form>
    </div>
  );
}

function Field({ label, type = "text", value, onChange }) {
  const C2 = { border: "#E5E1D6", muted: "#6B6458", ink: "#1A1917" };
  return (
    <div>
      <label className="text-xs font-semibold" style={{ color: C2.muted }}>{label}</label>
      <input
        type={type}
        value={value}
        onChange={onChange}
        className="w-full mt-1 px-3 py-2 rounded-lg text-sm outline-none border"
        style={{ borderColor: C2.border, background: "#fff", color: C2.ink }}
      />
    </div>
  );
}
```

### 6.5 `src/components/launches/Timeline.jsx` — 8단계 stepper

```jsx
import React from "react";
import { Check } from "lucide-react";

const C = {
  ink: "#1A1917", ink2: "#3A362E", muted: "#6B6458", border: "#E5E1D6",
  forest: "#1E3A2F", forestLight: "#E8EDE8", terracotta: "#C65D3A",
};

const STAGE_LABELS = {
  searching: "물건탐색", visiting: "현장확인", contracting: "계약진행",
  paying: "잔금납부", cleaning: "청소", setup: "셋팅",
  listing: "플랫폼 등록", live: "판매게시",
};

export default function Timeline({ stages, currentStage, onStageClick }) {
  return (
    <div className="flex items-center gap-1">
      {stages.map((s, i) => {
        const isCompleted = !!s.completedAt;
        const isCurrent = s.stage === currentStage;
        const isFuture = !isCompleted && !isCurrent;

        const bg = isCompleted ? C.forest : isCurrent ? C.forestLight : "#fff";
        const fg = isCompleted ? "#fff" : isCurrent ? C.forest : C.muted;
        const borderColor = isCompleted ? C.forest : isCurrent ? C.forest : C.border;

        return (
          <React.Fragment key={s.stage}>
            <button
              onClick={() => onStageClick && onStageClick(s)}
              className="flex flex-col items-center gap-1 transition-transform hover:scale-105"
              style={{ minWidth: 64 }}
            >
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold border-2"
                style={{ background: bg, color: fg, borderColor }}
              >
                {isCompleted ? <Check size={14} /> : i + 1}
              </div>
              <div
                className="text-[10px] text-center font-medium leading-tight"
                style={{ color: isCurrent ? C.forest : isFuture ? C.muted : C.ink2 }}
              >
                {STAGE_LABELS[s.stage]}
              </div>
            </button>
            {i < stages.length - 1 && (
              <div
                className="flex-1 h-0.5 rounded"
                style={{
                  background: isCompleted ? C.forest : C.border,
                  minWidth: 16,
                }}
              />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}
```

### 6.6 `src/components/launches/StageModal.jsx` — 단계 정보 수정

```jsx
import React, { useState } from "react";
import { X } from "lucide-react";

const C = {
  card: "#FFFFFF", ink: "#1A1917", ink2: "#3A362E", muted: "#6B6458",
  border: "#E5E1D6", forest: "#1E3A2F", red: "#A63D2A",
};

const STAGE_LABELS = {
  searching: "물건탐색", visiting: "현장확인", contracting: "계약진행",
  paying: "잔금납부", cleaning: "청소", setup: "셋팅",
  listing: "플랫폼 등록", live: "판매게시",
};

export default function StageModal({ launchId, stage, onClose, onSaved }) {
  const [form, setForm] = useState({
    targetDate: stage.targetDate ? stage.targetDate.split("T")[0] : "",
    assignee: stage.assignee || "",
    issue: stage.issue || "",
    cost: stage.cost ?? 0,
    memo: stage.memo || "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const handleChange = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const payload = {
      targetDate: form.targetDate || null,
      assignee: form.assignee || null,
      issue: form.issue || null,
      cost: Number(form.cost) || 0,
      memo: form.memo || null,
    };

    try {
      const res = await fetch(`/api/launches/${launchId}/stages/${stage.stage}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(`PATCH 실패: ${await res.text()}`);
      onSaved();
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.4)" }}
      onClick={onClose}
    >
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={handleSubmit}
        className="w-[440px] rounded-xl p-6 space-y-4"
        style={{ background: C.card, border: `1px solid ${C.border}` }}
      >
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-lg font-medium" style={{ color: C.ink }}>
              {STAGE_LABELS[stage.stage]}
            </h3>
            <p className="text-xs" style={{ color: C.muted }}>
              {stage.enteredAt ? `진입일: ${stage.enteredAt.split("T")[0]}` : "미진입"}
              {stage.completedAt && ` · 완료: ${stage.completedAt.split("T")[0]}`}
            </p>
          </div>
          <button type="button" onClick={onClose} className="p-1">
            <X size={18} style={{ color: C.muted }} />
          </button>
        </div>

        <Field label="목표일" type="date" value={form.targetDate} onChange={handleChange("targetDate")} />
        <Field label="담당자" value={form.assignee} onChange={handleChange("assignee")} />
        <Field label="비용 (원)" type="number" value={form.cost} onChange={handleChange("cost")} />

        <div>
          <label className="text-xs font-semibold" style={{ color: C.muted }}>이슈/문제</label>
          <textarea
            value={form.issue}
            onChange={handleChange("issue")}
            rows={2}
            className="w-full mt-1 px-3 py-2 rounded-lg text-sm outline-none border resize-none"
            style={{ borderColor: C.border, background: "#fff", color: C.ink }}
          />
        </div>
        <div>
          <label className="text-xs font-semibold" style={{ color: C.muted }}>메모</label>
          <textarea
            value={form.memo}
            onChange={handleChange("memo")}
            rows={2}
            className="w-full mt-1 px-3 py-2 rounded-lg text-sm outline-none border resize-none"
            style={{ borderColor: C.border, background: "#fff", color: C.ink }}
          />
        </div>

        {error && (
          <div className="text-xs p-2 rounded" style={{ background: "#FEF2F2", color: C.red }}>
            {error}
          </div>
        )}

        <div className="flex gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2 rounded-lg text-sm border"
            style={{ borderColor: C.border, color: C.ink2 }}
          >
            취소
          </button>
          <button
            type="submit"
            disabled={saving}
            className="flex-1 py-2 rounded-lg text-sm font-medium"
            style={{ background: C.forest, color: "#fff", opacity: saving ? 0.6 : 1 }}
          >
            {saving ? "저장 중..." : "저장"}
          </button>
        </div>
      </form>
    </div>
  );
}

function Field({ label, type = "text", value, onChange }) {
  const C2 = { border: "#E5E1D6", muted: "#6B6458", ink: "#1A1917" };
  return (
    <div>
      <label className="text-xs font-semibold" style={{ color: C2.muted }}>{label}</label>
      <input
        type={type}
        value={value}
        onChange={onChange}
        className="w-full mt-1 px-3 py-2 rounded-lg text-sm outline-none border"
        style={{ borderColor: C2.border, background: "#fff", color: C2.ink }}
      />
    </div>
  );
}
```

### 6.7 `src/pages/LaunchDetail.jsx` — 상세 페이지

```jsx
import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, ArrowRight, Archive, Link2, Loader2, Coins, MapPin, FileText } from "lucide-react";
import Timeline from "../components/launches/Timeline.jsx";
import StageModal from "../components/launches/StageModal.jsx";

const C = {
  bg: "#F5F2EC", card: "#FFFFFF", ink: "#1A1917", ink2: "#3A362E",
  muted: "#6B6458", border: "#E5E1D6", forest: "#1E3A2F", forestLight: "#E8EDE8",
  red: "#A63D2A", green: "#4A7A4A", terracotta: "#C65D3A",
};

const STAGE_LABELS = {
  searching: "물건탐색", visiting: "현장확인", contracting: "계약진행",
  paying: "잔금납부", cleaning: "청소", setup: "셋팅",
  listing: "플랫폼 등록", live: "판매게시",
};

export default function LaunchDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [launch, setLaunch] = useState(null);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editingStage, setEditingStage] = useState(null);
  const [hostexId, setHostexId] = useState("");
  const [linking, setLinking] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [l, s] = await Promise.all([
        fetch(`/api/launches/${id}`).then((r) => r.json()),
        fetch(`/api/launches/${id}/summary`).then((r) => r.json()),
      ]);
      setLaunch(l);
      setSummary(s);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [id]);

  const handleAdvance = async () => {
    if (!confirm("다음 단계로 진행할까요?")) return;
    try {
      const res = await fetch(`/api/launches/${id}/advance`, { method: "POST" });
      if (!res.ok) throw new Error(await res.text());
      fetchData();
    } catch (e) {
      alert("진행 실패: " + e.message);
    }
  };

  const handleAbandon = async () => {
    const reason = prompt("포기 사유:");
    if (reason === null) return;
    try {
      const res = await fetch(`/api/launches/${id}/abandon`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      if (!res.ok) throw new Error(await res.text());
      fetchData();
    } catch (e) {
      alert("포기 실패: " + e.message);
    }
  };

  const handleLink = async () => {
    if (!hostexId.trim()) return;
    setLinking(true);
    try {
      const res = await fetch(`/api/launches/${id}/link-property`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hostexId: hostexId.trim() }),
      });
      if (!res.ok) throw new Error(await res.text());
      const result = await res.json();
      alert(result.created ? `Properties에 신규 생성됨 (id: ${result.propertyId})` : `기존 Property와 연결됨 (id: ${result.propertyId})`);
      fetchData();
    } catch (e) {
      alert("연결 실패: " + e.message);
    } finally {
      setLinking(false);
    }
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 size={28} className="animate-spin" style={{ color: C.forest }} />
      </div>
    );
  }

  if (error || !launch) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-3" style={{ color: C.red }}>
        오류: {error || "런칭을 찾을 수 없습니다"}
        <button
          onClick={() => navigate("/admin/launches")}
          className="px-3 py-1 rounded text-sm"
          style={{ background: C.forest, color: "white" }}
        >
          돌아가기
        </button>
      </div>
    );
  }

  const isLive = launch.status === "live";
  const isAbandoned = launch.status === "abandoned";

  return (
    <div className="h-full overflow-y-auto pr-1 space-y-5">
      {/* 헤더 */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <button
            onClick={() => navigate("/admin/launches")}
            className="p-2 rounded-lg hover:bg-white/50 transition"
          >
            <ArrowLeft size={18} style={{ color: C.muted }} />
          </button>
          <div>
            <h2 className="text-2xl font-medium mb-1" style={{ color: C.ink }}>
              {launch.name}
            </h2>
            <div className="text-sm flex items-center gap-3" style={{ color: C.muted }}>
              <span className="flex items-center gap-1">
                <MapPin size={12} /> {launch.address}
              </span>
              {launch.area && <span>· {launch.area}㎡</span>}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {!isLive && !isAbandoned && (
            <>
              <button
                onClick={handleAbandon}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm border"
                style={{ borderColor: C.border, color: C.red }}
              >
                <Archive size={14} /> 포기
              </button>
              <button
                onClick={handleAdvance}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium"
                style={{ background: C.forest, color: "#fff" }}
              >
                다음 단계 <ArrowRight size={14} />
              </button>
            </>
          )}
        </div>
      </div>

      {/* 진행 상태 카드 */}
      <div
        className="rounded-xl p-5"
        style={{ background: C.card, border: `1px solid ${C.border}` }}
      >
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="text-xs uppercase tracking-widest font-semibold" style={{ color: C.muted }}>
              현재 단계
            </div>
            <div className="text-lg font-medium mt-1" style={{ color: C.ink }}>
              {STAGE_LABELS[launch.currentStage]}
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs" style={{ color: C.muted }}>진행률</div>
            <div className="text-lg font-medium" style={{ color: C.forest }}>
              {summary?.progress || "0/8"}
            </div>
          </div>
        </div>
        <Timeline
          stages={launch.stages}
          currentStage={launch.currentStage}
          onStageClick={(s) => setEditingStage(s)}
        />
      </div>

      {/* 요약 정보 그리드 */}
      <div className="grid grid-cols-3 gap-3">
        <InfoCard label="총 비용" value={summary?.totalCost ? `₩${(summary.totalCost / 10000).toFixed(0)}만` : "—"} icon={Coins} />
        <InfoCard label="누적 일수" value={summary?.totalDays ? `${summary.totalDays}일` : "—"} />
        <InfoCard label="예상 월매출" value={launch.expectedMonthlyRevenue ? `₩${(launch.expectedMonthlyRevenue / 10000).toFixed(0)}만` : "—"} />
      </div>

      {/* 이슈 목록 */}
      {summary?.issues?.length > 0 && (
        <div className="rounded-xl p-5" style={{ background: C.card, border: `1px solid ${C.border}` }}>
          <div className="text-sm font-medium mb-3" style={{ color: C.ink }}>
            🚩 이슈 ({summary.issues.length}건)
          </div>
          <div className="space-y-2">
            {summary.issues.map((iss, i) => (
              <div key={i} className="text-sm p-3 rounded-lg" style={{ background: "#FEF2F2", color: C.ink2 }}>
                <div className="font-semibold text-xs" style={{ color: C.red }}>
                  {STAGE_LABELS[iss.stage]} {iss.assignee && `· ${iss.assignee}`}
                </div>
                <div className="mt-1">{iss.issue}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* LIVE 단계: Properties 연결 */}
      {isLive && !launch.hostexId && (
        <div className="rounded-xl p-5" style={{ background: C.forestLight, border: `1px solid ${C.forest}` }}>
          <div className="flex items-center gap-2 mb-3">
            <Link2 size={16} style={{ color: C.forest }} />
            <div className="text-sm font-medium" style={{ color: C.forest }}>
              Properties에 연결
            </div>
          </div>
          <div className="text-xs mb-3" style={{ color: C.ink2 }}>
            Hostex에 호실 등록 후 받은 ID를 입력하세요. 자동으로 Properties 테이블에 등록됩니다.
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={hostexId}
              onChange={(e) => setHostexId(e.target.value)}
              placeholder="Hostex Property ID"
              className="flex-1 px-3 py-2 rounded-lg text-sm outline-none border"
              style={{ borderColor: C.border, background: "#fff" }}
            />
            <button
              onClick={handleLink}
              disabled={linking || !hostexId.trim()}
              className="px-4 py-2 rounded-lg text-sm font-medium"
              style={{ background: C.forest, color: "#fff", opacity: linking ? 0.6 : 1 }}
            >
              {linking ? "연결 중..." : "연결"}
            </button>
          </div>
        </div>
      )}

      {isLive && launch.hostexId && (
        <div className="rounded-xl p-4 text-sm" style={{ background: C.forestLight, color: C.forest }}>
          ✅ Properties 연결됨 (Hostex ID: {launch.hostexId})
        </div>
      )}

      {/* 메모 */}
      {launch.memo && (
        <div className="rounded-xl p-5" style={{ background: C.card, border: `1px solid ${C.border}` }}>
          <div className="text-xs uppercase tracking-widest font-semibold mb-2" style={{ color: C.muted }}>
            메모
          </div>
          <div className="text-sm whitespace-pre-wrap" style={{ color: C.ink2 }}>
            {launch.memo}
          </div>
        </div>
      )}

      {/* 단계 수정 모달 */}
      {editingStage && (
        <StageModal
          launchId={launch.id}
          stage={editingStage}
          onClose={() => setEditingStage(null)}
          onSaved={() => {
            setEditingStage(null);
            fetchData();
          }}
        />
      )}
    </div>
  );
}

function InfoCard({ label, value, icon: Icon }) {
  const C2 = { card: "#FFFFFF", ink: "#1A1917", muted: "#6B6458", border: "#E5E1D6" };
  return (
    <div className="rounded-xl p-4" style={{ background: C2.card, border: `1px solid ${C2.border}` }}>
      <div className="flex items-center gap-1.5 mb-2">
        {Icon && <Icon size={12} style={{ color: C2.muted }} />}
        <div className="text-xs uppercase tracking-widest font-semibold" style={{ color: C2.muted }}>
          {label}
        </div>
      </div>
      <div className="text-lg font-medium" style={{ color: C2.ink }}>
        {value}
      </div>
    </div>
  );
}
```

---

### 6.8 `src/hooks/useLaunches.js` — API 호출 로직 분리

```jsx
import { useState, useEffect, useCallback } from "react";

/**
 * 칸반 데이터 fetch 훅
 * @returns {{ kanban, loading, error, refresh }}
 */
export function useKanban() {
  const [kanban, setKanban] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetch_ = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/launches/kanban");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setKanban(await res.json());
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetch_(); }, [fetch_]);

  return { kanban, loading, error, refresh: fetch_ };
}

/**
 * 단일 런칭 + summary fetch 훅
 */
export function useLaunch(id) {
  const [launch, setLaunch] = useState(null);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetch_ = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const [l, s] = await Promise.all([
        fetch(`/api/launches/${id}`).then((r) => {
          if (!r.ok) throw new Error(`HTTP ${r.status}`);
          return r.json();
        }),
        fetch(`/api/launches/${id}/summary`).then((r) => {
          if (!r.ok) throw new Error(`summary HTTP ${r.status}`);
          return r.json();
        }),
      ]);
      setLaunch(l);
      setSummary(s);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { fetch_(); }, [fetch_]);

  return { launch, summary, loading, error, refresh: fetch_ };
}

/**
 * 포기됨 목록 fetch 훅
 */
export function useAbandonedLaunches() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetch_ = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/launches/abandoned");
      if (res.ok) setItems(await res.json());
    } catch {}
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetch_(); }, [fetch_]);

  return { items, loading, refresh: fetch_ };
}

// === 액션 함수들 (단발성 호출, 컴포넌트가 await로 사용) ===

export async function createLaunch(payload) {
  const res = await fetch("/api/launches", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`생성 실패: ${await res.text()}`);
  return res.json();
}

export async function advanceLaunch(id) {
  const res = await fetch(`/api/launches/${id}/advance`, { method: "POST" });
  if (!res.ok) throw new Error(`다음 단계 실패: ${await res.text()}`);
  return res.json();
}

export async function abandonLaunch(id, reason) {
  const res = await fetch(`/api/launches/${id}/abandon`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ reason }),
  });
  if (!res.ok) throw new Error(`포기 실패: ${await res.text()}`);
  return res.json();
}

export async function updateStage(launchId, stage, payload) {
  const res = await fetch(`/api/launches/${launchId}/stages/${stage}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`PATCH 실패: ${await res.text()}`);
  return res.json();
}

export async function linkToProperty(id, hostexId) {
  const res = await fetch(`/api/launches/${id}/link-property`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ hostexId }),
  });
  if (!res.ok) throw new Error(`연결 실패: ${await res.text()}`);
  return res.json();
}
```

**사용 예시 (Launches.jsx 단순화):**
```jsx
import { useKanban, useAbandonedLaunches } from "../hooks/useLaunches.js";

export default function Launches() {
  const { kanban, loading, error, refresh } = useKanban();
  const { items: abandoned } = useAbandonedLaunches();
  // ...훨씬 깔끔해짐
}
```

### 6.9 `src/utils/launchUtils.js` — 포맷팅 유틸

⚠️ **중요**: `isOverdue`, `daysInStage`, `progress` 같은 **계산은 백엔드가 이미 하므로 여기에 포함하지 않음**. 이 파일은 순수 포맷팅만.

```javascript
// 단계 라벨 (백엔드 enum과 동일)
export const STAGE_LABELS = {
  searching:    "물건탐색",
  visiting:     "현장확인",
  contracting:  "계약진행",
  paying:       "잔금납부",
  cleaning:     "청소",
  setup:        "셋팅",
  listing:      "플랫폼 등록",
  live:         "판매게시",
};

export const STAGES_IN_ORDER = [
  "searching", "visiting", "contracting", "paying",
  "cleaning", "setup", "listing", "live"
];

// 단계 라벨 조회 (안전)
export const getStageLabel = (stage) => STAGE_LABELS[stage] || stage;

// 한국어 통화 포맷 — 만원 단위
export const krwMan = (n) => {
  if (n == null || !Number.isFinite(Number(n))) return "—";
  return `${Math.round(n / 10000).toLocaleString()}만`;
};

// 한국어 통화 포맷 — 억/만 자동
export const krw = (n) => {
  if (n == null || !Number.isFinite(Number(n))) return "—";
  const abs = Math.abs(n);
  if (abs >= 100_000_000) return `${(n / 100_000_000).toFixed(1)}억`;
  if (abs >= 10_000) return `${Math.round(n / 10_000).toLocaleString()}만`;
  return n.toLocaleString("ko-KR");
};

// 날짜 포맷 (YYYY-MM-DD)
export const ymd = (d) => {
  if (!d) return "";
  if (typeof d === "string") return d.split("T")[0];
  if (d instanceof Date) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${dd}`;
  }
  return "";
};

// 상대 시간 표시 ("3일 전")
export const relativeDays = (d) => {
  if (!d) return "—";
  const t = new Date(d).getTime();
  if (isNaN(t)) return "—";
  const days = Math.floor((Date.now() - t) / 86400000);
  if (days === 0) return "오늘";
  if (days < 0) return `${-days}일 후`;
  if (days < 30) return `${days}일 전`;
  const months = Math.floor(days / 30);
  return `${months}개월 전`;
};

// 상태 라벨
export const STATUS_LABELS = {
  active:    "진행중",
  live:      "운영중",
  abandoned: "포기됨",
};

// 진행률 (0~1) — 백엔드가 progress 안 줄 때만 사용
// 보통 summary.progress (e.g. "5/8") 그대로 사용 권장
export const progressFraction = (currentStage) => {
  const idx = STAGES_IN_ORDER.indexOf(currentStage);
  if (idx < 0) return 0;
  return (idx + 1) / 8;
};
```

---

## 7. 작업 순서 (스텝별)

```
1. main.jsx에 import + Route 2줄 추가
2. Layout.jsx에 Rocket import + navItems 한 줄 추가
3. 폴더 생성:
   src/components/launches/
   src/hooks/
   src/utils/
4. utils/launchUtils.js 생성 (Section 6.9 코드 복사)
5. hooks/useLaunches.js 생성 (Section 6.8 코드 복사)
6. components/launches/ 5개 파일 생성:
   LaunchList.jsx (6.2)
   LaunchCard.jsx (6.3)
   Timeline.jsx (6.5)
   StageModal.jsx (6.6)
   NewLaunchModal.jsx (6.4)
7. pages/Launches.jsx 생성 (6.1)
   → useKanban 훅 사용하도록 단순화
8. pages/LaunchDetail.jsx 생성 (6.7)
   → useLaunch 훅 사용하도록 단순화
9. 빌드 확인: npm run build (또는 dev 새로고침)
10. /admin/launches 접속해서 빈 칸반 보이는지 확인
11. + 새 런칭 클릭해서 1건 생성
12. 카드 클릭 → 상세 진입 → "다음 단계" 클릭 테스트
```

---

## 8. 검증 체크리스트

- [ ] `/admin/launches` 페이지 접근 가능
- [ ] 사이드바에 "런칭 운영" 항목 노출
- [ ] 8개 칸반 컬럼 보임 (빈 상태)
- [ ] "+ 새 런칭" 클릭 시 모달 열림
- [ ] 새 런칭 생성 후 SEARCHING 컬럼에 카드 등장
- [ ] 카드 클릭 → `/admin/launches/:id` 페이지 이동
- [ ] Timeline 8단계 stepper 표시
- [ ] "다음 단계" 클릭 시 currentStage 변경 + 칸반에서 다음 컬럼으로 이동
- [ ] Timeline의 단계 클릭 시 StageModal 열림 (목표일/담당자/비용/이슈/메모 입력)
- [ ] LIVE 도달 시 Hostex ID 입력 폼 노출
- [ ] Hostex ID 입력 후 "연결" 클릭 → Properties 자동 등록
- [ ] 포기됨 탭에서 abandoned 런칭 목록 표시
- [ ] overdue (7일 이상 stuck) 카드 빨간 테두리 + ⚠ 아이콘
- [ ] daysInStage 카운트 정확히 표시

---

## 9. 절대 하지 말 것

1. **새 Context 만들기** — useState로 충분
2. **드래그앤드롭 라이브러리 추가** — 처음엔 클릭으로 advance만
3. **벤치마크 호실 멀티셀렉트** — 첫 버전에선 생략 (나중에 추가)
4. **자동 Hostex 등록** — heiro가 수동으로 hostexId 입력 후 link-property 호출
5. **새 디자인 토큰** — C 객체 그대로 복사

---

## 10. 알려진 제약사항 (heiro 인지 필요)

- `linkToProperty` 호출 시 propertiesService.create()가 어떤 필드를 요구하는지 백엔드에서 확인 필요. 현재 `{ hostexId, title, address }`로 호출되며 추가 required 필드가 있으면 백엔드 수정 필요.
- `attachments` 사진 업로드는 이번 phase에 포함 안 됨 (URL 입력만 가능)
- 알림 badge (overdue 카운트)는 다음 phase

---

작업 완료 후 `/admin/launches` 스크린샷 1장 + 검증 체크리스트 결과 보고.
