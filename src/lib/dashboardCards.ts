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
    description: 'View recent files and share links.',
    requiredGlobalCapabilities: ['hub.view'],
    requiredProjectCapability: 'project.files.view',
    projectScopeRequired: true,
    target: '/',
  },
  {
    id: 'recent-notes',
    title: 'Notes (Hub)',
    description: 'Hub-native notes workspace (placeholder).',
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
