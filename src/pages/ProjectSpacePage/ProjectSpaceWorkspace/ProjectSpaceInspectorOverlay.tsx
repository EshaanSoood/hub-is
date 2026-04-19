import { RecordInspectorBodyRouter, type RecordInspectorBodyRouterProps } from '../../../components/project-space/record-inspector/RecordInspectorBodyRouter';
import { RecordInspectorShell } from '../../../components/project-space/record-inspector/RecordInspectorShell';
import type { ReactElement, RefObject } from 'react';

export interface ProjectSpaceInspectorOverlayProps extends RecordInspectorBodyRouterProps {
  inspectorTriggerRect: { top: number; left: number; width: number; height: number } | null;
  inspectorTriggerRef: RefObject<HTMLElement | null>;
  prefersReducedMotion: boolean;
  inspectorRecordId: string | null;
  closeInspectorWithFocusRestore: () => void;
}

export const ProjectSpaceInspectorOverlay = ({
  inspectorTriggerRect,
  inspectorTriggerRef,
  prefersReducedMotion,
  inspectorRecordId,
  closeInspectorWithFocusRestore,
  ...bodyRouterProps
}: ProjectSpaceInspectorOverlayProps): ReactElement => (
  <RecordInspectorShell
    open={Boolean(inspectorRecordId)}
    inspectorTriggerRect={inspectorTriggerRect}
    inspectorTriggerRef={inspectorTriggerRef}
    prefersReducedMotion={prefersReducedMotion}
    onClose={closeInspectorWithFocusRestore}
  >
    <RecordInspectorBodyRouter {...bodyRouterProps} closeInspectorWithFocusRestore={closeInspectorWithFocusRestore} />
  </RecordInspectorShell>
);
