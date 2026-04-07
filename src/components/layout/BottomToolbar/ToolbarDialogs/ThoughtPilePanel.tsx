import { QuickCapturePanel } from '../../../../features/QuickCapture';
import { PopoverContent } from '../../../primitives';
import type { BottomToolbarProps } from '../types';

type ThoughtPilePanelProps = Pick<
  BottomToolbarProps,
  | 'skipCaptureFocusRestoreRef'
  | 'captureRestoreTargetRef'
  | 'accessToken'
  | 'projects'
  | 'captureHomeData'
  | 'captureLoading'
  | 'refreshCaptureData'
  | 'preferredCaptureProjectId'
  | 'captureIntent'
  | 'captureActivationKey'
  | 'closeCapturePanel'
>;

export const ThoughtPilePanel = ({
  skipCaptureFocusRestoreRef,
  captureRestoreTargetRef,
  accessToken,
  projects,
  captureHomeData,
  captureLoading,
  refreshCaptureData,
  preferredCaptureProjectId,
  captureIntent,
  captureActivationKey,
  closeCapturePanel,
}: ThoughtPilePanelProps) => (
  <PopoverContent
    side="top"
    align="center"
    sideOffset={8}
    role="dialog"
    aria-label="Thought Pile"
    className="z-[120] w-[min(92vw,440px)] rounded-panel border border-border-muted bg-surface-elevated p-4 shadow-soft"
    onOpenAutoFocus={(event) => {
      event.preventDefault();
    }}
    onCloseAutoFocus={(event) => {
      event.preventDefault();
      if (skipCaptureFocusRestoreRef.current) {
        skipCaptureFocusRestoreRef.current = false;
        return;
      }
      const restoreTarget = captureRestoreTargetRef.current;
      if (restoreTarget?.isConnected) {
        restoreTarget.focus();
      }
    }}
  >
    <QuickCapturePanel
      accessToken={accessToken ?? null}
      projects={projects}
      personalProjectId={captureHomeData.personalProjectId}
      captures={captureHomeData.captures}
      capturesLoading={captureLoading}
      onCaptureComplete={() => void refreshCaptureData()}
      preferredProjectId={preferredCaptureProjectId}
      initialIntent={captureIntent}
      activationKey={captureActivationKey}
      onRequestClose={(options) => closeCapturePanel(options)}
    />
  </PopoverContent>
);
