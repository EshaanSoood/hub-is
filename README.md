# Hub OS Hub

## Repository Layout

- `src/`: React app source (UI, features, services, policy, auth)
- `apps/hub-api/`: Hub API sidecar service (`hub-api.mjs`) deploy assets
- `apps/hub-collab/`: Dedicated Yjs/Lexical collaboration WebSocket service
- `scripts/`: validation and compliance checks
- `docs/`: architecture contracts and runbooks
- `working files/`: local-only sensitive context and secrets (git-ignored)

## Styling System

This project uses **Tailwind v4** with the Vite plugin (`@tailwindcss/vite`) and a CSS-first token setup.

- Tailwind is imported in `tokens.css` via `@import "tailwindcss"`.
- Tailwind config is explicitly present in `tailwind.config.js`.
- `tokens.css` is wired to that config via `@config "./tailwind.config.js";`.
- Theme tokens/utilities are defined in `tokens.css` with `@theme` and `@utility`.

## Root Files (intentional)

Core app/config files remain at root:

- `package.json`
- `vite.config.ts`
- `tailwind.config.js`
- `tsconfig*.json`
- `globals.css`, `tokens.css`
- `index.html`

Generated files (`dist`, `node_modules`, `tsconfig.app.tsbuildinfo`) are build/runtime artifacts.

## Authentication (Keycloak)

- The hub uses Keycloak OIDC with PKCE through `keycloak-js`.
- Deployment-specific auth settings are provided through environment variables.
- Use [.env.example](./.env.example) as the source of variable names and placeholder values.
- After login, the UI loads session capabilities from server source-of-truth at `/api/hub/me`.

### Create an account

Access is invite-only at the hub policy layer.

1. A project owner creates an invite for your email.
2. Sign in at the public URL configured for your deployment.
3. Pending invites are consumed by the hub policy service to grant project membership.

### Owner Invariant

- Hub authorization is owner-email anchored through `HUB_OWNER_EMAIL`.
- The owner role is derived from that canonical email, not IdP realm roles.
- If `HUB_OWNER_EMAIL` is missing, authenticated hub policy endpoints fail closed with `503`.

## Security + Governance

- Edge gate grant flow (owner only): `POST /api/hub/edge/grants`
- Notes (project-scoped, async): `GET/POST /api/hub/projects/:projectId/notes`, `PATCH /api/hub/projects/:projectId/notes/:noteId`
- Notes collaboration session mint (project-scoped): `POST /api/hub/projects/:projectId/notes/:noteId/collab/session`
- Governance trail (owner): `GET /api/hub/audit`
- Snapshot registry (owner): `GET/POST /api/hub/snapshots`
- Recovery workflows (owner): `POST /api/hub/recovery/restore-snapshot`, `POST /api/hub/recovery/revert-window`, `GET /api/hub/recovery/jobs`

## Realtime Services

- Collaboration, chat, and live-update endpoints are deployment-configured.
- Keep public hostnames, routing, and operations runbooks outside the public README.
- Use [.env.example](./.env.example) for the relevant variable names.

## Matrix Chat (Tuwunel)

- Matrix integration is optional and configured entirely by environment variables.
- Deployment-specific homeserver URLs and discovery details are intentionally omitted here.

### Contract smoke token workflow

- Create local-only user credential file (gitignored): `.env.contract-smoke.users.local`
- Required keys:
  - `HUB_SMOKE_USER_A_USERNAME`
  - `HUB_SMOKE_USER_A_PASSWORD`
  - `HUB_SMOKE_USER_B_USERNAME`
  - `HUB_SMOKE_USER_B_PASSWORD`
- Optional IdP defaults:
  - `KEYCLOAK_URL`
  - `KEYCLOAK_REALM`
  - `KEYCLOAK_CLIENT_ID`
  - `KEYCLOAK_REDIRECT_URI`
- Ensure users exist (one-time/persistent):
  - Set `KEYCLOAK_ADMIN_USERNAME` + `KEYCLOAK_ADMIN_PASSWORD` (or place in `.env.contract-smoke.admin.local`)
  - Run: `npm run smoke:ensure-users`
- Mint fresh tokens before each smoke run:
  - Run: `npm run smoke:mint-tokens`
  - This writes `.env.contract-smoke.tokens.local` with `TOKEN_A` and `TOKEN_B`.

## Playwright E2E (Opt-in)

- Install once: `npx playwright install`
- Regression suite (explicit opt-in):
  - `PLAYWRIGHT_E2E_ENABLED=true BASE_URL=http://127.0.0.1:5173 npm run test:e2e`
- Workflow suite (extra explicit opt-in because it mints auth tokens):
  - `PLAYWRIGHT_E2E_ENABLED=true PLAYWRIGHT_WORKFLOW_ENABLED=true BASE_URL=http://127.0.0.1:5173 npm run test:e2e:workflow`

## Change Log Policy

- For any task that touches more than one file, add a short summary entry to `working files/change-log.md`.
- Minimum entry fields: UTC timestamp, one-line scope summary, and key files changed.
