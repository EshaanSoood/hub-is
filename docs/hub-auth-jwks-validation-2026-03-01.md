# Hub JWT/JWKS Validation Notes

Date: 2026-03-01

## 1) No per-request `userinfo` calls remain

Command:

```bash
rg -n "fetchUserInfoFromToken|userinfo|protocol/openid-connect/userinfo" apps/hub-api/hub-api.mjs -S
```

Result: no matches.

## 2) Token verification checks (local integration harness)

Executed against a local JWKS server + local Hub API instance with signed RS256 test tokens.

- valid token: `200`
- expired token: `401`
- wrong issuer: `401`
- wrong audience: `401`
- tampered token: `401`
- missing names (`given_name`/`family_name`): `403` with `Profile incomplete: first and last name required.`

Observed JWKS/userinfo network behavior during this run:

- `certs` endpoint hits: `1`
- `userinfo` endpoint hits: `0`

## 3) Authz regression checks (local integration harness)

- owner `/api/hub/projects`: `200`
- collaborator without invite `/api/hub/projects`: `403` (`Access denied: invite required.`)
- owner invite creation `/api/hub/invites`: `200`
- collaborator after invite `/api/hub/me`: `200`
- collaborator after invite `/api/hub/projects`: `200`
- owner `/api/hub/invites`: `200`
- collaborator `/api/hub/invites`: `403`
- `/api/hub/integrations/openproject/health` with valid owner token: authenticated (returned `503` because integration env unset, not `401`)
- `/api/hub/integrations/nextcloud/health` with valid owner token: authenticated (returned `503` because integration env unset, not `401`)

## 4) Migration/backfill verification

Simulated a legacy `schema_version=2` DB (without `users.first_name`/`users.last_name`) and started Hub API.

Observed after startup:

- schema migrated to `version=3`
- `"Jane Doe"` -> `first_name="Jane"`, `last_name="Doe"`
- `"Mononym"` -> `first_name="Mononym"`, `last_name="(unknown)"`
