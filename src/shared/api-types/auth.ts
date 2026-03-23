/** Session role derived from project memberships. */
export type SessionRole = 'Owner' | 'Collaborator' | 'Viewer';

/** Global policy capabilities available across Hub APIs. */
export type GlobalCapability =
  | 'hub.view'
  | 'hub.tasks.write'
  | 'hub.notifications.write'
  | 'hub.live'
  | 'projects.view'
  | 'lessons.view'
  | 'media.view'
  | 'dev.view'
  | 'blockedInputs.view'
  | 'services.external.view';

/** Project-scoped capabilities for project resources. */
export type ProjectCapability =
  | 'project.view'
  | 'project.activity.view'
  | 'project.notes.view'
  | 'project.files.view'
  | 'project.automations.view';

export interface SessionProjectMembership {
  /** Project identifier associated with this membership. */
  projectId: string;
  /** Membership role in the project. */
  membershipRole: 'owner' | 'member';
}

export interface SessionSummary {
  /** Authenticated user identifier. */
  userId: string;
  /** Display name for the current user. */
  name: string;
  /** Given name value surfaced by session bootstrap. */
  firstName: string;
  /** Surname value surfaced by session bootstrap. */
  lastName: string;
  /** Primary user email address. */
  email: string;
  /** Highest derived session role from memberships. */
  role: SessionRole;
  /** Project membership list for the current user. */
  projectMemberships: SessionProjectMembership[];
  /** Global capabilities granted to the current user. */
  globalCapabilities: GlobalCapability[];
  /** Project capability map keyed by project ID. */
  projectCapabilities: Record<string, ProjectCapability[]>;
}
