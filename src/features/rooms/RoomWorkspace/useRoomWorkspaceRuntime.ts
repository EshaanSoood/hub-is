import { useMemo } from 'react';

import { adaptTaskSummaries } from '../../../components/project-space/taskAdapter';
import { useProjectBootstrap } from '../../../hooks/useProjectBootstrap';
import { useRoom } from '../hooks/useRoom';
import { useRoomMembers } from '../hooks/useRoomMembers';
import { useRoomTaskMutations } from '../hooks/useRoomTaskMutations';
import { useRoomTaskSummaries } from '../hooks/useRoomTaskSummaries';
import { parseRoomProjectPaneIdParam } from '../navigation';
import { getRoomProjectPanes } from '../paneModel';

interface UseRoomWorkspaceRuntimeParams {
  accessToken: string;
  roomId: string;
  roomProjectPaneId?: string;
  sessionUserId: string;
}

const memberLabel = (
  memberUserId: string,
  projectMembers: Array<{ user_id: string; display_name: string }>,
): string =>
  projectMembers.find((member) => member.user_id === memberUserId)?.display_name || memberUserId;

const toVoidPromise = async <T,>(operation: () => Promise<T>): Promise<void> => {
  await operation();
};

export const useRoomWorkspaceRuntime = ({
  accessToken,
  roomId,
  roomProjectPaneId,
  sessionUserId,
}: UseRoomWorkspaceRuntimeParams) => {
  const {
    archiveRoom,
    archiving,
    error: roomError,
    loading: roomLoading,
    refreshRoom,
    room,
  } = useRoom({
    accessToken,
    roomId,
  });
  const {
    error: roomMembersError,
    inviteEmail,
    inviteNotice,
    inviteParticipant,
    inviting,
    loading: roomMembersLoading,
    members,
    onInviteEmailChange,
    refreshRoomMembers,
  } = useRoomMembers({
    accessToken,
    roomId,
  });
  const {
    error: spaceError,
    loading: spaceLoading,
    panes,
    project,
    projectMembers,
    refreshProjectData,
    setPanes,
    setTimeline,
    timeline,
  } = useProjectBootstrap({
    accessToken,
    projectId: room?.spaceId || '',
  });
  const {
    error: tasksError,
    loading: tasksLoading,
    refreshTasks,
    tasks,
  } = useRoomTaskSummaries({
    accessToken,
    projectId: room?.spaceId || '',
  });
  const taskMutations = useRoomTaskMutations({
    accessToken,
    onTasksChanged: () => toVoidPromise(refreshTasks),
  });

  const roomProjectPanes = useMemo(
    () => getRoomProjectPanes(panes, roomId),
    [panes, roomId],
  );
  const parsedPaneId = parseRoomProjectPaneIdParam(roomProjectPaneId);
  const activeRoomProjectPane = useMemo(
    () => roomProjectPanes.find((pane) => pane.pane_id === parsedPaneId) || null,
    [parsedPaneId, roomProjectPanes],
  );
  const coordinationTasks = useMemo(
    () => tasks.filter((task) => !task.source_pane?.pane_id),
    [tasks],
  );
  const activePaneTasks = useMemo(
    () => (
      activeRoomProjectPane
        ? tasks.filter((task) => task.source_pane?.pane_id === activeRoomProjectPane.pane_id)
        : []
    ),
    [activeRoomProjectPane, tasks],
  );
  const roomMemberOptions = useMemo(
    () => members.map((member) => ({
      id: member.userId,
      label: memberLabel(member.userId, projectMembers),
      role: member.role,
    })),
    [members, projectMembers],
  );
  const roomMemberUserIds = useMemo(
    () => new Set(members.map((member) => member.userId)),
    [members],
  );
  const roomProjectMembers = useMemo(
    () => projectMembers.filter((member) => roomMemberUserIds.has(member.user_id)),
    [projectMembers, roomMemberUserIds],
  );
  const isArchived = room?.status === 'archived';
  const isRoomOwner = members.some((member) => member.userId === sessionUserId && member.role === 'owner');
  const isParentSpaceMember = Boolean(project?.membership_role);

  return {
    activeRoomProjectPane,
    activePaneTaskItems: adaptTaskSummaries(activePaneTasks),
    activePaneTasks,
    archiveRoom,
    archivingRoom: archiving,
    coordinationTaskItems: adaptTaskSummaries(coordinationTasks),
    coordinationTasks,
    error: roomError || roomMembersError || spaceError || tasksError,
    inviteEmail,
    inviteNotice,
    inviteParticipant,
    inviting,
    isArchived,
    isParentSpaceMember,
    isRoomOwner,
    loading: roomLoading || roomMembersLoading || spaceLoading || tasksLoading,
    onInviteEmailChange,
    project,
    projectMembers: roomProjectMembers,
    refreshProjectData,
    roomMembersError,
    refreshRoom: async () => {
      await Promise.all([refreshRoom(), refreshRoomMembers(), refreshTasks()]);
    },
    room,
    roomMemberOptions,
    roomProjectPanes,
    setPanes,
    setTimeline,
    taskError: tasksError,
    taskMutations,
    tasksLoading,
    timeline,
  };
};
