import { type FormEvent, useCallback } from 'react';
import { requestHubHomeRefresh } from '../../../lib/hubHomeRefresh';
import { createPersonalTask, createRecord } from '../../../services/hub/records';
import { PERSONAL_CAPTURE_TARGET, selectPersonalCaptureCollection } from '../model';
import type { HubCollection } from '../../../services/hub/types';
import type { CaptureMode } from '../types';

interface UseQuickCaptureSubmitParams {
  accessToken: string | null;
  personalProjectId: string | null;
  captureText: string;
  captureMode: CaptureMode;
  captureTargetProjectId: string;
  personalCollections: HubCollection[];
  loadPersonalCollections: () => Promise<HubCollection[]>;
  onCaptureComplete: () => void | Promise<void>;
  onRequestClose: (options?: { restoreFocus?: boolean }) => void;
  focusCaptureInput: () => unknown;
  navigate: (href: string) => void;
  writePendingCaptureDraft: (intent: string, seedText: string) => void;
  setCaptureText: (value: string) => void;
  setCaptureSaving: (value: boolean) => void;
  setCaptureError: (value: string | null) => void;
  setCaptureNotice: (value: string | null) => void;
}

export const useQuickCaptureSubmit = ({
  accessToken,
  personalProjectId,
  captureText,
  captureMode,
  captureTargetProjectId,
  personalCollections,
  loadPersonalCollections,
  onCaptureComplete,
  onRequestClose,
  focusCaptureInput,
  navigate,
  writePendingCaptureDraft,
  setCaptureText,
  setCaptureSaving,
  setCaptureError,
  setCaptureNotice,
}: UseQuickCaptureSubmitParams) => {
  return useCallback((event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const trimmed = captureText.trim();
    if (!trimmed) {
      setCaptureError('Capture text is required.');
      return;
    }

    if (!accessToken) {
      setCaptureError('An authenticated session is required.');
      return;
    }

    setCaptureNotice(null);
    setCaptureSaving(true);
    void (async () => {
      try {
        if (captureMode === 'thought') {
          const collections = personalCollections.length > 0 ? personalCollections : await loadPersonalCollections();
          const targetCollection = selectPersonalCaptureCollection(collections);
          if (!personalProjectId || !targetCollection) {
            setCaptureError('Personal capture is unavailable right now.');
            return;
          }

          await createRecord(accessToken, personalProjectId, {
            collection_id: targetCollection.collection_id,
            title: trimmed,
          });
          await onCaptureComplete();
          setCaptureNotice('Saved');
          setCaptureText('');
          setCaptureError(null);
          focusCaptureInput();
          return;
        }

        if (captureMode === 'task' && captureTargetProjectId === PERSONAL_CAPTURE_TARGET) {
          if (!personalProjectId) {
            setCaptureError('Personal capture is unavailable right now.');
            return;
          }
          await createPersonalTask(accessToken, { project_id: personalProjectId, title: trimmed });
          requestHubHomeRefresh();
          await onCaptureComplete();
          setCaptureNotice('Saved');
          setCaptureText('');
          setCaptureError(null);
          focusCaptureInput();
          return;
        }

        if (captureTargetProjectId === PERSONAL_CAPTURE_TARGET) {
          setCaptureError('Choose a project to categorize this capture.');
          return;
        }

        const intent = captureMode === 'calendar' ? 'event' : captureMode === 'task' ? 'project-task' : 'reminder';
        writePendingCaptureDraft(intent, trimmed);
        setCaptureText('');
        setCaptureError(null);
        onRequestClose({ restoreFocus: false });
        navigate(`/projects/${encodeURIComponent(captureTargetProjectId)}/work?capture=1&intent=${encodeURIComponent(intent)}`);
      } catch (error) {
        setCaptureError(error instanceof Error ? error.message : 'Failed to save capture.');
        focusCaptureInput();
      } finally {
        setCaptureSaving(false);
      }
    })();
  }, [
    accessToken,
    captureMode,
    captureTargetProjectId,
    captureText,
    focusCaptureInput,
    loadPersonalCollections,
    navigate,
    onCaptureComplete,
    onRequestClose,
    personalCollections,
    personalProjectId,
    setCaptureError,
    setCaptureNotice,
    setCaptureSaving,
    setCaptureText,
    writePendingCaptureDraft,
  ]);
};
