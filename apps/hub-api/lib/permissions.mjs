const roleForSpace = (db, userId, spaceId) =>
  db.prepare(`
    SELECT role
    FROM space_members
    WHERE space_id = ? AND user_id = ?
    LIMIT 1
  `).get(spaceId, userId)?.role || null;

const projectSpaceId = (db, projectId) =>
  db.prepare(`
    SELECT space_id
    FROM projects
    WHERE project_id = ?
    LIMIT 1
  `).get(projectId)?.space_id || null;

const hasExplicitProjectAccess = (db, userId, spaceId, projectId) =>
  Boolean(db.prepare(`
    SELECT 1 AS ok
    FROM space_member_project_access
    WHERE space_id = ? AND user_id = ? AND project_id = ?
    LIMIT 1
  `).get(spaceId, userId, projectId)?.ok);

const isProjectMember = (db, userId, projectId) =>
  Boolean(db.prepare(`
    SELECT 1 AS ok
    FROM project_members
    WHERE project_id = ? AND user_id = ?
    LIMIT 1
  `).get(projectId, userId)?.ok);

export const canUserAccessProject = (db, userId, projectId) => {
  const spaceId = projectSpaceId(db, projectId);
  if (!spaceId) {
    return false;
  }

  const role = roleForSpace(db, userId, spaceId);
  if (!role) {
    return false;
  }

  if (role === 'owner' || role === 'admin') {
    return true;
  }

  if (role === 'viewer' || role === 'guest') {
    return hasExplicitProjectAccess(db, userId, spaceId, projectId);
  }

  if (role === 'member') {
    // TODO: Apply project visibility exclusions once hidden-project rows exist.
    return true;
  }

  return false;
};

export const canUserAccessSpaceOverview = (db, userId, spaceId) => {
  const role = roleForSpace(db, userId, spaceId);
  return role === 'owner' || role === 'admin' || role === 'member';
};

export const canUserManageSpaceMembers = (db, userId, spaceId) => {
  const role = roleForSpace(db, userId, spaceId);
  return role === 'owner' || role === 'admin';
};

export const canUserEditProject = (db, userId, projectId) => {
  const spaceId = projectSpaceId(db, projectId);
  if (!spaceId) {
    return false;
  }

  const role = roleForSpace(db, userId, spaceId);
  if (!role) {
    return false;
  }

  if (role === 'owner' || role === 'admin') {
    return true;
  }

  if (role === 'viewer') {
    return false;
  }

  if (role === 'guest') {
    return hasExplicitProjectAccess(db, userId, spaceId, projectId);
  }

  if (role === 'member') {
    return isProjectMember(db, userId, projectId);
  }

  return false;
};

export const canUserDeleteSpace = (db, userId, spaceId) =>
  roleForSpace(db, userId, spaceId) === 'owner';

export const canUserManageProjectVisibility = (db, userId, spaceId) => {
  const role = roleForSpace(db, userId, spaceId);
  return role === 'owner' || role === 'admin';
};
