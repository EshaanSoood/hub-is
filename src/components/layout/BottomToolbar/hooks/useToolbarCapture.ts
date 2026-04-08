import { useCallback, useEffect, useMemo, useRef, useState, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';
import { getHubHome } from '../../../../services/hub/records';
import type { ProjectRecord } from '../../../../types/domain';
import { useCapturePanelEffects } from './useCapturePanelEffects';

interface CaptureHomeData {
  personalProjectId: string | null;
  captures: Awaited<ReturnType<typeof getHubHome>>['captures'];
}

export type ToolbarCaptureHomeData = CaptureHomeData;

interface UseToolbarCaptureArgs {
  accessToken: string | null | undefined;
  projects: ProjectRecord[];
  currentProjectId: string | null;
  setCaptureAnnouncement: Dispatch<SetStateAction<string>>;
}

export interface UseToolbarCaptureResult {
  captureOpen: boolean;
  setCaptureOpen: Dispatch<SetStateAction<boolean>>;
  captureTriggerRef: MutableRefObject<HTMLButtonElement | null>;
  captureRestoreTargetRef: MutableRefObject<HTMLElement | null>;
  skipCaptureFocusRestoreRef: MutableRefObject<boolean>;
  captureHomeData: CaptureHomeData;
  captureLoading: boolean;
  preferredCaptureProjectId: string | null;
  defaultTaskProjectId: string;
  captureIntent: string | null;
  captureActivationKey: number;
  refreshCaptureData: () => Promise<ToolbarCaptureHomeData>;
  closeCapturePanel: (options?: { restoreFocus?: boolean }) => void;
  openCapturePanel: (intent: string | null, restoreTarget?: HTMLElement | null) => void;
  onQuickCapture: () => void;
}

const EMPTY_CAPTURE_HOME_DATA: ToolbarCaptureHomeData = {
  personalProjectId: null,
  captures: [],
};

export const useToolbarCapture = ({
  accessToken,
  projects,
  currentProjectId,
  setCaptureAnnouncement,
}: UseToolbarCaptureArgs): UseToolbarCaptureResult => {
  const [captureOpen, setCaptureOpen] = useState(false);
  const [captureIntent, setCaptureIntent] = useState<string | null>(null);
  const [captureActivationKey, setCaptureActivationKey] = useState(0);
  const [captureHomeData, setCaptureHomeData] = useState<CaptureHomeData>(EMPTY_CAPTURE_HOME_DATA);
  const [captureLoading, setCaptureLoading] = useState(false);

  const captureTriggerRef = useRef<HTMLButtonElement | null>(null);
  const captureRestoreTargetRef = useRef<HTMLElement | null>(null);
  const skipCaptureFocusRestoreRef = useRef(false);
  const captureRequestVersionRef = useRef(0);
  const captureHomeDataRef = useRef<ToolbarCaptureHomeData>(EMPTY_CAPTURE_HOME_DATA);

  const setCaptureHomeDataWithRef = useCallback((next: ToolbarCaptureHomeData) => {
    captureHomeDataRef.current = next;
    setCaptureHomeData(next);
  }, []);

  const preferredCaptureProjectId = useMemo(() => {
    if (!currentProjectId) {
      return null;
    }
    const project = projects.find((entry) => entry.id === currentProjectId) || null;
    return project && !project.isPersonal ? project.id : null;
  }, [currentProjectId, projects]);

  const defaultTaskProjectId = useMemo(() => {
    if (currentProjectId && projects.some((project) => project.id === currentProjectId)) {
      return currentProjectId;
    }
    if (captureHomeData.personalProjectId && projects.some((project) => project.id === captureHomeData.personalProjectId)) {
      return captureHomeData.personalProjectId;
    }
    const personalProjectId = projects.find((project) => project.isPersonal)?.id;
    if (personalProjectId) {
      return personalProjectId;
    }
    return projects[0]?.id || '';
  }, [captureHomeData.personalProjectId, currentProjectId, projects]);

  useEffect(() => {
    captureRequestVersionRef.current += 1;
    setCaptureHomeDataWithRef(EMPTY_CAPTURE_HOME_DATA);
    setCaptureLoading(false);
  }, [accessToken, setCaptureHomeDataWithRef]);

  const refreshCaptureData = useCallback(async (): Promise<ToolbarCaptureHomeData> => {
    if (!accessToken) {
      captureRequestVersionRef.current += 1;
      setCaptureHomeDataWithRef(EMPTY_CAPTURE_HOME_DATA);
      setCaptureLoading(false);
      return EMPTY_CAPTURE_HOME_DATA;
    }
    const requestVersion = captureRequestVersionRef.current + 1;
    captureRequestVersionRef.current = requestVersion;
    setCaptureLoading(true);
    try {
      const next = await getHubHome(accessToken, {
        tasks_limit: 1,
        events_limit: 1,
        captures_limit: 20,
        notifications_limit: 1,
      });
      if (captureRequestVersionRef.current !== requestVersion) {
        return captureHomeDataRef.current;
      }
      const nextHomeData: ToolbarCaptureHomeData = {
        personalProjectId: next.personal_project_id,
        captures: next.captures,
      };
      setCaptureHomeDataWithRef(nextHomeData);
      return nextHomeData;
    } catch {
      if (captureRequestVersionRef.current !== requestVersion) {
        return captureHomeDataRef.current;
      }
      // Best-effort toolbar data.
      return captureHomeDataRef.current;
    } finally {
      if (captureRequestVersionRef.current === requestVersion) {
        setCaptureLoading(false);
      }
    }
  }, [accessToken, setCaptureHomeDataWithRef]);

  const closeCapturePanel = useCallback((options?: { restoreFocus?: boolean }) => {
    skipCaptureFocusRestoreRef.current = options?.restoreFocus === false;
    setCaptureOpen(false);
  }, []);

  const openCapturePanel = useCallback((intent: string | null, restoreTarget?: HTMLElement | null) => {
    captureRestoreTargetRef.current = restoreTarget ?? captureTriggerRef.current;
    skipCaptureFocusRestoreRef.current = false;
    setCaptureIntent(intent && intent !== 'inbox' ? intent : null);
    setCaptureActivationKey((current) => current + 1);
    setCaptureOpen(true);
  }, []);

  const onQuickCapture = useCallback(() => {
    if (captureOpen && !captureIntent) {
      closeCapturePanel();
      return;
    }
    openCapturePanel(null, captureTriggerRef.current);
  }, [captureIntent, captureOpen, closeCapturePanel, openCapturePanel]);

  useCapturePanelEffects({
    captureOpen,
    refreshCaptureData,
    setCaptureAnnouncement,
  });

  return {
    captureOpen,
    setCaptureOpen,
    captureTriggerRef,
    captureRestoreTargetRef,
    skipCaptureFocusRestoreRef,
    captureHomeData,
    captureLoading,
    preferredCaptureProjectId,
    defaultTaskProjectId,
    captureIntent,
    captureActivationKey,
    refreshCaptureData,
    closeCapturePanel,
    openCapturePanel,
    onQuickCapture,
  };
};
