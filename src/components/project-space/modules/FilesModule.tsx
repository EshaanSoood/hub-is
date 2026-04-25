import { Suspense, lazy } from 'react';
import type { ContractModuleConfig } from '../ModuleGrid';
import { ModuleLoadingState } from '../ModuleFeedback';
import type { FilesModuleContract } from '../moduleContracts';

const FilesModuleSkin = lazy(async () => {
  const module = await import('../FilesModuleSkin');
  return { default: module.FilesModuleSkin };
});

interface Props {
  module: ContractModuleConfig;
  contract: FilesModuleContract;
  canEditPane: boolean;
  previewMode?: boolean;
}

export const FilesModule = ({ module, contract, canEditPane, previewMode = false }: Props) => {
  const uploadHandler = previewMode || !canEditPane
    ? () => undefined
    : module.lens === 'project'
      ? contract.onUploadProjectFiles
      : contract.onUploadPaneFiles;

  return (
    <Suspense fallback={<ModuleLoadingState label="Loading files module" rows={4} />}>
      <FilesModuleSkin
        sizeTier={module.size_tier}
        files={module.lens === 'project' ? contract.projectFiles : contract.paneFiles}
        onUpload={uploadHandler}
        onOpenFile={contract.onOpenFile}
        onInsertToEditor={previewMode ? undefined : contract.onInsertToEditor}
        readOnly={previewMode || !canEditPane}
        previewMode={previewMode}
      />
    </Suspense>
  );
};
