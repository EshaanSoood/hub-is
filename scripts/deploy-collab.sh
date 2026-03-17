#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SSH_KEY="${DEPLOY_SSH_KEY:-}"
DEPLOY_USER="${DEPLOY_USER:-eshaan}"
DEPLOY_HOST="${DEPLOY_HOST:-REPLACE_ME}"
LOCAL_COLLAB_DIR="${DEPLOY_COLLAB_DIR:-$ROOT_DIR/apps/hub-collab}"
LOCAL_SHARED_DIR="${DEPLOY_SHARED_DIR:-$ROOT_DIR/apps/shared}"
REMOTE_COLLAB_DIR="${DEPLOY_REMOTE_COLLAB_DIR:-/home/$DEPLOY_USER/deployments/eshaan-os-hub-collab}"
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

echo "Syncing Hub collab deploy files..."
ssh -i "$SSH_KEY_USE" "$DEPLOY_USER@$DEPLOY_HOST" "mkdir -p '$REMOTE_COLLAB_DIR'"
rsync -avz -e "ssh -i $SSH_KEY_USE" "$LOCAL_COLLAB_DIR/" "$DEPLOY_USER@$DEPLOY_HOST:$REMOTE_COLLAB_DIR/"
rsync -avz -e "ssh -i $SSH_KEY_USE" "$LOCAL_SHARED_DIR/" "$DEPLOY_USER@$DEPLOY_HOST:$REMOTE_COLLAB_DIR/shared/"

echo "Building/restarting Hub collab container..."
ssh -i "$SSH_KEY_USE" "$DEPLOY_USER@$DEPLOY_HOST" "docker compose -f '$REMOTE_COLLAB_DIR/docker-compose.yml' up -d --build"

echo "Done."
