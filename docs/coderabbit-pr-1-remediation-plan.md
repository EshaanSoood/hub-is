# CodeRabbit PR #1 Read-Only Audit and Remediation Plan

Date: 2026-03-02
Source reviewed: `docs/coderabbit-pr-1-comments.md`
Audit mode: read-only (no source code changes made)

## Executive Summary

- Actionable findings reviewed: 29 (27 major, 2 critical)
- Verified as listed open in this audit matrix snapshot: 29/29 (audited commit `ff0653b9a1e3726da1abde9767b543424367848d`, audited at `2026-03-02T21:25:19Z`)
- Highest-risk areas:
  - Exposed sensitive data in `collab-live-runlog.txt`
  - Invite token handling (plain token stored/returned broadly)
  - Portability blockers (hardcoded absolute paths)
  - Missing timeout/resource caps on network and request-body paths

## Audit Matrix (Status + Evidence)

| # | Comment target | Status | Current evidence |
|---|---|---|---|
| 1 | `apps/hub-api/Dockerfile` non-root user | Open | Runs as root, no `USER` set. |
| 2 | `apps/hub-collab/Dockerfile` non-root user | Open | Runs as root, no `USER` set. |
| 3 | `src/features/notes/lexicalState.ts` inline text split | Open | Uses `flatMap(...children).join('\n')`, splitting inline text nodes. |
| 4 | `src/types/domain.ts` invite token in `HubInviteRecord` | Open | `HubInviteRecord` includes `token: string`. |
| 5 | `apps/hub-collab/docker-compose.yml` absolute paths | Open | Build context and `env_file` use host-specific absolute paths like `<repo-root>/...`. |
| 6 | `scripts/calendar-nlp/corpus.test.mjs` hardcoded local paths | Open | `DEFAULT_CORPUS_PATHS` contains machine-specific absolute paths like `<repo-root>/...`; test hard-fails when none found. |
| 7 | `scripts/deploy-hub-api.sh` SSH hardening | Open | `ssh`/`rsync` missing strict host-key/batch/timeout options. |
| 8 | `scripts/deploy-collab.sh` SSH hardening | Open | Same missing SSH/rsync hardening as above. |
| 9 | `scripts/calendar-nlp/scratch-ui-server.mjs` request body cap | Open | `/api/parse` concatenates request body with no byte limit. |
| 10 | `src/components/auth/ProfilePanel.tsx` external avatar PII leak | Open | Sends name/email/userId-derived seed to DiceBear URL. |
| 11 | `scripts/check-collab-preflight.mjs` quote stripping for env values | Open | `.env` parser returns raw value without stripping surrounding quotes. |
| 12 | `scripts/check-collab-preflight.mjs` request timeout | Open | `fetch(target)` has no abort/timeout. |
| 13 | `scripts/check-collab-ws-live.mjs` request timeout | Open | HTTP `request()` helper has no timeout/abort. |
| 14 | `scripts/check-hub-policy-live.mjs` request timeout | Open | `request()` helper has no timeout/abort. |
| 15 | Node engine requirement for `node:sqlite` | Open | Root and `apps/hub-collab/package.json` missing `engines.node >=22`. |
| 16 | `src/lib/calendar-nlp/passes/durationPass.ts` day units | Open | Numeric `for ...` regex omits `day(s)` tokens. |
| 17 | `scripts/check-hub-tasks-local.mjs` SIGKILL fallback check | Open | Uses `hubChild.killed` after `SIGTERM`, which is not an exit check. |
| 18 | `apps/hub-collab/collab-server.mjs` pending buffer cap | Open | `pendingMsgs` grows unbounded while waiting for doc load. |
| 19 | `apps/hub-collab/collab-server.mjs` numeric env validation | Open | `PORT`/limits/timeouts parsed via `Number(...)` without finite/range checks. |
| 20 | `src/lib/calendar-nlp/passes/recurrencePass.ts` exception gating/merge | Open | `runExceptionRule` writes unconditionally and overwrites prior exceptions. |
| 21 | `src/context/ProjectsContext.tsx` stale async writes | Open | `refreshProjects()` has no stale-request guard after await. |
| 22 | `scripts/check-authz-runtime.mjs` request timeout | Open | `requestJson()` has no timeout/abort. |
| 23 | `src/pages/ProjectPage.tsx` editor lock auto-clear | Open | `setTimeout(...setEditorLocked(false), 0)` immediately clears lock. |
| 24 | `src/lib/calendar-nlp/passes/chronoPass.ts` invalid calendar dates | Open | Month/day fallback checks only 1..31, not real dates (e.g., Feb 31). |
| 25 | `src/features/notes/CollaborativeLexicalEditor.tsx` effect churn | Open | Provider setup effect depends on inline callbacks, causing teardown/reconnect churn. |
| 26 | `src/services/projectsService.ts` NLP parse exceptions block notes | Open | `parseEventInput(...)` not wrapped; throw causes generic note-load failure. |
| 27 | `src/lib/calendar-nlp/utils.ts` locale-sensitive weekday extraction | Open | Weekday token comes from locale formatter, can break non-English mapping. |
| 28 | `collab-live-runlog.txt` committed secrets/PII | Open (Critical) | File includes emails, tokens, user IDs, disposable passwords, invite tokens. |
| 29 | `scripts/check-hub-tasks-local.mjs` hardcoded absolute spawn path | Open (Critical) | `spawn('node', ['<repo-root>/.../hub-api.mjs'])`. |

## Non-Breaking Fix Plan

## Phase 0: Safety baseline (before code changes)

1. Create a short-lived branch and snapshot current behavior.
2. Run baseline checks and save outputs:
   - `npm run typecheck`
   - `npm run lint`
   - `npm run build`
   - `npm run test:nlp`
   - Script smoke checks that do not require privileged live credentials.
3. Capture baseline artifacts under `docs/` for before/after comparison.

## Phase 1: Critical security containment

1. Sanitize or remove sensitive `collab-live-runlog.txt` data.
2. Rotate exposed secrets immediately:
   - owner/member/user access tokens
   - invite tokens
   - disposable passwords
   - any related session credentials used in this runlog
3. Prevent recurrence:
   - stop committing raw live runlogs
   - enforce redaction in log-producing scripts
   - add ignore/sanitized-output policy for similar artifacts
4. Validate by checking repo for leaked patterns (emails/tokens/password-like strings) in committed artifacts.

## Phase 2: Portability + runtime compatibility

1. Replace hardcoded absolute paths with repo-relative resolution:
   - `scripts/check-hub-tasks-local.mjs` spawn path via `import.meta.url` + `path.resolve`
   - `apps/hub-collab/docker-compose.yml` `context`/`env_file` portability updates
2. Add Node runtime guardrails:
   - `engines.node: ">=22.0.0"` in root `package.json`
   - same in `apps/hub-collab/package.json`
3. Validate on clean checkout path and in CI-like environment.

## Phase 3: Infrastructure/script hardening

1. Docker least-privilege:
   - add non-root users in `apps/hub-api/Dockerfile` and `apps/hub-collab/Dockerfile`
   - ensure ownership/permissions for runtime files
2. SSH deploy hardening (`deploy-hub-api.sh`, `deploy-collab.sh`):
   - `BatchMode=yes`, `IdentitiesOnly=yes`, strict host-key policy, connection timeout
3. Network timeout consistency for script helpers:
   - `check-collab-preflight.mjs`
   - `check-collab-ws-live.mjs`
   - `check-hub-policy-live.mjs`
   - `check-authz-runtime.mjs`
4. `check-collab-preflight.mjs` `.env` parser quote normalization.
5. Validate with negative-path tests (host unreachable, DNS failure, slow endpoint) to ensure fail-fast behavior.

## Phase 4: API/data security model for invites (highest complexity)

1. Introduce invite token split model:
   - storage model keeps digest only (`token_digest`)
   - plain token available only at issuance time response
2. DB migration strategy (safe rollout):
   - add `token_digest` column/index
   - backfill digest from existing `token`
   - dual-read during transition if needed
   - remove plain `token` from general list/read responses
3. Type/API contract updates:
   - remove `token` from `HubInviteRecord`
   - add dedicated creation result type carrying one-time plain token
4. Ensure audit/logging paths never include plain invite token.
5. Backward-compatibility guard:
   - rollout in two steps if clients currently depend on `invite.token` in list responses.

## Phase 5: Collab server resource controls

1. Validate and clamp numeric env vars (`PORT`, max connections/docs, ping interval).
2. Add bounded pre-doc message buffering (count and total bytes cap).
3. Define overload behavior when limits are exceeded (close with explicit code/reason).
4. Validate under stress (rapid pre-load message flood, invalid env values, large connection fan-in).

## Phase 6: Frontend correctness and state lifecycle

1. `lexicalStateToPlainText`: preserve inline continuity by block-wise join.
2. `ProjectsContext` stale async protection for auth transitions.
3. `ProjectPage` editor lock: remove auto-unlock timer; unlock only via explicit successful path.
4. `CollaborativeLexicalEditor` provider lifecycle:
   - keep provider effect keyed to session identity
   - route callback updates through refs to avoid teardown churn
5. `projectsService.listProjectNotes`: catch parser exceptions and fall back to plain query.
6. `ProfilePanel`: remove external avatar call; render local initials avatar.
7. Validate with focused UI tests for sign-out race, lock persistence, reconnection stability, and note search fallback.

## Phase 7: Calendar NLP correctness hardening

1. Duration pass: include numeric day tokens.
2. Recurrence exception pass:
   - execute only in recurrence context
   - merge/dedupe exceptions across matches
3. Chrono month/day fallback: reject impossible calendar dates.
4. Zoned weekday extraction: use stable English weekday formatter for map lookup.
5. Corpus/test updates:
   - remove machine-specific defaults in `corpus.test.mjs`
   - skip gracefully when no corpus paths are configured
6. Validate with targeted NLP regression tests plus existing corpus snapshots.

## Recommended Execution Order

1. Phase 1 (critical secret containment) immediately.
2. Phase 2 and Phase 3 (portability/hardening) next to stabilize CI/deploy.
3. Phase 4 (invite token model) behind migration + contract checks.
4. Phase 5 and Phase 6 (runtime/UI behavior).
5. Phase 7 (NLP correctness), then full regression sweep.

## Regression Gate (Definition of Done)

- Existing build/lint/typecheck and NLP tests pass.
- New targeted tests pass for each changed risk area.
- No sensitive token/PII artifacts in committed logs/docs.
- Deploy scripts fail fast and non-interactively on SSH/network issues.
- Invite token appears only in one-time creation response; never in list/read paths.
- Collab server remains stable under malformed env values and pre-doc message floods.
