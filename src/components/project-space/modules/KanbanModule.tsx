import { Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react';
import type { ContractModuleConfig } from '../ModuleGrid';
import { ModuleEmptyState, ModuleLoadingState } from '../ModuleFeedback';
import type { KanbanModuleContract } from '../moduleContracts';

const KanbanModuleSkin = lazy(async () => {
  const module = await import('../KanbanModuleSkin');
  return { default: module.KanbanModuleSkin };
});

interface Props {
  module: ContractModuleConfig;
  contract: KanbanModuleContract;
  canEditProject: boolean;
  previewMode?: boolean;
  onOpenRecord?: (recordId: string) => void;
  onSetModuleBinding: (moduleInstanceId: string, binding: ContractModuleConfig['binding']) => void;
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
  const ownedViewId = module.binding?.owned_view_id;
  if (ownedViewId && views.some((view) => view.view_id === ownedViewId)) {
    return ownedViewId;
  }
  if (module.binding?.source_mode === 'owned') {
    return null;
  }
  return defaultViewId;
};

export const KanbanModule = ({
  module,
  contract,
  canEditProject,
  previewMode = false,
  onOpenRecord,
  onSetModuleBinding,
}: Props) => {
  const autoEnsureAttemptedRef = useRef(false);
  const [setupError, setSetupError] = useState<string | null>(null);
  const isOwnedMode = module.binding?.source_mode === 'owned';
  const ownedViewId = module.binding?.owned_view_id ?? null;
  const isCreatingView = Boolean(contract.creatingViewByModuleId?.[module.module_instance_id]);
  const selectedViewId = resolveBoundViewId(module, contract.views, contract.defaultViewId);
  const viewData = selectedViewId ? contract.dataByViewId[selectedViewId] : undefined;
  const createRecord = canEditProject && selectedViewId ? contract.onCreateRecord : undefined;
  const configureGrouping = canEditProject && selectedViewId ? contract.onConfigureGrouping : undefined;
  const updateRecord = canEditProject && selectedViewId ? contract.onUpdateRecord : undefined;
  const deleteRecord = canEditProject && selectedViewId ? contract.onDeleteRecord : undefined;
  const canEnsureView = !previewMode && canEditProject && typeof contract.onEnsureView === 'function';
  const needsStandaloneBoard = !previewMode && !selectedViewId && (isOwnedMode || contract.views.length === 0);
  const acquireAutoEnsureLock = useCallback(() => {
    if (isCreatingView || autoEnsureAttemptedRef.current) {
      return false;
    }
    autoEnsureAttemptedRef.current = true;
    return true;
  }, [isCreatingView]);
  const handleEnsureView = useCallback(async () => {
    if (!contract.onEnsureView || !acquireAutoEnsureLock()) {
      return;
    }

    setSetupError(null);
    try {
      const viewId = await contract.onEnsureView(module.module_instance_id, ownedViewId);
      if (viewId) {
        onSetModuleBinding(module.module_instance_id, {
          ...module.binding,
          source_mode: 'owned',
          owned_view_id: viewId,
          view_id: viewId,
        });
        return;
      }
      setSetupError('Unable to create a kanban view for this project.');
      autoEnsureAttemptedRef.current = false;
    } catch (error) {
      setSetupError(error instanceof Error ? error.message : 'Failed to create a kanban view.');
      autoEnsureAttemptedRef.current = false;
    }
  }, [acquireAutoEnsureLock, contract, module, onSetModuleBinding, ownedViewId]);

  useEffect(() => {
    if (previewMode) {
      return;
    }
    if (!needsStandaloneBoard) {
      autoEnsureAttemptedRef.current = false;
      return;
    }

    if (!canEnsureView) {
      return;
    }
    queueMicrotask(() => {
      void handleEnsureView();
    });
  }, [canEnsureView, handleEnsureView, needsStandaloneBoard, previewMode]);

  if (needsStandaloneBoard) {
    if (isCreatingView) {
      return <ModuleLoadingState label="Preparing kanban module" visibleLabel="Preparing kanban board" rows={4} />;
    }

    return (
      <div className="space-y-3">
        <ModuleEmptyState
          title="No kanban view found yet."
          iconName="kanban"
          description={canEditProject ? 'Create a starter kanban board for this project.' : 'Open an editable project to create a kanban board.'}
          ctaLabel={canEnsureView ? 'Create kanban view' : undefined}
          onCta={canEnsureView ? () => { void handleEnsureView(); } : undefined}
          sizeTier={module.size_tier}
        />
        {setupError ? <p className="text-xs text-danger">{setupError}</p> : null}
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 overflow-hidden">
      {contract.views.length > 0 && !previewMode ? (
        <label className="block text-xs text-muted">
          Source view
          <select
            value={selectedViewId || ''}
            disabled={!canEditProject}
            onChange={(event) => onSetModuleBinding(module.module_instance_id, {
              ...module.binding,
              view_id: event.target.value,
            })}
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
            previewMode={previewMode}
            onOpenRecord={(recordId) => onOpenRecord?.(recordId)}
            onMoveRecord={(recordId, nextGroup) => {
              if (canEditProject && selectedViewId) {
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
            onInsertToEditor={previewMode ? undefined : contract.onInsertToEditor}
            readOnly={previewMode || !canEditProject}
          />
        </Suspense>
      </div>
    </div>
  );
};
