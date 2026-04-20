/** Membership role labels supported by project-level permissions. */
export type ProjectMembershipRole = 'owner' | 'member';

export interface ProjectSummary {
  /** Stable project identifier. */
  project_id: string;
  /** Project display name. */
  name: string;
  /** User identifier of the project creator. */
  created_by: string;
  /** ISO 8601 project creation timestamp. */
  created_at: string;
  /** ISO 8601 timestamp for the last project update. */
  updated_at: string;
  /** Manual sidebar ordering position. */
  position: number | null;
  /** True when this is a user-scoped personal project. */
  is_personal: boolean;
  /** Current user membership role; null when not available. */
  membership_role: ProjectMembershipRole | null;
  /** True when the personal project should be named on first run. */
  needs_name_prompt?: boolean;
}

export interface ListProjectsResponse {
  /** Projects visible to the authenticated user. */
  projects: ProjectSummary[];
}

export interface CreateProjectRequest {
  /** Required non-empty project name. */
  name: string;
  /** Optional caller-provided project identifier. */
  project_id?: string;
}

export interface CreateProjectResponse {
  /** Newly created project summary. */
  project: ProjectSummary;
}

export interface GetProjectResponse {
  /** Requested project summary. */
  project: ProjectSummary;
}

export interface ProjectRecord {
  /** UI-facing project identifier. */
  id: string;
  /** UI-facing project name. */
  name: string;
  /** UI status flag used for filtering and badges. */
  status: 'active' | 'paused';
  /** Optional summary text displayed in project cards. */
  summary: string;
  /** Linked OpenProject project ID when integrated. */
  openProjectProjectId: string | null;
  /** Linked Nextcloud folder when integrated. */
  nextcloudFolder: string | null;
  /** True when this project is the user personal project. */
  isPersonal: boolean;
  /** Membership role for the signed-in user. */
  membershipRole: ProjectMembershipRole;
  /** Manual sidebar ordering position. */
  position: number | null;
  /** True when Home should prompt the user to name the personal project. */
  needsNamePrompt?: boolean;
}
