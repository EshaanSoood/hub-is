# Spaces/Projects Rename Parity Baseline

Git SHA: `42c7551aaa7b61b23b8bd317bd73c7af58b6e9dc`

Summary: total tests 0, passed 0, failed 0, skipped 0.

Exit status: `1`

## Commands

Setup prerequisites run before the e2e command:

```bash
npm ci
npx playwright install
```

E2E command:

```bash
PLAYWRIGHT_E2E_ENABLED=true \
PLAYWRIGHT_BASE_URL=<YOUR_TEST_BASE_URL> \
HUB_API_BASE_URL=<YOUR_API_BASE_URL> \
npm run test:e2e
```

`PLAYWRIGHT_BASE_URL` and `HUB_API_BASE_URL` are placeholders. Replace them with local or dedicated test environment URLs before running so the suite does not target production by accident.

## Pre-existing Failures

No Playwright tests executed. The baseline failed during test collection/setup before any tests were recorded.

- Missing module import: `e2e/support/hubHomeAudit.ts` imports `e2e/support/surfaceAudit.ts`, but that file is not present in the worktree.
- Missing token file: `e2e/.env.tokens.local` was required by the e2e auth helper and was not present in the worktree.

These failures were present before any rename work.

## Full Output

```text

> hub-os@1.0.0 test:e2e
> bash scripts/run-playwright-regression.sh

Error: Cannot find module '<REPO_ROOT>/e2e/support/surfaceAudit.ts' imported from <REPO_ROOT>/e2e/support/hubHomeAudit.ts
Error: ENOENT: no such file or directory, open '<REPO_ROOT>/e2e/.env.tokens.local'

   at helpers/auth.ts:85

  83 |   }
  84 |   const tokensPath = resolveTokensPath();
> 85 |   const envMap = parseEnvFile(readFileSync(tokensPath, 'utf8'));
     |                               ^
  86 |   const token = (envMap[tokenKey] || '').trim();
  87 |   if (!token) {
  88 |     throw new Error(`${tokenKey} missing in ${tokensPath}`);
    at readTokenFromFile (<REPO_ROOT>/e2e/helpers/auth.ts:85:31)
    at readTokenAFromFile (<REPO_ROOT>/e2e/helpers/auth.ts:94:10)
    at <REPO_ROOT>/e2e/tests/hub-home-daily-brief-states.spec.ts:37:17
    at <REPO_ROOT>/e2e/tests/hub-home-daily-brief-states.spec.ts:36:15

=== Hub OS E2E AUDIT REPORT ===

Date: 2026-04-26T23:02:54.502Z
Branch: rename/spaces-projects
Commit: 42c7551aaa7b61b23b8bd317bd73c7af58b6e9dc

SUMMARY
Total: 0
Passed: 0
Failed: 0
Skipped: 0

RESULTS BY AREA
[Authentication & Session]
  ✗ No tests recorded

[myHub]
  ✗ No tests recorded

[Projects]
  ✗ No tests recorded

[Panes]
  ✗ No tests recorded

[Document Editor (Collaborative Lexical Editor)]
  ✗ No tests recorded

[Collections & Records]
  ✗ No tests recorded

[Calendar & Events]
  ✗ No tests recorded

[Tasks]
  ✗ No tests recorded

[Files]
  ✗ No tests recorded

[Notifications]
  ✗ No tests recorded

[Permissions & Role Gating]
  ✗ No tests recorded

[Quick Add / NLP]
  ✗ No tests recorded

[Navigation & Shell]
  ✗ No tests recorded

[Error States]
  ✗ No tests recorded

CONSOLE ERRORS CAPTURED
  None.

FAILED TEST DETAILS
  None.

KNOWN GAPS (features not testable)
  None.
```
