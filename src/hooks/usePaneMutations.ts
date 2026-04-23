import { useCallback, useState, type Dispatch, type SetStateAction } from 'react';

import {
  addPaneMember,
  createPane,
  deletePane,
  listPanes,
  removePaneMember,
  updatePane,
} from '../services/hub/panes';
import { buildDefaultPaneCreatePayload } from '../lib/paneTemplates';
import { listTimeline } from '../services/hub/records';
import type { HubPaneSummary } from '../services/hub/types';

type ProjectTimelineItem = {
  timeline_event_id: string;
  event_type: string;
  primary_entity_type: string;
  primary_entity_id: string;
  summary_json: Record<string, unknown>;
  created_at: string;
};

interface UsePaneMutationsParams {
  accessToken: string;
  projectId: string;
  panes: HubPaneSummary[];
  refreshProjectData: () => Promise<void>;
  setPanes: Dispatch<SetStateAction<HubPaneSummary[]>>;
  sessionUserId: string;
  setTimeline: Dispatch<SetStateAction<ProjectTimelineItem[]>>;
}

const comparePanesBySidebarOrder = (left: HubPaneSummary, right: HubPaneSummary) => {
  const leftPosition = left.position ?? Number.MAX_SAFE_INTEGER;
  const rightPosition = right.position ?? Number.MAX_SAFE_INTEGER;
  if (leftPosition !== rightPosition) {
    return leftPosition - rightPosition;
  }
  return (left.sort_order ?? Number.MAX_SAFE_INTEGER) - (right.sort_order ?? Number.MAX_SAFE_INTEGER);
};

export const usePaneMutations = ({
  accessToken,
  projectId,
  panes,
  refreshProjectData,
  setPanes,
  sessionUserId,
  setTimeline,
}: UsePaneMutationsParams) => {
  const [paneMutationError, setPaneMutationError] = useState<string | null>(null);

  const updatePaneInState = useCallback(
    (nextPane: HubPaneSummary) => {
      setPanes((current) => current.map((pane) => (pane.pane_id === nextPane.pane_id ? nextPane : pane)));
    },
    [setPanes],
  );

  const onCreatePane = useCallback(
    async (creatingPaneName: string): Promise<HubPaneSummary | null> => {
      const trimmed = creatingPaneName.trim();
      if (!trimmed) {
        setPaneMutationError('Project name is required.');
        return null;
      }

      setPaneMutationError(null);
      try {
        const nextPane = await createPane(
          accessToken,
          projectId,
          buildDefaultPaneCreatePayload({
            existingPanes: panes,
            name: trimmed,
            sessionUserId,
          }),
        );

        setPanes((current) =>
          [...current, nextPane].sort(comparePanesBySidebarOrder),
        );
        try {
          await refreshProjectData();
          const nextTimeline = await listTimeline(accessToken, projectId);
          setTimeline(nextTimeline);
        } catch (error) {
          setPaneMutationError(
            `Project created, but follow-up refresh failed: ${error instanceof Error ? error.message : 'unknown error'}`,
          );
        }
        return nextPane;
      } catch (error) {
        setPaneMutationError(error instanceof Error ? error.message : 'Failed to create project.');
        return null;
      }
    },
    [accessToken, panes, projectId, refreshProjectData, sessionUserId, setPanes, setTimeline],
  );

  const onRenamePane = useCallback(
    async (pane: HubPaneSummary, nextName: string) => {
      const trimmed = nextName.trim();
      if (!trimmed || trimmed === pane.name) {
        return;
      }

      try {
        const updated = await updatePane(accessToken, pane.pane_id, {
          name: trimmed,
        });
        updatePaneInState(updated);
        const nextTimeline = await listTimeline(accessToken, projectId);
        setTimeline(nextTimeline);
      } catch (error) {
        setPaneMutationError(error instanceof Error ? error.message : 'Failed to rename project.');
      }
    },
    [accessToken, projectId, setTimeline, updatePaneInState],
  );

  const onMovePane = useCallback(
    async (pane: HubPaneSummary, direction: 'up' | 'down') => {
      const ordered = [...panes].sort(
        comparePanesBySidebarOrder,
      );
      const index = ordered.findIndex((entry) => entry.pane_id === pane.pane_id);
      if (index < 0) {
        return;
      }

      const nextIndex = direction === 'up' ? index - 1 : index + 1;
      if (nextIndex < 0 || nextIndex >= ordered.length) {
        return;
      }

      const target = ordered[nextIndex];
      const originalOrder = pane.position ?? pane.sort_order;
      const targetOrder = target.position ?? target.sort_order;
      try {
        await updatePane(accessToken, pane.pane_id, { sort_order: targetOrder, position: targetOrder });
        try {
          await updatePane(accessToken, target.pane_id, { sort_order: originalOrder, position: originalOrder });
        } catch (error) {
          try {
            await updatePane(accessToken, pane.pane_id, { sort_order: originalOrder, position: originalOrder });
          } catch {
            // best-effort rollback
          }
          setPaneMutationError(error instanceof Error ? error.message : 'Failed to reorder projects.');
          return;
        }
      } catch (error) {
        setPaneMutationError(error instanceof Error ? error.message : 'Failed to reorder projects.');
        return;
      } finally {
        try {
          await refreshProjectData();
        } catch (refreshError) {
          console.warn('Pane refresh failed after reorder:', refreshError);
        }
      }
    },
    [accessToken, panes, refreshProjectData],
  );

  const onTogglePinned = useCallback(
    async (pane: HubPaneSummary) => {
      try {
        const updated = await updatePane(accessToken, pane.pane_id, { pinned: !pane.pinned });
        updatePaneInState(updated);
      } catch (error) {
        setPaneMutationError(error instanceof Error ? error.message : 'Failed to toggle pin state.');
      }
    },
    [accessToken, updatePaneInState],
  );

  const onDeletePane = useCallback(
    async (pane: HubPaneSummary, activePaneId: string | null): Promise<string | null> => {
      try {
        await deletePane(accessToken, pane.pane_id);
        const remaining = panes.filter((entry) => entry.pane_id !== pane.pane_id);
        setPanes(() => remaining);
        if (activePaneId === pane.pane_id) {
          const fallback = remaining[0];
          return fallback
            ? `/projects/${encodeURIComponent(projectId)}/work/${encodeURIComponent(fallback.pane_id)}`
            : `/projects/${encodeURIComponent(projectId)}/overview`;
        }
        return null;
      } catch (error) {
        setPaneMutationError(error instanceof Error ? error.message : 'Failed to delete project.');
        return null;
      }
    },
    [accessToken, panes, projectId, setPanes],
  );

  const onTogglePaneMember = useCallback(
    async (pane: HubPaneSummary, userId: string) => {
      try {
        const isMember = pane.members.some((member) => member.user_id === userId);
        if (isMember) {
          await removePaneMember(accessToken, pane.pane_id, userId);
        } else {
          await addPaneMember(accessToken, pane.pane_id, userId);
        }

        const refreshed = await listPanes(accessToken, projectId);
        setPanes([...refreshed].sort(comparePanesBySidebarOrder));
      } catch (error) {
        setPaneMutationError(error instanceof Error ? error.message : 'Failed to update project members.');
      }
    },
    [accessToken, projectId, setPanes],
  );

  const onUpdatePaneFromWorkView = useCallback(
    async (
      paneIdToUpdate: string,
      payload: { name?: string; pinned?: boolean; sort_order?: number; position?: number | null; layout_config?: Record<string, unknown> },
    ) => {
      setPaneMutationError(null);
      try {
        const updated = await updatePane(accessToken, paneIdToUpdate, payload);
        updatePaneInState(updated);
        try {
          const nextTimeline = await listTimeline(accessToken, projectId);
          setTimeline(nextTimeline);
        } catch (error) {
          setPaneMutationError(
            `Project updated, but timeline refresh failed: ${error instanceof Error ? error.message : 'unknown error'}.`,
          );
        }
      } catch (error) {
        setPaneMutationError(error instanceof Error ? error.message : 'Failed to update project.');
      }
    },
    [accessToken, projectId, setTimeline, updatePaneInState],
  );

  return {
    paneMutationError,
    setPaneMutationError,
    onCreatePane,
    onRenamePane,
    onMovePane,
    onTogglePinned,
    onDeletePane,
    onTogglePaneMember,
    onUpdatePaneFromWorkView,
  };
};
