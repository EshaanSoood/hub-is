import { useMemo, type ComponentProps, type ReactElement } from 'react';
import { OverviewView } from '../../../components/project-space/OverviewView';
import type { CalendarEventSummary } from '../../../components/project-space/CalendarWidgetSkin/types';
import type { HubProjectMember, HubProjectSummary, HubTaskSummary } from '../../../services/hub/types';
import type { SpaceInviteRole } from '../../../hooks/useProjectMembers';
import type { OverviewSubView } from './types';

type OverviewViewProps = ComponentProps<typeof OverviewView>;

export interface ProjectSpaceOverviewSurfaceProps {
  projectName: string;
  projectId: string;
  isPersonalProject: boolean;
  projects: HubProjectSummary[];
  projectMemberList: HubProjectMember[];
  accessToken: string;
  canManageMembers: boolean;
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
  inviteRole: SpaceInviteRole;
  inviteProjectIds: string[];
  viewerInviteDays: number;
  inviteSubmitting: boolean;
  memberActionUserId: string | null;
  inviteError: string | null;
  inviteNotice: string | null;
  cooldownInviteError: boolean;
  onInviteEmailChange: (nextValue: string) => void;
  onInviteRoleChange: (role: SpaceInviteRole) => void;
  onToggleInviteProject: (projectId: string) => void;
  onViewerInviteDaysChange: (days: number) => void;
  onInviteSubmit: () => void;
  onDismissInviteFeedback: () => void;
  onUpgradeGuestToMember: (userId: string) => Promise<boolean>;
  onExtendGuestAccess: (member: HubProjectMember) => Promise<boolean>;
  onRemoveProjectMember: (userId: string) => Promise<boolean>;
  onGrantProjectAccess: (userId: string, projectIds: string[]) => Promise<boolean>;
}

export const ProjectSpaceOverviewSurface = ({
  projectName,
  projectId,
  isPersonalProject,
  projects,
  projectMemberList,
  accessToken,
  canManageMembers,
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
  inviteRole,
  inviteProjectIds,
  viewerInviteDays,
  inviteSubmitting,
  memberActionUserId,
  inviteError,
  inviteNotice,
  cooldownInviteError,
  onInviteEmailChange,
  onInviteRoleChange,
  onToggleInviteProject,
  onViewerInviteDaysChange,
  onInviteSubmit,
  onDismissInviteFeedback,
  onUpgradeGuestToMember,
  onExtendGuestAccess,
  onRemoveProjectMember,
  onGrantProjectAccess,
}: ProjectSpaceOverviewSurfaceProps): ReactElement => {
  const overviewCollaborators = useMemo(
    () =>
      projectMemberList.map((member) => {
        const role: 'owner' | 'editor' | 'viewer' =
          member.role === 'owner'
            ? 'owner'
            : member.role === 'admin' || member.role === 'member' || member.role === 'guest'
              ? 'editor'
              : 'viewer';
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
        projects={projects}
        projectMembers={projectMemberList}
        canInviteMembers={!isPersonalProject}
        canManageMembers={canManageMembers}
        inviteEmail={inviteEmail}
        inviteRole={inviteRole}
        inviteProjectIds={inviteProjectIds}
        viewerInviteDays={viewerInviteDays}
        inviteSubmitting={inviteSubmitting}
        memberActionUserId={memberActionUserId}
        inviteError={inviteError}
        inviteNotice={inviteNotice}
        cooldownInviteError={cooldownInviteError}
        onInviteEmailChange={onInviteEmailChange}
        onInviteRoleChange={onInviteRoleChange}
        onToggleInviteProject={onToggleInviteProject}
        onViewerInviteDaysChange={onViewerInviteDaysChange}
        onInviteSubmit={onInviteSubmit}
        onDismissInviteFeedback={onDismissInviteFeedback}
        onUpgradeGuestToMember={onUpgradeGuestToMember}
        onExtendGuestAccess={onExtendGuestAccess}
        onRemoveProjectMember={onRemoveProjectMember}
        onGrantProjectAccess={onGrantProjectAccess}
      />
    </div>
  );
};
