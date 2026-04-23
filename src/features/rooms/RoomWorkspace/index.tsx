import { useState } from 'react';
import { Link } from 'react-router-dom';

import { InlineNotice, LiveRegion } from '../../../components/primitives';
import { buildRoomHref, buildRoomProjectHref } from '../navigation';
import { RoomArchiveDialog } from './RoomArchiveDialog';
import { RoomCoordinationSurface } from './RoomCoordinationSurface';
import { RoomProjectSurface } from './RoomProjectSurface';
import { useRoomWorkspaceRuntime } from './useRoomWorkspaceRuntime';

interface RoomWorkspaceProps {
  accessToken: string;
  roomId: string;
  roomProjectPaneId?: string;
  sessionUserId: string;
}

export const RoomWorkspace = ({
  accessToken,
  roomId,
  roomProjectPaneId,
  sessionUserId,
}: RoomWorkspaceProps) => {
  const [archiveFeedback, setArchiveFeedback] = useState<string>('');
  const [archiveError, setArchiveError] = useState<string | null>(null);
  const runtime = useRoomWorkspaceRuntime({
    accessToken,
    roomId,
    roomProjectPaneId,
    sessionUserId,
  });

  if (runtime.loading) {
    return (
      <section className="space-y-4" role="status" aria-live="polite">
        <header className="rounded-panel border border-subtle bg-elevated p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-muted">Room</p>
          <h1 className="mt-1 text-base font-bold text-text">Loading room...</h1>
        </header>
      </section>
    );
  }

  if (runtime.error || !runtime.room || !runtime.project) {
    return (
      <InlineNotice variant="danger" title="Room unavailable">
        {runtime.error || 'Room not found.'}
      </InlineNotice>
    );
  }

  const room = runtime.room;
  const project = runtime.project;
  const breadcrumbItems = runtime.activeRoomProjectPane
    ? [room.displayName, runtime.activeRoomProjectPane.name]
    : [room.displayName];
  const roomMembers = runtime.roomMemberOptions.map((member) => ({
    id: member.id,
    label: member.label,
    role: member.role,
  }));
  const canMigrateRoomContent = runtime.isParentSpaceMember
    && runtime.roomMemberOptions.some((member) => member.id === sessionUserId);
  const archivedBadgeClasses = 'inline-flex items-center rounded-full border border-border-muted bg-surface px-2 py-1 text-xs font-semibold uppercase tracking-wide text-muted';

  const onArchiveRoom = async () => {
    try {
      await runtime.archiveRoom();
      setArchiveError(null);
      setArchiveFeedback(`Room archived. ${room.displayName} is now read-only and hidden from the sidebar.`);
    } catch (error) {
      setArchiveError(error instanceof Error ? error.message : 'Failed to archive room.');
      setArchiveFeedback('');
      throw error;
    }
  };

  return (
    <div className="space-y-4">
      <LiveRegion
        message={archiveError || archiveFeedback}
        role={archiveError ? 'alert' : 'status'}
        ariaLive={archiveError ? 'assertive' : 'polite'}
      />

      <header className="rounded-panel border border-subtle bg-elevated p-4">
        <nav aria-label="Breadcrumb">
          <ol className="flex flex-wrap items-center gap-2 text-sm text-muted">
            {breadcrumbItems.map((item, index) => (
              <li key={`${item}-${index}`} className="flex items-center gap-2">
                {index > 0 ? <span aria-hidden="true">›</span> : null}
                <span className={index === breadcrumbItems.length - 1 ? 'font-semibold text-text' : undefined}>{item}</span>
              </li>
            ))}
          </ol>
        </nav>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold text-text">
            {runtime.activeRoomProjectPane ? runtime.activeRoomProjectPane.name : room.displayName}
          </h1>
          {runtime.isArchived ? <span className={archivedBadgeClasses}>Archived</span> : null}
        </div>
        <p className="mt-2 text-sm text-muted">
          {runtime.activeRoomProjectPane
            ? `Fixed project inside ${room.displayName}.`
            : 'Room-level coordination across the two fixed projects.'}
        </p>

        {archiveError ? (
          <div className="mt-4">
            <InlineNotice variant="danger" title="Archive failed">
              {archiveError}
            </InlineNotice>
          </div>
        ) : null}

        {archiveFeedback ? (
          <div className="mt-4">
            <InlineNotice variant="success" title="Room archived">
              {archiveFeedback}
            </InlineNotice>
          </div>
        ) : null}

        {runtime.isArchived ? (
          <div className="mt-4">
            <InlineNotice variant="warning" title="Archived room">
              Archived rooms remain available as read-only snapshots when opened directly.
            </InlineNotice>
          </div>
        ) : null}

        <div className="mt-4 flex flex-wrap items-center gap-2">
          {runtime.isRoomOwner && !runtime.isArchived ? (
            <RoomArchiveDialog
              archiving={runtime.archivingRoom}
              roomName={room.displayName}
              onArchive={onArchiveRoom}
            />
          ) : null}
        </div>

        <nav className="mt-4 flex flex-wrap items-center gap-2" aria-label="Room navigation">
          <Link
            to={buildRoomHref(room.id)}
            aria-current={!runtime.activeRoomProjectPane ? 'page' : undefined}
            className={!runtime.activeRoomProjectPane
              ? 'rounded-panel bg-primary px-3 py-2 text-sm font-semibold text-on-primary'
              : 'rounded-panel border border-border-muted px-3 py-2 text-sm font-semibold text-primary'}
          >
            Coordination
          </Link>
          {runtime.roomProjectPanes.map((pane) => (
            <Link
              key={pane.pane_id}
              to={buildRoomProjectHref(room.id, pane.pane_id)}
              aria-current={runtime.activeRoomProjectPane?.pane_id === pane.pane_id ? 'page' : undefined}
              className={runtime.activeRoomProjectPane?.pane_id === pane.pane_id
                ? 'rounded-panel bg-primary px-3 py-2 text-sm font-semibold text-on-primary'
                : 'rounded-panel border border-border-muted px-3 py-2 text-sm font-semibold text-primary'}
            >
              {pane.name}
            </Link>
          ))}
        </nav>
      </header>

      {!runtime.activeRoomProjectPane ? (
        <RoomCoordinationSurface
          accessToken={accessToken}
          isArchived={runtime.isArchived}
          roomName={room.displayName}
          projectId={room.spaceId}
          sourcePaneId={runtime.coordinationPaneId}
          tasks={runtime.coordinationTasks}
          taskError={runtime.taskError}
          taskLoading={runtime.tasksLoading}
          roomMembers={roomMembers}
          isRoomOwner={runtime.isRoomOwner}
          inviteEmail={runtime.inviteEmail}
          inviteNotice={runtime.inviteNotice}
          inviteError={runtime.roomMembersError}
          inviting={runtime.inviting}
          onInviteEmailChange={runtime.onInviteEmailChange}
          onInviteParticipant={runtime.inviteParticipant}
          onRefreshTasks={runtime.refreshRoom}
          onUpdateTaskStatus={runtime.taskMutations.onUpdateTaskStatus}
          onUpdateTaskPriority={runtime.taskMutations.onUpdateTaskPriority}
          onUpdateTaskDueDate={runtime.taskMutations.onUpdateTaskDueDate}
          onUpdateTaskCategory={runtime.taskMutations.onUpdateTaskCategory}
          onDeleteTask={runtime.taskMutations.onDeleteTask}
        />
      ) : (
        <RoomProjectSurface
          accessToken={accessToken}
          canMigrateToSpace={canMigrateRoomContent}
          isArchived={runtime.isArchived}
          roomId={room.id}
          roomName={room.displayName}
          pane={runtime.activeRoomProjectPane}
          project={project}
          projectMembers={runtime.projectMembers}
          roomProjectPanes={runtime.roomProjectPanes}
          sessionUserId={sessionUserId}
          refreshProjectData={runtime.refreshProjectData}
          setPanes={runtime.setPanes}
          timeline={runtime.timeline}
          setTimeline={runtime.setTimeline}
        />
      )}
    </div>
  );
};
