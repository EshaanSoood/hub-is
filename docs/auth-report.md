# Auth & Token Sharing Status Report (Current State, Repo-Based)

Generated from repository code/config plus live Keycloak admin captures saved in this repo:
- `docs/keycloak-live-capture-2026-03-01.json`
- `docs/keycloak-live-scope-mappers-2026-03-01.json`

Any statement not provable from these artifacts is marked **UNKNOWN**.

## Section A — Systems & Entry Points

| System / Entry point | Role in auth | How requests authenticate | Evidence |
|---|---|---|---|
| Keycloak (`auth.eshaansood.org`) | Identity provider for sign-in and token issuance | OIDC via `keycloak-js` (PKCE), plus admin API for realm/client/profile settings | `src/lib/keycloak.ts:15-19`, `src/context/AuthzContext.tsx:76-82`, `docs/keycloak-live-capture-2026-03-01.json:2-56` |
| Hub API (`/api/hub/*`) | Primary API auth + authz authority | `Authorization: Bearer <token>`; token checked by Keycloak `userinfo` call | `apps/hub-api/hub-api.mjs:237-248`, `apps/hub-api/hub-api.mjs:1477-1490`, `apps/hub-api/hub-api.mjs:1500-1512` |
| React UI calling Hub API | Client that forwards user token to Hub API | Sends `Authorization: Bearer <accessToken>` on Hub API requests | `src/services/sessionService.ts:8-14`, `src/services/projectsService.ts:37-40` |
| Hub collab WebSocket (`wss://collab.eshaansood.org`) | Realtime note auth boundary | Query param token `access_token=<hub-minted token>` with HMAC validation + claim checks | `src/features/notes/CollaborativeLexicalEditor.tsx:119-126`, `apps/hub-collab/collab-server.mjs:99-163`, `apps/hub-collab/collab-server.mjs:803-818` |
| OpenProject integration via Hub (`/api/hub/projects/:id/openproject/*`) | Hub-mediated OpenProject operations | User authenticates to Hub with Bearer token; Hub authenticates to OpenProject with global bearer token | `apps/hub-api/hub-api.mjs:3789-3836`, `apps/hub-api/hub-api.mjs:1917-1920` |
| Nextcloud integration via Hub (`/api/hub/projects/:id/nextcloud/*`) | Hub-mediated Nextcloud file operations | User authenticates to Hub with Bearer token; Hub authenticates to Nextcloud using Basic auth | `apps/hub-api/hub-api.mjs:3840-3900`, `apps/hub-api/hub-api.mjs:1593-1596`, `apps/hub-api/hub-api.mjs:1782-1799` |
| Owner edge path (`/api/hub/edge/*`) | Owner-only direct UI access handoff to OpenProject/Nextcloud | Hub-minted HMAC grant token + HttpOnly edge cookie | `apps/hub-api/hub-api.mjs:1271-1285`, `apps/hub-api/hub-api.mjs:1360-1401`, `apps/hub-api/hub-api.mjs:3500-3586` |

## Section B — Hub API Authentication Verification (What is enforced)

### Auth middleware equivalent and enforcement path

- Hub auth entry point is `getOrCreateUser(request)`, invoked in protected route handlers.
- Steps:
- Parse bearer token from `Authorization`.
- Call Keycloak `GET {KEYCLOAK_ISSUER}/protocol/openid-connect/userinfo`.
- Enforce email presence, invite-only access, owner-email invariant, then build session summary.
- Evidence: `apps/hub-api/hub-api.mjs:1492-1581`, route invocations at `apps/hub-api/hub-api.mjs:3543-3546`, `3623-3626`, `3647-3650`, `3658-3661`.

### Issuer/audience/signature/JWKS checks

- `KEYCLOAK_ISSUER` is configured and used for `userinfo` endpoint URL.
- Hub does not implement local JWT validation (no local JWT decode, no JWKS lookup, no explicit `iss`/`aud` checks in code).
- Token validity is delegated to Keycloak `userinfo` response status.
- Evidence: `apps/hub-api/hub-api.mjs:10`, `apps/hub-api/hub-api.mjs:1477-1490`, `apps/hub-api/hub-api.mjs:1507-1512`.

### Claims read and missing-claim behavior

| Claim / field | Read by Hub? | Behavior |
|---|---|---|
| `email` | Yes | Required; missing/empty -> `403 Invite-only policy requires an email-bearing identity.` |
| `name` | Yes | Preferred display name |
| `preferred_username` | Yes | Fallback if `name` missing |
| `sub` | Yes | Stored as `keycloak_sub`; session `userId` uses `keycloak_sub || user.id` |
| `given_name` | No | Ignored by Hub auth logic |
| `family_name` | No | Ignored by Hub auth logic |

Evidence: `apps/hub-api/hub-api.mjs:1515-1526`, `apps/hub-api/hub-api.mjs:1540`, `apps/hub-api/hub-api.mjs:1555`, `apps/hub-api/hub-api.mjs:1444`.

### Invite-only enforcement location

- Invite-only is enforced during authentication/identity resolution, not only route-level authz.
- New non-owner users without active invite are denied.
- Existing non-owner users with zero memberships after invite application are denied.
- Evidence: `apps/hub-api/hub-api.mjs:1528-1533`, `apps/hub-api/hub-api.mjs:1567-1571`.

## Section C — Authorization Model (Runtime Truth)

### Implementation

- Global role source: `hub_role` (`owner`/`collaborator`), owner resolved by `email === HUB_OWNER_EMAIL`.
- Project membership roles: `owner` / `editor` / `viewer`.
- Capability maps:
- Global: `globalCapabilitiesByHubRole`.
- Project: `projectCapabilitiesByMembershipRole`.
- Checks:
- `requireCapability` (global/project capability presence).
- `requireProjectCapability` (project-scoped capability).
- `requireOwner` (owner-only).
- `requireNotesWriteAccess` (owner or non-viewer membership).
- Evidence: `apps/hub-api/hub-api.mjs:580-603`, `apps/hub-api/hub-api.mjs:1127-1144`, `apps/hub-api/hub-api.mjs:1457-1474`.

### Concrete route examples

1. `GET /api/hub/projects`: `requireCapability(..., 'projects.view')` (`apps/hub-api/hub-api.mjs:3657-3666`).
2. `POST /api/hub/projects`: owner-only (`apps/hub-api/hub-api.mjs:3680-3689`).
3. `GET /api/hub/projects/:projectId/notes`: `project.notes.view` required (`apps/hub-api/hub-api.mjs:3928-3938`).
4. `POST /api/hub/projects/:projectId/notes`: `project.notes.view` + notes write access (`apps/hub-api/hub-api.mjs:3948-3959`).
5. `PATCH /api/hub/projects/:projectId/notes/:noteId`: same write checks (`apps/hub-api/hub-api.mjs:4087-4099`).
6. `POST /api/hub/projects/:projectId/notes/:noteId/collab/session`: `project.notes.view` required (`apps/hub-api/hub-api.mjs:3977-3988`).
7. `GET /api/hub/invites`: owner-only (`apps/hub-api/hub-api.mjs:4283-4292`).
8. `POST /api/hub/edge/grants`: owner-only (`apps/hub-api/hub-api.mjs:3542-3551`).
9. `GET /api/hub/projects/:projectId/openproject/work-packages`: owner/member check via project resolver (`apps/hub-api/hub-api.mjs:1749-1757`, `apps/hub-api/hub-api.mjs:2100-2104`, `apps/hub-api/hub-api.mjs:3789-3798`).
10. `GET /api/hub/projects/:projectId/nextcloud/files`: owner/member check via project resolver (`apps/hub-api/hub-api.mjs:1749-1757`, `apps/hub-api/hub-api.mjs:2316-2319`, `apps/hub-api/hub-api.mjs:3840-3849`).

## Section D — Token Types & Persistence

### Keycloak token/TTL settings (live admin capture)

- Realm token/session settings captured live:
- `accessTokenLifespan`: `300` seconds.
- `accessTokenLifespanForImplicitFlow`: `900` seconds.
- `ssoSessionIdleTimeout`: `1800` seconds.
- `ssoSessionMaxLifespan`: `36000` seconds.
- `offlineSessionIdleTimeout`: `2592000` seconds.
- `offlineSessionMaxLifespan`: `5184000` seconds.
- `revokeRefreshToken`: `false`, `refreshTokenMaxReuse`: `0`.
- Evidence: `docs/keycloak-live-capture-2026-03-01.json:4-20`.

### Keycloak client posture for Hub (`eshaan-os-hub`)

- `publicClient: true`
- `standardFlowEnabled: true`
- `directAccessGrantsEnabled: false`
- `serviceAccountsEnabled: false`
- Default scopes include `profile`, `basic`, `email`.
- Evidence: `docs/keycloak-live-capture-2026-03-01.json:21-54`.

### Real `userinfo` run (live)

- Ran one live `userinfo` request in realm `eshaan-os` using a real access token minted via `password` grant on `admin-cli` (because `eshaan-os-hub` disallows direct grants).
- Observed fields present: `sub`, `email`, `name`, `given_name`, `family_name` (and `preferred_username`).
- Evidence: `docs/keycloak-live-capture-2026-03-01.json:213-226`.

### Other token/credential types in this repo

| Type | Issuer | Used by | Lifetime/TTL | Storage |
|---|---|---|---|---|
| Hub edge grant token (HMAC) | Hub API | Owner edge-open flow | `HUB_EDGE_TOKEN_TTL_SECONDS` (default 180s) | URL query -> edge cookie (`apps/hub-api/hub-api.mjs:1271-1285`, `3500-3535`) |
| Hub edge cookie | Hub API | Edge authorize checks | `HUB_EDGE_COOKIE_TTL_SECONDS` (default 1800s) | HttpOnly/Secure cookie (`apps/hub-api/hub-api.mjs:74-86`, `3532-3535`) |
| Hub collab token (HMAC) | Hub API | WS `access_token` for collab | `HUB_COLLAB_TOKEN_TTL_SECONDS` (default 300s) | Session response + query param (`apps/hub-api/hub-api.mjs:1289-1309`, `3249-3286`, `src/features/notes/CollaborativeLexicalEditor.tsx:119-126`) |
| OpenProject API token | **UNKNOWN** external issuer | Hub -> OpenProject | **UNKNOWN** | Hub env `OPENPROJECT_TOKEN` (`apps/hub-api/hub-api.mjs:26-27`) |
| Nextcloud app password | Nextcloud account credential | Hub -> Nextcloud DAV | **UNKNOWN** | Hub env `NEXTCLOUD_APP_PASSWORD` + `NEXTCLOUD_USER` (`apps/hub-api/hub-api.mjs:31-33`, `1593-1596`) |

### Durable token conclusion

- No Hub-issued long-lived bearer token mechanism exists for normal Hub API user auth.
- Hub API user auth accepts Keycloak bearer tokens only.
- Client-side continuity uses `keycloak.updateToken(60)` refresh logic.
- Evidence: `apps/hub-api/hub-api.mjs:1500-1512`, `src/context/AuthzContext.tsx:149-169`.

## Section E — Claims Reality Check (Important)

| Field | Guaranteed today? | Enforcement source | Runtime behavior |
|---|---|---|---|
| `email` | **GUARANTEED** for realm user profiles in Keycloak + required by Hub access logic | Keycloak user profile requires `email`; email scope mapper emits `email`; Hub also hard-requires email | Missing email in Hub path -> `403` (`apps/hub-api/hub-api.mjs:1515-1518`) |
| `first_name` (`given_name`) | **GUARANTEED** for realm user profiles in Keycloak | Keycloak user profile requires `firstName`; profile mapper maps `firstName -> given_name` | Hub ignores this field, but it is present in live `userinfo` capture |
| `last_name` (`family_name`) | **GUARANTEED** for realm user profiles in Keycloak | Keycloak user profile requires `lastName`; profile mapper maps `lastName -> family_name` | Hub ignores this field, but it is present in live `userinfo` capture |

Keycloak evidence:

- Required user profile attributes: `email`, `firstName`, `lastName`.
- `eshaan-os-hub` default scopes include `profile` and `email`.
- Mappers include `given_name` and `family_name` under `profile`, and `email` under `email` scope.
- Live `userinfo` response contains all target fields.
- Evidence: `docs/keycloak-live-capture-2026-03-01.json:169-197`, `docs/keycloak-live-capture-2026-03-01.json:34-41`, `docs/keycloak-live-scope-mappers-2026-03-01.json:345-358`, `docs/keycloak-live-scope-mappers-2026-03-01.json:220-233`, `docs/keycloak-live-scope-mappers-2026-03-01.json:399-413`, `docs/keycloak-live-capture-2026-03-01.json:218-225`.

Hub data model reality:

- Hub stores `email` and `name` only; no first/last columns in users table.
- Hub does not validate `given_name`/`family_name`.
- Evidence: `apps/hub-api/hub-api.mjs:324-332`, `apps/hub-api/hub-api.mjs:1515-1526`.

## Section F — Cross-Service Integration Auth

### OpenProject

- Inbound to Hub: user bearer token -> Hub auth check.
- Hub to OpenProject: `Authorization: Bearer ${OPENPROJECT_TOKEN}`.
- Credential location: Hub env (`OPENPROJECT_BASE_URL`, `OPENPROJECT_TOKEN`) in deployed env file.
- Scope model: per-project mapping (`projects.openproject_project_id`), but global OpenProject service credential.
- Preserved user identity at OpenProject boundary: none (no per-user token forwarding/impersonation in this code).
- Evidence: `apps/hub-api/hub-api.mjs:26-27`, `apps/hub-api/hub-api.mjs:1917-1920`, `apps/hub-api/hub-api.mjs:2082-2097`, `apps/hub-api/docker-compose.yml:8-9`.

### Nextcloud

- Inbound to Hub: user bearer token -> Hub auth check.
- Hub to Nextcloud: Basic auth header from `NEXTCLOUD_USER:NEXTCLOUD_APP_PASSWORD`.
- Credential location: Hub env (`NEXTCLOUD_BASE_URL`, `NEXTCLOUD_USER`, `NEXTCLOUD_APP_PASSWORD`) in deployed env file.
- Scope model: per-project folder mapping (`projects.nextcloud_folder`) with global Nextcloud account credential.
- Preserved user identity at Nextcloud boundary: none (requests execute as configured Nextcloud account).
- Evidence: `apps/hub-api/hub-api.mjs:31-33`, `apps/hub-api/hub-api.mjs:1593-1596`, `apps/hub-api/hub-api.mjs:2269-2285`, `apps/hub-api/docker-compose.yml:8-9`.

### OpenProject/Nextcloud UI links

- Owner edge-gated flow is implemented in Hub API and used by `ProjectCorePanel` owner actions.
- Direct UI links also exist in frontend.
- Whether external forward-auth middleware is currently enforced remains **UNKNOWN** from this repo.
- Evidence: `apps/hub-api/hub-api.mjs:3500-3586`, `src/features/ProjectCorePanel.tsx:161-175`, `src/features/TasksPanel.tsx:162-176`, `src/pages/ProjectPage.tsx:737-745`.

## Section G — Known Gaps / Risks (Facts Only, No Fixes)

- Hub API does not perform local JWT signature/JWKS/`iss`/`aud` validation; it depends on Keycloak `userinfo` as remote validation.
- `eshaan-os-hub` client has `directAccessGrantsEnabled=false`, so password-grant token tests cannot be performed with that client.
- Hub user model does not store first/last names separately; only `name` and `email` are persisted.
- Keycloak token persistence location inside `keycloak-js` runtime remains **UNKNOWN** from repo code (no explicit app storage code).
- OpenProject/Nextcloud actions run with global service credentials, not per-user credentials.
- External forward-auth enforcement status for direct service UIs is **UNKNOWN** in this repo.
- Live Keycloak realm export shows `registrationAllowed=true` at capture time.
- Edge and collab tokens are stateless HMAC tokens with expiry and no per-token revocation list in Hub code.
