export type TopLevelProjectTab = 'overview' | 'work' | 'tools';

export type OverviewViewId = 'timeline' | 'calendar' | 'tasks' | 'kanban';

export type AudienceMode = 'project' | 'personal' | 'custom';

export type ModuleSize = 'S' | 'M' | 'L';

export type ModuleLens = 'project' | 'pane_scratch';

export type ModuleType =
  | 'tasks'
  | 'calendar'
  | 'timeline'
  | 'files'
  | 'quick_thoughts'
  | 'workspaces'
  | 'people'
  | 'notifications';

export interface Collaborator {
  id: string;
  name: string;
  role: 'owner' | 'editor' | 'viewer';
}

export interface ClientReference {
  id: string;
  name: string;
  contact: string;
}

export interface ModuleTemplate {
  type: ModuleType;
  label: string;
  defaultSize: ModuleSize;
  defaultLens: ModuleLens;
}

export interface PaneModule {
  id: string;
  type: ModuleType;
  label: string;
  size: ModuleSize;
  lens: ModuleLens;
}

export interface WorkPane {
  id: string;
  title: string;
  audienceMode: AudienceMode;
  customMemberIds: string[];
  modulesEnabled: boolean;
  workspaceEnabled: boolean;
  docBindingMode: 'owned';
  modules: PaneModule[];
}
