import { useCallback, useRef, useState } from 'react';
import { convertRecord } from '../../../services/hub/records';
import type { HubCollection, HubHomeCapture } from '../../../services/hub/types';
import {
  PERSONAL_CAPTURE_TARGET,
  resolveTargetProjectForMode,
  selectPersonalCaptureCollection,
  selectProjectCaptureCollection,
} from '../model';
import { useCaptureListEffects } from './useCaptureListEffects';
import type { CaptureMode, ExpandedCaptureAssignment } from '../types';

interface UseQuickCaptureAssignmentParams {
  accessToken: string | null;
  captures: HubHomeCapture[];
  defaultProjectCaptureTarget: string;
  personalProjectId: string | null;
  onCaptureComplete: () => void | Promise<void>;
  loadPersonalCollections: () => Promise<HubCollection[]>;
  loadProjectCollections: (projectId: string) => Promise<HubCollection[]>;
}

export const useQuickCaptureAssignment = ({
  accessToken,
  captures,
  defaultProjectCaptureTarget,
  personalProjectId,
  onCaptureComplete,
  loadPersonalCollections,
  loadProjectCollections,
}: UseQuickCaptureAssignmentParams) => {
  const [expandedCaptureAssignment, setExpandedCaptureAssignment] = useState<ExpandedCaptureAssignment | null>(null);
  const [captureAssignmentSavingId, setCaptureAssignmentSavingId] = useState<string | null>(null);
  const [captureAssignmentError, setCaptureAssignmentError] = useState<string | null>(null);
  const [expandedHoverCaptureId, setExpandedHoverCaptureId] = useState<string | null>(null);
  const hoverExpandTimerRef = useRef<number | null>(null);

  useCaptureListEffects({
    captures,
    expandedCaptureAssignment,
    setExpandedCaptureAssignment,
    setCaptureAssignmentError,
    hoverExpandTimerRef,
  });

  const resetAssignmentRuntime = useCallback(() => {
    setExpandedCaptureAssignment(null);
    setCaptureAssignmentError(null);
    if (hoverExpandTimerRef.current) {
      window.clearTimeout(hoverExpandTimerRef.current);
      hoverExpandTimerRef.current = null;
    }
    setExpandedHoverCaptureId(null);
  }, []);

  const applyCaptureAssignment = useCallback(
    async (capture: HubHomeCapture, nextMode: CaptureMode, nextProjectId: string) => {
      if (!accessToken) {
        setCaptureAssignmentError('An authenticated session is required.');
        return;
      }
      if (captureAssignmentSavingId) {
        return;
      }
      if (nextMode === 'thought' && nextProjectId === PERSONAL_CAPTURE_TARGET) {
        setExpandedCaptureAssignment(null);
        setCaptureAssignmentError(null);
        return;
      }
      if ((nextMode === 'reminder' || nextMode === 'calendar') && nextProjectId === PERSONAL_CAPTURE_TARGET) {
        setCaptureAssignmentError('Choose a space to assign reminders or calendar items.');
        return;
      }
      if (nextMode === 'reminder' || nextMode === 'calendar') {
        setCaptureAssignmentError('Reminder and calendar capture conversion is not supported yet.');
        return;
      }

      setCaptureAssignmentSavingId(capture.record_id);
      setCaptureAssignmentError(null);
      try {
        const targetProjectId = nextProjectId === PERSONAL_CAPTURE_TARGET ? personalProjectId : nextProjectId;
        if (!targetProjectId) {
          throw new Error('A target space is required.');
        }

        let targetCollectionId: string | undefined;
        if (!(nextMode === 'task' && nextProjectId === PERSONAL_CAPTURE_TARGET)) {
          const collections = targetProjectId === personalProjectId
            ? await loadPersonalCollections()
            : await loadProjectCollections(targetProjectId);
          const targetCollection = targetProjectId === personalProjectId && nextMode === 'thought'
            ? selectPersonalCaptureCollection(collections)
            : selectProjectCaptureCollection(collections, nextMode);
          if (!targetCollection) {
            throw new Error('No matching collection is available for this assignment.');
          }
          targetCollectionId = targetCollection.collection_id;
        }

        await convertRecord(accessToken, capture.record_id, {
          mode: nextMode,
          target_project_id: targetProjectId,
          ...(targetCollectionId ? { target_collection_id: targetCollectionId } : {}),
        });

        await onCaptureComplete();
        setExpandedCaptureAssignment(null);
        setCaptureAssignmentError(null);
      } catch (error) {
        setCaptureAssignmentError(error instanceof Error ? error.message : 'Failed to assign capture.');
      } finally {
        setCaptureAssignmentSavingId(null);
      }
    },
    [
      accessToken,
      captureAssignmentSavingId,
      loadPersonalCollections,
      loadProjectCollections,
      onCaptureComplete,
      personalProjectId,
    ],
  );

  const onToggleCaptureAssignment = useCallback((capture: HubHomeCapture) => {
    setCaptureAssignmentError(null);
    setExpandedCaptureAssignment((current) => {
      if (current?.recordId === capture.record_id) {
        return null;
      }
      return {
        recordId: capture.record_id,
        mode: 'thought',
        projectId: PERSONAL_CAPTURE_TARGET,
      };
    });
  }, []);

  const onCaptureRowMouseEnter = useCallback((recordId: string) => {
    if (hoverExpandTimerRef.current) {
      window.clearTimeout(hoverExpandTimerRef.current);
    }
    hoverExpandTimerRef.current = window.setTimeout(() => {
      setExpandedHoverCaptureId(recordId);
      hoverExpandTimerRef.current = null;
    }, 2000);
  }, []);

  const onCaptureRowMouseLeave = useCallback(() => {
    if (hoverExpandTimerRef.current) {
      window.clearTimeout(hoverExpandTimerRef.current);
      hoverExpandTimerRef.current = null;
    }
    setExpandedHoverCaptureId(null);
  }, []);

  const onAssignmentModeChange = useCallback((capture: HubHomeCapture, assignmentProjectId: string, nextMode: CaptureMode) => {
    const nextProjectId = resolveTargetProjectForMode(nextMode, assignmentProjectId, defaultProjectCaptureTarget);
    setExpandedCaptureAssignment({
      recordId: capture.record_id,
      mode: nextMode,
      projectId: nextProjectId,
    });
    if (nextMode === 'thought' || (nextMode === 'task' && nextProjectId === PERSONAL_CAPTURE_TARGET)) {
      void applyCaptureAssignment(capture, nextMode, nextProjectId);
    } else if (nextProjectId !== PERSONAL_CAPTURE_TARGET) {
      void applyCaptureAssignment(capture, nextMode, nextProjectId);
    }
  }, [applyCaptureAssignment, defaultProjectCaptureTarget]);

  const onAssignmentProjectChange = useCallback((capture: HubHomeCapture, assignmentMode: CaptureMode, value: string) => {
    setExpandedCaptureAssignment({
      recordId: capture.record_id,
      mode: assignmentMode,
      projectId: value,
    });
    if (value !== PERSONAL_CAPTURE_TARGET || assignmentMode === 'task') {
      void applyCaptureAssignment(capture, assignmentMode, value);
    }
  }, [applyCaptureAssignment]);

  return {
    expandedCaptureAssignment,
    captureAssignmentSavingId,
    captureAssignmentError,
    expandedHoverCaptureId,
    resetAssignmentRuntime,
    onToggleCaptureAssignment,
    onCaptureRowMouseEnter,
    onCaptureRowMouseLeave,
    onAssignmentModeChange,
    onAssignmentProjectChange,
  };
};
