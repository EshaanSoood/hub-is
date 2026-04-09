import { AnimatePresence } from 'framer-motion';
import { Icon, Popover, PopoverAnchor } from '../../primitives';
import type { ProjectRecord } from '../../../types/domain';
import type { UseToolbarCaptureResult } from './hooks/useToolbarCapture';
import { ThoughtPilePanel } from './ToolbarDialogs/ThoughtPilePanel';

type ToolbarThoughtPileProps = Pick<
  UseToolbarCaptureResult,
  | 'captureOpen'
  | 'setCaptureOpen'
  | 'captureTriggerRef'
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
  onQuickCapture: () => void;
};

export const ToolbarThoughtPile = ({
  captureOpen,
  setCaptureOpen,
  captureTriggerRef,
  onQuickCapture,
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
}: ToolbarThoughtPileProps) => (
  <Popover
    open={captureOpen}
    onOpenChange={(open) => {
      if (open) {
        setCaptureOpen(true);
        return;
      }
      closeCapturePanel();
    }}
    modal
  >
    <PopoverAnchor asChild>
      <button
        ref={captureTriggerRef}
        type="button"
        onClick={onQuickCapture}
        aria-label="Thought Pile"
        aria-expanded={captureOpen}
        className="flex h-7 w-7 items-center justify-center rounded-control border border-border-muted text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
      >
        <Icon name="thought-pile" className="text-[14px]" />
      </button>
    </PopoverAnchor>

    <AnimatePresence>
      {captureOpen ? (
        <ThoughtPilePanel
          skipCaptureFocusRestoreRef={skipCaptureFocusRestoreRef}
          captureRestoreTargetRef={captureRestoreTargetRef}
          accessToken={accessToken}
          projects={projects}
          captureHomeData={captureHomeData}
          captureLoading={captureLoading}
          refreshCaptureData={refreshCaptureData}
          preferredCaptureProjectId={preferredCaptureProjectId}
          captureIntent={captureIntent}
          captureActivationKey={captureActivationKey}
          closeCapturePanel={closeCapturePanel}
        />
      ) : null}
    </AnimatePresence>
  </Popover>
);
