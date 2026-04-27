import { Suspense, lazy, type ComponentProps, type ReactElement } from 'react';
import { InlineNotice } from '../../../components/primitives';
import { WidgetLoadingState } from '../../../components/project-space/WidgetFeedback';
import type { HubView } from '../../../services/hub/types';

const KanbanWidgetSkin = lazy(async () => {
  const module = await import('../../../components/project-space/KanbanWidgetSkin');
  return { default: module.KanbanWidgetSkin };
});

const TableWidgetSkin = lazy(async () => {
  const module = await import('../../../components/project-space/TableWidgetSkin');
  return { default: module.TableWidgetSkin };
});

type KanbanWidgetProps = ComponentProps<typeof KanbanWidgetSkin>;
type TableWidgetProps = ComponentProps<typeof TableWidgetSkin>;

interface FocusedKanbanRuntime {
  groups: KanbanWidgetProps['groups'];
  groupOptions: KanbanWidgetProps['groupOptions'];
  loading?: boolean;
  groupingConfigured?: boolean;
  groupingMessage?: string;
  groupableFields?: KanbanWidgetProps['groupableFields'];
  metadataFieldIds?: KanbanWidgetProps['metadataFieldIds'];
  wipLimits?: Record<string, number>;
}

export interface ProjectSpaceFocusedViewSectionProps {
  focusedWorkView: HubView | null;
  focusedWorkViewError: string | null;
  focusedWorkViewLoading: boolean;
  focusedWorkViewData: {
    schema: TableWidgetProps['schema'];
    records: TableWidgetProps['records'];
  } | null;
  focusedKanbanRuntime: FocusedKanbanRuntime | null;
  activeProjectCanEdit: boolean;
  activeProjectId: string | null;
  onCloseFocusedView: () => void;
  onOpenRecord: (recordId: string) => void;
  onCreateKanbanRecord: (
    viewId: string,
    payload: Parameters<NonNullable<KanbanWidgetProps['onCreateRecord']>>[0],
    projectId: string | null,
  ) => Promise<void>;
  onConfigureKanbanGrouping: (viewId: string, fieldId: string, projectId: string | null) => Promise<void>;
  onDeleteKanbanRecord: (recordId: string, projectId: string | null) => Promise<void>;
  onMoveKanbanRecord: (viewId: string, recordId: string, nextGroup: string, projectId: string | null) => void;
  onUpdateKanbanRecord: (
    viewId: string,
    recordId: string,
    fields: Parameters<NonNullable<KanbanWidgetProps['onUpdateRecord']>>[1],
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
          <Suspense fallback={<WidgetLoadingState label="Loading kanban widget" rows={5} />}>
            <KanbanWidgetSkin
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
          <Suspense fallback={<WidgetLoadingState label="Loading table widget" rows={6} />}>
            <TableWidgetSkin
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
