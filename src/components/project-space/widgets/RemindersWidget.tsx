import { Suspense, lazy } from 'react';
import type { ContractWidgetConfig } from '../WidgetGrid';
import { WidgetLoadingState } from '../WidgetFeedback';
import type { RemindersWidgetContract } from '../widgetContracts';

const RemindersWidgetSkin = lazy(async () => {
  const module = await import('../RemindersWidgetSkin');
  return { default: module.RemindersWidgetSkin };
});

interface Props {
  widget: ContractWidgetConfig;
  contract: RemindersWidgetContract;
  canEditProject: boolean;
  previewMode?: boolean;
}

export const RemindersWidget = ({ widget, contract, canEditProject, previewMode = false }: Props) => (
  <Suspense fallback={<WidgetLoadingState label="Loading reminders widget" rows={4} />}>
    <RemindersWidgetSkin
      reminders={contract.items}
      loading={contract.loading}
      error={contract.error}
      onDismiss={canEditProject ? contract.onDismiss : async () => {}}
      onCreate={canEditProject ? contract.onCreate : async () => {}}
      onInsertToEditor={previewMode ? undefined : contract.onInsertToEditor}
      sizeTier={widget.size_tier}
      readOnly={previewMode || !canEditProject}
      previewMode={previewMode}
    />
  </Suspense>
);
