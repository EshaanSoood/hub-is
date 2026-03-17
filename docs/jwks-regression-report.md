# JWKS Regression Report

Date: 2026-03-01

## Scope

Regression verification after switching Hub API auth from Keycloak `userinfo` per request to local JWT verification (JWKS) while preserving existing Hub route behavior.

Covered:

- `/api/hub/me`, `/api/hub/projects`
- OpenProject proxy routes under `/api/hub/projects/:projectId/openproject/*`
- Nextcloud proxy routes under `/api/hub/projects/:projectId/nextcloud/*`
- Notes + collab session mint + collab websocket smoke
- AuthZ runtime harness + live checks + cleanup scripts

---

## 1) Deployment Verification (live)

Before running live checks, the server was still on old code (`fetchUserInfoFromToken` / `userinfo` path) in `/home/eshaan/deployments/eshaan-os-hub-api/hub-api.mjs`.

Deployment performed:

```bash
DEPLOY_SSH_KEY=/Users/eshaansood/.ssh/id_ed25519_backend_pilot npm run deploy:hub-api
```

Post-deploy verification:

1. Remote source now contains JWKS verifier symbols (`verifyAccessTokenLocally`, `KEYCLOAK_AUDIENCE`, JWKS cert URL), and no `fetchUserInfoFromToken` path.
2. `GET https://eshaansood.org/api/hub/health` returns:
   - `issuer = https://auth.eshaansood.org/realms/eshaan-os`
   - `audience = ["account", "eshaan-os-hub"]`
   - `jwksUrl = https://auth.eshaansood.org/realms/eshaan-os/protocol/openid-connect/certs`

---

## 2) Token Acceptance Contract (observed live)

Hub expectations (from deployed Hub API code + live behavior):

1. `iss`
   - Token issuer must match `KEYCLOAK_ISSUER` (normalized for trailing slash).
2. `aud`
   - Hub validates token `aud` against configured `KEYCLOAK_AUDIENCE` list.
   - Live config/health reports expected audience list: `["account","eshaan-os-hub"]`.
3. Time
   - `exp` required and validated.
   - `nbf` validated when present.
4. Signature
   - Verified locally against Keycloak JWKS (`/protocol/openid-connect/certs`) with in-memory cache.

Observed real access token (minted through real Keycloak browser-style auth-code flow via impersonation cookie session):

- `iss`: `https://auth.eshaansood.org/realms/eshaan-os`
- `aud`: `"account"` (string)
- identity claims present: `sub`, `email`, `given_name`, `family_name`

Identity extraction used by Hub (verified via `/api/hub/me`):

- `sub`, `email`, `name`, `given_name`, `family_name`
- `/api/hub/me` includes `firstName` and `lastName`

---

## 3) Test Setup

Live target:

- `HUB_BASE_URL=https://eshaansood.org`
- `HUB_COLLAB_WS_URL=wss://collab.eshaansood.org`
- Project under test: `backend-pilot` (has both OpenProject + Nextcloud mappings)

Tokens:

- Owner token, member token, non-member token minted from Keycloak live realm.
- Member user invited to `backend-pilot`; non-member intentionally not invited.
- Expired collab token generated from a valid collab token using live `HUB_COLLAB_TOKEN_SECRET` for expired-token denial checks.

---

## 4) Command List

```bash
# Deploy new Hub API
DEPLOY_SSH_KEY=/Users/eshaansood/.ssh/id_ed25519_backend_pilot npm run deploy:hub-api

# Baseline + contract probes
curl -sS https://eshaansood.org/api/hub/health | jq '.ok, .issuer, .audience, .jwksUrl'
curl -sS https://eshaansood.org/api/hub/me -H "Authorization: Bearer $HUB_ACCESS_TOKEN"
curl -sS https://eshaansood.org/api/hub/projects -H "Authorization: Bearer $HUB_ACCESS_TOKEN"

# Required runtime harness + live checks
HUB_PROJECT_ID=backend-pilot npm run check:authz-runtime
HUB_OPENPROJECT_PROJECT_ID=backend-pilot HUB_OPENPROJECT_CLEANUP=1 npm run check:openproject-live
HUB_NEXTCLOUD_PROJECT_ID=backend-pilot HUB_NEXTCLOUD_CLEANUP=1 npm run check:nextcloud-live
npm run check:collab-live
npm run cleanup:openproject-tests
npm run cleanup:nextcloud-tests
npm run check:cleanup-live

# Manual notes route checks
GET    /api/hub/projects/backend-pilot/notes
POST   /api/hub/projects/backend-pilot/notes
PATCH  /api/hub/projects/backend-pilot/notes/:noteId
POST   /api/hub/projects/backend-pilot/notes/:noteId/collab/session
```

---

## 5) Expected vs Actual

### A) Baseline auth endpoints

| Check | Expected | Actual | Result |
|---|---|---|---|
| `GET /api/hub/me` (member) | 200 + identity fields | 200 with `userId,email,name,firstName,lastName` | pass |
| `GET /api/hub/projects` (member) | 200 | 200 (`backend-pilot` returned) | pass |

### B) OpenProject routes

| Check | Expected | Actual | Result |
|---|---|---|---|
| list work packages | 200 | pass via `check-openproject-live` | pass |
| create work package | create succeeds | created (`id=41`) | pass |
| delete work package | delete succeeds | created test item cleaned up | pass |
| non-member gating | denied | 403 in runtime harness | pass |

### C) Nextcloud routes

| Check | Expected | Actual | Result |
|---|---|---|---|
| health/list/upload/download/delete | all succeed | pass via `check-nextcloud-live` | pass |
| non-member gating | denied | 403 in runtime harness | pass |

### D) Notes + collab routes

| Check | Expected | Actual | Result |
|---|---|---|---|
| `GET /notes` | 200 | 200 | pass |
| `POST /notes` | 200 + note id | 200 (`note_cf6b66df-d7e3-4a34-bba3-39406123ffa0`) | pass |
| `PATCH /notes/:noteId` | 200 update | 200 title updated | pass |
| `POST /notes/:noteId/collab/session` | 200 + collab token | 200 token issued | pass |
| collab websocket smoke | connects + sync works | `Collab websocket live checks passed.` | pass |

### E) Existing validation scripts

| Script | Expected | Actual | Result |
|---|---|---|---|
| `npm run check:authz-runtime` | pass | `Summary: pass=14 fail=0 skipped=0` | pass |
| `npm run check:openproject-live` | pass | passed + cleanup | pass |
| `npm run check:nextcloud-live` | pass | passed + cleanup | pass |
| `npm run check:collab-live` | pass | passed (collaborator-member subcheck skipped without optional token) | pass |
| `npm run cleanup:openproject-tests` | pass | `deleted=0 skipped=0 failed=0` | pass |
| `npm run cleanup:nextcloud-tests` | pass | `deleted=0 skipped=0 failed=0` | pass |
| `npm run check:cleanup-live` | pass | cleanup completed; Keycloak user cleanup skipped (admin vars not set in local shell) | pass |

---

## 6) No `userinfo` Per-Request Evidence

Evidence captured:

1. Deployed `hub-api.mjs` no longer contains the old runtime `fetchUserInfoFromToken` path.
2. Deployed auth path uses `verifyAccessTokenLocally` + JWKS certs endpoint.
3. Live runtime checks above passed end-to-end with JWT-bearing requests, with no dependency on Keycloak `userinfo` in request path.

---

## 7) Fixes Applied During Regression

1. **Operational fix applied**: deployed updated Hub API code to live (`npm run deploy:hub-api`) because live host was still running the old `userinfo` version before tests.
2. No additional code change was required to restore route compatibility after deployment.

---

## Conclusion

After deploying the JWKS-based Hub API build, all required regression checks passed for OpenProject, Nextcloud, notes/collab, and authz runtime harness. Existing membership/owner gating behavior remains intact, and no per-request Keycloak `userinfo` call is required in the deployed request-auth path.
