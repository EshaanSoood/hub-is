import { Suspense, lazy } from 'react';
import type { ContractModuleConfig } from '../ModuleGrid';
import { ModuleLoadingState } from '../ModuleFeedback';
import type { KanbanModuleContract } from '../moduleContracts';

const KanbanModuleSkin = lazy(async () => {
  const module = await import('../KanbanModuleSkin');
  return { default: module.KanbanModuleSkin };
});

interface Props {
  module: ContractModuleConfig;
  contract: KanbanModuleContract;
  canEditPane: boolean;
  onOpenRecord?: (recordId: string) => void;
  onSetModuleBinding: (moduleInstanceId: string, viewId: string) => void;
}

const resolveBoundViewId = (
  module: ContractModuleConfig,
  views: KanbanModuleContract['views'],
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
  contract,
  canEditPane,
  onOpenRecord,
  onSetModuleBinding,
}: Props) => {
  const selectedViewId = resolveBoundViewId(module, contract.views, contract.defaultViewId);
  const viewData = selectedViewId ? contract.dataByViewId[selectedViewId] : undefined;
  const createRecord = canEditPane && selectedViewId ? contract.onCreateRecord : undefined;
  const configureGrouping = canEditPane && selectedViewId ? contract.onConfigureGrouping : undefined;
  const updateRecord = canEditPane && selectedViewId ? contract.onUpdateRecord : undefined;
  const deleteRecord = canEditPane && selectedViewId ? contract.onDeleteRecord : undefined;

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 overflow-hidden">
      {contract.views.length > 0 ? (
        <label className="block text-xs text-muted">
          Source view
          <select
            value={selectedViewId || ''}
            disabled={!canEditPane}
            onChange={(event) => onSetModuleBinding(module.module_instance_id, event.target.value)}
            className="mt-1 w-full rounded-panel border border-border-muted bg-surface px-2 py-1 text-xs text-text"
          >
            {contract.views.map((view) => (
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
                contract.onMoveRecord(selectedViewId, recordId, nextGroup);
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
            onInsertToEditor={contract.onInsertToEditor}
            readOnly={!canEditPane}
          />
        </Suspense>
      </div>
    </div>
  );
};
