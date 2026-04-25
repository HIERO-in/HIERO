#!/bin/bash
# 4974건 전체 예약에서 비용 데이터 전수조사

python3 << 'PYEOF'
import urllib.request, json
from collections import Counter, defaultdict

print("=== 전체 예약 4974건 로드 중... ===")
with urllib.request.urlopen("http://localhost:8080/api/reservations") as r:
    reservations = json.load(r)
with urllib.request.urlopen("http://localhost:8080/api/properties") as r:
    properties = json.load(r)

prop_by_hostex = {int(p.get('hostexId') or 0): p for p in properties}
print(f"예약: {len(reservations)}, 숙소: {len(properties)}\n")

# 1) rates.details 에 등장하는 모든 type 집계
print("=== 1) rates.details 타입 전체 빈도 ===")
type_count = Counter()
type_sum = defaultdict(float)
for r in reservations:
    raw = r.get('rawData') or {}
    details = raw.get('rates', {}).get('details') or []
    for d in details:
        t = d.get('type', '?')
        type_count[t] += 1
        type_sum[t] += (d.get('amount') or 0)

for t, cnt in type_count.most_common():
    print(f"  {t:<40s} {cnt:>5d}건  합계 {type_sum[t]:>15,.0f}원")

# 2) 표준 타입 외의 것이 있는 예약 찾기
STANDARD_TYPES = {
    'ACCOMMODATION', 'HOST_SERVICE_FEE', 'CLEANING_FEE',
    'OUT_NUMBER_FEE', 'PET_FEE', 'HOUSE_EXTENSION_FEE',
    'CANCELLATION_REFUND_FROM_HOST', 'PLATFORM_SUBSIDIES',
}
print("\n\n=== 2) 비표준 타입(RENT 등) 가진 예약 TOP 10 ===")
unusual_count = 0
for r in reservations:
    raw = r.get('rawData') or {}
    details = raw.get('rates', {}).get('details') or []
    unusual = [d for d in details if d.get('type') not in STANDARD_TYPES]
    if unusual:
        unusual_count += 1
        if unusual_count <= 10:
            prop = prop_by_hostex.get(r.get('propertyId'))
            print(f"  예약 {r.get('reservationCode')} · {prop.get('title') if prop else '?'}")
            print(f"    게스트: {r.get('guestName')}, {r.get('checkInDate')} ~ {r.get('checkOutDate')}")
            for d in details:
                marker = '🔴' if d.get('type') not in STANDARD_TYPES else '  '
                print(f"    {marker} {d.get('type'):<35s} {d.get('amount', 0):>12,.0f}  {d.get('description', '')[:40]}")
            print()
print(f"총 {unusual_count}건 비표준 타입 발견")

# 3) AMU 운영경비 숙소(title에 AMU 있는) 의 예약 확인
print("\n=== 3) 'AMU' 포함 숙소의 예약 목록 ===")
amu_props = [p for p in properties if 'AMU' in (p.get('title') or '')]
print(f"AMU 숙소 {len(amu_props)}개:")
for p in amu_props:
    print(f"  - {p.get('title')} (hostexId={p.get('hostexId')})")

for p in amu_props:
    amu_res = [r for r in reservations if r.get('propertyId') == int(p.get('hostexId'))]
    print(f"\n  [{p.get('title')}] 예약 {len(amu_res)}건")
    for r in amu_res[:10]:
        print(f"    · {r.get('reservationCode')} · {r.get('guestName')} · {r.get('checkInDate')}")
        print(f"        totalRate={r.get('totalRate')}, commission={r.get('totalCommission')}")
        raw = r.get('rawData') or {}
        for d in (raw.get('rates', {}).get('details') or []):
            print(f"        · {d.get('type'):<35s} {d.get('amount', 0):>12,.0f}  {d.get('description', '')}")

# 4) 스크린샷에 있던 특정 예약 코드 확인
print("\n=== 4) 스크린샷에 나왔던 예약 코드들 ===")
target_codes = ['5-6AQ0NFXA3', '16-1719489175-icc0jgpd2s', '5-6APU5F2QM',
                '16-1719822647-icd6uoyvfb', '0-HM4JN5NKBK-icdninp8vq',
                '5-6AH9QILL9', '0-HMS5BKSYHZ-icean6zame', '0-HM5SSBYSTF-icdd7zbd60']
for code in target_codes:
    found = next((r for r in reservations if r.get('reservationCode') == code), None)
    if found:
        prop = prop_by_hostex.get(found.get('propertyId'))
        print(f"  ✅ {code} · {prop.get('title') if prop else '?'}")
        raw = found.get('rawData') or {}
        for d in (raw.get('rates', {}).get('details') or []):
            print(f"      · {d.get('type'):<35s} {d.get('amount', 0):>12,.0f}")
    else:
        print(f"  ❌ {code} · DB에 없음")

# 5) 총액이 음수(환불/지출)인 예약
print("\n=== 5) totalRate가 음수이거나 0인 예약 TOP 10 ===")
zero_or_neg = [r for r in reservations if (r.get('totalRate') or 0) <= 0]
print(f"총 {len(zero_or_neg)}건")
for r in zero_or_neg[:10]:
    prop = prop_by_hostex.get(r.get('propertyId'))
    print(f"  · {r.get('reservationCode')} · 게스트:{r.get('guestName')} · 숙소:{prop.get('title') if prop else '?'}")
    print(f"      total={r.get('totalRate')}, status={r.get('status')}")

PYEOF
