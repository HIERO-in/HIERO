#!/bin/bash
# Hostex 지출/비용 API 엔드포인트 탐지
# 가능한 경로 여러 개를 테스트

TOKEN="gSS3KrZqlJtMd566fdDAfUMHOUYntYZs6NVgGg286RPTBHo2LMiSwqNPzYPBlJSt"
BASE="https://api.hostex.io/v3"

test_endpoint() {
    local path="$1"
    echo "=== ${path} ==="
    local response=$(curl -s -w "\nHTTP_CODE:%{http_code}" "${BASE}${path}" -H "Hostex-Access-Token: ${TOKEN}")
    local code=$(echo "$response" | grep -o "HTTP_CODE:[0-9]*" | cut -d: -f2)
    local body=$(echo "$response" | sed '$ d')
    if [ "$code" = "200" ]; then
        echo "✅ HTTP 200 - 응답 앞 800 바이트:"
        echo "$body" | head -c 800
        echo ""
    else
        echo "❌ HTTP $code"
        echo "$body" | head -c 200
    fi
    echo ""
    echo "---"
}

echo "=== Hostex 지출 API 엔드포인트 탐지 ==="
echo ""

# 가장 가능성 높은 경로들
test_endpoint "/transactions"
test_endpoint "/transactions?offset=0&limit=10"
test_endpoint "/expenses"
test_endpoint "/expenses?offset=0&limit=10"
test_endpoint "/income_and_expenses"
test_endpoint "/metrics/transactions"
test_endpoint "/finance/transactions"
test_endpoint "/finance/expenses"
test_endpoint "/accounting/transactions"
test_endpoint "/revenues_and_expenses"

echo ""
echo "=== 메뉴/카테고리 조회 (비용 카테고리 목록) ==="
test_endpoint "/transaction_categories"
test_endpoint "/expense_categories"
test_endpoint "/categories"
