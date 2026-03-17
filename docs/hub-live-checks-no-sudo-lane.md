# One-Command Live Checks + No-Sudo Codex Lane

## Local env file (never committed)

Use `/.env.hub.live.local` for developer-local live check inputs.

Required keys:
- `HUB_BASE_URL`
- `HUB_PROJECT_ID`
- `HUB_OWNER_ACCESS_TOKEN`
- `HUB_ACCESS_TOKEN`
- `HUB_NON_MEMBER_ACCESS_TOKEN`

Recommended keys:
- `HUB_INCLUDE_COLLAB_SMOKE=true`
- `HUB_REQUEST_TIMEOUT_MS=15000`

A starter template is provided in [`docs/hub-live-env.example`](/Users/eshaansood/eshaan-os/docs/hub-live-env.example).

## One-command workflow

Run:

```bash
npm run check:hub-live
```

This command:
1. Loads `/.env.hub.live.local`.
2. Verifies required live env vars are present.
3. Runs `scripts/check-hub-core-gate.mjs` (local harness + live authz checks + optional collab preflight smoke).

## Codex lane (no sudo)

Codex-safe commands:
- `npm run typecheck`
- `npm run lint`
- `npm run build`
- `npm run test:nlp`
- `npm run check:hub-live`

Codex should not perform remote deploy operations or sudo-required steps.

## Human ops lane

After checks pass, deploy remains a manual human step using existing deploy scripts.
