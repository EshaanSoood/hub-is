#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="${HUB_LIVE_ENV_FILE:-$ROOT_DIR/.env.hub.live.local}"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing live env file: $ENV_FILE"
  echo "Create it (local only) with HUB_BASE_URL, HUB_PROJECT_ID, HUB_OWNER_ACCESS_TOKEN, HUB_ACCESS_TOKEN, HUB_NON_MEMBER_ACCESS_TOKEN."
  exit 1
fi

set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

: "${HUB_INCLUDE_COLLAB_SMOKE:=true}"
export HUB_INCLUDE_COLLAB_SMOKE

required_vars=(
  HUB_BASE_URL
  HUB_PROJECT_ID
  HUB_OWNER_ACCESS_TOKEN
  HUB_ACCESS_TOKEN
  HUB_NON_MEMBER_ACCESS_TOKEN
)

missing=()
for name in "${required_vars[@]}"; do
  if [[ -z "${!name:-}" ]]; then
    missing+=("$name")
  fi
done

if (( ${#missing[@]} > 0 )); then
  echo "Missing required live vars in $ENV_FILE: ${missing[*]}"
  exit 1
fi

exec node "$ROOT_DIR/scripts/check-hub-core-gate.mjs"
