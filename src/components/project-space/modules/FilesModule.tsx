import { Suspense, lazy } from 'react';
import type { ContractModuleConfig } from '../ModuleGrid';
import { ModuleLoadingState } from '../ModuleFeedback';
import type { WorkViewFilesRuntime } from '../WorkView';

const FilesModuleSkin = lazy(async () => {
  const module = await import('../FilesModuleSkin');
  return { default: module.FilesModuleSkin };
});

interface Props {
  module: ContractModuleConfig;
  runtime: WorkViewFilesRuntime;
  canEditPane: boolean;
}

export const FilesModule = ({ module, runtime, canEditPane }: Props) => (
  <Suspense fallback={<ModuleLoadingState label="Loading files module" rows={4} />}>
    <FilesModuleSkin
      sizeTier={module.size_tier}
      files={module.lens === 'project' ? runtime.projectFiles : runtime.paneFiles}
      onUpload={
        canEditPane
          ? module.lens === 'project'
            ? runtime.onUploadProjectFiles
            : runtime.onUploadPaneFiles
          : () => undefined
      }
      onOpenFile={runtime.onOpenFile}
      readOnly={!canEditPane}
    />
  </Suspense>
);
