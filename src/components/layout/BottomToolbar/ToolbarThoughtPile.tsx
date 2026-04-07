import { Icon, Popover, PopoverAnchor } from '../../primitives';
import { ThoughtPilePanel } from './ToolbarDialogs/ThoughtPilePanel';
import type { BottomToolbarProps } from './types';

type ToolbarThoughtPileProps = Pick<
  BottomToolbarProps,
  | 'captureOpen'
  | 'setCaptureOpen'
  | 'captureTriggerRef'
  | 'onQuickCapture'
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
  <Popover open={captureOpen} onOpenChange={setCaptureOpen} modal>
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
  </Popover>
);
