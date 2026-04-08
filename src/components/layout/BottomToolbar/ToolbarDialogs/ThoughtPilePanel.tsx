import { QuickCapturePanel } from '../../../../features/QuickCapture';
import type { ProjectRecord } from '../../../../types/domain';
import { AnimatedSurface } from '../../../motion/AnimatedSurface';
import { PopoverContent } from '../../../primitives';
import type { UseToolbarCaptureResult } from '../hooks/useToolbarCapture';

type ThoughtPilePanelProps = Pick<
  UseToolbarCaptureResult,
  | 'skipCaptureFocusRestoreRef'
  | 'captureRestoreTargetRef'
  | 'captureHomeData'
  | 'captureLoading'
  | 'refreshCaptureData'
  | 'preferredCaptureProjectId'
  | 'captureIntent'
  | 'captureActivationKey'
  | 'closeCapturePanel'
> & {
  accessToken: string | null | undefined;
  projects: ProjectRecord[];
};

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
    forceMount
    asChild
    side="top"
    align="center"
    sideOffset={8}
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
    <AnimatedSurface
      role="dialog"
      ariaLabel="Thought Pile"
      transformOrigin="bottom center"
      className="z-[120] w-[min(92vw,440px)] rounded-panel border border-border-muted bg-surface-elevated p-4 shadow-soft"
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
    </AnimatedSurface>
  </PopoverContent>
);
