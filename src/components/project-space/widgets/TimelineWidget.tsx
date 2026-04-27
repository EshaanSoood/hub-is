import { TimelineFeed } from '../TimelineFeed';
import type { TimelineWidgetContract } from '../widgetContracts';

interface Props {
  contract: TimelineWidgetContract;
  previewMode?: boolean;
}

export const TimelineWidget = ({ contract, previewMode = false }: Props) => (
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
