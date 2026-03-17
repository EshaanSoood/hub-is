# Keycloak Auth Contract for Hub API

Last updated: 2026-03-01 UTC

## Scope

This runbook documents the Keycloak contract required by Hub API local JWT verification and profile enforcement.

- Realm: `eshaan-os`
- Issuer: `https://auth.eshaansood.org/realms/eshaan-os`
- Hub client: `eshaan-os-hub`

## Required Contract

1. User profile requires `firstName` and `lastName` for `user` role.
2. Access token contains:
   - `sub`
   - `email`
   - `name`
   - `preferred_username`
   - `given_name`
   - `family_name`
3. Hub client includes `profile` and `email` in default client scopes.

Reference captures (2026-03-01):

- `/Users/eshaansood/eshaan-os/docs/keycloak-live-capture-2026-03-01.json`
- `/Users/eshaansood/eshaan-os/docs/keycloak-live-scope-mappers-2026-03-01.json`

## Admin Console Steps (Reproducible)

1. Require first/last name in realm user profile:
   - Go to `Realm settings` -> `User profile`.
   - Open attribute `firstName`:
     - Set `Required` for role `user`.
     - Ensure user can view/edit.
   - Open attribute `lastName`:
     - Set `Required` for role `user`.
     - Ensure user can view/edit.
2. Ensure profile scope emits `given_name` and `family_name` in access tokens:
   - Go to `Client scopes` -> `profile` -> `Mappers`.
   - Verify mapper `given name`:
     - Mapper type: `User Attribute`
     - User attribute: `firstName`
     - Token claim name: `given_name`
     - `Add to access token`: ON
   - Verify mapper `family name`:
     - Mapper type: `User Attribute`
     - User attribute: `lastName`
     - Token claim name: `family_name`
     - `Add to access token`: ON
3. Ensure Hub client gets profile/email scopes:
   - Go to `Clients` -> `eshaan-os-hub` -> `Client scopes`.
   - Ensure `profile` and `email` are default scopes.
4. Audience check alignment:
   - Hub validates `aud` against `KEYCLOAK_AUDIENCE`.
   - Current recommended sidecar setting: `KEYCLOAK_AUDIENCE=account,eshaan-os-hub`.

## Verification

1. Mint a token through normal UI login flow:
   - Sign in at `https://eshaansood.org` (Keycloak standard browser flow).
   - Capture the access token from browser devtools/network.
2. Decode JWT claims locally:

```bash
TOKEN='eyJ...'
TOKEN="$TOKEN" node -e "const p=process.env.TOKEN.split('.')[1];const s=Buffer.from(p.replace(/-/g,'+').replace(/_/g,'/').padEnd(Math.ceil(p.length/4)*4,'='),'base64').toString('utf8');console.log(JSON.stringify(JSON.parse(s),null,2));"
```

3. Confirm decoded token includes:
   - `sub`
   - `email`
   - `given_name`
   - `family_name`
4. Confirm Hub session response includes first/last name:

```bash
curl -sS https://eshaansood.org/api/hub/me \
  -H "Authorization: Bearer $TOKEN" | jq '.sessionSummary | { userId, email, name, firstName, lastName }'
```

Expected: non-empty `firstName` and `lastName`.
