import { Suspense, lazy } from 'react';
import type { ContractModuleConfig } from '../ModuleGrid';
import { ModuleLoadingState } from '../ModuleFeedback';
import type { TableModuleContract } from '../moduleContracts';

const TableModuleSkin = lazy(async () => {
  const module = await import('../TableModuleSkin');
  return { default: module.TableModuleSkin };
});

interface Props {
  module: ContractModuleConfig;
  contract: TableModuleContract;
  canEditPane: boolean;
  onOpenRecord?: (recordId: string) => void;
  onSetModuleBinding: (moduleInstanceId: string, binding: ContractModuleConfig['binding']) => void;
}

const resolveBoundViewId = (
  module: ContractModuleConfig,
  views: TableModuleContract['views'],
  defaultViewId: string | null,
): string | null => {
  const requested = module.binding?.view_id;
  if (requested && views.some((view) => view.view_id === requested)) {
    return requested;
  }
  return defaultViewId;
};

export const TableModule = ({
  module,
  contract,
  canEditPane,
  onOpenRecord,
  onSetModuleBinding,
}: Props) => {
  const selectedViewId = resolveBoundViewId(module, contract.views, contract.defaultViewId);
  const viewData = selectedViewId ? contract.dataByViewId[selectedViewId] : undefined;
  const createRecord = canEditPane && selectedViewId ? contract.onCreateRecord : undefined;
  const updateRecord = canEditPane && selectedViewId ? contract.onUpdateRecord : undefined;
  const deleteRecords = canEditPane && selectedViewId ? contract.onDeleteRecords : undefined;
  const bulkUpdateRecords = canEditPane && selectedViewId ? contract.onBulkUpdateRecords : undefined;

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 overflow-hidden">
      {contract.views.length > 0 ? (
        <label className="block text-xs text-muted">
          Source view
          <select
            value={selectedViewId || ''}
            disabled={!canEditPane}
            onChange={(event) => onSetModuleBinding(
              module.module_instance_id,
              event.target.value ? { view_id: event.target.value } : undefined,
            )}
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
        <Suspense fallback={<ModuleLoadingState label="Loading table module" rows={6} />}>
          <TableModuleSkin
            sizeTier={module.size_tier}
            schema={viewData?.schema || null}
            records={viewData?.records || []}
            loading={viewData?.loading ?? false}
            onOpenRecord={(recordId) => onOpenRecord?.(recordId)}
            onCreateRecord={
              createRecord && selectedViewId
                ? async (payload) => createRecord(selectedViewId, payload)
                : undefined
            }
            onUpdateRecord={
              updateRecord && selectedViewId
                ? async (recordId, fields) => updateRecord(selectedViewId, recordId, fields)
                : undefined
            }
            onDeleteRecords={
              deleteRecords && selectedViewId
                ? async (recordIds) => deleteRecords(selectedViewId, recordIds)
                : undefined
            }
            onBulkUpdateRecords={
              bulkUpdateRecords && selectedViewId
                ? async (recordIds, fields) => bulkUpdateRecords(selectedViewId, recordIds, fields)
                : undefined
            }
          />
        </Suspense>
      </div>
    </div>
  );
};
