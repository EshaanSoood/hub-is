import { Suspense, lazy } from 'react';
import type { ContractModuleConfig } from '../ModuleGrid';
import { ModuleLoadingState } from '../ModuleFeedback';
import type { WorkViewKanbanRuntime } from '../WorkView';

const KanbanModuleSkin = lazy(async () => {
  const module = await import('../KanbanModuleSkin');
  return { default: module.KanbanModuleSkin };
});

interface Props {
  module: ContractModuleConfig;
  runtime: WorkViewKanbanRuntime;
  canEditPane: boolean;
  onOpenRecord?: (recordId: string) => void;
  onSetModuleBinding: (moduleInstanceId: string, viewId: string) => void;
}

const resolveBoundViewId = (
  module: ContractModuleConfig,
  views: WorkViewKanbanRuntime['views'],
  defaultViewId: string | null,
): string | null => {
  const requested = module.binding?.view_id;
  if (requested && views.some((view) => view.view_id === requested)) {
    return requested;
  }
  return defaultViewId;
};

export const KanbanModule = ({
  module,
  runtime,
  canEditPane,
  onOpenRecord,
  onSetModuleBinding,
}: Props) => {
  const selectedViewId = resolveBoundViewId(module, runtime.views, runtime.defaultViewId);
  const viewData = selectedViewId ? runtime.dataByViewId[selectedViewId] : undefined;
  const createRecord = canEditPane && selectedViewId ? runtime.onCreateRecord : undefined;
  const configureGrouping = canEditPane && selectedViewId ? runtime.onConfigureGrouping : undefined;
  const updateRecord = canEditPane && selectedViewId ? runtime.onUpdateRecord : undefined;
  const deleteRecord = canEditPane && selectedViewId ? runtime.onDeleteRecord : undefined;

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 overflow-hidden">
      {runtime.views.length > 0 ? (
        <label className="block text-xs text-muted">
          Source view
          <select
            value={selectedViewId || ''}
            disabled={!canEditPane}
            onChange={(event) => onSetModuleBinding(module.module_instance_id, event.target.value)}
            className="mt-1 w-full rounded-panel border border-border-muted bg-surface px-2 py-1 text-xs text-text"
          >
            {runtime.views.map((view) => (
              <option key={view.view_id} value={view.view_id}>
                {view.name}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      {viewData?.error ? <p className="text-xs text-danger">{viewData.error}</p> : null}
      <div className="min-h-0 flex-1 overflow-hidden">
        <Suspense fallback={<ModuleLoadingState label="Loading kanban module" rows={5} />}>
          <KanbanModuleSkin
            sizeTier={module.size_tier}
            groups={viewData?.groups || []}
            groupOptions={viewData?.groupOptions || []}
            loading={viewData?.loading ?? false}
            groupingConfigured={viewData?.groupingConfigured ?? false}
            groupingMessage={viewData?.groupingMessage}
            groupableFields={viewData?.groupableFields}
            metadataFieldIds={viewData?.metadataFieldIds}
            wipLimits={viewData?.wipLimits}
            onOpenRecord={(recordId) => onOpenRecord?.(recordId)}
            onMoveRecord={(recordId, nextGroup) => {
              if (canEditPane && selectedViewId) {
                runtime.onMoveRecord(selectedViewId, recordId, nextGroup);
              }
            }}
            onCreateRecord={
              createRecord && selectedViewId
                ? (payload) => createRecord(selectedViewId, payload)
                : undefined
            }
            onConfigureGrouping={
              configureGrouping && selectedViewId
                ? (fieldId) => configureGrouping(selectedViewId, fieldId)
                : undefined
            }
            onUpdateRecord={
              updateRecord && selectedViewId
                ? (recordId, fields) => updateRecord(selectedViewId, recordId, fields)
                : undefined
            }
            onDeleteRecord={
              deleteRecord && selectedViewId
                ? (recordId) => deleteRecord(selectedViewId, recordId)
                : undefined
            }
            readOnly={!canEditPane}
          />
        </Suspense>
      </div>
    </div>
  );
};
