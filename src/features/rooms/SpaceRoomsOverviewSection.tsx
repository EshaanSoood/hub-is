import { useId, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';

import { useProjects } from '../../context/ProjectsContext';
import type { CalendarEventSummary } from '../../components/project-space/CalendarModuleSkin/types';
import { Button, InlineNotice } from '../../components/primitives';
import type { TimelineEvent } from '../../pages/ProjectSpacePage/ProjectSpaceWorkspace/types';
import type { HubPaneSummary, HubTaskSummary } from '../../services/hub/types';
import { buildRoomHref } from './navigation';
import { getRoomProjectPanes } from './paneModel';
import { useRooms } from './hooks/useRooms';
import { CreateRoomDialog } from './CreateRoomDialog';

interface SpaceRoomsOverviewSectionProps {
  accessToken: string;
  projectId: string;
  panes: HubPaneSummary[];
  tasks: HubTaskSummary[];
  calendarEvents: CalendarEventSummary[];
  timeline: TimelineEvent[];
}

interface SpaceRoomListItem {
  id: string;
  displayName: string;
  participantCount: number;
  lastActivityAt: string;
}

const formatParticipantCount = (count: number): string =>
  `${count} participant${count === 1 ? '' : 's'}`;

const formatRelativeActivity = (isoString: string): string => {
  const stamp = Date.parse(isoString);
  if (!Number.isFinite(stamp)) {
    return 'just now';
  }

  const deltaSeconds = Math.round((stamp - Date.now()) / 1000);
  const absoluteSeconds = Math.abs(deltaSeconds);
  const formatter = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });

  if (absoluteSeconds < 60) {
    return formatter.format(Math.round(deltaSeconds), 'second');
  }
  if (absoluteSeconds < 3_600) {
    return formatter.format(Math.round(deltaSeconds / 60), 'minute');
  }
  if (absoluteSeconds < 86_400) {
    return formatter.format(Math.round(deltaSeconds / 3_600), 'hour');
  }
  if (absoluteSeconds < 604_800) {
    return formatter.format(Math.round(deltaSeconds / 86_400), 'day');
  }
  return formatter.format(Math.round(deltaSeconds / 604_800), 'week');
};

const readTimelineSourcePaneId = (item: TimelineEvent): string | null => {
  const sourcePaneId = item.summary_json?.source_pane_id;
  return typeof sourcePaneId === 'string' && sourcePaneId.trim() ? sourcePaneId : null;
};

const latestIsoTimestamp = (timestamps: string[]): string | null => {
  let latestStamp = -Infinity;
  let latestValue: string | null = null;

  for (const value of timestamps) {
    const stamp = Date.parse(value);
    if (!Number.isFinite(stamp) || stamp <= latestStamp) {
      continue;
    }
    latestStamp = stamp;
    latestValue = value;
  }

  return latestValue;
};

export const SpaceRoomsOverviewSection = ({
  accessToken,
  projectId,
  panes,
  tasks,
  calendarEvents,
  timeline,
}: SpaceRoomsOverviewSectionProps) => {
  const { projects } = useProjects();
  const { createRoom, error, loading, rooms } = useRooms({ accessToken });
  const headingId = useId();
  const descriptionId = useId();
  const createTriggerRef = useRef<HTMLButtonElement | null>(null);

  const activeRooms = useMemo<SpaceRoomListItem[]>(
    () => rooms
      .filter((room) => room.status === 'active' && room.spaceId === projectId)
      .map((room) => {
        const roomPaneIds = new Set(getRoomProjectPanes(panes, room.id).map((pane) => pane.pane_id));
        const activityCandidates = [
          room.createdAt,
          ...tasks
            .filter((task) => task.source_pane?.pane_id && roomPaneIds.has(task.source_pane.pane_id))
            .flatMap((task) => [task.updated_at, task.task_state.updated_at]),
          ...calendarEvents
            .filter((event) => event.source_pane?.pane_id && roomPaneIds.has(event.source_pane.pane_id))
            .flatMap((event) => [event.event_state.updated_at]),
          ...timeline
            .filter((item) => {
              const sourcePaneId = readTimelineSourcePaneId(item);
              return Boolean(sourcePaneId && roomPaneIds.has(sourcePaneId));
            })
            .map((item) => item.created_at),
        ];
        return {
          id: room.id,
          displayName: room.displayName,
          participantCount: room.memberUserIds.length,
          lastActivityAt: latestIsoTimestamp(activityCandidates) ?? room.createdAt,
        };
      })
      .sort((left, right) => Date.parse(right.lastActivityAt) - Date.parse(left.lastActivityAt)),
    [calendarEvents, panes, projectId, rooms, tasks, timeline],
  );

  return (
    <section
      aria-labelledby={headingId}
      aria-describedby={descriptionId}
      className="rounded-panel border border-subtle bg-elevated p-4"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h2 id={headingId} className="text-sm font-semibold text-text">Rooms</h2>
          <p id={descriptionId} className="text-sm text-muted">
            Use Rooms to invite collaborators not part of your team.
          </p>
        </div>

        <CreateRoomDialog
          accessToken={accessToken}
          onCreateRoom={createRoom}
          projectOptions={projects}
          triggerRef={createTriggerRef}
          initialSpaceId={projectId}
          renderTrigger={({ disabled, onOpen, triggerRef: nextTriggerRef }) => (
            <Button
              ref={nextTriggerRef}
              type="button"
              variant="secondary"
              size="sm"
              disabled={disabled}
              onClick={onOpen}
              aria-label="Create room for this space"
            >
              Create Room
            </Button>
          )}
        />
      </div>

      {error ? (
        <div className="mt-3">
          <InlineNotice variant="danger" title="Rooms unavailable">
            {error}
          </InlineNotice>
        </div>
      ) : null}

      {!error ? (
        loading ? (
          <p className="mt-3 text-sm text-muted" role="status" aria-live="polite">Loading rooms…</p>
        ) : activeRooms.length > 0 ? (
          <ul className="mt-3 space-y-2" aria-label="Active rooms for this space">
            {activeRooms.map((room) => (
              <li key={room.id}>
                <Link
                  to={buildRoomHref(room.id)}
                  className="block rounded-control border border-border-muted bg-surface px-3 py-2 transition-colors hover:border-primary hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
                  aria-label={`Open room ${room.displayName}`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-sm font-medium text-text">{room.displayName}</span>
                    <span className="text-xs text-muted">Last activity {formatRelativeActivity(room.lastActivityAt)}</span>
                  </div>
                  <p className="mt-1 text-xs text-muted">{formatParticipantCount(room.participantCount)}</p>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-muted">
            No active rooms for this space yet.
          </p>
        )
      ) : null}
    </section>
  );
};
