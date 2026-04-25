#!/bin/bash
# 최후의 수단들 테스트:
# 1) v4, v2, v1 API
# 2) open_api 경로 없이
# 3) 완전 다른 prefix

TOKEN="gSS3KrZqlJtMd566fdDAfUMHOUYntYZs6NVgGg286RPTBHo2LMiSwqNPzYPBlJSt"

test_url() {
    local url="$1"
    local code=$(curl -s -o /tmp/resp.json -w "%{http_code}" "$url" -H "Hostex-Access-Token: ${TOKEN}")
    if [ "$code" = "200" ]; then
      local preview=$(head -c 200 /tmp/resp.json)
      # 404 에러 바디인지 확인
      if [[ "$preview" == *"could not be found"* ]]; then
        return
      fi
      echo "✅ $url"
      echo "   $preview"
      echo ""
    fi
}

echo "=== v4, v2, v1 버전 ==="
for v in v4 v2 v1; do
  for path in transactions expenses income_and_expenses metrics; do
    test_url "https://api.hostex.io/$v/$path"
  done
done

echo ""
echo "=== open_api 없이 직접 ==="
for path in "transactions" "v3/transactions" "api/transactions" "api/v3/transactions"; do
  test_url "https://api.hostex.io/$path"
done

echo ""
echo "=== 웹 API 도메인 시도 ==="
for path in "api/transactions" "api/v1/transactions" "api/app/transactions"; do
  test_url "https://hostex.io/$path"
done

echo ""
echo "=== ('app' prefix) ==="
test_url "https://api.hostex.io/app/v3/transactions"
test_url "https://api.hostex.io/v3/app/transactions"
