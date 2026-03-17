#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SSH_KEY="${DEPLOY_SSH_KEY:-}"
DEPLOY_USER="${DEPLOY_USER:-eshaan}"
DEPLOY_HOST="${DEPLOY_HOST:-REPLACE_ME}"
REMOTE_ROOT="${DEPLOY_REMOTE_ROOT:-/home/$DEPLOY_USER/deployments/eshaan-os-root}"
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

echo "Building app..."
npm --prefix "$ROOT_DIR" run build

echo "Syncing dist to $DEPLOY_USER@$DEPLOY_HOST:$REMOTE_ROOT/dist ..."
ssh -i "$SSH_KEY_USE" "$DEPLOY_USER@$DEPLOY_HOST" "mkdir -p '$REMOTE_ROOT/dist'"
rsync -avz --delete -e "ssh -i $SSH_KEY_USE" "$ROOT_DIR/dist/" "$DEPLOY_USER@$DEPLOY_HOST:$REMOTE_ROOT/dist/"

echo "Done."
