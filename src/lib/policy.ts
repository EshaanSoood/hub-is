import type {
  GlobalCapability,
  ProjectCapability,
  ProjectMembership,
  UserIdentity,
} from '../types/domain';

export interface AppTab {
  to: string;
  label: string;
  capability: GlobalCapability;
}

export const appTabs: AppTab[] = [
  { to: '/', label: 'Hub', capability: 'hub.view' },
  { to: '/projects', label: 'Projects', capability: 'projects.view' },
];

export const hasGlobalCapability = (
  globalCapabilities: GlobalCapability[],
  capability: GlobalCapability,
): boolean => globalCapabilities.includes(capability);

export const getMembershipForProject = (
  memberships: ProjectMembership[],
  userId: UserIdentity['id'],
  projectId: string,
): ProjectMembership | undefined =>
  memberships.find((membership) => membership.userId === userId && membership.projectId === projectId);

export const hasProjectCapability = (
  membership: ProjectMembership | undefined,
  capability: ProjectCapability,
): boolean => Boolean(membership?.capabilities.includes(capability));

export const canAccessProject = (
  memberships: ProjectMembership[],
  user: UserIdentity,
  projectId: string,
): boolean => hasProjectCapability(getMembershipForProject(memberships, user.id, projectId), 'project.view');
