#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SSH_KEY="${DEPLOY_SSH_KEY:-}"
DEPLOY_USER="${DEPLOY_USER:-eshaan}"
DEPLOY_HOST="${DEPLOY_HOST:-45.55.142.128}"
REMOTE_ROOT="${DEPLOY_REMOTE_ROOT:-/home/$DEPLOY_USER/deployments/eshaan-os-root}"
SSH_KEY_USE="$SSH_KEY"
ENV_FILE="${DEPLOY_ENV_FILE:-$ROOT_DIR/.env.production}"

if [[ -z "$SSH_KEY_USE" ]]; then
  echo "DEPLOY_SSH_KEY is required."
  exit 1
fi

if [[ "$SSH_KEY_USE" == *" "* ]]; then
  TEMP_KEY="$(mktemp /tmp/eshaan-os-key.XXXXXX)"
  cp "$SSH_KEY_USE" "$TEMP_KEY"
  chmod 600 "$TEMP_KEY"
  SSH_KEY_USE="$TEMP_KEY"
  trap 'rm -f "$TEMP_KEY"' EXIT
fi

if [[ -f "$ENV_FILE" ]]; then
  echo "Loading frontend env from $ENV_FILE ..."
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
fi

require_frontend_env() {
  local name="$1"
  local value="${!name:-}"
  if [[ -z "$value" ]]; then
    echo "Missing required frontend build env: $name"
    exit 1
  fi
}

require_frontend_env "VITE_KEYCLOAK_URL"
require_frontend_env "VITE_KEYCLOAK_REALM"
require_frontend_env "VITE_KEYCLOAK_CLIENT_ID"

if [[ "$VITE_KEYCLOAK_URL" == "https://auth.example.com" || "$VITE_KEYCLOAK_REALM" == "example-realm" || "$VITE_KEYCLOAK_CLIENT_ID" == "example-hub" ]]; then
  echo "Refusing to build with placeholder Keycloak env values. Provide real VITE_KEYCLOAK_* settings."
  exit 1
fi

echo "Building app..."
npm --prefix "$ROOT_DIR" run build

echo "Syncing dist to $DEPLOY_USER@$DEPLOY_HOST:$REMOTE_ROOT/dist ..."
ssh -i "$SSH_KEY_USE" "$DEPLOY_USER@$DEPLOY_HOST" "mkdir -p '$REMOTE_ROOT/dist'"
rsync -avz --delete -e "ssh -i $SSH_KEY_USE" "$ROOT_DIR/dist/" "$DEPLOY_USER@$DEPLOY_HOST:$REMOTE_ROOT/dist/"

echo "Done."
