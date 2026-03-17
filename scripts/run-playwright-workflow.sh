#!/usr/bin/env bash
set -euo pipefail

if [[ "${PLAYWRIGHT_E2E_ENABLED:-}" != "true" ]]; then
  echo "Playwright workflow suite is opt-in. Set PLAYWRIGHT_E2E_ENABLED=true to run." >&2
  exit 1
fi

if [[ "${PLAYWRIGHT_WORKFLOW_ENABLED:-}" != "true" ]]; then
  echo "Workflow suite needs an explicit opt-in. Set PLAYWRIGHT_WORKFLOW_ENABLED=true to run." >&2
  exit 1
fi

exec npx playwright test -c e2e/workflow/playwright.workflow.config.mjs "$@"
