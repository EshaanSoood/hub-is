import { Suspense, lazy, type ComponentProps, type ReactElement } from 'react';
import { InlineNotice } from '../../../components/primitives';
import { ModuleLoadingState } from '../../../components/project-space/ModuleFeedback';
import type { HubView } from '../../../services/hub/types';

const KanbanModuleSkin = lazy(async () => {
  const module = await import('../../../components/project-space/KanbanModuleSkin');
  return { default: module.KanbanModuleSkin };
});

const TableModuleSkin = lazy(async () => {
  const module = await import('../../../components/project-space/TableModuleSkin');
  return { default: module.TableModuleSkin };
});

type KanbanModuleProps = ComponentProps<typeof KanbanModuleSkin>;
type TableModuleProps = ComponentProps<typeof TableModuleSkin>;

interface FocusedKanbanRuntime {
  groups: KanbanModuleProps['groups'];
  groupOptions: KanbanModuleProps['groupOptions'];
  loading?: boolean;
  groupingConfigured?: boolean;
  groupingMessage?: string;
  groupableFields?: KanbanModuleProps['groupableFields'];
  metadataFieldIds?: KanbanModuleProps['metadataFieldIds'];
  wipLimits?: Record<string, number>;
}

export interface ProjectSpaceFocusedViewSectionProps {
  focusedWorkView: HubView | null;
  focusedWorkViewError: string | null;
  focusedWorkViewLoading: boolean;
  focusedWorkViewData: {
    schema: TableModuleProps['schema'];
    records: TableModuleProps['records'];
  } | null;
  focusedKanbanRuntime: FocusedKanbanRuntime | null;
  activeProjectCanEdit: boolean;
  activeProjectId: string | null;
  onCloseFocusedView: () => void;
  onOpenRecord: (recordId: string) => void;
  onCreateKanbanRecord: (
    viewId: string,
    payload: Parameters<NonNullable<KanbanModuleProps['onCreateRecord']>>[0],
    projectId: string | null,
  ) => Promise<void>;
  onConfigureKanbanGrouping: (viewId: string, fieldId: string, projectId: string | null) => Promise<void>;
  onDeleteKanbanRecord: (recordId: string, projectId: string | null) => Promise<void>;
  onMoveKanbanRecord: (viewId: string, recordId: string, nextGroup: string, projectId: string | null) => void;
  onUpdateKanbanRecord: (
    viewId: string,
    recordId: string,
    fields: Parameters<NonNullable<KanbanModuleProps['onUpdateRecord']>>[1],
    projectId: string | null,
  ) => Promise<void>;
}

export const ProjectSpaceFocusedViewSection = ({
  focusedWorkView,
  focusedWorkViewError,
  focusedWorkViewLoading,
  focusedWorkViewData,
  focusedKanbanRuntime,
  activeProjectCanEdit,
  activeProjectId,
  onCloseFocusedView,
  onOpenRecord,
  onCreateKanbanRecord,
  onConfigureKanbanGrouping,
  onDeleteKanbanRecord,
  onMoveKanbanRecord,
  onUpdateKanbanRecord,
}: ProjectSpaceFocusedViewSectionProps): ReactElement | null => {
  if (!focusedWorkView) {
    return null;
  }

  return (
    <section className="rounded-panel border border-subtle bg-elevated p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="heading-3 text-primary">Focused View: {focusedWorkView.name}</h3>
          <p className="text-sm text-muted">Opened from an embedded doc view.</p>
        </div>
        <button
          type="button"
          className="rounded-panel border border-border-muted px-2 py-1 text-xs font-semibold text-primary"
          onClick={onCloseFocusedView}
        >
          Close focused view
        </button>
      </div>

      {focusedWorkViewError ? (
        <InlineNotice variant="danger" className="mt-3" title="Focused view unavailable">
          {focusedWorkViewError}
        </InlineNotice>
      ) : null}

      {focusedWorkView.type === 'kanban' ? (
        <div className="mt-3">
          <Suspense fallback={<ModuleLoadingState label="Loading kanban module" rows={5} />}>
            <KanbanModuleSkin
              groups={focusedKanbanRuntime?.groups || []}
              groupOptions={focusedKanbanRuntime?.groupOptions || []}
              loading={focusedKanbanRuntime?.loading ?? false}
              groupingConfigured={focusedKanbanRuntime?.groupingConfigured ?? false}
              readOnly={!activeProjectCanEdit}
              groupingMessage={focusedKanbanRuntime?.groupingMessage}
              groupableFields={focusedKanbanRuntime?.groupableFields}
              metadataFieldIds={focusedKanbanRuntime?.metadataFieldIds}
              wipLimits={focusedKanbanRuntime?.wipLimits}
              onOpenRecord={onOpenRecord}
              onCreateRecord={
                activeProjectCanEdit
                  ? async (payload) => {
                      await onCreateKanbanRecord(focusedWorkView.view_id, payload, activeProjectId);
                    }
                  : undefined
              }
              onConfigureGrouping={
                activeProjectCanEdit
                  ? async (fieldId) => {
                      await onConfigureKanbanGrouping(focusedWorkView.view_id, fieldId, activeProjectId);
                    }
                  : undefined
              }
              onDeleteRecord={
                activeProjectCanEdit
                  ? async (recordId) => {
                      await onDeleteKanbanRecord(recordId, activeProjectId);
                    }
                  : undefined
              }
              onMoveRecord={(recordId, nextGroup) => {
                if (activeProjectCanEdit) {
                  onMoveKanbanRecord(focusedWorkView.view_id, recordId, nextGroup, activeProjectId);
                }
              }}
              onUpdateRecord={
                activeProjectCanEdit
                  ? async (recordId, fields) => {
                      await onUpdateKanbanRecord(focusedWorkView.view_id, recordId, fields, activeProjectId);
                    }
                  : undefined
              }
            />
          </Suspense>
        </div>
      ) : (
        <div className="mt-3">
          <Suspense fallback={<ModuleLoadingState label="Loading table module" rows={6} />}>
            <TableModuleSkin
              schema={focusedWorkViewData?.schema || null}
              records={focusedWorkViewData?.records || []}
              loading={focusedWorkViewLoading}
              onOpenRecord={onOpenRecord}
            />
          </Suspense>
        </div>
      )}
    </section>
  );
};
