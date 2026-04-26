import type { HubPaneSummary } from '../../../services/hub/types';
import type { ProjectRecord } from '../../../types/domain';
import { CaptureInput } from '../../Sidebar/CaptureInput';
import type { SidebarCaptureSurface } from '../../Sidebar/CaptureInput/shared';
import { Icon } from '../../primitives/Icon';

interface AppCommandBarProps {
  accessToken: string | null | undefined;
  currentPaneId: string | null;
  currentProject: ProjectRecord | null;
  currentProjectPanes: HubPaneSummary[];
  currentSurface: SidebarCaptureSurface;
  onOpenQuickThoughts: () => void;
  personalProject: ProjectRecord | null;
}

export const AppCommandBar = ({
  accessToken,
  currentPaneId,
  currentProject,
  currentProjectPanes,
  currentSurface,
  onOpenQuickThoughts,
  personalProject,
}: AppCommandBarProps) => (
  <header className="command-center-surface rounded-panel px-5 py-3">
    <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:gap-4">
      <div className="shrink-0 xl:w-28">
        <p className="text-sm font-semibold text-secondary-strong">Capture.</p>
      </div>

      <div className="min-w-0 flex-1 xl:flex xl:justify-center">
        <div className="min-w-0 xl:w-full xl:max-w-3xl">
          <CaptureInput
            accessToken={accessToken}
            autoFocusKey={0}
            currentPaneId={currentPaneId}
            currentProject={currentProject}
            currentProjectPanes={currentProjectPanes}
            currentSurface={currentSurface}
            currentSurfaceLabel={null}
            isCollapsed={false}
            onOpenCapture={() => {}}
            personalProject={personalProject}
            placeholder="Capture anything and experience the magic."
            showLabels
            variant="command-bar"
          />
        </div>
      </div>

      <div className="xl:flex xl:justify-end">
        <div className="flex flex-wrap items-center justify-end gap-2">
          <button
            type="button"
            data-home-launcher="thoughts"
            onClick={onOpenQuickThoughts}
            className="ghost-button inline-flex h-10 items-center gap-2 bg-surface px-3 text-sm font-medium text-text transition-colors hover:bg-surface-highest focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
          >
            <Icon name="thought-pile" size={14} />
            <span>Quick thoughts</span>
          </button>
        </div>
      </div>
    </div>
  </header>
);
