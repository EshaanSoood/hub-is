import { useMemo, type ComponentProps, type ReactElement } from 'react';
import { OverviewView } from '../../../components/project-space/OverviewView';
import type { CalendarEventSummary } from '../../../components/project-space/CalendarModuleSkin/types';
import type { HubProjectMember, HubTaskSummary } from '../../../services/hub/types';
import type { OverviewSubView } from './types';

type OverviewViewProps = ComponentProps<typeof OverviewView>;

export interface ProjectSpaceOverviewSurfaceProps {
  projectName: string;
  projectId: string;
  isPersonalProject: boolean;
  projectMemberList: HubProjectMember[];
  accessToken: string;
  overviewView: OverviewSubView;
  onSelectOverviewView: (nextView: OverviewSubView) => void;
  timelineClusters: OverviewViewProps['timelineClusters'];
  timelineFilters: OverviewViewProps['timelineFilters'];
  onTimelineFilterToggle: OverviewViewProps['onTimelineFilterToggle'];
  onOpenRecord: (recordId: string) => void;
  calendarEvents: CalendarEventSummary[];
  calendarLoading: boolean;
  calendarMode: OverviewViewProps['calendarScope'];
  onCalendarScopeChange: OverviewViewProps['onCalendarScopeChange'];
  tasks: HubTaskSummary[];
  tasksLoading: boolean;
  tasksError: string | null;
  onRefreshTasks: () => void;
  inviteEmail: string;
  inviteSubmitting: boolean;
  inviteError: string | null;
  inviteNotice: string | null;
  onInviteEmailChange: (nextValue: string) => void;
  onInviteSubmit: () => void;
  onDismissInviteFeedback: () => void;
}

export const ProjectSpaceOverviewSurface = ({
  projectName,
  projectId,
  isPersonalProject,
  projectMemberList,
  accessToken,
  overviewView,
  onSelectOverviewView,
  timelineClusters,
  timelineFilters,
  onTimelineFilterToggle,
  onOpenRecord,
  calendarEvents,
  calendarLoading,
  calendarMode,
  onCalendarScopeChange,
  tasks,
  tasksLoading,
  tasksError,
  onRefreshTasks,
  inviteEmail,
  inviteSubmitting,
  inviteError,
  inviteNotice,
  onInviteEmailChange,
  onInviteSubmit,
  onDismissInviteFeedback,
}: ProjectSpaceOverviewSurfaceProps): ReactElement => {
  const overviewCollaborators = useMemo(
    () =>
      projectMemberList.map((member) => {
        const role: 'owner' | 'editor' | 'viewer' =
          member.role === 'owner' || member.role === 'editor' || member.role === 'viewer' ? member.role : 'viewer';
        return {
          id: member.user_id,
          name: member.display_name,
          role,
        };
      }),
    [projectMemberList],
  );
  const overviewClients = useMemo(() => [], []);

  return (
    <div className="space-y-4">
      <OverviewView
        projectName={projectName}
        projectSummary="Track the timeline, calendar, and task flow for this space."
        collaborators={overviewCollaborators}
        clients={overviewClients}
        activeView={overviewView}
        onSelectView={onSelectOverviewView}
        timelineClusters={timelineClusters}
        timelineFilters={timelineFilters}
        onTimelineFilterToggle={onTimelineFilterToggle}
        onOpenTimelineRecord={onOpenRecord}
        accessToken={accessToken}
        projectId={projectId}
        calendarEvents={calendarEvents}
        calendarLoading={calendarLoading}
        calendarScope={calendarMode}
        onCalendarScopeChange={onCalendarScopeChange}
        onOpenCalendarRecord={onOpenRecord}
        tasks={tasks}
        tasksLoading={tasksLoading}
        tasksError={tasksError}
        onRefreshTasks={onRefreshTasks}
        projectMembers={projectMemberList}
        canInviteMembers={!isPersonalProject}
        inviteEmail={inviteEmail}
        inviteSubmitting={inviteSubmitting}
        inviteError={inviteError}
        inviteNotice={inviteNotice}
        onInviteEmailChange={onInviteEmailChange}
        onInviteSubmit={onInviteSubmit}
        onDismissInviteFeedback={onDismissInviteFeedback}
        inviteGuestsSection={null}
      />
    </div>
  );
};
