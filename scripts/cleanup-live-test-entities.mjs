/* global fetch, URLSearchParams */

const hubBaseUrl = (process.env.HUB_BASE_URL || 'https://eshaansood.org').replace(/\/$/, '');
const ownerToken = process.env.HUB_OWNER_ACCESS_TOKEN || '';
const keycloakUrl = (process.env.KEYCLOAK_URL || 'https://auth.eshaansood.org').replace(/\/$/, '');
const keycloakRealm = (process.env.KEYCLOAK_REALM || 'eshaan-os').trim();
const keycloakAdminUsername = (process.env.KEYCLOAK_ADMIN_USERNAME || '').trim();
const keycloakAdminPassword = (process.env.KEYCLOAK_ADMIN_PASSWORD || '').trim();

const projectPrefixes = ['collab-live-'];
const titlePrefixes = ['collab.test.', 'collab-live-'];
const emailPrefixes = ['collab.test.', 'collab-live-'];
const usernamePrefixes = ['collab.test.', 'collab-live-'];

const fail = (message) => {
  console.error(message);
  process.exit(1);
};

const startsWithAny = (value, prefixes) =>
  typeof value === 'string' && prefixes.some((prefix) => value.toLowerCase().startsWith(prefix));

const requestHub = async (path, { method = 'GET', body } = {}) => {
  const response = await fetch(`${hubBaseUrl}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${ownerToken}`,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const payload = await response.json().catch(() => ({}));
  return { status: response.status, payload };
};

if (!ownerToken) {
  fail('BLOCKING INPUTS REQUIRED: set HUB_OWNER_ACCESS_TOKEN to clean live test entities.');
}

const summary = {
  deletedProjects: 0,
  alreadyDeletedProjects: 0,
  archivedNotes: 0,
  alreadyArchivedNotes: 0,
  deletedInvites: 0,
  alreadyDeletedInvites: 0,
  deletedKeycloakUsers: 0,
  alreadyDeletedKeycloakUsers: 0,
};

const projectsResponse = await requestHub('/api/hub/spaces');
if (projectsResponse.status !== 200 || !Array.isArray(projectsResponse.payload?.projects)) {
  fail(`Unable to list projects for cleanup (${projectsResponse.status}).`);
}

const projects = projectsResponse.payload.projects;
for (const project of projects) {
  if (!startsWithAny(project?.id || '', projectPrefixes)) {
    continue;
  }

  const deleted = await requestHub(`/api/hub/spaces/${encodeURIComponent(project.id)}`, {
    method: 'DELETE',
  });
  if (deleted.status === 404) {
    summary.alreadyDeletedProjects += 1;
    continue;
  }
  if (deleted.status >= 400) {
    fail(`Failed to delete test project ${project.id} (${deleted.status}).`);
  }
  summary.deletedProjects += 1;
}

const projectsAfterDeleteResponse = await requestHub('/api/hub/spaces');
if (projectsAfterDeleteResponse.status !== 200 || !Array.isArray(projectsAfterDeleteResponse.payload?.projects)) {
  fail(`Unable to list projects after cleanup deletions (${projectsAfterDeleteResponse.status}).`);
}

for (const project of projectsAfterDeleteResponse.payload.projects) {
  const notesResponse = await requestHub(`/api/hub/spaces/${encodeURIComponent(project.id)}/notes`);
  if (notesResponse.status !== 200 || !Array.isArray(notesResponse.payload?.notes)) {
    fail(`Unable to list notes for project ${project.id} (${notesResponse.status}).`);
  }

  for (const note of notesResponse.payload.notes) {
    if (!startsWithAny(note?.title || '', titlePrefixes)) {
      continue;
    }

    const archived = await requestHub(
      `/api/hub/spaces/${encodeURIComponent(project.id)}/notes/${encodeURIComponent(note.id)}`,
      {
        method: 'PATCH',
        body: { archived: true },
      },
    );
    if (archived.status === 404) {
      summary.alreadyArchivedNotes += 1;
      continue;
    }
    if (archived.status >= 400) {
      fail(`Failed to archive test note ${note.id} in ${project.id} (${archived.status}).`);
    }
    summary.archivedNotes += 1;
  }
}

const invitesResponse = await requestHub('/api/hub/invites');
if (invitesResponse.status !== 200 || !Array.isArray(invitesResponse.payload?.invites)) {
  fail(`Unable to list invites for cleanup (${invitesResponse.status}).`);
}

for (const invite of invitesResponse.payload.invites) {
  if (!startsWithAny(invite?.email || '', emailPrefixes)) {
    continue;
  }

  const deleted = await requestHub(`/api/hub/invites/${encodeURIComponent(invite.id)}`, {
    method: 'DELETE',
  });
  if (deleted.status === 404) {
    summary.alreadyDeletedInvites += 1;
    continue;
  }
  if (deleted.status >= 400) {
    fail(`Failed to delete test invite ${invite.id} (${deleted.status}).`);
  }
  summary.deletedInvites += 1;
}

if (keycloakAdminUsername && keycloakAdminPassword) {
  const tokenBody = new URLSearchParams({
    grant_type: 'password',
    client_id: 'admin-cli',
    username: keycloakAdminUsername,
    password: keycloakAdminPassword,
  });

  const tokenResponse = await fetch(`${keycloakUrl}/realms/master/protocol/openid-connect/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: tokenBody,
  });

  if (!tokenResponse.ok) {
    fail(`Failed to obtain Keycloak admin token for cleanup (${tokenResponse.status}).`);
  }

  const tokenPayload = await tokenResponse.json().catch(() => ({}));
  const adminAccessToken = tokenPayload?.access_token;
  if (!adminAccessToken) {
    fail('Failed to parse Keycloak admin access token for cleanup.');
  }

  const usersResponse = await fetch(
    `${keycloakUrl}/admin/realms/${encodeURIComponent(keycloakRealm)}/users?max=500`,
    {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${adminAccessToken}`,
      },
    },
  );

  if (!usersResponse.ok) {
    fail(`Failed to list Keycloak users for cleanup (${usersResponse.status}).`);
  }

  const users = await usersResponse.json().catch(() => []);
  if (Array.isArray(users)) {
    for (const user of users) {
      const email = typeof user?.email === 'string' ? user.email.toLowerCase() : '';
      const username = typeof user?.username === 'string' ? user.username.toLowerCase() : '';
      if (!startsWithAny(email, emailPrefixes) && !startsWithAny(username, usernamePrefixes)) {
        continue;
      }

      const deleted = await fetch(
        `${keycloakUrl}/admin/realms/${encodeURIComponent(keycloakRealm)}/users/${encodeURIComponent(user.id)}`,
        {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${adminAccessToken}`,
          },
        },
      );

      if (![200, 202, 204, 404].includes(deleted.status)) {
        fail(`Failed to delete Keycloak test user ${user.id} (${deleted.status}).`);
      }
      if (deleted.status === 404) {
        summary.alreadyDeletedKeycloakUsers += 1;
      } else {
        summary.deletedKeycloakUsers += 1;
      }
    }
  }
} else {
  console.log('Skipped Keycloak user cleanup: KEYCLOAK_ADMIN_USERNAME/KEYCLOAK_ADMIN_PASSWORD not set.');
}

console.log(
  `Cleanup complete. projects=${String(summary.deletedProjects)} notes=${String(summary.archivedNotes)} invites=${String(summary.deletedInvites)} keycloakUsers=${String(summary.deletedKeycloakUsers)} alreadyDeletedProjects=${String(summary.alreadyDeletedProjects)} alreadyArchivedNotes=${String(summary.alreadyArchivedNotes)} alreadyDeletedInvites=${String(summary.alreadyDeletedInvites)} alreadyDeletedKeycloakUsers=${String(summary.alreadyDeletedKeycloakUsers)}`,
);
