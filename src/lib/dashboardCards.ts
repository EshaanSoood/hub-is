import type { GlobalCapability, ProjectCapability } from '../types/domain';

export interface DashboardCardDefinition {
  id: string;
  title: string;
  description: string;
  requiredGlobalCapabilities: GlobalCapability[];
  requiredProjectCapability?: ProjectCapability;
  projectScopeRequired?: boolean;
  target: string;
}

export interface DashboardCardSessionScope {
  globalCapabilities: GlobalCapability[];
  projectCapabilities: Record<string, ProjectCapability[]>;
}

export interface DashboardCardProjectScope {
  id: string;
}

// dashboardCardRegistry is used here as a capability compatibility gate only.
// It is not the source of truth for what the dashboard renders.
// Do not add rendering logic that depends on registry contents.
export const dashboardCardRegistry: DashboardCardDefinition[] = [
  {
    id: 'tasks-today',
    title: 'Tasks Due Today',
    description: 'Open today\'s tasks and quick actions.',
    requiredGlobalCapabilities: ['projects.view'],
    requiredProjectCapability: 'project.activity.view',
    projectScopeRequired: true,
    target: '/projects',
  },
  {
    id: 'recent-files',
    title: 'Recent Files',
    description: 'View recent Nextcloud assets and share links.',
    requiredGlobalCapabilities: ['hub.view'],
    requiredProjectCapability: 'project.files.view',
    projectScopeRequired: true,
    target: '/',
  },
  {
    id: 'recent-notes',
    title: 'Notes',
    description: 'Facets notes workspace (placeholder).',
    requiredGlobalCapabilities: ['hub.view'],
    requiredProjectCapability: 'project.notes.view',
    projectScopeRequired: true,
    target: '/projects',
  },
  {
    id: 'service-status',
    title: 'Service Status',
    description: 'Wake/sleep service controls and health visibility.',
    requiredGlobalCapabilities: ['hub.view'],
    target: '/',
  },
  {
    id: 'notifications',
    title: 'Notifications',
    description: 'Send Postmark messages and ntfy alerts.',
    requiredGlobalCapabilities: ['hub.view'],
    target: '/',
  },
];

export const filterDashboardCards = (
  session: DashboardCardSessionScope,
  projects: DashboardCardProjectScope[],
): DashboardCardDefinition[] =>
  dashboardCardRegistry.filter((card) => {
    const hasGlobalCaps = card.requiredGlobalCapabilities.every((capability) =>
      session.globalCapabilities.includes(capability),
    );
    if (!hasGlobalCaps) {
      return false;
    }
    if (!card.requiredProjectCapability) {
      return true;
    }
    const requiredProjectCapability = card.requiredProjectCapability;
    return projects.some((project) =>
      (session.projectCapabilities[project.id] ?? []).includes(requiredProjectCapability),
    );
  });
