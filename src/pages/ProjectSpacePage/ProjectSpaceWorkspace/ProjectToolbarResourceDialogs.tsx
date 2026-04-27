import { lazy, Suspense, useMemo, useRef, useState, type ReactElement } from 'react';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '../../../components/project-space/ProjectSpaceDialogPrimitives';
import { WidgetLoadingState } from '../../../components/project-space/WidgetFeedback';
import { Icon } from '../../../components/primitives';
import type { HubProjectSummary } from '../../../services/hub/types';
import type { FilesWidgetContract, ScratchPadContract } from '../../../components/project-space/widgetContracts';

const ScratchPadSkin = lazy(async () => {
  const module = await import('../../../components/project-space/ScratchPadSkin');
  return { default: module.ScratchPadSkin };
});

const FilesWidgetSkin = lazy(async () => {
  const module = await import('../../../components/project-space/FilesWidgetSkin');
  return { default: module.FilesWidgetSkin };
});

interface ProjectToolbarResourceDialogsProps {
  activeProject: HubProjectSummary | null;
  activeProjectCanEdit: boolean;
  filesContract: FilesWidgetContract;
  scratchPadContract: ScratchPadContract;
  buttonClassName: string;
}

const readLegacyScratchPadStorageKeys = (
  project: HubProjectSummary,
  scratchPadContract: ScratchPadContract,
): string[] => {
  const widgets = Array.isArray(project.layout_config?.widgets) ? project.layout_config.widgets : [];
  return widgets.flatMap((entry) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      return [];
    }
    const widget = entry as Record<string, unknown>;
    if (widget.widget_type !== 'quick_thoughts' || typeof widget.widget_instance_id !== 'string') {
      return [];
    }
    const widgetInstanceId = widget.widget_instance_id.trim();
    if (!widgetInstanceId) {
      return [];
    }
    return [
      `${scratchPadContract.storageKeyBase}:${project.project_id}:${widgetInstanceId}`,
      ...(scratchPadContract.legacyStorageKeyBase
        ? [`${scratchPadContract.legacyStorageKeyBase}:${project.project_id}:${widgetInstanceId}`]
        : []),
    ];
  });
};

export const ProjectToolbarResourceDialogs = ({
  activeProject,
  activeProjectCanEdit,
  filesContract,
  scratchPadContract,
  buttonClassName,
}: ProjectToolbarResourceDialogsProps): ReactElement => {
  const [scratchPadOpen, setScratchPadOpen] = useState(false);
  const [filesOpen, setFilesOpen] = useState(false);
  const scratchPadTriggerRef = useRef<HTMLButtonElement | null>(null);
  const filesTriggerRef = useRef<HTMLButtonElement | null>(null);

  const scratchPadStorageKey = activeProject
    ? `${scratchPadContract.storageKeyBase}:${activeProject.project_id}`
    : `${scratchPadContract.storageKeyBase}:unavailable`;
  const scratchPadLegacyStorageKey = activeProject && scratchPadContract.legacyStorageKeyBase
    ? `${scratchPadContract.legacyStorageKeyBase}:${activeProject.project_id}`
    : undefined;
  const scratchPadLegacyStorageKeys = useMemo(
    () => (activeProject ? readLegacyScratchPadStorageKeys(activeProject, scratchPadContract) : []),
    [activeProject, scratchPadContract],
  );

  const uploadProjectFiles: FilesWidgetContract['onUploadProjectFiles'] = activeProjectCanEdit
    ? filesContract.onUploadProjectFiles
    : () => undefined;

  return (
    <>
      <button
        ref={scratchPadTriggerRef}
        type="button"
        className={buttonClassName}
        aria-haspopup="dialog"
        aria-expanded={scratchPadOpen}
        onClick={() => setScratchPadOpen(true)}
        disabled={!activeProject}
      >
        <Icon name="thought-pile" className="mr-1 text-[14px]" />
        Scratch Pad
      </button>
      <button
        ref={filesTriggerRef}
        type="button"
        className={buttonClassName}
        aria-haspopup="dialog"
        aria-expanded={filesOpen}
        onClick={() => setFilesOpen(true)}
        disabled={!activeProject}
      >
        <Icon name="upload" className="mr-1 text-[14px]" />
        Files
      </button>

      {activeProject ? (
        <Dialog open={scratchPadOpen} onOpenChange={setScratchPadOpen}>
          <DialogContent
            open={scratchPadOpen}
            aria-label="Scratch Pad"
            aria-describedby={undefined}
            className="flex max-h-[min(720px,calc(100dvh-2rem))] w-[min(760px,calc(100vw-2rem))] flex-col overflow-hidden p-0"
            onCloseAutoFocus={(event) => {
              event.preventDefault();
              scratchPadTriggerRef.current?.focus();
            }}
          >
            <DialogHeader className="border-b border-border-muted px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <DialogTitle className="heading-3">Scratch Pad</DialogTitle>
                <DialogClose className="inline-flex h-8 w-8 items-center justify-center rounded-control text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring">
                  <Icon name="close" className="text-[14px]" />
                  <span className="sr-only">Close Scratch Pad</span>
                </DialogClose>
              </div>
            </DialogHeader>
            <div className="min-h-0 flex-1 overflow-y-auto p-3">
              <Suspense fallback={<WidgetLoadingState label="Loading Scratch Pad" rows={5} />}>
                <ScratchPadSkin
                  key={scratchPadStorageKey}
                  sizeTier="L"
                  storageKey={scratchPadStorageKey}
                  legacyStorageKey={scratchPadLegacyStorageKey}
                  legacyStorageKeys={scratchPadLegacyStorageKeys}
                  initialEntries={scratchPadContract.initialEntries}
                  onInsertToEditor={scratchPadContract.onInsertToEditor}
                  readOnly={!activeProjectCanEdit}
                />
              </Suspense>
            </div>
          </DialogContent>
        </Dialog>
      ) : null}

      {activeProject ? (
        <Dialog open={filesOpen} onOpenChange={setFilesOpen}>
          <DialogContent
            open={filesOpen}
            aria-label="Files"
            aria-describedby={undefined}
            className="flex max-h-[min(720px,calc(100dvh-2rem))] w-[min(820px,calc(100vw-2rem))] flex-col overflow-hidden p-0"
            onCloseAutoFocus={(event) => {
              event.preventDefault();
              filesTriggerRef.current?.focus();
            }}
          >
            <DialogHeader className="border-b border-border-muted px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <DialogTitle className="heading-3">Files</DialogTitle>
                <DialogClose className="inline-flex h-8 w-8 items-center justify-center rounded-control text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring">
                  <Icon name="close" className="text-[14px]" />
                  <span className="sr-only">Close Files</span>
                </DialogClose>
              </div>
            </DialogHeader>
            <div className="min-h-0 flex-1 overflow-y-auto p-3">
              <Suspense fallback={<WidgetLoadingState label="Loading files" rows={4} />}>
                <FilesWidgetSkin
                  sizeTier="L"
                  files={filesContract.projectFiles}
                  onUpload={uploadProjectFiles}
                  onOpenFile={filesContract.onOpenFile}
                  onInsertToEditor={filesContract.onInsertToEditor}
                  readOnly={!activeProjectCanEdit}
                />
              </Suspense>
            </div>
          </DialogContent>
        </Dialog>
      ) : null}
    </>
  );
};
