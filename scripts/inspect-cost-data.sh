#!/bin/bash
# 운영 중인 숙소(예약이 많은)의 비용 관련 데이터 탐색

python3 << 'PYEOF'
import urllib.request, json

def fetch(url):
    with urllib.request.urlopen(url) as r:
        return json.load(r)

print("=== 로드 중... ===")
props = fetch("http://localhost:8080/api/properties")
resvs = fetch("http://localhost:8080/api/reservations")
print(f"숙소: {len(props)}개, 예약: {len(resvs)}건\n")

# 숙소별 예약 건수 집계
prop_res_count = {}
for r in resvs:
    pid = r.get("propertyId")
    if pid:
        prop_res_count[pid] = prop_res_count.get(pid, 0) + 1

# 예약이 가장 많은 숙소 5개
by_count = sorted(prop_res_count.items(), key=lambda x: -x[1])
print("=== 예약 많은 숙소 TOP 5 (hostexId 기준) ===")
for pid, cnt in by_count[:5]:
    prop = next((p for p in props if int(p.get("hostexId") or 0) == pid), None)
    title = prop.get("title") if prop else "(unknown)"
    print(f"  {pid} - {cnt:>3d}건 - {title}")

# 가장 예약 많은 숙소 선택
target_pid = by_count[0][0]
target_prop = next((p for p in props if int(p.get("hostexId") or 0) == target_pid), None)

print(f"\n\n===== 분석 대상: {target_prop.get('title')} (hostexId={target_pid}) =====\n")

# 1) 숙소 rawData 전체 필드 (기존 스키마에 없는 것 위주)
print("=== 1) 숙소 rawData 에 남아있는 비용 힌트 ===")
raw_prop = target_prop.get("rawData") or {}
known_keys = {"id","title","channels","cover","default_checkin_time","default_checkout_time",
              "timezone","wifi_ssid","wifi_password","wifi_remarks","address","longitude",
              "latitude","google_place_payload"}
unknown = {k: v for k, v in raw_prop.items() if k not in known_keys and v not in (None, "", [], {})}
if unknown:
    for k, v in unknown.items():
        print(f"  · {k}: {json.dumps(v, ensure_ascii=False)[:300]}")
else:
    print("  (스키마에 없는 추가 필드 없음 — 숙소 단에 비용 없음 확인)")

# 2) 이 숙소의 예약 하나를 깊게 분석
print("\n=== 2) 이 숙소의 예약 1건 상세 ===")
for r in resvs:
    if r.get("propertyId") == target_pid:
        print(f"  예약코드: {r.get('reservationCode')}")
        print(f"  게스트: {r.get('guestName')}")
        print(f"  기간: {r.get('checkInDate')} ~ {r.get('checkOutDate')}")
        print(f"  상태: {r.get('status')} / {r.get('stayStatus')}")
        print(f"  DB에 저장된 total_rate: {r.get('totalRate')}  commission: {r.get('totalCommission')}")
        print(f"  DB remarks: {r.get('remarks')}")
        print(f"  DB channelRemarks: {r.get('channelRemarks')}")
        raw = r.get("rawData") or {}
        print(f"\n  --- rawData.rates.details[] (Hostex 세부 금액) ---")
        for d in raw.get("rates", {}).get("details") or []:
            print(f"    {d.get('type','-'):<35s} {d.get('amount',0):>12,.0f}  {d.get('description','')[:50]}")
        print(f"\n  --- rawData 의 비스키마 필드 ---")
        raw_known = {"reservation_code","stay_code","channel_id","property_id","listing_id",
                     "channel_type","custom_channel","check_in_date","check_out_date",
                     "booked_at","cancelled_at","created_at","guest_name","guest_phone",
                     "guest_email","number_of_guests","number_of_adults","number_of_children",
                     "number_of_infants","number_of_pets","rates","status","stay_status",
                     "remarks","channel_remarks","tags","in_reservation_box"}
        for k, v in raw.items():
            if k in raw_known: continue
            if v in (None, "", [], {}): continue
            print(f"    · {k}: {json.dumps(v, ensure_ascii=False)[:200]}")
        break

# 3) 이 숙소의 모든 예약의 rates.details TYPE 집계
print("\n=== 3) 이 숙소 전체 예약의 rates.details 타입별 합계 ===")
type_sum = {}
type_cnt = {}
for r in resvs:
    if r.get("propertyId") != target_pid: continue
    raw = r.get("rawData") or {}
    for d in raw.get("rates", {}).get("details") or []:
        t = d.get("type", "?")
        type_sum[t] = type_sum.get(t, 0) + (d.get("amount") or 0)
        type_cnt[t] = type_cnt.get(t, 0) + 1
for t, total in sorted(type_sum.items(), key=lambda x: -abs(x[1])):
    print(f"  {t:<35s} {total:>14,.0f}원  ({type_cnt[t]}건)")

# 4) remarks 에 수기 입력 흔적
print("\n=== 4) 이 숙소 예약의 remarks/channelRemarks 샘플 ===")
seen = 0
for r in resvs:
    if r.get("propertyId") != target_pid: continue
    rem = r.get("remarks")
    cr = r.get("channelRemarks")
    if rem or cr:
        print(f"  · {r.get('guestName', '-')} / {r.get('checkInDate')}")
        if rem: print(f"      remarks: {rem[:200]}")
        if cr:  print(f"      channel: {cr[:200]}")
        seen += 1
        if seen >= 5: break
if seen == 0:
    print("  (remarks 없음)")

PYEOF
