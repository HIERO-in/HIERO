#!/usr/bin/env python3
"""
Hostex Properties API 페이지네이션 방식 진단 스크립트.
total=98인데 page 파라미터가 무시되는 문제 확인용.
"""
import subprocess
import json

TOKEN = "gSS3KrZqlJtMd566fdDAfUMHOUYntYZs6NVgGg286RPTBHo2LMiSwqNPzYPBlJSt"
BASE = "https://api.hostex.io/v3/properties"


def fetch(query):
    r = subprocess.run(
        [
            "curl", "-s",
            f"{BASE}?{query}",
            "-H", f"Hostex-Access-Token: {TOKEN}",
        ],
        capture_output=True, text=True,
    )
    try:
        return json.loads(r.stdout)
    except Exception:
        return {"error": r.stdout[:200]}


tests = [
    "page=1&per_page=100",
    "page=2&per_page=100",
    "page=3&per_page=100",
    "page=4&per_page=100",
    "page=5&per_page=100",
    "offset=20&per_page=100",
    "offset=20&limit=100",
    "per_page=50",
    "per_page=20&page=2",
    "limit=100",
    "size=100",
    "page_size=100",
]

print(f"{'Query':<35s} count  total  first 3 IDs")
print("-" * 75)

for q in tests:
    r = fetch(q)
    data = r.get("data", {}) if isinstance(r, dict) else {}
    props = data.get("properties", [])
    total = data.get("total", "N/A")
    first_ids = [p.get("id") for p in props[:3]]
    print(f"[{q:<33s}] {len(props):3d}   {str(total):4s}   {first_ids}")
