import { useCallback, useRef, type Dispatch, type SetStateAction } from 'react';
import { createRecord } from '../services/hub/records';
import type { HubCollection, HubPaneSummary } from '../services/hub/types';

type TopLevelProjectTab = 'overview' | 'work' | 'tools';

const captureTitleFromIntent = (intent: string | null): string => {
  if (intent === 'project-task') {
    return 'New Task';
  }
  if (intent === 'event') {
    return 'New Event';
  }
  if (intent === 'reminder') {
    return 'New Reminder';
  }
  return 'New Capture';
};

const captureTitleFromSeed = (seedText: string | undefined, intent: string | null): string => {
  if (!seedText || !seedText.trim()) {
    return captureTitleFromIntent(intent);
  }
  const firstLine = seedText
    .split('\n')
    .map((line) => line.trim())
    .find((line) => line.length > 0);
  if (!firstLine) {
    return captureTitleFromIntent(intent);
  }
  if (firstLine.length <= 90) {
    return firstLine;
  }
  return `${firstLine.slice(0, 87)}...`;
};

const selectCaptureCollection = (allCollections: HubCollection[], intent: string | null): HubCollection | null => {
  if (allCollections.length === 0) {
    return null;
  }

  const rankedCollectionIds = new Set<string>();
  const rankByKeywords = (keywords: string[]) => {
    for (const collection of allCollections) {
      const haystack = `${collection.name} ${collection.collection_id}`.toLowerCase();
      if (keywords.some((keyword) => haystack.includes(keyword))) {
        rankedCollectionIds.add(collection.collection_id);
      }
    }
  };

  if (intent === 'project-task') {
    rankByKeywords(['task', 'todo']);
  } else if (intent === 'event') {
    rankByKeywords(['event', 'calendar']);
  } else if (intent === 'reminder') {
    rankByKeywords(['reminder']);
  } else {
    rankByKeywords(['inbox', 'capture', 'note', 'journal']);
  }

  if (rankedCollectionIds.size > 0) {
    const selected = allCollections.find((collection) => rankedCollectionIds.has(collection.collection_id));
    if (selected) {
      return selected;
    }
  }

  return allCollections[0] || null;
};

interface UseQuickCaptureParams {
  accessToken: string;
  projectId: string;
  activeTab: TopLevelProjectTab;
  activePane: HubPaneSummary | null;
  activePaneCanEdit: boolean;
  collections: HubCollection[];
  focusedWorkViewId: string | null;
  openInspector: (recordId: string, options?: { mutationPaneId?: string | null }) => Promise<void>;
  refreshViewsAndRecords: () => Promise<void>;
  setPaneMutationError: Dispatch<SetStateAction<string | null>>;
}

export const useQuickCapture = ({
  accessToken,
  projectId,
  activeTab,
  activePane,
  activePaneCanEdit,
  collections,
  focusedWorkViewId,
  openInspector,
  refreshViewsAndRecords,
  setPaneMutationError,
}: UseQuickCaptureParams) => {
  const quickCaptureInFlightRef = useRef(false);

  const createAndOpenCaptureRecord = useCallback(
    async (intent: string | null, seedText?: string) => {
      if (quickCaptureInFlightRef.current) {
        return false;
      }
      const shouldUsePaneContext = activeTab === 'work';
      if (shouldUsePaneContext && !activePane) {
        setPaneMutationError('Open a pane before creating pane-local structured work.');
        return false;
      }
      if (shouldUsePaneContext && !activePaneCanEdit) {
        setPaneMutationError('Read-only pane. Only pane editors can create pane-originated structured work.');
        return false;
      }
      if (collections.length === 0) {
        setPaneMutationError('No collection available for quick capture in this project.');
        return false;
      }

      quickCaptureInFlightRef.current = true;
      const targetCollection = selectCaptureCollection(collections, intent);
      if (!targetCollection) {
        setPaneMutationError('No collection available for quick capture in this project.');
        quickCaptureInFlightRef.current = false;
        return false;
      }

      let created: { record_id: string };
      try {
        created = await createRecord(accessToken, projectId, {
          collection_id: targetCollection.collection_id,
          title: captureTitleFromSeed(seedText, intent),
          source_pane_id: shouldUsePaneContext ? activePane?.pane_id : undefined,
          source_view_id: shouldUsePaneContext ? focusedWorkViewId ?? undefined : undefined,
          ...(intent === 'project-task'
            ? {
                capability_types: ['task'],
                task_state: {
                  status: 'todo',
                  priority: null,
                },
              }
            : {}),
        });
      } catch (error) {
        quickCaptureInFlightRef.current = false;
        setPaneMutationError(error instanceof Error ? error.message : 'Failed to create quick capture record.');
        return false;
      }

      try {
        await refreshViewsAndRecords();
        await openInspector(created.record_id);
      } catch (error) {
        setPaneMutationError(error instanceof Error ? error.message : 'Quick capture created, but follow-up UI refresh failed.');
      } finally {
        quickCaptureInFlightRef.current = false;
      }
      return true;
    },
    [
      accessToken,
      activePane,
      activePaneCanEdit,
      activeTab,
      collections,
      focusedWorkViewId,
      openInspector,
      projectId,
      refreshViewsAndRecords,
      setPaneMutationError,
    ],
  );

  return {
    createAndOpenCaptureRecord,
    quickCaptureInFlightRef,
  };
};
