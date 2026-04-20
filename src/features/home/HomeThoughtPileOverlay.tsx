import type { ProjectRecord } from '../../types/domain';
import { Dialog } from '../../components/primitives';
import { QuickCapturePanel } from '../QuickCapture';
import type { HomeOverlayId } from './navigation';
import type { HomeSurfaceIdentity } from './useHomeSurfaceIdentity';
import { useHomeThoughtPileRuntime } from './useHomeThoughtPileRuntime';

interface HomeThoughtPileOverlayProps {
  accessToken: string | null | undefined;
  activeOverlay: HomeOverlayId | null;
  identity: HomeSurfaceIdentity;
  onClose: (options?: { restoreFocus?: boolean }) => void;
  projects: ProjectRecord[];
}

export const HomeThoughtPileOverlay = ({
  accessToken,
  activeOverlay,
  identity,
  onClose,
  projects,
}: HomeThoughtPileOverlayProps) => {
  const runtime = useHomeThoughtPileRuntime({
    accessToken,
    enabled: activeOverlay === 'thoughts',
  });
  if (activeOverlay !== 'thoughts') {
    return null;
  }

  return (
    <Dialog
      open
      title="Quick thoughts"
      description="Capture a quick thought, task, reminder, or calendar item."
      onClose={() => onClose()}
      panelClassName="dialog-panel-wide-size"
    >
      <QuickCapturePanel
        accessToken={accessToken ?? null}
        projects={projects}
        personalProjectId={identity.backingProjectId}
        captures={runtime.captures}
        capturesLoading={runtime.loading}
        onCaptureComplete={runtime.refresh}
        activationKey={1}
        onRequestClose={onClose}
      />
    </Dialog>
  );
};
