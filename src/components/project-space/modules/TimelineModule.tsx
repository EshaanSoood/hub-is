import { TimelineFeed } from '../TimelineFeed';
import type { TimelineModuleContract } from '../moduleContracts';

interface Props {
  contract: TimelineModuleContract;
  previewMode?: boolean;
}

export const TimelineModule = ({ contract, previewMode = false }: Props) => (
  <TimelineFeed
    clusters={contract.clusters}
    activeFilters={contract.activeFilters}
    isLoading={contract.loading}
    hasMore={contract.hasMore}
    onFilterToggle={contract.onFilterToggle}
    onLoadMore={contract.onLoadMore}
    onItemClick={contract.onItemClick}
    previewMode={previewMode}
  />
);
