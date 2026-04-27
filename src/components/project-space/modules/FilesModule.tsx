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
  canEditProject: boolean;
  previewMode?: boolean;
}

export const FilesModule = ({ module, contract, canEditProject, previewMode = false }: Props) => {
  const uploadHandler = previewMode || !canEditProject
    ? () => undefined
    : module.lens === 'space'
      ? contract.onUploadSpaceFiles
      : contract.onUploadProjectFiles;

  return (
    <Suspense fallback={<ModuleLoadingState label="Loading files module" rows={4} />}>
      <FilesModuleSkin
        sizeTier={module.size_tier}
        files={module.lens === 'space' ? contract.spaceFiles : contract.projectFiles}
        onUpload={uploadHandler}
        onOpenFile={contract.onOpenFile}
        onInsertToEditor={previewMode ? undefined : contract.onInsertToEditor}
        readOnly={previewMode || !canEditProject}
        previewMode={previewMode}
      />
    </Suspense>
  );
};
