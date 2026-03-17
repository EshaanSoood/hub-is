#!/usr/bin/env bash
set -euo pipefail

if [[ $# -ne 2 ]]; then
  echo "Usage: $0 BASE_URL ACCESS_TOKEN" >&2
  echo "Optional env: PROJECT_ID (default: backend-pilot), ROOM_ID (default: !test-room:chat.eshaansood.org)" >&2
  exit 1
fi

BASE_URL="${1%/}"
ACCESS_TOKEN="$2"
PROJECT_ID="${PROJECT_ID:-backend-pilot}"
ROOM_ID="${ROOM_ID:-!test-room:chat.eshaansood.org}"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

print_json() {
  local file="$1"
  node -e "const fs=require('fs'); const path=process.argv[1]; const raw=fs.readFileSync(path,'utf8'); try { console.log(JSON.stringify(JSON.parse(raw), null, 2)); } catch { process.stdout.write(raw); if (!raw.endsWith('\n')) console.log(''); }" "$file"
}

json_read() {
  local file="$1"
  local expr="$2"
  node -e "const fs=require('fs'); const path=process.argv[1]; const expr=process.argv[2]; const data=JSON.parse(fs.readFileSync(path,'utf8')); const result=expr.split('.').reduce((acc, key) => acc == null ? undefined : acc[key], data); if (result === undefined || result === null) process.exit(1); if (typeof result === 'object') console.log(JSON.stringify(result)); else console.log(String(result));" "$file" "$expr"
}

request() {
  local method="$1"
  local url="$2"
  local body_file="$3"
  local out_file="$4"

  local status
  if [[ -n "$body_file" ]]; then
    status="$(curl -sS -o "$out_file" -w "%{http_code}" \
      -X "$method" \
      "$url" \
      -H "Authorization: Bearer $ACCESS_TOKEN" \
      -H "Content-Type: application/json" \
      --data @"$body_file")"
  else
    status="$(curl -sS -o "$out_file" -w "%{http_code}" \
      -X "$method" \
      "$url" \
      -H "Authorization: Bearer $ACCESS_TOKEN")"
  fi
  echo "$status"
}

pass() {
  echo "PASS: $1"
}

fail() {
  echo "FAIL: $1" >&2
}

is_success_status() {
  [[ "$1" =~ ^2[0-9][0-9]$ ]]
}

echo "Testing chat provision against $BASE_URL"
echo "Using PROJECT_ID=$PROJECT_ID"
echo

PROVISION_RESPONSE="$TMP_DIR/provision.json"
PROVISION_STATUS="$(request "POST" "$BASE_URL/api/hub/chat/provision" "" "$PROVISION_RESPONSE")"
echo "Provision response ($PROVISION_STATUS):"
print_json "$PROVISION_RESPONSE"
if ! is_success_status "$PROVISION_STATUS"; then
  fail "provision"
  exit 1
fi
pass "provision"
echo

SNAPSHOT_BODY="$TMP_DIR/create-snapshot.json"
TIMESTAMP="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
cat > "$SNAPSHOT_BODY" <<JSON
{
  "project_id": "$PROJECT_ID",
  "conversation_room_id": "$ROOM_ID",
  "message_sender_display_name": "Codex Matrix Smoke",
  "message_text": "Snapshot test from infra/tuwunel/test-chat-provision.sh at $TIMESTAMP",
  "message_timestamp": "$TIMESTAMP"
}
JSON

CREATE_RESPONSE="$TMP_DIR/create-snapshot-response.json"
CREATE_STATUS="$(request "POST" "$BASE_URL/api/hub/chat/snapshots" "$SNAPSHOT_BODY" "$CREATE_RESPONSE")"
echo "Create snapshot response ($CREATE_STATUS):"
print_json "$CREATE_RESPONSE"
if ! is_success_status "$CREATE_STATUS"; then
  fail "create snapshot"
  exit 1
fi
SNAPSHOT_ID="$(json_read "$CREATE_RESPONSE" "data.snapshot.snapshot_id")"
pass "create snapshot"
echo

LIST_RESPONSE="$TMP_DIR/list-snapshots.json"
LIST_STATUS="$(request "GET" "$BASE_URL/api/hub/chat/snapshots?project_id=$PROJECT_ID" "" "$LIST_RESPONSE")"
echo "List snapshots response ($LIST_STATUS):"
print_json "$LIST_RESPONSE"
if ! is_success_status "$LIST_STATUS"; then
  fail "list snapshots"
  exit 1
fi
if node -e "const fs=require('fs'); const id=process.argv[2]; const data=JSON.parse(fs.readFileSync(process.argv[1],'utf8')); const snapshots=data?.data?.snapshots || []; process.exit(snapshots.some((item) => item.snapshot_id === id) ? 0 : 1);" "$LIST_RESPONSE" "$SNAPSHOT_ID"; then
  pass "list snapshots"
else
  fail "list snapshots did not include created snapshot $SNAPSHOT_ID"
  exit 1
fi
echo

DELETE_RESPONSE="$TMP_DIR/delete-snapshot.json"
DELETE_STATUS="$(request "DELETE" "$BASE_URL/api/hub/chat/snapshots/$SNAPSHOT_ID" "" "$DELETE_RESPONSE")"
echo "Delete snapshot response ($DELETE_STATUS):"
print_json "$DELETE_RESPONSE"
if ! is_success_status "$DELETE_STATUS"; then
  fail "delete snapshot"
  exit 1
fi
pass "delete snapshot"
