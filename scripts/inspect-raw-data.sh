#!/bin/bash
# HIERO 원본 데이터 구조 분석 스크립트
# 실행: bash scripts/inspect-raw-data.sh

echo "=== 예약 rawData 샘플 (1건) ==="
curl -s "http://localhost:8080/api/reservations" | \
  python3 -c "
import json, sys
data = json.load(sys.stdin)
if not data:
    print('예약 데이터 없음')
    sys.exit(0)
# 원본이 있는 예약 찾기
for r in data[:50]:
    raw = r.get('rawData')
    if raw:
        print('예약코드:', r.get('reservationCode'))
        print('게스트:', r.get('guestName'))
        print()
        print('=== rates.details (Hostex가 제공하는 금액 분해) ===')
        for d in (raw.get('rates', {}).get('details') or [])[:20]:
            print(f\"  {d.get('type', '-'):<35s} {d.get('amount', 0):>12,.0f} {d.get('currency', '')} · {d.get('description', '')[:50]}\")
        print()
        print('=== 기타 힌트가 될 필드 ===')
        for k in ['remarks', 'channel_remarks', 'tags', 'custom_fields', 'creator']:
            v = raw.get(k)
            if v and v != [] and v != {}:
                print(f'  {k}: {json.dumps(v, ensure_ascii=False)[:200]}')
        break
"

echo ""
echo ""
echo "=== 숙소 rawData에서 비용 관련 필드 탐색 ==="
curl -s "http://localhost:8080/api/properties" | \
  python3 -c "
import json, sys
data = json.load(sys.stdin)
if not data:
    print('숙소 데이터 없음')
    sys.exit(0)
# 첫 숙소의 모든 필드 키 나열
p = data[0]
raw = p.get('rawData', {}) or {}
print('숙소 제목:', p.get('title'))
print()
print('=== rawData 전체 키 목록 ===')
for k in sorted(raw.keys()):
    v = raw[k]
    if v is None or v == '' or v == [] or v == {}:
        continue
    tv = type(v).__name__
    if tv == 'list':
        preview = f'[{len(v)} items]'
    elif tv == 'dict':
        preview = '{' + ', '.join(list(v.keys())[:5]) + ('...' if len(v) > 5 else '') + '}'
    else:
        preview = str(v)[:80]
    print(f'  {k:<30s} ({tv:>6s}) {preview}')

print()
print('=== 비용 관련 의심 필드 ===')
candidates = ['amenities', 'description', 'remarks', 'notes', 'custom_fields', 'price', 'cost', 'rent']
for k, v in raw.items():
    if any(c in k.lower() for c in candidates) or (isinstance(v, str) and any(w in v for w in ['월세', '관리비', '비용', '원', '임대', '수수료'])):
        print(f'  {k}: {json.dumps(v, ensure_ascii=False)[:300]}')
"
