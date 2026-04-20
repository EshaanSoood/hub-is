import type { ProjectRecord } from '../../types/domain';
import { QuickCapturePanel } from '../QuickCapture';
import type { HomeOverlayId } from './navigation';
import { useHomeThoughtPileRuntime } from './useHomeThoughtPileRuntime';

interface HomeThoughtPileOverlayProps {
  accessToken: string | null | undefined;
  activeOverlay: HomeOverlayId | null;
  onClose: (options?: { restoreFocus?: boolean }) => void;
  projects: ProjectRecord[];
}

export const HomeThoughtPileOverlay = ({
  accessToken,
  activeOverlay,
  onClose,
  projects,
}: HomeThoughtPileOverlayProps) => {
  const runtime = useHomeThoughtPileRuntime({
    accessToken,
    enabled: activeOverlay === 'thoughts',
  });

  const personalProject = projects.find((project) => project.isPersonal) || null;

  if (activeOverlay !== 'thoughts') {
    return null;
  }

  return (
    <section className="rounded-panel border border-subtle bg-elevated p-4">
      <QuickCapturePanel
        accessToken={accessToken ?? null}
        projects={projects}
        personalProjectId={typeof personalProject?.id === 'string' ? personalProject.id : null}
        captures={runtime.captures}
        capturesLoading={runtime.loading}
        onCaptureComplete={runtime.refresh}
        activationKey={1}
        onRequestClose={onClose}
      />
    </section>
  );
};
