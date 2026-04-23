import { useMemo, useRef, useState } from 'react';

import { CalendarTab, type CalendarTimeView } from '../../../components/project-space/CalendarTab';
import { Panel } from '../../../components/layout/Panel';
import { TaskCreateDialog } from '../../../components/project-space/TaskCreateDialog';
import { TasksTab, type SortChain } from '../../../components/project-space/TasksTab';
import { TimelineTab } from '../../../components/project-space/TimelineTab';
import { Button, InlineNotice } from '../../../components/primitives';
import type { HubTaskSummary } from '../../../services/hub/types';
import { adaptTaskSummaries } from '../../../components/project-space/taskAdapter';
import {
  buildTaskCalendarEvents,
  buildTaskCategoryOptions,
  buildTaskCollaboratorOptions,
  buildTaskTimelineClusters,
  type RoomMemberOption,
} from '../taskModel';

interface RoomCoordinationSurfaceProps {
  accessToken: string;
  isArchived: boolean;
  roomName: string;
  projectId: string;
  tasks: HubTaskSummary[];
  taskError: string | null;
  taskLoading: boolean;
  roomMembers: Array<RoomMemberOption & { role: 'owner' | 'participant' }>;
  isRoomOwner: boolean;
  inviteEmail: string;
  inviteNotice: string | null;
  inviteError: string | null;
  inviting: boolean;
  onInviteEmailChange: (value: string) => void;
  onInviteParticipant: () => Promise<boolean>;
  onRefreshTasks: () => Promise<void>;
  onUpdateTaskStatus: (taskId: string, status: 'todo' | 'in_progress' | 'done' | 'cancelled') => Promise<void>;
  onUpdateTaskPriority: (taskId: string, priority: 'low' | 'medium' | 'high' | 'urgent' | null) => Promise<void>;
  onUpdateTaskDueDate: (taskId: string, dueAt: string | null) => Promise<void>;
  onUpdateTaskCategory: (taskId: string, category: string | null) => Promise<void>;
  onDeleteTask: (taskId: string) => Promise<void>;
}

export const RoomCoordinationSurface = ({
  accessToken,
  isArchived,
  roomName,
  projectId,
  tasks,
  taskError,
  taskLoading,
  roomMembers,
  isRoomOwner,
  inviteEmail,
  inviteNotice,
  inviteError,
  inviting,
  onInviteEmailChange,
  onInviteParticipant,
  onRefreshTasks,
  onUpdateTaskStatus,
  onUpdateTaskPriority,
  onUpdateTaskDueDate,
  onUpdateTaskCategory,
  onDeleteTask,
}: RoomCoordinationSurfaceProps) => {
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [sortChain, setSortChain] = useState<SortChain>(['date', 'priority', 'category']);
  const [activeUserId, setActiveUserId] = useState('all');
  const [activeCategoryId, setActiveCategoryId] = useState('all');
  const [calendarTimeView, setCalendarTimeView] = useState<CalendarTimeView>('month');
  const coordinationTaskItems = useMemo(() => adaptTaskSummaries(tasks), [tasks]);
  const collaboratorOptions = useMemo(() => buildTaskCollaboratorOptions(roomMembers), [roomMembers]);
  const categoryOptions = useMemo(() => buildTaskCategoryOptions(coordinationTaskItems), [coordinationTaskItems]);
  const timelineClusters = useMemo(() => buildTaskTimelineClusters(coordinationTaskItems), [coordinationTaskItems]);
  const calendarEvents = useMemo(() => buildTaskCalendarEvents(coordinationTaskItems), [coordinationTaskItems]);

  return (
    <div className="space-y-4">
      {isArchived ? (
        <InlineNotice variant="warning" title="Archived room">
          This room is now a read-only snapshot. Room coordination tasks and membership changes are disabled.
        </InlineNotice>
      ) : null}

      <Panel title="Coordination Tasks" description={`Shared room-level tasks for ${roomName}.`}>
        <div className="space-y-4">
          {!isArchived ? (
            <div className="flex justify-end">
              <Button
                ref={triggerRef}
                type="button"
                onClick={() => setCreateOpen(true)}
                variant="secondary"
              >
                Add Task
              </Button>
            </div>
          ) : null}
          {taskError ? (
            <InlineNotice variant="danger" title="Coordination tasks unavailable">
              {taskError}
            </InlineNotice>
          ) : null}
          {taskLoading ? <p className="text-sm text-muted">Loading room tasks...</p> : null}
          {!taskLoading ? (
            <TasksTab
              tasks={coordinationTaskItems}
              collaborators={collaboratorOptions}
              categories={categoryOptions}
              activeUserId={activeUserId}
              activeCategoryId={activeCategoryId}
              sortChain={sortChain}
              onSortChainChange={setSortChain}
              onUserChange={setActiveUserId}
              onCategoryChange={setActiveCategoryId}
              onUpdateTaskStatus={isArchived ? undefined : onUpdateTaskStatus}
              onUpdateTaskPriority={isArchived ? undefined : onUpdateTaskPriority}
              onUpdateTaskDueDate={isArchived ? undefined : onUpdateTaskDueDate}
              onUpdateTaskCategory={isArchived ? undefined : onUpdateTaskCategory}
              onDeleteTask={isArchived ? undefined : onDeleteTask}
              showSortControls
            />
          ) : null}
        </div>
      </Panel>

      <Panel title="Timeline" description="Task due dates and milestones across the room.">
        {timelineClusters.length > 0 ? (
          <TimelineTab clusters={timelineClusters} />
        ) : (
          <p className="text-sm text-muted">No room-level due dates yet.</p>
        )}
      </Panel>

      <Panel title="Calendar" description="Room-level deadlines displayed on a calendar.">
        <CalendarTab
          events={calendarEvents}
          collaborators={collaboratorOptions}
          categories={categoryOptions}
          timeView={calendarTimeView}
          activeUserId={activeUserId}
          activeCategoryId={activeCategoryId}
          onTimeViewChange={setCalendarTimeView}
          onUserChange={setActiveUserId}
          onCategoryChange={setActiveCategoryId}
        />
      </Panel>

      <Panel title="Participants" description="People currently collaborating in this room.">
        <div className="space-y-4">
          <ul className="space-y-2" aria-label="Room participants">
            {roomMembers.map((member) => (
              <li key={member.id} className="flex items-center justify-between gap-3 rounded-control border border-border-muted bg-surface px-3 py-2">
                <span className="text-sm text-text">{member.label}</span>
                <span className="rounded-full border border-border-muted bg-surface-elevated px-2 py-1 text-xs font-medium text-muted">
                  {member.role}
                </span>
              </li>
            ))}
          </ul>

          {isArchived ? (
            <p className="text-sm text-muted">Archived rooms cannot accept new participants.</p>
          ) : isRoomOwner ? (
            <form
              className="space-y-2"
              onSubmit={(event) => {
                event.preventDefault();
                void onInviteParticipant();
              }}
            >
              <label className="block text-xs font-medium uppercase tracking-wide text-muted" htmlFor="room-participant-email">
                Add participant by email
              </label>
              <div className="flex flex-wrap gap-2">
                <input
                  id="room-participant-email"
                  type="email"
                  value={inviteEmail}
                  onChange={(event) => onInviteEmailChange(event.target.value)}
                  className="min-w-[16rem] flex-1 rounded-control border border-border-muted bg-surface px-3 py-2 text-sm text-text"
                />
                <Button
                  type="submit"
                  variant="secondary"
                  loading={inviting}
                  loadingLabel="Adding"
                >
                  Add participant
                </Button>
              </div>
              {inviteNotice ? <p className="text-sm text-success">{inviteNotice}</p> : null}
              {inviteError ? <p role="alert" className="text-sm text-danger">{inviteError}</p> : null}
            </form>
          ) : (
            <p className="text-sm text-muted">Only the room owner can add participants.</p>
          )}
        </div>
      </Panel>

      {!isArchived ? (
        <TaskCreateDialog
          open={createOpen}
          onClose={() => setCreateOpen(false)}
          onCreated={() => {
            void onRefreshTasks();
          }}
          accessToken={accessToken}
          projectId={projectId}
          projectMembers={roomMembers.map((member) => ({
            display_name: member.label,
            user_id: member.id,
          }))}
          triggerRef={triggerRef}
        />
      ) : null}
    </div>
  );
};
