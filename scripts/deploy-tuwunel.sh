#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SSH_KEY="${DEPLOY_SSH_KEY:-}"
DEPLOY_USER="${DEPLOY_USER:-eshaan}"
DEPLOY_HOST="${DEPLOY_HOST:-}"
LOCAL_TUWUNEL_DIR="${DEPLOY_TUWUNEL_DIR:-$ROOT_DIR/apps/tuwunel}"
REMOTE_TUWUNEL_DIR="${DEPLOY_REMOTE_TUWUNEL_DIR:-/home/$DEPLOY_USER/deployments/eshaan-os-tuwunel}"
REMOTE_TUWUNEL_DIR="${REMOTE_TUWUNEL_DIR%/}"
SSH_KEY_USE="$SSH_KEY"

if [[ -z "$SSH_KEY_USE" ]]; then
  echo "DEPLOY_SSH_KEY is required."
  exit 1
fi

if [[ -z "$DEPLOY_HOST" ]]; then
  echo "DEPLOY_HOST is required."
  exit 1
fi

if [[ "$SSH_KEY_USE" == *" "* ]]; then
  TEMP_KEY="$(mktemp /tmp/eshaan-os-key.XXXXXX)"
  cp "$SSH_KEY_USE" "$TEMP_KEY"
  chmod 600 "$TEMP_KEY"
  SSH_KEY_USE="$TEMP_KEY"
  trap 'rm -f "$TEMP_KEY"' EXIT
fi

SSH_OPTS=(-i "$SSH_KEY_USE" -o BatchMode=yes -o StrictHostKeyChecking=accept-new)
printf -v SSH_RSYNC_CMD '%q ' ssh "${SSH_OPTS[@]}"
SSH_RSYNC_CMD="${SSH_RSYNC_CMD% }"
printf -v REMOTE_TUWUNEL_DIR_Q '%q' "$REMOTE_TUWUNEL_DIR"
printf -v REMOTE_TUWUNEL_DIR_RSYNC '%q' "$REMOTE_TUWUNEL_DIR/"
printf -v REMOTE_TUWUNEL_COMPOSE_FILE_Q '%q' "$REMOTE_TUWUNEL_DIR/docker-compose.yml"

echo "Syncing Tuwunel deploy files..."
ssh "${SSH_OPTS[@]}" "$DEPLOY_USER@$DEPLOY_HOST" "mkdir -p -- $REMOTE_TUWUNEL_DIR_Q"
rsync -avz --delete --delete-delay \
  --exclude='.env' \
  --exclude='.env.*' \
  --exclude='*.local' \
  -e "$SSH_RSYNC_CMD" \
  "$LOCAL_TUWUNEL_DIR/" \
  "$DEPLOY_USER@$DEPLOY_HOST:$REMOTE_TUWUNEL_DIR_RSYNC"

echo "Building/restarting Tuwunel container..."
ssh "${SSH_OPTS[@]}" "$DEPLOY_USER@$DEPLOY_HOST" "docker compose -f $REMOTE_TUWUNEL_COMPOSE_FILE_Q up -d --build"

echo "Done."
