#!/usr/bin/env bash
set -euo pipefail

export E2E_BASE_URL="${E2E_BASE_URL:-http://127.0.0.1:5173}"
export PLAYWRIGHT_BASE_URL="${PLAYWRIGHT_BASE_URL:-$E2E_BASE_URL}"
export HUB_API_BASE_URL="${HUB_API_BASE_URL:-http://127.0.0.1:3001}"

exec npm --prefix e2e test -- tests/rename-trace.spec.ts "$@"
