import { Suspense, lazy } from 'react';
import type { ContractWidgetConfig } from '../WidgetGrid';
import { WidgetLoadingState } from '../WidgetFeedback';
import type { TableWidgetContract } from '../widgetContracts';

const TableWidgetSkin = lazy(async () => {
  const module = await import('../TableWidgetSkin');
  return { default: module.TableWidgetSkin };
});

interface Props {
  widget: ContractWidgetConfig;
  contract: TableWidgetContract;
  canEditProject: boolean;
  previewMode?: boolean;
  onOpenRecord?: (recordId: string) => void;
  onSetWidgetBinding: (widgetInstanceId: string, binding: ContractWidgetConfig['binding']) => void;
}

const resolveBoundViewId = (
  widget: ContractWidgetConfig,
  views: TableWidgetContract['views'],
  defaultViewId: string | null,
): string | null => {
  const requested = widget.binding?.view_id;
  if (requested && views.some((view) => view.view_id === requested)) {
    return requested;
  }
  return defaultViewId;
};

export const TableWidget = ({
  widget,
  contract,
  canEditProject,
  previewMode = false,
  onOpenRecord,
  onSetWidgetBinding,
}: Props) => {
  const selectedViewId = resolveBoundViewId(widget, contract.views, contract.defaultViewId);
  const viewData = selectedViewId ? contract.dataByViewId[selectedViewId] : undefined;
  const createRecord = canEditProject && selectedViewId ? contract.onCreateRecord : undefined;
  const updateRecord = canEditProject && selectedViewId ? contract.onUpdateRecord : undefined;
  const deleteRecords = canEditProject && selectedViewId ? contract.onDeleteRecords : undefined;
  const bulkUpdateRecords = canEditProject && selectedViewId ? contract.onBulkUpdateRecords : undefined;

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 overflow-hidden">
      {contract.views.length > 0 && !previewMode ? (
        <label className="block text-xs text-muted">
          Source view
          <select
            value={selectedViewId || ''}
            disabled={!canEditProject}
            onChange={(event) => onSetWidgetBinding(
              widget.widget_instance_id,
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
        <Suspense fallback={<WidgetLoadingState label="Loading table widget" rows={6} />}>
          <TableWidgetSkin
            sizeTier={widget.size_tier}
            schema={viewData?.schema || null}
            records={viewData?.records || []}
            loading={viewData?.loading ?? false}
            readOnly={previewMode}
            previewMode={previewMode}
            titleColumnLabel={contract.titleColumnLabel}
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
