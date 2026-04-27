# Collab Verification

`collab-verify.mjs` is a manual Node.js verification script that authenticates two real users against Keycloak, resolves a live hub doc, opens two authenticated Yjs `WebsocketProvider` connections to the same collab room, writes a unique value from User A, and verifies that User B receives that value over the live collaboration WebSocket. It does not use a browser, Playwright, or any UI code.

## Required environment variables

- `COLLAB_VERIFY_BASE_URL`: Base URL for the hub API, for example `https://api.eshaansood.org`.
- `COLLAB_VERIFY_WS_URL`: Collab WebSocket base URL, for example `wss://collab.eshaansood.org`.
- `COLLAB_VERIFY_KEYCLOAK_URL`: Base URL for Keycloak, for example `https://auth.eshaansood.org`.
- `COLLAB_VERIFY_REALM`: Keycloak realm name used for both users.
- `COLLAB_VERIFY_CLIENT_ID`: Keycloak client ID used for password grant token minting.
- `COLLAB_VERIFY_REDIRECT_URI`: Optional full redirect URI override for the Keycloak flow, for example `https://eshaansood.org` or `http://localhost:3000/callback`. If omitted, the script falls back to its built-in default redirect URI.
- `COLLAB_VERIFY_USER_A_USERNAME`: Username for the first project member.
- `COLLAB_VERIFY_USER_A_PASSWORD`: Password for the first project member.
- `COLLAB_VERIFY_USER_B_USERNAME`: Username for the second project member.
- `COLLAB_VERIFY_USER_B_PASSWORD`: Password for the second project member.
- `COLLAB_VERIFY_PROJECT_ID`: Space ID to inspect for work projects and docs. The environment variable name is retained for script compatibility.
- `COLLAB_VERIFY_DOC_ID`: Optional explicit doc ID. If omitted, the script looks up the first accessible work project and resolves its doc ID before connecting.

## Run

```bash
node e2e/collab-verify/collab-verify.mjs
```

## Expected output

Pass case:

```text
PASS: collab sync verified — User A write visible to User B
```

Fail case when replication does not arrive in time:

```text
FAIL: User B did not receive User A's write within 10 seconds
```

Other failures print a clear error message and exit with code `1`, including missing environment variables, token minting failures, project or doc lookup failures, collab authorization failures, and provider sync timeouts.

## Live environment note

This script talks to the live app. It requires two real users who are valid members of the target space and have working Keycloak credentials.
