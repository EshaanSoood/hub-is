export const PROJECT_SPACE_PRIMARY_SURFACES = ['overview', 'work'] as const;

export type TopLevelProjectTab = (typeof PROJECT_SPACE_PRIMARY_SURFACES)[number];

export type OverviewViewId = 'hub' | 'timeline' | 'calendar' | 'tasks';

export type AudienceMode = 'project' | 'personal' | 'custom';

export type WidgetSize = 'S' | 'M' | 'L';

export type WidgetLens = 'space' | 'project' | 'project_scratch';

export type WidgetType =
  | 'tasks'
  | 'calendar'
  | 'reminders'
  | 'kanban'
  | 'table'
  | 'timeline';

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

export interface WidgetTemplate {
  type: WidgetType;
  label: string;
  defaultSize: WidgetSize;
  defaultLens: WidgetLens;
}

export interface ProjectWidget {
  id: string;
  type: WidgetType;
  label: string;
  size: WidgetSize;
  lens: WidgetLens;
}

export interface WorkProject {
  id: string;
  title: string;
  audienceMode: AudienceMode;
  customMemberIds: string[];
  widgetsEnabled: boolean;
  workspaceEnabled: boolean;
  docBindingMode: 'owned';
  widgets: ProjectWidget[];
}
