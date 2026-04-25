#!/bin/bash
# 비용 데이터 심화 탐색
# 1) 예약 상세 API 구조 확인
# 2) 기존 예약 rawData 중 풍부한 것 찾기
# 3) 추가 엔드포인트 후보

TOKEN="gSS3KrZqlJtMd566fdDAfUMHOUYntYZs6NVgGg286RPTBHo2LMiSwqNPzYPBlJSt"
BASE="https://api.hostex.io/v3"

echo "=== 1) 추가 후보 엔드포인트 ==="
for path in \
    "/i_and_e" \
    "/ie" \
    "/income_expense" \
    "/custom_rates" \
    "/reservation_expenses" \
    "/reservation_items" \
    "/operating_expenses" \
    "/cash_flow" \
    "/cashflow" \
    "/financial_records" \
    "/manual_entries" \
    "/custom_transactions" \
    "/metrics" \
    "/metrics/overview" \
    "/analytics/transactions"
do
  CODE=$(curl -s -o /tmp/resp.json -w "%{http_code}" "${BASE}${path}" -H "Hostex-Access-Token: ${TOKEN}")
  if [ "$CODE" = "200" ]; then
    SIZE=$(wc -c < /tmp/resp.json)
    HEAD=$(head -c 200 /tmp/resp.json)
    echo "  ${path} → HTTP $CODE, ${SIZE}B: ${HEAD}"
  fi
done

echo ""
echo ""
echo "=== 2) 화면 스크린샷에 나온 예약 '5-6AQ0NFXA3' 상세 조회 ==="
curl -s "${BASE}/reservations/5-6AQ0NFXA3" -H "Hostex-Access-Token: ${TOKEN}" | python3 -c "
import json, sys
try:
    d = json.load(sys.stdin)
    print(json.dumps(d, indent=2, ensure_ascii=False)[:3000])
except Exception as e:
    print('파싱 실패:', e)
"

echo ""
echo "=== 3) AMU 운영경비 숙소의 예약 1건 상세 ==="
# AMU 운영경비는 hostexId가 있을 것 — 먼저 우리 DB에서 찾기
AMU_RES=$(curl -s "http://localhost:8080/api/reservations" | python3 -c "
import json, sys
data = json.load(sys.stdin)
for r in data:
    title = (r.get('rawData') or {}).get('property', {}).get('title', '') if isinstance((r.get('rawData') or {}).get('property'), dict) else ''
    if 'AMU' in str(r.get('guestName', '')) or 'AMU' in title:
        print(r.get('reservationCode'))
        break
else:
    # fallback: AMU 운영경비 숙소 ID 찾기 → 그 예약 찾기
    pass
" 2>/dev/null || echo "")

echo ""
echo "=== 4) 기존 DB 예약 중 rates.details 가 풍부한 것 TOP 5 ==="
curl -s "http://localhost:8080/api/reservations" | python3 -c "
import json, sys
data = json.load(sys.stdin)
scored = []
for r in data:
    raw = r.get('rawData') or {}
    details = raw.get('rates', {}).get('details') or []
    # 추가 필드 개수도 계산
    known = {'reservation_code','stay_code','channel_id','property_id','listing_id',
             'channel_type','custom_channel','check_in_date','check_out_date',
             'booked_at','cancelled_at','created_at','guest_name','guest_phone',
             'guest_email','number_of_guests','number_of_adults','number_of_children',
             'number_of_infants','number_of_pets','rates','status','stay_status',
             'remarks','channel_remarks','tags','in_reservation_box','guests','creator',
             'conversation_id','custom_fields','check_in_details'}
    extra_keys = [k for k in raw.keys() if k not in known]
    score = len(details) * 10 + len(extra_keys)
    scored.append((score, r, len(details), extra_keys))

scored.sort(key=lambda x: -x[0])
for score, r, dcount, ekeys in scored[:5]:
    print(f'  {r.get(\"reservationCode\"):<30s} {r.get(\"guestName\", \"-\"):<20s} details={dcount} 추가필드={ekeys}')
    raw = r.get('rawData') or {}
    for d in raw.get('rates', {}).get('details') or []:
        print(f'      · {d.get(\"type\"):<35s} {d.get(\"amount\", 0):>12,.0f}  {d.get(\"description\",\"\")[:40]}')
    print()
"
