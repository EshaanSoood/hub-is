import type { ComponentProps, ReactElement } from 'react';
import { Card } from '../primitives';
import type { CreateReminderPayload, HubReminderSummary } from '../../services/hub/reminders';
import type { HubProjectMember, HubProjectSummary, HubTaskSummary } from '../../services/hub/types';
import { CalendarWidgetSkin } from './CalendarWidgetSkin';
import type { CalendarEventSummary, CalendarScope } from './CalendarWidgetSkin/types';
import { ProjectDocsTab } from './ProjectDocsTab';
import { RemindersWidgetSkin } from './RemindersWidgetSkin';
import type { SurfaceTabItem } from './SurfaceTabBar';
import { TasksSurface } from './TasksSurface';
import { WorkspaceDocSurface } from './WorkspaceDocSurface';

type WorkspaceDocProps = ComponentProps<typeof WorkspaceDocSurface>;
export type ProjectSurfaceId = 'hub' | 'docs' | 'calendar' | 'tasks' | 'reminders';

export const projectSurfaceTabs: Array<SurfaceTabItem<ProjectSurfaceId>> = [
  { id: 'hub', label: 'Hub' },
  { id: 'docs', label: 'Docs' },
  { id: 'calendar', label: 'Calendar' },
  { id: 'tasks', label: 'Tasks' },
  { id: 'reminders', label: 'Reminders' },
];

export interface ProjectSurfacesProps {
  activeProject: HubProjectSummary | null;
  activeProjectCanEdit: boolean;
  activeSurface: ProjectSurfaceId;
  activeProjectDocId: string | null;
  accessToken: string;
  calendarEvents: CalendarEventSummary[];
  calendarLoading: boolean;
  calendarMode: CalendarScope;
  onCalendarScopeChange: (scope: CalendarScope) => void;
  onCreateReminder: (payload: CreateReminderPayload) => Promise<void>;
  onDismissReminder: (reminderId: string) => Promise<void>;
  onOpenRecord: (recordId: string) => void;
  onRefreshTasks: () => void;
  onSelectProjectDoc: (docId: string) => void;
  projectMembers: HubProjectMember[];
  reminders: HubReminderSummary[];
  remindersError: string | null;
  remindersLoading: boolean;
  spaceId: string;
  tasks: HubTaskSummary[];
  tasksError: string | null;
  tasksLoading: boolean;
  workspaceDocProps: WorkspaceDocProps;
}

export const ProjectSurfaces = ({
  activeProject,
  activeProjectCanEdit,
  activeSurface,
  activeProjectDocId,
  accessToken,
  calendarEvents,
  calendarLoading,
  calendarMode,
  onCalendarScopeChange,
  onCreateReminder,
  onDismissReminder,
  onOpenRecord,
  onRefreshTasks,
  onSelectProjectDoc,
  projectMembers,
  reminders,
  remindersError,
  remindersLoading,
  spaceId,
  tasks,
  tasksError,
  tasksLoading,
  workspaceDocProps,
}: ProjectSurfacesProps): ReactElement => (
    <Card className="min-h-0 px-5 pb-4 pt-5">
      {activeSurface === 'hub' ? (
        <div id="project-surface-panel-hub" role="tabpanel" aria-label="Project Hub">
          <section className="rounded-panel border border-subtle bg-elevated p-4">
            <h3 className="heading-3 text-text">Project Hub</h3>
            <p className="mt-2 text-sm text-muted">This project surface is coming soon.</p>
          </section>
        </div>
      ) : null}

      {activeSurface === 'docs' ? (
        <div id="project-surface-panel-docs" role="tabpanel" aria-label="Docs">
          <ProjectDocsTab
            activeProject={activeProject}
            activeProjectCanEdit={activeProjectCanEdit}
            activeProjectDocId={activeProjectDocId}
            onSelectProjectDoc={onSelectProjectDoc}
            workspaceDocProps={workspaceDocProps}
          />
        </div>
      ) : null}

      {activeSurface === 'calendar' ? (
        <div id="project-surface-panel-calendar" role="tabpanel" aria-label="Calendar" className="min-h-[32rem]">
          <CalendarWidgetSkin
            sizeTier="L"
            events={calendarEvents.filter((event) => event.source_project?.project_id === activeProject?.project_id)}
            loading={calendarLoading}
            scope={calendarMode}
            onScopeChange={onCalendarScopeChange}
            onOpenRecord={onOpenRecord}
          />
        </div>
      ) : null}

      {activeSurface === 'tasks' ? (
        <div id="project-surface-panel-tasks" role="tabpanel" aria-label="Tasks">
          <TasksSurface
            accessToken={accessToken}
            spaceId={spaceId}
            sourceProjectId={activeProject?.project_id ?? null}
            projectMembers={projectMembers}
            tasks={tasks}
            tasksLoading={tasksLoading}
            tasksError={tasksError}
            onRefreshTasks={onRefreshTasks}
            onOpenRecord={onOpenRecord}
          />
        </div>
      ) : null}

      {activeSurface === 'reminders' ? (
        <div id="project-surface-panel-reminders" role="tabpanel" aria-label="Reminders" className="min-h-0">
          <RemindersWidgetSkin
            sizeTier="L"
            reminders={reminders}
            loading={remindersLoading}
            error={remindersError}
            onDismiss={onDismissReminder}
            onCreate={onCreateReminder}
          />
        </div>
      ) : null}
    </Card>
);
