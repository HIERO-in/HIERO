#!/bin/bash
# ════════════════════════════════════════════════════════════════
# HIERO · 월별 리포트 시드 스크립트
#
# 사용법:
#   1) 백엔드 실행 (별도 터미널): cd ~/hiero/hiero-backend && npm run start:dev
#   2) 두 개의 보고서 zip 을 풀어 CSV들이 있는 폴더 준비
#   3) 이 스크립트에 그 폴더 경로를 인자로 전달
#
# 예:
#   ./scripts/seed-monthly-reports.sh ~/Downloads/csv_files
#
# 폴더 안에 다음과 같은 파일들이 있으면 됨:
#   보고서-2026-04-01-속성 요약.csv
#   보고서-2026-04-01-속성-A24_예건 204_..._-예약.csv
#   보고서-2026-03-01-속성 요약.csv
#   ... (여러 월 한 번에 가능)
# ════════════════════════════════════════════════════════════════

set -eu

API_URL="${API_URL:-http://localhost:8080/api/monthly-reports}"
FOLDER="${1:-}"

if [ -z "$FOLDER" ]; then
  echo "사용법: $0 <CSV 폴더 경로>"
  echo ""
  echo "예: $0 ~/Downloads/csv_files"
  exit 1
fi

if [ ! -d "$FOLDER" ]; then
  echo "❌ 폴더를 찾을 수 없습니다: $FOLDER"
  exit 1
fi

# CSV 파일들을 수집
CSV_COUNT=$(find "$FOLDER" -maxdepth 2 -type f -name "*.csv" | wc -l | tr -d ' ')
if [ "$CSV_COUNT" -eq 0 ]; then
  echo "❌ CSV 파일이 없습니다: $FOLDER"
  exit 1
fi

echo "▶ 백엔드: $API_URL"
echo "▶ 발견한 CSV: $CSV_COUNT개"
echo ""

# multipart args 빌드
ARGS=()
while IFS= read -r f; do
  ARGS+=("-F" "files=@${f};type=text/csv")
done < <(find "$FOLDER" -maxdepth 2 -type f -name "*.csv")

echo "▶ POST $API_URL/import (multipart)"
echo ""

# 응답을 예쁘게
RESPONSE=$(curl -sS -X POST "${ARGS[@]}" "$API_URL/import")
echo "$RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$RESPONSE"

echo ""
echo "▶ 저장된 월 목록 확인"
curl -sS "$API_URL" | python3 -m json.tool 2>/dev/null || curl -sS "$API_URL"
