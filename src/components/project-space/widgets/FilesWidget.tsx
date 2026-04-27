import { Suspense, lazy } from 'react';
import type { ContractWidgetConfig } from '../WidgetGrid';
import { WidgetLoadingState } from '../WidgetFeedback';
import type { FilesWidgetContract } from '../widgetContracts';

const FilesWidgetSkin = lazy(async () => {
  const module = await import('../FilesWidgetSkin');
  return { default: module.FilesWidgetSkin };
});

interface Props {
  widget: ContractWidgetConfig;
  contract: FilesWidgetContract;
  canEditProject: boolean;
  previewMode?: boolean;
}

export const FilesWidget = ({ widget, contract, canEditProject, previewMode = false }: Props) => {
  const uploadHandler = previewMode || !canEditProject
    ? () => undefined
    : widget.lens === 'space'
      ? contract.onUploadSpaceFiles
      : contract.onUploadProjectFiles;

  return (
    <Suspense fallback={<WidgetLoadingState label="Loading files widget" rows={4} />}>
      <FilesWidgetSkin
        sizeTier={widget.size_tier}
        files={widget.lens === 'space' ? contract.spaceFiles : contract.projectFiles}
        onUpload={uploadHandler}
        onOpenFile={contract.onOpenFile}
        onInsertToEditor={previewMode ? undefined : contract.onInsertToEditor}
        readOnly={previewMode || !canEditProject}
        previewMode={previewMode}
      />
    </Suspense>
  );
};
