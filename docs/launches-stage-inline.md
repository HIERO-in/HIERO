# Launches 상세 페이지 — 단계 콘텐츠 Inline 재구성

> 현재: 모달 팝업으로 단계 상세 표시
> 목표: 페이지 안에 직접 펼쳐진 형태로 표시

---

## 0. 배경

heiro가 원하는 것:
- Timeline에서 단계 클릭 → 모달 X
- 페이지 메인 영역에 현재 단계의 풍부한 콘텐츠 (체크리스트/필드/풀매칭/팁/첨부) 직접 표시
- "운영 페이지" 본연의 가치 — 한 화면에서 작업 가능

---

## 1. 새 페이지 구조

```
┌──────────────────────────────────────────┐
│ Header (이름, 주소, 상태, 액션 버튼)      │
├──────────────────────────────────────────┤
│ Timeline (현재 stage 강조 + 선택 stage)  │
│   ← 클릭 시 selectedStage 변경 (페이지   │
│      모달 X)                              │
├──────────────────────────────────────────┤
│ 📋 [현재 단계 라벨]                       │
│ guide text                                │
│                                            │
│ ★ 풀 매칭 (생활권 + 등급) — 1·7·8단계만  │
│                                            │
│ ✓ 체크리스트                              │
│   □ 항목 1                                │
│   ☑ 항목 2 (저장됨)                       │
│   ...                                     │
│                                            │
│ 📝 단계별 입력 필드                       │
│   생활권 [드롭다운]                       │
│   등급 [라디오]                           │
│   면적 [숫자]                             │
│   ...                                     │
│                                            │
│ ⚙ 셋팅 단계는 5 sub-step 탭으로          │
│                                            │
│ 💡 Tips                                   │
│                                            │
│ 📎 첨부 (URL 입력)                        │
│                                            │
│ ─── 공통 필드 ────                        │
│ 목표일 / 담당자 / 비용                    │
│ 이슈 (text)                               │
│ 메모 (text, placeholder는 단계별)         │
│                                            │
│ [저장] [다음 단계로 →] [포기]            │
├──────────────────────────────────────────┤
│ 요약 카드 (총비용, 누적일수, 진행률)     │
│ 전체 이슈 목록                            │
│ LIVE 단계 시: Hostex 연결 폼              │
└──────────────────────────────────────────┘
```

---

## 2. 작업 범위

### 2.1 신규 파일

`src/components/launches/StageContent.jsx` — 단계 콘텐츠를 inline으로 렌더링하는 컴포넌트.

기존 StageModal.jsx의 모든 섹션 (ChecklistSection, FieldsSection, AttachSection, CommonFields, TipsSection, StagePoolMatch 호출, StageSubSteps 호출) **그대로** 사용하되, 모달 wrapper(Backdrop, Panel) 제거.

```jsx
export default function StageContent({ launchId, stage, launchInfo, onSaved }) {
  const template = getStageTemplate(stage.stage);
  const isSetup = stage.stage === "setup";
  // ... 기존 StageModal의 state + handleSubmit 로직 동일
  
  if (!template) return <NotFoundMessage />;
  
  return (
    <div className="space-y-5"> {/* 모달 wrapper 없음 */}
      <StageHeader template={template} stage={stage} />
      <GuideBox guide={template.guide} purpose={template.purpose} />
      {template.showPoolMatch && (
        <StagePoolMatch district={...} grade={...} />
      )}
      {isSetup ? (
        <StageSubSteps subSteps={template.subSteps} details={details} onUpdate={updateField} />
      ) : (
        <>
          <ChecklistSection ... />
          <FieldsSection ... />
        </>
      )}
      {template.tips?.length > 0 && <TipsSection tips={template.tips} />}
      <AttachSection label={template.attachLabel} ... />
      <CommonFields common={common} onChange={...} memoPlaceholder={template.memoPlaceholder} />
      <ActionButtons onSave={handleSubmit} saving={saving} />
      {error && <ErrorBox error={error} />}
    </div>
  );
}
```

### 2.2 수정 파일

`src/components/launches/Timeline.jsx`:
- prop 추가: `selectedStage` (현재 페이지에서 보고 있는 단계)
- 시각:
  - `completedAt` 있는 단계: 완료 (초록 체크)
  - `stage === currentStage`: 진행 중 (테두리 강조)
  - `stage === selectedStage`: 선택됨 (배경 강조) ← NEW
  - 미래: 회색

`src/pages/LaunchDetail.jsx`:
- state 추가: `selectedStage` (default: `launch.currentStage`)
- Timeline에 `selectedStage` 전달 + `onStageClick`은 `setSelectedStage`로 변경 (모달 X)
- 메인 영역에 `<StageContent launchId={launch.id} stage={selectedStageRow} launchInfo={...} onSaved={...} />` 직접 렌더링
- StageModal 호출 제거 (또는 deprecated 표시)

```jsx
export default function LaunchDetail() {
  const { id } = useParams();
  const { launch, summary, refresh } = useLaunch(id);
  const [selectedStage, setSelectedStage] = useState(null);

  // launch 로드 후 currentStage로 selectedStage 자동 설정
  useEffect(() => {
    if (launch && !selectedStage) {
      setSelectedStage(launch.currentStage);
    }
  }, [launch]);

  const selectedStageRow = launch?.stages.find(s => s.stage === selectedStage);

  return (
    <div className="h-full overflow-y-auto pr-1 space-y-5">
      <Header launch={launch} onAdvance={...} onAbandon={...} />
      
      <Timeline
        stages={launch.stages}
        currentStage={launch.currentStage}
        selectedStage={selectedStage}
        onStageClick={(s) => setSelectedStage(s.stage)}
      />
      
      {selectedStageRow && (
        <StageContent
          launchId={launch.id}
          stage={selectedStageRow}
          launchInfo={{ district: launch.district, expectedGrade: launch.expectedGrade, address: launch.address }}
          onSaved={refresh}
        />
      )}
      
      <SummaryCard summary={summary} />
      <IssuesList issues={summary?.issues} />
      
      {launch.status === 'live' && (
        <PropertyLinkSection launch={launch} onLinked={refresh} />
      )}
    </div>
  );
}
```

### 2.3 제거 또는 deprecated

`src/components/launches/StageModal.jsx`:
- 일단 그대로 유지 (다른 곳에서 호출 안 하면 dead code지만 안전)
- 코드 끝에 `// @deprecated — use StageContent instead` 주석만 추가

---

## 3. 작업 순서

```
1. StageContent.jsx 생성
   → StageModal.jsx 코드 복사 후 wrapper 제거
   → handleSubmit 후 onSaved 호출
   → "닫기" 버튼 제거 (페이지 안이라 닫을 게 없음)

2. Timeline.jsx 수정
   → selectedStage prop 추가
   → 시각 차별화 (selected = 배경 강조)

3. LaunchDetail.jsx 재구성
   → editingStage state 제거
   → selectedStage state 추가
   → useEffect로 launch.currentStage를 selectedStage 초기값
   → Timeline의 onStageClick 변경
   → 메인 영역에 StageContent 직접 렌더링
   → StageModal import 제거

4. 빌드 확인
   npm run build

5. 검증 (heiro 본인 Mac 브라우저):
   - /admin/launches 접속
   - 새 런칭 1건 만들기 (생활권/등급 선택)
   - 카드 클릭 → /admin/launches/:id 진입
   - Timeline에서 첫 단계 콘텐츠가 페이지에 직접 보임 ✓
   - 다른 단계 클릭 → 페이지가 그 단계 콘텐츠로 전환 ✓
   - 입력 후 저장 → onSaved 호출 → 데이터 새로고침 ✓
   - 셋팅 단계 클릭 → 5 sub-step 탭 표시 ✓
   - LIVE 단계 도달 시 hostex 연결 폼 ✓
```

---

## 4. UX 디테일

### 4.1 Timeline 시각화 (3가지 상태)
```
완료된 단계:    [✓] 초록 체크 + 채워진 동그라미
현재 진행 단계: [3] 테두리 강조 + 라벨 진하게
선택된 단계:    [4] 배경 강조 (forestLight) + 진한 텍스트
미래 단계:      [5] 회색
```

`currentStage === selectedStage`인 경우 (보통 처음 들어왔을 때):
- 양쪽 효과 다 적용 (테두리 + 배경)

### 4.2 단계 전환 시 입력 데이터 보호
- Timeline에서 다른 단계 클릭 → 현재 단계의 변경사항이 저장 안 됐으면 confirm
- "저장하지 않은 변경사항이 있습니다. 그래도 이동하시겠습니까?"
- 또는 자동 저장 (debounce 2초)

### 4.3 액션 버튼 위치
```
[저장]            ← 항상 보임, 변경사항 있을 때 강조
[다음 단계로 →]   ← currentStage === selectedStage 일 때만 활성
[포기]            ← currentStage === selectedStage 일 때만 활성
```

### 4.4 LIVE 단계의 특별 처리
LIVE 단계 콘텐츠 + Hostex 연결 폼이 함께 표시:
- 위쪽: 일반 콘텐츠 (체크리스트, hostexId 필드 등)
- 아래쪽: "Properties 연결" 액션 카드 (hostexId 입력 → POST /:id/link-property)

---

## 5. 검증 체크리스트

- [ ] 페이지 로드 시 currentStage 콘텐츠 자동 표시
- [ ] Timeline 단계 클릭 시 페이지 콘텐츠 즉시 변경 (모달 X)
- [ ] 선택된 단계가 Timeline에서 시각적으로 강조됨
- [ ] 1·7·8 단계에서 풀 매칭 위젯 표시
- [ ] 셋팅 단계에서 5 sub-step 탭 동작
- [ ] 입력 후 저장 → details JSON에 저장됨
- [ ] 페이지 새로고침해도 입력값 복원
- [ ] "다음 단계로" 클릭 시 currentStage 변경 + selectedStage도 자동 따라감
- [ ] 빌드 에러 0
- [ ] StageModal.jsx는 import 안 되지만 파일은 남아있음 (안전망)

---

## 6. 알려진 이슈/주의

1. StageContent의 state는 stage prop이 바뀔 때 리셋되어야 함
   ```jsx
   useEffect(() => {
     setDetails(stage.details || {});
     setChecklist(stage.details?._checklist || {});
     setCommon({ ... });
   }, [stage.id]); // stage 행이 바뀔 때 reset
   ```

2. 단계 전환 시 unsaved changes 처리는 v1에서는 단순 confirm()로 충분, v2에서 자동 저장 검토.

3. LaunchDetail.jsx의 useLaunch 훅이 launch + summary 동시에 가져오는지 확인. 없으면 fetchData 직접 호출.

---

## 7. 작업량

- StageContent.jsx 신규 (StageModal 복사+수정): 30분
- Timeline.jsx 수정: 10분
- LaunchDetail.jsx 재구성: 40분
- 디버깅 + 검증: 30분
- **합계: ~2시간**

---

작업 시작 전 heiro에게 확인할 것:
1. 단계 전환 시 unsaved 변경 처리 — confirm? 자동 저장? 그냥 무시?
2. "다음 단계로" 진행 후 selectedStage도 자동으로 다음 단계로 이동? (UX 흐름 자연스럽게)
3. 처음 페이지 진입 시 selectedStage = currentStage, OK?

기본값:
- 1번: confirm() 한 줄
- 2번: 예, 자동 이동
- 3번: 예
