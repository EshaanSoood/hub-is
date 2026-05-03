import type { ComponentProps, ReactElement } from 'react';
import { AccessDeniedView } from '../../../components/auth/AccessDeniedView';
import type { CalendarEventSummary, CalendarScope } from '../../../components/project-space/CalendarWidgetSkin/types';
import { ProjectSurfaces, type ProjectSurfaceId } from '../../../components/project-space/ProjectSurfaces';
import { WorkspaceDocSurface } from '../../../components/project-space/WorkspaceDocSurface';
import { InlineNotice } from '../../../components/primitives';
import type { CreateReminderPayload, HubReminderSummary } from '../../../services/hub/reminders';
import type { HubProjectMember, HubProjectSummary, HubTaskSummary } from '../../../services/hub/types';
import { ProjectSpaceWorkProjectChrome } from './ProjectSpaceWorkProjectChrome';

type ProjectChromeProps = ComponentProps<typeof ProjectSpaceWorkProjectChrome>;
type WorkspaceDocProps = ComponentProps<typeof WorkspaceDocSurface>;

export interface ProjectSpaceWorkSurfaceProps {
  projectId?: string;
  spaceId?: string;
  hasRequestedProject: boolean;
  activeProject: HubProjectSummary | null;
  activeProjectCanEdit: boolean;
  activeProjectSurface?: ProjectSurfaceId;
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
  activeProjectSurface = 'hub',
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
}: ProjectSpaceWorkSurfaceProps): ReactElement => (
  <section className="space-y-4">
    <ProjectSpaceWorkProjectChrome {...projectChromeProps} />

    {projectId && !hasRequestedProject ? (
      <AccessDeniedView message="Project not found in this space." />
    ) : (
      <>
        <ProjectSurfaces
          activeProject={activeProject}
          activeProjectCanEdit={activeProjectCanEdit}
          activeSurface={activeProjectSurface}
          activeProjectDocId={activeProjectDocId}
          accessToken={accessToken}
          calendarEvents={calendarEvents}
          calendarLoading={calendarLoading}
          calendarMode={calendarMode}
          onCalendarScopeChange={onCalendarScopeChange}
          onCreateReminder={onCreateReminder}
          onDismissReminder={onDismissReminder}
          onOpenRecord={onOpenRecord}
          onRefreshTasks={onRefreshTasks}
          onSelectProjectDoc={onSelectProjectDoc}
          projectMembers={projectMembers}
          reminders={reminders}
          remindersError={remindersError}
          remindersLoading={remindersLoading}
          spaceId={spaceId ?? workspaceDocProps.projectId}
          tasks={tasks}
          tasksError={tasksError}
          tasksLoading={tasksLoading}
          workspaceDocProps={workspaceDocProps}
        />

        {recordsError ? (
          <InlineNotice variant="danger" title="Views and records unavailable">
            {recordsError}
          </InlineNotice>
        ) : null}
      </>
    )}
  </section>
);
