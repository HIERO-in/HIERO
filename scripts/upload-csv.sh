#!/bin/bash
# Upload CSV files to monthly-reports import API
DIR="$1"
API="http://localhost:3000/api/monthly-reports/import"

if [ -z "$DIR" ] || [ ! -d "$DIR" ]; then
  echo "Usage: $0 <csv-directory>"
  exit 1
fi

# Build -F args
ARGS=""
count=0
for f in "$DIR"/*.csv; do
  [ -f "$f" ] || continue
  ARGS="$ARGS -F files=@$f"
  count=$((count + 1))
done

echo "Uploading $count CSV files from: $DIR"
eval curl -s -X POST "$API" $ARGS
echo ""
