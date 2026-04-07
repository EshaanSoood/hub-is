import { Dispatch, MutableRefObject, SetStateAction, useEffect } from 'react';
import type { HubHomeCapture } from '../../../services/hub/types';

interface ExpandedCaptureAssignmentWithRecordId {
  recordId: string;
}

interface UseCaptureListEffectsParams<TAssignment extends ExpandedCaptureAssignmentWithRecordId> {
  captures: HubHomeCapture[];
  expandedCaptureAssignment: TAssignment | null;
  setExpandedCaptureAssignment: Dispatch<SetStateAction<TAssignment | null>>;
  setCaptureAssignmentError: Dispatch<SetStateAction<string | null>>;
  hoverExpandTimerRef: MutableRefObject<number | null>;
}

export const useCaptureListEffects = <TAssignment extends ExpandedCaptureAssignmentWithRecordId>({
  captures,
  expandedCaptureAssignment,
  setExpandedCaptureAssignment,
  setCaptureAssignmentError,
  hoverExpandTimerRef,
}: UseCaptureListEffectsParams<TAssignment>): void => {
  useEffect(() => {
    if (!expandedCaptureAssignment) {
      return;
    }
    const stillExists = captures.some((capture) => capture.record_id === expandedCaptureAssignment.recordId);
    if (!stillExists) {
      setExpandedCaptureAssignment(null);
      setCaptureAssignmentError(null);
    }
  }, [captures, expandedCaptureAssignment]);

  useEffect(() => () => {
    if (hoverExpandTimerRef.current) {
      window.clearTimeout(hoverExpandTimerRef.current);
    }
  }, []);
};
