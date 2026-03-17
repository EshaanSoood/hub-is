# Eshaan OS Security Hardening Runbook (Phases 1-6)

## Phase 1 - Canonical Owner Invariant (Hub Authority)

1. Set `HUB_OWNER_EMAIL` in `/home/eshaan/deployments/eshaan-os-hub-api/.env`.
2. Set sidecar auth env:
   - `KEYCLOAK_ISSUER=https://auth.eshaansood.org/realms/eshaan-os`
   - `KEYCLOAK_AUDIENCE=account,eshaan-os-hub`
3. Deploy sidecar: `npm run deploy:hub-api`.
4. Verify health flags:
   - `GET https://eshaansood.org/api/hub/health`
   - Expect `ownerInvariant: "email_only"` and `ownerInvariantReady: true`.
5. Run live checks:
   - `HUB_OWNER_ACCESS_TOKEN=... HUB_OWNER_EMAIL_EXPECTED=<owner-email> npm run check:hub-policy-live`
6. Verify hub DB schema migration state:
   - `sqlite3 /data/hub.sqlite "SELECT version, updated_at FROM schema_version WHERE id = 1;"`
   - Expected `version = 3` (see `docs/hub-db-migrations.md`).

## Phase 2 - Keycloak Closed Club

1. Disable public registration:
   - `KEYCLOAK_ADMIN_USERNAME=... KEYCLOAK_ADMIN_PASSWORD=... npm run keycloak:close-club`
2. Verify closure:
   - `KEYCLOAK_ADMIN_USERNAME=... KEYCLOAK_ADMIN_PASSWORD=... npm run keycloak:verify-closed`
3. Optional backstop proof with non-invited token:
   - `HUB_NON_INVITED_ACCESS_TOKEN=... KEYCLOAK_ADMIN_USERNAME=... KEYCLOAK_ADMIN_PASSWORD=... npm run keycloak:verify-closed`

## Phase 3 - Direct-Service Bypass Prevention

1. Ensure sidecar env includes `HUB_EDGE_TOKEN_SECRET` and deploy sidecar.
2. Apply forward-auth middleware labels to Nextcloud/OpenProject router definitions.
3. Redeploy those services in Coolify.
4. Validate:
   - Non-owner direct `https://cloud.eshaansood.org` and `https://projects.eshaansood.org` should return `401/403` without owner edge cookie.
   - Owner opens service via hub owner edge grant flow.

## Phase 4 - Audit + Recovery Controls

1. Configure optional workflow hooks:
   - `HUB_SNAPSHOT_RESTORE_WEBHOOK`
   - `HUB_REVERT_WINDOW_WEBHOOK`
2. Use owner panel in Hub to:
   - Register snapshot references.
   - Trigger snapshot restore.
   - Trigger revert-window job.
3. Verify owner audit trail and recovery job records appear in owner panel.

## Phase 5 - Hub-Native Notes (Lexical Async)

1. Notes are project-scoped and served by Hub API endpoints.
2. Use Project -> Notes tab:
   - Create, save, archive notes.
   - Verify collaborator read-only behavior where applicable.
3. Search/indexing is hub-side (query param `q`) and does not require direct Nextcloud UI.

## Phase 6 - Collaboration Socket (Dedicated WS Service)

1. Deploy dedicated collab service assets from:
   - `/home/eshaan/deployments/eshaan-os-hub-collab`
2. Set collab env in `/home/eshaan/deployments/eshaan-os-hub-collab/.env`:
   - `HUB_COLLAB_TOKEN_SECRET` (must match hub sidecar secret)
   - `HUB_COLLAB_ALLOWED_ORIGINS=https://eshaansood.org`
3. Set sidecar env in `/home/eshaan/deployments/eshaan-os-hub-api/.env`:
   - `HUB_COLLAB_WS_URL=wss://collab.eshaansood.org`
4. Deploy in order:
   - `npm run deploy:collab`
   - `npm run deploy:hub-api`
5. Validate health:
   - `https://collab.eshaansood.org/healthz`
   - `https://collab.eshaansood.org/readyz`
   - `https://eshaansood.org/api/hub/health` should report `collaborationReady: true`
6. Run live behavior checks:
   - `HUB_ACCESS_TOKEN=... HUB_COLLAB_ACCESS_TOKEN=... HUB_BASE_URL=https://eshaansood.org HUB_COLLAB_WS_URL=wss://collab.eshaansood.org npm run check:collab-live`

## If Realtime Doesn't Work

1. Confirm websocket endpoint is reachable:
   - `wss://collab.eshaansood.org`
2. Confirm collab service logs show token verification on connect (`token verified`).
3. Confirm hub sidecar logs show session minting for the expected note (`collab.session.minted` with matching `noteId`).
4. Confirm secret parity:
   - `HUB_COLLAB_TOKEN_SECRET` in sidecar env and collab env must be exactly identical.
5. Run parity + behavior checks and stop at first failure:
   - `npm run check:collab-preflight`
   - `npm run check:collab-live`
