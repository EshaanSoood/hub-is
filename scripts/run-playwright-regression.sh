#!/usr/bin/env bash
set -euo pipefail

if [[ "${PLAYWRIGHT_E2E_ENABLED:-}" != "true" ]]; then
  echo "Playwright regression suite is opt-in. Set PLAYWRIGHT_E2E_ENABLED=true to run." >&2
  exit 1
fi

exec npx playwright test -c playwright.config.ts "$@"
