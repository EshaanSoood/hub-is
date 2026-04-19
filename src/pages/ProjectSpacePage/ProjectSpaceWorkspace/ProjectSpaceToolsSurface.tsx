import { type ComponentProps, type FormEventHandler, type ReactElement } from 'react';
import { InlineNotice } from '../../../components/primitives';
import { AutomationBuilder } from '../../../components/project-space/AutomationBuilder';

type AssetRootItem = {
  asset_root_id: string;
  root_path: string;
};

type AssetEntryItem = {
  path: string;
  name: string;
};

type AutomationBuilderProps = ComponentProps<typeof AutomationBuilder>;

export type ProjectSpaceToolsSurfaceProps = {
  assetRoots: AssetRootItem[];
  assetEntries: AssetEntryItem[];
  assetWarning: string | null | undefined;
  newAssetRootPath: string;
  onNewAssetRootPathChange: (value: string) => void;
  onAddAssetRoot: FormEventHandler<HTMLFormElement>;
  onLoadAssets: (assetRootId: string) => void;
  automationRules: AutomationBuilderProps['rules'];
  automationRuns: AutomationBuilderProps['runs'];
  availableRecordTypes: AutomationBuilderProps['availableRecordTypes'];
  onCreateAutomationRule: AutomationBuilderProps['onCreateRule'];
  onUpdateAutomationRule: AutomationBuilderProps['onUpdateRule'];
  onDeleteAutomationRule: AutomationBuilderProps['onDeleteRule'];
  onToggleAutomationRule: AutomationBuilderProps['onToggleRule'];
};

export const ProjectSpaceToolsSurface = ({
  assetRoots,
  assetEntries,
  assetWarning,
  newAssetRootPath,
  onNewAssetRootPathChange,
  onAddAssetRoot,
  onLoadAssets,
  automationRules,
  automationRuns,
  availableRecordTypes,
  onCreateAutomationRule,
  onUpdateAutomationRule,
  onDeleteAutomationRule,
  onToggleAutomationRule,
}: ProjectSpaceToolsSurfaceProps): ReactElement => (
  <section className="space-y-4">
    <article className="rounded-panel border border-subtle bg-elevated p-4">
      <h2 className="heading-3 text-primary">Asset Library Roots</h2>
      <form className="mt-2 flex flex-wrap gap-2" onSubmit={onAddAssetRoot}>
        <input
          value={newAssetRootPath}
          onChange={(event) => onNewAssetRootPathChange(event.target.value)}
          className="rounded-panel border border-border-muted bg-surface px-3 py-1.5 text-sm text-text"
          placeholder="/Projects/Home"
          aria-label="Asset root path"
        />
        <button type="submit" className="rounded-panel border border-border-muted px-3 py-1.5 text-sm font-semibold text-primary">
          Add root
        </button>
      </form>
      <ul className="mt-3 space-y-2">
        {assetRoots.map((root) => (
          <li key={root.asset_root_id} className="rounded-panel border border-border-muted p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm text-text">{root.root_path}</p>
              <button
                type="button"
                className="rounded-panel border border-border-muted px-2 py-1 text-xs font-semibold text-primary"
                onClick={() => void onLoadAssets(root.asset_root_id)}
              >
                List assets
              </button>
            </div>
          </li>
        ))}
      </ul>
      {assetWarning ? (
        <InlineNotice variant="warning" className="mt-2" title="Asset warning">
          {assetWarning}
        </InlineNotice>
      ) : null}
      {assetEntries.length > 0 ? (
        <ul className="mt-2 space-y-1">
          {assetEntries.map((entry) => (
            <li key={entry.path} className="text-sm text-muted">
              {entry.name}
            </li>
          ))}
        </ul>
      ) : null}
    </article>

    <AutomationBuilder
      rules={automationRules}
      runs={automationRuns}
      availableRecordTypes={availableRecordTypes}
      onCreateRule={onCreateAutomationRule}
      onUpdateRule={onUpdateAutomationRule}
      onDeleteRule={onDeleteAutomationRule}
      onToggleRule={onToggleAutomationRule}
    />
  </section>
);
