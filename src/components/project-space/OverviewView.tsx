import { useRef, useState } from 'react';
import type { HubProjectMember, HubProjectSummary, HubTaskSummary } from '../../services/hub/types';
import type { SpaceInviteRole } from '../../hooks/useProjectMembers';
import { CalendarWidgetSkin } from './CalendarWidgetSkin';
import type { CalendarEventSummary, CalendarScope } from './CalendarWidgetSkin/types';
import { Card } from '../primitives';
import { OverviewHeader } from './OverviewHeader';
import { SpaceMembersManagement } from './SpaceMembersManagement';
import { TasksSurface } from './TasksSurface';
import { TimelineFeed, type TimelineCluster, type TimelineEventType, type TimelineFilterValue } from './TimelineFeed';
import { SurfaceTabBar } from './SurfaceTabBar';
import type { ClientReference, Collaborator, OverviewViewId } from './types';

interface OverviewViewProps {
  projectName: string;
  projectSummary: string;
  collaborators: Collaborator[];
  clients: ClientReference[];
  activeView: OverviewViewId;
  onSelectView: (viewId: OverviewViewId) => void;
  timelineClusters: TimelineCluster[];
  timelineFilters: TimelineEventType[];
  onTimelineFilterToggle: (type: TimelineFilterValue) => void;
  onOpenTimelineRecord: (recordId: string) => void;
  accessToken: string;
  projectId: string;
  calendarEvents: CalendarEventSummary[];
  calendarLoading: boolean;
  calendarScope: CalendarScope;
  onCalendarScopeChange: (scope: CalendarScope) => void;
  onOpenCalendarRecord: (recordId: string) => void;
  tasks: HubTaskSummary[];
  tasksLoading: boolean;
  tasksError: string | null;
  onRefreshTasks: () => void;
  projects: HubProjectSummary[];
  projectMembers: HubProjectMember[];
  canInviteMembers: boolean;
  canManageMembers: boolean;
  inviteEmail: string;
  inviteRole: SpaceInviteRole;
  inviteProjectIds: string[];
  viewerInviteDays: number;
  inviteSubmitting: boolean;
  memberActionUserId: string | null;
  inviteError: string | null;
  inviteNotice: string | null;
  cooldownInviteError: boolean;
  onInviteEmailChange: (value: string) => void;
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

const overviewViews: Array<{ id: OverviewViewId; label: string }> = [
  { id: 'hub', label: 'Hub' },
  { id: 'timeline', label: 'Timeline' },
  { id: 'calendar', label: 'Calendar' },
  { id: 'tasks', label: 'Tasks' },
];

export const OverviewView = ({
  projectName,
  projectSummary,
  collaborators,
  clients,
  activeView,
  onSelectView,
  timelineClusters,
  timelineFilters,
  onTimelineFilterToggle,
  onOpenTimelineRecord,
  accessToken,
  projectId,
  calendarEvents,
  calendarLoading,
  calendarScope,
  onCalendarScopeChange,
  onOpenCalendarRecord,
  tasks,
  tasksLoading,
  tasksError,
  onRefreshTasks,
  projects,
  projectMembers,
  canInviteMembers,
  canManageMembers,
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
}: OverviewViewProps) => {
  const [titleDraft, setTitleDraft] = useState(projectName);
  const inviteInputRef = useRef<HTMLInputElement | null>(null);

  return (
    <section id="project-panel-overview" role="tabpanel" aria-labelledby="project-tab-overview" className="space-y-4">
      <Card className="pt-3">
        <SurfaceTabBar
          activeSurface={activeView}
          ariaLabel="Overview sub-views"
          idPrefix="overview-view"
          items={overviewViews}
          onSelectSurface={onSelectView}
          panelIdPrefix="overview-panel"
        />

        {activeView === 'hub' ? (
          <div id="overview-panel-hub" role="tabpanel" aria-labelledby="overview-view-hub" className="mt-4 space-y-5">
            <OverviewHeader
              title={titleDraft}
              onTitleChange={setTitleDraft}
              startDateLabel="March 4, 2026"
              collaborators={collaborators}
              refs={clients}
              onInvite={() => {
                inviteInputRef.current?.focus();
                inviteInputRef.current?.select();
              }}
            />

            <div>
              <SpaceMembersManagement
                spaceName={projectName}
                projects={projects}
                members={projectMembers}
                canInviteMembers={canInviteMembers}
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
                inviteInputRef={inviteInputRef}
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

            <div className="space-y-3">
              {projectSummary ? <p className="text-sm text-muted">{projectSummary}</p> : null}
              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-text">Projects</h3>
                {projects.length > 0 ? (
                  <ul className="divide-y divide-border-muted rounded-md border border-border-muted bg-surface" aria-label="Projects in this hub">
                    {projects.map((project) => (
                      <li key={project.project_id} className="flex items-center justify-between gap-4 px-4 py-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-text">{project.name}</p>
                          <p className="text-xs text-muted">
                            {project.docs.length} {project.docs.length === 1 ? 'doc' : 'docs'} &middot; {project.members.length}{' '}
                            {project.members.length === 1 ? 'member' : 'members'}
                          </p>
                        </div>
                        {project.pinned ? <span className="text-xs font-medium text-muted">Pinned</span> : null}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="rounded-md border border-dashed border-border-muted bg-surface-elevated px-4 py-6 text-sm text-muted">
                    No projects in this hub yet.
                  </p>
                )}
              </div>
            </div>
          </div>
        ) : null}

        {activeView === 'timeline' ? (
          <div id="overview-panel-timeline" role="tabpanel" aria-labelledby="overview-view-timeline" className="mt-4 space-y-3">
            <TimelineFeed
              clusters={timelineClusters}
              activeFilters={timelineFilters}
              isLoading={false}
              hasMore={false}
              onFilterToggle={onTimelineFilterToggle}
              onLoadMore={() => {}}
              onItemClick={(recordId) => onOpenTimelineRecord(recordId)}
            />
          </div>
        ) : null}

        {activeView === 'calendar' ? (
          <div id="overview-panel-calendar" role="tabpanel" aria-labelledby="overview-view-calendar" className="mt-4">
            <div className="min-h-[32rem]">
              <CalendarWidgetSkin
                sizeTier="L"
                events={calendarEvents}
                loading={calendarLoading}
                scope={calendarScope}
                onScopeChange={onCalendarScopeChange}
                onOpenRecord={onOpenCalendarRecord}
              />
            </div>
          </div>
        ) : null}

        {activeView === 'tasks' ? (
          <div id="overview-panel-tasks" role="tabpanel" aria-labelledby="overview-view-tasks" className="mt-4">
            <TasksSurface
              accessToken={accessToken}
              projectId={projectId}
              projectMembers={projectMembers}
              tasks={tasks}
              tasksLoading={tasksLoading}
              tasksError={tasksError}
              onRefreshTasks={onRefreshTasks}
              onOpenRecord={onOpenTimelineRecord}
            />
          </div>
        ) : null}
      </Card>
    </section>
  );
};
