#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
echo "deploy:postmark is deprecated. Using deploy:hub-api."
bash "$ROOT_DIR/scripts/deploy-hub-api.sh"
