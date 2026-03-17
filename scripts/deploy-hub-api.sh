#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SSH_KEY="${DEPLOY_SSH_KEY:-}"
DEPLOY_USER="${DEPLOY_USER:-eshaan}"
DEPLOY_HOST="${DEPLOY_HOST:-45.55.142.128}"
LOCAL_HUB_API_DIR="${DEPLOY_HUB_API_DIR:-${DEPLOY_POSTMARK_DIR:-$ROOT_DIR/apps/hub-api}}"
LOCAL_SHARED_DIR="${DEPLOY_SHARED_DIR:-$ROOT_DIR/apps/shared}"
REMOTE_HUB_API_DIR="${DEPLOY_REMOTE_HUB_API_DIR:-${DEPLOY_REMOTE_POSTMARK_DIR:-/home/$DEPLOY_USER/deployments/eshaan-os-hub-api}}"
SSH_KEY_USE="$SSH_KEY"

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

echo "Syncing Hub API deploy files..."
ssh -i "$SSH_KEY_USE" "$DEPLOY_USER@$DEPLOY_HOST" "mkdir -p '$REMOTE_HUB_API_DIR'"
rsync -avz -e "ssh -i $SSH_KEY_USE" "$LOCAL_HUB_API_DIR/" "$DEPLOY_USER@$DEPLOY_HOST:$REMOTE_HUB_API_DIR/"
rsync -avz -e "ssh -i $SSH_KEY_USE" "$LOCAL_SHARED_DIR/" "$DEPLOY_USER@$DEPLOY_HOST:$REMOTE_HUB_API_DIR/shared/"

echo "Building/restarting Hub API container..."
ssh -i "$SSH_KEY_USE" "$DEPLOY_USER@$DEPLOY_HOST" "docker compose -f '$REMOTE_HUB_API_DIR/docker-compose.yml' up -d --build"

echo "Done."
