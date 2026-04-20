import { useCallback, useEffect, useRef, useState, type MutableRefObject } from 'react';
import { getRecordDetail } from '../../services/hub/records';
import type { HubRecordDetail } from '../../services/hub/types';
import { subscribeHubLive } from '../../services/hubLive';

const resolveFocusRestoreTarget = (candidate: HTMLElement | null): HTMLElement | null => {
  if (candidate && candidate.isConnected) {
    return candidate;
  }
  const mainContent = document.getElementById('main-content');
  if (mainContent instanceof HTMLElement) {
    if (!mainContent.hasAttribute('tabindex')) {
      mainContent.setAttribute('tabindex', '-1');
    }
    return mainContent;
  }
  return null;
};

const getActiveFocusTarget = (): HTMLElement | null => {
  if (document.activeElement instanceof HTMLElement && document.activeElement !== document.body) {
    return document.activeElement;
  }
  return resolveFocusRestoreTarget(null);
};

const readElementRect = (element: HTMLElement | null): { top: number; left: number; width: number; height: number } | null => {
  if (!element || !element.isConnected) {
    return null;
  }
  const rect = element.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) {
    return null;
  }
  return {
    top: rect.top,
    left: rect.left,
    width: rect.width,
    height: rect.height,
  };
};

interface UseHomeRecordInspectorParams {
  accessToken: string | null | undefined;
}

export interface HomeRecordInspectorRuntime {
  closeRecord: () => void;
  openRecord: (recordId: string) => void;
  selectedRecord: HubRecordDetail | null;
  selectedRecordError: string | null;
  selectedRecordId: string | null;
  selectedRecordLoading: boolean;
  selectedRecordTriggerRect: { top: number; left: number; width: number; height: number } | null;
  selectedRecordTriggerRef: MutableRefObject<HTMLElement | null>;
}

export const useHomeRecordInspectorRuntime = ({ accessToken }: UseHomeRecordInspectorParams): HomeRecordInspectorRuntime => {
  const [selectedRecordId, setSelectedRecordId] = useState<string | null>(null);
  const [selectedRecord, setSelectedRecord] = useState<HubRecordDetail | null>(null);
  const [selectedRecordLoading, setSelectedRecordLoading] = useState(false);
  const [selectedRecordError, setSelectedRecordError] = useState<string | null>(null);
  const [selectedRecordTriggerRect, setSelectedRecordTriggerRect] = useState<{
    top: number;
    left: number;
    width: number;
    height: number;
  } | null>(null);

  const selectedRecordAbortControllerRef = useRef<AbortController | null>(null);
  const selectedRecordRequestIdRef = useRef(0);
  const selectedRecordIdRef = useRef<string | null>(null);
  const selectedRecordTriggerRef = useRef<HTMLElement | null>(null);

  const refreshSelectedRecord = useCallback(
    async (recordId: string | null) => {
      selectedRecordAbortControllerRef.current?.abort();
      selectedRecordAbortControllerRef.current = null;
      const requestId = selectedRecordRequestIdRef.current + 1;
      selectedRecordRequestIdRef.current = requestId;

      if (!accessToken || !recordId) {
        setSelectedRecord(null);
        setSelectedRecordError(null);
        setSelectedRecordLoading(false);
        return;
      }

      const controller = new AbortController();
      selectedRecordAbortControllerRef.current = controller;
      setSelectedRecord(null);
      setSelectedRecordError(null);
      setSelectedRecordLoading(true);
      try {
        const record = await getRecordDetail(accessToken, recordId, {
          signal: controller.signal,
        });
        if (
          controller.signal.aborted
          || selectedRecordAbortControllerRef.current !== controller
          || selectedRecordRequestIdRef.current !== requestId
        ) {
          return;
        }
        setSelectedRecord(record);
        setSelectedRecordError(null);
      } catch (error) {
        if (
          controller.signal.aborted
          || selectedRecordAbortControllerRef.current !== controller
          || selectedRecordRequestIdRef.current !== requestId
        ) {
          return;
        }
        setSelectedRecord(null);
        setSelectedRecordError(error instanceof Error ? error.message : 'Failed to load record.');
      } finally {
        if (selectedRecordAbortControllerRef.current === controller && selectedRecordRequestIdRef.current === requestId) {
          selectedRecordAbortControllerRef.current = null;
          setSelectedRecordLoading(false);
        }
      }
    },
    [accessToken],
  );

  useEffect(() => () => {
    selectedRecordAbortControllerRef.current?.abort();
    selectedRecordAbortControllerRef.current = null;
    selectedRecordRequestIdRef.current += 1;
  }, []);

  useEffect(() => {
    void refreshSelectedRecord(selectedRecordId);
  }, [refreshSelectedRecord, selectedRecordId]);

  useEffect(() => {
    selectedRecordIdRef.current = selectedRecordId;
  }, [selectedRecordId]);

  useEffect(() => {
    if (!accessToken) {
      return;
    }

    return subscribeHubLive(accessToken, (message) => {
      if (message.type !== 'task.changed' || message.task.record_id !== selectedRecordIdRef.current) {
        return;
      }
      void refreshSelectedRecord(selectedRecordIdRef.current);
    });
  }, [accessToken, refreshSelectedRecord]);

  const openRecord = useCallback((recordId: string) => {
    selectedRecordTriggerRef.current = getActiveFocusTarget();
    setSelectedRecordTriggerRect(readElementRect(selectedRecordTriggerRef.current));
    selectedRecordIdRef.current = recordId;
    setSelectedRecordId(recordId);
  }, []);

  const closeRecord = useCallback(() => {
    selectedRecordTriggerRef.current = resolveFocusRestoreTarget(selectedRecordTriggerRef.current);
    selectedRecordAbortControllerRef.current?.abort();
    selectedRecordAbortControllerRef.current = null;
    selectedRecordRequestIdRef.current += 1;
    selectedRecordIdRef.current = null;
    setSelectedRecordId(null);
    setSelectedRecord(null);
    setSelectedRecordError(null);
    setSelectedRecordLoading(false);
  }, []);

  return {
    closeRecord,
    openRecord,
    selectedRecord,
    selectedRecordError,
    selectedRecordId,
    selectedRecordLoading,
    selectedRecordTriggerRect,
    selectedRecordTriggerRef,
  };
};
