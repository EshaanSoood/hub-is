/// <reference types="node" />

import { strict as assert } from 'node:assert';
import { describe, test } from 'node:test';
import { buildCurrentAuthRedirectUri, replaceAuthCallbackUrlIfNeeded } from '../authRedirect.ts';

describe('buildCurrentAuthRedirectUri', () => {
  test('preserves the active route for deep links', () => {
    const redirectUri = buildCurrentAuthRedirectUri({
      origin: 'https://hub.example.com',
      pathname: '/projects/project-1/work/project-3',
      search: '?view=calendar&record_id=task-9',
      hash: '#details',
    });

    assert.equal(
      redirectUri,
      'https://hub.example.com/projects/project-1/work/project-3?view=calendar&record_id=task-9#details',
    );
  });

  test('removes keycloak callback params while keeping app query params', () => {
    const redirectUri = buildCurrentAuthRedirectUri({
      origin: 'https://hub.example.com',
      pathname: '/projects/project-1/overview',
      search: '?code=abc123&state=oidc-state&session_state=session-1&iss=https%3A%2F%2Fauth.example.com&view=kanban',
      hash: '',
    });

    assert.equal(
      redirectUri,
      'https://hub.example.com/projects/project-1/overview?view=kanban',
    );
  });

  test('keeps a normal app state query param when there is no auth callback sentinel', () => {
    const redirectUri = buildCurrentAuthRedirectUri({
      origin: 'https://hub.example.com',
      pathname: '/projects/project-1/overview',
      search: '?state=kanban&view=timeline',
      hash: '',
    });

    assert.equal(
      redirectUri,
      'https://hub.example.com/projects/project-1/overview?state=kanban&view=timeline',
    );
  });

  test('removes oauth error callback params including error_uri and state', () => {
    const redirectUri = buildCurrentAuthRedirectUri({
      origin: 'https://hub.example.com',
      pathname: '/projects/project-1/overview',
      search: '?error=access_denied&error_description=Denied&error_uri=https%3A%2F%2Fauth.example.com%2Ferrors%2Fdenied&state=oidc-state&view=timeline',
      hash: '',
    });

    assert.equal(
      redirectUri,
      'https://hub.example.com/projects/project-1/overview?view=timeline',
    );
  });

  test('replaces the current url when keycloak callback params are present', () => {
    let replacedUrl = '';
    const changed = replaceAuthCallbackUrlIfNeeded(
      {
        state: { idx: 1 },
        replaceState: (_state, _title, url) => {
          replacedUrl = String(url || '');
        },
      },
      {
        origin: 'https://hub.example.com',
        pathname: '/projects/project-1/overview',
        search: '?code=abc123&state=oidc-state&view=timeline',
        hash: '',
      },
    );

    assert.equal(changed, true);
    assert.equal(replacedUrl, 'https://hub.example.com/projects/project-1/overview?view=timeline');
  });

  test('does not replace history when the url is already clean', () => {
    let replaceCalls = 0;
    const changed = replaceAuthCallbackUrlIfNeeded(
      {
        state: null,
        replaceState: () => {
          replaceCalls += 1;
        },
      },
      {
        origin: 'https://hub.example.com',
        pathname: '/projects/project-1/work/project-1',
        search: '?view=calendar',
        hash: '',
      },
    );

    assert.equal(changed, false);
    assert.equal(replaceCalls, 0);
  });
});
