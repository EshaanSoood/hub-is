import { useState, type ComponentProps, type ReactElement } from 'react';
import { AccessDeniedView } from '../../../components/auth/AccessDeniedView';
import { CalendarWidgetSkin } from '../../../components/project-space/CalendarWidgetSkin';
import type { CalendarEventSummary, CalendarScope } from '../../../components/project-space/CalendarWidgetSkin/types';
import { RemindersWidgetSkin } from '../../../components/project-space/RemindersWidgetSkin';
import { SurfaceTabBar, type SurfaceTabItem } from '../../../components/project-space/SurfaceTabBar';
import { TasksSurface } from '../../../components/project-space/TasksSurface';
import { WorkspaceDocSurface } from '../../../components/project-space/WorkspaceDocSurface';
import { Card, InlineNotice } from '../../../components/primitives';
import type { CreateReminderPayload, HubReminderSummary } from '../../../services/hub/reminders';
import type { HubProjectMember, HubProjectSummary, HubTaskSummary } from '../../../services/hub/types';
import { ProjectDocsTab } from './ProjectDocsTab';
import { ProjectSpaceWorkProjectChrome } from './ProjectSpaceWorkProjectChrome';

type ProjectChromeProps = ComponentProps<typeof ProjectSpaceWorkProjectChrome>;
type WorkspaceDocProps = ComponentProps<typeof WorkspaceDocSurface>;
type ProjectSurfaceId = 'hub' | 'docs' | 'calendar' | 'tasks' | 'reminders';

const projectSurfaceTabs: Array<SurfaceTabItem<ProjectSurfaceId>> = [
  { id: 'hub', label: 'Hub' },
  { id: 'docs', label: 'Docs' },
  { id: 'calendar', label: 'Calendar' },
  { id: 'tasks', label: 'Tasks' },
  { id: 'reminders', label: 'Reminders' },
];

export interface ProjectSpaceWorkSurfaceProps {
  projectId?: string;
  spaceId?: string;
  hasRequestedProject: boolean;
  activeProject: HubProjectSummary | null;
  activeProjectCanEdit: boolean;
  widgetsEnabled?: boolean;
  workLayoutId?: string;
  recordsError: string | null;
  projectChromeProps: ProjectChromeProps;
  focusedViewProps?: unknown;
  workViewProps?: unknown;
  workspaceDocProps: WorkspaceDocProps;
  activeProjectDocId?: string | null;
  onSelectProjectDoc?: (docId: string) => void;
  accessToken?: string;
  projectMembers?: HubProjectMember[];
  calendarEvents?: CalendarEventSummary[];
  calendarLoading?: boolean;
  calendarMode?: CalendarScope;
  onCalendarScopeChange?: (scope: CalendarScope) => void;
  onOpenRecord?: (recordId: string) => void;
  tasks?: HubTaskSummary[];
  tasksLoading?: boolean;
  tasksError?: string | null;
  onRefreshTasks?: () => void;
  reminders?: HubReminderSummary[];
  remindersLoading?: boolean;
  remindersError?: string | null;
  onDismissReminder?: (reminderId: string) => Promise<void>;
  onCreateReminder?: (payload: CreateReminderPayload) => Promise<void>;
}

export const ProjectSpaceWorkSurface = ({
  projectId,
  spaceId,
  hasRequestedProject,
  activeProject,
  activeProjectCanEdit,
  recordsError,
  projectChromeProps,
  workspaceDocProps,
  activeProjectDocId = workspaceDocProps.activeProjectDocId,
  onSelectProjectDoc = () => {},
  accessToken = workspaceDocProps.accessToken,
  projectMembers = workspaceDocProps.projectMembers,
  calendarEvents = [],
  calendarLoading = false,
  calendarMode = 'all',
  onCalendarScopeChange = () => {},
  onOpenRecord = () => {},
  tasks = [],
  tasksLoading = false,
  tasksError = null,
  onRefreshTasks = () => {},
  reminders = [],
  remindersLoading = false,
  remindersError = null,
  onDismissReminder = async () => {},
  onCreateReminder = async () => {},
}: ProjectSpaceWorkSurfaceProps): ReactElement => {
  const [activeSurface, setActiveSurface] = useState<ProjectSurfaceId>('hub');

  return (
    <section className="space-y-4">
      <ProjectSpaceWorkProjectChrome {...projectChromeProps} />

      {projectId && !hasRequestedProject ? (
        <AccessDeniedView message="Project not found in this space." />
      ) : (
        <>
          <Card className="min-h-0 px-5 pb-4 pt-5">
            <SurfaceTabBar
              activeSurface={activeSurface}
              ariaLabel="Project surfaces"
              idPrefix="project-surface-tab"
              items={projectSurfaceTabs}
              onSelectSurface={setActiveSurface}
              panelIdPrefix="project-surface-panel"
            />

            {activeSurface === 'hub' ? (
              <div id="project-surface-panel-hub" role="tabpanel" aria-labelledby="project-surface-tab-hub" className="mt-4">
                <section className="rounded-panel border border-subtle bg-elevated p-4">
                  <h3 className="heading-3 text-text">Project Hub</h3>
                  <p className="mt-2 text-sm text-muted">This project surface is coming soon.</p>
                </section>
              </div>
            ) : null}

            {activeSurface === 'docs' ? (
              <div id="project-surface-panel-docs" role="tabpanel" aria-labelledby="project-surface-tab-docs" className="mt-4">
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
              <div id="project-surface-panel-calendar" role="tabpanel" aria-labelledby="project-surface-tab-calendar" className="mt-4 min-h-[32rem]">
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
              <div id="project-surface-panel-tasks" role="tabpanel" aria-labelledby="project-surface-tab-tasks" className="mt-4">
                <TasksSurface
                  accessToken={accessToken}
                  projectId={spaceId ?? workspaceDocProps.projectId}
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
              <div id="project-surface-panel-reminders" role="tabpanel" aria-labelledby="project-surface-tab-reminders" className="mt-4 min-h-0">
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

          {recordsError ? (
            <InlineNotice variant="danger" title="Views and records unavailable">
              {recordsError}
            </InlineNotice>
          ) : null}
        </>
      )}
    </section>
  );
};
