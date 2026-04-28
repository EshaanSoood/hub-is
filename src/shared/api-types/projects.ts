/** Membership role labels supported by space-level permissions. */
export type SpaceMembershipRole = 'owner' | 'admin' | 'member' | 'viewer' | 'guest';

export interface SpaceSummary {
  /** Stable space identifier. */
  space_id: string;
  /** Space display name. */
  name: string;
  /** User identifier of the space creator. */
  created_by: string;
  /** ISO 8601 space creation timestamp. */
  created_at: string;
  /** ISO 8601 timestamp for the last space update. */
  updated_at: string;
  /** Manual sidebar ordering position. */
  position: number | null;
  /** True when this is a user-scoped personal space. */
  is_personal: boolean;
  /** Current user membership role; null when not available. */
  membership_role: SpaceMembershipRole | null;
  /** True when the personal space should be named on first run. */
  needs_name_prompt?: boolean;
}

export interface ListSpacesResponse {
  /** Spaces visible to the authenticated user. */
  spaces: SpaceSummary[];
}

export interface CreateSpaceRequest {
  /** Required non-empty space name. */
  name: string;
  /** Optional caller-provided space identifier. */
  space_id?: string;
}

export interface CreateSpaceResponse {
  /** Newly created space summary. */
  space: SpaceSummary;
}

export interface GetSpaceResponse {
  /** Requested space summary. */
  space: SpaceSummary;
}

export interface ProjectRecord {
  /** UI-facing space identifier. */
  id: string;
  /** UI-facing space name. */
  name: string;
  /** UI status flag used for filtering and badges. */
  status: 'active' | 'paused';
  /** Optional summary text displayed in space cards. */
  summary: string;
  /** Linked OpenProject project ID when integrated. */
  openProjectProjectId: string | null;
  /** True when this space is the user personal space. */
  isPersonal: boolean;
  /** Membership role for the signed-in user. */
  membershipRole: SpaceMembershipRole;
  /** Manual sidebar ordering position. */
  position: number | null;
  /** True when Home should prompt the user to name the personal space. */
  needsNamePrompt?: boolean;
}

export type ProjectMembershipRole = SpaceMembershipRole;
export type ProjectSummary = SpaceSummary;
export type ListProjectsResponse = ListSpacesResponse;
export type CreateProjectRequest = CreateSpaceRequest;
export type CreateProjectResponse = CreateSpaceResponse;
export type GetProjectResponse = GetSpaceResponse;
