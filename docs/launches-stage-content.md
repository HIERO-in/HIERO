# Launches 단계별 콘텐츠 — 구현 지시서

> 8단계 각각의 콘텐츠를 정의하고, StageModal 컴포넌트를 단계별로 다르게 렌더링하기 위한 완전한 가이드.  
> 기존 `launches-frontend-implementation.md`(기본 구조)의 다음 단계.

---

## 0. 핵심 가치 (절대 잊지 말 것)

HIERO 핵심 차별화 = **생활권 × 등급 인벤토리 풀**
- 동일 생활권의 같은 등급 호실을 하나의 재고 풀로 관리
- 공실 발생 시 같은 풀의 다른 호실로 자동 대체 배정
- Launches는 **새 호실을 풀에 편입시키는 워크플로우**

→ 단순 운영 가이드가 아니라 **풀 확장 도구**가 되어야 함.

---

## 1. 백엔드 변경

### 1.1 LaunchStage entity에 details JSON 컬럼 추가

`hiero-backend/src/launches/entities/launch-stage.entity.ts`에 한 줄 추가:

```typescript
/** 단계별 다른 입력 데이터 (JSON) */
@Column({ type: 'json', nullable: true })
details: Record<string, any> | null;
```

### 1.2 UpdateStageDto에 details 필드 추가

`hiero-backend/src/launches/dto/update-stage.dto.ts`:

```typescript
import { IsOptional, IsObject } from 'class-validator';

export class UpdateStageDto {
  // ... 기존 필드
  
  @IsOptional()
  @IsObject()
  details?: Record<string, any>;
}
```

### 1.3 Service에서 details 처리

`hiero-backend/src/launches/launches.service.ts`의 `updateStage()` 함수에 한 줄 추가:

```typescript
if (dto.details !== undefined) stageRow.details = dto.details ?? null;
```

### 1.4 풀 매칭 endpoint 신규

`hiero-backend/src/launches/launches.controller.ts`:

```typescript
@Get('pool-stats')
getPoolStats(
  @Query('district') district: string,
  @Query('grade') grade?: string,
) {
  return this.launchesService.getPoolStats(district, grade);
}
```

`hiero-backend/src/launches/launches.service.ts`에 메서드 추가:

```typescript
async getPoolStats(district: string, grade?: string) {
  // properties 테이블에서 같은 district + grade 호실 통계
  // 일단 mock 응답 (나중에 실제 데이터로 연결)
  // TODO: properties.district, properties.grade 컬럼이 있다고 가정
  
  const props = await this.propertiesService.findAll();
  // 임시 매칭 — properties.address에 district 포함 여부로 매칭
  const filtered = props.filter((p: any) => 
    p.address && p.address.includes(district) &&
    (!grade || p.grade === grade)
  );
  
  if (filtered.length === 0) {
    return {
      district,
      grade,
      units: 0,
      avgADR: null,
      avgOccupancy: null,
      message: '해당 풀에 호실 없음 (신규 풀)',
    };
  }
  
  // TODO: 실 매출/점유율 계산은 reservations + transactions 조인 필요
  return {
    district,
    grade,
    units: filtered.length,
    avgADR: null,        // 나중에 계산
    avgOccupancy: null,  // 나중에 계산
    properties: filtered.map((p: any) => ({ id: p.id, title: p.title })),
  };
}
```

(점유율/ADR 정확한 계산은 Phase 2로 분리 — 지금은 같은 풀의 호실 갯수만 세도 충분히 쓸모 있음)

---

## 2. 프론트엔드 변경

### 2.1 STAGE_TEMPLATES 정의 — `src/utils/launchUtils.js`에 추가

```javascript
// === 단계별 콘텐츠 정의 ===
// 각 단계의 체크리스트, 입력 필드, 첨부 라벨, 가이드 텍스트
export const STAGE_TEMPLATES = {
  searching: {
    label: "물건탐색",
    purpose: "후보 발굴 + 풀 매칭 가능성 평가",
    guide: "어느 생활권/등급의 풀에 편입시킬지 1차 평가합니다.",
    showPoolMatch: true,    // 풀 매칭 위젯 표시
    checklist: [
      { id: "subway", label: "지하철역 도보 거리 (5분 이내 우선)" },
      { id: "exterior_photo", label: "외관 사진 확보" },
      { id: "interior_photo", label: "내부 사진 확보 (가능 시)" },
      { id: "no_basement", label: "1층/반지하 제외 확인" },
      { id: "year_built", label: "건축물 연식 확인" },
    ],
    fields: [
      { key: "district", label: "생활권", type: "select", required: true,
        options: ["성내동", "천호동", "길동", "암사동", "신규 생활권"] },
      { key: "expectedGrade", label: "예상 등급", type: "radio", required: false,
        options: ["S", "A", "B", "C", "미정"] },
      { key: "buildingYear", label: "건축물 연식 (년)", type: "number" },
      { key: "subwayName", label: "지하철역", type: "text", placeholder: "강남역" },
      { key: "subwayMinutes", label: "도보 분", type: "number" },
      { key: "areaSize", label: "전용면적 (㎡)", type: "number" },
      { key: "deposit", label: "보증금 (만원)", type: "number" },
      { key: "monthlyRent", label: "월세 (만원)", type: "number" },
      { key: "managementFee", label: "관리비 (만원)", type: "number" },
    ],
    attachLabel: "외관·내부 사진 (3~10장)",
    memoPlaceholder: "첫인상, 후보 선정 이유, 우려사항",
    tips: [
      "도보 5분 이내 지하철역 우선",
      "1층/반지하 제외",
      "주차 가능 여부 확인",
    ],
  },

  visiting: {
    label: "현장확인",
    purpose: "눈으로 검증 + 등급 확정",
    guide: "현장 방문하여 등급(S/A/B/C)을 확정합니다.",
    showPoolMatch: false,
    checklist: [
      { id: "leak", label: "누수 흔적 (천장/벽)" },
      { id: "mold", label: "곰팡이 (욕실/창문 주변)" },
      { id: "noise", label: "소음 평가 (인근 공사/도로/이웃)" },
      { id: "lighting", label: "채광 평가 (방향/시간대)" },
      { id: "parking", label: "주차 가능 여부" },
      { id: "elevator", label: "엘리베이터 작동" },
      { id: "security", label: "보안 (CCTV/도어락/비상구)" },
      { id: "hvac", label: "공조 (냉난방/환기)" },
      { id: "amenity_convenience", label: "동네 편의시설 (편의점/마트)" },
      { id: "amenity_health", label: "동네 편의시설 (병원/약국)" },
      { id: "amenity_leisure", label: "동네 편의시설 (공원/카페)" },
    ],
    fields: [
      { key: "visitDate", label: "방문일", type: "date" },
      { key: "companion", label: "동행자", type: "text" },
      { key: "confirmedGrade", label: "등급 확정", type: "radio", required: true,
        options: ["S", "A", "B", "C"] },
      { key: "evaluation", label: "전반 평가", type: "radio",
        options: ["양호", "보통", "우려"] },
      { key: "goodPoints", label: "좋은점", type: "textarea" },
      { key: "concerns", label: "우려점", type: "textarea" },
    ],
    attachLabel: "현장 사진 20장+ (거실/주방/욕실/침실/주변/외관)",
    memoPlaceholder: "곰팡이 위치, 소음 시간대, 특이사항",
    tips: [
      "20장 이상 다각도 사진",
      "동영상 1분 권장",
      "낮/저녁 두 번 방문 권장",
    ],
  },

  contracting: {
    label: "계약진행",
    purpose: "서류 + 협상",
    guide: "임대 계약을 체결합니다.",
    showPoolMatch: false,
    checklist: [
      { id: "registry", label: "등기부 등본 확인" },
      { id: "id_match", label: "임대인 신분증 (등기부 명의 일치)" },
      { id: "negotiate", label: "보증금/월세 조건 협상" },
      { id: "term", label: "임대 기간 확정" },
      { id: "special_terms", label: "특약 사항 작성" },
      { id: "broker_fee", label: "중개수수료 확정" },
      { id: "signature", label: "계약서 사인" },
    ],
    fields: [
      { key: "contractDate", label: "계약일", type: "date" },
      { key: "landlordName", label: "임대인 이름", type: "text" },
      { key: "landlordPhone", label: "임대인 연락처", type: "text" },
      { key: "finalDeposit", label: "확정 보증금 (만원)", type: "number" },
      { key: "finalMonthlyRent", label: "확정 월세 (만원)", type: "number" },
      { key: "leaseMonths", label: "임대 기간 (개월)", type: "number" },
      { key: "specialTerms", label: "특약 사항", type: "textarea" },
      { key: "brokerFee", label: "중개수수료 (만원)", type: "number" },
    ],
    attachLabel: "계약서 PDF, 등기부등본, 신분증 사본",
    memoPlaceholder: "협상 결과, 임대인 주의점",
    tips: [
      "등기부 명의 = 임대인 신분증 명의 반드시 확인",
      "선순위 권리 (근저당 등) 체크",
    ],
  },

  paying: {
    label: "잔금납부",
    purpose: "돈 이동 + 키 수령",
    guide: "잔금 송금하고 키를 수령합니다.",
    showPoolMatch: false,
    checklist: [
      { id: "bank_match", label: "입금 계좌 = 임대인 본인 명의" },
      { id: "receipt", label: "송금 영수증 보관" },
      { id: "key_received", label: "키 수령" },
      { id: "doorlock", label: "도어락 비번 변경" },
    ],
    fields: [
      { key: "balanceDate", label: "잔금일", type: "date" },
      { key: "balanceAmount", label: "잔금액 (만원)", type: "number" },
      { key: "keyReceivedDate", label: "키 수령일", type: "date" },
      { key: "keyCount", label: "키 갯수", type: "number" },
      { key: "doorlockPin", label: "새 도어락 비번 (저장 주의)", type: "text" },
    ],
    attachLabel: "송금 영수증, 등기 서류",
    memoPlaceholder: "입금 시각, 임대인 응대 메모",
    tips: [
      "도어락 비번은 입주 직후 즉시 변경",
      "키 갯수 기록 (퇴거 시 반환)",
    ],
  },

  cleaning: {
    label: "청소",
    purpose: "외주 관리",
    guide: "입주 청소를 진행합니다. (띵동 등 외주 또는 직접)",
    showPoolMatch: false,
    checklist: [
      { id: "vendor_select", label: "청소 업체 선정" },
      { id: "before_photo", label: "전 사진 촬영" },
      { id: "scope_agree", label: "청소 범위 협의 (화장실/주방/창문/벽지/바닥)" },
      { id: "in_progress", label: "진행 확인" },
      { id: "after_photo", label: "후 사진 촬영" },
      { id: "settlement", label: "비용 정산" },
    ],
    fields: [
      { key: "vendorName", label: "청소 업체명", type: "text", placeholder: "띵동, 클린타임 등" },
      { key: "vendorContact", label: "업체 연락처", type: "text" },
      { key: "cleaningDate", label: "청소일", type: "date" },
      { key: "cleaningType", label: "청소 종류", type: "radio",
        options: ["입주청소", "유지청소"] },
    ],
    attachLabel: "청소 전 사진, 청소 후 사진",
    memoPlaceholder: "청소 누락 부분, 추가 요청",
    tips: [
      "사진 전·후 비교용으로 같은 각도",
      "벽지·바닥 상태 기록 (퇴거 시 분쟁 대비)",
    ],
  },

  setup: {
    label: "셋팅",
    purpose: "물건 세팅 (5단계 세부)",
    guide: "등급에 맞는 컨셉으로 호실을 세팅합니다.",
    showPoolMatch: false,
    // ★ 셋팅은 sub-step이 5개 — UI에서 탭/스텝으로 표현
    subSteps: [
      {
        key: "concept",
        label: "1. 컨셉 정의",
        fields: [
          { key: "conceptName", label: "컨셉 이름", type: "text",
            placeholder: "모던 미니멀, 자연 친화 등" },
          { key: "targetGuest", label: "타깃 게스트", type: "text",
            placeholder: "비즈니스 출장객, 가족 여행 등" },
          { key: "colorScheme", label: "색상 톤", type: "text" },
          { key: "referenceUnit", label: "참고 호실", type: "text",
            placeholder: "L2 하람휴 902 같은 컨셉" },
        ],
      },
      {
        key: "purchase",
        label: "2. 물품구매승인",
        // 항목별 비용 — dynamic list
        fields: [
          { key: "purchaseList", label: "구매 항목", type: "itemList",
            itemFields: [
              { key: "name", label: "항목명", type: "text" },
              { key: "category", label: "카테고리", type: "select",
                options: ["가구", "가전", "침구", "주방", "욕실", "기타"] },
              { key: "quantity", label: "수량", type: "number" },
              { key: "amount", label: "비용", type: "number" },
            ],
          },
          { key: "totalBudget", label: "예산 합계 (자동 계산)", type: "computed" },
          { key: "approved", label: "heiro 승인", type: "checkbox" },
          { key: "approvedAt", label: "승인일", type: "date" },
        ],
      },
      {
        key: "install",
        label: "3. 현장설치",
        fields: [
          { key: "installStartDate", label: "설치 시작일", type: "date" },
          { key: "installEndDate", label: "설치 완료일", type: "date" },
          { key: "installer", label: "설치자", type: "text" },
        ],
        attachLabel: "설치 진행 사진",
      },
      {
        key: "verify",
        label: "4. 확인",
        // 게스트 시점 셀프 점검
        checklist: [
          { id: "bedding", label: "침구 정돈" },
          { id: "appliances", label: "가전 작동 (TV/에어컨/냉장고/세탁기)" },
          { id: "wifi", label: "와이파이 연결" },
          { id: "doorlock", label: "도어락 작동" },
          { id: "kitchen", label: "주방 비품 셋팅" },
          { id: "bathroom", label: "욕실 비품 셋팅" },
          { id: "lighting", label: "조명 점검" },
          { id: "ventilation", label: "환기 / 냉난방" },
          { id: "safety", label: "소화기/연기감지기" },
        ],
        attachLabel: "메인/거실/주방/침실/욕실 사진 각 2~3장",
      },
      {
        key: "extras",
        label: "5. 추가옵션 +α",
        fields: [
          { key: "welcomeKit", label: "환영 키트 (생수/간식)", type: "checkbox" },
          { key: "diffuser", label: "디퓨저", type: "checkbox" },
          { key: "plant", label: "식물", type: "checkbox" },
          { key: "extraNotes", label: "기타 추가 사항", type: "textarea" },
        ],
      },
    ],
    // 폴백 (subSteps 미지원 시)
    checklist: [],
    fields: [],
    attachLabel: "셋팅 사진",
    memoPlaceholder: "벤치마크 호실 비교, 추가 구매 항목",
  },

  listing: {
    label: "플랫폼 등록",
    purpose: "채널 오픈 (HIERO 홈페이지 우선)",
    guide: "HIERO 홈페이지에 먼저 등록 후 외부 채널 추가합니다.",
    showPoolMatch: true,    // 풀 ADR 기반 가격 제안
    // 등록 순서 우선순위: HIERO > Airbnb > 삼삼엠투 > Booking > Agoda
    checklist: [
      { id: "photos_5", label: "대표 사진 5장 선별 (고화질)" },
      { id: "title", label: "호실명 확정 (브랜드+고유번호)" },
      { id: "description", label: "설명 텍스트 작성" },
      { id: "price_set", label: "가격 설정 (평일/주말/시즌)" },
      { id: "stay_range", label: "최소·최대 박수" },
      { id: "rules", label: "규칙 (반려동물/흡연/파티)" },
      { id: "hiero_listed", label: "★ HIERO 홈페이지 등록 (1순위)", priority: true },
      { id: "airbnb_listed", label: "Airbnb 등록" },
      { id: "samsam_listed", label: "삼삼엠투 등록" },
      { id: "booking_listed", label: "Booking 등록" },
      { id: "agoda_listed", label: "Agoda 등록" },
    ],
    fields: [
      { key: "listingTitle", label: "호실명", type: "text" },
      { key: "weekdayPrice", label: "평일 가격 (원)", type: "number" },
      { key: "weekendPrice", label: "주말 가격 (원)", type: "number" },
      { key: "cleaningFee", label: "청소비 (원)", type: "number" },
      { key: "minNights", label: "최소 박수", type: "number" },
      { key: "maxNights", label: "최대 박수", type: "number" },
      { key: "hieroUrl", label: "HIERO URL ★", type: "url" },
      { key: "airbnbUrl", label: "Airbnb URL", type: "url" },
      { key: "samsamUrl", label: "삼삼엠투 URL", type: "url" },
      { key: "bookingUrl", label: "Booking URL", type: "url" },
      { key: "agodaUrl", label: "Agoda URL", type: "url" },
      { key: "rulePet", label: "반려동물 허용", type: "checkbox" },
      { key: "ruleSmoking", label: "흡연 허용", type: "checkbox" },
      { key: "ruleParty", label: "파티 허용", type: "checkbox" },
    ],
    attachLabel: "대표 사진 5장 (선별)",
    memoPlaceholder: "벤치마크 대비 가격 +/- 사유",
    tips: [
      "HIERO 홈페이지 우선 등록 (자체 채널 활성화)",
      "대표 사진 5장은 고화질 + 다른 각도",
      "청소비는 외부 채널 통일",
    ],
  },

  live: {
    label: "판매게시",
    purpose: "운영 시작 + 풀 통계 자동 반영",
    guide: "Hostex에 연결하고 인벤토리 풀에 정식 편입합니다.",
    showPoolMatch: true,
    checklist: [
      { id: "hostex_register", label: "Hostex 호실 등록" },
      { id: "hostex_id", label: "Hostex Property ID 확보" },
      { id: "hiero_link", label: "HIERO Properties 연결" },
      { id: "pool_assigned", label: "★ 인벤토리 풀에 자동 편입" },
      { id: "calendar_sync", label: "가격/달력 동기화 확인" },
      { id: "auto_message", label: "자동 메시지 설정" },
      { id: "auto_cleaning", label: "청소 자동 배정 설정" },
    ],
    fields: [
      { key: "hostexId", label: "Hostex Property ID", type: "text", required: true },
      { key: "operationStartDate", label: "운영 시작일", type: "date" },
      { key: "firstBookingDate", label: "첫 예약일 (있으면)", type: "date" },
    ],
    attachLabel: "Hostex 등록 화면 캡처",
    memoPlaceholder: "첫 주 운영 관찰",
    tips: [
      "Hostex ID 입력 후 'Properties 연결' 버튼 눌러 자동 등록",
      "풀 통계 (Dashboard 인벤토리 매트릭스) 즉시 갱신 확인",
    ],
  },
};

// 단계 키로 template 조회 (안전)
export const getStageTemplate = (stage) => STAGE_TEMPLATES[stage] || null;
```

### 2.2 StageModal.jsx 재작성 — `src/components/launches/StageModal.jsx`

기존 구현을 다음으로 교체:

```jsx
import React, { useState, useMemo } from "react";
import { X, AlertTriangle, Lightbulb, Check } from "lucide-react";
import { getStageTemplate, STAGE_LABELS } from "../../utils/launchUtils.js";
import StagePoolMatch from "./StagePoolMatch.jsx";
import StageSubSteps from "./StageSubSteps.jsx";

const C = {
  card: "#FFFFFF", ink: "#1A1917", ink2: "#3A362E", muted: "#6B6458",
  border: "#E5E1D6", forest: "#1E3A2F", forestLight: "#E8EDE8",
  red: "#A63D2A", terracotta: "#C65D3A", ochre: "#B8842F",
};

export default function StageModal({ launchId, stage, launchInfo, onClose, onSaved }) {
  const template = getStageTemplate(stage.stage);
  const isSetup = stage.stage === "setup";

  // details JSON에서 기존 값 로드
  const [details, setDetails] = useState(stage.details || {});
  const [checklist, setChecklist] = useState(stage.details?._checklist || {});
  const [common, setCommon] = useState({
    targetDate: stage.targetDate ? stage.targetDate.split("T")[0] : "",
    assignee: stage.assignee || "",
    cost: stage.cost ?? 0,
    issue: stage.issue || "",
    memo: stage.memo || "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  if (!template) {
    return (
      <Backdrop onClose={onClose}>
        <Panel onClose={onClose} title={`${stage.stage} (template 없음)`}>
          <p style={{ color: C.red }}>이 단계의 템플릿이 정의되지 않았습니다.</p>
        </Panel>
      </Backdrop>
    );
  }

  const updateField = (key, value) => setDetails((d) => ({ ...d, [key]: value }));
  const toggleCheck = (id) => setChecklist((c) => ({ ...c, [id]: !c[id] }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const payload = {
      ...common,
      cost: Number(common.cost) || 0,
      targetDate: common.targetDate || null,
      assignee: common.assignee || null,
      issue: common.issue || null,
      memo: common.memo || null,
      // details JSON에 단계별 입력 + 체크리스트 모두 저장
      details: {
        ...details,
        _checklist: checklist,
      },
    };

    try {
      const res = await fetch(`/api/launches/${launchId}/stages/${stage.stage}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(await res.text());
      onSaved();
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  };

  return (
    <Backdrop onClose={onClose}>
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={handleSubmit}
        className="w-[640px] max-h-[90vh] overflow-y-auto rounded-xl p-6 space-y-5"
        style={{ background: C.card, border: `1px solid ${C.border}` }}
      >
        <Header template={template} stage={stage} onClose={onClose} />

        {/* 가이드 텍스트 */}
        {template.guide && (
          <div
            className="text-sm p-3 rounded-lg"
            style={{ background: C.forestLight, color: C.ink2, border: `1px solid ${C.forest}22` }}
          >
            <span style={{ fontWeight: 600 }}>📋 {template.purpose}</span>
            <div className="text-xs mt-1">{template.guide}</div>
          </div>
        )}

        {/* 풀 매칭 (1번/7번/8번) */}
        {template.showPoolMatch && (
          <StagePoolMatch
            district={details.district || launchInfo?.address}
            grade={details.confirmedGrade || details.expectedGrade}
          />
        )}

        {/* 셋팅의 5 sub-step (특별 처리) */}
        {isSetup && template.subSteps ? (
          <StageSubSteps
            subSteps={template.subSteps}
            details={details}
            onUpdate={updateField}
          />
        ) : (
          <>
            {/* 체크리스트 */}
            {template.checklist?.length > 0 && (
              <ChecklistSection
                items={template.checklist}
                values={checklist}
                onToggle={toggleCheck}
              />
            )}

            {/* 단계별 필드 */}
            {template.fields?.length > 0 && (
              <FieldsSection
                fields={template.fields}
                values={details}
                onChange={updateField}
              />
            )}
          </>
        )}

        {/* Tips */}
        {template.tips?.length > 0 && (
          <TipsSection tips={template.tips} />
        )}

        {/* 첨부 (URL 입력) */}
        <AttachSection
          label={template.attachLabel}
          urls={details._attachments || []}
          onChange={(urls) => updateField("_attachments", urls)}
        />

        {/* 공통 필드: 목표일, 담당자, 비용, 이슈, 메모 */}
        <CommonFields
          common={common}
          onChange={(k, v) => setCommon((c) => ({ ...c, [k]: v }))}
          memoPlaceholder={template.memoPlaceholder}
        />

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
    </Backdrop>
  );
}

// === 헬퍼 컴포넌트들 ===

function Backdrop({ children, onClose }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.4)" }}
      onClick={onClose}
    >
      {children}
    </div>
  );
}

function Panel({ children, title, onClose }) {
  return (
    <div
      className="w-[440px] rounded-xl p-6 space-y-4"
      style={{ background: C.card, border: `1px solid ${C.border}` }}
    >
      <div className="flex items-start justify-between">
        <h3 style={{ fontSize: 18, color: C.ink }}>{title}</h3>
        <button onClick={onClose}><X size={18} /></button>
      </div>
      {children}
    </div>
  );
}

function Header({ template, stage, onClose }) {
  return (
    <div className="flex items-start justify-between">
      <div>
        <h3 className="text-lg font-medium" style={{ color: C.ink }}>
          {template.label}
        </h3>
        <p className="text-xs" style={{ color: C.muted }}>
          {stage.enteredAt ? `진입: ${stage.enteredAt.split("T")[0]}` : "미진입"}
          {stage.completedAt && ` · 완료: ${stage.completedAt.split("T")[0]}`}
        </p>
      </div>
      <button type="button" onClick={onClose} className="p-1">
        <X size={18} style={{ color: C.muted }} />
      </button>
    </div>
  );
}

function ChecklistSection({ items, values, onToggle }) {
  const completed = items.filter((it) => values[it.id]).length;
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <label className="text-xs font-semibold" style={{ color: C.muted }}>
          체크리스트
        </label>
        <span className="text-xs" style={{ color: C.forest }}>
          {completed}/{items.length}
        </span>
      </div>
      <div className="space-y-1.5">
        {items.map((item) => (
          <label
            key={item.id}
            className="flex items-start gap-2 p-2 rounded cursor-pointer hover:bg-[#F5F2EC]"
          >
            <div
              className="w-4 h-4 rounded border-2 flex items-center justify-center mt-0.5 flex-shrink-0"
              style={{
                borderColor: values[item.id] ? C.forest : C.border,
                background: values[item.id] ? C.forest : "transparent",
              }}
            >
              {values[item.id] && <Check size={11} style={{ color: "#fff" }} />}
            </div>
            <input
              type="checkbox"
              className="hidden"
              checked={!!values[item.id]}
              onChange={() => onToggle(item.id)}
            />
            <span className="text-sm" style={{ color: item.priority ? C.forest : C.ink2, fontWeight: item.priority ? 600 : 400 }}>
              {item.label}
            </span>
          </label>
        ))}
      </div>
    </div>
  );
}

function FieldsSection({ fields, values, onChange }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {fields.map((f) => (
        <div key={f.key} className={f.type === "textarea" ? "col-span-2" : ""}>
          <label className="text-xs font-semibold" style={{ color: C.muted }}>
            {f.label}{f.required && <span style={{ color: C.red }}> *</span>}
          </label>
          {renderField(f, values[f.key], (v) => onChange(f.key, v))}
        </div>
      ))}
    </div>
  );
}

function renderField(field, value, onChange) {
  const baseStyle = {
    width: "100%", marginTop: 4, padding: "8px 12px", borderRadius: 8,
    border: `1px solid ${C.border}`, fontSize: 14, background: "#fff", color: C.ink,
    outline: "none",
  };

  switch (field.type) {
    case "select":
      return (
        <select value={value || ""} onChange={(e) => onChange(e.target.value)} style={baseStyle}>
          <option value="">선택...</option>
          {field.options?.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
        </select>
      );
    case "radio":
      return (
        <div className="flex gap-2 mt-1 flex-wrap">
          {field.options?.map((opt) => (
            <label key={opt} className="flex items-center gap-1 text-sm cursor-pointer">
              <input
                type="radio"
                checked={value === opt}
                onChange={() => onChange(opt)}
              />
              {opt}
            </label>
          ))}
        </div>
      );
    case "checkbox":
      return (
        <label className="flex items-center gap-2 mt-1">
          <input type="checkbox" checked={!!value} onChange={(e) => onChange(e.target.checked)} />
          <span className="text-sm">{value ? "예" : "아니오"}</span>
        </label>
      );
    case "textarea":
      return (
        <textarea
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
          rows={3}
          placeholder={field.placeholder}
          style={{ ...baseStyle, resize: "none" }}
        />
      );
    case "computed":
      return (
        <div style={{ ...baseStyle, background: "#F5F2EC", color: C.muted }}>
          (자동 계산)
        </div>
      );
    case "url":
      return (
        <input
          type="url"
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder="https://..."
          style={baseStyle}
        />
      );
    default:
      return (
        <input
          type={field.type || "text"}
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
          style={baseStyle}
        />
      );
  }
}

function TipsSection({ tips }) {
  return (
    <div
      className="p-3 rounded-lg flex gap-2"
      style={{ background: "#FFF8E8", border: `1px solid ${C.ochre}33` }}
    >
      <Lightbulb size={14} style={{ color: C.ochre, flexShrink: 0, marginTop: 2 }} />
      <div className="text-xs space-y-1" style={{ color: C.ink2 }}>
        {tips.map((t, i) => <div key={i}>• {t}</div>)}
      </div>
    </div>
  );
}

function AttachSection({ label, urls, onChange }) {
  const [newUrl, setNewUrl] = useState("");
  const add = () => {
    if (newUrl.trim()) {
      onChange([...urls, newUrl.trim()]);
      setNewUrl("");
    }
  };
  const remove = (i) => onChange(urls.filter((_, idx) => idx !== i));
  return (
    <div>
      <label className="text-xs font-semibold" style={{ color: C.muted }}>
        📎 {label}
      </label>
      <div className="flex gap-2 mt-1">
        <input
          type="url"
          value={newUrl}
          onChange={(e) => setNewUrl(e.target.value)}
          placeholder="이미지/파일 URL"
          className="flex-1 px-3 py-2 rounded-lg text-sm border outline-none"
          style={{ borderColor: C.border, background: "#fff" }}
        />
        <button type="button" onClick={add}
          className="px-3 rounded-lg text-sm"
          style={{ background: C.forest, color: "#fff" }}
        >
          추가
        </button>
      </div>
      {urls.length > 0 && (
        <div className="mt-2 space-y-1">
          {urls.map((url, i) => (
            <div key={i} className="flex items-center justify-between text-xs p-1.5 rounded"
              style={{ background: "#F5F2EC" }}
            >
              <a href={url} target="_blank" rel="noreferrer" className="truncate" style={{ color: C.forest }}>
                {url}
              </a>
              <button type="button" onClick={() => remove(i)} style={{ color: C.red }}>×</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function CommonFields({ common, onChange, memoPlaceholder }) {
  const baseStyle = {
    width: "100%", marginTop: 4, padding: "8px 12px", borderRadius: 8,
    border: `1px solid ${C.border}`, fontSize: 14, background: "#fff", outline: "none",
  };
  return (
    <div className="space-y-3 pt-3" style={{ borderTop: `1px solid ${C.border}` }}>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="text-xs font-semibold" style={{ color: C.muted }}>목표일</label>
          <input type="date" value={common.targetDate} onChange={(e) => onChange("targetDate", e.target.value)} style={baseStyle} />
        </div>
        <div>
          <label className="text-xs font-semibold" style={{ color: C.muted }}>담당자</label>
          <input type="text" value={common.assignee} onChange={(e) => onChange("assignee", e.target.value)} style={baseStyle} />
        </div>
        <div>
          <label className="text-xs font-semibold" style={{ color: C.muted }}>비용 (원)</label>
          <input type="number" value={common.cost} onChange={(e) => onChange("cost", e.target.value)} style={baseStyle} />
        </div>
      </div>
      <div>
        <label className="text-xs font-semibold flex items-center gap-1" style={{ color: C.red }}>
          <AlertTriangle size={11} /> 이슈/문제
        </label>
        <textarea value={common.issue} onChange={(e) => onChange("issue", e.target.value)} rows={2} style={{ ...baseStyle, resize: "none" }} />
      </div>
      <div>
        <label className="text-xs font-semibold" style={{ color: C.muted }}>메모</label>
        <textarea
          value={common.memo}
          onChange={(e) => onChange("memo", e.target.value)}
          rows={2}
          placeholder={memoPlaceholder}
          style={{ ...baseStyle, resize: "none" }}
        />
      </div>
    </div>
  );
}
```

### 2.3 StagePoolMatch.jsx 신규 — `src/components/launches/StagePoolMatch.jsx`

```jsx
import React, { useState, useEffect } from "react";
import { Layers, Loader2 } from "lucide-react";

const C = {
  card: "#FFFFFF", ink: "#1A1917", ink2: "#3A362E", muted: "#6B6458",
  border: "#E5E1D6", forest: "#1E3A2F", forestLight: "#E8EDE8",
};

export default function StagePoolMatch({ district, grade }) {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!district) return;
    setLoading(true);
    const params = new URLSearchParams({ district });
    if (grade && grade !== "미정") params.set("grade", grade);

    fetch(`/api/launches/pool-stats?${params}`)
      .then((r) => r.ok ? r.json() : null)
      .then(setStats)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [district, grade]);

  if (!district) {
    return (
      <div className="p-3 rounded-lg text-xs" style={{ background: "#F5F2EC", color: C.muted }}>
        💡 생활권을 선택하면 같은 풀의 호실 통계가 표시됩니다
      </div>
    );
  }

  return (
    <div
      className="p-4 rounded-lg"
      style={{ background: C.forestLight, border: `1px solid ${C.forest}33` }}
    >
      <div className="flex items-center gap-2 mb-2">
        <Layers size={14} style={{ color: C.forest }} />
        <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: C.forest }}>
          {district} {grade && grade !== "미정" ? `· ${grade}등급` : ""} 풀 매칭
        </span>
      </div>
      {loading ? (
        <Loader2 size={14} className="animate-spin" style={{ color: C.forest }} />
      ) : stats ? (
        <div className="text-sm" style={{ color: C.ink2 }}>
          {stats.units > 0 ? (
            <>
              현재 풀에 <strong>{stats.units}개 호실</strong>
              {stats.avgADR && <> · 평균 ADR ₩{stats.avgADR.toLocaleString()}</>}
              {stats.avgOccupancy && <> · 점유율 {stats.avgOccupancy}%</>}
              {stats.properties && (
                <div className="mt-2 text-xs flex flex-wrap gap-1">
                  {stats.properties.slice(0, 5).map((p) => (
                    <span
                      key={p.id}
                      className="px-2 py-0.5 rounded"
                      style={{ background: "#fff", color: C.muted }}
                    >
                      {p.title}
                    </span>
                  ))}
                </div>
              )}
            </>
          ) : (
            <span style={{ color: C.muted }}>{stats.message || "풀이 비어있음"}</span>
          )}
        </div>
      ) : (
        <span className="text-xs" style={{ color: C.muted }}>풀 정보 로드 실패</span>
      )}
    </div>
  );
}
```

### 2.4 StageSubSteps.jsx 신규 — 셋팅 5단계 — `src/components/launches/StageSubSteps.jsx`

```jsx
import React, { useState } from "react";

const C = {
  card: "#FFFFFF", ink: "#1A1917", ink2: "#3A362E", muted: "#6B6458",
  border: "#E5E1D6", forest: "#1E3A2F", forestLight: "#E8EDE8",
};

export default function StageSubSteps({ subSteps, details, onUpdate }) {
  const [activeIdx, setActiveIdx] = useState(0);

  return (
    <div>
      {/* 탭 */}
      <div className="flex gap-1 mb-3 overflow-x-auto pb-1">
        {subSteps.map((s, i) => (
          <button
            key={s.key}
            type="button"
            onClick={() => setActiveIdx(i)}
            className="px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap"
            style={{
              background: activeIdx === i ? C.forest : "transparent",
              color: activeIdx === i ? "#fff" : C.muted,
              border: `1px solid ${activeIdx === i ? C.forest : C.border}`,
            }}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* 활성 sub-step */}
      <SubStepContent
        subStep={subSteps[activeIdx]}
        details={details}
        onUpdate={onUpdate}
      />
    </div>
  );
}

function SubStepContent({ subStep, details, onUpdate }) {
  // 셋팅 sub-step의 데이터 키는 _setup_<subKey>_<fieldKey> 로 분리
  // (단일 details JSON 안에서 충돌 방지)
  const subKey = subStep.key;

  return (
    <div className="space-y-3">
      {subStep.fields?.map((f) => {
        const fullKey = `_setup_${subKey}_${f.key}`;
        return (
          <div key={f.key}>
            <label className="text-xs font-semibold" style={{ color: C.muted }}>{f.label}</label>
            {f.type === "itemList" ? (
              <ItemList
                value={details[fullKey] || []}
                onChange={(v) => onUpdate(fullKey, v)}
                itemFields={f.itemFields}
              />
            ) : (
              <SimpleInput field={f} value={details[fullKey]} onChange={(v) => onUpdate(fullKey, v)} />
            )}
          </div>
        );
      })}
      {subStep.checklist && (
        <div>
          <label className="text-xs font-semibold" style={{ color: C.muted }}>체크리스트</label>
          <div className="space-y-1.5 mt-1">
            {subStep.checklist.map((it) => {
              const fullKey = `_setup_${subKey}_check_${it.id}`;
              return (
                <label key={it.id} className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={!!details[fullKey]}
                    onChange={(e) => onUpdate(fullKey, e.target.checked)}
                  />
                  <span style={{ color: C.ink2 }}>{it.label}</span>
                </label>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function SimpleInput({ field, value, onChange }) {
  const baseStyle = {
    width: "100%", marginTop: 4, padding: "8px 12px", borderRadius: 8,
    border: `1px solid ${C.border}`, fontSize: 14, background: "#fff", outline: "none",
  };
  if (field.type === "select") {
    return (
      <select value={value || ""} onChange={(e) => onChange(e.target.value)} style={baseStyle}>
        <option value="">선택...</option>
        {field.options?.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    );
  }
  if (field.type === "checkbox") {
    return (
      <label className="flex items-center gap-2 mt-1">
        <input type="checkbox" checked={!!value} onChange={(e) => onChange(e.target.checked)} />
        <span className="text-sm">{value ? "예" : "아니오"}</span>
      </label>
    );
  }
  return (
    <input
      type={field.type || "text"}
      value={value || ""}
      onChange={(e) => onChange(e.target.value)}
      placeholder={field.placeholder}
      style={baseStyle}
    />
  );
}

function ItemList({ value, onChange, itemFields }) {
  const items = Array.isArray(value) ? value : [];
  const total = items.reduce((s, it) => s + (Number(it.amount) || 0) * (Number(it.quantity) || 1), 0);

  const add = () => onChange([...items, {}]);
  const update = (i, k, v) => {
    const next = [...items];
    next[i] = { ...next[i], [k]: v };
    onChange(next);
  };
  const remove = (i) => onChange(items.filter((_, idx) => idx !== i));

  return (
    <div className="mt-1 space-y-2">
      {items.map((item, i) => (
        <div key={i} className="grid grid-cols-12 gap-1 items-center text-xs">
          {itemFields.map((f) => (
            <div key={f.key} className={f.key === "name" ? "col-span-4" : "col-span-2"}>
              {f.type === "select" ? (
                <select
                  value={item[f.key] || ""}
                  onChange={(e) => update(i, f.key, e.target.value)}
                  className="w-full px-2 py-1 rounded border text-xs"
                  style={{ borderColor: C.border }}
                >
                  <option value="">{f.label}</option>
                  {f.options?.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              ) : (
                <input
                  type={f.type || "text"}
                  value={item[f.key] || ""}
                  onChange={(e) => update(i, f.key, e.target.value)}
                  placeholder={f.label}
                  className="w-full px-2 py-1 rounded border text-xs"
                  style={{ borderColor: C.border }}
                />
              )}
            </div>
          ))}
          <button type="button" onClick={() => remove(i)} className="col-span-1 text-red-500 text-sm">×</button>
        </div>
      ))}
      <div className="flex items-center justify-between">
        <button type="button" onClick={add}
          className="text-xs px-3 py-1 rounded"
          style={{ background: C.forestLight, color: C.forest }}
        >
          + 항목 추가
        </button>
        <span className="text-xs" style={{ color: C.ink2 }}>
          합계: <strong>₩{total.toLocaleString()}</strong>
        </span>
      </div>
    </div>
  );
}
```

### 2.5 NewLaunchModal.jsx 강화 — 생활권/등급/연식 추가

기존 `NewLaunchModal.jsx`의 form state에 추가:

```jsx
const [form, setForm] = useState({
  name: "",
  address: "",
  district: "",          // ← NEW
  expectedGrade: "",     // ← NEW
  buildingYear: "",      // ← NEW
  expectedRent: "",
  expectedMonthlyRevenue: "",
  area: "",
  memo: "",
});
```

폼 UI에 다음 3개 필드 추가 (예상 월매출 위에):

```jsx
<div className="grid grid-cols-3 gap-3">
  <div>
    <label className="text-xs font-semibold" style={{ color: C.muted }}>생활권</label>
    <select
      value={form.district}
      onChange={handleChange("district")}
      className="w-full mt-1 px-3 py-2 rounded-lg text-sm outline-none border"
      style={{ borderColor: C.border, background: "#fff" }}
    >
      <option value="">선택...</option>
      <option>성내동</option>
      <option>천호동</option>
      <option>길동</option>
      <option>암사동</option>
      <option>신규 생활권</option>
    </select>
  </div>
  <div>
    <label className="text-xs font-semibold" style={{ color: C.muted }}>예상 등급</label>
    <select
      value={form.expectedGrade}
      onChange={handleChange("expectedGrade")}
      className="w-full mt-1 px-3 py-2 rounded-lg text-sm outline-none border"
      style={{ borderColor: C.border, background: "#fff" }}
    >
      <option value="">미정</option>
      <option>S</option>
      <option>A</option>
      <option>B</option>
      <option>C</option>
    </select>
  </div>
  <Field
    label="건축물 연식 (년)"
    type="number"
    value={form.buildingYear}
    onChange={handleChange("buildingYear")}
  />
</div>
```

payload 빌드 시 추가:
```jsx
...(form.district ? { district: form.district } : {}),
...(form.expectedGrade ? { expectedGrade: form.expectedGrade } : {}),
...(form.buildingYear ? { buildingYear: Number(form.buildingYear) } : {}),
```

⚠️ **백엔드 CreateLaunchDto에도 다음 필드 추가 필요:**
```typescript
@IsOptional() @IsString() district?: string;
@IsOptional() @IsString() expectedGrade?: string;
@IsOptional() @IsInt() buildingYear?: number;
```

그리고 Launch entity에도:
```typescript
@Column({ type: 'varchar', length: 50, nullable: true }) district: string | null;
@Column({ type: 'varchar', length: 10, nullable: true }) expectedGrade: string | null;
@Column({ type: 'int', nullable: true }) buildingYear: number | null;
```

---

## 3. LaunchDetail.jsx 수정 — launchInfo 전달

`LaunchDetail.jsx` 의 `<StageModal>` 호출 부분에서 launchInfo prop 전달:

```jsx
{editingStage && (
  <StageModal
    launchId={launch.id}
    stage={editingStage}
    launchInfo={{ district: launch.district, expectedGrade: launch.expectedGrade, address: launch.address }}
    onClose={() => setEditingStage(null)}
    onSaved={() => {
      setEditingStage(null);
      fetchData();
    }}
  />
)}
```

---

## 4. 작업 순서 (스텝별)

```
백엔드:
1. LaunchStage entity에 details JSON 컬럼 추가
2. UpdateStageDto에 details 추가
3. Launch entity에 district, expectedGrade, buildingYear 추가
4. CreateLaunchDto에 위 3개 필드 추가
5. LaunchesService.updateStage()에 details 처리 한 줄
6. LaunchesController에 GET /pool-stats 추가
7. LaunchesService.getPoolStats() 메서드 추가
8. 빌드 + 테스트 (CURL로 endpoint 확인)

프론트엔드:
9. utils/launchUtils.js에 STAGE_TEMPLATES 추가
10. components/launches/StagePoolMatch.jsx 생성
11. components/launches/StageSubSteps.jsx 생성
12. components/launches/StageModal.jsx 재작성 (template 기반)
13. components/launches/NewLaunchModal.jsx 에 생활권/등급/연식 필드 추가
14. pages/LaunchDetail.jsx 의 StageModal 호출에 launchInfo prop 추가
15. 빌드 + dev 새로고침

검증:
16. 새 런칭 만들기 (생활권/등급 선택)
17. SEARCHING 단계 클릭 → 새 폼 (체크리스트 + district/grade 등)
18. VISITING 단계 → 다른 폼 (등급 확정)
19. SETUP 단계 → 5 sub-step 탭 동작 확인
20. LIVE 단계 → Hostex ID + 풀 매칭 위젯
```

---

## 5. 검증 체크리스트

- [ ] 새 런칭 생성 시 생활권/등급/연식 입력 가능
- [ ] SEARCHING 단계 모달: 풀 매칭 위젯 표시 + 체크리스트 + 입력 필드
- [ ] VISITING 단계 모달: 등급 확정 라디오 + 동네 편의시설 체크리스트
- [ ] CONTRACTING/PAYING/CLEANING 단계: 단계별 다른 필드
- [ ] SETUP 단계: 5 sub-step 탭 (컨셉/구매/설치/확인/추가) 동작
- [ ] SETUP의 물품구매 itemList에서 항목 추가/삭제 + 합계 자동 계산
- [ ] LISTING 단계: HIERO 홈페이지 ★ 우선순위 표시 + 풀 ADR 매칭
- [ ] LIVE 단계: Hostex ID 입력 폼 + 풀 매칭
- [ ] details JSON으로 저장된 데이터가 모달 재오픈 시 복원
- [ ] 체크리스트 진행률 (n/m) 표시 정확
- [ ] 첨부 URL 추가/삭제

---

## 6. 알려진 제약사항

1. `getPoolStats` 의 평균 ADR / 점유율 계산은 properties + reservations + transactions 조인 필요 — 이번 phase에선 호실 갯수만 표시. 정확한 통계는 Phase 2.

2. `properties.address`에 "성내동" 같은 텍스트가 포함된다는 가정으로 풀 매칭. 정확한 매칭은 properties에 `district`, `grade` 컬럼 추가 후 가능 (별도 작업).

3. 사진 업로드 — URL 입력만. S3/로컬 업로드는 다음 phase.

4. SETUP의 sub-step 데이터는 details JSON에 `_setup_<subKey>_<fieldKey>` 형식으로 평탄화 저장. 백엔드에서 검색/필터링이 어려울 수 있지만 처음엔 OK.

---

작업 완료 후 각 단계별 모달 스크린샷 + 검증 체크리스트 결과 보고.
