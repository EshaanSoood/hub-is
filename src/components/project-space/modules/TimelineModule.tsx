import { TimelineFeed } from '../TimelineFeed';
import type { WorkViewTimelineRuntime } from '../WorkView';

interface Props {
  runtime: WorkViewTimelineRuntime;
}

export const TimelineModule = ({ runtime }: Props) => (
  <TimelineFeed
    clusters={runtime.clusters}
    activeFilters={runtime.activeFilters}
    isLoading={runtime.loading}
    hasMore={runtime.hasMore}
    onFilterToggle={runtime.onFilterToggle}
    onLoadMore={runtime.onLoadMore}
    onItemClick={runtime.onItemClick}
  />
);
