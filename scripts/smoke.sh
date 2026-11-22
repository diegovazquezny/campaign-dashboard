#!/usr/bin/env bash
# End-to-end smoke test of the Docker stack. Works from any directory (it cds to the repo root).
#   scripts/smoke.sh          start the stack (building if needed) and check it
#   scripts/smoke.sh --down   same, then stop the stack (`docker compose down`)
# Env: SMOKE_TIMEOUT (seconds to wait for the API, default 300), DB_PORT (host DB port, see .env.example).
# Exits non-zero with a "SMOKE FAIL" message on the first failed step.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

API=http://localhost:3001
WEB=http://localhost:3000
TIMEOUT="${SMOKE_TIMEOUT:-300}"
DOWN=0
case "${1:-}" in
  "") ;;
  --down) DOWN=1 ;;
  *) echo "usage: scripts/smoke.sh [--down]" >&2; exit 2 ;;
esac

fail() { echo "SMOKE FAIL: $*" >&2; exit 1; }
step() { echo "==> $*"; }

# Evaluate a python expression over the JSON on stdin (as `d`) and print it.
json() { python3 -I -c 'import json,sys; d=json.load(sys.stdin); print(eval(sys.argv[1]))' "$1"; }

body=""
cleanup() {
  [ -z "$body" ] || rm -f "$body"
  if [ "$DOWN" = 1 ]; then step "docker compose down"; docker compose down; fi
  return 0
}
trap cleanup EXIT

[ -f .env ] || { step "Creating .env from .env.example"; cp .env.example .env; }

step "docker compose up -d --build"
docker compose up -d --build || fail "docker compose up failed"

step "Waiting up to ${TIMEOUT}s for $API/api/meta"
start=$(date +%s)
until curl -fsS -o /dev/null "$API/api/meta" 2>/dev/null; do
  [ $(( $(date +%s) - start )) -lt "$TIMEOUT" ] || fail "API did not respond at $API/api/meta within ${TIMEOUT}s (see: docker compose logs api)"
  sleep 3
done

step "GET /api/meta"
meta=$(curl -fsS "$API/api/meta") || fail "GET /api/meta failed"
from=$(echo "$meta" | json 'd["data_coverage"]["from"]' 2>/dev/null) || fail "/api/meta has no data_coverage (is the data imported?)"
to=$(echo "$meta" | json 'd["data_coverage"]["to"]') || fail "/api/meta has no data_coverage.to"
locations=$(echo "$meta" | json 'len(d["locations"])') || fail "/api/meta has no locations"
[ "$locations" -gt 0 ] || fail "/api/meta returned no locations"
echo "    coverage $from to $to, $locations locations"

step "GET /api/campaigns/metrics?from=$from&to=$to"
metrics=$(curl -fsS "$API/api/campaigns/metrics?from=$from&to=$to") || fail "GET /api/campaigns/metrics failed"
# First named campaign (not the "No campaign" row) with calls > 0; empty if none.
name=$(echo "$metrics" | json 'next((r["name"] for r in d["rows"] if r["campaign_id"] is not None and r["calls"] > 0), "")') \
  || fail "/api/campaigns/metrics returned an unexpected shape"
[ -n "$name" ] || fail "/api/campaigns/metrics has no campaign with calls > 0 for $from to $to"
echo "    campaign with calls: $name"
# The page is server-rendered HTML, so the name appears escaped (e.g. & as &amp;).
escaped=$(printf '%s' "$name" | python3 -I -c 'import html,sys; print(html.escape(sys.stdin.read()))')

# Ask for the same dates as the API check: the default range (last quarter) moves with today's date.
page="$WEB/?preset=custom&from=$from&to=$to"
step "GET $page"
body=$(mktemp)
# The web container has no health check, so retry while it starts listening.
code=$(curl -sS --retry 10 --retry-connrefused --retry-delay 2 -o "$body" -w '%{http_code}' "$page") || fail "could not reach $page"
[ "$code" = 200 ] || fail "GET $page returned HTTP $code, expected 200"
grep -qF -- "$escaped" "$body" || fail "GET $page returned 200 but the page does not contain campaign name '$name'"

echo "SMOKE OK: API and dashboard are serving data."
