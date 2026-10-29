#!/usr/bin/env bash
# Load queued logsheet JSON into staging Postgres.
# Each file is the stdin payload for one allowlisted ingest script.
#
#   bash Backend/scripts/apply-staging-inbox.sh [/opt/plant-information-dashboard]
#
# Prints one JSON object on stdout: {"applied":["script/file.json"],"failed":[{"file":"...","reason":"..."}]}

set -u

REPO="${1:-/opt/plant-information-dashboard}"
INBOX="$REPO/staging-inbox"
APPLIED="$INBOX/applied"
LOG="$INBOX/apply.log"
mkdir -p "$APPLIED"
touch "$LOG"

scripts=(
  ingest-sounding-day.js
  ingest-oil-movement-day.js
  ingest-production-day.js
  upsert-qco-day.js
  upsert-refinery-quality.mjs
  ingest-utility-day.js
)

shopt -s nullglob

escape() {
  local s=$1
  s=${s//\\/\\\\}
  s=${s//\"/\\\"}
  s=${s//$'\n'/ }
  s=${s//$'\r'/ }
  printf '%s' "$s"
}

applied_json=""
failed_json=""

for script in "${scripts[@]}"; do
  dir="$INBOX/$script"
  [ -d "$dir" ] || continue
  for file in "$dir"/*.json; do
    [ -f "$file" ] || continue
    base=$(basename "$file")
    rel="$script/$base"
    err=$(mktemp) || exit 1
    if docker exec -i pid-api node "scripts/$script" < "$file" >"$err" 2>&1; then
      cat "$err" >>"$LOG"
      rm -f "$err"
      mkdir -p "$APPLIED/$script"
      mv "$file" "$APPLIED/$script/$base"
      if [ -n "$applied_json" ]; then applied_json+=","; fi
      applied_json+="\"$(escape "$rel")\""
    else
      reason=$(tail -n 1 "$err" 2>/dev/null || true)
      cat "$err" >>"$LOG"
      rm -f "$err"
      if [ -z "$reason" ]; then reason="docker exec failed"; fi
      if [ -n "$failed_json" ]; then failed_json+=","; fi
      failed_json+="{\"file\":\"$(escape "$rel")\",\"reason\":\"$(escape "$reason")\"}"
    fi
  done
done

printf '{"applied":[%s],"failed":[%s]}\n' "$applied_json" "$failed_json"
if [ -n "$failed_json" ]; then
  exit 1
fi
