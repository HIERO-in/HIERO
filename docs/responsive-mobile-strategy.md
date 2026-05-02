# HIERO 반응형 모바일 전략 — 점진적 보강 가이드

> 데스크탑 first 코드를 모바일 친화적으로 보강.
> Phase 1 (반응형) → Phase 2 (PWA, 나중) → Phase 3 (Capacitor 앱, 나중)

---

## 0. 전략 요약

```
지금 단계: Phase 1 — 반응형 웹 (옵션 A)
  ├─ 새 컴포넌트는 mobile-first 클래스로 작성
  ├─ 기존 페이지는 점진적으로 반응형 보강
  └─ 추가 작업량: 페이지당 30분~1시간

다음 단계 (3~6개월 후):
  Phase 2 — PWA 변환 (manifest + service worker)

먼 미래:
  Phase 3 — Capacitor로 iOS/Android 네이티브 앱
```

**원칙: 백엔드 손 안 댐. 프론트만 진화.**

---

## 1. Tailwind 반응형 기준

```
sm:  640px 이상  (큰 폰)
md:  768px 이상  (태블릿)
lg:  1024px 이상 (작은 데스크탑)
xl:  1280px 이상 (큰 데스크탑)
```

**Mobile-first 작성 원칙:**
```jsx
// 기본 클래스 = 모바일 (640px 미만)
// sm:, md:, lg: 접두사로 점진 확장

// ❌ 옛 방식 (데스크탑 우선)
<div className="grid grid-cols-4 gap-4">

// ✅ 새 방식 (모바일 우선)
<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
```

---

## 2. 즉시 작업 (Phase 1.1) — Layout 모바일 대응

`src/Layout.jsx` 수정.

### 2.1 모바일 사이드바 토글

```jsx
import { useState } from "react";
import { Menu, X } from "lucide-react";

export default function Layout() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false); // ← NEW

  return (
    <div className="flex h-screen bg-[#F5F2EC] overflow-hidden">
      {/* 모바일 백드롭 (메뉴 열렸을 때 어둡게) */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-40 lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* 사이드바 — 모바일에서는 absolute, 데스크탑에서는 static */}
      <aside
        className={`
          ${collapsed ? "w-[72px]" : "w-[240px]"}
          fixed lg:static inset-y-0 left-0 z-50
          bg-[#1A1917] flex flex-col transition-transform duration-300 shrink-0
          ${mobileMenuOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
        `}
      >
        {/* 기존 사이드바 내용 그대로 */}
        {/* navItems 클릭 시 mobileMenuOpen=false 처리 */}
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        {/* 헤더 */}
        <header className="h-14 bg-white border-b border-[#E5E1D6] flex items-center justify-between px-4 shrink-0">
          {/* 햄버거 (모바일만) */}
          <button
            onClick={() => setMobileMenuOpen(true)}
            className="lg:hidden p-2 rounded hover:bg-[#F5F2EC]"
          >
            <Menu size={20} className="text-[#6B6458]" />
          </button>

          {/* 페이지 타이틀 (기존) */}
          <h1>{pageTitle}</h1>

          {/* 검색 — 모바일에서는 축약 */}
          <div className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-[#F5F2EC] rounded-lg">
            ...
          </div>
        </header>

        <main className="flex-1 overflow-hidden p-3 lg:p-4">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
```

### 2.2 검증
- 모바일 (브라우저 폭 640px): 햄버거 표시, 사이드바 숨김, 클릭 시 슬라이드 인
- 태블릿 (768px): 동일
- 데스크탑 (1024px+): 햄버거 숨김, 사이드바 항상 보임

---

## 3. 페이지별 반응형 보강 (Phase 1.2)

### 3.1 Dashboard.jsx

**현재 KPI 카드 (12개, 4열):**
```jsx
<div className="grid grid-cols-4 gap-3 mb-4">
  <KpiCard ... />
</div>
```

**변경:**
```jsx
<div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3 mb-4">
```

**일별 차트 + 상세 (3:1 grid):**
```jsx
// 현재
<div className="grid grid-cols-3 gap-3">
// 변경
<div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
```

차트는 ResponsiveContainer 사용 중이라 자동 대응. 단지 height만 모바일에서 조정:
```jsx
<div style={{ height: "200px" }} className="lg:h-[280px]">
```

### 3.2 PortfolioHealth.jsx

**호실 리스트** (현재 데스크탑 표 형태):
```jsx
// 모바일에서는 카드형으로 변환
<div className="hidden lg:block">
  {/* 데스크탑 표 */}
</div>
<div className="lg:hidden space-y-2">
  {/* 모바일 카드 — 한 호실당 카드 한 장 */}
  {evaluations.map(ev => (
    <div className="bg-white rounded-xl p-3 border border-[#E5E1D6]">
      <div className="flex items-center justify-between">
        <span className="font-medium">{ev.title}</span>
        <ScoreBadge score={ev.score} />
      </div>
      <div className="grid grid-cols-3 gap-2 mt-2 text-xs">
        <Stat label="수익" value={ev.profit} />
        <Stat label="점유" value={ev.occupancy} />
        <Stat label="마진" value={ev.margin} />
      </div>
    </div>
  ))}
</div>
```

### 3.3 Calendar.jsx (간트 달력)

가장 까다로운 페이지. 모바일에선 가로 스크롤 + 호실 짧게:
```jsx
<div className="overflow-x-auto">
  <div className="min-w-[800px] lg:min-w-0">
    {/* 기존 간트 그리드 */}
  </div>
</div>
```

또는 모바일 모드에서는 7일 보기 한정:
```jsx
const [days, setDays] = useState(window.innerWidth < 768 ? 7 : 30);
```

### 3.4 Reservations.jsx

**표 → 모바일 카드** (PortfolioHealth와 같은 패턴):
```jsx
<div className="hidden md:block">
  <table>...</table>
</div>
<div className="md:hidden space-y-2">
  {filtered.map(r => (
    <ReservationCard key={r.id} reservation={r} onClick={...} />
  ))}
</div>
```

`ReservationCard.jsx` 신규 컴포넌트:
- 채널 아이콘 + 게스트 + 호실
- 체크인~아웃 + 박수
- 매출 + 마진
- 클릭 시 드로어

### 3.5 Launches.jsx (칸반)

**칸반 8칸 → 모바일에선 세로 stack 또는 가로 스크롤:**
```jsx
// 옵션 A: 가로 스크롤 (현재 동작 비슷)
<div className="overflow-x-auto pb-4 -mx-3 lg:mx-0">
  <div className="flex gap-3 px-3 lg:px-0" style={{ minWidth: 1200 }}>
    {/* 8 columns */}
  </div>
</div>

// 옵션 B: 모바일에선 세로 (단계 선택 드롭다운)
{isMobile ? (
  <>
    <select value={selectedStage} onChange={...}>
      {STAGES.map(s => <option>{s.label}</option>)}
    </select>
    <div className="space-y-2">
      {/* 선택된 단계의 카드만 */}
    </div>
  </>
) : (
  /* 칸반 8칸 */
)}
```

권장: **옵션 A** (가로 스크롤, 더 단순)

### 3.6 LaunchDetail.jsx

Timeline의 8단계 stepper가 모바일에서 가장 까다로움:
```jsx
<div className="overflow-x-auto pb-2">
  <div className="flex items-center gap-1" style={{ minWidth: 600 }}>
    {/* 8개 stage stepper */}
  </div>
</div>
```

### 3.7 CostManagement.jsx
- 매트릭스 뷰: `overflow-x-auto`로 가로 스크롤
- KPI: `grid-cols-2 lg:grid-cols-4`
- 입력 폼: 모바일에서 폭 100%

### 3.8 Properties.jsx
- 호실 카드 grid: `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4`

---

## 4. 공통 패턴 (Phase 1.3)

### 4.1 Modal 모바일 풀스크린

```jsx
// 데스크탑: 가운데 작은 박스
// 모바일: 거의 풀스크린

<div
  className="
    w-full max-w-[420px] m-4
    sm:m-auto
    h-auto max-h-[90vh] overflow-y-auto
    rounded-xl
  "
>
```

NewLaunchModal.jsx, StageModal.jsx 둘 다 이 패턴 적용.

### 4.2 클릭 영역 최소 44px (Apple HIG)

```jsx
// 작은 버튼/아이콘 클릭 영역 보장
<button className="p-2 min-w-[44px] min-h-[44px]">
  <X size={16} />
</button>
```

### 4.3 폰트 크기 최소

- body 텍스트: 14px (text-sm) 최소
- 데스크탑에서만 작은 글자: `text-xs lg:text-[10px]`

### 4.4 가로 스크롤 표 (어쩔 수 없을 때)

```jsx
<div className="overflow-x-auto -mx-3 px-3 sm:mx-0 sm:px-0">
  <table className="min-w-full">...</table>
</div>
```

`-mx-3 px-3`로 모바일에서 좌우 가장자리까지 스크롤 가능하게.

### 4.5 폼 입력 필드

```jsx
// 모바일 input 16px 미만이면 iOS Safari가 자동 줌함
<input className="text-base sm:text-sm" />  // 모바일은 16px, 데스크탑은 14px
```

---

## 5. 작업 순서 (4주 분할)

### 1주차 — Layout + 공통 패턴
- [ ] Layout.jsx 모바일 사이드바 토글 + 햄버거 메뉴
- [ ] 모달 패턴 (max-w + 모바일 풀스크린)
- [ ] 디자인 토큰 검증 (폰트 크기, 클릭 영역)

### 2주차 — Dashboard + PortfolioHealth
- [ ] Dashboard 반응형 grid + 차트 height
- [ ] PortfolioHealth 모바일 카드 변환

### 3주차 — Reservations + Calendar
- [ ] Reservations 표 → 카드 (모바일)
- [ ] Calendar 가로 스크롤 처리

### 4주차 — Launches + Properties + Costs
- [ ] Launches 칸반 + LaunchDetail Timeline
- [ ] Properties grid
- [ ] CostManagement 매트릭스

---

## 6. 검증 방법

### 6.1 Chrome DevTools
1. F12 → 개발자도구
2. 좌측 상단 모바일 아이콘 클릭 (또는 Cmd+Shift+M)
3. iPhone 14 Pro / iPad / Galaxy S20 등 선택
4. 각 페이지 클릭하면서 깨지는 부분 확인

### 6.2 실제 폰
- heiro 핸드폰에서 `localhost:5173/admin/...` 직접 접속
- 같은 WiFi에서 가능
- 컴퓨터 IP: `ifconfig | grep "inet "` → `192.168.x.x:5173`

### 6.3 페이지별 체크리스트
각 페이지 저장 시:
- [ ] 모바일 (375px): 좌우 스크롤 없음, 텍스트 안 깨짐
- [ ] 태블릿 (768px): 적절히 2~3열로 변환
- [ ] 데스크탑 (1280px+): 기존과 동일

---

## 7. Phase 2 — PWA 변환 (나중)

3~6개월 후 안정화되면 추가:

```bash
# Vite PWA 플러그인
npm install -D vite-plugin-pwa
```

`vite.config.js`:
```js
import { VitePWA } from 'vite-plugin-pwa';

export default {
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'HIERO',
        short_name: 'HIERO',
        theme_color: '#1E3A2F',
        icons: [...]
      }
    })
  ]
};
```

추가 항목:
- 아이콘 192x192, 512x512
- splash screen
- service worker (오프라인 캐싱)
- 홈 화면 추가 안내 배너

작업량: ~1주

---

## 8. Phase 3 — Capacitor 네이티브 앱 (먼 미래)

사업 확장 + 임대인/직원용 별도 앱 필요할 때:

```bash
npm install @capacitor/core @capacitor/cli
npx cap init HIERO com.hiero.app
npx cap add ios
npx cap add android
```

추가 작업:
- 푸시 알림 (FCM/APNs)
- 카메라 (호실 사진)
- GPS (현장 방문 기록)
- 생체 인증 (Face ID 로그인)
- App Store / Play Store 등록

작업량: 2~4주 + 앱스토어 심사 2~4주

---

## 9. 시작 — 1주차 작업 지시 (도나2/루카)

```
Layout.jsx 모바일 대응 작업:

1. mobileMenuOpen state 추가
2. 햄버거 메뉴 버튼 (모바일만, lg:hidden)
3. 사이드바 클래스 변경:
   - 데스크탑: 그대로
   - 모바일: fixed + transform translate-x-full → translate-x-0
4. 백드롭 추가 (사이드바 열렸을 때 어둡게)
5. nav 클릭 시 mobileMenuOpen=false (페이지 이동 후 메뉴 자동 닫힘)
6. 검색 input은 md: 이상에서만 표시
7. 메인 영역 패딩 p-3 lg:p-4

검증:
- Chrome DevTools 모바일 모드 (375px)
- 햄버거 → 사이드바 슬라이드 인
- 사이드바 외부 클릭 → 닫힘
- 페이지 nav 클릭 → 닫힘 + 페이지 이동
- 데스크탑(1024px+): 햄버거 숨김, 사이드바 항상 표시

빌드 후 보고.
```

