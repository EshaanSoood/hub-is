import { Suspense, lazy } from 'react';
import type { ContractWidgetConfig } from '../WidgetGrid';
import { WidgetLoadingState } from '../WidgetFeedback';
import type { HubProjectSummary } from '../../../services/hub/types';
import type { QuickThoughtsWidgetContract } from '../widgetContracts';

const QuickThoughtsWidgetSkin = lazy(async () => {
  const module = await import('../QuickThoughtsWidgetSkin');
  return { default: module.QuickThoughtsWidgetSkin };
});

interface Props {
  widget: ContractWidgetConfig;
  contract: QuickThoughtsWidgetContract;
  project: HubProjectSummary;
  canEditProject: boolean;
  previewMode?: boolean;
}

export const QuickThoughtsWidget = ({ widget, contract, project, canEditProject, previewMode = false }: Props) => (
  <Suspense fallback={<WidgetLoadingState label="Loading Quick Thoughts widget" rows={5} />}>
    <QuickThoughtsWidgetSkin
      key={`${contract.storageKeyBase}:${project.project_id}:${widget.widget_instance_id}`}
      sizeTier={widget.size_tier}
      storageKey={`${contract.storageKeyBase}:${project.project_id}:${widget.widget_instance_id}`}
      legacyStorageKey={
        contract.legacyStorageKeyBase
          ? `${contract.legacyStorageKeyBase}:${project.project_id}:${widget.widget_instance_id}`
          : undefined
      }
      initialEntries={contract.initialEntries}
      onInsertToEditor={previewMode ? undefined : contract.onInsertToEditor}
      readOnly={previewMode || !canEditProject}
      previewMode={previewMode}
    />
  </Suspense>
);
